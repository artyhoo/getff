<!-- scope: stage-scoped dispatch input — S-B of the arch-v2-context-pipeline umbrella (handoff decision 11: stage-scoped inputs are binding for multi-stage umbrellas). Self-contained: an executor holding ONLY this file plus the design spec can run it. NO bridge-profile marker — deliberate, see §0. Authored 2026-07-31. -->

# arch-v2-context-pipeline S-B — dispatch-input contract v2 + calibration ledger

> **Stage goal:** build the **bottom-seat check** as a dispatch-input station (ADR-6: five equal
> classes + the K6 candidate/adjudicate split), the **calibration ledger** with its threshold
> pre-registered before any row exists (ADR-5), the **5-dispatch shadow-A/B protocol**, and the
> **cold-seat watch-list** decision (format + durable home). **Design SSOT (read first, in full):**
> [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
> — **ADR-5** (shadow-A/B, threshold, `shadow=absent`), **ADR-6** (the five classes + K6 split and
> its stated false-negative class), §4 item 2, §5 failure modes. **Umbrella context (sequencing
> only, not needed to execute):**
> [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md) §1 S-B, §2.
>
> **This stage is S-B only.** S-C (L2 verdict), S-D (L2 build), S-E (budget gate), S-F (small
> fixes) are OUT OF SCOPE — do not implement, do not pre-wire, do not mention as done. S-A is
> already merged (#1192); do not re-open `.claude/skills/arch/SKILL.md` beyond a pointer if one is
> genuinely required. A systemic issue found outside this scope is surfaced in the PR body as an
> observation, never spun into an extra PR ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

## §0 Dispatch facts (binding)

- **No `bridge-profile` marker on this file — deliberate, not an omission.** Tier 2: the classes
  and the threshold are pre-decided, but the station's **shape** is not (an `agents/*.md` cold
  agent vs a skill vs a kickoff section, and where it hooks into aif dispatch). Under CLAUDE.md's
  binding tie-breaker («when unsure between Tier 1 and Tier 2, default to Tier 2»), Tier 2 →
  project defaults: the top tier plans in aif, the executor tier implements and reviews. The
  umbrella's §4 O-6 additionally recommends (a MINOR objection with a stated operator-override
  falsifier) not leaning on the `/arch` D1 exception for this track; §1 applies that
  recommendation. Do not add a marker without the operator's explicit ruling quoted here.
- **Staging placement.** This kickoff must be on `origin/staging` before dispatch
  ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- **Ownership.** `.claude/skills/**`, `agents/**` and `.claude/orchestrator-prompts/**` are
  session-editable. **`.claude/rules/**` is maintainer-owned** — the one rule edit this stage
  needs ([`cold-seat-economy.md §3`](../../rules/cold-seat-economy.md) pointing at the chosen
  watch-list home) ships as a **proposed diff in the PR body**, never as a direct edit
  ([CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md)). `CLAUDE.md`, `.husky/pre-push`
  and `.claude/settings.json` are likewise off-limits.
- **Ceilings.** A pre-commit hook blocks any markdown file past **600 lines** — run `wc -l` before
  adding. Any new `agents/*.md` needs the mandatory frontmatter or the pre-push skill-drift gate
  rejects it (S-A hit exactly this: commit `80623c0b79`).
- **Fingerprint consequence of a new agent (mechanical, will bite).** `install.sh` copies
  `agents/*.md` **by glob** with a per-file skip-list (authoring-only agents like
  backward-sweep-auditor are skipped), so a new agent file either (i) ships to consumers and shifts
  **all 8** install fingerprints — regenerate with `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`
  in the same commit (precedent: `80623c0b79` regenerated 8 baselines for one agent edit) — or
  (ii) is added to the skip-list as authoring-only, with the rationale comment the existing entries
  carry. The dispatch-input checker is an authoring-side station; (ii) is the expected branch, but
  decide it explicitly and record which.
- **Parallel sibling.** S-C runs concurrently on a disjoint surface (a research verdict). Work in
  your own worktree; do not touch S-C's files.

## §1 Work items

### W1 — the dispatch-input contract v2 artefact

**Decide the shape first, and record the decision.** Three candidate homes: (a) a new
**agents/dispatch-input-checker** cold-agent file (not yet existing — this stage creates it; peer: [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md),
[`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md)); (b) a skill; (c) a
mandatory kickoff section. Choose ONE with a stated rationale citing
[build-first-reuse-default.md §1](../../rules/build-first-reuse-default.md) (which verdict of the
seven, and why) and [rule-enforcement-channel-selection.md](../../rules/rule-enforcement-channel-selection.md)
(which channel actually fires at dispatch time). **Recommended default, overridable with reasons:**
(a) — the two peer auditors establish the pattern, the seat must be cold by construction, and an
agent file is AI-agnostic and session-read (no paid LLM in CI).

**Content — five EQUAL classes, no primary/background split** (ADR-6; the earlier «K1/K2 primary,
5/5 incidents» derivation is retracted and must not reappear):

| Class | What the seat checks |
|---|---|
| K1 | anchors exist — every cited path/section/line in the dispatch input resolves |
| K2 | quoted outputs reproduce — re-run the quoted command, compare |
| K3 | sibling-pattern consistency — the input matches how sibling artefacts of its class are built |
| K4 | format mechanics incl. **silent** failure modes (a check that skips quietly is a defect) |
| K5 | external-state preconditions — required-check registrations, live profile names, env vars |

**K6 — self-consistency with declared non-goals — enters as a SPLIT check.** The executor arm emits
**candidates** only: a closed verdict-lexicon grep (`Recommendation|Verdict|should adopt|Preferred`)
plus the extracted non-goal declarations, as structured output. The Opus framing-bias look
**adjudicates**. State the known false-negative class in the artefact: *bare priority labels with no
verdict word (e.g. a lone «High» ranking beside an option) defeat the lexicon* — the executor arm is
a candidate generator, never the decision layer
([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).
**Deviation from spec, deliberate:** ADR-6's lexicon as written includes `High —` while naming
«High — natural host» as the false-negative example — self-refuting. This kickoff supersedes that
wording: `High —` is dropped from the lexicon and the false-negative example is one the lexicon
genuinely misses. Record this deviation in the artefact; do not re-import the spec's literal list.

The artefact declares its **output grammar** (per-class verdict + findings with file:line evidence)
and names where the run is recorded (W2's ledger row).

**How to verify:** the artefact exists and names all five classes plus the K6 split;
`grep -c 'primary\|background' <artefact>` shows no revived split; the false-negative sentence is
present.

### W2 — the calibration ledger

**Path:** **.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md** — created by
this stage; the umbrella §2 fixes this path, do not relocate it. Appended to by every subsequent
stage dispatch.

**Header pre-registers, BEFORE any row exists** — a threshold written after the data is not a
threshold:

- the **ADR-5 threshold**: «≥2 of 5 runs in which Opus finds a K1/K2-class defect the bottom seat
  missed → the seat re-tiers to Opus (checks stay, tier moves)»;
- the **ADR-8 window** (20 role-shaped dispatches) and its owner (the L2 umbrella orchestrator);
- the **ADR-6 re-derivation gate**: «a K-class with 0 catches across 10+ runs while costing
  measurable seat time may be demoted, with the data attached».

**Row schema (one row per dispatch):** date · stage · task id · bottom-seat findings by K-class ·
shadow-arm findings by K-class · diff (found-by-Opus-only) · `shadow=present|absent` ·
verdict-affecting notes.

**`shadow=absent` convention (load-bearing):** a run whose Opus arm was unavailable proceeds but
does **NOT** count toward the 5-run cohort — silence never reads as health
([autonomous-loop-continuity.md §2](../../rules/autonomous-loop-continuity.md)).

**Instrument for the ADR-8 baseline rows** (verified live 2026-07-31, umbrella §4 O-3 — the aif
task record carries the fields):

```bash
curl -s "$RUNTIME_BRIDGE_AIF_URL/tasks" | jq -r '.[] | [.id,.status,.tokenTotal,.costUsd] | @tsv'
```

Baseline rows name their environment (per-environment ceilings, N2). **Baseline capture itself is
S-D's job, not this stage's** — S-B ships the schema and the header, not the rows.

**Do NOT ship the ledger-row-completeness principle test here** (umbrella §4 O-4): a test asserting
«no empty-verdict rows» over a ledger with zero rows is vacuous, and a vacuous gate is a permanent
noise floor by the same argument ADR-7 uses to drop SOLID. Record the deferral **with its trigger**
(«the 5th row lands → ship the test in that stage's PR») in the ledger header.

### W3 — the shadow-A/B protocol

Written into the artefact chosen in W1 (or a short sibling section in the ledger header — state
which, do not leave it implicit). It must answer, explicitly:

1. **Who runs the shadow arm** — an Opus cold pass on the SAME dispatch input as the bottom seat,
   for the first 5 pipeline dispatches.
2. **What happens when Opus is unavailable** — the run proceeds, is logged `shadow=absent`, and
   does **not** count toward the 5.
3. **What closes the window** — the threshold in W2's header, evaluated by the umbrella
   orchestrator, with the outcome recorded as a ledger note.
4. **Why executor-now + shadow** (ADR-5's own reasoning, restated in one sentence, not re-derived):
   during the calibration window Opus reviews every input anyway, so starting the bottom seat on
   the executor tier costs zero coverage while the window runs.

### W4 — the cold-seat watch-list: format + durable home

Per the umbrella §1 S-B «Design input» paragraph and [`cold-seat-economy.md §3`](../../rules/cold-seat-economy.md):
at round 1 a cold seat records, compactly, **why each acceptance criterion exists and where defects
previously lived**; follow-up rounds hand a **fresh** narrow seat the incremental diff + the
kickoff's scope sections + this list, **inlined in the dispatch prompt** («answer without reading
files»), instead of resuming a transcript-replaying agent.

**Decide and record:**

- **Format** — the field set of one watch-list entry (at minimum: the criterion, why it exists, the
  file/region where a defect previously lived, what reintroduction would look like).
- **Durable home** — PR-body `## Review findings` section vs aif task comment vs a ledger column.
  Weigh: survives a fresh seat with no transcript; reachable from the dispatch prompt without a
  tool call (turn count is what dominates cost — `cold-seat-economy.md §3` table); survives PR
  squash-merge.
- **Rule sync** — `cold-seat-economy.md §3` currently says «free-form until the arch-v2 S-B stage
  formalises the format». Ship the pointer update as a **proposed diff in the PR body** (the rules
  directory is maintainer-owned, §0). **Acceptance-narrowing, stated not silent:** the umbrella's
  S-B acceptance sentence says the rule is «updated»; that wording predates applying the
  [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md) (`.claude/rules/**` owner =
  maintainers, read-only for session agents) and is superseded by it — «updated» is satisfied by
  the proposed diff plus the maintainer landing it, and a fidelity seat should score it so.

**Do not re-measure the token numbers** in that §3 table — they are already recorded; re-deriving
them is out of scope and would be a `#reaudit-on-sha-move`-shaped waste.

### W5 — run the contract once, for real (T2)

The contract is **not shipped because it is written**. Run the bottom-seat check against **one real
dispatch input** — the honest choice is *this very kickoff* or the S-C kickoff, both of which exist
before the station does — and record the run as the **first ledger row**, `shadow=absent` unless an
Opus arm actually ran. Findings are reported, not silently fixed: if the check finds a K-class
defect in its own input, that is a successful run, and the finding goes in the PR body.

If the run finds nothing at low coverage, log «coverage insufficient», never «input clean» (T14).

## §2 Acceptance (all must hold)

1. The contract artefact exists at the chosen home, with the shape decision and its BFR verdict
   stated; five **equal** classes; the K6 split with the executor arm as candidate generator only;
   the known false-negative class written out.
2. The calibration ledger file (W2 path) exists with the three
   pre-registered header items (ADR-5 threshold, ADR-8 window + owner, ADR-6 re-derivation gate),
   the row schema, and the `shadow=absent` convention.
3. The shadow-A/B protocol answers all four W3 questions explicitly, including the Opus-unavailable
   path.
4. The watch-list format + durable home are **chosen and recorded**, with the
   `cold-seat-economy.md §3` pointer update proposed as a diff in the PR body.
5. The ledger-row-completeness test is **deferred with its trigger recorded in the ledger header**,
   not shipped.
6. At least one real ledger row exists from the W5 run.
7. The PR body carries the §3 self-check below and a `Prior-art:` trailer (or a ≥20-char escape
   rationale).

```bash host-verify
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts
npx vitest run packages/core/principles/12-ai-laziness-traps.test.ts
npx vitest run packages/core/principles/21-shipped-agent-tools-valid.test.ts
npx tsx scripts/render-rule-index.mjs --check
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

> Principle 21 and the snapshot compare are load-bearing only if W1's chosen home is a new
> `agents/*.md` (they gate agent `tools:` validity and the install fingerprints); on another home
> they still run and stay green.

> Run them via `bash scripts/host-verify.sh arch-v2-context-pipeline-s-b` **on the host** — a green
> container run is not evidence about the host
> ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).
> The runner is invoked around this block, never listed inside it.

## §3 §1.7 self-check obligation for this stage's PR

**Forward-check** must name, each with `file:line` evidence: `build-first-reuse-default.md` (the
verdict behind the W1 shape choice), `rule-enforcement-channel-selection.md` (why this channel),
`attention-is-not-a-mechanism.md` (the K6 split is exactly its «candidate generator ≠ decision
layer» shape), `no-paid-llm-in-ci.md` (the seat is session-read, zero API-billed CI calls),
`doc-authority-hierarchy.md` (any new doc carries Class + Authoritative-for).

**Backward-check** must enumerate **sibling surfaces the diff did NOT touch** and verdict each
`SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`. The change class is *cold-seat protocols and their
run records*; the enumeration must at minimum reach `agents/fidelity-auditor.md`,
`agents/backward-sweep-auditor.md`, `.claude/skills/dispatcher/SKILL.md §2.4`,
`.claude/skills/harvest/SKILL.md §4` and `.claude/rules/cold-seat-economy.md`. A backward-check
whose surface list equals the diff's own file list is **non-conformant by format** — delegate the
sweep to [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md), handing it
the change *class* only, never this kickoff or the diff.

## §4 Descopes (BINDING)

No S-C..S-F content: no L2 population table, no channel verdict, no L2 build, no budget gate, no
small-fixes items. No ADR-8 baseline **rows** (S-D captures those). No ledger-row-completeness
principle test. No direct edits to `.claude/rules/**`, `CLAUDE.md`, `.husky/**`,
`.claude/settings.json` — proposed diffs in the PR body only. No new npm dependency. No CI workflow
changes. No retro sweep of existing kickoffs against the new contract. **No SSOT append** — S-C
owns `docs/meta-factory/prior-art-evaluations.md` this round (the two stages run in parallel and it
is the one file both could touch); a warranted new entry is a proposed diff in the PR body.

## §4a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with
the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.**
Proceed only on the unambiguous parts.

This is expected to fire at least once here: W1's shape choice and W4's durable home are genuine
forks with a stated recommendation, not a settled answer. Choosing them **with reasons recorded** is
in scope; choosing them silently is the failure. Never manufacture a quoted command output for
anything outside your environment.

## §5 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T2, T3, T7, T11, T14, T15, T20, T21.**

- **T2** — designing ≠ running. W5 is the whole point: the contract is not shipped until it has been
  fired at a real dispatch input and that run is a ledger row.
- **T3** — every claim about a sibling surface, the runtime, or a quoted output carries the command
  and its output, or a `file:line` whose content you quote. No prose-only findings.
- **T7** — §2 is not a checklist to tick: run each command and paste its output.
- **T11** — the W1 shape choice runs the BFR mechanism (SSOT consult + the existing `agents/*.md`
  peers) before proposing a home; a proposal with no consult is a reject at review.
- **T14** — a clean W5 run at low coverage is logged «coverage insufficient», never «input clean».
- **T15** — self-application: this stage builds the station that checks dispatch inputs, and its own
  input (this file) was authored **before** the station existed. State in the PR body what the W5
  run found in it, including nothing.
- **T20** — no verdict in the PR body without an evidence-bearing tool call in the same turn.
- **T21** — the §3 backward-check enumerates non-diff sibling surfaces; a restatement of the diff is
  non-conformant.
- **T-SB-A (domain) — «the ledger proves the seat works».** A ledger with rows looks like evidence
  even when every row is `shadow=absent`. Counter: the cohort counter in the header counts only
  `shadow=present` runs, and the threshold is evaluated against that counter — write it so the two
  cannot be confused.
- **T-SB-B (domain) — «K6's lexicon is the check».** The grep is a candidate generator; treating its
  empty result as «no framing bias» is exactly the false-negative ADR-6 names. Counter: the artefact
  states the adjudication step and the false-negative class in the same paragraph as the lexicon.

## See also

- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md) — ADR-5, ADR-6, ADR-8 (binding).
- [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md) — umbrella §1 S-B, §2 ledger bootstrap, §4 objections.
- [`.claude/rules/cold-seat-economy.md`](../../rules/cold-seat-economy.md) — W4's parent rule.
- [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) · [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md) — the cold-agent pattern W1 chooses from.
- [`.claude/rules/attention-is-not-a-mechanism.md`](../../rules/attention-is-not-a-mechanism.md) — the K6 split's parent discipline.
- [`docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-handoff.md`](../../../docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-handoff.md) — decision 11 (stage-scoped inputs are binding) + decision 5 (contract v2), the provenance of this file's format.
