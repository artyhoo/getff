<!-- scope: kickoff — orchestrator-rewrite umbrella (harmonization D-H9). Design base (BINDING):
docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md §4 D-H9 + §8 item 4
(status REVIEWED — GO 2026-08-18, three cold two-altitude rounds). The spec lives ONLY on the
local branch `claude/keen-shannon-46577a` (commit f2d3fe2655) — NOT on origin/staging — so every
load-bearing slice is QUOTED VERBATIM in §1 below (copy-or-pointer discipline: the pointer is
unreachable from a staging-based executor, so this kickoff carries the copy).
Tier 2 — NO bridge-profile marker: the spec ratified the DIRECTION (thin to deltas+bindings)
but did not enumerate the per-slice keep/remove map, so this kickoff is not plan-complete to the
fidelity-auditor bar (/arch §3: not plan-complete → no marker; top tier plans in aif). -->

# Kickoff — orchestrator-rewrite (D-H9): thin the orchestrator skill to deltas + bindings

> **Type:** factory umbrella, single stage (one PR).
> **Base branch:** `staging`.
> **Rigor label (L0):** `research-grade` — the target is a consumer-shipped surface
> (`.claude/skills/orchestrator/**` ships at env depth: present in all five
> `tests/install-sh/baselines/*/` fingerprints), and the D-H9 falsifier makes a named cold
> review the merge contract (§3), not a courtesy.
> **Merge gate (binding):** the PR merges only on a **live operator GO** — green CI + a GO from
> the §3 cold review are necessary, not sufficient. Do not self-merge.
> **Origin:** three-stack skill harmonization design contour (2026-08-17→18), decision D-H9
> «ratified», routed out as spec §8 item 4 («Separate factory umbrella: D-H9 orchestrator
> rewrite (deltas+bindings)»).

## §0 What already exists (read before deciding anything)

- [`.claude/skills/orchestrator/SKILL.md`](../../skills/orchestrator/SKILL.md) — **512 lines**
  (`wc -l`, 2026-08-18). The rewrite target.
- [`.claude/skills/orchestrator/references/`](../../skills/orchestrator/references/) — ten
  files, 1232 lines total (`queue-mode.md` 451, `ai-laziness-traps-orchestrator.md` 140,
  `reviewer-template.md` 140, `worker-template.md` 120, `quota-and-burn.md` 81,
  `batch-prompt-template.md` 74, `phase-minus-1.md` 70, `discovery.md` 69, `glossary.md` 43,
  `rationale.md` 44). Progressive disclosure already exists; the THIN verdict (§1) is about
  the SKILL.md body, not about inventing a references dir.
- **The model to follow:** [`.claude/skills/arch/SKILL.md`](../../skills/arch/SKILL.md) —
  148 lines, verdict ALREADY-THIN in the same measurement pass. Its shape: «A **thin
  wrapper**: phase 1 is `superpowers:brainstorming` verbatim; this skill owns only what no
  upstream piece covers … If you catch yourself re-describing the brainstorm loop, the
  reviewer protocol, or SDD here, stop — that is `#parallel-evolution-creep`»
  (arch/SKILL.md:30). Bindings live in the authority header («NOT authoritative for: the
  ideation loop itself — `superpowers:brainstorming` (ADOPT, wrapped, never re-described)»)
  and in one-line pointers at use sites, never as paraphrase.
- **The upstream stack the skill composes** (all installed, superpowers 6.2.0):
  `superpowers:subagent-driven-development` (the executor loop — SSOT #64, ADOPT),
  `superpowers:writing-plans`, `superpowers:dispatching-parallel-agents`,
  `superpowers:using-git-worktrees` (SSOT #65 — [`parallel-subwave-isolation.md §4`](../../rules/parallel-subwave-isolation.md)
  already REFERENCEs it instead of building).
- **Shipped-artifact status:** env-depth install; every file under
  `.claude/skills/orchestrator/` is fingerprinted in `tests/install-sh/baselines/*` — any
  edit requires `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` in the same PR.
- **No code pins the body:** `grep -rln 'skills/orchestrator' packages/core tests/ scripts/
  setup.d/` (ts/sh) returns nothing — the only mechanical couplings are the install
  fingerprints and the generic skill gates (principles 09 header, 14 frontmatter drift,
  15 paired-negative, 21 agnosticism).

## §1 The mandate (spec content, quoted verbatim — the spec is not on origin)

Prep-doc §4.5 measurement row (2026-08-17 pass), the evidence base:

> | orchestrator | 512 | **THIN — the main candidate** | Its role glossary, executor loop
> framing, and worktree-dispatch prose re-describe SDD / `using-git-worktrees` /
> `dispatching-parallel-agents`, all of which it already cites. Unique deltas worth keeping:
> discovery checklist, quota zones, model tiers (Fable/Opus/Sonnet), Mode B file-prompt,
> Queue mode, Phase -1 cold review. A rewrite to «deltas + bindings» (the `/arch` model)
> could roughly halve it. |

Spec §4 decision row (ratified):

> | D-H9 orchestrator rewrite | ratified | thin 512-line skill to deltas+bindings (the
> `/arch` model); factory umbrella (§8) | wrong if re-described slices turn out load-bearing
> (rewrite reviewer checks) |

Operator-premise register (spec §2, P-1..P-7) is **binding** on this umbrella. The premises
that bear directly here, verbatim-faithful:

- **P-1** «не соглашайся со мной и не уступай мне, мы обсуждаем и цель наша сделать как
  лучше» — if a slice the prep called re-description turns out to be a real delta, KEEP it
  and record why; the THIN verdict is evidence-based, not a quota.
- **P-2** «хотелось бы выбрать лучшее из обоих — они же спутники наши» — satellites doctrine;
  use-before-build ([BFR §1.1](../../rules/build-first-reuse-default.md)).
- **P-3** — the prune/thinning motive is **misrouting, not tokens** (the skill listing is
  budget-capped at ~1% of context; the harm of duplicated text is drift + wrong routing).
  Do not justify cuts by token counting.
- **P-6** «Про тдд не аргумент, хотелось бы сравнить и по существу решить что лучше» —
  incumbency alone decides nothing, in either direction: neither «our text was here first»
  nor «upstream exists» settles a slice; the slice's content does.

The full register + the three review rounds' dispositions live in the spec at
`docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md` on branch
`claude/keen-shannon-46577a` (read it via
`git show f2d3fe2655:docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md`
when the branch is fetchable; otherwise this section is the working copy).

## §2 Task

Rewrite [`.claude/skills/orchestrator/SKILL.md`](../../skills/orchestrator/SKILL.md) to
**deltas + bindings** over the superpowers stack it composes — the `/arch` model. **One PR.**

**Method — the removed-slice ledger is the deliverable's spine:**

1. **Enumerate slices first** (T10 order): walk the current SKILL.md section by section and
   classify each slice: `DELTA` (project-unique, no upstream owner) | `RE-DESCRIPTION`
   (upstream owns it; name the owner) | `MIXED` (re-description wrapping an embedded delta —
   split it). The six deltas the prep names are the floor, not the ceiling: discovery
   checklist, quota zones, model tiers, Mode B file-prompt, Queue mode, Phase -1 cold review
   (including the «Principle-test allowlist probe» — [`CLAUDE.md:134`](../../../CLAUDE.md)
   names this skill as that probe's codification target; the anchor must survive).
2. **Rewrite:** every `RE-DESCRIPTION` slice collapses to a binding — a pointer to the
   upstream owner plus ONLY the project delta, in the header's «NOT authoritative for» list
   and/or a one-line use-site pointer (the arch/SKILL.md:30 pattern). Upstream text is
   **never re-described** (`#parallel-evolution-creep` guard). `MIXED` slices re-home their
   delta (in the thinned body or an existing references/ file) before the wrapper text goes.
3. **Ledger:** the PR body (or a file under this umbrella dir) carries one row per removed
   slice: `old §/lines → upstream owner → delta re-homed at <file:line> | none`. This is what
   the §3 reviewer verdicts against — without it the review contract cannot run.
4. **Keep the skill mechanically valid:** frontmatter fields intact (principle 14),
   «Without/With this skill» paired-negative block present (principle 15), Class +
   Authoritative-for header (principle 09), description triggers intact
   ([skill-description-quality.md §2](../../rules/skill-description-quality.md)), body in
   English (principle 22).
5. **Do not change behaviour contracts consumers rely on:** the natural-language payload
   parse (no structured-args parser) is a recorded falsifier at
   [`pipeline/references/output-format.md:486`](../../skills/pipeline/references/output-format.md)
   and `:495`; Queue mode + Mode A/B vocabulary is referenced by
   [`pipeline/SKILL.md:595`](../../skills/pipeline/SKILL.md) and
   [`setup.d/10-skills.sh:82`](../../../setup.d/10-skills.sh). Thinning ≠ re-design.

## §3 The review contract (D-H9 falsifier operationalised — merge-blocking)

The D-H9 falsifier IS the review contract: **«wrong if re-described slices turn out
load-bearing»**. Before merge, dispatch a **cold reviewer** (cold per arch §2: artifact paths
only, never this session's dialogue) with: the ledger (§2 item 3), the old SKILL.md (from
`origin/staging`), the new one, and the consumer list below. The reviewer checks **each
removed slice** against the live consumers: does any consumer depend on text that only
existed in the removed slice?

Consumer list (re-derive it — `grep -rn 'skills/orchestrator\|orchestrator/SKILL' …` — do not
trust this snapshot):

- [`.claude/skills/pipeline/SKILL.md:22,487,595`](../../skills/pipeline/SKILL.md) — wraps,
  never forks; names Queue/dispatch primitive.
- [`.claude/skills/pipeline/references/output-format.md:256,266,486,495`](../../skills/pipeline/references/output-format.md)
  — routing token + natural-language payload contract + two falsifiers that read this skill's
  body.
- [`.claude/skills/pipeline/references/red-flags.md:17`](../../skills/pipeline/references/red-flags.md),
  [`.claude/skills/pipeline/templates/meta-kickoff.template.md:222,230`](../../skills/pipeline/templates/meta-kickoff.template.md)
  — wrap-never-fork guards.
- [`.claude/skills/dispatcher/SKILL.md:24,412`](../../skills/dispatcher/SKILL.md),
  [`.claude/skills/aif-doctor/SKILL.md:22,227`](../../skills/aif-doctor/SKILL.md) — authority
  boundaries pointing here.
- [`.claude/skills/night-mode/SKILL.md`](../../skills/night-mode/SKILL.md) — layers over SDD
  ×5 and routes seat-class items; check its orchestrator/Queue-mode references after the
  re-grep.
- [`CLAUDE.md:134`](../../../CLAUDE.md) — «Phase -1 principle-test allowlist probe» stub
  points INTO this skill's Phase -1 section; in-flight kickoffs cite it.
- [`.claude/rules/parallel-subwave-isolation.md:14`](../../rules/parallel-subwave-isolation.md)
  — companion-rule cross-reference.

Verdict grammar per arch §2 (`GO | REVISE | STOP`, findings with file:line +
`Failure-scenario:` on round-triggering ones). A removed slice a consumer depends on =
restore-or-re-home, never «the reviewer will remember».

## §4 Traps (per [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md))

Active: **T3**, **T16**, **T18**, **T19**, **T21**.

- **T3** — every «this slice is a re-description» claim carries the upstream file:line it
  re-describes (read the installed superpowers skill text, not memory of it).
- **T16** — per binding, verify the problem-class match explicitly: upstream SDD's loop is
  in-session subagent execution; this skill's Mode B / Queue mode dispatch cross-session
  workers. Where the classes differ, the slice is a DELTA even if the vocabulary matches.
- **T18** — deletion is the irreversible branch. A slice judged redundant is removed only
  after its unique residue (if any) is re-homed and the ledger row says where. When in doubt:
  keep + record, never delete + hope.
- **T19** — the §3 cold review is mandatory, but it does not replace your OWN adversarial
  read of the diff before dispatching that review.
- **T21** — backward sweep: the consumer list in §3 is a snapshot; enumerate the class
  («artifacts referencing the orchestrator skill or its vocabulary») by grep before
  concluding, and hand the §3 reviewer only the class + artifact paths, never this
  kickoff's narrative about them.

**Domain trap — T-OR-A: «the slice pattern-matches SDD, so it goes».** The measured hazard of
this exact rewrite: a MIXED slice (e.g. worker-prompt framing that embeds quota-zone
behaviour, or worktree-dispatch prose that embeds the project's `create-worktree.sh` base-ref
fix) reads as re-description at a glance; removing it by pattern-match silently drops the
embedded delta. Counter: the §2 three-way classification — `MIXED` is a first-class outcome,
and every removal row names where the delta went or states `none` with the upstream line that
covers it.

**Domain trap — T-OR-B: «binding that re-describes».** A «binding paragraph» that restates
the upstream loop in fresh words is the same `#parallel-evolution-creep` one layer down —
form changed, collision kept. Counter: a binding is a pointer + delta ONLY; if a binding
paragraph exceeds ~5 lines, re-check what it is actually adding.

## §5 Traps of the terrain

- **Shipped-artifact snapshot:** any edit under `.claude/skills/orchestrator/` breaks the
  install fingerprints — run `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` in
  the same PR, and `SNAPSHOT_MODE=compare` afterwards to prove it.
- **600-line markdown gate:** pre-commit blocks any md pushed past 600 lines —
  `queue-mode.md` (451) has headroom, but check `wc -l` before re-homing deltas into
  references/ files.
- **Prettier churn:** do not `prettier --write` skill/rule files wholesale — several are
  dirty on `staging` and the churn buries the review diff.
- **PR-body gates:** dry-run before `gh pr create` — the fidelity gate
  (`fidelity-verdict-in-pr-body` is a required staging check; `FIDELITY: skipped —
  <reason>` is legitimate for a no-provenance PR), and `Prior-art:` must BEGIN a line if
  used. This PR is doc-only (md carve-out — not a capability commit), so the trailer is not
  required; if the hook flags a mixed diff, use the escape hatch with a ≥20-char rationale.
- **Spec unreachability:** do not burn time hunting the spec on origin — §1 carries the
  binding quotes; the branch name + SHA are given for provenance only.

## §6 Done criterion

1. `SKILL.md` is deltas + bindings: every surviving slice is either a ledger-classified
   `DELTA` or a binding; no upstream text re-described. The prep's «roughly halve» is the
   expected magnitude, **the ledger is the acceptance basis, not a line-count target**.
2. All six named deltas survive at stable anchors (Phase -1 «Principle-test allowlist probe»
   heading still resolvable from `CLAUDE.md:134`'s description).
3. The removed-slice ledger exists (PR body or umbrella file) with one row per removal.
4. The §3 cold review ran against the ledger + consumers and returned GO; its report is
   linked from the PR.
5. Snapshots recaptured; host-verify (§6.1) green on the host; CI green.
6. **Live operator GO received before merge** (header binding).

## §6.1 host-verify — acceptance runs on the HOST

([`destination-environment-verification.md §1`](../../rules/destination-environment-verification.md);
a container-green run does not accept this work.)

```bash host-verify
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts packages/core/principles/14-skill-drift-detection.test.ts packages/core/principles/15-skill-paired-negative.test.ts
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
wc -l .claude/skills/orchestrator/SKILL.md
grep -n "Principle-test allowlist probe" .claude/skills/orchestrator/SKILL.md
grep -rn "skills/orchestrator" .claude/skills/pipeline/SKILL.md .claude/skills/dispatcher/SKILL.md .claude/skills/aif-doctor/SKILL.md
make self-audit
```

The `grep -n "Principle-test allowlist probe"` line fails loudly if the rewrite dropped the
one anchor an external doc (CLAUDE.md:134) names by heading — the cheapest instance of the
whole falsifier class.

## §7 Not in scope

- The sibling factory umbrella «skill-harmonization-mechanisms» (spec §8 item 3: prune
  script, `--check` pre-push section, CONTEXT.md principle test, claim machinery, `Depends
  on` frontier) — separate umbrella, separate owner.
- Editing any consumer (`pipeline`, `dispatcher`, `aif-doctor`, `night-mode` skills;
  `CLAUDE.md`; rules) — the Artifact Ownership Contract stands; if a consumer's pointer
  needs to move, surface it as an observation in the PR body.
- The consumer-axis satellite contour (D-H18) and anything under
  `packages/core/templates/**` — this umbrella is operator-axis except for the mechanical
  snapshot recapture the env-depth shipping forces.
- Re-designing the skill's behaviour contracts (payload parse, Mode A/B semantics, Queue
  mode protocol) — thinning only.
