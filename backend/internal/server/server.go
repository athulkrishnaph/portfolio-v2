// Package server wires routes, middleware and shared dependencies into the
// single http.Handler served by cmd/api.
package server

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"portfolio/internal/auth"
	"portfolio/internal/certificates"
	"portfolio/internal/config"
	"portfolio/internal/education"
	"portfolio/internal/experience"
	"portfolio/internal/httpx"
	"portfolio/internal/middleware"
	"portfolio/internal/profile"
	"portfolio/internal/projects"
	"portfolio/internal/skills"
	"portfolio/internal/storage"
	"portfolio/internal/uploads"
)

// Deps are the shared dependencies that feature packages are built from.
type Deps struct {
	Config  *config.Config
	DB      *pgxpool.Pool
	Storage storage.Storage
}

// New returns the API's root handler.
func New(deps Deps) http.Handler {
	mux := http.NewServeMux()
	registerRoutes(mux, deps)

	// Order matters: RequestID runs first so every later step (including the
	// access log and panic log) can see the ID. Recover sits inside Logger so
	// a recovered panic is logged with its 500 status.
	return middleware.Chain(jsonFallback(mux),
		middleware.RequestID,
		middleware.Logger,
		middleware.Recover,
		middleware.SecurityHeaders,
		middleware.CORS(deps.Config.CORSAllowedOrigins),
	)
}

// Login attempts allowed per client IP in each window.
const (
	loginAttemptLimit  = 10
	loginAttemptWindow = 15 * time.Minute
)

// registerRoutes is the one place where every feature is wired together
// (repository → service → handler) and its endpoints are registered.
func registerRoutes(mux *http.ServeMux, deps Deps) {
	cfg, db := deps.Config, deps.DB

	mux.Handle("GET /api/health", healthHandler(db))

	tokens := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTTTL)
	authSvc := auth.NewService(auth.NewRepository(db), tokens)
	loginLimit := middleware.RateLimit(loginAttemptLimit, loginAttemptWindow, middleware.ClientIP(cfg.TrustProxy))
	auth.NewHandler(authSvc).Routes(mux, loginLimit)

	// Content features: public GET endpoints, admin-only writes.
	requireAuth := authSvc.RequireAuth
	projects.NewHandler(projects.NewService(projects.NewRepository(db))).Routes(mux, requireAuth)
	certificates.NewHandler(certificates.NewService(certificates.NewRepository(db))).Routes(mux, requireAuth)
	experience.NewHandler(experience.NewService(experience.NewRepository(db))).Routes(mux, requireAuth)
	education.NewHandler(education.NewService(education.NewRepository(db))).Routes(mux, requireAuth)
	skills.NewHandler(skills.NewService(skills.NewRepository(db))).Routes(mux, requireAuth)
	profile.NewHandler(profile.NewService(profile.NewRepository(db))).Routes(mux, requireAuth)

	// File uploads. Storage that serves its own files (local disk) is
	// mounted under /uploads/; cloud storage would serve from its own URL.
	uploads.NewHandler(deps.Storage).Routes(mux, requireAuth)
	if fs, ok := deps.Storage.(interface{ Handler() http.Handler }); ok {
		mux.Handle("GET "+storage.PublicPath, fs.Handler())
	}

	// Portfolio chatbot (RAG + Gemini), see chat.go. Optional: it reports
	// itself as disabled when GEMINI_API_KEY is not set.
	registerChat(mux, deps, requireAuth)

	// Production: also serve the built Angular app (see static.go).
	if cfg.StaticDir != "" {
		mux.Handle("GET /", spaHandler(cfg.StaticDir))
	}
}

// pinger is the part of *pgxpool.Pool the health check needs; a small
// interface keeps the handler easy to test.
type pinger interface {
	Ping(ctx context.Context) error
}

// healthHandler reports whether the API and its database are reachable.
// Useful for uptime monitors and container health checks.
func healthHandler(db pinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			// The cause is logged, but not returned to the client.
			httpx.LogError(r, "health check: database ping failed", err)
			httpx.Error(w, http.StatusServiceUnavailable, "DATABASE_UNAVAILABLE", "Database is unavailable")
			return
		}
		httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}

// jsonFallback replaces net/http's plain-text "404 page not found" and
// "405 method not allowed" responses with the API's JSON error format.
func jsonFallback(mux *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// A non-empty pattern means a route matched (or the mux wants to
		// redirect, e.g. to add a trailing slash): let the mux handle it.
		if _, pattern := mux.Handler(r); pattern != "" {
			mux.ServeHTTP(w, r)
			return
		}

		// No route matched. Run the mux's own fallback against a throwaway
		// body to learn whether it is a 404 or a 405. The shared header map
		// keeps the "Allow" header the mux sets for 405 responses.
		probe := &statusProbe{header: w.Header()}
		mux.ServeHTTP(probe, r)

		if probe.status == http.StatusMethodNotAllowed {
			httpx.Error(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Method not allowed")
			return
		}
		httpx.Error(w, http.StatusNotFound, "NOT_FOUND", "Resource not found")
	})
}

// statusProbe is a ResponseWriter that records the status code and discards the body.
type statusProbe struct {
	header http.Header
	status int
}

func (p *statusProbe) Header() http.Header         { return p.header }
func (p *statusProbe) WriteHeader(status int)      { p.status = status }
func (p *statusProbe) Write(b []byte) (int, error) { return io.Discard.Write(b) }
