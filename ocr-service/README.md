# Buddybooks OCR Service

Engine OCR "pintar" untuk modul reader: **PaddleOCR (model PP-OCR) via
RapidOCR/ONNXRuntime**, dengan opsi **dewarping** (pelurusan halaman buku
melengkung). Jauh lebih tahan terhadap foto HP miring/melengkung/cahaya
buruk dibanding Tesseract, dan berjalan **lokal** (tanpa cloud).

Backend Go memanggil service ini via HTTP (`OCR_SERVICE_URL`, default
`http://127.0.0.1:8090`).

## Setup

```bash
cd ocr-service
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

Model PP-OCR (~kecil) diunduh otomatis oleh RapidOCR saat pertama kali jalan.

## Menjalankan

```bash
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8090
```

## Endpoint

- `GET /health`
- `POST /ocr` — multipart:
  - `image` (file, wajib)
  - `dewarp` (opsional, `true` untuk meluruskan halaman melengkung; lebih lambat)

Respons:

```json
{ "text": "...", "confidence": 0.98, "engine": "rapidocr-ppocr", "dewarped": false }
```

## Catatan

- **RapidOCR** memakai model PaddleOCR (PP-OCRv4) yang sama, dijalankan lewat
  ONNXRuntime agar instalasinya andal di Apple Silicon (paddlepaddle mentah
  sering gagal di arm64 / Python baru).
- **Dewarping** (page-dewarp) bersifat best-effort: bila garis teks tidak
  cukup terdeteksi, gambar asli dipakai apa adanya. RapidOCR sendiri sudah
  menangani kemiringan ringan-sedang; dewarp untuk lengkungan berat.
