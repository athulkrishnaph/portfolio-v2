package server

import (
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"portfolio/internal/httpx"
)

// spaHandler serves the built Angular app (STATIC_DIR) in production, so the
// site and the API share one origin and one server:
//
//   - existing files (main-3F2A.js, styles.css, favicon.ico) are served as is
//   - any other path (/projects/task-flow, /admin/login) gets index.html, and
//     the Angular router takes over in the browser
//   - unknown /api/ paths still return the JSON 404, never index.html
func spaHandler(dir string) http.Handler {
	files := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean("/" + r.URL.Path)
		if strings.HasPrefix(p, "/api/") || p == "/api" {
			httpx.Error(w, http.StatusNotFound, "NOT_FOUND", "Resource not found")
			return
		}

		if info, err := os.Stat(filepath.Join(dir, filepath.FromSlash(p))); err == nil && !info.IsDir() {
			// Angular puts a content hash in JS/CSS file names, so those can be
			// cached "forever"; other files are revalidated.
			if isHashedAsset(p) {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			files.ServeHTTP(w, r)
			return
		}

		// index.html must never be cached, or users would keep loading old
		// bundles after a deploy.
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, index)
	})
}

// isHashedAsset recognises Angular output like "main-ABCD1234.js" or
// "chunk-XYZ98765.js".
func isHashedAsset(p string) bool {
	ext := path.Ext(p)
	if ext != ".js" && ext != ".css" {
		return false
	}
	name := strings.TrimSuffix(path.Base(p), ext)
	i := strings.LastIndexByte(name, '-')
	return i > 0 && len(name)-i-1 >= 8
}
