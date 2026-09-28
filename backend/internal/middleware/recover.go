package middleware

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"

	"portfolio/internal/httpx"
)

// Recover turns a panic in a handler into a logged error and a generic 500
// JSON response, instead of dropping the connection. The stack trace is
// logged server-side only.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			v := recover()
			if v == nil {
				return
			}
			// http.ErrAbortHandler is the documented way to abort a response
			// on purpose; let net/http handle it as usual.
			if err, ok := v.(error); ok && errors.Is(err, http.ErrAbortHandler) {
				panic(v)
			}
			slog.ErrorContext(r.Context(), "panic recovered",
				"method", r.Method, "path", r.URL.Path,
				"panic", fmt.Sprint(v), "stack", string(debug.Stack()))
			httpx.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Something went wrong")
		}()
		next.ServeHTTP(w, r)
	})
}
