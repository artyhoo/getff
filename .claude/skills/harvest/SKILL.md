---
name: harvest
description: 'Use when harvesting a finished aif-agent branch into a PR after acceptance. Triggers: harvest, harvest aif branch, egress aif task, push harvested work, post-acceptance harvest. Invocation channel: explicit /harvest only — disable-model-invocation:true is a channel flag and not a permission (§0).'
arguments: [taskId]
argument-hint: '[aif-taskId-or-branch]'
disable-model-invocation: true
model: opus
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(tsx *)
  - Bash(npx *)
  - Bash(bash *)
  - Bash(docker *)
  - Bash(curl *) # GH #1704: §1 step-0 host-side bridge-health preflight
  - Read
---

<!-- @harness-posture: portable — bash/git/docker egress runbook over aif endpoints; helpers are plain bash; no CC-only primitive in the egress path -->

> **Class:** C — prose-only wiring skill; the executable artefact it gates is [`scripts/run-local-ci-sweep.sh`](../../../scripts/run-local-ci-sweep.sh) (paired-negative test wired in CI). Promotion criterion: a harvest reddens CI **after** this skill ships (skill skipped or a gate missing) → promote the sweep to a pre-push gate (spec §Promotion).
> **Authoritative for:** the standalone post-aif-acceptance harvest procedure — §1 egress (incl. the codified egress gotchas), §2 cross-stage integration, §3 the sweep gate, §4 cold-review + fidelity + PR.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The egress primitives themselves (`harvest.ts`, `harvest-via-api.sh`) — owned by `packages/runtime-bridge` + [/dispatcher](../dispatcher/SKILL.md). The local gate set — owned by [`scripts/run-local-ci-sweep.sh`](../../../scripts/run-local-ci-sweep.sh) (this skill calls it, does not redefine it). The full dispatch loop — see [/dispatcher](../dispatcher/SKILL.md).

> Build-vs-reuse: **ADAPT** — reuses `harvest.ts` / `harvest-via-api.sh` egress (SSOT #111) + `scripts/run-local-ci-sweep.sh` (SSOT #176, change-scoped sweep, ADAPT of #114) + `superpowers:requesting-code-review` (verify posture). No new dependency, no new code beyond the sweep.

# /harvest — post-aif-acceptance harvest

## §0 Invocation

**Slash command:** `/harvest [<aif-taskId-or-branch>]`

> **Invocation-channel flag, not a permission.** `disable-model-invocation: true` keeps a skill out of auto-load and out of subagent preload, and stops the Skill tool from invoking it — an explicit `/<name>` from the operator is its only invocation channel, so an agent never self-initiates the procedure. It does **not** seal the file: an agent already asked to do this work may read the SKILL.md and execute its documented steps, and doing so is correct behaviour, not a workaround. On ZCode the flag is not runtime-enforced (absent from the runtime, survey #1699 §5): there the explicit-only channel discipline is prompt-level — this blockquote is the gate, so an agent on ZCode must still treat an explicit /<name> as the only self-initiation channel. <!-- canonical: invocation-channel-flag -->
> Full contract (what the flag does, what it does not, and the two misreads that cost autonomy): [operational-conventions.md §4](../../../docs/meta-factory/operational-conventions.md#4-disable-model-invocation--an-invocation-channel-flag-not-a-permission).

Input: `/harvest [<aif-taskId-or-branch>]` after aif acceptance. Output: reconciled committed in-scope work, local sweep receipts, cold/fidelity verdict, and an authorized staging PR with task closure after merge. Follow the four stages in order; do not infer permission beyond the operator's actual scope.

> **⚡ aif environment rule:** on ANY aif environment symptom (container on wrong branch, push rejected, capacity full, missing tool, proxy/tunnel block), first action = invoke [/aif-doctor](../aif-doctor/SKILL.md); do NOT `docker exec` fix-by-fix.

## §1 — Egress (push committed work, never the dirty tree) {#egress}

Before any egress work, from the HOST run `curl -s -m5 localhost:3009/health`; require `"status":"ok"`. Failure ⇒ print the remediation in [the egress runbook](references/egress.md) and STOP before inspection/landing. Bring the service up via [runtime-bridge setup](../../../docs/runtime-bridge-setup.md), then re-probe.

Before inspecting or landing a task, read [the egress runbook](references/egress.md) for exact commands and guards. Mandatory constraints:

- Inspect the TASK worktree, never the base clone; HEAD must be the task branch. Ship committed in-scope work only; never `git add -A`.
- `0-ahead + dirty` ⇒ `needsConfirm`, inspect parks; `--confirm-rework` only for genuine complete rework. `≥1-ahead + tracked modifications` ⇒ `needsResidueConfirm`, exit 2/HOLD; prefer `request_changes` so the worker commits. `--confirm-dirty-residue` abandons modifications; untracked-only residue does not hold.
- Reconstruct MODIFIED paths from live staging plus your delta; pure addition `+N/−0`, exclude deletion-bearing overrides. Check fork-base/live-staging intersection for every override; shared drift ⇒ rebuild before landing.
- Default: bundle/pull committed branch to HOST and use host `git push` with the actual pre-push gate. Container is runtime, not push environment. NEVER `git push --no-verify`.
- Git Data API is break-glass ONLY when host `git ls-remote origin` also fails; §3 sweep is then mandatory gate-substitute. Pass each override path as a literal argument, never an unsplit variable.
- Capability commits need a resolvable `Prior-art:` trailer in the real commit; PR §1.7 cannot replace it and `skipped` cannot satisfy a flagged capability. Apply CLAUDE.md classification, including test carve-outs and the direct-principles exception.

## §2 — Cross-stage integration (parallel branches touching shared files)

When two parallel aif branches edited the same file: blob-compare each fork-base against live remote base; resolve as live-base content plus each pure-addition delta. Run §3 AFTER integration; the sweep is the falsifier.

## §3 — Sweep gate (before push)

Run the local CI-equivalent sweep on the harvested branch:

```bash
bash scripts/run-local-ci-sweep.sh            # diff-aware: only the gate families your change touches
bash scripts/run-local-ci-sweep.sh --full     # explicit full CI-equivalent (~5 min) — final pre-merge / broad diff
```

Every gate's output is written to a per-run log directory (`SWEEP_LOG_DIR` pins it); a FAIL prints that gate's log path plus the last 40 lines inline, and the final line names the directory — so a red never has to be reproduced by hand to be read.

The sweep auto-scopes via `git merge-base`, escalates to `--full` on any unmapped path, runs cheapest-first with fail-fast. A stop prints `SWEEP: NOT RUN: <gates>` — the selected gates it never reached; those are **unknown, not green** — re-run with `--keep-going` (runs every selected gate, exits 1 at the end naming all FAILs) before claiming coverage. **Interpret reds against the merge-base:** a gate red on your branch AND on `origin/staging` is pre-existing (e.g. `layer-units`) — surface it, do NOT attribute it to the harvest. A **branch-introduced** red ⇒ **STOP, do not push** — fix it first. Whole-tree markdown gates (md-line / dead-links) and the `framework-self-*` self-install matrix are CI-only (see spec §Known gaps) — the sweep flags them as advisory, rely on CI for those.

## §4 — Cold-review + fidelity + PR

For unattended authorization, read [night-mode overnight policy](../night-mode/references/overnight-policy.md), including delta item 8, its escalation set and its honest-classification posture, before dispatch/publication decisions. The invocation flag is a channel rule, not permission.

1. Own cold-QA before handoff: invoke `superpowers:requesting-code-review` first on `git diff origin/staging...HEAD`; CI checks form, not design. Before cold review/fidelity dispatch (the cold `agents/fidelity-auditor.md`), read [cold review and fidelity](references/fidelity.md) for exact seat inputs, pinning, watch-list/delta handling and seat economy.
2. Dispatch fidelity only on FINAL diff, after code-review fixes, with explicit seat `name` and `Inputs-ref` equal to current HEAD for every input. Inline scope+diff by default; fallback uses snapshot paths, never live worktree paths. `REVISE`/`STOP` ⇒ no PR; factory rework via dispatcher, in-session fix/re-audit. Cap 2 rounds ⇒ operator. `KICKOFF-AMBIGUOUS` ⇒ /arch office hours without burning a round. `GO` verdict needs Basis/Round/Audited-SHA=current HEAD/Evidence. Later SHA changes require a fresh narrow cold delta check (named resume only if watch-list cannot carry substance), never self-issued verdict/full re-audit by default.
3. Before publication or closure, read [publication and task closure](references/publication-and-closure.md) for the exact commands (`tsx packages/runtime-bridge/src/cli/harvest.ts`), identity checks and optional auto-merge flow. PR requires §1.7 Forward/Backward file:line sections plus Provenance/Review findings/Fidelity verdict/Parked questions, terminal `aif-task: <taskId>`, base `staging`. Moving head off Audited-SHA reds fidelity; follow [merge-forward §9](../../rules/git-conflict-merge-forward.md) for re-establishment and candidate-head check.
4. Before merge, confirm exact intended files and 0 unintended deletions.
5. After merge, close via `harvest.ts <taskId> --close-merged`, never manually in UI; task ownership, merge/activity checks must pass. For auto-merge, scheduled close-merged sweep owns later closure; its installation/status details are in the publication reference.

For incident provenance and the original before/after rationale, read [harvest history](references/history.md).

## Without this skill

A harvest ships stale overrides or uncommitted residue and discovers an omitted gate only in CI, forcing a repair round per failure.

## With this skill

Committed work passes task-worktree guards, live-base reconciliation, the local sweep and cold fidelity before publication; merged task closure is verified through the CLI.
