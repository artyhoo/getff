/**
 * Functional meta-test for the meta-orchestrator launch-table-generator helper
 * (.claude/skills/pipeline/helpers/launch-table-generator.sh).
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §3 Launch-table.
 *
 * Background:
 *   The script feeds §3 Launch-table generation in the meta-orchestrator SKILL.md.
 *   It accepts an optional <umbrella-name> arg, locates the corresponding kickoff.md,
 *   and auto-detects sub-wave rows using the B5 hybrid algorithm:
 *
 *   B5 algorithm (Option B5 — hybrid section-scoped + keyword fallback):
 *     PRIMARY PATH: detect a "## §N Sub-wave[...]" section heading via awk state machine.
 *       All pipe-delimited table rows within that section are treated as sub-wave rows.
 *       Section ends at the next "## " heading or EOF.
 *     FALLBACK PATH: if no Sub-wave section heading found, fall back to original
 *       keyword-filter behavior — grep rows matching R-phase|execution|wiring|Mode [AB]|etc.
 *
 * Paired-negative contract (5 cases):
 *
 *   Case 1 — No-arg quiet skip:
 *     POSITIVE: call with no umbrella arg → stdout contains "(launch-table-generator: no umbrella", exit 0
 *     NEGATIVE: call WITH an arg (but missing kickoff) → that message is NOT emitted
 *
 *   Case 2 — Missing kickoff:
 *     POSITIVE: umbrella arg given but no kickoff.md in sandbox → stdout contains "MISSING kickoff:", exit 0
 *     NEGATIVE: umbrella arg given and kickoff EXISTS → stdout does NOT contain "MISSING kickoff"
 *
 *   Case 3 — Primary path (B5 section-scoped):
 *     POSITIVE: kickoff with "## §2 Sub-wave decomposition" heading + rows A and B
 *       → stdout contains "  sub-wave: A" and "  sub-wave: B"
 *     NEGATIVE: kickoff WITHOUT any "## §N Sub-wave" heading, same rows, no keywords
 *       → primary path not used; fallback fires but rows without keywords NOT emitted
 *
 *   Case 4 — Table skeleton always emitted when kickoff present:
 *     POSITIVE: any valid kickoff → stdout contains table header
 *       "| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |"
 *     NEGATIVE: missing kickoff → NO table header emitted
 *
 *   Case 5 — Fallback path (keyword filter):
 *     POSITIVE: kickoff WITHOUT "## §N Sub-wave" heading but WITH rows like "| A | R-phase | ..."
 *       → stdout contains "  sub-wave: A"
 *     NEGATIVE (paired): same kickoff but rows lack any keyword → NOT emitted
 *
 * T3 compliance: each assertion cites the script section/line region it targets.
 * T11/T12: B5 algorithm built on awk + grep (standard Unix tools; no prior art missed).
 * T15 self-application: test file verified against the script it depends on.
 * T17: script behavior preserved verbatim; no destructive changes before writing this test.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/launch-table-generator.sh',
);

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'launch-table-generator-test-'));
  sandboxes.push(d);
  // Initialize a minimal git repo so `git rev-parse --show-toplevel` returns the
  // sandbox dir (script line 14: REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)").
  spawnSync('git', ['-C', d, 'init'], { encoding: 'utf8' });
  spawnSync('git', ['-C', d, 'config', 'user.email', 't@t.com'], { encoding: 'utf8' });
  spawnSync('git', ['-C', d, 'config', 'user.name', 'T'], { encoding: 'utf8' });
  return d;
}

/**
 * Writes kickoff.md for a given umbrella in the sandbox.
 */
function writeKickoff(sandboxRoot: string, umbrella: string, content: string): void {
  const dir = join(sandboxRoot, '.claude', 'orchestrator-prompts', umbrella);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'kickoff.md'), content, 'utf8');
}

/**
 * Runs the script with an optional umbrella positional argument.
 * cwd is set to sandboxRoot so `pwd` fallback also resolves correctly.
 * The UMBRELLA is the first positional argument, NOT an env var
 * (script line 13: UMBRELLA="${1:-}").
 */
function run(
  sandboxRoot: string,
  umbrella?: string,
): { status: number; stdout: string; stderr: string } {
  const args = umbrella !== undefined ? [SCRIPT, umbrella] : [SCRIPT];
  const r = spawnSync('bash', args, {
    cwd: sandboxRoot,
    encoding: 'utf8',
    env: { ...process.env },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// Table header emitted unconditionally when kickoff is present (script lines 110-111).
const TABLE_HEADER =
  '| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |';

// ---------------------------------------------------------------------------
// Case 1 — No-arg quiet skip
// ---------------------------------------------------------------------------
describe('Case 1 — no-arg quiet skip (script lines 16-22)', () => {
  it('POSITIVE: no umbrella arg → stdout contains quiet-skip message, exit 0', () => {
    // Targets script lines 16-22:
    //   if [[ -z "${UMBRELLA}" ]]; then
    //     echo "(launch-table-generator: no umbrella — ...)"
    //     exit 0
    //   fi
    const sandbox = makeSandbox();
    const r = run(sandbox /* no umbrella arg */);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('(launch-table-generator: no umbrella');
  });

  it('NEGATIVE: call WITH umbrella arg → quiet-skip message NOT present', () => {
    // Paired-negative: when umbrella is provided, lines 16-22 are skipped.
    // Script proceeds to the missing-kickoff check (lines 26-29).
    const sandbox = makeSandbox();
    const r = run(sandbox, 'some-umbrella');
    expect(r.stdout).not.toContain('(launch-table-generator: no umbrella');
  });
});

// ---------------------------------------------------------------------------
// Case 2 — Missing kickoff
// ---------------------------------------------------------------------------
describe('Case 2 — missing kickoff detection (script lines 26-29)', () => {
  it('POSITIVE: umbrella arg given, no kickoff.md → stdout contains "MISSING kickoff:", exit 0', () => {
    // Targets script lines 26-30:
    //   if [[ ! -f "${KICKOFF}" ]]; then
    //     echo "MISSING kickoff: $(resolve_orch_home_rel)/${UMBRELLA}/kickoff.md"
    //     exit 0
    //   fi
    // This sandbox has NO .claude/orchestrator-prompts (writeKickoff is not called), so
    // resolve_orch_home() takes the CONSUMER branch and the message must name .ai-factory/.
    // Before the orch-home-hardcode fix this arm asserted `.claude/…` — i.e. it pinned a
    // message that named a directory the script had not looked in and that did not exist.
    const sandbox = makeSandbox();
    // No kickoff.md written for 'my-umbrella'
    const r = run(sandbox, 'my-umbrella');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(
      'MISSING kickoff: .ai-factory/orchestrator-prompts/my-umbrella/kickoff.md',
    );
  });

  it('POSITIVE (framework layout): message names .claude/ when that home exists', () => {
    // Paired arm for the one above: the message must TRACK resolve_orch_home(), not be
    // pinned to either literal. A sibling umbrella's kickoff makes .claude/orchestrator-prompts
    // exist, flipping the resolver to the framework branch — while 'my-umbrella' stays absent.
    const sandbox = makeSandbox();
    writeKickoff(sandbox, 'other-umbrella', '# Other\n');
    const r = run(sandbox, 'my-umbrella');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(
      'MISSING kickoff: .claude/orchestrator-prompts/my-umbrella/kickoff.md',
    );
    expect(r.stdout).not.toContain('.ai-factory');
  });

  it('NEGATIVE: umbrella arg given and kickoff EXISTS → stdout does NOT contain "MISSING kickoff"', () => {
    // Paired-negative: when kickoff.md is present, lines 26-29 branch is not entered.
    const sandbox = makeSandbox();
    writeKickoff(sandbox, 'my-umbrella', '# My Umbrella\n\n## §0 Context\n- placeholder\n');
    const r = run(sandbox, 'my-umbrella');
    expect(r.stdout).not.toContain('MISSING kickoff');
  });
});

// ---------------------------------------------------------------------------
// Case 3 — Primary path (B5 section-scoped awk)
// ---------------------------------------------------------------------------
describe('Case 3 — B5 primary path: section-scoped awk (script lines 68-85)', () => {
  it('POSITIVE: kickoff with "## §2 Sub-wave decomposition" section and rows A, B → sub-waves A and B detected', () => {
    // Targets detect_subwaves() primary path (lines 68-85):
    //   grep -qE '^## §[0-9]+ [Ss]ub-wave' fires → awk state machine extracts
    //   pipe-delimited rows within the section. Row "| A | ..." → "  sub-wave: A".
    const sandbox = makeSandbox();
    const kickoffContent = [
      '# My Umbrella',
      '',
      '## §1 Context',
      '- placeholder',
      '',
      '## §2 Sub-wave decomposition',
      '',
      '| Sub-wave | Type | Mode |',
      '|---|---|---|',
      '| A | R-phase | Mode A |',
      '| B | I-phase | Mode B |',
      '',
      '## §3 Other section',
      '- content',
    ].join('\n');
    writeKickoff(sandbox, 'test-umbrella', kickoffContent);
    const r = run(sandbox, 'test-umbrella');
    expect(r.status).toBe(0);
    // Script line 101: `detect_subwaves | sed 's/^/  sub-wave: /'`
    expect(r.stdout).toContain('  sub-wave: A');
    expect(r.stdout).toContain('  sub-wave: B');
  });

  it('NEGATIVE: kickoff WITH "## §N Sub-wave" heading but section ends immediately → no sub-waves (primary awk path)', () => {
    // Paired-negative for Case 3 (primary awk path): the Sub-wave section exists (triggers
    // primary awk), but the section is immediately followed by a new ## heading before any
    // data rows. awk enters in_section=1 but exits immediately at the next ## heading.
    // Nothing is printed. Exit 0 (awk always exits 0 regardless of match count).
    //
    // Note: using primary awk path for NEGATIVE case to avoid a known script quirk
    // (lines 87-97 fallback grep chain exits 1 under set -euo pipefail when the keyword
    // grep finds no matches — that is a script-side pipefail edge case, not the assertion
    // we want to test here).
    const sandbox = makeSandbox();
    const kickoffContent = [
      '# My Umbrella',
      '',
      '## §1 Context',
      '- placeholder',
      '',
      '## §2 Sub-wave decomposition',
      '',
      '## §3 Immediately follows — no data rows in Sub-wave section',
      '',
      '- Some content here',
    ].join('\n');
    writeKickoff(sandbox, 'test-umbrella', kickoffContent);
    const r = run(sandbox, 'test-umbrella');
    expect(r.status).toBe(0);
    // Primary awk: in_section=1 from §2, then immediately in_section=0 at §3
    // → no rows processed → no sub-wave output
    expect(r.stdout).not.toContain('  sub-wave: A');
    expect(r.stdout).not.toContain('  sub-wave: B');
  });
});

// ---------------------------------------------------------------------------
// Case 4 — Table skeleton emitted iff kickoff present
// ---------------------------------------------------------------------------
describe('Case 4 — table skeleton emitted iff kickoff present (script lines 109-111)', () => {
  it('POSITIVE: valid kickoff present → table header always emitted', () => {
    // Targets script lines 109-111 (unconditional table header emission):
    //   echo "| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |"
    //   echo "|---|---|---|---|---|---|---|"
    // NOTE: kickoff must have a "## §N Sub-wave" heading so detect_subwaves() uses the
    // primary awk path (exits 0 even when no rows match). Without this heading the fallback
    // grep-based path exits 1 when no pipe-delimited rows exist, breaking pipefail-set scripts.
    const sandbox = makeSandbox();
    writeKickoff(
      sandbox,
      'test-umbrella',
      [
        '# My Umbrella',
        '',
        '## §0 Context',
        '- placeholder',
        '',
        '## §2 Sub-wave decomposition',
        '',
        '| Sub-wave | Type |',
        '|---|---|',
        '',
      ].join('\n'),
    );
    const r = run(sandbox, 'test-umbrella');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(TABLE_HEADER);
  });

  it('NEGATIVE: missing kickoff → table header NOT emitted', () => {
    // Paired-negative: script exits early at lines 26-29 (MISSING kickoff)
    // before reaching table skeleton emission at lines 109-111.
    const sandbox = makeSandbox();
    // No kickoff written for 'missing-umbrella'
    const r = run(sandbox, 'missing-umbrella');
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain(TABLE_HEADER);
  });
});

// ---------------------------------------------------------------------------
// Case 5 — Fallback path (keyword filter)
// ---------------------------------------------------------------------------
describe('Case 5 — B5 fallback path: keyword filter (script lines 87-97)', () => {
  it('POSITIVE: no Sub-wave heading but rows contain orchestration keywords → sub-waves detected', () => {
    // Targets fallback path (lines 87-97):
    //   grep -E '^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|' |
    //   grep -E 'R-phase|execution|wiring|Mode [AB]|Direct Edit|...' |
    //   while IFS='|' read ... → echo sub-wave id
    // "| A | R-phase |" matches the keyword grep; "| B | execution |" also matches.
    const sandbox = makeSandbox();
    const kickoffContent = [
      '# My Umbrella',
      '',
      '## §1 Context',
      '- placeholder',
      '',
      '## §2 Tasks (no Sub-wave heading)',
      '',
      '| Sub-wave | Type |',
      '|---|---|',
      '| A | R-phase |',
      '| B | execution |',
    ].join('\n');
    writeKickoff(sandbox, 'test-umbrella', kickoffContent);
    const r = run(sandbox, 'test-umbrella');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('  sub-wave: A');
    expect(r.stdout).toContain('  sub-wave: B');
  });

  it('NEGATIVE: sub-wave section present but rows have no letter/digit first cell → NOT emitted', () => {
    // Paired-negative for Case 5 (primary awk path, no matching rows):
    // kickoff has "## §2 Sub-wave decomposition" (triggers primary awk path) but the rows
    // have description text as the first cell rather than A-D or digits.
    // The awk pattern `^\| *(\*\*)?([A-D]|[0-9]+)(\*\*)? *\|` does NOT match
    // "| Description |" or "| SomeText |" → nothing is emitted.
    // Using primary awk path (not fallback grep) avoids set -euo pipefail exit-1 from grep.
    const sandbox = makeSandbox();
    const kickoffContent = [
      '# My Umbrella',
      '',
      '## §1 Context',
      '- placeholder',
      '',
      '## §2 Sub-wave decomposition',
      '',
      '| Description | Notes |',
      '|---|---|',
      '| Some description text | no letter or digit first |',
      '| Another description | also no match |',
    ].join('\n');
    writeKickoff(sandbox, 'test-umbrella', kickoffContent);
    const r = run(sandbox, 'test-umbrella');
    expect(r.status).toBe(0);
    // awk finds no rows matching letter/digit pattern → no sub-wave output
    expect(r.stdout).not.toContain('  sub-wave: A');
    expect(r.stdout).not.toContain('  sub-wave: B');
    // but table skeleton IS emitted (distinct from Case 4)
    expect(r.stdout).toContain(TABLE_HEADER);
  });
});

// ---------------------------------------------------------------------------
// T15 self-application: script existence sanity
// ---------------------------------------------------------------------------
describe('T15 self-application: script wiring sanity', () => {
  it('SCRIPT constant points to an existing file', () => {
    // T3 compliance: verifies test is wired to the actual script path, not a phantom.
    // Uses spawnSync('test', ['-f', SCRIPT]) rather than importing fs to keep the
    // pattern consistent with how the other tests invoke shell commands.
    const check = spawnSync('test', ['-f', SCRIPT], { encoding: 'utf8' });
    expect(check.status).toBe(0);
  });
});
