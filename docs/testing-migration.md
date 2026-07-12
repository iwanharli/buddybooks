# Pengujian

## Unit Test

- validasi total modal;
- validasi urutan valuasi;
- validasi skor kondisi;
- validasi kode unik;
- validasi rentang nilai;
- validasi lokasi.

## Integration Test

- membuat karya hingga eksemplar;
- menambahkan kondisi;
- menambahkan valuasi;
- mengunggah media;
- mengubah wishlist menjadi copy;
- memindahkan lokasi.

## End-to-End Test

- pengguna menambahkan buku baru;
- pengguna memindai QR code;
- pengguna melakukan inspeksi;
- pengguna mencari buku berdasarkan penerbit;
- pengguna melihat nilai koleksi;
- pengguna memulihkan data dari backup.

---

# Data Awal dan Migrasi

## Import dari Spreadsheet

Kolom minimum spreadsheet:

```text
inventory_code
preferred_title
author
publisher
publication_year
edition_statement
impression_statement
condition_grade
purchase_price
current_location
```

Proses import:

1. normalisasi judul;
2. normalisasi agent;
3. deduplikasi karya;
4. deduplikasi edisi;
5. buat eksemplar;
6. buat acquisition;
7. buat condition report;
8. buat lokasi;
9. validasi hasil.

Import tidak boleh langsung memasukkan semua baris tanpa proses deduplikasi.

---

## Data Lama yang Tidak Lengkap

Gunakan prinsip:

- kosong berarti tidak diketahui;
- jangan mengisi dugaan sebagai fakta;
- gunakan `notes` untuk asumsi;
- gunakan status `uncertain` bila kelengkapan belum diperiksa;
- gunakan `identification_status` untuk tingkat kepastian edisi.

---

