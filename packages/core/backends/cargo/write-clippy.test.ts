// Severity projection unit tests (launch-preannounce-track S4, F2a) — PURE, always-on, no cargo.
// Spec: docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md §4.
//
// renderClippyLints projects a node's requested severity onto clippy's `[lints.clippy]` ladder.
// The BEHAVIOURAL paired-negative (a real `cargo clippy` exiting 0 over a violation WITHOUT the
// deny projection vs exiting != 0 WITH it) lives in demo.test.ts's live-fire block; these are the
// pure characterization tests that gate the projection shape in CI where cargo is absent.

import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ConventionNode } from '../../ir/types.ts';
import { renderClippyLints, writeCargoClippyToml } from './write-clippy.ts';
import { renderCargoClippy } from './render-clippy.ts';
import { DEMO_NODE } from './demo/demo-node.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

function node(overrides: Partial<ConventionNode> = {}): ConventionNode {
  return { ...DEMO_NODE, ...overrides };
}

describe('renderClippyLints — severity projection onto clippy lint levels', () => {
  it('W1: error severity -> deny (the case that FAILS the build; DEMO_NODE)', () => {
    const lints = renderClippyLints([DEMO_NODE]);
    expect(lints).toBe('[lints.clippy]\ndisallowed_methods = "deny"\n');
  });

  it('W2: warning severity -> warn (a warning stays a warning; does NOT fail the build)', () => {
    const lints = renderClippyLints([node({ defaultSeverity: 'warning' })]);
    expect(lints).toBe('[lints.clippy]\ndisallowed_methods = "warn"\n');
  });

  it('W3: note severity -> omitted (informational, no build-level Cargo lint) -> empty fragment', () => {
    const lints = renderClippyLints([node({ defaultSeverity: 'note' })]);
    expect(lints).toBe('');
  });

  it('W4: kind routes to the matching lint name (type -> disallowed_types, macro -> disallowed_macros)', () => {
    const t = renderClippyLints([node({ id: 't', params: { kind: 'type', path: 'std::vec::Vec' } })]);
    const m = renderClippyLints([node({ id: 'm', params: { kind: 'macro', path: 'std::dbg' } })]);
    expect(t).toContain('disallowed_types = "deny"');
    expect(m).toContain('disallowed_macros = "deny"');
  });

  it('W5: a refused (non-type-aware) node contributes nothing to the projection', () => {
    const lints = renderClippyLints([node({ id: 's', selectorClass: 'syntax', params: {} })]);
    expect(lints).toBe('');
  });

  it('W6: strongest level wins when several nodes share a lint (warn + error -> deny)', () => {
    const warnNode = node({ id: 'w', defaultSeverity: 'warning', params: { kind: 'method', path: 'std::process::exit' } });
    const errNode = node({ id: 'e', defaultSeverity: 'error', params: { kind: 'method', path: 'std::env::var' } });
    const lints = renderClippyLints([warnNode, errNode]);
    // Both are methods -> one disallowed_methods key -> the error node escalates it to deny.
    expect(lints).toBe('[lints.clippy]\ndisallowed_methods = "deny"\n');
  });
});

describe('writeCargoClippyToml — the clippy.toml writer (packaging step)', () => {
  it('W7: writes a clippy.toml byte-equal to renderCargoClippy(nodes).toml', () => {
    const dir = mkdtempSync(join(tmpdir(), 'getff-cargo-write-'));
    writeCargoClippyToml([DEMO_NODE], dir);
    const written = readFileSync(join(dir, 'clippy.toml'), 'utf8');
    const { toml } = renderCargoClippy([DEMO_NODE]);
    expect(written).toBe(toml);
  });
});

describe('committed demo crate — self-application (T15): committed artefacts == rendered', () => {
  const CRATE = join(__dirname, 'demo/crate');

  it('W8: committed demo/crate/clippy.toml is byte-for-byte renderCargoClippy([DEMO_NODE])', () => {
    const { toml } = renderCargoClippy([DEMO_NODE]);
    const committed = readFileSync(join(CRATE, 'clippy.toml'), 'utf8');
    expect(committed).toBe(toml);
  });

  it('W9: committed demo/crate/Cargo.toml carries the deny projection renderClippyLints([DEMO_NODE])', () => {
    const lints = renderClippyLints([DEMO_NODE]);
    const cargoToml = readFileSync(join(CRATE, 'Cargo.toml'), 'utf8');
    expect(lints).toBe('[lints.clippy]\ndisallowed_methods = "deny"\n');
    expect(cargoToml).toContain('[lints.clippy]\ndisallowed_methods = "deny"\n');
  });
});
