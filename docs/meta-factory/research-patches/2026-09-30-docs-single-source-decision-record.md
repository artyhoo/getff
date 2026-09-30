<!-- scope:docs-single-source-decision-record -->
# Docs single source — decision record (OP-1 … OP-55)

> Scope: every decision behind
> [2026-09-30-docs-single-source-design.md](../../superpowers/specs/2026-09-30-docs-single-source-design.md),
> by its reason first and its OP id second. OP ids are provenance, so a spec or patch line that
> cites one can be traced. They are not an argument for keeping a row: a row stands on its reason
> and its falsifier (spec, «Revising a decided row»). The full verbatim dialogue stays in the
> coordination draft `_design-2026-09-28-truth-pipeline.md` §1 and §9.1, outside the repo.

## Problem

The design's decisions were taken over four sessions in a dialogue with the owner. The repo needs
each decision and its reason, not the dialogue. A reader who opens a register row must be able to
see why it holds and what would overturn it.

## Root Cause

The sessions ran discussion-only, so decisions were first written as a chat log in a
coordination draft. A chat log records who said what; it does not state reasons in one place.

## Solution

One row per OP id. «Rec.» marks a decision that followed the seat's recommendation. A short quote
appears only where the owner's wording is itself the decision (English gloss after it).

### Problem statement and principles (OP-1 … OP-19)

| Decision | Reason | Register effect | OP |
|---|---|---|---|
| The docs mislead, and the fix must stop them lying rather than add more docs | AI writes the docs and nothing checks them against code; a human does not write them | the problem statement of the design | OP-1, OP-3 |
| Everything installs with one button | a manual install step is a defect | the one-button design owns install; this design hands rows to it (HO-1 … HO-9) | OP-2 |
| Integrate with the site's one-source design instead of a parallel scheme | two schemes for the same facts drift apart | picture statement 2 (one docs set) | OP-4, OP-5 |
| Improve on the integration note, do not restate it | the ask was a better design, not a summary | — | OP-6 |
| A goal EXTENSION is recorded without a question; a goal CHANGE or contradiction needs the owner's consent | an extension refines the goal and helps the AI understand it; a change moves what the project is for | rows T12.5 / T12.6, carried over to the passport region (F3) | OP-7, OP-9, OP-16 |
| Check whether the project outgrew its stated goal | the stated goal may no longer describe the project | the goal-vs-reality inventory (draft §6.8) | OP-8 |
| A copy of the AI's one-sentence summary counts as consent | copying it implies reading it; a harder form costs convenience with no gain | row T12.6 (honest cost named at approval: it proves reading, not who typed it) | OP-10, OP-15 |
| The consumer's passport and architecture at install time are the core question; the truth pipeline and goal governance are also owed | this answer is owed to the one-button design | scope of the design | OP-11, OP-12 |
| One source with no duplication for everything in getff itself, not only at consumers; the project applies its own rules to itself | recursive self-application is the project's principle; duplication and staleness in getff confuse AI agents | row T13 answered yes; scope «all documentation» | OP-13, OP-14, OP-15 |
| Convenience first: every human touchpoint must justify itself as critical and narrow; the rest is automatic with an FYI and a one-step revert | a framework that keeps putting obstacles in the way is not used | a design lens applied to every row | OP-16 |
| The AI gives its own argued judgement, including disagreement, not passive agreement | the goal is the best design, not agreement | process (flipping T12.5 twice was the trigger) | OP-17 |
| Is there one source for ALL documentation, including the passport and architecture, and is it a shipped principle? | the question that opened r4 | scope of r4 | OP-18 |
| One source of truth for all documentation, for the AI and for the human, always current, shipped to consumers as a principle | the owner's ask of r4 | the design's goal line | OP-19 |

### Forks of r4 (OP-20 … OP-43)

| Decision | Reason | Register effect | OP |
|---|---|---|---|
| One pipeline, two projections: the project is the source; no document is a source | a document as source is a second home for a fact | F1 = A | OP-20 |
| No new skill: the one-source rule lives once, in the shipped doc rule file; `ai-doc` (AI docs) and `docs-author` (human pages) point at it | reuse what exists; a third skill would be a third home for the rule | F6 = hybrid A + В (raised by OP-21) | OP-21, OP-22 |
| Gates first (citation corpus widened, deferral token repaired), then the shared writers; site page content stays with the site seat | a writer without a gate drifts again; condition: re-check the site session (done) | F2 = A | OP-23 |
| Protect the passport's decided lines with a test: «на пару строк можно и тест защитный» (a protective test is fine for a couple of lines) | the only other protector (an intent file with a hash) was dropped by the one-button design | F3 = A; later extended to the goal line, run in the container with the docs gate | OP-24 |
| No ADR folder; decided lines live in the passport | an ADR folder would be a third home for the same decisions | R3 = A; F8 left open then closed by R3 | OP-25, OP-26, OP-37 |
| Discuss before deciding; nothing is treated as settled because it was mentioned | the ADR question had an earlier reason that must not be assumed away | process; F7 and F8 re-opened | OP-27 |
| Take the idea from the docs site and the fact card: generate from what is generated from the source; «change one, change all» | reuse the mechanism that already removes duplication | picture statement 1 (fact layer) | OP-28, OP-29, OP-30 |
| Generate docs the way API docs are generated (Swagger, DeepWiki): processed once, kept, for the AI and for the human | a generated reference cannot drift from the code | F10 raised; fact layer | OP-31 |
| A fork is decided only by an explicit choice; a skipped question stays open | a silent default is a decision nobody took (superseded in part by OP-54 / OP-55: a row stands on its reason) | process | OP-32 |
| AI docs and human docs are both outputs of one docs set; each audience reuses its own output | the site already has both kinds; the consumer should too | F10 = A: one docs set, two outputs, instruction files thin | OP-33, OP-34, OP-35 |
| Bind each page to named places of its sources; alarm only when that place changes: «можно определить для каждой доки за чем следить конкретно» (for each doc we can say exactly what to watch) | a whole-file binding raises mostly noise (replay: 27 real of 626) | F9 = В | OP-35 |
| Own binding gate with a lock file, working on Windows, macOS and Linux | no ready tool fits the named-place model on all three | R1 = Б | OP-37 |
| Entry docs are thin: render or pointer | a typed copy in an entry doc drifts | R2 = A | OP-37 |
| Consumers get the rule as a file, the gates, and getff's docs at the installed version | the consumer's docs must follow the same rule without getff's content | F4 = Б; the rule file's home handed to the trigger-build design | OP-38 |
| History is a named class, exempt from currency, and must not mislead an agent | old records are needed but must not be read as current | H-Q2 = A (+ OP-39 requirement) | OP-38, OP-39 |
| Done = three zeros (tokens, stale citations, unclassified docs), on the condition that each zero is reachable and not a burden | a measurable end state, bounded by effort | ACC = A with a condition | OP-38 |
| Statements that cannot come from code have one home; all else points or renders | decided statements are facts with no code source | T-Q2 = Б | OP-39 |
| A generated, checked fact layer between sources and both outputs: «да слой фактов!» (yes, a fact layer) | the site already has one; both outputs read it | S-Q0 = yes | OP-40 |
| Nobody types the goal; always-loaded places render it, others point | seven hand-typed copies had three wordings | F5 = A | OP-40 |
| A bare path is navigation; a claim names its place; one sweep migrates old pages | a named place is what makes an alarm real | B-Q2 = A (amended OP-47, widened OP-50) | OP-40 |
| One Node implementation of the gates, a CI arm on every lane | two implementations drift | N-Q3 = A | OP-40 |
| Classes by a directory list in one file; «главное чтобы ии не путало» (above all, the AI must not be confused) | an agent that reads history as current acts on stale facts | H-Q4 = A | OP-40 |
| getff gets the same passport a consumer gets; the installer puts a common base and the agent generates the rest; the session digest shows the project's own goal | getff applies to itself what it ships | T-Q4 re-opened; C-Q1 decided in the owner's words | OP-41 |
| A human-docs skill ships, made by reuse | reuse over build | F7 = Б (which skill: OP-46) | OP-41 |
| Relink is one action with a reason, audited by a named cold agent at the PR boundary | a standing deferral token is attention, not a mechanism | M4 = A | OP-41 |
| The docs gate runs inside the agent container as part of the task's own check | a red found after harvest reaches nobody | H1 = A (measured: not triggered) | OP-41 |
| The passport is the home of the goal, the «never» lines and the non-goals, in getff as at a consumer; README renders from it | one home, the same at getff and at consumers | T-Q4 = A | OP-42 |
| Find the earlier `docs-author` decision in the advisor's sessions rather than re-ask | a decided point is looked up, not re-asked | process | OP-43 |

### Roles, review rounds, approval, landing (OP-44 … OP-55)

| Decision | Reason | Register effect | OP |
|---|---|---|---|
| The second seat leads review and work; the first seat becomes advisor under the repo's advisor pattern | one owner per artefact; hard forks get a second view | roles | OP-44, OP-45 |
| Human-docs skill = the site-free core of `docs-author` + an adapted narrow part of addyosmani `documentation-and-adrs` (no README template, changelog or ADR chapter). Rec. | the parts left out type by hand what this design renders from one source | F7 = A | OP-46 |
| Keep «bare path = navigation» and check every NEW bare path at the PR boundary. Rec. | flipping to whole-file binding would turn 354 silent page-changes into alarms (about 7.6 per merge against 0.54) | B-Q2 amended A+ | OP-47 |
| Agent memory is in scope narrowly (keeps why and incidents, points at repo facts); coordination drafts are out. Rec. | memory restating repo values drifts; drafts are working files | SCOPE-U = A | OP-48 |
| A separate task cleans the agent memory of stale and restated facts | applies SCOPE-U to the existing memory | chip `task_d7593d93` | OP-49 |
| The same PR-boundary check covers typed values in new or changed prose. Rec. | the alternatives narrow the goal to cited values or add a sweep whose red has no consumer | B-Q2 widened | OP-50 |
| The top level (r8) is approved. Rec. | two review rounds (the cap), every finding disposed | status APPROVED | OP-51 |
| Land the design as a spec now; implement in slices through the aif factory with Opus verification. Rec. | coordination files are not durable; slices keep each change reviewable | this landing | OP-52, OP-53 |
| The public repo gets this decision record, not the raw dialogue | the reader needs decisions and reasons; a record that exists to prove who chose is a liability shield; a public merge cannot be fully undone | this file | OP-54 |
| A row is revised when a falsifier fires or a better option is shown; «the owner chose it» is not a reason to keep it | holding a worse row because of who chose it defeats the design's purpose | spec section «Revising a decided row» | OP-55 |

## Prevention

- The spec's «Revising a decided row» section governs later changes: old text, new text,
  evidence and reason, recorded in a new research patch (patches are append-only).
- A spec or patch line that cites OP-n must resolve in a row above.
- The next OP id is **OP-56**.

## Tags

`docs-single-source`, `decision-record`, `arch`

## §1.7 self-review

- **Forward check.** Every OP id cited by the spec and by the evidence and review-rounds patches
  resolves to a row above (checked by grep per id).
- **Backward check.** Each row was written from the verbatim log and the fork register (draft
  §9.1 and §9.6); no register decision was changed. «Rec.» is set only where the answer carried
  the recommendation label or the record names the lead's recommendation.
- **Limits.** The reasons for OP-1 … OP-43 are the record's reasons as written at the time;
  where a row's reason was not stated in the record, it is the one the register row gives.
