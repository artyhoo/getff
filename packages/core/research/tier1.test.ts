// Stage S2 — Tier 1 derivation (npm) paired negatives + AC 2/AC 3.
// Kickoff: .claude/orchestrator-prompts/rule-research-trust-tiers/kickoff.md §5 S2.
// Plan: docs/superpowers/plans/2026-07-02-rule-research-trust-tiers-impl.md Stage S2.
// Each paired negative below was observed RED before its fix (TDD, kickoff AC 1).

import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { validateEntry, validateResearchPlanShape } from './internal-validators.ts';
import { resolveAllowedSources, validateProvenance } from './allowlist-resolver.ts';
import { npmAdapter } from './ecosystem-npm.ts';
import type { Provenance, ResearchPlan } from './types.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));

// --- Task 2.1: optional package/packageName/finalUrl fields (types + schema) ---

describe('Task 2.1 — schema round-trip for new optional fields', () => {
  it('a ResearchEntry with package + provenance.packageName/finalUrl validates against the schema', () => {
    const entry = {
      id: 'drizzle-orm-rls',
      summary: 'Row level security best practice',
      bestPractices: ['Use RLS policies'],
      antiPatterns: [],
      package: 'drizzle-orm',
      provenance: [
        {
          url: 'https://orm.drizzle.team/docs/rls',
          allowlistKey: 'drizzle-orm',
          fetchedAt: '2026-07-02T00:00:00Z',
          packageName: 'drizzle-orm',
          finalUrl: 'https://orm.drizzle.team/docs/rls',
        },
      ],
    };
    const ok = validateEntry(entry);
    expect(ok).toBe(true);
  });

  it('back-compat: an existing store entry (no new fields) still validates', () => {
    const raw = readFileSync(
      resolve(HERE, 'store', 'next', '16.x', 'nextjs-app-router.json'),
      'utf8',
    );
    const entry: unknown = JSON.parse(raw);
    const ok = validateEntry(entry);
    expect(ok).toBe(true);
  });
});

// --- Task 2.3: Tier-1 derivation — multi-tenant host list + real tier1For ---
// Kickoff §5 S2: ALL SEVEN paired negatives, each observed RED before its fix (TDD).

function makeConsumerRoot(opts: {
  deps?: Record<string, string>;
  devDeps?: Record<string, string>;
  nodeModules?: Record<string, Record<string, unknown>>;
}): string {
  const root = mkdtempSync(join(tmpdir(), 'tier1-consumer-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(
      { dependencies: opts.deps ?? {}, devDependencies: opts.devDeps ?? {} },
      null,
      2,
    ),
  );
  const nm = join(root, 'node_modules');
  mkdirSync(nm, { recursive: true });
  for (const [name, meta] of Object.entries(opts.nodeModules ?? {})) {
    const segments = name.startsWith('@') ? name.split('/') : [name];
    const dir = join(nm, ...segments);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'package.json'), JSON.stringify(meta, null, 2));
  }
  return root;
}

const PROV = (over: Partial<Provenance> & { url: string; allowlistKey: string }): Provenance =>
  ({ fetchedAt: '2026-07-02T00:00:00Z', ...over }) as Provenance;

describe('Task 2.3 — Tier-1 derivation (DN #6 lead: A-via-C multi-tenant containment)', () => {
  it('S2-N1: dep-absent package derives nothing (not a direct dependency)', () => {
    const root = makeConsumerRoot({ deps: {}, nodeModules: {} });
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    const r = resolved.tier1For('drizzle-orm');
    expect(r).toMatchObject({
      ok: false,
      reason: expect.stringContaining('not a direct dependency'),
    });
  });

  it('S2-N2: transitive-only dep derives nothing (in node_modules, NOT in package.json deps)', () => {
    const root = makeConsumerRoot({
      deps: {},
      nodeModules: {
        'drizzle-orm': { name: 'drizzle-orm', version: '0.40.0', homepage: 'https://orm.drizzle.team' },
      },
    });
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    const r = resolved.tier1For('drizzle-orm');
    expect(r).toMatchObject({
      ok: false,
      reason: expect.stringContaining('not a direct dependency'),
    });
  });

  it('S2-N3: multi-tenant homepage yields no Tier-1 host (github.com AND foo.github.io)', () => {
    const rootGithub = makeConsumerRoot({
      deps: { 'pkg-a': '^1.0.0' },
      nodeModules: { 'pkg-a': { name: 'pkg-a', homepage: 'https://github.com/org/pkg-a' } },
    });
    const resolvedGithub = resolveAllowedSources({ root: rootGithub, adapter: npmAdapter });
    expect(resolvedGithub.tier1For('pkg-a')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('no Tier-1-eligible host'),
    });

    const rootGhPages = makeConsumerRoot({
      deps: { 'pkg-b': '^1.0.0' },
      nodeModules: { 'pkg-b': { name: 'pkg-b', homepage: 'https://foo.github.io/pkg-b' } },
    });
    const resolvedGhPages = resolveAllowedSources({ root: rootGhPages, adapter: npmAdapter });
    expect(resolvedGhPages.tier1For('pkg-b')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('no Tier-1-eligible host'),
    });
  });

  it('S2-N4: repository without extractable https host yields nothing (org/repo shorthand; git@ URL)', () => {
    const rootShorthand = makeConsumerRoot({
      deps: { 'pkg-c': '^1.0.0' },
      nodeModules: { 'pkg-c': { name: 'pkg-c', repository: 'org/pkg-c' } },
    });
    const resolvedShorthand = resolveAllowedSources({ root: rootShorthand, adapter: npmAdapter });
    expect(resolvedShorthand.tier1For('pkg-c')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('no Tier-1-eligible host'),
    });

    const rootSsh = makeConsumerRoot({
      deps: { 'pkg-d': '^1.0.0' },
      nodeModules: {
        'pkg-d': { name: 'pkg-d', repository: { type: 'git', url: 'git@github.com:org/pkg-d.git' } },
      },
    });
    const resolvedSsh = resolveAllowedSources({ root: rootSsh, adapter: npmAdapter });
    expect(resolvedSsh.tier1For('pkg-d')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('no Tier-1-eligible host'),
    });
  });

  it('S2-N5: cross-package provenance fails (T-RTT-A)', () => {
    const root = makeConsumerRoot({
      deps: { react: '^19.0.0' },
      nodeModules: { react: { name: 'react', homepage: 'https://react.dev' } },
    });
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    const v = validateProvenance(
      PROV({ url: 'https://evil.example/docs', allowlistKey: 'react', packageName: 'evil-pkg' }),
      resolved,
      { entryPackage: 'react' },
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/cross-package/);
  });

  it('S2-N6: xn-- (IDN) homepage host derives nothing', () => {
    const root = makeConsumerRoot({
      deps: { 'pkg-idn': '^1.0.0' },
      nodeModules: { 'pkg-idn': { name: 'pkg-idn', homepage: 'https://xn--caf-dma.com' } },
    });
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    expect(resolved.tier1For('pkg-idn')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('no Tier-1-eligible host'),
    });
  });

  it('S2-N7: IP-literal homepage host derives nothing (127.0.0.1 AND [::1])', () => {
    const rootV4 = makeConsumerRoot({
      deps: { 'pkg-ip4': '^1.0.0' },
      nodeModules: { 'pkg-ip4': { name: 'pkg-ip4', homepage: 'https://127.0.0.1' } },
    });
    const resolvedV4 = resolveAllowedSources({ root: rootV4, adapter: npmAdapter });
    expect(resolvedV4.tier1For('pkg-ip4')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('no Tier-1-eligible host'),
    });

    const rootV6 = makeConsumerRoot({
      deps: { 'pkg-ip6': '^1.0.0' },
      nodeModules: { 'pkg-ip6': { name: 'pkg-ip6', homepage: 'https://[::1]' } },
    });
    const resolvedV6 = resolveAllowedSources({ root: rootV6, adapter: npmAdapter });
    expect(resolvedV6.tier1For('pkg-ip6')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('no Tier-1-eligible host'),
    });
  });

  it('positive control: single-tenant homepage authorizes ONLY its own package', () => {
    const root = makeConsumerRoot({
      deps: { 'drizzle-orm': '^0.40.0', hono: '^4.0.0' },
      nodeModules: {
        'drizzle-orm': { name: 'drizzle-orm', homepage: 'https://orm.drizzle.team' },
        hono: { name: 'hono', homepage: 'https://hono.dev' },
      },
    });
    const resolved = resolveAllowedSources({ root, adapter: npmAdapter });
    expect(resolved.tier1For('drizzle-orm')).toMatchObject({ ok: true, hosts: ['orm.drizzle.team'] });

    const vDrizzle = validateProvenance(
      PROV({
        url: 'https://orm.drizzle.team/docs/rls',
        allowlistKey: 'drizzle-orm',
        packageName: 'drizzle-orm',
      }),
      resolved,
      { entryPackage: 'drizzle-orm' },
    );
    expect(vDrizzle.ok).toBe(true);

    // Passes for entryPackage 'drizzle-orm', fails for 'hono' (scope-lock: T-RTT-A).
    const vHono = validateProvenance(
      PROV({
        url: 'https://orm.drizzle.team/docs/rls',
        allowlistKey: 'drizzle-orm',
        packageName: 'drizzle-orm',
      }),
      resolved,
      { entryPackage: 'hono' },
    );
    expect(vHono.ok).toBe(false);
  });
});

// --- AC 2: Tier-1 resolution never egresses and is byte-deterministic (T-RTT-B) ---
describe('AC 2 — offline determinism (throwing-fetch falsifier)', () => {
  it('Tier-1 resolution never egresses and is byte-deterministic', () => {
    const root = makeConsumerRoot({
      deps: { 'drizzle-orm': '^0.40.0' },
      nodeModules: {
        'drizzle-orm': { name: 'drizzle-orm', homepage: 'https://orm.drizzle.team' },
      },
    });
    const saved = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error('egress attempt at validate time');
    }) as typeof fetch;
    try {
      const a = JSON.stringify(
        resolveAllowedSources({ root, adapter: npmAdapter }).tier1For('drizzle-orm'),
      );
      const b = JSON.stringify(
        resolveAllowedSources({ root, adapter: npmAdapter }).tier1For('drizzle-orm'),
      );
      expect(a).toBe(b);
      expect(JSON.parse(a).ok).toBe(true);
    } finally {
      globalThis.fetch = saved;
    }
  });
});

// --- Task 2.4 (AC 3): E2E — Tier-1 single-root stub fixture ---
// packages/core/research/fixtures/tier1-single-root/: a checked-in stub
// node_modules (kickoff AC 3) — consumer root package.json lists drizzle-orm
// as a direct dep + a stub node_modules/drizzle-orm/package.json with a
// single-tenant homepage (does not trip the multi-tenant filter).

const FIXTURE_ROOT = resolve(HERE, 'fixtures', 'tier1-single-root');

function loadFixturePlan(): ResearchPlan {
  const raw = readFileSync(join(FIXTURE_ROOT, 'research-plan.json'), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!validateResearchPlanShape(parsed)) {
    throw new Error('fixture research-plan.json failed shape validation');
  }
  return parsed as ResearchPlan;
}

describe('AC 3 — E2E: Tier-1 single-root stub fixture', () => {
  it('positive: plan validates (Tier 1) when the dep IS installed', () => {
    const plan = loadFixturePlan();
    const resolved = resolveAllowedSources({ root: FIXTURE_ROOT, adapter: npmAdapter });
    for (const entry of plan.patterns) {
      for (const p of entry.provenance) {
        const v = validateProvenance(p, resolved, { entryPackage: entry.package });
        expect(v.ok).toBe(true);
      }
    }
  });

  it('degradation: same plan against a root WITHOUT the dep installed fails with the new Tier-1-miss reason class (not "unknown allowlistKey")', () => {
    const plan = loadFixturePlan();
    // A root whose package.json lacks drizzle-orm entirely (no dep, no node_modules entry).
    const bareRoot = mkdtempSync(join(tmpdir(), 'tier1-e2e-bare-'));
    writeFileSync(join(bareRoot, 'package.json'), JSON.stringify({ dependencies: {} }, null, 2));
    mkdirSync(join(bareRoot, 'node_modules'), { recursive: true });

    const resolved = resolveAllowedSources({ root: bareRoot, adapter: npmAdapter });
    for (const entry of plan.patterns) {
      for (const p of entry.provenance) {
        const v = validateProvenance(p, resolved, { entryPackage: entry.package });
        expect(v.ok).toBe(false);
        expect(v.reason).toMatch(/is not a direct dependency/);
        expect(v.reason).not.toMatch(/unknown allowlistKey/);
      }
    }
  });
});

// --- Task 2.5 (M4 seam): finalUrl same-tier check ---
// kickoff §4: provenance records the finalUrl the agent fetched, and that
// final URL must independently satisfy the SAME tier that authorized the
// initial URL — a redirect crossing to a host that tier does not cover fails
// closed. One paired negative: a redirect crossing to an unauthorized host.

describe('Task 2.5 — finalUrl same-tier check (redirect containment)', () => {
  it('paired negative: finalUrl on a host NOT covered by the authorizing tier fails', () => {
    const resolvedEmpty = resolveAllowedSources(); // Tier-0 only
    const v = validateProvenance(
      PROV({
        url: 'https://nextjs.org/docs',
        allowlistKey: 'next.official',
        finalUrl: 'https://evil.example/docs',
      }),
      resolvedEmpty,
    );
    expect(v.ok).toBe(false);
  });

  it('positive: finalUrl on a host covered by the same tier passes', () => {
    const resolvedEmpty = resolveAllowedSources();
    const v = validateProvenance(
      PROV({
        url: 'https://nextjs.org/docs',
        allowlistKey: 'next.official',
        finalUrl: 'https://nextjs.org/docs/redirected',
      }),
      resolvedEmpty,
    );
    expect(v.ok).toBe(true);
  });

  it('no finalUrl present: url-only validation unaffected (back-compat)', () => {
    const resolvedEmpty = resolveAllowedSources();
    const v = validateProvenance(
      PROV({ url: 'https://nextjs.org/docs', allowlistKey: 'next.official' }),
      resolvedEmpty,
    );
    expect(v.ok).toBe(true);
  });
});

// --- Task 2.6 (DN #7 Option A): optional resolveCtx threading to the
// external validateResearchPlan ---
import { validateResearchPlan } from './validate-plan.ts';

describe('Task 2.6 — validateResearchPlan(plan, resolveCtx?) threading', () => {
  it('(a) no-ctx call on the AC 3 plan → old behavior (fails, Tier-0-only)', () => {
    const raw = readFileSync(join(FIXTURE_ROOT, 'research-plan.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    expect(() => validateResearchPlan(parsed)).toThrow(/unknown allowlistKey|not authorized/);
  });

  it('(b) ctx call → Tier-1 passes', () => {
    const raw = readFileSync(join(FIXTURE_ROOT, 'research-plan.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    expect(() =>
      validateResearchPlan(parsed, { root: FIXTURE_ROOT, adapter: npmAdapter }),
    ).not.toThrow();
  });
});
