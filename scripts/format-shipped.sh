#!/usr/bin/env bash
# format-shipped.sh — GH #531. Dogfood Prettier on the SHIPPED surface: the files install.sh copies
# (verbatim or renamed) into consumer projects. Keeping these prettier-clean is what makes a fresh
# consumer's `prettier --check .` (part of `npm run validate`) green out-of-box — the framework was
# never running its own authored skill docs / configs / rule sources through Prettier.
#
# SCOPE: the shipped artifacts ONLY — NOT the framework's own README/CLAUDE/.claude/rules/
# docs/meta-factory (out of the consumer surface and authority-owned; reformatting them would be a
# huge unrelated diff). GENERATED install artifacts (rendered RULES.md, .claude/settings.json, the
# eslint-rules-local/index.ts barrel) are excluded — they have no stable authored source and ship
# under .prettierignore; see packages/core/templates/shared/.prettierignore. Framework-internal
# *.test.ts under shipped dirs do not ship and are excluded.
#
# Implementation: enumerate the ACTUAL tracked files under the shipped paths (git ls-files), filter
# to Prettier-handled extensions, then run prettier on that explicit list — this avoids the
# "No files matching the pattern" error that per-extension globs hit when a dir has none of an ext.
#
# Usage: format-shipped.sh --check [files...]   (default; CI gate — fails if any shipped source is unformatted)
#        format-shipped.sh --write [files...]   (fix in place)
#
# Optional [files...] (repo-relative, e.g. from `git diff --cached --name-only`): intersect the
# enumerated shipped surface with this list — check ONLY shipped files among them. Non-shipped
# arguments are ignored; if nothing intersects, exits 0 without invoking prettier. This is the
# change-scoped entry used by .husky/pre-commit (mirrors CI: same enumeration, same pinned prettier).
set -uo pipefail
MODE="${1:---check}"
case "$MODE" in --write | --check) ;; *) echo "usage: $0 --write|--check [files...]" >&2; exit 2 ;; esac
[ "$#" -gt 0 ] && shift
FILTER=("$@") # optional: restrict to these repo-relative paths (empty = full shipped surface)
cd "$(git rev-parse --show-toplevel)"

# Shipped paths (dirs + the exact pre-push closure — NOT the whole hooks/ dir, which is mostly
# framework-internal tests + the dynamically-imported guard-liveness.ts that does not ship).
PATHSPECS=(
  skills
  .claude/skills/pipeline .claude/skills/dispatcher .claude/skills/aif-doctor .claude/skills/template-audit
  agents
  packages/core/eslint-rules packages/core/probes
  packages/core/hooks/pre-push.ts packages/core/hooks/utils/run-check.ts packages/core/hooks/utils/git.ts
  packages/core/hooks/checks/prior-art.ts packages/core/hooks/checks/s17.ts
  packages/core/templates
  packages/preset-next-15-canonical/eslint-rules packages/preset-next-15-canonical/templates
  templates
)

FILES=()
while IFS= read -r f; do
  case "$f" in
    *RULES.md | *RULES.*.md) continue ;; # rendered SSOT tables (ship under .prettierignore)
    *.template) continue ;;              # handled below, parsed as markdown
    *.test.ts | *.test.tsx) continue ;;  # framework-internal tests do not ship
    */eslint-rules/*.mjs | */eslint-rules/*.d.ts) continue ;; # compiled rule artifacts (raw tsc output, baseline-identical, generated — ship as-is, #752 Variant A)
    */install/*.bundle.mjs) continue ;;  # esbuild-generated zero-dep bundle (#755, raw esbuild output, drift-gated by build-synth-bundle.sh --check — Prettier would break byte-reproducibility)
    *.md | *.mjs | *.cjs | *.json | *.yml | *.yaml | *.ts | *.tsx) FILES+=("$f") ;;
  esac
done < <(git ls-files -- "${PATHSPECS[@]}")

# `.template` sources ship renamed to `.md` (AGENTS.md.template → AGENTS.md), so Prettier must
# format them AS markdown — it cannot infer a parser from the `.template` extension.
TEMPLATES=()
while IFS= read -r f; do TEMPLATES+=("$f"); done < <(git ls-files -- '*.template' | grep -E '(^|/)(AGENTS|CLAUDE|tool-decisions)\.md\.template$')

# Intersect with the optional [files...] filter (bash-3.2-safe: no assoc arrays; guard set -u
# against empty-array expansion — see memory installsh_set_u_empty_array).
if [ "${#FILTER[@]}" -gt 0 ]; then
  KEEP=()
  if [ "${#FILES[@]}" -gt 0 ]; then
    for f in "${FILES[@]}"; do
      for g in "${FILTER[@]}"; do [ "$f" = "$g" ] && { KEEP+=("$f"); break; }; done
    done
  fi
  FILES=()
  [ "${#KEEP[@]}" -gt 0 ] && FILES=("${KEEP[@]}")
  KEEP=()
  if [ "${#TEMPLATES[@]}" -gt 0 ]; then
    for f in "${TEMPLATES[@]}"; do
      for g in "${FILTER[@]}"; do [ "$f" = "$g" ] && { KEEP+=("$f"); break; }; done
    done
  fi
  TEMPLATES=()
  [ "${#KEEP[@]}" -gt 0 ] && TEMPLATES=("${KEEP[@]}")
fi

FLAG="--check"
[ "$MODE" = "--write" ] && FLAG="--write"

rc=0
[ "${#FILES[@]}" -gt 0 ]     && { npx --yes prettier@3.8.3 "$FLAG" "${FILES[@]}"     || rc=$?; }
[ "${#TEMPLATES[@]}" -gt 0 ] && { npx --yes prettier@3.8.3 "$FLAG" --parser markdown "${TEMPLATES[@]}" || rc=$?; }

if [ "$rc" -ne 0 ] && [ "$MODE" = "--check" ]; then
  echo "" >&2
  echo "format-shipped: shipped artifacts are not Prettier-clean (run: npm run format)." >&2
  echo "  These files ship to consumers; a dirty source makes their first 'npm run validate' red." >&2
fi
exit "$rc"
