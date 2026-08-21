# KICKOFF — meta-orchestrator skill memory (I-phase)

> **Type:** I-phase build (not R-phase, not audit). 4 atomic deliverables.
> **Origin:** Maintainer dialogue 2026-05-25 (this conversation). The /meta-orchestrator skill currently has no cross-session memory — every invocation starts cold. Last-session findings (priority scores, surfaced DRIFT items, pending DECISION-NEEDED, deferred follow-ups) vanish unless they happened to land in a committed artefact.
> **Base branch:** `staging` (NOT `main`).
> **Mode:** single Mode A inline Opus session (Direct Edit). NOT parallel — 4 small edits with file-locks (SKILL.md + new helper + new cache template + wave-sequencing-plan.md). Worktree per [parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md) discipline.
> **Authority for this kickoff:** maintainer's verbatim 4-step list (this conversation, 2026-05-25); this file is the SSOT for the scope.

---

## §-1 RE-VERIFY THIS KICKOFF FIRST (mandatory before execution)

Per [reviewer-discipline.md §2](../../rules/reviewer-discipline.md) + [ai-laziness-traps.md T19 (own-QA before handoff)](../../rules/ai-laziness-traps.md):

1. **Read this entire kickoff cold** — pretend you didn't write it.
2. **Verify factual claims** against current repo state:
   - `cat .claude/skills/meta-orchestrator/SKILL.md | sed -n '49,90p'` — does §1 already use `!shell` injection? (this kickoff claims yes; line ~55-69.)
   - `ls .claude/skills/meta-orchestrator/helpers/` — does the list match §1.3 below? (this kickoff claims 6 helpers exist.)
   - `cat .gitignore | grep orchestrator-prompts` — is the path gitignored? (this kickoff depends on yes; if no, `_plan-cache.md` would leak into commits.)
   - `head -50 docs/meta-factory/wave-sequencing-plan.md` — does the Track P row for «Meta-orchestrator skill» exist? (this kickoff extends it; if absent, §1.4 changes shape.)
3. **Phase -1 cold-reviewer subagent** (1× Opus, read-only) before any Edit/Write:
   - Focus: T3 (verify-before-claim), T11 (BFR-default — is one-file memory cache externally validated or fabricated?), T15 (recursive self-application — does this skill apply its own discipline?), T20 (inline verdicts in §1 below grounded in tool output, not training data?).
   - Return GO/REVISE. REVISE → patch this kickoff, re-review.
4. **Only after GO** — proceed to §1.

**Why §-1 exists:** maintainer dictated the design in 4 explicit steps; pressure to «just implement» is high. But authoring-session-own-discipline is exactly what kickoffs codify. Skip §-1 = T7 (pattern-matching the prompt instead of reasoning against it).

---

## §0 BFR-default verdict + prior-art (mandatory per [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md))

**Verdict: ADAPT Cline Memory Bank pattern** — file-based, markdown-formatted, model-readable session memory committed-or-gitignored to bridge context-loss events. Externally validated (Cline production deployment ≥2024). Our adaptation: ONE cache file (not Cline's 6-file hierarchy), per-machine (gitignored, not committed), scoped to /meta-orchestrator (not project-wide).

**Surveyed alternatives:**

| Candidate | Verdict | Rationale |
|---|---|---|
| Cline Memory Bank (6-file `memory-bank/`) | **ADAPT** | Externally-validated «file-as-memory» pattern; we narrow scope (1 file, 1 skill) |
| AIF Step 0 / `.claude/session-bootstrap.md` (this repo) | REFERENCE | Different problem class: re-states static invariants on every session; doesn't carry cross-session findings. T16 explicit — upstream problem class ≠ ours. |
| CC native `CLAUDE.md` auto-load | REFERENCE | Always-on project context, NOT per-skill state. Wrong scope. |
| Cursor `.cursorrules` | REFERENCE | Always-on rule injection, not cross-session memory. |
| `~/.claude/.../memory/` (user-scope auto-memory) | REJECT | Stage-0 per [memory-codification.md §1](../../rules/memory-codification.md); unreliable recall; not deterministic |
| In-skill «remember» via training-data | REJECT | Hallucination; T20 anti-pattern. |

**Falsifier:** wrong if Phase -1 reviewer surfaces a mature upstream tool that already implements **per-skill committed-or-gitignored memory cache with deterministic file-injection** — then ADOPT verbatim instead.

**SSOT row to add** (next free row at commit-time; do NOT pre-allocate a number): «Cline Memory Bank — ADAPT — per-skill memory layer scoped to /meta-orchestrator».

---

## §1 Scope — 4 atomic deliverables

Maintainer's verbatim brief (2026-05-25):

> «1. Создаст файл `.claude/orchestrator-prompts/_plan-cache.md` (это и будет сама «память»).
> 2. Дореактирует `.claude/skills/meta-orchestrator/SKILL.md §1` — добавит `!shell` инъекцию, чтобы при каждом вызове `/meta-orchestrator` skill подсасывал кэш.
> 3. Напишет helper-скрипт, который обновляет кэш-файл после каждой сессии.
> 4. Добавит Track-row в `wave-sequencing-plan.md §0` — чтобы план знал про эту фичу.»

### §1.1 Deliverable A — cache file (initial template)

**Path:** `.claude/orchestrator-prompts/_plan-cache.md` (gitignored per `.gitignore:1` — confirmed: `.claude/orchestrator-prompts/*` matches, only README.md exception).

**Format:** markdown with stable section headers (so the helper can update sections idempotently, not append-rewrite). Required sections:

```markdown
# /meta-orchestrator — plan cache (per-machine, gitignored)

> Updated by `.claude/skills/meta-orchestrator/helpers/update-cache.sh` at end of each invocation.
> Read by SKILL.md §1 `!shell` injection at start of next invocation.
> **NOT load-bearing.** Mechanical state (`gh pr list`, `git log`, `wave-sequencing-plan.md`) always wins per [feedback_no_human_verification_ai_self_verifies](memory) + SKILL.md §1 Step 2 item 5.

## Last invocation
- Timestamp (UTC): <ISO 8601>
- Umbrella: <name or «no-arg»>
- Git HEAD: <short SHA>
- Session outcome: <one-liner — e.g. «emitted launch-table for Stage 1; awaiting maintainer paste»>

## Last priority ranking (no-arg invocations only)
<table from §2 step 3 output, or «n/a» if umbrella-arg invocation>

## DRIFT items surfaced last time
<numbered list from §1 verdict, with resolution status: RESOLVED / OPEN / STALE>

## DECISION-NEEDED pending maintainer
<list of fork-surface items from §2 step 4 or §7 reviewer dispatch, with one-line «awaiting answer on:»>

## Deferred follow-ups
<list of items the session explicitly deferred — e.g. «sub-wave D queued for fresh-quota session»>

## Stale-cache marker
- If `git rev-parse HEAD` ≠ this file's «Git HEAD» AND the diff touches `wave-sequencing-plan.md` → cache is STALE; meta-orchestrator MUST emit «cache stale — last sync at <SHA>, now at <SHA>; re-deriving from mechanical state».
```

**Initial content (committed-or-not — it's gitignored, but the helper must be able to bootstrap a fresh file when none exists):** see §1.3 — the helper writes the initial template on first run.

**Falsifier:** if the cache format diverges between this kickoff spec and what the helper writes → `#two-prompts-drift` per [dual-implementation-discipline.md §8](../../rules/dual-implementation-discipline.md). Single SSOT = the helper's template; this kickoff spec must match what the helper produces.

### §1.2 Deliverable B — SKILL.md §1 `!shell` injection

**File:** `.claude/skills/meta-orchestrator/SKILL.md` — single SSOT, NO consumer mirror.

**Authority:** [install.sh:233-235](../../../install.sh) explicitly states `meta-orchestrator: shipped from authoring location .claude/skills/meta-orchestrator/ as single source of truth (no separate mirror under skills/)`. Note: [SKILL.md:359](../../skills/pipeline/SKILL.md) §7.10 carries a stale «Mirrors at repo-root skills/meta-orchestrator/» claim — flagged as STALE REF in PR body, deferred to separate PR per drive-by discipline (do NOT fix mid-flight in this umbrella).

**Edit:** §1 «Plan-currency check» Step 1 currently has 4 `!shell` blocks (git status / gh pr list / head wave-sequencing-plan / plan-currency-check.sh). **Add a 5th block at the TOP** (before the others — cache is the «here's what last session knew» context that should inform reading of the live mechanical blocks):

```!
cat .claude/orchestrator-prompts/_plan-cache.md 2>/dev/null | head -200 || echo "(no cache — fresh session; will be created by helpers/update-cache.sh on this invocation's exit)"
```

**Note on `head -200`** (round-3 amendment, was `-100`): a populated cache (priority table 8-12 rows + 5-10 DRIFT items + 3-5 DECISION-NEEDED + deferred + stale-marker) can reach 110-140 lines. `-100` silently truncated stale-cache marker; `-200` keeps it safely. Token cost: ~6-12 kB → ~1.5-3k tokens per invocation, acceptable (§6 falsifier still holds).

**Step 2 update:** add item 6 to drift detection:

> 6. **Cache reconciliation:** compare cache's «Last invocation» Git HEAD to current `git rev-parse HEAD`. If diverged AND `wave-sequencing-plan.md` was touched in the diff → emit «CACHE STALE: last sync at <SHA>, current <SHA>. Re-deriving DRIFT from mechanical state; cache treated as supplementary only.» Cache is welcome supplementary input, never load-bearing — same model as maintainer-passed REPORT (§1 Step 2 item 5).

**`@dual-pair` marker** at the bottom of §10 «Output artifacts» (where the cache helper invocation is documented — see §1.5 below):

```html
<!-- @dual-pair: meta-orchestrator-plan-cache -->
<!-- spec: .claude/orchestrator-prompts/meta-orchestrator-skill-memory/kickoff.md §1.1 -->
```

Per [dual-implementation-discipline.md §5](../../rules/dual-implementation-discipline.md) — the cache format (in cache file template) + the read-side spec (in SKILL.md §1) are a dual-pair. Helper writes; SKILL reads; both must agree on section names.

### §1.3 Deliverable C — helper script (writer)

**Path:** `.claude/skills/meta-orchestrator/helpers/update-cache.sh` — single SSOT, NO consumer mirror (same install.sh:233-235 authority as §1.2).

**Header comment (required, top of file):** must include `# @dual-pair: meta-orchestrator-plan-cache` matching the SKILL.md `<!-- @dual-pair: meta-orchestrator-plan-cache -->` marker per [dual-implementation-discipline.md §5](../../rules/dual-implementation-discipline.md) (drift-check grep on the literal anchor). Also include a Class+Authoritative-for inline comment header per [doc-authority-hierarchy.md §3](../../rules/doc-authority-hierarchy.md) (Class C — no companion test required at codification; promoted with the principle-test ship in §1.3 below).

**Invocation contract:** called via Bash tool by the meta-orchestrator session at end of §10 «Output artifacts». Arguments: `$1 = umbrella name (or "no-arg")`, `$2 = session-outcome one-liner`. The helper:

1. **If cache missing** → write initial template (the section-header skeleton from §1.1; empty content).
2. **Update sections idempotently** — use `sed` / `awk` between known section headers (`## Last invocation`, `## Last priority ranking`, etc.), NOT append-rewrite. Section history per non-touched section is preserved.
3. **Update «Last invocation» fields** — timestamp (ISO 8601 UTC via `date -u +%Y-%m-%dT%H:%M:%SZ`), umbrella name, current `git rev-parse --short HEAD`, outcome one-liner.
4. **First-iteration scope-reduction (round-3 amendment):** helper updates ONLY the `## Last invocation` section deterministically from `$1`/`$2`/clock/git. Sections «Last priority ranking», «DRIFT items», «DECISION-NEEDED pending maintainer», «Deferred follow-ups» are NOT touched by the helper in this iteration — the meta-orchestrator session populates them by direct `Edit` on the cache file before invoking the helper (cache is gitignored, plain markdown). A future kickoff may extend the helper with a `$3 = temp-file path` interface for those sections; out-of-scope here. Rationale: avoids T8/T15 risk of underspecified `$3..$N` interface drifting from SKILL.md §1 read expectation; single deterministic write path; idempotency test (§1.3 below) covers exactly what the helper does.
5. **Exit 0 on success, exit 1 on malformed cache** with stderr diagnostic «cache corrupt; rename to `_plan-cache.broken.<timestamp>.md` and recreate fresh».

**Existing helpers as precedent** (verified via `ls .claude/skills/meta-orchestrator/helpers/`): `assign-skill.sh`, `classify-work.sh`, `dup-detect.sh`, `launch-table-generator.sh`, `plan-currency-check.sh`, `priority-score.sh`. All bash, deterministic, exit-code disciplined per round-2 PR #194. The new `update-cache.sh` follows the same pattern.

**Companion test** (deterministic, NOT a paid-LLM check): `packages/core/hooks/update-cache.test.ts` — paired-negative per [principle 02](../../../packages/core/principles/02-paired-negative-test.test.ts). Tests cover ONLY what the helper does post-§1.3 item-4 scope reduction (i.e. `## Last invocation` write path):
- **Fresh-cache creation** (no file → file with template skeleton from §1.1 + filled «Last invocation» from $1/$2/clock/git).
- **Idempotent update** (run twice → only «Last invocation» fields change; ALL other sections, including manually-edited content in `## Last priority ranking` / `## DRIFT items surfaced last time` / etc., preserved verbatim).
- **Malformed-cache handling** (mangle the «Last invocation» section header → exit 1 + stderr diagnostic + rename to `.broken.<timestamp>.md`).

**Out of scope for this test (reader-side concern, NOT written by the helper):**
- Stale-cache *detection* (Git HEAD field ≠ current HEAD) — implemented and exercised in SKILL.md §1 Step 2 item 6 (cache-reconciliation rule, see §1.2 above), NOT in the helper. The helper writes the Git HEAD field; the reader compares it. Separate concerns.

**Slot:** test goes under `packages/core/hooks/` (existing convention — see M.4 wave: 6 bash-hook tests landed in this dir, PRs #195–#200).

### §1.4 Deliverable D — Track P row in wave-sequencing-plan.md §0

**File:** `docs/meta-factory/wave-sequencing-plan.md`

**Edit:** the existing «Meta-orchestrator skill (Track P)» row (line ~28) lists `L1+L2 ✅ / L3–L5 I-phase 🔲`. Append memory layer:

```markdown
| **Meta-orchestrator skill** (Track P) | n8-c3 BUILD + audit rounds + UX refactor + planner-completeness (L1/L2 + L3–L5 R-phase) + §1.7 PR-body mandate + **skill-memory (cache + injection + writer)** | 🟡 BUILD ✅ / audits ✅ / UX ✅ / L1+L2 ✅ / **L3–L5 I-phase 🔲** / **skill-memory 🔲** | … existing evidence + (this kickoff: `meta-orchestrator-skill-memory/kickoff.md`) |
```

**Also update §0's «What actually remains:» paragraph** — add «skill-memory I-phase» alongside L3–L5.

**Falsifier:** if Track P row schema changed between this kickoff's authoring (2026-05-25 snapshot) and execution (later session) → reconcile to the actual schema at execution time. The DATA additions are stable; the FORMAT may need adjustment.

### §1.5 SKILL.md §10 «Output artifacts» — add cache-update step

**Edit `.claude/skills/meta-orchestrator/SKILL.md §10`** — add a new item 5:

````markdown
5. **Plan cache update:** at end of invocation, run via Bash tool:

   ```bash
   bash ${CLAUDE_SKILL_DIR}/helpers/update-cache.sh "<umbrella-or-no-arg>" "<outcome-one-liner>"
   # First iteration: helper takes exactly $1 + $2 (per §1.3 item 4 scope reduction).
   # Non-«Last invocation» sections populated by direct Edit on the cache file before this call.
   ```

   Updates `.claude/orchestrator-prompts/_plan-cache.md` for next-invocation continuity. NOT load-bearing — mechanical state always wins. The cache is supplementary memory only.
````

(No consumer mirror — see §1.2 authority block; install.sh:233-235 confirms single SSOT.)

---

## §2 Sub-wave order + dispatch mode

| # | Deliverable | Mode | Cost | Order rationale |
|---|---|---|---|---|
| 1 | A (cache file template) | Direct Edit | ~5k | Define the format first; all other deliverables depend on agreeing with this shape |
| 2 | B (SKILL.md §1 + §10 edits, single SSOT) | Direct Edit | ~8k | Reads what (A) defines; no mirror per install.sh:233-235 |
| 3 | C (helper script + paired-negative test) | Direct Edit + bash test | ~15-25k | Writes what (A) defines; reads format from (B)'s spec |
| 4 | D (wave-sequencing-plan.md row) | Direct Edit | ~3k | Last; depends on nothing internal, just records the feature |

**Total estimate:** ~30-45k Opus. Single session, sequential edits, NO Worker dispatch.

**Anti-pattern guard:** per [SKILL.md §8](../../skills/pipeline/SKILL.md) `#worker-dispatch-via-subagent` + `#commit-on-behalf-of-worker` — this kickoff is itself dispatched via 1-liner paste by maintainer into a fresh CC session, OR executed inline by the meta-orchestrator that wrote this kickoff (NOT this session — this session WROTE the kickoff per `dispatch-not-implement` discipline per [SKILL.md §8 anti-scope](../../skills/pipeline/SKILL.md)).

**Worktree (per [parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md)):**

```bash
git worktree add ../rules-as-tests-aif-skill-memory staging
cd ../rules-as-tests-aif-skill-memory
git checkout -b feat/meta-orchestrator-skill-memory
# node_modules setup — idempotent (no-op if already linked or in primary workdir):
GIT_DIR_REL=$(git rev-parse --git-dir)
GIT_COMMON_DIR=$(git rev-parse --git-common-dir)
if [[ "$GIT_DIR_REL" != "$GIT_COMMON_DIR" ]]; then
  PRIMARY_WORKDIR=$(dirname "$(cd "$GIT_COMMON_DIR" && pwd)")
  [[ ! -e node_modules ]] && ln -sfn "$PRIMARY_WORKDIR/node_modules" node_modules
  [[ ! -e packages/core/node_modules ]] && ln -sfn ../../node_modules packages/core/node_modules
fi
```

**Cleanup (after PR merged to staging):**

```bash
cd /Users/art/code/rules-as-tests-aif    # back to primary workdir
git worktree remove ../rules-as-tests-aif-skill-memory
# OR (if working tree has uncommitted residue): git worktree remove --force
```

---

## §3 Acceptance criteria

1. ✅ `.claude/skills/meta-orchestrator/helpers/update-cache.sh` exists, is executable (`chmod +x`), passes its companion test (`packages/core/hooks/update-cache.test.ts`).
2. ✅ `.claude/skills/meta-orchestrator/SKILL.md` is the single SSOT — NO consumer mirror under `skills/meta-orchestrator/` (per install.sh:233-235). `diff -q` against an `skills/` mirror is NOT an AC item — the mirror must not exist. PR body notes [SKILL.md:359](../../skills/pipeline/SKILL.md) §7.10 STALE REF (mirror claim) as deferred to separate PR (drive-by discipline).
3. ✅ `.claude/orchestrator-prompts/_plan-cache.md` is created on first helper invocation (verified by deleting any existing file then running `bash helpers/update-cache.sh test-umbrella "smoke test"`).
4. ✅ Second invocation of the helper preserves non-«Last invocation» sections verbatim (idempotency test).
5. ✅ `wave-sequencing-plan.md` Track P row + «What actually remains:» paragraph updated.
6. ✅ All edits land in ONE PR titled `feat(meta-orchestrator): skill memory — cache + injection + writer`.
7. ✅ `Prior-art:` commit trailer cites Cline Memory Bank (per §0 verdict above) + adds new SSOT row.
8. ✅ §1.7 forward+backward checks completed in PR body per [phase-research-coverage.md §1.7](../../rules/phase-research-coverage.md):
   - Forward: complies with [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) (deterministic bash), [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md) (helper carries Class+Authoritative-for via inline comment header), [dual-implementation-discipline.md §5](../../rules/dual-implementation-discipline.md) (`@dual-pair: meta-orchestrator-plan-cache` markers on helper writer ↔ SKILL.md reader).
   - Backward: this kickoff supersedes no existing artefact; the new memory layer is additive — does not delete or rewrite any prior skill section. SKILL.md §7.10 stale mirror claim flagged but NOT fixed in this PR (separate scope).
9. ✅ Own cold-QA per [ai-laziness-traps.md T19](../../rules/ai-laziness-traps.md) BEFORE handoff — fresh Opus reviewer reads the diff, returns GO before `gh pr create`.
10. ✅ Worktree removed after merge per §2 cleanup block (`git worktree remove ../rules-as-tests-aif-skill-memory`).

---

## §4 Stop conditions

- **§-1 reviewer returns REVISE 3×** → escalate to maintainer; halt before §1.
- **Phase -1 cold review surfaces BLOCKER** that requires scope change → surface as DECISION-NEEDED, halt.
- **Cache format collides with an in-flight competing memory mechanism** (e.g. a different skill ships its own `_plan-cache.md` at the same path) → STOP, surface as DECISION-NEEDED («one cache file per skill or shared across skills?»).
- **§1.7 forward-check finds a rule violation that didn't exist at kickoff authoring time** (rule shipped between authoring and execution) → patch the kickoff, re-review.
- **Helper test fails after 3 fix attempts** → STOP, surface root cause; do NOT silently mark test `.skip` (`#discipline-theatre`).
- **Sub-deliverable spawns Worker subagent for write task** → STOP — this kickoff's own discipline prohibits Worker dispatch for writes (T15 self-application; see SKILL.md §8 anti-scope).

---

## §5 AI-traps active (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Required T-enumeration (principle 12 will validate presence of this section):

**T1 — sampling-shallow** — when verifying §-1 claims, read ALL 4 cited files, not 1-2.

**T3 — plausible-finding-without-verification** — every claim in §1 must have file:line or command output backing. If §-1 reviewer can't open and verify, claim is INCONCLUSIVE.

**T11 — BUILD-without-prior-art-check** — §0 already did the BFR survey; the implementing session MUST verify the survey is still current (3 phrasings DeepWiki + WebSearch on «cross-session memory cache markdown file» before BUILD — if a new mature tool surfaced post-2026-05-25, ADOPT it instead).

**T13 — adopted-as-zero-work** — ADAPT Cline Memory Bank means we still own the adaptation; don't assume upstream's bug fixes apply. Audit the 1-file-vs-6-file scope reduction explicitly.

**T15 — self-application skipped** — meta-orchestrator's own discipline (no Worker dispatch for writes; mechanical state always wins; cache supplementary not load-bearing) MUST apply to this very kickoff's execution. The kickoff explicitly forbids Worker dispatch for its own implementation.

**T16 — pattern-matching-on-name** — «memory cache» sounds like Cline Memory Bank but Cline's problem class = «cross-session project context across many sessions of varying depth». Our problem class = «cross-invocation continuity within /meta-orchestrator skill specifically». Verify match is real, not nominal — §0 already did this; reviewer must double-check.

**T17 — destructive-delegation-without-preserving** — if a prior `_plan-cache.md` exists with hand-edits, do NOT clobber. The helper's `if cache missing` branch must be «create template» only; existing files require explicit `--force` arg or `git mv` to `.broken.<timestamp>.md`.

**T19 — handoff-without-own-cold-QA** — before `gh pr create`, run an independent Opus subagent over the diff. CI ≠ design review. Mandatory regardless of how small the PR feels.

**T20 — inline-verdict-without-evidence** — in PR description, any «this works because X» / «we chose ADAPT because Y» must be backed by a same-turn tool call (test run, file read, grep output). No vibes-only verdicts in PR body.

**Domain-specific traps** (per ai-laziness-traps.md §3 — kickoff MUST add ≥1):

**T-mem-A — «cache-as-source-of-truth drift»** — temptation to read `_plan-cache.md` and TRUST what it says about merged PRs instead of re-running `gh pr list`. The cache is a session-memo, not a state register. Every time the cache says «PR #X merged», meta-orchestrator must re-verify via `gh pr list --search "is:merged number:X"` (which is what plan-currency-check.sh already does — cache does NOT replace this; it precedes it as supplementary context only). Counter: SKILL.md §1 Step 2 item 6 (cache-reconciliation rule).

**T-mem-B — «cache writer becomes feature factory»** — once the helper exists, temptation to add more sections («last 5 invocations», «kill-rate trend», «favorite umbrella»). Counter: §6 below lists exactly the sections that exist; any new section requires a separate kickoff. No drive-by feature creep in this implementation session.

---

## §6 Falsifiers + out-of-scope

**Falsifiers (this kickoff is wrong if):**
- An existing CC primitive (`PreToolUse` injection / native skill-state / `output-style` chain) already does cross-session per-skill memory deterministically → ADOPT verbatim, abandon this kickoff. Phase -1 reviewer must confirm none exists (search code.claude.com/docs).
- The helper's test cannot be paired-negative — i.e. there's no way to write a failing test before implementation → STOP, the artefact is purely structural and principle 02 doesn't apply; document the deviation per [principle 02 design escapes].
- The cache injection in SKILL.md §1 increases token cost by >2k per invocation (cache file grows unbounded) → revisit format; add line-cap (`head -100` already in spec — verify it's enough).

**Out-of-scope (do NOT do in this PR):**
- Cross-skill shared memory (e.g. orchestrator + meta-orchestrator both reading the same cache). Separate decision.
- Cache snapshotting / versioning (git history of cache state). Not needed; cache is per-machine ephemeral.
- Auto-cleanup of stale caches >N days old. Future work; deferred.
- LLM-summarisation of cache sections («tl;dr last 5 invocations»). Violates [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md); also unnecessary.
- Cache schema migration (when section headers change). Address when first breaking change occurs, not pre-emptively.
- Touching `~/.claude/skills/orchestrator/` (global skill, agent-uncommittable per memory `feedback_settings_json_agent_uncommittable`). Only project-scope skill is in scope here.

---

## §7 Reporting back (per SKILL.md §10.3a plain-language-tail)

When execution completes, the implementing session emits a final block:

```markdown
## 🟢 Простыми словами

Что сделал: добавил skill'у «память» — теперь /meta-orchestrator при каждом вызове видит, что было в прошлой сессии (приоритеты, дрифт, отложенные решения). 4 правки: helper-скрипт + кэш-шаблон + SKILL.md (single SSOT, без mirror per install.sh:233-235) + wave-plan Track-P row.

Почему это нужно: раньше каждый вызов начинался с нуля — приоритеты пересчитывались, drift-проверка не помнила, что вчера было сказано про PR #X. Теперь между вызовами сохраняется session-memo (но не как load-bearing truth — mechanical state из gh pr list всё равно перепроверяется).

Что проверил: helper test зелёный (paired-negative); кэш создаётся на первом вызове и обновляется идемпотентно на втором; SKILL.md edits = single-SSOT (no skills/meta-orchestrator/ mirror created — confirmed via `ls skills/`); §1.7 forward+backward checks в PR body.

Что осталось: один organic end-to-end smoke test — следующий реальный /meta-orchestrator вызов должен показать «cache loaded: <one-liner from previous session>» вверху отчёта.
```

---

## §8 See also

- [.claude/skills/meta-orchestrator/SKILL.md](../../skills/pipeline/SKILL.md) — the skill being extended (§1 + §10 surfaces)
- [.claude/rules/build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md) — BFR mechanism that §0 ran
- [.claude/rules/dual-implementation-discipline.md §5](../../rules/dual-implementation-discipline.md) — `@dual-pair` markers (helper writer ↔ SKILL.md reader)
- [.claude/rules/memory-codification.md](../../rules/memory-codification.md) — adjacent discipline: this kickoff's cache is per-skill operational memory, NOT durable-convention memory codified to repo (different layer)
- [.claude/rules/no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) — hard constraint: helper is deterministic bash, no LLM-in-loop
- [.claude/rules/parallel-subwave-isolation.md §1](../../rules/parallel-subwave-isolation.md) — worktree discipline for the implementing session
- [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md) — §5 above complies with kickoff-author obligations
- Cline Memory Bank — upstream pattern (ADAPT verdict per §0)
- Round-2 audit kickoff [meta-orchestrator-followup-audit/kickoff.md](../meta-orchestrator-followup-audit/kickoff.md) — structural template this kickoff follows

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
