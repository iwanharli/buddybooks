# Enumerasi

Nilai enum diimplementasikan sebagai kolom `TEXT` dengan `CHECK constraint` atau tabel lookup, bukan sebagai tipe `ENUM` native database. Alasannya: menambah nilai baru pada `ENUM` native memerlukan migrasi `ALTER TYPE` yang mengunci tabel, sedangkan sistem ini dirancang extensible. Pendekatan `TEXT` + `CHECK` menjaga validasi tetap ketat tanpa mengorbankan fleksibilitas.

## `agent_type`

```text
person
organization
```

## `agent_role`

```text
publisher
printer
distributor
binder
author
editor
translator
seller
appraiser
previous_owner
institution
illustrator
compiler
contributor
collector
other
```

## `publisher_category`

```text
trade_publisher
university_press
academic_publisher
religious_publisher
media_group_publisher
government_publisher
historical_publisher
printer
other
```

## `work_agent_role`

```text
author
editor
translator
compiler
illustrator
contributor
other
```

## `edition_agent_role`

```text
publisher
printer
distributor
binder
other
```

## `copy_status`

```text
owned
incoming
on_loan
under_restoration
sold
lost
deaccessioned
```

## `collection_grade`

```text
core
important
supporting
reading
duplicate
```

## `completeness_status`

```text
complete
incomplete
uncertain
```

## `condition_grade`

```text
mint
fine
very_good
good
fair
poor
```

## `acquisition_method`

```text
purchase
auction
gift
inheritance
exchange
transfer
other
```

## `platform_role`

```text
guest
buyer
seller
admin
```

## `seller_member_role`

```text
owner
manager
staff
```

## `reading_entitlement_source`

```text
purchase
subscription
preview
grant
```

## `audit_action`

```text
create
update
delete
restore
```

## `listing_type`

```text
physical_copy
reading_access
```

## `listing_status`

```text
draft
active
reserved
sold
withdrawn
expired
```

## `order_status`

```text
pending
paid
fulfilled
completed
cancelled
refunded
```

## `payment_status`

```text
pending
authorized
paid
failed
refunded
```

## `shipment_status`

```text
pending
shipped
in_transit
delivered
returned
```

## `payout_status`

```text
pending
processing
paid
failed
```

## `market_trend`

```text
rising
stable
falling
```

## `liquidity_level`

```text
high
medium
low
```

## `disposal_method`

```text
sale
auction
gift
donation
transfer
lost
other
```

## `valuation_type`

```text
owner_estimate
dealer_estimate
auction_estimate
insurance_value
expert_appraisal
realized_sale
```

## `provenance_event_type`

```text
created
owned
gifted
inherited
purchased
sold
auctioned
transferred
unknown
```

## `media_type`

```text
cover_front
cover_back
spine
title_page
copyright_page
contents
last_page
signature
stamp
damage
receipt
certificate
other
```

## `wishlist_status`

```text
active
found
purchased
paused
abandoned
```

## `wishlist_offer_platform`

```text
instagram
tokopedia
shopee
facebook
whatsapp
website
offline
other
```

## `wishlist_offer_availability`

```text
available
reserved
sold
expired
unknown
```

---
