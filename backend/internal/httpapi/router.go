package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/buddybooks/backend/internal/domain/collections"
	"github.com/buddybooks/backend/internal/domain/copies"
	"github.com/buddybooks/backend/internal/domain/media"
	"github.com/buddybooks/backend/internal/domain/reader"
	"github.com/buddybooks/backend/internal/ocrclient"
)

func NewRouter(pool *pgxpool.Pool, ocrServiceURL string) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	r.Get("/health", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	collectionsHandler := collections.NewHandler(collections.NewRepository(pool))

	copiesRepo := copies.NewRepository(pool)
	copiesHandler := copies.NewHandler(copiesRepo)

	mediaRepo := media.NewRepository(pool)
	pagesRepo := reader.NewPageRepository(pool)
	ocrCli := ocrclient.New(ocrServiceURL)
	readerHandler := reader.NewHandler(pagesRepo, mediaRepo, copiesRepo, ocrCli)

	r.Route("/api/v1", func(api chi.Router) {
		api.Get("/collections", collectionsHandler.List)
		api.Get("/copies", copiesHandler.List)
		api.Post("/reader/ocr", readerHandler.RecognizePage)
		api.Post("/copies/{copyID}/pages", readerHandler.UploadPage)
		api.Get("/copies/{copyID}/pages", readerHandler.ListPages)
	})

	return r
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
