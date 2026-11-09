import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../../lib/api";
import type {
  AddConditionReportInput,
  AddProvenanceInput,
  AddValuationInput,
  ConditionReport,
  Copy,
  CopyDetail,
  CreateCopyInput,
  CreatedCopy,
  EditionOption,
  Photo,
  ProvenanceEvent,
  UpdateCopyInput,
  UpdateEditionInput,
  UpdateWorkSummaryInput,
  UpsertAcquisitionInput,
  ValuationRecord,
} from "./types";

export function listCopies(): Promise<Copy[]> {
  return apiGet<Copy[]>("/copies");
}

export function getCopy(copyId: string): Promise<CopyDetail> {
  return apiGet<CopyDetail>(`/copies/${copyId}`);
}

// getCopyByCode: resolve slug URL /copies/:collectionCode/:inventoryCode —
// lebih pendek & enak dibaca daripada UUID.
export function getCopyByCode(collectionCode: string, inventoryCode: string): Promise<CopyDetail> {
  return apiGet<CopyDetail>(`/copies/by-code/${collectionCode}/${inventoryCode}`);
}

export function listEditions(): Promise<EditionOption[]> {
  return apiGet<EditionOption[]>("/editions");
}

export function createCopy(input: CreateCopyInput): Promise<CreatedCopy> {
  return apiPost<CreatedCopy>("/copies", input);
}

// moveCopy: pindahkan eksemplar ke koleksi lain. Lokasi simpan eksemplar
// (rak/lemari) otomatis dikosongkan di backend karena lokasi lama tidak
// valid lagi untuk koleksi baru (lihat MoveToCollection).
export function moveCopy(copyId: string, collectionId: string): Promise<void> {
  return apiPatch<void>(`/copies/${copyId}/collection`, { collection_id: collectionId });
}

// updateCopy: field yang menempel ke eksemplar fisik (kode inventaris, grade).
export function updateCopy(copyId: string, input: UpdateCopyInput): Promise<void> {
  return apiPatch<void>(`/copies/${copyId}`, input);
}

// updateEdition: field yang menempel ke karya/edisi — berlaku untuk SEMUA
// eksemplar yang berbagi edisi yang sama, bukan cuma satu eksemplar ini.
export function updateEdition(editionId: string, input: UpdateEditionInput): Promise<void> {
  return apiPatch<void>(`/editions/${editionId}`, input);
}

export function updateWorkSummary(workId: string, input: UpdateWorkSummaryInput): Promise<void> {
  return apiPatch<void>(`/works/${workId}/summary`, input);
}

// addConditionReport / addValuation: menambah CATATAN BARU (bukan edit) —
// riwayat kondisi & nilai tetap tersimpan dari waktu ke waktu.
export function addConditionReport(copyId: string, input: AddConditionReportInput): Promise<void> {
  return apiPost<void>(`/copies/${copyId}/condition-reports`, input);
}

export function listConditionReports(copyId: string): Promise<ConditionReport[]> {
  return apiGet<ConditionReport[]>(`/copies/${copyId}/condition-reports`);
}

export function addValuation(copyId: string, input: AddValuationInput): Promise<void> {
  return apiPost<void>(`/copies/${copyId}/valuations`, input);
}

export function listValuations(copyId: string): Promise<ValuationRecord[]> {
  return apiGet<ValuationRecord[]>(`/copies/${copyId}/valuations`);
}

// upsertAcquisition: beda dari addConditionReport/addValuation — akuisisi
// cuma SATU fakta per eksemplar (disunting di tempat), bukan riwayat baru.
export function upsertAcquisition(copyId: string, input: UpsertAcquisitionInput): Promise<void> {
  return apiPut<void>(`/copies/${copyId}/acquisition`, input);
}

// setCopyLocation: locationId kosong -> lokasi dikosongkan (belum ada lokasi).
export function setCopyLocation(copyId: string, locationId: string): Promise<void> {
  return apiPatch<void>(`/copies/${copyId}/location`, { location_id: locationId });
}

export function listProvenance(copyId: string): Promise<ProvenanceEvent[]> {
  return apiGet<ProvenanceEvent[]>(`/copies/${copyId}/provenance`);
}

export function addProvenance(copyId: string, input: AddProvenanceInput): Promise<void> {
  return apiPost<void>(`/copies/${copyId}/provenance`, input);
}

export function listPhotos(copyId: string): Promise<Photo[]> {
  return apiGet<Photo[]>(`/copies/${copyId}/photos`);
}

export function updatePhoto(photoId: string, input: { media_type?: string; caption?: string }): Promise<void> {
  return apiPatch<void>(`/media/${photoId}`, input);
}

export function deletePhoto(photoId: string): Promise<void> {
  return apiDelete<void>(`/media/${photoId}`);
}

// uploadPhoto: multipart, bukan JSON — tidak lewat apiPost/apiSend biasa.
export async function uploadPhoto(
  copyId: string,
  file: File,
  mediaType: string,
  caption: string
): Promise<Photo> {
  const form = new FormData();
  form.append("file", file);
  form.append("media_type", mediaType);
  form.append("caption", caption);
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api/v1";
  const res = await fetch(`${base}/copies/${copyId}/photos`, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<Photo>;
}

// getNextInventoryCode: saran kode inventaris berikutnya untuk sebuah
// koleksi (mis. "BK-NOVEL-000002") — cuma saran, form tetap boleh diedit manual.
export async function getNextInventoryCode(collectionId: string): Promise<string> {
  const res = await apiGet<{ inventory_code: string }>(`/collections/${collectionId}/next-inventory-code`);
  return res.inventory_code;
}
