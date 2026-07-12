package collections

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Collection struct {
	ID              string  `json:"id"`
	SellerID        *string `json:"seller_id,omitempty"`
	Name            string  `json:"name"`
	Code            string  `json:"code"`
	Description     *string `json:"description,omitempty"`
	DefaultCurrency string  `json:"default_currency"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) List(ctx context.Context) ([]Collection, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, seller_id, name, code, description, default_currency
		FROM collections
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Collection
	for rows.Next() {
		var c Collection
		if err := rows.Scan(&c.ID, &c.SellerID, &c.Name, &c.Code, &c.Description, &c.DefaultCurrency); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
