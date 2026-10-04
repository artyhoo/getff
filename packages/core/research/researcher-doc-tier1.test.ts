// The rule-researcher doc and the plan gate agree on where a Tier-1 package goes.
//
// agents/rule-researcher.md tells the researcher how to write a Tier-1 (derived, npm) provenance.
// The gate reads the ENTRY-level `package` as the scope-lock (research-source-trust.md
// #trust-by-name-not-scope) and only then activates Tier 1 (allowlist-resolver.ts
// validateUrlAgainstTiers). A doc that names only provenance `packageName` produced plans that
// fell through to Tier 2 and died as FF2005 «unknown allowlistKey», naming the wrong field (P0
// run 1, the `vite-env-via-import-meta` entry). This test parses the doc's own Tier-1 example and
// runs it through the real gate, so the doc cannot drift from the gate again.

import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkResearchPlan } from './validate-plan.ts';
import { npmAdapter } from './ecosystem-npm.ts';
import { ALLOWED_SOURCES } from './allowlist.ts';
import { parse } from '@typescript-eslint/parser';

const REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const DOC = join(REPO, 'agents/rule-researcher.md');
const HEADING = '### Tier-1 entry shape';

function docTier1Example(): Record<string, unknown> {
  const doc = readFileSync(DOC, 'utf8');
  const at = doc.indexOf(HEADING);
  expect(at, `${DOC} has no "${HEADING}" section`).toBeGreaterThan(-1);
  const fence = /```json\n([\s\S]*?)\n```/.exec(doc.slice(at));
  expect(fence, `no \`\`\`json block after "${HEADING}"`).not.toBeNull();
  return JSON.parse(fence![1]) as Record<string, unknown>;
}

function consumerWith(pkg: string, homepage: string): string {
  const root = mkdtempSync(join(tmpdir(), 'researcher-doc-tier1-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ devDependencies: { [pkg]: '^7.0.0' } }));
  const dir = join(root, 'node_modules', pkg);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: pkg, homepage }));
  return root;
}

function planOf(entry: Record<string, unknown>): unknown {
  return { framework: null, version: null, patterns: [entry], missing: [], drift: null };
}

// P6 F5 (2026-09-30): the doc sent the researcher to allowlist.ts for the key list («do not trust this
// snapshot»), so a cold agent read framework source to write one JSON file. The doc now lists every key with
// its hosts, and this keeps the list equal to the gate's.
describe('agents/rule-researcher.md Tier-0 key list ↔ ALLOWED_SOURCES', () => {
  const doc = readFileSync(DOC, 'utf8');
  it('lists every key with exactly its hosts, and never sends the reader to the source for them', () => {
    for (const [key, hosts] of Object.entries(ALLOWED_SOURCES)) {
      expect(doc, `key ${key}`).toContain(`\`${key}\` (${hosts.map((h) => `\`${h}\``).join(', ')})`);
    }
    expect(doc).not.toContain('do not trust this snapshot');
  });
});

describe('agents/rule-researcher.md Tier-1 example ↔ the plan gate', () => {
  const entry = docTier1Example();
  const pkg = entry['package'];
  const prov = (entry['provenance'] as Array<Record<string, unknown>>)[0]!;
  const homepage = `https://${new URL(String(prov['url'])).host}/`;

  it('the example names the package at BOTH levels, the same name', () => {
    expect(typeof pkg).toBe('string');
    expect(prov['packageName']).toBe(pkg);
    expect(prov['allowlistKey']).toBe(pkg);
  });

  it('the example passes the gate when the package is a direct dependency', () => {
    const root = consumerWith(String(pkg), homepage);
    const r = checkResearchPlan(planOf(entry), { root, adapter: npmAdapter });
    expect(r.diagnostics).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('without the entry-level `package` the gate names the missing field (FF2017), not FF2005', () => {
    const root = consumerWith(String(pkg), homepage);
    const { package: _dropped, ...withoutPackage } = entry;
    const r = checkResearchPlan(planOf(withoutPackage), { root, adapter: npmAdapter });
    expect(r.diagnostics.map((d) => d.code)).toEqual(['FF2017']);
    expect(r.diagnostics[0]!.message).toContain(`"package": "${String(pkg)}"`);
  });
});

// P6 run 2 N2 (2026-09-30): the protocol handed the researcher «a complete, valid pair» for exactly
// create-vite react-ts, and on that stack the walker's selection was its 6 rules plus one — research
// was not measured. The protocol now names a complete pair for a stack the one-button road is not
// measured on, and the create-vite pair stays a matrix fixture only. This keeps the named pair real:
// it exists, its plan passes the gate, and every example is a whole file (the doc's own rule, above
// the pointer), not a fragment.
describe('agents/rule-researcher.md names a complete example pair that is not a stack answer', () => {
  const doc = readFileSync(DOC, 'utf8');
  const named = /`(packages\/core\/synthesizer\/fixtures\/[a-z0-9-]+)\.research\.json`/.exec(doc);

  it('the protocol does not name the create-vite matrix pair', () => {
    expect(doc).not.toContain('react-spa-create-vite');
  });

  it('the protocol names a pair, and both files exist', () => {
    expect(named, 'no `packages/core/synthesizer/fixtures/<name>.research.json` in the doc').not.toBeNull();
    const base = join(REPO, named![1]);
    expect(existsSync(`${base}.research.json`)).toBe(true);
    expect(existsSync(`${base}.selection.json`)).toBe(true);
  });

  it("the named plan passes the gate with its framework as a direct dependency", () => {
    const plan = JSON.parse(readFileSync(join(REPO, `${named![1]}.research.json`), 'utf8')) as {
      framework: string;
    };
    const root = consumerWith(plan.framework === 'react-next' ? 'next' : plan.framework, 'https://nextjs.org/');
    const r = checkResearchPlan(plan, { root, adapter: npmAdapter });
    expect(r.diagnostics).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('every bad/good example and negative-test input parses as a whole .tsx file', () => {
    const sel = JSON.parse(readFileSync(join(REPO, `${named![1]}.selection.json`), 'utf8')) as {
      rules: Array<{ ruleId: string; examples: { bad: string; good: string }; negativeTest?: { input: string[] } }>;
    };
    for (const rule of sel.rules) {
      const samples = [rule.examples.bad, rule.examples.good, ...(rule.negativeTest?.input ?? [])];
      for (const code of samples) {
        expect(() => parse(code, { jsx: true, filePath: 'sample.tsx' }), `${rule.ruleId}: ${code}`).not.toThrow();
        // a whole file declares what it uses: it has a top-level declaration or import/export, not a bare expression
        expect(/^\s*(import|export|'use client'|"use client")/m.test(code), `${rule.ruleId} is a fragment: ${code}`).toBe(true);
      }
    }
  });
});
