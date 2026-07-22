// Capability matrix — mechanized honesty (MT umbrella S2, ruff-tidy-imports-toml backend, T-PY-B).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §6.
//
// Mechanic mirrors backends/astgrep/capability-matrix.test.ts (the shared validateMatrix hoist
// lives in backends/shared/capability-matrix.ts). ruff's live diagnostic identity is the flat
// `code` (TID251 / TID253 — same shape family as eslint's flat ruleId, NOT cargo's nested
// message.code.code), so the captured-diagnostic identity is extracted at `$.code` and compared to
// the contract's expectedCodes.
//
// Honest granularity: the `syntax` cell is 'partial', not 'yes' — ruff serves only the
// flake8-tidy-imports slice of the syntax class (import / qualified-name bans); a call-with-args
// ban (kind 'call') is refused FF7001 (ast-grep catch-all). 'partial' carries BOTH live-fired
// evidence (the slice that DOES fire) and `caps` documenting the slice that does not (validateMatrix
// permits caps only on 'partial' cells).
//
// Always-on (ruff NOT required to READ the committed evidence): validateMatrix + the honest-shape
// checks gate the COMMITTED capability-matrix.json — any cell claiming more than 'no' MUST carry
// live-fired evidence (an artefact, not a claim). The toolchain-freshness check DERIVES the
// resolving ruff version at run time (NO version literal in this file) and compares it to the
// evidence's claimed version; it is gated on the PATH ruff binary being present, and loud-skips
// otherwise — so a version bump (or a mismatched PATH binary) turns it RED, but a run on a machine
// without ruff does not false-RED. CI installs the pinned binary, so it fires there.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CapabilityMatrix } from '../shared/capability-matrix.ts';
import { validateMatrix } from '../shared/capability-matrix.ts';
import { deriveToolVersion, parseRuffVersion, type RuffFiringContract } from './firing-runner.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ruff's live diagnostic identity is the flat `code` (distinct from cargo's nested message.code.code).
const extractCode = (parsed: unknown): unknown => (parsed as { code?: unknown })?.code;

/**
 * Toolchain-freshness gate (attention-is-not-a-mechanism, .claude/rules/): the ruff version a
 * live-fired evidence cell CLAIMS must equal the version that actually RESOLVES for this backend at
 * test time. A hand-written version string is not a mechanism — this check is. Bumping the pin turns
 * this RED until the evidence is regenerated. Pure over its inputs; the caller supplies the resolved
 * version. Returns violation strings.
 */
export function checkToolchainFreshness(m: CapabilityMatrix, resolvedVersion: string): string[] {
  const violations: string[] = [];
  for (const [cellName, cell] of Object.entries(m.cells)) {
    if (cell.status === 'no' || cell.evidence === undefined) continue;
    const toolchain = cell.evidence.toolchain ?? '';
    const claimed = parseRuffVersion(toolchain);
    if (claimed === undefined) {
      violations.push(
        `cell "${cellName}": evidence.toolchain "${toolchain}" does not name a ruff version ("ruff <semver>")`,
      );
    } else if (claimed !== resolvedVersion) {
      violations.push(
        `cell "${cellName}": evidence.toolchain claims ruff ${claimed}, but the resolving ruff is ` +
          `${resolvedVersion} — regenerate the live-fired evidence against the current toolchain`,
      );
    }
  }
  return violations;
}

const CONTRACT: RuffFiringContract = JSON.parse(
  readFileSync(join(__dirname, 'firing-contract.json'), 'utf8'),
) as RuffFiringContract;

// The matrix's syntax cell captures ONE exemplar diagnostic; it is anchored to the FIRST of the
// contract's expected codes (TID251 banned-api, which also carries the node.claim as its message).
const MATRIX_IDENTITY = CONTRACT.expectedCodes[0] as string;

describe('validateMatrix — paired negatives (unit test of the function)', () => {
  it('a "partial" cell WITHOUT evidence is a violation', () => {
    const m: CapabilityMatrix = { backend: 'x', contract: 'x.json', cells: { syntax: { status: 'partial' } } };
    const violations = validateMatrix(m, 'TID251', extractCode);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('live-fired'))).toBe(true);
  });

  it('a "no" cell requires no evidence and is not a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(validateMatrix(m, 'TID251', extractCode)).toEqual([]);
  });

  it('caps on a "no" cell is a violation (caps only on partial)', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', caps: ['whoops'] } },
    };
    const violations = validateMatrix(m, 'TID251', extractCode);
    expect(violations.some((v) => v.includes('caps'))).toBe(true);
  });

  it('a "partial" cell with well-formed live-fired evidence + caps matching expectedCode is valid', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        syntax: {
          status: 'partial',
          caps: ['kind call refused FF7001'],
          evidence: {
            kind: 'live-fired',
            date: '2026-07-11',
            toolchain: 'ruff 0.15.21',
            capturedDiagnostic: JSON.stringify({ code: 'TID251', severity: 'error' }),
          },
        },
      },
    };
    expect(validateMatrix(m, 'TID251', extractCode)).toEqual([]);
  });

  it('capturedDiagnostic with a mismatched code is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        syntax: {
          status: 'partial',
          caps: ['kind call refused FF7001'],
          evidence: {
            kind: 'live-fired',
            date: '2026-07-11',
            toolchain: 'ruff 0.15.21',
            capturedDiagnostic: JSON.stringify({ code: 'E501' }),
          },
        },
      },
    };
    const violations = validateMatrix(m, 'TID251', extractCode);
    expect(violations.some((v) => v.includes('identity is'))).toBe(true);
  });
});

describe('parseRuffVersion + checkToolchainFreshness — paired negatives (pure, always-on)', () => {
  const freshCell = (toolchain: string): CapabilityMatrix => ({
    backend: 'x',
    contract: 'x.json',
    cells: {
      syntax: {
        status: 'partial',
        caps: ['x'],
        evidence: { kind: 'live-fired', date: '2026-07-11', toolchain, capturedDiagnostic: '{}' },
      },
    },
  });

  it('parseRuffVersion extracts plain and prerelease semvers, and rejects absence', () => {
    expect(parseRuffVersion('ruff 0.15.21')).toBe('0.15.21');
    expect(parseRuffVersion('ruff 1.0.0-alpha.1')).toBe('1.0.0-alpha.1');
    expect(parseRuffVersion('rustfmt 0.15.21')).toBeUndefined();
    expect(parseRuffVersion('no version here')).toBeUndefined();
  });

  it('a toolchain claiming the resolving version is fresh (no violations)', () => {
    expect(checkToolchainFreshness(freshCell('ruff 0.15.21'), '0.15.21')).toEqual([]);
  });

  // @arm:E3:neg toolchain-freshness-vs-evidence (fabricated version drift → violation, RED-capable)
  it('a STALE toolchain version (evidence != resolving) is a violation', () => {
    const violations = checkToolchainFreshness(freshCell('ruff 0.15.20'), '0.15.21');
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('claims ruff 0.15.20');
    expect(violations[0]).toContain('regenerate');
  });

  it('a toolchain string that stops naming ruff is a violation, not a silent pass', () => {
    const violations = checkToolchainFreshness(freshCell('rustfmt 0.15.21'), '0.15.21');
    expect(violations.length).toBe(1);
    expect(violations[0]).toContain('does not name a ruff version');
  });

  it('"no" cells carry no evidence and are exempt from freshness', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { 'type-aware': { status: 'no', refusedCode: 'FF7001' } },
    };
    expect(checkToolchainFreshness(m, '0.15.21')).toEqual([]);
  });
});

describe('capability-matrix.json — the committed file passes the honesty contract', () => {
  const matrix = JSON.parse(
    readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8'),
  ) as CapabilityMatrix;

  it('every cell with status !== "no" carries live-fired evidence matching the contract', () => {
    const violations = validateMatrix(matrix, MATRIX_IDENTITY, extractCode);
    expect(violations).toEqual([]);
  });

  it('the captured exemplar code is one of the contract expectedCodes', () => {
    const captured = JSON.parse(matrix.cells['syntax']?.evidence?.capturedDiagnostic ?? '{}');
    expect(CONTRACT.expectedCodes).toContain(extractCode(captured));
  });

  it('the honest matrix: syntax is "partial" (live-fired + caps); type-aware + dep-graph are "no" with FF7001', () => {
    expect(matrix.cells['syntax']?.status).toBe('partial');
    expect((matrix.cells['syntax']?.caps ?? []).length).toBeGreaterThan(0);
    expect(matrix.cells['type-aware']?.status).toBe('no');
    expect(matrix.cells['type-aware']?.refusedCode).toBe('FF7001');
    expect(matrix.cells['dep-graph']?.status).toBe('no');
    expect(matrix.cells['dep-graph']?.refusedCode).toBe('FF7001');
  });

  // Toolchain freshness derives the resolving version at run time (no literal in this file). It
  // requires the PATH ruff binary to be present; loud-skip when absent rather than false-RED. In CI
  // (install step puts the pinned binary on PATH) a pin bump without evidence-regen turns this RED.
  const resolvedVersion = deriveToolVersion(CONTRACT.command);
  it.skipIf(resolvedVersion === undefined)(
    'toolchain freshness: the evidence ruff version equals the ruff that actually resolves here',
    { timeout: 120_000 },
    () => {
      expect(checkToolchainFreshness(matrix, resolvedVersion as string)).toEqual([]);
    },
  );
  if (resolvedVersion === undefined) {
    console.warn(
      '⚠ ruff toolchain-freshness check SKIPPED (ruff not on PATH — CI install step missing or ' +
        'local machine without the pinned binary); the committed evidence version was not verified ' +
        'against a live --version this run.',
    );
  }
});
