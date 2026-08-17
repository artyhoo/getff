# Kickoff — the ask file's authoring half

> **Type:** single-concern PR, one session. Not an umbrella, no stages.
> **Base branch:** `staging`. **Rigor label (L0):** `build-and-verify` — the surfaces are
> reversible prose edits with a live round-trip check available in the same session; no
> irreversible or consumer-data-shaped decision sits under this.
> **Origin:** handoff from the session that landed PR #1433 (advisor-pattern §8 items 6/6b),
> recorded there as Review-findings observation 1.

## §0 What already exists (read before deciding anything)

PR #1433 (squash `baf528950b`, on `staging`) landed the **validating** half of the ask file:

- [`scripts/check-ask-files.sh`](../../../scripts/check-ask-files.sh) — validates every `*.md`
  in `${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}/session-bus/asks/`.
  Its file header is the only prose statement of the schema that exists anywhere.
- [`scripts/check-ask-files.test.sh`](../../../scripts/check-ask-files.test.sh) — 16 detector
  arms + 3 arms driving the pre-push section through `PREPUSH_ONLY=ask-file-schema`.
- The pre-push section `ask-file-schema` in `packages/core/hooks/pre-push.ts` (delegating
  entry; the mailbox literal deliberately stays outside `packages/` per session-bus v2 §9
  claim 1).

Design source: [advisor-pattern-design §2 + §5.3 L3(b)(c)](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md).

## §1 The gap this kickoff closes

The schema has **no authoring half**. Verified at handoff time:
`grep -rln "asker-role|## Options considered" .claude/skills/ agents/ packages/core/templates/`
returns nothing. Meanwhile two surfaces instruct a session to file an ask without saying what
one looks like:

- [`.claude/skills/night-mode/SKILL.md:25`](../../skills/night-mode/SKILL.md) — «file an ask
  file + send `ASK` when the advisor is reachable».
- [`.claude/skills/dispatcher/SKILL.md:322`](../../skills/dispatcher/SKILL.md) — the intent-row
  Day/Night cells, same instruction.
- [`.claude/rules/reviewer-discipline.md:65`](../../rules/reviewer-discipline.md) — the
  materiality-dispute path: transcribe the verbatim dispute block «into an ask file». **This
  file is maintainer-owned and READ-ONLY for session agents** (CLAUDE.md Artifact Ownership
  Contract) — do not edit it; if it needs a pointer, surface that as an observation.

So the validator is currently the only description of the format: a one-sided pair of exactly
the kind this repo treats as a defect. The first real ask will be hand-written against nothing.

## §2 Task

Give the schema an authoring home, and point the ask-filing surfaces at it. **One PR.**

## §3 The fork to decide first (recommendation given, not binding)

**Where does the authoring statement live?**

- **A — inline the schema in each filing skill.** Rejected on sight: two-to-three copies of one
  format, the `#sync-by-copy-paste` shape (`.claude/rules/dual-implementation-discipline.md`).
- **B — one prose SSOT (a template file or doc) + pointers from the skills.** Works, but leaves
  two lists nobody reconciles: the template and the validator drift independently, and this
  repo has four gates built solely to close that class (principles 36/37/38 + the sweep
  metatest).
- **C — the validator EMITS the template (`check-ask-files.sh --print-template`), skills point
  at the command; a test asserts the emitted skeleton PASSES the validator.** Recommended.
  Single source by construction — the code that judges is the code that offers. Precedent in
  this repo: `scripts/run-local-ci-sweep.sh --list-gates`, added for exactly this reason (the
  coverage metatest reads the real gate table instead of scraping a copy).
  **Falsifier:** wrong if the realistic authoring flow is an agent hand-writing markdown into
  the mailbox and never shelling out — then the emitted skeleton is dead code and B is right.
  Decide by looking at how the filing seats actually write files before building.

Whichever you pick, the **round-trip assertion is not optional**: whatever the authoring half
offers must be run through `check-ask-files.sh` by a test, so «the example is valid» is a
mechanism rather than a claim.

## §4 Traps (per [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md))

Active: **T3**, **T5**, **T18**, **T19**, **T21**.

- **T3** — every done-claim carries a command and its output. «The skills now describe the
  format» is prose; `bash scripts/check-ask-files.test.sh` output is evidence.
- **T5** — this is an authoring-surface task, not a redesign of the schema. If the schema looks
  wrong while writing the docs, record it as a finding; do not quietly change field names —
  the validator, its 16 arms and the pre-push channel all move together if you do.
- **T18** — do not «tidy» the checker's header by deleting the schema block once a template
  exists. Verify first that every field is genuinely stated in the new home; the header is
  what the RED message points readers at.
- **T19** — run your own cold read of the diff before handing off. CI checks form here, not
  whether an author could actually produce a valid ask from what you wrote.
- **T21** — the backward sweep is delegated to a cold agent ONLY if this session is authorised
  to spawn one; otherwise enumerate by hand: every surface that instructs «file an ask»
  (§1 lists the three known ones — re-derive the list, do not trust it).

**Domain trap — T-ASK-A: «the format is settled because a checker exists».** The flat
frontmatter (`asker-role` / `asker-cwd`) was chosen so bash could parse it without a YAML
dependency, not because an author asked for it. If the authoring pass shows the shape is
awkward to write by hand, that is a real finding — record it with the concrete awkwardness,
and note that changing it means moving the validator, its arms, and this kickoff together.

## §5 Traps of the terrain (each cost time in the #1433 session)

- **PR-body `Prior-art:` must BEGIN a line.** `prior-art.ts:198` matches with
  `startsWith('Prior-art:')`; filling the template's checklist bullet does NOT satisfy the
  `squash-survival` gate. Dry-run all three PR-body gates before `gh pr create` —
  `pr-body-fidelity-bin.ts`, `pr-body-prior-art-bin.ts` (needs `BASE_SHA` **and** `HEAD_SHA`),
  and the §1.7 awk simulation.
- **Shipped-artifact snapshot.** `night-mode` and `dispatcher` ARE shipped skills
  (`setup.d/10-skills.sh:83`, `:88`). Before pushing, check whether the edited file appears in
  any fingerprint: `grep -rn "<file>" tests/install-sh/baselines/*`. If it does, recapture with
  `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` in the same PR (this is what
  `packages/core/hooks/pre-push.ts` needed in #1433).
- **Prettier does not gate `.claude/rules/**` and several rule files are dirty on `staging`.**
  Do not run `prettier --write` to «clean up» — it adds tens of lines of unrelated churn.
- **§1.7 sections are required** if the PR touches `.claude/rules/**` or
  `packages/core/principles/**`; both Forward and Backward need ≥40 non-whitespace chars AND
  ≥1 `file.ext:line` citation each.

## §6 Done criterion

1. An author with no context can produce a valid ask file from the authoring half alone —
   demonstrated, not asserted: the produced skeleton is fed to `check-ask-files.sh` by a test
   that fails if the two ever disagree.
2. Every surface that instructs «file an ask» points at that home (excluding the maintainer-
   owned rule file, which is surfaced as an observation instead).
3. `bash scripts/check-ask-files.test.sh` green; `make self-audit` green; CI green on the PR.
4. Whichever fork was taken in §3 is stated in the PR body **with the reason**, so the next
   reader is not left re-deriving it.

## §6.1 host-verify — acceptance runs on the HOST

A green run inside a container says nothing about the host checkout that accepts this work
([`destination-environment-verification.md §1`](../../rules/destination-environment-verification.md)).
Run these on the host before accepting, and paste their output into the PR body:

```bash host-verify
bash scripts/check-ask-files.test.sh
grep -rn "check-ask-files\|asker-role" .claude/skills/night-mode/SKILL.md .claude/skills/dispatcher/SKILL.md
grep -rn "asker-role" tests/ scripts/ | head
git status --short .claude/skills/ scripts/ tests/
make self-audit
```

The second command is the one that fails loudly if the PR edited a validator but never gave the
filing seats a pointer — the exact half-done state §1 exists to prevent.

## §7 Not in scope

- Changing the schema itself (see T-ASK-A).
- `.claude/rules/effort-worthiness.md:63-64`, which still labels L3 arms (b)(c)(d) as
  «(landing item)» though they shipped in #1433 — maintainer-owned; surface, do not edit.
- The L4 budget tripwire (spec §8 item 7) — the remaining unbuilt mechanical arm, its own task.
