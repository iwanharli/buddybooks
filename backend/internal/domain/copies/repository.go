package copies

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Copy adalah ringkasan eksemplar untuk keperluan pemilihan (mis. dropdown
// "buku mana yang sedang dipindai"), bukan representasi lengkap tabel copies.
type Copy struct {
	ID             string `json:"id"`
	InventoryCode  string `json:"inventory_code"`
	EditionID      string `json:"edition_id"`
	PreferredTitle string `json:"preferred_title"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) List(ctx context.Context) ([]Copy, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.inventory_code, c.edition_id, w.preferred_title
		FROM copies c
		JOIN editions e ON e.id = c.edition_id
		JOIN works w ON w.id = e.work_id
		ORDER BY c.inventory_code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Copy
	for rows.Next() {
		var c Copy
		if err := rows.Scan(&c.ID, &c.InventoryCode, &c.EditionID, &c.PreferredTitle); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// EditionIDOf mengambil edition_id sebuah copy langsung dari database,
// agar handler tidak perlu mempercayai edition_id yang dikirim klien.
func (r *Repository) EditionIDOf(ctx context.Context, copyID string) (string, error) {
	var editionID string
	err := r.pool.QueryRow(ctx, `SELECT edition_id FROM copies WHERE id = $1`, copyID).Scan(&editionID)
	return editionID, err
}
