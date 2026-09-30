/**
 * Functional meta-tests for the card loader hook (.claude/hooks/inject-matching-rule.sh) — the
 * Class-B compensating mechanism for .claude/rules/rule-enforcement-channel-selection.md (§4).
 *
 * Asserts the verified injection contract (code.claude.com/docs/en/hooks.md):
 *   - non-blocking injection MUST be JSON {hookSpecificOutput:{hookEventName,additionalContext}}
 *   - matching path → injects the rule's `<!-- inject: -->` summary
 *   - non-match / wrong tool → silent (empty stdout, exit 0)
 *   - session-cache → at most once per (session_id, agent_id) per card
 *   - prose that documents the marker syntax is NOT mis-detected (own-line anchor)
 *   - the slice-1 arms (describe «slice 1 (trigger build)»): Read (`on: read`), PreToolUse Bash
 *     (`events:`), SessionStart compact reset, the card directory, and the glob → regex table
 *     checked against picomatch
 *
 * S6 honest-no-op paired fixture (kickoff §4): when the consumer has NO rules corpus
 * (RULES_DIR missing OR empty of .md files), the hook reports ONCE per session loudly,
 * then stays quiet. Both halves asserted: first call emits, second call is silent.
 * Control: hook still fires normally when a corpus IS present. Test seam: RULES_DIR_OVERRIDE.
 *
 * Skips gracefully when `jq` is unavailable (the hook itself no-ops without jq).
 */
import { describe, it, expect } from 'vitest';
import { execSync, execFileSync, spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// picomatch ships no type declarations; typing the one call used here avoids a new @types dependency.
const picomatch = createRequire(import.meta.url)('picomatch') as (
  glob: string,
  options?: { dot?: boolean },
) => (path: string) => boolean;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/inject-matching-rule.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

/** Run the hook with a stdin payload; return trimmed stdout. Optional env overrides for the
 * S6 test seam (RULES_DIR_OVERRIDE). */
function runHook(input: Record<string, unknown>, env?: NodeJS.ProcessEnv): string {
  return execFileSync('bash', [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : undefined,
  }).trim();
}

function payload(tool: string, relPath: string, session: string) {
  return {
    tool_name: tool,
    session_id: session,
    tool_input: { file_path: resolve(REPO_ROOT, relPath) },
  };
}

const uniq = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe.skipIf(!JQ)(
  'inject-matching-rule.sh — PostToolUse rule-injector',
  () => {
    it('matching path (.claude/rules/**) on Edit → valid additionalContext JSON', () => {
      const out = runHook(
        payload('Edit', '.claude/rules/some-new-rule.md', uniq()),
      );
      const json = JSON.parse(out);
      expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
      // guards the own-line-anchor fix: we get the real `<!-- inject: -->` summary,
      // not a mis-match against the prose that documents the marker syntax.
      expect(json.hookSpecificOutput.additionalContext).toContain(
        'Channel-selection',
      );
      // and the injected summary itself must not leak the glob-subset doc text.
      expect(json.hookSpecificOutput.additionalContext).not.toContain(
        'subset:',
      );
    });

    it('ZCode schema-compliance: top-level keys match CCt.strict() (hookSpecificOutput wrapper)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). This hook uses the valid `{hookSpecificOutput:{hookEventName, additionalContext}}`
      // shape (hookEventName INSIDE hookSpecificOutput is allowed by the discriminated union Uan;
      // top-level hookEventName is NOT). Regression guard: catches anyone flattening the wrapper.
      const out = runHook(
        payload('Edit', '.claude/rules/schema-test.md', uniq()),
      );
      const json = JSON.parse(out);
      const allowedTopLevel = new Set([
        'additionalContext',
        'additional_context',
        'continue',
        'decision',
        'hookSpecificOutput',
        'reason',
        'stopReason',
        'suppressOutput',
        'systemMessage',
      ]);
      const unknownKeys = Object.keys(json).filter(
        (k) => !allowedTopLevel.has(k),
      );
      expect(
        unknownKeys,
        `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
      ).toEqual([]);
      expect(
        json.hookEventName,
        'hookEventName must NOT be at top level — only inside hookSpecificOutput',
      ).toBeUndefined();
      expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    });

    it('matching path (packages/core/principles/**) → injects', () => {
      const out = runHook(
        payload('Write', 'packages/core/principles/99-x.test.ts', uniq()),
      );
      expect(JSON.parse(out).hookSpecificOutput.additionalContext).toContain(
        'Channel-selection',
      );
    });

    it('non-matching path → silent (empty stdout)', () => {
      expect(runHook(payload('Write', 'src/app.ts', uniq()))).toBe('');
    });

    // Slice 1 (S-5): the Read arm injects only cards that declare `on: read`; no rule in the
    // repo corpus declares it, so a Read of a matching path stays silent here. The `on: read`
    // half is asserted in the slice-1 block below.
    it('Read of a matching path → silent when no card declares `on: read`', () => {
      expect(
        runHook(payload('Read', '.claude/rules/some-new-rule.md', uniq())),
      ).toBe('');
    });

    // Slice 1 (S-4): the key is (session_id, agent_id); the parent has no agent_id, so two
    // parent edits in one session still inject once. The agent_id half is asserted below.
    it('session-cache: injects at most once per (session_id, agent_id) per card', () => {
      const s = uniq();
      const first = runHook(payload('Edit', '.claude/rules/a.md', s));
      const second = runHook(payload('Edit', '.claude/rules/b.md', s));
      expect(first).not.toBe('');
      expect(second).toBe('');
    });

    it('output is non-blocking (exit 0) — execFileSync would throw on non-zero', () => {
      // matching-path run already executed above without throwing; assert explicitly here too
      expect(() =>
        runHook(payload('Edit', '.claude/rules/c.md', uniq())),
      ).not.toThrow();
    });
  },
);

/**
 * S6 honest-no-op paired fixture (kickoff §4). When RULES_DIR has no .md corpus
 * (directory missing OR empty), the hook reports ONCE per session loudly, then stays
 * quiet. Both halves asserted; control proves the hook still fires normally with a corpus.
 *
 * T-HS-A binding: PRIMARY assertions are output presence / exit code / JSON shape;
 * wording checks are SECONDARY (non-load-bearing). Test seam = RULES_DIR_OVERRIDE env
 * (kickoff §2 planner decision 2, option a).
 */
describe.skipIf(!JQ)(
  'inject-matching-rule.sh — S6 honest no-op (corpus absent → report once, then quiet)',
  () => {
    /** Build a unique non-existent RULES_DIR path → triggers corpus-absent branch. */
    function absentRulesPath(): string {
      return join(tmpdir(), `no-rules-${uniq()}`);
    }

    /** Build a real temp RULES_DIR containing one fake rule with globs+inject markers. */
    function presentRulesPathWithFakeRule(): string {
      const dir = mkdtempSync(join(tmpdir(), `with-rules-${uniq()}-`));
      writeFileSync(
        join(dir, 'fake-rule.md'),
        [
          '<!-- globs: .claude/rules/** -->',
          '<!-- inject: Fake-rule-summary -->',
          '# Fake rule for S6 control test',
          '',
        ].join('\n'),
      );
      return dir;
    }

    it('corpus absent (RULES_DIR missing) → emits JSON report on first call (T-HS-A primary)', () => {
      const out = runHook(
        payload('Edit', '.claude/rules/some-rule.md', uniq()),
        { RULES_DIR_OVERRIDE: absentRulesPath() },
      );
      // PRIMARY (T-HS-A): observable output presence first.
      expect(out).not.toBe('');
      const json = JSON.parse(out);
      expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
      // SECONDARY (wording — non-load-bearing per T-HS-A).
      expect(json.hookSpecificOutput.additionalContext).toContain('inject-matching-rule');
      expect(json.hookSpecificOutput.additionalContext).toContain('no rules corpus');
    });

    it('corpus absent → second call with same session_id is silent (once-per-session)', () => {
      const empty = absentRulesPath();
      const session = uniq();
      const first = runHook(
        payload('Edit', '.claude/rules/a.md', session),
        { RULES_DIR_OVERRIDE: empty },
      );
      const second = runHook(
        payload('Edit', '.claude/rules/b.md', session),
        { RULES_DIR_OVERRIDE: empty },
      );
      // Both halves asserted (kickoff §4): first reports, second does not repeat.
      expect(first).not.toBe('');
      expect(second).toBe('');
    });

    it('corpus absent + new session → reports again (cache is per-session, not per-install)', () => {
      const empty = absentRulesPath();
      const firstSession = uniq();
      const secondSession = uniq();
      const first = runHook(
        payload('Edit', '.claude/rules/a.md', firstSession),
        { RULES_DIR_OVERRIDE: empty },
      );
      const second = runHook(
        payload('Edit', '.claude/rules/b.md', secondSession),
        { RULES_DIR_OVERRIDE: empty },
      );
      expect(first).not.toBe('');
      expect(second).not.toBe('');
    });

    it('corpus absent → exit 0 (non-blocking, even when reporting)', () => {
      expect(() =>
        runHook(
          payload('Edit', '.claude/rules/c.md', uniq()),
          { RULES_DIR_OVERRIDE: absentRulesPath() },
        ),
      ).not.toThrow();
    });

    it('corpus present (control) → hook still fires normal injection, no-op path did not disable it', () => {
      const rules = presentRulesPathWithFakeRule();
      try {
        const out = runHook(
          payload('Edit', '.claude/rules/x.md', uniq()),
          { RULES_DIR_OVERRIDE: rules },
        );
        const json = JSON.parse(out);
        expect(json.hookSpecificOutput.hookEventName).toBe('PostToolUse');
        expect(json.hookSpecificOutput.additionalContext).toContain('Fake-rule-summary');
      } finally {
        rmSync(rules, { recursive: true, force: true });
      }
    });
  },
);

// =============================================================================
// Rules-delivery claim retraction (GH #1520, option B) — the hook's SHIP-status
// comment asserted «consumers DO get .claude/rules/* installed», inherited
// unverified from #934's draft classification via PR #1004. Delivery ships ZERO
// rules/ lines (setup.d/lib.sh:89-90 records the non-delivery); the corpus is
// consumer-owned. Comment-only contract, so the guard is textual: the false
// claim cannot silently return, and the correction must keep pointing at the
// two in-tree statements of the truth (lib.sh + the plugin twin's model).
// =============================================================================
describe('inject-matching-rule.sh — rules-delivery claim retraction (GH #1520)', () => {
  it('source carries no SHIP claim of rules delivery; states hook-ships/corpus-does-not with pointers', () => {
    const src = readFileSync(HOOK, 'utf8');
    // The retracted claim, in either of its two historical phrasings.
    expect(src).not.toMatch(/consumers DO get \S*rules/i);
    expect(src).not.toMatch(/NOW SHIPPED[^\n]*rules\/\*/i);
    // The corrected model: corpus does NOT ship (consumer-owned) + the lib.sh pointer.
    expect(src).toMatch(/CORPUS it reads does NOT ship/);
    expect(src).toMatch(/consumer-owned project data/);
    // The lib.sh pointer must land on the statement it cites — shell-comment
    // citations are not covered by the markdown line-citation gate, so the
    // range is resolved here rather than pinned as a literal.
    const cite = src.match(/setup\.d\/lib\.sh:(\d+)-(\d+)/);
    expect(cite).not.toBeNull();
    const [from, to] = [Number(cite![1]), Number(cite![2])];
    const cited = readFileSync(resolve(REPO_ROOT, 'setup.d/lib.sh'), 'utf8')
      .split('\n')
      .slice(from - 1, to)
      .join('\n');
    expect(cited).toMatch(/`\.claude\/rules\/` is\s*\n#\s*NOT shipped to consumers/);
    // The delivery lanes stay truthfully described (hook ships + registers).
    expect(src).toMatch(/setup\.d\/10-skills\.sh §1e/);
    expect(src).toMatch(/install\.sh --refresh/);
    // …and the cited install.sh arm really is this hook's refresh_safe arm. The arm is cited
    // by its call, not by a line range: install.sh grows (the P2 installer branch moved it
    // from :1015 to :1054) and a line range silently stops pointing at it.
    expect(src).not.toMatch(/install\.sh:\d+/);
    const arm = src.match(/the `(refresh_safe "\$_IMR_SRC" "\$_IMR_DST")` arm in install\.sh/);
    expect(arm).not.toBeNull();
    const install = readFileSync(resolve(REPO_ROOT, 'install.sh'), 'utf8').split('\n');
    const at = install.findIndex((l) => l.trim() === arm![1]);
    expect(at).toBeGreaterThan(-1);
    // Slice 1: the refresh arm registers through register_imr_hooks (setup.d/lib.sh — the
    // three arms + the legacy-matcher widening, pinned by tests/install-sh/imr-registration.test.sh).
    expect(install.slice(at, at + 5).join('\n')).toMatch(
      /register_imr_hooks "\$PROJECT_ROOT\/\.claude\/settings\.json"/,
    );
    // The @dual-pair marker survived the retraction edit untouched.
    expect(src).toMatch(/^# @dual-pair: rule-path-scoping$/m);
  });
});

// =============================================================================
// Trigger build, slice 1 — the loader as the platform (spec
// _spec-2026-09-29-trigger-build.md §3 slice 1; S-1…S-5, S-14). Every case runs against
// a throwaway corpus through the two seams: RULES_DIR_OVERRIDE (project rules) and
// CARDS_DIR_OVERRIDE (the base-core card directory beside the hook, S-2).
// =============================================================================
describe.skipIf(!JQ)('inject-matching-rule.sh — slice 1 (trigger build)', () => {
  /** A fresh corpus: files maps a name to its content, for rules and cards separately. */
  function corpus(rules: Record<string, string>, cards: Record<string, string> = {}) {
    const root = mkdtempSync(join(tmpdir(), `imr-s1-${uniq()}-`));
    const rulesDir = join(root, 'rules');
    const cardsDir = join(root, 'cards');
    mkdirSync(rulesDir);
    mkdirSync(cardsDir);
    for (const [n, c] of Object.entries(rules)) writeFileSync(join(rulesDir, n), c);
    for (const [n, c] of Object.entries(cards)) writeFileSync(join(cardsDir, n), c);
    return {
      env: { RULES_DIR_OVERRIDE: rulesDir, CARDS_DIR_OVERRIDE: cardsDir },
      cleanup: () => rmSync(root, { recursive: true, force: true }),
    };
  }

  function ctx(out: string): string {
    return out === '' ? '' : JSON.parse(out).hookSpecificOutput.additionalContext;
  }

  function edit(relPath: string, session: string, extra: Record<string, unknown> = {}) {
    return { ...payload('Edit', relPath, session), hook_event_name: 'PostToolUse', ...extra };
  }

  // ---------------------------------------------------------------------------
  // S-1 — glob → ERE translation. Each glob is asserted against the hook AND against
  // picomatch (the matcher family Claude Code's native `paths:` is documented on, rule
  // rule-enforcement-channel-selection.md §4), so a divergence from native matching is a
  // failing row, not a surprise in a consumer project.
  // ---------------------------------------------------------------------------
  const GLOB_TABLE: Array<[glob: string, path: string, match: boolean]> = [
    ['.claude/rules/**', '.claude/rules/a.md', true],
    ['.claude/rules/**', '.claude/rules/x/y.md', true],
    ['.claude/rules/**', 'xclaude/rules/a.md', false], // literal `.` (BU note N2)
    ['.claude/rules/**', '.claude/rulesX/a.md', false],
    ['src/**/*.ts', 'src/a.ts', true],
    ['src/**/*.ts', 'src/x/y/a.ts', true],
    ['src/**/*.ts', 'src/a.tsx', false],
    ['src/**/*.ts', 'lib/a.ts', false],
    ['docs/*.md', 'docs/a.md', true],
    ['docs/*.md', 'docs/x/a.md', false],
    ['src/?.ts', 'src/a.ts', true],
    ['src/?.ts', 'src/ab.ts', false],
    ['src/*.{ts,tsx}', 'src/a.ts', true],
    ['src/*.{ts,tsx}', 'src/a.tsx', true],
    ['src/*.{ts,tsx}', 'src/a.js', false],
    ['a.b/**', 'a.b/c', true],
    ['a.b/**', 'aXb/c', false],
    ['a+b/**', 'a+b/c', true],
    ['a+b/**', 'aab/c', false],
    ['lib/a$/**', 'lib/a$/c', true],
    ['packages/core/principles/**', 'packages/core/principles/99-x.test.ts', true],
    ['setup', 'setup', true],
    ['setup', 'setup.d/lib.sh', false],
    // Cold review findings 6 + 9: an empty alternative (macOS regcomp rejects `(|x)`), a `**`
    // inside a segment (picomatch reads it as `*`), and `^` as a literal.
    ['src/*.ts{,x}', 'src/a.ts', true],
    ['src/*.ts{,x}', 'src/a.tsx', true],
    ['src/*.ts{,x}', 'src/a.tsxx', false],
    ['a**b/c', 'aXYb/c', true],
    ['a**b/c', 'a/x/b/c', false],
    ['lib/^a/**', 'lib/^a/c', true],
    ['lib/^a/**', 'lib/a/c', false],
    // Cold review round 2, finding 1: a brace edge (`{`, `,`, `}`) bounds a segment too, so
    // `**` right beside one is still a globstar.
    ['{src/**,lib/**}', 'src/a/b.ts', true],
    ['{src/**,lib/**}', 'x/a.ts', false],
    ['src/{**/,}*.ts', 'src/a/b/c.ts', true],
    ['src/{**/,}*.ts', 'src/c.ts', true],
    ['{**/,}x.ts', 'a/b/x.ts', true],
  ];

  it.each(GLOB_TABLE)('glob %s vs %s → %s (hook agrees with picomatch)', (glob, path, match) => {
    expect(picomatch(glob, { dot: true })(path)).toBe(match);
    // The `<!-- globs: -->` marker (not `paths:`) so the old script fails on the
    // translation itself; its comma list must not split inside `{a,b}`.
    const c = corpus({
      'r.md': `<!-- globs: ${glob} -->\n<!-- inject: GLOB-HIT -->\n# R\n`,
    });
    try {
      const got = ctx(runHook(edit(path, uniq()), c.env));
      expect(got.includes('GLOB-HIT')).toBe(match);
    } finally {
      c.cleanup();
    }
  });

  // A slash-less `*.ext` glob matches at any depth — today's behaviour, kept (no rule in the
  // corpus loses reach). picomatch without matchBase does NOT; the native behaviour is
  // settled by the slice-1 live probe, not assumed here.
  it('slash-less *.sh matches at any depth (kept behaviour)', () => {
    const c = corpus({ 'r.md': '<!-- globs: *.sh -->\n<!-- inject: SH-HIT -->\n# R\n' });
    try {
      expect(ctx(runHook(edit('setup.d/lib.sh', uniq()), c.env))).toContain('SH-HIT');
      expect(ctx(runHook(edit('x.sh', uniq()), c.env))).toContain('SH-HIT');
      expect(ctx(runHook(edit('x.shx', uniq()), c.env))).toBe('');
      // The same divergence from picomatch, pinned in both directions (native Claude Code
      // agrees with the hook: the slice-1 live probe loaded a `*.sh` rule on sub/deep/x.sh).
      expect(picomatch('*.sh', { dot: true })('setup.d/lib.sh')).toBe(false);
    } finally {
      c.cleanup();
    }
  });

  // A bare `|` is a literal character in the hook's grammar. picomatch passes it through to its
  // regex as top-level alternation, so `lib/a|b/**` does not even match the path it names.
  // The divergence is pinned in both directions rather than copied.
  it('a bare | is a literal (picomatch reads it as alternation)', () => {
    const c = corpus({ 'r.md': '<!-- globs: lib/a|b/** -->\n<!-- inject: BAR-HIT -->\n# R\n' });
    try {
      expect(ctx(runHook(edit('lib/a|b/c', uniq()), c.env))).toContain('BAR-HIT');
      expect(ctx(runHook(edit('lib/a/c', uniq()), c.env))).toBe('');
      expect(picomatch('lib/a|b/**', { dot: true })('lib/a|b/c')).toBe(false);
    } finally {
      c.cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // S-3 — `paths:` frontmatter is a second glob source (union with `<!-- globs: -->`), and a
  // file with no `inject:` whose body fits the card limit IS the card (advisor E5 N1).
  // ---------------------------------------------------------------------------
  it('paths: frontmatter alone (block list) selects the rule', () => {
    const c = corpus({
      'p.md': '---\npaths:\n  - "docs/**"\n---\n<!-- inject: PATHS-ONLY -->\n# P\n',
    });
    try {
      expect(ctx(runHook(edit('docs/x.md', uniq()), c.env))).toContain('PATHS-ONLY');
      expect(ctx(runHook(edit('src/x.md', uniq()), c.env))).toBe('');
    } finally {
      c.cleanup();
    }
  });

  it('paths: (inline list) and globs: are a union', () => {
    const c = corpus({
      'u.md':
        '---\npaths: ["docs/**"]\n---\n<!-- globs: src/** -->\n<!-- inject: UNION -->\n# U\n',
    });
    try {
      expect(ctx(runHook(edit('docs/a.md', uniq()), c.env))).toContain('UNION');
      expect(ctx(runHook(edit('src/a.ts', uniq()), c.env))).toContain('UNION');
    } finally {
      c.cleanup();
    }
  });

  it('no inject: + body within the limit → the BODY is injected (N1)', () => {
    const c = corpus({
      'b.md': '---\npaths:\n  - "docs/**"\n---\n# Card title\n\nDo the BODY-THING before editing docs.\n',
    });
    try {
      const got = ctx(runHook(edit('docs/a.md', uniq()), c.env));
      expect(got).toContain('Do the BODY-THING before editing docs.');
    } finally {
      c.cleanup();
    }
  });

  it('no inject: + body over the limit → first heading only', () => {
    const long = 'x'.repeat(1200);
    const c = corpus({
      'big.md': `---\npaths:\n  - "docs/**"\n---\n# BIG-HEADING\n\n${long}\n`,
    });
    try {
      const got = ctx(runHook(edit('docs/a.md', uniq()), c.env));
      expect(got).toContain('BIG-HEADING');
      expect(got).not.toContain('xxxxxxxxxx');
    } finally {
      c.cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // S-2 — the second card source beside the hook; the pointer names the card's `depth:`.
  // ---------------------------------------------------------------------------
  it('card directory: a card fires and its pointer names its depth: files', () => {
    const c = corpus(
      {},
      {
        'k.md':
          '---\npaths:\n  - "src/**"\ndepth:\n  - docs/deep-one.md\n  - docs/deep-two.md\n---\nCARD-BODY: check the thing.\n',
      },
    );
    try {
      const got = ctx(runHook(edit('src/a.ts', uniq()), c.env));
      expect(got).toContain('CARD-BODY: check the thing.');
      expect(got).toContain('docs/deep-one.md');
      expect(got).toContain('docs/deep-two.md');
      expect(got).not.toContain('.claude/rules/k.md');
    } finally {
      c.cleanup();
    }
  });

  it('card directory alone counts as a corpus (no empty-corpus report)', () => {
    const c = corpus({}, { 'k.md': '---\npaths:\n  - "src/**"\n---\nK\n' });
    try {
      expect(ctx(runHook(edit('lib/a.ts', uniq()), c.env))).toBe('');
    } finally {
      c.cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // S-4 — once-key = session_id + agent_id; compaction reset.
  // ---------------------------------------------------------------------------
  const ONE = { 'o.md': '<!-- globs: src/** -->\n<!-- inject: ONCE-CARD -->\n# O\n' };

  it('a subagent (agent_id) gets the card although the parent already had it', () => {
    const c = corpus(ONE);
    const s = uniq();
    try {
      expect(ctx(runHook(edit('src/a.ts', s), c.env))).toContain('ONCE-CARD');
      expect(ctx(runHook(edit('src/a.ts', s, { agent_id: 'agent-1' }), c.env))).toContain('ONCE-CARD');
      expect(ctx(runHook(edit('src/b.ts', s, { agent_id: 'agent-1' }), c.env))).toBe('');
      expect(ctx(runHook(edit('src/b.ts', s), c.env))).toBe('');
    } finally {
      c.cleanup();
    }
  });

  it('SessionStart with source=compact clears the parent cache; other sources do not', () => {
    const c = corpus(ONE);
    const s = uniq();
    try {
      expect(ctx(runHook(edit('src/a.ts', s), c.env))).toContain('ONCE-CARD');
      expect(
        runHook({ hook_event_name: 'SessionStart', source: 'resume', session_id: s }, c.env),
      ).toBe('');
      expect(ctx(runHook(edit('src/a.ts', s), c.env))).toBe('');
      expect(
        runHook({ hook_event_name: 'SessionStart', source: 'compact', session_id: s }, c.env),
      ).toBe('');
      expect(ctx(runHook(edit('src/a.ts', s), c.env))).toContain('ONCE-CARD');
    } finally {
      c.cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // S-5 — the Read arm (`on: read` cards only) and the event arm (PreToolUse:Bash).
  // ---------------------------------------------------------------------------
  it('Read arm: an `on: read` card fires on Read; a plain card does not', () => {
    const c = corpus(
      {},
      {
        'rd.md': '---\npaths:\n  - "src/**"\non: read\n---\nREAD-CARD\n',
        'ed.md': '---\npaths:\n  - "src/**"\n---\nEDIT-CARD\n',
      },
    );
    try {
      const out = runHook(
        { ...payload('Read', 'src/a.ts', uniq()), hook_event_name: 'PostToolUse' },
        c.env,
      );
      expect(JSON.parse(out).hookSpecificOutput.hookEventName).toBe('PostToolUse');
      expect(ctx(out)).toContain('READ-CARD');
      expect(ctx(out)).not.toContain('EDIT-CARD');
    } finally {
      c.cleanup();
    }
  });

  function bash(command: string, session: string) {
    return {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      session_id: session,
      tool_input: { command },
    };
  }

  // Cold review finding 9: the Read and event arms run on every Read and every Bash call, so
  // a call that injects nothing must leave nothing behind in TMPDIR.
  it('a call that injects nothing creates no cache directory', () => {
    const c = corpus({}, { 'ev.md': "---\nevents:\n  - '^make( |$)'\n---\nEV\n" });
    const tmp = mkdtempSync(join(tmpdir(), `imr-lazy-${uniq()}-`));
    try {
      const env = { ...c.env, TMPDIR: tmp };
      expect(runHook(bash('ls', uniq()), env)).toBe('');
      expect(runHook({ ...payload('Read', 'src/a.ts', uniq()), hook_event_name: 'PostToolUse' }, env)).toBe('');
      // Only the loader's own cache names: the D12 liveness prelude writes its marker on
      // every run, by design.
      expect(readdirSync(tmp).filter((n) => n.startsWith('cc-rule-injector-'))).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
      c.cleanup();
    }
  });

  it('event arm: a Bash command matching an events: regex injects as PreToolUse', () => {
    const c = corpus(
      {},
      {
        'ev.md': "---\nevents:\n  - '^git (commit|push)( |$)'\n---\nEVENT-CARD\n",
        'pa.md': '---\npaths:\n  - "src/**"\n---\nPATH-CARD\n',
      },
    );
    try {
      const out = runHook(bash('git commit -m x', uniq()), c.env);
      const json = JSON.parse(out);
      expect(json.hookSpecificOutput.hookEventName).toBe('PreToolUse');
      expect(json.hookSpecificOutput.permissionDecision).toBeUndefined();
      expect(ctx(out)).toContain('EVENT-CARD');
      expect(ctx(out)).not.toContain('PATH-CARD');
      expect(runHook(bash('git status', uniq()), c.env)).toBe('');
    } finally {
      c.cleanup();
    }
  });

  // Cold review 2026-09-29 (finding 8): a card carrying BOTH triggers fires on each arm through
  // its own trigger only — the Bash arm never reads its globs, the edit arm never its regexes.
  it('a card with paths: and events: fires on each arm through its own trigger only', () => {
    const c = corpus({}, {
      'both.md': "---\npaths:\n  - \"src/**\"\nevents:\n  - '^make( |$)'\n---\nBOTH-CARD\n",
    });
    try {
      expect(ctx(runHook(bash('ls src/a.ts', uniq()), c.env))).toBe('');
      expect(ctx(runHook(bash('make build', uniq()), c.env))).toContain('BOTH-CARD');
      expect(ctx(runHook(edit('lib/make', uniq()), c.env))).toBe('');
      expect(ctx(runHook(edit('src/a.ts', uniq()), c.env))).toContain('BOTH-CARD');
    } finally {
      c.cleanup();
    }
  });

  it('Read arm: an `on: read` card stays silent on a non-matching path', () => {
    const c = corpus({}, { 'rd.md': '---\npaths:\n  - "src/**"\non: read\n---\nREAD-CARD\n' });
    try {
      const out = runHook(
        { ...payload('Read', 'lib/a.ts', uniq()), hook_event_name: 'PostToolUse' },
        c.env,
      );
      expect(out).toBe('');
    } finally {
      c.cleanup();
    }
  });

  it('compaction reset leaves a subagent cache intact', () => {
    const c = corpus(ONE);
    const s = uniq();
    const sub = { agent_id: 'agent-9' };
    try {
      expect(ctx(runHook(edit('src/a.ts', s, sub), c.env))).toContain('ONCE-CARD');
      runHook({ hook_event_name: 'SessionStart', source: 'compact', session_id: s }, c.env);
      expect(ctx(runHook(edit('src/a.ts', s, sub), c.env))).toBe('');
    } finally {
      c.cleanup();
    }
  });

  // Cold review finding 1: `@sh` quotes an ARRAY as several words, so an array-valued field
  // reached `eval` as extra command words. Every field is coerced to one string first.
  it('a non-string payload field never executes as a command', () => {
    const c = corpus(ONE);
    const marker = join(tmpdir(), `imr-pwned-${uniq()}`);
    try {
      runHook(
        {
          hook_event_name: ['PostToolUse', 'touch', marker],
          tool_name: 'Edit',
          session_id: uniq(),
          tool_input: { file_path: ['/x', 'touch', marker], command: ['a', 'touch', marker] },
        },
        c.env,
      );
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(marker, { force: true });
      c.cleanup();
    }
  });

  // Cold review finding 7: YAML forms the frontmatter parser missed.
  it('YAML: a non-indented block list, a comment line inside it, a trailing comment', () => {
    const c = corpus({
      'y.md':
        '---\npaths:\n- "docs/**"\n# a comment inside the list\n- "tools/**"  # trailing\n---\n<!-- inject: YAML-CARD -->\n# Y\n',
    });
    try {
      expect(ctx(runHook(edit('docs/a.md', uniq()), c.env))).toContain('YAML-CARD');
      expect(ctx(runHook(edit('tools/a.sh', uniq()), c.env))).toContain('YAML-CARD');
      expect(ctx(runHook(edit('lib/a.ts', uniq()), c.env))).toBe('');
    } finally {
      c.cleanup();
    }
  });

  // Cold review round 2, findings 4 + 5: a key whose value is only a comment still opens a
  // block list, and a comma or ` #` inside a quoted flow-list item stays in the item.
  it('YAML: a comment-only value opens its list; quoted flow items keep , and #', () => {
    const c = corpus({
      'a.md': '---\npaths: # the globs\n  - "docs/**"\n---\n<!-- inject: COMMENTED-KEY -->\n# A\n',
      'b.md': "---\npaths: [lib/**, \"x # y/**\", 'p,q/**']\n---\n<!-- inject: FLOW-QUOTED -->\n# B\n",
    });
    try {
      expect(ctx(runHook(edit('docs/a.md', uniq()), c.env))).toContain('COMMENTED-KEY');
      expect(ctx(runHook(edit('x # y/a', uniq()), c.env))).toContain('FLOW-QUOTED');
      expect(ctx(runHook(edit('p,q/a', uniq()), c.env))).toContain('FLOW-QUOTED');
      expect(ctx(runHook(edit("'p/a", uniq()), c.env))).toBe('');
    } finally {
      c.cleanup();
    }
  });

  // ---------------------------------------------------------------------------
  // S-14 — the once-cache under parallel runs: exactly one of N concurrent runs injects.
  // ---------------------------------------------------------------------------
  function runHookAsync(input: Record<string, unknown>, env: NodeJS.ProcessEnv) {
    return new Promise<string>((res, rej) => {
      const p = spawn('bash', [HOOK], { env: { ...process.env, ...env } });
      let out = '';
      p.stdout.on('data', (d) => (out += d));
      p.on('error', rej);
      p.on('close', () => res(out.trim()));
      p.stdin.end(JSON.stringify(input));
    });
  }

  it('concurrency: 8 parallel runs of one payload → exactly one injection', async () => {
    const c = corpus(ONE);
    try {
      const s = uniq();
      const outs = await Promise.all(
        Array.from({ length: 8 }, () => runHookAsync(edit('src/a.ts', s), c.env)),
      );
      expect(outs.filter((o) => o !== '').length).toBe(1);
    } finally {
      c.cleanup();
    }
  });
});
