# Modul Reader dan Analisis AI (Fase Lanjutan)

Modul opsional untuk membaca isi buku hasil scan sendiri, dengan OCR, terjemahan ke bahasa Inggris, dan ringkasan per bab yang dihasilkan model AI lokal. Tujuannya agar buku berbahasa Belanda atau Indonesia ejaan lama tetap dapat dibaca dan dipahami.

Modul ini adalah tabel terpisah dan tidak mengubah relasi inti.

## Cakupan awal

- Sumber gambar: foto kamera oleh pengguna sendiri.
- Aksara: **Latin lebih dahulu** (Belanda, Indonesia ejaan lama seperti Van Ophuijsen).
- Aksara Jawa, Jawi/Pegon, dan aksara non-Latin lain **ditunda ke tahap berikutnya** karena OCR lokalnya belum andal. Skema sudah menyiapkan kolom `source_script` dan `text_corrected` agar dapat menampung koreksi manual saat aksara tersebut ditambahkan.
- OCR utama (RapidOCR) berjalan lokal/offline. Halaman yang under-read (`low_coverage`) dapat opsional dibaca ulang lewat VLM cloud (Gemini/OpenRouter) sebagai fallback — lihat [tech stack & alur VLM](../README.md#ocr--fallback-vlm-status-eval-only-belum-terhubung-ke-endpoint-produksi) di README. Fallback ini baru dipakai di eval offline, belum di endpoint produksi.

## Pipeline

```text
Foto halaman (kamera)
 └─ Pra-proses: crop, koreksi perspektif, deskew, binarisasi   [OpenCV]
     └─ OCR per halaman → teks + confidence                     [Tesseract/Kraken]
         └─ (opsional) normalisasi ejaan lama                   [aturan]
             └─ Terjemahan per halaman ke Inggris               [model lokal, mis. NLLB]
                 └─ Deteksi bab + ringkasan bab hierarkis        [LLM lokal]
```

Prinsip:

- setiap tahap disimpan hasilnya dan dapat dijalankan ulang sendiri-sendiri;
- teks OCR mentah, teks koreksi manusia, dan terjemahan disimpan terpisah dan tidak saling menimpa;
- setiap hasil AI mencatat model dan versi prompt agar dapat dilacak;
- halaman dengan `ocr_confidence` rendah ditandai untuk koreksi manual;
- terjemahan dan ringkasan bersifat interpretasi, bukan fakta, dan tidak boleh otomatis mengisi kolom fakta pada tabel inti.

## Tampilan baca

Tampilan paralel: kolom asli (gambar atau teks OCR) berdampingan dengan terjemahan Inggris, disertai ringkasan bab. Pengguna dapat memilih tampilan asli, Inggris, atau keduanya. Ini menjaga keaslian buku langka sambil memberi keterbacaan.

## Ekstraksi nama dan tempat

Setelah OCR, sistem mengekstraksi nama orang, tempat, dan organisasi yang muncul di dalam teks, agar buku dapat dicari berdasarkan isinya (misalnya "semua buku yang menyebut Surabaya").

Nama hasil ekstraksi berpotensi kotor: salah baca OCR, varian ejaan lama, atau salah tebak. Karena itu diterapkan pemisahan dua lapis:

- **Lapis mentah** (`book_entity_mentions`): mencatat apa adanya bahwa sebuah nama muncul di halaman tertentu. Boleh mengandung kesalahan.
- **Lapis otoritas** (`agents` untuk orang/organisasi, `places` untuk lokasi): daftar baku yang bersih dan tepercaya.

Alur rekonsiliasi: temuan disimpan lebih dahulu di lapis mentah, lalu manusia (dapat dibantu saran AI) mencocokkannya ke daftar otoritas dengan mengisi `linked_agent_id` atau `linked_place_id`. Sebelum dicocokkan, temuan tetap sekadar "teks menyebut sesuatu", bukan fakta katalog. Ini menjaga tabel inti tetap bersih.

## Tabel

- `book_pages` — gambar, OCR, koreksi, dan terjemahan per halaman;
- `book_chapters` — batas bab dan ringkasan;
- `ai_analyses` — catatan generik hasil analisis AI beserta model dan versi prompt;
- `book_entity_mentions` — nama orang, tempat, dan organisasi yang muncul di teks (lapis mentah);
- `places` — daftar baku nama tempat (lapis otoritas).

Definisi kolom tersedia pada file DBML.

---

