// Label tampilan untuk enum copies.collection_grade & condition_reports.condition_grade
// (lihat backend/migrations/0001_init.sql). Dipakai di CollectionDetailPage & CopyDetailPage.
export const GRADE_LABEL: Record<string, string> = {
  core: "Inti",
  important: "Penting",
  supporting: "Pendukung",
  reading: "Baca",
  duplicate: "Duplikat",
};

export const CONDITION_LABEL: Record<string, string> = {
  mint: "Mint",
  fine: "Fine",
  very_good: "Sangat Baik",
  good: "Baik",
  fair: "Cukup",
  poor: "Buruk",
};

export const VALUATION_TYPE_LABEL: Record<string, string> = {
  owner_estimate: "Estimasi Pemilik",
  dealer_estimate: "Estimasi Dealer",
  auction_estimate: "Estimasi Lelang",
  insurance_value: "Nilai Asuransi",
  expert_appraisal: "Penilaian Ahli",
  realized_sale: "Harga Realisasi Jual",
};

export const COMPLETENESS_LABEL: Record<string, string> = {
  complete: "Lengkap",
  incomplete: "Tidak lengkap",
  uncertain: "Belum dipastikan",
};

export const LOCATION_TYPE_LABEL: Record<string, string> = {
  building: "Gedung",
  room: "Ruangan",
  cabinet: "Lemari",
  shelf: "Rak",
  box: "Kotak",
  display_case: "Etalase",
  vault: "Brankas",
};

export const ACQUISITION_METHOD_LABEL: Record<string, string> = {
  purchase: "Dibeli",
  auction: "Lelang",
  gift: "Hadiah",
  inheritance: "Warisan",
  exchange: "Tukar",
  transfer: "Transfer",
  other: "Lainnya",
};
