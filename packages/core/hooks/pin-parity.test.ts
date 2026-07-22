// CI pin-parity — adapter-jig arm P1 (pinned-toolchain-in-ci).
//
// The per-line "is this install pinned at all?" discipline already ships as a Class-A gate:
// packages/core/hooks/checks/unpinned-tool-install.ts (checkUnpinnedToolInstalls) + its pre-push
// wiring (ci-tool-pinning.md §1 Rule A). This arm does NOT re-implement that — it adds the ONE
// thing the per-line gate cannot see: the F10 TWO-SURFACE mirror. The version pinned on the
// FRAMEWORK CI surface (.github/workflows/audit-self.yml) must equal the version pinned on the
// CONSUMER delivery surface (setup.d/45-python.sh) — spec §2.1 F10, §3.6 P1 ("consumer refuse-path
// pin strings mirror the framework pins ... bump together"). A silent divergence (framework bumps
// ruff to 0.15.22, the consumer firing self-check still pins 0.15.21) ships a consumer toolchain
// DIFFERENT from the framework's committed capability-matrix evidence — the drift F10 froze against,
// invisible to the per-line unpinned gate (both lines ARE pinned, just to different versions).
//
// Scope = getff-SHIPPED-and-pinned tools ONLY: ast-grep + ruff (J2 decisions log #11). rustc/cargo
// (1.96.1) is pinned on the framework surface but is NOT mirrored on any consumer surface
// (46-cargo.sh emits `rustup component add clippy` with no version pin — the cargo lane leaves the
// toolchain version to the consumer), so claiming a two-surface mirror for it would fabricate an
// invariant F10 does not state. TRACKED_TOOLS below is the honest population; a future tool pinned
// on BOTH surfaces extends it (a deliberate edit, matching F10's "bump together").
//
// @arm:P1:pos pinned-toolchain-in-ci (framework CI pins mirror the consumer delivery pins)
// @arm:P1:neg pinned-toolchain-in-ci (a framework<->consumer version divergence / dropped pin is caught)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** packages/core/hooks → repo root is three levels up. */
const REPO_ROOT = join(__dirname, '..', '..', '..');

/** The F10 pin-sync pair (spec §2.1 F10 citation). */
const FRAMEWORK_SURFACE = '.github/workflows/audit-self.yml';
const CONSUMER_SURFACE = 'setup.d/45-python.sh';

/**
 * A getff-shipped-and-pinned tool tracked by the F10 mirror (J2 decisions log #11).
 * `versionReSource` captures the semver (group 1) in EVERY pin form the tool takes across BOTH
 * surfaces. Stored as a source string, not a RegExp object, so each scan compiles a fresh regex
 * (no shared `lastIndex` state between calls).
 */
interface TrackedTool {
  readonly name: string;
  readonly versionReSource: string;
}

const TRACKED_TOOLS: readonly TrackedTool[] = [
  // npm global: `@ast-grep/cli@0.44.1` (framework CI step + consumer guidance/self-check lines).
  { name: 'ast-grep', versionReSource: '@ast-grep/cli@(\\d+\\.\\d+\\.\\d+)' },
  // pip: `ruff==0.15.21` (framework CI + consumer guidance); uvx: `ruff@0.15.21` (consumer self-check).
  { name: 'ruff', versionReSource: '\\bruff(?:==|@)(\\d+\\.\\d+\\.\\d+)' },
];

/** Distinct pinned versions of a tool found in one surface's content (sorted, deduped). */
export function pinnedVersions(content: string, tool: TrackedTool): string[] {
  const versions = new Set<string>();
  for (const m of content.matchAll(new RegExp(tool.versionReSource, 'g'))) {
    versions.add(m[1]);
  }
  return [...versions].sort();
}

/**
 * The F10 two-surface mirror check. For each tracked tool: both surfaces MUST pin it, and the
 * pinned version MUST be identical across (and within) the two surfaces. Returns one violation
 * string per broken invariant; [] means the mirror holds.
 */
export function checkPinParity(frameworkContent: string, consumerContent: string): string[] {
  const violations: string[] = [];
  for (const tool of TRACKED_TOOLS) {
    const fw = pinnedVersions(frameworkContent, tool);
    const cons = pinnedVersions(consumerContent, tool);
    if (fw.length === 0) {
      violations.push(
        `${tool.name}: no pinned version on the framework surface — the F10 mirror cannot hold ` +
          `(dropped pin or renamed tool)`,
      );
    }
    if (cons.length === 0) {
      violations.push(
        `${tool.name}: no pinned version on the consumer surface — the F10 mirror cannot hold ` +
          `(dropped pin or floated install)`,
      );
    }
    // Divergence: any version disagreement across (or within) the two surfaces. Only meaningful
    // once both surfaces pin at least one version — a missing-surface case is already reported.
    const combined = new Set([...fw, ...cons]);
    if (fw.length > 0 && cons.length > 0 && combined.size > 1) {
      violations.push(
        `${tool.name}: pin divergence — framework pins {${fw.join(', ')}}, consumer pins ` +
          `{${cons.join(', ')}}; F10 requires mirrored pin strings that bump together`,
      );
    }
  }
  return violations;
}

describe('P1 CI pin-parity — framework CI pins mirror the consumer delivery pins (F10)', () => {
  const framework = readFileSync(join(REPO_ROOT, FRAMEWORK_SURFACE), 'utf8');
  const consumer = readFileSync(join(REPO_ROOT, CONSUMER_SURFACE), 'utf8');

  it('the tracked tools are actually pinned on BOTH real surfaces (population is live, not vacuous)', () => {
    for (const tool of TRACKED_TOOLS) {
      expect(pinnedVersions(framework, tool).length, `${tool.name} on framework`).toBeGreaterThan(0);
      expect(pinnedVersions(consumer, tool).length, `${tool.name} on consumer`).toBeGreaterThan(0);
    }
  });

  // @arm:P1:pos — the REAL tree: every tracked tool's framework pin equals its consumer pin.
  it('REAL tree: framework CI and consumer delivery pin the SAME version of every tracked tool', () => {
    expect(checkPinParity(framework, consumer)).toEqual([]);
  });

  // @arm:P1:neg — a synthetic framework<->consumer version divergence is caught (RED-proof).
  it('paired negative: a version divergence between the two surfaces is caught', () => {
    const fwStub = 'run: pip install ruff==0.15.21\nrun: npm install -g @ast-grep/cli@0.44.1\n';
    const consStub = 'uvx ruff@0.15.20 check\nnpx -p @ast-grep/cli@0.44.1 ast-grep scan\n'; // ruff drifted
    const v = checkPinParity(fwStub, consStub);
    expect(v.length).toBe(1);
    expect(v[0]).toContain('ruff');
    expect(v[0]).toContain('divergence');
  });

  it('paired negative: a tool floated (unpinned) on the consumer surface breaks the mirror', () => {
    const fwStub = 'pip install ruff==0.15.21\nnpm install -g @ast-grep/cli@0.44.1\n';
    const consStub = 'pip install ruff\nnpx -p @ast-grep/cli@0.44.1 ast-grep scan\n'; // ruff floated
    const v = checkPinParity(fwStub, consStub);
    expect(v.some((x) => x.includes('ruff') && x.includes('consumer surface'))).toBe(true);
  });

  it('paired negative: a tool dropped from the framework surface breaks the mirror', () => {
    const fwStub = 'npm install -g @ast-grep/cli@0.44.1\n'; // ruff absent on framework
    const consStub = 'uvx ruff@0.15.21 check\nnpx -p @ast-grep/cli@0.44.1 ast-grep scan\n';
    const v = checkPinParity(fwStub, consStub);
    expect(v.some((x) => x.includes('ruff') && x.includes('framework surface'))).toBe(true);
  });

  it('positive control: a matching synthetic pair (incl. the uvx ruff@ form) is clean', () => {
    const fwStub = 'pip install ruff==0.15.21\nnpm install -g @ast-grep/cli@0.44.1\n';
    const consStub =
      'pip install ruff==0.15.21\nuvx ruff@0.15.21 check\nnpx -p @ast-grep/cli@0.44.1 ast-grep scan\n';
    expect(checkPinParity(fwStub, consStub)).toEqual([]);
  });
});
