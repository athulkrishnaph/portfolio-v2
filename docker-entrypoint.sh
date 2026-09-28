#!/bin/sh
# Container start: apply pending migrations, then start the API.
# Set RUN_MIGRATIONS=false to skip the migration step.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  /app/bin/migrate up
fi

# exec replaces the shell, so the API receives stop signals directly
# (needed for graceful shutdown).
exec /app/bin/api
