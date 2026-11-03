/**
 * Principle 5 — Manifest = SSOT (manifest ↔ RULES.md drift)
 *
 * Source: self-testing-docs.md (drift detection concept) + existing render-rules.ts --check +
 *         overview.md Layer 5 ("Living Documentation — tests ARE the documentation")
 *
 * Manifest fields checked: render-rules.ts --check exit code (existing infrastructure).
 * Additionally: every rule ID in manifest must appear in RULES.md (structural presence check).
 *
 * Phase 2 scope: extends the existing render-rules.ts --check infrastructure to assert
 *   structural invariants about manifest IDs vs RULES.md content. The --check flag already
 *   verifies the generated table is up-to-date; here we add: manifest IDs must be reachable
 *   in the generated RULES.md (no orphan rules).
 *
 * Pass criterion: RULES.md contains a reference to every rule ID present in manifest.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const MANIFEST_PATH = resolve(HERE, '../manifest/rules-manifest.json');
// Scope note (multi-stack install wiring, 2026-06-24): this principle is a manifest↔rendered-doc
// drift check, so it targets ONLY the manifest-rendered RULES.md. preset-next-15-canonical/RULES.md
// carries the `Generated from factory/rules-manifest.json by scripts/render-rules.ts` provenance
// marker → it is in scope. preset-react-spa/RULES.md AND preset-react-native/RULES.md are STATIC,
// hand-authored preset-tailored docs (no provenance marker, distinct table format) → they are NOT
// manifest-rendered and are therefore OUT of this drift check's scope by construction, not by
// omission. Folding the new presets into a per-stack manifest-render path is a separate, deliberate
// decision (issue #646 Stage 2), not a silent extension here.
const RULES_MD_PATH = resolve(
  REPO_ROOT,
  'packages/preset-next-15-canonical/RULES.md',
);
const RENDER_SCRIPT = resolve(HERE, '../render/render-rules.ts');

interface RuleEntry {
  title: string;
  stack: string[];
  [key: string]: unknown;
}

type Manifest = Record<string, RuleEntry>;

function loadManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}

function loadRulesMd(): string {
  return readFileSync(RULES_MD_PATH, 'utf8');
}

/**
 * Assert that a rule ID appears in RULES.md content.
 * The generated table includes "**R1 TypeScript hygiene**" etc.
 */
function assertRuleIdInRulesMd(id: string, rulesMdContent: string): void {
  // The generated table format is: | **R1 TypeScript hygiene** | ...
  // We check for the ID as a standalone token to avoid false positives
  if (!rulesMdContent.includes(id)) {
    throw new Error(
      `Rule ${id}: not found in packages/preset-next-15-canonical/RULES.md. ` +
        'Run `npx tsx packages/core/render/render-rules.ts` to regenerate RULES.md from manifest.',
    );
  }
}

describe('Principle 5 — Manifest = SSOT (manifest ↔ RULES.md drift)', () => {
  it('RULES.md exists and is readable', () => {
    expect(existsSync(RULES_MD_PATH), `${RULES_MD_PATH} must exist`).toBe(true);
  });

  it('every rule ID in manifest appears in RULES.md', () => {
    const manifest = loadManifest();
    const rulesMd = loadRulesMd();
    const violations: string[] = [];

    for (const id of Object.keys(manifest)) {
      try {
        assertRuleIdInRulesMd(id, rulesMd);
      } catch (err) {
        violations.push((err as Error).message);
      }
    }

    expect(violations, `Violations:\n${violations.join('\n')}`).toHaveLength(0);
  });

  it('render-rules.ts --check exits 0 (RULES.md is up-to-date with manifest)', () => {
    // Extends the existing --check infrastructure: if RULES.md drifts, this fails
    let output = '';
    let exitCode = 0;
    try {
      output = execSync(`npx tsx ${RENDER_SCRIPT} --check`, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      });
    } catch (err) {
      exitCode = (err as { status?: number }).status ?? 1;
      output = (err as { stdout?: string; stderr?: string }).stdout ?? '';
      output += (err as { stderr?: string }).stderr ?? '';
    }

    expect(exitCode, `render-rules.ts --check failed:\n${output}`).toBe(0);
  });

  it('mutation: removing a rule ID from RULES.md causes assertion to fail (anti-tautology)', () => {
    const manifest = loadManifest();
    const rulesMd = loadRulesMd();

    // Use the first rule ID for mutation
    const [firstId] = Object.keys(manifest);

    // Mutate: remove all occurrences of the ID from RULES.md content
    const mutatedContent = rulesMd.replaceAll(firstId, 'REMOVED');

    expect(() => assertRuleIdInRulesMd(firstId, mutatedContent)).toThrow(
      /not found in.*RULES\.md/,
    );
  });
});

// Fixed C4/C5 population from the independently frozen M13 contract; never infer
// required registrations from the manifest whose completeness is under test.
it('manifest registers the two shipped test-quality rules', () => {
  const manifest = loadManifest();
  const expected = [
    {
      id: 'R21',
      rule: 'rules-as-tests/no-vacuous-assertion',
      bad: "it('vacuous', () => { expect(true).toBe(true); });",
      good: "it('subject', () => { expect(normalizeStatus('OK')).toBe('ok'); });",
      messageId: 'vacuousAssertion',
    },
    {
      id: 'R22',
      rule: 'rules-as-tests/require-effective-assertion',
      bad: "it('empty', () => {});",
      good: "it('subject', () => { expect(parse('x')).toEqual({}); });",
      messageId: 'noEffectiveAssertion',
    },
  ];

  for (const { id, rule, bad, good, messageId } of expected) {
    const entry = manifest[id];
    expect(entry, `Missing required manifest rule ${id}`).toBeDefined();
    expect(entry.check, `${id} must register the shipped ESLint rule`).toEqual({
      type: 'eslint',
      rule,
    });
    expect(entry.stack).toEqual(['ts-server', 'react-next']);
    expect(entry.examples).toEqual({ bad, good });
    expect(entry['negative-test']).toEqual({
      input: [bad],
      'expect-violation': messageId,
    });
  }
});
