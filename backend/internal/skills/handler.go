package skills

import (
	"errors"
	"net/http"

	"portfolio/internal/httpx"
	"portfolio/internal/middleware"
)

// Handler exposes the skill endpoints over HTTP.
type Handler struct {
	svc *Service
}

// NewHandler creates a Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Routes registers the endpoints. Reads are public; writes need requireAuth.
func (h *Handler) Routes(mux *http.ServeMux, requireAuth middleware.Middleware) {
	mux.HandleFunc("GET /api/skills", h.list)
	mux.HandleFunc("GET /api/skills/{id}", h.get)
	mux.Handle("POST /api/skills", requireAuth(http.HandlerFunc(h.create)))
	mux.Handle("PUT /api/skills/{id}", requireAuth(http.HandlerFunc(h.update)))
	mux.Handle("DELETE /api/skills/{id}", requireAuth(http.HandlerFunc(h.delete)))
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	list, err := h.svc.List(r.Context())
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, list)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r)
	if err != nil {
		httpx.InvalidID(w, err)
		return
	}
	sk, err := h.svc.Get(r.Context(), id)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, sk)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.InvalidJSON(w, err)
		return
	}
	sk, err := h.svc.Create(r.Context(), in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, sk)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r)
	if err != nil {
		httpx.InvalidID(w, err)
		return
	}
	var in Input
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.InvalidJSON(w, err)
		return
	}
	sk, err := h.svc.Update(r.Context(), id, in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, sk)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r)
	if err != nil {
		httpx.InvalidID(w, err)
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.NoContent(w)
}

func (h *Handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, ErrNotFound) {
		httpx.Error(w, http.StatusNotFound, "SKILL_NOT_FOUND", "Skill not found")
		return
	}
	httpx.ServiceError(w, r, err)
}
