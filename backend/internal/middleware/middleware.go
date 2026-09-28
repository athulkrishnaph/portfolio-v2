// Package middleware contains HTTP middleware shared by every API route:
// request IDs, access logging, panic recovery and CORS.
//
// A middleware is a function that wraps an http.Handler and returns a new
// one, so it can run code before and after the wrapped handler.
package middleware

import "net/http"

// Middleware wraps a handler with extra behaviour.
type Middleware func(http.Handler) http.Handler

// Chain wraps h with the given middleware. The first middleware in the list
// is the outermost one, so it runs first on the way in and last on the way
// out:
//
//	Chain(h, A, B)  ==  A(B(h))
func Chain(h http.Handler, mws ...Middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}
