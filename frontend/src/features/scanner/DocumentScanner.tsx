import { useCallback, useEffect, useRef, useState } from "react";
import jscanify from "jscanify/client";
import { Camera, RotateCcw, Check } from "lucide-react";
import { loadOpenCv } from "./loadOpenCv";

interface DocumentScannerProps {
  onCapture: (blob: Blob) => void;
}

type Stage = "loading" | "camera" | "preview" | "error";

/**
 * Pemindai dokumen di browser: deteksi tepi halaman + koreksi perspektif
 * (jscanify + OpenCV.js, lokal, tanpa server), sesuai pipeline
 * docs/reader-module.md §27.2 langkah "Pra-proses".
 *
 * Video kamera ditampilkan langsung (bukan disembunyikan) karena banyak
 * browser menghentikan decode frame pada elemen <video> yang display:none.
 * Deteksi tepi (jscanify) hanya dijalankan sekali saat pengguna menekan
 * "Ambil Foto", bukan tiap frame.
 *
 * Menyediakan pemilihan kamera karena laptop/Mac sering mendaftarkan lebih
 * dari satu perangkat video (mis. Continuity Camera dari iPhone terdaftar
 * meski tidak aktif mengirim gambar, membuat feed tampak hitam).
 */
export function DocumentScanner({ onCapture }: DocumentScannerProps) {
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<jscanify | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);

  const startStream = useCallback(async (deviceId?: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
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

    loadOpenCv()
      .then(async () => {
        if (cancelled) return;
        scannerRef.current = new jscanify();
        await startStream();
        if (!cancelled) setStage("camera");
      })
      .catch((err) => {
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

  // Tampilkan info debug (ukuran frame nyata) agar mudah memastikan video
  // benar-benar menerima gambar, bukan cuma "tersambung" tapi kosong.
  useEffect(() => {
    if (stage !== "camera") return;
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (v) {
        setDebugInfo(`${v.videoWidth}x${v.videoHeight}, readyState=${v.readyState}, paused=${v.paused}`);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [stage]);

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
    const scanner = scannerRef.current;
    if (!video || !scanner || video.videoWidth === 0) {
      setErrorMessage("Kamera belum siap (videoWidth=0). Tunggu sebentar atau ganti kamera lalu coba lagi.");
      return;
    }

    const snapshot = document.createElement("canvas");
    snapshot.width = video.videoWidth;
    snapshot.height = video.videoHeight;
    snapshot.getContext("2d")?.drawImage(video, 0, 0);
    const frameArea = snapshot.width * snapshot.height;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cv = (window as any).cv;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    let img: unknown = null;
    let contour: unknown = null;
    let autoCropped = false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      img = (cv as any).imread(snapshot);
      contour = scanner.findPaperContour(img);

      if (contour) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const area = (cv as any).contourArea(contour);
        const corners = scanner.getCornerPoints(contour);
        const { topLeftCorner: tl, topRightCorner: tr, bottomLeftCorner: bl, bottomRightCorner: br } = corners;

        // Terima hasil crop hanya bila keempat sudut lengkap DAN kontur
        // cukup besar (>=15% frame). Bila tidak, gunakan foto penuh — deteksi
        // sering gagal saat halaman memenuhi frame atau kontras latar rendah.
        if (tl && tr && bl && br && area >= frameArea * 0.15) {
          const width = Math.round(Math.max(dist(tl, tr), dist(bl, br)));
          const height = Math.round(Math.max(dist(tl, bl), dist(tr, br)));
          const result = scanner.extractPaper(snapshot, width, height, corners);
          if (result) {
            setPreviewCanvas(result);
            autoCropped = true;
          }
        }
      }
    } catch {
      // abaikan; jatuh ke fallback foto penuh di bawah
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (img as any)?.delete?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (contour as any)?.delete?.();
    }

    if (!autoCropped) {
      // Fallback: pakai foto penuh apa adanya. OCR tetap jalan; pengguna
      // bisa mengambil ulang bila ingin auto-crop yang lebih rapi.
      setPreviewCanvas(snapshot);
    }
    setStage("preview");
    setErrorMessage(autoCropped ? "" : "Tepi halaman tidak terdeteksi otomatis — memakai foto penuh. Anda tetap bisa memakainya, atau ambil ulang dengan latar lebih kontras.");
  }, []);

  const retake = useCallback(() => {
    setPreviewCanvas(null);
    setErrorMessage("");
    setStage("camera");
  }, []);

  const confirm = useCallback(() => {
    previewCanvas?.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/png");
  }, [previewCanvas, onCapture]);

  if (stage === "error") {
    return (
      <p role="alert" className="text-sm text-red-700">
        Gagal mengakses kamera atau OpenCV.js: {errorMessage}
      </p>
    );
  }

  if (stage === "loading") {
    return <p className="text-sm text-[var(--color-ink-soft)]">Memuat pemindai...</p>;
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
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-black">
            <video ref={videoRef} className="w-full" muted playsInline autoPlay />
          </div>
          <p className="text-xs text-[var(--color-ink-soft)]">Debug: {debugInfo}</p>
          <button
            onClick={capture}
            className="flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90"
          >
            <Camera size={16} /> Ambil Foto
          </button>
          {errorMessage && <p className="text-xs text-red-700">{errorMessage}</p>}
        </>
      )}

      {stage === "preview" && previewCanvas && (
        <>
          {errorMessage && <p className="text-xs text-[var(--color-ink-soft)]">{errorMessage}</p>}
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <img src={previewCanvas.toDataURL()} alt="Hasil pindai" className="w-full" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={retake}
              className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)]"
            >
              <RotateCcw size={16} /> Ambil Ulang
            </button>
            <button
              onClick={confirm}
              className="flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90"
            >
              <Check size={16} /> Gunakan Halaman Ini
            </button>
          </div>
        </>
      )}
    </div>
  );
}
