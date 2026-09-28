package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
)

// RequestIDHeader is the header used to receive and return request IDs.
const RequestIDHeader = "X-Request-ID"

type requestIDKey struct{}

// RequestID gives every request an ID, stores it in the request context and
// returns it in the X-Request-ID response header. An ID sent by the client
// (or a reverse proxy) is reused if it looks safe, so one ID can follow a
// request through several systems.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(RequestIDHeader)
		if !validRequestID(id) {
			id = newRequestID()
		}
		w.Header().Set(RequestIDHeader, id)
		ctx := context.WithValue(r.Context(), requestIDKey{}, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetRequestID returns the request ID stored in ctx, or "" if there is none.
func GetRequestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

func newRequestID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b) // crypto/rand.Read never returns an error
	return hex.EncodeToString(b)
}

// validRequestID accepts short IDs made of letters, digits, '-', '_' and '.'.
// Anything else is replaced, so arbitrary client input never reaches the logs.
func validRequestID(id string) bool {
	if id == "" || len(id) > 64 {
		return false
	}
	for _, c := range id {
		switch {
		case c >= 'a' && c <= 'z', c >= 'A' && c <= 'Z', c >= '0' && c <= '9',
			c == '-', c == '_', c == '.':
		default:
			return false
		}
	}
	return true
}

// NewLogHandler wraps a slog.Handler so that every log call made with a
// request context (slog.InfoContext, slog.ErrorContext, ...) automatically
// includes that request's ID. This ties error logs to the access log line.
func NewLogHandler(h slog.Handler) slog.Handler {
	return logHandler{h}
}

type logHandler struct{ slog.Handler }

func (h logHandler) Handle(ctx context.Context, rec slog.Record) error {
	if id := GetRequestID(ctx); id != "" {
		rec.AddAttrs(slog.String("request_id", id))
	}
	return h.Handler.Handle(ctx, rec)
}

func (h logHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return logHandler{h.Handler.WithAttrs(attrs)}
}

func (h logHandler) WithGroup(name string) slog.Handler {
	return logHandler{h.Handler.WithGroup(name)}
}
