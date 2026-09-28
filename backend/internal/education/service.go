package education

import (
	"context"
	"strings"

	"portfolio/internal/validate"
)

// store is the part of Repository the service needs (a fake in tests).
type store interface {
	List(ctx context.Context) ([]Education, error)
	GetByID(ctx context.Context, id int64) (Education, error)
	Create(ctx context.Context, in Input) (Education, error)
	Update(ctx context.Context, id int64, in Input) (Education, error)
	Delete(ctx context.Context, id int64) error
}

// Service contains the education business rules.
type Service struct {
	store store
}

// NewService creates a Service.
func NewService(store store) *Service {
	return &Service{store: store}
}

func (s *Service) List(ctx context.Context) ([]Education, error) {
	return s.store.List(ctx)
}

func (s *Service) Get(ctx context.Context, id int64) (Education, error) {
	return s.store.GetByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, in Input) (Education, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Education{}, err
	}
	return s.store.Create(ctx, in)
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Education, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Education{}, err
	}
	return s.store.Update(ctx, id, in)
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	return s.store.Delete(ctx, id)
}

func normalizeAndValidate(in Input) (Input, error) {
	in.Institution = strings.TrimSpace(in.Institution)
	in.Degree = strings.TrimSpace(in.Degree)
	in.FieldOfStudy = strings.TrimSpace(in.FieldOfStudy)
	in.Location = strings.TrimSpace(in.Location)
	in.Description = strings.TrimSpace(in.Description)
	in.StartDate = strings.TrimSpace(in.StartDate)
	if in.EndDate != nil {
		end := strings.TrimSpace(*in.EndDate)
		in.EndDate = &end
		if end == "" {
			in.EndDate = nil // still studying
		}
	}

	v := validate.New()
	v.Required("institution", "Institution", in.Institution)
	v.MaxLength("institution", "Institution", in.Institution, 150)
	v.Required("degree", "Degree", in.Degree)
	v.MaxLength("degree", "Degree", in.Degree, 150)
	v.MaxLength("fieldOfStudy", "Field of study", in.FieldOfStudy, 150)
	v.MaxLength("location", "Location", in.Location, 150)
	v.MaxLength("description", "Description", in.Description, 10_000)
	v.Date("startDate", "Start date", in.StartDate)
	if in.EndDate != nil {
		v.Date("endDate", "End date", *in.EndDate)
		v.Check(*in.EndDate >= in.StartDate, "endDate", "End date must be on or after the start date")
	}
	v.DisplayOrder(in.DisplayOrder)
	return in, v.Err()
}
