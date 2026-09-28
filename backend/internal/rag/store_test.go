package rag

import (
	"context"
	"testing"

	"portfolio/internal/testdb"
)

// unit returns a 768-dimension vector pointing mostly along axis i, so
// cosine similarities between test vectors are easy to reason about.
func unit(i int, blend ...float32) []float32 {
	v := make([]float32, 768)
	v[i] = 1
	for j, b := range blend {
		v[j] += b
	}
	return v
}

func TestStore(t *testing.T) {
	store := NewStore(testdb.New(t))
	ctx := context.Background()

	dims, err := store.EmbeddingDimensions(ctx)
	if err != nil || dims != 768 {
		t.Fatalf("EmbeddingDimensions = %d, %v", dims, err)
	}

	chunks := []StoredChunk{
		{Chunk: Chunk{Key: "a", Source: "projects", Title: "Go project", Content: "uses Go"}, Hash: "h1", Embedding: unit(0)},
		{Chunk: Chunk{Key: "b", Source: "skills", Title: "Skills", Content: "Go, SQL"}, Hash: "h2", Embedding: unit(1, 0.5)},
		{Chunk: Chunk{Key: "c", Source: "profile", Title: "Hobbies", Content: "chess"}, Hash: "h3", Embedding: unit(2)},
	}
	if _, err := store.Sync(ctx, chunks, []string{"a", "b", "c"}); err != nil {
		t.Fatal(err)
	}

	t.Run("search ranks by similarity and applies the threshold", func(t *testing.T) {
		matches, err := store.Search(ctx, unit(0), 5, 0.3)
		if err != nil {
			t.Fatal(err)
		}
		// a: similarity 1; b: ~0.45; c: 0 (below threshold).
		if len(matches) != 2 || matches[0].Key != "a" || matches[1].Key != "b" {
			t.Fatalf("matches = %+v", matches)
		}
		if matches[0].Similarity < 0.99 || matches[0].Title != "Go project" {
			t.Errorf("top match = %+v", matches[0])
		}
		if limited, _ := store.Search(ctx, unit(0), 1, 0); len(limited) != 1 {
			t.Errorf("limit not applied: %d", len(limited))
		}
	})

	t.Run("sync updates in place and removes stale chunks", func(t *testing.T) {
		updated := chunks[0]
		updated.Content, updated.Hash = "uses Go and Rust", "h1b"
		deleted, err := store.Sync(ctx, []StoredChunk{updated}, []string{"a", "b"})
		if err != nil || deleted != 1 {
			t.Fatalf("deleted = %d, err = %v", deleted, err)
		}
		hashes, _ := store.Hashes(ctx)
		if len(hashes) != 2 || hashes["a"] != "h1b" {
			t.Errorf("hashes = %v", hashes)
		}
		stats, _ := store.Stats(ctx)
		if stats.Chunks != 2 || stats.LastIndexedAt == nil {
			t.Errorf("stats = %+v", stats)
		}
		// An empty keep list removes everything (not a no-op).
		if deleted, _ := store.Sync(ctx, nil, nil); deleted != 2 {
			t.Errorf("empty sync deleted %d, want 2", deleted)
		}
	})

	t.Run("document cache is keyed by file hash", func(t *testing.T) {
		if _, ok, _ := store.CachedDocument(ctx, "resume", "x"); ok {
			t.Fatal("unexpected cache hit")
		}
		if err := store.SaveDocument(ctx, "resume", "x", "resume text"); err != nil {
			t.Fatal(err)
		}
		if text, ok, _ := store.CachedDocument(ctx, "resume", "x"); !ok || text != "resume text" {
			t.Errorf("got %q, %v", text, ok)
		}
		if _, ok, _ := store.CachedDocument(ctx, "resume", "changed-file"); ok {
			t.Error("a changed file must not hit the cache")
		}
	})
}

func TestVectorLiteral(t *testing.T) {
	if got := vectorLiteral([]float32{1, -0.5, 0.25}); got != "[1,-0.5,0.25]" {
		t.Errorf("got %s", got)
	}
}
