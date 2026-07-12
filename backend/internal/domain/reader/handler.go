package reader

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/buddybooks/backend/internal/domain/copies"
	"github.com/buddybooks/backend/internal/domain/media"
	"github.com/buddybooks/backend/internal/ocrclient"
	"github.com/buddybooks/backend/internal/storage"
)

type Handler struct {
	pages   *PageRepository
	assets  *media.Repository
	copiesR *copies.Repository
	ocr     *ocrclient.Client
}

func NewHandler(pages *PageRepository, assets *media.Repository, copiesR *copies.Repository, ocr *ocrclient.Client) *Handler {
	return &Handler{pages: pages, assets: assets, copiesR: copiesR, ocr: ocr}
}

// dewarpRequested membaca field form "dewarp" (true untuk halaman melengkung).
func dewarpRequested(r *http.Request) bool {
	v := r.FormValue("dewarp")
	return v == "1" || v == "true" || v == "yes"
}

// RecognizePage menerima satu file gambar (multipart form, field "image")
// dan mengembalikan hasil OCR tanpa menyimpan apa pun. Berguna untuk
// pratinjau cepat sebelum halaman benar-benar disimpan ke sebuah copy.
func (h *Handler) RecognizePage(w http.ResponseWriter, r *http.Request) {
	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "field 'image' wajib diisi: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "gagal membaca file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	result, err := h.ocr.Recognize(r.Context(), data, dewarpRequested(r))
	if err != nil {
		http.Error(w, "OCR gagal: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// UploadPage menyimpan satu halaman hasil scan secara permanen: gambar ke
// disk + media_assets, teks OCR ke book_pages dengan page_sequence otomatis.
// Ini langkah persistensi yang belum ada di RecognizePage (pratinjau saja).
func (h *Handler) UploadPage(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")
	ctx := r.Context()

	editionID, err := h.copiesR.EditionIDOf(ctx, copyID)
	if err != nil {
		http.Error(w, "copy tidak ditemukan: "+err.Error(), http.StatusNotFound)
		return
	}

	file, _, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "field 'image' wajib diisi: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "gagal membaca file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	ocrResult, err := h.ocr.Recognize(ctx, data, dewarpRequested(r))
	if err != nil {
		http.Error(w, "OCR gagal: "+err.Error(), http.StatusInternalServerError)
		return
	}

	saved, err := storage.SaveOriginal(copyID, data, ".png")
	if err != nil {
		http.Error(w, "gagal menyimpan berkas: "+err.Error(), http.StatusInternalServerError)
		return
	}

	asset, err := h.assets.Create(ctx, media.Asset{
		CopyID:         copyID,
		FilePath:       saved.FilePath,
		FileName:       saved.FileName,
		MimeType:       "image/png",
		FileSize:       saved.FileSize,
		ChecksumSHA256: saved.ChecksumSHA256,
	})
	if err != nil {
		http.Error(w, "gagal menyimpan media_assets: "+err.Error(), http.StatusInternalServerError)
		return
	}

	nextSeq, err := h.pages.NextSequence(ctx, copyID)
	if err != nil {
		http.Error(w, "gagal menentukan urutan halaman: "+err.Error(), http.StatusInternalServerError)
		return
	}

	page, err := h.pages.Create(ctx, BookPage{
		CopyID:        copyID,
		EditionID:     editionID,
		ImageAssetID:  &asset.ID,
		PageSequence:  nextSeq,
		OCRText:       ocrResult.Text,
		OCRConfidence: ocrResult.Confidence,
		OCREngine:     ocrResult.Engine,
	})
	if err != nil {
		http.Error(w, "gagal menyimpan book_pages: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(page)
}

func (h *Handler) ListPages(w http.ResponseWriter, r *http.Request) {
	copyID := chi.URLParam(r, "copyID")
	items, err := h.pages.ListByCopy(r.Context(), copyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if items == nil {
		items = []BookPage{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}
