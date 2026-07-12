import { useState } from "react";
import { toast } from "sonner";
import { DocumentScanner } from "../features/scanner/DocumentScanner";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

interface OcrResult {
  text: string;
  confidence: number;
  engine: string;
}

export default function ScannerDemoPage() {
  const [result, setResult] = useState<OcrResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCapture(blob: Blob) {
    setLoading(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("image", blob, "page.png");
      form.append("languages", "ind,nld,eng");

      const res = await fetch(`${API_BASE_URL}/reader/ocr`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data: OcrResult = await res.json();
      setResult(data);
      toast.success("OCR selesai");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses OCR");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-4xl">Pindai Halaman</h1>
        <p className="text-[var(--color-ink-soft)]">
          Ambil foto halaman, koreksi perspektif otomatis (jscanify), lalu jalankan OCR
          (Tesseract: Indonesia + Belanda + Inggris).
        </p>
      </div>

      <DocumentScanner onCapture={handleCapture} />

      {loading && <p className="text-sm text-[var(--color-ink-soft)]">Menjalankan OCR...</p>}

      {result && (
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-xs uppercase text-[var(--color-ink-soft)]">
            Hasil OCR — confidence {(result.confidence * 100).toFixed(1)}%
          </p>
          <p className="mt-2 whitespace-pre-wrap">{result.text}</p>
        </div>
      )}
    </div>
  );
}
