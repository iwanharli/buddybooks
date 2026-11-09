import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateWorkSummary } from "./api";
import type { CopyDetail } from "./types";

/** Sinopsis, signifikansi historis, & catatan karya (works.subject_summary/
 * abstract/historical_significance/notes) — beda dari "Edit Buku" yang
 * bibliografis (judul/penulis/dst), ini teks naratif tentang karyanya.
 * Berlaku untuk semua eksemplar yang berbagi karya yang sama (lewat
 * work_id), sama seperti Edit Buku. */
export function SummaryTab({ copy }: { copy: CopyDetail }) {
  const queryClient = useQueryClient();
  const [subjectSummary, setSubjectSummary] = useState(copy.subject_summary ?? "");
  const [abstract, setAbstract] = useState(copy.abstract ?? "");
  const [historicalSignificance, setHistoricalSignificance] = useState(copy.historical_significance ?? "");
  const [notes, setNotes] = useState(copy.work_notes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      updateWorkSummary(copy.work_id, {
        subject_summary: subjectSummary,
        abstract,
        historical_significance: historicalSignificance,
        notes,
      }),
    onSuccess: () => {
      toast.success("Ringkasan disimpan");
      queryClient.invalidateQueries({ queryKey: ["copy"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan ringkasan");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
          Ringkasan subjek <span className="text-[var(--color-ink-muted)]">(opsional)</span>
        </label>
        <textarea
          value={subjectSummary}
          onChange={(e) => setSubjectSummary(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder="Garis besar tema/topik buku ini dalam satu-dua kalimat..."
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
          Sinopsis <span className="text-[var(--color-ink-muted)]">(opsional)</span>
        </label>
        <textarea
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          rows={5}
          className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder="Ringkasan isi/cerita buku ini..."
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
          Signifikansi historis <span className="text-[var(--color-ink-muted)]">(opsional)</span>
        </label>
        <textarea
          value={historicalSignificance}
          onChange={(e) => setHistoricalSignificance(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          placeholder="Kenapa buku ini penting/bersejarah, mis. cetakan pertama, penulis terkenal, dsb..."
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
          Catatan kurator <span className="text-[var(--color-ink-muted)]">(opsional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {mutation.isPending ? "Menyimpan..." : "Simpan Ringkasan"}
        </button>
      </div>
    </form>
  );
}
