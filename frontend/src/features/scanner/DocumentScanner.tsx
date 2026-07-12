import { useCallback, useEffect, useRef, useState } from "react";
import jscanify from "jscanify/client";
import { Camera, RotateCcw, Check } from "lucide-react";
import { loadOpenCv } from "./loadOpenCv";

interface DocumentScannerProps {
  onCapture: (blob: Blob) => void;
  outputWidth?: number;
  outputHeight?: number;
}

type Stage = "loading" | "camera" | "preview" | "error";

/**
 * Pemindai dokumen di browser: deteksi tepi halaman + koreksi perspektif
 * (jscanify + OpenCV.js, lokal, tanpa server), sesuai pipeline
 * docs/reader-module.md §27.2 langkah "Pra-proses".
 *
 * Video kamera ditampilkan langsung (bukan disembunyikan) karena banyak
 * browser menghentikan decode frame pada elemen <video> yang display:none,
 * membuat videoWidth tetap 0. Deteksi tepi (jscanify) hanya dijalankan
 * sekali saat pengguna menekan "Ambil Foto", bukan tiap frame — sesuai
 * pola pemakaian resmi jscanify dan menghindari beban OpenCV di 60fps.
 */
export function DocumentScanner({ onCapture, outputWidth = 1240, outputHeight = 1754 }: DocumentScannerProps) {
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<jscanify | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadOpenCv()
      .then(async () => {
        if (cancelled) return;
        scannerRef.current = new jscanify();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStage("camera");
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
  }, []);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const scanner = scannerRef.current;
    if (!video || !scanner || video.videoWidth === 0) {
      setErrorMessage("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }

    // Ambil snapshot frame video ke canvas dulu, baru diproses jscanify —
    // OpenCV tidak bekerja langsung dengan baik pada elemen <video> hidup
    // untuk operasi sekali-jalan seperti ini.
    const snapshot = document.createElement("canvas");
    snapshot.width = video.videoWidth;
    snapshot.height = video.videoHeight;
    snapshot.getContext("2d")?.drawImage(video, 0, 0);

    try {
      const result = scanner.extractPaper(snapshot, outputWidth, outputHeight);
      setPreviewCanvas(result);
      setStage("preview");
      setErrorMessage("");
    } catch {
      setErrorMessage("Tepi halaman belum terdeteksi. Pastikan seluruh halaman terlihat dengan latar kontras, lalu coba lagi.");
    }
  }, [outputWidth, outputHeight]);

  const retake = useCallback(() => {
    setPreviewCanvas(null);
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
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
            <video ref={videoRef} className="w-full" muted playsInline autoPlay />
          </div>
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
