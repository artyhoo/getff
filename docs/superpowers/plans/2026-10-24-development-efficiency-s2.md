# Development efficiency S2 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans in the existing visible execution session. No second execution owner is admitted. Steps use checkbox (`- [ ]`) syntax for tracking.

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

## Review focus

1. Bash disables errexit inside conditionally called functions: explicit failure propagation must prevent equal trees from hiding failed installs.
2. Invalid or empty selection must fail before fixture creation; repeats cannot cause duplicate installs.
3. Sourcing definitions from another cwd must preserve the caller's options, PATH, traps and filesystem.
4. Failed capture must preserve the previous baseline; compare must not write expected inputs. Diff/read errors must fail.
5. A missing child receipt must preserve intent/counters and uncertainty; exit zero cannot override a semantic error.

## Source and owner bindings

| Family | Actual source and consumers | Permitted changes / destination | Retired path and rollback | Admission |
|---|---|---|---|---|
| Snapshot selection/outcomes | `tests/install-sh/snapshot.sh`; direct callers `byte-identical.test.sh`, `scripts/merge-forward-round.sh`, host/pre-push commands; definition-extracting consumer `snapshot-exclusion-guard.test.sh` | Existing functions plus `snapshot-runner.test.sh`; register new test in existing `audit-self.yml` installer shard. No installed product payload is changed. | Replace extraction only in the migrated repository test with sourcing; revert runner and its callers together. No baseline rewrite expected. | Existing S2 source owner; independent of host custody. |
| Fixture scenarios | `packages/core/hooks/end-of-turn-reminder.test.ts` (`runHook`, D13 `buildCase`, plugin/hands paths); `precompact-residue.test.ts` (`run`/stop paths); existing `vitest.host-env.ts` scrub and `env-hermeticity.test.ts` | Bind case defaults/explicit absence before per-case overrides; retain intentional HOME/TMPDIR/PATH/OS inputs. Existing hooks aggregates and canonical package scripts stay authoritative. | Remove inherited control ambiguity, not the global hermeticity gate; revert callers together. | Open #2116 changes both files and signatures. Reconcile exact candidate and current source custody before edits; no blind parallel repair. |
| Real Yarn/Astro/consumer/Windows outcomes | I1 §13 and `ONEBUTTON-DELAY-CAUSAL-NOTES.md` A; open #2119/#2067 and #2116/#2025 have existing source/delivery owners | Only exact admitted integrated source and its actual toolchain commands after owner binding. A routing stub remains a routing test. | Replace weak claims with real controls; preserve consumer inputs and native skip accounting. | Pending exact integrated source/ownership. Do not certify an unmerged external candidate from staging tests. |
| Helper migration | All callers of modified snapshot functions, direct script entry points above; external `capture-cell.py`/`stage_support.py`/`single-cell-body.sh` in retained Clarify task | Repository caller migration belongs to this session. Historical external wrappers remain with Integration Root `01a12f25-6bc9-7673-8e85-beed656d5c3c` until fresh custody and current target are bound. | Retire embedded full script/definition slicing only where migrated; keep old historical evidence immutable. | Repository admitted; external activation pending. |
| Session identity / preparation effects | Onebutton owner `01a12f27-d524-77d1-bef0-403a1e185dfb`: retained `call-1/RUN-STATE.json`, `f25-repair/CORRECTED-LINE-HANDLER.js`, verifier and exact correction pin | Need current active launcher/controller and capable phase boundary, not another historical callback copy. | Stable UUID/model/mode separate from cwd. Preserve existing security pins; rollback source while keeping attempt history. | Historical source available, current writable launcher/custody unbound. Park dependent edits. |
| Pre-spawn / semantic / crash accounting | Clarify existing `retained4fd-d0-single-cell-capture-local-closure-deferred-20261021/run_same_owner.py` creates child before `LAUNCH-RECEIPT.json`; existing owner record path is declared there | Repair current actual run record/runner only after owner binding. No new service or charged probe. | Persist intent before spawn, reconcile known child/result, retain early stderr and uncertainty. Never reset counters or replay a queue. | Current live target/ownership pending; historical receipt is not a write grant. |

The referenced host roots and exact evidence paths are retained in the existing canonical umbrella journal. These pending rows are prerequisites, not exemptions or completed work. The same existing owner must supply its actual current target/custody through an authorized route; no unsolicited cross-chat message is sent.

## Task 1: Importable snapshot dispatch and truthful outcomes

**Files:** modify `tests/install-sh/snapshot.sh`, `tests/install-sh/snapshot-exclusion-guard.test.sh`, `.github/workflows/audit-self.yml`; create `tests/install-sh/snapshot-runner.test.sh`.

**Interfaces:** preserve `compute_fingerprint(dir)`, `install_into_fixture(fixture, stack, mode)`, `run_one_capture(stack, mode)`, `run_one_compare(stack, mode)`. Add `snapshot_main [--root DIR] [--cell STACK/MODE]...`; script execution calls it, sourcing defines functions only. No `--cell` means full15. Empty/unknown/repeated cells fail before installs. `--root` defaults to the source's repository root, resolved using `BASH_SOURCE`, and validates the actual installer. `SNAPSHOT_MODE` accepts only capture/compare; existing `BASELINE_DIR` input remains supported.

- [ ] Write actual-dispatch tests: source from foreign cwd without side effects; select one valid cell and observe one child; default observes the independent exact15 list; empty/unknown/repeated selector observes zero children; nonexistent root/mode/prerequisite fails before installation.
- [ ] Write outcome controls: installer writes matching payload then exits42 => compare and capture fail; old baseline survives failed capture; missing baseline/diff command failure fails; failed cell makes the actual aggregate red; restore valid child and get green. Inject hash/readlink failures through actual capture/compare, including conditional invocation: both must return nonzero, fail the aggregate and preserve the previous capture baseline. Fixture installers prove runner contracts only, not product/toolchain acceptance.
- [ ] Run `bash tests/install-sh/snapshot-runner.test.sh`; retain expected RED against the unchanged runner, without invoking the old full installer matrix accidentally.
- [ ] Move environment preparation into the actual execution path. Run each cell in an isolated subshell with reliable cleanup, preserved installer stdout/stderr on failure and explicit return-code checks. Publish capture only after successful installation and fingerprint completion; do not overwrite compare inputs. Preserve fingerprint format, membership and exclusions; explicitly propagate find/sort/hash/readlink failures inside generation, because conditional callers can disable Bash errexit.
- [ ] Bind fixture Git operations to their declared root: dirty `GIT_DIR` parent must agree with clean execution and preserve the unrelated parent's configuration. Use Git's existing `--local-env-vars` classification inside the execution subshell, preserving global/OS inputs. A disposable foreign-repository control reproduced configuration mutation with exit0 before this correction.
- [ ] Replace `sed`/`eval` extraction in the repository exclusion guard with direct sourcing. Its real Python installation must propagate failure. Keep its existing mutation discrimination and independent exclusion oracle.
- [ ] Register the new test as a real existing installer-shard step. Verify `bash tests/install-sh/meta-all-wired.test.sh`, including omitted registration RED on a disposable workflow copy and restored GREEN. No broad path-scope optimization.
- [ ] Run targeted runner/exclusion tests and unchanged runner receipt selftests; record output, exit and exact candidate.
- [ ] Commit the bounded runner/caller change normally after review and source-ownership recheck; no bypass or baseline recapture to manufacture green.

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

- [ ] Complete/review every required family or report PARTIAL with its existing owner, exact prerequisite and return condition; never report all-S2 GO from Task1 alone.
- [ ] Run declared host contract: `bash scripts/run-install-sh-suite.test.sh`; `bash tests/install-sh/meta-all-wired.test.sh`; `bash scripts/run-install-sh-suite.sh`; `SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh`; `npm run typecheck`.
- [ ] Run parent floor: `bash scripts/build-getff-dist.sh --check`; `make self-audit`. Respect existing source-mutating suite quarantine and no overlapping writer in this checkout.
- [ ] Independent code/fidelity reviews bind exact final inputs and changed source; complete normal pre-push/PR/ownership/managed-registration gates. Keep automatic CI monitoring stopped; consume actual results on authorized continuation.
- [ ] Normal staging delivery only when all applicable gates hold. Canonical umbrella REPORT records per-family outcome, retired paths, commands, destination evidence and owned pending work; stop before S3.
