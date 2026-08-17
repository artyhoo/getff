// S1 criterion 5 direction (a): two locks GENERATED across a dependency bump
// differ programmatically-diffably in `version`. This exercises the real generator
// (synthesize + install), NOT a constructed heredoc — S2's declared input contract
// must be verified against the actual emitted artefact.
//
// Direction (b) — consumer project-version bump does NOT change version — is covered
// by tests/install-sh/rules-lock-version-diff.test.sh (runs the REAL install.sh python
// lane against two consumers with different [project] versions).

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { install } from './install.ts';
import { synthesize } from '../synthesizer/synthesize.ts';
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

const plan = (version: string): ResearchPlan => ({
  framework: 'next',
  version,
  patterns: [entry('nextjs-app-router')],
  missing: [],
  drift: null,
});

describe('S1 criterion 5 direction (a) — dependency bump → generated locks differ in version', () => {
  let dirA: string;
  let dirB: string;

  beforeEach(() => {
    dirA = mkdtempSync(resolve(tmpdir(), 's1-vdiff-a-'));
    dirB = mkdtempSync(resolve(tmpdir(), 's1-vdiff-b-'));
  });

  afterEach(() => {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  });

  it('two GENERATED locks across a dependency bump (15→16) differ in version', () => {
    // Generate lock A: framework=next, version=15.0.0
    const planA = synthesize(plan('15.0.0'));
    install(planA, { consumerRoot: dirA });

    // Generate lock B: framework=next, version=16.0.0 (dependency bump)
    const planB = synthesize(plan('16.0.0'));
    install(planB, { consumerRoot: dirB });

    const lockA = JSON.parse(
      readFileSync(resolve(dirA, '.ai-factory', 'synthesizer-output', 'rules-lock.next.json'), 'utf8'),
    ) as { version: string };
    const lockB = JSON.parse(
      readFileSync(resolve(dirB, '.ai-factory', 'synthesizer-output', 'rules-lock.next.json'), 'utf8'),
    ) as { version: string };

    // The version fields MUST differ — this is S2's input contract.
    expect(lockA.version).toBe('15.0.0');
    expect(lockB.version).toBe('16.0.0');
    expect(lockA.version).not.toBe(lockB.version);
  });
});
