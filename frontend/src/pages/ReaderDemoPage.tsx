import { useState } from "react";
import { PageZoomViewer } from "../features/reader/PageZoomViewer";
import { ParallelTextView } from "../features/reader/ParallelTextView";
import { ChapterNav, type Chapter } from "../features/reader/ChapterNav";
import { PageFlipBook } from "../features/reader/PageFlipBook";
import type { EntityMention } from "../features/reader/HighlightedText";

const sampleChapters: Chapter[] = [
  { id: "1", chapter_no: 1, title: "Pendahuluan", page_start_sequence: 1 },
  { id: "2", chapter_no: 2, title: "Riwayat Perjuangan", page_start_sequence: 15 },
  { id: "3", chapter_no: 3, title: "Penutup", page_start_sequence: 40 },
];

const sampleOriginalText =
  "Soekarno lahir di Soerabaja pada tahun 1901. Ia kemudian pindah ke Bandoeng untuk melanjutkan pendidikan.";

const sampleMentions: EntityMention[] = [
  { id: "m1", entity_type: "person", surface_text: "Soekarno", normalized_text: "Soekarno", char_start: 0, char_end: 8 },
  { id: "m2", entity_type: "place", surface_text: "Soerabaja", normalized_text: "Surabaya", char_start: 15, char_end: 24 },
  { id: "m3", entity_type: "date", surface_text: "1901", char_start: 39, char_end: 43 },
  { id: "m4", entity_type: "place", surface_text: "Bandoeng", normalized_text: "Bandung", char_start: 68, char_end: 76 },
];

const samplePageImages = [
  "https://placehold.co/600x800/f1ead9/5c4f42?text=Halaman+1",
  "https://placehold.co/600x800/f1ead9/5c4f42?text=Halaman+2",
  "https://placehold.co/600x800/f1ead9/5c4f42?text=Halaman+3",
];

export default function ReaderDemoPage() {
  const [activeChapter, setActiveChapter] = useState<Chapter>(sampleChapters[0]);

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-[200px_1fr] gap-6">
        <div>
          <h2 className="mb-2 text-sm uppercase text-[var(--color-ink-soft)]">Daftar Bab</h2>
          <ChapterNav
            chapters={sampleChapters}
            activeChapterId={activeChapter.id}
            onSelect={setActiveChapter}
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm uppercase text-[var(--color-ink-soft)]">
            Sedang dibaca: {activeChapter.title}
          </h2>
          <ParallelTextView
            originalText={sampleOriginalText}
            translatedText="Soekarno lahir di Surabaya pada tahun 1901. Ia kemudian pindah ke Bandung untuk melanjutkan pendidikan."
            mentions={sampleMentions}
            sourceLanguageName="Indonesia (ejaan lama)"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg">Zoom Detail Halaman</h2>
        <PageZoomViewer imageUrl={samplePageImages[0]} />
      </section>

      <section>
        <h2 className="mb-2 text-lg">Pratinjau Balik Halaman</h2>
        <PageFlipBook pageImageUrls={samplePageImages} />
      </section>
    </div>
  );
}
