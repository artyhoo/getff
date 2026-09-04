<!-- scope:live-generation -->
# LG-S2 — js/ts confirm-and-frame: the shipped ESLint-direct lane as the common-core reference adapter

> **Scope:** the `live-generation` umbrella LG-S2 (kickoff §2) — CONFIRM the shipped js/ts live rule-generation lane (#805) works end-to-end, and FRAME it as the reference per-stack adapter over the shared generation core. This stage IMPLEMENTS NOTHING (the js lane is already shipped); it confirms + frames + records the OWNER-FORK-2 resolution. NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Status:** LANDED on `claude/live-generation-s2-js-confirm` (off staging @ LG-S1 merge `b95e11c1`). Confirmation-only; no new pipeline, no `file-clients.ts`/`generate.ts` edit.
> **Method:** re-verified the shipped lane live on the LG-S1 base (`synthesizer/rule-bootstrap-live.test.ts` → 2/2 green; `file-clients.ts` present) — kickoff §0 T3 re-verify obligation. Every claim carries a file:line or command result.
> **Date:** 2026-07-13.

---

## §1 Confirmation — the js/ts lane works (shipped, re-verified)

The js/ts live rule-generation lane is SHIPPED on staging (#805, closed via #809) and green on the LG-S1 base:

- `packages/core/synthesizer/file-clients.ts` — `FileResearchClient` (validates via `validateResearchPlan`) + `FileGenerateClient` + the `withManualDrop` §MAJOR-1 backstop.
- `packages/core/synthesizer/rule-bootstrap-live.test.ts` — **2/2 green** (re-run 2026-07-13 on base `b95e11c1`): research → `GenerateSelection` → `generate.ts` → an ESLint L4-executable rule + firing test → `rules-lock.json`, $0-in-CI.
- The firing proof for js IS the **L4 executable roundtrip** (`validator/validate.ts` — fires on `examples.bad`, clean on `examples.good`, anti-vacuity), proven for the `no-head-element` demo (spec §10).

## §2 Framing — the common-core «works» contract, realized 2 of 3 stacks

The umbrella's «works» contract per stack = **research → executable rule + firing test → RED proof** (kickoff §1, research-patch [2026-07-11-live-generation.md](2026-07-11-live-generation.md) §Qe). It is now realized for two of the three render stacks:

| stack | adapter | «works» proof | routes through the neutral ConventionNode bridge? |
|---|---|---|---|
| **js/ts** | ESLint-direct (`file-clients.ts`→`generate.ts`, #805) — the REFERENCE adapter this umbrella generalizes (#183) | L4 executable roundtrip (`no-head-element` fires RED on `examples.bad`, clean on `examples.good`) | **No** — ESLint-direct, richer ESQuery plane (deliberate, §3) |
| **python** | ConventionNode bridge (`research-to-node.ts`→`renderAstgrep`, LG-S1) | `ast-grep scan` RED on a scratch consumer (`getff-researched-no-yaml-load`, exit 1 / clean exit 0) | **Yes** — the shared Plane-3 bridge |
| **rust** | LG-S3 (pending) — ConventionNode bridge → clippy | developer-machine `cargo clippy` RED + CI render/drift (CI-limited by design) | Yes (planned) |

Planes 1 (neutral IR + 4 render backends) and 2 (research/trust core) are shared by all three; Plane 3 (the `live-research→ConventionNode` bridge) is shared by python + rust, and diverges for js (which predates it and is richer). The js lane is the **reference realization** of the «works» contract — the shipped pattern (#183) the neutral bridge generalizes.

## §3 OWNER-FORK-2 resolution (recorded)

FORK-2 = «converge the shipped js ESLint-direct half onto the neutral ConventionNode bridge, or keep it as-is?».

- **Original R-phase recommendation (2026-07-11):** keep as-is (converging risks the `to-node.test.ts` byte-locks with no user-facing gain).
- **OWNER DECISION (2026-07-13):** **converge js onto the common bridge — LATER, not in this umbrella.** Rationale (dissolves the byte-lock objection): do it as **add-alongside + differential-test**, NOT rip-replace. Route the same researched js practice through BOTH (a) the shipped ESLint-direct path (`file-clients.ts`→`generate.ts`, kept as a trusted **oracle**) and (b) the shared bridge (`research-to-node.ts` → `backends/npm/from-node.ts`, both already exist) → compare outputs. A match validates the shared conveyor against a stack we already trust (oracle/differential test — the strongest validation of the shared core). #805 is NOT removed; it becomes a permanent regression oracle. Cheap/reuse-heavy: the bridge (LG-S1) + `to-node.ts`/`from-node.ts` already exist; the new work is a thin js authoring adapter + the diff harness.
- **Slotting:** a firm recorded FOLLOW-ON — its own small stage or umbrella AFTER the 3-stack core (LG-S1..S4) lands. NOT dispatched here; LG-S2 stays confirm-and-frame per the kickoff.

## §4 §1.7 self-review

- **Forward-check:** complies with [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) (this stage BUILDS nothing — it confirms + frames the shipped #805 lane, REUSE-verbatim; the future convergence is scoped as add-alongside reuse of the existing bridge + `from-node.ts`, not a rewrite); [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (the js lane's L4 firing proof is $0-in-CI, `rule-bootstrap-live.test.ts:1`); [doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) (this patch carries the scope annotation + folder-authority header, claims authority for nothing beyond the LG-S2 framing).
- **Backward-check:** class of this change = **frame an already-shipped per-stack adapter + record an owner fork resolution** (no code). Sibling surfaces where the class would apply: the OTHER two stacks' «works» proofs — python (LG-S1, already landed with its own RED proof — SWEPT-CLEAN, `packages/core/backends/astgrep/live-generation-delivery.test.ts`) and rust (LG-S3, pending — this patch does NOT claim rust is done, it is listed «pending» in §2). Supersedes nothing: the js lane (#805) is untouched (`git diff` shows no `file-clients.ts`/`generate.ts` change — confirmation-only); the R-phase patch is not rewritten; FORK-2's «keep as-is» recommendation is superseded by the recorded OWNER decision (§3), not silently. Self-application (T15): the framing re-verified the js lane empirically (2/2 green) rather than asserting it from memory.

## §5 See also

- [2026-07-11-live-generation.md](2026-07-11-live-generation.md) §1 (stale-brief correction — js is shipped, not to-implement), §Qf (LG-S2 = confirm-and-frame), §Forks-2.
- [.claude/orchestrator-prompts/live-generation/kickoff.md](../../../.claude/orchestrator-prompts/live-generation/kickoff.md) §2 (LG-S2 scope), §1 (the «works» contract).
- `packages/core/synthesizer/file-clients.ts` + `rule-bootstrap-live.test.ts` — the shipped js reference adapter (#805/#183).
- [2026-07-13-lg-s1-expressibility-census.md](2026-07-13-lg-s1-expressibility-census.md) — the LG-S1 sibling (python), OWNER-FORK-1 data.
