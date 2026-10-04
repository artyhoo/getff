#!/usr/bin/env bash
# tests/install-sh/session-settings.test.sh — the session-settings group (one-button point 13,
# plan §3): settings that change how a person's sessions run are written ONLY on the pre-launch
# «yes» (GETFF_SESSION_SETTINGS=1), into the per-person .claude/settings.local.json, and the
# install prints ONE command that undoes them.
#
# Arms (lib.sh + setup.d/session-settings.sh sourced, both JSON engines):
#   A  no consent → nothing written, the report says so
#   B  consent, no prior file → the group is written, the file is git-ignored through
#      .git/info/exclude, the printed undo command removes it (the tree is as before)
#   C  consent, the person's own file exists → their keys and array entries are kept, getff's are
#      added, their own autoCompactWindow wins; the printed undo command restores the file
#      byte-for-byte (cmp against the pre-install copy)
#   D  a second run changes nothing and still prints the same undo command
#   E  dry-run writes nothing
#   F  the same B/C results through node when jq is not on PATH
#   G  a real install: `install.sh react-spa` with GETFF_SESSION_SETTINGS=1 writes the group and
#      prints the undo line; without it, no settings.local.json
#   H  the python lane (`install.sh python`, which exits before the layer loop) does the same
#   I  the team's .claude/settings.json already sets autoCompactWindow and AIF_HANDOFF_GATE → getff
#      writes neither into settings.local.json (which Claude Code reads over it), adds the rest, and
#      the summary names each kept value with getff's (one-button fork 1 = A); both engines
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
command -v jq >/dev/null 2>&1 || { echo "  ⊝ jq absent — skipped"; echo "PASS=0 FAIL=0"; exit 0; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
DATA="$REPO_ROOT/setup.d/session-settings.json"
# The machine's own git ignore list may already cover settings.local.json (a common global
# pattern), which would make the «git-ignored» arm pass without the install doing anything:
# pin the global config and the default excludes file to empty ones.
: > "$WORK/gitconfig"; export GIT_CONFIG_GLOBAL="$WORK/gitconfig" XDG_CONFIG_HOME="$WORK/xdg"
# A PATH with node but without jq, for the F arms.
NOJQ="$WORK/nojq-bin"; mkdir -p "$NOJQ"
for t in node git cat mkdir mv rm cp cmp dirname basename sed tr head printf date mktemp sh bash grep awk sort cut; do
  p=$(command -v "$t" 2>/dev/null) && ln -sf "$p" "$NOJQ/$t"
done

# run_apply DIR [PATH] — source the lib + helper in a subshell, apply, print the report
run_apply() {
  local d="$1" path="${2:-$PATH}"
  ( export PATH="$path"
    INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
    PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$d"; NOT_WIRED=(); GETFF_ADDED_TO=(); GETFF_KEPT_VALUES=()
    # shellcheck source=setup.d/session-settings.sh
    source "$REPO_ROOT/setup.d/session-settings.sh"
    apply_session_settings "$d"
    print_not_wired
    echo "REVERT=${GETFF_SESSION_REVERT:-}" )
}
revert_of() { sed -n 's/^REVERT=//p' "$1"; }
has() { jq -e "$2" "$1" >/dev/null 2>&1; }
new_repo() { mkdir -p "$1"; git -C "$1" init -q; }

for engine in jq node; do
  P="$PATH"; tag=""
  [ "$engine" = node ] && { P="$NOJQ"; tag="F/"; }

  echo "── ${tag}A: no consent"
  d="$WORK/$engine-a"; new_repo "$d"
  GETFF_SESSION_SETTINGS="" run_apply "$d" "$P" > "$WORK/a.out" 2>&1
  [ ! -e "$d/.claude/settings.local.json" ] && ok "${tag}A no consent → no settings.local.json" || bad "${tag}A wrote without consent"
  grep -q 'not applied' "$WORK/a.out" && ok "${tag}A the report says the group was not applied" || bad "${tag}A silent: $(tr '\n' '|' < "$WORK/a.out")"

  echo "── ${tag}B: consent, no prior file"
  d="$WORK/$engine-b"; new_repo "$d"
  GETFF_SESSION_SETTINGS=1 run_apply "$d" "$P" > "$WORK/b.out" 2>&1
  f="$d/.claude/settings.local.json"
  if [ -f "$f" ]; then
    has "$f" '.autoCompactWindow == 400000' && has "$f" '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS == "1"' && has "$f" '.env.AIF_HANDOFF_GATE == "1"' \
      && has "$f" '(.permissions.deny | index("Bash(rm -rf *)")) != null' && has "$f" '(.permissions.allow | index("Task")) != null' \
      && ok "${tag}B the group is written" || bad "${tag}B wrong content: $(tr '\n' ' ' < "$f")"
    has "$f" '.env | has("AIF_CTX_WINDOW") | not' && has "$f" '(.permissions.deny | index("Bash(git push origin main*)")) == null' \
      && ok "${tag}B getff-only entries stay out (AIF_CTX_WINDOW, the main-branch push denies)" || bad "${tag}B a getff-only entry leaked"
  else bad "${tag}B no settings.local.json: $(tr '\n' '|' < "$WORK/b.out")"; fi
  git -C "$d" check-ignore -q .claude/settings.local.json && grep -qx '/.claude/settings.local.json' "$d/.git/info/exclude" \
    && ok "${tag}B the file is git-ignored through .git/info/exclude" || bad "${tag}B the file is not git-ignored by the install"
  cmd=$(revert_of "$WORK/b.out")
  if [ -n "$cmd" ]; then
    ( cd "$d" && eval "$cmd" )
    [ ! -e "$f" ] && ok "${tag}B the printed undo command («$cmd») removes it" || bad "${tag}B undo left the file: «$cmd»"
  else bad "${tag}B no undo command printed"; fi

  echo "── ${tag}C: consent, the person's own file"
  d="$WORK/$engine-c"; new_repo "$d"; mkdir -p "$d/.claude"; f="$d/.claude/settings.local.json"
  printf '{\n  "autoCompactWindow": 250000,\n  "env": {"MINE": "x"},\n  "permissions": {"allow": ["Bash(ls)"], "deny": ["Bash(rm -rf *)"]}\n}\n' > "$f"
  cp "$f" "$WORK/c.before"
  GETFF_SESSION_SETTINGS=1 run_apply "$d" "$P" > "$WORK/c.out" 2>&1
  has "$f" '.autoCompactWindow == 250000' && ok "${tag}C their autoCompactWindow wins" || bad "${tag}C their autoCompactWindow was replaced"
  grep -qF -- '- .claude/settings.local.json: autoCompactWindow = 250000 kept (getff'"'"'s: 400000)' "$WORK/c.out" \
    && ok "${tag}C the summary names their kept value and getff's" || bad "${tag}C kept value not reported: $(tr '\n' '|' < "$WORK/c.out")"
  has "$f" '.env.MINE == "x" and .env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS == "1"' && ok "${tag}C env merged, theirs kept" || bad "${tag}C env: $(jq -c .env "$f")"
  has "$f" '(.permissions.allow | index("Bash(ls)")) != null and (.permissions.allow | index("Agent")) != null' \
    && has "$f" '[.permissions.deny[] | select(. == "Bash(rm -rf *)")] | length == 1' \
    && ok "${tag}C arrays are a union without duplicates" || bad "${tag}C arrays: $(jq -c .permissions "$f")"
  cmd=$(revert_of "$WORK/c.out")
  cp "$f" "$WORK/c.after"

  echo "── ${tag}D: a second run"
  GETFF_SESSION_SETTINGS=1 run_apply "$d" "$P" > "$WORK/d.out" 2>&1
  cmp -s "$f" "$WORK/c.after" && ok "${tag}D a second run changes nothing" || bad "${tag}D the second run changed the file"
  [ "$(revert_of "$WORK/d.out")" = "$cmd" ] && ok "${tag}D it prints the same undo command" || bad "${tag}D undo differs: «$(revert_of "$WORK/d.out")» vs «$cmd»"
  if [ -n "$cmd" ]; then
    ( cd "$d" && eval "$cmd" )
    cmp -s "$f" "$WORK/c.before" && ok "${tag}C the undo command («$cmd») restores their file byte-for-byte" || bad "${tag}C undo did not restore the file"
  else bad "${tag}C no undo command printed"; fi

  echo "── ${tag}I: the team's settings.json sets a value getff also sets"
  # Claude Code reads settings.local.json over settings.json: writing getff's value locally would
  # override the team's own (one-button fork 1 = A, operator log entry 28).
  d="$WORK/$engine-i"; new_repo "$d"; mkdir -p "$d/.claude"; f="$d/.claude/settings.local.json"
  printf '{"autoCompactWindow": 200000, "env": {"AIF_HANDOFF_GATE": "0"}, "permissions": {"deny": ["Bash(ls)"]}}\n' > "$d/.claude/settings.json"
  cp "$d/.claude/settings.json" "$WORK/i.team"
  GETFF_SESSION_SETTINGS=1 run_apply "$d" "$P" > "$WORK/i.out" 2>&1
  has "$f" 'has("autoCompactWindow") | not' && has "$f" '.env | has("AIF_HANDOFF_GATE") | not' \
    && ok "${tag}I the team's autoCompactWindow and AIF_HANDOFF_GATE are not overridden locally" || bad "${tag}I local file overrides the team: $(tr '\n' ' ' < "$f")"
  has "$f" '.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS == "1" and (.permissions.deny | index("Bash(rm -rf *)")) != null' \
    && ok "${tag}I the values the team does not set are still added" || bad "${tag}I nothing else was added: $(tr '\n' ' ' < "$f")"
  cmp -s "$d/.claude/settings.json" "$WORK/i.team" && ok "${tag}I the team's settings.json is untouched" || bad "${tag}I the team's settings.json changed"
  grep -qF -- '- .claude/settings.json: autoCompactWindow = 200000 kept (getff'"'"'s: 400000)' "$WORK/i.out" \
    && grep -qF -- '- .claude/settings.json: env.AIF_HANDOFF_GATE = "0" kept (getff'"'"'s: "1")' "$WORK/i.out" \
    && ok "${tag}I the summary names both kept team values" || bad "${tag}I kept team values not reported: $(tr '\n' '|' < "$WORK/i.out")"
  grep -q 'Bash(ls)' "$WORK/i.out" && bad "${tag}I an array entry was reported as a conflict" || ok "${tag}I array entries are not reported as conflicts"
done

echo "── E: dry-run"
d="$WORK/e"; new_repo "$d"
DRY_RUN=--dry-run GETFF_SESSION_SETTINGS=1 run_apply "$d" > "$WORK/e.out" 2>&1
[ ! -e "$d/.claude/settings.local.json" ] && grep -q 'dry-run' "$WORK/e.out" && ok "E dry-run previews, writes nothing" || bad "E dry-run: $(tr '\n' '|' < "$WORK/e.out")"

echo "── G: a real install"
for want in yes no; do
  d="$WORK/g-$want"; new_repo "$d"
  printf '{"name":"fixture","dependencies":{"react":"^19.0.0"}}\n' > "$d/package.json"
  consent=""; [ "$want" = yes ] && consent=1
  ( cd "$d" && GETFF_SESSION_SETTINGS="$consent" bash "$REPO_ROOT/install.sh" react-spa --force </dev/null ) > "$WORK/g-$want.log" 2>&1; rc=$?
  [ "$rc" -eq 0 ] || { echo "FAIL: install.sh exited $rc"; exit 1; }
  if [ "$want" = yes ]; then
    has "$d/.claude/settings.local.json" '.autoCompactWindow == 400000' && grep -q 'undo with:' "$WORK/g-$want.log" \
      && ok "G consent → install.sh writes the group and prints the undo line" || bad "G consent: $(grep -i 'session' "$WORK/g-$want.log" | tr '\n' '|')"
  else
    [ ! -e "$d/.claude/settings.local.json" ] && ok "G no consent → install.sh writes no settings.local.json" || bad "G wrote without consent"
  fi
done

echo "── H: the python lane"
for want in yes no; do
  d="$WORK/h-$want"; new_repo "$d"
  consent=""; [ "$want" = yes ] && consent=1
  ( cd "$d" && GETFF_SESSION_SETTINGS="$consent" bash "$REPO_ROOT/install.sh" python --force </dev/null ) > "$WORK/h-$want.log" 2>&1; rc=$?
  [ "$rc" -eq 0 ] || { echo "FAIL: install.sh exited $rc"; exit 1; }
  if [ "$want" = yes ]; then
    has "$d/.claude/settings.local.json" '.autoCompactWindow == 400000' && grep -q 'undo with:' "$WORK/h-$want.log" \
      && ok "H consent → the python lane writes the group and prints the undo line" || bad "H consent: $(grep -i 'session' "$WORK/h-$want.log" | tr '\n' '|')"
  else
    [ ! -e "$d/.claude/settings.local.json" ] && grep -q 'session settings not applied' "$WORK/h-$want.log" \
      && ok "H no consent → the python lane writes nothing and says so" || bad "H no consent: $(grep -i 'session' "$WORK/h-$want.log" | tr '\n' '|')"
  fi
done

# ── M: a file this run CREATED is handed to this run's formatter (P6 run 2 N5, seam with P5) ──
# P5's format_getff_writes formats an untracked file from its .ai-factory/before-getff/ record, but a
# `.absent` record never expires; it narrows to «this run» through KEPT_ORIGINALS (keep_original_mark,
# P5's lib.sh). The writer marks the file only on the run that creates it, so a hand edit on a later
# run is never reformatted. keep_original_mark is stubbed here: this branch does not carry P5's lib.
run_mark() {
  ( INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
    PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$1"; NOT_WIRED=(); GETFF_ADDED_TO=(); GETFF_KEPT_VALUES=()
    keep_original_mark() { echo "MARK=$1"; }
    # shellcheck source=setup.d/session-settings.sh
    source "$REPO_ROOT/setup.d/session-settings.sh"
    GETFF_SESSION_SETTINGS=1 apply_session_settings "$1" )
}
echo "── M: the created file is marked for this run's formatter, and only on the run that creates it"
d="$WORK/mark"; new_repo "$d"; f="$d/.claude/settings.local.json"
run_mark "$d" > "$WORK/m1.out" 2>&1
grep -qxF "MARK=$f" "$WORK/m1.out" && ok "M1 a created settings.local.json is marked (keep_original_mark)" \
  || bad "M1 the created file was not marked: $(tr '\n' '|' < "$WORK/m1.out")"
run_mark "$d" > "$WORK/m2.out" 2>&1
! grep -q '^MARK=' "$WORK/m2.out" && ok "M2 a second run over the existing file marks nothing" \
  || bad "M2 a run that did not create the file marked it: $(grep '^MARK=' "$WORK/m2.out")"
rm -f "$f"
run_mark "$d" > "$WORK/m3.out" 2>&1
grep -qxF "MARK=$f" "$WORK/m3.out" && ok "M3 re-created after a hand delete (the .absent record already there) → marked again" \
  || bad "M3 a re-created file was not marked: $(tr '\n' '|' < "$WORK/m3.out")"
# M4: the person's own file, which this run CHANGES — keep_original_settle does not mark (P5's lib marks
# at its callers, 99-finalize), so the writer marks after a settle that kept an original.
d="$WORK/mark4"; new_repo "$d"; f="$d/.claude/settings.local.json"; mkdir -p "$d/.claude"
printf '{"env":{"MINE":"1"}}\n' > "$f"
run_mark "$d" > "$WORK/m4.out" 2>&1
grep -qxF "MARK=$f" "$WORK/m4.out" && ok "M4 the person's own settings.local.json, changed by this run, is marked" \
  || bad "M4 a changed own file was not marked: $(tr '\n' '|' < "$WORK/m4.out")"

[ -f "$DATA" ] || bad "missing $DATA"
echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
