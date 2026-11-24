// One bad research entry drops only itself (P5 A2).
//
// Before: FileResearchClient ran validateResearchPlan, which throws on the FIRST diagnostic, so one
// entry with a bad provenance or a malformed field rejected the whole plan and no rule was
// generated (P0 run 1). Now an entry-attributable diagnostic drops that entry, named with its
// reason; a diagnostic not tied to one entry (the plan's own shape) still rejects the whole plan
// (the CLI's exit-3 path, setup.d/80-rule-bootstrap.sh).

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileResearchClient, partitionResearchPlan } from './file-clients.ts';
import { ResearchPlanError } from '../research/validate-plan.ts';
import { synthesizeGenerate } from './generate.ts';
import type { GenerateClient } from './generate-port.ts';
import type { ResearchPlan } from '../research/types.ts';

const good = {
  id: 'next-no-head-element',
  summary: 'Use next/head only in pages; the App Router uses the metadata API.',
  bestPractices: ['Export metadata from a layout or page'],
  antiPatterns: ['<Head> from next/head in the app directory'],
  provenance: [
    {
      url: 'https://nextjs.org/docs/messages/no-head-element',
      allowlistKey: 'next.official',
      fetchedAt: '2026-09-29T00:00:00.000Z',
    },
  ],
};
// Provenance-bad: an allowlistKey no tier knows.
const badProvenance = {
  ...good,
  id: 'vite-env-via-import-meta',
  provenance: [
    { url: 'https://vite.dev/guide/env-and-mode', allowlistKey: 'vite', fetchedAt: '2026-09-29T00:00:00.000Z' },
  ],
};
// Shape-bad inside one entry: `summary` must be a string.
const badShape = { ...good, id: 'broken-summary', summary: 42 };

function plan(patterns: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { framework: 'react-next', version: null, patterns, missing: [], drift: null, ...extra };
}

function emptyRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'partial-drop-'));
  writeFileSync(join(root, 'package.json'), '{}');
  return root;
}

describe('partitionResearchPlan — per-entry drop', () => {
  it('keeps the good entry and drops each bad one with its id and reason', () => {
    const r = partitionResearchPlan(plan([good, badProvenance, badShape]), { root: emptyRoot() });
    expect(r.plan.patterns.map((e) => e.id)).toEqual(['next-no-head-element']);
    expect(r.dropped.map((d) => d.id).sort()).toEqual(['broken-summary', 'vite-env-via-import-meta']);
    const byId = Object.fromEntries(r.dropped.map((d) => [d.id, d.reason]));
    expect(byId['vite-env-via-import-meta']).toMatch(/FF2005.*vite/);
    expect(byId['broken-summary']).toMatch(/FF1001.*summary/);
  });

  it('a clean plan drops nothing', () => {
    const r = partitionResearchPlan(plan([good]), { root: emptyRoot() });
    expect(r.dropped).toEqual([]);
    expect(r.plan.patterns).toHaveLength(1);
  });

  it('paired negative: a top-level shape error still rejects the whole plan', () => {
    const { framework: _f, ...noFramework } = plan([good]);
    expect(() => partitionResearchPlan(noFramework, { root: emptyRoot() })).toThrow(ResearchPlanError);
  });

  it('paired negative: `patterns` that is not an array rejects the whole plan', () => {
    expect(() => partitionResearchPlan(plan([], { patterns: 'x' }), { root: emptyRoot() })).toThrow(
      ResearchPlanError,
    );
  });
});

describe('FileResearchClient — logs each drop and exposes the list', () => {
  it('writes one «dropped research entry» line per drop and returns the kept plan', async () => {
    const root = emptyRoot();
    const file = join(root, 'react-next.research.json');
    writeFileSync(file, JSON.stringify(plan([good, badProvenance])));
    const lines: string[] = [];
    const client = new FileResearchClient(file, { root, log: (m) => lines.push(m) });
    const kept = await client.research({} as never);
    expect(kept.patterns.map((e) => e.id)).toEqual(['next-no-head-element']);
    expect(client.dropped.map((d) => d.id)).toEqual(['vite-env-via-import-meta']);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^\[rule-bootstrap\] dropped research entry vite-env-via-import-meta — FF2005/);
  });
});

describe('synthesizeGenerate — a selection rule whose entry is missing is named', () => {
  it('logs the rule and its missing entry instead of skipping silently', async () => {
    const kept = partitionResearchPlan(plan([good, badProvenance]), { root: emptyRoot() }).plan;
    const selection: GenerateClient = {
      generate: async () => ({
        rules: [
          { entryId: 'vite-env-via-import-meta', ruleId: 'no-process-env', title: 't', stack: 'react-spa', examples: { bad: [], good: [] } },
        ] as never,
      }),
    };
    const lines: string[] = [];
    const out = await synthesizeGenerate(kept as ResearchPlan, selection, (m) => lines.push(m));
    expect(out.rules).toEqual([]);
    expect(lines).toEqual([
      '[rule-bootstrap] selection rule no-process-env dropped — its research entry vite-env-via-import-meta is not in the plan (dropped above or never written)',
    ]);
  });
});
