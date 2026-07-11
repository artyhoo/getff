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
// borrowed eslint no-restricted-syntax rule (fireRestricted, SSOT #154), and the three computed
// Enforced lines are asserted as the exact honest-refusal goldens.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fireRestricted } from '../../backends/npm/firing-runner.ts';
import { findRegions, regionsMatch } from '../fence.ts';
import {
  DEMO_SECTION_ID,
  DEMO_TIME_SECTION_ID,
  astgrepDemoNode,
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
// mechanism has no combined "Python segment" (segment granularity is per-backend) — AND with the
// node its primary target fires on (no-datetime-now, the P5 case, own "Time handling" section),
// mirroring how cargo/npm each entered MT S4 with a node of their own: every backend in the demo
// renders ✅ exactly its own toolchain's node and honestly refuses the others (FF7001
// capability/class gap, FF7002 params-contract gap).
const GOLDEN_CARGO_NODE_ENFORCED =
  '> Enforced: astgrep-python-yaml — FF7001 (type-aware bans need a type checker; route to the mypy backend (deferred, post-v0)) · cargo-clippy-toml ✅ · npm-eslint-declarative — FF7001 (typed rules are not expressible in the no-restricted-syntax declarative class; route to a type-aware backend (post-v0)) · ruff-tidy-imports-toml — FF7001 (type-aware bans need a type checker; route to the mypy backend (deferred, post-v0))';
const GOLDEN_NPM_NODE_ENFORCED =
  '> Enforced: astgrep-python-yaml — FF7002 (params contract violation: missing/invalid kind) · cargo-clippy-toml — FF7001 (not expressible in clippy.toml; route to the ast-grep escape-hatch backend (post-v0)) · npm-eslint-declarative ✅ · ruff-tidy-imports-toml — FF7002 (params contract violation: missing/invalid kind)';
const GOLDEN_ASTGREP_NODE_ENFORCED =
  '> Enforced: astgrep-python-yaml ✅ · cargo-clippy-toml — FF7001 (not expressible in clippy.toml; route to the ast-grep escape-hatch backend (post-v0)) · npm-eslint-declarative — FF7002 (params contract violation: missing/invalid selector) · ruff-tidy-imports-toml — FF7001 (call-with-args ban not expressible in ruff (bans a qualified name, not a call site); route to the ast-grep backend (#212))';

describe('root-AGENTS.md demo — ratchet (T15 self-application: byte-gate our own root doc)', () => {
  it('the committed ROOT AGENTS.md regions are BYTE-equal to the re-composed demo regions', () => {
    const source = readFileSync(ROOT_AGENTS_MD, 'utf8');
    // regionsMatch is the shipped byte-check (body === `\n${content}\n`). A drifted doc → false.
    // BOTH demo regions ratcheted: the MT S4 configuration one + the S3 Python-lane one.
    expect(
      regionsMatch(
        source,
        new Map([
          [DEMO_SECTION_ID, buildDemoRegion(DEMO_SECTION_ID)],
          [DEMO_TIME_SECTION_ID, buildDemoRegion(DEMO_TIME_SECTION_ID)],
        ]),
      ),
    ).toBe(true);
  });

  it('each committed region body equals buildDemoRegion(sectionId) exactly (explicit toBe)', () => {
    const source = readFileSync(ROOT_AGENTS_MD, 'utf8');
    for (const sectionId of [DEMO_SECTION_ID, DEMO_TIME_SECTION_ID]) {
      const region = findRegions(source).find((r) => r.sectionId === sectionId);
      expect(region).toBeDefined();
      // findRegions returns body wrapped as `\n${content}\n` (the injector's framing).
      expect((region as { body: string }).body).toBe(`\n${buildDemoRegion(sectionId)}\n`);
    }
  });

  it('the regions carry the preamble line + ALL THREE computed Enforced lines', () => {
    const configRegion = buildDemoRegion(DEMO_SECTION_ID);
    const timeRegion = buildDemoRegion(DEMO_TIME_SECTION_ID);
    expect(configRegion).toContain('_Generated demo region (MT stage 4)');
    expect(timeRegion).toContain('_Generated demo region (MT stage 4)');
    expect(configRegion).toContain(GOLDEN_CARGO_NODE_ENFORCED);
    expect(configRegion).toContain(GOLDEN_NPM_NODE_ENFORCED);
    expect(timeRegion).toContain(GOLDEN_ASTGREP_NODE_ENFORCED);
  });

  it('emits NO `hash=` bytes anywhere in the composed demo regions (T-END-B)', () => {
    expect(buildDemoRegion(DEMO_SECTION_ID)).not.toContain('hash=');
    expect(buildDemoRegion(DEMO_TIME_SECTION_ID)).not.toContain('hash=');
  });

  it('T-PY-D: the multi-backend Enforced lines join segments with " · ", never ", "', () => {
    // A12-separator pin (#905, enforcement-line.ts:97/103) against regression, ON THE DEMO's own
    // now-4-backend goldens (python-backend-v0 S3). All three demo nodes yield 4 segments, so the
    // inter-segment separator is exercised for real here (not just a synthetic fixture).
    const bothRegions = `${buildDemoRegion(DEMO_SECTION_ID)}\n${buildDemoRegion(DEMO_TIME_SECTION_ID)}`;
    const enforcedLines = bothRegions.split('\n').filter((l) => l.startsWith('> Enforced:'));
    expect(enforcedLines).toHaveLength(3);
    for (const line of enforcedLines) {
      // Must carry the middle-dot separator between per-backend segments.
      expect(line).toContain(' · ');
      // Must NOT reintroduce comma-space at a SEGMENT boundary. Commas inside the parenthesized
      // refusal notes are legitimate, so blank the notes before the negative check (same
      // technique as compose.test.ts A12-pin).
      const withoutNotes = line.replace(/\([^)]*\)/g, '()');
      expect(withoutNotes).not.toMatch(/, /);
    }
    // Explicit: the astgrep + ruff Python-lane segments are present on EVERY line (S3 wiring).
    for (const line of enforcedLines) {
      expect(line).toContain('astgrep-python-yaml');
      expect(line).toContain('ruff-tidy-imports-toml');
    }
    // And the Python PRIMARY target fires in the demo: exactly one astgrep ✅ segment.
    const astgrepFired = enforcedLines.filter((l) => l.includes('astgrep-python-yaml ✅'));
    expect(astgrepFired).toHaveLength(1);
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

  it('astgrep node is syntax-class (its ✅ is backed by the astgrep matrix live-fired cell)', () => {
    // The astgrep live-fire itself is CI-gated (backends/astgrep/firing.test.ts — pinned
    // @ast-grep/cli install, fires for real in CI; the P5 case). Here we assert the demo wires
    // the SAME shipped FIXTURE_NODE whose syntax matrix cell carries the committed live-fired
    // evidence the `astgrep-python-yaml ✅` segment derives from (python-backend-v0 S3).
    expect(astgrepDemoNode().selectorClass).toBe('syntax');
    expect(astgrepDemoNode().id).toBe('no-datetime-now');
    expect(astgrepDemoNode().params['kind']).toBe('call');
  });
});
