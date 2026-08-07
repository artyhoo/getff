<!-- scope:meta-orchestrator-mode-triage-and-planner-design -->
# Design — /meta-orchestrator mode triage + planner integration

> **Status:** DRAFT pending maintainer review.
> **Date:** 2026-05-25.
> **Class:** Design doc (research-patch lane); precedes R-phase prior-art survey + umbrella kickoff (NOT writing-plans skill — scope exceeds single-session implementation plan, see §13).
>
> **Authoritative for:** the integration design that stitches existing L1-L5 planner helpers (PRs #213/#214/#217/#222/#223/#225) + composition direction (`bundle-autonomous` kickoff, R-phase blocked) + new alias layer + master-plan persistence + L1 discovery scope extension into a unified `/meta-orchestrator`-as-planner. Records the brainstorming session 2026-05-25 conclusions: triage axis, Mode catalogue, routing decision tree, scope partition (NEW vs INTEGRATION vs EXTERNAL).
> **NOT authoritative for:** project goal (see [README.md#why-this-exists](../../../README.md#why-this-exists)); R-phase prior-art evidence (separate patch, see §13); umbrella execution stages (separate kickoff under `.claude/orchestrator-prompts/`); Mode A/B/SDD/Queue vocabulary itself (lives in maintainer's global `~/.claude/skills/orchestrator/SKILL.md`, ADOPT-VERBATIM internal); meta-orchestrator output format (frozen by [principle 18](../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts) + [references/output-format.md](../../../.claude/skills/pipeline/references/output-format.md)).

---

## §0 Context — why this design exists

Maintainer brainstorm 2026-05-25 surfaced four extensions to `/meta-orchestrator`:

1. **Mode triage** — auto-classify incoming task into one of 6 execution forms (DIRECT / SOLO / BUNDLE / PAIR / DECOMPOSE / RESEARCH), so a trivial fix doesn't pay full prior-art-survey + stage-gate cost.
2. **Planner role** — meta-orchestrator never does work itself; it discovers backlog, classifies, decides form, emits dispatch prompt. Workers/orchestrators do the work.
3. **Discovery sweep** — meta auto-grep'ает project for unfinished work (kickoffs + non-kickoff sources: open-questions §13.x raw, `// TODO:` in code, research-patches §future, memory `TODO-codify:`, stale PRs).
4. **Master-plan persistence** — meta updates a living master backlog SSOT (sweep-since-last-check semantics), so consecutive sessions reuse prior state instead of starting from zero.

**Recursive self-application of the triage being designed:** this design itself classifies (by `classify-work.sh` rules: LOC + surfaces) as **`I-phase-large` → Mode B × N worktrees → user-facing alias DECOMPOSE**. Implementation therefore CANNOT be a single `writing-plans` skill output — it requires an umbrella kickoff with stages. See §13.

**T-traps active for this design:** T1 (sampling shallow), T3 (plausible-finding-without-verification), T7 (pattern-matching prompt), T11 (designing without prior-art check), T12 (skipping literature sweep), T13 (treating ADOPTED items as zero-work), T15 (self-application), T16 (pattern-matching-on-name), T19 (own QA before handoff), T20 (inline-verdict-without-evidence). All explicit per [`.claude/rules/ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md).

**Domain-specific trap (per ai-laziness-traps.md §3 obligation: «≥1 domain-specific trap that is NOT in the canonical catalogue»):**

- **T-MO-design-A — «alias inline emit attractor».** Tempted to emit user-facing ALIAS (DIRECT/SOLO/BUNDLE/PAIR/DECOMPOSE/RESEARCH) from `classify-work.sh` because it makes helper output self-describing. Does NOT work: ALIAS requires routing-tree predicates (`sibling_count`, `load_bearing`, `parallel_safe`, `scope_decided`, `review_required`, `bundle_opt_in`) computed only in SKILL.md body after the planner pipeline. Emitting ALIAS from `classify-work.sh` is architecturally impossible without massive arg-passing that breaks helper determinism. Counter: ALIAS lives ONLY in SKILL.md body output (after routing tree runs); `classify-work.sh` stays unchanged. Caught by cold-review B-1 (2026-05-25).

---

## §1 Status map — what already exists on staging

Verified during brainstorm session 2026-05-25 via `gh pr view` + `ls .claude/skills/meta-orchestrator/helpers/` + `grep` on SKILL.md.

| Capability | Code path | Source PR | Wired in SKILL.md? |
|---|---|---|---|
| L1 discovery: kickoff backlog, open/merged PRs, research-patches, wave-plan refs | [`plan-currency-check.sh`](../../../.claude/skills/pipeline/helpers/plan-currency-check.sh) | (pre-planner) | ✅ §1 |
| L1 extension: 5 synthetic surfaces (cold-review-fixes / state.md PENDING / memory TODO-codify / stale PRs / wave-plan 🟡-🔲-DEFERRED) | [`priority-score.sh`](../../../.claude/skills/pipeline/helpers/priority-score.sh) | #214 | ✅ §2 |
| L2 reverse-currency UNTRACKED-N / UNTRACKED-KICKOFF | [`plan-currency-check.sh`](../../../.claude/skills/pipeline/helpers/plan-currency-check.sh) | #217 | ✅ §1 |
| L3 dup-detect (Jaccard heuristic on PR titles vs kickoff items) | [`dup-detect.sh`](../../../.claude/skills/pipeline/helpers/dup-detect.sh) | #222 | ❌ NOT WIRED |
| L4 classify (`fix`/`I-phase-small`/`I-phase-large`/`R-phase`) + DISPATCH mapping (`direct-Edit`/`Mode-A`/`Mode-B`/`R-phase-session`) | [`classify-work.sh`](../../../.claude/skills/pipeline/helpers/classify-work.sh) | #225 | ❌ NOT WIRED |
| L5 skill/agent assign (keyword overlap deterministic) | [`assign-skill.sh`](../../../.claude/skills/pipeline/helpers/assign-skill.sh) | #223 | ❌ NOT WIRED |
| Internal Mode vocabulary (Mode A inline / Mode B × N worktrees / SDD / Queue mode / R-phase-session) | [SKILL.md §5](../../../.claude/skills/pipeline/SKILL.md) lines 229-308 + maintainer's global `~/.claude/skills/orchestrator/SKILL.md` | (pre-planner) | ✅ |
| Output format (Dependency graph + Action queue + 1-liner blocks + Description block) | [`output-format.md`](../../../.claude/skills/pipeline/references/output-format.md) + [principle 18](../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts) | F.3 (#205) | ✅ §10 |
| Per-umbrella state template (NOT master-plan-level) | [`state.md.template`](../../../.claude/skills/pipeline/templates/state.md.template) | (pre-planner) | ✅ §10 |
| Composition direction (BUNDLE) | [`bundle-autonomous/kickoff.md`](../../../.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md) | (kickoff only — R-phase unblocked 2026-05-25 by planner-completeness L4+L5, not yet executed) | ❌ EXTERNAL |
| SSOT prior-art register | [`prior-art-evaluations.md`](../prior-art-evaluations.md) | continuous | ✅ |

---

## §2 Meta-orchestrator role (operational definition)

Meta-orchestrator **never does work itself**. Its job is exactly the following loop:

```text
1. DISCOVERY      — L1+L2 sweep all unfinished work surfaces (§6)
2. CURRENCY       — compute delta since last check (state/last-check.json, §7)
3. DEDUP          — L3 dup-detect (don't build on already-done work)
4. CLASSIFY       — L4 classify each surfaced item (TYPE + DISPATCH + LOC + SURFACES)
5. ASSIGN-SKILL   — L5 propose CC skill / AI-agnostic agent per item
6. ROUTE          — decision tree (§5) maps (TYPE × load-bearing × sibling-count) → Mode
7. SYNTHESIZE     — emit dispatch prompt per output-format.md §1-§5 (with alias label, §9)
8. UPDATE PLAN    — write back to wave-sequencing-plan.md §0 (§7 persistence)
9. HAND OFF       — maintainer pastes 1-liner block into fresh CC session (per principle 18)
```

**Sub-orchestrator / worker / reviewer all live BELOW this layer.** Meta does not invoke Agent tool for write-work (per [SKILL.md §5 anti-pattern `#worker-dispatch-via-subagent`](../../../.claude/skills/pipeline/SKILL.md)); maintainer-paste is the channel boundary.

---

## §3 Mode triage axis (final synthesis after 4 brainstorm reframings)

**Axis selected: «what kind of execution form fits the work's nature».** Two derivative properties:

- **Subagent depth** (1 / 2 / >2 levels) — falls out of Mode selection, not chosen separately.
- **Token cost** (cheap / moderate / expensive) — falls out of Mode selection, not chosen separately.

Both depth and cost are downstream consequences of picking the right Mode. The right Mode is decided by the L4 TYPE + load-bearing flag + sibling-count + scope-decided flag.

**Brainstorm reframing history (preserved for context):**

1. **Initial (token-cost axis, REJECTED):** binary light/heavy via override flag, with own `classify-umbrella.sh` helper. REJECTED — would have reinvented `classify-work.sh` (PR #225) + lacked nuance for `fix` vs `I-phase-small` distinction (T11).
2. **Second (depth-of-subagent axis, REJECTED):** trichotomy light/medium/heavy based on 1/2/>2 subagent levels. REJECTED — depth is consequence of Mode, not cause.
3. **Third (5-Mode taxonomy SOLO/BUNDLE/PAIR/DECOMPOSE/R-PHASE, REJECTED):** invented user-facing names parallel to existing Mode A/B/SDD/Queue/R-phase. REJECTED — reinvention of vocabulary that already exists in maintainer's global orchestrator skill (T11 + #two-prompts-drift risk per [`dual-implementation-discipline.md §8`](../../../.claude/rules/dual-implementation-discipline.md)).
4. **Final (THIS DESIGN):** ADOPT-VERBATIM internal vocab + user-facing alias layer as UX-affordance. Single SSOT (existing Mode A/B/SDD/Queue/R-phase); alias = thin mapping table.

---

## §4 Mode catalogue (6 forms)

| User-facing alias | Internal mechanism | When meta picks this | Subagent depth | Approx. cost |
|---|---|---|---|---|
| **DIRECT** | `direct-Edit` (no orchestrator session) | L4=`fix` (≤5 LOC, 1 file), standalone, not load-bearing | 0 | minimal (1 Edit) |
| **SOLO** | `Mode A inline` (one Opus session, pasted kickoff) | L4=`I-phase-small` (≤80 LOC, 1 surface), scope decided, no R-phase needed | 1 | ~30-50k tokens |
| **BUNDLE** | `Mode A inline` with multi-item kickoff + GO/REMOVE-IDX/STOP touchpoint | L4=`fix` AND ≥3 sibling fix-items in backlog (per [`bundle-autonomous/kickoff.md §1` B1](../../../.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md) eligibility filter) | 1 (or 1+inline parallel) | ~30-60k per bundle |
| **PAIR** | `SDD` (implementer + spec-reviewer + code-quality-reviewer subagents in same session) per [SSOT #64](../prior-art-evaluations.md) | L4=`I-phase-small` OR `I-phase-large` with single coherent surface AND (load-bearing path OR independent verification required) | 2 | ~80-120k |
| **DECOMPOSE** | `Mode B × N worktrees` per [`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md) | L4=`I-phase-large` (>80 LOC OR ≥2 surfaces) with parallel-safe sub-waves AND R-phase complete | meta + sub-orchestrators + workers | ~150k+ |
| **RESEARCH** | `R-phase-session` (single) OR `Queue mode` (≥2 sequential R-iterations) | L4=`R-phase` (keyword match: research / prior-art / survey) — fires highest priority regardless of LOC | 1 | ~30-120k depending on sequential queue length |

**Mode selection is not optional UX dressing** — alias label appears in §SKILL.md `## Dependency graph` and `## 1-liner blocks` rendered output ([output-format.md §2, §4](../../../.claude/skills/pipeline/references/output-format.md)), and `classify-work.sh` emits both `DISPATCH=<internal>` and `ALIAS=<user-facing>` lines (§8 mapping below).

---

## §5 Routing decision tree

Pseudo-code that meta-orchestrator §SKILL.md body executes after L1-L5 helpers:

```text
for each surfaced item (from L1+L2 sweep, dedup'd by L3):
    {TYPE, DISPATCH, LOC, SURFACES, RATIONALE} = classify-work.sh(item)
    {recommended_skill, recommended_agent} = assign-skill.sh(TYPE, item.description)
    load_bearing = item.paths INTERSECTS REQUIRED_HEADER_DOCS    # principle 09 list
    sibling_count = count(backlog where TYPE==item.TYPE && file_scopes are disjoint)
    scope_decided = (R-phase patch exists for item) OR (decision-needed resolved per maintainer)
    parallel_safe = (item.kickoff declares "parallel-safe sub-waves" section) OR (sub-wave file_scopes disjoint per ls + grep)
    bundle_opt_in = (--mode-bundle CLI flag) OR (default: TRUE for L4=fix items, see §11 anti-pattern guard)
    review_required = (--mode-pair CLI flag) OR (item.kickoff declares "review-required" hint) OR (load_bearing)

    # Priority routing — R-phase trumps size
    if TYPE == "R-phase":
        Mode = "RESEARCH"   # R-phase-session or Queue mode (§4)

    elif TYPE == "fix":
        if sibling_count >= 3 AND bundle_opt_in:
            Mode = "BUNDLE"     # ≥3 mergeable fix items → bundle-autonomous flow
        else:
            Mode = "DIRECT"     # standalone fix, no orchestrator

    elif TYPE == "I-phase-small":
        if review_required:
            Mode = "PAIR"       # SDD: implementer + 2 reviewers
        else:
            Mode = "SOLO"       # Mode A inline alone

    elif TYPE == "I-phase-large":
        if not scope_decided:
            Mode = "RESEARCH"   # bounce back to R-phase first
        elif SURFACES >= 2 AND parallel_safe:
            Mode = "DECOMPOSE"  # Mode B × N worktrees
        else:
            Mode = "PAIR"       # single large surface → SDD with reviewers

emit dispatch prompt per output-format.md §1-§5 with ALIAS in heading
update wave-sequencing-plan.md §0 with new/closed rows (§7)
write state/last-check.json (§7)
```

**Predicate definitions (all deterministic):**
- `load_bearing` — `item.paths` (extracted from kickoff §3 or diff if PR exists) intersects `principle-09:REQUIRED_HEADER_DOCS` list (rules/principles/README/CLAUDE/AGENTS/agents/templates).
- `sibling_count` — count of other backlog items with identical TYPE whose file_scopes are disjoint (no shared edit paths) — runnable via `classify-work.sh` over each candidate + path-set intersection check.
- `scope_decided` — kickoff exists AND its §«binding spec» section is non-empty, OR a referenced research-patch carries non-DEFER verdict. Else FALSE → forces RESEARCH Mode.
- `parallel_safe` — kickoff declares explicit «parallel-safe sub-waves» section, OR mechanical check finds disjoint file_scopes across sub-waves. Conservative default = FALSE → forces PAIR Mode.
- `bundle_opt_in` — CLI flag `--mode-bundle` OR (silent default = TRUE for `fix` items, per §11; opt-out is `--mode-direct` for force-standalone).
- `review_required` — CLI flag `--mode-pair` OR kickoff hint OR `load_bearing` (any one is sufficient).

**Override flags** (§10) bypass auto-classify and force a Mode — emits `OVERRIDE=user-flag` line in dispatch prompt for audit trail.

---

## §6 Discovery scope extension (NEW work)

L1 today already covers (§1 status map): kickoff backlog, open/merged PRs, research-patches, wave-plan refs + 5 synthetic surfaces (cold-review-fixes / state.md PENDING / memory TODO-codify / stale PRs / wave-plan 🟡-🔲-DEFERRED).

L1 today **does NOT cover**:
- **`open-questions.md §13.x` raw entries** without kickoff (entries marked DEFER-permanent / DEFER-armed / OPEN-investigation).
- **`// TODO:` / `// FIXME:` / `// XXX:` markers in `packages/**/*.ts` source code.**
- **`research-patches/*/§future` sections** OR «Known residuals» / «MINOR observations» sections in patches without follow-up PR.

**Extension delivers** as additional synthetic-namespace candidates from `priority-score.sh` (forward-going style match with PR #214 — same emitter, same namespace convention):

```bash
# in priority-score.sh, alongside surfaces (a)-(e):
# (f) open-questions §13.x raw entries (no kickoff dir)
# (g) // TODO: / // FIXME: in packages/**/*.ts
# (h) research-patches §future + known-residuals sections
```

Namespace prefixes (chosen to never collide with real kickoff names): `openq-§13-<id>`, `todo-<file>-<line>`, `residual-<patch>-<anchor>`.

**Decision-needed surface (§12 DN-1):** scope of `// TODO:` scan — `packages/**/*.ts` only OR include `.claude/hooks/*.sh` OR include all source files? Conservative default = `packages/**/*.ts` only; expand on incident.

---

## §7 Persistence layer (NEW work — 2 components)

### §7.1 Sweep-since-last-check (`state/last-check.json`)

New artifact: `.claude/skills/meta-orchestrator/state/last-check.json`. **Side-car**, not master-plan.

Schema (deterministic JSON):

```json
{
  "last_check_ts": "2026-05-25T14:30:00Z",
  "last_check_git_head": "abc1234",
  "untracked_seen": [
    {"id": "openq-§13.42", "first_seen": "2026-05-24T..."},
    {"id": "todo-packages/core/foo.ts:42", "first_seen": "2026-05-25T..."}
  ],
  "closed_since_last": [
    {"id": "PR#225", "closed_at": "2026-05-25T10:45:00Z"}
  ]
}
```

**Diff semantics:** on each `/meta-orchestrator` invocation, compare L1+L2 current snapshot vs `untracked_seen` from JSON. Emit:
- `NEW-SINCE-LAST: <item-id>` for items absent from JSON
- `RESOLVED-SINCE-LAST: <item-id>` for JSON entries that no longer surface from L1+L2

Updated JSON written at end of invocation. Git-ignored (per `state/`-prefix convention for skill-local mutable state).

### §7.2 Master plan auto-update (`wave-sequencing-plan.md §0`)

**Decision-needed surface (§12 DN-2):** extend [`wave-sequencing-plan.md`](../wave-sequencing-plan.md) §0 to be meta-writable — or create new artifact `.claude/skills/meta-orchestrator/state/master-backlog.md`?

**This design's recommendation: extend existing `wave-sequencing-plan.md`.** Reasons:
- Already SSOT (skill already injects it inline at [SKILL.md:66](../../../.claude/skills/pipeline/SKILL.md) via `head -200 docs/meta-factory/wave-sequencing-plan.md`).
- New artifact = `#two-prompts-drift` risk per [`dual-implementation-discipline.md §8`](../../../.claude/rules/dual-implementation-discipline.md).
- Wave-plan §0 already has the table shape we need (rows with 🟡 / ✅ / 🔲 markers).

**Write discipline (mandatory):**
- Meta writes only to §0 rows it owns (new rows for `NEW-SINCE-LAST`, status flip for `RESOLVED-SINCE-LAST`).
- Meta NEVER edits §1+ (operational plan structure — maintainer-owned per [Artifact Ownership Contract](../../../CLAUDE.md)).
- Each meta-write commits with trailer `Meta-orchestrator-update: <timestamp> <invocation-id>` for audit trail.

---

## §8 Integration: SKILL.md wires L3/L4/L5 (INTEGRATION work)

Today SKILL.md §1-§4 calls only `plan-currency-check.sh` + `priority-score.sh` + `launch-table-generator.sh`. L3/L4/L5 helpers exist on disk but are dead code.

**Wiring placement (revised per cold-review B-2 — NO double-call to `priority-score.sh`):**

The new sub-section is positioned **AFTER today's §2 priority scoring** (NOT between §1 and §2 as originally drafted). Reason: today's §2 already invokes `priority-score.sh`; placing the new enrichment layer before §2 would cause a double-call (every `/meta-orchestrator` invocation paying double subprocess cost). Proposed name: **`§2.5 Dedup + classify + assign + route`**.

**§2.5 step sequence (operates on the candidate list emitted by today's §2 priority scoring):**

1. **L3 dup-detect** — invoke `${CLAUDE_SKILL_DIR}/helpers/dup-detect.sh` with the priority-ranked candidate list from §2 output. For each `FLAG_POTENTIAL_DUPE: <id>` emit — surface as confirmation question to maintainer per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) surface-as-decision-needed pattern. Do NOT auto-suppress dupes.
2. **L4 classify** — for each surviving candidate (post-dedup), invoke `${CLAUDE_SKILL_DIR}/helpers/classify-work.sh "$item"`. Captures `TYPE` / `DISPATCH` / `LOC` / `SURFACES` / `RATIONALE` per item.
3. **L5 propose skill/agent** — for each classified item, invoke `${CLAUDE_SKILL_DIR}/helpers/assign-skill.sh "${item.TYPE}" "${item.description}"`. Output is `recommended_skill: <slug>` or `recommended_agent: <path>` or `recommended: none`.
4. **Apply routing decision tree** per §5 of this design doc to derive Mode per item. Emit ALIAS in dispatch prompt heading per §9 (single source — SKILL.md body, computed AFTER routing tree has all predicates).
5. **Proceed to today's §3 (launch-table)** using the enriched, routed candidate set.

**Order rationale (within §2.5):** L3 dedup first (don't classify already-done work), L4 classify second (TYPE needed for L5 + routing), L5 third (consumes TYPE), routing last (consumes all of TYPE + predicates).

**Cost saving from §2.5 placement vs original §1.5:** L3/L4/L5 now run only on the **priority-ranked top-K candidates** (typically K≤5 from today's §2), not on the full L1 sweep (often 20+ surfaces). Helper invocations drop from ~3×N to ~3×K — saves ≥75% of bash subprocess cost.

The exact `!shell` injection syntax follows the existing convention in [SKILL.md §1](../../../.claude/skills/pipeline/SKILL.md) lines 56-68 (plan-currency-check + REPORT reconciliation).

---

## §9 User-facing alias layer (MINOR work)

**Architecture (revised per cold-review B-1 — single source, no inline emit):**

ALIAS is computed and emitted ONLY in SKILL.md body, AFTER the §5 routing decision tree runs in §2.5 (per §8). `classify-work.sh` output stays UNCHANGED (deterministic `TYPE` / `DISPATCH` / `LOC` / `SURFACES` / `RATIONALE` only).

**Reason for single-source architecture:** ALIAS conditions depend on routing predicates (`sibling_count`, `load_bearing`, `parallel_safe`, `scope_decided`, `review_required`, `bundle_opt_in`) that are NOT inputs to `classify-work.sh`. Trying to emit ALIAS from the helper would require passing the full routing context as arguments, breaking helper determinism + helper-test seam patterns (REPO_ROOT / MO_GH_BIN / MO_WAVE_PLAN style). Cold-review B-1 (2026-05-25) identified this as architecturally impossible. Counter (this design): keep ALIAS in body, classify-work.sh untouched.

**ALIAS-from-routing mapping (mirrors §5 routing tree exactly):**

| ALIAS | DISPATCH (internal) | Fires when §5 routing tree resolves to |
|---|---|---|
| `DIRECT` | `direct-Edit` | TYPE=fix AND (sibling_count<3 OR NOT bundle_opt_in) |
| `BUNDLE` | `Mode-A-bundle` | TYPE=fix AND sibling_count≥3 AND bundle_opt_in |
| `SOLO` | `Mode-A` | TYPE=I-phase-small AND NOT review_required |
| `PAIR` | `Mode-SDD` | (TYPE=I-phase-small AND review_required) OR (TYPE=I-phase-large AND scope_decided AND (SURFACES<2 OR NOT parallel_safe)) |
| `DECOMPOSE` | `Mode-B` | TYPE=I-phase-large AND scope_decided AND SURFACES≥2 AND parallel_safe |
| `RESEARCH` | `R-phase-session` (single) OR `Queue-mode` (≥2 sequential) | TYPE=R-phase OR (TYPE=I-phase-large AND NOT scope_decided) |

This table is **1:1 with §5 routing tree branches** — every leaf in §5 maps to exactly one row here (no §5 branch missing, no extra row not in §5). Cold-review M-3 (2026-05-25) caught the original asymmetry where §9 PAIR row didn't include `I-phase-large` fallback; this version closes that gap.

`Mode-A-bundle` is new sub-dispatch (the only genuinely-new internal name) — formalises BUNDLE's relationship to existing Mode A. Defined fully in [`bundle-autonomous`](../../../.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md) umbrella deliverable.

---

## §10 Override flags (MINOR work)

`/meta-orchestrator <task> [--mode-direct | --mode-solo | --mode-bundle | --mode-pair | --mode-decompose | --mode-research]`

Override behaviour:
- Skips routing decision tree (§5)
- Forces specified Mode
- Emits `OVERRIDE=user-flag, reason=<≥20 chars from CLI arg or prompt>` line in dispatch prompt body
- §1.7 forward-check requires override rationale ≥20 chars (parallel to [`Prior-art: skipped — <reason>`](../../../CLAUDE.md) escape hatch)

**Anti-pattern:** `#override-as-default` — using `--mode-solo` for every task because user finds auto-classify annoying. Counter: log overrides in `state/last-check.json`; if rate >30% over 10 invocations, surface to maintainer as «auto-classify may need tuning».

---

## §11 Bundle integration (EXTERNAL handoff)

BUNDLE Mode depends on [`bundle-autonomous/kickoff.md`](../../../.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md) R-phase + I-phase shipping its B1/B2/B3 mechanisms:
- B1 = eligibility filter (matches §5 routing tree above)
- B2 = approval UX (GO / REMOVE-IDX / STOP touchpoint)
- B3 = auto-dispatch loop (sequential Worker per L5 routing)

**Handoff discipline:** this design's §5 routing tree merely DECIDES BUNDLE; the bundle MECHANISM lives in external umbrella. When `bundle-autonomous` R-phase ships verdict + I-phase ships B1/B2/B3 → this design's §5 routing tree connects to it via single function call `bundle-curate.sh` (per bundle-autonomous kickoff §1).

**This design does NOT block on bundle-autonomous completion.** Other Modes (DIRECT/SOLO/PAIR/DECOMPOSE/RESEARCH) can ship independent of BUNDLE.

---

## §12 Decision-needed surface (for maintainer review)

Three decisions deferred to maintainer per [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) surface-as-decision-needed pattern:

| # | Decision | Options | Design recommendation |
|---|---|---|---|
| **DN-1** | Scope of `// TODO:` scan (§6) | (a) `packages/**/*.ts` only / (b) include `.claude/hooks/*.sh` / (c) include all source | (a) conservative; expand on incident |
| **DN-2** | Master-plan persistence location (§7.2) | (a) extend `wave-sequencing-plan.md §0` / (b) new artifact `state/master-backlog.md` / (c) both | (a) extend existing SSOT |
| **DN-3** | ~~Alias layer split (§9)~~ — **RESOLVED 2026-05-25 via cold-review B-1.** Architecture: single source = SKILL.md body, computed AFTER routing tree; `classify-work.sh` UNCHANGED. Inline emit option (a) is architecturally impossible per §0 T-MO-design-A. | n/a (resolved) | n/a |

Maintainer answers in design review (§14) before R-phase + umbrella kickoff.

---

## §13 Next step: R-phase + umbrella kickoff (NOT writing-plans)

**Recursive self-application result:** this design's scope (≥4 NEW work items + 3 INTEGRATION + 1 EXTERNAL = ≥7 surfaces, LOC estimate ≥200) classifies as L4=`I-phase-large` → DECOMPOSE Mode per §5 routing tree.

Therefore:
- ❌ NOT writing-plans skill (designed for single-session implementation).
- ✅ R-phase prior-art survey (BFR §3 mandate) on combined design.
- ✅ Umbrella kickoff at `.claude/orchestrator-prompts/meta-orchestrator-mode-triage-and-planner/kickoff.md` with stages.

**Proposed umbrella stages:**

- **Stage 1 (R-phase):** prior-art survey on 3 areas (discovery sweep / master-plan persistence / triage alias layer) per [BFR §3](../../../.claude/rules/build-first-reuse-default.md). Produces `2026-05-XX-meta-orchestrator-mode-triage-prior-art.md`. **GATE 1:** maintainer DECISION on §12 DN-1/DN-2/DN-3 + R-phase verdict acceptance.
- **Stage 2 (mixed parallel + serial I-phase sub-waves) — revised per cold-review B-1 (2C absorbed into 2D after alias inline emit was dropped):**
  - 2A — extend `priority-score.sh` with 3 new discovery surfaces (§6). **File scope:** `priority-score.sh` + paired-negative tests. **Parallel-safe with 2B.**
  - 2B — add persistence layer `state/last-check.json` (§7.1) **+ `.claude/skills/meta-orchestrator/.gitignore`** with `state/` entry (m-1 follow-up). **File scope:** new `state/` dir + helper + new .gitignore + tests. **Parallel-safe with 2A.**
  - 2C — wire new SKILL.md §2.5 (L3/L4/L5 invocations per §8) + alias mapping table per §9 (single artefact, both edits land together since both touch SKILL.md). **File scope:** `SKILL.md` + new principle test for §9 alias↔§5 routing consistency. **Serial — must follow 2A+2B** (SKILL.md §2.5 example needs to reference the extended `priority-score.sh` output schema from 2A + the new state/ helper signatures from 2B).

  Parallel sub-waves 2A and 2B ship in separate worktrees per [`parallel-subwave-isolation.md`](../../../.claude/rules/parallel-subwave-isolation.md). Serial sub-wave 2C runs in shared workdir after 2A+2B merge to staging. **GATE 2:** all 3 sub-wave PRs merged to staging.
- **Stage 3 (I-phase serial):** master-plan auto-update mechanism (§7.2) — single PR, depends on Stage 2 wiring being complete.
- **Stage 4 (I-phase, optional):** override flags (§10) — only if Stages 2-3 stable.
- **Stage 5 (dogfood):** first `/meta-orchestrator` invocation on a real backlog item using new pipeline + cold-review by separate session per [T19](../../../.claude/rules/ai-laziness-traps.md).

**BUNDLE Mode integration (§11) handled by EXTERNAL [`bundle-autonomous`](../../../.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md) umbrella — separate scheduling, this umbrella does NOT block on it.**

---

## §14 §1.7 Forward + Backward check

### Forward — complies with which project rules

- ✅ [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md): ADOPT-VERBATIM existing Mode A/B/SDD/Queue/R-phase vocab (no new internal naming); ADAPT existing L1-L5 helpers (no rewrite); BUILD only for: master-plan persistence (§7.2), `// TODO:` scan extension (§6), alias layer (§9), override flags (§10) — each with §13 Stage 1 prior-art mandate before commitment.
- ✅ [`no-paid-llm-in-ci.md §1`](../../../.claude/rules/no-paid-llm-in-ci.md): all new helpers deterministic bash; alias layer is plain string mapping; no API-billed calls anywhere.
- ✅ [`doc-authority-hierarchy.md §3`](../../../.claude/rules/doc-authority-hierarchy.md): this doc carries header with Authoritative-for + NOT-authoritative-for at top.
- ✅ [`dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md): all new helpers are CC-specific (run via `!shell` injection in skill body); each gets `@cc-only-rationale` marker at file ship time. SKILL.md ↔ helpers pair stays single-SSOT per §7.
- ✅ [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md): canonical T1-T16+T19+T20 enumerated in §0 + domain-specific **T-MO-design-A «alias inline emit attractor»** added per §3 obligation («≥1 domain-specific trap that is NOT in the canonical catalogue»); no blanket reference per `#trap-catalogue-blanket-reference` (§4 anti-pattern).
- ✅ [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md): 3 DECISION-NEEDED surfaced (§12); not picked unilaterally.
- ✅ [`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md): Stage 2 sub-waves explicit worktree mandate (§13).
- ✅ [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md): this section is the §1.7 check.

### Backward — what is superseded or affected

- **No artifact is superseded** by this design.
- **`wave-sequencing-plan.md §0`** gains meta-write rows (§7.2) — write rules per §7.2 protect §1+ from meta touching.
- **`SKILL.md §2`** gains §2.5 AFTER today's §2 priority scoring (§8, revised per cold-review B-2 — avoids double-call to `priority-score.sh`) — does not modify §1, §2, or downstream sections.
- **`classify-work.sh`** — UNCHANGED (per §9 single-source architecture + §12 DN-3 resolution + §0 T-MO-design-A). ALIAS is computed in SKILL.md body AFTER the §5 routing tree runs in §2.5 — NOT emitted by the helper. Helper output schema (TYPE/DISPATCH/LOC/SURFACES/RATIONALE) stays exactly as-is.
- **[`bundle-autonomous/kickoff.md`](../../../.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md)** unchanged; design's §11 just declares the routing-tree hand-off point. External umbrella scheduling unaffected.
- **No `.claude/rules/*.md` modified.**
- **No `principles/*.test.ts` modified by design** — Stage 2D may add new sync test for alias mapping; specific principle slot TBD in Stage 1 R-phase.
- **SSOT [`prior-art-evaluations.md`](../prior-art-evaluations.md)** will gain 3-5 new rows after R-phase Stage 1 ships verdicts. Rows NOT added in this design doc (separate atomic step per [`feedback_no_drive_by_prs`](../../../CLAUDE.md)).

---

## §15 See also

- [.claude/skills/meta-orchestrator/SKILL.md](../../../.claude/skills/pipeline/SKILL.md) — the skill body this design extends
- [.claude/skills/meta-orchestrator/references/output-format.md](../../../.claude/skills/pipeline/references/output-format.md) — output format frozen by principle 18
- [.claude/skills/meta-orchestrator/helpers/](../../../.claude/skills/pipeline/helpers/) — 6 helpers (L1-L5 + launch-table)
- [.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md](../../../.claude/orchestrator-prompts/meta-orchestrator-bundle-autonomous/kickoff.md) — EXTERNAL bundle direction umbrella
- [docs/meta-factory/research-patches/2026-05-25-planner-completeness-prior-art.md](2026-05-25-planner-completeness-prior-art.md) — prior-art survey that produced L3/L4/L5
- [docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md](2026-05-23-meta-orchestrator-prior-art.md) — original meta-orchestrator R-phase patch
- [docs/meta-factory/wave-sequencing-plan.md](../wave-sequencing-plan.md) — master plan that §7.2 will meta-update
- [packages/core/principles/18-meta-orchestrator-output-format.test.ts](../../../packages/core/principles/18-meta-orchestrator-output-format.test.ts) — output-format mechanical enforcement
- [packages/core/skills/planner-discovery.test.ts](../../../packages/core/skills/planner-discovery.test.ts) — L1 paired-negative tests (PR #214)
- [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md), [.claude/rules/doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md), [.claude/rules/ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md), [.claude/rules/no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md), [.claude/rules/dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md), [.claude/rules/parallel-subwave-isolation.md](../../../.claude/rules/parallel-subwave-isolation.md), [.claude/rules/reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md), [.claude/rules/phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md) — discipline rules consulted in §14 forward-check
