# KICKOFF — consumer-layout-probe-honesty (L1 → L2 → L3)

> **Type:** remediation umbrella (I-phase; three independent stages, one mis-behaving
> shipped artifact each). Authored 2026-08-19 from the open-issue sweep (worktree
> `issue-sweep-2026-08-19`), operator-approved route («go», 2026-08-19).
> **Origin:** the «correct at home, blind or lying in a consumer layout» cluster, all
> measured live on consumer `artyhoo/timeliner`:
> <https://github.com/artyhoo/getff/issues/1459> (mutation runner mis-resolves REPO_ROOT
> under a hook in a git worktree → pre-push arm always SKIPs),
> <https://github.com/artyhoo/getff/issues/1414> (dispatcher hardcodes
> `.claude/orchestrator-prompts` in three shipped sites; live confirmation 2026-08-17 in
> its comment thread), <https://github.com/artyhoo/getff/issues/1439> (probe signal 4 asks
> the wrong repository in a consumer and reports `status=ok`).
> **Base branch:** staging. Per [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md),
> do NOT dispatch until this kickoff is merged to staging.
> **Rigor label (effort-worthiness L0):** `research-grade` — every stage edits a
> consumer-shipped surface (`packages/core/synthesizer/run-generated-rule-mutation.sh`
> delivered at [install.sh:943](../../../install.sh); `.claude/skills/dispatcher/**` shipped
> by `setup.d/10-skills.sh`).
> **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** in-repo REUSE — the orch-home resolver
> precedent `print-orch-home.sh` / `resolve_orch_home()` landed by PR 1411
> ([.claude/skills/pipeline/helpers/](../../skills/pipeline/helpers/)); the
> consumer-layout regression-arms precedent `tests/install-sh/consumer-pipeline.test.sh`
> arms 4-7 (same PR); the `env -u GIT_DIR` root-resolution shape (issue 1459's own
> measured repro). No new module or dependency is proposed; a stage that proposes one owes
> a fresh 6-item consult.
>
> **Citation form is load-bearing** — issue/PR references are written as full URLs or bare
> `issue NNN` / `PR NNN`, never `#NNN` hash-tokens (dup-detect signal 1; see the
> [pre-merge-carrier-build header](../pre-merge-carrier-build/kickoff.md) for the measured
> incident).

## §0 Read first, in order

1. This kickoff — §1 decisions and §3 constraints are binding, not advisory.
2. The three origin issues (URLs above), INCLUDING issue 1414's 2026-08-17 live-measurement
   comment (the `done-md no` verdict on a real closed consumer umbrella, and its
   DONE-UNHARVESTED-precedence caveat that shapes L2's regression arm) and issue 1439's
   two-layer analysis (the layer-2 ownership bind that shapes LH-4).
3. [packages/core/synthesizer/run-generated-rule-mutation.sh](../../../packages/core/synthesizer/run-generated-rule-mutation.sh)
   lines 39-40 (the `REPO_ROOT` resolution) + the `D-S5-mutation-root` comment above it
   (the history: a fixed `../../..` path was replaced by `git rev-parse` for the layout
   axis and re-broke the worktree axis — do not re-pay this).
4. [packages/core/principles/39-skill-fence-orch-home.test.ts](../../../packages/core/principles/39-skill-fence-orch-home.test.ts)
   — the `KNOWN_GAPS` entry L2 deletes (arm (e) enforces the deletion in the same PR).
5. [pre-merge-carrier-build/kickoff.md](../pre-merge-carrier-build/kickoff.md) §3 W-2 —
   the in-flight sibling whose surfaces this umbrella must not touch.

## §1 Decisions (authored 2026-08-19 with rationale; operator-overridable at PR review — an executor that re-opens one has left scope: park as `DECISION-NEEDED` only if the answer is *impossible* to implement as stated, with the impossibility measured)

| Fork | Answer | Rationale + consequence |
| --- | --- | --- |
| LH-1 issue 1459 fix shape: (a) `env -u GIT_DIR -u GIT_WORK_TREE` on the root query, or (b) caller passes the root? | **(a)** | One line, keeps the script standalone-runnable (direct invocation is a real channel — the framework repo itself runs it from `audit-self`), and avoids touching `packages/core/hooks/pre-push.ts` (the consumer arm at its line ~1041 converts exit 2 to a loud SKIP — that conversion stays; only the exit-2 cause is fixed). (b) couples the script to one caller and widens the diff onto a hook PMCB-adjacent surface. |
| LH-2 issue 1414 site 1 (probe-inflight) resolver: inline fork vs shared helper extraction? | **Inline fork (the issue's option 1)** | Cross-skill helper dependencies break when the sibling skill is absent — `pipeline` ships on `env+`, `dispatcher` on `factory` (different install gates; the issue measured this). A third 4-line `[ -d .claude/orchestrator-prompts ] / else .ai-factory` copy is accepted DELIBERATELY; the shared extraction (option 2) is a separate refactor with its own design decision about where shared skill-helper code lives — not smuggled into a defect fix. |
| LH-3 issue 1414 SKILL.md fences: resolver or escape token, per fence? | **Per-fence, measured** | Site 3 (§2.8 closure-marker `cp .claude/orchestrator-prompts/...`) is a READ of a path that must resolve in a consumer → resolve it (the fork from LH-2's pattern). Site 2 (§2.1 `tsx packages/runtime-bridge/src/cli/dispatch.ts .claude/orchestrator-prompts/...`) names a framework-only tree by construction → candidate for the principle-39 `# orch-home: allow <reason ≥20 chars>` escape, per the issue's own note. The executor verifies per-fence which case holds (grep the fence's reachable-in-consumer status) and records the verdict in the PR; the KNOWN_GAPS entry is deleted either way (arm (e) forces it). |
| LH-4 issue 1439 layering: fix the default alone? | **Never — both layers land in ONE stage or not at all** | Layer 1 alone (derive `AIF_REPO_PATH` correctly) makes every consumer dispatch report `PROBE-INCOMPLETE`, which by design outranks everything and stops dispatch — the honest fix bricks the loop (issue 1439's own blast-radius note). Layer 2 (surface the ownership failure as a NAMED cause — `dubious ownership` / uid mismatch text from git — instead of a flat PROBE-INCOMPLETE) must merge in the same change. |

## §1b Autonomous aif dispatch — park-don't-guess contract

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to
> `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
> consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the
> unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists
> to prevent.

## §2 Stages

| Stage | Deliverable | Depends on | Volume |
| --- | --- | --- | --- |
| L1 | **Worktree-safe root resolution** (issue 1459): `packages/core/synthesizer/run-generated-rule-mutation.sh:39` becomes `REPO_ROOT="$(cd "$SCRIPT_DIR" && env -u GIT_DIR -u GIT_WORK_TREE git rev-parse --show-toplevel 2>/dev/null || true)"` (LH-1; the existing fallback line 40 stays). Regression home `packages/core/synthesizer/run-generated-rule-mutation.test.sh` (new): reproduces the issue's clean-room table — a real `git push` from a linked worktree against a local bare remote, with a pre-push hook invoking the script the way `pre-push.ts` does, asserting the runner resolves `<worktree>` (not `<worktree>/scripts`) and exits non-2; plus a plain-clone arm (behaviour unchanged) and a direct-invocation arm (`GIT_DIR` unset). Principle-41 wiring for the new `*.test.sh` home (CI step + `meta-all-wired` literal line + `run-local-ci-sweep.sh` `gate_table()` reachability). | — | S |
| L2 | **Dispatcher orch-home honesty** (issue 1414): (1) `probe-inflight.sh` Signal-3 site (the done.md closure-marker check, line ~84) resolves the orch home inline (LH-2's 4-line fork) — `.claude/orchestrator-prompts/<slug>/done.md` when that dir exists, else `.ai-factory/orchestrator-prompts/<slug>/done.md`; (2) the two `SKILL.md` fences per LH-3 (resolve site 3; escape-token site 2 if measured framework-only); (3) DELETE the `.claude/skills/dispatcher/SKILL.md` entry from `KNOWN_GAPS` in `packages/core/principles/39-skill-fence-orch-home.test.ts` (same PR — arm (e) goes red otherwise); (4) consumer-layout regression arms in `packages/core/skills/dispatcher/probe-inflight.test.ts`: a closed umbrella under a `.ai-factory/` layout asserts `SIGNAL done-md yes` **in a case with NO unharvested task** (the 2026-08-17 comment's trap: `DONE-UNHARVESTED` outranks the signal, so a signal-only arm passes while the operator-visible symptom persists), plus a `.claude/`-layout arm (framework behaviour unchanged). Principle 39 stays green across the deletion. | — | M |
| L3 | **Probe signal 4 asks the right repository** (issue 1439, both layers per LH-4): (1) derive the container repo path from the task record the probe already fetches for signal 5 — `/tasks` → `worktreePath` prefix as the project checkout — replacing the hardcoded `/home/www/rules-as-tests-aif` default at `probe-inflight.sh:44`; explicit `AIF_REPO_PATH` still overrides; a consumer where NO path is derivable reports `status=unavailable` with the reason, never `status=ok` from a different project; (2) the `docker exec … git branch` failure path surfaces its CAUSE (the git stderr, e.g. `detected dubious ownership`) inside the signal line / probe output — `PROBE-INCOMPLETE` carries the why. Verify the `worktreePath` field name against the LIVE aif API at execution time (probe + date per [destination-environment-verification.md §1b](../../rules/destination-environment-verification.md) — a doc citation is not a probe). Arms in `packages/core/skills/dispatcher/probe-inflight.test.ts`: (a) derivable-path consumer → signal 4 inspects that path; (b) git-call failure → `status=unavailable` + named cause + `VERDICT: PROBE-INCOMPLETE`; (c) repo exists, no matching branch (asked-and-got-nothing) → `status=ok` with `0` is CORRECT and stays; (d) framework-layout control — explicit `AIF_REPO_PATH=/home/www/rules-as-tests-aif` where that IS the project behaves exactly as today. | — | M |

## §3 Binding constraints (do not re-derive)

- **Framework-repo behaviour unchanged** — all three issues' acceptance lines. Every arm
  that asserts the new consumer behaviour is paired with an arm asserting the framework
  layout's output is unchanged (`.claude/orchestrator-prompts` at home; unset-`GIT_DIR`
  plain clone; `/home/www/rules-as-tests-aif` still correct when that IS the project).
- **PMCB B2 surfaces off-limits** (W-2 honour, same as the sibling umbrella
  [consumer-refresh-integrity](../consumer-refresh-integrity/kickoff.md)): no edits to
  `packages/core/audit-self/**`, `setup.d/40-configs.sh` carrier lines, or the npm-lane
  doc claims. LH-1 keeps `pre-push.ts` untouched for the same reason.
- **probe-inflight.sh IS the shipped artifact** (skills delivery, `setup.d/10-skills.sh`);
  there is no separate SSOT/twin to keep byte-identical — but the runner
  `packages/core/synthesizer/run-generated-rule-mutation.sh` IS delivered to consumers at
  [install.sh:943](../../../install.sh): the fix lands in the `packages/` source, and the
  executor verifies no other byte-identical copies exist (`grep -rl` the resolver line)
  before editing — the deps-hash 3-way-guard class. The delivered-file BYTES change, so
  the install snapshot fingerprint changes: regen required in the same PR
  (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, diff reviewed) and §5
  carries the `compare` line against the regenned baseline.
- **New `*.test.sh` home owes its wiring** (principle 41: every tracked `*.test.sh`
  CI-invoked, empty allowlist; `meta-all-wired` literal `run:` line;
  `run-local-ci-sweep.sh` `gate_table()` reachability).
- **The aif API is operator-machine state** — the `worktreePath` probe is re-run at
  dispatch time; a stale field-name claim from this kickoff is provisional until then
  (§1b discipline; issue 1439's falsifier names exactly this).
- **Portability:** bash 3.2-compatible, shellcheck-clean, no GNU-only flags; English-only
  machinery ([language-discipline.md](../../rules/language-discipline.md)); no paid LLM
  ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active: **T2** (a fix verified only by direct invocation is not verified — the issue's own
history says BOTH prior root-resolution fixes passed direct invocation and survived
review), **T3** (every acceptance claim carries command output or file:line), **T8**
(LH-1..LH-4 are answered in §1 — do not re-ask), **T14** (missing arms = «coverage
insufficient»; the paired framework-layout arms are part of the floor, not optional),
**T19** (own cold review of the diff before handoff), **T21** (cold-seat backward sweep
handed the change's class, never the diff).

Domain-specific:

- **T-CLP-A — direct-invocation verification.** `GIT_DIR` is never set on direct
  invocation, so it cannot witness the L1 defect. The regression MUST go through a real
  `git push` from a linked worktree (the issue's repro is the fixture).
- **T-CLP-B — signal-only regression arm.** An arm asserting `SIGNAL done-md yes` under a
  closed `.ai-factory/` umbrella WITH unharvested tasks still passes while the
  operator-visible symptom persists (`DONE-UNHARVESTED` outranks). The no-unharvested-task
  case is load-bearing (issue 1414's 2026-08-17 comment).
- **T-CLP-C — honest-fix brick.** Landing L3 layer 1 without layer 2 turns every consumer
  dispatch into a stop (PROBE-INCOMPLETE outranks all). LH-4 is a stage gate, not advice.
- **T-CLP-D — API shape from memory.** The `worktreePath` field name cited in issue 1439
  is verified against the live API before the code depends on it — probe + date; a
  memory- or doc-based field claim is `#destination-limit-by-inference`.

## §5 Host acceptance

```bash host-verify
# — append-only per stage: L2/L3 add their commands BELOW the L1 block, never edit it —
bash packages/core/synthesizer/run-generated-rule-mutation.test.sh
bash tests/install-sh/meta-all-wired.test.sh
npx vitest run --root packages/core principles/41-shell-test-ci-coverage.test.ts
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

(L1 contract; L2 appends
`npx vitest run --root packages/core principles/39-skill-fence-orch-home.test.ts` and
`npx vitest run --root packages/core skills/dispatcher/probe-inflight.test.ts`; L3 appends
its probe-inflight arms to the same vitest line. Run against a COMMITTED tree — principle
41's population is `git ls-files`, so an untracked new test file passes vacuously. A host
run of this block is the acceptance authority; a green container run is not evidence
([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).)

## §6 Stage gates

- One stage = one executor session. Before EVERY dispatch:
  `SLUG=consumer-layout-probe-honesty bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
  — and re-probe immediately before the actual dispatch. (The probe itself is one of this
  umbrella's artifacts — in the FRAMEWORK repo it is correct today; that is the only
  layout where this gate runs.)
- Phase -1 cold review of each stage's dispatch prompt is mandatory (meta-launch record §7
  precedent; this kickoff's own authoring PR ran its cold review before merge — see its
  `## Phase -1` section).
- Stages are independent (no `Depends on` edges); dispatch order is free, but L2 and L3
  both extend `probe-inflight.test.ts` — if dispatched in parallel, merge forward per
  [git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md).
- When the last stage merges, the merging session writes `done.md`
  ([operational-conventions.md §1](../../../docs/meta-factory/operational-conventions.md)).

## §7 See also

- Origin issues: 1459, 1414 (+2026-08-17 comment), 1439 (URLs in the header).
- [consumer-refresh-integrity/kickoff.md](../consumer-refresh-integrity/kickoff.md) — the
  sibling umbrella from the same sweep (W-2 shared constraint).
- PR 1411 / `tests/install-sh/consumer-pipeline.test.sh` arms 4-7 — the consumer-layout
  regression precedent L2's arms mirror.
- [destination-environment-verification.md §1b](../../rules/destination-environment-verification.md)
  — the probe+date discipline for L3's API-field verification.
