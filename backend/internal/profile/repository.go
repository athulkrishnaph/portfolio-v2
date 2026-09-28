package profile

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository reads and writes the profile and social_links tables.
// The profile table holds at most one row, always with id = 1.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a Repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

const profileID = 1

// Get returns the profile with its social links, or ErrNotFound if it has
// not been created yet.
func (r *Repository) Get(ctx context.Context) (Profile, error) {
	rows, _ := r.db.Query(ctx, `
		SELECT full_name, headline, bio, email, location, image_url, resume_url, updated_at
		FROM profile WHERE id = $1`, profileID)
	p, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[Profile])
	if errors.Is(err, pgx.ErrNoRows) {
		return Profile{}, ErrNotFound
	}
	if err != nil {
		return Profile{}, fmt.Errorf("get profile: %w", err)
	}

	rows, _ = r.db.Query(ctx, `
		SELECT platform, url FROM social_links
		WHERE profile_id = $1
		ORDER BY display_order, id`, profileID)
	p.SocialLinks, err = pgx.CollectRows(rows, pgx.RowToStructByName[SocialLink])
	if err != nil {
		return Profile{}, fmt.Errorf("get social links: %w", err)
	}
	return p, nil
}

// Save creates or updates the profile ("upsert") and replaces its social
// links, all in one transaction.
func (r *Repository) Save(ctx context.Context, in Input) (Profile, error) {
	platforms := make([]string, len(in.SocialLinks))
	urls := make([]string, len(in.SocialLinks))
	for i, l := range in.SocialLinks {
		platforms[i], urls[i] = l.Platform, l.URL
	}

	err := pgx.BeginFunc(ctx, r.db, func(tx pgx.Tx) error {
		// ON CONFLICT turns the INSERT into an UPDATE when the row exists.
		// EXCLUDED refers to the values we tried to insert.
		_, err := tx.Exec(ctx, `
			INSERT INTO profile (id, full_name, headline, bio, email, location, image_url, resume_url)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (id) DO UPDATE SET
				full_name  = EXCLUDED.full_name,
				headline   = EXCLUDED.headline,
				bio        = EXCLUDED.bio,
				email      = EXCLUDED.email,
				location   = EXCLUDED.location,
				image_url  = EXCLUDED.image_url,
				resume_url = EXCLUDED.resume_url`,
			profileID, in.FullName, in.Headline, in.Bio, in.Email, in.Location, in.ImageURL, in.ResumeURL)
		if err != nil {
			return err
		}

		if _, err := tx.Exec(ctx, `DELETE FROM social_links WHERE profile_id = $1`, profileID); err != nil {
			return err
		}
		// unnest with two arrays walks them side by side, producing
		// (platform, url, position) rows.
		_, err = tx.Exec(ctx, `
			INSERT INTO social_links (profile_id, platform, url, display_order)
			SELECT $1, l.platform, l.url, l.ord
			FROM unnest($2::text[], $3::text[]) WITH ORDINALITY AS l(platform, url, ord)`,
			profileID, platforms, urls)
		return err
	})
	if err != nil {
		return Profile{}, fmt.Errorf("save profile: %w", err)
	}
	return r.Get(ctx)
}
