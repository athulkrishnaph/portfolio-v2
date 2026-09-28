// Package database opens the PostgreSQL connection pool used by the API.
package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open creates a connection pool and verifies the database is reachable.
// The caller must Close the pool on shutdown.
func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("database: parse DATABASE_URL: %w", err)
	}

	// Small, sensible defaults for a personal site. pgx's default MaxConns
	// (4 or the CPU count, whichever is larger) is also fine; this just makes
	// the limits explicit.
	poolCfg.MaxConns = 10
	poolCfg.MinConns = 1
	poolCfg.MaxConnIdleTime = 5 * time.Minute
	poolCfg.HealthCheckPeriod = time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("database: create pool: %w", err)
	}

	// NewWithConfig connects lazily, so ping now to fail fast on a wrong URL,
	// wrong password or a database that is not running.
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database: connect: %w", err)
	}
	return pool, nil
}
