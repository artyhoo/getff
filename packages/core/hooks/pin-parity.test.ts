// CI pin-parity — adapter-jig arm P1 (pinned-toolchain-in-ci).
//
// The per-line "is this install pinned at all?" discipline already ships as a Class-A gate:
// packages/core/hooks/checks/unpinned-tool-install.ts (checkUnpinnedToolInstalls) + its pre-push
// wiring (ci-tool-pinning.md §1 Rule A). This arm does NOT re-implement that — it adds the ONE
// thing the per-line gate cannot see: the F10 TWO-SURFACE mirror. The version pinned on the
// FRAMEWORK CI surface (.github/workflows/audit-self.yml) must equal the version pinned on the
// tool's own CONSUMER delivery surfaces — spec §2.1 F10, §3.6 P1 ("consumer refuse-path
// pin strings mirror the framework pins ... bump together"). A silent divergence (framework bumps
// ruff to 0.15.22, the consumer firing self-check still pins 0.15.21) ships a consumer toolchain
// DIFFERENT from the framework's committed capability-matrix evidence — the drift F10 froze against,
// invisible to the per-line unpinned gate (both lines ARE pinned, just to different versions).
//
// The consumer surface is per-tool, not global: each lane delivers through its own files, so a
// tool carries the list of surfaces its pin is mirrored on (`consumerSurfaces`). The go family
// (J3) is the case that forced this — its mirror partners are the delivered CI template and the
// lane's REFUSE-path hint, neither of which is the python lane's file.
//
// Scope = getff-SHIPPED-and-pinned tools ONLY: ast-grep + ruff (J2 decisions log #11) + the go
// toolchain and golangci-lint (J3). rustc/cargo (1.96.1) is pinned on the framework surface but is
// NOT mirrored on any consumer surface (46-cargo.sh emits `rustup component add clippy` with no
// version pin — the cargo lane leaves the toolchain version to the consumer), so claiming a
// two-surface mirror for it would fabricate an invariant F10 does not state. TRACKED_TOOLS below is
// the honest population; a future tool pinned on BOTH surfaces extends it (a deliberate edit,
// matching F10's "bump together").
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

/** The F10 framework half of the pin-sync pair (spec §2.1 F10 citation). */
const FRAMEWORK_SURFACE = '.github/workflows/audit-self.yml';

/**
 * A getff-shipped-and-pinned tool tracked by the F10 mirror (J2 decisions log #11).
 * `versionReSource` captures the semver (group 1) in EVERY pin form the tool takes across BOTH
 * surfaces. Stored as a source string, not a RegExp object, so each scan compiles a fresh regex
 * (no shared `lastIndex` state between calls).
 * `consumerSurfaces` names the delivery files whose pin strings must move with the framework's —
 * per-tool, because each lane ships through its own files.
 */
interface TrackedTool {
  readonly name: string;
  readonly versionReSource: string;
  readonly consumerSurfaces: readonly string[];
}

const TRACKED_TOOLS: readonly TrackedTool[] = [
  // npm global: `@ast-grep/cli@0.44.1` (framework CI step + consumer guidance/self-check lines).
  {
    name: 'ast-grep',
    versionReSource: '@ast-grep/cli@(\\d+\\.\\d+\\.\\d+)',
    consumerSurfaces: ['setup.d/45-python.sh'],
  },
  // pip: `ruff==0.15.21` (framework CI + consumer guidance); uvx: `ruff@0.15.21` (consumer self-check).
  {
    name: 'ruff',
    versionReSource: '\\bruff(?:==|@)(\\d+\\.\\d+\\.\\d+)',
    consumerSurfaces: ['setup.d/45-python.sh'],
  },
  // actions/setup-go input: `go-version: '1.22.0'` on the framework arm AND on the delivered CI
  // template. The lane script carries no go-version pin (its `go 1.22` is a go.mod language
  // directive in a scratch fixture, not a toolchain pin), so it is not a mirror partner here.
  {
    name: 'go-toolchain',
    versionReSource: "go-version:\\s*'?(\\d+\\.\\d+\\.\\d+)'?",
    consumerSurfaces: ['packages/core/templates/go/github-actions-ci.yml'],
  },
  // `go install …/golangci-lint@v1.55.2` — framework arm, delivered CI template, and the lane's
  // REFUSE-path hint, which restates the pin as text a consumer is told to run.
  {
    name: 'golangci-lint',
    versionReSource: 'golangci-lint@v(\\d+\\.\\d+\\.\\d+)',
    consumerSurfaces: ['packages/core/templates/go/github-actions-ci.yml', 'setup.d/47-go.sh'],
  },
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
 * The F10 two-surface mirror check. For each tool in `tools`: both surfaces MUST pin it, and the
 * pinned version MUST be identical across (and within) the two surfaces. Returns one violation
 * string per broken invariant; [] means the mirror holds.
 * `tools` is explicit because the consumer half is per-tool: a caller passes the tool(s) whose
 * `consumerSurfaces` produced `consumerContent`. Scanning a surface for a tool it never delivers
 * would report a phantom missing-pin.
 */
export function checkPinParity(
  frameworkContent: string,
  consumerContent: string,
  tools: readonly TrackedTool[],
): string[] {
  const violations: string[] = [];
  for (const tool of tools) {
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
  /** Every consumer surface this tool is mirrored on, concatenated into one scan target. */
  const consumerContentFor = (tool: TrackedTool): string =>
    tool.consumerSurfaces.map((s) => readFileSync(join(REPO_ROOT, s), 'utf8')).join('\n');

  const pyTools = TRACKED_TOOLS.filter((t) => t.name === 'ast-grep' || t.name === 'ruff');

  it('the tracked tools are actually pinned on BOTH real surfaces (population is live, not vacuous)', () => {
    for (const tool of TRACKED_TOOLS) {
      expect(pinnedVersions(framework, tool).length, `${tool.name} on framework`).toBeGreaterThan(0);
      expect(
        pinnedVersions(consumerContentFor(tool), tool).length,
        `${tool.name} on ${tool.consumerSurfaces.join(' + ')}`,
      ).toBeGreaterThan(0);
    }
  });

  // @arm:P1:pos — the REAL tree: every tracked tool's framework pin equals its consumer pin.
  it('REAL tree: framework CI and consumer delivery pin the SAME version of every tracked tool', () => {
    for (const tool of TRACKED_TOOLS) {
      expect(checkPinParity(framework, consumerContentFor(tool), [tool]), tool.name).toEqual([]);
    }
  });

  // @arm:P1:neg — a synthetic framework<->consumer version divergence is caught (RED-proof).
  it('paired negative: a version divergence between the two surfaces is caught', () => {
    const fwStub = 'run: pip install ruff==0.15.21\nrun: npm install -g @ast-grep/cli@0.44.1\n';
    const consStub = 'uvx ruff@0.15.20 check\nnpx -p @ast-grep/cli@0.44.1 ast-grep scan\n'; // ruff drifted
    const v = checkPinParity(fwStub, consStub, pyTools);
    expect(v.length).toBe(1);
    expect(v[0]).toContain('ruff');
    expect(v[0]).toContain('divergence');
  });

  // @arm:P1:neg — the go pin forms (quoted `go-version:` input, `@v`-tagged go install) are really
  // parsed, not merely declared: a divergence in each go form is caught on its own shape.
  it('paired negative: a go-family divergence is caught in both go pin forms', () => {
    const goTools = TRACKED_TOOLS.filter(
      (t) => t.name === 'go-toolchain' || t.name === 'golangci-lint',
    );
    const fwStub =
      "          go-version: '1.22.0'\n" +
      '          go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.2\n';
    const consStub =
      "          go-version: '1.23.0'\n" + // toolchain drifted
      '        run: go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.1\n'; // linter drifted
    const v = checkPinParity(fwStub, consStub, goTools);
    expect(v.length).toBe(2);
    expect(v.some((x) => x.includes('go-toolchain') && x.includes('divergence'))).toBe(true);
    expect(v.some((x) => x.includes('golangci-lint') && x.includes('divergence'))).toBe(true);
  });

  it('paired negative: a tool floated (unpinned) on the consumer surface breaks the mirror', () => {
    const fwStub = 'pip install ruff==0.15.21\nnpm install -g @ast-grep/cli@0.44.1\n';
    const consStub = 'pip install ruff\nnpx -p @ast-grep/cli@0.44.1 ast-grep scan\n'; // ruff floated
    const v = checkPinParity(fwStub, consStub, pyTools);
    expect(v.some((x) => x.includes('ruff') && x.includes('consumer surface'))).toBe(true);
  });

  it('paired negative: a tool dropped from the framework surface breaks the mirror', () => {
    const fwStub = 'npm install -g @ast-grep/cli@0.44.1\n'; // ruff absent on framework
    const consStub = 'uvx ruff@0.15.21 check\nnpx -p @ast-grep/cli@0.44.1 ast-grep scan\n';
    const v = checkPinParity(fwStub, consStub, pyTools);
    expect(v.some((x) => x.includes('ruff') && x.includes('framework surface'))).toBe(true);
  });

  it('positive control: a matching synthetic pair (incl. the uvx ruff@ form) is clean', () => {
    const fwStub = 'pip install ruff==0.15.21\nnpm install -g @ast-grep/cli@0.44.1\n';
    const consStub =
      'pip install ruff==0.15.21\nuvx ruff@0.15.21 check\nnpx -p @ast-grep/cli@0.44.1 ast-grep scan\n';
    expect(checkPinParity(fwStub, consStub, pyTools)).toEqual([]);
  });
});
