<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: kickoff — per-role-context BUNDLE FOR CC (v2 — re-dispatched after deliverables landed on staging). One-shot task: read the 3 deliverables (now on staging) + the 3 parallel-task outputs (in aif-handoff projects dir on host) and assemble ONE bundle for Opus in CC. v1 failed because deliverables were on a feature branch invisible to the container; v2 fixes that — deliverables are now on staging tip. -->

# per-role-context-bundle-for-cc — kickoff (v2)

> **Goal:** assemble a single bundle document for Opus in Claude Code that contains ALL the raw material from this research track, organized for Opus's review (NOT pre-filtered). Opus will then prepare the fabla brief.
>
> **Why v2:** v1 (task `73519b9c`) hit a blocker — the 3 deliverables were on `feat/prune-worktrees` (feature branch), unreachable from the aif container. **Fix landed 2026-07-27 (PR #1176, merged to staging as `1a9812dc10`)** — the 3 deliverables are now on `origin/staging` tip and visible to any container that syncs staging.

## §0 What this task is NOT

- NOT a filter. All findings (including contradictions between sources) preserved.
- NOT a recommendation. No "we should" / "best option" / verdicts.
- NOT a fix for prior deliverables. Report findings as-is.
- NOT a license to modify any prior deliverable, code, rule, script, or parallel-task output.

## §1 Sources — what to bundle

### Sources on `origin/staging` (visible to this container after staging sync)

1. **Raw research patch** — `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md`. Read end-to-end. Carries 10 falsifiable claims (C1-C10) with "Wrong if:" falsifiers, 8-item verify-list, 5 parked forks, §1.7 self-review.
2. **Candidate-shapes catalogue** — `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md`. Read end-to-end. 18 candidate shapes (α-σ) neutrally described.
3. **Inflight-context dossier** — `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md`. Read end-to-end. What else is moving on this surface.

### Sources from parallel aif tasks (read from project output dirs)

The 3 parallel tasks are done. Their output files are at these host paths — but you may not see host paths from inside the container. If you don't see them, use the **fallback procedure** in §2.

4. **Runtime-probe report** — `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scripts-f164e8-f164e807-191a-4336-9fe1-52145255c00e/per-role-context-runtime-probe-report.md`. Verifies 6 claims (P1-P6) in live CC runtime. **Key finding**: P5 REFUTED (digest location differs from what the raw research patch claimed).
5. **Deep-project-research report** — `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scripts-f4dc0b-f4dc0bff-37c6-4662-abab-5c67c9a646b6/per-role-context-deep-research-report.md`. Exhaustive sweep of 13 surfaces. **Key finding**: S13 documents `subagent_type:"implement-worker"` runtime dispatch (partial refutation of "no per-role runtime branching").
6. **Cold-review report** — `/Users/art/code/aif-handoff/projects/rules-as-tests-aif-feature-scripts-4e73e5-4e73e54e-da1f-44a8-979e-209013a9e6cd/per-role-context-cold-review-report.md`. Was a blocker-report in v1; NOW the deliverables are reachable, so the cold-review findings (if the operator re-dispatches it) would carry content. **For this bundle**, treat the cold-review blocker-report as historical evidence that the prior container couldn't see the deliverables; do NOT pretend it audited.

## §2 Fallback if host paths unreachable

If `/Users/art/code/aif-handoff/projects/...` is unreachable from inside the container (same container isolation that blocked v1):

**Branch B (autonomy fallback — assemble from staging + reason about the parallel tasks from their taskIds):**

1. Read the 3 staging deliverables (Sources 1-3) — these ARE visible.
2. For each parallel task (4-6), query the aif-handoff backend if reachable:
   ```bash
   curl -s http://localhost:5180/api/tasks/<taskId> | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('status'));print(d.get('reason','')[:500])"
   ```
   If reachable, the `reason` field may carry the task's output summary.
3. If neither host paths NOR aif-handoff backend are reachable, write the bundle with:
   - §1 fully populated (from staging)
   - §2/§3/§4 with `(host path known: <path> — operator copies the file from host when handing to Opus)` markers
   - §5 contradictions **inferred from the staging deliverables alone** (e.g. the raw research patch's C5 says "no per-role branching" — note that the deep-project-research is reported to have found `subagent_type:"implement-worker"` runtime dispatch, which would partially refute C5; flag this as a contradiction for Opus to verify on host)
   - §BLOCKER documenting what was unreachable

The bundle is still useful in Branch B because §1 carries the substrate; Opus on the host can read the parallel-task output files directly.

## §3 Bundle structure

Write `per-role-context-bundle-for-opus-in-cc.md` to project root with this structure. **Preserve contradictions** — if runtime-probe REFUTES a claim that the raw research patch ASSERTS, both go in §5.

```markdown
# Per-role context — bundle for Opus in CC (v2)

**Assembled:** <timestamp>
**Assembler:** aif-handoff container
**For:** Opus review + fabla-prep in CC
**Session boundary:** GLM (worktree) → aif (3 verify tasks + this bundle) → Opus (CC, review + fabla-prep). Opus is the filter; fabla is the decider.

## 0. Reading order for Opus (suggested, not binding)

1. §1 — Original operator question + 3 deliverables (the substrate)
2. §2 — Runtime-probe results (live verification)
3. §3 — Deep-project-research results (exhaustive sweep)
4. §4 — Cold-review findings (audit of the deliverables)
5. §5 — Contradictions to resolve (the load-bearing unknowns)
6. §6 — Parked forks + candidate shapes (the decision space)

## 1. Substrate: the operator's question + 3 GLM deliverables

<operator question verbatim from raw research patch §Problem>
<summary of each of the 3 deliverables with one-line "what it claims to be" + a path-to-read>

## 2. Runtime-probe results (live CC verification)

<P1-P6 verdicts, copied from the runtime-probe report — each with CONFIRMED/REFUTED/PARTIAL + the live evidence>

## 3. Deep-project-research results (exhaustive sweep)

<S1-S13 surface findings, copied/summarized from the deep-research report>
<Q1-Q7 load-bearing question answers>

## 4. Cold-review findings (audit of the 3 deliverables)

<if v1 blocker-report: state it was blocked, quote the §BLOCKER>
<if operator re-dispatched cold-review with staging access: copy the A-H findings>

## 5. Contradictions to resolve (LOAD-BEARING)

<table: source A claim, source B counter-claim, what Opus needs to verify to break the tie>

This is the most important section. Where sources disagree, the bundle preserves both — Opus decides.

Known contradictions to seed the table (from staging sources + parallel-task summaries):
- raw research patch C5 ("no per-role branching in any hook") vs deep-project-research S13.a finding (`subagent_type:"implement-worker"` runtime dispatch documented in `docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md:71,103,141`).
- raw research patch C5/C10 P5 file:line ("digest in session-bootstrap.md between markers") vs runtime-probe REFUTED (digest is inline-heredoc in `inject-session-bootstrap.sh:25-33`).
- raw research patch C10 (uniform digest = deliberate anti-drift) vs the operator's framing (worker should not receive goal/architecture) — surface as a fork, not a contradiction, but flag the tension.

## 6. Parked forks + candidate shapes (decision space)

<5 forks from the raw research patch, copied verbatim>
<18 candidate shapes (α-σ), referenced by path not copied — Opus reads the original>

## 7. What the bundle does NOT do

- Does NOT pick a candidate shape.
- Does NOT resolve forks.
- Does NOT filter out "wrong" findings — contradictions preserved.
- Does NOT recommend next steps for Opus.
- Does NOT pre-load the fabla's framing.

## §BLOCKER (if Branch B taken — else omit)

<what was unreachable, why, and what the operator needs to do to give Opus the full picture>
```

## §4 Constraints

- **Read-only.** Do not modify any prior deliverable, code, rule, script, or parallel-task output. Copy/summarize; do not edit.
- **No filtering.** If a finding looks wrong, copy it anyway with a "(unverified)" note. Opus filters.
- **No recommendation.** Opus + fabla decide.
- **Preserve contradictions explicitly.** §5 is load-bearing.
- **Cite source paths** for every copied finding so Opus can verify.
- **Self-application.** This task's own output is part of the surface — note it but don't audit yourself.

## §5 After writing the bundle

The bundle file is the deliverable for Opus in CC. The operator will read it in a CC session (NOT in aif). The task ends when the bundle is written; no further action.
