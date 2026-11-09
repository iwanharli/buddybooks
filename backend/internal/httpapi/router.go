package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/buddybooks/backend/internal/domain/collections"
	"github.com/buddybooks/backend/internal/domain/copies"
	"github.com/buddybooks/backend/internal/domain/locations"
	"github.com/buddybooks/backend/internal/domain/master"
	"github.com/buddybooks/backend/internal/domain/media"
	"github.com/buddybooks/backend/internal/domain/reader"
	"github.com/buddybooks/backend/internal/ocrclient"
)

func NewRouter(pool *pgxpool.Pool, ocrServiceURL, publicBaseURL, webhookSecret string) http.Handler {
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
	masterHandler := master.NewHandler(master.NewRepository(pool))
	locationsHandler := locations.NewHandler(locations.NewRepository(pool))

	copiesRepo := copies.NewRepository(pool)
	copiesHandler := copies.NewHandler(copiesRepo)

	mediaRepo := media.NewRepository(pool)
	mediaHandler := media.NewHandler(mediaRepo)
	pagesRepo := reader.NewPageRepository(pool)
	ocrCli := ocrclient.New(ocrServiceURL)
	readerHandler := reader.NewHandler(pagesRepo, mediaRepo, copiesRepo, ocrCli, publicBaseURL, webhookSecret)

	r.Route("/api/v1", func(api chi.Router) {
		api.Get("/collections", collectionsHandler.List)
		api.Post("/collections", collectionsHandler.Create)
		api.Get("/collections/by-code/{code}", collectionsHandler.GetByCode)
		api.Patch("/collections/{id}", collectionsHandler.Update)
		api.Get("/master/{resource}", masterHandler.List)
		api.Get("/master/{resource}/{id}", masterHandler.Detail)
		api.Get("/copies", copiesHandler.List)
		api.Post("/copies", copiesHandler.Create)
		api.Get("/copies/by-code/{collectionCode}/{inventoryCode}", copiesHandler.GetByCode)
		api.Get("/copies/{copyID}", copiesHandler.Get)
		api.Patch("/copies/{copyID}", copiesHandler.UpdateCopy)
		api.Patch("/copies/{copyID}/collection", copiesHandler.Move)
		api.Get("/copies/{copyID}/condition-reports", copiesHandler.ListConditionReports)
		api.Post("/copies/{copyID}/condition-reports", copiesHandler.AddConditionReport)
		api.Get("/copies/{copyID}/valuations", copiesHandler.ListValuations)
		api.Post("/copies/{copyID}/valuations", copiesHandler.AddValuation)
		api.Put("/copies/{copyID}/acquisition", copiesHandler.UpsertAcquisition)
		api.Get("/copies/{copyID}/provenance", copiesHandler.ListProvenance)
		api.Post("/copies/{copyID}/provenance", copiesHandler.AddProvenance)
		api.Patch("/copies/{copyID}/location", copiesHandler.SetLocation)
		api.Get("/collections/{collectionID}/locations", locationsHandler.List)
		api.Post("/collections/{collectionID}/locations", locationsHandler.Create)
		api.Patch("/locations/{locationID}", locationsHandler.Update)
		api.Delete("/locations/{locationID}", locationsHandler.Delete)
		api.Get("/editions", copiesHandler.ListEditions)
		api.Patch("/editions/{editionID}", copiesHandler.UpdateEdition)
		api.Patch("/works/{workID}/summary", copiesHandler.UpdateWorkSummary)
		api.Get("/collections/{collectionID}/copies", copiesHandler.ListByCollection)
		api.Get("/collections/{collectionID}/next-inventory-code", copiesHandler.NextInventoryCode)
		api.Post("/reader/ocr", readerHandler.RecognizePage)
		api.Post("/reader/ocr/callback", readerHandler.OCRWebhook)
		api.Post("/copies/{copyID}/pages", readerHandler.UploadPage)
		api.Get("/copies/{copyID}/pages", readerHandler.ListPages)
		api.Post("/pages/{pageID}/rescan", readerHandler.RescanPage)
		api.Post("/copies/{copyID}/photos", mediaHandler.UploadPhoto)
		api.Get("/copies/{copyID}/photos", mediaHandler.ListPhotos)
		api.Get("/media/{id}/file", mediaHandler.ServeFile)
		api.Patch("/media/{id}", mediaHandler.UpdatePhoto)
		api.Delete("/media/{id}", mediaHandler.DeletePhoto)
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
