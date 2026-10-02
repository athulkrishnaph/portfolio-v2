package skills

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portfolio/internal/database"
)

// Repository reads and writes the skills table.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const columns = `id, name, category, display_order, is_featured, created_at, updated_at`

// List returns all skills sorted by category, then display order.
// The frontend groups consecutive rows by category.
func (r *Repository) List(ctx context.Context) ([]Skill, error) {
	rows, _ := r.db.Query(ctx, `SELECT `+columns+` FROM skills
		ORDER BY category, display_order, name`)
	list, err := pgx.CollectRows(rows, pgx.RowToStructByName[Skill])
	if err != nil {
		return nil, fmt.Errorf("list skills: %w", err)
	}
	return list, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (Skill, error) {
	return r.one(ctx, `SELECT `+columns+` FROM skills WHERE id = $1`, id)
}

func (r *Repository) Create(ctx context.Context, in Input) (Skill, error) {
	return r.one(ctx, `
		INSERT INTO skills (name, category, display_order, is_featured) VALUES ($1, $2, $3, $4)
		RETURNING `+columns,
		in.Name, in.Category, in.DisplayOrder, in.IsFeatured)
}

func (r *Repository) Update(ctx context.Context, id int64, in Input) (Skill, error) {
	return r.one(ctx, `
		UPDATE skills SET name = $2, category = $3, display_order = $4, is_featured = $5
		WHERE id = $1
		RETURNING `+columns,
		id, in.Name, in.Category, in.DisplayOrder, in.IsFeatured)
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM skills WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete skill: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) one(ctx context.Context, sql string, args ...any) (Skill, error) {
	rows, _ := r.db.Query(ctx, sql, args...)
	s, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Skill])
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return Skill{}, ErrNotFound
	case database.IsUniqueViolation(err, "skills_name_lower_key"):
		return Skill{}, ErrNameTaken
	case err != nil:
		return Skill{}, fmt.Errorf("skill query: %w", err)
	}
	return s, nil
}
