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
}

// Satu foto bisa menghasilkan >1 book_page bila terdeteksi dua halaman (spread).
export interface UploadResult {
  layout: string; // single | single-dominant | spread
  pages: BookPage[];
}

export async function uploadPage(copyId: string, blob: Blob, dewarp = false): Promise<UploadResult> {
  const form = new FormData();
  form.append("image", blob, "page.png");
  if (dewarp) form.append("dewarp", "true");

  const res = await fetch(`${API_BASE_URL}/copies/${copyId}/pages`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listPages(copyId: string): Promise<BookPage[]> {
  const res = await fetch(`${API_BASE_URL}/copies/${copyId}/pages`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
