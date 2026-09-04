/**
 * Principle 32 — Pre-push section owner-split (launch-preannounce-track S3)
 *
 * Source: .claude/orchestrator-prompts/launch-preannounce-track/kickoff.md §S3 (1);
 *         README.md#why-this-exists invariant 4 (multi-channel enforcement — a rule
 *         fails at the earliest reachable channel; here: pre-push composition);
 *         .claude/rules/attention-is-not-a-mechanism.md §1 (a load-bearing check must
 *         be a deterministic gate, not "a maintainer will remember the guard").
 *
 * Invariant this gate enforces (the STRUCTURAL replacement of the #923/#943 per-section
 * `existsSync` consumer-skip band-aid):
 *
 *   Every pre-push section carries a declarative OWNER tag (consumer | maintainer |
 *   both). The consumer composition (`activeSections(false)`) contains ZERO
 *   maintainer-only sections, so a maintainer section cannot leak onto a consumer's
 *   push by a forgotten guard. An untagged / mistagged section is caught here at CI
 *   AND fails CLOSED at runtime (`composeSections` throws) — a leak is impossible in
 *   both channels.
 *
 * Why a gate and not prose: `attention-is-not-a-mechanism.md` — "a future maintainer
 * will remember to guard their new section" is bare attention, not a mechanism. This
 * test is the deterministic detection layer; the owner tag + composition is the gate.
 *
 * T15 self-application: this principle is the pre-push composition applied to itself —
 * the same "every section is owner-tagged, no maintainer section reaches a consumer"
 * property, checked mechanically at the pre-push channel (§5 runs test:principles).
 *
 * Zero paid LLM (no-paid-llm-in-ci.md): pure structural import + source read.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SECTIONS,
  VALID_OWNERS,
  activeSections,
  composeSections,
  type PrePushSection,
  type SectionOwner,
} from '../hooks/pre-push.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const PREPUSH_SRC = readFileSync(
  resolve(REPO_ROOT, 'packages/core/hooks/pre-push.ts'),
  'utf8',
);

/** Extract the body of `async function main()` for the source-structural checks. */
function mainBody(src: string): string {
  const start = src.indexOf('async function main(');
  expect(
    start,
    'async function main( must exist in pre-push.ts',
  ).toBeGreaterThan(-1);
  // main() ends at the isDirectCliInvocation guard block that follows it.
  const end = src.indexOf('function isDirectCliInvocation(', start);
  expect(end, 'isDirectCliInvocation must follow main()').toBeGreaterThan(
    start,
  );
  return src.slice(start, end);
}

describe('principle 32 — every pre-push section is owner-tagged', () => {
  it('the registry is populated (anti-vacuous floor)', () => {
    // Guards against a truncated/emptied registry silently passing every other check.
    // 22 sections at authoring time; the floor is deliberately below that so adding
    // one does not trip it, while a collapse to a handful does.
    expect(SECTIONS.length).toBeGreaterThanOrEqual(18);
  });

  it('every section has a VALID owner tag (untagged / mistagged section fails here)', () => {
    const untagged = SECTIONS.filter(
      (s) => !VALID_OWNERS.includes(s.owner as SectionOwner),
    ).map((s) => `${s.id}=${JSON.stringify(s.owner)}`);
    expect(
      untagged,
      `untagged/mistagged sections: ${untagged.join(', ')}`,
    ).toEqual([]);
  });

  it('every section has a unique, non-empty id', () => {
    const ids = SECTIONS.map((s) => s.id);
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size, `duplicate ids in ${ids.join(', ')}`).toBe(
      ids.length,
    );
  });

  it('the CONSUMER composition contains ZERO maintainer-only sections (no leak)', () => {
    const leaked = activeSections(false)
      .filter((s) => s.owner === 'maintainer')
      .map((s) => s.id);
    expect(
      leaked,
      `maintainer sections leaked to consumer: ${leaked.join(', ')}`,
    ).toEqual([]);
  });

  it('the MAINTAINER composition contains ZERO consumer-only sections', () => {
    const misplaced = activeSections(true)
      .filter((s) => s.owner === 'consumer')
      .map((s) => s.id);
    expect(
      misplaced,
      `consumer-only sections in maintainer composition: ${misplaced.join(', ')}`,
    ).toEqual([]);
  });

  it('both compositions are non-empty (every layout runs something)', () => {
    expect(activeSections(false).length).toBeGreaterThan(0);
    expect(activeSections(true).length).toBeGreaterThan(0);
  });

  it('composeSections FAILS CLOSED on an untagged section (runtime paired-negative)', () => {
    // RED-arm baked into the gate: an untagged section must abort composition, never
    // silently skip (which would be the same silent-leak failure the owner tag prevents).
    const untagged = {
      id: 'artificially-untagged',
      // deliberately no valid owner — the exact "forgot to tag" state the gate catches.
      owner: undefined as unknown as SectionOwner,
      run: () => {},
    } satisfies PrePushSection;
    expect(() => composeSections([untagged], false)).toThrow(
      /no valid owner tag/,
    );
    expect(() => composeSections([untagged], true)).toThrow(
      /no valid owner tag/,
    );
    // A mistagged (non-empty but invalid) owner is caught the same way.
    const mistagged = {
      id: 'artificially-mistagged',
      owner: 'todo' as SectionOwner,
      run: () => {},
    };
    expect(() => composeSections([mistagged], false)).toThrow(
      /no valid owner tag/,
    );
  });

  it('main() composes via activeSections() and does NOT inline section primitives', () => {
    // Structural guard against the inline-bypass leak vector: a future maintainer adding
    // section logic directly in main() (outside the registry) would run on BOTH layouts.
    // main() must delegate to the registry (activeSections) and must not call the
    // section primitive `requireTool(` inline — those belong in registered *Section fns.
    const body = mainBody(PREPUSH_SRC);
    expect(body).toMatch(/for \(const section of activeSections\(/);
    expect(
      body,
      'main() must not inline requireTool() — put section logic in a registered *Section fn',
    ).not.toMatch(/requireTool\(/);
  });
});
