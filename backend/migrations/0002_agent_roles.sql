-- =============================================================
-- Agent roles and richer agent metadata.
--
-- Idempoten untuk database yang sudah dibuat dari 0001 lama.
-- =============================================================

BEGIN;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS brand_name text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES places(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES places(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS historical_period text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS imprint_names text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS publisher_category text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS predecessor_agent_id uuid REFERENCES agents(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS successor_agent_id uuid REFERENCES agents(id);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS source_note text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS confidence_level text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_status_check'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_status_check
      CHECK (status IN ('active','inactive','closed','unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_confidence_level_check'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_confidence_level_check
      CHECK (confidence_level IS NULL OR confidence_level IN ('low','medium','high'));
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS agent_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN
                ('publisher','printer','distributor','binder','author','editor','translator',
                 'seller','appraiser','previous_owner','institution','illustrator','compiler',
                 'contributor','collector','other')),
  source_note text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, role)
);

CREATE INDEX IF NOT EXISTS idx_agent_roles_role ON agent_roles(role);
CREATE INDEX IF NOT EXISTS idx_agent_roles_agent_id ON agent_roles(agent_id);

COMMIT;
