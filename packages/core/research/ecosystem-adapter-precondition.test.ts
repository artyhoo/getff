// D-tripwire — the mechanical detector for research-source-trust.md §5 item 2's
// harden-criterion. Item D (dep-name path-traversal) was KEEP-DOCUMENTED /
// BLOCKED / latent-only while npmAdapter was the sole EcosystemAdapter: the
// traversal string in installedPkgJsonPath's `join` (ecosystem-npm.ts) was never
// reached with attacker input because tier1For gates on
// `listDirectDeps(root).has(packageName)` first — `Set.has` is pure
// string-equality (no path join), and the membership set was built from the
// consumer's own (trusted) package.json.
//
// STAGE S4 FLIP: cargoAdapter (ecosystem-cargo.ts) landed as a SECOND
// EcosystemAdapter, which is precisely Part A's precondition shape. Per the
// harden-criterion, BOTH installedPkgJsonPath (ecosystem-npm.ts) and
// cargoAdapter's own manifest-path builder (ecosystem-cargo.ts) now reject
// `..`/separator-bearing dependency names BEFORE any path join
// (isUnsafeDepName in each file). D is HARDENED, not merely documented, as of
// this commit (research-source-trust.md §5 item 4 lists this — cross-referenced
// there under the cargo-adapter section; item 2 above records the historical
// KEEP-DOCUMENTED state this file supersedes).
//
// This file remains a LIVE tripwire, not a one-time acknowledgement: Part A now
// asserts the POSITIVE property — every current EcosystemAdapter implementation
// file that constructs a filesystem path from a dependency name also contains a
// traversal-guard signal — and RE-arms for the future: a THIRD adapter (or any
// adapter whose source lacks the guard signal) fails Part A again, the same way
// the second one flipped it before this rewrite.
//
// Deterministic: git ls-files + readFileSync + regex + real adapter calls.
// ZERO API-billed calls (no-paid-llm-in-ci). git-aware population mirrors
// principle 30's trackedStoreFiles idiom — a new ecosystem-*.ts adapter is
// covered the moment it lands, no static-list edit.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { npmAdapter } from './ecosystem-npm.ts';
import { cargoAdapter } from './ecosystem-cargo.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..', '..'); // research → core → packages → root

/** Tracked non-test TypeScript sources under packages/core/research (git-aware,
 *  mirrors principle 30's trackedStoreFiles + the principle 12/29/09 git ls-files
 *  pattern — reaches committed sources identically in CI and locally). Empty list
 *  ⇒ the sentinel below fails loudly (glob broke), never a vacuous pass. */
function trackedResearchSources(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', 'packages/core/research/*.ts'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  return out
    .split('\0')
    .filter(Boolean)
    .filter((rel) => !rel.endsWith('.test.ts'))
    .map((rel) => resolve(REPO_ROOT, rel));
}

/** Files declaring a *value* of type EcosystemAdapter — the seam's concrete
 *  implementations. Matches the typed-const idiom the sole existing impl uses
 *  (`export const npmAdapter: EcosystemAdapter = {` in ecosystem-npm.ts) plus the
 *  four other ways a value of this type is declared in TS: `satisfies
 *  EcosystemAdapter`, an `as EcosystemAdapter` cast, a `class … implements
 *  EcosystemAdapter`, and a factory whose return type is `): EcosystemAdapter {`
 *  or `): EcosystemAdapter =>`. The interface's own declaration
 *  (`export interface EcosystemAdapter {` in allowlist-resolver.ts) and type-only
 *  annotation positions (`adapter?: EcosystemAdapter;`) are deliberately NOT
 *  matched — a declaration/annotation is the seam, not an implementation of it.
 *
 *  Residual (documented, NOT backstopped): a second adapter that carries NO
 *  textual `EcosystemAdapter` type at its definition (e.g. an untyped object
 *  registered dynamically) would evade this textual count. Part B does NOT cover
 *  that gap — it pins npmAdapter's dep-source behaviour, it does not count
 *  adapters — so the `it` blocks are INDEPENDENT signals, not a backstop pair.
 *  If a dynamically-registered adapter shape ever lands, add a registry-level
 *  assertion here. */
function adapterImplFiles(): string[] {
  const IMPL =
    /:\s*EcosystemAdapter\s*=|satisfies\s+EcosystemAdapter|\bimplements\s+EcosystemAdapter\b|\bas\s+EcosystemAdapter\b|\):\s*EcosystemAdapter\s*(?:\{|=>)/;
  return trackedResearchSources().filter((f) => IMPL.test(readFileSync(f, 'utf8')));
}

/** Textual signal that a file contains a path-traversal / separator guard on
 *  a dependency name before constructing a filesystem path from it. Matches
 *  this repo's actual guard shape (`isUnsafeDepName` helper, checking `..`
 *  and a path separator) rather than any specific function name, so a
 *  differently-named-but-equivalent guard in a future adapter still counts —
 *  the signal is "rejects `..` AND a separator", not a specific identifier. */
function hasTraversalGuardSignal(source: string): boolean {
  const mentionsDotDotReject = /\.\.['"]?\s*\)|includes\(['"]\.\.['"]\)/.test(source);
  const mentionsSeparatorReject =
    /includes\(['"]\/['"]\)|includes\(['"]\\\\['"]\)|isUnsafeDepName/.test(source);
  return mentionsDotDotReject && mentionsSeparatorReject;
}

describe('D-tripwire — EcosystemAdapter precondition (research-source-trust.md §5 item 2)', () => {
  // ── Part A: EVERY EcosystemAdapter implementation guards path-traversal ───
  it('a SECOND EcosystemAdapter has landed (cargoAdapter) — precondition is live, exactly as designed', () => {
    const impls = adapterImplFiles();
    // Sentinel: the glob/regex must reach at least the known impls. Fewer
    // than 2 means either the detector broke (rename, glob drift) or
    // cargoAdapter's landing regressed — both are failures, not successes.
    expect(
      impls.length,
      `EcosystemAdapter impl detector found ${impls.length} files — expected ≥2 (npmAdapter + ` +
        `cargoAdapter, S4). Fewer means the git-glob/regex broke or cargoAdapter regressed.`,
    ).toBeGreaterThanOrEqual(2);
  });

  it('EVERY EcosystemAdapter implementation file rejects `..`/separator dependency-name segments before building a path', () => {
    const impls = adapterImplFiles();
    const withoutGuard = impls.filter((f) => !hasTraversalGuardSignal(readFileSync(f, 'utf8')));
    expect(
      withoutGuard.map((f) => f.replace(`${REPO_ROOT}/`, '')),
      'The following EcosystemAdapter implementation(s) construct a filesystem path from a ' +
        'dependency name WITHOUT a visible `..`/separator traversal guard. Per §5 item 2\'s ' +
        'now-live harden-criterion, every adapter that builds fs paths from dep names must ' +
        'reject `..` and path-separator segments BEFORE the join (see isUnsafeDepName in ' +
        'ecosystem-npm.ts / ecosystem-cargo.ts for the reference shape).',
    ).toHaveLength(0);
  });

  it('negative-control proof: the detector actually discriminates (a guard-shaped string is matched, a plain join is not)', () => {
    // Proves hasTraversalGuardSignal is not vacuously true for any source
    // text — a naive "just join the segments" snippet must NOT match.
    const guarded = `
      function isUnsafeDepName(name) { return name.includes('..') || name.includes('/'); }
    `;
    const unguarded = `
      function installedPkgJsonPath(root, name) { return join(root, 'node_modules', name); }
    `;
    expect(hasTraversalGuardSignal(guarded)).toBe(true);
    expect(hasTraversalGuardSignal(unguarded)).toBe(false);
  });

  it('behavioural proof: BOTH shipped adapters actually reject a traversal name at runtime (not just textually)', () => {
    const npmRoot = mkdtempSync(join(tmpdir(), 'd-tripwire-npm-'));
    writeFileSync(join(npmRoot, 'package.json'), JSON.stringify({ dependencies: {} }, null, 2));
    expect(npmAdapter.readInstalledMeta(npmRoot, '../evil')).toBeNull();

    const cargoRoot = mkdtempSync(join(tmpdir(), 'd-tripwire-cargo-'));
    writeFileSync(
      join(cargoRoot, 'Cargo.toml'),
      '[package]\nname = "consumer"\nversion = "0.1.0"\n',
    );
    expect(cargoAdapter.readInstalledMeta(cargoRoot, '../evil')).toBeNull();
  });

  // @arm:B2:neg value-guard-containment (behavioural VALUE-surface paired
  // negatives — non-symlink `../` traversal values, complementing the symlink
  // escapes registered in ecosystem-cargo.test.ts / ecosystem-python.test.ts.
  // HONEST POPULATION LIMIT (spec §3.2 B2, binding): this arm's fixtures verify
  // KNOWN path-resolving surfaces only. The textual sentinel above
  // (hasTraversalGuardSignal) proves the NAME guard per adapter but does NOT
  // verify the VALUE guard (resolvedWithinRoot) — a future path-resolving
  // adapter shipped without it would pass this file. That is a recorded gap +
  // promotion trigger per research-source-trust.md §5 item 2 — caught by the §5
  // review protocol's trust dimension, deliberately NOT a fabricated
  // value-guard sentinel here.)
  it('behavioural end-to-end paired-negatives: cargoAdapter rejects a traversing path-override VALUE and a traversing workspace-member VALUE (§5 BLOCKER — distinct surface from the dep-NAME guard above)', () => {
    // The dep-NAME guard (isUnsafeDepName on `pkg`) is necessary but NOT
    // sufficient — the path-override and workspace-member *values* (declared
    // inside the consumer's OWN root Cargo.toml, not the queried dep name)
    // are a second, independent traversal surface. This is the textual
    // signal's blind spot: `hasTraversalGuardSignal` only proves a guard
    // string exists somewhere in the file, not that every fs-path-building
    // branch actually calls it. Kept SUPPLEMENTARY to that textual check,
    // per research-source-trust.md §5 item 2.

    // (a) override-value traversal: `path = "../escape-a"` naming a real,
    // out-of-tree manifest — must NOT resolve.
    const overrideRoot = mkdtempSync(join(tmpdir(), 'd-tripwire-cargo-override-'));
    writeFileSync(
      join(overrideRoot, 'Cargo.toml'),
      '[package]\nname = "consumer"\nversion = "0.1.0"\n\n' +
        '[dependencies]\npoison = { path = "../escape-a" }\n',
    );
    const overrideOutside = resolve(overrideRoot, '..', 'escape-a');
    mkdirSync(overrideOutside, { recursive: true });
    writeFileSync(
      join(overrideOutside, 'Cargo.toml'),
      '[package]\nname = "poison"\nhomepage = "https://evil.example"\n',
    );
    expect(cargoAdapter.readInstalledMeta(overrideRoot, 'poison')).toBeNull();
    expect(cargoAdapter.listDirectDeps(overrideRoot).has('poison')).toBe(false);

    // (b) member-value traversal: `[workspace] members = ["../escape-b"]`
    // naming a real, out-of-tree member manifest — must NOT resolve.
    const memberRoot = mkdtempSync(join(tmpdir(), 'd-tripwire-cargo-member-'));
    writeFileSync(
      join(memberRoot, 'Cargo.toml'),
      '[workspace]\nmembers = ["../escape-b"]\n\n[package]\nname = "consumer"\n' +
        'version = "0.1.0"\n\n[dependencies]\npoison-b = { workspace = true }\n',
    );
    const memberOutside = resolve(memberRoot, '..', 'escape-b');
    mkdirSync(memberOutside, { recursive: true });
    writeFileSync(
      join(memberOutside, 'Cargo.toml'),
      '[package]\nname = "poison-b"\nhomepage = "https://evil-b.example"\n',
    );
    expect(cargoAdapter.readInstalledMeta(memberRoot, 'poison-b')).toBeNull();
    expect(cargoAdapter.listDirectDeps(memberRoot).has('poison-b')).toBe(false);
  });

  // ── Part B: the sole adapter's dep source IS the consumer's package.json ──
  // @arm:B3:pos direct-deps-only (npm lane, declared-dep positive)
  // @arm:B3:neg direct-deps-only (npm lane, undeclared-in-pkgjson negative — the
  // positive+negative PAIR lives in this single test's two assertions; sibling
  // family pairs: ecosystem-python.test.ts (pip) + ecosystem-cargo.test.ts
  // (cargo) + tier1.test.ts S2-N2 (npm at the tier1For seam).)
  it('npmAdapter derives direct deps ONLY from the consumer package.json (trusted source)', () => {
    const root = mkdtempSync(join(tmpdir(), 'd-tripwire-'));
    // Consumer package.json declares exactly one dep.
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { 'declared-dep': '^1.0.0' } }, null, 2),
    );
    const nm = join(root, 'node_modules');
    // Install BOTH the declared dep and an extra package NOT in package.json
    // (a transitive-only shape). Only the declared one is a direct dep — proving
    // the dep source is package.json, not the on-disk node_modules tree.
    for (const name of ['declared-dep', 'undeclared-in-pkgjson']) {
      const dir = join(nm, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0' }, null, 2));
    }
    const deps = npmAdapter.listDirectDeps(root);
    // Positive arm: the package.json-declared name is a direct dep.
    expect(deps.has('declared-dep')).toBe(true);
    // Negative arm: a package present in node_modules but absent from package.json
    // is NOT a direct dep — the consumer's own package.json, not the on-disk tree,
    // is the dep source. A future non-package.json dep source would break this.
    expect(deps.has('undeclared-in-pkgjson')).toBe(false);
  });
});
