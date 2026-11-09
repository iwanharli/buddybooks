import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { addValuation } from "./api";
import { VALUATION_TYPE_LABEL } from "./labels";

/** Tambah SATU valuasi baru (bukan edit) — riwayat nilai dari waktu ke
 * waktu tetap tersimpan (README.md, "Riwayat tidak ditimpa"). */
export function ValuationModal({
  copyId,
  defaultCurrency,
  // defaultValues: valuasi terakhir eksemplar ini (kalau ada) — dipakai
  // sebagai nilai awal form supaya tidak mulai dari kosong tiap kali dibuka.
  defaultValues,
  onClose,
}: {
  copyId: string;
  defaultCurrency?: string;
  defaultValues?: {
    valuation_type?: string;
    valuation_low?: number;
    valuation_mid?: number;
    valuation_high?: number;
    valuation_basis?: string;
  };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState(defaultValues?.valuation_type ?? "owner_estimate");
  const currency = defaultCurrency ?? "IDR";
  const [low, setLow] = useState(defaultValues?.valuation_low?.toString() ?? "");
  const [mid, setMid] = useState(defaultValues?.valuation_mid?.toString() ?? "");
  const [high, setHigh] = useState(defaultValues?.valuation_high?.toString() ?? "");
  const [basis, setBasis] = useState(defaultValues?.valuation_basis ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      addValuation(copyId, {
        valuation_type: type,
        currency,
        value_low: low ? Number(low) : null,
        value_mid: mid ? Number(mid) : null,
        value_high: high ? Number(high) : null,
        valuation_basis: basis,
      }),
    onSuccess: () => {
      toast.success("Valuasi disimpan");
      queryClient.invalidateQueries({ queryKey: ["copy"] });
      queryClient.invalidateQueries({ queryKey: ["collection-copies"] });
      queryClient.invalidateQueries({ queryKey: ["valuations", copyId] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan valuasi");
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
            Valuasi Baru
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
          Tanggal penilaian otomatis hari ini. Valuasi lama tetap tersimpan sebagai riwayat, tidak tertimpa.
        </p>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Jenis</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {Object.entries(VALUATION_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Rendah</label>
            <input
              type="number"
              value={low}
              onChange={(e) => setLow(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Tengah</label>
            <input
              type="number"
              value={mid}
              onChange={(e) => setMid(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Tinggi</label>
            <input
              type="number"
              value={high}
              onChange={(e) => setHigh(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-2 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
            Dasar penilaian <span className="text-[var(--color-ink-muted)]">(opsional)</span>
          </label>
          <textarea
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Perkiraan harga pasar buku bekas sejenis..."
          />
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
