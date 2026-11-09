package master

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	resource := chi.URLParam(r, "resource")
	items, err := h.repo.List(r.Context(), resource)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	if items == nil {
		items = []Item{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (h *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	resource := chi.URLParam(r, "resource")
	id := chi.URLParam(r, "id")
	detail, err := h.repo.Detail(r.Context(), resource, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}
