package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

// Supabase stores files in a public Supabase Storage bucket, so they survive
// server restarts and redeploys on hosts without a persistent disk.
type Supabase struct {
	projectURL string // e.g. "https://abcd.supabase.co"
	bucket     string
	serviceKey string
	client     *http.Client
}

// NewSupabase returns a Supabase storage. The bucket must already exist and
// be public; serviceKey is the project's service_role key (server-side only).
func NewSupabase(projectURL, bucket, serviceKey string) *Supabase {
	return &Supabase{
		projectURL: strings.TrimRight(projectURL, "/"),
		bucket:     bucket,
		serviceKey: serviceKey,
		client:     &http.Client{Timeout: 30 * time.Second},
	}
}

// Save uploads the file and returns its public URL.
func (s *Supabase) Save(ctx context.Context, name, contentType string, content io.Reader) (string, error) {
	if name != filepath.Base(name) || strings.HasPrefix(name, ".") {
		return "", errors.New("storage: invalid file name")
	}
	object := url.PathEscape(s.bucket) + "/" + url.PathEscape(name)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.projectURL+"/storage/v1/object/"+object, content)
	if err != nil {
		return "", fmt.Errorf("storage: build upload request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("apikey", s.serviceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Cache-Control", "max-age=31536000")
	// Never overwrite an existing file.
	req.Header.Set("x-upsert", "false")

	res, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("storage: upload: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return "", fmt.Errorf("storage: upload failed: HTTP %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	return s.projectURL + "/storage/v1/object/public/" + object, nil
}
