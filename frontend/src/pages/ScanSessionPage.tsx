import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DocumentScanner } from "../features/scanner/DocumentScanner";
import { listCopies } from "../features/copies/api";
import { uploadPage, listPages } from "../features/reader/api";

/**
 * Sesi pemindaian multi-halaman: pilih eksemplar (copy), lalu pindai
 * berturut-turut. Tiap halaman langsung tersimpan permanen ke book_pages +
 * media_assets (bukan cuma pratinjau di layar seperti /scanner-demo).
 */
export default function ScanSessionPage() {
  const [selectedCopyId, setSelectedCopyId] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const queryClient = useQueryClient();

  const { data: copiesList, isLoading: loadingCopies } = useQuery({
    queryKey: ["copies"],
    queryFn: listCopies,
  });

  const { data: pages } = useQuery({
    queryKey: ["pages", selectedCopyId],
    queryFn: () => listPages(selectedCopyId),
    enabled: !!selectedCopyId,
  });

  const uploadMutation = useMutation({
    mutationFn: (blob: Blob) => uploadPage(selectedCopyId, blob),
    onSuccess: (page) => {
      toast.success(`Halaman ${page.page_sequence} tersimpan (confidence ${(page.ocr_confidence * 100).toFixed(0)}%)`);
      queryClient.invalidateQueries({ queryKey: ["pages", selectedCopyId] });
      setScanning(false); // kembali ke daftar; tekan "Pindai Halaman Berikutnya" untuk lanjut
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan halaman");
      setScanning(false);
    },
  });

  const selectedCopy = copiesList?.find((c) => c.id === selectedCopyId);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-4xl">Sesi Pemindaian</h1>
        <p className="text-[var(--color-ink-soft)]">
          Pilih eksemplar, lalu pindai halaman satu per satu. Setiap halaman langsung
          tersimpan dengan urutan otomatis.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm text-[var(--color-ink-soft)]">Eksemplar</label>
        {loadingCopies ? (
          <p className="text-sm">Memuat daftar eksemplar...</p>
        ) : copiesList && copiesList.length > 0 ? (
          <select
            value={selectedCopyId}
            onChange={(e) => {
              setSelectedCopyId(e.target.value);
              setScanning(false);
            }}
            className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
          >
            <option value="">— pilih eksemplar —</option>
            {copiesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.inventory_code} — {c.preferred_title}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Belum ada eksemplar. Tambahkan copy terlebih dahulu.
          </p>
        )}
      </div>

      {selectedCopy && (
        <>
          <div className="rounded-lg border border-[var(--color-border)] p-4">
            <p className="text-xs uppercase text-[var(--color-ink-soft)]">
              {selectedCopy.inventory_code}
            </p>
            <p className="font-[family-name:var(--font-heading)] text-xl">
              {selectedCopy.preferred_title}
            </p>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              {pages?.length ?? 0} halaman tersimpan
            </p>
          </div>

          {!scanning ? (
            <button
              onClick={() => setScanning(true)}
              disabled={uploadMutation.isPending}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              Pindai Halaman {(pages?.length ?? 0) + 1}
            </button>
          ) : (
            <DocumentScanner onCapture={(blob) => uploadMutation.mutate(blob)} />
          )}

          {uploadMutation.isPending && (
            <p className="text-sm text-[var(--color-ink-soft)]">Menyimpan & menjalankan OCR...</p>
          )}

          {pages && pages.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-lg">Halaman Tersimpan</h2>
              {pages.map((p) => (
                <div key={p.id} className="rounded-md border border-[var(--color-border)] p-3">
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    Halaman {p.page_sequence} — confidence {(p.ocr_confidence * 100).toFixed(0)}%
                  </p>
                  <p className="mt-1 text-sm">{p.ocr_text}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
