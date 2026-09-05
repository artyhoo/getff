#!/usr/bin/env bash
# setup.d/lib.sh — Helper SSOT for the install.sh dispatcher.
#
# Extracted byte-faithfully from install.sh (S0 lib rows L38-512).
# Sourced by install.sh BEFORE the INSTALL_SH_LIB_ONLY guard so that
# `INSTALL_SH_LIB_ONLY=1 source install.sh` exposes ALL helpers.
#
# O1 fix: the INSTALL_SH_LIB_ONLY guard is at the END of this file (after all
# helpers are defined), so `INSTALL_SH_LIB_ONLY=1 source setup.d/lib.sh`
# also exposes all helpers (used by tests/install-sh/lib-helpers.test.sh).
#
# Public API (all helpers are in dispatcher scope after sourcing):
#   transform_internal_refs <file>
#   copy_safe <src> <dst>
#   refresh_safe <src> <dst>
#   refresh_baseline_stage <dst>            # consumer-refresh-integrity R1 — record a delivery
#   refresh_baseline_flush                  # R1 — write .ai-factory/refresh-baseline.json (fail-open)
#   refresh_baseline_diverged <dst> <src>   # R1 — 0 iff dst diverged from the baseline (if-guard only)
#   deliver_getff_workflow <tpl-src> <dst>      # getff-honest-signals S4 — branch substitution
#   merge_prettierignore <src> <dst>
#   _prettierignore_in_skipped <needle>
#   ignore_shipped_configs
#   mkdir_safe <dir>
#   chmod_safe <mode> <file...>
#   detect_pm
#   _detect_stack_from_pkg
#   _workspace_pkg_dirs
#   _detect_stacks_per_workspace
#   _resolve_workspace_stacks
#   patch_stryker_package_manager
#   copy_skill_with_transform <slug>
#   refresh_skill_with_transform <slug>
#   generate_eslint_barrel
#
# Globals required from dispatcher scope (set before sourcing layers):
#   PKG_ROOT, PROJECT_ROOT, FORCE, DRY_RUN, SKIPPED, UPSTREAM_BLOB_URL
#
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone
# S0 rows: L38-512, O1, O2
# @dual-pair: install-lib-helpers

# ── Constants (used by helpers below) ────────────────────────────────────────

# Repo-internal cross-refs (paths to docs/, packages/, README.md) get rewritten to
# GitHub blob URLs at install time. One source of truth: .claude/skills/<skill>/SKILL.md
# Override via env var if forking to a different repo.
UPSTREAM_BLOB_URL="${UPSTREAM_BLOB_URL:-https://github.com/artyhoo/getff/blob/main}"

# ── Skill-slug tier sets — SSOT for the install arm AND the refresh arm (#1312) ──────────────
# The `.claude/skills/` payload splits by install depth (F7 split, widened S5 2026-08-01):
#   CORE     — always shipped, consumer-facing, no aif-handoff runtime assumed.
#   ENV      — env+ contour surface (PROFILE=env|factory, or the legacy --with-aif-suite escape).
#   FACTORY  — AIF operator suite (PROFILE=factory or --with-aif-suite); presupposes the runtime.
# Both consumers read these constants: setup.d/10-skills.sh (install) and install.sh do_refresh
# (refresh). They used to hard-code a copy each and drifted three times — #1312 measured `arch`
# absent from every refresh loop, `rule-tests` announced-then-skipped, and
# `claude-glm-executor-handoff` present on the install arm only. One list per tier makes that
# class unrepresentable; tests/install-sh/refresh-covers-full-delivery.test.sh asserts both arms
# still READ them (and that no literal-slug loop reintroduces a third copy).
# Per-tier rationale (which skill sits at which depth, and why) stays in setup.d/10-skills.sh.
GETFF_SKILLS_CORE="template-audit ai-doc rule-research rule-tests"
GETFF_SKILLS_ENV="arch night-mode orchestrator pipeline reviewer"
GETFF_SKILLS_FACTORY="dispatcher aif-doctor harvest story claude-glm-executor-handoff"

PRETTIERIGNORE_BEGIN='# >>> rules-as-tests-aif (managed) >>>'
PRETTIERIGNORE_END='# <<< rules-as-tests-aif (managed) <<<'
PRETTIERIGNORE_CFG_BEGIN='# >>> rules-as-tests-aif shipped-configs (managed) >>>'
PRETTIERIGNORE_CFG_END='# <<< rules-as-tests-aif shipped-configs (managed) <<<'

# Consumer root AGENTS.md is CO-OWNED (spec C1 (b)): ai-factory generates and auto-updates it
# on consumer machines, so our contribution is a fenced section, never the whole file. These
# four constants are the SSOT for both delivery paths (setup.d/30-templates.sh npm lane +
# setup.d/45-python.sh python lane) — install_agents_md() below is the only caller, so the two
# lanes cannot drift (dual-implementation-discipline.md §7).
AGENTS_FENCE_SECTION='getff-framework'
AGENTS_FENCE_PLAN='packages/core/templates/shared/AGENTS.md.template'
# Case-(c) adopt sentinels — BOTH must match before an existing unfenced file is rewritten.
# Verified present in all 20 historical revisions of AGENTS.md.template (2026-08-08).
AGENTS_FENCE_SENTINEL_1='# AGENTS.md — context for AI coding agents'
AGENTS_FENCE_SENTINEL_2='.ai-factory/RULES.md'

# ── Helpers ───────────────────────────────────────────────────────────────────

# transform_internal_refs <markdown-file>
# Rewrites markdown links `](../../../{docs,packages}/...)`, `](../../../README.md...)`,
# and `.claude/rules/` refs (both the skill shape `](../../rules/...)` and the agent shape
# `](../.claude/rules/...)`) in-place to `](${UPSTREAM_BLOB_URL}/...)`. `.claude/rules/` is
# NOT shipped to consumers, so relative rules/ links dangle post-install — on the consumer's
# FIRST push, pre-push §8 (`lychee --offline` over changed *.md) went red on ~87 such links
# (flat-install smoke 2026-07-10). Leaves genuinely consumer-resolvable refs intact
# (e.g. `](../../hooks/...)` — tests/install-sh/transform-internal-refs.test.sh #5).
#
# S2 (2026-07-25) added `agents/`, `tests/`, and `.claude/orchestrator-prompts/` arms:
#   - agents/ refs from skill files land at the WRONG path on a consumer
#     (`<consumer>/agents/` vs shipped `.claude/agents/`); tests/ never ships.
#   - .claude/orchestrator-prompts/ is NEVER delivered to consumers — the only install
#     action is `mkdir_safe "$PROJECT_ROOT/.ai-factory/orchestrator-prompts"` at
#     setup.d/30-templates.sh:17 (note: `.ai-factory/`, not `.claude/`). A skill file
#     carrying ](../../orchestrator-prompts/aif-doctor-skill/kickoff.md) resolves to
#     `<consumer>/.claude/orchestrator-prompts/...` post-install — a path that does not
#     exist. Observed leaking from .claude/skills/aif-doctor/SKILL.md:26.
# scripts/ is INTENTIONALLY UNHANDLED — partially shipped (subset via 40-configs.sh),
# per-file ambiguity is a §4 park trigger (kickoff getff-honest-signals-s2). Extend only with a
# shipped-scripts allowlist if a future scripts/ ref to a non-shipped script re-breaks a push.
#
# 2026-07-25 added the agent-shape `.claude/skills/` arm: agents/*.md live at repo root, so
# in-repo they reach skills via ](../.claude/skills/...); shipped to `<consumer>/.claude/agents/`
# that same ref resolves to `<consumer>/.claude/.claude/skills/...` — a doubled segment that
# does not exist (lychee-shipped-md-offline RED on agents/fidelity-auditor.md:22 → dispatcher).
# Blob URL, not a relative rewrite: the target skill may be absent (aif-suite–gated) — same
# verdict as the agents/ arm above.
# 2026-08-17 — six arms added after the lychee gate's population was widened from core to
# factory depth (tests/install-sh/lychee-shipped-md-offline.test.sh). Every one of these had
# been shipping dangling for as long as env/factory depth existed; none was reachable by the
# core-depth fixture, so all six were invisible. Measured at factory depth: 17 broken links.
#   - `CLAUDE.md` (10 of the 17 — the single biggest offender): the peer `README.md` arm above
#     has existed since the original fix, but CLAUDE.md was never added even though it is just
#     as absent from a consumer (install ships AGENTS.md, never CLAUDE.md — verified on the
#     fixture). Sources: arch ×7, dispatcher, pipeline, pipeline/references/mode-overrides.
#   - `.claude/orchestrator-prompts/` — the `.claude/`-PREFIXED shape. The 2026-07-25 arm below
#     only matches the bare `](../../orchestrator-prompts/` shape, so a ref written as
#     `](../../../.claude/orchestrator-prompts/…)` slipped past it untouched (vendor README:4).
#   - `.github/` — never shipped except `.github/workflows/` (verified: the factory fixture has
#     workflows/ only, no pull_request_template.md). Source: pipeline/SKILL.md:366.
# The last three are DELIBERATELY per-file, not blanket arms, because their parent directories
# are PARTIALLY shipped — a blanket arm would rewrite genuinely consumer-resolvable refs into
# blob URLs and lose in-repo navigability:
#   - `scripts/run-local-ci-sweep.sh` — this is the "shipped-scripts allowlist" the §park note
#     above anticipated ("Extend only with a shipped-scripts allowlist if a future scripts/ ref
#     to a non-shipped script re-breaks a push"). It re-broke the push; scripts/ IS partially
#     shipped, so only the proven-absent file is rewritten. Source: harvest/SKILL.md:18,20.
#   - `hooks/check-worker-dispatch-channel.sh` — `.claude/hooks/` IS shipped and most hook refs
#     resolve fine (transform-internal-refs.test.sh #5 asserts `](../../hooks/…)` stays intact),
#     so only this one absent hook is rewritten. Source: pipeline/SKILL.md:388.
# A fourth candidate was REJECTED rather than allowlisted: `](../reviewer/SKILL.md)` from
# arch/SKILL.md:94 also dangled, but rewriting it would have papered over the real defect. The
# sibling-skill shape is supposed to stay relative — «sibling-skill links stay relative (sibling
# ships too)», 10-skills.sh:107 — so a dangling sibling ref means the SIBLING IS MISSING, not
# that the ref is wrong. `reviewer` was in no tier list while arch (env tier) promised consumers
# that `/reviewer` loads it; the fix was to ship it at env, not to bend the link.
# Recurrence is now caught mechanically, not by review attention: the widened factory-depth
# fixture covers every shipped *.md, so the next unshipped-target ref fails the gate.
# Uses `-i.bak` for BSD-sed/GNU-sed portability, then removes the backup.
transform_internal_refs() {
  local f="$1"
  [ -f "$f" ] || return 0
  sed -E -i.bak \
    -e "s#\]\((\.\./)+docs/#](${UPSTREAM_BLOB_URL}/docs/#g" \
    -e "s#\]\((\.\./)+packages/#](${UPSTREAM_BLOB_URL}/packages/#g" \
    -e "s#\]\((\.\./)+README\.md#](${UPSTREAM_BLOB_URL}/README.md#g" \
    -e "s#\]\((\.\./)+CLAUDE\.md#](${UPSTREAM_BLOB_URL}/CLAUDE.md#g" \
    -e "s#\]\((\.\./)+\.claude/rules/#](${UPSTREAM_BLOB_URL}/.claude/rules/#g" \
    -e "s#\]\((\.\./)+\.claude/skills/#](${UPSTREAM_BLOB_URL}/.claude/skills/#g" \
    -e "s#\]\((\.\./)+\.claude/orchestrator-prompts/#](${UPSTREAM_BLOB_URL}/.claude/orchestrator-prompts/#g" \
    -e "s#\]\((\.\./)+rules/#](${UPSTREAM_BLOB_URL}/.claude/rules/#g" \
    -e "s|\]\((\.\./)+install\.sh([#)])|](${UPSTREAM_BLOB_URL}/install.sh\2|g" \
    -e "s#\]\((\.\./)+agents/#](${UPSTREAM_BLOB_URL}/agents/#g" \
    -e "s#\]\((\.\./)+tests/#](${UPSTREAM_BLOB_URL}/tests/#g" \
    -e "s#\]\((\.\./)+orchestrator-prompts/#](${UPSTREAM_BLOB_URL}/.claude/orchestrator-prompts/#g" \
    -e "s#\]\((\.\./)+\.github/#](${UPSTREAM_BLOB_URL}/.github/#g" \
    -e "s#\]\((\.\./)+scripts/run-local-ci-sweep\.sh#](${UPSTREAM_BLOB_URL}/scripts/run-local-ci-sweep.sh#g" \
    -e "s#\]\((\.\./)+hooks/check-worker-dispatch-channel\.sh#](${UPSTREAM_BLOB_URL}/.claude/hooks/check-worker-dispatch-channel.sh#g" \
    "$f"
  rm -f "${f}.bak"
}

# _transform_md_tree <tree-root>
# Rewrite repo-internal relative refs to upstream blob URLs in EVERY *.md under <tree-root>.
# transform_internal_refs is idempotent, so re-running this over an already-delivered tree is
# safe — that is what makes the same helper usable on both the install and the refresh path.
#
# The walk is NUL-delimited ON PURPOSE (ledger S-7): the copy this replaced used
# `find … -type f | read -r`, which silently skips any delivered path containing a newline, and
# it was the ONLY one of the seven copies that had diverged that way.
_transform_md_tree() {
  local _md
  while IFS= read -r -d '' _md; do
    transform_internal_refs "$_md"
  done < <(find "$1" -name '*.md' -type f -print0 2>/dev/null)
}

# _copy_tree_with_transform <src-dir> <dst-dir>
# SSOT for "wipe the destination, recopy the tree, rewrite shipped markdown refs" — the sequence
# that had been inlined SEVEN times (ledger S-7: setup.d/lib.sh ×3, setup.d/10-skills.sh ×2,
# setup.d/45-python.sh, install.sh) and had therefore already drifted. Wipe-and-recopy rather
# than merge is the deliberate skills/* idempotent pattern (10-skills.sh) and the twin of
# refresh_safe's #873 directory arm: `cp -r src dst` onto an existing dst NESTS instead of
# replacing. The transform pass is what keeps repo-internal relative refs from shipping dangling
# (see transform_internal_refs above; the 2026-08-17 CI incident, run 32022158836, was exactly a
# delivered README landing back at its untransformed source).
#
# NOT a delivery verb: it applies no ownership policy at all — no skip-if-exists, no `.override.md`
# escape, no R1 divergence guard. Callers that owe the consumer an ownership decision go through
# copy_safe / refresh_safe / refresh_tree_with_transform; this helper is only the raw sequence
# those verbs and the fresh-install layers share. Handing it a destination the consumer may own
# is the ledger A1-1 defect (see refresh_tree_with_transform below).
_copy_tree_with_transform() {
  local src="$1" dst="$2"
  [ -d "$src" ] || return 0
  rm -rf "$dst"
  mkdir -p "$(dirname "$dst")"
  cp -r "$src" "$dst"
  _transform_md_tree "$dst"
}

# refresh_tree_with_transform <src-dir> <dst-dir>
# refresh_safe for a DIRECTORY payload PLUS the shipped-markdown transform, as ONE verb.
#
# Ledger A1-1: do_refresh used to deliver .claude/vendor/runtime-bridge TWICE — first through
# refresh_safe (which honours the Layer-3 `.override.md` escape and the R1 divergence guard, and
# printed "⊝ … keeping"), then again through a policy-free `rm -rf`/`cp -r` arm for the same
# destination. A consumer who had claimed the tree saw "keeping" printed and their edits plus
# every consumer-only file under it deleted anyway, while the closing banner still promised that
# override files were preserved; `--dry-run` skipped only the second arm, so the preview showed
# a skip the real run did not honour. The second arm existed because refresh_safe alone does not
# transform. One verb removes that reason: the transform can no longer justify an unguarded
# second delivery of a destination the consumer may own.
#
# The transform runs only when this refresh actually WROTE: under `--dry-run` and under a
# Layer-3 override nothing was written, and rewriting refs inside a consumer-owned tree would be
# the same defect class in reverse.
refresh_tree_with_transform() {
  local src="$1" dst="$2"
  [ -d "$src" ] || return 0
  refresh_safe "$src" "$dst"
  if [ "$DRY_RUN" = "--dry-run" ]; then return 0; fi
  if [ -e "${dst%.md}.override.md" ]; then return 0; fi
  _transform_md_tree "$dst"
}

# ── consumer-refresh-integrity R1 — refresh-baseline manifest + divergence guard ──────────────
# Issue 1481 (casualties 1+3): --refresh overwrote consumer-modified files silently. A consumer
# has no upstream git history to diff against, so "previous upstream content" is recorded by the
# framework itself at delivery time (kickoff RI-2): every copy_safe/refresh_safe delivery stages
# its dst here, and the installer flushes the staged paths into
# $PROJECT_ROOT/.ai-factory/refresh-baseline.json (sha256 per delivered dst path, keys sorted,
# no timestamps — deterministic bytes, because the snapshot harness fingerprints this file).
#
# Guard (kickoff RI-1, warn + preserve, NEVER refuse): before a refresh_safe overwrite of a file
# whose sha256(dst) differs from BOTH the manifest entry AND sha256(src) → copy the diverged
# bytes to $PROJECT_ROOT/.ai-factory/refresh-conflicts/<basename>.<sha8> (sha8 = first 8 hex of
# the diverged dst bytes; NEVER a sibling of the live file — no same-name collisions), print a
# loud warning, then refresh anyway. A MISSING manifest entry means unknown → today's behaviour
# exactly: no divergence claim, no first-refresh spam on a pre-manifest consumer (T-CRI-B).
#
# Fail-open discipline (binding): a missing, unparsable or unreadable manifest, a missing jq or
# sha256 tool, an unwritable conflicts dir — each degrades to today's behaviour with a one-line
# note and NEVER fails the install/refresh (precedent: refresh_safe's source-gone → return 0).
#
# Two shape decisions (measured, not accidental):
#   - STAGE PATHS, HASH AT FLUSH. The manifest must record the bytes as SHIPPED, and callers
#     legitimately mutate a dst after copy_safe/refresh_safe returns (transform_internal_refs on
#     agents/skills, patch_stryker_package_manager, rewrite_arch_sot_header, the prettierignore
#     appends). Hashing at stage time would store pre-transform bytes and then flag every
#     transformed file as diverged on every refresh — first-refresh spam by construction.
#     Staging paths and hashing once at end-of-run captures the final on-disk bytes.
#   - PER FILE, INCLUDING INSIDE DIRECTORY PAYLOADS. A directory has no single sha256, so a
#     directory dst stages every regular file under it and the guard runs on those (ledger L-4).
#     The original shape staged nothing for a directory payload, which made «unknown» permanent
#     for every file inside one and left refresh_safe's directory arm free to `rm -rf` a
#     consumer's edits with no warning and no conflicts copy — issue 1481, guaranteed rather
#     than merely possible, for exactly the payloads the guard never covered.
#
# SCOPE: copy_safe/refresh_safe deliveries only. Skills (copy_skill_with_transform /
# refresh_skill_with_transform), merge_fenced and the raw-cp vendor drop have their own verbs
# and stay outside this mechanism (W-RI-1: generic, no special-casing of any pair entry).
REFRESH_BASELINE_STAGED=()
# Paths staged WEAKLY: recorded only if the manifest has no entry for them yet (ledger A1-2).
# copy_safe's skip-if-exists path uses this — a skipped file's bytes are evidence of what was
# delivered ONLY when nothing better is on record. Recording them strongly would let a consumer's
# own edit become the baseline on any plain re-install, which silences the guard for exactly the
# file the consumer cares about.
REFRESH_BASELINE_STAGED_WEAK=()
REFRESH_BASELINE_NOTE_SHOWN=""

# _refresh_baseline_manifest — echo the consumer-local manifest path (never tracked, never a
# template; lives under the consumer's .ai-factory/ only).
_refresh_baseline_manifest() {
  printf '%s\n' "${PROJECT_ROOT:-.}/.ai-factory/refresh-baseline.json"
}

# _refresh_baseline_note <reason> — one-line fail-open note, at most ONCE per run (stderr: the
# read-side helpers run inside $(...) captures and stdout would pollute the captured value).
_refresh_baseline_note() {
  if [ -z "$REFRESH_BASELINE_NOTE_SHOWN" ]; then
    echo "  · refresh-baseline: $1 — divergence guard degraded to today's behaviour" >&2
    REFRESH_BASELINE_NOTE_SHOWN=1
  fi
}

# _hash256 <file> — portable sha256 (sha256sum | shasum -a 256; same ladder as the snapshot
# harness). Echoes the hex digest or fails (caller degrades).
_hash256() {
  local h
  if command -v sha256sum >/dev/null 2>&1; then
    h=$(sha256sum "$1" 2>/dev/null | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    h=$(shasum -a 256 "$1" 2>/dev/null | awk '{print $1}')
  else
    return 1
  fi
  [ -n "$h" ] || return 1
  printf '%s\n' "$h"
}

# refresh_baseline_stage <dst> — record a delivered dst for the end-of-run flush. Paths only
# (hashed at flush — see the section header); no-op under --dry-run.
#
# A DIRECTORY dst stages every file under it (ledger L-4). The original shape recorded regular
# files only, which is what left every directory payload — the fences-fire fixtures, the
# runtime-bridge vendor tree — outside the baseline entirely: with no manifest entry the
# divergence guard reads «unknown» for every file inside them, so a consumer edit could never be
# flagged, preserved, or previewed. Staging per file is what makes the guard reach the class,
# and it is the install path (copy_safe) that has to do it, or the guard is a whole refresh cycle
# late — the consumer's first `--refresh` after the edit is exactly the run that destroys it.
refresh_baseline_stage() {
  local p="$1" f
  if [ "${DRY_RUN:-}" = "--dry-run" ]; then return 0; fi
  if [ -f "$p" ]; then
    REFRESH_BASELINE_STAGED+=("$p")
  elif [ -d "$p" ]; then
    while IFS= read -r -d '' f; do
      REFRESH_BASELINE_STAGED+=("$f")
    done < <(find "$p" -type f -print0 2>/dev/null)
  fi
  return 0
}

# refresh_baseline_stage_weak <dst> — record a dst that this run did NOT write but found already
# in place (copy_safe's skip path). Same path-only, hash-at-flush contract; the flush lets any
# existing manifest entry win over these (ledger A1-2 — see REFRESH_BASELINE_STAGED_WEAK above).
refresh_baseline_stage_weak() {
  local p="$1" f
  if [ "${DRY_RUN:-}" = "--dry-run" ]; then return 0; fi
  if [ -f "$p" ]; then
    REFRESH_BASELINE_STAGED_WEAK+=("$p")
  elif [ -d "$p" ]; then
    while IFS= read -r -d '' f; do
      REFRESH_BASELINE_STAGED_WEAK+=("$f")
    done < <(find "$p" -type f -print0 2>/dev/null)
  fi
  return 0
}

# refresh_baseline_diverged <dst> <src> — exit 0 IFF <dst> is a consumer-diverged file:
# sha256(dst) ≠ manifest entry AND ≠ sha256(src), with a manifest entry present. Everything
# else — no entry (unknown), dst absent, directory dst, jq/sha tooling missing, unreadable
# manifest — exits 1 (not diverged). Call ONLY inside an `if` (its non-zero is a verdict, and
# refresh_safe runs under set -euo pipefail). The manifest read is INLINED at this parent
# scope — not via $(... _refresh_baseline_lookup ...) — so the degrade note's once-flag
# persists across this function's many calls (a subshell capture would re-note per file).
# _refresh_baseline_lookup <dst> — set REFRESH_BASELINE_ENTRY to the manifest hash recorded for
# <dst> ("" = no entry, i.e. UNKNOWN, i.e. not attributable to the framework). Sets a GLOBAL
# rather than echoing on purpose: a $(...) capture runs in a subshell and would lose
# _refresh_baseline_note's once-per-run flag, re-noting a missing jq for every file walked.
REFRESH_BASELINE_ENTRY=""
_refresh_baseline_lookup() {
  local dst="$1" manifest
  REFRESH_BASELINE_ENTRY=""
  command -v jq >/dev/null 2>&1 || { _refresh_baseline_note "jq not found"; return 0; }
  manifest=$(_refresh_baseline_manifest)
  [ -f "$manifest" ] || return 0
  if ! REFRESH_BASELINE_ENTRY=$(jq -r --arg k "${dst#"${PROJECT_ROOT:-}"/}" 'if (type == "object") and has($k) then .[$k] else "" end' "$manifest" 2>/dev/null); then
    _refresh_baseline_note "manifest at $manifest is unreadable or not JSON"
    REFRESH_BASELINE_ENTRY=""
  fi
  return 0
}

refresh_baseline_diverged() {
  local dst="$1" src="$2" entry cur src_hash
  [ -f "$dst" ] || return 1
  _refresh_baseline_lookup "$dst"
  entry="$REFRESH_BASELINE_ENTRY"
  [ -n "$entry" ] || return 1
  cur=$(_hash256 "$dst") || { _refresh_baseline_note "no sha256 tool found"; return 1; }
  if [ "$cur" = "$entry" ]; then return 1; fi
  src_hash=$(_hash256 "$src") || return 1
  if [ "$cur" = "$src_hash" ]; then return 1; fi
  return 0
}

# _preserve_diverged_copy <dst> — copy the diverged bytes aside + print the loud warning.
# Warn + preserve, never refuse: even a FAILED preserve only changes the warning text; the
# refresh itself proceeds (RI-1).
_preserve_diverged_copy() {
  local dst="$1" conflicts sum8 preserved
  conflicts="${PROJECT_ROOT:-.}/.ai-factory/refresh-conflicts"
  if sum8=$(_hash256 "$dst"); then
    preserved="$conflicts/$(basename "$dst").${sum8:0:8}"
    if mkdir -p "$conflicts" 2>/dev/null && cp "$dst" "$preserved" 2>/dev/null; then
      echo "  ⚠ overwriting locally-modified file: $dst (consumer copy preserved at $preserved)"
      return 0
    fi
  fi
  echo "  ⚠ overwriting locally-modified file: $dst (could not preserve a copy under $conflicts — refreshing anyway)"
  return 0
}

# refresh_baseline_flush — write the staged deliveries into the manifest (merge, sorted keys —
# deterministic bytes). Called ONCE at each installer exit path AFTER every delivery + transform
# has run. Fail-open on every branch: a failed flush is a note, never a failed install.
# _refresh_baseline_hash_into <tsv-path> <path>... — hash each existing regular file and write
# `<rel-path>\t<sha256>` rows into <tsv-path>. Shared by the strong and weak passes.
_refresh_baseline_hash_into() {
  local out="$1" p h
  shift
  [ "$#" -gt 0 ] || return 0
  printf '%s\n' "$@" | LC_ALL=C sort -u \
    | while IFS= read -r p; do
        if [ -f "$p" ] && h=$(_hash256 "$p"); then
          printf '%s\t%s\n' "${p#"${PROJECT_ROOT:-}"/}" "$h"
        fi
      done >> "$out"
  return 0
}

refresh_baseline_flush() {
  local manifest tsv wtsv p h prev patch weak
  if [ "${DRY_RUN:-}" = "--dry-run" ]; then return 0; fi
  if [ "${#REFRESH_BASELINE_STAGED[@]}" -eq 0 ] && [ "${#REFRESH_BASELINE_STAGED_WEAK[@]}" -eq 0 ]; then
    return 0
  fi
  command -v jq >/dev/null 2>&1 || { _refresh_baseline_note "jq not found — manifest not written"; return 0; }
  manifest=$(_refresh_baseline_manifest)
  tsv=$(mktemp) || { _refresh_baseline_note "mktemp failed — manifest not written"; return 0; }
  wtsv=$(mktemp) || { rm -f "$tsv"; _refresh_baseline_note "mktemp failed — manifest not written"; return 0; }
  _refresh_baseline_hash_into "$tsv"  ${REFRESH_BASELINE_STAGED[@]+"${REFRESH_BASELINE_STAGED[@]}"}
  _refresh_baseline_hash_into "$wtsv" ${REFRESH_BASELINE_STAGED_WEAK[@]+"${REFRESH_BASELINE_STAGED_WEAK[@]}"}
  # Once flushed, the staging lists are EMPTY: install.sh flushes both explicitly and from an
  # EXIT trap (ledger A1-2), and a second flush must be a no-op rather than a second write.
  REFRESH_BASELINE_STAGED=()
  REFRESH_BASELINE_STAGED_WEAK=()
  if [ -s "$tsv" ] || [ -s "$wtsv" ]; then
    weak='{}'
    if [ -s "$wtsv" ]; then
      weak=$(jq -Rn 'reduce (inputs | split("\t")) as $row ({}; .[$row[0]] = $row[1])' "$wtsv" 2>/dev/null) || weak='{}'
    fi
    if patch=$(jq -Rn 'reduce (inputs | split("\t")) as $row ({}; .[$row[0]] = $row[1])' "$tsv" 2>/dev/null); then
      prev='{}'
      if [ -f "$manifest" ]; then
        # Merge into the existing baseline (a refresh that skips an arm must not forget what the
        # install delivered). A corrupt/unreadable existing manifest is REPLACED fresh — healing
        # it — with a note; that is still fail-open for this run's guard (it read as empty).
        if prev=$(cat "$manifest" 2>/dev/null); then
          printf '%s' "$prev" | jq -e 'type == "object"' >/dev/null 2>&1 || { _refresh_baseline_note "existing manifest not JSON — replacing it fresh"; prev='{}'; }
        else
          _refresh_baseline_note "existing manifest unreadable — replacing it fresh"
          prev='{}'
        fi
      fi
      if mkdir -p "$(dirname "$manifest")" 2>/dev/null; then
        # Precedence weak < prev < patch: a skipped file fills a HOLE in the manifest and never
        # overwrites what a real delivery recorded (ledger A1-2 — `$weak + $prev` lets prev win,
        # `* $patch` lets this run's actual writes win over both).
        if jq -S -n --argjson weak "$weak" --argjson prev "$prev" --argjson patch "$patch" '($weak + $prev) * $patch' > "${manifest}.getff.tmp" 2>/dev/null; then
          mv "${manifest}.getff.tmp" "$manifest"
          echo "  ✓ .ai-factory/refresh-baseline.json recorded ($(wc -l < "$tsv" | tr -d ' ') delivered files hashed)"
        else
          rm -f "${manifest}.getff.tmp"
          _refresh_baseline_note "manifest write failed"
        fi
      else
        _refresh_baseline_note "cannot create $(dirname "$manifest")"
      fi
    else
      _refresh_baseline_note "manifest patch build failed"
    fi
  fi
  rm -f "$tsv" "$wtsv"
  return 0
}

copy_safe() {
  local src="$1"
  local dst="$2"

  if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
    SKIPPED+=("$dst")
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: $dst (exists)"
    else
      echo "  ⊝ $dst (exists — skipping; use --force to overwrite)"
      # A1-2: this early return used to precede the staging call, so an install whose deliveries
      # were all skips staged NOTHING — and after any install that never reached its flush (the
      # 99-finalize `exit 1` on a deps-incomplete --full), no later re-run could ever rebuild the
      # manifest. Staged WEAKLY: fills a hole, never overwrites an entry a real delivery made,
      # so a consumer edit sitting on disk at re-install time cannot become its own baseline.
      refresh_baseline_stage_weak "$dst"
    fi
    return 0
  fi

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would copy: $src → $dst"
    return 0
  fi

  mkdir -p "$(dirname "$dst")"
  # A2-1 (twin of #873 in refresh_safe): REPLACE directory payloads instead of nesting into them.
  # This line is reachable only on the write path — dst absent (rm is a no-op) or FORCE=--force,
  # where a bare `cp -r src dst` onto an EXISTING dir creates dst/$(basename src) rather than
  # replacing dst's contents. Live blast radius: `install.sh python --force` nested
  # .getff/astgrep-rules/astgrep-rules/, and ast-grep — which walks ruleDirs recursively — then
  # aborted every scan with `Duplicate rule id … is found` (exit 8), killing the CI gate, the
  # .getff/hooks/pre-push rung and _py_firing_self_check at once. File payloads are untouched:
  # `cp -r` over an existing file overwrites it correctly.
  [ -d "$src" ] && rm -rf "$dst"
  cp -r "$src" "$dst"
  echo "  ✓ $dst"
  refresh_baseline_stage "$dst"   # R1: record the delivery for the baseline flush
}

# merge_fenced <src> <dst> <section-id> [plan-path] [sentinel-1] [sentinel-2]
#
# Section-scoped co-ownership for a destination file that OTHER generators also write
# (spec C1 addition (b), beta-ai-docs-agnosticism S1 §2 D1b). The canonical case is the
# consumer's root AGENTS.md: ai-factory generates and auto-updates it, so `copy_safe`'s
# skip-if-exists means our contribution lands NOWHERE on any consumer that already has one,
# while `--force` would clobber the other writer. This helper writes ONLY our fenced block:
#
#   <!-- getff:begin section=<id> plan=<path> -->  … ours …  <!-- getff:end section=<id> -->
#
# Everything outside the markers is the other writer's and is preserved byte-for-byte.
# Marker grammar mirrors packages/core/composition/fence.ts (beginMarker/endMarker/findRegions)
# — same `getff:begin section=<id> plan=<path>` shape, so the TS fence tooling can parse what
# this bash writer emits. Replicated, NOT imported: install.sh must run with zero Node.
#
# `copy_safe` is deliberately UNCHANGED (S1 §2 D1b binding constraint): it has ~142 call sites
# across 14 files, none of which asked for merge behaviour. This is an additive helper.
#
# FOUR cases (all three S1 §4 item-4 acceptance cases plus the fresh-install path):
#   (0) dst absent            → create; the whole file is our fenced section.
#   (a) dst has FOREIGN text  → append our fenced block; foreign content survives.
#   (b) dst already fenced    → replace the body BETWEEN the markers, in place. Idempotent:
#                               a second run is byte-identical, never a duplicated section.
#                               The existing begin marker line is kept VERBATIM (forward-compat
#                               attributes an older/newer writer put on it survive) — same rule
#                               as fence.ts injectRegion.
#   (c) dst is a FENCE-LESS copy of an older version of our own template → adopt it exactly
#                               once by REPLACING the whole file with the fenced form. This is
#                               every consumer installed before this stage; a fence-writer that
#                               only knew case (a) would append and silently DOUBLE their file.
#
# Case (c) detection is deliberately conservative — a false-positive adopt would destroy a
# consumer's own file. TWO independent sentinels must BOTH be present, and both were verified
# present in all 20 historical revisions of AGENTS.md.template (git log --follow, 2026-08-08):
#   1. the template's H1 line, and 2. the `.ai-factory/RULES.md` convention reference.
# Sentinels are caller-supplied (args 5/6) so the helper stays generic; with no sentinels
# passed, case (c) never fires and an unrecognised file takes the safe (a) path.
#
# `--force` semantics for a co-owned file (S1 §2 D1b — stated, not left undefined): --force
# replaces OUR fenced section ONLY, never the whole file. Mechanically that is what this helper
# already does on every run, so FORCE is a deliberate NO-OP here. Rationale: the file is
# co-owned by construction; there is no consumer intent under which "overwrite" should mean
# "delete the other writer's content".
#
# Layer-3 escape hatch honoured (same signal as refresh_safe): a sibling <base>.override.md
# means the consumer has taken ownership — skip entirely, write nothing.
#
# The body is written with a blank line on each side of the markers, and every write path does it
# identically so the replace path is byte-equal to the create path. Without it Prettier reports the
# consumer's AGENTS.md as unformatted (an HTML comment immediately followed by a heading), and the
# consumer's very first `npm run validate` goes red on a file we wrote — the #531 failure class.
#
# Malformed fence (a begin marker with no matching end) → LOUD refuse + skip, never a guess.
# Splicing against a missing end marker would delete everything from the marker to EOF; the
# irreversible branch is never the default (T-Upgrade-A).
merge_fenced() {
  local src="$1"
  local dst="$2"
  local section="$3"
  local plan="${4:-}"
  local sentinel_1="${5:-}"
  local sentinel_2="${6:-}"

  local override="${dst%.md}.override.md"
  local begin="<!-- getff:begin section=${section}"
  local end_tok="<!-- getff:end section=${section} -->"
  local begin_full="${begin} plan=${plan} -->"
  [ -n "$plan" ] || begin_full="${begin} -->"

  [ -f "$src" ] || return 0

  if [ -e "$override" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: $dst (.override.md present — consumer-owned Layer 3)"
    else
      echo "  ⊝ $dst (.override.md — consumer-owned, keeping)"
    fi
    return 0
  fi

  # ── (0) fresh install ──────────────────────────────────────────────────────
  if [ ! -e "$dst" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would create: $dst (fenced section=$section)"
      return 0
    fi
    mkdir -p "$(dirname "$dst")"
    { echo "$begin_full"; echo ""; cat "$src"; echo ""; echo "$end_tok"; } > "$dst"
    echo "  ✓ $dst (fenced section=$section)"
    return 0
  fi

  # ── (b) our fence already present → replace body in place ──────────────────
  if grep -qF "$begin" "$dst"; then
    if ! grep -qF "$end_tok" "$dst"; then
      echo "  ⚠ $dst: '$begin' present but no matching '$end_tok' — REFUSING to splice" >&2
      echo "    (an unterminated fence would delete everything to EOF; fix the marker pair by hand)" >&2
      SKIPPED+=("$dst")
      return 0
    fi
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would replace fenced section=$section in: $dst"
      return 0
    fi
    local tmp="${dst}.getff.tmp"
    awk -v BEG="$begin" -v END_TOK="$end_tok" -v SRC="$src" '
      state == 0 && index($0, BEG) > 0 {
        print                                     # keep the begin marker verbatim
        print ""                                  # blank lines around the body: Prettier treats an
        while ((getline line < SRC) > 0) print line
        close(SRC)
        print ""                                  # HTML comment glued to a heading as unformatted
        state = 1
        next
      }
      state == 1 && index($0, END_TOK) > 0 { print; state = 2; next }
      state == 1 { next }                         # drop the previous body
      { print }
    ' "$dst" > "$tmp" && mv "$tmp" "$dst"
    echo "  ✓ $dst (fenced section=$section replaced)"
    return 0
  fi

  # ── (c) fence-less copy of an older version of our own template → adopt once ─
  if [ -n "$sentinel_1" ] && [ -n "$sentinel_2" ] \
    && grep -qF "$sentinel_1" "$dst" && grep -qF "$sentinel_2" "$dst"; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would adopt (wrap in fence): $dst"
      return 0
    fi
    { echo "$begin_full"; echo ""; cat "$src"; echo ""; echo "$end_tok"; } > "$dst"
    echo "  ✓ $dst (pre-fence getff copy adopted into section=$section)"
    return 0
  fi

  # ── (a) foreign content → append our block, preserve theirs ────────────────
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would append fenced section=$section to: $dst (foreign content preserved)"
    return 0
  fi
  # Guarantee a newline boundary so the marker never glues onto the last foreign line.
  [ -s "$dst" ] && [ "$(tail -c 1 "$dst")" != "" ] && echo "" >> "$dst"
  { echo "$begin_full"; echo ""; cat "$src"; echo ""; echo "$end_tok"; } >> "$dst"
  echo "  ✓ $dst (fenced section=$section appended; existing content preserved)"
}

# install_agents_md <src> <dst>
# The ONLY caller of merge_fenced for the consumer root AGENTS.md. Both delivery lanes
# (30-templates.sh npm, 45-python.sh python) route through here so the section id, plan
# attribute and case-(c) sentinels cannot drift between them.
install_agents_md() {
  merge_fenced "$1" "$2" "$AGENTS_FENCE_SECTION" "$AGENTS_FENCE_PLAN" \
    "$AGENTS_FENCE_SENTINEL_1" "$AGENTS_FENCE_SENTINEL_2"
}

# refresh_safe <src> <dst>
# Inverted copy_safe: OVERWRITES unless the consumer has signalled Layer-3 ownership
# via a sibling <base>.override.md (INSTALL-FOR-AI.md §Three-layer + §override).
# Naming: for foo.md the override is foo.override.md; for foo.sh it is foo.sh.override.md
# (the %.md strip is a no-op on non-.md files, so the pattern is uniform — ${dst%.md}.override.md).
# T-Upgrade-A: default-to-SKIP on any ownership signal — a wrong overwrite is irreversible.
# #873: directory payloads are REPLACED, not nested — mirrors the existing
# refresh_skill_with_transform precedent (rm -rf "$dst"; cp -r). File refresh is unchanged (a
# file source cp -r's over an existing file correctly).
# Optional 3rd argument, `framework-exclusive`: declares that <dst> is a directory NOTHING but
# the framework may own, so the sweep may also remove files it cannot attribute to a delivery.
# Default (omitted) is shared ownership — unattributable files are the consumer's and stay.
# The one declared-exclusive destination today is the python lane's `.getff/astgrep-rules` scan
# dir, and its exclusivity is load-bearing rather than incidental: `_py_join_researched_rules`
# (setup.d/45-python.sh) re-assembles that dir from `.getff/rules-research` on EVERY pass
# precisely because the refresh wipes it, and adapter-jig C4 requires that a dropped rule cannot
# stay silently active there — a stale ast-grep rule is live scan configuration, not inert
# residue. Everywhere else the L-4 default holds.
refresh_safe() {
  local src="$1"
  local dst="$2"
  local exclusive="${3:-}"
  local override="${dst%.md}.override.md"
  [ -e "$src" ] || return 0  # source gone — leave consumer copy alone
  if [ -e "$override" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: $dst (.override.md present — consumer-owned Layer 3)"
    else
      echo "  ⊝ $dst (.override.md — consumer-owned, keeping)"
    fi
    return 0
  fi
  # #873 + ledger L-4: a directory payload is REPLACED, not nested into — but file by file, so
  # every file inside it gets the same ownership decision a file payload gets.
  if [ -d "$src" ]; then
    _refresh_dir_payload "$src" "$dst" "$exclusive"
    return 0
  fi
  _refresh_one_file "$src" "$dst"
}

# _refresh_one_file <src-file> <dst-file>
# The per-file half of refresh_safe: divergence guard, preserve-then-overwrite, stage. Split out
# of refresh_safe (ledger L-4) so the directory arm can route every file it delivers through the
# identical decision instead of through a bare `rm -rf`. The `.override.md` check lives in
# refresh_safe, which the directory arm re-enters per file — so a Layer-3 escape works on a
# single file INSIDE a directory payload exactly as it does on a file payload.
_refresh_one_file() {
  local src="$1" dst="$2"
  # R1 divergence guard (read-only probe): fires identically under --dry-run so the preview
  # reports `would-flag` for exactly the files the real refresh would warn about. The override
  # skip in refresh_safe returns BEFORE this — the Layer-3 escape produces no conflict copy,
  # no warning.
  if [ "$DRY_RUN" = "--dry-run" ]; then
    if refresh_baseline_diverged "$dst" "$src"; then
      echo "  [dry-run] would-flag: $dst (locally modified)"
    fi
    echo "  [dry-run] would refresh: $src → $dst"
    return 0
  fi
  if refresh_baseline_diverged "$dst" "$src"; then
    _preserve_diverged_copy "$dst"
  fi
  mkdir -p "$(dirname "$dst")"
  cp -r "$src" "$dst"
  echo "  ✓ $dst (refreshed)"
  refresh_baseline_stage "$dst"   # R1: record the delivery for the baseline flush
}

# _refresh_dir_payload <src-dir> <dst-dir>
# The directory half of refresh_safe (ledger L-4).
#
# It used to be one line — `rm -rf "$dst"; cp -r "$src" "$dst"` — and the R1 divergence guard
# said so in its own header: «FILES ONLY. Directory payloads … stage nothing and are never
# flagged». That exemption made the issue-1481 casualty (a consumer edit destroyed silently on
# `--refresh`) not merely possible but GUARANTEED for every directory payload — the fences-fire
# fixtures and the runtime-bridge vendor tree — with no refresh-conflicts copy, no warning and
# no `--dry-run` preview, because the guard was bolted onto one code path instead of onto the
# per-file mechanism both paths share.
#
# Two passes:
#   (1) DELIVER — every file the framework ships goes back through refresh_safe at its own path,
#       so it gets the `.override.md` escape, the divergence guard, the preserve copy and the
#       baseline staging that a file payload gets. Writing each destination explicitly is also
#       what keeps #873 closed: nothing ever `cp -r`s a directory onto an existing directory,
#       so nothing can nest.
#   (2) SWEEP — a destination file the source no longer ships is removed ONLY when the
#       refresh-baseline manifest says the framework delivered it AND its bytes still match that
#       entry. Everything else — a consumer-authored file, a file predating the manifest, a
#       framework file the consumer has since edited — is unattributable to us, so it stays.
#       Keeping a file is reversible; deleting one is not (the whole point of issue 1481).
#
# Known cost of (2), accepted deliberately: on a consumer whose baseline predates a file the
# framework has since stopped shipping, that stale file is unattributable and survives
# indefinitely. The alternative — deleting what we cannot prove is ours — is the defect.
#
# A destination whose contents are ENTIRELY the framework's can opt out of (2)'s caution with the
# `framework-exclusive` third argument to refresh_safe; see its docstring for the one such
# destination and why its exclusivity is load-bearing.
#
# Empty source directories are not reproduced (the walk is `-type f`); git tracks no empty
# directories, and neither shipped payload contains one or any symlink (verified 2026-09-05).
_refresh_dir_payload() {
  local src="$1" dst="$2" exclusive="${3:-}" f rel cur kept=0
  while IFS= read -r -d '' f; do
    rel="${f#"$src"/}"
    refresh_safe "$f" "$dst/$rel"
  done < <(find "$src" -type f -print0 2>/dev/null)

  [ -d "$dst" ] || return 0
  while IFS= read -r -d '' f; do
    rel="${f#"$dst"/}"
    [ -e "$src/$rel" ] && continue                    # still shipped — pass (1) handled it
    case "$rel" in *.override.md) continue ;; esac    # a Layer-3 marker is the consumer's own
    if [ "$exclusive" != "framework-exclusive" ]; then
      _refresh_baseline_lookup "$f"
      cur=""
      if [ -n "$REFRESH_BASELINE_ENTRY" ]; then cur=$(_hash256 "$f") || cur=""; fi
      if [ -z "$REFRESH_BASELINE_ENTRY" ] || [ "$cur" != "$REFRESH_BASELINE_ENTRY" ]; then
        kept=$((kept+1))
        continue
      fi
    fi
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would remove: $f (framework-delivered, no longer shipped)"
      continue
    fi
    rm -f "$f"
    echo "  ✓ $f (removed — no longer shipped)"
  done < <(find "$dst" -type f -print0 2>/dev/null)

  if [ "$kept" -gt 0 ]; then
    echo "  · $dst: $kept file(s) kept (not framework-delivered — consumer-owned)"
  fi
  return 0
}

# deliver_getff_workflow <tpl-src> <dst>
# Delivers a getff CI workflow template (.github/workflows/getff-{python,cargo,go}.yml),
# substituting the consumer's actual default branch for the template's hard-coded `main`
# at install time. Closes the getff-honest-signals S4 defect class — a consumer whose
# default branch is `master` (or anything else) gets a workflow that actually triggers,
# not one that installs and silently never runs.
#
# Three detection branches:
#  1. Detection succeeds AND branch ≠ main → stream-substitute `branches: [main]` (×2:
#     push + pull_request) and `refs/heads/main` (×1: cancel-in-progress) into a temp,
#     then delegate the write to copy_safe/refresh_safe with the temp as the source.
#  2. Detection succeeds AND branch == main → byte-identical copy (no substitution; the
#     template is already correct for this consumer).
#  3. Detection fails (no remote / not a git repo / origin/HEAD unset) → PARK case
#     (getff-honest-signals-s4 kickoff §5). Recommended resolution A: loud stderr warning
#     + byte-identical to template. This is the architecturally-forced default — the
#     snapshot fingerprint invariant requires byte-identical no-remote bytes (mktemp-d
#     fixtures in tests/install-sh/snapshot.sh have no `origin` remote; Options B/C
#     would perturb the 13/0 baseline). Maintainer may flip to B (refuse) or C (env var
#     override) in review; the LOUD stderr warning surfaces the choice to the consumer
#     at install time (NOT a silent fallback — silent fallback IS the defect this stage
#     removes). [handoff:park:S4-no-remote — Option A implemented; review-flippable.]
#
# Detection mechanism: `git symbolic-ref refs/remotes/origin/HEAD` — the canonical
# git-native default-branch signal (set by `git remote set-head` or auto-set on clone).
# Zero new deps, no API calls (REUSE per build-first-reuse-default.md §1.1 own-stack-first).
#
# Delegate semantics: the helper routes its write through copy_safe (fresh path) or
# refresh_safe (refresh path, gated on GETFF_TOOLCHAIN_REFRESH=1), preserving every
# existing guarantee — skip-if-exists default, FORCE override, `.override.md` Layer-3
# consumer-ownership escape hatch, DRY_RUN, mkdir -p the parent. The caller has already
# filtered to one of the two paths via its outer if/else (REFUSE-LOUDLY for non-getff
# files at our namespaced destination fires BEFORE this helper runs).
#
# BSD/GNU-sed portable: writes to a temp file (no `-i`); uses `#` delimiter to avoid
# conflict with `/` in branch names (git ref-name charset excludes `#` so the delimiter
# is safe). Substitution patterns are LITERAL strings (`branches: \[main\]` with brackets
# escaped for BRE), not regexes — the three sites are stable across template bumps.
deliver_getff_workflow() {
  local tpl_src="$1" dst="$2"
  local detected_branch=""

  # Detect default branch — pure read; safe under --dry-run and offline.
  if command -v git >/dev/null 2>&1 && [ -d "${PROJECT_ROOT:-.}" ]; then
    detected_branch=$(git -C "$PROJECT_ROOT" symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@') || detected_branch=""
  fi

  # Prepare the source for the underlying delegate. Substitution needed ONLY when
  # detection succeeded AND branch differs from main; otherwise byte-identical.
  # Temp lives in mktemp (NOT next to $dst) — the delegate creates dirname($dst)
  # itself, so a sibling temp would race the mkdir. mktemp also avoids polluting
  # the consumer tree with `.getff-sub.*` residue if the delegate aborts.
  #
  # Sed delimiter choice: `~` (tilde) — forbidden in git branch names per `git
  # check-ref-format` rule 5 («cannot have ... tilde ~ ... anywhere»), so the
  # delimiter can never collide with the substituted value. Earlier draft used `#`
  # with a wrong claim that `#` is git-forbidden — it is NOT (only ~, ^, :, space,
  # \, *, ?, [, control chars are forbidden). `&` is also git-permitted but
  # sed-special in the replacement (means «entire match»); escape it via parameter
  # expansion. `\` is git-forbidden so no backslash-escape needed.
  local src_to_use="$tpl_src" _tmp=""
  if [ -n "$detected_branch" ] && [ "$detected_branch" != "main" ] && [ "$DRY_RUN" != "--dry-run" ]; then
    local esc_branch="${detected_branch//&/\\&}"
    _tmp=$(mktemp) || { echo "  ⚠ getff: mktemp failed — delivering template byte-identical (no substitution)" >&2; _tmp=""; }
    if [ -n "$_tmp" ]; then
      sed -e "s~branches: \[main\]~branches: [${esc_branch}]~g" \
          -e "s~refs/heads/main~refs/heads/${esc_branch}~g" \
          "$tpl_src" > "$_tmp"
      src_to_use="$_tmp"
    fi
  fi

  # Delegate the write — preserves copy_safe/refresh_safe semantics (skip-if-exists,
  # FORCE, .override.md, DRY_RUN). The caller's outer if/else has already filtered
  # to fresh-only or refresh-only; GETFF_TOOLCHAIN_REFRESH selects which delegate runs.
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    refresh_safe "$src_to_use" "$dst"
  else
    copy_safe "$src_to_use" "$dst"
  fi

  # Clean up the substituted temp file (if any). Template bytes are NEVER mutated.
  [ -n "$_tmp" ] && rm -f "$_tmp"

  # Emit a branch-context log line (complements the delegate's ✓/⊝/dry-run line).
  if [ -n "$detected_branch" ] && [ "$detected_branch" != "main" ]; then
    echo "    (getff: default branch '$detected_branch' substituted from template 'main')"
  elif [ -n "$detected_branch" ]; then
    echo "    (getff: default branch 'main', byte-identical to template)"
  else
    # PARK case (kickoff §5): loud stderr warning — Option A (recommended).
    echo "  ⚠ getff: could not detect default branch (no origin remote or origin/HEAD unset);" >&2
    echo "    delivered workflow uses 'main' — edit $dst if your default differs" >&2
  fi
}

# report_getff_orphans <lane> <expected-rel-path>... — adapter-jig C4 (no-orphan-residue).
# On a --refresh pass, scan the KNOWN getff delivery locations (consumer root, .getff/,
# .github/workflows/) for files carrying the getff ownership header ('generated by getff') that the
# CURRENT template set no longer delivers, and report each LOUDLY — never silently left active.
# Directory payloads (.getff/astgrep-rules) are already swept wholesale by refresh_safe above (the
# #873 rm-rf-replace branch); this covers the individually-delivered top-level files that per-file
# refresh can never sweep — the same root cause as the #882 npm barrel prune («do_refresh only
# ADD/OVERWRITEs the current stack's files, never removes a leftover»), on the python/cargo lanes.
# REPORT-ONLY by design (J2 decisions log #8): deleting consumer-tree files is the irreversible
# branch; the loud report satisfies the C4 «swept (or loudly reported)» contract. Files WITHOUT the
# getff header are never flagged — not ours to name. Read-only: safe under --dry-run.
report_getff_orphans() {
  local lane="$1"; shift
  local expected=" $* "   # space-delimited rel paths; no delivered path contains whitespace
  local f rel
  { find "$PROJECT_ROOT" -maxdepth 1 -type f \( -name '*.toml' -o -name '*.yml' -o -name 'getff-*' \) 2>/dev/null
    find "$PROJECT_ROOT/.getff" -maxdepth 1 -type f 2>/dev/null
    find "$PROJECT_ROOT/.github/workflows" -maxdepth 1 -type f -name 'getff-*.yml' 2>/dev/null
  } | LC_ALL=C sort | while IFS= read -r f; do
    grep -q 'generated by getff' "$f" 2>/dev/null || continue
    rel="${f#"$PROJECT_ROOT/"}"
    case "$expected" in
      *" $rel "*) ;;   # currently delivered — not an orphan
      *)
        echo "  ⚠ ORPHAN: $rel is getff-owned (header present) but the current $lane template set no longer delivers it."
        echo "    Stale artefact from a PRIOR getff version — review and remove it manually (getff never deletes consumer-tree files)."
        ;;
    esac
  done
  return 0
}

# ─── .ai-factory SoT (DESCRIPTION.md + ARCHITECTURE.md) materialization helpers ──────────────
# SSOT for the divergence-prone parts of materializing the AGENTS.md-referenced SoT pair, shared
# by the --full path (setup.d/30-templates.sh) and the --refresh path (install.sh do_refresh, #949).
# Both call sites keep their own copy_safe delivery lines (so the refresh-covers-full-delivery gate
# sees real per-file write-intent), but the stack→source map and the header rewrite live here once.
# Requires globals: STACK, PKG_ROOT (arch_sot_src_for_stack); DRY_RUN, FORCE (rewrite_arch_sot_header).

# arch_sot_src_for_stack — echo the ARCHITECTURE.md source template for the current $STACK.
# Unknown/empty stack falls back to the shared ts-server variant (never guesses a react-* preset).
arch_sot_src_for_stack() {
  case "$STACK" in
    react-next)   printf '%s\n' "$PKG_ROOT/packages/preset-next-15-canonical/templates/ARCHITECTURE.react-next.md" ;;
    react-spa)    printf '%s\n' "$PKG_ROOT/packages/preset-react-spa/templates/ARCHITECTURE.react-spa.md" ;;
    react-native) printf '%s\n' "$PKG_ROOT/packages/preset-react-native/templates/ARCHITECTURE.react-native.md" ;;
    *)            printf '%s\n' "$PKG_ROOT/packages/core/templates/shared/ARCHITECTURE.ts-server.md" ;;
  esac
}

# rewrite_arch_sot_header <dst> <existed_flag> — rewrite the ts-server "Drop into …" first line on
# the freshly-materialized .ai-factory/ARCHITECTURE.md COPY only (source templates serve other flows).
# Guard mirrors copy_safe's WRITE condition (not dry-run; freshly created OR --force-overwritten) so
# a consumer-edited ARCHITECTURE.md is never mutated. No-op for react-* variants (no "Drop into" line).
# sed -i.bak for BSD/GNU portability.
rewrite_arch_sot_header() {
  local dst="$1" existed="$2"
  if [ "$DRY_RUN" != "--dry-run" ] && { [ "$existed" -eq 0 ] || [ "$FORCE" = "--force" ]; }; then
    sed -i.bak -e 's#^> Drop into `.ai-factory/ARCHITECTURE.md` and override only what your project needs\. #> This install-generated starter IS your `.ai-factory/ARCHITECTURE.md` — edit it to match your project. #' "$dst"
    rm -f "${dst}.bak"
  fi
}

# GH #531 (reopen): non-destructive .prettierignore merge. copy_safe skips-if-exists, so a
# BROWNFIELD consumer with a pre-existing .prettierignore never received the AIF exclusions →
# generated .ai-factory/RULES.md (+ RULES.react-next.md, .claude/settings.json, the eslint-rules-
# local barrel) stayed un-ignored → `prettier --check .` re-broke on the non-format-stable table.
# Behaviour:
#   - no consumer file        → copy the shipped file byte-identical (greenfield path unchanged).
#   - consumer file exists     → append a marker-delimited block of AIF entries the consumer does
#                                NOT already have (dedup), wrapped in begin/end markers.
#   - block already present     → no-op (idempotent on re-install; begin-marker count stays 1).
#   - --force                   → overwrite wholesale (same as copy_safe under --force).
# Plain bash — NO yq, NO new dependency, NOT the yq-based _aif_yq_wire workflow-merge routine.
merge_prettierignore() {
  local src="$1"
  local dst="$2"

  # --force: behave like copy_safe (overwrite wholesale).
  if [ "$FORCE" = "--force" ]; then
    copy_safe "$src" "$dst"
    return 0
  fi

  # No consumer file → greenfield: copy byte-identical (defer entirely to copy_safe).
  if [ ! -e "$dst" ]; then
    copy_safe "$src" "$dst"
    return 0
  fi

  # Consumer file EXISTS → non-destructive merge. Detect whether the managed block already exists;
  # the collect-and-deliver logic below is SHARED for both cases — only the WRITE differs (insert
  # into the existing block vs. append a fresh one).
  #
  # GH #890: the marker's presence must NOT short-circuit delivery. The previous early-return made
  # the block run-once — frozen at whatever the shipped template had the first time it merged, so a
  # NEW shipped pattern (e.g. #889's .ai-factory/ARCHITECTURE.*.md) could never reach an already-
  # installed consumer via repeat --full or --refresh (only --force, which overwrites wholesale
  # above). Genuine idempotency (mirroring the sibling ignore_shipped_configs, which already
  # re-diffs per line) re-checks for missing patterns on every run and inserts them into the block.
  local marker_present=0
  grep -qxF "$PRETTIERIGNORE_BEGIN" "$dst" && marker_present=1

  # Collect shipped entries not already present verbatim ANYWHERE in the consumer file. Ignore blank
  # lines and comments from the shipped source (only real ignore patterns get merged).
  local missing=()
  local line
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      '' | '#'*) continue ;;
    esac
    grep -qxF "$line" "$dst" || missing+=("$line")
  done < "$src"

  # Nothing to add (consumer already has every AIF pattern) → genuine idempotent no-op.
  if [ "${#missing[@]}" -eq 0 ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip merge: $dst (already has every AIF pattern)"
    else
      echo "  ⊝ $dst (already has every AIF .prettierignore pattern — nothing to merge)"
    fi
    return 0
  fi

  if [ "$DRY_RUN" = "--dry-run" ]; then
    if [ "$marker_present" -eq 1 ]; then
      echo "  [dry-run] would add ${#missing[@]} new AIF pattern(s) into the existing block in: $dst"
    else
      echo "  [dry-run] would merge ${#missing[@]} AIF pattern(s) into: $dst"
    fi
    return 0
  fi

  if [ "$marker_present" -eq 1 ]; then
    # GH #890: an existing block → INSERT the missing patterns immediately before the END marker so
    # the block stays SINGLE (no duplicate marker — the f15 begin-marker-count==1 invariant). Rewrite
    # via a temp file with a pure read-loop (bash-3.2 / BSD-tool safe: no sed path-escaping, no awk
    # array-passing).
    local _tmp="${dst}.aif-merge.$$"
    local _emitted=0 _l
    while IFS= read -r _l || [ -n "$_l" ]; do
      if [ "$_emitted" -eq 0 ] && [ "$_l" = "$PRETTIERIGNORE_END" ]; then
        printf '%s\n' "${missing[@]}"
        _emitted=1
      fi
      printf '%s\n' "$_l"
    done < "$dst" > "$_tmp"
    # Fallback: BEGIN present but END absent (corrupt file, or a prior install interrupted between the
    # BEGIN/patterns/END printfs of the append path below — that write is NOT atomic). Never lose the
    # patterns silently (which would also make the ✓ echo a lie); append them + a fresh END so the
    # block self-heals and the next run is a clean no-op.
    if [ "$_emitted" -eq 0 ]; then
      {
        printf '%s\n' "${missing[@]}"
        printf '%s\n' "$PRETTIERIGNORE_END"
      } >> "$_tmp"
    fi
    mv "$_tmp" "$dst"
    echo "  ✓ $dst (added ${#missing[@]} new AIF .prettierignore pattern(s) to the existing block)"
  else
    # No block yet → append a fresh marker-delimited block. Ensure a trailing newline before it.
    [ -n "$(tail -c1 "$dst")" ] && printf '\n' >> "$dst"
    {
      printf '%s\n' "$PRETTIERIGNORE_BEGIN"
      printf '%s\n' "${missing[@]}"
      printf '%s\n' "$PRETTIERIGNORE_END"
    } >> "$dst"
    echo "  ✓ $dst (merged ${#missing[@]} AIF .prettierignore pattern(s))"
  fi
}

# GH #531 (reopen, config-mismatch): conditionally ignore the framework CONFIG files install
# actually SHIPPED. Unlike the SOURCE patterns in the static .prettierignore template (framework-
# namespace files a consumer never owns: eslint-rules-local/, packages/core/hooks/, scripts/audit-
# r4.ts), these configs ship at a consumer-ownable path and MIGHT be consumer-authored — copy_safe
# keeps the consumer's version when one already exists (and records it in SKIPPED). So we ignore a
# config ONLY when it is NOT in SKIPPED (we shipped it fresh, formatted to OUR Prettier config —
# printWidth 80 / singleQuote / no plugins — which a consumer's own .prettierrc would reject). A
# consumer-authored config (copy_safe-skipped) stays format-checked: never silently hidden.

_prettierignore_in_skipped() {
  local needle="$1" s
  # Guard the empty-array expansion: under `set -u` on bash 3.2 (macOS), "${SKIPPED[@]}" with an
  # empty SKIPPED throws "unbound variable" and aborts install. ${#SKIPPED[@]} (length) is safe.
  [ "${#SKIPPED[@]}" -gt 0 ] || return 1
  for s in "${SKIPPED[@]}"; do
    [ "$s" = "$needle" ] && return 0
    # Prefix match: SKIPPED may hold a DIRECTORY (e.g. a consumer-owned skill dir kept by
    # copy_skill_with_transform) — any file inside it is consumer-owned too.
    case "$needle" in "$s"/*) return 0 ;; esac
  done
  return 1
}

ignore_shipped_configs() {
  local ign="$PROJECT_ROOT/.prettierignore"
  [ -e "$ign" ] || return 0   # no consumer .prettierignore at all → nothing to extend
  # Framework configs that ship at a consumer-ownable path. Each is ignored ONLY if shipped fresh.
  local candidates=(
    "eslint.config.mjs" "eslint.config.rn-common.mjs" "vitest.config.ts" "tsconfig.json" "playwright.config.ts"
    ".dependency-cruiser.cjs" "stryker.config.json" ".lintstagedrc.json"
    ".github/workflows/ci.yml" ".github/workflows/workflow-integrity.yml"
  )
  # GH #807: a #793/#796 multi-stack monorepo ships per-workspace configs (apps/*/eslint.config.mjs,
  # deeper */*/eslint.config.mjs, and the RN */eslint.config.rn-common.mjs) — root basenames above do
  # NOT cover them, so prettier --check . reflowed them and format:check went RED. Discover the
  # per-workspace configs the multi-stack branch (40-configs.sh) wrote and fold them into candidates
  # at their RELATIVE paths. The same fresh-vs-SKIPPED guard below applies — a consumer-authored
  # per-workspace config (copy_safe-SKIPPED) stays format-checked; only shipped-fresh ones are ignored.
  # (Single `while`, no nested pipe + no single-line `case */*` — bash 3.2 on macOS mis-parses that
  # combination; the slash test below is the bash-3.2-safe equivalent.)
  while IFS= read -r _abs; do
    [ -n "$_abs" ] || continue
    _wsrel="${_abs#"$PROJECT_ROOT"/}"
    # workspace-nested only: if stripping a leading `*/` leaves the path unchanged it has no slash
    # → it is a root-level basename, already covered by the static candidates list above → skip.
    [ "$_wsrel" = "${_wsrel#*/}" ] && continue
    candidates+=("$_wsrel")
  done < <(
    find "$PROJECT_ROOT" -name node_modules -prune -o -name .git -prune -o \
         -path "$PROJECT_ROOT/.claude/worktrees" -prune -o \
         \( -name 'eslint.config.mjs' -o -name 'eslint.config.rn-common.mjs' \) -print 2>/dev/null
  )
  # Shipped .claude agents/skills markdown (2026-07-11): transform_internal_refs rewrites their
  # repo-relative links to blob URLs at install time, which shifts markdown TABLE cell widths —
  # the installed copies are no longer prettier-format-stable under ANY config (fresh-install
  # validate smoke went RED on .claude/agents/capability-reuse-auditor.md with zero consumer
  # edit). Same framework-vendored class as GH #531/#884. Enumerate ONLY from OUR shipping
  # sources ($PKG_ROOT agents/ + skill dirs), never a blanket .claude/** find — a consumer's own
  # custom agent/skill must stay format-checked. The fresh-vs-SKIPPED guard below (now
  # dir-prefix-aware) keeps consumer-owned same-name copies checked too.
  local _src _slug
  for _src in "$PKG_ROOT"/agents/*.md; do
    [ -f "$_src" ] || continue
    candidates+=(".claude/agents/$(basename "$_src")")
  done
  for _src in "$PKG_ROOT"/.claude/skills/*/ "$PKG_ROOT"/skills/*/; do
    [ -d "$_src" ] || continue
    _slug=$(basename "$_src")
    [ -d "$PROJECT_ROOT/.claude/skills/$_slug" ] || continue
    while IFS= read -r _abs; do
      [ -n "$_abs" ] || continue
      candidates+=("${_abs#"$PROJECT_ROOT"/}")
    done < <(find "$PROJECT_ROOT/.claude/skills/$_slug" -name '*.md' -print 2>/dev/null | LC_ALL=C sort)
    # LC_ALL=C sort: find's output order is filesystem-dependent (macOS APFS vs Linux ext4
    # return different orders) — unsorted entries made the generated .prettierignore hash
    # differ between the local snapshot capture and CI's byte-identical compare.
  done
  local fresh=() rel
  for rel in "${candidates[@]}"; do
    [ -e "$PROJECT_ROOT/$rel" ] || continue                       # not shipped for this stack/preset
    _prettierignore_in_skipped "$PROJECT_ROOT/$rel" && continue   # consumer owned it → keep checking
    grep -qxF "$rel" "$ign" && continue                           # already ignored (idempotent re-install)
    fresh+=("$rel")
  done
  [ "${#fresh[@]}" -eq 0 ] && return 0
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would ignore ${#fresh[@]} freshly-shipped framework config(s) in $ign"
    return 0
  fi
  [ -n "$(tail -c1 "$ign")" ] && printf '\n' >> "$ign"
  {
    printf '%s\n' "$PRETTIERIGNORE_CFG_BEGIN"
    printf '%s\n' "${fresh[@]}"
    printf '%s\n' "$PRETTIERIGNORE_CFG_END"
  } >> "$ign"
  echo "  ✓ $ign (ignored ${#fresh[@]} freshly-shipped framework config(s); consumer-authored configs kept format-checked)"
}

# Idempotent mkdir -p that respects --dry-run.
mkdir_safe() {
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would mkdir: $1"
    return 0
  fi
  mkdir -p "$1"
}

# chmod that respects --dry-run.
chmod_safe() {
  if [ "$DRY_RUN" = "--dry-run" ]; then
    return 0
  fi
  chmod "$@"
}

# Detect the consumer's package manager from corepack / workspace / lockfile signals present
# AT INSTALL TIME. The explicit package.json "packageManager" field (corepack source of truth)
# wins; else workspace/lock markers (pnpm-workspace.yaml exists pre-install in a monorepo even
# before the lockfile lands — R-S4-3 note below); else npm. Echoes one of: npm | pnpm | yarn.
# node-optional: the field check is skipped when node is absent (markers still resolve). SSOT —
# shared by patch_stryker_package_manager() and the §8 dev-dep install so the two never drift.
detect_pm() {
  local _pm _field
  if [ -f "$PROJECT_ROOT/pnpm-lock.yaml" ] || [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ]; then
    _pm="pnpm"
  elif [ -f "$PROJECT_ROOT/yarn.lock" ] || [ -f "$PROJECT_ROOT/.yarnrc.yml" ]; then
    _pm="yarn"
  else
    _pm="npm"
  fi
  if command -v node >/dev/null 2>&1 && [ -f "$PROJECT_ROOT/package.json" ]; then
    _field=$(AIF_PJ="$PROJECT_ROOT/package.json" node -e 'try{const m=(JSON.parse(require("fs").readFileSync(process.env.AIF_PJ,"utf8")).packageManager||"").split("@")[0];if(["npm","pnpm","yarn"].includes(m))process.stdout.write(m)}catch{}' 2>/dev/null || true)
    [ -n "$_field" ] && _pm="$_field"
  fi
  printf '%s' "$_pm"
}

# _detect_stack_from_pkg — classify the consumer's stack from package.json dependency signals.
# Pure bash + grep, NODE-FREE: install.sh runs BEFORE the consumer installs deps, so this must not
# depend on `node` being present (node-optional install-time repo-read model — same posture as
# detect_pm above, packages/core/audit-self/detect-r2-boundary.sh, and the expo-detect in
# setup.d/40-configs.sh, all of which read package.json with grep, not node).
# SSOT — this is the single stack detector; both the install.sh stack-pick (fresh `--yes`/`--full`
# auto-detect, GH #780) and 15-companions-stack.sh consume it, so the signal logic never drifts.
# Signal order is most-specific-first: react-native → next → react → typescript → unknown.
# The grep anchor '"<dep>"[[:space:]]*:' matches a package.json dependency KEY exactly (the closing
# quote excludes prefixes — '"react"' does NOT match '"react-native":' / '"react-dom":', and a
# string VALUE like "next build" is not matched — there is no '"next":' key there).
# Trade-off vs a node deps-only parse: grep scans the WHOLE file, so a signal key in
# peer/optional/overrides (or, rarely, a same-named "scripts" key) also counts. For a realistic
# consumer package.json this is equal-or-more-inclusive and never the #780 "silent wrong install"
# failure (an app peer-depending on next is next-related); the install path fail-louds only on
# `unknown`, never on a mis-detect.
# Reads <target>/package.json (target defaults to $PROJECT_ROOT). Echoes exactly one of:
#   react-native | react-next | react-spa | ts-server | unknown
# I-2 (§13.5): the optional <target> arg lets the per-workspace walk (_detect_stacks_per_workspace)
# classify each workspace dir; the no-arg form is unchanged (back-compat — the I-1 install stack-pick
# and 15-companions-stack.sh both call it no-arg → $PROJECT_ROOT).
_detect_stack_from_pkg() {
  local target="${1:-$PROJECT_ROOT}"
  local pkg="$target/package.json"
  [ -f "$pkg" ] || { echo "unknown"; return; }
  if   grep -qE '"react-native"[[:space:]]*:' "$pkg"; then echo "react-native"
  elif grep -qE '"next"[[:space:]]*:'         "$pkg"; then echo "react-next"
  elif grep -qE '"react"[[:space:]]*:'        "$pkg"; then echo "react-spa"
  elif grep -qE '"typescript"[[:space:]]*:'   "$pkg"; then echo "ts-server"
  else echo "unknown"; fi
}

# _workspace_pkg_dirs [root] — enumerate workspace package directories (those that contain a
# package.json) for the multi-stack monorepo case (§13.5, I-2 Layer 1). NODE-FREE, no yq/pnpm/turbo
# dependency: install runs BEFORE the consumer's `pnpm install`, so this must not depend on a package
# manager being present (same node-optional posture as _detect_stack_from_pkg / detect_pm above).
# Convention: expand the immediate children of the 5 conventional workspace container roots —
# apps packages services libs modules — the SAME set as the arch:check target resolver in
# setup.d/70-deps.sh:37, so the two never drift. Keeps only children that carry a package.json (a
# workspace package is a dir WITH a package.json; a sibling dir without one is not enumerated).
# Exotic/custom workspace roots outside the convention are not enumerated — they fall back to
# single-root detection, the same coverage boundary 70-deps.sh accepts. Reads $root (default
# $PROJECT_ROOT). Echoes each workspace dir RELATIVE to $root, one per line (so Layer 2 can scope
# `applies-to <dir>/**`); echoes nothing for a flat / single-root repo (no conventional workspace).
_workspace_pkg_dirs() {
  local root="${1:-$PROJECT_ROOT}" container path name
  for container in apps packages services libs modules; do
    [ -d "$root/$container" ] || continue
    for path in "$root/$container"/*/; do
      [ -d "$path" ] || continue                 # no glob match → literal '*/', skip
      [ -f "${path}package.json" ] || continue   # workspace package := dir WITH a package.json
      name=$(basename "$path")
      printf '%s/%s\n' "$container" "$name"
    done
  done
  return 0
}

# _detect_stacks_per_workspace [root] — the §13.5 Layer-1 deliverable: walk each workspace package
# dir (_workspace_pkg_dirs) × per-dir _detect_stack_from_pkg → echo `dir<TAB>stack` per workspace,
# one line each (mirrors the single-root DETECTED_STACK echo in 15-companions-stack.sh). A
# per-workspace `unknown` (a workspace whose package.json matches no stack signal) is KEPT in the map
# as a re-checkable marker — never dropped, never `exit 1` (the §13.5 fork-2 default; persisting that
# marker on disk is Layer 2, out of scope here). Echoes nothing for a flat / single-root repo (no
# workspace dirs) — the caller falls back to the single-root _detect_stack_from_pkg (the I-1 path).
_detect_stacks_per_workspace() {
  local root="${1:-$PROJECT_ROOT}" reldir stack
  while IFS= read -r reldir; do
    [ -n "$reldir" ] || continue
    stack=$(_detect_stack_from_pkg "$root/$reldir")
    printf '%s\t%s\n' "$reldir" "$stack"
  done < <(_workspace_pkg_dirs "$root")
  return 0
}

# _resolve_workspace_stacks [root] — P0.3 (ultrareview) config-PLACEMENT resolver. Wraps the PURE
# _detect_stacks_per_workspace map and applies the config-placement precedence per workspace so a
# dependency-hoisting monorepo (pnpm hoists a shared `typescript` to the ROOT package.json, leaving
# every workspace's own package.json signal-free → `unknown`) still lands a working eslint config
# instead of the observed silent zero-config install (lint crashes rc=2 → pre-commit blocks every
# commit). This is DELIBERATELY separate from _detect_stacks_per_workspace, which stays a pure
# detector: the 99-finalize synth-wire routing + R2 scoping consume the raw own-signal map and must
# NOT inherit placement fallbacks (routing a stack's live rule into a signal-free workspace is a
# different, wider decision). Precedence per workspace (verbatim from the brief):
#   own package.json signal  >  explicit positional $STACK ($STACK_EXPLICIT=1)  >  root signal  >  unknown
# Emits `dir<TAB>stack<TAB>provenance` per workspace, provenance ∈ {own, explicit-arg, root-fallback,
# unknown}, so the caller can show WHY each workspace got its stack. A still-unknown workspace (own
# unknown AND no explicit arg AND root unknown) stays `unknown` — the §13.5 fork-2 KEPT re-checkable
# marker, never a per-workspace exit 1 (the _detect_stacks_per_workspace doc above is binding); the
# AGGREGATE zero-configs-placed loud-fail lives in the caller (setup.d/40-configs.sh), not here.
# NODE-FREE (delegates to the grep-based _detect_stack_from_pkg). Reads globals STACK + STACK_EXPLICIT
# (both optional — guarded with :- so lib-only / test callers under `set -u` don't abort).
_resolve_workspace_stacks() {
  local root="${1:-$PROJECT_ROOT}" reldir stack prov rootstack
  rootstack=$(_detect_stack_from_pkg "$root")
  while IFS=$'\t' read -r reldir stack; do
    [ -n "$reldir" ] || continue
    if [ "$stack" != "unknown" ]; then
      prov="own"                                                   # 1. workspace's own signal wins
    elif [ "${STACK_EXPLICIT:-}" = "1" ] && [ -n "${STACK:-}" ]; then
      # shellcheck disable=SC2153  # STACK is install.sh's global stack selector (set before sourcing)
      stack="$STACK"; prov="explicit-arg"                          # 2. user typed `./setup <stack>`
    elif [ "$rootstack" != "unknown" ]; then
      stack="$rootstack"; prov="root-fallback"                     # 3. hoisting-aware root signal
    else
      stack="unknown"; prov="unknown"                              # 4. still-unknown → kept marker
    fi
    printf '%s\t%s\t%s\n' "$reldir" "$stack" "$prov"
  done < <(_detect_stacks_per_workspace "$root")
  return 0
}

# The shipped stryker.config.json hardcodes "packageManager": "npm" (the template can't
# self-detect). Patch the COPIED config in place to match the consumer's lockfile so a
# pnpm/yarn consumer doesn't get an npm-locked mutation run. Non-destructive: rewrites only
# the packageManager key. Guarded on --dry-run and on node availability (no node → leave npm).
patch_stryker_package_manager() {
  _cfg="$PROJECT_ROOT/stryker.config.json"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would set stryker packageManager from consumer lockfile"
    return 0
  fi
  command -v node >/dev/null 2>&1 || return 0
  [ -f "$_cfg" ] || return 0
  # R-S4-3: install.sh runs BEFORE the consumer's `npm/pnpm install` in the canonical flow,
  # so a lockfile may not exist yet (a pnpm monorepo would silently stay "npm"). Detect from
  # signals present AT INSTALL TIME: the explicit package.json "packageManager" field (corepack
  # source of truth) wins; else workspace/lock markers (pnpm-workspace.yaml exists pre-install
  # in a monorepo); else npm. A flat pnpm consumer with neither marker nor field still defaults
  # npm — re-run install after the lockfile lands, or set package.json "packageManager".
  _pm=$(detect_pm)   # SSOT detector (lockfile/workspace/corepack signals; see detect_pm above)
  # GH #531: rewrite ONLY the packageManager VALUE in place (string-substitution), NOT a full
  # JSON.stringify re-serialize. The template ships prettier-clean (short arrays collapsed to one
  # line); JSON.stringify(,,2) would re-expand those arrays and break `prettier --check` on the
  # consumer. A targeted value swap preserves the template's prettier formatting byte-for-byte.
  AIF_STRYKER_CFG="$_cfg" AIF_STRYKER_PM="$_pm" node -e '
    const fs = require("fs");
    const p = process.env.AIF_STRYKER_CFG;
    const pm = process.env.AIF_STRYKER_PM;
    const src = fs.readFileSync(p, "utf8");
    const out = src.replace(/("packageManager"\s*:\s*")[^"]*(")/, `$1${pm}$2`);
    if (out !== src) fs.writeFileSync(p, out);
  '
  echo "  ✓ stryker packageManager → $_pm"
}

# copy_skill_with_transform <skill-slug>
# Copies .claude/skills/<slug>/ to the consumer and rewrites repo-internal markdown
# cross-refs to GitHub blob URLs (transform_internal_refs). Used for pipeline + its
# orchestration companion skills (dispatcher / aif-doctor / template-audit) — every one
# carries ](../../../{docs,packages,README}) refs that would dangle on a consumer tree.
# Honors --force (skip-if-exists default) and --dry-run, matching copy_safe semantics.
copy_skill_with_transform() {
  local slug="$1"
  local src="$PKG_ROOT/.claude/skills/$slug"
  local dst="$PROJECT_ROOT/.claude/skills/$slug"
  if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
    SKIPPED+=("$dst")
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: .claude/skills/$slug (exists)"
    else
      echo "  ⊝ .claude/skills/$slug (exists — skipping)"
    fi
    return 0
  fi
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would copy: $src → $dst (+ transform internal refs)"
    return 0
  fi
  # Wipe, recopy, rewrite repo-internal cross-refs in all .md files to GitHub blob URLs.
  _copy_tree_with_transform "$src" "$dst"
  echo "  ✓ .claude/skills/$slug/ (cross-refs rewritten to ${UPSTREAM_BLOB_URL})"
}

# refresh_skill_with_transform <slug>
# Like copy_skill_with_transform but with refresh_safe semantics for directories.
# The override signal for a skill directory is <dst_dir>.override.md (e.g.
# .claude/skills/pipeline.override.md signals consumer-owned pipeline skill).
refresh_skill_with_transform() {
  local slug="$1"
  local src="$PKG_ROOT/.claude/skills/$slug"
  local dst="$PROJECT_ROOT/.claude/skills/$slug"
  local override="${dst}.override.md"
  [ -d "$src" ] || return 0
  if [ -e "$override" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: .claude/skills/$slug (.override.md — consumer-owned)"
    else
      echo "  ⊝ .claude/skills/$slug (.override.md — consumer-owned, keeping)"
    fi
    return 0
  fi
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would refresh: $src → $dst (+ transform internal refs)"
    return 0
  fi
  _copy_tree_with_transform "$src" "$dst"
  echo "  ✓ .claude/skills/$slug/ (refreshed, cross-refs rewritten to ${UPSTREAM_BLOB_URL})"
}

# _rule_basename_consumer_owned <basename>
# Exit 0 IFF the eslint-rules-local/<basename>.{ts,mjs,d.ts} triple must be treated as the
# CONSUMER's (ledger L-5): true when any present member of the triple is absent from the
# refresh-baseline manifest (we cannot prove we delivered it) or no longer matches its recorded
# hash (the consumer adapted it). Exit 1 only when every present member is a pristine framework
# delivery — the one case where removing it is ours to do.
#
# What this replaces: ownership decided by BASENAME COLLISION with any framework rules dir, a
# heuristic reworked across five fix-of-fix commits (#880 -> #887 -> #1503 -> #1505 -> #1548)
# while the same umbrella was building the actual ownership record. A consumer's copy-and-adapt
# of a same-named preset rule was deleted with one info line, on EVERY non-dry-run pass, without
# ever consulting the divergence guard that every other overwrite path consults.
#
# All-or-nothing over the triple on purpose: deleting half a consumer's rule — say the .mjs while
# keeping their .ts — is a worse outcome than leaving a stray file behind.
_rule_basename_consumer_owned() {
  local eb="$1" f h
  for f in "$PROJECT_ROOT/eslint-rules-local/$eb.ts" \
           "$PROJECT_ROOT/eslint-rules-local/$eb.mjs" \
           "$PROJECT_ROOT/eslint-rules-local/$eb.d.ts"; do
    [ -e "$f" ] || continue
    _refresh_baseline_lookup "$f"
    [ -n "$REFRESH_BASELINE_ENTRY" ] || return 0
    h=$(_hash256 "$f") || return 0
    [ "$h" = "$REFRESH_BASELINE_ENTRY" ] || return 0
  done
  return 1
}

# generate_eslint_barrel
# #876 groundwork: single source of truth for the eslint-rules-local/index.mjs barrel generator
# + the #838 stack-scoped fences-fire fixture prune. Extracted VERBATIM (byte-identical output)
# from setup.d/40-configs.sh's former inline block — see the "why" comments that precede its call
# site there for the barrel-generation rationale (Variant A / fix #752, FQA S1-A W1).
# Precondition: call AFTER the eslint-rules-local/ rule files AND the scripts/fences-fire-fixtures/
# directory are in place — it reads the on-disk rule set and prunes fixtures whose rule is not in
# this stack's barrel.
# #882: also prunes eslint-rules-local/*.ts files that don't belong to the CURRENT $STACK before
# regenerating barrel content — closes the gap where a prior install/refresh with a DIFFERENT
# --stack left a stray preset-rule file that got silently re-registered into the barrel. Fix
# lives here (not in the copy loops in setup.d/40-configs.sh / install.sh's do_refresh) — see
# docs/superpowers/specs/2026-07-03-eslint-barrel-stack-prune-design.md "Rejected: consolidate
# the stack→dirs mapping into a new shared function" for why this stays a small, isolated
# mapping rather than a shared helper touching those two working call sites.
# Self-no-ops on --dry-run (the `if [ -z "$DRY_RUN" ]; then … fi` guard is INSIDE the helper, so
# callers don't need to guard). Called by BOTH setup.d/40-configs.sh (copy path) and do_refresh in
# install.sh (refresh path, #876) — do not duplicate this logic at either call site.
# Reads globals: PROJECT_ROOT, PKG_ROOT, DRY_RUN, STACK.
generate_eslint_barrel() {
  local _barrel _rf _b _camel _m _mstem _rid _rkey
  local _valid_dirs _vd _vf _valid_basenames _ef _eb
  local _fw_dir _fw_f _fw_basenames _ln _cb _kc _kept_pairs _kept_names _kept_n
  if [ -z "$DRY_RUN" ]; then
    _barrel="$PROJECT_ROOT/eslint-rules-local/index.mjs"

    # #882: prune stray rule files from a DIFFERENT stack before generating barrel content below,
    # so a stranded rule from a prior install/refresh isn't re-registered. Small, isolated mapping
    # (not shared with the copy loops) — see design doc note above.
    _valid_dirs="packages/core/eslint-rules"
    # STACK is install.sh's global stack selector (set before this file is sourced), unrelated
    # to the lowercase `stack` local in _detect_stacks_per_workspace() above; shellcheck flags it
    # only because this is $STACK's first reference in THIS file, with no local assignment to see.
    # shellcheck disable=SC2153
    case "$STACK" in
      react-next) _valid_dirs="$_valid_dirs packages/preset-next-15-canonical/eslint-rules" ;;
      react-spa)  _valid_dirs="$_valid_dirs packages/preset-react-spa/eslint-rules" ;;
    esac
    _valid_basenames=" "
    for _vd in $_valid_dirs; do
      for _vf in "$PKG_ROOT/$_vd"/*.ts; do
        [ -e "$_vf" ] || continue
        case "$_vf" in *.test.ts|*.d.ts|*/index.ts) continue ;; esac
        _valid_basenames="$_valid_basenames $(basename "$_vf" .ts) "
      done
    done
    # issue 1481 criterion, computed BEFORE the prune so the prune can reuse it (issue 1519):
    # a rule basename is FRAMEWORK-ATTRIBUTABLE iff it exists as a rule .ts in at least one
    # framework rules dir (core + all presets, across ALL stacks, not just the current
    # $STACK). Absent from every framework dir → consumer-owned → never pruned.
    _fw_basenames=" "
    for _fw_dir in "$PKG_ROOT"/packages/core/eslint-rules "$PKG_ROOT"/packages/*/eslint-rules; do
      [ -d "$_fw_dir" ] || continue
      for _fw_f in "$_fw_dir"/*.ts; do
        [ -e "$_fw_f" ] || continue
        case "$_fw_f" in *.test.ts|*.d.ts|*/index.ts) continue ;; esac
        _fw_basenames="$_fw_basenames $(basename "$_fw_f" .ts) "
      done
    done
    for _ef in "$PROJECT_ROOT"/eslint-rules-local/*.ts; do
      [ -e "$_ef" ] || continue
      case "$_ef" in *.d.ts) continue ;; esac
      _eb=$(basename "$_ef" .ts); [ "$_eb" = "index" ] && continue
      case "$_valid_basenames" in
        *" $_eb "*) ;;  # valid for this stack — keep
        *)
          # issue 1519: prune ONLY framework-attributable strays (#882 unchanged). A
          # basename absent from EVERY framework rules dir is consumer-owned (issue 1481
          # criterion) — its files are the consumer's own work and stay untouched, silently.
          case "$_fw_basenames" in
            *" $_eb "*)
              # ledger L-5: a basename collision proves the NAME is ours, never that the FILE is.
              # Ownership comes from the delivery manifest (_rule_basename_consumer_owned).
              if _rule_basename_consumer_owned "$_eb"; then
                echo "  · kept rule [$_eb] — locally modified or not framework-delivered (consumer-owned)"
              else
                rm -f "$PROJECT_ROOT/eslint-rules-local/$_eb.ts" \
                      "$PROJECT_ROOT/eslint-rules-local/$_eb.mjs" \
                      "$PROJECT_ROOT/eslint-rules-local/$_eb.d.ts"
                echo "  · pruned stale rule [$_eb] — not part of the $STACK stack"
              fi
              ;;
          esac
          ;;
      esac
    done

    # issue 1481 casualty 2: preserve CONSUMER-added barrel entries across regeneration.
    # A consumer hand-extends index.mjs with their own rule imports (compiled .mjs with NO .ts —
    # the no-tsc consumer reality, setup.d/40-configs.sh:174-177); regenerating from the on-disk
    # framework .ts set used to silently drop every such entry. Criterion (the issue's own):
    # an entry survives iff its rule basename is NOT framework-attributable — i.e. absent as a
    # rule .ts from EVERY framework rules dir (core + all presets, across ALL stacks, not just
    # the current $STACK). That keeps the #882 cross-stack prune intact: a stray rule from a
    # DIFFERENT --stack IS framework-attributable → still pruned and dropped, exactly as before.
    # An entry whose module is missing on disk after the prune above is dropped (dead import),
    # not preserved — a barrel entry pointing at a missing module kills ALL rules on config load.
    # With zero consumer entries the generated barrel is byte-identical to the pre-1481 output.
    # ($_fw_basenames is computed ABOVE the prune loop — issue 1519 — and reused here.)
    _kept_pairs=""
    _kept_names=" "
    if [ -f "$_barrel" ]; then
      while IFS= read -r _ln; do
        # Matches ONLY the generated import shape "import { camel } from './basename.mjs';" —
        # basename kebab-case per the file/key convention recorded at the 40-configs call site.
        _cb="$(printf '%s\n' "$_ln" | sed -n "s/^import { \(.*\) } from '\.\/\([a-z0-9-]*\)\.mjs';$/\2 \1/p")"
        [ -n "$_cb" ] || continue
        _kc="${_cb#* }"; _cb="${_cb%% *}"
        case "$_kept_names" in *" $_cb "*) continue ;; esac        # already kept — first entry wins
        # A PRISTINE framework rule is regenerated below, so its hand-copied entry is dropped
        # here. A consumer-owned one (ledger L-5) is not regenerated by anything — dropping its
        # entry would leave their surviving .mjs on disk and unloadable, which is the prune
        # defect moved one layer up.
        case "$_fw_basenames" in
          *" $_cb "*) _rule_basename_consumer_owned "$_cb" || continue ;;
        esac
        # issue 1519 RP-1b: a basename with a .ts on disk gets the CANONICAL entry from the
        # generation loops below — keeping the hand-added entry here too would emit a
        # duplicate import binding → hard ESM SyntaxError → the barrel fails to load and
        # EVERY rule dies. The 1481 preservation mechanism exists for entries generation
        # CANNOT see (the .mjs-only no-tsc consumer); an entry generation already covers is
        # redundant by construction.
        [ -f "$PROJECT_ROOT/eslint-rules-local/$_cb.ts" ] && continue
        [ -f "$PROJECT_ROOT/eslint-rules-local/$_cb.mjs" ] || continue  # dead import — drop
        _kept_names="$_kept_names$_cb "
        _kept_pairs="$_kept_pairs$_cb $_kc
"
      done < "$_barrel"
    fi
    {
      echo "// AUTO-GENERATED by install.sh — re-exports the compiled sibling rule files as one ESLint"
      echo "// plugin. Regenerated each install to match the shipped rule set; do not hand-edit."
      echo "// Variant A: compiled .mjs barrel (ESM by extension) — no TS loader, no package.json type field needed."
      for _rf in "$PROJECT_ROOT"/eslint-rules-local/*.ts; do
        case "$_rf" in *.d.ts) continue ;; esac  # skip type declarations emitted by tsc
        _b=$(basename "$_rf" .ts); [ "$_b" = "index" ] && continue
        _camel=$(echo "$_b" | awk -F- '{o=$1; for(i=2;i<=NF;i++) o=o toupper(substr($i,1,1)) substr($i,2); print o}')
        echo "import { $_camel } from './$_b.mjs';"
      done
      if [ -n "$_kept_pairs" ]; then
        printf '%s' "$_kept_pairs" | while read -r _b _camel; do
          echo "import { $_camel } from './$_b.mjs';"
        done
      fi
      echo "const plugin = {"
      echo "  meta: { name: '@rules-as-tests/local-eslint-rules', version: '0.1.0' },"
      echo "  rules: {"
      for _rf in "$PROJECT_ROOT"/eslint-rules-local/*.ts; do
        case "$_rf" in *.d.ts) continue ;; esac  # skip type declarations emitted by tsc
        _b=$(basename "$_rf" .ts); [ "$_b" = "index" ] && continue
        _camel=$(echo "$_b" | awk -F- '{o=$1; for(i=2;i<=NF;i++) o=o toupper(substr($i,1,1)) substr($i,2); print o}')
        echo "    '$_b': $_camel,"
      done
      if [ -n "$_kept_pairs" ]; then
        printf '%s' "$_kept_pairs" | while read -r _b _camel; do
          echo "    '$_b': $_camel,"
        done
      fi
      echo "  },"
      echo "};"
      echo "export default plugin;"
      echo "export const rules = plugin.rules;"
    } > "$_barrel"
    echo "  ✓ generated eslint-rules-local/index.mjs ($(grep -c '^import ' "$_barrel") rules)"
    if [ -n "$_kept_pairs" ]; then
      _kept_n="$(printf '%s' "$_kept_pairs" | wc -l | tr -d ' ')"
      echo "  ⊟ preserved $_kept_n consumer-added barrel entries (issue 1481)"
    fi

    # #838: a consumer must only carry fences-fire fixtures its OWN barrel can enforce.
    # Fixtures ship unconditionally above (step 5a), but stack-specific rules (e.g. R12
    # no-server-imports-in-client, react-next only) land per-stack — probing a fixture whose
    # rule is absent from the barrel makes linter.verify THROW ("Could not find <rule> in
    # plugin") → check:fences-fire false-REDs on every non-next stack. The loop below only
    # ever targets basenames of the manifests WE ship (it iterates the framework source dir,
    # never the consumer's own tree), so it can only ever delete FRAMEWORK fixtures — but on
    # --refresh the fixtures dir itself is framework-owned: refresh_safe replaces the whole
    # dir unless the consumer sets scripts/fences-fire-fixtures.override.md (the Layer-3
    # escape hatch), so a consumer file dropped into that dir WITHOUT the override is removed
    # on refresh regardless of this loop. Keeps the gate strict where it must be: on
    # react-next the R12 fixture still ships, so R12 vanishing from the barrel still turns
    # the gate RED.
    #
    # Honour that SAME Layer-3 signal here: refresh_safe (setup.d/lib.sh) skips the whole
    # scripts/fences-fire-fixtures dir when scripts/fences-fire-fixtures.override.md is
    # present, so the prune below MUST respect the identical signal — else it deletes
    # framework fixtures inside a consumer-owned dir, contradicting do_refresh's printed
    # ".override.md preserved" guarantee (adversarial-review Important, post-#876). The
    # barrel regen above still always runs — it lives in eslint-rules-local/, not the owned
    # fixtures dir, and #876 requires it to stay in sync regardless of fixture ownership.
    if [ -e "$PROJECT_ROOT/scripts/fences-fire-fixtures.override.md" ]; then
      echo "  ⊝ scripts/fences-fire-fixtures prune skipped (.override.md — consumer-owned)"
    else
      for _m in "$PKG_ROOT"/packages/core/audit-self/fixtures/fences-fire/*.manifest.json; do
        [ -f "$_m" ] || continue
        _mstem="$(basename "$_m" .manifest.json)"
        _rid=$(sed -n 's/.*"rule-id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$_m" | head -1)
        _rkey="${_rid##*/}"
        [ -n "$_rkey" ] || continue
        if ! grep -q "'$_rkey':" "$_barrel"; then
          rm -f "$PROJECT_ROOT/scripts/fences-fire-fixtures/$_mstem".*
          echo "  · fences fixture [$_mstem] not shipped — rule '$_rkey' not in this stack's barrel"
        fi
      done
    fi
  fi
}

# ── #811 preset staleness guard (live-research-default-delivery, D4) ───────────
# Deps-free, no-network major-version drift WARN: a shipped preset is a frozen snapshot
# (preset.meta.json pins) that goes stale as the ecosystem moves. When the consumer's
# installed tool major differs from the preset's recorded major, surface a WARN steering
# them to live-research delivery. Reads package.json TEXT (deps may be uninstalled at
# install time — no module/require check). exit stays 0; --dry-run handled by the caller.

# _json_meta_major <preset.meta.json> <key>  — read a numeric pin from the meta "pins" block.
_json_meta_major() {
  grep -oE "\"$2\"[[:space:]]*:[[:space:]]*[0-9]+" "$1" 2>/dev/null | grep -oE '[0-9]+' | tail -1
}

# _pkg_major <package.json> <dep>  — leading integer of the dep's version range (^15.4.0 → 15).
# The `"dep":` anchor (closing quote before the colon) avoids matching `eslint-config-*` for
# the `eslint` key. Scans both dependencies + devDependencies (flat text grep).
_pkg_major() {
  local pj="$1" dep="$2" entry ver
  entry=$(grep -oE "\"${dep}\"[[:space:]]*:[[:space:]]*\"[^\"]+\"" "$pj" 2>/dev/null | head -1)
  [ -n "$entry" ] || return 1
  ver=$(printf '%s' "$entry" | grep -oE '"[^"]+"[[:space:]]*$' | tr -d '"')
  printf '%s' "$ver" | grep -oE '[0-9]+' | head -1
}

# warn_preset_staleness <preset.meta.json> <consumer package.json>
# Emits a WARN block (and returns 0) when ≥1 pinned tool major differs from the consumer's.
warn_preset_staleness() {
  local meta="$1" pj="$2" drift=0 out="" key pin cur snap
  [ -f "$meta" ] || return 0
  [ -f "$pj" ] || return 0
  for key in next eslint prettier typescript-eslint; do
    pin=$(_json_meta_major "$meta" "$key")
    [ -n "$pin" ] || continue
    cur=$(_pkg_major "$pj" "$key") || continue
    [ -n "$cur" ] || continue
    if [ "$cur" != "$pin" ]; then
      out="${out}     - ${key}: preset pinned to v${pin}, you are on v${cur}\n"
      drift=1
    fi
  done
  if [ "$drift" = "1" ]; then
    snap=$(grep -oE '"snapshotDate"[[:space:]]*:[[:space:]]*"[^"]+"' "$meta" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
    echo ""
    echo "⚠  This preset is a frozen Next-15 snapshot (${snap:-unknown}) — your installed tool majors differ:"
    printf '%b' "$out"
    echo "   Prefer live-research delivery for rules matching your current versions: run the rule-research"
    echo "   protocol (agents/rule-researcher.md / the rule-research skill), then ./setup --full. Presets"
    echo "   are the fallback baseline, not the source of truth."
  fi
}

# ── #827 B4: ensure the rule-factory's workspace deps (@rules-as-tests/*) resolve ──
# The factory CLI (packages/core/install/rule-bootstrap-cli.ts) imports @rules-as-tests/preset-*
# via packages/core/validator/gate-rule-tester.ts. When the framework checkout is a git worktree
# whose node_modules is BORROWED (symlinked) from a primary checkout on a DIVERGENT branch, those
# package links can dangle → the factory crashes (ERR_MODULE_NOT_FOUND) even though the worktree's
# OWN packages/ has them. This helper self-heals by linking each of the worktree's own workspace
# packages into a worktree-local node_modules/@rules-as-tests/. Idempotent; never writes THROUGH a
# borrowed (symlinked) node_modules (that would point a foreign checkout's deps at this worktree).
_workspace_pkg_resolves() {
  local _root="${1:-${PKG_ROOT:-.}}"
  ( cd "$_root" && node -e 'require.resolve("@rules-as-tests/preset-react-spa/eslint-rules")' ) >/dev/null 2>&1
}
ensure_workspace_pkg_links() {
  local _root="${1:-${PKG_ROOT:-.}}"
  command -v node >/dev/null 2>&1 || return 0
  _workspace_pkg_resolves "$_root" && return 0
  if [ -L "$_root/node_modules" ]; then
    echo "  · workspace-link self-heal: $_root/node_modules is a borrowed symlink and @rules-as-tests/* do not resolve;"
    echo "    run 'npm ci --prefix packages/core && npm install' in $_root to self-contain it."
    return 0
  fi
  local _nm="$_root/node_modules/@rules-as-tests"
  mkdir -p "$_nm" 2>/dev/null || return 0
  local _pkgdir _name
  for _pkgdir in "$_root"/packages/*/; do
    [ -f "${_pkgdir}package.json" ] || continue
    _name=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).name||"")' "${_pkgdir}package.json" 2>/dev/null)
    case "$_name" in
      @rules-as-tests/*) ln -sfn "${_pkgdir%/}" "$_nm/${_name#@rules-as-tests/}" 2>/dev/null || true ;;
    esac
  done
  _workspace_pkg_resolves "$_root" && echo "  · workspace-link self-heal: linked @rules-as-tests/* in $_nm (#827 B4)"
}

# reassert_husky_shields PKG_ROOT PROJECT_ROOT (GH #975)
# 50-hooks copies .husky/pre-{commit,push} + sets core.hooksPath BEFORE 70-deps. A consumer
# whose package.json declares a `prepare`-driven git-hooks manager (simple-git-hooks, or husky
# re-init) has that lifecycle FIRE during 70-deps' package-manager install — regenerating
# `.husky/` from ITS config and, having no pre-push entry, REMOVING the framework's
# `.husky/pre-push` (and replacing pre-commit). The framework push shield is then gone before
# self-verify runs. Re-assert the framework shields AFTER deps: force-overwrite each hook only
# when its content differs from the shipped template (idempotent), re-chmod, and re-pin
# core.hooksPath (a competing manager may have repointed it). Echoes an honest WARN naming the
# competing manager when it actually re-asserted (a FUTURE install may re-clobber). Callers gate
# this on DEPS_INSTALLED=1 (a --force/no-deps install never runs the prepare lifecycle).
reassert_husky_shields() {
  # NB: local is `fw_root`, NOT `pkg_root` — a `pkg_root` local is a case-variant of the
  # global PKG_ROOT and trips shellcheck 0.9.0 SC2153 on the pre-existing PKG_ROOT uses.
  local fw_root="$1" proj="$2"
  local reasserted=0 pair src dst
  for pair in \
    "packages/core/templates/shared/husky-pre-commit.sh:.husky/pre-commit" \
    "packages/core/templates/shared/husky-pre-push.sh:.husky/pre-push"; do
    src="$fw_root/${pair%%:*}"; dst="$proj/${pair##*:}"
    [ -f "$src" ] || continue
    if [ ! -f "$dst" ] || ! cmp -s "$src" "$dst"; then
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
      chmod +x "$dst" 2>/dev/null || true
      reasserted=1
    fi
  done
  git -C "$proj" config core.hooksPath .husky 2>/dev/null || true
  if [ "$reasserted" = "1" ]; then
    local mgr=""
    grep -q '"simple-git-hooks"' "$proj/package.json" 2>/dev/null && mgr="simple-git-hooks"
    echo "⚠  re-asserted framework .husky/pre-push + pre-commit after dep-install${mgr:+ (a competing \"$mgr\" prepare hook had clobbered them)} — a future package-manager install may re-clobber them; keep core.hooksPath=.husky or remove the competing manager's hooks. (GH #975)"
  fi
  return 0
}

# register_cc_hook SETTINGS EVENT CMD MARKER [MATCHER] (GH #934)
# Idempotently register a Claude Code hook in .claude/settings.json under EVENT
# (Stop / UserPromptSubmit / PostToolUse / …), NON-DESTRUCTIVELY: appends to any
# existing hooks on that event (never clobbers a consumer-authored hook), and no-ops
# when MARKER is already present (re-run adds nothing). Creates a minimal settings.json
# if absent. SSOT for the settings hooks-merge so install (setup.d) + refresh (do_refresh)
# share one implementation (dual-implementation-discipline §7). Requires jq for the
# JSON-safe merge (the shipped commands carry embedded quotes for $CLAUDE_PROJECT_DIR);
# degrades to explicit manual guidance when jq is absent — never a silent skip.
#
# Optional 5th arg MATCHER: for tool-scoped events (PreToolUse / PostToolUse) pass the
# tool-name matcher (e.g. "AskUserQuestion", "Edit|Write") so the entry gets a `matcher`
# field — parity with the framework's own settings.json shape. When MATCHER is empty
# (Stop / UserPromptSubmit — no tool scope) the entry is written matcher-less, byte-for-byte
# as before (the #1003 Stop path is unchanged).
register_cc_hook() {
  local settings="$1" event="$2" cmd="$3" marker="$4" matcher="${5:-}"
  if ! command -v jq >/dev/null 2>&1; then
    echo "  ⚠ jq not found — add manually to .claude/settings.json under \"$event\" a command hook running: $cmd"
    return 0
  fi
  # Build the single hook-group object once (with or without a matcher field) so the
  # create + append paths share one shape (no drift between the two branches).
  local group_filter
  if [ -n "$matcher" ]; then
    group_filter='{matcher:$m, hooks:[{"type":"command","command":$c}]}'
  else
    group_filter='{"hooks":[{"type":"command","command":$c}]}'
  fi
  if [ ! -f "$settings" ]; then
    jq -n --arg e "$event" --arg c "$cmd" --arg m "$matcher" \
      "{hooks: {(\$e): [$group_filter]}}" > "$settings"
    echo "  ✓ .claude/settings.json created with $event hook ($marker)"
  elif jq -e --arg e "$event" --arg m "$marker" \
      '((.hooks[$e] // []) | map(.hooks[].command) | any(test($m)))' "$settings" >/dev/null 2>&1; then
    # Idempotence is PER-EVENT (not whole-file): the same hook may register on two events
    # (e.g. inject-project-digest on UserPromptSubmit AND SubagentStart) — a whole-file grep
    # would false-match the first event's entry and skip the second. GH #934 batch D.
    echo "  ⊝ $marker already registered on $event in .claude/settings.json"
  else
    jq --arg e "$event" --arg c "$cmd" --arg m "$matcher" \
      ".hooks[\$e] = ((.hooks[\$e] // []) + [$group_filter])" \
      "$settings" > "$settings.tmp" && mv "$settings.tmp" "$settings"
    echo "  ✓ $marker registered as a $event hook in .claude/settings.json"
  fi
}

# ── O1 fix: INSTALL_SH_LIB_ONLY guard is LAST (after all helpers are defined) ──
# When sourced directly with INSTALL_SH_LIB_ONLY=1, expose all helpers and stop here.
# When sourced by install.sh, this guard fires and returns from the `source setup.d/lib.sh`
# call in install.sh — install.sh then checks its own guard (which also returns 0).
if [ "${INSTALL_SH_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi
