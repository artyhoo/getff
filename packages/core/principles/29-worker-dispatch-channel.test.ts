/**
 * Principle 29 — `#umbrella-execution-launch-without-operator` channel-discipline gate
 * (M6, CI half; formerly `#worker-dispatch-via-subagent` — renamed 2026-10-04,
 * plain-words-recap-v2 D6).
 *
 * Source: .claude/skills/pipeline/SKILL.md §5 `#umbrella-execution-launch-without-operator`
 *         docs/meta-factory/research-patches/2026-06-27-meta-orch-channel-discipline-mechanism.md
 *         (Stage A R-phase — M6 design, candidate matrix, regex sketch, escape-token)
 *
 * Invariant: no TRACKED `.claude/orchestrator-prompts/<umbrella>/kickoff.md` may
 * carry an unescaped line that instructs Agent-tool write-dispatch of a Worker.
 * This is the harness-agnostic backstop of the dual pair — it fires for every PR
 * via CI regardless of who authored the kickoff or in what tool. The edit-time
 * half (.claude/hooks/check-worker-dispatch-channel.sh) moves the same single
 * matcher (29-worker-dispatch-channel.ts) earlier, to the authoring session.
 *
 * @dual-pair: channel-discipline-worker-dispatch
 *
 * Paired-negative (T15 recursive self-application + T2): the matcher MUST fire on
 * the §1 ground-truth fixture and MUST stay silent on a clean / read-only / escaped
 * kickoff — proving the gate actually discriminates (a test that cannot fail on the
 * violation does not enforce). Kickoffs are TRACKED (.gitignore:18), so this scan
 * reaches them in CI via `git ls-files` — unlike principle 12, which reads the
 * directory and skips in CI.
 *
 * Slot 29 rationale: slots 01-28 occupied as of 2026-06-27.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lineIsViolation,
  findViolations,
  FIXTURE_POSITIVE,
  FIXTURE_CLEAN,
  FIXTURE_READONLY,
  FIXTURE_ESCAPED,
  ESCAPE_TOKEN,
} from './29-worker-dispatch-channel.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

/** Tracked kickoffs only (CI-robust). Empty list (no git / fresh tree) is a valid state. */
function trackedKickoffs(): string[] {
  try {
    const out = execFileSync(
      'git',
      ['ls-files', '-z', '.claude/orchestrator-prompts/*/kickoff.md'],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    );
    return out.split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

describe('Principle 29 — kickoffs do not instruct Agent-tool write-dispatch of a Worker', () => {
  // ---- Paired-negative: prove the matcher DISCRIMINATES (non-tautological) ----
  it('FIRES on the §1 ground-truth fixture (positive)', () => {
    expect(lineIsViolation(FIXTURE_POSITIVE)).toBe(true);
  });

  it('SILENT on a clean kickoff line', () => {
    expect(lineIsViolation(FIXTURE_CLEAN)).toBe(false);
  });

  it('SILENT on a legitimate read-only Agent dispatch (clause c)', () => {
    expect(lineIsViolation(FIXTURE_READONLY)).toBe(false);
  });

  it('SILENT when the escape token is present on the line (clause d)', () => {
    expect(lineIsViolation(FIXTURE_ESCAPED)).toBe(false);
  });

  it('anti-tautology: the fixture stops firing once the escape token is appended', () => {
    expect(lineIsViolation(FIXTURE_POSITIVE)).toBe(true);
    const escaped = `${FIXTURE_POSITIVE} <!-- ${ESCAPE_TOKEN} historical pre-rule quote -->`;
    expect(lineIsViolation(escaped)).toBe(false);
  });

  it('each clause is load-bearing (removing any one makes the fixture stop firing)', () => {
    // (a) drop the Agent-tool channel signal → silent
    expect(lineIsViolation('Dispatch Worker in a fresh session, isolation: worktree')).toBe(false);
    // (b) drop the Worker target → silent
    expect(lineIsViolation('Run the review via Agent tool with model: opus')).toBe(false);
    // (c) add read-only context → silent
    expect(
      lineIsViolation('Dispatch Worker via Agent tool (read-only research subagent, text return)'),
    ).toBe(false);
  });

  it('blank / unrelated content never fires', () => {
    expect(findViolations('')).toHaveLength(0);
    expect(findViolations('# Kickoff\n\nStage 1 — Mode A inline session.\n')).toHaveLength(0);
  });

  // ---- Live-tree sweep: every tracked kickoff is clean (or explicitly escaped) ----
  const kickoffs = trackedKickoffs();

  it.skipIf(kickoffs.length === 0)(
    'all tracked kickoffs are free of unescaped Agent-tool write-dispatch instructions',
    () => {
      const violations: string[] = [];
      for (const rel of kickoffs) {
        const hits = findViolations(readFileSync(resolve(REPO_ROOT, rel), 'utf8'));
        for (const h of hits) {
          violations.push(`${rel}:${h.line}  ${h.text}`);
        }
      }
      expect(
        violations,
        `Kickoffs instruct Agent-tool write-dispatch of a Worker ` +
          `(append "<!-- ${ESCAPE_TOKEN} <reason> -->" if a line legitimately quotes/teaches the rule):\n` +
          violations.join('\n'),
      ).toHaveLength(0);
    },
  );
});

/**
 * Corpus snapshot arm (plain-words-recap-v2 S5, kickoff-s5 §5 — the precondition is
 * a TEST, not a PR-body listing): runs the matcher over the BROAD tracked corpus
 * (glob "kickoff*.md" at any depth under .claude/orchestrator-prompts — 430 files at
 * capture vs the 352 the narrow sweep above reaches) and compares the per-file
 * violating-line VECTOR against the committed fixture `fixtures/29-corpus-verdicts.json`.
 *
 * This arm asserts a VECTOR, not zero violations: the capture-time matcher already
 * fires on exactly one corpus line, and every later flip — from the D6 narrowing or
 * from any future matcher/kickoff edit — must surface here as a red test whose fix
 * is a REVIEWED diff of the snapshot, each flip adjudicated (real violation → fix
 * the kickoff or add the escape token; false positive → matcher change; legitimate
 * → regenerate). A silent drift would be the `#warning-nobody-reads` shape the
 * snapshot exists to replace.
 *
 * Capture mode (repo precedent: SNAPSHOT_MODE=capture tests/install-sh/snapshot.sh):
 *   SNAPSHOT_MODE=capture npx vitest run packages/core/principles/29-worker-dispatch-channel.test.ts
 * rewrites the fixture from the live tree. Capture is deliberate and loud — never a
 * substitute for adjudicating the flips that forced it.
 */

/** Violating-line vector for the tracked broad corpus: relpath → sorted 1-based lines (non-empty only). */
function corpusVector(files: string[]): Record<string, number[]> {
  const vector: Record<string, number[]> = {};
  for (const rel of files) {
    const hits = findViolations(readFileSync(resolve(REPO_ROOT, rel), 'utf8')).map((h) => h.line);
    if (hits.length) vector[rel] = hits;
  }
  return vector;
}

/** Tracked broad corpus: any depth under .claude/orchestrator-prompts, basename kickoff*.md. */
function trackedBroadCorpus(): string[] {
  try {
    const out = execFileSync('git', ['ls-files', '-z', '--', '.claude/orchestrator-prompts'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    return out.split('\0').filter((f) => /(^|\/)kickoff[^/]*\.md$/.test(f));
  } catch {
    return [];
  }
}

/** Compare snapshot vs live vector; return one human-readable line per flip (empty = identical). */
function diffVectors(
  expected: Record<string, number[]>,
  actual: Record<string, number[]>,
): string[] {
  const flips: string[] = [];
  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();
  for (const k of keys) {
    const e = (expected[k] ?? []).join(', ');
    const a = (actual[k] ?? []).join(', ');
    if (e === a) continue;
    if (e.length === 0) flips.push(`NEW violations   ${k}: [${a}]`);
    else if (a.length === 0) flips.push(`GONE             ${k}: snapshot had [${e}]`);
    else flips.push(`CHANGED          ${k}: snapshot [${e}] → now [${a}]`);
  }
  return flips;
}

describe('Principle 29 — corpus snapshot arm (broad kickoff corpus)', () => {
  const SNAPSHOT_PATH = resolve(HERE, 'fixtures/29-corpus-verdicts.json');
  const SNAPSHOT_GENERATE_HINT =
    'SNAPSHOT_MODE=capture npx vitest run packages/core/principles/29-worker-dispatch-channel.test.ts';
  const CAPTURE = process.env.SNAPSHOT_MODE === 'capture';
  const broad = trackedBroadCorpus();

  it.skipIf(broad.length === 0)(
    'verdict vector matches the committed snapshot (every flip is a reviewed snapshot diff)',
    () => {
      const actual = corpusVector(broad);
      if (CAPTURE) {
        const snap = existsSync(SNAPSHOT_PATH)
          ? JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
          : {};
        writeFileSync(
          SNAPSHOT_PATH,
          `${JSON.stringify(
            {
              ...snap,
              captured: new Date().toISOString().slice(0, 10),
              glob: '.claude/orchestrator-prompts/**/kickoff*.md (tracked only)',
              corpusSize: broad.length,
              regenerate: SNAPSHOT_GENERATE_HINT,
              vector: Object.fromEntries(Object.entries(actual).sort(([a], [b]) => a.localeCompare(b))),
            },
            null,
            2,
          )}\n`,
        );
        return;
      }
      expect(existsSync(SNAPSHOT_PATH), 'snapshot missing — generate it: ' + SNAPSHOT_GENERATE_HINT).toBe(true);
      const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { vector?: Record<string, number[]> };
      const flips = diffVectors(snap.vector ?? {}, actual);
      expect(
        flips,
        `Corpus verdict vector drifted from fixtures/29-corpus-verdicts.json. Every flip ` +
          `needs a reviewed snapshot diff — adjudicate each (real violation → fix the kickoff ` +
          `or append "<!-- ${ESCAPE_TOKEN} <reason> -->"; false positive → matcher change; ` +
          `legitimate → regenerate). Regenerate ONLY after adjudication:\n` +
          `  ${SNAPSHOT_GENERATE_HINT}\n` +
          flips.join('\n'),
      ).toHaveLength(0);
    },
  );

  it('comparator discriminates (paired-negative for the snapshot arm itself)', () => {
    expect(diffVectors({ 'a.md': [1] }, { 'a.md': [1] })).toHaveLength(0);
    expect(diffVectors({ 'a.md': [1] }, { 'a.md': [1, 2] })).toEqual([
      'CHANGED          a.md: snapshot [1] → now [1, 2]',
    ]);
    expect(diffVectors({ 'a.md': [1] }, { 'a.md': [2] })).toHaveLength(1);
    expect(diffVectors({}, { 'b.md': [3] })).toEqual(['NEW violations   b.md: [3]']);
    expect(diffVectors({ 'c.md': [4] }, {})).toEqual(['GONE             c.md: snapshot had [4]']);
  });
});
