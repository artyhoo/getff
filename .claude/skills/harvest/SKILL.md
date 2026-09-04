---
name: harvest
description: Use when harvesting a finished aif-agent branch into a PR after acceptance. Triggers: harvest, harvest aif branch, egress aif task, push harvested work, post-acceptance harvest. Invoked explicitly via /harvest only (disable-model-invocation:true).
arguments: [taskId]
argument-hint: "[aif-taskId-or-branch]"
disable-model-invocation: true
model: opus
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(tsx *)
  - Bash(npx *)
  - Bash(bash *)
  - Bash(docker *)
  - Read
---

<!-- @harness-posture: portable — bash/git/docker egress runbook over aif endpoints; helpers are plain bash; no CC-only primitive in the egress path -->

> **Class:** C — prose-only wiring skill; the executable artefact it gates is [`scripts/run-local-ci-sweep.sh`](../../../scripts/run-local-ci-sweep.sh) (paired-negative test wired in CI). Promotion criterion: a harvest reddens CI **after** this skill ships (skill skipped or a gate missing) → promote the sweep to a pre-push gate (spec §Promotion).
> **Authoritative for:** the standalone post-aif-acceptance harvest procedure — §1 egress (incl. the codified egress gotchas), §2 cross-stage integration, §3 the sweep gate, §4 cold-review + fidelity + PR.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The egress primitives themselves (`harvest.ts`, `harvest-via-api.sh`) — owned by `packages/runtime-bridge` + [/dispatcher](../dispatcher/SKILL.md). The local gate set — owned by [`scripts/run-local-ci-sweep.sh`](../../../scripts/run-local-ci-sweep.sh) (this skill calls it, does not redefine it). The full dispatch loop — see [/dispatcher](../dispatcher/SKILL.md).

> Build-vs-reuse: **ADAPT** — reuses `harvest.ts` / `harvest-via-api.sh` egress (SSOT #111) + `scripts/run-local-ci-sweep.sh` (SSOT #176, change-scoped sweep, ADAPT of #114) + `superpowers:requesting-code-review` (verify posture). No new dependency, no new code beyond the sweep.

# /harvest — post-aif-acceptance harvest

**Origin:** 2026-06-26. Harvesting a finished aif branch reliably reddens CI (PR #724 — 3 reds in a chain) or needs manual reconciliation; the steps lived only in user-scope memory. Spec: [docs/superpowers/specs/2026-06-26-harvest-skill-design.md](../../../docs/superpowers/specs/2026-06-26-harvest-skill-design.md).

> **⚡ aif environment rule:** on ANY aif environment symptom (container on wrong branch, push rejected, capacity full, missing tool, proxy/tunnel block), **first action = invoke [`/aif-doctor`](../aif-doctor/SKILL.md)** — do NOT `docker exec` fix-by-fix.

---

## §1 — Egress (push the committed work, never the dirty tree) {#egress}

<!-- CTX Stage 1 skill-embed anchor: .claude/rules/egress-no-api-bypass.md carries a
     "channel: skill-embed" token pointing here. This §1 already IS the run-moment
     procedure implementing that rule's §1 channel preference (host-push default,
     API break-glass) — see step 4/5 below. -->

Harvest the **committed** in-scope work only. aif worktrees arrive polluted (out-of-scope dirty files) on a stale base — the real work is in the commits, not the working tree.

1. **Inspect first — in the TASK's worktree, never the base clone.** `docker exec <agent> git -C <worktree> status --porcelain` + `git log origin/staging..HEAD`. Push the committed HEAD; never `git add -A` (gotcha 1). aif runs each task in its own worktree (`<root>-<branch-slug>-<taskId>`, also on the task's `worktreePath`); the base clone sits on `staging` with permanent `?? .claude/worktrees/` residue, so measuring it fabricates the step-2 `0-ahead + dirty` shape and strands the task on a bogus HOLD (2026-08-07 defect). `harvest.ts` now resolves the worktree itself (git's worktree list → `worktreePath` → `--work-dir`) and refuses to run the guards unless that checkout's HEAD **is** the task branch.
2. **0-commits-ahead + dirty tree** is ambiguous (false-done / parked-partial vs genuine rework). `harvest.ts` returns `needsConfirm` and exits non-zero — inspect the park signals, pass `--confirm-rework` ONLY for a genuine complete rework (false-done guard, [2026-06-23 spec](../../../docs/superpowers/specs/2026-06-23-aif-harvest-false-done-guard-design.md)).
   **≥1-commit-ahead + TRACKED files modified** is the D12 shape (aif review gate passed `done` with the deliverable partly uncommitted — 2×2026-07-25): `harvest.ts` HOLDs (`needsResidueConfirm`, exit 2). Preferred fix: a `request_changes` round so the worker commits its own work; `--confirm-dirty-residue` ships the commits and abandons the modifications (untracked-only dirt like `?? .claude/worktrees/` never holds).
3. **Reconstruct branch-behind EDITED files.** The container forked at an old base; a full override of an EDITED tracked file reverts staging changes it never saw. For each MODIFIED (not new) path, diff against `origin/staging` and keep it `+N/−0` (pure addition) — exclude any file showing `−` lines (gotcha 3 / 7c).
4. **Push channel — host-pull + host `git push` is the DEFAULT** (runs the real `.husky/pre-push` gate — the earliest reachable channel, per [egress-no-api-bypass.md §1](../../rules/egress-no-api-bypass.md)). The container is a **runtime, not a push env** (it cannot reach `github.com:443` — a network block, not auth — and lacks the pre-push toolchain), so do NOT push from inside it. Instead bring the committed branch to the **host** and push there: bundle the agent's commit out (`docker exec <agent> git -C <worktree> bundle create /tmp/<b>.bundle <branch>` → `docker cp` → host `git fetch /tmp/<b>.bundle <branch>`), check out the branch on the host, `git fetch origin && git rebase origin/staging` (the host carries the cost the API-land avoided — keep the branch rebased on live staging), then `git push origin <branch>` from the host. The host has working transport + the full toolchain (`gh`/`actionlint`/`zizmor`), so the literal pre-push hook runs. **NEVER `git push --no-verify`** (blocked by `git-safety.sh` and it would defeat the point).
5. **Break-glass ONLY — Git Data API land** (`harvest-via-api.sh`), used **solely when the host transport is ALSO dead** (host `git ls-remote origin` fails too). It lands server-side (blobs→tree→commit→ref on the LIVE staging tree), so it **skips the pre-push hook by construction** — this is why it is the channel of last resort, not the default ([egress-no-api-bypass.md §1](../../rules/egress-no-api-bypass.md)). When taken, the §3 `run-local-ci-sweep.sh` sweep is the **mandatory** gate-substitute. Command: `bash .claude/skills/dispatcher/helpers/harvest-via-api.sh --repo <o/r> --base staging --branch <b> --message <m> --srcdir <explicit paths…>` — pass each path as a separate literal arg, never a `$VAR` that won't word-split (gotcha 5 / 9).
6. **Clobber check (both channels, before landing).** When rebasing onto live staging (default) or building on the LIVE remote tree (break-glass), for every MODIFIED override path confirm `gh api .../compare/<fork-base>...staging --jq '.files[].filename'` ∩ your override-path list is **empty** (no shared file drifted past your fork), else rebuild that file = remote-base + your delta (gotcha 6 / 8).
7. **Capability-commit trailer.** A harvested file **≥80 LOC under `packages/`** is a capability-commit — the commit message MUST carry a `Prior-art:` line (the PR-body §1.7 does NOT satisfy the real-commit backstop). For a test-wrapper-of-existing-capability the honest form is `Prior-art: skipped — <why, ≥20 chars>` (gotcha 9).

## §2 — Cross-stage integration (parallel branches touching shared files)

When two parallel aif branches edited the same file: blob-compare each side's fork-base vs the live remote base; resolve deterministically (live-base content + each side's pure-addition delta); **then run §3 — the sweep is the falsifier** (run it AFTER the merge, never before).

## §3 — Sweep gate (before push)

Run the local CI-equivalent sweep on the harvested branch:

```bash
bash scripts/run-local-ci-sweep.sh            # diff-aware: only the gate families your change touches
bash scripts/run-local-ci-sweep.sh --full     # explicit full CI-equivalent (~5 min) — final pre-merge / broad diff
```

The sweep auto-scopes via `git merge-base`, escalates to `--full` on any unmapped path, runs cheapest-first with fail-fast. **Interpret reds against the merge-base:** a gate red on your branch AND on `origin/staging` is pre-existing (e.g. `layer-units`) — surface it, do NOT attribute it to the harvest. A **branch-introduced** red ⇒ **STOP, do not push** — fix it first. Whole-tree markdown gates (md-line / dead-links) and the `framework-self-*` self-install matrix are CI-only (see spec §Known gaps) — the sweep flags them as advisory, rely on CI for those.

## §4 — Cold-review + fidelity + PR

**Unattended runs:** the standing authorization for dispatching the cold subagents in steps 1-2 and for opening/squash-merging the PR in step 3 without a confirmation round is stated once in [`night-mode/SKILL.md` delta item 8](../night-mode/SKILL.md), with its escalation set and its honest Class-C classification. Not restated here (`#two-prompts-drift`).

1. **Own cold-QA before handoff** (T19) — CI checks form, not design. Invoke `superpowers:requesting-code-review` on the 3-dot diff (`git diff origin/staging...HEAD`).
2. **Fidelity verdict (design altitude — spec D2).** Dispatch
   [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md) as a cold read-only
   subagent **with an explicit `name`** (keeps the resume exception of
   [cold-seat-economy.md §3](../../rules/cold-seat-economy.md) reachable; the follow-up default
   is a fresh narrow seat): inputs = the
   stage kickoff/spec path + the same 3-dot diff, current HEAD sha,
   round number — nothing else (no chat, no logs).
   **Default format: inputs-inlined** (spec P7, [cold-seat-economy.md §3](../../rules/cold-seat-economy.md) row 4): inline the kickoff scope sections + diff into the dispatch prompt (~85k tokens / 0 tool calls vs ~177k tokens / 7 tool calls for file-reading — row 4 vs row 3). File-reading is the **fallback** when content size prohibits inlining. **Promotion trigger** (cross-stage boundary): 3 incidents of >100k-token file-reading seats → a mechanical check in **S-B's station** (S-B owns the bottom-seat check station; not implemented here).
   `REVISE`/`STOP` → do NOT open the PR;
   factory task → route the findings per [/dispatcher §2.4 rework loop](../dispatcher/SKILL.md),
   in-session work → fix and re-audit (Round 2); cap 2 rounds → escalate to the operator.
   `KICKOFF-AMBIGUOUS` → escalate to `/arch` §4 office hours without burning a round.
   `GO` → the verdict block (Basis/Round/Audited-SHA = current HEAD/Evidence) goes into the
   PR body `## Fidelity verdict` section — the `pr-body-fidelity` CI gate blocks merge without it.
   <!-- seat-economy embed (spec-of: .claude/rules/cold-seat-economy.md) -->
   **Seat economy** ([cold-seat-economy.md](../../rules/cold-seat-economy.md)): dispatch this
   WHAT-audit only once the diff is FINAL (step 1's code-review first — its fixes invalidate a
   parallel fidelity verdict), and at round 1 have the seat leave a compact **watch-list**
   (why each criterion exists, where defects lived) in the PR body / task comment. If a later
   commit moves the SHA but none of what the seat judges (deliverables / permitted files /
   descopes — confirm via `git diff --name-only <audited>..HEAD` against the kickoff),
   re-establish with a narrow cold delta check: a **fresh** cold agent handed only the
   incremental diff + scope sections + that watch-list (resume the same auditor by name only
   when the watch-list cannot carry the substance) — never a full re-audit, never a
   self-issued verdict.
   <!-- re-write-trigger embed (spec-of: .claude/rules/cold-seat-economy.md §3) -->
   **Re-write-trigger economy** ([cold-seat-economy.md §3](../../rules/cold-seat-economy.md)): when
   the seat has reached its natural end, the cached-prefix cost discipline applies —
   - prefer **artifact handoff** to a fresh seat over `/compact` — a fresh seat billed at read
     price on a narrow input is cheaper than re-billing the cached prefix at write price;
   - do **not** stretch a seat across the 1-hour TTL idle gap — the cached prefix expires; the
     next turn re-bills the whole prefix at write price;
   - avoid mid-session **model / effort switches** and **MCP toggles** on a fat context — each
     invalidates the cached prefix and re-bills it at write price (pending S-H P3d verification
     of the config-change class — rev 4 moved P3d there; same handoff rule applies until
     verified otherwise).
3. Assemble a **§1.7-compliant PR body** (Forward/Backward sections, each with file:line) **plus the acceptance-package sections (Provenance / Review findings / Fidelity verdict / Parked questions — spec D4)**. Open the PR with base `staging` (`gh pr create --base staging`), optionally `gh pr merge --auto --squash` per the dispatcher convention.
   **After the PR is open, any push that moves the head off `Audited-SHA` reds the gate** — most often a merge-forward commit taken to re-run acceptance against current staging. What to push instead (and the force-push one-way door that closes the cheap option): [git-conflict-merge-forward.md §9](../../rules/git-conflict-merge-forward.md). The body can be checked against a candidate head before pushing, with the gate's own `checkPrBodyFidelity` — command in that §9.
4. Confirm the PR diff is exactly the intended files, **0 unintended deletions**, before merge.

---

## Without this skill

The operator hand-runs the harvest from memory: inspects the container, picks a push channel, hand-reconciles shared-file collisions, and runs _whichever_ gates come to mind before pushing. The recurring outcome (PR #724) is a push that reddens CI on a gate that was never re-run locally — and a round-trip per red. The 9 egress gotchas live only in user-scope memory, invisible to a fresh session or a different machine.

## With this skill

The four steps run in a fixed order that cannot be silently skipped: egress with the gotchas spelled out inline, deterministic cross-stage reconciliation, then **one command** (`run-local-ci-sweep.sh`) that runs the diff-scoped CI-equivalent gate set before push — the forgotten gate is no longer forgettable. The egress discipline is codified in the repo, not in one session's memory, so any harness (CC / Cursor / Codex) following this skill harvests the same way.
