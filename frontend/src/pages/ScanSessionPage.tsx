import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, ScanText, Sparkles } from "lucide-react";
import { DocumentScanner } from "../features/scanner/DocumentScanner";
import { listCopies } from "../features/copies/api";
import { uploadPage, listPages, rescanPage } from "../features/reader/api";
import { OcrTextView } from "../features/reader/OcrTextView";
import { parseOcrText } from "../features/reader/parseOcrText";

// Badge keyakinan OCR: warna mencerminkan seberapa layak teksnya dipercaya
// tanpa dibaca manual dulu — hijau = tinggi, biru = cukup, kuning = perlu dicek.
function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.9) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (confidence >= 0.7) return "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-transparent";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

/**
 * Sesi pemindaian multi-halaman: pilih eksemplar (copy), lalu pindai
 * berturut-turut. Tiap halaman langsung tersimpan permanen ke book_pages +
 * media_assets (bukan cuma pratinjau di layar seperti /scanner-demo).
 */
const CLAMP_THRESHOLD = 260; // kira-kira 6 baris teks body; di bawah ini tak perlu tombol expand

export default function ScanSessionPage() {
  const [selectedCopyId, setSelectedCopyId] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [dewarp, setDewarp] = useState(false);
  // Halaman mana yang teksnya sedang ditampilkan penuh (bukan dipotong).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: copiesList, isLoading: loadingCopies } = useQuery({
    queryKey: ["copies"],
    queryFn: listCopies,
  });

  const { data: pages } = useQuery({
    queryKey: ["pages", selectedCopyId],
    queryFn: () => listPages(selectedCopyId),
    enabled: !!selectedCopyId,
    // Polling ringan HANYA saat ada halaman low_coverage yang belum dapat
    // ocr_provider — artinya fallback VLM (Gemini/OpenRouter) masih jalan
    // async di background (lihat README.md#ocr--fallback-vlm). Begitu semua
    // halaman low_coverage sudah punya ocr_provider (atau tidak ada sama
    // sekali), polling berhenti otomatis supaya tidak nge-hit API terus.
    refetchInterval: (query) => {
      const hasPending = query.state.data?.some((p) => p.low_coverage && !p.ocr_provider);
      return hasPending ? 4000 : false;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (blob: Blob) => uploadPage(selectedCopyId, blob, dewarp),
    onSuccess: (result) => {
      const n = result.pages.length;
      if (result.layout === "spread" && n > 1) {
        toast.success(`Terdeteksi ${n} halaman (bentang) — tersimpan terpisah`);
      } else {
        const p = result.pages[0];
        toast.success(`Halaman ${p.page_sequence} tersimpan (keyakinan ${(p.ocr_confidence * 100).toFixed(0)}%)`);
      }
      queryClient.invalidateQueries({ queryKey: ["pages", selectedCopyId] });
      setScanning(false); // kembali ke daftar; tekan "Pindai Halaman Berikutnya" untuk lanjut
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan halaman");
      setScanning(false);
    },
  });

  const rescanMutation = useMutation({
    mutationFn: (pageId: string) => rescanPage(pageId),
    onSuccess: () => {
      toast.success("Membaca ulang halaman lewat AI...");
      queryClient.invalidateQueries({ queryKey: ["pages", selectedCopyId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal memulai scan ulang");
    },
  });

  const selectedCopy = copiesList?.find((c) => c.id === selectedCopyId);

  return (
    <div className="space-y-6">
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
            Belum ada eksemplar. Tambahkan eksemplar terlebih dahulu.
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

          <label className="flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={dewarp}
              onChange={(e) => setDewarp(e.target.checked)}
            />
            Halaman melengkung? Aktifkan pelurusan gambar, lebih lambat untuk lengkungan berat
          </label>

          {!scanning ? (
            <button
              onClick={() => setScanning(true)}
              disabled={uploadMutation.isPending}
              className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
            >
              Pindai Halaman {(pages?.length ?? 0) + 1}
            </button>
          ) : (
            <DocumentScanner
              onCapture={(blob) => uploadMutation.mutate(blob)}
              processing={uploadMutation.isPending}
            />
          )}

          {pages && pages.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold">
                Halaman Tersimpan
                <span className="ml-2 text-sm font-normal text-[var(--color-ink-muted)]">({pages.length})</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pages.map((p) => {
                  const isProcessing = p.low_coverage && !p.ocr_provider;
                  const isRescanningThis = rescanMutation.isPending && rescanMutation.variables === p.id;
                  const isLong = p.ocr_text.length > CLAMP_THRESHOLD;
                  const isExpanded = expandedIds.has(p.id);
                  const toggleExpanded = () =>
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    });
                  return (
                    <div
                      key={p.id}
                      className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]">
                            {p.page_sequence}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                              Halaman {p.page_sequence}
                              {p.page_label ? ` · ${p.page_label}` : ""}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(p.ocr_confidence)}`}
                        >
                          {(p.ocr_confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div className="flex-1 px-4 py-3">
                        {isProcessing && (
                          <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium">
                            <ScanText size={13} className="animate-pulse text-[var(--color-accent)]" />
                            <span className="scan-shimmer-text">Sedang diperbaiki AI...</span>
                          </p>
                        )}
                        {p.ocr_provider && (
                          <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                            <Sparkles size={13} />
                            Dikoreksi AI ({p.ocr_provider})
                          </p>
                        )}
                        <div className={`relative ${isLong && !isExpanded ? "max-h-48 overflow-hidden" : ""}`}>
                          <OcrTextView segments={parseOcrText(p.ocr_text)} />
                          {isLong && !isExpanded && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--color-card)] to-transparent" />
                          )}
                        </div>
                        {isLong && (
                          <button
                            type="button"
                            onClick={toggleExpanded}
                            className="mt-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
                          >
                            {isExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
                          </button>
                        )}
                      </div>

                      {p.image_asset_id && (
                        <div className="border-t border-[var(--color-border)] px-4 py-2">
                          <button
                            type="button"
                            onClick={() => rescanMutation.mutate(p.id)}
                            disabled={isProcessing || isRescanningThis}
                            title="Baca ulang halaman ini lewat AI (pakai gambar yang sudah tersimpan)"
                            className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <RefreshCw size={12} className={isRescanningThis ? "animate-spin" : ""} />
                            Scan Ulang
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
