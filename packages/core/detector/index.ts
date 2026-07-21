// Public API: detectStack(projectRoot, opts) → DetectionResult
// Source priority (highest confidence first), per phase-4-research §3.1:
//   1. .ai-factory/DESCRIPTION.md          → confidence: high
//   2. .ai-factory/ARCHITECTURE.md         → confidence: high
//   3. .ai-factory/skill-context/*/SKILL.md → confidence: high
//   4. package.json deps + lockfile        → confidence: medium
//   4. pyproject.toml / Cargo.toml          → confidence: medium (non-npm toolchains; W1)
//   5. next.config.* / tsconfig.json       → confidence: low

import { resolve } from 'node:path';
import type { DetectionResult, DetectorOptions } from './types.ts';
import { readAif } from './read-aif.ts';
import { readManifest, readAllDepsSet } from './read-manifest.ts';
import { readPythonCargo } from './read-python-cargo.ts';
import { readConfig } from './read-config.ts';
import { toConfidence } from './confidence.ts';
import { computeMissing } from './known-packages.ts';
import { detectPatterns } from './patterns.ts';

export type { DetectionResult, DetectorOptions, Stack, Framework, Runtime } from './types.ts';
export type { Confidence, Severity, ConfidenceTuple, Priority } from './confidence.ts';
export { AifSchemaError } from './read-aif.ts';

export function detectStack(
  projectRoot: string,
  opts: DetectorOptions = {},
): DetectionResult {
  const root = resolve(projectRoot);

  const partial = ((): DetectionResult => {
    if (!opts.skipAif) {
      const aif = readAif(root);
      if (aif) return aif;
    }

    const manifest = readManifest(root);
    if (manifest) return manifest;

    // Non-npm toolchain manifests (pyproject.toml → python, Cargo.toml → cargo).
    // After package.json (JS-first history preserved: a polyglot repo with a
    // package.json keeps its JS detection) but before the weaker config-presence
    // signal, since an explicit language manifest outranks next.config/tsconfig.
    const pythonCargo = readPythonCargo(root);
    if (pythonCargo) return pythonCargo;

    const config = readConfig(root);
    if (config) return config;

    // Nothing matched — emit a low-confidence "unknown" result, source: <empty>.
    const tuple = toConfidence(5);
    return {
      stack: 'unknown',
      framework: { name: null, version: null, major: null },
      runtime: { name: 'node', major: null },
      ...tuple,
      source: '',
      rules: { applicable: [], skipped: [] },
    };
  })();

  return {
    ...partial,
    patterns: detectPatterns(root),
    missing: partial.missing ?? computeMissing(readAllDepsSet(root)),
  };
}

// Direct invocation: `npx tsx detector/index.ts <projectRoot>` → JSON to stdout.
const moduleUrl = new URL(import.meta.url).pathname;
if (process.argv[1] && resolve(process.argv[1]) === resolve(moduleUrl)) {
  const root = process.argv[2] ?? process.cwd();
  const result = detectStack(root);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
