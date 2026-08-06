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
// `golangci-lint@v1.55.2` at `.github/workflows/audit-self.yml:306-312`).
//
// FORK #2 PARKED: at worker-done time firing-contract.json carries `expectedCodes: []` +
// `jsonPath: ""`. The three live-fire tests below still exercise the spawn + parse path,
// but the `for (const code of CONTRACT.expectedCodes)` loops are empty — the assertions are
// vacuously green. This is honest: a green loud-skipped run with empty expectedCodes asserts
// "the runner spawned and parsed cleanly" without claiming "the expected identities fired".
// The dispatching session's §6 step 7 upgrade populates expectedCodes + jsonPath from a
// captured run, after which these tests have real assertion content.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveGolangciVersion, fireContract, type GolangciFiringContract } from './firing-runner.ts';

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
