import { apiGet, apiPatch, apiPost } from "../../lib/api";
import type { Collection, CollectionCopy, CollectionInput } from "./types";

export function listCollections(): Promise<Collection[]> {
  return apiGet<Collection[]>("/collections");
}

// getCollectionByCode: resolve slug URL /collections/:code (case-insensitive,
// code sudah unik di skema) — dipakai CollectionDetailPage.
export function getCollectionByCode(code: string): Promise<Collection> {
  return apiGet<Collection>(`/collections/by-code/${code}`);
}

export function listCollectionCopies(collectionId: string): Promise<CollectionCopy[]> {
  return apiGet<CollectionCopy[]>(`/collections/${collectionId}/copies`);
}

export function createCollection(input: CollectionInput): Promise<Collection> {
  return apiPost<Collection>("/collections", input);
}

export function updateCollection(id: string, input: CollectionInput): Promise<Collection> {
  return apiPatch<Collection>(`/collections/${id}`, input);
}
