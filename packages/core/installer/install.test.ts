import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { install } from './install.ts';
import type { RulesLock } from './types.ts';
import { synthesize } from '../synthesizer/synthesize.ts';
import type { ResearchEntry, ResearchPlan } from '../research/types.ts';
import type { SynthesisPlan } from '../synthesizer/types.ts';

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

// Rework BLOCKER 2: a fixture with >=2 provenance sources at DIFFERENT tiers.
// Tier 0 (builtin curated) + Tier 2 (consumer-acked) — weakestTier collapses to the
// WEAKEST source (Tier 2). Under the original fail-open Math.min bug this would be Tier 0.
const provenanceTier0 = { ...provenance, tier: 0 as const };
const provenanceTier2 = {
  url: 'https://example.com/wiki',
  allowlistKey: 'example.wiki',
  fetchedAt: '2026-05-08',
  tier: 2 as const,
};

const entryMixedTier = (id: string): ResearchEntry => ({
  id,
  summary: `summary for ${id}`,
  bestPractices: [],
  antiPatterns: [],
  provenance: [provenanceTier0, provenanceTier2],
});

const plan = (overrides: Partial<ResearchPlan> = {}): ResearchPlan => ({
  framework: 'next',
  version: '16.0.0',
  patterns: [],
  missing: [],
  drift: null,
  ...overrides,
});

// Lock name is stack-scoped (GH #915 obs 2): rules-lock.<framework>.json for a
// framework plan, legacy rules-lock.json only when framework is null.
const ARTIFACTS = [
  'rules-manifest-additions.json',
  'RULES-additions.md',
  'eslint-rules-snippet.json',
  'rules-lock.next.json',
];

describe('install — L5 v1 consumer disk write', () => {
  let consumerRoot: string;

  beforeEach(() => {
    consumerRoot = mkdtempSync(resolve(tmpdir(), 'install-'));
  });

  afterEach(() => {
    rmSync(consumerRoot, { recursive: true, force: true });
  });

  it('writes 4 artifacts under .ai-factory/synthesizer-output/ for the next-16 fixture', () => {
    const synthPlan = synthesize(
      plan({
        patterns: [
          entry('nextjs-app-router'),
          entry('nextjs-pages-router'),
          entry('next-r12-no-server-imports-in-client'),
        ],
      }),
    );
    const report = install(synthPlan, { consumerRoot });
    expect(report.ok).toBe(true);
    expect(report.installed).toBe(true);
    expect(report.failures).toEqual([]);
    for (const name of ARTIFACTS) {
      expect(
        existsSync(resolve(consumerRoot, '.ai-factory', 'synthesizer-output', name)),
      ).toBe(true);
    }
    expect(report.preValidation.ok).toBe(true);
    expect(report.postValidation?.ok).toBe(true);
  });

  it('rules-lock.json captures schemaVersion + framework + version + rules', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    install(synthPlan, { consumerRoot });
    const lockPath = resolve(consumerRoot, '.ai-factory', 'synthesizer-output', 'rules-lock.next.json');
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as RulesLock;
    expect(lock.schemaVersion).toBe(2);
    expect(lock.framework).toBe('next');
    expect(lock.version).toBe('16.0.0');
    expect(lock.rules.map((r) => r.id)).toEqual(['G1']);
    expect(lock.rules[0].provenance).toEqual([{ ...provenance, tier: 0 }]);
    expect(lock.rules[0].tier).toBe(0); // next.official classifies as Tier 0 (builtin curated)
    expect(typeof lock.emittedAt).toBe('string');
    expect(lock.sourceFingerprint).toMatch(/^[0-9a-f]{16}$/);
  });

  it('generation-context.json carries version + per-rule provenance/tier (S1 criterion 2)', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    install(synthPlan, { consumerRoot });
    const ctxPath = resolve(consumerRoot, '.ai-factory', 'synthesizer-output', 'generation-context.json');
    expect(existsSync(ctxPath)).toBe(true);
    const ctx = JSON.parse(readFileSync(ctxPath, 'utf8')) as {
      version: string | null;
      rules: Array<{ id: string; provenance: typeof provenance[]; tier: number }>;
    };
    expect(ctx.version).toBe('16.0.0');
    expect(ctx.rules).toHaveLength(1);
    expect(ctx.rules[0].id).toBe('G1');
    expect(ctx.rules[0].provenance).toEqual([{ ...provenance, tier: 0 }]);
    expect(ctx.rules[0].tier).toBe(0);
  });

  // Rework BLOCKER 1+2: the tier collapse is the single semantic S1 adds to the trust model.
  // Fixture carries TWO provenance sources at DIFFERENT tiers (Tier 0 builtin + Tier 2 acked).
  // weakestTier() (Math.max) collapses to Tier 2 — the WEAKEST source. The original fail-open
  // bug (Math.min) would collapse to Tier 0; the assertion below is RED under min-collapse.
  // Also verifies BOTH consumers of the canonical function agree (lock + manifest — MAJOR).
  it('weakestTier collapses mixed-tier provenance to the weakest source (rework BLOCKER 1+2)', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entryMixedTier('nextjs-app-router')] }),
    );
    install(synthPlan, { consumerRoot });
    const outDir = resolve(consumerRoot, '.ai-factory', 'synthesizer-output');

    // Lock — install.ts buildLock -> weakestTier
    const lock = JSON.parse(
      readFileSync(resolve(outDir, 'rules-lock.next.json'), 'utf8'),
    ) as RulesLock;
    expect(lock.rules[0].tier).toBe(2); // weakest = Tier 2, NOT Tier 0
    expect(lock.rules[0].tier).not.toBe(0); // paired-negative: min-collapse would yield 0
    expect(lock.rules[0].provenance).toHaveLength(2); // both sources survived

    // Manifest — emit.ts generation-context.json -> weakestTier (same canonical function)
    const ctx = JSON.parse(
      readFileSync(resolve(outDir, 'generation-context.json'), 'utf8'),
    ) as { rules: Array<{ tier: number }> };
    expect(ctx.rules[0].tier).toBe(2);
    expect(ctx.rules[0].tier).toBe(lock.rules[0].tier); // both sites agree (no drift)
  });

  it('dry-run does not write to disk but reports artifact paths', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    const report = install(synthPlan, { consumerRoot, dryRun: true });
    expect(report.ok).toBe(true);
    expect(report.installed).toBe(false);
    expect(report.artifacts).toHaveLength(4);
    for (const name of ARTIFACTS) {
      expect(
        existsSync(resolve(consumerRoot, '.ai-factory', 'synthesizer-output', name)),
      ).toBe(false);
    }
  });

  it('refuses to overwrite rules-lock.json without force=true', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    install(synthPlan, { consumerRoot });
    const second = install(synthPlan, { consumerRoot });
    expect(second.ok).toBe(false);
    expect(second.installed).toBe(false);
    expect(second.failures[0].stage).toBe('lock-collision');
  });

  // Criterion 8 loud-refusal (install-level): a v1 lock on disk is REFUSED with the
  // regenerate remediation — NOT the lock-collision "pass force: true" message that
  // suggests silent overwrite. This is the production surface a user with a stale
  // pre-S1 lock actually hits; the API-level throw is verified in
  // schema-version-refusal.test.ts but is unreachable from install() without this
  // branch (the lock-collision guard intercepts before postInstallChecks runs).
  it('refuses a v1 lock on disk loudly with the regenerate message (criterion 8 install-level)', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    const outDir = resolve(consumerRoot, '.ai-factory', 'synthesizer-output');
    mkdirSync(outDir, { recursive: true });
    const lockPath = resolve(outDir, 'rules-lock.next.json');
    const v1Lock = {
      schemaVersion: 1,
      framework: 'next',
      version: null,
      ruleIds: ['G1'],
      emittedAt: '2025-12-31T00:00:00.000Z',
      sourceFingerprint: '0000000000000000',
    };
    writeFileSync(lockPath, JSON.stringify(v1Lock) + '\n');
    const report = install(synthPlan, { consumerRoot });
    expect(report.ok).toBe(false);
    expect(report.installed).toBe(false);
    expect(report.failures[0].stage).toBe('schema-stale');
    expect(report.failures[0].reason).toContain('regenerate the lock');
    expect(report.failures[0].reason).not.toContain('pass force: true to overwrite');
  });

  it('overwrites rules-lock.json when force=true', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    install(synthPlan, { consumerRoot });
    const second = install(synthPlan, { consumerRoot, force: true });
    expect(second.ok).toBe(true);
    expect(second.installed).toBe(true);
  });

  it('refuses to install when pre-validation fails (gate 1 schema violation)', () => {
    const malformed = {
      framework: 'next',
      version: '16.0.0',
      rules: [
        {
          id: 'G1',
          title: 'no negative-test',
          stack: ['react-next'],
          check: { type: 'eslint', rule: 'no-restricted-imports' },
          examples: { bad: 'b', good: 'g' },
          research: { entryId: 'x', provenance: [provenance] },
        },
      ],
      rulesMd: '',
      eslintConfigSnippet: '{}',
    } as SynthesisPlan;
    const report = install(malformed, { consumerRoot });
    expect(report.ok).toBe(false);
    expect(report.installed).toBe(false);
    expect(report.failures[0].stage).toBe('pre-validate');
    expect(existsSync(resolve(consumerRoot, '.ai-factory'))).toBe(false);
  });

  it('post-install meta-check fails when rules-lock.json drifts from disk artifacts', () => {
    const synthPlan = synthesize(
      plan({ patterns: [entry('nextjs-app-router')] }),
    );
    install(synthPlan, { consumerRoot });
    // Tamper: rewrite lock with mismatched rules.
    const lockPath = resolve(consumerRoot, '.ai-factory', 'synthesizer-output', 'rules-lock.next.json');
    const tampered = {
      schemaVersion: 2,
      framework: 'next',
      version: '16.0.0',
      rules: [{ id: 'G42-FAKE', provenance: [], tier: 2 }],
      emittedAt: '2026-05-08T00:00:00.000Z',
      sourceFingerprint: 'deadbeefdeadbeef',
    };
    writeFileSync(lockPath, JSON.stringify(tampered) + '\n');
    // Re-install with force should regenerate lock and pass post-checks.
    const report = install(synthPlan, { consumerRoot, force: true });
    expect(report.ok).toBe(true);
    const newLock = JSON.parse(readFileSync(lockPath, 'utf8')) as RulesLock;
    expect(newLock.rules.map((r) => r.id)).toEqual(['G1']);
  });

  it('installs an empty plan (own-repo case): writes empty additions + lock with rules=[]', () => {
    const synthPlan = synthesize(plan({ framework: null }));
    const report = install(synthPlan, { consumerRoot });
    expect(report.ok).toBe(true);
    const lockPath = resolve(consumerRoot, '.ai-factory', 'synthesizer-output', 'rules-lock.json');
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as RulesLock;
    expect(lock.rules).toEqual([]);
    expect(lock.framework).toBeNull();
  });

  // GH #915 obs 2 — the motivating multi-stack scenario: two stacks synthesized against the
  // SAME consumerRoot must leave BOTH machine records on disk (react-native previously
  // overwrote the ts-server lock; only the last-synthesized stack survived).
  it('multi-stack: a second stack against the same consumerRoot does not clobber the first lock', () => {
    const nextPlan = synthesize(plan({ patterns: [entry('nextjs-app-router')] }));
    const first = install(nextPlan, { consumerRoot });
    expect(first.ok).toBe(true);

    const emptyOtherStack = synthesize(plan({ framework: null }));
    const second = install(emptyOtherStack, { consumerRoot, force: true });
    expect(second.ok).toBe(true);

    const outDir = resolve(consumerRoot, '.ai-factory', 'synthesizer-output');
    const nextLock = JSON.parse(
      readFileSync(resolve(outDir, 'rules-lock.next.json'), 'utf8'),
    ) as RulesLock;
    const nullLock = JSON.parse(
      readFileSync(resolve(outDir, 'rules-lock.json'), 'utf8'),
    ) as RulesLock;
    // Both records coexist; each drift-checks against ITS OWN plan.
    expect(nextLock.framework).toBe('next');
    expect(nextLock.rules.map((r) => r.id)).toEqual(['G1']);
    expect(nullLock.framework).toBeNull();
    expect(nullLock.rules).toEqual([]);
  });

  // paired-negative: without stack-scoping both plans would target ONE path — prove the
  // two lock paths are genuinely distinct files (non-vacuous: delete one, other survives).
  it('multi-stack neg: deleting the framework lock leaves the null-framework lock intact', () => {
    const nextPlan = synthesize(plan({ patterns: [entry('nextjs-app-router')] }));
    install(nextPlan, { consumerRoot });
    install(synthesize(plan({ framework: null })), { consumerRoot, force: true });
    const outDir = resolve(consumerRoot, '.ai-factory', 'synthesizer-output');
    rmSync(resolve(outDir, 'rules-lock.next.json'));
    expect(existsSync(resolve(outDir, 'rules-lock.next.json'))).toBe(false);
    expect(existsSync(resolve(outDir, 'rules-lock.json'))).toBe(true);
  });
});
