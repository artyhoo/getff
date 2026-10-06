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
 * Rule enforced (.claude/skills/pipeline/SKILL.md §5 `#umbrella-execution-launch-without-operator`;
 * class boundary owned by .claude/rules/parallel-subwave-isolation.md §D6 tenets + protections):
 * a kickoff must not PRESCRIBE auto-launch of a stage's EXECUTION. Imperative write-worker
 * dispatch prescriptions fire; reading/review-task dispatch passes (tenet 1); a session
 * executing the stage the operator dispatched to it is out of scope entirely (protection (a)
 * bullet 3 — the ban is on ORIGINATING the launch, never on executing an assigned one).
 * NARROWED 2026-10-04 (plain-words-recap-v2 S5, kickoff §5(d)) from the pre-narrowing
 * «any Agent-tool write-Worker dispatch mention fires» spelling: the pre-narrowing matcher
 * fired on this repo's own teaching corpus (kickoff-s5.md:205, a third-person spec statement),
 * the exact false-positive class the narrowing removes. Same tuning discipline as the
 * original 8-false-positive clause (c) drop below: measured over the tracked 430-file broad
 * corpus — exactly ONE firing line pre-narrowing, ZERO post-narrowing, the single flip
 * adjudicated as teaching text in the S5 PR.
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
 * instruction → excluded. `review Worker` added by the S5 T19 cold review (MINOR-2):
 * the compound names the task, not a person, and the bare-`reviewer` spelling missed it.
 */
export const READONLY_CONTEXT_RE =
  /read-only|reviewer|Phase -1|research subagent|text return|\breview\s+[Ww]orkers?\b/;

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
 * Clause (e) — the line PRESCRIBES the launch (D6 narrowing, 2026-10-04). A mention of the
 * Agent-tool write-dispatch channel is not a prescription; the gate fires on the DIRECTIVE.
 * Six signal families, kept line-anchored so third-person spec/teaching prose
 * («a kickoff prescribing Agent-tool dispatch of a WRITE worker…») stays silent:
 *
 *   P1 — line-initial imperative dispatch verb (bullet / blockquote / numbered-list prefixes
 *        tolerated — kickoffs prescribe in bullets). Deliberately EXCLUDES `run`/`start`,
 *        which are too common as line-initial words to stay precise alone; those two are
 *        covered by the object-anchored P1b instead.
 *   P1b — line-initial `run`/`start` anchored to a dispatch object (worker/subagent/stage/
 *        implement…), so «Run the tests» never fires while «Run the Worker via the Agent
 *        tool» does.
 *   P2 — modal + dispatch verb («must dispatch», «should spawn», «needs to run»…).
 *   P3/P3f — passive prescriptions: present «is/are dispatched/spawned/…», future «will be
 *        dispatched/run/executed» — a kickoff's plan statements ARE directives to the
 *        executor. Past forms («was/were/has been dispatched») are deliberately NOT
 *        covered: history notes stay silent.
 *   P4 — agent-subject declarative («we dispatch», «the orchestrator spawns»…).
 *   P5 — «use the Agent tool to ⟨dispatch verb⟩» — the imperative wrapper that defeats
 *        every line-anchored family above (the T19 cold-review MAJOR-1: the corpus's own
 *        idiom is «use the Agent tool to dispatch a Worker», slow-test-triage kickoff :296).
 *        Negation-guarded by a variable-length lookbehind: a kickoff PROHIBITING the launch
 *        («Do NOT use the Agent tool to spawn…») is compliant, and the guard tolerates the
 *        markdown emphasis markers the corpus puts between the negator and the verb.
 *
 * Tuning measurement (same discipline as clause (a)'s 8-FP drop): over the tracked
 * 430-file broad corpus the pre-narrowing matcher fired on exactly one line
 * (kickoff-s5.md:205, teaching) and the clause-(e) conjunction on zero — the single flip
 * (FIRE→PASS) adjudicated as a false positive of the old spelling, not a missed violation,
 * in the S5 PR. The adversarial counter-prompt on the narrowing (T7, same stage) found the
 * first clause set let passive/declarative prescriptions through («The Worker is dispatched
 * via the Agent tool») — P3/P3f/P4 close that hole, re-measured corpus-clean, with the
 * past-tense history shapes still passing. A second adversarial round (T19 own cold review,
 * same stage) found P3 covered only «dispatched» while P3f carried five verbs, and nothing
 * covered the «use the Agent tool to …» wrapper — P5 + the P3 verb extension close both,
 * re-measured corpus-clean (the one attested use-family line is a prohibition excluded by
 * its own read-only wording AND by P5's negation guard). The paired positives in
 * 29-worker-dispatch-channel.test.ts prove the imperative write-worker prescription class
 * (with or without the words «umbrella stage») still fires.
 */
export const PRESCRIPTION_RE = new RegExp(
  [
    // P1 — line-initial imperative dispatch verb (bullet/quote/number prefixes tolerated).
    // The prefix group is DE-AMBIGUATED (`>\s*`, not `>+\s*` — rework 2026-10-04, review_gate
    // 8f5e9a5dcca4): `>+\s*` inside the quantified group is a nested quantifier over a
    // variable-length alternative, so a run of N `>` markers has 2^(N-1) partitions and an
    // overall-match failure explores all of them — measured 3227.9 ms at N=28 (≈16x per +4
    // chars; minutes-to-hours at N≥36), enough to hang the edit-time PostToolUse hook past
    // its timeout and to time out the corpus-snapshot arm below. `>\s*` is language-
    // equivalent (`>+\s*` matches exactly the strings `(>\s*)+` matches) but forces ONE
    // iteration per marker — a unique parse, linear matching. JavaScript has no atomic
    // groups or possessive quantifiers to group-order its way out; de-ambiguation is the
    // only JS-native shape. The remaining alternatives already consume deterministically
    // (`-+\s+` / `\*\s+` / `\d+[.)]\s+` each have exactly one parse per position: the
    // dash/star/digit runs cannot re-enter `\s+`). Shared verbatim by P1b below.
    String.raw`^\s*(?:>\s*|-+\s+|\*\s+|\d+[.)]\s+)*(?:dispatch|spawn|launch|execute|send|delegate)\b`,
    // P1b — line-initial run/start anchored to a dispatch object (prefix group: see the
    // de-ambiguation note on P1 above)
    String.raw`^\s*(?:>\s*|-+\s+|\*\s+|\d+[.)]\s+)*(?:run|start)\s+(?:the\s+|a\s+|your\s+)?\w*(?:worker|subagent|dispatch|stage|implement)`,
    // P2 — modal + dispatch verb
    String.raw`\b(?:must|shall|should|needs?\s+to|has\s+to|is\s+to|are\s+to)\s+(?:\w+\s+){0,2}?(?:dispatch|spawn|launch|execute|run|start|be\s+dispatched|be\s+run|be\s+launched|be\s+spawned)\b`,
    // P3 — present-passive prescription («the Worker is dispatched/spawned/… via the Agent
    // tool») — verb set mirrors P3f (T19 MAJOR-2: one verb over was a silent sibling)
    String.raw`\b(?:is|are)\s+(?:being\s+|then\s+|now\s+)?(?:dispatched|spawned|launched|run|executed|delegated)\b`,
    // P3f — future-passive prescription («will be dispatched/run/executed»)
    String.raw`\bwill\s+be\s+(?:dispatched|spawned|launched|run|executed)\b`,
    // P4 — agent-subject declarative prescription
    String.raw`\b(?:we|the\s+(?:orchestrator|session|agent|meta-orchestrator))\s+(?:dispatch(?:es)?|spawn(?:s)?|launch(?:es)?|execute(?:s)?|run(?:s)?)\b`,
    // P5 — «use the Agent tool to ⟨dispatch verb⟩» (T19 MAJOR-1 — the imperative wrapper no
    // line-anchored family reaches). Negation-guarded: a prohibition («Do NOT use the Agent
    // tool to spawn…») is compliant, and the guard's [\s*_]* gap tolerates markdown
    // emphasis («Do NOT **use the Agent tool…»).
    String.raw`(?<!\b(?:do\s+not|don['’]t|cannot|can['’]t|never|must\s+not|must\s+never|shall\s+not|should\s+not|forbidden\s+to|prohibited\s+from)\b[\s*_]*)\b(?:use|using)\s+the\s+Agent[ -]tool\s+to\s+(?:\w+\s+){0,2}?(?:dispatch|spawn|launch|execute|run|start|delegate)\b`,
  ].join('|'),
  'i',
);

/**
 * The single matcher. A line is a violation iff it
 *   (a) names the Agent-tool write-dispatch channel, AND
 *   (b) targets a write Worker, AND
 *   (e) PRESCRIBES the launch (imperative/modal directive — clause (e) above), AND
 *   (c) is NOT excluded by read-only / legitimate-channel context, AND
 *   (d) does NOT carry the escape token.
 * Per-line by construction — the spec §4 hand-trace and clause (c)/(d)/(e) are per-line.
 * Clause (e) added by the 2026-10-04 D6 narrowing (plain-words-recap-v2 S5); removing it
 * re-widens the gate to mere mentions and re-fires on teaching text (clause-(e)-is-
 * load-bearing arm in the paired suite).
 */
export function lineIsViolation(line: string): boolean {
  return (
    CHANNEL_RE.test(line) &&
    WRITE_WORKER_RE.test(line) &&
    PRESCRIPTION_RE.test(line) &&
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
