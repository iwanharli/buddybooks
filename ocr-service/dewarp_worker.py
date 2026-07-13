"""
Worker dewarp mandiri (dijalankan sebagai subprocess terpisah oleh dewarp.py).

Dipisah agar page-dewarp yang bisa diverging/crash terisolasi penuh: bila
proses ini hang atau kehabisan memori, parent cukup membunuhnya via timeout
tanpa terpengaruh. Menulis path hasil ke <tmpdir>/result.txt.

Argumen: <inpath> <tmpdir>
"""
import sys
from pathlib import Path


def main() -> None:
    inpath, tmpdir = sys.argv[1], sys.argv[2]

    # Keamanan terhadap divergence ditangani parent (timeout subprocess +
    # penolakan output berdimensi absurd), bukan lewat RLIMIT_AS yang di
    # beberapa OS malah mematahkan import numpy/scipy/cv2 (footprint virtual
    # bisa melebihi batas).

    from page_dewarp.image import WarpedImage
    from page_dewarp.options import Config

    cfg = Config()
    cfg.NO_BINARY = True
    cfg.OUTPUT_DIR = tmpdir
    cfg.DEBUG_LEVEL = 0
    cfg.OUTPUT_JSON = 0

    warped = WarpedImage(inpath, config=cfg)
    if getattr(warped, "written", False):
        Path(tmpdir, "result.txt").write_text(warped.outfile, encoding="utf-8")


if __name__ == "__main__":
    main()
