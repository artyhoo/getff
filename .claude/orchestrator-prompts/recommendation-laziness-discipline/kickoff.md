# KICKOFF — recommendation-laziness-discipline (R-phase)

> **Type:** R-phase (research + design). Output = ONE research-patch design doc + binding scope for I-phase rule/hook ship.
> **Origin:** 2026-05-24 session (sub-wave G dispatch + post-dispatch maintainer dialogue). Maintainer pattern-recognition: «жёсткий антипаттерн который я постоянно ловлю у тебя». **3 events / 4 claims in one session** (D-G-1 fabricated keyword-filter recommendation + mirror false-alarm + this very kickoff's §1.3 wrong `additionalContext` Stop-hook field + §1.2 `claude-code-guide` Worker-reachability assumption — both fixed inline after T19 cold-QA), **all under H1 reminder which is literally injected each prompt submit** (`.claude/hooks/inject-session-bootstrap.sh:11`). The third event is structurally recursive: it occurred IN THE KICKOFF DESIGNED TO PREVENT IT.
> **Base branch:** staging.
> **Parallel-safe with:** F.3 (zero file overlap — F.3 touches `.claude/skills/meta-orchestrator/**` + `helpers/**` + `templates/**` + slot-18 principle test; this kickoff targets `.claude/rules/**` + `.claude/hooks/**` + slot-19+ principle test).
> **Authority:** maintainer 2026-05-24 — структурное усиление, не блокер F.3.

---

## §-1 RE-VERIFY THIS KICKOFF FIRST (mandatory, before any execution)

1. **Read this kickoff cold** — pretend you didn't write it.
2. **Verify factual claims:**
   - H1 reminder location: `grep -n "Recommendation discipline" .claude/hooks/inject-session-bootstrap.sh` → confirms line 11.
   - T11/T12/T19 surface-mismatch claim: read `.claude/rules/ai-laziness-traps.md` §2 T11/T12/T19 — confirm each is framed for R-phase/kickoff/handoff, NOT inline-chat recommendation.
   - 2/2 incidents in origin session: not independently verifiable post-session — trust maintainer pattern-recognition (T-RLD-C below caveat).
   - T20 reservation: `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_stryker_mutation_hardening_done.md` — confirm Stryker «over-eager equivalent dismissals» queued for T20 codification.
3. **Spawn 1× Opus cold-reviewer subagent** per orchestrator skill (`~/.claude/skills/orchestrator/SKILL.md`) Phase -1 default. Focus: T11/T12/T15/T16/T19 + T-RLD-A/B/C below; check whether kickoff itself violates H1 (it MUST cite evidence for every claim).
4. **GO → proceed to §1. REVISE → fix kickoff, re-review. Max 3 iter → escalate.**

---

## §0 Context (the gap)

**Current channel coverage for «verdict-without-evidence» pattern:**

| Channel | Mechanism | Surface covered | Surface NOT covered |
|---|---|---|---|
| Always-on digest | `inject-session-bootstrap.sh:11` H1 reminder, every prompt submit | All AI output (passive) | — |
| Rule catalogue | `ai-laziness-traps.md` T11/T12 | R-phase / kickoff / capability-commit | **inline-chat verdict to maintainer** |
| Rule catalogue | `ai-laziness-traps.md` T19 | own cold-QA before handoff (post-PR) | **mid-conversation recommendation** |
| Principle test | none | — | — |

**Gap:** the inline-chat surface is covered ONLY by passive always-on reminder, which empirically fails **(provisional — origin session only, 2/2 in single session = 100% violation rate within that session; §1.1 item 3 cold-scan across ≥5 stratified prior PRs will confirm-or-downgrade this rate before §1.3 mechanism selection)**.

**T11 vs new trap distinction:** T11 = «designing custom solution without checking external prior art» — applies to capability-commit / R-phase / mechanism design. The origin incidents are NOT custom-mechanism-design; they are **inline-recommendations-in-chat** (D-G-1: «use Option A», mirror false-alarm: «Worker missed §1.4»). Same root cause family (speak-before-verify) but distinct surface — pattern-matching them as «just T11 firing» would be T16 (`#pattern-matching-on-name`).

---

## §1 Scope of R-phase

R-phase produces ONE artifact: `docs/meta-factory/research-patches/2026-05-XX-recommendation-laziness-discipline.md`. Structure:

### §1.1 Evidence registry

Cold-scan + consolidate:

1. **Origin session incidents** (2026-05-24, sub-wave G + post-dispatch dialogue):
   - **Incident #1 (D-G-1):** orchestrator recommended «Option A keyword filter» for `launch-table-generator.sh` regex fix without running `grep` on the actual kickoff corpus. Maintainer pushback («не лень ли это?») triggered evidence-check that **reversed** the recommendation to Option B (awk). The verifying grep showed Option A regex `[A-D]|[0-9]+` doesn't match real sub-waves G/F.1/F.2/F.3 in this very project.
   - **Incident #2 (mirror false-alarm):** orchestrator flagged «Worker missed mirror divergence 500↔107» without reading the companion research-patch §1.4. Verification showed Worker DID document it as intentional (consumer = condensed teaser by-design). Same speak-before-verify pattern, opposite direction.

2. **Memory `feedback_*` entries** with verdict-discipline content: list each + extract pattern.
3. **Cold-scan of older PRs** for «verdict reversed after maintainer pushback» pattern — sampling floor 5 PRs minimum (T1). **Population-enumeration FIRST (T10):** run `gh pr list --state merged --limit 100 --json number,title,createdAt | jq length` to count total population; then **stratify** (do NOT default to «most-recent 5» — T9). Suggested stratification: ≥2 PRs from pre-H1-reminder era (before commit shipping `inject-session-bootstrap.sh:11`), ≥2 from post-H1 era, ≥1 random sample across full population. Record stratification choice + population N in research-patch §1.1.
4. **Maintainer-stated pattern** («постоянно ловлю»): treat as ONE input, not entire truth (T-RLD-C below).
5. **Existing T11/T12/T19 + H1**: enumerate why each fails to catch this surface (mechanism + reach gap).

### §1.2 Prior-art search (per build-first-reuse-default.md §3)

Six-layer search BEFORE proposing any mechanism:

1. **SSOT consult:** `docs/meta-factory/prior-art-evaluations.md` — grep on «verdict / recommendation / evidence / discipline / inline / chat».
2. **DeepWiki ≥3 phrasings:** «AI agent verdict-before-evidence discipline», «LLM recommendation grounding mechanism», «chat agent claim-without-citation prevention».
3. **WebSearch ≥3 phrasings:** «AI hallucination prevention inline recommendation», «LLM grounding check before verdict», «claude code recommendation discipline hooks».
4. **`claude-code-guide` subagent** — the inaccessibility memory entry `feedback_claude_code_guide_worker_inaccessible.md` was documented for `subagent_type: general-purpose` Workers; reachability from Mode A inline Agent (this dispatch) is INCONCLUSIVE. **Worker MUST attempt the subagent call and report `claude-code-guide reachable: yes/no/INCONCLUSIVE` in research-patch §1.2**. Regardless of reachability, WebFetch + DeepWiki are PRIMARY (dual-channel for any hook-contract claim, T12); claude-code-guide is third-channel triangulation when available.
5. **WebFetch primary docs** for Stop hook contract: `https://code.claude.com/docs/en/hooks.md`. **Known docs-truncation:** the Stop hook section is truncated in WebFetch excerpt per memory `project_eot_hook_redesign_approved` — Stop hook contract `reason→model next turn` rests on empirical + prior-art (existing `.claude/hooks/end-of-turn-reminder.sh` Stop hook in this repo). Do NOT cite the fetchable «`reason` … Not added to context» row — that row is **UserPromptSubmit-scoped**, NOT Stop (misattribution caught in 2026-05-22 BFR wave).
6. **This repo:** `phase-research-coverage.md §1.7`, `reviewer-discipline.md §2`, `dual-implementation-discipline.md` — adjacent disciplines; what overlaps?

### §1.3 Mechanism design (channel selection per rule-enforcement-channel-selection.md)

Two-axis analysis:

- **Detectability axis:** is «verdict word + no preceding evidence-bearing tool call in this turn» mechanically detectable? Evidence: regex on agent's final message for verdict tokens («рекомендую/recommend/use/pick/ADOPT/REJECT/DEFER/BUILD/should/лучше/выбираем») + scan turn's tool_use sequence for `Bash|Read|Grep|Glob|WebFetch|WebSearch` presence. If verdict-word present AND no evidence-tool in turn → likely violation.
- **Breadth axis:** always-on already exists and fails. Options:
  - **(A) Strengthen H1 wording** in `inject-session-bootstrap.sh` (still always-on, but stronger). **Falsifier:** wrong if 2/2-under-existing-H1 means content strength is not the binding constraint — channel is.
  - **(B) Stop-hook scan** of agent's final message → if verdict-without-evidence detected, emit Stop-hook output with `decision:"block"` + corrective text in `reason` field (which **reaches the model next turn** per `project_eot_hook_redesign_approved` memory + existing `.claude/hooks/end-of-turn-reminder.sh` prior-art-in-repo). **NOT `additionalContext`** — that field is for UserPromptSubmit/PostToolUse hooks, not Stop. Mechanically deterministic, post-hoc but pre-next-turn. **Falsifier:** wrong if Stop hook cannot read current-turn tool_use history from hook context — must verify by inspecting actual Stop hook input schema (per CC hooks contract via WebFetch + existing `end-of-turn-reminder.sh` source which reads `transcript_path` from input JSON then greps for `tool_use` via jq, T12). Wrong if `decision:"block"` on Stop is not allowed (it is, per #81 fix — see `project_eot_hook_redesign_approved`).
  - **(C) New trap T20/T21** in `ai-laziness-traps.md` (catalogue extension) + companion principle test once incident count ≥3. **Falsifier:** wrong if rule-catalogue extension without enforcement channel = just more prose drift (Class C rules dominant rate).
  - **(D) Combination:** A+B+C (defense in depth) vs single-channel.

Per [rule-enforcement-channel-selection.md §3](../../rules/rule-enforcement-channel-selection.md):
- judgment rule → injection, not gate
- reliability: deterministic matcher ≳ always-on > semantic > memory
- never terminate at memory

### §1.4 Binding I-phase scope (output)

Exact list of edits I-phase must make. Per item: file path / WHAT (with quote) / WHY (which §1.1 evidence) / falsifier / owner (agent-can / maintainer-only).

Pre-committed constraints:
- **NOT touch `.claude/settings.json`** — agent-uncommittable per `feedback_settings_json_agent_uncommittable`. Any new hook entry there is **maintainer-applied**, agent delivers the snippet only.
- **Slot collision:** F.3 takes principle slot 18. Slot 19+ free for this discipline if promoted.
- **T-number:** TBD. **MUST check both:** (a) `.claude/rules/ai-laziness-traps.md §2` highest T-number currently in file; (b) memory `project_stryker_mutation_hardening_done.md` — confirms Stryker «equivalence-claim-without-evidence» trap is queued for T20 codification. If Stryker T20 ships before this discipline lands, this kickoff's trap takes T21+. Surface as DECISION-NEEDED with both candidate slots cited.

### §1.5 Out-of-scope items

Fork future R-phases for:
- Detector hardening if false-positive rate >10% after I-phase ships (e.g. verdict-word in QUOTING maintainer is not a violation).
- Cross-skill propagation (if pattern fires for Worker subagents too, not just orchestrator).
- Memory-codification audit re-run including this trap as new scan dimension.

### §1.6 §1.7 self-reflexive check

Forward-check: does this research-patch comply with:
- [build-first-reuse-default.md](../../rules/build-first-reuse-default.md) §3 (≥3 DeepWiki + ≥3 WebSearch + SSOT consult before proposing mechanism)?
- [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) (any proposed mechanism = deterministic, no paid LLM call in CI)?
- [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md) (research-patch carries Class + Authoritative-for header per §3)?
- [rule-enforcement-channel-selection.md](../../rules/rule-enforcement-channel-selection.md) §3 (channel selection procedure followed explicitly)?

Backward-check: does this research-patch silently supersede:
- `ai-laziness-traps.md` T11/T12/T19 (no — extends to new surface, not replaces)?
- `inject-session-bootstrap.sh` H1 reminder (no — augments, falsifier explicit if H1 wording change is the binding lever)?
- Any earlier verdict-discipline memory entry? List candidates.

---

## §2 Dispatch mode

| Aspect | Choice | Rationale |
|---|---|---|
| Mode | A (inline Agent on Opus; model=opus explicit) | R-phase, no merge-conflict surface |
| Roles | research + reviewer (single Opus, reviewer-discipline §2 inline) | Cost-fit for R-phase scope |
| Skills auto-trigger | `rules-as-tests`, `build-first-reuse-default`, `requesting-code-review` | Match `recommendation-laziness-discipline` scope |
| Autonomous | Yes (no irreversible writes outside research-patch) | R-phase contract |
| Iterative-review | No initial; max 3 REVISE → escalate | Standard |
| Worktree | `isolation: "worktree"` (Worker creates branch + patch + commit + auto-merge to staging) | Per project convention |
| Cost estimate | ~60-90k Opus (smaller than G — narrower scope, less prior-art) | Single-track |

---

## §3 Acceptance criteria

R-phase is DONE when:

1. ✅ `docs/meta-factory/research-patches/2026-05-XX-recommendation-laziness-discipline.md` shipped (committed + PR'd to staging, auto-merge per repo flow).
2. ✅ §1.1 evidence registry contains ≥5 sampled prior-PR cases (T1 floor) with file:line/grep-output evidence + 2 origin-session incidents documented with kickoff-citation reference (§1.1 items 1–2) — origin-session incidents marked **INCONCLUSIVE-needs-human** for file-persisted evidence per §-1 acknowledgement («not independently verifiable post-session»). Optional: ship `references/origin-incidents.md` companion if grep-reconstructable artefacts found in transcript history.
3. ✅ §1.2 prior-art search: ≥3 DeepWiki + ≥3 WebSearch phrasings + SSOT consult + claude-code-guide query + WebFetch primary docs — all cited with evidence (T11/T12).
4. ✅ §1.3 mechanism design: per-option (A/B/C/D) verdict + falsifier + channel-selection rationale per [rule-enforcement-channel-selection.md §3](../../rules/rule-enforcement-channel-selection.md).
5. ✅ §1.4 binding I-phase scope: per-item WHAT/WHY/falsifier/owner.
6. ✅ §1.5 out-of-scope forks listed.
7. ✅ §1.6 §1.7 forward+backward applied with explicit rule citations.
8. ✅ Own cold-QA pre-handoff (T19) — re-read end-to-end, downgrade speculative findings to INCONCLUSIVE.
9. ✅ Russian for prose / English for paths/commands/code (project convention).

---

## §4 AI-laziness traps active

**Canonical from [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md):**

- **T1** — sampling floor = 5 (PR cold-scan).
- **T3** — every finding needs file:line + content quoted OR command + output OR INCONCLUSIVE-needs-human.
- **T4** — closing R-phase prematurely: §3 checklist completion ≠ adversarial counter-prompt at category level. After ticking §3 items, run «what category did I miss?» counter-prompt before declaring DONE.
- **T7** — adversarial counter-prompt at category level after each section.
- **T9** — sampling the easy surfaces: do NOT default to «most-recent 5 PRs». Pre-H1-reminder era PRs concentrate violations (§1.1 item 3 stratification mandatory).
- **T10** — reporting completeness based on what you LOOKED at, not what EXISTS: §population-enumeration BEFORE §sampling in §1.1; without population N, «sampled 5, found N» is meaningless.
- **T11** — designing without prior-art search: §1.2 mandatory before §1.3.
- **T12** — skip lit-sweep «I know hooks»: dual-channel verify (`claude-code-guide` if reachable from Mode A inline + WebFetch primary) for ANY hook-contract claim.
- **T15** — self-application: §1.6 §1.7 forward+backward; AND the research-patch itself must obey H1 (every verdict in it carries evidence).
- **T16** — pattern-matching-on-name: do NOT treat «this is just T11» — surface mismatch matters; explicit «Existing T11 problem class: X. Our problem class: Y. Match? Evidence: …».
- **T19** — own cold-QA pre-handoff before declaring DONE.

**Domain-specific T-RLD family:**

- **T-RLD-A** — «more reminders fix it»: tempting verdict is «strengthen H1 wording». But 2/2 under existing H1 means **channel** may be the constraint, not content. §1.3 Option A must carry this falsifier.
- **T-RLD-B** — «principle test is the answer»: tempting jump to «slot 19 principle test». But promotion criterion per `ai-laziness-traps.md §5` requires «2+ wave-specific T-additions describing same failure mode» — we have 2 incidents in 1 session, not 2 traps in 2 waves. Surface as Class C with explicit incident-counter promotion criterion, NOT auto-promote to A.
- **T-RLD-C** — «maintainer-stated pattern as proof»: maintainer's «постоянно ловлю» is ONE input. R-phase must surface cold-scan evidence (sampling floor 5 PRs) showing rate, not parrot maintainer pattern-recognition without independent measurement.

---

## §5 Stop conditions

- **S1** — Prior-art search surfaces mature upstream mechanism (e.g. Anthropic-published «verdict scan» hook example): ADOPT verbatim, §1.3 collapses to single-option dispatch.
- **S2** — §1.1 cold-scan finds 0 historical instances (only 2 origin-session) → INCONCLUSIVE rate; DEFER mechanism design, ship trap-only (Class C) with explicit «escalate to mechanism on 3rd incident» trigger.
- **S3** — Stop hook cannot read current-turn tool_use history (per WebFetch primary docs) → §1.3 Option B mechanically infeasible; collapse to A+C.
- **S4** — Patch >500 LOC → split into companion `references/<topic>.md` (per G precedent).
- **S5** — DECISION-NEEDED surfaces (T-number selection, F.3-conflict file) → DEFER to maintainer per [reviewer-discipline.md §2](../../rules/reviewer-discipline.md).
- **S6** — REVISE > 3 → escalate.

---

## §6 Anti-scope

- ❌ NOT ship the mechanism in this R-phase (R = design, I = ship).
- ❌ NOT edit `.claude/settings.json` (maintainer-applied).
- ❌ NOT modify `.claude/hooks/inject-session-bootstrap.sh` in this R-phase regardless of §1.3 verdict (R = design only; I-phase makes all hook edits, Option A or B).
- ❌ NOT touch F.3 files (`.claude/skills/meta-orchestrator/**`, slot-18 principle test) — parallel-safe boundary.
- ❌ NOT auto-promote new trap to principle test (Class A) on 1-session evidence — Class C with promotion criterion only.

---

## §7 Recursive self-application

This kickoff IS subject to its own discipline:

- Every verdict in this kickoff carries citation OR is marked provisional. Audit: grep for verdict words in this file → each must have file:line or command-output backing within ±5 lines.
- The R-phase output (research-patch) must obey H1 even more strictly than this kickoff — it's the spec for the rule that disciplines the rule.
- I-phase mechanism, if it ships, MUST fire on its own author's future output (this orchestrator session and successors). T15 mandatory.

---

## §8 See also

- [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md) §2 T11/T12/T19, §5 promotion criteria
- [.claude/rules/rule-enforcement-channel-selection.md](../../rules/rule-enforcement-channel-selection.md) §3 channel selection
- [.claude/rules/phase-research-coverage.md](../../rules/phase-research-coverage.md) §1.7 self-reflexive
- [.claude/rules/build-first-reuse-default.md](../../rules/build-first-reuse-default.md) §3 prior-art mechanism
- [.claude/rules/doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md) §3 header
- [.claude/rules/no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) hard constraint
- [.claude/rules/reviewer-discipline.md](../../rules/reviewer-discipline.md) §2 surface-as-decision-needed
- [.claude/hooks/inject-session-bootstrap.sh:11](../../hooks/inject-session-bootstrap.sh) — current H1 reminder location
- [.claude/hooks/end-of-turn-reminder.sh](../../hooks/end-of-turn-reminder.sh) — existing Stop-hook prior-art-in-repo for §1.3 Option B (`decision:"block"` + `reason`, reads `transcript_path` for tool_use scan)
- Memory `project_stryker_mutation_hardening_done` — T20 reservation (Stryker «over-eager equivalent dismissals»)
- Memory `feedback_no_human_verification_ai_self_verifies` — adjacent discipline (AI self-verifies + re-verifies)
- Origin session — sub-wave G dispatch + post-dispatch maintainer dialogue 2026-05-24 (not file-persisted; this kickoff IS the codification)

---

## §9 Phase -1 amendments log

Cold-review (1× Opus, 2026-05-24) returned REVISE → applied:

- **B1 fix:** §1.3 Option B + §8 — replaced stale filename `eot-recap.sh` → actual file `end-of-turn-reminder.sh` (verified via `ls .claude/hooks/`). Added concrete mechanism note (reads `transcript_path` from input JSON, greps `tool_use` via jq) — confirms Option B mechanically viable (T12 dual-channel partial-verify).
- **B2 fix:** §3 criterion 2 — relaxed to mark origin-session incidents as **INCONCLUSIVE-needs-human** per §-1 acknowledgement; ≥5 prior-PR cases remain file:line-required.
- **M1 fix:** §1.1 item 3 — added population-enumeration FIRST (`gh pr list ... | jq length`) + explicit stratification (pre-H1 / post-H1 / random) preventing T9 + T10 violation. §4 — added T10 and T9 to active T-trap list.
- **M2 fix:** §0 — marked «2/2 empirically fails» as **provisional**, gated on §1.1 item 3 cold-scan confirm-or-downgrade. Per §7 self-application discipline.
- **M3 fix:** §6 anti-scope — removed conditional «if §1.3 verdict is B»; now unconditional «NOT modify hook in R-phase regardless of verdict».
- **Mi1 fix:** §4 — added T4 (R-phase premature-close).
- **Mi3 fix:** §1.2 item 4 — clarified `claude-code-guide` reachability INCONCLUSIVE for Mode A inline; Worker MUST report status; WebFetch+DeepWiki remain primary.
- **Mi4 fix:** absorbed into M1 stratification guidance.
- **T20-collision reinforced:** §1.4 — Worker MUST read both `ai-laziness-traps.md §2` highest T and Stryker memory before T-number selection.

**Mi2 (T-RLD-A folding) — deferred:** stylistic; T-RLD-A retained as separate label because §1.3 Option A falsifier and T-RLD-A serve different audience (mechanism-design rationale vs trap-catalogue entry).

**Residual risks acknowledged (not amended):**
- §1.3 Option B verdict-word regex false-positive ceiling — Worker MUST estimate ceiling IN research-patch §1.3 before Option B is recommended for I-phase (added implicitly via T4 «adversarial counter-prompt» + §1.5 reference). If ceiling >50% trivial-sentence match → escalate to S2 «mechanism design DEFER, ship trap-only».

Re-review verdict (Phase -1 step 5): pending. If GO → Worker dispatch per §2.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
