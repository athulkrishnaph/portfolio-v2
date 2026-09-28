package gemini

import (
	"errors"
	"strings"
	"testing"

	"google.golang.org/genai"
)

func TestRetrievalTextFormat(t *testing.T) {
	v2 := &Client{cfg: Config{EmbeddingModel: "gemini-embedding-2"}}
	if got := v2.documentText(Document{Title: "Engine", Text: "Go project"}); got != "title: Engine | text: Go project" {
		t.Errorf("document = %q", got)
	}
	if got := v2.documentText(Document{Text: "x"}); got != "title: none | text: x" {
		t.Errorf("untitled document = %q", got)
	}
	if got := v2.queryText("Which projects use Go?"); !strings.HasSuffix(got, "| query: Which projects use Go?") {
		t.Errorf("query = %q", got)
	}

	// gemini-embedding-001 takes a task type parameter instead of prefixes.
	v1 := &Client{cfg: Config{EmbeddingModel: "gemini-embedding-001"}}
	if got := v1.documentText(Document{Title: "T", Text: "x"}); got != "x" {
		t.Errorf("001 document = %q", got)
	}
}

func TestWrapHidesTheKeyAndMapsRateLimits(t *testing.T) {
	c := &Client{keys: []string{"AIzaSECRET"}}

	err := c.wrap("generate", errors.New("request with key AIzaSECRET failed"))
	if strings.Contains(err.Error(), "AIzaSECRET") {
		t.Errorf("API key leaked in error: %v", err)
	}

	err = c.wrap("embed", genai.APIError{Code: 429, Message: "quota exceeded"})
	if !errors.Is(err, ErrRateLimited) {
		t.Errorf("429 should map to ErrRateLimited, got %v", err)
	}
}

func TestResponseTextDetectsBlockedPrompts(t *testing.T) {
	blocked := &genai.GenerateContentResponse{PromptFeedback: &genai.GenerateContentResponsePromptFeedback{BlockReason: "SAFETY"}}
	if _, err := responseText(blocked); !errors.Is(err, ErrBlocked) {
		t.Errorf("err = %v, want ErrBlocked", err)
	}
	if text, err := responseText(nil); text != "" || err != nil {
		t.Errorf("nil response: %q %v", text, err)
	}
}
