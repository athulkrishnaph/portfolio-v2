package profile

import (
	"context"
	"fmt"
	"strings"

	"portfolio/internal/validate"
)

// store is the part of Repository the service needs (a fake in tests).
type store interface {
	Get(ctx context.Context) (Profile, error)
	Save(ctx context.Context, in Input) (Profile, error)
}

// Service contains the profile business rules.
type Service struct {
	store store
}

// NewService creates a Service.
func NewService(store store) *Service {
	return &Service{store: store}
}

func (s *Service) Get(ctx context.Context) (Profile, error) {
	return s.store.Get(ctx)
}

func (s *Service) Save(ctx context.Context, in Input) (Profile, error) {
	in, err := normalizeAndValidate(in)
	if err != nil {
		return Profile{}, err
	}
	return s.store.Save(ctx, in)
}

const maxSocialLinks = 20

func normalizeAndValidate(in Input) (Input, error) {
	in.FullName = strings.TrimSpace(in.FullName)
	in.Headline = strings.TrimSpace(in.Headline)
	in.Bio = strings.TrimSpace(in.Bio)
	in.Email = strings.TrimSpace(in.Email)
	in.Location = strings.TrimSpace(in.Location)
	in.ImageURL = strings.TrimSpace(in.ImageURL)
	in.ResumeURL = strings.TrimSpace(in.ResumeURL)

	v := validate.New()
	v.Required("fullName", "Name", in.FullName)
	v.MaxLength("fullName", "Name", in.FullName, 100)
	v.MaxLength("headline", "Headline", in.Headline, 150)
	v.MaxLength("bio", "Bio", in.Bio, 5_000)
	v.Check(in.Email == "" || validate.IsEmail(in.Email), "email", "Email must be a valid email address")
	v.MaxLength("email", "Email", in.Email, 254)
	v.MaxLength("location", "Location", in.Location, 100)
	v.OptionalURL("imageUrl", "Image URL", in.ImageURL)
	v.OptionalURL("resumeUrl", "Resume URL", in.ResumeURL)

	v.Check(len(in.SocialLinks) <= maxSocialLinks, "socialLinks",
		fmt.Sprintf("At most %d social links are allowed", maxSocialLinks))
	links := make([]SocialLink, 0, len(in.SocialLinks))
	seen := map[string]bool{}
	for i, l := range in.SocialLinks {
		l.Platform = strings.TrimSpace(l.Platform)
		l.URL = strings.TrimSpace(l.URL)
		// Field keys like "socialLinks.2.url" let the form highlight the right row.
		prefix := fmt.Sprintf("socialLinks.%d.", i)
		v.Required(prefix+"platform", "Platform", l.Platform)
		v.MaxLength(prefix+"platform", "Platform", l.Platform, 50)
		v.Check(!seen[strings.ToLower(l.Platform)], prefix+"platform", "Each platform can only be listed once")
		v.Required(prefix+"url", "URL", l.URL)
		v.OptionalURL(prefix+"url", "URL", l.URL)
		seen[strings.ToLower(l.Platform)] = true
		links = append(links, l)
	}
	in.SocialLinks = links
	return in, v.Err()
}
