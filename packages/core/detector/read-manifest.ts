// Priority 4: package.json deps + lockfile signature.
// Extends detector-v0/detect-applicable-rules.ts logic — manifest-based heuristic fallback.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DetectionResult } from './types.ts';
import { toConfidence } from './confidence.ts';
import { extractMajor, extractVersion } from './version-aware.ts';
import { computeMissing } from './known-packages.ts';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readPkg(projectRoot: string): { pkg: PackageJson; allDeps: Record<string, string> } | null {
  const pkgPath = resolve(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return null;
  // Malformed package.json degrades to null (fail-closed to the no-manifest branch),
  // never throws — the universal detector idiom (readConfig / patterns.ts / the npm,
  // cargo and pip adapters all guard their reads). Unguarded, this parse threw
  // SyntaxError from every detectStack() call (index.ts readManifest + readAllDepsSet),
  // making resolveCtxForRoot a NEW crash on input that exited 0 pre-wiring — the same
  // class as the W2 AifSchemaError MAJOR (fix 77ec10daf). Adapter-jig arm A1 regression:
  // synthesizer/resolve-ctx.test.ts (@arm:A1:neg).
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
  const allDeps: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  return { pkg, allDeps };
}

export function readAllDepsSet(projectRoot: string): Set<string> {
  const result = readPkg(projectRoot);
  if (!result) return new Set();
  return new Set(Object.keys(result.allDeps));
}

export function readManifest(projectRoot: string): DetectionResult | null {
  const result = readPkg(projectRoot);
  if (!result) return null;
  const { allDeps } = result;

  const tuple = toConfidence(4);
  const source = 'package.json';
  const baseRules = { applicable: [] as string[], skipped: [] as string[] };
  const missing = computeMissing(new Set(Object.keys(allDeps)));

  if ('next' in allDeps) {
    const range = allDeps.next;
    return {
      stack: 'react-next',
      framework: { name: 'next', version: extractVersion(range), major: extractMajor(range) },
      runtime: { name: 'node', major: null },
      ...tuple,
      source,
      rules: baseRules,
      missing,
    };
  }

  if ('react' in allDeps || '@types/react' in allDeps) {
    const range = allDeps.react ?? allDeps['@types/react'];
    return {
      stack: 'react-next',
      framework: { name: 'react', version: extractVersion(range), major: extractMajor(range) },
      runtime: { name: 'node', major: null },
      ...tuple,
      source,
      rules: baseRules,
      missing,
    };
  }

  // No React/Next markers → server-side TS by default (matches setup.sh:94 fallback).
  return {
    stack: 'ts-server',
    framework: { name: null, version: null, major: null },
    runtime: { name: 'node', major: null },
    ...tuple,
    source,
    rules: baseRules,
    missing,
  };
}
