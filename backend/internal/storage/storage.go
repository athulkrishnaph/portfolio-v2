// Package storage stores uploaded files (images, resume PDFs).
//
// The rest of the application only uses the Storage interface, so the
// local-disk implementation can be swapped for S3, Cloudinary, etc. by adding
// another type that implements it and choosing it in server.New.
package storage

import (
	"context"
	"io"
)

// Storage saves files and returns the public URL they can be loaded from.
type Storage interface {
	// Save stores the content under name (a unique file name including its
	// extension) and returns the file's public URL.
	Save(ctx context.Context, name, contentType string, content io.Reader) (url string, err error)
}
