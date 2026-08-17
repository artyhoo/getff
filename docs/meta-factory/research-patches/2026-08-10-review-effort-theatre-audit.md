<!-- scope:review-effort-theatre-audit -->

# Review-effort theatre in the repo's review loops — R-phase audit

> **Type:** research-patch (R-phase deliverable; no fixes, no rule edits — T5 held).
> **Owner:** the session that ran the audit, 2026-08-10. Operator GO received 2026-08-10
> (chip `task_c8cfb806`; premise recorded in the operator's pipeline-chips memory card, item 6).
> **Feeds:** the upcoming `/arch` advisor-pattern design — its premises (ESCALATED finding
> class, severity contract, notes lane) are consumers of §9's measured rates.
> **Methodology template:** [wave-9 kickoff](../../../.claude/orchestrator-prompts/wave-9-discipline-theatre-audit/kickoff.md)
> (population enumeration → stratified sampling → per-finding evidence → self-application).
> **Active traps** ([ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md)):
> T1 (floor 5 / depth ≥20), T3 (no prose-only findings), T9/T10 (population before sampling),
> T14 (low coverage ≠ clean), T15 (self-application), T6 (predicate confidence).
> Domain trap **T-RET-A** — *do not become the antipattern*: an audit of nitpicking that
> nitpicks the nitpickers. Counter: every classification below is per-finding and honest
> per-finding; «MINOR = noise» is forbidden by construction (the S4 round-7 anchor proves a
> MINOR can be a real fail-open hole).

## §1 Problem

Operator complaint (2026-08-10, GO for this audit): reviewers spawn re-review rounds over
immaterial findings — slightly-off % figures, label wording, separators. The effort is real but
the goal-impact is zero. This is the mirror twin of wave-9 `#discipline-theatre` (form
satisfied / substance absent): here the substance of diligence is real but its **target** is
immaterial — substance-free DILIGENCE. Suspected root: the reviewer's implicit KPI is
findings-produced, not goal-shift; a zero-finding review feels failed.

The materiality yardstick used throughout (binding, from the audit GO): a finding is
**MATERIAL** iff fixing it changed behavior or a decision, or NOT fixing it would have cost
something toward the README goal («AI agents can't silently bypass undocumented conventions»).
**IMMATERIAL** = cosmetic/numeric nit with zero downstream effect. A third honest bucket
**MATERIAL-b** (borderline) is used where the fix changed a load-bearing evidence label but no
decision or behavior. **CHURN** tags findings *introduced by a previous round's own rework* —
counted separately per the audit brief.

## §2 Population enumeration (T10 — before any sampling)

Command: `gh pr list --state merged --limit 100 --json number,title,mergedAt` filtered to
`number >= 1290` → **69 merged PRs** (#1290–#1365, merged 2026-08-08 → 2026-08-10; gaps =
closed-unmerged or open). All 69 bodies fetched and grepped for `FIDELITY:` / `Round:` lines.

- **Stage PRs with a fidelity loop: 13**, of which #1354 is the empty-diff duplicate of #1353
  → **12 distinct review loops**. Final `Round:` fields: #1290=2, #1302=2, #1311=6, #1329=2,
  #1332=1, #1333=5, #1341=7, #1346=1, #1349=2, #1353=3, #1358=3, #1360=3. **Σ = 37 rounds**,
  of which **25 are follow-up rounds** (round ≥ 2).
- **Loops exceeding a 2-round cap: 6 of 12** (#1311 six, #1341 seven, #1333 five, and three
  loops at 3).
- **`FIDELITY: skipped` PRs: 47** (non-stage). Among them the **finding-closure follow-up
  PRs**: #1350 (closes #1341's round-7 MINORs), #1356 (closes #1353's round-3 MINORs), #1359
  (sibling sweep of a class named by #1356's MINOR 2). Also the **kickoff-revision series**
  (a distinct loop family, enumerated in §8): getff S1 kickoff revs = 6 PRs (#1292 #1296
  #1305 #1315 #1317 #1328); beta-delivery-ux S4 kickoff addenda = 7 PRs (#1295 #1310 #1318
  #1319 #1324 #1340 #1351).
- **aif rework cycles** (the `answer.ts --decision request_changes` lane): probed live —
  `curl http://localhost:5180/api/tasks?limit=60` → API up; full task list = **209
  done/verified tasks, only 9 with `reviewIterationCount > 0`** (4.3%). The two tasks behind
  this window's stage PRs (`30043212` S1b, `0517063b` CDC) both report `reviewIter=0`. The
  in-container review loop is capped (`AGENT_MAX_REVIEW_ITERATIONS=1`, per PR #1302 body) and
  is NOT where review effort concentrates; the host cold-seat loops are.

**Sampling strategy (T9).** At the *loop* level this is a full-population audit (12/12 loops
examined), not a sample. At the *finding* level, 10 of 12 loops were read in full from their
PR bodies (verdict blocks quote their own file:line evidence); ~104 findings classified. The
window is 3 days, not 30 — merge density made #1290+ ≈ 2026-08-08. This is the
**discipline-active** window by construction (the structured `FIDELITY:` verdict gate is
recent); the operator's complaint is about the current loops, so recency is the correct
stratum here, but no claim below extends to the pre-gate era (T9 stated, not hidden).

## §3 Methodology + paired negative

Per finding: read the verdict block's own description and evidence cite; classify against the
§1 yardstick; where the downstream outcome is observable, verify it in the live tree.
Spot-verifications run (command + output, T3):

- #1358's open W-11: `sed -n '146p' docs/meta-factory/getff-name-architecture-freeze.md` →
  line still reads «…while all four siblings do…» — the immaterial finding was **left open**
  and has cost nothing since (organic notes-lane outcome).
- #1356's fix landed: `grep -n PY_LAYER_LIB_ONLY tests/install-sh/python-rules-lock.test.sh`
  → `:212`, `:446` (emitted corpus, not copied).
- #1350's N10 gate landed: `grep -n model-proof-unusable-usage scripts/getff-glm-onebutton.sh`
  → `:534`.
- #1359's sweep landed: `grep -rn 'rework round\|MAJOR B (W-7)' setup.d/*.sh` → empty.

**Paired negative** (what would a missed theatre instance look like): an immaterial-triggered
round whose PR body *describes* the trigger as material. This audit reads the bodies' own
descriptions, so a reviewer who dressed a nit in failure-scenario language would be
misclassified here as material. Mitigation: the anchor findings were cross-checked against
what the fix actually changed (§4 tables cite the fix sites); residual risk is stated in §11.

## §4 Per-finding classification

Grades are this audit's, applied to the §1 yardstick; the original severity is kept in the
row. Evidence = the PR body's own cite (all bodies archived in the session scratchpad;
re-fetch: `gh pr view <n> --json body`).

### #1360 (CDC, 3 rounds — the churn anchor)

| Round · finding | Orig | Class | Basis |
|---|---|---|---|
| R1: §3 checklist not run on 4 negative-existence claims → running it **falsified 2** | MAJOR | MATERIAL | LoCoBench-Agent + arXiv 2606.23525 exist; doc's core claims changed |
| R1: RQ1 lacked per-tier disposition → Fable-5 `COVERAGE INSUFFICIENT` | MAJOR | MATERIAL | prevents adopting Opus-derived numbers for the top tier |
| R1: `T_soft(200k)` proposed at 75% above every figure in its evidence cell → parked as PARK-CDC-1 | MAJOR | MATERIAL | an unsupported number was about to enter a design table |
| R1: unsourced `85% (~170k)` + deltas → demoted `INCONCLUSIVE-needs-human` | MAJOR | MATERIAL | evidence-strength labels are the deliverable of this doc |
| R1: four citation years wrong | MAJOR | MATERIAL-b | feeds the load-bearing «dated 2026» predicate |
| R1-K1/K2: 404 slug fixed (`…-use-1m-tokens-2026/`) | MINOR | IMMATERIAL | no claim changed; research-patches excluded from live link audit (`lychee.toml:37`) |
| R1-K1/K2: same anchor rated «WEAK» and «strongest» → probed, re-rated `NO MATCH` both places | MINOR | MATERIAL | evidence weight flipped on probe |
| R1-K1/K2: two 2025 sources labelled 2026 | MINOR | MATERIAL-b | same dated-2026 predicate |
| R1-K1/K2: «export-control» causal attribution removed (source states no reason) | MINOR | MATERIAL-b | false causal claim deleted |
| R1-K1/K2: comparator 18.5% mis-attributed (predecessor → Sonnet 4.5) | MINOR | IMMATERIAL | precision nit, nothing downstream reads it |
| R2: ranking withdrawn in prose but standing in its summary table | MAJOR | MATERIAL + CHURN | table/prose contradiction in the deliverable; introduced by rev 2 |
| R2: two NEW unchecked negative-existence claims substituted by rev 2 | MAJOR | MATERIAL + CHURN | the exact class rev 2 was fixing; base rate 2/4 die when searched |
| R2: 3 undated citations under a «26/26 dates verified» predicate; probing one found the page states the **opposite** → `NO SUPPORTING SOURCE` | MAJOR | MATERIAL + CHURN | a cited source contradicted its claim |
| R3: undated row counted in «Dated 2026: 12 of 13» → «11 of 13» | MAJOR | MATERIAL-b | 3rd recurrence of the aggregate-overclaim class in an evidence doc whose consumption gate weighs exactly this; no number/decision moved |
| R3: `~600k` falsifier imported cross-class, direction wrong | MAJOR | MATERIAL | a wrong-direction bound could mis-constrain D6/D7 |
| R3: label «PARTLY ANSWERED» → «COVERAGE WIDENED, STILL INSUFFICIENT» | MINOR | IMMATERIAL | wording; the consumption gate is unspent either way |

### #1353 / #1356 / #1359 (getff S1b, 3 rounds + 2 follow-up PRs)

| Round · finding | Orig | Class | Basis |
|---|---|---|---|
| R1 M1: tier assertion `[^}]*` bound the provenance SOURCE tier — a wrong lock **passed** | MAJOR | MATERIAL | contract-that-cannot-fail; the goal class itself |
| R1 M2: criterion 7 asserted nowhere | MAJOR | MATERIAL | unasserted criterion |
| R1 M3: lane checks tested a path nothing writes; both branches `ok` unconditionally | MAJOR | MATERIAL | can't-fail check |
| R1 M4: skip-that-passes on the proving arm | (M4) | MATERIAL | same class |
| R1 M4: URL-only provenance grep | (M4) | MATERIAL-b | weak assert |
| R1 M4: stale reader contract comment; missing §2 justification prose | (M4) | IMMATERIAL ×2 | comments/process prose |
| R2: M1 repair reintroduced the class via unbounded `.*` | MAJOR | MATERIAL (churn-caught) | «a defect nobody would have found by inspection» — the cold round earned its keep |
| R3: proof corpus joins `},{` vs emitter's `}, {` — verified non-load-bearing (7/7 identical) | MINOR | IMMATERIAL | the seat itself verified zero effect **and still shipped the finding** |
| R3: round-narrative in shipped `setup.d/` comment | MINOR | IMMATERIAL | process narration in a comment |

Downstream cost of the two R3 IMMATERIALs: follow-up PR **#1356** (2 commits, 8-gate test
plan, plus an unplanned investigation isolating a host-red core suite: A/B at merge-base,
worktree provisioning, flake wobble — all documented in its body) and sibling-sweep PR
**#1359** (9 sites, 6 files, snapshot + sweep + self-audit, plus a CI-flake non-causation
investigation with a 3-step evidence chain). Two full PR cycles from findings with measured
zero behavior delta. (#1350, by contrast, closed four **material** items + one immaterial.)

### #1341 / #1350 (beta-delivery-ux S4, 7 rounds — the length anchor)

| Round · finding | Orig | Class | Basis |
|---|---|---|---|
| R1–R6 (from body + §7 records): single-`POST /chat` model proof passed **by coincidence** (pinned profile == default) | — | MATERIAL | the flow's central claim was fake-green; two-call form forced |
| R1–R6: N5 stub fail-open (catch-all `rc=0`) | — | MATERIAL | fail-open |
| R1–R6: failed per-mode PUT warned and fell through to `DONE` | — | MATERIAL | fail-open |
| R1–R6: `_ND_SEEN` subshell assertion **could not fail** | — | MATERIAL | can't-fail assert |
| R1–R6: W-4 stub-discipline REINTRODUCED twice (rounds 4, 6) | — | MATERIAL | recurrence caught by watch-list |
| R7: guard-the-guard asserts non-empty, not `/chat`-present | MINOR | MATERIAL | #1350 proved the old guard green with **zero** `/chat` requests |
| R7: leak paired-negative greps a string it just wrote | MINOR | MATERIAL | tautological negative |
| R7: zero-usage gate falls **open** on non-numeric `totalTokens` | MINOR | MATERIAL | the CAUTION anchor — a usage gate fell open, graded MINOR |
| R7: meta-scanner's declared population excludes caseless stubs | MINOR | MATERIAL | declared-vs-scanned population gap |
| R7: research-patch addendum headed with a commit that predates it | MINOR | IMMATERIAL | provenance label |
| R7: §7e.3(2) accepted divergence (disposition note) | MINOR | IMMATERIAL | not a defect |

**The 7-round loop was material-driven.** The length came from the worker reintroducing
fail-open shapes across four dispatch runs, not from reviewer nitpicking. Grading note: three
of round 7's «MINORs» are material under this audit's yardstick — the S4 seat *under*-graded
rather than over-graded; the real defect is that severity grammar nowhere requires a failure
scenario, so grades float (§6).

### #1358 (beta-delivery-ux R1, 3 rounds — the treadmill anchor)

| Round · finding | Orig | Class | Basis |
|---|---|---|---|
| R1: tarball cell not wired into `Makefile` | MAJOR | MATERIAL | a cell only CI runs, no author sees RED |
| R1: step (5) predicate weak (three weaker forms measured, rejected) | MAJOR | MATERIAL | discriminating assert |
| R1: LICENSE/README gating; over-ship table | MINOR ×2 | MATERIAL-b | record completeness for U10 |
| R2: cited `:11` is `"scripts"`, real line `:15` | MINOR | IMMATERIAL | citation precision |
| R3: fixing that dropped «publishable-intent» → «all four siblings» misstates the set | MINOR | IMMATERIAL + CHURN | introduced by the R2 fix; left open (verified still open at `getff-name-architecture-freeze.md:146`) |

Round 3 exists **only** because the round-2 immaterial MINOR was fixed, moving the SHA past
`pr-body-fidelity.ts:165` — the one round in the corpus triggered solely by an immaterial
finding. The body names the lesson itself: «each further edit to the same paragraph produced
a new MINOR, which is the signal to stop editing and disclose».

### Remaining loops (compressed; same yardstick)

| Loop | Findings → classes |
|---|---|
| #1290 (S-D′, 2 rounds) | R1: twin unsynced M · resurrected falsified ~53 KB figure M · falsified 4 B/tok constant → **lever ranking changed #4→#2** M · band misquote M-b · 10 stale line cites I · unshipped files cited M · revisit mechanics deleted M · census 18/18 M-b · broken links I · antecedents/fixture I×3. R2: floor-3708-vs-ceiling-3735 claim M-b · **6,904→6,903 rounding I · −21%→−20.5% I** |
| #1302 (S-M, 2 rounds) | code review: three stale prose anchors in comments («3 Tier-0»→2 etc.) I×3; fidelity R2 = history-rebuild re-establishment, 0 new findings |
| #1311 (6 rounds) | R1–R5 «each caught a real defect a green CI would have shipped»: dangling moved-to pointer dropping the `ENOENT` caveat M · shipped doc prescribing the just-deleted `/aif-*` block M · false «AIF is bundled» claim M · stale roster count M-b. R6 = merged-tree re-establishment; one MINOR (factory row missing 2 gated sub-agents) **left open deliberately** M-b |
| #1329 (2 rounds) | two Phase -1 BLOCKERs (false upgrade claim; unregistered parity gate) M×2; R2 adds the snapshot regen round-1 CI surfaced M |
| #1332 (1 round) | B1 partially-closed M; two citation MINORs I×2 |
| #1333 (5 rounds) | R3 tier not stamped on live path M; R4 committed bundle drifted → red CI gate M; R5 W-9 python provenance present-but-empty M (parked → became stage S1b) |
| #1349 (2 rounds) | R1 BLOCKER stale install fingerprints → deterministic red snapshot gate M; stderr leak M-b; three surviving mutations M. R2 GO, **0 new findings** |
| #1346 (1 round) | one MINOR text compression («Any F4b LANDING» vs «any landing») I — GO round 1, no round spawned |
| #1297 (kickoff Phase -1, 1 round, 2 reviewers) | 2 BLOCKER M×2 (ownership contradiction; wrong relocation targets); 10 MAJOR: 7 M (incl. **two evidence lines falsified at the cited SHA**: 33 rows not 12; 6 files not 2) + 3 M-b; 10 MINOR I×10 (citation nits, wording) — all applied inline, **zero extra rounds** |

## §5 Measured rates

**Findings** (classified corpus ≈ 104 findings across 12 loops + 1 Phase -1 review):

- MATERIAL: ≈ 52 (50%) · MATERIAL-b: ≈ 17 (16%) · IMMATERIAL: ≈ 35 (34%).
- CHURN (introduced by a prior round's own rework): ≥ 6 findings in 3 loops — #1360's three
  round-2 MAJORs (all rev-2-introduced) + its round-3 recurrence, #1358's round-3 MINOR,
  #1353's round-2 reintroduction. Churn skews **material** (5 of 6) — rework introduces real
  defects, which is the strongest measured argument FOR cold re-rounds after rework.

**Rounds** (25 follow-up rounds across 12 loops):

| Trigger of round N ≥ 2 | Count | Share |
|---|---|---|
| Material findings (REVISE or material-dominated rework) | 19 | 76% |
| Protocol/SHA (history rebuild #1302R2; merged-tree #1311R6; seat-independence #1353R3; operator-directed delta #1360R3) | 4 | 16% |
| **Solely immaterial findings** | **1** (#1358R3) | **4%** |
| Unknown (#1333R2 — round not narrated in body) | 1 | 4% |

**The hypothesis, measured honestly: rounds are NOT primarily immaterial-triggered — 1 of 25.**
The immaterial-finding cost is real but lives in three other places:

1. **Follow-up PRs.** Of the 3 finding-closure follow-ups, 2 (#1356, #1359) closed *only*
   immaterial findings, each a full PR cycle (8-gate test plans, snapshot runs, and in both
   cases an unplanned CI-flake/host-red investigation documented at length). #1359 exists
   because one immaterial MINOR named a *class*, and the sweep found 9 sites.
2. **The SHA treadmill.** `pr-body-fidelity.ts:165` requires `Audited-SHA` to prefix the PR
   head, so *any* fix — however trivial — either spawns a fresh cold round (~80–185k tokens
   per `cold-seat-economy.md §3`'s own measurements) or forces the leave-open + follow-up-PR
   branch. An immaterial finding thus converts into a real cost on **either** branch. #1358
   took branch 1 and got a new MINOR for it; #1353 took branch 2 and spawned two PRs.
3. **Finding-list padding.** ~34% of findings are immaterial; they don't trigger rounds but
   each must be dispositioned, carried in watch-lists (grown to 8–11 rows in #1341/#1358),
   and re-verdicted every subsequent round.

**Zero-finding-KPI probe.** GO rounds with zero new findings exist (#1349R2, #1302R2,
#1311R6) — so seats *can* return empty-handed. But among the 6 terminal/delta rounds that
followed an already-adjudicated tree (#1353R3, #1358R3, #1360R3, #1341R7, #1311R6, #1302R2),
4 returned ≥1 finding and in 2 of those (#1353R3, #1358R3) **every** new finding was
immaterial. Immaterial findings concentrate in late/delta rounds, where the substantive
surface has shrunk — consistent with the «zero-finding review feels failed» root at the
margin, on a small N (stated as suggestive, not proven).

## §6 Cap-coverage map (which loop carries no cap)

| Loop | Cap | Where | Held in window? |
|---|---|---|---|
| arch design reviews | 2 REVISE → surface as fork | `.claude/skills/arch/SKILL.md:87` | yes (#1325 ADR, v2, v3 all stopped at 2) |
| arch K-pass rework | 2 consecutive → surface | `arch/SKILL.md:68` | yes |
| harvest in-session audit | 2 rounds → escalate | `.claude/skills/harvest/SKILL.md:80` | overridden once, explicitly (#1360R3 «spending round 3 was the operator's call») |
| dispatcher rework (D6) | 2 **consecutive REVISE on unchanged kickoff scope**; resets on GO or scope change | `dispatcher/SKILL.md:194-197`; spec `2026-07-23-acceptance-contour-design.md:87-93` | yes — and that is the point: it bounds convergence-failure, not rounds |
| aif in-container review | `AGENT_MAX_REVIEW_ITERATIONS=1` | PR #1302 body; measured 9/209 tasks with iter>0 | yes |
| **GO-with-findings → fix → SHA-move → re-audit** | **none** | D6's own rationale (spec `:93`): «an audit-counting cap would make any PR that accepts review feedback unmergeable» | — this is the uncapped lane; #1358R3 lives here |
| **Cross-run stage loops** | **none** | each dispatch run / scope change resets the D6 counter, so #1341 reached 7 rounds with the cap never firing | — nothing bounds total rounds-per-stage |
| **Follow-up finding-closure PRs** | **none** (`FIDELITY: skipped`, no protocol) | #1350 #1356 #1359 | — no severity contract governs what deserves its own PR |

The D6 rationale for not counting audits is sound (D3 staleness forces re-audits; counting
them would punish accepting feedback). The gap is narrower than «no cap»: **nothing prices
the decision to convert a finding into a round, a SHA-move, or a PR.** Severity grammar is
the only pricing mechanism, and it is unpriced: `agents/fidelity-auditor.md:82` requires only
`BLOCKER | MAJOR | MINOR, with file:line`; `arch/SKILL.md:87` likewise. No grammar anywhere
requires a **failure scenario** — which is exactly the field whose absence lets a separator
byte and a fell-open usage gate share the grade MINOR (§4: S4 under-graded, S1b R3
over-shipped; both are the same missing field). One mitigation already landed in-window:
`pr-body-fidelity.ts:167-171` now names the cheap branch (push the audited commit as head)
for merge-forward-only moves.

## §7 Adversarial counter-prompt (T4/T7 — what category did this audit miss?)

Ran twice, rephrased. Surfaced, honestly:

1. **Kickoff-revision loops** — enumerated (§2: 6 getff-S1 revs + 7 S4 addenda, each its own
   PR with Phase -1-style review) but **not classified per-finding**. First-pass reading:
   S1's revs 4–6 are permitted-files-allowlist churn *whose own watch-list defends it*
   (#1333 W-5: «four revisions each discovered a forced-but-unlisted file» — material each
   time). Verdict: `INCONCLUSIVE — coverage insufficient` (T14), flagged as the next
   population if the advisor design wants a second corpus.
2. **Spec cold reviews in /arch contours** (#1325 + v2/v3): respected the 2-round cap; their
   round-2 REVISEs are in the memory record but not per-finding classified here. Same T14
   verdict. Note the operator-recorded recursion: TD-M3 — a review seat *pricing a value
   question* — is a materiality failure this audit's corpus cannot see, because it lives in
   accepted dispositions, not findings.
3. **Reviews that never happened** (the inverse population): nothing here measures defects
   that shipped because a loop stopped at its cap. One suggestive datum: #1311's rounds 3–5
   each caught a real defect that rounds 1–2 had not — a hard 2-round guillotine would have
   shipped them. Any cap proposal must carry this asymmetry.
4. **aif task-comment trails**: only `reviewIterationCount` was read (209 tasks), not comment
   bodies. The 9 iter>0 tasks' request_changes texts are unread — `INCONCLUSIVE`, small
   surface.

## §8 What the churn evidence changes

The audit brief asked for rework churn counted separately. Result: churn findings are mostly
**material** (5/6), and two loops' most valuable catches were churn-catches (#1353R2's
unbounded-`.*`; #1360R2's opposite-stating source). So the fix direction is NOT «fewer cold
rounds after rework» — re-rounds after rework demonstrably pay. The fix direction is «make
immaterial findings unable to *demand* rework», so rework (and its churn risk, and its round)
happens only when a failure scenario justifies it. #1358R3 is the corpus-complete
demonstration: an immaterial fix bought one churn finding and one extra round for zero goal
delta.

## §9 Closure proposals (input to the /arch advisor-pattern design)

Consult note (T11): these are protocol-shape proposals for an already-scoped in-repo design
(the advisor pattern), extending existing own-stack artifacts (verdict grammars, dispatcher
§2.4, fidelity-auditor agent); no new external capability area is introduced, so no new SSOT
entry is proposed. External sweep for the severity-contract concept ran at the wave-9 origin
(Goodhart / specification-gaming literature, kickoff §5.0); nothing here adds a tool.

1. **Severity contract — a `Failure-scenario:` field, mechanically required for
   round-triggering grades.** Only a finding carrying a concrete failure scenario
   (inputs/state → wrong outcome, or a named goal-impact) may be graded BLOCKER/MAJOR — i.e.
   may trigger REVISE. Everything else is **notes-lane** by construction: fixed same-round by
   the author or recorded open, never spawning a round, a SHA-move obligation, or a dedicated
   follow-up PR. Earliest reachable channel: the verdict grammars themselves
   (`agents/fidelity-auditor.md:82`, `arch/SKILL.md:87`) + a `pr-body-fidelity.ts` arm
   checking that any REVISE-carrying block's findings each have the field (syntactic presence
   only — substance stays with the seat; the presence check merely makes omission visible).
   Measured support: §5 (34% immaterial findings; 2 of 3 follow-up PRs immaterial-only; the
   one immaterial-triggered round).
2. **ESCALATED finding class** (the operator's premise, recorded pre-audit): a finding whose
   force rests on a value/materiality premise routes to the advisor seat (one-line ASK,
   answered ok/not-ok) instead of being priced by the review seat or disposed by the author.
   This audit's corpus support: the #1359 sweep decision (whether narrative-in-comments
   deserved a 9-site PR) was an author guess either way; a one-line ASK prices it in one
   turn. The TD-M3 recursion (review seat pricing a value question) is the same class from
   the reviewer side.
3. **Notes-lane merge rule — an open note never blocks and never moves the SHA.** Adopt
   #1353's pattern as the default protocol, minus its cost: GO-with-notes merges on the
   audited SHA; notes land in the PR body (as #1358/#1311 already did organically); a
   follow-up PR happens only if a note is later promoted (by ASK) to a failure-scenario
   finding. This deletes the treadmill branch (#1358R3) and the immaterial-only follow-up
   PR class (#1356, #1359 — the material #1350 class survives via promotion).
4. **Round-budget surfacing, not a round cap.** D6's rationale against audit-counting stands
   (§6). Instead: the verdict block gains a cumulative `Rounds-spent:`/token line per stage
   (the #1360 body already reports per-seat token costs ad hoc), and crossing a stated budget
   (e.g. 3 rounds) routes to the advisor as an ASK — «is this loop still buying goal-shift?»
   — rather than to a guillotine. #1311 (rounds 3–5 all material) is the case a hard cap
   would have gotten wrong; #1341's 7 rounds would have been ASKed at 3 and plausibly
   confirmed. Attention-is-not-a-mechanism compliance: the budget line is written by the
   seat, checked syntactically; the consumer is the advisor ASK, a named protocol, not «someone
   notices».
5. **Delta-round zero-finding legitimacy.** One sentence in the fidelity-auditor protocol and
   in `cold-seat-economy.md §3`: on a delta round, «no new findings» is the expected-positive
   outcome, and an immaterial-only finding list on a delta round is a *worse* outcome than an
   empty one (it converts zero goal-delta into cost). Targets the measured late-round
   concentration (§5). Prose-channel only — this is a norm, not a gate
   (`#gate-where-judgment-needed`).

## §10 Self-application (T15)

- **Did this audit run on itself?** Its own findings were held to the §1 yardstick: every §4
  row cites the defect site or the verifying command; findings with zero downstream effect
  are labelled IMMATERIAL even when listing them was tempting as volume. The classification
  disagreements with original grades are stated per-finding (S4 R7 under-graded; S1b R3
  over-shipped) rather than as a blanket «reviewers grade wrong».
- **T-RET-A check:** the audit proposes **no round** over any of its reclassifications — no
  historical PR should be reopened; §9 changes forward protocol only. Auditing the audit:
  its weakest joint is single-classifier materiality judgment (one session, no second
  seat); per §9's own contract, any dispute over a row here is ESCALATED-class (ask the
  premise-holder), not a rework demand.
- **Wave-9 warning heeded:** the hypothesis was NOT confirmed as stated — §5 leads with the
  1/25 round-trigger rate against the operator's expectation, and the cost was relocated to
  where the evidence actually puts it (follow-up PRs, SHA treadmill, padding). Both outcomes
  were declared valid in the wave-9 template; this is the honest one.

## §11 Confidence (T6 — predicates, not adjectives)

- Loop-level: **12/12 loops enumerated and read** (full population, not a sample), from PR
  bodies only — dialogue transcripts of the seats were not read.
- Finding-level: ~104 findings classified; **10/12 loops** deep-read; #1333's rounds 1–2 and
  #1341's rounds 1–3 reconstructed from summary lines (marked in §4). Coverage of the
  finding corpus ≈ 90%.
- Kickoff-revision loops + /arch spec reviews: enumerated, NOT classified —
  `INCONCLUSIVE — coverage insufficient to conclude` (T14).
- aif lane: 209 tasks counted mechanically; 9 iter>0 comment trails unread.
- Calibration: NONE — first run of the materiality methodology; single classifier; expect
  ≥20% dispute rate on MATERIAL-b rows until a second seat (or the advisor ASK lane)
  re-scores a sample. The 1/25 headline is robust to that dispute band: even reclassifying
  every MATERIAL-b trigger finding as immaterial moves no additional *round* into the
  immaterial-triggered cell (checked per-round in §5's tally — the borderline findings never
  travelled alone).
