/**
 * Paired-negative tests for the unpinned-tool-install pre-push gate
 * (issue #654, .claude/rules/ci-tool-pinning.md §1 Rule A).
 *
 * Principle 02 (paired-negative) requirement: one positive test that TRIPS
 * the check (would-flag), one negative test that PASSES (would-not-flag).
 *
 * Pure-function design: checkUnpinnedToolInstalls() takes workflow file content
 * as a string (parallel to checkS17TrailerBody in checks/s17.ts), enabling
 * unit-testing without filesystem I/O.
 */
import { describe, it, expect } from 'vitest';
import {
  checkUnpinnedToolInstalls,
  isShellScriptPopulationFile,
  type UnpinnedFinding,
} from './checks/unpinned-tool-install.ts';

// ── helpers ──────────────────────────────────────────────────────────────────

function findingsFor(content: string, filename = 'test.yml'): UnpinnedFinding[] {
  return checkUnpinnedToolInstalls(content, filename);
}

function trips(content: string): boolean {
  return findingsFor(content).length > 0;
}

function passes(content: string): boolean {
  return findingsFor(content).length === 0;
}

// ── POSITIVE: fixtures that SHOULD trip the check ────────────────────────────

describe('unpinned-tool-install check — TRIPS (positive — violation)', () => {
  it('pip install without version pin trips the check', () => {
    const yml = `
jobs:
  build:
    steps:
      - name: Install pyyaml
        run: pip install pyyaml
`;
    expect(trips(yml)).toBe(true);
  });

  it('npm install -g without @version trips the check', () => {
    const yml = `
jobs:
  build:
    steps:
      - name: Install zizmor
        run: npm install -g some-tool
`;
    expect(trips(yml)).toBe(true);
  });

  it('npm i -g shorthand without @version trips the check', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: npm i -g some-tool
`;
    expect(trips(yml)).toBe(true);
  });

  it('npm install -g scoped package without @version trips (scope @ is not a version pin)', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: npm install -g @angular/cli
`;
    expect(trips(yml)).toBe(true);
  });

  it('pip install with trailing regular comment (not escape hatch) trips the check', () => {
    // A regular comment does NOT activate the escape hatch.
    // Only the exact token # ci-tool-pin: allow triggers exemption.
    const yml = `
jobs:
  build:
    steps:
      - run: pip install pyyaml  # install pyyaml for audit probes
`;
    expect(trips(yml)).toBe(true);
  });

  it('pip install with wrong comment prefix trips the check', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: pip install foo  # allow this
`;
    // "allow this" without the exact "ci-tool-pin: allow" token → still flagged
    expect(trips(yml)).toBe(true);
  });

  it('finding includes file:line for every flagged line', () => {
    const yml = [
      'jobs:',
      '  build:',
      '    steps:',
      '      - run: pip install pyyaml',
    ].join('\n');
    const findings = findingsFor(yml, 'audit-self.yml');
    expect(findings.length).toBe(1);
    expect(findings[0].file).toBe('audit-self.yml');
    expect(findings[0].line).toBeGreaterThan(0);
    expect(findings[0].text).toContain('pip install pyyaml');
    expect(findings[0].hint).toMatch(/==/);
  });
});

// ── NEGATIVE: fixtures that SHOULD pass (no finding) ─────────────────────────

describe('unpinned-tool-install check — PASSES (negative — no violation)', () => {
  it('pip install with ==version passes', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: pip install pyyaml==6.0.2
`;
    expect(passes(yml)).toBe(true);
  });

  it('npm ci --prefix passes (lockfile-aware, not global install)', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: npm ci --prefix packages/core --silent
`;
    expect(passes(yml)).toBe(true);
  });

  it('pip install -r requirements.txt passes (requirements-file carve-out)', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: pip install -r requirements.txt
`;
    expect(passes(yml)).toBe(true);
  });

  it('pip install . passes (local editable carve-out)', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: pip install .
`;
    expect(passes(yml)).toBe(true);
  });

  it('pip install -e . passes (explicit editable flag carve-out)', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: pip install -e .
`;
    expect(passes(yml)).toBe(true);
  });

  it('comment line starting with # passes (not a shell command)', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: |
          # pip install pyyaml is documented but not run here
          echo "done"
`;
    expect(passes(yml)).toBe(true);
  });

  it('escape hatch: exact # ci-tool-pin: allow token on same line passes', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: pip install some-tool  # ci-tool-pin: allow no stable release; main branch only
`;
    expect(passes(yml)).toBe(true);
  });

  it('escape hatch: # ci-tool-pin: allow with no trailing reason also passes', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: pip install foo  # ci-tool-pin: allow
`;
    expect(passes(yml)).toBe(true);
  });

  it('npm install -g with @version passes', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: npm install -g zizmor@1.26.1
`;
    expect(passes(yml)).toBe(true);
  });

  it('npm install -g scoped package with @version passes (scope stripped, version pin present)', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: npm install -g @angular/cli@15.0.0
`;
    expect(passes(yml)).toBe(true);
  });

  it('zizmor==1.26.1 (pinned) passes', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: pip install zizmor==1.26.1
`;
    expect(passes(yml)).toBe(true);
  });
});

// ── Shell-script slice (ci-tool-pinning.md §2 scope widening, 2026-07-10) ─────
// The per-line checks are content-agnostic, so the same pure function covers
// shell-script content. Paired-negative per principle 02: one .sh fixture that
// TRIPS, one that PASSES.

describe('unpinned-tool-install check — shell-script content', () => {
  it('bare npm install -g in a shell script trips (the retired setup.sh gap, PR #946)', () => {
    const sh = [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'npm install -g ai-factory',
    ].join('\n');
    const findings = checkUnpinnedToolInstalls(sh, 'setup.sh');
    expect(findings.length).toBe(1);
    expect(findings[0].file).toBe('setup.sh');
    expect(findings[0].text).toContain('npm install -g ai-factory');
  });

  it('pinned npm install -g in a shell script passes', () => {
    const sh = 'npm install -g ai-factory@1.2.3\n';
    expect(checkUnpinnedToolInstalls(sh, 'setup.sh')).toHaveLength(0);
  });

  it('echo-printed install hint does NOT trip (printed-hint carve-out, cold-review M2)', () => {
    const sh = [
      'echo "Manual fallback: npm install -g ai-factory"',
      '  printf "or: pip install some-tool\\n"',
    ].join('\n');
    expect(checkUnpinnedToolInstalls(sh, 'install.sh')).toHaveLength(0);
  });

  it('a real install after an echo line still trips (carve-out is line-leading only)', () => {
    const sh = ['echo "installing..."', 'npm install -g ai-factory'].join('\n');
    expect(checkUnpinnedToolInstalls(sh, 'install.sh')).toHaveLength(1);
  });

  it('escape hatch token works in shell scripts too', () => {
    const sh = 'pip install some-tool  # ci-tool-pin: allow no stable release\n';
    expect(checkUnpinnedToolInstalls(sh, 'scripts/x.sh')).toHaveLength(0);
  });
});

// ── Population predicate (shell slice) — paired-negative ─────────────────────

describe('isShellScriptPopulationFile — population boundaries', () => {
  it('*.sh files are in the population (positive)', () => {
    expect(isShellScriptPopulationFile('scripts/build-synth-bundle.sh')).toBe(true);
    expect(isShellScriptPopulationFile('setup.d/engine.sh')).toBe(true);
    expect(isShellScriptPopulationFile('install.sh')).toBe(true);
    expect(isShellScriptPopulationFile('.claude/hooks/worktree-setup.sh')).toBe(true);
  });

  it('root extensionless `setup` entrypoint is in the population (positive)', () => {
    expect(isShellScriptPopulationFile('setup')).toBe(true);
  });

  it('extensionless shell scripts under .husky/ and plugin/hooks/ are in the population (positive — backward-sweep siblings)', () => {
    expect(isShellScriptPopulationFile('.husky/pre-push')).toBe(true);
    expect(isShellScriptPopulationFile('.husky/pre-commit')).toBe(true);
    expect(isShellScriptPopulationFile('plugin/hooks/session-start')).toBe(true);
  });

  it('non-script files under the hook dirs are NOT in the population (negative — cold-review m1)', () => {
    expect(isShellScriptPopulationFile('plugin/hooks/hooks.json')).toBe(false);
    expect(isShellScriptPopulationFile('plugin/hooks/run-hook.cmd')).toBe(false);
    expect(isShellScriptPopulationFile('.husky/_/husky.sh')).toBe(false); // husky-internal shim
    expect(isShellScriptPopulationFile('.husky/_/pre-push')).toBe(false);
  });

  it('setup.d/companions.manifest is NOT in the population (negative — companion no-pin surface, companion-install-principle.md §1)', () => {
    expect(isShellScriptPopulationFile('setup.d/companions.manifest')).toBe(false);
  });

  it('non-script files are NOT in the population (negative)', () => {
    expect(isShellScriptPopulationFile('.github/workflows/audit-self.yml')).toBe(false);
    expect(isShellScriptPopulationFile('README.md')).toBe(false);
    expect(isShellScriptPopulationFile('packages/core/hooks/pre-push.ts')).toBe(false);
    // nested `setup` name is not the root entrypoint
    expect(isShellScriptPopulationFile('docs/setup')).toBe(false);
  });
});

// ── Mutation-killer boundary tests ────────────────────────────────────────────

describe('unpinned-tool-install check — mutation-killer boundaries', () => {
  it('empty content produces no findings', () => {
    expect(findingsFor('')).toHaveLength(0);
  });

  it('unrelated shell commands produce no findings', () => {
    const yml = `
jobs:
  build:
    steps:
      - run: echo hello
      - run: ls -la
      - run: git status
`;
    expect(passes(yml)).toBe(true);
  });

  it('pip install with == is NOT flagged (exact boundary: == present)', () => {
    expect(passes('      - run: pip install foo==1.0\n')).toBe(true);
  });

  it('pip install WITHOUT == IS flagged (exact boundary: no ==)', () => {
    expect(trips('      - run: pip install foo\n')).toBe(true);
  });

  it('multiple violations produce one finding per line', () => {
    const yml = [
      '      - run: pip install aaa',
      '      - run: pip install bbb',
    ].join('\n');
    expect(findingsFor(yml).length).toBe(2);
  });
});
