#!/usr/bin/env bash
# f8d — the AGENTS.md-referenced SoT files must EXIST on landing (P0-adjacent).
# AGENTS.md.template sends the very first agent session to `.ai-factory/DESCRIPTION.md` and
# `.ai-factory/ARCHITECTURE.md`, but the installer historically shipped only DESCRIPTION.template.md
# + ARCHITECTURE.<stack>.md and asked the HUMAN to manually rename — so on landing the referenced
# files did not exist (dangling references as the framework's first impression). This test asserts
# via the REAL install pipeline (mirror f8) that:
#   (pos)    .ai-factory/DESCRIPTION.md + .ai-factory/ARCHITECTURE.md EXIST after install.
#   (header) the materialized ARCHITECTURE.md carries no stale "Drop into `.ai-factory/ARCHITECTURE.md`"
#            line (reads wrong once the file IS ARCHITECTURE.md).
#   (neg)    a pre-existing consumer DESCRIPTION.md is NOT clobbered on re-run (copy_safe semantics).
#   (steps)  Next-steps output no longer tells the human to "save as" (rename) — it says review/edit.
#   (stack)  a non-ts-server stack (react-native) also lands a real ARCHITECTURE.md.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── ts-server greenfield: both SoT files materialize ──────────────────────────
T=$(mktemp -d)
printf '{"name":"f8d","version":"0.0.0"}\n' > "$T/package.json"
STEPS=$( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force 2>&1 )

[ -f "$T/.ai-factory/DESCRIPTION.md" ] \
  && ok ".ai-factory/DESCRIPTION.md materialized on landing" \
  || bad ".ai-factory/DESCRIPTION.md missing — AGENTS.md references a non-existent SoT"

[ -f "$T/.ai-factory/ARCHITECTURE.md" ] \
  && ok ".ai-factory/ARCHITECTURE.md materialized on landing" \
  || bad ".ai-factory/ARCHITECTURE.md missing — AGENTS.md references a non-existent SoT"

# (header) the stale "Drop into .ai-factory/ARCHITECTURE.md" instruction must be gone from the copy.
if [ -f "$T/.ai-factory/ARCHITECTURE.md" ]; then
  if grep -qF 'Drop into `.ai-factory/ARCHITECTURE.md`' "$T/.ai-factory/ARCHITECTURE.md"; then
    bad "ARCHITECTURE.md still says 'Drop into .ai-factory/ARCHITECTURE.md' (reads wrong once it IS that file)"
  else
    ok "ARCHITECTURE.md header rewritten — no stale 'Drop into' instruction"
  fi
fi

# (steps) Next-steps no longer instructs a manual "save as" rename.
if grep -qiE 'save as' <<<"$STEPS"; then
  bad "Next-steps still tells the human to 'save as' (rename) — files are now materialized"
else
  ok "Next-steps output free of stale 'save as' rename instruction"
fi
# and DOES point the human at the generated files to review/edit.
if grep -qiE '\.ai-factory/DESCRIPTION\.md' <<<"$STEPS" && grep -qiE '\.ai-factory/ARCHITECTURE\.md' <<<"$STEPS"; then
  ok "Next-steps points at the generated .ai-factory SoT files to review/edit"
else
  bad "Next-steps no longer references the generated DESCRIPTION.md/ARCHITECTURE.md"
fi

# ── neg (load-bearing): a consumer-edited DESCRIPTION.md is NOT clobbered ──────
# Fresh consumer, seed a sentinel DESCRIPTION.md BEFORE install, run WITHOUT --force.
N=$(mktemp -d)
printf '{"name":"f8dneg","version":"0.0.0"}\n' > "$N/package.json"
mkdir -p "$N/.ai-factory"
SENTINEL="CONSUMER-OWNED-DESCRIPTION-DO-NOT-CLOBBER-$$"
printf '# %s\n' "$SENTINEL" > "$N/.ai-factory/DESCRIPTION.md"
( cd "$N" && git init -q && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
if grep -qF "$SENTINEL" "$N/.ai-factory/DESCRIPTION.md"; then
  ok "neg: pre-existing consumer DESCRIPTION.md preserved (copy_safe skip-if-exists)"
else
  bad "neg: consumer DESCRIPTION.md was CLOBBERED — copy_safe semantics violated"
fi

# ── stack: react-native also lands a real ARCHITECTURE.md ─────────────────────
RN=$(mktemp -d)
printf '{"name":"f8drn","version":"0.0.0"}\n' > "$RN/package.json"
( cd "$RN" && git init -q && bash "$REPO_ROOT/install.sh" react-native --force ) >/dev/null 2>&1
[ -f "$RN/.ai-factory/ARCHITECTURE.md" ] \
  && ok "stack: react-native install lands .ai-factory/ARCHITECTURE.md" \
  || bad "stack: react-native install left .ai-factory/ARCHITECTURE.md missing"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
