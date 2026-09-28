// Package gemini is a thin wrapper around Google's official Gen AI SDK
// (google.golang.org/genai) with just what the portfolio chatbot needs:
// embeddings, answer generation (plain and streaming) and PDF-to-text.
//
// The API key is only ever held here, on the server. It is sent to Google in
// a request header by the SDK and is never logged or returned to clients.
package gemini

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"strings"
	"time"

	"google.golang.org/genai"
)

// Errors callers can react to without knowing about the SDK.
var (
	// ErrRateLimited means the Gemini quota (e.g. the free tier's requests
	// per minute/day) is used up for now.
	ErrRateLimited = errors.New("gemini: rate limit or quota exceeded")
	// ErrBlocked means Gemini refused to answer (safety filters).
	ErrBlocked = errors.New("gemini: response blocked")
)

// Config selects the models. See .env.example for the defaults.
type Config struct {
	APIKey              string
	Model               string // text generation, e.g. "gemini-3.5-flash-lite"
	EmbeddingModel      string // e.g. "gemini-embedding-2"
	EmbeddingDimensions int    // must match the vector(N) column
}

// Client talks to the Gemini API.
type Client struct {
	sdk  *genai.Client
	cfg  Config
	keys []string // secrets to scrub from error messages
}

// New creates a Client. It does not contact the API.
func New(ctx context.Context, cfg Config) (*Client, error) {
	if cfg.APIKey == "" {
		return nil, errors.New("gemini: API key is empty")
	}
	sdk, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:     cfg.APIKey,
		Backend:    genai.BackendGeminiAPI,
		HTTPClient: &http.Client{Timeout: 90 * time.Second},
	})
	if err != nil {
		return nil, fmt.Errorf("gemini: create client: %w", err)
	}
	return &Client{sdk: sdk, cfg: cfg, keys: []string{cfg.APIKey}}, nil
}

// EmbeddingModel returns the configured embedding model.
func (c *Client) EmbeddingModel() string { return c.cfg.EmbeddingModel }

// Dimensions returns the configured embedding size.
func (c *Client) Dimensions() int { return c.cfg.EmbeddingDimensions }

// ---- Embeddings ----------------------------------------------------------------

// Document is a piece of text to embed for retrieval.
type Document struct {
	Title string
	Text  string
}

// embedBatchSize stays under the API's limit of texts per request.
const embedBatchSize = 50

// EmbedDocuments embeds documents for storage in the knowledge base.
func (c *Client) EmbedDocuments(ctx context.Context, docs []Document) ([][]float32, error) {
	out := make([][]float32, 0, len(docs))
	for start := 0; start < len(docs); start += embedBatchSize {
		end := min(start+embedBatchSize, len(docs))
		texts := make([]string, 0, end-start)
		for _, d := range docs[start:end] {
			texts = append(texts, c.documentText(d))
		}
		vectors, err := c.embed(ctx, texts, "RETRIEVAL_DOCUMENT")
		if err != nil {
			return nil, err
		}
		out = append(out, vectors...)
	}
	return out, nil
}

// EmbedQueries embeds one or more search queries in a single API call.
func (c *Client) EmbedQueries(ctx context.Context, queries []string) ([][]float32, error) {
	texts := make([]string, len(queries))
	for i, q := range queries {
		texts[i] = c.queryText(q)
	}
	return c.embed(ctx, texts, "RETRIEVAL_QUERY")
}

func (c *Client) embed(ctx context.Context, texts []string, taskType string) ([][]float32, error) {
	contents := make([]*genai.Content, len(texts))
	for i, t := range texts {
		contents[i] = genai.NewContentFromText(t, genai.RoleUser)
	}
	dims := int32(c.cfg.EmbeddingDimensions)
	cfg := &genai.EmbedContentConfig{OutputDimensionality: &dims}
	if usesTaskTypes(c.cfg.EmbeddingModel) {
		cfg.TaskType = taskType
	}

	res, err := c.sdk.Models.EmbedContent(ctx, c.cfg.EmbeddingModel, contents, cfg)
	if err != nil {
		return nil, c.wrap("embed", err)
	}
	if len(res.Embeddings) != len(texts) {
		return nil, fmt.Errorf("gemini: embed: got %d embeddings for %d texts", len(res.Embeddings), len(texts))
	}
	out := make([][]float32, len(res.Embeddings))
	for i, e := range res.Embeddings {
		out[i] = e.Values
	}
	return out, nil
}

// Retrieval embeddings work best when documents and questions are marked
// as such. gemini-embedding-001 takes a task type parameter; newer models
// (gemini-embedding-2) expect the task written into the text itself.
func usesTaskTypes(model string) bool {
	return strings.Contains(model, "embedding-001")
}

func (c *Client) documentText(d Document) string {
	if usesTaskTypes(c.cfg.EmbeddingModel) {
		return d.Text
	}
	title := d.Title
	if title == "" {
		title = "none"
	}
	return "title: " + title + " | text: " + d.Text
}

func (c *Client) queryText(q string) string {
	if usesTaskTypes(c.cfg.EmbeddingModel) {
		return q
	}
	return "task: question answering | query: " + q
}

// ---- Generation -------------------------------------------------------------------

// Role of a chat message.
type Role string

const (
	RoleUser  Role = "user"
	RoleModel Role = "model"
)

// Message is one turn of a conversation.
type Message struct {
	Role Role
	Text string
}

// GenerateRequest is a prompt for the text model.
type GenerateRequest struct {
	// System is sent through Gemini's dedicated system-instruction field,
	// separate from user-controlled content.
	System          string
	Messages        []Message
	MaxOutputTokens int
	Temperature     float32
}

// Generate returns the model's complete answer.
func (c *Client) Generate(ctx context.Context, req GenerateRequest) (string, error) {
	res, err := c.sdk.Models.GenerateContent(ctx, c.cfg.Model, contents(req.Messages), c.generateConfig(req))
	if err != nil {
		return "", c.wrap("generate", err)
	}
	return responseText(res)
}

// GenerateStream yields the answer in pieces as the model writes it.
func (c *Client) GenerateStream(ctx context.Context, req GenerateRequest) iter.Seq2[string, error] {
	return func(yield func(string, error) bool) {
		for res, err := range c.sdk.Models.GenerateContentStream(ctx, c.cfg.Model, contents(req.Messages), c.generateConfig(req)) {
			if err != nil {
				yield("", c.wrap("generate", err))
				return
			}
			text, err := responseText(res)
			if err != nil {
				yield("", err)
				return
			}
			if text != "" && !yield(text, nil) {
				return
			}
		}
	}
}

func (c *Client) generateConfig(req GenerateRequest) *genai.GenerateContentConfig {
	temp := req.Temperature
	cfg := &genai.GenerateContentConfig{
		Temperature:     &temp,
		MaxOutputTokens: int32(req.MaxOutputTokens),
	}
	if req.System != "" {
		cfg.SystemInstruction = genai.NewContentFromText(req.System, genai.RoleUser)
	}
	return cfg
}

func contents(msgs []Message) []*genai.Content {
	out := make([]*genai.Content, 0, len(msgs))
	for _, m := range msgs {
		role := genai.Role(genai.RoleUser)
		if m.Role == RoleModel {
			role = genai.RoleModel
		}
		out = append(out, genai.NewContentFromText(m.Text, role))
	}
	return out
}

// responseText extracts the text of a (partial) response. An empty candidate
// list with a block reason means the prompt was blocked by safety filters.
func responseText(res *genai.GenerateContentResponse) (string, error) {
	if res == nil {
		return "", nil
	}
	if len(res.Candidates) == 0 && res.PromptFeedback != nil && res.PromptFeedback.BlockReason != "" {
		return "", ErrBlocked
	}
	return res.Text(), nil
}

// ---- PDF --------------------------------------------------------------------------------

// ExtractPDFText asks Gemini to transcribe a PDF (the resume) into Markdown,
// so it can be chunked like any other text. No PDF library is needed.
func (c *Client) ExtractPDFText(ctx context.Context, pdf []byte) (string, error) {
	parts := []*genai.Part{
		genai.NewPartFromBytes(pdf, "application/pdf"),
		genai.NewPartFromText("Transcribe this resume into clean Markdown. " +
			"Copy every fact exactly as written: do not summarise, rephrase, add or omit anything. " +
			"Use '## ' headings for the resume's sections (for example Summary, Experience, Education, " +
			"Skills, Projects, Certifications, Achievements) and '- ' bullet points for lists. " +
			"Output only the Markdown."),
	}
	temp := float32(0)
	res, err := c.sdk.Models.GenerateContent(ctx, c.cfg.Model,
		[]*genai.Content{genai.NewContentFromParts(parts, genai.RoleUser)},
		&genai.GenerateContentConfig{Temperature: &temp, MaxOutputTokens: 8192})
	if err != nil {
		return "", c.wrap("extract PDF", err)
	}
	return responseText(res)
}

// ---- Errors -------------------------------------------------------------------------------

// wrap turns SDK errors into our error values and scrubs the API key from
// the message, in case any error text ever contained it.
func (c *Client) wrap(op string, err error) error {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return fmt.Errorf("gemini: %s: %w", op, err)
	}
	if code := apiErrorCode(err); code == http.StatusTooManyRequests {
		return fmt.Errorf("gemini: %s: %w", op, ErrRateLimited)
	}
	msg := err.Error()
	for _, k := range c.keys {
		if k != "" {
			msg = strings.ReplaceAll(msg, k, "[redacted]")
		}
	}
	return fmt.Errorf("gemini: %s: %s", op, msg)
}

// apiErrorCode returns the HTTP status of an SDK API error, or 0.
func apiErrorCode(err error) int {
	var v genai.APIError
	if errors.As(err, &v) {
		return v.Code
	}
	var p *genai.APIError
	if errors.As(err, &p) && p != nil {
		return p.Code
	}
	return 0
}
