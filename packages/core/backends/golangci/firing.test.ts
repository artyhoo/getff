// Firing harness — live-fire tests (adapter-jig J3 Option B, golangci-forbidigo backend).
// Spec: docs/superpowers/specs/2026-07-22-adapter-jig-design.md §2/§3 (E3 arm).
// Kickoff: .claude/orchestrator-prompts/adapter-jig-j3-option-b/kickoff.md §2 step 5.
//
// The RED of TDD for the lane's delivered ban surface: fires a REAL
// `golangci-lint run --out-format=json --enable forbidigo` against the committed fixture
// modules and parses the actual identities out of stdout. The tool is the bare PATH binary
// (firing-contract.json's `command`); it is NOT a package.json dependency and NOT an
// npx-style pin — the lane audit-self.yml installs a hard, exact-pinned
// `golangci-lint@v1.55.2` into the runner's PATH (kickoff §1). A pin baked into the command
// would silently loud-skip on a registry flake (CI green without firing); a hard install
// fails loud-red instead, preserving the owner's "CI fires for real" STOP-line.
//
// Loud-skip when the tool is unavailable (not on PATH — aif container without golangci-lint)
// — NEVER a silent pass: the golangci backend must not be claimed green on live-fire from a
// run that never fired it (T-AJ-A). There is deliberately NO `!isCI` guard (mirrors ruff's
// firing.test.ts:14-16 STOP-line — CI fires it for real wherever the install step is present,
// and it IS present on this branch's base: PR #1171 merged as 124d2c4212 and installs
// `golangci-lint@v1.55.2` at `.github/workflows/audit-self.yml:306-315`).
//
// FORK #2 CLOSED (host-verify §6 step 7, CI run 31132752600): firing-contract.json now carries
// `jsonPath: "$.FromLinter"` + `expectedCodes: ["forbidigo"]`, so the loops below are no longer
// vacuous — the RED test genuinely asserts that forbidigo's identity comes back out of the
// parsed stdout. The capture also corrected the stdout SHAPE the runner parses (an object with
// an `Issues` array, not the bare array the worker-time code assumed); had the contract been
// populated without that fix, this RED test would have failed rather than passed vacuously.
//
// Guard against re-vacuuming: a future edit that empties expectedCodes would silently turn all
// three tests back into assertions about nothing, so the non-emptiness is asserted explicitly
// below rather than left to a reader noticing.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  deriveGolangciVersion,
  fireContract,
  parseCodesFromStdout,
  type GolangciFiringContract,
} from './firing-runner.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT: GolangciFiringContract = JSON.parse(
  readFileSync(join(__dirname, 'firing-contract.json'), 'utf8'),
) as GolangciFiringContract;

const INVALID_DIR = join(__dirname, 'fixtures/firing/invalid');
const VALID_DIR = join(__dirname, 'fixtures/firing/valid');
const VALID_CLEAN_DIR = join(__dirname, 'fixtures/firing/valid-clean');

// Spawning the PATH binary is fast, but keep generous headroom so a cold first spawn on a busy
// runner never trips vitest's 5s default.
const LIVE_TIMEOUT_MS = 120_000;

// Presence = is the pinned golangci-lint on PATH here? deriveGolangciVersion returns undefined
// when the binary is absent (CI install step missing / aif container without the tool).
// NO `!isCI` — CI installs it and must fire for real (lane PR #1171 brings the install step).
const resolvedVersion = deriveGolangciVersion();
const toolPresent = resolvedVersion !== undefined;

// Real module-level loud-skip warning — actually prints (a console.warn inside a skipIf body
// can never fire). Never let the golangci backend be claimed green on live-fire from a run
// that did not actually fire it.
if (!toolPresent) {
  console.warn(
    '⚠ live golangci-lint firing SKIPPED (golangci-lint not on PATH — CI install step missing ' +
      'or aif container without the pinned binary); the golangci backend MUST NOT be claimed green ' +
      'on live-fire from this run alone. The always-on self-application drift block still gates ' +
      'fixture drift.',
  );
}

// R9 parse-core — PURE, always-on, no golangci-lint required. The go analog of cargo's
// `parseCodesFromStdout — R9` block. These are the tests that make the §6 step 7 shape
// correction RED-provable: the first case below is the verbatim stdout container captured from
// the pinned v1.55.2 binary (CI run 31132752600), and it returns the EMPTY set under the
// worker-time implementation (`parseIdentitiesFromJsonArray`, which bails on any non-array root).
// Without this block the container could silently regress to the array assumption and every
// live-fire test would go quietly vacuous on the loud-skip path.
describe('parseCodesFromStdout — R9 (pure, always-on, no golangci-lint required)', () => {
  // Verbatim from the captured `invalid` run — the Report blob (a ~110-entry linter inventory)
  // is elided to one entry; nothing else is reshaped.
  const CAPTURED_INVALID_STDOUT = JSON.stringify({
    Issues: [
      {
        FromLinter: 'forbidigo',
        Text: 'use of `os.Getenv` forbidden because "Read configuration through the injected config accessor, never os.Getenv directly"',
        Severity: '',
        SourceLines: ['\t_ = os.Getenv("HOME")'],
        Replacement: null,
        Pos: { Filename: 'main.go', Offset: 113, Line: 7, Column: 6 },
        ExpectNoLint: false,
        ExpectedNoLintLinter: '',
      },
    ],
    Report: { Linters: [{ Name: 'forbidigo', Enabled: true }] },
  });

  it('extracts forbidigo from the REAL captured v1.55.2 report object', () => {
    const codes = parseCodesFromStdout(CAPTURED_INVALID_STDOUT, '$.FromLinter');
    expect([...codes]).toEqual(['forbidigo']);
  });

  it('a clean run ("Issues":[]) yields the empty set', () => {
    const stdout = JSON.stringify({ Issues: [], Report: { Linters: [] } });
    expect(parseCodesFromStdout(stdout, '$.FromLinter').size).toBe(0);
  });

  // Documents WHY this backend cannot share backends/shared/json-array-parse.ts: golangci's
  // container is genuinely a different shape, and a bare array — the worker-time assumption —
  // is not something the binary ever emits. Deleting this case would re-open the door to
  // "just reuse the shared array parser".
  it('a BARE JSON array (the wrong worker-time assumption) yields nothing — shapes are distinct', () => {
    const stdout = JSON.stringify([{ FromLinter: 'forbidigo' }]);
    expect(parseCodesFromStdout(stdout, '$.FromLinter').size).toBe(0);
  });

  it('collects every distinct linter identity when several linters report', () => {
    const stdout = JSON.stringify({
      Issues: [{ FromLinter: 'forbidigo' }, { FromLinter: 'govet' }, { FromLinter: 'forbidigo' }],
    });
    expect([...parseCodesFromStdout(stdout, '$.FromLinter')].sort()).toEqual(['forbidigo', 'govet']);
  });

  it('tolerates non-JSON stdout and an empty stdout without throwing', () => {
    expect(parseCodesFromStdout('level=error msg="boom"', '$.FromLinter').size).toBe(0);
    expect(parseCodesFromStdout('', '$.FromLinter').size).toBe(0);
  });

  // @arm:E3:neg identity-path-vs-stdout (wrong jsonPath → no identities, RED-capable)
  it('a wrong jsonPath finds nothing — the path is load-bearing, not decorative', () => {
    expect(parseCodesFromStdout(CAPTURED_INVALID_STDOUT, '$.ruleId').size).toBe(0);
  });
});

// Always-on (no spawn): the three live-fire tests below iterate `CONTRACT.expectedCodes`, so an
// empty list makes every one of them assert nothing while still reporting green. That is exactly
// the parked worker-done state, and it must never silently return. This guard is always-on
// BECAUSE the live-fire block is not: on a machine without golangci-lint the loud-skip hides the
// vacuum entirely (attention-is-not-a-mechanism §1 — a gate, not a reader noticing).
describe('firing contract is non-vacuous (always-on)', () => {
  it('expectedCodes is non-empty and jsonPath is set, or the live-fire assertions are vacuous', () => {
    expect(CONTRACT.expectedCodes.length).toBeGreaterThan(0);
    expect(CONTRACT.jsonPath.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!toolPresent)('firing harness — live golangci-lint check', () => {
  it(
    'RED: invalid fixture (module-level `os.Getenv("HOME")`) -> every expectedCode present',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, INVALID_DIR);
      for (const code of CONTRACT.expectedCodes) {
        expect(codes.has(code)).toBe(true);
      }
    },
  );

  it(
    'GREEN: valid fixture (injected accessor, no os.Getenv call, no //permit:) -> every expectedCode absent',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, VALID_DIR);
      for (const code of CONTRACT.expectedCodes) {
        expect(codes.has(code)).toBe(false);
      }
    },
  );

  it(
    'GREEN: valid-clean fixture (trivially conforming) -> ZERO codes',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, VALID_CLEAN_DIR);
      for (const code of CONTRACT.expectedCodes) {
        expect(codes.has(code)).toBe(false);
      }
      expect(codes.size).toBe(0);
    },
  );
});

// Self-application (fixture-drift protection) is PURE — reads each fixture's committed
// .golangci.yml and compares byte-for-byte against the canonical ban literal. No spawn, no
// golangci-lint. It MUST run in CI (where drift would otherwise slip through unnoticed when
// the tool is absent), so it lives in an always-on describe, separate from the tool-spawning
// block above. All three fixture dirs share the SAME .golangci.yml — the ban surface; only
// each dir's main.go differs (violating / refactored / conforming).
//
// The canonical literal is the YAML below, NOT a render call — the kickoff's `render-golangci.ts`
// STOP-line (§5) means there is no render function to call (contrast ruff's `renderRuff([...])`).
// If the lane's delivered .golangci.yml template (packages/core/templates/go/.golangci.yml) ever
// changes, all three fixtures + this literal move together in one commit.
const CANONICAL_GOLANGCI_YML = `linters:
  disable-all: true
  enable:
    - forbidigo
linters-settings:
  forbidigo:
    forbid:
      - p: 'os\\.Getenv'
        msg: 'Read configuration through the injected config accessor, never os.Getenv directly'
`;

describe('self-application: committed fixture .golangci.yml == canonical ban literal', () => {
  const CONFIG_REL = '.golangci.yml';
  for (const [label, dir] of [
    ['invalid', INVALID_DIR],
    ['valid', VALID_DIR],
    ['valid-clean', VALID_CLEAN_DIR],
  ] as const) {
    it(`committed ${label}/${CONFIG_REL} is byte-for-byte the canonical ban literal`, () => {
      const committed = readFileSync(join(dir, CONFIG_REL), 'utf8');
      expect(committed).toBe(CANONICAL_GOLANGCI_YML);
    });
  }
});
