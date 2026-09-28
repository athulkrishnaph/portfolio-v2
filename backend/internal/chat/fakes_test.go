package chat

import (
	"context"
	"iter"

	"portfolio/internal/gemini"
	"portfolio/internal/rag"
)

// fakeLLM records what it was asked and returns canned results.
type fakeLLM struct {
	queries    [][]string
	lastPrompt gemini.GenerateRequest
	embedErr   error
	answer     string
	genErr     error
	stream     []string
	streamErr  error // returned after the pieces in stream
}

func (f *fakeLLM) EmbedQueries(_ context.Context, qs []string) ([][]float32, error) {
	f.queries = append(f.queries, qs)
	if f.embedErr != nil {
		return nil, f.embedErr
	}
	out := make([][]float32, len(qs))
	for i := range out {
		out[i] = []float32{float32(i)}
	}
	return out, nil
}

func (f *fakeLLM) Generate(_ context.Context, req gemini.GenerateRequest) (string, error) {
	f.lastPrompt = req
	return f.answer, f.genErr
}

func (f *fakeLLM) GenerateStream(_ context.Context, req gemini.GenerateRequest) iter.Seq2[string, error] {
	f.lastPrompt = req
	return func(yield func(string, error) bool) {
		for _, s := range f.stream {
			if !yield(s, nil) {
				return
			}
		}
		if f.streamErr != nil {
			yield("", f.streamErr)
		}
	}
}

// fakeRetriever returns results per query vector (indexed by its first value).
type fakeRetriever struct {
	results [][]rag.Match
	err     error
	calls   int
}

func (f *fakeRetriever) Search(_ context.Context, emb []float32, limit int, _ float64) ([]rag.Match, error) {
	f.calls++
	if f.err != nil {
		return nil, f.err
	}
	i := int(emb[0])
	if i >= len(f.results) {
		return nil, nil
	}
	res := f.results[i]
	if len(res) > limit {
		res = res[:limit]
	}
	return res, nil
}

func match(key, source, title, url, content string, sim float64) rag.Match {
	return rag.Match{Chunk: rag.Chunk{Key: key, Source: source, Title: title, URL: url, Content: content}, Similarity: sim}
}

func newTestService(llm *fakeLLM, r *fakeRetriever) *Service {
	return NewService(llm, r, Options{
		TopK: 5, MinSimilarity: 0.6,
		OwnerName: func(context.Context) string { return "Ada Lovelace" },
	})
}
