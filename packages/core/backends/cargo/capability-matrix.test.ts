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
import { deriveRustcVersion, parseRustcVersion } from './firing-runner.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// cargo's live diagnostic identity is clippy's nested `message.code.code` shape.
const extractClippyCode = (parsed: unknown): unknown =>
  (parsed as { message?: { code?: { code?: unknown } } })?.message?.code?.code;

/**
 * Toolchain-freshness gate (attention-is-not-a-mechanism, .claude/rules/): the rustc version a
 * live-fired evidence cell CLAIMS must equal the version that actually RESOLVES for this backend at
 * test time. A hand-written toolchain string is not a mechanism — this check is. Bumping the pinned
 * toolchain (rust-toolchain.toml + audit-self.yml `rustup toolchain install`) turns this RED until
 * the committed evidence is regenerated. Pure over its inputs; the caller supplies the resolved
 * version. The rust analog of ruff's checkToolchainFreshness (ecosystem-wiring W4). Returns
 * violation strings.
 */
export function checkToolchainFreshness(m: CapabilityMatrix, resolvedVersion: string): string[] {
  const violations: string[] = [];
  for (const [cellName, cell] of Object.entries(m.cells)) {
    if (cell.status === 'no' || cell.evidence === undefined) continue;
    const toolchain = cell.evidence.toolchain ?? '';
    const claimed = parseRustcVersion(toolchain);
    if (claimed === undefined) {
      violations.push(
        `cell "${cellName}": evidence.toolchain "${toolchain}" does not name a rustc version ("rustc <semver>")`,
      );
    } else if (claimed !== resolvedVersion) {
      violations.push(
        `cell "${cellName}": evidence.toolchain claims rustc ${claimed}, but the resolving rustc is ` +
          `${resolvedVersion} — regenerate the live-fired evidence against the current toolchain`,
      );
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

describe('parseRustcVersion + checkToolchainFreshness — paired negatives (pure, always-on)', () => {
  const freshCell = (toolchain: string): CapabilityMatrix => ({
    backend: 'x',
    contract: 'x.json',
    cells: {
      'type-aware': {
        status: 'partial',
        caps: ['known gap'],
        evidence: {
          kind: 'live-fired',
          date: '2026-07-03',
          toolchain,
          capturedDiagnostic: JSON.stringify({ message: { code: { code: 'clippy::disallowed_methods' } } }),
        },
      },
    },
  });

  it('parseRustcVersion extracts the semver from a rustc --version line', () => {
    expect(parseRustcVersion('rustc 1.96.1 (31fca3adb 2026-06-26)')).toBe('1.96.1');
  });

  it('parseRustcVersion returns undefined on a non-rustc string', () => {
    expect(parseRustcVersion('clippy 0.1.96')).toBeUndefined();
  });

  it('a toolchain claiming the resolving version is fresh (no violations)', () => {
    expect(checkToolchainFreshness(freshCell('rustc 1.96.1 (31fca3adb 2026-06-26)'), '1.96.1')).toEqual([]);
  });

  it('a toolchain claiming a DIFFERENT version is a violation', () => {
    const violations = checkToolchainFreshness(freshCell('rustc 1.95.0 (deadbeef 2026-05-01)'), '1.96.1');
    expect(violations.some((v) => v.includes('regenerate the live-fired evidence'))).toBe(true);
  });

  it('a toolchain string that does not name a rustc version is a violation', () => {
    const violations = checkToolchainFreshness(freshCell('clippy 0.1.96'), '1.96.1');
    expect(violations.some((v) => v.includes('does not name a rustc version'))).toBe(true);
  });

  it('a "no" cell (no evidence) contributes no freshness violation', () => {
    const m: CapabilityMatrix = { backend: 'x', contract: 'x.json', cells: { syntax: { status: 'no', refusedCode: 'FF7001' } } };
    expect(checkToolchainFreshness(m, '1.96.1')).toEqual([]);
  });
});

describe('capability-matrix.json — the committed file passes validateMatrix', () => {
  const matrix = JSON.parse(readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8')) as CapabilityMatrix;

  it('every cell with status !== "no" carries live-fired evidence matching the contract', () => {
    const contract = JSON.parse(readFileSync(join(__dirname, matrix.contract), 'utf8')) as { expectedCode: string };
    const violations = validateMatrix(matrix, contract.expectedCode, extractClippyCode);
    expect(violations).toEqual([]);
  });

  // Toolchain freshness derives the resolving rustc version at run time (no literal in this file). It
  // requires rustc on PATH; loud-skip when absent rather than false-RED. In CI the pinned toolchain
  // install step (audit-self.yml, ecosystem-wiring W4) puts rustc 1.96.1 on PATH, so a pin bump
  // without evidence-regen turns this RED there — the deriveToolVersion analog the W4 CI arm adds.
  const resolvedVersion = deriveRustcVersion();
  it.skipIf(resolvedVersion === undefined)(
    'toolchain freshness: the evidence rustc version equals the rustc that actually resolves here',
    { timeout: 120_000 },
    () => {
      expect(checkToolchainFreshness(matrix, resolvedVersion as string)).toEqual([]);
    },
  );
  if (resolvedVersion === undefined) {
    console.warn(
      '⚠ cargo toolchain-freshness check SKIPPED (rustc not on PATH — CI install step missing or ' +
        'local machine without the pinned toolchain); the committed evidence version was not verified ' +
        'against a live rustc --version this run.',
    );
  }
});
