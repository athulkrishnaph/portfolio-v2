// Package auth handles admin accounts, login and JWT-based authentication.
//
// Flow:
//
//	POST /api/auth/login   email + password → bcrypt check → signed JWT
//	later requests         Authorization: Bearer <jwt> → RequireAuth middleware
//	                       verifies the signature/expiry and loads the user
//
// Logout is done by the client discarding its token. Tokens are short-lived
// (JWT_TTL), and changing the password invalidates all older tokens.
//
// Admin accounts are created from the command line (cmd/createadmin), never
// through the API, so there is no public sign-up endpoint to attack.
package auth

import "time"

// User is an admin account. PasswordHash is never serialised to JSON.
type User struct {
	ID           int64     `json:"id"           db:"id"`
	Email        string    `json:"email"        db:"email"`
	PasswordHash string    `json:"-"            db:"password_hash"`
	CreatedAt    time.Time `json:"createdAt"    db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt"    db:"updated_at"`
}

// LoginInput is the body of POST /api/auth/login.
type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// ChangePasswordInput is the body of PUT /api/auth/password.
type ChangePasswordInput struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

// Session is returned after a successful login or password change.
type Session struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expiresAt"`
	User      User      `json:"user"`
}
