package master

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Item struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Code   string `json:"code"`
	Note   string `json:"note"`
	Status string `json:"status"`
}

type Detail struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	Code     string          `json:"code"`
	Note     string          `json:"note"`
	Status   string          `json:"status"`
	Sections []DetailSection `json:"sections"`
}

type DetailSection struct {
	Title  string        `json:"title"`
	Fields []DetailField `json:"fields"`
}

type DetailField struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Kind  string `json:"kind,omitempty"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) List(ctx context.Context, resource string) ([]Item, error) {
	query, ok := listQueries[resource]
	if !ok {
		return nil, fmt.Errorf("unknown master resource: %s", resource)
	}

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Item
	for rows.Next() {
		var item Item
		if err := rows.Scan(&item.ID, &item.Name, &item.Code, &item.Note, &item.Status); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) Detail(ctx context.Context, resource string, id string) (Detail, error) {
	if resource == "agents" || resource == "publishers" {
		return r.agentDetail(ctx, resource, id)
	}
	return r.basicDetail(ctx, resource, id)
}

func (r *Repository) basicDetail(ctx context.Context, resource string, id string) (Detail, error) {
	query, ok := detailQueries[resource]
	if !ok {
		return Detail{}, fmt.Errorf("unknown master resource: %s", resource)
	}

	var detail Detail
	if err := r.pool.QueryRow(ctx, query, id).Scan(&detail.ID, &detail.Name, &detail.Code, &detail.Note, &detail.Status); err != nil {
		return Detail{}, err
	}
	detail.Sections = []DetailSection{
		{
			Title: "Ringkasan",
			Fields: []DetailField{
				{Label: "Nama", Value: detail.Name},
				{Label: "Kode / Tipe", Value: detail.Code},
				{Label: "Catatan", Value: detail.Note},
				{Label: "Status", Value: detail.Status},
			},
		},
	}
	return detail, nil
}

func (r *Repository) agentDetail(ctx context.Context, resource string, id string) (Detail, error) {
	agentFilter := `
		AND a.agent_type = 'person'
		AND EXISTS (
			SELECT 1
			FROM agent_roles ar
			WHERE ar.agent_id = a.id
				AND ar.role IN ('author','editor','translator','illustrator','compiler','contributor')
		)
	`
	if resource == "publishers" {
		agentFilter = `
			AND a.agent_type = 'organization'
			AND EXISTS (
				SELECT 1
				FROM agent_roles ar
				WHERE ar.agent_id = a.id
					AND ar.role IN ('publisher','printer')
			)
		`
	}

	query := fmt.Sprintf(`
		SELECT
			a.id::text,
			a.authorized_name,
			concat_ws(' · ', a.agent_type, nullif(
				CASE a.publisher_category
					WHEN 'trade_publisher' THEN 'penerbit umum'
					WHEN 'university_press' THEN 'university press'
					WHEN 'academic_publisher' THEN 'penerbit akademik'
					WHEN 'religious_publisher' THEN 'penerbit keagamaan'
					WHEN 'media_group_publisher' THEN 'grup media'
					WHEN 'government_publisher' THEN 'penerbit pemerintah'
					WHEN 'historical_publisher' THEN 'penerbit historis'
					WHEN 'printer' THEN 'percetakan'
					WHEN 'other' THEN 'lainnya'
					ELSE ''
				END, ''), nullif(r.roles, '')),
			concat_ws(' · ', nullif(a.alternate_names, ''), nullif(a.historical_period, ''), nullif(a.notes, '')),
			CASE a.status
				WHEN 'active' THEN 'aktif'
				WHEN 'inactive' THEN 'nonaktif'
				WHEN 'closed' THEN 'tutup'
				ELSE 'tidak diketahui'
			END,
			a.agent_type,
			CASE a.publisher_category
				WHEN 'trade_publisher' THEN 'Penerbit Umum'
				WHEN 'university_press' THEN 'University Press'
				WHEN 'academic_publisher' THEN 'Penerbit Akademik'
				WHEN 'religious_publisher' THEN 'Penerbit Keagamaan'
				WHEN 'media_group_publisher' THEN 'Grup Media'
				WHEN 'government_publisher' THEN 'Penerbit Pemerintah'
				WHEN 'historical_publisher' THEN 'Penerbit Historis'
				WHEN 'printer' THEN 'Percetakan'
				WHEN 'other' THEN 'Lainnya'
				ELSE ''
			END,
			a.alternate_names,
			a.legal_name,
			a.brand_name,
			a.birth_or_founding_year::text,
			a.death_or_dissolution_year::text,
			a.website_url,
			a.email,
			a.phone,
			country.preferred_name,
			city.preferred_name,
			a.address,
			a.historical_period,
			a.imprint_names,
			predecessor.authorized_name,
			successor.authorized_name,
			a.source_url,
			a.source_note,
			a.verified_at::date::text,
			a.confidence_level,
			a.notes,
			coalesce(r.roles, ''),
			coalesce(rel.edition_count, 0)::text,
			coalesce(rel.work_count, 0)::text
		FROM agents a
		LEFT JOIN places country ON country.id = a.country_id
		LEFT JOIN places city ON city.id = a.city_id
		LEFT JOIN agents predecessor ON predecessor.id = a.predecessor_agent_id
		LEFT JOIN agents successor ON successor.id = a.successor_agent_id
		LEFT JOIN LATERAL (
			SELECT string_agg(ar.role, ', ' ORDER BY ar.role) AS roles
			FROM agent_roles ar
			WHERE ar.agent_id = a.id
		) r ON true
		LEFT JOIN LATERAL (
			SELECT
				(SELECT count(*) FROM edition_agents ea WHERE ea.agent_id = a.id) AS edition_count,
				(SELECT count(*) FROM work_agents wa WHERE wa.agent_id = a.id) AS work_count
		) rel ON true
		WHERE a.id = $1::uuid
		%s
	`, agentFilter)

	values := make([]sql.NullString, 30)
	scanTargets := make([]any, len(values))
	for i := range values {
		scanTargets[i] = &values[i]
	}
	if err := r.pool.QueryRow(ctx, query, id).Scan(scanTargets...); err != nil {
		return Detail{}, err
	}

	get := func(index int) string {
		if values[index].Valid {
			return values[index].String
		}
		return ""
	}

	detail := Detail{
		ID:     get(0),
		Name:   get(1),
		Code:   get(2),
		Note:   get(3),
		Status: get(4),
		Sections: []DetailSection{
			{
				Title: "Identitas",
				Fields: []DetailField{
					{Label: "Nama Utama", Value: get(1)},
					{Label: "Tipe Pelaku", Value: get(5)},
					{Label: "Kategori Penerbit", Value: get(6)},
					{Label: "Role", Value: get(27)},
					{Label: "Nama Legal", Value: get(8)},
					{Label: "Nama Brand", Value: get(9)},
					{Label: "Nama Lain", Value: get(7)},
					{Label: "Status", Value: get(4)},
				},
			},
			{
				Title: "Kontak & Tempat",
				Fields: []DetailField{
					{Label: "Website", Value: get(12), Kind: "url"},
					{Label: "Email", Value: get(13), Kind: "email"},
					{Label: "Telepon", Value: get(14)},
					{Label: "Negara", Value: get(15)},
					{Label: "Kota / Wilayah", Value: get(16)},
					{Label: "Alamat", Value: get(17)},
				},
			},
			{
				Title: "Riwayat",
				Fields: []DetailField{
					{Label: "Tahun Berdiri", Value: get(10)},
					{Label: "Tahun Tutup", Value: get(11)},
					{Label: "Periode Historis", Value: get(18)},
					{Label: "Imprint", Value: get(19)},
					{Label: "Pendahulu", Value: get(20)},
					{Label: "Penerus", Value: get(21)},
				},
			},
			{
				Title: "Kurasi",
				Fields: []DetailField{
					{Label: "Sumber URL", Value: get(22), Kind: "url"},
					{Label: "Catatan Sumber", Value: get(23)},
					{Label: "Diverifikasi", Value: get(24)},
					{Label: "Tingkat Keyakinan", Value: get(25)},
					{Label: "Catatan", Value: get(26)},
				},
			},
			{
				Title: "Relasi Katalog",
				Fields: []DetailField{
					{Label: "Edisi Terkait", Value: get(28)},
					{Label: "Karya Terkait", Value: get(29)},
				},
			},
		},
	}
	if resource != "publishers" {
		detail.Sections[0].Fields = []DetailField{
			{Label: "Nama Utama", Value: get(1)},
			{Label: "Tipe Pelaku", Value: get(5)},
			{Label: "Role", Value: get(27)},
			{Label: "Nama Lain", Value: get(7)},
			{Label: "Status", Value: get(4)},
		}
	}
	return detail, nil
}

var listQueries = map[string]string{
	"agents": `
		SELECT
			a.id::text,
			a.authorized_name,
			coalesce(nullif(r.roles, ''), 'orang'),
			concat_ws(' · ', nullif(a.alternate_names, ''), nullif(a.notes, '')),
			CASE a.status
				WHEN 'active' THEN 'aktif'
				WHEN 'inactive' THEN 'nonaktif'
				WHEN 'closed' THEN 'tutup'
				ELSE 'tidak diketahui'
			END
		FROM agents a
		LEFT JOIN LATERAL (
			SELECT string_agg(ar.role, ', ' ORDER BY ar.role) AS roles
			FROM agent_roles ar
			WHERE ar.agent_id = a.id
				AND ar.role IN ('author','editor','translator','illustrator','compiler','contributor')
		) r ON true
		WHERE a.agent_type = 'person'
			AND EXISTS (
				SELECT 1
				FROM agent_roles ar
				WHERE ar.agent_id = a.id
					AND ar.role IN ('author','editor','translator','illustrator','compiler','contributor')
			)
		ORDER BY authorized_name
	`,
	"publishers": `
		SELECT
			a.id::text,
			a.authorized_name,
			coalesce(nullif(
				CASE a.publisher_category
					WHEN 'trade_publisher' THEN 'Penerbit Umum'
					WHEN 'university_press' THEN 'University Press'
					WHEN 'academic_publisher' THEN 'Penerbit Akademik'
					WHEN 'religious_publisher' THEN 'Penerbit Keagamaan'
					WHEN 'media_group_publisher' THEN 'Grup Media'
					WHEN 'government_publisher' THEN 'Penerbit Pemerintah'
					WHEN 'historical_publisher' THEN 'Penerbit Historis'
					WHEN 'printer' THEN 'Percetakan'
					WHEN 'other' THEN 'Lainnya'
					ELSE ''
				END, ''), coalesce(r.roles, 'publisher')),
			concat_ws(' · ', nullif(r.roles, ''), nullif(a.alternate_names, ''), nullif(a.historical_period, ''), nullif(a.notes, '')),
			CASE a.status
				WHEN 'active' THEN 'aktif'
				WHEN 'inactive' THEN 'nonaktif'
				WHEN 'closed' THEN 'tutup'
				ELSE 'tidak diketahui'
			END
		FROM agents a
		LEFT JOIN LATERAL (
			SELECT string_agg(ar.role, ', ' ORDER BY ar.role) AS roles
			FROM agent_roles ar
			WHERE ar.agent_id = a.id
				AND ar.role IN ('publisher','printer')
		) r ON true
		WHERE a.agent_type = 'organization'
			AND EXISTS (
				SELECT 1
				FROM agent_roles ar
				WHERE ar.agent_id = a.id
					AND ar.role IN ('publisher','printer')
			)
		ORDER BY a.authorized_name
	`,
	"places": `
		SELECT
			id::text,
			preferred_name,
			concat_ws(' · ', nullif(place_type, ''), nullif(country, '')),
			concat_ws(' · ', nullif(alternate_names, ''), nullif(notes, '')),
			'aktif'
		FROM places
		ORDER BY preferred_name
	`,
	"categories": `
		SELECT
			c.id::text,
			c.name,
			c.slug,
			coalesce(p.name, ''),
			'aktif'
		FROM categories c
		LEFT JOIN categories p ON p.id = c.parent_id
		ORDER BY c.name
	`,
	"work-types": `
		SELECT
			id::text,
			name,
			code,
			coalesce(description, ''),
			'aktif'
		FROM work_types
		ORDER BY name
	`,
	"languages": `
		SELECT
			id::text,
			name,
			code,
			coalesce(native_name, ''),
			'aktif'
		FROM languages
		ORDER BY name
	`,
	"storage-locations": `
		SELECT
			sl.id::text,
			coalesce(sl.name, sl.code),
			sl.code,
			concat_ws(' · ', c.name, nullif(sl.location_type, '')),
			CASE
				WHEN coalesce(sl.secure, false) THEN 'aman'
				WHEN coalesce(sl.climate_controlled, false) THEN 'terkendali'
				ELSE 'aktif'
			END
		FROM storage_locations sl
		JOIN collections c ON c.id = sl.collection_id
		ORDER BY sl.code
	`,
	"shipping-carriers": `
		SELECT
			id::text,
			name,
			code,
			'',
			'aktif'
		FROM shipping_carriers
		ORDER BY name
	`,
	"payment-methods": `
		SELECT
			id::text,
			name,
			code,
			'',
			'aktif'
		FROM payment_methods
		ORDER BY name
	`,
	"sales-channels": `
		SELECT
			id::text,
			name,
			code,
			'',
			'aktif'
		FROM sales_channels
		ORDER BY name
	`,
}

var detailQueries = map[string]string{
	"places": `
		SELECT
			id::text,
			preferred_name,
			concat_ws(' · ', nullif(place_type, ''), nullif(country, '')),
			concat_ws(' · ', nullif(alternate_names, ''), nullif(notes, '')),
			'aktif'
		FROM places
		WHERE id = $1::uuid
	`,
	"categories": `
		SELECT
			c.id::text,
			c.name,
			c.slug,
			coalesce(p.name, ''),
			'aktif'
		FROM categories c
		LEFT JOIN categories p ON p.id = c.parent_id
		WHERE c.id = $1::uuid
	`,
	"work-types": `
		SELECT
			id::text,
			name,
			code,
			coalesce(description, ''),
			'aktif'
		FROM work_types
		WHERE id = $1::uuid
	`,
	"languages": `
		SELECT
			id::text,
			name,
			code,
			coalesce(native_name, ''),
			'aktif'
		FROM languages
		WHERE id = $1::uuid
	`,
	"storage-locations": `
		SELECT
			sl.id::text,
			coalesce(sl.name, sl.code),
			sl.code,
			concat_ws(' · ', c.name, nullif(sl.location_type, '')),
			CASE
				WHEN coalesce(sl.secure, false) THEN 'aman'
				WHEN coalesce(sl.climate_controlled, false) THEN 'terkendali'
				ELSE 'aktif'
			END
		FROM storage_locations sl
		JOIN collections c ON c.id = sl.collection_id
		WHERE sl.id = $1::uuid
	`,
	"shipping-carriers": `
		SELECT
			id::text,
			name,
			code,
			'',
			'aktif'
		FROM shipping_carriers
		WHERE id = $1::uuid
	`,
	"payment-methods": `
		SELECT
			id::text,
			name,
			code,
			'',
			'aktif'
		FROM payment_methods
		WHERE id = $1::uuid
	`,
	"sales-channels": `
		SELECT
			id::text,
			name,
			code,
			'',
			'aktif'
		FROM sales_channels
		WHERE id = $1::uuid
	`,
}
