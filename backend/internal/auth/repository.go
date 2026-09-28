package auth

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portfolio/internal/database"
)

// Repository reads and writes the users table.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const userColumns = `id, email, password_hash, created_at, updated_at`

// GetByEmail finds a user by email, ignoring case.
func (r *Repository) GetByEmail(ctx context.Context, email string) (User, error) {
	return r.getOne(ctx, `SELECT `+userColumns+` FROM users WHERE lower(email) = lower($1)`, email)
}

// GetByID finds a user by ID.
func (r *Repository) GetByID(ctx context.Context, id int64) (User, error) {
	return r.getOne(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id)
}

// Create inserts a user. It returns ErrEmailTaken if the email already exists.
func (r *Repository) Create(ctx context.Context, email, passwordHash string) (User, error) {
	u, err := r.getOne(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING `+userColumns,
		email, passwordHash)
	if database.IsUniqueViolation(err, "users_email_lower_key") {
		return User{}, ErrEmailTaken
	}
	return u, err
}

// UpdatePassword replaces a user's password hash. Tokens issued before the
// change stop working (see TokenManager's password fingerprint).
func (r *Repository) UpdatePassword(ctx context.Context, id int64, passwordHash string) (User, error) {
	return r.getOne(ctx,
		`UPDATE users SET password_hash = $2 WHERE id = $1 RETURNING `+userColumns,
		id, passwordHash)
}

func (r *Repository) getOne(ctx context.Context, sql string, args ...any) (User, error) {
	rows, _ := r.db.Query(ctx, sql, args...) // errors surface in CollectOneRow
	u, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("users query: %w", err)
	}
	return u, nil
}
