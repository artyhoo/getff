<!-- scope: session-handoff artifact for the /arch «advisor-pattern cross-session consultation»
     contour — NOT a spec. Session 1 (worktree gracious-chatelet-a1be5d) crossed the D6
     T_soft(300k, provisional) at a natural pause; per SLP phase 3 the state is handed off
     artifact-first. The successor session writes the actual spec. Third dogfood of the
     contour's own Part-3 handoff discipline (ADR contour → v2 membrane → v3 → this). -->

# /arch advisor-pattern — session-1 handoff (pre-spec state)

> **Status:** design dialogue MID-FLIGHT. Sections 1-3 AGREED with the operator; section 4
> drafted and PARKED on an operator re-chew; section 5 drafted, not yet presented; section 6
> sketched. **The spec is NOT written.** Operator directive (mid-session-1): the ENTIRE
> contour continues in the successor session — chip `task_fcb35157` (the discussion-only
> chip `task_9ae01fa8` was superseded and dismissed).
> **Entry brief origin:** memory card `project_pipeline_chips_contour.md` items (1)-(7).
> **NOT authoritative for:** anything ratified elsewhere — v2/v3 specs, ADR, night-mode,
> dispatcher stand as merged. Project goal — [README.md#why-this-exists](../../README.md#why-this-exists).
> **Current as of 2026-08-10.** Branch: `claude/advisor-pattern-consultation-86f49b`.

## 1 Frame decisions (taken in-session, announced, unvetoed)

- **Approach A:** ONE spec ratifies v2 Part II in full (PARKED/REBIND/NUDGE + §6 addressing
  + §9 kill-switch) AND adds the advisor extension (ASK/ANSWERED + seat + reviewer half).
  Grounds: P1/P4/F4 all positive; ASK/ANSWERED depend on §6/§9 anyway; two stale-in-place
  v2 clauses (`session-bus-v2.md:278-279` «recipes ONLY … conditional on F4 staying
  negative»; §9 claim-1 scope) get fixed in the same PR; ADR Part-2/D5 supersession pointer
  lands once. Falsifier: operator prefers one live night first → approach B (narrow slice).
- **§1.5 research contour:** satisfied by the standing probe corpus (P1/P4/F4/P6) +
  SSOT #201 (Anthropic Advisor tool, ADAPT — night-mode delta item 7 is the in-repo
  precedent; our delta = standing cross-session seat instead of per-consult subagent).
  State this line in the spec explicitly.

## 2 AGREED — section 1: grammar + ask surface

Five verbs (v2 §7 table extended; PARKED/REBIND/NUDGE unchanged):

```text
AIF-BUS v1 ASK      role=<sender-role> ref=<relative-path>
AIF-BUS v1 ANSWERED ref=<relative-path>
```

- `ASK`: senders = local seats ONLY (dispatcher, pipeline, review contours via their
  dispatching session — reviewer agents stay read-only; the orchestrating session files the
  ask). Container workers NEVER send ASK (their channel stays aif park → dispatcher
  observes). Recipient v1 = advisor (arch). Pull-twin: advisor sweep of the asks dir.
- `ANSWERED`: recipients = local askers only. For aif parks the return leg stays
  `answer.ts` REST-unpause (no verb). Pull-twin: asker re-reads its open asks at turn
  start. v2 §7 un-freeze condition met literally: the local-parker class materialized;
  «its own review» = this contour's §2 cold reviews.
- **Ask files = mailbox truth-store, NOT bus machinery** (explicit line — OFF tombstone
  silences doorbells + seat-file writes, ask files keep landing):
  `${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}/session-bus/asks/<YYYY-MM-DD>-<role>-<slug>.md`
  Shape: `asker` (role+cwd) · `class` (`consult | materiality-dispute`) · question (≤1
  screen) · options considered · evidence pointers · for disputes: finding verbatim +
  objection · answer block (verdict, rationale, decided-by, timestamp) ·
  `status: open | answered | escalated | withdrawn`. Atomic write-temp+rename.
- Laws 1/2 hold; grep-gate (§9 claim 1: zero bus refs under `packages/`) untouched;
  claim 2 (verb↔pull-twin) extends to 5 rows.

## 3 AGREED — section 2: advisor seat

- Identity: the existing `arch.json` role (v2 §6) — NOT a new role class. Standing app
  session in a dedicated worktree; repo-root ineligible.
- Three invariants: (1) decisions.md entry BEFORE application (v2 §4 shape) — before any
  `answer.ts` apply or ANSWERED send; (2) ZERO new rights — v3 §6 object cut by pointer
  (floor dominates; ambiguous → floor; ceiling sentence as-is); (3) concept-level answers —
  advisor never implements; for aif parks advisor applies via `answer.ts` (ratified v2 §4
  path); for local asks THE ASKER applies.
- Cost-citation obligation: spend-sensitive verdicts must cite the cost artifact
  (cold-seat-economy.md §3 table) in the decisions.md evidence line. Revisit trigger:
  systematic mispricing → consolidate a price-sheet artifact FIRST; a seat only if judgment
  still fails (artifact-before-seat). ⚠️ Slot re-opened by operator — chip Q1, see §6.
- Continuity: SLP as-is; T_soft → Part-3 handoff. Night honesty: CLI-born successor is
  ccd-deaf (F4a check (a)); until P6-matrix passes, night degradation = defer-non-trivial
  or sweep-shot successor. Standing seat = operating mode; artifact-backed rebuild = the
  failure mode (operator premise).

## 4 AGREED — section 3: transport + degradation

- Doorbell semantics transport-agnostic (v2 §7 sender algorithm unchanged). Send-time
  cascade: (1) native cross-session SendMessage IF capability present AND target
  discoverable via ListAgents — until the P6-matrix passes, native counts as capability
  ABSENT; (2) else ccd `send_message` via cwd-match (§6); (3) else nothing — pull-twin
  carries. One attempt per doorbell total; cascade = channel choice, not retries. After
  matrix pass the order is fixed native-first; swap = recipes edit, zero code.
- P6-matrix (FIRST work item; operator restarts the desktop app before it): discovery
  app↔app / app↔CLI / CLI↔app + agent naming/collision (output = native addressing recipe;
  reserve: `name` field in seat files); **idle-wake** (critical — parity with P1); **night
  permission classifier** on unattended sends, 2.1.222 behavior (critical); pointer-only
  grammar in native body. Any critical cell red → default stays ccd; re-run after next CC
  update. Own-stack-first grounds ([build-first-reuse-default.md §1.1]): native reaches
  CLI-born successors ccd cannot.
- New degradation rows (extend v2 §9): advisor absent → asks accumulate, morning sweep
  (= today); ASK lost → file waits; ANSWERED lost → asker re-reads at turn start; native
  classifier-blocked at night → cascade to ccd; CLI-born successor → deaf until matrix.

## 5 Operator premises ratified in-dialogue (MUST reach the spec verbatim-faithfully)

1. **Two-angles axis:** advisor judges CONCEPT (замысел/design/architecture); reviewer
   judges IMPLEMENTATION QUALITY (correctness, best practices, anti-patterns).
   Discrimination rule: **the reviewer may stand only on RECORDED premises** — premise in a
   ratified artifact → cite file:line, normal finding; premise unrecorded (payoff,
   priority, worth-building) → finding class `ESCALATED`, routes to the concept holder,
   reviewer does NOT price it. (Fixes the TD-M3 failure class — both incidents.)
2. **Severity contract:** only a finding with a concrete failure scenario / goal-impact
   statement may spawn a re-review round; all else = notes lane (fixed same-round or
   recorded — never a new round). Discriminator = scenario presence, NOT edit size and NOT
   the severity label (S4 round-7 caution: one «MINOR» was a real hole with a scenario).
3. **Materiality dispute:** either side files a one-line ask (`class: materiality-dispute`);
   advisor verdict `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR` + one-line rationale,
   judged ONLY against ratified artifacts; final for the round; disagreement → operator
   fork. Recorded in ask file + decisions.md.
4. **Proportionality rule:** a demand for a probe/experiment/audit is itself a finding and
   must state what breaks if wrong + what learning-in-practice costs. Reversible + cheap
   live verification → build now, verify in practice, falsifier recorded. Research-grade
   contour reserved for irreversible / expensive / consumer-shipped surfaces.
5. **Token-economy premise:** standing seat holds context (no per-consult re-briefing);
   idle app session burns zero between consults. Falsifier: live consults show heavy
   re-briefing anyway → revisit standing mode.
6. **One advisor only.** Dispatcher = execution owner (not an advisor); reviewers =
   powerless checkpoints (surface, never decide); cost = artifact, not a session
   (⚠️ pending chip Q1). Registry stays three roles (v3 §2 TD-M4).

## 6 PARKED — section 4 (routing + rights) + cost slot → successor step 1

Draft (presented; operator wants a re-chew as the successor session's FIRST agenda item):
- Routing by question CLASS, no mandatory hop chain; floor-class parks go operator-direct
  (advisor may pre-build the decision package); ASK senders list as §2 above.
- Zero-new-rights statement: «the advisor pattern is a LATENCY change to an
  already-ratified authority structure, not an authority change» + anti-smuggling line
  (envelope widening = a v3 §6 edit = operator fork, never a recipe edit).
- Surface edits: dispatcher §3 intent-row Day/Night cells gain «file ask + ASK when
  advisor reachable»; night-mode items 1+8 same conditional; arch §4 gains the
  review-ESCALATED intake line.
- **Open questions (successor step 1):** Q1 cost-knowledge mechanism (price-sheet artifact
  vs measurement job vs fourth seat vs advisor-yardstick-only); Q2 rights split honoring
  the operator intent «AI itself decides dig-further/worth-fixing/good-enough — no
  microscope where not needed»; distinguish SPEND (real quota/money beyond caps — floor)
  vs WORTH-THE-EFFORT (advisor-class). Record decisions + rationale + falsifier per H1.

## 7 READY, unpresented — section 5 (reviewer half surfaces)

`ESCALATED` joins the verdict grammar (beside GO/REVISE/STOP findings graded
BLOCKER/MAJOR/MINOR): landing surfaces = [reviewer-discipline.md] (contract SSOT — new §),
arch/SKILL.md §2 dispatch-prompt grammar line, [agents/fidelity-auditor.md] findings
format, operator's global `/reviewer` (same grammar per arch §2; agent-uncommittable —
operator applies by hand, jq-handoff style). Disposition vocabulary in spec changelogs
gains `ESCALATED`. Audit `task_c8cfb806` (review-effort theatre, wave-9 mold) calibrates
rates later — design does not block on it. The spec's OWN §2 cold reviews run WITH the
escalation rung (self-application, first consumer).

## 8 SKETCH — section 6 (work list) + spec obligations

Spec file: `docs/superpowers/specs/2026-08-10-advisor-pattern-design.md`. Must include:
v2 §7 5-verb table + §7 stale-clause fix (`:278-279`) + §9 claim scope fix + §14c
disposition table; ADR Part-2/D5 supersession pointer; dispatcher §3 + night-mode 1/8 +
arch §4 edits; reviewer-discipline.md new §; ask-file class; P6-matrix probe recipe;
morning-report night-decided-asks line; degradation rows; zero `packages/` code;
/self-reflection at landing (discipline change). H1 fork records with falsifiers.

## 9 Successor entry protocol (chip `task_fcb35157` — the FULL contour continues there)

1. Read memory card items (1)-(8) + this doc. 2. Brainstorm §6's Q1/Q2 directly with the
operator (first agenda item); record decisions + falsifiers. 3. Re-present section 4 with
the deltas, present sections 5-6. 4. Write the spec
(`docs/superpowers/specs/2026-08-10-advisor-pattern-design.md`, this branch); self-review.
5. Two cold §2 reviews (artifact paths only, unique filenames, GO/REVISE/STOP, 2-round
cap) — dispatch prompts MUST include the ESCALATED rung (value-premise findings escalate,
not priced). 6. Operator spec gate. 7. §3 exit routing (likely in-session or single doc-PR
— zero code; classify then) + `/self-reflection` at landing. Pending externals: desktop
app restart (P6-matrix — first work item AFTER the spec, never a spec blocker), audit
`task_c8cfb806` (calibration only).

## 10 Do NOT re-open (ratified or agreed this session)

v3 §6 object cut · v2 §14/§14b + v3 §13/§13b dispositions · three-role registry ·
approach A (unless operator flips at spec gate) · one-advisor-only · ask-files-as-mailbox ·
container workers have no bus edge · reviewer read-only posture · «advisor = latency
change, not authority change».
