package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testClientID = "test-client.apps.googleusercontent.com"

// fakeGoogle serves a JWKS like Google's and signs ID tokens with its key.
type fakeGoogle struct {
	key     *rsa.PrivateKey
	kid     string
	fetches atomic.Int32
	server  *httptest.Server
}

func newFakeGoogle(t *testing.T) *fakeGoogle {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	g := &fakeGoogle{key: key, kid: "key-1"}
	g.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		g.fetches.Add(1)
		w.Header().Set("Cache-Control", "public, max-age=3600")
		json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": g.kid,
			"kty": "RSA",
			"n":   base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	t.Cleanup(g.server.Close)
	return g
}

func (g *fakeGoogle) verifier() *GoogleVerifier {
	v := NewGoogleVerifier(testClientID)
	v.certsURL = g.server.URL
	return v
}

func (g *fakeGoogle) sign(t *testing.T, claims jwt.MapClaims, kid string) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = kid
	s, err := tok.SignedString(g.key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func validGoogleClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss":            "https://accounts.google.com",
		"aud":            testClientID,
		"sub":            "1234567890",
		"email":          "admin@example.com",
		"email_verified": true,
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
	}
}

func TestGoogleVerifier(t *testing.T) {
	g := newFakeGoogle(t)
	v := g.verifier()
	ctx := context.Background()

	t.Run("valid token", func(t *testing.T) {
		id, err := v.Verify(ctx, g.sign(t, validGoogleClaims(), g.kid))
		if err != nil {
			t.Fatalf("Verify: %v", err)
		}
		if id.Email != "admin@example.com" || !id.EmailVerified {
			t.Errorf("identity = %+v", id)
		}
	})

	t.Run("email_verified as a string", func(t *testing.T) {
		c := validGoogleClaims()
		c["email_verified"] = "true"
		id, err := v.Verify(ctx, g.sign(t, c, g.kid))
		if err != nil || !id.EmailVerified {
			t.Errorf("id = %+v, err = %v", id, err)
		}
	})

	reject := map[string]func(jwt.MapClaims){
		"wrong audience": func(c jwt.MapClaims) { c["aud"] = "someone-else" },
		"wrong issuer":   func(c jwt.MapClaims) { c["iss"] = "https://evil.example" },
		"expired":        func(c jwt.MapClaims) { c["exp"] = time.Now().Add(-time.Hour).Unix() },
		"no email":       func(c jwt.MapClaims) { delete(c, "email") },
	}
	for name, change := range reject {
		t.Run(name, func(t *testing.T) {
			c := validGoogleClaims()
			change(c)
			if _, err := v.Verify(ctx, g.sign(t, c, g.kid)); !errors.Is(err, ErrInvalidGoogleToken) {
				t.Errorf("err = %v, want ErrInvalidGoogleToken", err)
			}
		})
	}

	t.Run("signed by another key", func(t *testing.T) {
		other := newFakeGoogle(t)
		if _, err := v.Verify(ctx, other.sign(t, validGoogleClaims(), g.kid)); !errors.Is(err, ErrInvalidGoogleToken) {
			t.Errorf("err = %v, want ErrInvalidGoogleToken", err)
		}
	})

	t.Run("HS256 token is refused", func(t *testing.T) {
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, validGoogleClaims())
		tok.Header["kid"] = g.kid
		s, _ := tok.SignedString([]byte("guess"))
		if _, err := v.Verify(ctx, s); !errors.Is(err, ErrInvalidGoogleToken) {
			t.Errorf("err = %v, want ErrInvalidGoogleToken", err)
		}
	})

	t.Run("keys are cached; unknown key IDs do not refetch every time", func(t *testing.T) {
		before := g.fetches.Load()
		for range 5 {
			v.Verify(ctx, g.sign(t, validGoogleClaims(), g.kid))
			v.Verify(ctx, g.sign(t, validGoogleClaims(), "unknown-kid"))
		}
		if n := g.fetches.Load() - before; n != 0 {
			t.Errorf("fetched keys %d more times, want 0", n)
		}
	})
}

func TestGoogleVerifierKeysUnavailable(t *testing.T) {
	down := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer down.Close()
	g := newFakeGoogle(t)
	v := NewGoogleVerifier(testClientID)
	v.certsURL = down.URL

	_, err := v.Verify(context.Background(), g.sign(t, validGoogleClaims(), g.kid))
	if err == nil || errors.Is(err, ErrInvalidGoogleToken) {
		t.Errorf("err = %v, want a key-loading error (not a token error)", err)
	}
}

// fakeVerifier returns a fixed identity, for service tests.
type fakeVerifier struct {
	id  GoogleIdentity
	err error
}

func (f fakeVerifier) ClientID() string { return testClientID }
func (f fakeVerifier) Verify(context.Context, string) (GoogleIdentity, error) {
	return f.id, f.err
}

func TestLoginWithGoogle(t *testing.T) {
	ctx := context.Background()
	in := GoogleLoginInput{Credential: "token"}

	t.Run("disabled", func(t *testing.T) {
		svc := newTestService(t)
		if _, err := svc.LoginWithGoogle(ctx, in); !errors.Is(err, ErrGoogleDisabled) {
			t.Errorf("err = %v, want ErrGoogleDisabled", err)
		}
		if svc.GoogleClientID() != "" {
			t.Error("GoogleClientID should be empty when disabled")
		}
	})

	cases := []struct {
		name    string
		v       fakeVerifier
		wantErr error
	}{
		{"admin email signs in (any case)", fakeVerifier{id: GoogleIdentity{Email: "Admin@Example.com", EmailVerified: true}}, nil},
		{"unknown email", fakeVerifier{id: GoogleIdentity{Email: "stranger@example.com", EmailVerified: true}}, ErrGoogleNotAllowed},
		{"unverified email", fakeVerifier{id: GoogleIdentity{Email: "admin@example.com"}}, ErrGoogleNotAllowed},
		{"bad token", fakeVerifier{err: ErrInvalidGoogleToken}, ErrInvalidGoogleToken},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			svc := newTestService(t)
			svc.EnableGoogle(tc.v)
			s, err := svc.LoginWithGoogle(ctx, in)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
			if tc.wantErr == nil {
				if s.Token == "" || s.User.Email != "admin@example.com" {
					t.Errorf("session = %+v", s)
				}
				// The session works like a password-login session.
				if _, err := svc.Authenticate(ctx, s.Token); err != nil {
					t.Errorf("Authenticate: %v", err)
				}
			}
		})
	}
}
