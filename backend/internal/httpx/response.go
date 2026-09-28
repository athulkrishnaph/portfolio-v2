// Package httpx contains small helpers for writing consistent JSON responses.
//
// Every API response uses one of two shapes:
//
//	success: {"data": ...}
//	error:   {"error": {"code": "PROJECT_NOT_FOUND", "message": "Project not found"}}
package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"portfolio/internal/validate"
)

// ErrorBody is the payload inside the "error" key of an error response.
// Details is optional and is used for per-field validation messages.
type ErrorBody struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details,omitempty"`
}

type dataEnvelope struct {
	Data any `json:"data"`
}

type errorEnvelope struct {
	Error ErrorBody `json:"error"`
}

// JSON writes data wrapped in {"data": ...} with the given status code.
func JSON(w http.ResponseWriter, status int, data any) {
	write(w, status, dataEnvelope{Data: data})
}

// NoContent writes an empty 204 response (used after successful deletes).
func NoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// Error writes {"error": {...}} with the given status code.
func Error(w http.ResponseWriter, status int, code, message string) {
	write(w, status, errorEnvelope{Error: ErrorBody{Code: code, Message: message}})
}

// ValidationError writes a 422 response listing which fields are invalid.
func ValidationError(w http.ResponseWriter, details map[string]string) {
	write(w, http.StatusUnprocessableEntity, errorEnvelope{Error: ErrorBody{
		Code:    "VALIDATION_FAILED",
		Message: "One or more fields are invalid",
		Details: details,
	}})
}

// InternalError logs the real error server-side and returns a generic 500
// so database or other internal details are never exposed to clients.
func InternalError(w http.ResponseWriter, r *http.Request, err error) {
	LogError(r, "internal error", err)
	Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Something went wrong")
}

// ServiceError writes the response for an error returned by a service that
// the handler did not handle itself: a *validate.Error becomes a 422 with
// per-field details, anything else a generic 500.
func ServiceError(w http.ResponseWriter, r *http.Request, err error) {
	var verr *validate.Error
	if errors.As(err, &verr) {
		ValidationError(w, verr.Fields)
		return
	}
	InternalError(w, r, err)
}

// LogError logs err with the request's method, path and request ID.
func LogError(r *http.Request, msg string, err error) {
	slog.ErrorContext(r.Context(), msg, "method", r.Method, "path", r.URL.Path, "error", err)
}

func write(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		// Headers are already sent; all we can do is log.
		slog.Error("failed to encode JSON response", "error", err)
	}
}
