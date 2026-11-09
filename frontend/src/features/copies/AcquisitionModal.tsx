import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { upsertAcquisition } from "./api";
import { ACQUISITION_METHOD_LABEL } from "./labels";

/** Sunting SATU fakta akuisisi (cara didapat & harga beli) eksemplar ini —
 * beda dari ConditionReportModal/ValuationModal, ini bukan riwayat
 * berulang, jadi selalu pre-filled dari data yang sudah ada dan menimpa
 * (upsert), bukan menambah baris baru. */
export function AcquisitionModal({
  copyId,
  defaultValues,
  onClose,
}: {
  copyId: string;
  defaultValues?: {
    acquisition_method?: string;
    acquisition_date?: string;
    purchase_price?: number;
    purchase_currency?: string;
    acquisition_seller_name?: string;
  };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [method, setMethod] = useState(defaultValues?.acquisition_method ?? "purchase");
  const [date, setDate] = useState(defaultValues?.acquisition_date ?? new Date().toISOString().slice(0, 10));
  const currency = defaultValues?.purchase_currency ?? "IDR";
  const [price, setPrice] = useState(defaultValues?.purchase_price?.toString() ?? "");
  const [sellerName, setSellerName] = useState(defaultValues?.acquisition_seller_name ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      upsertAcquisition(copyId, {
        method,
        transaction_date: date,
        currency,
        purchase_price: price ? Number(price) : null,
        seller_name: sellerName,
        invoice_number: invoiceNumber,
        notes,
      }),
    onSuccess: () => {
      toast.success("Data akuisisi disimpan");
      queryClient.invalidateQueries({ queryKey: ["copy"] });
      queryClient.invalidateQueries({ queryKey: ["collection-copies"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan data akuisisi");
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
            Cara Didapat &amp; Harga Beli
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
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Cara didapat</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            {Object.entries(ACQUISITION_METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Harga</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              placeholder="69000"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
            Penjual/toko <span className="text-[var(--color-ink-muted)]">(opsional)</span>
          </label>
          <input
            value={sellerName}
            onChange={(e) => setSellerName(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            placeholder="Gramedia Kelapa Gading"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
            No. invoice/struk <span className="text-[var(--color-ink-muted)]">(opsional)</span>
          </label>
          <input
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
            Catatan <span className="text-[var(--color-ink-muted)]">(opsional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
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
