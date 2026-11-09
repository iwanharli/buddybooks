package collections

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Collection struct {
	ID              string  `json:"id"`
	SellerID        *string `json:"seller_id,omitempty"`
	Name            string  `json:"name"`
	Code            string  `json:"code"`
	Description     *string `json:"description,omitempty"`
	DefaultCurrency string  `json:"default_currency"`
	// CopyCount: jumlah eksemplar (copies) yang dimiliki koleksi ini,
	// dihitung langsung saat List — dipakai buat kartu koleksi di frontend.
	CopyCount int `json:"copy_count"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) List(ctx context.Context) ([]Collection, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT co.id, co.seller_id, co.name, co.code, co.description, co.default_currency,
			(SELECT count(*) FROM copies cp WHERE cp.collection_id = co.id)
		FROM collections co
		ORDER BY co.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Collection
	for rows.Next() {
		var c Collection
		if err := rows.Scan(&c.ID, &c.SellerID, &c.Name, &c.Code, &c.Description, &c.DefaultCurrency, &c.CopyCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetByCode mengambil satu koleksi lewat code-nya (case-insensitive) —
// dipakai untuk URL slug /collections/:code di frontend, lebih pendek &
// enak dibaca daripada UUID. code sudah UNIQUE di skema, jadi aman dipakai
// sebagai pengenal publik.
func (r *Repository) GetByCode(ctx context.Context, code string) (Collection, error) {
	var c Collection
	err := r.pool.QueryRow(ctx, `
		SELECT co.id, co.seller_id, co.name, co.code, co.description, co.default_currency,
			(SELECT count(*) FROM copies cp WHERE cp.collection_id = co.id)
		FROM collections co
		WHERE lower(co.code) = lower($1)
	`, code).Scan(&c.ID, &c.SellerID, &c.Name, &c.Code, &c.Description, &c.DefaultCurrency, &c.CopyCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return Collection{}, errors.New("koleksi tidak ditemukan")
	}
	return c, err
}

// defaultSellerID mengambil satu-satunya (atau seller pertama) yang ada,
// karena aplikasi ini belum punya sesi/otentikasi pengguna aktif di
// frontend — koleksi baru sementara selalu dimiliki seller ini.
func (r *Repository) defaultSellerID(ctx context.Context) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx, `SELECT id FROM sellers ORDER BY created_at LIMIT 1`).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errors.New("belum ada seller/toko terdaftar")
	}
	return id, err
}

// slugifyCode mengubah nama koleksi jadi kandidat "code" (huruf besar,
// non-alfanumerik dibuang) — dipakai supaya pengguna tidak perlu mengisi
// kode manual sendiri saat membuat koleksi (lihat Create).
func slugifyCode(name string) string {
	var b strings.Builder
	for _, r := range strings.ToUpper(name) {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		}
	}
	slug := b.String()
	if slug == "" {
		slug = "KOLEKSI"
	}
	if len(slug) > 20 {
		slug = slug[:20]
	}
	return slug
}

// Create menyimpan koleksi baru. "code" dibuat otomatis dari nama (lihat
// slugifyCode) supaya pengguna tidak perlu mengisi field teknis apapun di
// form — kalau bentrok dengan koleksi lain (constraint collections_code_key),
// dicoba ulang dengan angka di belakang (mis. SASTRA, SASTRA2, SASTRA3, ...).
func (r *Repository) Create(ctx context.Context, name, description, currency string) (Collection, error) {
	sellerID, err := r.defaultSellerID(ctx)
	if err != nil {
		return Collection{}, err
	}

	base := slugifyCode(name)
	for attempt := 1; attempt <= 50; attempt++ {
		code := base
		if attempt > 1 {
			code = fmt.Sprintf("%s%d", base, attempt)
		}

		var c Collection
		err = r.pool.QueryRow(ctx, `
			INSERT INTO collections (seller_id, name, code, description, default_currency)
			VALUES ($1, $2, $3, NULLIF($4, ''), $5)
			RETURNING id, seller_id, name, code, description, default_currency
		`, sellerID, name, code, description, currency).Scan(
			&c.ID, &c.SellerID, &c.Name, &c.Code, &c.Description, &c.DefaultCurrency,
		)
		if err == nil {
			return c, nil
		}
		if !strings.Contains(err.Error(), "collections_code_key") && !strings.Contains(err.Error(), "duplicate key") {
			return Collection{}, err
		}
	}
	return Collection{}, err
}

// Update mengubah name/description/default_currency. "code" sengaja TIDAK
// bisa diubah lewat sini — sudah dipakai sebagai referensi (mis. di URL
// rekaman lama), lihat juga docs/business-rules.md soal kode identitas.
func (r *Repository) Update(ctx context.Context, id, name, description, currency string) (Collection, error) {
	var c Collection
	err := r.pool.QueryRow(ctx, `
		UPDATE collections
		SET name = $2, description = NULLIF($3, ''), default_currency = $4
		WHERE id = $1
		RETURNING id, seller_id, name, code, description, default_currency
	`, id, name, description, currency).Scan(
		&c.ID, &c.SellerID, &c.Name, &c.Code, &c.Description, &c.DefaultCurrency,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Collection{}, errors.New("koleksi tidak ditemukan")
	}
	return c, err
}
