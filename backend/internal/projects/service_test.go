package projects

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"portfolio/internal/validate"
)

// fakeStore records what the service passes to the repository.
type fakeStore struct {
	created   Input
	createErr error
}

func (f *fakeStore) List(context.Context, bool) ([]Project, error)   { return nil, nil }
func (f *fakeStore) GetByID(context.Context, int64) (Project, error) { return Project{}, ErrNotFound }
func (f *fakeStore) GetBySlug(context.Context, string) (Project, error) {
	return Project{}, ErrNotFound
}
func (f *fakeStore) Delete(context.Context, int64) error { return nil }
func (f *fakeStore) Update(_ context.Context, _ int64, in Input) (Project, error) {
	return Project{Title: in.Title}, nil
}
func (f *fakeStore) Create(_ context.Context, in Input) (Project, error) {
	f.created = in
	return Project{Title: in.Title, Slug: in.Slug}, f.createErr
}

func TestCreateNormalizesInput(t *testing.T) {
	store := &fakeStore{}
	svc := NewService(store)

	_, err := svc.Create(context.Background(), Input{
		Title:        "  Task Flow 2.0  ",
		GitHubURL:    " https://github.com/me/task-flow ",
		Technologies: []string{" Go", "go", "", "Angular ", "PostgreSQL"},
	})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	got := store.created
	if got.Title != "Task Flow 2.0" || got.Slug != "task-flow-2-0" || got.GitHubURL != "https://github.com/me/task-flow" {
		t.Errorf("not normalized: %+v", got)
	}
	if want := []string{"Go", "Angular", "PostgreSQL"}; !reflect.DeepEqual(got.Technologies, want) {
		t.Errorf("technologies = %v, want %v", got.Technologies, want)
	}
}

func TestCreateValidation(t *testing.T) {
	svc := NewService(&fakeStore{})
	tests := []struct {
		name      string
		in        Input
		wantField string
	}{
		{"missing title", Input{}, "title"},
		{"bad slug", Input{Title: "X", Slug: "Not A Slug"}, "slug"},
		{"title without usable characters", Input{Title: "!!!"}, "slug"},
		{"bad github url", Input{Title: "X", GitHubURL: "github.com/me"}, "githubUrl"},
		{"javascript url", Input{Title: "X", LiveURL: "javascript:alert(1)"}, "liveUrl"},
		{"negative order", Input{Title: "X", DisplayOrder: -1}, "displayOrder"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.Create(context.Background(), tt.in)
			var verr *validate.Error
			if !errors.As(err, &verr) {
				t.Fatalf("err = %v, want validation error", err)
			}
			if _, ok := verr.Fields[tt.wantField]; !ok {
				t.Errorf("fields = %v, want an error for %q", verr.Fields, tt.wantField)
			}
		})
	}
}

func TestSlugTakenBecomesFieldError(t *testing.T) {
	svc := NewService(&fakeStore{createErr: ErrSlugTaken})
	_, err := svc.Create(context.Background(), Input{Title: "Task Flow"})
	var verr *validate.Error
	if !errors.As(err, &verr) || verr.Fields["slug"] == "" {
		t.Errorf("err = %v, want slug field error", err)
	}
}

func TestSlugify(t *testing.T) {
	tests := map[string]string{
		"My Cool App (v2)!":    "my-cool-app-v2",
		"  --Hello   World-- ": "hello-world",
		"Café Crème":           "caf-cr-me",
		"":                     "",
	}
	for in, want := range tests {
		if got := Slugify(in); got != want {
			t.Errorf("Slugify(%q) = %q, want %q", in, got, want)
		}
	}
}
