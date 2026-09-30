#!/usr/bin/env bash
# check-bundle-dep-parity.sh — guard against PHANTOM bundle drift.
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
#   Every committed `packages/core/**/*.bundle.mjs` is read, not only the synth bundle: since
#   2026-09-28 scripts/build-runtime-bundles.mjs commits two more (the consumer pre-push hook and
#   the rule generator), and the rule generator inlines ajv, semver and friends through the very
#   same packages/core resolution walk.
#
# WHAT IT CHECKS
#   1. LOCKFILE PARITY (static; no node_modules needed). Every third-party package inlined in a
#      committed bundle (its `// node_modules/<pkg>/…` comments), TRANSITIVE ones included, must
#      resolve to one and the same version in every install world the two committed lockfiles
#      plan: the root install alone, and `npm ci --prefix packages/core` on top of it. Resolution
#      mirrors Node/esbuild: direct imports of first-party `packages/core/**` sources walk up from
#      packages/core, and each dependency walks up from its parent package's own directory.
#   2. TREE PARITY (only when a node_modules tree exists). The same walk over the installed tree
#      must land on those agreed versions — otherwise the working tree is stale relative to the
#      locks and a rebuild would produce a bundle CI cannot reproduce.
#
#   Transitive deps are NOT safe from a packages/core-local layer. They resolve upward from their
#   parent's directory, and the parent itself moves: after `npm ci --prefix packages/core`, ajv
#   lives in packages/core/node_modules, so its fast-uri resolves there too. Until 2026-09-30 this
#   header claimed such deps «can never be shadowed» and left them unchecked; meanwhile a
#   dependabot bump moved only the packages/core lock to fast-uri 3.1.8 while the root lock kept
#   3.1.7, and every bundle inlining fast-uri reported a phantom drift on untouched files.
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
ROOT_LOCK = os.path.join(root, 'package-lock.json')
CORE_LOCK = os.path.join(root, 'packages/core/package-lock.json')
CORE_SRC = os.path.join(root, 'packages/core')

for p in (ROOT_LOCK, CORE_LOCK):
    if not os.path.isfile(p):
        print(f"check-bundle-dep-parity: required file missing: {os.path.relpath(p, root)}", file=sys.stderr)
        sys.exit(2)

# Every committed bundle under packages/core (node_modules and dot-dirs excluded).
BUNDLES = []
for dirpath, dirnames, filenames in os.walk(CORE_SRC):
    dirnames[:] = sorted(d for d in dirnames if d != 'node_modules' and not d.startswith('.'))
    BUNDLES += [os.path.join(dirpath, fn) for fn in sorted(filenames) if fn.endswith('.bundle.mjs')]
if not BUNDLES:
    print('check-bundle-dep-parity: no committed packages/core/**/*.bundle.mjs found — nothing to '
          'check is a usage error, not a pass', file=sys.stderr)
    sys.exit(2)

# ── 1. packages inlined into the committed bundle ────────────────────────────
# esbuild emits one `// node_modules/<path>` line comment per file it inlines, and
# build-synth-bundle.sh normalises the prefix to `node_modules/…`, so these comments are a
# stable, environment-independent record of what actually got bundled. Anchoring on the comment
# form (rather than any `node_modules/x` substring) keeps out `--external` packages and plain
# string literals — e.g. the runtime probe `existsSync("node_modules/ts-morph/package.json")`,
# whose version cannot affect a single bundled byte.
# A nested copy is named by its full path (`// node_modules/ajv/node_modules/fast-uri/…`), so
# every package segment in the comment path counts, not only the first.
COMMENT_RE = re.compile(r'^\s*//\s*(node_modules/\S+)', re.MULTILINE)
PKG_RE = re.compile(r'(?:^|/)node_modules/((?:@[^/\s]+/)?[^/\s]+)(?=/)')
inlined = set()
for bundle in BUNDLES:
    with open(bundle, encoding='utf-8') as fh:
        for path in COMMENT_RE.findall(fh.read()):
            inlined |= set(PKG_RE.findall(path))

# ── 2. of those, the ones imported DIRECTLY by a first-party packages/core source ────────────
# These are the roots of the resolution walk (they resolve by walking up from inside
# packages/core); every transitive inlined package is reached from them in §4.
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

if not inlined:
    print('✓ bundle dep parity: no committed bundle inlines a third-party package')
    sys.exit(0)

# ── 3. the install worlds, each as a path → {version, dependencies} lookup ──────────────────
# A committed lockfile plans a tree; which tree is on disk depends on which install ran last.
# Two worlds cover every order the repo's own commands produce:
#   root         — the root `npm install` / `npm ci` alone (root package-lock.json, including
#                  its nested packages/core/node_modules/* plan).
#   packages/core — `npm ci --prefix packages/core` on top of a root install: it wipes and
#                  re-creates packages/core/node_modules from the standalone lock, while
#                  everything above packages/core stays as the root lock planned it.
with open(ROOT_LOCK, encoding='utf-8') as fh:
    root_lock = json.load(fh).get('packages', {})
with open(CORE_LOCK, encoding='utf-8') as fh:
    core_lock = json.load(fh).get('packages', {})

CORE_NM = 'packages/core/node_modules/'
core_world = {k: v for k, v in root_lock.items() if not k.startswith(CORE_NM)}
core_world.update({f'packages/core/{k}': v for k, v in core_lock.items() if k.startswith('node_modules/')})
LOCK_WORLDS = [
    ('root package-lock.json', root_lock),
    ('packages/core/package-lock.json over the root install', core_world),
]

def lock_lookup(world):
    def lookup(key):
        entry = world.get(key)
        if not isinstance(entry, dict) or not entry.get('version'):
            return None
        deps = {}
        for field in ('dependencies', 'optionalDependencies', 'peerDependencies'):
            deps.update(entry.get(field) or {})
        return entry['version'], set(deps)
    return lookup

def tree_lookup(key):
    """The installed tree: <root>/<key>/package.json, read through any provisioning symlink."""
    manifest = os.path.join(root, key, 'package.json')
    if not os.path.isfile(manifest):
        return None
    try:
        with open(manifest, encoding='utf-8') as fh:
            meta = json.load(fh)
    except (OSError, ValueError):
        return None
    if not meta.get('version'):
        return None
    deps = {}
    for field in ('dependencies', 'optionalDependencies', 'peerDependencies'):
        deps.update(meta.get(field) or {})
    return meta['version'], set(deps)

# ── 4. resolve every inlined package the way Node and esbuild do ─────────────────────────────
# Walk up from the requiring directory, trying <dir>/node_modules/<name> at each level, and stop
# at the repo root — layers above it are not part of this repo's install. The walk starts at
# packages/core for the direct imports and at each resolved package's OWN directory for its
# dependencies, so a transitive dep follows its parent into whichever layer the parent came
# from: ajv in packages/core/node_modules pulls fast-uri from packages/core/node_modules too.
# Only inlined packages are followed; an off-path copy (the root lock's
# packages/core/node_modules/json-schema-traverse@0.4.1, eslint's nested one) is never reached.
def resolve(lookup, from_dir, name):
    cur = from_dir
    while True:
        key = f'{cur}/node_modules/{name}' if cur else f'node_modules/{name}'
        hit = lookup(key)
        if hit:
            return key, hit
        if not cur:
            return None, None
        cur = os.path.dirname(cur)

def resolve_all(lookup):
    """name → {(version, key)} for every inlined package reachable in one world."""
    found = {}
    queue = [('packages/core', name) for name in sorted(direct)]
    seen = set()
    while queue:
        from_dir, name = queue.pop(0)
        key, hit = resolve(lookup, from_dir, name)
        if not key or key in seen:
            continue
        seen.add(key)
        version, deps = hit
        found.setdefault(name, set()).add((version, key))
        queue += [(key, dep) for dep in sorted(deps) if dep in inlined]
    # An inlined package no lock entry leads to (a dependency declared nowhere) is still checked,
    # from where a bare import inside packages/core would find it — never silently skipped.
    for name in sorted(inlined - set(found)):
        key, hit = resolve(lookup, 'packages/core', name)
        if key:
            found[name] = {(hit[0], key)}
    return found

per_world = [(label, resolve_all(lock_lookup(world))) for label, world in LOCK_WORLDS]

failures = []
agreed = {}
for pkg in sorted(inlined):
    planned = [(label, found.get(pkg, set())) for label, found in per_world]
    versions = [frozenset(v for v, _ in hits) for _, hits in planned if hits]
    if len(set(versions)) > 1:
        failures.append(
            f'  {pkg}: the committed lockfiles plan different versions for the copy a bundle build '
            'would inline —\n'
            + '\n'.join(f'      {v:<12} {key}   ({label})'
                        for label, hits in planned for v, key in sorted(hits))
        )
    elif versions:
        agreed[pkg] = versions[0]

# ── 5. tree parity (skipped per package when nothing is installed for it) ────────────────────
installed = resolve_all(tree_lookup)
for pkg, want in sorted(agreed.items()):
    hits = installed.get(pkg)
    if not hits:
        continue  # no tree installed here — nothing to compare against
    got = frozenset(v for v, _ in hits)
    if got != want:
        failures.append(
            f'  {pkg}: the installed tree does not match the lockfiles —\n'
            f'      {", ".join(sorted(want)):<12} planned by every committed lockfile\n'
            + '\n'.join(f'      {v:<12} actually resolvable at {key}' for v, key in sorted(hits))
        )

if failures:
    print('❌ bundle dependency parity FAILED\n', file=sys.stderr)
    print('\n'.join(failures), file=sys.stderr)
    print(
        '\n   A rebuild of a committed bundle ('
        + ', '.join(os.path.relpath(b, root) for b in BUNDLES) + ')\n'
        '   would inline whichever copy the ambient install left in place, so its drift gate\n'
        '   would report a PHANTOM drift on a branch that never touched that bundle\'s sources.\n'
        '\n   Fix the disagreement, do not regenerate the bundle around it:\n'
        '     • a direct dependency disagrees → pin the SAME exact version in package.json (root)\n'
        '       and packages/core/package.json, then regenerate BOTH locks:\n'
        '         npm install --package-lock-only\n'
        '         cd packages/core && npm install --package-lock-only --no-workspaces\n'
        '     • a transitive dependency disagrees → move the lagging lock to the other one\'s\n'
        '       version (e.g. `npm update <pkg> --package-lock-only` in the lagging layer), then\n'
        '       rebuild any bundle whose inlined bytes change\n'
        '     • tree disagrees → re-install to lockfile state (CI parity):\n'
        '         NODE_ENV=development npm install\n',
        file=sys.stderr,
    )
    sys.exit(1)

print('✓ bundle dep parity: '
      + ', '.join(f'{p}@{"+".join(sorted(v))}' for p, v in sorted(agreed.items()))
      + ' agree across every lockfile-planned install world')
sys.exit(0)
PY
