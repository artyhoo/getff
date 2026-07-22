// Cargo honest demo — live-fire gate (launch-preannounce-track S4, F2a).
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §5.
//
// Mirrors backends/cargo/firing.test.ts: the live arms fire a REAL `cargo clippy` FOR REAL —
// including CI (ecosystem-wiring W4): audit-self.yml installs the pinned rust toolchain and the
// demo crate pins `rust-toolchain.toml` channel = 1.96.1, so `cargo clippy` resolves the same
// toolchain the committed evidence was fired against (no false-RED from a runner's default rust).
// When cargo is absent a module-level loud warn prints (never a silent pass). The always-on blocks
// (self-application byte-check) run everywhere, so demo-crate drift is gated regardless of tool presence.
//
// The live arms prove the SEVERITY PROJECTION end to end:
//   GREEN (negative control): the committed conforming crate -> `cargo clippy` exit 0.
//   RED   (planted violation): a real std::env::var call blocked by [lints.clippy] deny -> != 0.
// run-demo.sh is the single source of truth for the arm logic; this test spawns it and asserts
// exit 0 (== both arms behaved), plus a direct planted-vs-no-projection paired-negative so the
// gate discriminates the projection itself, not just clippy's presence.

import { readFileSync, mkdtempSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRATE = join(__dirname, 'crate');
const CRATE_TARGET = join(CRATE, 'target');
const RUN_DEMO = join(__dirname, 'run-demo.sh');

// Copy the demo crate into a fixture dir WITHOUT its build cache (`target/`).
// Copying a pre-built `target/` makes cargo's mtime-based freshness check
// non-deterministic: cargo picks the copied fingerprint's mtime as its reference and
// treats the crate as fresh unless an input file out-ranks it. After a recursive copy
// every file lands in one narrow mtime window, so on a coarse-mtime filesystem (CI's
// ext4/overlayfs, 1s granularity) the copied clean-build cache can out-rank the
// rewritten inputs — cargo then reuses the clean result and NEVER compiles the planted
// violation, so `cargo clippy` exits 0 and the D3 paired-negative flakes RED-then-green.
// A fresh `target/` per fixture removes the entire stale-cache class. (2026-07-22 flake.)
function copyCrateFixture(dest: string): void {
  cpSync(CRATE, dest, {
    recursive: true,
    filter: (src) => src !== CRATE_TARGET && !src.startsWith(CRATE_TARGET + sep),
  });
}

const cargoPresent = spawnSync('cargo', ['--version'], { encoding: 'utf8' }).status === 0;
// No `!isCI` guard (ecosystem-wiring W4): CI installs the pinned toolchain and the demo crate's
// rust-toolchain.toml selects 1.96.1, so CI fires the demo FOR REAL — parity with firing.test.ts.
const runLiveFire = cargoPresent;

if (!runLiveFire) {
  console.warn(
    '⚠ live cargo demo SKIPPED (cargo not on PATH — CI install step missing or local machine ' +
      'without the pinned toolchain); the cargo honest demo MUST NOT be claimed green on live-fire ' +
      'from this run alone. The always-on self-application block below still byte-gates the committed demo crate.',
  );
}

function clippyExit(dir: string): number {
  return spawnSync('cargo', ['clippy', '--quiet'], { cwd: dir, encoding: 'utf8' }).status ?? -1;
}

describe.skipIf(!runLiveFire)('cargo honest demo — live cargo clippy (RED planted / GREEN clean)', () => {
  it('D1: run-demo.sh exits 0 — negative control passes AND planted violation is blocked', () => {
    const res = spawnSync('bash', [RUN_DEMO], { encoding: 'utf8' });
    expect(res.stdout).toContain('DEMO OK');
    expect(res.status).toBe(0);
  });

  it('D2: negative control — the committed conforming crate -> cargo clippy exit 0', () => {
    expect(clippyExit(CRATE)).toBe(0);
  });

  it('D3: paired-negative — planted violation FAILS with the deny projection, ESCAPES without it', () => {
    const planted = [
      'mod app_config { pub fn env_var(_key: &str) -> Option<String> { None } }',
      'fn main() {',
      '    let _leaked = std::env::var("HOME");',
      '    let _ok = app_config::env_var("HOME");',
      '}',
      '',
    ].join('\n');

    // WITH the committed [lints.clippy] deny projection -> blocked (exit != 0).
    const withDeny = mkdtempSync(join(tmpdir(), 'getff-demo-deny-'));
    copyCrateFixture(withDeny);
    writeFileSync(join(withDeny, 'src/main.rs'), planted, 'utf8');
    const denyRc = clippyExit(withDeny);

    // WITHOUT the projection (Cargo.toml stripped of the [lints.clippy] block) -> escapes (exit 0),
    // the pre-S4 FF7003 degrade this stage exists to fix.
    const noDeny = mkdtempSync(join(tmpdir(), 'getff-demo-nodeny-'));
    copyCrateFixture(noDeny);
    writeFileSync(join(noDeny, 'src/main.rs'), planted, 'utf8');
    writeFileSync(
      join(noDeny, 'Cargo.toml'),
      '[package]\nname = "getff-cargo-demo"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n',
      'utf8',
    );
    const noDenyRc = clippyExit(noDeny);

    expect(denyRc).not.toBe(0); // deny projection -> build FAILS over the violation
    expect(noDenyRc).toBe(0); // no projection -> warning only, build passes (the bug S4 fixes)
  });
});

// Always-on (CI-safe): the demo crate's committed Cargo.toml carries the deny projection. This is
// the drift guard — if someone edits the crate's Cargo.toml and drops the [lints.clippy] block,
// the demo would silently stop gating; this test turns that RED even where cargo is absent.
describe('cargo honest demo — self-application (T15): committed crate carries the deny projection', () => {
  it('D4: committed demo/crate/Cargo.toml contains [lints.clippy] disallowed_methods = "deny"', () => {
    const cargoToml = readFileSync(join(CRATE, 'Cargo.toml'), 'utf8');
    expect(cargoToml).toContain('[lints.clippy]\ndisallowed_methods = "deny"\n');
  });
});
