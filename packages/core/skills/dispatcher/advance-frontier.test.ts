/**
 * Functional meta-tests for the /dispatcher §2.7 advance-frontier verdict helper
 * (.claude/skills/dispatcher/helpers/advance-frontier.sh) — frontier-residue-sweep S1
 * (2026-08-18). The helper is a pure CONSUMER of the /pipeline-owned emitter
 * (.claude/skills/pipeline/helpers/frontier.sh): it derives one ADVANCE/HALT/COMPLETE
 * verdict from the emitter's recorded output and never re-implements dependency
 * parsing (arm DELEGATION below asserts that from the helper's source).
 *
 * Channel: in-session helper invoked from dispatcher/SKILL.md §2.7 «Advance» — the
 * step that previously picked the next stage by eye (#hope-as-gate,
 * attention-is-not-a-mechanism.md §1).
 *
 * Paired-negative contract — the arms where the helper must REFUSE to advance are as
 * load-bearing as the arms where it advances:
 *
 *   ✅ FRESH-FRONTIER:        deps-met set → ADVANCE <first table-order id> + FRONTIER-SET all
 *   ✅ TABLE-ORDER-AFTER-DONE: MO_FRONTIER_DONE=S1 → ADVANCE S2, dependents unblock into the set
 *   ❌ MARKER-LIES-HALT (T-FRS1-B): basis=marker-unverified done → HALT-VERIFY <ids>, NEVER
 *                       ADVANCE a consumer — `done=yes basis=marker-unverified` is not a
 *                       merge proof (kickoff §3 constraint 2)
 *   ✅ MARKER-LIES-OPEN:      MO_FRONTIER_OPEN refutes the marker → the stage itself returns
 *                       to the frontier (see the deviation note in the arm — the plan
 *                       sketched HALT-BLOCKED, the emitter's contract says otherwise)
 *   ✅ MARKER-LIES-DONE:      MO_FRONTIER_DONE confirms the marker → consumer advances
 *   ✅ DONE-MD:               umbrella done.md → COMPLETE
 *   ✅ NO-COLUMN:             emitter degrade → ADVANCE-DEGRADE, never a silent pick
 *   ✅ CYCLE:                 no frontier while stages remain → HALT-BLOCKED
 *   ✅ ALL-DONE:              every stage done, no done.md → COMPLETE (§2.8 territory)
 *   ✅ NO-ARG:                missing umbrella → ADVANCE-INCOMPLETE (unasked ≠ answered)
 *   ✅ DELEGATION:            helper source invokes frontier.sh and carries no marker
 *                       parsing of its own — bindings, not a fork (kickoff §3 constraint 1)
 *   ✅ SKILL-WIRING:          dispatcher SKILL.md §2.7 names the helper + every verdict;
 *                       §2.6 `is:merged` stays the merge authority (T-FRS1-B, skill half)
 *   ✅ NIGHT-WIRING:          night-mode delegates stage-gate mechanics to §2.7 (S1 scope)
 *
 * Spawns the real helper against on-disk fixtures in mkdtempSync sandboxes via the
 * MO_KICKOFF_DIR seam — no dependence on live repo kickoffs.
 *
 * Reference pattern: packages/core/hooks/frontier.test.ts (vitest + spawnSync +
 * mkdtempSync; helper-only).
 *
 * T3 compliance: each arm cites the helper region it targets.
 * Principle 04 (no-tautology): every seam arm asserts a fixture where REMOVING the seam
 * changes the verdict — an implementation ignoring MO_FRONTIER_DONE/OPEN must fail.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../..');
const HELPER = resolve(REPO_ROOT, '.claude/skills/dispatcher/helpers/advance-frontier.sh');
const DISPATCHER_SKILL = readFileSync(
  resolve(REPO_ROOT, '.claude/skills/dispatcher/SKILL.md'),
  'utf8',
);
const NIGHT_SKILL = readFileSync(resolve(REPO_ROOT, '.claude/skills/night-mode/SKILL.md'), 'utf8');

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), 'advance-frontier-test-'));
  sandboxes.push(sandbox);
  const kickoffDir = join(sandbox, 'orchestrator-prompts');
  mkdirSync(kickoffDir, { recursive: true });
  return kickoffDir;
}

function writeKickoff(kickoffDir: string, umbrella: string, body: string): void {
  const dir = join(kickoffDir, umbrella);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'kickoff.md'), body, 'utf8');
}

function runAdvance(
  umbrella: string,
  kickoffDir: string,
  envOverrides: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const env: Record<string, string | undefined> = { ...process.env, MO_KICKOFF_DIR: kickoffDir };
  // Seam hygiene: a stray ambient MO_FRONTIER_* would silently change the verdict.
  delete env.MO_FRONTIER_DONE;
  delete env.MO_FRONTIER_OPEN;
  Object.assign(env, envOverrides);
  const args = umbrella === '' ? [HELPER] : [HELPER, umbrella];
  const r = spawnSync('bash', args, { encoding: 'utf8', env: env as NodeJS.ProcessEnv });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

// Verdict prefixes, longest-first so ADVANCE never swallows ADVANCE-INCOMPLETE/DEGRADE.
const VERDICT_PREFIXES = [
  'ADVANCE-INCOMPLETE',
  'ADVANCE-DEGRADE',
  'HALT-VERIFY',
  'HALT-BLOCKED',
  'COMPLETE',
  'ADVANCE',
];

/** The single verdict line (the helper's contract: exactly one, after the teed output). */
function verdict(stdout: string): string {
  return stdout.split('\n').find((l) => VERDICT_PREFIXES.some((v) => l.startsWith(v))) ?? '';
}

/** Extract one emitted line by its prefix. */
function line(stdout: string, prefix: string): string {
  return stdout.split('\n').find((l) => l.startsWith(prefix)) ?? '';
}

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────
// Five stages; S3–S5 depend on S1, so the fresh frontier is {S1, S2} and every verdict
// below is reachable by moving only S1's done-state (the marker-lies triple) or the
// table's shape. Mirrors the tracked-corpus mold (arch-v2-context-pipeline kickoff §1).
const BASIC = `# KICKOFF — fixture-basic

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 | seed | — |
| S2 | gate | — |
| S3 | carrier | S1 |
| S4 | close | S1 |
| S5 | integration | S1 |
`;

// The marker-lies shape: an UPPERCASE done marker + merge evidence in S1's own cell —
// the emitter reads it done=yes basis=marker-unverified WITHOUT proving the merge.
const MARKER_LIE = BASIC.replace(
  '| S1 | seed | — |',
  '| S1 | seed — **MERGED 2026-08-01 as PR #999** | — |',
);

describe('advance-frontier.sh — §2.7 verdict helper (paired-negative contract)', () => {
  it('FRESH-FRONTIER: deps-met set → ADVANCE first table-order id + FRONTIER-SET all', () => {
    // Targets the final ADVANCE branch: first id of FRONTIER: + the FRONTIER-SET satellite.
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', BASIC);
    const r = runAdvance('u', kickoffDir);
    expect(r.status).toBe(0);
    // The emitter's output is teed in full — the verdict is derived from recorded output.
    expect(line(r.stdout, 'FRONTIER:')).toBe('FRONTIER: S1 S2');
    expect(verdict(r.stdout)).toBe('ADVANCE: S1');
    expect(line(r.stdout, 'FRONTIER-SET:')).toBe('FRONTIER-SET: S1 S2');
  });

  it('TABLE-ORDER-AFTER-DONE: MO_FRONTIER_DONE=S1 → ADVANCE S2, dependents unblock', () => {
    // Targets the seam passthrough: the verdict must follow the emitter's seam-shifted
    // frontier (S2 first in table order; S3–S5 now deps-met → in FRONTIER-SET).
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', BASIC);
    const r = runAdvance('u', kickoffDir, { MO_FRONTIER_DONE: 'S1' });
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toBe('ADVANCE: S2');
    expect(line(r.stdout, 'FRONTIER-SET:')).toBe('FRONTIER-SET: S2 S3 S4 S5');
  });

  it('MARKER-LIES-HALT (T-FRS1-B): marker-unverified done → HALT-VERIFY, never ADVANCE', () => {
    // Targets the ATTN marker-unverified branch. The core S1 constraint: done=yes
    // basis=marker-unverified is a row-text READ, not a merge proof — a consumer stage
    // must not advance on it. Removing this branch must fail this arm (no-tautology).
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', MARKER_LIE);
    const r = runAdvance('u', kickoffDir);
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toMatch(/^HALT-VERIFY: S1 /);
    // The halt carries the re-entry recipe — the §2.6 gh check + the seam re-run.
    expect(verdict(r.stdout)).toContain('§2.6');
    expect(verdict(r.stdout)).toContain('MO_FRONTIER_DONE');
    // And it NEVER renders as a clean advance of the consumer stages.
    expect(r.stdout).not.toContain('ADVANCE: S2');
  });

  it('MARKER-LIES-OPEN: MO_FRONTIER_OPEN refutes the marker → the stage returns to the frontier', () => {
    // DEVIATION NOTE (documented, deliberate): the plan sketched HALT-BLOCKED here, but
    // the emitter's contract returns an OPEN-demoted stage whose own deps are met TO THE
    // FRONTIER (frontier.sh END block) — it is dispatchable again, not blocked. Forcing
    // HALT-BLOCKED would require the consumer to re-derive blocked-ness itself, i.e. fork
    // the emitter's dependency model — forbidden by kickoff §3 constraint 1. The open-PR
    // hazard this verdict could hide is caught one step earlier by the §2.0 probe
    // (probe-inflight.sh fires IN-FLIGHT on a live PR for the stage).
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', MARKER_LIE);
    const r = runAdvance('u', kickoffDir, { MO_FRONTIER_OPEN: 'S1' });
    expect(r.status).toBe(0);
    // S2 is deps-free, so it keeps its frontier seat next to the returned S1 — the
    // load-bearing half is that the REFUTED stage itself is dispatchable again.
    expect(verdict(r.stdout)).toBe('ADVANCE: S1');
    expect(line(r.stdout, 'FRONTIER-SET:')).toBe('FRONTIER-SET: S1 S2');
  });

  it('MARKER-LIES-DONE: MO_FRONTIER_DONE confirms the marker → consumer advances', () => {
    // Targets the same seam in the confirming direction — §2.6 answered "merged".
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', MARKER_LIE);
    const r = runAdvance('u', kickoffDir, { MO_FRONTIER_DONE: 'S1' });
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toBe('ADVANCE: S2');
    expect(line(r.stdout, 'FRONTIER-SET:')).toBe('FRONTIER-SET: S2 S3 S4 S5');
  });

  it('DONE-MD: umbrella done.md → COMPLETE', () => {
    // Targets the done-md branch (first-match-wins over anything the table says).
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', BASIC);
    writeFileSync(join(kickoffDir, 'u', 'done.md'), 'closed\n', 'utf8');
    const r = runAdvance('u', kickoffDir);
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toBe('COMPLETE: umbrella closed (done.md)');
  });

  it('NO-COLUMN: emitter degrade → ADVANCE-DEGRADE, never a silent pick', () => {
    // Targets the DEGRADE branch — degraded ordering must surface as judgment + record,
    // not as a confident ADVANCE the emitter's evidence cannot support.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF — fixture-nocol

| Stage | Deliverable |
| --- | --- |
| S1 | seed |
| S2 | gate |
`,
    );
    const r = runAdvance('u', kickoffDir);
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toMatch(/^ADVANCE-DEGRADE: /);
    expect(r.stdout).toContain('DEGRADE:');
  });

  it('CYCLE: no frontier while stages remain → HALT-BLOCKED', () => {
    // Targets the FRONTIER: (none) + BLOCKED ≠ (none) branch.
    const kickoffDir = makeSandbox();
    writeKickoff(
      kickoffDir,
      'u',
      `# KICKOFF — fixture-cycle

| Stage | Deliverable | Depends on |
| --- | --- | --- |
| S1 | seed | S2 |
| S2 | gate | S1 |
`,
    );
    const r = runAdvance('u', kickoffDir);
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toMatch(/^HALT-BLOCKED: /);
  });

  it('ALL-DONE: every stage done, no done.md → COMPLETE (§2.8 territory)', () => {
    // Targets the FRONTIER: (none) + DONE ≠ (none) branch.
    const kickoffDir = makeSandbox();
    writeKickoff(kickoffDir, 'u', BASIC);
    const r = runAdvance('u', kickoffDir, { MO_FRONTIER_DONE: 'S1 S2 S3 S4 S5' });
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toMatch(/^COMPLETE: all stages done/);
  });

  it('NO-ARG: missing umbrella → ADVANCE-INCOMPLETE', () => {
    // Targets the no-arg early branch — an unasked question never renders as an answer.
    const kickoffDir = makeSandbox();
    const r = runAdvance('', kickoffDir);
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toBe('ADVANCE-INCOMPLETE: no umbrella argument');
  });

  it('MISSING-KICKOFF: unknown umbrella → ADVANCE-INCOMPLETE with the probed path', () => {
    // Targets the MISSING kickoff branch.
    const kickoffDir = makeSandbox();
    const r = runAdvance('nope', kickoffDir);
    expect(r.status).toBe(0);
    expect(verdict(r.stdout)).toMatch(/^ADVANCE-INCOMPLETE: kickoff not found \(.*nope\/kickoff\.md\)/);
  });

  it('DELEGATION: pure consumer — invokes frontier.sh, never re-derives done-ness', () => {
    // Kickoff §3 constraint 1 as an executable assertion: the helper BINDS to the
    // emitter. A fork would show up as (a) no emitter reference, or (b) marker parsing
    // of its own (the UPPERCASE done-marker vocabulary), or (c) a `gh` call (the §2.6
    // merge authority stays in the skill's judgment step — a deterministic helper has
    // no auth and no business re-implementing it).
    const src = readFileSync(HELPER, 'utf8');
    expect(src).toContain('pipeline/helpers/frontier.sh');
    // The no-fork assertions run on the EXECUTABLE body — comments may legitimately
    // cite §2.6's gh command and the emitter's marker vocabulary.
    const body = src
      .split('\n')
      .filter((l) => !/^\s*#/.test(l))
      .join('\n');
    expect(body).not.toMatch(/MERGED|RETIRED|CLOSED/); // no own done-marker parser
    expect(body).not.toMatch(/\bgh\s+(pr|issue|api)\b/); // no own merge check
  });

  it('SKILL-WIRING: dispatcher SKILL.md §2.7 binds the helper + every verdict; §2.6 authority retained', () => {
    // The wiring arm (T-FRS1-A's skill half): §2.7 must NAME the helper and enumerate
    // the verdicts it can emit, and the §2.6 `is:merged` check must stay the merge
    // authority (T-FRS1-B). Goes red until the §2.7 rewrite lands.
    expect(DISPATCHER_SKILL).toContain('helpers/advance-frontier.sh');
    for (const v of VERDICT_PREFIXES) {
      expect(DISPATCHER_SKILL).toContain(v);
    }
    expect(DISPATCHER_SKILL).toContain('MO_FRONTIER_DONE');
    expect(DISPATCHER_SKILL).toContain('MO_FRONTIER_OPEN');
    expect(DISPATCHER_SKILL).toContain('is:merged');
  });

  it('NIGHT-WIRING: night-mode delegates stage-gate mechanics to §2.7', () => {
    // night-mode/SKILL.md's substrate-choice paragraph must carry the §2.7 pointer —
    // night dispatches through the same advance step, never a second stage-picker.
    expect(NIGHT_SKILL).toContain('§2.7');
  });
});
