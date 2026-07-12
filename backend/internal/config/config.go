package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	DatabaseURL  string
	Env          string
	OCRServiceURL string
}

func Load() Config {
	_ = godotenv.Load()

	return Config{
		Port:          getEnv("PORT", "8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://localhost:5432/db_buddybooks?sslmode=disable"),
		Env:           getEnv("APP_ENV", "development"),
		OCRServiceURL: getEnv("OCR_SERVICE_URL", "http://127.0.0.1:8090"),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
