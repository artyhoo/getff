// D-tripwire — the mechanical detector for research-source-trust.md §5 item 2's
// harden-criterion. Item D (dep-name path-traversal) stays KEEP-DOCUMENTED /
// BLOCKED / latent-only: the traversal string in installedPkgJsonPath's `join`
// (ecosystem-npm.ts) is never reached with attacker input because tier1For gates
// on `listDirectDeps(root).has(packageName)` first — `Set.has` is pure
// string-equality (no path join), and the membership set is built from the
// consumer's own (trusted) package.json. The real defence is that scope-lock,
// NOT a string check — adding a "path-traversal guard" on the CVE-class name
// match alone would be T16 (#pattern-matching-on-name) + discipline-theatre
// against a non-reachable input.
//
// §5 item 2's harden-criterion — "reject `..`/`/` path segments in dependency
// names IF a non-`package.json`-controlled dependency source is ever added to the
// ecosystem-adapter seam" — is a rot-prone PROSE promise. This file converts it
// into a detector that fires when the PRECONDITION that makes D live appears, in
// its two observable shapes:
//   (A) a SECOND EcosystemAdapter implementation lands — Part A counts the typed
//       `EcosystemAdapter` value declarations across the research package.
//   (B) the sole adapter's dep source stops being the consumer's package.json —
//       Part B pins npmAdapter.listDirectDeps behaviourally (a real call): a dep
//       DECLARED in the consumer package.json is included; a package present in
//       node_modules but ABSENT from package.json is excluded.
//
// GREEN today: npmAdapter is the only EcosystemAdapter impl and its dep source is
// the consumer package.json. RED the moment either precondition shape lands —
// which is exactly when D's latent join defect must be re-examined for the new
// adapter / new dep source, and D flipped from KEEP-DOCUMENTED to hardened.
//
// Deterministic: git ls-files + readFileSync + regex + one real adapter call.
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
 *  that gap — it pins the SOLE adapter's dep-source behaviour, it does not count
 *  adapters — so the two `it` blocks are INDEPENDENT signals, not a backstop pair.
 *  If a dynamically-registered adapter shape ever lands, add a registry-level
 *  assertion here. */
function adapterImplFiles(): string[] {
  const IMPL =
    /:\s*EcosystemAdapter\s*=|satisfies\s+EcosystemAdapter|\bimplements\s+EcosystemAdapter\b|\bas\s+EcosystemAdapter\b|\):\s*EcosystemAdapter\s*(?:\{|=>)/;
  return trackedResearchSources().filter((f) => IMPL.test(readFileSync(f, 'utf8')));
}

describe('D-tripwire — EcosystemAdapter precondition (research-source-trust.md §5 item 2)', () => {
  // ── Part A: exactly one EcosystemAdapter implementation exists ────────────
  it('exactly one EcosystemAdapter implementation exists (npmAdapter); a second lands RED', () => {
    const impls = adapterImplFiles();
    // Sentinel: the glob/regex must reach at least the one known impl. Zero means
    // the detector broke (rename, glob drift), not that the seam is empty.
    expect(
      impls.length,
      `EcosystemAdapter impl detector found ${impls.length} files — expected ≥1 (npmAdapter). ` +
        `Zero means the git-glob/regex broke, not that the seam is empty.`,
    ).toBeGreaterThan(0);
    expect(
      impls.map((f) => f.replace(`${REPO_ROOT}/`, '')),
      'A SECOND EcosystemAdapter implementation landed. Precondition for §5 item 2 (D) is now ' +
        'live: before wiring it, add the `..`/`/` path-segment reject to installedPkgJsonPath ' +
        '(ecosystem-npm.ts) OR to the new adapter, and flip D from KEEP-DOCUMENTED to hardened ' +
        'in research-source-trust.md §5.',
    ).toHaveLength(1);
  });

  // ── Part B: the sole adapter's dep source IS the consumer's package.json ──
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
