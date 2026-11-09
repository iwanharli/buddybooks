import { useQuery } from "@tanstack/react-query";
import { listMasterItems } from "../master/api";

/** Input penerbit dengan autocomplete dari data master publishers (2000+
 * hasil impor IKAPI, lihat docs/publisher-import.md) — pakai <datalist>
 * native supaya tidak perlu bangun dropdown custom. Tetap bisa ketik nama
 * baru bebas kalau penerbitnya belum ada di daftar. */
export function PublisherInput({
  value,
  onChange,
  id = "publisher-options",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const { data: publishers } = useQuery({
    queryKey: ["master", "publishers"],
    queryFn: () => listMasterItems("publishers"),
    staleTime: 5 * 60 * 1000, // daftar penerbit jarang berubah, cache 5 menit
  });

  return (
    <>
      <input
        list={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
        placeholder="Ketik untuk cari penerbit..."
      />
      <datalist id={id}>
        {publishers?.map((p) => <option key={p.id} value={p.name} />)}
      </datalist>
    </>
  );
}
