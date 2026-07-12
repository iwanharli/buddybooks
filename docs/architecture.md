# Struktur Proyek Aplikasi

Contoh struktur modular:

```text
book-collection/
├── app/
│   ├── collections/
│   ├── catalog/
│   ├── works/
│   ├── editions/
│   ├── copies/
│   ├── conditions/
│   ├── acquisitions/
│   ├── valuations/
│   ├── provenance/
│   ├── storage/
│   ├── media/
│   └── wishlists/
├── database/
│   ├── schema/
│   ├── migrations/
│   ├── seeds/
│   └── backups/
├── storage/
│   ├── originals/
│   ├── thumbnails/
│   ├── documents/
│   └── exports/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── end-to-end/
├── docs/
│   ├── database.dbml
│   ├── API.md
│   ├── DATA-DICTIONARY.md
│   └── USER-GUIDE.md
└── README.md
```

---

# Teknologi Implementasi

Desain database bersifat netral dan dapat diterapkan pada berbagai stack.

Rekomendasi umum:

- database relasional PostgreSQL;
- backend berbasis API;
- frontend web responsif;
- object storage untuk foto dan dokumen;
- QR code untuk membuka halaman eksemplar;
- background job untuk thumbnail, checksum, dan backup;
- migration tool untuk perubahan database;
- container untuk konsistensi deployment.

Hindari ketergantungan pada penyimpanan file lokal tunggal apabila sistem digunakan dari lebih dari satu perangkat.

Konvensi tipe waktu:

- semua stempel waktu sistem seperti `created_at`, `updated_at`, dan `moved_at` menggunakan `TIMESTAMPTZ`, bukan `TIMESTAMP` tanpa zona;
- tanggal historis pada provenance sering tidak lengkap. Simpan sebagai tanggal parsial: kolom teks `date_text` untuk tampilan (misalnya "1978" atau "sekitar 1965") ditambah `year_start` dan `year_end` sebagai bilangan bulat untuk pengurutan dan filter;
- jangan memaksa tanggal parsial menjadi `1978-01-01` seolah tanggal pastinya diketahui.

---

