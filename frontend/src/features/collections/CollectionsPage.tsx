import { useEffect, useState } from "react";
import { listCollections } from "./api";
import type { Collection } from "./types";

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCollections()
      .then(setCollections)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Memuat koleksi...</p>;
  if (error) return <p role="alert">Gagal memuat: {error}</p>;

  return (
    <div>
      <h1>Koleksi</h1>
      {collections.length === 0 ? (
        <p>Belum ada koleksi.</p>
      ) : (
        <ul>
          {collections.map((c) => (
            <li key={c.id}>
              <strong>{c.name}</strong> ({c.code}) — {c.default_currency}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
