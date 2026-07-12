# Contoh Data Ringkas

## Karya

```json
{
  "work_code": "WRK-000001",
  "preferred_title": "Di Bawah Bendera Revolusi",
  "original_language": "Indonesia",
  "first_publication_year": 1959,
  "work_type": "monograph",
  "subject_summary": "Politik, nasionalisme, dan revolusi Indonesia",
  "notes": "Tahun terbit pertama masih perkiraan, perlu verifikasi bibliografi"
}
```

## Edisi

```json
{
  "edition_code": "ED-000001",
  "edition_statement": "Edisi pertama",
  "impression_statement": "Cetakan kedua",
  "publication_city": "Jakarta",
  "publication_year": 1964,
  "language": "Indonesia",
  "volume_label": "Jilid I",
  "total_pages": 674,
  "identification_status": "initial",
  "identification_basis": "Halaman judul dan halaman penerbitan"
}
```

## Eksemplar

```json
{
  "inventory_code": "BK-IND-000001",
  "copy_status": "owned",
  "collection_grade": "core",
  "completeness_status": "complete",
  "is_binding_original": true,
  "dust_jacket_present": false,
  "height_mm": 240,
  "width_mm": 170,
  "weight_grams": 1250
}
```

---

# File Desain Database

Desain utama tersedia dalam format DBML pada repositori ini:

```text
dbdiagram-koleksi-buku-sederhana-ekstensibel.dbml
```

File dapat dibuka melalui dbdiagram.io.

Cara menggunakan:

1. buat diagram baru;
2. pilih editor DBML;
3. hapus isi contoh;
4. tempel isi file DBML;
5. periksa diagram;
6. ekspor ke PostgreSQL bila diperlukan.

---

