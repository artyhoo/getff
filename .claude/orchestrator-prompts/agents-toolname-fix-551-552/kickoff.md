# Kickoff — fix shipped sub-agent tool names (#551) + exclude authoring-only prober (#552)

> **Scope:** single-PR fix. Self-contained; a fresh session can execute without prior context.
> **Branch base:** `staging`. **GH issues:** #551, #552 (companion #550 tracking).

## Problem (verified this session, GO verdict)

All 6 shipped sub-agents (`agents/*.md`) declare `tools:` (line 4) with **non–Claude-Code names** (`read_file`, `list_files`, `run_command`). CC's `tools:` is a strict allow-list; all-unknown names → **empty toolset → the agent fabricates** (verified live, #551). These are the anti-hallucination/review agents, so the failure is maximally ironic (`#discipline-theatre`).

Verified facts (cite, don't re-derive):
- Frontmatter `tools:` is line 4 in every agent (`grep -n '^tools:' agents/*.md`).
- `read_file`/`list_files`/`run_command` are NOT CC tool names. Valid set: `Read, Write, Edit, Bash, Glob, Grep, Agent` (formerly `Task`), `WebFetch, WebSearch`, … (claude-code-guide vs docs, this session).
- `.claude/agents/` is a **CC-only** convention; other harnesses ignore the `tools:` field entirely → fixing to CC names does NOT hurt AI-agnosticism (the agnostic part is the prose body).
- **Upstream AI Factory** ships 19/19 sub-agents with real CC names (`/opt/homebrew/lib/node_modules/ai-factory/subagents/*.md:4`, e.g. `tools: Read, Glob, Grep`; dispatchers use `Agent(...)`). Our generic names are a divergence from upstream, not a principled choice. → **fix = match AIF**.

## Decision (brainstorm closed this session)

`manual-rule-liveness-prober` = **factory/authoring tool, NOT a consumer feature** → **do not ship to consumers** (#552). Rationale: it reads framework-internal paths (`packages/core/manifest/rules-manifest.json` — never shipped, `grep` of install.sh empty), and architecturally a normal CC subagent cannot spawn subagents (AIF `plan-coordinator.md:17`) so its RED→GREEN method needs top-level `claude --agent`. Consumer-facing rule-liveness-probing is gated on the [pressure-scenario-automation](../pressure-scenario-automation/kickoff.md) track.

## Exact fix plan

1. **#551 — all 6 agents → valid CC names (match each agent's actual needs):**
   - `compliance-verifier`, `review-sidecar`, `memory-codification-auditor` → `Read, Glob, Grep`
   - `living-docs-auditor` → `Read, Glob, Bash` (Bash runs `audit-ai-docs.sh`)
   - `orchestrator-worker-discipline` → `Read`
   - `manual-rule-liveness-prober` → `Read, Glob, Grep, Agent` (Agent = dispatch; top-level only)
2. **#552 — exclude prober from consumer payload (KEEP it in source as authoring tool):**
   - `install.sh` glob (~`for f in "$PKG_ROOT"/agents/*.md`): `case` skip for `manual-rule-liveness-prober.md`.
   - `install.sh` `SHIPPED_DOCS`: **swap** `agents/manual-rule-liveness-prober.md` → `agents/orchestrator-worker-discipline.md` (the latter ships via glob but was missing from the list = bug #552-C).
   - `packages/core/principles/09-doc-authority-hierarchy.ts` `REQUIRED_HEADER_DOCS`: **same swap** — the line-139 test asserts `SHIPPED_DOCS` length == 18 AND set-equal to the shipped subset; swapping keeps count 18 and both lists in sync.
   - prober body: add `§Hard constraints` note "top-level `claude --agent`, not a dispatched subagent; not shipped to consumers".
3. **Prose consistency:** old tool-name mentions in bodies → real names (`compliance-verifier.md:53`, `memory-codification-auditor.md:48,50`, `manual-rule-liveness-prober.md:47`).

## Acceptance

- `npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts` green (line-139 sync: 18 + set-equal).
- principle-12 (ai-laziness-traps) green; `tests/install-sh/*` green; `npm run check:all` green.
- Confirm install no longer copies the prober (fresh `install.sh` → `.claude/agents/` lacks it).

## ⚠ Previous-session draft — REPRODUCE + VERIFY, do not trust

A draft of every edit above was made in throwaway worktree `claude/festive-mirzakhani-46e078` (8 files modified, **UNCOMMITTED and NEVER test-run** — it dies with that worktree). Only this kickoff was committed. Treat the plan above as the spec and **reproduce from clean `staging`, then verify** — do NOT assume the draft was correct:

- [ ] Re-apply the 6 `tools:` edits + the install.sh glob-skip + the `SHIPPED_DOCS`↔`REQUIRED_HEADER_DOCS` swap (prober→orchestrator-worker-discipline) + the prose fixes.
- [ ] `npx vitest run packages/core/principles/09-doc-authority-hierarchy.test.ts` → green. **This is the gate most likely to break** (line-139: `SHIPPED_DOCS` length == 18 AND set-equal to the shipped subset).
- [ ] principle-12 (ai-laziness-traps) + `tests/install-sh/*` + `npm run check:all` → green.
- [ ] Fresh `install.sh ts-server --full` in a cleanroom → confirm `.claude/agents/` does **NOT** contain `manual-rule-liveness-prober.md`, and DOES contain the other 5.
- [ ] Grep agent bodies for `read_file|list_files|run_command` → only the prober's source remains acceptable (it's not shipped); shipped agents must be clean.

NOTE: the 5 agent files (`compliance-verifier`, `living-docs-auditor`, `memory-codification-auditor`, `orchestrator-worker-discipline`, `review-sidecar`) had **pre-existing uncommitted changes** in that worktree before this session — reproduce from clean `staging`, do not assume those were part of this fix.

## §AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T3** (every fix backed by command/file:line, no prose-only), **T15** (self-application — the fix's own validity is test-run), **T19** (own cold-QA of the diff before handoff; CI ≠ design review).
Domain-specific: **T-551-A** — «fixing the frontmatter `tools:` but leaving the broken names in the prose body» (looks fixed, stays inconsistent). Counter: grep bodies for `read_file|list_files|run_command` after the frontmatter edit.

## §4c aif agent — fork discipline (non-negotiable; added for autonomous dispatch 2026-06-16)

> **aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the unambiguous parts.

This fix is mostly pre-decided (GO verdict + exact 3-step plan above), so genuine forks should be rare. The one explicit instruction that is NOT a fork: the throwaway-worktree draft is **untrusted** — reproduce from clean `staging` and verify; do not guess that the draft was correct. Note: do NOT open the PR yourself (egress = host `harvest.ts`); just implement + pass the Acceptance gate.

## References
- GH #551, #552, #550. SSOT #115 ([prior-art-evaluations.md:188](../../../docs/meta-factory/prior-art-evaluations.md)).
- AIF subagents: `/opt/homebrew/lib/node_modules/ai-factory/subagents/*.md`.
- [09-doc-authority-hierarchy.test.ts:139](../../../packages/core/principles/09-doc-authority-hierarchy.test.ts) (the 18/set-equal gate).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
