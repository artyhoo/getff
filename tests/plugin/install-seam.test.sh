#!/usr/bin/env bash
# S5 acceptance — the /install-enforcement hybrid seam (Option C: fetch the official installer).
# spec: docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md §6
#
# Proves plugin/install/fetch-and-wire.sh against a LOCAL installer source (offline, deterministic
# — RAT_INSTALL_SOURCE points at the repo root, used in place; no network clone in CI):
#   (1) dry-run (default) exits 0, previews a plan, and writes NOTHING to the consumer
#   (2) --apply wires the HARD layer — creates .husky/pre-commit + .husky/pre-push in the consumer
#   (3) an unknown flag is rejected (exit 2)
#   (4) the command + skill artifacts exist and reference the seam
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
SEAM="$REPO_ROOT/plugin/install/fetch-and-wire.sh"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Fresh throwaway consumer repo (git + package.json — install.sh wires git hooks).
mk_consumer() {
  local d; d=$(mktemp -d "${TMPDIR:-/tmp}/rat-seam-consumer.XXXXXX") || return 1
  ( cd "$d" && git init -q && git config user.email t@t && git config user.name t ) || return 1
  printf '{"name":"tw","version":"0.0.0"}' > "$d/package.json" || return 1
  printf '%s' "$d"
}

# Observe the whole consumer boundary, including hidden/ignored state. Reading may
# update access time, so that observational field is deliberately not compared.
consumer_snapshot() {
  node --input-type=commonjs - "$1" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2]);
const rows = [];
function walk(absolute, relative) {
  const stat = fs.lstatSync(absolute, { bigint: true });
  const kind = stat.isSymbolicLink() ? 'symlink'
    : stat.isDirectory() ? 'directory'
    : stat.isFile() ? 'file' : null;
  if (!kind) throw new Error('Unsupported consumer filesystem entry: ' + relative);
  const row = { path: relative, kind };
  for (const key of ['mode', 'uid', 'gid', 'dev', 'ino', 'nlink', 'size',
    'mtimeNs', 'ctimeNs', 'birthtimeNs']) row[key] = stat[key].toString();
  if (kind === 'file') {
    row.sha256 = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
  } else if (kind === 'symlink') {
    row.target = fs.readlinkSync(absolute);
  }
  rows.push(row);
  if (kind === 'directory') {
    for (const name of fs.readdirSync(absolute).sort()) {
      walk(path.join(absolute, name), relative === '.' ? name : relative + '/' + name);
    }
  }
}
walk(root, '.');
process.stdout.write(JSON.stringify(rows) + '\n');
NODE
}

# (1) dry-run: exits 0, previews, writes nothing -----------------------------
C1=$(mk_consumer) || { bad "INFRA: cannot create dry-run consumer"; exit 1; }
# Legitimate existing states are retained, including data Git ignores and a link.
mkdir -p "$C1/.a08-ignored" "$C1/.a08-empty" || { bad "INFRA: fixture directories"; exit 1; }
printf '.a08-ignored/\n' > "$C1/.gitignore" || { bad "INFRA: fixture ignore"; exit 1; }
printf 'retained ignored data\n' > "$C1/.a08-ignored/data.txt" || { bad "INFRA: fixture data"; exit 1; }
printf '#!/bin/sh\nexit 0\n' > "$C1/.a08-executable" || { bad "INFRA: fixture executable"; exit 1; }
chmod 750 "$C1/.a08-executable" || { bad "INFRA: fixture mode"; exit 1; }
ln -s package.json "$C1/.a08-link" || { bad "INFRA: fixture symlink"; exit 1; }
BEFORE=$(consumer_snapshot "$C1") || { bad "INFRA: consumer snapshot before dry-run"; exit 1; }
OUT=$(CLAUDE_PROJECT_DIR="$C1" RAT_INSTALL_SOURCE="$REPO_ROOT" bash "$SEAM" ts-server </dev/null 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "dry-run exits 0" || bad "dry-run exit=$rc"
# `grep -c`, not `grep -q`: under pipefail an early-exit grep SIGPIPEs the writer into
# rc=141 and the `&&` reads the match as a failure — the canonical corpus pushed the
# preview past the pipe buffer (the getff-dist-canonical-links grep-consumption idiom).
printf '%s' "$OUT" | grep -ciE 'dry-run|preview' >/dev/null && ok "dry-run prints a preview" || bad "dry-run printed no preview"
AFTER=$(consumer_snapshot "$C1") || { bad "INFRA: consumer snapshot after dry-run"; exit 1; }
# Full retained receipts come from actual disk observations, not source tokens.
printf 'A08-FS-CONSUMER=%s\nA08-FS-BEFORE=%s\nA08-FS-AFTER=%s\n' "$C1" "$BEFORE" "$AFTER"
[ "$BEFORE" = "$AFTER" ] && ok "dry-run preserved full consumer filesystem" || bad "dry-run changed consumer filesystem"

# (2) --apply: wires the hard layer ------------------------------------------
C2=$(mk_consumer) || { bad "INFRA: cannot create apply consumer"; exit 1; }
A_OUT=$(CLAUDE_PROJECT_DIR="$C2" RAT_INSTALL_SOURCE="$REPO_ROOT" bash "$SEAM" ts-server --apply </dev/null 2>&1); rc=$?
[ "$rc" -eq 0 ] && ok "--apply exits 0" || bad "--apply exit=$rc (output: $(printf '%s' "$A_OUT" | tail -3))"
[ -f "$C2/.husky/pre-commit" ] && ok "--apply created .husky/pre-commit" || bad "--apply did not create .husky/pre-commit"
[ -f "$C2/.husky/pre-push" ] && ok "--apply created .husky/pre-push" || bad "--apply did not create .husky/pre-push"

# (3) unknown flag rejected ---------------------------------------------------
CLAUDE_PROJECT_DIR="$C1" RAT_INSTALL_SOURCE="$REPO_ROOT" bash "$SEAM" --bogus </dev/null >/dev/null 2>&1
[ "$?" -eq 2 ] && ok "unknown flag exits 2" || bad "unknown flag not rejected with exit 2"

# (4) command + skill artifacts exist and reference the seam ------------------
CMD="$REPO_ROOT/plugin/commands/install-enforcement.md"
SK="$REPO_ROOT/plugin/skills/installing-enforcement/SKILL.md"
[ -f "$CMD" ] && grep -q 'fetch-and-wire' "$CMD" && ok "command references the seam helper" || bad "command missing or does not reference fetch-and-wire"
[ -f "$SK" ] && grep -qiE 'hard|enforcement' "$SK" && ok "installing-enforcement skill present" || bad "installing-enforcement skill missing/empty"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
