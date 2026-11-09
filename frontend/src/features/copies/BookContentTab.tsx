import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, RefreshCw, ScanText, Sparkles, TriangleAlert } from "lucide-react";
import { DocumentScanner } from "../scanner/DocumentScanner";
import { uploadPage, listPages, rescanPage } from "../reader/api";
import { OcrTextView } from "../reader/OcrTextView";
import { parseOcrText, hasQualityWarning, splitPageMarker } from "../reader/parseOcrText";

// Badge keyakinan OCR: warna mencerminkan seberapa layak teksnya dipercaya
// tanpa dibaca manual dulu — hijau = tinggi, biru = cukup, kuning = perlu dicek.
function confidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.9) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (confidence >= 0.7) return "bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-transparent";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

const CLAMP_THRESHOLD = 260; // kira-kira 6 baris teks body; di bawah ini tak perlu tombol expand

/** Isi buku: halaman-halaman yang sudah difoto + dibaca OCR untuk
 * eksemplar ini (book_pages) — beda dari PhotoGallery (dokumentasi visual
 * cover/spine/dst), ini teks isi buku itu sendiri, halaman demi halaman.
 * Kalau jumlah halaman buku (totalPages) sudah diisi, tampil grid nomor
 * 1..totalPages sebagai progress tracker — klik nomor yang belum discan
 * untuk lompat scan LANGSUNG ke nomor itu (bukan cuma nambah di akhir). */
export function BookContentTab({ copyId, totalPages }: { copyId: string; totalPages?: number }) {
  const [scanning, setScanning] = useState(false);
  const [dewarp, setDewarp] = useState(false);
  const [targetSequence, setTargetSequence] = useState<number | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: pages } = useQuery({
    queryKey: ["pages", copyId],
    queryFn: () => listPages(copyId),
    // Polling ringan HANYA saat ada halaman low_coverage yang belum dapat
    // ocr_provider — fallback VLM (Gemini/OpenRouter) masih jalan async di
    // background. Berhenti otomatis begitu semua halaman selesai.
    refetchInterval: (query) => {
      const hasPending = query.state.data?.some((p) => p.low_coverage && !p.ocr_provider);
      return hasPending ? 4000 : false;
    },
  });

  const scannedSequences = new Set(pages?.map((p) => p.page_sequence) ?? []);

  function startScan(target: number | null) {
    setTargetSequence(target);
    setReplaceMode(false);
    setScanning(true);
  }

  function startRetake(target: number) {
    setTargetSequence(target);
    setReplaceMode(true);
    setScanning(true);
  }

  const uploadMutation = useMutation({
    mutationFn: (blob: Blob) => uploadPage(copyId, blob, dewarp, targetSequence ?? undefined, replaceMode),
    onSuccess: (result) => {
      const n = result.pages.length;
      if (result.layout === "spread" && n > 1) {
        toast.success(`Terdeteksi ${n} halaman (bentang) — tersimpan terpisah`);
      } else {
        const p = result.pages[0];
        toast.success(`Halaman ${p.page_sequence} tersimpan (keyakinan ${(p.ocr_confidence * 100).toFixed(0)}%)`);
      }
      queryClient.invalidateQueries({ queryKey: ["pages", copyId] });
      setScanning(false);
      setTargetSequence(null);
      setReplaceMode(false);
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
      queryClient.invalidateQueries({ queryKey: ["pages", copyId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal memulai scan ulang");
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-ink-soft)]">
            {totalPages
              ? `${pages?.length ?? 0} dari ${totalPages} halaman tersimpan`
              : `${pages?.length ?? 0} halaman tersimpan`}
          </p>
          {!scanning && (
            <button
              type="button"
              onClick={() => startScan(null)}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              <Camera size={14} /> Pindai Halaman {(pages?.length ?? 0) + 1}
            </button>
          )}
        </div>

        {!scanning && (
          <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
            <input
              type="checkbox"
              checked={dewarp}
              onChange={(e) => setDewarp(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)]"
            />
            Halaman melengkung? Aktifkan pelurusan gambar, lebih lambat untuk lengkungan berat
          </label>
        )}

        {!!totalPages && (
          <div className="mt-4 grid grid-cols-8 gap-1.5 sm:grid-cols-12 md:grid-cols-16">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
              const isScanned = scannedSequences.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={scanning}
                  onClick={() => {
                    if (isScanned) {
                      document.getElementById(`page-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    } else {
                      startScan(n);
                    }
                  }}
                  title={isScanned ? `Lihat halaman ${n}` : `Scan halaman ${n}`}
                  className={`grid h-8 place-items-center rounded text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isScanned
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        )}

        {scanning && (
          <div className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-soft)] px-3 py-1 text-sm font-medium text-[var(--color-accent)]">
                {replaceMode ? "Foto ulang" : "Memindai"} halaman {targetSequence ?? (pages?.length ?? 0) + 1}
              </span>
              <button
                type="button"
                onClick={() => {
                  setScanning(false);
                  setTargetSequence(null);
                  setReplaceMode(false);
                }}
                className="text-sm text-[var(--color-ink-soft)] hover:underline"
              >
                Batal
              </button>
            </div>
            <DocumentScanner
              onCapture={(blob) => uploadMutation.mutate(blob)}
              processing={uploadMutation.isPending}
              allowManualCrop={false}
              onCancel={() => {
                setScanning(false);
                setTargetSequence(null);
                setReplaceMode(false);
              }}
            />
          </div>
        )}
      </div>

      {pages && pages.length === 0 && (
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-ink-muted)]">
          Belum ada halaman yang dipindai untuk eksemplar ini.
        </p>
      )}

      {pages && pages.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pages.map((p) => {
            const isProcessing = p.low_coverage && !p.ocr_provider;
            const isRescanningThis = rescanMutation.isPending && rescanMutation.variables === p.id;
            const isLong = p.ocr_text.length > CLAMP_THRESHOLD;
            const isExpanded = expandedIds.has(p.id);
            const segments = parseOcrText(p.ocr_text);
            const isBadQuality = hasQualityWarning(segments);
            const { content, pageMarker } = splitPageMarker(segments);
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
                id={`page-${p.page_sequence}`}
                className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm transition hover:shadow-md scroll-mt-4"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-xs font-semibold text-[var(--color-accent)]">
                      {p.page_sequence}
                    </span>
                    <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                      Halaman {p.page_sequence}
                      {p.page_label ? ` · ${p.page_label}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isBadQuality && (
                      <span
                        title="AI menilai foto halaman ini buram/goyang secara keseluruhan — sebaiknya foto ulang"
                        className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                      >
                        <TriangleAlert size={11} /> Kualitas buruk
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(p.ocr_confidence)}`}
                    >
                      {(p.ocr_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
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
                    <OcrTextView segments={content} />
                    {isLong && !isExpanded && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--color-card)] to-transparent" />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    {isLong ? (
                      <button
                        type="button"
                        onClick={toggleExpanded}
                        className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {isExpanded ? "Sembunyikan" : "Lihat selengkapnya"}
                      </button>
                    ) : (
                      <span />
                    )}
                    {pageMarker && (
                      <span className="text-xs tabular-nums text-[var(--color-ink-muted)]">— {pageMarker} —</span>
                    )}
                  </div>
                </div>

                <div className="flex items-stretch divide-x divide-[var(--color-border)] border-t border-[var(--color-border)]">
                  {p.image_asset_id && (
                    <button
                      type="button"
                      onClick={() => rescanMutation.mutate(p.id)}
                      disabled={isProcessing || isRescanningThis || scanning}
                      title="Baca ulang halaman ini lewat AI (pakai gambar yang sudah tersimpan)"
                      className="flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isRescanningThis ? "animate-spin" : ""} />
                      Scan Ulang
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => startRetake(p.page_sequence)}
                    disabled={scanning}
                    title="Foto ulang halaman ini (gambar lama akan diganti, termasuk kalau proses AI sebelumnya macet)"
                    className="flex flex-1 items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-parchment-dim)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Camera size={12} />
                    Foto Ulang
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
