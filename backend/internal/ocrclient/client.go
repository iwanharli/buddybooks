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

type Result struct {
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"`
	Engine     string  `json:"engine"`
	Dewarped   bool    `json:"dewarped"`
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
