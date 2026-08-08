<!-- scope: stage kickoff — beta-ai-docs-agnosticism S3 (self-generating docs sweep, spec C5). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-ai-docs-agnosticism-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker). DISPATCH CHANNEL: maintainer-paste tab (operator decision 2026-08-08: fork-heavy D7 ownership judgments — aif's two prior design-heavy stages came back FIDELITY STOP #1300 / PARTIAL #1284), in a Mode-B worktree parallel to S2. -->

# beta-ai-docs-agnosticism S3 — self-generating docs sweep (C5)

> **Type:** execution-build, single PR onto `staging`. **Branch: `beta-c-s3-selfgen-docs`**
> (the meta-launch Stage-2 → Stage-3 gate greps this exact head name — meta-launch
> `kickoff.md` §3 — a different branch name silently fails the gate).
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §6 **C5** is the design SSOT (plus §2 **D7** with its ownership carve-out — the
> load-bearing constraint of this stage — and §8 for the auditor). On any divergence
> between this kickoff and the spec, **the spec wins** — surface it, never improvise.
> **Umbrella context (read-only):** [`kickoff.md`](kickoff.md) §2 row S3 +
> [`../beta-ai-docs-agnosticism-meta-launch/kickoff.md`](../beta-ai-docs-agnosticism-meta-launch/kickoff.md) §4 Stage 2.
> **Parallel sibling:** S2 (`beta-c-s2-skills-probe`) runs concurrently in its own
> worktree (aif-dispatched). File-ownership split in §5 — respect it; on merge-order
> conflict, merge-forward per [git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md).
> **Base branch:** `staging`. Work in a worktree: `bash scripts/create-worktree.sh beta-c-s3`
> ([parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)).

```bash host-verify
npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts
npx vitest run packages/core/principles/21-agnosticism-conformance.test.ts
bash tests/agnosticism/run-audit.sh
```

> Run by explicit path — `bash scripts/host-verify.sh .claude/orchestrator-prompts/beta-ai-docs-agnosticism/kickoff-s3.md`
> (the bare `<umbrella>` form resolves to the umbrella `kickoff.md`, not this file).
> **Every drift/regen check this stage creates gets its runner line added to the block
> above in the same commit that creates it** — a migrated section whose drift check is not
> in the acceptance contract is T-BAD-A by construction. Principle 21 is in the block
> because the new `agents/claims-conformance-auditor.md` must pass its
> harness-universal-tools arm.

## §0 Goal

Derivable prose in OUR OWN docs stops being hand-maintained: every doc section whose
content is a function of a mechanical source (git/PR facts, filesystem rosters, probe
output) either becomes a `getff:begin` generated section with a drift gate, or is
explicitly recorded as prose-with-an-owner-and-trigger. The D7 ownership carve-out governs
throughout: maintainer-owned files and `.claude/rules/*` are NEVER auto-rewritten — they
get patch-proposal PRs flagged for sign-off. The stage also authors
`agents/claims-conformance-auditor.md`, the named cold auditor the spec §8 assembly gate
runs over docs-site claims.

## §1 Do this FIRST — entry re-verification (both directions)

Facts measured at authoring (2026-08-08, staging `c421f8e0de`). Snapshots — re-verify at
entry, act on what you find.

| # | Fact measured at authoring | Evidence | What to re-check |
|---|---|---|---|
| 1 | **The umbrella-kickoff premise «zcode-doctrine §3 sync is the first proposal» has PARTIALLY DISSOLVED** — the §3 hand-sync already landed | `.claude/rules/zcode-parity-doctrine.md:68` now reads «Status column reflects runtime reality for all Wave B stages (5/6/7B/9C merged via #1043/#1044/#1046/#1047)»; landed via PR #1156 (2026-07-25, truth-sweep) — AFTER the spec (2026-07-23) | what REMAINS of that premise: (a) the D3 renderer sync still «deliberately parked» (`zcode-parity-doctrine.md:68` names `scripts/render-harness-config.mjs:256-268`); (b) the spec's «preferably as a D7 generated section rather than another hand edit» (`spec:367-368`) — #1156 was exactly «another hand edit», so the D7 conversion is still due. The first patch proposal is therefore the **generated-section conversion of the doctrine's §2/§3 status columns** (render precedent: `00-rule-index.md`), not a content re-sync. Re-read `:64-79` at entry |
| 2 | `getff:begin` fence machinery + render precedent exist | `packages/core/composition/fence.ts`; `scripts/render-rule-index.mjs` (the `00-rule-index.md` maintainer-landed precedent, named by `spec:174-175`); live fences in root `AGENTS.md` | none — REUSE these; building a second fence engine is `#parallel-evolution-creep` |
| 3 | `agents/claims-conformance-auditor.md` does NOT exist; 18 sibling agents do | `ls agents/` — no hit; shape precedents: `fidelity-auditor.md`, `backward-sweep-auditor.md` | if it appeared since (S1 overreach, another session) → consume, don't duplicate |
| 4 | principle 21 gates every shipped `agents/*.md` to harness-universal tools | `21-agnosticism-conformance.test.ts:278-281` (probers exempt via skip-loop `:330`) | the new auditor must pass it — check the current universal-tool set before writing its `tools:` line |
| 5 | S1 may have migrated an INSTALL-FOR-AI roster already (its D3 allowed it if the drift check shipped along) | S1 kickoff §2 D3 | read S1's merged diff at entry; inventory rows it already converted are `DONE-BY-S1`, not re-migrated |
| 6 | S2 (`beta-c-s2-skills-probe`) is the live parallel sibling, aif-dispatched | meta-launch §2 launch-table | its allowlist (probes + skill declaration lines + night-mode) is off-limits here (§5) |

Also re-run the pre-dispatch in-flight probe (`gh pr list --state open`, `git branch -a
--list '*beta-c-s3*'`) — at authoring, zero in-flight work on this stage's surfaces.

## §2 Deliverables

### D1 — Population inventory FIRST (T10 — binding order)

Enumerate **ALL** derivable-prose classes across the repo's own docs BEFORE migrating
anything. The spec names the classes (`spec:376-379`): status tables ← git/PR facts;
skill/agent/hook rosters ← filesystem; coverage matrices ← probe output. The inventory is a
committed artefact (research-patch or PR-body table — your call, stated) where **every row
carries**: source-of-truth, current-home file:line, ownership class (free / maintainer-owned
/ `.claude/rules/*`), verdict (`MIGRATE-now` / `PROPOSE-to-owner` / `STAYS-PROSE` with
owner+trigger / `DONE-BY-S1` / `OWNED-BY-S2`), and evidence. A migration performed on a row
the inventory does not carry is out of order — the inventory is the population enumeration
that makes every later claim meaningful.

### D2 — Migrations (free-ownership rows only)

For each `MIGRATE-now` row: convert to a `getff:begin` generated section (REUSE
`fence.ts` + the `render-rule-index.mjs` renderer pattern — one renderer per source class,
not per section) **and ship its drift gate in the same commit** (seeded-break: change the
source, show the check go red, regenerate, green). A migrated section without its gate is
T-BAD-A — a new lying doc with extra steps. Each new gate's runner line joins the
`host-verify` block in the same commit.

### D3 — Patch proposals (owner-gated rows)

For `PROPOSE-to-owner` rows (maintainer-owned files, `.claude/rules/*`): the deliverable is
a **flagged proposal, never a direct edit**. First proposal (per §1 row 1's corrected
premise): the D7 generated-section conversion of zcode-parity-doctrine §2/§3 status
columns, following the `00-rule-index.md` maintainer-landed-plan precedent — the proposal
ships the renderer + the plan; the maintainer lands the rule-file change. Proposal form:
separate commit(s), PR-body flag «for maintainer sign-off», per the CLAUDE.md Artifact
Ownership Contract. The parked D3 renderer sync (`render-harness-config.mjs:256-268`)
stays parked unless the maintainer's sign-off explicitly includes it — note it, don't
absorb it.

### D4 — `agents/claims-conformance-auditor.md` (spec §8 assembly-gate cold auditor)

The named cold auditor that verdicts docs-site claims against shipped reality (`spec:381-382`
+ §8 assembly gate row). Shape: follow `fidelity-auditor.md` / `backward-sweep-auditor.md`
precedents — cold dispatch (never sees the authoring narrative), structured
GO/GAP-per-claim output, harness-universal `tools:` line (principle 21, §1 row 4), no paid
LLM ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) — session-read, never CI).
Its first live target arrives with umbrella B; acceptance here is the auditor passing
principle 21 + a dry-run over ONE existing claim surface (e.g. README's install claims)
with the output pasted.

## §3 Out of scope (do NOT do these here)

- The skills census probe, night-mode/`/arch`/glm-handoff declarations, and ANY edit to
  `.claude/skills/night-mode/SKILL.md` → **S2** (single owner).
- `context7.json` / re-index Action / DeepWiki → **S4**.
- Direct edits to README.md, CLAUDE.md, PROPOSAL.md (frozen), `.claude/session-bootstrap.md`,
  any `.claude/rules/*` file → **D7 carve-out: proposals only** (§2 D3).
- Consumer-payload doc generation beyond what S1 landed → the consumer side of D7 is A/C1
  territory; this stage is the **repo side** (`spec:376`).
- Renaming anything (R1 name freeze, spec §7).
- Editing `~/.claude/**` or adding npm deps.

## §4 «Works» — acceptance (command + output quoted in the PR body)

1. **Inventory completeness check (T10/T4):** the population table exists, every row has
   all five fields, and the adversarial counter-prompt was RUN and quoted («what derivable
   class did I miss?» — rephrase once if it surfaces nothing, T7).
2. **Every migrated section: regen check green AND seeded-break red demonstrated** —
   command + output for both directions, per section.
3. **`host-verify` block green on the host** — including every runner line added by D2.
4. **Owner-gated rows: zero direct edits** — `git diff --name-only` against the D7
   carve-out list is empty for maintainer-owned + `.claude/rules/*` paths, EXCEPT
   proposal-plan artefacts (renderers, plans) that live outside those paths. Quote the diff
   file list.
5. **The auditor passes principle 21** (pasted) and its dry-run output over one claim
   surface is pasted.
6. **Prose-that-stays is recorded, not silent:** every `STAYS-PROSE` row carries owner +
   review trigger (spec D7 falsifier line).
7. **D8 hygiene stated:** generated sections add nothing to always-on context; renderers
   write no consumer-AI memory.

## §5 File ownership vs the S2 sibling (binding — `#shared-workdir-parallel` guard)

Permitted files, this stage: the inventory artefact, renderer scripts under `scripts/`,
drift-gate tests, `getff:begin` sections in **free-ownership** docs (INSTALL-FOR-AI.md
rosters, coverage matrices, AGENTS.md non-fenced derivables — re-read S1's diff first, §1
row 5), `agents/claims-conformance-auditor.md`, proposal artefacts for owner-gated files.

S2 owns: `tests/agnosticism/probes/*`, principle 21's file (or its new sibling),
`.claude/skills/*/SKILL.md` declaration lines, and `night-mode/SKILL.md` exclusively. If a
migration row's home is a SKILL.md — the row is `OWNED-BY-S2` in the inventory; hand it
over via the PR body, do not edit.

Recording a fired PARK is not a file write (meta-launch §4c park-record contract): it lands
in the park payload + the PR's `## Parked questions`, and its correction lands as a
separate owner commit — this allowlist deliberately names no park-record artefact.

## §6 Park-don't-guess contract (BINDING)

> **Fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (stated as «Option A → consequence X /
> Option B → consequence Y») and **stop that thread.** Proceed only on the unambiguous
> parts. Guessing a fork to «keep moving» is the failure this loop exists to prevent.

Known fork-prone spots — park rather than guess: whether a borderline row is derivable or
judgment-bearing (the D7 falsifier: «a doc class proves non-derivable → it stays prose with
an owner and a review trigger» — when in doubt, STAYS-PROSE + park the question); the
inventory artefact's home (research-patch vs PR body) only if it changes review mechanics;
the zcode-doctrine proposal's scope if the maintainer sign-off path is ambiguous; any row
whose ownership class you cannot determine from the Artifact Ownership Contract table
(park the ROW, proceed with the rest); a renderer that would need to touch
`packages/core/**` beyond composition REUSE (capability-commit surface → Prior-art trailer
+ park if the verdict is unclear).

Technical forks strictly inside these bounds (renderer naming, section marker ids, table
shape) are yours — resolve them and record why in the PR body.

## §7 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T2, T3, T5, T7, T10, T14, T15, T17, T19, T20, T21.**

- **T2** — a renderer that «would» keep a section fresh is not a deliverable; the ran
  regen + seeded red are.
- **T3** — every inventory verdict carries file:line + the line's actual content.
- **T5** — the inventory phase is research: while enumerating, do NOT start migrating;
  finish D1, then execute D2 against it.
- **T7** — the §4 item 1 counter-prompt is written and RUN, not ticked.
- **T10** — the DEFINING trap of this stage: enumeration BEFORE migration, in that order,
  with the inventory as the committed evidence.
- **T14** — «all inventoried rows handled» is only meaningful with the population stated;
  low-coverage inventory → say «coverage insufficient», don't claim the sweep complete.
- **T15 (mandatory)** — self-application: this stage's own artefacts (the inventory, the
  auditor) are docs — they carry doc-authority headers, and the inventory lists ITSELF if
  it contains derivable rows.
- **T17** — migrations DELETE hand-written prose; before replacing a section, preserve any
  judgment-bearing residue (move it outside the fence or into the owning doc) — the
  renderer will not save it for you.
- **T19** — own adversarial cold-QA before handoff; CI checks form, not whether the
  inventory is honest.
- **T20** — every verdict carries evidence.
- **T21** — the Backward-check enumerates sibling surfaces (§8), not your diff.

**Inherited domain traps (umbrella §4 + meta-launch §5):**

- **T-BAD-A** — «the generated section works because the generator ran once». Countered
  structurally by §2 D2 (gate in the same commit) + §4 item 2 (both directions shown).
- **T-BAD-C** — a generated section that INLINES another doc's SSOT content (e.g. tier
  criteria) is still a fork of it; generation does not launder ownership. Point, don't copy.

**New domain trap (this stage):**

- **T-BADC-S3-A — «ownership laundering via renderer».** The tempting move: «the rule file
  is maintainer-owned, but my RENDERER writing into it is automation, not me editing». No —
  a generated section inside `.claude/rules/*` exists only via a maintainer-landed plan
  (the `00-rule-index.md` precedent, `spec:172-176`); the session ships the proposal, the
  maintainer lands the wiring. Falsifier: `git diff` of this stage's PR touches
  `.claude/rules/*` → the carve-out was breached, regardless of who «technically» wrote
  the bytes.

## §8 PR-body requirements (REQUIRED checks on `staging`)

This stage touches `agents/**` (+ possibly `packages/core/**` renderers) → **the §1.7
mandate is ON** (H3 depth, «applied», ≥40 non-whitespace chars each, ≥1 `path.ext:N`
citation each — meta-launch §4b has the verbatim shape + pre-flight greps; run them before
`gh pr create`).

**T21 — the Backward-check is where this stage fails if rushed** (meta-launch §4b calls
this out for S3 by name). Class of this change = *generated-section machinery over
hand-maintained docs*. Sibling surfaces to enumerate and verdict — at minimum: the existing
`00-rule-index.md` render pipeline (`scripts/render-rule-index.mjs` — does your renderer
duplicate or extend it), the S1-landed fence helper + its `AGENTS.md` sections, the
`packages/core/composition/fence.ts` contract (unbroken), the consumer-payload templates
S1/A own (NOT migrated here — verdict the boundary), and `docs/meta-factory/
wave-sequencing-plan.md` §0 (a status table ← git facts: in the inventory or explicitly
STAYS-PROSE). Delegate to [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md),
handing it the change class only.

**`## Provenance` — fill it** (marks this a stage PR; `FIDELITY: skipped` becomes
mechanically unavailable — `pr-body-fidelity.ts:44,147-152`). **`## Fidelity verdict` —
required:** a real GO block from a cold [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md)
run (`FIDELITY: GO` + `Basis:` + `Round:` + `Audited-SHA:` prefixing the PR head at merge
time + ≥1 file:line evidence). Exactly one section, one `FIDELITY:` line; rework rounds
REPLACE the block. **Proposal commits for owner-gated files are flagged «for maintainer
sign-off» in the PR body** — the merge does not land them into the owned files; the
maintainer does.

## §9 Stop conditions

- A design decision would diverge from spec C5/D7 → STOP and surface.
- You are about to edit README.md / CLAUDE.md / PROPOSAL.md / `.claude/session-bootstrap.md`
  / any `.claude/rules/*` file directly → STOP — proposal only (§2 D3, T-BADC-S3-A).
- You are about to edit an S2-owned file (§5) → STOP; mark the row `OWNED-BY-S2`.
- A migration's drift gate cannot be made to go red → the gate does not discriminate;
  STOP, redesign — do not ship the migration without it.
- The inventory would exceed the session's depth honestly → park the tail rows as
  `INCONCLUSIVE` with the population count stated (T14), never silently truncate.
- An INSTALL-FOR-AI edit would push it past the 600-line pre-commit gate → reconcile in
  place, do not append.
- The local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.
