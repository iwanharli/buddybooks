# Panduan Pengembangan

Struktur monorepo:

```text
buddybooks/
├── backend/     Go API (chi + pgx)
├── frontend/    React + Vite + TypeScript
├── schema.sql   Desain skema PostgreSQL (referensi)
├── seed.sql     Data master/seed (referensi)
└── docs/        Dokumentasi desain lengkap
```

`backend/migrations/` berisi salinan `schema.sql` dan `seed.sql` yang dieksekusi ke database. File di root tetap menjadi sumber desain yang didokumentasikan di `docs/`.

## Prasyarat

- Go 1.22+
- Node.js 20+
- PostgreSQL 16+ (database `db_buddybooks` sudah dibuat dari `schema.sql` + `seed.sql`)

## Menjalankan backend

```bash
cd backend
cp .env.example .env   # sesuaikan DATABASE_URL bila perlu
make run               # atau: go run ./cmd/api
```

Backend berjalan di `http://localhost:8080`. Cek `GET /health`.

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
