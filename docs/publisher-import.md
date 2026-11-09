# Impor Data Penerbit

Data penerbit disimpan sebagai `agents` bertipe `organization`, lalu ditandai melalui `agent_roles` dengan role `publisher` dan/atau `printer`. Karena targetnya bisa ribuan entitas, pengisian lengkap sebaiknya dilakukan lewat CSV terkurasi, bukan input manual satu per satu.

## Sumber yang Disarankan

- Data ISBN/Perpusnas dan katalog Perpusnas untuk penerbit modern Indonesia.
- IKAPI atau direktori asosiasi penerbit untuk verifikasi nama legal, alamat, dan situs.
- Kolofon buku fisik, bibliografi, WorldCat/OCLC, dan katalog perpustakaan untuk penerbit lama atau historis.

Setiap baris sebaiknya memiliki `source_url` atau `source_note`. Jika data berasal dari OCR/kolofon dan belum pasti, gunakan `confidence_level=low` atau `medium`.

## Template CSV

Gunakan template:

```text
data/templates/publishers.csv.example
```

Batch impor awal yang sudah disiapkan dari Wikidata:

```text
data/import/publishers_wikidata_batch_001.csv
```

Batch ini berisi 130 entitas publisher bernegara Indonesia yang difilter konservatif untuk kebutuhan master penerbit. Tetap audit manual bila data akan dipakai sebagai data produksi final, karena Wikidata dapat mencampur penerbit buku, university press, dan penerbit jurnal.

Batch enrichment yang melengkapi detail dari Wikidata:

```text
data/import/publishers_wikidata_enrichment_002.csv
data/import/publishers_legal_name_enrichment_003.csv
```

Batch `002` melengkapi alias, tahun berdiri/tutup, website, kantor pusat, negara, deskripsi, dan catatan sumber. Batch `003` mengisi `legal_name` dari alias yang memiliki bentuk legal seperti `PT`, `CV`, atau `Yayasan`.

Batch resmi IKAPI:

```text
data/import/publishers_ikapi_members_2026_05_01.csv
```

Batch ini diambil dari halaman resmi **Anggota IKAPI, per 1 Mei 2026** melalui endpoint publik:

```text
https://www.ikapi.org/wp-json/custom-api/v1/anggota
```

Jumlah data dari endpoint saat pengambilan: 2.084 baris. Kolom yang tersedia dari IKAPI adalah nama penerbit, nomor anggota, masa KTA berakhir, dan status keanggotaan. Nomor anggota, masa KTA, dan status IKAPI disimpan di `source_note`.

Catatan penting: `status IKAPI` adalah status keanggotaan asosiasi, bukan selalu status operasional bisnis penerbit. Karena itu:

- `Aktif` dari IKAPI dipakai sebagai sinyal kuat untuk `agents.status=active`;
- `Tidak Aktif` tidak otomatis menjadi `inactive` atau `closed`; untuk agent baru importer akan menyimpannya sebagai `unknown` kecuali ada bukti lain.

Perpusnas ISBN saat ini dipakai sebagai sumber statistik resmi dan verifikasi bibliografis. Endpoint publik yang teridentifikasi menyediakan statistik agregat penerbit/ISBN, bukan daftar identitas penerbit lengkap yang bisa langsung diimpor dengan aman. Jika nanti Perpusnas menyediakan endpoint daftar penerbit atau dump resmi, batch itu bisa ditambahkan ke pipeline CSV yang sama.

Kolom wajib:

```text
authorized_name
```

Kolom penting yang disarankan:

```text
alternate_names, legal_name, brand_name, birth_or_founding_year,
death_or_dissolution_year, website_url, email, phone,
country_name, city_name, address, historical_period, imprint_names,
publisher_category, status, source_url, source_note, verified_at,
confidence_level, notes, roles
```

`roles` boleh dipisah dengan koma, titik koma, atau pipe. Jika kosong, importer otomatis memakai `publisher`.

Nilai `status` yang valid:

```text
active, inactive, closed, unknown
```

Untuk batch otomatis, jangan mengisi `active` kecuali ada sinyal operasional yang kuat seperti situs resmi aktif atau verifikasi manual. Gunakan `unknown` untuk penerbit historis/modern yang belum diverifikasi masih berjalan, dan `closed` untuk penerbit yang sudah bubar atau hanya relevan sebagai entitas historis.

Nilai `publisher_category` yang valid:

```text
trade_publisher, university_press, academic_publisher,
religious_publisher, media_group_publisher, government_publisher,
historical_publisher, printer, other
```

Jika kosong, importer akan menebak kategori dari nama, catatan, tahun berdiri, dan role. Untuk data produksi final, kategori hasil inferensi tetap perlu diaudit.

Nilai `confidence_level` yang valid:

```text
low, medium, high
```

## Cara Menjalankan

Dari folder `backend`:

```bash
make import-publishers FILE=../data/templates/publishers.csv.example
```

Contoh impor batch Wikidata:

```bash
make import-publishers FILE=../data/import/publishers_wikidata_batch_001.csv
make import-publishers FILE=../data/import/publishers_wikidata_enrichment_002.csv
make import-publishers FILE=../data/import/publishers_legal_name_enrichment_003.csv
```

Ambil ulang batch resmi IKAPI:

```bash
make fetch-ikapi-publishers OUT=../data/import/publishers_ikapi_members_2026_05_01.csv
```

Impor batch IKAPI:

```bash
make import-publishers FILE=../data/import/publishers_ikapi_members_2026_05_01.csv
```

Validasi tanpa menulis ke database:

```bash
go run ./cmd/import-publishers -file ../data/templates/publishers.csv.example -dry-run
```

Importer bersifat idempotent berdasarkan `authorized_name` + `agent_type=organization`: jika nama sudah ada, data yang masih kosong akan dilengkapi, kategori akan diisi jika belum ada, dan role akan di-upsert ke `agent_roles`.

Importer juga melakukan pencocokan nama ternormalisasi terhadap `authorized_name`, `alternate_names`, `legal_name`, dan `brand_name`. Variasi seperti awalan `Penerbit`, `PT`, `CV`, `N.V.`, atau `Yayasan` tidak otomatis membuat agent baru bila sudah cocok dengan agent yang ada.

Untuk batch Wikidata otomatis, importer akan menurunkan `status=active` menjadi `unknown` bila tidak ada website atau bukti operasional lain, kecuali data menunjukkan penerbit sudah tutup sehingga menjadi `closed`.

## Koreksi Duplikasi

Duplikasi konseptual dari batch seed/Wikidata dibersihkan melalui migrasi:

```text
backend/migrations/0003_clean_publisher_duplicates.sql
```

Mapping canonical yang dipakai:

```text
Djambatan          <- Penerbit Djambatan
Erlangga           <- Penerbit Erlangga
Kanisius           <- PT Kanisius
Mizan Pustaka      <- Mizan
Republika Penerbit <- penerbit Republika
Poestaka Rakjat    <- Pustaka Rakyat
```

Sebelum duplicate agent dihapus, role, sumber, alias, legal name, website, lokasi, catatan, dan relasi katalog dipindahkan ke agent canonical.

## Kategori & Status

Kategori penerbit dan koreksi status existing disimpan di migrasi:

```text
backend/migrations/0004_classify_publishers.sql
```

Prinsip status:

- `active`: ada sinyal operasional kuat, terutama website resmi atau kurasi manual.
- `closed`: ada tahun bubar atau entitas historis yang sudah tidak berjalan.
- `unknown`: belum cukup bukti untuk menyebut aktif atau tutup.

## Catatan Tempat

Kolom `country_id` dan `city_id` bisa diisi UUID dari tabel `places`. Jika hanya `country_name` atau `city_name` yang diisi, importer akan mencoba mencocokkan dengan `places.preferred_name`. Jika belum ada di master tempat, data penerbit tetap masuk tetapi field tempat dikosongkan dan importer menampilkan peringatan.
