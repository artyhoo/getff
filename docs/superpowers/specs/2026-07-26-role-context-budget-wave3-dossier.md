# Wave 3 Dossier — In-flight context (raw material, not analysis)

> **Companion to:** [`2026-07-26-role-context-budget-design.md`](./2026-07-26-role-context-budget-design.md) (the candidate-shapes catalogue). This file holds §10 of that doc, split out to respect the repo's 600-line markdown limit (`.husky/pre-commit:64`).
>
> **What this is:** raw in-flight context the fabla may want to know about — what else is moving on the same surface. **Not analysis, not recommendation.** §10.5 contains 4 GLM-authored hypotheses (H1-H4) — these are speculation for the fabla to react to, not findings it should trust.
> **Author:** orchestrator session (GLM-5.2).
> **Date:** 2026-07-26

---

## 10. Wave 3 — in-flight compatibility + parallel-work discovery (2026-07-26)

> **What wave 3 found.** Two live threads the wave-1/2 research missed: (a) an operator-commissioned umbrella `session-start-token-audit` (branch `claude/session-start-token-audit-77d224`, commissioned today) that owns the "context budget" vocabulary; and (b) two AIF-dispatched review seats under the slug `feature-scratchpad-*` (`/Users/art/code/aif-handoff/projects/`), one of which (Seat B) was **reworked mid-flight** to answer the operator's exact question (Russian: «для каждой сессии возможно нужен разный промт…»). Surfaced as context, not as direction.

### 10.1 The parallel work the operator already started

**`session-start-token-audit` umbrella** (`.claude/orchestrator-prompts/session-start-token-audit/kickoff.md` on branch `claude/session-start-token-audit-77d224`, tip `fb218ab6c5`, NOT yet on `origin/staging`):

- **Goal:** a fresh CC session starts at ~100k tokens; the repo's own injected set measures ~140 KB ≈ 36-40k tokens. Attribute every injected artifact to its injecting channel (file:line), then trim by re-scoping channels. **Budget target: ≤20-25k tokens** (operator-adjustable).
- **S1** — measurement script `scripts/measure-session-start-tokens.sh` + attribution table (per-environment: host-cc vs aif-container).
- **S2** (all moves PRE-DECIDED) — `zcode-parity-doctrine.md` add `paths:` frontmatter; `autonomous-loop-continuity.md` + `git-conflict-merge-forward.md` → `claudeMdExcludes`; CLAUDE.md hot/cold split; `MEMORY.md` English-compressed index (proposal-only).
- **S3** — re-measure; before/after table; budget check.
- **Hard constraint** (from `attention-is-not-a-mechanism.md`): never demote a load-bearing always-on check.

This umbrella is **the natural host** for any role-context-budget work — it already owns the budget vocabulary and the attribution discipline.

### 10.2 The AIF scratchpad Seat B already answered the operator's question

**Seat B** (`/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scratchpad-d49985-*/REVIEW-REPORT.md`, modified 2026-07-26 20:53) was a `/arch §2` two-altitude review seat that the operator **reworked mid-flight** from a session-start-token bottom-up review into a per-role-context review. **VERDICT: REVISE.**

**Seat B's 5-axis comparison** (this project vs Superpowers SDD):

| Axis | SDD | This project | Verdict |
|---|---|---|---|
| 1 | Per-role prompt templates (implementer/reviewer) | Same — `arch/pipeline/dispatcher` + `agents/*.md` | MATCH |
| 2 | Per-role tool surface (input-channel allowlist) | **Stricter** than SDD (e.g. backward-sweep-auditor) | MATCH+ |
| 3 | Per-role model tier | Same — `arch:47` top/mid/executor | MATCH |
| 4 | Per-role kickoff-as-task-brief | Same — each kickoff self-contained | MATCH |
| 5 | Per-role **ambient context** (auto-injected at session/subagent start) | NONE in SDD (controller hand-curates) | **UNIFORM** in this project — `inject-session-bootstrap.sh` (UserPromptSubmit) + `inject-subagent-digest.sh` (SubagentStart) inject the SAME digest into every session/subagent | **GAP** |

**Seat B's load-bearing finding (F2): the uniform digest is DELIBERATE anti-drift machinery, not an oversight.** Removing it trades anti-drift for context hygiene — that is the load-bearing tradeoff the operator's question implicitly raises. Evidence: the 2026-05-09 incident (cited in CLAUDE.md «Artifact Ownership Contract») — reviewer agents pattern-matched on language in EXECUTION-PLAN.md §1 («north star»), then reinforced the wrong goal across reviewer cycles. `.claude/session-bootstrap.md:3-7` states the design intent: *"persists project goal + invariants across context compaction … more robust than CLAUDE.md compaction-block which depends on compactor cooperation."* The digest exists **because every role was observed to drift on goal** — making it role-specific weakens the property that catches drift.

**Seat B's 3-option fork (DECISION-NEEDED — NOT picked, per reviewer-discipline.md §2):**

- **A — Per-role digests.** Split `.claude/session-bootstrap.md` digest by role marker (`<!-- digest:worker -->`, `<!-- digest:reviewer -->`, `<!-- digest:planner -->`); modify `inject-subagent-digest.sh` to read `subagent_type` and pick the matching block.
- **B — Keep uniform + document.** Acknowledge the tradeoff; add a comment to `session-bootstrap.md` and a SSOT entry; don't change behaviour.
- **C — Hybrid one-line anchor.** Keep the uniform digest but add a one-line role-tag (`[role: worker — context for WHERE+WHAT only]`) that primes the role without trimming the anti-drift content.

**Seat A** (top-down, separate seat, did not see Seat B): VERDICT: GO on the umbrella, with a [MAJOR] finding that removing `autonomous-loop-continuity.md` from always-on injection creates a guidance gap (the §2 bounded-waiter rule is needed *during* execution, before the Stop-hook fires). Plus 3 [MINOR] (paths:/globs format mismatch, container-probe fallback, git-conflict-merge-forward rebase-reflex window). Seat A's MAJOR is a sequencing concern for `session-start-token-audit` S2, **not** for role-context-budget directly — but it shows the trim discipline has teeth.

### 10.3 Overlap with Seat B's 3-option fork

For awareness — Seat B independently surfaced 3 options that overlap with shapes in the main catalogue:

1. Seat B's Option A (per-role digests) ≈ main catalogue shape ε (SubagentStart per-role) + shape μ (two-layer digest).
2. Seat B's Option C (hybrid one-line anchor) ≈ main catalogue shape ζ (hybrid prime).
3. Seat B's Option B (keep uniform + document) ≈ main catalogue shape δ (defer) or shape π (codify that ambient MUST stay uniform).

Not redundant — the main catalogue has 12 other shapes Seat B did not consider.

### 10.4 In-flight compatibility matrix

| In-flight item | Conflict risk | Compose-with opportunity | Sequencing constraint |
|---|---|---|---|
| **`session-start-token-audit` umbrella** (kickoff on branch, not yet on staging) | Low — it trims always-on files; role-context-budget shapes per-dispatch delta. Different axes. | **High — natural host.** Budget vocabulary + attribution discipline + "never demote always-on" constraint already established here. | Land S2 (file/channel trims + MEMORY.md rewrite) first; role-context-budget should consume post-S2 file locations. Also: kickoff must reach `origin/staging` before any dispatch (kickoff-staging-placement rule). |
| **PR #1175** `getff-honest-signals` S6 (`inject-matching-rule.sh` corpus-absent arm, OPEN, review deferred) | **Medium on the exact hook file.** Same hook + plugin twin + test + 11 baselines in flight. | The empty-corpus arm and per-role shaping are orthogonal — one handles "nothing to inject", the other "inject differently per role". | **Do not touch `inject-matching-rule.sh`, `plugin/hooks/inject-matching-rule`, `packages/core/hooks/inject-matching-rule.test.ts`, or `tests/install-sh/baselines/*` until #1175 merges.** |
| **`inject-layer-extension`** (DONE/DEFER, PR #494, 2026-06-13) | None live (deferred). | **Recorded BUILD re-trigger condition directly relevant**: DEFER was keyed on (a) ≥6 marked rules or (b) consumer mis-scope report or (c) per-class generated rules. A role-context-budget rule that adds per-role markers would re-raise that trigger. | If role-context-budget proceeds, audit `inject-layer-extension/done.md` first — the marker-vs-`paths:` decision (SSOT #101) may need re-litigation. |
| **`skill-context-runtime-probe`** (DONE, 2026-05-21) | None. | **Proven per-role delivery mechanism for aif-handoff**: `.ai-factory/skill-context/<skill>/SKILL.md` override works for background sidecars. A role-context-budget rule targeting the orchestrator dispatch path should reuse it rather than invent a new one. | None. Cite as prior-art (SSOT ID) before proposing any new per-role delivery mechanism. |
| **AIF scratchpad Seat B** (review report, not a code change) | None — advisory. | **Already laid out the 3-option fork + the F2 tradeoff.** This design doc now incorporates Seat B's framing. | Treat Seat B as prior-art; cite its F2 finding (uniform digest = deliberate anti-drift) before any hook change. |

### 10.5 Four GLM hypotheses for Opus to verify

> **Author's role disclosure:** this section is authored by a GLM-5.2 orchestrator. Per the user's instruction «максимум гипотизы строить которые опус проверит а фабл решит», these are HYPOTHESES for Opus to cold-verify — not load-bearing verdicts. Each is falsifiable.

**H1 — The 2026-05-09 drift incident is the load-bearing constraint, not context size.**
- *Claim:* Seat B's F2 finding (uniform digest = deliberate anti-drift) means the real constraint on per-role context is the **drift-prevention property**, not the token budget. The session-start-token-audit umbrella optimizes for token cost; role-context-shaping must additionally preserve the drift-prevention property.
- *Evidence:* CLAUDE.md «Artifact Ownership Contract» cites the 2026-05-09 incident; `.claude/session-bootstrap.md:3-7` states the design intent.
- *Wrong if:* Opus reads the 2026-05-09 incident record and finds the drift was caused by something OTHER than missing uniform context (e.g. by language in EXECUTION-PLAN.md being misleading, in which case the fix is doc-authority-hierarchy, not uniform injection).
- *GLM confidence:* medium-high. The incident citation exists; whether it generalizes to "every role needs the same anchor" is Opus's call.

**H2 — Speculation: the hybrid one-line anchor (Seat B's Option C, main catalogue shape ζ) may be one worth particular attention.**
- *Claim:* of the 6 options now on the table (A/B/C/D/E + F), Option F best resolves the tension between context-minimization (user's instinct) and drift-prevention (project's anti-drift thesis). It keeps the uniform digest (preserving F2's anti-drift property) and adds a per-role prime line (giving the worker the "WHERE+WHAT only" framing the user asked for) without trimming the anti-drift content.
- *Evidence:* Seat B's Option C framing; user's original ask («воркеру не нужно знать цель идею и архитектуру» — but note: today the digest only carries goal + 4 invariants + H1 line, which is small, not "full project architecture").
- *Wrong if:* Opus cold-reviews and finds the digest today is ALREADY so small (~500 tokens, per session-bootstrap.md digest size) that per-role trimming yields no measurable benefit — in which case Option B/D (acknowledge, defer) is the honest call.
- *GLM confidence:* medium. The framing is appealing but the actual size/benefit math is unverified.

**H3 — `session-start-token-audit` should absorb role-context-budget as a stage, not run in parallel.**
- *Claim:* the two threads are more valuable as one umbrella. The token-audit establishes the measurement + attribution + budget vocabulary (S1); role-context-shaping is a natural S4 stage that uses the measurement to decide whether per-role trimming pays off. Running them separately duplicates the measurement work.
- *Evidence:* §10.4 compatibility matrix — natural-host relationship; both target the same inject-* hook surface.
- *Wrong if:* Opus finds the token-audit's "never demote always-on" hard constraint (S2 descopes) prevents per-role trimming by construction — in which case role-context-budget is a separate decision that the token-audit cannot host.
- *GLM confidence:* medium. The hosting is plausible but the constraint interaction is subtle.

**H4 — `skill-context-runtime-probe` is the proven delivery mechanism for per-role context in aif-handoff; SubagentStart hook is the right channel for CC-native sessions.**
- *Claim:* the repo already has TWO proven per-role delivery paths — (a) `.ai-factory/skill-context/<skill>/SKILL.md` override (probed 2026-05-21, works for sidecars), (b) SubagentStart hook (proven for the digest). A role-context-budget rule should reuse (a) for aif-dispatched workers and (b) for CC-native dispatch, rather than inventing a new mechanism.
- *Evidence:* §10.4 row "`skill-context-runtime-probe`"; §3.3 SubagentStart hooks.
- *Wrong if:* Opus finds the skill-context override only works for sidecar agents (background), not for dispatched workers (foreground), in which case path (a) does not generalize and the SubagentStart hook is the only channel.
- *GLM confidence:* medium-high. Both paths are documented as working; the generalization from sidecar→worker is the open question.

### 10.6 What GLM did NOT do (honest disclosure)

- Did NOT verify the actual byte/token size of the current session-bootstrap digest (claim in H2 that it's "~500 tokens" is unverified — would need to run `wc -c` on the digest block + apply the T-TOK-A divisor from the token-audit kickoff).
- Did NOT read the 2026-05-09 incident record directly — only the citation in CLAUDE.md «Artifact Ownership Contract». The incident's specifics (which reviewer, which cycle, which wrong goal) are unverified.
- Did NOT verify whether `skill-context-runtime-probe`'s override generalizes from sidecar to dispatched worker — only the probe's existence and stated success.
- Did NOT pick between Options A/B/C/D/E/F. Per reviewer-discipline + the user's explicit instruction, the fabla decides.
- Did NOT verify the `inject-layer-extension` BUILD re-trigger condition applies to per-role markers — only flagged it as a risk for Opus to check.

### 10.7 What the fabla may want to do with this (suggested, not prescriptive)

- The raw research patch (companion file) has 10 falsifiable claims + an 8-item verify-list. Opus may cold-verify any of them before the fabla commits to a shape.
- The catalogue (main doc §6) has 15 candidate shapes (α-σ). The fabla may pick, combine, reject, or invent its own.
- Sequencing observation (not a constraint GLM imposes): `inject-matching-rule.sh` surface has PR #1175 OPEN; `session-start-token-audit` S2 is not yet on staging.

### 10.8 Full §3.7 table — what superpowers (the plugin) ships

(Moved here from main doc §3.7 to respect the 600-line markdown limit.)

Source: [`obra/superpowers`](https://github.com/obra/superpowers) v6.1.1, cached at `/Users/art/.zcode/cli/plugins/cache/claude-plugins-official/superpowers/6.1.1/`. Files: `hooks/hooks.json:3-15` (Claude Code registration), `hooks/session-start` (the bash injector), `hooks/run-hook.cmd` (cross-platform polyglot wrapper), plus Cursor variant `hooks-cursor.json`.

| Aspect | Implementation | Citation |
|---|---|---|
| Event | `SessionStart` only (matcher `startup\|clear\|compact`) | `hooks/hooks.json:3-15` |
| What it injects | The full body of `using-superpowers/SKILL.md` (62 lines), wrapped in `<EXTREMELY_IMPORTANT>` tags | `hooks/session-start:11, 27` |
| Output shape | Platform-branched: `additional_context` (Cursor), `hookSpecificOutput.additionalContext` (Claude Code), top-level `additionalContext` (Copilot CLI/SDK) | `hooks/session-start:38-47` |
| Per-role? | **NO** — identical payload for every session | (no branching logic in `hooks/session-start`) |
| Other hook events | **NONE** — no PreToolUse, no PostToolUse, no SubagentStart, no UserPromptSubmit, no Stop | exhaustive grep of `hooks/` and `skills/` |

**Falsifier for "the pair is deliberate in superpowers":** would require (a) any skill or hook cross-referencing the two as a designed pair, (b) the SessionStart hook emitting a per-role digest rather than one flat document, or (c) a `PreToolUse`/`UserPromptSubmit`/`SubagentStart` hook existing that loaded skill content on demand. **All three FALSIFIED** in 6.1.1. The only non-SessionStart hook events appear in a future-design spec (`docs/superpowers/specs/2026-04-06-worktree-rototill-design.md:31, 341`) as unimplemented Phase-4 work.

### 10.9 Full §5.5 table — "deliberate pair" question by layer

(Moved here from main doc §5.5.)

| Layer | Progressive disclosure | Injection | Pair deliberate? |
|---|---|---|---|
| superpowers plugin | Prose only — describes host harness's Skill-filesystem mechanism (`anthropic-best-practices.md:235, 1049`) | One flat SessionStart dump (`hooks/session-start`) | **NO** — never cross-referenced |
| this repo | Path-gated rule summaries (`inject-matching-rule.sh`) | Path-gated + session-gated injectors + SubagentStart digest | **Partially** — `inject-matching-rule.sh` is itself both the disclosure and the injection (the summary IS the injected content), but it's path-gated, not role-gated |
| wrapper skills | None prescribed | None prescribed | N/A |
| SDD | File-handoff pattern (brief/report/diff as files) | None — coordinator constructs prompts manually | **NO** — file-handoff is disclosure-by-artifact; no injection |
