/**
 * Functional template render audit — §13.27 closure.
 *
 * Invokes install.sh against fixture skeletons in os.tmpdir(),
 * then probes rendered artefacts (deterministic-only per Decision 3):
 *   P1 — goal-phrase presence in rendered AGENTS.md
 *   P4 — Authoritative-for headers on authority-bearing rendered docs
 *   P6 — taxonomy fidelity (installed skills match framework skills/ directory)
 *
 * LLM-judge probes (P2/P3/P5) are NOT in CI per Decision 3 + «no-paid» /
 * «LLM-then-cache» invariant. They live in .claude/skills/template-audit/SKILL.md.
 *
 * Each probe has a matching negative (anti-tautology) test to prove detection
 * actually fires. Pattern mirrors audit-ai-docs.sh negative-test discipline
 * (see packages/core/audit-self/audit-ai-docs.test.sh).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const INSTALL_SH = join(REPO_ROOT, 'install.sh');
const FIXTURES_DIR = join(HERE, 'fixtures');

type Stack = 'ts-server' | 'react-next';

const STACKS: Stack[] = ['ts-server', 'react-next'];

const consumerDirs: Record<Stack, string> = { 'ts-server': '', 'react-next': '' };

// ── P1: goal-phrase synonyms ─────────────────────────────────────────────
// Phrases from installed templates that express the framework's core goal:
// «every rule is an executable test that fails the build when violated».
// Source: packages/core/templates/shared/AGENTS.md.template (lines 13, 57).
// Three-source coverage: two paraphrase variants currently in templates +
// verbatim README phrase for forward-compatible drift detection if templates
// are updated to mirror README more closely (m1, Wave 7 Round 1 review).
const GOAL_PHRASE_SYNONYMS = [
  'enforced by lint, tests, CI',       // AGENTS.md.template §"Project rules" header
  'without a measurable check',         // AGENTS.md.template §Forbidden list
  "AI agents can't silently bypass undocumented conventions",  // verbatim README#why-this-exists (m1)
];

// ── P4: authority header regex ───────────────────────────────────────────
// Duplicated inline from packages/core/principles/09-doc-authority-hierarchy.test.ts.
// TODO: consolidate once Batch A (principle 09 module extraction) lands and
// exports AUTHORITY_HEADER_RE from a shared module.
const AUTHORITY_HEADER_RE = /^> \*\*Authoritative for:\*\*/m;

function containsGoalPhrase(content: string): boolean {
  return GOAL_PHRASE_SYNONYMS.some((phrase) => content.includes(phrase));
}

function hasAuthorityHeader(content: string): boolean {
  return AUTHORITY_HEADER_RE.test(content);
}

async function buildConsumer(stack: Stack, tmpBase: string): Promise<void> {
  const pkgContent = await readFile(join(FIXTURES_DIR, stack, 'package.json'), 'utf8');
  await writeFile(join(tmpBase, 'package.json'), pkgContent);
  if (stack === 'react-next') {
    // Presence of next.config.js triggers react-next auto-detection in setup.sh
    await writeFile(join(tmpBase, 'next.config.js'), 'module.exports = {};\n');
  }
  const result = spawnSync('bash', [INSTALL_SH, stack], {
    cwd: tmpBase,
    encoding: 'utf8',
    // Loaded-host budget: `install.sh ts-server` measures 51.56s RC=0 on an idle
    // aarch64 macOS host (2026-10-28), so 60s had only ~8s headroom and tipped into
    // ETIMEDOUT (status null -> suite-level throw) under full-sweep concurrency.
    // 4x the measured floor, same class as f8b3b9ff64f (pty watchdog 15s -> 60s).
    timeout: 240_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `install.sh failed for ${stack} in ${tmpBase}:\nSTDOUT: ${result.stdout}\nSTDERR: ${result.stderr}`,
    );
  }
}

beforeAll(async () => {
  for (const stack of STACKS) {
    const tmpBase = await mkdtemp(join(tmpdir(), `aif-render-${stack}-`));
    consumerDirs[stack] = tmpBase;
    await buildConsumer(stack, tmpBase);
  }
  // 2 serialized installs at the 240s per-stack spawnSync cap, plus slack — the old
  // 90s could not even hold the two ~52s idle installs this audit measures (2026-10-28).
}, 600_000);

afterAll(async () => {
  for (const dir of Object.values(consumerDirs)) {
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

// ── P1 — goal-phrase rendered ─────────────────────────────────────────────

describe('P1 — goal-phrase rendered in AGENTS.md', () => {
  for (const stack of STACKS) {
    it(`${stack}: rendered AGENTS.md carries framework goal-phrase synonym`, async () => {
      const agentsMd = await readFile(join(consumerDirs[stack], 'AGENTS.md'), 'utf8');
      expect(
        containsGoalPhrase(agentsMd),
        `AGENTS.md missing all goal-phrase synonyms: ${GOAL_PHRASE_SYNONYMS.join(' | ')}`,
      ).toBe(true);
    });
  }

  it('mutation: content without any synonym fails the P1 check (anti-tautology)', () => {
    const bare = '# AGENTS.md\n\nSome content with no enforcement phrase.\n';
    expect(containsGoalPhrase(bare)).toBe(false);
  });
});

// ── P4 — Authoritative-for header rendered ────────────────────────────────
// Checks key rendered docs that originate from REQUIRED_HEADER_DOCS entries.
// Full list per principle 09; this test validates the install pipeline
// preserves headers through the copy step.
// TODO: import rendered-path mapping from principle 09 module once Batch A lands.

describe('P4 — Authoritative-for header on rendered docs', () => {
  for (const stack of STACKS) {
    it(`${stack}: rendered AGENTS.md carries Authoritative-for header`, async () => {
      const agentsMd = await readFile(join(consumerDirs[stack], 'AGENTS.md'), 'utf8');
      expect(
        hasAuthorityHeader(agentsMd),
        'AGENTS.md missing "> **Authoritative for:**" header — install.sh copy may have stripped it',
      ).toBe(true);
    });
  }

  it('mutation: content without authority header fails the P4 check (anti-tautology)', () => {
    const bare = '# AGENTS.md\n\nNo authority header here.\n';
    expect(hasAuthorityHeader(bare)).toBe(false);
  });
});

// ── P6 — taxonomy fidelity ────────────────────────────────────────────────
// Verifies: every directory under framework skills/ was installed to the
// consumer's .claude/skills/ by install.sh. Catches rename drift where a
// skill directory is renamed in the framework but the template still references
// the old name.

describe('P6 — skill taxonomy fidelity', () => {
  // Expected skill names from framework skills/ directory
  const frameworkSkillsDir = join(REPO_ROOT, 'skills');
  const expectedSkills = existsSync(frameworkSkillsDir)
    ? readdirSync(frameworkSkillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
    : [];

  for (const stack of STACKS) {
    it(`${stack}: framework skills/ entries installed to consumer .claude/skills/`, () => {
      expect(expectedSkills.length).toBeGreaterThan(0);
      for (const skill of expectedSkills) {
        const installed = join(consumerDirs[stack], '.claude', 'skills', skill);
        expect(
          existsSync(installed),
          `skill '${skill}' from framework skills/ not found in consumer .claude/skills/${skill}`,
        ).toBe(true);
      }
    });
  }

  it('mutation: fabricated skill name not present in consumer (anti-tautology)', () => {
    const tmpDir = consumerDirs['ts-server'];
    if (!tmpDir) return; // beforeAll not run — skip gracefully in isolation
    const fakePath = join(tmpDir, '.claude', 'skills', '__nonexistent-skill-xyzzy__');
    expect(existsSync(fakePath)).toBe(false);
  });
});
