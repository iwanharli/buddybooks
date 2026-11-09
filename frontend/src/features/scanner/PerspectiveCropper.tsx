import { useEffect, useRef, useState } from "react";
import jscanify from "jscanify/client";
import { Check, X } from "lucide-react";
import { loadOpenCv } from "./loadOpenCv";

interface Point {
  x: number;
  y: number;
}

interface Corners {
  tl: Point;
  tr: Point;
  bl: Point;
  br: Point;
}

interface PerspectiveCropperProps {
  // file: sumber gambar apa adanya (dari kamera atau input file) — belum
  // di-crop sama sekali, pengguna menentukan sendiri 4 titik sudutnya.
  file: File | Blob;
  // initialCorners: kalau ada hasil deteksi tepi otomatis (mis. dari
  // DocumentScanner), pakai itu sebagai titik awal supaya pengguna tinggal
  // menyesuaikan sedikit, bukan mulai dari nol.
  initialCorners?: Corners;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

/**
 * Overlay 4 titik sudut yang bisa digeser di atas gambar, lalu koreksi
 * perspektif ke area itu (jscanify + OpenCV.js, mesin yang sama dengan
 * auto-crop DocumentScanner) — dipakai saat deteksi otomatis salah/kurang
 * pas, atau untuk berkas yang diunggah (tidak lewat deteksi tepi sama
 * sekali, jadi butuh titik awal manual).
 *
 * Titik-titik disimpan dalam koordinat piksel ASLI gambar (bukan piksel
 * layar) — SVG overlay diberi viewBox sesuai naturalWidth/naturalHeight
 * gambar, jadi otomatis ikut skala berapa pun ukuran tampilnya, dan
 * konversi posisi drag layar->gambar cukup lewat getScreenCTM().inverse().
 */
export function PerspectiveCropper({ file, initialCorners, onConfirm, onCancel }: PerspectiveCropperProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [corners, setCorners] = useState<Corners | null>(initialCorners ?? null);
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scannerRef = useRef<any>(null);
  const draggingRef = useRef<keyof Corners | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    loadOpenCv().then(() => {
      if (cancelled) return;
      scannerRef.current = new jscanify();
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setNaturalSize({ width: w, height: h });
    if (!initialCorners) {
      // Default: sedikit menjorok dari tepi (8%) supaya pengguna tinggal
      // menyesuaikan, bukan mulai dari nol.
      const insetX = w * 0.08;
      const insetY = h * 0.08;
      setCorners({
        tl: { x: insetX, y: insetY },
        tr: { x: w - insetX, y: insetY },
        bl: { x: insetX, y: h - insetY },
        br: { x: w - insetX, y: h - insetY },
      });
    }
  }

  function toSvgPoint(clientX: number, clientY: number): Point {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function handlePointerMove(e: React.PointerEvent) {
    const key = draggingRef.current;
    if (!key || !corners || !naturalSize) return;
    const p = toSvgPoint(e.clientX, e.clientY);
    setCorners({
      ...corners,
      [key]: {
        x: Math.max(0, Math.min(naturalSize.width, p.x)),
        y: Math.max(0, Math.min(naturalSize.height, p.y)),
      },
    });
  }

  function confirm() {
    if (!corners || !naturalSize || !imageUrl) return;
    setProcessing(true);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = naturalSize.width;
      canvas.height = naturalSize.height;
      canvas.getContext("2d")?.drawImage(img, 0, 0);

      const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
      const width = Math.round(Math.max(dist(corners.tl, corners.tr), dist(corners.bl, corners.br)));
      const height = Math.round(Math.max(dist(corners.tl, corners.bl), dist(corners.tr, corners.br)));

      let result: HTMLCanvasElement | null = null;
      try {
        result =
          scannerRef.current?.extractPaper(canvas, width, height, {
            topLeftCorner: corners.tl,
            topRightCorner: corners.tr,
            bottomLeftCorner: corners.bl,
            bottomRightCorner: corners.br,
          }) ?? null;
      } catch {
        result = null;
      }

      (result ?? canvas).toBlob((blob) => {
        setProcessing(false);
        if (blob) onConfirm(blob);
      }, "image/png");
    };
    img.src = imageUrl;
  }

  if (!ready || !imageUrl) {
    return <p className="text-sm text-[var(--color-ink-soft)]">Memuat pemindai...</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-ink-soft)]">
        Geser 4 titik sudut supaya pas dengan tepi buku, lalu konfirmasi.
      </p>
      <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-black">
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <img
          src={imageUrl}
          alt="Sumber crop"
          onLoad={handleImageLoad}
          className="block w-full select-none"
          draggable={false}
        />
        {naturalSize && corners && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerMove={handlePointerMove}
            onPointerUp={() => {
              draggingRef.current = null;
            }}
          >
            <polygon
              points={`${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${corners.br.x},${corners.br.y} ${corners.bl.x},${corners.bl.y}`}
              fill="rgba(59,130,246,0.25)"
              stroke="rgb(59,130,246)"
              strokeWidth={naturalSize.width * 0.004}
            />
            {(Object.keys(corners) as (keyof Corners)[]).map((key) => (
              <circle
                key={key}
                cx={corners[key].x}
                cy={corners[key].y}
                r={naturalSize.width * 0.018}
                fill="white"
                stroke="rgb(59,130,246)"
                strokeWidth={naturalSize.width * 0.005}
                className="cursor-move touch-none"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  draggingRef.current = key;
                }}
              />
            ))}
          </svg>
        )}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-4 py-2 text-sm hover:bg-[var(--color-parchment-dim)] disabled:opacity-50"
        >
          <X size={16} /> Batal
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={processing}
          className="flex items-center gap-2 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
        >
          <Check size={16} /> {processing ? "Memproses..." : "Gunakan Crop Ini"}
        </button>
      </div>
    </div>
  );
}
