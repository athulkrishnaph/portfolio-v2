// Package experience manages work history entries.
package experience

import (
	"errors"
	"time"
)

var ErrNotFound = errors.New("experience not found")

// Experience is one job as returned by the API. Dates use YYYY-MM-DD.
// EndDate is null while IsCurrent is true.
type Experience struct {
	ID           int64     `json:"id"           db:"id"`
	Company      string    `json:"company"      db:"company"`
	Position     string    `json:"position"     db:"position"`
	Location     string    `json:"location"     db:"location"`
	Description  string    `json:"description"  db:"description"`
	StartDate    string    `json:"startDate"    db:"start_date"`
	EndDate      *string   `json:"endDate"      db:"end_date"`
	IsCurrent    bool      `json:"isCurrent"    db:"is_current"`
	DisplayOrder int       `json:"displayOrder" db:"display_order"`
	CreatedAt    time.Time `json:"createdAt"    db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt"    db:"updated_at"`
}

// Input is the request body for creating or updating an experience entry.
type Input struct {
	Company      string  `json:"company"`
	Position     string  `json:"position"`
	Location     string  `json:"location"`
	Description  string  `json:"description"`
	StartDate    string  `json:"startDate"`
	EndDate      *string `json:"endDate"` // ignored when IsCurrent is true
	IsCurrent    bool    `json:"isCurrent"`
	DisplayOrder int     `json:"displayOrder"`
}
