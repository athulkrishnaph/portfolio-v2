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
	mux.Handle("POST /api/auth/google", loginLimit(http.HandlerFunc(h.googleLogin)))
	mux.HandleFunc("GET /api/auth/options", h.options)
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

func (h *Handler) googleLogin(w http.ResponseWriter, r *http.Request) {
	var in GoogleLoginInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.InvalidJSON(w, err)
		return
	}
	session, err := h.svc.LoginWithGoogle(r.Context(), in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, session)
}

func (h *Handler) options(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusOK, AuthOptions{GoogleClientID: h.svc.GoogleClientID()})
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
	switch {
	case errors.Is(err, ErrInvalidCredentials):
		httpx.Error(w, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Invalid email or password")
		return
	case errors.Is(err, ErrInvalidGoogleToken):
		httpx.Error(w, http.StatusUnauthorized, "INVALID_GOOGLE_TOKEN", "Google sign-in failed. Please try again.")
		return
	case errors.Is(err, ErrGoogleNotAllowed):
		httpx.Error(w, http.StatusForbidden, "GOOGLE_NOT_ALLOWED", "This Google account is not allowed to sign in here")
		return
	case errors.Is(err, ErrGoogleDisabled):
		httpx.Error(w, http.StatusNotFound, "GOOGLE_DISABLED", "Google sign-in is not enabled")
		return
	}
	httpx.ServiceError(w, r, err)
}
