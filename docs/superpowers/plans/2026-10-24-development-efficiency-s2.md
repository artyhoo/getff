# Development efficiency S2 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans in the separate visible S2 execution session. No second execution owner is admitted. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make selected snapshot execution and the bound test/launch families report their actual scope and outcomes.

**Architecture:** Extend the existing snapshot functions and fixture constructors. Preserve the existing suite, ownership records and launch routes; do not introduce a launcher, scheduler, evidence platform or fingerprint representation.

**Tech Stack:** Bash 3.2, Node.js/TypeScript, Vitest, existing Python host wrappers.

**Spec:** `docs/superpowers/specs/2026-10-22-development-efficiency-design.md` §7; `.claude/orchestrator-prompts/development-efficiency/kickoff-s2.md`; parent kickoff §§0–6.

## Global constraints

- Approved brief SHA256 `e1d88b90d4996999c058aab6a52df6d28ed707c56d2bdc5c835dbe6d56c8100e`; agreed spec SHA256 `22efd36f9a3d08e8f087d4bf7678444f58dbfbf80fcc15212642148c6940487a`; original matches `ab51569fc129f2bcc37f8c05af8f8d58e125cb7430692101d7ab4f42a652f67b`.
- Base `817dc1d0763e0e33736f4447f37d9b56a722a0ff`, staging; managed isolated S2 checkout. Preserve primary/foreign WIP.
- Default snapshot population remains 8 npm + 3 Python + 2 Cargo + 2 Go cells. Preserve independent expected paths, link identity, bytes and behavior. No fingerprint schema/exclusion changes.
- No new charged launch, concurrency, global settings/security change, historical task replay, main merge or npm publication. Existing deny rules and task counters remain binding.
- No AIF claim asserted: selected visible Mode A is exclusive with autonomous AIF dispatch. Admission review GO covers planning; family bindings precede implementation.
- S2 cannot be reported complete while a required host family or native acceptance is pending. S3–S5 and D1–D3 remain unlaunched. General CI impact selection is outside this plan.

## Execution custody transfer

The operator requires a fresh visible session for each task/stage. Old owner `01a167eb-39b1-7b23-8325-d9ce74613d89` explicitly relinquished S2 custody in the canonical stage journal on 2026-10-24; native observation confirms its turn completed and the chat is idle. The preserved clean candidate is `689a277388a9710e1dfb7f52623f319ca28624fa`, branch `codex/development-efficiency-s2`. Its reviewed patch is `c060fb803abbbee79903c2a58d529d66fa3d46710fcd1337d9fb604a8c2ef0e2`.

Sole successor owner: `01a16e20-69c2-7320-b3d9-949e8beb9ece`. Native managed checkout: `/Users/art/.codex/worktrees/development-efficiency-s2-continuation/rules-as-tests-aif`; branch mapping: `codex/development-efficiency-s2-continuation`, based directly on the preserved candidate. The successor preserved the old checkout at transfer. It later disappeared during verification; its deletion initiator is unknown. The retained branch/commit and external evidence remain available, and the ledger was copied before disappearance. Do not assert preservation of missing ignored data. Task1 code and applicable CODEv3/frozen-source 15/15 evidence are retained; the operational wording change does not assert completion of Tasks2/3 or reset any allowance. Canonical coordination continues in the original stage journal, not a second journal.

The first successor installer battery is rejected: dependency links into the old checkout became dangling during execution, causing an actual `tsx` exit127. Raw outputs and receipts are retained; only the verified owned invalid test processes were stopped. Provision the successor's dependencies privately from its unchanged lockfiles before final verification; do not repair the foreign checkout or count unavailable-tool skips as acceptance.

## Review focus

1. Bash disables errexit inside conditionally called functions: explicit failure propagation must prevent equal trees from hiding failed installs.
2. Invalid or empty selection must fail before fixture creation; repeats cannot cause duplicate installs.
3. Sourcing definitions from another cwd must preserve the caller's options, PATH, traps and filesystem.
4. Failed capture must preserve the previous baseline; compare must not write expected inputs. Diff/read errors must fail.
5. A missing child receipt must preserve intent/counters and uncertainty; exit zero cannot override a semantic error.

## Source and owner bindings

| Family | Actual source and consumers | Permitted changes / destination | Retired path and rollback | Admission |
|---|---|---|---|---|
| Snapshot selection/outcomes | `tests/install-sh/snapshot.sh`; direct callers `byte-identical.test.sh`, `scripts/merge-forward-round.sh`, host/pre-push commands; definition-extracting consumer `snapshot-exclusion-guard.test.sh` | Existing functions plus `snapshot-runner.test.sh`; register new test in existing `audit-self.yml` installer shard. Correct ignored compare exits and loose result parsing in the existing merge-forward caller; extend its already-registered test. No installed product payload is changed. | Replace extraction only in the migrated repository test with sourcing; retire ignored exits/loose summary acceptance in the actual caller. Revert runner and its callers together. No baseline rewrite expected. | Existing S2 source owner; independent of host custody. |
| Fixture scenarios | `packages/core/hooks/end-of-turn-reminder.test.ts` (`runHook`, D13 `buildCase`, plugin/hands paths); `precompact-residue.test.ts` (`run`/stop paths); existing `vitest.host-env.ts` scrub and `env-hermeticity.test.ts` | Bind case defaults/explicit absence before per-case overrides; retain intentional HOME/TMPDIR/PATH/OS inputs. Existing hooks aggregates and canonical package scripts stay authoritative. | Remove inherited control ambiguity, not the global hermeticity gate; revert callers together. | Open #2116 changes both files and signatures. Reconcile exact candidate and current source custody before edits; no blind parallel repair. |
| Real Yarn/Astro/consumer/Windows outcomes | I1 §13 and `ONEBUTTON-DELAY-CAUSAL-NOTES.md` A; open #2119/#2067 and #2116/#2025 have existing source/delivery owners | Only exact admitted integrated source and its actual toolchain commands after owner binding. A routing stub remains a routing test. | Replace weak claims with real controls; preserve consumer inputs and native skip accounting. | Pending exact integrated source/ownership. Do not certify an unmerged external candidate from staging tests. |
| Helper migration | All callers of modified snapshot functions, direct script entry points above; external `capture-cell.py`/`stage_support.py`/`single-cell-body.sh` in retained Clarify task | Repository caller migration belongs to this session. Historical external wrappers remain with Integration Root `01a12f25-6bc9-7673-8e85-beed656d5c3c` until fresh custody and current target are bound. | Retire embedded full script/definition slicing only where migrated; keep old historical evidence immutable. | Repository admitted; external activation pending. |
| Session identity / preparation effects | Onebutton owner `01a12f27-d524-77d1-bef0-403a1e185dfb`: retained `call-1/RUN-STATE.json`, `f25-repair/CORRECTED-LINE-HANDLER.js`, verifier and exact correction pin | Need current active launcher/controller and capable phase boundary, not another historical callback copy. | Stable UUID/model/mode separate from cwd. Preserve existing security pins; rollback source while keeping attempt history. | Historical source available, current writable launcher/custody unbound. Park dependent edits. |
| Pre-spawn / semantic / crash accounting | Clarify existing `retained4fd-d0-single-cell-capture-local-closure-deferred-20261021/run_same_owner.py` creates child before `LAUNCH-RECEIPT.json`; existing owner record path is declared there | Repair current actual run record/runner only after owner binding. No new service or charged probe. | Persist intent before spawn, reconcile known child/result, retain early stderr and uncertainty. Never reset counters or replay a queue. | Current live target/ownership pending; historical receipt is not a write grant. |

The referenced host roots and exact evidence paths are retained in the existing canonical umbrella journal. These pending rows are prerequisites, not exemptions or completed work. The same existing owner must supply its actual current target/custody through an authorized route; no unsolicited cross-chat message is sent.

### Current owner answers, 2026-10-24

The human authorized exactly two current-binding requests; both native replies were consumed. They establish facts, with no source/launch/retry/custody grant. Immutable receipt locators and verified hashes are in the existing stage journal.

- Onebutton27's owner record SHA256 `cb9bb0cc6d94e92a98ab960b414be846aed61e817160de6edccce0d4ba019c42`: no complete currently runnable controller or preparation-only boundary across all Write/Edit/Bash effects is bound. The corrected event handler's 12 local cases do not prove installed consumption. Owner27 must bind the actual capable controller; Dot24 must explicitly release serial c9 custody and the receiver acknowledge before model execution. Original draft is REVISE, with at least 3/3 generations consumed; new f25 caps are separate retained grants, not renewed here.
- Integration25's owner record SHA256 `11e15b915495a540a3cb72036f74dbd0419c40a124d0e7e9431d934dc1c775ec`; its `CURRENT-BINDINGS.json` SHA256 `395b4fe49a6885390c35b931909e443e58b87868355ecdc9f835687441b76412`: actual Clarify `run_same_owner.py`/`stage_support.py`/`capture-cell.py`/frozen `single-cell-body.sh` remain with Integration25. The frozen body is not migrated; model spawn still precedes durable child receipt. Reserved 1/1 attempt consumption after queue remains UNKNOWN, not zero. No queue replay or external file change is admitted by the answer.
- Windows #2116 remains at `8e61294d97e67111e14807fc90b2edacffaf80af`. Its existing 33-file uncommitted candidate includes the unchanged reviewed fixture bytes and W-R1/W-R2 rework READY, awaiting original Root's changed-delta acceptance. Source writer remains existing GLM `bb23a3cf-fbab-4d4a-9b92-0531d9260097`, direction owner Windows24. No S2 source reservation/publication grant or native acceptance follows. Existing route is Root acceptance → exact publication GO/reservation → normal existing PR delivery → real Windows/current-CI gates → guarded staging/sole consumer41. Preserve two CI probes per class and AIF review cap4.
- Real Yarn/Astro acceptance still requires Onebutton27's actual integrated source/fixture/commands/toolchain and current c9 custody. Real consumer delivery stays with native41, with applicable package/dependency/SDK closure and preservation controls. Darwin/local routing or snapshot evidence cannot replace these outcomes.

Dependent host/external effects remain parked with these existing owners and return conditions. Continue the admitted repository source/check slice; do not invent a launcher, take over those branches or treat unanswered scope as an exemption.

## Task 1: Importable snapshot dispatch and truthful outcomes

**Files:** modify `tests/install-sh/snapshot.sh`, `tests/install-sh/snapshot-exclusion-guard.test.sh`, `.github/workflows/audit-self.yml`, `scripts/merge-forward-round.sh`, `scripts/merge-forward-round.test.sh`; create `tests/install-sh/snapshot-runner.test.sh`.

**Retained implementation:** the snapshot runner/exclusion/wiring steps below were completed at `689a277388a`, with exact CODEv3 GO and frozen-source real 15/15 evidence. Their checkboxes reference that retained work, not newly performed tests. Final integrated stage and host obligations remain open.

**Interfaces:** preserve `compute_fingerprint(dir)`, `install_into_fixture(fixture, stack, mode)`, `run_one_capture(stack, mode)`, `run_one_compare(stack, mode)`. Add `snapshot_main [--root DIR] [--cell STACK/MODE]...`; script execution calls it; sourcing binds private source-location metadata and defines the API without dispatch or caller-control changes. No `--cell` means full15. Empty/unknown/repeated cells fail before installs. `--root` defaults to the source's repository root, resolved using `BASH_SOURCE`, and validates the actual installer. `SNAPSHOT_MODE` accepts only capture/compare; existing `BASELINE_DIR` input remains supported.

- [x] Write actual-dispatch tests: source from foreign cwd without side effects; select one valid cell and observe one child; default observes the independent exact15 list; empty/unknown/repeated selector observes zero children; nonexistent root/mode/prerequisite fails before installation.
- [x] Write outcome controls: installer writes matching payload then exits42 => compare and capture fail; old baseline survives failed capture; missing baseline/diff command failure fails; failed cell makes the actual aggregate red; restore valid child and get green. Inject hash/readlink failures through actual capture/compare, including conditional invocation: both must return nonzero, fail the aggregate and preserve the previous capture baseline. Fixture installers prove runner contracts only, not product/toolchain acceptance.
- [x] Run `bash tests/install-sh/snapshot-runner.test.sh`; retain expected RED against the unchanged runner, without invoking the old full installer matrix accidentally.
- [x] Move environment preparation into the actual execution path. Run each cell in an isolated subshell with reliable cleanup, preserved installer stdout/stderr on failure and explicit return-code checks. Publish capture only after successful installation and fingerprint completion; do not overwrite compare inputs. Preserve fingerprint format, membership and exclusions; explicitly propagate find/sort/hash/readlink failures inside generation, because conditional callers can disable Bash errexit.
- [x] Bind fixture Git operations to their declared root: dirty `GIT_DIR` parent must agree with clean execution and preserve the unrelated parent's configuration. Use Git's existing `--local-env-vars` classification inside the execution subshell, preserving global/OS inputs. A disposable foreign-repository control reproduced configuration mutation with exit0 before this correction.
- [x] Replace `sed`/`eval` extraction in the repository exclusion guard with direct sourcing. Its real Python installation must propagate failure. Keep its existing mutation discrimination and independent exclusion oracle.
- [x] Register the new test as a real existing installer-shard step. Verify `bash tests/install-sh/meta-all-wired.test.sh`, including omitted registration RED on a disposable workflow copy and restored GREEN. No broad path-scope optimization.
- [x] Run targeted runner/exclusion tests and unchanged runner receipt selftests; record output, exit and exact candidate.
- [x] Commit the bounded runner/caller change normally after review and source-ownership recheck; no bypass or baseline recapture to manufacture green.

**Direct caller closure:** actual merge-forward invocation suppressed compare exit and accepted any `0 fail` substring. Its real-entry local-Git fixture reproduced child42 becoming round0. Preserve the default full15 contract: compare exit0 and an exact whole-line `Result: 15 pass / 0 fail` are both required; retain complete failure diagnostics and park before publication otherwise. Do not weaken the full matrix or create another runner.

- [x] Watch five current-caller cases RED: child42 despite green summary; 10 failures; no summary; empty population; partial population. Restore full15 success. The fixture exercises real Git conflict/regeneration/merge commit, with no external PR or push effect.
- [x] Correct the existing caller in an isolated copy while the installer source is frozen. Current helper suite: 43 pass / 0 fail; independent cold CODE GO on exact helper patch `c2cfdd1249eda940c5903d79bcf72db746987b982e361323115f6e6a2ec158b3` (0 material findings).
- [x] Verify the exact reviewed helper bytes after integration using `bash scripts/merge-forward-round.test.sh`: 43 pass / 0 fail. Commit with the narrow plan update after final relevant checks.

Deferred minor from that review: a complete valid result phrase embedded in a diagnostic is not a separate anchoring-negative case. The production whole-line guard is correct; this coverage note does not reopen a minor fix/re-review round.

### Default source-root closure

Relative or bare imports followed by a cwd change must retain the default source repository, including when the caller has an inaccurate `PWD`. The previous explicit-root control did not cover this default path. Bind private source-location metadata at import using physical cwd; defer root validation until after CLI parsing, preserving an explicit `--root` and caller-owned `REPO_ROOT`.

- [x] Exercise the complete runner beside a fixture installer through actual `snapshot_main`, with relative/bare/dirty-PWD imports and one selected installer child. The unchanged runner fails relative/bare cases; the intermediate mutable-PWD capture fails the dirty-PWD case. Final isolated controls: FAIL=0.
- [x] Independent cold CODE GO, 0 findings, binds source-root patch `b9e5c42f3a359212de694a7a78ba8b3151f0c378e1ddfbb3c987968a532f7399`. Integrate these exact reviewed bytes only after the frozen full battery terminates.
- [x] Revalidate affected real entry consumers on the final source: runner contracts, Python exclusion guard and byte-identical full15 matrix (including its shellcheck). Reuse completed full-battery results only for unchanged relevant inputs, with the pre-root/final-source distinction recorded. No baseline capture or matrix selection reduction.

## Task 2: Explicit fixture scenarios and integrated callers

**Files:** only the bound constructors/alternate paths above and their existing contract tests after overlap reconciliation. No modification of a foreign open branch.

**Interfaces:** retain current `runHook`/`buildCase`/`run` signatures unless the actual integrated #2116 candidate requires ctx-first; in that case enumerate every changed caller and typecheck the integrated tree. Explicit scenario values precede per-case overrides. Default absence is an explicit empty/unset scenario, not a blanket 1M override that destroys window-resolution tests.

- [ ] Resolve open #2116/current owner candidate and shared hunks; record actual base/head and permitted paths in this plan before dependent edits.
- [ ] Add dirty-parent controls that seed all three named controls and compare the same real child scenarios with clean-parent outcomes. Preserve independent explicit small-window/SDK/manual-mode cases.
- [ ] Watch targeted controls RED on the applicable preimage; change existing constructors only; restore GREEN through their real hooks aggregate.
- [ ] Run `npm run typecheck`, existing hermeticity and changed hook suites; ensure every required canonical suite still reaches `test:canonical`. No isolated branch result substitutes for integrated calls.

## Task 3: Bound host controls and real workflow acceptance

**Files:** pending actual current source/custody; do not create a repository launcher or modify historical records to fill this slot.

- [ ] Existing accountable owners bind current writable controller/run record, actual consumer/command, preparation-only boundary across Write/Edit/Bash/equivalent execution channels, generated pins and rollback before edits.
- [ ] On deterministic fixtures, prove repeated init with same identity/mode and changed cwd continues; foreign identity/model/mode fails; forbidden next-stage effects fail before execution through every available capable channel.
- [ ] Persist admitted attempt intent/counters before child creation; prove creation failure, early stderr, exit-zero semantic failure, crash between spawn and receipt, known child/result reconciliation and unresolved ambiguity without duplicate spawn. Restore valid outcomes. Use no paid model call for these controls.
- [ ] Run the actual bound real Yarn/Astro/consumer/native controls and omitted-suite aggregate RED/restored GREEN. Reuse exact applicable existing evidence; missing Windows/toolchain evidence stays unverified.
- [ ] Activate only on the next already-authorized workflow, under existing caps and launch policy, with its accountable consumer receipt. No speculative retry or new allowance.

## Final integrated acceptance and delivery

- [x] Report PARTIAL with each unavailable family's existing owner, exact prerequisite and return condition above. This is repository-slice acceptance, never all-S2 GO.
- [x] Declared repository contract: suite-runner selftest ALL PASS; full private installer battery 167/167 (including actual meta gate); final runner FAIL=0, exclusion 11/11 and actual snapshot compare 15/15 through byte-identical entry (shellcheck 27 files). Root typecheck exit0. The full battery used pre-origin source; its three snapshot consumers were revalidated after the final origin delta. Other installer tests, dependency locks, product payload, registrations and relevant environment inputs are unchanged. This is explicit evidence composition, not a claim that a second full 167-file run used final source.
- [ ] Run parent floor: `bash scripts/build-getff-dist.sh --check`; `make self-audit`. Respect existing source-mutating suite quarantine and no overlapping writer in this checkout.
- [ ] Independent code/fidelity reviews bind exact final inputs and changed source; complete normal pre-push/PR/ownership/managed-registration gates. Keep automatic CI monitoring stopped; consume actual results on authorized continuation.
- [ ] Normal staging delivery only when all applicable gates hold. Canonical umbrella REPORT records per-family outcome, retired paths, commands, destination evidence and owned pending work; stop before S3.

## Repository verification receipt

Evidence root: `/Users/art/.codex/visualizations/2026/10/24/01a16e20-69c2-7320-b3d9-949e8beb9ece/s2-continuation`. `final-repository-source.json` binds the 167/167 pre-origin battery; `integrated-final-source.json` binds final executable bytes and relevant entry runs. All exits are separately recorded. Default membership, fingerprints and baselines are unchanged. Source/test changes beyond the retained candidate are covered by two exact cold CODE GO deltas; the one helper coverage minor is deferred above. Final parent floor and scoped fidelity remain pending until their actual receipts.

The first final `make self-audit` correctly failed on ten live citations shifted by the two-line installer-shard registration. Causal derivative closure uses the existing `check-line-citations.mjs --write` on six reported files: the ci-tool-pinning rule, context7 workflow comment, companion-install reference page, principle36 comment, local-sweep coverage comment and Python consumer-cell comment. The resulting diff changes only numeric coordinates; it does not change rules, tests or workflow behavior. The named docs page participates in docs-check: exit0, zero errors,17 suggestions. Re-run the complete self-audit after normal commit; retain the failed gate receipt. No installer/matrix rerun is warranted by comment-only coordinates.

The next self-audit identified the two packaged source hashes affected by those numeric references. Normal `build-getff-dist.sh` regeneration changes exactly the ci-tool-pinning/principle36 rows in `packages/getff/MANIFEST.sha256`, with unchanged membership; independent archive check passes (1650 archive entries,1645 source rows). The internal rule is explicitly non-installed in ships.manifest; neither source path occurs in the installer fingerprints, so final installed-matrix evidence remains applicable. Preserve both prior failing gate receipts; rerun the full parent floor on the resulting commit.
