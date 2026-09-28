package database

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// PostgreSQL error codes we react to. Full list:
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const (
	codeUniqueViolation = "23505"
	codeCheckViolation  = "23514"
)

// IsUniqueViolation reports whether err is a unique-constraint violation.
// If constraint is not empty, the violated constraint must have that name.
func IsUniqueViolation(err error, constraint string) bool {
	return isPgError(err, codeUniqueViolation, constraint)
}

// IsCheckViolation reports whether err is a CHECK-constraint violation.
// If constraint is not empty, the violated constraint must have that name.
func IsCheckViolation(err error, constraint string) bool {
	return isPgError(err, codeCheckViolation, constraint)
}

func isPgError(err error, code, constraint string) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != code {
		return false
	}
	return constraint == "" || pgErr.ConstraintName == constraint
}
