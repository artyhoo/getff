# pipeline — planning

> **Authoritative for:** the selected pipeline procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §1 Plan-currency check

**Empty/0 exception:** use the read-only overview collector in §2 for currency and
live population evidence, read the plan directly, report DRIFT/unknown items, then
complete the overview. Do not execute the side-file-writing currency helper below
or write a missing-plan stub in this mode. Missing/stale plan is a limitation, not
a reason to withhold the work inventory. Named launch gates are unchanged.

> Runs before ANY other action. Skipping this section = T4 anti-pattern (premature closure without plan verification).

**Step 1 — inject live state:**

```bash
bash ".agents/procedures/pipeline/helpers/read-plan-cache.sh"
```

```bash
git status --short && echo "---" && git branch --show-current && echo "---" && git rev-list --count --left-right origin/staging...HEAD 2>/dev/null || echo "(no upstream)"
```

```bash
gh pr list --search "is:open" --json number,title,state,headRefName,baseRefName --limit 20 2>/dev/null || echo "gh unavailable"
```

```bash
head -400 "$(bash ".agents/procedures/pipeline/helpers/print-plan-path.sh" 2>/dev/null)" 2>/dev/null || echo "MISSING: plan (will be created on first run — see §1 Step 3)"
```

```bash
bash ".agents/procedures/pipeline/helpers/plan-currency-check.sh" "${umbrella:-}"
```

The named-mode currency helper only reports whether the bound kickoff file exists. Its zero exit is not a CURRENT/merged verdict. Missing kickoff holds launch; the live reconciliation below is still required.

**Step 2 — drift detection (judgment call on injected data):**

Before comparing claims, establish that each required query actually succeeded with valid, complete evidence. A failed/unavailable query, invalid response, or saturated bounded result is UNKNOWN, not an empty population or proof of DRIFT/no matching PR. Preserve its diagnostics and hold the launch/currency gate; do not infer CURRENT from file existence or another helper's zero exit.

Compare the `wave-sequencing-plan.md` claims against the live `gh pr list` output:

1. For every wave marked «✅ merged» — verify a merged PR with that head branch exists in `gh pr list --state merged`. If not found → **DRIFT**.
2. For every wave marked «🟡 partial» — verify at least one open PR matches. If none → **DRIFT**.
3. For every kickoff path referenced — verify `<orch-home>/<path>/kickoff.md` exists (the `plan-currency-check.sh` output provides this; to `ls` it yourself, resolve the home first — `ls "$(bash ".agents/procedures/pipeline/helpers/print-orch-home.sh" 2>/dev/null)/<path>/kickoff.md"`). Missing file → **STALE REF**. Never `ls` the framework literal: in a consumer install it names a directory that cannot exist, so every present kickoff reports STALE REF.
4. For every research-patch cited — verify the cited file exists under the project's research/patches dir (framework: `docs/meta-factory/research-patches/`). If the project has no such dir, skip this check. Missing (where the dir exists) → **STALE REF**.
5. **REPORT reconciliation:** if a maintainer-passed REPORT contradicts the `gh pr list` injection (e.g. REPORT says «Stage 1 merged» but `gh pr list` shows nothing), emit «REPORT says X; mechanical state shows Y; trusting `gh pr list`; possible causes: stale REPORT / pending GitHub-API sync (<60s) / different branch. Proceeding on mechanical state.» REPORT is welcome **supplementary** input, not load-bearing — mechanical state always wins (3-layer responsibility model; memory `feedback_no_human_verification_ai_self_verifies`).
6. **Cache reconciliation:** if cache (Step 1 first `!shell` block) «Last invocation» Git HEAD diverges from current `git rev-parse HEAD` AND `wave-sequencing-plan.md` was touched in the SHA diff → emit «CACHE STALE …»; cache stays supplementary, never load-bearing (T-mem-A counter — re-verify «PR merged» / «umbrella DONE» claims via `gh pr list`). Full rule + anti-patterns: [`references/plan-cache.md §2`](plan-cache.md).

**Step 3 — emit verdict:**

- «**Plan is current**» if zero drift or stale-ref items found.
- OR emit a numbered list: `DRIFT-N: <wave-name> — plan says <claim>, gh shows <reality>. Proposed correction: <update wave-sequencing-plan.md line X to Y>.`

**If the backlog plan is MISSING entirely:** skill writes a stub at the resolved plan path (`.ai-factory/orchestrator-prompts/plan.md` in a consumer) from `README.md` + `.ai-factory/DESCRIPTION.md` (if present) + the kickoff listing under the resolved orch-home, presents to the maintainer for OK, then halts until confirmed. (`EXECUTION-PLAN.md` is framework-only — do not require it.)

---

## §2 Priority

> Empty/0 mode reports factual plan drift as a limitation and continues the informational overview without acknowledgement or shared writes. Launch modes still require the currency gate. Skip to §3 for a named umbrella.

**Step 1 — inject candidate list** — _read-rule (completion barrier):_ parse a background helper's output ONLY after its `=== <helper>: END rc=<n> ===` trailer (appended by `run-helper.sh`) or its task-notification; a header-only / trailer-absent read = "still running", NOT "zero results" — never conflate one task's notification with another's. _(Origin: incident 2026-06-01, `priority-score.sh` read at header-only state → false "zero candidates".)_ This rule applies to every background-helper `!`-fence below. <!-- @dual-pair: bg-helper-completion-barrier -->

```bash
bash ".agents/procedures/pipeline/helpers/run-helper.sh" ".agents/procedures/pipeline/helpers/priority-score.sh" "${umbrella:-}"
```

**Overview evidence collection (empty / 0, before Step 2):** refresh origin/staging
with `git fetch origin staging` and inspect new tracked kickoff files even when the
active checkout is behind. Do not overwrite other checkout WIP. A fetch requires
write permission; when unavailable, retain the exact freshness limit and continue
only the informational overview. Pipe the completed Step 1 output with its END
trailer directly to the composer; this read-only route needs no temporary file:

```bash
set -o pipefail
bash ".agents/procedures/pipeline/helpers/run-helper.sh" ".agents/procedures/pipeline/helpers/priority-score.sh" "${umbrella:-}" |
  node ".agents/procedures/pipeline/helpers/overview.mjs" "$PWD" - --bridge-url "${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
```

Run this from the bound installed-project root (the common invocation binding),
not a nested cwd or an enclosing Git root. An existing completed output file also
remains supported as the second argument. Preserve the helper status, END trailer
and composer diagnostics; missing probes do not prove idle or launchable work.

This read-only composer reuses candidate closure and frontier parsing, collapses
meta-launch wrappers into their incumbent umbrella, separates synthetic residue,
and records PR/branch/factory activity and probe limits. Its output is evidence,
not the final ranking: reconcile the matched merged PR scope against each kickoff
contract first. A root-slug factory branch can contain a single stage (site #1850),
so task suffix matching is an in-flight signal, never whole-umbrella completion.
For recently completed work without done.md, inspect the merged PR and delivered
contract, remove verified closure from the open queue, and report the evidence.
Then read every surviving kickoff plus dependency prose and
plan preference, score using Step 2, and render the full operator overview.
**Observed-population synthesis (empty / 0):** preserve the composer's
`observedIds` from its actual `--json` output or its explicit observed-identity
witness line. This is independently collected local/cached evidence, not a claim
that these identities are open or that the global population is complete. Normalize
cached-staging kickoff identities with local identities; keep exact cached ref and
path citations and freshness limits. Read the actual surviving kickoff/stage/plan
contracts for every observed identity. Do not stop after choosing three examples
or attach the unchanged evidence feed as the finished operator synthesis.

Account for each observed identity once in the §1A synthesis table, with outcome,
B/V/S/P rationale, next unmet source gate, ownership/readiness and source citation.
Separate priority candidates, ownership checks, confirmed in-flight work and
source-excluded/closed/unresolved work; preserve synthetic follow-ups separately.
A source prohibition such as “do not dispatch” excludes a launch row but not its
observed identity or explanation. An old branch is an ownership check, not proof
of an active worker. Interpret dependency prose as well as table cells; missing
`Depends on` columns cannot erase an explicit source prerequisite.

Compare locally supportable priorities across the observed population using Step 2.
Give leading priorities with evidence on all four axes; unavailable size/preference
or live state stays UNKNOWN. A provisional inspection order is allowed when those
limits prevent a winner, but explain its comparative rationale and unresolved
competitors. Do not invent numeric precision, an operator preference, a merged
prerequisite or launch NOW. Probe failure blocks dynamic readiness; it does not
justify omitting available local outcomes and gates. Attach a **synthesized** full
report if needed; the final helper must validate that report's exact bytes, not
just a three-row chat summary or the raw feed. Include the applicable lifecycle
policy/status table and equivalent text for every Mermaid chain.

Unknown ownership is not ready; in-flight work belongs in a separate section.
Do not derive dependency edges from rank, and do not promise parallel safety from
missing edges. Preserve unresolved prerequisites verbatim with source references.
The overview stops only AFTER this evidence, scoring and output contract are met.
It does not require §2.5 dispatch or write cache/plan/meta-kickoffs.

**Source reconciliation before rendering (empty / 0 only):** the current collector
emits `sourceReconciliationVersion: 1`; copy this unchanged to the final context.
The public observed-synthesis-v3 CLI always requires this version and both
artifacts, including when both markers are omitted. Historical retained grammar
is available through the explicitly historical direct APIs, not this current CLI.
Use an invocation-owned durable artifact directory for the collector, ledger,
review receipt, full report and terminal. Link these actual artifacts in the final
chat; a generic mutable `/tmp/pipeline-overview-<date>.md` is not durable delivery.

Build one JSON ledger with `version: 1`, deduplicated `sourceReads`, and one `rows`
entry per independently observed identity. Read the complete most-specific source
bodies and the inventory-only Markdown before writing the row; resolve shared body
references. A source read has `path`, `status: "read"`, full `text` and its actual
`sha256`. A failed read has `status: "unavailable"` and the exact collector-captured
`diagnostic`. For a new inventory-only failure after collection, capture the
actual `readReconciliationSource(path)` result from the installed checker module;
it supplies `errorCode` and the actual diagnostic. The final CLI independently
repeats that bounded read to bind the same failure. A changed/successful read
invalidates an unavailable claim. An omitted body in a bounded collector is a
reason to read it, not a reason to invent a missing-source failure. Inventory-only supplemental bodies are
also checked against the actual bounded regular file at final validation.

The collector keeps `cachedEvidence` separate from `localEvidence`. Copy both
`sourceBindings` (local files, including empty arrays) and `cachedSourceBindings`
(actual cached Git-object aliases) unchanged into context. Cached bodies retain
`origin.kind: "git-object"`, `ref`, immutable `commitOid`, `blobOid`, and `repoPath`;
their `git:<commitOid>:<repoPath>` path is an attributed source alias, not an
invented local file. Account for their bodies alongside actual local reads. If the collector
inventoried a Git object without capturing its body, retain its actual captured
error as unavailable, or supply an actual full read of that immutable object.
The checker verifies every supplied Git body against the independently recorded
blob object ID, including bodies omitted by the collector budget. A self-authored
body SHA alone cannot support that Git alias. A
cached ref/result is historical and retains the fetch/freshness boundary; it does
not establish current merge, readiness or launch authority.

Each row has `id`, `readPaths` accounting for its full collected source inventory,
and five authored claims: `outcome`, `gate`, `alternatives`, `concurrency`,
`chronology`. Each claim has a concise `statement` and `support` records containing
`path`, `sha256`, `startLine`, `endLine`, and exact substantive `text` for that
inclusive line range. Keep each statement in the actual Outcome or Next source
gate cell; alternatives and concurrency belong in the latter. A title alone is
not substantive support. No source/probe evidence means `status: "unavailable"`,
empty support and an explicit output-visible `reason`; it cannot erase an available
recorded outcome or contract. Source read accounting is evidence, not proof that
all material claims were selected correctly.

For cross-task chronology, `relatedSources` records the exact `workIdentity`,
`path`, and reason that the source concerns this same task/PR/amendment. Include
that path in `readPaths` and its actual body in `sourceReads`. A source from another
observed identity can supply a matching later result; its mere family membership
cannot close a sibling. Reconcile exact matching supersession before rendering
pending launch gates. Preserve historical facts separately from unknown present
owner/readiness and incomplete live queries.

**Contract extraction and authority reconciliation (before authoring claims):**
For each identity, read every complete captured local/cached body and any related
parent or amendment needed to interpret its gates. Keep a small invocation-owned
working matrix with the exact body/hash/line range, affected task/stage/arm,
source-era outcome, requirement or conditional branch, and any explicitly matching
replacement/resolution. This is an authoring aid, not a new authoritative source
or a substitute for the existing reconciliation ledger and native review.

Separate three questions: what the source requires, what it records as historically
delivered, and what live observations establish now. Missing current ownership or
readiness cannot turn an explicit source-era branch, dependency or parallelism
permission into "no source declaration". Conversely, a recorded historical GO or
merge is not current readiness. Carry the actual selected mechanism and delivered
remediation before listing its unresolved residuals; do not reopen settled choices
or redispatch delivered work merely because current probes are incomplete.

Retain exact same-task later corrections, partial remediation and rejected options;
older counts or an earlier review verdict cannot hide an explicitly recorded later
response. Preserve task packaging, operative order and conditional stop/continue
rules when they constrain the next action. A source-recorded operator exception
may explain historical delivery even when its original acceptance conditions did
not fire: state both facts, do not relabel the conditions as passed, and do not
turn the historical exception into a current operator grant. Bind an audit's real
input qualification, including declared uncommitted edits alongside a named HEAD;
a commit label alone cannot identify a HEAD-plus-WIP observation.

Reconcile authority by affected clause, not by treating the newest document as a
replacement for the whole family. A later amendment removes only the gates or
edges it explicitly replaces. Retain unsuperseded parent-wide prerequisites,
operator-only acceptance, scoped item/arm dependencies and distinct dated forks.
A lint-only prerequisite cannot block the non-lint arm. Preserve independent arms
and exact stage exceptions instead of inventing a universal serial chain. If the
captured authority conflicts or the relationship is unresolved, expose that exact
fork rather than choosing a waiver or inventing present failure.

Closure can retire an implementation queue while leaving a continuing watch,
rollback threshold, operating restriction or follow-up owner. Include these
surviving conditions and their actual triggers in the row; do not replace them
with generic owner/cap warnings. Preserve explicit negative instructions and
falsifiers. A source's conditional GO/REVISE/NOGO or ADAPT/DEFER/REJECT transitions
must stay distinct, including a separate implementation authorization where
required. Never infer that a positive research verdict authorizes execution.

Before rendering, compare the matrix back to all five authored claims and the
report's leading chain, graph and next-gate cells. Every material surviving gate,
known alternative and amendment must be visible where it changes the next action;
source excerpts or an appendix cannot compensate for an omitted operative gate.
Use specific source-derived statements. UNKNOWN describes the particular missing
current observation, not a boilerplate substitute for known contract content.

After composing the full report, use an already available independent read-only
reviewer (`Agent` on Claude Code, the available native agent tool on Codex). Give
it the exact complete report, ledger and captured source bodies; require checking
EVERY observed identity for substantive outcomes/gates, conditional alternatives,
shared-write exclusion and matching chronology, with findings bound to exact
source and report lines. Check the actual tool is available before using it;
metadata pre-approval does not create it. This is research/review only, not a
write worker, factory dispatch, replacement audit chat or permission to change
host configuration. An implementer self-check is not an independent review.

Plan full-body review before handing off the completed report. Supply an explicit
partition of all observed identities and all their captured source locators,
including cross-task parent/amendment bodies. Choose finite partitions that each
available reviewer can finish; review them sequentially when concurrent native
capacity is unavailable. Reuse the available read-only reviewer capability; do
not create replacement chats or launch write workers. Each partition returns its
assigned identities, exact source body hashes/locators, completed semantic read
ranges, findings and any unread remainder. Identical complete body hashes may
share a read within a reviewer, but differing versions require separate reading.
Repair truncated read gaps before marking a body complete. Inventory membership,
SHA equality, excerpts and parser success do not count as full semantic reading.

The actual final review owner reconciles all partition results against the full
report and ledger, including leading cross-task chains. No identity, source body
or operative relation may fall between partitions. Require both directions:
every authored material claim has correct source support, and every material
source constraint is represented in the operative claims. Explicitly inspect
clause-scoped supersession, surviving parent gates, stage/arm exceptions, known
historical branches, delivered fixes and post-closure watches. An unfinished
partition or unread body leaves an explicit REVISE finding for incomplete source
review; do not use a complete list of IDs as proof of semantic coverage. Preserve
actual reviewer identities and invocation results with the receipt. Structured
coverage records expose gaps but cannot authenticate that reading happened or
certify semantic truth. The existing two repair-pass cap applies to this combined
invocation, not separately to each partition.

Write the actual review receipt with `status: "GO"`, `"REVISE"` or `"UNAVAILABLE"`,
`capability`, distinct actual `reviewer` and `implementer` identities,
`nativeEvidence` pointing to its actual invocation/result, `findings`, the exact
ordered `observedIds`, `repairPasses` (0–2), and `reportSHA256`/`ledgerSHA256` over
those artifacts' exact bytes. Finalize the status/findings table before the last
exact-byte review; table-only edits also require reviewing the changed report
before recording its external receipt hashes. Repair concrete findings in this invocation and
review the changed exact report again, with at most TWO repair passes. Unresolved
MAJOR/BLOCKER means REVISE. An unavailable native review capability means
UNAVAILABLE with the actual `diagnostic`, also visible in the report; do not
fabricate GO or enable features, change providers, trust, global permissions or
launch external workers to manufacture a receipt. Preserve the useful report and
remaining findings after the cap; it is not accepted first-pass/native parity.
The checker binds these receipt fields; it cannot authenticate a native reviewer
or establish semantic completeness. Actual native trace and source review remain
required acceptance evidence.

Include the literal `## Source fidelity review` table from output-format §1A.
Its Remaining findings cell is `None` only for GO with no diagnostic or findings.
For every status, carry any actual diagnostic followed by each
`severity: workIdentity: text` finding,
separated by `; `. A finding names an observed identity, or `REPORT` for a
report-wide defect. Keep the receipt and this cell byte-corresponding after
Markdown escaping; a debt-free table cannot accompany unresolved findings.
Pass the actual separate files as `--reconciliation "<ledger path>" --review
"<review receipt path>"` along with the existing context/evidence/terminal inputs.
Check the final exact bytes after every semantic repair. The historical grammar
API remains for retained fixtures; it does not satisfy this current workflow.

**Final-report closure (empty / 0 only):** compose the complete final Markdown and
validate those exact bytes through [`check-final-report.mjs`](../helpers/check-final-report.mjs)
before presenting its unchanged stdout. Bind context to the **current explicit
operator invocation**, exactly `/pipeline` or `/pipeline 0` on Claude, `$pipeline`
or `$pipeline 0` on Codex. Preserve it as `invocation`; do not derive it from the
report heading, a launch card, heartbeat, prior turn or model self-tag. If the
invocation cannot be established, STOP with context unavailable. This check does
not route named/top-N/list/status invocations or grant launch permission.

Run from the bound installed-project root. Supply `--context` as one JSON argument
with `mode: "overview0"`, the preserved `invocation`, actual `host: "claude"` or
`"codex"`, capture `date: "YYYY-MM-DD"`, and the existing scope as explicit
`readOnly: true` or `false`. The helper runs the installed emitter to select language
tokens, including its EN fallback; context cannot override those tokens. Only use
`coverage: "complete"` and `expectedIds: ["<reconciled work identity>", ...]` when
independent completion/scope reconciliation establishes that complete inventory.
The candidate collector alone is not such a witness. Otherwise use
`coverage: "partial"`, omit `expectedIds`, and render the observed count with
`completeness UNKNOWN; STOP` per output-format §1A. Capture date and coverage come
from actual observations, not from the final report's own claims. For this current empty/0 workflow, always bind
`workflow: "observed-synthesis-v3"` and supply `observedIds` from the actual independently collected witness above, including
nonqueued ownership/unresolved/source-excluded identities. It is separate from
`expectedIds` and does not certify global completeness. If the collector is
unavailable, retain that failure and explicitly collect the available local
identity population before synthesis; never infer an empty list from failure.
Also copy `sourceBindings` unchanged from that same actual collector JSON: each
identity maps to paths from its most specific collected source owner. Do not build
these bindings from the composed report, remove a known local owner, substitute an
ancestor path, or manufacture empty arrays. A collector-supplied empty array means
local source binding is unavailable; disclose that boundary and attribute any
independently read cached/live source separately. The Source cell must cite at least
one bound path when paths are available. This rejects ancestor-only citations,
including a broad umbrella replacing a specific task, but cannot certify the
meaning, chronology or factual correctness of claims next to a correct path.
Supply that saved actual collector JSON through `--evidence` as a separately quoted
file path. The checker independently derives source bindings from its localEvidence
and checks both context witnesses against it. Also copy `acceptanceSourceClaims`
unchanged, including an empty array. The collector resolves shared body references
by owner, path and body SHA, and associates literal historical `HOST-DEFERRED`
statements through the specific task/PR table. These are historical statements,
not a finding that current acceptance failed. A shared-family or archived copy
does not assign debt to every sibling. Preserve unassigned statements as UNASSIGNED.
For each associated task, keep the complete verification statement in its Next
source gate and separate acceptance verification queue; a marker appendix alone
is insufficient. Preserve historical MERGED separately from current resolution
UNKNOWN. Do not restart implementation or increase open-work counts from an
acceptance statement. Read the full source for other deferred/STOP/unassessed
acceptance; literal marker collection is not an exhaustive semantic audit.
Use the reconciliation tables in output-format §1A. If actual counterproof exists,
bind an `acceptanceResolutions` entry keyed by claim ID with `status: "resolved"`
or `"superseded"`, exact `taskIds`, `sourcePath`, `sourceSha256`, `sourceLine` and
the exact source-line `text`. It must retain the same task PR, acceptance labels
and verification targets in an actual distinct source statement. Historical merge
alone or another task's proof cannot resolve it. Read chronology and negation before
accepting counterproof; the checker binds its bytes, not its factual interpretation.
A forged ancestor binding, another
identity population or evidence-present legacy downgrade is refused. The file's
origin remains an input trust boundary: retain the real helper-to-file-to-checker
trace and byte identities; a fabricated collector file is not verified provenance.
Omitting a required witness is context-unavailable for this version. A v3 collector
cannot be used to downgrade to v2. Historical unversioned/v1/v2 helper calls remain
compatible with their historical inputs; they are not current workflow acceptance.
The helper checks witnessed accounting and explanatory gate/table presence;
semantic source fidelity and comparative quality still need actual-output review.

Pass that externally resolved JSON as one separately quoted argument:

```bash
node ".agents/procedures/pipeline/helpers/check-final-report.mjs" --context "$resolved_context_json" --evidence "$actual_collector_json_file" --terminal "$planned_terminal_file" \
  --reconciliation "$source_reconciliation_file" --review "$source_fidelity_review_file"
```

Supply the exact composed full report on stdin and the exact planned final chat
as a separately quoted `--terminal` file. Use permitted temporary artifacts without
writing project plans/cache. Both must include the same literal Leading inspection
priorities table: every selected leader has explicit B/V/S/P, its complete operative
chain and next source gate. An attachment does not replace this inline table. The
actual final chat must be byte-identical to the checked terminal artifact; retain
both identities in native acceptance evidence. Retain actual status and diagnostics: 0 returns
the same bytes, 1 rejects report grammar, 2 reports unavailable/invalid context or
helper prerequisite. Correct a rejected report without inventing evidence and
rerun; if the required check cannot run, report that limitation and STOP. Do not
validate a draft and then substitute a different report or terminal response.

This closes the report-artifact grammar through a real helper invocation. It is
not automatic native Stop enforcement or factual certification. The check does
not compute priorities, invent dependencies, certify citations/ownership/trust,
run workers or change the existing review/dispatch policy. Ordinary permitted
future drill-down/cards remain governed by §9; a supplied read-only prohibition
requires explicit unavailable Paste cells and a concrete permitted next action.

<!-- Integration closure attribution: docs_form_closure lane; existing pipeline source-owner contracts retained. -->

**Step 2 — score each candidate (multi-criteria, judgment):**

For each candidate umbrella from `priority-score.sh` output, assign scores on four axes:

| Axis               | Weight | Signal                                                                                         |
| ------------------ | ------ | ---------------------------------------------------------------------------------------------- |
| blocks-other-waves | 3×     | Does this umbrella's output unblock ≥1 other candidate? (check kickoff §0 for cross-wave deps) |
| give-back-value    | 2×     | Does this close a N5 give-back gap or ship a consumer-facing artifact?                         |
| size-fit           | 1×     | Smaller is preferred when score is tied (S < M < L volume signal from launch-table §3)         |
| maintainer-prefs   | 2×     | Explicit preference signals in wave-sequencing-plan §0 (e.g. «do next», «urgent», «after C-1») |

**Step 3 — emit ranked list:**

```text
Priority ranking (as of <date> <git-HEAD-short>):
1. <umbrella-A> — score <N> — rationale: <one line>
2. <umbrella-B> — score <N> — rationale: <one line>
...
```

**Step 4 — clear winner or true fork:**

- If winner score ≥ 1.5× runner-up AND no explicit maintainer override → commit: «Recommend **<umbrella-A>**, proceeding to §3 launch-table + state.md update; Stage 1 dispatch awaits maintainer confirmation per §0.» (per phase-research-coverage.md §1.12: lead with reasoned recommendation). The «confirmation gate» from §0 sits between «launch-table + state.md ready» and «actually dispatch Stage 1 worker» — not between «recommendation» and «launch-table». Updating state.md before maintainer GO is on-path; dispatching a Worker session before maintainer GO is the §8 anti-scope violation.
- If genuine tie OR strategy fork (e.g. «should we do N8 or C-1?») → **route it, do NOT pick strategy.** A priority fork changes WHAT gets built next, so it is the `intent / goal / design` class of the [`/dispatcher` §3 routing-seats table](../../dispatcher/SKILL.md) and takes that class's first move — **file an ask + `ASK` when the advisor is reachable** (`bash scripts/check-ask-files.sh --print-template consult pipeline` emits it; the same script with no arguments is the pre-push `ask-file-schema` gate). No advisor reachable = that table's `else` branch, unchanged from today: by day «DECISION-NEEDED: <A> and <B> are tied on all axes — which is the project priority?» (reviewer-discipline.md §2 pattern), at night **stay parked, never guess**. Filing an ask is not a licence to dispatch. Register target, consumer degradation and the advisor-branch asymmetries: [`references/anti-rationalization.md`](anti-rationalization.md).

**Step 4.1 — DECISION-NEEDED anti-rationalization:** a genuine maintainer answer is a _content-based tiebreaker about the umbrellas_ («pick n7 because it unblocks n8's R3»). «выбирай сам / оба норм / я устал / it's technical not strategy» = _deferred_, NOT answered → re-surface with sharper framing or propose a coin-flip; do NOT silently pick («maintainer said pick → I pick» is `#strategy-decided-by-reviewer` in disguise, reviewer-discipline.md §3). **The same test governs an advisor verdict** returned in the ask file's `## Answer`: «выбирай сам» from the advisor is a deferred ask, not an answer — re-surface there, or fall through to the maintainer branch above. Full not-an-answer list + re-surface script: [`references/anti-rationalization.md`](anti-rationalization.md).

**Step 5 — emit per arg shape (V3/V4 binding per [research-patch §3](../../../../docs/meta-factory/research-patches/2026-05-29-meta-orch-no-arg-overview-s0-remainder.md)):** fires only on no-arg/integer-arg (string-arg skips §2); Step 4 BYPASSED on V3, preserved on V4 N=1. Completion-filter = [`priority-score.sh`](../helpers/priority-score.sh) tri-layer C1/C2/C3 (branch / dup-detect **gated on frontier agreement** / done.md, [#274](https://github.com/Yhooi2/rules-as-tests-aif/pull/274)) drops done-md closure before ranking; in V3, retain branch/xref/jaccard DONE until full-scope reconciliation, then remove verified closure. C2 passes the dup-detect line's true `basis=xref|jaccard` through and vetoes it when [`frontier.sh`](../helpers/frontier.sh) still emits a non-empty `FRONTIER:` — a merged PR cited as provenance is not completion (#1517), unless the kickoff states the closure outright on a completion-bearing line (`Final PR:` / `Closed by:` / `Completed by:` citing the same `#<PR>`).
**V3** (no-arg / N=0) emits overview per [output-format.md §1A](output-format.md) in Wave-style grouping (ADAPT SSOT #68 OhMyOpencode `Wave N`) with `PARALLEL-OK ↔` / `↓` markers from kickoff §2 `Parallel-with`; STOP. **V4** (N ≥ 1) emits top-N after completion-filter — each = 3-line block per [output-format.md §4.1](output-format.md) + 1-liner, markers from kickoff §2 `Parallel-with`; `N=1` = old winner-recommend; `N > K` emits K + warning `Only K candidates available; you requested N.`

---

## §2.5 Dedup + classify + assign + route

> **Integration layer (no separate §7.x binding).** Runs after §2 priority winner selected (no-arg mode) OR after §1 (arg mode). Wires §7.3 (priority) → §7.4 (launch-table) via L3/L4/L5 helpers + design §5 routing tree. Skipping = T7 anti-pattern (premature dispatch without routing).

**Step 1 — read prior delta state** (context-priming; deterministic diff in Step 8; reconciliation + T-mem-A counter — [`references/master-backlog-delta.md §2`](master-backlog-delta.md)): <!-- @dual-pair: meta-orchestrator-master-backlog-delta -->

```bash
_MO_DELTA="$(bash ".agents/procedures/pipeline/helpers/print-orch-home.sh" 2>/dev/null)/_master-backlog-delta.json"
if [[ -f "${_MO_DELTA}" ]]; then
  jq -r '.untracked_seen[]?.id' "${_MO_DELTA}" 2>/dev/null || echo "(delta file present but unreadable; treat as empty)"
else
  echo "(no delta file — first invocation; will be created at end via update-delta.sh)"
fi
```

**Step 2 — L3 dup-detect + in-flight ledger** (dup-detect catches _merged_ dupes; inflight-check catches _live_ work — open PR / un-merged branch carrying the slug, e.g. a parallel session dispatching the same sub-wave before it merges). `MO_SKIP_CLOSED=1` is set on the dup-detect call so the no-arg overview `--all` scan skips the already-closed (done.md) umbrellas — otherwise the full-population glob over 250+ umbrellas overruns the 120s `!`-fence (in named mode the flag is a no-op; dup-detect stays closure-agnostic without it):

```bash
MO_SKIP_CLOSED=1 bash ".agents/procedures/pipeline/helpers/run-helper.sh" ".agents/procedures/pipeline/helpers/dup-detect.sh" "${umbrella:-}"; bash ".agents/procedures/pipeline/helpers/run-helper.sh" ".agents/procedures/pipeline/helpers/inflight-check.sh" "${umbrella:-}"
```

`POTENTIAL_DUPE:`/`MISSING:` (dup-detect) → surface per [reviewer-discipline.md §2](../../../rules/reviewer-discipline.md). `INFLIGHT:` → **confirmation-needed before dispatch** (possible parallel-session collision). `UNKNOWN:`, unavailable/invalid/incomplete evidence, or any nonzero helper result → keep ownership/duplicate status unknown and the dispatch gate BLOCKED; repair or obtain the missing evidence. Absence of an `INFLIGHT:` line is not `CLEAR:`. `CLEAR:` only records successful complete observations in that helper's declared PR/branch/worktree scope and allows further planning; it does not prove merge closure, idle factory tasks, operator approval or authorization to dispatch. Inspect each wrapper's actual footer separately even when a compound tool command ends with another helper's zero exit.

**Step 3 — L4 classify each surviving candidate from Step 2:** <!-- @dual-pair: meta-orchestrator-classify-each-candidate -->

```bash
bash ".agents/procedures/pipeline/helpers/classify-each-candidate.sh"
```

Helper iterates `priority-score.sh` candidate set; per candidate routes to classify-work.sh (file-mode for `kickoff=exists`, string-mode for `kickoff=synthetic`, skip for `kickoff=missing`). Classification remains per-candidate; capture its real diagnostics and nonzero aggregate failure. Use `--stdin` only when deliberately supplying a captured candidate stream; closed noninteractive stdin does not replace default candidate acquisition. Per-candidate stdout: `--- candidate: <name> ---` + TYPE/DISPATCH/LOC/SURFACES/RATIONALE. **stderr NOT suppressed** (J1 from Stage 5): if a candidate exits 3 with `MISSING-FILE:` that is **F8 for that candidate** — recorded inline, iteration continues; collect all F8s for the §10 report per [`references/failures.md`](failures.md). Steps 5–9 below require N classifications (`sibling_count`, multi-Stage rendering, multi-id delta-diff); single-shot would break them.

**Step 4 — L5 assign-skill (OPTIONAL advisory — NOT consumed by Step 5):** emits a human-facing skill/agent hint only; the Step 5 routing tree decides Mode from the 6 predicates, **not** from this output (verified dead-output 2026-06-03, DN-8 — simplify-not-delete). Skipping has zero effect on routing.

```bash
bash ".agents/procedures/pipeline/helpers/assign-skill.sh" "<TYPE-from-Step-3>" "<one-line description from kickoff title>" 2>/dev/null
```

Advisory output: `recommended_skill: <slug>` / `recommended_agent: <path>` / `recommended: none`.
**Step 5 — routing decision tree (judgment on injected data):**

<!-- preset short-circuit: when PRESET_MODE is set (from §0 preamble --preset or AIF_PIPELINE_PRESET), the 3 routing predicates bundle_opt_in / review_required / parallel_safe come from the preset data file, short-circuiting the routing tree. The other 3 predicates (load_bearing, sibling_count, scope_decided) still derive from the existing logic below. -->

**Preset short-circuit (A4):** if `PRESET_MODE` is present in the §0 preamble output, skip the routing tree for the 3 preset-controlled predicates (`bundle_opt_in`, `review_required`, `parallel_safe`) — they are already resolved from the preset JSON. The remaining 3 predicates (`load_bearing`, `sibling_count`, `scope_decided`) still derive from existing logic. Proceed to Step 6 with the preset-driven ALIAS (mapped from `PRESET_MODE`). For `economy` (`PRESET_MODE=whole-line-executor`), the dispatch payload carries `PRESET_AIF_MAX_REVIEW_ITERATIONS=1` per §8a Park-3 (aif auto-review capped at 1 iteration; external cold fidelity round stays mandatory).

6 predicates: `load_bearing` (paths ∩ principle-09 REQUIRED_HEADER_DOCS), `sibling_count` (same-TYPE disjoint candidates), `scope_decided` (kickoff §binding non-empty OR non-DEFER research-patch; else FALSE → RESEARCH), `parallel_safe` (explicit decl OR disjoint scopes; default=FALSE → PAIR), `bundle_opt_in` (`--mode-bundle` OR silent TRUE for fix), `review_required` (`--mode-pair` OR kickoff hint OR `load_bearing`).

```text
if TYPE == "R-phase":
    Mode = RESEARCH
elif TYPE == "fix":
    if sibling_count >= 3 AND bundle_opt_in: Mode = BUNDLE
    else: Mode = DIRECT
elif TYPE == "I-phase-small":
    if review_required: Mode = PAIR
    else: Mode = SOLO
elif TYPE == "I-phase-large":
    if not scope_decided: Mode = RESEARCH
    elif SURFACES >= 2 AND parallel_safe: Mode = DECOMPOSE
    else: Mode = PAIR
```

**Step 6 — ALIAS mapping (single source — computed AFTER routing tree; `classify-work.sh` UNCHANGED per DN-3):**

| ALIAS     | DISPATCH (internal)                                   | Fires when Step 5 resolves to                                                                                            |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| DIRECT    | direct-Edit                                           | TYPE=fix AND (sibling_count<3 OR NOT bundle_opt_in)                                                                      |
| BUNDLE    | Mode-A-bundle                                         | TYPE=fix AND sibling_count≥3 AND bundle_opt_in                                                                           |
| SOLO      | Mode-A                                                | TYPE=I-phase-small AND NOT review_required                                                                               |
| PAIR      | Mode-SDD                                              | (TYPE=I-phase-small AND review_required) OR (TYPE=I-phase-large AND scope_decided AND (SURFACES<2 OR NOT parallel_safe)) |
| DECOMPOSE | Mode-B                                                | TYPE=I-phase-large AND scope_decided AND SURFACES≥2 AND parallel_safe                                                    |
| RESEARCH  | R-phase-session (single) / Queue-mode (≥2 sequential) | TYPE=R-phase OR (TYPE=I-phase-large AND NOT scope_decided)                                                               |

1:1 with Step 5 routing tree. Principle 19 (`packages/core/principles/19-meta-orchestrator-alias-routing-consistency.test.ts`) enforces mechanically. `Mode-A-bundle` sub-dispatch defined in bundle-autonomous umbrella.

**Step 7 — emit ALIAS in §10 rendered output:** Stage heading: `### Stage N — <name> (<ALIAS> / <Mode>, ~<cost>)`. Dep-graph bullet: `├── <name>   (<ALIAS> / <Mode>, ~<cost>, <role>)`. Template update deferred to follow-up PR per `feedback_no_drive_by_prs`.
**Step 8 — delta diff:** invoke `bash .agents/procedures/pipeline/helpers/delta-diff.sh "$(bash .agents/procedures/pipeline/helpers/print-orch-home.sh 2>/dev/null)/_master-backlog-delta.json" "<id-1>" "<id-2>" "<...>"` (post-dedup ids from Steps 2-3 as positional args) → emits `NEW-SINCE-LAST: <id>` (current ∖ seen) + `RESOLVED-SINCE-LAST: <id>` (seen ∖ current), sorted; missing delta → all current = NEW; lines feed §10; maintainer manually updates `wave-sequencing-plan.md §0` (Direction A REJECTED per R-phase β-2); semantics + contract: [`references/master-backlog-delta.md`](master-backlog-delta.md) + [`packages/core/hooks/delta-diff.test.ts`](../../../../packages/core/hooks/delta-diff.test.ts). <!-- @dual-pair: meta-orchestrator-delta-diff -->
**Step 9 — write-back to `_master-backlog-delta.json`:** `untracked_seen` ← current candidate set (overwrite-shape; `first_seen` = current ts). `closed_since_last` ← prior ids that no longer surface. Concrete `jq` shape in §10 step 5 — do NOT re-specify here.
