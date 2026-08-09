import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emit, EmitError } from './emit.ts';
import { synthesize } from './synthesize.ts';
import type { ResearchEntry, ResearchPlan } from '../research/types.ts';

const provenance = {
  url: 'https://nextjs.org/docs/app',
  allowlistKey: 'next.official',
  fetchedAt: '2026-05-08',
};

const entry = (id: string): ResearchEntry => ({
  id,
  summary: `summary for ${id}`,
  bestPractices: [],
  antiPatterns: [],
  provenance: [provenance],
});

const plan = (overrides: Partial<ResearchPlan> = {}): ResearchPlan => ({
  framework: 'next',
  version: '16.0.0',
  patterns: [],
  missing: [],
  drift: null,
  ...overrides,
});

describe('emit — side-effect filesystem writer', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'synth-emit-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes 3 files for an empty SynthesisPlan (own-repo case)', () => {
    const synthPlan = synthesize(plan({ framework: null }));
    emit(synthPlan, dir);
    const additions = JSON.parse(
      readFileSync(resolve(dir, 'rules-manifest-additions.json'), 'utf8'),
    );
    expect(additions).toEqual({});
    const md = readFileSync(resolve(dir, 'RULES-additions.md'), 'utf8');
    expect(md).toContain('# Synthesized rules');
    const snippet = JSON.parse(
      readFileSync(resolve(dir, 'eslint-rules-snippet.json'), 'utf8'),
    );
    expect(snippet).toEqual({});
  });

  it('writes 3 files with content for a non-empty SynthesisPlan', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    emit(synthPlan, dir);
    const additions = JSON.parse(
      readFileSync(resolve(dir, 'rules-manifest-additions.json'), 'utf8'),
    );
    expect(additions).toHaveProperty('G1');
    expect(additions.G1).toHaveProperty('check');
    const md = readFileSync(resolve(dir, 'RULES-additions.md'), 'utf8');
    expect(md).toContain('## G1');
    const snippet = JSON.parse(
      readFileSync(resolve(dir, 'eslint-rules-snippet.json'), 'utf8'),
    );
    expect(snippet).toHaveProperty('no-restricted-imports');
  });

  it('is idempotent — emitting the same plan twice produces no diff', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    emit(synthPlan, dir);
    const before = readFileSync(resolve(dir, 'rules-manifest-additions.json'));
    emit(synthPlan, dir);
    const after = readFileSync(resolve(dir, 'rules-manifest-additions.json'));
    expect(before.equals(after)).toBe(true);
  });

  it('writes a provenance header for declarative rules (generated-marker + hash)', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('test-only-forbid-declarative')] }),
    );
    emit(synthPlan, dir);
    const prov = JSON.parse(
      readFileSync(resolve(dir, 'provenance.json'), 'utf8'),
    );
    expect(prov.generatedBy).toBe('rules-as-tests-synth');
    expect(prov.rules.G1.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(prov.rules.G1.source.entryId).toBe('test-only-forbid-declarative');
  });

  // getff-freshness-widening S1b criterion 7 (M2 rework): bind the Node lane's per-rule
  // generation-context fragment file (emit.ts:97-103 writes `<dir>/generation-context/<plan-id>.json`).
  // The diff originally argued criterion 7 in prose only ("unregressed by leaving it alone"); the
  // rework requires an assertion so a future move of emit.ts:97 (e.g. into a per-lane subdir that
  // would break the non-recursive cargo/go glob) lands loudly. Out-of-scope per the rework: the
  // cold-audit-noted self-tension between criterion 4 and criterion 7 for the Node lane's own
  // fragments (they DO surface in the cargo/go locks via the parent-dir glob, and preserving that
  // is what criterion 7 requires) — that is pre-existing behaviour and parked for the maintainer.
  it('writes a per-rule generation-context fragment for the Node synthesize lane (S1b criterion 7)', () => {
    const synthPlan = synthesize(plan({ patterns: [entry('nextjs-app-router')] }));
    emit(synthPlan, dir);
    const fragPath = resolve(dir, 'generation-context', 'G1.json');
    const frag = JSON.parse(readFileSync(fragPath, 'utf8'));
    expect(frag.id).toBe('G1');
    expect(Array.isArray(frag.provenance)).toBe(true);
    expect(frag.provenance).toHaveLength(1);
    expect(typeof frag.tier).toBe('number');
  });

  it('throws EmitError when output directory does not exist', () => {
    const synthPlan = synthesize(plan({ framework: null }));
    expect(() => emit(synthPlan, '/no/such/directory/xyz')).toThrow(EmitError);
  });

  it('throws EmitError when output path is not a directory', () => {
    const synthPlan = synthesize(plan({ framework: null }));
    expect(() => emit(synthPlan, resolve(__dirname, 'emit.ts'))).toThrow(
      EmitError,
    );
  });
});
