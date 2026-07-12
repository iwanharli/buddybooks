# Panduan Pengembangan

Struktur monorepo:

```text
buddybooks/
├── backend/      Go API (chi + pgx)
├── frontend/     React + Vite + TypeScript
├── ocr-service/  Service OCR Python (PaddleOCR/RapidOCR + dewarp)
├── schema.sql    Desain skema PostgreSQL (referensi)
├── seed.sql      Data master/seed (referensi)
└── docs/         Dokumentasi desain lengkap
```

Engine OCR memakai **service Python terpisah** (`ocr-service/`) berbasis
PaddleOCR (model PP-OCR via RapidOCR/ONNXRuntime) + dewarping. Backend Go
memanggilnya via HTTP (`OCR_SERVICE_URL`, default `http://127.0.0.1:8090`).
Menggantikan Tesseract karena jauh lebih tahan foto HP miring/melengkung.

`backend/migrations/` berisi salinan `schema.sql` dan `seed.sql` yang dieksekusi ke database. File di root tetap menjadi sumber desain yang didokumentasikan di `docs/`.

## Prasyarat

- Go 1.22+
- Node.js 20+
- PostgreSQL 16+ (database `db_buddybooks` sudah dibuat dari `schema.sql` + `seed.sql`)
- Tesseract OCR + paket bahasa (`brew install tesseract tesseract-lang`) dan `pkg-config` (`brew install pkg-config`), untuk modul reader/OCR
- [`air`](https://github.com/air-verse/air) (`go install github.com/air-verse/air@latest`), untuk auto-reload backend saat development

## Menjalankan backend

```bash
cd backend
cp .env.example .env   # sesuaikan DATABASE_URL bila perlu
make dev                # auto-reload (air): rebuild+restart otomatis saat file .go berubah
# atau tanpa auto-reload:
make run
```

Backend berjalan di `http://localhost:8080`. Cek `GET /health`.

## Menjalankan service OCR (Python)

```bash
cd ocr-service
python3.11 -m venv .venv                 # sekali saja
.venv/bin/pip install -r requirements.txt # sekali saja
.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8090
```

Harus jalan sebelum fitur scan/OCR dipakai. Model PP-OCR diunduh otomatis
saat pertama kali. Lihat `ocr-service/README.md`.

### Auto-reload (frontend vs backend)

- **Frontend (Vite)**: hot-reload otomatis bawaan, tidak perlu restart manual apa pun saat file disimpan.
- **Backend (Go)**: `go run`/`make run` **tidak** auto-reload — perlu `make dev` (memakai `air`, dikonfigurasi di `.air.toml`) agar setiap perubahan file `.go` otomatis di-*rebuild* dan proses di-*restart*.

## Menjalankan migrasi/seed (database baru)

```bash
cd backend
export DATABASE_URL="postgres://localhost:5432/db_buddybooks?sslmode=disable"
make migrate
make seed
```

## Menjalankan frontend

```bash
cd frontend
cp .env.example .env   # sesuaikan VITE_API_BASE_URL bila perlu
npm install
npm run dev
```

Frontend berjalan di `http://localhost:5173`, memanggil backend lewat `VITE_API_BASE_URL`.

## Struktur backend (`backend/internal/`)

```text
config/      Konfigurasi dari environment variable
db/          Koneksi pool PostgreSQL (pgx)
domain/      Satu folder per modul bisnis (mengikuti docs/architecture.md)
  collections/
    repository.go   Query database
    handler.go      HTTP handler
httpapi/     Router dan middleware (chi)
```

Modul baru (works, editions, copies, dst.) mengikuti pola yang sama seperti `domain/collections/`: `repository.go` untuk akses data, `handler.go` untuk HTTP, didaftarkan di `httpapi/router.go`.

## Struktur frontend (`frontend/src/`)

```text
lib/          Klien API generik (fetch wrapper)
features/     Satu folder per modul, mengikuti modul backend
  collections/
    types.ts        Tipe data
    api.ts           Pemanggilan API
    CollectionsPage.tsx  Halaman/komponen
```

Modul baru menambah folder di `features/` dengan pola yang sama, lalu didaftarkan sebagai route di `App.tsx`.
