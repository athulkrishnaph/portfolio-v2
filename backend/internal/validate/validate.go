// Package validate collects per-field validation errors.
//
// Services validate their input and return a *validate.Error; handlers turn
// it into a 422 response with httpx.ValidationError. Typical use:
//
//	v := validate.New()
//	v.Required("title", "Title", in.Title)
//	v.MaxLength("title", "Title", in.Title, 200)
//	v.OptionalURL("githubUrl", "GitHub URL", in.GitHubURL)
//	v.Check(in.DisplayOrder >= 0, "displayOrder", "Display order must not be negative")
//	if err := v.Err(); err != nil {
//		return err
//	}
package validate

import (
	"fmt"
	"net/mail"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

// Error lists invalid fields and a message for each one.
type Error struct {
	Fields map[string]string
}

func (e *Error) Error() string {
	return "validation failed"
}

// Validator accumulates field errors. The zero value is not usable; call New.
type Validator struct {
	fields map[string]string
}

// New returns an empty Validator.
func New() *Validator {
	return &Validator{fields: map[string]string{}}
}

// Check records message for field when ok is false. Only the first failed
// check per field is kept, so order checks from most to least basic.
func (v *Validator) Check(ok bool, field, message string) {
	if ok {
		return
	}
	if _, exists := v.fields[field]; !exists {
		v.fields[field] = message
	}
}

// Err returns a *Error if any check failed, otherwise nil.
func (v *Validator) Err() error {
	if len(v.fields) == 0 {
		return nil
	}
	return &Error{Fields: v.fields}
}

// Required checks that value is not blank. label is the human-readable
// field name used in the message, e.g. "Title".
func (v *Validator) Required(field, label, value string) {
	v.Check(NotBlank(value), field, label+" is required")
}

// MaxLength checks that value has at most max characters.
func (v *Validator) MaxLength(field, label, value string, max int) {
	v.Check(MaxLen(value, max), field, fmt.Sprintf("%s must be at most %d characters", label, max))
}

// OptionalURL checks that value is empty or an absolute http(s) URL.
func (v *Validator) OptionalURL(field, label, value string) {
	v.Check(value == "" || IsURL(value), field, label+" must be a valid URL starting with http:// or https://")
	v.MaxLength(field, label, value, MaxURLLength)
}

// MaxURLLength is the longest URL accepted by OptionalURL.
const MaxURLLength = 2000

// DisplayOrder checks a list position: 0 or more (the database also has a
// CHECK for this) and below an arbitrary sane upper limit.
func (v *Validator) DisplayOrder(value int) {
	v.Check(value >= 0 && value <= 1_000_000, "displayOrder", "Display order must be between 0 and 1000000")
}

// DateLayout is the only date format the API accepts and returns.
const DateLayout = "2006-01-02"

// Date checks that value is a real calendar date in YYYY-MM-DD format.
func (v *Validator) Date(field, label, value string) {
	if !NotBlank(value) {
		v.Check(false, field, label+" is required")
		return
	}
	v.Check(IsDate(value), field, label+" must be a valid date (YYYY-MM-DD)")
}

// IsDate reports whether s is a valid YYYY-MM-DD date (e.g. rejects 2024-02-30).
// Such strings also compare correctly as plain strings: "2023-01-31" < "2023-02-01".
func IsDate(s string) bool {
	_, err := time.Parse(DateLayout, s)
	return err == nil
}

// NotBlank reports whether s contains something other than whitespace.
func NotBlank(s string) bool {
	return strings.TrimSpace(s) != ""
}

// MaxLen reports whether s has at most n characters (not bytes).
func MaxLen(s string, n int) bool {
	return utf8.RuneCountInString(s) <= n
}

// IsURL reports whether s is an absolute http or https URL.
func IsURL(s string) bool {
	u, err := url.Parse(s)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}

// IsEmail reports whether s is a plain email address like "me@example.com"
// (no display name, no surrounding spaces).
func IsEmail(s string) bool {
	addr, err := mail.ParseAddress(s)
	return err == nil && addr.Address == s
}
