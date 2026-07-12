# Modul Marketplace (Jual-Beli)

Modul ini menyambungkan penjualan, pembelian, pembayaran, dan hak baca menjadi satu alur. Bersifat multi-penjual: banyak penjual memiliki toko dan inventaris sendiri, pembeli berbelanja lintas toko.

## Alur utama

```text
Penjual membuat listing (jual copy fisik atau akses baca edisi)
 └─ Pembeli membuat order berisi order_items dari listing
     └─ Pembayaran (payments) lunas
         ├─ item physical_copy → copy ditandai sold + disposals tercatat (P/L penjual)
         ├─ item reading_access → reading_entitlements (source = purchase)
         └─ shipments untuk item fisik
             └─ payouts ke penjual (harga − komisi platform)
```

## Dua jenis listing

- `physical_copy`: menjual eksemplar fisik tertentu (`copy_id`). Selalu stok 1 karena tiap buku langka unik. Setelah terjual, copy tidak dapat dijual ulang.
- `reading_access`: menjual hak membaca isi sebuah edisi (`edition_id`) dari modul reader, tanpa memindahkan benda fisik.

## Snapshot harga

`order_items.unit_price` dan `title_snapshot` disimpan saat pembelian. Harga dan judul pada listing dapat berubah kemudian, tetapi order lama harus mencerminkan nilai saat transaksi.

## Sambungan ke tabel lain

- **Item fisik selesai** membuat baris `disposals` dengan `order_item_id` terisi, sehingga laba/rugi penjual tetap terhitung memakai rumus pada [Data Turunan dan Perhitungan](computed.md). Penjualan di luar platform tetap dicatat manual di `disposals` dengan `order_item_id` kosong.
- **Item akses baca selesai** membuat `reading_entitlements` dengan `source = purchase` dan `order_id` terisi. Preview gratis tetap diatur lewat `editions.preview_free_pages` tanpa order.

## Pembagian dana

`orders.platform_fee` mencatat komisi platform. `payouts.net_amount = gross_amount − platform_fee` adalah yang diterima penjual.

## Tabel

- `listings` — penawaran jual;
- `orders` dan `order_items` — transaksi beli;
- `payments` — pembayaran pembeli;
- `shipments` — pengiriman item fisik;
- `payouts` — pencairan dana penjual.

Definisi kolom tersedia pada file DBML.

## Aturan penting

- satu order berasal dari satu penjual; keranjang lintas penjual dipecah menjadi beberapa order;
- copy fisik hanya boleh punya satu listing aktif pada satu waktu;
- entitlement baca tidak diberikan sebelum pembayaran berstatus `paid`;
- pembatalan atau refund harus mencabut entitlement dan membatalkan disposal terkait;
- semua nilai uang menyimpan mata uang transaksi dan dikonversi via `fx_rates` bila perlu agregasi lintas mata uang.
