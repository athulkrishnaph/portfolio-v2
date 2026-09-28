// Package chat implements the portfolio chatbot endpoint: it retrieves
// relevant portfolio chunks (package rag) and asks Gemini (package gemini)
// for an answer grounded in them.
//
//	POST /api/chat          {message, history?} → {answer, sources}
//	POST /api/chat/stream   same request, answer streamed as Server-Sent Events
package chat

import "errors"

// Role of a conversation turn sent by the browser.
type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

// Turn is one earlier message, so follow-up questions ("which of those use
// Go?") make sense. The browser keeps the conversation; the server is stateless.
type Turn struct {
	Role    Role   `json:"role"`
	Content string `json:"content"`
}

// Request is the body of POST /api/chat and /api/chat/stream.
type Request struct {
	Message string `json:"message"`
	History []Turn `json:"history"`
}

// Source is a citation: the portfolio item an answer is based on.
type Source struct {
	Title  string `json:"title"`
	Source string `json:"source"` // projects, experience, skills, resume, …
	URL    string `json:"url"`    // page on the site (or the resume PDF)
}

// Response is the body returned by POST /api/chat.
type Response struct {
	Answer  string   `json:"answer"`
	Sources []Source `json:"sources"`
}

// Request limits (the browser enforces the same ones).
const (
	MaxMessageChars      = 500
	MaxHistoryTurnChars  = 4000
	MaxHistoryTurnsInput = 20
)

var (
	// ErrDailyLimit means the site-wide daily question cap is reached.
	ErrDailyLimit = errors.New("chat: daily limit reached")
	// ErrEmptyAnswer means the model returned no text.
	ErrEmptyAnswer = errors.New("chat: empty answer")
)
