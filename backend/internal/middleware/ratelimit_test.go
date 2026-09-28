package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestLimiter(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	l := &limiter{limit: 2, window: time.Minute, now: func() time.Time { return now }, clients: map[string]*windowCount{}}

	for i := 1; i <= 2; i++ {
		if _, ok := l.allow("1.2.3.4"); !ok {
			t.Fatalf("request %d should be allowed", i)
		}
	}
	retry, ok := l.allow("1.2.3.4")
	if ok || retry != time.Minute {
		t.Fatalf("3rd request: ok=%v retry=%v, want blocked for 1m", ok, retry)
	}
	if _, ok := l.allow("5.6.7.8"); !ok {
		t.Error("other clients must not be affected")
	}

	now = now.Add(time.Minute) // new window
	if _, ok := l.allow("1.2.3.4"); !ok {
		t.Error("request in a new window should be allowed")
	}
}

func TestRateLimitResponds429(t *testing.T) {
	h := RateLimit(1, time.Minute, ClientIP(false))(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	codes := make([]int, 2)
	for i := range codes {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/auth/login", nil))
		codes[i] = rec.Code
		if i == 1 && rec.Header().Get("Retry-After") == "" {
			t.Error("missing Retry-After header")
		}
	}
	if codes[0] != http.StatusOK || codes[1] != http.StatusTooManyRequests {
		t.Errorf("codes = %v, want [200 429]", codes)
	}
}

func TestClientIP(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.RemoteAddr = "10.0.0.1:5555"
	req.Header.Set("X-Forwarded-For", "203.0.113.9, 10.0.0.1")

	if got := ClientIP(false)(req); got != "10.0.0.1" {
		t.Errorf("untrusted: got %s, want 10.0.0.1 (headers must be ignored)", got)
	}
	if got := ClientIP(true)(req); got != "203.0.113.9" {
		t.Errorf("trusted: got %s, want 203.0.113.9", got)
	}
}
