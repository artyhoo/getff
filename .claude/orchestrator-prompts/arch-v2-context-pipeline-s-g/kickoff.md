<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: stage-scoped dispatch input — S-G of the arch-v2-context-pipeline umbrella (economy small-fixes 2, added by the 2026-08-06 decision-layer spec). Tier 1 — every item's «how» is one determinable sentence below; the judgment (keep-list, digest scope) is ALREADY ENCODED here by the /arch contour. Marker: re-verify uniqueness + the fidelity precondition at dispatch per the umbrella §0. -->

# arch-v2-context-pipeline S-G — economy small-fixes 2

> **Stage goal:** execute the cheap, fully-specified economy items of the decision-layer spec:
> the bounded `CLAUDE.md` trim + traps digest (D1/D1b), the re-write-trigger discipline embeds,
> the inlined-dispatch template default, the rule-index channel realign, and the ADR-template
> wiring. **Design SSOT (read in full):**
> [`2026-08-06-pipeline-token-economy-design.md`](../../../docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
> — §1 D1 row (trim bounds + D1b digest + rollback trigger), §3 rows P5-P8 + P12, §0.6
> (agnosticism). Umbrella context: [`../arch-v2-context-pipeline/kickoff.md`](../arch-v2-context-pipeline/kickoff.md).
>
> One PR, no scope beyond the six items below. A systemic issue noticed mid-stage is a PR-body
> observation, never an extra PR ([CLAUDE.md `PR strategy`](../../../CLAUDE.md)).

**Base:** `origin/staging`. **Mode:** implementation, one PR onto staging.

## §1 Items (each «how» is one sentence — Tier-1 by construction)

1. **P5a — `CLAUDE.md` core-dedupe:** replace the sections duplicating `AGENTS.md`/README
   (goal pointer, Step-0 reading order) with an `@AGENTS.md` import + one-line CC-specific
   preface; verify the import renders (fresh session shows AGENTS.md content); check ZCode
   honours `@`-imports — if not, DOCUMENT the degradation (zcode-parity), do not block.
2. **P5b — KEEP-LIST (binding, do NOT trim):** Task-tier routing (`CLAUDE.md:106` region),
   the marker-value rule (`:132` region), PR strategy, Operational conventions (harness
   gates), Umbrella closure, Pre-dispatch in-flight probe, Artifact Ownership Contract.
   These are judgment-bearing or sole-home sections — pointer-collapsing any of them is a
   REVISE at review.
3. **P5c — D1b traps digest:** author a resident hot digest of `ai-laziness-traps.md` §2
   (every T-number + its one-line counter, target ≈2k tokens); re-scope the full catalogue to
   `paths:` (rule/kickoff/research-patch authoring surfaces); ship a deterministic anti-drift
   test (every §2 T-number has a digest line); record the rollback trigger in the rule
   (`ONE senior-seat incident of a digest-under-carried trap → full residency restored`).
   `.claude/rules/*` edits travel as a maintainer-reviewed PR (Artifact Ownership Contract) —
   the PR IS the handoff.
4. **P6 — re-write-trigger discipline embeds:** add to the cold-seat-economy skill-embed
   blocks (`harvest/SKILL.md`, `dispatcher/SKILL.md`): prefer artifact handoff to a fresh seat
   over `/compact`; do not stretch a seat across the 1-hour TTL idle gap; avoid mid-session
   model/effort switches and MCP toggles on a fat context — each invalidates the cached
   prefix and re-bills it at write price (pending S-E P3d verification of the config-change
   class). Same handoff rule.
5. **P7 — inlined-dispatch template default:** make the inputs-inlined dispatch format the
   documented default in the dispatcher/harvest dispatch templates, with the promotion trigger
   quoted (3 incidents of >100k file-reading seats → mechanical check in S-B's station).
6. **P8 + P12:** fix the `Channel(s)` truth at its source (`scripts/probe-channels.sh` + rule
   frontmatter) then regen `npx tsx scripts/render-rule-index.mjs --write` (never hand-edit
   the generated index); wire the `engineering:architecture` ADR template as /arch §1's
   spec-format slot (thin-wrapper line in `arch/SKILL.md`, trio §A2 G1 cited).
   **Slot note:** any new principle test this stage ships takes slot **35**, PRE-ASSIGNED —
   do NOT re-derive «next free» (S-E concurrently takes **34**; highest existing is `33-`).

## §2 Permitted files

`CLAUDE.md`, `AGENTS.md` (only if the import needs an anchor tweak), `.claude/rules/*`
(maintainer-reviewed PR), `.claude/skills/harvest/SKILL.md`, `.claude/skills/dispatcher/SKILL.md`,
`.claude/skills/arch/SKILL.md`, `scripts/render-rule-index.mjs` inputs +
`.claude/rules/00-rule-index.md` (regen only), `packages/core/principles/*` (anti-drift test +
allowlist), `tests/install-sh/*` (snapshot regen if agent/rule fingerprints shift).

## §3 Acceptance

```bash host-verify
npx vitest run packages/core/principles
npx tsx scripts/render-rule-index.mjs --write
git diff --exit-code .claude/rules/00-rule-index.md
```

Plus review-time: keep-list sections byte-identical (git diff shows no hunk touching them);
`wc -c CLAUDE.md` before/after quoted in the PR body with the [A]-share arithmetic; the
anti-drift test fails when a digest line is deleted (mutation shown once in the PR body);
every trimmed section's new home is named.

## §3a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
defensible implementations, an undecided design choice, a missing spec detail that changes
behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
Y») and **stop that task.** Proceed only on the unambiguous parts.

Expected to fire here on: **(a)** P5a, if ZCode does not honour `@`-imports — the kickoff says
DOCUMENT the degradation and do not block, so that one is already decided; but if the import
does not render **on CC either**, that invalidates the trim's mechanism → park, do not
hand-inline the content as a workaround; **(b)** P5b, on any section where «is this the
keep-list or is this duplicative?» is genuinely arguable — the keep-list is binding and a
touched keep-list hunk is a REVISE (T-SG-A), so park the borderline section rather than
trimming it; **(c)** P5c, when a T-number's counter cannot be compressed without paraphrase —
the anti-drift test requires an exact prefix/quote, not a paraphrase (T-SG-B), so park rather
than loosen the test to fit the digest. Never manufacture a quoted fresh-session observation.

## §3b Parallel stage (S-E) — one shared surface

S-E runs **concurrently** on a disjoint scope (`packages/core/hooks/`, `.husky/pre-push`,
`scripts/*`, CI mirror); its own §2 lists `CLAUDE.md` and `.claude/rules/*` — this stage's
territory — as NOT permitted. The single overlap is `packages/core/principles/*`: S-E adds the
P2a liveness test + allowlist entry there. Work in an isolated worktree
([parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)); if S-E merges
first, resolve by **merging staging into this branch** — never `git rebase` a published branch
([git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md)).

## §4 AI-traps

See [`ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md) (cited per §3 of that rule).
**Active traps for this stage: T1, T3, T7, T15, T18, T20.** T1/T7 — the keep-list is checked
section-by-section, not pattern-matched from this kickoff's summary; T3 — the before/after
byte counts are command outputs, not estimates; T15 — the digest itself is discipline-bearing:
its PR carries the §1.7 self-check; T18 — trimmed prose with unique residue is RELOCATED
(pointer to its new home), never deleted; T20 — «import renders» is a quoted fresh-session
observation, not an assumption.
**T-SG-A — trim-past-the-keep-list:** the pointer-collapse momentum carrying into a keep-list
section because it «looks duplicative». Counter: §3's byte-identity check on keep-list
sections is the acceptance gate — a single touched keep-list hunk is a REVISE.
**T-SG-B — digest-drift-by-paraphrase:** digest lines paraphrasing counters until they no
longer match the catalogue. Counter: the anti-drift test asserts T-number presence AND the
counter line is an exact prefix/quote of the catalogue's counter, not a paraphrase.
