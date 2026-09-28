package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestChainOrder(t *testing.T) {
	var order []string
	mark := func(name string) Middleware {
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				order = append(order, name)
				next.ServeHTTP(w, r)
			})
		}
	}
	h := Chain(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		order = append(order, "handler")
	}), mark("A"), mark("B"))

	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))

	if got := strings.Join(order, ","); got != "A,B,handler" {
		t.Errorf("order = %s, want A,B,handler", got)
	}
}

func TestRequestID(t *testing.T) {
	var seen string
	h := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = GetRequestID(r.Context())
	}))

	tests := []struct {
		name     string
		incoming string
		wantSame bool
	}{
		{"generated when missing", "", false},
		{"reused when safe", "abc-123_x.y", true},
		{"replaced when unsafe", "bad id\n", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			if tt.incoming != "" {
				req.Header.Set(RequestIDHeader, tt.incoming)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			header := rec.Header().Get(RequestIDHeader)
			if header == "" || header != seen {
				t.Fatalf("header %q and context %q must match and be non-empty", header, seen)
			}
			if (header == tt.incoming) != tt.wantSame {
				t.Errorf("id = %q, incoming = %q, wantSame = %v", header, tt.incoming, tt.wantSame)
			}
		})
	}
}

func TestRecoverReturnsJSON500(t *testing.T) {
	h := Recover(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want 500", rec.Code)
	}
	if body := rec.Body.String(); !strings.Contains(body, `"INTERNAL_ERROR"`) || strings.Contains(body, "boom") {
		t.Errorf("unexpected body: %s", body)
	}
}

func TestStatusRecorder(t *testing.T) {
	rec := &statusRecorder{ResponseWriter: httptest.NewRecorder()}
	if rec.Status() != http.StatusOK {
		t.Errorf("status before writing = %d, want 200", rec.Status())
	}

	rec.WriteHeader(http.StatusTeapot)
	rec.WriteHeader(http.StatusOK) // ignored: the status is already sent
	_, _ = rec.Write([]byte("hello"))

	if rec.Status() != http.StatusTeapot || rec.bytes != 5 {
		t.Errorf("status = %d, bytes = %d; want 418, 5", rec.Status(), rec.bytes)
	}
}

func TestCORS(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := CORS([]string{"http://allowed.test"})(ok)

	t.Run("allowed origin", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/x", nil)
		req.Header.Set("Origin", "http://allowed.test")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://allowed.test" {
			t.Errorf("Allow-Origin = %q", got)
		}
	})

	t.Run("other origin gets no CORS headers", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/x", nil)
		req.Header.Set("Origin", "http://evil.test")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("Allow-Origin = %q, want empty", got)
		}
	})

	t.Run("preflight", func(t *testing.T) {
		req := httptest.NewRequest("OPTIONS", "/api/x", nil)
		req.Header.Set("Origin", "http://allowed.test")
		req.Header.Set("Access-Control-Request-Method", "PUT")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Errorf("status = %d, want 204", rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Headers"); !strings.Contains(got, "Authorization") {
			t.Errorf("Allow-Headers = %q, want Authorization", got)
		}
	})
}
