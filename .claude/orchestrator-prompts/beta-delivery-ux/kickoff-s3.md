<!-- scope: stage kickoff — beta-delivery-ux S3 (tier-home doc + degradation matrix + CLAUDE.md pointer, spec A3). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-delivery-ux-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker): top tier plans, executor implements + reviews. -->

# beta-delivery-ux S3 — tier-home doc + degradation matrix (A3)

> **Type:** execution-build (shipped doc + one cross-owner pointer commit), single PR onto `staging`.
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §4 **A3** is the design SSOT. On any divergence between this kickoff and the spec,
> **the spec wins** — surface the divergence, never improvise past a binding decision.
> **Umbrella context (read-only):** [`../beta-delivery-ux/kickoff.md`](kickoff.md) §2 row S3 +
> [`../beta-delivery-ux-meta-launch/kickoff.md`](../beta-delivery-ux-meta-launch/kickoff.md) §4 Stage 2 (S3 bullet).
> **Base branch:** `staging`.

## §0 Goal

Ship a single AI-agnostic doc that is the authoritative «tier home»: it carries the Tier 0/1/2
criteria and the explicit degradation matrix (what degrades how when a capability is absent).
Then turn the operator-repo `CLAUDE.md` «Task-tier routing» section into a POINTER at this doc,
so the doc is the SSOT and CLAUDE.md no longer re-owns the criteria.

This is the smallest stage by LOC but the most cross-cutting: it touches shipped docs (S3 doc),
the `env`+`factory` payload manifests (doc ships in both), AND the operator repo's CLAUDE.md
(cross-owner edit — gated separately, §3).

## §1 Inputs (re-verify at entry)

- **CLAUDE.md «Task-tier routing»** — currently OWNS the tier criteria inline. `git show
  origin/staging:CLAUDE.md` (find the section) — this is what becomes a pointer. **Re-verify the
  section anchor + line range at entry** (staging moves fast).
- **Acceptance-contour D1 amendment** — ALREADY on staging (`git show origin/staging:CLAUDE.md`
  carries the acceptance-contour exception paragraph). This was the S3 neighbor gate; it is
  UNBLOCKED. **Re-verify at entry (T-BDU-C).**
- **C3 probes** — non-CC harness degradation validation. 16 zcode twins exist (per spec A1).
  The degradation table must be VALIDATED by C3, not asserted.

### §1.1 Payload home — OPEN FORK (spec A3: «payload home chosen at stage planning: `.ai-factory/` doc or skill-context»)

**This is the genuine fork F-A′.** Two defensible homes:

- **Option A — `.ai-factory/` doc** (e.g. `.ai-factory/tier-home.md` or `docs/`-side). Readable by
  AGENTS.md pointer + non-CC harnesses cheaply (just a file).
- **Option B — skill-context** (e.g. `.ai-factory/skill-context/tier-home/SKILL.md`). Loaded by
  the skill-context mechanism; more structured, but heavier.

**The spec explicitly leaves this to stage planning AND names it as a known fork.** Per the
§7 park-don't-guess contract, **PARK this** with both options + consequences stated. Do NOT pick.
Record the maintainer's answer when it comes; implement the chosen home.

## §2 The doc — what it carries

A single AI-agnostic markdown doc with two load-bearing sections:

### §2.1 Tier 0/1/2 criteria

The criteria that CLAUDE.md «Task-tier routing» currently owns inline. Lift them INTO the doc
verbatim (this is the move that makes the doc the SSOT), then CLAUDE.md points here.

### §2.2 Degradation matrix (explicit, exhaustive)

| Capability absent | Degradation | C3-validation status |
|---|---|---|
| no aif | in-session SDD | TO-BE-VALIDATED by C3 (umbrella C, post-A3) |
| no GLM subscription | tiers slide (night-mode posture SSOT) | TO-BE-VALIDATED by C3 |
| no Fable | Opus tops | TO-BE-VALIDATED by C3 |
| non-CC harness | per-artifact degradations | TO-BE-VALIDATED by C3 (16 zcode twins) |

**Sequencing honesty (spec §9: «C3/C5 gated on A3 — tier-home exists»):** C3 is a NEW probe class
built in **umbrella C, AFTER A3 ships** (spec §6 C3: «today NO probe enumerates `.claude/skills`»).
Therefore at S3 stage time C3 **does not exist yet** — the matrix rows CANNOT be C3-validated now.
What S3 DOES: each row is (a) authored **consistent with the current known degradation behaviour**
(cross-checked against CLAUDE.md tier criteria + the night-mode posture SSOT), and (b) annotated
`TO-BE-VALIDATED by C3` with the specific C3 probe that WILL validate it once umbrella C lands.
Do NOT fabricate C3 probe output — the probe class does not exist. Do NOT relabel existing
agnosticism surface probes (which validate *coverage*, not *degradation behaviour*) as «C3».

A row that reads «degrades to X» must cite its CURRENT evidence source (CLAUDE.md tier section +
night-mode SSOT line, or an existing agnosticism probe that partially covers it), with the C3
forward-reference recorded as the future validation gate. This is the honest staging; spec §9
makes A3 the precondition for C3, not the other way around.

## §3 CLAUDE.md pointer-ization — cross-owner edit (separate atomic commit)

The CLAUDE.md edit is a **cross-owner edit** under the Artifact Ownership Contract. It ships as
a **separate atomic commit** with its own rationale, and the PR does NOT merge until the
maintainer has signed off on that specific commit. Same treatment as the meta-launch amendment
(spec §9, r3).

**The edit:** the «Task-tier routing» section's inline criteria → replaced by a one-line pointer
to the shipped SSOT doc (the §2.1 home). The pointer line + the doc path.

**Gating:** this is the S3 → R1 gate component (meta-kickoff §3: «R1 does not dispatch until the
maintainer has signed off on that specific commit»). The maintainer sign-off is recorded in the
meta-launch state.md §3 Phase -1 verdict table.

## §4 «Works» — acceptance (explicit + testable, evidence quoted in the PR body)

1. **Doc ships in `env` + `factory` payloads** — both profile manifests reference it; `--profile env`
   install places it at the chosen home (§1.1). Command + output (T3).
2. **AGENTS.md template points at it (C1 contract)** — `packages/core/templates/shared/AGENTS.md.template`
   carries a pointer line to the doc. Verify it renders in a consumer install.
3. **Degradation matrix rows authored + C3 forward-referenced** — each row cites its CURRENT
   evidence source (CLAUDE.md / night-mode SSOT / existing agnosticism probe) AND records the C3
   probe that will validate it post-A3 (umbrella C). No fabricated C3 output (the probe class
   does not exist at S3 stage time — spec §9 sequencing).
4. **CLAUDE.md pointer-ization is a separate commit + maintainer-signed-off** — the commit SHA +
   maintainer sign-off recorded in the PR body / state.md.
5. **No tier criteria duplicated in two places** — grep proves CLAUDE.md no longer owns the criteria
   inline; the doc is the single owner.

## §5 Out of scope (do NOT do these here)

- Pipeline presets / `/pipeline status` / workspace one-command → S2.
- GLM one-button flow + aif guided-install implementation → S4.
- `/arch` + `claude-glm-executor-handoff` shipping + runtime-bridge vendoring → S5.
- npm release mechanics → R1.
- Killer-layer code (track 1 owns).
- Editing `/arch` or `claude-glm-executor-handoff` CONTENT.
- Touching `setup.d/47-go.sh` or any go-lane row.

## §6 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T3, T7, T10, T13, T19, T20, T21.** (Note: SDD = No for this stage
per meta-launch decision 6 — under the ≥3-independent-task threshold; review overhead would exceed
catch-rate. Compensate with extra T19 cold-QA rigor.)

- **T3** — every «ships in payload» claim carries command + output. `--profile env` install +
  `ls` of the placed doc.
- **T7** — do not pattern-match §4 into checkbox theater; the C3 validation is live-fired.
- **T10** — the degradation matrix must enumerate ALL capability-absence rows that the tier system
  implies, not just the ones you remembered. Cross-check against CLAUDE.md's current criteria +
  the night-mode posture SSOT + the C3 probe set.
- **T13** — ADOPTED ≠ zero-work. The tier-criteria vocabulary is lifted from CLAUDE.md — confirm
  the lift is faithful, not paraphrased-into-drift.
- **T19** — own adversarial cold-QA of the diff before handoff. CI ≠ design review. Extra rigor
  since SDD = No here.
- **T20** — every degradation-matrix row cites its C3 probe. No bare assertions.
- **T21** — Backward-check enumerates **sibling surfaces**, not the diff (§8).
- **T-BDU-C (domain)** — «the neighbor gate is probably clear by now». §1 acceptance-contour D1
  re-verified at entry in both directions.

## §7 Park-don't-guess contract (BINDING — this task runs autonomously)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
> `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
> Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep
> moving" is the failure this whole loop exists to prevent.

**Known fork-prone spots in this stage — park these rather than guessing:**

- **F-A′ payload home (§1.1)** — `.ai-factory/` doc vs skill-context. THE primary fork. Park it
  with both options + the C1/AGENTS.md readability tradeoff. Do NOT pick.
- **Degradation matrix row granularity** — when a capability absence has multiple sub-degradations
  (e.g. non-CC harness degrades differently per-artifact), how many rows? Park if the granularity
  is genuinely ambiguous; do NOT silently collapse or expand.
- **CLAUDE.md pointer wording** — if multiple phrasings are defensible, park the wording choice.

Technical forks strictly inside the kickoff bounds (markdown structure, where the evidence
footnote lives, table column order) are yours to resolve — resolve them and record why.

## §8 PR-body requirements (both gates are REQUIRED checks on `staging`)

This stage touches `CLAUDE.md` + `packages/core/templates/**` (AGENTS.md template pointer) +
shipped docs → **the §1.7 mandate is ON**.

**Required sections — H3 depth (`###`), the word «applied» is required, ≥40 non-whitespace
chars in EACH body, ≥1 `path.ext:N` citation per section:**

```markdown
### §1.7 Forward-check applied

<which existing disciplines were checked, with file:line evidence>

### §1.7 Backward-check applied

<sibling-surface sweep — see below>
```

**T21 — the Backward-check is where this stage will fail if you rush it.** Enumerate sibling
surfaces the diff did NOT touch and verdict each (`SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`).
The class-surfaces here: `CLAUDE.md` (the pointer-ization — sweep the REST of CLAUDE.md for other
tier references that must stay consistent), `packages/core/templates/**`, `docs/**`,
`setup.d/**` (payload manifests), the plugin channel, the zcode twins. A Backward-check whose
surface list equals your own diff's file list is non-conformant by format.

**Also required: a `## Fidelity verdict` section.** `fidelity-verdict-in-pr-body` is a REQUIRED
staging check. **`FIDELITY: skipped` is NOT available to this PR** — it is a stage PR. It needs
a real GO block from a cold [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md)
run: `FIDELITY: GO` + `Basis:` + `Round:` + `Audited-SHA:` (must prefix the PR head SHA at merge
time) + ≥1 file:line evidence on a line other than `Basis:`. Exactly one such section, exactly
one `FIDELITY:` line — a rework round REPLACES the block, never appends.

**Pre-flight before `gh pr create`** (compose the body first, then check):

```bash
echo "$PR_BODY" | grep -cE '^### §1\.7 (Forward|Backward)-check applied'   # must be 2
echo "$PR_BODY" | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+'                  # must be >=2
```

## §9 Stop conditions

- A design decision would diverge from the binding spec → STOP and surface the divergence.
- F-A′ payload home needs a pick you cannot defer → park it; do NOT guess.
- A degradation-matrix row cannot be C3-validated → park the row; do NOT assert it.
- The CLAUDE.md pointer-ization lacks maintainer sign-off → the commit is staged but the PR waits.
- Local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
