// Unit coverage for the LIVE file-clients + manual-drop backstop (Phase 1).
// $0: reads committed fixtures + inline objects; no network, no LLM.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { GenerateCandidate, GenerateClient, GenerateSelection, Menu } from './generate-port.ts';
import { FileResearchClient, withManualDrop, routesToManual } from './file-clients.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESEARCH_FIXTURE = resolve(HERE, 'fixtures/no-head-element.research.json');

const tmpDirs: string[] = [];
function tmpFile(name: string, content: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'file-clients-'));
  tmpDirs.push(dir);
  const p = resolve(dir, name);
  writeFileSync(p, content);
  return p;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const STUB_DETECTION = {} as never; // research() ignores its arg

describe('FileResearchClient', () => {
  it('loads + validates a committed allowlist-valid plan', async () => {
    const plan = await new FileResearchClient(RESEARCH_FIXTURE).research(STUB_DETECTION);
    expect(plan.framework).toBe('react-next');
    expect(plan.patterns.map((p) => p.id)).toContain('next-no-head-element');
  });

  it('drops (never ships) an entry with a non-allowlisted provenance host, naming it', async () => {
    const bad = tmpFile(
      'bad.research.json',
      JSON.stringify({
        framework: 'react-next',
        version: null,
        patterns: [
          {
            id: 'x',
            summary: 'spoofed provenance host that is not on the allowlist',
            bestPractices: ['use the official API'],
            antiPatterns: ['do the wrong thing'],
            provenance: [
              { url: 'https://evil.example.com/x', allowlistKey: 'next.official', fetchedAt: '2026-06-29T00:00:00.000Z' },
            ],
          },
        ],
        missing: [],
        drift: null,
      }),
    );
    // P5 A2: one refused entry drops only itself (file-clients-partial-drop.test.ts has the
    // mixed plan); the whole-plan rejection is kept for plan-level shape errors.
    const lines: string[] = [];
    const client = new FileResearchClient(bad, { log: (m) => lines.push(m) });
    const plan = await client.research(STUB_DETECTION);
    expect(plan.patterns).toEqual([]);
    expect(client.dropped.map((d) => [d.id, d.reason.slice(0, 6)])).toEqual([['x', 'FF2006']]);
    expect(lines[0]).toMatch(/^\[rule-bootstrap\] dropped research entry x — FF2006/);
  });
});

describe('routesToManual + withManualDrop', () => {
  const declarative: GenerateCandidate = {
    entryId: 'd',
    ruleId: 'no-head-element',
    title: 'forbid raw head',
    stack: ['react-next'],
    presence: 'forbid',
    selector: "JSXOpeningElement[name.name='head']",
    examples: { bad: '<head />', good: '<Head />' },
  };
  const manual: GenerateCandidate = {
    entryId: 'm',
    ruleId: 'no-server-only-in-client',
    title: 'server-only boundary (cross-file, not L4-expressible)',
    stack: ['react-next'],
    examples: { bad: "import 'server-only'", good: 'client component' },
  };

  it('routesToManual: declarative=false, manual=true', () => {
    expect(routesToManual(declarative)).toBe(false);
    expect(routesToManual(manual)).toBe(true);
  });

  it('withManualDrop drops the manual candidate, keeps the declarative, logs loudly', async () => {
    const inner: GenerateClient = {
      async generate(_m: Menu): Promise<GenerateSelection> {
        return { rules: [declarative, manual] };
      },
    };
    const logs: string[] = [];
    const wrapped = withManualDrop(inner, (m) => logs.push(m));
    const out = await wrapped.generate({ framework: 'react-next', version: null, candidates: [] });
    expect(out.rules.map((r) => r.entryId)).toEqual(['d']);
    expect(logs.join('\n')).toContain("'m'");
    expect(logs.join('\n')).toMatch(/NOT shipped as a rule/);
  });
});
