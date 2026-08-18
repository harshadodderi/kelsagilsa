#!/usr/bin/env bash
#
# Execute every migration, in order, against a throwaway Postgres — then run
# the behavioural checks in supabase/tests/*.sql against the result.
#
# This is a syntax-and-semantics harness, not a production rehearsal. Plain
# Postgres has no PostGIS, so shim.sql substitutes point arithmetic for the
# handful of geo functions the schema uses, and the migrations are rewritten on
# the way in (`geography(point, 4326)` -> `point`). Everything else — the
# constraints, the triggers, the percentile maths, the column grants, the
# security-definer boundary — runs exactly as written.
#
# What it catches: a typo'd column, a function that references a table added in
# a later migration, a trigger that fires in the wrong order, a broken cast, a
# recompute that disagrees with the confidence tiers.
#
# What it does not catch: anything actually geographic. Verify the area
# hierarchy against a real Supabase branch before Phase 1 ships.
#
# Usage:  supabase/tests/run-local-checks.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# initdb refuses to run as root. Drop to the postgres account if there is one.
if [[ "${EUID}" -eq 0 && "${KG_DROPPED_PRIVS:-}" != "1" ]]; then
  if id -u postgres >/dev/null 2>&1; then
    exec su postgres -s /bin/bash -c "KG_DROPPED_PRIVS=1 bash '${BASH_SOURCE[0]}'"
  fi
  echo "Run this as a non-root user: initdb will not run as root." >&2
  exit 2
fi
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORK="$(mktemp -d)"
export PGDATA="$WORK/data"
export PGHOST="$WORK/socket"
export PGDATABASE=kelsagilsa

cleanup() {
  "$PGBIN/pg_ctl" -D "$PGDATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

mkdir -p "$PGHOST"
"$PGBIN/initdb" -U postgres --auth=trust >/dev/null
"$PGBIN/pg_ctl" -D "$PGDATA" -o "-k $PGHOST -c listen_addresses=''" -l "$WORK/log" start >/dev/null
"$PGBIN/createdb" -U postgres "$PGDATABASE"

psql() { command psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "postgis shim"
psql -f "$ROOT/supabase/tests/shim.sql" >/dev/null

for migration in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$migration")"
  echo "applying $name"
  # The only rewrite: PostGIS types become plain points. See the note above.
  sed -e 's/geography(point, 4326)/point/g' \
      -e 's/::geography/::point/g' \
      -e 's/ geography;/ point;/g' \
      -e 's/::geometry/::point/g' \
      -e 's/^create extension if not exists "postgis";//' \
      "$migration" | psql -f - >/dev/null
done

for check in "$ROOT"/supabase/tests/*.test.sql; do
  echo "running $(basename "$check")"
  psql -f "$check"
done

echo
echo "All migrations applied and all checks passed."
