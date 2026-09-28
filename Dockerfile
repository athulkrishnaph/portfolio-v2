# Production image: the Go API also serves the built Angular app, so one
# container runs the whole site (plus PostgreSQL in its own container).
#
#   docker compose --profile app up -d --build
#
# Three stages keep the final image small: only the compiled binaries, the
# static frontend files and the SQL files end up in it (no Node, no Go).

# ---- 1. Build the Angular frontend ------------------------------------------
FROM node:22-alpine AS web
WORKDIR /web
# Install dependencies first so this layer is cached until package*.json change.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- 2. Build the Go binaries --------------------------------------------------
FROM golang:1.26-alpine AS api
WORKDIR /src
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
# CGO off → fully static binaries; -s -w strips debug info (smaller files).
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/createadmin ./cmd/createadmin \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ingest ./cmd/ingest

# ---- 3. Runtime ------------------------------------------------------------------
FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -u 10001 app
WORKDIR /app

COPY --from=api /out/ ./bin/
COPY --from=web /web/dist/frontend/browser ./web
COPY database ./database
COPY docker-entrypoint.sh ./
# Normalise line endings in case the repo was checked out on Windows.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh \
 && mkdir -p /app/uploads && chown app /app/uploads

ENV SERVER_PORT=8080 \
    STATIC_DIR=/app/web \
    UPLOAD_DIRECTORY=/app/uploads \
    MIGRATIONS_DIR=/app/database/migrations \
    SEEDS_DIR=/app/database/seeds \
    KNOWLEDGE_DIR=/app/database/knowledge

# Never run as root inside the container.
USER app
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
