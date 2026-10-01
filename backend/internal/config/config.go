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
	"strconv"
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
	// GoogleClientID enables "Sign in with Google" on the admin login (next to
	// the password login). Empty disables it.
	GoogleClientID string
	// Supabase Storage keeps uploads outside the server's disk. Used when
	// SupabaseURL is set; otherwise files go to UploadDirectory.
	SupabaseURL        string
	SupabaseBucket     string
	SupabaseServiceKey string
	// TrustProxy makes the API read the client IP from X-Real-IP /
	// X-Forwarded-For. Enable only behind a reverse proxy you control.
	TrustProxy bool
	// StaticDir, when set, is the built Angular app (frontend/dist/frontend/browser)
	// that the API serves itself in production. Empty in development, where
	// the Angular dev server serves the frontend.
	StaticDir string

	// Chat is the configuration of the portfolio chatbot (RAG + Gemini).
	Chat ChatConfig
}

// ChatConfig configures the portfolio chatbot. The chatbot is optional: with
// no GEMINI_API_KEY it is simply disabled and the rest of the site works.
type ChatConfig struct {
	// GeminiAPIKey stays on the server; it is never sent to the browser or logged.
	GeminiAPIKey string
	// Model generates answers, e.g. "gemini-3.5-flash-lite".
	Model string
	// EmbeddingModel turns text into vectors, e.g. "gemini-embedding-2".
	EmbeddingModel string
	// EmbeddingDimensions must equal the vector(N) size of
	// knowledge_chunks.embedding; the API verifies this at startup.
	EmbeddingDimensions int
	// TopK is the maximum number of chunks sent to the model per question.
	TopK int
	// MinSimilarity (0–1, cosine) drops chunks that are not relevant enough.
	MinSimilarity float64
	// RateLimitPerMinute and RateLimitPerDay limit each visitor (by IP).
	RateLimitPerMinute int
	RateLimitPerDay    int
	// DailyLimit caps questions for all visitors together, protecting the
	// free-tier quota. 0 disables the cap.
	DailyLimit int
	// KnowledgeDir holds optional extra Markdown files to index
	// (e.g. achievements) for content that has no table.
	KnowledgeDir string
}

// Enabled reports whether the chatbot can run.
func (c ChatConfig) Enabled() bool {
	return c.GeminiAPIKey != ""
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
		GoogleClientID:     strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")),
		SupabaseURL:        strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		SupabaseBucket:     getEnv("SUPABASE_BUCKET", "uploads"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_KEY"),
		TrustProxy:         getEnv("TRUST_PROXY", "false") == "true",
		StaticDir:          os.Getenv("STATIC_DIR"),
	}

	chat, err := loadChatConfig()
	if err != nil {
		return nil, err
	}
	cfg.Chat = chat

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
	if c.SupabaseURL != "" && c.SupabaseServiceKey == "" {
		errs = append(errs, errors.New("SUPABASE_SERVICE_KEY is required when SUPABASE_URL is set"))
	}
	if err := errors.Join(errs...); err != nil {
		return fmt.Errorf("config: %w", err)
	}
	return nil
}

func loadChatConfig() (ChatConfig, error) {
	var errs []error
	intVar := func(key string, fallback, min, max int) int {
		v, err := strconv.Atoi(getEnv(key, strconv.Itoa(fallback)))
		if err != nil || v < min || v > max {
			errs = append(errs, fmt.Errorf("%s must be a whole number between %d and %d", key, min, max))
		}
		return v
	}

	// 0.6 was calibrated with gemini-embedding-2 on real portfolio data:
	// relevant questions scored 0.66–0.77, off-topic ones at most 0.58.
	minSimilarity, err := strconv.ParseFloat(getEnv("RAG_MIN_SIMILARITY", "0.6"), 64)
	if err != nil || minSimilarity < 0 || minSimilarity > 1 {
		errs = append(errs, errors.New("RAG_MIN_SIMILARITY must be a number between 0 and 1"))
	}

	c := ChatConfig{
		GeminiAPIKey:   strings.TrimSpace(os.Getenv("GEMINI_API_KEY")),
		Model:          getEnv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
		EmbeddingModel: getEnv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2"),
		// 128–3072 is what Gemini embedding models accept.
		EmbeddingDimensions: intVar("GEMINI_EMBEDDING_DIMENSIONS", 768, 128, 3072),
		TopK:                intVar("RAG_TOP_K", 5, 1, 10),
		MinSimilarity:       minSimilarity,
		RateLimitPerMinute:  intVar("CHAT_RATE_LIMIT_PER_MINUTE", 10, 1, 1000),
		RateLimitPerDay:     intVar("CHAT_RATE_LIMIT_PER_DAY", 100, 1, 100000),
		DailyLimit:          intVar("CHAT_DAILY_LIMIT", 300, 0, 1000000),
		KnowledgeDir:        getEnv("KNOWLEDGE_DIR", "../database/knowledge"),
	}
	if err := errors.Join(errs...); err != nil {
		return ChatConfig{}, fmt.Errorf("config: %w", err)
	}
	return c, nil
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
