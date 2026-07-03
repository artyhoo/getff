// Curated research store loader: deterministic, semver-aware.
// Layout: store/<framework>/<major>.x/<patternId>.json + store/<framework>/any/<patternId>.json + store/shared/<patternId>.json
// Resolution priority:
//   1. store/<framework>/<major>.x/<patternId>.json   — exact major
//   2. store/<framework>/<major-1>.x/<patternId>.json — single-major fallback
//   3. store/<framework>/any/<patternId>.json         — version-agnostic per-framework
//   4. store/shared/<patternId>.json                  — version-agnostic cross-framework
// Each loaded entry is validated against research-plan.schema.json#/definitions/ResearchEntry.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';
import { validateProvenance } from './allowlist.ts';
import { resolveAllowedSources, validateProvenance as validateProvenanceResolved } from './allowlist-resolver.ts';
import { errorsText, validateEntry } from './internal-validators.ts';
import { ajvErrorsToDiagnostics } from '../diagnostics/ajv.ts';
import type { Diagnostic } from '../diagnostics/types.ts';
import type { ResearchEntry } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// AIF_SYNTH_PKG_ROOT: bundle anchor fix — see internal-validators.ts for rationale.
const _pkgCore = process.env['AIF_SYNTH_PKG_ROOT'];
const STORE_ROOT = _pkgCore
  ? resolve(_pkgCore, 'research', 'store')
  : resolve(HERE, 'store');

export class ResearchEntryError extends Error {
  constructor(
    public readonly path: string,
    public readonly errors: string,
    public readonly diagnostics: Diagnostic[] = [],
  ) {
    super(`Invalid research entry at ${path}: ${errors}`);
    this.name = 'ResearchEntryError';
  }
}

// DN-D1-3: adapter-only — tryLoad/loadEntries keep throw-per-entry semantics
// (first bad entry throws, no accumulation across entries). `.diagnostics`
// is additive: still exactly one Diagnostic per throw, carried alongside
// the unchanged `.errors`/`.message` string contract that existing callers
// (load.test.ts; none of them inspect `.diagnostics`) read.
function tryLoad(filePath: string): ResearchEntry | null {
  if (!existsSync(filePath)) return null;
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!validateEntry(raw)) {
    throw new ResearchEntryError(
      filePath,
      errorsText(validateEntry.errors),
      ajvErrorsToDiagnostics(validateEntry.errors),
    );
  }
  const entry = raw as ResearchEntry;
  for (const p of entry.provenance) {
    const v = validateProvenance(p);
    if (!v.ok) {
      // Re-resolve via the 3-arg Tier-0-only form to recover the full
      // Diagnostic (code/params) for `.diagnostics` — the 1-arg wrapper
      // above (validateProvenance(p), DN-D1-1) is called first and used for
      // the throw decision + message text (byte-identical to pre-D1); this
      // second call is additive, not a behavior change to the throw path.
      const tier0Only = resolveAllowedSources();
      const d = validateProvenanceResolved(p, tier0Only);
      throw new ResearchEntryError(
        filePath,
        `provenance violation — ${v.reason}`,
        d ? [d] : [],
      );
    }
  }
  return entry;
}

function candidatePaths(
  framework: string | null,
  version: string | null,
  patternId: string,
): string[] {
  const paths: string[] = [];
  if (framework) {
    const coerced = version ? semver.coerce(version) : null;
    const major = coerced?.major ?? null;
    if (major !== null) {
      paths.push(resolve(STORE_ROOT, framework, `${major}.x`, `${patternId}.json`));
      if (major > 0) {
        paths.push(
          resolve(STORE_ROOT, framework, `${major - 1}.x`, `${patternId}.json`),
        );
      }
    }
    paths.push(resolve(STORE_ROOT, framework, 'any', `${patternId}.json`));
  }
  paths.push(resolve(STORE_ROOT, 'shared', `${patternId}.json`));
  return paths;
}

export function loadEntries(
  framework: string | null,
  version: string | null,
  patterns: string[],
): ResearchEntry[] {
  const out: ResearchEntry[] = [];
  for (const id of patterns) {
    for (const path of candidatePaths(framework, version, id)) {
      const entry = tryLoad(path);
      if (entry) {
        out.push(entry);
        break;
      }
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
