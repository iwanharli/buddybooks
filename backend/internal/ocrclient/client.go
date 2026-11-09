// Package ocrclient memanggil service OCR Python (PaddleOCR/RapidOCR + dewarp)
// via HTTP. Ini menggantikan Tesseract (gosseract) sebagai engine utama karena
// jauh lebih tahan terhadap foto HP miring/melengkung/cahaya buruk.
package ocrclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"time"
)

// Page adalah satu halaman hasil segmentasi bentang (spread) — mis. halaman
// kiri dan kanan dari satu foto buku, dibaca terpisah.
type Page struct {
	Label      string  `json:"label"`
	Side       string  `json:"side"` // single | dominant | left | right
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
	CharCount  int     `json:"char_count"`
	// LowCoverage: true bila confidence tinggi tapi teks terdeteksi jauh
	// lebih sedikit dari perkiraan (indikasi under-read), lihat segment.py.
	// Menandai halaman ini kandidat fallback VLM (async, lihat
	// Client.RequestVLMReread).
	LowCoverage bool `json:"low_coverage"`
}

type Result struct {
	Text        string  `json:"text"`
	Confidence  float64 `json:"confidence"`
	LowCoverage bool    `json:"low_coverage"`
	Engine      string  `json:"engine"`
	Dewarped    bool    `json:"dewarped"`
	Layout      string  `json:"layout"` // single | single-dominant | spread
	Pages       []Page  `json:"pages"`
}

type Client struct {
	baseURL string
	http    *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		// Dewarp (optimisasi) bisa memakan beberapa detik; beri timeout lega.
		http: &http.Client{Timeout: 60 * time.Second},
	}
}

// Recognize mengirim gambar ke service OCR. dewarp mengaktifkan pelurusan
// halaman melengkung (lebih lambat; untuk foto buku yang melengkung).
func (c *Client) Recognize(ctx context.Context, imageData []byte, dewarp bool) (Result, error) {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	part, err := w.CreateFormFile("image", "page.png")
	if err != nil {
		return Result{}, err
	}
	if _, err := part.Write(imageData); err != nil {
		return Result{}, err
	}
	if dewarp {
		_ = w.WriteField("dewarp", "true")
	}
	if err := w.Close(); err != nil {
		return Result{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/ocr", &body)
	if err != nil {
		return Result{}, err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := c.http.Do(req)
	if err != nil {
		return Result{}, fmt.Errorf("panggil service OCR: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("service OCR mengembalikan status %d", resp.StatusCode)
	}

	var out Result
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return Result{}, fmt.Errorf("dekode respons OCR: %w", err)
	}
	return out, nil
}

// RerereadRequest adalah parameter untuk RequestVLMReread.
type RerereadRequest struct {
	ImageData   []byte
	OCRText     string
	Side        string // single | dominant | left | right
	BookPageID  string
	CallbackURL string // URL backend Go yang menerima hasil (POST balik)
	Secret      string // dikirim di header X-Webhook-Secret agar callback bisa diverifikasi
}

// RequestVLMReread meminta ocr-service membaca ulang satu halaman lewat VLM
// fallback (Gemini/OpenRouter, lihat vlm_assist.py) secara ASYNC: ocr-service
// langsung balas 202 tanpa menunggu VLM selesai, lalu memanggil balik
// CallbackURL begitu hasil (atau kegagalan) didapat. Dipakai untuk halaman
// yang low_coverage, dipanggil fire-and-forget (goroutine terpisah) agar
// tidak memperlambat response upload halaman.
func (c *Client) RequestVLMReread(ctx context.Context, req RerereadRequest) error {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)

	part, err := w.CreateFormFile("image", "page.png")
	if err != nil {
		return err
	}
	if _, err := part.Write(req.ImageData); err != nil {
		return err
	}
	_ = w.WriteField("ocr_text", req.OCRText)
	_ = w.WriteField("side", req.Side)
	_ = w.WriteField("book_page_id", req.BookPageID)
	_ = w.WriteField("callback_url", req.CallbackURL)
	_ = w.WriteField("callback_secret", req.Secret)
	if err := w.Close(); err != nil {
		return err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/ocr/vlm-reread", &body)
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return fmt.Errorf("panggil /ocr/vlm-reread: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("/ocr/vlm-reread mengembalikan status %d", resp.StatusCode)
	}
	return nil
}
