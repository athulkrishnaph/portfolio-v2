package migrate

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"sort"

	"github.com/jackc/pgx/v5"
)

// ErrAlreadySeeded is returned by Seed when portfolio content already exists
// and force is false. This protects real content from being overwritten.
var ErrAlreadySeeded = errors.New("database already contains portfolio content (use -force to replace it with demo data)")

// Seed runs every *.sql file in fsys in alphabetical order, all inside one
// transaction. Seed files are expected to clear the content tables first,
// so running them with force=true replaces existing content with demo data.
// The users table is never touched by seeds.
func Seed(ctx context.Context, conn *pgx.Conn, fsys fs.FS, force bool) ([]string, error) {
	files, err := fs.Glob(fsys, "*.sql")
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, errors.New("no seed files found")
	}
	sort.Strings(files)

	if !force {
		var hasContent bool
		err := conn.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM profile)`).Scan(&hasContent)
		if err != nil {
			return nil, fmt.Errorf("check existing content (have you run migrations?): %w", err)
		}
		if hasContent {
			return nil, ErrAlreadySeeded
		}
	}

	err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		for _, file := range files {
			sql, err := fs.ReadFile(fsys, file)
			if err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, string(sql)); err != nil {
				return fmt.Errorf("seed %s: %w", path.Base(file), err)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return files, nil
}
