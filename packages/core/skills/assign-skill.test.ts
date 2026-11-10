/**
 * Paired-negative tests for assign-skill.sh — L5 skill/agent assignment helper.
 *
 * Stage 5.C of umbrella meta-orchestrator-planner-completeness: verifies that the
 * helper correctly proposes skills/agents by keyword overlap, and that removing
 * the matching fixture causes the recommendation to drop.
 *
 * Principle 02 contract (both arms required):
 *   ✅ Positive: fixture with matching keywords → recommended_skill/recommended_agent emitted
 *   ❌ Paired-negative: remove matching fixture → recommendation drops (recommended: none or different)
 *
 * The test MUST FAIL if assign-skill.sh is reverted to always emitting «recommended: none».
 *
 * Seams used (env vars forwarded to the shell script):
 *   REPO_ROOT       — points to a temp fixture dir
 *   MO_SKILLS_DIR   — points to a temp skills dir with fixture SKILL.md files
 *   MO_AGENTS_DIR   — points to a temp agents dir with fixture agent .md files
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  readFileSync,
  renameSync,
} from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT_REAL,
  '.claude/skills/pipeline/helpers/assign-skill.sh',
);

// ── Fixture state shared across each test ────────────────────────────────────

let tmpRoot: string;
let skillsDir: string;
let agentsDir: string;

/** Write a UTF-8 file to path, creating parent dirs as needed. */
function write(filePath: string, content: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

/** Run assign-skill.sh with seam env vars injected. */
function runScript(type: string, description: string, extraEnv: Record<string, string> = {}): string {
  return execFileSync('bash', [SCRIPT, type, description], {
    encoding: 'utf8',
    env: {
      ...process.env,
      REPO_ROOT: tmpRoot,
      MO_SKILLS_DIR: skillsDir,
      MO_AGENTS_DIR: agentsDir,
      MO_SKILLS_GLOBAL: '0',
      // Silence git in tmpRoot (not a real repo)
      GIT_DIR: '',
      ...extraEnv,
    },
  }).trim();
}

// ── Fixture setup / teardown ──────────────────────────────────────────────────

const createdDirs: string[] = [];

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'assign-skill-test-'));
  createdDirs.push(tmpRoot);

  skillsDir = join(tmpRoot, '.claude', 'skills');
  agentsDir = join(tmpRoot, 'agents');
  mkdirSync(skillsDir, { recursive: true });
  mkdirSync(agentsDir, { recursive: true });

  // Case A fixture: meta-orchestrator skill with relevant description
  write(
    join(skillsDir, 'meta-orchestrator', 'SKILL.md'),
    [
      '---',
      'name: meta-orchestrator',
      'description: Use when you have umbrella wave dependencies cross-stage dispatch meta-orchestrator stage-gate',
      '---',
      '',
      '# /pipeline',
      '',
      'Use for cross-stage wave umbrella orchestration with stage-gate dependencies.',
      '',
    ].join('\n'),
  );

  // Case B fixture: compliance-verifier agent mentioning PR substance review
  write(
    join(agentsDir, 'compliance-verifier.md'),
    [
      '# Compliance Verifier',
      '',
      '> Purpose: PR substance review — forward+backward check on discipline-bearing PRs.',
      '',
      'This agent reviews PR body for §1.7 substance: forward-check compliance with existing',
      'disciplines and backward-check coverage of existing artefacts under the new rule scope.',
      '',
      'Use when reviewing PR substance compliance.',
      '',
    ].join('\n'),
  );

  // Tie-breaker fixture: second skill with identical score for Case D
  write(
    join(skillsDir, 'alpha-skill', 'SKILL.md'),
    [
      '---',
      'name: alpha-skill',
      'description: Use when you need vitest testing for typescript modules',
      '---',
      '',
    ].join('\n'),
  );
  write(
    join(skillsDir, 'beta-skill', 'SKILL.md'),
    [
      '---',
      'name: beta-skill',
      'description: Use when you need vitest testing for typescript modules',
      '---',
      '',
    ].join('\n'),
  );
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

// ── CASE A: Skill match ───────────────────────────────────────────────────────

describe('assign-skill.sh — Case A: skill match (positive + paired-negative)', () => {
  it('A positive: fixture meta-orchestrator SKILL.md → recommended_skill: meta-orchestrator', () => {
    // Clearing the directory seams exercises the real conventional defaults under tmpRoot.
    const out = runScript('I-phase-small', 'umbrella wave dependencies', {
      MO_SKILLS_DIR: '', MO_AGENTS_DIR: '',
    });
    expect(out).toMatch(/^recommended_skill: meta-orchestrator$/);
    // A unique owned name distinguishes this temp default catalog from a live one.
    const ownedSkill = `owned-default-${basename(tmpRoot)}`;
    renameSync(join(skillsDir, 'meta-orchestrator'), join(skillsDir, ownedSkill));
    expect(runScript('I-phase-small', 'umbrella wave dependencies', {
      MO_SKILLS_DIR: '', MO_AGENTS_DIR: '',
    })).toBe(`recommended_skill: ${ownedSkill}`);
  });

  it('A paired-negative: remove meta-orchestrator SKILL.md → NOT recommended_skill: meta-orchestrator', () => {
    // Delete the fixture skill directory
    rmSync(join(skillsDir, 'meta-orchestrator'), { recursive: true, force: true });

    const out = runScript('I-phase-small', 'umbrella wave dependencies');
    // Must NOT recommend meta-orchestrator any more
    expect(out).not.toContain('recommended_skill: meta-orchestrator');
    // The output must be exactly one line in a known form
    expect(out).toMatch(/^(recommended_skill: .+|recommended_agent: .+|recommended: none)$/);
  });
});

// ── CASE B: Agent match ───────────────────────────────────────────────────────

describe('assign-skill.sh — Case B: agent match (positive + paired-negative)', () => {
  it('B positive: compliance-verifier.md mentions PR review → recommended_agent: agents/compliance-verifier.md', () => {
    // Use a description that only matches the agent, not the skills
    const out = runScript('fix', 'PR review substance check compliance', {
      MO_SKILLS_DIR: '', MO_AGENTS_DIR: '',
    });
    expect(out).toMatch(/^recommended_agent: agents\/compliance-verifier\.md$/);
    const ownedAgent = `owned-default-${basename(tmpRoot)}`;
    renameSync(join(agentsDir, 'compliance-verifier.md'), join(agentsDir, `${ownedAgent}.md`));
    expect(runScript('fix', 'PR review substance check compliance', {
      MO_SKILLS_DIR: '', MO_AGENTS_DIR: '',
    }), 'default agent must come from the owned temporary catalog').toBe(`recommended_agent: agents/${ownedAgent}.md`);
  });

  it('B paired-negative: remove compliance-verifier.md → NOT recommended_agent for that path', () => {
    rmSync(join(agentsDir, 'compliance-verifier.md'), { force: true });

    const out = runScript('fix', 'PR review substance check compliance');
    expect(out).not.toContain('agents/compliance-verifier.md');
    expect(out).toMatch(/^(recommended_skill: .+|recommended_agent: .+|recommended: none)$/);
  });
});

// ── CASE C: No-match ──────────────────────────────────────────────────────────

describe('assign-skill.sh — Case C: no-match (negative-existence)', () => {
  it('C no-match: no skills and no agents → recommended: none', () => {
    // Remove all fixtures
    rmSync(skillsDir, { recursive: true, force: true });
    rmSync(agentsDir, { recursive: true, force: true });
    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(agentsDir, { recursive: true });

    const out = runScript('fix', 'some completely unrelated description here');
    expect(out).toBe('recommended: none');
  });

  it('C no-match: skills present but description has zero keyword overlap → recommended: none', () => {
    const out = runScript('fix', 'zzzznotamatch9999xyz');
    expect(out).toBe('recommended: none');
  });
});

// ── CASE D: Tie-breaking ──────────────────────────────────────────────────────

describe('assign-skill.sh — Case D: tie-breaking (alphabetical)', () => {
  it('D tie: two skills with equal 1-token match → alphabetically-first slug wins', () => {
    // Remove meta-orchestrator and compliance-verifier from this test
    rmSync(join(skillsDir, 'meta-orchestrator'), { recursive: true, force: true });
    rmSync(join(agentsDir, 'compliance-verifier.md'), { force: true });

    // alpha-skill and beta-skill both contain "vitest" — alphabetically alpha-skill < beta-skill
    const out = runScript('fix', 'vitest testing');
    // Must recommend alpha-skill (alphabetically first)
    expect(out).toMatch(/^recommended_skill: alpha-skill$/);
    expect(out).not.toContain('beta-skill');
  });
});

// ── CASE E: Empty description ─────────────────────────────────────────────────

describe('assign-skill.sh — Case E: empty description', () => {
  it('E empty description string → recommended: none (graceful, exit 0)', () => {
    const out = runScript('fix', '');
    expect(out).toBe('recommended: none');
  });

  it('E whitespace-only description → recommended: none', () => {
    const out = runScript('fix', '   ');
    expect(out).toBe('recommended: none');
  });
});

// ── STRUCTURAL VERIFICATION (T15 / T19) ──────────────────────────────────────

describe('assign-skill.sh — structural + self-application verification', () => {
  it('T15 + T19: script exists, is executable, and contains required markers', () => {
    expect(existsSync(SCRIPT)).toBe(true);
    const src = readFileSync(SCRIPT, 'utf8');
    // Seam overrides (mirror L1/L2 pattern). REPO_ROOT is now resolved by the shared
    // lib/common.sh sourced at the top (Stage 4 dedup) rather than an inline assignment.
    expect(src).toContain('lib/common.sh');
    expect(src).toContain('MO_SKILLS_DIR="${MO_SKILLS_DIR:-');
    expect(src).toContain('MO_AGENTS_DIR="${MO_AGENTS_DIR:-');
    // Dual-implementation-discipline §6 marker
    expect(src).toContain('@cc-only-rationale');
    // Core output vocabulary
    expect(src).toContain('recommended_skill:');
    expect(src).toContain('recommended_agent:');
    expect(src).toContain('recommended: none');
  });

  it('T15 dogfood: output is exactly one line (not multi-line crash)', () => {
    const out = runScript('I-phase-small', 'umbrella wave dependencies');
    // Must be exactly one line
    expect(out.split('\n').length).toBe(1);
    expect(out).toMatch(/^(recommended_skill: .+|recommended_agent: .+|recommended: none)$/);
  });
});
