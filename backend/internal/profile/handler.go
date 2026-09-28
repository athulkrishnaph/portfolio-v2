package profile

import (
	"errors"
	"net/http"

	"portfolio/internal/httpx"
	"portfolio/internal/middleware"
)

// Handler exposes the profile endpoints over HTTP.
type Handler struct {
	svc *Service
}

// NewHandler creates a Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Routes registers the endpoints. Reading is public; saving needs requireAuth.
func (h *Handler) Routes(mux *http.ServeMux, requireAuth middleware.Middleware) {
	mux.HandleFunc("GET /api/profile", h.get)
	mux.Handle("PUT /api/profile", requireAuth(http.HandlerFunc(h.save)))
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.Get(r.Context())
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) save(w http.ResponseWriter, r *http.Request) {
	var in Input
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.InvalidJSON(w, err)
		return
	}
	p, err := h.svc.Save(r.Context(), in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, "PROFILE_NOT_FOUND", "The profile has not been set up yet")
		return
	}
	httpx.ServiceError(w, r, err)
}
