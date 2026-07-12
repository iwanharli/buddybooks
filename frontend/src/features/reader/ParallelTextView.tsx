import { useState } from "react";
import { HighlightedText, type EntityMention } from "./HighlightedText";

interface ParallelTextViewProps {
  originalText: string;
  translatedText?: string;
  mentions: EntityMention[];
  sourceLanguageName?: string;
}

type ViewMode = "both" | "original" | "translated";

/**
 * Tampilan paralel teks asli vs terjemahan Inggris, sesuai docs/reader-module.md
 * bagian 27.3 (Tampilan baca). Pengguna dapat memilih mode tampilan.
 */
export function ParallelTextView({
  originalText,
  translatedText,
  mentions,
  sourceLanguageName = "Asli",
}: ParallelTextViewProps) {
  const [mode, setMode] = useState<ViewMode>("both");

  return (
    <div>
      <div className="mb-3 flex gap-2 text-xs">
        {(["both", "original", "translated"] as ViewMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full border px-3 py-1 ${
              mode === m
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-border)]"
            }`}
          >
            {m === "both" ? "Keduanya" : m === "original" ? sourceLanguageName : "Inggris"}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${mode === "both" ? "grid-cols-2" : "grid-cols-1"}`}>
        {(mode === "both" || mode === "original") && (
          <div className="rounded-lg border border-[var(--color-border)] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              {sourceLanguageName}
            </p>
            <HighlightedText text={originalText} mentions={mentions} />
          </div>
        )}
        {(mode === "both" || mode === "translated") && (
          <div className="rounded-lg border border-[var(--color-border)] p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              Inggris
            </p>
            <p className="whitespace-pre-wrap leading-relaxed text-[var(--color-ink-soft)]">
              {translatedText ?? "Belum diterjemahkan"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
