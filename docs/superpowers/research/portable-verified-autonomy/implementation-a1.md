# Portable verified autonomy A1 — implementation evidence

> **Status:** stage-A build evidence, recorded 2026-10-27 by the A1 executor session.
> **Scope:** `feature/portable-verified-autonomy-167321`, code head `0c34d88b` — durable binding and controls only.
> **Authoritative for:** what A1 actually built and what its checks actually observed (T3: command + output per finding).
> **NOT authoritative for:** feature acceptance. PA1–PA9 all remain uncredited (§6); B/C/D holds in §8; [PRD §4](../../specs/snapshots/portable-verified-autonomy/prd-ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721.md) stays the acceptance bar.
> **Companion inputs:** [agreed design](../../specs/2026-10-26-portable-verified-autonomy-design.md) · [spec agreement](../../specs/reviews/portable-verified-autonomy/spec-agreement.md) · [umbrella kickoff](../../../../.claude/orchestrator-prompts/portable-verified-autonomy/kickoff.md) · [field-notes comparison](2026-10-26/field-notes-comparison.md) · [evidence archive](2026-10-26/evidence-archive.md).

## §1 What shipped

Exactly seven files, all new, 3611 insertions (`git diff --stat origin/staging...HEAD`):

| File                                                                                                                             | LOC  | Owns                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ------ | ----- | ------ | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [.agents/procedures/pipeline/helpers/autonomy-binding.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding.mjs) | 259  | CLI entry: 8 verbs (`init                                                                                                                                                                                                                                                                                                                                                                                                | reconcile | status | pause | cancel | resume | worker | review`, [autonomy-binding.mjs:55](../../../../.agents/procedures/pipeline/helpers/autonomy-binding.mjs)), flag parsing, JSON envelope on stdout, exit 0/1/2 |
| [helpers/autonomy-binding/record.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/record.mjs)               | 492  | schema v1 validation (`validateRecord`), control state machine, monotonic revisions, `proposeResumeTransition` (fixture-only seam, [record.mjs:343](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/record.mjs))                                                                                                                                                                                        |
| [helpers/autonomy-binding/engine.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/engine.mjs)               | 661  | reconcile pipeline: live-authority recheck, observation-as-data, intent-before-effect, custody transfer, candidate forward-only, control transitions, delivery receipts ([engine.mjs:236](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/engine.mjs))                                                                                                                                                  |
| [helpers/autonomy-binding/lock.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/lock.mjs)                   | 166  | abstract-namespace bind lock: `lockNameForRecord` [:45](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/lock.mjs), Linux-only fail-closed `platformSupportsAbstractBindLock` [:53](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/lock.mjs), `acquireBindLock` with bounded retry → `lock_contended` [:84](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/lock.mjs) |
| [helpers/autonomy-binding/store.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/store.mjs)                 | 239  | durable record: symlink-safe target resolve, stage-ownership check, `'wx'`-tmp + fsync + rename atomic write with CAS-on-revision + TOCTOU retarget guard ([store.mjs:177](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/store.mjs))                                                                                                                                                                  |
| [helpers/autonomy-binding/authority.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/authority.mjs)         | 64   | current authority read by reusing the existing intent-helper validators verbatim ([authority.mjs:30](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/authority.mjs)); signature = `selectorRevision:prdSha256:specSha256`                                                                                                                                                                               |
| [helpers/autonomy-binding.test.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding.test.mjs)                   | 1730 | the §3.6 adversarial matrix, rows 1–19 + aftermath, real processes and real SIGKILL                                                                                                                                                                                                                                                                                                                                      |

No dependency was added to `package.json`; the lockfile is untouched. Node built-ins only (`node:child_process`, `node:crypto`, `node:fs`, `node:net`, `node:path`). The §2 permitted-files carve-out for an owning manifest was therefore not exercised.

## §2 How to reproduce

The plan's `host-verify` block names three commands. In this container they decompose as follows — every deviation is stated, not smoothed over (T14):

```bash
node --test .agents/procedures/pipeline/helpers/autonomy-binding.test.mjs
node scripts/check-arch-retell.mjs docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md
make self-audit
```

1. Suite: runs as written, exit 0 (§3).
2. Arch-retell: runs as written, exit 0 (`=== node scripts/check-arch-retell.mjs …` then `ARCH-RETELL-EXIT=0`).
3. `make` is not on the default PATH of this container (`command not found`, exit 127) but the toolchain binary **is** present at `/tmp/aif-toolchain-bin/make` (session-provisioned, per this handoff's provisioning recipe). With `export PATH=/tmp/aif-toolchain-bin:$PATH` the literal `make self-audit` **runs as written** and exits 2 — it stops at the pre-push arm's pre-existing skill-drift gate (§9, arm 1); nothing before that gate is red (zizmor offline scans of all 15 workflows + 8 template CI files: no findings; `audit-ai-docs` live 224/224; line-citation check `resolved 1252 / skipped 409 citation(s). (86 deferred to generator regions)` — every A1 citation resolves once committed (on the pre-commit tree the same arm had deferred this task's own lines as `not drift-checked: uncommitted`, its documented no-baseline behavior). Tail, quoted verbatim:

   ```text
   CONTRACT-MISSING: .claude/skills/aif-rules/SKILL.md (has disable-model-invocation: true, lacks the canonical line)
   FAIL: 7 file(s) with a wrong or missing invocation-channel contract.
   check-skill-drift: FAIL (2 error category/categories)
   make: *** [Makefile:24: pre-push-check] Error 1
   SELF-AUDIT-EXIT=2
   ```

   Gates after the failing one were **NOT RUN** (§9, arm 2 covers the principles lane run directly).

The suite and the probes below are re-runnable verbatim; §11 lists the exact commands. No `/tmp` artifact is load-bearing — every load-bearing number is quoted here.

## §3 Test-suite evidence (rows 1–19)

Command: `node --test .agents/procedures/pipeline/helpers/autonomy-binding.test.mjs > /tmp/a1-test-final.log 2>&1` (final committed-tree run, `0c34d88b`). Tail, quoted verbatim:

```text
# tests 71
# suites 21
# pass 71
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 17955.311544
EXIT:0
```

Per-row coverage (row names are the suite names from the same run; each row's subtests passed):

| Matrix row | Suite                                                   | Subtests                                                                                                                                                                                                                                                                                            |
| ---------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1          | row 1 — init + valid reconcile                          | binds with live-verifiable authority; unchanged authority → no mutation, route from durable state; re-init fails closed (CAS must-not-exist); strictly monotonic revisions                                                                                                                          |
| 2          | row 2 — authority change holds admission                | selector advance → `authority_changed` hold + refresh to live; open authority hold blocks new admission; hold clears on stable read, admission resumes after; `authority_unavailable` hold with named recovery action; recovery resumes on the NEXT reconcile                                       |
| 3          | row 3 — concurrent transitions across real processes    | two overlapping reconciles serialize on the bind lock, revisions advance twice; short-budget acquirer loses with `lock_contended`, writes nothing; CAS backstop → `record_revision_conflict`                                                                                                        |
| 4          | row 4 — crash windows across the durable-write boundary | prewrite SIGKILL → no partial record/intent/tmp residue; intent-persisted SIGKILL → restart classifies `uncertain_owner` with concrete recovery; commit SIGKILL → durable + idempotent re-reconcile (no duplicate observation or delivery); second DIFFERENT receipt → rejected `delivery_conflict` |
| 5          | row 5 — disconnected worker reports are data            | `timeout`/`unknown`/`error` kinds each route to a hold; custody/control/cessation untouched by a worker report                                                                                                                                                                                      |
| 6          | row 6 — duplicate report                                | same `observationId` re-reported → disposition `duplicate`, one stored entry, no revision burned                                                                                                                                                                                                    |
| 7          | row 7 — late results never clear pause/cancel           | late report under pause-pending / paused / cancelled: recorded historical, control holds, admission blocked, terminal never reopens                                                                                                                                                                 |
| 8          | row 8 — stale candidate and custody rejected            | candidate regression rejected; same-revision-different-bytes updates nothing; superseded worker late → historical-stale-custody                                                                                                                                                                     |
| 9          | row 9 — control gate                                    | unknown observation fields dropped, not ingested; action outside the fixed init grant refused; completion requires a delivery receipt; ack-cessation + custody legality (library arms)                                                                                                              |
| 11         | row 11 — kernel-held lock                               | live holder blocks short-budget acquirer, SIGKILL frees for immediate rebind; static pin: no `unlink` anywhere in the protocol                                                                                                                                                                      |
| 12         | row 12 — reserved stage-B verbs                         | `worker`/`review` → `unsupported_pending_prerequisite` naming stage B; zero record interaction                                                                                                                                                                                                      |
| 13         | row 13 — prohibited effects                             | full operational sequence with every outbound seam on a recorder; static pin: six modules import no outbound client, call no `connect`/`fetch`                                                                                                                                                      |
| 14         | row 14 — store atomicity                                | six parallel writers serialize; concurrent reader never sees partial JSON; no tmp residue                                                                                                                                                                                                           |
| 15         | row 15 — validation unit arms                           | control transitions bump record+control revisions, holds record only; illegal transitions reject with exact codes, terminals never reopen; `validateRecord` gates the read side; store arms fail closed (unreadable/invalid/retarget/CAS)                                                           |
| 16         | row 16 — adversarial recovery race                      | SIGKILLed holder, A resumes first and wins, B paused-before-bind contends against live A, no lost revision; lexical aliases contend on ONE lock; symlink-alias residual documented (distinct lock key, CAS net holds)                                                                               |
| 17         | row 17 — release/reacquire interleaving                 | three acquirers serialize, revisions monotonic, record parses each time; SIGKILL mid-critical-section → next acquirer binds immediately, record intact                                                                                                                                              |
| 18         | row 18 — fail-closed platform and bind-strategy arms    | non-Linux → `unsupported_pending_prerequisite` before any attempt; injected non-EADDRINUSE failure surfaces verbatim, single attempt; injected contention exhausts budget → `lock_contended` (retry arithmetic)                                                                                     |
| 19         | row 19 — resume authority battery                       | see §5                                                                                                                                                                                                                                                                                              |
| r4         | cold-review regression arms (r4 fixes)                  | seven labeled arms pinning the cold-review findings so they cannot silently regress — see §12                                                                                                                                                                                                       |
| r5         | cold-review regression arms (r5 fixes)                  | persist-before-reject class closure: a composed observation survives every post-ingestion rejection class (7 scenarios), and the persist write is reachable by the commit/prewrite crash seams — see §12                                                                                            |
| r6         | cold-review regression arms (r6 fixes)                  | completion carries admission's live-authority premise on both doors; the settle boundary holds for completion; the hold log is bounded and prunes only already-cleared holds — see §12                                                                                                              |
| —          | aftermath                                               | recorder closed, zero outbound connections across the whole run                                                                                                                                                                                                                                     |

Rows 10 (uncertain-owner classification) and the aftermath are folded into row 4's second subtest and the closing suite respectively, matching the plan's matrix numbering.

## §4 Lock decision — negative-existence evidence

The design's first route is an abstract-namespace unix-socket bind lock. The decision rests on one structural argument and one live probe, both reproduced here.

**Negative existence (pathname-socket alternative refuted).** A pathname socket or lock file needs an unlink-on-release step. A crashed holder leaves the pathname behind; the next acquirer must then decide whether the holder is dead — and per domain trap T-AUT-B an expired lock or stale mtime cannot prove an external worker ceased. The r1 review identified this as a takeover hazard: a `stale-time` takeover can delete a lock still held by a live-but-slow process. The shipped protocol contains **no unlink anywhere** — asserted by a static pin inside row 11 (`static pin: the protocol has no unlink anywhere (the r1 takeover hazard is structurally absent)`, passed in the run above) — because the kernel frees an abstract name at holder death with no filesystem residue at all. Acquisition is a single `bind()` syscall: atomic by construction, no lock file, no read-check-write window. Non-Linux hosts fail closed with `unsupported_pending_prerequisite` ([lock.mjs:53](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/lock.mjs)) — the hold names the prerequisite, it does not degrade to a file lock.

**Live probe, shipped module** (run 2026-10-27 in this container against [lock.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/lock.mjs); probe source and re-run command in §11). Output quoted verbatim:

```text
holder-live: bound "\u0000aif-autonomy-b10ba3934883f2fb7b2a3cbf1c1f5f1f1700670df0e583a401628fcc8ad0328e"
proc-net-unix-while-held: 0000000000000000: 00000002 00000000 00010000 0001 01 2018877 @aif-autonomy-b10ba3934883f2fb7b2a3cbf1c1f5f1f1700670df0e583a401628fcc8ad0328e
SIGKILL delivered=true holder-exit-signal=SIGKILL
rebind-immediately-after-SIGKILL: rebind-OK
bind-while-live-after-rebind: lock_contended (EADDRINUSE ⟺ live holder)
filesystem-entry-for-abstract-name: none
```

Reading line by line: the name is kernel-held and visible in `/proc/net/unix` with the leading `@` (abstract namespace, no path); SIGKILL is delivered and the kernel releases the name at process death; an immediate rebind succeeds with no cleanup step; while held, a second acquirer gets EADDRINUSE mapped to `lock_contended` (fail-closed, never a takeover); and no filesystem entry was ever created.

**Kernel primitive, raw socket** (same day, no project code — confirms the primitive itself, not just our wrapper):

```text
child bound abstract name \\0aif-sigkill-lock (pid 588124)
SIGKILL delivered
rebind-immediately-after-SIGKILL: rebind-OK
bind-while-live-after-rebind: err:EADDRINUSE
filesystem-entry-for-abstract-name: none
```

Residual, documented not hidden: a symlinked record directory yields a distinct lock key (row 16, third subtest). That residual is accepted because the CAS-on-revision write in [store.mjs:177](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/store.mjs) still rejects the concurrent write — the lock is the fast path, the CAS is the correctness net.

## §5 Resume authorization — production hold + row-19 battery

Stage A holds production `resume` unconditionally. [engine.mjs:75](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/engine.mjs) builds `unsupported_pending_prerequisite`; the CLI emits it before any record interaction, and a supplied `--grant` path is named in the hold reason but can never clear the hold (verb handling in [autonomy-binding.mjs:178-186](../../../../.agents/procedures/pipeline/helpers/autonomy-binding.mjs)). The pure transition proposer `proposeResumeTransition` ([record.mjs:343](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/record.mjs)) is fixture-only: it computes a proposal from trusted input and persists nothing; a static pin asserts no production path wires it to persistence.

Row 19 (five subtests, all passed in the §3 run) is the evidence battery:

1. `production CLI negatives: every resume shape stays held with unchanged record bytes` — `resume` with and without `--grant`, on bound and unbound records; record digest compared before/after.
2. `observation/worker-supplied grant is DATA: stored verbatim-none, no resume, no admission` — a grant arriving through a worker observation cannot self-authorize.
3. `direct production engine invocation stays held — no CLI-only check to skip` — the hold lives in the engine, not the argument parser.
4. `fixture-only pure transition: valid trusted input proposes consumption; negatives reject; nothing persists` — the future seam is exercised, and its negatives (missing scope, wrong actor, expired evidence) reject.
5. `static pin: no production path wires the fixture-only transition to persistence` — the resume hold is structural, not a flag default.

This is deliberate non-credit, not incompleteness: resume authorization is a stage-B+ business-control surface, and faking it in A1 would have manufactured PA7 evidence (see §6).

## §6 PA1–PA9 — all uncredited by A1

The PRD marks PA1–PA9 essential; the brief forbids converting a partial stage into full-feature `ResultReview.matches`. A1's green suite is evidence about the foundation, not about any promise (T-AUT-A: a successful turn is not product acceptance). Every row: **Unproved in A1 — no credit.**

| PA  | Promise (PRD §4, abridged)                             | Where it must be earned                                | A1 relationship (support only, never proof)                                                                               |
| --- | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| PA1 | Routine transitions with zero human relays             | B (worker/review routing) + later end-to-end           | row 12 proves the reserved verbs refuse to simulate routing                                                               |
| PA2 | Acceptance proves current result against agreed intent | stage review machinery + stage review of the PR itself | row 2's stale-evidence-never-current arm is the same principle, applied to authority                                      |
| PA3 | State survives supported interruptions                 | A1 slice + recovery drill on a bound record            | rows 4/16/17 exercise crash and recovery mechanics; no real-owner interruption case exists yet                            |
| PA4 | Two agent environments exchange actionable work        | B (cross-environment dispatch)                         | record schema carries worker/claim/task identity; unexercised                                                             |
| PA5 | Sourced project experience survives sessions           | C (memory continuity)                                  | out of stage-A scope entirely; preserved per [field notes F-P6](2026-10-26/field-notes-comparison.md)                     |
| PA6 | Consumers install and exercise the capability          | consumer delivery stage                                | nothing A1 ships is installed anywhere yet                                                                                |
| PA7 | Human intervention meaningful; authority effective     | B/D (control surface + escalation)                     | pause/cancel/hold semantics implemented (rows 7/9/15); resume authorization deliberately held (§5); no live operator case |
| PA8 | Default path needs no additional paid service          | whole-feature accounting                               | A1 adds zero dependencies (§1) — consistent, not accounted                                                                |
| PA9 | Independence from any single host/model                | second-host proof                                      | Linux-only fail-closed lock is the opposite of a portability claim, stated as such                                        |

## §7 Field-notes transfer map

From the brief §3 transfer obligations, onto the matrix rows that carry them ([full comparison](2026-10-26/field-notes-comparison.md)):

| Brief obligation                                                  | Field-notes anchor                                                      | A1 rows carrying the bounded case                                                                                                                                                                                           | Remaining owner                             |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| «reliable bounded path/failure cases before B routine enrollment» | F-P11 (one error/recovery case before routine adoption)                 | happy path row 1/17; failure paths rows 2 (authority), 4 (crash windows), 5 (disconnected worker), 16 (recovery race), 18 (fail-closed)                                                                                     | B: actual routine enrollment stays open     |
| «single custody/exact return identity»                            | F-P4, F-P15, F-A6, F-A36, F-A37                                         | row 8 (stale custody rejected), row 9 (custody legality + ack-cessation), row 16 (custody race, no lost revision), row 4 (idempotent delivery, `delivery_conflict` on a second DIFFERENT receipt), row 6 (duplicate report) | B: live worker custody across real sessions |
| «meaningful current evidence»                                     | F-P1, F-P2, F-P3, F-A8, F-A10, F-A19                                    | row 2 (current-authority re-read; stale evidence never admitted), row 13 (static pin: no outbound seam), row 15 (validation gates the read side)                                                                            | stage review of this very PR (PA2)          |
| Preserved, not credited                                           | F-P6 (memory), F-P13 (economics), F-P16 (quiet work), F-P17 (attention) | none — deliberately untouched in A1                                                                                                                                                                                         | C/D                                         |

F-A10 (a known missing requirement withheld despite green tests) is the operative norm for this document: §6 lists all nine promises as unproved while the suite is green.

## §8 B/C/D boundary holds

What A1 explicitly does not do, each with its hold surface:

1. **Live worker/review operations (B).** `worker`/`review` verbs return `unsupported_pending_prerequisite` naming stage B before any record interaction (row 12). No simulated routing success exists.
2. **Production resume (B+, business control).** Unconditionally held (§5). Grant scoping, authority binding of a grant document, and consumption are future stages.
3. **Routine enrollment (B).** F-P11's reliable-path-then-failure-case discipline is evidenced, not enacted; enrolling any autonomy routine needs B's own claim/review/admission.
4. **Memory continuity (C).** F-P6 supersession semantics are untouched; the record stores no memory state.
5. **Economics and attention accounting (C/D).** F-P13/F-P16/F-P17 measurements are untouched.
6. **Second host / platform independence (D).** The lock fails closed on non-Linux (row 18); no portability claim is made or implied.
7. **Live host or memory enrollment, PA6/PA9 credit.** Nothing in A1 is installed on a host or consumer repo; no live host or memory success is claimed from any check in this document.

## §9 Environment attribution — self-audit REDs are pre-existing

`make self-audit` decomposed (§2) yields two RED arms in this container. Attribution method: input-identity — `git diff --stat origin/staging...HEAD` is exactly the seven §1 files, none of which either failing arm reads, so no A1 change can have caused them (empty-diff ⇒ pre-existing by construction). Findings, not hidden (T14: coverage stated, conclusions bounded):

**Arm 1 — the pre-push arm of `make self-audit`, exit 1, stopped at the skill-drift gate.** Two error categories, all in **gitignored local installer copies** under `.claude/skills/` (`.gitignore:134: /.claude/skills/aif-*/`), from the same literal run quoted in §2 item 3:

```text
BROKEN-REF: .claude/skills/aif-skill-generator/SKILL.md → templates/
BROKEN-REF: .claude/skills/aif-docs/SKILL.md → prev.md
BROKEN-REF: .claude/skills/aif-docs/SKILL.md → <docs-to-readme-link>
BROKEN-REF: .claude/skills/aif-docs/SKILL.md → next.md
FAIL: 4 broken ref(s) found.
CONTRACT-MISSING: .claude/skills/aif-roadmap/SKILL.md (has disable-model-invocation: true, lacks the canonical line)
… (7 files: aif-roadmap, aif-ci, aif-explore, aif-evolve, aif-grounded, aif-loop, aif-rules)
check-skill-drift: FAIL (2 error category/categories)
```

Later pre-push gates were **NOT RUN** in this container (the gate aborted there) — stated, not assumed. Everything before the gate was green: zizmor offline scans of all 15 workflows and 8 template CI files (no findings), `audit-ai-docs` live 224/224, line-citation check `resolved 1252 / skipped 409` on the committed tree (every A1 citation resolves; the earlier `7 uncommitted` remainder was this task's own pre-commit lines, the gate's documented no-baseline deferral).

**Arm 2 — principles suite (`npm --prefix packages/core run test:principles`), exit 1: 9 failed / 572 passed / 1 skipped (582 tests, 57 files: 14 failed / 43 passed).** Every failure named and attributed — three by targeted re-run, the rest by input-identity (`git diff origin/staging...HEAD` is exactly the seven §1 files; none is an input to any failing test):

| Failing test                                              | Class                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Attribution evidence                                                                                                                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `37-make-target-claim-liveness`                           | this shell's env: `make` off PATH; the test's resolver `catch {}` ([37-make-target-claim-liveness.test.ts:178](../../../../packages/core/principles/37-make-target-claim-liveness.test.ts)) treats make-ENOENT identically to "no rule to make target"                                                                                                                                                                                                                                                                          | **re-run with `/tmp/aif-toolchain-bin` on PATH → 10/10 pass, exit 0**                                                                                                                                                                                                        |
| `05-manifest-ssot` (render-rules arm)                     | devDeps gap: the `render-rules.ts` subprocess dies on `ERR_MODULE_NOT_FOUND: Cannot find package 'ajv'`                                                                                                                                                                                                                                                                                                                                                                                                                         | subprocess stack quoted in the run log                                                                                                                                                                                                                                       |
| `24`, `26`, `28`, `30`, `31`, `34`, `46` (whole-file)     | same provisioning class — import-time `Cannot find package 'ajv'` (6) / `'picomatch'` (2)                                                                                                                                                                                                                                                                                                                                                                                                                                       | 8 occurrences in the captured log                                                                                                                                                                                                                                            |
| `21-agnosticism` (1 arm)                                  | one DEGRADED row: `render-rule-channels.mjs --json unavailable; used --check exit=1` — the repo-script subprocess crashed, same provisioning class                                                                                                                                                                                                                                                                                                                                                                              | quoted DEGRADED row in the log; the failing probe reads rule files, not any A1 file                                                                                                                                                                                          |
| `14-skill-drift`, `48-skill-description-budget`           | gitignored local installer copies under `.claude/skills/aif-*/` — the identical classes the pre-push gate names in arm 1                                                                                                                                                                                                                                                                                                                                                                                                        | `.gitignore:134: /.claude/skills/aif-*/`; findings target those copies                                                                                                                                                                                                       |
| `50-cold-seat-inputs-ref` (1 arm: population non-vacuous) | this worktree's `.claude/skills/**` symlink repoints: discovery walks `.claude/skills/` and `realpathSync`s each hit ([50-cold-seat-inputs-ref.test.ts:61](../../../../packages/core/principles/50-cold-seat-inputs-ref.test.ts)), but this worktree arrives with those symlinks repointed to the primary checkout (`readlink .claude/skills/orchestrator/references/reviewer-template.md` → `/home/www/rules-as-tests-aif/…`), so the realpath escapes REPO_ROOT and the two orchestrator templates fall out of the population | committed A1 diff over `.claude/` is empty (`git diff fd031522..HEAD --stat -- .claude/` → no lines); the test reads no `autonomy-binding` file (grep: zero hits) — same worktree-pollution class as the 14/48 row, distinct mechanism (`realpathSync` vs gitignored copies) |
| `39-skill-fence` (3 arms)                                 | pre-existing repo content: 3 hardcoded orch-home lines in the tracked eval fixture `scenario-1-noarg-state.md` (:64-66, landed in #2066) + an allowlist-hygiene mismatch for the same file                                                                                                                                                                                                                                                                                                                                      | **inputs proven byte-identical to origin/staging**: `git diff origin/staging...HEAD` over the test file and the fixture is empty, and neither is locally modified — identical inputs ⇒ identical RED by construction                                                         |

Bounded claim (T14): this attributes every observed failure; it does **not** claim the principles suite is green anywhere in this container. The suite is green on CI, which this container cannot fully reproduce (missing devDeps, gitignored installer copies, no `make` on PATH).

Not re-run silently: none of these arms was retried to green by masking inputs; each RED is reported with its class.

## §10 T15 self-application

The binding's own discipline, applied to the binding:

- **Authority on itself:** A1's authority is the pinned PRD/spec/kickoff triple in the intent contract; this document cites those exact snapshots, and the record format stores `selectorRevision:prdSha256:specSha256` ([authority.mjs:61](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/authority.mjs)) — the same freshness rule the executor was subject to.
- **Ownership:** the branch carries only the seven §1 files; the 248 pre-existing modified `.claude/**` repoints and all unrelated WIP were left untouched (staged by explicit path only, never `git add -A`).
- **Hold semantics on itself:** the executor's own unresolved items are parked in §8 and §11, not guessed. The production-resume hold is the binding refusing to claim authority it does not have — including over itself.
- **What auditing this audit would look like:** re-run §2's three decomposed commands on a Linux host with a full `node_modules` and compare the §3 tail and §9 arms; re-run the two §4 probes (§11); verify §6's table against the PRD rows it cites. Each step is command-exact by construction.

## §11 Evidence index and re-run commands

All load-bearing output is quoted above; these are the re-runs:

```bash
# §3 suite (71/71, EXIT:0 — includes the §12 r4–r6 regression arms)
node --test .agents/procedures/pipeline/helpers/autonomy-binding.test.mjs
# §2 arch-retell (EXIT:0)
node scripts/check-arch-retell.mjs docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md
# §2 item 3 / §9 arm 1 — literal make self-audit in this container (exits 2 at the pre-existing skill-drift gate; green before it)
export PATH=/tmp/aif-toolchain-bin:$PATH   # session-provisioned toolchain; make is not on this container's default PATH
make self-audit
# §9 arm 2 — principles lane (9 pre-existing failures, all attributed in §9)
npm --prefix packages/core run test:principles
# §9 attribution re-runs (each isolates one arm):
export PATH=/tmp/aif-toolchain-bin:$PATH; npm_config_cache=/tmp/a1-npm-cache npx vitest run packages/core/principles/37-make-target-claim-liveness.test.ts   # 10/10 pass with make on PATH
export PATH=/tmp/aif-toolchain-bin:$PATH; npm_config_cache=/tmp/a1-npm-cache npx vitest run packages/core/principles/05-manifest-ssot.test.ts               # ajv ENOENT in the render-rules subprocess
# §4 probe 2 — shipped lock module (holder bound, /proc/net/unix, SIGKILL, rebind, lock_contended, no fs entry)
# probe source: session-local /tmp/a1-lock-probe/probe.mjs (imports the shipped lock.mjs; kept out of the repo — probe code, not product)
node /tmp/a1-lock-probe/probe.mjs "$(pwd)"
# §4 probe 1 — raw abstract-namespace socket, no project code
node /tmp/aif-lock-probe/run-sigkill-probe.mjs
```

Session-local artifacts (not committed, not load-bearing): `/tmp/a1-test-run-r6.log`, `/tmp/a1-test-final.log`, `/tmp/a1-selfaudit-r6.log`, `/tmp/a1-selfaudit-final.log`. The two probe scripts live under `/tmp` by the §2 permitted-files rule; their full source is quoted in the session log, and their behavior is independently re-derivable from §4's line-by-line reading plus row 11's in-repo static pins.

**Parked for later stages (each with its owner):** production resume authorization and grant scoping (B, §5); worker/review live routing (B, §8.1); routine enrollment under F-P11 (B, §8.3); memory supersession (C, §8.4); economics/attention accounting (C/D, §8.5); second-host proof (D, §8.6); a container-independent self-audit run (maintainer host, §9).

## §12 Cold-review rounds — findings, repairs, falsifier arms

The cumulative A1 diff went through three sequential cold diff-review rounds (T19) — r4 (ten findings), then r5 and r6 auditing the repairs themselves (closing the lost-fact CLASS and the completion-door premise) — and every finding was repaired **and** pinned as a labeled regression arm in the suite, so no repair can silently regress. r4 repairs and pins:

| Finding  | Defect                                                                                                                                                                                                       | Repair                                                                                                                                                                                                                                                                                                                                                       | Pinned by                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| MAJOR 1  | re-deriving an already-open hold re-appended an identical hold instance and burned a `recordRevision` on every reconcile against an open hold                                                                | object-identity-as-no-op: `addHold` / `clearHolds` return the **input** record unchanged when nothing moved ([record.mjs:454](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/record.mjs), [:480](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/record.mjs)), so the engine writes nothing when re-deriving an open hold | arm `MAJOR 1: re-deriving an already-open uncertain_owner hold is a no-op — no revision burn, mutated false`                                                         |
| MAJOR 2  | a composed reconcile (observation + a rejected request-action) returned the rejection **without** persisting the observation it had already ingested — the fact lived only in the abandoned in-memory record | `rejectAfterPersist` ([engine.mjs:353](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/engine.mjs)): facts ingested earlier in the pass are made durable **before** the rejection returns; a persist failure outranks the rejection                                                                                                         | arm `MAJOR 2: a composed observation + rejected request-action persists the ingested fact` (revision = init + control + fact, monotonic per durable write)           |
| MAJOR 3  | symlink-alias: two spellings of the same record directory take two independent locks; a concurrent alias race could pass CAS on both sides (stale-read window)                                               | **documented, not repaired** — accepted on the single-canonical-spelling operator contract; an inode-realpath lock key is the named B-side alternative                                                                                                                                                                                                       | row 16's `symlink-alias residual (documented)` test pins the distinct lock keys and monotonic revisions across sequential spellings                                  |
| MAJOR 4  | `--request-action` could be answered against a record whose authority could not be re-read, and custody transfer onto a terminal record was not rejected                                                     | request-action resolves the feature home and fails closed with a durable `authority_unavailable` hold (`authority_hold_open`, no intent persisted); terminal custody-transfer is rejected                                                                                                                                                                    | arm `MAJOR 4: request-action without --repo-root (or against an unreadable authority) fails closed` + `MINOR 5: custody transfer onto a terminal record is rejected` |
| MINOR 5  | custody transfer onto a terminal record                                                                                                                                                                      | rejected (folded into the MAJOR 4 repair)                                                                                                                                                                                                                                                                                                                    | arm above                                                                                                                                                            |
| MINOR 6  | `status()` route derivation omitted the authority-hold branches `reconcile`'s routing has — status said `observe` where a reconcile would route `hold`, violating the two-doors-agree invariant              | the two authority-hold branches added to `status()`'s route derivation, so both doors answer «what would happen next» identically from durable state                                                                                                                                                                                                         | arm `MINOR 6: status route mirrors reconcile route for an active task-bound record`                                                                                  |
| MINOR 7  | dead condition `                                                                                                                                                                                             |                                                                                                                                                                                                                                                                                                                                                              | !stageTarget`beside`!existsSync(stageTarget)` in the store's stage-ownership gate                                                                                    | tautology removed ([store.mjs](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/store.mjs)) | row 15's store arms cover the gate's real branches |
| MINOR 8  | this doc's §5 originally described row-19 battery items that did not match the actual five subtests                                                                                                          | §5 rewritten to the actual subtest names                                                                                                                                                                                                                                                                                                                     | §5 vs the suite's own subtest list                                                                                                                                   |
| MINOR 9  | a non-ISO `--now` surfaced late as `record_invalid` mid-pipeline, after partial work                                                                                                                         | `isIso(now)` rejected up front in the engine entry, before any record read                                                                                                                                                                                                                                                                                   | arm `MINOR 9: a non-ISO --now is rejected up front, not late as record_invalid`                                                                                      |
| MINOR 10 | the library control door accepted `complete` without a delivery receipt where the CLI's `--mark-complete` path required one                                                                                  | same receipt requirement applied to the library door                                                                                                                                                                                                                                                                                                         | arm `MINOR 10: the library control door requires a delivery receipt for complete, same as markComplete (library arm)`                                                |

**Completion repairs (the r4 edit round).** The r4 edit round had left the tree in a broken intermediate state that the suite caught immediately:

1. The MAJOR 1 edit had deleted `addHold`'s `const next = structuredClone(record)` declaration while leaving the mutation path reading `next` — 11 subtests failed with `internal_error` envelopes. Declaration restored; the MAJOR 1 arm now passes for the _repair's_ reason (no-op return), not by accident.
2. The new MAJOR 4 arm exposed a **real engine defect** the review had missed: the MINOR 6 route-mirror gap above (status vs reconcile disagree on an open authority hold). Fixed in `status()`; suite 62/62.
3. Stale `path:line` citations in the shipped header and this doc (7 in the header, 3 here) renumbered via `node scripts/check-line-citations.mjs --write` plus manual fixes — the pre-push citation arm resolves every committed citation (the earlier `7 not drift-checked` remainder in §2 item 3 was this task's own pre-commit lines; the committed-tree run shows `resolved 1252` with no remainder).

Suite after the r4 repairs: **62/62, exit 0**. After the r5 and r6 repairs: **71/71, exit 0** (§3).

### r5 — class closure (round 2)

**Finding.** r4 had converted only the admission-gate rejection sites to persist-before-reject. The same lost-fact window existed at EVERY other rejection site downstream of observation ingestion (engine steps 4–10: input gates, intent validation, delivery conflict, custody refusal, candidate regression, completion receipt precondition) — a composed pass whose sibling input was refused still dropped the observation it had already classified. Additionally, nothing proved the persist-before-reject write was reachable by the crash-window seams like any other durable write.

**Repair.** Every rejection site below step (3) routes through `rejectAfterPersist` ([engine.mjs:353](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/engine.mjs)); the crash seams (`--test-crash-after prewrite|commit`) fire on it identically.

**Pinned by** the r5 suite block: a 7-scenario battery (one per rejection-site class — the sibling is refused with its exact code while the observation is durable, and a follow-up reconcile proves idempotent duplicate classification with no revision burn) + two crash arms (commit-seam SIGKILL survives the fact; prewrite-seam SIGKILL leaves the record byte-identical with no tmp residue).

### r6 — completion authority premise + bounded holds (round 3)

**Findings.** (1) The completion doors — CLI `--mark-complete` and the library `control.kind === 'complete'` — could close the binding against the init-time authority snapshot, with no repo-root/feature-home requirement and no open-or-same-pass-touched authority hold blocking them: admission's live-authority premise had no completion counterpart. (2) The ack-cessation failure path returned the refusal without persisting earlier facts (defense-in-depth — unreachable by the pause-pending/cancel-pending precondition, but the same class). (3) Authority flapping appended an open+cleared hold pair per flap forever — an unbounded log.

**Repairs.** A shared `completionGate()` on both doors: completion requires `--repo-root` and a resolvable feature home, and an open OR same-pass-touched authority hold blocks it exactly as admission is blocked (one pass cannot move the hold and close on it — the settle boundary); `pause`/`cancel`/`ack-cessation` are deliberately NOT gated, so stopping work stays possible when the authority source itself is unreadable. The ack-cessation refusal path routes through `rejectAfterPersist`. The hold log is capped at `HOLDS_MAX = 200`, pruning only already-CLEARED holds oldest-first — an open hold is a live gate and is never silently discarded ([record.mjs:55-60](../../../../.agents/procedures/pipeline/helpers/autonomy-binding/record.mjs)).

**Pinned by** the r6 suite block: open-hold-blocks-completion; settle-boundary-for-completion (the clearing pass cannot also complete); completion without a live-authority source fails closed naming `--repo-root` on both doors; the 210-flap battery (log capped at exactly 200, all retained holds cleared, oldest-first ordering); and the unit arm proving an OPEN hold survives the prune while the OLDEST cleared hold is what was dropped.
