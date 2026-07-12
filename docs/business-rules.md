# Aturan Bisnis

## Kode dan identitas

- `collections.code` harus unik.
- `works.work_code` harus unik.
- `editions.edition_code` harus unik.
- `copies.inventory_code` harus unik dalam satu koleksi.
- `storage_locations.code` harus unik dalam satu koleksi.
- Barcode sebaiknya unik secara global.
- Kode tidak boleh berubah setelah digunakan pada label atau QR code.
- QR code dan barcode sebaiknya menunjuk ke ID internal permanen (UUID), bukan `inventory_code`, karena format kode manusiawi dapat berubah sedangkan tautan fisik tidak boleh rusak.

Rekomendasi format:

```text
Koleksi: COL-HIS
Karya: WRK-000001
Edisi: ED-000001
Eksemplar: BK-IND-000001
Lokasi: LOC-A-02
```

---

## Validasi tahun

- Tahun pertama terbit tidak boleh lebih besar dari tahun edisi.
- Tahun hak cipta dapat berbeda dari tahun cetak.
- Tahun dapat kosong bila tidak diketahui.
- Jangan mengisi tahun perkiraan sebagai fakta tanpa penanda pada catatan.

---

## Validasi ukuran dan harga

- Ukuran harus bernilai positif.
- Berat harus bernilai positif.
- Nilai uang tidak boleh negatif.
- `value_low` tidak boleh lebih besar dari `value_mid`.
- `value_mid` tidak boleh lebih besar dari `value_high`.
- `insured_value` dapat lebih tinggi dari estimasi pasar apabila biaya penggantian lebih tinggi.

Aturan rentang dan tanda nilai di atas ditegakkan sebagai `CHECK constraint` pada database, bukan hanya validasi di lapisan aplikasi, agar data tidak konsisten mustahil tersimpan.

---

## Validasi lokasi

- Lokasi eksemplar harus berasal dari koleksi yang sama.
- Lokasi induk dan lokasi anak harus berada dalam koleksi yang sama.
- Struktur lokasi tidak boleh membentuk siklus.
- Eksemplar dengan status `sold` atau `deaccessioned` dapat tidak memiliki lokasi aktif.

---

## Kode dan penamaan rak/lokasi

`storage_locations` memisahkan dua hal yang harus tidak pernah dicampur: **`code`** (identitas fisik yang stabil) dan **`name`** (label deskriptif untuk manusia, boleh berubah).

### Kode (`code`) tidak boleh berdasarkan genre atau kategori

Kode lokasi **tidak boleh** disusun dari kategori/subjek buku (mis. "RAK-SEJARAH"), karena:

- satu karya dapat memiliki lebih dari satu kategori sekaligus (`work_categories` bersifat many-to-many), sehingga tidak ada satu genre tunggal yang bisa dijadikan kode;
- kategori sebuah karya dapat dikoreksi di kemudian hari, sementara lokasi fisik eksemplar tidak ikut berubah — kode yang mengandung genre akan menjadi tidak akurat begitu kategori diedit;
- penempatan fisik ditentukan oleh kendala fisik (ukuran, kebutuhan iklim terkendali, keamanan), bukan oleh topik buku;
- ini konsisten dengan prinsip pemisahan tiga sumbu independen dalam desain: `categories` (topik), `work_types` (bentuk benda), dan `storage_locations` (posisi fisik).

### Pola kode yang disarankan

Kode dibentuk dari **prefix jenis lokasi** ditambah **nomor urut**, dihitung sekali saat lokasi dibuat, lalu dikunci selamanya (lihat aturan kode dan identitas di atas — kode tidak boleh berubah setelah dipakai pada label fisik).

```text
building      -> BLD
room          -> R
cabinet       -> C
shelf         -> S
box           -> BOX
display_case  -> DC
vault         -> V
```

Contoh: `R1`, `C1`, `S2`, `BOX4`.

Nomor urut dihitung per jenis lokasi dalam satu koleksi, independen dari lokasi induk, sehingga kode tidak berubah makna walau eksemplar atau lokasi dipindah ke induk yang berbeda.

### Genre tetap boleh dipakai untuk menata rak, lewat `name`

Penataan rak berdasarkan genre adalah keputusan tata ruang yang wajar dan didukung, tetapi harus tercermin di `name`, bukan `code`:

```text
code: S2
name: "Rak Sejarah Indonesia"
```

Bila kategori isi rak berubah di kemudian hari, cukup ubah `name`; `code` tetap sama sehingga label fisik yang sudah tercetak tidak perlu diganti.

### Call number tidak diperlukan

Sistem klasifikasi ala perpustakaan (mis. Dewey Decimal, nomor panggil) tidak diterapkan. Pencarian berdasarkan subjek sudah terpenuhi secara digital melalui `categories`, dan aplikasi menunjukkan lokasi eksemplar secara langsung melalui `current_location_id` serta QR/barcode. Call number baru relevan bila sistem dikembangkan menjadi ruang baca fisik terbuka untuk umum, yang berada di luar cakupan saat ini.

---

## Validasi kondisi

- Tanggal inspeksi tidak boleh berada jauh di masa depan.
- Jadwal inspeksi berikutnya harus setelah tanggal laporan.
- `active_risk = true` sebaiknya memicu notifikasi.
- Laporan kondisi tidak boleh dihapus tanpa alasan audit.
- Foto kerusakan sebaiknya dibuat untuk kondisi `fair` atau `poor`.

---

## Validasi provenance

- `sequence_no` unik untuk setiap eksemplar.
- Periode tidak boleh terbalik.
- Pemilik dan counterparty dapat kosong bila tidak diketahui.
- Status `verified` harus disertai ringkasan bukti.
- Klaim tanda tangan atau kepemilikan tokoh harus dianggap belum terverifikasi sampai memiliki bukti.

---

