# Effort worthiness — rigor must buy goal progress

<!-- channel: skill-embed .claude/skills/dispatcher/SKILL.md#effort-worthiness -->
<!-- channel: skill-embed .claude/skills/night-mode/SKILL.md#effort-worthiness -->
<!-- channel: skill-embed .claude/skills/arch/SKILL.md#effort-worthiness -->
<!-- channel: skill-embed .claude/rules/reviewer-discipline.md#effort-worthiness -->

> **Class:** C — prose statute; the mechanical skeleton lands on its own channels (§2 L3).
> **Fires:** any effort/rigor fork: probe demand, extra round, follow-up PR, budget breach.
> **Authoritative for:** the effort-worthiness discipline — §1 the rule + four-test card,
> §2 the six-layer loop, §3 anti-patterns, §4 prior-art, §5 promotion.
> **NOT authoritative for:** reviewer grammar — [reviewer-discipline.md §6](reviewer-discipline.md);
> the advisor seat + rationale/falsifiers —
> [advisor-pattern-design](../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md);
> project goal — [README.md#why-this-exists](../../README.md#why-this-exists).

> **Origin:** operator premise (2026-08-10, advisor-pattern §7 premises 7-9, 11): cost =
> effort × time × tokens **against goal progress**; «боевые практики, а не научные
> исследователи» (field practitioners, not research scientists). Evidence: the
> review-effort-theatre audit
> ([research patch](../../docs/meta-factory/research-patches/2026-08-10-review-effort-theatre-audit.md),
> PR #1369) — immaterial cost concentrated in follow-up PRs, the Audited-SHA treadmill, and
> ~34% finding-list padding, while material rework was 5/6 of churn.

## §1 The rule + the four-test card

Default is **practice-first**: build the reversible thing and verify it live. The burden of
proof sits on MORE rigor — whoever demands a probe, an experiment, or an extra round must
state (a) **what breaks if we skip it** and (b) **what learning-in-practice costs instead**
(proportionality rule). Reversibility, not importance, sets process weight (Bezos Type-1/
Type-2, §4): the research-grade contour is reserved for irreversible / genuinely expensive /
consumer-shipped surfaces.

Before spending effort, run the card — four tests, judged honestly, trace recorded:

1. Does this effort move us toward the goal?
2. Is it theatre (form satisfied, substance absent)?
3. Is it immaterial — changes nothing a consumer or decision would notice?
4. Material but cheaper to **verify in practice after building**?

**Materiality scales with the highest layer touched** (idea → design → architecture → plan →
implementation; conflicts resolve upward): «1% vs 2%» in an implementation report ≈ nothing;
the same delta in the idea layer is an owner question. No direct prior art exists for this
composition (§4 — searched, absent); it is this project's own cut.

The AI judges substance; mechanisms only verify the judgment happened and left a trace.
Zero-finding reviews and «not worth it» verdicts are legitimate outcomes — the KPI is
goal-shift, never findings-produced or rounds-run.

## §2 The six-layer loop (statute here; channels named per layer)

- **L0 — rigor label in the kickoff:** `research-grade` (irreversible / consumer-shipped /
  expensive) or `build-and-verify` (default), declared by the kickoff author. Presence =
  mechanical check (kickoff principle-test family — its own landing item).
- **L1 — the four-test card** (§1) at every effort fork. Judgment, trace in the artifact.
- **L2 — precedent RECORDING, not reliance:** verdicts land as precedent-shaped journal
  entries; retrieval/analogy is deliberately NOT trusted until measured (the CBR indexing
  problem, §4: retrieval finds surface twins, soundness needs structural match).
- **L3 — mechanical skeleton, each check with a named channel:** (a) `Failure-scenario:`
  required on round-triggering findings — deterministic arm in
  [pr-body-fidelity.ts](../../packages/core/hooks/checks/pr-body-fidelity.ts) + protocol in
  [reviewer-discipline.md §6](reviewer-discipline.md); (b) ask-file schema validity +
  (c) answered⇒journal-entry cross-check — pre-push section (landing item); (d) L0 label
  presence — kickoff principle test (landing item).
- **L4 — budget tripwire = forced escalation, never a guillotine:** a stage exceeding its
  round budget must ASK the concept holder before continuing (WIP-limit norm, §4: breach →
  conversation). Rounds only at v1 — tokens have no measurement surface yet. Numbers are
  config, not statute.
- **L5 — escalation judge + calibration:** the advisor judges residue with the same card;
  morning review reads the journal; theatre rates re-measured periodically (audit mold).

## §3 Anti-patterns

- `#type1-process-on-type2` — heavy research-grade process on a reversible surface; the
  named failure mode of the Type-1/Type-2 distinction (§4). Counter: L0 label + L1 test 4.
- `#findings-as-KPI` — a review round or follow-up PR spawned to prove effort, carrying no
  failure scenario. Counter: severity contract ([reviewer-discipline.md §6](reviewer-discipline.md)).
- `#rigor-by-paraphrase` — re-litigating a recorded verdict without new evidence. Counter:
  L2 journal + copy-or-pointer transfer.

## §4 Prior-art (pass run 2026-08-10; all sources accessed that day)

- **Conventional Comments** — `(blocking)`/`(non-blocking)` decorations; the default is
  org-defined — this rule sets default = non-blocking notes lane
  ([conventionalcomments.org](https://conventionalcomments.org/)).
- **Google eng-practices** — approve once the change «definitely improves the overall code
  health»; `Nit:` = ignorable; personal preference never blocks
  ([reviewer standard](https://google.github.io/eng-practices/review/reviewer/standard.html)).
- **Bezos Type-1/Type-2** — reversible two-way doors decided quickly; the failure mode is
  Type-1 process on Type-2 decisions
  ([2015 shareholder letter](https://s2.q4cdn.com/299287126/files/doc_financials/annual/2015-Letter-to-Shareholders.PDF)).
- **CBR indexing problem** — retrieval is surface-dominated, soundness needs structural
  match (Kolodner 1993; Gentner/Forbus MAC/FAC) — grounds for L2 record-without-reliance.
- **WIP limits (Kanban)** — a breached limit triggers swarm/discussion, not an automatic
  stop ([Anderson](https://djaa.com/revisiting-the-principles-and-general-practices-of-the-kanban-method/),
  [Atlassian](https://www.atlassian.com/agile/kanban/wip-limits)) — grounds for L4.
- **Concrete-failure severity** — independent hits: findings must «construct a specific
  failing scenario» ([PhotoStructure](https://photostructure.com/coding/claude-code-review/)).
- **Layered specs** — ADR supersession ([Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)),
  spec-kit `constitution → specify → plan → tasks`, Kiro `requirements/design/tasks`;
  nearest term of art: «specification tree» (MIL-STD-499 lineage). **Materiality-by-layer:
  no direct precedent found — novel composition** (honest-absence claim, 2026-08-10 pass).

## §5 Promotion / retirement

Promote a layer to a harder channel after 3 documented incidents in 6 months where the
prose statute missed a real defect (peer criteria:
[attention-is-not-a-mechanism.md §3](attention-is-not-a-mechanism.md)). Retire to CLAUDE.md
prose after 12 incident-free months. The L4 budget numbers are calibrated from the audit
rates (chip `task_c8cfb806`), never hard-coded here.
