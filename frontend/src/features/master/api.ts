import { apiGet } from "../../lib/api";

export interface MasterItem {
  id: string;
  name: string;
  code: string;
  note: string;
  status: string;
}

export interface MasterDetailField {
  label: string;
  value: string;
  kind?: "url" | "email" | string;
}

export interface MasterDetailSection {
  title: string;
  fields: MasterDetailField[];
}

export interface MasterDetail {
  id: string;
  name: string;
  code: string;
  note: string;
  status: string;
  sections: MasterDetailSection[];
}

export function listMasterItems(resource: string): Promise<MasterItem[]> {
  return apiGet<MasterItem[]>(`/master/${resource}`);
}

export function getMasterDetail(resource: string, id: string): Promise<MasterDetail> {
  return apiGet<MasterDetail>(`/master/${resource}/${id}`);
}
