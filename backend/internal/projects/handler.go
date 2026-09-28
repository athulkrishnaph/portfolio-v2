package projects

import (
	"errors"
	"net/http"

	"portfolio/internal/httpx"
	"portfolio/internal/middleware"
)

// Handler exposes the project endpoints over HTTP.
type Handler struct {
	svc *Service
}

// NewHandler creates a Handler.
func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// Routes registers the endpoints. Reads are public; writes need requireAuth.
func (h *Handler) Routes(mux *http.ServeMux, requireAuth middleware.Middleware) {
	mux.HandleFunc("GET /api/projects", h.list)
	mux.HandleFunc("GET /api/projects/{id}", h.get)
	mux.HandleFunc("GET /api/projects/slug/{slug}", h.getBySlug)
	mux.Handle("POST /api/projects", requireAuth(http.HandlerFunc(h.create)))
	mux.Handle("PUT /api/projects/{id}", requireAuth(http.HandlerFunc(h.update)))
	mux.Handle("DELETE /api/projects/{id}", requireAuth(http.HandlerFunc(h.delete)))
}

// list handles GET /api/projects and GET /api/projects?featured=true.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	featuredOnly := r.URL.Query().Get("featured") == "true"
	projects, err := h.svc.List(r.Context(), featuredOnly)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, projects)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r)
	if err != nil {
		httpx.InvalidID(w, err)
		return
	}
	p, err := h.svc.Get(r.Context(), id)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) getBySlug(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.GetBySlug(r.Context(), r.PathValue("slug"))
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var in Input
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		httpx.InvalidJSON(w, err)
		return
	}
	p, err := h.svc.Create(r.Context(), in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, p)
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
	p, err := h.svc.Update(r.Context(), id, in)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, p)
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
		httpx.Error(w, http.StatusNotFound, "PROJECT_NOT_FOUND", "Project not found")
		return
	}
	httpx.ServiceError(w, r, err)
}
