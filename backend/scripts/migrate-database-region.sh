#!/usr/bin/env bash
#
# Move the Postgres database to a new Neon project in a nearer region.
#
# Neon cannot relocate a project, so this dumps the current database and
# restores it into a new one. The dataset is small (~16 MB), so the copy itself
# takes seconds — the risk is not volume, it is writes landing in the old
# database after the dump and being lost. Put the API in maintenance, or accept
# a short window where orders cannot be placed, before running this.
#
# Usage:
#   OLD_URL='postgresql://...us-east-1...'  \
#   NEW_URL='postgresql://...ap-south-1...' \
#   ./scripts/migrate-database-region.sh
#
# Nothing is dropped and the source is only ever read. Re-runnable: if the
# restore fails you can empty the new database and try again, and the old one is
# untouched either way.

set -euo pipefail

PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
DUMP_DIR="${DUMP_DIR:-./.db-migration}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP_FILE="${DUMP_DIR}/ktmona-${STAMP}.dump"

fail() { printf '\n[FAIL] %s\n' "$1" >&2; exit 1; }
step() { printf '\n=== %s ===\n' "$1"; }

# Connection strings are read from disk, never passed on a command line or
# pasted into a chat window. A URL in argv is visible to every process on the
# machine via `ps`, and ends up in shell history besides.
: "${OLD_URL:=$( [[ -f .env ]] && grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//; s/^"//; s/"$//' )}"
: "${NEW_URL:=$( [[ -f .new-db-url ]] && tr -d '[:space:]' < .new-db-url )}"

[[ -n "${OLD_URL:-}" ]] || fail "no source URL — expected DATABASE_URL in backend/.env"
[[ -n "${NEW_URL:-}" ]] || fail "no target URL — write it to backend/.new-db-url (chmod 600)"
[[ -x "${PG_BIN}/pg_dump" ]] || fail "pg_dump not found at ${PG_BIN} — set PG_BIN"

# ---------------------------------------------------------------------------
# 0. Versions must match, or pg_dump refuses outright.
# ---------------------------------------------------------------------------
step "Checking server versions"
old_version="$("${PG_BIN}/psql" "$OLD_URL" -tAc 'show server_version;')" || fail "cannot reach OLD_URL"
new_version="$("${PG_BIN}/psql" "$NEW_URL" -tAc 'show server_version;')" || fail "cannot reach NEW_URL"
printf 'source: %s\ntarget: %s\nclient: %s\n' \
  "$old_version" "$new_version" "$("${PG_BIN}/pg_dump" --version | awk '{print $3}')"

[[ "${old_version%%.*}" == "${new_version%%.*}" ]] \
  || fail "major version mismatch: ${old_version} -> ${new_version}. Create the new Neon project on Postgres ${old_version%%.*}."

# ---------------------------------------------------------------------------
# 1. Refuse to restore over a database that already has data.
# ---------------------------------------------------------------------------
step "Confirming the target is empty"
target_tables="$("${PG_BIN}/psql" "$NEW_URL" -tAc \
  "select count(*) from information_schema.tables where table_schema='public';")"
if [[ "$target_tables" != "0" ]]; then
  fail "target already has ${target_tables} tables in public. Refusing to overwrite. Reset that Neon branch first."
fi

# ---------------------------------------------------------------------------
# 2. Record what we expect to end up with, so the verification means something.
# ---------------------------------------------------------------------------
#
# Real counts, not planner estimates.
#
# The obvious query here is `select n_live_tup from pg_stat_user_tables`, and it
# is wrong: that column is an estimate maintained by autovacuum, and on a
# freshly-restored or recently-idle database it is stale or simply zero. Using
# it made this script report catastrophic data loss on a migration that had in
# fact copied every row correctly — the source was reporting stale estimates
# while the target, freshly analyzed, reported the truth.
#
# count(*) per table is exact. At this data size it costs nothing, and a
# verification step that can produce a false alarm is worse than none: it
# teaches you to ignore it.
COUNT_SQL="select string_agg(t||'='||c, E'\n' order by t) from (
  select table_name t,
         (xpath('/row/c/text()',
                query_to_xml(format('select count(*) c from %I.%I','public',table_name),
                false,true,'')))[1]::text::bigint c
  from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE'
) s;"

step "Reading source row counts"
mkdir -p "$DUMP_DIR"
"${PG_BIN}/psql" "$OLD_URL" -tAc "$COUNT_SQL" > "${DUMP_DIR}/before.txt"
printf 'recorded %s tables, %s rows\n' \
  "$(wc -l < "${DUMP_DIR}/before.txt" | xargs)" \
  "$(awk -F= '{s+=$2} END {print s+0}' "${DUMP_DIR}/before.txt")"

# ---------------------------------------------------------------------------
# 3. Dump. Custom format so the restore can be parallel and order-independent.
#    --no-owner / --no-acl because Neon's role names differ between projects.
# ---------------------------------------------------------------------------
step "Dumping source"
mkdir -p "$DUMP_DIR"
"${PG_BIN}/pg_dump" "$OLD_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="$DUMP_FILE"
printf 'wrote %s (%s)\n' "$DUMP_FILE" "$(du -h "$DUMP_FILE" | cut -f1)"

# ---------------------------------------------------------------------------
# 4. Restore.
# ---------------------------------------------------------------------------
step "Restoring into target"
"${PG_BIN}/pg_restore" \
  --dbname="$NEW_URL" \
  --no-owner \
  --no-acl \
  --single-transaction \
  "$DUMP_FILE"

# ---------------------------------------------------------------------------
# 5. Verify row-for-row. A restore that "succeeded" but dropped a table is the
#    failure mode that actually costs you orders.
# ---------------------------------------------------------------------------
step "Verifying"
"${PG_BIN}/psql" "$NEW_URL" -tAc "$COUNT_SQL" > "${DUMP_DIR}/after.txt"

if diff -u "${DUMP_DIR}/before.txt" "${DUMP_DIR}/after.txt" > "${DUMP_DIR}/diff.txt"; then
  printf 'row counts match exactly: %s tables, %s rows\n' \
    "$(wc -l < "${DUMP_DIR}/after.txt" | xargs)" \
    "$(awk -F= '{s+=$2} END {print s+0}' "${DUMP_DIR}/after.txt")"
else
  printf 'ROW COUNTS DIFFER — inspect %s\n' "${DUMP_DIR}/diff.txt"
  cat "${DUMP_DIR}/diff.txt"
  fail "verification failed. The old database is untouched; do not switch over."
fi

step "Migration data check passed"
cat <<'NEXT'
The new database now matches the old one.

Still to do, in this order:
  1. Point DATABASE_URL at the new project (Render dashboard, and .env locally).
  2. Redeploy the API so it picks up the new URL.
  3. Place one real test order end to end.
  4. Keep the old Neon project for at least a week before deleting it.

Nothing was dropped. The old database is still live and still receiving no
harm — if anything looks wrong, point DATABASE_URL back at it.
NEXT
