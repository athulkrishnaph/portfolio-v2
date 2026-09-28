package chat

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"portfolio/internal/gemini"
	"portfolio/internal/httpx"
	"portfolio/internal/middleware"
	"portfolio/internal/rag"
	"portfolio/internal/validate"
)

// Time limits. Free-tier Gemini latency varies a lot (measured: 1.5 s to
// 30 s for the same prompt), so these are generous, and both chat endpoints
// extend the server's default 30 s WriteTimeout for their own response.
const (
	askTimeout      = 50 * time.Second
	streamTimeout   = 60 * time.Second
	reindexTimeout  = 3 * time.Minute
	maxRequestBytes = 32 << 10 // a question plus a short history
)

// Indexer rebuilds the knowledge base (implemented by *rag.Indexer).
type Indexer interface {
	Run(ctx context.Context, full bool) (rag.Report, error)
}

// StatsReader reports on the knowledge base (implemented by *rag.Store).
type StatsReader interface {
	Stats(ctx context.Context) (rag.Stats, error)
}

// Handler exposes the chatbot over HTTP. When the chatbot is not configured
// (no GEMINI_API_KEY, pgvector missing, …) svc is nil and every endpoint
// reports that it is disabled; the rest of the site is unaffected.
type Handler struct {
	svc            *Service
	indexer        Indexer
	stats          StatsReader
	disabledReason string
	models         map[string]string
}

// NewHandler creates an enabled Handler.
func NewHandler(svc *Service, indexer Indexer, stats StatsReader, model, embeddingModel string) *Handler {
	return &Handler{
		svc: svc, indexer: indexer, stats: stats,
		models: map[string]string{"model": model, "embeddingModel": embeddingModel},
	}
}

// NewDisabledHandler creates a Handler that reports why the chatbot is off.
// The reason is shown to the admin only, never to visitors.
func NewDisabledHandler(reason string) *Handler {
	return &Handler{disabledReason: reason}
}

// Routes registers the endpoints. Questions are public but rate limited;
// knowledge management needs an admin session.
func (h *Handler) Routes(mux *http.ServeMux, requireAuth, limit middleware.Middleware) {
	mux.HandleFunc("GET /api/chat/status", h.status)
	mux.Handle("POST /api/chat", limit(http.HandlerFunc(h.ask)))
	mux.Handle("POST /api/chat/stream", limit(http.HandlerFunc(h.stream)))
	mux.Handle("GET /api/chat/knowledge", requireAuth(http.HandlerFunc(h.knowledge)))
	mux.Handle("POST /api/chat/reindex", requireAuth(http.HandlerFunc(h.reindex)))
}

func (h *Handler) enabled() bool { return h.svc != nil }

// status tells the frontend whether to show the chat button.
func (h *Handler) status(w http.ResponseWriter, r *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{
		"enabled":         h.enabled(),
		"maxMessageChars": MaxMessageChars,
	})
}

func (h *Handler) ask(w http.ResponseWriter, r *http.Request) {
	if !h.enabled() {
		writeDisabled(w)
		return
	}
	req, ok := decodeRequest(w, r)
	if !ok {
		return
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(askTimeout + 10*time.Second))
	ctx, cancel := context.WithTimeout(r.Context(), askTimeout)
	defer cancel()

	res, err := h.svc.Ask(ctx, req)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, res)
}

// stream answers with Server-Sent Events:
//
//	event: sources  data: [{"title":…,"source":…,"url":…}]
//	event: delta    data: {"text":"…"}        (repeated)
//	event: done     data: {}
//	event: error    data: {"code":…,"message":…}   (instead of done)
//
// Errors found before streaming starts (validation, limits) are ordinary
// JSON error responses, exactly like POST /api/chat.
func (h *Handler) stream(w http.ResponseWriter, r *http.Request) {
	if !h.enabled() {
		writeDisabled(w)
		return
	}
	req, ok := decodeRequest(w, r)
	if !ok {
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), streamTimeout)
	defer cancel()

	prepared, err := h.svc.Prepare(ctx, req)
	if err != nil {
		h.fail(w, r, err)
		return
	}

	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Now().Add(streamTimeout + 10*time.Second))
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no") // tell nginx-style proxies not to buffer
	w.WriteHeader(http.StatusOK)

	send := func(event string, data any) error {
		payload, err := json.Marshal(data)
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, payload); err != nil {
			return err // the visitor closed the chat or the connection dropped
		}
		return rc.Flush()
	}

	if send("sources", prepared.Sources) != nil {
		return
	}
	wrote := false
	for text, err := range h.svc.Stream(ctx, prepared) {
		if err != nil {
			code, message, _ := classify(err)
			if code == "CHAT_UNAVAILABLE" || code == "CHAT_TIMEOUT" {
				httpx.LogError(r, "chat stream failed", err)
			}
			_ = send("error", map[string]string{"code": code, "message": message})
			return
		}
		wrote = true
		if send("delta", map[string]string{"text": text}) != nil {
			return
		}
	}
	if !wrote {
		code, message, _ := classify(ErrEmptyAnswer)
		_ = send("error", map[string]string{"code": code, "message": message})
		return
	}
	_ = send("done", struct{}{})
}

// knowledge shows the admin what the chatbot knows.
func (h *Handler) knowledge(w http.ResponseWriter, r *http.Request) {
	if !h.enabled() {
		httpx.JSON(w, http.StatusOK, map[string]any{"enabled": false, "reason": h.disabledReason})
		return
	}
	stats, err := h.stats.Stats(r.Context())
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"enabled":        true,
		"chunks":         stats.Chunks,
		"lastIndexedAt":  stats.LastIndexedAt,
		"model":          h.models["model"],
		"embeddingModel": h.models["embeddingModel"],
	})
}

// reindex rebuilds the knowledge base from the current portfolio content.
// ?full=true re-embeds everything (after changing the embedding model).
func (h *Handler) reindex(w http.ResponseWriter, r *http.Request) {
	if !h.enabled() {
		writeDisabled(w)
		return
	}
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(reindexTimeout + 10*time.Second))
	ctx, cancel := context.WithTimeout(r.Context(), reindexTimeout)
	defer cancel()

	report, err := h.indexer.Run(ctx, r.URL.Query().Get("full") == "true")
	switch {
	case errors.Is(err, rag.ErrIndexingInProgress):
		httpx.Error(w, http.StatusConflict, "REINDEX_IN_PROGRESS", "The knowledge base is already being rebuilt")
	case errors.Is(err, gemini.ErrRateLimited):
		httpx.Error(w, http.StatusServiceUnavailable, "CHAT_BUSY",
			"The Gemini quota is used up for now. Please try again in a minute.")
	case err != nil:
		httpx.LogError(r, "reindex failed", err)
		httpx.Error(w, http.StatusBadGateway, "REINDEX_FAILED",
			"Rebuilding the knowledge base failed. Check the server log for details.")
	default:
		httpx.JSON(w, http.StatusOK, report)
	}
}

func decodeRequest(w http.ResponseWriter, r *http.Request) (Request, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBytes)
	var req Request
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.InvalidJSON(w, err)
		return Request{}, false
	}
	return req, true
}

func (h *Handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	code, message, status := classify(err)
	if code == "" {
		httpx.ServiceError(w, r, err) // validation → 422
		return
	}
	// Unexpected failures are logged; expected ones (limits) are not noise.
	if code == "CHAT_UNAVAILABLE" || code == "CHAT_TIMEOUT" {
		httpx.LogError(r, "chat request failed", err)
	}
	httpx.Error(w, status, code, message)
}

// classify maps errors to a safe, visitor-friendly code and message.
// Internal details (database or Gemini errors) are logged, never returned.
func classify(err error) (code, message string, status int) {
	switch {
	case errors.Is(err, ErrDailyLimit):
		return "CHAT_DAILY_LIMIT", "The assistant has answered its maximum number of questions for today. Please come back tomorrow, or use the contact page.", http.StatusServiceUnavailable
	case errors.Is(err, gemini.ErrRateLimited):
		return "CHAT_BUSY", "The assistant is busy right now. Please try again in a minute.", http.StatusServiceUnavailable
	case errors.Is(err, gemini.ErrBlocked):
		return "CHAT_BLOCKED", "Sorry, I can't help with that. Please ask something about the portfolio.", http.StatusUnprocessableEntity
	case errors.Is(err, ErrEmptyAnswer):
		return "CHAT_EMPTY_ANSWER", "Sorry, I couldn't come up with an answer. Please try rephrasing your question.", http.StatusBadGateway
	case errors.Is(err, context.DeadlineExceeded):
		return "CHAT_TIMEOUT", "The assistant took too long to answer. Please try again.", http.StatusGatewayTimeout
	case isValidation(err):
		return "", "", 0
	default:
		return "CHAT_UNAVAILABLE", "The assistant is unavailable right now. Please try again later.", http.StatusServiceUnavailable
	}
}

func isValidation(err error) bool {
	var verr *validate.Error
	return errors.As(err, &verr)
}

func writeDisabled(w http.ResponseWriter) {
	httpx.Error(w, http.StatusServiceUnavailable, "CHAT_DISABLED", "The assistant is not available on this site.")
}
