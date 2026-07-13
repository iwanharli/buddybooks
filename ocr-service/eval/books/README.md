# Wadah Uji 10 Buku

10 slot untuk foto buku dengan kasus berbeda. Taruh foto Anda di sini,
lalu saya jalankan pengujian dan analisis hasilnya.

## Cara pakai

1. **Pilih slot** `book01/` … `book10/` (satu slot = satu buku/kasus).

2. **Isi `CASE.txt`** di slot itu — tulis kasusnya, misalnya:
   ```
   kasus: halaman kanan + kiri terpotong & melengkung
   catatan: cetakan tua ejaan lama, cahaya agak redup
   ```

3. **Jatuhkan foto** (`.jpg` / `.png` / `.heic`) langsung di folder slot,
   mis. `book01/halaman_45.jpg`. Boleh beberapa foto per buku.

4. **(Opsional tapi disarankan) Kunci jawaban** agar akurasi terukur (CER):
   - Satu halaman: `book01/halaman_45.gt.txt` berisi teks isi halaman.
   - Dua halaman (bentang): pisah per sisi —
     `book01/halaman_44_45.left.gt.txt` dan `...right.gt.txt`.
   Tanpa kunci jawaban, laporan hanya menampilkan confidence & deteksi layout.

## Menjalankan uji

Dari folder `ocr-service`:

```bash
.venv/bin/python eval/run_books.py            # engine biasa
.venv/bin/python eval/run_books.py --dewarp   # + pelurusan halaman melengkung
```

Laporan per buku menampilkan: layout terdeteksi (1 halaman / dominan / 2
halaman bentang), confidence tiap halaman, dan CER bila ada kunci jawaban.

## Catatan git

Foto (gambar) **tidak** ikut ke git (besar). `CASE.txt` dan kunci jawaban
`.gt.txt` **ikut** (kecil, berharga).
