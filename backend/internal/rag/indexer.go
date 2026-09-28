package rag

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"portfolio/internal/gemini"
)

// ErrIndexingInProgress is returned when a re-index is already running.
var ErrIndexingInProgress = errors.New("the knowledge base is already being rebuilt")

// Embedder turns documents into vectors (implemented by gemini.Client).
type Embedder interface {
	EmbedDocuments(ctx context.Context, docs []gemini.Document) ([][]float32, error)
	EmbeddingModel() string
	Dimensions() int
}

// indexStore is the part of Store the indexer needs.
type indexStore interface {
	Hashes(ctx context.Context) (map[string]string, error)
	Sync(ctx context.Context, upserts []StoredChunk, keep []string) (int64, error)
}

// contentSource is satisfied by *ContentLoader.
type contentSource interface {
	Load(ctx context.Context) (Content, []string, error)
}

// Indexer (re)builds the knowledge base from the portfolio content.
type Indexer struct {
	store    indexStore
	embedder Embedder
	content  contentSource
	mu       sync.Mutex
}

// NewIndexer creates an Indexer.
func NewIndexer(store indexStore, embedder Embedder, content contentSource) *Indexer {
	return &Indexer{store: store, embedder: embedder, content: content}
}

// Report summarises one indexing run.
type Report struct {
	Chunks    int      `json:"chunks"`    // chunks in the knowledge base afterwards
	Embedded  int      `json:"embedded"`  // new or changed chunks sent for embedding
	Unchanged int      `json:"unchanged"` // skipped because nothing changed
	Deleted   int64    `json:"deleted"`   // removed because the content is gone
	Warnings  []string `json:"warnings"`
	Duration  string   `json:"duration"`
}

// Run rebuilds the knowledge base. Only new or changed chunks are embedded
// (compared by content hash), so re-running it is cheap; full=true
// re-embeds everything (needed after changing the embedding model).
func (ix *Indexer) Run(ctx context.Context, full bool) (Report, error) {
	if !ix.mu.TryLock() {
		return Report{}, ErrIndexingInProgress
	}
	defer ix.mu.Unlock()
	start := time.Now()

	content, warnings, err := ix.content.Load(ctx)
	if err != nil {
		return Report{}, fmt.Errorf("load portfolio content: %w", err)
	}
	chunks := dedupe(BuildChunks(content))

	existing, err := ix.store.Hashes(ctx)
	if err != nil {
		return Report{}, err
	}

	keep := make([]string, 0, len(chunks))
	var changed []Chunk
	var hashes []string
	for _, c := range chunks {
		keep = append(keep, c.Key)
		h := ix.hash(c)
		if !full && existing[c.Key] == h {
			continue
		}
		changed = append(changed, c)
		hashes = append(hashes, h)
	}

	var upserts []StoredChunk
	if len(changed) > 0 {
		docs := make([]gemini.Document, len(changed))
		for i, c := range changed {
			docs[i] = gemini.Document{Title: c.Title, Text: c.Content}
		}
		vectors, err := ix.embedder.EmbedDocuments(ctx, docs)
		if err != nil {
			return Report{}, fmt.Errorf("embed chunks: %w", err)
		}
		if len(vectors) != len(changed) {
			return Report{}, fmt.Errorf("embed chunks: got %d vectors for %d chunks", len(vectors), len(changed))
		}
		for i, c := range changed {
			if len(vectors[i]) != ix.embedder.Dimensions() {
				return Report{}, fmt.Errorf("embed chunks: vector has %d dimensions, expected %d",
					len(vectors[i]), ix.embedder.Dimensions())
			}
			upserts = append(upserts, StoredChunk{Chunk: c, Hash: hashes[i], Embedding: vectors[i]})
		}
	}

	deleted, err := ix.store.Sync(ctx, upserts, keep)
	if err != nil {
		return Report{}, err
	}
	return Report{
		Chunks:    len(chunks),
		Embedded:  len(upserts),
		Unchanged: len(chunks) - len(upserts),
		Deleted:   deleted,
		Warnings:  warnings,
		Duration:  time.Since(start).Round(time.Millisecond).String(),
	}, nil
}

// hash identifies what was embedded. Including the model and dimensions
// means switching models automatically re-embeds everything.
func (ix *Indexer) hash(c Chunk) string {
	h := sha256.New()
	for _, part := range []string{
		ix.embedder.EmbeddingModel(), strconv.Itoa(ix.embedder.Dimensions()),
		c.Source, c.Title, c.Section, c.URL, c.Content,
	} {
		h.Write([]byte(part))
		h.Write([]byte{0}) // separator, so ("ab","c") ≠ ("a","bc")
	}
	return hex.EncodeToString(h.Sum(nil))
}

// dedupe drops chunks with a duplicate key (keeps the first), which could
// otherwise make the upsert touch the same row twice.
func dedupe(chunks []Chunk) []Chunk {
	seen := make(map[string]bool, len(chunks))
	out := chunks[:0]
	for _, c := range chunks {
		if !seen[c.Key] {
			seen[c.Key] = true
			out = append(out, c)
		}
	}
	return out
}
