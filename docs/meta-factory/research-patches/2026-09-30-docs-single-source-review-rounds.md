<!-- scope:docs-single-source-review-rounds -->
# Docs single source — /arch §2 cold review rounds 1 and 2 (dispositions)

> Scope: every finding of the two cold two-altitude reviews (`.claude/skills/arch/SKILL.md`
> Phase 2) of the top level of
> [2026-09-30-docs-single-source-design.md](../../superpowers/specs/2026-09-30-docs-single-source-design.md),
> with the lead's disposition and the advisor's checks. Copied from the coordination files
> `_design-docs-ssot-r6-review-dispositions-2026-09-29.md` and
> `_design-docs-ssot-r7-review-dispositions-2026-09-29.md` (outside the repo, not durable). Names
> starting with `_` and the snapshot / report names are those non-durable files, kept for
> provenance, not as links. `repo2` = a clean clone at `origin/staging` `26ccdc6b160`. Line
> citations inside the copied tables were read at `26ccdc6b160`; the spec re-resolves the ones it
> uses at `ab722237351`.

## Problem

A top-level design has to survive two fresh reviewers at two altitudes (top-down: does it meet
the goal; bottom-up: does it hold against the code) before the operator approves it. The review
record lived only in coordination files.

## Root Cause

The design sessions ran discussion-only (no repo edits), so the reports and dispositions could
not be committed while the rounds ran.

## Solution

Both rounds, both seats each, with every finding disposed (ACCEPTED / FIXED / DISSOLVED /
ESCALATED). Totals:

| Round | Snapshot | Top-down | Bottom-up | Forks to the operator |
|---|---|---|---|---|
| 1 | r6 (sha256 `a8907f11f9f0debe`) | REVISE: 0 BLOCKER, 10 MAJOR, 4 MINOR, 1 ESCALATED | REVISE: 0 BLOCKER, 3 MAJOR, 12 MINOR | ESCALATED-1 → OP-48; MAJOR-10 → OP-47 |
| 2 (cap) | r7 (sha256 `eef6637ce6a53745`) | REVISE: 0 BLOCKER, 3 MAJOR, 4 MINOR | REVISE: 0 BLOCKER, 1 MAJOR, 10 MINOR | MAJOR-C → OP-50 |

r8 carried the round-2 fixes without a third round (the cap) and was approved as OP-51 (sha256
prefix `6b4b25d17f00a4d7`); the spec is that text with re-resolved citations.

### Advisor checks (advisor seat, decisions file `_advisor-docs-ssot.decisions.md`)

| Entry | What was checked | Verdict (abridged) |
|---|---|---|
| E5 | round-1 dispositions | the lead's «none reverses an operator-decided row» holds except top-down MAJOR-10 (bare path = whole-file binding reversed OP-40 option A) → a card; answered OP-47 |
| E6 | round-2 dispositions | three rows hold with conditions (only a goal scope line is an EXTENDS; PENDING never green); top-down MAJOR-C is a fork → a card; answered OP-50 |
| E7 | row check of snapshot r8 | OK for the approval round after one must-fix and three wording fixes |
| E8 | hand-over note HO-1 … HO-13 | OK to send after three fixes (ids renamed H-n → HO-n to avoid register-row collisions) |
| E9 | the operator's word on landing (OP-53) | the landing is the lead's work |

Note on round 2's «Round result» paragraph below: it was written before E6 and calls MAJOR-C the
lead's pick; after E6 it became a fork, asked and answered as OP-50 (the table row and the E6
section say so).

### Round 1 — snapshot r6

Grammar: `.claude/skills/arch/SKILL.md` Phase 2. Dispositions: ACCEPTED (fix goes into r7),
FIXED (already fixed before this round, by E4), DISSOLVED (the finding does not hold, reason
given), ESCALATED (a value question for the operator).

Rule for the lead: a fix that REVERSES an operator-decided row is a fork and goes to the
operator. A fix that adds a mechanism UNDER a decided row is the lead's, checked by the advisor.

Evidence re-read by the lead for this file (repo2 = `origin/staging` `26ccdc6b160`):
- `packages/core/templates/shared/DESCRIPTION.template.md:7` «**NOT authoritative for:** project
  goal — see consumer's README.md.»; `:15` «**Runtime:** Node.js 22.23+»; `:52` «Architecture
  decisions: `docs/adr/`».
- `aif-upstream/aif.md:389` «Save `.ai-factory/DESCRIPTION.md` in resolved `language.artifacts`»;
  `:444-462` the passport skeleton with «[Localized heading: …]» sections, none of them goal,
  hard constraints or non-goals.
- `packages/core/skills/domain-modeling-vendored-body.test.ts:5-6` «It must NOT claim an upstream
  comparison»; `grilling-vendored-body.test.ts:24-27` «Comparing against upstream is the human
  re-census step».
- `.github/workflows/pin-freshness.yml:1-8` a scheduled, deterministic, fail-closed detector that
  fetches an external value and compares it with a recorded one (precedent for MAJOR-3's fix).
- `.claude/rules/git-conflict-merge-forward.md:68` «take either side, regenerate».
- `packages/core/templates/python/github-actions-ci.yml:43` `node-version: '20'`;
  `packages/core/package.json:19` `"node": ">=22"`.
- `INSTALL-FOR-AI.md:411`, `:425` the `<file>.override.md` layer.
- `setup.d/30-templates.sh:71` «NEVER clobber a consumer-edited DESCRIPTION.md».

#### Top-down report (VERDICT: REVISE; 0 BLOCKER, 10 MAJOR, 4 MINOR, 1 ESCALATED)

| Finding | Row(s) | Disposition | Fix for r7 / reason |
|---|---|---|---|
| MAJOR-1 goal line in an upstream-edited file, no gate | T-Q4, F3 | **FIXED** (E4, before this round) + ACCEPTED rest | E4 already extends F3 to the goal line, runs the F3 check inside the container (so an `aif-implement` task commit is checked there), and routes agent-written reason tokens to the M4 cold agent. r7 adds: an ADDED line in the decided region fails the same way as a changed one. The M4 audit itself needs a trigger: see MAJOR-8 |
| MAJOR-2 passport format cannot carry the decided lines at a consumer | T-Q4, F3 | ACCEPTED | Under OP-42 (home = passport), not reversing it. r7: the decided lines live in ONE getff-owned marked region of the passport (stable markers, not localized headings); F3 binds to the markers; a passport with no region is red, not vacuously green. The shipped template's `:7` line («NOT authoritative for: project goal») flips; its Node/TS «Hard constraints» (`:15`, `:33`) are stack facts and go to the generated part (C-Q1). T-Q4 falsifier widened: «… or no marked region survives AI Factory's own passport writes». Hand-over row: the python lane ships Node/TS constraints today (`setup.d/45-python.sh:1620`) | <!-- cite:historical read at 26ccdc6b160; the line is :1657 at ab722237351 -->
| MAJOR-3 F7 upkeep is the human re-census the precedent disclaims | F7 | ACCEPTED | The comparison file's wording («a re-census that sees a new upstream sha fails») was ambiguous and the precedent test cannot do it. r7: upkeep = a scheduled deterministic check on the pattern of `pin-freshness.yml`: fetch the upstream file's current blob sha, fail when it differs from the recorded `cda4542ade0f` version. The re-read after a red is agent work. Known open detail: who picks up a red scheduled run (same gap as `pin-freshness.yml`) |
| MAJOR-4 no local channel or writer on cargo / go / python-without-Node | N-Q3, statement 3 | ACCEPTED (as consequence, advisor E5 condition) | Under OP-40, not reversing it. r7 states: write operations (render, relink) need Node where the fix is made; on cargo and go the CI arm is the earliest reachable channel (invariant 5 is «earliest reachable»). **The fixing agent obtains the runtime itself; the human is never asked to.** The cost is named on the approval card, since the only way to remove it (a non-Node engine) reverses N-Q3. Falsifier added to N-Q3: «a cargo or go consumer's docs red is fixed by hand more often than by the agent». Hand-over: python CI pins Node 20 against `>=22` |
| MAJOR-5 getff docs shipped as files carry getff-bound sources | F4, H-Q2 | ACCEPTED | Under OP-38. r7: getff's docs at a consumer are a THIRD class, «vendored at version»: checked at getff, not by the consumer's gate; excluded from the consumer's zeros; refreshed only by an install at a new version. Statement 4 and H-Q2 say so |
| MAJOR-6 «agent generates at install» has no trigger; the bash installer runs no agent | C-Q1, statement 4 | ACCEPTED (hand-over) | Mechanics owned by the one-button design (C-Q1 row). r7 requirement to hand over: (1) the generation step is an agent step of P1, on install AND on refresh; (2) a consumer with the engine but no bindings is RED («not generated yet»), never vacuously green |
| MAJOR-7 history class swallows specs, the live home of design decisions | H-Q2, H-Q4, F1 | ACCEPTED (advisor E5 agrees, SSOT #255) | r7: a spec is a dated record (history) once its design is built. A live doc may point at a spec for RATIONALE: a navigation link, existence check only. A decision a live doc needs as a rule is stated in the live artifact that enforces it. H-Q4 bans history only as the source of a FACT. Open detail (E5): a spec not yet built is the only home of its decisions, so it is live until it lands, as a kickoff is live until its umbrella closes |
| MAJOR-8 M4's audit has no auditor at a consumer and no trigger in getff | M4 | ACCEPTED | Under OP-41. r7: every relink without a page edit is recorded in the lock with its reason; a deterministic gate at the PR boundary (pre-push where there is no PR) fails when such relinks exist and no structured audit verdict from the named agent is present (the pattern of the `## Fidelity verdict` gate). The named agent ships to consumers (added to P3) |
| MAJOR-9 lock conflict + «take either side, regenerate» = mass mute | R1, statement 3 | ACCEPTED | r7: the lock is a VERIFICATION RECORD, not a generated file. Nothing regenerates it wholesale; a signature changes only by a relink (with its record) or by an edit of the bound page in the same commit; a gate rejects any other signature change. One line per binding keeps conflicts to the same binding. Hand-over: `git-conflict-merge-forward.md` names the lock as the exception to «regenerate» |
| MAJOR-10 bare-path exemption becomes the easy path | B-Q2, F9 | **ESCALATED** (advisor E5) | The lead was wrong: «bare path = navigation» is option A of round-2 Q2, chosen by the operator (OP-40 «2 А», row B-Q2, draft `:1315`); whole-file binding is the rejected option Б. The finding is real, so it is a fork card: (A+) keep A and add a check on NEW bare paths at the PR boundary, or (Б') flip the default to whole-file binding with an explicit navigation form. Replay over 50 merges (`scratchpad/binding-run.json`, lead's recount): named places raised 27 alarms on 12 merges; 354 page-changes were cited only by bare path (50 pages, 27 merges; `install.sh` in 48, `setup.d/lib.sh` in 44). Under A+ those 354 stay silent and only new bare paths meet the check; under Б' they become alarms, 381 in total (about 7.6 per merge against 0.54), until the sweep migrates the pages. **Operator chose A+ (OP-47)**: r7 carries B-Q2 amended A+ |
| MINOR-1 abandoned umbrellas never get `done.md` | H-Q2 | ACCEPTED | r7: an umbrella with no `done.md` and no commit for N days is classed history mechanically (N below the top level). H-Q2 falsifier reworded to test the predicate, not a presence rate |
| MINOR-2 shipped passport points at `docs/adr/` | R3 | ACCEPTED (hand-over) | Template `:52` goes; row in the hand-over (P4) |
| MINOR-3 two copies of the docs-author core | F6, F7 | ACCEPTED | r7: `docs-author` keeps only the site part and points at the shipped core. The file is the site seat's (F2): a hand-over row, not an edit here |
| MINOR-4 `<file>.override.md` not enrolled | F5, statement 2 | ACCEPTED | r7: an override sibling of an enrolled entry file is enrolled the same way (render or pointer) |
| Note: R1 vs SSOT #284 | R1 | ACCEPTED (landing) | The capability commit amends row #284 (anchor model ≠ `sources:` model, T16) |
| Note: Node 20 on python CI | N-Q3 | ACCEPTED (hand-over) | see MAJOR-4 |
| Note: H1 host line ends in `harvest.ts:58-60` | H1 | ACCEPTED (known open detail) | Recorded; H1 moves the traffic, the manual end stays a named open detail |
| Note: F5 «8 places» vs 5 named | F5 | ACCEPTED | The eight are `DOWNSTREAM_DOCS` in `packages/core/audit-self/audit-ai-docs.ts:42-60` (draft `:1147`): the five named plus `CLAUDE.md` and the two site pages `docs/site/reference/D/inject-session-bootstrap.md`, `inject-subagent-digest.md`. r7 cites that list | <!-- cite:historical :1147 is a line of the coordination draft, not of the repo -->
| Note: S-Q0 falsifier has no proportion | S-Q0 | ACCEPTED | r7 states the measured proportion or marks it unmeasured |
| Note: R3 lazy `docs/adr/` at consumers | R3, H-Q2 | ACCEPTED | r7: `docs/adr/` records are dated records (history) at a consumer as in getff |
| ESCALATED-1 untracked homes (coordination files, agent memory) in scope? | goal | **ESCALATED → DECIDED A (OP-48)**: memory narrowly in, coordination drafts out (row SCOPE-U). Was: a value question for the operator. Input: an earlier seat already put memory IN scope as its own call, not the operator's (draft `:411`, row T13: «Memory is NOT exempt … it never restates a value»); r5/r6 did not carry it. Coordination files were never scoped |

#### Bottom-up report (VERDICT: REVISE; 0 BLOCKER, 3 MAJOR, 12 MINOR, 0 ESCALATED)

Re-read by the lead for this part: `scripts/render-invariants.mjs:3` «renders the session
digest's `INVARIANTS_LINE` from README.md»; `.claude/hooks/inject-session-bootstrap.sh:73`
`# <!-- getff:begin section=invariants-line plan=scripts/render-invariants.mjs -->`;
`scripts/render-face-facts.mjs:16` «the flags list under README.md's "`./setup` ... Flags:"»;
`docs/site/face-facts.json:88` `"flags": "README.md:147"`; ten `scripts/render-*.mjs`; <!-- cite:historical README.md:147 is a quoted JSON value in face-facts.json -->
`_design-2026-09-29-trigger-build-v2.md:155` «D10 | … | answered `[op V1]` Q1 = A»;
`packages/core/hooks/pre-push.ts:2245` `'.ai-factory/DESCRIPTION.md',` in the shipped-md list.

| Finding | Row(s) | Disposition | Fix for r7 / reason |
|---|---|---|---|
| MAJOR-1 F7 upkeep has no firing brick | F7 | ACCEPTED, **FIXED** in the comparison file | Same finding as top-down MAJOR-3, found independently. The comparison file now names a scheduled check on the `pin-freshness.yml` pattern; r7 carries it |
| MAJOR-2 existing renderers not named; `render-invariants.mjs` keeps README as a second home | F5, T-Q4, F1 | ACCEPTED, **shown to the operator by name** (advisor E5) | r7 «Measured facts» lists the ten renderers and the D3 probe (`audit-ai-docs.ts:39-59`) as bricks the one mechanism absorbs. F5 adds: the goal AND the invariants render from the ONE decided region of the passport; `render-invariants.mjs` is re-sourced, not duplicated; D3 checks against that region. README stops being the home of the invariants: OP-42 did not say this in words, so the approval card names it. Hand-over (digest): `render-invariants.mjs:13-16` explains why it renders INTO the hook source (a consumer runs the plugin twin); the digest requirement «print the PROJECT's goal» must solve exactly that |
| MAJOR-3 the layer takes `./setup` flags from README prose: a closed render loop | S-Q0, statement 1, F10 + R2 | ACCEPTED | r7: a fact-layer `source` never points into a rendered entry doc; a gate rejects such a source. The `./setup` flags are derived from `setup` itself. S-Q0 falsifier text corrected: `./setup` flags ARE held today (from the wrong source); `install.sh` flags are not |
| MINOR-N1 numbers measured at `26ccdc6b160^1`, not the named base | measured facts | ACCEPTED | r7 uses the base values: 1573 tracked md, 65 tokens on 60 of 61 pages, 20 stale of 27, 723,820 B. The substance does not change |
| MINOR-N2 «nine of eleven families read by no page» | measured facts | ACCEPTED | r7: all 11 family COUNTS render on `docs/site/index.md:48-62`; only B and D have pages rendering their MEMBERS |
| MINOR-N3 goal typed in 7 places | F5, measured facts | ACCEPTED | r7: seven, adding the two site pages (`inject-session-bootstrap.md:75`, `inject-subagent-digest.md:67`); matches top-down's F5 note |
| MINOR-N4 trigger-build D10 is answered | hand-over | ACCEPTED | r7 drops «open fork D10», cites `trigger-build-v2.md:155` |
| MINOR-N5 F7 arithmetic | F7 | **FIXED** | Comparison file: +16 (not 14), gold 770 / 629, `ai-doc` 25 non-blank (36 total). The choice A does not depend on these numbers |
| MINOR-N6 OpenAPI «mechanism» overstated | F7 | **FIXED** | Comparison file: a shipped rule whose check is a placeholder (`rules-manifest.json:419`); the drop stands |
| MINOR-N7 passport classed as shipped markdown at a consumer | T-Q4, F3, ACC | ACCEPTED (hand-over) | `pre-push.ts:2245` must stop dropping the passport from the consumer walk once it is the decided home |
| MINOR-N8 two carve-outs to «installers do not overwrite» | T-Q4 | ACCEPTED | r7 cites both: `setup.d/lib.sh:889` (`--force` clobbers) and `agents/aif-init.md:191` (`<PLACEHOLDER>` files are overwritten). `--force` must not clobber the decided region; F3 goes red if it does |
| MINOR-N9 snapshot dropped T-Q4b and the stack-facts interaction | T-Q4 | ACCEPTED | r7 carries row T-Q4b and the «AI-Factory-written passport sections» open detail (this was already planned) |
| MINOR-N10 measured facts without artifact paths | measured facts | ACCEPTED | r7 cites the evidence files; landing copies them into a research-patch, since the scratchpad is not durable |
| MINOR-N11 stale OPEN status in the comparison file | F7 | **FIXED** | lines 5 and 82 now record OP-46 |
| MINOR-N12 no SSOT row for the addyosmani upstream | F7 | ACCEPTED (landing) | A new `prior-art-evaluations.md` row in the capability commit, with the #284 amendment (top-down note) |
| Observation: `repo2` has the lead's untracked `_typed-facts.mjs` | — | DISSOLVED | Lead's scratch; no measured number depends on it being absent |

#### Round result

Both seats: REVISE, no BLOCKER. 13 MAJOR in total, two of them the same finding (F7 upkeep).
Advisor check E5 (`_advisor-docs-ssot.decisions.md`): the lead's claim «none reverses an
operator-decided row» holds for every row EXCEPT top-down MAJOR-10, which is now ESCALATED.
Asked now (they shape r7): ESCALATED-1 → OP-48 A, MAJOR-10 → OP-47 A+.
Named on the later approval card: MAJOR-4's cost (Node where the fix is made) and bottom-up
MAJOR-2 (README stops being the home of the invariants). Next: snapshot r7, then REVISE round 2
of 2 (cap).

### Round 2 (cap) — snapshot r7

Round 2 is the cap (`.claude/skills/arch/SKILL.md`: «cap **2** REVISE rounds, then surface the
disagreement to the operator as a genuine fork»). So every finding that is a genuine fork goes
to the operator; the rest are fixed in r8 without a third review round.

Evidence re-read by the lead for this file:
- Draft row T12.5 (`:412`): «EXTENDS → the AI appends a scope line itself, no question, FYI at
  promote. CONFLICTS/CHANGE → the one consent card (T12.6)» — answered OP-9, OP-16.
- Draft row T12.6 (`:409`): «A copy of the AI's one-sentence summary counts as consent, and so
  does the operator's own restatement. A bare «го» … does not count … the independent channel
  stays the second look at promote» — answered OP-15, confirming OP-10.
- One-button map (`_advisor-one-button-map-2026-09-29.md:29`), operator-sourced `[op]`: «One
  agent session installs everything: AI tools, rules, tests, AI docs».
- `.claude/rules/memory-codification.md:18`: memory is enforceable «only at write-time … via
  local audit … never by a repo test or CI gate»; its channel is the hook
  `.claude/hooks/inject-memory-codification.sh` plus `agents/memory-codification-auditor.md`.

#### Top-down report (VERDICT: REVISE; 0 BLOCKER, 3 MAJOR, 4 MINOR, 0 ESCALATED)

Round-1 closure per the seat: 8 CLOSED, 6 PARTLY (their residues are MAJOR-A/B/C and MINOR-A/C
below), 0 NOT CLOSED.

| Finding | Row(s) | Disposition | Fix for r8 / reason |
|---|---|---|---|
| MAJOR-A an agent can change a decided line with only an agent approving | F3, statement 5 | ACCEPTED, **answered by earlier operator decisions** (T12.5 OP-9/OP-16, T12.6 OP-10/OP-15), not a new fork | The operator already decided how a goal change is authorised when README was the home: EXTENDS = an appended scope line, no question, FYI at promote; CHANGE / CONFLICT = the one consent card, whose trailer carries a copy of the AI's summary or the operator's restatement, never a bare «го»; the independent channel is the second look at promote. r8 carries these two rows over to the passport region: F3's «reason token» becomes the T12.6 consent trailer for a changed or removed line; an added line is an EXTENDS (FYI at promote). The honest cost stays as T12.6 wrote it: a trailer proves the sentence was read, not who typed it; the promote look is the human floor. Shown to the operator by name |
| MAJOR-B a docs red outside an agent session has no actor (terminal install; CI-only lanes) | statement 3, 4, C-Q1, N-Q3 | ACCEPTED; main channel answered by the one-button `[op]` row | The operator's one-button goal is one agent session installing everything (map `:29`), so generation happens in that session. r8: on the bash-only channel «not generated yet» is a PENDING state, not a red; the next agent session's start hook sees it and the agent generates (a deterministic trigger into an agent, not a human relay); the own-configs CI cell runs off committed fixture bindings (precedent: its generator arm). Hand-over requirement to the one-button design: a consumer's CI docs red reaches an agent without a human relaying it. Shown to the operator by name |
| MAJOR-C a value typed with no citation is held by no gate; SCOPE-U has no detector | F9 + B-Q2, ACC, SCOPE-U | **ESCALATED → DECIDED A (OP-50)** (advisor E6: widening the OP-47 gate is a fork; option (c) is real and cheaper under OP-38). Memory half ACCEPTED. Firing rate, last 50 first-parent commits at the base, rough grep: 26 change live markdown, 24 add a line with a digit to it, 22 add a backticked path (the OP-47 trigger); both gates are one agent run per PR. Lead's former reasoning kept below | Option (c) («current by mechanism» covers only cited values) narrows the operator's goal, so it is not the lead's to take; option (b) is a scheduled sweep whose red has no consumer (MINOR-C's defect). So (a): the B-Q2 PR-boundary gate and its named agent also cover TYPED VALUES in new or changed prose: each is fenced, cited to a place, or classed by the agent as not a fact. For memory, SCOPE-U's detector is the existing write-time channel (`inject-memory-codification.sh` + `memory-codification-auditor.md`), the only channel `memory-codification.md:18` allows; r8 names it. Shown to the operator by name |
| MINOR-A idle-umbrella clock reset by corpus-wide commits; class by clock | H-Q2 + H-Q4 | ACCEPTED (open detail) | r8: the idle clock counts only commits that touch this umbrella alone (a commit touching many umbrellas, e.g. `9da7dd452a6` over 282 files, does not reset it); the class file is written by the classifier, not inside the umbrella directory. A live doc that turns red because its cited kickoff became history is a real alarm, not noise |
| MINOR-B no predicate for «a spec's design is built» | H-Q2 + H-Q4 | ACCEPTED (open detail) | r8 lists it: the predicate is tied to the spec's umbrella closure (`done.md`), measured before landing |
| MINOR-C F7 upkeep red has no consumer | F7 | ACCEPTED (hand-over) | Same class as MAJOR-B's getff-side gap. r8 moves «who picks up a red scheduled run» from open detail to a hand-over requirement: a scheduled red reaches an agent (an aif task or equivalent) without a human reading the log |
| MINOR-D AI Factory also writes the consumer's AGENTS.md with a paraphrased goal | F5, T-Q4b | ACCEPTED | r8: T-Q4b's scope and the region-survival open detail extend to AI-Factory-written AGENTS.md; its paraphrase line (`aif.md:672`) must become a render or pointer |
| Note: verdict gate escape token | M4, B-Q2 | ACCEPTED | r8: the M4 / B-Q2 verdict gates carry no «skipped» escape (that would be the deferral token again) |
| Note: B-Q2 gate fires on about half of merges | B-Q2 | NOTED | a cost of the decided A+; agent work, not human |
| Note: lock and merge commits | R1 | ACCEPTED (open detail) | below the top level: «same commit» on a merge commit is judged against both parents |
| Note: T-Q4 region survival unmeasured | T-Q4 | NOTED | open detail already; the upstream channel `aif.md:87-89` (skill-context rules for DESCRIPTION.md) is named as the first thing to try |
| Note: decisions still in coordination drafts | SCOPE-U | ACCEPTED (landing) | landing carries OP-1..OP-49 and both dispositions files into the repo (research-patch) |
| Note: VENDORED class boundary | statement 5 | ACCEPTED | r8: the boundary is the existing shipped-markdown list (`pre-push.ts:2245`) |

#### Bottom-up report (VERDICT: REVISE; 0 BLOCKER, 1 MAJOR, 10 MINOR, 0 ESCALATED)

Round-1 closure per the seat: CLOSED except MAJOR-3 and MINOR-N10 (PARTLY; residues are MINOR-1
and MINOR-9 below). F7 comparison corrections: all CONFIRMED; upstream still at `cda4542ade0f`.

Re-read by the lead: `grep -c DESCRIPTION` over the install fingerprints → 0 on all four cargo
and go files, 2 on each python file; `install.sh:675-683` cargo / go `exit 0` before the npm
layers; `plugin/hooks/` has no `*session-bootstrap*` (0); `render-invariants.mjs:17-18` «(b) the
hook fires on every prompt and must survive a stripped PATH … no awk/sed/node parse on the hot
path»; `audit-ai-docs.sh:155` `CANON_PHRASE=…`, shipped by `setup.d/40-configs.sh:14`.

| Finding | Row(s) | Disposition | Fix for r8 / reason |
|---|---|---|---|
| MAJOR-1 cargo and go lanes install no passport and no agent surface | T-Q4, statement 4, P-rows | ACCEPTED (hand-over), follows the one-button `[op]` scope | The operator's one-button goal is «one agent session installs everything: AI tools, rules, tests, AI docs» (map `:29`), on every lane. So the passport, the rule, hooks, skills and agent surface reach cargo and go too; that is the installer's job (P2 «the installer on any project», P4). r8 records the measured fact (cargo / go deliver no passport today) and adds the hand-over row; until then those lanes are named as not yet delivering the design, never scored green |
| MINOR-1 «no render loop» rule has no gate and no migration item | statement 1, S-Q0 | ACCEPTED | r8: the fact-layer schema check rejects a `source` inside a rendered file; migration item: re-source `face-facts.json:88` from `setup` |
| MINOR-2 digest «trap» rests on a stale comment | hand-over (digest) | ACCEPTED | r8: the plugin twin is gone (`8a00bbc2e0b`); the live constraint is reason (b), `render-invariants.mjs:17-18`, no parse on the hot path; the consumer hook `inject-project-digest.sh:8-9` already reads the consumer's tree |
| MINOR-3 the shell twin of D3 ships to consumers with getff's phrase | F5, N-Q3 | ACCEPTED | r8 names `audit-ai-docs.sh:155` (shipped by `setup.d/40-configs.sh:14`) next to the `.ts` probe; both re-source to the region; the shell twin is a second gate implementation against N-Q3, listed for P3 |
| MINOR-4 tagline typed in four more places; README holds no one-line goal | F5, T-Q4 | ACCEPTED | r8: 7 canonical + 4 tagline places (`packages/getff/package.json:5`, `packages/getff/README.md:3`, `packages/getff/bin/getff:33`, `docs/site/reference/G.json:29`); the region is seeded from README §Why by the operator's consent card (T12.6), never from a rendered constant |
| MINOR-5 P4 line numbers | P4 | ACCEPTED | r8: the Node/TS lines are `:15-27` and `:33-38` |
| MINOR-6 no spec-closure predicate; 91 specs, free-form status | H-Q2 + H-Q4 | ACCEPTED (open detail) | merged with top-down MINOR-B |
| MINOR-7 two citations need full paths | hand-over | ACCEPTED | r8: `packages/core/templates/python/github-actions-ci.yml:43`, `.claude/skills/docs-author/SKILL.md:20-33`, `packages/runtime-bridge/src/cli/harvest.ts:58-60` |
| MINOR-8 pickup gap real (8 of 8 `pin-freshness` runs red by design); stale «sha test» wording | F7 | ACCEPTED, wording **FIXED** | comparison file `:108`, `:114` now say «scheduled upstream check»; the pickup is a hand-over requirement (top-down MINOR-C) |
| MINOR-9 doc set behind «20 of 27» not named | measured facts | ACCEPTED | r8 names the set and the command (README, INSTALL-FOR-AI, INSTALL, EXECUTION-PLAN, first-steps.source.json; `check-line-citations.mjs --check --show-skips`) |
| MINOR-10 no channel runs the citation check on memory | SCOPE-U | ACCEPTED | r8: SCOPE-U's channel is write-time (the memory-codification hook) plus the named auditor; the citation tool works on a memory file (measured: 2 stale in one file) and the auditor runs it. Same as top-down MAJOR-C's memory half |

#### Round result

Round 2 of 2 (cap). Both seats REVISE, no BLOCKER. MAJOR: top-down 3, bottom-up 1. None is a new
fork by the lead's reading: MAJOR-A follows T12.5 / T12.6 (OP-9, OP-10, OP-15, OP-16); MAJOR-B and
bottom-up MAJOR-1 follow the one-button `[op]` scope; MAJOR-C is the lead's pick among the seat's
options because the alternatives narrow the goal or have no consumer. All four are shown to the
operator by name on the approval card. No third review round (cap); r8 carries the fixes and goes
to the advisor for a row check.

#### Advisor check E6 (applied)

- MAJOR-A: no fork, with a limit: only a GOAL SCOPE LINE is an EXTENDS (OP-9 `:48-54`, OP-16
  `:876-881` speak of the goal); an added «never» line, invariant or non-goal takes the consent
  card. Applied in r8 F3. T12.6's honest cost named on the approval card.
- MAJOR-B: no fork; PENDING is never scored green (install report and CI arm show it not done).
  Applied in r8 statement 4.
- MAJOR-C: FORK → one card to the operator (above).
- Bottom-up MAJOR-1: no fork.

## Prevention

- The rule the lead applies, stated in round 1: a fix that REVERSES an operator-decided row is a
  fork and goes to the operator; a fix that adds a mechanism UNDER a decided row is the lead's,
  checked by the advisor. Both slips of this design (MAJOR-10, MAJOR-C) were caught by the
  advisor's row check, not by the lead.
- Implementation slices are verified against the spec, not against these reports.

## Tags

`docs-single-source`, `arch`, `cold-review`, `dispositions`, `advisor`

## §1.7 self-review

- **Forward check.** Every finding of both rounds appears in a table above with a disposition;
  the counts in the totals table match the section headings of the copied files.
- **Backward check.** Copied from the coordination files by line range; only heading levels were
  demoted and the note on round 2's stale «Round result» paragraph was added.
- **Limits.** The four reviewer reports themselves are not landed (only the dispositions, per
  the advisor's landing scope in E9); a finding's wording here is the lead's summary of it.
