# Alur Kerja Utama

## Menyiapkan Lokasi Penyimpanan (Setup Awal)

Tata ruang setiap kolektor berbeda-beda, sehingga `storage_locations` sengaja tidak diisi data contoh generik. Lokasi dibangun bertahap oleh pengguna sendiri, mengikuti hierarki `parent_location_id`, dari level paling luas ke paling spesifik.

```text
1. Buat lokasi tingkat teratas (mis. Ruang Koleksi atau Rumah)
2. Buat lokasi anak di bawahnya (mis. Lemari A), pilih induk pada langkah 1
3. Ulangi ke tingkat berikutnya (mis. Rak A-02) bila diperlukan
4. Ulangi ke tingkat paling spesifik (mis. Kotak BOX-04) bila diperlukan
5. Beri kode unik dan stabil pada tiap lokasi sebelum dipakai di label fisik
6. Tandai lokasi yang ber-AC atau aman bila relevan untuk buku bernilai tinggi
```

Aturan pengelolaan:

- lokasi dibuat dari atas ke bawah; jangan membuat lokasi anak sebelum induknya ada;
- kode lokasi tidak boleh diganti setelah dipakai pada label atau stiker fisik;
- lokasi yang masih ditempati eksemplar tidak dapat dihapus; pindahkan eksemplar ke lokasi lain terlebih dahulu;
- lokasi yang sudah tidak dipakai sebaiknya dinonaktifkan, bukan dihapus, agar riwayat tetap tertelusuri;
- jika struktur ruang berubah (mis. renovasi), buat lokasi baru dan pindahkan eksemplar satu per satu, jangan mengubah makna lokasi lama.

Contoh hasil akhir:

```text
Ruang Koleksi
└── Lemari A
    └── Rak A-02
        └── Kotak BOX-04
```

Setelah struktur dasar ada, lokasi baru dapat ditambahkan kapan saja tanpa mengubah lokasi yang sudah dipakai eksemplar lain.

---

## Memasukkan Buku Baru

```text
1. Cari karya yang sudah ada
2. Jika belum ada, buat karya
3. Hubungkan penulis atau kontributor
4. Cari edisi yang sesuai
5. Jika belum ada, buat edisi
6. Hubungkan penerbit atau percetakan
7. Buat eksemplar fisik
8. Tentukan lokasi
9. Masukkan data akuisisi
10. Buat laporan kondisi awal
11. Unggah foto wajib
12. Tambahkan provenance bila tersedia
13. Buat valuasi awal bila diperlukan
```

Foto minimum yang disarankan:

- sampul depan;
- sampul belakang;
- punggung;
- halaman judul;
- halaman hak cipta;
- kerusakan utama;
- tanda tangan atau stempel bila ada.

---

## Memeriksa Edisi

```text
1. Periksa halaman judul
2. Periksa halaman hak cipta atau kolofon
3. Periksa pernyataan edisi
4. Periksa pernyataan cetakan
5. Catat penerbit dan percetakan
6. Periksa tahun
7. Periksa jumlah halaman dan lampiran
8. Bandingkan dengan sumber bibliografi
9. Isi identification_status
10. Tulis identification_basis
```

---

## Memeriksa Kondisi

```text
1. Ambil buku dari lokasi
2. Foto kondisi sebelum pemeriksaan
3. Periksa sampul
4. Periksa punggung
5. Periksa engsel dan jilidan
6. Periksa kelengkapan halaman
7. Periksa jamur dan serangga
8. Periksa bekas air
9. Periksa tulisan, stempel, dan tanda tangan
10. Berikan skor dan grade
11. Tulis rekomendasi
12. Tentukan inspeksi berikutnya
```

---

## Memperbarui Valuasi

```text
1. Cari penjualan atau penawaran pembanding
2. Pastikan edisi dan cetakan pembanding sesuai
3. Sesuaikan dengan kondisi
4. Bedakan asking price dan sold price
5. Masukkan nilai rendah, tengah, dan tinggi
6. Simpan sumber pembanding
7. Tentukan masa berlaku
8. Jangan menghapus valuasi lama
```

---

## Mengubah Wishlist Menjadi Koleksi

```text
1. Kumpulkan penawaran sebagai wishlist_offers dari tiap toko yang ditemukan
2. Bandingkan harga, kondisi, dan ketersediaan antar penawaran
3. Tandai wishlist sebagai found
4. Verifikasi edisi pada penawaran yang dipilih
5. Tandai penawaran terpilih dengan is_selected
6. Setelah dibeli, buat copy dan acquisition dari penawaran terpilih
7. Tandai wishlist sebagai purchased
```

---

