package projects

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"portfolio/internal/testdb"
)

func TestRepository(t *testing.T) {
	repo := NewRepository(testdb.New(t))
	ctx := context.Background()

	a, err := repo.Create(ctx, Input{Title: "Alpha", Slug: "alpha", DisplayOrder: 2, Technologies: []string{"Go", "SQL"}})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !reflect.DeepEqual(a.Technologies, []string{"Go", "SQL"}) {
		t.Errorf("technologies = %v, want [Go SQL] in the given order", a.Technologies)
	}
	b, err := repo.Create(ctx, Input{Title: "Beta", Slug: "beta", DisplayOrder: 1, IsFeatured: true})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	t.Run("list is sorted by display order; projects without technologies get []", func(t *testing.T) {
		list, err := repo.List(ctx, false)
		if err != nil {
			t.Fatal(err)
		}
		if len(list) != 2 || list[0].ID != b.ID || list[1].ID != a.ID {
			t.Fatalf("unexpected order: %+v", list)
		}
		if list[0].Technologies == nil || len(list[0].Technologies) != 0 {
			t.Errorf("want empty (non-nil) technologies, got %#v", list[0].Technologies)
		}
	})

	t.Run("featured filter", func(t *testing.T) {
		list, _ := repo.List(ctx, true)
		if len(list) != 1 || list[0].Slug != "beta" {
			t.Errorf("featured = %+v", list)
		}
	})

	t.Run("duplicate slug", func(t *testing.T) {
		_, err := repo.Create(ctx, Input{Title: "Other", Slug: "alpha"})
		if !errors.Is(err, ErrSlugTaken) {
			t.Errorf("err = %v, want ErrSlugTaken", err)
		}
	})

	t.Run("update replaces technologies", func(t *testing.T) {
		got, err := repo.Update(ctx, a.ID, Input{Title: "Alpha 2", Slug: "alpha", Technologies: []string{"Rust"}})
		if err != nil {
			t.Fatal(err)
		}
		if got.Title != "Alpha 2" || !reflect.DeepEqual(got.Technologies, []string{"Rust"}) {
			t.Errorf("got %+v", got)
		}
		if !got.UpdatedAt.After(got.CreatedAt) {
			t.Error("updated_at trigger did not run")
		}
	})

	t.Run("get by slug and not found", func(t *testing.T) {
		if p, err := repo.GetBySlug(ctx, "beta"); err != nil || p.ID != b.ID {
			t.Errorf("GetBySlug = %+v, %v", p, err)
		}
		if _, err := repo.GetByID(ctx, 999999); !errors.Is(err, ErrNotFound) {
			t.Errorf("err = %v, want ErrNotFound", err)
		}
		if _, err := repo.Update(ctx, 999999, Input{Title: "x", Slug: "x"}); !errors.Is(err, ErrNotFound) {
			t.Errorf("update err = %v, want ErrNotFound", err)
		}
	})

	t.Run("delete cascades to technologies", func(t *testing.T) {
		if err := repo.Delete(ctx, a.ID); err != nil {
			t.Fatal(err)
		}
		if err := repo.Delete(ctx, a.ID); !errors.Is(err, ErrNotFound) {
			t.Errorf("second delete err = %v, want ErrNotFound", err)
		}
		var n int
		if err := repo.db.QueryRow(ctx, `SELECT count(*) FROM project_technologies WHERE project_id = $1`, a.ID).Scan(&n); err != nil || n != 0 {
			t.Errorf("orphaned technologies: %d (%v)", n, err)
		}
	})
}
