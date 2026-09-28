// Package config loads application settings from environment variables.
//
// Settings are read once at startup. Required values that are missing or
// invalid cause Load to return an error so the server fails fast instead of
// running with a broken configuration.
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// Config holds every runtime setting the backend needs.
type Config struct {
	DatabaseURL        string
	JWTSecret          string
	JWTTTL             time.Duration
	ServerPort         string
	UploadDirectory    string
	PublicBaseURL      string
	CORSAllowedOrigins []string
	MigrationsDir      string
	SeedsDir           string
	// TrustProxy makes the API read the client IP from X-Real-IP /
	// X-Forwarded-For. Enable only behind a reverse proxy you control.
	TrustProxy bool
	// StaticDir, when set, is the built Angular app (frontend/dist/frontend/browser)
	// that the API serves itself in production. Empty in development, where
	// the Angular dev server serves the frontend.
	StaticDir string
}

// minJWTSecretLength guards against trivially guessable signing keys.
const minJWTSecretLength = 32

// Load reads a .env file (if present) and then builds a Config from the
// process environment. Real environment variables always win over .env values.
func Load() (*Config, error) {
	// .env lives at the repo root, but the backend is usually run from
	// backend/, so check both locations. Missing files are fine.
	for _, path := range []string{".env", "../.env"} {
		if err := loadDotEnv(path); err != nil {
			return nil, err
		}
	}

	ttl, err := time.ParseDuration(getEnv("JWT_TTL", "2h"))
	if err != nil {
		return nil, fmt.Errorf("config: invalid JWT_TTL: %w", err)
	}

	cfg := &Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		JWTTTL:             ttl,
		ServerPort:         getEnv("SERVER_PORT", "8080"),
		UploadDirectory:    getEnv("UPLOAD_DIRECTORY", "./uploads"),
		PublicBaseURL:      strings.TrimRight(getEnv("PUBLIC_BASE_URL", "http://localhost:8080"), "/"),
		CORSAllowedOrigins: splitList(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:4200")),
		MigrationsDir:      getEnv("MIGRATIONS_DIR", "../database/migrations"),
		SeedsDir:           getEnv("SEEDS_DIR", "../database/seeds"),
		TrustProxy:         getEnv("TRUST_PROXY", "false") == "true",
		StaticDir:          os.Getenv("STATIC_DIR"),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	var errs []error
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if len(c.JWTSecret) < minJWTSecretLength {
		errs = append(errs, fmt.Errorf("JWT_SECRET must be at least %d characters", minJWTSecretLength))
	}
	if c.JWTTTL <= 0 {
		errs = append(errs, errors.New("JWT_TTL must be positive"))
	}
	if err := errors.Join(errs...); err != nil {
		return fmt.Errorf("config: %w", err)
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
