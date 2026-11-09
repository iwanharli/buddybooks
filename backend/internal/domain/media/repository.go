package media

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Asset struct {
	ID             string `json:"id"`
	CopyID         string `json:"copy_id"`
	MediaType      string `json:"media_type"`
	FilePath       string `json:"file_path"`
	FileName       string `json:"file_name"`
	MimeType       string `json:"mime_type"`
	FileSize       int64  `json:"file_size"`
	ChecksumSHA256 string `json:"checksum_sha256"`
	Caption        string `json:"caption,omitempty"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Create menyimpan metadata berkas ke media_assets. media_type default
// 'other' karena enum media_type belum punya nilai khusus untuk halaman
// hasil scan (lihat docs/enumerations.md).
func (r *Repository) Create(ctx context.Context, a Asset) (Asset, error) {
	if a.MediaType == "" {
		a.MediaType = "other"
	}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO media_assets (copy_id, media_type, file_path, file_name, mime_type, file_size, checksum_sha256, caption)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''))
		RETURNING id
	`, a.CopyID, a.MediaType, a.FilePath, a.FileName, a.MimeType, a.FileSize, a.ChecksumSHA256, a.Caption).Scan(&a.ID)
	if err != nil {
		return Asset{}, err
	}
	return a, nil
}

// ListByCopy menampilkan foto eksemplar (cover/spine/dst) yang belum
// dihapus (deleted_at IS NULL) — dipakai galeri foto CopyDetailPage,
// diurutkan terbaru dulu. Sengaja MENGECUALIKAN gambar yang dipakai sebagai
// foto halaman hasil scan OCR (book_pages.image_asset_id) — itu beda
// konsep (isi buku, lihat BookContentTab), bukan dokumentasi visual
// eksemplar, jadi tidak boleh ikut jadi kandidat foto sampul/galeri.
func (r *Repository) ListByCopy(ctx context.Context, copyID string) ([]Asset, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, copy_id, media_type, file_path, coalesce(file_name, ''), coalesce(mime_type, ''),
			coalesce(file_size, 0), coalesce(checksum_sha256, ''), coalesce(caption, '')
		FROM media_assets ma
		WHERE ma.copy_id = $1 AND ma.deleted_at IS NULL
			AND NOT EXISTS (SELECT 1 FROM book_pages bp WHERE bp.image_asset_id = ma.id)
		ORDER BY created_at DESC
	`, copyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Asset
	for rows.Next() {
		var a Asset
		if err := rows.Scan(
			&a.ID, &a.CopyID, &a.MediaType, &a.FilePath, &a.FileName, &a.MimeType,
			&a.FileSize, &a.ChecksumSHA256, &a.Caption,
		); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Update mengubah media_type/caption sebuah foto (bukan file-nya).
func (r *Repository) Update(ctx context.Context, id, mediaType, caption string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE media_assets SET media_type = coalesce(NULLIF($2, ''), media_type), caption = NULLIF($3, '')
		WHERE id = $1 AND deleted_at IS NULL
	`, id, mediaType, caption)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// SoftDelete menandai foto terhapus (deleted_at) tanpa menghapus berkas
// fisik/baris DB-nya — konsisten dengan skema (media_assets.deleted_at
// memang disediakan untuk soft-delete, bukan hard DELETE).
func (r *Repository) SoftDelete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE media_assets SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL
	`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// HardDelete menghapus baris media_assets secara permanen (beda dari
// SoftDelete) dan mengembalikan file_path-nya supaya pemanggil bisa
// menghapus berkas fisiknya juga. Dipakai reader.Handler.UploadPage untuk
// membuang foto halaman hasil scan setelah OCR selesai — teks sudah
// tersimpan di book_pages, gambar aslinya tidak perlu disimpan permanen
// (soal storage), beda dari foto dokumentasi eksemplar (PhotoGallery) yang
// memang disengaja untuk dilihat lagi nanti.
func (r *Repository) HardDelete(ctx context.Context, id string) (string, error) {
	var filePath string
	err := r.pool.QueryRow(ctx, `DELETE FROM media_assets WHERE id = $1 RETURNING file_path`, id).Scan(&filePath)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return filePath, err
}

// GetByID dipakai reader.Handler.RescanPage untuk menemukan file_path fisik
// dari gambar yang sudah tersimpan, supaya bisa dibaca ulang tanpa perlu
// pengguna memfoto ulang halamannya.
func (r *Repository) GetByID(ctx context.Context, id string) (Asset, error) {
	var a Asset
	err := r.pool.QueryRow(ctx, `
		SELECT id, copy_id, media_type, file_path, file_name, mime_type, file_size, checksum_sha256
		FROM media_assets
		WHERE id = $1
	`, id).Scan(&a.ID, &a.CopyID, &a.MediaType, &a.FilePath, &a.FileName, &a.MimeType, &a.FileSize, &a.ChecksumSHA256)
	if err != nil {
		return Asset{}, err
	}
	return a, nil
}
