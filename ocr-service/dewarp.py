"""
Dewarping halaman buku melengkung (page curl) memakai page-dewarp
(algoritma mzucker: memodelkan halaman sebagai lembar kubik dari garis
teks terdeteksi, lalu meluruskannya).

Bersifat best-effort: bila deteksi garis teks gagal (mis. terlalu sedikit
baris, kontras rendah), gambar asli dikembalikan apa adanya. RapidOCR
sendiri sudah cukup tahan terhadap kemiringan; dewarping adalah lapisan
tambahan untuk lengkungan yang lebih parah.
"""
import os
import shutil
import tempfile
import uuid

import cv2
import numpy as np

from page_dewarp.image import WarpedImage
from page_dewarp.options import Config


def dewarp_image(arr: np.ndarray) -> tuple[np.ndarray, bool]:
    """Terima array RGB, kembalikan (array_hasil_RGB, apakah_dewarp_berhasil)."""
    tmpdir = tempfile.mkdtemp(prefix="dewarp_")
    stem = uuid.uuid4().hex
    inpath = os.path.join(tmpdir, stem + ".png")

    # page-dewarp membaca via cv2 (BGR); tulis dalam BGR.
    cv2.imwrite(inpath, cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))

    try:
        cfg = Config()
        cfg.NO_BINARY = True       # keluarkan hasil remap tanpa binarisasi keras
        cfg.OUTPUT_DIR = tmpdir
        cfg.DEBUG_LEVEL = 0
        cfg.OUTPUT_JSON = 0

        warped = WarpedImage(inpath, config=cfg)
        if not getattr(warped, "written", False):
            return arr, False

        out = cv2.imread(warped.outfile)
        if out is None:
            return arr, False
        return cv2.cvtColor(out, cv2.COLOR_BGR2RGB), True
    except Exception as e:  # noqa: BLE001 - fallback aman untuk input apa pun
        print(f"dewarp gagal, memakai gambar asli: {e}")
        return arr, False
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)
