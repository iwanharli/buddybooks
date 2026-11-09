import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, BookOpenCheck, Calendar, MapPin, Pencil, Plus, ScanLine, Search, ShieldCheck } from "lucide-react";
import { listCollectionCopies, getCollectionByCode } from "./api";
import { CollectionFormModal } from "./CollectionFormModal";
import { AddCopyModal } from "../copies/AddCopyModal";
import { GRADE_LABEL } from "../copies/labels";
import type { CollectionCopy } from "./types";

/**
 * Isi SATU koleksi: grid eksemplar (buku fisik) di dalamnya, bukan daftar
 * koleksi (itu di CollectionsListPage, /collections). Diakses lewat
 * /collections/:collectionCode (slug pendek, bukan UUID — code sudah unik
 * di skema). Data asli dari backend — lihat catatan nullable di
 * features/collections/types.ts: kebanyakan eksemplar belum punya
 * condition_reports/valuations, jadi tampil "Belum dinilai" bukan angka rekaan.
 */
export default function CollectionDetailPage() {
  const { collectionCode } = useParams<{ collectionCode: string }>();
  const [searchTerm, setSearchTerm] = useState("");
  const [editing, setEditing] = useState(false);
  const [addingCopy, setAddingCopy] = useState(false);

  const { data: collection } = useQuery({
    queryKey: ["collection", collectionCode],
    queryFn: () => getCollectionByCode(collectionCode!),
    enabled: !!collectionCode,
  });

  const {
    data: copiesList,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["collection-copies", collection?.id],
    queryFn: () => listCollectionCopies(collection!.id),
    enabled: !!collection,
  });

  const filteredCopies = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!copiesList) return [];
    if (!keyword) return copiesList;
    return copiesList.filter((c) =>
      [c.preferred_title, c.inventory_code, c.category_name].some((v) => v?.toLowerCase().includes(keyword)),
    );
  }, [copiesList, searchTerm]);

  const withPages = copiesList?.filter((c) => c.page_count > 0) ?? [];
  const avgOcr =
    withPages.length > 0
      ? Math.round(
          (withPages.reduce((sum, c) => sum + (c.ocr_avg_confidence ?? 0), 0) / withPages.length) * 100,
        )
      : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div>
          <p className="text-xs uppercase text-[var(--color-ink-soft)]">{collection?.code ?? collectionCode}</p>
          <p className="font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--color-ink)]">
            {collection?.name ?? "Koleksi"}
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {copiesList?.length ?? 0} eksemplar
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setAddingCopy(true)}
            className="flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            <Plus size={13} /> Tambah Eksemplar
          </button>
          {collection && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["Total Eksemplar", (copiesList?.length ?? 0).toString(), BookOpenCheck],
          ["Sudah Dinilai Kondisi", (copiesList?.filter((c) => c.condition_grade).length ?? 0).toString(), ShieldCheck],
          ["Rata-rata OCR", avgOcr !== null ? `${avgOcr}%` : "—", ScanLine],
        ].map(([label, value, Icon]) => (
          <div key={label as string} className="rounded-lg border border-[var(--color-border)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[var(--color-ink-muted)]">{label as string}</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{value as string}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Icon size={18} />
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
        <label className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink-muted)] md:max-w-md">
          <Search size={16} />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
            placeholder="Cari judul, kode inventaris, kategori"
          />
        </label>
      </section>

      {isLoading && <p className="text-sm text-[var(--color-ink-soft)]">Memuat eksemplar...</p>}
      {error && (
        <p className="text-sm text-red-700">
          Gagal memuat eksemplar: {error instanceof Error ? error.message : String(error)}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredCopies.map((c) => (
          <CopyCard key={c.id} copy={c} collectionCode={collectionCode!} />
        ))}
      </section>

      {copiesList && filteredCopies.length === 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-10 text-center text-sm text-[var(--color-ink-muted)]">
          {copiesList.length === 0 ? "Belum ada eksemplar di koleksi ini." : "Tidak ada eksemplar yang cocok dengan pencarian."}
        </div>
      )}

      {editing && collection && (
        <CollectionFormModal collection={collection} onClose={() => setEditing(false)} />
      )}

      {addingCopy && collection && (
        <AddCopyModal defaultCollectionId={collection.id} onClose={() => setAddingCopy(false)} />
      )}
    </div>
  );
}

function CopyCard({
  copy,
  collectionCode,
}: {
  copy: CollectionCopy;
  collectionCode: string;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm shadow-blue-950/[0.03] transition hover:-translate-y-0.5 hover:border-[var(--color-blue-line)] hover:shadow-lg">
      <Link to={`/copies/${collectionCode}/${copy.inventory_code}`} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {copy.cover_photo_url ? (
              <img
                src={copy.cover_photo_url}
                alt=""
                className="h-16 w-12 shrink-0 rounded border border-[var(--color-border)] object-cover"
              />
            ) : (
              <div className="grid h-16 w-12 shrink-0 place-items-center rounded border border-dashed border-[var(--color-border)] text-[var(--color-ink-muted)]">
                <BookOpen size={16} />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--color-accent)]">{copy.inventory_code}</p>
              <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-[var(--color-ink)]">
                {copy.preferred_title}
              </h3>
              {copy.author_name && (
                <p className="truncate text-xs text-[var(--color-ink-soft)]">{copy.author_name}</p>
              )}
            </div>
          </div>
          {copy.collection_grade && (
            <span className="shrink-0 rounded-full bg-[var(--color-accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--color-accent)]">
              {GRADE_LABEL[copy.collection_grade] ?? copy.collection_grade}
            </span>
          )}
        </div>

        <p className="mt-1 truncate text-xs text-[var(--color-ink-muted)]">
          {copy.category_name ?? "Kategori belum diisi"}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <InfoPill icon={Calendar} value={copy.publication_year ? String(copy.publication_year) : "Tahun ?"} />
          <InfoPill icon={MapPin} value={copy.location_name ?? "Belum ada lokasi"} />
        </div>
      </Link>
    </article>
  );
}

function InfoPill({ icon: Icon, value }: { icon: typeof Calendar; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-[var(--color-surface)] px-2.5 py-2 text-[var(--color-ink-soft)]">
      <Icon size={14} className="shrink-0 text-[var(--color-accent)]" />
      <span className="truncate">{value}</span>
    </span>
  );
}
