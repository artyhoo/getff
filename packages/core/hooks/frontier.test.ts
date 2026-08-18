/**
 * Functional meta-tests for the /pipeline dependency-frontier emitter
 * (.claude/skills/pipeline/helpers/frontier.sh) — the D-H13 / spec §5.4 mechanism
 * (skill-harmonization-mechanisms umbrella stage S3, 2026-08-18).
 *
 * Channel: in-session helper invoked via `!shell` from SKILL.md §3 Step 1 (its output is
 * the mechanical input to the §3 `Stage` column and the §6 stage gate).
 * Class C at the consuming section → Class A-via-companion-test (this file is that test).
 *
 * Paired-negative contract — 24 arms. The WITH-column and WITHOUT-column halves are BOTH
 * asserted, because "degrades safely" is a claim about the absent half and nothing else
 * checks it. Every arm marked ⟨cold⟩ was added after a cold review reproduced a real wrong
 * output on the tracked kickoff corpus; each of those is a regression test, not a
 * restatement:
 *
 *   ✅ NO-ARG:          empty umbrella → quiet skip line, exit 0
 *   ❌ MISSING-KICKOFF: unknown umbrella → "MISSING kickoff: <probed path>", exit 0
 *   ✅ WITH-COLUMN:     `Depends on` present → edges resolved, frontier = deps-met set
 *   ✅ WITHOUT-COLUMN:  no column → DEGRADE line + every not-yet-done stage is frontier
 *   ✅ NO-TABLE:        no stage table at all → stages: 0 + DEGRADE, never a fake frontier
 *   ✅ RANGE ⟨cold⟩:    `S1–S4` names the whole inclusive span, not just the endpoints
 *   ✅ MARKER-DONE:     UPPERCASE marker + merge evidence in the row own cells → done=yes
 *   ❌ MARKER-NO-EVIDENCE ⟨cold⟩: the same word as prose, with no PR/date/staging nearby,
 *                       must NOT mark the row done
 *   ❌ MARKER-IN-DEP:   the marker inside the `Depends on` cell must NOT mark the row done
 *   ✅ MARKER-ATTN ⟨cold⟩: every marker-based done is echoed for the §6 gh gate
 *   ⚠️ DONE-WITH-UNMET ⟨cold⟩: done=yes while a dependency is open → WARN, not silence
 *   ✅ DONE-MD:         umbrella done.md → every stage done, frontier empty
 *   ✅ OVERRIDE-DONE:   MO_FRONTIER_DONE moves the done set forward
 *   ✅ OVERRIDE-OPEN ⟨cold⟩: MO_FRONTIER_OPEN demotes a stage that a MARKER made done —
 *                       the arm must bite on a fixture where the seam changes the answer
 *   ❌ CONTRADICTION:   an id in BOTH override lists → WARN + treated as NOT done
 *   ✅ INLINE-PIPE:     a `|` inside an inline-code span does not shred the row
 *   ❌ PREFIX:          `S1` must not resolve an edge declared on `S1b`, nor the reverse
 *   ❌ CYCLE:           mutual dependencies → WARN «no frontier», never a silent empty set
 *   ✅ UNRESOLVED:      a cell naming only out-of-table things is flagged, not dropped
 *   ✅ RESIDUE ⟨cold⟩:  a MIXED cell (in-table id + something else) echoes the remainder
 *   ✅ STAGE-N-ROWS ⟨cold⟩: `| Stage 0 |` rows are stages, not header noise
 *   ✅ HEADER-NO-PIPE ⟨cold⟩: a GFM header without the trailing `|` still detects
 *   ⚠️ ZERO-ROWS ⟨cold⟩: column present + zero parsed rows → DEGRADE + WARN, never an
 *                       empty frontier read as «nothing to dispatch»
 *   ✅ PROSE-EDGE ⟨cold⟩: an edge stated in prose outside the table is reported by line
 *
 * Spawns the real helper against on-disk fixtures in mkdtempSync sandboxes via the
 * MO_KICKOFF_DIR seam — no dependence on live repo kickoffs.
 *
 * Reference pattern: packages/core/hooks/dispatch-from-state.test.ts (vitest + spawnSync +
 * mkdtempSync; helper-only, no jq).
 *
 * T3 compliance: each arm cites the helper region it targets.
 * T-M4-B compliance: asserts exit code AND stdout content.
 * Principle 04 (no-tautology): every override arm asserts a fixture where REMOVING the seam
 * changes the output — an implementation ignoring the seam must fail.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(REPO_ROOT, '.claude/skills/pipeline/helpers/frontier.sh');

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), 'frontier-test-'));
  sandboxes.push(sandbox);
  const kickoffDir = join(sandbox, 'orchestrator-prompts');
  mkdirSync(kickoffDir, { recursive: true });
  return kickoffDir;
}

function writeKickoff(kickoffDir: string, umbrella: string, body: string): string {
  const dir = join(kickoffDir, umbrella);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'kickoff.md');
  writeFileSync(path, body, 'utf8');
  return path;
}

function runHelper(
  umbrella: string,
  kickoffDir: string,
  envOverrides: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const args = umbrella === '' ? [HELPER] : [HELPER, umbrella];
  const r = spawnSync('bash', args, {
    encoding: 'utf8',
    env: { ...process.env, MO_KICKOFF_DIR: kickoffDir, ...envOverrides },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** Extract one emitted line by its prefix, e.g. line(out, 'FRONTIER:'). */
function line(stdout: string, prefix: string): string {
  const hit = stdout.split('\n').find((l) => l.startsWith(prefix));
  return hit ?? '';
}

/** Every emitted line with this prefix (ATTN / WARN can repeat). */
function lines(stdout: string, prefix: string): string[] {
  return stdout.split('\n').filter((l) => l.startsWith(prefix));
}

/** Extract the STAGE line for one id. */
function stageLine(stdout: string, id: string): string {
  const hit = stdout.split('\n').find((l) => l.startsWith(`STAGE ${id} `));
  return hit ?? '';
}

// ── Fixture A — WITH the incumbent `Depends on` column (the tracked-corpus shape; mold:
// .claude/orchestrator-prompts/arch-v2-context-pipeline/kickoff.md:91) ────────────────────
const WITH_COLUMN = `# KICKOFF — fixture-with-column

## §1 Deliverables

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 seed | first stage, nothing before it | — |
| S2 gate | consumes S1 | S1 |
| S3 carrier | runs beside S2 | S1 |
| S4 close | needs both middles | S2 ∥ S3 |

Prose after the table must not be parsed as a row.
`;

// ── Fixture B — WITHOUT the column (the degrade half) ─────────────────────────────────────
const WITHOUT_COLUMN = `# KICKOFF — fixture-without-column

## §1 Deliverables

| Stage | Deliverable |
| --- | --- |
| S1 seed | first stage |
| S2 gate | second stage |
| S3 close | third stage |
`;

describe('frontier.sh — §3/§6 dependency-frontier emitter (paired-negative contract)', () => {
  it('NO-ARG: empty umbrella → quiet skip line, exit 0', () => {
    // Targets the `if [[ -z "${UMBRELLA}" ]]` early branch.
    const kickoffDir = makeSandbox();
    const r = runHelper('', kickoffDir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('frontier: no umbrella');
  });

  it('MISSING-KICKOFF: unknown umbrella → "MISSING kickoff: <probed path>", exit 0', () => {
    // Targets the `[[ ! -f "${KICKOFF}" ]]` branch — same wording as SKILL.md §3 Blocking rule.
    const kickoffDir = makeSandbox();
    const r = runHelper('nope', kickoffDir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('MISSING kickoff:');
    expect(r.stdout).toContain('nope/kickoff.md');
  });

  it('WITH-COLUMN: resolves edges and reports frontier = the deps-met set', () => {
    // Targets the header-detection rule (`index($0, "Depends on")`) + the edge loop in END.
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', WITH_COLUMN);
    const r = runHelper('u', kickoffDir);
    expect(r.status).toBe(0);
    expect(line(r.stdout, 'depends-column:')).toContain('present');
    expect(line(r.stdout, 'stages:')).toBe('stages: 4');
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: S1');
    expect(line(r.stdout, 'BLOCKED:')).toBe(
      'BLOCKED: S2(unmet:S1) S3(unmet:S1) S4(unmet:S2,S3)',
    );
    // `S2 ∥ S3` is one cell naming two edges — both resolved, no second spelling needed.
    expect(stageLine(r.stdout, 'S4')).toContain('deps=S2,S3');
    // The em-dash cell is a clean no-dependency answer, not an unresolved reference.
    expect(stageLine(r.stdout, 'S1')).toContain('deps=-');
    expect(stageLine(r.stdout, 'S1')).toContain('unresolved=no');
    // Prose below the table must not become a stage row.
    expect(r.stdout).not.toContain('STAGE Prose');
  });

  it('WITHOUT-COLUMN: degrades to «every not-yet-done stage is frontier» + DEGRADE line', () => {
    // Targets the fallback header branch (`h == "Stage"`) + the `if (!hdrline)` END path.
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', WITHOUT_COLUMN);
    const r = runHelper('u', kickoffDir);
    expect(r.status).toBe(0);
    expect(line(r.stdout, 'depends-column:')).toBe('depends-column: absent');
    expect(line(r.stdout, 'stages:')).toBe('stages: 3');
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: S1 S2 S3');
    expect(line(r.stdout, 'DEGRADE:')).toContain('no `Depends on` column');
    // Degrade must not fake edge knowledge it does not have.
    expect(stageLine(r.stdout, 'S2')).toContain('deps=?');
  });

  it('NO-TABLE: no stage table at all → stages: 0 + DEGRADE, never a fabricated frontier', () => {
    // Targets the `if (!fbn)` arm of the degrade path.
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', '# KICKOFF\n\nProse only, no table.\n');
    const r = runHelper('u', kickoffDir);
    expect(r.status).toBe(0);
    expect(line(r.stdout, 'stages:')).toBe('stages: 0');
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: (none)');
    expect(line(r.stdout, 'DEGRADE:')).toContain('no stage table found');
  });

  it('RANGE: `S1–S4 all merged` names the whole inclusive span, not just the endpoints', () => {
    // Cold-review BLOCKER: the incumbent corpus writes ranges — plugin-packaging S6 (`S1–S5`),
    // S8 (`S1–S7`), one-click-installer S5 (`S1–S4 all merged`). Taking only the endpoints
    // dropped the middle stages with `unresolved=no`, i.e. a stage was reported dispatchable
    // while stages it names were still open. Targets the range loop (`cand = sid[p] DASH[d] …`).
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 | a — **MERGED 2026-08-01 as PR #1** | — |
| S2 | b | S1 |
| S3 | c | S1 |
| S4 | d — **MERGED 2026-08-02 as PR #2** | S1 |
| S5 | integration | S1–S4 all merged |
`,
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S5')).toContain('deps=S1,S2,S3,S4');
    // S2 and S3 are open, so the range consumer must be BLOCKED on exactly them.
    expect(stageLine(r.stdout, 'S5')).toContain('unmet=S2,S3');
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: S2 S3');
  });

  it('MARKER-DONE: an UPPERCASE marker with merge evidence → done=yes basis=marker-unverified', () => {
    // Targets marked_done() over srow[] (every cell EXCEPT the Depends-on cell).
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S1 seed | first stage, nothing before it | — |',
        '| S1 seed | **CLOSED — MERGED 2026-08-01 as PR #1** | — |',
      ),
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S1')).toContain('done=yes basis=marker-unverified');
    // With S1 done, its two consumers become the frontier — the whole point of the mechanism.
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: S2 S3');
    expect(line(r.stdout, 'DONE:')).toBe('DONE: S1');
  });

  it('MARKER-NO-EVIDENCE: the same word as prose, with no PR/date/staging nearby, is NOT done', () => {
    // Cold-review MAJOR: arch-v2-context-pipeline S-L says «§1.3's load-bearing unknown is
    // **CLOSED**» — about a QUESTION. Reading any occurrence of the word marked an unmerged
    // stage DONE and handed its consumer to the frontier. Targets the 60-char proximity rule
    // inside marked_done().
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S1 seed | first stage, nothing before it | — |',
        "| S1 seed | build the probe — the load-bearing unknown is **CLOSED** by the spec | — |",
      ),
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S1')).toContain('done=no');
    expect(line(r.stdout, 'DONE:')).toBe('DONE: (none)');
    // The consumer must stay blocked, not inherit a phantom green.
    expect(line(r.stdout, 'BLOCKED:')).toContain('S2(unmet:S1)');
  });

  it('MARKER-IN-DEP: «S1 MERGED» inside the Depends-on cell must NOT mark the row done', () => {
    // The arch-v2-context-pipeline S-E shape (kickoff.md:91 table): a dependency cell
    // describing the EDGE as merged said nothing about the row itself. Reading it as the
    // row's own state would report an unbuilt stage as done — a false green at the gate.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S2 gate | consumes S1 | S1 |',
        '| S2 gate | consumes S1 | S1 **MERGED 2026-08-01 as PR #1** — MET |',
      ),
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S2')).toContain('done=no');
    // S1 is genuinely not done, so S2 stays blocked on it.
    expect(stageLine(r.stdout, 'S2')).toContain('unmet=S1');
  });

  it('MARKER-ATTN: every marker-based done is echoed for the §6 gh gate to confirm', () => {
    // A row-text read is not a merge proof; the ATTN line is what keeps §6 the authority.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S1 seed | first stage, nothing before it | — |',
        '| S1 seed | **MERGED 2026-08-01 as PR #1** | — |',
      ),
    );
    const r = runHelper('u', kickoffDir);
    const attn = lines(r.stdout, 'ATTN:').join('\n');
    expect(attn).toContain('marker-unverified done');
    expect(attn).toContain('S1');
    expect(attn).toContain('§6 gh check');
  });

  it('DONE-WITH-UNMET: done=yes while a dependency is open → WARN, not silence', () => {
    // Cold-review MINOR reproduced on arch-v2 S-D (`CLOSED-NULL 2026-08-06` + `Depends on:
    // S-C` open): an internally contradictory row slid into DONE with no signal.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S2 gate | consumes S1 | S1 |',
        '| S2 gate | **CLOSED-NULL 2026-08-06 per SSOT #234** | S1 |',
      ),
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S2')).toContain('done=yes');
    const warn = lines(r.stdout, 'WARN:').join('\n');
    expect(warn).toContain('contradictory row read');
    expect(warn).toContain('S2(unmet:S1)');
  });

  it('DONE-MD: umbrella done.md → every stage done=yes basis=done-md, frontier empty', () => {
    // Targets the DONE_MD probe (reuses the priority-score.sh C3 convention).
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', WITH_COLUMN);
    writeFileSync(join(kickoffDir, 'u', 'done.md'), 'Final PR: #999\n', 'utf8');
    const r = runHelper('u', kickoffDir);
    expect(line(r.stdout, 'done-md:')).toBe('done-md: yes');
    expect(stageLine(r.stdout, 'S3')).toContain('basis=done-md');
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: (none)');
  });

  it('OVERRIDE-DONE: MO_FRONTIER_DONE moves the done set forward', () => {
    // The §6 `gh pr list --search "is:merged …"` verdict is the authority; this seam is how
    // it feeds back in. Without the seam the fixture has NO done stage, so the arm bites.
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', WITH_COLUMN);

    const baseline = runHelper('u', kickoffDir);
    expect(line(baseline.stdout, 'FRONTIER:')).toBe('FRONTIER: S1');

    const forced = runHelper('u', kickoffDir, { MO_FRONTIER_DONE: 'S1,S2' });
    expect(stageLine(forced.stdout, 'S1')).toContain('done=yes basis=override');
    expect(line(forced.stdout, 'FRONTIER:')).toBe('FRONTIER: S3');
    expect(line(forced.stdout, 'BLOCKED:')).toBe('BLOCKED: S4(unmet:S3)');
  });

  it('OVERRIDE-OPEN: MO_FRONTIER_OPEN demotes a stage that a MARKER made done', () => {
    // Cold-review MAJOR (principle 04): the previous version of this arm ran the seam on a
    // stage that was already `done=no`, so the output was byte-identical with and without it
    // — an implementation ignoring MO_FRONTIER_OPEN passed. This fixture makes the seam the
    // only difference, and it is the half §6 relies on when a marker lied.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S1 seed | first stage, nothing before it | — |',
        '| S1 seed | **MERGED 2026-08-01 as PR #1** | — |',
      ),
    );

    const baseline = runHelper('u', kickoffDir);
    expect(stageLine(baseline.stdout, 'S1')).toContain('done=yes');
    expect(line(baseline.stdout, 'FRONTIER:')).toBe('FRONTIER: S2 S3');

    const reopened = runHelper('u', kickoffDir, { MO_FRONTIER_OPEN: 'S1' });
    expect(stageLine(reopened.stdout, 'S1')).toContain('done=no');
    expect(line(reopened.stdout, 'FRONTIER:')).toBe('FRONTIER: S1');
    expect(line(reopened.stdout, 'BLOCKED:')).toContain('S2(unmet:S1)');
    expect(line(reopened.stdout, 'DONE:')).toBe('DONE: (none)');
  });

  it('CONTRADICTION: an id in BOTH override lists → WARN and treated as NOT done', () => {
    // Fail-safe direction: not-done routes the claim back to the §6 gh gate.
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', WITH_COLUMN);
    const r = runHelper('u', kickoffDir, {
      MO_FRONTIER_DONE: 'S1',
      MO_FRONTIER_OPEN: 'S1',
    });
    expect(stageLine(r.stdout, 'S1')).toContain('done=no');
    const warn = lines(r.stdout, 'WARN:').join('\n');
    expect(warn).toContain('contradictory override');
    expect(warn).toContain('S1');
  });

  it('INLINE-PIPE: a `|` inside an inline-code span does not shred the row', () => {
    // Found by the T15 self-application run: this umbrella's own S2 row carries
    // `done|verified` (.claude/orchestrator-prompts/skill-harmonization-mechanisms/kickoff.md:26),
    // which a raw `|` split read as a cell boundary — the dependency cell then showed
    // mid-sentence prose and `unresolved` fired on a stage that had no dependency at all.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S2 gate | consumes S1 | S1 |',
        '| S2 gate | widen the jq filter that selects `done|verified` tasks | S1 |',
      ),
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S2')).toContain('deps=S1');
    expect(stageLine(r.stdout, 'S2')).toContain('unresolved=no');
    expect(line(r.stdout, 'stages:')).toBe('stages: 4');
  });

  it('PREFIX: `S1` must not resolve an edge declared on `S1b`, nor the reverse', () => {
    // Targets hasid()/maskid() longest-first masking — the S-D / S-D′ pair in
    // arch-v2-context-pipeline is the live case this protects.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 | first | — |
| S1b | follow-up of the follow-up | S1 |
| S2 | consumes only the b-variant | S1b |
`,
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S2')).toContain('deps=S1b');
    expect(stageLine(r.stdout, 'S2')).not.toContain('deps=S1,');
    expect(stageLine(r.stdout, 'S1b')).toContain('deps=S1');
  });

  it('CYCLE: mutual dependencies → WARN «no frontier», never a silent empty set', () => {
    // Frontier is a readiness set, not a topological sort; a cycle must be visible.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 | a | S2 |
| S2 | b | S1 |
`,
    );
    const r = runHelper('u', kickoffDir);
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: (none)');
    const warn = lines(r.stdout, 'WARN:').join('\n');
    expect(warn).toContain('no frontier');
    expect(warn).toContain('cycle');
  });

  it('UNRESOLVED: a cell naming only out-of-table things is flagged, not dropped', () => {
    // Ceiling 1: cross-umbrella edges cannot be resolved here. Silence would read as
    // «no dependencies»; the flag + the echoed raw cell keep the judgment with the reader.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S1 seed | first stage, nothing before it | — |',
        '| S1 seed | first stage | token-audit S9 merged |',
      ),
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S1')).toContain('unresolved=yes');
    expect(stageLine(r.stdout, 'S1')).toContain('raw="token-audit S9 merged"');
    expect(line(r.stdout, 'UNRESOLVED:')).toBe('UNRESOLVED: S1');
    // Degrade-safe: an unresolvable edge does not silently block the stage.
    expect(line(r.stdout, 'FRONTIER:')).toContain('S1');
  });

  it('RESIDUE: a MIXED cell echoes what did not resolve instead of dropping it', () => {
    // Cold-review MAJOR reproduced on arch-v2 S-E: `S-G merged + token-audit S1 merged`
    // resolved the in-table id and discarded the cross-umbrella arc with `unresolved=no`,
    // which the shipped doc claimed could not happen. The remainder is now echoed verbatim.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      WITH_COLUMN.replace(
        '| S2 gate | consumes S1 | S1 |',
        '| S2 gate | consumes S1 | S1 merged + token-audit S9 merged |',
      ),
    );
    const r = runHelper('u', kickoffDir);
    expect(stageLine(r.stdout, 'S2')).toContain('deps=S1');
    expect(stageLine(r.stdout, 'S2')).toContain('residue="token-audit S9"');
    expect(line(r.stdout, 'RESIDUE:')).toBe('RESIDUE: S2');
  });

  it('STAGE-N-ROWS: `| Stage 0 |` rows are stages, not header noise', () => {
    // Cold-review MAJOR: dispatcher-skill-meta-launch/kickoff.md:33-35 uses `| Stage 0 |`,
    // `| Stage 1 |`, `| Stage 2 |`. The bare-first-token id collided with the header word,
    // every row was dropped, and the helper claimed «no stage table found».
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| Stage 0 | research | — |
| Stage 1 | build | Stage 0 |
`,
    );
    const r = runHelper('u', kickoffDir);
    expect(line(r.stdout, 'stages:')).toBe('stages: 2');
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: Stage 0');
    expect(line(r.stdout, 'BLOCKED:')).toBe('BLOCKED: Stage 1(unmet:Stage 0)');
  });

  it('HEADER-NO-PIPE: a GFM header without the trailing `|` still detects the column', () => {
    // Cold-review MAJOR (off-by-one, `i < nf`): the last header cell was never inspected, so
    // a valid GFM table silently took the no-column degrade path and reported every blocked
    // stage as frontier. `.claude/orchestrator-prompts/**` is outside the prettier surface,
    // so the shape is one keystroke away.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF

| Stage | Deliverable | Depends on
| --- | --- | --- |
| S1 seed | first | — |
| S2 gate | consumes S1 | S1 |
`,
    );
    const r = runHelper('u', kickoffDir);
    expect(line(r.stdout, 'depends-column:')).toContain('present');
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: S1');
    expect(line(r.stdout, 'BLOCKED:')).toBe('BLOCKED: S2(unmet:S1)');
    expect(line(r.stdout, 'DEGRADE:')).toBe('');
  });

  it('ZERO-ROWS: column present + zero parsed rows → DEGRADE + WARN, never an empty frontier', () => {
    // Cold-review MAJOR: a recognised header whose rows the parser cannot read produced
    // `FRONTIER: (none)` with no DEGRADE and no WARN — the silent empty answer ceiling 4
    // declares impossible. Targets the `if (nst == 0)` guard on the with-column branch.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF

| Stage | Deliverable | Depends on |
| --- | --- | --- |
`,
    );
    const r = runHelper('u', kickoffDir);
    expect(line(r.stdout, 'stages:')).toBe('stages: 0');
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: (none)');
    expect(line(r.stdout, 'DEGRADE:')).toContain('zero stage rows parsed');
    expect(line(r.stdout, 'WARN:')).toContain('unrecognised');
  });

  it('PROSE-EDGE: an edge stated outside the table is reported with its line number', () => {
    // Cold-review MAJOR: 11 of the 27 tracked kickoffs that mention the edge state it as a
    // prose header line — meta-orchestrator-bundle-autonomous/kickoff.md:5 even says «Do NOT
    // dispatch this umbrella before …» while the degrade line said every stage is frontier.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF

> **Depends on:** the other umbrella Stage 5. **Do NOT dispatch before it ships.**

Prose only, no stage table.
`,
    );
    const r = runHelper('u', kickoffDir);
    const attn = lines(r.stdout, 'ATTN:').join('\n');
    expect(attn).toContain('prose dependency line(s) at :3');
    expect(attn).toContain('NOT parsed');
    expect(line(r.stdout, 'DEGRADE:')).toContain('no stage table found');
  });
});
