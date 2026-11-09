import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Crop, RotateCcw, Check, ScanText, X } from "lucide-react";
import { PerspectiveCropper } from "./PerspectiveCropper";

interface DocumentScannerProps {
  onCapture: (blob: Blob) => void;
  // processing: true selagi backend membaca teks dari foto yang sudah
  // dikonfirmasi (upload + OCR sedang berjalan). Menampilkan overlay
  // pemindaian di atas pratinjau & mengunci tombol supaya tidak dobel kirim.
  processing?: boolean;
  // confirmLabel: teks tombol konfirmasi — default "Gunakan Halaman Ini"
  // cocok untuk alur OCR, tapi pemakaian lain (mis. foto eksemplar biasa)
  // perlu label berbeda ("Gunakan Foto Ini").
  confirmLabel?: string;
  // allowManualCrop: tombol "Sesuaikan Crop" (4 titik manual) — sengaja
  // cuma untuk galeri foto & foto sampul (dokumentasi visual, di mana
  // crop presisi penting untuk tampilan). Alur scan isi buku (OCR) tidak
  // butuh ini: auto-crop + fallback foto penuh sudah cukup, backend toh
  // segmentasi ulang otomatis (segment_pages) kalau ada sisi terpotong.
  allowManualCrop?: boolean;
  // onCancel: kalau diisi, tahap "camera" dirender full-screen (video penuh
  // layar + tombol jepret bulat mengambang di bawah tengah, seperti
  // aplikasi kamera native) dengan tombol X (memanggil onCancel) untuk
  // menutup — dipakai saat DocumentScanner dibuka sebagai alur utama
  // (bukan cuma elemen kecil di dalam halaman). Tahap pratinjau/crop tetap
  // ukuran normal (butuh beberapa tombol aksi, tidak cocok full-screen).
  onCancel?: () => void;
}

type Stage = "camera" | "preview" | "adjusting" | "error";

/**
 * Pemindai dokumen di browser: ambil foto halaman apa adanya (tanpa deteksi
 * tepi otomatis — lihat catatan di bawah), lalu setiap foto langsung
 * diproses AI di backend (gemma → fallback gemini), sesuai pipeline
 * docs/reader-module.md §27.2.
 *
 * Auto-crop tepi halaman (jscanify + OpenCV.js) SENGAJA dihapus: di praktik
 * seringkali salah deteksi (mis. malah mengunci ke motif latar/meja alih-
 * alih tepi kertas polos), menambah jeda per-jepret tanpa manfaat pasti, dan
 * AI VLM yang sekarang WAJIB membaca tiap foto sudah cukup toleran terhadap
 * foto utuh berlatar. Tombol "Sesuaikan Crop" manual (PerspectiveCropper)
 * tetap tersedia terpisah untuk kasus yang butuh crop presisi.
 *
 * Video kamera ditampilkan langsung (bukan disembunyikan) karena banyak
 * browser menghentikan decode frame pada elemen <video> yang display:none.
 *
 * Menyediakan pemilihan kamera karena laptop/Mac sering mendaftarkan lebih
 * dari satu perangkat video (mis. Continuity Camera dari iPhone terdaftar
 * meski tidak aktif mengirim gambar, membuat feed tampak hitam).
 */
export function DocumentScanner({
  onCapture,
  processing = false,
  confirmLabel = "Gunakan Halaman Ini",
  allowManualCrop = true,
  onCancel,
}: DocumentScannerProps) {
  const [stage, setStage] = useState<Stage>("camera");
  const [errorMessage, setErrorMessage] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // previewCanvas = foto hasil jepret, dikirim APA ADANYA ke backend (tanpa
  // crop otomatis). Deteksi 1 halaman / 1 dominan (sisi lain terpotong) /
  // bentang 2 halaman dilakukan otomatis di sana (segment_pages,
  // ocr-service/segment.py) — tidak perlu pengguna memilih Kiri/Kanan/Penuh
  // manual sebelum upload.
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);
  // rawSnapshot: foto asli, dipakai sebagai titik awal kalau pengguna buka
  // "Sesuaikan Crop" manual.
  const [rawSnapshot, setRawSnapshot] = useState<HTMLCanvasElement | null>(null);

  const startStream = useCallback(async (deviceId?: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // width/height "ideal" tinggi WAJIB diminta eksplisit — tanpa ini browser
    // (terutama mobile) sering jatuh ke resolusi default rendah (~640x480/VGA)
    // yang membuat OCR gagal baca halaman buku penuh (huruf jadi cuma
    // beberapa piksel). "ideal" hanya hint: browser tetap membatasi ke
    // resolusi maksimum yang didukung kamera, tidak akan error bila kamera
    // tak sanggup mencapainya.
    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 4096 },
      height: { ideal: 4096 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" }),
    };
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
    streamRef.current = stream;

    // Catatan: stream TIDAK dipasang ke <video> di sini karena elemen video
    // mungkin belum ter-render (mis. saat stage masih "loading"). Pemasangan
    // dilakukan di useEffect setelah stage="camera" agar videoRef sudah ada.

    // Perbarui daftar perangkat (label baru terisi setelah izin diberikan).
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
    setDevices(videoInputs);

    const activeTrack = stream.getVideoTracks()[0];
    const activeDeviceId = activeTrack?.getSettings().deviceId;
    if (activeDeviceId) setSelectedDeviceId(activeDeviceId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    startStream().catch((err) => {
      if (!cancelled) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStage("error");
      }
    });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pasang stream ke elemen <video> SETELAH video ter-render (stage=camera).
  // Ini memperbaiki kasus video 0x0/paused karena srcObject tak pernah
  // terpasang saat stream diambil sebelum elemen video ada di DOM.
  useEffect(() => {
    if (stage !== "camera") return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      video.play().catch((err) => {
        setErrorMessage("Gagal memutar video: " + (err instanceof Error ? err.message : String(err)));
      });
    }
  }, [stage, selectedDeviceId]);


  const handleDeviceChange = useCallback(
    async (deviceId: string) => {
      try {
        await startStream(deviceId);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [startStream]
  );

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setErrorMessage("Kamera belum siap (videoWidth=0). Tunggu sebentar atau ganti kamera lalu coba lagi.");
      return;
    }

    const snapshot = document.createElement("canvas");
    snapshot.width = video.videoWidth;
    snapshot.height = video.videoHeight;
    snapshot.getContext("2d")?.drawImage(video, 0, 0);

    setPreviewCanvas(snapshot);
    setRawSnapshot(snapshot);
    setStage("preview");
    setErrorMessage("");
  }, []);

  const retake = useCallback(() => {
    setPreviewCanvas(null);
    setRawSnapshot(null);
    setErrorMessage("");
    setStage("camera");
  }, []);

  const confirm = useCallback(() => {
    previewCanvas?.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/png");
  }, [previewCanvas, onCapture]);

  const applyManualCrop = useCallback((blob: Blob) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      setPreviewCanvas(canvas);
      setStage("preview");
      setErrorMessage("");
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(blob);
  }, []);

  if (stage === "error") {
    return (
      <p role="alert" className="text-sm text-red-700">
        Gagal mengakses kamera atau OpenCV.js: {errorMessage}
      </p>
    );
  }

  // Panduan sudut — murni visual, membantu pengguna membingkai halaman;
  // foto tetap diambil utuh apa adanya saat "Ambil Foto" (tidak ada crop
  // otomatis lagi).
  const cornerGuides = (
    <div className="pointer-events-none absolute inset-6 sm:inset-16">
      {(
        [
          "top-0 left-0 border-t-2 border-l-2",
          "top-0 right-0 border-t-2 border-r-2",
          "bottom-0 left-0 border-b-2 border-l-2",
          "bottom-0 right-0 border-b-2 border-r-2",
        ] as const
      ).map((pos) => (
        <div key={pos} className={`absolute h-8 w-8 border-white/70 ${pos}`} />
      ))}
    </div>
  );

  if (stage === "camera" && onCancel) {
    // Full-screen ala aplikasi kamera native: video penuh layar, tombol
    // jepret bulat mengambang di bawah tengah, X untuk batal di kanan atas.
    return (
      <div className="fixed inset-0 z-[70] flex flex-col bg-black">
        <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline autoPlay />
        {cornerGuides}

        <div className="relative z-10 flex items-center justify-between gap-2 p-4">
          {devices.length > 1 ? (
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="rounded-md border border-white/30 bg-black/50 px-2 py-1.5 text-sm text-white"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="text-black">
                  {d.label || `Kamera ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          ) : (
            <span />
          )}
          <button
            onClick={onCancel}
            aria-label="Batal"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <p className="relative z-10 mx-4 rounded-md bg-red-500/90 px-3 py-2 text-sm text-white">{errorMessage}</p>
        )}

        <div className="relative z-10 mt-auto flex justify-center pb-10 pt-6">
          <button
            onClick={capture}
            aria-label="Ambil Foto"
            className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-lg ring-4 ring-white/30 transition active:scale-95"
          >
            <Camera size={26} className="text-black" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stage === "camera" && (
        <>
          {devices.length > 1 && (
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Kamera ${d.deviceId.slice(0, 6)}`}
                </option>
              ))}
            </select>
          )}
          <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-black shadow-sm">
            <video ref={videoRef} className="aspect-[3/4] w-full object-cover" muted playsInline autoPlay />
            {cornerGuides}
          </div>
          <button
            onClick={capture}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
          >
            <Camera size={17} /> Ambil Foto
          </button>
          {errorMessage && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
          )}
        </>
      )}

      {stage === "preview" && previewCanvas && (
        <>
          {errorMessage && <p className="text-sm text-[var(--color-ink-soft)]">{errorMessage}</p>}

          <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)]">
            <img src={previewCanvas.toDataURL()} alt="Hasil pindai" className="w-full" />
            {processing && (
              <div className="scan-overlay" role="status" aria-live="polite">
                <div className="scan-overlay__line" />
                <span className="scan-overlay__badge">
                  <ScanText size={15} className="animate-pulse text-[var(--color-accent)]" />
                  <span className="scan-shimmer-text">Membaca teks dari gambar...</span>
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={retake}
              disabled={processing}
              className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCcw size={16} /> Ambil Ulang
            </button>
            {allowManualCrop && rawSnapshot && (
              <button
                onClick={() => setStage("adjusting")}
                disabled={processing}
                className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Crop size={16} /> Sesuaikan Crop
              </button>
            )}
            <button
              onClick={confirm}
              disabled={processing}
              className="flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? (
                <>
                  <ScanText size={16} className="animate-pulse" /> Memproses...
                </>
              ) : (
                <>
                  <Check size={16} /> {confirmLabel}
                </>
              )}
            </button>
          </div>
        </>
      )}

      {stage === "adjusting" && rawSnapshot && (
        <PerspectiveCropperFromCanvas
          canvas={rawSnapshot}
          onConfirm={(blob) => applyManualCrop(blob)}
          onCancel={() => setStage("preview")}
        />
      )}
    </div>
  );
}

// PerspectiveCropperFromCanvas: jembatan kecil karena rawSnapshot berupa
// HTMLCanvasElement (hasil drawImage dari <video>), sedangkan
// PerspectiveCropper menerima File/Blob (dipakai bersama alur unggah
// berkas yang sumbernya memang File).
function PerspectiveCropperFromCanvas({
  canvas,
  onConfirm,
  onCancel,
}: {
  canvas: HTMLCanvasElement;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    canvas.toBlob((b) => {
      if (b) setBlob(b);
    }, "image/png");
  }, [canvas]);

  if (!blob) return <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>;

  return <PerspectiveCropper file={blob} onConfirm={onConfirm} onCancel={onCancel} />;
}
