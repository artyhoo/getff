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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));

type CellStatus = 'no' | 'partial' | 'yes';

interface MatrixEvidence {
  kind: string;
  date?: string;
  toolchain?: string;
  capturedDiagnostic?: string;
}

interface MatrixCell {
  status: CellStatus;
  refusedCode?: string;
  caps?: string[];
  evidence?: MatrixEvidence;
}

interface CapabilityMatrix {
  backend: string;
  contract: string;
  cells: Record<string, MatrixCell>;
}

/**
 * Validate a CapabilityMatrix against the mechanized-honesty contract:
 *  - every cell with status !== 'no' MUST carry evidence.kind === 'live-fired'
 *  - that evidence MUST carry non-empty date + toolchain
 *  - capturedDiagnostic MUST parse as JSON and its `ruleId` MUST equal expectedRuleId
 *    (the ESLint diagnostic's rule identity — flat shape, distinct from cargo's nesting)
 *  - `caps` is allowed ONLY on 'partial' cells
 * Returns an array of violation strings (empty = valid).
 */
export function validateMatrix(m: CapabilityMatrix, expectedRuleId: string): string[] {
  const violations: string[] = [];
  for (const [cellName, cell] of Object.entries(m.cells)) {
    if (cell.status !== 'no') {
      if (cell.evidence === undefined || cell.evidence.kind !== 'live-fired') {
        violations.push(`cell "${cellName}": status "${cell.status}" requires evidence.kind === 'live-fired'`);
        continue;
      }
      if (!cell.evidence.date || cell.evidence.date.length === 0) {
        violations.push(`cell "${cellName}": evidence.date is missing/empty`);
      }
      if (!cell.evidence.toolchain || cell.evidence.toolchain.length === 0) {
        violations.push(`cell "${cellName}": evidence.toolchain is missing/empty`);
      }
      if (!cell.evidence.capturedDiagnostic || cell.evidence.capturedDiagnostic.length === 0) {
        violations.push(`cell "${cellName}": evidence.capturedDiagnostic is missing/empty`);
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(cell.evidence.capturedDiagnostic);
        } catch {
          violations.push(`cell "${cellName}": evidence.capturedDiagnostic does not parse as JSON`);
          parsed = undefined;
        }
        if (parsed !== undefined) {
          const ruleId = (parsed as { ruleId?: unknown })?.ruleId;
          if (ruleId !== expectedRuleId) {
            violations.push(
              `cell "${cellName}": capturedDiagnostic ruleId is "${String(ruleId)}", expected "${expectedRuleId}"`,
            );
          }
        }
      }
    }
    if (cell.caps !== undefined && cell.status !== 'partial') {
      violations.push(`cell "${cellName}": "caps" is only allowed on 'partial' cells (status is "${cell.status}")`);
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
    const violations = validateMatrix(m, 'no-restricted-syntax');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('live-fired'))).toBe(true);
  });

  it('a "no" cell requires no evidence and is not a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(validateMatrix(m, 'no-restricted-syntax')).toEqual([]);
  });

  it('caps on a "no" cell is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', caps: ['whoops'] } },
    };
    const violations = validateMatrix(m, 'no-restricted-syntax');
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
    expect(validateMatrix(m, 'no-restricted-syntax')).toEqual([]);
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
    const violations = validateMatrix(m, 'no-restricted-syntax');
    expect(violations.some((v) => v.includes('ruleId'))).toBe(true);
  });
});

describe('capability-matrix.json — the committed file passes validateMatrix', () => {
  it('every cell with status !== "no" carries live-fired evidence matching the contract', () => {
    const matrix = JSON.parse(readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8')) as CapabilityMatrix;
    const contract = JSON.parse(readFileSync(join(__dirname, matrix.contract), 'utf8')) as { expectedRuleId: string };
    const violations = validateMatrix(matrix, contract.expectedRuleId);
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
});
