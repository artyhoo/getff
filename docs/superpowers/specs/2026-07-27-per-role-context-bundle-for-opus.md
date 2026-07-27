# Per-role context — FINAL BUNDLE for Opus in CC

> **Authoritative for:** assembled bundle of per-role-context research material for Opus review (substrate docs, 3 verification task outputs, DeepWiki cross-check, contradictions table). The bundle is *not* a filter — it preserves both sides of every contradiction; Opus + fabla decide.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists); per-role-context design decisions — Opus + fabla decide; prior-deliverable content (bundle cites paths and copies findings read-only, never modifies originals).

**Assembled:** 2026-07-27 (UTC, container clock)
**Assembler:** aif-handoff container, branch `feature/scripts-98b1e2` (task `98b1e249-0ed3-44d2-a555-2c5f86b1dddf`)
**For:** Opus review + fabla-prep in Claude Code (CC) on the host
**Session boundary:** GLM (worktree, raw material) → aif (3 verify tasks + this bundle on staging) → Opus (CC, filter + fabla-prep). Opus is the filter; fabla is the decider.

## Reachability audit (read first — load-bearing)

Phase 0 re-probe at assembly time. **Operator: this section determines which sections below are primary-source vs host-path citation.**

| # | Source | Channel probed | Result | How it appears in this bundle |
|---|---|---|---|---|
| 1 | Substrate doc 1 — raw research patch | `git cat-file -e origin/staging:<path>`; `git log --all --oneline -- <path>`; filesystem search | **UNREACHABLE** — MISS on `origin/staging:73e03967` (stale tip pre-per-role-context), MISS on every local ref, MISS filesystem-wide under `/home/www` | §1, §2 — path cited with "host path known" marker |
| 2 | Substrate doc 2 — candidate-shapes catalogue | same probes | **UNREACHABLE** (same as #1) | §2 — path cited |
| 3 | Substrate doc 3 — inflight-context dossier | same probes | **UNREACHABLE** (same as #1) | §2 — path cited |
| 4 | Substrate doc 4 — addendum (fresh 2026) | same probes | **UNREACHABLE** (same as #1) | §2 — path cited |
| 5 | Task output — runtime-probe report (task `f164e807`) | aif-handoff REST API + host path + sibling-worktree filesystem | **REACHABLE via sibling worktree** at `/home/www/rules-as-tests-aif-feature-scripts-f164e8-f164e807-191a-4336-9fe1-52145255c00e/per-role-context-runtime-probe-report.md` (17 959 bytes). API + host path both unreachable. | §3.1 — content copied with attribution |
| 6 | Task output — deep-project-research report (task `f4dc0bff`) | same | **REACHABLE via sibling worktree** at `/home/www/rules-as-tests-aif-feature-scripts-f4dc0b-f4dc0bff-37c6-4662-abab-5c67c9a646b6/per-role-context-deep-research-report.md` (66 283 bytes). | §3.2 — content copied with attribution |
| 7 | Task output — cold-review report (task `4e73e54e`) | same | **REACHABLE via sibling worktree** at `/home/www/rules-as-tests-aif-feature-scripts-4e73e5-4e73e54e-da1f-44a8-979e-209013a9e6cd/per-role-context-cold-review-report.md` (12 177 bytes). | §3.3 — content copied with attribution |
| 8 | DeepWiki MCP cross-check | kickoff prose (host GLM session ran the queries; not re-run in this container) | RECORDED in kickoff §1 Source 8 verbatim | §4 — kickoff prose reproduced with provenance note |
| – | Network fetch | `git fetch origin staging` | **DEAD** — `gnutls_handshake() failed: The TLS connection was non-properly terminated` (TLS block consistent with `egress-no-api-bypass.md §3`) | – |
| – | aif-handoff REST API | `curl http://localhost:5180/api/tasks/<tid>` | **DEAD** — connection refused (silent) | §3 cited from sibling worktrees instead |
| – | `/Users/art/code/aif-handoff/projects/` | filesystem | **DEAD** — host path, not container path | §3 cited from sibling worktrees instead |

**Operator paste-into-CC list (substrate docs not readable from container):**

1. `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` (on real `origin/staging` post the per-role-context merge — *not* the stale `73e03967` this container sees)
2. `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` (same source)
3. `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` (same source)
4. `docs/meta-factory/research-patches/2026-07-27-per-role-context-addendum-fresh-2026.md` (same source)

**For task outputs (sources 5-7):** their content is in §3 verbatim/summarized; the operator does NOT need to paste them into CC — the bundle carries them.

## 0. Reading order (suggested)

1. §1 — Operator question (cite path — verbatim text in substrate doc 1)
2. §2 — The 4 substrate documents (path citation; substrate not in container's view of staging)
3. §3 — 3 verification task results (runtime-probe, deep-research, cold-review) — **content carried**
4. §4 — DeepWiki MCP cross-check (superpowers + anthropic-cookbook) — **content carried from kickoff**
5. §5 — Contradictions to resolve (LOAD-BEARING) — 5-row table
6. §6 — Parked forks + candidate shapes (decision space) — path citation
7. §7 — What this bundle does NOT do

## 1. Operator question (verbatim path)

`(host path known: docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md §Problem — operator pastes into CC)`

The operator's original question is in substrate doc 1, §Problem section. Operator: paste that section into CC for Opus to read end-to-end. The bundle deliberately does NOT paraphrase it (kickoff §3: no filtering).

The kickoff's framing of substrate doc 1 (verbatim from kickoff §1 item 1):

> "Raw research patch — `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md`. Read end-to-end. Carries 10 falsifiable claims (C1-C10) with 'Wrong if:' falsifiers, 8-item verify-list, 5 parked forks, §1.7 self-review."

## 2. Substrate documents (on staging — read in this order)

All 4 substrate docs are **unreachable from this container's view of `origin/staging`** (stale tip `73e03967`, pre-per-role-context merge). Opus on host reads them directly from the real `origin/staging` post-merge.

- **Source 1** (raw research patch) — `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` — claims: 10 falsifiable claims (C1-C10) with falsifiers, 8-item verify-list, 5 parked forks, §1.7 self-review.
- **Source 2** (candidate-shapes catalogue) — `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` — claims: 18 candidate shapes (α-σ), neutrally described.
- **Source 3** (inflight-context dossier) — `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` — claims: token-audit umbrella, PR #1175, scratchpad Seat A/B.
- **Source 4 (ADDENDUM — read LAST, supersedes parts of source 1)** — `docs/meta-factory/research-patches/2026-07-27-per-role-context-addendum-fresh-2026.md` — claims: actual payload measurement (~236 KB always-on), superpowers v6.2.0 diff (NEW scoped re-reviewer role), 6 fresh summer-2026 sources, 3 NEW claims (C11-C13), 2 NEW forks.

## 3. Verification task results

### 3.1 Runtime-probe (task `f164e807-191a-4336-9fe1-52145255c00e`)

**Source:** sibling worktree at `/home/www/rules-as-tests-aif-feature-scripts-f164e8-f164e807-191a-4336-9fe1-52145255c00e/per-role-context-runtime-probe-report.md` (17 959 bytes, 2026-07-26T20:47Z).
**Probe target:** live Claude Code 2.1.218 runtime, branch `feature/scripts-f164e8`.

**Verdict rollup (P1-P6):**

| Claim | Static prediction | Live observation | Verdict |
|---|---|---|---|
| **P1** — `inject-subagent-digest.sh` emits identical `additionalContext` regardless of `subagent_type` | Source has zero role branching; lines 22-26 read digest from `inject-session-bootstrap.sh` and emit via jq wrapper | Three subagent dispatches (`general-purpose`, `Explore`, `Plan`) all received byte-identical digest payload. SHA256 `4bdebe5884cf09ead081341837063a6ad69084f09268805b03828a234704b72e` for all three. Payload = 1539 bytes (= 1500-byte heredoc body + 39-byte CC prefix). | **CONFIRMED** |
| **P2** — `inject-subagent-context.sh` preserves `subagent_type` but does not branch on it | Source `_is_zcode` gate at line 33; comment at line 62 documents preservation; rewrite at `:73-75` appends digest regardless | `ZCODE_PROJECT_DIR` unset → CC runtime → hook dormant by design. Hook is wired (`PreToolUse:Agent\|Task` in `.claude/settings.json`) but never branches in this runtime. Source-side claim about `:73-75` independently confirmed by static read. | **SKIPPED: runtime is CC; hook dormant by design** — static claim CONFIRMED |
| **P3 (a)** matching path, first edit | Hook fires `additionalContext` containing rule's `<!-- inject: -->` summary | Edit on `packages/core/research/adapter-census.ts` (matches `research-source-trust.md`'s `<!-- globs: packages/core/research/** -->`) produced the path-relevant rule injection. | **CONFIRMED** |
| **P3 (b)** matching path, repeat edit | Dedup suppresses second injection of same rule slug | Second Edit on the same file produced no `additionalContext`. Dedup cache `/tmp/cc-rule-injector-*.txt` contains exactly one slug: `research-source-trust`. | **CONFIRMED** |
| **P3 (c)** non-matching path | Hook stays silent (no glob match → no injection) | Write to `probe-p3c-nonmatch.md` at project root produced no injection. Path matches no rule's `<!-- globs: -->`. | **CONFIRMED** |
| **P3 revert** | All trivial edits reverted within the same task with before/after content equality proof | Original SHA → after edits SHA → after revert SHA matches original byte-equality. | **CONFIRMED** |
| **P4** — CC-native loader injects `.claude/rules/*.md` without `paths:` frontmatter, minus `claudeMdExcludes` | Predicted loaded set = 7 rules (no-paths AND not-excluded) | Actually loaded = 11 no-paths rules. The 4 in `claudeMdExcludes` (`egress-no-api-bypass`, `memory-codification`, `recommendation-laziness-discipline`, `reviewer-discipline`) loaded despite the exclusion. | **PARTIAL** — 7 of 11 correctly predicted; 4 over-broad `claudeMdExcludes` reading. Likely cause: `claudeMdExcludes` scopes CLAUDE.md memory imports, not `.claude/rules/*.md` auto-load. |
| **P5** — Uniform session-bootstrap digest is small (~500 tokens, unverified) | Digest block lives in `.claude/session-bootstrap.md` between `<!-- digest:start -->` / `<!-- digest:end -->` markers | **Source-location claim stale at source.** `grep -n 'digest:' .claude/session-bootstrap.md` → empty (file is 55 lines / 3780 bytes; no digest markers; no digest block). Actual digest source = inline bash heredoc at `.claude/hooks/inject-session-bootstrap.sh:25-33` (DIGEST body = 1500 bytes / 7 lines / ~375 tokens). | **PARTIAL** — token-count portion CONFIRMED (~375 in range); source-location portion REFUTED |
| **P6 (arch)** — arch/SKILL.md has no per-role context table | No per-role context table or allow/deny list | Two reviewer seats named (top-down / bottom-up); both receive "artifact paths — never chat context". Uniform artifact-only input for both; differentiation by question text + model tier. | **CONFIRMED** |
| **P6 (pipeline)** — pipeline/SKILL.md has no per-role context table | same | Roles named (reviewer, implementer, spec-reviewer, code-quality-reviewer, planner). No per-role context-receive/exclude spec; no per-role table. Tables exist for Mode/Type routing only. | **CONFIRMED** |
| **P6 (dispatcher)** — dispatcher/SKILL.md has no per-role context table | same | Roles named (dispatcher, operator, reviewer, fidelity-auditor, top seat, senior-executor seat). Single role-input spec for fidelity-auditor only. | **CONFIRMED** |

**Highest-value anomalies (per probe report §"Anomalies"):**

1. **`claudeMdExcludes` is silently ignored for `.claude/rules/*.md`.** Predicted to suppress 4 rules at session-start; all 4 were loaded anyway. The 4 rules are documented in the index as having alternative channels (hook injection, digest line, agent protocol), so the operator intent was clearly to suppress their always-on load — but CC is not honoring that intent.
2. **`session-bootstrap.md` has NO digest markers.** The actual digest source is an inline bash heredoc at `.claude/hooks/inject-session-bootstrap.sh:25-33`. The `inject-subagent-context.sh` awk pipeline (line 54) reads a digest block from `session-bootstrap.md` that does not exist — making the ZCode fallback hook a silent no-op even if it ever ran.
3. **CC's `paths:` rule loader fires on Read, not just Edit/Write/MultiEdit.** Reading `packages/core/research/adapter-census.ts` caused CC to surface `research-source-trust.md` as a system-reminder via its native `paths:` mechanism — separate from `inject-matching-rule.sh`. This is documented in `rule-enforcement-channel-selection.md §4` ("Read-vs-edit timing — the load-bearing reconcile").
4. **Sensitive-file classifier blocks autonomous edits to `.claude/rules/**** — probe substituted a non-sensitive path that still matched a rule's glob. Future probes targeting `.claude/rules/**` directly in autonomous mode will hit the same wall.
5. **CC harness does not mutate the SubagentStart payload in any role-correlated way** — byte-equality across `general-purpose` / `Explore` / `Plan` (P1 CONFIRMED) is a real measurement, not just a source-code inference. The "no per-role context shaping" thesis holds at the runtime layer for the SubagentStart digest channel.

### 3.2 Deep-project-research (task `f4dc0bff-37c6-4662-abab-5c67c9a646b6`)

**Source:** sibling worktree at `/home/www/rules-as-tests-aif-feature-scripts-f4dc0b-f4dc0bff-37c6-4662-abab-5c67c9a646b6/per-role-context-deep-research-report.md` (66 283 bytes, 2026-07-26T21:16Z + 2026-07-27 rework).
**Scope:** 13 surfaces (S1-S13), exhaustive sweep.

**Per-surface verdicts (S1-S13 summary):**

| Surface | What was swept | Per-role context shaping? |
|---|---|---|
| S1 | `packages/runtime-bridge/` (20 .ts files) | **NO** — `bridge-profile` is whole-task model-tier routing, not per-agent-role shaping. `subagent_type` appears NOWHERE in any `.ts` file in this package. |
| S2 | `plugin/` (hooks twins + agents + skills + install) | **NO**. `subagent_type` is jq-preserved at `plugin/hooks/inject-subagent-context:66` but never branched on. |
| S3 | `packages/core/` (composition/hooks/templates/principles) | **PARTIAL** — `agent_type` used as a binary noise-guard discriminator in one hook (`warn-subagent-report.test.ts:12,224`); no per-role generation/composition/template paths. Composition IR schema `additionalProperties: false` — role field structurally forbidden. |
| S4 | `tests/` (125 files) | **NO** — 0 per-role signals. Coverage gap, not surface finding. |
| S5 | `scripts/` (28 scripts) | **NO** — harness-axis (CC/zcode/plugin) is the only per-target shaping. |
| S6 | `.github/` (11 workflows) | **NO** — and structurally prevented by `no-paid-llm-in-ci.md`. |
| S7 | `setup.d/` (18 install files) | **NO** — install branches on stack + suite opt-in, never on role. |
| S8 | `agents/` (16 framework) + `.claude/agents/` (19 pipeline) | **YES — universal; every agent file is a deliberately-shaped role persona.** Cold-agent dispatch is the dominant pattern (5+ agents with hard "no PR narrative" rules + minimal input contracts). Sidecar pattern in `.claude/agents/`: 6 read-only background agents. Loop-agent model pinning (`haiku`/`sonnet`/`inherit`) is the most concrete per-role shaping. |
| S9 | skills trees (`.claude/skills` 39 files, `~/.claude/skills` 5) | **YES — concentrated in 4 skills** (`claude-glm-executor-handoff`, `night-mode`, `arch`, `pipeline`). `.zcode/skills` tree DOES NOT EXIST in this branch (kickoff's path citation is stale). |
| S10 | `docs/meta-factory/` (229 prior-art entries, 221 patches) | **NO** — 0 entries register "per-role context shaping" as a Capability. Deep 18-phrase grep confirms the negative-existence claim. |
| S11 | `.claude/rules/` (26 rules) | **1 ROLE-SHAPING rule** (`reviewer-discipline.md`); 11 ROLE-NAMING only. CLAUDE.md Task-tier routing (`:104-133`) is the richest role-shaping artifact but lives in CLAUDE.md, not a rule. |
| S12 | `CLAUDE.md`, `~/.claude/CLAUDE.md`, `MEMORY.md` | **YES** — CLAUDE.md Task-tier routing (`:104-133`) + Artifact Ownership Contract (`:71-87`) = richest role-shaping surface in repo. `~/.claude/CLAUDE.md` absent in container. Memory store has zero role content. |
| S13 | **`docs/superpowers/**` AND installed superpowers plugin** (added 2026-07-27 rework after operator prompt «А плагин суперпаверс проверял?») | **YES — LOAD-BEARING FINDING.** The plugin at `~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/` ships 5 role-specific prompt templates (`subagent-driven-development/{implementer,task-reviewer,re-review}-prompt.md` + `requesting-code-review/code-reviewer.md` + `writing-plans/plan-document-reviewer-prompt.md`) + explicit per-role context-construction doctrine at `skills/subagent-driven-development/SKILL.md:10`. **This is the primary per-role context-shaping surface for this stack** — the project's own per-role artifacts (`claude-glm-executor-handoff`, `agents/*.md`, `night-mode`) are specializations and overrides layered on top. |

**Q1-Q7 verdicts (kickoff §3):**

| Q | Prior claim | Verdict |
|---|---|---|
| Q1 | "no per-role branching" (prior research NO) | **REFUTED (strongly)** — coordination exists at the plugin layer (S13.b). |
| Q2 | (not asked) | **YES** (partial machinery exists; nothing threads the role field end-to-end into shaped context — `plugin/hooks/inject-subagent-context:66` preserves but never branches). |
| Q3 | (the 6-block input contract) | **YES** — 5-block sibling (`~/.claude/skills/orchestrator/SKILL.md:307`) + multiple parallel input contracts in `agents/`. |
| Q4 | (not asked) | **NO** — composition IR is structurally role-blind. |
| Q5 | (2-altitude review patterns) | **YES — 5 distinct instances** (`arch §2`, `night-mode`, `~/.claude/skills/orchestrator`, cold-agent pattern, CLAUDE.md Task-tier routing). |
| Q6 | NO SSOT prior-art entry | **CONFIRMED** — deep grep confirms. |
| Q7 | (only CLAUDE.md Artifact Ownership Contract) | **MISS = CLAUDE.md Task-tier routing (`:104-133`)** — richest role-shaping artifact, missed by prior research if it stopped at the Ownership Contract. |

**Highest-value misses of prior research (per deep-research §"What prior research missed"):**

1. **The superpowers plugin ships the most coordinated per-role context-shaping surface in this stack** — and neither prior research nor the original T1 pre-flight surveyed it. The project's own `night-mode` skill explicitly inherits this substrate ("a THIN layer over `superpowers:subagent-driven-development`"). (`S13.b`)
2. **`docs/superpowers/specs/` + `plans/` (75 files) was missed.** Includes `2026-07-23-acceptance-contour-design.md:14-15` (runtime role sockets) and `2026-06-02-aif-parallel-dispatch-design.md:71,103,141` (live `subagent_type:"implement-worker"` spawns in `agent_activity_log`). (`S13.a`)
3. **`bridge-profile` is per-task tier-routing, not per-agent-role context shaping.** Prior research apparently conflated these.
4. **`.zcode/skills` tree DOES NOT EXIST in this branch.** Kickoff's path citation `.zcode/skills/claude-glm-executor-handoff/SKILL.md:52-71` is stale; correct path is `.claude/skills/claude-glm-executor-handoff/SKILL.md:52-60`.
5. **`agents/orchestrator-worker-discipline.md` is the only multi-role agent** — bundles worker + planner + reviewer protocols.
6. **`~/.claude/skills/orchestrator/SKILL.md:307` 5-block input contract** is the predecessor of the 6-block contract (with `DECISIONS` instead of `<tools>`/`<constraints>`).
7. **Five cold-agent input contracts in `agents/`** — deliberately-trimmed per-role context payloads.
8. **`packages/core/composition/ir/convention-node.schema.json:5` `additionalProperties: false`** actively forbids adding a role field to composition IR without a schema change.
9. **`warn-subagent-report` `agent_type: 'Explore'` noise-guard** is the only place the repo reads `agent_type`/`subagent_type` to vary behavior — binary suppression, not context shaping.
10. **CLAUDE.md Task-tier routing (`:104-133`)** is the most operationally consequential per-role shaping surface in the repo.
11. **Model-tier engineering in `.claude/agents/`** — loop agents pin `model: haiku|sonnet|inherit` per role with explicit rationale comments.
12. **`.github/` has zero agent-dispatch workflows** — structurally prevented by `no-paid-llm-in-ci.md`.
13. **`tests/` has zero coverage of per-role context shaping.**
14. **`reviewer-discipline.md` is the only ROLE-SHAPING discipline rule.**

### 3.3 Cold-review (task `4e73e54e-da1f-44a8-979e-209013a9e6cd`)

**Source:** sibling worktree at `/home/www/rules-as-tests-aif-feature-scripts-4e73e5-4e73e54e-da1f-44a8-979e-209013a9e6cd/per-role-context-cold-review-report.md` (12 177 bytes, 2026-07-26T21:19Z).
**Status at v1 dispatch:** **BLOCKER REPORT** — not an audit report.

**Honest disclosure (load-bearing):** the cold-review task was commissioned as a read-only audit of the 3 substrate deliverables across 8 checklist dimensions (A format honesty, B claim quality C1-C10, C hidden pressure language, D completeness, E verify-list quality, F internal consistency + citation spot-check, G framing bias, H token-economy). The audit is conditional on the 3 deliverables being present. They were absent at v1 execution time and remain absent in this container (this bundle's §2). The audit has therefore **never run** in its full form.

**What the cold-review blocker-report independently corroborates (the meta-level findings that DID run):**

- **B1 (probe matrix):** 8 probes at execution time, all returning ABSENT. Probes covered the 3 expected paths, all-branch git history, filesystem-wide search under `/home/www`, and the 3 sibling worktrees.
- **B2.1 (runtime-probe corroboration):** The runtime-probe task independently flagged the absence of the 3 deliverables in its "Surprises" section.
- **B2.2 (bundle v1 corroboration):** The bundle-for-Opus task v1 (sibling worktree `feature/scripts-73519b`) independently reported the same absence and named `origin/feat/prune-worktrees` as the intended substrate source branch.
- **Cross-task consistency (F meta-level):** runtime-probe, bundle-v1, and cold-review all independently report the same absence with the same evidence shape. **CONSISTENT.**

**Checklist dimensions — execution status:**

| Dimension | Status at v1 blocker-report |
|---|---|
| A. Format honesty | SKIPPED — inputs absent |
| B. Claim quality (C1-C10) | SKIPPED — inputs absent |
| C. Hidden pressure / recommendation language | SKIPPED — inputs absent |
| D. Completeness | EXECUTED AT META-LEVEL — every parallel task probed for target files; absence confirmed |
| E. Verify-list quality | SKIPPED — inputs absent |
| F. Internal consistency | EXECUTED AT META-LEVEL — cross-task consistency on absence claim: CONSISTENT |
| G. Framing bias | SKIPPED — inputs absent |
| H. Token-economy | SKIPPED — inputs absent |

**Process observation from the cold-review blocker-report:**

> "The plan's conditional Task 1 (blocker-gate) proved its worth. The plan-authoring-time existence probes flagged the absence; the plan was authored to handle either outcome; the execution-time re-probes confirmed the absence still holds; the blocker-report branch fired cleanly. **The plan itself is structurally sound** — that is a process observation, not a deliverable-strength observation, and it does not anticipate or constrain whatever the actual deliverables will eventually say."

**Operator action to unblock cold-review (per blocker-report):**

Three options, no recommendation:
- **(a)** Land the 3 deliverables on a branch the cold-review container can reach, then re-dispatch the cold-review task.
- **(b)** Re-point the kickoff's §1 paths to wherever the deliverables actually live, then re-dispatch.
- **(c)** If `origin/feat/prune-worktrees` is the actual source branch (per bundle-v1), merge/clone that branch's deliverables into a branch this container can reach, then re-dispatch.

## 4. DeepWiki MCP cross-check

**Provenance:** these queries were run by the host GLM session before this bundle task was dispatched; their results are recorded verbatim in the kickoff §1 Source 8 prose. The bundle copies that prose with attribution; it did NOT re-run DeepWiki in this container.

### 4.1 superpowers v6.2.0 (`obra/superpowers`)

- **No hook branches on `subagent_type`.** Confirmed.
- **SDD does template-based role partitioning** (controller obligation, not enforced). Confirmed.
- **No per-role token budget.** Confirmed.
- **`task-reviewer-prompt.md` carries "Do not crawl the broader codebase" + "Do not re-run tests"** as explicit context-omission rules.

### 4.2 Anthropic Agent Skills (`anthropics/anthropic-cookbook`)

- **Agent Skills has NO role-specific context budgets.** Confirmed.
- **NO role-tagged skills.** Confirmed.
- **NO per-role skill preload.** Confirmed.
- **Progressive disclosure is strictly load-on-demand by skill-relevance.** Confirmed.
- **Multi-agent orchestration in the cookbook still uses general progressive disclosure, not role-based filtering.** Confirmed.

### 4.3 Discrepancy (LOAD-BEARING — see §5 row 4)

DeepWiki says `re-review-prompt.md` is NOT present in v6.2.0 (claims v6.0.0 replaced it with `task-reviewer-prompt.md`). The deep-project-research task's local file inspection (S13.b) **proved it DOES exist** at `~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/skills/subagent-driven-development/re-review-prompt.md` (107 lines — note: deep-research report says 106; this is a 1-line discrepancy, not load-bearing). Opus should treat DeepWiki's claim as FALSIFIED by the local file evidence.

## 5. Contradictions to resolve (LOAD-BEARING)

Preserve BOTH sides. Opus decides. (5 rows pre-seeded in kickoff §5; no new rows added by §3 because substrate-doc C-IDs are not visible to this container.)

| # | Source A claim | Source B counter-claim | What Opus needs to verify |
|---|---|---|---|
| 1 | raw research **C5** ("no per-role branching in any hook") — `(host path: docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md)` | deep-research **S13.a**: `subagent_type:"implement-worker"` runtime dispatch documented at `docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md:71,103,141` — `(source: §3.2 of this bundle)` | Read the cited lines on host. Is it (i) per-role context dispatch (refutes C5), (ii) a different concept sharing the name "subagent_type" (does not refute C5), or (iii) generated at runtime by a skill rather than a hook (does not refute C5's "in any hook" claim)? |
| 2 | raw research **C5/C10** P5 file:line claim — "digest in `session-bootstrap.md` between markers" — `(host path: substrate doc 1)` | runtime-probe **P5 REFUTED** — "digest is inline-heredoc in `inject-session-bootstrap.sh:25-33`" — `(source: §3.1 of this bundle)` | Read `.claude/hooks/inject-session-bootstrap.sh` lines 25-33 directly on host (file IS in this branch). Confirm digest is in the heredoc, not in `session-bootstrap.md`. If confirmed, C5/C10's file:line citation is wrong — falsifying the falsifiable-claim framework's evidence-quality dimension. |
| 3 | raw research **C10** — "uniform digest = deliberate anti-drift" (2026-05-09 incident) — `(host path: substrate doc 1)` | operator's framing — "worker should not receive goal/architecture" (per-role context-shaping hypothesis) | This is a **fork, not a contradiction** — the bundle flags the tension. C10 says uniform digest is deliberate (anti-drift). The operator's framing says uniform context is the problem. Both could be true (uniform deliberate AND wrong) or mutually exclusive. Opus: surface as fork for fabla-prep, do not collapse. |
| 4 | DeepWiki — `re-review-prompt.md` NOT in v6.2.0 — `(source: §4 of this bundle, kickoff §1 Source 8)` | local file (deep-research S13.b) — `re-review-prompt.md` exists at `~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/skills/subagent-driven-development/re-review-prompt.md` (107 lines per kickoff / 106 per deep-research — 1-line discrepancy noted) — `(source: §3.2 of this bundle)` | DeepWiki FALSIFIED by local evidence. Opus reads the local file directly to confirm length + content. |
| 5 | addendum **C12** — v6.2.0 adds scoped re-reviewer (narrower context) — `(host path: substrate doc 4)` | addendum **C11** — actual worker payload is ~236 KB unfiltered — `(host path: substrate doc 4)` | re-reviewer scope-narrowing is INSIDE SDD only; doesn't affect the always-on load. Opus: does the addendum itself flag this tension, or does §3 of the addendum treat them as independent findings? |

## 6. Parked forks + candidate shapes (decision space)

### 6.1 Parked forks

`(host path known: docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md §Parked forks + docs/meta-factory/research-patches/2026-07-27-per-role-context-addendum-fresh-2026.md §NEW forks — operator pastes both into CC)`

- **5 parked forks** from the raw research patch (substrate doc 1).
- **2 NEW forks** from the addendum (substrate doc 4).
- **Total: 7 forks.** Operator: paste substrate docs 1 and 4 into CC for Opus to read the 7 forks verbatim. The bundle deliberately does NOT copy them — Opus reads the original to preserve the patches' neutral framing.

### 6.2 Candidate shapes (α-σ)

`(host path known: docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md — operator pastes into CC)`

The candidate-shapes catalogue (substrate doc 2) carries **18 candidate shapes (α-σ) neutrally described**. Operator: paste the catalogue into CC for Opus to read all 18 shapes. The bundle deliberately does not copy them — Opus reads the original to preserve the catalogue's neutral framing.

## 7. What this bundle does NOT do

- Does NOT pick a candidate shape.
- Does NOT resolve forks.
- Does NOT filter "wrong" findings — contradictions preserved.
- Does NOT recommend next steps for Opus.
- Does NOT pre-load the fabla's framing.
- Does NOT modify any prior deliverable, code, rule, script, or parallel-task output. Copy/summarize only.
- Does NOT filter — if a finding looks wrong, copy it anyway with a "(unverified)" note. Opus filters.

## §Self-application note (per kickoff §3)

This bundle's own output is part of the surface but is not audited by itself. The bundle acknowledges:

- It is a **narrowed-scope v4 assembly** — the 3 task outputs (sources 5-7) are carried verbatim/summarized from sibling worktrees (a strictly-better fallback than kickoff §4's API-placeholder path); the 4 substrate docs are cited by path with host-read instructions. The departure from kickoff §1's expectation is disclosed in the Reachability audit at the top.
- The 5 §5 contradictions are the load-bearing content; Opus reads them with the original sources at hand.
- The bundle's framing has not been pre-loaded by Opus or fabla — the §7 "what the bundle does NOT do" list is preserved verbatim from the kickoff.
- v3 (`feature/scripts-e48ece`) and v1 (`feature/scripts-73519b`) prior bundle attempts exist as sibling worktrees; v4 (this bundle) is strictly richer than v3 because the 3 task outputs were unreachable at v3 time but reachable now via sibling worktrees.

## See also

- **Plan (`@`-override):** `.ai-factory/plans/scripts.md` — high-level summary plan
- **Plan (branch-named, detailed):** `.ai-factory/plans/feature-scripts-98b1e2.md` — Phase 0-6 task decomposition
- **Kickoff:** dispatch description for this task (handoff task `98b1e249-0ed3-44d2-a555-2c5f86b1dddf`)
- **Sibling runtime-probe report:** `/home/www/rules-as-tests-aif-feature-scripts-f164e8-f164e807-191a-4336-9fe1-52145255c00e/per-role-context-runtime-probe-report.md`
- **Sibling deep-project-research report:** `/home/www/rules-as-tests-aif-feature-scripts-f4dc0b-f4dc0bff-37c6-4662-abab-5c67c9a646b6/per-role-context-deep-research-report.md`
- **Sibling cold-review report (v1 blocker form):** `/home/www/rules-as-tests-aif-feature-scripts-4e73e5-4e73e54e-da1f-44a8-979e-209013a9e6cd/per-role-context-cold-review-report.md`
- **Prior v3 bundle (sibling):** `/home/www/rules-as-tests-aif-feature-scripts-e48ece-e48ece7a-bed9-4918-935b-4975372064ea/per-role-context-bundle-for-opus-in-cc.md`
- **Prior v1 bundle (sibling):** `/home/www/rules-as-tests-aif-feature-scripts-73519b-73519b9c-f27e-4bd2-b0b6-002bedcebdbb/per-role-context-bundle-for-opus-in-cc.md`
