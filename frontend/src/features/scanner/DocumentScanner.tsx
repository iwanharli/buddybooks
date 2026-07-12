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
 * docs/reader-module.md §27.2 langkah "Pra-proses". Hasil akhir (blob)
 * diteruskan ke endpoint OCR (POST /api/v1/reader/ocr).
 */
export function DocumentScanner({ onCapture, outputWidth = 1240, outputHeight = 1754 }: DocumentScannerProps) {
  const [stage, setStage] = useState<Stage>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<jscanify | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Loop live-preview: gambar overlay deteksi tepi halaman di atas video.
  useEffect(() => {
    if (stage !== "camera") return;

    const tick = () => {
      const video = videoRef.current;
      const overlay = overlayCanvasRef.current;
      const scanner = scannerRef.current;
      if (video && overlay && scanner && video.videoWidth > 0) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        try {
          const highlighted = scanner.highlightPaper(video);
          const ctx = overlay.getContext("2d");
          ctx?.drawImage(highlighted, 0, 0);
        } catch {
          // frame tanpa kontur terdeteksi; lewati
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [stage]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const scanner = scannerRef.current;
    if (!video || !scanner) return;
    try {
      const result = scanner.extractPaper(video, outputWidth, outputHeight);
      setPreviewCanvas(result);
      setStage("preview");
    } catch {
      setErrorMessage("Tepi halaman belum terdeteksi. Coba posisikan ulang buku.");
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
          <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)]">
            <video ref={videoRef} className="hidden" muted playsInline />
            <canvas ref={overlayCanvasRef} className="w-full" />
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
