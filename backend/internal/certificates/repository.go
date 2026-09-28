package certificates

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository reads and writes the certificates table.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// columns lists what is selected. to_char returns the DATE as a plain
// "YYYY-MM-DD" string, so no time zone can shift it.
const columns = `id, title, issuer, to_char(issue_date, 'YYYY-MM-DD') AS issue_date,
	credential_url, image_url, display_order, created_at, updated_at`

// List returns all certificates in display order (newest first on ties).
func (r *Repository) List(ctx context.Context) ([]Certificate, error) {
	rows, _ := r.db.Query(ctx, `SELECT `+columns+` FROM certificates
		ORDER BY display_order, issue_date DESC, id`)
	certs, err := pgx.CollectRows(rows, pgx.RowToStructByName[Certificate])
	if err != nil {
		return nil, fmt.Errorf("list certificates: %w", err)
	}
	return certs, nil
}

func (r *Repository) GetByID(ctx context.Context, id int64) (Certificate, error) {
	return r.one(ctx, `SELECT `+columns+` FROM certificates WHERE id = $1`, id)
}

func (r *Repository) Create(ctx context.Context, in Input) (Certificate, error) {
	return r.one(ctx, `
		INSERT INTO certificates (title, issuer, issue_date, credential_url, image_url, display_order)
		VALUES ($1, $2, $3::date, $4, $5, $6)
		RETURNING `+columns,
		in.Title, in.Issuer, in.IssueDate, in.CredentialURL, in.ImageURL, in.DisplayOrder)
}

func (r *Repository) Update(ctx context.Context, id int64, in Input) (Certificate, error) {
	return r.one(ctx, `
		UPDATE certificates
		SET title = $2, issuer = $3, issue_date = $4::date, credential_url = $5,
		    image_url = $6, display_order = $7
		WHERE id = $1
		RETURNING `+columns,
		id, in.Title, in.Issuer, in.IssueDate, in.CredentialURL, in.ImageURL, in.DisplayOrder)
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM certificates WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete certificate: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// one runs a query that returns at most one certificate.
func (r *Repository) one(ctx context.Context, sql string, args ...any) (Certificate, error) {
	rows, _ := r.db.Query(ctx, sql, args...)
	c, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Certificate])
	if errors.Is(err, pgx.ErrNoRows) {
		return Certificate{}, ErrNotFound
	}
	if err != nil {
		return Certificate{}, fmt.Errorf("certificate query: %w", err)
	}
	return c, nil
}
