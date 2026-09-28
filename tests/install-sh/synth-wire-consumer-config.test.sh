#!/usr/bin/env bash
# synth-wire-consumer-config.test.sh — the preset synth-wire must never merge into an
# eslint.config.mjs the CONSUMER owns (operator decision 2026-09-23: skip + report, never
# overwrite or merge a consumer's tool config).
#
# THE BUG (2026-09-28, own-config consumer-matrix cell, react-next): copy_safe kept the consumer's
# own eslint.config.mjs, and then setup.d/99-finalize.sh's synth-wire AST-merged the preset's
# synthesized `rules-as-tests/*` rules into it anyway. The config then carried getff rules but no
# RULE_GLOBS block, so check:globs failed validate and the first push. The merge happens only
# where ts-morph resolves (an `--full` install), which is why a plain install never showed it.
#
# Provenance, not content, decides ownership: a config getff delivered is staged by this run or
# recorded in .ai-factory/refresh-baseline.json by an earlier one; the consumer's own is neither.
#
# Arms:
#   A  consumer-owned config, no live-research snippet: the config is byte-identical after the
#      install, the synth-wire says it did not merge, and the not-wired summary names the file;
#   B  paired negative — getff's own config (fresh install, then a plain re-install that finds it
#      in the baseline manifest): synth-wire still runs on it (the gate is not blanket).
# ts-morph is borrowed from the framework through per-package symlinks inside a REAL node_modules
# directory: a symlinked node_modules directory would let any package install write into the
# framework's tree. Without ts-morph the wirer degrades to «add it by hand» and arm A would pass
# vacuously, so its absence is a FAIL, not a skip.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

FW_NM="$REPO_ROOT/node_modules"
borrow() { # $1 = project dir — link the packages the wirer and its lint probe resolve
  local p
  mkdir -p "$1/node_modules"
  for p in ts-morph typescript eslint @eslint typescript-eslint @typescript-eslint; do
    [ -e "$FW_NM/$p" ] && ln -s "$FW_NM/$p" "$1/node_modules/$p"
  done
}
unborrow() { find "$1/node_modules" -maxdepth 1 -type l -exec rm -f {} + 2>/dev/null; rmdir "$1/node_modules" 2>/dev/null; return 0; }

if [ ! -f "$FW_NM/ts-morph/package.json" ]; then
  bad "ts-morph is not installed in the framework (run npm install first) — without it arm A is vacuous"
  echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi

SKIP_LINE='your own config'

# ── A: consumer-owned config, no live snippet ──────────────────────────────────────────────────
A="$WORK/own"; mkdir -p "$A/lib"
printf '{ "name": "swa", "version": "0.0.0" }\n' > "$A/package.json"
cat > "$A/eslint.config.mjs" <<'JS'
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(eslint.configs.recommended, tseslint.configs.recommended);
JS
printf 'export const answer = 42;\n' > "$A/lib/answer.ts"
cp "$A/eslint.config.mjs" "$WORK/own.before"
borrow "$A"
( cd "$A" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/a.log" 2>&1
rc_a=$?
unborrow "$A"
[ "$rc_a" -eq 0 ] || bad "A: install.sh react-next rc=$rc_a (tail: $(tail -3 "$WORK/a.log" | tr '\n' '|'))"
if cmp -s "$A/eslint.config.mjs" "$WORK/own.before"; then
  ok "A: the consumer's eslint.config.mjs is byte-identical after the install (nothing merged into it)"
else
  bad "A: the install changed the consumer's eslint.config.mjs:"
  diff "$WORK/own.before" "$A/eslint.config.mjs" | head -8 | sed 's/^/      /'
fi
grep -q "synth-wire: eslint.config.mjs is $SKIP_LINE" "$WORK/a.log" \
  && ok "A: synth-wire says it did not merge into the consumer's own config" \
  || bad "A: no synth-wire line saying the consumer's own config was left alone"
awk '/NOT wired, or wired only in part/{on=1} on' "$WORK/a.log" | grep -q 'eslint.config.mjs.*your own config' \
  && ok "A: the not-wired summary names eslint.config.mjs as the consumer's own config" \
  || bad "A: the not-wired summary does not report the unmerged stack rules"

# ── B: getff's own config — fresh install, then a plain re-install ─────────────────────────────
B="$WORK/fresh"; mkdir -p "$B"
printf '{ "name": "swb", "version": "0.0.0" }\n' > "$B/package.json"
borrow "$B"
( cd "$B" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/b1.log" 2>&1
rc_b1=$?
( cd "$B" && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/b2.log" 2>&1
rc_b2=$?
unborrow "$B"
[ "$rc_b1" -eq 0 ] && [ "$rc_b2" -eq 0 ] || bad "B: install rc=$rc_b1 / re-install rc=$rc_b2"
grep -q '▶ synth-wire: confirming' "$WORK/b1.log" && ! grep -q "$SKIP_LINE" "$WORK/b1.log" \
  && ok "B neg: a freshly placed getff config still goes through synth-wire" \
  || bad "B neg: synth-wire skipped getff's own freshly placed config"
grep -q '▶ synth-wire: confirming' "$WORK/b2.log" && ! grep -q "synth-wire: eslint.config.mjs is $SKIP_LINE" "$WORK/b2.log" \
  && ok "B neg: on a re-install, getff's config (in the baseline manifest) still goes through synth-wire" \
  || bad "B neg: synth-wire skipped getff's own config on a re-install"

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
