package middleware

import "net/http"

// SecurityHeaders sets conservative browser security headers on every
// response:
//
//   - X-Content-Type-Options: nosniff  browsers must trust Content-Type
//     (stops e.g. an uploaded file being run as a script)
//   - X-Frame-Options: DENY            the site cannot be embedded in
//     other sites' frames (clickjacking)
//   - Referrer-Policy                   only the origin is sent to other sites
//   - Permissions-Policy                turns off powerful features the site never uses
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}
