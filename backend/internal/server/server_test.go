package server

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"portfolio/internal/config"
)

// newTestHandler builds the full handler without a database. Tests must not
// call routes that use the database.
func newTestHandler() http.Handler {
	return New(Deps{Config: &config.Config{CORSAllowedOrigins: []string{"http://localhost:4200"}}})
}

func TestUnknownRouteReturnsJSON404(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestHandler().ServeHTTP(rec, httptest.NewRequest("GET", "/api/does-not-exist", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type = %q, want JSON", ct)
	}
	if !strings.Contains(rec.Body.String(), `"NOT_FOUND"`) {
		t.Errorf("body = %s", rec.Body.String())
	}
	if rec.Header().Get("X-Request-ID") == "" {
		t.Error("missing X-Request-ID header")
	}
}

func TestWrongMethodReturnsJSON405(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestHandler().ServeHTTP(rec, httptest.NewRequest("DELETE", "/api/health", nil))

	if rec.Code != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"METHOD_NOT_ALLOWED"`) {
		t.Errorf("body = %s", rec.Body.String())
	}
	if allow := rec.Header().Get("Allow"); !strings.Contains(allow, "GET") {
		t.Errorf("Allow = %q, want it to list GET", allow)
	}
}

type fakePinger struct{ err error }

func (f fakePinger) Ping(context.Context) error { return f.err }

func TestHealthHandler(t *testing.T) {
	tests := []struct {
		name       string
		pingErr    error
		wantStatus int
		wantBody   string
	}{
		{"database up", nil, http.StatusOK, `{"data":{"status":"ok"}}`},
		{"database down", errors.New("connection refused"), http.StatusServiceUnavailable, `"DATABASE_UNAVAILABLE"`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			healthHandler(fakePinger{tt.pingErr}).ServeHTTP(rec, httptest.NewRequest("GET", "/api/health", nil))

			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			body := rec.Body.String()
			if !strings.Contains(body, tt.wantBody) {
				t.Errorf("body = %s, want it to contain %s", body, tt.wantBody)
			}
			if strings.Contains(body, "connection refused") {
				t.Error("internal error leaked to client")
			}
		})
	}
}
