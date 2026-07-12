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

app = FastAPI(title="Buddybooks OCR Service")

# Model dimuat sekali saat startup (init ~0.1s, inferensi cepat di CPU).
engine = RapidOCR()


@app.get("/health")
def health():
    return {"status": "ok", "engine": "rapidocr-ppocr"}


@app.post("/ocr")
async def ocr(image: UploadFile = File(...), dewarp: str = Form("false")):
    raw = await image.read()
    pil = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(pil)

    used_dewarp = False
    if dewarp.lower() in ("1", "true", "yes"):
        arr, used_dewarp = dewarp_image(arr)

    result, _ = engine(arr)

    if not result:
        return {"text": "", "confidence": 0.0, "engine": "rapidocr-ppocr", "dewarped": used_dewarp}

    # Susun teks mengikuti urutan baca (atas -> bawah). RapidOCR mengembalikan
    # (box, text, score); box[0] = titik kiri-atas.
    items = sorted(result, key=lambda r: (round(r[0][0][1] / 20), r[0][0][0]))
    text = "\n".join(it[1] for it in items)
    scores = [float(it[2]) for it in items]
    confidence = sum(scores) / len(scores) if scores else 0.0

    return {
        "text": text,
        "confidence": confidence,
        "engine": "rapidocr-ppocr",
        "dewarped": used_dewarp,
    }
