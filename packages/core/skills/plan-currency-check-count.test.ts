/**
 * Tests for plan-currency-check.sh complete-count predicate (GH-4208120859 fix).
 *
 * The Dot system review on artyhoo/getff#2079 (GH-4208120859, 2026-10-09) found the
 * authorized dated-queue-count write fed from TRUNCATED listings (`--limit 20` planning
 * step / `--limit 25` helper): a session could overwrite the true population (e.g. 27 open
 * PRs) with 20/25 and emit «Plan is current» from false state. The fix requires a COMPLETE
 * independently-counted population: high-limit read + saturation detection — the count is
 * authoritative only when the limit is NOT reached; any saturation / failed fetch emits
 * `OPEN_PR_TOTAL: UNKNOWN`, the explicit state that FORBIDS the automatic count write.
 *
 * Verification arms (per the review's correction):
 *   - fixtures below/at/above the old limits (20 and 25): totals and queries exact;
 *   - saturation state emits UNKNOWN (never a wrong total from a truncated read);
 *   - failed-page (gh failure) state emits UNKNOWN;
 *   - a genuinely empty queue is a COMPLETE 0 (the one zero that may be written).
 *
 * Seams used (same pattern as plan-currency-check.test.ts):
 *   REPO_ROOT, MO_GH_BIN, MO_WAVE_PLAN, MO_OPEN_PR_LIMIT.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT_REAL,
  '.claude/skills/pipeline/helpers/plan-currency-check.sh',
);

let tmpRoot: string;
let promptsDir: string;
let wavePlanPath: string;
let mockGhBin: string;
let mockArgsLog: string;

const WAVE_PLAN = [
  '# Wave sequencing plan',
  '',
  '## §0 — Verified status snapshot',
  '',
  '| Wave | What | Verified status | Evidence |',
  '|---|---|---|---|',
  '| N1 | some wave | ✅ DONE | PR #100 |',
  '| umbrella-in-plan | some umbrella | ✅ DONE | shipped |',
  '',
].join('\n');

function write(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/** Mock gh: open-PR arm returns N items (N baked in at write time); merged arm returns one row. */
function installMockGh(openCount: number, opts: { failOpen?: boolean } = {}): void {
  // BSD seq counts DOWN when first > last (`seq 1 0` → 1, 0) — emit the loop only for N ≥ 1.
  const loop =
    openCount >= 1
      ? [
          "  echo -n '['",
          `  for i in $(seq 1 ${openCount}); do`,
          "    [[ $i -gt 1 ]] && echo -n ','",
          '    echo -n "{\\"number\\":$((1000+i)),\\"title\\":\\"open pr $i\\",\\"state\\":\\"OPEN\\",\\"headRefName\\":\\"h$i\\",\\"baseRefName\\":\\"staging\\"}"',
          '  done',
          "  echo ']'",
        ]
      : [ "  echo '[]'" ];
  const body = [
    '#!/usr/bin/env bash',
    '# Mock gh for the count tests. Dispatches on the query: open-PR arm vs merged arm.',
    '# Also logs its argv so tests can assert the exact query (totals AND queries exact).',
    `printf '%s\\n' "$*" >> ${JSON.stringify(mockArgsLog)}`,
    'if [[ "$*" == *"is:open"* ]]; then',
    ...(opts.failOpen ? ['  exit 1'] : []),
    ...loop,
    '  exit 0',
    'fi',
    "echo '[{\"number\":100,\"title\":\"feat: merged in plan\",\"mergedAt\":\"2026-05-01T00:00:00Z\"}]'",
  ];
  write(mockGhBin, body.join('\n'));
  chmodSync(mockGhBin, 0o755);
}

function runScript(extraEnv: Record<string, string> = {}): string {
  return execFileSync('bash', [SCRIPT], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      REPO_ROOT: tmpRoot,
      MO_GH_BIN: mockGhBin,
      MO_WAVE_PLAN: wavePlanPath,
      GIT_DIR: '',
      ...extraEnv,
    },
  }).trim();
}

function rawFileContent(): string {
  const raw = join(tmpRoot, '.claude', 'orchestrator-prompts', '_plan-currency-raw.txt');
  return existsSync(raw) ? readFileSync(raw, 'utf8') : '';
}

const createdDirs: string[] = [];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'mo-count-test-'));
  createdDirs.push(tmpRoot);

  promptsDir = join(tmpRoot, '.claude', 'orchestrator-prompts');
  mkdirSync(promptsDir, { recursive: true });
  write(join(promptsDir, 'umbrella-in-plan', 'kickoff.md'), '# kickoff\n');

  const waveDir = join(tmpRoot, 'docs', 'meta-factory');
  mkdirSync(waveDir, { recursive: true });
  wavePlanPath = join(waveDir, 'wave-sequencing-plan.md');
  write(wavePlanPath, WAVE_PLAN);

  const mockGhDir = join(tmpRoot, 'bin');
  mkdirSync(mockGhDir, { recursive: true });
  mockGhBin = join(mockGhDir, 'mock-gh');
  mockArgsLog = join(tmpRoot, 'mock-gh-args.log');
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

// Multi-second shell spawn — same SLOW_SHELL_MS convention as the sibling suites (#1363).
const SLOW_SHELL_MS = 30_000;

describe('plan-currency-check.sh — complete-count predicate (GH-4208120859)', { timeout: SLOW_SHELL_MS }, () => {
  it('BELOW the old limits: 19 open PRs → OPEN_PR_TOTAL: 19 (complete: yes) on stdout and in the raw file', () => {
    installMockGh(19);
    const out = runScript();
    expect(out).toContain('OPEN_PR_TOTAL: 19 (complete: yes)');
    expect(rawFileContent()).toContain('OPEN_PR_TOTAL: 19 (complete: yes)');
  });

  it('ABOVE the old limits: 27 open PRs (more than 20 AND 25) → the true total 27, complete', () => {
    installMockGh(27);
    const out = runScript();
    // No wrong total accepted: neither old-limit truncation (20/25) nor any other number.
    expect(out).toContain('OPEN_PR_TOTAL: 27 (complete: yes)');
    expect(out).not.toContain('OPEN_PR_TOTAL: 20');
    expect(out).not.toContain('OPEN_PR_TOTAL: 25');
    expect(out).not.toMatch(/OPEN_PR_TOTAL: \d+ \(complete: UNKNOWN/);
  });

  it('AT the limit: 25 open PRs with MO_OPEN_PR_LIMIT=25 → SATURATED UNKNOWN, count write FORBIDDEN', () => {
    installMockGh(25);
    const out = runScript({ MO_OPEN_PR_LIMIT: '25' });
    expect(out).toMatch(/OPEN_PR_TOTAL: 25 \(complete: UNKNOWN — SATURATED at limit 25; count write FORBIDDEN\)/);
    expect(out).not.toContain('(complete: yes)');
  });

  it('ABOVE the default limit: 200 open PRs with the default limit 200 → SATURATED UNKNOWN (never "200 complete")', () => {
    installMockGh(200);
    const out = runScript();
    expect(out).toMatch(/OPEN_PR_TOTAL: 200 \(complete: UNKNOWN — SATURATED at limit 200; count write FORBIDDEN\)/);
    expect(out).not.toContain('(complete: yes)');
  });

  it('FAILED page: gh exits non-zero → UNKNOWN with count write FORBIDDEN (no total emitted)', () => {
    installMockGh(0, { failOpen: true });
    const out = runScript();
    expect(out).toContain('OPEN_PR_TOTAL: UNKNOWN (fetch failed — count write FORBIDDEN)');
    expect(out).not.toMatch(/OPEN_PR_TOTAL: [0-9]/);
  });

  it('a genuinely empty queue is a COMPLETE 0 — the one zero that may be written', () => {
    installMockGh(0);
    const out = runScript();
    expect(out).toContain('OPEN_PR_TOTAL: 0 (complete: yes)');
  });

  it('the query is exact: the open-PR read carries --search "is:open" and the high --limit (not the old 20/25)', () => {
    installMockGh(5);
    runScript();
    const args = readFileSync(mockArgsLog, 'utf8');
    expect(args).toContain('--search is:open');
    expect(args).toContain('--limit 200');
    expect(args).not.toMatch(/--limit (20|25)(\s|$)/);
  });
});
