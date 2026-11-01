# S1 honest limits — what each metacheck claims and refuses to claim

> **Rule (spec §5):** static detectors claim only their decidable syntax. Q3 uses pinned
> reached non-equivalent production faults and a frozen oracle, never guessed AST dataflow.
> The semantic remainder routes to the named cold-review protocol (`review-sidecar`) and the
> blocking dispositions queue (`dispositions.md`) — never to a silent pass.

## Promotion gate (`--promote-gate`, rework round 1; re-pointed final rework 2026-10-10)

- **The gate is CONTENT-level, pinned to the delivery carrier** (final rework, 2026-10-10):
  `--promote-gate` claims only that `packages/core/hooks/checks/guard-liveness.ts` — the
  tracked source the Q1/Q2 changed-file arm ships as — references the stage arm
  (`runTestQualityLiveness`). The round-1 target (`pre-push.bundle.mjs`) was host-measured
  unsatisfiable: pre-push.ts loads guard-liveness via `await import` and the builder keeps
  first-party modules external by design (scripts/build-runtime-bundles.mjs), so the symbol can
  never land in the bundle and a freshly rebuilt bundle stays 0-hit. Bundle freshness is
  enforced separately by the runtime-bundles-drift script-selftests lane
  (`node scripts/build-runtime-bundles.mjs --check`), referenced as the gate's freshness
  evidence rather than probed here; the rebuild itself was executed on the lockfile-clean host
  as commit 46c8d1d5f78 — a commit that enters the PR lineage only via the coordinator
  merge-forward; until it resolves in the checkout (`git cat-file -t 46c8d1d5f78`) the
  dispositions step enforces the queued carrier obligation
  (`dispositions.md` #disp-rework5-host-commit-merge-carrier). Behavioral delivery of the changed-file arm remains proven by
  principle 51/52 conformance + the driver, and the gate's own flip control is a content-level
  control over a content-level check (it proves the check flips, not that the carrier is
  correct). A carrier edit that mentions the symbol without shipping the behavior would pass
  THIS gate and still be caught by the conformance lanes.

## Per-channel claims

- **Q1/Q2 static lane** (`no-vacuous-assertion`, `require-effective-assertion`,
  `packages/core/eslint-rules/`): claim ONLY literal-only-argument syntax (Q1) and
  effective-assertion presence (Q2) in the configured file scope. They do NOT decide
  behavioral coverage, mock fidelity, or whether an assertion could ever fail. The
  legitimate-structure carve-outs below are admitted BY CONSTRUCTION (measured, pinned
  corpus), not by judgment.
- **Q3 counterfactual channel** (frozen oracle + reached production faults): claims that the
  named tests survive a named, reached, non-equivalent fault in the real subject
  (reachability observed, not inferred). It does NOT prove oracle independence in general;
  no AST/dataflow claim is made or supported by syntax.
- **Q4/Q5 executed conformance** (principle 52): claims the pinned subprocess-status corpus
  flips exactly as pinned when the real process exits or the phrase backing breaks. It does
  NOT classify every suite shape in the repo — that is S2's population classification.
- **Q6 delivery conformance** (principle 53 + delivery replays): claims the demonstrated
  delivery edges (config severity, rule registration, template wiring, vitest grammar,
  principle pairing) are live and fail closed when broken. It does NOT certify emitted-output
  integrity (WI-1 seam below).
- **K6 discovery** (51/52/53 fail-closed arms + live stray-file probe): claims missing files,
  empty selection, unregistered/stray paths, grammar drift and runner failure fail closed
  for the POPULATIONS THE PRINCIPLES ENUMERATE. It does not claim every test population in
  the repo is enumerated.

## Recorded limits (blocking where marked)

- **`merge-forward re-opens (explicit S2 entry conditions)`** — BLOCKING at the stage
  boundary, owner S2 (review round 5): (1) the PR lineage must carry coordinator host commit
  `46c8d1d5f78` — the rebuild receipt named by the promotion gate's freshness evidence. The
  raw host receipt exists only on the coordinator host and is NOT attached here (a
  reconstruction would be invented evidence), so the carrier is the enforced path — queue:
  `dispositions.md` #disp-rework5-host-commit-merge-carrier, mechanically consumed by the
  dispositions step, which REDs while the commit is unresolvable and the entry is missing;
  (2) after that merge-forward, ONE further lockfile-clean host regen
  (`bash scripts/build-getff-dist.sh` — the round-4 re-pin edits exactly one
  manifest-population file, `packages/core/install/wire-synth-rules.test.ts`) — queue:
  #disp-rework5-s2-entry-manifest-regen. S1 makes no claim that either has happened yet.
- **`GLV-suite-fallthrough`** — retained honest limit: guard-liveness's `matchesViolation`
  fallthrough is reachable only through a parse-error input at the SUITE level; the recorded
  GLV-1 fixture's clean zero-message input never invokes the matcher. cf3 is discharged at
  gate level by driver arm `D5-PERM-GLV` (`dispositions.md` #disp-cf3-guard-liveness-permissive);
  the suite-level blind spot stays on record.
- **`WI-1 emitted-hash seam`** — BLOCKING, owner S2: a corrupted `hash=` fence attribute
  parses, is exposed, and fails nothing (`replay-a12-emitted-corruption.sh`). S1 makes no
  emitted-output integrity claim.
- **`wrong-import review-routed`** — BLOCKING, owner S2: no executable wrong-import detector
  in S1; the case is admitted in the static matrix as an honest admission and rejection is
  routed to the review channel (`dispositions.md` #disp-wrong-import-review-routed).
- **`outside-S1-class candidates`** — adversarial sweep categories the S1 detectors do not
  cover (snapshot-only suites, wholesale `.skip`, bare `toThrow()`, unawaited promises) are
  recorded with raw probe results in `logs/batch-h/adversarial-sweep.log` and are S2
  candidates, NOT silent gaps: the S1 class list is closed by the kickoff and widening it is
  S2's reviewed scope.
- **`principle-51 population narrowing`** — non-blocking, owner S2 (fidelity round-1
  advisory A-1, host-contract rework round 2): `trackedTestFiles()`
  (`packages/core/principles/51-test-quality-corpus-conformance.test.ts:175`) enumerates
  `git ls-files '*.test.ts' '*.test.tsx' '*.test.mjs' '*.spec.ts'` — it does NOT sweep
  `*.spec.{tsx,mjs,js}`, `*.test.{js,cjs}`, `__tests__/` directories or `*.audit.ts`, so
  the delivered population sweep is narrower than a "all test files" reading of the gate.
  The conformance claim holds over the population the principle actually enumerates (the
  ratchet pins exactly that set); widening the enumeration is S2 population-classification
  scope, recorded here so it is a declared limit, not a silent gap.
- **`cf1 reachability method is assertion-text-based`** — non-blocking (fidelity round-1
  advisory A-2, host-contract rework round 2): cf1's `reachabilityObservation.method`
  self-labels as assertion-text observation ("intended assertion text in the killed
  file's vitest JSON failureMessages … no importable module to probe; recorded as such,
  not as a probe claim", `counterfactuals/cf1-a03-circular-oracle.json:22` — the record
  the fidelity round-1 shorthand calls "cf1 q5-backing-break"). That honest
  label is retained — cf1 claims reachability via the killed assertion's own failure
  message, not via an instrumented probe; the Q3 channel bullet's "reachability
  observed, not inferred" claim is discharged per-record by each record's own method
  label.

## Legitimate structure (never rejected by this kernel)

Constant expected values (an expected constant asserted against computed output), snapshots,
structural/schema contracts, parity tests (which cannot establish both sides correct — a
semantic contract still needs an independent behavioral anchor), determinism tests, helper
assertions and asynchronous assertions remain useful within their stated claims. The corpus
carries measured companions for each (`corpus-register.md`), and the static matrix pins them
as admissions.

## D011 conditional source cycle — claims and non-claims (2026-10-14)

The recovery controls ([`recovery-d011/README.md`](recovery-d011/README.md)) claim that
the coordinator-frozen 14 supplemental arms + A2/A3/K3 lanes all reach their frozen flips
against the repaired source at `17e8c3ad5b1`, under patch pins that make any
expectation-weakening an INFRA refusal. They do NOT claim:

- **be84 recovery.** The historical be84 commit object is MISSING and stays missing; the
  repairs reconstruct its governed behavior from the frozen packets (regions,
  expectations, probes), never its identity. No claim in this file or the matrix may be
  read as "be84 restored".
- **Shared derived-artifact freshness.** The three derived bundle/MANIFEST paths remain
  HELD per the coordinator ACK; their generation/freshness is NOT green here and cannot
  be until the post-acceptance reciprocal generation. Dispositions entry
  `disp-d011-shared-derived-hold` carries the obligation.
- **Publication.** No PR/push/merge, no promote gates, no S2+ entry: source acceptance is
  the coordinator's decision on the presented HEAD; the verify battery here is the
  same-session evidence, not the acceptance verdict.
- **A second recovery cycle.** This was the ONE conditional D011 source cycle; any
  material post-cycle REVISE returns remaining evidence to the chief — no automatic
  extension is implied by anything here.

## Scope boundary

S1 delivers the metachecks + evidence package for the Q1–Q6 classes and K1–K7 obligations of
spec §4–§6 — nothing more. Full-population classification, broad repair of confirmed gaps,
and any new enforcement channel are S2+ and require their own reviewed kickoff. A green S1
acceptance run is evidence about the pinned corpus, drivers and replay commands only.

## M15 actual-lineage successor — claims and non-claims (2026-10-14, corrected per review 09826c35)

Chief decision `tak-m15-real-lineage-successor-decision-20261014.json` (sha256 `d438e372…`)
replaced the review-round-5 merge-carrier mechanism with a live actual-lineage verification,
corrected per independent review M15-PREPARATION-REVISE (sha256 `09826c35…`). This section
supersedes the 46-carry sentences above; the historical text stays byte-intact.

- **What the dispositions step claims:** every link of recovered `4fa71b5d` (tree `4229a3a3…`)
  → accepted source `1cb4a51d` (tree `63a480ca…`) → host generation `ac17594f` (tree
  `a5da6f40…`, parent = source, diff = `packages/getff/MANIFEST.sha256` only, manifest sha256
  `23596776…`) → HEAD resolves as a REAL commit with the exact recorded identity, in one
  ancestry chain, in THIS checkout, on every run. AND the six mandatory receipts
  (SOURCE_GO `56f33fd1…`, S1_GO `e011679d…`, OWNERSHIP_RENEWAL `23575146…`,
  FRESHNESS_RESULTS `114ced73…`, GENERATION_INPUT `bf297320…`, GENERATION_AFTER `d00ccc4c…`)
  are embedded BYTE-EXACTLY in `dispositions.md` §M15, pinned in `verify.mjs`, single-
  occurrence, and linkage-consistent with the live git chain and with each other. AND live
  freshness: the step invokes the stock `build-getff-dist.sh --check` and
  `build-runtime-bundles.mjs --check` against LIVE source every run — a stale manifest or
  bundle REDs with the stock diagnosis (missing toolchain is INFRA, never green).
- **Non-claim — historical objects.** `46c8d1d5f78` and the historical be84 commit object
  are NOT recovered and NOT claimed (local/GitHub probes found the first absent, the
  configured container transport timed out — remote UNKNOWN); neither is synthesized. The
  successor verifies the ACTUAL lineage, not historical ancestry.
- **Non-claim — GO strings.** Receipt bytes and hashes are the evidence; a GO verdict string
  alone never suffices — the receipts are consumed as BYTES (inflate → hash → parse → linkage),
  and the real Git chain plus live freshness remain mandatory alongside them.
- **Non-claim — public integration.** The private-stage discharge (S2 entry + D011 hold) does
  not discharge the public boundary: any future public source integration must merge-forward
  then-current staging/native, regenerate the integrated accepted inputs with SHARED owner
  renewal, and pass same-head CI/publication/final acceptance — queue:
  `disp-m15-successor-s2-entry-regen` (owner-stage S4).
- **Non-claim — scope.** The successor touches only the six decision-allowed paths; the
  native 0166 consumer slots were untouched by the private generation, and nothing here
  certifies future source edits (the embedded receipts certify the accepted bytes only).
