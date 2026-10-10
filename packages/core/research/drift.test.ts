import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectDrift, SELF_APP_SOURCES } from './drift.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, 'fixtures', 'drift');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const LEGACY_FIXTURE_SOURCES = SELF_APP_SOURCES.map((path) => path.replace('.agents/procedures/', 'skills/'));

describe('detectDrift — symbolic drift v1 (open-questions §13.7 first half)', () => {
  it('returns zero mismatches on the no-drift fixture', () => {
    const report = detectDrift(resolve(FIXTURES, 'no-drift'));
    expect(report.sources).toEqual(LEGACY_FIXTURE_SOURCES);
    expect(report.mismatches).toEqual([]);
  });

  it('flags the with-drift fixture: term-presence + modal-verb mismatches', () => {
    const report = detectDrift(resolve(FIXTURES, 'with-drift'));
    expect(report.mismatches.length).toBeGreaterThan(0);

    const termPresence = report.mismatches.filter(
      (m) => m.kind === 'term-presence',
    );
    expect(termPresence.length).toBeGreaterThanOrEqual(1);
    expect(termPresence.some((m) => m.detail.includes('mutation testing') || m.detail.includes('two-AI'))).toBe(true);

    const modalVerb = report.mismatches.filter((m) => m.kind === 'modal-verb');
    expect(modalVerb.length).toBeGreaterThanOrEqual(1);
    expect(modalVerb.some((m) => m.detail.includes('AST over grep'))).toBe(true);
  });

  it('throws when a self-application source file is missing', () => {
    expect(() => detectDrift(resolve(FIXTURES, 'no-such-fixture'))).toThrow(
      /Self-application source missing/,
    );
  });

  it('returns zero mismatches against the real repo HEAD (canary)', () => {
    const report = detectDrift(REPO_ROOT);
    if (report.mismatches.length > 0) {
      console.warn('Real-repo drift surfaced:', report.mismatches);
    }
    expect(report.sources).toEqual([...SELF_APP_SOURCES]);
    expect(report.mismatches).toEqual([]);
  });
});
