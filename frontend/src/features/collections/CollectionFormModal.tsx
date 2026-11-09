import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createCollection, updateCollection } from "./api";
import type { Collection } from "./types";

interface CollectionFormModalProps {
  // Kosongkan (undefined) untuk mode "Tambah Koleksi"; isi dengan koleksi
  // yang mau diubah untuk mode "Edit". "code" dibuat otomatis dari nama
  // di backend — tidak pernah ditampilkan/diminta di form ini sama sekali.
  collection?: Collection;
  onClose: () => void;
}

export function CollectionFormModal({ collection, onClose }: CollectionFormModalProps) {
  const isEdit = !!collection;
  const queryClient = useQueryClient();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  // Mata uang tidak diminta di form — default IDR diisi otomatis di backend
  // (lihat defaultCurrencyFallback), sesuai keputusan mayoritas koleksi
  // dikelola dalam Rupiah. Konversi mata uang lain tetap otomatis lewat
  // fx_rates saat ada transaksi (bukan urusan form ini).

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateCollection(collection!.id, { name, description, default_currency: collection!.default_currency })
        : createCollection({ name, description, default_currency: "" }),
    onSuccess: () => {
      toast.success(isEdit ? "Koleksi diperbarui" : "Koleksi ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan koleksi");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="relative w-full max-w-md space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-ink)]">
            {isEdit ? "Edit Koleksi" : "Tambah Koleksi"}
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

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Nama koleksi</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Koleksi Buku Anak"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Deskripsi</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Buku cerita dan bacaan anak-anak."
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
