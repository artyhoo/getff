/**
 * Functional meta-tests for the PostToolUse kickoff-traps gate
 * (.claude/hooks/check-kickoff-traps.sh) — Wave N8 C2, the edit-time enforcement
 * of ai-laziness-traps.md §3 obligation #2 (≥3 distinct T-numbers enumerated).
 *
 * Channel: kickoffs are authored + dispatched before any pre-push/CI channel
 * sees their content, so principle 12 (CI-skipped) cannot gate them — edit-time PostToolUse is the earliest
 * (and only) channel. This hook adds the COUNT floor principle 12's compound
 * check (presence-of-any-one-pattern) misses.
 *
 * Paired-negative contract:
 *   ❌ kickoff engages the rule + <3 distinct T-numbers → exit 2 (the gap C2 closes)
 *   ✅ kickoff engages the rule + ≥3 distinct T-numbers  → exit 0
 *   ✅ kickoff that never mentions the rule              → exit 0 (engagement guard)
 *   ✅ non-kickoff path / wrong tool                      → exit 0 (off-path skip)
 *
 * Spawns the real hook with fixture stdin (the inject-matching-rule.test.ts
 * precedent). Skips gracefully when `jq` is unavailable (the hook no-ops too).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/check-kickoff-traps.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0))
    rmSync(d, { recursive: true, force: true });
});

/**
 * Write `body` to a kickoff.md at a repo-relative path under a unique wave dir,
 * so the hook's `.claude/orchestrator-prompts/<wave>/kickoff.md` matcher fires
 * against a REAL on-disk file (PostToolUse reads post-edit content from disk).
 * Returns the absolute path. The wave dir is removed in afterEach.
 */
function writeKickoff(body: string): string {
  return writeKickoffNamed('kickoff.md', body);
}

/**
 * As writeKickoff, but for an arbitrary filename in the wave dir — the stage-kickoff
 * family (`kickoff-s1.md`, `kickoff-s2b.md`, `kickoff-r1.md`) and the sidecars that must
 * stay OUT of scope (`kickoff-s4.decisions.md`, `kickoff-amendments.md`).
 */
function writeKickoffNamed(name: string, body: string): string {
  const waveDir = mkdtempSync(
    join(REPO_ROOT, '.claude/orchestrator-prompts/c2-test-'),
  );
  tmpDirs.push(waveDir);
  const abs = join(waveDir, name);
  writeFileSync(abs, body, 'utf8');
  return abs;
}

/** Run the hook with a PostToolUse payload. Returns status + stdout + stderr. The `env`
 *  parameter is merged onto process.env (ALL keys, not just ZCODE_PROJECT_DIR — a prior
 *  version silently dropped CLAUDE_PROJECT_DIR and LC_ALL overrides, so tests that set them
 *  were no-ops). ZCODE_PROJECT_DIR is default-scrubbed from process.env so CC-arms stay in
 *  the exit-code branch unless the caller explicitly sets it (mirrors deps-hash-check.test.ts). */
function runHook(
  tool: string,
  absPath: string,
  env: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const fullEnv = { ...process.env, ...env };
  if (env.ZCODE_PROJECT_DIR === undefined) delete fullEnv.ZCODE_PROJECT_DIR;
  const r = spawnSync('bash', [HOOK], {
    input: JSON.stringify({
      tool_name: tool,
      tool_input: { file_path: absPath },
    }),
    encoding: 'utf8',
    env: fullEnv,
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const CITE = 'See .claude/rules/ai-laziness-traps.md §2.';

/**
 * Arm-1 (destination-environment contract) opt-out, appended to the arm-2 fixtures that
 * assert exit 0. The hook accumulates violations across BOTH arms, so an arm-2 fixture
 * must satisfy arm 1 to isolate what it is actually testing. Arm 1 has its own paired
 * tests in the `host-verification contract` describe block below — this constant does not
 * hide it. Rationale is ≥20 chars, as the gate requires.
 */
const HV_OPTOUT =
  '<!-- host-verify: none — fixture exercises the trap-enumeration arm only -->';

describe.skipIf(!JQ)(
  'check-kickoff-traps.sh — PostToolUse kickoff T-enumeration gate',
  () => {
    it('PAIRED-NEGATIVE: engages rule but enumerates <3 distinct T-numbers → exit 2', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps: T1, T3.\n`,
      );
      expect(runHook('Write', abs).status).toBe(2);
    });

    it('blanket reference (cites rule, names ZERO traps) → exit 2', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nNo traps enumerated here.\n`,
      );
      expect(runHook('Edit', abs).status).toBe(2);
    });

    it('PAIRED-POSITIVE: engages rule + ≥3 distinct T-numbers → exit 0', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps: T1, T3, T7, T15.\n${HV_OPTOUT}\n`,
      );
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('boundary: exactly 3 distinct T-numbers → exit 0', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps for this R-phase: T1, T4, T10.\n${HV_OPTOUT}\n`,
      );
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('counts DISTINCT, not occurrences: T1 repeated 3× + nothing else → exit 2', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nT1 matters. T1 again. T1 once more.\n`,
      );
      expect(runHook('Write', abs).status).toBe(2);
    });

    it('engagement guard: kickoff that never mentions the rule → exit 0 (not C2 territory)', () => {
      const abs = writeKickoff(
        `# Wave N kickoff\n\nA plan with no trap discipline at all.\n${HV_OPTOUT}\n`,
      );
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('domain-label-only (T-Wave9-A) does NOT satisfy the canonical-T floor → exit 2', () => {
      // T-Wave9-A is the §3 #3 domain trap, not a canonical T-number; the \bT[0-9]+\b
      // count must not credit it. Two canonical + one domain label = 2 distinct → fail.
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps: T1, T3, plus T-Wave9-A.\n`,
      );
      expect(runHook('Write', abs).status).toBe(2);
    });

    it('off-path: a non-kickoff .md under orchestrator-prompts → exit 0', () => {
      const waveDir = mkdtempSync(
        join(REPO_ROOT, '.claude/orchestrator-prompts/c2-test-'),
      );
      tmpDirs.push(waveDir);
      const abs = join(waveDir, 'notes.md');
      writeFileSync(abs, `${CITE}\nT1 only.\n`, 'utf8');
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('wrong tool (Read) → exit 0 even on a violating kickoff', () => {
      const abs = writeKickoff(`# Wave N kickoff\n${CITE}\nT1 only.\n`);
      expect(runHook('Read', abs).status).toBe(0);
    });

    it('off-path: a file outside orchestrator-prompts → exit 0', () => {
      const dir = mkdtempSync(join(tmpdir(), 'c2-offpath-'));
      tmpDirs.push(dir);
      mkdirSync(join(dir, 'sub'), { recursive: true });
      const abs = join(dir, 'sub', 'kickoff.md');
      writeFileSync(abs, `${CITE}\nT1 only.\n`, 'utf8');
      expect(runHook('Write', abs).status).toBe(0);
    });

    it('ZCODE: violating kickoff under ZCODE_PROJECT_DIR → schema-valid {additionalContext} JSON, exit 0 (advisory, not gate)', () => {
      // ZCode parses hook stdout against the HookJSONOutput schema (CCt at zcode.cjs:~577900),
      // which is `.strict()` — unknown top-level keys are REJECTED (→ hook.run.failed, output
      // discarded). The ZCode branch (_adv_violation at hook line 26) emits schema-valid
      // `{additionalContext}` and exits 0 — PostToolUse cannot block on ZCode (schema Uan rejects
      // permissionDecision for PostToolUse; post-mutation by definition), so the violation surfaces
      // as advisory context. Catches the regression where a prior shape emitted
      // `{hookEventName, additionalContext}` at top level and was silently rejected by ZCode.
      const abs = writeKickoff(
        `# Wave N kickoff\n${CITE}\nActive traps: T1, T3.\n`,
      );
      const r = runHook('Write', abs, { ZCODE_PROJECT_DIR: REPO_ROOT });
      expect(r.status, 'ZCode path exits 0 (advisory, non-blocking)').toBe(0);
      expect(r.stdout.trim(), 'ZCode path emits non-empty JSON').not.toBe('');
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
      const parsed = JSON.parse(r.stdout);
      const unknownKeys = Object.keys(parsed).filter(
        (k) => !allowedTopLevel.has(k),
      );
      expect(
        unknownKeys,
        `ZCode CCt.strict() rejects unknown top-level keys: ${unknownKeys.join(', ')}`,
      ).toEqual([]);
      expect(
        parsed.additionalContext,
        'violation text rides inside additionalContext',
      ).toContain('kickoff-traps');
      expect(
        parsed.hookEventName,
        'hookEventName must NOT be at top level (CCt.strict rejects it)',
      ).toBeUndefined();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Dependency-missing SKIP must reach the model, not just stderr (aif-parity F1,
// criterion (a) — silent `command -v jq || exit 0` guards; sibling of the
// check-doc-authority.sh fix shipped in #1116). Channel semantics live-verified
// 2026-07-24: research-patches/2026-07-24-posttooluse-channel-verification.md.
// ═══════════════════════════════════════════════════════════════════════════════
import { mkdtempSync as _mkdtempSync, symlinkSync as _symlinkSync } from 'node:fs';
import { join as _join } from 'node:path';
import { tmpdir as _tmpdir } from 'node:os';
import { spawnSync as _spawnSync } from 'node:child_process';

describe('dependency-missing skip is announced on the model channel', () => {
  function runNoJq(filePath: string): { status: number; stdout: string; stderr: string } {
    const binDir = _mkdtempSync(_join(_tmpdir(), 'nojq-'));
    // sed/tr/head back the jq-free escaper + crude path parse; masking them too would
    // test the harness, not the hook. dirname backs the REPO_ROOT fallback line.
    for (const tool of ['sed', 'tr', 'cat', 'head', 'dirname', 'grep', 'sort', 'awk', 'stat', 'date', 'touch']) {
      const real = _spawnSync('/usr/bin/which', [tool], { encoding: 'utf8' }).stdout?.trim();
      if (real) _symlinkSync(real, _join(binDir, tool));
    }
    const env: Record<string, string> = { ...process.env, PATH: binDir } as Record<string, string>;
    delete env.ZCODE_PROJECT_DIR;
    const r = _spawnSync('/bin/bash', [HOOK], {
      input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }),
      encoding: 'utf8',
      env,
    });
    return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  }

  it('jq missing + in-scope path → hookSpecificOutput.additionalContext says DID NOT RUN (exit 0)', () => {
    const { status, stdout } = runNoJq('/x/.claude/orchestrator-prompts/wave-1/kickoff.md');
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim()) as {
      hookSpecificOutput: { hookEventName: string; additionalContext: string };
    };
    expect(parsed.hookSpecificOutput.hookEventName).toBe('PostToolUse');
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/DID NOT RUN/);
    expect(parsed.hookSpecificOutput.additionalContext).toMatch(/not a pass/i);
  });

  it('jq missing + OUT-of-scope path → silent exit 0 (no per-edit spam in a jq-less env)', () => {
    const { status, stdout } = runNoJq('/x/README.md');
    expect(status).toBe(0);
    expect(stdout.trim()).toBe('');
  });
});

/**
 * Arm 1 — destination-environment verification contract.
 * spec: .claude/rules/destination-environment-verification.md §1
 *
 * The gate delegates contract RECOGNITION to scripts/host-verify.sh --list, so the hook and
 * the runner cannot disagree about what counts as a contract. These tests therefore also
 * pin the shared grammar: the marker is matched on the fence INFO-STRING, so neither a
 * prose mention nor an unmarked block opens one.
 */
describe('check-kickoff-traps.sh — destination-environment contract arm', () => {
  it('PAIRED-NEGATIVE: kickoff with no contract and no opt-out → exit 2', () => {
    const abs = writeKickoff('# Wave N kickoff\n\nA plan with no host contract.\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
    expect(r.stderr).toMatch(/declares no/);
  });

  it('PAIRED-POSITIVE: a host-verify fenced block → exit 0', () => {
    const abs = writeKickoff(
      '# Wave N kickoff\n\n```bash host-verify\nnpx vitest run packages/core/principles\n```\n',
    );
    expect(runHook('Write', abs).status).toBe(0);
  });

  it('opt-out with a ≥20-char rationale → exit 0', () => {
    const abs = writeKickoff(`# Wave N kickoff\n${HV_OPTOUT}\n`);
    expect(runHook('Write', abs).status).toBe(0);
  });

  it('opt-out with a too-short rationale → exit 2 (no bare escape token)', () => {
    const abs = writeKickoff('# Wave N kickoff\n<!-- host-verify: none — too short -->\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/floor: 20/);
  });

  it('a PROSE mention of host-verify does not satisfy the contract → exit 2', () => {
    const abs = writeKickoff(
      '# Wave N kickoff\n\nThe orchestrator will host-verify this on the host, honest.\n',
    );
    expect(runHook('Write', abs).status).toBe(2);
  });

  it('an UNMARKED fenced block does not satisfy the contract → exit 2', () => {
    const abs = writeKickoff('# Wave N kickoff\n\n```bash\nnpx vitest run foo\n```\n');
    expect(runHook('Write', abs).status).toBe(2);
  });

  it('a marked block containing only comments/blanks is NOT a contract → exit 2', () => {
    // T-BATCH-A shape: an empty contract would make the gate look satisfied while
    // committing the worker to nothing. The runner strips comments and blanks, so an
    // all-comment block resolves to zero commands and must fail exactly like no block.
    const abs = writeKickoff(
      '# Wave N kickoff\n\n```bash host-verify\n# TODO: fill this in later\n\n```\n',
    );
    expect(runHook('Write', abs).status).toBe(2);
  });

  it('BOTH arms violated → both messages are reported in one pass (no round-trip per rule)', () => {
    const abs = writeKickoff(`# Wave N kickoff\n${CITE}\nOnly T1 here.\n`);
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
    expect(r.stderr).toMatch(/floor: 3/);
  });

  /**
   * Regressions for the bypasses a cold review found in the first cut. Each one made the
   * gate report green while the kickoff committed to nothing; each is pinned here so the
   * fix cannot silently rot.
   */
  it('a host-verify block QUOTED inside a wider documentation fence does not open a contract', () => {
    // The 4-backtick wrapper owns everything until a >=4-backtick close, so the inner
    // 3-backtick fence is content. Without CommonMark fence-length tracking, a kickoff that
    // merely quotes the rule's §1 example — or pastes this gate's own error text, which
    // embeds a ```bash host-verify block — satisfied the gate while declaring nothing.
    const abs = writeKickoff(
      '# Wave N kickoff\n\n````text\n```bash host-verify\nrm -rf /tmp/should-not-run\n```\n````\n',
    );
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    // Arm-1 stderr assertion: this fixture must trip arm 1 (the host-verify contract check),
    // NOT arm 2. The exit code alone cannot distinguish — both arms exit 2.
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('an UNTERMINATED fence is an error, not "the rest of the file is commands"', () => {
    const abs = writeKickoff(
      '# Wave N kickoff\n\n```bash host-verify\nnpx vitest run foo\n\nThen the orchestrator reviews the diff.\n',
    );
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('a contract of no-ops only is rejected (cheaper bypass than the documented opt-out)', () => {
    const abs = writeKickoff('# Wave N kickoff\n\n```bash host-verify\n:\n```\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('the em-dash opt-out floor is measured on the RATIONALE, not on the separator bytes', () => {
    // The em-dash is 3 bytes; a sed bracket expression matches one byte, so the old form
    // left 2 orphan continuation bytes in the capture and measured +3 too long — the
    // documented 20-char floor accepted 17 visible characters.
    const seventeen = 'x'.repeat(17); // under the floor, was wrongly accepted
    const twenty = 'y'.repeat(20); // exactly the floor
    const r1 = runHook('Write', writeKickoff(`# k\n<!-- host-verify: none — ${seventeen} -->\n`));
    expect(r1.status).toBe(2);
    expect(r1.stderr).toMatch(/kickoff host-verify:/);
    expect(
      runHook('Write', writeKickoff(`# k\n<!-- host-verify: none — ${twenty} -->\n`)).status,
    ).toBe(0);
  });

  it('an ASCII-hyphen opt-out measures the same as the em-dash form (no separator drift)', () => {
    const twenty = 'z'.repeat(20);
    expect(
      runHook('Write', writeKickoff(`# k\n<!-- host-verify: none - ${twenty} -->\n`)).status,
    ).toBe(0);
  });

  it('a kickoff OUTSIDE the resolved repo root is still gated (no silent root-mismatch skip)', () => {
    // Worktrees nest inside the repo here, so a primary-rooted session's CLAUDE_PROJECT_DIR
    // never prefixed a worktree kickoff's absolute path; the anchored REL_PATH pattern then
    // missed and the hook exited 0 in silence — the very defect class arm 1 exists to close.
    const abs = writeKickoff('# Wave N kickoff\n\nNo contract at all.\n');
    const r = runHook('Write', abs, { CLAUDE_PROJECT_DIR: '/nonexistent/other/checkout' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
    expect(r.stderr).toMatch(/declares no/);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // B1-B8 bypass corpus — 2026-07-24/25 cold audit of PR #1137.
  // Each fixture is arm-2-clean (no ai-laziness-traps mention) to isolate arm 1.
  // Every NEGATIVE case asserts BOTH exit 2 AND arm-1 stderr (grep 'kickoff host-verify:')
  // — the exit code alone is insufficient because arm 2 also exits 2, and a fixture that
  // trips arm 2 while arm 1 stays inert is the exact "green suite, dead mechanism"
  // failure this PR repairs. PAIRED-POSITIVE cases assert exit 0.
  // ═══════════════════════════════════════════════════════════════════════════

  it('B1 text-fence: opt-out quoted inside a ```text fence is NOT an opt-out → exit 2', () => {
    // Rationale is ≥20 chars so that WITHOUT fence-aware parsing the opt-out would be ACCEPTED
    // (false-negative exit 0); with fence-aware parsing the token is inside a code fence → exit 2.
    const abs = writeKickoff('# k\n\n```text\n<!-- host-verify: none — valid-looking rationale here -->\n```\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('B1 inline-code-span: opt-out inside backticks is NOT an opt-out → exit 2', () => {
    // Rationale is ≥20 chars so that WITHOUT code-span stripping the opt-out would be ACCEPTED
    // (false-negative exit 0); with code-span stripping the token is text inside backticks → exit 2.
    const abs = writeKickoff('# k\n\nUse this: `<!-- host-verify: none — valid-looking rationale here -->` to disable.\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('B2 greedy regex: multiple --> on one line → FIRST close used, short rationale rejected', () => {
    // The old greedy `.*` ran to the LAST `-->`, measuring a 2-char rationale as 48.
    const abs = writeKickoff('# k\n\n<!-- host-verify: none - no --> <!-- TODO: fill in later -->\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  // B3 — six no-op contract variants. `:` is already tested above as a standalone
  // regression guard; the remaining six variants here, including `:;` (the cheapest
  // bypass of all — a true no-op even under bash's special-builtin rules) which was
  // missing from the original loop and surfaced by the 2026-07-25 round-2 rework.
  for (const noop of ['true;', 'exit 00', '{ :; }', 'cd .', 'echo', ':;']) {
    it(`B3 no-op guard rejects: \`${noop}\` → exit 2`, () => {
      const abs = writeKickoff(`# k\n\n\`\`\`bash host-verify\n${noop}\n\`\`\`\n`);
      const r = runHook('Write', abs);
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/kickoff host-verify:/);
    });
  }

  it('B3 positive: `test -f package.json` is substantive (has arguments) → exit 0', () => {
    const abs = writeKickoff('# k\n\n```bash host-verify\ntest -f package.json\n```\n');
    expect(runHook('Write', abs).status).toBe(0);
  });

  it('B4 tilde-fence: contract inside a ~~~~ wrapper is NOT a contract → exit 2', () => {
    const abs = writeKickoff('# k\n\n~~~~\n```bash host-verify\nnpx vitest run nothing\n```\n~~~~\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('B4 four-space indent: a fence at 4+ cols indent is an indented code block → exit 2', () => {
    const abs = writeKickoff('# k\n\n    ```bash host-verify\n    npx vitest run nothing\n    ```\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('B5 HTML-comment: a fence inside <!-- … --> is invisible to humans → exit 2', () => {
    const abs = writeKickoff('# k\n\n<!--\n```bash host-verify\nnpx vitest run nothing\n```\n-->\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('B6 byte-vs-char under LC_ALL=C: 10-char Cyrillic rationale rejected (was 20 bytes ≥ floor)', () => {
    // проверкате = 10 Cyrillic chars = 20 bytes. Under byte-counting (LC_ALL=C, ${#var})
    // this measured 20 ≥ floor. The locale-independent tr-based count measures 10 < floor.
    const abs = writeKickoff('# k\n\n<!-- host-verify: none — проверкате -->\n');
    const r = runHook('Write', abs, { LC_ALL: 'C' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('B6 byte-vs-char under LC_ALL=C.utf8: same 10-char rationale also rejected', () => {
    const abs = writeKickoff('# k\n\n<!-- host-verify: none — проверкате -->\n');
    const r = runHook('Write', abs, { LC_ALL: 'C.utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('PAIRED-POSITIVE: B7 validly opted-out kickoff → exit 0 (gate and runner agree)', () => {
    const abs = writeKickoff('# k\n\n<!-- host-verify: none — prose-only kickoff, no executable deliverable -->\n');
    expect(runHook('Write', abs).status).toBe(0);
  });

  it('B8 tab-indented fence: a tab counts as 4 columns → indented code block → exit 2', () => {
    // A tab + ``` = 4 cols of indent → CommonMark indented code block, NOT a fence.
    const abs = writeKickoff('# k\n\n\t```bash host-verify\n\tnpx vitest run nothing\n\t```\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('CRLF kickoff: trailing \\r stripped, valid contract parses → exit 0', () => {
    // A CRLF-encoded kickoff must be parsed the same as LF; the parser strips \\r at the top.
    const body = '# k\r\n\r\n```bash host-verify\r\nnpx vitest run nothing\r\n```\r\n';
    const abs = writeKickoff(body);
    const r = runHook('Write', abs);
    expect(r.status).toBe(0);
  });

  it('blockquote control: a fence inside > blockquote is NOT a contract (already fail-closed)', () => {
    // Verified 2026-07-25 as the known-good control — must stay fail-closed.
    const abs = writeKickoff('# k\n\n> ```bash host-verify\n> npx vitest run nothing\n> ```\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2026-07-25 rework: four variants the acceptance mandate names, plus the
  // precedence rule that closes the "opt-out-wins" amplifier of the regression.
  // Each variant pairs the quoted opt-out with a REAL contract block — the shape
  // the regression silently skipped. With correct code-span stripping the quoted
  // token is invisible, the contract is recognised, and rc=0 with commands listed.
  // ═══════════════════════════════════════════════════════════════════════════

  it('B1 variant 1: opt-out in a single-backtick span ONLY + real contract → ignored, contract runs (rc=0)', () => {
    // Control: single-backtick stripping was already correct when no other span
    // appeared earlier on the same line. The contract must be recognised.
    const abs = writeKickoff(
      '# k\n\nUse this `<!-- host-verify: none — valid-looking rationale here -->` to disable.\n\n```bash host-verify\nnpx vitest run nothing\n```\n',
    );
    expect(runHook('Write', abs).status).toBe(0);
  });

  it('B1 variant 2 (THE REGRESSION): opt-out in a single-backtick span on a line with a >=2-backtick span earlier + real contract → runner does NOT see opt-out, lists commands (rc=0)', () => {
    // 2026-07-25 regression: a single-backtick regex `/`[^`]*`/` mis-pairs when a
    // multi-backtick run appears earlier on the same line — the delimiter scan
    // leaves the quoted opt-out unstripped, the HTML-comment scanner then treats
    // it as live, and (with opt-out-wins) the runner silently exited 0 printing
    // an "opt-out" line and skipping the contract. This is the exact shape of
    // this repository's own kickoff.md:16 — ```` ```bash host-verify ```` earlier
    // on the line, then `<!-- host-verify: none ... -->` later. CommonMark-correct
    // stripping honours the equal-length closer rule, so the quoted token stays
    // text-in-backticks regardless of what other spans appear earlier on the line.
    //
    // Direct runner invocation is the discriminator: through the gate alone the
    // exit code is 0 either way (gate accepts whatever the runner says). The
    // runner's stdout reveals whether it saw a contract or an opt-out, and that
    // is what the buggy commit got wrong.
    const body = [
      '# k',
      '',
      'See ```` ```bash host-verify ```` block, or `<!-- host-verify: none — valid-looking rationale here -->`.',
      '',
      '```bash host-verify',
      'npx vitest run nothing',
      '```',
      '',
    ].join('\n');
    const abs = writeKickoff(body);
    // Gate accepts (exit 0) on both buggy and fixed runner — the gate only sees
    // the runner's exit code, and a silent opt-out + a real contract both return 0.
    expect(runHook('Write', abs).status).toBe(0);
    // Runner must list the contract command and must NOT print an opt-out line.
    // On the buggy commit this fails twice: the runner prints "opt-out (N chars)"
    // and lists zero commands — exactly the silent-skip amplifier.
    const r = spawnSync('bash', [
      resolve(REPO_ROOT, 'scripts/host-verify.sh'),
      '--list',
      abs,
    ], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/• npx vitest run nothing/);
    expect(r.stdout).not.toMatch(/opt-out/);
  });

  it('B1 variant 3: opt-out inside a ```text fence + real contract → ignored, contract runs (rc=0)', () => {
    // The fence parser already treats the opt-out inside a code fence as content,
    // not a token. Paired with a real contract, the runner must execute the contract.
    const abs = writeKickoff(
      '# k\n\n```text\n<!-- host-verify: none — valid-looking rationale here -->\n```\n\n```bash host-verify\nnpx vitest run nothing\n```\n',
    );
    expect(runHook('Write', abs).status).toBe(0);
  });

  it('B1 variant 4 (regression fixture): this repository\'s own autonomy-mechanisms-hardening kickoff.md lists 8 commands at rc=0 and does NOT print an opt-out line', () => {
    // The actual kickoff.md that surfaced the regression. Its line 16 contains
    // the multi-backtick + single-backtick shape exactly. A buggy parser left
    // the quoted opt-out visible and silently skipped the 8-command contract;
    // a correct parser strips the span and the contract runs. This fixture pins
    // the runner's behaviour on the real file so any future regression of the
    // parser is caught immediately rather than at operator verification time.
    const r = spawnSync(
      'bash',
      [
        resolve(REPO_ROOT, 'scripts/host-verify.sh'),
        '--list',
        '.claude/orchestrator-prompts/autonomy-mechanisms-hardening/kickoff.md',
      ],
      { encoding: 'utf8', cwd: REPO_ROOT },
    );
    expect(r.status).toBe(0);
    const bullets = r.stdout.match(/^ {3}• /gm) || [];
    expect(bullets.length).toBe(8);
    expect(r.stdout).not.toMatch(/opt-out/);
  });

  it('precedence rule: a REAL opt-out AND a REAL contract both present → exit 2 (internally inconsistent)', () => {
    // The "opt-out-wins" rule was the amplifier of the 2026-07-25 regression:
    // a parser bug surfaced a quoted token and the runner silently skipped the
    // contract. The precedence guard fires whenever a real (visible) opt-out
    // accompanies a real contract block — that is an internally inconsistent
    // kickoff and must FAIL loudly rather than silently resolve to exit 0.
    const body = [
      '# k',
      '',
      '<!-- host-verify: none — prose-only kickoff, no executable deliverable -->',
      '',
      '```bash host-verify',
      'npx vitest run nothing',
      '```',
      '',
    ].join('\n');
    const abs = writeKickoff(body);
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
    expect(r.stderr).toMatch(/BOTH a contract block AND an opt-out/);
  });

  it('env-plumbing sanity: a non-ZCODE variable reaches the hook (pins runHook env-spread fix)', () => {
    // Pins the `{ ...process.env, ...env }` spread at line 73. The prior version
    // silently dropped every `env` key except ZCODE_PROJECT_DIR, so the B6 LC_ALL
    // legs above were the ONLY tests passing another variable, and they could not
    // detect a spread reversion: the runner's locale-independent `tr -d '\200-\277'`
    // count is invariant across LC_ALL (verified at scripts/host-verify.sh:328-332),
    // so removing the spread leaves them passing. The sibling
    // inject-session-bootstrap.test.ts:196 case uses AIF_HOOK_LANG because that
    // hook echoes it; this hook does not echo any var, so the observable side
    // effect is REL_PATH — `.claude/hooks/check-kickoff-traps.sh:45` reads
    // CLAUDE_PROJECT_DIR into REPO_ROOT, and line 77 computes REL_PATH as
    // `ABS_PATH#"$REPO_ROOT/"`. A foreign CLAUDE_PROJECT_DIR (one that is NOT a
    // prefix of ABS_PATH) leaves REL_PATH equal to ABS_PATH unchanged; that
    // absolute path is then printed verbatim in the violation text.
    //
    // Choice of variable: CLAUDE_PROJECT_DIR is read at hook line 45 — the same
    // hook that handles the foreign-checkout case (lines 65-71) where the prior
    // REPO_ROOT-relative scope match silently exited 0. The absolute-ABS_PATH
    // shape in stderr appears ONLY if the value we passed reached the hook.
    //
    // Falsifier: revert line 73 to `{ ...process.env }` (omitting `...env`) —
    // CLAUDE_PROJECT_DIR reverts to ambient (unset in this container, so REPO_ROOT
    // resolves via `$(cd "$(dirname "$0")/../.." && pwd)` = real repo root, which
    // IS a prefix of ABS_PATH), REL_PATH becomes a relative path, and the
    // `toContain(abs)` assertion below goes RED because the absolute path no
    // longer appears in the violation text.
    const abs = writeKickoff(`# Wave N kickoff\n${CITE}\nActive traps: T1, T3.\n`);
    const foreign = '/nonexistent-env-plumbing-marker';
    const r = runHook('Write', abs, { CLAUDE_PROJECT_DIR: foreign });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(abs);
  });
});

/**
 * Stage-kickoff family scope — the 2026-08-12 gate-reach gap.
 *
 * A multi-stage umbrella dispatches `kickoff-s1.md` / `kickoff-s2b.md` / `kickoff-r1.md`.
 * Every one is a dispatch input in exactly the sense `kickoff.md` is, and every one was
 * ungated by BOTH arms: the hook's `case` matched the literal name `kickoff.md` only, so
 * the whole triage-kernel-v2 S1/S2 series passed by construction, not by compliance.
 *
 * Every NEGATIVE below asserts exit 2 AND the arm-specific stderr — the exit code alone
 * cannot say which arm fired, and a fixture that trips arm 2 while arm 1 stays inert is
 * the "green suite, dead mechanism" failure this block exists to prevent.
 *
 * Falsifier for the whole block: narrow the hook's `case` back to the single literal
 * kickoff.md arm — every negative here flips to exit 0 (verified against HEAD before the
 * widening, running the old and new hooks side by side over the same files: the two
 * pre-existing arm-1 violators `beta-delivery-ux/kickoff-s1.md` and a contract-less
 * synthetic stage kickoff both scored 0 on the old hook, 2 on the new one).
 */
describe.skipIf(!JQ)('check-kickoff-traps.sh — stage-kickoff family scope', () => {
  const CONTRACT = '```bash host-verify\nnpx vitest run packages/core/principles\n```';
  const THREE_TRAPS = `${CITE}\nActive traps: T1, T3, T7.`;

  it('PAIRED-NEGATIVE: a stage kickoff with no host contract → exit 2 (arm 1 now reaches it)', () => {
    const abs = writeKickoffNamed('kickoff-s1.md', '# S1\n\nA plan with no host contract.\n');
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/kickoff host-verify:/);
  });

  it('PAIRED-NEGATIVE: a stage kickoff engaging the rule with <3 T-numbers → exit 2 (arm 2 now reaches it)', () => {
    const abs = writeKickoffNamed('kickoff-s1.md', `# S1\n${HV_OPTOUT}\n${CITE}\nOnly T1 here.\n`);
    const r = runHook('Write', abs);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/floor: 3/);
  });

  it('PAIRED-POSITIVE: a compliant stage kickoff → exit 0', () => {
    const abs = writeKickoffNamed('kickoff-s2.md', `# S2\n\n${CONTRACT}\n\n${THREE_TRAPS}\n`);
    expect(runHook('Write', abs).status).toBe(0);
  });

  it.each(['kickoff-s0.md', 'kickoff-s2b.md', 'kickoff-s10.md', 'kickoff-r1.md'])(
    'the whole stage naming family is in scope: %s',
    (name) => {
      // s0 (zero-indexed stages), s2b (a split stage), s10 (two-digit), r1 (a review lane)
      // are all live shapes in .claude/orchestrator-prompts/ — none may fall through.
      const r = runHook('Write', writeKickoffNamed(name, '# stage\n\nNo contract.\n'));
      expect(r.status).toBe(2);
      expect(r.stderr).toMatch(/kickoff host-verify:/);
    },
  );

  it.each(['kickoff-s4.decisions.md', 'kickoff-amendments.md'])(
    'sidecars stay OUT of scope (records ABOUT a stage, not dispatch inputs): %s',
    (name) => {
      // `kickoff-s4.decisions.md` is an owner-fork log; `kickoff-amendments.md` is an audit
      // trail extracted from kickoff.md §12 to clear the 600-line gate. Neither carries
      // worker instructions, so neither arm applies. .gitignore draws the same line: the
      // stage family is un-ignored by glob, the amendments sidecar one-off by exact name.
      // Both fixtures are contract-less — they WOULD trip arm 1 if wrongly in scope.
      expect(runHook('Write', writeKickoffNamed(name, '# sidecar\n\nNo contract.\n')).status).toBe(0);
    },
  );

  it('the widening did not over-reach: a non-kickoff file in a wave dir stays off-path', () => {
    // `report.md` / `done.md` are tracked wave-dir artefacts (see .gitignore un-ignores).
    // A `kickoff*`-shaped glob would have swallowed neither, but a lazier `*.md` would.
    expect(runHook('Write', writeKickoffNamed('report.md', '# report\n\nNo contract.\n')).status).toBe(0);
    expect(runHook('Write', writeKickoffNamed('done.md', '# done\n\nNo contract.\n')).status).toBe(0);
  });
});
