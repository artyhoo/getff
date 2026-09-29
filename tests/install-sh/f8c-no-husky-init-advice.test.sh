#!/usr/bin/env bash
# cih-s2 F8c — install.sh "Next steps" must NOT advise `npx husky init`.
# S1's F2 fix made install.sh ACTIVATE git hooks itself (sets core.hooksPath=.husky and
# ships .husky/pre-commit + pre-push). The post-install "Next steps" echo, however, still
# told the user to run `npx husky init` — which is (a) redundant after that auto-activation
# and (b) DESTRUCTIVE: `husky init` overwrites .husky/pre-commit with its own sample, i.e.
# it would CLOBBER the shipped hooks the installer just placed. (The activation logic itself
# already chose core.hooksPath over husky init — S1 fixed the mechanism but missed the
# user-facing echo. F8c finishes it.)
#
# Acceptance is on the install RUNTIME OUTPUT (the advice is an echo, not a shipped file):
#   pos: the install output presents NO `husky init` as an actionable step. A line that
#        WARNS against it ("do NOT run 'npx husky init'") is allowed — only an imperative
#        instruction to run it is the defect, so the check filters out negation lines.
#   pos-B: the output names the real activation (core.hooksPath) — proves the dangerous step
#          was REPLACED with correct guidance, not silently dropped (non-vacuous).
#
# PAIRED-NEGATIVE (umbrella discipline): the neg arm re-introduces the `npx husky init` advice
# into a COPY of install.sh, runs it, and re-applies the SAME pos predicate — which MUST now
# fail (the advice is detected). A neg that does not bite means the pos check was vacuous.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Returns 0 (clean) when the given install-output text contains no `husky init` ADVICE.
# A `husky init` mention is benign only if its line also negates it (do not / don't / clobber / would).
no_husky_init_advice() {
  local hits bad_lines
  hits=$(printf '%s' "$1" | grep -iE 'husky init' || true)
  [ -z "$hits" ] && return 0
  bad_lines=$(printf '%s\n' "$hits" | grep -viE "do not|don't|never|clobber|would" || true)
  [ -z "$bad_lines" ]
}

# ── pos: run the REAL install.sh, capture output, assert no husky-init advice ──
T=$(mktemp -d)
printf '{ "name":"t","version":"0.0.0" }\n' > "$T/package.json"
out=$( cd "$T" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force 2>&1 )

if no_husky_init_advice "$out"; then
  ok "pos: install 'Next steps' output advises no 'npx husky init' (only a warning is allowed)"
else
  bad "pos: install output still advises 'npx husky init' (clobbers shipped hooks):"$'\n'"$(printf '%s\n' "$out" | grep -niE 'husky init' | grep -viE "do not|don't|never|clobber|would")"
fi

# ── pos-B (non-vacuous): the real activation (core.hooksPath) is communicated ──
grep -qiE 'core\.hooksPath' <<<"$out" \
  && ok "pos-B: output names the real activation (core.hooksPath) — advice replaced, not dropped" \
  || bad "pos-B: output never mentions core.hooksPath — activation guidance missing"

# ── neg (LOAD-BEARING): re-introduce the imperative 'npx husky init' advice (an actionable
#    step, no negation) into the captured output and re-apply the SAME predicate → it MUST now
#    flag it. A neg that stays clean means the pos predicate was vacuous. (String-level mutation
#    of the artifact, mirroring the f9 probe's neg arm — proves the predicate bites, and is
#    immune to PKG_ROOT resolution when install.sh is copied out of the repo tree.) ──
negout="$out"$'\n'"  6. npx husky init && verify hooks installed"
if no_husky_init_advice "$negout"; then
  bad "neg: re-injected 'npx husky init' advice but pos predicate stayed clean → VACUOUS check"
else
  ok "neg: re-injected 'npx husky init' advice → pos predicate flips to fail (non-vacuous)"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
