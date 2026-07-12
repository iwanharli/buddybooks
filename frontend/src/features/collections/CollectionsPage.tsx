import { useQuery } from "@tanstack/react-query";
import { listCollections } from "./api";

export default function CollectionsPage() {
  const { data: collections, isLoading, error } = useQuery({
    queryKey: ["collections"],
    queryFn: listCollections,
  });

  if (isLoading) return <p className="p-8">Memuat koleksi...</p>;
  if (error) return <p className="p-8" role="alert">Gagal memuat: {(error as Error).message}</p>;

  return (
    <div className="p-8">
      <h1 className="text-3xl">Koleksi</h1>
      {collections && collections.length === 0 ? (
        <p className="mt-4 text-[var(--color-ink-soft)]">Belum ada koleksi.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {collections?.map((c) => (
            <li key={c.id} className="rounded-md border border-[var(--color-border)] p-3">
              <strong>{c.name}</strong> ({c.code}) — {c.default_currency}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
