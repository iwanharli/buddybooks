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

Selain teks, tiap halaman melaporkan METRIK CAKUPAN (coverage):
  - n_lines       : jumlah kotak/baris teks terdeteksi;
  - coverage      : luas kotak-teks / luas area halaman (0..1);
  - span_ratio    : rentang vertikal teks (atas..bawah) / tinggi gambar;
  - low_coverage  : True bila halaman kemungkinan besar under-read (banyak
                    teks tak terdeteksi, mis. permukaan melengkung).
Ini penting karena `confidence` RapidOCR hanya mengukur ketajaman glyph yang
terbaca, BUKAN seberapa lengkap halaman terbaca — halaman yang 98% teksnya
hilang tetap bisa ber-confidence 0.99.
"""
from typing import Any

# Ambang: bentang baru dianggap sah bila SISI TERKECIL punya cukup teks.
# Mencegah 1-2 fragmen (khas under-read parah / show-through) dibelah palsu
# menjadi dua halaman. Dipatok dari karakter (bukan baris) agar halaman
# jarang-teks yang sah — mis. halaman dedikasi 2 baris — tetap terbaca
# sebagai bentang.
MIN_SIDE_CHARS = 25

# Ambang tanda low_coverage.
LOW_COVERAGE_AREA = 0.02   # <2% area halaman tertutup teks
LOW_COVERAGE_SPAN = 0.25   # teks hanya membentang <25% tinggi gambar ...
LOW_COVERAGE_LINES = 5     # ... DAN baris sedikit

# Sinyal "baris terpotong" (khas halaman melengkung dekat lipatan atau tepi
# keluar bingkai): banyak baris terdeteksi, TAPI tiap baris cuma tertangkap
# beberapa huruf pertama saja. Beda dari LOW_COVERAGE_AREA/SPAN di atas —
# metrik itu mengukur "terlalu sedikit teks", ini mengukur "teksnya ada
# tapi tiap baris terpenggal", yang tidak lolos ambang manapun karena
# jumlah baris & confidence-nya bisa tetap tinggi (lihat catatan modul).
TRUNCATED_LINE_CHARS = 15  # rata-rata karakter per baris di bawah ini = curiga
TRUNCATED_LINE_MIN_LINES = 5


def _xcenter(box) -> float:
    return sum(p[0] for p in box) / len(box)


def _char_count(items) -> int:
    return sum(len(it[1]) for it in items)


def _box_area(box) -> float:
    # Luas poligon (shoelace) untuk kotak kuad, tahan kotak miring.
    n = len(box)
    s = 0.0
    for i in range(n):
        x1, y1 = box[i]
        x2, y2 = box[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def _reading_order(items) -> list:
    # Urut baca: atas -> bawah (dikelompokkan per baris), lalu kiri -> kanan.
    return sorted(items, key=lambda it: (round(it[0][0][1] / 20), it[0][0][0]))


def _text_and_conf(items) -> tuple[str, float]:
    ordered = _reading_order(items)
    text = "\n".join(it[1] for it in ordered)
    conf = sum(float(it[2]) for it in ordered) / len(ordered) if ordered else 0.0
    return text, conf


def _is_truncated(items) -> bool:
    """True bila banyak baris terdeteksi tapi tiap baris cuma tertangkap
    beberapa huruf pertama — pola khas halaman melengkung dekat lipatan
    atau tepi yang keluar bingkai (lihat TRUNCATED_LINE_CHARS)."""
    n = len(items)
    if n < TRUNCATED_LINE_MIN_LINES:
        return False
    avg_chars = _char_count(items) / n
    return avg_chars < TRUNCATED_LINE_CHARS


def _metrics(items, side_width: float, image_height: int | None) -> dict:
    """Metrik cakupan untuk satu himpunan kotak (satu halaman)."""
    n_lines = len(items)
    coverage = None
    span_ratio = None
    if image_height and side_width and n_lines:
        area = sum(_box_area(it[0]) for it in items)
        coverage = area / (side_width * image_height)
        ys = [p[1] for it in items for p in it[0]]
        span_ratio = (max(ys) - min(ys)) / image_height

    # Halaman tanpa teks terdeteksi = jelas under-read (mis. cover kosong,
    # atau deteksi gagal total): selalu low_coverage.
    low = n_lines == 0
    if coverage is not None:
        low = coverage < LOW_COVERAGE_AREA or (
            span_ratio is not None
            and span_ratio < LOW_COVERAGE_SPAN
            and n_lines < LOW_COVERAGE_LINES
        )
    # Baris terpotong lolos dari dua ambang di atas (banyak baris & coverage
    # area bisa tetap "normal" walau isinya cuma pecahan huruf pertama tiap
    # baris) — dicek terpisah, bukan pengganti.
    low = low or _is_truncated(items)

    m = {"n_lines": n_lines, "low_coverage": low}
    if coverage is not None:
        m["coverage"] = round(coverage, 4)
        m["span_ratio"] = round(span_ratio, 4)
    return m


def _page(label, side, items, side_width, image_height) -> dict:
    text, conf = _text_and_conf(items)
    return {
        "label": label,
        "side": side,
        "text": text,
        "confidence": conf,
        "char_count": _char_count(items),
        **_metrics(items, side_width, image_height),
    }


def segment_pages(
    result: list[Any],
    image_width: int,
    image_height: int | None = None,
    min_gutter_ratio: float = 0.045,
    min_side_ratio: float = 0.15,
) -> tuple[list[dict], str]:
    """Kembalikan (daftar_halaman, layout).

    layout: 'single' | 'single-dominant' | 'spread'.
    Tiap halaman: {label, side, text, confidence, char_count, n_lines,
    low_coverage, coverage?, span_ratio?}.
    """
    items = list(result or [])
    if len(items) < 2:
        return [_page("halaman", "single", items, image_width, image_height)], "single"

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
        return [_page("halaman", "single", items, image_width, image_height)], "single"

    left = [it for it in items if _xcenter(it[0]) < gutter]
    right = [it for it in items if _xcenter(it[0]) >= gutter]
    lc, rc = _char_count(left), _char_count(right)
    total = lc + rc

    lconf = _text_and_conf(left)[1]
    rconf = _text_and_conf(right)[1]
    small_items, small_chars, small_conf = (left, lc, lconf) if lc <= rc else (right, rc, rconf)
    small_ratio = (small_chars / total) if total else 0.0

    # Guard bentang: sisi terkecil harus punya cukup teks. Bila terlalu tipis
    # (khas under-read parah / show-through yang menyisakan 1-2 fragmen),
    # jangan dibelah jadi dua halaman.
    too_thin = min(lc, rc) < MIN_SIDE_CHARS

    # Sisi kecil dibuang bila:
    #  - sangat kecil (sliver), ATAU
    #  - kecil-sedang DAN keyakinan rendah (khas fragmen terpotong/melengkung
    #    dekat lipatan yang tidak terbaca dengan baik).
    drop_small = small_ratio < min_side_ratio or (small_ratio < 0.30 and small_conf < 0.65)

    # Sisi "baris terpotong" (lihat _is_truncated): bisa lolos dua ambang di
    # atas kalau jumlah baris & confidence-nya tetap tinggi (khas halaman
    # melengkung dekat lipatan — tiap baris tetap terbaca TAJAM, cuma
    # terpotong di beberapa huruf pertama). Dicek terpisah dari drop_small
    # karena sinyalnya beda: bukan "teks sedikit", tapi "teks banyak namun
    # tiap baris tidak lengkap" — halaman begini TIDAK BERGUNA disimpan
    # sebagai halaman kedua, walau char count-nya tidak kecil.
    left_truncated = _is_truncated(left)
    right_truncated = _is_truncated(right)

    if too_thin:
        # Tidak yakin ini bentang; perlakukan seluruh gambar sebagai satu
        # halaman (tandai low_coverage lewat metrik).
        return [_page("halaman", "single", items, image_width, image_height)], "single"

    if left_truncated != right_truncated:
        # Persis satu sisi terpotong: buang sisi itu, sisi lain jadi dominan.
        main = right if left_truncated else left
        return [_page("halaman", "dominant", main, image_width, image_height)], "single-dominant"

    if drop_small and small_items is not None:
        main = right if small_items is left else left
        return [_page("halaman", "dominant", main, image_width, image_height)], "single-dominant"

    # Dua halaman penuh: baca terpisah, urutan baca kiri lalu kanan.
    left_w = gutter
    right_w = image_width - gutter
    return (
        [
            _page("halaman kiri", "left", left, left_w, image_height),
            _page("halaman kanan", "right", right, right_w, image_height),
        ],
        "spread",
    )
