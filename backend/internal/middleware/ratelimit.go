package middleware

import (
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"portfolio/internal/httpx"
)

// RateLimit allows at most limit requests per client IP in each window
// (a "fixed window" limiter). Extra requests get 429 Too Many Requests.
//
// Counters live in memory, so they reset on restart and are not shared
// between several API instances. That is fine for a single-server portfolio.
func RateLimit(limit int, window time.Duration, clientIP func(*http.Request) string) Middleware {
	l := &limiter{limit: limit, window: window, now: time.Now, clients: map[string]*windowCount{}}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if retryAfter, ok := l.allow(clientIP(r)); !ok {
				seconds := int(math.Ceil(retryAfter.Seconds()))
				w.Header().Set("Retry-After", strconv.Itoa(seconds))
				httpx.Error(w, http.StatusTooManyRequests, "TOO_MANY_REQUESTS",
					"Too many attempts. Please try again later.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type windowCount struct {
	start time.Time
	count int
}

type limiter struct {
	mu        sync.Mutex
	limit     int
	window    time.Duration
	now       func() time.Time
	clients   map[string]*windowCount
	lastSweep time.Time
}

// allow records one request for key. If the limit is exceeded it returns
// false and how long until the window resets.
func (l *limiter) allow(key string) (time.Duration, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	l.sweep(now)

	c, ok := l.clients[key]
	if !ok || now.Sub(c.start) >= l.window {
		c = &windowCount{start: now}
		l.clients[key] = c
	}
	c.count++
	if c.count > l.limit {
		return c.start.Add(l.window).Sub(now), false
	}
	return 0, true
}

// sweep drops expired entries once per window so the map cannot grow forever.
func (l *limiter) sweep(now time.Time) {
	if now.Sub(l.lastSweep) < l.window {
		return
	}
	for key, c := range l.clients {
		if now.Sub(c.start) >= l.window {
			delete(l.clients, key)
		}
	}
	l.lastSweep = now
}

// ClientIP returns a function that finds the client's IP address.
//
// With trustProxy=false it uses the TCP peer address. Set trustProxy=true
// only when the API runs behind a reverse proxy you control (nginx, a load
// balancer, ...), because clients can put anything in X-Forwarded-For.
func ClientIP(trustProxy bool) func(*http.Request) string {
	return func(r *http.Request) string {
		if trustProxy {
			if ip := r.Header.Get("X-Real-IP"); ip != "" {
				return strings.TrimSpace(ip)
			}
			if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
				// The first entry is the original client.
				first, _, _ := strings.Cut(fwd, ",")
				return strings.TrimSpace(first)
			}
		}
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			return r.RemoteAddr
		}
		return host
	}
}
