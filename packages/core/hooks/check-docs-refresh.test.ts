/**
 * Sandbox suite that EXECUTES scripts/check-docs-refresh.mjs — the R13 paired-negative
 * contract (getff-ai-site S1 BUILD). NOT pre-push.test.ts (R13: the seam is the script, not
 * the hook section; the hook section only resolves the range and delegates).
 *
 * Reference pattern: packages/core/hooks/check-doc-authority.test.ts:8,133
 * (vitest + spawnSync + mkdtempSync sandbox + delta-based tree-guard).
 *
 * The D26 refresh gate (docs/superpowers/specs/2026-09-13-getff-ai-site-design.md D26,
 * channel spec roll-out design R13): over an EXPLICIT caller-supplied range,
 * `changed files ∩ cited paths` per page frontmatter must be refreshed in the same range
 * or carry `docs-refresh: deferred — <reason ≥20 chars>`. Paired-negative contract:
 *   ✅ affected page changed in the same range            → exit 0, status 'refreshed'
 *   ❌ affected page untouched, no token                   → exit 1, remedy in the message
 *   ✅ affected page untouched + valid deferred token       → exit 0, status 'deferred'
 *   ❌ malformed token (reason < 20 chars)                  → exit 1, floor named
 *   ✅ same-range drift arm: same explicit range, twice     → identical verdicts
 *   ✅ empty point-range on the same tree                   → vacuously clean (changedCount 0)
 *     — the BU-5 hazard made observable: the RANGE ARGUMENT is what makes this gate mean
 *     anything, which is why caller 2 (audit-self.yml docs-refresh) MUST set fetch-depth: 0
 *     and resolve a real base..HEAD range; an implicit/empty range must never be how the
 *     gate goes green.
 *   ✅ a page with NO kind: still gets a verdict            → this gate NEVER re-checks kind:
 *     (ref-gen.md:201 — kind registration belongs to the reference generator's gate; the
 *     refresh gate reads only sources: and docs-refresh:).
 *   ✅ derived-only citation (face-facts.json / reference/<F>.json) → exempt (the derived-
 *     artifact scope-out, rework disposition 2026-09-21): counted in `exemptDerived` + listed
 *     in `exempt` — reported, never silent; freshness is owned by the renderer --check gates
 *   ❌ control: derived + hand-written mix → still FAILs (via = hand-written only; the
 *     derived paths ride on `exemptVia` — the scope-out cannot hide a real trip)
 *   ✅ docs-refresh-only page edit → bookkeeping, dropped from the changed set (listed in
 *     `tokenOnlyEdits`): seeding a deferral must not cascade a refresh obligation onto the
 *     pages citing it (patch-shaped carve-out, not path-shaped)
 *   ❌ control: token edit BUNDLED WITH a content change → citing page still FAILs (any
 *     non-token +/- line keeps the page fully in the gate — no smuggling)
 *   ❌ missing range argument                               → exit 2 usage, never a false clean
 *   ❌ --root that is not a git repo                        → exit 2 fatal, never a false clean
 *
 * Sandbox isolation: the script takes --root (its designed test seam), so the suite builds a
 * throwaway git repo in mkdtempSync and every spawn runs against it; the real checkout is
 * never written by the script under test. The final tree-guard test asserts exactly that
 * (delta-based `git status --porcelain` over the guarded real paths, advisory when git is
 * unavailable — same semantics as check-doc-authority.test.ts / the PR #844 hooks tree-guard).
 *
 * T3 compliance: each arm cites the script behavior it targets (function names in
 * scripts/check-docs-refresh.mjs). Plain node ESM script — zero deps, no tsx needed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/check-docs-refresh.mjs');

/** Real paths the tree-guard watches — the script must never write them from this suite. */
const GUARD_PATHSPECS = ['scripts/', 'docs/'] as const;

function snapshotGuardPaths(): string | null {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_COMMON_DIR;
  try {
    return execSync(
      `git --no-optional-locks status --porcelain=v1 -- ${GUARD_PATHSPECS.join(' ')}`,
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
  } catch {
    return null;
  }
}

const TREE_BEFORE = snapshotGuardPaths();

// ── sandbox repo ───────────────────────────────────────────────────────────────────────────────

const SANDBOX = realpathSync(
  mkdtempSync(join(tmpdir(), 'check-docs-refresh-')),
);

function git(args: string, cwd = SANDBOX): string {
  const r = spawnSync('bash', ['-c', `git ${args}`], { cwd, encoding: 'utf8' });
  if (r.status !== 0)
    throw new Error(
      `git ${args} failed (rc=${r.status}): ${(r.stderr || r.stdout).trim()}`,
    );
  return (r.stdout || '').trim();
}

function writePage(name: string, frontmatter: string[], body: string[]): void {
  writeFileSync(
    join(SANDBOX, 'docs/site', name),
    ['---', ...frontmatter, '---', '', ...body, ''].join('\n'),
  );
}

const VALID_TOKEN =
  'docs-refresh: deferred — reason at least twenty characters long';
const SHORT_TOKEN = 'docs-refresh: deferred — too short';
/** Built once so the base commit and the range commit share one textual page body. */
const REFRESHED_PAGE = [
  '---',
  'title: refreshed',
  'sources:',
  '  - src/data.json',
  '---',
  '',
  'body',
  '',
].join('\n');

beforeAll(() => {
  mkdirSync(join(SANDBOX, 'docs/site'), { recursive: true });
  mkdirSync(join(SANDBOX, 'src'), { recursive: true });
  writeFileSync(join(SANDBOX, 'src/data.json'), '{"v":1}\n');
  writeFileSync(join(SANDBOX, 'src/untouched.json'), '{"v":1}\n');
  // Every cited-path shape the gate must see: pages citing src/data.json in four token
  // states, one unaffected page, one kind-less page (kind: must be invisible here).
  writeFileSync(join(SANDBOX, 'docs/site/refreshed-page.md'), REFRESHED_PAGE);
  writePage(
    'deferred-page.md',
    ['title: deferred', 'sources:', '  - src/data.json', VALID_TOKEN],
    ['body'],
  );
  writePage(
    'short-token-page.md',
    ['title: short', 'sources:', '  - src/data.json', SHORT_TOKEN],
    ['body'],
  );
  writePage(
    'untouched-page.md',
    ['title: untouched', 'sources:', '  - src/data.json'],
    ['body'],
  );
  writePage(
    'plain-page.md',
    ['title: plain', 'sources:', '  - src/untouched.json'],
    ['body'],
  );
  writePage(
    'kindless-page.md',
    ['title: no kind here', 'sources:', '  - src/data.json'],
    ['body'],
  );
  // Derived artifacts (the scope-out arms): machine-regenerated outputs whose freshness is
  // owned by their renderer `--check` byte-identity gates, not by page refresh. Created at
  // base, moved in the range commit — a page citing ONLY these is exempt (reported, never
  // silent); the mixed-page control proves a hand-written source in the same list still gates.
  mkdirSync(join(SANDBOX, 'docs/site/reference'), { recursive: true });
  writeFileSync(join(SANDBOX, 'docs/site/face-facts.json'), '{"v":1}\n');
  writeFileSync(join(SANDBOX, 'docs/site/reference/B.json'), '{"v":1}\n');
  writePage(
    'derived-facts-page.md',
    ['title: derived facts', 'sources:', '  - docs/site/face-facts.json'],
    ['body'],
  );
  writePage(
    'derived-ref-page.md',
    ['title: derived ref', 'sources:', '  - docs/site/reference/B.json'],
    ['body'],
  );
  writePage(
    'mixed-page.md',
    [
      'title: mixed',
      'sources:',
      '  - src/data.json',
      '  - docs/site/face-facts.json',
    ],
    ['body'],
  );
  // Token-only-edit carve-out fixtures: cascade-page cites a page that will move ONLY by a
  // docs-refresh line (bookkeeping → no cascade); cascade2-page cites a page whose commit
  // also touches its title (substance → the citing page must still gate). Both cited pages
  // are created at base and edited in a third in-range commit below.
  writePage(
    'tokenonly-page.md',
    ['title: tokenonly', 'sources:', '  - src/untouched.json'],
    ['body'],
  );
  writePage(
    'mixededit-page.md',
    ['title: mixed edit', 'sources:', '  - src/untouched.json'],
    ['body'],
  );
  writePage(
    'cascade-page.md',
    ['title: cascade', 'sources:', '  - docs/site/tokenonly-page.md'],
    ['body'],
  );
  writePage(
    'cascade2-page.md',
    ['title: cascade two', 'sources:', '  - docs/site/mixededit-page.md'],
    ['body'],
  );
  git('init -q');
  git('config user.email test@example.com');
  git('config user.name test');
  git('add -A');
  git('commit -qm base');
  git('tag base-tag');
  // The range commit: the cited source moves, and ONLY the refreshed page moves with it.
  // Both derived artifacts move too (the structural-churn shape the scope-out exists for).
  writeFileSync(join(SANDBOX, 'src/data.json'), '{"v":2}\n');
  writeFileSync(join(SANDBOX, 'docs/site/face-facts.json'), '{"v":2}\n');
  writeFileSync(join(SANDBOX, 'docs/site/reference/B.json'), '{"v":2}\n');
  writeFileSync(
    join(SANDBOX, 'docs/site/refreshed-page.md'),
    `${REFRESHED_PAGE}refreshed in the same range.\n`,
  );
  git('add -A');
  git('commit -qm move-source');
  // The bookkeeping commit: one page gains ONLY a docs-refresh token line (the carve-out
  // arm); the other gains the token AND a title change (the substance control).
  writePage(
    'tokenonly-page.md',
    [
      'title: tokenonly',
      'sources:',
      '  - src/untouched.json',
      'docs-refresh: deferred — token only line for the carve-out arm',
    ],
    ['body'],
  );
  writePage(
    'mixededit-page.md',
    [
      'title: mixed edit changed',
      'sources:',
      '  - src/untouched.json',
      'docs-refresh: deferred — token only line for the carve-out arm',
    ],
    ['body'],
  );
  git('add -A');
  git('commit -qm seed-tokens');
});

afterAll(() => {
  rmSync(SANDBOX, { recursive: true, force: true });
});

// ── execution helper ───────────────────────────────────────────────────────────────────────────

interface Finding {
  file: string;
  via: string[];
  status: 'refreshed' | 'deferred' | 'fail';
  reason?: string;
  message?: string;
  /** Derived paths that also moved but were scoped out of the gating set (mixed pages). */
  exemptVia?: string[];
}

interface GateJson {
  tool: string;
  root: string;
  range: string;
  changedCount: number;
  tokenOnlyEdits: string[];
  pages: number;
  unaffected: number;
  exemptDerived: number;
  refreshed: number;
  deferred: number;
  failures: number;
  affected: Finding[];
  exempt: { file: string; via: string[] }[];
}

function runGate(
  range: string | null,
  root = SANDBOX,
): { rc: number; json: GateJson | null; stderr: string } {
  const args = [SCRIPT];
  if (range !== null) args.push(range);
  args.push('--root', root, '--json');
  const r = spawnSync('node', args, { cwd: SANDBOX, encoding: 'utf8' });
  return {
    rc: r.status ?? -1,
    json: r.stdout ? (JSON.parse(r.stdout) as GateJson) : null,
    stderr: r.stderr || '',
  };
}

function statusOf(json: GateJson, file: string): Finding | undefined {
  return json.affected.find((f) => f.file === `docs/site/${file}`);
}

// ── the paired-negative contract ───────────────────────────────────────────────────────────────

describe('check-docs-refresh.mjs (R13 gate, executed in a sandbox git repo)', () => {
  let gate: { rc: number; json: GateJson | null };

  beforeAll(() => {
    gate = runGate('base-tag..HEAD');
  });

  it('arm 1 ✅ affected page changed in the same range → refreshed (exit path clear)', () => {
    expect(gate.rc).toBe(1); // other arms in the same range DO fail — the per-page verdict is the assertion
    const f = statusOf(gate.json!, 'refreshed-page.md');
    expect(f?.status).toBe('refreshed');
    expect(f?.via).toEqual(['src/data.json']);
  });

  it('arm 2 ❌ affected page untouched, no token → fail with the remedy named', () => {
    expect(gate.rc).toBe(1);
    const f = statusOf(gate.json!, 'untouched-page.md');
    expect(f?.status).toBe('fail');
    expect(f?.message).toContain('docs-refresh: deferred');
  });

  it('arm 3 ✅ affected page untouched + valid deferred token → deferred, reason captured', () => {
    const f = statusOf(gate.json!, 'deferred-page.md');
    expect(f?.status).toBe('deferred');
    expect(f?.reason).toBe('reason at least twenty characters long');
  });

  it('arm 4 ❌ malformed token (reason under the 20-char floor) → fail, floor named', () => {
    const f = statusOf(gate.json!, 'short-token-page.md');
    expect(f?.status).toBe('fail');
    expect(f?.message).toContain('floor is 20');
  });

  it('arm 5 ✅ a page with NO kind: still gets a verdict — this gate never re-checks kind:', () => {
    // kindless-page carries no kind: key at all; a kind re-check would error it as malformed
    // frontmatter instead of the cited-source verdict (ref-gen.md:201 disjointness).
    const f = statusOf(gate.json!, 'kindless-page.md');
    expect(f?.status).toBe('fail');
    expect(f?.message).toContain('cited source(s) moved');
  });

  it('arm 6 unaffected page (cited paths ∩ changed = ∅) is absent from the affected set', () => {
    expect(statusOf(gate.json!, 'plain-page.md')).toBeUndefined();
    // plain + tokenonly + mixededit (cited source unchanged) + cascade (its cited page's
    // edit carved out by the token-only rule) — see arms 9-10.
    expect(gate.json!.unaffected).toBe(4);
  });

  it('arm 7 ✅ derived-only citation (face-facts.json / reference family JSON) is exempt — reported, never silent', () => {
    // Both derived artifacts moved in-range; the pages citing ONLY them carry no refresh
    // obligation (their freshness is owned by the renderer --check byte-identity gates).
    expect(statusOf(gate.json!, 'derived-facts-page.md')).toBeUndefined();
    expect(statusOf(gate.json!, 'derived-ref-page.md')).toBeUndefined();
    expect(gate.json!.exemptDerived).toBe(2);
    const exempt = new Map(gate.json!.exempt.map((e) => [e.file, e.via]));
    expect(exempt.get('docs/site/derived-facts-page.md')).toEqual([
      'docs/site/face-facts.json',
    ]);
    expect(exempt.get('docs/site/derived-ref-page.md')).toEqual([
      'docs/site/reference/B.json',
    ]);
  });

  it('arm 8 ❌ control: a MIX of derived + hand-written sources still gates on the hand-written one', () => {
    // The scope-out cannot swallow a real trip: the derived path is filtered out of the
    // gating set and reported on exemptVia, the hand-written source keeps the page failing.
    const f = statusOf(gate.json!, 'mixed-page.md');
    expect(f?.status).toBe('fail');
    expect(f?.via).toEqual(['src/data.json']);
    expect(f?.exemptVia).toEqual(['docs/site/face-facts.json']);
    expect(f?.message).toContain('docs-refresh: deferred');
  });

  it('arm 9 ✅ a docs-refresh-only page edit is bookkeeping: it does not cascade onto citing pages', () => {
    // tokenonly-page moved in-range, but its whole patch is one docs-refresh line — the
    // carve-out drops it from the changed set, so cascade-page (which cites it) stays out
    // of the affected set. The edit is still reported, never silent.
    expect(gate.json!.tokenOnlyEdits).toEqual(['docs/site/tokenonly-page.md']);
    expect(statusOf(gate.json!, 'cascade-page.md')).toBeUndefined();
  });

  it('arm 10 ❌ control: a token edit BUNDLED WITH a content change keeps full gate weight', () => {
    // mixededit-page changed its title AND added the token — the patch is not token-only,
    // it stays in the changed set, and cascade2-page (which cites it) must fail.
    expect(gate.json!.tokenOnlyEdits).not.toContain(
      'docs/site/mixededit-page.md',
    );
    const f = statusOf(gate.json!, 'cascade2-page.md');
    expect(f?.status).toBe('fail');
    expect(f?.via).toEqual(['docs/site/mixededit-page.md']);
    expect(f?.message).toContain('docs-refresh: deferred');
  });

  it('arm 11 ✅ same-range drift arm: the SAME explicit range twice → identical verdicts', () => {
    const a = runGate('base-tag..HEAD');
    const b = runGate('base-tag..HEAD');
    const { root: _ra, ...ra } = a.json!;
    const { root: _rb, ...rb } = b.json!;
    expect(rb).toEqual(ra); // caller 1 (pre-push) and caller 2 (CI) on one range cannot diverge
    expect(a.rc).toBe(b.rc);
  });

  it('arm 12 the range is load-bearing: an empty point-range on the same tree is vacuously clean', () => {
    const empty = runGate('base-tag..base-tag');
    expect(empty.rc).toBe(0);
    expect(empty.json!.changedCount).toBe(0);
    expect(empty.json!.affected).toHaveLength(0);
    // Same tree, same HEAD — only the RANGE differs, and the verdict flips. An implicit or
    // empty range must never be how this gate goes green (the BU-5 fetch-depth:0 mandate).
    expect(gate.json!.changedCount).toBeGreaterThan(0);
    expect(gate.json!.failures).toBeGreaterThan(0);
  });

  it('arm 13 ❌ missing range argument → exit 2 usage, never a false clean', () => {
    const r = runGate(null);
    expect(r.rc).toBe(2);
    expect(r.stderr).toContain('usage');
  });

  it('arm 14 ❌ --root that is not a git repo → exit 2 fatal, never a false clean', () => {
    const bare = realpathSync(
      mkdtempSync(join(tmpdir(), 'check-docs-refresh-nogit-')),
    );
    try {
      const r = runGate('a..b', bare);
      expect(r.rc).toBe(2);
      expect(r.stderr).toContain('git diff failed');
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});

// ── harvest review 2026-09-21: pure-function arms for the carve-out + parser edges ──────────────
describe('isTokenOnlyPatch / parseRefreshFrontmatter edges', () => {
  const HDR =
    'diff --git a/p.md b/p.md\nindex 1..2 100644\n--- a/p.md\n+++ b/p.md\n@@ -1,3 +1,3 @@\n';
  const TOKEN = '+docs-refresh: deferred — a reason that is long enough\n';
  it('a token-only patch is token-only (control)', async () => {
    const { isTokenOnlyPatch } = await import(SCRIPT);
    expect(isTokenOnlyPatch(HDR + TOKEN)).toBe(true);
  });
  it('an in-hunk `--- ` / `+++ ` content line is content, not a file header', async () => {
    const { isTokenOnlyPatch } = await import(SCRIPT);
    expect(isTokenOnlyPatch(HDR + TOKEN + '--- select 1;\n')).toBe(false);
    expect(isTokenOnlyPatch(HDR + TOKEN + '+++x\n')).toBe(false);
  });
  it('an indented docs-refresh: line is body content, not the frontmatter token', async () => {
    const { isTokenOnlyPatch } = await import(SCRIPT);
    expect(
      isTokenOnlyPatch(
        HDR + '+  docs-refresh: deferred — inside a code sample\n',
      ),
    ).toBe(false);
  });
  it('sources: items at any indentation and quoted are read (form-valid page is never source-less)', async () => {
    const { parseRefreshFrontmatter } = await import(SCRIPT);
    const fm = parseRefreshFrontmatter(
      '---\ntitle: t\nsources:\n- scripts/a.mjs\n    - "scripts/c.mjs"\n  - \'scripts/d.mjs\'\n---\nbody\n',
    );
    expect(fm.sources).toEqual([
      'scripts/a.mjs',
      'scripts/c.mjs',
      'scripts/d.mjs',
    ]);
  });
});

// ── tree guard (delta-based, advisory) ─────────────────────────────────────────────────────────
describe('sandbox isolation', () => {
  it('the suite never writes the real checkout (scripts/ + docs/ unchanged across the run)', () => {
    const after = snapshotGuardPaths();
    if (TREE_BEFORE === null || after === null) return; // advisory — git unavailable
    expect(after).toBe(TREE_BEFORE);
  });
});
