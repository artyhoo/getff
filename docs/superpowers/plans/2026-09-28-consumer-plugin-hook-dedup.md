# Consumer Plugin Hook Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a consumer that ran the installer and installed the getff plugin, a plugin hook stays silent only when the installed copy is byte-identical to the source the plugin was built from; the output-language line has one emitter in the plugin payload.

**Architecture:** A POSIX hashing lib ships in the plugin (`plugin/hooks/lib/source-hash.sh`). A writer script turns `.claude/hooks/*.sh` plus declared dependencies into `plugin/hooks/lib/source-sha256.txt`; the twin generator runs it at pre-commit. `run-hook.cmd` gains a consumer mode next to #1879's source-checkout mode and yields only on a full hash match plus #1879's registration check. The plugin twin of `inject-session-bootstrap` drops its language block through the existing `sed` transform. Principle 24 arm (j) keeps the manifest honest.

**Tech Stack:** POSIX sh (dash-safe) for `run-hook.cmd` and the lib; bash 3.2 for scripts and shell tests; jq; vitest (TypeScript) for principle 24. **Spec:** [docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md](../specs/2026-09-28-consumer-plugin-hook-dedup-design.md) (D1-D11).

> **Re-cut required before execution (2026-09-29):** spec revision 3 adds D12 (liveness marker). This plan predates it. Once merge train A lands (#1879, #1911), re-read `plugin/hooks/run-hook.cmd` on staging and re-cut Tasks 2, 3 and 6: add the D12 lib, prelude and tests, drop Task 3 if #1911's `AIF_HOOK_CHANNEL` fix is in, bump to 0.3.9.

## Global Constraints

- **Precondition:** artyhoo/getff#1879 is merged to staging. Branch from fresh `origin/staging`. Every `run-hook.cmd` / `run-hook.test.sh` reference below is to the #1879 versions.
- Every doubt resolves to «run»: a missing file, tool, entry or unreadable input must leave the plugin copy running.
- `run-hook.cmd` and `plugin/hooks/lib/source-hash.sh` must run under `bash`, `sh` and `dash` (the test file runs its arms under all three).
- ZCode never yields to a project copy (D6). The Windows batch branch of `run-hook.cmd` is not touched (D7).
- The cwd-relative `bash .claude/hooks/deps-hash-check.sh` registration never counts (D4); do not change the installer.
- Repo artifacts in English. Never edit `.claude/settings.json`. Conflicts: merge staging INTO the branch, never rebase.
- Markdown files stay under 600 lines (pre-commit gate).
- Every commit that adds a file ≥80 LOC under `packages/` carries a `Prior-art:` trailer; this plan's code lives outside `packages/` except the principle-24 edit, but the PR still carries `Prior-art: prior-art-evaluations.md#150 (superpowers run-hook.cmd ADOPT; upstream has no dedup, own-build extension per spec §Prior art).`
- Any change under `plugin/**` ships under a NEW plugin version (principle 24 arm (i)); Task 6 bumps once for the whole branch.

## File Map

| File | Change | Responsibility |
|---|---|---|
| `plugin/hooks/lib/source-hash.sh` | create | hash one path or directory; compare a hook's closure to the manifest |
| `scripts/plugin-source-hashes.sh` | create | print the manifest for a repo root |
| `scripts/generate-plugin-twins.sh` | modify | write `plugin/hooks/lib/source-sha256.txt` after the hook twins |
| `plugin/hooks/lib/source-sha256.txt` | generated | shipped manifest |
| `.claude/hooks/end-of-turn-reminder.sh`, `.claude/hooks/ask-question-reminder.sh` | modify | `# @plugin-yield-deps:` declaration |
| `.claude/hooks/inject-session-bootstrap.sh` | modify | `sed` transform marker + drop brackets around the language block |
| `plugin/hooks/run-hook.cmd` | modify | consumer yield mode |
| `tests/plugin/run-hook.test.sh` | modify | H, C, CR arms |
| `packages/core/principles/24-plugin-manifest-integrity.test.ts` | modify | arm (j) |
| `plugin/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `plugin/install/fetch-and-wire.sh` | modify | version bump |

---

### Task 1: Hashing lib, manifest writer, generator wiring

**Files:**
- Create: `plugin/hooks/lib/source-hash.sh`, `scripts/plugin-source-hashes.sh`
- Modify: `scripts/generate-plugin-twins.sh` (after the population (1) summary `log_info "generated …"`), `.claude/hooks/end-of-turn-reminder.sh`, `.claude/hooks/ask-question-reminder.sh`
- Test: `tests/plugin/run-hook.test.sh` (new H section, placed right before the `# ── Yield to the project's own registration` banner)

**Interfaces:**
- Produces `getff_sha256` (stdin → hex; non-zero without a tool), `getff_path_hash <hooks-dir> <rel>` (`rel` = `x.sh`, `lib/x.sh`, or a directory ending `/`; non-zero on missing path, `..`, leading `/`, or no tool), `getff_closure_matches <manifest> <hooks-dir> <name>` (0 only if a `<name>.sh` line exists and every `<name>.sh[:<rel>]` line matches).
- Manifest line format: `<sha256>  <name>.sh` and `<sha256>  <name>.sh:<rel>`, two spaces, `LC_ALL=C` order.

- [ ] **Step 1: Write the failing H arms** in `tests/plugin/run-hook.test.sh`:

```sh
# ── H: plugin/hooks/lib/source-hash.sh (spec 2026-09-28 D1-D2) ──────────────────
HD="$TMPROOT/hash"; mkdir -p "$HD/lang"
printf 'a\n' > "$HD/h.sh"; printf 'en\n' > "$HD/lang/en.sh"; printf 'ru\n' > "$HD/lang/ru.sh"
for SH in bash sh $(command -v dash >/dev/null 2>&1 && echo dash); do
  hash_of() { "$SH" -c '. "$1"; getff_path_hash "$2" "$3"' _ "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$HD" "$1"; }
  f1=$(hash_of h.sh); d1=$(hash_of lang/)
  [ "${#f1}" -eq 64 ] && ok "[$SH] H1 file hash is 64 hex chars" || bad "[$SH] H1 got '$f1'"
  printf 'de\n' > "$HD/lang/de.sh"; d2=$(hash_of lang/); rm "$HD/lang/de.sh"
  [ -n "$d1" ] && [ "$d1" != "$d2" ] && ok "[$SH] H2 an added file changes the directory hash" || bad "[$SH] H2 '$d1' '$d2'"
  [ "$(hash_of lang/)" = "$d1" ] && ok "[$SH] H3 directory hash is stable" || bad "[$SH] H3 unstable"
  hash_of ../x >/dev/null 2>&1 && bad "[$SH] H4 '..' accepted" || ok "[$SH] H4 '..' refused"
  hash_of missing.sh >/dev/null 2>&1 && bad "[$SH] H5 missing file hashed" || ok "[$SH] H5 missing file refused"
  printf '%s  h.sh\n%s  h.sh:lang/\n' "$f1" "$d1" > "$HD/m.txt"
  match() { "$SH" -c '. "$1"; getff_closure_matches "$2" "$3" "$4"' _ "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$HD/m.txt" "$HD" "$1"; }
  match h && ok "[$SH] H6 identical closure matches" || bad "[$SH] H6 no match"
  printf 'b\n' > "$HD/h.sh"; match h && bad "[$SH] H7 changed file matched" || ok "[$SH] H7 changed file refused"
  printf 'a\n' > "$HD/h.sh"; match other && bad "[$SH] H8 absent name matched" || ok "[$SH] H8 absent name refused"
  printf '%s  h.sh:lang/\n' "$d1" > "$HD/m.txt"; match h && bad "[$SH] H9 no main line matched" || ok "[$SH] H9 main line required"
done
```

- [ ] **Step 2: Run** `bash tests/plugin/run-hook.test.sh 2>&1 | grep -E 'H[0-9]|PASS='` — expected: H arms FAIL (lib file missing).

- [ ] **Step 3: Create `plugin/hooks/lib/source-hash.sh`:**

```sh
# source-hash.sh — sha256 of a getff hook and of the files it reads beside itself. POSIX sh.
# Sourced by plugin/hooks/run-hook.cmd (the consumer yield) and scripts/plugin-source-hashes.sh (the
# manifest writer): one implementation, so a hash written at build time and a hash computed at run
# time cannot disagree. Spec: docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md.

# stdin → lowercase hex sha256. Non-zero when neither sha256sum nor shasum exists.
getff_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | cut -d' ' -f1
  else
    return 1
  fi
}

# getff_path_hash <hooks-dir> <rel> — hash of one file, or of a directory (<rel> ends in /) as the
# LC_ALL=C-sorted "<sha256>  <name>" listing of the regular files directly in it, so an added file
# changes the hash too. Non-zero when the path is missing, leaves <hooks-dir>, or no tool exists.
getff_path_hash() {
  case "$2" in ''|/*|*..*) return 1 ;; esac
  printf '' | getff_sha256 >/dev/null || return 1
  case "$2" in
    */)
      [ -d "$1/$2" ] || return 1
      for _gsh_f in "$1/$2"*; do
        [ -f "$_gsh_f" ] || continue
        printf '%s  %s\n' "$(getff_sha256 < "$_gsh_f")" "${_gsh_f##*/}"
      done | LC_ALL=C sort | getff_sha256
      ;;
    *)
      [ -f "$1/$2" ] || return 1
      getff_sha256 < "$1/$2"
      ;;
  esac
}

# getff_closure_matches <manifest> <hooks-dir> <name> — 0 only when <manifest> holds a "<name>.sh"
# line and every "<name>.sh" / "<name>.sh:<rel>" line equals the hash of that path under
# <hooks-dir>. Anything missing or unreadable is a mismatch: the caller then runs its copy.
getff_closure_matches() {
  [ -f "$1" ] || return 1
  _gsh_main=''
  while IFS= read -r _gsh_line || [ -n "$_gsh_line" ]; do
    _gsh_want=${_gsh_line%%  *}
    _gsh_key=${_gsh_line#*  }
    case "$_gsh_key" in
      "$3.sh") _gsh_rel="$3.sh"; _gsh_main=1 ;;
      "$3.sh:"*) _gsh_rel=${_gsh_key#"$3.sh:"} ;;
      *) continue ;;
    esac
    _gsh_got=$(getff_path_hash "$2" "$_gsh_rel") || return 1
    [ "$_gsh_got" = "$_gsh_want" ] || return 1
  done < "$1"
  [ -n "$_gsh_main" ]
}
```

- [ ] **Step 4: Run** the H arms again — expected: all PASS under every shell.

- [ ] **Step 5: Create `scripts/plugin-source-hashes.sh`** (`chmod +x`):

```bash
#!/usr/bin/env bash
# plugin-source-hashes.sh — print the plugin's source-hash manifest for a repo root.
# Usage: bash scripts/plugin-source-hashes.sh <repo-root>   (stdout = plugin/hooks/lib/source-sha256.txt)
#
# One entry per plugin/hooks/<name> twin whose source .claude/hooks/<name>.sh exists: the source's
# hash, then one line per path declared on `# @plugin-yield-deps: <rel> ...`. A source that reaches
# files beside itself (a `.`/`source` statement, BASH_SOURCE, _HOOK_DIR) WITHOUT a declaration gets
# NO entry — the consumer copy then never silences the plugin copy (spec D2: safe by construction).
set -euo pipefail
export LC_ALL=C
ROOT="${1:?usage: plugin-source-hashes.sh <repo-root>}"
# shellcheck source=../plugin/hooks/lib/source-hash.sh
. "$(cd "$(dirname "$0")" && pwd)/../plugin/hooks/lib/source-hash.sh"
printf '' | getff_sha256 >/dev/null || { echo "plugin-source-hashes: no sha256sum or shasum" >&2; exit 2; }

reaches_beside() {
  grep -vE '^[[:space:]]*#' "$1" | grep -qE '(^|[;&|[:space:]])(\.|source)[[:space:]]|BASH_SOURCE|_HOOK_DIR'
}

for twin in "$ROOT"/plugin/hooks/*; do
  [ -f "$twin" ] || continue
  n=$(basename "$twin")
  src="$ROOT/.claude/hooks/$n.sh"
  [ -f "$src" ] || continue
  deps=$(sed -n 's/^# @plugin-yield-deps:[[:space:]]*//p' "$src" | head -n 1)
  if [ -z "$deps" ] && reaches_beside "$src"; then continue; fi
  printf '%s  %s\n' "$(getff_path_hash "$ROOT/.claude/hooks" "$n.sh")" "$n.sh"
  for d in $deps; do
    h=$(getff_path_hash "$ROOT/.claude/hooks" "$d") \
      || { echo "plugin-source-hashes: $n declares $d, which is not under .claude/hooks/" >&2; exit 2; }
    printf '%s  %s\n' "$h" "$n.sh:$d"
  done
done
```

- [ ] **Step 6: Declare dependencies.** In `.claude/hooks/end-of-turn-reminder.sh`, directly under the existing `# @cc-only-rationale` / `# @dual-pair` marker block near the top, add:

```sh
# @plugin-yield-deps: lang/ lib/residue-dir.sh
```

In `.claude/hooks/ask-question-reminder.sh`, same position:

```sh
# @plugin-yield-deps: lang/
```

- [ ] **Step 7: Wire the generator.** In `scripts/generate-plugin-twins.sh`, directly after the line `log_info "generated $((identical + sed_transformed)) twins, …"`, insert:

```bash
# ── Source-hash manifest (consumer yield — spec 2026-09-28 D1) ─────────────────
# plugin/hooks/run-hook.cmd lets a consumer's installed copy silence the plugin copy only when the
# installed bytes hash to these lines. Rewritten only on change, so a clean tree stays a no-op.
MANIFEST="$TWIN_DIR/lib/source-sha256.txt"
tmp_manifest=$(mktemp)
bash "$REPO_ROOT/scripts/plugin-source-hashes.sh" "$REPO_ROOT" > "$tmp_manifest"
if cmp -s "$tmp_manifest" "$MANIFEST" 2>/dev/null; then
  rm -f "$tmp_manifest"
else
  mkdir -p "$TWIN_DIR/lib"; mv "$tmp_manifest" "$MANIFEST"
  log_info "source-hash manifest rewritten: plugin/hooks/lib/source-sha256.txt"
fi
```

- [ ] **Step 8: Generate and inspect.** Run `bash scripts/generate-plugin-twins.sh && cat plugin/hooks/lib/source-sha256.txt`. Expected: lines for at least `ask-question-reminder.sh`, `check-doc-authority-header.sh`, `deps-hash-check.sh`, `end-of-turn-reminder.sh` (+ `:lang/`, `:lib/residue-dir.sh`), `inject-matching-rule.sh`, `inject-memory-codification.sh`, `inject-output-language.sh`, `inject-project-digest.sh`. If one of these is missing, `reaches_beside` matched a line in it: read that line and either declare the real dependency or, if it is a false positive (e.g. `. ` inside a string), declare `# @plugin-yield-deps:` with the files it truly reads. Do not loosen the regex.

- [ ] **Step 9: Run** `bash tests/plugin/run-hook.test.sh && bash tests/plugin/twin-generation.test.sh && bash tests/plugin/hook-paths.test.sh` — expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add plugin/hooks/lib/source-hash.sh plugin/hooks/lib/source-sha256.txt scripts/plugin-source-hashes.sh \
  scripts/generate-plugin-twins.sh .claude/hooks/end-of-turn-reminder.sh .claude/hooks/ask-question-reminder.sh \
  plugin/hooks/end-of-turn-reminder plugin/hooks/ask-question-reminder tests/plugin/run-hook.test.sh
git commit -m "feat(plugin): ship a source-hash manifest of the hooks the plugin twins

Prior-art: prior-art-evaluations.md#150 (superpowers run-hook.cmd ADOPT; no dedup upstream)."
```

### Task 2: Consumer yield mode in `run-hook.cmd`

**Files:**
- Modify: `plugin/hooks/run-hook.cmd` (the #1879 block from `# ── Yield to the plugin's own source checkout` to the `fi` before `exec bash`)
- Test: `tests/plugin/run-hook.test.sh` (fixture additions, C arms, CR1)

**Interfaces:**
- Consumes: `getff_closure_matches` (Task 1); `plugin/hooks/lib/source-sha256.txt` beside the dispatcher.
- Produces: `_yield_mode` ∈ {`source`, `consumer`, ``} inside `run-hook.cmd`.

- [ ] **Step 1: Extend the fixture.** In the `hooks.json` heredoc add `{"type":"command","command":"$PLUGIN_CMD __deps__"},` after the `__target__` line; add `__deps__` to the `for n in __ghost__ __wide__ …` twin loop. Above Y19's first `expect`, change its comment to: `# Y19. … and no source-hash manifest beside the dispatcher → a consumer keeps both copies (see C1-C8).`

- [ ] **Step 2: Write the C arms** after the Y9 block:

```sh
# ── C: consumer yield — only to a byte-identical installed copy (spec 2026-09-28 D3) ──
# A consumer ships no plugin. Every C arm after C1 differs from C1 by one input and must run.
mkdir -p "$TMPD/lib" "$PROJ/.claude/hooks/lang"
cp "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$TMPD/lib/source-hash.sh"
printf 'L=en\n' > "$PROJ/.claude/hooks/lang/en.sh"; printf 'L=ru\n' > "$PROJ/.claude/hooks/lang/ru.sh"
pin_manifest() {   # the plugin was built from exactly the project's current copies
  ( . "$TMPD/lib/source-hash.sh"; H="$PROJ/.claude/hooks"
    printf '%s  %s\n' "$(getff_path_hash "$H" __target__.sh)" __target__.sh
    printf '%s  %s\n' "$(getff_path_hash "$H" __deps__.sh)" __deps__.sh
    printf '%s  %s\n' "$(getff_path_hash "$H" lang/)" __deps__.sh:lang/
  ) > "$TMPD/lib/source-sha256.txt"
}
rm -rf "$PROJ/plugin"
for SH in $SHELLS; do
  getff_proj __target__; getff_proj __deps__; pin_manifest
  reset_proj; reg UserPromptSubmit - __target__; reg UserPromptSubmit - __deps__
  expect "[$SH] C1 installed copy byte-identical → yields" "" "$(run_rh "$SH" __target__)"
  expect "[$SH] C1 identical copy and identical lang/ → yields" "" "$(run_rh "$SH" __deps__)"
  printf 'echo EDITED\n' >> "$PROJ/.claude/hooks/__target__.sh"
  expect "[$SH] C2 installed copy differs (older/newer/edited) → runs" RH_OK "$(run_rh "$SH" __target__)"
  getff_proj __target__
  printf 'L=RU\n' > "$PROJ/.claude/hooks/lang/ru.sh"
  expect "[$SH] C3 dependency content differs → runs" RH_OK "$(run_rh "$SH" __deps__)"
  printf 'L=ru\n' > "$PROJ/.claude/hooks/lang/ru.sh"; printf 'L=de\n' > "$PROJ/.claude/hooks/lang/de.sh"
  expect "[$SH] C3 extra file in a declared directory → runs" RH_OK "$(run_rh "$SH" __deps__)"
  rm -f "$PROJ/.claude/hooks/lang/de.sh"; mv "$PROJ/.claude/hooks/lang" "$TMPD/lang.bak"
  expect "[$SH] C3 declared directory missing → runs" RH_OK "$(run_rh "$SH" __deps__)"
  mv "$TMPD/lang.bak" "$PROJ/.claude/hooks/lang"
  expect "[$SH] C3 restored → yields again" "" "$(run_rh "$SH" __deps__)"
  grep -v '  __target__\.sh$' "$TMPD/lib/source-sha256.txt" > "$TMPD/m.tmp"; mv "$TMPD/m.tmp" "$TMPD/lib/source-sha256.txt"
  expect "[$SH] C4 hook absent from the manifest → runs" RH_OK "$(run_rh "$SH" __target__)"
  pin_manifest; printf '0000  __target__.sh:../../x\n' >> "$TMPD/lib/source-sha256.txt"
  expect "[$SH] C5 manifest path escaping .claude/hooks → runs" RH_OK "$(run_rh "$SH" __target__)"
  pin_manifest
  reset_proj; reg UserPromptSubmit - __target__ 'bash .claude/hooks/__target__.sh'
  expect "[$SH] C6 cwd-relative registration (deps-hash-check form) → runs" RH_OK "$(run_rh "$SH" __target__)"
  reset_proj; reg UserPromptSubmit - __target__
  OUT=$(env -u AIF_HOOK_LANG -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" ZCODE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" "$SH" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  expect "[$SH] C7 ZCode never yields to a project copy → runs" RH_OK "$OUT"
done
# C8. No hashing tool → runs; each tool alone (macOS/Git Bash shapes) → yields.
for have in none sha256sum shasum; do
  B="$TMPD/bin-$have"; mkdir -p "$B"
  for t in bash sh dirname head tr grep sed cat env jq cut sort; do  # add any other tool run-hook.cmd calls p=$(command -v "$t") && ln -sf "$p" "$B/$t"; done
  if [ "$have" != none ]; then p=$(command -v "$have") || continue; ln -sf "$p" "$B/$have"; fi
  reset_proj; reg UserPromptSubmit - __target__
  OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD PATH="$B" CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" "$B/bash" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  if [ "$have" = none ]; then expect "C8 no sha256sum, no shasum → runs" RH_OK "$OUT"
  else expect "C8 only $have on PATH → yields" "" "$OUT"; fi
done
```

- [ ] **Step 3: Run** `bash tests/plugin/run-hook.test.sh 2>&1 | grep -E ' C[0-9]|PASS='` — expected: C1 and C3-restored and C8-with-tool FAIL (no consumer mode yet); every «runs» arm PASS.

- [ ] **Step 4: Replace the #1879 yield code** (keep its comment block, edit as in Step 5). Replace from `if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -z "${ZCODE_PROJECT_DIR:-}" ]` through the matching `fi` before `exec bash` with:

```sh
_yield_mode=''
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -z "${ZCODE_PROJECT_DIR:-}" ] && [ -z "${_lang_from_file:-}" ] \
  && [ -z "${GETFF_PLUGIN_NO_YIELD:-}" ] && [ -f "${SCRIPT_DIR}/hooks.json" ] \
  && [ -f "${SCRIPT_DIR}/../.claude-plugin/plugin.json" ] \
  && [ -f "$CLAUDE_PROJECT_DIR/.claude/settings.json" ] && command -v jq >/dev/null 2>&1; then
  if [ -f "$CLAUDE_PROJECT_DIR/plugin/.claude-plugin/plugin.json" ] \
    && jq -e -n --slurpfile pm "${SCRIPT_DIR}/../.claude-plugin/plugin.json" \
      --slurpfile sm "$CLAUDE_PROJECT_DIR/plugin/.claude-plugin/plugin.json" \
      '([$pm, $sm] | all(length == 1)) and ($pm[0].name | type == "string" and length > 0)
        and $pm[0].name == $sm[0].name' >/dev/null 2>&1; then
    _yield_mode=source
  elif [ -f "${SCRIPT_DIR}/lib/source-sha256.txt" ] && [ -f "${SCRIPT_DIR}/lib/source-hash.sh" ] \
    && . "${SCRIPT_DIR}/lib/source-hash.sh"; then
    _yield_mode=consumer
  fi
fi
if [ -n "$_yield_mode" ]; then
  _yield_names=''
  case "$SCRIPT_NAME" in
    ''|*[!A-Za-z0-9_-]*) : ;;
    *)
      if [ "$_yield_mode" = consumer ] || [ -f "$CLAUDE_PROJECT_DIR/plugin/hooks/$SCRIPT_NAME" ]; then
        grep -qE "^# (AUTO-GENERATED from|Plugin twin of) \.claude/hooks/${SCRIPT_NAME}\.sh" \
          "${SCRIPT_DIR}/${SCRIPT_NAME}" 2>/dev/null && _yield_names="$SCRIPT_NAME"
        _yield_names="$_yield_names $(sed -n 's/^# @plugin-yields-to:[[:space:]]*//p' \
          "${SCRIPT_DIR}/${SCRIPT_NAME}" 2>/dev/null | head -n 1)"
      fi
      ;;
  esac
  set -f
  for _name in $_yield_names; do
    case "$_name" in ''|*[!A-Za-z0-9_-]*) continue ;; esac
    _proj_hook="$CLAUDE_PROJECT_DIR/.claude/hooks/$_name.sh"
    [ -f "$_proj_hook" ] || continue
    sed -n 2p "$_proj_hook" | grep -qF "# $_name.sh — " || continue
    grep -qE '^# @(cc-only-rationale|dual-pair)' "$_proj_hook" || continue
    if [ "$_yield_mode" = consumer ]; then
      getff_closure_matches "${SCRIPT_DIR}/lib/source-sha256.txt" "$CLAUDE_PROJECT_DIR/.claude/hooks" "$_name" \
        || continue
    fi
    if jq -e -n --arg n "$SCRIPT_NAME" --arg t "$_name" \
      --slurpfile p "${SCRIPT_DIR}/hooks.json" --slurpfile s "$CLAUDE_PROJECT_DIR/.claude/settings.json" '
        def pairs(f): [(.hooks // {}) | to_entries[] | .key as $e | (.value | arrays)[] | objects
          | select(any((.hooks | arrays)[]; type == "object" and f))
          | [$e, (if (.matcher // "") == "*" then "" else (.matcher // "") end)]] | unique;
        ([$p, $s] | all(length == 1))
        and (($p[0] | pairs((.command // "") | tostring | test("run-hook\\.cmd\"? +" + $n + "$"))) as $need
          | ($s[0] | pairs(.type == "command" and ((keys - ["type", "command", "statusMessage"]) | length) == 0
              and .command == ("bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/" + $t + ".sh\""))) as $have
          | ($need | length) > 0 and all($need[]; . as $x | any($have[]; . == $x)))' >/dev/null 2>&1; then
      exit 0
    fi
  done
  set +f
fi
```

Note the `pairs`/`$need`/`$have` jq body is #1879's unchanged; only the plugin-name clause moved into the `source` mode test. Diff it against #1879's text to confirm nothing else moved.

- [ ] **Step 5: Update the comment block.** Replace #1879's bullet starting `- Source checkout only:` with:

```sh
#   - Two modes. SOURCE: the project ships this plugin (plugin/.claude-plugin/plugin.json names the
#     same plugin as ../.claude-plugin/plugin.json) and this hook (plugin/hooks/<name>); there
#     .claude/hooks/<name>.sh is the source this copy was generated from. CONSUMER: anywhere else,
#     the installed copy was frozen at install (setup.d/10-skills.sh copy_safe) and may be older,
#     newer or edited, so it counts only when it and every file it declares on
#     `# @plugin-yield-deps:` hash to lib/source-sha256.txt — the bytes this plugin was built from
#     (lib/source-hash.sh; spec docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md).
#     No manifest, no entry, no hashing tool or any mismatch → run.
```

- [ ] **Step 6: Add CR1** after the R1 block (it reuses R1's `$STUBS`):

```sh
# CR1 (real tree, consumer): the installer's hooks, copied from their installer sources and registered in
# the installer's own command forms (read from setup.d/10-skills.sh), silence their plugin copies —
# except deps-hash-check, whose cwd-relative registration never counts (spec D4).
mkdir -p "$STUBS/lib"; cp "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$REPO_ROOT/plugin/hooks/lib/source-sha256.txt" "$STUBS/lib/"
CONS="$TMPD/consumer"; mkdir -p "$CONS/.claude/hooks/lib"
cp -R "$REPO_ROOT/.claude/hooks/lang" "$CONS/.claude/hooks/"
cp "$REPO_ROOT/.claude/hooks/lib/residue-dir.sh" "$CONS/.claude/hooks/lib/"
echo '{}' > "$CONS/.claude/settings.json"
creg() {   # creg <event> <matcher|-> <command>
  jq --arg e "$1" --arg m "$2" --arg c "$3" \
    '.hooks[$e] += [(if $m == "-" then {} else {matcher: $m} end) + {hooks: [{type: "command", command: $c}]}]' \
    "$CONS/.claude/settings.json" > "$TMPD/c.tmp" && mv "$TMPD/c.tmp" "$CONS/.claude/settings.json"
}
INSTALLED=''
while IFS='|' read -r ev cmd nm mt; do
  cp "$REPO_ROOT/.claude/hooks/$nm.sh" "$CONS/.claude/hooks/$nm.sh"; INSTALLED="$INSTALLED $nm"
  creg "$ev" "${mt:--}" "$cmd"
done < <(sed -nE "s/.*register_cc_hook \"\\\$SETTINGS\" \"([A-Za-z]+)\" '([^']+)' \"([a-z0-9-]+)\"( \"([^\"]+)\")?.*/\1|\2|\3|\5/p" \
  "$REPO_ROOT/setup.d/10-skills.sh")
cp "$REPO_ROOT/packages/core/hooks/deps-hash-check.sh" "$CONS/.claude/hooks/deps-hash-check.sh"
creg UserPromptSubmit - "$(sed -n 's/^HOOK_CMD="\(.*\)"$/\1/p' "$REPO_ROOT/setup.d/10-skills.sh")"
silenced=0
for nm in $INSTALLED deps-hash-check; do
  [ -f "$STUBS/$nm" ] || continue
  OUT=$(env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$CONS" \
    XDG_CONFIG_HOME="$EMPTY_XDG" bash "$STUBS/run-hook.cmd" "$nm" </dev/null 2>/dev/null)
  if [ "$nm" = deps-hash-check ]; then expect "CR1 deps-hash-check (cwd-relative registration) still fires" RAN "$OUT"
  elif [ -z "$OUT" ]; then silenced=$((silenced+1))
  else bad "CR1 $nm: the consumer runs an identical copy, yet the plugin copy fired too"; fi
done
[ "$silenced" -ge 6 ] && ok "CR1 $silenced installer hooks silence their plugin copies" \
  || bad "CR1 only $silenced installer hooks silenced (vacuous or broken sweep)"
```

Before relying on CR1, print the parsed `ev|cmd|nm|mt` lines once and check them against `grep -n register_cc_hook setup.d/10-skills.sh`: a regex that matches nothing makes the sweep vacuous (the ≥6 threshold is the backstop).

If a hook fails CR1 because the plugin registers it on an (event, matcher) pair the installer does not, that is a real gap: do not lower the threshold or skip the hook. Record it in the PR body as a finding and leave that hook running (the yield is then correctly refused).

- [ ] **Step 7: Run** `bash tests/plugin/run-hook.test.sh` — expected: `FAIL=0`, all Y, C, R and CR1 arms PASS.

- [ ] **Step 8: Commit**

```bash
git add plugin/hooks/run-hook.cmd tests/plugin/run-hook.test.sh
git commit -m "feat(plugin): a plugin hook yields to a consumer's byte-identical installed copy"
```

### Task 3: One emitter for the output-language line (D5)

**Files:**
- Modify: `.claude/hooks/inject-session-bootstrap.sh` (marker near the top; brackets around the `# B1 (language-discipline)` block, currently lines 116-129)
- Generated: `plugin/hooks/inject-session-bootstrap`
- Test: `tests/plugin/run-hook.test.sh` (CR2, CR3 after CR1)

- [ ] **Step 1: Write CR2/CR3:**

```sh
# CR2/CR3 (real hooks): the output-language line reaches a prompt exactly once — consumer with the
# installer and the plugin; plugin-only under Claude Code; plugin-only under ZCode (spec D5, D6).
lang_lines() { grep -o '\[output-language\]' | wc -l | tr -d ' '; }
plugin_ups() { jq -r '.hooks.UserPromptSubmit[].hooks[].command | capture("run-hook\\.cmd\" (?<n>[^ ]+)").n' \
  "$REPO_ROOT/plugin/hooks/hooks.json" | grep -vx deps-hash-check; }
N=$( {
  for nm in $(jq -r '.hooks.UserPromptSubmit[].hooks[].command | capture("\\.claude/hooks/(?<n>[a-z-]+)\\.sh").n' \
      "$CONS/.claude/settings.json" | grep -vx deps-hash-check); do
    echo '{}' | CLAUDE_PROJECT_DIR="$CONS" AIF_HOOK_LANG=ru bash "$CONS/.claude/hooks/$nm.sh"
  done
  for n in $(plugin_ups); do
    echo '{"hook_event_name":"UserPromptSubmit"}' | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD \
      CLAUDE_PROJECT_DIR="$CONS" AIF_HOOK_LANG=ru XDG_CONFIG_HOME="$EMPTY_XDG" bash "$RH" "$n"
  done; } 2>/dev/null | lang_lines )
expect "CR2 consumer with installer + plugin: output-language line once" 1 "$N"
PONLY="$TMPD/plugin-only"; mkdir -p "$PONLY"
N=$(for n in $(plugin_ups); do echo '{"hook_event_name":"UserPromptSubmit"}' | env -u ZCODE_PROJECT_DIR \
  -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PONLY" AIF_HOOK_LANG=ru XDG_CONFIG_HOME="$EMPTY_XDG" bash "$RH" "$n"; \
  done 2>/dev/null | lang_lines)
expect "CR3 plugin-only (Claude Code): output-language line once" 1 "$N"
N=$(for n in $(plugin_ups); do echo '{"hook_event_name":"UserPromptSubmit"}' | env -u CLAUDE_PROJECT_DIR \
  -u GETFF_PLUGIN_NO_YIELD ZCODE_PROJECT_DIR="$PONLY" AIF_HOOK_LANG=ru XDG_CONFIG_HOME="$EMPTY_XDG" bash "$RH" "$n"; \
  done 2>/dev/null | lang_lines)
expect "CR3 plugin-only (ZCode): output-language line once" 1 "$N"
```

- [ ] **Step 2: Run** the test — expected: CR2 and both CR3 FAIL with `got '2'`.

- [ ] **Step 3: Edit the source.** In `.claude/hooks/inject-session-bootstrap.sh`, after the `@cc-only-rationale` comment block (ends line 9), add:

```sh
# @plugin-transform: sed /^# >>> plugin-drop: output-language$/,/^# <<< plugin-drop: output-language$/d
#   The plugin twin leaves the [output-language] line to the plugin's inject-output-language, its
#   only emitter in the payload; this repo's own copy keeps it (spec 2026-09-28 D5).
```

Put `# >>> plugin-drop: output-language` on the line before `# B1 (language-discipline): …` and `# <<< plugin-drop: output-language` on the line after that block's `esac`.

- [ ] **Step 4: Regenerate** `bash scripts/generate-plugin-twins.sh` and confirm `grep -c 'output-language\]' plugin/hooks/inject-session-bootstrap` prints `0` and the twin's line 2 is still the `AUTO-GENERATED from .claude/hooks/inject-session-bootstrap.sh` header.

- [ ] **Step 5: Run** `bash tests/plugin/run-hook.test.sh && bash tests/plugin/twin-generation.test.sh && bash tests/plugin/hook-paths.test.sh && npx vitest run packages/core/hooks packages/core/audit-self` — expected: all PASS, including #1879's R2 (source checkout: language line once) and R3.

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/inject-session-bootstrap.sh plugin/hooks/inject-session-bootstrap plugin/hooks/lib/source-sha256.txt tests/plugin/run-hook.test.sh
git commit -m "fix(plugin): the output-language line has one emitter in the plugin payload"
```

### Task 4: Principle 24 arm (j)

**Files:**
- Modify: `packages/core/principles/24-plugin-manifest-integrity.test.ts` (new exported function before `describe(`; two `it` blocks after the last `(i)` arm)

- [ ] **Step 1: Write the arms** (inside the existing `describe`):

```ts
  it('(j) real-tree: the source-hash manifest is fresh and complete, and the language line has one owner', () => {
    expect(sourceHashManifestViolations(REPO_ROOT)).toEqual([]);
  });

  it('(j) paired-negative: each way the manifest can lie is RED', () => {
    const root = mkdtempSync(join(tmpdir(), 'p24j-'));
    const w = (p: string, s: string) => {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      writeFileSync(join(root, p), s);
    };
    const pin = () => w('plugin/hooks/lib/source-sha256.txt', execFileSync('bash', [HASH_WRITER, root], { encoding: 'utf8' }));
    try {
      w('.claude/hooks/a.sh', '#!/usr/bin/env bash\n# a.sh — t\necho a\n');
      w('plugin/hooks/a', '#!/usr/bin/env bash\n# AUTO-GENERATED from .claude/hooks/a.sh\necho a\n');
      w('plugin/hooks/inject-output-language', 'echo "[output-language] x"\n');
      w('setup.d/10-skills.sh', `register_cc_hook "$SETTINGS" "Stop" 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/a.sh"' "a"\n`);
      pin();
      expect(sourceHashManifestViolations(root)).toEqual([]);
      w('.claude/hooks/a.sh', '#!/usr/bin/env bash\n# a.sh — t\necho CHANGED\n');
      expect(sourceHashManifestViolations(root).join('\n')).toMatch(/is stale/);
      w('.claude/hooks/a.sh', '#!/usr/bin/env bash\n# a.sh — t\n. "$(dirname "$0")/x.sh"\n');
      pin();
      expect(sourceHashManifestViolations(root).join('\n')).toMatch(/a: the installer delivers it .* no entry/);
      w('.claude/hooks/a.sh', '#!/usr/bin/env bash\n# a.sh — t\n# @plugin-yield-deps: gone.sh\n');
      expect(sourceHashManifestViolations(root).join('\n')).toMatch(/writer failed/);
      w('.claude/hooks/a.sh', '#!/usr/bin/env bash\n# a.sh — t\necho a\n');
      pin();
      w('plugin/hooks/inject-session-bootstrap', 'echo "[output-language] x"\n');
      expect(sourceHashManifestViolations(root).join('\n')).toMatch(/inject-session-bootstrap carries/);
      rmSync(join(root, 'plugin/hooks/inject-session-bootstrap'));
      w('packages/core/hooks/a.sh', '#!/usr/bin/env bash\necho other\n');
      expect(sourceHashManifestViolations(root).join('\n')).toMatch(/packages\/core\/hooks\/a\.sh differs/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
```

Extend the file's existing `node:fs` / `node:path` / `node:os` imports with whatever of `mkdtempSync`, `mkdirSync`, `writeFileSync`, `rmSync`, `readdirSync`, `existsSync`, `readFileSync`, `dirname`, `join`, `tmpdir` is not imported yet.

- [ ] **Step 2: Run** `npx vitest run packages/core/principles/24-plugin-manifest-integrity.test.ts -t '\(j\)'` — expected: FAIL, `sourceHashManifestViolations is not defined`.

- [ ] **Step 3: Implement** before `describe(`:

```ts
// ── (j) source-hash manifest — the ground truth of the consumer yield (spec 2026-09-28 D8/D10/D11) ──
// plugin/hooks/run-hook.cmd silences a plugin hook in a consumer only when the installed copy hashes
// to plugin/hooks/lib/source-sha256.txt. A stale line would let an OLDER installed copy silence a
// newer plugin copy; a missing entry silently keeps the duplicate; a diverged packages/core/hooks
// copy means the installer delivers bytes the manifest does not describe.
const HASH_WRITER = join(REPO_ROOT, 'scripts/plugin-source-hashes.sh');

export function sourceHashManifestViolations(root: string): string[] {
  const out: string[] = [];
  const rel = 'plugin/hooks/lib/source-sha256.txt';
  const read = (p: string) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
  let want = '';
  try {
    want = execFileSync('bash', [HASH_WRITER, root], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out.push(`${rel}: the writer failed — ${String((e as { stderr?: string }).stderr ?? e).trim()}`);
  }
  const have = read(rel);
  if (want && want !== have) out.push(`${rel} is stale — run: bash scripts/generate-plugin-twins.sh`);
  if (read('plugin/hooks/inject-session-bootstrap').includes('[output-language]'))
    out.push('plugin/hooks/inject-session-bootstrap carries the [output-language] line — D5 gives it to inject-output-language alone');
  if (!read('plugin/hooks/inject-output-language').includes('[output-language]'))
    out.push('plugin/hooks/inject-output-language no longer emits [output-language] — the line would reach nobody');
  const twinDir = join(root, 'plugin/hooks');
  const twins = existsSync(twinDir) ? readdirSync(twinDir) : [];
  for (const n of twins) {
    const a = read(`.claude/hooks/${n}.sh`);
    const b = read(`packages/core/hooks/${n}.sh`);
    if (a && b && a !== b)
      out.push(`packages/core/hooks/${n}.sh differs from .claude/hooks/${n}.sh — the installer delivers bytes the manifest does not describe`);
  }
  const installer = ['setup.d/10-skills.sh', 'setup.d/45-python.sh', 'install.sh'].map(read).join('\n');
  const delivered = new Set([...installer.matchAll(/\.claude\/hooks\/([a-z0-9-]+)\.sh/g)].map((m) => m[1]));
  for (const n of delivered) {
    if (!twins.includes(n)) continue;
    if (!have.split('\n').some((l) => l.endsWith(`  ${n}.sh`)))
      out.push(`${n}: the installer delivers it and the plugin twins it, but ${rel} has no entry — declare the files it reads on # @plugin-yield-deps`);
  }
  return out;
}
```

- [ ] **Step 4: Run** the arm again — expected: both `(j)` arms PASS; then the whole file: `npx vitest run packages/core/principles/24-plugin-manifest-integrity.test.ts` — `(i)` will be RED until Task 6 bumps the version; every other arm PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/principles/24-plugin-manifest-integrity.test.ts
git commit -m "test(principles): arm 24(j) keeps the plugin's source-hash manifest honest"
```

### Task 5: Documentation surfaces

**Files:** whatever the generators and the doc-authority gates name; do not hand-edit generated pages.

- [ ] **Step 1:** `node scripts/render-reference.mjs --check` — if RED for `run-hook.cmd`, `inject-session-bootstrap` or `inject-output-language` pages, run with `--write` and read the diff (#1879 changed `docs/site/reference/D/inject-output-language.md` this way).
- [ ] **Step 2:** `grep -rn 'consumer keeps both copies\|Source checkout only' docs plugin .claude --include=*.md` — every prose statement that «a consumer never yields» is now false; update each to the two-mode wording of Task 2 Step 5.
- [ ] **Step 3:** add a row to `docs/meta-factory/prior-art-evaluations.md` only if the build-vs-reuse consult (context7 ≥3 phrasings: «claude code plugin hook deduplication», «plugin hook duplicate project hook», «skip plugin hook when project settings registers same hook») surfaces a candidate; otherwise cite #150 in the trailer (spec §Prior art).
- [ ] **Step 4: Commit** `git commit -m "docs: the plugin hook yield reaches consumers with a byte-identical copy"`.

### Task 6: Release, full gate sweep, live runs, PR

- [ ] **Step 1: Bump the plugin** from the version on `origin/staging` to the next patch in all three files (as commit `7dbe6bd8760` did): `plugin/.claude-plugin/plugin.json` `version`, `.claude-plugin/marketplace.json` (both occurrences), `plugin/install/fetch-and-wire.sh` `RAT_PLUGIN_VERSION`. Then `bash scripts/build-getff-dist.sh` (rewrites `packages/getff/MANIFEST.sha256`) and `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` (fingerprints).
- [ ] **Step 2: Sweep** — `bash tests/plugin/run-hook.test.sh`, `for t in tests/plugin/*.test.sh; do bash "$t" || echo "FAIL $t"; done`, `npx vitest run packages/core/principles packages/core/hooks`, `make self-audit`. Expected: all green, including 24(i).
- [ ] **Step 3: Live run, Claude Code.** In the scratchpad: `git init`, run the installer from this worktree (`bash <worktree>/install.sh ts-server --path <tmp>` — adjust the stack to one the installer accepts), then `claude plugin marketplace add <worktree>` + `claude plugin install getff@getff --scope project` inside `<tmp>`, and `claude -p 'say ok' --output-format stream-json --include-hook-events` with `AIF_HOOK_LANG=ru`. Count `[output-language]` in the hook outputs: expected 1; list every hook that fired twice: expected only `deps-hash-check`. If `claude -p` cannot load a project-scope plugin non-interactively, record that and rely on CR1-CR3.
- [ ] **Step 4: Live run, ZCode.** If the `zcode` CLI is on PATH, repeat Step 3 through it and count the language line (expected 1). If it is not, open a follow-up task (spawn_task) titled «Automate a live ZCode hook-output run for plugin dedup» instead of asking the operator.
- [ ] **Step 5: Cold review** of the full diff with a fresh reviewer (T19) given only the spec path and the branch — fix findings.
- [ ] **Step 6: PR** to `staging` with `## Fidelity verdict`, §1.7 Forward-check / Backward-check sections (backward sweep class: «every place that assumed a consumer never yields»), and the `Prior-art:` trailer from Global Constraints. Watch CI via `~/.claude/scripts/ci-wait.sh <PR>`; verify the head SHA's own check-runs before trusting GREEN; merge with `gh pr merge --squash` once green (agent merge policy, base=staging).
