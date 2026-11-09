import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LibraryBig, Pencil, Plus } from "lucide-react";
import { listCollections } from "./api";
import { CollectionFormModal } from "./CollectionFormModal";
import type { Collection } from "./types";

/**
 * Daftar semua koleksi (level teratas: satu koleksi bisa berisi banyak
 * eksemplar). Klik satu koleksi masuk ke isinya di /collections/:collectionCode
 * (CollectionDetailPage) — pakai code (unik & lebih pendek dari UUID) sebagai slug URL.
 */
export default function CollectionsListPage() {
  const { data: collections, isLoading, error } = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
  });
  const [modalMode, setModalMode] = useState<"none" | "create" | Collection>("none");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-ink)]">
            Koleksi
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">
            Pilih koleksi untuk melihat isinya.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalMode("create")}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink-soft)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          <Plus size={15} /> Tambah Koleksi
        </button>
      </div>

      {isLoading && <p className="text-sm text-[var(--color-ink-soft)]">Memuat daftar koleksi...</p>}
      {error && (
        <p className="text-sm text-red-700">
          Gagal memuat koleksi: {error instanceof Error ? error.message : String(error)}
        </p>
      )}
      {collections && collections.length === 0 && (
        <p className="text-sm text-[var(--color-ink-soft)]">Belum ada koleksi.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {collections?.map((c) => (
          <div
            key={c.id}
            className="group relative flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--color-blue-line)] hover:shadow-md"
          >
            <Link to={`/collections/${c.code.toLowerCase()}`} className="flex min-w-0 flex-1 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <LibraryBig size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[var(--color-accent)]">{c.code}</p>
                <h2 className="mt-0.5 truncate font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
                  {c.name}
                </h2>
                {c.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--color-ink-muted)]">{c.description}</p>
                )}
                <p className="mt-2 text-xs font-medium text-[var(--color-ink-soft)]">
                  {c.copy_count.toLocaleString("id-ID")} eksemplar
                </p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setModalMode(c)}
              title="Edit koleksi"
              aria-label={`Edit ${c.name}`}
              className="absolute right-3 top-3 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-ink-soft)] opacity-0 transition hover:bg-[var(--color-parchment-dim)] group-hover:opacity-100"
            >
              <Pencil size={14} />
            </button>
          </div>
        ))}
      </div>

      {modalMode !== "none" && (
        <CollectionFormModal
          collection={modalMode === "create" ? undefined : modalMode}
          onClose={() => setModalMode("none")}
        />
      )}
    </div>
  );
}
