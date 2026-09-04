# CC plugin packaging (superpowers-style, hybrid) — umbrella kickoff

> **For:** `/meta-orchestrator plugin-packaging` (next session). Multi-stage I-phase umbrella.
> **Mode:** Mode B (worktree-isolated parallel sub-waves where stages allow).
> **PR base:** `staging`. Each stage = its own PR; stage-gate (Phase -1 cold-review) between stages.

## §0 Sources of truth (read FIRST)

- **Spec:** [`docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md`](../../../docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md) — the design (11 sections), maintainer decisions baked in (CC-first + degrade; in-repo marketplace; hybrid seam «like superpowers»). **This kickoff orchestrates the spec; the spec holds the architecture — do NOT re-derive it.**
- **Plan:** to be written (`writing-plans`) into `docs/superpowers/plans/2026-06-22-cc-plugin-packaging.md` — bite-sized TDD tasks per the §9 stage map. The orchestrator writes the plan from the spec **before** dispatching S1.
- **Live prior-art read (2026-06-22):** superpowers `.claude-plugin/plugin.json`, `hooks/hooks.json` (`SessionStart` on `startup|clear|compact`, `${CLAUDE_PLUGIN_ROOT}`), `hooks/run-hook.cmd` (polyglot, extensionless), `skills/using-superpowers/SKILL.md`, superpowers-marketplace `marketplace.json`.

## §1 Goal (one line)

Ship rules-as-tests-aif as a **Claude-Code-first plugin** installable from an **in-repo marketplace** (`/plugin marketplace add <user>/rules-as-tests-aif`) delivering the soft layer (skills/agents/session-hooks, skills auto-triggering via a `using-rules-as-tests` bootstrap) + a `/rules-as-tests:install-enforcement` command bridging to the bundled `install.sh` hard layer — degrading gracefully to non-CC harnesses, with the packaging enforced by its own principle test. **No regression to existing `install.sh`.**

## §2 Stage map (spec §9 → stage)

| Stage | Spec deliverable | Parallel? | Depends on | Branch |
|---|---|---|---|---|
| **S0 Spec + prior-art SSOT** ✅ DONE | spec + SSOT entries #149–152 (superpowers ADOPT, run-hook ADOPT-audited, using-* ADAPT, CC-docs REFERENCE) | no | — | committed `63b344c` |
| **S1 Plugin skeleton** ✅ DONE | `.claude-plugin/{plugin,marketplace}.json` + `plugin/` tree + `run-hook.cmd` + acceptance tests (5/5, 2/2) | no (foundational) | S0 | committed `fa37b2b` |
| **S2 Hook relocation** | per-hook path-class audit; relocate shippable hooks (extensionless, self-resolving, env-var-correct) + `hooks.json` | no | S1 | `worktree-plug-s2-hooks` |
| **S3 Skills + bootstrap** | `using-rules-as-tests` meta-skill + `SessionStart` wiring; shippable `skills/` set | **yes (disjoint w/ S4)** | S1 | `worktree-plug-s3-skills` |
| **S4 Agents** | consumer-facing agent subset (+ add `compliance-verifier` to `extension.json`); pass `21-shipped-agent-tools-valid.test.ts` | **yes (disjoint w/ S3)** | S1 | `worktree-plug-s4-agents` |
| **S5 Hybrid seam** | bundle `install.sh`+templates; `installing-enforcement` skill + `/install-enforcement` command | no | S1 (+S2 hooks) | `worktree-plug-s5-seam` |
| **S6 Recursive self-test** | `<N>-plugin-manifest-integrity.test.ts` + paired-negative fixture + doc-authority headers | no | S1–S5 | `worktree-plug-s6-selftest` |
| **S7 OpenCode adapter** | `.opencode/INSTALL.md` + reconcile `extension.json`/`AGENTS.md` | yes | S3 | `worktree-plug-s7-opencode` |
| **S8 Docs + publish** | README install section (per-harness) + version bump + integration PR + `done.md` | no (last) | S1–S7 | `worktree-plug-s8-integration` |

Stage-gate between every stage: §6 merge check + Phase -1 cold-review (GO before next stage dispatch).

> **Sub-wave isolation:** each parallel sub-wave gets its own worktree (`bash scripts/create-worktree.sh plug-<stage>-<name>`) — parallel-subwave-isolation.md §1. S3 (skills) and S4 (agents) touch disjoint files → safe to parallelize.

## §3 Scope fence (hard)

**IN:** exactly the spec §9 stages S0–S8.
**OUT (do NOT touch — surface as observation only, per CLAUDE.md PR strategy):**
- Any change to `install.sh`'s deploy logic beyond *bundling a copy* into `plugin/install/` (S5). The installer's own behaviour is the [one-click-installer](../../../docs/superpowers/specs/2026-05-31-one-click-installer-design.md) umbrella's surface, not this one.
- Rewriting the maintainer-internal `.claude/` dev harness (`orchestrator-prompts/`, `.claude/skills/dispatcher` + `.claude/skills/pipeline`, `runtime-bridge-dispatch.sh`). They are explicitly NOT shipped (spec §5 triage) — read-only here.
- Multi-harness beyond CC + OpenCode (Codex/Cursor/Gemini/Kimi adapters) — a follow-up umbrella; do NOT start it autonomously.
- Edits to `~/.claude/skills/` (agent-uncommittable) or `.claude/settings.json` (self-protected).

## §4 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — MANDATORY)

Active traps for this umbrella: **T3, T5, T11, T13, T15, T16, T19**.
- **T3** (verify, no prose-only findings) — every «plugin loads» / «hook fires» / «test passes» claim carries the actual command + output, run in a throwaway consumer repo; every file:line is opened.
- **T5** (no scope creep into §3 OUT items mid-stage — especially «while I'm here, let me also add the Codex adapter»).
- **T11** (prior-art before proposing a mechanism) — done in spec §3/§10 (superpowers live-read 2026-06-22); cite the SSOT, do not re-survey from training data.
- **T13** (ADOPTED ≠ zero-work) — `run-hook.cmd` is copied from superpowers but MUST be read line-by-line and given our own test (Windows polyglot block + Unix exec path), not pasted on faith.
- **T15** (self-application) — S6 is non-negotiable: the plugin manifest is enforced by a principle test + paired-negative fixture; the new shipped docs carry Class + Authoritative-for headers.
- **T16** (pattern-matching-on-name) — «plugin» does NOT replace `install.sh`. The plugin format cannot wire git-hooks/CI; the README must state the soft/hard boundary. Upstream problem class (superpowers = skills/methodology layer) ≠ ours (skills + repo-enforcement); the enforcement does NOT transfer through the plugin channel.
- **T19** (own cold-QA before handoff) — S8 reviewer runs the full e2e on a throwaway repo (`/plugin marketplace add .` → install → skills active → `/install-enforcement` dry-run) BEFORE PR handoff; CI-green ≠ design-review.

Domain-specific:
- **T-PLUG-A — `$CLAUDE_PROJECT_DIR` vs `${CLAUDE_PLUGIN_ROOT}` blanket-swap.** The shipped hooks today hardcode `$CLAUDE_PROJECT_DIR/.claude/hooks/…` (they assume `install.sh` copied them into the consumer repo). Tempted output: a single sed sweep replacing `$CLAUDE_PROJECT_DIR` → `${CLAUDE_PLUGIN_ROOT}` to «make it a plugin». This breaks every project-relative hook (e.g. `inject-matching-rule.sh` reads the *consumer's* `.claude/rules/*.md`; `check-doc-authority.sh` audits the *consumer's* files — those legitimately need `$CLAUDE_PROJECT_DIR`). Counter (spec §5): a **per-hook path-class audit** — classify each path as plugin-data (→ `${CLAUDE_PLUGIN_ROOT}`) or project-data (→ `$CLAUDE_PROJECT_DIR`), then test the relocated hook from the plugin root in a throwaway consumer repo. Never a blanket replace.
- **T-PLUG-B — «shipped == all of `.claude/`».** Tempted output: copy the maintainer's whole `.claude/hooks` (14) + `.claude/skills` (incl. `dispatcher`/`pipeline`/`runtime-bridge-dispatch.sh`) + reference `orchestrator-prompts/` into `plugin/`, leaking the internal dev harness to consumers. Counter (spec §5 triage): ship ONLY the consumer-facing subset declared in `extension.json` + the [CLAUDE.md Artifact Ownership Contract] + dual-implementation-discipline §3; the triage list is itself a reviewable artifact in S2. Internal tooling stays out.

## §5 Per-stage acceptance (gate criteria)

- **S0:** `prior-art-evaluations.md` carries ≥3 new entries (Verdict/Rationale/Trigger); principle 08 green; spec carries doc-authority header.
- **S1:** `/plugin marketplace add .` (or local equiv) loads the plugin with zero schema errors; `plugin.json`/`marketplace.json` versions equal; the marketplace `source` key for a same-repo subtree is **verified against** [plugins-reference] (not guessed — T3); `run-hook.cmd` has its own pass/fail test.
- **S2:** the path-class triage table committed; relocated shippable hooks fire from plugin root in a throwaway consumer repo; grep finds no plugin-data path on `$CLAUDE_PROJECT_DIR`; every shipped hook carries `@dual-pair`/`@cc-only-rationale`.
- **S3:** fresh session in a throwaway repo surfaces the `using-rules-as-tests` bootstrap via `SessionStart`; `rules-as-tests` skill invocable via the Skill tool; bootstrap content respects «user instructions > skills» priority.
- **S4:** shipped agents resolve; **`packages/core/principles/21-shipped-agent-tools-valid.test.ts`** green on the shipped subset (NB: slot 21 is shared with `21-agnosticism-conformance.test.ts` — cite the full filename); no unresolvable tool names (the #551 class).
- **S5:** `/rules-as-tests:install-enforcement` runs the bundled `install.sh --dry-run` against `$CLAUDE_PROJECT_DIR`, consent-gated, writing nothing on dry-run; non-dry run wires `.husky` + CI into a throwaway repo.
- **S6:** new principle test green; the deliberately-broken-manifest fixture **fails** it (paired-negative); principle 09 green on new docs; markdownlint 0.
- **S7:** `.opencode/INSTALL.md` documents the fetch-and-follow path; skills load off-CC; the accepted session-hook-auto-injection degradation is documented, not silently broken.
- **S8:** e2e on throwaway repo (marketplace add → install → skills active → `/install-enforcement`) PASS; README per-harness install section; version bumped; PR to `staging` with §1.7 forward+backward + capability-commit `Prior-art:` trailers + `## 🟢 Простыми словами`.

## §6 Stage-gate mechanic (between every stage)

```bash
gh pr list --search "is:merged head:<stage-N-branch> base:staging" --json number,title,mergedAt --limit 10
```
Stage N PRs not merged → HALT, do not dispatch N+1. Then Phase -1 cold-review (Agent tool, read-only reviewer, `reviewer-discipline.md §2`) → GO/REVISE/STOP before N+1.

## §7 Notes for the orchestrator

- **⚠ Current state (2026-06-22, post Phase -1 cold-review) — dispatch starts at S2.** S0 + S1 are **already DONE**: spec/plan/kickoff (`63b344c`), the `plugin/` skeleton + manifests + run-hook.cmd + acceptance tests (`fa37b2b`, both suites green), and SSOT entries #149–152. These commits currently live on branch `docs/stage-2-generate-path-brainstorm`, **NOT on `staging`**. Before invoking `/meta-orchestrator plugin-packaging`: (1) get these commits onto `staging` (per kickoff-staging-placement §1, else the dispatch session can't see them), and (2) dispatch starting at **S2** — do NOT re-dispatch S0/S1 (they would collide with committed work). This resolves the cold-review B1/B2 findings.
- **Write the plan first.** Run `writing-plans` to expand spec §9 into `docs/superpowers/plans/2026-06-22-cc-plugin-packaging.md` (bite-sized TDD tasks with exact paths/commands) BEFORE dispatching S1. The kickoff orchestrates; the plan holds task detail.
- **Capability-commit gate:** `run-hook.cmd` (S1), the principle test (S6), the install command + bundled installer (S5) cross the LOC threshold → each carries a `Prior-art:` trailer referencing the S0 SSOT entries (spec §10).
- **No paid LLM in CI** — this umbrella is bash + JSON + one TS principle test; trivially `no-paid-llm-in-ci.md`-compliant.
- **Kickoff-staging-placement (`kickoff-staging-placement.md §1`):** this kickoff + the plan are tracked design docs — **merge them to `staging` before** running `/meta-orchestrator plugin-packaging`, or the dispatch session (on `staging`) won't see them. Merge first, dispatch second.
- **Verify, don't guess, the marketplace same-repo `source` schema** (spec §4 open detail) — this is the one place the plan must read the official docs, not infer.
- **Throwaway-consumer-repo testing is the real gate** (T19): CC plugin behaviour (env vars, SessionStart matchers, `${CLAUDE_PLUGIN_ROOT}` resolution) only manifests on a real install, not in unit tests. Every stage that ships a hook/skill/command proves it on a scratch repo.
- **Last-stage (S8) PR merge → write `done.md`** here per CLAUDE.md Umbrella closure convention.
- Worktree base ref = refreshed `origin/staging` (not `main`) — `scripts/create-worktree.sh` handles this.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
