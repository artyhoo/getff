# Consumer Plugin Hook Dedup — D12 + D5 re-cut

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Amend the base plan [2026-09-28-consumer-plugin-hook-dedup.md](2026-09-28-consumer-plugin-hook-dedup.md) for spec revision 3: the plugin copy yields in a consumer only after claiming a liveness marker the project copy wrote for this very event (D12), and the output-language line gets one emitter per channel through a runtime `AIF_HOOK_CHANNEL` check (D5 r3).

**Architecture:** The project copy of each yield-capable hook sources `.claude/hooks/lib/hook-live.sh`, which buffers stdin and drops a marker `${TMPDIR:-/tmp}/getff-hook-live/<session_id>/<key>.<epoch>.<pid>`. In consumer mode `run-hook.cmd` buffers stdin, computes the same key with `plugin/hooks/lib/live-claim.sh`, waits ≤300 ms for a marker ≤5 s old and claims it with `mv`. Claimed ⇒ exit 0; anything else ⇒ run. Source-checkout mode (#1879) is unchanged.

**Tech Stack:** bash 3.2 (project lib, tests), POSIX sh (plugin lib, `run-hook.cmd`, must pass `dash -n`), jq, sha256sum|shasum. **Spec:** [2026-09-28-consumer-plugin-hook-dedup-design.md](../specs/2026-09-28-consumer-plugin-hook-dedup-design.md) D5 (r3), D12.

## Global Constraints

- All base-plan Global Constraints apply. Execution order: base Task 1 → base Task 2 **with the Task 2 amendment below** → Task D12 → Task 3′ (replaces base Task 3) → base Task 4 → base Task 5 → Task 6 **with the amendment below**.
- Every doubt resolves to «run». No marker, no `session_id`, no jq, no hashing tool, a stale or foreign marker, a failed `mv` ⇒ the plugin copy runs.
- The project copy never yields and never fails because of the prelude: every prelude error leaves no marker and the hook runs as before.
- The prelude does nothing when `AIF_HOOK_CHANNEL=plugin` (the twin running on the plugin channel must not mark itself) or on ZCode (D6: nothing there ever claims).
- `deps-hash-check` gets no prelude: its cwd-relative registration never counts (D4), so nothing would claim its markers.
- `hook-live.sh` does not ship in the plugin. The twin's prelude line finds no lib there and is a no-op.
- #1911 (open at plan time) narrows the shared yield `if` with a payload-`cwd` guard. When it lands, merge staging; both modes inherit the guard because it sits in the shared condition. Add arm C-cwd (Task 2 amendment).
- Plugin version: bump once, at PR time, to (the version on `origin/staging` at that moment) + 1 patch.

## File Map (additions to the base plan)

| File | Change | Responsibility |
|---|---|---|
| `.claude/hooks/lib/hook-live.sh` | create | project side: buffer stdin, write the event marker, prune the session's old markers |
| `plugin/hooks/lib/live-claim.sh` | create | plugin side: event key, bounded wait, atomic claim |
| `.claude/hooks/{end-of-turn-reminder,ask-question-reminder,inject-matching-rule,inject-output-language,check-doc-authority-header,inject-project-digest,inject-memory-codification}.sh` | modify | prelude line + `lib/hook-live.sh` in `@plugin-yield-deps` |
| `plugin/hooks/<same seven>` | regenerate | `bash scripts/generate-plugin-twins.sh` (pre-commit does it too) |
| `plugin/hooks/run-hook.cmd` | modify | `AIF_HOOK_CHANNEL` export (D5) + consumer-mode claim (D12) |
| `.claude/hooks/inject-session-bootstrap.sh` + twin | modify | language `case` keyed on channel (D5) |
| `setup.d/10-skills.sh`, `install.sh`, `setup.d/45-python.sh` | modify | deliver `lib/hook-live.sh` wherever a prelude hook is delivered |
| `tests/plugin/hook-live.test.sh` | create | L arms (project lib) + K arm (key parity with the plugin lib) |
| `tests/plugin/run-hook.test.sh` | modify | marker planting in C arms, D arms, D5 arms |
| `.github/workflows/audit-self.yml` | modify | run `tests/plugin/hook-live.test.sh` beside `run-hook.test.sh` |

### Task 2 amendment: consumer yields need a claimed marker

Apply while executing base Task 2.

- [ ] **A1.** In base Task 2 Step 4, replace the single `exit 0` inside the registration `if` with:

```sh
      if [ "$_yield_mode" = source ] || getff_live_claim "$_name"; then
        exit 0
      fi
```

and add this line to the `consumer` branch of the mode detection, after `. "${SCRIPT_DIR}/lib/source-hash.sh"`: `&& [ -f "${SCRIPT_DIR}/lib/live-claim.sh" ] && . "${SCRIPT_DIR}/lib/live-claim.sh"`.

- [ ] **A2.** Replace the final `exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"` with:

```sh
if [ -n "${_live_in:-}" ]; then
  exec 3<"$_live_in"
  rm -f "$_live_in"
  exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@" <&3 3<&-
fi
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
```

- [ ] **A3.** The base C arms expect «yields» from conditions alone. Under D12 a yield also needs a marker. Add to the C fixture, after `pin_manifest()`:

```sh
PAYLOAD='{"session_id":"s-test","hook_event_name":"UserPromptSubmit","prompt":"hi"}'
# plant <hook-name> [<age-seconds>] — the marker the project copy's prelude would write for $PAYLOAD
plant() {
  ( . "$REPO_ROOT/plugin/hooks/lib/live-claim.sh"
    k=$(printf '%s' "$PAYLOAD" > "$TMPD/p.json"; getff_live_key "$1" "$TMPD/p.json") || exit 1
    d="${TMPDIR:-/tmp}/getff-hook-live/s-test"; mkdir -p "$d"
    : > "$d/$k.$(( $(date +%s) - ${2:-0} )).$$" )
}
run_rp() { local sh="$1"; shift; printf '%s' "$PAYLOAD" | run_rh "$sh" "$@"; }
```

Every base C arm that expects `""` (yields) calls `plant <hook>` first and dispatches with `run_rp` instead of `run_rh`. Every arm that expects a run keeps `run_rh` (no payload, no marker) and still passes. Run the test file with `TMPDIR="$TMPD/tmp"` exported at the top so markers stay inside the fixture.

- [ ] **A4.** Add C-cwd once #1911 has merged into this branch: the same C1 inputs but with `"cwd":"/elsewhere"` in `$PAYLOAD` and the marker planted ⇒ runs.

### Task D12: liveness marker, project side and plugin side

**Files:** create `.claude/hooks/lib/hook-live.sh`, `plugin/hooks/lib/live-claim.sh`, `tests/plugin/hook-live.test.sh`; modify the seven hooks, the installer sites, `tests/plugin/run-hook.test.sh`, `.github/workflows/audit-self.yml`.

**Interfaces:**
- Produces `getff_hook_live <hook-name>` (bash; always returns 0; afterwards stdin is the same payload, re-readable from the start).
- Produces `getff_live_key <hook-name> <payload-file>` (POSIX; prints 64 hex; non-zero without a tool), `getff_live_claim <hook-name>` (POSIX; 0 only after a successful claim; sets `_live_in` to the buffered payload file on first call so `run-hook.cmd` can re-feed stdin).
- Key contract (both sides): sha256 of `<hook-name>\n` followed by the payload bytes exactly as received.

- [ ] **Step 1: Write the failing tests** — `tests/plugin/hook-live.test.sh`:

```bash
#!/usr/bin/env bash
# hook-live.test.sh — spec 2026-09-28 D12: the project copy's liveness marker and its key parity
# with the plugin side (plugin/hooks/lib/live-claim.sh).
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPD=$(mktemp -d); trap 'rm -rf "$TMPD"' EXIT
export TMPDIR="$TMPD/tmp"; mkdir -p "$TMPDIR"
LIVE="$TMPDIR/getff-hook-live"
P='{"session_id":"s-1","hook_event_name":"Stop"}'
HOOK="$TMPD/h.sh"
cat > "$HOOK" <<EOF
#!/usr/bin/env bash
. "$REPO_ROOT/.claude/hooks/lib/hook-live.sh"; getff_hook_live h
cat
EOF
run() { printf '%s' "$1" | env -u AIF_HOOK_CHANNEL -u ZCODE_PROJECT_DIR "${@:2}" bash "$HOOK"; }

OUT=$(run "$P"); n=$(ls "$LIVE/s-1" 2>/dev/null | wc -l | tr -d ' ')
[ "$OUT" = "$P" ] && ok "L1 the hook still reads the whole payload" || bad "L1 payload lost — got '$OUT'"
[ "$n" = 1 ] && ok "L1 one marker per run" || bad "L1 expected 1 marker, got $n"
k=$( . "$REPO_ROOT/plugin/hooks/lib/live-claim.sh"; printf '%s' "$P" > "$TMPD/p"; getff_live_key h "$TMPD/p")
ls "$LIVE/s-1/$k".* >/dev/null 2>&1 && ok "K1 plugin key == project key" || bad "K1 key mismatch ($k)"
rm -rf "$LIVE"
OUT=$(printf '%s' "$P" | AIF_HOOK_CHANNEL=plugin bash "$HOOK")
[ "$OUT" = "$P" ] && [ ! -d "$LIVE" ] && ok "L2 plugin channel writes no marker" || bad "L2 plugin channel marked"
OUT=$(printf '%s' "$P" | ZCODE_PROJECT_DIR=/x bash "$HOOK")
[ ! -d "$LIVE" ] && ok "L3 ZCode writes no marker" || bad "L3 ZCode marked"
OUT=$(run '{"hook_event_name":"Stop"}')
[ "$OUT" = '{"hook_event_name":"Stop"}' ] && [ -z "$(ls -A "$LIVE" 2>/dev/null)" ] \
  && ok "L4 no session_id → no marker, payload intact" || bad "L4"
OUT=$(run '{"session_id":"../x","hook_event_name":"Stop"}')
[ ! -e "$TMPDIR/x" ] && [ ! -e "$LIVE/../x" ] && ok "L5 unsafe session_id → no marker" || bad "L5 path escape"
mkdir -p "$LIVE/s-1"; : > "$LIVE/s-1/old.1.1"; touch -t 202001010000 "$LIVE/s-1/old.1.1"
run "$P" >/dev/null
[ ! -e "$LIVE/s-1/old.1.1" ] && ok "L6 markers older than 60 s are pruned" || bad "L6 stale marker kept"
B="$TMPD/nojq"; mkdir -p "$B"; for t in bash cat env mktemp rm ls; do ln -sf "$(command -v $t)" "$B/$t"; done
rm -rf "$LIVE"; OUT=$(printf '%s' "$P" | PATH="$B" bash "$HOOK")
[ "$OUT" = "$P" ] && [ ! -d "$LIVE" ] && ok "L7 no jq → no marker, payload intact" || bad "L7"
echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" = 0 ]
```

- [ ] **Step 2: Run** `bash tests/plugin/hook-live.test.sh` — expected FAIL (libs missing).

- [ ] **Step 3: Create `.claude/hooks/lib/hook-live.sh`:**

```bash
# hook-live.sh — liveness marker for the project copy of a shared hook
# (spec docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md D12).
# The plugin copy of the same hook (plugin/hooks/run-hook.cmd, consumer mode) yields only after
# claiming the marker this writes, so a host that never loads project settings loses no hook.
# Never fails the hook: any error leaves no marker, and no marker means both copies run.

_getff_live_sha() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else return 1; fi
}

# _getff_live_mark <hook-name> <payload-file> — write the marker; any failure writes nothing.
_getff_live_mark() {
  local sid key dir
  command -v jq >/dev/null 2>&1 || return 1
  sid="$(jq -r '.session_id // empty' "$2" 2>/dev/null)" || return 1
  case "$sid" in ''|*[!A-Za-z0-9_-]*) return 1 ;; esac
  key="$({ printf '%s\n' "$1"; cat "$2"; } | _getff_live_sha)" || return 1
  [ ${#key} -eq 64 ] || return 1
  dir="${TMPDIR:-/tmp}/getff-hook-live/$sid"
  mkdir -p "$dir" 2>/dev/null || return 1
  : > "$dir/$key.$(date +%s).$$" 2>/dev/null || return 1
  find "$dir" -type f -mmin +1 -exec rm -f {} + 2>/dev/null
  return 0
}

# getff_hook_live <hook-name> — call once, before the hook reads stdin. Always returns 0; stdin is
# afterwards the same payload, readable from the start.
getff_hook_live() {
  local in
  [ "${AIF_HOOK_CHANNEL:-}" = plugin ] && return 0
  [ -n "${ZCODE_PROJECT_DIR:-}" ] && return 0
  in="$(mktemp "${TMPDIR:-/tmp}/getff-live-in.XXXXXX" 2>/dev/null)" || return 0
  cat > "$in" 2>/dev/null
  _getff_live_mark "$1" "$in" || true
  exec 0<"$in"
  rm -f "$in"
  return 0
}
```

- [ ] **Step 4: Create `plugin/hooks/lib/live-claim.sh`** (POSIX, `dash -n` clean):

```sh
# live-claim.sh — plugin side of the liveness protocol (spec 2026-09-28 D12). Sourced by
# run-hook.cmd in consumer mode only. The project copy's lib/hook-live.sh writes the marker.

_getff_live_sha() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else return 1; fi
}

# getff_live_key <hook-name> <payload-file> — the key both sides compute.
getff_live_key() {
  { printf '%s\n' "$1"; cat "$2"; } | _getff_live_sha
}

# getff_live_claim <hook-name> — 0 only after this process renamed a fresh marker for this event.
getff_live_claim() {
  if [ -z "${_live_in:-}" ]; then
    _live_in="$(mktemp "${TMPDIR:-/tmp}/getff-live-in.XXXXXX" 2>/dev/null)" || { _live_in=''; return 1; }
    cat > "$_live_in" 2>/dev/null
  fi
  command -v jq >/dev/null 2>&1 || return 1
  _lc_sid="$(jq -r '.session_id // empty' "$_live_in" 2>/dev/null)" || return 1
  case "$_lc_sid" in ''|*[!A-Za-z0-9_-]*) return 1 ;; esac
  _lc_key="$(getff_live_key "$1" "$_live_in")" || return 1
  [ ${#_lc_key} -eq 64 ] || return 1
  _lc_dir="${TMPDIR:-/tmp}/getff-hook-live/$_lc_sid"
  _lc_try=0
  while [ "$_lc_try" -le 6 ]; do
    _lc_now=$(date +%s)
    for _lc_f in "$_lc_dir/$_lc_key".*; do
      [ -f "$_lc_f" ] || continue
      _lc_ts="${_lc_f#"$_lc_dir/$_lc_key".}"; _lc_ts="${_lc_ts%%.*}"
      case "$_lc_ts" in ''|*[!0-9]*) continue ;; esac
      [ $((_lc_now - _lc_ts)) -le 5 ] && [ "$_lc_ts" -le "$_lc_now" ] || continue
      mv "$_lc_f" "$_lc_dir/claimed.$_lc_key.$_lc_ts.$$" 2>/dev/null && return 0
    done
    _lc_try=$((_lc_try + 1))
    [ "$_lc_try" -le 6 ] || break
    sleep 0.05 2>/dev/null || break
  done
  return 1
}
```

Caveat: `mv` of a file onto a new name in the same directory is `rename(2)`; when two plugin processes race for one marker, exactly one rename succeeds and the other fails with ENOENT. D-race below checks it.

- [ ] **Step 5: Add the prelude** to each of the seven hooks, directly after the `set` line (or after the header comments when the hook has no `set` line), and append `lib/hook-live.sh` to its `# @plugin-yield-deps:` line (create the line if base Task 1 did not):

```bash
# Liveness marker for the plugin copy's consumer yield (spec 2026-09-28 D12); no-op when absent.
_getff_live_lib="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/hook-live.sh"
if [ -f "$_getff_live_lib" ] && . "$_getff_live_lib" 2>/dev/null; then getff_hook_live <this-hook-name> || true; fi
```

Then `bash scripts/generate-plugin-twins.sh` and `bash scripts/plugin-source-hashes.sh --write` (base Task 1 writer; use its real flag).

- [ ] **Step 6: Installer delivery.** Enumerate every site that delivers one of the seven hooks: `grep -nE 'end-of-turn-reminder|ask-question-reminder|inject-matching-rule|inject-output-language|check-doc-authority-header|inject-project-digest|inject-memory-codification' setup.d/*.sh install.sh plugin/install/*.sh`. Beside each, deliver the lib exactly as `lib/residue-dir.sh` is delivered (`setup.d/10-skills.sh:254-260` copy_safe form; `install.sh:985-991` refresh_safe form), once per file. Extend the installer test that covers `residue-dir.sh` delivery (`grep -rln residue-dir tests/`) with the same assertion for `hook-live.sh`.

- [ ] **Step 7: D arms in `tests/plugin/run-hook.test.sh`** (after the C arms; reuse `plant`, `run_rp`, the C fixture with C1 inputs):

```sh
for SH in $SHELLS; do
  getff_proj __target__; pin_manifest; reset_proj; reg UserPromptSubmit - __target__
  rm -rf "$TMPDIR/getff-hook-live"
  expect "[$SH] D1 conditions hold, no marker → runs" RH_OK "$(run_rp "$SH" __target__)"
  plant __target__ 30
  expect "[$SH] D2 stale marker (30 s) → runs" RH_OK "$(run_rp "$SH" __target__)"
  plant __other__
  expect "[$SH] D3 marker of another hook → runs" RH_OK "$(run_rp "$SH" __target__)"
  plant __target__
  expect "[$SH] D4 fresh marker → yields" "" "$(run_rp "$SH" __target__)"
  expect "[$SH] D5 the marker is claimed once; a second dispatch → runs" RH_OK "$(run_rp "$SH" __target__)"
  plant __target__; OUT=$(printf '%s' '{"session_id":"s-other","hook_event_name":"UserPromptSubmit","prompt":"hi"}' | run_rh "$SH" __target__)
  expect "[$SH] D6 marker from another session → runs" RH_OK "$OUT"
done
plant __target__
run_rp bash __target__ > "$TMPD/ra" & run_rp bash __target__ > "$TMPD/rb" & wait
[ "$(cat "$TMPD/ra" "$TMPD/rb" | grep -c RH_OK)" = 1 ] && ok "D-race two plugin copies, one marker → exactly one yields" \
  || bad "D-race got A='$(cat "$TMPD/ra")' B='$(cat "$TMPD/rb")'"
t0=$(date +%s); run_rp bash __target__ >/dev/null; t1=$(date +%s)
[ $((t1 - t0)) -le 1 ] && ok "D-wait no marker costs ≤1 s" || bad "D-wait took $((t1 - t0)) s"
```

The fixture's twins print `RH_OK` (the base fixture's token; confirm with `grep -n RH_OK tests/plugin/run-hook.test.sh`).

- [ ] **Step 8: Run** `bash tests/plugin/hook-live.test.sh && bash tests/plugin/run-hook.test.sh` — expected `FAIL=0` in both. Run `dash -n plugin/hooks/run-hook.cmd && dash -n plugin/hooks/lib/live-claim.sh` (or `sh -n` where dash is absent). Add `bash tests/plugin/hook-live.test.sh` to `.github/workflows/audit-self.yml` next to the `run-hook.test.sh` step.

- [ ] **Step 9: Commit**

```bash
git add .claude/hooks/lib/hook-live.sh plugin/hooks/lib/live-claim.sh .claude/hooks/*.sh plugin/hooks \
  setup.d install.sh tests/plugin .github/workflows/audit-self.yml
git commit -m "feat(plugin): a consumer yield needs a liveness marker from the project copy for this event"
```

### Task 3′: one emitter for the output-language line (replaces base Task 3)

**Files:** `plugin/hooks/run-hook.cmd`, `.claude/hooks/inject-session-bootstrap.sh`, `plugin/hooks/inject-session-bootstrap` (regenerated), `tests/plugin/run-hook.test.sh`.

- [ ] **Step 1: Failing tests** (append to `run-hook.test.sh`):

```sh
# L-D5 (spec D5 r3): the bootstrap twin leaves [output-language] to inject-output-language on the
# plugin channel; the project copy keeps it.
for SH in $SHELLS; do
  OUT=$(printf '%s' '{"session_id":"s","hook_event_name":"UserPromptSubmit","prompt":"x"}' \
    | env -u ZCODE_PROJECT_DIR AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$TMPD/none" XDG_CONFIG_HOME="$EMPTY_XDG" \
      "$SH" "$REPO_ROOT/plugin/hooks/run-hook.cmd" inject-session-bootstrap 2>/dev/null)
  case "$OUT" in *'[output-language]'*) bad "[$SH] L-D5 plugin bootstrap twin still emits the language line" ;;
    *) ok "[$SH] L-D5 plugin bootstrap twin: no language line" ;; esac
done
OUT=$(printf '%s' '{"session_id":"s","hook_event_name":"UserPromptSubmit","prompt":"x"}' \
  | env -u AIF_HOOK_CHANNEL AIF_HOOK_LANG=ru bash "$REPO_ROOT/.claude/hooks/inject-session-bootstrap.sh" 2>/dev/null)
case "$OUT" in *'[output-language]'*) ok "L-D5 project copy keeps the language line" ;;
  *) bad "L-D5 project copy lost the language line" ;; esac
```

- [ ] **Step 2: Run** — expected: the plugin arm FAILS, the project arm PASSES.

- [ ] **Step 3: Apply the fd2b1ec38f3 hunks.** In `run-hook.cmd`, after `set "HOOK_DIR=%~dp0"` in the batch block add `REM Plugin-channel marker for the dispatched hook (see the Unix block below).` and `set "AIF_HOOK_CHANNEL=plugin"`; in the Unix part, directly above `# ── Yield to the plugin's own source checkout`, add:

```sh
# ── Plugin-channel marker ─────────────────────────────────────────────────────
# Tells the dispatched hook it runs as the plugin twin, not as the project's own copy.
# inject-session-bootstrap reads it: this channel also ships inject-output-language, so the
# twin leaves the [output-language] line to that hook instead of injecting it a second time.
# lib/hook-live.sh reads it too: the twin must not mark itself live (spec D12).
AIF_HOOK_CHANNEL=plugin
export AIF_HOOK_CHANNEL
```

In `.claude/hooks/inject-session-bootstrap.sh` replace the `case "${AIF_HOOK_LANG:-en}" in` block with the fd2b1ec38f3 form: `case "${AIF_HOOK_CHANNEL:-}:${AIF_HOOK_LANG:-en}" in` with arms `plugin:*) : ;;`, `*:en|*:) : ;;`, `*:ru)`, `*:*)` and the five-line comment above it (see `git show fd2b1ec38f3 -- .claude/hooks/inject-session-bootstrap.sh`; the commit is in the bundle `~/.claude-coordination/rules-as-tests-aif/orchestrator-2026-09-28/preserved/1911-optin-branch-0aa83e314b3.bundle`). The D7 note: setting an env var in the batch block does not change what it runs, so D7 holds.

- [ ] **Step 4:** `bash scripts/generate-plugin-twins.sh`; confirm `plugin/hooks/inject-session-bootstrap` stays an identity twin; rerun the manifest writer.

- [ ] **Step 5: Run** the test file — `FAIL=0`. Commit: `fix(plugin): the bootstrap twin leaves the language line to inject-output-language on the plugin channel`.

### Task 6 amendment

- [ ] **V1.** Version: right before opening the PR, `git fetch origin && git merge origin/staging`, then set `plugin/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` to (`git show origin/staging:plugin/.claude-plugin/plugin.json | jq -r .version`) + 1 patch.
- [ ] **V2.** Live check, recorded in the PR body: in a scratch consumer (installer run + plugin from this branch), one `claude -p` prompt with `AIF_HOOK_LANG=ru`. Count `[output-language]` lines and bootstrap digests in the transcript (want 1 and 1). List `${TMPDIR}/getff-hook-live/<session>/`: want only `claimed.*` files for the seven hooks. Also record whether every payload carried `session_id`; a missing one is a finding (both copies run there — safe, but say so).
- [ ] **V3.** Same run with `--setting-sources user`: want every plugin hook to run once (no markers, no loss).
- [ ] **V4.** Prior-art trailers: `prior-art-evaluations.md#150` plus the preserved #290 row, appended as a new SSOT row (re-derive its number) in the commit that adds `live-claim.sh`.

### D12 hardening (adopted 2026-09-29 from the stopped runtime-claim design)

A parallel design (branch `claude/infallible-wright-e796ee`, `.claude/hooks/lib/hook-claim.sh`, SSOT #291 draft) was compared against this one. The operator asked for the better one to be kept. This design stays because:
- it covers the hand-maintained twins: 7 hooks against 4;
- only the plugin waits (≤300 ms), whereas in hook-claim the vendored copy waits for the plugin's exit status, up to 15 s on every firing.

Its author named three lost-gate paths in D12. Each one becomes a requirement of Task D12, with a firing arm:

- **H1 — custom timeout.** A marker proves the project copy started, not that it delivered. If a consumer sets `"timeout"` on the project entry, Claude Code can kill that copy after the plugin yielded.
  - `getff_live_claim` returns non-zero (so the plugin runs) when any settings file that names `.claude/hooks/<name>.sh` also contains `"timeout"`.
  - Files to scan: `$CLAUDE_PROJECT_DIR/.claude/settings.json`, `.claude/settings.local.json`, `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`, `/Library/Application Support/ClaudeCode/managed-settings.json` and `/etc/claude-code/managed-settings.json`.
  - A file that exists but cannot be read counts as "timeout set".
  - Reference: `_hc_custom_timeout`, `hook-claim.sh:104` on that branch.
  - Arm D-timeout: a planted marker plus a settings entry with `"timeout": 5` for that hook means the plugin copy runs.
- **H2 — the prelude fails open.** Every step of `getff_hook_live` must be unable to abort a hook under `set -euo pipefail`. Those steps are:
  - the stdin buffer;
  - `exec 0<`;
  - the marker `mkdir` and write;
  - the prune.
  On any failure it returns 0 with stdin intact and writes no marker.
  - Arm L-ro: run a real source hook under `set -euo pipefail` with an unwritable `TMPDIR`. Assert its normal output is unchanged and that no marker exists.
- **H3 — trust in the marker directory.** The base becomes `${TMPDIR:-/tmp}/getff-hook-live.${UID:-0}`. Each level is created with `mkdir -m 700`.
  - `getff_live_claim` trusts markers only when the base and `<sid>` directories are not symlinks and pass `[ -O dir ]`. Otherwise it runs.
  - Arm D-foreign: a symlinked base directory means the plugin copy runs.
  - This supersedes the base path given in Task D12 above.
- **H4 — bounds on the wall clock.** Freshness (≤5 s) is measured as `date +%s` against the epoch in the marker name, never by counting sleep ticks.
  - The ≤300 ms wait also stops once `date +%s` has moved more than 1 s past its start.
