"""
Lapisan koreksi berbasis VLM yang membaca ulang SETIAP halaman (bukan cuma
yang low_coverage) — lihat backend/internal/domain/reader/handler.go,
UploadPage: triggerVLMReread selalu dipanggil untuk semua halaman.

RapidOCR tetap jalan duluan (cepat, gratis, lokal) di backend; hasilnya
dikirim ke VLM sebagai teks referensi, lalu VLM diminta membaca ulang &
menandai struktur ([JUDUL]/[PARAGRAF]/dst) — VLM yang jadi sumber ocr_text
akhir untuk semua halaman, bukan cuma "upgrade" darurat halaman bermasalah.

Rantai provider: OpenRouter/Gemma (utama) -> Gemini (fallback kedua). Gemma
dijadikan utama justru KARENA VLM sekarang wajib jalan di setiap halaman:
free tier Gemini cuma 20 req/hari, akan langsung habis kalau jadi provider
utama untuk buku ratusan halaman. Gemini tetap dipakai sebagai fallback
kalau OpenRouter/Gemma gagal/rate-limit.
"""
import base64
import io
import os

import requests
from dotenv import load_dotenv
from PIL import Image

load_dotenv()

_gemini_client = None


def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY belum diset (lihat .env.example)")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


PROMPT = """Kamu membaca ulang satu foto halaman buku hasil scan HP.{side_hint}
OCR awal (RapidOCR) sudah membaca halaman ini dan hasilnya kemungkinan
kurang lengkap/salah baca di beberapa bagian:

--- hasil OCR awal ---
{ocr_text}
--- akhir hasil OCR awal ---

Baca ulang gambar ini dengan teliti dan berikan transkripsi teks yang benar,
lengkap, sesuai urutan baca alami halaman tersebut (atas ke bawah, kiri ke
kanan). Tandai tiap UNIT LOGIS (bukan tiap baris cetak fisik!) dengan salah
satu label di depan:
[BAB] untuk judul BAB/chapter (biasanya dicetak besar sendirian, sering di
  awal halaman, mis. "BAB 1" atau "Chapter One" atau judul chapter) — beda
  dari [JUDUL] biasa, khusus untuk pembuka bab baru
[JUDUL] untuk judul/heading/subjudul lain di halaman (bukan judul bab)
[KUTIPAN] untuk kutipan/quote/epigraf yang di buku aslinya dicetak beda
  dari paragraf biasa (mis. miring, menjorok, atau berdiri sendiri sebagai
  motto/pembuka bab) — bukan dialog biasa di dalam cerita
[PARAGRAF] untuk SATU paragraf UTUH
[HALAMAN] untuk nomor halaman berdiri sendiri
[GAMBAR&TEKS] sebagai penanda (baris kosong) bila halaman memuat gambar/foto/ilustrasi

SANGAT PENTING soal [PARAGRAF] — jangan bingungkan "baris cetak" dengan
"paragraf". Satu paragraf di buku fisik biasanya tercetak jadi BANYAK baris
pendek (karena lebar halaman terbatas), tapi itu tetap SATU paragraf, jadi
harus jadi SATU baris [PARAGRAF] di outputmu (gabungkan semua baris cetak
yang bersambung itu jadi satu kalimat/teks panjang, dipisah spasi biasa).
JANGAN membuat tag [PARAGRAF] baru hanya karena baris cetak berikutnya —
buat tag [PARAGRAF] baru HANYA kalau paragraf sebelumnya sudah benar-benar
selesai (baris pertama paragraf baru menjorok/indented, atau ada baris
kosong pemisah, atau memang topik/kalimat sebelumnya sudah tuntas dengan
titik dan konteksnya berganti). Kalau ragu apakah dua baris cetak itu masih
satu paragraf yang sama atau paragraf baru, anggap masih SATU paragraf yang
sama (lebih baik satu paragraf agak panjang daripada paragraf pecah-pecah).

Di dalam baris [JUDUL]/[PARAGRAF]/[KUTIPAN]/[BAB], tandai bagian yang
DICETAK TEBAL (bold) di buku aslinya dengan **dua tanda bintang** di kiri-
kanan bagian itu, mis. "kalimat biasa **kata yang tebal** lanjutan biasa".
Jangan pakai tanda bintang untuk hal lain (miring, garis bawah, dll) —
KHUSUS untuk teks yang benar-benar tercetak tebal.

PENTING — bila halaman ini berupa peta, diagram, denah, atau ilustrasi
berlabel banyak (mis. nama stasiun di peta subway, nama kota di peta,
label bagian di diagram teknis): JANGAN transkrip satu-per-satu semua
label kecil tersebut. Cukup transkrip judul/caption halaman, keterangan
gambar (mis. "Map of ..."), dan legenda/kunci (KEY) bila ada singkat.
Anggap label-label kecil di dalam gambar itu sendiri sebagai bagian dari
[GAMBAR&TEKS], bukan teks yang perlu ditulis ulang.

SANGAT PENTING — JANGAN MENGARANG: kalau ada bagian gambar yang buram,
melengkung, terpotong tepi, atau sungguh-sungguh tidak bisa dibaca dengan
yakin, JANGAN menebak atau melengkapi kalimat dengan isi yang masuk akal
tapi tidak benar-benar terlihat jelas di gambar. Tuliskan `[TIDAK TERBACA]`
untuk bagian itu, lalu lanjutkan ke bagian lain yang jelas. Kesalahan
tebakan-yang-terdengar-meyakinkan JAUH LEBIH BURUK daripada mengaku tidak
bisa membaca sebagian teks — buku ini dikatalogkan sebagai referensi nyata,
isi yang direka-reka akan menyesatkan pembaca.

Jangan menerjemahkan bahasa apa pun, tulis persis seperti yang tertulis di
gambar (termasuk ejaan lama/kata asing). Jangan tambahkan komentar lain,
langsung keluarkan barisnya saja.

SANGAT PENTING — PENILAIAN KUALITAS FOTO SECARA KESELURUHAN: ini beda dari
[TIDAK TERBACA] (yang menandai SATU bagian kecil tak terbaca). Kalau
setelah kamu baca ulang gambar ini dengan teliti, hasilnya SECARA
KESELURUHAN (bukan cuma sebagian kecil) tetap berupa potongan-potongan
kata yang TIDAK membentuk kalimat/paragraf yang masuk akal dan mengalir —
tanda fotonya buram, goyang (motion blur), atau fokusnya salah sehingga
huruf-hurufnya sendiri tidak jelas bentuknya (bukan sekadar bahasa
asing/ejaan lama yang kamu tidak familiar) — tambahkan SATU baris
`[KUALITAS BURUK]` di awal (sebelum baris lainnya), sebagai peringatan
bahwa halaman ini sebaiknya difoto ulang. Jangan pakai ini kalau teksnya
sebetulnya terbaca jelas dan masuk akal, walau bahasanya asing/kuno/rumit.
"""

SIDE_HINTS = {
    "left": " Foto ini adalah bentang dua halaman — fokus HANYA pada halaman KIRI, abaikan halaman kanan.",
    "right": " Foto ini adalah bentang dua halaman — fokus HANYA pada halaman KANAN, abaikan halaman kiri.",
    "dominant": " Foto ini mungkin memuat sisa halaman lain yang terpotong di tepi — fokus HANYA pada halaman utama yang penuh/dominan.",
}

OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it:free"


def _read_page_gemini(image: Image.Image, prompt: str, model: str) -> str:
    client = _get_gemini_client()
    resp = client.models.generate_content(model=model, contents=[prompt, image])
    return (resp.text or "").strip()


def _read_page_openrouter(image: Image.Image, prompt: str, model: str) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY belum diset (lihat .env.example)")
    buf = io.BytesIO()
    image.save(buf, format="JPEG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    r = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                ],
            }],
        },
        timeout=90,
    )
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"OpenRouter error: {data['error']}")
    return (data["choices"][0]["message"]["content"] or "").strip()


def read_page(image: Image.Image, ocr_text: str, side: str = "single",
              model: str = "gemini-2.5-flash") -> tuple[str, str]:
    """Baca ulang satu foto halaman lewat rantai provider VLM.

    Coba OpenRouter/Gemma dulu (gratis, tanpa kuota harian ketat); kalau
    gagal (rate-limit/error apa pun), coba Gemini sebagai fallback.
    Kembalikan (teks, nama_provider_yang_berhasil). Melempar exception hanya
    bila SEMUA provider gagal.
    """
    prompt = PROMPT.format(side_hint=SIDE_HINTS.get(side, ""), ocr_text=ocr_text or "(kosong)")

    errors = []
    try:
        return _read_page_openrouter(image, prompt, OPENROUTER_MODEL), "openrouter/gemma"
    except Exception as e:
        errors.append(f"openrouter: {e}")

    try:
        return _read_page_gemini(image, prompt, model), "gemini"
    except Exception as e:
        errors.append(f"gemini: {e}")

    raise RuntimeError(" | ".join(errors))
