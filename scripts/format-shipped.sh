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
  # The runtime-bridge VENDOR drop only (setup.d/55-runtime-bridge-vendor.sh cp -r's it into a
  # factory-profile consumer at .claude/vendor/runtime-bridge/). Its upstream
  # packages/runtime-bridge/src/ stays OUT: it never ships, and non-shipped framework-internal
  # source is uniformly unformatted here by this script's own scope rule (measured 2026-08-17:
  # backends 18/18, install 3/3, runtime-bridge/src 17/20 dirty). The vendor copy is currently
  # byte-identical to that upstream and formatting it breaks that identity — deliberate: the
  # shipped/non-shipped boundary is exactly where formatting starts, and a future hand re-copy
  # from src now lands dirty and goes RED here instead of silently reaching consumers.
  packages/runtime-bridge/vendor
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

# ── Phase 3: vendored-copy ↔ source content parity (#1597 ledger, C14 follow-up) ─────────────
# Phases 1-2 ask "is the shipped byte-stream Prettier-clean?". Neither asks the prior question:
# "is it still the same CODE as the thing it was copied from?"
#
# packages/runtime-bridge/vendor/ is a hand-maintained COPY of packages/runtime-bridge/src/ that
# install.sh drops into every --profile factory consumer at .claude/vendor/runtime-bridge/. The
# two are content-identical by construction — vendor is exactly `prettier(src)`, because the
# vendor path is inside PATHSPECS above while its upstream is not. NOTHING enforced that: an edit
# to src/ that was never re-vendored left the consumer running older logic, silently, with every
# existing gate green (measured 2026-09-05 while fixing ledger A6-3/A5-3/K-2/K-3/A5-6 — the
# parity had to be verified BY HAND, with a throwaway prettier round-trip, because no channel
# owned it). Same class as the plugin-twin drift guards (packages/core/principles/
# 24-plugin-manifest-integrity.test.ts (d)/(e)/(g)) and as the vendor hook ↔ .claude/hooks twin.
#
# WHY HERE and not a principle test: this check needs the SAME pinned Prettier the vendor copy is
# formatted with. The principles CI job installs packages/core only (audit-self.yml:265-268) and
# the root tree carries a different Prettier version, so a principle test would either add a
# dependency or measure with the wrong formatter and go false-red. This script already pins
# prettier@3.8.3, already enumerates the vendor drop, and already runs at pre-commit
# (.husky/pre-commit:125) — the earliest channel that can see the pair. Prior art for the
# regenerate-into-temp-and-compare shape: prior-art-evaluations.md#270.
#
# DETECT-ONLY, in BOTH modes, deliberately. Auto-copying src→vendor on --write would silently
# resolve the vendor README's parked P4 fork ("manual re-vendor vs sync script vs never-until-U9")
# by making src authoritative. This check only reports that the two disagree; WHICH side is right
# is the author's call, and both fix directions are printed.
#
# Direction checked: every vendored file must still match its source. The reverse (a src file that
# is not vendored) is NOT a defect — the vendored set is a recorded decision, see the vendor
# README's "Files NOT copied" list.
RB_SRC="packages/runtime-bridge/src"
RB_VENDOR="packages/runtime-bridge/vendor/src"

parity_scope=0
if [ "${#FILTER[@]}" -eq 0 ]; then
  parity_scope=1                        # full sweep (CI, `npm run format`)
else
  # Change-scoped (pre-commit): ANY half of EITHER pair moving can break its partner — the
  # TypeScript source/vendor pair, and the bash hook twin whose upstream lives under .claude/hooks/
  # (a commit touching only that side would otherwise slip past this phase entirely).
  for g in "${FILTER[@]}"; do
    case "$g" in
      "$RB_SRC"/*.ts | "$RB_VENDOR"/*.ts | packages/runtime-bridge/vendor/hooks/* | .claude/hooks/runtime-bridge-dispatch.sh)
        parity_scope=1; break ;;
    esac
  done
fi

if [ "$parity_scope" -eq 1 ] && [ -d "$RB_VENDOR" ]; then
  PARITY_RELS=()
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    PARITY_RELS+=("${v#"$RB_VENDOR"/}")
  done < <(git ls-files -- "$RB_VENDOR" | grep -E '\.ts$' || true)

  if [ "${#PARITY_RELS[@]}" -gt 0 ]; then
    PTMP=$(mktemp -d)
    # Replaces Phase 2's trap; both dirs are cleaned whether or not Phase 2 ran.
    trap '[ -n "${DTMP:-}" ] && rm -rf "$DTMP"; [ -n "${PTMP:-}" ] && rm -rf "$PTMP"' EXIT
    cp .prettierrc.json "$PTMP/.prettierrc.json"

    orphaned=()   # vendored file whose source is gone
    staged=()     # sources materialised for the round-trip
    for rel in "${PARITY_RELS[@]}"; do
      if [ ! -f "$RB_SRC/$rel" ]; then orphaned+=("$rel"); continue; fi
      mkdir -p "$PTMP/$(dirname "$rel")"
      cp "$RB_SRC/$rel" "$PTMP/$rel"
      staged+=("$rel")
    done

    prc=0
    if [ "${#staged[@]}" -gt 0 ]; then
      # --write into the temp tree, never the repo: this produces `prettier(src)`, the exact
      # byte-stream the vendor copy is supposed to already be.
      ( cd "$PTMP" && npx --yes prettier@3.8.3 --write --ignore-path /dev/null "${staged[@]}" ) >/dev/null 2>&1 || prc=1
    fi

    drifted=()
    if [ "$prc" -eq 0 ]; then
      for rel in "${staged[@]:-}"; do
        [ -n "$rel" ] || continue
        cmp -s "$RB_VENDOR/$rel" "$PTMP/$rel" || drifted+=("$rel")
      done
    fi

    if [ "$prc" -ne 0 ]; then
      rc=1
      echo "" >&2
      echo "format-shipped: vendor parity check could not run — prettier failed on the source copies." >&2
    elif [ "${#drifted[@]}" -gt 0 ] || [ "${#orphaned[@]}" -gt 0 ]; then
      rc=1
      echo "" >&2
      echo "format-shipped: the vendored runtime-bridge COPY has drifted from its source." >&2
      echo "  These bytes ship to every --profile factory consumer at .claude/vendor/runtime-bridge/;" >&2
      echo "  a drifted copy means consumers run different logic than this repo's tests measure." >&2
      for rel in "${drifted[@]:-}"; do
        [ -n "$rel" ] || continue
        echo "    DRIFT   $RB_VENDOR/$rel  !=  prettier($RB_SRC/$rel)" >&2
      done
      for rel in "${orphaned[@]:-}"; do
        [ -n "$rel" ] || continue
        echo "    ORPHAN  $RB_VENDOR/$rel  has no source at $RB_SRC/$rel" >&2
      done
      echo "" >&2
      echo "  Fix — decide WHICH side is right, then:" >&2
      echo "    (a) source is right (the usual case: you edited src/ and did not re-vendor) —" >&2
      echo "        cp $RB_SRC/<rel> $RB_VENDOR/<rel>" >&2
      echo "        bash scripts/format-shipped.sh --write $RB_VENDOR/<rel>" >&2
      echo "    (b) the vendored change is right — make the same change in $RB_SRC/<rel> too;" >&2
      echo "        the two are content-identical by design (vendor README, 'What this is')." >&2
      echo "  This check never rewrites either side: the re-vendor MECHANISM is parked (vendor" >&2
      echo "  README, fork P4), so the copy direction stays an author decision." >&2
    fi
  fi

  # The vendor drop also carries a bash hook, and that pair is BYTE-identical (no prettier in the
  # loop — the twin is copied verbatim, and setup.d/55-runtime-bridge-vendor.sh:115 delivers it to
  # .claude/hooks/ on the consumer). It had no gate either (#1597 review-ledger addendum D-5); the
  # backward sweep for the parity rule above found it as the one remaining ungated copy of this
  # class — every other in-repo copy pair is already covered (plugin twins → principle 24(d)/(e)/(g),
  # the getff payload → MANIFEST.sha256, the synth bundle → build-synth-bundle.sh --check, the
  # python delivery templates → python-templates-drift.test.ts).
  _hook_v="packages/runtime-bridge/vendor/hooks/runtime-bridge-dispatch.sh"
  _hook_s=".claude/hooks/runtime-bridge-dispatch.sh"
  if [ -f "$_hook_v" ] && [ -f "$_hook_s" ] && ! cmp -s "$_hook_v" "$_hook_s"; then
    rc=1
    echo "" >&2
    echo "format-shipped: the vendored dispatch hook has drifted from its twin." >&2
    echo "    DRIFT   $_hook_v  !=  $_hook_s" >&2
    echo "  The two are BYTE-identical by design — setup.d/55-runtime-bridge-vendor.sh delivers the" >&2
    echo "  vendored one to a consumer's .claude/hooks/, so a drift ships different behaviour there." >&2
    echo "  Fix: settle the change on $_hook_s, then  cp $_hook_s $_hook_v" >&2
  fi
fi

if [ "$rc" -ne 0 ] && [ "$MODE" = "--check" ]; then
  echo "" >&2
  echo "format-shipped: shipped artifacts are not Prettier-clean (run: npm run format)." >&2
  echo "  These files ship to consumers; a dirty source makes their first 'npm run validate' red." >&2
fi
exit "$rc"
