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
//     that would be the version pin W4 removes — nor the marketplace directory);
//   - when at least one root is found, every reference must resolve or the test
//     FAILS;
//   - when an install BASE is present but yields zero usable roots, or any
//     probe fails with anything other than ENOENT, the test FAILS loudly
//     (BROKEN) — a corrupted, relocated, or permission-denied install must
//     never read as «not installed». This is why discovery probes with
//     `statSync` rather than `existsSync`: `existsSync` returns false for BOTH
//     «absent» and «EACCES», which is precisely the conflation being fixed;
//   - only when NO install base exists at all does the test emit an explicit
//     SKIPPED line (naming the globs searched) and pass.
//
// ── Known limit of «installed», stated rather than implied ──
// Discovery unions EVERY cached `<ver>/skills/` directory. The plugin manager
// may keep versions in the cache after retiring them (on the author's host,
// 2026-07-31: `superpowers/{5.1.0,6.1.1}` both carry a `.orphaned_at` marker
// while `installed_plugins.json` lists only 6.2.0). Discovery does not read
// that manifest, so a reference that resolves ONLY via an orphaned version
// still passes. The check is therefore «resolves in some cached upstream»,
// which is weaker than «resolves in the active install» — deliberately not
// tightened here (it is a new work item, not a defect of this round). Falsifier
// for the weaker claim: upstream deletes a skill in the active version, our
// reference keeps resolving through an orphaned one, and this test stays green.
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
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdtempSync, mkdirSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

// ── Pure helpers (exported for paired-negative reuse) ──

/** errno code if the throw carries one, else the stringified error. */
function errCode(err: unknown): string {
  return (err as NodeJS.ErrnoException | null)?.code ?? String(err);
}

/**
 * errno codes that mean «we were DENIED the answer», as opposed to «the answer
 * is no». Only these can conceal a real install, so only these are loud.
 * ENOENT / ENOTDIR / ELOOP are definitive negatives: nothing is there, the
 * entry is a plain file, or the link cannot resolve — none of which can be
 * hiding an install directory.
 */
const CONCEALING_CODES = new Set(['EACCES', 'EPERM']);

/**
 * Probe a path for «is this a readable directory?», keeping THREE answers
 * distinct — yes, a definitive no, and «cannot tell».
 *
 * `existsSync` collapses the last two: it returns `false` for both «no such
 * path» and «EACCES on the parent», so a permission-denied install is
 * indistinguishable from an absent one — the exact conflation this file exists
 * to end. `statSync` additionally FOLLOWS symlinks, where
 * `Dirent.isDirectory()` reports false for a symlinked directory and would hide
 * a healthy install behind a symlinked marketplace, version, or skills dir.
 *
 * `error` is set ONLY for the cannot-tell case. A stray `.DS_Store` in the
 * plugins cache is a definitive no, not an alarm — treating it as one turned
 * «nothing installed» into a loud BROKEN on any Mac whose Finder had visited
 * the folder.
 */
function probeDir(path: string): { isDir: boolean; error?: string } {
  try {
    return { isDir: statSync(path).isDirectory() };
  } catch (err) {
    const code = errCode(err);
    if (CONCEALING_CODES.has(code)) return { isDir: false, error: `${path}: ${code}` };
    return { isDir: false };
  }
}

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
// SKIPPED; the caller supplies the searched-globs context when printing (the
// pure function cannot know where discovery looked).
export function checkReferences(refs: readonly Ref[], upstreamRoots: readonly string[]): CheckResult {
  if (upstreamRoots.length === 0) {
    return {
      status: 'SKIPPED',
      message: 'SKIPPED — no upstream install discovered',
      skippedReason: 'no upstream roots were supplied',
    };
  }
  const available = new Set<string>();
  const failures: string[] = [];
  for (const root of upstreamRoots) {
    try {
      for (const entry of readdirSync(root, { withFileTypes: true })) {
        // statSync follows symlinks; Dirent.isDirectory() is false for a
        // symlinked skill directory, which would silently hide a real skill.
        const probe = probeDir(join(root, entry.name));
        if (probe.isDir) available.add(entry.name);
        // A root that lists but whose children cannot be stat'ed (mode 0444 —
        // readable, not traversable) would otherwise blame the reference for a
        // permission problem, with the skill sitting right there.
        else if (probe.error) failures.push(`${probe.error} — skill directory unreadable; references cannot be resolved through it`);
      }
    } catch (err) {
      // An unreadable root is reported, never swallowed: without this the
      // reference failures below would blame the references for a defect that
      // is really a permission/IO problem on our side.
      failures.push(`${root} — upstream root unreadable (${errCode(err)}); references cannot be verified against it`);
    }
  }
  for (const ref of refs) {
    if (!available.has(ref.name)) {
      failures.push(`${ref.source}: superpowers:${ref.name} — not found in any readable installed upstream`);
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

export interface UpstreamDiscovery {
  // `<ver>/skills/` directories, one per installed version, across ALL
  // marketplace directories (the marketplace segment is a real variable — the
  // operator host carries more than one — so it is globbed, never frozen).
  roots: string[];
  // Glob-shaped description of where discovery looked, for the SKIPPED line —
  // the one field that DOES distinguish «not installed» from «looked in the
  // wrong place».
  searchedGlob: string;
  // True when at least one `<marketplace>/superpowers/` base directory exists:
  // an install is PRESENT even if it yields no usable skills root. Present +
  // zero roots must NEVER read as «not installed».
  baseFound: boolean;
  // readdir failures (permission errors etc.) — surfaced to the caller as
  // failures, never swallowed into an empty array.
  errors: string[];
}

// Discover upstream skill roots by glob — NEVER hard-code a version directory
// (that would be the version pin W4 removes) NOR the marketplace directory
// (a differently-sourced install would be permanently, silently skipped).
export function discoverUpstreamRoots(homeOverride?: string): UpstreamDiscovery {
  const home = homeOverride ?? (process.env.HOME || process.env.USERPROFILE || '');
  const searchedGlob = join(home || '<HOME unset>', '.claude', 'plugins', 'cache', '*', 'superpowers', '*', 'skills');
  const out: UpstreamDiscovery = { roots: [], searchedGlob, baseFound: false, errors: [] };
  if (!home) {
    // «We could not work out where to look» is not «nothing is installed» —
    // the same conflation as the permission case, one level further out.
    out.errors.push('neither HOME nor USERPROFILE is set — cannot locate the plugins cache');
    return out;
  }
  const cacheDir = join(home, '.claude', 'plugins', 'cache');
  const cacheProbe = probeDir(cacheDir);
  if (cacheProbe.error) {
    out.errors.push(cacheProbe.error);
    return out;
  }
  if (!cacheProbe.isDir) return out;
  let marketplaces: string[];
  try {
    marketplaces = readdirSync(cacheDir);
  } catch (err) {
    out.errors.push(`${cacheDir}: ${errCode(err)}`);
    return out;
  }
  for (const marketplace of marketplaces) {
    // Probe the ENTRY first. Descending straight to `<entry>/superpowers`
    // reports ENOTDIR for any stray file in the cache — and a single
    // `.DS_Store` (one Finder visit) would then turn «nothing installed» into
    // a loud BROKEN. A non-directory entry simply cannot hold an install.
    const marketProbe = probeDir(join(cacheDir, marketplace));
    if (marketProbe.error) {
      out.errors.push(marketProbe.error);
      continue;
    }
    if (!marketProbe.isDir) continue;
    const base = join(cacheDir, marketplace, 'superpowers');
    const baseProbe = probeDir(base);
    if (baseProbe.error) {
      // A marketplace directory we cannot read may well HOLD an install. Record
      // it so the caller fails loudly instead of reporting «not installed».
      out.errors.push(baseProbe.error);
      continue;
    }
    if (!baseProbe.isDir) continue;
    out.baseFound = true;
    let versions: string[];
    try {
      versions = readdirSync(base);
    } catch (err) {
      out.errors.push(`${base}: ${errCode(err)}`);
      continue;
    }
    for (const version of versions) {
      const versionProbe = probeDir(join(base, version));
      if (versionProbe.error) {
        out.errors.push(versionProbe.error);
        continue;
      }
      if (!versionProbe.isDir) continue;
      const skillsDir = join(base, version, 'skills');
      const skillsProbe = probeDir(skillsDir);
      if (skillsProbe.error) {
        out.errors.push(skillsProbe.error);
        continue;
      }
      if (skillsProbe.isDir) out.roots.push(skillsDir);
    }
  }
  return out;
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

  // A bare `return` here would report a green tick for a test that asserted
  // nothing — `#warning-nobody-reads` in miniature. skipIf reports a skip.
  it.skipIf(typeof process.getuid === 'function' && process.getuid() === 0)('unreadable root is reported as its own failure, not blamed on the references', () => {
    chmodSync(emptyDir, 0o000);
    try {
      const refs: Ref[] = [{ name: 'brainstorming', source: 'demo/SKILL.md' }];
      const res = checkReferences(refs, [upstreamA, emptyDir]);
      expect(res.status).toBe('FAIL');
      // The point: the message names the unreadable ROOT. Before this, the
      // throw was swallowed and the only signal was a reference failure that
      // blamed the reference for an IO problem.
      expect(res.failures?.join('\n')).toMatch(/upstream root unreadable/);
    } finally {
      chmodSync(emptyDir, 0o755);
    }
  });

  it('symlinked skill dir under a root still resolves', () => {
    const target = mkdtempSync(join(tmpdir(), 'usref-skill-'));
    try {
      symlinkSync(target, join(upstreamB, 'writing-skills'), 'dir');
      const refs: Ref[] = [{ name: 'writing-skills', source: 'demo/SKILL.md' }];
      expect(checkReferences(refs, [upstreamB]).status).toBe('PASS');
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
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

describe('discoverUpstreamRoots — synthetic HOME (broken-install regression)', () => {
  let fakeHome: string;

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'usref-home-'));
  });

  afterEach(() => {
    try {
      rmSync(fakeHome, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  });

  it('no plugins cache at all → not installed (baseFound=false, no roots, no errors)', () => {
    const disc = discoverUpstreamRoots(fakeHome);
    expect(disc.baseFound).toBe(false);
    expect(disc.roots).toHaveLength(0);
    expect(disc.errors).toHaveLength(0);
    expect(disc.searchedGlob).toContain(join('cache', '*', 'superpowers', '*', 'skills'));
  });

  it('install base present but version dir has no skills/ child → baseFound=true, zero roots (the M2 probe-(a) shape)', () => {
    // This is the broken-install shape the integration test must report as
    // BROKEN, byte-distinguishable from «not installed».
    mkdirSync(join(fakeHome, '.claude', 'plugins', 'cache', 'some-market', 'superpowers', '9.9.9'), { recursive: true });
    const disc = discoverUpstreamRoots(fakeHome);
    expect(disc.baseFound).toBe(true);
    expect(disc.roots).toHaveLength(0);
  });

  // chmod-based probes are meaningless as root (root bypasses mode bits) — the
  // container runs as root, the operator host does not.
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;

  it.skipIf(asRoot)('marketplace dir unreadable (EACCES) → recorded as an error, NOT read as «not installed»', () => {
    // The B1 shape: a HEALTHY install sitting behind a directory we cannot
    // read. `existsSync` reported false here, so this passed as SKIPPED.
    const mkt = join(fakeHome, '.claude', 'plugins', 'cache', 'mkt');
    mkdirSync(join(mkt, 'superpowers', '6.2.0', 'skills', 'brainstorming'), { recursive: true });
    chmodSync(mkt, 0o000);
    try {
      const disc = discoverUpstreamRoots(fakeHome);
      expect(disc.errors.length, 'an unreadable marketplace dir must be surfaced').toBeGreaterThan(0);
      expect(disc.errors.join(' ')).toMatch(/EACCES|EPERM/);
    } finally {
      chmodSync(mkt, 0o755);
    }
  });

  // One case per level, because a symlink at the MARKETPLACE level resolves
  // through ordinary path resolution and so cannot detect a regression in the
  // follow-semantics at the version or skills level. A single combined fixture
  // stayed green under a faithful `lstatSync` mutation applied to exactly those
  // two probes — i.e. it did not test what its name claimed.
  it.each([
    ['marketplace', (cache: string, real: string) => {
      mkdirSync(join(real, 'superpowers', '6.2.0', 'skills', 'brainstorming'), { recursive: true });
      symlinkSync(real, join(cache, 'mkt'), 'dir');
    }],
    ['version', (cache: string, real: string) => {
      mkdirSync(join(real, 'skills', 'brainstorming'), { recursive: true });
      mkdirSync(join(cache, 'mkt', 'superpowers'), { recursive: true });
      symlinkSync(real, join(cache, 'mkt', 'superpowers', '6.2.0'), 'dir');
    }],
    ['skills', (cache: string, real: string) => {
      mkdirSync(join(real, 'brainstorming'), { recursive: true });
      mkdirSync(join(cache, 'mkt', 'superpowers', '6.2.0'), { recursive: true });
      symlinkSync(real, join(cache, 'mkt', 'superpowers', '6.2.0', 'skills'), 'dir');
    }],
  ])('symlinked %s dir → still discovered (Dirent.isDirectory would miss it)', (_level, build) => {
    const real = mkdtempSync(join(tmpdir(), 'usref-real-'));
    try {
      const cache = join(fakeHome, '.claude', 'plugins', 'cache');
      mkdirSync(cache, { recursive: true });
      build(cache, real);
      const disc = discoverUpstreamRoots(fakeHome);
      expect(disc.baseFound).toBe(true);
      expect(disc.roots).toHaveLength(1);
      expect(disc.errors).toHaveLength(0);
      // Resolve through it too, so the root is proven usable and not merely listed.
      expect(checkReferences([{ name: 'brainstorming', source: 'demo/SKILL.md' }], disc.roots).status).toBe('PASS');
    } finally {
      rmSync(real, { recursive: true, force: true });
    }
  });

  it('a stray FILE in the plugins cache is a definitive «no», not an alarm', () => {
    // One Finder visit leaves a .DS_Store here. Descending straight to
    // `<entry>/superpowers` reported ENOTDIR and turned «nothing installed»
    // into a loud BROKEN.
    const cache = join(fakeHome, '.claude', 'plugins', 'cache');
    mkdirSync(cache, { recursive: true });
    writeFileSync(join(cache, '.DS_Store'), 'x');
    const disc = discoverUpstreamRoots(fakeHome);
    expect(disc.errors, 'a plain file cannot conceal an install — it must not be reported').toHaveLength(0);
    expect(disc.baseFound).toBe(false);
    expect(disc.roots).toHaveLength(0);
  });

  it('a stray file alongside a healthy install does not mask it', () => {
    const cache = join(fakeHome, '.claude', 'plugins', 'cache');
    mkdirSync(join(cache, 'mkt', 'superpowers', '6.2.0', 'skills', 'brainstorming'), { recursive: true });
    writeFileSync(join(cache, '.DS_Store'), 'x');
    const disc = discoverUpstreamRoots(fakeHome);
    expect(disc.errors).toHaveLength(0);
    expect(disc.roots).toHaveLength(1);
  });

  it('unset HOME is «cannot look», not «not installed»', () => {
    const disc = discoverUpstreamRoots('');
    expect(disc.errors.join(' ')).toMatch(/cannot locate the plugins cache/);
  });

  it('healthy install → roots discovered across a non-frozen marketplace segment', () => {
    // Two DIFFERENT marketplace directory names — proves the marketplace
    // segment is globbed, not frozen to `superpowers-dev`.
    mkdirSync(join(fakeHome, '.claude', 'plugins', 'cache', 'market-a', 'superpowers', '1.0.0', 'skills'), { recursive: true });
    mkdirSync(join(fakeHome, '.claude', 'plugins', 'cache', 'market-b', 'superpowers', '2.0.0', 'skills'), { recursive: true });
    const disc = discoverUpstreamRoots(fakeHome);
    expect(disc.baseFound).toBe(true);
    expect(disc.roots).toHaveLength(2);
    expect(disc.errors).toHaveLength(0);
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

    const disc = discoverUpstreamRoots();

    // BROKEN is a distinct, loud verdict — never the same signal as «absent».
    // Fires when an install base is present but yields zero usable roots
    // (corrupted / relocated install), or when any readdir failed (permission
    // error). A broken install must not silently pass as SKIPPED.
    expect(
      disc.errors,
      `BROKEN — upstream discovery hit readdir failure(s) (searched ${disc.searchedGlob})`,
    ).toHaveLength(0);
    if (disc.baseFound) {
      expect(
        disc.roots.length,
        `BROKEN — a superpowers install base exists but contains no <ver>/skills/ root (searched ${disc.searchedGlob}); a present-but-unshaped install must NOT read as «not installed»`,
      ).toBeGreaterThan(0);
    }

    const res = checkReferences(refs, disc.roots);

    const envNote =
      disc.roots.length === 0
        ? `SKIPPED — no upstream install discovered at ${disc.searchedGlob}`
        : `checked against ${disc.roots.length} upstream root(s): ${disc.roots.join(', ')}`;

    if (res.status === 'SKIPPED') {
      // eslint-disable-next-line no-console
      console.log(`[upstream-skill-reference] ${envNote}`);
      // Assert the emitted line's shape: it must name the searched globs — the
      // information that lets an operator tell «not installed» from «looked in
      // the wrong place».
      expect(envNote).toMatch(/^SKIPPED — no upstream install discovered at .+[/\\]cache[/\\]\*[/\\]superpowers[/\\]\*[/\\]skills$/);
    } else {
      expect(res.failures ?? [], `Violations:\n${(res.failures ?? []).join('\n')}\n(${envNote})`).toHaveLength(0);
    }
  });
});
