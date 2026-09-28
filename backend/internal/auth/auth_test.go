package auth

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"portfolio/internal/validate"
)

func init() {
	bcryptCost = bcrypt.MinCost // keep tests fast
}

// fakeStore is an in-memory userStore.
type fakeStore struct {
	users  map[int64]User
	nextID int64
}

func newFakeStore() *fakeStore { return &fakeStore{users: map[int64]User{}, nextID: 1} }

func (f *fakeStore) GetByEmail(_ context.Context, email string) (User, error) {
	for _, u := range f.users {
		if strings.EqualFold(u.Email, email) {
			return u, nil
		}
	}
	return User{}, ErrUserNotFound
}

func (f *fakeStore) GetByID(_ context.Context, id int64) (User, error) {
	u, ok := f.users[id]
	if !ok {
		return User{}, ErrUserNotFound
	}
	return u, nil
}

func (f *fakeStore) Create(ctx context.Context, email, hash string) (User, error) {
	if _, err := f.GetByEmail(ctx, email); err == nil {
		return User{}, ErrEmailTaken
	}
	u := User{ID: f.nextID, Email: email, PasswordHash: hash, UpdatedAt: time.Now()}
	f.users[u.ID] = u
	f.nextID++
	return u, nil
}

func (f *fakeStore) UpdatePassword(_ context.Context, id int64, hash string) (User, error) {
	u := f.users[id]
	u.PasswordHash = hash
	f.users[id] = u
	return u, nil
}

const testSecret = "test-secret-that-is-at-least-32-characters"

func newTestService(t *testing.T) *Service {
	t.Helper()
	svc := NewService(newFakeStore(), NewTokenManager(testSecret, time.Hour))
	if _, err := svc.CreateAdmin(context.Background(), "admin@example.com", "correct-horse-battery"); err != nil {
		t.Fatalf("CreateAdmin: %v", err)
	}
	return svc
}

func TestLogin(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()

	t.Run("success, email is case-insensitive", func(t *testing.T) {
		s, err := svc.Login(ctx, LoginInput{Email: " Admin@Example.com ", Password: "correct-horse-battery"})
		if err != nil {
			t.Fatalf("Login: %v", err)
		}
		if s.Token == "" || s.User.Email != "admin@example.com" {
			t.Errorf("unexpected session %+v", s)
		}
	})

	t.Run("wrong password", func(t *testing.T) {
		_, err := svc.Login(ctx, LoginInput{Email: "admin@example.com", Password: "wrong-password"})
		if !errors.Is(err, ErrInvalidCredentials) {
			t.Errorf("err = %v, want ErrInvalidCredentials", err)
		}
	})

	t.Run("unknown email gives the same error", func(t *testing.T) {
		_, err := svc.Login(ctx, LoginInput{Email: "nobody@example.com", Password: "whatever"})
		if !errors.Is(err, ErrInvalidCredentials) {
			t.Errorf("err = %v, want ErrInvalidCredentials", err)
		}
	})

	t.Run("missing fields", func(t *testing.T) {
		_, err := svc.Login(ctx, LoginInput{})
		var verr *validate.Error
		if !errors.As(err, &verr) || verr.Fields["email"] == "" || verr.Fields["password"] == "" {
			t.Errorf("err = %v, want validation errors for email and password", err)
		}
	})
}

func TestCreateAdminValidation(t *testing.T) {
	svc := NewService(newFakeStore(), NewTokenManager(testSecret, time.Hour))
	ctx := context.Background()

	var verr *validate.Error
	if _, err := svc.CreateAdmin(ctx, "not-an-email", "short"); !errors.As(err, &verr) || len(verr.Fields) != 2 {
		t.Errorf("err = %v, want 2 field errors", err)
	}
	if _, err := svc.CreateAdmin(ctx, "a@b.co", strings.Repeat("x", 73)); !errors.As(err, &verr) {
		t.Errorf("err = %v, want too-long password error", err)
	}

	u, err := svc.CreateAdmin(ctx, "a@b.co", "long-enough-password")
	if err != nil {
		t.Fatal(err)
	}
	if u.PasswordHash == "long-enough-password" || !strings.HasPrefix(u.PasswordHash, "$2") {
		t.Errorf("password must be stored as a bcrypt hash, got %q", u.PasswordHash)
	}
	if _, err := svc.CreateAdmin(ctx, "A@B.co", "long-enough-password"); !errors.Is(err, ErrEmailTaken) {
		t.Errorf("err = %v, want ErrEmailTaken", err)
	}
}

func TestTokens(t *testing.T) {
	m := NewTokenManager(testSecret, time.Hour)
	user := User{ID: 7, PasswordHash: "$2a$hash"}

	token, _, err := m.Issue(user)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := m.Parse(token)
	if err != nil || claims.UserID != 7 {
		t.Fatalf("Parse = %+v, %v", claims, err)
	}

	t.Run("wrong secret", func(t *testing.T) {
		other := NewTokenManager("another-secret-that-is-32-characters-long", time.Hour)
		if _, err := other.Parse(token); !errors.Is(err, ErrInvalidToken) {
			t.Errorf("err = %v, want ErrInvalidToken", err)
		}
	})

	t.Run("expired", func(t *testing.T) {
		later := NewTokenManager(testSecret, time.Hour)
		later.now = func() time.Time { return time.Now().Add(2 * time.Hour) }
		if _, err := later.Parse(token); !errors.Is(err, ErrInvalidToken) {
			t.Errorf("err = %v, want ErrInvalidToken", err)
		}
	})

	t.Run("alg none is rejected", func(t *testing.T) {
		// header {"alg":"none","typ":"JWT"} + the real payload + empty signature
		parts := strings.Split(token, ".")
		forged := "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0." + parts[1] + "."
		if _, err := m.Parse(forged); !errors.Is(err, ErrInvalidToken) {
			t.Errorf("err = %v, want ErrInvalidToken", err)
		}
	})
}

func TestChangePasswordInvalidatesOldTokens(t *testing.T) {
	svc := newTestService(t)
	ctx := context.Background()

	old, err := svc.Login(ctx, LoginInput{Email: "admin@example.com", Password: "correct-horse-battery"})
	if err != nil {
		t.Fatal(err)
	}

	_, err = svc.ChangePassword(ctx, old.User, ChangePasswordInput{CurrentPassword: "wrong", NewPassword: "new-password-123"})
	var verr *validate.Error
	if !errors.As(err, &verr) || verr.Fields["currentPassword"] == "" {
		t.Fatalf("err = %v, want currentPassword validation error", err)
	}

	fresh, err := svc.ChangePassword(ctx, old.User, ChangePasswordInput{CurrentPassword: "correct-horse-battery", NewPassword: "new-password-123"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Authenticate(ctx, old.Token); !errors.Is(err, ErrInvalidToken) {
		t.Errorf("old token: err = %v, want ErrInvalidToken", err)
	}
	if _, err := svc.Authenticate(ctx, fresh.Token); err != nil {
		t.Errorf("new token: %v", err)
	}
}

func TestRequireAuth(t *testing.T) {
	svc := newTestService(t)
	session, err := svc.Login(context.Background(), LoginInput{Email: "admin@example.com", Password: "correct-horse-battery"})
	if err != nil {
		t.Fatal(err)
	}

	protected := svc.RequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := UserFromContext(r.Context())
		if !ok || u.Email != "admin@example.com" {
			t.Errorf("user not in context: %+v", u)
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	tests := []struct {
		name       string
		header     string
		wantStatus int
		wantCode   string
	}{
		{"valid token", "Bearer " + session.Token, http.StatusNoContent, ""},
		{"lowercase scheme", "bearer " + session.Token, http.StatusNoContent, ""},
		{"no header", "", http.StatusUnauthorized, "UNAUTHORIZED"},
		{"wrong scheme", "Basic abc", http.StatusUnauthorized, "UNAUTHORIZED"},
		{"garbage token", "Bearer not.a.jwt", http.StatusUnauthorized, "INVALID_TOKEN"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/auth/me", nil)
			if tt.header != "" {
				req.Header.Set("Authorization", tt.header)
			}
			rec := httptest.NewRecorder()
			protected.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if tt.wantCode != "" && !strings.Contains(rec.Body.String(), tt.wantCode) {
				t.Errorf("body = %s, want code %s", rec.Body.String(), tt.wantCode)
			}
		})
	}
}

func TestLoginHandler(t *testing.T) {
	svc := newTestService(t)
	mux := http.NewServeMux()
	noLimit := func(h http.Handler) http.Handler { return h }
	NewHandler(svc).Routes(mux, noLimit)

	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantBody   string
	}{
		{"success", `{"email":"admin@example.com","password":"correct-horse-battery"}`, http.StatusOK, `"token"`},
		{"wrong password", `{"email":"admin@example.com","password":"nope"}`, http.StatusUnauthorized, "INVALID_CREDENTIALS"},
		{"missing fields", `{}`, http.StatusUnprocessableEntity, "VALIDATION_FAILED"},
		{"bad json", `{`, http.StatusBadRequest, "INVALID_JSON"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, httptest.NewRequest("POST", "/api/auth/login", strings.NewReader(tt.body)))
			if rec.Code != tt.wantStatus {
				t.Errorf("status = %d, want %d (body %s)", rec.Code, tt.wantStatus, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), tt.wantBody) {
				t.Errorf("body = %s, want %s", rec.Body.String(), tt.wantBody)
			}
			if strings.Contains(rec.Body.String(), "$2a$") {
				t.Error("password hash leaked in response")
			}
		})
	}
}
