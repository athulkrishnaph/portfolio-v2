package server

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"portfolio/internal/config"
)

func TestSPAHandler(t *testing.T) {
	dir := t.TempDir()
	must(t, os.WriteFile(filepath.Join(dir, "index.html"), []byte("<app-root>"), 0o644))
	must(t, os.WriteFile(filepath.Join(dir, "main-ABCD1234.js"), []byte("js"), 0o644))

	h := New(Deps{Config: &config.Config{StaticDir: dir}})

	tests := []struct {
		path        string
		wantStatus  int
		wantBody    string
		wantCaching string
	}{
		{"/", 200, "<app-root>", "no-cache"},
		{"/projects/task-flow", 200, "<app-root>", "no-cache"}, // deep link → index.html
		{"/admin/login", 200, "<app-root>", "no-cache"},
		{"/main-ABCD1234.js", 200, "js", "immutable"},
		{"/api/unknown", 404, `"NOT_FOUND"`, ""}, // API paths never get index.html
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest("GET", tt.path, nil))
			if rec.Code != tt.wantStatus || !strings.Contains(rec.Body.String(), tt.wantBody) {
				t.Errorf("got %d %q, want %d containing %q", rec.Code, rec.Body.String(), tt.wantStatus, tt.wantBody)
			}
			if !strings.Contains(rec.Header().Get("Cache-Control"), tt.wantCaching) {
				t.Errorf("Cache-Control = %q, want %q", rec.Header().Get("Cache-Control"), tt.wantCaching)
			}
		})
	}
}

func TestSecurityHeadersPresent(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestHandler().ServeHTTP(rec, httptest.NewRequest("GET", "/api/nope", nil))
	for _, h := range []string{"X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"} {
		if rec.Header().Get(h) == "" {
			t.Errorf("missing %s header", h)
		}
	}
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
