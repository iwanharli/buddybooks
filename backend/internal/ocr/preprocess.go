package ocr

import (
	"bytes"
	"image"
	"image/color"
	_ "image/jpeg" // daftarkan decoder JPEG
	"image/png"
)

// preprocess mengubah foto berwarna menjadi grayscale lalu meregangkan
// kontras (histogram stretch berbasis persentil) agar Tesseract menerima
// input yang lebih bersih. Ini membantu foto halaman yang cahayanya tidak
// rata atau kontrasnya rendah. Binarisasi final tetap diserahkan ke
// Tesseract/Leptonica secara internal.
//
// Bila gambar gagal didekode, data asli dikembalikan apa adanya (aman).
func preprocess(data []byte) []byte {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return data
	}

	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w == 0 || h == 0 {
		return data
	}

	// Pass 1: konversi ke grayscale + bangun histogram 256-bin.
	// Histogram O(n) jauh lebih cepat daripada sorting seluruh piksel
	// (penting untuk foto belasan megapiksel).
	gray := image.NewGray(bounds)
	var hist [256]int
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			c := color.GrayModel.Convert(img.At(x, y)).(color.Gray)
			gray.SetGray(x, y, c)
			hist[c.Y]++
		}
	}

	// Persentil 2% dan 98% sebagai batas, lebih tahan terhadap outlier
	// (mis. titik paling terang/gelap) dibanding min/max absolut.
	total := w * h
	loCount := int(float64(total) * 0.02)
	hiCount := int(float64(total) * 0.98)
	var lo, hi uint8
	cum := 0
	for i := 0; i < 256; i++ {
		cum += hist[i]
		if cum > loCount {
			lo = uint8(i)
			break
		}
	}
	cum = 0
	for i := 0; i < 256; i++ {
		cum += hist[i]
		if cum >= hiCount {
			hi = uint8(i)
			break
		}
	}
	if hi <= lo {
		// Kontras sudah rata/ekstrem; tak perlu diregangkan.
		return encodePNG(gray, data)
	}

	// Pass 2: regangkan [lo, hi] -> [0, 255].
	scale := 255.0 / float64(hi-lo)
	for i := range gray.Pix {
		v := gray.Pix[i]
		var out float64
		switch {
		case v <= lo:
			out = 0
		case v >= hi:
			out = 255
		default:
			out = float64(v-lo) * scale
		}
		gray.Pix[i] = uint8(out)
	}

	return encodePNG(gray, data)
}

func encodePNG(img image.Image, fallback []byte) []byte {
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return fallback
	}
	return buf.Bytes()
}
