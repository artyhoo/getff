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
 *     FALLBACK PATH: if no Sub-wave section heading found, fall back to the
 *       keyword-filter chain (R-phase|execution|wiring|Mode [AB]|...), PRECEDED by
 *       strip_table_headers — the same structural header drop the primary awk applies.
 *
 *   Structural header rule (both paths, harvest rework round 3 / 2026-09-27):
 *     the widened id grammar ([A-Za-z][A-Za-z0-9-]* | [0-9]+) makes ANY letter-first
 *     header cell shape-legal, so a content-based exclusion (first cell == 'Sub-wave')
 *     let real kickoffs' headers through as ids — worst: `| Stage | Sub-waves | … |`
 *     printed `sub-wave: Stage` + a garbage skeleton row, silently (measured over the
 *     337-kickoff corpus). The rule is STRUCTURAL, not content-based: a row immediately
 *     followed by a `|---|` separator row is by construction that table's header, and is
 *     dropped. The primary awk implements it as a one-row look-ahead (`pending` buffer);
 *     the fallback runs the same rule via strip_table_headers before the grep chain.
 *
 * Paired-negative contract (6 cases):
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
 *     NEGATIVE (#1518 loud-degrade contract): kickoff WITH a "## §N Sub-wave" heading
 *       but ZERO parseable rows (section ends immediately) → "DEGRADE:" line + non-zero
 *       exit; no sub-wave rows and no table skeleton (the DEGRADE exit short-circuits
 *       before the skeleton prints). Pre-fix this shape exited 0 with an empty skeleton.
 *
 *   Case 4 — Table skeleton emitted iff kickoff present AND rows parsed:
 *     POSITIVE: valid kickoff with parseable rows → stdout contains table header
 *       "| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |"
 *       plus one skeleton row per parsed id
 *     NEGATIVE: missing kickoff → NO table header emitted
 *     (zero parsed rows → DEGRADE: + non-zero exit — asserted in Case 3 NEGATIVE)
 *
 *   Case 5 — Fallback path (keyword filter):
 *     POSITIVE: kickoff WITHOUT "## §N Sub-wave" heading but WITH rows like "| A | R-phase | ..."
 *       → stdout contains "  sub-wave: A"
 *     NEGATIVE (paired): heading present but the only table material is a header row +
 *       non-id data rows → the header is structurally dropped (it is followed by a
 *       separator — the item-1 rule that makes this claim true; pre-fix the letter-first
 *       first cell parsed as an id) and the multi-word data cells fail the id shape →
 *       zero parsed rows → DEGRADE: + non-zero exit, nothing emitted
 *
 *   Case 6 — Structural header drop over parseable rows (rework round 3):
 *     POSITIVE: a `| Stage | Sub-waves | Parallel? | Depends on |` header followed by a
 *       separator, over `| S1 | … |`-style rows, yields ONLY the S-rows — on BOTH paths.
 *       The fallback arm reproduces the recorded silent false-green: the header itself
 *       carries the `Sub-wave` keyword, so pre-fix it passed the keyword filter, printed
 *       `sub-wave: Stage` + a `| Stage | ? |` skeleton row, and exited 0 (real instance:
 *       consumer-install-hardening).
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
  '.agents/procedures/pipeline/helpers/launch-table-generator.sh',
);

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'launch-table-generator-test-'));
  sandboxes.push(d);
  // Initialize a minimal git repo for the script's git reads. REPO_ROOT itself is pinned
  // by run() — helpers/lib/common.sh anchors an unset REPO_ROOT to the checkout the skill
  // is installed in (this repo), not to the cwd, so the sandbox must be passed explicitly.
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
 * (script line 15: UMBRELLA="${1:-}").
 */
function run(
  sandboxRoot: string,
  umbrella?: string,
): { status: number; stdout: string; stderr: string } {
  const args = umbrella !== undefined ? [SCRIPT, umbrella] : [SCRIPT];
  const r = spawnSync('bash', args, {
    cwd: sandboxRoot,
    encoding: 'utf8',
    env: { ...process.env, REPO_ROOT: sandboxRoot },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// Table header emitted when kickoff is present AND at least one sub-wave row parsed
// (script lines 180-181). Since the #1518 loud-degrade contract, zero parsed rows
// DEGRADE-exit at lines 167-170 BEFORE the skeleton prints, so the header is no longer
// unconditional — it is guarded by the zero-row gate.
const TABLE_HEADER =
  '| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |';

// ---------------------------------------------------------------------------
// Case 1 — No-arg quiet skip
// ---------------------------------------------------------------------------
describe('Case 1 — no-arg quiet skip (script lines 20-26)', () => {
  it('POSITIVE: no umbrella arg → stdout contains quiet-skip message, exit 0', () => {
    // Targets script lines 20-26:
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
    // Paired-negative: when umbrella is provided, lines 20-26 are skipped.
    // Script proceeds to the missing-kickoff check (lines 30-34).
    const sandbox = makeSandbox();
    const r = run(sandbox, 'some-umbrella');
    expect(r.stdout).not.toContain('(launch-table-generator: no umbrella');
  });
});

// ---------------------------------------------------------------------------
// Case 2 — Missing kickoff
// ---------------------------------------------------------------------------
describe('Case 2 — missing kickoff detection (script lines 30-34)', () => {
  it('POSITIVE: umbrella arg given, no kickoff.md → stdout contains "MISSING kickoff:", exit 0', () => {
    // Targets script lines 30-34:
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
    // Paired-negative: when kickoff.md is present, the lines 30-34 branch is not entered.
    const sandbox = makeSandbox();
    writeKickoff(sandbox, 'my-umbrella', '# My Umbrella\n\n## §0 Context\n- placeholder\n');
    const r = run(sandbox, 'my-umbrella');
    expect(r.stdout).not.toContain('MISSING kickoff');
  });
});

// ---------------------------------------------------------------------------
// Case 3 — Primary path (B5 section-scoped awk)
// ---------------------------------------------------------------------------
describe('Case 3 — B5 primary path: section-scoped awk (detect_subwaves lines 93-113)', () => {
  it('POSITIVE: kickoff with "## §2 Sub-wave decomposition" section and rows A, B → sub-waves A and B detected', () => {
    // Targets detect_subwaves() primary path (script lines 93-113):
    //   grep -qE '^## §[0-9]+ [Ss]ub-wave' fires (line 83) → awk state machine extracts
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
    // Script line 171: the captured rows are prefixed —
    //   printf '%s\n' "${_sw_rows}" | sed 's/^/  sub-wave: /'
    // (capture-once at line 166 replaced the pre-fix `detect_subwaves | sed` pipeline).
    expect(r.stdout).toContain('  sub-wave: A');
    expect(r.stdout).toContain('  sub-wave: B');
  });

  it('NEGATIVE: kickoff WITH "## §N Sub-wave" heading but section ends immediately → DEGRADE: + non-zero exit (#1518)', () => {
    // Paired-negative for Case 3 (primary awk path), updated to the #1518 loud-degrade
    // contract: the Sub-wave section exists (triggers primary awk at line 83) but is
    // immediately followed by a new ## heading before any data rows — awk enters
    // in_section=1 and exits at the next ## heading with ZERO rows emitted. Zero parsed
    // rows is not silent any more: the capture at line 166 (`_sw_rows="$(detect_subwaves
    // || true)"`) reaches the zero-row gate at lines 167-170, which prints a DEGRADE:
    // line and exits 1 — short-circuiting BEFORE the table skeleton at lines 180-188.
    // Pre-fix this shape exited 0 with an EMPTY skeleton (real instance:
    // adapter-jig-meta-launch).
    //
    // (The pre-fix script quirk this fixture used to dodge — the fallback grep chain at
    // lines 123-126 exiting 1 under set -euo pipefail on zero matches — is now the
    // DESIGNED behaviour: `|| true` at line 166 absorbs the zero-match failure so the
    // empty case reaches the loud DEGRADE gate instead of dying inside the pipeline.)
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
    // Primary awk: in_section=1 from §2, then immediately in_section=0 at §3
    // → zero rows parsed → the DEGRADE contract (script lines 166-170)
    expect(
      r.status,
      `expected non-zero exit, got ${r.status}; stdout:\n${r.stdout}`,
    ).not.toBe(0);
    expect(r.stdout).toContain('DEGRADE:');
    // No sub-wave rows are emitted, and the DEGRADE exit short-circuits before the
    // skeleton (script lines 180-188) — an empty skeleton must not print either.
    expect(r.stdout).not.toContain('  sub-wave: A');
    expect(r.stdout).not.toContain('  sub-wave: B');
    expect(r.stdout).not.toContain(TABLE_HEADER);
  });
});

// ---------------------------------------------------------------------------
// Case 4 — Table skeleton emitted iff kickoff present
// ---------------------------------------------------------------------------
describe('Case 4 — table skeleton emitted iff kickoff present and rows parsed (script lines 180-188)', () => {
  it('POSITIVE: valid kickoff with parseable rows → table header + one skeleton row emitted, exit 0', () => {
    // Targets script lines 180-188 (table skeleton emission) — reachable only when at
    // least one row parsed: since the #1518 contract the zero-row gate at lines 167-170
    // DEGRADE-exits 1 BEFORE the skeleton prints, so "skeleton still emitted when rows
    // exist" is exactly the surviving positive. The fixture therefore carries a parseable
    // id row (| A | R-phase |); the pre-fix fixture had a header+divider only, which under
    // the new contract is the Case 3 NEGATIVE shape (DEGRADE + exit 1), not a
    // skeleton-emitting kickoff.
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
        '| A | R-phase |',
        '',
      ].join('\n'),
    );
    const r = run(sandbox, 'test-umbrella');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(TABLE_HEADER);
    // One skeleton row per parsed id (script lines 186-188).
    expect(r.stdout).toContain('| A | ? | ? | ? | ? | ? | ? |');
  });

  it('NEGATIVE: missing kickoff → table header NOT emitted', () => {
    // Paired-negative: script exits early at lines 30-34 (MISSING kickoff)
    // before reaching table skeleton emission at lines 180-188.
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
describe('Case 5 — B5 fallback path: keyword filter (script lines 114-136)', () => {
  it('POSITIVE: no Sub-wave heading but rows contain orchestration keywords → sub-waves detected', () => {
    // Targets fallback path (script lines 114-136):
    //   strip_table_headers <"${KICKOFF}"        (line 123 — structural header drop)
    //   | grep -E '^\| *(\*\*)?([A-Za-z][A-Za-z0-9-]*|[0-9]+)(\*\*)? *\|'   (shape, :124)
    //   | grep -vE divider rows                   (:125)
    //   | grep -E 'R-phase|execution|wiring|Mode [AB]|...'  (keyword, :126)
    //   | while IFS='|' read ... → echo sub-wave id (:127-136)
    // "| A | R-phase |" matches the keyword grep; "| B | execution |" also matches.
    // The "| Sub-wave | Type |" header is dropped structurally (followed by a separator).
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

  it('NEGATIVE: heading present but only a header row + non-id data rows → header dropped, zero rows parse, DEGRADE exits', () => {
    // Paired-negative for Case 5's primary-arm cousin: the fixture has a "## §2 Sub-wave
    // decomposition" heading (triggers the primary awk, lines 93-113) whose table carries
    // a header row and multi-word description cells. BOTH exclusion layers are exercised:
    //   - "| Description | Notes |" is a HEADER (immediately followed by the |---|
    //     separator) → dropped by the structural look-ahead. This is what makes the old
    //     "the pattern does NOT match | Description |" claim true: pre-item-1 the
    //     letter-first first cell PARSED as the id `Description` (a silent false-green —
    //     the assertion below would fail on those helpers); post-item-1 it is dropped.
    //   - "| Some description text | … |" / "| Another description | … |" fail the id
    //     shape regex — the first cell is a multi-word phrase, and the grammar anchors a
    //     SINGLE letter-first token (or digit run) between the pipes (:102-103).
    // Zero parsed rows → the #1518 DEGRADE contract (lines 166-170): non-zero exit,
    // no sub-wave lines, no skeleton.
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
    // The header cell must NOT surface as an id (structural drop, lines 98-101), and the
    // multi-word rows fail the shape — zero parsed rows → DEGRADE + non-zero exit.
    expect(
      r.status,
      `expected non-zero exit, got ${r.status}; stdout:\n${r.stdout}`,
    ).not.toBe(0);
    expect(r.stdout).toContain('DEGRADE:');
    expect(r.stdout).not.toContain('sub-wave: Description');
    expect(r.stdout).not.toContain('| Description | ? |');
    expect(r.stdout).not.toContain(TABLE_HEADER);
  });
});

// ---------------------------------------------------------------------------
// Case 6 — Structural header drop over parseable rows (rework round 3, item 1)
// ---------------------------------------------------------------------------
describe('Case 6 — structural header drop: a |---|-followed row is a header on BOTH paths', () => {
  it('PRIMARY: | Stage | Sub-waves | … | header over S-rows yields only the S-rows', () => {
    // Regression for the recorded silent false-green (consumer-install-hardening class):
    // under the widened grammar the header's first cell `Stage` is shape-legal, so the
    // pre-item-1 primary awk (lines 93-113) emitted `sub-wave: Stage` + a garbage
    // `| Stage | ? |` skeleton row with NO DEGRADE. The look-ahead (pending buffer,
    // lines 98-101) now drops the header because the NEXT line is the |---| separator;
    // only the S-rows parse.
    const sandbox = makeSandbox();
    writeKickoff(
      sandbox,
      'test-umbrella',
      [
        '# My Umbrella',
        '',
        '## §1 Context',
        '- placeholder',
        '',
        '## §2 Sub-wave decomposition',
        '',
        '| Stage | Sub-waves | Parallel? | Depends on |',
        '|---|---|---|---|',
        '| S1 | recon | - | - |',
        '| S2 | build | - | S1 |',
        '',
      ].join('\n'),
    );
    const r = run(sandbox, 'test-umbrella');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('  sub-wave: S1');
    expect(r.stdout).toContain('  sub-wave: S2');
    // The header must appear as neither a detected id …
    expect(r.stdout).not.toContain('sub-wave: Stage');
    // … nor a skeleton row (script lines 186-188 would have printed `| Stage | ? | … |`).
    expect(r.stdout).not.toContain('| Stage | ? |');
    expect(r.stdout).toContain('| S1 | ? | ? | ? | ? | ? | ? |');
    expect(r.stdout).toContain('| S2 | ? | ? | ? | ? | ? | ? |');
  });

  it('FALLBACK: the same header carries the Sub-wave keyword — strip_table_headers drops it before the keyword filter', () => {
    // The exact recorded shape: without a Sub-wave SECTION heading the fallback chain
    // (lines 114-136) runs, and the header `| Stage | Sub-waves | … |` itself contains
    // the keyword `Sub-waves` — so pre-item-1 it PASSED the keyword grep (line 126) and
    // printed `sub-wave: Stage` silently. strip_table_headers (line 123, def 145-156)
    // applies the same look-ahead rule first, so only the keyword-bearing S-rows survive.
    const sandbox = makeSandbox();
    writeKickoff(
      sandbox,
      'test-umbrella',
      [
        '# My Umbrella',
        '',
        '## §1 Context',
        '- placeholder',
        '',
        '## §2 Tasks (no Sub-wave heading)',
        '',
        '| Stage | Sub-waves | Parallel? | Depends on |',
        '|---|---|---|---|',
        '| S1 | R-phase recon | - | - |',
        '| S2 | execution build | - | S1 |',
        '',
      ].join('\n'),
    );
    const r = run(sandbox, 'test-umbrella');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('  sub-wave: S1');
    expect(r.stdout).toContain('  sub-wave: S2');
    expect(r.stdout).not.toContain('sub-wave: Stage');
    expect(r.stdout).not.toContain('| Stage | ? |');
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
