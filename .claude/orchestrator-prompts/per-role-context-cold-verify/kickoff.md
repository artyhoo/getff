<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
# Per-role context — follow-up research (2 tasks)

> **Authoritative for:** the dispatch instructions for the two research tasks the 2026-07-31 Opus
> cold-verify could not run itself. R-phase only — produce research records, pick nothing.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> The per-role-context design — reserved for a later `/arch` session. Findings already settled — see
> [`2026-07-31-per-role-context-opus-cold-verify.md`](../../../docs/meta-factory/research-patches/2026-07-31-per-role-context-opus-cold-verify.md)
> (do NOT re-litigate its §1 resolutions or §2 verify-list).

**Base:** `origin/staging`. **Mode:** R-phase, read-only sweep + markdown deliverables.
**Status when authored (2026-07-31):** NOT dispatched — the aif runtime was down (Docker socket absent,
`/runtime-profiles` and `/tasks` both `HTTP 000`). Dispatch when the runtime is back:
`npx tsx packages/runtime-bridge/src/cli/dispatch.ts .claude/orchestrator-prompts/per-role-context-cold-verify/kickoff.md`

## §0 Read first (inputs now exist — this is the change since the last attempt)

All five are on `origin/staging` and readable. The previous cold-review attempt (task `4e73e54e`)
returned a blocker-report **because these files were absent from its branch**. They are present now.

1. `docs/meta-factory/research-patches/2026-07-31-per-role-context-opus-cold-verify.md` — the Opus filter.
2. `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` — C1-C10.
3. `docs/meta-factory/research-patches/2026-07-27-per-role-context-addendum-fresh-2026.md` — C11-C13.
4. `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` — 18 shapes.
5. `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` — in-flight surface.

**Verify presence before starting** (`git cat-file -e origin/staging:<path>` per file). If any is missing,
STOP and report a blocker — do not substitute or reconstruct.

## Task 1: the 8-dimension cold-review that has never run

Audit deliverables 2-5 above (NOT deliverable 1 — that is this task's calibration reference, and auditing
the auditor is Task 1's §self-application note, not its body). Eight dimensions, verdict + evidence each:

- **A — format honesty.** Does each claim's stated evidence type match what was actually run? Flag any
  «verified» resting on inference.
- **B — claim quality (C1-C13).** Is each «Wrong if:» falsifier *actually falsifiable* — a concrete check
  someone could run — or is it unfalsifiable hedging? Rate per claim.
- **C — hidden pressure / recommendation language.** The patches assert they park all forks. Grep for
  smuggled verdicts: «should», «best», «clearly», «obviously», «the natural choice», comparative framing
  that pre-ranks options. Quote every hit with file:line.
- **D — completeness.** Named surfaces vs surfaces actually swept. The deep-research report already
  self-reports 8 scope limitations — check whether the patches inherit any of them silently.
- **E — verify-list quality.** Of the 8 items, how many were runnable as written? (One was not — item 1
  cites markers that do not exist. Find any others.)
- **F — internal consistency + citation spot-check.** Sample **≥12** file:line citations across the four
  documents, stratified: ≥4 from the raw patch, ≥4 from the addendum, ≥4 from the candidate-shapes
  catalogue. For each: open the cited line and state whether it says what the citing text claims.
  Report as `n/12 accurate`, listing every inaccuracy.
- **G — framing bias.** Do the 18 candidate shapes span the option space evenly, or do they cluster so
  that one family looks inevitable? Count shapes per family (spawn-side vs filter-side vs no-change).
- **H — token economy.** Total bytes of the four documents; what fraction is content a downstream reader
  needs vs restatement of other documents in the same set?

**Deliverable:** `per-role-context-cold-review-v2.md` at the branch root. One section per dimension,
verdict line + evidence. **No recommendation, no shape picked, no fork resolved.**

## Task 2: sweep the aif-handoff runtime's own agent definitions (the unswept layer)

The deep-research report swept 13 surfaces of *this* repo and the superpowers plugin. Nobody has swept the
layer where the repo's own dispatches actually run: the **aif-handoff product's agent definitions**.
`docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md:73-75,88-91` documents
`implement-coordinator` spawning `implement-worker` via the Agent tool with
`subagent_type:"implement-worker"` — those agent-definition files are the per-role context contracts that
every aif task in this project runs under, and they have never been read.

**Sweep target:** the aif-handoff checkout available to the container (find it; do not assume a path).
Enumerate every agent definition (`implement-coordinator`, `implement-worker`, `plan-coordinator`,
`plan-checker`, `reviewer`, sidecars, and any others — enumerate from the filesystem, never from this list).

For **each** agent definition report: (a) what context it is constructed with; (b) whether that context is
role-shaped or uniform; (c) whether the shaping is enforced by code or is prose the coordinator may ignore;
(d) file:line for each. Then answer: **does the aif runtime already do per-role context shaping, and if so
at what granularity?** Cite `coordinator.ts:199` and `reviewer.ts:30,287` (the shared-profile-socket walls
named in `docs/superpowers/specs/2026-07-23-acceptance-contour-design.md:14-15`) and verify those two
claims against the live source.

**Deliverable:** `per-role-context-aif-runtime-sweep.md` at the branch root.

**Hard boundary:** aif-handoff is an **external codebase**. Read-only. Do not edit, do not open a PR
against it, do not «fix» anything found there. Findings are the deliverable.

## §Constraints (both tasks)

- **R-phase only.** No source edits, no rule edits, no design. If you want to fix something, record it as
  a finding instead. Deliverables are markdown files at the branch root.
- **Do not edit any prior deliverable.** Research-patches are append-only, owned by the session that wrote
  them ([CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md)). Correct by ID in your own file.
- **Do not re-derive settled facts.** The Opus cold-verify §1/§2 resolved all 7 contradictions and ran the
  8-item verify-list. Treat those as inputs. If you find one *wrong*, that is a first-class finding —
  report it with evidence rather than quietly re-deciding.
- **Every finding needs file:line, command output, or an explicit `INCONCLUSIVE-needs-<X>` marker.** No
  prose-only findings.
- **Report absence loudly.** If a target does not exist, that is a finding, not a reason to substitute.

## §Host-verify contract

Both deliverables are markdown, so the host check is a substance check, not a test suite. Run from the
repo root **after harvest**, once the two files are on the host — a container-side "I wrote them" is not
evidence (see [`destination-environment-verification.md §3`](../../rules/destination-environment-verification.md)).
Invoke via `bash scripts/host-verify.sh per-role-context-cold-verify`.

```bash host-verify
test -s per-role-context-cold-review-v2.md
test -s per-role-context-aif-runtime-sweep.md
grep -qiE '^#+ .*self-application' per-role-context-cold-review-v2.md
grep -qiE '^#+ .*self-application' per-role-context-aif-runtime-sweep.md
test "$(grep -coE '[A-Za-z0-9_./-]+\.(md|ts|sh|json|mjs):[0-9]+' per-role-context-cold-review-v2.md)" -ge 12
test "$(grep -coE '[A-Za-z0-9_./-]+\.(md|ts|sh|json|mjs):[0-9]+' per-role-context-aif-runtime-sweep.md)" -ge 8
```

Line 5 is the Task 1 dimension-F floor (≥12 stratified citations) made mechanical; line 6 is the Task 2
per-agent-definition citation floor. They check that evidence *tokens* are present — a human/cold-agent
still judges whether each cited line says what the citing text claims. That gap is deliberate and named:
a citation's *accuracy* is semantic and cannot be a shell gate
([`attention-is-not-a-mechanism.md §1`](../../rules/attention-is-not-a-mechanism.md) — the check is (a)
deterministic for presence, and the accuracy half routes to Task 1 dimension F itself).

## §AI laziness traps

Per [`.claude/rules/ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md).
**Active traps: T1, T2, T3, T4, T7, T9, T10, T14, T20.**

- **T1/T10** — Task 1 dimension F has a floor of 12 citations, stratified; Task 2 requires filesystem
  enumeration before any per-agent verdict. Population first, sample second.
- **T2** — designing an audit method is not running it. Dimension verdicts need invocations and outputs.
- **T3** — no plausible-looking finding without opening the cited line.
- **T9** — do not sample the citations that are easiest to check. Stratify as specified.
- **T14** — a clean dimension with thin coverage is «coverage insufficient to conclude», not «clean».
- **T20** — no verdict without an evidence-bearing tool call in the same step.

**Domain-specific trap — T-PRC-A:** *when auditing a document that loudly claims «I park all forks and
recommend nothing», the tempting move is to accept that self-description and mark dimension C clean.* The
self-description is the claim under test, not evidence for it. Dimension C must be a grep with quoted hits
or an explicit «0 hits, patterns searched: …» — never a paraphrase of the document's own framing.

**Domain-specific trap — T-PRC-B:** *this material spans three layers (harness session-start assembly;
the repo's own SubagentStart digest; dispatch-time authored content). Findings from one layer read as
rebuttals of another.* Before recording any contradiction, state which layer each side measures. Most
apparent contradictions in this surface dissolved on that question — see the cold-verify §1 #6.

**T15 self-application (mandatory):** each deliverable ends with a §self-application note — what would
auditing *this* deliverable look like, and what did this task not check?
