# aif-handoff-runtime-bridge-iphase — kickoff §12: Phase -1 amendments log (audit trail)

> Scope: extracted verbatim from [kickoff.md](kickoff.md) §12 on 2026-08-08 (600-line pre-commit gate; kickoff was 651 lines). Same filename-convention transient class as the kickoff itself. Content below is the unmodified audit trail.

**2026-05-29 round-1 Opus cold-review → REVISE → amendments applied by orchestrator pre-dispatch.**

Reviewer findings: 3 BLOCKER + 4 MAJOR + 4 MINOR. ROI: reviewer independently read `aif-handoff/packages/runtime/src/adapters/claude/index.ts:449` and surfaced that CLI transport is NOT the default — without this finding, ~360-460k Worker Opus would have built an adapter whose cost-safety property silently breaks at runtime.

| Finding | Location | Amendment applied |
|---|---|---|
| **B1** — SW-D must-cover lacks explicit `transport: "cli"` config step (CLI is not the default per `packages/runtime/src/adapters/claude/index.ts:449`) | §3 SW-D item 2 | Split item 2 into «Transport (load-bearing) + Auto-review strategy» two-part requirement; transport step now explicit + cites `packages/runtime/src/adapters/claude/index.ts:449`; verification command requirement added |
| **B2** — Worker base-branch unspecified; predecessor patches live on `staging` only (per `project_automerge_staging_plan` migration 2026-05-22), not `main` | §3 preamble | Added explicit «Worker base branch = `staging`, NOT `main`» + mandatory pre-flight `git ls-tree origin/staging` probe |
| **B3** — «reverse the DEFER ALL» framing overstated; only blocker (iii) partially addressed; (i)+(ii) remain empirical STOPs | §0 | Reframed to «Partial conditional reversal» + added explicit paragraph «conditional BUILD with STOP-gates, not verdict-clean reversal» |
| **M1** — `Prior-art:` trailer requirement missing for SW-B/C/D capability commits (`.husky/pre-push` will block) | §9 | Added explicit capability-commit `Prior-art:` trailer requirement paragraph citing relevant SSOT rows |
| **M2** — SW-A cost 50-70k tight for cli.ts + index.ts + 15-June billing source-find | §3 SW-A | Bumped to 70-100k; added explicit 15-June billing WebFetch source-find item |
| **M3** — Pre-A «git clone or WebFetch» ambiguous; clone is wrong tool | §3 SW-Pre-A item 2 | Replaced with specific `gh api repos/obra/superpowers/contents/skills/<slug>/SKILL.md` command + explicit «do NOT git clone» |
| **M4** — SW-C STOP conflates server-side topic-filter (CONFIRMED absent) with taskId-in-payload (likely present) | §7 SW-C STOP | Rewrote STOP to distinguish topic-filter-API absence from taskId-payload presence; client-side filtering = required pattern |
| MINOR — `packages/runtime-bridge/` workspace init not pre-stated | §3 SW-B | Added explicit workspace-init pre-step (package.json / tsconfig / workspace array / `npm install` verification) |
| MINOR — predecessor state.md path is in `meta-launch/` subdirectory | §11 | Deferred (preserved current cross-reference; future state.md path documented at dispatch time) |
| MINOR — `superset-sh` brainstorm-session reference lacks file:line | §3 SW-Pre-A item 4 | Deferred — Pre-A Worker may surface from `project_meta_orch_mode_triage_done` memory entry or skip with explicit rationale |
| MINOR — T17 «destructive delegation» weak fit for greenfield directory | §5 | Deferred — labeling is permissive; T17 counter-measure cost is near-zero |

**Round-2 cold-review (2026-05-29):** Opus reviewer verified round-1 closures (all 7 BLOCKER/MAJOR fixes CLOSED with file-line evidence) + flagged 2 amendment-introduced editorial gaps:

| Round-2 finding | Severity | Amendment applied |
|---|---|---|
| `Honest umbrella cost estimate` paragraph not updated after M2 SW-A bump (`A 50-70k` → should be `70-100k`; aggregate `360-460k` → `380-500k`; grand total `660-1160k` → `680-1200k`) | MAJOR (editorial; affects maintainer cost-ceiling awareness) | Updated §3 Honest umbrella cost arithmetic to reflect M2 + noted prior Phase -1 burn in §12 |
| §0 «Step 3b hope-path **confirmed**» contradicts §1 fact 2 (contingent) + §3 SW-D Step 3a (probe required) | MINOR (Worker short-circuit risk) | Replaced «confirmed» with «hypothesized — empirically verified by SW-D Step 3a probe» in §0 |

**Round-3 cold-review (2026-05-29):** Opus reviewer verdict **GO** (confidence: high). Both round-2 findings CLOSED with verbatim evidence quotes; no amendment-introduced regression; §12 audit-trail HONEST; no net-new BLOCKER/MAJOR scan. Orchestrator MAY dispatch SW-Pre-A.

**Round-4 amendment (2026-05-29, post-Pre-A brainstorm session):** Pre-A landed (PR #286, 432 lines, OPEN/MERGEABLE on staging) with 9-SP-KEEP-REFERENCE verdicts + ADOPT-candidate amux T16 ~55% + load-bearing **June 15 Agent SDK credit pool** discovery. Brainstorming session (this session) with maintainer concluded: orchestrator initially recommended Option B (defer/measure); **maintainer overrode**: «надо строить мост между оркестратором и aif-handoff/amux, и A и C; отказаться я всегда успею если не буду укладываться в лимиты; когда есть aif-handoff использовать его, когда нет — amux; при установке предлагать на выбор; в runtime тоже иметь выбор».

Round-4 restructures kickoff from single-backend (aif-handoff-only) to phased hybrid:
- §0 reframed: «Phased hybrid bridge supporting BOTH aif-handoff AND amux behind `RuntimeBackend` abstraction, with `ManualBackend` always-present fallback»
- §1 added 4th load-bearing fact (Pre-A + maintainer override)
- §3 restructured: Phase 1 (existing SW-A/B/C/D adapted for hybrid interface + ManualBackend) + Phase 1→Phase 2 decision point + Phase 2 (NEW SW-E/F/G/H amux, conditional)
- §3 added «Shared component spec» — `RuntimeBackend` interface + `ManualBackend` MVP + preference resolver + runtime opt-out (`RUNTIME_BRIDGE_MODE` env + `<!-- bridge: skip -->` marker)
- SW-A: `total_cost_usd` measurement added as load-bearing Phase 1→Phase 2 gate input
- SW-B: package renamed `runtime-bridge` (not `aif-handoff-bridge`); ManualBackend impl added; runtime opt-out tests added
- SW-D: scope narrowed to Phase 1 only (aif-handoff/skip 2-way); cost-cap consumer warning added
- §4 stage gates: branch names updated (`runtime-bridge` prefix); Phase 2 admission gates added
- §3 honest cost: recomputed for Phase 1 (~490-790k) + Phase 2 (~430-710k if triggered)

**Pre-dispatch state:** Round-4 amendment is the orchestrator-applied response to maintainer's directive. Phase -1 round-4 cold-review on this restructured kickoff is the next admission gate before SW-A dispatch.

**Cumulative Phase -1 cost across rounds 1-4:** ~280k (rounds 1-3) + Pre-A dispatch 171k + round-4 orchestrator edits ~6k + round-4 cold-review 38k actual = **~495k Opus** through end of Phase -1 round-4.

**Round-4 cold-review (2026-05-29):** verdict **REVISE** with 2 BLOCKER + 3 MAJOR + 3 MINOR. Findings + orchestrator fixes:

| Finding | Severity | Fix applied |
|---|---|---|
| **B1** — Pre-A patch on PR-branch (not staging) → SW-A pre-flight halt | BLOCKER | PR #286 manually merged 2026-05-29 via `gh pr merge 286 --merge`; verified `git ls-tree origin/staging` returns blob `bb34e319` for the Pre-A patch; §4 admission gate text rewritten to «Must return MERGED» + ls-tree probe |
| **B2** — 4 stale `packages/adapters/aif-handoff-bridge/` paths in §8 / §9 / Prior-art trailer + 1 stale `feat(aif-handoff-bridge)` PR-title pattern; hook-bypass risk on `Prior-art:` trailer regex | BLOCKER | Edit `replace_all=true` swept all `packages/adapters/aif-handoff-bridge/` → `packages/runtime-bridge/`; §9 PR-title pattern updated to `feat(runtime-bridge)` for B/C/D + added Phase 2 E/F/G/H title patterns |
| **M1** — §4 gate text «OPEN/MERGEABLE auto-merging» incoherent given disabled auto-merge | MAJOR | Rewrote to «Must return MERGED» + explicit ls-tree probe; noted orchestrator-applied manual merge in gate body |
| **M2** — §3 cost arithmetic «300-410k Workers (Pre-A 171k DONE + A+B+C+D)» miscounts | MAJOR | Relabelled as «Pre-A (already spent): 171k» + «Remaining Workers (A+B+C+D): 310-410k»; total recomputed |
| **M3** — SW-A item 3 «Worker must NOT re-fetch, cite Pre-A §6» fails without Pre-A on staging | MAJOR | Resolved by B1 fix (Pre-A now on staging, Worker can read directly) |
| **mn1** — §3 Pre-A `2026-05-XX` placeholder stale (Pre-A is DONE with real 2026-05-29) | MINOR | Pre-A `Output` line updated to actual filename + date |
| **mn2** — ManualBackend `awaitDone` no MVP timeout — unbounded poll loop | MINOR | Accepted as documented MVP limitation; SW-B item 7 paired-negative tests cover graceful degradation |
| **mn3** — §10 backward check did not acknowledge new `.claude/hooks/` + settings.json entry | MINOR | Added §10 backward bullet listing 4 new artefacts SW-B + SW-D create |

**Round-4 verdict updates:**
- `RuntimeBackend` abstraction: leaky-but-acceptable (ManualBackend semantic-differs from streaming backends; documented as expected degradation in SW-C item 6 + consumer docs)
- Phase 1→Phase 2 decision point: clearly-actionable (Branch a/b/c criteria specific enough; quantitative floor for «cost fits» = SW-A measurement × frequency vs $100/$200 cap)
- Load-bearing claims (June 15 Note box + Pre-A §6) re-verified — exact match against `code.claude.com/docs/en/headless` Note box; consistent with Pre-A §6 framing

**Cumulative Phase -1 cost through round-4 fixes:** ~495k + ~5k orchestrator edits = ~500k Opus. Round-5 delta-review (B1/B2/M1/M2/mn1/mn3 fix verification) estimated +30-50k → cumulative ~530-550k through round-5.

**Admission-gate-3 (Phase -1 cold-review) status post-round-4-fixes:** ✅ CLOSED via round-5 delta-review (GO, high confidence; all 6 round-4 findings FIXED, no regression). Round-5 also flagged 1 editorial MINOR (line 114 inline status «OPEN/MERGEABLE» — fixed inline before SW-A dispatch).

**Round-6 (SW-A → SW-B transition, 2026-05-29):**

- **SW-A round-1 ORPHAN** — background dispatch via Agent tool with `run_in_background:true` died ~6min after start (session-ID mismatch between dispatch session `3081517f` and continuation session). Worktree `../rules-as-tests-aif-sw-a` (branch `research/aif-handoff-cli-transport-verification`) left orphaned: clean working tree, no commits, no remote push, TaskOutput returns "no task found". Maintainer cleanup pending (`git worktree remove --force` + `git branch -D` — destructive, requires explicit approval).
- **SW-A round-2 SUCCEEDED** — synchronous (no `run_in_background`) dispatch from continuation session completed in ~11min, 95k Opus, all 10 VERIFY ✅. PR #289 MERGED to staging via auto-merge 2026-05-29 after CI green (22/22).
- **SW-A r2 hygiene gap (caught by orchestrator dual-channel verify, NOT by Worker self-review)** — patch §4 cites `/tmp/sw-a-r2-measurement.json` as evidence file for `$0.56598375 / 89,717 tokens` measurement, but post-dispatch inspection shows the JSON contains a FAILED retry (`"is_error":true, "result":"Not logged in"`) — original successful-run JSON was overwritten by Worker's second `claude -p` attempt. Substance defensible: orchestrator-side independent re-measurement returned `$0.45727825 / 89,716 tokens` (same task; cache-state delta explains $0.10 cost difference). Both numbers support same Phase-1→Phase-2 verdict ACCUMULATE-DATA. Hygiene gap = T3 evidence-file-clobber: forward-going future measurement dispatches MUST use timestamped non-overwritable paths (e.g. `/tmp/measurement-${session_id}-${timestamp}.json`) + double-write guard.
- **Phase 1 → Phase 2 trigger verdict (from SW-A r2 §5):** ACCUMULATE-DATA — single short-task measurement ($0.46-0.57 cold-start) fits Max 5x $100/mo at all realistic volumes with $20-25 headroom for heavy-task projection (Pre-A scale 171k tokens × 90/month ≈ $78-97). Real-usage data accumulates during Phase 1 deployment; Phase 2 amux trigger decision deferred to post-Phase-1-merge.

**SW-A → SW-B Phase -1 cold-review (condensed, 2026-05-29):** verdict **GO** (high confidence; ~18k Opus actual, ~90k harness-reported including subagent overhead). Reviewer returned 1 BLOCKER + 4 NEEDS-CLARIFICATION:

| Finding | Severity | Fix applied |
|---|---|---|
| **BLOCKER** — `packages/adapters/runtime-bridge/` doesn't match workspace glob `"packages/*"` (verified via `jq '.workspaces' package.json`); package would silently bypass `npm install`/typecheck/CI — the very failure mode SW-B workspace-init step warns about | BLOCKER | Edit `replace_all=true` swept all 9 occurrences of `packages/adapters/runtime-bridge/` → `packages/runtime-bridge/` (Reviewer option (a), lower blast radius vs widening root workspaces array). §12 audit-trail historical accuracy note: round-4 fix actually swept to `packages/adapters/runtime-bridge/`, not directly to `packages/runtime-bridge/` (line 596 was incorrect about its own destination); round-6 closes the final flat move. |
| NC-1 — `accept_existing_plan` MCP call shape unspecified; Worker has STOP escalation path but could waste cycles | NEEDS-CLARIFICATION | Added inline to SW-B item 3: «MCP schema discovery» bullet mandating `gh api .../packages/coordinator/src/mcp/` source-read or DeepWiki probe BEFORE implementing |
| NC-2 — `tsconfig.json extends root` ambiguous; no root tsconfig.json exists; existing packages use standalone tsconfig with no `extends` | accepted (Worker self-resolves) | Worker pattern-matches on `packages/core/tsconfig.json` peer convention — discoverable via `ls && cat`. No spec change. |
| NC-3 — SW-B item 5 doesn't explicitly forbid `.claude/settings.json` edit; Worker could waste tool call on deny-list collision | NEEDS-CLARIFICATION | Added inline to SW-B item 5: explicit «Do NOT edit settings.json» mandate + «output JSON snippet in PR body for maintainer-apply» direction |
| NC-4 — idempotency dedup-state storage location unspecified (`/tmp` cache vs state.md vs ...) | accepted (Worker self-resolves) | Worker picks; if `/tmp` chosen, dedup is per-session — acceptable for MVP. |

**Cumulative Phase -1 cost through round-6:** ~500k (round-4) + Phase -1 SW-A→SW-B review ~90k + round-6 orchestrator edits ~5k = **~595k Opus** through end of round-6.

**Admission-gate-3 (Phase -1) status post-round-6:** ✅ CLOSED for SW-A→SW-B transition. SW-B dispatch authorised.

**Round-7 (SW-B → SW-C transition, 2026-05-30):**

- **SW-B SHIPPED** — PR #290 MERGED to staging 2026-05-29T21:30:36Z. `packages/runtime-bridge/` landed with `backend.ts` (RuntimeBackend interface), `AifHandoffBackend.ts`, `ManualBackend.ts`, `resolver.ts` (preference resolver), `types.ts`, `kickoff.ts`, `idempotency.ts`, `cli/dispatch.ts`, `DESIGN.md`, `test/runtime-bridge.test.ts`, + `.claude/hooks/runtime-bridge-dispatch.sh`. Verified on `origin/staging` 2026-05-30.
- **NC-1 resolved (kickoff §3 SW-B item 3 updated this round):** `accept_existing_plan` does not exist; SW-B shipped the `handoff_create_task(paused:true, plannerMode:"fast") + pushPlan + resume` workaround instead. Item-3 text corrected to record the actual mechanism.
- **SW-C dispatch authorised.** WebSocket status read-back replaces SW-B's placeholder `getStatus`/`awaitDone`. Worker base = `staging`. Heavy I-phase → dispatch **synchronously** (`run_in_background:false`) per SW-B crash-twice lesson (state memory item 4). Schema-discovery-first mandate added to dispatch prompt (NC-1-class de-risk: re-verify aif-handoff WebSocket event shape + taskId-in-payload presence BEFORE implementing; predecessor SW-A already CONFIRMED broadcast-pattern + taskId-present, so this is T13 re-confirm not greenfield).
- **Orphan worktree cleanup** still pending maintainer approval: `../rules-as-tests-aif-sw-a` (dead r1), `../rules-as-tests-aif-sw-a-r2` (#289 merged), `../rules-as-tests-aif-sw-b` (#290 merged) — all destructive `git worktree remove --force` + `git branch -D`, surfaced not autopiloted.

**Stop-hook citation re-verification (2026-05-29 session-close):** orchestrator independently re-fetched the cited file via `gh api repos/lee-to/aif-handoff/contents/packages/runtime/src/adapters/claude/index.ts` and confirmed line 449 reads `const transport = input.transport ?? RuntimeTransport.SDK;` ✓. The same `?? RuntimeTransport.SDK` default pattern repeats at lines 334, 367, 406, 422, 434, 508 throughout the same file — embedded discipline, not isolated. The reviewer's load-bearing citation is VERIFIED. **Path correction applied:** round-1/2 reports said «`index.ts:449`» (truncated); the actual file path is `packages/runtime/src/adapters/claude/index.ts:449` (not `packages/runtime/src/index.ts` which is the runtime root). All 4 in-kickoff occurrences updated to full path so Workers do not look in the wrong file.

**Admission-gate-3 (Phase -1 cold-review) status:** ✅ CLOSED (round-3 GO, 3-iter cap not breached). **Combined with Gate 1 (PR #283 merged ✅) + Gate 2 (maintainer «/orchestrator» dispatch ✅) + Gate 4 (cli.ts commits in last 30d: 3 non-breaking changes — proxy env override, per-profile env, session-fork capability — none invalidate §3 SW-A premises; Gate 4 ✅ PASS).** All 4 gates closed; dispatch authorised.

**Cumulative Phase -1 cost (this round-1+2+3):** ~280k Opus tokens (round-1 reviewer ~113k + round-2 ~90k + round-3 ~62k + orchestrator loop ~15k). ROI: round-1 alone caught 3 BLOCKER (incl. silent cost-safety breach) + 4 MAJOR that would have wasted ~360-460k Worker Opus + manifest at runtime as subscription-term risk. Net ROI positive by ~80-180k Opus + risk-avoidance.
