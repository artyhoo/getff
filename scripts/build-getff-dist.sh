#!/usr/bin/env bash
# build-getff-dist.sh — assemble the `getff` distribution package (packages/getff) from the repo root.
#
# WHY A COPY, NOT A MOVE. install.sh reads everything relative to PKG_ROOT — the directory it
# lives in (install.sh:55) — and setup.d/*.sh follow: packages/core (71 refs), templates/,
# .claude/hooks, packages/preset-*, scripts/, skills/, setup.d/, agents/, .prettierrc.json
# (measured in docs/meta-factory/getff-name-architecture-freeze.md §2 §0.5; scripts/ = the six
# files actually read, see PAYLOAD). A tarball that lays
# its contents out exactly like the repository root makes PKG_ROOT land where the script already
# looks, and not one of those reads changes. `files` cannot reach above a package's own directory,
# so the payload is COPIED into packages/getff/ at pack time (npm `prepack`, and this script).
# install.sh itself never moves: tests/install-sh/*.sh reference its root path 215 times.
#
# WHAT IS COMMITTED. Not the payload (gitignored in packages/getff/.gitignore) — MANIFEST.sha256,
# one `<sha256>  <path>` line per npm-delivered payload file; the six source witnesses below
# remain checked separately. `--check` re-assembles into a temp dir and diffs
# the manifests: a shipped file edited without re-running this script is DRIFT, exit 1, the paths
# listed. Same shape as scripts/build-synth-bundle.sh --check (the in-repo precedent).
#
# SOURCE OF TRUTH FOR THE FILE LIST: `git ls-files` (tracked files only). A directory walk would
# ship whatever is lying in the working tree — node_modules, a scratch file, a secret
# (kickoff npm-publish-getff-init §5 T-U10-B).
#
# Usage:
#   scripts/build-getff-dist.sh            # assemble packages/getff/ + rewrite MANIFEST.sha256
#   scripts/build-getff-dist.sh --check    # drift gate: exit 1 if committed manifest != fresh assembly,
#                                          # or the actual npm archive loses/changes/adds any member
#   scripts/build-getff-dist.sh --check-packed <tgz> # verify a normal pack against independent source bytes
#   scripts/build-getff-dist.sh --list-payload   # one PAYLOAD pathspec per line, for callers that
#                                          # need to ask "is this changed path shipped?" without
#                                          # keeping a second copy of the list (pre-push payload-drift)
#
# Runs from any cwd (root derived from this file's location). Bash 3.2-compatible (macOS default).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PKG="$ROOT/packages/getff"
MANIFEST="$PKG/MANIFEST.sha256"

# Every path the installer reads from PKG_ROOT, plus the two entry scripts. Adding a root here
# requires the same root in packages/getff/package.json `files` (checked below) and in
# packages/getff/.gitignore (or the copy would be committed).
# scripts/: the SHIPPED SUBSET only — six files, five of which install.sh / setup.d read from PKG_ROOT
# (install.sh:1234 + the worktree cluster install.sh:1260-1265 / setup.d/85-worktree-scripts.sh:50-55;
# check-ask-files.sh is no longer read from PKG_ROOT — install.sh:1228 only reports a stale consumer copy).
# Not the whole tree: factory-only scripts (measure-*, render-*, *.test.sh, this assembler) would
# couple every framework PR to the drift gate and ship operator tooling to consumers.
PAYLOAD="install.sh setup setup.d agents skills templates .agents/procedures .agents/roles .agents/rules .agents/hooks .agents/session-bootstrap.md .agents/checks .claude/hooks .claude/skills .claude/templates .prettierrc.json packages/core packages/preset-next-15-canonical packages/preset-react-spa packages/preset-react-native packages/runtime-bridge scripts/check-ask-files.sh scripts/run-local-ci-sweep.sh scripts/create-worktree.sh scripts/worktree-node-modules.sh scripts/link-coordination.sh scripts/getff-work.sh scripts/codex-hook-adapter.mjs scripts/lib/is-main-entry.mjs scripts/lib/codex-hooks.mjs scripts/docs-check.mjs scripts/render-terms-style.mjs scripts/lib/mermaid-allowlist.mjs scripts/snapshot-for-seat.sh scripts/check-arch-retell.mjs docs/site-quality docs/site/terms.md plugin/hooks/lib/hook-language.sh"
# Their top-level roots as `files` must spell them.
PAYLOAD_TOP="install.sh setup setup.d agents skills templates .agents .claude .prettierrc.json packages scripts plugin docs"

# D018: npm omits these six fixture VCS metadata files. Keep their canonical
# source bytes checked even though the delivered manifest cannot include them.
NPM_SOURCE_EXCLUSIONS="packages/core/backends/cargo/demo/crate/.gitignore
packages/core/backends/cargo/fixtures/firing/invalid/.gitignore
packages/core/backends/cargo/fixtures/firing/valid-clean/.gitignore
packages/core/backends/cargo/fixtures/firing/valid/.gitignore
packages/core/synthesizer/fixtures/live-generation/rust/firing/bad/.gitignore
packages/core/synthesizer/fixtures/live-generation/rust/firing/good/.gitignore"

if command -v sha256sum >/dev/null 2>&1; then
  SHA="sha256sum"
else
  SHA="shasum -a 256"
fi

fail() { echo "ERROR: $*" >&2; exit 1; }

source_exclusions_check() {
  node - "$ROOT" "$1" "$NPM_SOURCE_EXCLUSIONS" <<'NODE'
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
try {
  const [root, source, exclusions] = process.argv.slice(2);
  const names = exclusions.split('\n'), indexed = new Map();
  const entries = cp.execFileSync('git', ['-C', root, 'ls-files', '--stage', '-z', '--', ...names], {encoding:'utf8'});
  for (const row of entries.split('\0').filter(Boolean)) {
    const tab = row.indexOf('\t'), file = row.slice(tab + 1), tuple = row.slice(0, tab).split(' ');
    if (!indexed.has(file)) indexed.set(file, []);
    indexed.get(file).push(tuple);
  }
  for (const file of exclusions.split('\n')) {
    const tuples = indexed.get(file) || [];
    if (!tuples.length) throw Error(`untracked canonical fixture ignore: ${file}`);
    if (tuples.length !== 1 || tuples[0][2] !== '0' || !['100644','100755'].includes(tuples[0][0])) {
      throw Error(`canonical fixture ignore requires unique regular stage-0 index entry: ${file}`);
    }
    const input = path.join(source, file);
    if (!fs.lstatSync(input).isFile()) throw Error(`canonical fixture ignore is not regular: ${file}`);
    const sha = crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');
    if (sha !== '44c92e3a70ad3307b7056871c2bdb096d8bfa9373f5bf06a79bb6324a20ff2fb') throw Error(`canonical fixture ignore changed: ${file}`);
  }
} catch (error) { console.error(`SOURCE: ${error.message}`); process.exit(1); }
NODE
}

# Metadata is required and independently byte-bound, not a tamper exception.
package_prepare() {
  local dest="$1" file
  mkdir -p "$dest/bin"
  for file in LICENSE README.md bin/getff package.json; do
    git -C "$ROOT" ls-files --error-unmatch "packages/getff/$file" >/dev/null 2>&1 \
      || fail "SOURCE: package metadata not tracked: $file"
    cp -p "$PKG/$file" "$dest/$file"
  done
}

# Inspect every header before extraction; system tar handles npm's PAX headers.
# Expected manifest and metadata come from independent source assembly, never the tar.
packed_check() {
  node - "$1" "$2" "$NPM_SOURCE_EXCLUSIONS" <<'NODE'
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), cp = require('child_process');
let extracted;
try {
  const [archive, expectedRoot, exclusions] = process.argv.slice(2);
  const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const expected = new Map();
  const omitted = new Set(exclusions.split('\n'));
  const safe = name => name && !name.startsWith('/') && !/[\r\n\\]/.test(name) && name.split('/').every(p => p && p !== '.' && p !== '..');
  const manifest = fs.readFileSync(path.join(expectedRoot, 'MANIFEST.sha256'), 'utf8');
  for (const line of manifest.trimEnd().split('\n')) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match || !safe(match[2]) || omitted.has(match[2]) || expected.has(match[2])) throw Error('invalid independent payload manifest');
    expected.set(match[2], match[1]);
  }
  for (const file of ['LICENSE','MANIFEST.sha256','README.md','bin/getff','package.json']) {
    if (expected.has(file)) throw Error(`metadata overlaps payload rows: ${file}`);
    expected.set(file, hash(path.join(expectedRoot, file)));
  }
  const tar = args => cp.execFileSync('tar', args, {encoding:'utf8',maxBuffer:32*1024*1024});
  const members = tar(['-tzf', archive]).trimEnd().split('\n');
  const headers = tar(['-tvzf', archive]).trimEnd().split('\n');
  if (headers.length !== members.length || headers.some(line => !line.startsWith('-'))) throw Error('nonregular archive member');
  const seen = new Set();
  for (const member of members) {
    if (!member.startsWith('package/') || !safe(member.slice(8))) throw Error(`unsafe archive path: ${member}`);
    const file = member.slice(8);
    if (seen.has(file)) throw Error(`duplicate archive member: ${file}`);
    if (!expected.has(file)) throw Error(`unexpected archive member: ${file}`);
    seen.add(file);
  }
  for (const file of expected.keys()) if (!seen.has(file)) throw Error(`missing archive member: ${file}`);
  extracted = fs.mkdtempSync(path.join(os.tmpdir(), 'getff-packed-check-'));
  cp.execFileSync('tar', ['-xzf', archive, '-C', extracted]);
  for (const [file, sha] of expected) {
    const input = path.join(extracted, 'package', file);
    if (!fs.lstatSync(input).isFile() || hash(input) !== sha) throw Error(`changed archive member: ${file}`);
  }
  console.log(`✓ actual npm archive matches independent payload and five metadata entries (${expected.size} files)`);
} catch (error) { console.error(`PACKED: ${error.message}`); process.exitCode = 1; }
finally { if (extracted) fs.rmSync(extracted, {recursive:true,force:true}); }
NODE
}

# assemble <dest>: wipe the payload roots under <dest>, then copy every tracked payload file.
assemble() {
  local dest="$1" top
  for top in $PAYLOAD_TOP; do
    rm -rf "${dest:?}/$top"
  done
  materialize "$ROOT" "$dest"

}

# npm drops symbolic links. Copy resolved bytes from tracked, payload-contained
# targets, identically for the working tree and the index checkout. Fail closed on
# links outside the payload instead of leaking a local source/helper dependency.
materialize() {
  # Check authored source/index entries before resolving ordinary compatibility links.
  # Otherwise a canonical ignore symlink could hide behind materialized regular bytes.
  source_exclusions_check "$1" || return 1
  node - "$ROOT" "$1" "$2" "$PAYLOAD" <<'NODE'
const fs = require('fs'), path = require('path'), cp = require('child_process');
const [root, source, destination, payload] = process.argv.slice(2);
const result = cp.spawnSync('git', ['-C', root, 'ls-files', '-z', '--', ...payload.split(' ')], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || 'git ls-files failed');
const files = result.stdout.split('\0').filter(Boolean), tracked = new Set(files);
const sourceRoot = fs.realpathSync(source);
for (const file of files) {
  const input = path.join(source, file);
  const resolved = fs.realpathSync(input);
  const relative = path.relative(sourceRoot, resolved).split(path.sep).join('/');
  if (relative.startsWith('../') || path.isAbsolute(relative) || !tracked.has(relative)) {
    throw new Error(`payload link must resolve to a tracked payload file: ${file} -> ${resolved}`);
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`tracked payload file missing or not regular: ${file}`);
  const output = path.join(destination, file);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(resolved, output);
  fs.chmodSync(output, stat.mode);
  fs.utimesSync(output, stat.atime, stat.mtime);
}
NODE
}

# manifest <dest>: `<sha256>  <path>` for delivered payload files, byte-stable order.
#
# The trailing sed normalises the separator, NOT the hash. GNU coreutils marks binary-mode
# reads with `<sha> *<path>`, and on Git Bash (MSYS2) every read is binary — so the same bytes
# that yield `<sha>  <path>` on a Linux runner yield `<sha> *<path>` on windows-latest, and
# `--check` reported all 1081 payload files as drift on a Windows clone while every hash in fact
# matched (measured 2026-09-14: .claude/hooks/adopt-orchestrator-prompts.sh = fb86ebab… on both
# sides). On Linux and macOS the pattern never matches and the output is unchanged.
manifest() {
  local dest="$1"
  source_exclusions_check "$dest" || return 1
  # shellcheck disable=SC2086  # PAYLOAD_TOP / SHA are deliberate word-split lists
  ( cd "$dest" && find $PAYLOAD_TOP -type f -print0 | LC_ALL=C sort -z | xargs -0 $SHA ) \
    | sed "s/^\([0-9a-f]\{64\}\) \*/\1  /" \
    | node -e '
      const omitted = new Set(process.argv[1].split("\n"));
      let input=""; process.stdin.setEncoding("utf8"); process.stdin.on("data", x=>input+=x);
      process.stdin.on("end",()=>{for(const line of input.trimEnd().split("\n")) if(!omitted.has(line.slice(66))) console.log(line);});
    ' "$NPM_SOURCE_EXCLUSIONS"
}

# files_check: every PAYLOAD_TOP root must be spelled in package.json `files` — a dropped entry
# would silently shrink the tarball while the manifest stayed green.
files_check() {
  local missing
  missing="$(node -e '
    const files = require(process.argv[1] + "/package.json").files || [];
    const norm = (s) => s.replace(/\/+$/, "");
    const have = new Set(files.map(norm));
    const want = process.argv[2].split(" ");
    const miss = want.filter((w) => !have.has(w));
    if (miss.length) { console.log(miss.join("\n")); process.exit(1); }
  ' "$PKG" "$PAYLOAD_TOP" 2>&1)" || {
    echo "DRIFT: packages/getff/package.json \`files\` does not list these payload roots:" >&2
    # shellcheck disable=SC2086  # one line per missing root
    printf '  %s\n' $missing >&2
    return 1
  }
}

MODE="${1:-build}"
case "$MODE" in
  --check|--check-packed)
    archive=""
    if [ "$MODE" = --check-packed ]; then
      [ "$#" -eq 2 ] || { echo 'usage: scripts/build-getff-dist.sh --check-packed <tgz>' >&2; exit 2; }
      archive="$(node -e 'console.log(require("path").resolve(process.argv[1]))' "$2")"
    fi
    [ -f "$MANIFEST" ] || fail "DRIFT: $MANIFEST missing — run: scripts/build-getff-dist.sh"
    files_check || exit 1
    tmp="$(mktemp -d "${TMPDIR:-/tmp}/getff-dist-check.XXXXXX")"
    trap 'rm -rf "$tmp"; rm -f "$tmp.manifest"' EXIT
    assemble "$tmp"
    manifest "$tmp" > "$tmp.manifest"
    if ! diff -q "$MANIFEST" "$tmp.manifest" >/dev/null 2>&1; then
      echo "DRIFT: packages/getff/MANIFEST.sha256 differs from a fresh assembly of the repo root:" >&2
      diff "$MANIFEST" "$tmp.manifest" | grep -E '^[<>]' | sed -E 's/^< ([0-9a-f]+)  /  committed  /; s/^> ([0-9a-f]+)  /  fresh      /' | head -40 >&2
      echo "       Re-run: scripts/build-getff-dist.sh" >&2
      rm -f "$tmp.manifest"
      exit 1
    fi
    rm -f "$tmp.manifest"
    manifest "$tmp" > "$tmp/MANIFEST.sha256"
    package_prepare "$tmp"
    if [ "$MODE" = --check ]; then
      mkdir "$tmp/archive"
      # A real tar, with lifecycle disabled ONLY here to avoid prepack recursion.
      (cd "$tmp" && npm pack --ignore-scripts --json --pack-destination "$tmp/archive") > "$tmp/pack.json"
      archive="$tmp/archive/$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))[0].filename)' "$tmp/pack.json")"
    fi
    packed_check "$archive" "$tmp"
    echo "✓ packages/getff/MANIFEST.sha256 in sync with the repo root ($(wc -l < "$MANIFEST" | tr -d ' ') files); \`files\` covers every payload root"
    ;;
  --list-payload)
    # The payload list is a single source. scripts/run-local-ci-sweep.sh already parses
    # this file's `PAYLOAD=` line with sed to derive its trigger; a second consumer
    # (packages/core/hooks/pre-push.ts payloadDriftSection) asks for it properly instead
    # of growing a third hand-kept copy.
    # shellcheck disable=SC2086  # PAYLOAD is a deliberate word-split list of pathspecs
    printf '%s\n' $PAYLOAD
    ;;
  --check-index)
    # The --check comparison with BOTH sides read from the git INDEX, not the working tree: the
    # manifest as staged against a fresh assembly of the payload as staged. --check cannot see a
    # staging mistake by construction — a path-scoped `git commit` that leaves the rebuilt
    # manifest out keeps the working tree in sync and --check GREEN (#1627). Consumer:
    # scripts/check-getff-manifest-staged.sh (pre-commit). git honours GIT_INDEX_FILE here, so a
    # hook under `git commit -a` / `git commit <path>` checks the index the commit will record.
    # `files` coverage is not re-checked: it reads package.json, which --check covers at push.
    work="$(mktemp -d "${TMPDIR:-/tmp}/getff-dist-index.XXXXXX")"
    trap 'rm -rf "$work"' EXIT
    git -C "$ROOT" show ":packages/getff/MANIFEST.sha256" > "$work/staged.manifest" 2>/dev/null \
      || fail "DRIFT: packages/getff/MANIFEST.sha256 is not in the index"
    mkdir "$work/tree"
    # shellcheck disable=SC2086  # PAYLOAD is a deliberate word-split list of pathspecs
    git -C "$ROOT" ls-files -z -- $PAYLOAD | git -C "$ROOT" checkout-index -z --stdin --prefix="$work/tree/"
    mkdir "$work/materialized"
    materialize "$work/tree" "$work/materialized"
    manifest "$work/materialized" > "$work/fresh.manifest"
    if ! diff -q "$work/staged.manifest" "$work/fresh.manifest" >/dev/null 2>&1; then
      echo "DRIFT: the STAGED packages/getff/MANIFEST.sha256 differs from a fresh assembly of the STAGED payload:" >&2
      diff "$work/staged.manifest" "$work/fresh.manifest" | grep -E '^[<>]' | sed -E 's/^< ([0-9a-f]+)  /  staged     /; s/^> ([0-9a-f]+)  /  fresh      /' | head -40 >&2
      exit 1
    fi
    echo "✓ staged packages/getff/MANIFEST.sha256 in sync with the staged payload ($(wc -l < "$work/staged.manifest" | tr -d ' ') files)"
    ;;
  build)
    files_check || exit 1
    assemble "$PKG"
    # A rejected source witness must not truncate the last valid manifest.
    next_manifest="$(mktemp "$PKG/.manifest.XXXXXX")"
    trap 'rm -f "$next_manifest"' EXIT
    manifest "$PKG" > "$next_manifest"
    chmod 644 "$next_manifest"
    mv "$next_manifest" "$MANIFEST"
    echo "✓ assembled packages/getff/ from the repo root — $(wc -l < "$MANIFEST" | tr -d ' ') files in MANIFEST.sha256"
    ;;
  *)
    echo "usage: scripts/build-getff-dist.sh [--check|--check-packed <tgz>|--check-index|--list-payload]" >&2
    exit 2
    ;;
esac
