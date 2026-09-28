// Package profile manages the single owner profile and its social links.
package profile

import (
	"errors"
	"time"
)

var ErrNotFound = errors.New("profile not found")

// SocialLink is one external link, e.g. {"platform": "GitHub", "url": "https://github.com/me"}.
// The order of the list is the display order.
type SocialLink struct {
	Platform string `json:"platform" db:"platform"`
	URL      string `json:"url"      db:"url"`
}

// Profile is the portfolio owner's profile as returned by the API.
type Profile struct {
	FullName    string       `json:"fullName"    db:"full_name"`
	Headline    string       `json:"headline"    db:"headline"`
	Bio         string       `json:"bio"         db:"bio"`
	Email       string       `json:"email"       db:"email"`
	Location    string       `json:"location"    db:"location"`
	ImageURL    string       `json:"imageUrl"    db:"image_url"`
	ResumeURL   string       `json:"resumeUrl"   db:"resume_url"`
	SocialLinks []SocialLink `json:"socialLinks" db:"-"`
	UpdatedAt   time.Time    `json:"updatedAt"   db:"updated_at"`
}

// Input is the request body for PUT /api/profile. It replaces the whole
// profile, including the full list of social links.
type Input struct {
	FullName    string       `json:"fullName"`
	Headline    string       `json:"headline"`
	Bio         string       `json:"bio"`
	Email       string       `json:"email"`
	Location    string       `json:"location"`
	ImageURL    string       `json:"imageUrl"`
	ResumeURL   string       `json:"resumeUrl"`
	SocialLinks []SocialLink `json:"socialLinks"`
}
