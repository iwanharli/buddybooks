-- =============================================================
-- Kolom pendukung fallback VLM (Gemini/OpenRouter) untuk halaman
-- OCR yang low-coverage. Lihat ocr-service/vlm_assist.py dan
-- README.md#ocr--fallback-vlm.
--
-- Idempoten.
-- =============================================================

BEGIN;

ALTER TABLE book_pages ADD COLUMN IF NOT EXISTS low_coverage boolean NOT NULL DEFAULT false;
ALTER TABLE book_pages ADD COLUMN IF NOT EXISTS ocr_provider text;

COMMIT;
