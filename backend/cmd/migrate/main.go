// Command migrate manages the database schema and demo data.
//
// Usage (from the backend/ directory):
//
//	go run ./cmd/migrate up             apply all pending migrations
//	go run ./cmd/migrate down           roll back the latest migration
//	go run ./cmd/migrate down -all      roll back every migration
//	go run ./cmd/migrate status         list migrations and whether they are applied
//	go run ./cmd/migrate seed           load demo data into an empty database
//	go run ./cmd/migrate seed -force    replace existing content with demo data
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"time"

	"github.com/jackc/pgx/v5"

	"portfolio/internal/config"
	"portfolio/internal/migrate"
)

const usage = `usage: migrate <command> [flags]

commands:
  up              apply all pending migrations
  down [-all]     roll back the latest migration (or all of them)
  status          show applied and pending migrations
  seed [-force]   load demo data (-force replaces existing content)`

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		return errors.New(usage)
	}
	command, flagArgs := args[0], args[1:]

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	conn, err := pgx.Connect(connectCtx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer conn.Close(context.Background())

	runner := migrate.NewRunner(conn, os.DirFS(cfg.MigrationsDir))

	switch command {
	case "up":
		applied, err := runner.Up(ctx)
		for _, m := range applied {
			fmt.Printf("applied  %03d_%s\n", m.Version, m.Name)
		}
		if err != nil {
			return err
		}
		if len(applied) == 0 {
			fmt.Println("database is up to date")
		}

	case "down":
		flags := flag.NewFlagSet("down", flag.ExitOnError)
		all := flags.Bool("all", false, "roll back every migration")
		_ = flags.Parse(flagArgs)

		rolledBack := 0
		for {
			m, err := runner.Down(ctx)
			if err != nil {
				return err
			}
			if m == nil {
				break
			}
			rolledBack++
			fmt.Printf("rolled back  %03d_%s\n", m.Version, m.Name)
			if !*all {
				break
			}
		}
		if rolledBack == 0 {
			fmt.Println("nothing to roll back")
		}

	case "status":
		statuses, err := runner.Status(ctx)
		if err != nil {
			return err
		}
		for _, s := range statuses {
			state := "pending"
			if s.AppliedAt != nil {
				state = "applied " + s.AppliedAt.Local().Format("2006-01-02 15:04:05")
			}
			fmt.Printf("%03d_%-20s %s\n", s.Version, s.Name, state)
		}

	case "seed":
		flags := flag.NewFlagSet("seed", flag.ExitOnError)
		force := flags.Bool("force", false, "replace existing portfolio content with demo data")
		_ = flags.Parse(flagArgs)

		files, err := migrate.Seed(ctx, conn, os.DirFS(cfg.SeedsDir), *force)
		if err != nil {
			return err
		}
		for _, f := range files {
			fmt.Println("seeded  ", f)
		}

	default:
		return fmt.Errorf("unknown command %q\n\n%s", command, usage)
	}
	return nil
}
