package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"portfolio/internal/httpx"
)

type userKey struct{}

// RequireAuth rejects requests without a valid "Authorization: Bearer <token>"
// header with 401. On success, the authenticated user is stored in the
// request context (read it with UserFromContext).
func (s *Service) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearerToken(r)
		if !ok {
			httpx.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "Authentication required")
			return
		}
		user, err := s.Authenticate(r.Context(), token)
		if errors.Is(err, ErrInvalidToken) {
			httpx.Error(w, http.StatusUnauthorized, "INVALID_TOKEN", "Your session has expired, please log in again")
			return
		}
		if err != nil {
			httpx.InternalError(w, r, err)
			return
		}
		ctx := context.WithValue(r.Context(), userKey{}, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// UserFromContext returns the user stored by RequireAuth.
func UserFromContext(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(userKey{}).(User)
	return u, ok
}

func bearerToken(r *http.Request) (string, bool) {
	scheme, token, ok := strings.Cut(r.Header.Get("Authorization"), " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") || strings.TrimSpace(token) == "" {
		return "", false
	}
	return strings.TrimSpace(token), true
}
