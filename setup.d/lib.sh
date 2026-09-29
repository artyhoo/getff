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
#   _pre_overwrite_guard <src> <dst> [transform] # W1-A (GH #1514/#1540) — divergence sweep before a
#                                              # destructive overwrite (copy_safe --force / tree replace)
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
#     exist. Observed leaking from .claude/skills/aif-doctor/SKILL.md:30.
# scripts/ is INTENTIONALLY UNHANDLED — partially shipped (subset via 40-configs.sh),
# per-file ambiguity is a §4 park trigger (kickoff getff-honest-signals-s2). Extend only with a
# shipped-scripts allowlist if a future scripts/ ref to a non-shipped script re-breaks a push.
#
# 2026-07-25 added the agent-shape `.claude/skills/` arm: agents/*.md live at repo root, so
# in-repo they reach skills via ](../.claude/skills/...); shipped to `<consumer>/.claude/agents/`
# that same ref resolves to `<consumer>/.claude/.claude/skills/...` — a doubled segment that
# does not exist (lychee-shipped-md-offline RED on agents/fidelity-auditor.md:22 → dispatcher). cite:historical incident record of the 2026-07-25 lychee RED
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
#     workflows/ only, no pull_request_template.md). Source: pipeline/SKILL.md:367.
# The last three are DELIBERATELY per-file, not blanket arms, because their parent directories
# are PARTIALLY shipped — a blanket arm would rewrite genuinely consumer-resolvable refs into
# blob URLs and lose in-repo navigability:
#   - `scripts/run-local-ci-sweep.sh` — this is the "shipped-scripts allowlist" the §park note
#     above anticipated ("Extend only with a shipped-scripts allowlist if a future scripts/ ref
#     to a non-shipped script re-breaks a push"). It re-broke the push; scripts/ IS partially
#     shipped, so only the proven-absent file is rewritten. Source: harvest/SKILL.md:21,23.
#   - `hooks/check-worker-dispatch-channel.sh` — `.claude/hooks/` IS shipped and most hook refs
#     resolve fine (transform-internal-refs.test.sh #5 asserts `](../../hooks/…)` stays intact),
#     so only this one absent hook is rewritten. Source: pipeline/SKILL.md:389.
# A fourth candidate was REJECTED rather than allowlisted: `](../reviewer/SKILL.md)` from
# arch/SKILL.md:110 also dangled, but rewriting it would have papered over the real defect. The
# sibling-skill shape is supposed to stay relative — «sibling-skill links stay relative (sibling
# ships too)», 10-skills.sh:137 — so a dangling sibling ref means the SIBLING IS MISSING, not
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
# NOT a delivery verb: it applies no ownership policy of its own — no skip-if-exists, no `.override.md`
# escape. Callers that owe the consumer an ownership decision go through copy_safe / refresh_safe /
# refresh_tree_with_transform; this helper is only the raw sequence those verbs and the fresh-install
# layers share. What it DOES owe (GH #1540, W1-A D4(a)): a read-side divergence pass before the wipe
# — the bare `rm -rf` it replaced destroyed a consumer-edited skill tree with no warning, no
# preserved copy and no baseline staging, which is exactly the issue-1481 defect class for the one
# payload shape the R1 guard never reached. The pass is policy-free in the Layer-3 sense only: an
# `.override.md` escape stays the CALLER's decision (refresh_skill_with_transform checks it before
# calling here; the install arm's skip-if-exists is likewise upstream).
_copy_tree_with_transform() {
  local src="$1" dst="$2"
  [ -d "$src" ] || return 0
  # GH #1540 (W1-A D4(a)/(c)): before wiping an existing tree, route every dst file through the
  # pre-overwrite divergence decision (setup.d/lib.sh, _pre_overwrite_guard): baseline entry
  # present + diverged → per-file ⚠ + preserved copy; no entry + diverged from the incoming
  # bytes → silent preserve, one aggregate line per run. `transform` makes the *.md comparison
  # run against the TRANSFORMED source — the bytes this helper is about to write, not the raw
  # repo bytes (see _pre_overwrite_guard). Read-only under --dry-run (callers gate it; the
  # wrapper verbs run it themselves in their dry-run preview arms).
  _pre_overwrite_guard "$src" "$dst" transform
  rm -rf "$dst"
  mkdir -p "$(dirname "$dst")"
  cp -r "$src" "$dst"
  _transform_md_tree "$dst"
  # R1 (W1-A, GH #1540): stage the freshly delivered tree so the NEXT refresh finds baseline
  # entries for it. Without this, skill trees stayed «unknown» forever and the no-entry arm was
  # their only guard — the gap INSTALL-FOR-AI.md:482 used to document for skill dirs — cite:historical — quoted wording rewritten in place by the W2-E per-path refresh truth
  # (the gap itself was closed on the code side in critical-review wave 1 — see _preserve_unbaselined_copy).
  refresh_baseline_stage "$dst"
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
# SCOPE: copy_safe/refresh_safe deliveries, PLUS (W1-A, GH #1514/#1540) the destructive-overwrite
# arms — copy_safe's --force write and the _copy_tree_with_transform tree replace (skills/* trees,
# the runtime-bridge vendor tree) — which now run the same per-file baseline decision via
# _pre_overwrite_guard before destroying bytes. Outside the mechanism: merge_fenced (section-scoped
# co-ownership replaces only the fenced body, so a whole-file baseline entry cannot apply) and the
# raw-cp vendor hook drop (single idempotent file, W-RI-1: generic, no special-casing of any pair
# entry).
REFRESH_BASELINE_STAGED=()
# Paths staged WEAKLY: recorded only if the manifest has no entry for them yet (ledger A1-2).
# copy_safe's skip-if-exists path uses this — a skipped file's bytes are evidence of what was
# delivered ONLY when nothing better is on record. Recording them strongly would let a consumer's
# own edit become the baseline on any plain re-install, which silences the guard for exactly the
# file the consumer cares about.
REFRESH_BASELINE_STAGED_WEAK=()
REFRESH_BASELINE_NOTE_SHOWN=""
# consumer-delivery-safety (W1-A D4(c), GH #1514/#1540): counters for the no-entry arm of the
# pre-overwrite guard — diverged files with NO baseline entry that a destructive overwrite
# preserved under .ai-factory/refresh-conflicts/. Reported as ONE aggregate line per run
# (_report_unbaselined_preserves, called from refresh_baseline_flush); NEVER per file.
REFRESH_CONFLICTS_UNBASELINED=0
REFRESH_CONFLICTS_UNBASELINED_FAILED=0
REFRESH_CONFLICTS_UNBASELINED_REPORTED=""

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

# refresh_baseline_stage_weak_matching <src> <dst> — record a dst that this run did NOT write but
# found already in place (copy_safe's skip path). Same path-only, hash-at-flush contract; the flush
# lets any existing manifest entry win over these (ledger A1-2 — see REFRESH_BASELINE_STAGED_WEAK
# above). Limited to bytes getff itself delivered (critical-review S2-1/S2-2). A skipped dst is
# staged only where it is byte-identical to the incoming src: a FILE when `cmp` matches; a DIRECTORY file by file,
# each only when the same relative path under src matches. Anything else on disk is either the
# consumer's own file (it pre-dated the install) or a consumer edit — staging it made those bytes
# the «pristine framework» baseline, so `--force` overwrote them without a preserved copy and
# `--refresh` deleted consumer-added files inside a delivered directory as framework residue.
# Unstaged = no manifest entry = «unknown»: every overwrite path then preserves a diverged copy
# (_preserve_unbaselined_copy — copy_safe --force, _copy_tree_with_transform, and _refresh_one_file).
# Optional 3rd arg = copy_safe's parity mode: a post-processed delivery (md-refs / arch-header /
# stryker-pm / vitest-layout) is compared against the post-processed bytes, via the same _expected_* helpers the
# --force guard uses — the raw src never matches those, and they would silently drop out of the
# A1-2 manifest rebuild.
refresh_baseline_stage_weak_matching() {
  local src="$1" dst="$2" mode="${3:-}" f rel expected tmpexp=""
  if [ "${DRY_RUN:-}" = "--dry-run" ]; then return 0; fi
  if [ -f "$dst" ] && [ -f "$src" ]; then
    expected="$src"
    case "$mode" in
      md-refs)     if tmpexp=$(_expected_transformed "$src"); then expected="$tmpexp"; fi ;;
      arch-header) if tmpexp=$(_expected_arch_header "$src"); then expected="$tmpexp"; fi ;;
      stryker-pm)  if tmpexp=$(_expected_stryker_pm "$src"); then expected="$tmpexp"; fi ;;
      vitest-layout) if tmpexp=$(_expected_vitest_layout "$src"); then expected="$tmpexp"; fi ;;
    esac
    if cmp -s "$expected" "$dst"; then REFRESH_BASELINE_STAGED_WEAK+=("$dst"); fi
    if [ -n "$tmpexp" ]; then rm -f "$tmpexp"; fi
  elif [ -d "$dst" ] && [ -d "$src" ]; then
    while IFS= read -r -d '' f; do
      rel="${f#"$dst"/}"
      if [ -f "$src/$rel" ] && cmp -s "$src/$rel" "$f"; then
        REFRESH_BASELINE_STAGED_WEAK+=("$f")
      fi
    done < <(find "$dst" -type f -print0 2>/dev/null)
  fi
  return 0
}

# getff_delivered <abs-dst> — exit 0 IFF getff itself delivered <abs-dst>: this run staged it (a
# copy_safe write, or a skip whose bytes ARE the incoming delivery) or the baseline manifest of an
# earlier install holds an entry for it. Anything else is the consumer's own file (copy_safe kept
# it): a post-processor may only ADD getff's block to a consumer eslint config, keeping the original
# (Q4.7, 2026-09-28; setup.d/99-finalize.sh), and leaves any other tool config alone. Provenance, not
# content: getff's react-native eslint config carries no RULE_GLOBS block, a consumer's may carry
# one. A pre-manifest re-install of an edited getff file reads as the consumer's — the safe side.
getff_delivered() {
  local dst="$1" p manifest
  for p in ${REFRESH_BASELINE_STAGED[@]+"${REFRESH_BASELINE_STAGED[@]}"} \
    ${REFRESH_BASELINE_STAGED_WEAK[@]+"${REFRESH_BASELINE_STAGED_WEAK[@]}"}; do
    [ "$p" = "$dst" ] && return 0
  done
  manifest=$(_refresh_baseline_manifest)
  [ -f "$manifest" ] && command -v jq >/dev/null 2>&1 || return 1
  jq -e --arg k "${dst#"${PROJECT_ROOT:-.}"/}" 'has($k)' "$manifest" >/dev/null 2>&1
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

# ── consumer-delivery-safety (W1-A, GH #1514 + #1540): pre-overwrite divergence guard ────────
# The R1 guard above covers the refresh path only (refresh_safe → _refresh_one_file). Two
# destructive-overwrite paths had NO read-side check at all:
#   - copy_safe's --force arm fell straight through to the copy (issue 1514: even a
#     manifest-PRESENT diverged file was clobbered silently — the force arm never read the
#     baseline), and
#   - _copy_tree_with_transform did a bare rm -rf (issue 1540: skill trees, no guard by
#     construction, "cannot distinguish" was literally true for them).
# Both now consult the same baseline BEFORE destroying bytes, with one policy (kickoff D4):
#   entry-present + diverged  → per-file ⚠ + preserved copy, the SAME shape as the refresh
#                               guard (refresh_baseline_diverged + _preserve_diverged_copy);
#   entry-absent  + diverged from the incoming bytes → preserve SILENTLY at file level, ONE
#                               aggregate line per run (D4(c) — see _preserve_unbaselined_copy
#                               for the declared supersession of closed #1512's RI-2).

# _preserve_unbaselined_copy <dst-file> — the D4(c) no-entry arm of the pre-overwrite guard.
#
# SUPERSEDES — declared, not glossed — the RI-2 decision of closed #1512, and ONLY on the
# destructive-overwrite paths (copy_safe --force, _copy_tree_with_transform). RI-2 ratified
# "no manifest entry = unknown provenance = today's behaviour" AND explicitly rejected
# warn-on-first-touch, to avoid per-file spam on pre-manifest consumers at their first
# refresh. That no-spam contract SURVIVES here intact: this arm never prints a per-file line.
# What is superseded is the silent DATA LOSS RI-2 accepted alongside it: when the bytes are
# about to be destroyed (not merely overwritten-after-comparison, as on the refresh path),
# the diverged copy is preserved aside and ONE aggregate line per run reports the count.
# The refresh path (_refresh_one_file) joined this arm in critical-review wave 1: once weak
# staging stopped baselining consumer bytes (S2-1/S2-2), every pre-existing consumer file is
# no-entry, and RI-2's silent overwrite there was the same data loss.
# Fail-open: a copy that cannot be made is counted as failed and named in the same single
# aggregate line (_report_unbaselined_preserves); it never fails the delivery.
_preserve_unbaselined_copy() {
  local dst="$1" conflicts sum8
  if [ "${DRY_RUN:-}" = "--dry-run" ]; then
    REFRESH_CONFLICTS_UNBASELINED=$((REFRESH_CONFLICTS_UNBASELINED + 1))
    return 0
  fi
  conflicts="${PROJECT_ROOT:-.}/.ai-factory/refresh-conflicts"
  if sum8=$(_hash256 "$dst") \
    && mkdir -p "$conflicts" 2>/dev/null \
    && cp "$dst" "$conflicts/$(basename "$dst").${sum8:0:8}" 2>/dev/null; then
    REFRESH_CONFLICTS_UNBASELINED=$((REFRESH_CONFLICTS_UNBASELINED + 1))
  else
    REFRESH_CONFLICTS_UNBASELINED_FAILED=$((REFRESH_CONFLICTS_UNBASELINED_FAILED + 1))
  fi
  return 0
}

# _report_unbaselined_preserves — the ONE aggregate line per run for the D4(c) arm. Called at the
# top of refresh_baseline_flush, which every installer exit path reaches (explicit calls + the
# EXIT trap), so it prints at most once per run however the installer ends. Not a per-file ⚠:
# the RI-2 no-spam contract (closed #1512) survives on this arm — only the silent loss is gone.
_report_unbaselined_preserves() {
  if [ "${REFRESH_CONFLICTS_UNBASELINED_REPORTED:-}" = "1" ]; then return 0; fi
  local n="${REFRESH_CONFLICTS_UNBASELINED:-0}" m="${REFRESH_CONFLICTS_UNBASELINED_FAILED:-0}"
  { [ "$n" -gt 0 ] || [ "$m" -gt 0 ]; } || return 0
  local fail_note=""
  if [ "$m" -gt 0 ]; then fail_note="; $m could not be copied"; fi
  if [ "${DRY_RUN:-}" = "--dry-run" ]; then
    echo "  [dry-run] would preserve $n unbaselined diverged file(s) under ${PROJECT_ROOT:-.}/.ai-factory/refresh-conflicts/"
  else
    echo "  · preserved $n unbaselined diverged file(s) under ${PROJECT_ROOT:-.}/.ai-factory/refresh-conflicts/ (no refresh-baseline entry — provenance unknown; copies kept, upstream versions installed${fail_note})"
  fi
  REFRESH_CONFLICTS_UNBASELINED_REPORTED=1
  return 0
}

# _expected_post <src-file> <fn> — echo a TEMP file path holding <fn> applied to a copy of
# <src-file> (the bytes a delivery that post-processes with <fn> would leave on disk). The caller
# MUST rm the temp. Fails (rc 1) if mktemp/cp fails; the caller then falls back to the raw src
# bytes for the comparison. Shared base for the per-post-processor expectations below — the
# reconstruction must use the SAME function the delivery pipeline runs, or the parity is fiction.
_expected_post() {
  local t
  t=$(mktemp) || return 1
  if ! cp "$1" "$t" 2>/dev/null; then rm -f "$t"; return 1; fi
  "$2" "$t" || true
  printf '%s\n' "$t"
}

# _expected_transformed <src-md-file> — transform_internal_refs variant, for *.md whose delivery
# post-processes repo-internal refs → upstream blob URLs (skill trees, agents). transform_internal_refs
# is idempotent and deterministic, so bytes(transform(src)) == what the previous install wrote for an
# unedited file, which is what makes this comparison exact rather than heuristic.
_expected_transformed() {
  _expected_post "$1" transform_internal_refs
}

# _expected_arch_header <src-file> — rewrite_arch_sot_header variant, for the materialized
# .ai-factory/ARCHITECTURE.md copy_safe delivery (30-templates.sh / install.sh do_refresh / the
# python lane) whose first line the rewrite post-processes. W1-A review MAJOR 1: without this
# candidate a pristine materialized ARCHITECTURE.md false-flagged as consumer-diverged on every
# pre-manifest force run.
_expected_arch_header() {
  _expected_post "$1" _rewrite_arch_sot_header_inplace
}

# _expected_stryker_pm <src-file> — patch_stryker_package_manager variant, for the
# stryker.config.json copy_safe deliveries (setup.d/40-configs.sh, 4 stack lanes) whose
# packageManager value the patch post-processes. Byte-changing on pnpm/yarn consumers only, so
# without this candidate a pristine patched config false-flagged as consumer-diverged there.
_expected_stryker_pm() {
  _expected_post "$1" _patch_stryker_package_manager_inplace
}

# _expected_vitest_layout <src-file> — rewrite_vitest_source_roots variant, for the
# vitest.config.ts copy_safe deliveries (setup.d/40-configs.sh, 4 stack lanes) whose `src/**/`
# globs the rewrite anchors on the project's own source roots. Byte-changing on projects without
# src/ only, so without this candidate a pristine rewritten config false-flagged as
# consumer-diverged on a pre-manifest force run and never re-entered a rebuilt manifest.
_expected_vitest_layout() {
  _expected_post "$1" _rewrite_vitest_source_roots_inplace
}

# _prettierignore_pristine <src> <dst> — exit 0 IFF <dst> is the shipped .prettierignore <src>
# plus ONLY the framework's managed marker blocks (merge_prettierignore's AIF block and
# ignore_shipped_configs' shipped-configs block, both marker-delimited and appended after the
# copy_safe delivery). Such a file is a pristine delivery, not a consumer edit — the raw-src
# comparison in the guard cannot see the appended blocks (W1-A review MAJOR 1: .prettierignore was
# one of the 8 false positives), so merge_prettierignore's --force arm checks this itself and
# suppresses the no-entry claim when it holds.
_prettierignore_pristine() {
  local src="$1" dst="$2" t want
  t=$(mktemp) || return 1
  if ! cp "$dst" "$t" 2>/dev/null; then rm -f "$t"; return 1; fi
  # Strip both managed blocks (marker line … marker line, inclusive). Pure read-loop rewrite:
  # bash-3.2/BSD-tool safe, no sed path escaping.
  local out="${t}.stripped" line in_block=""
  : > "$out"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "$PRETTIERIGNORE_BEGIN"|"$PRETTIERIGNORE_CFG_BEGIN") in_block=1 ;;
      "$PRETTIERIGNORE_END"|"$PRETTIERIGNORE_CFG_END") in_block=""; continue ;;
    esac
    [ -n "$in_block" ] || printf '%s\n' "$line" >> "$out"
  done < "$t"
  want=$(_hash256 "$src") || { rm -f "$t" "$out"; return 1; }
  if [ "$(_hash256 "$out")" = "$want" ]; then
    rm -f "$t" "$out"
    return 0
  fi
  rm -f "$t" "$out"
  return 1
}

# _pre_overwrite_divergence_action <dst-file> <expected-file-or-empty> [suppress-no-entry]
# ONE per-file decision for the destructive-overwrite paths. <expected> is the file whose bytes
# this delivery is about to write at <dst> ("" when the incoming payload no longer ships that
# path) — for post-processed deliveries the CALLER passes the reconstructed final bytes via the
# guard's parity mode (see _pre_overwrite_guard). <suppress-no-entry> (W1-A review MAJOR 1):
# skip the no-entry arm entirely — for a caller that has itself proven the on-disk bytes pristine
# modulo framework-managed content the raw comparison cannot see (merge_prettierignore's marker
# blocks); the entry-present arm still fires. Exit 0 = action taken (preserved copy made / dry-run
# would-flag printed); exit 1 = no action (pristine delivery, bytes already identical, dst not a
# readable file — fail-open, same contract as the R1 guard). Like refresh_baseline_diverged, call
# it inside an `if` — its non-zero is a verdict, and lib.sh runs under set -euo pipefail.
_pre_overwrite_divergence_action() {
  local dst="$1" expected="$2" suppress="${3:-}" entry cur exp_hash
  [ -f "$dst" ] || return 1
  cur=$(_hash256 "$dst") || return 1
  _refresh_baseline_lookup "$dst"
  entry="$REFRESH_BASELINE_ENTRY"
  if [ -n "$entry" ]; then
    # Entry present: the framework can attribute the file, so the divergence claim is loud
    # (D4(a)/(b) — same shape as the refresh guard).
    if [ "$cur" = "$entry" ]; then return 1; fi   # pristine framework delivery — ours to replace
    if [ -n "$expected" ] && [ -f "$expected" ]; then
      # D4(b): reuse the R1 verdict verbatim — diverged = differs from BOTH the manifest entry
      # and the incoming bytes (cur != entry is already established above, so this call adds
      # exactly the src comparison).
      if refresh_baseline_diverged "$dst" "$expected"; then
        if [ "${DRY_RUN:-}" = "--dry-run" ]; then
          echo "  [dry-run] would-flag: $dst (locally modified)"
        else
          _preserve_diverged_copy "$dst"
        fi
        return 0
      fi
      return 1   # already byte-identical to the incoming version — overwriting loses nothing
    fi
    # Entry present, bytes differ, and the incoming payload no longer ships this path: the
    # consumer's edit is about to be destroyed with no src to compare against. The R1 helper
    # cannot take this case (its src hash is unconditional), so any difference from the
    # recorded delivery is divergence here.
    if [ "${DRY_RUN:-}" = "--dry-run" ]; then
      echo "  [dry-run] would-flag: $dst (locally modified)"
    else
      _preserve_diverged_copy "$dst"
    fi
    return 0
  fi
  # No entry (D4(c) — supersedes RI-2 on this path, see _preserve_unbaselined_copy): diverged
  # from the incoming bytes → silent preserve + the aggregate line. Files the incoming payload
  # no longer ships (<expected> empty) always take this arm — they have no incoming bytes to
  # match, and the wipe is about to destroy them. Suppressed when the caller proved the bytes
  # pristine modulo framework-managed content it owns (W1-A review MAJOR 1).
  if [ -n "$suppress" ]; then return 1; fi
  if [ -n "$expected" ] && [ -f "$expected" ]; then
    exp_hash=$(_hash256 "$expected") || exp_hash=""
    if [ "$cur" = "$exp_hash" ]; then return 1; fi
  fi
  _preserve_unbaselined_copy "$dst"
  return 0
}

# _pre_overwrite_guard <src> <dst> [mode]
# Read-side divergence sweep BEFORE a destructive overwrite: copy_safe's --force arm (GH #1514)
# and _copy_tree_with_transform (GH #1540). Walks every regular file under <dst> (or the single
# file when dst is one) and routes it through _pre_overwrite_divergence_action with the incoming
# counterpart (<src>/<rel>) as <expected>. Under --dry-run nothing is written: entry-present
# divergence prints `would-flag` (same vocabulary as _refresh_one_file) and the no-entry arm
# only bumps the aggregate would-preserve counter.
#
# MODE — the shape of the DELIVERED bytes (W1-A review MAJOR 1: the no-entry arm compares the
# on-disk bytes against what the delivery pipeline writes; for deliveries that POST-PROCESS the
# dst after copy_safe, the raw src is NOT those bytes and a pristine copy false-flags —
# review-proven: 8 pristine files preserved out of 10 claims on a pre-manifest force run):
#   "" (default)     plain delivery: delivered bytes == src (hooks, configs, templates).
#   transform        TREE replace whose *.md are post-processed by transform_internal_refs
#                    (_copy_tree_with_transform, copy_skill/refresh_skill dry-run previews).
#   md-refs          single FILE post-processed by transform_internal_refs (agents, 20-agents.sh).
#   arch-header      single FILE post-processed by rewrite_arch_sot_header (the materialized
#                    .ai-factory/ARCHITECTURE.md, 30-templates.sh + install.sh do_refresh + the
#                    python lane's ARCHITECTURE.md, 45-python.sh).
#   stryker-pm       single FILE post-processed by patch_stryker_package_manager (the copied
#                    stryker.config.json, 40-configs.sh — 4 stack lanes).
#   vitest-layout    single FILE post-processed by rewrite_vitest_source_roots (the copied
#                    vitest.config.ts, 40-configs.sh — 4 stack lanes).
#   suppress-no-entry  caller proved the dst pristine modulo framework-managed content the raw
#                    comparison cannot see (merge_prettierignore's marker blocks): no-entry arm
#                    suppressed, entry-present arm still active.
# A mode naming a file post-processor has no meaning for a DIRECTORY dst (no such call site);
# the walk then compares per file against the raw src.
#
# POST-MUTATING CALLER CENSUS (closed — every copy_safe caller that post-processes its dst now
# declares a parity mode, so no pristine delivery can take the no-entry arm). CENSUS-BEGIN — the
# rows below are GATED: arm 5d of tests/install-sh/consumer-delivery-safety-guard.test.sh parses
# this block and fails unless each cited line really holds a copy_safe carrying the declared mode.
# Without that gate the coordinates would rot on the first line insertion and nothing would say so
# — scripts/check-line-citations.mjs only reads *.md, so a path:NN in a shell comment is ungated by
# construction (fidelity round 1 caught exactly that here: all 8 numbers were pre-edit and one
# landed on an unrelated unparitied playwright delivery).
#   setup.d/20-agents.sh:51            transform_internal_refs      → md-refs
#   setup.d/30-templates.sh:85         rewrite_arch_sot_header      → arch-header
#   install.sh:1412                    rewrite_arch_sot_header      → arch-header
#   setup.d/45-python.sh:197           transform_internal_refs      → md-refs
#   setup.d/45-python.sh:1506          rewrite_arch_sot_header      → arch-header
#   setup.d/40-configs.sh:476          patch_stryker_package_manager → stryker-pm
#   setup.d/40-configs.sh:502          patch_stryker_package_manager → stryker-pm
#   setup.d/40-configs.sh:523          patch_stryker_package_manager → stryker-pm
#   setup.d/40-configs.sh:551          patch_stryker_package_manager → stryker-pm
#   setup.d/40-configs.sh:466          rewrite_vitest_source_roots  → vitest-layout
#   setup.d/40-configs.sh:491          rewrite_vitest_source_roots  → vitest-layout
#   setup.d/40-configs.sh:511          rewrite_vitest_source_roots  → vitest-layout
#   setup.d/40-configs.sh:542          rewrite_vitest_source_roots  → vitest-layout
#   setup.d/lib.sh:1864                appended marker blocks       → suppress-no-entry (proved)
# CENSUS-END
# Reach of the two gates, stated so neither is mistaken for more than it is. Arm 5d checks this
# block against the code (rows → real call sites). Arm 5c checks the other direction (call sites →
# declared mode) by scanning `copy_safe ` lines in install.sh + setup.d/*.sh for one of four
# post-processor NAMES within 3 lines of the call — a spelling-bounded scan, so it cannot see a
# caller inside lib.sh itself (merge_prettierignore, wired by hand and covered by arm 5d), a
# mutation further than 3 lines from its call, a post-processor added under a new name, or a
# delivery routed through _lane_copy_or_refresh. Verified today, not assumed: the cargo and go
# lanes post-mutate nothing (`grep -n 'transform_internal_refs \|rewrite_arch_sot_header \
# |patch_stryker_package_manager' setup.d/46-cargo.sh setup.d/47-go.sh` → empty).
# The earlier revision of this comment declared the last two rows out of bounds and claimed each
# was "a one-line parity arg"; the stryker row was NOT (patch_stryker_package_manager took no
# argument and mutated $PROJECT_ROOT/stryker.config.json in place), so it needed the same in-place
# helper extraction as arch-header. Both rows are now wired and the claim is retired rather than
# left standing (review round 2).
#
# SCOPE GUARD: runs only when dst sits INSIDE $PROJECT_ROOT. The conflicts dir and the baseline
# manifest are PROJECT_ROOT-scoped state (manifest keys are dst paths relative to PROJECT_ROOT);
# a destination outside the consumer root cannot be recorded there — and unit tests exercise
# copy_safe against scratch paths deliberately outside PROJECT_ROOT.
_pre_overwrite_guard() {
  local src="$1" dst="$2" mode="${3:-}"
  case "$dst" in
    "${PROJECT_ROOT:-.}"/*) ;;
    *) return 0 ;;
  esac
  [ -e "$dst" ] || return 0
  local f rel expected tmpexp suppress
  if [ ! -d "$dst" ]; then
    expected=""
    tmpexp=""
    suppress=""
    if [ -f "$src" ]; then
      expected="$src"
      case "$mode" in
        md-refs)
          if tmpexp=$(_expected_transformed "$src"); then expected="$tmpexp"; fi ;;
        arch-header)
          if tmpexp=$(_expected_arch_header "$src"); then expected="$tmpexp"; fi ;;
        stryker-pm)
          if tmpexp=$(_expected_stryker_pm "$src"); then expected="$tmpexp"; fi ;;
        vitest-layout)
          if tmpexp=$(_expected_vitest_layout "$src"); then expected="$tmpexp"; fi ;;
      esac
    fi
    if [ "$mode" = "suppress-no-entry" ]; then suppress="1"; fi
    if _pre_overwrite_divergence_action "$dst" "$expected" "$suppress"; then :; fi
    if [ -n "$tmpexp" ]; then rm -f "$tmpexp"; fi
    return 0
  fi
  while IFS= read -r -d '' f; do
    rel="${f#"$dst"/}"
    expected=""
    tmpexp=""
    if [ -f "$src/$rel" ]; then
      expected="$src/$rel"
      if [ "$mode" = "transform" ]; then
        case "$rel" in
          *.md)
            if tmpexp=$(_expected_transformed "$src/$rel"); then
              expected="$tmpexp"
            fi ;;
        esac
      fi
    fi
    if _pre_overwrite_divergence_action "$f" "$expected"; then :; fi
    if [ -n "$tmpexp" ]; then rm -f "$tmpexp"; fi
  done < <(find "$dst" -type f -print0 2>/dev/null)
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
  # W1-A D4(c): the ONE aggregate line for unbaselined diverged files preserved by this run's
  # destructive overwrites. First, before every early return below (dry-run, nothing staged):
  # flush is reached on every installer exit path, which is what makes this line once-per-run.
  _report_unbaselined_preserves
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
  # W1-A review MAJOR 1 (parity): optional 3rd arg declaring the SHAPE OF THE DELIVERED BYTES
  # for deliveries whose caller POST-PROCESSES the dst after copy_safe returns — the no-entry
  # arm of the force guard compares against the delivered bytes, and the raw src is NOT those
  # bytes (review-proven: pristine transformed agents / header-rewritten ARCHITECTURE.md /
  # block-appended .prettierignore copies false-flagged as consumer-diverged). Values map 1:1
  # to _pre_overwrite_guard modes: md-refs | arch-header | stryker-pm | vitest-layout |
  # suppress-no-entry. The
  # census of every post-mutating caller lives at _pre_overwrite_guard. Plain deliveries
  # (the vast majority) pass nothing and compare against the raw src.
  local parity="${3:-}"

  if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
    SKIPPED+=("$dst")
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: $dst (exists)"
    else
      echo "  ⊝ $dst (exists — skipping)"
      # A1-2: this early return used to precede the staging call, so an install whose deliveries
      # were all skips staged NOTHING — and after any install that never reached its flush (the
      # 99-finalize `exit 1` on a deps-incomplete --full), no later re-run could ever rebuild the
      # manifest. Staged WEAKLY: fills a hole, never overwrites an entry a real delivery made,
      # so a consumer edit sitting on disk at re-install time cannot become its own baseline.
      # critical-review S2-1/S2-2: and only where the bytes on disk ARE the incoming delivery — a
      # consumer's own pre-existing file must never become the framework baseline.
      refresh_baseline_stage_weak_matching "$src" "$dst" "$parity"
    fi
    return 0
  fi

  # consumer-delivery-safety (GH #1514, W1-A D4(b)/(c)): the --force arm used to fall straight
  # through to the copy with NO read-side check — the exists-guard above fires only WITHOUT
  # --force, so a locally-edited force-deliverable file was overwritten with upstream bytes,
  # silently, even when the baseline manifest held an entry for it. Probe the baseline BEFORE
  # the write: entry-present + diverged → per-file ⚠ + preserved copy (same shape as the
  # refresh guard); no entry + diverged from the incoming bytes → silent preserve, one
  # aggregate line per run. Read-only under --dry-run (would-flag / would-preserve counts).
  if [ "$FORCE" = "--force" ] && [ -e "$dst" ]; then
    _pre_overwrite_guard "$src" "$dst" "$parity"
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
  # A1-9d: the ✓ and the baseline staging must follow THIS copy's exit code, not the ambient
  # set -e. install.sh's set -e used to be the only thing keeping the ✓ honest — in any
  # set -e-EXEMPT caller (`copy_safe … || true`, `if copy_safe …`, or the existing
  # `[ -f … ] && copy_safe …` guards in 10-skills.sh / 40-configs.sh / install.sh) a failed cp
  # still printed ✓ and staged a refresh-baseline hash for a file that never landed, which the
  # next --refresh then reported as «kept».
  if cp -r "$src" "$dst"; then
    echo "  ✓ $dst"
    refresh_baseline_stage "$dst"   # R1: record the delivery for the baseline flush
  else
    echo "  ⚠ copy failed: $src → $dst — nothing delivered at $dst, install continues without it" >&2
    rm -rf "$dst"   # an interrupted cp can leave a partial destination — do not leave it behind
    return 0        # fail-open, same contract as A1-9 (#1643) and A1-9b/c (#1645)
  fi
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
# Malformed fence (a begin marker with no matching end, or two begin markers) → LOUD refuse + skip.
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
  if _merge_fenced_locate "$dst" "$begin" "$end_tok"; then   # whole marker lines only (see helper)
    if [ -n "$MERGE_FENCED_PROBLEM" ]; then
      echo "  ⚠ $dst: $MERGE_FENCED_PROBLEM — REFUSING to splice" >&2
      echo "    ($MERGE_FENCED_HINT)" >&2
      SKIPPED+=("$dst")
      return 0
    fi
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would replace fenced section=$section in: $dst"
      return 0
    fi
    # ledger A1-8: `awk … > "$tmp" && mv …` followed by an unconditional success echo had
    # two silent-corruption paths. (1) awk or the redirect fails → `&&` skips the mv, the old
    # body survives, the half-written tmp is left in the consumer tree, and the installer
    # still prints `✓ … replaced`. (2) $src is present but unreadable → awk's
    # `getline line < SRC` returns -1 WITHOUT failing the program (measured on macOS awk;
    # POSIX permits it anywhere), so the consumer's fenced section is replaced with an empty
    # body under that same `✓`. The `-r` probe closes (2); the if/else closes (1).
    local tmp="${dst}.getff.tmp"
    if [ ! -r "$src" ]; then
      echo "  ⚠ $dst: source $src is not readable — REFUSING to splice section=$section" >&2
      echo "    (an unreadable source would empty the fenced body without failing awk)" >&2
      SKIPPED+=("$dst")
      return 0
    fi
    local _splice_ok=1
    # B/E = the whole-line marker positions _merge_fenced_locate found (never a quoted marker).
    # A caller that proved the old body is its own shipped text sets MERGE_FENCED_SHIPPED_BODY=1.
    if ! awk -v B="$MERGE_FENCED_BEGIN_LINE" -v E="$MERGE_FENCED_END_LINE" -v SRC="$src" '
      NR == B {
        print                                     # keep the begin marker verbatim
        print ""                                  # blank lines around the body: Prettier treats an
        while ((getline line < SRC) > 0) print line
        close(SRC)
        print ""                                  # HTML comment glued to a heading as unformatted
        next
      }
      NR > B && NR < E { next }                   # drop the previous body
      { print }                                   # the end marker and everything after it
    ' "$dst" > "$tmp"; then
      _splice_ok=0
    elif [ "${MERGE_FENCED_SHIPPED_BODY:-0}" != 1 ] && ! cmp -s "$tmp" "$dst"; then
      # critical-review S2-3: the replaced body may hold the consumer's own in-fence edits —
      # keep the previous bytes before they are gone (a no-op re-run never reaches here).
      _merge_fenced_keep_copy "$dst" "fenced section=$section refreshed"
    fi
    if [ "$_splice_ok" = "0" ] || ! mv "$tmp" "$dst"; then
      rm -f "$tmp" 2>/dev/null || true
      echo "  ⚠ $dst: fenced splice failed (awk or write error) — left unchanged, section=$section" >&2
      SKIPPED+=("$dst")
      return 0
    fi
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
    # critical-review S2-3: the sentinels prove the file STARTED as our template, not that it
    # still is one — a consumer who extended it would lose every addition. Keep their bytes first.
    if ! cmp -s "$src" "$dst"; then
      _merge_fenced_keep_copy "$dst" "pre-fence copy differs from the current template"
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

# _merge_fenced_keep_copy <dst> <why> — keep the co-owned file's bytes before merge_fenced
# replaces part of it with bytes the consumer may have written (critical-review S2-3). Same
# location and naming as the refresh guard (_preserve_diverged_copy); merge_fenced sits outside
# the baseline manifest, so it cannot tell a consumer edit from an older template and keeps a
# copy whenever the replaced bytes differ. Fail-open: a failed copy changes only the message.
_merge_fenced_keep_copy() {
  local dst="$1" why="$2" conflicts sum8 kept
  conflicts="${PROJECT_ROOT:-.}/.ai-factory/refresh-conflicts"
  if sum8=$(_hash256 "$dst"); then
    kept="$conflicts/${MERGE_FENCED_COPY_NAME:-$(basename "$dst")}.${sum8:0:8}"
    if mkdir -p "$conflicts" 2>/dev/null && cp "$dst" "$kept" 2>/dev/null; then
      echo "  ⚠ $dst: $why — previous content kept at $kept (copy back any local edits you want)"
      return 0
    fi
  fi
  echo "  ⚠ $dst: $why — could not keep a copy under $conflicts; replacing anyway"
  return 0
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
# L-4d: a vanished source is left alone but not SILENTLY alone. When the source is a whole
# directory payload the framework stopped shipping, the early-exit below returns before
# _refresh_dir_payload can run, so the per-file sweep never walks the consumer's copy and
# _report_dir_residue never names what is inside it — the one delivery shape whose ghost is
# quiet. The early-exit names the retired directory once, report-only.
refresh_safe() {
  local src="$1"
  local dst="$2"
  local exclusive="${3:-}"
  local override="${dst%.md}.override.md"
  if [ ! -e "$src" ]; then
    # Source gone — leave the consumer copy alone (behaviour unchanged: nothing is deleted or
    # refreshed here). But name it (ledger L-4d): if the vanished source was a whole directory
    # payload, the consumer's copy is now theirs ALONE — the framework will never refresh it,
    # sweep it, or mention it again. The gate is -d (not -e) so a vanished FILE source keeps its
    # historical silent leave-alone: L-4d scopes to retired directory payloads, the class whose
    # residue walk dies with the source. ⊝ vocabulary — the `.override.md` skip below is the
    # precedent — NOT the `ORPHAN:` token, which report_getff_orphans reserves for files
    # getff once owned and clean-tree arms grep to zero. Read-only, so the SAME line is the
    # --dry-run preview: preview and real run agree because neither does anything.
    if [ -d "$dst" ]; then
      echo "  ⊝ $dst (retired payload — no longer shipped by this version; consumer-owned now, left untouched)"
    fi
    return 0
  fi
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
  # No entry (REFRESH_BASELINE_ENTRY="", set by the lookup inside refresh_baseline_diverged
  # whenever dst is a file) + bytes differing from src → the D4(c) arm: silent copy, one
  # aggregate line (_preserve_unbaselined_copy).
  if [ "$DRY_RUN" = "--dry-run" ]; then
    if refresh_baseline_diverged "$dst" "$src"; then
      echo "  [dry-run] would-flag: $dst (locally modified)"
    elif [ -f "$dst" ] && [ -z "$REFRESH_BASELINE_ENTRY" ] && ! cmp -s "$src" "$dst"; then
      _preserve_unbaselined_copy "$dst"
    fi
    echo "  [dry-run] would refresh: $src → $dst"
    return 0
  fi
  if refresh_baseline_diverged "$dst" "$src"; then
    _preserve_diverged_copy "$dst"
  elif [ -f "$dst" ] && [ -z "$REFRESH_BASELINE_ENTRY" ] && ! cmp -s "$src" "$dst"; then
    _preserve_unbaselined_copy "$dst"
  fi
  mkdir -p "$(dirname "$dst")"
  cp -r "$src" "$dst"
  echo "  ✓ $dst (refreshed)"
  refresh_baseline_stage "$dst"   # R1: record the delivery for the baseline flush
}

# _report_dir_residue <dst-file> <dst-dir> <class>
# The orphan-report surface for INSIDE a framework-delivered directory payload (ledger L-4b/L-4c),
# sibling to report_getff_orphans and sharing its `ORPHAN:` vocabulary so one grep finds both.
#
# Why here and not inside report_getff_orphans: that function scans three FIXED locations at
# `-maxdepth 1` (consumer root, `.getff/`, `.github/workflows/`) and runs only on the three
# toolchain lanes. Neither reaches a directory payload — `scripts/fences-fire-fixtures` is
# delivered by install.sh's do_refresh on the npm/ts lane, which never calls it, and no
# `-maxdepth 1` glob descends into a payload at all. Extending it would need a second registry of
# payload destinations to keep in sync with the refresh_safe call sites. The sweep below already
# walks exactly those destinations, already knows which files it could not attribute, and runs on
# EVERY lane — so the report is emitted where the knowledge is, and report_getff_orphans's header
# points here for the directory half.
#
# Two classes, because "getff cannot attribute this" and "you edited it" are different facts and
# the old single `kept` counter asserted the wrong one for both (it called every kept file
# "consumer-owned", which is precisely the claim getff has no evidence for):
#   unattributable — no refresh-baseline entry. Either the consumer's own file — the PRIMARY
#                    reading, since a payload may be a declared extension point (ledger L-4f:
#                    scripts/fences-fire-fixtures is one; see check-fences-fire.sh's header) — or
#                    residue of a PRIOR getff version delivered before the baseline existed. Both
#                    readings are printed, benign one first, because getff cannot distinguish them
#                    and the second one is live configuration: a stale
#                    `scripts/fences-fire-fixtures/*.manifest.json` is enumerated by
#                    check-fences-fire.sh, counts toward its non-vacuity denominator and is
#                    probed — a dropped fixture whose rule left the barrel turns the consumer's
#                    own gate RED with no way to trace where the file came from.
#   modified       — a baseline entry exists but the bytes differ, so the consumer demonstrably
#                    edited it. Attributable, not an orphan; named quietly for review.
# REPORT-ONLY, like report_getff_orphans (J2 decisions log #8): nothing here deletes. Read-only,
# so it prints identically under --dry-run — the preview and the real run agree.
_report_dir_residue() {
  local f="$1" dst="$2" class="$3" rel="$1" reldst="$2"
  rel="${rel#"${PROJECT_ROOT:-}/"}"
  reldst="${reldst#"${PROJECT_ROOT:-}/"}"
  if [ "$class" = "unattributable" ]; then
    echo "  ⚠ ORPHAN: $rel sits inside the getff-delivered payload $reldst, is not in the current template set, and has no refresh-baseline entry."
    echo "    Kept in place. If you added it, that is expected — a payload can be consumer-extensible (scripts/fences-fire-fixtures is; see its gate header and INSTALL.md) and getff never removes what it cannot attribute to its own delivery."
    echo "    If you did NOT add it, it is residue of a PRIOR getff version — and a stale file in a payload is LIVE configuration for the checks that read that directory, not inert residue."
  else
    echo "  · kept (locally modified): $rel — getff delivered it, you have since edited it, and the current template set no longer ships it, so getff leaves it as the project's own."
  fi
  return 0
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
# What is NOT accepted is that it survives SILENTLY (ledger L-4b/L-4c): every kept file is now
# named by _report_dir_residue below, so the surviving-forever cost is at least readable. See
# that helper for why the naming lives here rather than in report_getff_orphans.
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
      if [ -z "$REFRESH_BASELINE_ENTRY" ]; then
        kept=$((kept+1))
        _report_dir_residue "$f" "$dst" unattributable
        continue
      fi
      if [ "$cur" != "$REFRESH_BASELINE_ENTRY" ]; then
        kept=$((kept+1))
        _report_dir_residue "$f" "$dst" modified
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
    echo "  · $dst: $kept file(s) kept and named above (getff removes only what the refresh-baseline attributes to it)"
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
    echo "    delivered workflow uses 'main' as the default branch — the install could not read the real one" >&2
  fi
}

# ─── Lane presence + per-lane delivered-set SSOT (report_getff_orphans support) ───────────────
# GETFF_LANES — every toolchain lane that delivers getff-header-marked files into the scan
# locations report_getff_orphans walks (consumer root, .getff/, .github/workflows/). The npm/ts
# lane delivers no header-marked file there, so it is deliberately absent.
GETFF_LANES="python cargo go"

# getff_lane_expected <lane> — the rel paths the CURRENT <lane> template set delivers, one per
# line. SINGLE SOURCE for both the active lane's own list and the OTHER lanes' lists that
# report_getff_orphans unions in on a polyglot consumer — the lane files call
# `report_getff_orphans <lane>` with no list precisely so the two can never drift apart.
# Kept honest empirically by the false-positive control arms of
# tests/install-sh/lane-orphan-residue.test.sh: a clean refresh must report ZERO orphans, so a
# path that drops out of this list while the lane still delivers it goes RED there.
getff_lane_expected() {
  case "$1" in
    python) printf '%s\n' 'ruff.toml' 'sgconfig.yml' 'getff-ruff.toml' \
                          '.getff/ruff-bans.toml' '.github/workflows/getff-python.yml' ;;
    cargo)  printf '%s\n' 'clippy.toml' 'getff-clippy.toml' 'deny.toml' 'getff-deny.toml' \
                          '.getff/Cargo.lints.toml' '.github/workflows/getff-cargo.yml' ;;
    go)     printf '%s\n' '.golangci.yml' 'getff-golangci.yml' '.github/workflows/getff-go.yml' ;;
    *)      : ;;   # unknown lane → empty set (never invents a path)
  esac
}

# getff_lane_installed <lane> — true when <lane> has a prior/current install in $PROJECT_ROOT.
# Dual signal, mirroring the --refresh auto-route arms in install.sh (which call this helper):
# the lane's install-log marker, OR a lane-exclusive getff-owned artefact, for consumers whose
# log was never written (dry-run install) or was removed. Read-only; safe under --dry-run.
getff_lane_installed() {
  case "$1" in
    python) [ -f "$PROJECT_ROOT/.getff-python-install.log" ] || [ -d "$PROJECT_ROOT/.getff/astgrep-rules" ] ;;
    cargo)  [ -f "$PROJECT_ROOT/.getff-cargo-install.log" ] \
              || { [ -f "$PROJECT_ROOT/clippy.toml" ] && grep -q 'generated by getff' "$PROJECT_ROOT/clippy.toml" 2>/dev/null; } ;;
    go)     [ -f "$PROJECT_ROOT/.getff-go-install.log" ] \
              || { [ -f "$PROJECT_ROOT/.golangci.yml" ] && grep -q 'generated by getff' "$PROJECT_ROOT/.golangci.yml" 2>/dev/null; } ;;
    *)      return 1 ;;
  esac
}

# ─── Shared toolchain-lane delivery machinery (ledger 1597 S-2) ──────────────────────────────
# The three toolchain layers (setup.d/45-python.sh, 46-cargo.sh, 47-go.sh) used to carry
# byte-near copies of four pieces of lane machinery: the delivery-log sink, the copy-or-refresh
# wrapper, the delivered-config path resolver, the CI-workflow cell and the rules-lock writer
# (~200 lines ×3; ledger S-2 — every cross-lane fix was a three-file edit, and the A2-3
# `|| _rc=$?` divergence is the live scar of exactly that). The bodies now live HERE, next to
# the GETFF_LANES SSOT they serve; the layers keep only what is genuinely lane-specific
# (collision-matrix cells with lane-specific message sets, firing self-checks — different
# tools/fixtures — and python's structurally different lock writer). layer-units.test.sh §4
# lists every _lane_* helper below in SSOT_FUNS, so a copy of a body back into a layer goes RED
# (the mechanical half of this dedupe; attention-is-not-a-mechanism §1).
#
# State contract: these helpers run inside the install.sh dispatcher scope (layers are sourced,
# not exec'd), so they read the same globals the per-lane bodies read — PROJECT_ROOT, DRY_RUN,
# GETFF_TOOLCHAIN_REFRESH — plus ONE lane-neutral sink variable, _LANE_LOG_FILE, which each
# deliver_*_toolchain entrypoint points at its per-lane audit log (.getff-<lane>-install.log —
# a getff_lane_installed marker, so the FILENAMES are load-bearing and stay per-lane). Only one
# lane ever runs per install.sh process (do_<lane>_lane exits after delivery), so the single
# sink cannot cross-contaminate lanes.

# _lane_log <msg> — delivery-log sink shared by all toolchain lanes: print to stdout (install
# progress) AND append to the consumer audit log ($_LANE_LOG_FILE) unless --dry-run. Was
# _py_log/_cargo_log/_go_log, three byte-identical bodies.
_lane_log() {
  echo "  $1"
  if [ "${DRY_RUN:-}" != "--dry-run" ] && [ -n "${_LANE_LOG_FILE:-}" ]; then
    printf '%s\n' "$1" >> "$_LANE_LOG_FILE"
  fi
}

# _lane_copy_or_refresh <src> <dst> [framework-exclusive] — FRAMEWORK-OWNED delivery shared by
# all toolchain lanes. On install: copy_safe (skip-if-exists → idempotent re-run). On --refresh
# (do_<lane>_lane sets GETFF_TOOLCHAIN_REFRESH=1): refresh_safe → OVERWRITE, so updated
# framework content reaches a brownfield consumer; refresh_safe honours a sibling
# <dst>.override.md (Layer-3 consumer ownership). Optional 3rd argument is forwarded verbatim to
# refresh_safe (`framework-exclusive` — see its docstring above); copy_safe never sees it (on
# the install path the destination is absent or skipped, so nothing is swept). Both branches
# carry the caller's source, so the refresh-covers-full-delivery gate (Check 4) sees the call as
# a delivery on BOTH paths. Was _py_copy_or_refresh/_cargo_copy_or_refresh/_go_copy_or_refresh.
_lane_copy_or_refresh() {
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    refresh_safe "$1" "$2" "${3:-}"
  else
    copy_safe "$1" "$2"
  fi
}

# _lane_delivered_config_path <owned-rel> <getff-ref-rel> — resolve which single-file config
# THIS lane delivered for the active collision cell: a getff-owned <owned-rel> (greenfield /
# idempotent — header present) → <owned-rel>; the REFUSE cell (consumer-authored file kept,
# ours shipped inert) → <getff-ref-rel>; pre-delivery / seam invocation with no getff artefact
# yet → best-effort <owned-rel> (every caller re-checks existence before use, so a missing path
# degrades loudly there, never silently here). Invariant (adapter-jig E2): the firing self-check
# proves the DELIVERED rules fire and the rules-lock fingerprints the DELIVERED artefact — never
# the consumer's own config. Was _cargo_delivered_clippy_path/_go_delivered_golangci_path.
_lane_delivered_config_path() {
  if [ -e "$PROJECT_ROOT/$1" ] && grep -q 'generated by getff' "$PROJECT_ROOT/$1" 2>/dev/null; then
    printf '%s' "$PROJECT_ROOT/$1"
  elif [ -e "$PROJECT_ROOT/$2" ]; then
    printf '%s' "$PROJECT_ROOT/$2"
  else
    printf '%s' "$PROJECT_ROOT/$1"
  fi
}

# _lane_deliver_ci <tpl> <wf-rel> <fresh-msg> <refreshed-msg> <gates> — the
# consumer CI-workflow cell shared by all toolchain lanes: ship the pinned gate template as a
# getff-NAMESPACED <wf-rel> (never the consumer's ci.yml). Collision policy (same class as the
# config cells): no file at our path → deliver via deliver_getff_workflow (getff-honest-signals
# S4 — substitutes the consumer's actual default branch for the template's hard-coded `main`);
# our own getff-generated file → idempotent no-op on install, re-deliver on --refresh (updated
# pins + re-detected branch reach a brownfield consumer; the getff-<lane>.yml.override.md
# Layer-3 escape hatch is preserved — the helper delegates to refresh_safe internally); a
# NON-getff file at our path → REFUSE-LOUDLY, never overwrite: the workflow is kept as it is and
# a NOT-wired line names <gates> (what the lane's CI runs) and why it is not in CI (Q4.7, operator
# directive 2026-09-28: a gap, never the commands to wire it by hand). Every message string is a
# caller argument so the per-lane log output stays lane-specific. Was
# _py_deliver_ci/_cargo_deliver_ci/_go_deliver_ci.
# _lane_getff_ci_runs <tpl-dir> <wf_rel> — 0 when the getff CI workflow at <wf_rel> is, or is about to
# be, getff's: the lane ships a CI template and the path is either absent (_lane_deliver_ci writes it)
# or carries the generated-by-getff marker. A consumer-owned file there is kept as it is (the REFUSE
# arm below), so a REFUSE cell's NOT-wired line must not claim the getff CI runs the bans (Q4.7).
_lane_getff_ci_runs() {
  local wf="$PROJECT_ROOT/$2"
  [ -f "$1/github-actions-ci.yml" ] || return 1
  [ ! -e "$wf" ] || grep -q 'generated by getff' "$wf" 2>/dev/null
}

_lane_deliver_ci() {
  local tpl="$1" wf_rel="$2" fresh_msg="$3" refreshed_msg="$4" gates="$5"
  local wf_dst="$PROJECT_ROOT/$wf_rel"

  if [ ! -f "$tpl/github-actions-ci.yml" ]; then
    _lane_log "⊝ no CI template at $tpl/github-actions-ci.yml — skipping CI delivery (rules still enforced locally)"
    return 0
  fi

  if [ -e "$wf_dst" ]; then
    if grep -q 'generated by getff' "$wf_dst" 2>/dev/null; then
      if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
        # Framework-owned → deliver_getff_workflow re-detects the default branch on every
        # refresh; the env prefix keeps the refresh-covers-full-delivery gate's refresh-side
        # extraction honest (it keys on this literal form).
        GETFF_TOOLCHAIN_REFRESH=1 deliver_getff_workflow "$tpl/github-actions-ci.yml" "$wf_dst"
        _lane_log "$refreshed_msg"
      else
        _lane_log "⊝ $wf_rel already delivered by getff — no-op (idempotent)"
      fi
      return 0
    fi
    _lane_log "⚠ REFUSE CI: $wf_rel exists and is NOT getff-generated — kept as it is"
    note_not_wired "CI: $gates not in CI — $wf_rel is your own workflow, and getff does not change a workflow it did not write"
    return 0
  fi

  deliver_getff_workflow "$tpl/github-actions-ci.yml" "$wf_dst"
  _lane_log "$fresh_msg"
}

# _lane_write_toolchain_lock <lane> <cfg-noun> <cfg-path> <backend> <note> — the cargo/go
# rules-lock writer (ledger S-2; python's _py_write_rules_lock is deliberately NOT this body —
# different lock location, schema extras and a content-aware idempotent skip, see 45-python.sh).
# Writes .ai-factory/synthesizer-output/rules-lock.<lane>.json — a REPRODUCIBILITY RECORD
# (emittedAt + sourceFingerprint) whose fingerprint covers EVERY provenance input the lock body
# reads (A2-9): the DELIVERED config at <cfg-path> (per _lane_delivered_config_path — the
# getff-* reference in the REFUSE cell, never the consumer's own file), the ctx manifest (→
# `version`) and the generation-context fragments (→ `rules`); separator-free concatenation,
# absent inputs contribute nothing. Hashed through the single lib.sh _hash256 ladder (R-3);
# BOTH degrade triggers — no hash tool AND delivered-config-absent — warn LOUDLY to stderr and
# write the non-authoritative "sha256:unknown" constant (never silently trusted, never
# hard-failed: an optional auditability field is not an install precondition). Framework-owned,
# refresh-overwritten.
_lane_write_toolchain_lock() {
  local lane="$1" cfg_noun="$2" cfg="$3" backend="$4" note="$5"
  local lock_dir="$PROJECT_ROOT/.ai-factory/synthesizer-output"
  local lock="$lock_dir/rules-lock.$lane.json"
  # A2-9: BOTH provenance inputs are resolved HERE, at the top, because the sourceFingerprint
  # below AND the lock-body reads further down consume them — one path constant, never two.
  local _ctx="$lock_dir/generation-context.json"
  local _frag_dir="$lock_dir/generation-context"

  if [ "${DRY_RUN:-}" = "--dry-run" ]; then
    _lane_log "[dry-run] would write the $lane rules-lock → .ai-factory/synthesizer-output/rules-lock.$lane.json"
    return 0
  fi

  mkdir -p "$lock_dir"
  local fp="sha256:unknown"
  if [ -e "$cfg" ]; then
    # A2-9: the fingerprint must cover EVERY provenance input the lock body reads — the
    # delivered config, the ctx manifest (→ `version`) and the generation-context fragments
    # (→ `rules`). The inputs are concatenated SEPARATOR-FREE into one temp file and hashed
    # through the SAME single _hash256 call; with no manifest and no fragments the temp file
    # is byte-identical to the delivered config, so the recorded fingerprint is unchanged.
    local _hash_tmp _h _rf
    _hash_tmp=$(mktemp)
    {
      cat "$cfg"
      # The trailing `true` is load-bearing under install.sh's `set -euo pipefail`: the
      # optional inputs are ABSENT on any consumer that never ran a synthesizer producer, and
      # a failing `[ -f … ] &&` arm as the last command of this group would abort the lane.
      [ -f "$_ctx" ] && cat "$_ctx"
      if [ -d "$_frag_dir" ]; then
        for _rf in "$_frag_dir"/*.json; do
          [ -f "$_rf" ] || continue
          cat "$_rf"
        done
      fi
      true
    } > "$_hash_tmp"
    if _h=$(_hash256 "$_hash_tmp"); then
      fp="sha256:$_h"
    else
      echo "  ⚠ getff: no sha256 tool on PATH; $lane rules-lock sourceFingerprint is non-authoritative" >&2
      fp="sha256:unknown"
    fi
    rm -f "$_hash_tmp"
  else
    echo "  ⚠ getff: delivered $cfg_noun missing ($cfg); $lane rules-lock sourceFingerprint is non-authoritative" >&2
  fi
  local now
  now=$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo unknown)
  # `version` is a PLAN-LEVEL field keyed to `framework` (ResearchPlan {framework, version});
  # cargo/go are LANGUAGE lanes with no single framework dependency → no manifest today →
  # derived null is honest. The read is unconditional; the day a framework-specific plan is
  # synthesised, the manifest carries its version and the lock reports it — no code change.
  local _ctx_ver='null'
  if [ -f "$_ctx" ]; then
    _ctx_ver=$(grep -oE '"version"[[:space:]]*:[[:space:]]*("[^"]*"|null)' "$_ctx" | head -1 | sed -E 's/.*:[[:space:]]*//')
  fi
  [ -n "$_ctx_ver" ] || _ctx_ver='null'
  # §3a option B / §6 fork 2: derive the per-rule slice from the fragment dir
  # (generation-context/<rule-id>.json, one per rule). Both lanes' ban surfaces are lint
  # config, not named ast-grep rule ids — the fragment dir is typically empty, so the derived
  # value is []. But it is DERIVED (the dir was scanned), not literal-printed.
  local _rules_json="[]"
  if [ -d "$_frag_dir" ]; then
    local _rf _rf_first=1
    _rules_json="["
    for _rf in "$_frag_dir"/*.json; do
      [ -f "$_rf" ] || continue
      if [ "$_rf_first" -eq 1 ]; then _rf_first=0; else _rules_json="$_rules_json, "; fi
      _rules_json="$_rules_json$(cat "$_rf")"
    done
    _rules_json="$_rules_json]"
  fi
  cat > "$lock" <<EOF
{
  "schemaVersion": 2,
  "framework": "$lane",
  "version": $_ctx_ver,
  "rules": $_rules_json,
  "backend": "$backend",
  "emittedAt": "$now",
  "sourceFingerprint": "$fp",
  "note": "$note"
}
EOF
  _lane_log "$lane rules-lock → .ai-factory/synthesizer-output/rules-lock.$lane.json (reproducibility record)"
}

# report_getff_orphans <lane> — adapter-jig C4 (no-orphan-residue).
# On a --refresh pass, scan the KNOWN getff delivery locations (consumer root, .getff/,
# .github/workflows/) for files carrying the getff ownership header ('generated by getff') that the
# CURRENT template set no longer delivers, and report each LOUDLY — never silently left active.
# Directory payloads are NOT covered here — the three scan globs below are all `-maxdepth 1` and
# never descend into one, and this helper runs only on the three toolchain lanes. Since ledger L-4
# only a `framework-exclusive` payload (`.getff/astgrep-rules`) is still swept wholesale; a SHARED
# payload keeps every file it cannot attribute, and those are named by _report_dir_residue inside
# the sweep itself (ledger L-4b/L-4c — the claim this comment used to make, that refresh_safe
# swept all directory payloads wholesale, stopped being true at L-4 and is why the residue class
# went unreported). This function covers the individually-delivered top-level files that per-file
# refresh can never sweep — the same root cause as the #882 npm barrel prune («do_refresh only
# ADD/OVERWRITEs the current stack's files, never removes a leftover»), on the python/cargo lanes.
# REPORT-ONLY by design (J2 decisions log #8): deleting consumer-tree files is the irreversible
# branch; the loud report satisfies the C4 «swept (or loudly reported)» contract. Files WITHOUT the
# getff header are never flagged — not ours to name. Read-only: safe under --dry-run.
#
# LANE-AWARE (A2-6): the three scan locations above are lane-AGNOSTIC — they hold every lane's
# deliveries side by side. Matching them against the ACTIVE lane's expected set alone made a
# polyglot consumer's `install.sh go --refresh` name the live python configs (ruff.toml,
# sgconfig.yml, .getff/ruff-bans.toml, .github/workflows/getff-python.yml) stale and tell the
# reader to «remove it manually» — a consumer, or an AI agent acting on the log, would delete live
# enforcement. So the expected set is the UNION of the active lane's paths and the paths of every
# OTHER lane that is actually installed in this tree (getff_lane_installed). A header-marked file
# belonging to NO installed lane is still a true orphan and is still reported — a lane that was
# uninstalled leaves no marker, so its residue keeps surfacing, which is the point of the report.
report_getff_orphans() {
  local lane="$1"
  local expected f rel other
  # space-delimited rel paths; no delivered path contains whitespace
  expected=" $(getff_lane_expected "$lane" | tr '\n' ' ') "
  for other in $GETFF_LANES; do
    [ "$other" = "$lane" ] && continue
    getff_lane_installed "$other" || continue
    expected="$expected$(getff_lane_expected "$other" | tr '\n' ' ') "
  done
  # Each find carries its own `|| true`: this group is a NON-LAST element of the scan pipeline
  # below, and under install.sh's `set -euo pipefail` set -e remains ACTIVE inside it — a find
  # whose target directory does not exist (every cargo/go consumer's `.getff/` — only python
  # delivers into it) exits 1 and used to abort report_getff_orphans mid-function, killing the
  # whole lane refresh rc=1 AFTER refresh_baseline_flush with no error line (pre-existing on
  # staging; surfaced by the F8 per-lane rc-parity proof). A trailing group-level `true` does
  # NOT fix this shape (set -e fires at the failing find, before it runs) — the guard must be
  # per-find. "Directory absent" is the expected case, not a scan failure.
  { find "$PROJECT_ROOT" -maxdepth 1 -type f \( -name '*.toml' -o -name '*.yml' -o -name 'getff-*' \) 2>/dev/null || true
    find "$PROJECT_ROOT/.getff" -maxdepth 1 -type f 2>/dev/null || true
    find "$PROJECT_ROOT/.github/workflows" -maxdepth 1 -type f -name 'getff-*.yml' 2>/dev/null || true
  } | LC_ALL=C sort | while IFS= read -r f; do
    grep -q 'generated by getff' "$f" 2>/dev/null || continue
    rel="${f#"$PROJECT_ROOT/"}"
    case "$expected" in
      *" $rel "*) ;;   # currently delivered — not an orphan
      *)
        echo "  ⚠ ORPHAN: $rel is getff-owned (header present) but the current $lane template set no longer delivers it."
        echo "    Stale artefact from a PRIOR getff version — left in place, because getff never deletes files in the project."
        ;;
    esac
  done
  # L-4e: the three globs above deliberately scan only getff's OWN delivery locations and stay at
  # -maxdepth 1, so they never descend into .getff/rules-research/ — and that directory is never
  # a refresh_safe destination either, so _report_dir_residue cannot see it. Yet its *.yml files
  # re-join into the live scan dir on EVERY delivery pass (_py_join_researched_rules,
  # setup.d/45-python.sh): a stale researched rule is enforced forever with zero mention in any
  # refresh output. Name the directory once when it exists — a read-only ⊝ line, awareness not
  # verdict: which individual researched rule is stale is the JOIN's judgment (barrel prune +
  # REFUSE-LOUDLY collision guard), not this scan's. NOT the ORPHAN: token — getff never
  # delivered anything here, so it is not an orphan of ours; and clean-tree arms of
  # lane-orphan-residue grep ORPHAN: to zero. Fires identically under --dry-run (read-only).
  if [ -d "$PROJECT_ROOT/.getff/rules-research" ]; then
    echo "  ⊝ .getff/rules-research/ is consumer-owned researched-rule storage — getff joins *.yml from it into .getff/astgrep-rules on every pass and never writes, sweeps, or prunes here, so its entries stay as the project left them."
  fi
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
#
# The sed itself lives in _rewrite_arch_sot_header_inplace so the pre-overwrite divergence guard can
# reconstruct the DELIVERED bytes (src → rewrite) for its no-entry comparison — copy_safe deliveries
# that this rewrite post-processes must not be compared against the raw src (W1-A review MAJOR 1:
# pristine materialized ARCHITECTURE.md copies false-flagged as consumer-diverged).
_rewrite_arch_sot_header_inplace() {
  sed -i.bak -e 's#^> Drop into `.ai-factory/ARCHITECTURE.md` and override only what your project needs\. #> This install-generated starter IS your `.ai-factory/ARCHITECTURE.md` — edit it to match your project. #' "$1"
  rm -f "${1}.bak"
}

rewrite_arch_sot_header() {
  local dst="$1" existed="$2"
  if [ "$DRY_RUN" != "--dry-run" ] && { [ "$existed" -eq 0 ] || [ "$FORCE" = "--force" ]; }; then
    _rewrite_arch_sot_header_inplace "$dst"
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
    # W1-A review MAJOR 1: .prettierignore legitimately carries framework-managed marker blocks
    # APPENDED after the copy_safe delivery (our AIF block below + ignore_shipped_configs'
    # shipped-configs block), so the guard's raw-src comparison would false-flag every pristine
    # installed copy as consumer-diverged. Prove pristine-modulo-blocks here and suppress the
    # no-entry claim for exactly that case; a genuinely consumer-edited file keeps the claim.
    if [ -e "$dst" ] && _prettierignore_pristine "$src" "$dst"; then
      copy_safe "$src" "$dst" suppress-no-entry
    else
      copy_safe "$src" "$dst"
    fi
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
    ".dependency-cruiser.mjs" "stryker.config.json" ".lintstagedrc.json"
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
# setup.d/lib.sh:2753, so the two never drift. Keeps only children that carry a package.json (a
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
#
# The substitution itself lives in _patch_stryker_package_manager_inplace so the pre-overwrite
# divergence guard can reconstruct the DELIVERED bytes (src → patch) for its no-entry comparison:
# the copy_safe delivery at the 40-configs.sh call sites is post-processed by this patch, and
# comparing a pristine patched config against the RAW template would false-flag it as
# consumer-diverged on a pre-manifest --force run (same defect class as the arch-header and
# md-refs parities). Byte-changing only on pnpm/yarn consumers — on npm the template value makes
# the substitution a no-op — which is why the false claim was pnpm/yarn-only.
_patch_stryker_package_manager_inplace() {
  local _f="$1" _pm
  command -v node >/dev/null 2>&1 || return 0
  [ -f "$_f" ] || return 0
  # R-S4-3: install.sh runs BEFORE the consumer's `npm/pnpm install` in the canonical flow,
  # so a lockfile may not exist yet (a pnpm monorepo would silently stay "npm"). Detect from
  # signals present AT INSTALL TIME: the explicit package.json "packageManager" field (corepack
  # source of truth) wins; else workspace/lock markers (pnpm-workspace.yaml exists pre-install
  # in a monorepo); else npm. A flat pnpm consumer with neither marker nor field still defaults
  # npm — re-run install after the lockfile lands, or set package.json "packageManager".
  # Detected from PROJECT_ROOT signals, so the reconstruction on a temp copy yields the same
  # value the real delivery writes.
  _pm=$(detect_pm)   # SSOT detector (lockfile/workspace/corepack signals; see detect_pm above)
  # GH #531: rewrite ONLY the packageManager VALUE in place (string-substitution), NOT a full
  # JSON.stringify re-serialize. The template ships prettier-clean (short arrays collapsed to one
  # line); JSON.stringify(,,2) would re-expand those arrays and break `prettier --check` on the
  # consumer. A targeted value swap preserves the template's prettier formatting byte-for-byte.
  AIF_STRYKER_CFG="$_f" AIF_STRYKER_PM="$_pm" node -e '
    const fs = require("fs");
    const p = process.env.AIF_STRYKER_CFG;
    const pm = process.env.AIF_STRYKER_PM;
    const src = fs.readFileSync(p, "utf8");
    const out = src.replace(/("packageManager"\s*:\s*")[^"]*(")/, `$1${pm}$2`);
    if (out !== src) fs.writeFileSync(p, out);
  '
}

patch_stryker_package_manager() {
  _cfg="$PROJECT_ROOT/stryker.config.json"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would set stryker packageManager from consumer lockfile"
    return 0
  fi
  command -v node >/dev/null 2>&1 || return 0
  [ -f "$_cfg" ] || return 0
  _patch_stryker_package_manager_inplace "$_cfg"
  echo "  ✓ stryker packageManager → $(detect_pm)"
}

# consumer_source_roots <dir> — the top-level directories that hold a project's own code when it
# has NO src/ (lib/; app/ + components/ + lib/, the create-next-app and Expo layouts without src/),
# space-separated in glob order. Nothing when src/ exists or no directory holds code yet. Not code
# roots: build output and static assets, end-to-end test directories (Playwright and Cypress specs
# are not vitest's), and the directories getff itself delivers into. Glob-safe names only — the
# result is spliced into glob patterns.
consumer_source_roots() {
  local dir="$1" d name roots=""
  [ -d "$dir/src" ] && return 0
  for d in "$dir"/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    case "$name" in
      node_modules | dist | build | out | coverage | public | e2e | cypress | playwright \
        | packages | scripts | tests | eslint-rules-local) continue ;;
    esac
    case "$name" in *[!A-Za-z0-9._-]*) continue ;; esac
    if [ -n "$(find "$d" -name node_modules -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \
      -o -name '*.mts' -o -name '*.cts' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' \
      -o -name '*.cjs' \) -print -quit 2>/dev/null)" ]; then
      roots="${roots:+$roots }$name"
    fi
  done
  if [ -n "$roots" ]; then printf '%s\n' "$roots"; fi
  return 0
}

# _rewrite_vitest_source_roots_inplace <file> — anchor a vitest config's quoted `src/**/` globs on
# the project's own source roots: one root → `lib/**/`, several → `{app,components,lib}/**/`.
# Every such glob moves together (test include and exclude, coverage include and exclude), so the
# config stays self-consistent; directory-scoped keys (`src/domain/**` thresholds,
# `src/app/**/page.tsx`) and the `@` alias are left as they are. A no-op for a src/ project and for
# one with no code yet. Reads $PROJECT_ROOT's layout, not the file's directory, so _expected_post's
# temp-copy reconstruction derives the same roots the delivery did.
_rewrite_vitest_source_roots_inplace() {
  local f="$1" roots anchor tmp
  [ -f "$f" ] || return 0
  roots=$(consumer_source_roots "${PROJECT_ROOT:-.}")
  [ -n "$roots" ] || return 0
  case "$roots" in
    *" "*) anchor="{$(printf '%s' "$roots" | tr ' ' ',')}" ;;
    *) anchor="$roots" ;;
  esac
  tmp=$(mktemp) || return 0
  if sed "s#\\(['\"]\\)src/\\*\\*/#\\1${anchor}/**/#g" "$f" > "$tmp" 2>/dev/null; then
    cat "$tmp" > "$f"
  fi
  rm -f "$tmp"
  return 0
}

# rewrite_vitest_source_roots <src> <dst> — run right after `copy_safe <src> <dst> vitest-layout`
# (Q4.5, 2026-09-28: layout assumptions are fixed by class, from the layout). Every preset's
# vitest.config.ts anchors its globs on src/, so a project that keeps its code in lib/ got «No test
# files found» from `npm test` and a RED validate right after install. Rewrites ONLY the bytes
# copy_safe wrote this run: a skipped dst (the consumer's own config, or an earlier delivery the
# consumer now owns — vitest.config.ts is never refreshed) is left alone, as is anything that is
# not the template's bytes.
rewrite_vitest_source_roots() {
  local src="$1" dst="$2" s
  [ "${DRY_RUN:-}" = "--dry-run" ] && return 0
  { [ -f "$dst" ] && cmp -s "$src" "$dst"; } || return 0
  for s in ${SKIPPED[@]+"${SKIPPED[@]}"}; do
    [ "$s" = "$dst" ] && return 0
  done
  _rewrite_vitest_source_roots_inplace "$dst"
  if ! cmp -s "$src" "$dst"; then
    echo "  ✓ vitest.config.ts test globs → $(consumer_source_roots "${PROJECT_ROOT:-.}" | sed 's#\([^ ]*\)#\1/#g') (this project has no src/)"
  fi
  return 0
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
    # W1-A: read-only divergence preview — same would-flag/aggregate vocabulary as the real
    # run (the guard writes nothing under --dry-run), so `--dry-run --force` predicts exactly
    # the files the force pass would flag/preserve. The plain-skills arms (getff /
    # tool-bootstrapping, which bypass this verb) preview the guard in their OWN dry-run
    # branches (setup.d/10-skills.sh install arm, install.sh do_refresh arm — W1-A review
    # MAJOR 2), so the preview contract holds for every skill delivery path.
    if [ -e "$dst" ]; then _pre_overwrite_guard "$src" "$dst" transform; fi
    echo "  [dry-run] would copy: $src → $dst (+ transform internal refs)"
    return 0
  fi
  # Wipe, recopy, rewrite repo-internal cross-refs in all .md files to GitHub blob URLs.
  # The divergence pass before the wipe lives inside _copy_tree_with_transform (GH #1540).
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
    # W1-A: read-only divergence preview (see copy_skill_with_transform) — under --dry-run the
    # caller never reaches _copy_tree_with_transform's own guard, so the preview runs it here.
    _pre_overwrite_guard "$src" "$dst" transform
    echo "  [dry-run] would refresh: $src → $dst (+ transform internal refs)"
    return 0
  fi
  # The divergence pass before the wipe lives inside _copy_tree_with_transform (GH #1540: skill
  # trees used to be rm -rf'd with no guard — the exact "cannot distinguish" gap the docs
  # described for them).
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
    # the no-tsc consumer reality, setup.d/40-configs.sh:253-258); regenerating from the on-disk
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
    # never the consumer's own tree), so it can only ever delete FRAMEWORK fixtures.
    #
    # STALE CLAIM CORRECTED (ledger L-4b/L-4c): this comment used to continue «on --refresh the
    # fixtures dir itself is framework-owned: refresh_safe replaces the whole dir … so a consumer
    # file dropped into that dir WITHOUT the override is removed on refresh regardless of this
    # loop.» That stopped being true at ledger L-4. refresh_safe's directory arm no longer
    # rm -rf's a SHARED payload; it removes only what the refresh-baseline attributes to the
    # framework and KEEPS everything else (_refresh_dir_payload). So a consumer file dropped in
    # here survives every refresh with or without the override — pinned behaviourally by arm 1 of
    # tests/install-sh/refresh-dir-payload-ownership.test.sh — and so does residue of a prior
    # getff version, which is why each kept file is now named (_report_dir_residue).
    # Keeps the gate strict where it must be: on
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
    # A fact, not a step (Q4.7): the preset is what got installed, and live research is not part of
    # an install.
    echo "   The rules installed are this preset's, pinned to the versions above; rules researched for your"
    echo "   current versions come from the rule-research protocol (agents/rule-researcher.md), which an"
    echo "   install does not run. Presets are the fallback baseline, not the source of truth."
  fi
}

# ci_gate_detect — fill _aif_missing / _aif_steps / _aif_cmds with each rule-enforcement gate whose
# artefact is installed but that no workflow under .github/workflows/ references (#507/#521 CI-orphan).
# Read-only. Shared by setup.d/60-ci.sh §6c (WARN + opt-in yq wiring) and install.sh do_refresh, which
# names each missing gate and never edits the workflow (refresh sweep 2026-09-29 G6).
_ci_gate_check() { # $1 "gate — what it enforces"  $2 wired-grep  $3 installed-artifact  $4 paste-step
  [ -e "$PROJECT_ROOT/$3" ] || return 0          # gate not installed for this stack → nothing to warn
  local _wf
  for _wf in "$PROJECT_ROOT/.github/workflows/"*.yml "$PROJECT_ROOT/.github/workflows/"*.yaml; do
    [ -f "$_wf" ] || continue
    # grep inside `if` is set-e-safe (non-zero no-match is consumed by the if-test, not seen by set -e)
    if grep -qE "$2" "$_wf" 2>/dev/null; then return 0; fi   # referenced by some workflow → wired
  done
  _aif_missing+=("$1"); _aif_steps+=("$4"); _aif_cmds+=("${4#- run: }")
}
ci_gate_detect() {   # (re)build the missing-set from scratch — idempotent, callable again post-wire
  _aif_missing=(); _aif_steps=(); _aif_cmds=()
  # arch:check's artifact is whichever dependency-cruiser config is on disk: ours, or the
  # consumer's own that 40-configs.sh kept (copy_unless_foreign).
  local _dc; _dc=$(depcruise_config "$PROJECT_ROOT")
  _ci_gate_check "check:globs — R2/R7/R8 ESLint-rule liveness"        'check-rule-globs\.sh|check:globs'               "scripts/check-rule-globs.sh"          "- run: bash scripts/check-rule-globs.sh"
  _ci_gate_check "check:enforced — R2 actually applied (per-pkg cfg)"  'check-rule-enforced\.sh|check:enforced'         "scripts/check-rule-enforced.sh"       "- run: bash scripts/check-rule-enforced.sh"
  _ci_gate_check "arch:check — R3 architecture boundaries"            'arch:check|depcruise'                           "${_dc:-.dependency-cruiser.mjs}"       "- run: npm run arch:check"
  _ci_gate_check "check:arch-boundaries — R3 monorepo-boundary liveness" 'check-arch-boundaries\.sh|check:arch-boundaries' "scripts/check-arch-boundaries.sh"     "- run: bash scripts/check-arch-boundaries.sh"
  _ci_gate_check "audit:docs — AI-documentation drift"               'audit:docs|audit-ai-docs\.sh'                   "scripts/audit-ai-docs.sh"             "- run: bash scripts/audit-ai-docs.sh"
  _ci_gate_check "check:lintstaged — lint-staged binaries resolve"   'check:lintstaged|check-lintstaged-resolves\.sh' "scripts/check-lintstaged-resolves.sh" "- run: bash scripts/check-lintstaged-resolves.sh"
}

# merge_canonical_scripts <install|refresh> — FQA S1-A W4: add the canonical package.json scripts
# (validate, check:*, prepare …) the consumer lacks, never overwriting a key they have. `install`
# also adds the hook devDependencies (husky, lint-staged, sort-package-json) that §8 then installs.
# `refresh` does NOT: --refresh installs no dependencies, and a devDependency written without an
# install puts package.json out of step with the lockfile (`npm ci` fails) — each missing one is a
# NOT wired line instead, and package.json is rewritten only when a script was added. Shared by
# setup.d/70-deps.sh §7 and install.sh do_refresh (refresh sweep 2026-09-29 G5).
merge_canonical_scripts() {
  local AIF_MERGE_MODE="${1:-install}" _mcs_out _mcs_tag _mcs_dev _mcs_ver
  if [ -f "$PROJECT_ROOT/package.json" ]; then
    if [ -n "$DRY_RUN" ]; then
      echo "▶ package.json scripts → [dry-run] would merge canonical block (non-destructive)"
    elif command -v node >/dev/null 2>&1; then
      echo "▶ Merging canonical scripts → package.json (non-destructive)"
      # #508: arch:check target. A pnpm monorepo has no root src/ (only apps/*/src, packages/*/src),
      # so a hardcoded `depcruise … src` hard-fails (exit 1, "Can't open 'src'") and breaks the
      # shipped CI's architecture job. Resolve to source roots that EXIST so arch:check cruises
      # something on flat, layered, AND monorepo shapes instead of crashing on a missing dir. The
      # layer rules in .dependency-cruiser.mjs match nested package src via (?:^|/)src/<layer>.
      # The target must NEVER be a non-existent dir (that is the crash). Resolution order:
      #   1. workspace + a known package root present → that root (apps/packages/services/libs/modules)
      #   2. else a root src/ present → src
      #   3. else → "." (cwd always exists; never "Can't open"). Exotic-named workspace roots fall to
      #      (2)/(3); a one-line arch:check edit lets the consumer point at their exact roots.
      # #508 arch:check target signal — kept as-is (only the mutation-wiring signal below changes,
      # per plan Amendment A1). AIF_MONOREPO_SIG / AIF_ARCH_TARGET stay the manifest-key-based check.
      AIF_MONOREPO_SIG=0
      if [ -f "$PROJECT_ROOT/pnpm-workspace.yaml" ] || grep -q '"workspaces"' "$PROJECT_ROOT/package.json" 2>/dev/null; then
        AIF_MONOREPO_SIG=1
      fi
      AIF_ARCH_TARGET=""
      if [ "$AIF_MONOREPO_SIG" = "1" ]; then
        for _d in apps packages services libs modules; do
          [ -d "$PROJECT_ROOT/$_d" ] && AIF_ARCH_TARGET="$AIF_ARCH_TARGET $_d"
        done
        AIF_ARCH_TARGET="${AIF_ARCH_TARGET# }"
      fi
      if [ -z "$AIF_ARCH_TARGET" ]; then
        if [ -d "$PROJECT_ROOT/src" ]; then AIF_ARCH_TARGET="src"; else AIF_ARCH_TARGET="."; fi
      fi
      # #931 PR-2 (C2 fix, plan Amendment A1): test:mutation must route to the per-package wrapper
      # based on ARTIFACT PRESENCE (scripts/run-mutation.sh), NOT the AIF_MONOREPO_SIG manifest
      # signal above. AIF_MONOREPO_SIG (pnpm-workspace.yaml / "workspaces" key) and the EMIT gate in
      # setup.d/40-configs.sh (_ws_lines — a conventional-dir enumeration: apps|packages|services|
      # libs|modules — that does NOT consult the workspace manifest) are two DIFFERENT signals that
      # diverge both ways: a `packages/*` monorepo with no manifest key would wire "stryker run"
      # against configs that were never emitted (SF-1 stays unfixed); a
      # `"workspaces":["client","server"]` repo with non-conventional dirs would wire the wrapper
      # form even though 40-configs.sh took the FLAT branch (no wrapper ever copied) — a hard error
      # on first run (working → broken regression). 40-configs.sh runs BEFORE 70-deps.sh (setup.d
      # numeric order), so the wrapper's on-disk presence is the authoritative "per-workspace
      # configs were emitted" signal — wire⟺emit by construction.
      AIF_HAS_MUTATION_WRAPPER=0
      [ -f "$PROJECT_ROOT/scripts/run-mutation.sh" ] && AIF_HAS_MUTATION_WRAPPER=1
      # arch:check cruises with the config that is on disk after 40-configs.sh: ours
      # (.dependency-cruiser.mjs), or the consumer's own under any name dependency-cruiser reads —
      # 40-configs.sh placed nothing beside it (copy_unless_foreign), so naming ours would crash.
      AIF_DEPCRUISE_CFG=$(depcruise_config "$PROJECT_ROOT")
      AIF_DEPCRUISE_CFG="${AIF_DEPCRUISE_CFG:-.dependency-cruiser.mjs}"
      _mcs_out=$(AIF_MERGE_MODE="$AIF_MERGE_MODE" AIF_PKG="$PROJECT_ROOT/package.json" AIF_ARCH_TARGET="$AIF_ARCH_TARGET" AIF_DEPCRUISE_CFG="$AIF_DEPCRUISE_CFG" AIF_STACK="$STACK" AIF_HAS_MUTATION_WRAPPER="$AIF_HAS_MUTATION_WRAPPER" node -e '
        const fs = require("fs");
        const p = process.env.AIF_PKG;
        const pkg = JSON.parse(fs.readFileSync(p, "utf8"));
        pkg.scripts = pkg.scripts || {};
        // #931 PR-2 (C2 fix): route test:mutation to the per-package wrapper IFF setup.d/40-configs.sh
        // actually emitted it (scripts/run-mutation.sh on disk) — see the AIF_HAS_MUTATION_WRAPPER
        // comment above for why this replaced the AIF_MONOREPO_SIG manifest-key signal.
        const hasMutationWrapper = process.env.AIF_HAS_MUTATION_WRAPPER === "1";
        const want = {
          "lint": "eslint . --max-warnings=0",
          "lint:fix": "eslint . --fix",
          "format": "prettier --write .",
          "format:check": "prettier --check .",
          "typecheck": "tsc --noEmit",
          "test": "vitest run",
          "test:watch": "vitest",
          "test:coverage": "vitest run --coverage",
          "test:integration": "vitest run -- --include 'src/**/*.integration.{ts,tsx}'",
          "test:mutation": hasMutationWrapper ? "bash scripts/run-mutation.sh" : "stryker run",
          "test:mutation:incremental": hasMutationWrapper ? "bash scripts/run-mutation.sh --incremental" : "stryker run --incremental",
          "arch:check": "depcruise --config " + (process.env.AIF_DEPCRUISE_CFG || ".dependency-cruiser.mjs") + " " + (process.env.AIF_ARCH_TARGET || "src"),
          "audit:docs": "./scripts/audit-ai-docs.sh",
          "check:globs": "bash scripts/check-rule-globs.sh",
          "check:enforced": "bash scripts/check-rule-enforced.sh",
          "check:arch-boundaries": "bash scripts/check-arch-boundaries.sh",
          "check:lintstaged": "bash scripts/check-lintstaged-resolves.sh",
          "check:fences-fire": "bash scripts/check-fences-fire.sh",
          "check:shields-up": "bash scripts/check-shields-up.sh",
          "test:mutation:generated": "bash scripts/run-generated-rule-mutation.sh",
          "validate": "npm-run-all2 --parallel typecheck lint format:check arch:check audit:docs check:globs check:enforced check:arch-boundaries check:lintstaged check:fences-fire check:shields-up test",
          "prepare": "husky"
        };
        // react-next only: the shipped ci.yml test-storybook job calls build-storybook +
        // test-storybook (github-actions-ci-ui.yml:152-157). Scripts were historically merged by
        // retired setup.sh Batch K (storybook-package-additions.json, #946) — this is that merge,
        // relocated to the live path. Same non-destructive guard as the rest of `want`.
        if (process.env.AIF_STACK === "react-next") {
          want["storybook"] = "storybook dev -p 6006";
          want["build-storybook"] = "storybook build";
          want["test-storybook"] = "test-storybook";
        }
        // Refresh sweep G5 (review finding): `prepare: husky` runs on every `npm install`, so with no
        // husky devDependency behind it (a consumer who moved to another hook manager) it would fail
        // that install with exit 127. A refresh writes no devDependency, so it withholds prepare too.
        if (process.env.AIF_MERGE_MODE === "refresh" && !("prepare" in pkg.scripts)
            && !("husky" in (pkg.devDependencies || {})) && !("husky" in (pkg.dependencies || {}))) {
          delete want["prepare"];
          process.stdout.write("WITHHELD_PREPARE\n");
        }
        // Snapshot BEFORE the merge: which canonical keys the consumer already had (for the
        // kept-names log line below, #1531 observability).
        const preExisting = new Set(Object.keys(pkg.scripts));
        let added = 0;
        for (const [k, v] of Object.entries(want)) if (!(k in pkg.scripts)) { pkg.scripts[k] = v; added++; }
        // #1531: AFTER the strictly non-destructive merge, exact-string overwrite of the npm-init
        // `test` placeholder. `npm init` seeds scripts.test with a placeholder whose string is
        // npm-init noise ("Error: no test specified"), not consumer intent; the merge above KEPT
        // it forever and the shipped `validate` (whose last lane is `test`) was permanently red on
        // every npm-init consumer: npm runs the KEPT string (`echo … && exit 1`), so no green path
        // existed until the consumer rewrote it. Overwrite ONLY the exact placeholder string; any
        // other existing `test` value is deliberate consumer wiring and stays kept (and is named
        // below).
        // (NOTE: this JS lives inside the bash single-quoted node -e block opened below the want
        // map — never put an apostrophe in JS here: it would end the bash string and the segment
        // between the apostrophes is re-glued UNQUOTED, so any space or double-ampersand inside it
        // word-splits the script. Hence the \" escapes instead of apostrophe literals.)
        const NPM_INIT_TEST_PLACEHOLDER = "echo \"Error: no test specified\" && exit 1";
        let placeholderReplaced = false;
        if (pkg.scripts.test === NPM_INIT_TEST_PLACEHOLDER) {
          pkg.scripts.test = want["test"];
          placeholderReplaced = true;
        }
        // Kept-key NAMES, not just a count: a kept `test` on a brownfield now says "your own test
        // wiring survived" instead of hiding behind "1 already present".
        const keptNames = Object.keys(want).filter(k => preExisting.has(k) && !(k === "test" && placeholderReplaced));
        // cih-s1 F2: also merge the devDeps the SHIPPED HOOKS need so they run, not just exist.
        // .husky/pre-commit calls `npx lint-staged`; the canonical scripts call `husky` (prepare)
        // and sort-package-json. Without these the hooks are dead even after `npm install`. Same
        // non-destructive guard as scripts: only keys the consumer lacks. 2026-08-08: these three
        // specs now mirror CORE_DEVDEPS below EXACTLY — tilde, not caret, where the node-20.19
        // engines floor forced a pin below registry latest (the floor has moved WITHIN a major, so
        // a caret would re-open it). Fourth copy of the same specs lives in
        // tests/install-sh/f2-hook-activation.test.sh:34 (strict equality).
        // devDependencies object created if absent.
        const wantDev = {
          "husky": "^9.1.7",
          "lint-staged": "~16.4.0",
          "sort-package-json": "~3.7.1"
        };
        // Refresh sweep G5: --refresh installs no dependency, so it writes none either (a key with no
        // install breaks `npm ci` on the lockfile); each missing one is printed for the caller to name.
        if (process.env.AIF_MERGE_MODE === "refresh") {
          const haveDev = pkg.devDependencies || {};
          for (const k of Object.keys(wantDev)) if (!(k in haveDev)) process.stdout.write("MISSING_DEV " + k + " " + wantDev[k] + "\n");
          if (added > 0 || placeholderReplaced) fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
          process.stderr.write("  ✓ added " + added + " script(s); " + keptNames.length + " already present (kept: " + (keptNames.length ? keptNames.join(", ") : "none") + ")\n");
          if (placeholderReplaced) {
            process.stderr.write("  ✓ replaced npm-init \"test\" placeholder → \"" + want["test"] + "\" (the placeholder is npm-init noise, not consumer wiring; GH #1531)\n");
          }
          process.exit(0);
        }
        pkg.devDependencies = pkg.devDependencies || {};
        let addedDev = 0;
        for (const [k, v] of Object.entries(wantDev)) if (!(k in pkg.devDependencies)) { pkg.devDependencies[k] = v; addedDev++; }
        fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
        process.stderr.write("  ✓ added " + added + " script(s); " + keptNames.length + " already present (kept: " + (keptNames.length ? keptNames.join(", ") : "none") + ")\n");
        if (placeholderReplaced) {
          process.stderr.write("  ✓ replaced npm-init \"test\" placeholder → \"" + want["test"] + "\" (the placeholder is npm-init noise, not consumer wiring; GH #1531)\n");
        }
        process.stderr.write("  ✓ added " + addedDev + " hook devDep(s); " + (Object.keys(wantDev).length - addedDev) + " already present (kept)\n");
      ') || {
        # An unparseable package.json (a BOM, comments, a conflict marker): the install stops here as
        # it always has; a refresh names it and goes on, so the delivery baseline is still flushed.
        [ "$AIF_MERGE_MODE" = refresh ] || return 1
        note_not_wired "package.json scripts — not merged: package.json does not parse as JSON, and getff edits it only through a JSON parser"
        return 0
      }
      while IFS=' ' read -r _mcs_tag _mcs_dev _mcs_ver; do
        if [ "$_mcs_tag" = WITHHELD_PREPARE ]; then
          note_not_wired "script \"prepare\" in package.json — not added: it runs husky, which is not among your dependencies, and --refresh installs none (npm would then fail on \`npm install\`)"
        fi
        [ "$_mcs_tag" = MISSING_DEV ] || continue
        note_not_wired "devDependency $_mcs_dev ($_mcs_ver) in package.json — not added: --refresh installs no dependencies, and a devDependency written without an install puts package.json out of step with the lockfile (\`npm ci\` would then fail)"
      done <<< "$_mcs_out"
    else
      echo "  ⚠  node not found — package.json scripts NOT merged"
      note_not_wired "package.json scripts (validate, check:*, prepare) and the husky / lint-staged / sort-package-json devDependencies — not added: node is not on PATH, and getff edits package.json only through node"
    fi
  fi
}

# arm_recap_gate <settings> [install|refresh] — write env.AIF_RECAP_GATE=1 into .claude/settings.json (R-15: the
# recap-gate REJECTION ships dormant; `--full` arms it). The caller gates on --full. Temp file next
# to the target, `jq -e .` validate, atomic mv, skip when already set; no jq → the same merge through
# node. Shared by setup.d/10-skills.sh §1c and install.sh do_refresh under `--refresh --full`
# (refresh sweep 2026-09-29 G8, operator decision: --full on refresh arms what --full on install arms).
arm_recap_gate() {
  local settings="$1" _rg_mode="${2:-install}" _rg_rc _rg_tmp _rg_cur=""
  # On refresh a value the consumer set is theirs: an explicit "0" is an opt-out, kept and named.
  # (At install time no such value can exist yet, so the install path is unchanged.)
  if [ "$_rg_mode" = refresh ]; then
    if command -v jq >/dev/null 2>&1; then
      _rg_cur=$(jq -r '.env.AIF_RECAP_GATE // empty | tostring' "$settings" 2>/dev/null || true)
    elif command -v node >/dev/null 2>&1; then
      _rg_cur=$(AIF_S="$settings" node -e 'try { const v = ((JSON.parse(require("fs").readFileSync(process.env.AIF_S, "utf8")).env) || {}).AIF_RECAP_GATE; if (v !== undefined && v !== null) process.stdout.write(String(v)); } catch (e) {}' 2>/dev/null || true)
    fi
    if [ -n "$_rg_cur" ] && [ "$_rg_cur" != 1 ]; then
      echo "  ⊝ AIF_RECAP_GATE=$_rg_cur kept — a value set in .claude/settings.json is yours"
      note_not_wired "AIF_RECAP_GATE in .claude/settings.json — not armed: it is set to \"$_rg_cur\", a value you set, and --refresh does not overwrite it"
      return 0
    fi
  fi
  # jq absence is REPORTED, never silent: `--full` is an explicit request to arm, and a
  # no-op that prints nothing leaves the operator believing the gate is on when it is not.
  # Same shape as the deps-hash-check jq-less branch of setup.d/10-skills.sh §1b.
  if ! command -v jq >/dev/null 2>&1; then
    # No jq: the same env merge through node (lib.sh json_edit_node); rc 3 = already armed.
    _rg_rc=0
    json_edit_node "$settings" '
      if ((o.env || {}).AIF_RECAP_GATE === "1") return;
      o.env = Object.assign({}, o.env, { AIF_RECAP_GATE: "1" });
      return o;' || _rg_rc=$?
    case "$_rg_rc" in
      0) echo "  ✓ AIF_RECAP_GATE armed in .claude/settings.json (through node: jq is not on PATH)" ;;
      3) echo "  AIF_RECAP_GATE already armed" ;;
      *) echo "  ⚠ AIF_RECAP_GATE NOT armed — $(json_edit_node_why "$settings")" >&2
         note_not_wired "AIF_RECAP_GATE in .claude/settings.json — $(json_edit_node_why "$settings")" ;;
    esac
  elif [ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$settings" 2>/dev/null)" = "1" ]; then
    echo "  AIF_RECAP_GATE already armed"
  else
    # Temp file NEXT TO the target, never in $TMPDIR: `mv` across devices is a copy
    # that can fail half-way, and register_cc_hook (lib.sh) writes "$settings.tmp" for
    # exactly this reason. The `mv` gets its own `if` — as an AND-list a failed rename
    # under `set -euo pipefail` neither aborts nor prints, so a read-only tree finished
    # the install clean while the operator believed the gate was armed (review M-7).
    _rg_tmp="$settings.recapgate.tmp"
    if jq '.env = ((.env // {}) + {AIF_RECAP_GATE: "1"})' "$settings" > "$_rg_tmp" 2>/dev/null \
       && jq -e . "$_rg_tmp" >/dev/null 2>&1; then
      if mv "$_rg_tmp" "$settings"; then
        echo "  AIF_RECAP_GATE=1 armed (--full)"
      else
        rm -f "$_rg_tmp"; echo "  ⚠ could not write $settings — AIF_RECAP_GATE NOT armed"
      fi
    else
      rm -f "$_rg_tmp"; echo "  ⚠ could not arm AIF_RECAP_GATE — $settings left untouched"
    fi
  fi
}

# activate_husky_hookspath — point core.hooksPath at .husky so the shipped .husky/* hooks run
# (cih-s1 F2), never over a hook setup the consumer already runs (husky_hookspath_blocker) — that
# case is a NOT wired line with the reason. Sets HUSKY_HOOKSPATH_OWNED / HUSKY_HOOKS_BLOCKED for
# 99-finalize. Shared by setup.d/50-hooks.sh and install.sh do_refresh (refresh sweep 2026-09-29 G2):
# before it was shared, a --refresh never activated the hooks it had just re-copied.
activate_husky_hookspath() {
  local _hp_block _hp_prefix
  if [ -n "$DRY_RUN" ]; then
    echo "▶ git hooks → [dry-run] would set core.hooksPath=.husky"
  elif git -C "$PROJECT_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    # critical-review S4-3: never repoint a hook setup the consumer already runs (their own
    # hooksPath, live .git/hooks) or a hooksPath that would resolve outside this install root.
    _hp_block=$(husky_hookspath_blocker "$PROJECT_ROOT")
    if [ -n "$_hp_block" ]; then
      HUSKY_HOOKSPATH_OWNED=0
      HUSKY_HOOKS_BLOCKED="$_hp_block"
      echo "  ⊝ git hooks NOT activated: $_hp_block — kept as is"
      # Reason only (operator directive 2026-09-28): the consumer's own hook setup stays in charge,
      # and a subdirectory install would repoint the hooks of the whole repository — both are the
      # consumer's to decide, so the line names what is not active and why, with no command.
      _hp_prefix=$(git -C "$PROJECT_ROOT" rev-parse --show-prefix 2>/dev/null || true)
      note_not_wired "framework git hooks (${_hp_prefix}.husky/) — not active: $_hp_block, and getff does not repoint a hook setup the repository already has or one that covers more than this install"
    elif [ "$(git -C "$PROJECT_ROOT" config --get core.hooksPath 2>/dev/null)" = ".husky/_" ]; then
      HUSKY_HOOKSPATH_OWNED=0
      echo "▶ git hooks → core.hooksPath=.husky/_ kept (husky v9 runs .husky/pre-commit + pre-push)"
    else
      HUSKY_HOOKSPATH_OWNED=1
      git -C "$PROJECT_ROOT" config core.hooksPath .husky
      echo "▶ Activated git hooks → core.hooksPath=.husky"
    fi
  else
    echo "  ⊝ git hooks NOT activated — not a git repository"
    note_not_wired "framework git hooks (.husky/) — not active: $PROJECT_ROOT is not a git repository, so there is no core.hooksPath to set"
  fi
}

# husky_hookspath_blocker PROJECT_ROOT (critical-review S4-3)
# Echo ONE line naming why core.hooksPath must NOT be pointed at .husky — empty output means it is
# safe. Blocked when the consumer already runs its own hooks: a core.hooksPath other than ours
# (.husky, or husky v9's .husky/_ which calls .husky/<hook>), or — with core.hooksPath unset — any
# live non-sample hook in the hooks dir (lefthook, pre-commit, hand-written). Also blocked when the
# install root is below the git toplevel: a relative hooksPath resolves against the toplevel, where
# this .husky does not exist, so setting it would switch every hook off. Never fails (rc 0).
husky_hookspath_blocker() {
  local proj="$1" cur top here hooks_dir h
  git -C "$proj" rev-parse --git-dir >/dev/null 2>&1 || return 0
  cur=$(git -C "$proj" config --get core.hooksPath 2>/dev/null || true)
  case "$cur" in
    ""|.husky|.husky/|.husky/_|.husky/_/) ;;
    *) echo "core.hooksPath is already '$cur' (your own hooks)"; return 0 ;;
  esac
  top=$(git -C "$proj" rev-parse --show-toplevel 2>/dev/null || true)
  here=$(cd "$proj" 2>/dev/null && pwd -P)
  if [ -n "$top" ] && [ "$here" != "$(cd "$top" 2>/dev/null && pwd -P)" ]; then
    echo "the install root is not the git toplevel ($top)"; return 0
  fi
  if [ -z "$cur" ]; then
    hooks_dir=$(if cd "$proj" 2>/dev/null && cd "$(git rev-parse --git-path hooks 2>/dev/null)" 2>/dev/null; then pwd -P; fi)
    if [ -n "$hooks_dir" ]; then
      for h in "$hooks_dir"/*; do
        case "$h" in *.sample) continue ;; esac
        if [ -f "$h" ] && [ -x "$h" ]; then
          echo "live git hook ${h##*/} in $hooks_dir"; return 0
        fi
      done
    fi
  fi
  return 0
}

# note_not_wired <line> — record a framework piece left unwired because the consumer owns that
# surface (printed in the 99-finalize summary). Tolerates NOT_WIRED being undeclared (lib-only use).
note_not_wired() {
  NOT_WIRED+=("$1")
}

# print_not_wired — print the NOT-wired summary: a header, then one «- …» line per piece. Shared by
# 99-finalize and the toolchain lanes, which exit before 99-finalize runs and so print their own.
# Operator directive 2026-09-28 (Q4.7): each line names what was left undone and why; nothing here
# tells the reader what to do.
# print_getff_added — the consumer-owned files getff inserted its block into this run (Q4.7,
# note_getff_added), each original kept in .ai-factory/before-getff/. Shared by setup.d/99-finalize.sh
# and install.sh do_refresh, whose eslint wiring can insert into the consumer's own configs too.
print_getff_added() {
  [ "${#GETFF_ADDED_TO[@]}" -gt 0 ] || return 0
  echo ""
  echo "✓  getff's block added to ${#GETFF_ADDED_TO[@]} of your own file(s) — by insertions only; each original is kept in .ai-factory/before-getff/:"
  printf '      - %s\n' "${GETFF_ADDED_TO[@]}"
}

print_not_wired() {
  [ "${#NOT_WIRED[@]}" -gt 0 ] || return 0
  echo ""
  echo "⚠  ${#NOT_WIRED[@]} framework piece(s) NOT wired, or wired only in part — each line says why:"
  printf '      - %s\n' "${NOT_WIRED[@]}"
  echo ""
}

# note_getff_added <rel> — record a consumer file getff added its block to by insertions only (Q4.7),
# for 99-finalize's summary. Once per file: in a multi-stack monorepo the per-workspace synth-wire
# and the R2 wirer can both add to the same consumer config (cold review, 2026-09-28).
note_getff_added() {
  local _a
  for _a in ${GETFF_ADDED_TO[@]+"${GETFF_ADDED_TO[@]}"}; do [ "$_a" = "$1" ] && return 0; done
  GETFF_ADDED_TO+=("$1")
}

# DEPCRUISE_CONFIG_NAMES — the config names dependency-cruiser loads by default, in its own lookup
# order (doc/cli.md `--config`: .js, .cjs, .mjs, .ts, .cts, .mts, .json). Shared by
# foreign_tool_config and depcruise_config; packages/core/audit-self/check-arch-boundaries.sh ships
# to the consumer without lib.sh and repeats the list.
DEPCRUISE_CONFIG_NAMES=".dependency-cruiser.js .dependency-cruiser.cjs .dependency-cruiser.mjs .dependency-cruiser.ts .dependency-cruiser.cts .dependency-cruiser.mts .dependency-cruiser.json"

# depcruise_config <dir> — echo the dependency-cruiser config in <dir> that dependency-cruiser itself
# would load (the first of DEPCRUISE_CONFIG_NAMES present), or nothing.
depcruise_config() {
  local dir="$1" f
  for f in $DEPCRUISE_CONFIG_NAMES; do
    if [ -e "$dir/$f" ]; then echo "$f"; return 0; fi
  done
  return 0
}

# ESLINT_FLAT_CONFIG_NAMES — the flat config names ESLint 9 looks for in a directory, in its own
# lookup order (eslint lib/config/config-loader.js FLAT_CONFIG_FILENAMES): the first one present is
# the config ESLint loads there. packages/core/audit-self/check-rule-globs.sh and
# check-rule-enforced.sh ship to the consumer without lib.sh and repeat the list.
ESLINT_FLAT_CONFIG_NAMES="eslint.config.js eslint.config.mjs eslint.config.cjs eslint.config.ts eslint.config.mts eslint.config.cts"

# eslint_flat_config <dir> — echo the name of the flat config ESLint loads in <dir>, or nothing.
eslint_flat_config() {
  local dir="$1" f
  for f in $ESLINT_FLAT_CONFIG_NAMES; do
    if [ -e "$dir/$f" ]; then echo "$f"; return 0; fi
  done
  return 0
}

# eslint_flat_configs_under <dir> — the config ESLint loads in each directory at or under <dir> that
# has one (eslint_flat_config), NUL-terminated, once per directory. Pruned: node_modules, build output
# (dist, coverage, .stryker-tmp, .next), .git, and .claude/worktrees — Claude Code's checked-out copies
# of the repo, not packages of it. That is CFG_PRUNE of the push gates (check-rule-globs.sh,
# check-rule-enforced.sh) less its */packages/core, which would cut a workspace of that name, so the
# install writes to the workspace configs the gates then read. -mindepth 1: <dir> itself is never
# pruned, whatever its name. The
# per-package and per-workspace passes of 99-finalize read a directory the way ESLint does, so a
# package's own eslint.config.js is found as the root one is (they used to look for
# eslint.config.mjs only, and an eslint.config.js got nothing, unreported).
eslint_flat_configs_under() {
  local n f d seen="|" names=()
  for n in $ESLINT_FLAT_CONFIG_NAMES; do names+=( -o -name "$n" ); done
  while IFS= read -r -d '' f; do
    d=$(dirname "$f")
    case "$seen" in *"|$d|"*) continue ;; esac
    seen="$seen$d|"
    n=$(eslint_flat_config "$d")
    [ -z "$n" ] || printf '%s\0' "$d/$n"
  done < <(find "$1" -mindepth 1 \( -name node_modules -o -name dist -o -name coverage -o -name .stryker-tmp \
               -o -name .next -o -name .git -o -path '*/.claude/worktrees' \) -prune \
             -o \( "${names[@]:1}" \) -print0 2>/dev/null)
  return 0
}

# eslint_config_code <file> — <file> with its // and /* */ comments cut out, as the ESLint config's
# code: quoted strings stay, a /* */ comment may span lines, and a template literal's text and a regex
# literal are cut too (neither is a rule id). The install's greps for a rule id, RULE_GLOBS or a boundary
# glob read this, not the raw file — `// TODO: turn on 'rules-as-tests/no-unsafe-zod-parse'` is not R2
# wired (#1889 observation 7). uncomment() and the regexctx() it calls are the push gates' own (the
# rule-globs reader in packages/core/audit-self/check-rule-globs.sh and check-rule-enforced.sh, which
# ship without lib.sh), byte for byte: tests/install-sh/installer-greps-read-code.test.sh compares them.
# Prints nothing for a missing file, so a grep over the result is false as a grep of that file would be.
ESLINT_UNCOMMENT_AWK='
function regexctx(out,   w) {
  if (last == "" || index("(,=:[!&|?{};+-*%<>~^}", last) > 0) return 1
  if (last !~ /[A-Za-z]/) return 0
  w = out; sub(/[[:space:]]+$/, "", w)
  if (!match(w, /[A-Za-z_$][A-Za-z0-9_$]*$/)) return 0
  return substr(w, RSTART) ~ /^(return|typeof|case|in|of|delete|void|throw|new|else|do|yield|await|instanceof)$/
}
function uncomment(s,   out, c, q, i, j, n, cls) {
  out = ""; q = ""; n = length(s)
  for (i = 1; i <= n; i++) {
    c = substr(s, i, 1)
    if (incmt) { if (c == "*" && substr(s, i + 1, 1) == "/") { incmt = 0; i++ }; continue }
    if (intpl) { if (c == "\\") i++; else if (c == "`") { intpl = 0; out = out c; last = c }; continue }
    if (q != "") { out = out c; if (c == "\\") { out = out substr(s, i + 1, 1); i++ } else if (c == q) { q = ""; last = c }; continue }
    if (c == "/" && substr(s, i + 1, 1) == "/") break
    if (c == "/" && substr(s, i + 1, 1) == "*") { incmt = 1; i++; continue }
    if (c == "/" && regexctx(out)) {
      cls = 0
      for (j = i + 1; j <= n; j++) {
        c = substr(s, j, 1)
        if (c == "\\") j++
        else if (cls) { if (c == "]") cls = 0 }
        else if (c == "[") cls = 1
        else if (c == "/") break
      }
      if (j <= n) { out = out "0"; last = "0"; i = j; continue }
      c = "/"
    }
    if (c == "`") { intpl = 1; out = out c; last = c; continue }
    if (c == sq || c == dq) q = c
    out = out c
    if (c !~ /[[:space:]]/) last = c
  }
  return out
}
'
eslint_config_code() {
  [ -f "$1" ] && [ -r "$1" ] || return 0
  awk -v sq="'" -v dq='"' "$ESLINT_UNCOMMENT_AWK"'{ print uncomment($0) }' "$1" 2>/dev/null || return 0
}

# eslint_config_has_getff_rules <file> — true when the config names one of getff's rules
# (rules-as-tests/…) or imports / re-exports / require()s, by a relative path, a config that does: a
# workspace config spreading a sibling's getff preset has getff's rules (second cold review, after
# #1868). Every relative import on a line counts (third cold review). Followed up to
# four imports deep, each file read once, so an import cycle ends. A bare package import is not
# followed — what it resolves to is not a file of this project to read. Each file is read as code
# (eslint_config_code): a rule id or an import in a comment does not count.
eslint_config_has_getff_rules() {
  local seen="|" f dir spec code depth=0
  local queue=("$1") next
  while [ "${#queue[@]}" -gt 0 ] && [ "$depth" -le 4 ]; do
    next=()
    for f in "${queue[@]}"; do
      case "$seen" in *"|$f|"*) continue ;; esac
      seen="$seen$f|"
      [ -f "$f" ] || continue
      code=$(eslint_config_code "$f")   # a rule or an import in a comment is not in the config
      grep -q 'rules-as-tests/' <<<"$code" && return 0
      dir=$(dirname "$f")
      while IFS= read -r spec; do
        [ -n "$spec" ] && next+=("$dir/$spec")
      done < <(grep -oE "(from|import|require)[[:space:]]*[(]?[[:space:]]*['\"]\.\.?/[^'\"]+['\"]" <<<"$code" \
                 | sed -E "s/.*['\"](\.\.?\/[^'\"]+)['\"]$/\1/")
    done
    queue=(${next[@]+"${next[@]}"})
    depth=$((depth + 1))
  done
  return 1
}

# note_eslint_config_not_esm <abs-dir> <config-name> — the not-wired line for a flat config getff does
# not add its block to: an eslint.config.cjs/.ts/.mts/.cts has no ES-module export to append to.
# Named once however many steps reach it — 40-configs places nothing beside it, and each 99-finalize
# pass that would add to it finds it again.
note_eslint_config_not_esm() {
  local line n where="$1"
  # The directory as the summary names it: project-relative, never the absolute install path (#1878).
  if [ "$where" = "${PROJECT_ROOT:-}" ]; then where="the project root"; else where="${where#"${PROJECT_ROOT:-}"/}"; fi
  line="eslint: getff's rules are not in the ESLint config of $where — your $2 configures ESLint there, and getff adds its block only to an ES-module flat config (eslint.config.js or eslint.config.mjs)"
  for n in ${NOT_WIRED[@]+"${NOT_WIRED[@]}"}; do [ "$n" = "$line" ] && return 0; done
  note_not_wired "$line"
}

# KEPT_ORIGINALS — the files whose original this install run has kept (keep_original_mark). A file
# two passes write — the live snippet, then R2, into one workspace config — is snapshotted by the
# first only: the second pass's copy would already carry the first pass's block, and be announced
# as a second «original» (cold-review F9).
KEPT_ORIGINALS=()

# keep_original_snapshot <abs-file> — before getff writes into a file the consumer owns (operator
# decision Q4.7, 2026-09-28: getff adds its block to the consumer's ESLint config itself, keeping
# the original), copy the file aside and echo the copy's path. Pair it with keep_original_settle.
# Echoes nothing for a file whose original this run already kept (KEPT_ORIGINALS).
keep_original_snapshot() {
  local f="$1" snap k
  for k in ${KEPT_ORIGINALS[@]+"${KEPT_ORIGINALS[@]}"}; do [ "$k" = "$f" ] && return 0; done
  snap=$(mktemp "${TMPDIR:-/tmp}/getff-before.XXXXXX") || return 1
  if ! cp "$f" "$snap" 2>/dev/null; then rm -f "$snap"; return 1; fi
  echo "$snap"
}

# keep_original_mark <abs-file> — record that this run kept <abs-file>'s original (keep_original_settle
# echoed where), so a later keep_original_snapshot of it keeps nothing more. Call it in the install's
# own shell: settle runs inside $(…), where a global it set would be lost.
keep_original_mark() {
  KEPT_ORIGINALS+=("$1")
}

# keep_original_settle <abs-file> <snapshot> — after the write: when it changed the file, move the
# snapshot to .ai-factory/before-getff/<path from the project root>.<sha8> and echo where it went
# (the same <name>.<sha8> shape as .ai-factory/refresh-conflicts/); when it did not, drop the
# snapshot and echo nothing, so a re-install that adds nothing keeps no second copy.
# When the changed file's original cannot be kept aside (mkdir/mv fails), the write is undone — the
# original goes back in place, a warning names the file on stderr — and it returns 1: the caller
# reports getff's block as not wired (cold-review F10: the snapshot used to be deleted silently).
keep_original_settle() {
  local f="$1" snap="$2" sum8 dest rel
  [ -n "$snap" ] && [ -f "$snap" ] || return 0
  if cmp -s "$snap" "$f"; then rm -f "$snap"; return 0; fi
  sum8=$(_hash256 "$snap") || sum8=original
  rel="${f#"${PROJECT_ROOT:-.}"/}"
  dest="${PROJECT_ROOT:-.}/.ai-factory/before-getff/$rel.${sum8:0:8}"
  if mkdir -p "$(dirname "$dest")" 2>/dev/null && mv "$snap" "$dest" 2>/dev/null; then
    echo "$dest"
    return 0
  fi
  if cp "$snap" "$f" 2>/dev/null; then
    rm -f "$snap"
    echo "  ⚠ could not keep your original $rel at ${dest#"${PROJECT_ROOT:-.}"/} — getff's changes to it are undone, it is as it was" >&2
  else
    echo "  ⚠ could not keep your original $rel at ${dest#"${PROJECT_ROOT:-.}"/}, nor put it back — it is at $snap" >&2
  fi
  return 1
}

# foreign_tool_config <dir> <eslint|lint-staged|prettier|dependency-cruiser> — echo the consumer's own config for that
# tool in <dir> under any name OTHER than the one we ship (critical-review S4-2/S4-4/S4-5). copy_safe
# only sees its exact destination name, so a consumer eslint.config.cjs, .prettierrc or
# package.json#lint-staged used to get our file placed beside it — and each tool picks ours first,
# which switched the consumer's settings off without a word. Echoes nothing when there is none.
# The package.json key is read as JSON (node): a devDependency named "lint-staged" is not a config.
foreign_tool_config() {
  local dir="$1" kind="$2" names key f
  case "$kind" in
    eslint)
      # Flat names only: the install pins eslint@^9 (70-deps CORE_DEVDEPS), which never reads an
      # .eslintrc* / package.json#eslintConfig — see legacy_eslint_config below.
      names="eslint.config.js eslint.config.cjs eslint.config.ts eslint.config.mts eslint.config.cts"
      key="" ;;
    lint-staged)
      names=".lintstagedrc .lintstagedrc.js .lintstagedrc.cjs .lintstagedrc.mjs .lintstagedrc.ts .lintstagedrc.yaml .lintstagedrc.yml lint-staged.config.js lint-staged.config.cjs lint-staged.config.mjs lint-staged.config.ts"
      key=lint-staged ;;
    prettier)
      names=".prettierrc .prettierrc.yaml .prettierrc.yml .prettierrc.json5 .prettierrc.js .prettierrc.cjs .prettierrc.mjs .prettierrc.ts .prettierrc.toml prettier.config.js prettier.config.cjs prettier.config.mjs prettier.config.ts"
      key=prettier ;;
    dependency-cruiser)
      # Every name dependency-cruiser loads by default except the .mjs we ship — a .cjs left by an
      # earlier getff install is consumer-owned after that install (refresh never touches it).
      names="${DEPCRUISE_CONFIG_NAMES/.dependency-cruiser.mjs /}"
      key="" ;;
    *) return 0 ;;
  esac
  for f in $names; do
    if [ -e "$dir/$f" ]; then echo "$f"; return 0; fi
  done
  if [ -n "$key" ] && [ -f "$dir/package.json" ] && command -v node >/dev/null 2>&1 \
    && GETFF_PKG="$dir/package.json" GETFF_KEY="$key" node -e '
      const p = JSON.parse(require("fs").readFileSync(process.env.GETFF_PKG, "utf8"));
      process.exit(p && Object.prototype.hasOwnProperty.call(p, process.env.GETFF_KEY) ? 0 : 1);
    ' 2>/dev/null; then
    echo "package.json#$key"
  fi
  return 0
}

# legacy_eslint_config <dir> — echo the eslintrc-format config in <dir> (.eslintrc*, or
# package.json#eslintConfig), or nothing. ESLint 9 ignores these, so they are NOT a reason to skip
# the flat config (skipping left ESLint with no config and the placed lint-staged `eslint --fix`
# failed every commit — critical-review cold pass M1); the consumer is told instead.
legacy_eslint_config() {
  local dir="$1" f
  for f in .eslintrc .eslintrc.js .eslintrc.cjs .eslintrc.json .eslintrc.yml .eslintrc.yaml; do
    if [ -e "$dir/$f" ]; then echo "$f"; return 0; fi
  done
  if [ -f "$dir/package.json" ] && command -v node >/dev/null 2>&1 \
    && GETFF_PKG="$dir/package.json" node -e '
      const p = JSON.parse(require("fs").readFileSync(process.env.GETFF_PKG, "utf8"));
      process.exit(p && Object.prototype.hasOwnProperty.call(p, "eslintConfig") ? 0 : 1);
    ' 2>/dev/null; then
    echo "package.json#eslintConfig"
  fi
  return 0
}

# copy_unless_foreign <eslint|lint-staged|prettier|dependency-cruiser> <src> <dst> [copy_safe args…] — copy_safe, unless
# the consumer already configures that tool under another name in dst's directory: then place
# nothing, keep theirs, and record it for the not-wired summary (operator decision 2026-09-23:
# skip + report, never overwrite or merge a consumer's tool config). An eslint.config.js is not
# recorded, at the root or in a workspace: 99-finalize adds getff's block to it (operator decision Q4.7).
copy_unless_foreign() {
  local kind="$1" src="$2" dst="$3" own where
  shift 3
  own=$(foreign_tool_config "$(dirname "$dst")" "$kind")
  # The directory as the summary names it: project-relative, never the absolute install path.
  where="${dst%/*}"
  if [ "$where" = "${PROJECT_ROOT:-}" ]; then where="the project root"; else where="${where#"${PROJECT_ROOT:-}"/}"; fi
  if [ -n "$own" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: $dst (your own $kind config $own is kept)"
    else
      echo "  ⊝ $dst not placed — your own $kind config ($own) is kept"
    fi
    if [ "$kind" != "eslint" ]; then
      # Reason only (operator directive 2026-09-28): getff adds its block to a consumer's own ESLint
      # config (Q4.7) but not to a prettier / lint-staged / dependency-cruiser one (decision
      # 2026-09-23 stands for those), so the line names what stays out and why — no merge step.
      note_not_wired "$kind: getff's ${dst##*/} is not in $where — your $own configures $kind there, and getff does not change a project's own $kind config, so $kind runs with your settings only"
    elif [ "$own" = "eslint.config.js" ]; then
      # 99-finalize adds getff's block to an eslint.config.js — at the root and in a workspace — the
      # way it does to a consumer's own eslint.config.mjs (operator decision Q4.7), and reports the
      # outcome there.
      :
    else
      note_eslint_config_not_esm "$(dirname "$dst")" "$own"
      # The root ESLint config is what the self-verify fences-fire claim is about (99-finalize).
      if [ "$(dirname "$dst")" = "${PROJECT_ROOT:-}" ]; then
        ESLINT_ROOT_NOT_WIRED=1
      fi
    fi
    return 0
  fi
  copy_safe "$src" "$dst" "$@"
  if [ "$kind" = "eslint" ] && [ "$DRY_RUN" != "--dry-run" ]; then
    own=$(legacy_eslint_config "$(dirname "$dst")")
    # Reason only: carrying the eslintrc rules over is a migration getff does not run — the
    # official @eslint/migrate-config writes eslint.config.mjs (the file getff just placed), needs
    # the network and new packages, and drops any logic in a JS eslintrc (prior-art-evaluations.md#289).
    [ -z "$own" ] || note_not_wired "eslint: your $own in $where is not read by ESLint 9 (flat config only), so its rules are not in the lint — ${dst##*/} drives lint there, and getff does not migrate an eslintrc"
  fi
}

# husky_note_consumer_hooks PKG_ROOT PROJECT_ROOT (critical-review S3-1)
# Call BEFORE 50-hooks' copy_safe of .husky/pre-{commit,push}. Appends to HUSKY_CONSUMER_HOOKS the
# name of every hook already on disk whose bytes differ from the shipped template and that lacks
# the framework's identity marker: those are the consumer's own, copy_safe will keep them, and
# reassert_husky_shields must keep them too. A hook byte-identical to the template, or marked as
# the framework's, is the framework's own delivery and stays re-assertable. Under
# --force the consumer asked for the overwrite (copy_safe preserves a copy), so nothing is noted.
HUSKY_CONSUMER_HOOKS=""
husky_note_consumer_hooks() {
  local fw_root="$1" proj="$2" hook src dst
  [ "${FORCE:-}" = "--force" ] && return 0
  for hook in pre-commit pre-push; do
    src="$fw_root/packages/core/templates/shared/husky-$hook.sh"; dst="$proj/.husky/$hook"
    [ -e "$dst" ] || continue
    cmp -s "$src" "$dst" && continue
    # An older framework revision carries the hook's identity marker (pre-commit since #1001,
    # pre-push since 2026-05-22): still the framework's, still re-assertable on an upgrade.
    case "$hook" in
      pre-commit) grep -q '@aif-shield: pre-commit' "$dst" 2>/dev/null && continue ;;
      pre-push)   grep -q 'shipped by install.sh via husky-pre-push.sh' "$dst" 2>/dev/null && continue ;;
    esac
    HUSKY_CONSUMER_HOOKS="$HUSKY_CONSUMER_HOOKS $hook"
  done
  return 0
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
    # S3-1: a hook the consumer owned before this install is theirs — never re-assert over it.
    case " ${HUSKY_CONSUMER_HOOKS:-} " in *" ${dst##*/} "*) continue ;; esac
    if [ ! -f "$dst" ] || ! cmp -s "$src" "$dst"; then
      mkdir -p "$(dirname "$dst")"
      cp "$src" "$dst"
      chmod +x "$dst" 2>/dev/null || true
      reasserted=1
    fi
  done
  # S4-3: re-pin only when this install is the one that pointed core.hooksPath at .husky (50-hooks
  # sets HUSKY_HOOKSPATH_OWNED=1) — never over a hook setup the consumer owns. Lib-only callers
  # (tests) that do not set it keep the historical re-pin.
  if [ "${HUSKY_HOOKSPATH_OWNED:-1}" = "1" ]; then
    git -C "$proj" config core.hooksPath .husky 2>/dev/null || true
  fi
  if [ "$reasserted" = "1" ]; then
    local mgr=""
    grep -q '"simple-git-hooks"' "$proj/package.json" 2>/dev/null && mgr="simple-git-hooks"
    echo "⚠  re-asserted framework .husky/pre-push + pre-commit after dep-install${mgr:+ (a competing \"$mgr\" prepare hook had clobbered them)} — a later package-manager install can clobber them again while that manager's hooks stay installed. (GH #975)"
  fi
  return 0
}

# json_edit_node FILE JS [ARG…] — the jq-less path for the installer's JSON writes (.claude/settings.json,
# .mcp.json). Reads FILE as JSON (an absent file reads as {}), runs JS as the body of a function
# (o, args) — o the parsed object, args the ARGs — and writes what it returns next to FILE, then renames
# it into place. JS returning nothing means «already there»: nothing is written, rc 3. rc 1 = node is
# not on PATH, FILE is not JSON, or the write failed; FILE is then left as it was and no .tmp remains.
# Before this helper a missing jq printed «add manually to …» — a manual step (operator directive
# 2026-09-28: the install never hands one back); node is present wherever the JS/TS install runs.
json_edit_node() {
  local file="$1" js="$2"
  shift 2
  command -v node >/dev/null 2>&1 || return 1
  GETFF_JSON_FILE="$file" GETFF_JSON_JS="$js" node -e '
    const fs = require("fs");
    const f = process.env.GETFF_JSON_FILE, tmp = f + ".tmp";
    try {
      const o = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
      // Only a JSON object is a settings/.mcp.json: `[]`, a string or a number would be written back
      // unchanged while the caller printed «✓ registered» (cold review, 2026-09-28).
      if (o === null || typeof o !== "object" || Array.isArray(o)) process.exit(1);
      const out = new Function("o", "args", process.env.GETFF_JSON_JS)(o, process.argv.slice(1));
      if (out === undefined) process.exit(3);
      fs.writeFileSync(tmp, JSON.stringify(out, null, 2) + "\n");
      fs.renameSync(tmp, f);
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch (_) { /* no tmp was written */ }
      process.exit(1);
    }' "$@" 2>/dev/null
}

# json_edit_node_why FILE — the reason a json_edit_node write did not happen, for a NOT-wired line.
json_edit_node_why() {
  if ! command -v node >/dev/null 2>&1; then
    echo "neither jq nor node is on PATH, and getff edits JSON only through one of them"
  else
    echo "${1#"${PROJECT_ROOT:-}"/} is not a valid JSON object or could not be written, so it was left as it was"
  fi
}

# add_context7_mcp FILE — the jq-less arm of the context7 entry in .mcp.json (05-mcp, the python lane):
# sets .mcpServers.context7 through node and keeps every other server, as the jq merge does.
add_context7_mcp() {
  local file="$1"
  if json_edit_node "$file" '
      o.mcpServers = o.mcpServers || {};
      o.mcpServers.context7 = { command: "npx", args: ["-y", "@upstash/context7-mcp@latest"] };
      return o;'; then
    echo "  ✓ context7 added to ${file##*/} (through node: jq is not on PATH)"
  else
    echo "  ⚠ context7 NOT added to ${file##*/} — $(json_edit_node_why "$file")"
    note_not_wired "context7 MCP server in ${file#"${PROJECT_ROOT:-}"/} — $(json_edit_node_why "$file")"
  fi
  return 0
}

# register_cc_hook SETTINGS EVENT CMD MARKER [MATCHER] (GH #934)
# Idempotently register a Claude Code hook in .claude/settings.json under EVENT
# (Stop / UserPromptSubmit / PostToolUse / …), NON-DESTRUCTIVELY: appends to any
# existing hooks on that event (never clobbers a consumer-authored hook), and no-ops
# when MARKER is already present (re-run adds nothing). Creates a minimal settings.json
# if absent. SSOT for the settings hooks-merge so install (setup.d) + refresh (do_refresh)
# share one implementation (dual-implementation-discipline §7). The merge is JSON-safe (the
# shipped commands carry embedded quotes for $CLAUDE_PROJECT_DIR): jq, or node through
# json_edit_node when jq is absent; with neither, the hook is a NOT-wired line with that reason —
# never a silent skip, and never a manual step.
#
# Optional 5th arg MATCHER: for tool-scoped events (PreToolUse / PostToolUse) pass the
# tool-name matcher (e.g. "AskUserQuestion", "Edit|Write") so the entry gets a `matcher`
# field — parity with the framework's own settings.json shape. When MATCHER is empty
# (Stop / UserPromptSubmit — no tool scope) the entry is written matcher-less, byte-for-byte
# as before (the #1003 Stop path is unchanged).
register_cc_hook() {
  local settings="$1" event="$2" cmd="$3" marker="$4" matcher="${5:-}" rc=0
  if ! command -v jq >/dev/null 2>&1; then
    # No jq: the same append through node (json_edit_node), with the same per-event idempotence.
    # shellcheck disable=SC2016  # JavaScript, not shell expansions
    json_edit_node "$settings" '
      const [e, c, m, marker] = args;
      o.hooks = o.hooks || {};
      const list = o.hooks[e] || [];
      if (list.some(g => (g.hooks || []).some(h => new RegExp(marker).test(h.command || "")))) return;
      o.hooks[e] = list.concat([m ? { matcher: m, hooks: [{ type: "command", command: c }] }
                                  : { hooks: [{ type: "command", command: c }] }]);
      return o;' "$event" "$cmd" "$matcher" "$marker" || rc=$?
    case "$rc" in
      0) echo "  ✓ $marker registered as a $event hook in .claude/settings.json (through node: jq is not on PATH)" ;;
      3) echo "  ⊝ $marker already registered on $event in .claude/settings.json" ;;
      *) echo "  ⚠ $marker NOT registered on $event — $(json_edit_node_why "$settings")"
         note_not_wired "Claude Code hook $marker on $event in .claude/settings.json — $(json_edit_node_why "$settings")" ;;
    esac
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
    # ledger A1-9b (sibling of A1-9 below, same "✓ as a success claim" family): this used to be
    # `jq -n … > "$settings"` followed by an UNCONDITIONAL ✓. Because the redirect creates the
    # file BEFORE jq runs, a failing jq (absent filter support, OOM, a read-only tree) left a
    # ZERO-BYTE .claude/settings.json in the consumer tree — which Claude Code rejects outright
    # and which every later `jq -e … "$settings"` in the same install then fails to parse.
    # Unlike the append path this is a SIMPLE command, so under install.sh's `set -euo pipefail`
    # it aborted the whole install message-lessly right after the empty file appeared; in any
    # set -e-exempt context it printed the ✓ over the empty file instead. Write to a tmp, ✓ only
    # after the mv, drop the tmp and warn on failure, and never leave a half-created settings.json.
    if jq -n --arg e "$event" --arg c "$cmd" --arg m "$matcher" \
      "{hooks: {(\$e): [$group_filter]}}" > "$settings.tmp" && mv "$settings.tmp" "$settings"; then
      echo "  ✓ .claude/settings.json created with $event hook ($marker)"
    else
      rm -f "$settings.tmp" 2>/dev/null || true
      echo "  ⚠ jq could not create $settings — no settings file written, $marker NOT registered on $event" >&2
    fi
  elif jq -e --arg e "$event" --arg m "$marker" \
      '((.hooks[$e] // []) | map(.hooks[].command) | any(test($m)))' "$settings" >/dev/null 2>&1; then
    # Idempotence is PER-EVENT (not whole-file): the same hook may register on two events
    # (e.g. inject-project-digest on UserPromptSubmit AND SubagentStart) — a whole-file grep
    # would false-match the first event's entry and skip the second. GH #934 batch D.
    echo "  ⊝ $marker already registered on $event in .claude/settings.json"
  else
    # ledger A1-9 (the A1-8 class, fixed for merge_fenced in #1632): the unconditional ✓ below used
    # to print even when jq or the redirect failed — `&&` skipped the mv, the consumer's
    # settings.json kept its old content with the hook absent, and settings.json.tmp was left in
    # their tree. Every caller of register_cc_hook shipped that lie.
    if jq --arg e "$event" --arg c "$cmd" --arg m "$matcher" \
      ".hooks[\$e] = ((.hooks[\$e] // []) + [$group_filter])" \
      "$settings" > "$settings.tmp" && mv "$settings.tmp" "$settings"; then
      echo "  ✓ $marker registered as a $event hook in .claude/settings.json"
    else
      rm -f "$settings.tmp" 2>/dev/null || true
      echo "  ⚠ jq rewrite of $settings failed — file left unchanged, $marker NOT registered on $event" >&2
    fi
  fi
}

# rule_globs_boundary <file> — RULE_GLOBS.boundary of an ESLint flat config, read the way getff's
# own-config wirer reads it (wireOwnConfig, packages/core/install/wire-eslint-r2.ts), for a caller
# that must say what that wirer would do without running it. First line: `none` when the file
# declares no top-level RULE_GLOBS; `no-array` when it declares one whose value is not an object
# literal with a `boundary: [` array of its own (the wirer refuses R2 there); `array` otherwise,
# followed by the array's string elements, one per line. Elements, not text: a glob in a comment, in
# another key or in a nested object is none of them. A tokenizer, not a parser — a regex literal
# holding a quote or `//` can throw it off. Exit 1 (nothing printed) when <file> is no file.
rule_globs_boundary() {
  [ -f "$1" ] || return 1
  awk -v sq="'" '
    function tok(type, val) { nt++; tt[nt] = type; tv[nt] = val }
    function opens(k) { return tt[k] == "p" && (tv[k] == "{" || tv[k] == "[" || tv[k] == "(") }
    function closes(k) { return tt[k] == "p" && (tv[k] == "}" || tv[k] == "]" || tv[k] == ")") }
    { src = src $0 "\n" }
    END {
      n = length(src); i = 1; nt = 0
      while (i <= n) {
        c = substr(src, i, 1)
        if (c == " " || c == "\t" || c == "\n" || c == "\r") { i++; continue }
        if (c == "/" && substr(src, i + 1, 1) == "/") {
          j = index(substr(src, i), "\n"); i = (j ? i + j : n + 1); continue
        }
        if (c == "/" && substr(src, i + 1, 1) == "*") {
          j = index(substr(src, i + 2), "*/"); i = (j ? i + j + 3 : n + 1); continue
        }
        if (c == sq || c == "\"" || c == "`") {
          # A template literal with a ${…} substitution is no string element for the wirer either.
          q = c; v = ""; plain = 1; i++
          while (i <= n) {
            d = substr(src, i, 1)
            if (d == "\\") { v = v substr(src, i + 1, 1); i += 2; continue }
            if (d == q) break
            if (q == "`" && d == "$" && substr(src, i + 1, 1) == "{") plain = 0
            v = v d; i++
          }
          i++; tok(plain ? "str" : "tpl", v); continue
        }
        if (c ~ /[A-Za-z_$]/) {
          v = c; i++
          while (i <= n && substr(src, i, 1) ~ /[A-Za-z0-9_$]/) { v = v substr(src, i, 1); i++ }
          tok("id", v); continue
        }
        tok("p", c); i++
      }
      # The declaration: `const|let|var RULE_GLOBS` outside every bracket, as the wirer takes only
      # a top-level one.
      depth = 0; decl = 0
      for (k = 1; k <= nt; k++) {
        if (depth == 0 && tt[k] == "id" && (tv[k] == "const" || tv[k] == "let" || tv[k] == "var") &&
            tt[k + 1] == "id" && tv[k + 1] == "RULE_GLOBS") { decl = k + 1; break }
        if (opens(k)) depth++; else if (closes(k)) depth--
      }
      if (!decl) { print "none"; exit }
      if (!(tv[decl + 1] == "=" && tt[decl + 2] == "p" && tv[decl + 2] == "{")) { print "no-array"; exit }
      # Its own `boundary:` key (depth 1 of the object literal), and that key holding an array.
      rd = 1; arr = 0
      for (k = decl + 3; k <= nt && rd > 0; k++) {
        if (opens(k)) { rd++; continue }
        if (closes(k)) { rd--; continue }
        if (rd == 1 && tt[k] == "id" && tv[k] == "boundary" && tv[k + 1] == ":") {
          if (tv[k + 2] == "[" && tt[k + 2] == "p") arr = k + 2
          break
        }
      }
      if (!arr) { print "no-array"; exit }
      print "array"
      ad = 1
      for (k = arr + 1; k <= nt && ad > 0; k++) {
        if (opens(k)) { ad++; continue }
        if (closes(k)) { ad--; continue }
        if (ad == 1 && tt[k] == "str") print tv[k]
      }
    }' "$1"
}

# ── merge_fenced marker location ──────────────────────────────────────────────
# _merge_fenced_locate <file> <begin-prefix> <end-marker> — where merge_fenced's section sits.
# A marker counts only as a WHOLE line (a trailing \r or blanks allowed): the begin marker is
# <begin-prefix> followed by ` -->` or ` <attributes> -->`, the end marker is exactly <end-marker>.
# A co-owner's rule that QUOTES a marker inside a sentence is prose, never a fence. The original
# substring match took such a quote for the begin marker and spliced from there, deleting the
# co-owner's text between the quote and the real block (/aif-evolve, measured 2026-09-28).
# Sets MERGE_FENCED_BEGIN_LINE / MERGE_FENCED_END_LINE, and MERGE_FENCED_PROBLEM +
# MERGE_FENCED_HINT when the pair is unusable (no end marker, or more than one begin marker —
# which block is getff's cannot be told, so nothing is guessed). Returns 1 when there is no begin
# marker line at all.
_merge_fenced_locate() {
  local out nb
  MERGE_FENCED_BEGIN_LINE=0; MERGE_FENCED_END_LINE=0; MERGE_FENCED_PROBLEM=""; MERGE_FENCED_HINT=""
  [ -f "$1" ] || return 1
  # A failed scan is «unknown», never «no markers» — that would append a second block.
  if ! out=$(awk -v BEG="$2" -v END_TOK="$3" '
    { sub(/\r$/, ""); sub(/[ \t]+$/, "") }
    index($0, BEG) == 1 && substr($0, length(BEG) + 1) ~ /^ ([^>]* )?-->$/ { nb++; if (!b) b = NR; next }
    b && !e && $0 == END_TOK { e = NR }
    END { print nb + 0, b + 0, e + 0 }' "$1"); then
    MERGE_FENCED_PROBLEM="could not scan for the section markers (awk failed)"
    MERGE_FENCED_HINT="nothing was written"
    return 0
  fi
  read -r nb MERGE_FENCED_BEGIN_LINE MERGE_FENCED_END_LINE <<EOF
$out
EOF
  [ "${nb:-0}" -gt 0 ] || return 1
  if [ "$nb" -gt 1 ]; then
    MERGE_FENCED_PROBLEM="$nb whole-line '$2' markers — which block is getff's cannot be told"
    MERGE_FENCED_HINT="the file is left as it is and getff's section is not updated in it"
  elif [ "$MERGE_FENCED_END_LINE" = 0 ]; then
    MERGE_FENCED_PROBLEM="'$2' present but no matching '$3'"
    MERGE_FENCED_HINT="an unterminated fence would delete everything to EOF, so the file is left as it is and getff's section is not in it"
  fi
  return 0
}

# ── Skill-context co-ownership (AI Factory /aif-evolve store) ─────────────────
# The shipped skill-context overrides (.ai-factory/skill-context/<skill>/SKILL.md) are CO-OWNED
# with AI Factory's /aif-evolve, which writes project rules into exactly that file (see
# install_skill_context). SSOT for the section id and the in-block note, both lanes.
SKILL_CONTEXT_FENCE_SECTION='getff-skill-context'
SKILL_CONTEXT_NOTE_LEAD='> Managed by getff:'
# shellcheck disable=SC2016  # backticks are Markdown code spans in the delivered file, not expansions
SKILL_CONTEXT_FENCE_NOTE="$SKILL_CONTEXT_NOTE_LEAD"' `install.sh --refresh` rewrites only the text between the getff markers. Project rules, including everything `/aif-evolve` adds, belong outside the markers and are never touched.'

# Every revision of each skill-context template getff has shipped, one row per revision:
#   <skill> <file lines> <file sha256> <body lines> <body sha256>
# where the body is the file minus its YAML frontmatter and outer blank lines — what the fenced
# block carries after the note. Rows make getff's own old bytes recognisable: a fence-less copy of
# ANY revision is replaced rather than left beside the new block, and a block still holding a
# shipped body is refreshed without parking a copy. APPEND-ONLY — a template edit adds its new
# row (`_skill_context_revision_row <skill> <file>` prints it);
# tests/install-sh/skill-context-evolve-coownership.test.sh §0 fails until every revision in git
# history and the working tree is listed.
SKILL_CONTEXT_SHIPPED_REVISIONS='
aif-orchestrator-discipline 59 825145afc8dae2a6cca9d3014f5119df5dfeea44547fb7bc56f855f5863536e6 55 bc0159f192e25a613ccc228bd88bccbbf139d62f7a7bae272dc3700cc109c777
aif-orchestrator-discipline 120 aee5830a0e5760545b1dea92d7a35b16ca90bbdb5043b45ea538fdbcc57205da 116 a4bb23e831f64ae675b7d36f88010b90cae50c7ba349011fba3d27e273ffbef7
aif-orchestrator-discipline 123 6fccf9a6157fcf1a338aac779af29d4cba3e9dc3a5f8c88d20c4e2e8ecb99753 119 15530613ee63585bc5b5c242496983f9170bc73f4fc3e5f16ccdd8061c052f2b
aif-orchestrator-discipline 123 7a0a04091d03f039d9f025b8278bac98966e5a9b5ae51a7b636e42e31f9cba57 119 88e16a15ce964ead848ce6ce02bc113a0c8e8946dc8ce34c97ebe8d6192ee21f
aif-review 40 8bd23ebbc6a7ab41a680c5e17895a1df3f8492090354ffe7ab4a83bda2c61f09 36 7660177c2193e1317a5dc0297310d65e7c0e03ccb87f61aeec0e02a7b78d5a73
aif-review 40 6d2d6dba33149923b748ac55138e5e2ba548752b6c23e41628aed850e6082343 36 098ffe62f7297978d85099fe412611bd2efc2f07bb3ab4c719486948e9324aa6
aif-rules-check 42 ef8609433e8fbd9ecad4fa332a78eda10c0f2bd6c43dc19ceb168550cebbf75f 38 1f3e7c3022c6f43a62517279a315471a5d171112cce145cdfb160635ec008008
aif-rules-check 42 7d6b6061459f0939e64358447d0905329ddd4c52abd459ee8d9d201653ffb791 38 b9a59089f5cc1ec4bb3d2ce0fd554d7fb694f047f0ca3fb5005f1a405b3e2e5b
aif-rules-check 42 27ad895b2f17b72d95f60e32eadbdc70182f99962cabbd9fd31cfd21f91fd448 38 f7c6deab98cb56e9c164bcdc76bf7c1551622bc8de391c97e94b6842feda2409
'

# install_skill_context <src> <dst>
# The ONLY delivery verb for the shipped skill-context overrides, on install AND on --refresh, on
# every lane (setup.d/20-agents.sh, install.sh do_refresh, setup.d/45-python.sh).
#
# WHY NOT copy_safe / refresh_safe: `.ai-factory/skill-context/<skill>/SKILL.md` is AI Factory's
# evolution store — aif-evolve/SKILL.md (AIF 2.11.0, lines 40-45) calls it «the ONLY correct target
# for built-in skill improvements» and its Artifact Ownership section claims the whole directory.
# AIF reads that one file per skill and nothing else: no fenced section it preserves, no sibling
# file, no include. Whole-file delivery therefore lost one side every time (measured 2026-09-28):
# copy_safe skipped an evolved file, so getff's content never arrived; refresh_safe overwrote it,
# so every evolved rule left the file AIF reads. This verb owns ONLY a merge_fenced block
# (section=getff-skill-context); the text outside the markers is /aif-evolve's and is never
# rewritten. Layer 3 (`SKILL.override.md` sibling) and --dry-run behave as in merge_fenced;
# --force is a no-op there too, since a co-owned file has no «whole file» for getff to overwrite.
#
# The block body is the template with its YAML frontmatter dropped (frontmatter is only valid at
# the top of a file, and the file's top belongs to whoever wrote first) and SKILL_CONTEXT_FENCE_NOTE
# prepended, so /aif-evolve reading the file is told where its rules go. A block whose old body is
# a shipped revision is refreshed silently; one somebody edited is parked first, as
# refresh-conflicts/<skill>-SKILL.md.<sha8> (three skills share the basename SKILL.md).
#
# GETFF TEXT WITHOUT MARKERS — only bytes PROVABLY delivered by getff are ever removed:
#   - LEGACY (every consumer installed before this verb): the file starts with a whole shipped
#     revision (SKILL_CONTEXT_SHIPPED_REVISIONS, or the current template), line for line — those
#     lines become the fenced block and the rest of the file is kept;
#   - STRIPPED (a rewrite dropped the HTML-comment markers): the note line followed by a shipped
#     body — those lines go and the fenced block is appended.
# Anything else (evolve edits inside getff's text) cannot be told apart from project rules, so
# nothing is removed: the block is appended and the old text stays, named once in the install
# output. CR line ends are ignored for these comparisons. The irreversible branch is never the
# default (T-Upgrade-A).
install_skill_context() {
  local src="$1" dst="$2"
  local plan body n kl rest h1 skill
  local beg="<!-- getff:begin section=$SKILL_CONTEXT_FENCE_SECTION"
  local end="<!-- getff:end section=$SKILL_CONTEXT_FENCE_SECTION -->"
  # Read by merge_fenced / _merge_fenced_keep_copy (dynamic scope): quiet refresh of a shipped
  # body, and a skill-qualified name for a parked copy.
  local MERGE_FENCED_SHIPPED_BODY=0 MERGE_FENCED_COPY_NAME
  [ -f "$src" ] || return 0
  skill=$(basename "$(dirname "$dst")")
  MERGE_FENCED_COPY_NAME="$skill-$(basename "$dst")"
  plan="${src#"${PKG_ROOT:-}"/}"
  if [ -e "${dst%.md}.override.md" ]; then   # Layer 3 — merge_fenced reports the skip
    merge_fenced "$src" "$dst" "$SKILL_CONTEXT_FENCE_SECTION" "$plan"
    return 0
  fi
  body=$(mktemp) || { echo "  ⚠ $dst: mktemp failed — skill-context not delivered" >&2; return 0; }
  _skill_context_body "$src" > "$body"
  rest="${dst}.getff.tmp"
  if [ -f "$dst" ] && ! _merge_fenced_locate "$dst" "$beg" "$end"; then
    if kl=$(_skill_context_stripped_block "$dst"); then
      if [ "$DRY_RUN" = "--dry-run" ]; then
        echo "  [dry-run] would replace the marker-less getff block in $dst (lines ${kl% *}-${kl#* }) with section=$SKILL_CONTEXT_FENCE_SECTION"
        rm -f "$body"
        return 0
      fi
      if awk -v K="${kl% *}" -v L="${kl#* }" 'NR < K || NR > L' "$dst" > "$rest" && mv "$rest" "$dst"; then
        echo "  · $dst: getff block without its markers (lines ${kl% *}-${kl#* }) replaced by the fenced block; everything else kept"
      else
        rm -f "$rest" 2>/dev/null || true
        echo "  ⚠ $dst: could not remove the marker-less getff block — left unchanged" >&2
        rm -f "$body"
        return 0
      fi
    elif n=$(_skill_context_delivered_lines "$src" "$dst"); then
      if [ "$DRY_RUN" = "--dry-run" ]; then
        echo "  [dry-run] would adopt the pre-fence getff copy in $dst into section=$SKILL_CONTEXT_FENCE_SECTION (lines after $n kept)"
        rm -f "$body"
        return 0
      fi
      # Keep everything after the provable getff prefix (leading blank lines trimmed), then let
      # merge_fenced append the current block — to an empty file when nothing followed.
      if tail -n +"$((n + 1))" "$dst" | awk '/[^ \t\r]/ { p = 1 } p' > "$rest" && mv "$rest" "$dst"; then
        if [ -s "$dst" ]; then
          echo "  · $dst: pre-fence getff copy (first $n lines) moved into the fenced block; the project rules after it kept"
        else
          rm -f "$dst"
        fi
      else
        rm -f "$rest" 2>/dev/null || true
        echo "  ⚠ $dst: could not split the pre-fence getff copy — left unchanged" >&2
        rm -f "$body"
        return 0
      fi
    elif [ "$DRY_RUN" != "--dry-run" ] && h1=$(_skill_context_h1 "$src") && [ -n "$h1" ] \
      && tr -d '\r' < "$dst" | grep -qxF "$h1"; then
      echo "  · $dst: holds an older getff copy that cannot be told apart from project rules — kept as-is; the current version is appended in its own block"
    fi
  elif [ -f "$dst" ] && [ -z "$MERGE_FENCED_PROBLEM" ] && _skill_context_block_is_shipped "$dst"; then
    MERGE_FENCED_SHIPPED_BODY=1
  fi
  merge_fenced "$body" "$dst" "$SKILL_CONTEXT_FENCE_SECTION" "$plan"
  rm -f "$body"
}

# _skill_context_trim — stdin → stdout without leading and trailing blank lines.
_skill_context_trim() {
  awk '/[^ \t]/ { p = 1 } p { buf[++n] = $0 }
       END { while (n > 0 && buf[n] !~ /[^ \t]/) n--; for (i = 1; i <= n; i++) print buf[i] }'
}

# _skill_context_template_body <file> — the template without its leading YAML frontmatter, trimmed.
_skill_context_template_body() {
  awk 'NR == 1 && $0 == "---" { fm = 1; next }
       fm == 1 { if ($0 == "---") fm = 2; next }
       { fm = 2; print }' "$1" | _skill_context_trim
}

# _skill_context_body <src> — stdout: SKILL_CONTEXT_FENCE_NOTE, a blank line, the template body.
_skill_context_body() {
  printf '%s\n\n' "$SKILL_CONTEXT_FENCE_NOTE"
  _skill_context_template_body "$1"
}

# _skill_context_h1 <src> — the template's first H1 line (the legacy-residue name check above).
_skill_context_h1() {
  awk '/^# / { print; exit }' "$1"
}

# _skill_context_revisions <skill> — that skill's SKILL_CONTEXT_SHIPPED_REVISIONS rows.
_skill_context_revisions() {
  printf '%s\n' "$SKILL_CONTEXT_SHIPPED_REVISIONS" | awk -v S="$1" '$1 == S'
}

# _skill_context_revision_row <skill> <file> — the register row for a template revision.
_skill_context_revision_row() {
  local tb sha="" bsha=""
  tb=$(mktemp) || return 1
  _skill_context_template_body "$2" > "$tb"
  if sha=$(_hash256 "$2") && bsha=$(_hash256 "$tb"); then
    echo "$1 $(wc -l < "$2" | tr -d ' ') $sha $(wc -l < "$tb" | tr -d ' ') $bsha"
  fi
  rm -f "$tb"
  [ -n "$bsha" ]
}

# _skill_context_delivered_lines <src> <dst> — echo N and exit 0 IFF the first N lines of the
# fence-less <dst> (CR ignored) are a whole template getff shipped: the current <src>, or any
# registered revision of this skill. Exit 1 = not provable.
_skill_context_delivered_lines() {
  local src="$1" dst="$2" lf probe total n _skill lines sha _bl _bh h
  lf=$(mktemp) || return 1
  probe=$(mktemp) || { rm -f "$lf"; return 1; }
  tr -d '\r' < "$dst" > "$lf"
  total=$(wc -l < "$lf" | tr -d ' ')
  n=$(wc -l < "$src" | tr -d ' ')
  if [ "$n" -gt 0 ] && [ "$n" -le "$total" ] && head -n "$n" "$lf" | cmp -s - "$src"; then
    rm -f "$lf" "$probe"; echo "$n"; return 0
  fi
  while read -r _skill lines sha _bl _bh; do
    if [ -z "$sha" ] || [ "$lines" -gt "$total" ]; then continue; fi
    head -n "$lines" "$lf" > "$probe"
    if h=$(_hash256 "$probe") && [ "$h" = "$sha" ]; then
      rm -f "$lf" "$probe"; echo "$lines"; return 0
    fi
  done <<EOF
$(_skill_context_revisions "$(basename "$(dirname "$dst")")")
EOF
  rm -f "$lf" "$probe"
  return 1
}

# _skill_context_stripped_block <dst> — echo "K L" and exit 0 IFF the fence-less <dst> holds a
# getff block whose markers were removed: SKILL_CONTEXT_NOTE_LEAD at line K, then (after blank
# lines) a registered body of this skill ending at line L. CR ignored.
_skill_context_stripped_block() {
  local dst="$1" lf probe k start _skill _l _h bl bh h
  lf=$(mktemp) || return 1
  probe=$(mktemp) || { rm -f "$lf"; return 1; }
  tr -d '\r' < "$dst" > "$lf"
  k=$(awk -v P="$SKILL_CONTEXT_NOTE_LEAD" 'index($0, P) == 1 { print NR; exit }' "$lf")
  start=""
  [ -n "$k" ] && start=$(awk -v K="$k" 'NR > K && /[^ \t]/ { print NR; exit }' "$lf")
  if [ -n "$start" ]; then
    while read -r _skill _l _h bl bh; do
      [ -n "$bh" ] || continue
      sed -n "${start},$((start + bl - 1))p" "$lf" > "$probe"
      if h=$(_hash256 "$probe") && [ "$h" = "$bh" ]; then
        rm -f "$lf" "$probe"; echo "$k $((start + bl - 1))"; return 0
      fi
    done <<EOF
$(_skill_context_revisions "$(basename "$(dirname "$dst")")")
EOF
  fi
  rm -f "$lf" "$probe"
  return 1
}

# _skill_context_block_is_shipped <dst> — exit 0 IFF the fenced block _merge_fenced_locate just
# found holds, after the note, a registered body of this skill (so replacing it loses nothing).
_skill_context_block_is_shipped() {
  local dst="$1" probe h
  probe=$(mktemp) || return 1
  awk -v B="$MERGE_FENCED_BEGIN_LINE" -v E="$MERGE_FENCED_END_LINE" 'NR > B && NR < E' "$dst" \
    | tr -d '\r' | _skill_context_trim \
    | awk -v P="$SKILL_CONTEXT_NOTE_LEAD" 'NR == 1 && index($0, P) == 1 { next } { print }' \
    | _skill_context_trim > "$probe"
  h=$(_hash256 "$probe"); rm -f "$probe"
  [ -n "$h" ] && _skill_context_revisions "$(basename "$(dirname "$dst")")" \
    | awk -v H="$h" '$5 == H { f = 1 } END { exit !f }'
}

# getff_bytes_intact <abs-dst> — the content twin of getff_delivered: exit 0 IFF <abs-dst> still
# holds the bytes getff left in it: this run staged it (the delivery itself, or a later write of
# getff's own — see below), or its sha256 equals the refresh-baseline entry an earlier install
# recorded. A getff_delivered file the consumer edited since fails it — those bytes are theirs now —
# and so does an unknown one (no entry, no jq, no sha256 tool): the safe side. The manifest hashes
# only what a run staged, so a later install that writes into an intact getff file (60-ci's
# boundary globs, a synth-wire or R2 write on getff's branch) stages it again with
# refresh_baseline_stage; otherwise its own write reads as the consumer's edit on the next check.
getff_bytes_intact() {
  local dst="$1" p cur
  for p in ${REFRESH_BASELINE_STAGED[@]+"${REFRESH_BASELINE_STAGED[@]}"} \
    ${REFRESH_BASELINE_STAGED_WEAK[@]+"${REFRESH_BASELINE_STAGED_WEAK[@]}"}; do
    [ "$p" = "$dst" ] && return 0
  done
  [ -f "$dst" ] || return 1
  _refresh_baseline_lookup "$dst"
  [ -n "$REFRESH_BASELINE_ENTRY" ] || return 1
  cur=$(_hash256 "$dst") || return 1
  [ "$cur" = "$REFRESH_BASELINE_ENTRY" ]
}

# ── O1 fix: INSTALL_SH_LIB_ONLY guard is LAST (after all helpers are defined) ──
# When sourced directly with INSTALL_SH_LIB_ONLY=1, expose all helpers and stop here.
# When sourced by install.sh, this guard fires and returns from the `source setup.d/lib.sh`
# call in install.sh — install.sh then checks its own guard (which also returns 0).
if [ "${INSTALL_SH_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi
