import HTMLFlipBook from "react-pageflip";

interface PageFlipBookProps {
  pageImageUrls: string[];
  width?: number;
  height?: number;
}

/**
 * Efek "membalik halaman" opsional untuk kesan membaca buku fisik.
 * Cocok untuk pratinjau cepat/preview gratis (editions.preview_free_pages),
 * bukan pengganti PageZoomViewer untuk pemeriksaan detail.
 */
export function PageFlipBook({ pageImageUrls, width = 320, height = 460 }: PageFlipBookProps) {
  return (
    // @ts-expect-error - react-pageflip's type defs are incomplete for children prop
    <HTMLFlipBook width={width} height={height} className="mx-auto" showCover>
      {pageImageUrls.map((url, i) => (
        <div key={i} className="bg-white">
          <img src={url} alt={`Halaman ${i + 1}`} className="h-full w-full object-cover" />
        </div>
      ))}
    </HTMLFlipBook>
  );
}
