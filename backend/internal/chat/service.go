package chat

import (
	"context"
	"fmt"
	"iter"
	"strings"
	"sync"
	"time"

	"portfolio/internal/gemini"
	"portfolio/internal/rag"
	"portfolio/internal/validate"
)

// LLM is the part of gemini.Client the chatbot uses (a fake in tests).
type LLM interface {
	EmbedQueries(ctx context.Context, queries []string) ([][]float32, error)
	Generate(ctx context.Context, req gemini.GenerateRequest) (string, error)
	GenerateStream(ctx context.Context, req gemini.GenerateRequest) iter.Seq2[string, error]
}

// Retriever finds relevant chunks (implemented by rag.Store).
type Retriever interface {
	Search(ctx context.Context, embedding []float32, limit int, minSimilarity float64) ([]rag.Match, error)
}

// Options tune retrieval and abuse protection.
type Options struct {
	TopK          int
	MinSimilarity float64
	DailyLimit    int
	// OwnerName returns the portfolio owner's name for the system
	// instruction ("" falls back to a generic description).
	OwnerName func(ctx context.Context) string
}

// Service answers questions about the portfolio.
type Service struct {
	llm       LLM
	retriever Retriever
	opts      Options
	quota     *dailyQuota

	nameMu      sync.Mutex
	name        string
	nameFetched time.Time
}

// NewService creates a Service.
func NewService(llm LLM, retriever Retriever, opts Options) *Service {
	return &Service{llm: llm, retriever: retriever, opts: opts, quota: newDailyQuota(opts.DailyLimit)}
}

// Prepared is a validated question with its retrieved context, ready to be
// sent to the model.
type Prepared struct {
	Request gemini.GenerateRequest
	Sources []Source
}

// Prepare validates the request, retrieves relevant chunks and builds the
// prompt. Every error it returns happens before any answer is produced, so
// the handler can still reply with a normal JSON error.
func (s *Service) Prepare(ctx context.Context, req Request) (Prepared, error) {
	question, history, err := validateRequest(req)
	if err != nil {
		return Prepared{}, err
	}
	if !s.quota.take() {
		return Prepared{}, ErrDailyLimit
	}

	matches, err := s.retrieve(ctx, retrievalQueries(question, history))
	if err != nil {
		return Prepared{}, err
	}

	return Prepared{
		Request: buildPrompt(s.ownerName(ctx), history, question, matches),
		Sources: sourcesFrom(matches),
	}, nil
}

// Ask answers a question in one go.
func (s *Service) Ask(ctx context.Context, req Request) (Response, error) {
	p, err := s.Prepare(ctx, req)
	if err != nil {
		return Response{}, err
	}
	answer, err := s.llm.Generate(ctx, p.Request)
	if err != nil {
		return Response{}, fmt.Errorf("generate answer: %w", err)
	}
	answer = strings.TrimSpace(answer)
	if answer == "" {
		return Response{}, ErrEmptyAnswer
	}
	return Response{Answer: answer, Sources: p.Sources}, nil
}

// Stream generates the answer for a prepared question piece by piece.
func (s *Service) Stream(ctx context.Context, p Prepared) iter.Seq2[string, error] {
	return s.llm.GenerateStream(ctx, p.Request)
}

// validateRequest checks and normalises the question and history.
func validateRequest(req Request) (string, []Turn, error) {
	question := strings.TrimSpace(req.Message)
	v := validate.New()
	v.Required("message", "Message", question)
	v.MaxLength("message", "Message", question, MaxMessageChars)
	v.Check(len(req.History) <= MaxHistoryTurnsInput, "history", "Too many previous messages")
	for i, t := range req.History {
		field := fmt.Sprintf("history.%d", i)
		v.Check(t.Role == RoleUser || t.Role == RoleAssistant, field, "Role must be user or assistant")
		v.Check(validate.MaxLen(t.Content, MaxHistoryTurnChars), field, "Message is too long")
	}
	if err := v.Err(); err != nil {
		return "", nil, err
	}

	// Only the most recent turns are useful, and they cost tokens.
	history := req.History
	if len(history) > maxHistoryMessages {
		history = history[len(history)-maxHistoryMessages:]
	}
	clean := make([]Turn, 0, len(history))
	for _, t := range history {
		if c := strings.TrimSpace(t.Content); c != "" {
			clean = append(clean, Turn{Role: t.Role, Content: c})
		}
	}
	// Gemini expects the conversation to start with a user turn.
	for len(clean) > 0 && clean[0].Role != RoleUser {
		clean = clean[1:]
	}
	return question, clean, nil
}

// retrieve embeds the queries (one API call), searches for each, and merges
// the results by rank: the best match of each query, then the second best of
// each, and so on (duplicates skipped) until TopK chunks are chosen.
//
// Merging by rank rather than by raw score matters for follow-ups: the
// combined query (previous question + follow-up) often scores higher overall
// and would otherwise crowd out the follow-up's own best matches.
func (s *Service) retrieve(ctx context.Context, queries []string) ([]rag.Match, error) {
	vectors, err := s.llm.EmbedQueries(ctx, queries)
	if err != nil {
		return nil, fmt.Errorf("embed question: %w", err)
	}
	results := make([][]rag.Match, 0, len(vectors))
	for _, v := range vectors {
		found, err := s.retriever.Search(ctx, v, s.opts.TopK, s.opts.MinSimilarity)
		if err != nil {
			return nil, fmt.Errorf("search knowledge: %w", err)
		}
		results = append(results, found)
	}

	merged := []rag.Match{}
	seen := map[string]bool{}
	for rank := 0; len(merged) < s.opts.TopK; rank++ {
		added := false
		for _, found := range results {
			if rank >= len(found) {
				continue
			}
			added = true
			if m := found[rank]; !seen[m.Key] && len(merged) < s.opts.TopK {
				seen[m.Key] = true
				merged = append(merged, m)
			}
		}
		if !added {
			break // every result list is exhausted
		}
	}
	return merged, nil
}

// retrievalQueries returns what to search for. A short follow-up such as
// "which of those use Go?" is searched both on its own and together with the
// previous question, so it works whether or not it depends on earlier context.
func retrievalQueries(question string, history []Turn) []string {
	if len([]rune(question)) > 80 {
		return []string{question}
	}
	for i := len(history) - 1; i >= 0; i-- {
		if history[i].Role == RoleUser {
			return []string{question, history[i].Content + "\n" + question}
		}
	}
	return []string{question}
}

// ownerName is cached for a few minutes to avoid a database query per question.
func (s *Service) ownerName(ctx context.Context) string {
	s.nameMu.Lock()
	defer s.nameMu.Unlock()
	if s.opts.OwnerName != nil && time.Since(s.nameFetched) > 5*time.Minute {
		s.name = s.opts.OwnerName(ctx)
		s.nameFetched = time.Now()
	}
	if s.name == "" {
		return "the portfolio owner"
	}
	return s.name
}
