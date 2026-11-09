// StorageLocation: satu titik simpan fisik (rak/lemari/kotak/dst) di dalam
// SATU koleksi — hierarkis lewat parent_location_id.
export interface StorageLocation {
  id: string;
  collection_id: string;
  parent_location_id?: string;
  code: string;
  name?: string;
  location_type?: string;
  climate_controlled: boolean;
  secure: boolean;
}

export interface CreateLocationInput {
  code: string;
  name: string;
  location_type: string;
  parent_location_id: string;
  climate_controlled: boolean;
  secure: boolean;
}
