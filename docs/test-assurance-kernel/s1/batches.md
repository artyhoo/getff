# S1 batch ledger — intended file lists per batch

> Appended BEFORE the first edit of each batch (execution ground rule 2, plan line 45).
> Base: `35738554f` (see `base-manifest.json`).

## Batch A — Phase 0 (Task 1–2): base + consult

Files (intended, recorded 2026-10-08 before first edit):

- `docs/test-assurance-kernel/s1/base-manifest.json` (new)
- `docs/test-assurance-kernel/s1/batches.md` (new — this ledger)
- `docs/test-assurance-kernel/s1/logs/phase0/provisioning.log` (new)
- `docs/test-assurance-kernel/s1/logs/phase0/baseline-principles.log` (new)
- `docs/test-assurance-kernel/s1/prior-art.md` (new — Task 2)
- `docs/test-assurance-kernel/s1/logs/phase0/prior-art-searches.md` (new — Task 2)

No repo-mechanism edits in this batch.

## Batch B — Task 4 (recorded before first edit, see batch entry below)

Files (intended, recorded 2026-10-08 before the first Batch-B edit):

- `packages/core/eslint-rules/no-vacuous-assertion.ts` (new — Q1 rule)
- `packages/core/eslint-rules/no-vacuous-assertion.test.ts` (new — RuleTester)
- `packages/core/eslint-rules/require-effective-assertion.ts` (new — Q2 rule)
- `packages/core/eslint-rules/require-effective-assertion.test.ts` (new — RuleTester)
- `packages/core/eslint-rules/index.ts` (edit — barrel registration, 2 keys)
- `packages/core/eslint-rules/no-vacuous-assertion.mjs` + `.d.ts` (generated twins, committed)
- `packages/core/eslint-rules/require-effective-assertion.mjs` + `.d.ts` (generated twins, committed)
- `packages/core/audit-self/fixtures/fences-fire/no-vacuous-assertion.{bad.txt,good.txt,manifest.json}` (new ×3 — plugin-dual-engine requirement)
- `packages/core/audit-self/fixtures/fences-fire/require-effective-assertion.{bad.txt,good.txt,manifest.json}` (new ×3)
- `eslint.config.mjs` (new, repo root — delivery lane; imports the built `.mjs` twins; only the two new rules; scoped to test globs + the corpus dir)
- `packages/core/hooks/checks/guard-liveness.ts` (edit — changed-file test-quality arm; no `pre-push.ts` edit)
- `packages/core/hooks/checks/guard-liveness.test.ts` (edit — arm tests incl. fail-closed arms)
- `packages/core/principles/51-test-quality-corpus-conformance.test.ts` (new — CI lane; next free slot: 50 is taken by install-rc-asserted)
- `templates/ts-server/eslint.config.mjs` (edit — consumer delivery; test-file block)
- `packages/preset-next-15-canonical/templates/eslint.config.react.mjs` (edit — same)
- `packages/preset-react-spa/templates/eslint.config.react.mjs` (edit — same)
- `scripts/test-assurance/counterfactuals/counterfactual-lib.sh` (edit — ADDED to this
  batch's file list mid-batch, ledgered here before the commit: `expect_intended` gains an
  ADDITIVE suite-level fallback (a file-level `tr.message` is pushed into the candidate
  messages) because an import-time throw (the fences-fire deletion edge) carries its error
  in the FILE's `message`, not in `assertionResults[].failureMessages` — without it a
  whole-suite crash is unassertable against its intended text. Batch-D neutrality re-proven:
  cf4 rerun EXIT=0 after the change)
- `docs/test-assurance-kernel/s1/batches.md` (edit — this entry + outcome)
- `docs/test-assurance-kernel/s1/logs/batch-b/red-probe.log` (new; force-added — pre-edit channel-absent proof)
- `docs/test-assurance-kernel/s1/logs/batch-b/verification.log` (new; force-added — raw gate output)

Batch B outcome (2026-10-08): all 19 entries above written; template enablement
verified through principle 25 (3/3 — every `rules-as-tests/*` ref in the three
templates resolves against the shipped barrel). `preset-react-spa` had NO existing
test-files lane (surveyed: only `vitest.config.ts` in global ignores), so its edit
adds a minimal scoped test-files block carrying exactly the two Q1/Q2 rules —
same globs convention as its sibling templates, no new plugin dependency. Mid-batch
defect caught by the twin gate: `require-effective-assertion.mjs` had been generated
BEFORE the K4 fix (calleeNames object-name case) — `--check` went DRIFT; regenerated
(32 checks clean) and re-ran every twin-consuming gate. Raw evidence:
`logs/batch-b/verification.log` §1–§7 (rule suites 42/42, dual-engine 38/38,
twin --check exit 0, principle 51 6/6, principle 25 3/3, guard-liveness 20/20,
CLI replay: Q1 bad exit=1 with intended diagnostic / Q1 good exit=0 / Q2 bad
exit=1 / Q2 helper-good exit=0). Gate-set count: 7; iterations used: 2 of 5.

## Phase 1 — Task 3 (corpus): recorded before first edit

Files (intended, recorded 2026-10-08 before first edit):

- `scripts/test-assurance/corpus/q1-vacuous/bad.literal-identity.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/bad.literal-arithmetic.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/bad.string-literal-identity.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/bad.negated-literal.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/bad.fabricated-status.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/good.constant-on-subject.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/good.intentional-fixture-exempt.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/good.snapshot-contract.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/good.structural-schema.ts` (new)
- `scripts/test-assurance/corpus/q1-vacuous/good.parity-test.ts` (new)
- `scripts/test-assurance/corpus/q2-noassertion/bad.comment-only.ts` (new)
- `scripts/test-assurance/corpus/q2-noassertion/bad.empty-body.ts` (new)
- `scripts/test-assurance/corpus/q2-noassertion/bad.console-only.ts` (new)
- `scripts/test-assurance/corpus/q2-noassertion/bad.await-without-assert.ts` (new)
- `scripts/test-assurance/corpus/q2-noassertion/good.helper-assertions.ts` (new)
- `scripts/test-assurance/corpus/q2-noassertion/good.async-assertions.ts` (new)
- `scripts/test-assurance/corpus/q3-copied-predicate/subject.ts` (new — mutation subject fixture)
- `scripts/test-assurance/corpus/q3-copied-predicate/bad.recomputed-expectation.ts` (new)
- `scripts/test-assurance/corpus/q3-copied-predicate/bad.same-predicate-both-sides.ts` (new)
- `scripts/test-assurance/corpus/q3-copied-predicate/good.pinned-expectation.ts` (new)
- `scripts/test-assurance/corpus/q4-ignored-exit/bad.ignored-exit.ts` (new)
- `scripts/test-assurance/corpus/q4-ignored-exit/good.asserted-exit.ts` (new)
- `scripts/test-assurance/corpus/q5-self-source/bad.circular-phrase.ts` (new)
- `scripts/test-assurance/corpus/q5-self-source/good.behavior-backed-phrase.ts` (new)
- `scripts/test-assurance/corpus/q6-disconnected/bad.disconnected-config.ts` (new — scratch template)
- `scripts/test-assurance/corpus/q6-disconnected/good.wired-config.ts` (new — scratch template)
- `scripts/test-assurance/corpus/wrong-import/bad.wrong-import.ts` (new — review-channel-routed)
- `scripts/test-assurance/corpus/wrong-import/good.correct-import.ts` (new)
- `scripts/test-assurance/expectations.json` (new — frozen BEFORE any detector output is trusted)
- `docs/test-assurance-kernel/s1/corpus-register.md` (new)
- `docs/test-assurance-kernel/s1/logs/phase1/corpus-listing.log` (new; force-added past the `*.log` ignore — evidence package)

Naming note: corpus fixtures carry NO `.test.`/`.spec.` infix (root vitest has no
`include:` allowlist, so default discovery would execute stray `*.test.ts`; corpus
is a lint/conformance corpus, not a runnable suite). Scratch runners select these
files explicitly (Batch C/F).

Phase 1 outcome (2026-10-08): all 30 files written exactly as listed above (28 corpus
fixtures + `expectations.json` + this register). Freeze facts recorded in
`corpus-register.md` §2: `expectations.json` carries `frozen_at: 2026-10-08`, its
`rules.*` entries name rules that DID NOT EXIST at freeze time (Batch B creates them),
and every post-freeze change now requires a `batches.md` note + a cold-review receipt
(`s1/cold-review.md`). Listing evidence: `logs/phase1/corpus-listing.log`
(30 files: 15 bad / 12 good / 3 fixture).

## Batch C — Task 5 (Q4/Q5 executed-conformance metachecks)

Files (intended, recorded 2026-10-08 before the first Batch-C edit):

- `packages/core/principles/52-subprocess-status-conformance.ts` (new — module: scratch
  root builders, real-vitest runner, per-file result parser, fault patches with sha256,
  infrastructure-vs-detection classifier; slot 52 verified free)
- `packages/core/principles/52-subprocess-status-conformance.test.ts` (new — principle
  arms: Q4 baseline/flip, Q5 baseline/fault, A07 fabricated-status arm, K6 fail-closed
  arms, non-vacuity)
- `docs/test-assurance-kernel/s1/batches.md` (edit — this entry + outcome)
- `docs/test-assurance-kernel/s1/logs/batch-c/red-probe.log` (new; force-added —
  channel-absent proof on THIS base: bad q4/q5 corpus cases pass under the real runner)
- `docs/test-assurance-kernel/s1/logs/batch-c/verification.log` (new; force-added —
  principle 52 + neighbouring gate output)

Mechanism notes (recorded before edit):

- Scratch roots under `os.tmpdir()`, `node_modules` symlinked to this worktree's
  provisioned tree so `vitest` imports resolve (S0 probe pattern); `CLAUDE_CODE_ENTRYPOINT`
  / `CLAUDECODE` scrubbed from the spawned env (S0 §5.2).
- Counterfactual mutations are literal string replacements applied to SCRATCH copies only:
  Q4 fixture `process.exit(42)` → `process.exit(0)`; Q5 backing behavior
  `sealed = true;` → `sealed = false;` (the inline helper IS the case's production
  surface; the test's assertions are never touched). Patch texts + sha256 recorded.
- Corpus files in the repo are NEVER mutated (frozen); the scratch copies are renamed
  `*.test.ts` so the real runner discovers them inside the scratch root only.
- Classification honesty (T-TAK-A): spawn failure / timeout / signal / nonzero-from-crash
  → `infrastructure-failure`, never detection; a RED on the expected file counts only if
  the intended assertion text appears in the failure messages.

Batch C outcome (2026-10-08): all 5 entries above written. RED probe first (channel-absent
proof on THIS base): all 5 corpus cases pass under real vitest 4.1.8 at baseline; the q4
fixture flip kills ONLY `good.asserted-exit` («expected +0 to be 42») while
`bad.ignored-exit` + the A07 `fabricated-status` aux stay green; the q5 fault kills ONLY
`good.behavior-backed-phrase` («expected false to be true») while `bad.circular-phrase`
stays green — raw runner output in `logs/batch-c/red-probe.log` (patch sha256s recorded).
Principle 52 (8/8) encodes this as the conformance contract: reject = survival
demonstrated, admit = kill demonstrated WITH the intended assertion (a crash-RED is not a
kill), plus K6 fail-closed arms (empty selection refused pre-spawn, missing corpus file
refused naming the path, runner spawn failure → infrastructure-failure) and a registry
reconciliation against `expectations.json` (case id ↔ corpus path ↔ channel). Mid-batch
defects caught and fixed: (1) the batch gate surfaced 3 PRE-EXISTING typecheck errors in
Batch B's committed kernel files (no-vacuous-assertion.ts SpreadElement argument typing —
semantically load-bearing, now narrowed; guard-liveness.ts plugin-record cast; principle 51
config cast) — repaired in a separate atomic fix commit, twins regenerated (32 checks
clean), 114/114 suite runs ×2 for determinism; (2) a scratch-litter collision in 52's own
missing-file arm (second run EEXIST ≠ intended throw) — fixed with unique scratch names +
finally cleanup. Gate-set count: 7; iterations used: 3 of 5. Raw evidence:
`logs/batch-c/verification.log` §1–§6.

## Batch D — Task 6 (Q3 counterfactuals — frozen oracle, scratch mutations)

Files (intended, recorded 2026-10-08 before the first Batch-D edit):

- `scripts/test-assurance/counterfactuals/counterfactual-lib.sh` (new — shared scratch
  builder, sha256/occurrence patch helper, tsx reachability-probe runner, vitest JSON
  per-file verdict assertions; fail-closed `fail` vs `INFRASTRUCTURE-FAILURE` exit codes)
- `scripts/test-assurance/counterfactuals/replay-cf1-a03-circular-oracle.sh` (new —
  q5 backing-behavior break; circular companion survives, behavior-backed kills)
- `scripts/test-assurance/counterfactuals/replay-cf2a-age-boundary-shift.sh` (new —
  q3 subject `age >= MIN_AGE` → `age >= 0`; pinned companion kills, both bads survive)
- `scripts/test-assurance/counterfactuals/replay-cf2b-min-age-weaken.sh` (new — q3
  subject `MIN_AGE = 18` → `0`; same kill/survive split, non-equivalent carrier)
- `scripts/test-assurance/counterfactuals/replay-cf3-guard-liveness-permissive.sh` (new —
  fresh kernel fault: `matchesViolation` `return false` → `return true` in a detached
  scratch worktree (`pre-merge-local.sh:240` pattern); reachability probe + GLV-1 RED +
  restore + final green baseline in the main checkout)
- `docs/test-assurance-kernel/s1/counterfactuals/cf1-a03-circular-oracle.json` (new — spec §6 record)
- `docs/test-assurance-kernel/s1/counterfactuals/cf2a-age-boundary-shift.json` (new — spec §6 record)
- `docs/test-assurance-kernel/s1/counterfactuals/cf2b-min-age-weaken.json` (new — spec §6 record)
- `docs/test-assurance-kernel/s1/counterfactuals/cf3-guard-liveness-permissive.json` (new — spec §6 record)
- `docs/test-assurance-kernel/s1/logs/batch-d/cf1-replay.log` (new; force-added)
- `docs/test-assurance-kernel/s1/logs/batch-d/cf2a-replay.log` (new; force-added)
- `docs/test-assurance-kernel/s1/logs/batch-d/cf2b-replay.log` (new; force-added)
- `docs/test-assurance-kernel/s1/logs/batch-d/cf3-replay.log` (new; force-added)
- `docs/test-assurance-kernel/s1/logs/batch-d/verification.log` (new; force-added — post-batch gate output)
- `docs/test-assurance-kernel/s1/batches.md` (edit — this entry + outcome)

Mechanism notes (recorded before edit):

- All corpus mutations are applied to SCRATCH copies under `mktemp -d` (repo corpus
  files are never touched — restoration proven by sha256 equality + clean `git status`
  on the corpus dir). CF3 mutates the real kernel file `guard-liveness.ts`, but only
  inside a DETACHED scratch worktree (`git worktree add --detach`, pattern from
  `packages/core/audit-self/pre-merge-local.sh:240`); the main checkout is never mutated.
- Every patch applies EXACTLY ONCE (occurrence count asserted before write) with
  `patchSha256 = sha256(label\nfrom\nto)` + before/after sha256 per file — same
  convention as principle 52.
- Reachability is observed independently of the killing test wherever the fault lives
  in an importable module: CF2a/CF2b via a `tsx` probe importing the mutated scratch
  subject directly (`isAdult(17)` flips false→true). CF1's fault lives inside the test
  file's inline helper, so the independent observation is the intended assertion text
  in the vitest JSON `failureMessages` for the killed case (record states this honestly).
- Exit-code contract for every replay script: 0 = pinned demonstration reproduced;
  1 = demonstration FAILED (detection gap or oracle drift); 3 = INFRASTRUCTURE-FAILURE
  (missing node_modules/tsx/vitest, spawn error) — infrastructure never counts as
  detection or as a green (T-TAK-A).
- q3 frozen-oracle discharge: `expectations.json` says `q3/good.pinned-expectation` =
  `admit` (must kill every pinned reached fault) and both `q3/bad.*` =
  `reject-by-counterfactual` (must survive) — CF2a/CF2b are that discharge, executed.

Mid-batch amendment (recorded before the cf4 edit, after the first full replay pass):

- Static pre-run reading of `runRuleLiveness` (`guard-liveness.ts:154-156`) found the
  originally-declared CF3 probe input could NOT reach the mutated fallthrough: the
  roundtrip config enables exactly one rule, so the only possible lint messages are
  violations of that rule (matched unconditionally by the `ruleId === ruleName` guard)
  or FATAL PARSE ERRORS (ruleId null — the only class reaching the fallthrough); a
  clean zero-message input never invokes the matcher (`messages.some(...)` over an
  empty array). The recorded GLV-1 fixture uses exactly such a clean input, so the
  suite was predicted unable to kill this mutant. CF3's probe was replaced with a
  parse-error input and its suite phase restructured to OBSERVE the outcome
  (`CF3-SUITE-OUTCOME killed|survived`) instead of asserting a kill. The prediction
  held empirically: the kernel suite SURVIVED the mutant — an honest reached-not-killed
  detection gap, recorded as `classification: survived` in the record and routed to the
  blocking dispositions queue (Batch H owns `dispositions.md`).
- To pin the other side of the boundary, CF4 was ADDED (fresh fault, same carrier):
  the terminal fail-status inversion — reachable on the exact zero-message shape GLV-1
  itself uses — which the suite DOES kill on the intended assertion
  (`expected 'pass' to be 'fail'`, guard-liveness.test.ts:96). Together CF3+CF4 show
  the kernel suite kills gross permissive faults but not fallthrough-only mutants.
  Amended files: `scripts/test-assurance/counterfactuals/replay-cf4-guard-liveness-status-inversion.sh`,
  `docs/test-assurance-kernel/s1/counterfactuals/cf4-guard-liveness-status-inversion.json`,
  `docs/test-assurance-kernel/s1/logs/batch-d/cf4-replay.log`,
  `docs/test-assurance-kernel/s1/logs/batch-d/replay2-cf4-guard-liveness-status-inversion.log`.
  Additional beyond the original list: the five `logs/batch-d/replay2-*.log` files (timed
  determinism re-run — supplies the records' runtime fields and the ×2 reproduction proof).

OUTCOME (Batch D closed 2026-10-08, iterations 2 of 5):

- All five replays exit 0 TWICE (initial run + timed determinism re-run, wall 1–7s);
  cf1/cf2a/cf2b/cf4 classification=killed with intended assertions named in the vitest
  JSON; cf3 classification=survived (honest detection gap → dispositions queue).
- CF3/CF4 mutate the real kernel file ONLY inside detached scratch worktrees at HEAD;
  restoration proven by sha256 equality with the HEAD blob, main checkout proven clean,
  and the guard-liveness suite re-run green in the MAIN checkout post-experiment.
- Records: 5 × spec §6 schema-complete JSONs under `s1/counterfactuals/` (validated in
  `logs/batch-d/verification.log` §3); raw evidence under `s1/logs/batch-d/`.
- UNRESOLVED routed forward: CF3's gap becomes a blocking dispositions-queue item
  (Batch H `dispositions.md`; consumer = verify.mjs in Batch G).

## Batch E — Task 7 (Q6 delivery conformance + fail-closed discovery, K5/K6)

Files (intended, recorded 2026-10-08 before the first Batch-E edit):

- `packages/core/principles/53-delivery-discovery-conformance.ts` (new — Q6 scratch
  scenario mechanics (real emitted config + real rule twins + real eslint CLI +
  real vitest), corpus↔registry bidirectional reconciliation, principle-discovery
  ratchet bound to the real `packages/core/vitest.config.ts` include grammar;
  slot 53 verified free)
- `packages/core/principles/53-delivery-discovery-conformance.test.ts` (new —
  Q6 conformance arms (bad reject / good admit with intended assertion), both
  ESLint-rule delivery edges, K6 fail-closed arms: spawn-failure→infra,
  deleted-path, missing-registry-key, unregistered-file, rename-out-of-grammar)
- `packages/core/principles/52-subprocess-status-conformance.ts` (edit —
  `INTENDED_ASSERTIONS` gains the `q6/good.wired-config` key (the good
  companion's own `toMatch` regex is the intended assertion); mechanism-side
  addition only, the frozen `expectations.json` is NOT changed)
- `scripts/test-assurance/delivery/replay-fences-fire-deletion.sh` (new — ESLint-rule
  family edge 3: delete a committed fences-fire triple in a DETACHED scratch worktree
  (`pre-merge-local.sh:240` pattern) → `plugin-dual-engine` RED → restore)
- `scripts/test-assurance/delivery/replay-template-dangling-ref.sh` (new — template
  family edge: seeded dangling `rules-as-tests/<id>` ref in a shipped template inside
  a detached scratch worktree → principle 25 RED → restore)
- `scripts/test-assurance/delivery/replay-principle-rename-break.sh` (new — principle
  family edge: rename a committed principle test outside the vitest include grammar
  inside a detached scratch worktree (+ the two new 53 files copied in as scratch
  fixture) → runner silently drops it AND the 53 ratchet goes RED → restore)
- `scripts/test-assurance/delivery/replay-a12-emitted-corruption.sh` (new —
  emitted-output family: A12-class corruption through the REAL
  `packages/core/composition/fence.ts` modules — body drift IS caught today by
  `regionsMatch`; a corrupted `hash=` marker attribute is silently tolerated
  (the WI-1 seam) → demonstrated gap recorded honestly, no out-of-scope repair)
- `docs/test-assurance-kernel/s1/batches.md` (edit — this entry + outcome)
- `docs/test-assurance-kernel/s1/logs/batch-e/red-probe.log` (new; force-added —
  pre-edit channel-absent proof: the delivered root config's severity forced `off`
  in a throwaway copy silently disconnects the real CLI gate (exit 1 → 0) and no
  automated consumer of the root config notices)
- `docs/test-assurance-kernel/s1/logs/batch-e/verification.log` (new; force-added —
  principle 53 + neighbouring gates raw output)
- `docs/test-assurance-kernel/s1/logs/batch-e/edges.log` (new; force-added — the four
  worktree/characterization replay outputs)

Mechanism notes (recorded before edit):

- Q6 conformance follows the Batch-C shape (reject = survival demonstrated, admit =
  kill demonstrated WITH the intended assertion) but the counterfactual patch lands
  on the SCRATCH-EMITTED DELIVERED CONFIG (severity `off` = A04; unregister = edge B),
  not on a test fixture — the delivery edge IS the fault.
- The scratch root receives the repo's `eslint.config.mjs` VERBATIM plus the two
  built `.mjs` twins copied to the same relative depth, so the delivered artifact is
  the real one and actually loads; the real `node_modules/.bin/eslint` CLI runs
  against it (K5: source → emitted artifact → invoked runner → gate).
- Classification honesty (T-TAK-A): spawn failure / missing binary / empty selection
  → `infrastructure-failure`, never detection; a kill without the intended assertion
  text is not a kill.
- The corpus↔registry reconciliation is bidirectional and REAL: registered-but-missing
  and on-disk-but-unregistered both fail closed; the in-test arms use tampered inputs
  (no repo mutation during test runs — a concurrent-run plant would flake other lanes);
  the LIVE disk-side proof (transient stray file planted + reconciled RED + removed +
  restoration) is executed once in the batch flow and logged.
- The principle-discovery ratchet binds to the include grammar parsed from the REAL
  `packages/core/vitest.config.ts` (not a copy): a tracked principle test file that
  the grammar no longer matches, or that is missing on disk, fails closed. Untracked
  grammar-matching files are deliberately NOT flagged (work-in-progress; the commit
  boundary is where tracking happens — same convention as principle 51's population
  sweep).
- No out-of-scope repair: A12's hash-seam gap is characterized and queued, not fixed.
- Worktree provisioning parity discovered mid-batch (ledgered): scratch worktrees need BOTH
  `node_modules` symlinks — root AND `packages/core/node_modules` (oxlint resolves only
  through the package-level link; a root-only link dies with `Cannot find package
  'oxlint/plugins-dev'`). Codified in all three mutating replay scripts.

Batch E outcome (2026-10-08): all entries above written; iterations used: 3 of 5 (test-file
verify loop) + 4 full replay-script runs (within cap). Results, with raw exits in
`logs/batch-e/verification.log` + `logs/batch-e/edges.log`:

- RED probe (pre-edit, `logs/batch-e/red-probe.log`): the severity-`off` flip on the REAL
  delivered config disconnects the real CLI gate live (exit 1 → exit 0 on the vacuous probe,
  rule id gone from output) — the Q6 channel-absent proof on THIS base.
- Principle 53: 13/13 green (`P53-EXIT=0`), including the LIVE scratch delivery scenario
  (baseline pass ×2 → severity-`off` on the emitted config → good companion dies on its own
  `/to match \/no-vacuous-assertion/` assertion, bad companion survives, CLI flips
  exit 1 → exit 0 silent = `delivery-silent`; edge honesty occ=1 + sha256 before/after
  recorded), the K6 registry arms (deleted path / deleted key / new `.test.mts` extension /
  empty population all fail closed), the K6 discovery arms (rename-out-of-grammar,
  missing-on-disk, missing/empty include block) and the pairing ratchet over the REAL
  numbered-module population (13 modules, zero orphans at baseline).
- The LIVE disk-side stray-file probe (in `edges.log`): planted
  `scripts/test-assurance/corpus/q1-vacuous/s1-batch-e-stray.test.mts` →
  `reconcileCorpusRegistry` RED `on-disk-but-unregistered` naming it → removed →
  `mismatches=0` restored (porcelain clean).
- Four delivery replays EXIT=0 (`edges.log`): FENCES-FIRE-DELETION (fixture deletion →
  `plugin-dual-engine` import-time throw with the intended `no good fixture` text — the
  lib's suite-level fallback lands here), TEMPLATE-DANGLING-REF (principle 25 RED naming
  `rules-as-tests/s1-replay-dangling-ref`), PRINCIPLE-RENAME-BREAK (silent drop proven raw:
  `vitest run <old-path>` rc=1 "No test files found" ×1, then the 53 ratchet RED naming
  `principles/52-subprocess-status-conformance.ts`), A12-EMITTED-CORRUPTION
  pass-as-CHARACTERIZATION (body drift caught; corrupted `hash=` parses, is exposed, and
  cannot fail any check → SURVIVED → blocking dispositions queue, S2 obligation; NO repair).
- Neighbouring gates: tsc `--noEmit -p packages/core` TSC-EXIT=0; cf4 Batch-D regression
  EXIT=0 (lib change neutral); eslint over the 53/52 test files clean (the root config
  ignores non-test principle modules — pre-existing config behavior; module files are
  covered by tsc + the suite, same lane as Batch C); full principles suite
  `3 failed | 57 passed (60)` — the SAME 3 pre-existing content REDs (14/37/48) proven
  pre-existing at this SHA in Batch B; 52 suite 8/8 (`P52-EXIT=0`); markdownlint-cli2 EXIT=0;
  batches.md 330 lines (< 600 gate).
- Known pre-existing REDs NOT touched by this batch (no unrelated population repairs):
  principles 14 (4 broken refs + 7 invocation-channel contracts), 37, 48.

## Batch F — Task 8 (frozen outer conformance driver + anti-detector K3/K4 matrix)

Files (intended, recorded 2026-10-08 before the first Batch-F edit):

- `scripts/test-assurance/driver-expectations.json` (new — the FROZEN outer-driver
  expectations: baseline corpus rows DERIVED FROM the frozen oracle
  (`scripts/test-assurance/expectations.json`, sha256 prefix 069d2a70165ba84e — frozen in
  Task 3 BEFORE any detector existed) + the six anti-detector arms with exactly-once
  patches, carriers, pristine/mutant observations and narrowness retainers; NOT derived
  from any detector run)
- `scripts/test-assurance/driver.mjs` (new — the frozen outer conformance driver
  (spec §6 "separate unchanged conformance driver"): node-builtin-only; baseline
  conformance over the real CLI (K1/K2); anti-detector matrix arms in DETACHED scratch
  worktrees at HEAD (exactly-once sha256 patches, pre-image pin vs HEAD blob, observations
  through the REAL entrypoints, restoration + hash equality + porcelain-clean + final
  main-checkout baseline); detection semantics: an arm passes iff corpus verification
  FAILS under the fault — a fault that leaves the gate green is a K3/K4 violation
  (exit 1); spawn/selection failures exit 3 (T-TAK-A))
- `scripts/test-assurance/driver-probes/glv-parse-error-probe.mts` (new — frozen D5 probe:
  direct `runRuleLiveness` call with the parse-error input (the only message class reaching
  the `matchesViolation` fallthrough); pristine `PROBE status=fail`, permissive mutant
  `PROBE status=pass` — the cf3 discharge mechanism)
- `scripts/test-assurance/driver-probes/glv-healthy-rule-probe.mts` (new — frozen D6 probe:
  direct `runRuleLiveness` call with a HEALTHY rule (violating negative-test input + clean
  good example); pristine `PROBE status=pass`, over-rejecting mutant `PROBE status=fail`)
- `docs/test-assurance-kernel/s1/cold-review.md` (new — the INDEPENDENT freeze review
  receipt over `driver-expectations.json` (cold read-only reviewer; expectations reviewed
  against spec §5–§7 + the frozen oracle + the corpus BEFORE the driver is used for
  acceptance), plus the cf3 disposition resolution recorded there)
- `docs/test-assurance-kernel/s1/logs/batch-f/driver-run.log` (new; force-added — full
  driver output with raw exits)
- `docs/test-assurance-kernel/s1/logs/batch-f/verification.log` (new; force-added —
  post-batch gates: tsc, eslint over driver files, vitest neighbouring suites,
  markdownlint/wc)
- `docs/test-assurance-kernel/s1/batches.md` (edit — this entry + outcome)

Mechanism notes (recorded before edit):

- Trusted boundary (spec §6): the frozen outer driver + its independently reviewed
  expectations. The driver NEVER edits its expectations at runtime; no assertion in the
  outer oracle is deleted to manufacture sensitivity (T-TAK-B).
- The governed corpus stays FIXED between baseline and mutant: every arm mutates the GATE
  (rule twin / root config / kernel engine) inside a scratch worktree — never the corpus.
  Merely changing governed input would be K2, not K3, and no arm does it.
- Arm set (the spec §6 representative fault classes over S1's claimed detectors):
  D1-PERM-Q1 (permissive: Q1 twin's `context.report` neutered → bad corpus flips exit 1→0),
  D2-K4-Q2 (over-rejecting: Q2 effective-assertion recognizer inverted → GOOD corpus flips
  exit 0→1 while bads stay rejected), D3-BOUNDARY-Q1 (boundary: `BinaryExpression` dropped
  from the pure-literal grammar → ONLY `bad.literal-arithmetic` flips while
  `bad.literal-identity` stays rejected — narrow weakening, distinguished from a full
  neuter), D4-INVOCATION-Q1 (invocation-break/delivery: root config severity `error`→`off`
  = seed A04 → CLI silent), D5-PERM-GLV (permissive kernel engine: `matchesViolation`
  fallthrough `false`→`true` — the cf3 fault, discharged through the driver probe),
  D6-K4-GLV (over-rejecting kernel engine: good-example violation check forced true →
  healthy rule flips pass→fail).
- D1–D3 mutate the BUILT `.mjs` twins (the production carrier the real CLI loads via the
  root config — K5 delivery chain), NOT the `.ts` sources; the source↔twin drift that
  would create is itself gated by `build-shipped-eslint-rules.sh --check` (verified green
  post-batch on the pristine tree).
- cf3 disposition: the Batch-D `survived` classification is processed by D5 — the driver is
  the "separate unchanged conformance driver" of spec §6, its frozen probe observes the
  flip the recorded suite cannot (its clean fixture never reaches the fallthrough). If D5
  detects, cf3's obligation is discharged WITH the suite-level limit recorded as an honest
  limit; if D5 fails, unresolved-K3 → BLOCK DONE for the guard-liveness obligation.

### Batch F outcome (post-freeze, acceptance evidence)

- **Independent freeze review (T19/T22): WARN — zero blocking findings, FREEZE-VERDICT: ACCEPT**
  (`s1/cold-review.md`). Reviewer: `review-sidecar` role, cold read-only session, spawned before
  any acceptance capture existed. Findings all MINOR/cosmetic and ADOPTED as post-review
  amendments recorded in the receipt: F1 (unexpected eslint exit now infrastructure — driver
  hardened to route any exit outside the documented 0/1 grammar to exit 3, can neither read green
  nor count as detection), F2 (exit-0 summary sentence now states the full pristine+mutant
  conjunction that `arm_pass` already required), E1 (UnaryExpression grammar-branch coverage gap
  named in the retainer text and carried to honest limits — not repaired in S1), C1 (cf3 field
  key named exactly). Mechanical-INCONCLUSIVE on the sha256 pins discharged at runtime (below).
- **Acceptance runs (post-amendment): `node scripts/test-assurance/driver.mjs` ×2 → both
  `DRIVER_EXIT=0`** (wall 15.2s / 13.4s). Raw logs `s1/logs/batch-f/driver-run.log`,
  `driver-run2.log`; determinism: 45 normalized OBS/ARM/PATCH/RESTORED lines byte-identical
  across runs (`s1/logs/batch-f/determinism.log`, empty diff). Oracle pin re-verified live in
  both runs (`069d2a70…`), D5 patch sha `6da3c1c1…` byte-equal to the cf3 record, post-patch
  carrier hash `baba8728…` equal to cf3's recorded post-patch hash.
- **All six arms DETECTED** (corpus verification fails under each fault, pristine healthy in
  every arm, restoration hash-proven, `MAIN-CHECKOUT carriers porcelain-clean`, final baseline
  re-run green): D1-PERM-Q1 (K3), D2-K4-Q2 (K4 — goods 0→1, bads stay rejected),
  D3-BOUNDARY-Q1 (K3 — flips ONLY `bad.literal-arithmetic`, retainer bads stay rejected),
  D4-INVOCATION-Q1 (K5 — seed A04 replayed through the real CLI), D5-PERM-GLV (K3 — the cf3
  fault, `PROBE status=fail`→`pass`), D6-K4-GLV (K4 — healthy rule `pass`→`fail`).
  **cf3 disposition: DISCHARGED as detected-by-driver**; the suite-level parse-error limit
  remains recorded as an honest limit (the GLV-1 suite fixture still cannot reach the
  fallthrough — that limit is about the suite fixture, not the engine).
- **Neighboring gates** (`s1/logs/batch-f/verification.log`): tsc `EXIT=0`; eslint over driver
  surfaces `EXIT=0`; vitest eslint-rules + hooks/checks + principles 51/52/53 → 29 files, 773
  passed (+1 pre-existing skip), `EXIT=0`; twins `--check` 32 checks `EXIT=0`; fail-closed
  grammar probe `--arm NO-SUCH` → `INFRASTRUCTURE-FAILURE` `EXIT=3`; markdownlint 0 issues;
  batches.md 441→472 lines (under the 600-line gate).
- Iterations: 1/5 implementation + this acceptance pass (no detector/test mutation cycles).

## Batch G — Task 9 (verify.mjs stage acceptance adapter)

Recorded before first edit.

### Batch G file list

- `scripts/test-assurance/verify.mjs` (new — the only production surface this batch)
- `docs/test-assurance-kernel/s1/logs/batch-g/acceptance.log` (new; force-added — raw verify run)
- `docs/test-assurance-kernel/s1/logs/batch-g/tamper-arms.log` (new; force-added — in-place exactly-once tamper/restore proofs)
- `docs/test-assurance-kernel/s1/batches.md` (edit — this section)

### Mechanism notes (design frozen before implementation)

- Node-builtin-only `.mjs`; reuses the driver's childEnv hygiene + fail-closed reflexes; NOT a
  new test platform — every step spawns an existing public entrypoint.
- Interface: `--stage S1` (required). `S2|S3|S4` → nonzero «no acceptance registry registered».
  `--require-host darwin|linux` → compare the host sysname lowercased; unknown/mismatch →
  exit 3 BEFORE anything runs (the reviewer's Mac contract; fails closed on this Linux base by
  design). Mechanism correction (discovered at first run, never invented): `os.uname()` is NOT
  a Node API (the frozen note's spelling) — the Node sysname surface is `os.type()`
  (`Linux`/`Darwin`/`Windows_NT`), whose lowercased value IS the uname-sysname predicate.
- REPO-IDENTITY GUARD (host-verify.sh pattern): physical `git-common-dir` of the script's repo
  vs cwd, CDPATH/GIT_DIR/GIT_COMMON_DIR/GIT_WORK_TREE scrubbed for child git; refusal → exit 3.
- Exit grammar (mirrors driver.mjs): 0 = S1 accepted; 1 = RED (missing/invalid evidence, failed
  replay, unresolved obligation, skipped required case — REAL); 3 = infrastructure/missing
  prereq/host-or-repo refusal.
- S1 acceptance registry (each step prints `VERIFY <step> PASS|RED|INFRA` + command + rc + key
  excerpt): prereqs (binaries, corpus, oracle+driver-expectations parse + live oracle-sha pin,
  probes exist) → K7 record schema validation (5 pinned cf record ids; spec §6 minimal fields;
  `evidenceLogs` paths must exist on disk; `replayCommand` must name an existing entrypoint) →
  static-matrix K1/K2 replay reconstructed from the FROZEN ORACLE (per-case eslint; reject ⇒
  rc 1 + rule id; admit/fixture ⇒ rc 0; wrong-import honest admission stays rc 0) → anti-
  detector K3/K4/K5 (full `driver.mjs` run → 0) → 5 counterfactual replays (`scripts/test-
  assurance/counterfactuals/replay-*.sh` → 0 each) → 4 delivery replays
  (`scripts/test-assurance/delivery/replay-*.sh` → 0 each; exit contract 0 = pinned
  demonstration reproduced, incl. honest-survival characterizations) → suites (vitest
  eslint-rules + hooks/checks + principles 51/52/53 → 0; covers delivery-live/silent, K6
  discovery ratchets, corpus ratchet) → twins `--check` → packages/core tsc → dispositions
  (`s1/dispositions.md`, authored Batch H: fenced-JSON entries; schema {id, source,
  classification, disposition ∈ resolved|owner-stage, resolution_evidence[], owner_stage};
  resolved ⇒ ≥1 evidence path exists; owner-stage ⇒ S2|S3|S4; every non-killed/non-equivalent
  cf record MUST be covered; dangling/open blocking ⇒ RED).
- Design clarification recorded BEFORE implementation (per the oracle's change_policy — not a semantic change): the dispositions coverage denominator additionally includes every frozen ORACLE case whose `expectation` is `reject-by-review` (today: `wrong-import/bad.wrong-import`). The frozen note already requires «unresolved blocking ⇒ RED» and the oracle's channel_map routes wrong-import to «named cold-review protocol + blocking dispositions queue» — without this coverage check the queue would be a warning with no consumer, exactly the spec §4 failure. cf-sourced entries must also restate the record's classification (drift ⇒ RED).
- Fail-closed on missing evidence is REQUIRED Batch-G evidence: `dispositions.md` does not exist until Batch H, so the Batch-G acceptance run is honestly RED at that step (exit 1) with every other step PASS; the first full `--stage S1` exit-0 run lands in Batch I after the evidence package exists. Tamper arms in scratch, exactly-once, hash-proven restore: T0 missing-dispositions RED; T1 drop a pinned cf record → RED names it (enumerated denominator, not a count); T2 empty a driver baseline selector → driver exits 3 → verify nonzero (T-TAK-A: never green).

### Acceptance-run finding F-G1 + file-list amendment (recorded before the fix edit)

The first acceptance run (`s1/logs/batch-g/acceptance.log`, run 1) found a REAL defect the
adapter is designed to catch: `delivery RED — replay-principle-rename-break.sh → 1
(COUNTERFACTUAL-FAIL: worktree principles/ still dirty after restoration)`. Root cause is a
HEAD-staleness defect in that Batch-E replay, not in the adapter: its restoration phase
assumes the copied-in 53 module/test are UNTRACKED at HEAD («the untracked 53 files just get
removed») — true when authored (pre-27211e0de), false now that 53 is committed, so `rm -f`
deletes TRACKED files and the worktree goes dirty. The rename demonstration itself is sound
and unchanged. **Amended Batch G file list:** `scripts/test-assurance/delivery/
replay-principle-rename-break.sh` (fix: tracked-aware fixture copy/restore — a copied path
that exists at HEAD is restored via `git checkout --`, an untracked one via `rm`; stale
«HEAD predates Batch-E» comment corrected). Iterations counter: 2/5.

## Batch H — Task 10

Batch H file list (recorded before first edit; ground rule 2):

- `docs/test-assurance-kernel/s1/dispositions.md` (new — the BLOCKING dispositions queue:
  fenced-JSON entries per the Batch-G-frozen schema; mechanical denominator = cf records
  ∉ {killed, equivalent} ∪ reject-by-review oracle cases, computed live by `verify.mjs`)
- `docs/test-assurance-kernel/s1/honest-limits.md` (new — what each detector claims and
  refuses to claim; semantic-remainder routing to the named cold-review protocol)
- `docs/test-assurance-kernel/s1/matrix.md` (new — Q1–Q6 × K1–K7 evidence map with explicit
  n/a reasons and coverage denominators)
- `docs/test-assurance-kernel/s1/replay-commands.md` (new — exact replay commands + expected exits)
- `.agents/rules/test-quality-contracts.md` (new — the S1 test-quality policy authority,
  Class C prose rule, `paths:`-gated to the kernel surfaces; extends P02/P04/51/52/53 and
  names review-sidecar as the review protocol — NO competing policy copy)
- `.agents/rules/00-rule-index.md` (regen: `npx tsx scripts/render-rule-index.mjs --write`)
- `docs/test-assurance-kernel/s1/logs/batch-h/self-application.log` (T15 — the metachecks
  run over the kernel's own suites; must admit)
- `docs/test-assurance-kernel/s1/logs/batch-h/adversarial-sweep.log` (T7 — adversarial
  category counter-prompt actually executed against the detectors; out-of-class results
  recorded as S2 candidates, not silent)
- `docs/test-assurance-kernel/s1/cold-review.md` (append — independent review-sidecar
  receipts over the Batch G+H surfaces)
- `docs/test-assurance-kernel/s1/batches.md` (edit — this entry + outcome)

Not edited, deliberately (recorded 2026-10-08): `.agents/roles/review-sidecar.md` and its `@dual-pair` skill-context twin. The sidecar already reports structured findings with the tautology dimension; spec §4-§5's requirement is a blocking CONSUMER for those findings — which is `dispositions.md` + the policy rule naming the routing — not a prompt edit that would obligate an out-of-scope twin sync.

### Batch H outcome (2026-10-08)

- All listed files written; the regenerated index rows (`.agents/rules/00-rule-index.md` + the AGENTS.md rule-index region — the renderer writes both) are a mechanical consequence of the sanctioned rule add, folded into this batch like the Batch B twins regen.
- AGENTS.md derived-edit disclosure + fold-vs-queue rationale (auto-review finding b55cd1aeca20): carried into the PR body via `pr-body-disclosures.md` §1 (this file is at its 600-line gate; the receipt lives there).
- Channels proven for the new rule: principle 31 + 09 green over the live population (84/84); its own edit-time injection fired on the next `docs/test-assurance-kernel/**` Write — delivery live.
- **First exit-0 acceptance: 10/10 PASS, ACCEPTED** (30/30 fresh CLI replays match the frozen oracle; driver 0; 5/5 counterfactuals; 4/4 delivery replays; suites 32f green; twins 32 checks; tsc 0; dispositions 3 entries with mechanical coverage of [cf3-guard-liveness-permissive, wrong-import/bad.wrong-import]). The log at `logs/batch-h/acceptance.log` holds the POST-REVIEW re-run (identical verdict).
- T15 self-application: exit 0 over the kernel's own suites + adapter/driver + all corpus goods (`logs/batch-h/self-application.log`). T7 counter-prompt executed with 7 probes: 2 caught (Q1 control, plain-Q2), 5 honest limits → S2 candidates (`logs/batch-h/adversarial-sweep.log`; first attempt from the repo root returned «outside of base path» for every probe incl. the control — re-run from the probe dir before reading results).
- Independent cold review (review-sidecar, read-only): **WARN, 0 blockers, 8 MINOR** (F-H1..F-H8) — ALL FIXED + re-verified in this batch (mapping table + probes + byte-exact restores in `s1/cold-review.md`; F-H3/F-H4 proven by RED-naming probes on probe entries).
- Iterations: 2/5 (1: Fires-line single-line fix; 2: the 8 review findings).

### Batch G outcome (2026-10-08)

- Refusal grammar (raw: `logs/batch-g/tamper-arms.log` header + session log): `--stage S2` → 3 «no acceptance registry registered»; `--require-host darwin` on linux → 3 BEFORE anything runs (never weakened); unknown `--step` → 3; foreign-clone cwd → 3 (repo-identity guard resolves linked worktrees to the primary common dir — they pass, foreign clones refuse).
- Acceptance run 1: 8 PASS + delivery RED (**F-G1**, fixed above) + dispositions RED → exit 1. Fix verified standalone exit 0 (`logs/batch-g/fg1-fix-verification.log`).
- Acceptance run 2 (post-fix): **9/10 PASS + dispositions RED = the REQUIRED fail-closed-on-missing-evidence proof** → exit 1 (`logs/batch-g/acceptance.log`). First exit-0 `--stage S1` run lands in Batch I once the evidence package exists.
- Tamper arms T0/T1/T2 all DETECTED with byte-identical restorations (T0 missing queue → RED; T1 dropped cf1 → RED names it; T2 emptied baseline selector → driver exits 3 → adapter INFRA, never green): `logs/batch-g/tamper-arms.log`.
- `verify.mjs` lints clean under the root config (it sits in the `scripts/test-assurance/**` rule scope). Iterations: 2/5.

## Batch I — Task 11 (cold review, full gates, REPORT)

File list (recorded before first edit; ground rule 2; amended after the cold review returned — additions marked):

- `docs/test-assurance-kernel/s1/logs/batch-i/gate{1,2,3,4,6}-*.log` (new; force-added — raw receipts: principles; vitest eslint-rules + hooks/checks; twins `--check`; `verify.mjs --stage S1 --require-host linux`; markdownlint + `wc -l`)
- `docs/test-assurance-kernel/s1/logs/batch-i/gate5-sweep.log` (new; force-added — `run-local-ci-sweep.sh --keep-going` run POST-commit on the clean tree per the dirty-tree-underselection rule; every RED triaged pre-existing-vs-caused-by-diff)
- `docs/test-assurance-kernel/s1/cold-review.md` (append — full-diff independent cold-review receipt, T19)
- `docs/test-assurance-kernel/s1/batches.md` (edit — this entry + outcome)
- *[added post-review, C2]* `logs/batch-i/refusal-grammar.log` (new — the four refusal arms re-run raw, each exit 3)
- *[added post-review, C2]* `logs/batch-i/gate4-verify-run1-prereview.log` (renamed from `gate4-verify.log` — pre-review receipt preserved; post-fix re-run is the binding `gate4-verify.log`)
- *[added post-review, C3 mechanism fix — its own atomic `fix()` commit BEFORE commit 10 so commit 10 stays evidence-only]* `scripts/test-assurance/counterfactuals/replay-cf3-guard-liveness-permissive.sh`, `scripts/test-assurance/counterfactuals/replay-cf4-guard-liveness-status-inversion.sh` (trap-protected main-checkout litter removal, F-H7 parity)
- *[added post-review, C4/C5]* `docs/test-assurance-kernel/s1/dispositions.md` (append — two owner-stage S2 entries recording the review's out-of-scope parallel surfaces)
- Plan-file checkbox annotations are skill-harness session state, not repo deliverable.

Outcome: cold review **GO, zero BLOCKERs** (C1–C7 dispositioned in `cold-review.md` §Batch I; C2/C3 acted on, C4/C5 recorded in the dispositions queue, C6 already an honest limit, C7 DECISION-NEEDED → coordinator). Gates: gate1 principles exit 1 = the 3 phase0-baseline content REDs (14/37/48), re-triaged by named-input identity vs `base-manifest.json` receipts — none caused by the stage diff; gate2 vitest (eslint-rules + hooks/checks) exit 0; gate3 twins `--check` exit 0 (32 checks); gate4 acceptance **run 2 post-C3-fix: ACCEPTED 10/10, exit 0** (`gate4-verify.log`; pre-review run preserved); refusal grammar 4/4 exit 3; gate6 markdownlint + `wc -l` clean. Gate5 sweep runs post-commit on the clean tree; its log folds into commit 10 by amend (evidence completion, not mechanism change).

Gate5 post-commit outcome (amended): run 1 (at `7b4292d8d`) was cut mid-install-sh by the session
boundary — preserved as `gate5-sweep-prerepair-truncated.log`. Its 33 recorded verdicts were
denominator-triaged in **`logs/batch-i/gate5-triage.md`** (every RED: named-input identity, base
re-runs in a scratch worktree). One stage-caused defect found and repaired in its own atomic fix
commit **`899d33df6`** (C3 precedent): `format-check` RED on the two shipped rule sources under the
pinned `prettier@3.8.3` → formatted via the canonical write path, twins regenerated (`--check`
32/32), RuleTester 42/42, vitest 29f/773p, `gh-531` 57/57 + `delivered-prettier-conformance` 6/6
GREEN. Binding complete run 2 at `899d33df6`: `gate5-sweep.log`. Remaining REDs, none reachable to
S1 commits without leaving the fence: the derived-artifact family (face-facts 57→60, reference
C/F1, getff MANIFEST, install-sh snapshot baselines, 3 stale line-citations, stale
`pre-push.bundle.mjs` lacking `runTestQualityLiveness`) → 3 blocking queue entries
(`disp-gate5-*`) each with its repair command; pre-existing (script-selftests 9/58 scripts RED at
base; canonical-source "native model window" arm RED at base); environment (fast-uri 3.1.7 in the
shared node_modules vs 3.1.8 lockfiles; untracked `.claude/skills/aif/` pollution; the committed
`/app/node_modules/.bin/*` fallbacks from PR #823 flipping two fences-fire arms). Deviation from
«folds into commit 10 by amend»: `899d33df6` supersedes commit 10 as tip, so the receipts land in
a follow-up evidence commit instead — evidence completion, no mechanism change.
