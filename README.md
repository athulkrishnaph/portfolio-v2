# Portfolio

A personal developer portfolio with a secure admin portal. All portfolio content (profile, projects, experience, education, certificates, skills) is stored in PostgreSQL and managed from the admin UI. None of it is hard-coded in the frontend.

```
Angular (frontend)  →  Go REST API (backend)  →  PostgreSQL
```

The Angular app never talks to the database directly. Every read and write goes through the Go API.

**Public site:** Home · About · Skills · Projects · Project details · Experience · Education · Certificates · Contact
**Admin portal** (`/admin`): Dashboard · Profile (with social links and password change) · Projects · Experience · Education · Certificates · Skills, with image and PDF uploads

---

## Contents

- [Technologies](#technologies)
- [Folder structure](#folder-structure)
- [Requirements](#requirements)
- [Local setup](#local-setup): environment, PostgreSQL, migrations and seeds, admin user
- [Running the backend and frontend](#running-the-backend)
- [Tests](#tests)
- [Build](#build)
- [Docker](#docker)
- [Deployment](#deployment)
- [API overview](#api-overview)
- [Architectural decisions](#architectural-decisions)

---

## Technologies

| Layer    | Stack |
|----------|-------|
| Frontend | Angular 21 (standalone components, signals, zoneless), TypeScript, RxJS, Angular Router, Reactive Forms, HttpClient, SCSS, Vitest |
| Backend  | Go 1.26, standard library `net/http` router, `log/slog` logging |
| Database | PostgreSQL 17, plain SQL migrations applied by a small built-in Go runner, `jackc/pgx/v5` driver |
| Auth     | JWT (HS256, `golang-jwt/jwt/v5`), bcrypt password hashing (`golang.org/x/crypto`) |

The backend has only three direct dependencies: pgx, golang-jwt, and x/crypto. The frontend has no UI libraries. Icons are inline SVG.

## Folder structure

```
portfolio/
├── frontend/                        Angular application
│   ├── proxy.conf.json              Dev proxy: /api and /uploads → Go API on :8080
│   └── src/
│       ├── styles/                  Design system: _tokens, _base, _components, _mixins
│       └── app/
│           ├── core/
│           │   ├── api/             ApiClient (unwraps {data}), ApiError, CrudApi base, error interceptor
│           │   ├── auth/            AuthService, auth interceptor, route guards
│           │   ├── models/          TypeScript types matching the API
│           │   ├── services/        One service per resource (projects, skills, profile, uploads…)
│           │   ├── ui/              Toasts, confirm dialog, theme, page titles
│           │   └── utils/           Loader (loading/error/data signals), form helpers and validators
│           ├── shared/
│           │   ├── components/      Button, spinner, modal, confirm dialog, form field, empty/error
│           │   │                    state, pagination, project/certificate cards, timeline, icons,
│           │   │                    image upload, tag input, social links, page header
│           │   └── pipes/           Date formatting
│           ├── layouts/             Public layout (navbar, footer) and admin layout (sidebar)
│           └── features/
│               ├── public/          Public pages
│               └── admin/           Admin pages (+ shared form base class, unsaved-changes guard)
├── backend/                         Go application
│   ├── cmd/
│   │   ├── api/                     API server
│   │   ├── migrate/                 Migration / seed CLI
│   │   └── createadmin/             Creates the admin account (or resets its password)
│   └── internal/
│       ├── config/                  Environment / .env loading and validation
│       ├── database/                Connection pool, PostgreSQL error helpers
│       ├── server/                  Route registration, middleware chain, SPA serving
│       ├── middleware/              Request ID, access log, panic recovery, CORS, security headers, rate limit
│       ├── httpx/                   JSON responses, request decoding, path IDs
│       ├── validate/                Per-field validation used by services
│       ├── auth/                    Users, login, JWT, RequireAuth middleware
│       ├── projects/ certificates/ experience/ education/ skills/ profile/
│       │                            One package per resource: model, repository, service, handler
│       ├── storage/                 File storage interface + local-disk implementation
│       ├── uploads/                 POST /api/uploads
│       ├── migrate/                 Migration runner and seed loader
│       └── testdb/                  Isolated PostgreSQL schema for integration tests
├── database/
│   ├── migrations/                  NNN_name.up.sql / NNN_name.down.sql
│   └── seeds/                       Demo content
├── Dockerfile                       Production image (frontend + backend in one container)
├── docker-compose.yml               PostgreSQL (default) and the full app (profile "app")
├── .env.example                     Template for environment variables
└── README.md
```

## Requirements

- **Go** 1.22+ (developed with 1.26)
- **Node.js** 20.19+ / 22.12+ / 24+ and npm
- **PostgreSQL** 15+ (native install **or** Docker)
- Angular CLI is optional, since the npm scripts use the local copy.

---

## Local setup

### 1. Environment variables

```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Then edit `.env`. The Go programs read `.env` from the repo root (they also check `backend/.env`). Variables already set in your shell take precedence over `.env`.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | – | PostgreSQL connection string |
| `JWT_SECRET` | yes | – | JWT signing key, **32+ characters** |
| `JWT_TTL` | no | `2h` | Admin session length (Go duration) |
| `SERVER_PORT` | no | `8080` | API port |
| `UPLOAD_DIRECTORY` | no | `./uploads` | Where uploaded images and PDFs are stored |
| `PUBLIC_BASE_URL` | no | `http://localhost:8080` | Public URL of the API, used to build upload URLs |
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:4200` | Comma-separated browser origins (only needed when the frontend is on another domain) |
| `TRUST_PROXY` | no | `false` | `true` only behind your own reverse proxy (client IP from `X-Forwarded-For`) |
| `STATIC_DIR` | no | – | Production: built Angular app for the API to serve |
| `MIGRATIONS_DIR` / `SEEDS_DIR` | no | `../database/...` | SQL folders |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | for `createadmin` | – | Initial admin account |

Generate a strong JWT secret with `openssl rand -base64 48`. In PowerShell: `[Convert]::ToBase64String((1..48 | % { Get-Random -Max 256 }))`.

> `.env` is git-ignored. **Never commit real secrets.**

### 2. PostgreSQL

**Option A: Native install (Windows)**

1. Install PostgreSQL 17 from https://www.postgresql.org/download/windows/ and note the `postgres` superuser password you choose.
2. Add the folder that contains `psql.exe` to your `PATH`. This is normally `C:\Program Files\PostgreSQL\17\bin`. You can skip Stack Builder at the end of the installer.
3. Create the app's database user and database:

   ```bash
   psql -U postgres -c "CREATE ROLE portfolio WITH LOGIN PASSWORD 'portfolio';"
   psql -U postgres -c "CREATE DATABASE portfolio OWNER portfolio;"
   ```

4. Check that it works:

   ```bash
   psql "postgres://portfolio:portfolio@localhost:5432/portfolio" -c "SELECT version();"
   ```

These credentials match the default `DATABASE_URL` in `.env.example`. Use a stronger password for anything beyond local development.

**Option B: Docker**

```bash
docker compose up -d      # start PostgreSQL only
docker compose down       # stop (data is kept in a named volume)
```

### 3. Migrations and seed data

Run these from the `backend/` directory:

```bash
go run ./cmd/migrate up             # create or upgrade all tables
go run ./cmd/migrate seed           # load demo content (only into an empty database)
```

Other commands:

```bash
go run ./cmd/migrate status         # list migrations: applied / pending
go run ./cmd/migrate down           # roll back the most recent migration
go run ./cmd/migrate down -all      # roll back everything (drops all tables!)
go run ./cmd/migrate seed -force    # REPLACE existing content with demo data
```

- Migrations live in `database/migrations/` as `NNN_name.up.sql` + `NNN_name.down.sql` pairs. Applied versions are recorded in the `schema_migrations` table.
- To change the schema, add the next number, e.g. `008_add_blog.up.sql` and `008_add_blog.down.sql`, then run `migrate up`. Never edit a migration that has already been applied anywhere.
- `seed` refuses to run once a profile exists, so your real content is safe. `seed -force` truncates the content tables and reloads the demo data. It never touches admin users.

**Database schema**

| Table | Purpose | Notable constraints |
|---|---|---|
| `users` | Admin accounts (bcrypt hashes only) | case-insensitive unique email |
| `profile` | The single owner profile | `CHECK (id = 1)` guarantees one row |
| `social_links` | GitHub, LinkedIn, other links | FK → profile, unique per platform |
| `projects` | Portfolio projects | unique slug with format check, partial index on featured |
| `project_technologies` | Technologies per project | FK → projects `ON DELETE CASCADE`, unique per project |
| `certificates` | Certificates | required title, issuer, and issue date |
| `experience` | Work history | a current job has no end date; end date ≥ start date |
| `education` | Education history | end date ≥ start date |
| `skills` | Skills grouped by category | case-insensitive unique name |

Every table has `created_at` and `updated_at`. A shared `set_updated_at()` trigger keeps `updated_at` current.

### 4. Create the admin user

Admin accounts are created from the command line only. There is no sign-up endpoint to attack.

```bash
cd backend
go run ./cmd/createadmin -email you@example.com -password 'a-long-password'
# or set ADMIN_EMAIL / ADMIN_PASSWORD in .env and run:
go run ./cmd/createadmin

# forgot the password?
go run ./cmd/createadmin -email you@example.com -password 'new-password' -reset
```

Passwords must be at least 10 characters. The placeholder from `.env.example` is refused. Once logged in, you can change the password in **Admin → Profile**, which signs out every other session.

---

## Running the backend

```bash
cd backend
go run ./cmd/api
```

The server connects to PostgreSQL at startup and exits with a clear error if it can't. Check it:

```bash
curl http://localhost:8080/api/health
# 200 {"data":{"status":"ok"}}                          database reachable
# 503 {"error":{"code":"DATABASE_UNAVAILABLE",...}}      database down
```

Every request is logged on one line with its method, path, status, duration, and a request ID. The same ID is returned in the `X-Request-ID` response header and appears on any error log for that request.

## Running the frontend

```bash
cd frontend
npm install        # first time only
npm start          # http://localhost:4200
```

Open http://localhost:4200 for the site and http://localhost:4200/admin to sign in.

During development, Angular's dev server proxies `/api/*` and `/uploads/*` to the Go API (see `frontend/proxy.conf.json`). The frontend uses relative URLs, so CORS is not involved. If port 4200 is taken, run `npm start -- --port 4300`.

## Tests

```bash
cd backend && go test ./...                         # unit + handler tests (no database needed)
cd frontend && npm test -- --watch=false            # Vitest
```

**Database integration tests** (repositories and full HTTP API) run only when `TEST_DATABASE_URL` is set. Each run creates a temporary schema (`test_<timestamp>`), migrates it, and drops it afterwards, so pointing it at your development database is safe:

```bash
cd backend
TEST_DATABASE_URL="postgres://portfolio:portfolio@localhost:5432/portfolio?sslmode=disable" go test ./...
# PowerShell: $env:TEST_DATABASE_URL="postgres://..."; go test ./...
```

What is covered:

- **Backend:** auth (login, bcrypt, JWT tampering and expiry, `alg:none`, password change invalidating old tokens, `RequireAuth`), service validation rules, JSON decoding, rate limiting, CORS, panic recovery, SPA serving, repositories, and an end-to-end API test.
- **Frontend:** auth service, interceptor, and guard; validators and server-error mapping; the `Loader` RxJS operator; pagination; the date pipe; the project card component.

## Build

```bash
cd frontend && npm run build          # → frontend/dist/frontend/browser
cd backend  && go build -o bin/api ./cmd/api && go build -o bin/migrate ./cmd/migrate && go build -o bin/createadmin ./cmd/createadmin
```

(`.exe` suffixes on Windows.) Run the production build with the API serving the site:

```bash
cd backend
STATIC_DIR=../frontend/dist/frontend/browser ./bin/api     # PowerShell: $env:STATIC_DIR="..."; .\bin\api.exe
# → site and API both on http://localhost:8080
```

---

## Docker

`docker compose up -d` starts **only PostgreSQL**, for local development.

To run the **whole application** in containers (PostgreSQL + one app container that serves the API and the built site):

```bash
# .env must contain JWT_SECRET (and optionally POSTGRES_PASSWORD, PUBLIC_BASE_URL)
docker compose --profile app up -d --build

docker compose exec app /app/bin/migrate seed                   # optional demo content
docker compose exec app /app/bin/createadmin -email you@example.com -password 'a-long-password'
```

Open http://localhost:8080. Migrations run automatically every time the container starts (set `RUN_MIGRATIONS=false` to skip). Uploads are stored in the `uploads` volume and the database in `postgres-data`.

The `Dockerfile` builds in three stages (Node → Go → a small Alpine runtime running as a non-root user) and includes a health check on `/api/health`.

## Deployment

The production shape is one Go server that serves the API, the uploaded files, and the Angular app on a single origin, with PostgreSQL next to it and a reverse proxy in front for HTTPS.

**Recommended: a small VPS with Docker**

1. Install Docker, clone the repository, and create `.env` with production values:
   ```ini
   JWT_SECRET=<openssl rand -base64 48>
   POSTGRES_PASSWORD=<a strong password>
   PUBLIC_BASE_URL=https://yourdomain.com
   CORS_ALLOWED_ORIGINS=https://yourdomain.com
   TRUST_PROXY=true
   ```
2. `docker compose --profile app up -d --build`, then create the admin with `createadmin` (see above).
3. Put an HTTPS reverse proxy in front of port 8080. With [Caddy](https://caddyserver.com), which obtains certificates automatically, the whole `Caddyfile` is:
   ```
   yourdomain.com {
       reverse_proxy localhost:8080
   }
   ```
   Then remove the `5432:5432` and `8080:8080` port mappings from `docker-compose.yml` (or bind them to `127.0.0.1`) so only the proxy is public.
4. **Backups:** `docker compose exec postgres pg_dump -U portfolio portfolio > backup.sql`, plus a copy of the `uploads` volume.
5. **Updating:** `git pull && docker compose --profile app up -d --build`. New migrations apply on start.

**Without Docker:** build the binaries and the frontend as in [Build](#build), copy `bin/`, `frontend/dist/frontend/browser`, and `database/` to the server, and run `migrate up` followed by `api` with the environment variables set (for example as a systemd service). Put the same reverse proxy in front.

**Production checklist**

- [ ] `JWT_SECRET` is long and random, and differs from development
- [ ] The database password is not `portfolio`
- [ ] HTTPS in front, and `TRUST_PROXY=true` only behind it
- [ ] `PUBLIC_BASE_URL` is the real `https://` domain (upload URLs are built from it)
- [ ] The database and uploads are backed up

**Cloud file storage:** uploads go through the `storage.Storage` interface (`backend/internal/storage`). To use S3 or a similar service, add a type with a `Save` method that uploads the file and returns its public URL, and choose it in `cmd/api/main.go`. Handlers and the frontend stay unchanged.

---

## API overview

Every response uses the same envelope:

```jsonc
// success
{ "data": { ... } }

// error
{ "error": { "code": "PROJECT_NOT_FOUND", "message": "Project not found" } }

// validation error (422): keys match request fields; nested ones use dots, e.g. "socialLinks.1.url"
{ "error": { "code": "VALIDATION_FAILED", "message": "One or more fields are invalid",
             "details": { "title": "Title is required" } } }
```

Admin endpoints need `Authorization: Bearer <token>` from `POST /api/auth/login`. Dates are `YYYY-MM-DD` strings.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | – | Includes a database ping |
| POST | `/api/auth/login` | – | `{email, password}` → `{token, expiresAt, user}`. Rate limited: 10 attempts / 15 min per IP |
| GET | `/api/auth/me` | ✔ | Current admin |
| PUT | `/api/auth/password` | ✔ | `{currentPassword, newPassword}` → new session; older tokens stop working |
| GET | `/api/projects` | – | `?featured=true` for featured only |
| GET | `/api/projects/{id}` | – | |
| GET | `/api/projects/slug/{slug}` | – | Used by the public project page |
| POST / PUT / DELETE | `/api/projects`, `/api/projects/{id}` | ✔ | Body includes `technologies: string[]`; slug auto-generated if empty |
| GET | `/api/certificates`, `/api/certificates/{id}` | – | |
| POST / PUT / DELETE | `/api/certificates`, `/api/certificates/{id}` | ✔ | |
| GET | `/api/experience`, `/api/experience/{id}` | – | `endDate` is null while `isCurrent` |
| POST / PUT / DELETE | `/api/experience`, `/api/experience/{id}` | ✔ | |
| GET | `/api/education`, `/api/education/{id}` | – | `endDate` null = in progress |
| POST / PUT / DELETE | `/api/education`, `/api/education/{id}` | ✔ | |
| GET | `/api/skills`, `/api/skills/{id}` | – | Sorted by category, then display order |
| POST / PUT / DELETE | `/api/skills`, `/api/skills/{id}` | ✔ | Names are unique (case-insensitive) |
| GET | `/api/profile` | – | 404 `PROFILE_NOT_FOUND` until first saved |
| PUT | `/api/profile` | ✔ | Replaces the profile including `socialLinks` |
| POST | `/api/uploads` | ✔ | `multipart/form-data`, field `file`: JPEG/PNG/GIF/WebP/PDF ≤ 5 MB → `{url}` |
| GET | `/uploads/{file}` | – | Uploaded files |

Common error codes:

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_JSON` | Body is empty, malformed, has unknown fields, or exceeds 1 MB |
| 400 | `INVALID_ID` | `{id}` is not a positive integer |
| 401 | `UNAUTHORIZED` / `INVALID_TOKEN` | Missing token / expired, forged, or revoked token |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password (same message for both) |
| 404 | `NOT_FOUND`, `PROJECT_NOT_FOUND`, … | Unknown route or item |
| 405 | `METHOD_NOT_ALLOWED` | Route exists, but not for this method |
| 413 / 415 | `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` | Upload rejected |
| 422 | `VALIDATION_FAILED` | Field validation failed, see `details` |
| 429 | `TOO_MANY_REQUESTS` | Login rate limit hit (`Retry-After` header) |
| 500 | `INTERNAL_ERROR` | Unexpected error. Details are logged, never returned |
| 503 | `DATABASE_UNAVAILABLE` | Health check could not reach PostgreSQL |

---

## Architectural decisions

**Backend**

- **Handler → service → repository per feature.** Handlers only deal with HTTP (decode, status codes), services hold the rules (validation, normalisation, slug generation), and repositories hold all SQL. Services depend on a small interface declared next to them, so tests pass an in-memory fake instead of a database.
- **One place for routes.** `registerRoutes` in `internal/server/server.go` builds every feature and lists every endpoint.
- **Standard library router.** Go 1.22+ `http.ServeMux` supports method and path patterns (`GET /api/projects/{id}`), so no third-party router is needed.
- **Middleware order:** `RequestID → Logger → Recover → SecurityHeaders → CORS → router`. The request ID comes first so every later step can log it. `Recover` sits inside `Logger`, so a panic still gets an access-log line with status 500.
- **Validation lives in services.** A service returns `*validate.Error` and the handler turns it into a 422 with per-field messages. Database constraints (`CHECK`, `UNIQUE`, foreign keys) are the last line of defence. Unique violations are translated into friendly field errors ("This slug is already used").
- **Consistent response envelope** through `internal/httpx`. Internal errors are logged with the request ID and returned as a generic 500, so database details never leak.
- **Strict JSON decoding.** Unknown fields are rejected, so a typo like `"titel"` fails loudly. Bodies are capped at 1 MB.
- **Auth.** Passwords are hashed with bcrypt (cost 12). Tokens are HS256 JWTs, and only HS256 is accepted, which blocks `alg:none` and algorithm-confusion attacks. A token carries a fingerprint of the password hash, so changing the password immediately invalidates all older tokens without a token blacklist. Unknown emails take as long to reject as wrong passwords (a dummy bcrypt compare), so response timing can't reveal which accounts exist. Logins are rate limited per IP.
- **Dates as `YYYY-MM-DD` strings end to end.** PostgreSQL formats them (`to_char`) and parses them (`::date`), so a time zone can never shift a date by one day.
- **Uploads are separate from content.** The admin uploads a file first and gets a URL, and that URL is saved like any other field. The file type is detected from the file's bytes, not trusted from the browser. SVG is refused because it can contain scripts. Names are random, and files are served with `nosniff`.
- **Storage behind an interface** (`storage.Storage`), so local disk can be replaced by cloud storage in one place.
- **Plain SQL migrations with a small Go runner**, each in its own transaction and guarded by an advisory lock. There is no external tool to install.
- **Relational schema instead of JSON blobs.** Technologies and social links are child tables. Rules like "a current job has no end date" are `CHECK` constraints.
- **Single origin in production.** The Go server also serves the built Angular app (`STATIC_DIR`) with correct caching (hashed bundles cached forever, `index.html` never), so there is no CORS and only one thing to deploy.
- **Fail-fast configuration and graceful shutdown.** The server won't start with a missing `DATABASE_URL` or a short `JWT_SECRET`, and it finishes in-flight requests on SIGTERM.

**Frontend**

- **Zoneless Angular with signals** for UI state and **RxJS** for HTTP and async flows (`switchMap` to cancel stale requests, `forkJoin` for the dashboard, `shareReplay` to cache the profile). NgRx is not used: services plus signals are enough for this app.
- **`Loader`** (`core/utils/loader.ts`) wraps any request into `loading` / `error` / `data` signals with `reload()` and a silent `refresh()`, so every page handles loading, empty, error, and retry states the same way.
- **All HTTP lives in services.** `ApiClient` unwraps `{data}`. The error interceptor turns every failure into one `ApiError` type, and the auth interceptor adds the token **only to our own `/api` URLs** and ends the session on a 401.
- **Session storage.** The JWT is kept in `localStorage`, so a refresh does not log you out. It is short-lived, never sent to other origins, and the admin is logged out automatically when it expires. Angular's template sanitisation protects against the XSS that could read it. The route guard is for UX only: the API enforces authentication on every write.
- **Admin forms** share a small base class (`EntityFormPage`) for load → validate → save → show server errors → navigate. An unsaved-changes guard asks before leaving a dirty form. Server validation messages appear next to the matching field, including FormArray rows (`socialLinks.1.url`).
- **Reusable UI** (form field with automatic `aria` wiring, modal on the native `<dialog>`, confirm service, toasts, pagination, cards, timeline) plus a token-based design system. Visitors pick a colour theme (System, Light, Dark, Ocean, Forest, Dracula, Sunset, Rose), which is remembered per browser and applied before the app loads, so there is no flash. To add a theme, copy a `[data-theme]` block in `styles/_tokens.scss` and add it to `THEMES` in `core/ui/theme.service.ts`.
- **Admin sidebar** collapses to an icon rail on desktop (remembered per browser) and is a closable drawer on mobile.
- **Lazy-loaded routes**, so public visitors never download the admin code. The production build is about 320 kB for the initial load (about 90 kB gzipped).
- **Accessibility:** skip links, labelled controls, focus moved to the first invalid field on submit, `aria-live` toasts, keyboard-friendly dialogs, and reduced-motion support.
