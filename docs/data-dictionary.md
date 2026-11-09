# Dokumentasi Tabel

## `users`

Akun pengguna untuk autentikasi. Menyimpan hash password, bukan password polos.

| Kolom | Fungsi |
|---|---|
| `email` | Identitas login, unik |
| `display_name` | Nama tampilan |
| `password_hash` | Hash kredensial |
| `is_active` | Status aktif |
| `last_login_at` | Login terakhir |

## `user_roles`

Peran platform global. Satu pengguna dapat memiliki beberapa peran sekaligus, misalnya `seller` dan `buyer`.

| Kolom | Fungsi |
|---|---|
| `user_id` | Pengguna |
| `role` | `guest`, `buyer`, `seller`, atau `admin` |

Aturan:

- setiap akun terdaftar minimal memiliki `buyer`;
- `guest` untuk pengunjung belum login (dapat implisit, tanpa baris);
- `admin` untuk pengelola platform dan moderasi.

## `sellers`

Storefront atau toko. Marketplace bersifat multi-penjual, sehingga tiap penjual memiliki toko dan inventaris sendiri.

| Kolom | Fungsi |
|---|---|
| `owner_user_id` | Pemilik utama toko |
| `shop_name` | Nama toko |
| `shop_slug` | Identitas URL toko, unik |
| `is_active` | Status aktif |

## `seller_members`

Staf sebuah toko beserta perannya.

| Kolom | Fungsi |
|---|---|
| `seller_id` | Toko |
| `user_id` | Pengguna |
| `role` | `owner`, `manager`, atau `staff` |

Aturan:

- `owner` kontrol penuh toko;
- `manager` mengelola listing, harga, dan order;
- `staff` menginput katalog dan kondisi, tidak dapat mengubah harga atau menarik dana.

## `reading_entitlements`

Hak membaca isi buku (modul reader) pada tingkat edisi. Hak ini adalah entitlement, bukan peran, karena pembeli hanya boleh membaca buku yang menjadi haknya.

| Kolom | Fungsi |
|---|---|
| `user_id` | Pemilik hak baca |
| `edition_id` | Edisi yang boleh dibaca |
| `source` | `purchase`, `subscription`, `preview`, atau `grant` |
| `granted_at` | Waktu diberikan |
| `expires_at` | Kedaluwarsa opsional; null berarti permanen |

Preview gratis diatur pada `editions.preview_free_pages`: sejumlah halaman awal dapat dibaca tanpa entitlement, sisanya memerlukan pembelian atau langganan.

## `audit_logs`

Menyimpan jejak perubahan untuk data bernilai. Mendukung aturan bisnis yang melarang penghapusan tanpa alasan audit.

| Kolom | Fungsi |
|---|---|
| `user_id` | Pelaku perubahan; null untuk proses sistem |
| `action` | `create`, `update`, `delete`, atau `restore` |
| `entity_table` | Tabel yang diubah |
| `entity_id` | Baris yang diubah |
| `changes_json` | Ringkasan before/after |
| `reason` | Wajib untuk penghapusan pada tabel bernilai |

## `collections`

Menampung koleksi atau kelompok inventaris.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `id` | Primary key |
| `name` | Nama koleksi |
| `code` | Kode unik koleksi |
| `description` | Keterangan koleksi |
| `default_currency` | Mata uang utama |
| `created_at` | Tanggal dibuat |
| `updated_at` | Tanggal diperbarui |

Aturan:

- `code` harus unik.
- Kode sebaiknya pendek dan stabil.
- Mata uang menggunakan kode tiga karakter seperti `IDR`, `USD`, atau `EUR`.

Contoh:

```text
code: IND-HIS
name: Koleksi Sejarah Indonesia
```

---

## `agents`

Menampung seluruh pihak yang berkaitan dengan buku.

Agent dapat berupa:

- orang;
- organisasi.

Contoh orang:

- penulis;
- editor;
- penerjemah;
- ilustrator;
- pemilik sebelumnya;
- penjual;
- penilai;
- kolektor.

Contoh organisasi:

- penerbit;
- percetakan;
- distributor;
- rumah lelang;
- toko buku;
- perpustakaan;
- lembaga konservasi.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `agent_type` | Jenis agent |
| `authorized_name` | Nama baku |
| `alternate_names` | Nama alternatif |
| `legal_name` | Nama legal organisasi, bila berbeda dari nama tampil |
| `brand_name` | Nama dagang/imprint yang umum dipakai |
| `birth_or_founding_year` | Tahun lahir atau berdiri |
| `death_or_dissolution_year` | Tahun wafat atau bubar |
| `website_url` | Situs resmi atau rujukan web |
| `email` | Kontak email |
| `phone` | Kontak telepon |
| `country_id` | Negara asal/operasi utama, relasi ke `places` |
| `city_id` | Kota asal/operasi utama, relasi ke `places` |
| `address` | Alamat bebas |
| `historical_period` | Periode aktif atau konteks historis singkat |
| `imprint_names` | Nama imprint/label terbitan terkait |
| `publisher_category` | Kategori khusus penerbit/percetakan, jika agent berperan sebagai publisher/printer |
| `predecessor_agent_id` | Organisasi pendahulu, bila ada |
| `successor_agent_id` | Organisasi penerus, bila ada |
| `status` | `active`, `inactive`, `closed`, atau `unknown` |
| `source_url` | Sumber rujukan utama |
| `source_note` | Catatan sumber data |
| `verified_at` | Tanggal verifikasi data |
| `confidence_level` | Tingkat keyakinan data: `low`, `medium`, `high` |
| `notes` | Catatan tambahan |

Nilai `publisher_category`:

- `trade_publisher`: penerbit umum/komersial;
- `university_press`: penerbit universitas;
- `academic_publisher`: penerbit akademik/lembaga ilmiah;
- `religious_publisher`: penerbit keagamaan atau berbasis komunitas agama;
- `media_group_publisher`: penerbit di bawah grup media;
- `government_publisher`: penerbit/percetakan pemerintah atau BUMN historis;
- `historical_publisher`: penerbit historis, kolonial, atau tidak cukup relevan sebagai entitas operasional modern;
- `printer`: percetakan yang belum tentu berperan sebagai penerbit;
- `other`: kategori lain yang belum masuk taksonomi.

Contoh:

```text
authorized_name: Soekarno
alternate_names: Sukarno; Ir. Soekarno; Bung Karno
agent_type: person
```

---

## `agent_roles`

Tabel ini menandai peran umum sebuah `agent`. Satu agent dapat punya banyak role, misalnya satu organisasi bisa menjadi `publisher`, `printer`, sekaligus `seller`. Menu **Penerbit** di aplikasi memakai tabel ini untuk mengambil agent dengan role `publisher` atau `printer`, bukan semua organisasi.

Nilai role utama:

- `publisher`;
- `printer`;
- `distributor`;
- `binder`;
- `author`;
- `editor`;
- `translator`;
- `seller`;
- `appraiser`;
- `previous_owner`;
- `institution`;
- `collector`;
- `other`.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `agent_id` | Relasi ke `agents` |
| `role` | Peran umum agent |
| `source_note` | Catatan sumber/asal penetapan role |

Relasi ini berbeda dari `work_agents` dan `edition_agents`: `agent_roles` menjelaskan kapabilitas/identitas umum agent, sedangkan `work_agents` dan `edition_agents` menjelaskan peran agent pada karya atau edisi tertentu.

Menu master **Pelaku** memakai subset `agents.agent_type = 'person'` dengan role kreator buku (`author`, `editor`, `translator`, `illustrator`, `compiler`, `contributor`). Menu **Penerbit** memakai organisasi dengan role `publisher` atau `printer`.

---

## `author_profiles`

Tidak ada tabel khusus untuk penulis: penulis, editor, penerjemah, dan penerbit semua disimpan sebagai `agents`, lalu ditandai dengan `agent_roles` serta relasi spesifik di `work_agents` atau `edition_agents`. Ini menghindari duplikasi karena satu pihak bisa memiliki lebih dari satu peran.

`author_profiles` adalah tabel ekstensi opsional yang menyimpan detail khusus untuk halaman penulis di marketplace, terpisah dari `agents` karena atribut ini tidak relevan untuk peran lain seperti penerbit atau percetakan.

| Kolom | Fungsi |
|---|---|
| `agent_id` | Relasi ke `agents`, satu profil per agent |
| `bio_long` | Biografi panjang untuk halaman penulis |
| `photo_asset_id` | Foto profil |
| `website_url` | Situs pribadi |
| `social_links` | Tautan media sosial (JSON) |
| `is_featured` | Ditampilkan sebagai penulis unggulan |

Aturan:

- baris ini opsional; agent tanpa profil tetap valid sebagai penulis biasa;
- profil hanya bermakna bila `agents.agent_type = 'person'`, meski tidak dipaksakan di database.

---

## `works`

Menyimpan karya secara konseptual dan tidak bergantung pada penerbit atau cetakan.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `work_code` | Kode unik karya |
| `preferred_title` | Judul baku |
| `original_title` | Judul asli |
| `original_language` | Bahasa karya pertama |
| `first_publication_year` | Tahun terbit pertama |
| `work_type_id` | Bentuk/jenis benda; relasi ke `work_types` |
| `subject_summary` | Ringkasan topik |
| `abstract` | Ringkasan isi |
| `historical_significance` | Nilai sejarah |
| `notes` | Catatan |

Jenis benda tidak lagi berupa teks bebas, melainkan mengacu ke master `work_types`.

---

## `work_types`

Master bentuk atau jenis benda. Koleksi tidak hanya buku, sehingga jenis ini terkontrol dan dapat dikelola.

| Kolom | Fungsi |
|---|---|
| `code` | Kode unik, mis. `book`, `atlas`, `map`, `letter` |
| `name` | Nama tampilan, mis. Buku, Atlas, Surat |
| `description` | Keterangan |

Contoh isi seed: Buku, Monograf, Pamflet, Majalah/Berkala, Surat Kabar, Manuskrip, Atlas, Peta, Katalog, Laporan, Terbitan Resmi, Surat/Dokumen, Kertas/Lembaran Lepas, Foto, Poster, Kartu Pos, Cetak/Litografi, Lainnya.

---

## Master referensi lainnya

Beberapa nilai yang sebelumnya teks bebas kini menjadi master terkontrol dengan relasi:

| Master | Dipakai oleh | Kolom |
|---|---|---|
| `languages` (ISO 639) | works, editions, book_pages | `original_language_id`, `language_id`, `source_language_id` |
| `places` | editions, edition_agents, acquisitions, provenance_events | `publication_place_id`, `publication_country_id`, `place_id`, `transaction_place_id` |
| `shipping_carriers` | shipments | `carrier_id` |
| `payment_methods` | acquisitions, payments | `payment_method_id` |
| `sales_channels` | acquisitions, disposals | `sales_channel_id` |

Tiap master minimal berisi `code` (unik) dan `name`. Ini menjaga konsistensi (mis. "Belanda" tidak tercatat sebagai "belanda"/"Dutch") dan memudahkan filter.

Selain itu, `valuations.market_trend` dan `valuations.liquidity_level` kini dibatasi `CHECK` (lihat [Enumerasi](enumerations.md)).

---

## `work_agents`

Tabel penghubung many-to-many antara karya dan agent.

Satu karya dapat mempunyai beberapa penulis, editor, penerjemah, atau kontributor.

Kolom:

| Kolom | Fungsi |
|---|---|
| `work_id` | Relasi ke karya |
| `agent_id` | Relasi ke orang atau organisasi |
| `role` | Peran |
| `role_note` | Keterangan peran |
| `sequence_no` | Urutan penampilan |

Nilai `role`:

- `author`;
- `editor`;
- `translator`;
- `compiler`;
- `illustrator`;
- `contributor`;
- `other`.

Index unik mencegah agent dengan peran sama dicatat dua kali pada karya yang sama.

---

## `categories`

Master kategori atau subjek buku (Sejarah, Politik, Agama, dan sebagainya). Digunakan untuk penelusuran katalog di marketplace. Bersifat hierarkis melalui `parent_id`, misalnya Sejarah → Sejarah Indonesia → Kemerdekaan.

| Kolom | Fungsi |
|---|---|
| `parent_id` | Kategori induk; null untuk akar |
| `name` | Nama kategori |
| `slug` | Identitas URL/filter, unik |
| `description` | Keterangan |

Aturan:

- kategori menempel pada karya (`works`), bukan eksemplar, karena topik adalah sifat karya;
- hierarki tidak boleh membentuk siklus (ditegakkan trigger di DDL).

## `work_categories`

Tabel penghubung many-to-many antara karya dan kategori. Satu karya dapat masuk beberapa kategori, misalnya Sejarah dan Politik sekaligus.

| Kolom | Fungsi |
|---|---|
| `work_id` | Karya |
| `category_id` | Kategori |

Pasangan `work_id` dan `category_id` bersifat unik.

---

## `editions`

Menyimpan versi penerbitan tertentu dari sebuah karya.

Perbedaan yang dicatat dapat meliputi:

- edisi;
- cetakan;
- issue;
- state;
- varian;
- tahun;
- penerbit;
- bahasa;
- jilid;
- seri.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `work_id` | Karya induk |
| `edition_code` | Kode unik edisi |
| `edition_statement` | Pernyataan edisi |
| `impression_statement` | Pernyataan cetakan |
| `issue_statement` | Issue |
| `state_statement` | State |
| `variant_statement` | Varian |
| `publication_city` | Kota terbit |
| `publication_country` | Negara terbit |
| `publication_year` | Tahun terbit |
| `copyright_year` | Tahun hak cipta |
| `language` | Bahasa edisi |
| `volume_label` | Jilid atau volume |
| `series_title` | Nama seri |
| `series_number` | Nomor seri |
| `isbn` | ISBN bila tersedia |
| `limited_edition` | Apakah edisi terbatas |
| `stated_print_run` | Jumlah cetak yang dinyatakan |
| `total_pages` | Jumlah halaman |
| `collation_summary` | Ringkasan susunan fisik |
| `identification_status` | Status identifikasi |
| `identification_basis` | Dasar penentuan versi |

Contoh status identifikasi:

- `unreviewed`;
- `initial`;
- `probable`;
- `verified`;
- `disputed`.

Contoh `collation_summary`:

```text
xvi, 674 hlm., 24 pelat foto, 1 peta lipat
```

---

## `edition_agents`

Tabel penghubung edisi dengan organisasi atau pihak terkait proses penerbitan.

Nilai `role`:

- `publisher`;
- `printer`;
- `distributor`;
- `binder`;
- `other`.

Contoh:

```text
edition: DBBR Jilid I 1964
agent: Panitia Penerbit Di Bawah Bendera Revolusi
role: publisher
place_name: Jakarta
```

---

## `storage_locations`

Menyimpan struktur lokasi fisik secara bertingkat.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `collection_id` | Koleksi pemilik lokasi |
| `parent_location_id` | Lokasi induk |
| `code` | Kode unik |
| `location_type` | Jenis lokasi |
| `name` | Nama lokasi |
| `climate_controlled` | Apakah kondisi lingkungan dikontrol |
| `secure` | Apakah lokasi aman |

Contoh `location_type`:

- building;
- room;
- cabinet;
- shelf;
- box;
- display_case;
- vault.

Aturan:

- kode lokasi unik per koleksi;
- lokasi anak harus berada pada koleksi yang sama dengan lokasi induk;
- buku sebaiknya ditempatkan pada lokasi paling spesifik.

---

## `copies`

Merupakan pusat inventaris dan menyimpan setiap buku fisik.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `collection_id` | Koleksi pemilik |
| `edition_id` | Edisi yang diwakili |
| `current_location_id` | Lokasi saat ini |
| `inventory_code` | Nomor inventaris |
| `accession_number` | Nomor masuk |
| `barcode_value` | Barcode |
| `qr_value` | Isi QR code |
| `copy_number_statement` | Nomor eksemplar |
| `copy_status` | Status buku |
| `collection_grade` | Kelas kepentingan |
| `completeness_status` | Kelengkapan |
| `is_binding_original` | Keaslian jilid |
| `binding_description` | Deskripsi penjilidan |
| `cover_description` | Deskripsi sampul |
| `dust_jacket_present` | Keberadaan dust jacket |
| `slipcase_present` | Keberadaan slipcase |
| `height_mm` | Tinggi |
| `width_mm` | Lebar |
| `thickness_mm` | Tebal |
| `weight_grams` | Berat |
| `private_notes` | Catatan internal |
| `acquired_at` | Tanggal diperoleh |

Nilai `copy_status`:

- `owned`;
- `incoming`;
- `on_loan`;
- `under_restoration`;
- `sold`;
- `lost`;
- `deaccessioned`.

Nilai `collection_grade`:

- `core`;
- `important`;
- `supporting`;
- `reading`;
- `duplicate`.

---

## `condition_reports`

Menyimpan setiap hasil pemeriksaan kondisi.

Grade kondisi:

- `mint`;
- `fine`;
- `very_good`;
- `good`;
- `fair`;
- `poor`.

Rekomendasi interpretasi:

| Grade | Interpretasi |
|---|---|
| Mint | Hampir tanpa cacat |
| Fine | Sangat baik dengan cacat sangat kecil |
| Very Good | Baik dengan tanda usia ringan |
| Good | Lengkap, tetapi terdapat keausan nyata |
| Fair | Masih utuh tetapi memiliki kerusakan signifikan |
| Poor | Rusak berat atau tidak lengkap |

Skor kondisi dapat menggunakan nilai 0–100.

Contoh bobot:

| Komponen | Bobot |
|---|---:|
| Kelengkapan | 25% |
| Jilidan | 20% |
| Sampul | 15% |
| Kertas | 15% |
| Bebas jamur dan hama | 15% |
| Aksesori asli | 10% |

Rumus:

```text
Skor Kondisi =
(Kelengkapan × 25%)
+ (Jilidan × 20%)
+ (Sampul × 15%)
+ (Kertas × 15%)
+ (Bebas Risiko Biologis × 15%)
+ (Aksesori × 10%)
```

Aplikasi dapat menghitung skor otomatis, sedangkan pengguna tetap dapat mengubah grade setelah pemeriksaan manual.

---

## `acquisitions`

Mencatat cara sebuah eksemplar diperoleh.

Nilai `method`:

- `purchase`;
- `auction`;
- `gift`;
- `inheritance`;
- `exchange`;
- `transfer`;
- `other`.

Satu eksemplar dapat memiliki satu atau lebih catatan akuisisi. Pada versi awal, akuisisi pertama menjadi sumber utama perhitungan modal. Di masa depan, tabel ini juga dapat menyimpan pembelian kembali atau perubahan kepemilikan internal.

Kolom biaya harus menyimpan angka asli dan mata uang transaksi.

Aturan multi-mata-uang:

- setiap komponen biaya menyimpan `amount_original` dan `currency`;
- kurs tidak disimpan ulang di tiap baris, melainkan diambil dari tabel `fx_rates` berdasarkan `currency` dan tanggal transaksi;
- semua komponen dikonversi ke `default_currency` koleksi sebelum dijumlahkan;
- jangan menjumlahkan angka lintas mata uang tanpa konversi.

Bila sebuah eksemplar memiliki lebih dari satu akuisisi, tepat satu akuisisi ditandai `is_primary = true`. Total modal dihitung dari akuisisi primary tersebut.

---

## `disposals`

Pasangan simetris `acquisitions`: mencatat saat sebuah eksemplar dilepas atau dijual. Diperlukan agar laba atau rugi penjualan yang sebenarnya dapat dihitung, termasuk biaya jual yang sering membuat penjualan tampak untung padahal rugi.

Nilai `method`:

- `sale`;
- `auction`;
- `gift`;
- `donation`;
- `transfer`;
- `lost`;
- `other`.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `buyer_agent_id` | Pembeli atau penerima, opsional |
| `channel` | Kanal atau platform penjualan |
| `disposal_date` | Tanggal pelepasan |
| `asking_price` | Harga yang dipasang atau target nego |
| `sale_price` | Harga jual final (kotor) |
| `platform_fee` | Potongan marketplace atau lelang |
| `shipping_cost` | Ongkir yang ditanggung penjual |
| `tax_cost` | Pajak penjualan |
| `other_cost` | Biaya lain |
| `proof_reference` | Bukti transaksi |

Aturan:

- `asking_price` dibedakan dari `sale_price` agar riwayat nego terlacak;
- biaya jual disimpan terpisah agar hasil bersih dapat dihitung;
- setelah pelepasan, `copies.copy_status` menjadi `sold`, `deaccessioned`, atau `lost` sesuai konteks;
- angka biaya menyimpan mata uang transaksi dan dikonversi via `fx_rates`.

Perhitungan hasil bersih dan laba/rugi ada pada dokumen [Data Turunan dan Perhitungan](computed.md).

---

## `valuations`

Menyimpan penilaian berdasarkan tanggal.

Nilai `valuation_type`:

- `owner_estimate`;
- `dealer_estimate`;
- `auction_estimate`;
- `insurance_value`;
- `expert_appraisal`;
- `realized_sale`.

Aturan:

- valuasi tidak menggantikan harga beli;
- valuasi terbaru menjadi nilai aktif;
- nilai asuransi dapat berbeda dari nilai pasar;
- harga penawaran tidak boleh diperlakukan sama dengan harga terjual;
- sumber pembanding harus dicatat sejauh tersedia.

Rumus apresiasi:

```text
Apresiasi Nominal = Nilai Tengah Terbaru - Total Modal

Apresiasi Persentase =
((Nilai Tengah Terbaru - Total Modal) / Total Modal) × 100%
```

Perhitungan harus menghindari pembagian apabila total modal nol atau tidak tersedia.

---

## `provenance_events`

Menyimpan kronologi pemilik dan perpindahan.

Nilai `event_type`:

- `created`;
- `owned`;
- `gifted`;
- `inherited`;
- `purchased`;
- `sold`;
- `auctioned`;
- `transferred`;
- `unknown`.

Aturan:

- urutan ditentukan oleh `sequence_no`;
- gunakan penomoran renggang (10, 20, 30, ...) agar penyisipan pemilik di tengah kronologi tidak memaksa penomoran ulang;
- satu nomor urut hanya boleh digunakan sekali pada eksemplar yang sama;
- fakta dan dugaan harus dibedakan;
- bukti fisik, dokumen, atau sumber harus dijelaskan;
- klaim penjual tidak otomatis dianggap terverifikasi.

Contoh status verifikasi:

- `unverified`;
- `partially_verified`;
- `verified`;
- `disputed`;
- `rejected`.

Contoh confidence:

- `low`;
- `medium`;
- `high`;
- `expert_verified`.

---

## `media_assets`

Menyimpan metadata file yang terkait dengan eksemplar.

Nilai `media_type`:

- `cover_front`;
- `cover_back`;
- `spine`;
- `title_page`;
- `copyright_page`;
- `contents`;
- `last_page`;
- `signature`;
- `stamp`;
- `damage`;
- `receipt`;
- `certificate`;
- `other`.

`checksum_sha256` digunakan untuk:

- mendeteksi file yang sama;
- mendeteksi perubahan file;
- mendukung pemeriksaan integritas backup.

---

## `wishlists`

Mencatat buku yang belum dimiliki. Tabel ini menyimpan **target/niat** ("buku apa yang dicari"), bukan tempat pembeliannya. Satu target dapat berkaitan dengan banyak penawaran dari toko berbeda; penawaran disimpan pada tabel terpisah `wishlist_offers`.

Nilai `status`:

- `active`;
- `found`;
- `purchased`;
- `paused`;
- `abandoned`.

Rekomendasi skala prioritas:

| Nilai | Arti |
|---:|---|
| 1 | Sangat tinggi |
| 2 | Tinggi |
| 3 | Sedang |
| 4 | Rendah |
| 5 | Sangat rendah |

Setelah buku diperoleh:

1. pilih satu `wishlist_offer` sebagai penawaran terpilih (`is_selected = true`);
2. ubah status wishlist menjadi `purchased`;
3. buat atau pilih `work`;
4. buat atau pilih `edition`;
5. buat `copy`;
6. buat `acquisition` dengan menyalin harga dan penjual dari penawaran terpilih.

---

## `wishlist_offers`

Menyimpan setiap penawaran yang ditemukan untuk satu target wishlist. Satu wishlist dapat memiliki banyak penawaran dari toko, olshop, atau akun sosmed berbeda, masing-masing dengan harga dan kelayakan berbeda.

Kolom penting:

| Kolom | Fungsi |
|---|---|
| `wishlist_id` | Target yang dituju |
| `seller_agent_id` | Tautan opsional ke `agents` bila toko sudah tercatat |
| `source_name` | Nama toko bila belum jadi agent, mis. `@tokobukulawas` |
| `platform` | Kanal penawaran |
| `listing_url` | Tautan penawaran |
| `price` | Harga yang ditawarkan |
| `currency` | Mata uang |
| `offered_condition` | Grade yang diklaim penjual |
| `condition_note` | Catatan kelayakan, mis. "ada stempel, sampul lepas" |
| `availability` | Ketersediaan penawaran |
| `observed_date` | Tanggal penawaran ditemukan |
| `is_selected` | Penawaran yang akhirnya dipilih |

Nilai `platform`:

- `instagram`;
- `tokopedia`;
- `shopee`;
- `facebook`;
- `whatsapp`;
- `website`;
- `offline`;
- `other`.

Nilai `availability`:

- `available`;
- `reserved`;
- `sold`;
- `expired`;
- `unknown`.

Aturan:

- `offered_condition` dibandingkan dengan `min_condition` pada wishlist untuk menandai penawaran di bawah standar;
- toko sosmed yang baru ditemukan tidak wajib langsung menjadi `agents`; gunakan `source_name` dahulu, promosikan menjadi agent bila sering bertransaksi;
- harga dan ketersediaan cepat berubah, sehingga `observed_date` menunjukkan kesegaran data.

---

## `wishlist_offer_media`

Menyimpan foto atau screenshot listing untuk sebuah penawaran. Satu penawaran dapat memiliki banyak foto. Berkas disimpan di object storage; database hanya menyimpan metadata dan lokasi. Penghapusan bersifat soft-delete melalui `deleted_at`.

---
