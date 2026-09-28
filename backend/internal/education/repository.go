package education

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository reads and writes the education table.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// to_char returns DATEs as "YYYY-MM-DD" strings (NULL stays NULL).
const columns = `id, institution, degree, field_of_study, location, description,
	to_char(start_date, 'YYYY-MM-DD') AS start_date,
	to_char(end_date, 'YYYY-MM-DD') AS end_date,
	display_order, created_at, updated_at`

// List returns all entries in display order, most recent first on ties.
func (r *Repository) List(ctx context.Context) ([]Education, error) {
	rows, _ := r.db.Query(ctx, `SELECT `+columns+` FROM education
		ORDER BY display_order, start_date DESC, id`)
	list, err := pgx.CollectRows(rows, pgx.RowToStructByName[Education])
	if err != nil {
		return nil, fmt.Errorf("list education: %w", err)
	}
	return list, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (Education, error) {
	return r.one(ctx, `SELECT `+columns+` FROM education WHERE id = $1`, id)
}

func (r *Repository) Create(ctx context.Context, in Input) (Education, error) {
	return r.one(ctx, `
		INSERT INTO education (institution, degree, field_of_study, location, description,
		                       start_date, end_date, display_order)
		VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8)
		RETURNING `+columns,
		in.Institution, in.Degree, in.FieldOfStudy, in.Location, in.Description,
		in.StartDate, in.EndDate, in.DisplayOrder)
}

func (r *Repository) Update(ctx context.Context, id int64, in Input) (Education, error) {
	return r.one(ctx, `
		UPDATE education
		SET institution = $2, degree = $3, field_of_study = $4, location = $5,
		    description = $6, start_date = $7::date, end_date = $8::date, display_order = $9
		WHERE id = $1
		RETURNING `+columns,
		id, in.Institution, in.Degree, in.FieldOfStudy, in.Location, in.Description,
		in.StartDate, in.EndDate, in.DisplayOrder)
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM education WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete education: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) one(ctx context.Context, sql string, args ...any) (Education, error) {
	rows, _ := r.db.Query(ctx, sql, args...)
	e, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Education])
	if errors.Is(err, pgx.ErrNoRows) {
		return Education{}, ErrNotFound
	}
	if err != nil {
		return Education{}, fmt.Errorf("education query: %w", err)
	}
	return e, nil
}
