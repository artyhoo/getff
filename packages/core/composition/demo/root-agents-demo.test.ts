// Root-AGENTS.md demo RATCHET — the flagship self-application (MT umbrella S4, PR-B, T15).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.1.
//
// The ratchet gates OUR OWN root doc: it reads the committed ROOT AGENTS.md, re-composes the
// "configuration-access" region from the committed plan + nodes + LIVE render facts via the
// SHIPPED compose()/fence machinery, and asserts BYTE-equality against what the doc carries. A
// hand-edit to any status/word inside the region (or an Enforced line drifting from what the
// backends actually render) turns the ratchet RED. This is the recursive-self-application check:
// the framework's own AI-doc is held to the same "documents can't silently lie" bar it ships.
//
// Also PROVES the demo's ✅ claims are real: the npm node's negative example FIRES the real
// borrowed eslint no-restricted-syntax rule (fireRestricted, SSOT #154), and the two computed
// Enforced lines are asserted as the exact two-sided honest-refusal goldens.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fireRestricted } from '../../backends/npm/firing-runner.ts';
import { findRegions, regionsMatch } from '../fence.ts';
import {
  DEMO_SECTION_ID,
  buildDemoRegion,
  cargoDemoNode,
  npmDemoNode,
} from './root-agents-demo.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/core/composition/demo -> repo root is four levels up.
const ROOT_AGENTS_MD = join(HERE, '..', '..', '..', '..', 'AGENTS.md');

// The honest-refusal Enforced lines — COMPUTED by compose()/enforcement-line.ts, NOT hardcoded
// into compose(). These goldens are what the shipped code emits from the live facts across ALL
// FOUR shipped backends (cargo, npm, astgrep #212, ruff #215), lexicographically ordered; the
// ratchet below proves the committed doc carries exactly them. The Python lane (python-backend-v0
// S3) enters as TWO segments — one per registered backend (astgrep + ruff), the enforcement-line
// mechanism has no combined "Python segment" (segment granularity is per-backend). On the cargo
// type-aware node the Python backends refuse FF7001 (capability-class gap → mypy deferred); on the
// npm JS-selector syntax node they refuse FF7002 (params-contract gap — neither node is a Python
// convention).
const GOLDEN_CARGO_NODE_ENFORCED =
  '> Enforced: astgrep-python-yaml — FF7001 (type-aware bans need a type checker; route to the mypy backend (deferred, post-v0)) · cargo-clippy-toml ✅ · npm-eslint-declarative — FF7001 (typed rules are not expressible in the no-restricted-syntax declarative class; route to a type-aware backend (post-v0)) · ruff-tidy-imports-toml — FF7001 (type-aware bans need a type checker; route to the mypy backend (deferred, post-v0))';
const GOLDEN_NPM_NODE_ENFORCED =
  '> Enforced: astgrep-python-yaml — FF7002 (params contract violation: missing/invalid kind) · cargo-clippy-toml — FF7001 (not expressible in clippy.toml; route to the ast-grep escape-hatch backend (post-v0)) · npm-eslint-declarative ✅ · ruff-tidy-imports-toml — FF7002 (params contract violation: missing/invalid kind)';

describe('root-AGENTS.md demo — ratchet (T15 self-application: byte-gate our own root doc)', () => {
  it('the committed ROOT AGENTS.md region is BYTE-equal to the re-composed demo region', () => {
    const source = readFileSync(ROOT_AGENTS_MD, 'utf8');
    const expected = buildDemoRegion();
    // regionsMatch is the shipped byte-check (body === `\n${content}\n`). A drifted doc → false.
    expect(regionsMatch(source, new Map([[DEMO_SECTION_ID, expected]]))).toBe(
      true,
    );
  });

  it('the committed region body equals buildDemoRegion() exactly (explicit toBe on the body)', () => {
    const source = readFileSync(ROOT_AGENTS_MD, 'utf8');
    const region = findRegions(source).find(
      (r) => r.sectionId === DEMO_SECTION_ID,
    );
    expect(region).toBeDefined();
    // findRegions returns body wrapped as `\n${content}\n` (the injector's framing).
    expect((region as { body: string }).body).toBe(`\n${buildDemoRegion()}\n`);
  });

  it('the region carries the preamble line + BOTH computed two-sided Enforced lines', () => {
    const region = buildDemoRegion();
    expect(region).toContain('_Generated demo region (MT stage 4)');
    expect(region).toContain(GOLDEN_CARGO_NODE_ENFORCED);
    expect(region).toContain(GOLDEN_NPM_NODE_ENFORCED);
  });

  it('emits NO `hash=` bytes anywhere in the composed demo region (T-END-B)', () => {
    expect(buildDemoRegion()).not.toContain('hash=');
  });

  it('T-PY-D: the multi-backend Enforced lines join segments with " · ", never ", "', () => {
    // A12-separator pin (#905, enforcement-line.ts:97/103) against regression, ON THE DEMO's own
    // now-4-backend goldens (python-backend-v0 S3). Both demo nodes yield ≥3 segments, so the
    // inter-segment separator is exercised for real here (not just a synthetic fixture).
    const region = buildDemoRegion();
    const enforcedLines = region.split('\n').filter((l) => l.startsWith('> Enforced:'));
    expect(enforcedLines).toHaveLength(2);
    for (const line of enforcedLines) {
      // Must carry the middle-dot separator between per-backend segments.
      expect(line).toContain(' · ');
      // Must NOT reintroduce comma-space at a SEGMENT boundary. Commas inside the parenthesized
      // refusal notes are legitimate, so blank the notes before the negative check (same
      // technique as compose.test.ts A12-pin).
      const withoutNotes = line.replace(/\([^)]*\)/g, '()');
      expect(withoutNotes).not.toMatch(/, /);
    }
    // Explicit: the astgrep + ruff Python-lane segments are both present (S3 wiring).
    for (const line of enforcedLines) {
      expect(line).toContain('astgrep-python-yaml');
      expect(line).toContain('ruff-tidy-imports-toml');
    }
  });
});

describe('root-AGENTS.md demo — the ✅ claims are LIVE-fired, not asserted', () => {
  it('npm node: the negative example FIRES the real borrowed no-restricted-syntax rule', () => {
    // The demo claims `npm-eslint-declarative ✅` for no-direct-process-env. Prove it: fire the
    // real eslint builtin (SSOT #154) configured from the node's own selector against its own
    // negative example — the rule MUST report (a firing case, not a hand-crafted assertion).
    const node = npmDemoNode();
    const selector = node.params['selector'] as string;
    const fired = fireRestricted(
      { selector, message: node.claim },
      node.pairedExamples.negative,
    );
    expect(fired.has('no-restricted-syntax')).toBe(true);
  });

  it('npm node: the positive example is SILENT (the accessor form does not fire)', () => {
    const node = npmDemoNode();
    const selector = node.params['selector'] as string;
    const fired = fireRestricted(
      { selector, message: node.claim },
      node.pairedExamples.positive,
    );
    expect(fired.has('no-restricted-syntax')).toBe(false);
    expect(fired.size).toBe(0);
  });

  it('cargo node is type-aware (its ✅ is backed by the cargo matrix live-fired cell)', () => {
    // The cargo live-fire itself is a developer-machine DoD gate (backends/cargo/firing.test.ts,
    // gated on cargo present && !CI). Here we assert the demo wires the type-aware node whose
    // matrix cell carries the committed live-fired evidence the Enforced ✅ derives from.
    expect(cargoDemoNode().selectorClass).toBe('type-aware');
    expect(cargoDemoNode().id).toBe('no-direct-env-var');
  });
});
