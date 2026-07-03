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
import type { CapabilityMatrix } from '../shared/capability-matrix.ts';
import { validateMatrix } from '../shared/capability-matrix.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// cargo's live diagnostic identity is clippy's nested `message.code.code` shape.
const extractClippyCode = (parsed: unknown): unknown =>
  (parsed as { message?: { code?: { code?: unknown } } })?.message?.code?.code;

describe('validateMatrix — R10 (paired negative, unit test of the function)', () => {
  it('a partial cell without evidence is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'partial' } },
    };
    const violations = validateMatrix(m, 'clippy::disallowed_methods', extractClippyCode);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('live-fired'))).toBe(true);
  });

  it('a "no" cell requires no evidence and is not a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { syntax: { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(validateMatrix(m, 'clippy::disallowed_methods', extractClippyCode)).toEqual([]);
  });

  it('caps on a "no" cell is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { syntax: { status: 'no', caps: ['whoops'] } },
    };
    const violations = validateMatrix(m, 'clippy::disallowed_methods', extractClippyCode);
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
    expect(validateMatrix(m, 'clippy::disallowed_methods', extractClippyCode)).toEqual([]);
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
    const violations = validateMatrix(m, 'clippy::disallowed_methods', extractClippyCode);
    // reconciled message: identity-mismatch now reports "identity is ...", extractor-agnostic
    expect(violations.some((v) => v.includes('identity is'))).toBe(true);
  });
});

describe('capability-matrix.json — the committed file passes validateMatrix', () => {
  it('every cell with status !== "no" carries live-fired evidence matching the contract', () => {
    const matrix = JSON.parse(readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8')) as CapabilityMatrix;
    const contract = JSON.parse(readFileSync(join(__dirname, matrix.contract), 'utf8')) as { expectedCode: string };
    const violations = validateMatrix(matrix, contract.expectedCode, extractClippyCode);
    expect(violations).toEqual([]);
  });
});
