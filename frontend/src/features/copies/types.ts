import type { CollectionCopy } from "../collections/types";

export interface Copy {
  id: string;
  inventory_code: string;
  edition_id: string;
  preferred_title: string;
}

export interface OtherCopy {
  id: string;
  inventory_code: string;
  collection_id: string;
  collection_code: string;
}

// CopyDetail: dipakai CopyDetailPage — sama seperti CollectionCopy (ringkasan
// eksemplar) ditambah edition_id/collection_id/collection_code (dibutuhkan
// untuk aksi "tambah eksemplar lain", pindah koleksi, dan bikin URL slug
// /copies/:collectionCode/:inventoryCode), original_title/isbn/
// publisher_name (dipakai form Edit Buku), dan other_copies (eksemplar lain
// dari edisi yang sama, kasus duplikat).
export interface CopyDetail extends CollectionCopy {
  edition_id: string;
  collection_id: string;
  collection_code: string;
  original_title?: string;
  isbn?: string;
  publisher_name?: string;
  // Detail valuasi terbaru selain valuation_currency/valuation_mid (sudah
  // ada di CollectionCopy) — dipakai buat pre-fill form "Valuasi Baru".
  valuation_type?: string;
  valuation_low?: number;
  valuation_high?: number;
  valuation_basis?: string;
  // first_publication_year: tahun terbit PERTAMA karyanya (works), beda
  // dari publication_year yang berarti tahun cetakan eksemplar ini.
  first_publication_year?: number;
  // Detail akuisisi (pembelian) PRIMARY eksemplar ini.
  acquisition_method?: string;
  acquisition_date?: string;
  purchase_price?: number;
  purchase_currency?: string;
  acquisition_seller_name?: string;
  // Detail fisik eksemplar — sebelumnya ada di skema tapi belum bisa
  // diisi/ditampilkan sama sekali dari UI.
  completeness_status?: string;
  binding_description?: string;
  cover_description?: string;
  dust_jacket_present?: boolean;
  slipcase_present?: boolean;
  height_mm?: number;
  width_mm?: number;
  thickness_mm?: number;
  weight_grams?: number;
  accession_number?: string;
  private_notes?: string;
  current_location_id?: string;
  // category_id/work_type_id: dipakai pre-select dropdown di form edit
  // buku — category_name/lihat CollectionCopy tetap untuk tampilan biasa.
  category_id?: string;
  work_type_id?: string;
  work_type_name?: string;
  // work_id + field naratif karya (works) — dipakai tab "Ringkasan", beda
  // dari EditEditionModal karena ini sinopsis/signifikansi historis, bukan
  // data bibliografis identitas buku.
  work_id: string;
  subject_summary?: string;
  abstract?: string;
  historical_significance?: string;
  work_notes?: string;
  // total_pages: jumlah halaman ASLI buku (editions.total_pages), beda
  // dari page_count (di CollectionCopy) yang cuma menghitung halaman
  // SUDAH di-scan lewat OCR.
  total_pages?: number;
  other_copies: OtherCopy[];
}

export interface UpdateWorkSummaryInput {
  subject_summary: string;
  abstract: string;
  historical_significance: string;
  notes: string;
}

export interface UpdateCopyInput {
  inventory_code: string;
  collection_grade: string; // "" -> NULL
  completeness_status: string; // "" -> NULL
  binding_description: string;
  cover_description: string;
  dust_jacket_present: boolean | null;
  slipcase_present: boolean | null;
  height_mm: number | null;
  width_mm: number | null;
  thickness_mm: number | null;
  weight_grams: number | null;
  accession_number: string;
  private_notes: string;
}

export interface UpdateEditionInput {
  preferred_title: string;
  original_title: string;
  publication_year: number | null;
  isbn: string;
  publisher_name: string;
  author_name: string;
  category_id: string;
  work_type_id: string;
  total_pages: number | null;
}

export interface AddConditionReportInput {
  condition_grade: string;
  condition_score: number | null;
  note: string;
  foxing: boolean;
  mold_present: boolean;
  pest_damage_present: boolean;
  water_damage: boolean;
  active_risk: boolean;
}

export interface AddValuationInput {
  valuation_type: string;
  currency: string;
  value_low: number | null;
  value_mid: number | null;
  value_high: number | null;
  valuation_basis: string;
}

// UpsertAcquisitionInput: beda dari AddConditionReportInput/AddValuationInput
// (selalu tambah baru) — akuisisi cuma SATU fakta per eksemplar, jadi
// disunting di tempat (upsert), bukan riwayat berulang.
export interface UpsertAcquisitionInput {
  method: string;
  transaction_date: string;
  currency: string;
  purchase_price: number | null;
  seller_name: string;
  invoice_number: string;
  notes: string;
}

// ConditionReport/ValuationRecord: SATU baris riwayat (lihat prinsip
// "riwayat tidak ditimpa") — beda dari condition_grade/valuation_mid di
// CopyDetail yang cuma laporan/valuasi TERBARU.
export interface ConditionReport {
  id: string;
  report_date: string;
  condition_grade?: string;
  condition_score?: number;
  note?: string;
  foxing?: boolean;
  mold_present?: boolean;
  pest_damage_present?: boolean;
  water_damage?: boolean;
  active_risk: boolean;
}

export interface ValuationRecord {
  id: string;
  valuation_date: string;
  valuation_type?: string;
  currency?: string;
  value_low?: number;
  value_mid?: number;
  value_high?: number;
  valuation_basis?: string;
}

// ProvenanceEvent: SATU titik riwayat kepemilikan (append-only, sama
// prinsipnya dengan ConditionReport/ValuationRecord).
export interface ProvenanceEvent {
  id: string;
  sequence_no: number;
  event_type?: string;
  owner_name?: string;
  counterparty_name?: string;
  period_text?: string;
  period_start_year?: number;
  period_end_year?: number;
  evidence_summary?: string;
  verification_status?: string;
  confidence?: string;
}

export interface AddProvenanceInput {
  event_type: string;
  owner_name: string;
  counterparty_name: string;
  period_text: string;
  period_start_year: number | null;
  period_end_year: number | null;
  evidence_summary: string;
  verification_status: string;
  confidence: string;
}

// Photo: foto eksemplar (cover/spine/dst) — url sudah siap dipakai <img src>.
export interface Photo {
  id: string;
  copy_id: string;
  media_type: string;
  caption?: string;
  url: string;
}

export interface EditionOption {
  edition_id: string;
  preferred_title: string;
  publication_year?: number;
}

// CreateCopyInput: edition_id kosong berarti "buku ini belum ada" — backend
// akan bikin works+editions baru dari preferred_title/original_title/dst
// (lihat backend/internal/domain/copies CreateCopyInput). collection_id
// kosong -> otomatis masuk koleksi "Uncategorized".
export interface CreateCopyInput {
  collection_id: string;
  inventory_code: string;
  edition_id: string;
  preferred_title: string;
  original_title: string;
  publication_year: number | null;
  isbn: string;
  publisher_name: string;
  author_name: string;
}

export interface CreatedCopy {
  id: string;
  inventory_code: string;
  edition_id: string;
  preferred_title: string;
  collection_id: string;
}
