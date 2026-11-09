-- =============================================================
-- Sistem Manajemen Koleksi & Marketplace Buku Tua/Langka
-- DDL PostgreSQL. Diturunkan dari desain README + file DBML.
--
-- Konvensi:
--  - PK uuid (disarankan UUIDv7 dari aplikasi; default gen_random_uuid()).
--  - Enum sebagai TEXT + CHECK (bukan tipe ENUM native) agar extensible.
--  - Waktu sistem: timestamptz. Uang: numeric(18,2), tidak negatif.
--  - Tanggal historis tidak lengkap: kolom *_text + *_year.
--
-- Jalankan pada database kosong. Idempoten pada level extension.
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- pencarian nama/fuzzy

-- -------------------------------------------------------------
-- Fungsi util: auto-update updated_at
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- FONDASI IDENTITAS
-- =============================================================

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  display_name  text,
  password_hash text,
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('guest','buyer','seller','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE sellers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  shop_name     text NOT NULL,
  shop_slug     text NOT NULL UNIQUE,
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_sellers_updated BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE seller_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id),
  role       text NOT NULL CHECK (role IN ('owner','manager','staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (seller_id, user_id)
);

-- =============================================================
-- MASTER REFERENSI (dipakai lintas tabel)
-- =============================================================

CREATE TABLE languages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,   -- ISO 639, mis. id, nl, jv, en, ar
  name        text NOT NULL,
  native_name text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE places (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preferred_name  text NOT NULL,
  alternate_names text,
  place_type      text CHECK (place_type IS NULL OR place_type IN
                    ('city','region','country','building','other')),
  country         text,
  latitude        numeric,
  longitude       numeric,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (preferred_name, place_type)
);

CREATE TABLE shipping_carriers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment_methods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales_channels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- KATALOG: agents, works, editions
-- =============================================================

CREATE TABLE agents (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type                 text NOT NULL CHECK (agent_type IN ('person','organization')),
  authorized_name            text NOT NULL,
  alternate_names            text,
  legal_name                 text,
  brand_name                 text,
  birth_or_founding_year     int,
  death_or_dissolution_year  int,
  website_url                text,
  email                      text,
  phone                      text,
  country_id                 uuid REFERENCES places(id),
  city_id                    uuid REFERENCES places(id),
  address                    text,
  historical_period          text,
  imprint_names              text,
  publisher_category         text CHECK (publisher_category IS NULL OR publisher_category IN
                                ('trade_publisher','university_press','academic_publisher',
                                 'religious_publisher','media_group_publisher','government_publisher',
                                 'historical_publisher','printer','other')),
  predecessor_agent_id       uuid REFERENCES agents(id),
  successor_agent_id         uuid REFERENCES agents(id),
  status                     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','closed','unknown')),
  source_url                 text,
  source_note                text,
  verified_at                timestamptz,
  confidence_level           text CHECK (confidence_level IS NULL OR confidence_level IN ('low','medium','high')),
  notes                      text,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_agents_updated BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_agents_name_trgm ON agents USING gin (authorized_name gin_trgm_ops);

CREATE TABLE agent_roles (
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
CREATE INDEX idx_agent_roles_role ON agent_roles(role);
CREATE INDEX idx_agent_roles_agent_id ON agent_roles(agent_id);

CREATE TABLE work_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE works (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_code               text NOT NULL UNIQUE,
  preferred_title         text NOT NULL,
  original_title          text,
  original_language_id    uuid REFERENCES languages(id),
  first_publication_year  int,
  work_type_id            uuid REFERENCES work_types(id),
  subject_summary         text,
  abstract                text,
  historical_significance text,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_works_updated BEFORE UPDATE ON works
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_works_title_trgm ON works USING gin (preferred_title gin_trgm_ops);

-- Ekstensi opsional: detail halaman penulis untuk marketplace.
-- Terpisah dari agents karena atribut ini hanya relevan untuk peran penulis,
-- bukan untuk peran lain (penerbit, percetakan, pemilik lama, dll).
CREATE TABLE author_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id     uuid NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
  bio_long     text,
  photo_asset_id uuid,
  website_url  text,
  social_links jsonb,
  is_featured  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_author_profiles_updated BEFORE UPDATE ON author_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE work_agents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id     uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL REFERENCES agents(id),
  role        text NOT NULL CHECK (role IN
                ('author','editor','translator','compiler','illustrator','contributor','other')),
  role_note   text,
  sequence_no int,
  UNIQUE (work_id, agent_id, role)
);

CREATE TABLE categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES categories(id),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Cegah siklus hierarki kategori
CREATE OR REPLACE FUNCTION check_category_cycle()
RETURNS trigger AS $$
DECLARE cur uuid; steps int := 0;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  cur := NEW.parent_id;
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'Hierarki kategori tidak boleh membentuk siklus';
    END IF;
    SELECT parent_id INTO cur FROM categories WHERE id = cur;
    steps := steps + 1;
    IF steps > 100 THEN
      RAISE EXCEPTION 'Kedalaman kategori berlebihan (kemungkinan siklus)';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_category_cycle
  BEFORE INSERT OR UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION check_category_cycle();

CREATE TABLE work_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id     uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE (work_id, category_id)
);

CREATE TABLE editions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id               uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  edition_code          text NOT NULL UNIQUE,
  edition_statement     text,
  impression_statement  text,
  issue_statement       text,
  state_statement       text,
  variant_statement     text,
  publication_place_id   uuid REFERENCES places(id),
  publication_country_id uuid REFERENCES places(id),
  publication_year      int,
  copyright_year        int,
  language_id            uuid REFERENCES languages(id),
  volume_label          text,
  series_title          text,
  series_number         text,
  isbn                  text,
  limited_edition       boolean DEFAULT false,
  stated_print_run      int,
  total_pages           int,
  collation_summary     text,
  identification_status text CHECK (identification_status IS NULL OR identification_status IN
                          ('unreviewed','initial','probable','verified','disputed')),
  identification_basis  text,
  preview_free_pages    int CHECK (preview_free_pages IS NULL OR preview_free_pages >= 0),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_editions_updated BEFORE UPDATE ON editions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE edition_agents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id  uuid NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL REFERENCES agents(id),
  role        text NOT NULL CHECK (role IN ('publisher','printer','distributor','binder','other')),
  place_id    uuid REFERENCES places(id),
  sequence_no int,
  UNIQUE (edition_id, agent_id, role)
);

-- =============================================================
-- INVENTARIS: collections, storage_locations, copies
-- =============================================================

CREATE TABLE collections (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        uuid REFERENCES sellers(id),
  name             text NOT NULL,
  code             text NOT NULL UNIQUE,
  description      text,
  default_currency char(3) NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_collections_updated BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE storage_locations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id      uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  parent_location_id uuid REFERENCES storage_locations(id),
  code               text NOT NULL,
  location_type      text CHECK (location_type IS NULL OR location_type IN
                       ('building','room','cabinet','shelf','box','display_case','vault')),
  name               text,
  climate_controlled boolean DEFAULT false,
  secure             boolean DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, code)
);

-- Cegah siklus + pastikan induk berada di koleksi yang sama
CREATE OR REPLACE FUNCTION check_location_parent()
RETURNS trigger AS $$
DECLARE
  cur uuid;
  parent_coll uuid;
  steps int := 0;
BEGIN
  IF NEW.parent_location_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT collection_id INTO parent_coll FROM storage_locations WHERE id = NEW.parent_location_id;
  IF parent_coll IS DISTINCT FROM NEW.collection_id THEN
    RAISE EXCEPTION 'Lokasi induk harus berada pada koleksi yang sama';
  END IF;
  cur := NEW.parent_location_id;
  WHILE cur IS NOT NULL LOOP
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'Struktur lokasi tidak boleh membentuk siklus';
    END IF;
    SELECT parent_location_id INTO cur FROM storage_locations WHERE id = cur;
    steps := steps + 1;
    IF steps > 100 THEN
      RAISE EXCEPTION 'Kedalaman lokasi berlebihan (kemungkinan siklus)';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_location_parent
  BEFORE INSERT OR UPDATE ON storage_locations
  FOR EACH ROW EXECUTE FUNCTION check_location_parent();

CREATE TABLE copies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id       uuid NOT NULL REFERENCES collections(id),
  edition_id          uuid NOT NULL REFERENCES editions(id),
  current_location_id uuid REFERENCES storage_locations(id),
  inventory_code      text NOT NULL,
  accession_number    text,
  barcode_value       text,
  qr_value            text,
  copy_number_statement text,
  copy_status         text NOT NULL CHECK (copy_status IN
                        ('owned','incoming','on_loan','under_restoration','sold','lost','deaccessioned')),
  collection_grade    text CHECK (collection_grade IS NULL OR collection_grade IN
                        ('core','important','supporting','reading','duplicate')),
  completeness_status text CHECK (completeness_status IS NULL OR completeness_status IN
                        ('complete','incomplete','uncertain')),
  is_binding_original boolean,
  binding_description text,
  cover_description   text,
  dust_jacket_present boolean,
  slipcase_present    boolean,
  height_mm    numeric CHECK (height_mm    IS NULL OR height_mm    > 0),
  width_mm     numeric CHECK (width_mm     IS NULL OR width_mm     > 0),
  thickness_mm numeric CHECK (thickness_mm IS NULL OR thickness_mm > 0),
  weight_grams numeric CHECK (weight_grams IS NULL OR weight_grams > 0),
  private_notes text,
  acquired_at   date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, inventory_code)
);
CREATE TRIGGER trg_copies_updated BEFORE UPDATE ON copies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Lokasi eksemplar harus dari koleksi yang sama
CREATE OR REPLACE FUNCTION check_copy_location()
RETURNS trigger AS $$
DECLARE loc_coll uuid;
BEGIN
  IF NEW.current_location_id IS NULL THEN RETURN NEW; END IF;
  SELECT collection_id INTO loc_coll FROM storage_locations WHERE id = NEW.current_location_id;
  IF loc_coll IS DISTINCT FROM NEW.collection_id THEN
    RAISE EXCEPTION 'Lokasi eksemplar harus berasal dari koleksi yang sama';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_copy_location
  BEFORE INSERT OR UPDATE ON copies
  FOR EACH ROW EXECUTE FUNCTION check_copy_location();

-- =============================================================
-- RIWAYAT EKSEMPLAR
-- =============================================================

CREATE TABLE condition_reports (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id                 uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  report_date             date NOT NULL,
  condition_grade         text CHECK (condition_grade IS NULL OR condition_grade IN
                            ('mint','fine','very_good','good','fair','poor')),
  condition_score         numeric CHECK (condition_score IS NULL OR (condition_score >= 0 AND condition_score <= 100)),
  cover_note              text,
  spine_note              text,
  binding_note            text,
  paper_note              text,
  foxing                  boolean,
  mold_present            boolean,
  pest_damage_present     boolean,
  water_damage            boolean,
  tears_note              text,
  markings_note           text,
  active_risk             boolean DEFAULT false,
  handling_recommendation text,
  next_inspection_date    date,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CHECK (next_inspection_date IS NULL OR next_inspection_date > report_date)
);
CREATE INDEX idx_condition_copy_date ON condition_reports (copy_id, report_date DESC);

CREATE TABLE acquisitions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id                  uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  seller_agent_id          uuid REFERENCES agents(id),
  is_primary               boolean NOT NULL DEFAULT true,
  method                   text CHECK (method IS NULL OR method IN
                             ('purchase','auction','gift','inheritance','exchange','transfer','other')),
  sales_channel_id         uuid REFERENCES sales_channels(id),
  transaction_place_id     uuid REFERENCES places(id),
  invoice_number           text,
  transaction_date         date,
  currency                 char(3),
  purchase_price           numeric CHECK (purchase_price           IS NULL OR purchase_price           >= 0),
  shipping_cost            numeric CHECK (shipping_cost            IS NULL OR shipping_cost            >= 0),
  tax_cost                 numeric CHECK (tax_cost                 IS NULL OR tax_cost                 >= 0),
  auction_premium          numeric CHECK (auction_premium          IS NULL OR auction_premium          >= 0),
  restoration_initial_cost numeric CHECK (restoration_initial_cost IS NULL OR restoration_initial_cost >= 0),
  other_cost               numeric CHECK (other_cost               IS NULL OR other_cost               >= 0),
  payment_method_id        uuid REFERENCES payment_methods(id),
  proof_reference          text,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT now()
);
-- Tepat satu akuisisi primary per copy
CREATE UNIQUE INDEX uq_acq_primary ON acquisitions (copy_id) WHERE is_primary;

CREATE TABLE valuations (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id            uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  appraiser_agent_id uuid REFERENCES agents(id),
  valuation_date     date NOT NULL,
  valuation_type     text CHECK (valuation_type IS NULL OR valuation_type IN
                       ('owner_estimate','dealer_estimate','auction_estimate',
                        'insurance_value','expert_appraisal','realized_sale')),
  currency     char(3),
  value_low    numeric CHECK (value_low    IS NULL OR value_low    >= 0),
  value_mid    numeric CHECK (value_mid    IS NULL OR value_mid    >= 0),
  value_high   numeric CHECK (value_high   IS NULL OR value_high   >= 0),
  insured_value numeric CHECK (insured_value IS NULL OR insured_value >= 0),
  market_trend    text CHECK (market_trend    IS NULL OR market_trend    IN ('rising','stable','falling')),
  liquidity_level text CHECK (liquidity_level IS NULL OR liquidity_level IN ('high','medium','low')),
  valuation_basis text,
  comparable_source text,
  valid_until  date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (value_low IS NULL OR value_mid  IS NULL OR value_low <= value_mid),
  CHECK (value_mid IS NULL OR value_high IS NULL OR value_mid <= value_high),
  CHECK (value_low IS NULL OR value_high IS NULL OR value_low <= value_high)
);
CREATE INDEX idx_valuations_copy_date ON valuations (copy_id, valuation_date DESC);

CREATE TABLE provenance_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id             uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  owner_agent_id      uuid REFERENCES agents(id),
  counterparty_agent_id uuid REFERENCES agents(id),
  sequence_no         int NOT NULL,
  event_type          text CHECK (event_type IS NULL OR event_type IN
                        ('created','owned','gifted','inherited','purchased',
                         'sold','auctioned','transferred','unknown')),
  period_text         text,
  period_start_year   int,
  period_end_year     int,
  place_id            uuid REFERENCES places(id),
  evidence_summary    text,
  verification_status text CHECK (verification_status IS NULL OR verification_status IN
                        ('unverified','partially_verified','verified','disputed','rejected')),
  confidence          text CHECK (confidence IS NULL OR confidence IN
                        ('low','medium','high','expert_verified')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (copy_id, sequence_no),
  CHECK (period_start_year IS NULL OR period_end_year IS NULL OR period_start_year <= period_end_year)
);

CREATE TABLE media_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id         uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  media_type      text CHECK (media_type IS NULL OR media_type IN
                    ('cover_front','cover_back','spine','title_page','copyright_page','contents',
                     'last_page','signature','stamp','damage','receipt','certificate','other')),
  file_path       text NOT NULL,
  file_name       text,
  mime_type       text,
  file_size       bigint,
  checksum_sha256 char(64),
  caption         text,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- WISHLIST + PENAWARAN
-- =============================================================

CREATE TABLE wishlists (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id    uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  work_id          uuid REFERENCES works(id),
  target_title     text,
  desired_edition  text,
  desired_impression text,
  target_year      int,
  target_publisher text,
  min_condition    text CHECK (min_condition IS NULL OR min_condition IN
                     ('mint','fine','very_good','good','fair','poor')),
  max_budget       numeric CHECK (max_budget IS NULL OR max_budget >= 0),
  currency         char(3),
  priority         int CHECK (priority IS NULL OR (priority BETWEEN 1 AND 5)),
  status           text CHECK (status IS NULL OR status IN
                     ('active','found','purchased','paused','abandoned')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_wishlists_updated BEFORE UPDATE ON wishlists
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE wishlist_offers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id       uuid NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  seller_agent_id   uuid REFERENCES agents(id),
  source_name       text,
  platform          text CHECK (platform IS NULL OR platform IN
                      ('instagram','tokopedia','shopee','facebook','whatsapp','website','offline','other')),
  listing_url       text,
  price             numeric CHECK (price IS NULL OR price >= 0),
  currency          char(3),
  offered_condition text CHECK (offered_condition IS NULL OR offered_condition IN
                      ('mint','fine','very_good','good','fair','poor')),
  condition_note    text,
  availability      text CHECK (availability IS NULL OR availability IN
                      ('available','reserved','sold','expired','unknown')),
  observed_date     date,
  is_selected       boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_offers_wishlist ON wishlist_offers (wishlist_id, is_selected);

CREATE TABLE wishlist_offer_media (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_offer_id uuid NOT NULL REFERENCES wishlist_offers(id) ON DELETE CASCADE,
  file_path         text NOT NULL,
  file_name         text,
  mime_type         text,
  file_size         bigint,
  checksum_sha256   char(64),
  caption           text,
  deleted_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- PENDUKUNG: fx_rates
-- =============================================================

CREATE TABLE fx_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency  char(3) NOT NULL,
  quote_currency char(3) NOT NULL,
  rate_date      date NOT NULL,
  rate           numeric NOT NULL CHECK (rate > 0),
  source         text,
  UNIQUE (base_currency, quote_currency, rate_date)
);

-- =============================================================
-- MARKETPLACE
-- =============================================================

CREATE TABLE listings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      uuid NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  listing_type   text NOT NULL CHECK (listing_type IN ('physical_copy','reading_access')),
  copy_id        uuid REFERENCES copies(id),
  edition_id     uuid REFERENCES editions(id),
  title_snapshot text,
  price          numeric NOT NULL CHECK (price >= 0),
  currency       char(3) NOT NULL,
  quantity       int NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status         text NOT NULL CHECK (status IN
                   ('draft','active','reserved','sold','withdrawn','expired')),
  published_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (listing_type <> 'physical_copy'  OR copy_id    IS NOT NULL),
  CHECK (listing_type <> 'reading_access' OR edition_id IS NOT NULL)
);
CREATE TRIGGER trg_listings_updated BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Satu listing aktif per copy fisik
CREATE UNIQUE INDEX uq_listing_active_copy ON listings (copy_id)
  WHERE listing_type = 'physical_copy' AND status = 'active';

CREATE TABLE orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id  uuid NOT NULL REFERENCES users(id),
  seller_id      uuid NOT NULL REFERENCES sellers(id),
  order_code     text NOT NULL UNIQUE,
  status         text NOT NULL CHECK (status IN
                   ('pending','paid','fulfilled','completed','cancelled','refunded')),
  currency       char(3) NOT NULL,
  items_subtotal numeric CHECK (items_subtotal IS NULL OR items_subtotal >= 0),
  shipping_total numeric CHECK (shipping_total IS NULL OR shipping_total >= 0),
  platform_fee   numeric CHECK (platform_fee   IS NULL OR platform_fee   >= 0),
  grand_total    numeric CHECK (grand_total    IS NULL OR grand_total    >= 0),
  placed_at      timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz
);

CREATE TABLE order_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id     uuid REFERENCES listings(id),
  item_type      text NOT NULL CHECK (item_type IN ('physical_copy','reading_access')),
  copy_id        uuid REFERENCES copies(id),
  edition_id     uuid REFERENCES editions(id),
  title_snapshot text,
  unit_price     numeric NOT NULL CHECK (unit_price >= 0),
  quantity       int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  line_total     numeric CHECK (line_total IS NULL OR line_total >= 0)
);
CREATE INDEX idx_order_items_order ON order_items (order_id);

CREATE TABLE disposals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id       uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES order_items(id),
  buyer_agent_id uuid REFERENCES agents(id),
  method        text CHECK (method IS NULL OR method IN
                  ('sale','auction','gift','donation','transfer','lost','other')),
  sales_channel_id uuid REFERENCES sales_channels(id),
  disposal_date date,
  currency      char(3),
  asking_price  numeric CHECK (asking_price  IS NULL OR asking_price  >= 0),
  sale_price    numeric CHECK (sale_price    IS NULL OR sale_price    >= 0),
  platform_fee  numeric CHECK (platform_fee  IS NULL OR platform_fee  >= 0),
  shipping_cost numeric CHECK (shipping_cost IS NULL OR shipping_cost >= 0),
  tax_cost      numeric CHECK (tax_cost      IS NULL OR tax_cost      >= 0),
  other_cost    numeric CHECK (other_cost    IS NULL OR other_cost    >= 0),
  proof_reference text,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method_id  uuid REFERENCES payment_methods(id),
  provider_reference text,
  amount             numeric NOT NULL CHECK (amount >= 0),
  currency           char(3) NOT NULL,
  status             text NOT NULL CHECK (status IN
                       ('pending','authorized','paid','failed','refunded')),
  paid_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_order ON payments (order_id);

CREATE TABLE shipments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier_id      uuid REFERENCES shipping_carriers(id),
  tracking_number text,
  status          text NOT NULL CHECK (status IN
                    ('pending','shipped','in_transit','delivered','returned')),
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid NOT NULL REFERENCES sellers(id),
  order_id     uuid REFERENCES orders(id),
  gross_amount numeric CHECK (gross_amount IS NULL OR gross_amount >= 0),
  platform_fee numeric CHECK (platform_fee IS NULL OR platform_fee >= 0),
  net_amount   numeric CHECK (net_amount   IS NULL OR net_amount   >= 0),
  currency     char(3) NOT NULL,
  status       text NOT NULL CHECK (status IN ('pending','processing','paid','failed')),
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reading_entitlements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES editions(id),
  source     text NOT NULL CHECK (source IN ('purchase','subscription','preview','grant')),
  order_id   uuid REFERENCES orders(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX idx_entitlement_user_edition ON reading_entitlements (user_id, edition_id);

-- =============================================================
-- AUDIT
-- =============================================================

CREATE TABLE audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES users(id),
  action       text NOT NULL CHECK (action IN ('create','update','delete','restore')),
  entity_table text NOT NULL,
  entity_id    uuid NOT NULL,
  changes_json jsonb,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs (entity_table, entity_id);

-- =============================================================
-- MODUL READER
-- =============================================================

CREATE TABLE book_pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  copy_id           uuid NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  edition_id        uuid NOT NULL REFERENCES editions(id),
  image_asset_id    uuid REFERENCES media_assets(id),
  page_label        text,
  page_sequence     int NOT NULL,
  source_script     text CHECK (source_script IS NULL OR source_script IN
                      ('latin','javanese','jawi','other')),
  source_language_id uuid REFERENCES languages(id),
  ocr_text          text,
  ocr_confidence    numeric CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
  ocr_engine        text,
  text_corrected    text,
  text_en           text,
  translation_model text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (copy_id, page_sequence)
);

CREATE TABLE book_chapters (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id          uuid NOT NULL REFERENCES editions(id) ON DELETE CASCADE,
  chapter_no          int,
  title               text,
  page_start_sequence int,
  page_end_sequence   int,
  summary_en          text,
  summary_model       text,
  summary_prompt_version text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (page_start_sequence IS NULL OR page_end_sequence IS NULL
         OR page_end_sequence >= page_start_sequence)
);

CREATE TABLE ai_analyses (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type         text NOT NULL CHECK (scope_type IN ('page','chapter','edition','work')),
  scope_id           uuid NOT NULL,
  analysis_type      text NOT NULL CHECK (analysis_type IN
                       ('summary','translation','entities','themes','toc_extract','other')),
  model              text NOT NULL,
  prompt_version     text,
  result_json        jsonb,
  input_token_count  int,
  output_token_count int,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_scope ON ai_analyses (scope_type, scope_id, analysis_type);

CREATE TABLE book_entity_mentions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_page_id    uuid NOT NULL REFERENCES book_pages(id) ON DELETE CASCADE,
  edition_id      uuid NOT NULL REFERENCES editions(id),
  entity_type     text NOT NULL CHECK (entity_type IN
                    ('person','place','organization','date','work_title','other')),
  surface_text    text NOT NULL,
  normalized_text text,
  char_start      int,
  char_end        int,
  confidence      numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  extraction_model text,
  linked_agent_id uuid REFERENCES agents(id),
  linked_place_id uuid REFERENCES places(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mentions_edition_type ON book_entity_mentions (edition_id, entity_type);
CREATE INDEX idx_mentions_normalized_trgm ON book_entity_mentions USING gin (normalized_text gin_trgm_ops);

COMMIT;

-- =============================================================
-- CONTOH ROW-LEVEL SECURITY (aktifkan sesuai kebutuhan aplikasi)
-- Aplikasi menetapkan konteks: SET app.current_user_id = '<uuid>';
-- -------------------------------------------------------------
-- Contoh: batasi collections hanya untuk anggota toko pemiliknya.
--
-- ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY collections_member_access ON collections
--   USING (
--     seller_id IS NULL
--     OR EXISTS (
--       SELECT 1 FROM seller_members sm
--       WHERE sm.seller_id = collections.seller_id
--         AND sm.user_id = current_setting('app.current_user_id', true)::uuid
--     )
--   );
--
-- Pola serupa diterapkan pada copies, valuations, acquisitions, dsb.
-- Katalog publik (works/editions) umumnya tetap dapat dibaca semua.
-- =============================================================
