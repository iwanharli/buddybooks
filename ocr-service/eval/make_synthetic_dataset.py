"""
Generator dataset uji berlabel: halaman teks Indonesia (ejaan lama) dengan
berbagai distorsi (datar, miring, melengkung ringan/berat, cahaya redup),
lengkap dengan kunci jawaban di eval/expected/.

Berguna karena dataset publik (DocUNet/WarpDoc) berbahasa Inggris dan tanpa
kunci teks; ini menghasilkan data berlabel yang mirip kasus nyata buku
Indonesia, sehingga CER bisa dihitung dan engine bisa disetel terukur.

Pakai (dari folder ocr-service):
    .venv/bin/python eval/make_synthetic_dataset.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

EVAL = Path(__file__).resolve().parent
IMAGES = EVAL / "images"
EXPECTED = EVAL / "expected"
FONT_PATH = "/System/Library/Fonts/Supplemental/Times New Roman.ttf"

# Paragraf contoh dengan ejaan lama (Van Ophuijsen) + modern, khas buku tua.
PARAGRAPHS = {
    "dbbr": [
        "Djalan tempat tragedi itoe terdjadi meroepakan seboeah",
        "gang simpang dari djalan raja. Toko Njonja Ascher",
        "terletak di pertengahan roeas djalan, di sebelah kanan.",
        "Pada waktoe kami membelok ke djalan itoe Poirot",
        "melihat ke arlodjinja, dan akoe baroe mengerti mengapa",
        "dia menoenda melihat tempat kedjadian perkara.",
    ],
    "revolusi": [
        "Di bawah bendera revolusi kita berdjoang bersama",
        "menentang pendjadjahan dan menegakkan kemerdekaan.",
        "Sedjarah bangsa ditulis oleh mereka jang berani",
        "melawan, boekan oleh mereka jang berdiam diri sadja.",
        "Tahoen 1945 mendjadi saksi lahirnja repoeblik ini",
        "setelah berabad-abad di bawah kekoeasaan asing.",
    ],
    "sastra": [
        "Sitti Noerbaja berdjalan menjoesoeri tepi pantai",
        "sambil memandang laoet jang biroe tak berbatas.",
        "Hatinja gundah memikirkan nasib jang menimpanja,",
        "terpaksa menikah dengan orang jang tiada ditjintainja.",
        "Angin sendja berhemboes lemboet menerpa wadjahnja",
        "membawa aroma garam dan kenangan masa ketjil.",
    ],
}


def render_page(lines, page_size=(1000, 900), fontsize=34, text_rgb=(20, 20, 20),
                margin=110):
    """Render halaman putih lalu tempel di atas latar gelap bertekstur, dengan
    margin di sekeliling. Ini meniru foto HP (halaman di atas meja gelap) dan
    memberi BATAS HALAMAN yang dibutuhkan page-dewarp untuk mendeteksi."""
    pw, ph = page_size
    page = Image.new("RGB", (pw, ph), (255, 255, 255))
    d = ImageDraw.Draw(page)
    font = ImageFont.truetype(FONT_PATH, fontsize)
    y = 90
    for ln in lines:
        d.text((70, y), ln, fill=text_rgb, font=font)
        y += int(fontsize * 2.1)

    # Latar gelap bertekstur (meja) + margin.
    cw, ch = pw + 2 * margin, ph + 2 * margin
    bg = np.random.randint(45, 70, (ch, cw, 3), dtype=np.uint8)  # abu gelap + noise
    bg[margin:margin + ph, margin:margin + pw] = np.array(page)
    return bg


def curl(arr, amp):
    h, w = arr.shape[:2]
    xs, ys = np.meshgrid(np.arange(w), np.arange(h))
    map_x = xs.astype(np.float32)
    map_y = (ys + amp * np.sin(np.pi * xs / w)).astype(np.float32)
    return cv2.remap(arr, map_x, map_y, cv2.INTER_LINEAR, borderValue=(55, 55, 55))


def skew(arr, dx=140):
    h, w = arr.shape[:2]
    src = np.float32([[0, 0], [w, 0], [0, h], [w, h]])
    dst = np.float32([[dx, 0], [w, 40], [0, h - 40], [w - dx, h]])
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(arr, M, (w, h), borderValue=(55, 55, 55))


def low_light(arr):
    # gelapkan + gradien pencahayaan tidak rata
    h, w = arr.shape[:2]
    grad = np.tile(np.linspace(0.45, 0.9, w), (h, 1))[:, :, None]
    return np.clip(arr.astype(np.float32) * grad, 0, 255).astype(np.uint8)


def save(case, name, arr, lines):
    (IMAGES / case).mkdir(parents=True, exist_ok=True)
    (EXPECTED / case).mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(IMAGES / case / f"{name}.png"), cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))
    (EXPECTED / case / f"{name}.txt").write_text("\n".join(lines), encoding="utf-8")


def main():
    n = 0
    for key, lines in PARAGRAPHS.items():
        flat = render_page(lines)
        # flat (baseline) -> taruh di 'skewed' folder? beri folder 'flat'
        save("flat", key, flat, lines)
        save("skewed", key, skew(flat), lines)
        save("curved", f"{key}_ringan", curl(flat, 20), lines)
        save("curved", f"{key}_berat", curl(flat, 42), lines)
        save("low-light", key, low_light(flat), lines)
        n += 5
    print(f"Selesai: {n} gambar berlabel di eval/images/ (+ kunci jawaban di eval/expected/)")
    print("Kategori: flat, skewed, curved (ringan/berat), low-light")


if __name__ == "__main__":
    # tambah folder 'flat' ke struktur
    (IMAGES / "flat").mkdir(parents=True, exist_ok=True)
    main()
