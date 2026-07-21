# live-generation — DONE

- Final PR: #<fill at PR creation>
- Closed: <fill at merge>
- Summary: WORKING live rule-generation across three render stacks (js/ts · rust · python) as three thin per-stack adapters over one shared generation core. LG-S1 (#1005) built the neutral `live-research→ConventionNode` bridge + the python adapter; LG-S2 (#1006) confirmed-and-framed the shipped js/ts ESLint-direct adapter (#805/#852); LG-S3 (#1010) added the rust clippy adapter (local live-fire RED + CI render/drift). LG-S4 (this PR) closes the umbrella: a third `EcosystemAdapter` (`packages/core/research/ecosystem-python.ts`, `pipAdapter`) deriving python Tier-1 doc-source trust from `pyproject.toml` (PEP 621/508 + Poetry) + a root-local venv's `.dist-info/METADATA` (`Name:`-field match, realpath-contained, fail-closed), UNWIRED like the cargo adapter, with an `ecosystem-unwired-debt.test.ts` tripwire (strict `unwired === BASELINE`, BASELINE=2) making the wiring debt mechanically visible; `'pip'` added to `KNOWN_ECOSYSTEM_PREFIXES`; INSTALL-FOR-AI.md venv-convention note; SSOT #223 (ADAPT #197/#188 onto pyproject/dist-info).

## Stage status

| Stage | PR | State |
|---|---|---|
| LG-S1 (python adapter + shared bridge) | #1005 | merged |
| LG-S2 (js/ts confirm-and-frame) | #1006 | merged |
| LG-S3 (rust clippy adapter) | #1010 | merged |
| LG-S4 (python ecosystem adapter + tripwire + closure) | this PR | ready |

## Gap log (the anti-forget record)

- **(a) Wiring gap.** Both the cargo (`ecosystem-cargo.ts`) and python (`ecosystem-python.ts`) `EcosystemAdapter`s are UNWIRED — no production caller threads them into a `ResolveCtx`. The LG bridges are Tier-0-only (`packages/core/synthesizer/research-to-node.ts` `firstProvenanceRejection`; `research-to-clippy-node.ts` duplicate); `detectStack` is JS-only (`detector/types.ts` `Stack = 'react-next' | 'ts-server' | 'unknown'`, `readManifest` reads only `package.json`). Wiring BOTH adapters (python + cargo together) is a **future umbrella** — the `ecosystem-unwired-debt.test.ts` tripwire (BASELINE=2) fails RED if a future PR wires one without decrementing BASELINE, or ships a third unwired adapter. Owner decision 2026-07-17: wire both later, not piecemeal.
- **(b) Staleness gap.** Per-manifest deps-hash staleness warning across all three stacks was **MOVED OUT of LG-S4** into its own `deps-hash-multistack` umbrella (#1016 kickoff, #1017 scope pointer). **SCOPE DEVIATION from kickoff §2** (which placed staleness IN LG-S4), recorded owner decision 2026-07-17: the existing `deps-hash-check.sh` is Node-requiring + hardcoded to `package.json`; a python/rust consumer has no Node at install-time (Model A), so staleness for those stacks needs a bash-only `.toml`-parsing hook — a distinct piece of work. NOT re-implemented in LG-S4.
- **(c) Coverage gaps (`ecosystem-python.ts` §4.1 fail-closed drops, documented — NOT invariant violations).** Multi-line arrays (`dependencies = [\n …\n]`) and multi-line inline tables are not parsed (single-line only); quoted-key Poetry deps (`"odd-pkg" = "^1.0"`) are not matched; legacy setuptools parenthesized (`package (>=1.0)`) and URL `name @ https://…` PEP 508 forms are dropped. Each is a fail-closed drop (Tier-0/Tier-2 still apply), never a wrong guess.
- **(d) Minor gap — venv spelling.** Only `<root>/.venv/` and `<root>/venv/` are searched for a root-local venv; the `env/` spelling is not covered (recorded minor gap; system python → Tier-0 fallback, no regression).

## Scope-deviation record

- Kickoff §2 placed per-manifest deps-hash staleness IN LG-S4 and gated `ecosystem-python.ts` behind "ONLY if a consumer needs a non-Tier-0 python source". The authoritative **spec** (`docs/superpowers/specs/2026-07-17-lg-s4-python-ecosystem-adapter-design.md`, 4-iteration reviewed) records the owner decision (2026-07-17) that LIFTS the adapter gate (build now, wire later) and MOVES staleness OUT (§7 SCOPE DEVIATION). LG-S4 followed the spec.

## Build notes (for the record — not LG-S4 defects)

- This branch was rebased onto `origin/staging` @ `4e8da8357`. Commit `62d90304d` (#1051, "restore green trunk — 7 pre-existing staging blockers") had already resolved the pre-existing staging-side reds (principles §1.7 + F1, rule-index, install-sh, hooks, synth-bundle) that briefly blocked an earlier push attempt — none of them LG-S4's; they cleared on re-rebase onto current `staging`.
- SSOT: this adapter's row landed as **#223** (an earlier draft used #220, which collided with `#1051`'s push-gate-breakage entry on staging; renumbered on re-rebase). `hasSsotMatch` (principle 11 F1) keys on the verbatim path `packages/core/research/ecosystem-python.ts`, unaffected by the ID.
