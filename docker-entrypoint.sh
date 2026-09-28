#!/bin/sh
# Container start: apply pending migrations, then start the API.
# Set RUN_MIGRATIONS=false to skip the migration step.
set -e

# Platforms like Render/Railway/Fly assign a port at runtime via $PORT and
# require the app to listen on it. Prefer it over SERVER_PORT when set.
if [ -n "$PORT" ]; then
  export SERVER_PORT="$PORT"
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  /app/bin/migrate up
fi

# exec replaces the shell, so the API receives stop signals directly
# (needed for graceful shutdown).
exec /app/bin/api
