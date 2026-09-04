/**
 * Principle 8 — Prior-art cited via SSOT (build-vs-reuse invariant)
 *
 * Source: docs/meta-factory/prior-art-evaluations.md (T1 SSOT) +
 *         docs/meta-factory/EXECUTION-PLAN.md §5.5 Step 1.5 (T6 consult gate)
 *
 * Invariant: every framework artifact claiming new capability cites at least
 * one prior-art-evaluations.md entry by ID. T3 enforces this on phase research
 * files; later retro decides whether to widen the scope to design docs and
 * retros based on observed false-positive rate.
 *
 * Initial scope (T3):
 *   - docs/meta-factory/phase-*-research.md
 *   - docs/meta-factory/phase-*-entry-research.md
 *
 * Pre-T3 baseline (existing files exempt from citation requirement, but the
 * broken-reference check still applies — a baseline file that names #999
 * without an entry still fails). Baseline list reflects the actually-existing
 * pre-T3 research files; the prompt's `phase-N-entry-research.md` naming
 * pattern is forward-compatible (no such file exists in the repo at T3 time).
 *
 * Recursive self-application (per aif-comparison.md §10 differentiator #4):
 * the principle applies to its own implementation. Phase 8.8 commits T2-T11
 * carry `Prior-art:` trailers; the principle test below validates that
 * artifacts (research files) cite the SSOT, closing the loop.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const META_DIR = resolve(HERE, '../../../docs/meta-factory');
const SSOT_PATH = resolve(META_DIR, 'prior-art-evaluations.md');

const RESEARCH_FILE_RE = /^phase-\d+(?:\.\d+)?(?:-entry)?-research\.md$/;

const BASELINE_EXCEPTIONS = new Set<string>([
  'phase-3-research.md',
  'phase-4-research.md',
  'phase-5-research.md',
  'phase-6-research.md',
  'phase-7-research.md',
  'phase-8-research.md',
]);

const CITATION_RE = /prior-art-evaluations\.md#(\d+)/g;

function readFile(p: string): string {
  return readFileSync(p, 'utf8');
}

function loadSsotEntryIds(): Set<number> {
  return collectSsotEntryIds(readFile(SSOT_PATH)).ids;
}

/**
 * Extract every §4-table entry ID, preserving duplicates. Exported for the
 * uniqueness invariant below: `ids` is the citation-target set (unchanged
 * behaviour), `duplicates` is every ID that appears on more than one row.
 *
 * Why uniqueness is load-bearing (incident 2026-08-01): token-economy stage B
 * (#1204) and arch-v2 S-C (#1197) each appended a row claiming ID 233 —
 * "next free ID" was computed independently on two branches forked from the
 * same staging. Each PR was green in isolation because this principle only
 * verified that a cited ID EXISTS; the duplicate would have been born at
 * merge, silently splitting every future `#233` citation between two
 * entries in an append-only register keyed by ID. Caught by a session-side
 * probe, fixed by renumbering, and closed as a class here: the second PR to
 * land now fails CI instead of minting the collision.
 */
export function collectSsotEntryIds(content: string): {
  ids: Set<number>;
  duplicates: number[];
} {
  const ids = new Set<number>();
  const duplicates = new Set<number>();
  // SSOT §4 entries: lines like `| 1 | Autogrep ... |`. Header schema tables
  // in §1/§2 have non-numeric first cells, so the digit anchor filters them.
  const rowRe = /^\|\s*(\d+)\s*\|/gm;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(content)) !== null) {
    const id = Number(m[1]);
    if (ids.has(id)) duplicates.add(id);
    ids.add(id);
  }
  return { ids, duplicates: [...duplicates].sort((a, b) => a - b) };
}

function extractCitations(content: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  CITATION_RE.lastIndex = 0;
  while ((m = CITATION_RE.exec(content)) !== null) out.push(Number(m[1]));
  return out;
}

function assertPrinciple8(
  filename: string,
  content: string,
  ssotIds: ReadonlySet<number>,
): void {
  const citations = extractCitations(content);

  // Broken-reference check applies to ALL files (incl. baseline-exempt).
  for (const id of citations) {
    if (!ssotIds.has(id)) {
      throw new Error(
        `${filename}: cites prior-art-evaluations.md#${id} but no such entry exists in SSOT — broken citation`,
      );
    }
  }

  // Citation-presence check only applies to non-baseline files.
  if (BASELINE_EXCEPTIONS.has(filename)) return;
  if (citations.length === 0) {
    throw new Error(
      `${filename}: research file declares new capabilities but cites zero prior-art-evaluations.md entries — required by principle 08. Add an entry to the SSOT and cite it as [prior-art-evaluations.md#N], or document a structured rationale for skipping in the file's introduction.`,
    );
  }
}

describe('Principle 8 — every framework artifact claiming new capability cites prior-art-evaluations.md (SSOT)', () => {
  it('all phase research files in scope satisfy citation invariant (or are pre-T3 baseline)', () => {
    const ssotIds = loadSsotEntryIds();
    expect(ssotIds.size, 'SSOT must have at least one entry — T2 added Autogrep').toBeGreaterThan(0);

    const inScope = readdirSync(META_DIR).filter((f) => RESEARCH_FILE_RE.test(f));
    expect(inScope.length, 'expected at least one phase-*-research.md file in scope').toBeGreaterThan(0);

    const violations: string[] = [];
    for (const f of inScope) {
      try {
        assertPrinciple8(f, readFile(resolve(META_DIR, f)), ssotIds);
      } catch (err) {
        violations.push((err as Error).message);
      }
    }
    expect(violations, `Violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('mutation: research file with no citations (and not in baseline) fails assertion (anti-tautology)', () => {
    const ssotIds = loadSsotEntryIds();
    const fake = '# Phase 99 research\n## Build vs reuse\nWe build a new abstraction X.\n';
    expect(() => assertPrinciple8('phase-99-research.md', fake, ssotIds)).toThrow(
      /cites zero prior-art-evaluations\.md entries/,
    );
  });

  it('mutation: research file citing non-existent SSOT entry fails (broken-reference detection)', () => {
    const ssotIds = loadSsotEntryIds();
    const fake = '# Phase 99\nSee [prior-art-evaluations.md#999](../prior-art-evaluations.md#999).\n';
    expect(() => assertPrinciple8('phase-99-research.md', fake, ssotIds)).toThrow(
      /no such entry exists in SSOT/,
    );
  });

  it('positive: research file with valid citation to entry #1 (Autogrep) passes', () => {
    const ssotIds = loadSsotEntryIds();
    const valid =
      '# Phase 99 research\nWe defer L3 LLM-driven generation per [prior-art-evaluations.md#1](../prior-art-evaluations.md#1) (Autogrep, verdict DEFER).\n';
    expect(() => assertPrinciple8('phase-99-research.md', valid, ssotIds)).not.toThrow();
  });

  it('baseline: pre-T3 phase-3-research.md is exempt from citation-presence check', () => {
    const ssotIds = loadSsotEntryIds();
    const fake = '# Pre-T3 research file with no citations\n';
    expect(() => assertPrinciple8('phase-3-research.md', fake, ssotIds)).not.toThrow();
  });

  it('baseline: pre-T3 file with broken reference still fails (broken-ref check is universal)', () => {
    const ssotIds = loadSsotEntryIds();
    const fake = '# Pre-T3 file citing missing entry [prior-art-evaluations.md#777]\n';
    expect(() => assertPrinciple8('phase-3-research.md', fake, ssotIds)).toThrow(
      /no such entry exists in SSOT/,
    );
  });

  it('SSOT entry IDs are unique — an ID minted on two branches fails at merge, not silently (incident 2026-08-01: #1204 vs #1197 both claimed 233)', () => {
    const { duplicates } = collectSsotEntryIds(readFile(SSOT_PATH));
    expect(
      duplicates,
      `prior-art-evaluations.md assigns the same entry ID to multiple rows: ${duplicates
        .map((d) => `#${d}`)
        .join(', ')}. The register is append-only and keyed by ID — every citation of a ` +
        `duplicated ID is ambiguous. Renumber the later row(s) to the next free ID and ` +
        `update their citing files.`,
    ).toHaveLength(0);
  });

  it('mutation: duplicated entry ID is detected (anti-tautology for the uniqueness check)', () => {
    const fake = ['| 1 | **A** | x |', '| 2 | **B** | x |', '| 1 | **C** | x |', '| 2 | **D** | x |'].join('\n');
    const { ids, duplicates } = collectSsotEntryIds(fake);
    expect(duplicates).toEqual([1, 2]);
    expect([...ids].sort()).toEqual([1, 2]);
  });

  it('SSOT loader extracts numeric entry IDs from §4 table only (not §1/§2 schema headers)', () => {
    const ssotIds = loadSsotEntryIds();
    expect(ssotIds.has(1), 'entry #1 (Autogrep) must be present').toBe(true);
    // Negative invariant: schema-table headers like "| ID | string | ✓ |" must
    // not pollute the ID set. ID extraction regex requires a digit, so any
    // non-numeric "| ID |" cells are filtered. Sentinel: no entry #0.
    expect(ssotIds.has(0)).toBe(false);
  });
});
