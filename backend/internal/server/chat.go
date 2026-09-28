package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"portfolio/internal/chat"
	"portfolio/internal/gemini"
	"portfolio/internal/middleware"
	"portfolio/internal/profile"
	"portfolio/internal/rag"
)

// registerChat wires the chatbot: Gemini client → knowledge store and
// indexer → chat service → HTTP handler. If anything required is missing,
// the chatbot is registered as disabled and the rest of the API still works.
func registerChat(mux *http.ServeMux, deps Deps, requireAuth middleware.Middleware) {
	cfg := deps.Config.Chat
	clientIP := middleware.ClientIP(deps.Config.TrustProxy)

	// Two per-visitor limits: a short burst limit and a daily one.
	perMinute := middleware.RateLimit(cfg.RateLimitPerMinute, time.Minute, clientIP)
	perDay := middleware.RateLimit(cfg.RateLimitPerDay, 24*time.Hour, clientIP)
	limit := func(h http.Handler) http.Handler { return perMinute(perDay(h)) }

	buildChatHandler(deps).Routes(mux, requireAuth, limit)
}

func buildChatHandler(deps Deps) *chat.Handler {
	cfg := deps.Config.Chat
	if !cfg.Enabled() {
		return chat.NewDisabledHandler("GEMINI_API_KEY is not set")
	}

	store := rag.NewStore(deps.DB)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// The vector(N) column and the configured embedding size must agree,
	// otherwise every insert and search would fail.
	dims, err := store.EmbeddingDimensions(ctx)
	if err != nil {
		slog.Warn("chatbot disabled: knowledge table not available", "error", err)
		return chat.NewDisabledHandler("The knowledge_chunks table is missing. Install pgvector and run `go run ./cmd/migrate up`.")
	}
	if dims != cfg.EmbeddingDimensions {
		reason := fmt.Sprintf("GEMINI_EMBEDDING_DIMENSIONS is %d but the database column is vector(%d). See README → Changing the embedding model.",
			cfg.EmbeddingDimensions, dims)
		slog.Warn("chatbot disabled: " + reason)
		return chat.NewDisabledHandler(reason)
	}

	client, err := gemini.New(ctx, gemini.Config{
		APIKey:              cfg.GeminiAPIKey,
		Model:               cfg.Model,
		EmbeddingModel:      cfg.EmbeddingModel,
		EmbeddingDimensions: cfg.EmbeddingDimensions,
	})
	if err != nil {
		slog.Warn("chatbot disabled: Gemini client", "error", err)
		return chat.NewDisabledHandler("The Gemini client could not be created. Check the server log.")
	}

	profiles := profile.NewRepository(deps.DB)
	loader := rag.NewContentLoader(deps.DB, store, client, deps.Config.UploadDirectory, cfg.KnowledgeDir)
	indexer := rag.NewIndexer(store, client, loader)

	svc := chat.NewService(client, store, chat.Options{
		TopK:          cfg.TopK,
		MinSimilarity: cfg.MinSimilarity,
		DailyLimit:    cfg.DailyLimit,
		OwnerName: func(ctx context.Context) string {
			p, err := profiles.Get(ctx)
			if err != nil {
				return ""
			}
			return p.FullName
		},
	})

	go indexIfEmpty(store, indexer)
	slog.Info("chatbot enabled", "model", cfg.Model, "embedding_model", cfg.EmbeddingModel, "dimensions", dims)
	return chat.NewHandler(svc, indexer, store, cfg.Model, cfg.EmbeddingModel)
}

// indexIfEmpty builds the knowledge base on first start, so the chatbot
// works without a manual step. Later updates use the admin "Rebuild" button
// or `go run ./cmd/ingest`.
func indexIfEmpty(store *rag.Store, indexer *rag.Indexer) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	stats, err := store.Stats(ctx)
	if err != nil || stats.Chunks > 0 {
		return
	}
	slog.Info("knowledge base is empty: indexing portfolio content")
	report, err := indexer.Run(ctx, false)
	if err != nil {
		slog.Warn("initial knowledge indexing failed", "error", err)
		return
	}
	slog.Info("knowledge base indexed", "chunks", report.Chunks, "warnings", len(report.Warnings))
}
