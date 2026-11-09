const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export interface BookPage {
  id: string;
  copy_id: string;
  edition_id: string;
  image_asset_id?: string;
  page_label?: string;
  page_sequence: number;
  ocr_text: string;
  ocr_confidence: number;
  ocr_engine: string;
  // low_coverage: RapidOCR kemungkinan under-read halaman ini (lihat
  // backend/internal/domain/reader). Kalau true dan ocr_provider masih
  // kosong, berarti fallback VLM (Gemini/OpenRouter) sedang/akan berjalan
  // async di background dan ocr_text bisa berubah lagi belakangan.
  low_coverage: boolean;
  // ocr_provider: terisi ("gemini" / "openrouter/gemma") setelah fallback
  // VLM selesai meng-update ocr_text lewat webhook OCRWebhook.
  ocr_provider?: string;
}

// Satu foto bisa menghasilkan >1 book_page bila terdeteksi dua halaman (spread).
export interface UploadResult {
  layout: string; // single | single-dominant | spread
  pages: BookPage[];
}

// targetSequence: opsional — lompat scan langsung ke nomor halaman
// tertentu (mis. dari daftar halaman di BookContentTab), bukan selalu
// menambah di akhir. Backend menolak (409) kalau nomor itu sudah terpakai —
// kecuali replace=true (mode "Foto Ulang"), yang menghapus halaman lama
// bernomor sama itu dulu sebelum menyimpan foto baru.
export async function uploadPage(
  copyId: string,
  blob: Blob,
  dewarp = false,
  targetSequence?: number,
  replace?: boolean
): Promise<UploadResult> {
  const form = new FormData();
  form.append("image", blob, "page.png");
  if (dewarp) form.append("dewarp", "true");
  if (targetSequence != null) form.append("target_sequence", String(targetSequence));
  if (replace) form.append("replace", "true");

  const res = await fetch(`${API_BASE_URL}/copies/${copyId}/pages`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listPages(copyId: string): Promise<BookPage[]> {
  const res = await fetch(`${API_BASE_URL}/copies/${copyId}/pages`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// rescanPage: minta backend membaca ulang satu halaman yang sudah tersimpan
// lewat fallback VLM (Gemini/OpenRouter), memakai gambar yang sudah ada di
// disk — tidak perlu memfoto ulang. Async: respons 202 langsung, hasil baru
// muncul belakangan di ocr_text setelah polling listPages mendeteksinya
// (low_coverage dipaksa true oleh backend saat request ini diterima).
export async function rescanPage(pageId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/pages/${pageId}/rescan`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}
