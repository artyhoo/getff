# getff one-button chain — cold review log

> **Authoritative for:** the per-finding dispositions of the `/arch` §2 cold reviews of
> [2026-09-28-one-button-chain-design.md](2026-09-28-one-button-chain-design.md), and that spec's
> revision history (r1-r6, with commits), and the index of the rows that hold its rejected alternatives.
> **NOT authoritative for:** the design itself — the spec; project goal —
> [README.md#why-this-exists](../../../README.md#why-this-exists).

Disposition vocabulary per [arch/SKILL.md §2](../../../.claude/skills/arch/SKILL.md):
`ACCEPTED | DISSOLVED | ESCALATED | FIXED`. Seats: top-down TD and bottom-up BU, both mid tier,
given artifact paths only, on immutable snapshots. The reports are kept per seat and never merged;
each verdict stands on its own axis. The contract allows two rounds, and both ran; no third round
runs, so what remained open went to the operator: R5-1 and R5-8 were answered A; R5-9 was
superseded by R6-2 after the operator's premises P15-P16.

## Round 1 — 2026-09-28, on r3 (TD REVISE, BU REVISE), folded into r4

Counts. TD: 0 BLOCKER, 11 MAJOR, 2 ESCALATED, 20 MINOR, 8 notes. BU: 0 BLOCKER, 8 MAJOR,
1 ESCALATED, 10 MINOR, 12 notes. The spec was restructured around the complete install (§4.4) and
lanes (§4.5).

### Top-down

- ACCEPTED: M1, M2, M10 → R4-3; M3 → R3-12 and slice 4; M4 → R4-8; M5 → R4-2; M6 → R4-4;
  M7 → R4-6; M9 → R4-7; M11 → R4-5.
- DISSOLVED by P14: M8, E1. ESCALATED and answered: E2 → R3-12.
- FIXED: m3, m4, m6, m17, m18, m19.
- ACCEPTED: m1 (R4-10), m2 (the table merge runs in bash), m5 (slices), m7 (staleness by path or
  content), m8 and m10 (§6), m9 (after T7), m11 (§7), m12 (setup's exit code unchanged), m13
  (readAif never throws), m14 (both examples in wiring), m15 (flags from the chain record), m16
  (R4-9), m20 (R4-6).
- Notes: N2 → §9 consults; N4 DISSOLVED by P14; N1, N3, N5-N8 need no change.

### Bottom-up

- ACCEPTED: MAJOR-1, MAJOR-2 → R4-3 (setup record, installed-tool check, research hash);
  MAJOR-3 → R4-12; MAJOR-7 → R4-13; MAJOR-8 → R3-2 with the liveness fixture.
- DISSOLVED by P14: MAJOR-4, MAJOR-6, E-1, and MAJOR-5, whose facts were corrected in §3.
- ACCEPTED: m1, m2 (R3-5 tests; the falsifier asserts python), m3, m4 (readAif), m5 (R4-12), m6
  (the CLAUDE.md template's line 8), m7 (slice 1, §6), m8 (step 6 `when`), m9 (the whole «Next
  steps» block), m10 (the fence check arrives with contract step 7, §4.3).
- Notes: FIXED N1-N5; N6 → §6; N7 → R3-2; N10 → the delivery mode; N8, N9, N11, N12 need no
  change.

## Round 2 — 2026-09-28, on r4 (TD REVISE, BU REVISE), folded into r5

Counts. TD: 1 BLOCKER, 5 MAJOR, 2 ESCALATED, 12 MINOR, 10 notes. BU: 0 BLOCKER, 4 MAJOR,
0 ESCALATED, 9 MINOR, 11 notes; 89 of 89 line anchors and 16 of 16 file references resolve, with
6 partial matches (all fixed below). Both seats judged every round-1 disposition real or partly
real; the partial ones are the round-2 findings they name.

### Top-down

- **B1** (acceptance cannot pass on the Vite scaffold: no repository, no app tests) — ACCEPTED →
  R5-1 (the intent writer runs `git init`) and R5-2 (a gate with nothing to run passes, reported
  as such), plus a fresh-install cell variant with neither (§7).
- **M1** (the complete predicate both counts and never counts «not built») — FIXED → R5-3 (§1,
  §4.4 and §4.5 now say one thing).
- **M2** (the intent gate's escape is agent-writable, with no second channel) — ACCEPTED → R5-4:
  the honest limit stated, a consumer CI mirror, and the changed-lines list in every check report.
- **M3** (the baseline compares gates, not failures) — ACCEPTED → R5-5.
- **M4** (declining an unrelated question voids blanket consent and stalls the chain) — ESCALATED
  → operator fork R5-8, together with E2; answered A.
- **M5** (the lane contract covers green only) — ACCEPTED → R5-6 (items 10-12).
- **E1** (no project-specific architecture reaches any lane) — ESCALATED → operator fork R5-9.
- **E2** (a bare go-ahead read as consent to everything) — ESCALATED → operator fork R5-8; answered A.
- **m1** (npm lanes share `package.json`) — FIXED: recognition adds a dependency test (§4.2,
  §4.5 item 1).
- **m2** (two chain-record writers) and **m3** (no capture point for a late «skip research») —
  FIXED → R5-7.
- **m4** (step 7's `doneWhen` cannot fail) — FIXED: step 7 is done when the check exits 0; the
  terminal `doneWhen` becoming the complete-install predicate is a note to the contract (§6).
- **m5** (the depth sequences keep the stamp loop) — FIXED → R5-7 (stamp-free probes in every
  sequence).
- **m6** (the gates are not all read-only) — FIXED: the gates write only the project's own build
  output, and the baseline runs after the start-round answers (§4.2, §4.4).
- **m7** (a step-6 failure reads as step 3) — FIXED → R5-10 (one record entry per setup run).
- **m8** (a deleted CLAUDE.md comes back; the refresh line turns false) — FIXED (§4.3: created
  only when git never tracked one; R5-13 rewords the refresh line).
- **m9** (closure depends on another umbrella) — ACCEPTED → R5-16.
- **m10** (the relay line re-asks a declined `--global`) — FIXED (§4.2 item 3).
- **m11** (R4-13's fallback is a tautology) — FIXED → R5-14 («wiring unproven», never passed).
- **m12** (R4-3 decides the contract's stamp writer) — ACCEPTED: filed as a blocking request to
  the contract before slice 3 (§6).
- Notes: N1 FIXED (§7 seams); N2 FIXED (the contract's R3 CI-only list, §4.3, §6); N3 ACCEPTED as
  a known wording gap (R2-Venv and R3-4 carry reopen triggers; both are DISSOLVED rows); N4 FIXED
  (step 3 runs at the default profile, `env`; each setup record entry names its profile, which
  gives the check the depth sequence to walk without a chain record, R5-10); N5 FIXED → R5-7; N6 recorded (§4.6 reports the MCP measurement, R5-15); N7 recorded
  (low harm; R3-2 keeps «by instruction»); N8 FIXED (§4.5 alpha paragraph); N9 FIXED (a pointer to
  the contract's §6.2); N10 FIXED (§9 parallelism sentence).

### Bottom-up

- **Anchor mismatches.** 1 `detector/index.ts:2-3` → `:2-8` FIXED (R3-5); 2 face-facts «copies
  only the depth sequences» FIXED (§6: slice 1 adds the filter); 3 the `aif-init` «DRAFT-writer»
  label FIXED (R3-2 says «role descriptions»); 4 the ≥20-char precedent FIXED (§4.3 cites
  `attention-is-not-a-mechanism.md` §1); 5 §3's generator proof FIXED → R5-12; 6 the lock's
  timestamp FIXED (§4.1).
- **MAJOR-1** (the table section writes a keep-copy on every change) — ACCEPTED → R5-13.
- **MAJOR-2** (no step creates a repository) — ACCEPTED → R5-1; the `50-hooks.sh:81` instruction
  becomes a check part (slice 3).
- **MAJOR-3** (generator triples flagged ORPHAN; a second firing proof) — ACCEPTED → R5-12, option
  (a): reuse the existing proof and drop the triple.
- **MAJOR-4** (Rule 3 asks the tool Y/n again after setup) — ACCEPTED → R5-11.
- **m1** (two writers) — FIXED → R5-7. **m2** (`setup.json` has no writer) — ACCEPTED → R5-10.
- **m3** (readAif breaks more tests) — FIXED: slice 2 names the full list and the bundle.
- **m4** (parity key equality, `evidence` type, face-facts filter) — FIXED: slice 1 names them.
- **m5** (the wiring precedent does not transfer) — ACCEPTED → R5-14.
- **m6** (R4-10's premise contradicts the vendor docs) — ACCEPTED → R5-15.
- **m7** (sidecar writer placement; the blocked count has no data path) — FIXED (§4.1, slice 4).
- **m8** (closure depends on contract work) — ACCEPTED → R5-16.
- **m9** (the `--refresh` passport arm) — ACCEPTED → R5-13.
- Notes: N1 FIXED (R5-13 names the prefix hazard); N2 FIXED (slice 2 names the opt-out marker as
  new); N3 FIXED (§4.3 «armed» names the hook); N4 = mismatch 3; N5 FIXED (§4.3 states the
  residue); N6 FIXED (§4.2 item 2, §4.6); N7 FIXED → R5-7; N8 FIXED (R5-14 lists it); N9 recorded
  (an environment fact measured in session, not a repo fact); N10 recorded (chip
  `task_b6036daf`); N11 FIXED (step 4 reads user scope and claims presence only).

## Revision history

- **r1** (`e5fb19bde99`): round 1 (Q1-Q4).
- **r2** (`a8241c7e611`): round 2 with OP-15 to OP-17 and the `/aif` probe; premises P8-P12.
- **r3** (`9f57c0efac0`, anchors `33147ff9228`): the round-2 cold re-review and OP-18; then P13, P14
  (`93481336849`) and R3-12 (`c61055cade7`).
- **r4** (`66917ad162d`): §2 cold review round 1 of 2, on r3 (both seats REVISE); restructured
  around the complete install and lanes; rows R4-1…R4-13.
- **r5** (`2fa7648f655`): §2 cold review round 2 of 2, on r4. Top-down REVISE (1 BLOCKER, 5 MAJOR,
  2 ESCALATED, 12 MINOR); bottom-up REVISE (4 MAJOR, 9 MINOR; 89 of 89 anchors resolve). Rows
  R5-1…R5-16; the two ESCALATED findings became forks R5-8 and R5-9. No third round runs. The
  operator's answers R5-1 = A and R5-8 = A: `8617beedccf`.
- **r6:** operator premises P15-P16 (after r5) recorded in §2 and measured by two cold read-only
  seats; the evidence is the research patch
  [2026-09-28-core-and-self-application.md](../../meta-factory/research-patches/2026-09-28-core-and-self-application.md).
  Rows R6-1…R6-6; R6-2 supersedes R5-9; forks R6-2, R6-3, R6-6; slice 6 «Core and
  self-application» added, acceptance became slice 7. Not a §2 round: no seat reviewed the design.
  R6-3 = Б: `77d705ff809`. The operator then declined approval («я пока не вижу полностью
  сформированую идею»); a model round (Q1-Q4, in chat) followed. Its answers: P17 (Q1), R6-2 = B
  (Q2), R6-7 agreed (Q3); Q4 reopened R6-1 and R6-6 with a two-layer reading of «the core».
  Model round 2 (Q5-Q8): P18 (two cores; docs first, as needed; skills under 500 lines, both
  ways; no button over getff) and P17 narrowed (no stack choice; the tools step installs). Rows
  R6-1, R6-4, R6-6 answered, R6-8 and R6-9 added; R6-3 corrected: `restricted-syntax-audit-exempt`
  is the engine generated rules compile into, so it keeps shipping. Spec §8's row index moved here.
  Model round 3: the operator found the first base-core list incomplete (reuse, adapting,
  laziness, questions); the [base-core inventory](2026-09-28-one-button-chain-base-core.md) swept
  the full population (75 principles, every rule and principle test mapped); a cold seat returned
  REVISE (56 findings: security, rule lifecycle, reference integrity, portability, 15 statuses),
  folded in revision 2 (102 principles). Q11: the 600-line markdown gate is dropped; the sourced
  limits of R6-9 replace it. Round 3b (2026-09-29): Q13 (is the list right) moved to a separate
  session that walks all 102 principles with the operator in plain words; its results fold back
  into the inventory. Q14 gave P19 and R6-10 (the base core loads on need, a hybrid; getff's
  token-economy machinery ships to consumers); its shape stays open. Q15 = yes gave R6-11 (the
  `getff` skill split). Q10 and Q12 stood on the recommendations: the `machinery` tag (R6-1, R6-6)
  and the FYI line of R6-8. The operator then added that no principle ships as text alone (P19).
  Model round 4 (2026-09-29), after measuring what of the token-economy machinery ships today:
  Q16 В and Q17 accepted on the recommendations («Остальные 2 ок»), so R6-10 records the shape
  (a check or a timely signal per principle; a small always-on part; the budget check and the
  `paths:` rule files ship) and slice 6 carries it. Q18 (principles with no trigger yet) moved to
  the base-core review session: «мы в отдельной сессии это все рассматриваем как сделать лучше».
  The review session walked all 102 rows in ten rounds; the inventory's revision 3 folds its verdicts
  (100 principles: 9 merged, 7 added, among them the advisor seat F9 and the pre-merge review B8). Its
  I4 verdict (no always-loaded exception for security) overrode the Q17 card's «security always-on»,
  and R6-10 was corrected. Six glossary terms from the review joined CONTEXT.md. Its round 11 answered
  Q18: a trigger for every row, folded as the inventory's revision 4 (a Trigger column; primary check 46,
  event 25, skill 13, file 11, always-on 5; 48 rows wait for a trigger to build and show «not delivered»).
  R6-10 now names the three always-on invariants (G1, E2 + D9, I7). The round's four cards stay open in
  the review session; a skipped card takes the recommendation. The review summary's «the 60 prose and
  no rows each name a `build` or `corpus` trigger» does not hold by the status column: eleven of them
  name only a `generated`, `live` or `always-on` one (B1, B6, D9, E12, H1, H3, H4, H7, H8, H10, H11), so
  the inventory counts by trigger status, not by «Ships today».
  Round 11's cards came back in part: Q1 = A, and the operator made building the 48 waiting triggers
  its own isolated task (a plan by carrier, chip `task_ed1d38f7`, built after spec approval); Q3 = A.
  Q2 (the always-on set, to be chosen as «the foundation of everything else, the most general») and
  Q4 (when a signal is needed and how often it fires) reopened for round 12, so both stay provisional.
- **r7 (2026-09-29): restructure.** The base core now comes first (§4: what ships, how a principle
  reaches the agent, the trigger build, getff running what it ships), then the one button (§5), then
  the shipped list (§6). R6-10's resolution moved into §4.2; R7-1 and R7-2 record how a not-delivered
  principle counts and who builds the triggers. Complete install gained two parts: the base core (part
  2) and architecture (part 6, which R6-2 B already required and §4.4 had missed). Wrapped prose was
  joined, one paragraph per line (640 → 412 lines). **Renumbered:** old §4 → §5, §5 → §7, §6 → §8,
  §7 → §9, §8 → §10, §9 → §11, §10 → §12; section numbers in the entries above are the old ones.
- **r8 (2026-09-29): the trigger-build plan folded.** The plan (chip `task_ed1d38f7`, coordination
  directory) sent seven notes to this spec (its §7). Rechecked on staging `0c11f43768c`: FIXED in
  inventory rev 5 — C10 is conditional, not waiting; D1's trailer check is maintainer-only
  (`pre-push.ts:2579`), so D1 waits; A9 is partial (`guard-liveness`, `cmd-script-liveness` are
  maintainer-only, `:2583-2590`); D14's probe ships only in the FACTORY tier (`setup.d/lib.sh:63`); I3
  scans only in the npm stacks' CI. A sweep of the 30 maintainer-only sections against every `live`
  trigger found no other row (B5 and C2 run `audit-ai-docs.sh` through consumer CI). The totals stay
  52/48. ACCEPTED as register rows: the plugin's fallback corpus (R7-3), the evidence carrier for
  E11/G6 (R7-5), shadow mode for the turn-end claim detectors (R7-6); ESCALATED: the always-on
  delivery (R7-4), which the review seat made round 12 Q7. FIXED from the review seat's check of the
  plan: the 54,000 B budget ceiling is sourced (`scripts/check-alwayson-budget.sh:33-44`, getff's
  baseline × 1.10), not unsourced as §4.2 said; it still does not ship, because it is getff's own
  ratchet. ACCEPTED into §4.3: per-harness reach (SDK sessions skip the turn-end hook,
  `end-of-turn-reminder.sh:107-108`) and SSOT #236's revisit trigger.

## Rejected alternatives index

Each rejected alternative lives in its spec row: Q1 (the chain in the prompt; the plugin command
as owner), Q2.1 (a breaking `-y` backstop, reversing S1-4), Q3 (level-2 tooling), R2-Q1, R2-Q1.1,
R2-P1, R2-Stack, R2-Arch, R2-Guard, R2-OP18, R3-1, R3-2, R4-3, R4-4, R4-5, R4-7, R5-5, R5-12,
R5-14, R6-2 (A), R6-3 (A), R6-6 (B), R6-10 (skills only; an always-on laziness digest).
