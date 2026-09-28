package skills

import (
	"context"
	"errors"
	"strings"

	"portfolio/internal/validate"
)

// store is the part of Repository the service needs (a fake in tests).
type store interface {
	List(ctx context.Context) ([]Skill, error)
	GetByID(ctx context.Context, id int64) (Skill, error)
	Create(ctx context.Context, in Input) (Skill, error)
	Update(ctx context.Context, id int64, in Input) (Skill, error)
	Delete(ctx context.Context, id int64) error
}

// Service contains the skill business rules.
type Service struct {
	store store
}

// NewService creates a Service.
func NewService(store store) *Service {
	return &Service{store: store}
}

func (s *Service) List(ctx context.Context) ([]Skill, error) {
	return s.store.List(ctx)
}

func (s *Service) Get(ctx context.Context, id int64) (Skill, error) {
	return s.store.GetByID(ctx, id)
}

func (s *Service) Create(ctx context.Context, in Input) (Skill, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Skill{}, err
	}
	sk, err := s.store.Create(ctx, in)
	return sk, nameTakenAsValidation(err)
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Skill, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Skill{}, err
	}
	sk, err := s.store.Update(ctx, id, in)
	return sk, nameTakenAsValidation(err)
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	return s.store.Delete(ctx, id)
}

func normalizeAndValidate(in Input) (Input, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Category = strings.TrimSpace(in.Category)

	v := validate.New()
	v.Required("name", "Name", in.Name)
	v.MaxLength("name", "Name", in.Name, 50)
	v.Required("category", "Category", in.Category)
	v.MaxLength("category", "Category", in.Category, 50)
	v.DisplayOrder(in.DisplayOrder)
	return in, v.Err()
}

func nameTakenAsValidation(err error) error {
	if errors.Is(err, ErrNameTaken) {
		return &validate.Error{Fields: map[string]string{"name": "A skill with this name already exists"}}
	}
	return err
}
