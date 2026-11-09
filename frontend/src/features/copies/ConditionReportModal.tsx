import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { addConditionReport } from "./api";
import { CONDITION_LABEL } from "./labels";

/** Tambah SATU laporan kondisi baru (bukan edit) — riwayat kondisi tidak
 * ditimpa, tiap pemeriksaan jadi catatan baru bertanggal (README.md). */
export function ConditionReportModal({
  copyId,
  defaultGrade,
  onClose,
}: {
  copyId: string;
  // defaultGrade: kondisi eksemplar yang berlaku sekarang (dari laporan
  // terakhir) — dipakai sebagai nilai awal dropdown supaya tidak kosong/
  // salah sangka "belum dinilai" tiap kali modal dibuka.
  defaultGrade?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [grade, setGrade] = useState(defaultGrade ?? "");
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [foxing, setFoxing] = useState(false);
  const [mold, setMold] = useState(false);
  const [pest, setPest] = useState(false);
  const [water, setWater] = useState(false);
  const [activeRisk, setActiveRisk] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      addConditionReport(copyId, {
        condition_grade: grade,
        condition_score: score ? Number(score) : null,
        note,
        foxing,
        mold_present: mold,
        pest_damage_present: pest,
        water_damage: water,
        active_risk: activeRisk,
      }),
    onSuccess: () => {
      toast.success("Laporan kondisi disimpan");
      queryClient.invalidateQueries({ queryKey: ["copy"] });
      queryClient.invalidateQueries({ queryKey: ["collection-copies"] });
      queryClient.invalidateQueries({ queryKey: ["condition-reports", copyId] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan laporan kondisi");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="relative max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-ink)]">
            Laporan Kondisi Baru
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
            aria-label="Tutup"
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Tanggal pemeriksaan otomatis hari ini. Laporan lama tetap tersimpan sebagai riwayat, tidak tertimpa.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Grade kondisi</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            >
              <option value="">— pilih —</option>
              {Object.entries(CONDITION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
              Skor 0-100 <span className="text-[var(--color-ink-muted)]">(opsional)</span>
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
            Catatan <span className="text-[var(--color-ink-muted)]">(opsional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Sedikit menguning, sampul masih utuh..."
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm text-[var(--color-ink-soft)]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={foxing} onChange={(e) => setFoxing(e.target.checked)} />
            Foxing (bercak coklat)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mold} onChange={(e) => setMold(e.target.checked)} />
            Jamur
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={pest} onChange={(e) => setPest(e.target.checked)} />
            Kerusakan serangga
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={water} onChange={(e) => setWater(e.target.checked)} />
            Bekas air
          </label>
          <label className="col-span-2 flex items-center gap-2">
            <input type="checkbox" checked={activeRisk} onChange={(e) => setActiveRisk(e.target.checked)} />
            Risiko aktif (perlu penanganan segera)
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
