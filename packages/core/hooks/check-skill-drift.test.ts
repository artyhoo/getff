/**
 * Content-level paired-negative mutation test for scripts/check-skill-drift.sh.
 *
 * Script under test: scripts/check-skill-drift.sh
 *
 * Exit code contract:
 *   0 = clean (no broken refs, no missing frontmatter, invocation-channel contract intact;
 *       trigger-overlap is WARN-only to stderr)
 *   1 = broken refs OR missing frontmatter OR invocation-channel-contract drift detected
 *
 * Checks covered:
 *   - Broken internal refs: markdown links [text](relative/path.md) whose target does not exist
 *   - Missing frontmatter: SKILL.md / agents/*.md lacking `---` + `name:` + `description:`
 *   - Combined: both errors present in one run
 *   - Invocation-channel contract: every SKILL.md whose frontmatter carries
 *     `disable-model-invocation: true` holds the canonical line from
 *     docs/meta-factory/operational-conventions.md §4 byte-for-byte, and no skill without
 *     the flag holds it; absent SSOT doc → section SKIPs rather than failing
 *
 * Paired-negative contract (5 cases):
 *
 *   Case 1 — Clean state:
 *     POSITIVE (implicit baseline): empty .claude/skills, agents, skills dirs → exit 0
 *     stdout contains "check-skill-drift: PASS (0 errors)"
 *
 *   Case 2 — Broken internal ref:
 *     POSITIVE: SKILL.md with link to nonexistent.md → exit 1,
 *       stdout contains "BROKEN-REF:" and "check-skill-drift: FAIL"
 *     NEGATIVE: same SKILL.md but link points to an EXISTING file → exit 0,
 *       stdout does NOT contain "BROKEN-REF:"
 *
 *   Case 3 — Missing frontmatter:
 *     POSITIVE: agents/my-agent.md starting with `# heading` (no ---) → exit 1,
 *       stdout contains "MISSING-FRONTMATTER:"
 *     NEGATIVE: same file WITH valid frontmatter (---/name:/description:/---) → exit 0,
 *       stdout does NOT contain "MISSING-FRONTMATTER:"
 *
 *   Case 4 — Combined errors:
 *     agents/my-agent.md missing frontmatter + skills/test/SKILL.md (with frontmatter)
 *     linking to nonexistent file → exit 1,
 *     stdout contains BOTH "BROKEN-REF:" AND "MISSING-FRONTMATTER:"
 *
 *   Case 5 — Invocation-channel contract (six sub-cases):
 *     SKIP:        no SSOT doc in the sandbox → section skipped, exit 0
 *     POSITIVE:    flag set, canonical line absent → exit 1, "CONTRACT-MISSING:"
 *     NEGATIVE:    flag set, canonical line present verbatim → exit 0, no "CONTRACT-" output
 *     DRIFT:       marker token present but text paraphrased → exit 1, "CONTRACT-DRIFT:"
 *     STALE:       canonical line present without the flag → exit 1, "CONTRACT-STALE:"
 *     NON-VACUITY: the REAL repo SSOT carries exactly one canonical line, containing the
 *       half that keeps getting dropped ("not a workaround")
 *
 * Isolation strategy:
 *   The script derives REPO_ROOT from its own file location via:
 *     SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
 *     REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
 *   REPO_ROOT cannot be overridden via env. To isolate tests, each test case:
 *     1. Creates a mkdtempSync sandbox
 *     2. Copies check-skill-drift.sh into sandbox/scripts/
 *     3. Creates fixture .claude/skills, agents, skills subdirs in sandbox
 *     4. Runs sandbox/scripts/check-skill-drift.sh — which derives REPO_ROOT = sandbox
 *   This ensures the script scans only fixture files, not the real repo.
 *
 * Mutation-sanity (M.4 pattern):
 *   - If the script's "BROKEN-REF:" output string changes → Case 2 POSITIVE test FAILS.
 *   - If the script's "MISSING-FRONTMATTER:" output string changes → Case 3 POSITIVE test FAILS.
 *   - If the script's "check-skill-drift: PASS" string changes → Case 1 test FAILS.
 *   - If the script's "check-skill-drift: FAIL" string changes → Case 2/3/4 tests FAIL.
 *   - If exit code logic is mutated (1 → 0) → Case 2/3/4 POSITIVE tests FAIL.
 *   - If exit code logic is mutated (0 → 1) → Case 2/3 NEGATIVE and Case 1 tests FAIL.
 *   - If any of "CONTRACT-MISSING:" / "CONTRACT-DRIFT:" / "CONTRACT-STALE:" or the SKIP
 *     message changes → the corresponding Case 5 sub-case FAILS.
 *   - If the canonical line in the SSOT doc is edited, Case 5 reads the NEW line from the
 *     real doc, so the fixtures follow the SSOT instead of pinning a retyped copy.
 *
 * T3 compliance: each assertion cites the script source line/region it targets.
 * T15: this test file's own isolation approach is noted in the docstring above.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  cpSync,
  chmodSync,
  readFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const REAL_SCRIPT = resolve(REPO_ROOT, 'scripts/check-skill-drift.sh');

// ── Case 5 fixtures — invocation-channel contract (script section 4) ──────────

const REAL_SSOT = resolve(
  REPO_ROOT,
  'docs/meta-factory/operational-conventions.md',
);
const CONTRACT_TOKEN = '<!-- canonical: invocation-channel-flag -->';

/** The canonical line, read from the real SSOT so a doc edit propagates into these tests. */
function canonicalLine(): string {
  const hits = readFileSync(REAL_SSOT, 'utf8')
    .split('\n')
    .filter((l) => l.includes(CONTRACT_TOKEN));
  if (hits.length !== 1) {
    throw new Error(
      `expected exactly 1 canonical line in ${REAL_SSOT}, found ${hits.length}`,
    );
  }
  return hits[0];
}

/** Write a minimal SSOT doc into the sandbox carrying the real canonical line. */
function writeSsot(sandboxRoot: string): void {
  const dir = join(sandboxRoot, 'docs', 'meta-factory');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'operational-conventions.md'),
    [
      '# Operational conventions',
      '',
      '## §4 contract',
      '',
      canonicalLine(),
      '',
    ].join('\n'),
    'utf8',
  );
}

/**
 * Write a sandbox SKILL.md with/without the flag and with one of three contract states:
 *   'none'       — no canonical line at all
 *   'canonical'  — the real canonical line, verbatim
 *   'paraphrase' — carries the token but a reworded sentence (the drift shape)
 */
function writeSkill(
  sandboxRoot: string,
  name: string,
  opts: { flag: boolean; contract: 'none' | 'canonical' | 'paraphrase' },
): void {
  const dir = join(sandboxRoot, '.claude', 'skills', name);
  mkdirSync(dir, { recursive: true });

  const body: string[] = ['', `# ${name}`, ''];
  if (opts.contract === 'canonical') body.push(canonicalLine());
  if (opts.contract === 'paraphrase') {
    body.push(
      `> **Invoked explicitly only.** This skill fires only on /${name}. ${CONTRACT_TOKEN}`,
    );
  }

  writeFileSync(
    join(dir, 'SKILL.md'),
    [
      '---',
      `name: ${name}`,
      'description: A sandbox skill fixture',
      ...(opts.flag ? ['disable-model-invocation: true'] : []),
      '---',
      ...body,
    ].join('\n'),
    'utf8',
  );
}

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0))
    rmSync(d, { recursive: true, force: true });
});

/**
 * Create an isolated sandbox directory that looks like a minimal repo:
 *   sandbox/
 *     scripts/
 *       check-skill-drift.sh  ← copy of the real script
 *     .claude/skills/         ← empty fixture dir
 *     agents/                 ← empty fixture dir
 *     skills/                 ← empty fixture dir
 *
 * When sandbox/scripts/check-skill-drift.sh runs, it derives:
 *   SCRIPT_DIR = sandbox/scripts
 *   REPO_ROOT  = sandbox
 * and scans .claude/skills, agents, skills relative to sandbox.
 */
function makeSandbox(): { root: string; scriptsDir: string } {
  const root = mkdtempSync(join(tmpdir(), 'skill-drift-test-'));
  sandboxes.push(root);

  const scriptsDir = join(root, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });

  // Copy the real script into the sandbox's scripts/ directory
  cpSync(REAL_SCRIPT, join(scriptsDir, 'check-skill-drift.sh'));
  chmodSync(join(scriptsDir, 'check-skill-drift.sh'), 0o755);

  // Create the three scan target directories (empty = no findings)
  mkdirSync(join(root, '.claude', 'skills'), { recursive: true });
  mkdirSync(join(root, 'agents'), { recursive: true });
  mkdirSync(join(root, 'skills'), { recursive: true });

  return { root, scriptsDir };
}

/**
 * Run the sandboxed script. The script derives REPO_ROOT from its own location,
 * so we simply invoke it by path with no special env overrides needed.
 *
 * Note: stdout contains the main output; stderr contains WARN-only trigger-overlap lines.
 */
function run(sandboxRoot: string): {
  status: number;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync(
    'bash',
    [join(sandboxRoot, 'scripts', 'check-skill-drift.sh')],
    {
      encoding: 'utf8',
    },
  );
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Case 1 — Clean state: no files → PASS
// ──────────────────────────────────────────────────────────────────────────────

describe('check-skill-drift.sh — paired-negative mutation contract', () => {
  it('Case 1 — Clean state: empty fixture dirs → exit 0 + PASS message', () => {
    // Script lines 202-204: if ERRORS == 0 → echo "check-skill-drift: PASS (0 errors)" + exit 0
    // find .claude/skills agents skills -name "*.md" returns no files → BROKEN_REF_COUNT=0
    // find agents -name "*.md" returns no files → FRONTMATTER_ERRORS=0
    const { root } = makeSandbox();

    const { status, stdout } = run(root);

    expect(status).toBe(0);
    // Script line 203: "check-skill-drift: PASS (0 errors)"
    expect(stdout).toContain('check-skill-drift: PASS (0 errors)');
    // No error categories should appear
    expect(stdout).not.toContain('BROKEN-REF:');
    expect(stdout).not.toContain('MISSING-FRONTMATTER:');
    expect(stdout).not.toContain('check-skill-drift: FAIL');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 2 — Broken internal ref
  // ──────────────────────────────────────────────────────────────────────────

  it('Case 2 POSITIVE: SKILL.md with link to nonexistent.md → exit 1 + BROKEN-REF output', () => {
    // Script lines 47-84: scans .claude/skills/**/*.md for markdown links.
    // Line 78-81: if target file does not exist → echo "BROKEN-REF: $md_file → $href"
    // Line 88-93: BROKEN_REF_COUNT > 0 → ERRORS++ → exit 1
    const { root } = makeSandbox();

    const skillDir = join(root, '.claude', 'skills', 'my-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: A test skill',
        '---',
        '',
        '# My Skill',
        '',
        'See [something](nonexistent.md) for details.',
      ].join('\n'),
      'utf8',
    );

    const { status, stdout } = run(root);

    // Script line 204-207: ERRORS > 0 → exit 1
    expect(status).toBe(1);
    // Script line 79: echo "BROKEN-REF: $md_file → $href"
    expect(stdout).toContain('BROKEN-REF:');
    // Script line 206: echo "check-skill-drift: FAIL ($ERRORS error category/categories)"
    expect(stdout).toContain('check-skill-drift: FAIL');
    expect(stdout).not.toContain('check-skill-drift: PASS');
  });

  it('Case 2 NEGATIVE: same SKILL.md but link points to an EXISTING file → exit 0, no BROKEN-REF', () => {
    // Paired-negative for Case 2 POSITIVE: when the linked file actually exists,
    // the broken-ref check passes. Script line 78: if [ ! -f "$resolved" ] — condition false.
    const { root } = makeSandbox();

    const skillDir = join(root, '.claude', 'skills', 'my-skill');
    mkdirSync(skillDir, { recursive: true });

    // Create the target file that will be linked
    writeFileSync(join(skillDir, 'existing.md'), '# Existing file\n', 'utf8');

    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: my-skill',
        'description: A test skill',
        '---',
        '',
        '# My Skill',
        '',
        'See [something](existing.md) for details.',
      ].join('\n'),
      'utf8',
    );

    const { status, stdout } = run(root);

    expect(status).toBe(0);
    // No broken refs → PASS
    expect(stdout).not.toContain('BROKEN-REF:');
    expect(stdout).toContain('check-skill-drift: PASS (0 errors)');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 3 — Missing frontmatter
  // ──────────────────────────────────────────────────────────────────────────

  it('Case 3 POSITIVE: agents/my-agent.md with no --- frontmatter → exit 1 + MISSING-FRONTMATTER', () => {
    // Script lines 103-141: check_frontmatter() reads file; line 109: if first_line != "---"
    // → echo "MISSING-FRONTMATTER: $file (no opening --- found)"
    // Script line 157: FRONTMATTER_ERRORS > 0 → ERRORS++ → exit 1
    const { root } = makeSandbox();

    writeFileSync(
      join(root, 'agents', 'my-agent.md'),
      ['# My Agent', '', 'This agent does things.'].join('\n'),
      'utf8',
    );

    const { status, stdout } = run(root);

    expect(status).toBe(1);
    // Script line 110-111: echo "MISSING-FRONTMATTER: $file (no opening --- found)"
    expect(stdout).toContain('MISSING-FRONTMATTER:');
    expect(stdout).toContain('check-skill-drift: FAIL');
    expect(stdout).not.toContain('check-skill-drift: PASS');
  });

  it('Case 3 NEGATIVE: same agent file WITH valid frontmatter → exit 0, no MISSING-FRONTMATTER', () => {
    // Paired-negative for Case 3 POSITIVE: when frontmatter contains name: and description:,
    // check_frontmatter() passes. Script lines 135-141: only emits error if has_name=0 or has_desc=0.
    const { root } = makeSandbox();

    writeFileSync(
      join(root, 'agents', 'my-agent.md'),
      [
        '---',
        'name: my-agent',
        'description: test agent description',
        '---',
        '',
        '# My Agent',
        '',
        'This agent does things.',
      ].join('\n'),
      'utf8',
    );

    const { status, stdout } = run(root);

    expect(status).toBe(0);
    expect(stdout).not.toContain('MISSING-FRONTMATTER:');
    expect(stdout).toContain('check-skill-drift: PASS (0 errors)');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 4 — Combined: both broken ref AND missing frontmatter
  // ──────────────────────────────────────────────────────────────────────────

  it('Case 4 — Combined: missing frontmatter + broken ref → exit 1, both error types present', () => {
    // Both check phases fire:
    //   Phase 1 (lines 47-93): SKILL.md in skills/ links to nonexistent.md → BROKEN-REF
    //   Phase 2 (lines 103-161): agents/my-agent.md has no --- → MISSING-FRONTMATTER
    // ERRORS incremented twice (one per category), ERRORS >= 2 → exit 1
    // Script line 206: "check-skill-drift: FAIL (2 error category/categories)"
    const { root } = makeSandbox();

    // Broken ref: skills/test/SKILL.md has valid frontmatter but links to nonexistent file
    const skillDir = join(root, 'skills', 'test');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      [
        '---',
        'name: test-skill',
        'description: A test skill for combined errors',
        '---',
        '',
        '# Test Skill',
        '',
        'See [reference](nonexistent-target.md) for more.',
      ].join('\n'),
      'utf8',
    );

    // Missing frontmatter: agents/my-agent.md starts with heading, no ---
    writeFileSync(
      join(root, 'agents', 'my-agent.md'),
      ['# My Agent', '', 'No frontmatter here.'].join('\n'),
      'utf8',
    );

    const { status, stdout } = run(root);

    expect(status).toBe(1);
    // Both error types must appear
    // Script line 79: "BROKEN-REF: ..."
    expect(stdout).toContain('BROKEN-REF:');
    // Script line 110 or 139: "MISSING-FRONTMATTER: ..."
    expect(stdout).toContain('MISSING-FRONTMATTER:');
    // Overall failure
    expect(stdout).toContain('check-skill-drift: FAIL');
    expect(stdout).not.toContain('check-skill-drift: PASS');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 5 — Invocation-channel contract (script section 4)
  //
  // SSOT: docs/meta-factory/operational-conventions.md §4. The canonical line is read from
  // the REAL repo doc, not retyped here — a retyped copy would pass while the doc drifted,
  // which is the exact failure mode section 4 exists to catch.
  // ──────────────────────────────────────────────────────────────────────────

  it('Case 5 SKIP: no SSOT doc in the sandbox → section skipped, still PASS', () => {
    // Script section 4: `if [ ! -f "$CONTRACT_SSOT" ]` → echo SKIP, no ERRORS increment.
    const { root } = makeSandbox();
    writeSkill(root, 'flagged', { flag: true, contract: 'none' });

    const { status, stdout } = run(root);

    expect(status).toBe(0);
    expect(stdout).toContain(
      'SKIP: docs/meta-factory/operational-conventions.md not present',
    );
    expect(stdout).toContain('check-skill-drift: PASS (0 errors)');
  });

  it('Case 5 POSITIVE: flag set, canonical line absent → exit 1 + CONTRACT-MISSING', () => {
    // Script section 4: has_flag=1 && carries=0 && no token in file → "CONTRACT-MISSING: ..."
    const { root } = makeSandbox();
    writeSsot(root);
    writeSkill(root, 'flagged', { flag: true, contract: 'none' });

    const { status, stdout } = run(root);

    expect(status).toBe(1);
    expect(stdout).toContain('CONTRACT-MISSING:');
    expect(stdout).toContain('check-skill-drift: FAIL');
    expect(stdout).not.toContain('check-skill-drift: PASS');
  });

  it('Case 5 NEGATIVE: flag set, canonical line present verbatim → exit 0, no contract finding', () => {
    // Paired-negative for Case 5 POSITIVE. Script section 4: grep -Fxq matches → carries=1.
    const { root } = makeSandbox();
    writeSsot(root);
    writeSkill(root, 'flagged', { flag: true, contract: 'canonical' });

    const { status, stdout } = run(root);

    expect(status).toBe(0);
    expect(stdout).toContain(
      'OK: every disable-model-invocation carrier states the invocation-channel contract.',
    );
    expect(stdout).not.toContain('CONTRACT-');
    expect(stdout).toContain('check-skill-drift: PASS (0 errors)');
  });

  it('Case 5 DRIFT: flag set, line carries the token but paraphrased text → exit 1 + CONTRACT-DRIFT', () => {
    // This is the half a keyword grep would miss: the token is present, so the file "looks"
    // compliant, but the sentence no longer says an agent may execute the documented steps.
    const { root } = makeSandbox();
    writeSsot(root);
    writeSkill(root, 'flagged', { flag: true, contract: 'paraphrase' });

    const { status, stdout } = run(root);

    expect(status).toBe(1);
    expect(stdout).toContain('CONTRACT-DRIFT:');
    expect(stdout).not.toContain('check-skill-drift: PASS');
  });

  it('Case 5 STALE: canonical line present but no flag in frontmatter → exit 1 + CONTRACT-STALE', () => {
    // Reverse direction: a copied line left behind after the flag was removed.
    const { root } = makeSandbox();
    writeSsot(root);
    writeSkill(root, 'unflagged', { flag: false, contract: 'canonical' });

    const { status, stdout } = run(root);

    expect(status).toBe(1);
    expect(stdout).toContain('CONTRACT-STALE:');
    expect(stdout).not.toContain('check-skill-drift: PASS');
  });

  it('Case 5 NON-VACUITY: the real repo SSOT carries exactly one canonical line', () => {
    // Without this, every Case 5 assertion above could pass against an empty/absent anchor.
    const real = readFileSync(REAL_SSOT, 'utf8')
      .split('\n')
      .filter((l) => l.includes(CONTRACT_TOKEN));
    expect(real).toHaveLength(1);
    // The (c) half — the one that keeps getting dropped — must be in the canonical text.
    expect(real[0]).toContain('not a workaround');
  });
});
