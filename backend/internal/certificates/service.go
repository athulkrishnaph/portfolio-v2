package certificates

import (
	"context"
	"strings"

	"portfolio/internal/validate"
)

// store is the part of Repository the service needs (a fake in tests).
type store interface {
	List(ctx context.Context) ([]Certificate, error)
	GetByID(ctx context.Context, id int64) (Certificate, error)
	Create(ctx context.Context, in Input) (Certificate, error)
	Update(ctx context.Context, id int64, in Input) (Certificate, error)
	Delete(ctx context.Context, id int64) error
}

// Service contains the certificate business rules.
type Service struct {
	store store
}

// NewService creates a Service.
func NewService(store store) *Service {
	return &Service{store: store}
}

func (s *Service) List(ctx context.Context) ([]Certificate, error) {
	return s.store.List(ctx)
}

func (s *Service) Get(ctx context.Context, id int64) (Certificate, error) {
	return s.store.GetByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, in Input) (Certificate, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Certificate{}, err
	}
	return s.store.Create(ctx, in)
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Certificate, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Certificate{}, err
	}
	return s.store.Update(ctx, id, in)
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	return s.store.Delete(ctx, id)
}

func normalizeAndValidate(in Input) (Input, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.Issuer = strings.TrimSpace(in.Issuer)
	in.IssueDate = strings.TrimSpace(in.IssueDate)
	in.CredentialURL = strings.TrimSpace(in.CredentialURL)
	in.ImageURL = strings.TrimSpace(in.ImageURL)

	v := validate.New()
	v.Required("title", "Title", in.Title)
	v.MaxLength("title", "Title", in.Title, 200)
	v.Required("issuer", "Issuing organization", in.Issuer)
	v.MaxLength("issuer", "Issuing organization", in.Issuer, 150)
	v.Date("issueDate", "Issue date", in.IssueDate)
	v.OptionalURL("credentialUrl", "Credential URL", in.CredentialURL)
	v.OptionalURL("imageUrl", "Image URL", in.ImageURL)
	v.DisplayOrder(in.DisplayOrder)
	return in, v.Err()
}
