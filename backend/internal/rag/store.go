package rag

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store reads and writes the knowledge_chunks and knowledge_documents tables.
type Store struct {
	db *pgxpool.Pool
}

// NewStore creates a Store.
func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

// Match is a chunk found by Search, with its cosine similarity (0–1, higher
// is more similar).
type Match struct {
	Chunk
	Similarity float64
}

// Search returns up to limit chunks whose embedding is at least minSimilarity
// similar to the query embedding, most similar first.
//
// `<=>` is pgvector's cosine distance (0 = same direction), so
// similarity = 1 - distance. The query vector is a bound parameter; it is
// never pasted into the SQL text.
func (s *Store) Search(ctx context.Context, embedding []float32, limit int, minSimilarity float64) ([]Match, error) {
	rows, err := s.db.Query(ctx, `
		SELECT chunk_key, source, title, section, url, content, similarity
		FROM (
			SELECT chunk_key, source, title, section, url, content,
			       1 - (embedding <=> $1::vector) AS similarity
			FROM knowledge_chunks
			ORDER BY embedding <=> $1::vector
			LIMIT $2
		) AS nearest
		WHERE similarity >= $3
		ORDER BY similarity DESC`,
		vectorLiteral(embedding), limit, minSimilarity)
	if err != nil {
		return nil, fmt.Errorf("search knowledge: %w", err)
	}
	matches, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (Match, error) {
		var m Match
		err := row.Scan(&m.Key, &m.Source, &m.Title, &m.Section, &m.URL, &m.Content, &m.Similarity)
		return m, err
	})
	if err != nil {
		return nil, fmt.Errorf("search knowledge: %w", err)
	}
	return matches, nil
}

// Hashes returns chunk_key → content_hash for every stored chunk.
func (s *Store) Hashes(ctx context.Context) (map[string]string, error) {
	rows, err := s.db.Query(ctx, `SELECT chunk_key, content_hash FROM knowledge_chunks`)
	if err != nil {
		return nil, fmt.Errorf("read chunk hashes: %w", err)
	}
	out := map[string]string{}
	var key, hash string
	_, err = pgx.ForEachRow(rows, []any{&key, &hash}, func() error {
		out[key] = hash
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("read chunk hashes: %w", err)
	}
	return out, nil
}

// StoredChunk is a chunk ready to be saved.
type StoredChunk struct {
	Chunk
	Hash      string
	Embedding []float32
}

// Sync makes the table contain exactly `keep` chunk keys: it inserts or
// updates the given chunks and deletes every chunk whose key is not in keep
// (content that was removed from the portfolio). All in one transaction, so
// visitors never see a half-updated knowledge base.
func (s *Store) Sync(ctx context.Context, upserts []StoredChunk, keep []string) (deleted int64, err error) {
	if keep == nil {
		// A nil slice is sent as SQL NULL, and `= ANY(NULL)` matches nothing,
		// so stale rows would silently survive. An empty array deletes them.
		keep = []string{}
	}
	err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		for _, c := range upserts {
			_, err := tx.Exec(ctx, `
				INSERT INTO knowledge_chunks
					(chunk_key, source, title, section, url, content, content_hash, embedding)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
				ON CONFLICT (chunk_key) DO UPDATE SET
					source = EXCLUDED.source, title = EXCLUDED.title, section = EXCLUDED.section,
					url = EXCLUDED.url, content = EXCLUDED.content,
					content_hash = EXCLUDED.content_hash, embedding = EXCLUDED.embedding`,
				c.Key, c.Source, c.Title, c.Section, c.URL, c.Content, c.Hash, vectorLiteral(c.Embedding))
			if err != nil {
				return fmt.Errorf("save chunk %s: %w", c.Key, err)
			}
		}
		tag, err := tx.Exec(ctx, `DELETE FROM knowledge_chunks WHERE NOT (chunk_key = ANY($1))`, keep)
		if err != nil {
			return fmt.Errorf("delete stale chunks: %w", err)
		}
		deleted = tag.RowsAffected()
		return nil
	})
	return deleted, err
}

// Stats describes the knowledge base, for the admin dashboard.
type Stats struct {
	Chunks        int        `json:"chunks"`
	LastIndexedAt *time.Time `json:"lastIndexedAt"`
}

// Stats returns the number of chunks and when the newest one was written.
func (s *Store) Stats(ctx context.Context) (Stats, error) {
	var st Stats
	err := s.db.QueryRow(ctx, `SELECT count(*), max(updated_at) FROM knowledge_chunks`).
		Scan(&st.Chunks, &st.LastIndexedAt)
	if err != nil {
		return Stats{}, fmt.Errorf("knowledge stats: %w", err)
	}
	return st, nil
}

// EmbeddingDimensions returns N of the vector(N) embedding column, so the
// API can refuse to run with a mismatching GEMINI_EMBEDDING_DIMENSIONS.
// For pgvector columns, atttypmod holds the dimension.
func (s *Store) EmbeddingDimensions(ctx context.Context) (int, error) {
	var dims int
	err := s.db.QueryRow(ctx, `
		SELECT atttypmod FROM pg_attribute
		WHERE attrelid = 'knowledge_chunks'::regclass AND attname = 'embedding'`).Scan(&dims)
	if err != nil {
		return 0, fmt.Errorf("read embedding dimension (has migration 008 run?): %w", err)
	}
	return dims, nil
}

// CachedDocument returns previously extracted text for a file, if the file
// is unchanged (same hash).
func (s *Store) CachedDocument(ctx context.Context, key, fileHash string) (string, bool, error) {
	var text string
	err := s.db.QueryRow(ctx,
		`SELECT text FROM knowledge_documents WHERE document_key = $1 AND file_hash = $2`,
		key, fileHash).Scan(&text)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("read cached document: %w", err)
	}
	return text, true, nil
}

// SaveDocument stores extracted text for a file.
func (s *Store) SaveDocument(ctx context.Context, key, fileHash, text string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO knowledge_documents (document_key, file_hash, text) VALUES ($1, $2, $3)
		ON CONFLICT (document_key) DO UPDATE SET file_hash = EXCLUDED.file_hash, text = EXCLUDED.text`,
		key, fileHash, text)
	if err != nil {
		return fmt.Errorf("save cached document: %w", err)
	}
	return nil
}

// vectorLiteral formats an embedding in pgvector's text format, "[0.1,0.2,…]".
// It is always passed as a query parameter and cast with ::vector, which
// avoids adding a pgvector client library as a dependency.
func vectorLiteral(v []float32) string {
	var b strings.Builder
	b.Grow(len(v) * 10)
	b.WriteByte('[')
	for i, x := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(x), 'g', -1, 32))
	}
	b.WriteByte(']')
	return b.String()
}
