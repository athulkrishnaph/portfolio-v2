package auth

import (
	"errors"
	"net/http"

	"portfolio/internal/httpx"
	"portfolio/internal/middleware"
)

// Handler exposes the auth endpoints over HTTP.
type Handler struct {
	svc *Service
}

// NewHandler creates a Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Routes registers the auth endpoints. loginLimit throttles login attempts
// to slow down password guessing.
func (h *Handler) Routes(mux *http.ServeMux, loginLimit middleware.Middleware) {
	mux.Handle("POST /api/auth/login", loginLimit(http.HandlerFunc(h.login)))
	mux.Handle("GET /api/auth/me", h.svc.RequireAuth(http.HandlerFunc(h.me)))
	mux.Handle("PUT /api/auth/password", h.svc.RequireAuth(http.HandlerFunc(h.changePassword)))
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var in LoginInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.InvalidJSON(w, err)
		return
	}
	session, err := h.svc.Login(r.Context(), in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, session)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	user, _ := UserFromContext(r.Context())
	httpx.JSON(w, http.StatusOK, user)
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	var in ChangePasswordInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.InvalidJSON(w, err)
		return
	}
	user, _ := UserFromContext(r.Context())
	session, err := h.svc.ChangePassword(r.Context(), user, in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, session)
}

// fail maps service errors to HTTP responses.
func (h *Handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, ErrInvalidCredentials) {
		httpx.Error(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password")
		return
	}
	httpx.ServiceError(w, r, err)
}
