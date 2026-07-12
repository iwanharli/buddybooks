export interface EntityMention {
  id: string;
  entity_type: "person" | "place" | "organization" | "date" | "work_title" | "other";
  surface_text: string;
  normalized_text?: string;
  char_start: number;
  char_end: number;
}

const COLOR_BY_TYPE: Record<EntityMention["entity_type"], string> = {
  person: "bg-amber-200/70",
  place: "bg-emerald-200/70",
  organization: "bg-sky-200/70",
  date: "bg-violet-200/70",
  work_title: "bg-rose-200/70",
  other: "bg-gray-200/70",
};

interface HighlightedTextProps {
  text: string;
  mentions: EntityMention[];
  onMentionClick?: (mention: EntityMention) => void;
}

/**
 * Merender teks OCR/koreksi dengan highlight nama tokoh/tempat/organisasi
 * berdasarkan posisi char_start/char_end dari book_entity_mentions.
 * Mention yang tumpang tindih diabaikan (diasumsikan sudah bersih dari backend).
 */
export function HighlightedText({ text, mentions, onMentionClick }: HighlightedTextProps) {
  const sorted = [...mentions].sort((a, b) => a.char_start - b.char_start);

  const segments: { text: string; mention?: EntityMention }[] = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.char_start < cursor) continue; // lewati overlap
    if (m.char_start > cursor) segments.push({ text: text.slice(cursor, m.char_start) });
    segments.push({ text: text.slice(m.char_start, m.char_end), mention: m });
    cursor = m.char_end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });

  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {segments.map((seg, i) =>
        seg.mention ? (
          <mark
            key={i}
            title={`${seg.mention.entity_type}: ${seg.mention.normalized_text ?? seg.mention.surface_text}`}
            onClick={() => onMentionClick?.(seg.mention!)}
            className={`cursor-pointer rounded px-0.5 ${COLOR_BY_TYPE[seg.mention.entity_type]}`}
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}
