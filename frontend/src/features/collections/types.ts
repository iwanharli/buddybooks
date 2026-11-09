export interface Collection {
  id: string;
  seller_id?: string;
  name: string;
  code: string;
  description?: string;
  default_currency: string;
  copy_count: number;
}

// CollectionInput: "code" sengaja tidak ada di sini — dibuat otomatis di
// backend dari "name" (lihat slugifyCode), pengguna tidak perlu tahu ada
// field kode sama sekali saat menambah koleksi.
export interface CollectionInput {
  name: string;
  description: string;
  default_currency: string;
}

// CollectionCopy: ringkasan eksemplar dalam satu koleksi (lihat
// backend/internal/domain/copies CollectionCopy). Field kondisi/valuasi/
// kategori/lokasi memang nullable — kebanyakan eksemplar nyata belum
// punya condition_reports/valuations sama sekali, jadi harus ditangani
// sebagai "belum dinilai", bukan disembunyikan atau diberi angka rekaan.
export interface CollectionCopy {
  id: string;
  inventory_code: string;
  preferred_title: string;
  author_name?: string;
  collection_grade?: string; // core | important | supporting | reading | duplicate
  publication_year?: number;
  category_name?: string;
  location_name?: string;
  condition_grade?: string; // mint | fine | very_good | good | fair | poor
  valuation_currency?: string;
  valuation_mid?: number;
  page_count: number;
  ocr_avg_confidence?: number;
  // cover_photo_url: siap pakai <img src> — sudah diarahkan ke media_assets
  // media_type='cover_front' (atau foto pertama kalau belum ada yang
  // ditandai sampul) lewat backend, tidak perlu request terpisah per kartu.
  cover_photo_url?: string;
}
