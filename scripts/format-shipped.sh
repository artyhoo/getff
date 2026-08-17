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
#
# `.claude/skills` is taken WHOLE, not as an allowlist of shipped slugs. The former list
# (pipeline / dispatcher / aif-doctor / template-audit) was hand-maintained and had drifted from
# what setup.d/10-skills.sh actually delivers: eight shipped slugs — ai-doc, arch,
# claude-glm-executor-handoff, harvest, night-mode, rule-research, rule-tests, story — were
# outside the gate's population, and two of them (arch, night-mode) shipped Prettier-dirty as a
# result (GH #1377 class). The two slugs that do NOT ship (reviewer, self-reflection) are
# repo-internal docs; formatting them costs nothing and removes the drift class by construction,
# which an allowlist + a completeness gate could only detect after the fact.
PATHSPECS=(
  skills
  .claude/skills
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
    packages/core/templates/python/*) continue ;; # getff-rendered Python delivery templates (S1 T4): verbatim backend-renderer output, byte-drift-gated (packages/core/backends/python-templates-drift.test.ts) — Prettier would break byte-reproducibility, same class as *.bundle.mjs above
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

# ── Phase 2: DELIVERED conformance (GH #1378) ────────────────────────────────────────────────
# Everything above checks the SOURCE tree. install.sh does not deliver skill/agent markdown
# verbatim: setup.d/lib.sh:transform_internal_refs() rewrites repo-internal refs to
# ${UPSTREAM_BLOB_URL} blob URLs AFTER the copy. A rewrite inside a markdown table cell grows that
# cell by ~50 characters while the `| --- |` separator row keeps upstream's dash count, so the
# DELIVERED file is Prettier-dirty BY CONSTRUCTION even when the source is clean — and it hits
# files unchanged upstream, because agents and skills are re-delivered unconditionally on refresh.
#
# This phase measures the bytes the consumer actually receives: it materialises each transformed
# file at its CONSUMER-FINAL path under a temp root carrying the shipped .prettierrc.json, because
# Prettier resolves config from the file's path — a blob checked in /tmp is measured against
# Prettier's defaults and proves nothing about the shipped config.
#
# It calls the REAL transform (INSTALL_SH_LIB_ONLY=1 source of setup.d/lib.sh, the same entry
# tests/install-sh/transform-internal-refs.test.sh uses), never a reimplementation — so the check
# cannot drift from the installer. Scoped to the three roots install.sh routes through the
# transform; running it on a file with no internal refs is a no-op, so over-inclusion is safe.
#
# NOT auto-fixable: Prettier-writing the transformed copy cannot be mapped back onto the source
# (source-clean and delivered-clean want DIFFERENT column padding for the same table). --write
# therefore reports the same finding as --check. Remedies are author-side, named in the message.
delivered_map() { # repo path → consumer path, or empty when the file is not transform-routed
  local slug
  case "$1" in
    skills/*)
      echo ".claude/${1}" ;;                             # skills/getff/… → .claude/skills/getff/…
    .claude/skills/*)
      # Authored in place, delivered in place — EXCEPT the slugs that also exist under the repo-root
      # skills/ tree. For those, setup.d/10-skills.sh installs from `$PKG_ROOT/skills/<slug>` (the
      # two trees are not twins: skills/tool-bootstrapping carries templates/ the .claude/ copy does
      # not), so the .claude/ copy is operator-side only. Mapping both would make two repo paths
      # claim one consumer path and silently measure whichever was copied last.
      slug="${1#.claude/skills/}"; slug="${slug%%/*}"
      [ -d "skills/$slug" ] && { echo ""; return 0; }
      echo "$1" ;;
    agents/*)
      echo ".claude/agents/${1#agents/}" ;;
    *)
      echo "" ;;
  esac
}

DELIVERED=()
for f in "${FILES[@]:-}"; do
  [ -n "$f" ] || continue
  case "$f" in *.md) ;; *) continue ;; esac
  d=$(delivered_map "$f")
  [ -n "$d" ] && DELIVERED+=("$f=>$d")
done

if [ "${#DELIVERED[@]}" -gt 0 ]; then
  DTMP=$(mktemp -d)
  trap 'rm -rf "$DTMP"' EXIT
  REPO_ROOT=$(pwd)
  cp .prettierrc.json "$DTMP/.prettierrc.json"
  DPATHS=()
  for pair in "${DELIVERED[@]}"; do
    src="${pair%%=>*}"; dst="${pair#*=>}"
    mkdir -p "$DTMP/$(dirname "$dst")"
    cp "$src" "$DTMP/$dst"
    DPATHS+=("$dst")
  done
  # Subshell: install.sh's lib sets `set -euo pipefail` conventions of its own; isolate them.
  drc=0
  (
    cd "$DTMP"
    # shellcheck disable=SC1090
    INSTALL_SH_LIB_ONLY=1 . "$REPO_ROOT/setup.d/lib.sh"
    set +e
    for p in "${DPATHS[@]}"; do transform_internal_refs "$p"; done
  ) || drc=1
  if [ "$drc" -eq 0 ]; then
    # --ignore-path /dev/null: the shipped .prettierignore's managed block lists these very files,
    # so honouring it here would measure "is it hidden?" instead of "is it conformant?".
    ( cd "$DTMP" && npx --yes prettier@3.8.3 --check --ignore-path /dev/null "${DPATHS[@]}" ) || drc=$?
  fi
  if [ "$drc" -ne 0 ]; then
    rc=$drc
    echo "" >&2
    echo "format-shipped: the above paths are the DELIVERED (post-transform) shapes, not your sources." >&2
    echo "  A repo-internal ref rewritten into a blob URL changed the file's Prettier form — most often" >&2
    echo "  a ref inside a markdown table cell, which re-pads every column. 'npm run format' cannot fix" >&2
    echo "  this: the source and the delivery want different padding. Fix it in the SOURCE by either" >&2
    echo "    (a) moving the ref out of the table cell (prose line or a footnote below the table), or" >&2
    echo "    (b) putting <!-- prettier-ignore --> DIRECTLY above the table — no blank line between" >&2
    echo "        the comment and the header row, or Prettier re-pads the table anyway (measured)." >&2
  fi
fi

if [ "$rc" -ne 0 ] && [ "$MODE" = "--check" ]; then
  echo "" >&2
  echo "format-shipped: shipped artifacts are not Prettier-clean (run: npm run format)." >&2
  echo "  These files ship to consumers; a dirty source makes their first 'npm run validate' red." >&2
fi
exit "$rc"
