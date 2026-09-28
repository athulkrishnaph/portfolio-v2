package experience

import (
	"context"
	"strings"

	"portfolio/internal/validate"
)

// store is the part of Repository the service needs (a fake in tests).
type store interface {
	List(ctx context.Context) ([]Experience, error)
	GetByID(ctx context.Context, id int64) (Experience, error)
	Create(ctx context.Context, in Input) (Experience, error)
	Update(ctx context.Context, id int64, in Input) (Experience, error)
	Delete(ctx context.Context, id int64) error
}

// Service contains the experience business rules.
type Service struct {
	store store
}

// NewService creates a Service.
func NewService(store store) *Service {
	return &Service{store: store}
}

func (s *Service) List(ctx context.Context) ([]Experience, error) {
	return s.store.List(ctx)
}

func (s *Service) Get(ctx context.Context, id int64) (Experience, error) {
	return s.store.GetByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, in Input) (Experience, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Experience{}, err
	}
	return s.store.Create(ctx, in)
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Experience, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Experience{}, err
	}
	return s.store.Update(ctx, id, in)
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	return s.store.Delete(ctx, id)
}

// normalizeAndValidate applies the same rules as the database CHECK
// constraints (so users get friendly messages instead of a 500):
//   - a current job has no end date
//   - a finished job needs an end date on or after the start date
func normalizeAndValidate(in Input) (Input, error) {
	in.Company = strings.TrimSpace(in.Company)
	in.Position = strings.TrimSpace(in.Position)
	in.Location = strings.TrimSpace(in.Location)
	in.Description = strings.TrimSpace(in.Description)
	in.StartDate = strings.TrimSpace(in.StartDate)
	if in.EndDate != nil {
		end := strings.TrimSpace(*in.EndDate)
		in.EndDate = &end
		if end == "" {
			in.EndDate = nil
		}
	}
	if in.IsCurrent {
		in.EndDate = nil
	}

	v := validate.New()
	v.Required("company", "Company", in.Company)
	v.MaxLength("company", "Company", in.Company, 150)
	v.Required("position", "Position", in.Position)
	v.MaxLength("position", "Position", in.Position, 150)
	v.MaxLength("location", "Location", in.Location, 150)
	v.MaxLength("description", "Description", in.Description, 10_000)
	v.Date("startDate", "Start date", in.StartDate)
	if !in.IsCurrent {
		if in.EndDate == nil {
			v.Check(false, "endDate", "End date is required unless this is your current position")
		} else {
			v.Date("endDate", "End date", *in.EndDate)
			// YYYY-MM-DD strings compare in date order.
			v.Check(*in.EndDate >= in.StartDate, "endDate", "End date must be on or after the start date")
		}
	}
	v.DisplayOrder(in.DisplayOrder)
	return in, v.Err()
}
