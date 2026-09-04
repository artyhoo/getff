<!-- scope: stage kickoff — beta-ai-docs-agnosticism S2 (skills agnosticism probe, spec C3). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-ai-docs-agnosticism-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker). DISPATCH CHANNEL: autonomous aif-handoff (Lever-1 verified 2026-08-08 on BOTH services — api stamps the task row per api/schemas.ts:79, agent reads the fallback per autoReviewHandler.ts:125: AGENT_MAX_REVIEW_ITERATIONS=4, GET /settings agrees) — §6 park contract is LIVE, not decorative. Ceiling = 4 fix-and-re-review rounds before handoff; per-task maxReviewIterations overrides. -->

# beta-ai-docs-agnosticism S2 — skills agnosticism probe (C3)

> **Type:** execution-build, single PR onto `staging`. **Branch: `beta-c-s2-skills-probe`**
> (the meta-launch Stage-2 → Stage-3 gate greps this exact head name — meta-launch
> `kickoff.md` §3 — a different branch name silently fails the gate).
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §6 **C3** is the design SSOT (plus §2 **D8**; C2 cross-cutting applies to every artefact).
> On any divergence between this kickoff and the spec, **the spec wins** — surface it,
> never improvise past a binding decision.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) §2 row S2 +
> [`../beta-ai-docs-agnosticism-meta-launch/kickoff.md`](../beta-ai-docs-agnosticism-meta-launch/kickoff.md) §4 Stage 2.
> **Parallel sibling:** S3 (`beta-c-s3-selfgen-docs`) runs concurrently in its own
> worktree. File-ownership split in §5 — respect it; on merge-order conflict,
> merge-forward per [git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md).
> **Base branch:** `staging`.

```bash host-verify
bash tests/agnosticism/run-audit.sh
npx vitest run packages/core/principles/21-agnosticism-conformance.test.ts
bash tests/agnosticism/harness-self.test.sh
```

> Run by explicit path — `bash scripts/host-verify.sh .claude/orchestrator-prompts/beta-ai-docs-agnosticism/kickoff-s2.md`
> (the bare `<umbrella>` form resolves to the umbrella `kickoff.md`, not this file). **Every
> test this stage creates gets its runner line added to the block above in the same commit
> that creates the test** — the seeded-break paired-negative for the new probe (§4) is
> acceptance-deciding. This stage runs in the aif container; the block is re-run **on the
> host at harvest acceptance** ([destination-environment-verification.md §1](../../rules/destination-environment-verification.md))
> — a green container run is not evidence about the host.

## §0 Goal

The agnosticism claim finally covers `.claude/skills` — today it does not: no probe
enumerates the skills surface, so «pipeline/dispatcher are portable by test» coexists with
13 sibling skills whose harness posture is asserted in prose or not at all. This stage
ships (a) a skills-surface census probe with a seeded-break paired-negative, (b) night-mode's
conformance treatment (its own SKILL.md admits *designed-not-proven*), (c) explicit
degradation declarations for `/arch` and the GLM executor handoff. Everything under D8:
the probe adds zero always-on context; declarations live in the skills' own cold bodies.

## §1 Do this FIRST — entry re-verification (both directions)

Facts measured at authoring (2026-08-08, staging `c421f8e0de`). Every one is a snapshot —
re-verify at entry and **act on what you find, in both directions**.

| # | Fact measured at authoring | Evidence | What to re-check |
|---|---|---|---|
| 1 | **NO probe enumerates `.claude/skills`** — the C3 negative claim holds | `grep -rn '.claude/skills' tests/agnosticism/` → exactly ONE hit: `channel-coverage.sh:41`, a SURFACES array *entry* (channel coverage), not a skills census; probes population = 7 files (`ls tests/agnosticism/probes/`) | re-run the grep; if a census probe appeared since, STOP and surface — the stage premise dissolved |
| 2 | Skills population = **14 dirs** under `.claude/skills/` | `ls .claude/skills/ \| wc -l` → 14 | re-count; the probe must enumerate dynamically, never hard-code 14 (§4 falsifier) |
| 3 | principle 21 walks `agents/*.md` only | `21-agnosticism-conformance.test.ts:262-273` (`AGENTS_DIR`) | confirm no sibling test grew a skills arm since |
| 4 | night-mode's portability paragraph self-declares **designed-not-proven** | `.claude/skills/night-mode/SKILL.md:17` («treat portability as _designed-not-proven_ until a live probe … night-mode has no such conformance test yet») | the exact line moves; re-locate by grepping `designed-not-proven` |
| 5 | `/arch` + glm-handoff exist, neither declares degradations mechanically | `.claude/skills/arch/SKILL.md`, `.claude/skills/claude-glm-executor-handoff/SKILL.md` (its §5 carries a *designed-not-proven* honest-gaps marker) | read both §-structures at entry before deciding declaration placement |
| 6 | S3 (`beta-c-s3-selfgen-docs`) is the live parallel sibling | meta-launch §2 launch-table | if S3 already merged, read its diff before touching any doc it migrated |

Also re-run the pre-dispatch in-flight probe (`gh pr list --state open`, `git branch -a
--list '*beta-c-s2*'`) — at authoring there was zero in-flight work on this stage's surfaces.

## §2 Deliverables

### D1 — Skills-surface census probe (the C3 core)

A new probe that **dynamically enumerates** `.claude/skills/*/SKILL.md` and verdicts each
skill's harness posture. **Channel selection is the stage's FIRST decision**
([rule-enforcement-channel-selection.md](../../rules/rule-enforcement-channel-selection.md)),
not an afterthought. The spec's shape (`spec:362-365`): «a skills-surface census probe
joins principle 21's dynamic enumeration» — i.e. BOTH halves:

- a bash probe under `tests/agnosticism/probes/` (joins `run-audit.sh`'s glob loop
  automatically — `run-audit.sh:15` runs `probes/*.sh`), emitting rows into the
  conformance record like its 7 siblings;
- the vitest arm: widen principle 21 (or add a numbered sibling — the channel decision)
  so CI enforces the census, not just the session-run audit.

**What a row verdicts** (design judgment, but bounded): does the skill declare its harness
posture — portable / CC-native-with-fallback / CC-only-with-rationale — in a form the probe
can read mechanically? A skill with **no** readable declaration is the probe's RED, exactly
like an agent with a non-universal tool is principle 21's RED today. Pick ONE mechanical
declaration form (frontmatter key, marker comment — your call), document it in the probe
header, and apply it to all 14. Where a skill needs a declaration it lacks, **adding the
declaration line to that SKILL.md is in scope** — rewriting the skill is not.

### D2 — Night-mode conformance treatment

Night-mode graduates from *designed-not-proven* prose to the same conformance treatment
`pipeline`/`dispatcher` have: its declaration becomes probe-readable, and what is genuinely
unproven (the end-to-end non-CC run, `SKILL.md:17`) stays declared unproven — the probe
verdicts the DECLARATION's presence and shape, it does not fake a live cross-harness run
(T-BAD-B). **This stage is the single owner of `.claude/skills/night-mode/SKILL.md`** (§5).

### D3 — `/arch` + glm-handoff explicit degradation declarations

Both skills get the same probe-readable declaration: what degrades on a harness without
subagents / without the aif bridge / without GLM (`spec:365-366`). glm-handoff's §5
honest-gaps marker stays — a degradation declaration and an honest-gaps marker are
different claims; do not merge them.

## §3 Out of scope (do NOT do these here)

- zcode-parity-doctrine §3/§4 refresh and ALL `getff:begin` doc migrations → **S3** (its
  kickoff carries the corrected premise; the file is maintainer-owned — patch proposals only).
- Any edit to `.claude/skills/night-mode/SKILL.md` beyond D2, or to docs S3's inventory
  covers (INSTALL-FOR-AI, README, rosters) → **S3 / S1**.
- `context7.json` / re-index Action → **S4**.
- Rewriting skill bodies (only declaration lines + probe machinery are in scope).
- Direct edits to maintainer-owned files or `.claude/rules/*` → spec D7: STOP.
- Editing `~/.claude/**` (agent-uncommittable) or adding npm deps.

## §4 «Works» — acceptance (command + output quoted in the PR body; prose does not count)

1. **`bash tests/agnosticism/run-audit.sh` green with the new probe rows present** — paste
   the record: the skills surface appears with **all 14** (or current count) rows, each with
   a verdict. Baseline at authoring: 33 rows / 7 surfaces, all PORTABLE.
2. **The probe was RUN over the real population, findings reported** (T2 — designing ≠
   auditing). If any skill is RED at first run, the fix (declaration line) lands in this PR
   and the after-run is pasted too.
3. **Seeded-break paired-negative** (harness-self pattern, umbrella §2 gate): break one
   declaration (or remove one), show the probe go RED, revert, show green. A probe with no
   demonstrated red is unfalsifiable. Ship it as a committed test, not a narrated episode —
   its runner line joins the `host-verify` block in the same commit.
4. **Vitest arm green over the widened population** — `npx vitest run` of principle 21 (or
   the new sibling) pasted.
5. **Dynamic enumeration falsifier:** add-a-skill thought experiment stated in the PR — a
   15th skill dir with no declaration must be RED on the next run with **zero** probe edits.
   Hard-coded lists or counts fail this by construction.
6. **Coverage honesty (T14):** the verdict line names what the probe covers (declaration
   presence/shape) and what it cannot (live cross-harness execution) — «14/14 declarations
   green» is not «14 skills proven portable»; say both halves.
7. **D8 hygiene stated:** the probe and declarations add nothing to always-on context;
   nothing writes to consumer AI memory.

## §5 File ownership vs the S3 sibling (binding — `#shared-workdir-parallel` guard)

Permitted files, this stage: `tests/agnosticism/probes/*` (new probe), `tests/agnosticism/`
harness glue if needed, `packages/core/principles/21-*` (or the new numbered sibling),
`.claude/skills/*/SKILL.md` **declaration lines only** — with `night-mode/SKILL.md`
exclusively S2's, and `pipeline`/`dispatcher`/`harvest` bodies untouched unless a
declaration line is genuinely absent.

S3 owns: all `getff:begin` doc migrations, INSTALL-FOR-AI/README rosters,
`agents/claims-conformance-auditor.md`, patch proposals for maintainer-owned files. If your
work seems to require editing an S3-owned file, that is a fork → **park** (§6), do not race
the sibling.

Recording a fired PARK is not a file write (meta-launch §4c park-record contract): it lands
in the park payload + the PR's `## Parked questions`, and its correction lands as a separate
owner commit — this allowlist deliberately names no park-record artefact.

## §6 Park-don't-guess contract (BINDING — this stage runs autonomously in aif)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to
> `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
> consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the
> unambiguous parts. Guessing a fork to «keep moving» is the failure this whole loop exists
> to prevent.

Known fork-prone spots — park rather than guess: the declaration form (frontmatter key vs
marker comment) **if** existing skill frontmatter conventions conflict with your first
choice; widen-principle-21 vs new-numbered-sibling **if** widening would break the existing
test's contract for consumers; any skill whose honest posture you cannot determine from its
body (park that ROW as `INCONCLUSIVE-needs-human`, don't guess a verdict); anything
touching an S3-owned file (§5).

Technical forks strictly inside these bounds (probe filename, row format, helper placement)
are yours — resolve them and record why in the PR body.

**Egress (the orchestrator's obligation, recorded here so the loop is closed):** after
`status=done` → `npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging`,
then the host-side `host-verify` run before acceptance. Skipping harvest is
`#autonomous-done-no-harvest`.

## §7 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T2, T3, T7, T10, T14, T15, T16, T19, T20.**

- **T2** — designing the probe is not the deliverable; the RUN over 14 real skills is.
- **T3** — every «green»/«red» claim is a pasted command + output.
- **T7** — §4 is a live-fire list, not checkboxes.
- **T10** — the population is enumerated (dynamically, by the probe itself) before any
  verdict; a sampled subset is not a census.
- **T14** — declaration-coverage ≠ portability-proof; report both halves (§4 item 6).
- **T15 (mandatory)** — self-application: the probe class this stage ships judges OUR
  skills first, including the skills that built it (`pipeline`, `night-mode`).
- **T16** — principle 21's agents-pattern is ADOPTED as the shape. State explicitly:
  upstream problem class = «agents declare tools mechanically»; ours = «skills declare
  harness posture mechanically». Match is structural, not automatic — the declaration form
  must be designed for skills, not copy-pasted from agent `tools:` parsing.
- **T19** — own adversarial cold-QA of the diff before handoff (in-container review
  converging is NOT host acceptance — PR #1300 precedent).
- **T20** — every verdict carries file:line or command output.

**Inherited domain traps (umbrella §4 + meta-launch §5):**

- **T-BAD-B** — «agnostic because the probe passes on the harness we run». THE trap of this
  stage: the probe validates declarations, not cross-harness execution. Name what ran where;
  mark the rest `INCONCLUSIVE-needs-human`.
- **T-BAD-C** — declarations point at owning docs (tier-home, dual-implementation), never
  restate their matrices inline.

**New domain trap (this stage):**

- **T-BADC-S2-A — «census that freezes the population».** A probe that hard-codes the skill
  list (or its count) goes green forever while new skills ship undeclared — a lying probe is
  worse than no probe. Counter: dynamic `ls`/glob enumeration + the §4 item 5 falsifier
  stated in the PR body.

## §8 PR-body requirements (REQUIRED checks on `staging`)

This stage touches `packages/core/principles/**` and `.claude/skills/**` → **the §1.7
mandate is ON** (H3 depth, the word «applied», ≥40 non-whitespace chars each, ≥1
`path.ext:N` citation each — meta-launch §4b has the verbatim shape + pre-flight greps; run
them before `gh pr create`).

**T21 — Backward-check sweeps siblings, not the diff.** Class of this change = *conformance
probes over an artefact-class population*. Sibling surfaces to enumerate and verdict — at
minimum: the 7 existing probes (does the new one duplicate/overlap any), principle 21's
agents arm (contract unbroken), `packages/core/principles/15-skill-paired-negative.test.ts`
(the sibling that already walks skills for a different property), the shipped consumer
skills under `packages/core/templates/shared/skill-context/`, and night-mode's SDD
subordination (`SKILL.md:15` — the declaration must not re-describe SDD's loop). Delegate to
[`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md), handing it
the change class only.

**`## Provenance` — fill it** (marks this a stage PR; makes `FIDELITY: skipped`
mechanically unavailable — `pr-body-fidelity.ts:44,147-152`). **`## Fidelity verdict` —
required:** a real GO block from a cold [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md)
run (`FIDELITY: GO` + `Basis:` + `Round:` + `Audited-SHA:` prefixing the PR head at merge
time + ≥1 file:line evidence). Exactly one section, one `FIDELITY:` line; rework rounds
REPLACE the block.

## §9 Stop conditions

- A design decision would diverge from spec C3/D8 → STOP and surface.
- The §1 row-1 grep shows a skills census probe already exists → STOP; premise dissolved.
- You are about to edit an S3-owned file (§5) → STOP; park.
- You are about to edit a maintainer-owned file or `.claude/rules/*` → STOP (spec D7).
- Widening principle 21 would break its existing agents-arm contract → STOP; park the
  channel fork (new sibling vs widen) with consequences stated.
- The paired-negative cannot be made to go red → the probe does not discriminate; STOP,
  redesign — do not ship an unfalsifiable probe.
- The local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.
