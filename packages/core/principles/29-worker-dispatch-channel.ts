/**
 * Principle 29 — shared matcher for `#umbrella-execution-launch-without-operator` (M6)
 * (formerly `#worker-dispatch-via-subagent` — renamed 2026-10-04, plain-words-recap-v2 D6).
 *
 * Single source of truth (dual-implementation-discipline.md §7): this module
 * holds the ONE matcher. Both enforcement channels call it — never two divergent
 * copies (anti-pattern `#two-prompts-drift`):
 *   - edit-time hook  → .claude/hooks/check-worker-dispatch-channel.sh
 *                       (delegates to 29-worker-dispatch-channel.bin.ts → this module)
 *   - CI principle    → 29-worker-dispatch-channel.test.ts (imports this module)
 *
 * @dual-pair: channel-discipline-worker-dispatch
 *
 * Rule enforced (.claude/skills/pipeline/SKILL.md §5 `#umbrella-execution-launch-without-operator`):
 * a WRITE-task Worker must NOT be dispatched via the Agent tool / a subagent from
 * the meta-orchestrator session. The Agent tool is ONLY for Phase -1 read-only
 * reviewers + read-only research subagents (text return). Write-task Workers run as
 * a fresh maintainer-opened session (a pasted §10 1-liner) or via dispatch.ts.
 *
 * Spec: docs/meta-factory/research-patches/2026-06-27-meta-orch-channel-discipline-mechanism.md
 *       §0/§3/§4 (M6 design, candidate matrix, regex sketch, escape-token).
 *
 * Honest ceiling (spec §0 + §4 caveat 1): this is a kickoff-TEXT gate. It fires on
 * a kickoff whose PROSE instructs Agent-tool write-dispatch (the documented Stage-5
 * incident class). It does NOT catch a session that merely PERFORMS Agent-tool
 * write-dispatch at runtime without writing it into a kickoff — the rule's own
 * falsifier reads «who invokes, not what the prompt looks like». A real upgrade
 * from Class C, not a complete enforcement of the rule.
 *
 * Slot 29 rationale: slots 01-28 occupied as of 2026-06-27.
 */

/**
 * Clause (a) — names the Agent-tool WRITE-DISPATCH channel.
 *
 * TUNED from the spec §4 sketch (documented per spec §4 "matcher over-match →
 * tune + document"). The sketch's clause (a) was
 *   /Agent[ -]tool|via .*Agent|isolation:\s*["']?worktree/
 * but the trailing `isolation: worktree` alternative is NOT a signal of the
 * Agent-tool channel — worktree isolation is the LEGITIMATE execution environment
 * of both Mode A inline sessions and Mode B worktree Workers (see
 * .claude/skills/pipeline/SKILL.md §5 dispatch tree). On the live tree it was the
 * SOLE cause of 8 false positives on legitimate kickoffs (Mode A inline / Worker's
 * own worktree), e.g. `Mode A inline Opus Worker ... isolation: "worktree"`.
 * The actual discriminator is the Agent-tool DISPATCH channel — which the §1
 * ground-truth fixture still matches via "Agent tool". Dropping the worktree
 * alternative therefore removes 8 FPs while keeping the fixture firing; the §2
 * deliverable's own prose for clause (a) is "names the Agent-tool write-dispatch
 * channel", which worktree isolation does not satisfy. Fork recorded in PR notes.
 */
export const CHANNEL_RE = /Agent[ -]tool|via .*\bAgent\b/;

/** Clause (b) — targets a WRITE-task Worker (not a read-only reviewer/research subagent). */
export const WRITE_WORKER_RE = /\bWorker\b|write[- ]task|dispatch.*Worker/;

/**
 * Clause (c) — read-only / legitimate-channel context. A line carrying any of these
 * is meta-discussion or a legitimate read-only Agent dispatch, NOT a write-dispatch
 * instruction → excluded.
 */
export const READONLY_CONTEXT_RE = /read-only|reviewer|Phase -1|research subagent|text return/;

/**
 * Clause (d) — the escape-hatch token (spec §2.4, DECISION-NEEDED (d) → Option A).
 * A same-line `<!-- channel-discipline: allow <reason> -->` opts the line out: it
 * lets a kickoff legitimately QUOTE / TEACH / PLAN-AGAINST the anti-pattern without
 * tripping the gate. Modeled on the established `# ci-tool-pin: allow` convention
 * (.claude/rules/ci-tool-pinning.md §3).
 */
export const ESCAPE_TOKEN = 'channel-discipline: allow';
export const ESCAPE_TOKEN_RE = /<!--\s*channel-discipline:\s*allow/;

/**
 * The single matcher. A line is a violation iff it
 *   (a) names the Agent-tool write-dispatch channel, AND
 *   (b) targets a write Worker, AND
 *   (c) is NOT excluded by read-only / legitimate-channel context, AND
 *   (d) does NOT carry the escape token.
 * Per-line by construction — the spec §4 hand-trace and clause (c)/(d) are per-line.
 */
export function lineIsViolation(line: string): boolean {
  return (
    CHANNEL_RE.test(line) &&
    WRITE_WORKER_RE.test(line) &&
    !READONLY_CONTEXT_RE.test(line) &&
    !ESCAPE_TOKEN_RE.test(line)
  );
}

export interface Violation {
  /** 1-based line number. */
  line: number;
  /** Trimmed line text (capped) for readable diagnostics. */
  text: string;
}

/** Scan a file's content; return every violating line (empty = clean). */
export function findViolations(content: string): Violation[] {
  const out: Violation[] = [];
  content.split('\n').forEach((line, i) => {
    if (lineIsViolation(line)) {
      out.push({ line: i + 1, text: line.trim().slice(0, 200) });
    }
  });
  return out;
}

/**
 * §1 ground-truth fixtures (spec §1.2 + §4 hand-trace) — exported so the principle
 * test proves the matcher DISCRIMINATES (T15 recursive self-application): the
 * positive MUST fire, the negatives MUST stay silent. A test that cannot fail on
 * the violation does not enforce (spec §2 deliverable 4, T2).
 */
export const FIXTURE_POSITIVE =
  'Dispatch Worker via Agent tool with explicit model: opus + isolation: worktree';
export const FIXTURE_CLEAN =
  'Stage A — R-phase, single Mode-A inline session; paste the §10 1-liner';
export const FIXTURE_READONLY =
  'Phase -1 cold-review via Agent tool (read-only reviewer, text return)';
export const FIXTURE_ESCAPED =
  'Dispatch Worker via Agent tool — quoted to teach it <!-- channel-discipline: allow teaching example -->';
