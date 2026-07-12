.PHONY: run build migrate seed

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

build:
	go build -o bin/api ./cmd/api

migrate:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0001_init.sql

seed:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/seed.sql
