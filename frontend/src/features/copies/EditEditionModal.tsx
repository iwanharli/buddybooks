import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { updateEdition } from "./api";
import { PublisherInput } from "./PublisherInput";
import { listMasterItems } from "../master/api";
import type { CopyDetail } from "./types";

/** Edit field yang menempel ke KARYA/EDISI (judul, judul asli, penulis,
 * penerbit, tahun, ISBN, kategori, jenis karya) — berlaku untuk SEMUA
 * eksemplar yang berbagi edisi ini (lihat copy.other_copies), bukan cuma
 * eksemplar yang sedang dibuka. */
export function EditEditionModal({ copy, onClose }: { copy: CopyDetail; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(copy.preferred_title);
  const [originalTitle, setOriginalTitle] = useState(copy.original_title ?? "");
  const [author, setAuthor] = useState(copy.author_name ?? "");
  const [publisher, setPublisher] = useState(copy.publisher_name ?? "");
  const [year, setYear] = useState(copy.publication_year ? String(copy.publication_year) : "");
  const [isbn, setIsbn] = useState(copy.isbn ?? "");
  const [categoryId, setCategoryId] = useState(copy.category_id ?? "");
  const [workTypeId, setWorkTypeId] = useState(copy.work_type_id ?? "");
  const [totalPages, setTotalPages] = useState(copy.total_pages ? String(copy.total_pages) : "");

  const { data: categories } = useQuery({
    queryKey: ["master", "categories"],
    queryFn: () => listMasterItems("categories"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: workTypes } = useQuery({
    queryKey: ["master", "work-types"],
    queryFn: () => listMasterItems("work-types"),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      updateEdition(copy.edition_id, {
        preferred_title: title,
        original_title: originalTitle,
        publication_year: year ? Number(year) : null,
        isbn,
        publisher_name: publisher,
        author_name: author,
        category_id: categoryId,
        work_type_id: workTypeId,
        total_pages: totalPages ? Number(totalPages) : null,
      }),
    onSuccess: () => {
      toast.success("Info buku diperbarui");
      queryClient.invalidateQueries({ queryKey: ["copy"] });
      queryClient.invalidateQueries({ queryKey: ["collection-copies"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah info buku");
    },
  });

  const hasOtherCopies = copy.other_copies.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) mutation.mutate();
        }}
        className="relative max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-ink)]">
            Edit Buku
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

        {hasOtherCopies && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Perubahan ini berlaku untuk {copy.other_copies.length + 1} eksemplar yang berbagi buku ini, bukan cuma
            eksemplar {copy.inventory_code}.
          </p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Judul</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
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
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Penerbit <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <PublisherInput value={publisher} onChange={setPublisher} id="publisher-options-edit" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Tahun terbit</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                  Jumlah halaman <span className="text-[var(--color-ink-muted)]">(opsional)</span>
                </label>
                <input
                  type="number"
                  value={totalPages}
                  onChange={(e) => setTotalPages(e.target.value)}
                  placeholder="320"
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                />
              </div>
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
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Kategori <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              >
                <option value="">— belum dikategorikan —</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.note ? ` (${c.note})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Jenis karya <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <select
                value={workTypeId}
                onChange={(e) => setWorkTypeId(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              >
                <option value="">— belum ditentukan —</option>
                {workTypes?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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
