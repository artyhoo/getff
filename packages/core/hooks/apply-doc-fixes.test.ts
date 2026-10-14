/**
 * Functional meta-tests for scripts/apply-doc-fixes.sh — the terminal-runnable
 * fixer that applies the mechanical doc-staleness corrections from the
 * doc-audit-ship-boundary Stage 2 findings (DN-1, DN-2, DN-4).
 *
 * The script edits maintainer-owned files (.claude/rules/*, README.md), so it
 * ships as a script the MAINTAINER runs rather than session-landed edits
 * (Artifact Ownership Contract). These tests run against per-test temp fixtures
 * carrying the exact stale strings — they never touch the real repo files.
 *
 *   Usage  : bash scripts/apply-doc-fixes.sh [--check] [--root DIR]
 *   exit   : 0 = ok ; 2 = bad arg
 *
 * Paired-negative (principle 02): idempotency (re-run = no-op) + absent-file
 * tolerance are the failure modes the script is paid to handle.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnBashOrSkip, type Skippable } from './spawn-bash-or-skip.ts';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/apply-doc-fixes.sh');

// Minimal fixtures embedding the EXACT stale strings the script targets.
const STALE_RULE = [
  '# Rule-enforcement channel selection',
  '',
  '> **Class:** B — compensating mechanism shipped: [`inject-matching-rule.sh`](x). **Activation pending** one `settings.json` PostToolUse `Edit|Write` entry (maintainer-landed — `settings.json` is agent-self-protected). Promotion to A in §6.',
  '',
  'body line',
  '',
  '**Activation:** add a PostToolUse `Edit|Write` entry for it in `settings.json` (maintainer; self-protected file) — see the PR body for the snippet.',
  '',
].join('\n');

const STALE_README = [
  '# Project',
  '',
  '[![Discipline Self-Check](https://x/discipline-self-check.yml/badge.svg?branch=main)](https://x)',
  '[![Audit Self](https://x/audit-self.yml/badge.svg?branch=main)](https://x)',
  '[![Workflow Integrity](https://x/workflow-integrity.yml/badge.svg?branch=main)](https://x)',
  '- **Multi-channel** — edit-time → pre-push → CI (Stryker + discipline-self-check) → production.',
  '',
].join('\n');

interface RunResult {
  stdout: string;
  status: number;
}

function runScript(ctx: Skippable, root: string, ...flags: string[]): RunResult {
  // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
  // The old execFileSync try/catch mapped throw-on-non-zero to {status: err.status ?? 1}
  // with stdout+stderr concatenated; spawnSync's result object keeps the same shape.
  const r = spawnBashOrSkip(ctx, 'bash', [SCRIPT, '--root', root, ...flags], {
    encoding: 'utf8',
  });
  return { stdout: (r.stdout ?? '') + (r.stderr ?? ''), status: r.status ?? 1 };
}

describe('apply-doc-fixes.sh', () => {
  let root: string;
  let rulePath: string;
  let readmePath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'docfix-'));
    mkdirSync(join(root, '.claude', 'rules'), { recursive: true });
    rulePath = join(root, '.claude', 'rules', 'rule-enforcement-channel-selection.md');
    readmePath = join(root, 'README.md');
    writeFileSync(rulePath, STALE_RULE);
    writeFileSync(readmePath, STALE_README);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('applies all four mechanical fixes', (ctx) => {
    const res = runScript(ctx, root);
    expect(res.status).toBe(0);

    const rule = readFileSync(rulePath, 'utf8');
    const readme = readFileSync(readmePath, 'utf8');

    // DN-1a + DN-1b: stale activation prose gone, confirmed text in
    expect(rule).not.toContain('Activation pending');
    expect(rule).not.toContain('add a PostToolUse');
    expect(rule).toContain('Activation confirmed');
    expect(rule).toContain('.claude/settings.json:114'); // cite:historical fixture data, not a live pointer

    // DN-2: badges repointed to staging (no main badge remains)
    expect(readme).not.toContain('badge.svg?branch=main');
    expect((readme.match(/badge\.svg\?branch=staging/g) ?? []).length).toBe(3);

    // DN-4: false Stryker dropped from the CI channel
    expect(readme).not.toContain('CI (Stryker + discipline-self-check)');
    expect(readme).toContain('CI (discipline-self-check)');
  });

  it('is idempotent — a second run changes nothing', (ctx) => {
    runScript(ctx, root);
    const ruleAfter1 = readFileSync(rulePath, 'utf8');
    const readmeAfter1 = readFileSync(readmePath, 'utf8');

    const res2 = runScript(ctx, root);
    expect(res2.status).toBe(0);
    expect(res2.stdout).toContain('already current');
    expect(readFileSync(rulePath, 'utf8')).toBe(ruleAfter1);
    expect(readFileSync(readmePath, 'utf8')).toBe(readmeAfter1);
  });

  it('--check reports would-fix without writing', (ctx) => {
    const before = readFileSync(readmePath, 'utf8');
    const res = runScript(ctx, root, '--check');
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('would-fix');
    // no mutation happened
    expect(readFileSync(readmePath, 'utf8')).toBe(before);
  });

  it('tolerates an absent target file (paired-negative)', (ctx) => {
    rmSync(readmePath);
    const res = runScript(ctx, root);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('skip');
    // the rule file still gets fixed
    expect(readFileSync(rulePath, 'utf8')).toContain('Activation confirmed');
  });

  it('rejects an unknown argument (paired-negative)', (ctx) => {
    const res = runScript(ctx, root, '--bogus');
    expect(res.status).toBe(2);
  });
});
