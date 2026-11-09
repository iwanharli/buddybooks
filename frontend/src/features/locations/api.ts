import { apiDelete, apiGet, apiPatch, apiPost } from "../../lib/api";
import type { CreateLocationInput, StorageLocation } from "./types";

export function listLocations(collectionId: string): Promise<StorageLocation[]> {
  return apiGet<StorageLocation[]>(`/collections/${collectionId}/locations`);
}

export function createLocation(collectionId: string, input: CreateLocationInput): Promise<StorageLocation> {
  return apiPost<StorageLocation>(`/collections/${collectionId}/locations`, input);
}

export function updateLocation(locationId: string, input: CreateLocationInput): Promise<void> {
  return apiPatch<void>(`/locations/${locationId}`, input);
}

export function deleteLocation(locationId: string): Promise<void> {
  return apiDelete<void>(`/locations/${locationId}`);
}
