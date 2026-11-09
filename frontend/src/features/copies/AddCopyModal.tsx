import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { createCopy, getNextInventoryCode } from "./api";
import { PublisherInput } from "./PublisherInput";
import { listCollections } from "../collections/api";

interface AddCopyModalProps {
  onClose: () => void;
  // Kalau dibuka dari halaman isi koleksi, koleksinya sudah pasti — dropdown
  // koleksi disembunyikan dan langsung dipakai nilai ini.
  defaultCollectionId?: string;
  // Kalau diisi (dibuka dari CopyDetailPage lewat "Tambah Eksemplar Lain
  // untuk Buku Ini"), form dikunci ke edisi ini — TIDAK ada field judul/
  // tahun/dst sama sekali, cukup kode inventaris + koleksi. Ini satu-satunya
  // cara menautkan eksemplar baru ke edisi yang sudah ada; form umum
  // (fixedEdition kosong) SELALU membuat buku baru, tidak ada toggle lagi —
  // supaya tidak ada dropdown "cari dari semua buku" yang membingungkan di
  // luar konteks.
  fixedEdition?: { editionId: string; title: string };
}

export function AddCopyModal({ onClose, defaultCollectionId, fixedEdition }: AddCopyModalProps) {
  const queryClient = useQueryClient();

  const [collectionId, setCollectionId] = useState(defaultCollectionId ?? "");
  // inventoryCode tidak pernah ditampilkan/diisi manual di form ini — selalu
  // dari saran otomatis (getNextInventoryCode) begitu koleksi tujuan diketahui.
  const [inventoryCode, setInventoryCode] = useState("");
  const [title, setTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [year, setYear] = useState("");
  const [isbn, setIsbn] = useState("");
  const [publisher, setPublisher] = useState("");
  const [author, setAuthor] = useState("");

  const { data: collections } = useQuery({ queryKey: ["collections"], queryFn: listCollections });

  // Kalau koleksi belum dipilih (dropdown umum, bukan defaultCollectionId),
  // saran kode inventaris tetap perlu tahu koleksi TUJUAN — kosong berarti
  // "Uncategorized", jadi cari ID-nya dari daftar koleksi yang sudah di-fetch.
  const effectiveCollectionId = collectionId || collections?.find((c) => c.code === "UNCATEGORIZED")?.id;
  const { data: suggestedCode } = useQuery({
    queryKey: ["next-inventory-code", effectiveCollectionId],
    queryFn: () => getNextInventoryCode(effectiveCollectionId!),
    enabled: !!effectiveCollectionId,
  });
  useEffect(() => {
    if (suggestedCode) setInventoryCode(suggestedCode);
  }, [suggestedCode]);

  const mutation = useMutation({
    mutationFn: () =>
      createCopy({
        collection_id: collectionId,
        inventory_code: inventoryCode,
        edition_id: fixedEdition?.editionId ?? "",
        preferred_title: title,
        original_title: originalTitle,
        publication_year: year ? Number(year) : null,
        isbn,
        publisher_name: publisher,
        author_name: author,
      }),
    onSuccess: () => {
      toast.success("Eksemplar ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["collections"] });
      queryClient.invalidateQueries({ queryKey: ["collection-copies"] });
      queryClient.invalidateQueries({ queryKey: ["copies"] });
      queryClient.invalidateQueries({ queryKey: ["copy"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menambah eksemplar");
    },
  });

  const canSubmit = inventoryCode.trim() !== "" && (fixedEdition ? true : title.trim() !== "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) mutation.mutate();
        }}
        className="relative max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-ink)]">
            {fixedEdition ? "Tambah Eksemplar Lain" : "Tambah Eksemplar"}
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

        {fixedEdition ? (
          <p className="rounded-md bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
            Buku: <span className="font-medium text-[var(--color-ink)]">{fixedEdition.title}</span>
          </p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Judul</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                placeholder="Judul buku"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Judul asli <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <input
                value={originalTitle}
                onChange={(e) => setOriginalTitle(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Penulis <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                placeholder="Agatha Christie"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Tahun terbit</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                  placeholder="1964"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                  ISBN <span className="text-[var(--color-ink-muted)]">(opsional)</span>
                </label>
                <input
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Penerbit <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <PublisherInput value={publisher} onChange={setPublisher} />
            </div>
          </>
        )}

        {!defaultCollectionId && (
          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
              Koleksi <span className="text-[var(--color-ink-muted)]">(kosongkan = Uncategorized)</span>
            </label>
            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            >
              <option value="">— Uncategorized —</option>
              {collections?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

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
            disabled={!canSubmit || mutation.isPending}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
