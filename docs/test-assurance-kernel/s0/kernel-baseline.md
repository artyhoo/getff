# S0 kernel baseline — frozen discovery, Q1–Q6 characterization, cost baseline

> Stage: S0 of the test-assurance-kernel campaign (spec
> `docs/superpowers/specs/2026-10-08-test-assurance-kernel-design.md`). Frozen at
> `manifest.json:sourceSha`. Raw receipts under `logs/` (sha256-pinned in
> `workloads.json`) and in the scratch probe log excerpts quoted below.
> Characterization only — no repairs were made in S0 (kickoff-s0 constraint).

## 1. Frozen inputs

| Input | Value |
|---|---|
| sourceSha | `6bd07187e57` — full 40-hex in `manifest.json` (placement merge of campaign inputs on `staging`, PR #2085) |
| lockfile | `package-lock.json` (sha256 in `manifest.json`) |
| host | macOS 26.6.2, arm64 (Darwin); node v24.3.0, npm 11.4.2, git 2.53.0, rustc 1.98.1, vitest 4.1.8 |
| tracked population | 3,893 files at sourceSha (`population.json`; command: `git ls-tree -r --name-only <sha> \| sort`) |
| runnable test population | 355 `*.test.ts` + 4 `*.test.mjs` (Vitest) + 256 `*.test.sh` (bash) tracked at sourceSha |

Population shape (denominator before any sampling, T10): shell tests concentrate in
`tests/install-sh` (161) + `scripts` (36) + `scripts/dot-review-gate` (19) +
`tests/plugin` (15) + `tests/hooks` (11); Vitest concentrates in
`packages/core/hooks` (73) + `packages/core/principles` (57) +
`packages/runtime-bridge/test` (24) + `packages/core/synthesizer` (24) +
`packages/core/skills` (22) + `packages/core/research` (22) + `hooks/checks` (18)
+ `validator` (17). Harness twins: 4 prebuilt `.bundle.mjs` twins
(`pre-push`, `synth-and-wire`, `rule-bootstrap-cli`, `mcp-source-check`) kept in
sync by gates live-fired in the green pre-push receipt.

Declared test entrypoints (adversarial-category sweep, T7 — the categories beyond
the two runner globs): `Makefile` (12 targets incl. `self-audit`, `install-hooks`);
9 workspace `package.json` files carry test/check scripts — root (`test`,
`check:skill-drift`, `format:check`, `build:synth-bundle:check`,
`build:getff-dist:check`, `typecheck`), `packages/core` (20: `test`,
`test:principles|canonical|hooks|ir|backends|composition|render|live-generation|
template-render|synthesizer|skills|spec-validation|units`, `typecheck`,
`render-rules:check`, `render:python:check`, `render:researched:check`,
`render:researched:rust:check`, `verify:provenance`), presets (`test`, `typecheck`
×3), `runtime-bridge` (`test`, `typecheck`), plus 238 test-invoking `run:` steps
across `.github/workflows/*.yml` (each shard/battery line counted; shell
`*.test.sh` invocations dominate). Per-entrypoint execution-lane and
surface-classification is S2's obligation-inventory work; S0 pins the
denominators above.

Fixture-like material
(`tests/fixtures/**` — 17 files of transcript/plugin/agent data; package
`install/fixtures/**` registry caches) is data, not runnable tests; precise
fixture-vs-runnable disposition of every candidate is S2's mandatory-status work,
not asserted here. `.agents/` carries 357 tracked files and `.claude/` 1005 at
sourceSha.

## 2. Existing test-quality detector inventory (live-probed on this host, 2026-10-08)

Every row was actually executed at the sourceSha tree; exit codes and counts are
from the live runs (logs quoted inline; scratch probe logs retained under `logs/probes/`).

| Mechanism | Home | Channel | Live probe result | Declared scope |
|---|---|---|---|---|
| P04 no-tautology | `packages/core/principles/04-no-tautology.test.ts` | CI (`test:principles`) + pre-push | green (part of 57-file principles suite, 668 passed) | **Manifest only**: policy not tautological, bad≠good examples, no no-op `check.command` in `rules-manifest.json` |
| Guard-liveness (change-scoped ESLint roundtrip) | `packages/core/hooks/checks/guard-liveness.ts` | pre-push liveness section | `npx vitest run packages/core/hooks/checks/guard-liveness.test.ts` → 13 passed, 0.78s, exit 0 | manifest rules R2/R7/R8/R12/R14/R20: code input → violation roundtrip through real ESLint `Linter` |
| Guard-liveness fullsweep | `packages/core/hooks/checks/guard-liveness-fullsweep.ts` | scheduled CI workflow | workflow-level (not rerun here; local twin green via guard-liveness.test.ts) | all manifest cmd/script checks |
| Synthesizer rule-firing gate | `packages/core/synthesizer/run-rule-tests-firing.test.sh` | CI | `PASS=42 FAIL=0 (lanes exercised via shim: astgrep, ruff, cargo)`, exit 0 | generated rules actually fire on bad/good corpora across toolchain lanes |
| Synthesizer generated-rule mutation gate | `packages/core/synthesizer/run-generated-rule-mutation.test.sh` | CI | `PASS=28 FAIL=0`, exit 0 | seeded permissive mutations in generated rules are killed |
| P02 paired-negative | `packages/core/principles/02-paired-negative-test.test.ts` | CI + pre-push | 27 passed \| 1 skipped, exit 0 | manifest rules carry negative companions |
| P50 install-rc-asserted (ratchet) | `packages/core/principles/50-install-rc-asserted.test.ts` | CI + pre-push | 34 passed, exit 0 | installer-call scanner candidates under a baseline ratchet (326-candidate backlog, not proof of defects) |
| P16 hook-stub-completeness | `packages/core/principles/16-hook-stub-completeness.test.ts` | CI + pre-push | 9 passed, exit 0 | shipped hooks' stub surfaces complete |
| P21 agnosticism/liveness | `packages/core/principles/21-*.test.ts` | CI + pre-push | 31 passed (2 files), exit 0 | agent/tool parity across harnesses |
| Discovery-coverage principles | `38-vitest-include-ci-coverage`, `41-shell-test-ci-coverage` | CI + pre-push | green within principles suite | vitest include patterns and shell tests are reached by CI |

No repo-wide ESLint configuration exists for the repository's own test files
(`git ls-files | grep -E 'eslint\.config'` returns only templates/presets/fixtures);
ESLint is used as a library (real `Linter`) inside validator/guard-liveness for
manifest and synthesized rules — there is no lint channel over `packages/core/**/*.test.ts` itself.

## 3. Q1–Q6 baseline characterization (bad-case behavior on the frozen tree)

Probes Q1/Q2 ran in a scratch root outside the repository
(`/tmp` scratch, `vitest run --root`), so no repo file was touched. Full scratch
inputs and outputs are retained verbatim under `logs/probes/`.

### Q1 — literal-only success (`expect(true).toBe(true)`)

**Channel today: none for the repository's own tests.** Live probe: scratch file
`vacuous.test.ts` with `expect(true).toBe(true)` and `expect(1+1).toBe(2)` →
`Test Files 1 passed (1), Tests 2 passed (2)`, exit 0 — nothing on the frozen tree
detects the class. Nearest existing mechanism: P04 no-op-command detection, whose
scope is `rules-manifest.json` fields, not test source. → S1 must deliver the
narrow static contract (with tested fixture/harness exclusions).

### Q2 — no effective assertion (comment-only / empty body / disabled assertion)

**Channel today: none.** Live probe: scratch file `noassertion.test.ts` with a
comment-only `it` and an empty-body `it` → `2 passed`, exit 0 (same scratch run
totaled 4 passed including the Q1 file). → S1 must use actual supported
lint/runner mechanisms with legitimate-helper recognition.

### Q3 — copied predicate / recomputed expectation survives a reached fault

**Channel today: partial, generated-rule families only.** The synthesizer
mutation gate (PASS=28) proves seeded permissive mutants in *generated* rules are
killed; guard-liveness proves manifest rules roundtrip. For the repository's own
suites there is no general behavioral-sensitivity mechanism. Seeds A03/A06
(frozen in the independent audit) are recorded instances of the residual class.
→ S1 pins the frozen-oracle counterfactual record; broad sensitivity work is S2.

### Q4 — intended nonzero process status ignored

**Channel today: partial.** P02/P50 enforce asserted exit codes for
installer/subprocess surfaces (probes green). Seeds A07/A08 record the residual
class: a regex accepted comment/fabricated status (A07), and an installer
artifact test ignored an explicit exit 42 (A08). → S1 corpus includes
ignored-exit bad case + good companion.

### Q5 — required phrase found only in the assertion's own source

**Channel today: partial.** P16/P21-family structural checks exist (probes
green); seed A03 shows a circular-oracle residual (assertions satisfied phrases
in their own source; a sibling test caught the disabled helper). → S1 bad/good
corpus case; conformance via real gate runs.

### Q6 — valid in-memory plan, disconnected delivered configuration

**Channel today: strong for the canonical/bundle family.** Live evidence at this
tree (green pre-push receipt, retained): `pre-push.bundle.mjs in sync with
pre-push.ts`, `synth-and-wire.bundle.mjs in sync`, face-facts `byte-identical to
the derivation`, and the canonical node--test suite (52 passed — the `kernel`
workload) exercises emitted/copied bindings end-to-end. Seeds A04/A12 record
residuals on other delivery edges (serialized severities forced `off` survived
431 tests; fence/hash corruption survived the composition suite). → S1 delivery
conformance corpus extends K5 edges; full family sweep is S2.

**Q-baseline summary:** Q1 and Q2 have **no current detection channel** for the
repo's own tests (proven by scratch probes); Q3–Q6 have partial channels whose
residual classes are pinned by seeds A03–A08/A12. Zero-detection classes are the
S1 build targets, not S0 repairs.

## 4. Cost baseline

### 4.1 Frozen workloads (three trials each; medians below, full rows in `workloads.json`)

| Lane | argv (recorded context) | Class represented | Median wall (ms) |
|---|---|---|---|
| docs | `env -u CLAUDE_CODE_ENTRYPOINT node scripts/render-reference.mjs --check` | doc-only change → reference/doc freshness gate | 1437 |
| rule | `env -u CLAUDE_CODE_ENTRYPOINT npx vitest run packages/core/principles/44-kickoff-authoring-traps.test.ts` | ordinary rule change → that rule's own suite | 538 |
| kernel | `env -u CLAUDE_CODE_ENTRYPOINT npm --workspace packages/core run test:canonical` | kernel/shared-config change → canonical emitted-bindings suite | 6231 |
| fallback | `env -u CLAUDE_CODE_ENTRYPOINT npx vitest run packages/core/principles` | broad/unknown-path change → widest green local suite | 18281 |

Each lane carries its own input-change fixture (`fixtures/<lane>.patch`, sha256 in
`workloads.json` rows) so the four rows are distinct workloads, not four labels:
docs → one-line prose edit in `CONTRIBUTING.md`; rule → one-line body edit in an
`.agents/rules/*.md` rule; kernel → one-line edit in a `packages/core/hooks/checks/*.ts`
kernel check; fallback → new file at a previously unknown path.

Invocation context recorded per row: environment (env scrub `-u
CLAUDE_CODE_ENTRYPOINT` inside argv — the SDK-entrypoint leak class proven live:
a standalone `bash .husky/pre-push` run without the scrub failed `test:canonical`
in 20.12s because the fixture subprocess inherited `CLAUDE_CODE_ENTRYPOINT=sdk-cli`
and the D7 arm's SDK guard exited 0 before arming), cache/concurrency (vitest
defaults: cache enabled, default pool/threads; node--test single process),
cold-vs-warm noted (first trial after other suite runs; no `--no-cache` flags).

### 4.2 Local pre-push chain (the dominant ordinary-code gate)

- Green full-run receipt at this tree (`logs/probes/prepush-green-fullrun.log`): audit-ai-docs
  vitest 3.28s → citations/skill-drift/bundle-sync/render checks → `test:canonical`
  6.0s → `test:principles` 18.24s → `test:ir` 0.17s → `test:backends` 2.26s →
  `test:composition` 0.26s → trailing gates. Wall ≈ 45–50s by log timestamps
  (01:07:55 → ~01:08:40) on this host.
- Standalone probe at the frozen tree: 42.26s real, **exit 1 at `test:backends`**
  — `capability-matrix.test.ts:190`: checked-in live-fired evidence claims
  rustc 1.96.1 while this host resolves rustc 1.98.1. This is an environment
  freshness failure (toolchain drift), not an intended assertion failure, and it
  is recorded as such per spec §2; evidence regeneration is out of S0 scope.
  Consequence: the full chain is **not** usable as an exit-0 workload lane on
  this host at the frozen tree; the four lanes above are the exit-0 set.
- Repetitions observed: five separate npm/vitest invocations (canonical,
  principles, ir, backends, composition) each pay process startup + transform
  (principles: 18.24s wall vs 77.7s cpu across workers); principles suite is
  also run again by the CI `Principles as meta-tests` job — cross-channel
  repetition, queued time counted separately below.
- Child-process profile: 5 npm → vitest/node masters + worker pools, plus
  citation/skill-drift bash sections; exact per-test spawn counts deferred to S3
  measurement (baseline records the invocation structure above).

### 4.3 CI critical path (PR #2085 run, 2026-10-07/08)

Completed-job durations (gh api, this PR's check run): Principles as meta-tests
548s; Windows getff-dist consumer-matrix cell 595s; fresh-install validate smoke
react-spa 403s; ships-manifest 180s; mechanical checks 246s; docs quality 83s.
install-sh shards A/B/C: 32m4s / 50m32s / 25m30s, all pass (run 37694252877 — shard B
is the single longest CI job on an ordinary PR at this tree). Queued time excluded (separate
per spec §8). CI critical path is dominated by Principles + install-sh shards +
Windows consumer cell; these are CI-side facts for S3, not local-substitutable.

## 5. Environment issues (unresolved, evidence retained)

1. **Local rustc drift** — `test:backends` cargo capability-matrix freshness RED
   locally (evidence 1.96.1 vs host 1.98.1). Environment class, not a product
   defect; blocks a green full-chain local run at the frozen tree.
2. **SDK env leak class** — `CLAUDE_CODE_ENTRYPOINT=sdk-cli` leaks from
   Claude-Code-hosted sessions into fixture subprocesses; all frozen argv carry
   the scrub (same class as base fix 7047304220).
3. **AIF runtime** — PROBE-INCOMPLETE preserved (host transport to the PC stack
   down: ssh pre-banner close, docker contexts error, gate :5180 timeout);
   execution stayed local per kickoff allowance; no AIF task launched.

## 6. Self-application note (T15)

This baseline was produced by running the mechanisms it characterizes (every
inventory row is a live exit code, not a claim) and by proving the two
zero-detection classes with executed scratch probes rather than assertions about
them. The frozen outer oracle for S1 is the spec's Q-table itself; this document
deliberately makes no claims about suites it did not run (§2 scope column).
