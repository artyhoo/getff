# KICKOFF — mutation-discipline Stage 4 D.6 (deps-hash-check dup) — meta-launch

> **Type:** R-phase, single (Mode A). May NOT need build — deliverable is ONE research-patch with a verdict.
> **Origin:** mutation-discipline umbrella, Stage 4 D.6 (`.claude/orchestrator-prompts/mutation-discipline-umbrella/kickoff.md:111` + T17 `:130`). D.1–D.5 shipped (PR #381, merged staging 2026-06-02).
> **Base branch:** staging (NOT main — main is prod, manual promote only).
> **Deliverable:** ONE research-patch at `docs/meta-factory/research-patches/2026-06-02-deps-hash-check-dup.md` with a verdict (symlink / sync-check / leave-as-is / generate-from-source) + reproduction + recommended fix path. NO source deletion in this R-phase (T17).

## §1 The question

There are TWO `deps-hash-check.sh` files in the repo, byte-identical:
- `packages/core/hooks/deps-hash-check.sh`
- `.claude/hooks/deps-hash-check.sh`

D.6 asks: **symlink? duplicate? race?** — and what to do about it. Investigate, do NOT delete blindly (T17: one copy may have a unique upstream-shipping path).

## §2 Starting leads — VERIFY each, do NOT trust this prose (T3/T13)

A prior inline investigation (this session, unverified hand-off) suggested the two copies have DIFFERENT roles. **Re-verify every claim below with a fresh file:line / command before relying on it** — the prose may be stale or wrong:

1. **Lead:** `packages/core/hooks/deps-hash-check.sh` is the SHIPPED SOURCE — `install.sh:261` reads it as `HOOK_SRC` and copies it to the consumer's `.claude/hooks/`. → verify by reading `install.sh` around line 261.
2. **Lead:** `.claude/hooks/deps-hash-check.sh` is THIS repo's DOGFOOD copy — wired live in `.claude/settings.json:74` as a `UserPromptSubmit` hook. → verify by reading `.claude/settings.json`.
3. **Lead:** they are byte-identical but NOT symlinks (different perms: `.claude` 755, `packages` 644). → verify with `diff` + `file` + `ls -la`.
4. **Implication to test:** deleting EITHER breaks something (source → install.sh; dogfood → this repo's own hook). The real risk is **silent drift** if one is edited and not the other.

If any lead is FALSE, say so explicitly and correct it — that is a finding, not a failure.

## §3 Method (R-phase, search-coverage mandatory)

1. Confirm the three leads (§2) with primary evidence (file:line + command output).
2. **Build-vs-reuse §3 search (mandatory before any «fix» proposal):** is «ship a hook to consumers AND dogfood it in-repo without drift» a solved problem-class? Consult `.claude/rules/dual-implementation-discipline.md` (the `@dual-pair` / `# spec:` convention is the in-repo precedent for exactly «two copies of one logic, kept in sync») + `.claude/rules/build-first-reuse-default.md §3`. DeepWiki/WebSearch ≥3 phrasings if proposing a new mechanism.
3. Enumerate the candidate verdicts and their trade-offs:
   - **(a) symlink** dogfood→source (test: does `install.sh` copy survive a symlink? cross-platform/Windows? does CC execute a symlinked hook?)
   - **(b) keep both + drift-check** (a deterministic test/`@dual-pair` asserting byte-identity — fits the repo's existing dual-implementation discipline)
   - **(c) generate** the dogfood copy from source at build/install time
   - **(d) leave as-is** (accept the drift risk; justify why)
4. Pick a verdict with rationale against the project's discipline (prefer reuse of the existing `@dual-pair`/drift-check pattern over a new mechanism if it fits).

## §4 Acceptance

- Research-patch exists with: confirmed/corrected leads (file:line evidence), the 4-candidate trade-off table, a single recommended verdict + rationale, and a concrete fix path (commands/files) for a future I-phase.
- NO file deletion, NO symlink creation in this R-phase (investigation only — T5: R-phase output is a markdown doc, leave the fix to I-phase).
- `Prior-art:` trailer on the commit (or escape hatch — research-patch, no new capability).

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

- **T3** — every lead confirmed with file:line / command output, not «I assume».
- **T5** — R-phase produces a markdown research-patch ONLY; do NOT edit/delete the .sh files or settings.json.
- **T11** — before proposing a new sync mechanism, search prior art (the repo's own `@dual-pair` convention is the first candidate — do NOT reinvent).
- **T13/T16** — do NOT assume the two copies are «just duplicates» by name; verify the actual delivery roles (source-vs-dogfood) before any verdict.
- **T17** — preserve before delete: this is the rule that put D.6 on the «investigate first» track. No deletion here.

## §6 §1.7 PR-body mandate

This R-phase writes a research-patch under `docs/meta-factory/research-patches/` — annotated per `10-research-patch-annotation.test.ts` (scope marker). If the PR touches no path in the §4b list (`.claude/rules/`, `packages/core/principles/`, `CLAUDE.md`, …), the §1.7 forward/backward PR-body mandate does not apply; otherwise add the sections. Verify with the pre-flight grep before `gh pr create`.

## §4c Autonomous aif dispatch — park-don't-guess (MANDATORY — bridge-dispatched)

**aif agent — fork discipline (non-negotiable):** on ANY genuine fork (e.g. «symlink vs drift-check are both defensible and the choice is a real taste/strategy call») — do NOT pick silently. Park it: set the task to `manualReviewRequired` / `blocked_external` with «Option A → consequence X / Option B → consequence Y», and stop. Proceed only on the unambiguous parts. Guessing a fork to keep moving is the exact failure this loop prevents. (`ask-question-reminder.sh` discipline.)

## §7 Stop conditions
- aif container unreachable → STOP, report.
- A lead in §2 turns out false in a way that changes the whole framing → record it, re-scope, and PARK if the new framing needs a maintainer call.
- Genuine fork on the verdict → PARK (per §4c), do not guess.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
