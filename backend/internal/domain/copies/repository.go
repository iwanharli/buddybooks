package copies

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

// NextInventoryCode menyarankan kode inventaris berikutnya untuk sebuah
// koleksi: "BK-{kode_koleksi}-{nomor urut 6 digit}". Nomor urut diambil dari
// angka TERBESAR di akhir inventory_code eksemplar yang sudah ada di
// koleksi itu (regex, bukan COUNT) — supaya tidak tabrakan kalau ada
// eksemplar yang sudah dihapus atau kodenya pernah diedit manual di luar
// pola ini. Cuma saran; pengguna tetap bisa mengetik kode lain di form.
func (r *Repository) NextInventoryCode(ctx context.Context, collectionID string) (string, error) {
	var code string
	if err := r.pool.QueryRow(ctx, `SELECT code FROM collections WHERE id = $1`, collectionID).Scan(&code); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", errors.New("koleksi tidak ditemukan")
		}
		return "", err
	}

	var maxSeq int
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(MAX(substring(inventory_code FROM '(\d+)$')::int), 0)
		FROM copies
		WHERE collection_id = $1 AND inventory_code ~ '\d+$'
	`, collectionID).Scan(&maxSeq)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("BK-%s-%06d", code, maxSeq+1), nil
}

// MoveToCollection memindahkan satu eksemplar ke koleksi lain. Lokasi
// simpan (current_location_id) sengaja dikosongkan — trigger DB
// check_copy_location() mewajibkan lokasi berasal dari koleksi yang sama,
// jadi lokasi lama otomatis tidak valid lagi setelah pindah koleksi.
func (r *Repository) MoveToCollection(ctx context.Context, copyID, collectionID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE copies SET collection_id = $2, current_location_id = NULL WHERE id = $1
	`, copyID, collectionID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// SetLocation mengatur/mengosongkan lokasi simpan fisik eksemplar.
// locationID kosong -> NULL (belum ada lokasi). Trigger DB
// check_copy_location memastikan lokasi berasal dari koleksi yang sama
// dengan eksemplar ini, jadi tidak perlu divalidasi ulang di sini.
func (r *Repository) SetLocation(ctx context.Context, copyID, locationID string) error {
	var locID *string
	if locationID != "" {
		locID = &locationID
	}
	tag, err := r.pool.Exec(ctx, `UPDATE copies SET current_location_id = $2 WHERE id = $1`, copyID, locID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// EditionIDOf mengambil edition_id sebuah copy langsung dari database,
// agar handler tidak perlu mempercayai edition_id yang dikirim klien.
func (r *Repository) EditionIDOf(ctx context.Context, copyID string) (string, error) {
	var editionID string
	err := r.pool.QueryRow(ctx, `SELECT edition_id FROM copies WHERE id = $1`, copyID).Scan(&editionID)
	return editionID, err
}

// CollectionCopy adalah ringkasan eksemplar untuk tampilan "isi koleksi"
// (CollectionDetailPage). Field kondisi/valuasi/kategori/lokasi nullable
// apa adanya — kebanyakan eksemplar nyata belum punya condition_reports
// atau valuations sama sekali, jadi frontend WAJIB menangani nil sebagai
// "belum dinilai", bukan menyembunyikannya atau memakai angka rekaan.
type CollectionCopy struct {
	ID                string   `json:"id"`
	InventoryCode     string   `json:"inventory_code"`
	PreferredTitle    string   `json:"preferred_title"`
	AuthorName        *string  `json:"author_name,omitempty"`
	CollectionGrade   *string  `json:"collection_grade,omitempty"`
	PublicationYear   *int     `json:"publication_year,omitempty"`
	CategoryName      *string  `json:"category_name,omitempty"`
	LocationName      *string  `json:"location_name,omitempty"`
	ConditionGrade    *string  `json:"condition_grade,omitempty"`
	ValuationCurrency *string  `json:"valuation_currency,omitempty"`
	ValuationMid      *float64 `json:"valuation_mid,omitempty"`
	PageCount         int      `json:"page_count"`
	OCRAvgConfidence  *float64 `json:"ocr_avg_confidence,omitempty"`
	// CoverPhotoURL: URL siap pakai <img src> (lewat media.Handler.ServeFile)
	// dari foto media_type='cover_front' eksemplar ini, atau foto pertama
	// kalau belum ada yang ditandai sampul depan.
	CoverPhotoURL *string `json:"cover_photo_url,omitempty"`
}

// coverPhotoJoinSQL: LATERAL join untuk ambil satu foto sampul (media_type
// 'cover_front' diprioritaskan, kalau tidak ada pakai foto tertua) per
// eksemplar — dipakai ListByCollection & copyDetailBaseSQL supaya thumbnail
// sampul bisa tampil tanpa request terpisah per kartu.
// Sengaja MENGECUALIKAN gambar yang dipakai sebagai foto halaman hasil
// scan OCR (book_pages.image_asset_id) — lihat catatan yang sama di
// media.Repository.ListByCopy.
const coverPhotoJoinSQL = `
	LEFT JOIN LATERAL (
		SELECT '/api/v1/media/' || ma.id || '/file' AS url
		FROM media_assets ma
		WHERE ma.copy_id = c.id AND ma.deleted_at IS NULL
			AND NOT EXISTS (SELECT 1 FROM book_pages bp WHERE bp.image_asset_id = ma.id)
		ORDER BY (ma.media_type = 'cover_front') DESC, ma.created_at ASC
		LIMIT 1
	) cover(url) ON true
`

// authorJoinSQL: LATERAL join untuk ambil satu nama penulis (role='author')
// dari work_agents+agents, dipakai di ListByCollection & GetByID. Kalau ada
// >1 penulis, ambil yang sequence_no terkecil (atau baris pertama bila
// sequence_no semuanya NULL).
const authorJoinSQL = `
	LEFT JOIN LATERAL (
		SELECT ag.authorized_name FROM work_agents wa
		JOIN agents ag ON ag.id = wa.agent_id
		WHERE wa.work_id = w.id AND wa.role = 'author'
		ORDER BY wa.sequence_no NULLS LAST LIMIT 1
	) author(name) ON true
`

// ListByCollection mengambil eksemplar milik satu koleksi beserta data
// pendukung terbaru (kondisi, valuasi, lokasi, kategori, ringkasan OCR).
// Kondisi & valuasi diambil hanya laporan/penilaian TERBARU per eksemplar
// (LATERAL + LIMIT 1) — riwayat lengkapnya ada di condition_reports/
// valuations, bukan tanggung jawab query ringkasan ini.
func (r *Repository) ListByCollection(ctx context.Context, collectionID string) ([]CollectionCopy, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT
			c.id, c.inventory_code, w.preferred_title, c.collection_grade,
			e.publication_year, cat.name, sl.name,
			cr.condition_grade, v.currency, v.value_mid,
			COALESCE(bp.page_count, 0), bp.avg_confidence, author.name,
			cover.url
		FROM copies c
		JOIN editions e ON e.id = c.edition_id
		JOIN works w ON w.id = e.work_id
		LEFT JOIN storage_locations sl ON sl.id = c.current_location_id
		LEFT JOIN LATERAL (
			SELECT cc.name FROM work_categories wc
			JOIN categories cc ON cc.id = wc.category_id
			WHERE wc.work_id = w.id LIMIT 1
		) cat(name) ON true
		LEFT JOIN LATERAL (
			SELECT condition_grade FROM condition_reports
			WHERE copy_id = c.id ORDER BY report_date DESC LIMIT 1
		) cr ON true
		LEFT JOIN LATERAL (
			SELECT currency, value_mid FROM valuations
			WHERE copy_id = c.id ORDER BY valuation_date DESC LIMIT 1
		) v ON true
		LEFT JOIN LATERAL (
			SELECT count(*) AS page_count, avg(ocr_confidence) AS avg_confidence
			FROM book_pages WHERE copy_id = c.id
		) bp ON true
		`+authorJoinSQL+coverPhotoJoinSQL+`
		WHERE c.collection_id = $1
		ORDER BY c.inventory_code
	`, collectionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []CollectionCopy
	for rows.Next() {
		var cc CollectionCopy
		if err := rows.Scan(
			&cc.ID, &cc.InventoryCode, &cc.PreferredTitle, &cc.CollectionGrade,
			&cc.PublicationYear, &cc.CategoryName, &cc.LocationName,
			&cc.ConditionGrade, &cc.ValuationCurrency, &cc.ValuationMid,
			&cc.PageCount, &cc.OCRAvgConfidence, &cc.AuthorName, &cc.CoverPhotoURL,
		); err != nil {
			return nil, err
		}
		out = append(out, cc)
	}
	return out, rows.Err()
}

// CopyDetail adalah tampilan detail satu eksemplar (CopyDetailPage di
// frontend), lebih lengkap dari CollectionCopy karena juga menyertakan
// edition_id & collection_id (aksi "tambah eksemplar lain" & pindah
// koleksi) serta original_title/isbn/publisher_name — field yang cuma
// relevan di form edit buku, jadi tidak perlu dibawa di ListByCollection
// yang lebih ringan.
type CopyDetail struct {
	CollectionCopy
	EditionID      string  `json:"edition_id"`
	CollectionID   string  `json:"collection_id"`
	CollectionCode string  `json:"collection_code"`
	OriginalTitle  *string `json:"original_title,omitempty"`
	ISBN           *string `json:"isbn,omitempty"`
	PublisherName  *string `json:"publisher_name,omitempty"`
	// Detail valuasi terbaru selain currency/value_mid (sudah ada di
	// CollectionCopy) — dipakai frontend untuk pre-fill form "Valuasi Baru"
	// supaya tidak selalu mulai dari kosong.
	ValuationType  *string  `json:"valuation_type,omitempty"`
	ValueLow       *float64 `json:"valuation_low,omitempty"`
	ValueHigh      *float64 `json:"valuation_high,omitempty"`
	ValuationBasis *string  `json:"valuation_basis,omitempty"`
	// FirstPublicationYear: tahun terbit PERTAMA karya ini (works), beda
	// dari PublicationYear (tahun cetakan/edisi eksemplar ini) — penting
	// untuk karya klasik yang dicetak ulang jauh setelah tahun aslinya.
	FirstPublicationYear *int `json:"first_publication_year,omitempty"`
	// Detail akuisisi (pembelian) PRIMARY eksemplar ini — lihat acquisitions.is_primary.
	AcquisitionMethod     *string  `json:"acquisition_method,omitempty"`
	AcquisitionDate       *string  `json:"acquisition_date,omitempty"`
	PurchasePrice         *float64 `json:"purchase_price,omitempty"`
	PurchaseCurrency      *string  `json:"purchase_currency,omitempty"`
	AcquisitionSellerName *string  `json:"acquisition_seller_name,omitempty"`
	// Detail fisik eksemplar (copies.*) — sebelumnya ada di skema tapi
	// tidak pernah bisa diisi/ditampilkan dari UI sama sekali.
	CompletenessStatus *string  `json:"completeness_status,omitempty"`
	BindingDescription *string  `json:"binding_description,omitempty"`
	CoverDescription   *string  `json:"cover_description,omitempty"`
	DustJacketPresent  *bool    `json:"dust_jacket_present,omitempty"`
	SlipcasePresent    *bool    `json:"slipcase_present,omitempty"`
	HeightMM           *float64 `json:"height_mm,omitempty"`
	WidthMM            *float64 `json:"width_mm,omitempty"`
	ThicknessMM        *float64 `json:"thickness_mm,omitempty"`
	WeightGrams        *float64 `json:"weight_grams,omitempty"`
	AccessionNumber    *string  `json:"accession_number,omitempty"`
	PrivateNotes       *string  `json:"private_notes,omitempty"`
	CurrentLocationID  *string  `json:"current_location_id,omitempty"`
	// CategoryID: id kategori pertama karya ini (kalau ada) — dipakai
	// pre-select dropdown "Kategori" di form edit buku. CategoryName
	// (di CollectionCopy) tetap yang dipakai untuk tampilan biasa.
	CategoryID   *string `json:"category_id,omitempty"`
	WorkTypeID   *string `json:"work_type_id,omitempty"`
	WorkTypeName *string `json:"work_type_name,omitempty"`
	// WorkID: dipakai untuk PATCH /works/{workId}/summary dari tab
	// "Ringkasan" — beda dari EditionID (menempel ke cetakan/edisi),
	// field-field ringkasan ini menempel ke karya (works), bukan edisi.
	WorkID                 string  `json:"work_id"`
	SubjectSummary         *string `json:"subject_summary,omitempty"`
	Abstract               *string `json:"abstract,omitempty"`
	HistoricalSignificance *string `json:"historical_significance,omitempty"`
	WorkNotes              *string `json:"work_notes,omitempty"`
	// TotalPages: jumlah halaman ASLI buku fisik (editions.total_pages),
	// beda dari PageCount (di CollectionCopy) yang cuma menghitung berapa
	// halaman SUDAH di-scan lewat OCR — dua angka ini bisa jauh berbeda.
	TotalPages *int `json:"total_pages,omitempty"`
}

// publisherJoinSQL: pasangan dari authorJoinSQL, tapi untuk penerbit lewat
// edition_agents (bukan work_agents) karena penerbit menempel ke EDISI
// tertentu, bukan ke karya secara keseluruhan (edisi berbeda bisa beda
// penerbit meski karyanya sama).
const publisherJoinSQL = `
	LEFT JOIN LATERAL (
		SELECT ag.authorized_name FROM edition_agents ea
		JOIN agents ag ON ag.id = ea.agent_id
		WHERE ea.edition_id = e.id AND ea.role = 'publisher'
		ORDER BY ea.sequence_no NULLS LAST LIMIT 1
	) publisher(name) ON true
`

// copyDetailBaseSQL: SELECT+FROM+JOIN yang sama dipakai GetByID (cari lewat
// UUID) dan GetByCollectionCodeAndInventory (cari lewat slug kode
// koleksi+inventory_code) — cuma klausa WHERE yang beda di tiap pemanggil.
const copyDetailBaseSQL = `
	SELECT
		c.id, c.inventory_code, w.preferred_title, c.collection_grade,
		e.publication_year, cat.name, sl.name,
		cr.condition_grade, v.currency, v.value_mid,
		COALESCE(bp.page_count, 0), bp.avg_confidence, author.name,
		c.edition_id, c.collection_id, co.code, w.original_title, e.isbn, publisher.name,
		v.valuation_type, v.value_low, v.value_high, v.valuation_basis,
		w.first_publication_year,
		aq.method, aq.transaction_date::text, aq.purchase_price, aq.currency, aq_seller.name,
		c.completeness_status, c.binding_description, c.cover_description,
		c.dust_jacket_present, c.slipcase_present,
		c.height_mm, c.width_mm, c.thickness_mm, c.weight_grams,
		c.accession_number, c.private_notes, c.current_location_id,
		cat.id, w.work_type_id, wt.name,
		w.id, w.subject_summary, w.abstract, w.historical_significance, w.notes,
		e.total_pages
	FROM copies c
	JOIN collections co ON co.id = c.collection_id
	JOIN editions e ON e.id = c.edition_id
	JOIN works w ON w.id = e.work_id
	LEFT JOIN storage_locations sl ON sl.id = c.current_location_id
	LEFT JOIN work_types wt ON wt.id = w.work_type_id
	LEFT JOIN LATERAL (
		SELECT cc.id, cc.name FROM work_categories wc
		JOIN categories cc ON cc.id = wc.category_id
		WHERE wc.work_id = w.id LIMIT 1
	) cat(id, name) ON true
	LEFT JOIN LATERAL (
		SELECT condition_grade FROM condition_reports
		WHERE copy_id = c.id ORDER BY report_date DESC LIMIT 1
	) cr ON true
	LEFT JOIN LATERAL (
		SELECT currency, value_mid, valuation_type, value_low, value_high, valuation_basis
		FROM valuations
		WHERE copy_id = c.id ORDER BY valuation_date DESC LIMIT 1
	) v ON true
	LEFT JOIN LATERAL (
		SELECT count(*) AS page_count, avg(ocr_confidence) AS avg_confidence
		FROM book_pages WHERE copy_id = c.id
	) bp ON true
	LEFT JOIN LATERAL (
		SELECT method, transaction_date, purchase_price, currency, seller_agent_id
		FROM acquisitions WHERE copy_id = c.id AND is_primary LIMIT 1
	) aq ON true
	LEFT JOIN LATERAL (
		SELECT ag.authorized_name FROM agents ag WHERE ag.id = aq.seller_agent_id
	) aq_seller(name) ON true
	` + authorJoinSQL + publisherJoinSQL

func scanCopyDetail(row pgx.Row) (CopyDetail, error) {
	var d CopyDetail
	err := row.Scan(
		&d.ID, &d.InventoryCode, &d.PreferredTitle, &d.CollectionGrade,
		&d.PublicationYear, &d.CategoryName, &d.LocationName,
		&d.ConditionGrade, &d.ValuationCurrency, &d.ValuationMid,
		&d.PageCount, &d.OCRAvgConfidence, &d.AuthorName,
		&d.EditionID, &d.CollectionID, &d.CollectionCode, &d.OriginalTitle, &d.ISBN, &d.PublisherName,
		&d.ValuationType, &d.ValueLow, &d.ValueHigh, &d.ValuationBasis,
		&d.FirstPublicationYear,
		&d.AcquisitionMethod, &d.AcquisitionDate, &d.PurchasePrice, &d.PurchaseCurrency, &d.AcquisitionSellerName,
		&d.CompletenessStatus, &d.BindingDescription, &d.CoverDescription,
		&d.DustJacketPresent, &d.SlipcasePresent,
		&d.HeightMM, &d.WidthMM, &d.ThicknessMM, &d.WeightGrams,
		&d.AccessionNumber, &d.PrivateNotes, &d.CurrentLocationID,
		&d.CategoryID, &d.WorkTypeID, &d.WorkTypeName,
		&d.WorkID, &d.SubjectSummary, &d.Abstract, &d.HistoricalSignificance, &d.WorkNotes,
		&d.TotalPages,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return CopyDetail{}, errors.New("eksemplar tidak ditemukan")
	}
	return d, err
}

func (r *Repository) GetByID(ctx context.Context, copyID string) (CopyDetail, error) {
	row := r.pool.QueryRow(ctx, copyDetailBaseSQL+` WHERE c.id = $1`, copyID)
	return scanCopyDetail(row)
}

// GetByCollectionCodeAndInventory mencari eksemplar lewat slug URL
// /copies/:collectionCode/:inventoryCode (case-insensitive untuk kode
// koleksi; inventory_code dibandingkan apa adanya karena unik per koleksi,
// lihat constraint copies_collection_id_inventory_code_key).
func (r *Repository) GetByCollectionCodeAndInventory(ctx context.Context, collectionCode, inventoryCode string) (CopyDetail, error) {
	row := r.pool.QueryRow(ctx, copyDetailBaseSQL+`
		WHERE lower(co.code) = lower($1) AND c.inventory_code = $2
	`, collectionCode, inventoryCode)
	return scanCopyDetail(row)
}

// UpdateCopyInput: field yang menempel ke EKSEMPLAR fisik spesifik (bukan
// ke karya/edisi — itu di UpdateEditionInput). CollectionGrade/CompletenessStatus/
// string kosong -> NULL. Dimensi & berat pointer supaya bisa dikosongkan
// (bukan diset paksa ke 0, karena skema mewajibkan > 0 kalau diisi).
type UpdateCopyInput struct {
	InventoryCode      string
	CollectionGrade    string
	CompletenessStatus string
	BindingDescription string
	CoverDescription   string
	DustJacketPresent  *bool
	SlipcasePresent    *bool
	HeightMM           *float64
	WidthMM            *float64
	ThicknessMM        *float64
	WeightGrams        *float64
	AccessionNumber    string
	PrivateNotes       string
}

func (r *Repository) UpdateCopy(ctx context.Context, copyID string, in UpdateCopyInput) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE copies SET
			inventory_code = $2,
			collection_grade = NULLIF($3, ''),
			completeness_status = NULLIF($4, ''),
			binding_description = NULLIF($5, ''),
			cover_description = NULLIF($6, ''),
			dust_jacket_present = $7,
			slipcase_present = $8,
			height_mm = $9,
			width_mm = $10,
			thickness_mm = $11,
			weight_grams = $12,
			accession_number = NULLIF($13, ''),
			private_notes = NULLIF($14, '')
		WHERE id = $1
	`, copyID, in.InventoryCode, in.CollectionGrade, in.CompletenessStatus,
		in.BindingDescription, in.CoverDescription, in.DustJacketPresent, in.SlipcasePresent,
		in.HeightMM, in.WidthMM, in.ThicknessMM, in.WeightGrams, in.AccessionNumber, in.PrivateNotes)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// UpdateEditionInput: field yang menempel ke KARYA/EDISI — berlaku untuk
// SEMUA eksemplar yang berbagi edisi yang sama (lihat OtherCopiesOfEdition),
// bukan cuma satu eksemplar yang sedang dibuka.
type UpdateEditionInput struct {
	PreferredTitle  string
	OriginalTitle   string
	PublicationYear *int
	ISBN            string
	PublisherName   string
	AuthorName      string
	// CategoryID/WorkTypeID: kosong -> dikosongkan (tidak dikategorikan/
	// jenis belum ditentukan), bukan dibiarkan apa adanya.
	CategoryID string
	WorkTypeID string
	TotalPages *int
}

// UpdateEdition mengubah works.preferred_title/original_title dan
// editions.publication_year/isbn, lalu MENGGANTI (bukan menambah) penulis &
// penerbit yang tertaut — form edit ini merepresentasikan satu nilai
// definitif saat ini, bukan riwayat, jadi entri lama untuk role yang sama
// dihapus dulu sebelum entri baru ditulis.
func (r *Repository) UpdateEdition(ctx context.Context, editionID string, in UpdateEditionInput) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var workID string
	if err := tx.QueryRow(ctx, `SELECT work_id FROM editions WHERE id = $1`, editionID).Scan(&workID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("edisi tidak ditemukan")
		}
		return err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE works SET
			preferred_title = $2, original_title = NULLIF($3, ''),
			work_type_id = NULLIF($4, '')::uuid
		WHERE id = $1
	`, workID, in.PreferredTitle, in.OriginalTitle, in.WorkTypeID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE editions SET publication_year = $2, isbn = NULLIF($3, ''), total_pages = $4 WHERE id = $1
	`, editionID, in.PublicationYear, in.ISBN, in.TotalPages); err != nil {
		return err
	}

	// Kategori: satu kategori per karya lewat form ini (replace, bukan
	// tambah) — work_categories sebenarnya many-to-many di skema, tapi UI
	// ini menyederhanakan jadi satu pilihan seperti penulis/penerbit.
	if _, err := tx.Exec(ctx, `DELETE FROM work_categories WHERE work_id = $1`, workID); err != nil {
		return err
	}
	if in.CategoryID != "" {
		if _, err := tx.Exec(ctx, `
			INSERT INTO work_categories (work_id, category_id) VALUES ($1, $2::uuid)
		`, workID, in.CategoryID); err != nil {
			return err
		}
	}

	if name := strings.TrimSpace(in.PublisherName); name != "" {
		agentID, err := r.findOrCreateAgent(ctx, tx, name, "organization")
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM edition_agents WHERE edition_id = $1 AND role = 'publisher'`, editionID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO edition_agents (edition_id, agent_id, role) VALUES ($1, $2, 'publisher')
		`, editionID, agentID); err != nil {
			return err
		}
	}

	if name := strings.TrimSpace(in.AuthorName); name != "" {
		agentID, err := r.findOrCreateAgent(ctx, tx, name, "person")
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM work_agents WHERE work_id = $1 AND role = 'author'`, workID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO work_agents (work_id, agent_id, role) VALUES ($1, $2, 'author')
			ON CONFLICT (work_id, agent_id, role) DO NOTHING
		`, workID, agentID); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// UpdateWorkSummaryInput: field naratif karya (works) — beda dari
// UpdateEditionInput (judul/penulis/dst yang "identitas" buku), ini
// sinopsis/signifikansi historis/catatan kurator, jadi sengaja dipisah
// jadi form/tab sendiri ("Ringkasan"), bukan digabung ke "Edit Buku".
type UpdateWorkSummaryInput struct {
	SubjectSummary         string
	Abstract               string
	HistoricalSignificance string
	Notes                  string
}

func (r *Repository) UpdateWorkSummary(ctx context.Context, workID string, in UpdateWorkSummaryInput) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE works SET
			subject_summary = NULLIF($2, ''),
			abstract = NULLIF($3, ''),
			historical_significance = NULLIF($4, ''),
			notes = NULLIF($5, '')
		WHERE id = $1
	`, workID, in.SubjectSummary, in.Abstract, in.HistoricalSignificance, in.Notes)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// AddConditionReportInput: satu laporan kondisi BARU (bukan edit) — sesuai
// prinsip "riwayat tidak ditimpa" (README.md), tiap pemeriksaan jadi baris
// baru di condition_reports, tidak menimpa laporan sebelumnya.
type AddConditionReportInput struct {
	ConditionGrade    string
	ConditionScore    *float64
	Note              string
	Foxing            bool
	MoldPresent       bool
	PestDamagePresent bool
	WaterDamage       bool
	ActiveRisk        bool
}

func (r *Repository) AddConditionReport(ctx context.Context, copyID string, in AddConditionReportInput) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO condition_reports (
			copy_id, report_date, condition_grade, condition_score, cover_note,
			foxing, mold_present, pest_damage_present, water_damage, active_risk
		)
		VALUES (
			$1, CURRENT_DATE, NULLIF($2, ''), $3, NULLIF($4, ''),
			$5, $6, $7, $8, $9
		)
	`, copyID, in.ConditionGrade, in.ConditionScore, in.Note,
		in.Foxing, in.MoldPresent, in.PestDamagePresent, in.WaterDamage, in.ActiveRisk)
	return err
}

// AddValuationInput: satu valuasi BARU (bukan edit), sama seperti
// condition_reports — riwayat nilai dari waktu ke waktu tetap tersimpan.
type AddValuationInput struct {
	ValuationType  string
	Currency       string
	ValueLow       *float64
	ValueMid       *float64
	ValueHigh      *float64
	ValuationBasis string
}

func (r *Repository) AddValuation(ctx context.Context, copyID string, in AddValuationInput) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO valuations (
			copy_id, valuation_date, valuation_type, currency, value_low, value_mid, value_high, valuation_basis
		)
		VALUES ($1, CURRENT_DATE, NULLIF($2, ''), $3, $4, $5, $6, NULLIF($7, ''))
	`, copyID, in.ValuationType, in.Currency, in.ValueLow, in.ValueMid, in.ValueHigh, in.ValuationBasis)
	return err
}

// ConditionReport adalah SATU baris riwayat kondisi (lihat prinsip
// "riwayat tidak ditimpa") — dipakai untuk menampilkan timeline lengkap
// di CopyDetailPage, beda dari CopyDetail.ConditionGrade yang cuma
// laporan TERBARU.
type ConditionReport struct {
	ID             string   `json:"id"`
	ReportDate     string   `json:"report_date"`
	ConditionGrade *string  `json:"condition_grade,omitempty"`
	ConditionScore *float64 `json:"condition_score,omitempty"`
	Note           *string  `json:"note,omitempty"`
	Foxing         *bool    `json:"foxing,omitempty"`
	MoldPresent    *bool    `json:"mold_present,omitempty"`
	PestDamage     *bool    `json:"pest_damage_present,omitempty"`
	WaterDamage    *bool    `json:"water_damage,omitempty"`
	ActiveRisk     bool     `json:"active_risk"`
}

func (r *Repository) ListConditionReports(ctx context.Context, copyID string) ([]ConditionReport, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, report_date::text, condition_grade, condition_score, cover_note,
			foxing, mold_present, pest_damage_present, water_damage, active_risk
		FROM condition_reports
		WHERE copy_id = $1
		ORDER BY report_date DESC, created_at DESC
	`, copyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ConditionReport
	for rows.Next() {
		var cr ConditionReport
		if err := rows.Scan(
			&cr.ID, &cr.ReportDate, &cr.ConditionGrade, &cr.ConditionScore, &cr.Note,
			&cr.Foxing, &cr.MoldPresent, &cr.PestDamage, &cr.WaterDamage, &cr.ActiveRisk,
		); err != nil {
			return nil, err
		}
		out = append(out, cr)
	}
	return out, rows.Err()
}

// ValuationRecord adalah SATU baris riwayat valuasi, sama prinsipnya
// dengan ConditionReport di atas.
type ValuationRecord struct {
	ID             string   `json:"id"`
	ValuationDate  string   `json:"valuation_date"`
	ValuationType  *string  `json:"valuation_type,omitempty"`
	Currency       *string  `json:"currency,omitempty"`
	ValueLow       *float64 `json:"value_low,omitempty"`
	ValueMid       *float64 `json:"value_mid,omitempty"`
	ValueHigh      *float64 `json:"value_high,omitempty"`
	ValuationBasis *string  `json:"valuation_basis,omitempty"`
}

func (r *Repository) ListValuations(ctx context.Context, copyID string) ([]ValuationRecord, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, valuation_date::text, valuation_type, currency, value_low, value_mid, value_high, valuation_basis
		FROM valuations
		WHERE copy_id = $1
		ORDER BY valuation_date DESC, created_at DESC
	`, copyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ValuationRecord
	for rows.Next() {
		var v ValuationRecord
		if err := rows.Scan(
			&v.ID, &v.ValuationDate, &v.ValuationType, &v.Currency, &v.ValueLow, &v.ValueMid, &v.ValueHigh, &v.ValuationBasis,
		); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// ProvenanceEvent adalah SATU titik dalam riwayat kepemilikan eksemplar
// (dari mana asalnya, siapa pemilik sebelumnya, dsb) — append-only seperti
// condition_reports/valuations, diurutkan lewat sequence_no.
type ProvenanceEvent struct {
	ID                 string  `json:"id"`
	SequenceNo         int     `json:"sequence_no"`
	EventType          *string `json:"event_type,omitempty"`
	OwnerName          *string `json:"owner_name,omitempty"`
	CounterpartyName   *string `json:"counterparty_name,omitempty"`
	PeriodText         *string `json:"period_text,omitempty"`
	PeriodStartYear    *int    `json:"period_start_year,omitempty"`
	PeriodEndYear      *int    `json:"period_end_year,omitempty"`
	EvidenceSummary    *string `json:"evidence_summary,omitempty"`
	VerificationStatus *string `json:"verification_status,omitempty"`
	Confidence         *string `json:"confidence,omitempty"`
}

func (r *Repository) ListProvenance(ctx context.Context, copyID string) ([]ProvenanceEvent, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT pe.id, pe.sequence_no, pe.event_type, owner.name, counterparty.name,
			pe.period_text, pe.period_start_year, pe.period_end_year,
			pe.evidence_summary, pe.verification_status, pe.confidence
		FROM provenance_events pe
		LEFT JOIN LATERAL (SELECT authorized_name FROM agents WHERE id = pe.owner_agent_id) owner(name) ON true
		LEFT JOIN LATERAL (SELECT authorized_name FROM agents WHERE id = pe.counterparty_agent_id) counterparty(name) ON true
		WHERE pe.copy_id = $1
		ORDER BY pe.sequence_no
	`, copyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ProvenanceEvent
	for rows.Next() {
		var p ProvenanceEvent
		if err := rows.Scan(
			&p.ID, &p.SequenceNo, &p.EventType, &p.OwnerName, &p.CounterpartyName,
			&p.PeriodText, &p.PeriodStartYear, &p.PeriodEndYear,
			&p.EvidenceSummary, &p.VerificationStatus, &p.Confidence,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// AddProvenanceInput: satu titik riwayat kepemilikan BARU. OwnerName/
// CounterpartyName kosong -> agent tidak ditautkan (banyak riwayat lama
// tidak tahu persis siapa pemiliknya).
type AddProvenanceInput struct {
	EventType          string
	OwnerName          string
	CounterpartyName   string
	PeriodText         string
	PeriodStartYear    *int
	PeriodEndYear      *int
	EvidenceSummary    string
	VerificationStatus string
	Confidence         string
}

func (r *Repository) AddProvenance(ctx context.Context, copyID string, in AddProvenanceInput) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var nextSeq int
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(sequence_no), 0) + 1 FROM provenance_events WHERE copy_id = $1
	`, copyID).Scan(&nextSeq); err != nil {
		return err
	}

	var ownerID, counterpartyID *string
	if name := strings.TrimSpace(in.OwnerName); name != "" {
		id, err := r.findOrCreateAgent(ctx, tx, name, "person")
		if err != nil {
			return err
		}
		ownerID = &id
	}
	if name := strings.TrimSpace(in.CounterpartyName); name != "" {
		id, err := r.findOrCreateAgent(ctx, tx, name, "person")
		if err != nil {
			return err
		}
		counterpartyID = &id
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO provenance_events (
			copy_id, sequence_no, event_type, owner_agent_id, counterparty_agent_id,
			period_text, period_start_year, period_end_year,
			evidence_summary, verification_status, confidence
		)
		VALUES ($1, $2, NULLIF($3, ''), $4, $5, NULLIF($6, ''), $7, $8, NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''))
	`, copyID, nextSeq, in.EventType, ownerID, counterpartyID,
		in.PeriodText, in.PeriodStartYear, in.PeriodEndYear,
		in.EvidenceSummary, in.VerificationStatus, in.Confidence); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// UpsertAcquisitionInput: BEDA dari condition_reports/valuations — akuisisi
// bukan riwayat berulang, tapi SATU fakta ("bagaimana eksemplar ini
// didapat") yang boleh disunting/dilengkapi kalau ada kesalahan/kekurangan
// data, makanya di-upsert (lihat uq_acq_primary: satu akuisisi primary per
// copy_id), bukan selalu insert baris baru seperti kondisi/valuasi.
type UpsertAcquisitionInput struct {
	Method          string
	TransactionDate string // "YYYY-MM-DD", kosong -> NULL
	Currency        string
	PurchasePrice   *float64
	SellerName      string
	InvoiceNumber   string
	Notes           string
}

func (r *Repository) UpsertAcquisition(ctx context.Context, copyID string, in UpsertAcquisitionInput) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var sellerAgentID *string
	if name := strings.TrimSpace(in.SellerName); name != "" {
		id, err := r.findOrCreateAgent(ctx, tx, name, "organization")
		if err != nil {
			return err
		}
		sellerAgentID = &id
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO acquisitions (
			copy_id, is_primary, method, transaction_date, currency, purchase_price,
			seller_agent_id, invoice_number, notes
		)
		VALUES ($1, true, NULLIF($2, ''), NULLIF($3, '')::date, NULLIF($4, ''), $5, $6, NULLIF($7, ''), NULLIF($8, ''))
		ON CONFLICT (copy_id) WHERE is_primary DO UPDATE SET
			method = EXCLUDED.method,
			transaction_date = EXCLUDED.transaction_date,
			currency = EXCLUDED.currency,
			purchase_price = EXCLUDED.purchase_price,
			seller_agent_id = EXCLUDED.seller_agent_id,
			invoice_number = EXCLUDED.invoice_number,
			notes = EXCLUDED.notes
	`, copyID, in.Method, in.TransactionDate, in.Currency, in.PurchasePrice, sellerAgentID, in.InvoiceNumber, in.Notes)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// OtherCopiesOfEdition menampilkan eksemplar LAIN (di luar excludeCopyID)
// yang berbagi edition_id yang sama — dipakai di CopyDetailPage untuk
// menunjukkan "eksemplar lain dari buku ini" (kasus duplikat).
type OtherCopy struct {
	ID             string `json:"id"`
	InventoryCode  string `json:"inventory_code"`
	CollectionID   string `json:"collection_id"`
	CollectionCode string `json:"collection_code"`
}

func (r *Repository) OtherCopiesOfEdition(ctx context.Context, editionID, excludeCopyID string) ([]OtherCopy, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.inventory_code, c.collection_id, co.code
		FROM copies c
		JOIN collections co ON co.id = c.collection_id
		WHERE c.edition_id = $1 AND c.id != $2
		ORDER BY c.inventory_code
	`, editionID, excludeCopyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []OtherCopy
	for rows.Next() {
		var o OtherCopy
		if err := rows.Scan(&o.ID, &o.InventoryCode, &o.CollectionID, &o.CollectionCode); err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// EditionOption adalah entri dropdown "pilih buku yang sudah ada" saat
// menambah eksemplar baru (CreateCopyInput.EditionID).
type EditionOption struct {
	EditionID       string `json:"edition_id"`
	PreferredTitle  string `json:"preferred_title"`
	PublicationYear *int   `json:"publication_year,omitempty"`
}

func (r *Repository) ListEditions(ctx context.Context) ([]EditionOption, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT e.id, w.preferred_title, e.publication_year
		FROM editions e
		JOIN works w ON w.id = e.work_id
		ORDER BY w.preferred_title
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []EditionOption
	for rows.Next() {
		var eo EditionOption
		if err := rows.Scan(&eo.EditionID, &eo.PreferredTitle, &eo.PublicationYear); err != nil {
			return nil, err
		}
		out = append(out, eo)
	}
	return out, rows.Err()
}

// CreateCopyInput: EditionID kosong berarti "buku ini belum ada di
// database" — Create() akan membuat works+editions baru (dan agent
// penerbit bila diisi) sebelum menyimpan copies-nya, semua dalam satu
// transaksi. CollectionID kosong -> otomatis masuk koleksi "Uncategorized"
// (lihat uncategorizedCollectionID).
type CreateCopyInput struct {
	CollectionID    string
	InventoryCode   string
	EditionID       string
	PreferredTitle  string
	OriginalTitle   string
	PublicationYear *int
	ISBN            string
	PublisherName   string
	AuthorName      string
}

type CreatedCopy struct {
	ID             string `json:"id"`
	InventoryCode  string `json:"inventory_code"`
	EditionID      string `json:"edition_id"`
	PreferredTitle string `json:"preferred_title"`
	CollectionID   string `json:"collection_id"`
}

func (r *Repository) uncategorizedCollectionID(ctx context.Context, tx pgx.Tx) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `SELECT id FROM collections WHERE code = 'UNCATEGORIZED' LIMIT 1`).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", errors.New(`koleksi "Uncategorized" belum ada — jalankan seed.sql`)
	}
	return id, err
}

// findOrCreateAgent mencari agent dengan tipe & nama persis sama
// (case-insensitive), atau membuat baru bila belum ada. Pencocokan sengaja
// sederhana (bukan fuzzy seperti cmd/import-publishers) karena ini dipakai
// interaktif satu-per-satu, pengguna bisa lihat & perbaiki sendiri kalau
// salah cocok. agentType: "organization" (penerbit) atau "person" (penulis).
func (r *Repository) findOrCreateAgent(ctx context.Context, tx pgx.Tx, name, agentType string) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		SELECT id FROM agents WHERE agent_type = $2 AND lower(authorized_name) = lower($1) LIMIT 1
	`, name, agentType).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO agents (agent_type, authorized_name) VALUES ($2, $1) RETURNING id
	`, name, agentType).Scan(&id)
	return id, err
}

// Create menambah satu eksemplar baru. Kalau in.EditionID kosong, works +
// editions (+ penerbit bila diisi) dibuat lebih dulu dalam transaksi yang
// sama — jadi buku yang belum pernah dicatat sama sekali bisa langsung
// masuk lewat satu form, tidak perlu bikin Karya/Edisi secara terpisah.
func (r *Repository) Create(ctx context.Context, in CreateCopyInput) (CreatedCopy, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return CreatedCopy{}, err
	}
	defer tx.Rollback(ctx)

	editionID := in.EditionID
	preferredTitle := in.PreferredTitle

	if editionID == "" {
		if strings.TrimSpace(in.PreferredTitle) == "" {
			return CreatedCopy{}, errors.New("preferred_title wajib diisi bila edition_id tidak dipilih")
		}

		workCode := "WRK-" + uuid.NewString()[:8]
		var workID string
		err = tx.QueryRow(ctx, `
			INSERT INTO works (work_code, preferred_title, original_title, first_publication_year)
			VALUES ($1, $2, NULLIF($3, ''), $4)
			RETURNING id
		`, workCode, in.PreferredTitle, in.OriginalTitle, in.PublicationYear).Scan(&workID)
		if err != nil {
			return CreatedCopy{}, err
		}

		editionCode := "ED-" + uuid.NewString()[:8]
		err = tx.QueryRow(ctx, `
			INSERT INTO editions (work_id, edition_code, publication_year, isbn)
			VALUES ($1, $2, $3, NULLIF($4, ''))
			RETURNING id
		`, workID, editionCode, in.PublicationYear, in.ISBN).Scan(&editionID)
		if err != nil {
			return CreatedCopy{}, err
		}

		if name := strings.TrimSpace(in.PublisherName); name != "" {
			agentID, err := r.findOrCreateAgent(ctx, tx, name, "organization")
			if err != nil {
				return CreatedCopy{}, err
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO edition_agents (edition_id, agent_id, role) VALUES ($1, $2, 'publisher')
			`, editionID, agentID); err != nil {
				return CreatedCopy{}, err
			}
		}

		if name := strings.TrimSpace(in.AuthorName); name != "" {
			agentID, err := r.findOrCreateAgent(ctx, tx, name, "person")
			if err != nil {
				return CreatedCopy{}, err
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO work_agents (work_id, agent_id, role) VALUES ($1, $2, 'author')
				ON CONFLICT (work_id, agent_id, role) DO NOTHING
			`, workID, agentID); err != nil {
				return CreatedCopy{}, err
			}
		}
	} else {
		// Edisi sudah ada dipilih dari dropdown — ambil judulnya untuk
		// dikembalikan di response, bukan dipercaya dari input klien.
		if err := tx.QueryRow(ctx, `
			SELECT w.preferred_title FROM editions e JOIN works w ON w.id = e.work_id WHERE e.id = $1
		`, editionID).Scan(&preferredTitle); err != nil {
			return CreatedCopy{}, errors.New("edition_id tidak ditemukan")
		}
	}

	collectionID := in.CollectionID
	if collectionID == "" {
		collectionID, err = r.uncategorizedCollectionID(ctx, tx)
		if err != nil {
			return CreatedCopy{}, err
		}
	}

	var copyID string
	err = tx.QueryRow(ctx, `
		INSERT INTO copies (collection_id, edition_id, inventory_code, copy_status)
		VALUES ($1, $2, $3, 'owned')
		RETURNING id
	`, collectionID, editionID, in.InventoryCode).Scan(&copyID)
	if err != nil {
		return CreatedCopy{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return CreatedCopy{}, err
	}

	return CreatedCopy{
		ID:             copyID,
		InventoryCode:  in.InventoryCode,
		EditionID:      editionID,
		PreferredTitle: preferredTitle,
		CollectionID:   collectionID,
	}, nil
}
