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
#                                           they already use it).
#   (iv)  pre-existing pyproject.toml      → REFUSE-LOUDLY. A sibling ruff.toml SILENTLY overrides
#         [tool.ruff] (and no ruff.toml)     their [tool.ruff] (probe-proven). Write getff-ruff.toml
#                                           + print merge-into-[tool.ruff.lint] instructions.
#   (v)   re-run                          → zero diff on the delivered CONFIG artefacts (idempotent).
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
  if grep -qE '^[[:space:]]*-[[:space:]]+\.getff/astgrep-rules[[:space:]]*$' "$dst"; then
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

# _py_deliver_astgrep — ast-grep lane: rules dir (always) + sgconfig.yml (fresh copy | merge | refuse).
_py_deliver_astgrep() {
  local tpl="$1"

  # The rules dir MUST exist before any `ast-grep scan` (missing dir = exit 6, Probe 6). Copy it in
  # every branch (fresh AND pre-existing sgconfig) via copy_safe (skip-if-exists → idempotent re-run).
  copy_safe "$tpl/.getff/astgrep-rules" "$PROJECT_ROOT/.getff/astgrep-rules"
  _py_log "ast-grep rules dir → .getff/astgrep-rules (framework-owned)"

  local dst="$PROJECT_ROOT/sgconfig.yml"
  if [ ! -e "$dst" ]; then
    copy_safe "$tpl/sgconfig.yml" "$dst"
    _py_log "sgconfig.yml → copied (fresh dir, cell i)"
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

  # Idempotency: a ruff.toml WE already delivered (carries the getff header) is not a consumer
  # collision — no-op on re-run. This MUST precede the cell-(iii) refuse so our own fresh-install
  # output is not mistaken for a consumer's file on the second run.
  if [ -e "$ruff_dst" ] && grep -q 'generated by getff' "$ruff_dst" 2>/dev/null; then
    _py_log "⊝ ruff.toml already delivered by getff — no-op (idempotent)"
    return 0
  fi

  # (iii) consumer ruff.toml / .ruff.toml present → a sibling ruff.toml of ours would win entirely
  # and silently disable theirs (Probe 1). REFUSE: ship a non-discovered getff-ruff.toml + `extend`.
  if [ -e "$ruff_dst" ] || [ -e "$PROJECT_ROOT/.ruff.toml" ]; then
    local existing="$ruff_dst"; [ -e "$existing" ] || existing="$PROJECT_ROOT/.ruff.toml"
    copy_safe "$tpl/ruff.toml" "$getff_ref"
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
    copy_safe "$tpl/ruff.toml" "$getff_ref"
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
