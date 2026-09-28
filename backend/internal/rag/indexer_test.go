package rag

import (
	"context"
	"errors"
	"testing"

	"portfolio/internal/gemini"
	"portfolio/internal/skills"
)

// fakeIndexStore is an in-memory knowledge_chunks table.
type fakeIndexStore struct{ rows map[string]StoredChunk }

func (f *fakeIndexStore) Hashes(context.Context) (map[string]string, error) {
	out := map[string]string{}
	for k, r := range f.rows {
		out[k] = r.Hash
	}
	return out, nil
}

func (f *fakeIndexStore) Sync(_ context.Context, upserts []StoredChunk, keep []string) (int64, error) {
	for _, u := range upserts {
		f.rows[u.Key] = u
	}
	keepSet := map[string]bool{}
	for _, k := range keep {
		keepSet[k] = true
	}
	var deleted int64
	for k := range f.rows {
		if !keepSet[k] {
			delete(f.rows, k)
			deleted++
		}
	}
	return deleted, nil
}

type fakeEmbedder struct {
	calls, texts int
	err          error
}

func (f *fakeEmbedder) EmbedDocuments(_ context.Context, docs []gemini.Document) ([][]float32, error) {
	f.calls++
	f.texts += len(docs)
	if f.err != nil {
		return nil, f.err
	}
	out := make([][]float32, len(docs))
	for i := range out {
		out[i] = []float32{1, 0, 0}
	}
	return out, nil
}
func (f *fakeEmbedder) EmbeddingModel() string { return "fake-embedding" }
func (f *fakeEmbedder) Dimensions() int        { return 3 }

type fakeContent struct{ c Content }

func (f *fakeContent) Load(context.Context) (Content, []string, error) { return f.c, nil, nil }

func TestIndexerOnlyEmbedsChanges(t *testing.T) {
	store := &fakeIndexStore{rows: map[string]StoredChunk{}}
	emb := &fakeEmbedder{}
	content := &fakeContent{c: Content{Skills: []skills.Skill{
		{Name: "Go", Category: "Backend"}, {Name: "Angular", Category: "Frontend"},
	}}}
	ix := NewIndexer(store, emb, content)
	ctx := context.Background()

	first, err := ix.Run(ctx, false)
	if err != nil {
		t.Fatal(err)
	}
	if first.Chunks != 3 || first.Embedded != 3 || first.Unchanged != 0 {
		t.Fatalf("first run = %+v", first)
	}

	second, _ := ix.Run(ctx, false)
	if second.Embedded != 0 || second.Unchanged != 3 || emb.calls != 1 {
		t.Errorf("second run should embed nothing: %+v (embed calls %d)", second, emb.calls)
	}

	// Change one category and remove the other.
	content.c.Skills = []skills.Skill{{Name: "Go", Category: "Backend"}, {Name: "SQL", Category: "Backend"}}
	third, _ := ix.Run(ctx, false)
	if third.Chunks != 2 || third.Embedded != 2 || third.Deleted != 1 {
		t.Errorf("third run = %+v, want overview+backend re-embedded and frontend deleted", third)
	}
	if _, ok := store.rows["skills:frontend"]; ok {
		t.Error("stale chunk was not deleted")
	}

	full, _ := ix.Run(ctx, true)
	if full.Embedded != 2 {
		t.Errorf("full run re-embedded %d, want 2", full.Embedded)
	}
}

func TestIndexerErrors(t *testing.T) {
	store := &fakeIndexStore{rows: map[string]StoredChunk{}}
	content := &fakeContent{c: Content{Skills: []skills.Skill{{Name: "Go", Category: "Backend"}}}}

	emb := &fakeEmbedder{err: gemini.ErrRateLimited}
	if _, err := NewIndexer(store, emb, content).Run(context.Background(), false); !errors.Is(err, gemini.ErrRateLimited) {
		t.Errorf("err = %v, want ErrRateLimited", err)
	}
	if len(store.rows) != 0 {
		t.Error("nothing must be saved when embedding fails")
	}

	ix := NewIndexer(store, &fakeEmbedder{}, content)
	ix.mu.Lock() // simulate a run in progress
	defer ix.mu.Unlock()
	if _, err := ix.Run(context.Background(), false); !errors.Is(err, ErrIndexingInProgress) {
		t.Errorf("err = %v, want ErrIndexingInProgress", err)
	}
}
