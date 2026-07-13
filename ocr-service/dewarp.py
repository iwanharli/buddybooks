"""
Dewarping halaman buku melengkung memakai page-dewarp (algoritma mzucker).

page-dewarp bisa DIVERGING dan menghasilkan dimensi halaman absurd (mis.
10^11 piksel) yang dapat membuat proses kehabisan memori / crash. Karena itu
dewarp dijalankan sebagai SUBPROCESS terpisah (dewarp_worker.py) dengan:
  - timeout (hang/diverging dibunuh, tidak menjatuhkan service);
  - batas memori di worker (bila didukung OS);
  - penolakan output berdimensi tidak masuk akal (dicek dari header PNG,
    tanpa memuat seluruh piksel ke memori).

Best-effort: pada kegagalan apa pun, gambar asli dikembalikan (used=False).
RapidOCR sendiri sudah tahan kemiringan ringan-sedang; dewarp untuk
lengkungan berat.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import uuid

import cv2
import numpy as np
from PIL import Image as PILImage

TIMEOUT_SEC = 25
MAX_OUTPUT_PIXELS = 40_000_000  # ~40 MP; di atas ini dianggap divergen
WORKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dewarp_worker.py")


def dewarp_image(arr: np.ndarray) -> tuple[np.ndarray, bool]:
    """Terima array RGB, kembalikan (array_hasil_RGB, apakah_dewarp_berhasil)."""
    tmpdir = tempfile.mkdtemp(prefix="dewarp_")
    inpath = os.path.join(tmpdir, uuid.uuid4().hex + ".png")
    cv2.imwrite(inpath, cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))

    try:
        try:
            subprocess.run(
                [sys.executable, WORKER, inpath, tmpdir],
                timeout=TIMEOUT_SEC,
                capture_output=True,
            )
        except subprocess.TimeoutExpired:
            return arr, False  # hang / diverging

        result_txt = os.path.join(tmpdir, "result.txt")
        if not os.path.exists(result_txt):
            return arr, False  # worker gagal / tak menemukan halaman

        outfile = open(result_txt, encoding="utf-8").read().strip()
        if not outfile or not os.path.exists(outfile):
            return arr, False

        # Cek dimensi dari header PNG dulu (lazy) sebelum memuat piksel,
        # agar output degeneratif tidak ikut dialokasikan di parent.
        with PILImage.open(outfile) as im:
            w, h = im.size
            if w <= 0 or h <= 0 or w * h > MAX_OUTPUT_PIXELS:
                return arr, False
            out = np.array(im.convert("RGB"))
        return out, True
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
