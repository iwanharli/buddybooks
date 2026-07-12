"""
Harness evaluasi OCR: jalankan semua foto di eval/images/ lewat engine
(RapidOCR + opsi dewarp), lalu laporkan confidence per foto. Bila ada
kunci jawaban di eval/expected/<nama-relatif>.txt, hitung Character Error
Rate (CER) sebagai ukuran akurasi objektif.

Pakai (dari folder ocr-service, venv aktif):
    .venv/bin/python eval/run_eval.py            # tanpa dewarp
    .venv/bin/python eval/run_eval.py --dewarp   # bandingkan dewarp on/off
    .venv/bin/python eval/run_eval.py --save      # simpan hasil ke eval/results/

Struktur:
    eval/images/<kategori>/<nama>.jpg   -> foto uji
    eval/expected/<kategori>/<nama>.txt -> teks kebenaran (opsional)
"""
import argparse
import csv
import re
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

EVAL_DIR = Path(__file__).resolve().parent
IMAGES_DIR = EVAL_DIR / "images"
EXPECTED_DIR = EVAL_DIR / "expected"
RESULTS_DIR = EVAL_DIR / "results"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def normalize(text: str) -> str:
    """Samakan whitespace agar perbandingan adil (bukan soal spasi/enter)."""
    return re.sub(r"\s+", " ", text).strip().lower()


def cer(reference: str, hypothesis: str) -> float:
    """Character Error Rate via jarak Levenshtein. 0 = sempurna, 1 = total salah."""
    ref, hyp = normalize(reference), normalize(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0
    # DP Levenshtein
    prev = list(range(len(hyp) + 1))
    for i, rc in enumerate(ref, 1):
        cur = [i]
        for j, hc in enumerate(hyp, 1):
            cost = 0 if rc == hc else 1
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost))
        prev = cur
    return prev[-1] / len(ref)


def find_images():
    if not IMAGES_DIR.exists():
        return []
    return sorted(p for p in IMAGES_DIR.rglob("*") if p.suffix.lower() in IMAGE_EXTS)


def expected_for(image_path: Path) -> str | None:
    rel = image_path.relative_to(IMAGES_DIR).with_suffix(".txt")
    gt = EXPECTED_DIR / rel
    return gt.read_text(encoding="utf-8") if gt.exists() else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dewarp", action="store_true", help="bandingkan dewarp on/off")
    parser.add_argument("--save", action="store_true", help="simpan hasil ke eval/results/")
    args = parser.parse_args()

    images = find_images()
    if not images:
        print(f"Belum ada foto di {IMAGES_DIR}/. Taruh foto (boleh dalam subfolder kategori),")
        print("opsional dengan kunci jawaban .txt di eval/expected/ berstruktur sama.")
        return

    # Import di sini agar pesan "belum ada foto" cepat tanpa memuat model.
    from rapidocr_onnxruntime import RapidOCR
    sys.path.insert(0, str(EVAL_DIR.parent))
    from dewarp import dewarp_image

    engine = RapidOCR()

    def run(arr):
        result, _ = engine(arr)
        if not result:
            return "", 0.0
        items = sorted(result, key=lambda r: (round(r[0][0][1] / 20), r[0][0][0]))
        text = "\n".join(it[1] for it in items)
        conf = sum(float(it[2]) for it in items) / len(items)
        return text, conf

    rows = []
    print(f"\nMengevaluasi {len(images)} foto...\n")
    header = f"{'foto':<38} {'conf':>6} {'CER':>7}"
    if args.dewarp:
        header += f" {'conf+dw':>8} {'CER+dw':>8}"
    print(header)
    print("-" * len(header))

    for img_path in images:
        rel = str(img_path.relative_to(IMAGES_DIR))
        arr = np.array(Image.open(img_path).convert("RGB"))
        gt = expected_for(img_path)

        text, conf = run(arr)
        c = cer(gt, text) if gt is not None else None
        line = f"{rel:<38} {conf:>6.2f} {(f'{c:.3f}' if c is not None else '  -   '):>7}"
        row = {"image": rel, "confidence": round(conf, 4), "cer": (round(c, 4) if c is not None else "")}

        if args.dewarp:
            dw, used = dewarp_image(arr)
            text_dw, conf_dw = run(dw)
            c_dw = cer(gt, text_dw) if gt is not None else None
            line += f" {conf_dw:>8.2f} {(f'{c_dw:.3f}' if c_dw is not None else '  -   '):>8}"
            row.update({"confidence_dewarp": round(conf_dw, 4),
                        "cer_dewarp": (round(c_dw, 4) if c_dw is not None else ""),
                        "dewarp_applied": used})
        print(line)
        rows.append(row)

    # Ringkasan
    confs = [r["confidence"] for r in rows]
    cers = [r["cer"] for r in rows if r["cer"] != ""]
    print("-" * len(header))
    print(f"Rata-rata confidence: {sum(confs)/len(confs):.3f}")
    if cers:
        print(f"Rata-rata CER       : {sum(cers)/len(cers):.3f}  (semakin kecil semakin akurat)")
        print(f"Akurasi karakter    : {(1 - sum(cers)/len(cers))*100:.1f}%")
    else:
        print("(Tidak ada kunci jawaban di eval/expected/ — CER tak dihitung.)")

    if args.save and rows:
        RESULTS_DIR.mkdir(exist_ok=True)
        out = RESULTS_DIR / f"eval_{datetime.now():%Y%m%d_%H%M%S}.csv"
        with out.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        print(f"\nHasil disimpan: {out}")


if __name__ == "__main__":
    main()
