# meta-orchestrator-plan-memory — brainstorming kickoff

> Created 2026-05-25 by Item-12 session. **Phase: brainstorming → R-phase brief, NOT R-phase yet.**
> Tool: `superpowers:brainstorming` skill (mandatory per the skill's «MUST use before any creative work»).
> Output: this kickoff is REPLACED by a brainstorm-result patch under `docs/meta-factory/research-patches/<date>-plan-memory-brainstorm.md` that names 1-2 viable design directions for a follow-up R-phase to research.
> NO implementation in this session. NO «I propose mechanism X». NO new helpers. Brainstorm only.

## §0 Cold-start verify

```bash
git fetch origin staging --quiet
gh pr list --state merged --search "merged:>=2026-05-18" --json number,title --limit 30
gh pr list --state open --json number,title,headRefName --limit 10
ls .claude/orchestrator-prompts/ | grep -i "meta-orch\|plan"           # full umbrella inventory
find docs/meta-factory/research-patches -name '*planner*' -o -name '*plan-memory*' -o -name '*meta-orch*' -o -name '*L6*'
cat .claude/skills/meta-orchestrator/SKILL.md | head -60                # current skill scope
```

## §1 The idea (verbatim from maintainer)

> «А как тебе идея чтобы помимо этого мета-оркестратор бы обновлял свой план — то есть имел бы свою память об проекте (план) и с каждым запуском проверял бы её актуальность и обновлял бы и расставлял очередность? А вызов с `<name>` к тому же добавлял бы в этот план (если ещё не было там кикофа) например?»

**Decomposed components (do not pre-decide; brainstorm whether each is needed):**

1. **Persistent project-plan memory** — meta-orchestrator owns a plan-of-record across sessions
2. **Plan-currency on every launch** — compare stored plan vs reality (`gh pr list`, `git log`, open kickoffs); update stored copy
3. **Priority re-scoring** — given refreshed reality, re-rank pending umbrellas
4. **Auto-registration on `/meta-orchestrator <name>`** — if `<name>`'s kickoff isn't tracked in the plan, add it (Track-row, status, priority slot)
5. **(Related but separate) L6 auto-draft reconcile** — when ≥N UNTRACKED merged PRs detected, skill emits a draft unified-diff suggesting `wave-sequencing-plan.md` updates (does NOT apply; surface only)

Maintainer's earlier dialog (pasted into kickoff request) already explored some of this. The L6 thread should be considered IN SCOPE for the brainstorm (overlap with #2 + #5).

## §2 Why this matters (no «we should»; describe the gap factually)

- After today's planner-completeness umbrella close (2026-05-25, 6 PRs), `plan-currency-check.sh` (L2 UNTRACKED detection from #217) finds ~85 UNTRACKED merged PRs vs `wave-sequencing-plan.md`. Every session re-reads same 85.
- Detection now works. **Reconcile does not.** Skill emits drift list; humans/sessions manually open a chore-PR to update `wave-sequencing-plan.md` (e.g. PR #220 did this for Stage 3).
- Each session pays the same drift-discovery cost. The L2 detector is necessary but insufficient; missing a "remember what I already discovered" layer.

## §3 Brainstorm — key questions to walk through (use `superpowers:brainstorming` skill)

These are the design forks. Do NOT pre-resolve in this kickoff; the brainstorm session resolves them.

### §3.1 What IS the plan?

- Just a list of umbrellas with status?
- Stage state per umbrella (which sub-wave is in-flight)?
- Inter-umbrella dependency graph?
- Priority order across all open umbrellas?
- Quota/effort estimates (Opus burned per umbrella so far)?
- Recurring discipline reminders (e.g. «3 incidents of pattern X, next at threshold N»)?

The wider the «plan» concept, the wider the storage + the higher the drift surface. **Brainstorm picks scope.**

### §3.2 Where does it live?

| Option | Pros | Cons |
|--------|------|------|
| Existing `wave-sequencing-plan.md` (extend in-place) | Already committed; visible in repo; single source | Public diffs for routine reconciles add noise; coupling «strategy» (track order) with «factual» (PR merged) |
| New gitignored `.claude/orchestrator-prompts/_plan.md` | Local-only; no PR churn | Invisible across machines/maintainers; can't be reviewed |
| Project-scope memory at `~/.claude/projects/.../memory/project_meta_plan.md` | CC-native, persists across sessions, no PR | Outside repo per `memory-codification.md §1` (stage-0 if mis-used) |
| Hybrid: SoT = `wave-sequencing-plan.md` (strategy/order), shadow = memory file (factual cache) | Separates strategy-edit from factual-cache | Two-source pattern — `dual-implementation-discipline.md §1` warning shape (drift!) |

### §3.3 Direction of sync

- **Reality → plan**: detect UNTRACKED, auto-add Track rows. *Risk*: «admission of new row» is strategy per `reviewer-discipline.md §2`.
- **Plan → reality**: plan describes intent, reality executes against it. *Status quo*.
- **Bidirectional**: dangerous unless conflict resolution is mechanical.

### §3.4 Strategy vs factual updates (the load-bearing line)

| Update kind | Skill auto-applies? | Surfaces for human? | Reasoning |
|-------------|---------------------|---------------------|-----------|
| «PR #N merged» → mark Track row done | ? | ? | Pure factual; deterministic mapping |
| «5 untracked PRs in Track-P area» → add Track row | ? | ? | Admits new strategy bucket |
| «Umbrella X has higher priority than Y now» → reorder | ? | ? | Strategy call per maintainer |
| «Add new umbrella from `<name>` kickoff» → insert | ? | ? | Decision-needed surface? |

Brainstorm decides per row. The principle: `reviewer-discipline.md §2` says don't pick strategy; what counts as strategy here?

### §3.5 Conflict resolution

- Stored plan says X, reality says Y, kickoff suggests Z. What wins?
- 3-way diff vs human prompt-on-conflict?

### §3.6 L6 auto-draft (in-scope per maintainer's pasted text)

If brainstorm verdict for #3.4 row 1 = «factual auto, surface for review» — that IS L6. Brainstorm should explicitly resolve: is L6 a separate feature, or the natural product of plan-currency-write design?

### §3.7 Recursive self-application

Does THIS umbrella's own plan-of-action live in the stored plan? (T15.) If yes — bootstrapping question: how does the first plan-entry get created?

### §3.8 Falsifiers (brainstorm enumerates 3+)

Examples — extend:
- If `gh pr list` is fast enough (<5s) → no caching needed → no «plan memory», just better in-session re-discovery
- If umbrella count stays ≤5 active → priority re-scoring trivial mental math, no persistent store
- If `wave-sequencing-plan.md` reconcile happens often enough manually → no auto-write
- If `aif-handoff` already has this pattern → ADOPT, not BUILD

### §3.9 What this is NOT

- NOT an opinion on whether the feature should ship (R-phase decides)
- NOT a recommendation of specific tool/library (brainstorm is too early for that)
- NOT a stage decomposition (no I-phase yet)
- NOT an architecture diagram (premature without R-phase prior-art)

## §4 Prior-art targets (brainstorm session consults these BEFORE design)

**Internal:**
- `.claude/skills/meta-orchestrator/SKILL.md` — current scope (no plan memory)
- `.claude/skills/meta-orchestrator/helpers/plan-currency-check.sh` — L2 detector (reads-only)
- `.claude/orchestrator-prompts/meta-orchestrator-prior-art/` — original R-phase that defined skill scope (probably explicitly excluded auto-write)
- `docs/meta-factory/wave-sequencing-plan.md` — current plan target
- `.claude/rules/memory-codification.md §3` — write-time discipline («codify in repo, not memory»)
- `.claude/rules/dual-implementation-discipline.md §1 + §7` — two-source warning
- `.claude/rules/reviewer-discipline.md §2` — strategy-vs-factual line
- `.claude/orchestrator-prompts/meta-orchestrator-planner-completeness/state.md` (gitignored, local) — Layer 1-5 history

**External (build-first-reuse-default.md §3 6-item — mandatory):**
- **Cline Memory Bank** — committed-markdown project memory pattern. Closest external analog. DeepWiki query `cline/cline` ≥3 phrasings.
- **Cursor Rules System** (`.cursorrules`) — project conventions persistence
- **TaskMaster MCP (`eyaltoledano/claude-task-master`)** — task-list-as-data pattern (already SSOT #74 ADAPT VOCABULARY for L4)
- **OpenHands** — multi-session state pattern (already SSOT #72)
- **aif-handoff** — companion project's plan/state mechanism (handoff-mode is SSOT #27)
- **Devin Knowledge Notes** — via DeepWiki MCP private mode (`devin_knowledge_manage`)
- **Superpowers `subagent-driven-development`** — plan persistence within session (SSOT #64)
- **WebSearch ≥3 phrasings**: «AI agent project plan persistent memory», «orchestrator state across sessions», «agent self-maintained roadmap»

T16 check on each: «upstream problem-class = X, our problem-class = Y, match? evidence: …». Don't ADOPT-by-name.

## §5 Constraints (hard)

- **`no-paid-llm-in-ci.md §1`** — any update mechanism is deterministic; no LLM-decides-what-to-write
- **`memory-codification.md §3`** — if plan lives in memory: write-time codify-then-pointer; not memory-only for load-bearing strategy
- **`reviewer-discipline.md §2`** — skill cannot auto-decide strategy; factual auto-OK, strategy surfaces-for-human
- **`build-first-reuse-default.md`** — Cline Memory Bank precedent is so close that BUILD verdict requires explicit T16 problem-class evidence
- **`dual-implementation-discipline.md §7`** — if two locations end up storing «the plan», ONE is SSOT, other is derivation; never two hand-synced
- **CLAUDE.md «PR strategy»** — brainstorm output is research-patch only; no drive-by code, no helpers, no implementation
- **Item 12 lesson** — single-source design from start, not «we'll dual-source then dedupe» (we just paid that bill)

## §6 Active AI-laziness traps for this brainstorm (ai-laziness-traps.md §3 obligation)

- **T11** — designing custom plan-memory without prior-art check. Counter: §4 mandatory before any «what if we…».
- **T12** — skipping literature sweep because «I know Cline Memory Bank». Counter: WebSearch ≥3 phrasings + DeepWiki even on familiar tools.
- **T15** — self-application skipped. Counter: §3.7 must produce explicit answer.
- **T16** — pattern-matching-on-name. «Memory Bank» sounds catch-all; verify problem-class match (committed-markdown-on-project-launch ≠ skill-self-updating-on-every-invocation). 
- **T20** — inline-verdict-without-evidence. Counter: no «ADOPT Cline» until §4 prior-art row written with file:line/DeepWiki-output evidence.
- **T-PM-A (NEW, domain-specific)** — **«brainstorming as architecture-decision»**. Brainstorming explores options; it does NOT pick the winning architecture. If brainstorm output reads «we should build X with Y» — that's R-phase work, brainstorm overstepped. Counter: brainstorm output is 1-2 viable design directions WITH the questions R-phase must answer to pick between them, not a single picked direction.

## §7 Expected output

A research-patch at `docs/meta-factory/research-patches/<YYYY-MM-DD>-plan-memory-brainstorm.md` containing:

1. **Maintainer-intent restatement** — the maintainer's verbatim quote (§1 above) + brainstorm's understanding of intent (1-2 paragraphs)
2. **Decomposed feature components** — extends §1 list with «keep / drop / re-frame» verdict per component, brainstorm rationale per
3. **Prior-art consult** — all §4 candidates surveyed with T16 problem-class match + ADOPT/ADAPT/BUILD/REJECT-PROVISIONAL verdict (final verdict awaits R-phase)
4. **2 viable design directions** — NOT 1 winner. Each direction:
   - Where the plan lives
   - What's tracked
   - Sync direction
   - Strategy-vs-factual line per row
   - Conflict resolution
5. **R-phase questions** — enumerated list of «here's what R-phase must research/benchmark to pick between Direction-A and Direction-B»
6. **Falsifiers** — 3+ scenarios where either direction is wrong
7. **§1.7 self-reflexive check** — does this brainstorm comply with `phase-research-coverage.md §1.12`, `recommendation-laziness-discipline.md §3` (no «we should X» verdict without tool-call evidence)
8. **Recurrence-risk note** — brainstorm itself can fall into the very pattern it's exploring (defer-tell on its own output, T20 inline-verdict). Self-application gate.

## §8 What this brainstorm is NOT

- NOT R-phase (no benchmarks, no 6-item search-coverage, no SSOT row appends)
- NOT I-phase (no helpers, no SKILL.md edits, no kickoff sub-waves)
- NOT a decision on shipping (R-phase + maintainer decide)
- NOT an opinion vote on «should we do this» (factual decomposition, design options, not advocacy)

## §9 How to start

```bash
/meta-orchestrator meta-orchestrator-plan-memory
```

OR — since this is brainstorming not stage-execution, simpler:

In a fresh Opus session, paste this kickoff §1 + §3 + §4 verbatim, then say:

> «Use `superpowers:brainstorming` skill on this kickoff. Output a research-patch at `docs/meta-factory/research-patches/<today>-plan-memory-brainstorm.md` per §7. No implementation, no helpers, no SKILL.md edits. Brainstorm phase only.»

## §10 See also

- **Maintainer's earlier pasted text** (in original kickoff request 2026-05-25) — frames the L6 idea + arguments-for/against auto-write. Carries 4 viable directions already in embryonic form.
- **Predecessor closed:** `meta-orchestrator-planner-completeness` (2026-05-25 closed, 6 PRs L1-L5) — provided detection layer; plan-memory builds the «remember what was detected» layer above it.
- **`.claude/orchestrator-prompts/meta-orchestrator-prior-art/`** (gitignored) — original R-phase scope-fixing patch
- **`docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md`** — public BUILD verdict for `/meta-orchestrator`
- **`docs/meta-factory/research-patches/2026-05-25-planner-completeness-prior-art.md`** — L3/L4/L5 prior-art (TaskMaster + SDD + OpenHands rows #72-#75)
- **Companion brainstorm-vs-R-phase precedent:** look at how `recommendation-laziness` umbrella separated R-phase (#206/#207) from benchmark (#210) from I-phase (#211/#212/#215) — same Phase-separation discipline applies here, with brainstorm preceding R-phase as PRE-research.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
