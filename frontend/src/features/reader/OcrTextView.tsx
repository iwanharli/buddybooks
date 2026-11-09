import type { ReactNode } from "react";
import { Image as ImageIcon, TriangleAlert } from "lucide-react";
import type { OcrSegment } from "./parseOcrText";

const UNREADABLE_MARKER = "[TIDAK TERBACA]";
// Teks tebal di buku asli ditandai VLM dengan **dua bintang** (lihat instruksi
// di ocr-service/vlm_assist.py PROMPT) — konvensi markdown yang familiar,
// bukan tag [BRACKET] seperti struktur baris, karena ini penanda INLINE di
// tengah kalimat, bukan seluruh baris.
const BOLD_RE = /\*\*(.+?)\*\*/g;

/** Pecah teks satu segmen jadi node React: tandai bagian "[TIDAK TERBACA]"
 * (AI mengaku tidak bisa baca — lihat instruksi anti-halusinasi) dan bagian
 * **tebal** (dicetak tebal di buku aslinya) dengan gaya berbeda dari teks
 * biasa di sekitarnya. */
function renderInline(text: string) {
  if (!text.includes(UNREADABLE_MARKER) && !text.includes("**")) return text;

  const nodes: ReactNode[] = [];
  const unreadableParts = text.split(UNREADABLE_MARKER);
  unreadableParts.forEach((part, i) => {
    if (part) {
      // Pecah lagi bagian ini di penanda **tebal**.
      let lastIndex = 0;
      let boldIndex = 0;
      for (const m of part.matchAll(BOLD_RE)) {
        if (m.index! > lastIndex) {
          nodes.push(<span key={`t${i}-${boldIndex}`}>{part.slice(lastIndex, m.index)}</span>);
        }
        nodes.push(
          <strong key={`b${i}-${boldIndex}`} className="font-semibold">
            {m[1]}
          </strong>
        );
        lastIndex = m.index! + m[0].length;
        boldIndex++;
      }
      if (lastIndex < part.length) {
        nodes.push(<span key={`t${i}-end`}>{part.slice(lastIndex)}</span>);
      }
    }
    if (i < unreadableParts.length - 1) {
      nodes.push(
        <span
          key={`u${i}`}
          title="Bagian ini tidak bisa dibaca dengan yakin oleh AI — bukan bagian asli buku yang hilang, tapi tanda ketidakpastian"
          className="mx-0.5 rounded bg-amber-50 px-1 text-xs italic text-amber-700"
        >
          ‹tidak terbaca›
        </span>
      );
    }
  });
  return nodes;
}

/** Render segmen hasil parseOcrText() sebagai tipografi asli: judul besar,
 * paragraf rapi, nomor halaman kecil di tengah, penanda gambar/ilustrasi —
 * bukan tag mentah "[JUDUL] ..." sebagai teks polos. */
export function OcrTextView({ segments }: { segments: OcrSegment[] }) {
  if (segments.length === 0) {
    return <span className="italic text-[var(--color-ink-muted)]">(belum ada teks terbaca)</span>;
  }

  return (
    <div className="space-y-3">
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "bab":
            return (
              <p
                key={i}
                className="mt-4 border-b border-[var(--color-border)] pb-2 text-center font-[family-name:var(--font-heading)] text-xl font-bold leading-tight text-[var(--color-ink)] first:mt-0"
              >
                {renderInline(seg.text)}
              </p>
            );
          case "judul":
            return (
              <p
                key={i}
                className="font-[family-name:var(--font-heading)] text-base font-semibold leading-snug text-[var(--color-ink)]"
              >
                {renderInline(seg.text)}
              </p>
            );
          case "kutipan":
            return (
              <blockquote
                key={i}
                className="rounded-r-md border-l-2 border-[var(--color-accent)] bg-[var(--color-surface)] py-2 pl-3 pr-2 text-sm italic leading-relaxed text-[var(--color-ink-soft)]"
              >
                {renderInline(seg.text)}
              </blockquote>
            );
          case "peringatan":
            return (
              <p
                key={i}
                className="flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-sm font-medium text-red-700"
              >
                <TriangleAlert size={14} className="shrink-0" />
                {seg.text} — sebaiknya foto ulang halaman ini.
              </p>
            );
          case "halaman":
            return (
              <p key={i} className="text-center text-xs tabular-nums text-[var(--color-ink-muted)]">
                — {seg.text} —
              </p>
            );
          case "gambar":
            return (
              <p
                key={i}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-ink-muted)]"
              >
                <ImageIcon size={13} />
                {seg.text || "Ada gambar/ilustrasi di halaman ini"}
              </p>
            );
          case "paragraf":
          case "plain":
          default:
            return (
              <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink)]">
                {renderInline(seg.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
