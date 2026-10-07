#!/usr/bin/env bash
# S? acceptance — scripts/plugin-source-hashes.sh writer, against a sandbox tree.
# spec: docs/superpowers/plans/2026-09-29-consumer-plugin-hook-dedup-d12.md (Task 1, fix round 1)
#
# The writer prints, for each plugin/hooks/<name> twin whose source .claude/hooks/<name>.sh
# exists, the source's hash + one line per declared @plugin-yield-deps path. Marker presence is
# tested SEPARATELY from the declared list being empty (fix round 1, item 1): a bare
# `# @plugin-yield-deps:` line means "reads nothing beside itself" (main-line entry only, the
# reaches_beside heuristic is never consulted); no marker at all falls through to reaches_beside
# (safe-by-construction: no entry when undeclared + risky, per the writer's own header).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
WRITER="$REPO_ROOT/scripts/plugin-source-hashes.sh"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
SANDBOX="$TMP/sandbox"
mkdir -p "$SANDBOX/.claude/hooks" "$SANDBOX/plugin/hooks"

# (1) undeclared reach-beside hook gets NO entry (safe-by-construction fallback).
cat > "$SANDBOX/.claude/hooks/risky.sh" <<'EOF'
#!/usr/bin/env bash
# risky.sh — no marker, reads a sibling via source
source "$(dirname "$0")/lib/whatever.sh"
EOF
: > "$SANDBOX/plugin/hooks/risky"
OUT1=$(bash "$WRITER" "$SANDBOX" 2>&1)
RC1=$?
if [ "$RC1" -eq 0 ] && ! printf '%s\n' "$OUT1" | grep -q 'risky.sh'; then
  ok "undeclared reach-beside hook gets no manifest entry"
else
  bad "undeclared reach-beside hook: rc=$RC1 out='$OUT1'"
fi
rm -f "$SANDBOX/.claude/hooks/risky.sh" "$SANDBOX/plugin/hooks/risky"

# (2) empty-declaration hook gets a MAIN-LINE-ONLY entry (reaches_beside not consulted, even
# though the source below would otherwise trip the widened detector via dirname "$0").
cat > "$SANDBOX/.claude/hooks/safe.sh" <<'EOF'
#!/usr/bin/env bash
# safe.sh — empty declaration: dirname "$0" only re-derives its own path
# @plugin-yield-deps:
SELF_PATH="$(dirname "$0")"
EOF
: > "$SANDBOX/plugin/hooks/safe"
OUT2=$(bash "$WRITER" "$SANDBOX" 2>&1)
RC2=$?
n_safe_lines=$(printf '%s\n' "$OUT2" | grep -c '^[0-9a-f]\{64\}  safe\.sh')
n_safe_dep_lines=$(printf '%s\n' "$OUT2" | grep -c '^[0-9a-f]\{64\}  safe\.sh:')
if [ "$RC2" -eq 0 ] && [ "$n_safe_lines" -eq 1 ] && [ "$n_safe_dep_lines" -eq 0 ]; then
  ok "empty-declaration hook gets a main-line-only entry"
else
  bad "empty-declaration hook: rc=$RC2 main_lines=$n_safe_lines dep_lines=$n_safe_dep_lines out='$OUT2'"
fi
rm -f "$SANDBOX/.claude/hooks/safe.sh" "$SANDBOX/plugin/hooks/safe"

# (3) a declaration naming a missing path exits 2.
cat > "$SANDBOX/.claude/hooks/bad-decl.sh" <<'EOF'
#!/usr/bin/env bash
# bad-decl.sh — declares a dep that does not exist under .claude/hooks/
# @plugin-yield-deps: lib/does-not-exist.sh
EOF
: > "$SANDBOX/plugin/hooks/bad-decl"
bash "$WRITER" "$SANDBOX" >/tmp/plugin-source-hashes-test-unused.$$ 2>/dev/null
RC3=$?
rm -f "/tmp/plugin-source-hashes-test-unused.$$"
[ "$RC3" -eq 2 ] && ok "declaration naming a missing path exits 2" || bad "bad declaration: rc=$RC3 (expected 2)"
rm -f "$SANDBOX/.claude/hooks/bad-decl.sh" "$SANDBOX/plugin/hooks/bad-decl"

# (4) output is in LC_ALL=C order (glob-order iteration over plugin/hooks/*, sorted byte-wise).
mkdir -p "$SANDBOX/.claude/hooks" "$SANDBOX/plugin/hooks"
for n in zeta Alpha beta; do
  printf '#!/usr/bin/env bash\n# %s.sh — no marker, reads nothing\necho hi\n' "$n" > "$SANDBOX/.claude/hooks/$n.sh"
  : > "$SANDBOX/plugin/hooks/$n"
done
OUT4=$(bash "$WRITER" "$SANDBOX" 2>/dev/null)
names_seen=$(printf '%s\n' "$OUT4" | sed -n 's/^[0-9a-f]\{64\}  \([A-Za-z]*\)\.sh$/\1/p')
names_expected=$(printf '%s\n' "$names_seen" | LC_ALL=C sort)
if [ "$names_seen" = "$names_expected" ]; then
  ok "output is in LC_ALL=C sorted order"
else
  bad "output order not LC_ALL=C: got '$names_seen' want '$names_expected'"
fi
rm -f "$SANDBOX/.claude/hooks/zeta.sh" "$SANDBOX/.claude/hooks/Alpha.sh" "$SANDBOX/.claude/hooks/beta.sh"
rm -f "$SANDBOX/plugin/hooks/zeta" "$SANDBOX/plugin/hooks/Alpha" "$SANDBOX/plugin/hooks/beta"

# Canonical owners win over a separately present compatibility path.
mkdir -p "$SANDBOX/.agents/hooks"
printf '#!/usr/bin/env bash\necho canonical\n' > "$SANDBOX/.agents/hooks/canonical.sh"
printf '#!/usr/bin/env bash\necho stale-legacy\n' > "$SANDBOX/.claude/hooks/canonical.sh"
: > "$SANDBOX/plugin/hooks/canonical"
OUT5=$(bash "$WRITER" "$SANDBOX" 2>/dev/null)
canonical_hash=$(shasum -a 256 "$SANDBOX/.agents/hooks/canonical.sh" | awk '{print $1}')
if printf '%s\n' "$OUT5" | grep -qF "$canonical_hash  canonical.sh"; then
  ok "canonical source hash wins over a stale compatibility entry"
else
  bad "writer hashed the compatibility entry instead of its canonical owner"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
