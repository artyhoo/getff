#!/usr/bin/env bash
# exclude-path-scoped-rules.test.sh — fixture test for scripts/exclude-path-scoped-rules.sh.
# Builds throwaway rule trees in mktemp; no network, no real settings file is touched.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUT="$HERE/exclude-path-scoped-rules.sh"
PASS=0; FAIL=0
ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 — want [$3] got [$2]"; fi; }

T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/r/.claude/rules"
cat > "$T/r/.claude/rules/scoped.md" <<'EOF'
---
description: a scoped rule
paths:
  - "src/**"
---
# Scoped
EOF
cat > "$T/r/.claude/rules/unscoped.md" <<'EOF'
---
description: frontmatter without paths
---
# Unscoped — prose that mentions the key:
paths:
EOF
cat > "$T/r/.claude/rules/nofront.md" <<'EOF'
paths:
# No frontmatter at all; a bare key line is not frontmatter
EOF
cat > "$T/r/.claude/rules/late.md" <<'EOF'
---
description: paths key after other keys
globs: x
paths: ["lib/**"]
---
EOF
printf '{"hooks":{},"claudeMdExcludes":["**/kept.md"]}\n' > "$T/r/settings.json"

# A: writes exactly the frontmatter-scoped rules, keeps the existing entry, sorted
bash "$SUT" "$T/r" "$T/r/settings.json" >/dev/null 2>&1
check "A exit" "$?" "0"
check "A list" "$(jq -c '.claudeMdExcludes' "$T/r/settings.json")" '["**/kept.md","**/late.md","**/scoped.md"]'
check "A other keys kept" "$(jq -c '.hooks' "$T/r/settings.json")" '{}'

# B: a second run is byte-identical
cp "$T/r/settings.json" "$T/first.json"
bash "$SUT" "$T/r" "$T/r/settings.json" >/dev/null 2>&1
if cmp -s "$T/first.json" "$T/r/settings.json"; then ok "B idempotent"; else bad "B idempotent"; fi

# C: a missing settings file is created
bash "$SUT" "$T/r" "$T/r/new.local.json" >/dev/null 2>&1
check "C exit" "$?" "0"
check "C list" "$(jq -c '.claudeMdExcludes' "$T/r/new.local.json")" '["**/late.md","**/scoped.md"]'

# D: default settings path is <root>/.claude/settings.json
printf '{}\n' > "$T/r/.claude/settings.json"
bash "$SUT" "$T/r" >/dev/null 2>&1
check "D default path" "$(jq -c '.claudeMdExcludes | length' "$T/r/.claude/settings.json")" "2"

# E: invalid JSON exits 2 and leaves the file alone
printf 'not json\n' > "$T/r/broken.json"
bash "$SUT" "$T/r" "$T/r/broken.json" >/dev/null 2>&1
check "E exit" "$?" "2"
check "E untouched" "$(cat "$T/r/broken.json")" "not json"

# F: no path-scoped rule exits 3
mkdir -p "$T/empty/.claude/rules"
cp "$T/r/.claude/rules/unscoped.md" "$T/empty/.claude/rules/"
bash "$SUT" "$T/empty" "$T/empty/s.json" >/dev/null 2>&1
check "F exit" "$?" "3"

# G: no repo root exits 2
bash "$SUT" >/dev/null 2>&1
check "G exit" "$?" "2"

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
