package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const tokenIssuer = "portfolio-api"

// ErrInvalidToken means a token is malformed, forged or expired.
var ErrInvalidToken = errors.New("invalid or expired token")

// TokenManager issues and verifies HS256-signed JWTs.
type TokenManager struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time // replaceable in tests
}

// NewTokenManager creates a TokenManager. secret must be long and random.
func NewTokenManager(secret string, ttl time.Duration) *TokenManager {
	return &TokenManager{secret: []byte(secret), ttl: ttl, now: time.Now}
}

// tokenClaims is what is stored inside a JWT.
type tokenClaims struct {
	jwt.RegisteredClaims
	// PasswordVersion is a short fingerprint of the user's password hash.
	// When the password changes, the fingerprint changes and every token
	// issued before that stops working.
	PasswordVersion string `json:"pwv"`
}

// Claims are the verified contents of a token.
type Claims struct {
	UserID          int64
	PasswordVersion string
}

// Issue creates a token for user that expires after the configured TTL.
func (m *TokenManager) Issue(user User) (string, time.Time, error) {
	now := m.now()
	expiresAt := now.Add(m.ttl)
	claims := tokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    tokenIssuer,
			Subject:   strconv.FormatInt(user.ID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
		PasswordVersion: passwordVersion(user.PasswordHash),
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return token, expiresAt, nil
}

// Parse verifies a token's signature, algorithm, issuer and expiry, and
// returns its claims.
func (m *TokenManager) Parse(token string) (Claims, error) {
	var tc tokenClaims
	_, err := jwt.ParseWithClaims(token, &tc,
		func(*jwt.Token) (any, error) { return m.secret, nil },
		// Only accept HS256: this blocks "alg: none" and algorithm-confusion attacks.
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(tokenIssuer),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(m.now),
	)
	if err != nil {
		return Claims{}, ErrInvalidToken
	}

	userID, err := strconv.ParseInt(tc.Subject, 10, 64)
	if err != nil || userID <= 0 {
		return Claims{}, ErrInvalidToken
	}
	return Claims{UserID: userID, PasswordVersion: tc.PasswordVersion}, nil
}

// passwordVersion returns a short, non-reversible fingerprint of a bcrypt
// hash. It reveals nothing useful about the password itself.
func passwordVersion(passwordHash string) string {
	sum := sha256.Sum256([]byte(passwordHash))
	return hex.EncodeToString(sum[:8])
}
