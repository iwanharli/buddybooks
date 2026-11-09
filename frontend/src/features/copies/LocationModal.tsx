import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { setCopyLocation } from "./api";
import { listLocations, createLocation, updateLocation, deleteLocation } from "../locations/api";
import type { StorageLocation } from "../locations/types";
import { LOCATION_TYPE_LABEL } from "./labels";

type FormState = "closed" | "new" | StorageLocation;

/** Atur lokasi simpan fisik eksemplar (rak/lemari/kotak/dst) dalam koleksi
 * ini — lokasi hierarkis per koleksi (lihat storage_locations.parent_location_id).
 * Sekaligus tempat mengelola daftar lokasinya sendiri (tambah/edit/hapus),
 * bukan cuma memilih dari yang sudah ada. */
export function LocationModal({
  copyId,
  collectionId,
  currentLocationId,
  onClose,
}: {
  copyId: string;
  collectionId: string;
  currentLocationId?: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(currentLocationId ?? "");
  const [form, setForm] = useState<FormState>("closed");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [locationType, setLocationType] = useState("");
  const [parentId, setParentId] = useState("");

  const { data: locations } = useQuery({
    queryKey: ["locations", collectionId],
    queryFn: () => listLocations(collectionId),
  });

  const invalidateLocations = () => queryClient.invalidateQueries({ queryKey: ["locations", collectionId] });

  const assignMutation = useMutation({
    mutationFn: (locationId: string) => setCopyLocation(copyId, locationId),
    onSuccess: () => {
      toast.success("Lokasi diperbarui");
      queryClient.invalidateQueries({ queryKey: ["copy"] });
      queryClient.invalidateQueries({ queryKey: ["collection-copies"] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengatur lokasi");
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createLocation(collectionId, {
        code,
        name,
        location_type: locationType,
        parent_location_id: parentId,
        climate_controlled: false,
        secure: false,
      }),
    onSuccess: (loc) => {
      toast.success("Lokasi baru dibuat");
      invalidateLocations();
      assignMutation.mutate(loc.id);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal membuat lokasi");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (locationId: string) =>
      updateLocation(locationId, {
        code,
        name,
        location_type: locationType,
        parent_location_id: parentId,
        climate_controlled: false,
        secure: false,
      }),
    onSuccess: () => {
      toast.success("Lokasi diperbarui");
      invalidateLocations();
      setForm("closed");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah lokasi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (locationId: string) => deleteLocation(locationId),
    onSuccess: (_data, locationId) => {
      toast.success("Lokasi dihapus");
      invalidateLocations();
      if (selected === locationId) setSelected("");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus lokasi");
    },
  });

  const options = orderByHierarchy(locations ?? []);

  function openNewForm() {
    setCode("");
    setName("");
    setLocationType("");
    setParentId("");
    setForm("new");
  }

  function openEditForm(loc: StorageLocation) {
    setCode(loc.code);
    setName(loc.name ?? "");
    setLocationType(loc.location_type ?? "");
    setParentId(loc.parent_location_id ?? "");
    setForm(loc);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-ink)]">
            Lokasi Simpan
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

        {form === "closed" ? (
          <>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelected("")}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                  selected === "" ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-parchment-dim)]"
                }`}
              >
                — belum ada lokasi —
                {selected === "" && <Check size={14} />}
              </button>
              {options.map(({ location, depth }) => (
                <div
                  key={location.id}
                  className={`flex items-center gap-1 rounded-md ${
                    selected === location.id ? "bg-[var(--color-accent-soft)]" : "hover:bg-[var(--color-parchment-dim)]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(location.id)}
                    className={`flex-1 truncate px-3 py-2 text-left text-sm ${
                      selected === location.id ? "text-[var(--color-accent)]" : "text-[var(--color-ink)]"
                    }`}
                  >
                    {"  ".repeat(depth)}
                    {location.name ?? location.code}
                    {location.location_type && (
                      <span className="ml-1 text-sm text-[var(--color-ink-muted)]">
                        ({LOCATION_TYPE_LABEL[location.location_type] ?? location.location_type})
                      </span>
                    )}
                  </button>
                  {selected === location.id && <Check size={14} className="shrink-0 text-[var(--color-accent)]" />}
                  <button
                    type="button"
                    onClick={() => openEditForm(location)}
                    title="Edit lokasi"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-parchment-dim)]"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Hapus lokasi "${location.name ?? location.code}"?`)) {
                        deleteMutation.mutate(location.id);
                      }
                    }}
                    title="Hapus lokasi"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded text-[var(--color-ink-muted)] hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={openNewForm}
              className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              <Plus size={12} /> Tambah lokasi baru
            </button>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={assignMutation.isPending}
                onClick={() => assignMutation.mutate(selected)}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {assignMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim()) return;
              if (form === "new") createMutation.mutate();
              else updateMutation.mutate(form.id);
            }}
            className="space-y-3"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Kode</label>
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                placeholder="RAK-A"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Nama <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                placeholder="Rak A"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Tipe</label>
                <select
                  value={locationType}
                  onChange={(e) => setLocationType(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">— pilih —</option>
                  {Object.entries(LOCATION_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                  Induk <span className="text-[var(--color-ink-muted)]">(opsional)</span>
                </label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">— tidak ada —</option>
                  {options
                    .filter(({ location }) => form === "new" || location.id !== form.id)
                    .map(({ location, depth }) => (
                      <option key={location.id} value={location.id}>
                        {"  ".repeat(depth)}
                        {location.name ?? location.code}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setForm("closed")}
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)]"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || assignMutation.isPending}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending || assignMutation.isPending
                  ? "Menyimpan..."
                  : form === "new"
                    ? "Buat & Pakai"
                    : "Simpan Perubahan"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// orderByHierarchy: urutkan lokasi flat jadi urutan depth-first (induk
// dulu, baru anak-anaknya) sambil menghitung depth-nya, supaya dropdown
// bisa diberi indentasi visual tanpa perlu komponen tree terpisah.
function orderByHierarchy(locations: StorageLocation[]): { location: StorageLocation; depth: number }[] {
  const byParent = new Map<string, StorageLocation[]>();
  for (const loc of locations) {
    const key = loc.parent_location_id ?? "";
    byParent.set(key, [...(byParent.get(key) ?? []), loc]);
  }

  const out: { location: StorageLocation; depth: number }[] = [];
  function walk(parentKey: string, depth: number) {
    for (const loc of byParent.get(parentKey) ?? []) {
      out.push({ location: loc, depth });
      walk(loc.id, depth + 1);
    }
  }
  walk("", 0);
  return out;
}
