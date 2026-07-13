"""
Segmentasi bentang halaman (page-spread) dari hasil OCR.

Foto buku bisa berisi:
  - satu halaman penuh;
  - satu halaman utama + halaman sebelah yang terpotong/parsial (di dekat
    lipatan tengah) -> halaman parsial diabaikan;
  - dua halaman penuh sekaligus -> dibaca terpisah, tahu mana kiri/kanan.

Pendekatan: RapidOCR memberi kotak per baris teks. Kita analisis sebaran
posisi-x pusat kotak. Bentang dua halaman menunjukkan dua gugus terpisah
oleh celah (gutter/lipatan) di tengah. Halaman parsial = gugus kecil yang
dibuang.
"""
from typing import Any


def _xcenter(box) -> float:
    return sum(p[0] for p in box) / len(box)


def _char_count(items) -> int:
    return sum(len(it[1]) for it in items)


def _reading_order(items) -> list:
    # Urut baca: atas -> bawah (dikelompokkan per baris), lalu kiri -> kanan.
    return sorted(items, key=lambda it: (round(it[0][0][1] / 20), it[0][0][0]))


def _text_and_conf(items) -> tuple[str, float]:
    ordered = _reading_order(items)
    text = "\n".join(it[1] for it in ordered)
    conf = sum(float(it[2]) for it in ordered) / len(ordered) if ordered else 0.0
    return text, conf


def segment_pages(
    result: list[Any],
    image_width: int,
    min_gutter_ratio: float = 0.045,
    min_side_ratio: float = 0.15,
) -> tuple[list[dict], str]:
    """Kembalikan (daftar_halaman, layout).

    layout: 'single' | 'single-dominant' | 'spread'.
    Tiap halaman: {label, text, confidence, side}.
    """
    items = list(result or [])
    if len(items) < 2:
        text, conf = _text_and_conf(items)
        return [{"label": "halaman", "side": "single", "text": text, "confidence": conf,
                 "char_count": _char_count(items)}], "single"

    # Cari gutter = celah terbesar antar pusat-x kotak. Pita lebar (15-85%)
    # agar halaman parsial yang sempit (celah bergeser dari tengah) tetap
    # terdeteksi, tetapi tepi ekstrem diabaikan untuk hindari artefak.
    centers = sorted(_xcenter(it[0]) for it in items)
    lo, hi = image_width * 0.15, image_width * 0.85
    best_gap, gutter = 0.0, None
    for a, b in zip(centers, centers[1:]):
        mid = (a + b) / 2
        if lo <= mid <= hi and (b - a) > best_gap:
            best_gap, gutter = b - a, mid

    # Celah harus cukup lebar untuk dianggap lipatan (bukan spasi antar kata).
    if gutter is None or best_gap < image_width * min_gutter_ratio:
        text, conf = _text_and_conf(items)
        return [{"label": "halaman", "side": "single", "text": text, "confidence": conf,
                 "char_count": _char_count(items)}], "single"

    left = [it for it in items if _xcenter(it[0]) < gutter]
    right = [it for it in items if _xcenter(it[0]) >= gutter]
    lc, rc = _char_count(left), _char_count(right)
    total = lc + rc

    lt, lconf = _text_and_conf(left)
    rt, rconf = _text_and_conf(right)
    small_items, small_chars, small_conf = (left, lc, lconf) if lc <= rc else (right, rc, rconf)
    small_ratio = (small_chars / total) if total else 0.0

    # Sisi kecil dibuang bila:
    #  - sangat kecil (sliver), ATAU
    #  - kecil-sedang DAN keyakinan rendah (khas fragmen terpotong/melengkung
    #    dekat lipatan yang tidak terbaca dengan baik).
    drop_small = small_ratio < min_side_ratio or (small_ratio < 0.30 and small_conf < 0.65)
    if drop_small and small_items is not None:
        main = right if small_items is left else left
        text, conf = _text_and_conf(main)
        return (
            [{"label": "halaman", "side": "dominant", "text": text, "confidence": conf,
              "char_count": _char_count(main)}],
            "single-dominant",
        )

    # Dua halaman penuh: baca terpisah, urutan baca kiri lalu kanan.
    return (
        [
            {"label": "halaman kiri", "side": "left", "text": lt, "confidence": lconf, "char_count": lc},
            {"label": "halaman kanan", "side": "right", "text": rt, "confidence": rconf, "char_count": rc},
        ],
        "spread",
    )
