// Command createadmin creates the admin account (or resets its password).
//
// Usage (from the backend/ directory):
//
//	go run ./cmd/createadmin                       uses ADMIN_EMAIL / ADMIN_PASSWORD from .env
//	go run ./cmd/createadmin -email me@x.com -password '...'
//	go run ./cmd/createadmin -reset                set a new password for an existing account
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"time"

	"portfolio/internal/auth"
	"portfolio/internal/config"
	"portfolio/internal/database"
	"portfolio/internal/validate"
)

// examplePassword is the placeholder from .env.example. It is refused so
// nobody deploys with a publicly known password.
const examplePassword = "change-me-please"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load() // also loads .env, so ADMIN_* can come from there
	if err != nil {
		return err
	}

	email := flag.String("email", os.Getenv("ADMIN_EMAIL"), "admin email (default: $ADMIN_EMAIL)")
	password := flag.String("password", os.Getenv("ADMIN_PASSWORD"), "admin password (default: $ADMIN_PASSWORD)")
	reset := flag.Bool("reset", false, "reset the password of an existing account instead of creating one")
	flag.Parse()

	if *email == "" || *password == "" {
		return errors.New("email and password are required (flags or ADMIN_EMAIL / ADMIN_PASSWORD)")
	}
	if *password == examplePassword {
		return errors.New("refusing the example password from .env.example; choose your own ADMIN_PASSWORD")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	// The token manager is unused here, but the service needs one.
	svc := auth.NewService(auth.NewRepository(db), auth.NewTokenManager(cfg.JWTSecret, cfg.JWTTTL))

	if *reset {
		user, err := svc.ResetPassword(ctx, *email, *password)
		if errors.Is(err, auth.ErrUserNotFound) {
			return fmt.Errorf("no account with email %s (run without -reset to create it)", *email)
		}
		if err != nil {
			return describe(err)
		}
		fmt.Printf("password updated for %s\n", user.Email)
		return nil
	}

	user, err := svc.CreateAdmin(ctx, *email, *password)
	if errors.Is(err, auth.ErrEmailTaken) {
		return fmt.Errorf("an account with email %s already exists (use -reset to change its password)", *email)
	}
	if err != nil {
		return describe(err)
	}
	fmt.Printf("admin created: %s (id %d)\n", user.Email, user.ID)
	return nil
}

// describe turns validation errors into readable CLI messages.
func describe(err error) error {
	var verr *validate.Error
	if !errors.As(err, &verr) {
		return err
	}
	var msgs []string
	for field, msg := range verr.Fields {
		msgs = append(msgs, field+": "+msg)
	}
	return errors.New(strings.Join(msgs, "; "))
}
