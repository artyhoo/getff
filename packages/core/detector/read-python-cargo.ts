// Priority 4 (non-npm toolchains): pyproject.toml → python, Cargo.toml → cargo.
// Sibling to read-manifest.ts (package.json). Widens detection beyond JS/TS so a
// python or cargo consumer repo detects as its real stack, not `unknown`
// (ecosystem-wiring W1). Framework detection is python-only by design — rust
// framework expressibility is out of W1's depth (T14: detect the stack, make no
// rust framework claim).

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetectionResult } from './types.ts';
import { toConfidence } from './confidence.ts';
// BFR reuse: the tested PEP 621 / PEP 508 / Poetry pyproject parser already exists
// as the pip ecosystem adapter's `listDirectDeps`. Re-implementing the section walk
// here would duplicate ~40 LOC of parsing that ships with its own test suite
// (research/ecosystem-python.test.ts) and would drift. Every research→detector edge
// is `import type` (erased); this is the one value import the other way and it pulls
// in only node:fs/node:path at runtime — no cycle (verified W1).
import { pipAdapter } from '../research/ecosystem-python.ts';

/**
 * Python web/data frameworks detected from direct dependencies, in precedence
 * order (first match wins). Names are PEP 503 normalized (lowercase, hyphenated)
 * to match `pipAdapter.listDirectDeps` output. fastapi and sqlalchemy are the
 * names cited by kickoff §1 / spec §7; django and flask are common-python-framework
 * additions (reasonable, not cited verbatim in those sources). Additive scope:
 * a broader set lands with the research layer, mirroring known-packages.ts.
 */
const PYTHON_FRAMEWORKS: readonly string[] = ['fastapi', 'django', 'flask', 'sqlalchemy'];

function detectPythonFramework(projectRoot: string): string | null {
  const deps = pipAdapter.listDirectDeps(projectRoot);
  for (const fw of PYTHON_FRAMEWORKS) {
    if (deps.has(fw)) return fw;
  }
  return null;
}

export function readPythonCargo(projectRoot: string): DetectionResult | null {
  const tuple = toConfidence(4);
  const baseRules = { applicable: [] as string[], skipped: [] as string[] };

  // pyproject.toml → python. Version is not extracted (the reused parser returns
  // names only); framework.version/major stay null — honest, not guessed.
  // Precedence: checked before Cargo.toml below, so a python+rust polyglot repo
  // (e.g. PyO3/maturin) with no package.json deterministically detects as python.
  if (existsSync(resolve(projectRoot, 'pyproject.toml'))) {
    const fw = detectPythonFramework(projectRoot);
    return {
      stack: 'python',
      framework: { name: fw, version: null, major: null },
      runtime: { name: 'python', major: null },
      ...tuple,
      source: 'pyproject.toml',
      rules: baseRules,
      // JS known-packages (known-packages.ts) do not apply to a python stack —
      // set explicitly so index.ts does not fall back to the JS missing[] list.
      missing: [],
    };
  }

  // Cargo.toml → cargo. No rust framework detection (T14: detect the stack only).
  if (existsSync(resolve(projectRoot, 'Cargo.toml'))) {
    return {
      stack: 'cargo',
      framework: { name: null, version: null, major: null },
      runtime: { name: 'cargo', major: null },
      ...tuple,
      source: 'Cargo.toml',
      rules: baseRules,
      missing: [],
    };
  }

  return null;
}
