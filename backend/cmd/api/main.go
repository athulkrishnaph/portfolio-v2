// Command api starts the portfolio REST API server.
//
// Usage (from the backend/ directory):
//
//	go run ./cmd/api
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"portfolio/internal/config"
	"portfolio/internal/database"
	"portfolio/internal/middleware"
	"portfolio/internal/server"
	"portfolio/internal/storage"
)

func main() {
	// NewLogHandler adds the request ID to every log line written with a request context.
	logger := slog.New(middleware.NewLogHandler(slog.NewTextHandler(os.Stdout, nil)))
	slog.SetDefault(logger)

	if err := run(); err != nil {
		slog.Error("server stopped with error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Stop gracefully on Ctrl+C / SIGTERM: stop accepting new requests and
	// give in-flight requests a few seconds to finish.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()
	slog.Info("connected to database")

	// Uploads go to Supabase Storage when configured (they survive restarts
	// on hosts without a persistent disk), otherwise to local disk.
	var files storage.Storage
	if cfg.SupabaseURL != "" {
		files = storage.NewSupabase(cfg.SupabaseURL, cfg.SupabaseBucket, cfg.SupabaseServiceKey)
		slog.Info("storing uploads in Supabase Storage", "bucket", cfg.SupabaseBucket)
	} else {
		files, err = storage.NewLocal(cfg.UploadDirectory, cfg.PublicBaseURL)
		if err != nil {
			return err
		}
	}

	srv := &http.Server{
		Addr:              ":" + cfg.ServerPort,
		Handler:           server.New(server.Deps{Config: cfg, DB: db, Storage: files}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		slog.Info("API listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
	}

	slog.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
