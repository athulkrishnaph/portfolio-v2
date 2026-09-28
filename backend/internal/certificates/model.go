// Package certificates manages certificates (title, issuer, date, link, image).
package certificates

import (
	"errors"
	"time"
)

var ErrNotFound = errors.New("certificate not found")

// Certificate is a certificate as returned by the API.
// IssueDate uses the YYYY-MM-DD format.
type Certificate struct {
	ID            int64     `json:"id"            db:"id"`
	Title         string    `json:"title"         db:"title"`
	Issuer        string    `json:"issuer"        db:"issuer"`
	IssueDate     string    `json:"issueDate"     db:"issue_date"`
	CredentialURL string    `json:"credentialUrl" db:"credential_url"`
	ImageURL      string    `json:"imageUrl"      db:"image_url"`
	DisplayOrder  int       `json:"displayOrder"  db:"display_order"`
	CreatedAt     time.Time `json:"createdAt"     db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt"     db:"updated_at"`
}

// Input is the request body for creating or updating a certificate.
type Input struct {
	Title         string `json:"title"`
	Issuer        string `json:"issuer"`
	IssueDate     string `json:"issueDate"`
	CredentialURL string `json:"credentialUrl"`
	ImageURL      string `json:"imageUrl"`
	DisplayOrder  int    `json:"displayOrder"`
}
