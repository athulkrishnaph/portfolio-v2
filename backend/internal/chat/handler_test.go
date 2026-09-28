package chat

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"portfolio/internal/gemini"
	"portfolio/internal/rag"
)

type fakeIndexer struct{ err error }

func (f fakeIndexer) Run(context.Context, bool) (rag.Report, error) {
	return rag.Report{Chunks: 3, Embedded: 1}, f.err
}

type fakeStats struct{}

func (fakeStats) Stats(context.Context) (rag.Stats, error) { return rag.Stats{Chunks: 3}, nil }

// denyAll stands in for auth.RequireAuth: every admin request is rejected.
func denyAll(http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})
}

func allowAll(h http.Handler) http.Handler { return h }

func newMux(h *Handler, requireAuth func(http.Handler) http.Handler) *http.ServeMux {
	mux := http.NewServeMux()
	h.Routes(mux, requireAuth, allowAll)
	return mux
}

func do(mux http.Handler, method, path, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest(method, path, strings.NewReader(body)))
	return rec
}

func TestDisabledChatbot(t *testing.T) {
	mux := newMux(NewDisabledHandler("GEMINI_API_KEY is not set"), allowAll)

	rec := do(mux, "GET", "/api/chat/status", "")
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"enabled":false`) {
		t.Errorf("status: %d %s", rec.Code, rec.Body)
	}
	for _, path := range []string{"/api/chat", "/api/chat/stream"} {
		if rec := do(mux, "POST", path, `{"message":"hi"}`); rec.Code != 503 || !strings.Contains(rec.Body.String(), "CHAT_DISABLED") {
			t.Errorf("%s: %d %s", path, rec.Code, rec.Body)
		}
	}
	// The reason is shown to the (authenticated) admin only.
	rec = do(mux, "GET", "/api/chat/knowledge", "")
	if !strings.Contains(rec.Body.String(), "GEMINI_API_KEY is not set") {
		t.Errorf("knowledge: %s", rec.Body)
	}
	if rec := do(mux, "GET", "/api/chat/status", ""); strings.Contains(rec.Body.String(), "GEMINI") {
		t.Error("the public status must not reveal configuration details")
	}
}

func TestAskEndpoint(t *testing.T) {
	llm := &fakeLLM{answer: "Ada uses Go."}
	r := &fakeRetriever{results: [][]rag.Match{{match("s", "skills", "Skills", "/skills", "Go", 0.8)}}}
	mux := newMux(NewHandler(newTestService(llm, r), fakeIndexer{}, fakeStats{}, "m", "e"), denyAll)

	rec := do(mux, "POST", "/api/chat", `{"message":"What does Ada use?"}`)
	if rec.Code != 200 {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var body struct {
		Data Response `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Data.Answer != "Ada uses Go." || len(body.Data.Sources) != 1 || body.Data.Sources[0].URL != "/skills" {
		t.Errorf("body = %+v", body.Data)
	}
}

func TestAskEndpointErrors(t *testing.T) {
	tests := []struct {
		name       string
		llm        *fakeLLM
		retriever  *fakeRetriever
		body       string
		wantStatus int
		wantCode   string
	}{
		{"invalid JSON", &fakeLLM{}, &fakeRetriever{}, `{"message":`, 400, "INVALID_JSON"},
		{"unknown field", &fakeLLM{}, &fakeRetriever{}, `{"message":"hi","admin":true}`, 400, "INVALID_JSON"},
		{"empty message", &fakeLLM{}, &fakeRetriever{}, `{"message":""}`, 422, "VALIDATION_FAILED"},
		{"too long", &fakeLLM{}, &fakeRetriever{}, `{"message":"` + strings.Repeat("a", 501) + `"}`, 422, "VALIDATION_FAILED"},
		{"huge body", &fakeLLM{}, &fakeRetriever{}, `{"message":"` + strings.Repeat("a", 64<<10) + `"}`, 400, "INVALID_JSON"},
		{"gemini quota", &fakeLLM{embedErr: gemini.ErrRateLimited}, &fakeRetriever{}, `{"message":"hi"}`, 503, "CHAT_BUSY"},
		{"gemini failure", &fakeLLM{genErr: errors.New("secret internal detail")}, &fakeRetriever{}, `{"message":"hi"}`, 503, "CHAT_UNAVAILABLE"},
		{"database failure", &fakeLLM{}, &fakeRetriever{err: errors.New("pq: password authentication failed")}, `{"message":"hi"}`, 503, "CHAT_UNAVAILABLE"},
		{"blocked", &fakeLLM{genErr: gemini.ErrBlocked}, &fakeRetriever{}, `{"message":"hi"}`, 422, "CHAT_BLOCKED"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mux := newMux(NewHandler(newTestService(tt.llm, tt.retriever), fakeIndexer{}, fakeStats{}, "m", "e"), denyAll)
			rec := do(mux, "POST", "/api/chat", tt.body)
			if rec.Code != tt.wantStatus || !strings.Contains(rec.Body.String(), tt.wantCode) {
				t.Errorf("got %d %s, want %d %s", rec.Code, rec.Body, tt.wantStatus, tt.wantCode)
			}
			// Internal error details never reach the browser.
			for _, secret := range []string{"secret internal detail", "password authentication"} {
				if strings.Contains(rec.Body.String(), secret) {
					t.Errorf("internal error leaked: %s", rec.Body)
				}
			}
		})
	}
}

func TestStreamEndpoint(t *testing.T) {
	llm := &fakeLLM{stream: []string{"Ada ", "uses ", "Go."}}
	r := &fakeRetriever{results: [][]rag.Match{{match("s", "skills", "Skills", "/skills", "Go", 0.8)}}}
	mux := newMux(NewHandler(newTestService(llm, r), fakeIndexer{}, fakeStats{}, "m", "e"), denyAll)

	rec := do(mux, "POST", "/api/chat/stream", `{"message":"What does Ada use?"}`)
	if rec.Code != 200 || !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/event-stream") {
		t.Fatalf("status %d, content-type %q", rec.Code, rec.Header().Get("Content-Type"))
	}
	want := "event: sources\ndata: [{\"title\":\"Skills\",\"source\":\"skills\",\"url\":\"/skills\"}]\n\n" +
		"event: delta\ndata: {\"text\":\"Ada \"}\n\n" +
		"event: delta\ndata: {\"text\":\"uses \"}\n\n" +
		"event: delta\ndata: {\"text\":\"Go.\"}\n\n" +
		"event: done\ndata: {}\n\n"
	if rec.Body.String() != want {
		t.Errorf("stream =\n%s\nwant\n%s", rec.Body, want)
	}
}

func TestStreamErrors(t *testing.T) {
	// Before streaming starts: a normal JSON error.
	mux := newMux(NewHandler(newTestService(&fakeLLM{embedErr: gemini.ErrRateLimited}, &fakeRetriever{}),
		fakeIndexer{}, fakeStats{}, "m", "e"), denyAll)
	rec := do(mux, "POST", "/api/chat/stream", `{"message":"hi"}`)
	if rec.Code != 503 || !strings.Contains(rec.Body.String(), "CHAT_BUSY") {
		t.Errorf("pre-stream error: %d %s", rec.Code, rec.Body)
	}

	// During streaming: an SSE error event with a safe message.
	llm := &fakeLLM{stream: []string{"Partial"}, streamErr: errors.New("upstream detail")}
	mux = newMux(NewHandler(newTestService(llm, &fakeRetriever{}), fakeIndexer{}, fakeStats{}, "m", "e"), denyAll)
	body := do(mux, "POST", "/api/chat/stream", `{"message":"hi"}`).Body.String()
	if !strings.Contains(body, "event: error\ndata: {\"code\":\"CHAT_UNAVAILABLE\"") || strings.Contains(body, "upstream detail") {
		t.Errorf("stream error = %s", body)
	}
	if strings.Contains(body, "event: done") {
		t.Error("a failed stream must not end with done")
	}

	// A stream with no text at all is an error, not an empty answer.
	mux = newMux(NewHandler(newTestService(&fakeLLM{}, &fakeRetriever{}), fakeIndexer{}, fakeStats{}, "m", "e"), denyAll)
	if body := do(mux, "POST", "/api/chat/stream", `{"message":"hi"}`).Body.String(); !strings.Contains(body, "CHAT_EMPTY_ANSWER") {
		t.Errorf("empty stream = %s", body)
	}
}

func TestAdminEndpointsRequireAuth(t *testing.T) {
	mux := newMux(NewHandler(newTestService(&fakeLLM{}, &fakeRetriever{}), fakeIndexer{}, fakeStats{}, "m", "e"), denyAll)
	for _, tc := range []struct{ method, path string }{{"GET", "/api/chat/knowledge"}, {"POST", "/api/chat/reindex"}} {
		if rec := do(mux, tc.method, tc.path, ""); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: %d, want 401", tc.method, tc.path, rec.Code)
		}
	}
}

func TestReindexEndpoint(t *testing.T) {
	svc := newTestService(&fakeLLM{}, &fakeRetriever{})
	ok := newMux(NewHandler(svc, fakeIndexer{}, fakeStats{}, "m", "e"), allowAll)
	if rec := do(ok, "POST", "/api/chat/reindex", ""); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"chunks":3`) {
		t.Errorf("reindex: %d %s", rec.Code, rec.Body)
	}
	busy := newMux(NewHandler(svc, fakeIndexer{err: rag.ErrIndexingInProgress}, fakeStats{}, "m", "e"), allowAll)
	if rec := do(busy, "POST", "/api/chat/reindex", ""); rec.Code != 409 {
		t.Errorf("concurrent reindex: %d", rec.Code)
	}
	failed := newMux(NewHandler(svc, fakeIndexer{err: errors.New("db down")}, fakeStats{}, "m", "e"), allowAll)
	if rec := do(failed, "POST", "/api/chat/reindex", ""); rec.Code != 502 || strings.Contains(rec.Body.String(), "db down") {
		t.Errorf("failed reindex: %d %s", rec.Code, rec.Body)
	}
}
