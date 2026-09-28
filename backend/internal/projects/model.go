// Package projects manages portfolio projects and their technologies.
package projects

import (
	"errors"
	"time"
)

var (
	ErrNotFound  = errors.New("project not found")
	ErrSlugTaken = errors.New("slug is already used by another project")
)

// Project is a portfolio project as returned by the API.
type Project struct {
	ID           int64     `json:"id"           db:"id"`
	Title        string    `json:"title"        db:"title"`
	Slug         string    `json:"slug"         db:"slug"`
	Summary      string    `json:"summary"      db:"summary"`
	Description  string    `json:"description"  db:"description"`
	GitHubURL    string    `json:"githubUrl"    db:"github_url"`
	LiveURL      string    `json:"liveUrl"      db:"live_url"`
	ImageURL     string    `json:"imageUrl"     db:"image_url"`
	IsFeatured   bool      `json:"isFeatured"   db:"is_featured"`
	DisplayOrder int       `json:"displayOrder" db:"display_order"`
	Technologies []string  `json:"technologies" db:"technologies"`
	CreatedAt    time.Time `json:"createdAt"    db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt"    db:"updated_at"`
}

// Input is the request body for creating or updating a project.
// Updates replace every field, including the technology list.
type Input struct {
	Title        string   `json:"title"`
	Slug         string   `json:"slug"` // optional: generated from the title when empty
	Summary      string   `json:"summary"`
	Description  string   `json:"description"`
	GitHubURL    string   `json:"githubUrl"`
	LiveURL      string   `json:"liveUrl"`
	ImageURL     string   `json:"imageUrl"`
	IsFeatured   bool     `json:"isFeatured"`
	DisplayOrder int      `json:"displayOrder"`
	Technologies []string `json:"technologies"`
}
