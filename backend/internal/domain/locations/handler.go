package locations

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

// List menampilkan seluruh lokasi fisik di satu koleksi.
// GET /collections/{collectionID}/locations.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	collectionID := chi.URLParam(r, "collectionID")
	items, err := h.repo.ListByCollection(r.Context(), collectionID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []Location{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// Create menambah lokasi fisik baru di satu koleksi.
// POST /collections/{collectionID}/locations.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	collectionID := chi.URLParam(r, "collectionID")

	var in struct {
		Code              string `json:"code"`
		Name              string `json:"name"`
		LocationType      string `json:"location_type"`
		ParentLocationID  string `json:"parent_location_id"`
		ClimateControlled bool   `json:"climate_controlled"`
		Secure            bool   `json:"secure"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.Code = strings.TrimSpace(in.Code)
	if in.Code == "" {
		http.Error(w, "code wajib diisi", http.StatusBadRequest)
		return
	}

	loc, err := h.repo.Create(r.Context(), collectionID, CreateInput{
		Code:              in.Code,
		Name:              in.Name,
		LocationType:      in.LocationType,
		ParentLocationID:  in.ParentLocationID,
		ClimateControlled: in.ClimateControlled,
		Secure:            in.Secure,
	})
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			http.Error(w, "kode lokasi sudah dipakai di koleksi ini", http.StatusConflict)
			return
		}
		http.Error(w, "gagal membuat lokasi: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(loc)
}

// Update mengubah nama/tipe/induk/atribut sebuah lokasi. PATCH /locations/{locationID}.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	locationID := chi.URLParam(r, "locationID")

	var in struct {
		Name              string `json:"name"`
		LocationType      string `json:"location_type"`
		ParentLocationID  string `json:"parent_location_id"`
		ClimateControlled bool   `json:"climate_controlled"`
		Secure            bool   `json:"secure"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}

	err := h.repo.Update(r.Context(), locationID, UpdateInput{
		Name:              in.Name,
		LocationType:      in.LocationType,
		ParentLocationID:  in.ParentLocationID,
		ClimateControlled: in.ClimateControlled,
		Secure:            in.Secure,
	})
	if err != nil {
		http.Error(w, "gagal mengubah lokasi: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Delete menghapus lokasi. DELETE /locations/{locationID}.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	locationID := chi.URLParam(r, "locationID")
	if err := h.repo.Delete(r.Context(), locationID); err != nil {
		if strings.Contains(err.Error(), "foreign key") || strings.Contains(err.Error(), "violates") {
			http.Error(w, "lokasi masih dipakai eksemplar atau punya sub-lokasi, pindahkan dulu isinya", http.StatusConflict)
			return
		}
		http.Error(w, "gagal menghapus lokasi: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
