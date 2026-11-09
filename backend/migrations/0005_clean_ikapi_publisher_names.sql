-- =============================================================
-- Bersihkan nama penerbit IKAPI yang masuk dengan quote literal.
-- Idempoten: aman dijalankan ulang.
-- =============================================================

BEGIN;

UPDATE agents
SET
  authorized_name = 'Academy',
  brand_name = CASE
    WHEN brand_name = '\"Academy\"' THEN 'Academy'
    ELSE brand_name
  END
WHERE authorized_name = '\"Academy\"'
  AND source_url = 'https://www.ikapi.org/anggota-ikapi/';

COMMIT;
