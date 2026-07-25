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
  # `ruff check .` discovers, so it NEVER sees our TID bans — probe-proven silent-unenforcement (S2-T2
  # review; .superpowers/sdd/s2-task-2-report.md §Fix round 1). `--config` makes ruff REPLACE discovery
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

  local _json_ids _json_bans
  _json_ids=$(_py_json_array "$ids")
  _json_bans=$(_py_json_array "$ban_codes")

  {
    printf '{\n'
    printf '  "schemaVersion": 1,\n'
    printf '  "framework": "python",\n'
    printf '  "version": null,\n'
    printf '  "ruleIds": %s,\n' "$_json_ids"
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

# ── Test seam: define the functions above but skip the auto-delivery (tests drive per-fixture) ──
if [ "${PY_LAYER_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi

# ── Activation guard: INERT unless the Python lane is explicitly selected (S2 sets GETFF_TOOLCHAIN) ──
if [ "${GETFF_TOOLCHAIN:-}" = "python" ]; then
  deliver_python_toolchain
fi
