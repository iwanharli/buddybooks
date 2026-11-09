-- =============================================================
-- Seed data untuk db_buddybooks
-- Jalankan SETELAH schema.sql.
-- Idempoten: memakai ON CONFLICT DO NOTHING pada kolom unik.
--
-- GANTI placeholder berikut sesuai kebutuhan:
--   admin email : admin@buddybooks.local
--   nama toko   : Buddybooks   (slug: buddybooks)
--   koleksi     : IND-HIS / Koleksi Sejarah Indonesia
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- 1. Bootstrap: admin, peran, toko, keanggotaan, koleksi
-- -------------------------------------------------------------
INSERT INTO users (id, email, display_name, is_active)
VALUES ('00000000-0000-0000-0000-000000000001',
        'admin@buddybooks.local', 'Administrator', true)
ON CONFLICT (email) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin'),
       ('00000000-0000-0000-0000-000000000001', 'seller'),
       ('00000000-0000-0000-0000-000000000001', 'buyer')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO sellers (id, owner_user_id, shop_name, shop_slug, is_active)
VALUES ('00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001', 'Buddybooks', 'buddybooks', true)
ON CONFLICT (shop_slug) DO NOTHING;

INSERT INTO seller_members (seller_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000001', 'owner')
ON CONFLICT (seller_id, user_id) DO NOTHING;

INSERT INTO collections (id, seller_id, name, code, default_currency)
VALUES ('00000000-0000-0000-0000-000000000020',
        '00000000-0000-0000-0000-000000000010',
        'Koleksi Sejarah Indonesia', 'IND-HIS', 'IDR')
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------
-- 2. Referensi: kurs mata uang (isi/update nilai sesuai tanggal)
-- -------------------------------------------------------------
-- Nilai placeholder; perbarui dengan kurs nyata sebelum produksi.
INSERT INTO fx_rates (base_currency, quote_currency, rate_date, rate, source) VALUES
  ('IDR','IDR', CURRENT_DATE, 1,     'identity'),
  ('USD','IDR', CURRENT_DATE, 16200, 'seed-placeholder'),
  ('EUR','IDR', CURRENT_DATE, 17500, 'seed-placeholder'),
  ('GBP','IDR', CURRENT_DATE, 20500, 'seed-placeholder'),
  ('SGD','IDR', CURRENT_DATE, 12000, 'seed-placeholder'),
  ('AUD','IDR', CURRENT_DATE, 10600, 'seed-placeholder'),
  ('JPY','IDR', CURRENT_DATE, 105,   'seed-placeholder'),
  ('CNY','IDR', CURRENT_DATE, 2250,  'seed-placeholder'),
  ('MYR','IDR', CURRENT_DATE, 3600,  'seed-placeholder')
ON CONFLICT (base_currency, quote_currency, rate_date) DO NOTHING;

-- -------------------------------------------------------------
-- 2b. Master bahasa (ISO 639)
-- -------------------------------------------------------------
INSERT INTO languages (code, name, native_name) VALUES
  -- Nusantara / daerah
  ('id',  'Indonesia',           'Bahasa Indonesia'),
  ('ms',  'Melayu',              'Bahasa Melayu'),
  ('jv',  'Jawa',                'Basa Jawa'),
  ('kaw', 'Jawa Kuno (Kawi)',    'Basa Kawi'),
  ('su',  'Sunda',               'Basa Sunda'),
  ('ban', 'Bali',                'Basa Bali'),
  ('mad', 'Madura',              'Bhâsa Madhurâ'),
  ('min', 'Minangkabau',         'Baso Minangkabau'),
  ('bbc', 'Batak Toba',          'Hata Batak'),
  ('bug', 'Bugis',               'Basa Ugi'),
  ('mak', 'Makassar',            'Basa Mangkasara'),
  ('ace', 'Aceh',                'Bahsa Acèh'),
  ('bjn', 'Banjar',              'Bahasa Banjar'),
  ('sas', 'Sasak',               'Base Sasak'),
  ('ljp', 'Lampung',             'Bahasa Lampung'),
  ('bew', 'Betawi',              'Bahasa Betawi'),
  ('gor', 'Gorontalo',           'Bahasa Hulontalo'),
  ('nij', 'Dayak Ngaju',         'Bahasa Ngaju'),
  -- Eropa
  ('nl',  'Belanda',             'Nederlands'),
  ('en',  'Inggris',             'English'),
  ('de',  'Jerman',              'Deutsch'),
  ('fr',  'Prancis',             'Français'),
  ('pt',  'Portugis',            'Português'),
  ('es',  'Spanyol',             'Español'),
  ('la',  'Latin',               'Latina'),
  -- Timur Tengah / Asia
  ('ar',  'Arab',                'العربية'),
  ('fa',  'Persia',              'فارسی'),
  ('ur',  'Urdu',                'اردو'),
  ('sa',  'Sanskerta',           'संस्कृतम्'),
  ('ta',  'Tamil',               'தமிழ்'),
  ('zh',  'Tionghoa',            '中文'),
  ('ja',  'Jepang',              '日本語')
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------
-- 2c. Master kurir, metode bayar, kanal transaksi
-- -------------------------------------------------------------
INSERT INTO shipping_carriers (code, name) VALUES
  ('jne','JNE'), ('pos','Pos Indonesia'), ('tiki','TIKI'),
  ('sicepat','SiCepat'), ('jnt','J&T Express'), ('anteraja','AnterAja'),
  ('lion_parcel','Lion Parcel'), ('ninja','Ninja Xpress'),
  ('wahana','Wahana'), ('rpx','RPX'), ('sap','SAP Express'),
  ('gosend','GoSend'), ('grab','GrabExpress'),
  ('dhl','DHL'), ('fedex','FedEx'), ('ems','EMS (Pos Internasional)'),
  ('other','Lainnya')
ON CONFLICT (code) DO NOTHING;

INSERT INTO payment_methods (code, name) VALUES
  ('bank_transfer','Transfer Bank'), ('virtual_account','Virtual Account'),
  ('qris','QRIS'), ('ewallet','E-Wallet'), ('credit_card','Kartu Kredit'),
  ('debit_card','Kartu Debit'), ('cash','Tunai'),
  ('cod','Bayar di Tempat (COD)'), ('paypal','PayPal'), ('other','Lainnya')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sales_channels (code, name) VALUES
  ('marketplace','Marketplace (umum)'),
  ('tokopedia','Tokopedia'), ('shopee','Shopee'),
  ('bukalapak','Bukalapak'), ('lazada','Lazada'), ('tiktok_shop','TikTok Shop'),
  ('ebay','eBay'), ('abebooks','AbeBooks'), ('catawiki','Catawiki'),
  ('instagram','Instagram'), ('facebook','Facebook'), ('whatsapp','WhatsApp'),
  ('auction_house','Rumah Lelang'), ('bookstore','Toko Buku'),
  ('bazaar','Bazar/Pameran'), ('direct','Langsung/Perorangan'),
  ('other','Lainnya')
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------
-- 2d. Master agents: penerbit & percetakan (organisasi)
-- Idempoten via NOT EXISTS pada authorized_name (agents tak punya unik).
-- Riset: era kolonial/Sino-Melayu (hingga ~1960-an) + penerbit modern Indonesia.
-- -------------------------------------------------------------
INSERT INTO agents (agent_type, authorized_name, alternate_names, birth_or_founding_year)
SELECT v.agent_type, v.authorized_name, v.alternate_names, v.founding
FROM (VALUES
  -- === Era kolonial / negara & misi (Hindia Belanda) ===
  ('organization','Balai Pustaka','Balai Poestaka; Commissie voor de Inlandsche School en Volkslectuur', 1908),
  ('organization','Landsdrukkerij','Government Printing Office; Reproductiebedrijf, dibentuk era Daendels', 1809),
  ('organization','G. Kolff & Co','Kolff; G. Kolff en Co', 1848),
  ('organization','Noordhoff-Kolff','N.V. Noordhoff-Kolff', NULL),
  ('organization','G.C.T. van Dorp & Co','Van Dorp; van Dorp en Co', 1856),
  ('organization','Albrecht & Co','Albrecht en Rusche', NULL),
  ('organization','A.C. Nix & Co','Nix; Drukkerij Nix Bandoeng', NULL),
  ('organization','Visser & Co','N.V. Visser', NULL),
  ('organization','Java-Bode','Drukkerij Java-Bode', NULL),
  ('organization','W. van Hoeve','N.V. Uitgeverij W. van Hoeve', NULL),
  ('organization','Martinus Nijhoff','Nijhoff; s-Gravenhage', 1853),
  ('organization','E.J. Brill','Brill; Koninklijke Brill Leiden', 1683),
  ('organization','J.B. Wolters','Wolters; Wolters-Noordhoff', 1836),
  ('organization','P. Noordhoff','Noordhoff Groningen', 1858),
  ('organization','Kanisius','Percetakan dan Penerbitan Kanisius', 1922),
  -- === Sino-Melayu / Tionghoa Peranakan (penerbit & percetakan sastra Melayu Rendah) ===
  ('organization','Kho Bie & Co','Kho Bie en Co Batavia', 1833),
  ('organization','Tjoei Toei Yang','Drukkerij Tjoei Toei Yang', NULL),
  ('organization','Sie Dhian Ho','Drukkerij Sie Dhian Ho Solo', NULL),
  ('organization','Tan Khoen Swie','Boekhandel Tan Khoen Swie Kediri', 1915),
  ('organization','Hoa Siang In Kiok','Drukkerij Hoa Siang In Kiok Batavia', NULL),
  ('organization','Sin Bin','Drukkerij Sin Bin', NULL),
  ('organization','Panorama','Drukkerij Panorama Kwee Tek Hoay', NULL),
  ('organization','Moestika','Drukkerij Moestika Batavia', NULL),
  -- === Pribumi / pergerakan nasional ===
  ('organization','Pujangga Baru','Penerbit majalah dan buku Pujangga Baru', 1933),
  ('organization','Poestaka Rakjat','Pustaka Rakyat', NULL),
  ('organization','Pembangunan','N.V. Pembangunan', NULL),
  ('organization','Bulan Bintang','Penerbit Bulan Bintang', 1937),
  ('organization','Ganaco','N.V. Ganaco Bandung', NULL),
  ('organization','Sinar Deli','Drukkerij Sinar Deli Medan', NULL),
  -- === Penerbit modern besar (nasional, masih aktif) ===
  ('organization','Gramedia Pustaka Utama','Gramedia; PT Gramedia Pustaka Utama', 1974),
  ('organization','Kompas Gramedia','Kelompok Kompas Gramedia; KG', 1963),
  ('organization','Kepustakaan Populer Gramedia','KPG', 1996),
  ('organization','Elex Media Komputindo','Elex Media; PT Elex Media Komputindo', 1985),
  ('organization','Grasindo','PT Gramedia Widiasarana Indonesia', 1990),
  ('organization','Erlangga','PT Penerbit Erlangga', 1952),
  ('organization','Mizan Pustaka','Mizan; PT Mizan Pustaka', 1982),
  ('organization','Bentang Pustaka','PT Bentang Pustaka', 1999),
  ('organization','Gagas Media','PT Gagas Media', 2003),
  ('organization','Republika Penerbit','Penerbit Republika', 1997),
  ('organization','Gunung Agung','Toko Buku Gunung Agung', 1953),
  ('organization','Djambatan','Penerbit Djambatan', 1951),
  ('organization','Yayasan Obor Indonesia','Obor', 1978),
  ('organization','LKiS','Lembaga Kajian Islam dan Sosial', 1993),
  ('organization','Tiga Serangkai','PT Tiga Serangkai Pustaka Mandiri', 1958),
  ('organization','Yudhistira','PT Yudhistira Ghalia Indonesia', NULL),
  ('organization','Grafindo Media Pratama','Grafindo', NULL),
  ('organization','Ar-Ruzz Media','Ar-Ruzz', NULL)
) AS v(agent_type, authorized_name, alternate_names, founding)
WHERE NOT EXISTS (
  SELECT 1 FROM agents a WHERE a.authorized_name = v.authorized_name
);

WITH seed_publishing_agents(authorized_name) AS (
  VALUES
    ('Balai Pustaka'), ('Landsdrukkerij'), ('G. Kolff & Co'), ('Noordhoff-Kolff'),
    ('G.C.T. van Dorp & Co'), ('Albrecht & Co'), ('A.C. Nix & Co'), ('Visser & Co'),
    ('Java-Bode'), ('W. van Hoeve'), ('Martinus Nijhoff'), ('E.J. Brill'),
    ('J.B. Wolters'), ('P. Noordhoff'), ('Kanisius'), ('Kho Bie & Co'),
    ('Tjoei Toei Yang'), ('Sie Dhian Ho'), ('Tan Khoen Swie'), ('Hoa Siang In Kiok'),
    ('Sin Bin'), ('Panorama'), ('Moestika'), ('Pujangga Baru'), ('Poestaka Rakjat'),
    ('Pembangunan'), ('Bulan Bintang'), ('Ganaco'), ('Sinar Deli'),
    ('Gramedia Pustaka Utama'), ('Kompas Gramedia'), ('Kepustakaan Populer Gramedia'),
    ('Elex Media Komputindo'), ('Grasindo'), ('Erlangga'), ('Mizan Pustaka'),
    ('Bentang Pustaka'), ('Gagas Media'), ('Republika Penerbit'), ('Gunung Agung'),
    ('Djambatan'), ('Yayasan Obor Indonesia'), ('LKiS'), ('Tiga Serangkai'),
    ('Yudhistira'), ('Grafindo Media Pratama'), ('Ar-Ruzz Media')
)
UPDATE agents a
SET
  brand_name = COALESCE(a.brand_name, a.authorized_name),
  publisher_category = COALESCE(a.publisher_category, CASE
    WHEN a.authorized_name IN ('Balai Pustaka', 'Landsdrukkerij') THEN 'government_publisher'
    WHEN a.authorized_name IN ('Gramedia Pustaka Utama', 'Kompas Gramedia', 'Kepustakaan Populer Gramedia', 'Elex Media Komputindo', 'Grasindo', 'Republika Penerbit') THEN 'media_group_publisher'
    WHEN a.authorized_name IN ('Kanisius', 'Mizan Pustaka', 'LKiS', 'Ar-Ruzz Media') THEN 'religious_publisher'
    WHEN a.authorized_name IN ('A.C. Nix & Co', 'Albrecht & Co', 'E.J. Brill', 'G. Kolff & Co', 'G.C.T. van Dorp & Co', 'Hoa Siang In Kiok', 'J.B. Wolters', 'Java-Bode', 'Kho Bie & Co', 'Martinus Nijhoff', 'Moestika', 'Noordhoff-Kolff', 'P. Noordhoff', 'Poestaka Rakjat', 'Pujangga Baru', 'Tan Khoen Swie') THEN 'historical_publisher'
    ELSE 'trade_publisher'
  END),
  status = CASE
    WHEN a.authorized_name IN ('A.C. Nix & Co', 'Albrecht & Co', 'G. Kolff & Co', 'G.C.T. van Dorp & Co', 'Hoa Siang In Kiok', 'J.B. Wolters', 'Java-Bode', 'Kho Bie & Co', 'Landsdrukkerij', 'Moestika', 'Noordhoff-Kolff', 'P. Noordhoff', 'Poestaka Rakjat', 'Pujangga Baru', 'Tan Khoen Swie') THEN 'closed'
    WHEN a.authorized_name IN ('Balai Pustaka', 'Kanisius', 'Gramedia Pustaka Utama', 'Kompas Gramedia', 'Kepustakaan Populer Gramedia', 'Elex Media Komputindo', 'Grasindo', 'Erlangga', 'Mizan Pustaka', 'Bentang Pustaka', 'Gagas Media', 'Republika Penerbit', 'Yayasan Obor Indonesia', 'LKiS', 'Tiga Serangkai', 'Yudhistira', 'Grafindo Media Pratama', 'Ar-Ruzz Media') THEN 'active'
    ELSE 'unknown'
  END,
  source_note = COALESCE(a.source_note, 'Seed awal penerbit/percetakan untuk katalog buku Indonesia.'),
  confidence_level = COALESCE(a.confidence_level, 'medium')
FROM seed_publishing_agents s
WHERE a.authorized_name = s.authorized_name;

WITH seed_publishing_agents(authorized_name) AS (
  VALUES
    ('Balai Pustaka'), ('Landsdrukkerij'), ('G. Kolff & Co'), ('Noordhoff-Kolff'),
    ('G.C.T. van Dorp & Co'), ('Albrecht & Co'), ('A.C. Nix & Co'), ('Visser & Co'),
    ('Java-Bode'), ('W. van Hoeve'), ('Martinus Nijhoff'), ('E.J. Brill'),
    ('J.B. Wolters'), ('P. Noordhoff'), ('Kanisius'), ('Kho Bie & Co'),
    ('Tjoei Toei Yang'), ('Sie Dhian Ho'), ('Tan Khoen Swie'), ('Hoa Siang In Kiok'),
    ('Sin Bin'), ('Panorama'), ('Moestika'), ('Pujangga Baru'), ('Poestaka Rakjat'),
    ('Pembangunan'), ('Bulan Bintang'), ('Ganaco'), ('Sinar Deli'),
    ('Gramedia Pustaka Utama'), ('Kompas Gramedia'), ('Kepustakaan Populer Gramedia'),
    ('Elex Media Komputindo'), ('Grasindo'), ('Erlangga'), ('Mizan Pustaka'),
    ('Bentang Pustaka'), ('Gagas Media'), ('Republika Penerbit'), ('Gunung Agung'),
    ('Djambatan'), ('Yayasan Obor Indonesia'), ('LKiS'), ('Tiga Serangkai'),
    ('Yudhistira'), ('Grafindo Media Pratama'), ('Ar-Ruzz Media')
)
INSERT INTO agent_roles (agent_id, role, source_note)
SELECT a.id, 'publisher', 'Seed awal: organisasi penerbit/percetakan.'
FROM agents a
JOIN seed_publishing_agents s ON s.authorized_name = a.authorized_name
ON CONFLICT (agent_id, role) DO NOTHING;

WITH seed_printing_agents(authorized_name) AS (
  VALUES
    ('Landsdrukkerij'), ('G. Kolff & Co'), ('G.C.T. van Dorp & Co'),
    ('A.C. Nix & Co'), ('Java-Bode'), ('Kanisius'), ('Tjoei Toei Yang'),
    ('Sie Dhian Ho'), ('Hoa Siang In Kiok'), ('Sin Bin'), ('Panorama'),
    ('Moestika'), ('Sinar Deli')
)
INSERT INTO agent_roles (agent_id, role, source_note)
SELECT a.id, 'printer', 'Seed awal: organisasi juga dikenal sebagai percetakan.'
FROM agents a
JOIN seed_printing_agents s ON s.authorized_name = a.authorized_name
ON CONFLICT (agent_id, role) DO NOTHING;

-- -------------------------------------------------------------
-- 3. Referensi: tempat umum (gazetteer awal)
-- -------------------------------------------------------------
-- Negara
INSERT INTO places (preferred_name, alternate_names, place_type, country) VALUES
  ('Indonesia', 'Hindia Belanda; Dutch East Indies; Nederlandsch-Indie', 'country', 'Indonesia')
ON CONFLICT (preferred_name, place_type) DO NOTHING;

-- Kota Indonesia (dengan ejaan lama / nama kolonial)
INSERT INTO places (preferred_name, alternate_names, place_type, country) VALUES
  ('Jakarta',      'Batavia; Betawi; Djakarta',        'city', 'Indonesia'),
  ('Surabaya',     'Soerabaja; Soerabaia',             'city', 'Indonesia'),
  ('Bandung',      'Bandoeng',                         'city', 'Indonesia'),
  ('Yogyakarta',   'Jogja; Djokjakarta; Ngayogyakarta','city', 'Indonesia'),
  ('Surakarta',    'Solo; Soerakarta',                 'city', 'Indonesia'),
  ('Semarang',     'Samarang',                         'city', 'Indonesia'),
  ('Medan',        NULL,                               'city', 'Indonesia'),
  ('Bogor',        'Buitenzorg',                       'city', 'Indonesia'),
  ('Cirebon',      'Cheribon',                         'city', 'Indonesia'),
  ('Malang',       NULL,                               'city', 'Indonesia'),
  ('Padang',       NULL,                               'city', 'Indonesia'),
  ('Palembang',    NULL,                               'city', 'Indonesia'),
  ('Makassar',     'Makassar; Ujung Pandang; Macassar','city', 'Indonesia'),
  ('Banda Aceh',   'Kutaraja; Koetaradja',             'city', 'Indonesia'),
  ('Manado',       'Menado',                           'city', 'Indonesia'),
  ('Ambon',        'Amboina',                          'city', 'Indonesia'),
  ('Denpasar',     NULL,                               'city', 'Indonesia'),
  ('Pontianak',    NULL,                               'city', 'Indonesia'),
  ('Banjarmasin',  'Bandjarmasin',                     'city', 'Indonesia'),
  ('Kupang',       NULL,                               'city', 'Indonesia')
ON CONFLICT (preferred_name, place_type) DO NOTHING;

-- Kota/kawasan tambahan yang sering muncul sebagai kantor penerbit
INSERT INTO places (preferred_name, alternate_names, place_type, country) VALUES
  ('Jakarta Pusat',   'Central Jakarta',       'city',   'Indonesia'),
  ('Jakarta Selatan', 'South Jakarta',         'city',   'Indonesia'),
  ('Jakarta Timur',   'East Jakarta',          'city',   'Indonesia'),
  ('Bantul',          NULL,                    'city',   'Indonesia'),
  ('Banyumas',        NULL,                    'city',   'Indonesia'),
  ('Ende',            NULL,                    'city',   'Indonesia'),
  ('Kebumen',         NULL,                    'city',   'Indonesia'),
  ('Pontianak Kota',  NULL,                    'city',   'Indonesia'),
  ('Sidoarjo',        NULL,                    'city',   'Indonesia'),
  ('Slawi',           NULL,                    'city',   'Indonesia'),
  ('Sumenep',         NULL,                    'city',   'Indonesia'),
  ('Tasikmalaya',     NULL,                    'city',   'Indonesia'),
  ('Ubud',            NULL,                    'city',   'Indonesia'),
  ('Karet',           'Karet, Jakarta',        'region', 'Indonesia'),
  ('Palmerah',        'Palmerah, Jakarta',     'region', 'Indonesia')
ON CONFLICT (preferred_name, place_type) DO NOTHING;

-- Pulau / wilayah
INSERT INTO places (preferred_name, alternate_names, place_type, country) VALUES
  ('Jawa',         'Java',                'region', 'Indonesia'),
  ('Sumatra',      'Sumatera; Sumatra',   'region', 'Indonesia'),
  ('Kalimantan',   'Borneo',              'region', 'Indonesia'),
  ('Sulawesi',     'Celebes',             'region', 'Indonesia'),
  ('Bali',         NULL,                  'region', 'Indonesia'),
  ('Maluku',       'Moluccas; Molukken',  'region', 'Indonesia'),
  ('Papua',        'Nieuw-Guinea; Irian', 'region', 'Indonesia'),
  ('Nusa Tenggara','Sunda Kecil',         'region', 'Indonesia')
ON CONFLICT (preferred_name, place_type) DO NOTHING;

-- Kota luar negeri (pusat penerbitan terkait)
INSERT INTO places (preferred_name, alternate_names, place_type, country) VALUES
  ('Amsterdam',    NULL,                        'city', 'Belanda'),
  ('Den Haag',     'The Hague; s-Gravenhage',   'city', 'Belanda'),
  ('Leiden',       'Leyden',                    'city', 'Belanda'),
  ('Rotterdam',    NULL,                        'city', 'Belanda'),
  ('Utrecht',      NULL,                        'city', 'Belanda'),
  ('London',       'Londen',                    'city', 'Inggris'),
  ('Singapura',    'Singapore',                 'city', 'Singapura'),
  ('Kuala Lumpur', NULL,                        'city', 'Malaysia'),
  ('Kairo',        'Cairo; Al-Qahirah',         'city', 'Mesir'),
  ('Makkah',       'Mecca; Mekah',              'city', 'Arab Saudi')
ON CONFLICT (preferred_name, place_type) DO NOTHING;

-- Kota Indonesia tambahan
INSERT INTO places (preferred_name, alternate_names, place_type, country) VALUES
  ('Pekalongan',  NULL,                 'city', 'Indonesia'),
  ('Tegal',       NULL,                 'city', 'Indonesia'),
  ('Magelang',    NULL,                 'city', 'Indonesia'),
  ('Kediri',      'Kediri',             'city', 'Indonesia'),
  ('Madiun',      'Madioen',            'city', 'Indonesia'),
  ('Salatiga',    NULL,                 'city', 'Indonesia'),
  ('Ternate',     NULL,                 'city', 'Indonesia'),
  ('Banda Neira', 'Banda',              'city', 'Indonesia'),
  ('Singaraja',   'Singaradja',         'city', 'Indonesia'),
  ('Ende',        NULL,                 'city', 'Indonesia'),
  ('Weltevreden', 'Batavia (Weltevreden)','city', 'Indonesia')
ON CONFLICT (preferred_name, place_type) DO NOTHING;

-- Pusat penerbitan Eropa tambahan
INSERT INTO places (preferred_name, alternate_names, place_type, country) VALUES
  ('Groningen',   NULL,                 'city', 'Belanda'),
  ('Leipzig',     NULL,                 'city', 'Jerman'),
  ('Paris',       'Parijs; Parys',      'city', 'Prancis'),
  ('Brussel',     'Brussels; Bruxelles','city', 'Belgia'),
  ('Lisbon',      'Lisboa',             'city', 'Portugal')
ON CONFLICT (preferred_name, place_type) DO NOTHING;

-- Negara
INSERT INTO places (preferred_name, alternate_names, place_type, country) VALUES
  ('Indonesia',   'Hindia Belanda; Nederlandsch-Indie; Dutch East Indies', 'country', NULL),
  ('Belanda',     'Netherlands; Nederland; Holland', 'country', NULL),
  ('Inggris',     'England; United Kingdom; Britania','country', NULL),
  ('Jerman',      'Germany; Deutschland',            'country', NULL),
  ('Prancis',     'France; Frankrijk',               'country', NULL),
  ('Belgia',      'Belgium; Belgie',                 'country', NULL),
  ('Portugal',    'Portugal',                        'country', NULL),
  ('Singapura',   'Singapore',                       'country', NULL),
  ('Malaysia',    'Malaya; Persekutuan Tanah Melayu','country', NULL),
  ('Mesir',       'Egypt; Misr',                     'country', NULL),
  ('Arab Saudi',  'Saudi Arabia; Hijaz',             'country', NULL),
  ('Tiongkok',    'China; Tjina; Tionghoa',          'country', NULL),
  ('Jepang',      'Japan; Nippon',                   'country', NULL),
  ('India',       'Hindustan',                       'country', NULL)
ON CONFLICT (preferred_name, place_type) DO NOTHING;

-- -------------------------------------------------------------
-- 3b. Master jenis/bentuk benda (work_types)
-- -------------------------------------------------------------
INSERT INTO work_types (code, name) VALUES
  ('book',                 'Buku'),
  ('monograph',            'Monograf'),
  ('pamphlet',             'Pamflet / Brosur'),
  ('periodical',           'Majalah / Berkala'),
  ('newspaper',            'Surat Kabar'),
  ('manuscript',           'Manuskrip / Naskah'),
  ('atlas',                'Atlas'),
  ('map',                  'Peta'),
  ('catalogue',            'Katalog'),
  ('report',               'Laporan'),
  ('government_publication','Terbitan Resmi Pemerintah'),
  ('letter',               'Surat / Dokumen'),
  ('loose_sheet',          'Kertas / Lembaran Lepas'),
  ('photograph',           'Foto'),
  ('poster',               'Poster'),
  ('postcard',             'Kartu Pos'),
  ('print',                'Cetak / Litografi'),
  ('other',                'Lainnya')
ON CONFLICT (code) DO NOTHING;

-- -------------------------------------------------------------
-- 4. Master kategori/subjek (hierarkis)
-- -------------------------------------------------------------
-- 4a. Kategori tingkat atas (subjek)
INSERT INTO categories (name, slug) VALUES
  ('Sejarah',                        'sejarah'),
  ('Politik dan Pemerintahan',       'politik'),
  ('Agama',                          'agama'),
  ('Sastra',                         'sastra'),
  ('Bahasa dan Linguistik',          'bahasa'),
  ('Filsafat',                       'filsafat'),
  ('Hukum',                          'hukum'),
  ('Ekonomi',                        'ekonomi'),
  ('Sains dan Teknologi',            'sains'),
  ('Pendidikan',                     'pendidikan'),
  ('Biografi dan Memoar',            'biografi'),
  ('Seni dan Budaya',                'seni'),
  ('Geografi dan Peta',              'geografi-peta'),
  ('Antropologi dan Sosiologi',      'antropologi-sosiologi'),
  ('Militer dan Perang',             'militer'),
  ('Referensi dan Ensiklopedia',     'referensi'),
  ('Perjalanan dan Ekspedisi',       'perjalanan'),
  ('Terbitan Resmi Pemerintah',      'terbitan-resmi')
ON CONFLICT (slug) DO NOTHING;

-- 4b. Subkategori (parent dirujuk lewat slug, idempoten)
INSERT INTO categories (parent_id, name, slug)
SELECT p.id, v.name, v.slug
FROM categories p
JOIN (VALUES
  -- Sejarah
  ('sejarah','Sejarah Indonesia',            'sejarah-indonesia'),
  ('sejarah','Sejarah Kolonial / Hindia Belanda','sejarah-kolonial'),
  ('sejarah','Kemerdekaan dan Revolusi',     'sejarah-kemerdekaan'),
  ('sejarah','Sejarah Dunia',                'sejarah-dunia'),
  ('sejarah','Sejarah Lokal dan Daerah',     'sejarah-lokal'),
  -- Politik
  ('politik','Nasionalisme',                 'politik-nasionalisme'),
  ('politik','Ideologi dan Pergerakan',      'politik-ideologi'),
  ('politik','Pemerintahan dan Administrasi','politik-pemerintahan'),
  ('politik','Hubungan Internasional',       'politik-internasional'),
  -- Agama
  ('agama','Islam',                          'agama-islam'),
  ('agama','Kristen',                        'agama-kristen'),
  ('agama','Hindu dan Buddha',               'agama-hindu-buddha'),
  ('agama','Kebatinan dan Kepercayaan',      'agama-kebatinan'),
  ('agama','Perbandingan Agama',             'agama-perbandingan'),
  -- Sastra
  ('sastra','Novel dan Roman',               'sastra-novel'),
  ('sastra','Puisi dan Syair',               'sastra-puisi'),
  ('sastra','Naskah Klasik dan Babad',       'sastra-klasik'),
  ('sastra','Drama dan Lakon',               'sastra-drama'),
  ('sastra','Cerita Rakyat',                 'sastra-cerita-rakyat'),
  ('sastra','Sastra Anak',                   'sastra-anak'),
  -- Bahasa
  ('bahasa','Kamus',                         'bahasa-kamus'),
  ('bahasa','Tata Bahasa',                   'bahasa-tata-bahasa'),
  ('bahasa','Bahasa Daerah',                 'bahasa-daerah'),
  ('bahasa','Bahasa Belanda',                'bahasa-belanda'),
  -- Hukum
  ('hukum','Hukum Adat',                     'hukum-adat'),
  ('hukum','Hukum Kolonial',                 'hukum-kolonial'),
  ('hukum','Perundang-undangan',             'hukum-perundangan'),
  -- Ekonomi
  ('ekonomi','Pertanian dan Perkebunan',     'ekonomi-pertanian'),
  ('ekonomi','Perdagangan',                  'ekonomi-perdagangan'),
  ('ekonomi','Keuangan dan Perbankan',       'ekonomi-keuangan'),
  -- Sains
  ('sains','Kedokteran dan Kesehatan',       'sains-kedokteran'),
  ('sains','Biologi dan Alam',               'sains-biologi'),
  ('sains','Geologi dan Pertambangan',       'sains-geologi'),
  ('sains','Teknik dan Rekayasa',            'sains-teknik'),
  -- Pendidikan
  ('pendidikan','Buku Pelajaran',            'pendidikan-pelajaran'),
  ('pendidikan','Pedagogi',                  'pendidikan-pedagogi'),
  -- Seni
  ('seni','Seni Rupa',                       'seni-rupa'),
  ('seni','Musik',                           'seni-musik'),
  ('seni','Arsitektur',                      'seni-arsitektur'),
  ('seni','Batik dan Kriya',                 'seni-batik-kriya'),
  ('seni','Wayang dan Pertunjukan',          'seni-wayang'),
  -- Geografi
  ('geografi-peta','Atlas',                  'geografi-atlas'),
  ('geografi-peta','Peta',                   'geografi-peta-lembar'),
  ('geografi-peta','Etnografi',              'geografi-etnografi')
) AS v(parent_slug, name, slug) ON p.slug = v.parent_slug
ON CONFLICT (slug) DO NOTHING;

COMMIT;
