// Capability matrix — mechanized honesty (MT umbrella S3b PR-1, T-MT-A).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §6.
//
// Mechanic COPIED from backends/cargo/capability-matrix.test.ts (the shared code hoist is 3c,
// NOT this dispatch — per stage-3b brief §2). The one adaptation: the npm backend's live
// diagnostic identity is the ESLint diagnostic's `ruleId` (flat shape), not cargo's nested
// `message.code.code`. So the captured-diagnostic code is extracted at `$.ruleId` and
// compared to the firing-contract's `expectedRuleId`.
//
// Always-on (eslint NOT required to READ the committed evidence): validates the COMMITTED
// capability-matrix.json against a structural honesty contract — any cell claiming more than
// 'no' MUST carry live-fired evidence (an artefact, not a claim). Keeps the matrix from
// rotting into aspirational documentation (T15/T-MT-A).

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CapabilityMatrix } from '../shared/capability-matrix.ts';
import { validateMatrix } from '../shared/capability-matrix.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// npm's live diagnostic identity is the ESLint diagnostic's flat `ruleId` shape (distinct
// from cargo's nested `message.code.code`).
const extractRuleId = (parsed: unknown): unknown => (parsed as { ruleId?: unknown })?.ruleId;

/**
 * Extract the eslint version claimed by an evidence `toolchain` string (the
 * `"node vX / eslint Y"` convention this backend's evidence uses). Returns undefined when the
 * string carries no `eslint <semver>` token — the freshness check then reports a violation
 * rather than silently passing (a toolchain string that stops naming eslint is itself rot).
 */
export function parseEslintVersion(toolchain: string): string | undefined {
  // `eslint` must sit at a start/space boundary — not the tail of a hyphenated name
  // (`typescript-eslint 8.0.0`, `eslint-plugin-x 1.2.3` must NOT match the eslint core version).
  const m = /(?:^|\s)eslint\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\b/.exec(toolchain);
  return m?.[1];
}

/**
 * Toolchain-freshness gate (attention-is-not-a-mechanism, .claude/rules/): the eslint version
 * a live-fired evidence cell CLAIMS must equal the eslint version that actually RESOLVES for
 * this backend at test time. A hand-written version string is not a mechanism — this check is.
 * Bumping eslint turns this RED until the evidence is regenerated against the new toolchain.
 * Pure over its inputs; the caller supplies the resolved version. Returns violation strings.
 */
export function checkToolchainFreshness(m: CapabilityMatrix, resolvedEslintVersion: string): string[] {
  const violations: string[] = [];
  for (const [cellName, cell] of Object.entries(m.cells)) {
    if (cell.status === 'no' || cell.evidence === undefined) continue;
    const toolchain = cell.evidence.toolchain ?? '';
    const claimed = parseEslintVersion(toolchain);
    if (claimed === undefined) {
      violations.push(
        `cell "${cellName}": evidence.toolchain "${toolchain}" does not name an eslint version ("eslint <semver>")`,
      );
    } else if (claimed !== resolvedEslintVersion) {
      violations.push(
        `cell "${cellName}": evidence.toolchain claims eslint ${claimed}, but the resolving eslint is ` +
          `${resolvedEslintVersion} — regenerate the live-fired evidence against the current toolchain`,
      );
    }
  }
  return violations;
}

describe('validateMatrix — paired negatives (unit test of the function)', () => {
  it('N7: a "yes" cell WITHOUT evidence is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { syntax: { status: 'yes' } },
    };
    const violations = validateMatrix(m, 'no-restricted-syntax', extractRuleId);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('live-fired'))).toBe(true);
  });

  it('a "no" cell requires no evidence and is not a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(validateMatrix(m, 'no-restricted-syntax', extractRuleId)).toEqual([]);
  });

  it('caps on a "no" cell is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', caps: ['whoops'] } },
    };
    const violations = validateMatrix(m, 'no-restricted-syntax', extractRuleId);
    expect(violations.some((v) => v.includes('caps'))).toBe(true);
  });

  it('a "yes" cell with well-formed live-fired evidence matching expectedRuleId is valid', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        syntax: {
          status: 'yes',
          evidence: {
            kind: 'live-fired',
            date: '2026-07-03',
            toolchain: 'node v24.3.0 / eslint 9.39.4',
            capturedDiagnostic: JSON.stringify({ ruleId: 'no-restricted-syntax', messageId: 'restrictedSyntax' }),
          },
        },
      },
    };
    expect(validateMatrix(m, 'no-restricted-syntax', extractRuleId)).toEqual([]);
  });

  it('capturedDiagnostic with a mismatched ruleId is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        syntax: {
          status: 'yes',
          evidence: {
            kind: 'live-fired',
            date: '2026-07-03',
            toolchain: 'node v24.3.0 / eslint 9.39.4',
            capturedDiagnostic: JSON.stringify({ ruleId: 'some-other-rule' }),
          },
        },
      },
    };
    const violations = validateMatrix(m, 'no-restricted-syntax', extractRuleId);
    // reconciled message: identity-mismatch now reports "identity is ...", extractor-agnostic
    expect(violations.some((v) => v.includes('identity is'))).toBe(true);
  });
});

describe('checkToolchainFreshness — paired negatives (unit test of the function)', () => {
  const freshCell = (toolchain: string): CapabilityMatrix => ({
    backend: 'x',
    contract: 'x.json',
    cells: {
      syntax: {
        status: 'yes',
        evidence: { kind: 'live-fired', date: '2026-07-04', toolchain, capturedDiagnostic: '{}' },
      },
    },
  });

  it('a toolchain claiming the resolving eslint version is fresh (no violations)', () => {
    expect(checkToolchainFreshness(freshCell('node v24.3.0 / eslint 10.4.0'), '10.4.0')).toEqual([]);
  });

  it('N8: a STALE toolchain version (evidence eslint != resolving eslint) is a violation', () => {
    const violations = checkToolchainFreshness(freshCell('node v24.3.0 / eslint 9.39.4'), '10.4.0');
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('claims eslint 9.39.4');
    expect(violations[0]).toContain('regenerate');
  });

  it('N9: a toolchain string that stops naming eslint at all is a violation, not a silent pass', () => {
    const violations = checkToolchainFreshness(freshCell('node v24.3.0'), '10.4.0');
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('does not name an eslint version');
  });

  it('"no" cells carry no evidence and are exempt from freshness', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(checkToolchainFreshness(m, '10.4.0')).toEqual([]);
  });

  it('parseEslintVersion extracts plain and prerelease semvers, and rejects absence', () => {
    expect(parseEslintVersion('node v24.3.0 / eslint 10.4.0')).toBe('10.4.0');
    expect(parseEslintVersion('eslint 11.0.0-alpha.1 on node v25')).toBe('11.0.0-alpha.1');
    expect(parseEslintVersion('node v24.3.0 / oxlint 1.0.0')).toBeUndefined();
    // hyphenated neighbours must NOT be mistaken for the eslint core version
    expect(parseEslintVersion('typescript-eslint 8.0.0 / eslint 10.4.0')).toBe('10.4.0');
    expect(parseEslintVersion('typescript-eslint 8.0.0')).toBeUndefined();
  });
});

describe('capability-matrix.json — the committed file passes validateMatrix', () => {
  it('every cell with status !== "no" carries live-fired evidence matching the contract', () => {
    const matrix = JSON.parse(readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8')) as CapabilityMatrix;
    const contract = JSON.parse(readFileSync(join(__dirname, matrix.contract), 'utf8')) as { expectedRuleId: string };
    const violations = validateMatrix(matrix, contract.expectedRuleId, extractRuleId);
    expect(violations).toEqual([]);
  });

  it('the honest matrix: type-aware + dep-graph are "no" with FF7001 (no typed/dep-graph rules in the declarative class)', () => {
    const matrix = JSON.parse(readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8')) as CapabilityMatrix;
    expect(matrix.cells['type-aware']?.status).toBe('no');
    expect(matrix.cells['type-aware']?.refusedCode).toBe('FF7001');
    expect(matrix.cells['dep-graph']?.status).toBe('no');
    expect(matrix.cells['dep-graph']?.refusedCode).toBe('FF7001');
    expect(matrix.cells['syntax']?.status).toBe('yes');
  });

  it('toolchain freshness: the evidence eslint version equals the eslint that actually resolves here', () => {
    // No version literal in this test — the resolving eslint is derived at run time, so the
    // gate cannot itself rot. The same resolution the firing harness uses (bare `eslint`
    // specifier from this directory), read via createRequire because package.json is not an
    // exported module path.
    const require = createRequire(import.meta.url);
    const resolved = (require('eslint/package.json') as { version: string }).version;
    const matrix = JSON.parse(readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8')) as CapabilityMatrix;
    expect(checkToolchainFreshness(matrix, resolved)).toEqual([]);
  });
});
