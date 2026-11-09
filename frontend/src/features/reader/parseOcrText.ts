// Tag struktur yang diminta lewat prompt VLM (lihat ocr-service/vlm_assist.py
// PROMPT) dan dipakai konsisten di ground-truth eval (ocr-service/eval/books).
// RapidOCR mentah TIDAK menghasilkan tag ini — baru muncul setelah teks
// dibaca ulang lewat Gemini/OpenRouter (fallback otomatis atau "Scan Ulang").
const TAG_RE = /^\[([A-ZÄÖÜÇ²³&]+)\]\s*(.*)$/;

export type OcrSegment =
  | { type: "judul"; text: string }
  | { type: "bab"; text: string }
  | { type: "kutipan"; text: string }
  | { type: "paragraf"; text: string }
  | { type: "halaman"; text: string }
  | { type: "gambar"; text: string }
  | { type: "peringatan"; text: string }
  | { type: "plain"; text: string };

/** Pecah ocr_text jadi segmen bertipe. Teks tanpa tag sama sekali (RapidOCR
 * mentah, belum sempat di-VLM) jatuh ke satu segmen "plain" apa adanya. */
export function parseOcrText(raw: string): OcrSegment[] {
  const lines = raw.split("\n");
  const hasAnyTag = lines.some((l) => TAG_RE.test(l.trim()));

  if (!hasAnyTag) {
    return raw.trim() ? [{ type: "plain", text: raw }] : [];
  }

  const segments: OcrSegment[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = TAG_RE.exec(trimmed);
    if (!match) {
      segments.push({ type: "plain", text: trimmed });
      continue;
    }
    const [, tag, text] = match;
    if (tag === "JUDUL") segments.push({ type: "judul", text });
    else if (tag === "BAB") segments.push({ type: "bab", text });
    else if (tag === "KUTIPAN") segments.push({ type: "kutipan", text });
    else if (tag === "HALAMAN") segments.push({ type: "halaman", text });
    else if (tag.includes("GAMBAR")) segments.push({ type: "gambar", text });
    // KUALITAS BURUK: AI menilai foto SECARA KESELURUHAN buram/goyang/salah
    // fokus (bukan cuma satu bagian tak terbaca seperti [TIDAK TERBACA]) —
    // beda level, jadi segmen sendiri supaya bisa ditonjolkan sebagai
    // peringatan, bukan ikut campur dengan paragraf biasa.
    else if (tag.includes("KUALITAS")) segments.push({ type: "peringatan", text: text || "Kualitas foto buruk" });
    else segments.push({ type: "paragraf", text }); // PARAGRAF, FOOTNOTE, dll.
  }
  return segments;
}

/** True bila salah satu segmen menandai kualitas foto buruk secara
 * keseluruhan — dipakai BookContentTab untuk badge peringatan di header
 * kartu halaman (tanpa perlu parse ulang di sana). */
export function hasQualityWarning(segments: OcrSegment[]): boolean {
  return segments.some((s) => s.type === "peringatan");
}

/** Pisahkan segmen "halaman" (nomor cetak, mis. "— 15 —") dari alur teks
 * utama — nomor halaman ditampilkan terpisah di pojok kartu (bukan disisipkan
 * di tengah paragraf sesuai urutan aslinya di OCR), jadi tata letak kartu
 * tetap rapi terlepas di mana nomor itu terdeteksi pada halaman. */
export function splitPageMarker(segments: OcrSegment[]): { content: OcrSegment[]; pageMarker: string | null } {
  const pageMarker = segments.find((s) => s.type === "halaman")?.text ?? null;
  const content = segments.filter((s) => s.type !== "halaman");
  return { content, pageMarker };
}
