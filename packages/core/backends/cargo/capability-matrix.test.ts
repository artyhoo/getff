// Capability matrix — mechanized honesty (MT umbrella S2, T-MT-A).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §6.
//
// Always-on (cargo NOT required): validates the COMMITTED capability-matrix.json against a
// structural honesty contract — any cell claiming more than 'no' MUST carry live-fired
// evidence (not a claim, an artefact). This is what keeps a capability matrix from
// silently rotting into aspirational documentation (T15/T-MT-A/T-MT-C).

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
 *  - capturedDiagnostic MUST parse as JSON and its message.code.code MUST equal
 *    expectedCode (read from the referenced firing-contract.json)
 *  - `caps` is allowed ONLY on 'partial' cells
 * Returns an array of violation strings (empty = valid).
 */
export function validateMatrix(m: CapabilityMatrix, expectedCode: string): string[] {
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
          const code = (parsed as { message?: { code?: { code?: unknown } } })?.message?.code?.code;
          if (code !== expectedCode) {
            violations.push(
              `cell "${cellName}": capturedDiagnostic message.code.code is "${String(code)}", expected "${expectedCode}"`,
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

describe('validateMatrix — R10 (paired negative, unit test of the function)', () => {
  it('a partial cell without evidence is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'partial' } },
    };
    const violations = validateMatrix(m, 'clippy::disallowed_methods');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('live-fired'))).toBe(true);
  });

  it('a "no" cell requires no evidence and is not a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { syntax: { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(validateMatrix(m, 'clippy::disallowed_methods')).toEqual([]);
  });

  it('caps on a "no" cell is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { syntax: { status: 'no', caps: ['whoops'] } },
    };
    const violations = validateMatrix(m, 'clippy::disallowed_methods');
    expect(violations.some((v) => v.includes('caps'))).toBe(true);
  });

  it('a partial cell with well-formed live-fired evidence matching expectedCode is valid', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        'type-aware': {
          status: 'partial',
          caps: ['some known gap'],
          evidence: {
            kind: 'live-fired',
            date: '2026-07-03',
            toolchain: 'rustc 1.96.1',
            capturedDiagnostic: JSON.stringify({ message: { code: { code: 'clippy::disallowed_methods' } } }),
          },
        },
      },
    };
    expect(validateMatrix(m, 'clippy::disallowed_methods')).toEqual([]);
  });

  it('capturedDiagnostic with a mismatched code is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        'type-aware': {
          status: 'partial',
          evidence: {
            kind: 'live-fired',
            date: '2026-07-03',
            toolchain: 'rustc 1.96.1',
            capturedDiagnostic: JSON.stringify({ message: { code: { code: 'clippy::wrong_code' } } }),
          },
        },
      },
    };
    const violations = validateMatrix(m, 'clippy::disallowed_methods');
    expect(violations.some((v) => v.includes('message.code.code'))).toBe(true);
  });
});

describe('capability-matrix.json — the committed file passes validateMatrix', () => {
  it('every cell with status !== "no" carries live-fired evidence matching the contract', () => {
    const matrix = JSON.parse(readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8')) as CapabilityMatrix;
    const contract = JSON.parse(readFileSync(join(__dirname, matrix.contract), 'utf8')) as { expectedCode: string };
    const violations = validateMatrix(matrix, contract.expectedCode);
    expect(violations).toEqual([]);
  });
});
