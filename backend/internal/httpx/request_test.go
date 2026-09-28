package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeJSON(t *testing.T) {
	type input struct {
		Title string `json:"title"`
		Order int    `json:"order"`
	}

	tests := []struct {
		name    string
		body    string
		wantErr string // "" means success
	}{
		{"valid", `{"title":"Hello","order":2}`, ""},
		{"empty body", ``, "must not be empty"},
		{"malformed", `{"title":`, "malformed JSON"},
		{"syntax error", `{"title" "x"}`, "malformed JSON"},
		{"wrong type", `{"order":"two"}`, `field "order" has the wrong type`},
		{"not an object", `[1,2]`, "must be a JSON object"},
		{"unknown field", `{"titel":"typo"}`, `unknown field "titel"`},
		{"two objects", `{"title":"a"}{"title":"b"}`, "single JSON object"},
		{"too large", `{"title":"` + strings.Repeat("x", MaxJSONBodyBytes) + `"}`, "must not be larger"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/", strings.NewReader(tt.body))
			var in input
			err := DecodeJSON(httptest.NewRecorder(), req, &in)

			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if in.Title != "Hello" || in.Order != 2 {
					t.Errorf("decoded %+v", in)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("error = %v, want it to contain %q", err, tt.wantErr)
			}
		})
	}
}

func TestPathID(t *testing.T) {
	tests := []struct {
		value  string
		want   int64
		wantOK bool
	}{
		{"42", 42, true},
		{"0", 0, false},
		{"-1", 0, false},
		{"abc", 0, false},
		{"99999999999999999999", 0, false}, // overflows int64
	}
	for _, tt := range tests {
		req := httptest.NewRequest("GET", "/", nil)
		req.SetPathValue("id", tt.value)
		got, err := PathID(req)
		if (err == nil) != tt.wantOK || got != tt.want {
			t.Errorf("PathID(%q) = %d, %v; want %d, ok=%v", tt.value, got, err, tt.want, tt.wantOK)
		}
	}
}

func TestErrorResponseShape(t *testing.T) {
	rec := httptest.NewRecorder()
	ValidationError(rec, map[string]string{"title": "Title is required"})

	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, want 422", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
		t.Errorf("Content-Type = %q", ct)
	}
	want := `{"error":{"code":"VALIDATION_FAILED","message":"One or more fields are invalid","details":{"title":"Title is required"}}}`
	if got := strings.TrimSpace(rec.Body.String()); got != want {
		t.Errorf("body =\n%s\nwant\n%s", got, want)
	}
}
