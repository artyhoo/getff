// Capability matrix — mechanized honesty (adapter-jig J3 Option B, golangci-forbidigo backend).
// Spec: docs/superpowers/specs/2026-07-22-adapter-jig-design.md §2/§3 (E3 arm).
// Kickoff: .claude/orchestrator-prompts/adapter-jig-j3-option-b/kickoff.md §2 step 4.
//
// Always-on (golangci-lint NOT required): validates the COMMITTED capability-matrix.json against
// a structural honesty contract. At worker-done time every cell was `status:"no"`, with `syntax`
// parked under `PENDING-RUNNER-CAPTURE` because the aif container has no golangci-lint (kickoff
// §2 step 1, T-AJ-A). Host-verify §6 step 7 has since captured a real pinned-v1.55.2 run on the
// CI runner and upgraded `syntax` to `status:"partial"` with live-fired evidence; the parked
// branch is retained below only as a unit-level paired negative, not as the committed state.
// The always-on paired-negatives below prove the gate WOULD fire on drift — the E3 RED-provability
// rule (kickoff §3 + §4 T2/T20).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CapabilityMatrix } from '../shared/capability-matrix.ts';
import { validateMatrix } from '../shared/capability-matrix.ts';
import { deriveGolangciVersion, parseGolangciVersion } from './firing-runner.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// CONFIRMED against the live pinned v1.55.2 run captured at host-verify §6 step 7 (CI run
// 31132752600): each element of the report's `Issues` array carries `FromLinter` — "forbidigo"
// for this lane's findings — so this extractor reads the same field the firing runner's jsonPath
// (`$.FromLinter`) walks. What the capture also corrected: the report is an OBJECT
// (`{"Issues":[…],"Report":{…}}`), NOT the bare array the worker-time hypothesis assumed; that
// container lives in the runner's parse-core, while this extractor only ever sees a single
// already-unwrapped issue (validateMatrix hands it the parsed capturedDiagnostic).
const extractFromLinter = (parsed: unknown): unknown =>
  (parsed as { FromLinter?: unknown })?.FromLinter;

/**
 * Toolchain-freshness gate (attention-is-not-a-mechanism, .claude/rules/): the golangci-lint
 * version a live-fired evidence cell CLAIMS must equal the version that actually RESOLVES for
 * this backend at test time. A hand-written toolchain string is not a mechanism — this check is.
 * Bumping the pinned toolchain (audit-self.yml install step — lane PR #1171 carries it) turns
 * this RED until the committed evidence is regenerated. Pure over its inputs; the caller supplies
 * the resolved version. The go analog of ruff/cargo's checkToolchainFreshness. Returns violation
 * strings.
 */
export function checkToolchainFreshness(m: CapabilityMatrix, resolvedVersion: string): string[] {
  const violations: string[] = [];
  for (const [cellName, cell] of Object.entries(m.cells)) {
    if (cell.status === 'no' || cell.evidence === undefined) continue;
    const toolchain = cell.evidence.toolchain ?? '';
    const claimed = parseGolangciVersion(toolchain);
    if (claimed === undefined) {
      violations.push(
        `cell "${cellName}": evidence.toolchain "${toolchain}" does not name a golangci-lint version ("golangci-lint [v]<semver>")`,
      );
    } else if (claimed !== resolvedVersion) {
      violations.push(
        `cell "${cellName}": evidence.toolchain claims golangci-lint ${claimed}, but the resolving golangci-lint is ` +
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
      cells: { syntax: { status: 'partial' } },
    };
    const violations = validateMatrix(m, 'forbidigo', extractFromLinter);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('live-fired'))).toBe(true);
  });

  it('a "no" cell requires no evidence and is not a violation — the refusal branch stays legal', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { syntax: { status: 'no', refusedCode: 'PENDING-RUNNER-CAPTURE' } },
    };
    expect(validateMatrix(m, 'forbidigo', extractFromLinter)).toEqual([]);
  });

  it('caps on a "no" cell is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { syntax: { status: 'no', caps: ['whoops'] } },
    };
    const violations = validateMatrix(m, 'forbidigo', extractFromLinter);
    expect(violations.some((v) => v.includes('caps'))).toBe(true);
  });

  it('a partial cell with well-formed live-fired evidence matching expectedCode is valid', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        syntax: {
          status: 'partial',
          caps: ['some known gap'],
          evidence: {
            kind: 'live-fired',
            date: '2026-08-06',
            toolchain: 'golangci-lint v1.55.2',
            capturedDiagnostic: JSON.stringify({ FromLinter: 'forbidigo' }),
          },
        },
      },
    };
    expect(validateMatrix(m, 'forbidigo', extractFromLinter)).toEqual([]);
  });

  it('capturedDiagnostic with a mismatched identity is a violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: {
        syntax: {
          status: 'partial',
          evidence: {
            kind: 'live-fired',
            date: '2026-08-06',
            toolchain: 'golangci-lint v1.55.2',
            capturedDiagnostic: JSON.stringify({ FromLinter: 'govet' }),
          },
        },
      },
    };
    const violations = validateMatrix(m, 'forbidigo', extractFromLinter);
    // reconciled message: identity-mismatch now reports "identity is ..." (mirrors cargo's wording)
    expect(violations.some((v) => v.includes('identity is'))).toBe(true);
  });
});

describe('parseGolangciVersion + checkToolchainFreshness — paired negatives (pure, always-on)', () => {
  const freshCell = (toolchain: string): CapabilityMatrix => ({
    backend: 'x',
    contract: 'x.json',
    cells: {
      syntax: {
        status: 'partial',
        caps: ['known gap'],
        evidence: {
          kind: 'live-fired',
          date: '2026-08-06',
          toolchain,
          capturedDiagnostic: JSON.stringify({ FromLinter: 'forbidigo' }),
        },
      },
    },
  });

  // THE shape the real v1.x binary emits. Source, read AT THE PINNED TAG v1.55.2 (never master —
  // T-AJ-D): `printVersion()` in pkg/commands/version.go formats "golangci-lint has version %s
  // built with %s from %s on %s" — both `--version` and the `version` subcommand print through
  // it. (`BuildInfo.String()` carries this only in a later release.) Without this case the suite is green against a
  // string the binary never produces (T-AJ-A: the arm passes because it tests the fixture, not
  // the lane), and `deriveGolangciVersion()` silently returns undefined on a machine that HAS
  // the tool — a permanently inert freshness gate. Do not delete this case to "simplify".
  it('parseGolangciVersion extracts the semver from the REAL `golangci-lint has version …` output', () => {
    expect(
      parseGolangciVersion(
        'golangci-lint has version 1.55.2 built with go1.21.4 from e3c2265f on 2023-11-03T12:59:19Z',
      ),
    ).toBe('1.55.2');
  });

  // The shape CI ACTUALLY produces, which differs from the release-binary shape above. The go arm
  // installs with `go install …@v1.55.2` and no goreleaser ldflags, so the version falls back to
  // `buildInfo.Main.Version` — the tag string WITH its leading `v`, and the date renders
  // "(unknown)". Both the `has version` prefix AND the `v` prefix are therefore present at once on
  // the only path where this gate ever fires for real. Assert that combination explicitly rather
  // than trusting that two separately-tested groups compose.
  //
  // W-7 (host-verify §6 step 7): this literal is now the runner's line VERBATIM, copied from CI
  // run 31132752600 — previously it read `built with go1.21.4 from (unknown)`, while the runner
  // emits `built with go1.22.0 from (unknown, mod sum: "h1:…")`. Zero functional impact (the regex
  // stops at the semver word-boundary), but a fixture commented as "the shape CI ACTUALLY
  // produces" must BE that shape or it is a T-AJ-A fixture-not-lane claim.
  it('parseGolangciVersion handles the `go install` shape — `has version` AND a leading `v` together', () => {
    expect(
      parseGolangciVersion(
        'golangci-lint has version v1.55.2 built with go1.22.0 from (unknown, mod sum: "h1:yllEIsSJ7MtlDBwDJ9IMBkyEUz2fYE0b5B8IUgO1oP8=") on (unknown)',
      ),
    ).toBe('1.55.2');
  });

  // Discrimination is NOT defeated by the widening: a different tool that also says "has version"
  // must still be rejected, and a drifted version must still come back as the drifted value.
  it('parseGolangciVersion still rejects another tool that also prints `has version`', () => {
    expect(
      parseGolangciVersion('staticcheck has version 1.55.2 built with go1.21.4'),
    ).toBeUndefined();
  });

  it('parseGolangciVersion reads a DRIFTED version out of the real shape (drift stays detectable)', () => {
    expect(
      parseGolangciVersion('golangci-lint has version 1.54.0 built with go1.21.4 from x on y'),
    ).toBe('1.54.0');
  });

  it('parseGolangciVersion extracts the semver from a `golangci-lint v1.55.2` line', () => {
    expect(parseGolangciVersion('golangci-lint v1.55.2')).toBe('1.55.2');
  });

  it('parseGolangciVersion extracts the semver from a `golangci-lint 1.55.2` line (no `v` prefix)', () => {
    expect(parseGolangciVersion('golangci-lint 1.55.2')).toBe('1.55.2');
  });

  it('parseGolangciVersion returns undefined on a non-golangci-lint string', () => {
    expect(parseGolangciVersion('ruff 0.15.21')).toBeUndefined();
  });

  it('a toolchain claiming the resolving version is fresh (no violations)', () => {
    expect(checkToolchainFreshness(freshCell('golangci-lint v1.55.2'), '1.55.2')).toEqual([]);
  });

  // @arm:E3:neg toolchain-freshness-vs-evidence (fabricated version drift → violation, RED-capable)
  // The dispatching session's REPORT quotes this test's actual failing output (kickoff §3, T2/T20).
  it('a toolchain claiming a DIFFERENT version is a violation', () => {
    const violations = checkToolchainFreshness(freshCell('golangci-lint v1.54.0'), '1.55.2');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('regenerate the live-fired evidence'))).toBe(true);
  });

  it('a toolchain string that does not name a golangci-lint version is a violation', () => {
    const violations = checkToolchainFreshness(freshCell('ruff 0.15.21'), '1.55.2');
    expect(violations.some((v) => v.includes('does not name a golangci-lint version'))).toBe(true);
  });

  it('a "no" cell (no evidence) contributes no freshness violation', () => {
    const m: CapabilityMatrix = {
      backend: 'x',
      contract: 'x.json',
      cells: { syntax: { status: 'no', refusedCode: 'PENDING-RUNNER-CAPTURE' } },
    };
    expect(checkToolchainFreshness(m, '1.55.2')).toEqual([]);
  });
});

describe('capability-matrix.json — the committed file passes validateMatrix', () => {
  const matrix = JSON.parse(readFileSync(join(__dirname, 'capability-matrix.json'), 'utf8')) as CapabilityMatrix;

  it('every cell with status !== "no" carries live-fired evidence matching the contract', () => {
    // The expected identity is now read from the SAME committed contract the firing runner uses,
    // never restated here — a literal would let the two drift apart silently while both stayed
    // green. The `syntax` cell is non-"no" post-step-7, so this predicate's antecedent is true for
    // a real cell and validateMatrix actually checks the captured diagnostic's identity.
    const contract = JSON.parse(
      readFileSync(join(__dirname, 'firing-contract.json'), 'utf8'),
    ) as { expectedCodes: string[] };
    expect(contract.expectedCodes).toEqual(['forbidigo']);
    const violations = validateMatrix(matrix, contract.expectedCodes[0] as string, extractFromLinter);
    expect(violations).toEqual([]);
  });

  it('structural honesty: syntax is live-fired partial; type-aware + dep-graph refused FF7001', () => {
    // Locks the post-step-7 state: the upgrade landed and no cell silently over-claims. `partial`
    // (not `yes`) is load-bearing — the caps list records the identity-granularity limit the
    // capture exposed (the JSON names the LINTER, not the individual forbid pattern).
    expect(matrix.cells['syntax']?.status).toBe('partial');
    expect(matrix.cells['syntax']?.refusedCode).toBeUndefined();
    expect(matrix.cells['syntax']?.evidence?.kind).toBe('live-fired');
    expect((matrix.cells['syntax']?.caps ?? []).length).toBeGreaterThan(0);
    expect(matrix.cells['type-aware']?.status).toBe('no');
    expect(matrix.cells['type-aware']?.refusedCode).toBe('FF7001');
    expect(matrix.cells['dep-graph']?.status).toBe('no');
    expect(matrix.cells['dep-graph']?.refusedCode).toBe('FF7001');
  });

  // The captured diagnostic must be a real golangci ISSUE object, not a hand-shaped stand-in:
  // it carries the fields the v1.55.2 report actually emits, and its Pos points at the committed
  // invalid fixture's violating line. #evidence-theatre (evidence-regeneration.md §5) is exactly
  // a plausible-looking block nobody re-fired; these assertions bind the block to the fixture.
  it('capturedDiagnostic is a real v1.55.2 issue object anchored to the invalid fixture', () => {
    const captured = JSON.parse(
      matrix.cells['syntax']?.evidence?.capturedDiagnostic ?? '{}',
    ) as { FromLinter?: string; Text?: string; Pos?: { Filename?: string; Line?: number } };
    expect(captured.FromLinter).toBe('forbidigo');
    expect(captured.Text).toContain('os.Getenv');
    expect(captured.Pos?.Filename).toBe('main.go');
    // The fixture's violating call really is on line 7 — read it rather than trusting the number.
    const fixtureLine = readFileSync(join(__dirname, 'fixtures/firing/invalid/main.go'), 'utf8')
      .split('\n')[(captured.Pos?.Line ?? 0) - 1];
    expect(fixtureLine).toContain('os.Getenv');
  });

  // Toolchain freshness derives the resolving golangci-lint version at run time (no literal in
  // this file). It requires golangci-lint on PATH; loud-skip when absent rather than false-RED.
  // In CI the pinned install step puts golangci-lint v1.55.2 on PATH, so a pin bump without
  // evidence-regen turns this RED there. That step IS present on this branch's base: PR #1171
  // merged as 124d2c4212 and the go arm installs `golangci-lint@v1.55.2` at
  // `.github/workflows/audit-self.yml:306-315`. NO `!isCI` guard: ruff's firing.test.ts:14-16
  // documents this STOP-line — CI must fire for real wherever the install step is present.
  const resolvedVersion = deriveGolangciVersion();
  it.skipIf(resolvedVersion === undefined)(
    'toolchain freshness: the evidence golangci-lint version equals the golangci-lint that actually resolves here',
    { timeout: 120_000 },
    () => {
      expect(checkToolchainFreshness(matrix, resolvedVersion as string)).toEqual([]);
    },
  );
  if (resolvedVersion === undefined) {
    console.warn(
      '⚠ golangci toolchain-freshness check SKIPPED (golangci-lint not on PATH — CI install step ' +
        'missing or local machine without the pinned binary); the committed evidence version was not ' +
        'verified against a live `golangci-lint --version` this run.',
    );
  }
});
