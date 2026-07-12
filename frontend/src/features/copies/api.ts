import { apiGet } from "../../lib/api";
import type { Copy } from "./types";

export function listCopies(): Promise<Copy[]> {
  return apiGet<Copy[]>("/copies");
}
