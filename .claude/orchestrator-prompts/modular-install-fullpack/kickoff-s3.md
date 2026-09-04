# Stage S3 kickoff — `mif-s3-revive-toolbootstrap` (NARROWED per decision A)

> **Umbrella:** `modular-install-fullpack` (see [`kickoff.md`](kickoff.md)). **Stage:** S3 of S0→S5. Parallel-with: S2.
> **Authoritative for:** S3 task — revive the tool-bootstrap layer (seed state file, revive deps-hash loop, fix the broken context7 contract); `15-companions-stack` = manifest-driven companions with a stack column, **WITHOUT AIF stack→tools mapping**.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md). AIF-engine viability / stack-aware mapping — **GATED by R1, out of this stage** (umbrella §9).

## §0 ⚠️ HARD GATE — R1

The stack-aware tool→stack MAPPING (the original S3 ambition) is **DEFERRED to R1 (AIF-viability), outside this umbrella** (umbrella §9; evidence: FQA-B 2026-06-11 P1 — the engine is unverified, `/aif`/`skills.sh` not shipped). **S3 must NOT build any `/aif`/`npx skills` stack→tools mapping.** S3 is narrowed to reviving our own thin layer + a static (non-AIF) stack column. If the work seems to require the mapping → STOP and park: R1 is its precondition.

## §1 Stage goal

Make the `tool-bootstrapping` machinery actually live on the install path (it is currently dead-on-arrival per FQA-B P1), and fill `15-companions-stack` with a **static, manifest-driven** stack column — no engine, no AIF mapping.

## §2 Input — DEFINED BY S1 (predecessor) + FQA-B evidence

**Read first:** S1's named output [`setup.d/LAYERS.md`](../../../setup.d/LAYERS.md) (layer registry + `lib.sh` API) + the `15-companions-stack` stub; and [`docs/meta-factory/research-patches/2026-06-11-fqa-b-tool-bootstrapping.md`](../../../docs/meta-factory/research-patches/2026-06-11-fqa-b-tool-bootstrapping.md) (the exact P1/P3 defects to fix). Also `skills/tool-bootstrapping/SKILL.md` (the frozen broken contract) + `packages/core/hooks/deps-hash-check.sh` (the detector that short-circuits). If `LAYERS.md` or the `15-companions-stack` stub is absent → **STOP** (S1 gate not met).

## §3 Deliverables

1. **Seed `.ai-factory/tool-decisions.md` on the live install path** (FQA-B P1 fix): `install.sh` (now a layer) writes the state file from the shipped template with the deps-hash stamped, so `deps-hash-check.sh` no longer short-circuits at line 20. The deps-change re-eval loop becomes reachable on a fresh install.
2. **Fix the broken context7 contract in `SKILL.md`** (FQA-B P3): **pure removal** of the dead «context7-via-setup.sh recursive-bootstrap» contract + stale companion refs is deterministic — proceed. Only a *behaviour-changing rewrite* (replacing it with a new contract) is a parked fork (§4c). (`SKILL.md` is frozen-class — even pure removal carries the doc-authority note per `doc-authority-hierarchy.md §4` `#frozen-doc-still-edited`.)
3. **`15-companions-stack` — static stack column:** add a stack column to `companions.manifest` (e.g. which companions/plugins are relevant per detected stack), consumed by the existing `engine.sh` loop with a simple `package.json`-signal match. **No `/aif`, no `npx skills`, no live registry call** — a static table only (the dynamic engine is R1).

## §4 Acceptance

- **Empirical (T-MIF-A):** after `./setup` on a clean consumer, the deps-hash loop fires on a simulated deps change (seed present → `deps-hash-check.sh` emits the WARN, not silent exit). Probe verbatim, per FQA-B Probe-1.
- `SKILL.md` no longer references the broken context7-via-setup.sh contract; doc-authority header intact.
- `15-companions-stack` selects companions from the static stack column on ≥1 real stack signal, with NO network/registry/`/aif` call (grep the layer for `aif`/`npx skills` → empty).

## §4c Autonomous aif-handoff dispatch — park-don't-guess contract (LIVE)

> Operator posture: **technical-auto + strategic-to-operator** (2026-06-24).

**Lever 1 — conservative aif config (review-finding I3: these are aif-container-side knobs — set them in the aif-handoff environment BEFORE its container starts, not via `export` in the dispatch shell, which won't propagate over REST. Only `AGENT_AUTO_REVIEW_STRATEGY` is repo-referenced; treat the others as aif-side config and verify they're honoured in your aif setup):**

```bash
export AGENT_MAX_REVIEW_ITERATIONS=1
export AGENT_AUTO_REVIEW_STRATEGY=closure_first
export AGENT_SKIP_REVIEW=false
```

**Lever 2 — park-don't-guess (addressed to the aif agent, verbatim):**

> **aif agent — fork discipline (non-negotiable):** PROCEED autonomously on the deterministic FQA-B fixes (seed the state file, repair the deps-hash loop, **pure removal** of the dead SKILL context7 contract, static stack column). **HARD STOP / PARK** if anything pulls toward `/aif`+`npx skills` stack→tools MAPPING — that is R1, gated, out of scope (§0). **L1 fork (propose-only vs opt-in auto-install) — do NOT re-park here:** SHARED fork resolved ONCE per umbrella §3.2; follow it, do not decide independently. PARK (`manualReviewRequired`, «Option A → X / Option B → Y», STOP that task) on: **(1)** a *behaviour-changing rewrite* of the frozen `SKILL.md` (pure removal proceeds; only replacing the contract with new behaviour parks); **(2)** the static stack-column schema if more than one defensible shape exists. Guessing the engine «to be helpful» is the exact T-MIF-A failure.

**Lever 3** — operator reviews aif's autonomous decisions, not only open questions.

**Egress gate (mandatory after `status=done`):**

```bash
npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```

## §stage-gate (before dispatching S3)

S3 depends on S1 (parallel with S2):

```bash
gh pr list --search "is:merged head:mif-s1-lib-and-layers base:staging" \
  --json number,mergedAt --limit 5 2>/dev/null | grep -q mergedAt \
  && echo "S1 GATE OPEN" || echo "S1 GATE CLOSED — do not dispatch S3"
```

## §5 AI-traps active (per `ai-laziness-traps.md §3`)

See [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md). **Active: T3, T11, T13, T15, T16, T19, T20.**

- **T13/T16 (load-bearing here)** — the tool-bootstrap chain was «adopted» but dead (FQA-B P1). Do NOT assume any AIF capability transfers; the engine is unverified (R1). Confirm each fix empirically.
- **T3** — cite FQA-B line/probe + the actual `deps-hash-check.sh` line that short-circuits; verify the seeded file makes the WARN fire.
- **T5/T19** — fix only the named defects; own cold-QA on a clean repo before handoff.

**Domain-specific:**
- **T-MIF-A (this stage's reason to exist)** — «tool-bootstrap адоптирован → работает» — FALSE (FQA-B). Counter: empirical loop-fires probe.
- **T-MIF-R1-creep** — tempted to «just wire `/aif` since we're here». Counter: §0 hard gate — that work is R1, park it.

```bash host-verify
# Retro-marked 2026-08-21: §4 acceptance keeps the installed surface byte-identical (empirical consumer probes stay in §4; the snapshot compare is the repo-runnable guard)
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```
