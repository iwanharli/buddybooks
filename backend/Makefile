.PHONY: run dev build migrate seed import-publishers fetch-ikapi-publishers

# gosseract (Tesseract OCR binding) butuh header leptonica/tesseract yang
# di-symlink Homebrew ke <prefix>/include, tapi pkg-config leptonica di
# beberapa versi menunjuk ke dalam folder leptonica/ itu sendiri sehingga
# include "leptonica/allheaders.h" gagal ditemukan tanpa flag manual ini.
BREW_PREFIX := $(shell brew --prefix 2>/dev/null)
export CGO_CFLAGS := -I$(BREW_PREFIX)/include
export CGO_CPPFLAGS := -I$(BREW_PREFIX)/include
export CGO_LDFLAGS := -L$(BREW_PREFIX)/lib

run:
	go run ./cmd/api

# Auto-reload: rebuild & restart otomatis saat file .go berubah (pakai air).
dev:
	air

build:
	go build -o bin/api ./cmd/api

migrate:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0001_init.sql
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0002_agent_roles.sql
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0003_clean_publisher_duplicates.sql
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0004_classify_publishers.sql
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0005_clean_ikapi_publisher_names.sql
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0006_book_pages_vlm_fallback.sql

seed:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/seed.sql

import-publishers:
	go run ./cmd/import-publishers -file "$(FILE)"

fetch-ikapi-publishers:
	go run ./cmd/fetch-ikapi-publishers $(if $(OUT),-out "$(OUT)",)
