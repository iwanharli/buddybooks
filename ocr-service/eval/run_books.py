"""
Uji per-buku: jalankan tiap foto di eval/books/bookNN/ lewat engine
(RapidOCR + segmentasi bentang + opsi dewarp), laporkan per buku:
- deteksi layout (single / single-dominant / spread) dan jumlah halaman,
- confidence tiap halaman,
- CER bila ada kunci jawaban.

Cara taruh gambar:
    eval/books/book01/  -> jatuhkan foto (*.jpg / *.png) langsung di sini.
    (opsional) kunci jawaban: <namafoto>.gt.txt di folder yang sama.
    Untuk bentang 2 halaman, boleh pisah: <namafoto>.kiri.gt.txt / .kanan.gt.txt

Pakai (dari folder ocr-service):
    .venv/bin/python eval/run_books.py
    .venv/bin/python eval/run_books.py --dewarp
"""
import argparse
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

EVAL = Path(__file__).resolve().parent
BOOKS = EVAL / "books"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic"}


def normalize(t: str) -> str:
    return re.sub(r"\s+", " ", t).strip().lower()


def cer(ref: str, hyp: str) -> float:
    ref, hyp = normalize(ref), normalize(hyp)
    if not ref:
        return 0.0 if not hyp else 1.0
    prev = list(range(len(hyp) + 1))
    for i, rc in enumerate(ref, 1):
        cur = [i]
        for j, hc in enumerate(hyp, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (rc != hc)))
        prev = cur
    return prev[-1] / len(ref)


def read_case(book_dir: Path) -> str:
    f = book_dir / "CASE.txt"
    if not f.exists():
        return ""
    for line in f.read_text(encoding="utf-8").splitlines():
        if line.strip().lower().startswith("kasus:"):
            return line.split(":", 1)[1].strip()
    return ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dewarp", action="store_true")
    args = ap.parse_args()

    book_dirs = sorted(d for d in BOOKS.glob("book*") if d.is_dir())
    images_total = 0
    for d in book_dirs:
        imgs = sorted(p for p in d.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        images_total += len(imgs)
    if images_total == 0:
        print(f"Belum ada foto di {BOOKS}/bookNN/. Jatuhkan gambar lalu jalankan lagi.")
        print("Opsional: sertakan kunci jawaban <namafoto>.gt.txt untuk hitung CER.")
        return

    from rapidocr_onnxruntime import RapidOCR
    sys.path.insert(0, str(EVAL.parent))
    from segment import segment_pages
    from dewarp import dewarp_image

    engine = RapidOCR()
    all_cers = []

    for d in book_dirs:
        imgs = sorted(p for p in d.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        if not imgs:
            continue
        case = read_case(d)
        print(f"\n=== {d.name}" + (f" — {case}" if case else "") + " ===")

        for img_path in imgs:
            arr = np.array(Image.open(img_path).convert("RGB"))
            if args.dewarp:
                arr, _ = dewarp_image(arr)
            result, _ = engine(arr)
            pages, layout = segment_pages(result or [], arr.shape[1])

            print(f"  {img_path.name}  ->  {layout}, {len(pages)} halaman")
            for p in pages:
                # kunci jawaban: <img>.gt.txt (umum) atau <img>.<side>.gt.txt (bentang)
                gt = None
                for cand in (d / f"{img_path.stem}.{p['side']}.gt.txt",
                             d / f"{img_path.stem}.gt.txt"):
                    if cand.exists():
                        gt = cand.read_text(encoding="utf-8")
                        break
                cer_str = ""
                if gt is not None:
                    c = cer(gt, p["text"])
                    all_cers.append(c)
                    cer_str = f", CER={c:.3f}"
                first = p["text"].splitlines()[0] if p["text"] else "(kosong)"
                print(f"      [{p['side']:<8}] conf={p['confidence']:.2f}{cer_str}  {first!r}")

    if all_cers:
        avg = sum(all_cers) / len(all_cers)
        print(f"\nRata-rata CER: {avg:.3f}  (akurasi karakter {(1-avg)*100:.1f}%) dari {len(all_cers)} halaman berlabel")
    else:
        print("\n(Tidak ada kunci jawaban .gt.txt — CER tak dihitung; hanya confidence & layout.)")


if __name__ == "__main__":
    main()
