package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	DatabaseURL   string
	Env           string
	OCRServiceURL string
	// PublicBaseURL: alamat backend ini yang bisa dijangkau balik oleh
	// ocr-service untuk callback webhook fallback VLM (mis. hasil Gemini/
	// OpenRouter yang selesai async). Lihat reader.Handler.OCRWebhook.
	PublicBaseURL string
	// WebhookSecret: dicocokkan dengan header X-Webhook-Secret pada
	// callback dari ocr-service, supaya endpoint webhook tidak bisa
	// dipanggil sembarang pihak dari luar.
	WebhookSecret string
}

func Load() Config {
	_ = godotenv.Load()

	return Config{
		Port:          getEnv("PORT", "8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://localhost:5432/db_buddybooks?sslmode=disable"),
		Env:           getEnv("APP_ENV", "development"),
		OCRServiceURL: getEnv("OCR_SERVICE_URL", "http://127.0.0.1:8090"),
		PublicBaseURL: getEnv("PUBLIC_BASE_URL", "http://127.0.0.1:8080"),
		WebhookSecret: getEnv("OCR_WEBHOOK_SECRET", ""),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
