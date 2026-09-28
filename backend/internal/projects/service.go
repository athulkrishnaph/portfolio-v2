package projects

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"portfolio/internal/validate"
)

// store is the part of Repository the service needs (a fake in tests).
type store interface {
	List(ctx context.Context, featuredOnly bool) ([]Project, error)
	GetByID(ctx context.Context, id int64) (Project, error)
	GetBySlug(ctx context.Context, slug string) (Project, error)
	Create(ctx context.Context, in Input) (Project, error)
	Update(ctx context.Context, id int64, in Input) (Project, error)
	Delete(ctx context.Context, id int64) error
}

// Service contains the project business rules.
type Service struct {
	store store
}

// NewService creates a Service.
func NewService(store store) *Service {
	return &Service{store: store}
}

func (s *Service) List(ctx context.Context, featuredOnly bool) ([]Project, error) {
	return s.store.List(ctx, featuredOnly)
}

func (s *Service) Get(ctx context.Context, id int64) (Project, error) {
	return s.store.GetByID(ctx, id)
}

func (s *Service) GetBySlug(ctx context.Context, slug string) (Project, error) {
	return s.store.GetBySlug(ctx, slug)
}

func (s *Service) Create(ctx context.Context, in Input) (Project, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Project{}, err
	}
	p, err := s.store.Create(ctx, in)
	return p, slugTakenAsValidation(err)
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Project, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Project{}, err
	}
	p, err := s.store.Update(ctx, id, in)
	return p, slugTakenAsValidation(err)
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	return s.store.Delete(ctx, id)
}

// Field limits. The database only enforces "not blank"; lengths are
// application rules.
const (
	maxTitle          = 150
	maxSlug           = 100
	maxSummary        = 300
	maxDescription    = 20_000
	maxTechnologies   = 30
	maxTechnologyName = 50
)

// slugPattern matches the CHECK constraint on projects.slug.
var slugPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// normalizeAndValidate trims input, fills in defaults and checks every rule.
func normalizeAndValidate(in Input) (Input, error) {
	in.Title = strings.TrimSpace(in.Title)
	in.Slug = strings.TrimSpace(in.Slug)
	in.Summary = strings.TrimSpace(in.Summary)
	in.Description = strings.TrimSpace(in.Description)
	in.GitHubURL = strings.TrimSpace(in.GitHubURL)
	in.LiveURL = strings.TrimSpace(in.LiveURL)
	in.ImageURL = strings.TrimSpace(in.ImageURL)
	if in.Slug == "" {
		in.Slug = Slugify(in.Title)
	}
	in.Technologies = cleanTechnologies(in.Technologies)

	v := validate.New()
	v.Required("title", "Title", in.Title)
	v.MaxLength("title", "Title", in.Title, maxTitle)
	if in.Slug == "" {
		// Only reachable when the title has no usable characters (e.g. "!!!").
		v.Check(in.Title == "", "slug", "Enter a slug: the title has no characters that can be used in a URL")
	} else {
		v.Check(slugPattern.MatchString(in.Slug), "slug",
			"Slug may only contain lowercase letters, numbers and single hyphens (e.g. my-project)")
	}
	v.MaxLength("slug", "Slug", in.Slug, maxSlug)
	v.MaxLength("summary", "Summary", in.Summary, maxSummary)
	v.MaxLength("description", "Description", in.Description, maxDescription)
	v.OptionalURL("githubUrl", "GitHub URL", in.GitHubURL)
	v.OptionalURL("liveUrl", "Live URL", in.LiveURL)
	v.OptionalURL("imageUrl", "Image URL", in.ImageURL)
	v.DisplayOrder(in.DisplayOrder)
	v.Check(len(in.Technologies) <= maxTechnologies, "technologies", "At most 30 technologies are allowed")
	for _, t := range in.Technologies {
		v.Check(validate.MaxLen(t, maxTechnologyName), "technologies", "Each technology must be at most 50 characters")
	}
	return in, v.Err()
}

// cleanTechnologies trims names, drops empty ones and removes duplicates
// (case-insensitive), keeping the first spelling and the original order.
func cleanTechnologies(names []string) []string {
	out := make([]string, 0, len(names))
	seen := map[string]bool{}
	for _, n := range names {
		n = strings.TrimSpace(n)
		key := strings.ToLower(n)
		if n == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, n)
	}
	return out
}

func slugTakenAsValidation(err error) error {
	if errors.Is(err, ErrSlugTaken) {
		return &validate.Error{Fields: map[string]string{"slug": "This slug is already used by another project"}}
	}
	return err
}

// Slugify turns a title into a URL-friendly slug:
// "My Cool App (v2)!" → "my-cool-app-v2". Non-ASCII letters are dropped.
func Slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			if dash && b.Len() > 0 {
				b.WriteByte('-')
			}
			b.WriteRune(r)
			dash = false
		} else {
			dash = true
		}
	}
	slug := b.String()
	if len(slug) > maxSlug {
		slug = strings.TrimRight(slug[:maxSlug], "-")
	}
	return slug
}
