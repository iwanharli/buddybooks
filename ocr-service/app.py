"""
Service OCR berbasis PaddleOCR (model PP-OCR via RapidOCR/ONNXRuntime).

Dipakai backend Go sebagai engine OCR "pintar" yang jauh lebih tahan
terhadap foto HP miring, sedikit melengkung, dan cahaya tidak rata
dibanding Tesseract klasik. Berjalan lokal (tanpa cloud), sesuai
docs/reader-module.md.

Endpoint:
  GET  /health
  POST /ocr   (multipart: image, opsional field dewarp=true)
"""
import io
import os

import numpy as np
import requests
from fastapi import BackgroundTasks, FastAPI, UploadFile, File, Form
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

from dewarp import dewarp_image
from segment import segment_pages

app = FastAPI(title="Buddybooks OCR Service")

# Model dimuat sekali saat startup (init ~0.1s, inferensi cepat di CPU).
engine = RapidOCR()


@app.get("/health")
def health():
    return {"status": "ok", "engine": "rapidocr-ppocr"}


@app.post("/ocr")
async def ocr(
    image: UploadFile = File(...),
    dewarp: str = Form("false"),
    page_split: str = Form("auto"),
):
    raw = await image.read()
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(pil)
    height, width = arr.shape[0], arr.shape[1]

    used_dewarp = False
    if dewarp.lower() in ("1", "true", "yes"):
        arr, used_dewarp = dewarp_image(arr)
        height, width = arr.shape[0], arr.shape[1]

    result, _ = engine(arr)

    if not result:
        return {
            "text": "", "confidence": 0.0, "low_coverage": True,
            "engine": "rapidocr-ppocr",
            "dewarped": used_dewarp, "layout": "empty", "pages": [],
        }

    # Segmentasi bentang halaman: deteksi 1 halaman, 1 dominan (sisi lain
    # terpotong), atau 2 halaman (dibaca terpisah kiri/kanan).
    if page_split.lower() in ("off", "false", "0", "no"):
        # Paksa satu halaman (tanpa deteksi bentang).
        pages, layout = segment_pages(result, width, height, min_gutter_ratio=1e9)
    else:
        pages, layout = segment_pages(result, width, height)

    # Teks gabungan untuk kompatibilitas (dipisah penanda antar halaman).
    combined = "\n\n".join(
        (f"— {p['label'].upper()} —\n{p['text']}" if len(pages) > 1 else p["text"])
        for p in pages
    )
    confidence = sum(p["confidence"] for p in pages) / len(pages) if pages else 0.0
    # Sinyal cakupan: True bila ada halaman yang kemungkinan under-read
    # (banyak teks tak terdeteksi) meski confidence tinggi.
    low_coverage = any(p.get("low_coverage") for p in pages)

    return {
        "text": combined,
        "confidence": confidence,
        "low_coverage": low_coverage,
        "engine": "rapidocr-ppocr",
        "dewarped": used_dewarp,
        "layout": layout,
        "pages": pages,
    }


def _run_vlm_reread(image_bytes: bytes, ocr_text: str, side: str,
                     book_page_id: str, callback_url: str, callback_secret: str):
    """Jalan di background task FastAPI: baca ulang lewat VLM lalu callback
    ke backend Go. Kegagalan cuma di-log — endpoint pemanggil sudah balas
    202 duluan, jadi tidak ada yang menunggu di sisi backend."""
    from vlm_assist import read_page  # import lokal: hindari load google-genai/dotenv saat idle

    try:
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        text, provider = read_page(pil, ocr_text, side=side)
    except Exception as e:
        print(f"[vlm-reread] gagal baca ulang book_page {book_page_id}: {e}")
        return

    try:
        requests.post(
            callback_url,
            json={"book_page_id": book_page_id, "text": text, "provider": provider},
            headers={"X-Webhook-Secret": callback_secret},
            timeout=30,
        ).raise_for_status()
    except Exception as e:
        print(f"[vlm-reread] gagal callback untuk book_page {book_page_id}: {e}")


@app.post("/ocr/vlm-reread", status_code=202)
async def ocr_vlm_reread(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    ocr_text: str = Form(""),
    side: str = Form("single"),
    book_page_id: str = Form(...),
    callback_url: str = Form(...),
    callback_secret: str = Form(""),
):
    """Fallback VLM ASYNC untuk satu halaman low_coverage (dipanggil backend
    Go, lihat ocrclient.RequestVLMReread). Balas 202 langsung, hasil baru
    dikirim belakangan lewat POST ke callback_url — endpoint ini TIDAK
    menunggu Gemini/OpenRouter selesai."""
    raw = await image.read()
    background_tasks.add_task(
        _run_vlm_reread, raw, ocr_text, side, book_page_id, callback_url, callback_secret,
    )
    return {"accepted": True}
