# beta-release night run — morning report (2026-09-02)

> **Scope:** the night of 2026-09-01 → 2026-09-02 driving `artyhoo/getff` toward the first beta along the plan artifact «Фронт до первой беты» (measured against `origin/staging`=`4ba2679ba5` at plan time; staging at report time = `ea032ef477`). Written by the closing advisor seat (worktree `beta-release-plan-c20d1e`), per [night-mode/SKILL.md «Terminal condition + morning report»](../../../.claude/skills/night-mode/SKILL.md). Night memory (full chronology) lives in the operator's memory file `project_beta_release_night_2026_09_01.md`.

## 1. What merged (staging, 21:xx → 02:43Z)

| PR                           | Squash SHA                  | What                                                                                                                                          |
| ---------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| #1521                        | — (evening)                 | aif-doctor fix                                                                                                                                |
| #1522                        | — (evening)                 | pre-merge-carrier-build `done.md`                                                                                                             |
| #1523 / #1542 / #1544        | —                           | container-probe series harvested (agitated-lumiere)                                                                                           |
| #1525 + #1541                | —                           | kickoff-s4 (beta-ai-docs-agnosticism S4) + its Decision 1                                                                                     |
| #1527 → #1543                | `b2af6a1fac` → `8f609c6f96` | kickoff `refresh-prune-consumer-rule` + Phase -1 revision (RP-1b barrel invariant)                                                            |
| #1545 + #1546                | `651daa47e3` + `4b873f3036` | kickoff `first-commit-passable` + Phase -1 revision                                                                                           |
| #1547                        | `af2a92271d`                | `kickoff-s3.decisions.md` — claims-conformance-auditor ship-or-skip (escalated)                                                               |
| **#1548**                    | `ff686ce77f`                | **P1 — refresh no longer prunes consumer eslint rules (BLOCKER #1519 closed)**                                                                |
| #1549                        | `596089db1f`                | `done.md` — umbrella refresh-prune-consumer-rule CLOSED                                                                                       |
| **#1550**                    | `7534fd9a48`                | **S3 — self-generating docs sweep (C5)**                                                                                                      |
| #1551                        | `180ebb440f`                | L1 — consumer-layout-probe-honesty                                                                                                            |
| **#1552**                    | `ee0ccfe593`                | **S2 — skills agnosticism probe (C3)**                                                                                                        |
| #1553                        | `aae758bc5f`                | `kickoff-l3.decisions.md` — Decision 1 rootPath over worktreePath                                                                             |
| #1554                        | `fb9b117f36`                | L2 — consumer-layout-probe-honesty                                                                                                            |
| **#1555**                    | `7adcdabc60`                | **F1 — first-commit-passable (BLOCKERs #1528/#1529/#1530 closed)**                                                                            |
| #1556                        | `2470ba64f6`                | `done.md` — umbrella first-commit-passable CLOSED                                                                                             |
| #1557                        | `99147d1731`                | L3 — consumer-layout-probe-honesty                                                                                                            |
| #1558                        | `ea032ef477`                | `done.md` — umbrella consumer-layout-probe-honesty CLOSED (issues #1459/#1414/#1439 closed)                                                   |
| dependabot #1230/#1149/#1217 | —                           | merged after fidelity/§1.7 blocks added; #1216 stays red (real install-sh shard-A failure on the fast-uri bump — deferred, not beta-blocking) |

**Umbrellas closed overnight:** refresh-prune-consumer-rule · first-commit-passable · consumer-layout-probe-honesty. **Open:** beta-ai-docs-agnosticism (S2+S3 merged; S4 gated on an operator click) · beta-docs-showcase (BS0 held by PARK-BSPRE-4).

**Phase-1 issue gate:** 0 open BLOCKERs. All four (#1519, #1528, #1529, #1530) closed via `Closes` keywords on squash. 22 issues remain open: 9 `[zcode-probe]` NON-BLOCKERs (#1531–#1537, #1539, #1540), #1487, 3 dependabot PR-linked, and the rest pre-existing.

**z.code cold probe (GLM-5.3, phase-1 «stranger's seat» proxy):** REPORT at `~/code/zcode-probe/2026-09-01/REPORT.md` — 3 PASS (enforcement fires, AI orientation from shipped artifacts, refresh preserves edits), 3 PARTIAL, 1 FAIL-vs-spec (no status command, #1538 closed NOT-REPRODUCED by the verifier), 1 GAP (uninstall). Its three BLOCKERs are the ones fixed by F1. Labelled per operator decision 3: **a proxy, not a real clean machine** — the «GLM one-button on a clean machine» criterion is still unmeasured.

## 2. Decision resolutions (technical forks, resolved autonomously)

- **F1 stall (48 min, aif `7097ed61`)** — not a candidate-filter defect. Root cause in aif-handoff coordinator design: one poll cycle awaits ALL project lanes (`coordinator.ts:1134`) and each lane drains its stage before the next stage (`[FIX:149]`, ~:1118-1124) → two head-of-line-blocking classes (cross-project cycle; intra-project stage order). Falsifier rounds 1+2 passed (F1 picked up exactly when L2 left planning). No shared-infra action taken. **Upstream defect class, see §7.**
- **S2 orphaned review** (container restart 21:54:52Z) — classified as the upstream watchdog's domain (`recoverStaleInProgressTasks`, 90-min stale timeout); it recovered on its own, retryCount stayed 0. No manual `answer.ts --decision retry` needed.
- **F1 harvest at the 600-line markdown wall** (`INSTALL-FOR-AI.md` union 600-601) — advisor resolution inside the F1 envelope: compress F1's own 3-line note to 1 line (→599); never trim the sibling stage's prose, never `--no-verify`. Applied in #1555. (No decisions.md entry — resolved by peer message; recorded here and in night memory.)
- **PR 1551 false-GREEN on a CONFLICTING head** — caught by the verify-on-explicit-SHA recipe; merged only after `ci-success` appeared on head `75ce070294`.
- **Issue closing** — advised `Closes #N` bullets in done.md PR bodies (precedent #1555), never a manual close (operator-only action).

## 3. Night-decided parks (in-envelope, decisions.md entry recorded BEFORE application)

1. **Decision 1, L3 (consumer-layout-probe-honesty)** — Signal-4 checkout derived from `GET /projects` (select `.id == RUNTIME_BRIDGE_AIF_PROJECT_ID` → `rootPath`, `reason=project-not-found|no-rootpath|no-project-id`, `AIF_REPO_PATH` override) instead of the kickoff's `worktreePath` suffix strip (undefined on a task-less consumer). Entry: [`kickoff-l3.decisions.md`](../../../.claude/orchestrator-prompts/consumer-layout-probe-honesty/kickoff-l3.decisions.md) (#1553, amended `11b2495fc2`). **Advisor slip recorded in the entry:** the first version named a per-id route `GET /projects/<id>` copied from the ask without probing — it is 404; the L3 executor's round-2 cold seat caught it. Rule for the seat: probe every route a decision names.
2. **Decision 1, S4 (beta-ai-docs-agnosticism)** — Context7 indexes `staging` now, flips to `main` at the Phase-2 promote (main is 631 behind; last promote #936). Decided by the night seat on advisor consult. Entry: [`kickoff-s4.decisions.md`](../../../.claude/orchestrator-prompts/beta-ai-docs-agnosticism/kickoff-s4.decisions.md) (#1541), status applied. The flip is owed as a spec §8 checklist PROPOSAL in the S4 PR body.
3. **PARK-BSPRE-3** — already applied by #1425 before the night (plan artifact stale); only the gitignored `state.md` record was updated. Nothing decided.

## 4. Night-decided asks

- `session-bus/asks/2026-09-02-dispatcher-claims-auditor-ship-or-skip.md` → entry [`kickoff-s3.decisions.md`](../../../.claude/orchestrator-prompts/beta-ai-docs-agnosticism/kickoff-s3.decisions.md) (#1547). Advisor verdict **B** (skip-list, parity with backward-sweep-auditor) as a morning follow-up PR; the decision OBJECT (`setup.d/20-agents.sh:26-32` + `install.sh` twin + principle-21 drift guard) sits outside S3 §5 → **floored, status parked-for-operator**. S3 shipped unchanged, so `agents/claims-conformance-auditor.md` is delivered to consumers until the operator picks. **Operator pick needed: A (ship as is) / B (skip-list) / C (strip factory refs).** Falsifier recorded: if the operator wants a consumer-side docs audit → C, never A.

## 5. BLOCKED increments (floors — operator action required)

- **BS0 (beta-docs-showcase, Fumadocs STOP-gate)** — held ONLY by **PARK-BSPRE-4**: the Claude account inside `aif-handoff-agent-1` is dead (creds 2026-08-09, `expiresAt: 0`); the operator wants BS0 on profile «Claude Opus (plan+review)» `41315ef6`, while `getff-landing` currently defaults plan/review to GLM `53eca24c`. Needs `claude /login` inside the container + a `defaultPlanRuntimeProfileId` flip — both credential/shared-infra floors. BS-pre→BS0 gate otherwise MEASURED GREEN (project `361685f1 getff-landing` listed, smoke PR artyhoo/getff-landing#4 merged). Chip «Dispatch beta-docs-showcase BS0» carries a hard precondition so a click on a dead account halts instead of tripping the STOP-gate falsely.
- **S4 (beta-ai-docs-agnosticism, discoverability)** — gate CLEAR (#1550 + #1552 merged); DISPATCH CHANNEL = maintainer-paste SOLO/Mode-A (not aif), branch MUST be `beta-c-s4-discoverability`; the context7 submission leg (§2 D4) is operator-only. Chip «Dispatch beta-ai-docs-agnosticism S4» pending click. Umbrella `done.md` is owed by that session after S4 merges.
- **frontier-residue-sweep S4/S5** — never dispatched (named in the plan); the umbrella will not close until done or explicitly parked.
- **Standing floors untouched:** BS3 visual acceptance · staging→main promote · `npm publish` / `bin: getff` · `@getff` scope ownership.

## 6. Owner-fork log (morning picks; none decided overnight)

1. **claims-conformance-auditor A/B/C** (§4). If B → one PR: skip entry ×2 installers + roster re-render + `SNAPSHOT_MODE=capture`.
2. **zcode-parity-rollup renderer** — a PROPOSAL renderer from S3 (#1550): its target fence `getff:begin section=zcode-parity-rollup` must be added to maintainer-owned `.claude/rules/zcode-parity-doctrine.md` and the `--check` step wired into `audit-self.yml` (see `docs/meta-factory/research-patches/2026-09-01-s3-owner-proposals.md`). Apply or decline; gate-less by design until then.
3. **`tier-home.md:82-83`** cites `night-mode/SKILL.md:15` → now `:17` (A-S3 payload, outside S2 §5).
4. **aif-version keep/remove** and **zcode §3 Option A/B** — parked in the `## Parked questions` of #1550/#1552.
5. **FC-4 kickoff-text defect** (from first-commit-passable `done.md`): «no other file in the snapshot diff» collides with the mandatory capture re-hashing `.ai-factory/refresh-baseline.json` → needs a carve-out for install-time-generated manifests, or every payload change parks falsely.
6. **`INSTALL-FOR-AI.md` at 599/600 lines** on staging — any two stages touching it collide at the wall (measured tonight); free lines (roster render or a split) before phase 1 continues.
7. **Coordination-hook trap → rule/hook note:** `link-coordination.sh` / `adopt-orchestrator-prompts.sh` adopt ANY untracked file under `.claude/orchestrator-prompts/<umbrella>/` into a symlink within ~2 min (mode 120000 commits → CI `md-line-gate.sh:68` «No such file»); once tracked on staging the stale fan-out symlink blocks merge/checkout in every other worktree. Also `.gitignore:16` hides new decisions files per umbrella (each needs its own `!` line, precedent `.gitignore:35-60`, added `:51` tonight). Worth a rule note or a hook fix.
8. **Container blind spots (operator infra):** no `shellcheck`, no prettier-on-shipped-configs in the aif image — every host-verify tonight caught what the container could not (candidate: add both to the image / worker prompt).
9. **`scripts/worktree-node-modules.sh`** links `packages/core/node_modules` → ROOT `node_modules` although the primary has a real nested dir → pre-push capability-matrix test fails in every symlink-provisioned worktree.
10. **Host rustup has no default toolchain** → byte-identical cargo cells always red locally (and `SNAPSHOT_MODE=compare` cargo/greenfield + cargo/brownfield-clippy fail on clean origin/staging on this host).
11. **`.claude/skills/aif-doctor/SKILL.md` + `helpers/refresh-aif-base.sh`** still carry the `/home/www/rules-as-tests-aif` literal (issue-1439 class, out of L3 scope).
12. **notes-lane `md5_of` residual** (exit inside `$(…)`, no `-e`) — from first-commit-passable `done.md`.
13. **dependabot #1524 / #1526 / #1216** — open; #1216 red for a real reason.
14. **9 NON-BLOCKER `[zcode-probe]` issues** — triage into a post-beta umbrella or park.
15. **Container Claude re-auth + profile flip** (the PARK-BSPRE-4 prerequisite, §5).

## 7. Bus anomalies (this report is their named consumer)

- **Orphaned review by container restart** — aif agent container restarted 21:54:52Z (restarts=1); S2 `5bb3da8a` entered `review` in that second and had no heartbeat for 70+ min. Detector: `lastHeartbeatAt == docker inspect … .State.StartedAt`. Recovered by the upstream watchdog.
- **Silent background-waiter deaths** — three cases tonight (ci-wait monitors and a peer's status monitor) died on process restarts without waking their session; a `done` task sat 35 min unharvested. The only cheap detector was a peer's `notify_when_idle` subscription.
- **Implementer runtime OAuth expiry** — «OAuth session expired and could not be refreshed» at 18:45, 19:49, 23:33Z, each paired with «implementer timed out after 3600000ms»; the 23:33 timeout is what unblocked the lane (lock TTL = 65 min). Credentials floor → operator re-auth.
- **aif coordinator head-of-line blocking (upstream defect class, two forms)** — see §2; per-project poll cycles would fix. Also observed: two coordinator pids (39, 40) logging in one container; `docker logs --since` unreliable (use `--tail N` + JSON `time`).
- **Monitor tooling traps** (recorded so the next seat does not pay them): `/tasks` list is 19.5 MB (use `GET /tasks/<full-id>`); `echo "$s" | jq` under the Monitor's `sh` mangles `\n` in JSON; `curl --max-time 5` truncates and the «changed» branch fires on empty strings.
- **Probe false-IN-FLIGHT** — `probe-inflight.sh` reports IN-FLIGHT on a slug whose only origin branches are squash-merged leftovers (all PRs merged, open=0).
- **False GREEN shapes** — CONFLICTING PR shows only Socket check-runs (no audit-self job); a superseded head keeps its green while the new head has none. Always verify `ci-success` on the explicit head SHA.

## 8. Degradation taken

- **GLM one-button on a clean machine** → replaced by the z.code cold probe on this host (operator decision 3) — proxy, labelled as such; the real criterion is still open.
- **Advisor seat did no stage work** (by role): every stage ran in its own executor session (zen-panini = P1, agitated-lumiere = F1 + container probes, elastic-hypatia = S2/S3, loving-maxwell = L1→L3, dazzling-booth = zcode verifier, serene-sutherland = kickoff-s4). No double-dispatch occurred; one peer merged on its own green read (night-mode §8c) when auto-merge did not fire.
- **No safety-net monitor is armed at report time**; all peers released.

## 9. Next (in plan order)

1. Operator: click «Dispatch beta-ai-docs-agnosticism S4» (chip `task_06d3dc51`) — everything is green for it.
2. Operator: `claude /login` in `aif-handoff-agent-1` + profile flip → click «Dispatch beta-docs-showcase BS0» (chip `task_9eba621b`) → BS1 → BS2.
3. Operator picks from §4 + §6 (A/B/C first — it is shipped to consumers today).
4. Then the phase-1 exit criteria (five points, incl. «≥10 tasks through the pipeline on ≥2 real projects») and the real clean-machine run.
