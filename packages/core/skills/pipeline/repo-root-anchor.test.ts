/**
 * /pipeline helpers — REPO_ROOT is anchored to the checkout the skill is installed in
 * (helpers/lib/common.sh), not to whatever repo the session's cwd has wandered into.
 *
 * The helpers run as `bash ${CLAUDE_SKILL_DIR}/helpers/<x>.sh`, an absolute path, so they
 * are reachable from ANY cwd. Before the anchor, a framework session whose Bash cwd sat in a
 * scratch consumer repo resolved REPO_ROOT to that repo and wrote the plan cache, the
 * backlog delta and `.ai-factory/orchestrator-prompts/` there — the wrong-target class of
 * getff#1967 (backward sweep, 2026-09-30).
 *
 * In a consumer install the skill sits in the consumer's own `.claude/skills/pipeline/`,
 * so the anchor still serves the consumer's repo; only a skill living OUTSIDE any checkout
 * (user-level or plugin copy) keeps the old cwd-derived resolution.
 *
 *   (r1) FOREIGN CWD: the write lands in the skill's own checkout, the foreign repo is untouched
 *   (r2) OWN CHECKOUT subdir as cwd: resolves to the checkout root (unchanged behaviour)
 *   (r3) framework layout (.claude/orchestrator-prompts present): the dogfood home is used
 *   (r4) an explicit REPO_ROOT still wins (the test seam every helper test relies on)
 *   (r5) skill outside any checkout: falls back to the cwd toplevel (unchanged behaviour)
 *   (r-neg) PAIRED-NEGATIVE: with the anchor stripped, the foreign repo IS written (the gap)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../..');
const HELPERS = resolve(REPO, '.claude/skills/pipeline/helpers');
const COMMON = resolve(HELPERS, 'lib/common.sh');

function initRepo(prefix: string): string {
  const dir = realpathSync(mkdtempSync(resolve(tmpdir(), prefix)));
  execSync('git init -q -b main && git config user.email t@e.x && git config user.name t', { cwd: dir });
  writeFileSync(resolve(dir, 'README.md'), `${prefix}\n`);
  execSync('git add -A && git commit -q -m init', { cwd: dir });
  return dir;
}

/** Copy the helpers into `<root>/.claude/skills/pipeline/helpers` — the installed shape. */
function installHelpers(root: string, common?: string): string {
  const dst = resolve(root, '.claude/skills/pipeline/helpers');
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(HELPERS, dst, { recursive: true });
  if (common !== undefined) writeFileSync(resolve(dst, 'lib/common.sh'), common);
  return dst;
}

function run(script: string, args: string[], cwd: string, extra: Record<string, string> = {}): { status: number; stdout: string; stderr: string } {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith('GIT_') || k.startsWith('MO_') || k === 'REPO_ROOT') continue;
    env[k] = v;
  }
  Object.assign(env, { MO_TIMESTAMP: '2026-09-30T00:00:00Z', MO_GIT_HEAD: 'abc1234' }, extra);
  const r = spawnSync('bash', [script, ...args], { cwd, env, encoding: 'utf8' });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

const cacheIn = (root: string, home = '.ai-factory/orchestrator-prompts'): string => resolve(root, home, '_plan-cache.md');

describe('/pipeline helpers — REPO_ROOT anchored to the skill checkout', () => {
  let own: string;
  let foreign: string;
  const extra: string[] = [];

  beforeEach(() => {
    own = initRepo('pipe-own-');
    foreign = initRepo('pipe-foreign-');
  });

  afterEach(() => {
    for (const d of [own, foreign, ...extra.splice(0)]) rmSync(d, { recursive: true, force: true });
  });

  it('(r1) FOREIGN CWD: update-cache writes into the skill checkout, never the foreign repo', () => {
    const helpers = installHelpers(own);
    const r = run(resolve(helpers, 'update-cache.sh'), ['u1', 'outcome'], foreign);
    expect(r.status, `stderr: ${r.stderr}`).toBe(0);
    expect(existsSync(resolve(foreign, '.ai-factory')), 'the foreign repo must stay untouched').toBe(false);
    expect(readFileSync(cacheIn(own), 'utf8')).toContain('- Umbrella: u1');
  });

  it('(r2) OWN CHECKOUT subdir as cwd: resolves to the checkout root', () => {
    const helpers = installHelpers(own);
    const sub = resolve(own, 'packages/app');
    mkdirSync(sub, { recursive: true });
    const r = run(resolve(helpers, 'print-orch-home.sh'), [], sub);
    expect(r.stdout.trim()).toBe(resolve(own, '.ai-factory/orchestrator-prompts'));
  });

  it('(r3) framework layout: the dogfood home is used even from a foreign cwd', () => {
    const helpers = installHelpers(own);
    mkdirSync(resolve(own, '.claude/orchestrator-prompts'), { recursive: true });
    const r = run(resolve(helpers, 'print-orch-home.sh'), [], foreign);
    expect(r.stdout.trim()).toBe(resolve(own, '.claude/orchestrator-prompts'));
  });

  it('(r4) an explicit REPO_ROOT still wins', () => {
    const helpers = installHelpers(own);
    const r = run(resolve(helpers, 'print-orch-home.sh'), [], own, { REPO_ROOT: foreign });
    expect(r.stdout.trim()).toBe(resolve(foreign, '.ai-factory/orchestrator-prompts'));
  });

  it('(r5) skill outside any checkout: falls back to the cwd toplevel', () => {
    const loose = realpathSync(mkdtempSync(resolve(tmpdir(), 'pipe-loose-')));
    extra.push(loose);
    const helpers = installHelpers(loose);
    const r = run(resolve(helpers, 'print-orch-home.sh'), [], foreign);
    expect(r.stdout.trim()).toBe(resolve(foreign, '.ai-factory/orchestrator-prompts'));
  });

  it('(r-neg) PAIRED-NEGATIVE: with the anchor stripped, the foreign repo IS written', () => {
    const src = readFileSync(COMMON, 'utf8');
    const stripped = src.replace(/# ── SKILL-CHECKOUT ANCHOR[\s\S]*?# ── END SKILL-CHECKOUT ANCHOR[^\n]*\n/, '');
    expect(stripped, 'the SKILL-CHECKOUT ANCHOR block must be present to strip').not.toBe(src);
    const helpers = installHelpers(own, stripped);
    run(resolve(helpers, 'update-cache.sh'), ['u1', 'outcome'], foreign);
    expect(existsSync(cacheIn(foreign)), 'without the anchor the cache lands in the foreign repo').toBe(true);
  });
});
