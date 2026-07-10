// Capability matrix — mechanized honesty (MT umbrella S1, astgrep-python-yaml backend, T-MT-A).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §6.
//
// Mechanic mirrors backends/npm/capability-matrix.test.ts (the shared validateMatrix hoist lives
// in backends/shared/capability-matrix.ts). ast-grep's live diagnostic identity is the flat
// `ruleId` (same shape family as eslint's flat ruleId, NOT cargo's nested message.code.code), so
// the captured-diagnostic identity is extracted at `$.ruleId` and compared to the contract's
// expectedCode.
//
// Always-on (ast-grep NOT required to READ the committed evidence): validateMatrix + the honest-
// shape checks gate the COMMITTED capability-matrix.json — any cell claiming more than 'no' MUST
// carry live-fired evidence (an artefact, not a claim). The toolchain-freshness check DERIVES the
// resolving ast-grep version at run time (NO version literal in this file) and compares it to the
// evidence's claimed version; it is gated on the pinned tool being invocable, and loud-skips
// otherwise — so a version bump turns it RED, but an offline run does not false-RED.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CapabilityMatrix } from '../shared/capability-matrix.ts';
import { validateMatrix } from '../shared/capability-matrix.ts';
import { deriveToolVersion, parseAstgrepVersion, type AstgrepFiringContract } from './firing-runner.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ast-grep's live diagnostic identity is the flat `ruleId` (distinct from cargo's nested
// message.code.code).
const extractRuleId = (parsed: unknown): unknown => (parsed as { ruleId?: unknown })?.ruleId;

/**
 * Toolchain-freshness gate (attention-is-not-a-mechanism, .claude/rules/): the ast-grep version
 * a live-fired evidence cell CLAIMS must equal the version that actually RESOLVES for this
 * backend at test time. A hand-written version string is not a mechanism — this check is.
 * Bumping the pin turns this RED until the evidence is regenerated. Pure over its inputs; the
 * caller supplies the resolved version. Returns violation strings.
 */
export function checkToolchainFreshness(m: CapabilityMatrix, resolvedVersion: string): string[] {
  const violations: string[] = [];
  for (const [cellName, cell] of Object.entries(m.cells)) {
    if (cell.status === 'no' || cell.evidence === undefined) continue;
    const toolchain = cell.evidence.toolchain ?? '';
    const claimed = parseAstgrepVersion(toolchain);
    if (claimed === undefined) {
      violations.push(
        `cell "${cellName}": evidence.toolchain "${toolchain}" does not name an ast-grep version ("ast-grep <semver>")`,
      );
    } else if (claimed !== resolvedVersion) {
      violations.push(
        `cell "${cellName}": evidence.toolchain claims ast-grep ${claimed}, but the resolving ast-grep is ` +
          `${resolvedVersion} — regenerate the live-fired evidence against the current toolchain`,
      );
    }
  }
  return violations;
}

const CONTRACT: AstgrepFiringContract = JSON.parse(
  readFileSync(join(__dirname, 'firing-contract.json'), 'utf8'),
) as AstgrepFiringContract;

describe('validateMatrix — paired negatives (unit test of the function)', () => {
  it('a "yes" cell WITHOUT evidence is a violation', () => {
    const m: CapabilityMatrix = { backend: 'x', contract: 'x.json', cells: { syntax: { status: 'yes' } } };
    const violations = validateMatrix(m, 'no-datetime-now', extractRuleId);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('live-fired'))).toBe(true);
  });

  it('a "no" cell requires no evidence and is not a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(validateMatrix(m, 'no-datetime-now', extractRuleId)).toEqual([]);
  });

  it('caps on a "no" cell is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', caps: ['whoops'] } },
    };
    const violations = validateMatrix(m, 'no-datetime-now', extractRuleId);
    expect(violations.some((v) => v.includes('caps'))).toBe(true);
  });

  it('a "yes" cell with well-formed live-fired evidence matching expectedCode is valid', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        syntax: {
          status: 'yes',
          evidence: {
            kind: 'live-fired',
            date: '2026-07-11',
            toolchain: 'ast-grep 0.44.1',
            capturedDiagnostic: JSON.stringify({ ruleId: 'no-datetime-now', severity: 'error' }),
          },
        },
      },
    };
    expect(validateMatrix(m, 'no-datetime-now', extractRuleId)).toEqual([]);
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
            date: '2026-07-11',
            toolchain: 'ast-grep 0.44.1',
            capturedDiagnostic: JSON.stringify({ ruleId: 'some-other-rule' }),
          },
        },
      },
    };
    const violations = validateMatrix(m, 'no-datetime-now', extractRuleId);
    expect(violations.some((v) => v.includes('identity is'))).toBe(true);
  });
});

describe('parseAstgrepVersion + checkToolchainFreshness — paired negatives (pure, always-on)', () => {
  const freshCell = (toolchain: string): CapabilityMatrix => ({
    backend: 'x',
    contract: 'x.json',
    cells: {
      syntax: {
        status: 'yes',
        evidence: { kind: 'live-fired', date: '2026-07-11', toolchain, capturedDiagnostic: '{}' },
      },
    },
  });

  it('parseAstgrepVersion extracts plain and prerelease semvers, and rejects absence', () => {
    expect(parseAstgrepVersion('ast-grep 0.44.1')).toBe('0.44.1');
    expect(parseAstgrepVersion('ast-grep 1.0.0-alpha.1')).toBe('1.0.0-alpha.1');
    expect(parseAstgrepVersion('sg 0.44.1')).toBeUndefined();
    expect(parseAstgrepVersion('no version here')).toBeUndefined();
  });

  it('a toolchain claiming the resolving version is fresh (no violations)', () => {
    expect(checkToolchainFreshness(freshCell('ast-grep 0.44.1'), '0.44.1')).toEqual([]);
  });

  it('a STALE toolchain version (evidence != resolving) is a violation', () => {
    const violations = checkToolchainFreshness(freshCell('ast-grep 0.44.0'), '0.44.1');
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('claims ast-grep 0.44.0');
    expect(violations[0]).toContain('regenerate');
  });

  it('a toolchain string that stops naming ast-grep is a violation, not a silent pass', () => {
    const violations = checkToolchainFreshness(freshCell('sg 0.44.1'), '0.44.1');
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('does not name an ast-grep version');
  });

  it('"no" cells carry no evidence and are exempt from freshness', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(checkToolchainFreshness(m, '0.44.1')).toEqual([]);
  });
});

describe('capability-matrix.json — the committed file passes the honesty contract', () => {
  const matrix = JSON.parse(
    readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8'),
  ) as CapabilityMatrix;

  it('every cell with status !== "no" carries live-fired evidence matching the contract', () => {
    const violations = validateMatrix(matrix, CONTRACT.expectedCode, extractRuleId);
    expect(violations).toEqual([]);
  });

  it('the honest matrix: syntax is "yes" (live-fired); type-aware + dep-graph are "no" with FF7001', () => {
    expect(matrix.cells['syntax']?.status).toBe('yes');
    expect(matrix.cells['type-aware']?.status).toBe('no');
    expect(matrix.cells['type-aware']?.refusedCode).toBe('FF7001');
    expect(matrix.cells['dep-graph']?.status).toBe('no');
    expect(matrix.cells['dep-graph']?.refusedCode).toBe('FF7001');
  });

  // Toolchain freshness derives the resolving version at run time (no literal in this file). It
  // requires the pinned tool to be invocable; loud-skip when absent (offline) rather than
  // false-RED. In CI (tool present) a pin bump without evidence-regen turns this RED.
  const resolvedVersion = deriveToolVersion(CONTRACT.command);
  it.skipIf(resolvedVersion === undefined)(
    'toolchain freshness: the evidence ast-grep version equals the ast-grep that actually resolves here',
    { timeout: 120_000 },
    () => {
      expect(checkToolchainFreshness(matrix, resolvedVersion as string)).toEqual([]);
    },
  );
  if (resolvedVersion === undefined) {
    console.warn(
      '⚠ ast-grep toolchain-freshness check SKIPPED (pinned @ast-grep/cli could not be invoked — ' +
        'offline?); the committed evidence version was not verified against a live --version this run.',
    );
  }
});
