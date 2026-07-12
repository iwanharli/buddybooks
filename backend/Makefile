.PHONY: run build migrate seed

run:
	go run ./cmd/api

build:
	go build -o bin/api ./cmd/api

migrate:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0001_init.sql

seed:
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/seed.sql
