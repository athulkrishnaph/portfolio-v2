package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// MaxJSONBodyBytes limits JSON request bodies. Portfolio text is small;
// images are uploaded separately, not inside JSON.
const MaxJSONBodyBytes = 1 << 20 // 1 MB

// DecodeJSON reads a single JSON object from the request body into dst.
// It rejects unknown fields, oversized bodies and trailing data. The returned
// error message is safe to show to API clients; send it with InvalidJSON.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(w, r.Body, MaxJSONBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		return jsonDecodeError(err)
	}
	// A body like `{"a":1}{"b":2}` contains more than one value.
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("request body must contain a single JSON object")
	}
	return nil
}

// jsonDecodeError converts encoding/json errors into client-friendly messages.
func jsonDecodeError(err error) error {
	var syntaxErr *json.SyntaxError
	var typeErr *json.UnmarshalTypeError
	var maxBytesErr *http.MaxBytesError

	switch {
	case errors.Is(err, io.EOF):
		return errors.New("request body must not be empty")
	case errors.As(err, &syntaxErr), errors.Is(err, io.ErrUnexpectedEOF):
		return errors.New("request body contains malformed JSON")
	case errors.As(err, &typeErr):
		if typeErr.Field != "" {
			return fmt.Errorf("field %q has the wrong type", typeErr.Field)
		}
		return errors.New("request body must be a JSON object")
	case errors.As(err, &maxBytesErr):
		return fmt.Errorf("request body must not be larger than %d bytes", maxBytesErr.Limit)
	case strings.HasPrefix(err.Error(), "json: unknown field "):
		// encoding/json has no typed error for unknown fields.
		field := strings.TrimPrefix(err.Error(), "json: unknown field ")
		return fmt.Errorf("unknown field %s", field)
	default:
		return errors.New("request body could not be read")
	}
}

// InvalidJSON writes a 400 response for an error returned by DecodeJSON.
func InvalidJSON(w http.ResponseWriter, err error) {
	Error(w, http.StatusBadRequest, "INVALID_JSON", err.Error())
}

// PathID parses the {id} path parameter as a positive integer.
// Routes must be registered with an {id} wildcard, e.g. "GET /api/projects/{id}".
func PathID(r *http.Request) (int64, error) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("id must be a positive integer")
	}
	return id, nil
}

// InvalidID writes a 400 response for an error returned by PathID.
func InvalidID(w http.ResponseWriter, err error) {
	Error(w, http.StatusBadRequest, "INVALID_ID", err.Error())
}
