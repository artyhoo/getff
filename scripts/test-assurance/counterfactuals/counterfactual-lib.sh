#!/usr/bin/env bash
# Shared helpers for the S1 Batch-D counterfactual replay scripts (Task 6).
#
# Exit-code contract (T-TAK-A — infrastructure never counts as detection):
#   0  pinned demonstration reproduced
#   1  COUNTERFACTUAL-FAIL    demonstration did NOT reproduce (detection gap / oracle drift)
#   3  INFRASTRUCTURE-FAILURE missing binary, spawn error, unreadable report, etc.
#
# All patches are applied by node (portable across linux/macOS, no `sed -i` dialect
# split) with an exactly-once occurrence assertion and the same sha256 convention as
# principle 52: patchSha256 = sha256(label \n from \n to), plus before/after file hashes.
#
# Spec: docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md §6.

set -uo pipefail

unset CI CLAUDECODE CLAUDE_CODE_ENTRYPOINT
# An ambient GIT_DIR-family variable overrides `git -C` repo discovery and can point the
# replays' scratch worktree/blob reads at a foreign repository — same scrub as the driver's
# git spawns (driver.mjs gitEnv; review round 5 [b23c79f70838]).
unset GIT_DIR GIT_COMMON_DIR GIT_WORK_TREE GIT_INDEX_FILE
export FORCE_COLOR=0

CF_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CF_REPO_ROOT="$(cd "$CF_LIB_DIR/../../.." && pwd)"
CF_VITEST="$CF_REPO_ROOT/node_modules/.bin/vitest"
CF_TSX="$CF_REPO_ROOT/node_modules/.bin/tsx"

die() { echo "COUNTERFACTUAL-FAIL: $*" >&2; exit 1; }
infra() { echo "INFRASTRUCTURE-FAILURE: $*" >&2; exit 3; }

require_bin() {
  case "$1" in
    */*) [ -x "$1" ] || infra "required binary missing or not executable: $1" ;;
    *) command -v "$1" >/dev/null 2>&1 || infra "required binary not found on PATH: $1" ;;
  esac
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d' ' -f1
  else
    infra "no sha256 tool available (sha256sum/shasum)"
  fi
}

hash_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | cut -d' ' -f1
  else
    infra "no sha256 tool available (sha256sum/shasum)"
  fi
}

# apply_patch_once FILE FROM TO LABEL
# Replaces the FIRST occurrence of FROM with TO in FILE — but only if FROM occurs
# EXACTLY ONCE (an unproven counterfactual must never run). Prints PATCH lines.
apply_patch_once() {
  local file="$1" from="$2" to="$3" label="$4"
  [ -f "$file" ] || infra "patch target missing: $file"
  node -e '
    const fs = require("node:fs");
    const crypto = require("node:crypto");
    const [file, from, to, label] = process.argv.slice(1);
    const before = fs.readFileSync(file, "utf8");
    const occurrences = before.split(from).length - 1;
    if (occurrences !== 1) {
      console.error(`COUNTERFACTUAL-FAIL: patch "${label}" does not apply exactly once to ${file} (occurrences=${occurrences})`);
      process.exit(1);
    }
    fs.writeFileSync(file, before.replace(from, to));
    const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
    console.log(`PATCH-LABEL ${label}`);
    console.log(`PATCH-SHA256 ${sha(label + "\n" + from + "\n" + to)}`);
    console.log(`PATCH-BEFORE-SHA256 ${sha(before)}`);
    console.log(`PATCH-AFTER-SHA256 ${sha(fs.readFileSync(file, "utf8"))}`);
    console.log(`PATCH-OCCURRENCES ${occurrences}`);
  ' "$file" "$from" "$to" "$label" || die "patch application refused for $file (see above)"
}

# restore_file FILE SOURCE — copy SOURCE over FILE and prove byte identity.
restore_file() {
  local file="$1" source="$2"
  cp "$source" "$file" || infra "restore copy failed: $source -> $file"
  local h1 h2
  h1="$(hash_file "$file")"
  h2="$(hash_file "$source")"
  [ "$h1" = "$h2" ] || die "restoration mismatch for $file (${h1:0:12} != ${h2:0:12})"
  echo "RESTORED $file sha256=$h1"
}

# run_scratch_vitest SCRATCH PHASE FILTER... — real vitest run with a JSON report;
# prints VITEST-RC + per-file FILE/MSG lines. Any-failure rc (1) is a legitimate
# outcome the CALLER asserts; only spawn/infra problems exit 3 here.
run_scratch_vitest() {
  local scratch="$1" phase="$2"
  shift 2
  [ "$#" -gt 0 ] || infra "refusing to run an empty selection (T-TAK-A)"
  local report="$scratch/report-$phase.json"
  ( cd "$scratch" && "$CF_VITEST" run "$@" --reporter=default --reporter=json --outputFile.json="$report" ) >"$scratch/stdout-$phase.log" 2>&1
  local rc=$?
  [ -f "$report" ] || infra "vitest produced no JSON report (rc=$rc) — result cannot be verified"
  echo "VITEST-RC $phase $rc"
  echo "VITEST-STDOUT $scratch/stdout-$phase.log"
  node -e '
    const fs = require("node:fs");
    const [report, stdoutPath, rcRaw] = process.argv.slice(1);
    const rc = Number(rcRaw);
    const stdout = fs.readFileSync(stdoutPath, "utf8");
    const parsed = JSON.parse(fs.readFileSync(report, "utf8"));
    const results = parsed.testResults ?? [];
    if (results.length === 0) {
      console.error("INFRASTRUCTURE-FAILURE: vitest JSON report carries zero test files — empty discovery is never green [T-TAK-A]");
      process.exit(3);
    }
    // D011-R4 shell consistency (chief admission 2026-10-14; independent review
    // counterexamples D011-R4-SHELL-UNHANDLED / D011-R4-SHELL-INCOMPLETE): the
    // reporter unhandled-error channel is infrastructure — the exact production
    // classifier predicate (classifyVitestReport Errors-line check) mirrored in
    // the shell, so a real unhandled rejection is never a pass.
    if (/(^|\n)\s*Errors\s+[1-9]\d*/.test(stdout)) {
      console.error("INFRASTRUCTURE-FAILURE: unhandled runner error present (reporter Errors line) — mixed intended-failure+unhandled is infrastructure, never an accepted pass (D011 S1-R6)");
      process.exit(3);
    }
    // Exit/report consistency: a nonzero runner exit (or success=false) with ZERO
    // failed assertions AND zero failed files is an unhandled runner error, never a
    // legitimate outcome. rc=1 WITH failed assertions stays legitimate — the caller
    // asserts it. The one exempt shape is the pre-existing whole-suite crash lane
    // (delivery replay-fences-fire-deletion): a FILE that failed at import carries
    // zero assertionResults and its evidence in the file message — assertable via
    // expect_intended, never a silent pass (fences-fire lane preserved, D011-R4).
    let anyFailedAssertion = false;
    let anyFailedFile = false;
    for (const tr of results) {
      anyFailedAssertion = anyFailedAssertion || (tr.assertionResults ?? []).some((a) => a.status === "failed");
      anyFailedFile = anyFailedFile || tr.status === "failed";
    }
    if (!anyFailedAssertion && !anyFailedFile && (rc !== 0 || parsed.success === false)) {
      console.error(`INFRASTRUCTURE-FAILURE: runner exit/report inconsistency: rc=${rc} success=${String(parsed.success)} with zero failed assertions and zero failed files — an unhandled runner error is never a pass (D011 S1-R4; whole-suite crashes stay assertable via their file message)`);
      process.exit(3);
    }
    for (const tr of results) {
      const name = (tr.name ?? "").split("/").pop();
      const msgs = (tr.assertionResults ?? [])
        .filter((a) => a.status === "failed")
        .flatMap((a) => a.failureMessages ?? []);
      // D011 S1-R4 mirror: a file whose required cases never executed is NOT green
      // evidence — it reports its own status, never a borrowed "pass" (amended-2).
      // D011-R4: same-file incomplete execution is independent of file failure — a
      // failed file with a pending/skipped required case is still not-executed (A3 cx3).
      const statuses = (tr.assertionResults ?? []).map((a) => a.status);
      const executed = statuses.filter((s) => s === "passed" || s === "failed").length;
      const never = statuses.filter((s) => s === "pending" || s === "skipped" || s === "todo").length;
      const fileClass = never > 0 || executed === 0
        ? "not-executed"
        : tr.status === "failed" ? "fail" : "pass";
      console.log(`FILE ${name} ${fileClass}`);
      for (const m of msgs) console.log(`  MSG ${m.split("\n").slice(0, 4).join(" | ").slice(0, 240)}`);
    }
  ' "$report" "$scratch/stdout-$phase.log" "$rc" || exit 3
}

# expect_file_status REPORT BASENAME pass|fail — the report MUST carry the file
# (a missing result is an empty/partial discovery, never a green [T-TAK-A]).
expect_file_status() {
  local report="$1" file="$2" want="$3"
  node -e '
    const fs = require("node:fs");
    const [report, file, want] = process.argv.slice(1);
    const r = JSON.parse(fs.readFileSync(report, "utf8"));
    const tr = (r.testResults ?? []).find((t) => (t.name ?? "").split("/").pop() === file);
    if (!tr) {
      console.error(`COUNTERFACTUAL-FAIL: report carries NO result for ${file} — selection/observed mismatch [T-TAK-A]`);
      process.exit(1);
    }
    const got = tr.status === "failed" ? "fail" : "pass";
    const statuses = (tr.assertionResults ?? []).map((a) => a.status);
    const executed = statuses.filter((s) => s === "passed" || s === "failed").length;
    const never = statuses.filter((s) => s === "pending" || s === "skipped" || s === "todo").length;
    // D011-R4: same-file incomplete execution is refused regardless of file failure
    // (A3 cx3: never>0 fires beside failed assertions). The ONE exempt shape is the
    // whole-suite crash lane — a failed file with zero assertionResults whose evidence
    // lives in `message`, assertable ONLY through the expect_intended fallback.
    const suiteCrash = tr.status === "failed" && executed === 0
      && typeof tr.message === "string" && tr.message.length > 0;
    if (never > 0 || (executed === 0 && !suiteCrash)) {
      console.error(`COUNTERFACTUAL-FAIL: ${file} was NOT executed (${never} never-run, ${executed} executed assertions) — a required case that never ran is never pass and never a kill; a whole-suite crash is assertable ONLY via the intended-text message fallback [D011 S1-R4, A3 cx3; fences-fire lane preserved]`);
      process.exit(1);
    }
    if (got !== want) {
      console.error(`COUNTERFACTUAL-FAIL: ${file} expected ${want}, got ${got}`);
      process.exit(1);
    }
    console.log(`OK file-status ${file}=${want}`);
  ' "$report" "$file" "$want" || die "file-status assertion failed: $file want=$want"
}

# expect_intended REPORT BASENAME PATTERN — a killed case counts ONLY if the
# intended assertion text appears in its failure messages (K7; crash-RED ≠ kill).
# Suite-level failures (an import-time throw, e.g. the fences-fire fixture deletion)
# carry their error in the FILE's `message`, not in assertionResults — searched as a
# fallback so a whole-suite crash is still assertable against its intended text.
expect_intended() {
  local report="$1" file="$2" pattern="$3"
  node -e '
    const fs = require("node:fs");
    const [report, file, pattern] = process.argv.slice(1);
    const r = JSON.parse(fs.readFileSync(report, "utf8"));
    const tr = (r.testResults ?? []).find((t) => (t.name ?? "").split("/").pop() === file);
    if (!tr) {
      console.error(`COUNTERFACTUAL-FAIL: report carries NO result for ${file} [T-TAK-A]`);
      process.exit(1);
    }
    const msgs = (tr.assertionResults ?? [])
      .filter((a) => a.status === "failed")
      .flatMap((a) => a.failureMessages ?? []);
    if (typeof tr.message === "string" && tr.message.length > 0) msgs.push(tr.message);
    const statuses = (tr.assertionResults ?? []).map((a) => a.status);
    const executed = statuses.filter((s) => s === "passed" || s === "failed").length;
    const never = statuses.filter((s) => s === "pending" || s === "skipped" || s === "todo").length;
    // D011-R4: same carve-out as expect_file_status — cx3 (pending beside a failed
    // assertion) is refused by never>0; a whole-suite crash (zero assertionResults,
    // evidence in `message` — the fences-fire lane) matches via the pushed message.
    const suiteCrash = tr.status === "failed" && executed === 0
      && typeof tr.message === "string" && tr.message.length > 0;
    if (never > 0 || (executed === 0 && !suiteCrash)) {
      console.error(`COUNTERFACTUAL-FAIL: ${file} was NOT executed (${never} never-run, ${executed} executed) — nothing observable to match /${pattern}/; a whole-suite crash matches ONLY through its file-level message [D011 S1-R4, A3 cx3; fences-fire lane preserved]`);
      process.exit(1);
    }
    const re = new RegExp(pattern);
    if (!msgs.some((m) => re.test(m))) {
      console.error(`COUNTERFACTUAL-FAIL: ${file} failed WITHOUT the intended assertion /${pattern}/ — a crash-RED is not a kill (K7)`);
      process.exit(1);
    }
    console.log(`OK intended-assertion ${file} /${pattern}/`);
  ' "$report" "$file" "$pattern" || die "intended-assertion assertion failed: $file /$pattern/"
}

# expect_tsx_probe PROBEFILE EXPECTED-SUBSTRING — run a reachability probe and
# require its stdout to contain the expected observation.
expect_tsx_probe() {
  local probe="$1" want="$2"
  [ -f "$probe" ] || infra "probe file missing: $probe"
  local out
  out="$("$CF_TSX" "$probe" 2>"$probe.err")" || infra "reachability probe crashed: $(tail -3 "$probe.err" | tr "\n" " ")"
  rm -f "$probe.err"
  echo "$out"
  echo "$out" | grep -qF "$want" || die "reachability probe did not show '$want' — fault not proven reached"
  echo "OK probe $probe → $want"
}

echo "CF-LIB repo=$CF_REPO_ROOT"
require_bin "$CF_VITEST"
require_bin "$CF_TSX"
require_bin node
