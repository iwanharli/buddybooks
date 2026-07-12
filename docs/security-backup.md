# Keamanan

## Data yang perlu dilindungi

- nilai koleksi;
- harga beli;
- lokasi fisik;
- identitas penjual;
- provenance sensitif;
- dokumen transaksi;
- sertifikat;
- catatan internal.

## Rekomendasi

- autentikasi pengguna;
- pembatasan hak akses;
- enkripsi koneksi;
- backup terenkripsi;
- checksum file;
- audit perubahan;
- private storage untuk media;
- URL media sementara;
- pembatasan akses lokasi dan valuasi;
- kebijakan password;
- rate limiting;
- pencatatan login gagal.

---

# Backup dan Pemulihan

Strategi minimum:

- backup database harian;
- backup file media harian atau sinkron;
- backup penuh mingguan;
- salinan offline berkala;
- satu salinan di lokasi berbeda;
- pengujian pemulihan secara berkala;
- checksum untuk memastikan integritas.

Prinsip:

```text
3 salinan data
2 jenis media
1 salinan di lokasi berbeda
```

Backup yang tidak pernah diuji belum dapat dianggap aman.

---

