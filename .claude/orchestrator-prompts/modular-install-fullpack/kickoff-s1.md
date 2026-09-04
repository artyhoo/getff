# Stage S1 kickoff — `mif-s1-lib-and-layers`

> **Umbrella:** `modular-install-fullpack` (see [`kickoff.md`](kickoff.md)). **Stage:** S1 of S0→S5.
> **Authoritative for:** S1 task — extract `setup.d/lib.sh`, cut existing install.sh steps into numbered layers, thin dispatcher; byte-identical invariant.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md). New layers `05-mcp`/`15-companions-stack` content — those are S2/S3.

## §1 Stage goal

Turn the monolithic `install.sh` (~1585 lines) into `setup.d/`-modules under a thin dispatcher, **behaviour byte-identical**. No new layers' content yet — only extract `lib.sh` + cut the *existing* steps into numbered layer files + make `install.sh` a dispatcher.

## §2 Input — DEFINED BY S0 (predecessor)

**Read first:** [`kickoff-s0.md`](kickoff-s0.md) — the S0 boundary table (`install.sh` step → target layer + layer dependencies). S1 implements exactly that mapping. If `kickoff-s0.md` is missing or its coverage statement says install.sh was not fully walked → **STOP, do not guess the cut** (S0 gate, see §stage-gate).

## §3 Deliverables

1. `setup.d/lib.sh` — extract the helper cluster (`copy_safe`, `refresh_safe`, `mkdir_safe`, `chmod_safe`, `detect_pm`, `transform_internal_refs`, `merge_prettierignore`, … per S0 table) with a **rebuilt lib-only guard** that `return`s *after* the helpers are defined (current guard at `install.sh:64` returns before `copy_safe` (`install.sh:201`) / `mkdir_safe` (`:380`) / `chmod_safe` (`:389`) are defined — fix so they are unit-testable). `lib.sh` is the helper SSOT (`dual-implementation-discipline.md §7` — one logic, no copy-paste).
2. Numbered layer files `setup.d/NN-*.sh` per the S0 cut (existing layers only: `10-skills` `20-agents` `30-templates` `40-configs` `50-hooks` `60-ci` `70-deps`; `05-mcp`/`15-companions-stack` are stubs/placeholders only, filled in S2/S3). Each `source`s `lib.sh`. Numeric-prefix registry, lexicographic order (bash 3.2 — NO `declare -A`).
3. Thin `install.sh` dispatcher — ordered source of `setup.d/[0-9]*.sh`; stack-picker, preflight, flag-parsing stay in the entry.
4. Per-layer unit tests (source each `setup.d/NN-*.sh` with lib-only guard) + **byte-identical snapshot proof** (greenfield + brownfield install before/after the cut = identical).
5. **`setup.d/LAYERS.md`** — a named registry artifact S2/S3/S4 read as their input spec (review-finding M1, tightens defined-by-predecessor): the layer list (number · file · purpose · depends-on) + the `lib.sh` public API surface (helper names + signatures) + which layers are stubs awaiting S2/S3. This is the concrete predecessor-output successors consume, parallel to how S1 consumes `kickoff-s0.md`.

## §4 Acceptance

- `bash install.sh <stack>` and `./setup` produce **byte-identical** filesystem output vs pre-S1 (greenfield AND brownfield snapshot diff = empty).
- `--dry-run` → exit 0, plan printed, disk unchanged.
- `shellcheck setup.d/*.sh install.sh` clean (pin version).
- Each layer unit-testable in isolation via lib-only guard.

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract (LIVE)

> Operator posture: **technical-auto + strategic-to-operator** (2026-06-24). aif resolves technical forks autonomously; genuine design forks below are parked to the operator.

**Lever 1 — conservative aif config (review-finding I3: these are aif-container-side knobs — set them in the aif-handoff environment BEFORE its container starts, not via `export` in the dispatch shell, which won't propagate over REST. Only `AGENT_AUTO_REVIEW_STRATEGY` is repo-referenced; treat the others as aif-side config and verify they're honoured in your aif setup):**

```bash
export AGENT_MAX_REVIEW_ITERATIONS=1
export AGENT_AUTO_REVIEW_STRATEGY=closure_first
export AGENT_SKIP_REVIEW=false
```

**Lever 2 — park-don't-guess (addressed to the aif agent, verbatim):**

> **aif agent — fork discipline (non-negotiable):** PROCEED autonomously on the deterministic, byte-identical extraction defined by `kickoff-s0.md` (helper extraction, layer cutting, dispatcher wiring, snapshot proof). PARK as a question (`manualReviewRequired`, fork stated «Option A → consequence X / Option B → consequence Y», then STOP that task) on these genuine forks — they have no determinate best answer on the project's merits: **(1) test framework** — keep self-written `*.test.sh` + shellcheck/OS-matrix vs migrate to bats/bashunit; **(2) dispatcher style** — directory-glob loop (convention) vs explicit ordered call-list (visible deps); **(3) rollback depth** — full per-layer undo-stack (trap ERR + LIFO) vs «copy_safe skip-if-exists + dry-run is enough». Guessing any of these «to keep moving» is the failure this contract prevents. If the byte-identical snapshot is NOT identical after a cut — STOP and park (do not «fix forward» by changing behaviour).

**Lever 3** — operator Approves / Requests-changes each completed task; aif's autonomous decisions are reviewed too, not only open questions.

**Egress gate (mandatory after `status=done`):**

```bash
npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```

## §stage-gate (before dispatching S1)

S1 depends on S0. Verify S0 landed (boundary table exists + on staging):

```bash
test -f .claude/orchestrator-prompts/modular-install-fullpack/kickoff-s0.md && \
  git ls-tree -r origin/staging --name-only | grep -q 'modular-install-fullpack/kickoff-s0.md' \
  && echo "S0 GATE OPEN" || echo "S0 GATE CLOSED — do not dispatch S1"
```

## §5 AI-traps active (per `ai-laziness-traps.md §3`)

See [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md). **Active: T2, T3, T5, T15, T19, T20.**

- **T2** — designing the cut ≠ doing it byte-identically. The snapshot diff is the falsifier, not «looks equivalent».
- **T3** — every «step X → layer Y» move cites the S0 table row + the real install.sh line range.
- **T5** — S1 is refactor-only: NO behaviour changes, NO drive-by fixes; spotted bugs → observation for a later stage.
- **T15** — self-application: the modularization must itself prove byte-identical (the invariant the project preaches), not assert it.
- **T19** — own cold-QA of the diff before handoff (CI-green ≠ byte-identical proven).

**Domain-specific:**
- **T-MIF-B** — «модуляризация байт-в-байт» заявлена, не доказана. Counter: greenfield+brownfield snapshot before/after = identical, per cut.

```bash host-verify
# Retro-marked 2026-08-21: §4 acceptance — byte-identical snapshots + shellcheck clean
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
shellcheck setup.d/*.sh install.sh
```
