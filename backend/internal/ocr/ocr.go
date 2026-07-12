// Package ocr membungkus Tesseract (via gosseract) untuk modul reader.
// Cakupan awal: aksara Latin (Belanda "nld", Indonesia ejaan lama "ind",
// Inggris "eng"), sesuai keputusan docs/reader-module.md §27.1.
// Aksara Jawa ("jav") tersedia tapi akurasinya rendah untuk naskah kuno.
package ocr

import (
	"fmt"
	"os"

	"github.com/otiai10/gosseract/v2"
)

// Result menampung teks hasil OCR dan confidence rata-rata, dipetakan ke
// kolom book_pages.ocr_text dan book_pages.ocr_confidence.
type Result struct {
	Text       string  `json:"text"`
	Confidence float64 `json:"confidence"` // 0..1
	Engine     string  `json:"engine"`
}

// RecognizeFile menjalankan OCR pada satu file gambar halaman.
// languages contoh: []string{"ind", "nld", "eng"}.
func RecognizeFile(imagePath string, languages []string) (Result, error) {
	client := gosseract.NewClient()
	defer client.Close()

	if err := client.SetLanguage(languages...); err != nil {
		return Result{}, fmt.Errorf("set language: %w", err)
	}
	data, err := os.ReadFile(imagePath)
	if err != nil {
		return Result{}, fmt.Errorf("read image file: %w", err)
	}
	if err := client.SetImageFromBytes(preprocess(data)); err != nil {
		return Result{}, fmt.Errorf("set image: %w", err)
	}

	text, err := client.Text()
	if err != nil {
		return Result{}, fmt.Errorf("recognize text: %w", err)
	}

	confidence := averageWordConfidence(client)

	return Result{
		Text:       text,
		Confidence: confidence,
		Engine:     "tesseract",
	}, nil
}

// RecognizeBytes sama seperti RecognizeFile tapi menerima data gambar mentah
// (mis. dari upload multipart), tanpa menulis file sementara.
func RecognizeBytes(imageData []byte, languages []string) (Result, error) {
	client := gosseract.NewClient()
	defer client.Close()

	if err := client.SetLanguage(languages...); err != nil {
		return Result{}, fmt.Errorf("set language: %w", err)
	}
	if err := client.SetImageFromBytes(preprocess(imageData)); err != nil {
		return Result{}, fmt.Errorf("set image: %w", err)
	}

	text, err := client.Text()
	if err != nil {
		return Result{}, fmt.Errorf("recognize text: %w", err)
	}

	confidence := averageWordConfidence(client)

	return Result{
		Text:       text,
		Confidence: confidence,
		Engine:     "tesseract",
	}, nil
}

func averageWordConfidence(client *gosseract.Client) float64 {
	boxes, err := client.GetBoundingBoxes(gosseract.RIL_WORD)
	if err != nil || len(boxes) == 0 {
		return 0
	}
	var sum float64
	for _, b := range boxes {
		sum += b.Confidence
	}
	return (sum / float64(len(boxes))) / 100.0 // gosseract 0..100 -> 0..1
}
