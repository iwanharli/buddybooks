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
    # buang label struktur opsional di gt.txt, mis. "[JUDUL] ", "[PARAGRAF] ",
    # "[FOOTNOTE] ", "[HALAMAN] ", "[GAMBAR] ", "[GAMBAR&TEKS] " — bukan teks
    # asli buku, jadi tak ikut dihitung CER.
    t = re.sub(r"(?m)^\[[A-ZÄÖÜÇ²³&]+\]\s*", "", t)
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
    ap.add_argument("--vlm-fallback", action="store_true",
                    help="Panggil Gemini untuk membaca ulang halaman low_coverage")
    args = ap.parse_args()

    read_page = None
    if args.vlm_fallback:
        sys.path.insert(0, str(EVAL.parent))
        from vlm_assist import read_page

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
    vlm_cers = []

    for d in book_dirs:
        imgs = sorted(p for p in d.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        if not imgs:
            continue
        case = read_case(d)
        print(f"\n=== {d.name}" + (f" — {case}" if case else "") + " ===")

        for img_path in imgs:
            pil = Image.open(img_path).convert("RGB")
            arr = np.array(pil)
            if args.dewarp:
                arr, _ = dewarp_image(arr)
            result, _ = engine(arr)
            pages, layout = segment_pages(result or [], arr.shape[1], arr.shape[0])

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

                vlm_str = ""
                if read_page is not None and p.get("low_coverage"):
                    try:
                        vlm_text, provider = read_page(pil, p["text"], side=p["side"])
                    except Exception as e:
                        vlm_text, provider = "", ""
                        vlm_str = f", VLM-err={e}"
                    if vlm_text and gt is not None:
                        vc = cer(gt, vlm_text)
                        vlm_cers.append((c, vc))
                        vlm_str = f", VLM-CER={vc:.3f} ({provider})"

                first = p["text"].splitlines()[0] if p["text"] else "(kosong)"
                cov = f" cov={p['coverage']:.3f}" if "coverage" in p else ""
                flag = " ⚠LOW-COV" if p.get("low_coverage") else ""
                print(f"      [{p['side']:<8}] conf={p['confidence']:.2f}{cov}{cer_str}{flag}{vlm_str}  {first!r}")

    if all_cers:
        avg = sum(all_cers) / len(all_cers)
        print(f"\nRata-rata CER: {avg:.3f}  (akurasi karakter {(1-avg)*100:.1f}%) dari {len(all_cers)} halaman berlabel")
    else:
        print("\n(Tidak ada kunci jawaban .gt.txt — CER tak dihitung; hanya confidence & layout.)")

    if vlm_cers:
        before = sum(c for c, _ in vlm_cers) / len(vlm_cers)
        after = sum(vc for _, vc in vlm_cers) / len(vlm_cers)
        wins = sum(1 for c, vc in vlm_cers if vc < c)
        print(f"\nVLM-fallback (Gemini) pada {len(vlm_cers)} halaman ⚠LOW-COV:")
        print(f"  CER sebelum : {before:.3f}")
        print(f"  CER sesudah : {after:.3f}")
        print(f"  Menang di {wins}/{len(vlm_cers)} halaman")


if __name__ == "__main__":
    main()
