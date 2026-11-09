import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { updateCopy } from "./api";
import { GRADE_LABEL, COMPLETENESS_LABEL } from "./labels";
import type { CopyDetail } from "./types";

/** Edit field yang menempel ke EKSEMPLAR fisik (kode inventaris, grade
 * koleksi, kelengkapan, dimensi, dst) — bukan judul/penulis/dst, itu ada
 * di EditEditionModal karena menempel ke karya/edisi (berlaku untuk semua
 * eksemplar yang berbagi edisi yang sama). */
export function EditCopyModal({ copy, onClose }: { copy: CopyDetail; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [inventoryCode, setInventoryCode] = useState(copy.inventory_code);
  const [grade, setGrade] = useState(copy.collection_grade ?? "");
  const [completeness, setCompleteness] = useState(copy.completeness_status ?? "");
  const [dustJacket, setDustJacket] = useState(copy.dust_jacket_present ?? false);
  const [slipcase, setSlipcase] = useState(copy.slipcase_present ?? false);
  const [height, setHeight] = useState(copy.height_mm?.toString() ?? "");
  const [width, setWidth] = useState(copy.width_mm?.toString() ?? "");
  const [thickness, setThickness] = useState(copy.thickness_mm?.toString() ?? "");
  const [weight, setWeight] = useState(copy.weight_grams?.toString() ?? "");
  const [bindingDescription, setBindingDescription] = useState(copy.binding_description ?? "");
  const [coverDescription, setCoverDescription] = useState(copy.cover_description ?? "");
  const [accessionNumber, setAccessionNumber] = useState(copy.accession_number ?? "");
  const [privateNotes, setPrivateNotes] = useState(copy.private_notes ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      updateCopy(copy.id, {
        inventory_code: inventoryCode,
        collection_grade: grade,
        completeness_status: completeness,
        binding_description: bindingDescription,
        cover_description: coverDescription,
        dust_jacket_present: dustJacket,
        slipcase_present: slipcase,
        height_mm: height ? Number(height) : null,
        width_mm: width ? Number(width) : null,
        thickness_mm: thickness ? Number(thickness) : null,
        weight_grams: weight ? Number(weight) : null,
        accession_number: accessionNumber,
        private_notes: privateNotes,
      }),
    onSuccess: () => {
      toast.success("Eksemplar diperbarui");
      queryClient.invalidateQueries({ queryKey: ["copy"] });
      queryClient.invalidateQueries({ queryKey: ["collection-copies"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah eksemplar");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (inventoryCode.trim()) mutation.mutate();
        }}
        className="relative max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-ink)]">
            Edit Eksemplar
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Kode inventaris</label>
              <input
                required
                value={inventoryCode}
                onChange={(e) => setInventoryCode(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Grade koleksi <span className="text-[var(--color-ink-muted)]">(kosongkan bila belum ditentukan)</span>
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              >
                <option value="">— belum ditentukan —</option>
                {Object.entries(GRADE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Kelengkapan <span className="text-[var(--color-ink-muted)]">(kosongkan bila belum dipastikan)</span>
              </label>
              <select
                value={completeness}
                onChange={(e) => setCompleteness(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              >
                <option value="">— belum dipastikan —</option>
                {Object.entries(COMPLETENESS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm text-[var(--color-ink-soft)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dustJacket} onChange={(e) => setDustJacket(e.target.checked)} />
                Ada dust jacket
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={slipcase} onChange={(e) => setSlipcase(e.target.checked)} />
                Ada slipcase
              </label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Dimensi (mm) &amp; berat (gram) <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="Tinggi"
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                  placeholder="Lebar"
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  value={thickness}
                  onChange={(e) => setThickness(e.target.value)}
                  placeholder="Tebal"
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="Berat"
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Deskripsi sampul <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <input
                value={coverDescription}
                onChange={(e) => setCoverDescription(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                placeholder="Softcover, warna merah..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Deskripsi penjilidan <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <input
                value={bindingDescription}
                onChange={(e) => setBindingDescription(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Nomor aksesi <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <input
                value={accessionNumber}
                onChange={(e) => setAccessionNumber(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Catatan pribadi <span className="text-[var(--color-ink-muted)]">(opsional, tidak untuk publik)</span>
              </label>
              <textarea
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </div>
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
