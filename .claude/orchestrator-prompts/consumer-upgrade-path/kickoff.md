# consumer-upgrade-path — refresh shipped artefacts on already-installed consumers (GH #551 follow-up)

- **Type:** feature. Design R-phase DONE (2026-06-17, merged #607); now **ready for implementation** — see Decided design below. Medium, clobber-risk surface.
- **Opened:** 2026-06-17.
- **Base:** staging.
- **Tracks:** GH #551 (residual) + the systemic gap surfaced in its re-verify comment. Child of the #550 umbrella.

## Why (concrete, verified)

The original #551 defect — shipped `agents/*.md` declaring non–Claude-Code tool names — is **already fixed at source** (`81a0251`, on staging) and guarded by `packages/core/principles/21-shipped-agent-tools-valid.test.ts` (green). **That part is done.**

The residual, systemic gap: a consumer that installed **before** a fix never receives it. Concrete case from the #551 re-verify comment — `timeliner` installed 2026-06-11; the agents fix landed 2026-06-16; the consumer still runs the broken pre-fix `.claude/agents/*.md`. There is **no safe refresh path**:

- `install.sh` default `copy_safe` is **skip-if-exists** ([install.sh:187](../../../install.sh)) — never updates an existing file.
- `install.sh --force` overwrites **wholesale** ([install.sh:187,224](../../../install.sh)) — it also clobbers consumer-owned customisations (their CI workflow, `.prettierrc`, RULES.md edits, the `.ai-factory/` passport).

So the gap is **not agent-specific** — it bites *every* shipped artefact (hooks, rules, skills, templates, agents): fix any of them upstream and installed consumers are stranded between "never update" and "clobber everything".

## Goal / acceptance

A consumer can refresh **framework-owned** shipped artefacts to the current version **without** clobbering consumer-owned files. Acceptance:

1. A documented, idempotent refresh path (flag, subcommand, or helper) that updates framework-owned artefacts in place.
2. Consumer-owned / consumer-customisable files (per the three-layer authority model + `<file>.override.md` escape hatch, see [INSTALL-FOR-AI.md](../../../INSTALL-FOR-AI.md)) are **preserved** — proven by a test that customises a file, runs refresh, asserts the customisation survives AND the framework-owned artefact updated.
3. Paired-negative: a stale framework-owned artefact (e.g. an `agents/*.md` with old tool names) is actually refreshed by the path → its new content present after.

## Decided design (maintainer, 2026-06-17 — design forks resolved)

The design R-phase ([research-patch `2026-06-17-consumer-upgrade-path.md`](../../../docs/meta-factory/research-patches/2026-06-17-consumer-upgrade-path.md), merged #607) surfaced two forks; the maintainer resolved both, **both matching the R-phase recommendation**:

1. **Refresh mechanism → ADAPT, no new dependency.** Reuse `copy_safe` + the `merge_prettierignore` marker-block pattern (`install.sh:207-249`); add a per-file "framework-owned ⇒ overwrite, consumer-owned / `.override.md` ⇒ keep" classifier. Do **NOT** adopt `copier`/`cruft` (Python dep, rejected per SSOT #22/#124/#125 + agnostic-core); do **NOT** build a bespoke 3-way merger (`#parallel-evolution-creep`).
2. **Version awareness → stateless v1.** "Re-copy the framework-owned set, skip any file with a sibling `.override.md`, leave everything else." No shipped-hash stamp / state file. Mitigate Layer-2-edit loss via opt-in + `--dry-run`-first and the "diverge via `.override.md`, not in-place edit" doc rule.

**The active implementation plan is [research-patch §5](../../../docs/meta-factory/research-patches/2026-06-17-consumer-upgrade-path.md) (T1 refresh entrypoint · T2 boundary classifier · T3 paired acceptance tests · T4 docs · T15 dogfood)** — conditioned on exactly this Option-A / Option-A choice, so it stands as-is. The next `/pipeline consumer-upgrade-path` decomposes T1-T4 into sub-waves (SDD applies — ≥3 tasks).

The framework-owned-vs-consumer-owned **boundary** is derived from existing signals (`SHIPPED_DOCS` + three-layer authority model + `.override.md` presence), never a hand-maintained allowlist — see [research-patch §4](../../../docs/meta-factory/research-patches/2026-06-17-consumer-upgrade-path.md).

## Prior-art consult (mandatory before any "I propose…", per build-first-reuse-default §3)

> **✓ DONE by the R-phase** — sweep recorded in [research-patch §2](../../../docs/meta-factory/research-patches/2026-06-17-consumer-upgrade-path.md), SSOT #124/#125 landed (#607). DeepWiki was unreachable in the aif container → WebSearch ×3 + SSOT #22 substituted (verdict provisional on that channel; a maintainer DeepWiki re-run is optional, not blocking). The note below is retained for history.

- DeepWiki `ask_question` ≥3 phrasings + WebSearch ≥3 phrasings on the problem class: "idempotent scaffold upgrade / re-sync vendored files without clobbering user edits" (e.g. `create-react-app eject`/`npx … upgrade`, `cookiecutter`/`cruft` drift-update, `yeoman` conflict resolver, `copier update`). Record verdicts in [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md). `copier update` (3-way merge of templated projects) is a strong candidate to evaluate (ADOPT/ADAPT/REFERENCE).
- Consult SSOT for existing install/refresh entries before adding.

## §6 AI-traps (ai-laziness-traps §3 obligations)

See [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). Active traps for this feature: **T2, T3, T11, T12, T15, T16**.

- **T11 / T12** — this is a solved problem class upstream (template-sync tools); do NOT design a bespoke merger without the prior-art sweep above.
- **T16** — do not assume `install.sh --force` or any named tool "already does upgrade" without verifying it preserves consumer files (it does not).
- **T2** — designing the classifier ≠ shipping it; acceptance requires the paired customise-survives / stale-refreshed tests actually run green.
- **T3** — every "consumer X is broken / preserved" claim needs file:line or command output.
- **T15** — self-application: dogfood the refresh on this repo's own shipped surface (or explain why N/A).
- **T-Upgrade-A** (domain-specific) — when building the framework-owned allowlist, the AI is tempted to mark a file "framework-owned, safe to overwrite" by *guessing* rather than verifying it is never consumer-customised. A wrong classification silently clobbers consumer work (irreversible). Counter: derive the boundary from an existing authoritative signal (three-layer model / `.override.md` / SHIPPED_DOCS), and for each file in the overwrite set state the evidence it is framework-owned.

## Out of scope

- The original #551 agents fix (done) and its guardrail (done).
- #547 Point 1 (passport generation) — separate kickoff (`aif-init-passport-gen`).
- Auto-running refresh on every install — refresh is an explicit, opt-in consumer action.

## Dispatch note

Per [kickoff-staging-placement.md](../../../.claude/rules/kickoff-staging-placement.md): this kickoff must be on `staging` before `/pipeline consumer-upgrade-path` or an aif dispatch is initiated.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
