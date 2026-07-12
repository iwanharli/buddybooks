import { apiGet } from "../../lib/api";
import type { Collection } from "./types";

export function listCollections(): Promise<Collection[]> {
  return apiGet<Collection[]>("/collections");
}
