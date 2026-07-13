package reader

import (
	"context"

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

func (r *PageRepository) Create(ctx context.Context, p BookPage) (BookPage, error) {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO book_pages (copy_id, edition_id, image_asset_id, page_label, page_sequence, ocr_text, ocr_confidence, ocr_engine)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, p.CopyID, p.EditionID, p.ImageAssetID, p.PageLabel, p.PageSequence, p.OCRText, p.OCRConfidence, p.OCREngine).Scan(&p.ID)
	if err != nil {
		return BookPage{}, err
	}
	return p, nil
}

func (r *PageRepository) ListByCopy(ctx context.Context, copyID string) ([]BookPage, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, copy_id, edition_id, image_asset_id, page_label, page_sequence, ocr_text, ocr_confidence, ocr_engine
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
		if err := rows.Scan(&p.ID, &p.CopyID, &p.EditionID, &p.ImageAssetID, &p.PageLabel, &p.PageSequence, &p.OCRText, &p.OCRConfidence, &p.OCREngine); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
