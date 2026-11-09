import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Pencil, Trash2, Upload, X } from "lucide-react";
import { deletePhoto, listPhotos, updatePhoto, uploadPhoto } from "./api";
import type { Photo } from "./types";
import { DocumentScanner } from "../scanner/DocumentScanner";
import { PerspectiveCropper } from "../scanner/PerspectiveCropper";

const MEDIA_TYPE_LABEL: Record<string, string> = {
  cover_front: "Sampul depan",
  cover_back: "Sampul belakang",
  spine: "Punggung buku",
  title_page: "Halaman judul",
  copyright_page: "Halaman hak cipta",
  contents: "Daftar isi",
  last_page: "Halaman terakhir",
  signature: "Tanda tangan",
  stamp: "Stempel",
  damage: "Kerusakan",
  receipt: "Struk/nota",
  certificate: "Sertifikat",
  other: "Lainnya",
};

/** Galeri foto fisik eksemplar (cover/spine/dst) — beda dari hasil scan OCR
 * (book_pages), ini murni dokumentasi visual eksemplar itu sendiri. Bisa
 * unggah dari berkas atau langsung foto dari kamera dengan deteksi tepi
 * otomatis (DocumentScanner, dipakai bersama alur OCR). */
export function PhotoGallery({ copyId }: { copyId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mediaType, setMediaType] = useState("cover_front");
  const [cameraOpen, setCameraOpen] = useState(false);
  // pendingUpload: berkas yang baru dipilih dari "Unggah Berkas", menunggu
  // pengguna menyesuaikan 4 titik crop sebelum benar-benar diunggah.
  const [pendingUpload, setPendingUpload] = useState<File | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editMediaType, setEditMediaType] = useState("");

  const { data: photos } = useQuery({
    queryKey: ["photos", copyId],
    queryFn: () => listPhotos(copyId),
  });

  const invalidatePhotos = () => queryClient.invalidateQueries({ queryKey: ["photos", copyId] });

  const uploadMutation = useMutation({
    mutationFn: (file: File | Blob) =>
      uploadPhoto(copyId, file instanceof File ? file : new File([file], "photo.png", { type: "image/png" }), mediaType, ""),
    onSuccess: () => {
      toast.success("Foto ditambahkan");
      invalidatePhotos();
      setCameraOpen(false);
      setPendingUpload(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah foto");
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updatePhoto(editing!.id, { media_type: editMediaType, caption: editCaption }),
    onSuccess: () => {
      toast.success("Foto diperbarui");
      invalidatePhotos();
      setEditing(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah foto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (photoId: string) => deletePhoto(photoId),
    onSuccess: () => {
      toast.success("Foto dihapus");
      invalidatePhotos();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus foto");
    },
  });

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
          Foto Eksemplar
        </h2>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <select
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-sm"
          >
            {Object.entries(MEDIA_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
          >
            <Camera size={13} /> Kamera
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)]"
          >
            <Upload size={13} /> Unggah Berkas
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPendingUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {photos && photos.length === 0 && (
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Belum ada foto eksemplar ini.</p>
      )}

      {photos && photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative">
              <a href={p.url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={p.url}
                  alt={p.caption ?? MEDIA_TYPE_LABEL[p.media_type] ?? p.media_type}
                  className="aspect-square w-full rounded-md border border-[var(--color-border)] object-cover"
                />
              </a>
              <p className="mt-1 truncate text-sm text-[var(--color-ink-muted)]">
                {MEDIA_TYPE_LABEL[p.media_type] ?? p.media_type}
              </p>
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(p);
                    setEditCaption(p.caption ?? "");
                    setEditMediaType(p.media_type);
                  }}
                  title="Edit foto"
                  className="grid h-6 w-6 place-items-center rounded bg-black/60 text-white hover:bg-black/80"
                >
                  <Pencil size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Hapus foto ini?")) deleteMutation.mutate(p.id);
                  }}
                  title="Hapus foto"
                  className="grid h-6 w-6 place-items-center rounded bg-black/60 text-white hover:bg-red-600"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setCameraOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
                Foto dari Kamera — {MEDIA_TYPE_LABEL[mediaType]}
              </h3>
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>
            <DocumentScanner
              onCapture={(blob) => uploadMutation.mutate(blob)}
              processing={uploadMutation.isPending}
              confirmLabel="Gunakan Foto Ini"
              onCancel={() => setCameraOpen(false)}
            />
          </div>
        </div>
      )}

      {pendingUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setPendingUpload(null)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
                Sesuaikan Crop — {MEDIA_TYPE_LABEL[mediaType]}
              </h3>
              <button
                type="button"
                onClick={() => setPendingUpload(null)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>
            <PerspectiveCropper
              file={pendingUpload}
              onConfirm={(blob) => uploadMutation.mutate(blob)}
              onCancel={() => setPendingUpload(null)}
            />
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => setEditing(null)}
            className="absolute inset-0 bg-black/40"
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
            className="relative w-full max-w-sm space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[var(--color-ink)]">
                Edit Foto
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink-soft)]"
                aria-label="Tutup"
              >
                <X size={15} />
              </button>
            </div>
            <img src={editing.url} alt="" className="max-h-48 w-full rounded-md object-contain" />
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">Jenis</label>
              <select
                value={editMediaType}
                onChange={(e) => setEditMediaType(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              >
                {Object.entries(MEDIA_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-ink-soft)]">
                Caption <span className="text-[var(--color-ink-muted)]">(opsional)</span>
              </label>
              <input
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)]"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {updateMutation.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
