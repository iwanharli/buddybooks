# Data Turunan dan Perhitungan

Data berikut lebih baik dihitung oleh query atau service aplikasi:

## Total modal per eksemplar

Dihitung dari akuisisi yang `is_primary = true`. Setiap komponen dikonversi lebih dahulu ke `default_currency` koleksi memakai kurs dari tabel `fx_rates` pada `transaction_date`.

```text
purchase_price
+ shipping_cost
+ tax_cost
+ auction_premium
+ restoration_initial_cost
+ other_cost
```

## Valuasi terbaru

Ambil satu record `valuations` dengan `valuation_date` paling baru.

## Kondisi terbaru

Ambil satu record `condition_reports` dengan `report_date` paling baru.

## Nilai total koleksi

Jumlahkan `value_mid` terbaru dari setiap eksemplar.

## Potensi apresiasi

```text
Nilai Tengah Terbaru - Total Modal
```

## Harga jual minimum (titik impas)

Patokan agar penjualan tidak rugi. Menambahkan perkiraan biaya jual di atas total modal.

```text
Harga Jual Minimum = Total Modal + perkiraan biaya jual
(perkiraan biaya jual = platform_fee + shipping_cost + tax_cost + other_cost)
```

Jangan memasang `asking_price` di bawah angka ini bila tidak ingin rugi.

## Hasil bersih penjualan

Dihitung dari record `disposals`. Semua komponen dikonversi ke `default_currency` via `fx_rates` pada `disposal_date`.

```text
Hasil Bersih = sale_price - platform_fee - shipping_cost - tax_cost - other_cost
```

## Laba atau rugi terealisasi

```text
Laba/Rugi Riil = Hasil Bersih Penjualan - Total Modal

Margin Persentase =
((Hasil Bersih - Total Modal) / Total Modal) × 100%
```

Hindari pembagian bila total modal nol atau tidak tersedia. Nilai negatif berarti rugi.

## Total laba portofolio

Jumlahkan `Laba/Rugi Riil` dari semua eksemplar yang sudah memiliki `disposals`.

## Buku yang perlu diperiksa

```text
next_inspection_date <= tanggal saat ini
```

## Buku berisiko

```text
active_risk = true
OR mold_present = true
OR pest_damage_present = true
```

---

