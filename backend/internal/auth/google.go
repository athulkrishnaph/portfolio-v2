package auth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Google sign-in: the browser gets an ID token from Google Identity Services
// and posts it to POST /api/auth/google. GoogleVerifier checks the token
// against Google's public keys; the service then signs in the admin account
// with the same email. Google never creates accounts: the email must already
// belong to an admin (cmd/createadmin).

// ErrInvalidGoogleToken means a Google ID token is malformed, forged,
// expired or issued for another app.
var ErrInvalidGoogleToken = errors.New("invalid Google ID token")

const (
	googleCertsURL = "https://www.googleapis.com/oauth2/v3/certs"
	// Fallback key cache lifetime when Google sends no max-age.
	defaultKeyTTL = time.Hour
	// An unknown key ID triggers a refetch (Google rotates keys), but at most
	// this often, so forged tokens cannot make us hammer Google.
	minRefetchInterval = time.Minute
)

// googleIssuers are the two issuer values Google uses in ID tokens.
var googleIssuers = map[string]bool{"accounts.google.com": true, "https://accounts.google.com": true}

// GoogleIdentity is the verified identity inside a Google ID token.
type GoogleIdentity struct {
	Email         string
	EmailVerified bool
}

// GoogleVerifier verifies Google ID tokens issued for one OAuth client ID.
type GoogleVerifier struct {
	clientID string
	certsURL string
	client   *http.Client
	now      func() time.Time // replaceable in tests

	mu        sync.Mutex
	keys      map[string]*rsa.PublicKey
	expiresAt time.Time
	fetchedAt time.Time
}

// NewGoogleVerifier returns a verifier for tokens issued to clientID.
func NewGoogleVerifier(clientID string) *GoogleVerifier {
	return &GoogleVerifier{
		clientID: clientID,
		certsURL: googleCertsURL,
		client:   &http.Client{Timeout: 10 * time.Second},
		now:      time.Now,
	}
}

// ClientID is the OAuth client ID the browser needs to show the button.
func (g *GoogleVerifier) ClientID() string { return g.clientID }

type googleClaims struct {
	jwt.RegisteredClaims
	Email         string   `json:"email"`
	EmailVerified flexBool `json:"email_verified"`
}

// Verify checks the token's signature, audience, issuer and expiry. Token
// problems return ErrInvalidGoogleToken; other errors mean Google's keys
// could not be loaded.
func (g *GoogleVerifier) Verify(ctx context.Context, idToken string) (GoogleIdentity, error) {
	var keyErr error
	var claims googleClaims
	_, err := jwt.ParseWithClaims(idToken, &claims,
		func(t *jwt.Token) (any, error) {
			kid, _ := t.Header["kid"].(string)
			key, err := g.key(ctx, kid)
			if err != nil {
				keyErr = err
			}
			return key, err
		},
		// Google signs with RS256 only; refusing others blocks algorithm confusion.
		jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}),
		jwt.WithAudience(g.clientID),
		jwt.WithExpirationRequired(),
		jwt.WithLeeway(time.Minute), // small clock differences
		jwt.WithTimeFunc(g.now),
	)
	if keyErr != nil && !errors.Is(keyErr, ErrInvalidGoogleToken) {
		return GoogleIdentity{}, keyErr
	}
	if err != nil || !googleIssuers[claims.Issuer] || claims.Email == "" {
		return GoogleIdentity{}, ErrInvalidGoogleToken
	}
	return GoogleIdentity{Email: claims.Email, EmailVerified: bool(claims.EmailVerified)}, nil
}

// key returns Google's public key with the given ID, fetching (and caching)
// the key set when needed.
func (g *GoogleVerifier) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	if kid == "" {
		return nil, ErrInvalidGoogleToken
	}
	g.mu.Lock()
	defer g.mu.Unlock()

	now := g.now()
	key, ok := g.keys[kid]
	if ok && now.Before(g.expiresAt) {
		return key, nil
	}
	stale := g.keys == nil || !now.Before(g.expiresAt)
	if !stale && now.Sub(g.fetchedAt) < minRefetchInterval {
		return nil, ErrInvalidGoogleToken // unknown key, fetched very recently
	}
	if err := g.fetchKeys(ctx); err != nil {
		return nil, err
	}
	if key, ok := g.keys[kid]; ok {
		return key, nil
	}
	return nil, ErrInvalidGoogleToken
}

// fetchKeys downloads Google's JSON Web Key Set. Called with g.mu held.
func (g *GoogleVerifier) fetchKeys(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, g.certsURL, nil)
	if err != nil {
		return fmt.Errorf("google keys: %w", err)
	}
	res, err := g.client.Do(req)
	if err != nil {
		return fmt.Errorf("google keys: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("google keys: HTTP %d", res.StatusCode)
	}

	var set struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(res.Body).Decode(&set); err != nil {
		return fmt.Errorf("google keys: %w", err)
	}
	keys := make(map[string]*rsa.PublicKey, len(set.Keys))
	for _, k := range set.Keys {
		if k.Kty != "RSA" {
			continue
		}
		n, errN := base64.RawURLEncoding.DecodeString(k.N)
		e, errE := base64.RawURLEncoding.DecodeString(k.E)
		if errN != nil || errE != nil || len(e) == 0 {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	if len(keys) == 0 {
		return errors.New("google keys: no usable keys")
	}

	now := g.now()
	g.keys = keys
	g.fetchedAt = now
	g.expiresAt = now.Add(maxAge(res.Header.Get("Cache-Control"), defaultKeyTTL))
	return nil
}

// maxAge reads max-age from a Cache-Control header.
func maxAge(header string, fallback time.Duration) time.Duration {
	for _, part := range strings.Split(header, ",") {
		if v, ok := strings.CutPrefix(strings.TrimSpace(part), "max-age="); ok {
			if secs, err := strconv.Atoi(v); err == nil && secs > 0 {
				return time.Duration(secs) * time.Second
			}
		}
	}
	return fallback
}

// flexBool accepts both true and "true": Google has sent email_verified in
// both forms.
type flexBool bool

func (b *flexBool) UnmarshalJSON(data []byte) error {
	s := strings.Trim(string(data), `"`)
	*b = flexBool(s == "true")
	return nil
}
