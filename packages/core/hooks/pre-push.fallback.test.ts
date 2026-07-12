/**
 * Content-level paired-negative mutation test for pre-push.fallback.sh —
 * the bash fallback for the Node ≥20 pre-push hook.
 *
 * Script under test: packages/core/hooks/pre-push.fallback.sh
 *
 * Checks covered:
 *   1. Prior-art presence  — every commit body MUST contain a "^Prior-art:" line
 *      (script line 69: grep -q "^Prior-art:")
 *   2. §1.7 presence       — discipline-touching commits MUST contain "^§1\.7(:| Bootstrap:)"
 *      unless subject matches the allowlist (script line 78–92)
 *   3. Historical cutoff   — commits with author_date < 2026-05-12 are skipped entirely
 *      (script line 64: [[ "${author_date}" < "${HISTORICAL_CUTOFF}" ]])
 *   4. Allowlist bypass    — subjects matching S17_ALLOWLIST_RE skip the §1.7 check
 *      (script line 78–79: [[ "${subject}" =~ $S17_ALLOWLIST_RE ]])
 *   5. No new commits      — when PREPUSH_UPSTREAM_REF == HEAD, rev-list is empty → exit 0
 *      (script line 55: [ -z "${COMMITS}" ] && exit 0)
 *
 * Paired-negative contract (5 cases × 2 assertions each):
 *   Every positive case (should exit 0 / contain ✅) has a mirrored negative case
 *   (should exit 1 / contain ❌) that differs only in the one property under test.
 *   This guarantees the test would kill a mutant that removed the relevant guard.
 *
 * T3 compliance: each assertion cites the script line/region it targets.
 * exit 0 = all critical checks passed; exit 1 = at least one critical check failed.
 *
 * Base-ref injection: PREPUSH_UPSTREAM_REF env var is used (script line 29) — simplest
 * override path that avoids stdin complexity and is already documented in the script.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync, execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'packages/core/hooks/pre-push.fallback.sh');

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temp directory with a real git repo and an initial commit that
 * serves as the "base ref" (i.e. PREPUSH_UPSTREAM_REF points at it).
 * Returns { dir, baseSha }.
 */
function makeSandbox(opts: { consumer?: boolean } = {}): {
  dir: string;
  baseSha: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'prepush-fallback-test-'));
  sandboxes.push(dir);

  execSync('git init', { cwd: dir });
  execSync('git config user.email t@t.com', { cwd: dir });
  execSync('git config user.name Test', { cwd: dir });
  // Needed in CI environments where no global git identity is configured.
  execSync('git config commit.gpgsign false', { cwd: dir });

  // GH #985 framework/consumer scope: the fallback's framework-authoring checks
  // (Prior-art §7, §1.7 presence) are gated on the SSOT-register's presence, mirroring
  // pre-push.ts's `isFrameworkRepo`. Plant the register by default so the framework-layout
  // cases below actually reach those checks; `consumer: true` omits it to exercise the guard.
  if (!opts.consumer) {
    mkdirSync(join(dir, 'docs/meta-factory'), { recursive: true });
    writeFileSync(
      join(dir, 'docs/meta-factory/prior-art-evaluations.md'),
      '# Prior-art register (test fixture)\n',
    );
    execSync('git add docs/meta-factory/prior-art-evaluations.md', { cwd: dir });
  }

  writeFileSync(join(dir, 'README.md'), 'base\n');
  execSync('git add README.md', { cwd: dir });
  // The initial "base" commit itself — PREPUSH_UPSTREAM_REF will point here.
  const msgFile = join(dir, '_commit_msg_init.txt');
  writeFileSync(
    msgFile,
    'chore: initial commit\n\nPrior-art: skipped — initial commit, no capability\n',
  );
  execSync('git commit -F _commit_msg_init.txt', { cwd: dir });

  const baseSha = execSync('git rev-parse HEAD', { cwd: dir }).toString().trim();
  return { dir, baseSha };
}

/**
 * Write a file, stage it, and commit with a multi-line message.
 * Returns the SHA of the newly created commit.
 */
function addCommit(
  dir: string,
  filename: string,
  content: string,
  subject: string,
  body = '',
  opts: { date?: string } = {},
): string {
  // Ensure parent directories exist (e.g. .claude/rules/)
  const filePath = join(dir, filename);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  execSync(`git add "${filename}"`, { cwd: dir });

  // Write message to a temp file to handle newlines safely.
  const msgFile = join(dir, '_commit_msg.txt');
  writeFileSync(msgFile, body ? `${subject}\n\n${body}\n` : subject);

  const dateEnv = opts.date
    ? { GIT_AUTHOR_DATE: opts.date, GIT_COMMITTER_DATE: opts.date }
    : {};

  execSync('git commit -F _commit_msg.txt', {
    cwd: dir,
    env: { ...process.env, ...dateEnv },
  });

  return execSync('git rev-parse HEAD', { cwd: dir }).toString().trim();
}

function run(
  dir: string,
  baseRef: string,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [SCRIPT], {
    encoding: 'utf8',
    cwd: dir,
    env: {
      ...process.env,
      PREPUSH_UPSTREAM_REF: baseRef,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pre-push.fallback.sh — paired-negative contract', () => {
  // =========================================================================
  // Case 1 — Prior-art trailer
  // =========================================================================

  it('Case 1 POSITIVE — commit WITH Prior-art: body → exit 0, ✅ Prior-art: present', () => {
    // Targets script line 69-75: grep -q "^Prior-art:" → ✅ path
    const { dir, baseSha } = makeSandbox();
    addCommit(
      dir,
      'foo.txt',
      'hello\n',
      'feat: add foo',
      'Prior-art: prior-art-evaluations.md#1 — no matching upstream capability',
    );
    const r = run(dir, baseSha);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('✅');
    expect(r.stdout).toContain('Prior-art: present');
  });

  it('Case 1 NEGATIVE — commit WITHOUT Prior-art: body → exit 1, ❌ trailer MISSING', () => {
    // Targets script line 69-72: grep fails → fail=1 + ❌ message
    const { dir, baseSha } = makeSandbox();
    addCommit(dir, 'foo.txt', 'hello\n', 'feat: add foo');
    const r = run(dir, baseSha);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('❌');
    expect(r.stdout).toContain('§7 Prior-art: trailer MISSING');
  });

  // =========================================================================
  // Case 2 — §1.7 trailer on a discipline file
  // =========================================================================

  it('Case 2 POSITIVE — discipline-file commit WITH §1.7: AND Prior-art: → exit 0, ✅ §1.7: present', () => {
    // Targets script line 80-81: grep -qE "^§1\.7(:| Bootstrap:)" → ✅ §1.7: present
    // Discipline file pattern: ^\.claude/rules/[^/]+\.md$ (script line 84)
    const { dir, baseSha } = makeSandbox();
    addCommit(
      dir,
      '.claude/rules/test-rule.md',
      '# Test rule\n',
      'feat(rules): add test rule',
      'Prior-art: prior-art-evaluations.md#1 — no upstream match\n\n§1.7: forward-check: this rule carries Class + Authoritative-for header.',
    );
    const r = run(dir, baseSha);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('✅');
    expect(r.stdout).toContain('§1.7: present');
  });

  it('Case 2 NEGATIVE — discipline-file commit WITHOUT §1.7: (but WITH Prior-art:) → exit 1, ❌ §1.7 MISSING', () => {
    // Targets script line 83-91: git diff-tree finds discipline file, fail=1 + ❌ message
    const { dir, baseSha } = makeSandbox();
    addCommit(
      dir,
      '.claude/rules/test-rule.md',
      '# Test rule\n',
      'feat(rules): add test rule',
      'Prior-art: prior-art-evaluations.md#1 — no upstream match',
    );
    const r = run(dir, baseSha);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('❌');
    expect(r.stdout).toContain('§1.7 trailer MISSING');
  });

  // =========================================================================
  // Case 3 — §1.7 allowlist bypass
  // =========================================================================

  it('Case 3 POSITIVE — allowlisted subject + discipline file + NO §1.7: → exit 0 (bypass fires)', () => {
    // Targets script line 78-79: [[ "${subject}" =~ $S17_ALLOWLIST_RE ]] → skip §1.7 check
    // Allowlist pattern: ^(docs\(research-patches\)|chore\(snapshot-regen\)|chore\(prior-art-update\)):
    const { dir, baseSha } = makeSandbox();
    addCommit(
      dir,
      '.claude/rules/test-rule.md',
      '# Allowlisted rule\n',
      'docs(research-patches): add coverage note',
      // NO §1.7 trailer — should be fine because subject is allowlisted
      'Prior-art: prior-art-evaluations.md#1 — no upstream match',
    );
    const r = run(dir, baseSha);
    expect(r.status).toBe(0);
    // Must not contain a §1.7 MISSING error
    expect(r.stdout).not.toContain('§1.7 trailer MISSING');
  });

  it('Case 3 NEGATIVE — non-allowlisted subject + discipline file + NO §1.7: → exit 1', () => {
    // Paired negative: same setup but subject NOT in allowlist → §1.7 check fires
    const { dir, baseSha } = makeSandbox();
    addCommit(
      dir,
      '.claude/rules/test-rule.md',
      '# Non-allowlisted rule\n',
      'feat(rules): add non-allowlisted rule',
      'Prior-art: prior-art-evaluations.md#1 — no upstream match',
    );
    const r = run(dir, baseSha);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('❌');
    expect(r.stdout).toContain('§1.7 trailer MISSING');
  });

  // =========================================================================
  // Case 4 — Historical cutoff
  // =========================================================================

  it('Case 4 POSITIVE — commit dated BEFORE 2026-05-12 WITHOUT Prior-art: → exit 0 (historical bypass)', () => {
    // Targets script line 63-65: author_date < HISTORICAL_CUTOFF → continue (skip checks)
    const { dir, baseSha } = makeSandbox();
    addCommit(
      dir,
      'old-file.txt',
      'old content\n',
      'feat: old commit no prior-art',
      // Intentionally NO Prior-art: trailer
      '',
      { date: '2026-05-11T00:00:00 +0000' },
    );
    const r = run(dir, baseSha);
    expect(r.status).toBe(0);
    // Should not have flagged the missing trailer
    expect(r.stdout).not.toContain('§7 Prior-art: trailer MISSING');
  });

  it('Case 4 NEGATIVE — commit dated AFTER 2026-05-12 WITHOUT Prior-art: → exit 1 (not bypassed)', () => {
    // Paired negative: same missing trailer but within the enforcement window
    const { dir, baseSha } = makeSandbox();
    addCommit(
      dir,
      'new-file.txt',
      'new content\n',
      'feat: new commit no prior-art',
      // Intentionally NO Prior-art: trailer
      '',
      { date: '2026-05-13T00:00:00 +0000' },
    );
    const r = run(dir, baseSha);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('❌');
    expect(r.stdout).toContain('§7 Prior-art: trailer MISSING');
  });

  // =========================================================================
  // Case 5 — No new commits
  // =========================================================================

  it('Case 5 POSITIVE — PREPUSH_UPSTREAM_REF points to HEAD → no new commits → exit 0', () => {
    // Targets script line 55: [ -z "${COMMITS}" ] && echo "✅ fallback: no new commits." && exit 0
    const { dir } = makeSandbox();
    // Get HEAD after initial commit (baseSha == HEAD == no new commits beyond base)
    const headSha = execSync('git rev-parse HEAD', { cwd: dir }).toString().trim();
    const r = run(dir, headSha);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('✅ fallback: no new commits');
  });

  it('Case 5 NEGATIVE — PREPUSH_UPSTREAM_REF points to EARLIER commit → new commits exist → checked', () => {
    // Paired negative: when there IS a new commit beyond base, it gets checked.
    // A commit missing Prior-art: will fail, confirming the "no new commits" path
    // is the only reason Case 5 POSITIVE passes, not a bug.
    const { dir, baseSha } = makeSandbox();
    addCommit(dir, 'x.txt', 'x\n', 'feat: x', '');
    // baseSha is before the new commit → new commit IS checked → missing Prior-art: fails
    const r = run(dir, baseSha);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('§7 Prior-art: trailer MISSING');
  });

  // =========================================================================
  // Case 6 — consumer-layout scope guard (GH #985)
  // =========================================================================
  // The fallback's §7 Prior-art + §1.7 presence arms are FRAMEWORK-AUTHORING
  // conventions. On a consumer repo (no SSOT register) they must NOT fire — else
  // every ordinary consumer commit without a `Prior-art:` line hard-blocks the
  // consumer's first `git push` on the reduced (tsx-unresolvable) fallback path.
  // Guard targets the `[ ! -f "${_top}/${SSOT_REGISTER}" ]` block added for #985.

  it('Case 6 POSITIVE — CONSUMER layout (no SSOT register) + trailer-less commit → exit 0 (guard skips)', () => {
    const { dir, baseSha } = makeSandbox({ consumer: true });
    // An ordinary consumer commit: NO Prior-art:, NO §1.7 — would fail on the framework layout.
    addCommit(dir, 'src/app.ts', 'export const x = 1;\n', 'feat: consumer feature');
    const r = run(dir, baseSha);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('REDUCED, consumer');
    expect(r.stdout).not.toContain('§7 Prior-art: trailer MISSING');
  });

  it('Case 6 NEGATIVE — FRAMEWORK layout (SSOT register present) + same trailer-less commit → exit 1 (checks fire)', () => {
    // Paired-negative: identical commit, register PRESENT → the guard does NOT skip,
    // proving it gates on the register's presence and is not dead always-skip code.
    const { dir, baseSha } = makeSandbox(); // framework layout (register planted)
    addCommit(dir, 'src/app.ts', 'export const x = 1;\n', 'feat: consumer feature');
    const r = run(dir, baseSha);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('§7 Prior-art: trailer MISSING');
    expect(r.stdout).not.toContain('REDUCED, consumer');
  });
});
