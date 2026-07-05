// Firing harness — live-fire tests (MT umbrella S2, cargo-backend-v0).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// This is the RED of TDD for a rule: it fires a REAL `cargo clippy` against the committed
// fixture crates and parses the actual diagnostic codes out of stdout. Live-fire is a
// DEVELOPER-MACHINE DoD gate, NOT a CI gate (kickoff §8) — it runs only when cargo is present
// AND not in CI. When it does not run, a module-level loud warn prints (never a silent pass):
// the cargo backend must not be claimed green on a run where it was never actually fired
// (T-MT-C). The always-on blocks below (self-application drift + parseCodesFromStdout) DO run
// in CI, so fixture-drift and parser regressions are still gated there.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { fireContract, parseCodesFromStdout } from './firing-runner.ts';
import type { FiringContract } from './firing-runner.ts';
import { FIXTURE_NODE } from './test-fixtures.ts';
import { renderCargoClippy } from './render-clippy.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACT: FiringContract = JSON.parse(
  readFileSync(join(__dirname, 'firing-contract.json'), 'utf8'),
) as FiringContract;

const INVALID_DIR = join(__dirname, 'fixtures/firing/invalid');
const VALID_DIR = join(__dirname, 'fixtures/firing/valid');
const VALID_CLEAN_DIR = join(__dirname, 'fixtures/firing/valid-clean');

const cargoPresent = spawnSync('cargo', ['--version'], { encoding: 'utf8' }).status === 0;
// Live-fire is a DEVELOPER-MACHINE DoD gate, NOT a CI gate (kickoff/spec §8: "не чинить
// установкой rust на раннер"). GitHub Actions ubuntu runners ship a Rust toolchain
// pre-installed, so gating on cargoPresent alone would run the live-fire block in CI against
// a clippy whose toolchain does not match our pinned 1.96.1 fixtures — a false RED. Gate on
// cargo present AND not-CI so the live block only runs where the pinned toolchain is real.
const isCI = !!process.env.CI;
const runLiveFire = cargoPresent && !isCI;

// Real module-level loud-skip warning — actually prints (a console.warn inside a skipIf body
// can never fire). T-MT-C: never let the cargo backend be claimed green on live-fire from a
// run that did not actually fire it.
if (!runLiveFire) {
  console.warn(
    `⚠ live cargo firing SKIPPED (${!cargoPresent ? 'cargo absent' : 'CI environment — live-fire is a developer-machine DoD gate, not a CI gate (kickoff §8)'}); the cargo backend MUST NOT be claimed green on live-fire from this run alone (T-MT-C). The always-on capability-matrix test still verifies the committed live-fired evidence.`,
  );
}

describe.skipIf(!runLiveFire)('firing harness — live cargo clippy', () => {
  it('R7: invalid fixture (violates the rule) -> codes contains clippy::disallowed_methods', () => {
    const { codes } = fireContract(CONTRACT, INVALID_DIR);
    expect(codes.has(CONTRACT.expectedCode)).toBe(true);
  });

  it('R8: valid fixture (uses the accessor) -> codes does NOT contain clippy::disallowed_methods', () => {
    const { codes } = fireContract(CONTRACT, VALID_DIR);
    expect(codes.has(CONTRACT.expectedCode)).toBe(false);
  });

  it('R8b: valid-clean fixture (conforming code, no #[allow], never calls the banned method) -> ZERO codes (no false positive)', () => {
    // Distinct from R8: R8 proves #[allow] suppresses on code that DOES call the method;
    // R8b proves the SAME rendered clippy.toml produces no diagnostic at all on genuinely-
    // conforming code that simply does not violate the convention (no #[allow] escape hatch).
    const { codes } = fireContract(CONTRACT, VALID_CLEAN_DIR);
    expect(codes.has(CONTRACT.expectedCode)).toBe(false);
    expect(codes.size).toBe(0);
  });
});

// Self-application (fixture-drift protection) is PURE — renderCargoClippy([FIXTURE_NODE]) vs a
// committed file read, no cargo. It MUST run in CI (where the drift would otherwise slip through
// unnoticed), so it lives in an always-on describe, separate from the cargo-spawning block above.
describe('self-application: committed fixture clippy.toml == render(FIXTURE_NODE)', () => {
  it('committed invalid/clippy.toml is byte-for-byte the render of FIXTURE_NODE', () => {
    const { toml } = renderCargoClippy([FIXTURE_NODE]);
    const committed = readFileSync(join(INVALID_DIR, 'clippy.toml'), 'utf8');
    expect(committed).toBe(toml);
  });

  it('committed valid/clippy.toml is byte-for-byte the render of FIXTURE_NODE', () => {
    const { toml } = renderCargoClippy([FIXTURE_NODE]);
    const committed = readFileSync(join(VALID_DIR, 'clippy.toml'), 'utf8');
    expect(committed).toBe(toml);
  });

  it('committed valid-clean/clippy.toml is byte-for-byte the render of FIXTURE_NODE', () => {
    const { toml } = renderCargoClippy([FIXTURE_NODE]);
    const committed = readFileSync(join(VALID_CLEAN_DIR, 'clippy.toml'), 'utf8');
    expect(committed).toBe(toml);
  });
});

describe('parseCodesFromStdout — R9 (pure, always-on, no cargo required)', () => {
  it('parses synthetic cargo NDJSON: skips non-compiler-message lines, null codes, and junk', () => {
    const stdout = [
      '{"reason":"compiler-artifact","package_id":"foo"}',
      'not json at all, just noise',
      '{"reason":"compiler-message","message":{"code":null}}',
      '{"reason":"compiler-message","message":{"code":{"code":"clippy::disallowed_methods"}}}',
      '{"reason":"build-finished","success":true}',
      '',
    ].join('\n');
    const codes = parseCodesFromStdout(stdout, '$.message.code.code');
    expect(() => codes).not.toThrow();
    expect([...codes]).toEqual(['clippy::disallowed_methods']);
  });

  it('returns an empty set when no compiler-message line carries a code', () => {
    const stdout = [
      '{"reason":"compiler-artifact","package_id":"foo"}',
      '{"reason":"compiler-message","message":{"code":null}}',
    ].join('\n');
    const codes = parseCodesFromStdout(stdout, '$.message.code.code');
    expect(codes.size).toBe(0);
  });

  it('R9b: multiple distinct codes plus a duplicate -> deduped Set of both (accumulation + dedup)', () => {
    // Two compiler-message lines carry DIFFERENT codes; a third duplicates the first.
    // The returned Set must accumulate both distinct codes and collapse the duplicate.
    const stdout = [
      '{"reason":"compiler-message","message":{"code":{"code":"clippy::disallowed_methods"}}}',
      '{"reason":"compiler-message","message":{"code":{"code":"clippy::disallowed_types"}}}',
      '{"reason":"compiler-message","message":{"code":{"code":"clippy::disallowed_methods"}}}',
    ].join('\n');
    const codes = parseCodesFromStdout(stdout, '$.message.code.code');
    expect(codes.size).toBe(2);
    expect(codes.has('clippy::disallowed_methods')).toBe(true);
    expect(codes.has('clippy::disallowed_types')).toBe(true);
  });
});
