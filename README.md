# Sistem Manajemen Koleksi Buku Tua, Langka, dan Bernilai

Dokumentasi desain database, fitur aplikasi, aturan bisnis, alur penggunaan, dan rencana pengembangan sistem koleksi buku pribadi yang sederhana namun tetap dapat dikembangkan menjadi platform katalog profesional.

---

## Ringkasan

Sistem ini dirancang untuk membantu kolektor mencatat, membedakan, memantau, dan menilai buku tua atau bernilai secara terstruktur.

Masalah utama yang diselesaikan adalah bahwa satu judul buku dapat memiliki banyak:

- edisi;
- cetakan;
- penerbit;
- percetakan;
- bahasa;
- jilid;
- varian sampul;
- kondisi fisik;
- riwayat kepemilikan;
- nilai pasar;
- eksemplar fisik.

Karena itu, sistem tidak menyimpan semua informasi dalam satu tabel besar. Fondasi datanya memisahkan tiga tingkat utama:

```text
Karya
└── Edisi / Cetakan / Varian
    └── Eksemplar fisik milik kolektor
```

Contoh:

```text
Karya:
Di Bawah Bendera Revolusi

Edisi:
Jilid I, penerbit tertentu, tahun 1964, cetakan tertentu

Eksemplar:
Buku fisik dengan kode BK-IND-0001, kondisi Good,
memiliki stempel pemilik lama, disimpan di Rak A-02
```

Pemisahan ini memungkinkan satu karya memiliki banyak edisi, dan satu edisi memiliki banyak eksemplar fisik dengan kondisi serta nilai yang berbeda.

---

## Tujuan Sistem

Sistem dikembangkan untuk:

1. Membuat katalog koleksi buku yang rapi dan dapat dicari.
2. Membedakan karya, edisi, cetakan, varian, dan eksemplar fisik.
3. Menyimpan informasi kondisi buku secara berkala.
4. Mencatat harga beli dan seluruh biaya akuisisi.
5. Menyimpan riwayat estimasi nilai pasar.
6. Mendokumentasikan provenance atau riwayat kepemilikan.
7. Menyimpan foto sampul, halaman judul, kerusakan, kuitansi, dan sertifikat.
8. Mengetahui posisi fisik buku pada ruang, lemari, rak, atau kotak.
9. Mengelola daftar buku buruan.
10. Menjadi fondasi untuk pengembangan fitur autentikasi, konservasi, lelang, peminjaman, dan dashboard investasi koleksi.

---

## Prinsip Desain

### Sederhana untuk digunakan

Pengguna tidak diwajibkan mengisi seluruh kolom saat pertama kali memasukkan buku. Data dapat dilengkapi secara bertahap.

### Tidak mencampur karya dengan benda fisik

Judul dan isi intelektual disimpan sebagai `works`, sedangkan buku yang benar-benar dimiliki disimpan sebagai `copies`.

### Riwayat tidak ditimpa

Kondisi dan valuasi disimpan sebagai catatan baru berdasarkan tanggal. Catatan lama tetap tersedia untuk melihat perubahan dari waktu ke waktu.

### Dapat dikembangkan tanpa mengubah fondasi

Tabel tambahan dapat dibuat di masa depan tanpa harus menggabungkan atau merombak tabel inti.

### Mendukung lebih dari satu koleksi

Satu sistem dapat menampung beberapa koleksi, misalnya:

- Koleksi Pribadi Utama;
- Koleksi Buku Sejarah;
- Koleksi Edisi Baca;
- Koleksi Keluarga;
- Koleksi Titipan;
- Koleksi yang disiapkan untuk dijual.

---

## Cakupan Fitur

### Pengguna, Peran, dan Hak Akses

Fondasi keamanan untuk marketplace multi-penjual. Model peran disusun tiga lapis.

Lapis platform (global, satu akun bisa punya beberapa):

- `guest` — lihat katalog publik dan halaman preview gratis;
- `buyer` — beli buku dan baca yang menjadi haknya (default semua akun);
- `seller` — punya storefront, kelola inventaris dan listing sendiri;
- `admin` — kelola platform, pengguna, dan moderasi.

Lapis toko (staf per penjual):

- `owner` — pemilik toko, kontrol penuh;
- `manager` — kelola listing, harga, dan order;
- `staff` — input katalog dan kondisi, tanpa akses harga atau dana.

Lapis hak baca (entitlement, bukan peran):

- hak membaca isi buku diberikan per edisi dari sumber `purchase`, `subscription`, `preview`, atau `grant`;
- preview gratis diatur lewat `editions.preview_free_pages`.

Tabel utama:

- `users`;
- `user_roles`;
- `sellers`;
- `seller_members`;
- `reading_entitlements`;
- `audit_logs`.

Koleksi kini dimiliki oleh toko melalui `collections.seller_id`. Untuk penggunaan pribadi, satu pengguna cukup menjadi `owner` dari satu toko tanpa listing publik.

---

### Manajemen Koleksi

Fitur:

- membuat beberapa koleksi;
- memberi kode unik pada setiap koleksi;
- menentukan mata uang utama;
- melihat jumlah buku per koleksi;
- memindahkan atau mengelompokkan eksemplar;
- memisahkan koleksi inti, koleksi baca, dan duplikat.

Tabel utama:

- `collections`;
- `copies`;
- `storage_locations`.

---

### Katalog Karya

Fitur:

- mencatat judul baku;
- mencatat judul asli;
- mencatat bahasa asli;
- mencatat tahun pertama karya diterbitkan;
- menentukan jenis karya;
- menulis ringkasan subjek;
- menulis abstrak;
- menjelaskan signifikansi sejarah;
- menghubungkan karya dengan penulis, editor, penerjemah, ilustrator, dan kontributor lain.

Tabel utama:

- `works`;
- `work_agents`;
- `agents`;
- `categories`;
- `work_categories`.

---

### Pengelolaan Edisi, Cetakan, dan Varian

Fitur:

- mencatat edisi;
- mencatat cetakan atau impression;
- mencatat issue;
- mencatat state;
- mencatat varian;
- mencatat tahun dan tempat terbit;
- mencatat bahasa edisi;
- mencatat jilid dan seri;
- mencatat ISBN;
- mencatat jumlah cetakan terbatas;
- mencatat jumlah halaman;
- mencatat ringkasan collation;
- mencatat dasar identifikasi edisi;
- menghubungkan edisi dengan penerbit, percetakan, distributor, dan penjilid.

Tabel utama:

- `editions`;
- `edition_agents`;
- `agents`.

---

### Inventaris Eksemplar Fisik

Fitur:

- memberi nomor inventaris;
- memberi accession number;
- membuat barcode;
- membuat QR code;
- mencatat nomor eksemplar pada limited edition;
- menentukan status buku;
- menentukan tingkat kepentingan koleksi;
- mencatat kelengkapan;
- mencatat keaslian binding;
- mencatat dust jacket dan slipcase;
- mencatat ukuran dan berat;
- mencatat lokasi buku saat ini.

Tabel utama:

- `copies`;
- `storage_locations`.

---

### Pemeriksaan Kondisi

Fitur:

- membuat laporan kondisi berkala;
- menyimpan grade kondisi;
- menyimpan skor kondisi;
- menilai sampul, punggung, jilidan, dan kertas;
- mencatat foxing;
- mencatat jamur;
- mencatat kerusakan serangga;
- mencatat bekas air;
- mencatat sobekan;
- mencatat tulisan atau tanda pada buku;
- menandai risiko aktif;
- menuliskan rekomendasi penanganan;
- menjadwalkan inspeksi berikutnya.

Tabel utama:

- `condition_reports`.

Setiap eksemplar dapat memiliki banyak laporan kondisi sehingga perubahan kondisi dapat dipantau.

---

### Akuisisi dan Modal

Fitur:

- mencatat pembelian;
- mencatat pembelian lelang;
- mencatat hadiah atau warisan;
- mencatat penjual;
- mencatat kanal transaksi;
- mencatat lokasi transaksi;
- mencatat nomor faktur;
- mencatat harga beli;
- mencatat ongkos kirim;
- mencatat pajak;
- mencatat buyer's premium;
- mencatat biaya restorasi awal;
- mencatat biaya tambahan;
- mencatat metode pembayaran;
- mencatat bukti transaksi.

Tabel utama:

- `acquisitions`;
- `agents`;
- `copies`.

Rumus total modal:

```text
Total Modal =
Harga Beli
+ Ongkos Kirim
+ Pajak
+ Biaya Lelang
+ Biaya Restorasi Awal
+ Biaya Lain
```

Total modal dapat dihitung oleh aplikasi tanpa disimpan sebagai kolom permanen.

---

### Penjualan dan Pelepasan

Pasangan simetris akuisisi, mencatat saat eksemplar dijual atau dilepas agar laba/rugi yang sebenarnya dapat dihitung.

Fitur:

- mencatat pembeli dan kanal penjualan;
- membedakan harga pasang (`asking_price`) dan harga terjual (`sale_price`);
- mencatat biaya jual: fee platform, ongkir, pajak, biaya lain;
- menghitung hasil bersih dan laba/rugi terealisasi;
- menampilkan harga jual minimum (titik impas) agar tidak rugi.

Tabel utama:

- `disposals`;
- `agents`;
- `copies`.

---

### Marketplace (Jual-Beli)

Platform jual-beli multi-penjual yang menyambungkan penjual, pembeli, pembayaran, dan hak baca.

Fitur:

- penjual memasang listing: eksemplar fisik atau akses baca edisi;
- pembeli memesan lintas toko;
- pembayaran, pengiriman, dan pencairan dana penjual;
- komisi platform per transaksi;
- pembelian fisik otomatis mencatat `disposals`; pembelian akses baca otomatis memberi `reading_entitlements`.

Tabel utama:

- `listings`;
- `orders`;
- `order_items`;
- `payments`;
- `shipments`;
- `payouts`.

Rincian pada [Modul Marketplace](docs/marketplace.md).

---

### Valuasi dan Harga Pasar

Fitur:

- mencatat estimasi nilai rendah;
- mencatat estimasi nilai tengah;
- mencatat estimasi nilai tinggi;
- mencatat nilai asuransi;
- membedakan estimasi pribadi, dealer, lelang, ahli, dan harga realisasi;
- mencatat tren pasar;
- mencatat tingkat likuiditas;
- mencatat dasar penilaian;
- mencatat sumber pembanding;
- memberi masa berlaku penilaian.

Tabel utama:

- `valuations`;
- `agents`;
- `copies`.

Satu eksemplar dapat memiliki banyak valuasi sehingga perkembangan nilai buku dapat dilihat berdasarkan waktu.

---

### Provenance

Provenance adalah riwayat kepemilikan, perpindahan, atau keterkaitan historis sebuah buku.

Fitur:

- mencatat pemilik sebelumnya;
- mencatat pihak yang menyerahkan atau menerima;
- mencatat pembelian, hadiah, warisan, lelang, atau transfer;
- mencatat periode kepemilikan;
- mencatat tempat;
- menyimpan ringkasan bukti;
- menyimpan status verifikasi;
- menyimpan tingkat keyakinan;
- menyusun kronologi dengan nomor urut.

Tabel utama:

- `provenance_events`;
- `agents`;
- `copies`.

Contoh:

| Urutan | Peristiwa | Pemilik | Periode | Bukti |
|---:|---|---|---|---|
| 1 | Dimiliki | A. Soedarmo | 1964–1978 | Tanda tangan |
| 2 | Transfer | Perpustakaan X | 1978–2005 | Stempel |
| 3 | Dibeli | Kolektor Y | 2005–2026 | Kuitansi |
| 4 | Dibeli | Koleksi saat ini | 2026–sekarang | Bukti transaksi |

---

### Dokumentasi Foto dan Berkas

Fitur:

- foto sampul depan;
- foto sampul belakang;
- foto punggung;
- foto halaman judul;
- foto halaman hak cipta;
- foto daftar isi;
- foto halaman terakhir;
- foto tanda tangan;
- foto stempel;
- foto kerusakan;
- unggahan kuitansi;
- unggahan sertifikat;
- checksum untuk mendeteksi file duplikat atau perubahan file.

Tabel utama:

- `media_assets`.

Rekomendasi pola nama file:

```text
BK-IND-0001_cover-front.jpg
BK-IND-0001_cover-back.jpg
BK-IND-0001_spine.jpg
BK-IND-0001_title-page.jpg
BK-IND-0001_copyright-page.jpg
BK-IND-0001_signature-01.jpg
BK-IND-0001_damage-p125.jpg
BK-IND-0001_receipt.pdf
```

File tidak sebaiknya disimpan langsung sebagai binary besar di database. Database menyimpan metadata dan lokasi penyimpanan file.

---

### Lokasi Penyimpanan

Fitur:

- membuat struktur lokasi bertingkat;
- menyimpan ruang;
- menyimpan lemari;
- menyimpan rak;
- menyimpan kotak;
- menandai lokasi dengan pengendalian iklim;
- menandai lokasi aman;
- menentukan lokasi buku saat ini.

Tabel `storage_locations` menggunakan relasi terhadap dirinya sendiri melalui `parent_location_id`.

Contoh hierarki:

```text
Ruang Koleksi
└── Lemari A
    └── Rak A-02
        └── Kotak BOX-04
```

---

### Daftar Buruan

Fitur:

- mencatat judul target;
- menghubungkan target ke karya yang sudah ada;
- mencatat edisi yang diinginkan;
- mencatat cetakan yang diinginkan;
- mencatat tahun target;
- mencatat penerbit target;
- menentukan kondisi minimum;
- menentukan anggaran maksimum;
- memberi prioritas;
- mencatat status pencarian;
- mengumpulkan banyak penawaran per target dari toko, olshop, atau sosmed berbeda;
- membandingkan harga, kondisi, dan ketersediaan antar penawaran;
- menyimpan foto/screenshot tiap penawaran;
- menandai penawaran terpilih untuk dibeli.

Tabel utama:

- `wishlists`;
- `wishlist_offers`;
- `wishlist_offer_media`;
- `works`;
- `collections`.

---

## Arsitektur Data

### Diagram Konseptual

```mermaid
erDiagram
    COLLECTIONS ||--o{ COPIES : contains
    COLLECTIONS ||--o{ STORAGE_LOCATIONS : owns
    COLLECTIONS ||--o{ WISHLISTS : has

    WORKS ||--o{ EDITIONS : has
    WORKS ||--o{ WORK_AGENTS : credits
    AGENTS ||--o{ WORK_AGENTS : participates
    WORKS ||--o{ WORK_CATEGORIES : classified_as
    CATEGORIES ||--o{ WORK_CATEGORIES : groups
    CATEGORIES ||--o{ CATEGORIES : contains

    EDITIONS ||--o{ EDITION_AGENTS : involves
    AGENTS ||--o{ EDITION_AGENTS : participates
    EDITIONS ||--o{ COPIES : represented_by

    STORAGE_LOCATIONS ||--o{ STORAGE_LOCATIONS : contains
    STORAGE_LOCATIONS ||--o{ COPIES : stores

    COPIES ||--o{ CONDITION_REPORTS : inspected_by
    COPIES ||--o{ ACQUISITIONS : acquired_through
    COPIES ||--o{ DISPOSALS : sold_through
    COPIES ||--o{ VALUATIONS : valued_by
    COPIES ||--o{ PROVENANCE_EVENTS : has_history
    COPIES ||--o{ MEDIA_ASSETS : documented_by

    AGENTS ||--o{ ACQUISITIONS : seller
    AGENTS ||--o{ DISPOSALS : buyer
    AGENTS ||--o{ VALUATIONS : appraiser
    AGENTS ||--o{ PROVENANCE_EVENTS : participant

    WORKS ||--o{ WISHLISTS : targeted_by
    WISHLISTS ||--o{ WISHLIST_OFFERS : has_offers
    WISHLIST_OFFERS ||--o{ WISHLIST_OFFER_MEDIA : documented_by

    USERS ||--o{ USER_ROLES : has_roles
    USERS ||--o{ SELLERS : owns
    SELLERS ||--o{ SELLER_MEMBERS : staffed_by
    USERS ||--o{ SELLER_MEMBERS : works_at
    SELLERS ||--o{ COLLECTIONS : owns
    USERS ||--o{ READING_ENTITLEMENTS : entitled
    EDITIONS ||--o{ READING_ENTITLEMENTS : grants_access

    SELLERS ||--o{ LISTINGS : offers
    COPIES ||--o{ LISTINGS : listed_as
    USERS ||--o{ ORDERS : buys
    SELLERS ||--o{ ORDERS : fulfills
    ORDERS ||--o{ ORDER_ITEMS : contains
    LISTINGS ||--o{ ORDER_ITEMS : sold_as
    ORDERS ||--o{ PAYMENTS : paid_by
    ORDERS ||--o{ SHIPMENTS : shipped_via
    SELLERS ||--o{ PAYOUTS : receives
```

Modul Reader (`book_pages`, `book_chapters`, `ai_analyses`, `book_entity_mentions`, `places`) menempel pada `copies`/`editions` dan dibahas terpisah pada [Modul Reader dan Analisis AI](docs/reader-module.md).

---

### Relasi Utama

### Karya ke Edisi

```text
works 1 ─── N editions
```

Satu karya dapat memiliki banyak edisi.

### Edisi ke Eksemplar

```text
editions 1 ─── N copies
```

Satu edisi dapat dimiliki dalam lebih dari satu eksemplar fisik.

### Eksemplar ke Kondisi

```text
copies 1 ─── N condition_reports
```

Laporan kondisi bersifat historis.

### Eksemplar ke Valuasi

```text
copies 1 ─── N valuations
```

Nilai buku dapat berubah dan tidak boleh ditimpa.

### Eksemplar ke Provenance

```text
copies 1 ─── N provenance_events
```

Riwayat disusun menggunakan `sequence_no`.

### Koleksi ke Lokasi

```text
collections 1 ─── N storage_locations
```

Lokasi dapat memiliki lokasi induk.

---

## Daftar Tabel

| No. | Tabel | Kelompok | Fungsi Utama |
|---:|---|---|---|
| 1 | `collections` | Inti | Identitas koleksi |
| 2 | `agents` | Inti | Orang dan organisasi |
| 3 | `works` | Inti | Karya atau judul intelektual |
| 4 | `work_types` | Inti | Master jenis/bentuk benda (buku, atlas, surat) |
| 5 | `author_profiles` | Inti | Detail halaman penulis (bio, foto, sosial) |
| 6 | `work_agents` | Inti | Relasi karya dengan kontributor |
| 7 | `categories` | Inti | Master kategori/subjek (hierarkis) |
| 8 | `work_categories` | Inti | Relasi karya dengan kategori |
| 9 | `editions` | Inti | Versi penerbitan |
| 10 | `edition_agents` | Inti | Relasi edisi dengan penerbit/percetakan |
| 11 | `storage_locations` | Inti | Struktur ruang, lemari, rak, kotak |
| 12 | `copies` | Inti | Eksemplar fisik yang dimiliki |
| 13 | `condition_reports` | Inti | Riwayat pemeriksaan kondisi |
| 14 | `acquisitions` | Inti | Riwayat perolehan dan biaya (beli) |
| 15 | `disposals` | Inti | Riwayat pelepasan dan biaya (jual) |
| 16 | `valuations` | Inti | Riwayat nilai dan estimasi harga |
| 17 | `provenance_events` | Inti | Kronologi kepemilikan |
| 18 | `media_assets` | Inti | Metadata foto dan dokumen |
| 19 | `wishlists` | Inti | Target buku buruan |
| 20 | `wishlist_offers` | Inti | Penawaran per target dari banyak toko |
| 21 | `wishlist_offer_media` | Inti | Foto/screenshot penawaran |
| 22 | `languages` | Master | Master bahasa (ISO 639) |
| 23 | `places` | Master | Master tempat (kota/wilayah/negara) |
| 24 | `shipping_carriers` | Master | Master kurir pengiriman |
| 25 | `payment_methods` | Master | Master metode pembayaran |
| 26 | `sales_channels` | Master | Master kanal transaksi |
| 27 | `fx_rates` | Pendukung | Kurs mata uang harian |
| 28 | `users` | Fondasi | Akun pengguna |
| 29 | `user_roles` | Fondasi | Peran platform (buyer/seller/admin) |
| 30 | `sellers` | Fondasi | Storefront/toko penjual |
| 31 | `seller_members` | Fondasi | Staf toko dan peran |
| 32 | `reading_entitlements` | Fondasi | Hak baca isi buku per pengguna |
| 33 | `audit_logs` | Fondasi | Jejak audit perubahan |
| 34 | `listings` | Marketplace | Penawaran jual (copy fisik / akses baca) |
| 35 | `orders` | Marketplace | Transaksi beli |
| 36 | `order_items` | Marketplace | Baris item dalam order |
| 37 | `payments` | Marketplace | Pembayaran pembeli |
| 38 | `shipments` | Marketplace | Pengiriman item fisik |
| 39 | `payouts` | Marketplace | Pencairan dana penjual |
| 40 | `book_pages` | Modul Reader | OCR, koreksi, terjemahan per halaman |
| 41 | `book_chapters` | Modul Reader | Batas bab dan ringkasan |
| 42 | `ai_analyses` | Modul Reader | Hasil analisis AI (dapat dilacak) |
| 43 | `book_entity_mentions` | Modul Reader | Nama/tempat yang muncul di teks |

---

## Dokumentasi Lengkap

Dokumen desain terperinci dipecah ke folder `docs/`:

- [Kamus Data / Dokumentasi Tabel](docs/data-dictionary.md)
- [Enumerasi](docs/enumerations.md)
- [Aturan Bisnis](docs/business-rules.md)
- [Alur Kerja Utama](docs/workflows.md)
- [Tampilan Aplikasi & Pencarian](docs/ui.md)
- [Data Turunan dan Perhitungan](docs/computed.md)
- [API yang Disarankan](docs/api.md)
- [Struktur Proyek & Teknologi](docs/architecture.md)
- [Keamanan & Backup](docs/security-backup.md)
- [Pengujian & Migrasi Data](docs/testing-migration.md)
- [Roadmap, Ekspansi & Dashboard](docs/roadmap.md)
- [Modul Marketplace (Jual-Beli)](docs/marketplace.md)
- [Contoh Data & File Desain](docs/examples.md)
- [Modul Reader dan Analisis AI](docs/reader-module.md)

Desain skema fisik tersedia di [`dbdiagram-koleksi-buku-sederhana-ekstensibel.dbml`](dbdiagram-koleksi-buku-sederhana-ekstensibel.dbml).

# Kesimpulan

Desain ini sengaja dibuat tidak terlalu besar untuk tahap awal, tetapi tetap memakai struktur yang benar.

Fondasi yang harus dipertahankan adalah:

```text
works
└── editions
    └── copies
```

Selama tiga lapisan tersebut tidak digabung, sistem dapat dikembangkan dari katalog pribadi menjadi:

- sistem inventaris kolektor;
- katalog buku langka;
- sistem dokumentasi provenance;
- sistem konservasi;
- sistem valuasi;
- katalog perpustakaan khusus;
- platform penjualan atau lelang;
- dashboard investasi koleksi.

Skema terdiri dari 17 tabel inti, tabel pendukung (`fx_rates`), fondasi identitas (`users`, `user_roles`, `sellers`, `seller_members`, `reading_entitlements`, `audit_logs`), modul marketplace (`listings`, `orders`, `order_items`, `payments`, `shipments`, `payouts`), dan modul reader — total 43 tabel. Fitur baru sebaiknya ditambahkan sebagai modul dan tabel terpisah, bukan dengan terus menambah kolom pada `copies`.

---

## Status Dokumen

- Jenis: dokumentasi teknis dan fungsional
- Database target: relasional
- Rekomendasi implementasi: PostgreSQL
- Format desain: DBML
- Karakter desain: sederhana, modular, dan extensible
