#!/usr/bin/env bash
# check-bundle-dep-parity.sh — guard against PHANTOM synth-bundle drift.
#
# WHY THIS EXISTS (incidents 2026-07-02 ×2, 2026-07-21, 2026-08-06)
#   `scripts/build-synth-bundle.sh` inlines third-party packages into the committed
#   `packages/core/install/synth-and-wire.bundle.mjs`. esbuild resolves those packages the way
#   Node does — walking up from `packages/core/install/` — so the FIRST `node_modules` layer that
#   carries the package decides which bytes land in the bundle. This repo has three candidate
#   layers, materialised by three different commands:
#
#     node_modules/<pkg>                     ← root `npm install`   (root package-lock.json)
#     packages/core/node_modules/<pkg>       ← root `npm install`   (root lock's nested plan)
#     packages/core/node_modules/<pkg>       ← `npm ci --prefix packages/core`
#                                              (packages/core/package-lock.json — a SEPARATE,
#                                               independently-updated standalone lockfile)
#
#   When those layers disagree on a version, the bundle a fresh build produces depends on which
#   install ran last. The drift gate then reports `DRIFT: synth-and-wire.bundle.mjs differs …`,
#   which is FALSE: nothing in the diff touched a synth file. The most recent instance —
#   `npm ci --prefix packages/core`, the standard opening line of a kickoff `host-verify`
#   contract, replacing a worktree's provisioning symlink with semver@7.8.1 while the committed
#   bundle carried semver@7.8.5 — blocked a push on a branch with no synth changes at all.
#
#   A phantom drift is a lockfile disagreement wearing a bundle-drift costume. This check names
#   the disagreement directly, at the layer where it is actually decidable (two committed
#   lockfiles), so the confusing symptom can never be the only signal again.
#
# WHAT IT CHECKS
#   1. LOCKFILE PARITY (static; no node_modules needed). For every third-party package that is
#      both inlined in the committed bundle AND directly imported by a first-party
#      `packages/core/**` source — i.e. exactly the packages whose resolution starts inside
#      packages/core and is therefore layer-sensitive — every layer PLANNED by the two committed
#      lockfiles must name one and the same version.
#   2. TREE PARITY (only when a node_modules tree exists). The version actually resolvable from
#      `packages/core/install/` must equal that agreed version — otherwise the working tree is
#      stale relative to the locks and a rebuild would produce a bundle CI cannot reproduce.
#
#   Transitive deps of an already-hoisted package (ajv's fast-uri, json-schema-traverse, …) are
#   deliberately out of scope: they resolve upward from the hoisting package's own directory, so
#   a packages/core-local layer can never shadow them.
#
# USAGE
#   bash scripts/check-bundle-dep-parity.sh [<repo-root>]
#
#   Runnable from any working directory, inside or outside a git repo. With no argument it
#   targets the repo this script lives in; pass <repo-root> to point it at a fixture tree.
#
# EXIT CODES
#   0 — parity holds, or there is nothing layer-sensitive to check.
#   1 — a divergence was found (message names the package + every layer's version).
#   2 — usage error / a required file is missing.
#
# Deterministic bash + python3 only — no network, no npm, no paid LLM
# (.claude/rules/no-paid-llm-in-ci.md). Safe to call from a gate.
set -uo pipefail

# Runnable from ANY working directory. With no argument the target is the repo this script
# lives in, derived from the script's own path — NOT from the caller's cwd, which would answer
# about whatever checkout the operator happened to be standing in (or nothing at all outside a
# repo). An explicit <repo-root> argument still wins; it is resolved to an absolute path so a
# relative one keeps meaning the same directory regardless of where the caller stood.
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)}"

if [ ! -d "$ROOT" ]; then
  echo "check-bundle-dep-parity: no such directory: $ROOT" >&2
  exit 2
fi
ROOT="$(cd "$ROOT" && pwd -P)"

python3 - "$ROOT" <<'PY'
import json, os, re, sys

root = sys.argv[1]
BUNDLE = os.path.join(root, 'packages/core/install/synth-and-wire.bundle.mjs')
ROOT_LOCK = os.path.join(root, 'package-lock.json')
CORE_LOCK = os.path.join(root, 'packages/core/package-lock.json')
CORE_SRC = os.path.join(root, 'packages/core')

for p in (BUNDLE, ROOT_LOCK, CORE_LOCK):
    if not os.path.isfile(p):
        print(f"check-bundle-dep-parity: required file missing: {os.path.relpath(p, root)}", file=sys.stderr)
        sys.exit(2)

# ── 1. packages inlined into the committed bundle ────────────────────────────
# esbuild emits one `// node_modules/<path>` line comment per file it inlines, and
# build-synth-bundle.sh normalises the prefix to `node_modules/…`, so these comments are a
# stable, environment-independent record of what actually got bundled. Anchoring on the comment
# form (rather than any `node_modules/x` substring) keeps out `--external` packages and plain
# string literals — e.g. the runtime probe `existsSync("node_modules/ts-morph/package.json")`,
# whose version cannot affect a single bundled byte.
PKG_RE = re.compile(r'^\s*//\s*node_modules/((?:@[^/\s]+/)?[^/\s]+)/', re.MULTILINE)
with open(BUNDLE, encoding='utf-8') as fh:
    inlined = set(PKG_RE.findall(fh.read()))

# ── 2. of those, the ones imported DIRECTLY by a first-party packages/core source ────────────
# Only these resolve by walking up from inside packages/core, so only these can be shadowed by a
# packages/core-local node_modules layer.
IMPORT_RE = re.compile(r'''(?:from|import)\s*\(?\s*['"]((?:@[^/'"]+/)?[^./'"][^'"]*)['"]''')
direct = set()
for dirpath, dirnames, filenames in os.walk(CORE_SRC):
    dirnames[:] = [d for d in dirnames if d != 'node_modules' and not d.startswith('.')]
    for fn in filenames:
        if not fn.endswith(('.ts', '.mts', '.tsx')):
            continue
        try:
            with open(os.path.join(dirpath, fn), encoding='utf-8') as fh:
                text = fh.read()
        except (OSError, UnicodeDecodeError):
            continue
        for spec in IMPORT_RE.findall(text):
            parts = spec.split('/')
            name = '/'.join(parts[:2]) if spec.startswith('@') else parts[0]
            if name in inlined:
                direct.add(name)

layer_sensitive = sorted(direct)
if not layer_sensitive:
    print('✓ bundle dep parity: no layer-sensitive bundled dependency to check')
    sys.exit(0)

# ── 3. lockfile parity ───────────────────────────────────────────────────────
with open(ROOT_LOCK, encoding='utf-8') as fh:
    root_lock = json.load(fh).get('packages', {})
with open(CORE_LOCK, encoding='utf-8') as fh:
    core_lock = json.load(fh).get('packages', {})

def planned(lock, key):
    entry = lock.get(key)
    return entry.get('version') if isinstance(entry, dict) else None

failures = []
agreed = {}
for pkg in layer_sensitive:
    layers = [
        (f'{os.path.basename(ROOT_LOCK)} → packages/core/node_modules/{pkg}',
         planned(root_lock, f'packages/core/node_modules/{pkg}')),
        (f'{os.path.basename(ROOT_LOCK)} → node_modules/{pkg}',
         planned(root_lock, f'node_modules/{pkg}')),
        (f'packages/core/package-lock.json → node_modules/{pkg}',
         planned(core_lock, f'node_modules/{pkg}')),
    ]
    present = [(label, ver) for label, ver in layers if ver]
    versions = {ver for _, ver in present}
    if len(versions) > 1:
        failures.append(
            f'  {pkg}: the two committed lockfiles plan {len(versions)} different versions —\n'
            + '\n'.join(f'      {ver:<12} {label}' for label, ver in present)
        )
    elif versions:
        agreed[pkg] = next(iter(versions))

# ── 4. tree parity (skipped entirely when nothing is installed) ──────────────
def resolve_from_install(pkg):
    """First node_modules layer carrying <pkg>, walking up from packages/core/install.

    Mirrors Node's (and esbuild's) LOAD_NODE_MODULES walk, but stops at the repo root: layers
    above it are not part of this repo's install and must not decide a committed artefact.
    """
    cur = os.path.realpath(os.path.join(root, 'packages/core/install'))
    stop = os.path.realpath(root)
    while True:
        manifest = os.path.join(cur, 'node_modules', pkg, 'package.json')
        if os.path.isfile(manifest):
            try:
                with open(manifest, encoding='utf-8') as fh:
                    return json.load(fh).get('version'), os.path.relpath(os.path.dirname(manifest), stop)
            except (OSError, ValueError):
                return None, None
        if cur == stop or cur == os.path.dirname(cur):
            return None, None
        cur = os.path.dirname(cur)

for pkg, want in agreed.items():
    got, where = resolve_from_install(pkg)
    if got is None:
        continue  # no tree installed here — nothing to compare against
    if got != want:
        failures.append(
            f'  {pkg}: the installed tree does not match the lockfiles —\n'
            f'      {want:<12} planned by both committed lockfiles\n'
            f'      {got:<12} actually resolvable at {where}'
        )

if failures:
    print('❌ synth-bundle dependency parity FAILED\n', file=sys.stderr)
    print('\n'.join(failures), file=sys.stderr)
    print(
        '\n   A rebuild of packages/core/install/synth-and-wire.bundle.mjs would inline whichever\n'
        '   copy the ambient install left in place, so the drift gate would report a PHANTOM\n'
        '   `synth-bundle drift` on a branch that never touched a synth file.\n'
        '\n   Fix the disagreement, do not regenerate the bundle around it:\n'
        '     • lockfiles disagree → pin the SAME exact version in package.json (root, dev) and\n'
        '       packages/core/package.json, then regenerate BOTH locks:\n'
        '         npm install --package-lock-only\n'
        '         cd packages/core && npm install --package-lock-only --no-workspaces\n'
        '     • tree disagrees → re-install to lockfile state (CI parity):\n'
        '         NODE_ENV=development npm install\n',
        file=sys.stderr,
    )
    sys.exit(1)

print('✓ bundle dep parity: ' + ', '.join(f'{p}@{v}' for p, v in sorted(agreed.items()))
      + ' agree across every lockfile-planned layer')
sys.exit(0)
PY
