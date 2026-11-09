import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface UsePaginationOptions {
  initialPageSize?: number;
  resetKey?: string;
}

export function usePagination<T>(
  items: T[],
  { initialPageSize = 25, resetKey = "" }: UsePaginationOptions = {},
) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const setPageSize = (nextPageSize: number) => {
    setPageSizeState(nextPageSize);
  };

  return {
    page,
    pageItems,
    pageSize,
    setPage,
    setPageSize,
    totalItems,
    totalPages,
  };
}

interface TablePaginationProps {
  page: number;
  pageSize: number;
  pageSizeOptions?: number[];
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function TablePagination({
  page,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, page * pageSize);
  const pageNumbers = getVisiblePages(page, safeTotalPages);

  const goToPage = (nextPage: number) => {
    onPageChange(Math.min(Math.max(1, nextPage), safeTotalPages));
  };

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink-soft)] md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Menampilkan <strong className="text-[var(--color-ink)]">{startItem}-{endItem}</strong> dari{" "}
          <strong className="text-[var(--color-ink)]">{totalItems}</strong>
        </span>
        <label className="flex items-center gap-2">
          <span>Baris</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-ink)] outline-none"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <PaginationButton label="Halaman pertama" disabled={page <= 1} onClick={() => goToPage(1)}>
          <ChevronsLeft size={16} />
        </PaginationButton>
        <PaginationButton label="Halaman sebelumnya" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
          <ChevronLeft size={16} />
        </PaginationButton>

        <div className="flex items-center gap-1 px-1">
          {pageNumbers.map((item, index) =>
            item === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="grid h-9 w-9 place-items-center text-[var(--color-ink-muted)]">
                ...
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => goToPage(item)}
                className={`h-9 min-w-9 rounded-lg px-2 text-sm font-semibold ${
                  item === page
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-border)] bg-white text-[var(--color-ink-soft)] hover:border-[var(--color-blue-line)] hover:text-[var(--color-accent)]"
                }`}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </button>
            ),
          )}
        </div>

        <PaginationButton
          label="Halaman berikutnya"
          disabled={page >= safeTotalPages}
          onClick={() => goToPage(page + 1)}
        >
          <ChevronRight size={16} />
        </PaginationButton>
        <PaginationButton
          label="Halaman terakhir"
          disabled={page >= safeTotalPages}
          onClick={() => goToPage(safeTotalPages)}
        >
          <ChevronsRight size={16} />
        </PaginationButton>
      </div>
    </div>
  );
}

function PaginationButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-ink-soft)] hover:border-[var(--color-blue-line)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-ink-soft)]"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function getVisiblePages(page: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  if (page <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (page >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = [...pages]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);

  const out: Array<number | "ellipsis"> = [];
  sortedPages.forEach((value, index) => {
    const previous = sortedPages[index - 1];
    if (previous && value - previous > 1) {
      out.push("ellipsis");
    }
    out.push(value);
  });
  return out;
}
