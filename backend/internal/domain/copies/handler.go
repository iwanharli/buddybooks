package copies

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.List(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []Copy{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// ListByCollection menampilkan eksemplar milik satu koleksi untuk
// CollectionDetailPage (frontend), lihat CollectionCopy untuk field
// mana yang nullable.
func (h *Handler) ListByCollection(w http.ResponseWriter, r *http.Request) {
	collectionID := chi.URLParam(r, "collectionID")
	items, err := h.repo.ListByCollection(r.Context(), collectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []CollectionCopy{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// NextInventoryCode menyarankan kode inventaris berikutnya untuk sebuah
// koleksi (dipakai AddCopyModal saat form dibuka). GET
// /collections/{collectionID}/next-inventory-code.
func (h *Handler) NextInventoryCode(w http.ResponseWriter, r *http.Request) {
	collectionID := chi.URLParam(r, "collectionID")
	code, err := h.repo.NextInventoryCode(r.Context(), collectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"inventory_code": code})
}

// copyDetailResponse membungkus CopyDetail + daftar eksemplar lain dari
// edisi yang sama, dipakai CopyDetailPage (frontend) untuk menampilkan
// "eksemplar lain untuk buku ini".
type copyDetailResponse struct {
	CopyDetail
	OtherCopies []OtherCopy `json:"other_copies"`
}

// writeCopyDetail mengambil eksemplar lain dari edisi yang sama dan
// menulis respons gabungan — dipakai bersama oleh Get (lewat UUID) dan
// GetByCode (lewat slug kode koleksi + inventory_code).
func (h *Handler) writeCopyDetail(w http.ResponseWriter, r *http.Request, detail CopyDetail) {
	others, err := h.repo.OtherCopiesOfEdition(r.Context(), detail.EditionID, detail.ID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if others == nil {
		others = []OtherCopy{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(copyDetailResponse{CopyDetail: detail, OtherCopies: others})
}

// Get menampilkan detail satu eksemplar (GET /copies/{copyID}).
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")
	detail, err := h.repo.GetByID(r.Context(), copyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	h.writeCopyDetail(w, r, detail)
}

// GetByCode menampilkan detail satu eksemplar lewat slug URL
// /copies/:collectionCode/:inventoryCode (lebih pendek & enak dibaca
// daripada UUID). GET /copies/by-code/{collectionCode}/{inventoryCode}.
func (h *Handler) GetByCode(w http.ResponseWriter, r *http.Request) {
	collectionCode := chi.URLParam(r, "collectionCode")
	inventoryCode := chi.URLParam(r, "inventoryCode")
	detail, err := h.repo.GetByCollectionCodeAndInventory(r.Context(), collectionCode, inventoryCode)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	h.writeCopyDetail(w, r, detail)
}

// ListEditions menampilkan opsi "buku yang sudah ada" untuk dropdown di
// form tambah eksemplar (frontend: AddCopyModal).
func (h *Handler) ListEditions(w http.ResponseWriter, r *http.Request) {
	items, err := h.repo.ListEditions(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []EditionOption{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

type createCopyRequest struct {
	CollectionID    string `json:"collection_id"`
	InventoryCode   string `json:"inventory_code"`
	EditionID       string `json:"edition_id"`
	PreferredTitle  string `json:"preferred_title"`
	OriginalTitle   string `json:"original_title"`
	PublicationYear *int   `json:"publication_year"`
	ISBN            string `json:"isbn"`
	PublisherName   string `json:"publisher_name"`
	AuthorName      string `json:"author_name"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var in createCopyRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.InventoryCode = strings.TrimSpace(in.InventoryCode)
	if in.InventoryCode == "" {
		http.Error(w, "inventory_code wajib diisi", http.StatusBadRequest)
		return
	}
	if in.EditionID == "" && strings.TrimSpace(in.PreferredTitle) == "" {
		http.Error(w, "preferred_title wajib diisi bila tidak memilih buku yang sudah ada", http.StatusBadRequest)
		return
	}

	created, err := h.repo.Create(r.Context(), CreateCopyInput{
		CollectionID:    in.CollectionID,
		InventoryCode:   in.InventoryCode,
		EditionID:       in.EditionID,
		PreferredTitle:  in.PreferredTitle,
		OriginalTitle:   in.OriginalTitle,
		PublicationYear: in.PublicationYear,
		ISBN:            in.ISBN,
		PublisherName:   in.PublisherName,
		AuthorName:      in.AuthorName,
	})
	if err != nil {
		if strings.Contains(err.Error(), "copies_collection_id_inventory_code_key") || strings.Contains(err.Error(), "duplicate key") {
			http.Error(w, "kode inventaris sudah dipakai di koleksi ini", http.StatusConflict)
			return
		}
		http.Error(w, "gagal menambah eksemplar: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// Move memindahkan satu eksemplar ke koleksi lain (PATCH /copies/{copyID}/collection).
func (h *Handler) Move(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")

	var in struct {
		CollectionID string `json:"collection_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.CollectionID = strings.TrimSpace(in.CollectionID)
	if in.CollectionID == "" {
		http.Error(w, "collection_id wajib diisi", http.StatusBadRequest)
		return
	}

	if err := h.repo.MoveToCollection(r.Context(), copyID, in.CollectionID); err != nil {
		http.Error(w, "gagal memindahkan eksemplar: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// SetLocation mengatur/mengosongkan lokasi simpan fisik eksemplar.
// PATCH /copies/{copyID}/location.
func (h *Handler) SetLocation(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")

	var in struct {
		LocationID string `json:"location_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.repo.SetLocation(r.Context(), copyID, in.LocationID); err != nil {
		http.Error(w, "gagal mengatur lokasi: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdateCopy mengubah field yang menempel ke eksemplar fisik (kode
// inventaris, grade koleksi) — PATCH /copies/{copyID}.
func (h *Handler) UpdateCopy(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")

	var in struct {
		InventoryCode      string   `json:"inventory_code"`
		CollectionGrade    string   `json:"collection_grade"`
		CompletenessStatus string   `json:"completeness_status"`
		BindingDescription string   `json:"binding_description"`
		CoverDescription   string   `json:"cover_description"`
		DustJacketPresent  *bool    `json:"dust_jacket_present"`
		SlipcasePresent    *bool    `json:"slipcase_present"`
		HeightMM           *float64 `json:"height_mm"`
		WidthMM            *float64 `json:"width_mm"`
		ThicknessMM        *float64 `json:"thickness_mm"`
		WeightGrams        *float64 `json:"weight_grams"`
		AccessionNumber    string   `json:"accession_number"`
		PrivateNotes       string   `json:"private_notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.InventoryCode = strings.TrimSpace(in.InventoryCode)
	if in.InventoryCode == "" {
		http.Error(w, "inventory_code wajib diisi", http.StatusBadRequest)
		return
	}

	err := h.repo.UpdateCopy(r.Context(), copyID, UpdateCopyInput{
		InventoryCode:      in.InventoryCode,
		CollectionGrade:    in.CollectionGrade,
		CompletenessStatus: in.CompletenessStatus,
		BindingDescription: in.BindingDescription,
		CoverDescription:   in.CoverDescription,
		DustJacketPresent:  in.DustJacketPresent,
		SlipcasePresent:    in.SlipcasePresent,
		HeightMM:           in.HeightMM,
		WidthMM:            in.WidthMM,
		ThicknessMM:        in.ThicknessMM,
		WeightGrams:        in.WeightGrams,
		AccessionNumber:    in.AccessionNumber,
		PrivateNotes:       in.PrivateNotes,
	})
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			http.Error(w, "kode inventaris sudah dipakai di koleksi ini", http.StatusConflict)
			return
		}
		http.Error(w, "gagal mengubah eksemplar: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdateEdition mengubah field yang menempel ke karya/edisi (judul, judul
// asli, tahun, ISBN, penulis, penerbit) — berlaku untuk SEMUA eksemplar
// yang berbagi edisi ini. PATCH /editions/{editionID}.
func (h *Handler) UpdateEdition(w http.ResponseWriter, r *http.Request) {
	editionID := chi.URLParam(r, "editionID")

	var in struct {
		PreferredTitle  string `json:"preferred_title"`
		OriginalTitle   string `json:"original_title"`
		PublicationYear *int   `json:"publication_year"`
		ISBN            string `json:"isbn"`
		PublisherName   string `json:"publisher_name"`
		AuthorName      string `json:"author_name"`
		CategoryID      string `json:"category_id"`
		WorkTypeID      string `json:"work_type_id"`
		TotalPages      *int   `json:"total_pages"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.PreferredTitle = strings.TrimSpace(in.PreferredTitle)
	if in.PreferredTitle == "" {
		http.Error(w, "preferred_title wajib diisi", http.StatusBadRequest)
		return
	}

	err := h.repo.UpdateEdition(r.Context(), editionID, UpdateEditionInput{
		PreferredTitle:  in.PreferredTitle,
		OriginalTitle:   in.OriginalTitle,
		PublicationYear: in.PublicationYear,
		ISBN:            in.ISBN,
		PublisherName:   in.PublisherName,
		AuthorName:      in.AuthorName,
		CategoryID:      in.CategoryID,
		WorkTypeID:      in.WorkTypeID,
		TotalPages:      in.TotalPages,
	})
	if err != nil {
		http.Error(w, "gagal mengubah buku: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// UpdateWorkSummary mengubah sinopsis/signifikansi historis/catatan karya.
// PATCH /works/{workID}/summary.
func (h *Handler) UpdateWorkSummary(w http.ResponseWriter, r *http.Request) {
	workID := chi.URLParam(r, "workID")

	var in struct {
		SubjectSummary         string `json:"subject_summary"`
		Abstract               string `json:"abstract"`
		HistoricalSignificance string `json:"historical_significance"`
		Notes                  string `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}

	err := h.repo.UpdateWorkSummary(r.Context(), workID, UpdateWorkSummaryInput{
		SubjectSummary:         in.SubjectSummary,
		Abstract:               in.Abstract,
		HistoricalSignificance: in.HistoricalSignificance,
		Notes:                  in.Notes,
	})
	if err != nil {
		http.Error(w, "gagal mengubah ringkasan: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AddConditionReport menyimpan SATU laporan kondisi baru untuk eksemplar
// (bukan edit — riwayat tidak ditimpa). POST /copies/{copyID}/condition-reports.
func (h *Handler) AddConditionReport(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")

	var in struct {
		ConditionGrade    string   `json:"condition_grade"`
		ConditionScore    *float64 `json:"condition_score"`
		Note              string   `json:"note"`
		Foxing            bool     `json:"foxing"`
		MoldPresent       bool     `json:"mold_present"`
		PestDamagePresent bool     `json:"pest_damage_present"`
		WaterDamage       bool     `json:"water_damage"`
		ActiveRisk        bool     `json:"active_risk"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}

	err := h.repo.AddConditionReport(r.Context(), copyID, AddConditionReportInput{
		ConditionGrade:    in.ConditionGrade,
		ConditionScore:    in.ConditionScore,
		Note:              in.Note,
		Foxing:            in.Foxing,
		MoldPresent:       in.MoldPresent,
		PestDamagePresent: in.PestDamagePresent,
		WaterDamage:       in.WaterDamage,
		ActiveRisk:        in.ActiveRisk,
	})
	if err != nil {
		http.Error(w, "gagal menyimpan laporan kondisi: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// AddValuation menyimpan SATU valuasi baru untuk eksemplar (bukan edit).
// POST /copies/{copyID}/valuations.
func (h *Handler) AddValuation(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")

	var in struct {
		ValuationType  string   `json:"valuation_type"`
		Currency       string   `json:"currency"`
		ValueLow       *float64 `json:"value_low"`
		ValueMid       *float64 `json:"value_mid"`
		ValueHigh      *float64 `json:"value_high"`
		ValuationBasis string   `json:"valuation_basis"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.Currency = strings.TrimSpace(strings.ToUpper(in.Currency))
	if len(in.Currency) != 3 {
		http.Error(w, "currency harus 3 huruf (mis. IDR)", http.StatusBadRequest)
		return
	}

	err := h.repo.AddValuation(r.Context(), copyID, AddValuationInput{
		ValuationType:  in.ValuationType,
		Currency:       in.Currency,
		ValueLow:       in.ValueLow,
		ValueMid:       in.ValueMid,
		ValueHigh:      in.ValueHigh,
		ValuationBasis: in.ValuationBasis,
	})
	if err != nil {
		http.Error(w, "gagal menyimpan valuasi: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// ListConditionReports menampilkan seluruh riwayat laporan kondisi
// eksemplar ini (bukan cuma yang terbaru). GET /copies/{copyID}/condition-reports.
func (h *Handler) ListConditionReports(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")
	items, err := h.repo.ListConditionReports(r.Context(), copyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []ConditionReport{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// ListValuations menampilkan seluruh riwayat valuasi eksemplar ini.
// GET /copies/{copyID}/valuations.
func (h *Handler) ListValuations(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")
	items, err := h.repo.ListValuations(r.Context(), copyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []ValuationRecord{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// ListProvenance menampilkan seluruh riwayat kepemilikan eksemplar ini.
// GET /copies/{copyID}/provenance.
func (h *Handler) ListProvenance(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")
	items, err := h.repo.ListProvenance(r.Context(), copyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []ProvenanceEvent{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// AddProvenance menambah SATU titik riwayat kepemilikan baru (bukan edit).
// POST /copies/{copyID}/provenance.
func (h *Handler) AddProvenance(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")

	var in struct {
		EventType          string `json:"event_type"`
		OwnerName          string `json:"owner_name"`
		CounterpartyName   string `json:"counterparty_name"`
		PeriodText         string `json:"period_text"`
		PeriodStartYear    *int   `json:"period_start_year"`
		PeriodEndYear      *int   `json:"period_end_year"`
		EvidenceSummary    string `json:"evidence_summary"`
		VerificationStatus string `json:"verification_status"`
		Confidence         string `json:"confidence"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}

	err := h.repo.AddProvenance(r.Context(), copyID, AddProvenanceInput{
		EventType:          in.EventType,
		OwnerName:          in.OwnerName,
		CounterpartyName:   in.CounterpartyName,
		PeriodText:         in.PeriodText,
		PeriodStartYear:    in.PeriodStartYear,
		PeriodEndYear:      in.PeriodEndYear,
		EvidenceSummary:    in.EvidenceSummary,
		VerificationStatus: in.VerificationStatus,
		Confidence:         in.Confidence,
	})
	if err != nil {
		http.Error(w, "gagal menyimpan riwayat kepemilikan: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// UpsertAcquisition menyimpan/mengubah data akuisisi (cara didapat & harga
// beli) PRIMARY eksemplar ini — beda dari laporan kondisi/valuasi, ini
// SATU fakta yang boleh disunting, bukan riwayat berulang.
// PUT /copies/{copyID}/acquisition.
func (h *Handler) UpsertAcquisition(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")

	var in struct {
		Method          string   `json:"method"`
		TransactionDate string   `json:"transaction_date"`
		Currency        string   `json:"currency"`
		PurchasePrice   *float64 `json:"purchase_price"`
		SellerName      string   `json:"seller_name"`
		InvoiceNumber   string   `json:"invoice_number"`
		Notes           string   `json:"notes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.Currency = strings.TrimSpace(strings.ToUpper(in.Currency))
	if in.Currency != "" && len(in.Currency) != 3 {
		http.Error(w, "currency harus 3 huruf (mis. IDR)", http.StatusBadRequest)
		return
	}

	err := h.repo.UpsertAcquisition(r.Context(), copyID, UpsertAcquisitionInput{
		Method:          in.Method,
		TransactionDate: in.TransactionDate,
		Currency:        in.Currency,
		PurchasePrice:   in.PurchasePrice,
		SellerName:      in.SellerName,
		InvoiceNumber:   in.InvoiceNumber,
		Notes:           in.Notes,
	})
	if err != nil {
		http.Error(w, "gagal menyimpan akuisisi: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
