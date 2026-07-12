import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface CarouselProps {
  children: ReactNode[];
}

export function Carousel({ children }: CarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {children.map((child, i) => (
            <div key={i} className="min-w-0 flex-[0_0_240px]">
              {child}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        aria-label="Sebelumnya"
        onClick={() => emblaApi?.scrollPrev()}
        className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border
                   border-[var(--color-border)] bg-[var(--color-parchment)] p-2 shadow-md hover:bg-[var(--color-parchment-dim)]"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Berikutnya"
        onClick={() => emblaApi?.scrollNext()}
        className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rounded-full border
                   border-[var(--color-border)] bg-[var(--color-parchment)] p-2 shadow-md hover:bg-[var(--color-parchment-dim)]"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
