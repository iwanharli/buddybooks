package reader

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/buddybooks/backend/internal/ocr"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

// RecognizePage menerima satu file gambar halaman (multipart form, field "image")
// dan opsional field "languages" (dipisah koma, default "ind,nld,eng"),
// lalu mengembalikan hasil OCR. Endpoint ini adalah langkah pertama pipeline
// docs/reader-module.md §27.2, sebelum hasilnya disimpan ke book_pages.
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

	languages := []string{"ind", "nld", "eng"}
	if l := r.FormValue("languages"); l != "" {
		languages = splitCSV(l)
	}

	result, err := ocr.RecognizeBytes(data, languages)
	if err != nil {
		http.Error(w, "OCR gagal: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func splitCSV(s string) []string {
	var out []string
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			if i > start {
				out = append(out, s[start:i])
			}
			start = i + 1
		}
	}
	return out
}
