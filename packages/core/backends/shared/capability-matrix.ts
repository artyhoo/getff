// hoisted-from: backends/cargo + backends/npm capability-matrix.test.ts; validateMatrix identity-extraction parameterized to reconcile the two live shapes (clippy nested / eslint flat)
// Capability matrix — mechanized honesty (MT umbrella S2/S3b, T-MT-A).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §6.
//
// The 4 matrix types + validateMatrix were DUPLICATED in the cargo and npm
// capability-matrix.test.ts files. The two validateMatrix bodies differed on EXACTLY one line
// — the diagnostic-identity extraction (cargo: nested `message.code.code`; npm: flat `ruleId`).
// Consolidated here (3c) with that one line parameterized as `extractIdentity`; everything
// else is verbatim. Each backend's test passes its own extractor + expected identity.

export type CellStatus = 'no' | 'partial' | 'yes';

export interface MatrixEvidence {
  kind: string;
  date?: string;
  toolchain?: string;
  capturedDiagnostic?: string;
}

export interface MatrixCell {
  status: CellStatus;
  refusedCode?: string;
  caps?: string[];
  evidence?: MatrixEvidence;
}

export interface CapabilityMatrix {
  backend: string;
  contract: string;
  cells: Record<string, MatrixCell>;
}

/**
 * Validate a CapabilityMatrix against the mechanized-honesty contract:
 *  - every cell with status !== 'no' MUST carry evidence.kind === 'live-fired'
 *  - that evidence MUST carry non-empty date + toolchain
 *  - capturedDiagnostic MUST parse as JSON and its extracted identity (per `extractIdentity`)
 *    MUST equal `expectedIdentity` (backend-specific: clippy nested message.code.code /
 *    eslint flat ruleId — passed by the caller)
 *  - `caps` is allowed ONLY on 'partial' cells
 * Returns an array of violation strings (empty = valid).
 */
export function validateMatrix(
  m: CapabilityMatrix,
  expectedIdentity: string,
  extractIdentity: (parsed: unknown) => unknown,
): string[] {
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
          const identity = extractIdentity(parsed);
          if (identity !== expectedIdentity) {
            violations.push(
              `cell "${cellName}": capturedDiagnostic identity is "${String(identity)}", expected "${expectedIdentity}"`,
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
