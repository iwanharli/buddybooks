const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

export interface BookPage {
  id: string;
  copy_id: string;
  edition_id: string;
  image_asset_id?: string;
  page_sequence: number;
  ocr_text: string;
  ocr_confidence: number;
  ocr_engine: string;
}

export async function uploadPage(copyId: string, blob: Blob, languages = "ind,nld,eng"): Promise<BookPage> {
  const form = new FormData();
  form.append("image", blob, "page.png");
  form.append("languages", languages);

  const res = await fetch(`${API_BASE_URL}/copies/${copyId}/pages`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listPages(copyId: string): Promise<BookPage[]> {
  const res = await fetch(`${API_BASE_URL}/copies/${copyId}/pages`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
