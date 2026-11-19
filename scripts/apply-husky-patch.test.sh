#!/usr/bin/env bash
# apply-husky-patch.test.sh — paired positive/negative fixtures for the sanctioned .husky patch
# channel: scripts/apply-husky-patch.sh (the writer) + .claude/hooks/apply-husky-patch-gate.sh
# (the permission gate). Runs entirely in scratch repos — no real .husky file is ever touched.
#
# Arms:
#   P1-P2  dry-run succeeds from the repo root and is DETERMINISTIC (two runs, byte-identical output)
#   P3     cwd independence: the same dry-run from a nested subdirectory resolves the same repo
#   P4     --apply lands the tested bytes end-to-end (no prompts), cmp-verified on disk
#   P5     the application appends one structured APPLY-HUSKY-PATCH line to the git-safety tamper.log
#   P6     idempotence: re-applying is a no-op with a named reason, exit 0
#   P7-P8, P11 the gate APPROVES the canonical invocation shapes (dry-run; apply with the
#          canonical GIT_SAFETY_OVERRIDE literal; apply with the documented optional flags)
#   P9-P10, P12-P14 the gate stays SILENT for a different override literal, unrelated
#          commands, and hook-failure shapes (malformed/empty JSON, non-Bash tool)
#   N11-N25 the gate requires the COMPLETE canonical single command (D2070-S01): compound
#          suffixes (; && newline | $( ) ` >), extra/unknown modes and flags, smuggled
#          variables and truncated flag lists get NO allow — normal permission flow
#   N1-N10 the writer REFUSES, leaving the target byte-unchanged: expected-file drift, targets
#          outside .husky/, the generated .husky/_ shim, --apply without / with a wrong override,
#          a repo outside the rules-as-tests-aif family, missing patch, missing target, symlinked
#          target, a patch that no longer applies
#   S1-S2  both scripts pass bash -n and the repo's bash-3.2/BSD gate (check-bash32.sh)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPLY="$REPO_ROOT/scripts/apply-husky-patch.sh"
GATE="$REPO_ROOT/.claude/hooks/apply-husky-patch-gate.sh"
CANON='apply-husky-patch sanctioned channel (operator-approved 2026-10-06)'
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
run() { out=$(env "$@" 2>&1) && rc=0 || rc=$?; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/apply-husky-patch.test.XXXXXX")"
# bash32-safe: single fixed trap var, set before any exit path
trap 'rm -rf "$TMP"' EXIT

# scratch repo A — passes the repo-family pin via the family origin URL (local, no network)
ORIG_A="$TMP/repoA"
git init -q "$ORIG_A"
git -C "$ORIG_A" config user.email t@t
git -C "$ORIG_A" config user.name t
git -C "$ORIG_A" remote add origin https://github.com/artyhoo/getff.git
mkdir -p "$ORIG_A/.husky"
printf '#!/bin/sh\nset -eu\necho "orig"\n' > "$ORIG_A/.husky/pre-commit"
printf 'echo "orig"\n' > "$TMP/expected.new"
printf '#!/bin/sh\nset -eu\necho "orig"\n# sanctioned block\necho "patched"\n' > "$TMP/expected.full"
diff -u "$ORIG_A/.husky/pre-commit" "$TMP/expected.full" > "$TMP/p.patch" || true
: > "$TMP/tamper.log"

# P1 dry-run from the repo root
run GIT_SAFETY_COORD_DIR="$TMP" bash "$APPLY" --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full"
if [ "$rc" -eq 0 ] && grep -q "DRY-RUN OK" <<<"$out" && grep -q "sha256=" <<<"$out"; then
  ok "P1 dry-run succeeds with a result sha"
else
  bad "P1 dry-run — want exit 0 + DRY-RUN OK, got rc=$rc: $(tr '\n' '|' <<<"$out")"
fi
echo "$out" > "$TMP/dryrun-root.txt"

# P2 determinism: a second dry-run is byte-identical
run GIT_SAFETY_COORD_DIR="$TMP" bash "$APPLY" --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full"
if [ "$rc" -eq 0 ] && cmp -s "$TMP/dryrun-root.txt" <(printf '%s\n' "$out"); then
  ok "P2 dry-run is deterministic (two runs byte-identical)"
else
  bad "P2 determinism — outputs differ or rc=$rc"
fi

# P3 cwd independence: same dry-run from a nested subdirectory
mkdir -p "$ORIG_A/deep/nested"
out2=""
out2="$( cd "$ORIG_A/deep/nested" && GIT_SAFETY_COORD_DIR="$TMP" bash "$APPLY" --patch "$TMP/p.patch" --expected "$TMP/expected.full" 2>&1 )" && rc2=0 || rc2=$?
if [ "$rc2" -eq 0 ] && [ "$out2" = "$(cat "$TMP/dryrun-root.txt")" ]; then
  ok "P3 dry-run from a nested subdirectory resolves the same repo and matches"
else
  bad "P3 cwd independence — rc=$rc2, output differs: $(printf '%s' "$out2" | tr '\n' '|')"
fi

# P4 end-to-end apply, bytes verified on disk
run GIT_SAFETY_COORD_DIR="$TMP" GIT_SAFETY_OVERRIDE="$CANON" bash "$APPLY" --apply --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full"
if [ "$rc" -eq 0 ] && grep -q "APPLIED" <<<"$out" && cmp -s "$ORIG_A/.husky/pre-commit" "$TMP/expected.full"; then
  ok "P4 --apply lands the tested bytes (no prompts, cmp-verified)"
else
  bad "P4 apply — rc=$rc: $(tr '\n' '|' <<<"$out")"
fi

# P5 structured tamper.log line (the script logs the pwd -P resolved repo path)
ORIG_A_R="$(cd "$ORIG_A" && pwd -P)"
if grep -q "APPLY-HUSKY-PATCH | repo=$ORIG_A_R | target=.husky/pre-commit" "$TMP/tamper.log" \
   && grep -q "mode=apply" "$TMP/tamper.log"; then
  ok "P5 tamper.log carries the structured APPLY-HUSKY-PATCH line"
else
  bad "P5 tamper.log line missing or malformed: $(cat "$TMP/tamper.log")"
fi

# P6 idempotence
run GIT_SAFETY_COORD_DIR="$TMP" GIT_SAFETY_OVERRIDE="$CANON" bash "$APPLY" --apply --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full"
if [ "$rc" -eq 0 ] && grep -q "already applied" <<<"$out"; then
  ok "P6 re-apply is a named no-op (already applied)"
else
  bad "P6 idempotence — rc=$rc: $(tr '\n' '|' <<<"$out")"
fi

gate_call() { # gate_call <command> -> stdout of the gate for that Bash command
  python3 -c 'import json,sys; print(json.dumps({"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$1" \
    | bash "$GATE"
}
GATE_DRY='bash "$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh" --dry-run --patch /p --expected /e'
GATE_APPLY="GIT_SAFETY_OVERRIDE='$CANON' bash \"\$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh\" --apply --patch /p --expected /e"

# P7 gate approves the dry-run form
g="$(gate_call "$GATE_DRY")"
if grep -q '"permissionDecision": "allow"' <<<"$g" && grep -q "dry-run" <<<"$g"; then
  ok "P7 gate approves the canonical dry-run form"
else
  bad "P7 gate dry-run — got: ${g:-<empty>}"
fi

# P8 gate approves the apply form with the canonical override
g="$(gate_call "$GATE_APPLY")"
if grep -q '"permissionDecision": "allow"' <<<"$g" && grep -q "GIT_SAFETY_OVERRIDE" <<<"$g"; then
  ok "P8 gate approves the canonical apply form (canonical override)"
else
  bad "P8 gate apply — got: ${g:-<empty>}"
fi

# P9 gate silent for a different override literal
g="$(gate_call "${GATE_APPLY/$CANON/some other rationale that is long enough}")"
if [ -z "$g" ]; then ok "P9 gate silent for a non-canonical override"; else bad "P9 gate leaked a decision: $g"; fi

# P10 gate silent for unrelated commands
g="$(gate_call "ls -la")"
if [ -z "$g" ]; then ok "P10 gate silent for unrelated commands"; else bad "P10 gate leaked a decision: $g"; fi

# P11 gate approves the apply form with the documented optional flags
g="$(gate_call "GIT_SAFETY_OVERRIDE='$CANON' bash \"\$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh\" --apply --patch /p --expected /e --target .husky/pre-commit --repo /r")"
if grep -q '"permissionDecision": "allow"' <<<"$g"; then
  ok "P11 gate approves the apply form with optional --target/--repo"
else
  bad "P11 gate apply + optional flags — got: ${g:-<empty>}"
fi

# P12-P14 hook failure / non-matching event shapes stay silent with rc 0 (normal flow)
g="$(printf 'not json' | bash "$GATE")"
if [ -z "$g" ]; then ok "P12 gate silent on malformed JSON payload"; else bad "P12 leaked: $g"; fi
g="$(printf '' | bash "$GATE")"
if [ -z "$g" ]; then ok "P13 gate silent on empty stdin"; else bad "P13 leaked: $g"; fi
g="$(printf '{"hook_event_name":"PreToolUse","tool_name":"Read","tool_input":{"file_path":"/x"}}' | bash "$GATE")"
if [ -z "$g" ]; then ok "P14 gate silent for non-Bash tools"; else bad "P14 leaked: $g"; fi

# N11-N25 gate negatives (D2070-S01): the approval must require the COMPLETE canonical
# single command — every compound suffix, substitution, redirection, extra/unknown mode
# or smuggled variable stays in the normal permission flow (empty stdout).
gate_silent() { # gate_silent <label> <command>
  local label="$1" c="$2" out=""
  out="$(gate_call "$c")"
  if [ -z "$out" ]; then ok "$label"; else bad "$label — gate approved: $out"; fi
}
gate_silent "N11 compound suffix '; printf EXTRA' gets no allow (D2070-S01 repro)" "$GATE_DRY; printf EXTRA"
gate_silent "N12 && chain gets no allow" "$GATE_DRY && printf EXTRA"
gate_silent "N13 newline-suffixed command gets no allow" "$(printf '%s\nprintf EXTRA' "$GATE_DRY")"
gate_silent "N14 piped suffix gets no allow" "$GATE_DRY | cat"
gate_silent "N15 command substitution gets no allow" "$GATE_DRY \$(printf EXTRA)"
gate_silent "N16 backtick substitution gets no allow" "$GATE_DRY \`printf EXTRA\`"
gate_silent "N17 redirection gets no allow" "$GATE_DRY > /tmp/apply-husky-patch-evil"
gate_silent "N18 extra mode: --apply appended to the dry-run shape gets no allow" "$GATE_DRY --apply"
gate_silent "N19 unknown flag gets no allow" "$GATE_DRY --evil x"
gate_silent "N20 smuggled variable gets no allow" "$GATE_DRY --patch \"\$HOME/x\" --expected /e"
gate_silent "N21 apply form without the override gets no allow" 'bash "$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh" --apply --patch /p --expected /e'
gate_silent "N22 duplicate --patch gets no allow" "$GATE_DRY --patch /q"
gate_silent "N23 subshell parens get no allow" "( $GATE_DRY )"
gate_silent "N24 env prefix on the dry-run shape gets no allow" "GIT_SAFETY_OVERRIDE='$CANON' bash \"\$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh\" --dry-run --patch /p --expected /e"
gate_silent "N25 truncated flag list gets no allow" 'bash "$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh" --dry-run --patch /p'

# negative arms: the target must stay byte-unchanged after every refusal
assert_refused() { # assert_refused <label> <want-grep> <env-prefix...> -- <args...>
  local label="$1" want="$2"; shift 2
  local env_prefix=()
  while [ "$1" != "--" ]; do env_prefix+=("$1"); shift; done
  shift
  run ${env_prefix[@]+"${env_prefix[@]}"} bash "$APPLY" "$@"
  if [ "$rc" -ne 0 ] && grep -q "$want" <<<"$out" \
     && cmp -s "$ORIG_A/.husky/pre-commit" "$TMP/expected.full"; then
    ok "$label"
  else
    bad "$label — want rc≠0 + «$want», got rc=$rc: $(tr '\n' '|' <<<"$out")"
  fi
}

printf 'drift' > "$TMP/expected.wrong"
# N1 needs a target in PRE-patch state: after P4 the repoA hook is already patched, and GNU
# patch (CI Linux) then refuses the re-apply as "previously applied" while BSD patch would
# silently double-apply — a per-implementation fork. A fresh repo pins the arm to the drift
# message itself on both implementations.
ORIG_D="$TMP/repoD"
git init -q "$ORIG_D"
git -C "$ORIG_D" config user.email t@t
git -C "$ORIG_D" config user.name t
git -C "$ORIG_D" remote add origin git@github.com:artyhoo/getff.git
mkdir -p "$ORIG_D/.husky"
printf '#!/bin/sh\nset -eu\necho "orig"\n' > "$ORIG_D/.husky/pre-commit"
run GIT_SAFETY_COORD_DIR="$TMP" GIT_SAFETY_OVERRIDE="$CANON" bash "$APPLY" --repo "$ORIG_D" --patch "$TMP/p.patch" --expected "$TMP/expected.wrong"
if [ "$rc" -ne 0 ] && grep -q "drift:" <<<"$out" \
   && [ "$(cat "$ORIG_D/.husky/pre-commit")" = '#!/bin/sh
set -eu
echo "orig"' ]; then
  ok "N1 drift vs expected file refuses, target unchanged"
else
  bad "N1 drift — want rc≠0 + «drift:», got rc=$rc: $(tr '\n' '|' <<<"$out")"
fi
assert_refused "N2 target outside .husky/ refuses" "under .husky" \
  GIT_SAFETY_COORD_DIR="$TMP" -- \
  --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full" --target scripts/other.sh
assert_refused "N3 generated .husky/_ shim refuses" "husky shim" \
  GIT_SAFETY_COORD_DIR="$TMP" -- \
  --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full" --target .husky/_/pre-commit
assert_refused "N4 --apply without the override refuses" "GIT_SAFETY_OVERRIDE" \
  GIT_SAFETY_COORD_DIR="$TMP" -- \
  --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full" --apply
assert_refused "N5 --apply with a wrong override refuses" "exact prefix" \
  GIT_SAFETY_COORD_DIR="$TMP" GIT_SAFETY_OVERRIDE="totally different rationale, long enough" -- \
  --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full" --apply

# N6 repo-family pin: a scratch repo WITHOUT the family origin refuses
ORIG_B="$TMP/repoB"
git init -q "$ORIG_B"
git -C "$ORIG_B" config user.email t@t
git -C "$ORIG_B" config user.name t
mkdir -p "$ORIG_B/.husky"
printf '#!/bin/sh\nset -eu\necho "orig"\n' > "$ORIG_B/.husky/pre-commit"
run GIT_SAFETY_COORD_DIR="$TMP" bash "$APPLY" --repo "$ORIG_B" --patch "$TMP/p.patch" --expected "$TMP/expected.full"
if [ "$rc" -ne 0 ] && grep -q "repo pin failed" <<<"$out"; then
  ok "N6 repo outside the family refuses (pin)"
else
  bad "N6 repo pin — want refusal, rc=$rc: $(tr '\n' '|' <<<"$out")"
fi

# N26-N28 the family pin is EXACT (D2068-S01): a suffix repository, a wrong host and an
# embedded path must fail the pin BEFORE any write; P1 (https) and N1 (ssh) are the
# exact-origin positive controls, P16 the same-common-dir fallback control.
mk_pin_repo() { # mk_pin_repo <dir> <origin-url>
  git init -q "$1"
  git -C "$1" config user.email t@t
  git -C "$1" config user.name t
  git -C "$1" remote add origin "$2"
  mkdir -p "$1/.husky"
  printf '#!/bin/sh\nset -eu\necho "orig"\n' > "$1/.husky/pre-commit"
}
pin_refusal() { # pin_refusal <label> <dir>
  run GIT_SAFETY_COORD_DIR="$TMP" bash "$APPLY" --repo "$2" --patch "$TMP/p.patch" --expected "$TMP/expected.full"
  if [ "$rc" -ne 0 ] && grep -q "repo pin failed" <<<"$out"; then ok "$1"
  else bad "$1 — want pin refusal, rc=$rc: $(tr '\n' '|' <<<"$out")"; fi
}
ORIG_E1="$TMP/repoE1"; mk_pin_repo "$ORIG_E1" "https://github.com/artyhoo/getff-experiment.git"
pin_refusal "N26 suffix repository (artyhoo/getff-experiment) refuses" "$ORIG_E1"
ORIG_E2="$TMP/repoE2"; mk_pin_repo "$ORIG_E2" "https://github.com.evil.example/artyhoo/getff.git"
pin_refusal "N27 wrong host with the right path refuses" "$ORIG_E2"
ORIG_E3="$TMP/repoE3"; mk_pin_repo "$ORIG_E3" "https://github.com/unrelated/artyhoo/getff.git"
pin_refusal "N28 embedded path refuses" "$ORIG_E3"

# P16 same-git-common-dir fallback: a local worktree of the authoring family (no origin
# of its own) passes the pin and runs the dry-run end-to-end
FAM_HOME="$TMP/home"; FAM="$FAM_HOME/code/rules-as-tests-aif"
mk_pin_repo "$FAM" "https://github.com/artyhoo/getff.git"
git -C "$FAM" add -A
git -C "$FAM" commit -q -m init
ORIG_F="$TMP/repoF"
git -C "$FAM" worktree add -q "$ORIG_F" HEAD
run HOME="$FAM_HOME" GIT_SAFETY_COORD_DIR="$TMP" bash "$APPLY" --repo "$ORIG_F" --patch "$TMP/p.patch" --expected "$TMP/expected.full"
if [ "$rc" -eq 0 ] && grep -q "DRY-RUN OK" <<<"$out"; then
  ok "P16 same-git-common-dir fallback passes the pin (family worktree, no origin)"
else
  bad "P16 common-dir fallback — rc=$rc: $(tr '\n' '|' <<<"$out")"
fi

assert_refused "N7 missing patch file refuses" "missing:" \
  GIT_SAFETY_COORD_DIR="$TMP" -- \
  --repo "$ORIG_A" --patch "$TMP/nope.patch" --expected "$TMP/expected.full"
assert_refused "N8 missing target file refuses" "does not exist" \
  GIT_SAFETY_COORD_DIR="$TMP" -- \
  --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full" --target .husky/commit-msg
ln -s "$TMP/expected.full" "$ORIG_A/.husky/link-me"
assert_refused "N9 symlinked target refuses" "symlink" \
  GIT_SAFETY_COORD_DIR="$TMP" -- \
  --repo "$ORIG_A" --patch "$TMP/p.patch" --expected "$TMP/expected.full" --target .husky/link-me
printf 'unrelated context\n' > "$TMP/drifted.patch"
# N10 needs a target NOT already at the expected state (idempotence would short-circuit): fresh repo C
ORIG_C="$TMP/repoC"
git init -q "$ORIG_C"
git -C "$ORIG_C" config user.email t@t
git -C "$ORIG_C" config user.name t
git -C "$ORIG_C" remote add origin git@github.com:artyhoo/getff.git
mkdir -p "$ORIG_C/.husky"
printf '#!/bin/sh\nset -eu\necho "orig"\n' > "$ORIG_C/.husky/pre-commit"
run GIT_SAFETY_COORD_DIR="$TMP" bash "$APPLY" --repo "$ORIG_C" --patch "$TMP/drifted.patch" --expected "$TMP/expected.full"
if [ "$rc" -ne 0 ] && grep -q "does not apply cleanly" <<<"$out" \
   && [ "$(cat "$ORIG_C/.husky/pre-commit")" = '#!/bin/sh
set -eu
echo "orig"' ]; then
  ok "N10 non-applying patch refuses, target unchanged"
else
  bad "N10 non-applying patch — want refusal, rc=$rc: $(tr '\n' '|' <<<"$out")"
fi

# S1 syntax gate
for f in "$APPLY" "$GATE"; do
  if bash -n "$f" 2>/dev/null; then ok "S1 bash -n clean: $(basename "$f")"; else bad "S1 bash -n FAILED: $f"; fi
done

# S2 repo bash-3.2/BSD gate
for f in "$APPLY" "$GATE"; do
  out=$(bash "$REPO_ROOT/scripts/check-bash32.sh" "$f" 2>&1) && rc=0 || rc=$?
  if [ "$rc" -eq 0 ]; then ok "S2 check-bash32 clean: $(basename "$f")"
  else bad "S2 check-bash32 findings in $f: $(tr '\n' '|' <<<"$out")"; fi
done

echo
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
