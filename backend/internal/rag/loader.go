package rag

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"portfolio/internal/certificates"
	"portfolio/internal/education"
	"portfolio/internal/experience"
	"portfolio/internal/profile"
	"portfolio/internal/projects"
	"portfolio/internal/skills"
)

// The loader reads portfolio content through the existing feature
// repositories, so the knowledge base always reflects exactly what the
// public site shows and no SQL is duplicated. These small interfaces are
// satisfied by those repositories (and by fakes in tests).
type (
	profileReader interface {
		Get(context.Context) (profile.Profile, error)
	}
	projectReader interface {
		List(context.Context, bool) ([]projects.Project, error)
	}
	experienceReader interface {
		List(context.Context) ([]experience.Experience, error)
	}
	educationReader interface {
		List(context.Context) ([]education.Education, error)
	}
	certificateReader interface {
		List(context.Context) ([]certificates.Certificate, error)
	}
	skillReader interface {
		List(context.Context) ([]skills.Skill, error)
	}
)

// DocumentCache stores text extracted from files, keyed by the file's hash.
type DocumentCache interface {
	CachedDocument(ctx context.Context, key, fileHash string) (string, bool, error)
	SaveDocument(ctx context.Context, key, fileHash, text string) error
}

// PDFExtractor converts a PDF into plain text (Gemini reads PDFs natively).
type PDFExtractor interface {
	ExtractPDFText(ctx context.Context, pdf []byte) (string, error)
}

// ContentLoader gathers everything the knowledge base is built from.
type ContentLoader struct {
	Profile      profileReader
	Projects     projectReader
	Experience   experienceReader
	Education    educationReader
	Certificates certificateReader
	Skills       skillReader

	Documents DocumentCache
	Extractor PDFExtractor

	// UploadDirectory is where uploaded files (the resume) are read from,
	// instead of downloading them from our own server.
	UploadDirectory string
	// KnowledgeDir holds optional extra *.md files.
	KnowledgeDir string
	HTTPClient   *http.Client
}

// NewContentLoader builds a ContentLoader on top of the existing feature
// repositories. Used by the API server and by cmd/ingest.
func NewContentLoader(db *pgxpool.Pool, docs DocumentCache, extractor PDFExtractor,
	uploadDirectory, knowledgeDir string) *ContentLoader {
	return &ContentLoader{
		Profile:         profile.NewRepository(db),
		Projects:        projects.NewRepository(db),
		Experience:      experience.NewRepository(db),
		Education:       education.NewRepository(db),
		Certificates:    certificates.NewRepository(db),
		Skills:          skills.NewRepository(db),
		Documents:       docs,
		Extractor:       extractor,
		UploadDirectory: uploadDirectory,
		KnowledgeDir:    knowledgeDir,
	}
}

// Limits for files read during ingestion.
const (
	maxResumeBytes   = 10 << 20 // 10 MB
	maxMarkdownBytes = 200 << 10
)

// Load reads all content. Problems with optional sources (resume, Markdown
// files) are returned as warnings instead of failing the whole ingestion.
func (l *ContentLoader) Load(ctx context.Context) (Content, []string, error) {
	var c Content
	var warnings []string

	p, err := l.Profile.Get(ctx)
	switch {
	case errors.Is(err, profile.ErrNotFound):
		// No profile yet: everything else can still be indexed.
	case err != nil:
		return Content{}, nil, err
	default:
		c.Profile = &p
	}
	if c.Projects, err = l.Projects.List(ctx, false); err != nil {
		return Content{}, nil, err
	}
	if c.Experience, err = l.Experience.List(ctx); err != nil {
		return Content{}, nil, err
	}
	if c.Education, err = l.Education.List(ctx); err != nil {
		return Content{}, nil, err
	}
	if c.Certificates, err = l.Certificates.List(ctx); err != nil {
		return Content{}, nil, err
	}
	if c.Skills, err = l.Skills.List(ctx); err != nil {
		return Content{}, nil, err
	}

	if c.Profile != nil && c.Profile.ResumeURL != "" {
		text, err := l.resumeText(ctx, c.Profile.ResumeURL)
		if err != nil {
			warnings = append(warnings, "resume skipped: "+err.Error())
		}
		c.ResumeText = text
	}

	files, fileWarnings := l.markdownFiles()
	c.Markdown = files
	warnings = append(warnings, fileWarnings...)
	return c, warnings, nil
}

// resumeText returns the resume PDF as text. The PDF is only sent to Gemini
// when it has changed since the last ingestion (cached by SHA-256).
func (l *ContentLoader) resumeText(ctx context.Context, resumeURL string) (string, error) {
	pdf, err := l.readResume(ctx, resumeURL)
	if err != nil {
		return "", err
	}
	if !bytes.HasPrefix(pdf, []byte("%PDF-")) {
		return "", errors.New("the resume file is not a PDF")
	}
	sum := sha256.Sum256(pdf)
	hash := hex.EncodeToString(sum[:])

	if text, ok, err := l.Documents.CachedDocument(ctx, "resume", hash); err != nil {
		return "", err
	} else if ok {
		return text, nil
	}
	if l.Extractor == nil {
		return "", errors.New("no PDF extractor configured")
	}
	text, err := l.Extractor.ExtractPDFText(ctx, pdf)
	if err != nil {
		return "", fmt.Errorf("could not read the PDF: %w", err)
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return "", errors.New("no text found in the PDF")
	}
	if err := l.Documents.SaveDocument(ctx, "resume", hash, text); err != nil {
		return "", err
	}
	return text, nil
}

// readResume loads an uploaded file from local disk when the URL points at
// our own /uploads/ folder, otherwise downloads it (http/https only).
func (l *ContentLoader) readResume(ctx context.Context, raw string) ([]byte, error) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return nil, errors.New("the resume URL is not an http(s) URL")
	}

	if strings.HasPrefix(u.Path, "/uploads/") && l.UploadDirectory != "" {
		// path.Base strips any directories, so "../" tricks cannot escape
		// the upload folder.
		name := path.Base(u.Path)
		local := filepath.Join(l.UploadDirectory, name)
		if data, err := readLimited(local, maxResumeBytes); err == nil {
			return data, nil
		}
		// Not on this machine's disk (e.g. uploaded in another environment):
		// fall back to downloading it.
	}

	client := l.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	res, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download failed: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download failed: HTTP %d", res.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(res.Body, maxResumeBytes+1))
	if err != nil {
		return nil, fmt.Errorf("download failed: %w", err)
	}
	if len(data) > maxResumeBytes {
		return nil, errors.New("the resume file is larger than 10 MB")
	}
	return data, nil
}

// markdownFiles reads *.md files from KnowledgeDir. Files whose names start
// with "_" or "README" are skipped, so the folder can document itself.
func (l *ContentLoader) markdownFiles() ([]MarkdownFile, []string) {
	if l.KnowledgeDir == "" {
		return nil, nil
	}
	entries, err := os.ReadDir(l.KnowledgeDir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, []string{"knowledge folder skipped: " + err.Error()}
	}
	var files []MarkdownFile
	var warnings []string
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || !strings.EqualFold(filepath.Ext(name), ".md") ||
			strings.HasPrefix(name, "_") || strings.HasPrefix(strings.ToUpper(name), "README") {
			continue
		}
		data, err := readLimited(filepath.Join(l.KnowledgeDir, name), maxMarkdownBytes)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("%s skipped: %v", name, err))
			continue
		}
		files = append(files, MarkdownFile{Name: strings.TrimSuffix(name, filepath.Ext(name)), Text: string(data)})
	}
	return files, warnings
}

func readLimited(file string, max int64) ([]byte, error) {
	f, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, max+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > max {
		return nil, fmt.Errorf("file is larger than %d bytes", max)
	}
	return data, nil
}
