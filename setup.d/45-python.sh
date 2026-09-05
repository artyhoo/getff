#!/usr/bin/env bash
# setup.d/45-python.sh — Python toolchain delivery layer (python-delivery-v0 S1, Task 5).
#
# Ships the pre-rendered Python lint bundle (ast-grep rules + sgconfig.yml + ruff config,
# authored by S1 Tasks 3/4 at packages/core/templates/python/**) into a consumer Python repo
# with an AUGMENT-FIRST collision policy: merge into what the consumer already authored, never
# silently clobber it. This is the load-bearing novelty of the umbrella — no upstream headless
# tool does augment-first multi-tool lint-config delivery (SSOT prior-art-evaluations.md #216).
#
# COLLISION MATRIX (probe-proven, .superpowers/sdd/task-2-report.md):
#   (i)   fresh dir (no config)          → copy whole template files.
#   (ii)  pre-existing sgconfig.yml       → STRUCTURAL-merge our dir into the existing ruleDirs
#                                           list (idempotent). A naive second `ruleDirs:` key =
#                                           duplicate-field exit 8; a duplicated entry = duplicate-
#                                           rule-id exit 8; a missing dir = exit 6 — so we only
#                                           transform block-list shapes we can PROVE safe, copy the
#                                           rules dir BEFORE any scan, and REFUSE-LOUDLY otherwise.
#   (iii) pre-existing ruff.toml          → REFUSE-LOUDLY. Do NOT write a sibling ruff.toml (ours
#                                           would win entirely + silently disable theirs). Write a
#                                           non-discovered getff-ruff.toml reference copy + print
#                                           `extend` instructions (extend is a scalar — flagged if
#                                           they already use it). The getff bans are ALSO always
#                                           written to a stable .getff/ruff-bans.toml (see (bans)).
#   (iv)  pre-existing pyproject.toml      → REFUSE-LOUDLY. A sibling ruff.toml SILENTLY overrides
#         [tool.ruff] (and no ruff.toml)     their [tool.ruff] (probe-proven). Write getff-ruff.toml
#                                           + print merge-into-[tool.ruff.lint] instructions.
#   (bans) getff ruff bans                → ALWAYS written to .getff/ruff-bans.toml (fresh + every
#         (python-delivery-v0 S2-T2 fix)    collision cell) — the single cell-independent target the
#                                           shipped CI workflow points a `ruff check . --config
#                                           .getff/ruff-bans.toml` gate at. Without it, a ruff-collision
#                                           consumer's own config is what bare `ruff check .` discovers,
#                                           so the getff bans go SILENTLY unenforced (probe-proven). See
#                                           the top of _py_deliver_ruff.
#   (v)   re-run                          → zero diff on the delivered CONFIG artefacts (idempotent).
#   (ci)  consumer CI workflow            → ship pinned ast-grep + ruff gates as a getff-NAMESPACED
#         (python-delivery-v0 S2 Task 2)    .github/workflows/getff-python.yml (never the consumer's
#                                           ci.yml). Fresh copy | idempotent-if-ours | REFUSE-LOUDLY
#                                           if a non-getff file occupies our path. See _py_deliver_ci.
#
# INERT-ON-NPM CONTRACT (critical): install.sh sources ALL setup.d/[0-9]*.sh unconditionally
# (install.sh:564 `for f in "$PKG_ROOT"/setup.d/[0-9]*.sh; do source "$f"; done`). This layer must
# therefore NO-OP on the default npm flow. It runs ONLY when the Python lane is explicitly activated
# via the env-var contract GETFF_TOOLCHAIN=python. S2 wires the `./setup python` entry that sets it;
# until then nothing sets it, so every current npm `./setup`/`install.sh` sources this file to a
# pure no-op (proven by byte-identical.test.sh staying green + python-delivery.test.sh inertness arm).
#
# @cc-only-rationale: sourced by the install.sh dispatcher into its shell scope (not exec'd), so it
#   reuses lib.sh helpers (copy_safe/mkdir_safe) already in scope — no standalone entrypoint. The
#   augment/refuse transforms below are Python-lane-specific (not lib.sh SSOT helpers), so they live
#   here; no lib.sh helper body is copy-pasted (layer-units.test.sh §4 SSOT guard).
#
# Delivery-log: every action + every degrade path is printed to stdout AND appended to
#   <consumer>/.getff-python-install.log (a running audit trail; NOT a delivered config artefact, so
#   it is excluded from the (v) idempotency checksum — the delivered configs are byte-stable on re-run).

# ── Python-lane delivery helpers (defined always; executed only under the activation guard) ──

# Delivery-log sink: print to stdout (install progress) AND append to the consumer audit log.
_py_log() {
  echo "  $1"
  if [ "${DRY_RUN:-}" != "--dry-run" ] && [ -n "${_PY_LOG_FILE:-}" ]; then
    printf '%s\n' "$1" >> "$_PY_LOG_FILE"
  fi
}

# _py_copy_or_refresh <src> <dst> — FRAMEWORK-OWNED delivery. On install: copy_safe (skip-if-exists →
# idempotent re-run). On --refresh (S2 entry lane sets GETFF_TOOLCHAIN_REFRESH=1): refresh_safe →
# OVERWRITE, so updated framework content (e.g. new ast-grep rule YAML) reaches a brownfield consumer;
# a plain copy_safe skip-if-exists would strand the update — the #869 refresh-drift class, on the
# python surface. refresh_safe honours a sibling <dst>.override.md (Layer-3 consumer ownership). Both
# branches carry the caller's "$tpl/…" source, so the refresh-covers-full-delivery gate (Check 4)
# sees this call as a delivery on BOTH the install and the --refresh path (source-token parity).
_py_copy_or_refresh() {
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    refresh_safe "$1" "$2"
  else
    copy_safe "$1" "$2"
  fi
}

# ── Agent-surface refresh parity (A2-4) ──────────────────────────────────────────────────────────
# The three helpers below are to _py_deliver_agent_surface what _py_copy_or_refresh is to the
# toolchain delivery: they make the FRAMEWORK-OWNED half of the agent surface honour
# GETFF_TOOLCHAIN_REFRESH=1. Before them every agent-surface delivery was skip-if-exists only, so
# `install.sh python --refresh` printed "re-delivery complete" while .claude/skills, .claude/agents
# and .claude/hooks stayed at the version the consumer first installed (ledger finding A2-4) — the
# #869 refresh-drift class again, on the surface install.sh's own do_refresh() can never reach
# (do_python_lane exits at install.sh:381, long before do_refresh at install.sh:1276).
#
# The framework-owned / consumer-owned BOUNDARY is copied from do_refresh's own contract
# (install.sh:614 "Consumer-authored files (AGENTS.md, RULES.md, ci.yml, eslint.config.mjs …) are
# NEVER in this set"), so the two lanes cannot diverge on what --refresh may overwrite:
#   refreshed  — skills, agents, hooks, skill-context overrides, AI-USAGE-GUIDE.md
#   copy_safe  — RULES.md, DESCRIPTION*.md, ARCHITECTURE*.md, integration-rules.md, tool-decisions.md
# Every refreshed path keeps the Layer-3 `<dst>.override.md` escape hatch (INSTALL-FOR-AI.md
# §Three-layer), inherited from refresh_safe / refresh_skill_with_transform or checked inline.

# _py_skill_copy_or_refresh <slug> — a skill shipping from $PKG_ROOT/.claude/skills/.
# Install: copy_skill_with_transform (skip-if-exists). --refresh: refresh_skill_with_transform
# (rm -rf + cp -r + transform, `.claude/skills/<slug>.override.md` honoured). Mirrors do_refresh's
# orchestration-skills arm (install.sh:705).
_py_skill_copy_or_refresh() {
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    refresh_skill_with_transform "$1"
  else
    copy_skill_with_transform "$1"
  fi
}

# _py_plain_skill_deliver <slug> — a skill shipping from the REPO-ROOT skills/ payload (getff,
# tool-bootstrapping). No lib.sh helper covers this root (copy_skill_with_transform reads
# $PKG_ROOT/.claude/skills/), so do_refresh open-codes it too (install.sh:664-689) and this is the
# python-lane twin of that block: same override check, same rm -rf/cp -r/transform sequence.
_py_plain_skill_deliver() {
  local slug="$1"
  local src="$PKG_ROOT/skills/$slug"
  local dst="$PROJECT_ROOT/.claude/skills/$slug"
  local override="${dst}.override.md"
  local _mdf
  [ -d "$src" ] || return 0
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    if [ -e "$override" ]; then
      if [ "$DRY_RUN" = "--dry-run" ]; then
        echo "  [dry-run] would skip: .claude/skills/$slug (.override.md — consumer-owned)"
      else
        echo "  ⊝ .claude/skills/$slug (.override.md — consumer-owned, keeping)"
      fi
      return 0
    fi
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would refresh: $src → $dst"
      return 0
    fi
  else
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
      echo "  [dry-run] would copy: $src → $dst"
      return 0
    fi
  fi
  rm -rf "$dst"
  cp -r "$src" "$dst"
  while IFS= read -r -d '' _mdf; do
    transform_internal_refs "$_mdf"
  done < <(find "$dst" -name '*.md' -print0)
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    echo "  ✓ .claude/skills/$slug/ (refreshed, cross-refs rewritten to ${UPSTREAM_BLOB_URL})"
  else
    echo "  ✓ .claude/skills/$slug/ (cross-refs rewritten to ${UPSTREAM_BLOB_URL})"
  fi
}

# _py_agent_copy_or_refresh <src> <dst> — a single markdown artefact that needs the internal-ref
# transform after it is written (the curated sub-agents). The transform must run ONLY on a file this
# pass actually wrote: transforming a consumer-owned file that copy_safe skipped, or one kept by an
# `.override.md`, would rewrite bytes we do not own (the 2026-07-10 flat-install smoke contract,
# 20-agents.sh:41-46, and do_refresh's own `[ ! -e "${_dst%.md}.override.md" ]` guard at
# install.sh:650). Every branch is an explicit `if` — a trailing `A && B` under install.sh's
# `set -euo pipefail` would return 1 and abort the lane (the A2-3 defect class).
_py_agent_copy_or_refresh() {
  local src="$1" dst="$2"
  local _writes=1
  [ -f "$src" ] || return 0
  if [ -e "${dst%.md}.override.md" ]; then
    _writes=0
  fi
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    refresh_safe "$src" "$dst"
  else
    if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
      _writes=0
    fi
    copy_safe "$src" "$dst"
  fi
  if [ "$_writes" = 1 ] && [ "$DRY_RUN" != "--dry-run" ] && [ -f "$dst" ]; then
    transform_internal_refs "$dst"
  fi
}

# _py_sgconfig_merge <consumer-sgconfig.yml>
# Structurally add `  - .getff/astgrep-rules` to an existing block-list `ruleDirs:` key, idempotently.
# Returns 0 on a proven-safe merge (or idempotent no-op), 1 when the shape cannot be proven safe (the
# caller then REFUSES-LOUDLY with manual instructions). NEVER a text-append of a second `ruleDirs:`.
_py_sgconfig_merge() {
  local dst="$1"
  local entry="- .getff/astgrep-rules"

  # Exactly one top-level `ruleDirs:` key, else we cannot prove the transform safe.
  local nkeys
  nkeys=$(grep -c '^ruleDirs:' "$dst" 2>/dev/null || true)
  [ "$nkeys" = "1" ] || return 1

  # The `ruleDirs:` line must carry NO inline value: a flow list (`ruleDirs: [a, b]`) or an inline
  # scalar is a shape we do not structurally rewrite (would need a real YAML parser we cannot assume).
  local rd_line rest
  rd_line=$(grep -m1 '^ruleDirs:' "$dst")
  rest="${rd_line#ruleDirs:}"
  rest="${rest%%#*}"
  rest=$(printf '%s' "$rest" | tr -d '[:space:]')
  [ -z "$rest" ] || return 1

  # The line immediately after `ruleDirs:` must be a block-sequence item — confirms a block list.
  local next
  next=$(grep -A1 '^ruleDirs:' "$dst" | sed -n '2p')
  printf '%s' "$next" | grep -qE '^[[:space:]]*-[[:space:]]' || return 1
  local indent="${next%%-*}"

  # Idempotency: our entry already listed → no-op (a duplicate entry would trip exit 8, Probe 7).
  # Strip trailing #-comments before comparing (same shape as the ruleDirs: inline-value check
  # above, rest="${rest%%#*}") — a consumer-added comment on our entry (`- .getff/astgrep-rules
  # # our rules`) must still be recognised as already-present, else a re-run inserts a duplicate.
  local _found=0 _cl _cl_stripped
  while IFS= read -r _cl || [ -n "$_cl" ]; do
    _cl_stripped="${_cl%%#*}"
    if printf '%s' "$_cl_stripped" | grep -qE '^[[:space:]]*-[[:space:]]+\.getff/astgrep-rules[[:space:]]*$'; then
      _found=1
      break
    fi
  done < "$dst"
  if [ "$_found" -eq 1 ]; then
    _py_log "⊝ sgconfig.yml already lists .getff/astgrep-rules — no merge needed (idempotent)"
    return 0
  fi

  if [ "${DRY_RUN:-}" = "--dry-run" ]; then
    _py_log "[dry-run] would insert '${indent}${entry}' under the existing ruleDirs: list in $dst"
    return 0
  fi

  # Rewrite via a temp file with a pure read-loop (bash-3.2 / BSD-tool safe — no sed path-escaping),
  # inserting our entry as the first item directly under the ruleDirs: key.
  local _tmp="${dst}.getff-merge.$$"
  local _done=0 _l
  while IFS= read -r _l || [ -n "$_l" ]; do
    printf '%s\n' "$_l"
    if [ "$_done" -eq 0 ] && printf '%s' "$_l" | grep -q '^ruleDirs:'; then
      printf '%s%s\n' "$indent" "$entry"
      _done=1
    fi
  done < "$dst" > "$_tmp"
  mv "$_tmp" "$dst"
  _py_log "✓ sgconfig.yml — merged .getff/astgrep-rules into the existing ruleDirs list (augment-first)"
  return 0
}

# _py_join_researched_rules <tpl> — join consumer-side RESEARCHED rules into the scan dir
# (ecosystem-wiring W5). The rule-bootstrap CLI --from-practice arm
# (packages/core/install/rule-bootstrap-cli.ts) renders researched practice records SESSION-SIDE to
# <consumer>/.getff/rules-research/<entryId>.yml — the durable researched home that SURVIVES
# --refresh (refresh_safe rm-rf-replaces .getff/astgrep-rules from the template, lib.sh:126, so a
# researched rule can never live there as its only copy). This join re-assembles the scan dir on
# EVERY delivery pass (install / --force / --refresh): each rules-research/*.yml is copied into
# .getff/astgrep-rules/ so it fires via the consumer's single existing `ruleDirs:` entry (§Qd
# additive). NO new delivery channel (umbrella trap T-EW-B): rides the .getff/ namespace + the
# astgrep lane this seam already owns — same rationale as _py_write_rules_lock. Byte-stable on
# re-run → the (v) idempotency checksum is unperturbed. A researched file whose basename collides
# with a TEMPLATE-owned rule is REFUSE-LOUDLY skipped (never clobber a starter; the
# getff-researched-* §Qd sub-namespace makes this unreachable in honest use — the guard enforces it
# rather than hoping). Only *.yml joins — the *.practice.json input records stay in rules-research.
_py_join_researched_rules() {
  local tpl="$1"
  local rr_dir="$PROJECT_ROOT/.getff/rules-research"
  local dst_dir="$PROJECT_ROOT/.getff/astgrep-rules"
  [ -d "$rr_dir" ] || return 0
  local _f _b _n=0
  for _f in "$rr_dir"/*.yml; do
    [ -e "$_f" ] || continue
    _b="$(basename "$_f")"
    if [ -e "$tpl/.getff/astgrep-rules/$_b" ]; then
      _py_log "⚠ REFUSE researched join: $_b collides with a template-owned rule — keeping the template copy"
      _py_log "  (researched rules must use the getff-researched-* id namespace, §Qd)"
      continue
    fi
    if [ "${DRY_RUN:-}" = "--dry-run" ]; then
      _py_log "[dry-run] would join researched rule $_b → .getff/astgrep-rules/"
      continue
    fi
    mkdir -p "$dst_dir"
    cp "$_f" "$dst_dir/$_b"
    _n=$((_n+1))
  done
  if [ "$_n" -gt 0 ]; then
    _py_log "✓ joined $_n researched rule(s): .getff/rules-research → .getff/astgrep-rules (scan dir re-assembled)"
  fi
  return 0
}

# _py_deliver_astgrep — ast-grep lane: rules dir (always) + researched join + sgconfig.yml
# (fresh copy | merge | refuse).
_py_deliver_astgrep() {
  local tpl="$1"

  # The rules dir MUST exist before any `ast-grep scan` (missing dir = exit 6, Probe 6). Copy it in
  # every branch (fresh AND pre-existing sgconfig). Framework-owned → refresh-aware (overwrite on
  # --refresh so updated rule YAML reaches a brownfield consumer; skip-if-exists on plain install).
  _py_copy_or_refresh "$tpl/.getff/astgrep-rules" "$PROJECT_ROOT/.getff/astgrep-rules"
  _py_log "ast-grep rules dir → .getff/astgrep-rules (framework-owned)"

  # Consumer-side researched rules (rendered by rule-bootstrap-cli --from-practice) join the scan
  # dir AFTER the template copy on every pass — including --refresh, where the rm-rf-replace above
  # just wiped the previous join (the whole reason the durable home is rules-research, not here).
  _py_join_researched_rules "$tpl"

  local dst="$PROJECT_ROOT/sgconfig.yml"
  if [ ! -e "$dst" ]; then
    copy_safe "$tpl/sgconfig.yml" "$dst"
    _py_log "sgconfig.yml → copied (fresh dir, cell i)"
    return 0
  fi

  # --refresh of OUR OWN fresh sgconfig (getff header) → framework-owned, so overwrite it with the
  # current template. A consumer-authored / augment-merged sgconfig is NOT ours (no getff header) →
  # fall through to the augment-first merge below (never clobber it). refresh_safe honours a sibling
  # sgconfig.yml.override.md (Layer-3 consumer ownership).
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ] && grep -q 'generated by getff' "$dst" 2>/dev/null; then
    refresh_safe "$tpl/sgconfig.yml" "$PROJECT_ROOT/sgconfig.yml"
    _py_log "sgconfig.yml → refreshed (framework-owned getff copy)"
    return 0
  fi

  # Pre-existing sgconfig.yml (cell ii): augment via structural merge, or refuse loudly.
  _py_log "sgconfig.yml already present — attempting augment-first structural merge (cell ii)"
  if _py_sgconfig_merge "$dst"; then
    return 0
  fi
  _py_log "⚠ REFUSE: existing sgconfig.yml is not a shape we can safely rewrite (not a single block-list"
  _py_log "  ruleDirs: key). NOT modifying it (a bad merge trips ast-grep exit 6/8)."
  _py_log "  MANUAL: add this line under your sgconfig.yml 'ruleDirs:' list:"
  _py_log "      - .getff/astgrep-rules"
  _py_log "  The rule files are already installed at .getff/astgrep-rules/ (ready once you add the entry)."
}

# _py_deliver_ruff — ruff lane: fresh copy | refuse (ruff.toml present | pyproject [tool.ruff] present).
_py_deliver_ruff() {
  local tpl="$1"
  local ruff_dst="$PROJECT_ROOT/ruff.toml"
  local getff_ref="$PROJECT_ROOT/getff-ruff.toml"

  # Stable, cell-INDEPENDENT getff-bans config → ALWAYS delivered (fresh dir AND every ruff-collision
  # cell) at a predictable getff-owned path. This is the single target the shipped CI workflow points a
  # `ruff check . --config .getff/ruff-bans.toml --no-cache` gate at, so the getff TID bans fire in EVERY
  # cell. Load-bearing on the collision cells (iii/iv): there the consumer's OWN ruff config is what
  # `ruff check .` discovers, so it NEVER sees our TID bans — probe-proven silent-unenforcement.
  # `--config` makes ruff REPLACE discovery
  # (probe-proven), so the CI gate lints the tree against ONLY our bans regardless of the consumer's
  # config. Framework-owned + getff-header-marked (never a consumer file — the consumer never authors
  # .getff/ruff-bans.toml), refresh-aware. Its source token `$tpl/ruff.toml` already carries copy+refresh
  # parity (refresh-covers-full-delivery Check 4), so no new source enters that gate's population.
  _py_copy_or_refresh "$tpl/ruff.toml" "$PROJECT_ROOT/.getff/ruff-bans.toml"
  _py_log "ruff bans → .getff/ruff-bans.toml (stable getff-owned CI-gate target; enforced in every cell)"

  # Idempotency: a ruff.toml WE already delivered (carries the getff header) is not a consumer
  # collision — no-op on re-run. This MUST precede the cell-(iii) refuse so our own fresh-install
  # output is not mistaken for a consumer's file on the second run. On --refresh it is framework-owned
  # → overwrite with the current template (updated bans); refresh_safe honours a sibling
  # ruff.toml.override.md.
  if [ -e "$ruff_dst" ] && grep -q 'generated by getff' "$ruff_dst" 2>/dev/null; then
    if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
      refresh_safe "$tpl/ruff.toml" "$PROJECT_ROOT/ruff.toml"
      _py_log "ruff.toml → refreshed (framework-owned getff copy)"
    else
      _py_log "⊝ ruff.toml already delivered by getff — no-op (idempotent)"
    fi
    return 0
  fi

  # (iii) consumer ruff.toml / .ruff.toml present → a sibling ruff.toml of ours would win entirely
  # and silently disable theirs (Probe 1). REFUSE: ship a non-discovered getff-ruff.toml + `extend`.
  if [ -e "$ruff_dst" ] || [ -e "$PROJECT_ROOT/.ruff.toml" ]; then
    local existing="$ruff_dst"; [ -e "$existing" ] || existing="$PROJECT_ROOT/.ruff.toml"
    _py_copy_or_refresh "$tpl/ruff.toml" "$getff_ref"
    _py_log "⚠ REFUSE ruff.toml (cell iii): a sibling ruff.toml would override your $(basename "$existing") entirely."
    _py_log "  Shipped our rules as getff-ruff.toml (ruff does NOT auto-discover it — inert until you opt in)."
    _py_log "  MANUAL: in your $(basename "$existing") add:"
    _py_log "      extend = \"getff-ruff.toml\""
    _py_log "      extend-select = [\"TID251\", \"TID253\"]"
    if grep -qE '^[[:space:]]*extend[[:space:]]*=' "$existing" 2>/dev/null; then
      _py_log "  NOTE: your $(basename "$existing") already sets 'extend' — extend is a SCALAR (one file per"
      _py_log "  config). You cannot add a second 'extend'; instead merge our getff-ruff.toml [lint] TID251/"
      _py_log "  TID253 tables into the file your existing 'extend' points at, or inline them into this config."
    fi
    return 0
  fi

  # (iv) pyproject.toml [tool.ruff] present, no ruff.toml → a sibling ruff.toml SILENTLY overrides
  # [tool.ruff] (Probe 1). REFUSE: ship getff-ruff.toml + merge-into-[tool.ruff.lint] instructions.
  if [ -e "$PROJECT_ROOT/pyproject.toml" ] && grep -qE '^\[tool\.ruff' "$PROJECT_ROOT/pyproject.toml" 2>/dev/null; then
    _py_copy_or_refresh "$tpl/ruff.toml" "$getff_ref"
    _py_log "⚠ REFUSE ruff.toml (cell iv): a sibling ruff.toml would SILENTLY override your pyproject.toml"
    _py_log "  [tool.ruff] (probe-proven — closest-config-wins, ruff.toml beats pyproject, no warning)."
    _py_log "  Shipped our rules as getff-ruff.toml for reference."
    _py_log "  MANUAL: merge our TID lines into your pyproject.toml [tool.ruff.lint]:"
    _py_log "      [tool.ruff.lint]"
    _py_log "      extend-select = [\"TID251\", \"TID253\"]"
    _py_log "      [tool.ruff.lint.flake8-tidy-imports]"
    _py_log "      banned-module-level-imports = [\"tensorflow\"]"
    _py_log "      [tool.ruff.lint.flake8-tidy-imports.banned-api]"
    _py_log "      \"datetime.datetime.utcnow\".msg = \"use datetime.now(timezone.utc)\""
    return 0
  fi

  # (i) fresh: no ruff config at all → copy our ruff.toml whole.
  copy_safe "$tpl/ruff.toml" "$ruff_dst"
  _py_log "ruff.toml → copied (fresh dir, cell i)"
}

# _py_deliver_prettierignore — append `.getff/` to a pre-existing .prettierignore (idempotent).
# If none exists, skip (do NOT create one — that would be an unrequested opinion). Logs either way.
_py_deliver_prettierignore() {
  local ign="$PROJECT_ROOT/.prettierignore"
  if [ ! -e "$ign" ]; then
    _py_log "⊝ no consumer .prettierignore — skipping (not creating one)"
    return 0
  fi
  if grep -qxF '.getff/' "$ign" 2>/dev/null; then
    _py_log "⊝ .prettierignore already ignores .getff/ — nothing to add (idempotent)"
    return 0
  fi
  if [ "${DRY_RUN:-}" = "--dry-run" ]; then
    _py_log "[dry-run] would append '.getff/' to $ign"
    return 0
  fi
  [ -n "$(tail -c1 "$ign")" ] && printf '\n' >> "$ign"
  printf '%s\n' '.getff/' >> "$ign"
  _py_log "✓ .prettierignore — appended '.getff/' (consumer had one; augment-first)"
}

# _py_deliver_ci — consumer CI workflow lane: ship the pinned ast-grep + ruff gates as
# .github/workflows/getff-python.yml (a getff-NAMESPACED filename → never clobbers the consumer's
# own ci.yml; parity with the ts-server github-actions-workflow-integrity.yml sibling-file precedent).
# Collision policy (same class as the config cells):
#   - no file at our path            → copy the pinned template whole (framework-owned, getff header).
#   - our own getff-generated file    → idempotent no-op on install; overwrite on --refresh (updated
#                                       pins reach a brownfield consumer). refresh_safe honours a
#                                       sibling getff-python.yml.override.md (Layer-3 consumer ownership).
#   - a NON-getff file at our path    → REFUSE-LOUDLY, never overwrite; print the manual wiring. A
#                                       consumer who authored their own getff-python.yml keeps it.
# NEVER writes to the consumer's ci.yml — a pre-existing consumer CI workflow is not clobbered.
_py_deliver_ci() {
  local tpl="$1"
  local wf_dst="$PROJECT_ROOT/.github/workflows/getff-python.yml"

  if [ ! -f "$tpl/github-actions-ci.yml" ]; then
    _py_log "⊝ no CI template at $tpl/github-actions-ci.yml — skipping CI delivery (rules still enforced locally)"
    return 0
  fi

  if [ -e "$wf_dst" ]; then
    if grep -q 'generated by getff' "$wf_dst" 2>/dev/null; then
      if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
        # Framework-owned → deliver_getff_workflow (getff-honest-signals S4) overwrites so
        # updated pins reach a brownfield consumer AND the default-branch substitution
        # re-runs (a consumer who renamed main→trunk then re-ran ./setup --refresh gets
        # the delivered workflow updated to trunk). Source-token parity with the fresh
        # path below keeps refresh-covers-full Check 4 green; the helper detects the
        # refresh flag internally and delegates to refresh_safe (preserving the
        # getff-python.yml.override.md Layer-3 escape hatch).
        GETFF_TOOLCHAIN_REFRESH=1 deliver_getff_workflow "$tpl/github-actions-ci.yml" "$wf_dst"
        _py_log "CI workflow → refreshed (.github/workflows/getff-python.yml, framework-owned pins)"
      else
        _py_log "⊝ .github/workflows/getff-python.yml already delivered by getff — no-op (idempotent)"
      fi
      return 0
    fi
    # A NON-getff file occupies our namespaced path → a consumer authored it. REFUSE, never clobber.
    # NOTE: the two pins below intentionally MIRROR github-actions-ci.yml (the delivered template) — a
    # printed manual-wiring hint cannot `--config`-dedupe against a YAML file without a parser we do not
    # assume in pure bash; the CI-template pins are the SSOT and these strings restate them for the
    # refuse path. Keep the two in sync on any pin bump (both bump together per ci-tool-pinning.md Rule A).
    _py_log "⚠ REFUSE CI: .github/workflows/getff-python.yml exists and is NOT getff-generated."
    _py_log "  NOT overwriting your workflow. To wire the getff Python gates, add jobs running:"
    _py_log "      npm install -g @ast-grep/cli@0.44.1 && ast-grep scan"
    _py_log "      pip install ruff==0.15.21 && ruff check .                                 # your config"
    _py_log "      pip install ruff==0.15.21 && ruff check . --config .getff/ruff-bans.toml  # getff bans (isolated)"
    return 0
  fi

  # Fresh: deliver the pinned CI workflow (framework-owned, getff-header-marked, getff-namespaced)
  # via deliver_getff_workflow (getff-honest-signals S4) — substitutes the consumer's actual
  # default branch for the template's hard-coded `main` so the workflow triggers on the right
  # branch. Byte-identical to template when (a) default branch IS main, or (b) detection fails
  # (no remote / origin/HEAD unset) — PARK Option A; see helper docstring in setup.d/lib.sh.
  deliver_getff_workflow "$tpl/github-actions-ci.yml" "$wf_dst"
  _py_log "CI workflow → .github/workflows/getff-python.yml (pinned ast-grep + ruff gates)"
}

# _py_firing_self_check — post-install firing PROOF (the «works» in the umbrella goal). Plants a
# violating .py in an OS temp dir ONLY (mktemp -d — NEVER under the consumer's tracked tree, a binding
# STOP line), runs the DELIVERED ast-grep rules + ruff config against it, and asserts BOTH FIRE RED
# (non-zero exit = a diagnostic was raised). Then removes the temp dir. Tool-gated: an absent tool →
# LOUD degrade printing the exact manual command (never silently green — attention-is-not-a-mechanism.md
# §1: a check nobody ran is not a mechanism; mirrors the 99-finalize.sh capstone self-verify honesty,
# where a SKIP is accounted separately and never counted as a proven property). rc=0 on every branch —
# a self-check must not abort the install. Called by install.sh's python lane after delivery (NOT from
# the activation guard, so the S1 layer-unit test's delivery path is unchanged).
_py_firing_self_check() {
  echo ""
  echo "▶ getff firing self-check — proving the delivered rules FIRE (planted violation in an OS temp dir)"
  local _pass=0 _silent=0 _degraded=0 _overbroad=0

  # ── ast-grep lane (primary) ──
  # The `sg` fallback is ast-grep's short alias, but on Linux `sg` ALSO names the
  # setgid(1) coreutil (/usr/bin/sg) — a bare `command -v sg` false-positives there.
  # Guard the alias with an identity probe (`sg --version` prints "ast-grep <ver>")
  # so a host with the setgid `sg` but no ast-grep DEGRADES honestly instead of
  # running the wrong binary and mis-reporting the clean control as OVER-BROAD.
  local _sg=""
  if   command -v ast-grep >/dev/null 2>&1; then _sg="ast-grep"
  elif command -v sg >/dev/null 2>&1 && sg --version 2>/dev/null | grep -qi 'ast-grep'; then _sg="sg"; fi
  if [ -n "$_sg" ] && [ -d "$PROJECT_ROOT/.getff/astgrep-rules" ]; then
    local _t; _t=$(mktemp -d)
    printf 'import datetime\nx = eval("1+1")\nos.system("echo hi")\na = datetime.now()\nb = datetime.datetime.now()\n' > "$_t/getff_selfcheck.py"
    # Paired CLEAN CONTROL (adapter-jig E1): conforming code the delivered rules must stay quiet on.
    # Without it an always-red config (a rule matching every file) prints the same "enforcement is
    # live" — the RED direction alone cannot discriminate a working config from a broken one.
    printf 'import json\nx = json.dumps({"ok": 1})\n' > "$_t/getff_selfcheck_clean.py"
    # ABSOLUTE ruleDirs → the rules resolve regardless of cwd (the delivered rules dir, read-only).
    printf 'ruleDirs:\n  - %s\n' "$PROJECT_ROOT/.getff/astgrep-rules" > "$_t/sgconfig.yml"
    if ( cd "$_t" && "$_sg" scan getff_selfcheck.py ) >/dev/null 2>&1; then
      echo "  ✗ ast-grep did NOT fire on a planted violation — the delivered rules are SILENT (delivery bug)"
      _silent=$((_silent+1))
    else
      echo "  ✓ ast-grep fired RED on the planted violation (eval / os.system / datetime.now bans live)"
      _pass=$((_pass+1))
    fi
    if ( cd "$_t" && "$_sg" scan getff_selfcheck_clean.py ) >/dev/null 2>&1; then
      echo "  ✓ ast-grep clean control GREEN — no diagnostics on conforming code (rules discriminate)"
      _pass=$((_pass+1))
    else
      echo "  ✗ ast-grep FIRED on the clean control — the delivered rules are OVER-BROAD (an always-red config is not enforcement)"
      _overbroad=$((_overbroad+1))
    fi
    rm -rf "$_t"
  else
    echo "  ⚠ ast-grep not on PATH — firing NOT proven (degrade, NOT green). Verify manually from your repo root:"
    echo "      npx --yes -p @ast-grep/cli@0.44.1 ast-grep scan .    # must exit non-zero on bad Python"
    _degraded=$((_degraded+1))
  fi

  # ── ruff lane (fast-path) ──
  # Prefer the stable getff-bans config — the EXACT file the shipped CI gate points a --config at — so the
  # self-check proves the same artefact CI relies on. On an older delivery that predates the bans file,
  # fall back GETFF-OWNED-FIRST: the getff-ruff.toml reference copy (REFUSE cell) BEFORE the discovered
  # ruff.toml (fresh cell, where ruff.toml IS ours). Ordering is load-bearing (adapter-jig E2, the W4
  # cargo finding-1 class): in the REFUSE cell the consumer's ruff.toml lacks our TID bans, so a
  # consumer-first fallback validates the WRONG config → false SILENT. Mirrors
  # _cargo_delivered_clippy_path (getff-owned before consumer-owned, 46-cargo.sh).
  local _ruff_mode="" _ruffcfg=""
  [ -f "$PROJECT_ROOT/.getff/ruff-bans.toml" ] && _ruffcfg="$PROJECT_ROOT/.getff/ruff-bans.toml"
  [ -z "$_ruffcfg" ] && [ -f "$PROJECT_ROOT/getff-ruff.toml" ] && _ruffcfg="$PROJECT_ROOT/getff-ruff.toml"
  [ -z "$_ruffcfg" ] && [ -f "$PROJECT_ROOT/ruff.toml" ]       && _ruffcfg="$PROJECT_ROOT/ruff.toml"
  if   command -v ruff >/dev/null 2>&1; then _ruff_mode="ruff"
  elif command -v uvx  >/dev/null 2>&1; then _ruff_mode="uvx"; fi
  if [ -n "$_ruff_mode" ] && [ -n "$_ruffcfg" ]; then
    local _t; _t=$(mktemp -d)
    printf 'import tensorflow\nimport datetime\nx = datetime.datetime.utcnow()\n' > "$_t/getff_selfcheck.py"
    # Paired CLEAN CONTROL (adapter-jig E1) — conforming code the delivered bans must stay quiet on.
    printf 'import json\nx = json.dumps({"ok": 1})\n' > "$_t/getff_selfcheck_clean.py"
    local _rc=0 _rc_clean=0
    # Run FROM the temp dir + --no-cache so ruff writes NOTHING under the consumer tree (a stray
    # .ruff_cache/ in $PROJECT_ROOT would break the temp-dir-ONLY STOP line). --config is absolute.
    if [ "$_ruff_mode" = "uvx" ]; then
      ( cd "$_t" && uvx ruff@0.15.21 check --no-cache --config "$_ruffcfg" getff_selfcheck.py ) >/dev/null 2>&1 || _rc=$?
      ( cd "$_t" && uvx ruff@0.15.21 check --no-cache --config "$_ruffcfg" getff_selfcheck_clean.py ) >/dev/null 2>&1 || _rc_clean=$?
    else
      ( cd "$_t" && ruff check --no-cache --config "$_ruffcfg" getff_selfcheck.py ) >/dev/null 2>&1 || _rc=$?
      ( cd "$_t" && ruff check --no-cache --config "$_ruffcfg" getff_selfcheck_clean.py ) >/dev/null 2>&1 || _rc_clean=$?
    fi
    if [ "$_rc" -eq 0 ]; then
      echo "  ✗ ruff did NOT fire on a planted violation — the delivered ruff config is SILENT (delivery bug)"
      _silent=$((_silent+1))
    else
      echo "  ✓ ruff fired RED on the planted violation (TID251 utcnow / TID253 tensorflow bans live)"
      _pass=$((_pass+1))
    fi
    if [ "$_rc_clean" -eq 0 ]; then
      echo "  ✓ ruff clean control GREEN — no diagnostics on conforming code (bans discriminate)"
      _pass=$((_pass+1))
    else
      echo "  ✗ ruff FIRED on the clean control — the delivered ruff config is OVER-BROAD (an always-red config is not enforcement)"
      _overbroad=$((_overbroad+1))
    fi
    rm -rf "$_t"
  else
    echo "  ⚠ ruff not on PATH — firing NOT proven (degrade, NOT green). Verify manually:"
    echo "      uvx ruff@0.15.21 check --config ${_ruffcfg:-ruff.toml} <a .py doing 'import tensorflow'>   # must exit non-zero"
    _degraded=$((_degraded+1))
  fi

  echo ""
  if [ "$_silent" -gt 0 ] || [ "$_overbroad" -gt 0 ]; then
    echo "⚠  getff self-check: $_pass ok · $_silent SILENT · $_overbroad OVER-BROAD — a delivered rule failed a direction (SILENT = no fire on bad input; OVER-BROAD = fired on clean input); review above before relying on it."
  elif [ "$_degraded" -gt 0 ]; then
    echo "⚠  getff self-check: $_pass proven-firing · $_degraded NOT proven (tool absent) — a skipped check is NOT green; run the manual command(s) above to prove it."
  else
    echo "✓ getff self-check: both lanes fired RED on planted violations and stayed GREEN on clean controls — enforcement is live."
  fi
  return 0
}

# _py_json_array <newline-separated items> — render a JSON string array. Items are getff rule ids /
# ruff codes ([A-Za-z0-9-]), so direct double-quoting is safe (no escaping needed). Empty → [].
_py_json_array() {
  local items="$1" out="[" first=1 it
  while IFS= read -r it; do
    [ -z "$it" ] && continue
    if [ "$first" -eq 1 ]; then first=0; else out="$out, "; fi
    out="$out\"$it\""
  done <<EOF
$items
EOF
  printf '%s]' "$out"
}

# _py_json_rules <newline-separated rule ids> <fragment-dir> — render a JSON array of v2 rule
# objects ({id, provenance, tier}). §3a option B / §6 fork 2: reads each rule's slice from
# the fragment dir. S1b (PARK-S1-7 unparked): the python-lane fragment dir is the per-lane
# subdir `generation-context/python/` (resolved and passed by `_py_write_rules_lock` below —
# named rather than line-numbered: a line pointer into this same file goes stale the moment
# anything above the caller is edited, including the hunk that writes the pointer);
# fragments are written by rule-bootstrap-cli.ts runPracticeRender (S1b), keyed by the
# delivered ast-grep rule id (DC-3: record.entryId === rendered.entryId, by construction).
# The Node synthesize path (emit.ts:97-103) still writes `G${n}.json` to the PARENT
# generation-context/ dir — a different lane with its own fragment set; the cargo/go readers
# glob that parent dir non-recursively (46-cargo.sh:262, 47-go.sh:229). When no fragment
# exists for a rule (template rule with no research provenance), the fallback
# {id, provenance:[], tier:2} is the DERIVED value — explicit absence from the fragment dir,
# not a literal. S1 §3 criterion 3: the per-rule shape REPLACES the v1 flat ruleIds array.
_py_json_rules() {
  local items="$1" frag_dir="${2:-}" out="[" first=1 it frag
  while IFS= read -r it; do
    [ -z "$it" ] && continue
    if [ "$first" -eq 1 ]; then first=0; else out="$out, "; fi
    frag="$frag_dir/$it.json"
    if [ -n "$frag_dir" ] && [ -f "$frag" ]; then
      out="$out$(cat "$frag")"
    else
      out="$out{\"id\":\"$it\",\"provenance\":[],\"tier\":2}"
    fi
  done <<EOF
$items
EOF
  printf '%s]' "$out"
}

# _py_write_rules_lock — emit the PYTHON RULES-LOCK VARIANT: a machine-reproducibility record of the
# rule set actually delivered into the consumer's .getff/ tree. Parity with the JS/TS
# installer/install.ts rules-lock.json (schemaVersion/framework/version/ruleIds/emittedAt/
# sourceFingerprint), but pure-bash — the Model-A python lane has NO Node at install-time. It records
# the delivered ast-grep rule ids + ruff ban codes + a deterministic sourceFingerprint (sha256/16 over
# the sorted delivered rule bytes), so the researched-vs-starter rule set a consumer received is
# reproducible + auditable. This is the consumer-side "ledger 2" the rule-tests skill reads
# (emittedAt/sourceFingerprint) — spec 2026-07-21-rule-tests-surface-design.md §6.
#
# NO new delivery channel (umbrella trap T-EW-B): rides the .getff/ namespace the seam already owns.
# Written to .getff/rules-lock.python.json — the python TOOLCHAIN home. D8 (getff-any-stack-trace S2)
# split the two surfaces: toolchain artefacts (astgrep rules, sgconfig, ruff config, this lock) stay
# under .getff/; the AGENT-SURFACE subtree (skills/agents/hooks/.mcp.json/AGENTS.md/.ai-factory/) now
# ships under .ai-factory/ via _py_deliver_agent_surface. The lock lives where its inputs live.
#
# Idempotent + CONTENT-AWARE (W5 rework): the skip guard compares the freshly-computed
# sourceFingerprint against the one stored in the existing lock, and skips ONLY on a match — i.e. the
# delivered set is provably unchanged (stable emittedAt, byte-identical lock on a true no-change
# re-run). Any pass that CHANGES the delivered .getff/ set regenerates, regardless of flags: --force
# (copy_safe overwrites), --refresh (refresh_safe overwrites), AND the plain no-flag re-run after
# _py_join_researched_rules delivered a new consumer-researched rule (the join runs on EVERY pass —
# the W3-era flag-gated guard assumed «no overwrite flag ⇒ delivered set unchanged», which the join
# falsified: a plain pass CAN change the set). Invariant: the lock is NEVER stale relative to the
# delivered .getff/ artefacts, on ANY pass (its whole job is to record the DELIVERED set; a lagging
# lock would LIE about what was delivered). Its emittedAt is wall-clock → the lock is EXCLUDED from the install byte-identical snapshot
# (tests/install-sh/snapshot.sh compute_fingerprint), exactly as the running audit log is; its
# deterministic content is gated by tests/install-sh/python-rules-lock.test.sh instead
# (attention-is-not-a-mechanism §1: a non-deterministic field is not left byte-guarded, it is moved to
# a targeted deterministic assertion).
#
# Defined here (co-located + unit-testable), CALLED from install.sh do_python_lane after delivery — the
# same defined-in-seam / run-in-install-flow split as _py_firing_self_check (an install-flow concern,
# not part of the pure deliver_python_toolchain config tree, so the augment-first cell tests are
# unperturbed).
_py_write_rules_lock() {
  local rules_dir="$PROJECT_ROOT/.getff/astgrep-rules"
  local bans="$PROJECT_ROOT/.getff/ruff-bans.toml"
  local lock="$PROJECT_ROOT/.getff/rules-lock.python.json"

  # Nothing delivered (no rules dir) → nothing to lock (defensive; delivery precedes this call).
  [ -d "$rules_dir" ] || { echo "  ⊝ rules-lock: no .getff/astgrep-rules present — skipping"; return 0; }

  if [ "${DRY_RUN:-}" = "--dry-run" ]; then
    echo "  [dry-run] would write .getff/rules-lock.python.json (delivered rule ids + sourceFingerprint)"
    return 0
  fi

  # Delivered ast-grep rule ids (the `id: "…"` field, double-quoted per the renderer), sorted+unique.
  local ids
  ids=$(grep -hE '^id:' "$rules_dir"/*.yml 2>/dev/null \
    | sed -E 's/^id:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/' | sort -u)

  # Delivered ruff ban codes (select/extend-select = ["TID…", …]) — the always-delivered bans file.
  local ban_codes=""
  [ -f "$bans" ] && ban_codes=$(grep -oE 'TID[0-9]+' "$bans" 2>/dev/null | sort -u)

  # Deterministic sourceFingerprint: sha256/16 over the sorted delivered rule bytes (astgrep ymls +
  # the always-delivered ruff bans). Same rule set → same fingerprint (reproducibility), independent
  # of emittedAt. Portable hash ladder (parity with tests/install-sh/snapshot.sh).
  local _hash_input _fp
  _hash_input=$( { find "$rules_dir" -name '*.yml' 2>/dev/null | sort | while IFS= read -r f; do cat "$f"; done; [ -f "$bans" ] && cat "$bans"; } )
  if command -v sha256sum >/dev/null 2>&1; then
    _fp=$(printf '%s' "$_hash_input" | sha256sum | awk '{print $1}')
  elif command -v shasum >/dev/null 2>&1; then
    _fp=$(printf '%s' "$_hash_input" | shasum -a 256 | awk '{print $1}')
  elif command -v md5 >/dev/null 2>&1; then          # BSD/macOS md5 fallback
    _fp=$(printf '%s' "$_hash_input" | md5 | awk '{print $NF}')
  elif command -v md5sum >/dev/null 2>&1; then        # Linux md5sum fallback (was missing → constant on Linux)
    _fp=$(printf '%s' "$_hash_input" | md5sum | awk '{print $1}')
  else
    # Degrade LOUDLY (attention-is-not-a-mechanism §1 / degrade-loudly): NO sha256/md5 tool on the host, so
    # the fingerprint below is a FAKE CONSTANT, not an authoritative digest of the delivered rule bytes.
    # Warn to stderr so the constant is NEVER silently trusted as the lock's auditability primitive. Do NOT
    # hard-fail — sourceFingerprint is an optional auditability field, not an install precondition.
    echo "  ⚠ getff: no sha256 tool (sha256sum/shasum/md5/md5sum); rules-lock sourceFingerprint is non-authoritative" >&2
    _fp=0000000000000000
  fi
  _fp="${_fp:0:16}"

  # CONTENT-AWARE idempotent skip (W5 rework): skip ONLY when the existing lock's sourceFingerprint
  # equals the freshly-computed one — the delivered set is provably unchanged, so the lock (incl. its
  # emittedAt) stays byte-identical. NOT flag-gated: the delivered set can change on a PLAIN pass too
  # (_py_join_researched_rules runs on every pass), and a flag-gated skip left the lock STALE there.
  # The no-hash-tool degrade constant (0000000000000000) can NOT prove «unchanged», so it never
  # skips — conservative regenerate, already loudly declared non-authoritative above.
  if [ -f "$lock" ] && [ "$_fp" != "0000000000000000" ]; then
    local _prev_fp
    _prev_fp=$(grep -oE '"sourceFingerprint"[[:space:]]*:[[:space:]]*"[^"]*"' "$lock" 2>/dev/null \
      | head -1 | sed -E 's/.*"([^"]*)"$/\1/')
    if [ "$_prev_fp" = "$_fp" ]; then
      echo "  ⊝ rules-lock.python.json fingerprint unchanged ($_fp) — no-op (delivered set identical)"
      return 0
    fi
  fi

  local emitted
  emitted=$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo unknown)

  mkdir -p "$PROJECT_ROOT/.getff"

  local _json_rules _json_bans
  # Fragment-per-rule per §6 fork 2. The fragment dir is the synthesizer's
  # generation-context/ subdir — one <rule-id>.json per rule in final lock shape.
  # S1b (PARK-S1-7 unparked): per-lane subdir `generation-context/python/` — the producer
  # (rule-bootstrap-cli.ts runPracticeRender, S1b) writes here. Closes kickoff criterion 4 by
  # construction: the cargo/go glob is `*.json` NON-RECURSIVE on the parent generation-context/
  # dir (46-cargo.sh:262, 47-go.sh:229), so python fragments in this subdir are invisible to
  # those lanes. Node synthesize (emit.ts) keeps writing `G${n}.json` to the parent dir.
  local _synth_dir="$PROJECT_ROOT/.ai-factory/synthesizer-output"
  local _frag_dir="$_synth_dir/generation-context/python"
  _json_rules=$(_py_json_rules "$ids" "$_frag_dir")
  _json_bans=$(_py_json_array "$ban_codes")

  # S1 §3 criterion 2: READ the generation-context manifest for the dependency version.
  # The manifest is emitted by the synthesizer at generation time (emit.ts writes
  # generation-context.json alongside the ast-grep YAMLs) and read here with POSIX
  # grep/sed (no Node at install time). `version` is a PLAN-LEVEL field keyed to
  # `framework` (ResearchPlan {framework, version}, research-plan.schema.json);
  # python is a LANGUAGE lane with no single framework dependency, and Provenance
  # (research/types.ts:8-22) carries url/allowlistKey/fetchedAt/packageName?/finalUrl?/tier?
  # — no version field. So no manifest today → derived null is honest. The day a
  # framework-specific python plan is synthesised, the manifest carries its version
  # and the lock reports it — no code change needed (the read is unconditional).
  # The path resolves to .ai-factory/synthesizer-output/ where the Node emitter actually
  # writes (emit.ts OUTPUT_SUBPATH) — the same dir the cargo/go lanes read. Pointing this
  # at .getff/ instead (never written by the emitter) would make the manifest-present arm
  # unreachable by construction.
  local _ctx="$_synth_dir/generation-context.json"
  local _ctx_ver='null'
  if [ -f "$_ctx" ]; then
    _ctx_ver=$(grep -oE '"version"[[:space:]]*:[[:space:]]*("[^"]*"|null)' "$_ctx" | head -1 | sed -E 's/.*:[[:space:]]*//')
  fi
  [ -n "$_ctx_ver" ] || _ctx_ver='null'
  {
    printf '{\n'
    printf '  "schemaVersion": 2,\n'
    printf '  "framework": "python",\n'
    printf '  "version": %s,\n' "$_ctx_ver"
    printf '  "rules": %s,\n' "$_json_rules"
    printf '  "ruffBans": %s,\n' "$_json_bans"
    printf '  "emittedAt": "%s",\n' "$emitted"
    printf '  "sourceFingerprint": "%s"\n' "$_fp"
    printf '}\n'
  } > "$lock"

  local _n
  _n=$(printf '%s\n' "$ids" | grep -c . || true)
  echo "  ✓ rules-lock.python.json → .getff/ (${_n} ast-grep rule id(s) + ruff bans · fingerprint ${_fp})"
}

# deliver_python_toolchain — the Python-lane entrypoint (called under the activation guard below).
deliver_python_toolchain() {
  local tpl="${PY_TEMPLATE_DIR:-$PKG_ROOT/packages/core/templates/python}"
  _PY_LOG_FILE="$PROJECT_ROOT/.getff-python-install.log"

  if [ ! -d "$tpl" ]; then
    echo "  ⚠ Python templates not found at $tpl — skipping Python delivery" >&2
    return 0
  fi

  echo "▶ Python toolchain (getff) — augment-first delivery"
  if [ "${DRY_RUN:-}" != "--dry-run" ]; then
    { printf '# getff python delivery — run at %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo unknown)"; } >> "$_PY_LOG_FILE"
  fi

  _py_deliver_astgrep "$tpl"
  _py_deliver_ruff "$tpl"
  _py_deliver_prettierignore
  _py_deliver_ci "$tpl"

  # adapter-jig C4 (no-orphan-residue): on a refresh pass, loudly report getff-header-marked
  # top-level files the CURRENT template set no longer delivers (lib.sh report_getff_orphans;
  # in-dir payloads are swept by refresh_safe already). Report-only — J2 decisions log #8.
  if [ "${GETFF_TOOLCHAIN_REFRESH:-}" = "1" ]; then
    report_getff_orphans python \
      ruff.toml sgconfig.yml getff-ruff.toml \
      .getff/ruff-bans.toml .github/workflows/getff-python.yml
  fi

  echo "  ✓ Python toolchain delivery complete (see .getff-python-install.log for the audit trail)."
}

# _py_deliver_local_hook_rung — D-S2b (getff-any-stack-trace-s2b): close the python lane's empty
# local git-hook rung by delivering a pre-push hook that runs the SAME ast-grep + ruff checks the
# CI template runs, but BEFORE the push leaves the machine (README.md#why-this-exists). The
# earliest-reachable-channel ladder (edit → pre-commit → pre-push → CI) had no local git rung for
# python consumers; this stage closes it.
#
# Verdict (SSOT #237 — prior-art-evaluations.md): BUILD bare `core.hooksPath`-style delivery as
# default, WITH integration arm for existing-hooks consumers. Pre-commit (pre-commit.com) was
# REJECTED on the runner-role verdict: criteria (a) zero-installed-prerequisites fails (Python
# required at runtime), criteria (b) augment-first fails («Cowardly refusing» guards clobber).
# Pre-commit in its scaffolder role was already REJECTED by SSOT #216 — the S2b verdict is on the
# different runner-role question (T16 problem-class separation, see prior-art-evaluations.md #237).
#
# Hook body lives at packages/core/templates/python/hooks/pre-push.sh; pre-commit fragment at
# packages/core/templates/python/hooks/getff.pre-commit-config.yaml.fragment. The hook body mirrors
# the CI template (.github/workflows/getff-python.yml) — keep the two in sync on any pin bump
# (both bump together per .claude/rules/ci-tool-pinning.md Rule A).
#
# Activation (default): git config core.hooksPath .getff/hooks. The hook file is delivered to
# .getff/hooks/pre-push (getff-namespaced, parallel to .getff/astgrep-rules/ and
# .getff/ruff-bans.toml). The consumer's existing core.hooksPath / .pre-commit-config.yaml /
# $GIT_DIR/hooks/* are NEVER clobbered (kickoff §2 item 2, criterion (b), T-S2B-B) — including
# by omission: setting core.hooksPath makes git stop consulting $GIT_DIR/hooks entirely, so the
# presence of ANY live hook there declines activation, not just a pre-push. Three integration
# cases handled by _py_integrate_* helpers below.
#
# Opt-out (kickoff §2 item 3): GETFF_SKIP_HOOKS=1 at install-time → return early, no delivery.
# Runtime opt-out lives in the hook body itself (exit 0 on GETFF_SKIP_HOOKS=1). The opt-out story
# mirrors the CI template's: documented deletion path + env escape, stated in the hook header.
#
# Idempotency + --refresh (kickoff §2 item 4): _py_copy_or_refresh wraps copy_safe/refresh_safe
# (lib.sh) so plain re-install skips (preserves consumer edits) and --refresh overwrites with the
# current template (refresh_safe honours a sibling pre-push.override.md for Layer-3 ownership).
# The .pre-commit-config.yaml append is idempotent via a marker grep; --refresh re-appends only
# when the marker is absent (no duplicate entries on either path).
_py_deliver_local_hook_rung() {
  local tpl="${PY_TEMPLATE_DIR:-$PKG_ROOT/packages/core/templates/python}"

  # Install-time opt-out — runtime opt-out is in the hook body.
  if [ "${GETFF_SKIP_HOOKS:-0}" = "1" ]; then
    echo "  ⊝ local git hook rung skipped (GETFF_SKIP_HOOKS=1 at install)"
    return 0
  fi

  echo "▶ Local git pre-push rung (getff python lane) — D-S2b / verdict SSOT #237"

  local hook_src="$tpl/hooks/pre-push.sh"
  local hook_dst_dir="$PROJECT_ROOT/.getff/hooks"
  local hook_dst="$hook_dst_dir/pre-push"

  if [ ! -f "$hook_src" ]; then
    echo "  ⚠ local git hook template missing at $hook_src — skipping rung delivery" >&2
    return 0
  fi

  # Deliver the hook body (framework-owned, getff-namespaced destination). _py_copy_or_refresh
  # wraps copy_safe/refresh_safe so --refresh overwrites a brownfield copy with the current
  # template (refresh_safe honours pre-push.override.md for Layer-3 consumer ownership).
  mkdir_safe "$hook_dst_dir"
  _py_copy_or_refresh "$hook_src" "$hook_dst"
  chmod_safe +x "$hook_dst" 2>/dev/null || true

  # Bail gracefully if $PROJECT_ROOT is not a git repo — a consumer running ./setup before
  # `git init` must NOT get a fatal (regression caught by arm 1 of python-entry-lane.test.sh:
  # py_fixture is a plain dir). The hook body is still delivered so activation is a one-liner
  # after they `git init`. The integration-arm helpers below all call `git -C` which would
  # fatal-abort the install without this guard. NOTE: case 2 (.pre-commit-config.yaml) is
  # checked BEFORE this guard — pre-commit does not need git to read its config.
  #
  # ── Integration arm (kickoff §2 item 2 + §3 + T-S2B-B): never clobber the consumer's hooks ──
  # Three pre-existing-hook cases, in priority order; default = set core.hooksPath ourselves
  # (only when the consumer has NO live hooks of their own — see the Case 3 enumeration below).
  # Case 2 is checked FIRST because the verdict (SSOT #237) names pre-commit as the integration
  # arm — if the consumer already uses it, we honour their choice and do not compete for
  # core.hooksPath.

  # Case 2: consumer uses the pre-commit framework (we have a verdict on this — SSOT #237 REJECT
  # in the runner role for fresh delivery, but the consumer already chose it; augment-first
  # means honour their choice and integrate rather than compete for core.hooksPath). This check
  # does NOT require git — pre-commit-config.yaml is a plain file.
  if [ -f "$PROJECT_ROOT/.pre-commit-config.yaml" ]; then
    _py_integrate_precommit_consumer "$tpl"
    return 0
  fi

  # Cases 1, 3, and default all use `git -C` — guard against non-git fatal here.
  if ! git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "  ⊝ not a git repo — hook body delivered to .getff/hooks/pre-push but NOT activated"
    echo "    run 'git init' then 'git config core.hooksPath .getff/hooks' to activate" >&2
    return 0
  fi

  local _existing_hookspath
  _existing_hookspath=$(git -C "$PROJECT_ROOT" config --get core.hooksPath 2>/dev/null || true)

  # Case 3 detection is an ENUMERATION of the repo's real hook directory, not a single-file test:
  # git-config(1) says that once core.hooksPath is set, git looks for hooks in that directory
  # «instead of $GIT_DIR/hooks», so activating our rung over ANY pre-existing hook (pre-commit,
  # commit-msg, post-checkout, git-secrets, gitlint, hand-written …) silently disables all of
  # them — the exact clobber this function's docstring promises never happens.
  local _existing_hooks
  _existing_hooks=$(_py_existing_git_hooks)

  if [ -n "$_existing_hookspath" ] && [ "$_existing_hookspath" != ".getff/hooks" ]; then
    # Case 1: consumer has core.hooksPath set to a non-getff path.
    _py_integrate_existing_hookspath "$_existing_hookspath"
  elif [ -z "$_existing_hookspath" ] && [ -n "$_existing_hooks" ]; then
    # Case 3: consumer has hook(s) in $GIT_DIR/hooks (and no core.hooksPath).
    _py_integrate_legacy_githook "$(_py_git_hooks_dir)" "$_existing_hooks"
  else
    # Default: activate core.hooksPath = .getff/hooks (getff-namespaced, parallel to .getff/
    # astgrep-rules/). git config is idempotent — a re-install writes the same value, no-op.
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would: git config core.hooksPath .getff/hooks"
    else
      git -C "$PROJECT_ROOT" config core.hooksPath .getff/hooks
      echo "  ✓ core.hooksPath → .getff/hooks (getff pre-push rung active)"
    fi
  fi
}

# _py_integrate_existing_hookspath — Case 1: consumer has core.hooksPath set to a non-getff path.
# We deliver our hook body to .getff/hooks/pre-push but do NOT overwrite their core.hooksPath.
# A printed notice tells them how to wire it manually. This is «cleanly declined WITH a printed
# notice» per kickoff §3 — the consumer's setup still works, getff rung integrated or declined,
# never silently broken.
_py_integrate_existing_hookspath() {
  local existing="$1"
  echo "  ⚠ consumer core.hooksPath='$existing' — NOT overwriting (T-S2B-B / augment-first)" >&2
  echo "    getff hook body delivered to .getff/hooks/pre-push but NOT activated." >&2
  echo "    To activate, EITHER:" >&2
  echo "      (a) source it from your existing hook:  . .getff/hooks/pre-push" >&2
  echo "      (b) relocate: git config core.hooksPath .getff/hooks  (migrate your old hooksPath first)" >&2
}

# _py_integrate_precommit_consumer — Case 2: consumer has .pre-commit-config.yaml.
# Append the getff entry as a local-hook fragment into their .pre-commit-config.yaml (idempotent —
# marker-grep before append). We do NOT set core.hooksPath — pre-commit manages it. The fragment
# references .getff/hooks/pre-push (delivered above), so the hook body is single-source.
_py_integrate_precommit_consumer() {
  local tpl="$1"
  local cfg="$PROJECT_ROOT/.pre-commit-config.yaml"
  local frag_marker="# getff-python-pre-push entry — delivered by setup.d/45-python.sh"
  local frag_src="$tpl/hooks/getff.pre-commit-config.yaml.fragment"

  if [ ! -f "$frag_src" ]; then
    echo "  ⚠ pre-commit fragment template missing at $frag_src — skipping .pre-commit-config.yaml integration" >&2
    return 0
  fi

  if grep -qF "$frag_marker" "$cfg" 2>/dev/null; then
    echo "  ⊝ .pre-commit-config.yaml already has the getff entry — no-op (idempotent)"
    return 0
  fi

  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would: append getff-python-pre-push entry to .pre-commit-config.yaml"
    return 0
  fi

  # Marker first (so the idempotency grep above finds it on re-run), then the fragment body.
  printf '\n%s\n' "$frag_marker" >> "$cfg"
  cat "$frag_src" >> "$cfg"
  echo "  ✓ appended getff-python-pre-push entry to .pre-commit-config.yaml"
  echo "    ⚠ run 'pre-commit install --hook-type pre-push' to activate the pre-push stage" >&2
}

# _py_git_hooks_dir — absolute path of the repository's REAL hook directory.
#
# `git rev-parse --git-path hooks` is the only correct way to reach it. A literal
# "$PROJECT_ROOT/.git/hooks" is wrong in a linked worktree, where `.git` is a FILE and the hooks
# live in the common dir — the literal test reads FALSE even when the repo HAS hooks, while
# `git config core.hooksPath` writes the SHARED config, so the pre-fix code disabled the main
# checkout's hooks from inside a worktree. `--git-path` resolves relative to the git process cwd
# (`-C "$PROJECT_ROOT"`), and returns an absolute path in the worktree case — normalise both.
_py_git_hooks_dir() {
  local _dir
  _dir=$(git -C "$PROJECT_ROOT" rev-parse --git-path hooks 2>/dev/null || true)
  [ -n "$_dir" ] || return 0
  case "$_dir" in
    /*) : ;;
    *) _dir="$PROJECT_ROOT/$_dir" ;;
  esac
  printf '%s\n' "$_dir"
}

# _py_existing_git_hooks — newline-separated names of the consumer's LIVE hooks: executable,
# non-`.sample` files in _py_git_hooks_dir. `git init` seeds that directory with executable
# `*.sample` templates that git never runs, so excluding them is what keeps the default
# activation branch reachable on a fresh repo.
_py_existing_git_hooks() {
  local _dir _f
  _dir=$(_py_git_hooks_dir)
  if [ -z "$_dir" ] || [ ! -d "$_dir" ]; then return 0; fi
  for _f in "$_dir"/*; do
    if [ ! -f "$_f" ] || [ ! -x "$_f" ]; then continue; fi
    case "$_f" in *.sample) continue ;; esac
    printf '%s\n' "${_f##*/}"
  done
}

# _py_integrate_legacy_githook — Case 3: consumer has live hook(s) in $GIT_DIR/hooks (no
# core.hooksPath). A printed notice is the entire integration — we never touch $GIT_DIR/hooks
# directly, and we do NOT set core.hooksPath, which would make git ignore that whole directory
# (T-S2B-B / augment-first; the never-clobber contract in the rung docstring above).
_py_integrate_legacy_githook() {
  local hooks_dir="$1" names="$2" list
  list=$(printf '%s' "$names" | tr '\n' ' ')
  echo "  ⚠ existing git hook(s) in $hooks_dir: ${list% } — NOT setting core.hooksPath (T-S2B-B / augment-first)" >&2
  echo "    core.hooksPath would make git look ONLY in .getff/hooks, silently disabling them." >&2
  echo "    getff hook body delivered to .getff/hooks/pre-push; to activate, EITHER:" >&2
  echo "      (a) add this line to $hooks_dir/pre-push:  . \"\$(git rev-parse --show-toplevel)/.getff/hooks/pre-push\"" >&2
  echo "      (b) move your hooks into .getff/hooks/ and run: git config core.hooksPath .getff/hooks" >&2
}

# ── Python-lane RULES.md (A2-5) ──────────────────────────────────────────────────────────────────
# _py_render_rules_md <src-template> <dst>
#
# Before this, the python lane copied packages/preset-next-15-canonical/RULES.md to the consumer's
# .ai-factory/RULES.md while the AGENTS.md it ships alongside declares that file "the rule list and
# the only place rules are stated" (AGENTS.md.template §Project rules). A Python repo therefore told
# its agents to satisfy a TypeScript/React rule set, and the ast-grep + ruff bans getff had actually
# installed were documented NOWHERE the pointer doc points (ledger finding A2-5).
#
# Rendered, not static, because the delivered rule set is NOT fixed: _py_join_researched_rules folds
# consumer-researched rules from .getff/rules-research/ into .getff/astgrep-rules/ on EVERY pass, so
# a hand-written list would start lying the first time a consumer researched a rule (principle 07,
# "documents lie"). Reading the delivered artefacts makes the table true by construction.
#
# Ownership: copy_safe semantics — skip-if-exists, --force overwrites, --refresh does NOT. This is
# the do_refresh contract for RULES.md (install.sh:614 names it consumer-authored), so the python
# lane cannot overwrite a consumer's edited rule list either. That is also why this helper carries no
# literal "$tpl/…" token: the refresh-parity gate (Check 4, refresh-covers-full-delivery.test.sh)
# demands a --refresh path for every $tpl-sourced delivery, and a consumer-owned doc must not have
# one. The template source is resolved from PY_TEMPLATE_DIR at the call site instead.
#
# Determinism: rows are sorted by rule id / ban code and carry no timestamp, so the rendered file is
# byte-stable across runs and the install snapshot fingerprint stays reproducible.
_py_render_rules_md() {
  local src="$1" dst="$2"
  local rules_dir="$PROJECT_ROOT/.getff/astgrep-rules"
  local bans="$PROJECT_ROOT/.getff/ruff-bans.toml"
  [ -f "$src" ] || return 0

  if [ -e "$dst" ] && [ "$FORCE" != "--force" ]; then
    SKIPPED+=("$dst")
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would skip: $dst (exists)"
    else
      echo "  ⊝ $dst (exists — skipping; use --force to overwrite)"
    fi
    return 0
  fi
  if [ "$DRY_RUN" = "--dry-run" ]; then
    echo "  [dry-run] would render: $dst (python rule table from the delivered .getff/ rule set)"
    return 0
  fi

  # ── Build the generated region ────────────────────────────────────────────────
  local body table msgs f id msg codes code n=0
  table='| Rule | Lane | Check |
|---|---|---|'
  msgs=''
  if [ -d "$rules_dir" ]; then
    # FLAT glob, NOT `find` — the scan dir is flat by construction (the template copy and
    # _py_join_researched_rules both write `<id>.yml` directly into it), and a recursive walk would
    # also pick up any NESTED copy of the dir, listing every rule twice. Same flat-glob shape as
    # _py_write_rules_lock's id extraction and _py_join_researched_rules' own loop.
    for f in "$rules_dir"/*.yml; do
      [ -e "$f" ] || continue   # empty-glob guard (nullglob off → literal *.yml)
      # awk, not `sed … | head -1`: awk stops at the first match on its own, so there is no
      # SIGPIPE-through-pipefail abort, and no BRE alternation (BSD sed rejects `\|` — the bug this
      # replaced). Tolerates an unquoted scalar as well as the renderer's quoted form.
      id=$(awk '/^id:/ { sub(/^id:[ \t]*/, ""); gsub(/^"|"$/, ""); print; exit }' "$f")
      [ -n "$id" ] || continue
      # A message may legitimately contain a pipe; escape it so the markdown table survives.
      msg=$(awk '/^message:/ { sub(/^message:[ \t]*/, ""); gsub(/^"|"$/, ""); print; exit }' "$f" \
        | sed 's/|/\\|/g')
      table="$table
| \`$id\` | ast-grep | \`ast-grep scan\` (rule file \`.getff/astgrep-rules/$(basename "$f")\`) |"
      if [ -n "$msg" ]; then
        msgs="$msgs
- **\`$id\`** — $msg"
      fi
      n=$((n+1))
    done
  fi
  if [ -f "$bans" ]; then
    # grep -E (ERE) throughout — BSD sed has no BRE alternation, and a `select`/`extend-select`
    # line with no recognisable code must yield an EMPTY list, not a set-e abort (`|| true`).
    codes=$(grep -E '^[[:space:]]*(extend-select|select)[[:space:]]*=' "$bans" 2>/dev/null \
      | grep -oE '"[A-Z]+[0-9]+"' | tr -d '"' | LC_ALL=C sort -u || true)
    while IFS= read -r code; do
      [ -n "$code" ] || continue
      table="$table
| \`$code\` | ruff | \`ruff check . --config .getff/ruff-bans.toml --no-cache\` |"
      n=$((n+1))
    done <<EOF
$codes
EOF
  fi

  if [ "$n" = 0 ]; then
    # Honest empty state (degrade-loudly): say nothing was found rather than render a table that
    # claims an empty rule set is a rule set.
    body='_No getff rules were found under `.getff/` when this file was rendered._'
  else
    body="$table"
    if [ -n "$msgs" ]; then
      body="$body

**What each ast-grep rule flags:**
$msgs"
    fi
  fi

  # ── Substitute between the markers (same grammar as the npm-lane preset RULES.md) ──
  # Assembled with two `sed` RANGES, not `awk -v body=…`: a -v assignment cannot carry literal
  # newlines on BSD awk (macOS) — it dies with "newline in string" and leaves a 0-byte RULES.md.
  # `sed -n '1,/pat/p'` + `sed -n '/pat/,$p'` is POSIX and needs no temp file.
  # Marker integrity is a precondition, not an assumption: without BOTH markers the ranges would
  # silently emit a duplicated or truncated doc, so fall back to a verbatim copy and say so.
  if ! grep -qxF '<!-- begin: rules-table-generated -->' "$src" \
    || ! grep -qxF '<!-- end: rules-table-generated -->' "$src"; then
    echo "  ⚠ $src is missing its rules-table-generated markers — delivering the template verbatim" >&2
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    refresh_baseline_stage "$dst"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  {
    sed -n '1,/^<!-- begin: rules-table-generated -->$/p' "$src"
    printf '\n%s\n\n' "$body"
    sed -n '/^<!-- end: rules-table-generated -->$/,$p' "$src"
  } > "$dst"
  echo "  ✓ $dst (rendered from the delivered rule set — ${n} rule(s)/ban(s))"
  refresh_baseline_stage "$dst"
}

# _py_deliver_agent_surface — D8 / spec §5: deliver the curated agent surface on the python lane.
#
# Replicates — does NOT source — the npm-lane setup.d layer logic for the curated subset (kickoff
# §2 item 1). The layer files have no activation guards against the python lane, but install.sh
# EXITS at do_python_lane BEFORE the setup.d layer loop, so they never run on this lane; sourcing
# them would deliver nothing. The replication is line-for-line from:
#   - setup.d/05-mcp.sh:17-46       (context7 → .mcp.json, idempotency-guarded)
#   - setup.d/10-skills.sh:11-50    (getff + tool-bootstrapping: direct cp + transform_internal_refs)
#   - setup.d/10-skills.sh:92-94    (rule-research + rule-tests: copy_skill_with_transform)
#   - setup.d/10-skills.sh:117-146  (deps-hash-check hook + UserPromptSubmit wiring)
#   - setup.d/10-skills.sh:201-211  (inject-matching-rule hook + PostToolUse:Edit|Write|MultiEdit)
#   - setup.d/20-agents.sh:23-47    (curated 2-agent loop)
#   - setup.d/20-agents.sh:58-69    (skill-context overrides via SHIPPED_DOCS iteration)
#   - setup.d/30-templates.sh:13-73 (.ai-factory/ subtree, default stack only — python has no STACK)
#   - setup.d/30-templates.sh:81    (AGENTS.md)
#
# The python lane has NO STACK context (it bypasses the npm stack pick at install.sh:200+), so the
# stack-specific ARCHITECTURE/RULES branches in 30-templates.sh don't apply — we always use the
# default ts-server source (canonical SSOT).
#
# Install stays Node-free (lane's defining property, kickoff §2 item 3): file delivery + jq-merge
# only. No npm, no node invocation. The .mcp.json npx-command is the consumer's runtime (their
# subscription / machine), NOT install-time — it is data delivered as JSON, not invoked here.
_py_deliver_agent_surface() {
  echo "▶ Agent surface (skills / agents / hooks / .mcp.json / AGENTS.md / .ai-factory/) — D8 / spec §5"

  # ── Skills (4-skill curated subset) ──────────────────────────────────────────
  # Replicates setup.d/10-skills.sh:11-50 (getff, tool-bootstrapping) + 92-94 (rule-research, rule-tests).
  mkdir_safe "$PROJECT_ROOT/.claude/skills"
  # getff + tool-bootstrapping ship from repo-root skills/ (not .claude/skills/). Same direct cp
  # + transform pattern as 10-skills.sh:22-30 (getff) and :43-49 (tool-bootstrapping) — the
  # up-dir repo refs in getff/SKILL.md would dangle on a consumer tree without this pass.
  # A2-4: refresh-aware (was an inline skip-if-exists block). _py_plain_skill_deliver keeps the
  # install-path behaviour byte-for-byte and adds the --refresh branch + `.override.md` escape.
  for _py_skill in getff tool-bootstrapping; do
    _py_plain_skill_deliver "$_py_skill"
  done
  # rule-research + rule-tests ship from .claude/skills/ via copy_skill_with_transform (10-skills.sh:92-94).
  for _py_skill in rule-research rule-tests; do
    _py_skill_copy_or_refresh "$_py_skill"   # A2-4: refresh-aware
  done

  # ── Agents (2-agent curated subset) ──────────────────────────────────────────
  # Replicates setup.d/20-agents.sh:23-47 for rule-researcher + rule-test-author only. The other
  # agents (review-sidecar, living-docs-auditor, compliance-verifier, memory-codification-auditor,
  # aif-init, capability-reuse-auditor, orchestrator-worker-discipline, reviewer-discipline) are
  # npm-lane concerns; the python lane ships only the rule-research pair the one-beat S3 loop needs.
  mkdir_safe "$PROJECT_ROOT/.claude/agents"
  for _py_agent in rule-researcher rule-test-author; do
    # A2-4: refresh-aware. The skip-freshly-written-transform-on-skipped-file contract of
    # 20-agents.sh:41-46 now lives inside the helper, together with the --refresh branch.
    _py_agent_copy_or_refresh "$PKG_ROOT/agents/${_py_agent}.md" \
                              "$PROJECT_ROOT/.claude/agents/${_py_agent}.md"
  done

  # ── Hooks: deps-hash-check (UserPromptSubmit) + inject-matching-rule (PostToolUse:Edit|Write|MultiEdit) ─
  # Replicates setup.d/10-skills.sh:117-146 (deps-hash-check) + 201-211 (inject-matching-rule).
  # Both wired into .claude/settings.json via register_cc_hook — the canonical helper. The inline
  # settings-creation block in 10-skills.sh:128-146 was written before register_cc_hook existed;
  # register_cc_hook handles the same create-or-merge + idempotence shape strictly better.
  mkdir_safe "$PROJECT_ROOT/.claude/hooks"
  _py_settings="$PROJECT_ROOT/.claude/settings.json"

  local _py_dhc_src="$PKG_ROOT/packages/core/hooks/deps-hash-check.sh"
  local _py_dhc_dst="$PROJECT_ROOT/.claude/hooks/deps-hash-check.sh"
  if [ -f "$_py_dhc_src" ]; then
    _py_copy_or_refresh "$_py_dhc_src" "$_py_dhc_dst"   # A2-4: refresh-aware
    chmod_safe +x "$_py_dhc_dst" 2>/dev/null || true
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would: register deps-hash-check as UserPromptSubmit hook in .claude/settings.json"
    else
      register_cc_hook "$_py_settings" "UserPromptSubmit" 'bash .claude/hooks/deps-hash-check.sh' "deps-hash-check"
    fi
  fi

  # inject-matching-rule — DELIVERED EXACTLY AS setup.d/10-skills.sh:201-209 (kickoff §2 item 1 binding).
  local _py_imr_src="$PKG_ROOT/.claude/hooks/inject-matching-rule.sh"
  local _py_imr_dst="$PROJECT_ROOT/.claude/hooks/inject-matching-rule.sh"
  if [ -f "$_py_imr_src" ]; then
    _py_copy_or_refresh "$_py_imr_src" "$_py_imr_dst"   # A2-4: refresh-aware
    chmod_safe +x "$_py_imr_dst" 2>/dev/null || true
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [dry-run] would: register inject-matching-rule as a PostToolUse:Edit|Write|MultiEdit hook in .claude/settings.json"
    else
      register_cc_hook "$_py_settings" "PostToolUse" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-matching-rule.sh"' "inject-matching-rule" "Edit|Write|MultiEdit"
    fi
  fi

  # ── .mcp.json (context7 only) ────────────────────────────────────────────────
  # Replicates setup.d/05-mcp.sh:17-46 — context7-specific with an idempotency guard. The python
  # lane does NOT source 05-mcp.sh (that file is FULL-gated which python never sets, AND the
  # layer loop never runs), so this is the only delivery channel for context7 on this lane.
  local _py_mcp="$PROJECT_ROOT/.mcp.json"
  local _py_mcp_skip=0
  if [ -f "$_py_mcp" ] && grep -q '"context7"' "$_py_mcp" 2>/dev/null && [ -z "${FORCE:-}" ]; then
    _py_mcp_skip=1
  fi
  if [ "$_py_mcp_skip" = "1" ]; then
    echo "  ⊝ context7 already in .mcp.json — skipping (use --force to refresh)"
  elif [ -n "${DRY_RUN:-}" ]; then
    echo "  [dry-run] would: add context7 to .mcp.json ($_py_mcp)"
  elif command -v jq >/dev/null 2>&1; then
    if [ -f "$_py_mcp" ]; then
      jq '.mcpServers["context7"] = {"command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"]}' \
        "$_py_mcp" > "$_py_mcp.tmp" && mv "$_py_mcp.tmp" "$_py_mcp"
      echo "  ✓ context7 added/updated in existing .mcp.json"
    else
      printf '{"mcpServers":{"context7":{"command":"npx","args":["-y","@upstash/context7-mcp@latest"]}}}\n' \
        > "$_py_mcp"
      echo "  ✓ .mcp.json created with context7"
    fi
  else
    echo "  ⚠ jq not found — add context7 to .mcp.json manually:"
    echo "    \"mcpServers\": { \"context7\": { \"command\": \"npx\", \"args\": [\"-y\", \"@upstash/context7-mcp@latest\"] } }"
  fi

  # ── AGENTS.md ─────────────────────────────────────────────────────────────────
  # Replicates setup.d/30-templates.sh — starter AGENTS.md at project root, delivered as a
  # co-owned fenced section (spec C1 (b)). Routed through the same install_agents_md wrapper
  # as the npm lane so the section id / plan / adopt-sentinels cannot drift between lanes.
  install_agents_md "$PKG_ROOT/packages/core/templates/shared/AGENTS.md.template" "$PROJECT_ROOT/AGENTS.md"

  # ── .ai-factory/ agent-surface subtree ───────────────────────────────────────
  # Replicates setup.d/30-templates.sh:13-73 — minus the react-* stack branches (the python lane
  # has no STACK context — install.sh exits at do_python_lane before the npm stack pick). Default
  # stack source = ts-server (canonical SSOT).
  mkdir_safe "$PROJECT_ROOT/.ai-factory/rules"
  mkdir_safe "$PROJECT_ROOT/.ai-factory/orchestrator-prompts"
  copy_safe "$PKG_ROOT/packages/core/templates/shared/DESCRIPTION.template.md" "$PROJECT_ROOT/.ai-factory/DESCRIPTION.template.md"
  copy_safe "$PKG_ROOT/packages/core/templates/shared/ARCHITECTURE.ts-server.md" "$PROJECT_ROOT/.ai-factory/ARCHITECTURE.ts-server.md"
  # A2-5: the python lane renders its OWN rule list from the rules it actually delivered. It used
  # to copy the Next.js-15 preset's RULES.md here, which told a Python repo's agents to satisfy a
  # TypeScript/React rule set while the delivered ast-grep/ruff bans went undocumented.
  _py_render_rules_md "${PY_TEMPLATE_DIR:-$PKG_ROOT/packages/core/templates/python}/RULES.md" \
                      "$PROJECT_ROOT/.ai-factory/RULES.md"
  copy_safe "$PKG_ROOT/packages/core/templates/shared/integration-rules.md" "$PROJECT_ROOT/.ai-factory/rules/integration-rules.md"
  copy_safe "$PKG_ROOT/skills/tool-bootstrapping/templates/tool-decisions.md.template" "$PROJECT_ROOT/.ai-factory/tool-decisions.md"
  # AI Usage Guide — same every-depth delivery as the npm lane (30-templates.sh). Lane parity:
  # a python consumer that lands AGENTS.md's pointer but not its target gets a dangling reference.
  # A2-4: refresh-aware — the ONE .ai-factory/ content doc do_refresh also refreshes
  # (install.sh:1218). Its siblings below stay copy_safe: they are consumer-editable by contract.
  _py_copy_or_refresh "$PKG_ROOT/packages/core/templates/shared/AI-USAGE-GUIDE.md" "$PROJECT_ROOT/.ai-factory/AI-USAGE-GUIDE.md"

  # Materialize the AGENTS.md-referenced SoT (30-templates.sh:67-73). AGENTS.md.template sends the
  # first agent session to .ai-factory/DESCRIPTION.md + ARCHITECTURE.md; without materialization
  # the references dangle on landing (the framework's first impression).
  copy_safe "$PKG_ROOT/packages/core/templates/shared/DESCRIPTION.template.md" "$PROJECT_ROOT/.ai-factory/DESCRIPTION.md"
  _py_arch_dst="$PROJECT_ROOT/.ai-factory/ARCHITECTURE.md"
  _py_arch_existed=0; [ -e "$_py_arch_dst" ] && _py_arch_existed=1
  copy_safe "$PKG_ROOT/packages/core/templates/shared/ARCHITECTURE.ts-server.md" "$_py_arch_dst"
  rewrite_arch_sot_header "$_py_arch_dst" "$_py_arch_existed"

  # skill-context overrides (replicates 20-agents.sh:58-69). SHIPPED_DOCS is in scope from install.sh:145.
  # `${arr[@]+"${arr[@]}"}` = bash-3.2-safe empty-array expansion under set -u (macOS ships 3.2).
  for _py_doc in ${SHIPPED_DOCS[@]+"${SHIPPED_DOCS[@]}"}; do
    case "$_py_doc" in
      packages/core/templates/shared/skill-context/*/SKILL.md)
        _py_sc="${_py_doc#packages/core/templates/shared/skill-context/}"; _py_sc="${_py_sc%/SKILL.md}"
        # Same suite-gate as 20-agents.sh:64-65 — aif-orchestrator-discipline pairs with the gated
        # orchestrator-worker-discipline agent (not in the python curated subset, so this skips too).
        if [ "$_py_sc" = "aif-orchestrator-discipline" ] && [ -z "${WITH_AIF_SUITE:-}" ] \
          && [ ! -e "$PROJECT_ROOT/.ai-factory/skill-context/$_py_sc/SKILL.md" ]; then continue; fi
        mkdir_safe "$PROJECT_ROOT/.ai-factory/skill-context/$_py_sc"
        # A2-4: refresh-aware — parity with do_refresh's skill-context arm (install.sh:1231).
        _py_copy_or_refresh "$PKG_ROOT/$_py_doc" "$PROJECT_ROOT/.ai-factory/skill-context/$_py_sc/SKILL.md" ;;
    esac
  done

  # ── Local git pre-push rung (D-S2b) ──────────────────────────────────────────
  # Closes the python lane's empty git-hook rung (kickoff §1). Verdict = BUILD bare
  # core.hooksPath-style delivery with integration arm (SSOT #237). See helper docstring above.
  _py_deliver_local_hook_rung

  echo "  ✓ Agent surface delivery complete"
}

# ── Test seam: define the functions above but skip the auto-delivery (tests drive per-fixture) ──
if [ "${PY_LAYER_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi

# ── Activation guard: INERT unless the Python lane is explicitly selected (S2 sets GETFF_TOOLCHAIN) ──
if [ "${GETFF_TOOLCHAIN:-}" = "python" ]; then
  deliver_python_toolchain
fi
