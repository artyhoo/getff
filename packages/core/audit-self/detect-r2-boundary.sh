#!/usr/bin/env bash
# detect-r2-boundary.sh — C1 of install auto-wire R2 (GH #547 Point 2).
#
# Classifies a repo into exactly one R2-boundary verdict by READING it (pure bash + find/grep, no
# node/eslint). The installer (C2, install.sh §6b-bis) and BOTH inertness gates (C4: check-rule-
# globs.sh + check-rule-enforced.sh via r2-na-marker.sh) consume the verdict to decide whether R2
# must be wired, may be recorded N/A, or stays the red alarm.
#
# Verdicts (the FIRST stdout line is exactly one of):
#   boundary-present       — a manual-parse HTTP boundary exists: ≥1 file under a RULE_GLOBS.boundary
#                            token folder (handlers/routes/controllers/app·api/actions) OR a zod parse
#                            call (`.safeParse(` anywhere, or `<ident>.parse(` where <ident> ∉
#                            JSON/Date/Number/parseInt/parseFloat) in NON-TEST source. R2 must be
#                            active. Subsequent `glob:<pattern>` lines list the covering globs the
#                            installer should ensure RULE_GLOBS.boundary holds.
#   no-boundary-confident  — declarative-validation framework (allowlist) present AND zero boundary
#                            signals. Safe to record a conditional R2 N/A.
#   no-boundary-yet        — zero boundary signals AND no `zod` declared in any package.json of the
#                            repo: no HTTP boundary yet, and nothing to write a zod one with. The
#                            installer records the same conditional N/A (only into getff's own,
#                            unedited ESLint config — 60-ci.sh), re-checked by the same gates.
#   ambiguous              — anything else. Stay red (today's behaviour). No auto-green on doubt.
#
# Conservative invariant (LOAD-BEARING): a verdict that waives R2 needs zero boundary signals AND a
# positive reason the zero is real — an allowlisted declarative framework (no-boundary-confident),
# or no zod to parse with at all (no-boundary-yet). Every uncertain case degrades to `ambiguous`.
# Either waiver is re-checked on every push (r2-na-marker.sh), so it never outlives its precondition:
# a declarative N/A then fails the gates as stale; a no-boundary-yet N/A stops applying and the gates
# judge R2's globs as usual (R2 itself stays on in getff's config and lints the new code). The worst
# realistic outcome of a doubt stays a false `ambiguous` (a red the human reconciles) — as before.
# Relaxed 2026-09-29 (P2 K2, operator log entry 28 fork 1 = A): the invariant used to read
# «no-boundary-confident requires a POSITIVE allowlist match AND zero boundary signals», which left
# every project with no HTTP boundary yet red on its first push.
#
# Exit: always 0 (a classifier, not a gate). The verdict is on stdout.
set -uo pipefail

ROOT="${R2_DETECT_ROOT:-.}"
PKG_JSON="${R2_PKG_JSON:-$ROOT/package.json}"

# Declarative-validation frameworks whose presence + zero boundary signals → confident N/A. SEED:
# @hono/zod-openapi only (timeliner's stack). Extensible: comma-separated env override. Other
# declarative stacks (tRPC, Fastify schema, TypeBox) deliberately stay `ambiguous` (red) until added
# here — the safe default (spec §9 risk 3 / kickoff risk 3).
DECLARATIVE_ALLOWLIST="${R2_DECLARATIVE_ALLOWLIST:-@hono/zod-openapi}"

# PRUNE excludes build/vendor dirs AND `eslint-rules-local` — the AIF-shipped rule plugin install.sh
# generates into the consumer. That dir's own rule source (e.g. no-unsafe-zod-parse.ts) literally
# contains `.safeParse(`/`.parse(` as the thing the rule TALKS ABOUT — counting it as a consumer
# boundary signal would false-positive every install to boundary-present (GH #547 self-test finding).
# From #735 until 2026-09-28 install.sh ALSO shipped the framework's vendored rules to
# `packages/core/eslint-rules/` (so guard-liveness.ts could load), and a consumer installed in that
# window still carries them — same `.parse(`-as-rule-subject false-positive as eslint-rules-local
# above, at a different path. Prune the vendored framework tree too. (GH #777)
# Only getff's OWN subtrees of a packages/core are pruned — its eslint-rules/, and a hooks/ dir that
# holds getff's pre-push files (pre-push.ts was vendored until #1860; the fallback and the bundle
# still are). A consumer workspace named packages/core is the consumer's code: pruning the whole dir
# hid its zod declaration and its parse sites, and a real boundary read no-boundary-yet (P2 cold
# review B1).
PRUNE=( -name node_modules -o -name dist -o -name coverage -o -name .stryker-tmp -o -name reports -o -name .next -o -name .git -o -name eslint-rules-local -o -path '*/packages/core/eslint-rules' -o -path '*/.claude/worktrees' )
while IFS= read -r _hooks; do
  if [ -e "$_hooks/pre-push.ts" ] || [ -e "$_hooks/pre-push.fallback.sh" ] || [ -e "$_hooks/pre-push.bundle.mjs" ]; then
    PRUNE+=( -o -path "$_hooks" )
  fi
done < <(find "$ROOT" \( -name node_modules -o -name .git \) -prune -o -type d -path '*/packages/core/hooks' -print 2>/dev/null)
BOUNDARY_TOKENS=( handlers routes controllers actions )   # app/api is two-segment → path-probed below

# A file is "test" (excluded from boundary signals) if it is *.test.* / *.spec.* / under __tests__ / under tests/.
is_test_path() { case "$1" in *.test.*|*.spec.*|*/__tests__/*|*/tests/*) return 0 ;; esac; return 1; }

# (1) Files under a boundary-token folder (one path per line, non-test only).
boundary_token_files() {
  local t f
  for t in "${BOUNDARY_TOKENS[@]}"; do
    while IFS= read -r f; do is_test_path "$f" || printf '%s\n' "$f"; done < <(
      find "$ROOT" \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -path "*/$t/*" -print 2>/dev/null)
  done
  while IFS= read -r f; do is_test_path "$f" || printf '%s\n' "$f"; done < <(
    find "$ROOT" \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -path "*/app/api/*" -print 2>/dev/null)
}

# (2) zod-parse call sites in non-test source (one path per line). Detection MUST be as broad as the
# R2 AST rule (no-unsafe-zod-parse.ts), which flags ANY `.parse(` member call regardless of what
# precedes it — `).parse(`, `].parse(`, indented `.parse(`, `.parse (` — so a leading-identifier
# anchor would MISS idiomatic zod (`z.object({…}).parse(req)`) and produce a false N/A that silently
# un-guards a real boundary (GH #547 cold-review BLOCKER; DECIDED #4 forbids any false-N/A). So:
# a file is a parse-site if it has a `.safeParse(` anywhere, OR strictly more `.parse(` calls than
# stdlib `(JSON|Date|Number).parse(` calls (the only non-zod `.parse(` callers). Whitespace-tolerant
# before `(`. False-RED on a `.parse(` in a comment/string is acceptable (DECIDED #4); false-N/A is not.
parse_site_files() {
  local f total stdlib
  while IFS= read -r f; do
    is_test_path "$f" && continue
    if grep -qE '\.safeParse[[:space:]]*\(' "$f" 2>/dev/null; then printf '%s\n' "$f"; continue; fi
    total=$(grep -oE '\.parse[[:space:]]*\(' "$f" 2>/dev/null | grep -c .)
    stdlib=$(grep -oE '(JSON|Date|Number)\.parse[[:space:]]*\(' "$f" 2>/dev/null | grep -c .)
    [ "$total" -gt "$stdlib" ] && printf '%s\n' "$f"
  done < <(find "$ROOT" \( "${PRUNE[@]}" \) -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -print 2>/dev/null)
}

# (3) Is an allowlisted declarative-validation framework declared in package.json (deps or devDeps)?
declarative_framework_present() {
  [ -f "$PKG_JSON" ] || return 1
  local dep esc
  while IFS= read -r dep; do
    [ -z "$dep" ] && continue
    esc=$(printf '%s' "$dep" | sed 's/[.[\*^$/]/\\&/g')   # escape ERE metachars (/, ., etc.)
    grep -qE "\"$esc\"[[:space:]]*:" "$PKG_JSON" && return 0
  done < <(printf '%s\n' "$DECLARATIVE_ALLOWLIST" | tr ',' '\n')
  return 1
}

# (4) Is `zod` declared (deps, devDeps, peer or optional) in any package.json of the repo — a
# workspace package included? The key must be exactly "zod": zod-to-json-schema is not zod.
zod_declared() {
  local f
  while IFS= read -r f; do
    grep -qE '"zod"[[:space:]]*:' "$f" 2>/dev/null && return 0
  done < <(find "$ROOT" \( "${PRUNE[@]}" \) -prune -o -type f -name package.json -print 2>/dev/null)
  return 1
}

BT_FILES="$(boundary_token_files)"
PS_FILES="$(parse_site_files)"

if [ -n "$BT_FILES" ] || [ -n "$PS_FILES" ]; then
  echo "boundary-present"
  # Default RULE_GLOBS.boundary globs always cover the token folders.
  for g in '**/handlers/**/*.{ts,tsx}' '**/routes/**/*.{ts,tsx}' '**/controllers/**/*.{ts,tsx}' '**/app/api/**/*.{ts,tsx}' '**/actions/**/*.{ts,tsx}'; do
    echo "glob:$g"
  done
  # For every parse-site OUTSIDE a token folder, emit a parent-dir-token glob so a hand-rolled parse
  # boundary (e.g. src/api/x.ts) gets R2 coverage (spec fixture B). Dedup the extras.
  printf '%s\n' "$PS_FILES" | while IFS= read -r f; do
    [ -z "$f" ] && continue
    case "$f" in */handlers/*|*/routes/*|*/controllers/*|*/app/api/*|*/actions/*) continue ;; esac
    tok=$(basename "$(dirname "$f")")
    [ -n "$tok" ] && [ "$tok" != "." ] && echo "glob:**/$tok/**/*.{ts,tsx}"
  done | sort -u
  exit 0
fi

if declarative_framework_present; then
  echo "no-boundary-confident"
  exit 0
fi

if ! zod_declared; then
  echo "no-boundary-yet"
  exit 0
fi

echo "ambiguous"
exit 0
