package middleware

import (
	"net/http"
	"slices"
)

// CORS allows browsers on the given origins to call the API from another
// origin (e.g. an Angular app on a different domain in production). In local
// development the Angular dev proxy makes requests same-origin, so CORS is
// not involved there.
//
// A single "*" in allowedOrigins allows every origin. Credentials (cookies)
// are not allowed: the API authenticates with a bearer token header instead.
func CORS(allowedOrigins []string) Middleware {
	allowAll := slices.Contains(allowedOrigins, "*")

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			// The response differs per Origin, so caches must key on it.
			w.Header().Add("Vary", "Origin")

			if origin == "" || !(allowAll || slices.Contains(allowedOrigins, origin)) {
				next.ServeHTTP(w, r)
				return
			}

			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Expose-Headers", RequestIDHeader)

			// Preflight: the browser asks which methods/headers are allowed
			// before sending the real request.
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, "+RequestIDHeader)
				h.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
