package media

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/go-chi/chi/v5"

	"github.com/buddybooks/backend/internal/storage"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

// UploadPhoto menyimpan SATU foto eksemplar (cover/spine/dst) — beda dari
// reader.UploadPage yang khusus alur OCR (bikin book_pages + memicu OCR).
// POST /copies/{copyID}/photos, multipart field "file" + opsional
// "media_type"/"caption".
func (h *Handler) UploadPhoto(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "field 'file' wajib diisi: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "gagal membaca file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".jpg"
	}

	saved, err := storage.SaveOriginal("photos/"+copyID, data, ext)
	if err != nil {
		http.Error(w, "gagal menyimpan berkas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	asset, err := h.repo.Create(r.Context(), Asset{
		CopyID:         copyID,
		MediaType:      r.FormValue("media_type"),
		FilePath:       saved.FilePath,
		FileName:       saved.FileName,
		MimeType:       mimeType,
		FileSize:       saved.FileSize,
		ChecksumSHA256: saved.ChecksumSHA256,
		Caption:        r.FormValue("caption"),
	})
	if err != nil {
		http.Error(w, "gagal menyimpan metadata foto: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(assetResponse(asset))
}

// ListPhotos menampilkan seluruh foto eksemplar ini.
// GET /copies/{copyID}/photos.
func (h *Handler) ListPhotos(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")
	items, err := h.repo.ListByCopy(r.Context(), copyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	out := make([]map[string]any, 0, len(items))
	for _, a := range items {
		out = append(out, assetResponse(a))
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// assetResponse membungkus Asset dengan "url" yang bisa langsung dipakai
// <img src> di frontend (lewat ServeFile), tanpa membocorkan file_path
// disk asli.
func assetResponse(a Asset) map[string]any {
	return map[string]any{
		"id":         a.ID,
		"copy_id":    a.CopyID,
		"media_type": a.MediaType,
		"caption":    a.Caption,
		"url":        "/api/v1/media/" + a.ID + "/file",
	}
}

// UpdatePhoto mengubah jenis/caption foto. PATCH /media/{id}.
func (h *Handler) UpdatePhoto(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var in struct {
		MediaType string `json:"media_type"`
		Caption   string `json:"caption"`
	}
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.repo.Update(r.Context(), id, in.MediaType, in.Caption); err != nil {
		http.Error(w, "gagal mengubah foto: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeletePhoto menghapus (soft-delete) satu foto. DELETE /media/{id}.
func (h *Handler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.repo.SoftDelete(r.Context(), id); err != nil {
		http.Error(w, "gagal menghapus foto: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ServeFile menyajikan isi berkas media_assets langsung (GET /media/{id}/file).
func (h *Handler) ServeFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	asset, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		http.Error(w, "media tidak ditemukan", http.StatusNotFound)
		return
	}

	f, err := os.Open(asset.FilePath)
	if err != nil {
		http.Error(w, "berkas tidak ditemukan", http.StatusNotFound)
		return
	}
	defer f.Close()

	if asset.MimeType != "" {
		w.Header().Set("Content-Type", asset.MimeType)
	}
	io.Copy(w, f)
}
