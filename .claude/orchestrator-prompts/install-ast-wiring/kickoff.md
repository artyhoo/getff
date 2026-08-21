# install-ast-wiring — best-UX AST-based config wiring at install ("AST where they're better")

- **Type:** design-first / R-phase brainstorm. Larger, exploratory. **Run `superpowers:brainstorming` at session start — do NOT pre-decide the open questions in §4.**
- **Opened:** 2026-06-17.
- **Base:** staging.
- **Relation:** closes the deferred **Layer 2** of GH #547 Point 2 (auto-wire R2) — see [`docs/superpowers/specs/2026-06-16-install-auto-wire-r2-design.md:27`](../../../docs/superpowers/specs/2026-06-16-install-auto-wire-r2-design.md). May fold into the unclosed `migration-ast` umbrella (operator's "two birds" idea — a §4 question, not pre-decided).
- **Deliverable of the brainstorm session:** a committed design spec under `docs/superpowers/specs/2026-06-<dd>-install-ast-wiring-design.md` resolving §4. Implementation is a SEPARATE later dispatch.

## Why (concrete, verified this session 2026-06-17)

The operator wants **best-of-the-best onboarding UX** on the one-button installer: when the installer can read the repo, it should **auto-configure rule enforcement correctly**, not ship placeholders / leave a rule inert for the human to wire by hand. The remaining gap is **Layer 2** of #547 Point 2: injecting R2 (`no-unsafe-zod-parse`) into a consumer-authored **per-package** eslint config that re-exports a base lacking R2 (the #535 `export default base` case). Layer 1 shipped (#553): detect boundary → patch our ROOT globs, or record a re-checkable `R2 N/A`. Layer 2 — editing the consumer's OWN config file — was deferred as "the riskiest slice."

The operator's framing: **"AST там, где они лучше"** — use AST where it is genuinely better, keep grep where it must run with zero runtime.

## Design inputs (operator-provided + verified — do NOT re-derive, build on these)

1. **`--full` = the same wiring flow with "always yes."** Not a separate code path: ONE wirer with an `assumeYes` switch. Default (interactive) → show a diff + ask Y/N; `--full` → auto-apply all. This mirrors shadcn/`ng add`'s `-y/--yes`. (Operator insight, 2026-06-17.)
2. **Thin bash probe in `install.sh` calls a TS-core module that does the AST work.** The pattern already exists — `detect-r2-boundary.sh` is invoked from `install.sh:1052`; the R4 ts-morph probe runs via `npx tsx` ([install.sh:815](../../../install.sh)).
3. **`ts-morph` is ALREADY a dependency** (v28, `packages/core/node_modules/.pnpm/ts-morph@28.0.0`), used by `packages/core/probes/audit-r4.ts`, `audit-self/audit-ai-docs.ts`, `hooks/checks/cmd-script-liveness.ts`. So an AST config-editor is **REUSE, not a new dependency** (`@typescript-eslint/parser` is also a direct dep). This corrects an earlier "needs magicast / substrate-purity blocks it" overstatement.
4. **Install-time runtime model (load-bearing constraint):** `install.sh` runs **BEFORE** the consumer's `npm/pnpm install` and is **node-optional** ([install.sh:411,428,430](../../../install.sh)). `--full` is the one path that *guarantees* dev-deps (hence node + ts-morph) get installed ([install.sh:9,27](../../../install.sh)). ⇒ an AST wirer is feasible **only where the runtime is guaranteed** (the `--full` path / TS-core with node_modules); the lite / node-absent path MUST degrade gracefully (the existing bash-grep `detect-r2-boundary.sh` + emit a precise manual snippet). This is *why* the current detectors are bash-grep.
5. **Industry UX (verified 2026-06-17, DeepWiki on `withastro/astro` + WebSearch):** the modern recipe for "installer edits a user-owned config" is **AST (not regex) → diff preview → confirm → idempotent**. `astro add` uses **magicast** (AST) → `diffWords` preview → user confirmation → write ([astro cli/add/index.ts](https://github.com/withastro/astro/blob/main/packages/astro/src/cli/add/index.ts), [magicast commit](https://github.com/withastro/astro/commit/6272e6cec07778e81f853754bffaac40e658c700)). Codemods (jscodeshift/recast/ast-grep) are best practice over regex ([Hypermod](https://www.hypermod.io/blog/5-eslint-vs-codemods)). shadcn exposes `--yes` to skip the confirm ([shadcn CLI](https://ui.shadcn.com/docs/cli)). astro does NOT gate on a clean git tree — it relies on diff+confirm.
6. **`migration-ast` umbrella is unclosed** — no `done.md`, though all three eslint rules are AST (`no-unsafe-zod-parse.ts:1-28`, `no-direct-time-randomness.ts`, `require-otel-span.ts`) and ts-morph is wired. Folding here is an *option* (§4 Q2), not a given.

## Goal / acceptance (of the eventual implementation — for the brainstorm to scope)

1. On a fixture monorepo with a real `.parse()` boundary AND a per-package `eslint.config.mjs` that re-exports a base lacking R2: after `install.sh ts-server --full`, R2 is **actually enforced** in that package (proven by `eslint --print-config` showing the rule, per the #535 gate) — **without** clobbering the consumer's other config.
2. The wiring is **AST-based** (ts-morph or magicast — §4 Q3), **idempotent**, shows a **diff**, and **confirms** (auto-yes under `--full`).
3. **Degrades cleanly** when node/ts-morph is absent (lite path): falls back to the current grep detector + a precise manual snippet, never errors, never silently half-edits.
4. AI-agnostic, no paid-LLM-in-CI ([no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)); install.sh itself stays bash (the AST lives in TS-core it calls).

## §4 Open design questions (the brainstorm agenda — resolve via `AskUserQuestion`/dialogue, do NOT pre-pick)

1. **Scope:** A — Layer-2 config-wiring only · B — A + convert `detect-r2-boundary.sh` to AST on the `--full` path (grep stays as the node-absent fallback) · C — broad "AST-everywhere" pass folded into `migration-ast`. (Operator leans "two birds"; recommend confirming the smallest shippable slice first per atomic-umbrella discipline.)
2. **Umbrella home:** fold into `migration-ast` (and close its `done.md`) vs a standalone umbrella that REFERENCES it. Different problem-classes (rule-enforcement vs config-codemod) — weigh against the "two birds" pull.
3. **Tool:** reuse **ts-morph** (already in stack, but TS-oriented; target is `.mjs`/JS) vs adopt **magicast** (specialized for config editing + formatting preservation, but a new dep). BFR-default consult required.
4. **Where the wirer runs from:** the framework's `$PKG_ROOT/node_modules` (always has ts-morph) vs the consumer's deps (only after `--full`). Determines the bootstrapping + degrade design.
5. **Confirm the `--full` = `assumeYes` model** and specify the exact UX: diff format, per-change vs all-at-once confirm, and the node-absent degrade output.
6. **Safety triad:** idempotency + diff preview + (optional) git-clean check — which do we adopt (astro skips git-clean; do we)?
7. **Boundary of "AST where better":** which grep probes legitimately STAY grep (because they must run on the node-absent install path) vs which move to AST.

## Prior-art consult (mandatory before any "I propose…", per [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md))

- **Own-stack-first:** evaluate ADOPT/ADAPT of the existing `ts-morph` usage (`probes/audit-r4.ts`) before reaching for magicast. CC `/init` and the `tool-bootstrapping` skill already read repo signals — REFERENCE where relevant.
- DeepWiki `ask_question` ≥3 phrasings + WebSearch ≥3 phrasings on "AST codemod editing user eslint flat-config at install / magicast vs ts-morph vs jscodeshift for config injection / preserve formatting when editing eslint.config.mjs". Record verdicts in [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) (the astro/magicast + shadcn evidence in §inputs above is a starting point, not the full sweep).

## §5 AI-traps (per [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

See [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). Active canonical traps: **T2, T5, T11, T12, T13, T16, T20**.

- **T5** — this is the DESIGN/R-phase; do NOT write wirer implementation code. Produce a spec.
- **T11 / T12** — config-codemod tooling is active; do the DeepWiki + WebSearch sweep at proposal time, ≥3 phrasings, not from training-data.
- **T13 / T16** — "we already use ts-morph for R4 probes" does NOT mean it transfers to "edit a consumer's `.mjs` flat-config with formatting preserved." Write «Upstream/own problem class: X. Our problem class: Y. Match? evidence: …» explicitly before reusing.
- **T20** — every verdict in the brainstorm (ts-morph vs magicast, scope A/B/C) needs an evidence-bearing tool call in the same turn.

**Domain-specific trap (NOT in canonical catalogue):**

- **T-ASTwire-A** — the AI is tempted to design the AST wirer for the **happy path only** (node present, deps installed, one config shape) and forget the **node-absent / lite install path**, which is the *default* and where install.sh's whole design discipline lives ([install.sh:428](../../../install.sh)). Counter: the degrade path (grep + manual snippet, never error) is a **first-class acceptance dimension** (§Goal item 3), designed in — not bolted on. Falsifier: a fixture install with `node` unavailable must still complete rc=0 with a clear manual-wire note.

## Anti-scope

- Do NOT write wirer / install.sh implementation code in the brainstorm session (T5 — design only).
- Do NOT pre-decide §4 (scope, tool, umbrella-home) — those are the brainstorm's job.
- Do NOT add a paid-LLM-in-CI path; do NOT make a companion mandatory for consumers.
- Do NOT redo #547 Layer 1 (#553, shipped) or Point 1 (passport, #610, shipped).
- Do NOT modify `~/.claude/skills/orchestrator/` (agent-uncommittable).

## Autonomous aif-handoff dispatch — park-don't-guess (if dispatched autonomously)

This is a **design-first** task with genuine forks (§4). If dispatched via `tsx packages/runtime-bridge/src/cli/dispatch.ts`, the park-don't-guess levers are non-negotiable (else `#autonomous-dispatch-without-park`): set `AGENT_MAX_REVIEW_ITERATIONS=1`, and instruct the agent to **park** any §4 fork as a `manualReviewRequired` question (Option A → consequence X / Option B → consequence Y) and proceed only on the deterministic prior-art sweep. But note: brainstorming is interactive by nature — a maintainer-paste session is the better fit. Egress after done: `npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging`.

## See also

- [`docs/superpowers/specs/2026-06-16-install-auto-wire-r2-design.md`](../../../docs/superpowers/specs/2026-06-16-install-auto-wire-r2-design.md) — Layer 1 design + the Layer 2 deferral this closes.
- [`install.sh`](../../../install.sh) — runtime model (node-optional, runs-before-deps, `--full`).
- [`.claude/orchestrator-prompts/migration-ast/`](../migration-ast/) — the probes→AST-rules umbrella (unclosed; "two birds" fold candidate).
- [`.claude/rules/build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) · [`dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md) · [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
