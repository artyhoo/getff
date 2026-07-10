// Firing harness — live-fire tests (MT umbrella S1, astgrep-python-yaml backend).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// This is the RED of TDD for a rule: it fires a REAL `ast-grep scan --json` against the
// committed fixture projects and parses the actual ruleIds out of stdout. The tool is the bare
// PATH binary (firing-contract.json's `command` = `ast-grep scan --json`); it is NOT a
// package.json dependency and NOT npx-resolved — CI installs it into PATH via a hard, exact-
// pinned `npm install -g @ast-grep/cli@<ver>` workflow step (audit-self.yml). An npx-pin would
// convert a registry flake into a loud-skip (CI green without firing); a hard install fails
// loud-red instead, preserving the owner's "CI fires for real" STOP-line.
//
// Loud-skip when the tool is unavailable (not on PATH — local machine without ast-grep) — NEVER
// a silent pass: the astgrep backend must not be claimed green on live-fire from a run that never
// fired it. There is deliberately NO `!isCI` guard (owner decision): the CI install step puts a
// pinned ast-grep on PATH, so CI fires it FOR REAL. The always-on self-application drift block
// below runs everywhere (CI included), so fixture drift is gated regardless of tool presence.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveToolVersion, fireContract, type AstgrepFiringContract } from './firing-runner.ts';
import { FIXTURE_NODE } from './test-fixtures.ts';
import { renderAstgrep } from './render-astgrep.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT: AstgrepFiringContract = JSON.parse(
  readFileSync(join(__dirname, 'firing-contract.json'), 'utf8'),
) as AstgrepFiringContract;

const INVALID_DIR = join(__dirname, 'fixtures/firing/invalid');
const VALID_DIR = join(__dirname, 'fixtures/firing/valid');
const VALID_CLEAN_DIR = join(__dirname, 'fixtures/firing/valid-clean');

// Spawning the PATH binary is fast, but keep generous headroom so a cold first spawn on a busy
// runner never trips vitest's 5s default.
const LIVE_TIMEOUT_MS = 120_000;

// Presence = is the pinned ast-grep on PATH here? deriveToolVersion returns undefined when the
// binary is absent (CI install step missing / local machine without ast-grep). No `!isCI` — CI
// installs it and must fire for real.
const resolvedVersion = deriveToolVersion(CONTRACT.command);
const toolPresent = resolvedVersion !== undefined;

// Real module-level loud-skip warning — actually prints (a console.warn inside a skipIf body
// can never fire). Never let the astgrep backend be claimed green on live-fire from a run that
// did not actually fire it.
if (!toolPresent) {
  console.warn(
    '⚠ live ast-grep firing SKIPPED (ast-grep not on PATH — CI install step missing or local ' +
      'machine without the pinned binary); the astgrep backend MUST NOT be claimed green on ' +
      'live-fire from this run alone. The always-on self-application drift block still gates ' +
      'fixture drift.',
  );
}

describe.skipIf(!toolPresent)('firing harness — live ast-grep scan', () => {
  it(
    'RED: invalid fixture (calls datetime.datetime.now) -> ruleIds contains the contract expectedCode',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, INVALID_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(true);
    },
  );

  it(
    'GREEN: valid fixture (injected-clock accessor + `# ast-grep-ignore` suppression) -> does NOT contain expectedCode',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, VALID_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(false);
    },
  );

  it(
    'GREEN: valid-clean fixture (conforming, never calls the banned method, no suppression) -> ZERO codes',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, VALID_CLEAN_DIR);
      expect(codes.has(CONTRACT.expectedCode)).toBe(false);
      expect(codes.size).toBe(0);
    },
  );
});

// Self-application (fixture-drift protection) is PURE — renderAstgrep([FIXTURE_NODE]) vs a
// committed file read, no ast-grep. It MUST run in CI (where drift would otherwise slip through
// unnoticed), so it lives in an always-on describe, separate from the tool-spawning block above.
describe('self-application: committed fixture rule YAML == render(FIXTURE_NODE)', () => {
  const RULE_REL = join('rules', 'no-datetime-now.yml');
  for (const [label, dir] of [
    ['invalid', INVALID_DIR],
    ['valid', VALID_DIR],
    ['valid-clean', VALID_CLEAN_DIR],
  ] as const) {
    it(`committed ${label}/${RULE_REL} is byte-for-byte the render of FIXTURE_NODE`, () => {
      const { yaml } = renderAstgrep([FIXTURE_NODE]);
      const committed = readFileSync(join(dir, RULE_REL), 'utf8');
      expect(committed).toBe(yaml);
    });
  }
});
