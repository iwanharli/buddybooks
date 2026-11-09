-- =============================================================
-- Tandai kategori penerbit dan koreksi status operasional.
-- Idempoten: aman dijalankan ulang.
-- =============================================================

BEGIN;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS publisher_category text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_publisher_category_check'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_publisher_category_check
      CHECK (publisher_category IS NULL OR publisher_category IN
        ('trade_publisher','university_press','academic_publisher',
         'religious_publisher','media_group_publisher','government_publisher',
         'historical_publisher','printer','other'));
  END IF;
END $$;

WITH publisher_agents AS (
  SELECT
    a.id,
    lower(concat_ws(' ',
      a.authorized_name,
      a.alternate_names,
      a.legal_name,
      a.brand_name,
      a.historical_period,
      a.notes
    )) AS haystack,
    EXISTS (
      SELECT 1 FROM agent_roles ar
      WHERE ar.agent_id = a.id AND ar.role = 'publisher'
    ) AS is_publisher,
    EXISTS (
      SELECT 1 FROM agent_roles ar
      WHERE ar.agent_id = a.id AND ar.role = 'printer'
    ) AS is_printer
  FROM agents a
  WHERE a.agent_type = 'organization'
    AND EXISTS (
      SELECT 1 FROM agent_roles ar
      WHERE ar.agent_id = a.id
        AND ar.role IN ('publisher','printer')
    )
)
UPDATE agents a
SET publisher_category = CASE
  WHEN p.is_printer AND NOT p.is_publisher THEN 'printer'
  WHEN p.haystack ~ '(university press|universitas|university|airlangga|alma ata|fhui|fkip|iaida|unswagati)' THEN 'university_press'
  WHEN p.haystack LIKE '%academic publisher%' OR p.haystack ~ '(badan penerbit|press)' THEN 'academic_publisher'
  WHEN p.haystack ~ '(balai pustaka|landsdrukkerij|state publisher|pemerintah)' THEN 'government_publisher'
  WHEN p.haystack ~ '(kompas|gramedia|republika|media group)' THEN 'media_group_publisher'
  WHEN p.haystack ~ '(kanisius|gunung mulia|hidayah|mizan|ar-ruzz|islam|kristen|pesantren)' THEN 'religious_publisher'
  WHEN a.authorized_name IN (
    'A.C. Nix & Co',
    'Albrecht & Co',
    'E.J. Brill',
    'G. Kolff & Co',
    'G.C.T. van Dorp & Co',
    'Hoa Siang In Kiok',
    'J.B. Wolters',
    'Java-Bode',
    'Kho Bie & Co',
    'Martinus Nijhoff',
    'Moestika',
    'Noordhoff-Kolff',
    'P. Noordhoff',
    'Poestaka Rakjat',
    'Pujangga Baru',
    'Tan Khoen Swie'
  ) OR (a.birth_or_founding_year < 1950 AND NULLIF(a.website_url, '') IS NULL) THEN 'historical_publisher'
  ELSE 'trade_publisher'
END
FROM publisher_agents p
WHERE p.id = a.id;

WITH publisher_agents AS (
  SELECT a.id
  FROM agents a
  WHERE a.agent_type = 'organization'
    AND EXISTS (
      SELECT 1 FROM agent_roles ar
      WHERE ar.agent_id = a.id
        AND ar.role IN ('publisher','printer')
    )
)
UPDATE agents a
SET status = CASE
  WHEN a.death_or_dissolution_year IS NOT NULL THEN 'closed'
  WHEN a.authorized_name IN (
    'A.C. Nix & Co',
    'Albrecht & Co',
    'G. Kolff & Co',
    'G.C.T. van Dorp & Co',
    'Hoa Siang In Kiok',
    'J.B. Wolters',
    'Java-Bode',
    'Kho Bie & Co',
    'Landsdrukkerij',
    'Moestika',
    'Noordhoff-Kolff',
    'P. Noordhoff',
    'Poestaka Rakjat',
    'Pujangga Baru',
    'Tan Khoen Swie'
  ) THEN 'closed'
  WHEN NULLIF(a.website_url, '') IS NOT NULL THEN 'active'
  ELSE 'unknown'
END
FROM publisher_agents p
WHERE p.id = a.id;

COMMIT;
