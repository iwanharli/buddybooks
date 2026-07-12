import { useEffect, useRef } from "react";
import OpenSeadragon from "openseadragon";

interface PageZoomViewerProps {
  imageUrl: string;
  height?: number;
}

/**
 * Deep-zoom viewer untuk halaman hasil scan. Dipakai agar pengguna bisa
 * memeriksa detail kerusakan, tanda tangan, atau stempel dari foto
 * resolusi tinggi tanpa gambar pecah, tanpa perlu format IIIF/tile khusus
 * (memakai mode "simple image" OpenSeadragon).
 */
export function PageZoomViewer({ imageUrl, height = 480 }: PageZoomViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    viewerRef.current = OpenSeadragon({
      element: containerRef.current,
      tileSources: { type: "image", url: imageUrl },
      showNavigator: true,
      navigatorPosition: "BOTTOM_RIGHT",
      gestureSettingsMouse: { clickToZoom: false },
      zoomInButton: "zoom-in",
      zoomOutButton: "zoom-out",
      homeButton: "zoom-home",
    });

    return () => {
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [imageUrl]);

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button id="zoom-in" className="rounded border border-[var(--color-border)] px-2 py-1 text-xs">
          Perbesar
        </button>
        <button id="zoom-out" className="rounded border border-[var(--color-border)] px-2 py-1 text-xs">
          Perkecil
        </button>
        <button id="zoom-home" className="rounded border border-[var(--color-border)] px-2 py-1 text-xs">
          Reset
        </button>
      </div>
      <div
        ref={containerRef}
        style={{ height }}
        className="rounded-lg border border-[var(--color-border)] bg-black"
      />
    </div>
  );
}
