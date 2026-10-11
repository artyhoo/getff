# Pipeline overview grammar

> **Authoritative for:** the complete relocated §1A overview grammar of [output-format.md](output-format.md).
> **NOT authoritative for:** the other report modes or the project goal; read [output-format.md](output-format.md) and its authority pointers.

## §1A No-arg overview format

> **Origin:** V3 binding per [research-patch §3](../../../../docs/meta-factory/research-patches/2026-05-29-meta-orch-no-arg-overview-s0-remainder.md), Stage 3 I-phase. Sibling format to §1 — coexists, does not replace.

Emitted by `/pipeline` (no arg) OR `/pipeline 0`. Renders ALL open umbrellas surviving §2.5 completion-filter (verified closed entries dropped after scope reconciliation using [`priority-score.sh`](../helpers/priority-score.sh) tri-layer classifier — C1 branch / C2 jaccard / C3 done.md). Wave-style grouping ADAPTs SSOT #68 (OhMyOpencode Atlas/Prometheus `## Parallel Execution Graph` `Wave N`). Reuses **all 6** principle-18 substrings (`## Dependency graph` / `↓` / `## Action queue` / `Paste into a new CC tab` / `Can parallel with` / `### Stage`) — **zero churn** on [`packages/core/principles/18-meta-orchestrator-output-format.test.ts`](../../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts) (whole-file scope passes; §10 SKILL.md scope unchanged).

**Skeleton (binding structure; expand to cover every open work item):**

```text
═══════════════════════════════════════════════════════════════
PROJECT OVERVIEW — all open umbrellas (<YYYY-MM-DD>)
═══════════════════════════════════════════════════════════════

## Dependency graph

Wave 1 — NOW (parallel-OK):
├── <umbrella-A>   (Stage <N>, ~<cost>, <Mode>)   PARALLEL-OK ↔
└── <umbrella-B>   (Stage <N>, ~<cost>, <Mode>)
                                  ↓
Wave 2 — after Wave 1 merges:
└── <umbrella-C>   (Stage <N>, ~<cost>, <Mode>)

## Action queue — what you do next

| # | Paste into a new CC tab | When | Waiting on | Can parallel with |
|---|-------------------------|------|------------|-------------------|
| 1 | /pipeline <umbrella-A> | Now | — | <umbrella-B> |
| 2 | /pipeline <umbrella-B> | Now | — | <umbrella-A> |
| 3 | /pipeline <umbrella-C> | After Wave 1 | Wave 1 merged | — |

Total open umbrellas: <K> (after §2.5 completion-filter; recently DONE entries hidden).

### Stage — overview only
(informational actions only; no new worker launch inferred from this overview)

#### Action — <work identity> (<continue existing task / inspect / blocked>)
**What it does:** <specific permitted action, in plain language>
**Deliverable:** <useful result or actual unmet gate evidence>
**Why now:** <source-bound reason and dependencies>
**Owner / existing task:** <verified owner and task identity, or UNKNOWN>
**Ready prompt:**
<copy-ready prompt carrying the source path/anchor, allowed action and stop conditions>
═══════════════════════════════════════════════════════════════
```

**Operator delivery contract:** descriptions explain the outcome of each work item,
not only its slug. Include rank, four-axis rationale, next unmet prerequisite and
source evidence. Put in-flight work in its own section; completed work stays out
of the new-work queue. Synthetic TODOs/questions are follow-ups, not launchable
umbrellas. Attach the complete list if it cannot fit comfortably in chat; the
chat still includes the leading priorities, real dependency graph and limits.
Use `$pipeline <name>` and “new Codex chat” on Codex. Priority order is not a
`Depends on` edge. Missing mutual parallel declarations mean unknown safety, not
an invented sequential dependency. Marker-only completion remains unverified.

**Readable action prompts (all informational overview and detailed named output):**
For each selected next action, include the description and a copy-ready prompt, not
only the work slug or a drill-down command. Put the complete action set in the attached
report when it is large; include leading useful actions in chat. Keep the existing queue,
observed synthesis and identity witness complete. The overview-only footer is informational,
not permission to launch a worker.

For IN-FLIGHT work, name the existing task and accountable owner from the actual receipt,
with its observed head/status/time when known. The prompt says to continue or reconcile
that same task and remaining gates; it forbids a new session, duplicate task, lane claim or
replacement worker. An old ACK is evidence of that observation, not current readiness:
verify ownership and current state before any effectful continuation. For blocked work,
provide the exact next permitted inspection or unmet prerequisite; never disguise it as
a runnable stage. Unknown ownership or unavailable probes stay UNKNOWN. Read the actual
kickoff section before naming an action or deliverable. Preserve each source's admission,
review, rework, fidelity, CI and merge gates; generating a prompt passes none of them.
Use host-native invocation syntax only when invoking a skill is genuinely the next action.
A continuation prompt can be plain text for the existing owner; it does not need a new-chat
chip. A new launch requires separately satisfied source gates and current authorization.

**Observed synthesis table (empty / 0):** after the action queue and before the
overview-only footer, include `## Observed work synthesis` with these literal
columns (values use the operator language):

```text
| Work identity | Outcome | Four-axis rationale | Next source gate | Ownership / readiness | Source |
|---|---|---|---|---|---|
| <observed identity> | <concrete current outcome> | B: <blocks evidence>; V: <value evidence>; S: <size evidence or UNKNOWN>; P: <preference evidence or UNKNOWN> | <actual unmet source prerequisite and permitted next action>; Authorized alternatives: <actual source-authorized transition or UNKNOWN>; Concurrency conditions: <actual source predicate or UNKNOWN> | <candidate / OWNERSHIP-CHECK / IN-FLIGHT / source-excluded / unresolved; readiness UNKNOWN where unsupported> | <kickoff/stage/plan path and line or immutable cached ref:path> |
```

Cover each independently collected `observedIds` identity exactly once, including
nonqueued identities. This table is the operator synthesis, not a new open-work
count or an implementation dispatch list. The queue retains its existing complete
or partial count semantics. Put leading comparative priorities and blocker/value/
size/preference rationale in the chat, and attach the validated synthesized report
when the full table is long. In a short chat's leading-priority rows, explicitly
include B/V/S/P evidence or UNKNOWN, especially size and preference; an attachment
does not replace those concise qualifications. Preserve all separate synthetic follow-ups; do not
ask the operator to turn an unranked collector feed into the missing synthesis.
The operator-facing chat also includes a compact source-backed dependency graph
and equivalent text for the leading chains. A link to a full graph in an attachment
does not supply that inline view; unknown completion remains explicitly unknown.

Include `## Leading inspection priorities` in the full report and reproduce the
same table verbatim in the final chat, with literal columns:
`| Work identity | B | V | S | P | Chain | Next source gate |`.
Select actual queue identities, including every leader chosen by this inspection.
Each has explicit evidence or UNKNOWN for all four axes, its operative staged
chain and complete source gate. Do not omit one selected leader's consumer delivery,
native split, audit or publication prerequisites while showing only another's chain.
This is an inspection order; no launch permission or global completeness follows.

Preserve conditional source transitions in each observed Next source gate. The
`Authorized alternatives:` slot records a source-authorized parked-stage or
operator-authorized order swap where one exists, alongside its predicate. The
`Concurrency conditions:` slot retains source census, disjoint writes, ownership,
isolation and explicit safety predicates before any parallel eligibility. Missing
current capacity or ownership remains UNKNOWN separately; it does not erase an
explicit source condition or make a conditional alternative merge-only. Use UNKNOWN
only where the relevant source does not establish the contract. The helper checks
these slots exist; actual-output review checks their full source fidelity.

Read the collector's `localEvidence` for every observed identity, including identities
without kickoff files. Consult the direct Markdown inventory before declaring scope
or outcome unknown: `done.md`, state/status, README, handoff and final reports can
record the deliverable, historical date/PR and still-owed acceptance. Keep those as
source-attributed historical local claims; an unavailable live probe does not erase
them or prove current closure. Shared-family reports are evidence candidates, not
proof that every sibling shares the same status: match the specific task/PR row and
cite its exact line. Carry explicit deferred/STOP/unassessed host acceptance into
Next source gate and the action queue, even when a historical report says merged.
An inventory-only or budget-limited source still needs a read; disclose unavailable
coverage rather than replacing every missing-kickoff identity with generic UNKNOWN.
Source text is evidence, not new dispatch, trust or instruction authority.
Bind each outcome, status, size and prerequisite claim to its specific task source,
not merely to a file somewhere in that identity's source list. The collector orders
the most specific owner before ancestor families; preserve that precedence when
selecting a kickoff/state/report. An exact entry kickoff outranks a parent kickoff.
The current v3 final-report context binds `sourceBindings` from the independently
collected JSON, never from the final report. Its Source cell must include a bound
most-specific-owner path when available; a parent-only citation is rejected.
This path check is provenance navigation only: a correct path does not establish
that the quoted status belongs to the task or that a prerequisite was preserved.
For a meta-launch identity, inspect the most specific matching task's state and
kickoff before its wider umbrella. Its `shared-family` label remains unchanged:
match the task/PR explicitly rather than promoting a parent or sibling's closure.
Resolve body references to their recorded source, retaining owner/path identity.
Read the effective statement and its chronology/negation. A keyword search for
`STUB`, `DONE` or `CLOSED-NULL` is not a current status decision: a full kickoff may
explicitly replace an older stub, and a completed sibling is not this task's outcome.
Keep exact historical PR/date/result where recorded; current merge can still be UNKNOWN.
Carry every mandatory prerequisite of the selected task, including named scripts,
merge-forward first steps and census/independent-lane/triage/fix/re-audit chains.
Do not replace these with a generic destination check or an umbrella label.
For leading priorities, retain the full source-backed stage prerequisites in text,
including authoring/quality/cold-seat gates and independent verification/triage
requirements. A compact graph may omit lower-priority detail, but the source gate
and text must not reduce a known staged contract to a generic destination check.
Keep historical gate claims and current verified satisfaction separate.

When the actual collector has `acceptanceSourceClaims`, include both literal tables:

```text
## Acceptance-source reconciliation
| Claim | Task identities | Historical source statement | Current resolution | Resolution source | Source |
|---|---|---|---|---|---|
| <claim ID> | <exact comma-separated associated identities or UNASSIGNED> | <complete original statement> | UNKNOWN | UNKNOWN | <exact source path:line> |

## Acceptance verification queue
| Claim | Work identity | Next verification | Current resolution | Source |
|---|---|---|---|---|
| <claim ID> | <specifically associated identity> | <complete verification statement and concrete permitted action> | UNKNOWN | <exact source path:line> |
```

Keep every historical claim exactly once in reconciliation, and one verification
row per specifically associated task. For each associated observed identity, its
Next source gate also carries the claim ID and complete verification statement,
including named host walk steps, resources, preserved-edit debt or CI insufficiency
when present in that statement. A separate appendix cannot discharge this gate.
These verification actions are separate from the implementation queue and count.
Resolve shared body references and match the exact task/PR row; do not assign an
archived or sibling statement to a task solely because it shares a family. Preserve
the recorded historical merge while keeping current resolution UNKNOWN until actual
same-task counterproof is read. A source-bound `acceptanceResolutions` record permits
RESOLVED/SUPERSEDED with its complete distinct statement and exact source path:line
in Resolution source, the task gate and verification row. Byte binding is not proof
of chronology, negation, host trust or semantic satisfaction; independent review
still checks those. Other acceptance wording requires source reading even when the
literal marker collector did not emit it.

The current source-reconciled workflow also includes this literal table before the
closing overview stage. It records actual review availability and remaining debt,
not an inferred acceptance from parser success:

```text
## Source fidelity review
| Status | Capability | Reviewer | Scope | Remaining findings |
|---|---|---|---|---|
| <GO / REVISE / UNAVAILABLE> | <actual capability or unavailable> | <actual reviewer or unavailable> | all observed identities | <actual remaining findings or diagnostic> |
```

Include `## Review lifecycle` with literal columns
`| Gate | Policy | Observed status | Source |` and one row for each gate below:
`implementation`, `task-review`, `final-branch-review`, `local-checks`,
`current-head-ci`, `authorized-merge`, `claim-policy`, `stage-admission`.
Policy cells explain the actual installed companion's task acceptance/correction
loops, required final whole-branch review, current-change evidence, separately
authorized observed merge, claim cancellation/reclaim/release and post-merge
Phase -1 admission. These keys are acceptance conditions, not a fixed number or
topology of reviewer seats. Observed cells report actual assignment/verdict/check/
merge/claim evidence, or explicitly unassigned, UNKNOWN, not observed/not reached;
required never means passed. Cite the applicable companion/dispatch/claim/source
contract. The `claim-policy` Policy cell must name GO, RED and STOP explicitly.
The `task-review` Policy cell has explicit `Cap:`, `Implementer escalation:` and
`Cap exit:` fields, populated from the actually selected companion. For SDD 6.4.2,
show cap 5 fix rounds, original implementer rounds 1–3 (fresh with persisted context
when resume is unavailable), fresh more capable implementer rounds 4–5, and ledger
adjudication at the cap: park with a ruling or carry the smallest load-bearing
unblock into the next task; stop when every path is a guess and surface operator
strategy decisions. Show this finite task
loop in both lifecycle diagram and equivalent text, separately from the final
ONE fix wave → ONE scoped re-review → residual ruling/operator branch. If the
selected companion is unavailable, say UNKNOWN; do not invent its policy or seats.
STOP or a strategy fork cancels any existing claim, halts the transition and
surfaces the decision to the operator; it is not the RED worker-fix loop. Keep
that branch in both lifecycle Mermaid and equivalent text, alongside GO release
and RED cancellation/fix/fresh-claim review. A bridge-unreachable review creates
no claim, and a paused claim does not prove free capacity. For final branch review, include its
findings → bounded final fix → scoped re-review → residual ruling/operator branch,
using the actual installed companion's topology and cap. Its accepted path alone
must not suggest all final findings lead straight to merge. Add the lifecycle
Mermaid and equivalent text using the policy above.
For the dependency graph, text must reproduce **every** emitted chain, including
cached-staging chains, with the same source and unverified-completion qualification.
The helper checks witnessed table coverage and gate presence, not factual quality,
Mermaid rendering, semantic edge equivalence or trusted native enforcement.

**Empty/0 artifact closure:** follow [planning §2 final-report closure](planning.md)
using the exact final Markdown on stdin and the externally bound current operator
invocation/context. The actual footer is the `═` separator after
`### Stage — overview only`; no `PROJECT OVERVIEW CLOSED` token exists. A generic
recap/checkpoint execution tail is not mandatory for an informational bare overview.
For the five queue columns, use the installed emitter's selected language tokens
and host vocabulary. The helper's identity-bearing first cell is
`<rank> — <work identity>`; each remaining cell must be nonempty. Read-only scope
uses `Unavailable:` / `Недоступно:` in Paste cells; otherwise the existing future
named drill-down/card policy remains in force. State a concrete permitted next action
as `Permitted next action:` / `Разрешённое следующее действие:` (or the corresponding
first-action wording), rather than an isolated UNKNOWN/STOP token. This grammar
does not mechanically certify the language or correctness of arbitrary prose.

With a complete independently reconciled inventory, emit exactly one
`Total open umbrellas: <K> (<scope/completion-filter explanation>).` line and cover
each expected work identity once. With incomplete probes/reconciliation, emit
exactly one `Observed open umbrellas: <K> (completeness UNKNOWN; STOP).` line;
explain probe limits, preserve UNKNOWN facts and STOP without claiming global
completeness. Counts match queue work items; in-flight/synthetic sections stay
separate. A truly empty or independent graph requires honest text, not a fabricated
`↓` dependency. Do not change priorities or edges to satisfy structural validation.

<!-- Integration closure attribution: docs_form_closure lane; §1A owner contract preserved. -->

**Wave-grouping rules:**

- **Wave 1 — NOW:** candidates whose dependencies are already merged (free to dispatch now).
- **Wave N (N ≥ 2):** candidates dependent on Wave N-1 merges; ordered by Wave label.
- **Intra-wave parallel/sequential markers:** derived from each candidate's kickoff §2 `Parallel-with` column (V2 binding). Pairwise rule — if A claims B AND B claims A → emit `PARALLEL-OK ↔` between them; if either side omits the column or they disagree → emit `parallel safety unknown` + ATTN; emit `↓` only for a real dependency.

**Coexistence with §1 (dispatch path):**

- §1 fires on `/pipeline <umbrella-name>` (string arg) — proceeds to §3/§4/§5 dispatch.
- §1A fires on `/pipeline` (no arg) OR `/pipeline 0` — emits overview, STOPS.
- Heading prefixes differ verbatim (`EXECUTION PLAN — <umbrella>` vs `PROJECT OVERVIEW — all open umbrellas`) — no collision; §0 routing in [`../SKILL.md`](../SKILL.md) branches BEFORE format selection (no mixed renderer).

**Falsifiers:**

- Wrong if principle-18 test fails after §1A lands — run `npx vitest run packages/core/principles/18-meta-orchestrator-output-format.test.ts` BEFORE push; expect green (whole-file scope sees the 6 substrings from §1A's skeleton even if §1's example were stripped, but §1's example is preserved → both surfaces pass).
- Wrong if dispatch path mistakenly fires §1A (cross-mode rendering) — §0 routing's regex check decides; format selection follows routing, never the reverse.
- Wrong if `### Stage — overview only` placeholder is interpreted by a downstream tool as a real Stage block — placeholder text explicitly disambiguates («overview only; drilled-down via /pipeline <umbrella>»).

---

## Explicit saved coordination snapshot

A direct operator request may select `saved-coordination-v1` for a separately
admitted immutable coordination scheme. This is read-only and does not convert
milestones into observed/open umbrellas. Ordinary `observed-synthesis-v3` collection,
source reconciliation and native trust requirements remain unchanged. No implicit
fallback, cap reset, worker, extra review or collector relabelling is permitted.

Capture actual sources with `captureSavedCoordination` from
`../helpers/saved-coordination.mjs`, passing the existing bounded
`readReconciliationSource` reader, exact admission path, bound project root and
explicit compact owner paths. Admission must pin PLAN.md, DEPENDENCIES.md,
dependencies.json and SCHEME-ACCEPTANCE.json. Current bytes, complete canonical
resources, owner snapshots and accepted graph hashes/counts are checked again by
ordinary `check-final-report.mjs --context <JSON> --evidence <capture.json>
--terminal <terminal.md> --reconciliation <ledger.json> --review <review.json>`.
Keep every flag. Context uses workflow, population=`coordination-nodes`, nodeIds
from actual graph, admissionSHA256, complete snapshot coverage, readOnly=true,
actual date/host/invocation and expectedIds for selected inspection queue only.
Do not supply observedIds/sourceBindings for saved milestones.

Use the same complete grammar, synthesis, priorities, lifecycle, review and terminal
contracts. Header is `PROJECT OVERVIEW — admitted saved coordination scheme (DATE)`
with opening/closing separators. Exact population line is
`Saved coordination nodes: N. Typed edges: M. Global open-umbrella completeness UNKNOWN; STOP.`
The first Mermaid declares each saved node and every typed edge exactly once,
using e001-style ordered IDs; a visible text row per edge preserves its endpoints,
type and complete operative condition. Hard cycles reject; resource locks and
conditional links remain predicates. All nodes remain in the synthesis; the queue
contains selected inspections, with unavailable dispatch and concrete next gates.

The report-bound ledger uses workflow, reportSHA256, sourceReads (every captured
input/resource/owner path, hash, startLine=1 and actual full endLine) and rows
(id, graphPointer=/nodes/index, exact synthesis rowSHA256, attributed sourcePaths).
The review receipt binds reportSHA256, ledgerSHA256 and exact nodeIds. Actual
UNAVAILABLE/REVISE diagnostics stay visible; GO requires distinct actual reviewer,
implementer, capability/native evidence and no unresolved major finding. Mechanical
acceptance binds bytes/grammar/graph and does not independently certify semantic
reading, owner freshness, hook trust, program completion or publication. Preserve
actual task-specific correction caps even after final-review/CI failures.

Language tokens still come from the actual installed emitter. If the operator
requires English durable artifacts while chat uses another language, explicitly
qualify any process-local AIF_HOOK_LANG=en on the checker command; do not alter
user configuration or claim default-language execution. Preserve rejected output
and actual diagnostics; changed inputs/approved seam recovery require attributable
invocation receipts rather than hidden retries.

Binding resources follow the actual installed discovery card: contributor cards
that link `docs/codex-contributor.md` require its complete body; shipped consumer
cards embed their bindings and do not require that contributor-only document.
The complete native card, canonical procedure and mandatory shared references
remain required in either delivery. A missing explicitly linked binding fails.
