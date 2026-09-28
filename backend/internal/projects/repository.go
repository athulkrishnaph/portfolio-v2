package projects

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"portfolio/internal/database"
)

// Repository reads and writes the projects and project_technologies tables.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// selectProjects loads projects together with their technologies.
// The LEFT JOIN keeps projects without technologies; array_agg collects the
// technology names into one array per project, in display order.
// FILTER drops the NULL row that LEFT JOIN produces for such projects.
const selectProjects = `
	SELECT p.id, p.title, p.slug, p.summary, p.description,
	       p.github_url, p.live_url, p.image_url, p.is_featured, p.display_order,
	       p.created_at, p.updated_at,
	       COALESCE(
	           array_agg(t.name ORDER BY t.display_order, t.id) FILTER (WHERE t.id IS NOT NULL),
	           '{}'
	       ) AS technologies
	FROM projects p
	LEFT JOIN project_technologies t ON t.project_id = p.id`

// List returns all projects (or only featured ones) in display order.
func (r *Repository) List(ctx context.Context, featuredOnly bool) ([]Project, error) {
	rows, _ := r.db.Query(ctx, selectProjects+`
		WHERE $1 = false OR p.is_featured
		GROUP BY p.id
		ORDER BY p.display_order, p.id`, featuredOnly)
	projects, err := pgx.CollectRows(rows, pgx.RowToStructByName[Project])
	if err != nil {
		return nil, fmt.Errorf("list projects: %w", err)
	}
	return projects, nil
}

// GetByID returns one project or ErrNotFound.
func (r *Repository) GetByID(ctx context.Context, id int64) (Project, error) {
	return r.getOne(ctx, `WHERE p.id = $1`, id)
}

// GetBySlug returns one project or ErrNotFound.
func (r *Repository) GetBySlug(ctx context.Context, slug string) (Project, error) {
	return r.getOne(ctx, `WHERE p.slug = $1`, slug)
}

func (r *Repository) getOne(ctx context.Context, where string, arg any) (Project, error) {
	rows, _ := r.db.Query(ctx, selectProjects+" "+where+" GROUP BY p.id", arg)
	p, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Project])
	if errors.Is(err, pgx.ErrNoRows) {
		return Project{}, ErrNotFound
	}
	if err != nil {
		return Project{}, fmt.Errorf("get project: %w", err)
	}
	return p, nil
}

// Create inserts a project and its technologies in one transaction.
func (r *Repository) Create(ctx context.Context, in Input) (Project, error) {
	var id int64
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		err := tx.QueryRow(ctx, `
			INSERT INTO projects (title, slug, summary, description, github_url, live_url,
			                      image_url, is_featured, display_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id`,
			in.Title, in.Slug, in.Summary, in.Description, in.GitHubURL, in.LiveURL,
			in.ImageURL, in.IsFeatured, in.DisplayOrder,
		).Scan(&id)
		if err != nil {
			return err
		}
		return insertTechnologies(ctx, tx, id, in.Technologies)
	})
	if err != nil {
		return Project{}, mapWriteError("create project", err)
	}
	return r.GetByID(ctx, id)
}

// Update replaces a project's fields and its technology list.
func (r *Repository) Update(ctx context.Context, id int64, in Input) (Project, error) {
	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `
			UPDATE projects
			SET title = $2, slug = $3, summary = $4, description = $5, github_url = $6,
			    live_url = $7, image_url = $8, is_featured = $9, display_order = $10
			WHERE id = $1`,
			id, in.Title, in.Slug, in.Summary, in.Description, in.GitHubURL,
			in.LiveURL, in.ImageURL, in.IsFeatured, in.DisplayOrder)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		// Replacing the whole list is simpler than diffing old and new names.
		if _, err := tx.Exec(ctx, `DELETE FROM project_technologies WHERE project_id = $1`, id); err != nil {
			return err
		}
		return insertTechnologies(ctx, tx, id, in.Technologies)
	})
	if err != nil {
		return Project{}, mapWriteError("update project", err)
	}
	return r.GetByID(ctx, id)
}

// Delete removes a project. Its technologies are removed by ON DELETE CASCADE.
func (r *Repository) Delete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM projects WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete project: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// insertTechnologies inserts all names in one statement. unnest turns the
// array into rows; WITH ORDINALITY numbers them (1, 2, 3...) for display_order.
func insertTechnologies(ctx context.Context, tx pgx.Tx, projectID int64, names []string) error {
	if len(names) == 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO project_technologies (project_id, name, display_order)
		SELECT $1, t.name, t.ord
		FROM unnest($2::text[]) WITH ORDINALITY AS t(name, ord)`,
		projectID, names)
	return err
}

func mapWriteError(op string, err error) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return ErrNotFound
	case database.IsUniqueViolation(err, "projects_slug_key"):
		return ErrSlugTaken
	default:
		return fmt.Errorf("%s: %w", op, err)
	}
}
