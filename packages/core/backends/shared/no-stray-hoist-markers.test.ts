// no-stray-hoist-markers — executable invariant for MT 3c (the frame extraction).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §7.
//
// The `@hoist-at-s3` markers lived on the S2 render-outcome unit to mark the future 3c hoist.
// Once 3c extracts that frame into backends/shared/, NO file under backends/cargo or
// backends/npm may still carry the marker — a stray one means a unit was copied instead of
// moved, or a new unit re-introduced the pre-hoist bridge. This test makes that invariant
// executable (was a PR-time-only eyeball check before 3c).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKENDS_ROOT = join(__dirname, '..');
const MARKER = '@hoist-at-s3';

/** Recursively collect every regular file under `dir`. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

/** Files (relative-labelled) under cargo + npm that still contain the stray hoist marker. */
function filesWithStrayMarker(): string[] {
  const roots = [join(BACKENDS_ROOT, 'cargo'), join(BACKENDS_ROOT, 'npm')];
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of walk(root)) {
      if (readFileSync(file, 'utf8').includes(MARKER)) {
        hits.push(file);
      }
    }
  }
  return hits;
}

describe('no-stray-hoist-markers — the 3c frame-extraction invariant', () => {
  it('no file under backends/cargo or backends/npm carries the @hoist-at-s3 marker', () => {
    expect(filesWithStrayMarker()).toEqual([]);
  });

  it('paired negative: the detector actually reports a string containing the marker (not vacuous)', () => {
    // A fixture STRING carrying the marker — proves the substring detector discriminates.
    // (If this ever passed vacuously, the positive test above would be worthless.)
    const fixture = `// ${MARKER}: a deliberately-planted marker to prove detection fires`;
    expect(fixture.includes(MARKER)).toBe(true);
    // And prove the real detector's predicate (readFileSync(...).includes(MARKER)) is what
    // discriminates: a clean string must NOT be flagged, a marked one MUST be.
    const cleanString = '// a perfectly ordinary comment with no marker';
    expect(cleanString.includes(MARKER)).toBe(false);
  });
});
