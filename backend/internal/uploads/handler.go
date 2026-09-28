// Package uploads handles file uploads from the admin portal.
//
// The admin uploads a file first (POST /api/uploads) and receives its URL;
// the URL is then saved on the project/certificate/profile like any other
// field. This keeps the content endpoints plain JSON.
package uploads

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"

	"portfolio/internal/httpx"
	"portfolio/internal/middleware"
	"portfolio/internal/storage"
)

// MaxFileBytes is the largest accepted upload.
const MaxFileBytes = 5 << 20 // 5 MB

// allowedTypes maps accepted content types to file extensions. The type is
// detected from the file's first bytes, not trusted from the client. SVG is
// deliberately not allowed: it can contain scripts.
var allowedTypes = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/gif":       ".gif",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
}

// Handler exposes the upload endpoint.
type Handler struct {
	store storage.Storage
}

// NewHandler creates a Handler.
func NewHandler(store storage.Storage) *Handler {
	return &Handler{store: store}
}

// Routes registers POST /api/uploads (admin only).
func (h *Handler) Routes(mux *http.ServeMux, requireAuth middleware.Middleware) {
	mux.Handle("POST /api/uploads", requireAuth(http.HandlerFunc(h.upload)))
}

// UploadResult is the response body of a successful upload.
type UploadResult struct {
	URL         string `json:"url"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

// upload accepts multipart/form-data with a single "file" field.
func (h *Handler) upload(w http.ResponseWriter, r *http.Request) {
	// Allow a little extra for the multipart headers around the file.
	r.Body = http.MaxBytesReader(w, r.Body, MaxFileBytes+64<<10)

	file, header, err := r.FormFile("file")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			httpx.Error(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "The file must be 5 MB or smaller")
			return
		}
		httpx.Error(w, http.StatusBadRequest, "INVALID_UPLOAD", `Send the file as multipart/form-data in a field named "file"`)
		return
	}
	defer file.Close()

	if header.Size > MaxFileBytes {
		httpx.Error(w, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "The file must be 5 MB or smaller")
		return
	}

	// Sniff the real type from the first 512 bytes, then rewind.
	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		httpx.InternalError(w, r, err)
		return
	}
	contentType := http.DetectContentType(head[:n])
	ext, ok := allowedTypes[contentType]
	if !ok {
		httpx.Error(w, http.StatusUnsupportedMediaType, "UNSUPPORTED_FILE_TYPE",
			"Only JPEG, PNG, GIF, WebP images and PDF files are allowed")
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		httpx.InternalError(w, r, err)
		return
	}

	url, err := h.store.Save(r.Context(), randomName()+ext, contentType, file)
	if err != nil {
		httpx.InternalError(w, r, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, UploadResult{URL: url, ContentType: contentType, Size: header.Size})
}

// randomName returns 32 random hex characters, so file names cannot be
// guessed and never collide.
func randomName() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
