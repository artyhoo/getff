# pipeline — dispatch

> **Authoritative for:** the selected pipeline procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §5 Dispatch tree

> Mutually exclusive routing per sub-wave type. Pick exactly ONE row that matches the sub-wave's nature.

**Decision table (rows are mutually exclusive):**

| Sub-wave nature                                                | Dispatch mode                          | Mechanism                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-phase, single                                                | Mode A inline                          | Single-focus R-phase = one Opus session. Queue mode is for ≥2 sequential kickoffs (§5 vocabulary note).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R-phase, multiple sequential                                   | Queue mode (sequential)                | ≥2 R-phase kickoffs queued; each completes before the next begins (trigger: «≥2 sequential kickoffs», §5 vocabulary note).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R-phase, multiple parallel                                     | Mode A × N inline Agents               | Single-session multi-dispatch via Agent tool calls in one message. No worktrees needed (R-phases produce docs, not code).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Execution-build, single                                        | Mode A inline                          | Direct Opus session with kickoff pasted or Read.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Execution-build, parallel ≥2 in same stage                     | Mode B × N worktrees                   | Preferred: `claude -w <umbrella>-<wave-N>` per CC native `--worktree` (worktree under `.claude/worktrees/`, branch `worktree-<name>`, base `origin/HEAD`; PR #279 hook auto-symlinks `node_modules`). Fallback (non-CC harness or settings.json unwired): `bash scripts/create-worktree.sh <name>` (portable, refreshes origin/HEAD so base-ref is never stale — Bug 1 fix) or manual `git worktree add ../<repo>-<wave>-<N> staging && git checkout -b <branch>` per `parallel-subwave-isolation.md §1`. SP `using-git-worktrees` SSOT #65 is the upstream preventive mechanism (dogfooded, not rebuilt).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Wiring (thin CI/config)                                        | Mode A inline                          | Single session; low blast radius; worktrees add overhead without isolation benefit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Manual liveness probing                                        | Session-bound                          | Never CI-side. SP companion-type.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Execution-build, **autonomous (aif-handoff bridge reachable)** | Autonomous dispatch via runtime-bridge | `tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff>` in the framework repo — on a consumer install the CLI arrives via the vendor drop, so the path is `.claude/vendor/runtime-bridge/src/cli/dispatch.ts` (`packages/` does not exist there) — when `RUNTIME_BRIDGE_MODE` ∈ {`aif-handoff`,`auto`} + aif answers on `RUNTIME_BRIDGE_AIF_URL` (#312/#313). aif builds itself; you stop pasting tabs. **Precondition:** kickoff MUST carry §4c park-don't-guess (else aif guesses silently). Unreachable → `ManualBackend` fallback → use paste row. See `#autonomous-dispatch-without-park`. **Egress (mandatory after `status=done`):** aif does NOT push or open PRs by design — `harvest.ts` closes this gap. Run: `npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging` — pushes branch from container via `docker exec`, opens PR from host where `gh` is authed, enables squash auto-merge. Anti-pattern `#autonomous-done-no-harvest`: task reaches `status=done` but orchestrator doesn't call harvest → work stays in container forever. |

**Park-record contract — where a fired PARK is recorded (a stage kickoff's §2 needs no entry for it).** A stage kickoff pairs a `## §2 Permitted files` allowlist with the §4c park-don't-guess contract, which tempts an author to add a park-record artefact to the allowlist. Do not: **recording a PARK is not a file write.** A fired PARK is recorded in exactly two places, both outside the working tree — (a) the **park payload**: `manualReviewRequired` / `blocked_external` with `blockedReason` stating the fork as «Option A → consequence X / Option B → consequence Y» (`questions.ts:85-93` detects it); (b) the stage PR body's **`## Parked questions`** section — an acceptance-package section already required by spec D4 and already stubbed in [`.github/pull_request_template.md`](../../../../.github/pull_request_template.md), routed by `dispatcher/SKILL.md §3` (factory depth only). Propagating a PARK's _correction_ into the design spec, an ADR, or any kickoff is a **separate owner commit on that artefact**, never part of the stage PR: spec → a spec-owner commit (precedent PR #1252); kickoff → its own staging PR per [kickoff-staging-placement.md §1](../../../rules/kickoff-staging-placement.md). Kickoff authors state this in §2 instead of widening the allowlist — canonical clause to copy: «Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands in the park payload + the PR's `## Parked questions`, and its correction lands as a separate owner commit — so this allowlist deliberately names no park-record artefact.» Origin: arch-v2 S-E round-4 fidelity audit, watch-list W-5 — §2 named nowhere for a fired PARK, so the stage session edited both its own kickoff and the design spec, outside the allowlist.

**SDD sub-wave dispatch (within execution-build):**

When SDD?=Yes per §3 launch-table:

- Implementer session: standard Mode A or B kickoff.
- Spec-reviewer session: Agent tool with explicit spec-review role (reads kickoff, verifies implementation matches spec).
- Code-quality-reviewer session: Agent tool with code-quality role (lints, tests, structure).

Use SP `subagent-driven-development` SSOT #64 vocabulary for role names (ADOPT-VOCABULARY per R-phase patch §3 leapfrog table).

**Mode A parallel workaround (nesting constraint):** when Mode B worktrees are unavailable (e.g. filesystem constraints per parallel-subwave-isolation.md §2), fall back to sequential Mode A — NOT concurrent shared-dir execution (§3 anti-pattern `#shared-workdir-parallel`).

**Vocabulary alignment (T16 verified):**

- «Mode A / Mode B» = primary orchestrator skill vocabulary (SSOT in orchestrator SKILL.md).
- «SDD» = `subagent-driven-development` SSOT #64, verified T16 match: upstream problem class = «single complex feature implemented iteratively with spec+code+quality reviewers»; ours = same, used at sub-wave level.
- «Queue mode» = this skill's dispatch-mode vocabulary (§5 dispatch table; trigger = ≥2 sequential kickoffs). A separate `queue-mode.md` reference file never shipped — dangling refs removed 2026-07-02.

**Antipatterns:**

- `#umbrella-execution-launch-without-operator` (formerly `#worker-dispatch-via-subagent` — renamed 2026-10-04, plain-words-recap-v2 D6: the ban is on launching EXECUTION of an umbrella stage from a kickoff, not on the subagent tool; identical for subagent / aif dispatch / `claude -p`) — Worker dispatch via Agent tool from the meta-orchestrator session. Agent tool is ONLY for Phase -1 read-only reviewer (`reviewer-discipline.md §2`) + read-only research subagents (text return). Write-task Worker dispatch belongs in a fresh CC session opened by the maintainer pasting a §10 1-liner block. Channel matters — maintainer-paste = external loop-close; Agent-tool = subagent = wrong channel for writes. **Empirical backstop:** [bug #39886](https://github.com/anthropics/claude-code/issues/39886) confirms Agent tool + `isolation:"worktree"` for WRITE tasks silently fails (closed-as-duplicate; status uncertain in CC 2.1.143) — independent evidence the channel boundary holds for writes; read-only Agent dispatch remains OK. **Falsifier:** the channel boundary holds even when prompt shapes converge — the test is «who invokes», not «what the prompt looks like». **Class A (M6, 2026-06-27, SSOT #178):** enforced by one shared matcher ([`packages/core/principles/29-worker-dispatch-channel.ts`](../../../../packages/core/principles/29-worker-dispatch-channel.ts)) called from two channels — the edit-time hook [`.claude/hooks/check-worker-dispatch-channel.sh`](../../../hooks/check-worker-dispatch-channel.sh) and the CI principle test [`packages/core/principles/29-worker-dispatch-channel.test.ts`](../../../../packages/core/principles/29-worker-dispatch-channel.test.ts), scoped to `.claude/orchestrator-prompts/*/kickoff.md`. **Honest ceiling:** this is a kickoff-_text_ gate (fires on a kickoff whose prose instructs Agent-tool write-dispatch — the documented incident class); it does NOT catch a session that merely _performs_ the dispatch at runtime (the falsifier's «who invokes» surface stays Class C). **Escape token:** a kickoff that legitimately QUOTES/TEACHES the anti-pattern opts a line out with same-line `<!-- channel-discipline: allow <reason> -->` (modeled on `ci-tool-pinning.md §3`'s `# ci-tool-pin: allow`).
- `#commit-on-behalf-of-worker` — the meta-orchestrator running `git commit` / `gh pr create` for work it dispatched. Worker commits its own work under its own audit trail. **Falsifier:** Worker session crashed mid-task with the diff fully authored there → surface to maintainer, never silently absorb.
- `#park-record-outside-the-allowlist` — a stage session recording a fired PARK, or propagating its correction, by editing its own kickoff / the design spec / an ADR — files its `## §2 Permitted files` does not name — instead of the park payload + the PR's `## Parked questions`. **Falsifier:** the stage PR's diff touches `.claude/orchestrator-prompts/**` or `docs/superpowers/specs/**` while its kickoff §2 names neither → the propagation was mis-routed and belongs in a separate owner commit. Counter: the park-record contract under §5's dispatch table. Origin: arch-v2 S-E round-4 fidelity audit W-5 (PR #1237); the sibling W-9 resolution shipped the conformant shape (PR #1252, a separate spec-owner commit).- `#autonomous-dispatch-without-park` — dispatching a kickoff to aif-handoff (autonomous row above) without its §4c park-don't-guess contract → aif guesses every fork, closes wrong silently (design §1, `coordinator.ts:398-476`). **Falsifier:** `grep -qi 'park it as a question'` the kickoff (case-insensitive — the contract text capitalizes «Park», a case-sensitive `grep -q` false-fails on canonical Lever-2 text) AND probe Lever-1 container-side: `docker exec <agent-container> sh -c 'echo "${AGENT_MAX_REVIEW_ITERATIONS:-UNSET}"'`. A host-side `echo "$AGENT_MAX_REVIEW_ITERATIONS"` is **UNVERIFIED** — the value is not forwarded to the aif loop (no `packages/runtime-bridge/src/**` forwarding path, no compose key, re-verified 2026-08-06). When the container probe returns `UNSET` or the container is unreachable, Lever-1 is **UNVERIFIED**: the dispatch carries «park contract present, review-iteration ceiling unconfirmed», NOT a passing gate. Either leg missing/unverified → STOP, add §4c or use paste-tabs. **Sibling `#tabs-by-default-when-bridge-up`:** emitting only paste-tabs while the bridge is up wastes #312/#313 — probe (`[ -n "$RUNTIME_BRIDGE_MODE" ] && curl -s -m2 "${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}/" -o /dev/null -w '%{http_code}\n'`) + offer alongside tabs.

---

## §5.5 Bundle composition

> **B1/B2/B3a binding.** After §2.5 BUNDLE routing, before §6. Meta-orchestrator = planner/router; executor = downstream `orchestrator` skill. Full spec: [`references/bundle-composition.md`](bundle-composition.md). **B1:** `bundle-curate.sh "<backlog>"` → eligibility filter (`fix`/`I-phase-small`), file-overlap reject, max-5 cap. **T-BA-C:** `R-phase`/`I-phase-large` in output = BLOCKER. **B2:** save `composed-plan.md` (gitignored) + emit one-way launch-prompt. **Auto-approve FORBIDDEN.** **B3a (5 checks):** Independence · Mode coherence · Skill coherence · Order rationale · Caps respected. ≥1 BLOCKER → DO NOT emit. Anti-patterns: `#bundle-execution-loop` · `#auto-approve-bypass` · `#bundle-with-ineligible`.

---

## §6 Stage gates

> Between stages: REAL git merge check, not in-memory FIFO.

**Step 1 — inject merge state before each stage transition:**

```bash
gh pr list --search "is:merged head:<stage-N-branch> base:staging" --json number,title,mergedAt,headRefName --limit 10 2>/dev/null || echo "gh unavailable — cannot verify stage gate"
```

Replace `<stage-N-branch>` with the actual head branch from the Stage N sub-wave (derived from kickoff or launch-table). The recycled-branch search gotcha (T-MOB-B) and this section's honest enforcement class (Class C, prose): [`references/stage-gates.md`](stage-gates.md).

**Step 2 — evaluate gate:**

If Stage N PRs are NOT merged → **HALT**. Emit:

```text
STAGE GATE: Stage N is NOT clear.
Required: <list of PRs that must be merged>
Current state: <gh output>
Action: do NOT dispatch Stage N+1 until the above PRs are merged to staging.
```

If Stage N PRs ARE merged → proceed to Stage N+1 dispatch.

**Step 3 — claim the lane, THEN Phase -1 cold-review (mandatory, in this order):**

Claim BEFORE the review window and release/cancel on its verdict: every historical double-dispatch materialised INSIDE that window ([CLAUDE.md `Pre-dispatch in-flight probe`](../../../../CLAUDE.md)), so a marker written after it guards nothing. A claim is an ordinary aif task created `paused:true` — it is intended to stay at `backlog` without execution until release, and is what makes `probe-inflight.sh` report `CLAIMED` instead of `FRESH` (spec §5.3 / D-H5; premise P-5 — no second status vocabulary, `state.md` stays the journal).

```bash
CLAIM=$(npx tsx packages/runtime-bridge/src/cli/claim.ts create "$(bash ".agents/procedures/pipeline/helpers/print-orch-home.sh" 2>/dev/null)/<slug>/kickoff.md" | jq -r .taskId)
```

**Capacity caveat:** the bridge creates a paused task, but does not implement the upstream capacity counter. A paused flag alone does not prove a free lane; paused `plan_ready`/`review` slot-holders are documented by doctor §3.2. Verify task status and the coordinator's logged active/limit before assuming available capacity.

Then invoke §7 Reviewer dispatch — NOT optional; auto-continuing without GO = T4 anti-pattern. On **GO**: `claim.ts release "$CLAIM"`. On **RED**: `claim.ts cancel "$CLAIM"` — the task is deleted and the lane freed. Never leave a claim standing past the verdict; an abandoned one ages into the probe's `STALE-CLAIM`, which surfaces a loose end rather than blocking the stage forever. Bridge unreachable → `claim.ts` exits non-zero and claims NOTHING (no silent manual fallback): run Phase -1 anyway and record that the stage ran unguarded. Consumer install path: `.claude/vendor/runtime-bridge/src/cli/claim.ts`. Full protocol, failure posture, orphan expiry and the P4 proof obligation: [`references/claim-machinery.md`](claim-machinery.md).

---

## §7 Reviewer dispatch

> Phase -1 cold-review between stages. Required before Stage N+1 admission.

**Trigger:** after each stage completes (all sub-wave PRs merged, §6 gate confirmed green).

**Unattended runs:** the standing authorization that lets this dispatch (and the harvest/merge steps downstream) proceed without a confirmation round is stated once in [night-mode authorization, delta item 8](../../night-mode/references/overnight-policy.md) — including its escalation set and its honest Class-C classification. Not restated here (`#two-prompts-drift`).

**Dispatch via Agent tool:**

```text
Agent: Phase -1 cold-review for <umbrella> Stage <N>
Role: reviewer (not orchestrator, not implementer)
Skill: requesting-code-review (SP SSOT, REFERENCE — see R-phase patch §3 leapfrog table)
```

**Reviewer discipline (reviewer-discipline.md §2 pattern — mandatory):**

The dispatched reviewer:

1. Reads the Stage N diff (`git diff staging...<stage-N-head>`).
2. Reads the meta-kickoff Stage N acceptance criteria.
3. Emits GO / REVISE / STOP verdict with BLOCKER/MAJOR/MINOR/ESCALATED classification — severity contract per [reviewer-discipline.md §6](../../../rules/reviewer-discipline.md): a round-triggering finding carries a `Failure-scenario:` line; scenario-less findings = notes lane; unrecorded value premise → `ESCALATED` to the concept holder. Grade with the three-axis triage rubric quoted verbatim at [reviewer-discipline.md §6.1](../../../rules/reviewer-discipline.md), carrying its per-axis provenance — `layer` `corpus-measured`, `whose` `judgment-only, not corpus-validated`, class a measured null (the recorded grade, not the rubric, stays the class bar).
4. For any finding requiring strategy choice: emits «DECISION-NEEDED: <one-line>. Option A → consequence X. Option B → consequence Y. Maintainer decides.» — does NOT pick the strategy.

The reviewer does NOT:

- Edit any file.
- Pick project strategy.
- Approve on behalf of the maintainer.
- Skip surface review if «CI is green» (T19 — CI ≠ design review).

**Verdict routing:**

- **GO** → proceed to §5 Dispatch tree for Stage N+1.
- **REVISE** → only on `Failure-scenario:`-bearing findings (reviewer-discipline.md §6); surface findings to maintainer; worker fixes; repeat Phase -1.
- **STOP** → escalate to maintainer; halt Stage N+1 dispatch.

**T16 verification (upstream problem-class match):**

SP `requesting-code-review` upstream problem class = «dispatch a reviewer subagent with git SHA references to review a specific change». Our problem class = same. **Match: YES** (per R-phase patch §3 leapfrog table — SP `requesting-code-review` row). ADOPT the SP dispatch template; add reviewer-discipline.md §2 strategy-fork-surface discipline on top.

---
