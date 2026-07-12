# Tahapan Pengembangan

## Fondasi — Pengguna dan Keamanan

Disediakan sejak awal karena ini marketplace multi-penjual dengan data bernilai dan sensitif:

- `users` (autentikasi);
- `user_roles` (peran platform: buyer/seller/admin, bisa gabungan);
- `sellers` dan `seller_members` (toko dan staf);
- `reading_entitlements` (hak baca isi buku);
- `audit_logs` (jejak perubahan).

Untuk penggunaan pribadi cukup satu toko dengan satu `owner`, tetapi struktur sudah siap untuk banyak penjual dan pembeli.

---

## Fase 1 — MVP Katalog

Fokus:

- pengguna & kepemilikan koleksi;
- koleksi;
- agent;
- karya;
- edisi;
- eksemplar;
- lokasi;
- foto dasar;
- pencarian;
- dashboard jumlah koleksi.

Hasil:

- pengguna dapat mencatat dan menemukan buku;
- struktur karya, edisi, dan eksemplar sudah berjalan.

---

## Fase 2 — Manajemen Kondisi dan Nilai

Fokus:

- laporan kondisi;
- akuisisi;
- total modal;
- valuasi;
- dashboard nilai;
- notifikasi inspeksi;
- ekspor laporan.

Hasil:

- pengguna dapat memantau kesehatan dan nilai koleksi.

---

## Fase 3 — Provenance dan Dokumentasi

Fokus:

- provenance;
- sertifikat;
- kuitansi;
- checksum;
- kronologi;
- galeri;
- laporan per eksemplar.

Hasil:

- setiap buku memiliki dokumentasi historis yang lebih kuat.

---

## Fase 4 — Operasional Lanjutan

Tambahan tabel yang disarankan (autentikasi dasar sudah di fondasi):

- `roles` (bila perlu peran lebih rinci dari owner/editor/viewer);
- `permissions`;
- `location_history`;
- `loans`;
- `loan_condition_checks`;
- `restoration_projects`;
- `restoration_materials`;
- `market_comparables`;
- `notifications`.

Hasil:

- sistem dapat digunakan bersama kurator, konservator, atau anggota keluarga.

---

## Fase Marketplace — Jual-Beli dan Baca

Fokus:

- storefront penjual dan katalog publik;
- listing eksemplar fisik dan akses baca;
- keranjang, order, pembayaran, pengiriman;
- komisi platform dan pencairan dana penjual;
- hak baca otomatis setelah pembelian + preview gratis.

Hasil:

- pengguna dapat menjual, membeli, dan membaca buku dalam satu platform.

---

## Fase 5 — Sistem Kolektor Profesional

Tambahan:

- autentikasi tanda tangan;
- bibliographic fingerprint;
- collation detail;
- gathering dan signature;
- paper feature dan watermark;
- binding detail;
- pembanding pasar terstruktur;
- sensor suhu dan kelembapan;
- integrasi rumah lelang;
- laporan asuransi;
- analitik perkembangan harga.

---

# Titik Ekspansi Database

Tabel baru dapat ditambahkan tanpa mengubah relasi inti.

## Autentikasi

```text
authentications
├── copy_id
├── subject_type
├── examiner_agent_id
├── result
├── confidence
├── method
└── certificate_reference
```

## Restorasi

```text
restoration_projects
├── copy_id
├── conservator_agent_id
├── started_at
├── completed_at
├── method
├── materials
├── cost
└── result
```

## Pembanding Pasar

```text
market_comparables
├── edition_id
├── observed_date
├── source
├── asking_or_sold
├── amount
├── condition
└── source_url
```

## Histori Lokasi

```text
copy_location_history
├── copy_id
├── from_location_id
├── to_location_id
├── moved_at
├── reason
└── handled_by
```

## Peminjaman

```text
loans
├── copy_id
├── borrower_agent_id
├── checkout_date
├── due_date
├── returned_at
├── status
└── agreement_reference
```

## Kurs Mata Uang

```text
fx_rates
├── base_currency
├── quote_currency
├── rate_date
├── rate
└── source
```

Aturan:

- pasangan `base_currency`, `quote_currency`, dan `rate_date` bersifat unik;
- konversi biaya memakai kurs pada tanggal transaksi; bila tanggal persis tidak ada, gunakan kurs terbaru sebelum tanggal itu;
- kurs bersifat historis dan tidak ditimpa.

## Lingkungan

```text
environment_readings
├── storage_location_id
├── measured_at
├── temperature
├── relative_humidity
├── light
├── mold_observed
└── pest_observed
```

---

# Prioritas Pengembangan

Prioritas tinggi:

1. Katalog karya, edisi, dan copy.
2. Foto dan QR code.
3. Kondisi.
4. Akuisisi dan total modal.
5. Lokasi.
6. Pencarian dan filter.
7. Backup.

Prioritas menengah:

1. Valuasi.
2. Wishlist.
3. Provenance.
4. Laporan PDF.
5. Ekspor spreadsheet.
6. Notifikasi inspeksi.

Prioritas lanjutan:

1. Autentikasi.
2. Restorasi.
3. Sensor lingkungan.
4. Analitik harga.
5. Peminjaman.
6. Integrasi eksternal.

---

# Dashboard Analitik

Indikator yang dapat ditampilkan:

## Inventaris

- jumlah karya;
- jumlah edisi;
- jumlah eksemplar;
- jumlah duplikat;
- jumlah limited edition;
- distribusi bahasa;
- distribusi tahun;
- distribusi penerbit.

## Kondisi

- buku berdasarkan grade;
- buku berisiko aktif;
- buku dengan jamur;
- buku dengan kerusakan serangga;
- inspeksi jatuh tempo;
- perubahan skor kondisi.

## Finansial

- total modal;
- nilai pasar rendah;
- nilai pasar tengah;
- nilai pasar tinggi;
- nilai asuransi;
- potensi apresiasi;
- buku paling bernilai;
- buku dengan selisih nilai terbesar;
- laba atau rugi terealisasi dari penjualan;
- margin per buku terjual;
- total laba portofolio.

## Akuisisi

- pembelian per tahun;
- pembelian per kanal;
- penjual utama;
- rata-rata harga beli;
- total ongkir;
- total biaya restorasi awal.

## Wishlist

- jumlah target aktif;
- target prioritas tinggi;
- total anggaran wishlist;
- target yang ditemukan;
- konversi wishlist ke pembelian.

---

