#!/usr/bin/env bash
# check-getff-manifest-staged.test.sh — paired positive/negative fixtures for
# scripts/check-getff-manifest-staged.sh (the pre-commit «payload commit carries its manifest» gate).
#
# Every arm runs in a throw-away git repo under mktemp that carries a COPY of the real
# scripts/build-getff-dist.sh + the checker, so both resolve ROOT to the fixture and the real
# payload list is exercised unchanged (one file per PAYLOAD_TOP root is enough for it to assemble).
#
# Arms:
#   N1 nothing from the payload staged → quiet
#   N2 payload edit + rebuilt manifest, both staged → quiet
#   N3 a new payload file `git add`ed BEFORE the build, manifest staged → quiet
#   N4 a payload deletion with the rebuilt manifest staged → quiet
#   N5 an untracked file in a payload directory the commit does not touch → quiet (in-progress work
#      elsewhere must not block a commit; measured 8/151 worktrees blocked by the unscoped arm)
#   N6 an untracked file in a SUBdirectory of a staged path's directory (test temp dirs) → quiet
#   P1 the #1627 shape: working tree fully in sync (`--check` GREEN) but the manifest is not staged → fires
#   P2 payload staged, manifest never rebuilt → fires
#   P3 the #1625 shape: a new payload file left UNTRACKED next to the staged edit → fires,
#      although the index manifest and the index payload agree with each other
#   P4 a partial stage: two payload edits on disk, the manifest built from both, one edit staged → fires
#   P5 a payload deletion without the manifest → fires
#   P6 a manifest-only commit rebuilt from unstaged payload edits → fires
#   S1 a tracked symlink under a payload root → fires as «could not run», not as drift
#   I1 the check reads GIT_INDEX_FILE (what `git commit -a` / `git commit <path>` hand a pre-commit hook)
#   E1 an escape rationale under 20 characters is refused → fires
#   E2 an escape with a real rationale → passes, and the rationale lands in the override log
#   L1 build-getff-dist.sh --list-payload still prints the payload list the checker consumes
#   A1 the maintainer patch still applies to .husky/pre-commit (or is applied) — the drift alarm
#   A2 the apply script branches off staging and commits .husky/pre-commit alone (no renderer in the fixture)
#   A3 the patched hook parses and keeps `exit "$fail"` last
#   A4 the apply script is idempotent
#   A5 the apply script refuses a dirty tracked tree and commits nothing
#   A6 a patch that no longer applies rolls back: back on the start branch, no maintainer branch
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# A hook-launched run inherits the outer repo's git environment; every fixture must own its repo.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX 2>/dev/null || true
unset GETFF_MANIFEST_STAGED_ALLOW 2>/dev/null || true

TMP=$(mktemp -d "${TMPDIR:-/tmp}/getff-manifest-staged.XXXXXX"); trap 'rm -rf "$TMP"' EXIT
g() { git -c user.name=t -c user.email=t@t -c commit.gpgsign=false -c core.hooksPath=/dev/null "$@"; }

# fresh_repo: a committed fixture whose MANIFEST.sha256 is in sync; prints its path.
# mktemp, not a counter: callers run it inside $(...), where a counter never leaves the subshell.
fresh_repo() {
  local r top
  r=$(mktemp -d "$TMP/r.XXXXXX")
  mkdir -p "$r/scripts" "$r/packages/getff" "$r/setup.d" "$r/agents" "$r/skills" "$r/templates" \
    "$r/.claude/hooks" "$r/packages/core"
  cp "$REPO_ROOT/scripts/build-getff-dist.sh" "$r/scripts/"
  cp "$REPO_ROOT/scripts/check-getff-manifest-staged.sh" "$r/scripts/" 2>/dev/null || true
  echo '#!/bin/sh' > "$r/install.sh"; echo '#!/bin/sh' > "$r/setup"
  echo 'a=1' > "$r/setup.d/10-a.sh"; echo '# a' > "$r/agents/a.md"; echo '# s' > "$r/skills/s.md"; echo '# s2' > "$r/skills/s2.md"
  echo 't' > "$r/templates/t.txt"; echo 'h=1' > "$r/.claude/hooks/h.sh"; echo '{}' > "$r/.prettierrc.json"
  echo 'core' > "$r/packages/core/index.js"; echo 'ask=1' > "$r/scripts/check-ask-files.sh"
  echo 'notes' > "$r/README.md"
  printf '/*\n!/MANIFEST.sha256\n!/package.json\n!/.gitignore\n' > "$r/packages/getff/.gitignore"
  {
    printf '{ "name": "getff", "files": ['
    local first=1
    for top in install.sh setup setup.d agents skills templates .claude .prettierrc.json packages scripts; do
      [ "$first" -eq 1 ] || printf ', '; first=0; printf '"%s"' "$top"
    done
    printf '] }\n'
  } > "$r/packages/getff/package.json"
  g -C "$r" init -q
  g -C "$r" add -A
  bash "$r/scripts/build-getff-dist.sh" >/dev/null
  g -C "$r" add packages/getff/MANIFEST.sha256
  g -C "$r" commit -qm base
  echo "$r"
}

# run <label> <want: fire|quiet> <repo> [env assignments...] — invoke the checker, compare rc.
run() {
  local label="$1" want="$2" r="$3" out rc; shift 3
  out=$(cd "$r" && env "$@" bash scripts/check-getff-manifest-staged.sh 2>&1) && rc=0 || rc=$?
  LAST_OUT="$out"
  case "$want:$rc" in
    fire:1|quiet:0) ok "$label" ;;
    *) bad "$label — want $want, rc=$rc: $(tr '\n' '|' <<<"$out")" ;;
  esac
}
build() { bash "$1/scripts/build-getff-dist.sh" >/dev/null; }

echo "── quiet"
r=$(fresh_repo); echo more >> "$r/README.md"; g -C "$r" add README.md
run "N1 nothing from the payload staged" quiet "$r"

r=$(fresh_repo); echo b=2 >> "$r/setup.d/10-a.sh"; build "$r"
g -C "$r" add setup.d/10-a.sh packages/getff/MANIFEST.sha256
run "N2 payload edit + rebuilt manifest, both staged" quiet "$r"

r=$(fresh_repo); echo new > "$r/agents/new.md"; g -C "$r" add agents/new.md; build "$r"
g -C "$r" add packages/getff/MANIFEST.sha256
run "N3 new payload file added before the build, manifest staged" quiet "$r"

r=$(fresh_repo); g -C "$r" rm -q skills/s2.md; build "$r"; g -C "$r" add packages/getff/MANIFEST.sha256
run "N4 payload deletion with the rebuilt manifest staged" quiet "$r"

r=$(fresh_repo); echo wip > "$r/templates/wip.txt"; echo b=2 >> "$r/setup.d/10-a.sh"; build "$r"
g -C "$r" add setup.d/10-a.sh packages/getff/MANIFEST.sha256
run "N5 untracked file in a payload directory the commit does not touch" quiet "$r"

r=$(fresh_repo); mkdir -p "$r/setup.d/.probe-XYZ"; echo tmp > "$r/setup.d/.probe-XYZ/c.mjs"
echo b=2 >> "$r/setup.d/10-a.sh"; build "$r"; g -C "$r" add setup.d/10-a.sh packages/getff/MANIFEST.sha256
run "N6 untracked file in a subdirectory of a staged path's directory" quiet "$r"

echo "── fires"
r=$(fresh_repo); echo b=2 >> "$r/setup.d/10-a.sh"; build "$r"; g -C "$r" add setup.d/10-a.sh
if bash "$r/scripts/build-getff-dist.sh" --check >/dev/null 2>&1; then
  ok "P1 precondition: the working-tree --check is GREEN (it cannot see the staging mistake)"
else bad "P1 precondition: working-tree --check unexpectedly RED"; fi
run "P1 working tree in sync, manifest not staged" fire "$r"
if grep -q 'MANIFEST.sha256 is not staged' <<<"$LAST_OUT"; then ok "P1 names the unstaged manifest"
else bad "P1 message does not name the unstaged manifest: $(tr '\n' '|' <<<"$LAST_OUT")"; fi

r=$(fresh_repo); echo b=2 >> "$r/setup.d/10-a.sh"; g -C "$r" add setup.d/10-a.sh
run "P2 payload staged, manifest never rebuilt" fire "$r"

# The #1625 shape: the new file sits next to the edited code that uses it.
r=$(fresh_repo); echo new > "$r/agents/new.md"; echo 'see new.md' >> "$r/agents/a.md"; build "$r"
g -C "$r" add agents/a.md packages/getff/MANIFEST.sha256
run "P3 new payload file left untracked next to the staged edit that uses it" fire "$r"
if grep -q 'agents/new.md' <<<"$LAST_OUT"; then ok "P3 names the untracked file"
else bad "P3 message does not name agents/new.md: $(tr '\n' '|' <<<"$LAST_OUT")"; fi

r=$(fresh_repo); echo b=2 >> "$r/setup.d/10-a.sh"; echo x >> "$r/templates/t.txt"; build "$r"
g -C "$r" add setup.d/10-a.sh packages/getff/MANIFEST.sha256
run "P4 partial stage: manifest built from two edits, one edit staged" fire "$r"

r=$(fresh_repo); g -C "$r" rm -q skills/s2.md
run "P5 payload deletion without the manifest" fire "$r"

r=$(fresh_repo); echo b=2 >> "$r/setup.d/10-a.sh"; build "$r"; g -C "$r" add packages/getff/MANIFEST.sha256
run "P6 manifest-only commit rebuilt from unstaged payload edits" fire "$r"

r=$(fresh_repo); ln -s a.md "$r/agents/link.md"; g -C "$r" add agents/link.md; build "$r"
g -C "$r" add packages/getff/MANIFEST.sha256
run "S1 tracked symlink under a payload root" fire "$r"
if grep -q 'could not run' <<<"$LAST_OUT" && grep -q 'symlink' <<<"$LAST_OUT"; then
  ok "S1 reported as «could not run» naming the symlink, not as a staging mistake"
else bad "S1 message: $(tr '\n' '|' <<<"$LAST_OUT")"; fi

echo "── index source"
# `git commit -a` builds a temporary index and hands the hook GIT_INDEX_FILE; the real
# .git/index stays untouched. Stage the payload edit ONLY into an alternate index: .git/index
# then carries nothing (a checker that ignored GIT_INDEX_FILE would stay quiet), while the
# alternate index carries payload without manifest → must fire.
r=$(fresh_repo); echo b=2 >> "$r/setup.d/10-a.sh"; build "$r"
cp "$r/.git/index" "$r/.git/alt-index"
GIT_INDEX_FILE="$r/.git/alt-index" g -C "$r" add setup.d/10-a.sh
run "I1 GIT_INDEX_FILE is honoured (alternate index: payload without manifest)" fire "$r" \
  GIT_INDEX_FILE="$r/.git/alt-index"

echo "── escape"
r=$(fresh_repo); echo b=2 >> "$r/setup.d/10-a.sh"; g -C "$r" add setup.d/10-a.sh
run "E1 escape rationale under 20 characters is refused" fire "$r" GETFF_MANIFEST_STAGED_ALLOW="too short"
why="operator-approved split: manifest lands in the next commit of this PR"
run "E2 escape with a real rationale passes" quiet "$r" GETFF_MANIFEST_STAGED_ALLOW="$why"
log="$(g -C "$r" rev-parse --git-common-dir)"; case "$log" in /*) ;; *) log="$r/$log" ;; esac
log="$log/getff-manifest-staged-allow.log"
if [ -f "$log" ] && grep -qF "$why" "$log"; then ok "E2 rationale logged to .git/getff-manifest-staged-allow.log"
else bad "E2 rationale not found in $log"; fi

echo "── payload list"
# A here-string, not `| grep -qx`: under pipefail an early-exiting grep can SIGPIPE the producer
# (scripts/check-pipefail-early-exit.mjs gates exactly that shape).
if grep -qx 'packages/core' <<<"$(bash "$REPO_ROOT/scripts/build-getff-dist.sh" --list-payload)"; then
  ok "L1 --list-payload prints the payload pathspecs"
else bad "L1 --list-payload lost packages/core"; fi

echo "── maintainer patch (.husky is agent-denied; the hook edit ships as a patch + apply script)"
# A1 is the drift alarm: another commit reshaping .husky/pre-commit before the maintainer applies
# the patch turns this RED in CI instead of leaving a patch nobody can apply.
if grep -qF 'scripts/check-getff-manifest-staged.sh' "$REPO_ROOT/.husky/pre-commit"; then
  ok "A1 .husky/pre-commit already runs the check (patch applied)"
elif (cd "$REPO_ROOT" && git apply --check scripts/check-getff-manifest-staged.precommit.patch 2>/dev/null); then
  ok "A1 the maintainer patch still applies to .husky/pre-commit"
else bad "A1 scripts/check-getff-manifest-staged.precommit.patch no longer applies — regenerate it"; fi

# A2-A4: the apply script in a fixture repo on `staging` — its test run stubbed to exit 0 (the real
# test is this file; running it from inside itself would recurse).
r=$(mktemp -d "$TMP/apply.XXXXXX"); mkdir -p "$r/scripts" "$r/.husky"
cp "$REPO_ROOT/scripts/apply-getff-manifest-staged-precommit.sh" "$REPO_ROOT/scripts/check-getff-manifest-staged.precommit.patch" \
  "$REPO_ROOT/scripts/check-getff-manifest-staged.sh" "$r/scripts/"
printf '#!/usr/bin/env bash\nexit 0\n' > "$r/scripts/check-getff-manifest-staged.test.sh"
if grep -qF 'scripts/check-getff-manifest-staged.sh' "$REPO_ROOT/.husky/pre-commit"; then
  # Already applied upstream: reverse the patch to rebuild the pre-image the script expects.
  cp "$REPO_ROOT/.husky/pre-commit" "$r/.husky/pre-commit"
  (cd "$r" && git apply -R scripts/check-getff-manifest-staged.precommit.patch)
else cp "$REPO_ROOT/.husky/pre-commit" "$r/.husky/pre-commit"; fi
PRE_IMAGE="$TMP/pre-commit.pre-image"; cp "$r/.husky/pre-commit" "$PRE_IMAGE"
g -C "$r" init -q -b staging; g -C "$r" add -A; g -C "$r" commit -qm base
# Identity, signing and hooks go into the fixture's own config: the script runs plain `git commit`.
git -C "$r" config user.name t; git -C "$r" config user.email t@t
git -C "$r" config commit.gpgsign false; git -C "$r" config core.hooksPath /dev/null
out=$(cd "$r" && APPLY_BASE_REF=staging bash scripts/apply-getff-manifest-staged-precommit.sh 2>&1) && rc=0 || rc=$?
files=$(g -C "$r" show --name-only --format= HEAD)
if [ "$rc" -eq 0 ] && [ "$files" = ".husky/pre-commit" ] \
  && [ "$(g -C "$r" rev-parse --abbrev-ref HEAD)" = "maintainer/precommit-getff-manifest-staged" ]; then
  ok "A2 apply script: branch off staging, one commit carrying .husky/pre-commit alone"
else bad "A2 apply script rc=$rc files=[$files]: $(tr '\n' '|' <<<"$out")"; fi
if bash -n "$r/.husky/pre-commit" && grep -qx 'exit "$fail"' <<<"$(tail -3 "$r/.husky/pre-commit")" \
  && grep -qF 'scripts/check-getff-manifest-staged.sh' "$r/.husky/pre-commit"; then
  ok "A3 patched hook parses, runs the check, still ends in exit \"\$fail\""
else bad "A3 patched hook malformed"; fi
before=$(g -C "$r" rev-parse HEAD)
out=$(cd "$r" && bash scripts/apply-getff-manifest-staged-precommit.sh 2>&1) && rc=0 || rc=$?
if [ "$rc" -eq 0 ] && [ "$(g -C "$r" rev-parse HEAD)" = "$before" ] && grep -q 'nothing to do' <<<"$out"; then
  ok "A4 apply script is idempotent"
else bad "A4 re-run rc=$rc: $(tr '\n' '|' <<<"$out")"; fi

r=$(mktemp -d "$TMP/apply.XXXXXX"); mkdir -p "$r/scripts" "$r/.husky"
cp "$REPO_ROOT/scripts/apply-getff-manifest-staged-precommit.sh" "$REPO_ROOT/scripts/check-getff-manifest-staged.precommit.patch" \
  "$REPO_ROOT/scripts/check-getff-manifest-staged.sh" "$r/scripts/"
printf '#!/usr/bin/env bash\nexit 0\n' > "$r/scripts/check-getff-manifest-staged.test.sh"
cp "$PRE_IMAGE" "$r/.husky/pre-commit"; echo 'notes' > "$r/README.md"
g -C "$r" init -q -b staging; g -C "$r" add -A; g -C "$r" commit -qm base
git -C "$r" config user.name t; git -C "$r" config user.email t@t
git -C "$r" config commit.gpgsign false; git -C "$r" config core.hooksPath /dev/null
echo dirty >> "$r/README.md"; before=$(g -C "$r" rev-parse HEAD)
out=$(cd "$r" && APPLY_BASE_REF=staging bash scripts/apply-getff-manifest-staged-precommit.sh 2>&1) && rc=0 || rc=$?
if [ "$rc" -ne 0 ] && [ "$(g -C "$r" rev-parse HEAD)" = "$before" ] && g -C "$r" diff --quiet -- .husky/pre-commit \
  && [ "$(g -C "$r" rev-parse --abbrev-ref HEAD)" = "staging" ]; then
  ok "A5 dirty tracked tree refused, nothing committed, hook and branch untouched"
else bad "A5 rc=$rc: $(tr '\n' '|' <<<"$out")"; fi

git -C "$r" checkout -q -- README.md
printf '#!/usr/bin/env bash\necho reshaped\nexit 0\n' > "$r/.husky/pre-commit"; g -C "$r" commit -qam reshape
out=$(cd "$r" && APPLY_BASE_REF=staging bash scripts/apply-getff-manifest-staged-precommit.sh 2>&1) && rc=0 || rc=$?
if [ "$rc" -ne 0 ] && [ "$(g -C "$r" rev-parse --abbrev-ref HEAD)" = "staging" ] \
  && ! g -C "$r" show-ref --verify -q refs/heads/maintainer/precommit-getff-manifest-staged \
  && [ -z "$(g -C "$r" status --porcelain --untracked-files=no)" ] && grep -q 'no longer applies' <<<"$out"; then
  ok "A6 unappliable patch rolls back cleanly (start branch, no maintainer branch, clean tree)"
else bad "A6 rc=$rc branch=$(g -C "$r" rev-parse --abbrev-ref HEAD): $(tr '\n' '|' <<<"$out")"; fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
