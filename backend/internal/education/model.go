// Package education manages education history entries.
package education

import (
	"errors"
	"time"
)

var ErrNotFound = errors.New("education not found")

// Education is one education entry as returned by the API. Dates use
// YYYY-MM-DD; EndDate is null while still studying.
type Education struct {
	ID           int64     `json:"id"           db:"id"`
	Institution  string    `json:"institution"  db:"institution"`
	Degree       string    `json:"degree"       db:"degree"`
	FieldOfStudy string    `json:"fieldOfStudy" db:"field_of_study"`
	Location     string    `json:"location"     db:"location"`
	Description  string    `json:"description"  db:"description"`
	StartDate    string    `json:"startDate"    db:"start_date"`
	EndDate      *string   `json:"endDate"      db:"end_date"`
	DisplayOrder int       `json:"displayOrder" db:"display_order"`
	CreatedAt    time.Time `json:"createdAt"    db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt"    db:"updated_at"`
}

// Input is the request body for creating or updating an education entry.
type Input struct {
	Institution  string  `json:"institution"`
	Degree       string  `json:"degree"`
	FieldOfStudy string  `json:"fieldOfStudy"`
	Location     string  `json:"location"`
	Description  string  `json:"description"`
	StartDate    string  `json:"startDate"`
	EndDate      *string `json:"endDate"` // null or "" = ongoing
	DisplayOrder int     `json:"displayOrder"`
}
