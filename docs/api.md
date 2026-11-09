# API yang Disarankan

API bersifat ilustratif dan dapat diterapkan menggunakan REST atau GraphQL.

## Collections

```text
GET    /collections
POST   /collections
GET    /collections/{id}
PATCH  /collections/{id}
```

## Master Data

Route master memakai nama resource Bahasa Inggris. Label UI boleh diterjemahkan, tetapi path tetap stabil untuk integrasi.

```text
GET    /master/agents
GET    /master/publishers
GET    /master/places
GET    /master/categories
GET    /master/work-types
GET    /master/languages
GET    /master/storage-locations
GET    /master/shipping-carriers
GET    /master/payment-methods
GET    /master/sales-channels
GET    /master/{resource}/{id}
```

`/master/agents` mengambil agent bertipe `person` dengan role kreator buku seperti `author`, `editor`, `translator`, `illustrator`, `compiler`, atau `contributor`.

`/master/publishers` mengambil agent organisasi dengan role umum `publisher` atau `printer` dari `agent_roles`.

`/master/{resource}/{id}` mengembalikan panel detail. Untuk `agents` dan `publishers`, respons mencakup section identitas, kontak/tempat, riwayat, kurasi, dan relasi katalog.

Untuk pengisian data penerbit massal, gunakan command backend `import-publishers` seperti dijelaskan di `docs/publisher-import.md`. Command ini bukan API publik karena dipakai untuk kurasi data operasional.

## Works

```text
GET    /works
POST   /works
GET    /works/{id}
PATCH  /works/{id}
GET    /works/{id}/editions
POST   /works/{id}/agents
```

## Editions

```text
POST   /editions
GET    /editions/{id}
PATCH  /editions/{id}
POST   /editions/{id}/agents
GET    /editions/{id}/copies
```

## Copies

```text
GET    /copies
POST   /copies
GET    /copies/{id}
PATCH  /copies/{id}
GET    /copies/{id}/timeline
```

## Condition Reports

```text
POST   /copies/{id}/condition-reports
GET    /copies/{id}/condition-reports
GET    /condition-reports/{id}
```

## Acquisitions

```text
POST   /copies/{id}/acquisitions
GET    /copies/{id}/acquisitions
```

## Valuations

```text
POST   /copies/{id}/valuations
GET    /copies/{id}/valuations
GET    /copies/{id}/latest-valuation
```

## Provenance

```text
POST   /copies/{id}/provenance
GET    /copies/{id}/provenance
PATCH  /provenance/{id}
```

## Media

```text
POST   /copies/{id}/media
GET    /copies/{id}/media
DELETE /media/{id}
```

`DELETE` bersifat soft-delete: menandai `deleted_at` dan memindahkan berkas fisik ke karantina, bukan menghapus permanen. Ini menjaga jejak audit untuk aset bernilai.

## Wishlist

```text
GET    /wishlists
POST   /wishlists
PATCH  /wishlists/{id}
POST   /wishlists/{id}/convert-to-copy
```

---
