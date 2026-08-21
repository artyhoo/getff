# KICKOFF — aif-isolation-rphase (Findings A + F)

> **Type:** R-phase (RESEARCH ONLY — produce a research-patch, write NO production code).
> **Base:** staging. Origin: qloop-ux-probe 2026-06-01 live e2e run (Findings A + F).
> **Deliverable:** ONE research-patch at `docs/meta-factory/research-patches/2026-06-0X-aif-task-isolation.md`
>   with a verdict (config-fix / aif-upstream-issue / our-side-guard) + reproduction + recommended fix path.

## §0 Why this exists (evidence from qloop-ux-probe)

Two aif-lifecycle findings block reliable autonomous dispatch. Both were proven live, NOT theorised:

**Finding A — dirty_worktree recurs because aif runs tasks IN-PLACE on a shared checkout.**
- Container `aif-handoff-api-1`/`-agent-1` share one volume `/home/www/rules-as-tests-aif`.
- reflog per task: `checkout staging → pull --ff-only → checkout -b feature/<task>` — all in place.
- `git worktree list` → **a single worktree**, despite `AIF_TASK_WORKTREES_ENABLED=true` in the env.
- ⇒ a task that leaves uncommitted work dirties the shared checkout → the next dispatch 409s
  (`Branch isolation failure (dirty_worktree)`), falls back to ManualBackend.

**Finding F — resume of a MID-FLIGHT park goes review→done instead of re-implementing.**
- A park that happens after the implement→review transition leaves `status=review, paused=true`.
- `answer.ts --decision resume` un-pauses (paused=false) and injects the answer into the plan,
  BUT the task continues the REVIEW pipeline to `done` — it never re-enters implement to read the
  answer and park the NEXT chain question (live: task ba3b4bf6 answered c1, went to done, c2 never parked).

## §1 Research questions

A1. WHY does `AIF_TASK_WORKTREES_ENABLED=true` not produce per-task `git worktree`s? (version? extra
    config — a worktrees-root path? requires container restart? mis-named/ignored env?)
A2. If per-task worktrees can be enabled → each task isolated, shared checkout never dirtied. Cost/steps?
A3. If not → should aif `git reset --hard && git clean -fd` (or stash) the shared checkout before each
    task's branch checkout? What does aif-handoff's lifecycle already offer (config hook / pre-task)?
A4. Is an OUR-side pre-dispatch clean-guard in runtime-bridge useful, or does it just re-surface the same
    STOP (we cannot/should-not clean a container we don't own)?
F1. Can a mid-flight park (status=review) resume back INTO implement so it processes the answer + parks
    the next question? Is this an aif config (review-iteration / re-implement) or an upstream gap?
F2. Should park.ts force the task to a pre-review state when it parks, so resume always re-implements?

## §2 Method + constraints (binding)

- **BFR (build-first-reuse-default.md §3):** aif-handoff is the ADOPTED upstream. **Investigate upstream
  FIRST** — DeepWiki `ask_question` on the aif-handoff repo (≥3 phrasings) for worktree-isolation +
  resume-from-review lifecycle, before proposing ANY of our own mechanism. WebSearch ≥3 phrasings on the
  problem-domain term. Cite SSOT/prior-art by ID.
- **no-paid-llm-in-ci.md:** any proposed mechanism is deterministic / session-bound. No API-billed CI.
- **stop-surface-not-hack** (`feedback_stop_surface_not_hack_on_dispatch_fail`): do NOT mutate the aif
  container blindly to "prove" a fix. Reproduce + diagnose; recommend, don't hack.
- **Verdict required** per finding: config-fix (cheap) / aif-upstream-issue (file/track) / our-side-guard
  (BUILD — only after upstream ruled out). State what would falsify each.

## §3 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2` — REQUIRED, principle 12)

See `.claude/rules/ai-laziness-traps.md §2` for the full catalogue. **Active traps for this R-phase:**
- **T11** — propose NO mechanism without a prior-art / DeepWiki check on aif-handoff first.
- **T12** — do NOT skip the upstream sweep because "I know how worktrees work"; the env flag's actual
  behaviour is repo-specific and must be verified, not recalled.
- **T16** (pattern-matching-on-name) — `AIF_TASK_WORKTREES_ENABLED=true` SOUNDS like it isolates; verify
  it actually creates worktrees (`git worktree list`), do not assume the flag's name == its effect.
- **T2 / T4** — designing the fix ≠ doing the R-phase; the deliverable is a verdict-bearing research-patch
  with reproduction, not "here's what I would investigate".
- **T15** (self-application) — include a §1.7 self-reflection in the research-patch.
- **Domain-specific (T-aif-A):** «assuming the container state seen once is stable» — the shared checkout's
  branch/dirty state changes per task; reproduce across ≥2 dispatch cycles before concluding the mechanism.

## §4 Acceptance

- Research-patch exists with: reproduction of A (and F), the A1/F1 root answers backed by DeepWiki/command
  evidence (file:line or command output), a verdict per finding, and a recommended fix path with effort est.
- NO production code changed (R-phase). Any fix is proposed, dispatched as a separate I-phase later.
- Patch carries the `<!-- scope:aif-task-isolation -->` first-line annotation (principle 10) + §1.7 (principle 13).

## §5 Stop conditions
- aif container unreachable / docker absent → STOP, report (can't reproduce).
- Tempted to edit aif internals or the container to "fix" mid-research → STOP (R-phase = research only).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
