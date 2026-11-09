package reader

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BookPage struct {
	ID            string  `json:"id"`
	CopyID        string  `json:"copy_id"`
	EditionID     string  `json:"edition_id"`
	ImageAssetID  *string `json:"image_asset_id,omitempty"`
	PageLabel     *string `json:"page_label,omitempty"`
	PageSequence  int     `json:"page_sequence"`
	OCRText       string  `json:"ocr_text"`
	OCRConfidence float64 `json:"ocr_confidence"`
	OCREngine     string  `json:"ocr_engine"`
	// LowCoverage: diisi dari ocrclient.Page.LowCoverage saat upload.
	// Dipakai untuk memutuskan apakah fallback VLM async perlu dipicu.
	LowCoverage bool `json:"low_coverage"`
	// OCRProvider: diisi belakangan oleh OCRWebhook setelah fallback VLM
	// selesai (mis. "gemini" atau "openrouter/gemma"). Kosong bila halaman
	// tidak pernah di-reread atau masih menunggu.
	OCRProvider *string `json:"ocr_provider,omitempty"`
}

type PageRepository struct {
	pool *pgxpool.Pool
}

func NewPageRepository(pool *pgxpool.Pool) *PageRepository {
	return &PageRepository{pool: pool}
}

// NextSequence menghitung page_sequence berikutnya untuk sebuah copy,
// agar urutan halaman terjaga otomatis (unik per copy_id, lihat schema.sql).
func (r *PageRepository) NextSequence(ctx context.Context, copyID string) (int, error) {
	var next int
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(page_sequence), 0) + 1 FROM book_pages WHERE copy_id = $1
	`, copyID).Scan(&next)
	return next, err
}

// DeleteBySequence menghapus SATU halaman (buat "Foto Ulang" — retake foto
// untuk halaman yang sudah ada, beda dari "Scan Ulang" yang cuma baca ulang
// gambar tersimpan lewat AI). Mengembalikan image_asset_id lama (kalau ada,
// dari halaman lawas sebelum gambar tidak lagi disimpan permanen) supaya
// pemanggil bisa membersihkan media_assets & berkasnya juga.
func (r *PageRepository) DeleteBySequence(ctx context.Context, copyID string, sequence int) (*string, error) {
	var imageAssetID *string
	err := r.pool.QueryRow(ctx, `
		DELETE FROM book_pages WHERE copy_id = $1 AND page_sequence = $2 RETURNING image_asset_id
	`, copyID, sequence).Scan(&imageAssetID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return imageAssetID, err
}

func (r *PageRepository) Create(ctx context.Context, p BookPage) (BookPage, error) {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO book_pages (copy_id, edition_id, image_asset_id, page_label, page_sequence, ocr_text, ocr_confidence, ocr_engine, low_coverage)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, p.CopyID, p.EditionID, p.ImageAssetID, p.PageLabel, p.PageSequence, p.OCRText, p.OCRConfidence, p.OCREngine, p.LowCoverage).Scan(&p.ID)
	if err != nil {
		return BookPage{}, err
	}
	return p, nil
}

func (r *PageRepository) ListByCopy(ctx context.Context, copyID string) ([]BookPage, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, copy_id, edition_id, image_asset_id, page_label, page_sequence, ocr_text, ocr_confidence, ocr_engine, low_coverage, ocr_provider
		FROM book_pages
		WHERE copy_id = $1
		ORDER BY page_sequence
	`, copyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []BookPage
	for rows.Next() {
		var p BookPage
		if err := rows.Scan(&p.ID, &p.CopyID, &p.EditionID, &p.ImageAssetID, &p.PageLabel, &p.PageSequence, &p.OCRText, &p.OCRConfidence, &p.OCREngine, &p.LowCoverage, &p.OCRProvider); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// GetByID mengambil satu halaman, dipakai RescanPage untuk menemukan gambar
// tersimpan (image_asset_id) yang akan dibaca ulang.
func (r *PageRepository) GetByID(ctx context.Context, id string) (BookPage, error) {
	var p BookPage
	err := r.pool.QueryRow(ctx, `
		SELECT id, copy_id, edition_id, image_asset_id, page_label, page_sequence, ocr_text, ocr_confidence, ocr_engine, low_coverage, ocr_provider
		FROM book_pages
		WHERE id = $1
	`, id).Scan(&p.ID, &p.CopyID, &p.EditionID, &p.ImageAssetID, &p.PageLabel, &p.PageSequence, &p.OCRText, &p.OCRConfidence, &p.OCREngine, &p.LowCoverage, &p.OCRProvider)
	if err != nil {
		return BookPage{}, err
	}
	return p, nil
}

// MarkPendingRescan menandai halaman sedang dibaca ulang secara manual
// (tombol "Scan Ulang"): low_coverage dipaksa true dan ocr_provider
// dikosongkan lagi, supaya polling & indikator "sedang diperbaiki AI" di
// frontend ikut aktif walau halaman ini sebelumnya tidak low_coverage sama
// sekali (lihat temuan: RapidOCR bisa penuh cakupan tapi hasilnya kacau).
func (r *PageRepository) MarkPendingRescan(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE book_pages SET low_coverage = true, ocr_provider = NULL WHERE id = $1
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// ClearImageAsset mengosongkan image_asset_id sebuah halaman — dipanggil
// SEBELUM media_assets-nya dihapus (media.Repository.HardDelete), karena
// ada FK constraint book_pages_image_asset_id_fkey yang mencegah baris
// media_assets dihapus selagi masih direferensikan. Teks OCR (ocr_text)
// TIDAK ikut hilang — cuma pointer ke gambar aslinya yang diputus, sesuai
// keputusan: gambar tidak perlu disimpan permanen demi storage, cukup
// teks hasil olahannya saja.
func (r *PageRepository) ClearImageAsset(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `UPDATE book_pages SET image_asset_id = NULL WHERE id = $1`, id)
	return err
}

// UpdateOCRText dipanggil dari OCRWebhook setelah fallback VLM async selesai
// membaca ulang satu halaman low_coverage. Menimpa ocr_text & ocr_engine
// dengan hasil VLM, dan mencatat provider yang berhasil (gemini/
// openrouter/gemma) di ocr_provider.
func (r *PageRepository) UpdateOCRText(ctx context.Context, id, text, provider string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE book_pages
		SET ocr_text = $2, ocr_engine = 'vlm:' || $3, ocr_provider = $3
		WHERE id = $1
	`, id, text, provider)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
