# KICKOFF — handoff-currency-gate

> **Type:** single-stage implementation umbrella, one PR to `staging`.
> **Design SSOT — read it first and do not re-derive it:**
> [docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md](../../../docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md).
> It carries the decision register (D14-D36), the verified line numbers, the file inventory and
> the testing seams. Its parent is
> [2026-09-08-dynamic-context-window-design.md](../../../docs/superpowers/specs/2026-09-08-dynamic-context-window-design.md)
> (§Final disposition D13 commissioned this work); the parent owns the prior-art pass and the
> bounded-compaction pair — do NOT redo either.
> **Design status:** REVIEWED — two cold seats, one round, all findings disposed of in the spec's
> §Changelog. The design is settled; this stage implements it and does not re-open it.
> **Rigor label (effort-worthiness L0):** `research-grade` — the edited Stop hook is
> consumer-shipped (`plugin/hooks/end-of-turn-reminder` twin + `install.sh` delivery), so a
> regression reaches every consumer project. The gate itself ships dormant (D18).
> **Base branch:** staging. Per
> [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md) this kickoff is
> merged to `staging` before dispatch.
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** the consult is DONE and its row is pre-drafted in
> the spec's §SSOT row — append it verbatim as `#271` in the same commit as the hook change, and
> cite `Prior-art: prior-art-evaluations.md#271 (…)` in that commit's trailer. Do not re-run the
> search; do not invent a different row.
> **Tier / dispatch:** Tier 2, dispatched WITHOUT a `bridge-profile` marker (spec D27) — top tier
> plans and reviews, executor tier implements. Deliberate: the operator's premise puts
> verification on the top tier. This kickoff must NOT carry `<!-- bridge: auto -->`.

## §0 Read first, in order

1. [README.md#why-this-exists](../../../README.md#why-this-exists) → [.claude/session-bootstrap.md](../../session-bootstrap.md) → [CLAUDE.md](../../../CLAUDE.md).
2. The design SSOT above, in full. Every «why» question this stage raises is answered there.
3. [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — the T-numbers named in §4.
4. [.claude/rules/attention-is-not-a-mechanism.md](../../rules/attention-is-not-a-mechanism.md) and [.claude/rules/dual-implementation-discipline.md §3](../../rules/dual-implementation-discipline.md) — the two rules this change is judged against.

## §1 What to build

The spec's §File inventory is the work list. In dependency order:

1. `.claude/hooks/lib/residue-dir.sh` — the residue-dir cascade, extracted from
   `precompact-residue.sh:130-154`. Both hooks load it behind the loud-SKIP guard shape at
   `check-doc-authority.sh:40-48`, each keeping an inline fallback (spec D29). An unconditional
   `. "$lib"` is a defect, not a style choice — `set -euo pipefail` at
   `end-of-turn-reminder.sh:9` turns a missing lib into a Stop hook that fails on every turn.
2. `.claude/hooks/end-of-turn-reminder.sh` — the two-position arm (spec D30), nested inside
   `if [ -n "$ctx_entry" ]` at `:288` (spec D31), state machine per D19, floor per D14, payload
   checks per D16 + D32.
3. `.claude/hooks/precompact-residue.sh` — the pointer line (D15) and the baseline clear by
   EXACT name (D34).
4. `.claude/hooks/inject-handoff-on-compact.sh` + its registration in
   `.ai-factory/harness-model.json`, rendered with `node scripts/render-harness-config.mjs --write`
   (D20). Do NOT hand-edit `.claude/settings.json` — it is a rendered artifact and the drift test
   will go red.
5. `install.sh` + `setup.d/10-skills.sh` — add `lib/residue-dir.sh` to the by-name copy lists.
6. `lang/en.sh` + `lang/ru.sh`, `/pipeline` SKILL.md §1 glob, the zcode-parity row, SSOT `#271`.
7. The tests: 14 fixtures in `end-of-turn-reminder.test.ts`, 2 arms in
   `precompact-residue.test.ts`, the new `inject-handoff-on-compact.test.ts`.

**Fixture 9 first.** Snapshot the CURRENT hook's output on every fixture BEFORE touching the
hook; that snapshot is the only guard proving the unarmed path is byte-identical.

## §2 Scope lock

- **Do not hand-edit `.claude/settings.json`** — its deny-list (`:56-57`) closes the `Edit`/`Write`
  channel. Land it ONLY as the renderer's output, in the same commit as the `.ai-factory/harness-model.json`
  edit, exactly as PR #1443 did: an SSOT-only commit goes `harness-config-drift` RED. The operator's
  hand-action is the `env` arming (D18), not the render. Deliver that hand-action as ONE paste-able
  idempotent script modelled on `scripts/register-precompact-hook.sh` (122 LOC precedent):
  backup, `jq -e .` validate a temp file, atomic `mv`, skip if already present.
- **Do not re-open the design.** A decision you disagree with goes in the report's observations
  with its evidence; it does not become a different implementation.
- **One concern per PR.** The `ctx_line` prose at `end-of-turn-reminder.sh:350` bypassing the
  lang packs is a known, recorded observation — do not fix it here.
- **Do not add the injector to `plugin/hooks/`** (spec D20): consumers receive no residue writer,
  and the plugin `SessionStart` slot is occupied by the bootstrap hook.

## §3 Host-verify contract

```bash host-verify
shellcheck .claude/hooks/end-of-turn-reminder.sh .claude/hooks/precompact-residue.sh .claude/hooks/inject-handoff-on-compact.sh .claude/hooks/lib/residue-dir.sh
bash .claude/hooks/lang/check-parity.sh
node scripts/render-harness-config.mjs --check
npx vitest run --root packages/core hooks/ --no-file-parallelism
bash scripts/run-local-ci-sweep.sh
```

The live-verification arms (spec D26) are the harvesting session's obligation, not this stage's:
the gate cannot be exercised for real until the operator applies the hand-action.

## §3a Park-don't-guess contract (non-negotiable)

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with
the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.**
Proceed only on the unambiguous parts.

Expected to fire here on: (a) a D-row that cannot be implemented as written against the real file —
the spec's anchors were re-verified at dispatch time against a 702-line
`end-of-turn-reminder.sh` (`:288` = `if [ -n "$ctx_entry" ]`, `:414` = the `text=` assignment,
emit sites at `:134`, `:476`, `:694`); if what you find diverges, park with the divergence quoted
and do NOT re-derive the design; (b) the operator hand-action script's registration payload, whose
constraints §2 fixes (backup, `jq -e .` validate, atomic `mv`, skip-if-present) but whose exact
content it does not; (c) `render-harness-config.mjs --check` being unable to express the injector's
registration without a schema change (D20). Per `T-HCG-A`, never manufacture a quoted command
output for anything you did not actually run.

## §4 AI laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).

**Active traps for this stage: T2, T3, T5, T14, T15, T19, T20, T21.**

- **T2** — «the arm would block» is not a test. Every fixture must be run and its output quoted.
- **T3** — no prose findings in the report; command output or `file:line` with the line's content.
- **T5** — the design is settled; an implementation-time «improvement» to a D-row is an
  observation, not an edit.
- **T14** — a green suite with fixtures that never reach the bottom emit site is «coverage
  insufficient», not «the gate works». Fixture 11 exists because exactly that shape survived a
  cold review once already.
- **T15** — this change is itself an enforcement mechanism; the PR body's §1.7 must apply the
  rules it ships under.
- **T19** — run your own cold review of the diff before handoff; CI checks form, not the
  three-emit-site question.
- **T20** — no verdict in the report without a tool call in the same turn.
- **T21** — the backward sweep is the OTHER hooks that read or write the residue directory and
  the tmp flags, not a recap of this diff.

**Domain-specific trap — `T-HCG-A` «verify the hook by reading it».** The failure mode this stage
is most exposed to is asserting the arm's behaviour from the source rather than from a spawned
run. Both structural defects the cold seats caught were invisible to a careful read of the design
and obvious the moment the real file's control flow was traced. Countermeasure: every claim about
what the hook emits comes from `spawnSync` output pasted into the report, never from reasoning
over the script. The existing tests already spawn the hook — extend that, do not narrate.

**Domain-specific trap — `T-HCG-B` «the paired negative that cannot fail».** Fixture 9 asserts
unarmed output is unchanged, and it is tempting to write it after the edit, against the edited
hook — which makes it assert that the hook equals itself. It must be captured from the
pre-change hook (`git stash`-free: read the file from `git show HEAD:<path>` into a temp copy and
spawn THAT) or it proves nothing.

## §5 Report

Per the standard worker report format, plus: the observed output of all 14 fixtures, the exact
hand-action script handed to the operator, and any D-row you believe is wrong, with evidence.
