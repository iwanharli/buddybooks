package collections

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
		items = []Collection{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// GetByCode menampilkan satu koleksi lewat code-nya — dipakai frontend
// untuk resolve slug URL /collections/:code. GET /collections/by-code/{code}.
func (h *Handler) GetByCode(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	c, err := h.repo.GetByCode(r.Context(), code)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

type collectionInput struct {
	Name            string `json:"name"`
	Description     string `json:"description"`
	DefaultCurrency string `json:"default_currency"`
}

// defaultCurrencyFallback: mata uang default kalau tidak dikirim klien —
// mayoritas koleksi dikelola dalam Rupiah, jadi tidak perlu diisi manual
// tiap bikin koleksi baru. Konversi ke mata uang lain (kalau ada transaksi
// USD dsb.) tetap terjadi otomatis via fx_rates saat menghitung total modal
// (lihat docs/computed.md), bukan dari kolom ini.
const defaultCurrencyFallback = "IDR"

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var in collectionInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.DefaultCurrency = strings.TrimSpace(strings.ToUpper(in.DefaultCurrency))
	if in.DefaultCurrency == "" {
		in.DefaultCurrency = defaultCurrencyFallback
	}
	if in.Name == "" {
		http.Error(w, "name wajib diisi", http.StatusBadRequest)
		return
	}
	if len(in.DefaultCurrency) != 3 {
		http.Error(w, "default_currency harus 3 huruf (mis. IDR)", http.StatusBadRequest)
		return
	}

	c, err := h.repo.Create(r.Context(), in.Name, in.Description, in.DefaultCurrency)
	if err != nil {
		http.Error(w, "gagal membuat koleksi: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var in collectionInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.DefaultCurrency = strings.TrimSpace(strings.ToUpper(in.DefaultCurrency))
	if in.DefaultCurrency == "" {
		in.DefaultCurrency = defaultCurrencyFallback
	}
	if in.Name == "" {
		http.Error(w, "name wajib diisi", http.StatusBadRequest)
		return
	}
	if len(in.DefaultCurrency) != 3 {
		http.Error(w, "default_currency harus 3 huruf (mis. IDR)", http.StatusBadRequest)
		return
	}

	c, err := h.repo.Update(r.Context(), id, in.Name, in.Description, in.DefaultCurrency)
	if err != nil {
		http.Error(w, "gagal mengubah koleksi: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}
