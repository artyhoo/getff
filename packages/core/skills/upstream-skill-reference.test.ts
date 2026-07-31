// Upstream skill-reference smoke — honest scope (W5)
//
// Origin: arch-v2-context-pipeline S-A, W5. The skill-author surface had three
//   wrapper drifts (W4 a/b/c) where our `.claude/skills/<name>/SKILL.md` files
//   made claims about upstream internals (version pins, line-number citations,
//   roster shapes). This smoke covers only what a by-name existence check CAN
//   cover: every `superpowers:<name>` reference resolves to an installed upstream
//   skill directory. The W4 drifts themselves are NOT covered here — see the
//   explicit non-coverage note below.
//
// ── What this smoke ASSERTS ──
// Every `superpowers:<name>` reference appearing in any tracked
// `.claude/skills/<name>/SKILL.md` resolves to a directory under at least one
// installed upstream `superpowers/<ver>/skills/` root.
//
// ── What this smoke must NOT claim (comment per W5 spec) ──
// This smoke does NOT cover the three W4 wrapper-drifts:
//   (a) a negative-existence claim («verified absent from upstream») — a by-name
//       existence check cannot evaluate negative-existence semantics;
//   (b) a roster shape («two fresh reviewer subagents: spec-reviewer + code-
//       quality-reviewer») — a by-name check confirms the upstream skill exists,
//       not that our description of its internals is accurate;
//   (c) a line-number citation («SDD lines 114-120») — a by-name check has no
//       opinion about line numbers inside the upstream file.
// Selling this smoke as the mechanism that catches (a)/(b)/(c) is
// `#discipline-theatre` (ai-laziness-traps.md §2 T2).
//
// ── Environment handling (load-bearing) ──
// Upstream lives under the operator's `~/.claude/plugins/**`, which does NOT
// exist on a CI runner or in the aif container (verified 2026-07-31). A
// silently-skipping load-bearing check is `#warning-nobody-reads`. Therefore:
//   - discover upstream roots by glob (NEVER hard-code a version directory —
//     that would be the version pin W4 removes);
//   - when at least one root is found, every reference must resolve or the test
//     FAILS;
//   - when no root is found, the test emits an explicit SKIPPED line and passes.
//
// Meaningful in: an environment with the upstream plugins installed (operator
// host; some containers with cached plugins). CI runners without plugins →
// SKIPPED.
//
// ── Paired-negative (T2) ──
// The `checkReferences` pure function is exercised against synthetic temp-dir
// upstreams so the RED (broken reference) and GREEN (resolved reference) paths
// are both reproducible without a real upstream install. The empty-roots case
// exercises the SKIPPED path. The integration test below these is the one that
// is only meaningful with a real upstream.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

// ── Pure helpers (exported for paired-negative reuse) ──

export interface Ref {
  // The bare skill name (no `superpowers:` prefix).
  name: string;
  // Repo-relative POSIX source path.
  source: string;
}

export type CheckStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface CheckResult {
  status: CheckStatus;
  message: string;
  failures?: string[];
  skippedReason?: string;
}

// Check that every reference resolves to a directory under at least one upstream
// root. Pure: takes the reference list and the list of upstream roots (each root
// is a directory whose direct children are skill directories). Empty roots →
// SKIPPED (with the searched globs in the message).
export function checkReferences(refs: readonly Ref[], upstreamRoots: readonly string[]): CheckResult {
  if (upstreamRoots.length === 0) {
    return {
      status: 'SKIPPED',
      message: 'SKIPPED — no upstream install discovered',
      skippedReason: 'no upstream roots were supplied',
    };
  }
  const available = new Set<string>();
  for (const root of upstreamRoots) {
    try {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (entry.isDirectory()) available.add(entry.name);
      }
    } catch {
      // unreadable root — skip silently; the empty-set case is covered by the
      // roots-length-zero branch above when ALL roots are unreadable
    }
  }
  const failures: string[] = [];
  for (const ref of refs) {
    if (!available.has(ref.name)) {
      failures.push(`${ref.source}: superpowers:${ref.name} — not found in any installed upstream`);
    }
  }
  if (failures.length > 0) {
    return {
      status: 'FAIL',
      message: `${failures.length} unresolved superpowers: reference(s)`,
      failures,
    };
  }
  return { status: 'PASS', message: `${refs.length} superpowers: reference(s) resolved` };
}

// ── Real-environment discovery ──

// Discover upstream skill roots by glob — NEVER hard-code a version directory.
// Returns all `<ver>/skills/` directories under the operator's superpowers
// cache. Empty array when the cache is absent (CI runner, container without
// plugins).
function discoverUpstreamRoots(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) return [];
  const base = join(home, '.claude', 'plugins', 'cache', 'superpowers-dev', 'superpowers');
  if (!existsSync(base)) return [];
  const roots: string[] = [];
  try {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillsDir = join(base, entry.name, 'skills');
      if (existsSync(skillsDir)) roots.push(skillsDir);
    }
  } catch {
    return [];
  }
  return roots;
}

// Extract every `superpowers:<name>` reference from a markdown blob.
// Returns the bare skill names (no prefix), de-duplicated per file.
export function extractReferences(markdown: string, source: string): Ref[] {
  const refs: Ref[] = [];
  const seen = new Set<string>();
  const re = /\bsuperpowers:([a-z][a-z0-9-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      refs.push({ name: m[1], source });
    }
  }
  return refs;
}

// Tracked SKILL.md paths under `.claude/skills/`, or null if git is unavailable.
// Git aware so the audit matches the tracked surface (parallel to principle 15
// `trackedSkillMds`).
function trackedSkillMds(): Set<string> | null {
  try {
    const out = execFileSync('git', ['-C', REPO_ROOT, 'ls-files', '--', '.claude/skills'], {
      encoding: 'utf8',
    });
    return new Set(out.split('\n').filter((l) => l.endsWith('/SKILL.md')));
  } catch {
    return null;
  }
}

// Enumerate tracked `.claude/skills/<name>/SKILL.md` paths.
function enumerateSkills(): string[] {
  const root = resolve(REPO_ROOT, '.claude/skills');
  if (!existsSync(root)) return [];
  const tracked = trackedSkillMds();
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const rel = `.claude/skills/${entry.name}/SKILL.md`;
    if (!existsSync(resolve(REPO_ROOT, rel))) continue;
    if (tracked && !tracked.has(rel)) continue;
    found.push(rel);
  }
  return found;
}

// ── Tests ──

describe('Upstream skill-reference smoke — pure function (paired-negative)', () => {
  // Synthetic upstream temp dirs so the RED and GREEN paths reproduce without a
  // real upstream install.

  let upstreamA: string;
  let upstreamB: string;
  let emptyDir: string;

  beforeEach(() => {
    upstreamA = mkdtempSync(join(tmpdir(), 'usref-a-'));
    upstreamB = mkdtempSync(join(tmpdir(), 'usref-b-'));
    emptyDir = mkdtempSync(join(tmpdir(), 'usref-empty-'));
    // populate: A has brainstorming + writing-skills; B has subagent-driven-development
    mkdirSync(join(upstreamA, 'brainstorming'));
    mkdirSync(join(upstreamA, 'writing-skills'));
    mkdirSync(join(upstreamB, 'subagent-driven-development'));
  });

  afterEach(() => {
    for (const d of [upstreamA, upstreamB, emptyDir]) {
      try {
        rmSync(d, { recursive: true, force: true });
      } catch {
        /* best-effort cleanup */
      }
    }
  });

  it('GREEN: every reference resolves against the union of upstream roots', () => {
    const refs: Ref[] = [
      { name: 'brainstorming', source: '.claude/skills/arch/SKILL.md' },
      { name: 'writing-skills', source: '.claude/skills/ai-doc/SKILL.md' },
      { name: 'subagent-driven-development', source: '.claude/skills/night-mode/SKILL.md' },
    ];
    const res = checkReferences(refs, [upstreamA, upstreamB]);
    expect(res.status).toBe('PASS');
  });

  it('RED: a broken reference fails when an upstream IS present', () => {
    const refs: Ref[] = [
      { name: 'brainstorming', source: 'demo/SKILL.md' },
      { name: 'does-not-exist', source: 'demo/SKILL.md' },
    ];
    const res = checkReferences(refs, [upstreamA]);
    expect(res.status).toBe('FAIL');
    expect(res.failures?.length).toBe(1);
    expect(res.failures?.[0]).toMatch(/does-not-exist/);
  });

  it('SKIPPED: empty roots array passes with an explicit SKIPPED message', () => {
    const refs: Ref[] = [
      { name: 'brainstorming', source: 'demo/SKILL.md' },
    ];
    const res = checkReferences(refs, []);
    expect(res.status).toBe('SKIPPED');
    expect(res.message).toMatch(/SKIPPED/);
  });

  it('empty upstream dir (no skill subdirs) yields FAIL not SKIPPED', () => {
    // An upstream root that exists but has zero skill subdirectories is treated
    // as a real (and broken) upstream, not a skip: the roots array was non-empty,
    // so the check ran, and every ref failed to resolve.
    const refs: Ref[] = [{ name: 'brainstorming', source: 'demo/SKILL.md' }];
    const res = checkReferences(refs, [emptyDir]);
    expect(res.status).toBe('FAIL');
  });

  it('extractReferences: pulls every superpowers token, de-duplicated', () => {
    const md = [
      '# Demo',
      '',
      'Wraps `superpowers:brainstorming`. Also see superpowers:brainstorming again.',
      'And superpowers:writing-skills for authoring.',
      '',
    ].join('\n');
    const refs = extractReferences(md, 'demo/SKILL.md');
    expect(refs.map((r) => r.name).sort()).toEqual(['brainstorming', 'writing-skills']);
  });
});

describe('Upstream skill-reference smoke — integration (real upstream required)', () => {
  it('every tracked skill ref resolves, OR SKIPPED', () => {
    const skills = enumerateSkills();
    expect(skills.length, 'expected to find in-repo SKILL.md files').toBeGreaterThan(0);
    const refs: Ref[] = [];
    for (const rel of skills) {
      const md = readFileSync(resolve(REPO_ROOT, rel), 'utf8');
      refs.push(...extractReferences(md, rel));
    }
    expect(refs.length, 'expected at least one superpowers: reference').toBeGreaterThan(0);

    const roots = discoverUpstreamRoots();
    const res = checkReferences(refs, roots);

    const envNote =
      roots.length === 0
        ? `SKIPPED — no upstream install discovered (HOME=${process.env.HOME ?? '<unset>'})`
        : `checked against ${roots.length} upstream root(s): ${roots.join(', ')}`;

    if (res.status === 'SKIPPED') {
      // eslint-disable-next-line no-console
      console.log(`[upstream-skill-reference] ${envNote}`);
      expect(res.status).toBe('SKIPPED');
    } else {
      expect(res.failures ?? [], `Violations:\n${(res.failures ?? []).join('\n')}\n(${envNote})`).toHaveLength(0);
    }
  });
});
