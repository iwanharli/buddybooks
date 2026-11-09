package locations

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Location adalah satu titik simpan fisik (rak/lemari/kotak/dst) di dalam
// SATU koleksi — hierarkis lewat ParentLocationID (lihat trigger DB
// check_location_parent yang mencegah siklus & memastikan induk berada di
// koleksi yang sama).
type Location struct {
	ID                string  `json:"id"`
	CollectionID      string  `json:"collection_id"`
	ParentLocationID  *string `json:"parent_location_id,omitempty"`
	Code              string  `json:"code"`
	Name              *string `json:"name,omitempty"`
	LocationType      *string `json:"location_type,omitempty"`
	ClimateControlled bool    `json:"climate_controlled"`
	Secure            bool    `json:"secure"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) ListByCollection(ctx context.Context, collectionID string) ([]Location, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, collection_id, parent_location_id, code, name, location_type,
			coalesce(climate_controlled, false), coalesce(secure, false)
		FROM storage_locations
		WHERE collection_id = $1
		ORDER BY code
	`, collectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Location
	for rows.Next() {
		var l Location
		if err := rows.Scan(
			&l.ID, &l.CollectionID, &l.ParentLocationID, &l.Code, &l.Name, &l.LocationType,
			&l.ClimateControlled, &l.Secure,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// CreateInput: Code wajib unik per koleksi (UNIQUE(collection_id, code)).
// ParentLocationID kosong -> lokasi tingkat teratas di koleksi ini.
type CreateInput struct {
	Code              string
	Name              string
	LocationType      string
	ParentLocationID  string
	ClimateControlled bool
	Secure            bool
}

func (r *Repository) Create(ctx context.Context, collectionID string, in CreateInput) (Location, error) {
	var parentID *string
	if in.ParentLocationID != "" {
		parentID = &in.ParentLocationID
	}

	var l Location
	err := r.pool.QueryRow(ctx, `
		INSERT INTO storage_locations (
			collection_id, parent_location_id, code, location_type, name, climate_controlled, secure
		)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7)
		RETURNING id, collection_id, parent_location_id, code, name, location_type,
			coalesce(climate_controlled, false), coalesce(secure, false)
	`, collectionID, parentID, in.Code, in.LocationType, in.Name, in.ClimateControlled, in.Secure).Scan(
		&l.ID, &l.CollectionID, &l.ParentLocationID, &l.Code, &l.Name, &l.LocationType,
		&l.ClimateControlled, &l.Secure,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Location{}, errors.New("gagal membuat lokasi")
	}
	return l, err
}

// UpdateInput: "Code" sengaja tidak ada di sini — sama seperti
// collections.code, dibiarkan tetap (tidak diedit) karena bisa jadi
// rujukan lama. Yang bisa diubah cuma atribut deskriptifnya.
type UpdateInput struct {
	Name              string
	LocationType      string
	ParentLocationID  string
	ClimateControlled bool
	Secure            bool
}

func (r *Repository) Update(ctx context.Context, id string, in UpdateInput) error {
	var parentID *string
	if in.ParentLocationID != "" {
		parentID = &in.ParentLocationID
	}
	tag, err := r.pool.Exec(ctx, `
		UPDATE storage_locations SET
			name = NULLIF($2, ''), location_type = NULLIF($3, ''),
			parent_location_id = $4, climate_controlled = $5, secure = $6
		WHERE id = $1
	`, id, in.Name, in.LocationType, parentID, in.ClimateControlled, in.Secure)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// Delete menghapus lokasi. Gagal (FK constraint) kalau masih dipakai
// eksemplar (copies.current_location_id) atau punya anak lokasi — sengaja
// tidak di-cascade supaya pengguna sadar harus memindahkan isinya dulu.
func (r *Repository) Delete(ctx context.Context, id string) error {
	tag, err := r.pool.Exec(ctx, `DELETE FROM storage_locations WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
