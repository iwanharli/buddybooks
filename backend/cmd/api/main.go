package main

import (
	"context"
	"log"
	"net/http"

	"github.com/buddybooks/backend/internal/config"
	"github.com/buddybooks/backend/internal/db"
	"github.com/buddybooks/backend/internal/httpapi"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	router := httpapi.NewRouter(pool, cfg.OCRServiceURL)

	log.Printf("buddybooks api listening on :%s (env=%s)", cfg.Port, cfg.Env)
	if err := http.ListenAndServe(":"+cfg.Port, router); err != nil {
		log.Fatalf("server: %v", err)
	}
}
