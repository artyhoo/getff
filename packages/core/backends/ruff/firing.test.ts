// Firing harness — live-fire tests (MT umbrella S2, ruff-tidy-imports-toml backend).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// This is the RED of TDD for a rule: it fires a REAL `ruff check --output-format=json` against the
// committed fixture projects and parses the actual `code`s out of stdout. The tool is the bare PATH
// binary (firing-contract.json's `command` = `ruff check --output-format=json`); it is NOT a
// package.json dependency and NOT uvx/pip-run-resolved — CI installs it into PATH via a hard,
// exact-pinned `pip install ruff==<ver>` workflow step (audit-self.yml). A uvx-pin would convert a
// registry flake into a loud-skip (CI green without firing); a hard install fails loud-red instead,
// preserving the owner's "CI fires for real" STOP-line.
//
// Loud-skip when the tool is unavailable (not on PATH — local machine without ruff) — NEVER a
// silent pass: the ruff backend must not be claimed green on live-fire from a run that never fired
// it. There is deliberately NO `!isCI` guard (owner decision): the CI install step puts a pinned
// ruff on PATH, so CI fires it FOR REAL. The always-on self-application drift block below runs
// everywhere (CI included), so fixture drift is gated regardless of tool presence.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveToolVersion, fireContract, type RuffFiringContract } from './firing-runner.ts';
import { RUFF_TID251_NODE, RUFF_TID253_NODE } from './test-fixtures.ts';
import { renderRuff } from './render-ruff.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT: RuffFiringContract = JSON.parse(
  readFileSync(join(__dirname, 'firing-contract.json'), 'utf8'),
) as RuffFiringContract;

const INVALID_DIR = join(__dirname, 'fixtures/firing/invalid');
const VALID_DIR = join(__dirname, 'fixtures/firing/valid');
const VALID_CLEAN_DIR = join(__dirname, 'fixtures/firing/valid-clean');

// Spawning the PATH binary is fast, but keep generous headroom so a cold first spawn on a busy
// runner never trips vitest's 5s default.
const LIVE_TIMEOUT_MS = 120_000;

// Presence = is the pinned ruff on PATH here? deriveToolVersion returns undefined when the binary
// is absent (CI install step missing / local machine without ruff). No `!isCI` — CI installs it and
// must fire for real.
const resolvedVersion = deriveToolVersion(CONTRACT.command);
const toolPresent = resolvedVersion !== undefined;

// Real module-level loud-skip warning — actually prints (a console.warn inside a skipIf body can
// never fire). Never let the ruff backend be claimed green on live-fire from a run that did not
// actually fire it.
if (!toolPresent) {
  console.warn(
    '⚠ live ruff firing SKIPPED (ruff not on PATH — CI install step missing or local machine ' +
      'without the pinned binary); the ruff backend MUST NOT be claimed green on live-fire from ' +
      'this run alone. The always-on self-application drift block still gates fixture drift.',
  );
}

describe.skipIf(!toolPresent)('firing harness — live ruff check', () => {
  it(
    'RED: invalid fixture (module-level `import torch` + banned `requests`) -> BOTH TID251 and TID253 present',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, INVALID_DIR);
      for (const code of CONTRACT.expectedCodes) {
        expect(codes.has(code)).toBe(true);
      }
    },
  );

  it(
    'GREEN: valid fixture (same imports, each carrying a `# noqa: TID25x` suppression) -> NEITHER code present',
    { timeout: LIVE_TIMEOUT_MS },
    () => {
      const { codes } = fireContract(CONTRACT, VALID_DIR);
      for (const code of CONTRACT.expectedCodes) {
        expect(codes.has(code)).toBe(false);
      }
    },
  );

  it(
    'GREEN: valid-clean fixture (conforming, no banned import/API, no suppression) -> ZERO codes',
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

// Self-application (fixture-drift protection) is PURE — renderRuff([...]).toml vs a committed file
// read, no ruff. It MUST run in CI (where drift would otherwise slip through unnoticed), so it lives
// in an always-on describe, separate from the tool-spawning block above. All three fixture dirs
// share the SAME rendered ruff.toml — the config bans `requests` + `torch`; only each dir's src.py
// differs (violating / suppressed / conforming).
describe('self-application: committed fixture ruff.toml == render([TID251, TID253 nodes])', () => {
  const CONFIG_REL = 'ruff.toml';
  for (const [label, dir] of [
    ['invalid', INVALID_DIR],
    ['valid', VALID_DIR],
    ['valid-clean', VALID_CLEAN_DIR],
  ] as const) {
    it(`committed ${label}/${CONFIG_REL} is byte-for-byte the render of the fast-path nodes`, () => {
      const { toml } = renderRuff([RUFF_TID251_NODE, RUFF_TID253_NODE]);
      const committed = readFileSync(join(dir, CONFIG_REL), 'utf8');
      expect(committed).toBe(toml);
    });
  }
});
