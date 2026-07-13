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

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
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
    width = arr.shape[1]

    used_dewarp = False
    if dewarp.lower() in ("1", "true", "yes"):
        arr, used_dewarp = dewarp_image(arr)
        width = arr.shape[1]

    result, _ = engine(arr)

    if not result:
        return {
            "text": "", "confidence": 0.0, "engine": "rapidocr-ppocr",
            "dewarped": used_dewarp, "layout": "empty", "pages": [],
        }

    # Segmentasi bentang halaman: deteksi 1 halaman, 1 dominan (sisi lain
    # terpotong), atau 2 halaman (dibaca terpisah kiri/kanan).
    if page_split.lower() in ("off", "false", "0", "no"):
        # Paksa satu halaman (tanpa deteksi bentang).
        ordered = sorted(result, key=lambda r: (round(r[0][0][1] / 20), r[0][0][0]))
        text = "\n".join(it[1] for it in ordered)
        conf = sum(float(it[2]) for it in ordered) / len(ordered)
        pages = [{"label": "halaman", "side": "single", "text": text, "confidence": conf}]
        layout = "single"
    else:
        pages, layout = segment_pages(result, width)

    # Teks gabungan untuk kompatibilitas (dipisah penanda antar halaman).
    combined = "\n\n".join(
        (f"— {p['label'].upper()} —\n{p['text']}" if len(pages) > 1 else p["text"])
        for p in pages
    )
    confidence = sum(p["confidence"] for p in pages) / len(pages) if pages else 0.0

    return {
        "text": combined,
        "confidence": confidence,
        "engine": "rapidocr-ppocr",
        "dewarped": used_dewarp,
        "layout": layout,
        "pages": pages,
    }
