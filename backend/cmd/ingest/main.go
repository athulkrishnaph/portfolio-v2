// Command ingest builds the chatbot's knowledge base from the portfolio
// content (database, resume PDF, optional Markdown files in KNOWLEDGE_DIR).
//
// Usage (from the backend/ directory):
//
//	go run ./cmd/ingest          embed new/changed content, remove deleted content
//	go run ./cmd/ingest -full    re-embed everything (after changing the embedding model)
//
// Running it again is safe and cheap: unchanged chunks are skipped.
// The same operation is available in the admin dashboard ("Rebuild").
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"time"

	"portfolio/internal/config"
	"portfolio/internal/database"
	"portfolio/internal/gemini"
	"portfolio/internal/rag"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	full := flag.Bool("full", false, "re-embed every chunk, even unchanged ones")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if !cfg.Chat.Enabled() {
		return errors.New("GEMINI_API_KEY is not set (see .env.example)")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()

	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	store := rag.NewStore(db)
	dims, err := store.EmbeddingDimensions(ctx)
	if err != nil {
		return fmt.Errorf("%w\n(is pgvector installed and `go run ./cmd/migrate up` applied?)", err)
	}
	if dims != cfg.Chat.EmbeddingDimensions {
		return fmt.Errorf("GEMINI_EMBEDDING_DIMENSIONS=%d but the knowledge_chunks.embedding column is vector(%d); see README → Changing the embedding model",
			cfg.Chat.EmbeddingDimensions, dims)
	}

	client, err := gemini.New(ctx, gemini.Config{
		APIKey:              cfg.Chat.GeminiAPIKey,
		Model:               cfg.Chat.Model,
		EmbeddingModel:      cfg.Chat.EmbeddingModel,
		EmbeddingDimensions: cfg.Chat.EmbeddingDimensions,
	})
	if err != nil {
		return err
	}

	loader := rag.NewContentLoader(db, store, client, cfg.UploadDirectory, cfg.Chat.KnowledgeDir)
	fmt.Printf("indexing with %s (%d dimensions)…\n", cfg.Chat.EmbeddingModel, dims)
	report, err := rag.NewIndexer(store, client, loader).Run(ctx, *full)
	if err != nil {
		return err
	}

	fmt.Printf("done in %s: %d chunks (%d embedded, %d unchanged, %d removed)\n",
		report.Duration, report.Chunks, report.Embedded, report.Unchanged, report.Deleted)
	for _, w := range report.Warnings {
		fmt.Println("warning:", w)
	}
	return nil
}
