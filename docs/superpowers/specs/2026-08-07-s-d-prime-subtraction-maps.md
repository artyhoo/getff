# S-D′ — per-seat subtraction maps

> **Stage:** S-D′ of the arch-v2-context-pipeline umbrella (rev 8 kickoff, DISPATCHABLE).
> **Authoritative for:** the subtractive half of SSOT #234 — what each CC seat class STOPS loading.
> **NOT authoritative for:** the additive half (per-role ambient content) — SSOT #234's DEFER/null
> stands for that scope. Project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Source SSOTs (read in full before authoring, cited per §3):**
> [`2026-08-06-pipeline-token-economy-design.md`](./2026-08-06-pipeline-token-economy-design.md)
> §0.5 (priority ordering) · §0.6 (agnosticism) · §1.5 (reopen) · §1.6 FORK B/E · P13;
> [`2026-07-31-arch-v2-context-pipeline-design.md`](./2026-07-31-arch-v2-context-pipeline-design.md)
> ADR-1 · ADR-2 (C2: custom subagent system prompt REPLACES CC's) · ADR-8.
> **Dependency inputs (verified merged + content-read, §3 two-gate):** S-E (#1237, fixed
> per-file meter), S-H (#1239+#1249, P3d injector + P11 Explore/Plan), S-L (#1263, re-priced
> P14 ranking — §5 binding: re-derive, do NOT multiply-through).
> **Descoped (kickoff §5 Option A):** ADR-8 A/B evaluation arm. A PR with no evaluation arm
> is **conformant**, not incomplete. The arm is re-homed to the §6 follow-on stub.

## §0 Measurement basis

### §0.1 INPUT CONDITION — BASELINE SNAPSHOT (PARKED)

The kickoff header INPUT CONDITION requires a host-side per-turn billing-projection snapshot
captured **before** any worktree prune, cited by this stage's before/after measurement. **That
snapshot does not exist** in this repo:

- `git branch -a | grep -iE 'data|metric|billing|snapshot|baseline'` — no matching branches
- `find . -name '*billing*'` — no matching files
- `~/.claude/` — no billing/snapshot/baseline entries
- The `origin/data/metrics` reference in the kickoff describes the SHAPE to mimic (one CSV row
  per day on a data branch, outside the main history — a CI cron in the source repo for that
  other project), **not an artifact in this repo**

**PARK rationale (≥20 chars per §3 escape-token standard):** "snapshotter-authoring stage not
yet dispatched; no host-side billing-projection artifact exists in this repo to cite."

Per kickoff §3a, a missing input is NOT a fork — the rest of the map proceeds. The map's
before/after figures therefore cite **S-H/S-L measured per-seat figures as the BEFORE baseline**
(corpus state at S-H measurement, 189 transcripts / 65 project dirs), and the post-stage AFTER
is "projected subtraction if every recommended drop ships." **A reader must NOT treat the
before/after delta as a re-derived billing figure** — it is a per-block subtraction sum against
S-H/S-L's measured baselines, not a fresh corpus measurement. DECISION-NEEDED surfaces in the PR
body: "baseline snapshot precondition unmet — map's before/after cites the per-block measured
figures, not a pre-prune corpus snapshot."

### §0.2 Repo-side always-on resident set (S-E fixed per-file meter)

Source: `bash scripts/measure-always-on.sh` → 5-file resident set, **48,679 B total**.

| File | Bytes | Tier-0? | Notes |
|---|---:|---|---|
| `CLAUDE.md` | 22,605 | n/a (settings-loaded, not a rule) | Content-trim owned by S-G — this stage does not edit |
| `.claude/rules/build-first-reuse-default.md` | 12,667 | **Tier-0** | Swap candidate (see §3.1) |
| `.claude/rules/ai-laziness-digest.md` | 6,703 | **Tier-0** | Swap candidate (see §3.1) |
| `.claude/rules/00-rule-index.md` | 4,075 | **Tier-0 (generated)** | Cannot drop — regen target, not authored content |
| `.claude/rules/attention-is-not-a-mechanism.md` | 2,629 | **Tier-0** | Swap candidate (see §3.1) |
| **Total always-on** | **48,679** | | |

Currently active `claudeMdExcludes` (per `.claude/settings.json`): 7 entries — `egress-no-api-bypass.md`, `memory-codification.md`, `recommendation-laziness-discipline.md`, `reviewer-discipline.md`, `autonomous-loop-continuity.md`, `git-conflict-merge-forward.md`, `cold-seat-economy.md`. These rules are **not** in the resident set. 17 further rules carry `paths:` frontmatter (read-time-scoped, not always-on).

**No additional root-level CLAUDE.md-class files exist** to exclude (`find . -name CLAUDE.md -not -path './node_modules/*' -not -path './.git/*'` → only root CLAUDE.md + a worktree copy). One root `AGENTS.md` exists; it is the rendered rule-index carrier, not operator-excludable without breaking the regen contract.

### §0.3 Harness-side per-seat blocks (S-L re-derived ranking — binding)

S-L §5 binding: **"A re-ranking is not a rescale — S-D′ must re-derive rather than multiply
through."** S-L §3.1's billed-but-/context-uncounted rows, re-derived by content-shape (NOT
flat 4 B/tok), per seat, every seat, regardless of operator input:

| Block | Codepoints (cp) | Est-tokens (band @ 1.835–3.128 cp/t) | /context status | Source |
|---|---:|---:|---|---|
| `skill_listing` (.content) | 26,696 | **8,870 — MEASURED, not converted** (`/context` per-entry token sum) | COUNTED as `Skills 8.9k` | S-L §2.2 (`2026-08-07-s-l-recalculation.md:244,269`) |
| Both hook injects (combined) | 6,853 | ~2,191–3,735 | ONE counted as `Messages 1.3k`, OTHER uncounted | S-L §2.3 (`:288`); S-H §5 (`2026-08-07-s-h-turn-attribution-p3d-p11.md:336`) |
| `agent_listing_delta` (.addedLines) total | 5,433 | ~1,737–2,961 | PARTIAL — only orchestrator-planner (3,128 cp) counted as `Custom agents 1k`; built-in agent descriptions 2,305 cp uncounted | S-L §2.2 (`:242,276`) |
| `deferred_tools_delta` (.addedLines) | 4,075 | ~1,303–2,221 | UNCOUNTED | S-L §2.1 (`:241`) |
| `mcp_instructions_delta` (.addedBlocks) | 3,741 | ~1,196–2,039 | UNCOUNTED | S-L §2.1 (`:243`) |
| `hook_additional_context` | 3,381 | ~1,081–1,843 | Candidate for `Messages 1.3k` | S-L §2.3 (`:240`) |
| `hook_success` (UserPromptSubmit, .content) | 1,721 | ~550–938 | Candidate for `Messages 1.3k` | S-L §2.3 (`:245`) |

**Top-3 priced harness-side blocks (kickoff §4 T-SDP-A counter — maps ordered largest-first).**
Every row above is measured in the SAME channel (codepoints) and therefore converts with the
same divisor, so the ordering is **band-invariant** — it is the ordering of the cp column:
1. `skill_listing` — 8,870 tok measured (4.9× any other message-stream row, S-L §5)
2. Both hook injects — 6,853 cp ≈ ~2,191–3,735 tok combined
3. `agent_listing_delta` total — 5,433 cp ≈ ~1,737–2,961 tok (built-in-agent descriptions subset 2,305 cp ≈ ~737–1,256 tok is the addressable trim, since orchestrator-planner is operator-defined)

**Conversion constant falsified (S-L §1.2/§1.4).** The operative figure is a **band, never a
point** — S-L measured **bytes 1.835–3.416 B/tok** (1.86× spread) and **codepoints
1.835–3.128 cp/tok** (1.70× spread), and §1.3 binds the unit to the channel: a `wc -c` input
reports B/tok, a transcript/JSON input reports cp/tok, and **no ratio may be taken across
units**. Direction inside the band: **dense ASCII pipe-table content sits at the LOW end
(1.835 in both units)**, Cyrillic-rich prose at the HIGH end (**3.416 B/tok**; in the codepoint
channel the top of the band is 3.128, from the ASCII-prose custom-agent entry, with the
Cyrillic-rich skill listing at 3.010 cp/tok — the byte unit's extra spread measures Cyrillic,
not token cost). A flat 4 B/tok point estimate **understates** token counts by 1.17×
(Cyrillic-rich) to 2.18× (dense ASCII) — it is a floor, not an estimate. Every figure in this
spec is therefore re-derived as a band in its own channel's unit, per S-L §1.6.

### §0.4 FORK E mandatory injector block (S-H P3d, confirmed by S-L)

| Hook | Per-firing B | Per-firing est-tokens (band @ 1.835–3.416 B/t) | Trigger | Cache | Source |
|---|---:|---:|---|---|---|
| `inject-session-bootstrap.sh` (UserPromptSubmit) | **1,760 B** | **~515–959** (payload is ASCII-dominant → true value near the LOW divisor, i.e. the HIGH token end) | per-prompt (1 per ~24 turns) | **NONE** — every firing is fresh injection | S-H §5 (`s-h-…:329,335`); S-L §1.6 (`s-l-…:184-186`) |
| `inject-subagent-digest.sh` (SubagentStart) | **1,866 B** | **~546–1,017** (same direction of error) | per-subagent-spawn | **NONE** | S-H §5 (`s-h-…:330,336`); S-L §1.6 (`s-l-…:184-186`) |

**Raw injected volume (S-H §5, corrected figure):** **~17.3 KB per session** — 1,904
`UserPromptSubmit` firings / 189 session transcripts = 10.07 firings per transcript × mean
1,721 B, with no session cache (`2026-08-07-s-h-turn-attribution-p3d-p11.md:352-361`).
**The ~53 KB/session figure this spec previously carried is the falsified pre-measurement
estimate** — it assumed one injection per assistant *turn*; the hook fires per *prompt*
(1,904 firings against 46,462 turns = one per ~24 turns), so the magnitude was **overstated
~3×** and is superseded by ~17.3 KB (same source, `:356-361`).

**Residency-weighted cost (S-H §5):** the injector costs **77,008 weighted units per session
transcript** (14,554,534 / 189), against P5a's ~6,325 units — the injector is **≥~12× the P5a
lever** (`s-h-…:363-367`). **This ratio survives the band** and is the one figure here that is
not re-derived: numerator and denominator are both `bytes ÷ 4 × residency`, so a common divisor
cancels (S-L §1.6's «band-invariant — a ratio of two figures sharing the conversion»,
`s-l-…:189-191`). Under *per-content* divisors it moves **upward**, not down: the injector
payload is ASCII-dominant (≈1.835 B/tok) while P5a's target `CLAUDE.md` measures 2.553 B/tok
(S-L §1.1), which would put the ratio nearer ~17×. **~12× is therefore a floor, not a point.**

**Counter-argument carried in this row per kickoff §1 item 1:** per-prompt re-injection is the
digest's **compaction-resilience purpose** — the digest exists *because* CC's compaction window
drops ambient context, so re-injecting on every prompt restores what compaction removes. A
naive once-per-session cache therefore defeats the digest's purpose unless the cache invalidates
on compaction boundaries. Any proposed-diff must name the invalidation trigger.

## §1 Population table (ADR-2)

Per ADR-2, every mechanism row below names its behaviour on each population row:

| Population | rulesAutoload / `paths:` | agent system-prompt (C2: REPLACES CC's) | hook-inject `UserPromptSubmit` | hook-inject `SubagentStart` | `claudeMdExcludes` | `skill_listing` |
|---|---|---|---|---|---|---|
| **CC main seat** (Fable/Opus) | loads always-on + paths-matching | n/a (no agent-definition) | fires per-prompt | n/a | applies (project ∪ local) | loads all listed skills |
| **CC subagent seat** (Explore/Plan, custom agents) | harness subtracts per S-H P11 (Explore 26,659 tok / Plan 26,783 tok / control 62,340 tok — verified no rules / no CLAUDE.md) | REPLACES CC's resident context entirely (ADR-2 C2) | n/a | fires per-subagent-spawn | n/a | loads (varies by seat) |
| **aif-container seat** (executor-tier GLM) | depends on profile config; this stage's Tier-0 set ships into the container's `.claude/` mount | agent-definition REPLACES per ADR-2 | fires per-prompt | fires per-subagent | applies via container's `.claude/settings.json` | loads via container's settings |
| **ZCode population** | **no `rulesAutoload` / `paths:` primitive** — Tier-0 delivered via SessionStart hook fallback (degradation documented; mechanism owned by `zcode-parity-doctrine.md`) | agent system-prompt replacement has **no ZCode equivalent** — documented degradation (ZCode carries no equivalent of CC's `agents/*.md` autoload) | fires (SessionStart channel twin per `dual-implementation-discipline.md`) | no ZCode equivalent — degradation documented | no ZCode equivalent — degradation documented | no ZCode equivalent — degradation documented |

**§0.6 agnosticism:** every mechanism row in §2-§5 below names its behaviour on each population
row of this table. Where a population row reads "no ZCode equivalent," that is the documented
degradation per ADR-2; per kickoff §3a(b), if a drop would be *silently* different on ZCode
rather than absent, that is a real fork — state both consequences and park. **No §2-§5 row
creates a silent ZCode divergence** (verified at row authoring); ZCode either receives the
drop via the SessionStart hook twin or has no equivalent, both documented in the row.

## §2 Senior main seat (Fable / Opus) — drop candidates

Per §0.5 priority ordering, the expensive seat first. The senior main seat's resident context
is the union of: §0.2 repo-side always-on (48,679 B) + §0.3 harness-side per-seat blocks + §0.4
FORK-E injector. There is no agent-definition for the main seat (it IS the harness's "no
agent" seat), so mechanism class (b) from kickoff §1 item 1 — agent-definition system-prompt
replacement — does not apply.

### §2.1 Row S-MAIN-INJ — Bootstrap injector (FORK E, MANDATORY block)

| Cell | Value |
|---|---|
| **cost** | 1,760 B (~515–959 est-tokens @ 1.835–3.416 B/t) per UserPromptSubmit firing + 1,866 B (~546–1,017 est-tokens) per SubagentStart firing; raw volume **~17.3 KB/session** (10.07 firings × 1,721 B — NOT the ~53 KB this spec previously carried, which assumed per-turn firing and was overstated ~3×, `s-h-…:352-361`); residency-weighted **77,008 weighted units/session ≥~12× the P5a lever** (band-invariant, see §0.4). Source: S-H §5 (`2026-08-07-s-h-turn-attribution-p3d-p11.md:329-330,336,352-361,363-367`); S-L §1.6 (`2026-08-07-s-l-recalculation.md:184-191`). |
| **reach** | CC main seat: yes (every prompt). CC subagent: n/a for UserPromptSubmit, yes for SubagentStart. aif-container: yes via container hooks. ZCode: yes via SessionStart hook twin (`dual-implementation-discipline.md`). **Basis:** S-H P3d corpus measurement (189 transcripts, 1,904 UserPromptSubmit firings, 728 SubagentStart firings) — quoted at `s-h-…:282-283,335-336`. |
| **restoration trigger** | OBSERVABLE: a `compact_boundary` event (per `message.subtype`) followed by ≥1 reviewer-flagged "lost ambient context" finding in a stage-PR review OR an `inject-session-bootstrap` firing rate dropping below 1-per-30-turns on a comparable corpus (would indicate the cache is over-missing compaction events). T-SDP-B counter: names an observable, not "if problems occur." |
| **mechanism** | **PROPOSED DIFF — maintainer handoff.** `.claude/hooks/inject-session-bootstrap.sh` and `.claude/hooks/inject-subagent-digest.sh` are NOT in §2's permitted set; the row ships as a recommended diff in this PR body, priced from S-H's P3d line. Proposed pattern: once-per-session cache mirroring `inject-matching-rule.sh`'s existing cache (`inject-matching-rule.sh` already implements this pattern — copy its cache key, scope to session id). **Cache invalidation trigger named:** on `subtype=compact_boundary` (CC's compaction signal), the cache MUST be invalidated so the digest re-injects after compaction — this preserves the digest's compaction-resilience purpose (counter-argument per kickoff §1 item 1). |
| **agnosticism** | ZCode: same injector fires via SessionStart hook twin (CC-native hook code is dual-implemented per `dual-implementation-discipline.md`). aif-container: container's hooks inherit. No silent divergence. |

### §2.2 Row S-MAIN-SKILL — `skill_listing` trim (S-L top-ranked harness lever)

| Cell | Value |
|---|---|
| **cost** | 26,696 cp / 8,870 tok — **single largest priced message-stream block, 4.9× any other** (S-L §5 `s-l-…:501-503`). Source: S-L §2.2 (`s-l-…:244,269`). |
| **reach** | CC main seat: yes (every seat, every prompt — `/context` reports as `Skills 8.9k`). CC subagent: yes (same harness block). aif-container: yes via container's `.claude/settings.json` `skills` list. ZCode: **no equivalent** — ZCode has no `skill_listing` analog; degradation documented (`skill_listing` block is CC-specific). **Basis:** S-L §2.2 identity probe — 69 entries in both `/context` and `skill_listing` attachment, exactly. |
| **restoration trigger** | OBSERVABLE: a skill invocation rate (`/skill X` calls per session, measureable via `Skill` tool call transcripts) for a de-listed skill rising above zero in any stage-PR review retro OR operator notice that a removed skill was needed. T-SDP-B counter: names an observable. |
| **mechanism** | **PROPOSED DIFF — maintainer handoff.** `.claude/settings.json` is NOT in §2's permitted set. The recommended diff: enumerate `skills` entries in `.claude/settings.json`, identify entries with zero invocations in the S-H transcript corpus (probe via `grep -cE '"skill":"X"' ~/.claude/projects/.../transcript-*`), de-list them. Operator reviews and applies. |
| **agnosticism** | ZCode: no equivalent — degradation documented. aif-container: container's settings ship its own skills list. |

### §2.3 Row S-MAIN-AGENT — `agent_listing_delta` built-in-agent descriptions

| Cell | Value |
|---|---|
| **cost** | 2,305 cp (~737–1,256 est-tokens @ 1.835–3.128 cp/t) — built-in agent descriptions subset of `agent_listing_delta` (S-L §2.2 `s-l-…:276`). Total `agent_listing_delta` 5,433 cp but only the built-in subset is addressable: orchestrator-planner (3,128 cp) is operator-defined, not a drop candidate. |
| **reach** | CC main seat: yes (every seat). CC subagent: yes. aif-container: yes. ZCode: **no equivalent** — agent descriptions are CC-specific. **Basis:** S-L §2.2 — `agent_listing_delta` attachment carries 7 entries, 6 built-in + 1 user-defined; the 6 built-in (2,305 cp) are billed-and-/context-uncounted. |
| **restoration trigger** | OBSERVABLE: a built-in agent (e.g. `Explore`, `Plan`, `general-purpose`) invocation in a transcript for a seat where its description was elided — the invocation would still succeed (built-in agents are not removed, only their descriptions trimmed from the listing). T-SDP-B counter: names an observable. |
| **mechanism** | **PROPOSED DIFF — maintainer handoff.** Built-in agent descriptions are harness-supplied, not operator-controlled; the lever is whether to suppress their display in the listing. CC has no documented mechanism for this; the recommended diff is **a feature request to upstream** (CC) plus a documented degradation in this map until CC ships a suppression mechanism. **NOT a §2-permitted edit.** |
| **agnosticism** | ZCode: no equivalent. aif-container: depends on harness. |

### §2.4 Row S-MAIN-TOOL — `deferred_tools_delta` and `mcp_instructions_delta`

| Cell | Value |
|---|---|
| **cost** | `deferred_tools_delta` 4,075 cp (~1,303–2,221 est-tokens @ 1.835–3.128 cp/t) + `mcp_instructions_delta` 3,741 cp (~1,196–2,039 est-tokens) = **7,816 cp combined (~2,499–4,259 est-tokens)**. Source: S-L §2.1 (`s-l-…:241,243`). |
| **reach** | CC main seat: yes. CC subagent: yes. aif-container: depends on MCP config. ZCode: no equivalent. **Basis:** S-L §2.1 census. |
| **restoration trigger** | OBSERVABLE: a tool invocation for a deferred tool failing because its description was elided AND the model failed to discover it — would surface as a "tool not found" error in transcript. T-SDP-B counter: names an observable. |
| **mechanism** | **PROPOSED DIFF — maintainer handoff.** Deferred-tool and MCP-instruction listings are harness/MCP-server-controlled, not directly operator-editable. The recommended diff is an audit pass: enumerate deferred tools, identify those whose definitions could be slimmed at the MCP-server source, file per-MCP-server upstream PRs. **NOT a §2-permitted edit.** |
| **agnosticism** | ZCode: no equivalent. aif-container: depends on MCP config. |

### §2.5 Row S-MAIN-CLAUDEMD-EXCLUDES — `claudeMdExcludes` recommended additions

| Cell | Value |
|---|---|
| **cost** | Currently 7 rules already excluded (see §0.2). The remaining 5 always-on files total 48,679 B. CLAUDE.md (22,605 B → ~6,617–12,319 est-tokens @ 1.835–3.416 B/t; S-L §1.1 measured the pre-S-G 23,740 B copy of this same file at 2.553 B/tok, which places the content-specific point at ~8,854 tok, inside the band) is the largest candidate. |
| **reach** | CC main seat: yes. CC subagent: n/a (no CLAUDE.md load per S-H P11). aif-container: yes via container settings. ZCode: **no `claudeMdExcludes` primitive** — degradation documented; ZCode's SessionStart hook twin can hand-load the file if needed. **Basis:** S-H P11 + script-overlay semantics (`scripts/measure-always-on.sh:18-32` comment). |
| **restoration trigger** | OBSERVABLE: an excluded rule's pattern (e.g. a `git-conflict-merge-forward.md` invocation) appearing in a stage-PR review without the rule firing (the rule's advice absent from a relevant conflict-PR review) — surface as reviewer-flagged finding. T-SDP-B counter: names an observable. |
| **mechanism** | **PROPOSED DIFF — maintainer handoff.** `.claude/settings.json` is NOT in §2's permitted set. The recommended diff: re-audit the 7 currently-excluded rules against the resident need; for the 5 remaining residents (CLAUDE.md + 4 Tier-0), CLAUDE.md is owned by S-G (not editable here); Tier-0 rules cannot be excluded without the four-way swap (see §3.1). **No new claudeMdExcludes additions proposed by this stage.** |
| **agnosticism** | ZCode: no primitive — degradation documented. |

### §2.6 Senior main seat — drop tally

- **§2.1 S-MAIN-INJ** — PROPOSED DIFF, biggest measured lever (~12× P5a), ships via PR-body handoff
- **§2.2 S-MAIN-SKILL** — PROPOSED DIFF, top harness-side block (8,870 tok), ships via PR-body handoff
- **§2.3 S-MAIN-AGENT** — upstream feature request, degradation documented
- **§2.4 S-MAIN-TOOL** — per-MCP-server upstream PRs, recommended
- **§2.5 S-MAIN-CLAUDEMD-EXCLUDES** — no new additions; current 7 entries kept
- **§3.1 (Tier-0 swap)** — see §3 below; this stage does NOT fire the swap

**This stage's §2 SHIPPED contribution:** the map rows themselves (the proposed diffs and the
audited reach/cost/mechanism cells). No §2-permitted edit ships in this stage — every senior-seat
drop mechanism is operator-owned (settings files) or hook-owned (`.claude/hooks/*`), so all
travel as PR-body proposed diffs. **A reviewer-merged PR with these rows is the map's
contribution; the operator decides which proposed diffs to apply.**

## §3 Tier-0 rule-channel re-scoping (kickoff §2 rev 5 grant)

### §3.1 DECISION: NO SWAP FIRES THIS STAGE

The kickoff §2 rev 5 grant anticipated that the senior-main-seat rule-channel drop has, on the
current host, **no target that is not a Tier-0 member** — after `claudeMdExcludes`, the resident
rule set is `00-rule-index.md` + the three named Tier-0 rules. Re-scoping one therefore requires
the four-way swap.

**Corrected ranking at the band (this replaces an earlier flat-4-B/tok ordering).** An earlier
revision of this section ranked the Tier-0 swap **fourth** on the strength of
`build-first-reuse-default.md` ≈ 3,167 tok @ 4 B/t. That figure was a point estimate on a
falsified constant; re-derived per §0.3 it is **3,708–6,903 est-tokens**, and S-L §1.1
**measured this exact file** (same 12,667 B) at **4,800 tokens** on a live `/context` read
(`2026-08-07-s-l-recalculation.md:55`). Every lever, re-derived:

| # | Lever | Basis | est-tokens |
|---:|---|---|---|
| 1 | `skill_listing` trim (§2.2) | MEASURED (`/context`) | **8,870** |
| 2 | `build-first-reuse-default.md` (Tier-0) | MEASURED (S-L §1.1); band 3,708–6,903 @ 1.835–3.416 B/t | **4,800** |
| 3 | both hook injects (§0.3 / §2.1) | band @ 1.835–3.128 cp/t | ~2,191–3,735 |
| 4 | `ai-laziness-digest.md` (Tier-0) | band @ 1.835–3.416 B/t (6,703 B) | ~1,962–3,653 |
| 5 | `agent_listing_delta` total (§2.3) | band @ 1.835–3.128 cp/t | ~1,737–2,961 (addressable subset ~737–1,256) |
| 6 | `deferred_tools_delta` (§2.4) | band @ 1.835–3.128 cp/t | ~1,303–2,221 |
| 7 | `mcp_instructions_delta` (§2.4) | band @ 1.835–3.128 cp/t | ~1,196–2,039 |
| 8 | `attention-is-not-a-mechanism.md` (Tier-0) | MEASURED (S-L §1.1); band 770–1,433 | **1,100** |

(`CLAUDE.md` at ~6,617–12,319 est-tokens would sit at #2 as well, but it is not a Tier-0 swap
candidate — its content-trim is S-G-owned and §2.5 proposes no `claudeMdExcludes` addition.)

**The re-ranking overturns the earlier ordering claim.** `build-first-reuse-default.md` is the
**second** lever, not the fourth: its measured 4,800 tok exceeds the hook injects, the agent
listing, and both tool-listing blocks. (Its band floor, 3,708, clears every harness-block ceiling
except the hook injects' 3,735 — the #2 rank rests on the MEASURED 4,800, not on band
separation.) Only `skill_listing` is larger. The honest statement is therefore *«the Tier-0
swap is the second lever, behind `skill_listing` and ahead of every harness-side block»*.

> **DECISION-NEEDED (operator): at the corrected band, `build-first-reuse-default.md` ranks #2;
> firing the Tier-0 swap is a channel re-scope decision reserved to the operator (kickoff §3a).**
> This stage records the corrected ranking and does **not** convert it into a swap.

**This stage still does NOT fire the swap** — the reasons are now (2) and (3), not (1):

1. ~~The Tier-0 swap is the fourth lever~~ — **withdrawn, falsified above.** It is #2.
2. **§2's proposed-diff rows already carry the senior-seat subtraction.** The rows in
   §2.1-§2.4 subtract the measured heavy blocks without touching the rule channel, so the
   Tier-0 swap is not load-bearing for this stage's purpose.
3. **§3a park-don't-guess:** the choice between the three Tier-0 candidates is a genuine fork
   with defensible cases on each side (§3.2), and a Tier-0 re-scope is a **channel decision**
   (four registry copies, `zcode-parity-doctrine.md` twins, principle 31) — reserved to the
   operator, not a figure a stage can settle by arithmetic. The plan does not pick. The fork is
   **DECISION-NEEDED**, recorded in §3.2, surfaced in the PR body. Firing it is a future stage's
   call (likely the ADR-8 follow-on stub in kickoff §6, which inherits the baseline question).

**Acceptance (§3 Tier-0 swap leg):** "If the stage re-scopes no Tier-0 rule, state that explicitly
and say which senior-seat mechanism carried the drop instead." — **No Tier-0 rule re-scoped. The
senior-seat drop is carried by §2.1 (injector cache proposed-diff), §2.2 (skill_listing trim
proposed-diff), and §2.3-§2.4 (upstream feature requests) — all PR-body proposed diffs against
operator-owned surfaces, none touching §2-permitted registry surfaces.**

### §3.2 DECISION-NEEDED — Tier-0 swap candidate (PARKED for a future stage)

If a future stage wants a rule-level senior-seat drop, the three Tier-0 candidates (per
`packages/core/principles/31-rule-channel-declaration.ts:58-63`) and their cases:

- **`build-first-reuse-default.md`** (12,667 B → **4,800 tok MEASURED** at S-L §1.1 `s-l-…:55`; band ~3,708–6,903 @ 1.835–3.416 B/t — largest Tier-0 rule, and the **#2 lever overall** per §3.1).
  - **Case for drop:** biggest measured cost; macro-level operating philosophy (per its own §6
    "Never retire") could be carried by the per-commit CLAUDE.md gate alone.
  - **Case against:** its §6 self-declares "Never retire" — dropping would abandon a
    project-foundational discipline; the principle test at slot 11 stays registered regardless.
- **`ai-laziness-digest.md`** (6,703 B → ~1,962–3,653 est-tokens @ 1.835–3.416 B/t — second-largest; not in S-L §1.1's measured set, so band only).
  - **Case for drop:** the digest is the resident hot digest of the full ai-laziness-traps
    catalogue; once that catalogue's countermeasures are encoded in tests/probes, the digest's
    residency is theatre.
  - **Case against:** the digest carries anti-drift obligation (principle slot 35) — dropping
    the digest requires also retiring the anti-drift gate, which is a separate decision.
- **`attention-is-not-a-mechanism.md`** (2,629 B → **1,100 tok MEASURED** at S-L §1.1 `s-l-…:54`; band ~770–1,433 — smallest).
  - **Case for drop:** Class C prose-only rule with promotion criterion in its §3; lowest byte
    cost → smallest drop savings.
  - **Case against:** smallest savings; least-attractive candidate.

**Option A → consequence:** no rule-level drop ships, this stage's senior-seat subtraction is
carried entirely by §2's proposed-diff rows. (This is §3.1's state.)
**Option B → consequence:** a future stage picks one of the three above, executes the four-way
swap (kickoff §2 grant — all four registry copies), and accepts the maintenance cost of
re-introducing the rule via `paths:`-scoping or session-bootstrap injection if its observable
restoration trigger fires.

**PARKED.** This stage does not pick. A reviewer/operator decision on this fork is welcome at
PR review; absent that, the fork travels to the §6 follow-on stage.

## §4 Review subagents — replacement prompt map

For each of the 8 in-scope review-seat agents (Task 2 population enumeration, T10-before-T1
satisfied), the map row names the agent, the cost, the reach basis, the restoration trigger, and
cross-references the implementation in §6 / agents/<name>.md (Task 6).

**Reach basis — uniform across review-subagent rows (per kickoff §3 M2 rev 5):** no upstream
deliverable measures what a custom review subagent loads. S-H P11 measured Explore/Plan (CC
built-in subagents), not custom review subagents. **No probe was run in this stage.** Every
review-subagent row's reach cell therefore reads `UNVERIFIED — no probe exists` per the
kickoff's binding rule, and **the drop is HELD, not shipped as a resident-context subtraction
for the subagent population** — but the agent file edit itself DOES ship (Task 6 below), because
the file is what CC loads via C2 (ADR-2: custom subagent system prompt REPLACES CC's).

The "UNVERIFIED — no probe exists" reach applies to the **subagent's load of CC-resident
context** (whether the harness's pre-system-prompt context reaches the subagent). The
agent-definition edit itself reaches 100% of dispatches of that subagent (it IS the prompt).

### §4.1 Review-subagent cost basis (S-L `agent_listing_delta` + per-file wc)

**Population census — the complete `agents/*.md` set (T10: enumeration BEFORE sampling).**
`ls agents/*.md` → **18 files**. Every one is classified below; the 8 in-scope rows are the
population §4.2 samples (T1 floor = 5, satisfied), and no file is waved off without a reason.

| # | File | Class | Disposition |
|---:|---|---|---|
| 1 | `adapter-jig-reviewer.md` | review seat | **IN SCOPE** — §4.2 |
| 2 | `backward-sweep-auditor.md` | review seat | **IN SCOPE** — §4.2 |
| 3 | `capability-reuse-auditor.md` | review seat | **IN SCOPE** — §4.2 |
| 4 | `compliance-verifier.md` | review seat | **IN SCOPE** — §4.2 |
| 5 | `dispatch-input-checker.md` | review seat | **IN SCOPE** — §4.2 |
| 6 | `docplan-auditor.md` | review seat | **IN SCOPE** — §4.2 |
| 7 | `fidelity-auditor.md` | review seat | **IN SCOPE** — §4.2 |
| 8 | `reviewer-discipline.md` | review seat (protocol pointer) | **IN SCOPE** — §4.2 (NO-OP trim) |
| 9 | `living-docs-auditor.md` | review seat | **OUT — maintainer-owned**, CLAUDE.md Artifact Ownership Contract (§4.3) |
| 10 | `review-sidecar.md` | review seat | **OUT — maintainer-owned** (§4.3) |
| 11 | `rule-test-author.md` | review seat (write-half protocol) | **OUT — maintainer-owned** (§4.3) |
| 12 | `aif-init.md` (9,986 B) | generator | **OUT — not a review seat.** Writes `.ai-factory/DESCRIPTION.md` + `ARCHITECTURE.md` from repo signals (`tools: Read, Glob, Write`); consumer-shipped via `install.sh`. Carries no verdict grammar, so the kickoff's GO/REVISE/STOP alignment criterion has nothing to attach to. |
| 13 | `rule-researcher.md` (24,438 B) | generator / consumer-facing researcher | **OUT — not a review seat.** Largest file in `agents/`; authors the `ResearchPlan` + `GenerateSelection` JSON records the deterministic factory consumes. Its bulk IS the machine-consumed record schema — the same class §4.1's finding says cannot be cut without gutting function. |
| 14 | `getff-cold-run-prober.md` (21,600 B) | acceptance probe (DORMANT) | **OUT — not a review seat.** Dispatch-orchestrating probe bound to the getff-any-stack-trace umbrella (spec §9.3); its length is the acceptance-protocol contract, and trimming it would edit an acceptance protocol, not a review prompt. |
| 15 | `shipped-agent-liveness-prober.md` (21,004 B) | liveness probe (DORMANT) | **OUT — not a review seat.** RED→GREEN with/without-tools probe over the shipped-agent surface; same class as #14. |
| 16 | `manual-rule-liveness-prober.md` (16,885 B) | liveness probe | **OUT — not a review seat.** RED→GREEN probe for manifest manual rules; same class as #14/#15. |
| 17 | `orchestrator-worker-discipline.md` (11,116 B) | worker-side discipline prompt | **OUT — not a review seat** (it is read by the *implementer*, not a reviewer), **and** it is a `@dual-pair` twin of `packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md` — a unilateral trim desyncs the twin (`dual-implementation-discipline.md §7`). |
| 18 | `memory-codification-auditor.md` (6,486 B) | auditor — but not of a PR | **OUT, with an honest caveat.** It *is* an auditor and *does* emit a codify-or-leave verdict, so «not an auditor» would be a wave-off. It is out because its subject is the operator's **user-scope memory store**, not a diff / PR body / dispatch input — it never runs at a stage-PR boundary, which is the seat class this stage prices. It is also a `@dual-pair` twin of `.claude/hooks/inject-memory-codification.sh`, so any trim must move both halves together. **Legitimate candidate for a later per-seat pass, jointly with its hook twin** — recorded, not silently dropped. |

**Honest note on the boundary:** the four largest files in `agents/` (#13-#16, 16-24 KB each)
are all OUT of scope. That is the kickoff §2 allowlist doing its job — the stage prices
*review seats*, not «the biggest files» — but it means this stage's −20.5% does **not** touch
the heaviest agent prompts in the tree. A future stage wanting raw byte reduction across
`agents/` should start there, not here.

| Agent (in scope) | `wc -c` BEFORE (Task 2) | `wc -c` AFTER (Task 6) | Net trim | Role one-liner |
|---|---:|---:|---:|---|
| adapter-jig-reviewer | 13,067 | 8,562 | −4,505 | cold adversarial multi-dimension review of adapter wiring diff |
| backward-sweep-auditor | 8,221 | 6,439 | −1,782 | cold backward-sweep for §1.7 Backward-check |
| capability-reuse-auditor | 8,691 | 7,880 | −811 | audits proposed or just-authored new capability |
| compliance-verifier | 13,380 | 7,073 | −6,307 | reviews PR §1.7 Forward/Backward-check sections |
| dispatch-input-checker | 12,469 | 10,930 | −1,539 | cold dispatch-input reality-check |
| docplan-auditor | 7,924 | 7,333 | −591 | cold semantic-grouping judgment for DocPlan |
| fidelity-auditor | 9,072 | 8,466 | −606 | cold WHAT-conformance acceptance audit at stage-PR boundary |
| reviewer-discipline | 4,892 | 5,091 | **+199** | review-session protocol — NO-OP trim; map-row ref added |
| **TOTAL** | **77,716** | **61,774** | **−15,942 B (−20.5%)** | |

**Wishful-targets finding (recorded honestly per §3a park-don't-guess).** The original §4.2
targets (adapter ≤6,000 / backward ≤4,500 / capability ≤4,500 / compliance ≤6,000 / dispatch
≤5,500 / docplan ≤4,000 / fidelity ≤4,500) were wishful — they did not budget for (a) the
mandatory kickoff criteria (b)+(c)+(d) additions (reviewer-discipline §1+§2 clauses ~400 B,
subtraction-map-row reference ~500 B, GO/REVISE/STOP vocab note ~150 B; total ~1,050 B/agent or
~7.4 KB across 7 non-no-op agents), nor (b) the essential machine-consumed grammars and
domain-specific protocol content that cannot be cut without gutting the agent's function
(adapter's 8 conformance groups ~1,800 B; dispatch's K1-K5 table + DISPATCH-INPUT grammar +
Shadow-A/B summary ~3,500 B; fidelity's FIDELITY grammar + Watch-list schema ~2,500 B). The
achievable floor is the AFTER column above; cutting further would either drop a mandatory
criterion or remove protocol content the agent's job requires. This finding travels to the PR
body as a recorded deviation from the wishful targets, not a silent miss.

Each agent file's full content (per ADR-2 C2: REPLACES CC's resident context for the subagent
seat) is the cost of dispatching that subagent. S-L §2.2 measured the **listing** overhead (the
~3,128-cp user-defined entry in `/context`'s `Custom agents 1k`) — but the **load-time** cost is
the per-dispatch system prompt, which is the file itself. **No instrument in §1 prices the
per-dispatch load beyond `wc -c`** (the §1 agent-side instrument), so the cost cells below use
`wc -c` BEFORE vs AFTER (per kickoff §1 item 1 corrected instrument set).

### §4.2 Per-agent map rows

For each of the 8 in-scope agents, the row below cites the implementation in §6 / Task 6. **The
drop mechanism is uniform:** ADR-2 C2 — the custom subagent system prompt REPLACES CC's resident
context. Trimming the prompt therefore trims the subagent's per-dispatch load, linearly.

| Agent | Drop mechanism | Cost cell (BEFORE → AFTER) | Reach | Restoration trigger |
|---|---|---|---|---|
| **adapter-jig-reviewer** | Slim 13,067 → 8,562 B (wishful ≤6,000 — see §4.1 finding) | −4,505 B (−34%) | `UNVERIFIED — no probe exists` for subagent's CC-context load; agent-file edit reaches 100% of dispatches | OBSERVABLE: a wiring-diff review where the reviewer defers one of the agent's own conformance arms (A1-A2 / B1-B3 / C1-C4 / D1-D3 / E1-E3 / P1 / G1-G3 / H1-H3 — the eight groups at `agents/adapter-jig-reviewer.md:82-89`) because the slimmed prompt dropped it → flagged in stage-PR review. («F1-F11» named no arm this agent has.) |
| **backward-sweep-auditor** | Slim 8,221 → 6,439 B (wishful ≤4,500 — see §4.1 finding) | −1,782 B (−22%) | same | OBSERVABLE: a sibling-surface gap on a change-class the slimmed prompt no longer enumerates → returns CLEAN where it should report GAP-FOUND |
| **capability-reuse-auditor** | Slim 8,691 → 7,880 B (wishful ≤4,500 — see §4.1 finding) | −811 B (−9%) | same | OBSERVABLE: a capability-commit PR where the slimmed prompt misses a SSOT cross-check |
| **compliance-verifier** | Slim 13,380 → 7,073 B (wishful ≤6,000 — see §4.1 finding) | −6,307 B (−47%) | same | OBSERVABLE: a stage-PR §1.7 review where the slimmed prompt does not surface a missing Forward/Backward check that the full prompt would have caught |
| **dispatch-input-checker** | Slim 12,469 → 10,930 B (wishful ≤5,500 — see §4.1 finding). NOTE: GO/REVISE/STOP grammar source per kickoff §3 — DISPATCH-INPUT grammar in §Output grammar preserved verbatim | −1,539 B (−12%) | same | OBSERVABLE: a K1-K6 dispatch defect where the slimmed prompt misses a class the full prompt catches |
| **docplan-auditor** | Slim 7,924 → 7,333 B (wishful ≤4,000 — see §4.1 finding) | −591 B (−7%) | same | OBSERVABLE: a DocPlan review where the slimmed prompt approves a semantic-grouping defect the full prompt would reject |
| **fidelity-auditor** | Slim 9,072 → 8,466 B (wishful ≤4,500 — see §4.1 finding). FIDELITY grammar preserved verbatim | −606 B (−7%) | same | OBSERVABLE: a stage-PR WHAT-conformance audit where the slimmed prompt misses a kickoff-spec mismatch |
| **reviewer-discipline** | NO-OP trim — already slim protocol pointer (4,892 B → 5,091 B; +199 B map-row ref added, no body trim) | +199 B (+4%) | same | n/a (no trim shipped) |

### §4.3 Maintainer-owned set (out of scope by CLAUDE.md)

Per kickoff §2: `agents/living-docs-auditor.md`, `agents/review-sidecar.md`,
`agents/rule-test-author.md` are maintainer-owned read-only for all sessions. **No edits in this
stage.** If a slimming genuinely belongs in one of these files, the proposed diff travels in the
PR body — **none proposed here**; the three files are core to the framework's reviewer/codification
contracts and slimming them is a separate maintainer decision.

## §5 Explore/Plan subagents (CC built-ins) — ALREADY DONE

Per S-H P11 (cited in dependency gate, `2026-08-07-s-h-turn-attribution-p3d-p11.md:137-461`):

| Seat | Rules loaded? | CLAUDE.md loaded? | Measured tokens |
|---|---|---|---:|
| Explore | NO | NO | 26,659 |
| Plan | NO | NO | 26,783 |
| Control (CC main) | YES | YES | 62,340 |

**P11 verdict:** the harness **already subtracts** rules + CLAUDE.md for Explore/Plan. There is
nothing for this stage to ship on these seats. Map rows read:

> **ALREADY DONE — harness subtracts per S-H P11. Nothing to ship.** Explore 26,659 tok / Plan
> 26,783 tok (no rules, no CLAUDE.md) vs control 62,340 tok (full load). The subtraction is
> harness-side and pre-exists this stage.

**P11 INCONCLUSIVE path (kickoff §3 "if P11 lands INCONCLUSIVE, descope those rows") NOT taken**
— P11 was conclusive (REAL verdict with concrete numbers). Source: `s-h-…:137-461`.

**Restoration trigger (not load-bearing — drop is already done):** n/a. The harness owns this
subtraction; if a future CC build reverses it, the falsifier is `Explore` seat tokens rising
toward control's 62,340 tok baseline on a comparable corpus.

## §6 Follow-on stage stub (kickoff §6 — recorded, not implemented here)

The ADR-8 A/B evaluation arm is descoped from S-D′ (kickoff §5 Option A, operator verdict
2026-08-07). Re-homed to a follow-on stage that takes the dispatch choreography. **This stage
does not implement any part of the A/B arm** — no parity function, no defect count, no ledger
column. A PR with no evaluation arm is conformant. See kickoff §6 for the stub's full scope.

**Reclassification mechanics preserved here (Task 6 deleted three "Revisit criterion" blocks).**
`adapter-jig-reviewer`, `backward-sweep-auditor` and `dispatch-input-checker` each carried a
"Revisit criterion" paragraph naming what reclassifying an operator-only agent as
consumer-shipped requires; the slimming pass dropped all three, and
[prior-art-evaluations.md #195](../../meta-factory/prior-art-evaluations.md)'s
Trigger-to-revisit («the agent is reclassified as consumer-shipped (its own *Revisit criterion*)
→ move its entry alongside `compliance-verifier`») would otherwise dangle. The mechanics now
live here: **add the agent to `install.sh` SHIPPED_DOCS and to principle-09's
`REQUIRED_HEADER_DOCS` (`packages/core/principles/09-doc-authority-hierarchy.ts:28`), drop
its `setup.d/20-agents.sh:28-30` skip-loop line, then regenerate
fingerprints with `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`.**

## §7 §1.7 self-reflexive note

**Forward-check (this map complies with active disciplines):**

- `no-paid-llm-in-ci.md` — map authoring used local `jq`/`wc`/`grep` only; zero API-billed calls
- `phase-research-coverage.md` §1.7 — every figure carries file:line or command-output citation
  (T3); every assume-none claim (e.g. "no host-side billing-projection snapshot exists" in §0.1)
  rests on a 3-item search (git branches / `find` / `~/.claude/` ls), short of the full 6-item
  checklist because the artifact class is narrow (a single CSV-on-data-branch channel) and the
  three searches cover the full reachable surface
- `ai-laziness-traps.md` — T1 (sampling floor: 8 of 8 review-seat agents covered, >5 floor ✓);
  T2 (§0.1 PARK is a decision, not a description); T3 (every cost cell cited); T10 (population
  enumerated in §0.1 / §4.1 before any per-agent row); T13/T16 (ADR-2 C2 verified at
  `2026-07-31-arch-v2-context-pipeline-design.md:40-42`); T15 (this §1.7 is the self-application);
  T20 (every recommendation grounded in a quoted figure); T-SDP-A (map ordered largest-first per
  §0.3, top-3 named); T-SDP-B (every restoration trigger names an observable)
- `recommendation-laziness-discipline.md` — every fork surfaced as DECISION-NEEDED with both
  consequences (§3.2); the §3.1 "no swap fires" call is a reasoned pick, not an option-dump, and
  cites the §0.5 priority ordering as the deciding reason
- `attention-is-not-a-mechanism.md` — every load-bearing check proposed in the map rows
  (restoration triggers) names a NAMED OBSERVABLE (transcript event / review-defect class /
  billing-line movement), not bare attention
- `build-first-reuse-default.md` — this stage ships **only maps** (text/docs); no new capability,
  no new dependency, no new code-module ≥50-80 LOC; `Prior-art:` trailers reference
  `prior-art-evaluations.md#234` and the relevant spec section per the kickoff §3 capability-commit
  escape-hatch standard

**Backward-check (this map's change-class swept across sibling surfaces):**

Class of this change = "per-seat subtraction map row with cost/reach/mechanism/trigger cells."
Surfaces where class-X occurs: this is the **first** subtraction map under SSOT #234 — the
additive scope (per-role digests) is closed/DEFERRED. Sibling surfaces for the change-class:

- `docs/superpowers/specs/2026-07-26-per-role-context-*.md` — additive scope (closed); not edited
- `docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md` — design SSOT, not a map;
  §1.5/§1.6 FORK references carried forward; not edited
- Other arch-v2-context-pipeline stage specs (S-A through S-L) — stage-specific specs, not
  subtraction maps; not edited
- A future S-E′/S-G′/etc. that may want their own subtraction rows — out of scope today

**Per-surface verdicts:** this map is the **inaugural** subtraction-map artifact; there are no
parallel sibling surfaces to sweep. The class-enumeration is therefore trivially complete
(verification: `grep -lE 'subtraction map' docs/superpowers/specs/*.md` → this file only after
authoring).

**Recursive self-application:** this map applies §1.7 to itself — verified above; §1.7 cells
carry evidence and falsifiers; the §0.1 PARK is itself an instance of the §3 escape-token
discipline (≥20-char rationale stated).

## §8 Acceptance cross-reference

Per kickoff §3 host-verify contract:

- **`SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh`** — fires in Task 7 (after Task 6
  agents edits) and Task 10 (final acceptance). Task 6's agent edits shift install fingerprints;
  snapshots regen in Task 7.
- **`npx tsx scripts/render-rule-index.mjs --check`** — no `paths:` edits in this stage → check
  stays GREEN (no-op for this stage). Verified in Task 10.
- **`npx tsx scripts/render-rule-channels.mjs --check`** — same; no `paths:` edits → no-op.
- **Tier-0 swap leg** — §3.1 above: no swap fires; explicit statement + named-mechanism per §3
  contract.

Review-time gates (kickoff §3):

- Every map row carries cost + reach + restoration trigger — verified per row above ✓
- #234 annotation lands in same PR — Task 9 ✓
- No drop touches a block whose consumer is the aif executor tier without §1 priority
  justification — §2-§5 rows all target CC main seat or CC subagents; the aif-container
  population is named in the population table but receives the same drops via shared hooks (no
  separate aif-executor-tier drop in this stage)
- §0.6 agnosticism — every row's agnosticism cell names ZCode behaviour or documents degradation ✓
- Reach cell basis check — every reach cell states HOW (S-H P11 / S-L census / `UNVERIFIED — no
  probe exists`); no bare yes/no ✓
- Deliverable 2 population floor — 8 in-scope review-seat agents covered in §4 (≥5 floor) ✓
- P11 consequence — conclusive (REAL verdict), Explore/Plan rows ship as "ALREADY DONE" ✓
- Tier-0 swap discrimination — no swap fires, no discrimination leg applies ✓

## §9 See also

- [Kickoff (inline)](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline-s-d-prime/kickoff.md) — stage contract source
- S-E fixed per-file meter — §0.2 instrument. **S-E (#1237) shipped no research patch of its
  own**; the instrument IS [`scripts/measure-always-on.sh`](../../../scripts/measure-always-on.sh),
  and its overlay semantics are recorded in
  [2026-08-06-claudemd-overlay-semantics-verdict.md](../../meta-factory/research-patches/2026-08-06-claudemd-overlay-semantics-verdict.md)
  (P3b) and [2026-08-06-instructionsloaded-observability-verdict.md](../../meta-factory/research-patches/2026-08-06-instructionsloaded-observability-verdict.md) (P3c).
  The earlier `2026-08-07-s-e-*.md` link in this section was a literal glob matching no file.
- [S-H P11 + P3d](../../meta-factory/research-patches/2026-08-07-s-h-turn-attribution-p3d-p11.md) — §0.3, §0.4, §5
- [S-L re-derived ranking](../../meta-factory/research-patches/2026-08-07-s-l-recalculation.md) — §0.3, §0.4
- [Pipeline token-economy design](./2026-08-06-pipeline-token-economy-design.md) — source spec
- [arch-v2-context-pipeline design](./2026-07-31-arch-v2-context-pipeline-design.md) — ADR-1, ADR-2, ADR-8
- [prior-art-evaluations.md #234](../../meta-factory/prior-art-evaluations.md) — SSOT (Task 9 annotation target)
