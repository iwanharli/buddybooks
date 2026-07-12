export interface Chapter {
  id: string;
  chapter_no?: number;
  title?: string;
  page_start_sequence?: number;
  summary_en?: string;
}

interface ChapterNavProps {
  chapters: Chapter[];
  activeChapterId?: string;
  onSelect: (chapter: Chapter) => void;
}

export function ChapterNav({ chapters, activeChapterId, onSelect }: ChapterNavProps) {
  return (
    <nav className="space-y-1">
      {chapters.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c)}
          className={`block w-full rounded-md px-3 py-2 text-left text-sm ${
            activeChapterId === c.id
              ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
              : "text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
          }`}
        >
          {c.chapter_no ? `Bab ${c.chapter_no}` : "Bab"}
          {c.title ? ` — ${c.title}` : ""}
        </button>
      ))}
    </nav>
  );
}
