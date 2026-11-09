-- =============================================================
-- Merge duplikasi konseptual penerbit dari batch seed/Wikidata.
-- Idempoten: aman dijalankan ulang.
-- =============================================================

BEGIN;

CREATE TEMP TABLE _publisher_agent_merges (
  canonical_name text NOT NULL,
  duplicate_name text NOT NULL
) ON COMMIT DROP;

INSERT INTO _publisher_agent_merges (canonical_name, duplicate_name) VALUES
  ('Djambatan', 'Penerbit Djambatan'),
  ('Erlangga', 'Penerbit Erlangga'),
  ('Kanisius', 'PT Kanisius'),
  ('Mizan Pustaka', 'Mizan'),
  ('Republika Penerbit', 'penerbit Republika'),
  ('Poestaka Rakjat', 'Pustaka Rakyat');

-- Lengkapi data canonical dari duplicate sebelum referensi dipindahkan.
WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE agents c
SET
  alternate_names = NULLIF((
    SELECT string_agg(alias_name, '; ' ORDER BY alias_name)
    FROM (
      SELECT DISTINCT trim(value) AS alias_name
      FROM regexp_split_to_table(concat_ws('; ',
        c.alternate_names,
        d.authorized_name,
        d.alternate_names,
        d.legal_name,
        d.brand_name
      ), ';') AS value
      WHERE trim(value) <> ''
        AND lower(trim(value)) <> lower(c.authorized_name)
    ) aliases
  ), ''),
  legal_name = COALESCE(NULLIF(c.legal_name, ''), NULLIF(d.legal_name, '')),
  brand_name = COALESCE(NULLIF(c.brand_name, ''), NULLIF(c.authorized_name, ''), NULLIF(d.brand_name, '')),
  birth_or_founding_year = COALESCE(c.birth_or_founding_year, d.birth_or_founding_year),
  death_or_dissolution_year = COALESCE(c.death_or_dissolution_year, d.death_or_dissolution_year),
  website_url = COALESCE(NULLIF(c.website_url, ''), NULLIF(d.website_url, '')),
  email = COALESCE(NULLIF(c.email, ''), NULLIF(d.email, '')),
  phone = COALESCE(NULLIF(c.phone, ''), NULLIF(d.phone, '')),
  country_id = COALESCE(c.country_id, d.country_id),
  city_id = COALESCE(c.city_id, d.city_id),
  address = COALESCE(NULLIF(c.address, ''), NULLIF(d.address, '')),
  historical_period = COALESCE(NULLIF(c.historical_period, ''), NULLIF(d.historical_period, '')),
  imprint_names = COALESCE(NULLIF(c.imprint_names, ''), NULLIF(d.imprint_names, '')),
  source_url = COALESCE(NULLIF(c.source_url, ''), NULLIF(d.source_url, '')),
  source_note = NULLIF(concat_ws(' | ', NULLIF(c.source_note, ''), NULLIF(d.source_note, '')), ''),
  verified_at = COALESCE(c.verified_at, d.verified_at),
  confidence_level = COALESCE(NULLIF(c.confidence_level, ''), NULLIF(d.confidence_level, '')),
  notes = NULLIF(concat_ws(' ', NULLIF(c.notes, ''), NULLIF(d.notes, '')), '')
FROM pairs p
JOIN agents d ON d.id = p.duplicate_id
WHERE c.id = p.canonical_id;

-- Pindahkan role umum.
WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
INSERT INTO agent_roles (agent_id, role, source_note)
SELECT p.canonical_id, ar.role, ar.source_note
FROM pairs p
JOIN agent_roles ar ON ar.agent_id = p.duplicate_id
ON CONFLICT (agent_id, role) DO UPDATE
SET source_note = COALESCE(NULLIF(EXCLUDED.source_note, ''), agent_roles.source_note);

-- Hindari konflik unique sebelum memindahkan relasi karya/edisi.
WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
DELETE FROM work_agents dup
USING pairs p, work_agents canon
WHERE dup.agent_id = p.duplicate_id
  AND canon.agent_id = p.canonical_id
  AND canon.work_id = dup.work_id
  AND canon.role = dup.role;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
DELETE FROM edition_agents dup
USING pairs p, edition_agents canon
WHERE dup.agent_id = p.duplicate_id
  AND canon.agent_id = p.canonical_id
  AND canon.edition_id = dup.edition_id
  AND canon.role = dup.role;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE work_agents wa
SET agent_id = p.canonical_id
FROM pairs p
WHERE wa.agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE edition_agents ea
SET agent_id = p.canonical_id
FROM pairs p
WHERE ea.agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE acquisitions a SET seller_agent_id = p.canonical_id FROM pairs p WHERE a.seller_agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE valuations v SET appraiser_agent_id = p.canonical_id FROM pairs p WHERE v.appraiser_agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE provenance_events pe SET owner_agent_id = p.canonical_id FROM pairs p WHERE pe.owner_agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE provenance_events pe SET counterparty_agent_id = p.canonical_id FROM pairs p WHERE pe.counterparty_agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE wishlist_offers wo SET seller_agent_id = p.canonical_id FROM pairs p WHERE wo.seller_agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE disposals d SET buyer_agent_id = p.canonical_id FROM pairs p WHERE d.buyer_agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE book_entity_mentions bem SET linked_agent_id = p.canonical_id FROM pairs p WHERE bem.linked_agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE agents a SET predecessor_agent_id = p.canonical_id FROM pairs p WHERE a.predecessor_agent_id = p.duplicate_id;

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE agents a SET successor_agent_id = p.canonical_id FROM pairs p WHERE a.successor_agent_id = p.duplicate_id;

-- Author profile jarang relevan untuk penerbit, tapi tetap aman dipindahkan.
WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
UPDATE author_profiles ap
SET agent_id = p.canonical_id
FROM pairs p
WHERE ap.agent_id = p.duplicate_id
  AND NOT EXISTS (SELECT 1 FROM author_profiles existing WHERE existing.agent_id = p.canonical_id);

WITH pairs AS (
  SELECT c.id AS canonical_id, d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents c ON c.authorized_name = m.canonical_name
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
DELETE FROM author_profiles ap
USING pairs p
WHERE ap.agent_id = p.duplicate_id;

-- Hapus duplicate agents setelah semua data penting dipindahkan.
WITH pairs AS (
  SELECT d.id AS duplicate_id
  FROM _publisher_agent_merges m
  JOIN agents d ON d.authorized_name = m.duplicate_name
)
DELETE FROM agents a
USING pairs p
WHERE a.id = p.duplicate_id;

COMMIT;
