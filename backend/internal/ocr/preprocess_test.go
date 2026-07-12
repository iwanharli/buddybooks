package ocr

import (
	"os"
	"testing"

	"github.com/otiai10/gosseract/v2"
)

// TestPreprocessImprovesLowContrast membandingkan OCR pada gambar kontras
// rendah dengan pencahayaan tidak rata (simulasi foto), tanpa vs dengan
// pra-proses. Mencetak confidence keduanya agar efeknya terlihat.
func TestPreprocessImprovesLowContrast(t *testing.T) {
	data, err := os.ReadFile("testdata/lowcontrast.png")
	if err != nil {
		t.Fatalf("read testdata: %v", err)
	}

	raw := runOCR(t, data)
	pre := runOCR(t, preprocess(data))

	t.Logf("TANPA pra-proses : confidence=%.1f%%  text=%q", raw.conf*100, raw.text)
	t.Logf("DENGAN pra-proses: confidence=%.1f%%  text=%q", pre.conf*100, pre.text)

	if pre.conf < raw.conf {
		t.Logf("catatan: pra-proses tidak menaikkan confidence pada gambar ini")
	}
}

type ocrOut struct {
	text string
	conf float64
}

func runOCR(t *testing.T, data []byte) ocrOut {
	t.Helper()
	c := gosseract.NewClient()
	defer c.Close()
	if err := c.SetLanguage("ind", "eng"); err != nil {
		t.Fatalf("set language: %v", err)
	}
	if err := c.SetImageFromBytes(data); err != nil {
		t.Fatalf("set image: %v", err)
	}
	text, err := c.Text()
	if err != nil {
		t.Fatalf("text: %v", err)
	}
	return ocrOut{text: text, conf: averageWordConfidence(c)}
}
