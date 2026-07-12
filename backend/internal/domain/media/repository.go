package media

import (
	"context"

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
		INSERT INTO media_assets (copy_id, media_type, file_path, file_name, mime_type, file_size, checksum_sha256)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, a.CopyID, a.MediaType, a.FilePath, a.FileName, a.MimeType, a.FileSize, a.ChecksumSHA256).Scan(&a.ID)
	if err != nil {
		return Asset{}, err
	}
	return a, nil
}
