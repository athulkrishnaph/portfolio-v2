// Package testdb gives integration tests a real, isolated PostgreSQL database.
//
// Each call creates a fresh schema (e.g. test_1727440000123), applies every
// migration inside it and drops it when the test finishes. The tables in the
// normal "public" schema are never touched, so it is safe to point
// TEST_DATABASE_URL at your development database.
//
// Tests are skipped when TEST_DATABASE_URL is not set:
//
//	TEST_DATABASE_URL=postgres://portfolio:portfolio@localhost:5432/portfolio?sslmode=disable go test ./...
package testdb

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portfolio/internal/migrate"
)

// New returns a connection pool whose search_path points at a new schema
// containing the full, empty application schema.
func New(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to run database integration tests")
	}
	ctx := context.Background()
	schema := fmt.Sprintf("test_%d", time.Now().UnixNano())

	admin, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("testdb: connect: %v", err)
	}
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatalf("testdb: create schema: %v", err)
	}
	t.Cleanup(func() {
		// Use a fresh context: the test's may already be cancelled.
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
		_ = admin.Close(context.Background())
	})

	// Apply the migrations inside the new schema.
	connCfg, err := pgx.ParseConfig(url)
	if err != nil {
		t.Fatalf("testdb: parse url: %v", err)
	}
	connCfg.RuntimeParams["search_path"] = schema
	conn, err := pgx.ConnectConfig(ctx, connCfg)
	if err != nil {
		t.Fatalf("testdb: connect to schema: %v", err)
	}
	defer conn.Close(ctx)
	if _, err := migrate.NewRunner(conn, os.DirFS(migrationsDir())).Up(ctx); err != nil {
		t.Fatalf("testdb: migrate: %v", err)
	}

	poolCfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatalf("testdb: parse pool config: %v", err)
	}
	poolCfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		t.Fatalf("testdb: pool: %v", err)
	}
	t.Cleanup(pool.Close) // registered last, so it runs before the schema is dropped
	return pool
}

// migrationsDir finds database/migrations relative to this source file, so
// tests work no matter which package directory `go test` runs them from.
func migrationsDir() string {
	_, file, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(file), "..", "..", "..", "database", "migrations")
}
