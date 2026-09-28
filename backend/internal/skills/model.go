// Package skills manages skills, grouped by free-text category.
package skills

import (
	"errors"
	"time"
)

var (
	ErrNotFound  = errors.New("skill not found")
	ErrNameTaken = errors.New("a skill with this name already exists")
)

// Skill is a skill as returned by the API.
type Skill struct {
	ID           int64     `json:"id"           db:"id"`
	Name         string    `json:"name"         db:"name"`
	Category     string    `json:"category"     db:"category"`
	DisplayOrder int       `json:"displayOrder" db:"display_order"`
	CreatedAt    time.Time `json:"createdAt"    db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt"    db:"updated_at"`
}

// Input is the request body for creating or updating a skill.
type Input struct {
	Name         string `json:"name"`
	Category     string `json:"category"`
	DisplayOrder int    `json:"displayOrder"`
}
