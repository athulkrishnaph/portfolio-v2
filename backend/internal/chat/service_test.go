package chat

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"portfolio/internal/gemini"
	"portfolio/internal/rag"
	"portfolio/internal/validate"
)

func TestAskValidation(t *testing.T) {
	svc := newTestService(&fakeLLM{answer: "x"}, &fakeRetriever{})
	tests := []struct {
		name      string
		req       Request
		wantField string
	}{
		{"empty message", Request{Message: ""}, "message"},
		{"whitespace only", Request{Message: "   \n "}, "message"},
		{"too long", Request{Message: strings.Repeat("a", MaxMessageChars+1)}, "message"},
		{"bad history role", Request{Message: "hi", History: []Turn{{Role: "system", Content: "x"}}}, "history.0"},
		{"history turn too long", Request{Message: "hi", History: []Turn{{Role: RoleUser, Content: strings.Repeat("a", MaxHistoryTurnChars+1)}}}, "history.0"},
		{"too many history turns", Request{Message: "hi", History: make([]Turn, MaxHistoryTurnsInput+1)}, "history"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := svc.Ask(context.Background(), tt.req)
			var verr *validate.Error
			if !errors.As(err, &verr) || verr.Fields[tt.wantField] == "" {
				t.Errorf("err = %v, want validation error on %q", err, tt.wantField)
			}
		})
	}
	// Exactly at the limit (in characters, not bytes) is fine.
	if _, err := svc.Ask(context.Background(), Request{Message: strings.Repeat("é", MaxMessageChars)}); err != nil {
		t.Errorf("message at the limit: %v", err)
	}
}

func TestAskValidRequest(t *testing.T) {
	llm := &fakeLLM{answer: "  Ada built **Engine** in Go.  "}
	r := &fakeRetriever{results: [][]rag.Match{{
		match("projects:1:1", "projects", "Engine", "/projects/engine", "Engine uses Go", 0.8),
		match("projects:1:2", "projects", "Engine", "/projects/engine", "more about Engine", 0.7),
		match("skills:backend", "skills", "Backend skills", "/skills", "Go, SQL", 0.65),
	}}}
	res, err := newTestService(llm, r).Ask(context.Background(), Request{Message: "Which projects use Go?"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Answer != "Ada built **Engine** in Go." {
		t.Errorf("answer = %q (should be trimmed)", res.Answer)
	}
	// Two chunks of the same project collapse into one source.
	if len(res.Sources) != 2 || res.Sources[0].Title != "Engine" || res.Sources[1].URL != "/skills" {
		t.Errorf("sources = %+v", res.Sources)
	}
	if len(llm.queries) != 1 || len(llm.queries[0]) != 1 {
		t.Errorf("a first question should be embedded once: %v", llm.queries)
	}
}

func TestAskWithoutRelevantContext(t *testing.T) {
	llm := &fakeLLM{answer: "That information is not available in the portfolio."}
	res, err := newTestService(llm, &fakeRetriever{}).Ask(context.Background(), Request{Message: "Capital of France?"})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Sources) != 0 {
		t.Errorf("no context must mean no sources, got %+v", res.Sources)
	}
	prompt := llm.lastPrompt.Messages[len(llm.lastPrompt.Messages)-1].Text
	if !strings.Contains(prompt, "No portfolio content matched") {
		t.Errorf("prompt should tell the model there is no context:\n%s", prompt)
	}
}

func TestAskFailures(t *testing.T) {
	ctx := context.Background()
	req := Request{Message: "hi"}

	if _, err := newTestService(&fakeLLM{embedErr: gemini.ErrRateLimited}, &fakeRetriever{}).Ask(ctx, req); !errors.Is(err, gemini.ErrRateLimited) {
		t.Errorf("embedding failure: err = %v", err)
	}
	dbErr := errors.New("connection refused")
	if _, err := newTestService(&fakeLLM{}, &fakeRetriever{err: dbErr}).Ask(ctx, req); !errors.Is(err, dbErr) {
		t.Errorf("database failure: err = %v", err)
	}
	genErr := errors.New("gemini exploded")
	if _, err := newTestService(&fakeLLM{genErr: genErr}, &fakeRetriever{}).Ask(ctx, req); !errors.Is(err, genErr) {
		t.Errorf("generation failure: err = %v", err)
	}
	if _, err := newTestService(&fakeLLM{answer: "  "}, &fakeRetriever{}).Ask(ctx, req); !errors.Is(err, ErrEmptyAnswer) {
		t.Errorf("empty answer: err = %v", err)
	}
}

func TestFollowUpSearchesBothWaysAndMerges(t *testing.T) {
	llm := &fakeLLM{answer: "ok"}
	r := &fakeRetriever{results: [][]rag.Match{
		{match("a", "projects", "A", "/projects/a", "a", 0.62)},                                                      // question alone
		{match("a", "projects", "A", "/projects/a", "a", 0.9), match("b", "projects", "B", "/projects/b", "b", 0.7)}, // with context
	}}
	history := []Turn{
		{Role: RoleAssistant, Content: "Hello!"}, // leading assistant turns are dropped
		{Role: RoleUser, Content: "Tell me about the projects"},
		{Role: RoleAssistant, Content: "There are A and B."},
	}
	res, err := newTestService(llm, r).Ask(context.Background(), Request{Message: "Which use Go?", History: history})
	if err != nil {
		t.Fatal(err)
	}
	if got := llm.queries[0]; len(got) != 2 || got[1] != "Tell me about the projects\nWhich use Go?" {
		t.Errorf("queries = %q", got)
	}
	if len(res.Sources) != 2 || res.Sources[0].Title != "A" {
		t.Errorf("merged sources = %+v", res.Sources)
	}
	msgs := llm.lastPrompt.Messages
	if len(msgs) != 3 || msgs[0].Role != gemini.RoleUser || msgs[1].Role != gemini.RoleModel {
		t.Errorf("conversation sent to the model = %+v", msgs)
	}
}

func TestDailyLimit(t *testing.T) {
	svc := NewService(&fakeLLM{answer: "ok"}, &fakeRetriever{}, Options{TopK: 5, DailyLimit: 2})
	ctx := context.Background()
	for i := 0; i < 2; i++ {
		if _, err := svc.Ask(ctx, Request{Message: "hi"}); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := svc.Ask(ctx, Request{Message: "hi"}); !errors.Is(err, ErrDailyLimit) {
		t.Errorf("err = %v, want ErrDailyLimit", err)
	}
	// Invalid requests do not use up the quota.
	svc2 := NewService(&fakeLLM{answer: "ok"}, &fakeRetriever{}, Options{TopK: 5, DailyLimit: 1})
	_, _ = svc2.Ask(ctx, Request{Message: ""})
	if _, err := svc2.Ask(ctx, Request{Message: "hi"}); err != nil {
		t.Errorf("quota used by an invalid request: %v", err)
	}
}

func TestDailyQuotaResetsAtMidnightUTC(t *testing.T) {
	now := time.Date(2026, 9, 28, 23, 59, 0, 0, time.UTC)
	q := newDailyQuota(1)
	q.now = func() time.Time { return now }
	if !q.take() || q.take() {
		t.Fatal("limit of 1 not applied")
	}
	now = now.Add(2 * time.Minute) // next day
	if !q.take() {
		t.Error("quota did not reset on a new day")
	}
}
