package migrate

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"time"

	"github.com/jackc/pgx/v5"
)

// lockKey is an arbitrary constant used for a PostgreSQL advisory lock, so
// two migration runs at the same time (e.g. two deploys) cannot interfere.
const lockKey = 7_264_001

// Status describes whether a migration has been applied.
type Status struct {
	Migration
	AppliedAt *time.Time // nil when pending
}

// Runner applies migrations from a directory to one database connection.
type Runner struct {
	conn *pgx.Conn
	fsys fs.FS
}

// NewRunner creates a Runner. fsys is usually os.DirFS(migrationsDir).
func NewRunner(conn *pgx.Conn, fsys fs.FS) *Runner {
	return &Runner{conn: conn, fsys: fsys}
}

// Up applies every pending migration in version order and returns the ones
// it applied. Each migration runs in its own transaction, so a failing
// migration leaves the database exactly as it was before that file.
func (r *Runner) Up(ctx context.Context) ([]Migration, error) {
	var applied []Migration
	err := r.withLock(ctx, func() error {
		migrations, done, err := r.load(ctx)
		if err != nil {
			return err
		}
		for _, m := range migrations {
			if _, ok := done[m.Version]; ok {
				continue
			}
			if err := r.apply(ctx, m.UpFile, func(tx pgx.Tx) error {
				_, err := tx.Exec(ctx,
					`INSERT INTO schema_migrations (version, name) VALUES ($1, $2)`, m.Version, m.Name)
				return err
			}); err != nil {
				return fmt.Errorf("apply %s: %w", m.UpFile, err)
			}
			applied = append(applied, m)
		}
		return nil
	})
	return applied, err
}

// Down rolls back the most recently applied migration. It returns nil (and
// no error) when there is nothing to roll back.
func (r *Runner) Down(ctx context.Context) (*Migration, error) {
	var rolledBack *Migration
	err := r.withLock(ctx, func() error {
		migrations, done, err := r.load(ctx)
		if err != nil {
			return err
		}
		// Walk backwards to find the newest applied migration.
		for i := len(migrations) - 1; i >= 0; i-- {
			m := migrations[i]
			if _, ok := done[m.Version]; !ok {
				continue
			}
			if err := r.apply(ctx, m.DownFile, func(tx pgx.Tx) error {
				_, err := tx.Exec(ctx, `DELETE FROM schema_migrations WHERE version = $1`, m.Version)
				return err
			}); err != nil {
				return fmt.Errorf("apply %s: %w", m.DownFile, err)
			}
			rolledBack = &m
			return nil
		}
		return nil
	})
	return rolledBack, err
}

// Status lists every migration file and when (if ever) it was applied.
func (r *Runner) Status(ctx context.Context) ([]Status, error) {
	if err := r.ensureTable(ctx); err != nil {
		return nil, err
	}
	migrations, done, err := r.load(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Status, 0, len(migrations))
	for _, m := range migrations {
		s := Status{Migration: m}
		if at, ok := done[m.Version]; ok {
			s.AppliedAt = &at
		}
		out = append(out, s)
	}
	return out, nil
}

// load reads migration files and the set of already-applied versions.
func (r *Runner) load(ctx context.Context) ([]Migration, map[int64]time.Time, error) {
	migrations, err := Load(r.fsys)
	if err != nil {
		return nil, nil, err
	}

	rows, err := r.conn.Query(ctx, `SELECT version, applied_at FROM schema_migrations`)
	if err != nil {
		return nil, nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	done := map[int64]time.Time{}
	var version int64
	var appliedAt time.Time
	_, err = pgx.ForEachRow(rows, []any{&version, &appliedAt}, func() error {
		done[version] = appliedAt
		return nil
	})
	if err != nil {
		return nil, nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	return migrations, done, nil
}

// apply runs one SQL file plus a bookkeeping statement in a single transaction.
func (r *Runner) apply(ctx context.Context, file string, record func(pgx.Tx) error) error {
	sql, err := fs.ReadFile(r.fsys, file)
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, r.conn, func(tx pgx.Tx) error {
		// Exec without arguments uses PostgreSQL's simple query protocol,
		// which allows a file to contain many statements.
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			return err
		}
		return record(tx)
	})
}

func (r *Runner) ensureTable(ctx context.Context) error {
	_, err := r.conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    BIGINT      PRIMARY KEY,
			name       TEXT        NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`)
	if err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}
	return nil
}

// withLock makes sure the bookkeeping table exists, then runs fn while
// holding a session-level advisory lock.
func (r *Runner) withLock(ctx context.Context, fn func() error) (err error) {
	if err := r.ensureTable(ctx); err != nil {
		return err
	}
	if _, err := r.conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, lockKey); err != nil {
		return fmt.Errorf("acquire migration lock: %w", err)
	}
	defer func() {
		// Use a fresh context so the unlock still runs if ctx was cancelled.
		_, unlockErr := r.conn.Exec(context.Background(), `SELECT pg_advisory_unlock($1)`, lockKey)
		err = errors.Join(err, unlockErr)
	}()
	return fn()
}
