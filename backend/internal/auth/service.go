package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"golang.org/x/crypto/bcrypt"

	"portfolio/internal/validate"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrUserNotFound       = errors.New("user not found")
	ErrEmailTaken         = errors.New("email is already registered")
	// ErrGoogleNotAllowed means the Google account is valid but is not an admin.
	ErrGoogleNotAllowed = errors.New("this Google account is not an admin")
	// ErrGoogleDisabled means GOOGLE_CLIENT_ID is not configured.
	ErrGoogleDisabled = errors.New("Google sign-in is not enabled")
)

const (
	// MinPasswordLength is enforced when a password is set (not at login).
	MinPasswordLength = 10
	// bcrypt only uses the first 72 bytes of a password; longer ones are rejected.
	maxPasswordBytes = 72
)

// userStore is the part of Repository the service needs. Declaring it here
// lets tests pass an in-memory fake instead of a real database.
type userStore interface {
	GetByEmail(ctx context.Context, email string) (User, error)
	GetByID(ctx context.Context, id int64) (User, error)
	Create(ctx context.Context, email, passwordHash string) (User, error)
	UpdatePassword(ctx context.Context, id int64, passwordHash string) (User, error)
}

// googleVerifier is the part of GoogleVerifier the service needs (faked in tests).
type googleVerifier interface {
	ClientID() string
	Verify(ctx context.Context, idToken string) (GoogleIdentity, error)
}

// Service contains the authentication business logic.
type Service struct {
	users  userStore
	tokens *TokenManager
	google googleVerifier // nil when Google sign-in is off
}

// NewService creates a Service.
func NewService(users userStore, tokens *TokenManager) *Service {
	return &Service{users: users, tokens: tokens}
}

// EnableGoogle turns on Google sign-in alongside the password login.
func (s *Service) EnableGoogle(v googleVerifier) {
	s.google = v
}

// GoogleClientID is the OAuth client ID for the sign-in button, or "" when
// Google sign-in is off.
func (s *Service) GoogleClientID() string {
	if s.google == nil {
		return ""
	}
	return s.google.ClientID()
}

// LoginWithGoogle verifies a Google ID token and signs in the admin account
// with the same (verified) email. It never creates accounts.
func (s *Service) LoginWithGoogle(ctx context.Context, in GoogleLoginInput) (Session, error) {
	if s.google == nil {
		return Session{}, ErrGoogleDisabled
	}
	v := validate.New()
	v.Check(validate.NotBlank(in.Credential), "credential", "Google credential is required")
	if err := v.Err(); err != nil {
		return Session{}, err
	}

	identity, err := s.google.Verify(ctx, in.Credential)
	if err != nil {
		return Session{}, err
	}
	// An unverified email could belong to someone else.
	if !identity.EmailVerified {
		return Session{}, ErrGoogleNotAllowed
	}
	user, err := s.users.GetByEmail(ctx, identity.Email)
	if errors.Is(err, ErrUserNotFound) {
		return Session{}, ErrGoogleNotAllowed
	}
	if err != nil {
		return Session{}, err
	}
	return s.newSession(user)
}

// Login checks the credentials and returns a new session token.
func (s *Service) Login(ctx context.Context, in LoginInput) (Session, error) {
	v := validate.New()
	v.Check(validate.NotBlank(in.Email), "email", "Email is required")
	v.Check(in.Password != "", "password", "Password is required")
	if err := v.Err(); err != nil {
		return Session{}, err
	}

	user, err := s.users.GetByEmail(ctx, strings.TrimSpace(in.Email))
	if errors.Is(err, ErrUserNotFound) {
		// Compare against a dummy hash anyway so a wrong email takes as long
		// as a wrong password. Otherwise response timing would reveal which
		// emails have accounts.
		_ = bcrypt.CompareHashAndPassword(dummyHash(), []byte(in.Password))
		return Session{}, ErrInvalidCredentials
	}
	if err != nil {
		return Session{}, err
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.Password)) != nil {
		return Session{}, ErrInvalidCredentials
	}
	return s.newSession(user)
}

// Authenticate verifies a bearer token and returns the user it belongs to.
func (s *Service) Authenticate(ctx context.Context, token string) (User, error) {
	claims, err := s.tokens.Parse(token)
	if err != nil {
		return User{}, err
	}
	user, err := s.users.GetByID(ctx, claims.UserID)
	if errors.Is(err, ErrUserNotFound) {
		return User{}, ErrInvalidToken // account was deleted
	}
	if err != nil {
		return User{}, err
	}
	// Tokens issued before the last password change are no longer valid.
	if claims.PasswordVersion != passwordVersion(user.PasswordHash) {
		return User{}, ErrInvalidToken
	}
	return user, nil
}

// ChangePassword verifies the current password, stores the new one and
// returns a fresh session (the old token stops working).
func (s *Service) ChangePassword(ctx context.Context, user User, in ChangePasswordInput) (Session, error) {
	v := validate.New()
	v.Check(in.CurrentPassword != "", "currentPassword", "Current password is required")
	checkNewPassword(v, "newPassword", in.NewPassword)
	if err := v.Err(); err != nil {
		return Session{}, err
	}

	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(in.CurrentPassword)) != nil {
		return Session{}, &validate.Error{Fields: map[string]string{
			"currentPassword": "Current password is incorrect",
		}}
	}

	hash, err := hashPassword(in.NewPassword)
	if err != nil {
		return Session{}, err
	}
	updated, err := s.users.UpdatePassword(ctx, user.ID, hash)
	if err != nil {
		return Session{}, err
	}
	return s.newSession(updated)
}

// CreateAdmin creates an admin account. Used by the createadmin command.
func (s *Service) CreateAdmin(ctx context.Context, email, password string) (User, error) {
	email = strings.TrimSpace(email)
	v := validate.New()
	v.Check(validate.IsEmail(email), "email", "a valid email is required")
	checkNewPassword(v, "password", password)
	if err := v.Err(); err != nil {
		return User{}, err
	}

	hash, err := hashPassword(password)
	if err != nil {
		return User{}, err
	}
	return s.users.Create(ctx, email, hash)
}

// ResetPassword sets a new password for an existing account without knowing
// the old one. Used by the createadmin command with -reset.
func (s *Service) ResetPassword(ctx context.Context, email, password string) (User, error) {
	v := validate.New()
	checkNewPassword(v, "password", password)
	if err := v.Err(); err != nil {
		return User{}, err
	}
	user, err := s.users.GetByEmail(ctx, strings.TrimSpace(email))
	if err != nil {
		return User{}, err
	}
	hash, err := hashPassword(password)
	if err != nil {
		return User{}, err
	}
	return s.users.UpdatePassword(ctx, user.ID, hash)
}

func (s *Service) newSession(user User) (Session, error) {
	token, expiresAt, err := s.tokens.Issue(user)
	if err != nil {
		return Session{}, fmt.Errorf("issue token: %w", err)
	}
	return Session{Token: token, ExpiresAt: expiresAt, User: user}, nil
}

func checkNewPassword(v *validate.Validator, field, password string) {
	v.Check(len([]rune(password)) >= MinPasswordLength, field,
		fmt.Sprintf("Password must be at least %d characters", MinPasswordLength))
	v.Check(len(password) <= maxPasswordBytes, field,
		fmt.Sprintf("Password must be at most %d bytes", maxPasswordBytes))
}

func hashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

// dummyHash is computed once, on first use, for constant-time login failures.
var dummyHash = sync.OnceValue(func() []byte {
	h, _ := bcrypt.GenerateFromPassword([]byte("dummy-password-for-timing"), bcryptCost)
	return h
})

// bcryptCost controls how slow hashing is (each +1 doubles the work).
// It is a variable only so tests can use bcrypt.MinCost.
var bcryptCost = 12
