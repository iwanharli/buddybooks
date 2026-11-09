package reader

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

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
	// publicBaseURL & webhookSecret: dipakai untuk memicu fallback VLM
	// async (RequestVLMReread) dan memverifikasi callback-nya (OCRWebhook).
	// Kosongkan webhookSecret untuk menonaktifkan fallback ini sepenuhnya.
	publicBaseURL string
	webhookSecret string
}

func NewHandler(pages *PageRepository, assets *media.Repository, copiesR *copies.Repository, ocr *ocrclient.Client, publicBaseURL, webhookSecret string) *Handler {
	return &Handler{pages: pages, assets: assets, copiesR: copiesR, ocr: ocr, publicBaseURL: publicBaseURL, webhookSecret: webhookSecret}
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

	// target_sequence: opsional, dipakai saat pengguna memilih langsung
	// nomor halaman tertentu dari daftar (mis. lompat mengisi halaman 47
	// yang belum discan) alih-alih selalu menambah di akhir. Kalau nomor
	// itu sudah terpakai (unique constraint book_pages_copy_id_page_sequence_key)
	// DAN replace!=true, tolak dengan pesan jelas.
	hasTarget := false
	if raw := r.FormValue("target_sequence"); raw != "" {
		target, convErr := strconv.Atoi(raw)
		if convErr != nil || target < 1 {
			http.Error(w, "target_sequence tidak valid", http.StatusBadRequest)
			return
		}
		nextSeq = target
		hasTarget = true
	}

	// replace: "Foto Ulang" — retake foto untuk halaman yang SUDAH ada
	// (beda dari "Scan Ulang" yang cuma baca ulang gambar tersimpan lewat
	// AI tanpa foto baru). Hapus dulu baris lama (+ media_assets/berkas
	// lawasnya kalau kebetulan masih ada, dari sebelum gambar tidak lagi
	// disimpan permanen) supaya insert berikutnya tidak bentrok unique
	// constraint.
	if hasTarget && r.FormValue("replace") == "true" {
		oldImageAssetID, err := h.pages.DeleteBySequence(ctx, copyID, nextSeq)
		if err != nil {
			http.Error(w, "gagal menghapus halaman lama: "+err.Error(), http.StatusInternalServerError)
			return
		}
		if oldImageAssetID != nil {
			if filePath, err := h.assets.HardDelete(ctx, *oldImageAssetID); err != nil {
				log.Printf("gagal menghapus media_assets lama %s: %v", *oldImageAssetID, err)
			} else if filePath != "" {
				if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
					log.Printf("gagal menghapus berkas gambar lama %s: %v", filePath, err)
				}
			}
		}
	}

	// Bila foto berisi dua halaman (spread), simpan tiap halaman sebagai
	// book_page terpisah dengan page_sequence berurutan, berbagi satu gambar.
	// Bila hanya satu halaman (atau service lama tanpa `pages`), simpan satu.
	pages := ocrResult.Pages
	if len(pages) == 0 {
		// Kasus RapidOCR sama sekali tidak mendeteksi teks (mis. halaman
		// gelap/blank/rusak): service Python balikin pages kosong tapi tetap
		// menandai low_coverage di level atas. Bawa flag itu ke page
		// pengganti, supaya kasus terburuk ini tetap jadi kandidat fallback
		// VLM (lihat README.md#ocr--fallback-vlm — kasus IMG_2136).
		pages = []ocrclient.Page{{Text: ocrResult.Text, Confidence: ocrResult.Confidence, LowCoverage: ocrResult.LowCoverage}}
	}

	var created []BookPage
	for i, pg := range pages {
		var label *string
		if pg.Label != "" && len(pages) > 1 {
			l := pg.Label
			label = &l
		}
		bp, err := h.pages.Create(ctx, BookPage{
			CopyID:        copyID,
			EditionID:     editionID,
			ImageAssetID:  &asset.ID,
			PageLabel:     label,
			PageSequence:  nextSeq + i,
			OCRText:       pg.Text,
			OCRConfidence: pg.Confidence,
			OCREngine:     ocrResult.Engine,
			LowCoverage:   pg.LowCoverage,
		})
		if err != nil {
			if strings.Contains(err.Error(), "book_pages_copy_id_page_sequence_key") {
				http.Error(w, "halaman itu sudah pernah discan — pakai \"Scan Ulang\" untuk menimpanya", http.StatusConflict)
				return
			}
			http.Error(w, "gagal menyimpan book_pages: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// VLM (Gemini/OpenRouter) sekarang default untuk SEMUA halaman, bukan
		// cuma yang low_coverage — supaya tag struktur ([JUDUL]/[PARAGRAF]/
		// [HALAMAN]/[GAMBAR&TEKS]) selalu tersedia untuk tipografi di
		// frontend, bukan hanya "upgrade" darurat halaman bermasalah.
		// Konsekuensinya: tiap halaman kena biaya + kuota VLM, bukan cuma
		// yang benar-benar butuh (lihat README.md#ocr--fallback-vlm).
		if h.webhookSecret != "" {
			if !bp.LowCoverage {
				if err := h.pages.MarkPendingRescan(ctx, bp.ID); err != nil {
					log.Printf("vlm-reread: gagal menandai pending untuk book_page %s: %v", bp.ID, err)
				} else {
					bp.LowCoverage = true
				}
			}
			h.triggerVLMReread(bp.ID, data, pg.Text, pg.Side)
		}

		created = append(created, bp)
	}

	// Gambar aslinya sengaja TIDAK disimpan permanen — teks OCR (+ hasil
	// koreksi VLM async, yang sudah dipicu di atas pakai bytes di memori,
	// jadi tidak butuh berkas ini) sudah cukup, dan foto per halaman buku
	// bisa bikin storage bengkak untuk buku ratusan halaman. Konsekuensinya:
	// "Scan Ulang" tidak bisa dipakai lagi untuk halaman ini (tombolnya
	// otomatis hilang di frontend begitu image_asset_id kosong) — kalau mau
	// baca ulang, harus foto ulang manual.
	for _, bp := range created {
		if err := h.pages.ClearImageAsset(ctx, bp.ID); err != nil {
			log.Printf("gagal mengosongkan image_asset_id book_page %s: %v", bp.ID, err)
		}
	}
	if filePath, err := h.assets.HardDelete(ctx, asset.ID); err != nil {
		log.Printf("gagal menghapus media_assets %s: %v", asset.ID, err)
	} else if filePath != "" {
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			log.Printf("gagal menghapus berkas gambar %s: %v", filePath, err)
		}
	}

	for i := range created {
		created[i].ImageAssetID = nil
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"layout": ocrResult.Layout,
		"pages":  created,
	})
}

// triggerVLMReread memicu fallback VLM async (Gemini/OpenRouter) untuk satu
// halaman low_coverage, tanpa memblokir response upload. Fire-and-forget:
// kegagalan cuma di-log, tidak pernah gagalkan request pengguna — VLM murni
// upgrade kalau bisa, bukan dependency keras. Hasilnya baru muncul belakangan
// lewat OCRWebhook meng-update book_pages.ocr_text.
func (h *Handler) triggerVLMReread(bookPageID string, imageData []byte, ocrText, side string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
		defer cancel()

		callbackURL := h.publicBaseURL + "/api/v1/reader/ocr/callback"
		err := h.ocr.RequestVLMReread(ctx, ocrclient.RerereadRequest{
			ImageData:   imageData,
			OCRText:     ocrText,
			Side:        side,
			BookPageID:  bookPageID,
			CallbackURL: callbackURL,
			Secret:      h.webhookSecret,
		})
		if err != nil {
			log.Printf("vlm-reread: gagal memicu untuk book_page %s: %v", bookPageID, err)
		}
	}()
}

// OCRWebhook menerima hasil fallback VLM async dari ocr-service (dipicu oleh
// triggerVLMReread) dan meng-update book_pages yang bersangkutan. Diverifikasi
// dengan shared secret di header X-Webhook-Secret — bukan otentikasi user,
// jadi endpoint ini sengaja tidak butuh session/JWT, hanya secret ini.
func (h *Handler) OCRWebhook(w http.ResponseWriter, r *http.Request) {
	if h.webhookSecret == "" || r.Header.Get("X-Webhook-Secret") != h.webhookSecret {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var payload struct {
		BookPageID string `json:"book_page_id"`
		Text       string `json:"text"`
		Provider   string `json:"provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "payload tidak valid: "+err.Error(), http.StatusBadRequest)
		return
	}
	if payload.BookPageID == "" || payload.Text == "" {
		http.Error(w, "book_page_id dan text wajib diisi", http.StatusBadRequest)
		return
	}

	if err := h.pages.UpdateOCRText(r.Context(), payload.BookPageID, payload.Text, payload.Provider); err != nil {
		http.Error(w, "gagal update book_pages: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// RescanPage memaksa satu halaman yang sudah tersimpan dibaca ulang lewat
// fallback VLM (Gemini/OpenRouter), memakai gambar yang sudah ada di disk —
// pengguna TIDAK perlu memfoto ulang. Berbeda dari trigger otomatis di
// UploadPage (yang hanya jalan bila low_coverage=true), endpoint ini bisa
// dipanggil untuk halaman APA PUN, termasuk yang low_coverage-nya false
// tapi hasil bacaannya ternyata kacau (RapidOCR bisa "yakin" cakupannya
// penuh padahal teksnya salah — heuristik low_coverage tidak menangkap
// kasus ini, lihat catatan di README).
func (h *Handler) RescanPage(w http.ResponseWriter, r *http.Request) {
	pageID := chi.URLParam(r, "pageID")
	ctx := r.Context()

	if h.webhookSecret == "" {
		http.Error(w, "fallback VLM tidak aktif (OCR_WEBHOOK_SECRET belum diset)", http.StatusServiceUnavailable)
		return
	}

	page, err := h.pages.GetByID(ctx, pageID)
	if err != nil {
		http.Error(w, "halaman tidak ditemukan: "+err.Error(), http.StatusNotFound)
		return
	}
	if page.ImageAssetID == nil {
		http.Error(w, "halaman ini tidak punya gambar tersimpan untuk dibaca ulang", http.StatusBadRequest)
		return
	}

	asset, err := h.assets.GetByID(ctx, *page.ImageAssetID)
	if err != nil {
		http.Error(w, "gambar tidak ditemukan: "+err.Error(), http.StatusNotFound)
		return
	}

	data, err := os.ReadFile(asset.FilePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "berkas gambar sudah tidak ada di disk", http.StatusGone)
			return
		}
		http.Error(w, "gagal membaca berkas gambar: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := h.pages.MarkPendingRescan(ctx, pageID); err != nil {
		http.Error(w, "gagal menandai halaman: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// side default "single": book_pages tidak menyimpan side asli (kiri/
	// kanan/dominant) dari segmentasi awal, jadi prompt VLM memperlakukan
	// gambar sebagai satu halaman penuh. Cukup aman untuk kasus umum;
	// akurasi bisa sedikit berkurang khusus untuk foto bentang lama.
	h.triggerVLMReread(pageID, data, page.OCRText, "single")

	w.WriteHeader(http.StatusAccepted)
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
