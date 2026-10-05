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
 * carry an unescaped line that PRESCRIBES auto-launch of a stage's execution — an
 * imperative/Agent-tool write-Worker dispatch directive (clause (e), the 2026-10-04 D6
 * narrowing). A kickoff that hands a subagent a reading/review task PASSES, and so does
 * third-person teaching prose — mere mentions no longer fire.
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
import { performance } from 'node:perf_hooks';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lineIsViolation,
  findViolations,
  FIXTURE_POSITIVE,
  FIXTURE_CLEAN,
  FIXTURE_READONLY,
  FIXTURE_ESCAPED,
  ESCAPE_TOKEN,
  CHANNEL_RE,
  WRITE_WORKER_RE,
  READONLY_CONTEXT_RE,
  ESCAPE_TOKEN_RE,
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
    expect(
      lineIsViolation(
        'Dispatch Worker in a fresh session, isolation: worktree',
      ),
    ).toBe(false);
    // (b) drop the Worker target → silent
    expect(
      lineIsViolation('Run the review via Agent tool with model: opus'),
    ).toBe(false);
    // (c) add read-only context → silent
    expect(
      lineIsViolation(
        'Dispatch Worker via Agent tool (read-only research subagent, text return)',
      ),
    ).toBe(false);
    // (e) drop the prescription signal → the D6-narrowed gate falls silent where the
    // pre-narrowing conjunction (a∧b∧¬c∧¬d) still fired — mere mentions pass
    const descriptive =
      'The Agent tool dispatched a Worker last sprint for a smoke check';
    expect(lineIsViolation(descriptive)).toBe(false);
    expect(
      CHANNEL_RE.test(descriptive) &&
        WRITE_WORKER_RE.test(descriptive) &&
        !READONLY_CONTEXT_RE.test(descriptive) &&
        !ESCAPE_TOKEN_RE.test(descriptive),
    ).toBe(true);
  });

  // ---- D6 narrowing (plain-words-recap-v2 S5, kickoff §5(d) + §8 paired positive) ----

  it('PAIRED POSITIVE (§8): a synthetic kickoff prescribing Agent-tool dispatch of a WRITE worker, WITHOUT the words «umbrella stage», goes RED', () => {
    // The narrowing's falsifier (kickoff-s5 §9): if this passes, R-7 is broken and the
    // class the gate exists for is re-opened. Bullet-imperative shape — kickoffs
    // prescribe in bullets, and the prescription clause is bullet-aware by design.
    const synthetic = [
      '# Wave kickoff — stage 3',
      '',
      '- Spawn the implement Worker with the Agent tool (`isolation: worktree`) and let it run the stage end-to-end.',
      '- Report back with the harvest draft.',
    ].join('\n');
    const hits = findViolations(synthetic);
    expect(
      hits,
      `write-worker prescription must fire:\n${hits.map((h) => `${h.line}: ${h.text}`).join('\n')}`,
    ).not.toHaveLength(0);
    expect(hits.map((h) => h.line)).toEqual([3]);
    // The T7 adversarial counter-prompt (plain-words-recap-v2 S5) found the first clause
    // set let passive/declarative prescriptions through — these are the regression guards
    // for the tightened families P3 / P3f / P4 (29-worker-dispatch-channel.ts clause (e)).
    expect(
      lineIsViolation(
        'The stage Worker is dispatched via the Agent tool with isolation: worktree.',
      ),
    ).toBe(true); // P3 — present-passive plan statement
    expect(
      lineIsViolation(
        'The Worker will be dispatched via the Agent tool once the R-phase lands.',
      ),
    ).toBe(true); // P3f — future-passive plan statement
    expect(
      lineIsViolation(
        'We dispatch the write-task Worker via the Agent tool at stage entry.',
      ),
    ).toBe(true); // P4 — agent-subject declarative
    // T19 cold review (own adversarial pass, same stage) measured two more false negatives
    // against the first clause set — the regression guards for P5 and the P3 verb extension
    // (29-worker-dispatch-channel.ts clause (e), second tuning round).
    expect(
      lineIsViolation(
        'Use the Agent tool to spawn the implementation Worker (worktree).',
      ),
    ).toBe(true); // P5 — the imperative wrapper no line-anchored family reaches
    expect(
      lineIsViolation('The write Worker is spawned via the Agent tool.'),
    ).toBe(true); // P3 — spawned
    expect(
      lineIsViolation('The stage Worker is launched via the Agent tool.'),
    ).toBe(true); // P3 — launched
    expect(
      lineIsViolation(
        'The implementation is delegated to a subagent via the Agent tool (write task).',
      ),
    ).toBe(true); // P3 — delegated (the cold reviewer's own third sample)
  });

  it('NEGATIVE (§5): a kickoff that hands a subagent a reading/review task PASSES', () => {
    const synthetic = [
      '# Wave kickoff — stage 3 R-phase',
      '',
      '- Run a cold review of the plan diff via the Agent tool (read-only reviewer, text return).',
      '- No writes; findings go into the research output only.',
    ].join('\n');
    expect(findViolations(synthetic)).toHaveLength(0);
  });

  it('D6 narrowing: third-person teaching prose is NOT a prescription (the :205 flip class)', () => {
    // The exact corpus line the pre-narrowing matcher fired on (snapshot fixture,
    // commit 814bed03a) — this repo's own kickoff teaching text about the gate.
    const teaching =
      '**write-task** case: a kickoff prescribing Agent-tool dispatch of a WRITE worker without the words';
    expect(lineIsViolation(teaching)).toBe(false);
    // The escape token is NOT what exempts it — the prescription clause is. A teaching
    // line must not need opt-out comments (that was the pre-narrowing tax).
    expect(ESCAPE_TOKEN_RE.test(teaching)).toBe(false);
    // History notes stay silent too — past forms are deliberately outside P3/P3f
    // (a gate that fires on incident write-ups would tax exactly the texts that
    // document why it exists).
    expect(
      lineIsViolation(
        'The Worker was dispatched via the Agent tool last sprint; that incident is why this gate exists.',
      ),
    ).toBe(false);
    expect(
      lineIsViolation(
        'The Worker has been dispatched via the Agent tool twice before — both incidents are in the spec.',
      ),
    ).toBe(false);
  });

  it('T19 cold review round 2: the «use the Agent tool to …» wrapper fires, its prohibition stays silent, a review Worker passes', () => {
    // MAJOR-1 — the imperative wrapper defeats every line-anchored family; the corpus's
    // own idiom (slow-test-triage kickoff :296) proves the shape is attested, not contrived.
    expect(
      lineIsViolation(
        'Use the Agent tool to spawn the implementation Worker (worktree).',
      ),
    ).toBe(true);
    // A kickoff PROHIBITING the launch is compliant — and the silence must come from P5's
    // negation guard, not clause (c): this line carries no read-only wording at all.
    const prohibition =
      'Do NOT use the Agent tool to spawn the write Worker in a worktree.';
    expect(lineIsViolation(prohibition)).toBe(false);
    expect(READONLY_CONTEXT_RE.test(prohibition)).toBe(false);
    // Markdown emphasis between the negator and the verb must not defeat the guard —
    // this is the corpus line's shape minus its read-only tail.
    expect(
      lineIsViolation(
        '- Do NOT **use the Agent tool to dispatch a Worker** session for the write task.',
      ),
    ).toBe(false);
    // MINOR-2 — a read-only review Worker dispatch is tenet-1 legitimate, and the escape
    // token is NOT what exempts it (clause (c) carries it).
    const reviewWorker =
      'Spawn a review Worker via the Agent tool to check the plan.';
    expect(lineIsViolation(reviewWorker)).toBe(false);
    expect(ESCAPE_TOKEN_RE.test(reviewWorker)).toBe(false);
    // The P3 verb extension keeps the past-tense history shapes silent.
    expect(
      lineIsViolation('The Worker was spawned via the Agent tool last sprint.'),
    ).toBe(false);
  });

  it('blank / unrelated content never fires', () => {
    expect(findViolations('')).toHaveLength(0);
    expect(
      findViolations('# Kickoff\n\nStage 1 — Mode A inline session.\n'),
    ).toHaveLength(0);
  });

  it('PERF regression: a pathological blockquote-marker line cannot trigger catastrophic backtracking (ReDoS)', () => {
    // review_gate 8f5e9a5dcca4 (plain-words-recap-v2 S5 rework, 2026-10-04). The P1/P1b
    // prefix group used to read `(?:>+\s*|…)*` — a nested quantifier over the
    // variable-length `>+\s*` alternative. A run of N `>` markers has 2^(N-1) partitions
    // and an overall-match failure explores every one of them: measured against the real
    // exported matcher, 204.6 ms at N=24 and 3227.9 ms at N=28 (≈16x per +4 chars →
    // minutes-to-hours at N≥36) — ONE such kickoff line hangs the edit-time PostToolUse
    // hook past its timeout and times out the corpus-snapshot arm below. The
    // de-ambiguated `>\s*` (29-worker-dispatch-channel.ts clause (e)) is language-
    // equivalent but forces one iteration per marker: unique parse, linear matching.
    const pathological =
      '>'.repeat(48) +
      ' blockquote prose naming the Agent tool and a Worker with no directive verb anywhere here';
    // The line must be gate-REACHABLE — the (a)∧(b) conjunction hands it to
    // PRESCRIPTION_RE — otherwise this arm would pass vacuously.
    expect(CHANNEL_RE.test(pathological)).toBe(true);
    expect(WRITE_WORKER_RE.test(pathological)).toBe(true);
    const t0 = performance.now();
    const verdict = lineIsViolation(pathological);
    const elapsedMs = performance.now() - t0;
    // The verdict itself is unchanged: prose, not a prescription (no directive verb).
    expect(verdict).toBe(false);
    // Sub-millisecond post-fix (measured 0.00 ms at N=48); pre-fix this line needs
    // minutes-to-hours at N=48. The 2 s bound keeps 3+ orders of magnitude of CI-jitter
    // headroom while staying far below the pre-fix cost — pre-fix, vitest's own timeout
    // would fire first, so this arm is RED either way on a regression.
    expect(elapsedMs).toBeLessThan(2000);
  });

  // ---- Live-tree sweep: every tracked kickoff is clean (or explicitly escaped) ----
  const kickoffs = trackedKickoffs();

  it.skipIf(kickoffs.length === 0)(
    'all tracked kickoffs are free of unescaped Agent-tool write-dispatch instructions',
    () => {
      const violations: string[] = [];
      for (const rel of kickoffs) {
        const hits = findViolations(
          readFileSync(resolve(REPO_ROOT, rel), 'utf8'),
        );
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
    const hits = findViolations(
      readFileSync(resolve(REPO_ROOT, rel), 'utf8'),
    ).map((h) => h.line);
    if (hits.length) vector[rel] = hits;
  }
  return vector;
}

/**
 * Tracked broad corpus: any depth under .claude/orchestrator-prompts, basename kickoff*.md.
 *
 * Empty-vs-errored discipline (review_gate 5fcf26dc762a, plain-words-recap-v2 S5 rework):
 * a `git ls-files` FAILURE throws — it must never masquerade as an empty corpus. An
 * actually-empty corpus is a legitimate skip (a repo with no kickoffs has no population to
 * compare), but a failed enumeration means this arm cannot see its population AT ALL, and
 * returning [] there would make `it.skipIf(broad.length === 0)` silently skip enforcement —
 * the exact silent-enforcement-loss shape this arm exists to prevent. Throwing at describe
 * time fails the suite loudly with the reason instead.
 */
function trackedBroadCorpus(): string[] {
  let out: string;
  try {
    out = execFileSync(
      'git',
      ['ls-files', '-z', '--', '.claude/orchestrator-prompts'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
      },
    );
  } catch (err) {
    throw new Error(
      '29 corpus snapshot arm: `git ls-files` enumeration FAILED — refusing to silently skip ' +
        'enforcement (an empty corpus is a legitimate skip; an enumeration error is not, or ' +
        'every flip would go unobserved on a green run). ' +
        `Underlying error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  return out.split('\0').filter((f) => /(^|\/)kickoff[^/]*\.md$/.test(f));
}

/** Compare snapshot vs live vector; return one human-readable line per flip (empty = identical). */
function diffVectors(
  expected: Record<string, number[]>,
  actual: Record<string, number[]>,
): string[] {
  const flips: string[] = [];
  const keys = [
    ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
  ].sort();
  for (const k of keys) {
    const e = (expected[k] ?? []).join(', ');
    const a = (actual[k] ?? []).join(', ');
    if (e === a) continue;
    if (e.length === 0) flips.push(`NEW violations   ${k}: [${a}]`);
    else if (a.length === 0)
      flips.push(`GONE             ${k}: snapshot had [${e}]`);
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
  if (broad.length === 0) {
    // A legitimate-empty skip must be VISIBLE (review_gate 5fcf26dc762a): a silent skip
    // is indistinguishable from enforcement loss on a green run. Enumeration ERRORS never
    // reach this branch — trackedBroadCorpus throws on those instead of returning [].
    console.warn(
      '[29-corpus] tracked broad corpus enumerated EMPTY (git ls-files succeeded, 0 ' +
        'kickoff*.md tracked) — snapshot arm SKIPPED: no kickoff population this run, ' +
        'enforcement over the corpus is NOT running.',
    );
  }

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
              vector: Object.fromEntries(
                Object.entries(actual).sort(([a], [b]) => a.localeCompare(b)),
              ),
            },
            null,
            2,
          )}\n`,
        );
        return;
      }
      expect(
        existsSync(SNAPSHOT_PATH),
        'snapshot missing — generate it: ' + SNAPSHOT_GENERATE_HINT,
      ).toBe(true);
      const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
        vector?: Record<string, number[]>;
      };
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

  /**
   * Kickoff-s5 §9 makes the pre-narrowing RED flip list «checkable, and check it» at
   * review time — but the S5 PR body does not exist until egress (review_gate
   * 44efbc21bc61: the fixture cannot just claim «preserved in the PR body»). The
   * committed `preNarrowingRedRun` record in the fixture is the review-time carrier;
   * this arm is its mechanical check: the recorded flips replayed over the committed
   * `preNarrowingVector` must reproduce the vector pinned at the post-adjudication
   * commit (`git show <sha>:fixture`) exactly — non-empty (a green first run of the
   * narrowing is the failure, §9), each entry carrying a non-empty per-entry verdict,
   * every recorded direction consistent with what the two vectors actually say. The
   * pre side ships committed rather than pinned: the original capture SHAs died with
   * the squash-merged, deleted S5 branch (2026-10-05), and a squash-merge makes ANY
   * branch-side pin unreachable — the post pin survives because it points at the
   * staging squash commit itself. That endpoint is immutable history, so the arm
   * cannot false-RED on any future legitimate adjudication; it fails only when the
   * record and the pinned history disagree.
   */
  it('pre-narrowing RED run record is re-derivable', () => {
    const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
      preNarrowingRedRun?: {
        preNarrowingVector?: Record<string, number[]>;
        postAdjudicationCommit: string;
        flips: {
          file: string;
          snapshotLines: number[];
          flip: string;
          verdict: string;
        }[];
      };
    };
    const record = snap.preNarrowingRedRun;
    if (!record) {
      throw new Error(
        '29 corpus fixture lost its `preNarrowingRedRun` record — the pre-narrowing RED ' +
          'flip list with per-entry verdicts must stay COMMITTED (kickoff-s5 §9, ' +
          'review_gate 44efbc21bc61); restore it from this file’s history, never re-derive ' +
          'it from the live tree',
      );
    }

    // Throw-on-failure discipline (same class as trackedBroadCorpus): an unreachable
    // pinned commit must fail LOUDLY, never masquerade as a passing check. Needs full
    // history — the audit-self vitest job already checks out fetch-depth: 0 (principle
    // 11 precedent for git history in this suite).
    const vectorAt = (sha: string): Record<string, number[]> => {
      let out: string;
      try {
        out = execFileSync(
          'git',
          ['show', `${sha}:${relative(REPO_ROOT, SNAPSHOT_PATH)}`],
          { cwd: REPO_ROOT, encoding: 'utf8' },
        );
      } catch (err) {
        throw new Error(
          `29 pre-narrowing RED record: \`git show ${sha}\` FAILED — pinned commit ` +
            `unreachable from this checkout (shallow clone? fetch-depth: 0 required). ` +
            `Refusing to silently skip the kickoff-s5 §9 check. Underlying error: ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return (JSON.parse(out).vector ?? {}) as Record<string, number[]>;
    };

    if (!record.preNarrowingVector) {
      throw new Error(
        '29 pre-narrowing RED record lost its `preNarrowingVector` — the committed ' +
          'pre-narrowing vector the flips replay over (kickoff-s5 §9, review_gate ' +
          '44efbc21bc61); restore it from this file’s history, never re-derive it ' +
          'from the live tree',
      );
    }
    const pre = record.preNarrowingVector;
    const post = vectorAt(record.postAdjudicationCommit);

    expect(
      record.flips.length,
      'recorded flip list is EMPTY — the pre-narrowing RED run must have produced at ' +
        'least one flip (kickoff-s5 §9: «a green first run of the new arm is the ' +
        'failure, not the pass»)',
    ).toBeGreaterThan(0);

    // Reconstruct the post-adjudication vector from pre + the recorded flips, checking
    // each record entry against the pinned pre-vector as we go (direction + lines).
    const recordedPost: Record<string, number[]> = { ...pre };
    for (const f of record.flips) {
      if (typeof f.verdict !== 'string' || f.verdict.trim().length === 0) {
        throw new Error(
          `flip ${f.file} carries no per-entry verdict — kickoff-s5 §9 requires every ` +
            `flip entry adjudicated`,
        );
      }
      if (f.flip === 'FIRE→PASS') {
        expect(
          pre[f.file],
          `recorded FIRE→PASS for ${f.file}, but the pinned pre-narrowing snapshot has ` +
            `no firing for it (recorded lines: [${f.snapshotLines.join(', ')}])`,
        ).toEqual(f.snapshotLines);
        delete recordedPost[f.file];
      } else if (f.flip === 'PASS→FIRE') {
        expect(pre[f.file]).toBeUndefined();
        recordedPost[f.file] = f.snapshotLines;
      } else {
        throw new Error(`unknown flip direction in the record: ${f.flip}`);
      }
    }

    expect(
      recordedPost,
      'recorded flips do not reproduce the pinned post-adjudication vector — the ' +
        'committed record and the two pinned commits disagree:\n' +
        diffVectors(post, recordedPost).join('\n'),
    ).toEqual(post);
  });

  it('comparator discriminates (paired-negative for the snapshot arm itself)', () => {
    expect(diffVectors({ 'a.md': [1] }, { 'a.md': [1] })).toHaveLength(0);
    expect(diffVectors({ 'a.md': [1] }, { 'a.md': [1, 2] })).toEqual([
      'CHANGED          a.md: snapshot [1] → now [1, 2]',
    ]);
    expect(diffVectors({ 'a.md': [1] }, { 'a.md': [2] })).toHaveLength(1);
    expect(diffVectors({}, { 'b.md': [3] })).toEqual([
      'NEW violations   b.md: [3]',
    ]);
    expect(diffVectors({ 'c.md': [4] }, {})).toEqual([
      'GONE             c.md: snapshot had [4]',
    ]);
  });
});
