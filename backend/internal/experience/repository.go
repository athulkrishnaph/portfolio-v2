package experience

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository reads and writes the experience table.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// to_char returns DATEs as "YYYY-MM-DD" strings (NULL stays NULL).
const columns = `id, company, position, location, description,
	to_char(start_date, 'YYYY-MM-DD') AS start_date,
	to_char(end_date, 'YYYY-MM-DD') AS end_date,
	is_current, display_order, created_at, updated_at`

// List returns all entries in display order, most recent first on ties.
func (r *Repository) List(ctx context.Context) ([]Experience, error) {
	rows, _ := r.db.Query(ctx, `SELECT `+columns+` FROM experience
		ORDER BY display_order, start_date DESC, id`)
	list, err := pgx.CollectRows(rows, pgx.RowToStructByName[Experience])
	if err != nil {
		return nil, fmt.Errorf("list experience: %w", err)
	}
	return list, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (Experience, error) {
	return r.one(ctx, `SELECT `+columns+` FROM experience WHERE id = $1`, id)
}

func (r *Repository) Create(ctx context.Context, in Input) (Experience, error) {
	return r.one(ctx, `
		INSERT INTO experience (company, position, location, description,
		                        start_date, end_date, is_current, display_order)
		VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8)
		RETURNING `+columns,
		in.Company, in.Position, in.Location, in.Description,
		in.StartDate, in.EndDate, in.IsCurrent, in.DisplayOrder)
}

func (r *Repository) Update(ctx context.Context, id int64, in Input) (Experience, error) {
	return r.one(ctx, `
		UPDATE experience
		SET company = $2, position = $3, location = $4, description = $5,
		    start_date = $6::date, end_date = $7::date, is_current = $8, display_order = $9
		WHERE id = $1
		RETURNING `+columns,
		id, in.Company, in.Position, in.Location, in.Description,
		in.StartDate, in.EndDate, in.IsCurrent, in.DisplayOrder)
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM experience WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete experience: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) one(ctx context.Context, sql string, args ...any) (Experience, error) {
	rows, _ := r.db.Query(ctx, sql, args...)
	e, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Experience])
	if errors.Is(err, pgx.ErrNoRows) {
		return Experience{}, ErrNotFound
	}
	if err != nil {
		return Experience{}, fmt.Errorf("experience query: %w", err)
	}
	return e, nil
}
