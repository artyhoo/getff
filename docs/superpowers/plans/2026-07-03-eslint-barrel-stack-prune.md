# ESLint Barrel Stack-Prune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issue [#882](https://github.com/artyhoo/rules-as-tests-aif/issues/882) — `install.sh <stack> --force`/`--refresh` with a stack different from a prior install strands the prior stack's preset-rule files in `eslint-rules-local/` and re-registers them in the generated ESLint barrel.

**Architecture:** Add a prune step inside the single shared `generate_eslint_barrel()` function (`setup.d/lib.sh`) — it already runs from both the full-install path (`setup.d/40-configs.sh`) and the refresh path (`install.sh`'s `do_refresh()`), so fixing it there closes both call sites with one change. The prune step computes which rule basenames are valid for the CURRENT `$STACK` (core rules always + that stack's own preset dir, if any) and deletes any `eslint-rules-local/*.ts` (+ `.mjs`/`.d.ts` siblings) not in that set, before the existing barrel-content generation runs.

**Tech Stack:** Bash (`setup.d/lib.sh`), Bash test harness (`tests/install-sh/*.test.sh`, no test framework — plain PASS/FAIL/SKIP counters), GitHub Actions YAML (`.github/workflows/audit-self.yml`).

## Global Constraints

- No new dependencies, no new persisted state/marker files (per the approved design: [docs/superpowers/specs/2026-07-03-eslint-barrel-stack-prune-design.md](../specs/2026-07-03-eslint-barrel-stack-prune-design.md)).
- Do NOT modify `setup.d/40-configs.sh`'s or `install.sh`'s `do_refresh()`'s existing copy-loop code — the stack→dirs mapping for pruning lives ONLY inside `generate_eslint_barrel()`, isolated, per the design's explicit rejection of a shared-helper refactor (conflicts with this project's "a bug fix doesn't need surrounding cleanup" convention).
- The prune step must stay inside the existing `if [ -z "$DRY_RUN" ]` guard in `generate_eslint_barrel()` — no new dry-run granularity.
- Any new `tests/install-sh/*.test.sh` file MUST be wired into `.github/workflows/audit-self.yml` in the same change — this repo has hit "test written, never wired into CI" before (issue #869 class).
- Use `rm -f` (not bare `rm`) for pruned files — some rules may legitimately lack a compiled `.mjs`/`.d.ts` sibling.

---

### Task 1: Write the failing paired-negative test

**Files:**
- Create: `tests/install-sh/refresh-different-stack-prunes-barrel.test.sh`

**Interfaces:**
- Consumes: `install.sh` (repo root), stack literals `react-next` / `ts-server` as CLI args + `--force` / `--refresh` flags.
- Produces: nothing consumed by later tasks — this is a standalone verification script (`bash tests/install-sh/refresh-different-stack-prunes-barrel.test.sh`, exit 0 = all PASS).

- [ ] **Step 1: Write the test file**

```bash
#!/usr/bin/env bash
# refresh-different-stack-prunes-barrel.test.sh — #882: install.sh <stack> --force/--refresh
# with a DIFFERENT --stack than a prior install must prune the prior stack's stray preset-rule
# files from eslint-rules-local/, not just re-derive the barrel from whatever's on disk.
#
# Root cause: do_refresh() / the full-install copy path only ADD/OVERWRITE the CURRENT stack's
# rule files (setup.d/40-configs.sh conditional copy, install.sh's do_refresh refresh loop) —
# neither ever removes a DIFFERENT stack's leftover preset-rule file. generate_eslint_barrel()
# (setup.d/lib.sh) then regenerates the barrel from an unconditional glob of
# eslint-rules-local/*.ts, so a stranded rule from a PRIOR stack gets re-registered.
#
# Paired-negative shape: arm 2 proves the defect via --force; arm 3 proves it via --refresh
# (both call sites share generate_eslint_barrel, so one fix covers both).
#
# Deterministic, no network: real install.sh runs into mktemp fixtures, mirroring
# tests/install-sh/refresh-regenerates-barrel.test.sh's pattern. Graceful skip (rc=0) if
# install.sh cannot complete in this env.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALL="$REPO_ROOT/install.sh"

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  · $1"; }

[ -f "$INSTALL" ] || { echo "FATAL: $INSTALL not found"; exit 1; }

# barrel_keys <dir> — sorted, unique rule-keys registered in a barrel index.mjs.
barrel_keys() {
  grep -oE "^    '[a-z0-9-]+':" "$1/eslint-rules-local/index.mjs" 2>/dev/null | sed -E "s/^    '//; s/'://" | sort -u
}

BASELINE=$(mktemp -d)
FIXTURE_A=$(mktemp -d)
FIXTURE_B=$(mktemp -d)
trap 'rm -rf "$BASELINE" "$FIXTURE_A" "$FIXTURE_B"' EXIT

# ── Arm 1 (setup): fresh baseline — what a CLEAN ts-server --force install's barrel looks like ──
printf '{"name":"baseline-ts-server","version":"0.0.0"}\n' > "$BASELINE/package.json"
( cd "$BASELINE" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
( cd "$BASELINE" && bash "$INSTALL" ts-server --force < /dev/null ) > "$BASELINE/.install.log" 2>&1
BASELINE_RC=$?

if [ "$BASELINE_RC" -ne 0 ] || [ ! -f "$BASELINE/eslint-rules-local/index.mjs" ]; then
  skip "(all arms) baseline ts-server install could not complete in this env (rc=$BASELINE_RC, log tail: $(tail -5 "$BASELINE/.install.log" 2>/dev/null | tr '\n' '|'))"
  echo ""
  echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  exit 0
fi
BASELINE_KEYS=$(barrel_keys "$BASELINE")
ok "(setup) clean ts-server --force barrel key-set: [$(echo "$BASELINE_KEYS" | tr '\n' ',')]"

# ── Arm 2 (stack switch via --force): react-next --force, then ts-server --force, same dir ──
printf '{"name":"switch-via-force","version":"0.0.0"}\n' > "$FIXTURE_A/package.json"
( cd "$FIXTURE_A" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
( cd "$FIXTURE_A" && bash "$INSTALL" react-next --force < /dev/null ) > "$FIXTURE_A/.i1.log" 2>&1
A1_RC=$?

if [ "$A1_RC" -ne 0 ] || [ ! -f "$FIXTURE_A/eslint-rules-local/no-server-imports-in-client.ts" ]; then
  bad "(arm 2, setup) react-next --force did not produce no-server-imports-in-client.ts — fixture assumption broke (rc=$A1_RC)"
else
  ok "(arm 2, setup) react-next --force produced no-server-imports-in-client.ts"

  ( cd "$FIXTURE_A" && bash "$INSTALL" ts-server --force < /dev/null ) > "$FIXTURE_A/.i2.log" 2>&1
  A2_RC=$?
  if [ "$A2_RC" -ne 0 ]; then
    bad "(arm 2) install.sh ts-server --force exited non-zero (rc=$A2_RC, log tail: $(tail -8 "$FIXTURE_A/.i2.log" | tr '\n' '|'))"
  else
    ok "(arm 2) install.sh ts-server --force (stack switch) completed rc=0"
  fi

  STRAY_COUNT_A=$(find "$FIXTURE_A/eslint-rules-local" -maxdepth 1 -name 'no-server-imports-in-client.*' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$STRAY_COUNT_A" -eq 0 ]; then
    ok "(arm 2, pos) no-server-imports-in-client.* pruned from disk after stack switch via --force"
  else
    bad "(arm 2, pos) no-server-imports-in-client.* still on disk after --force stack switch ($STRAY_COUNT_A file(s)) — the #882 bug"
  fi

  A_KEYS=$(barrel_keys "$FIXTURE_A")
  if [ "$A_KEYS" = "$BASELINE_KEYS" ]; then
    ok "(arm 2, pos) barrel key-set after --force stack switch matches a clean ts-server install exactly"
  else
    bad "(arm 2, pos) barrel key-set diverges from clean ts-server baseline — got:[$(echo "$A_KEYS" | tr '\n' ',')] want:[$(echo "$BASELINE_KEYS" | tr '\n' ',')]"
  fi
fi

# ── Arm 3 (stack switch via --refresh): react-next --force, then ts-server --refresh, same dir ──
printf '{"name":"switch-via-refresh","version":"0.0.0"}\n' > "$FIXTURE_B/package.json"
( cd "$FIXTURE_B" && git init -q && git config user.email "test@test.com" && git config user.name "Test" ) >/dev/null 2>&1
( cd "$FIXTURE_B" && bash "$INSTALL" react-next --force < /dev/null ) > "$FIXTURE_B/.i1.log" 2>&1
B1_RC=$?

if [ "$B1_RC" -ne 0 ] || [ ! -f "$FIXTURE_B/eslint-rules-local/no-server-imports-in-client.ts" ]; then
  bad "(arm 3, setup) react-next --force did not produce no-server-imports-in-client.ts — fixture assumption broke (rc=$B1_RC)"
else
  ok "(arm 3, setup) react-next --force produced no-server-imports-in-client.ts"

  ( cd "$FIXTURE_B" && bash "$INSTALL" ts-server --refresh < /dev/null ) > "$FIXTURE_B/.i2.log" 2>&1
  B2_RC=$?
  if [ "$B2_RC" -ne 0 ]; then
    bad "(arm 3) install.sh ts-server --refresh exited non-zero (rc=$B2_RC, log tail: $(tail -8 "$FIXTURE_B/.i2.log" | tr '\n' '|'))"
  else
    ok "(arm 3) install.sh ts-server --refresh (stack switch) completed rc=0"
  fi

  STRAY_COUNT_B=$(find "$FIXTURE_B/eslint-rules-local" -maxdepth 1 -name 'no-server-imports-in-client.*' 2>/dev/null | wc -l | tr -d ' ')
  if [ "$STRAY_COUNT_B" -eq 0 ]; then
    ok "(arm 3, pos) no-server-imports-in-client.* pruned from disk after stack switch via --refresh"
  else
    bad "(arm 3, pos) no-server-imports-in-client.* still on disk after --refresh stack switch ($STRAY_COUNT_B file(s)) — the #882 bug"
  fi

  B_KEYS=$(barrel_keys "$FIXTURE_B")
  if [ "$B_KEYS" = "$BASELINE_KEYS" ]; then
    ok "(arm 3, pos) barrel key-set after --refresh stack switch matches a clean ts-server install exactly"
  else
    bad "(arm 3, pos) barrel key-set diverges from clean ts-server baseline — got:[$(echo "$B_KEYS" | tr '\n' ',')] want:[$(echo "$BASELINE_KEYS" | tr '\n' ',')]"
  fi
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Make it executable and run it against current (unfixed) code**

Run: `chmod +x tests/install-sh/refresh-different-stack-prunes-barrel.test.sh && bash tests/install-sh/refresh-different-stack-prunes-barrel.test.sh`

Expected: `FAIL` count > 0, specifically on the two `(pos)` assertions per arm — `✗ ... still on disk after --force stack switch (3 file(s))` and `✗ ... barrel key-set diverges from clean ts-server baseline` (and the same pair for arm 3/`--refresh`). The `(setup)` assertions should PASS — if a `(setup)` line fails instead, a fixture assumption is wrong and must be fixed before continuing (not the actual bug under test).

- [ ] **Step 3: Commit**

```bash
git add tests/install-sh/refresh-different-stack-prunes-barrel.test.sh
git commit -m "test(install-sh): add failing paired-negative for #882 stack-switch barrel strand"
```

---

### Task 2: Implement the prune fix in `generate_eslint_barrel()`

**Files:**
- Modify: `setup.d/lib.sh:474-553`

**Interfaces:**
- Consumes: globals `$PROJECT_ROOT`, `$PKG_ROOT`, `$DRY_RUN` (existing), `$STACK` (newly read by this function).
- Produces: no new function signature — `generate_eslint_barrel()` keeps its existing no-arg call convention used by both `setup.d/40-configs.sh:175` and `install.sh:411`.

- [ ] **Step 1: Update the header comment and function body**

Replace the block from `# generate_eslint_barrel` (line 474) through the line `_barrel="$PROJECT_ROOT/eslint-rules-local/index.mjs"` (line 489):

```bash
# generate_eslint_barrel
# #876 groundwork: single source of truth for the eslint-rules-local/index.mjs barrel generator
# + the #838 stack-scoped fences-fire fixture prune. Extracted VERBATIM (byte-identical output)
# from setup.d/40-configs.sh's former inline block — see the "why" comments that precede its call
# site there for the barrel-generation rationale (Variant A / fix #752, FQA S1-A W1).
# Precondition: call AFTER the eslint-rules-local/ rule files AND the scripts/fences-fire-fixtures/
# directory are in place — it reads the on-disk rule set and prunes fixtures whose rule is not in
# this stack's barrel.
# Self-no-ops on --dry-run (the `if [ -z "$DRY_RUN" ]; then … fi` guard is INSIDE the helper, so
# callers don't need to guard). Called by BOTH setup.d/40-configs.sh (copy path) and do_refresh in
# install.sh (refresh path, #876) — do not duplicate this logic at either call site.
# Reads globals: PROJECT_ROOT, PKG_ROOT, DRY_RUN.
generate_eslint_barrel() {
  local _barrel _rf _b _camel _m _mstem _rid _rkey
  if [ -z "$DRY_RUN" ]; then
    _barrel="$PROJECT_ROOT/eslint-rules-local/index.mjs"
```

with:

```bash
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
  if [ -z "$DRY_RUN" ]; then
    _barrel="$PROJECT_ROOT/eslint-rules-local/index.mjs"

    # #882: prune stray rule files from a DIFFERENT stack before generating barrel content below,
    # so a stranded rule from a prior install/refresh isn't re-registered. Small, isolated mapping
    # (not shared with the copy loops) — see design doc note above.
    _valid_dirs="packages/core/eslint-rules"
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
    for _ef in "$PROJECT_ROOT"/eslint-rules-local/*.ts; do
      [ -e "$_ef" ] || continue
      case "$_ef" in *.d.ts) continue ;; esac
      _eb=$(basename "$_ef" .ts); [ "$_eb" = "index" ] && continue
      case "$_valid_basenames" in
        *" $_eb "*) ;;  # valid for this stack — keep
        *)
          rm -f "$PROJECT_ROOT/eslint-rules-local/$_eb.ts" \
                "$PROJECT_ROOT/eslint-rules-local/$_eb.mjs" \
                "$PROJECT_ROOT/eslint-rules-local/$_eb.d.ts"
          echo "  · pruned stale rule [$_eb] — not part of the $STACK stack"
          ;;
      esac
    done
```

Everything from the `{` that opens the barrel-content heredoc-style block through the end of the function (the existing `#838` fences-fire fixture prune) stays **unchanged** — this is a pure insertion, not a rewrite of the rest of the function.

- [ ] **Step 2: Run the new test, verify it now passes**

Run: `bash tests/install-sh/refresh-different-stack-prunes-barrel.test.sh`

Expected: `PASS=<N> FAIL=0 SKIP=0`, every line starting with `✓`, including both `(pos)` assertions for arm 2 (`--force`) and arm 3 (`--refresh`).

- [ ] **Step 3: Run the sibling test to confirm no regression**

Run: `bash tests/install-sh/refresh-regenerates-barrel.test.sh`

Expected: `FAIL=0` (same as before this change — this test covers same-stack refresh behavior, which this fix must not break).

- [ ] **Step 4: Commit**

```bash
git add setup.d/lib.sh
git commit -m "fix(install): prune stale eslint-rules-local rules on stack switch (#882)"
```

---

### Task 3: Wire the new test into CI

**Files:**
- Modify: `.github/workflows/audit-self.yml:377-378`

**Interfaces:**
- Consumes: `tests/install-sh/refresh-different-stack-prunes-barrel.test.sh` (Task 1).
- Produces: nothing consumed by later tasks — this is the last task in this plan.

- [ ] **Step 1: Insert a new step right after the sibling `refresh-regenerates-barrel` step**

Current (`.github/workflows/audit-self.yml:377-379`):

```yaml
      - name: "install-sh — refresh regenerates eslint barrel (#876: --refresh re-derives index.mjs so a new rule isn't stranded)"
        run: bash tests/install-sh/refresh-regenerates-barrel.test.sh
      - name: install-sh — gh-636 dispatcher tsx probe (degrade to fallback, never crash on unresolvable tsx)
```

Replace with:

```yaml
      - name: "install-sh — refresh regenerates eslint barrel (#876: --refresh re-derives index.mjs so a new rule isn't stranded)"
        run: bash tests/install-sh/refresh-regenerates-barrel.test.sh
      - name: "install-sh — different-stack switch prunes barrel (#882: --force/--refresh with a NEW stack removes the prior stack's stray preset rule)"
        run: bash tests/install-sh/refresh-different-stack-prunes-barrel.test.sh
      - name: install-sh — gh-636 dispatcher tsx probe (degrade to fallback, never crash on unresolvable tsx)
```

- [ ] **Step 2: Validate the workflow YAML**

Run: `actionlint .github/workflows/audit-self.yml`

Expected: no new errors/warnings introduced by this change (pre-existing findings, if any, are out of scope).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/audit-self.yml
git commit -m "ci(install-sh): wire #882 stack-switch-prunes-barrel test into audit-self.yml"
```
