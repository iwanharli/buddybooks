# Dataset & Evaluasi OCR

Tempat menaruh foto uji untuk mengukur dan meningkatkan akurasi engine OCR
secara objektif (bukan sekadar "kelihatannya bagus").

## Cara pakai

1. **Taruh foto** di `images/`, dikelompokkan per kasus:

   ```
   images/curved/     halaman melengkung dekat punggung buku
   images/two-page/   dua halaman terfoto sekaligus
   images/low-light/  cahaya redup / tidak rata
   images/skewed/     miring / perspektif
   ```

   Boleh menambah subfolder kasus lain sesuai kebutuhan.

2. **(Disarankan) Taruh kunci jawaban** di `expected/` dengan struktur &
   nama sama, berekstensi `.txt`, berisi teks isi halaman yang benar:

   ```
   images/curved/foto01.jpg   ->   expected/curved/foto01.txt
   ```

   Tanpa kunci jawaban, skrip hanya melaporkan confidence (tebakan engine).
   Dengan kunci jawaban, skrip menghitung **CER** (Character Error Rate) —
   ukuran akurasi objektif.

3. **Jalankan evaluasi** (dari folder `ocr-service`, virtualenv terpasang):

   ```bash
   .venv/bin/python eval/run_eval.py            # tanpa dewarp
   .venv/bin/python eval/run_eval.py --dewarp   # bandingkan dewarp on/off
   .venv/bin/python eval/run_eval.py --save     # simpan CSV ke results/
   ```

## Membaca hasil

- **conf** = keyakinan engine (0–1). Tinggi belum tentu benar.
- **CER** = seberapa jauh hasil dari kunci jawaban. **0 = sempurna**,
  makin kecil makin akurat. `Akurasi karakter = (1 − CER) × 100%`.

Alur kerja iteratif: kumpulkan foto bermasalah → beri kunci jawaban →
ubah engine/parameter → jalankan ulang → bandingkan CER rata-rata.
Turunnya CER = engine benar-benar makin pintar (terukur).

## Catatan git

- Foto (`images/`) dan output (`results/`) **tidak** ikut ke git (besar).
- Kunci jawaban (`expected/*.txt`) **ikut** ke git (kecil, berharga).
