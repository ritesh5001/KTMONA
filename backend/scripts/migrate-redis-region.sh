#!/usr/bin/env bash
#
# Move Redis to a new region, carrying across the data that cannot be rebuilt.
#
# Most of this Redis is cache — product lists, category lists, bestsellers — and
# that is deliberately NOT copied: it regenerates on the first few requests and
# copying it would just move stale entries into a fresh database.
#
# But three key families are accumulated behaviour with no TTL and no source of
# truth in Postgres:
#
#   recently_viewed:*          per-user browsing history
#   user_category_affinity:*   per-user taste signal feeding recommendations
#   search:trending            global search counts
#
# Those are sorted sets. Losing them is silent — nothing errors, users simply
# find their history gone and trending reset to zero. This copies them.
#
# Usage:
#   OLD_REDIS='redis://...mumbai...' NEW_REDIS='redis://...singapore...' \
#     ./scripts/migrate-redis-region.sh
#
# Reads only from the source. Safe to re-run: sorted-set members are re-added
# with their scores, so a second run is idempotent.

set -euo pipefail

: "${OLD_REDIS:=$( [[ -f .env ]] && grep -E '^REDIS_URL=' .env | sed 's/^REDIS_URL=//; s/^"//; s/"$//' )}"
: "${NEW_REDIS:=$( [[ -f .new-redis-url ]] && tr -d '[:space:]' < .new-redis-url )}"

[[ -n "${OLD_REDIS:-}" ]] || { echo "[FAIL] no source — expected REDIS_URL in .env" >&2; exit 1; }
[[ -n "${NEW_REDIS:-}" ]] || { echo "[FAIL] no target — write it to backend/.new-redis-url" >&2; exit 1; }

OLD_REDIS="$OLD_REDIS" NEW_REDIS="$NEW_REDIS" python3 - <<'PY'
import os, re, json, urllib.parse, urllib.request

# Upstash speaks REST over https on the same host, authenticated with the
# password as a bearer token. That avoids needing redis-cli installed.
def endpoint(url):
    m = re.match(r'rediss?://([^:]*):([^@]+)@([^:]+):(\d+)', url)
    if not m:
        raise SystemExit(f"[FAIL] could not parse a Redis URL")
    _, pw, host, _ = m.groups()
    return host, pw

def call(host, pw, *args):
    path = "/".join(urllib.parse.quote(str(a), safe='') for a in args)
    req = urllib.request.Request(f"https://{host}/{path}",
                                 headers={"Authorization": f"Bearer {pw}"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r).get("result")

src_host, src_pw = endpoint(os.environ["OLD_REDIS"])
dst_host, dst_pw = endpoint(os.environ["NEW_REDIS"])

if src_host == dst_host:
    raise SystemExit("[FAIL] source and target are the same database")

# Only the families that cannot be regenerated. Cache is intentionally excluded.
PATTERNS = ["recently_viewed:*", "user_category_affinity:*", "search:trending"]

print(f"source: {src_host}\ntarget: {dst_host}\n")

copied_keys = 0
copied_members = 0

for pattern in PATTERNS:
    keys = call(src_host, src_pw, "keys", pattern) or []
    if isinstance(keys, str):
        keys = [keys]
    for key in keys:
        # withscores gives a flat [member, score, member, score, ...]
        flat = call(src_host, src_pw, "zrange", key, 0, -1, "withscores") or []
        if not flat:
            continue
        pairs = list(zip(flat[0::2], flat[1::2]))
        for member, score in pairs:
            call(dst_host, dst_pw, "zadd", key, score, member)
            copied_members += 1
        copied_keys += 1
        print(f"  {key:48} {len(pairs)} members")

print(f"\ncopied {copied_keys} keys, {copied_members} members")

# Verify: every copied key must exist on the target with the same cardinality.
print("\nverifying…")
failures = 0
for pattern in PATTERNS:
    for key in (call(src_host, src_pw, "keys", pattern) or []):
        a = call(src_host, src_pw, "zcard", key)
        b = call(dst_host, dst_pw, "zcard", key)
        if a != b:
            print(f"  MISMATCH {key}: source={a} target={b}")
            failures += 1

if failures:
    raise SystemExit(f"[FAIL] {failures} keys did not match. Do not switch over.")
print("all keys match — safe to switch REDIS_URL")
PY
