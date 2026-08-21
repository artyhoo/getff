# KICKOFF — meta-orchestrator planner-completeness

> **Type:** mixed umbrella — Stage 1 = R-phase prior-art survey (no-build, $0); Stages 2-3 = small I-phase builds (L1+L2); Stage 4 = decision-gate on L3-L5.
> **Origin:** gap surfaced 2026-05-25. Maintainer started authoring `.claude/orchestrator-prompts/meta-orchestrator-linear-autonomous/kickoff.md` unaware that PR #205 had merged the same 12 items + principle 18 test 7 hours earlier. `plan-currency-check.sh` enumerates `kickoff.md` only — no semantic dup-detect, no scan of `cold-review-fixes.md` / `state.md PENDING` / memory `TODO-codify:` / stale §0 rows. **Symptom of structural gap, not isolated bug.**
> **Bootstrap rationale (maintainer choice 2026-05-25, Option A):** upgrade meta-orchestrator first → it then discovers `mutation-discipline-umbrella` + cold-review-fixes handoff + everything else in correct order itself. Pays compound interest vs doing mutation-discipline first while skill stays blind.
> **Deliverable:**
>   1. R-phase: research-patch surveying prior art (TaskMaster, Linear, Devin/OpenHands/swe-agent planners, Cursor composer, Superpowers `subagent-driven-development`) per L3/L4/L5; ADOPT/ADAPT/BUILD/REJECT verdict each.
>   2. I-phase (small): L1 (discovery surface extension) + L2 (reverse-currency check) merged into helpers + SKILL.md §1-§2.
>   3. Decision gate: L3-L5 GO/DEFER/DROP per R-phase verdict.
> **Base branch:** `staging` (NOT `main`).

---

## §0 Cold-start verification (read FIRST)

Before reading further — confirm these still hold:

1. **PR #205 confirms problem class.** `gh pr view 205 --json title,mergedAt` returns `"feat(meta-orchestrator): F.3 — UX implementation per G §1.5 12 items"` + `2026-05-24T21:08:36Z`. Yes → the incident this umbrella addresses is real. No → re-read origin paragraph; problem statement may have drifted.
2. **Current helper enumeration surface is `kickoff.md`-only.** `grep -E 'kickoff\.md' .claude/skills/meta-orchestrator/helpers/priority-score.sh .claude/skills/meta-orchestrator/helpers/plan-currency-check.sh` returns matches; no scanner for `cold-review-fixes.md` / `state.md` / memory / `wave-sequencing-plan.md §0` open rows. Confirms L1 scope.
3. **Cold-review handoff for mutation-discipline is parked, not lost.** `ls .claude/orchestrator-prompts/mutation-discipline-umbrella-meta-launch/cold-review-fixes.md` exists. After L1 lands, fresh `/meta-orchestrator` invocation should discover this file → priority queue automatically.
4. **`meta-orchestrator-linear-autonomous/kickoff.md` decision deferred.** Maintainer-owned: abandon (#205 closed it) vs rescope to D-G-1 Option B delta only. Out-of-scope here; tracked separately.

---

## §1 The gap — 5 layers (from 2026-05-25 decomposition)

| Layer | What | Class | Stage |
|---|---|---|---|
| **L1** | **Discovery surface extension.** `priority-score.sh` + `plan-currency-check.sh` scan beyond `kickoff.md`: `cold-review-fixes.md`, `state.md` with PENDING/TODO/AWAITING markers, memory files with `TODO-codify:`, stale open PRs (>14d inactive), `wave-sequencing-plan.md §0` rows marked 🟡 / 🔲 NOT blocked / DEFERRED. Each surfaced item gets a synthetic «pseudo-kickoff» entry in candidate list. | I-phase, S (~80 LOC bash) | 2 |
| **L2** | **Reverse currency.** Today checks `plan claims → reality` (DRIFT when §0 says merged but PR absent). Add the reverse: `reality → plan` (merged PR not reflected in §0; new kickoff added without §0 update; cold-review-fixes.md without queue entry). Surface as `UNTRACKED-N:` items. | I-phase, S (~40 LOC bash) | 3 |
| **L3** | **Semantic dup-detect.** When scoring candidate `X`, compare its scope/item-list against merged PRs in last 30d. Heuristic: ≥80% items textual overlap + matching numbering → `FLAG_POTENTIAL_DUPE: <candidate> may overlap with merged #N`. The #205-incident-class. | I-phase, M (text similarity; needs prior-art survey) | 5 (after R-phase) |
| **L4** | **Decomposition heuristics.** Surfaced work auto-classified: `fix` (≤5 LOC, 1 file → inline Edit) / `R-phase` (research-patch) / `I-phase-small` (≤80 LOC, 1 surface, Mode A) / `I-phase-large` (>80 LOC OR ≥2 surfaces → umbrella with sub-waves). | I-phase, M (rules-based + maybe template generation) | 5 (after R-phase) |
| **L5** | **Skill/agent assignment.** For each queued item: propose dispatch mode (Mode A/B/SDD/Queue), recommended skill (`vitest` / `playwright` / `ui-designer-react` / etc.), or AI-agnostic sub-agent (`compliance-verifier` / `living-docs-auditor` / new). | I-phase, M (lookup tables + rule application) | 5 (after R-phase) |

**L1+L2 = cheap deterministic bash, can ship without R-phase.** L3+L4+L5 = require prior-art survey (BFR §3 mandatory) before BUILD.

---

## §2 Sub-wave decomposition (stage gates)

### Stage 1 — A. Prior-art survey for L3/L4/L5 (R-phase, $0, ~1-2h)

**Goal:** survey ≥3 production candidates per layer (BFR §3 + phase-research-coverage 6-item checklist), output ADOPT/ADAPT/BUILD/REJECT verdict each, with SSOT row proposals.

**Candidates to investigate (NOT exhaustive — adversarial counter-prompt T7 may surface more):**

- **L3 dup-detect:**
  - GitHub `gh search prs` semantic search + Levenshtein/Jaccard similarity (cheap, deterministic).
  - DeepWiki repository inspection (semantic Q&A — but `no-paid-llm-in-ci §1` constraint excludes paid API; only OK as session-bound read).
  - Linear `gh linear` integration (does Linear track item-list overlap?).
  - **Verify T16:** does upstream «duplicate detection» = our «kickoff vs merged-PR-scope» problem class?

- **L4 decomposition:**
  - TaskMaster (commercial, but inspect public docs for heuristic taxonomy).
  - Cursor `composer` planning mode (free tier — observe behaviour).
  - Devin / OpenHands / swe-agent planner subagents (open-source, planner architectures).
  - Superpowers `subagent-driven-development` (already SSOT #64; verify problem-class match per T16).
  - Anthropic «building effective agents» blog patterns (orchestrator-worker, evaluator-optimizer).

- **L5 skill/agent assignment:**
  - Cursor `.cursorrules` activation patterns (skill auto-load by file glob).
  - Claude Code skill `when_to_use` mechanism (already in repo via `ai-docs` skill).
  - Superpowers skill orchestrator dispatch (which skill calls which sub-agent).

**Steps:**
1. For each candidate: DeepWiki + WebSearch (≥3 phrasings each per phase-research-coverage); record problem-class + match verification (T16).
2. Write `docs/meta-factory/research-patches/2026-05-XX-planner-completeness-prior-art.md` with sections:
   - §1 — L3 candidates table (name × verdict × rationale × falsifier)
   - §2 — L4 candidates table (same shape)
   - §3 — L5 candidates table (same shape)
   - §4 — Cross-layer composition: does L3+L4+L5 stack coherently or do they fight?
   - §5 — **Recommendation per layer**: ADOPT / ADAPT / BUILD / REJECT / DEFER + SSOT row proposals.
   - §6 — Stop-condition check: any layer where ALL candidates surfaced are unsuitable (BUILD verdict) → escalate as «native build proposed; second-opinion needed before Stage 5 dispatch».

**Stage 1 → Stage 2 gate:**

```bash
ls docs/meta-factory/research-patches/2026-05-*-planner-completeness-prior-art.md
```

**Stop conditions:**

- **F-A1** — R-phase finds mature upstream covering 80%+ of L3+L4+L5 → re-scope umbrella to ADOPT/integration work, drop BUILD sub-waves. Surface to maintainer.
- **F-A2** — R-phase finds zero candidates with verified problem-class match for any layer (T16 fails everywhere) → full native BUILD; escalate scope estimate before Stage 5.

### Stage 2 — B. L1 discovery surface extension (I-phase, ~80 LOC)

**Pre-condition:** none (independent of Stage 1 outcome; L1 is bash, no prior-art-blocking).

**Goal:** extend `priority-score.sh` + `plan-currency-check.sh` to enumerate all 5 non-kickoff surfaces named in §1 L1.

**Implementation sketch (NOT prescriptive — Worker may diverge with rationale):**

```bash
# Pseudo-kickoff synthesis from cold-review-fixes.md presence
find .claude/orchestrator-prompts -name 'cold-review-fixes.md' | while read f; do
  umbrella=$(basename "$(dirname "$f")")
  echo "${umbrella}-cold-review-fixes type=cleanup kickoff=synthetic source=cold-review-fixes loc=$(wc -l <"$f")"
done

# State.md with PENDING/TODO/AWAITING
find .claude/orchestrator-prompts -name 'state.md' | xargs grep -l -iE 'PENDING|TODO|AWAITING|REVIEW-PENDING' 2>/dev/null | while read s; do
  umbrella=$(basename "$(dirname "$s")")
  echo "${umbrella}-state-pending type=state-followup kickoff=synthetic source=state.md"
done

# Memory TODO-codify
MEM_DIR="${HOME}/.claude/projects/-Users-art-code-rules-as-tests-aif/memory"
[ -d "$MEM_DIR" ] && grep -lE 'TODO-codify:' "$MEM_DIR"/*.md 2>/dev/null | while read m; do
  echo "memory-codify-$(basename "$m" .md) type=memory-followup kickoff=synthetic source=memory"
done

# Stale open PRs
gh pr list --state open --json number,title,updatedAt --limit 30 \
  | jq -r '.[] | select((now - (.updatedAt | fromdate)) > 1209600) | "stale-pr-\(.number) type=stalled kickoff=synthetic source=open-pr loc=\(.title|length)"'

# wave-sequencing-plan §0 rows marked 🟡 / 🔲 NOT blocked
grep -E '^\| [A-Z][0-9]+[a-z]?\s+\|' docs/meta-factory/wave-sequencing-plan.md \
  | grep -E '🟡|🔲.*NOT blocked|DEFERRED' \
  | sed -E 's/^\| ([^ ]+) .*$/wave-plan-\1 type=plan-followup kickoff=synthetic source=wave-plan/'
```

**Sanity:** synthetic entries must NOT shadow real `kickoff.md` entries — namespace prefix `<umbrella>-<reason>` keeps them distinct.

**Test surface (paired-negative per principle 02):**

- `packages/core/skills/planner-discovery.test.ts` — given fixture dir with cold-review-fixes.md + memory TODO-codify + stale PR mock, scanner emits 3 synthetic entries. Negative: remove a fixture → emit drops to 2.

**Stage 2 → Stage 3 gate:**

```bash
gh pr list --search "head:feat/mo-l1-discovery-surface base:staging is:merged" --json number --limit 5 | jq 'length >= 1'
```

### Stage 3 — C. L2 reverse-currency (I-phase, ~40 LOC)

**Pre-condition:** Stage 2 merged (Worker reuses extended scanner).

**Goal:** add `plan-currency-check.sh` step that emits `UNTRACKED-N: <evidence>` for reality→plan mismatches.

**Implementation sketch:**

```bash
# For each merged PR in last 30d, check if §0 / Track tables reference it
gh pr list --state merged --limit 100 --json number,title,mergedAt --search "merged:>$(date -v-30d +%Y-%m-%d)" \
  | jq -r '.[].number' | while read pr; do
  if ! grep -q "#${pr}" docs/meta-factory/wave-sequencing-plan.md; then
    echo "UNTRACKED-${pr}: merged PR #${pr} not referenced in wave-sequencing-plan.md"
  fi
done

# For each kickoff.md not on §0's tables, surface as UNTRACKED-KICKOFF
ls .claude/orchestrator-prompts/*/kickoff.md | while read k; do
  umbrella=$(basename "$(dirname "$k")")
  if ! grep -q "$umbrella" docs/meta-factory/wave-sequencing-plan.md; then
    echo "UNTRACKED-KICKOFF: ${umbrella} has kickoff.md but not in §0"
  fi
done
```

**Test surface:** add cases to `packages/core/skills/planner-discovery.test.ts` covering both UNTRACKED categories with paired-negative.

**Stage 3 → Stage 4 gate:**

```bash
gh pr list --search "head:feat/mo-l2-reverse-currency base:staging is:merged" --json number --limit 5 | jq 'length >= 1'
```

### Stage 4 — D. L3/L4/L5 decision gate (no-build)

**Pre-condition:** Stage 1 R-phase shipped + Stages 2-3 merged.

**Goal:** maintainer + this kickoff's author session jointly decide each of L3/L4/L5: **GO** (proceed to Stage 5) / **DEFER** (separate umbrella later) / **DROP** (insufficient evidence of value).

**Inputs:** Stage 1 §5 recommendations + Stage 2-3 actual surface counts (do L1+L2 already catch 60%+ of cases? If yes — L3-L5 may be lower priority).

**Output:** decision recorded in `state.md` (this umbrella's meta-launch state) + memory entry codifying verdict.

### Stage 5 — E. L3+L4+L5 implementation (conditional, deferrable)

**Pre-condition:** Stage 4 emits GO for ≥1 of L3/L4/L5.

**Scope:** per Stage 1 §5 verdicts + Stage 4 decisions. Decomposed into separate sub-waves per layer at that time (not pre-decomposed here per T2 anti-pattern — designing without data).

---

## §3 AI-laziness traps active

Per [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). **Active for this umbrella: T1, T2, T3, T7, T10, T11, T12, T13, T15, T16, T17, T19** + 2 domain-specific.

- **T1 (sampling shallow):** Stage 1 prior-art survey ≥3 candidates per layer, NOT «I know TaskMaster, skip survey».
- **T2 (methodology theatre):** Stage 1 outputs verdict + evidence, NOT just «here's my methodology, layer-by-layer would find X».
- **T3 (no prose-only):** every candidate row in §1/§2/§3 prior-art table has command + output OR file:line citation.
- **T7 (literal prompt-match):** «adversarial counter-prompt» (T7 of T7) — Stage 1 must run a «what candidate did I miss?» check after first pass.
- **T10 (population enumeration):** before scoring «80% match», enumerate full merged-PR population in window.
- **T11 (custom solution before prior-art):** L3+L4+L5 sketches in §1 are **non-binding** — if Stage 1 finds upstream, drop sketch.
- **T12 (skip literature):** WebSearch for «autonomous planner agent», «LLM orchestrator decomposition», «AI work queue ranking» — NOT from memory.
- **T13 (ADOPTED ≠ zero-work):** if Stage 1 verdict = ADOPT Superpowers `subagent-driven-development`, still audit that SP's planning surface matches ours (T16).
- **T15 (self-application):** the planner being built MUST be able to discover ITS OWN kickoff. Recursive: after Stage 2 lands, re-run `priority-score.sh` from a fresh invocation → this umbrella's kickoff appears in output. Dogfood gate.
- **T16 (pattern-matching-on-name):** «TaskMaster is a planner so it solves our problem» → verify upstream problem class explicitly. «`subagent-driven-development` does decomposition» → verify it decomposes the same class (multi-stage R+I waves) as we need.
- **T17 (preserve before delete):** if Stage 2-3 supersede parts of existing helpers, preserve old version semantics (capability not removed) before refactor.
- **T19 (own QA before handoff):** every Worker REPORT in this umbrella includes own cold-review of own diff BEFORE handoff. CI green ≠ design review.

**Domain-specific:**

- **T-PC-A — «planner-can-discover-its-own-work» (recursive blindness).** Tempted: ship L1+L2, declare DONE, never test whether the upgraded planner can find ITS OWN follow-up kickoffs. Counter: §2 Stage 2 dogfood gate (re-run `priority-score.sh` after L1 lands; this umbrella's kickoff MUST appear).
- **T-PC-B — «shallow surface scan ≠ planner».** Tempted: ship L1 surface extension, claim «meta-orchestrator is now a planner». Counter: L1+L2 = discovery + currency; L3+L4+L5 = actual planning (decompose, rank, assign). L1+L2 alone is **better orchestrator, not a planner**. Naming discipline.

---

## §4 Recursive self-application

The planner being built must be able to find ITSELF. Concretely after Stage 2:

```bash
# From primary workdir, fresh invocation
bash .claude/skills/meta-orchestrator/helpers/priority-score.sh \
  | grep -E 'meta-orchestrator-planner-completeness'
```

Expected: kickoff entry present (real kickoff.md). After L2 lands, ALSO expected: `UNTRACKED-KICKOFF: meta-orchestrator-planner-completeness has kickoff.md but not in §0` (until maintainer adds it to wave-sequencing-plan §0 Track P).

**The Catch-22 (acknowledged):** until L1 lands, this kickoff is itself invisible to meta-orchestrator (`kickoff.md` IS enumerated, so actually it WILL show up — but cold-review-fixes.md from previous handoff WON'T until L1 lands). So this kickoff bootstraps cleanly through L1.

---

## §5 §1.7 forward+backward checks (umbrella-level)

**Forward-check** — this umbrella complies with:

- [no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md) — all helpers deterministic bash; L3 dup-detect via Jaccard/Levenshtein (no LLM-in-CI).
- [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md) — Stage 1 R-phase MANDATORY prior-art survey before L3/L4/L5 BUILD; DeepWiki + WebSearch ≥3 phrasings per candidate.
- [phase-research-coverage.md §1 + §1.7](../../../.claude/rules/phase-research-coverage.md) — Stage 1 = R-phase before any I-phase Stage 5 build.
- [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md) — Phase -1 cold-review between Stages 2/3/4/5 mandatory.
- [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md) — Stages here are sequential (linear-autonomous), no parallelism, no worktree split needed beyond standard.
- [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) — §3 above enumerates T-numbers + 2 domain T-PC-* traps.
- [dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md) — L1+L2 are bash helpers + tested via paired-negative; no dual-channel needed (CC-internal tooling per §3 «internal — default CC-native only»).
- [doc-authority-hierarchy.md §2 filename convention](../../../.claude/rules/doc-authority-hierarchy.md) — `kickoff.md` in named umbrella dir, scope implicit by filename + dir name. No per-file Authoritative-for header.

**Backward-check** — scope sweep:

- Supersedes the «meta-orchestrator gap» finding I flagged 2026-05-25 (was «add FIX-9 to cold-review-fixes.md»). FIX-9 not separately added — this umbrella IS FIX-9, properly scoped.
- Does NOT supersede `mutation-discipline-umbrella` (orthogonal scope: this is meta-tool; that's discipline-theatre closure).
- Does NOT supersede `meta-orchestrator-linear-autonomous/kickoff.md` decision (separate concern; that file's fate is maintainer-owned).
- Does NOT introduce retroactive sweep across other skills (per dual-implementation-discipline.md §9 forward-going).

---

## §6 Stop conditions

- **F1** — Stage 1 prior-art finds mature upstream covering L3+L4+L5 at 80%+ → ADOPT-only umbrella, drop BUILD scope. Surface to maintainer.
- **F2** — Stage 1 surfaces zero match for any layer (all 9+ candidates fail T16 problem-class match) → escalate; native BUILD scope ≥2x estimated.
- **F3** — Stage 2 (L1) breaks existing kickoff enumeration (false-negative on real kickoffs) → revert, narrow synthetic-entry detection.
- **F4** — Stage 2 dogfood gate fails (this kickoff not findable by upgraded scanner) → recursive-self-application broken; STOP, debug.
- **F5** — Stage 3 (L2) UNTRACKED count > 50 on first run → likely false-positive bloat; tighten filter or split into sub-rules.
- **F6** — Stage 4 decision deferred indefinitely (maintainer not engaged) → umbrella parked at Stage 4 with state.md FROZEN; not abandoned.

---

## §7 Done =

Umbrella complete when:

1. ✅ Stage 1 research-patch shipped (`research-patches/2026-05-XX-planner-completeness-prior-art.md`) with verdict per L3/L4/L5.
2. ✅ Stage 2 L1 merged to staging with paired-negative test.
3. ✅ Stage 3 L2 merged to staging with paired-negative test.
4. ✅ Dogfood gate passes: fresh `priority-score.sh` invocation discovers `meta-orchestrator-planner-completeness/kickoff.md` + cold-review-fixes.md from mutation-discipline meta-launch.
5. ✅ Stage 4 decision recorded for L3/L4/L5 (GO/DEFER/DROP).
6. ✅ Phase -1 cold-review GO on each merged sub-wave.
7. ✅ Memory entry codifying: gap origin (#205 incident), what shipped, what deferred, T-PC-A/B traps registered.
8. ✅ wave-sequencing-plan.md §0 updated to add Track P (planner) — folded into the queued §0-reconcile PR or done separately.

---

## §8 See also

- `cold-review-fixes.md` (in mutation-discipline-umbrella-meta-launch/) — the handoff doc whose discoverability gap motivated this umbrella.
- `meta-orchestrator-linear-autonomous/kickoff.md` — duplicate of #205, decision pending; not in scope here.
- PR #205 — the surfacing incident (merged 2026-05-24T21:08:36Z).
- `.claude/skills/meta-orchestrator/SKILL.md` §1-§2 — surface this umbrella's L1-L2 will modify.
- `.claude/skills/meta-orchestrator/helpers/*.sh` — primary I-phase target.
- Memory: `project_meta_orchestrator_full_autonomous_umbrella` (G-rphase precedent), `feedback_check_inflight_prs_before_building` (related discipline).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
