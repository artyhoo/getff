# Pre-merge carrier — design spec (S0)

> **Status:** design spec — S0 (only stage) of the `pre-merge-carrier` umbrella; the build
> umbrella is declared by §g below.
> **Date:** 2026-08-18.
> **Authoritative for:** the pre-merge-carrier design — carrier shape (§a), cross-stack
> interlock inventory (§b), delivery channel (§c), #1465 riders (§d), honest-framing
> contract (§e), promotion-trigger instrumentation (§f), build-stage decomposition (§g),
> falsifiers + promotion/retirement (§h), open forks (§i).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> Ratified constraints — [.claude/orchestrator-prompts/pre-merge-carrier/kickoff.md §2](../../../.claude/orchestrator-prompts/pre-merge-carrier/kickoff.md)
> (echoed here as pointers, never re-derived). Build-vs-reuse verdicts —
> [prior-art-evaluations.md #259-#263](../../meta-factory/prior-art-evaluations.md).

> **Origin:** [#1466](https://github.com/artyhoo/getff/issues/1466) (ratified decision,
> 2026-08-18) + [#1465](https://github.com/artyhoo/getff/issues/1465) (the Actions quota
> wall). Rigor label: `research-grade` (consumer-shipped surface).

## §0 Scope and ratified inputs

One line: reproduce what Actions actually tests — `refs/pull/N/merge`, the **base merged
into the head** — in a throwaway worktree on the consumer's machine, and run the _same_
validate there, as the normal inner loop, with CI kept as the unbypassable backstop.

Binding constraints (kickoff §2, ratified — pointers only): gate the MERGE RESULT, never
the head alone; CI stays the unbypassable backstop; opt-in first; #1465 parts 1-2 land in
the same change as the opt-in carrier ship; shipped-axis agnosticism (no Turbo/pnpm/Postgres
assumptions imported from the reference implementation); no paid LLM anywhere in the
mechanism (trivially satisfied: the whole design is deterministic bash + git plumbing).

## §1 Prior-art consult (spent first, per EXECUTION-PLAN §5.5 Step 1.5)

Full verdicts live in the SSOT; this table is the pointer map. Consult evidence:
DeepWiki ×2 (`git/git`, `nektos/act`), WebSearch ×3 phrasings (merge-queue mechanics +
availability; act merge behaviour; local merge-result gating tools), context7
(`/nektos/act` resolve + query), SSOT read (#176, #241 surfaced as own-register precedent).

| Candidate                        | Verdict                                                                                                                                       | SSOT                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `git merge-tree --write-tree`    | DEFER — computes the merge without a worktree, but the validate run needs a materialized tree; one worktree-merge step yields both            | [#259](../../meta-factory/prior-art-evaluations.md) |
| GitHub merge queue               | REJECT — same defect class, hosted; unavailable on Free/Team private repos (exactly the #1465 population) and spends the same Actions minutes | [#260](../../meta-factory/prior-art-evaluations.md) |
| `nektos/act`-class local runners | REJECT — replicates the runner, not the merge (`refs/pull/N/merge` simulated in context only, issue #974); hard Docker dep                    | [#261](../../meta-factory/prior-art-evaluations.md) |
| jjq (local merge queue for jj)   | DEFER — closest problem-class match; jj-only and owns the landing                                                                             | [#262](../../meta-factory/prior-art-evaluations.md) |
| timeliner `pre-merge-local.sh`   | ADAPT — mechanism transfers; the six interlocks are timeliner-specific and are re-derived per lane in §b                                      | [#263](../../meta-factory/prior-art-evaluations.md) |

**Own-stack sweep** (build-first-reuse-default.md §1.1 criterion zero), measured:

- `.husky/pre-push` + shipped twin [`packages/core/templates/shared/husky-pre-push.sh`](../../../packages/core/templates/shared/husky-pre-push.sh)
  — gate the **head** tree at push time (the dispatcher execs `pre-push.ts` on the working
  repo; no merge construction anywhere in the chain). Wrong trigger point too: the
  merge-result question is asked against a _moving base_, which pre-push cannot re-ask
  after the push.
- [`scripts/run-local-ci-sweep.sh`](../../../scripts/run-local-ci-sweep.sh) (SSOT #176) —
  framework-repo-only local gate aggregator, diff-aware **vs merge-base**
  (`run-local-ci-sweep.sh:238`), running on the working tree — again the head, not the
  merge result. Its `gate_table()` + coverage-test pattern
  (`run-local-ci-sweep-coverage.test.sh`) is REUSED as the shape for the carrier's
  vacuity/coverage self-test (§a.6), not as the carrier itself.
- No shipped surface reads GitHub checks at all (measured §d) — so no own-stack waiter
  exists to teach the #1465 third state to.

Conclusion: no production tool or own-stack surface gates the merge result locally for a
consumer repo. Verdict for the carrier core: **BUILD (thin, bash)**, adapting #263.

## §a Carrier shape (deliverable 2a)

### a.1 Merge-result construction: throwaway worktree + real merge

Chosen: `git worktree add --detach <tmp> <head-sha>` + `git merge --no-ff --no-edit
<base-sha>` inside it — the reference mechanism (`pre-merge-local.sh:76-84`). Rejected
alternative: `git merge-tree --write-tree` (SSOT #259) — it computes the same tree without
a worktree, but every lane's validate needs a real filesystem (`npm ci`, pytest, `cargo
clippy` builds), so the tree must be materialized anyway; the worktree merge produces the
merge commit AND the runnable checkout in one step, and its conflict exit is the same
signal merge-tree would give.

### a.2 The three-sha report is a hard output contract (T-PMC-B counter)

Every terminal verdict — PASS, FAIL, CONFLICT, CANNOT-RUN, VACUITY (the full §a.3 exit
set) — MUST name three shas: `head`, `base`, `merge` (or `merge: CONFLICT`), and every one
of them appends its §f ledger line. A verdict without all three is malformed by
contract; the build stage ships a self-test that runs the carrier on a fixture repo and
greps the verdict block for all three labels. The verified sha is the **merge** sha; any
draft where the verified sha equals the head sha while the branch is behind base has
re-created the #1466 defect and is a wrong answer, not a variant (kickoff §2).

### a.3 Exit-code contract (merge conflict is a distinct outcome — #1465 trap 6)

| Exit | Meaning                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 0    | PASS — all derived gates reported, on the merge result                                                                             |
| 1    | FAIL — a gate went red on the merge result                                                                                         |
| 2    | MERGE CONFLICT — distinct outcome, not a gate failure; also the state where GitHub silently runs no `pull_request` workflow at all |
| 3    | CANNOT-RUN — a required tool/pin is absent on this host (named in output); never silently skipped                                  |
| 90   | VACUITY — exit code said pass but a declared gate never reported (reference `pre-merge-local.sh:146`)                              |

### a.4 «Same validate, not a subset» — per-lane derivation, not a hard-coded list

The gate list is **derived from the consumer's own wired surfaces** at run time, never
restated inside the carrier (the restated copy is the drifting copy — the SSOT #176
coverage-gate lesson):

- **ts-server lane:** run `npm run validate` — the aggregate the install itself wires into
  the consumer's `package.json` ([`setup.d/70-deps.sh:95`](../../../setup.d/70-deps.sh):
  `npm-run-all2 --parallel typecheck lint format:check arch:check audit:docs check:globs
check:enforced check:arch-boundaries check:lintstaged check:fences-fire check:shields-up
test`). Vacuity control parses that script entry and asserts every named gate reported
  in the log (§b row 1 explains the npm-run-all2 difference from timeliner's
  `--continue-on-error`).
- **python / go / cargo lanes:** the getff-namespaced workflow IS the wired surface
  (`getff-python.yml` / `getff-go.yml` / `getff-cargo.yml`); the carrier runs the same
  commands those workflows run (`ast-grep scan`; `ruff check .` + isolated `--config
.getff/ruff-bans.toml --no-cache`; `golangci-lint run --enable forbidigo …`;
  `cargo clippy --all-targets -- -D clippy::disallowed_*`), with the same pins checked
  (§b) — a pin mismatch on the host is CANNOT-RUN (exit 3) with the pin named, never a
  silent run under a different version.
- **UI preset lanes (react-next / react-spa / react-native):** `npm run validate` is wired
  for these stacks by the same `setup.d/70-deps.sh:95` entry; the delivered `ci.yml`
  additionally requires browser-dependent jobs per preset (§b.1 UI row — storybook, e2e,
  build). The carrier runs `npm run validate` + `npm run build` where required, and names
  the browser-dependent legs NOT COVERED when playwright browsers are absent on the host
  (§i F3 governs the policy — never a silent drop).
- CI legs the carrier cannot reproduce locally are **named as NOT COVERED** in every
  verdict (§e) — dropping them silently would make «same validate» a subset by omission.

### a.5 Preflight

`git fetch origin` (base freshness), resolve head/base refs or die, `merge-base
--is-ancestor` probe (§i F2 governs the already-contains-base case), atomic `mkdir` lock
via `git rev-parse --git-path` (worktree-safe — never hand-built `.git/` paths).

### a.6 Self-tests shipped with the carrier (build stage B1)

Fixture-repo tests in the framework repo: (1) verdict block carries three shas on every
outcome; (2) a seeded failing gate → exit 1; (3) a seeded conflict → exit 2, distinct
message; (4) vacuity: a gate name removed from the log → exit 90 (the reference proved
this live by deleting two gates from a real log, #1466 item 1); (5) PASS log retained
outside the throwaway worktree (#1466 item 2). Shape reuse: `meta-all-wired.test.sh` /
`run-local-ci-sweep-coverage.test.sh` real-tree grep + seeded non-vacuity leg (SSOT #176).

## §b Cross-stack interlock inventory (deliverable 2b — measured, not estimated)

The six false-verdict traps from #1466 were found on **one** consumer (timeliner: Turbo,
pnpm, shared Postgres). Measured against the **seven** shipped lanes (T-PMC-A: probe,
don't extrapolate). Template roots — the kickoff's «two template roots» note undercounts,
measured: (1) ts-server under [`templates/ts-server/`](../../../templates/ts-server/github-actions-ci.yml);
(2) python/go/cargo under [`packages/core/templates/<lane>/github-actions-ci.yml`](../../../packages/core/templates/python/github-actions-ci.yml);
(3) **three UI preset lanes** — react-next / react-spa / react-native — each shipping a
`github-actions-ci-ui.yml` under `packages/preset-*/templates/`, delivered to the consumer
as `.github/workflows/ci.yml` via `deliver_getff_workflow` at
[`setup.d/40-configs.sh:399/414/437`](../../../setup.d/40-configs.sh).
(`packages/core/templates/react-next/` carries no CI template — measured 2026-08-18,
`find … -type f` → 2 files, both `.storybook/` config; a bare `ls` reads as empty there and
must not be trusted. The census is `find . -name "github-actions-ci*.yml"` → exactly 7
templates repo-wide, which is the lane count this section inventories; the live react-next
lane lives in `packages/preset-next-15-canonical/`.)

**Shared-resource measurement, all seven lanes:** `grep -in "postgres\|services:\|database\|docker"`
across the four stack CI templates and `grep -in "postgres\|services:\|database\|docker\|turbo\|pnpm"`
across the three UI templates → **0 hits** (2026-08-18). No shipped lane provisions a
database or any service container. `grep turbo` in the wired validate
(`setup.d/70-deps.sh:95`) → 0 hits. All npm-based lanes use `npm ci --prefer-offline` in
every CI job — not pnpm.

### b.1 Per-lane inventory

| Lane                                                   | Gate surface (measured)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Cache/shared-resource interlocks needed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Timeliner-trap analogue                                                                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ts-server**                                          | `npm run validate` (12 gates via npm-run-all2, `70-deps.sh:95`); CI-required set additionally: `security` (npm audit + gitleaks action), codecov upload inside `test` ([`github-actions-ci.yml:218-233`](../../../templates/ts-server/github-actions-ci.yml) `ci-success.needs`)                                                                                                                                                                                                                               | Fresh `npm ci` in the throwaway worktree (npm's store is content-addressed — no stale-verdict path measured); **no task-runner cache exists** (npm-run-all2 caches nothing, unlike Turbo); no DB. Vacuity shape differs from timeliner: npm-run-all2 `--parallel` (no `--continue-on-error`) stops the set on first failure, so the vacuity check asserts «every gate name reported OR the failing gate is named», not «all N always present»                                                                                                                                                                                                    | Trap 3 (Turbo cache): **no analogue, measured**. Trap 4 (shared DB): **no analogue, measured**. Traps 1/2/5/6: universal, carried (§b.2)                                                         |
| **python**                                             | `ast-grep scan` (pin `@ast-grep/cli@0.44.1`) + `ruff check .` + `ruff check . --config .getff/ruff-bans.toml --no-cache` ([`getff-python.yml:34-82`](../../../packages/core/templates/python/github-actions-ci.yml))                                                                                                                                                                                                                                                                                           | Stateless tools; step 2 already runs `--no-cache`; carrier adds `--no-cache` to step 1 as well (ruff's cache is content-keyed but forcing is the honest setting for a verdict-re-deriving gate — same argument as TURBO_FORCE, at zero cost). Host pins checked before run: version mismatch → CANNOT-RUN                                                                                                                                                                                                                                                                                                                                        | Traps 3/4: no analogue (no task-runner, no DB). Traps 1/2/5/6: carried                                                                                                                           |
| **go**                                                 | `golangci-lint run --enable forbidigo --config <resolved>` (pins: go `1.22.0`, golangci-lint `v1.55.2`, [`getff-go.yml:45-68`](../../../packages/core/templates/go/github-actions-ci.yml))                                                                                                                                                                                                                                                                                                                     | Go build cache is content-addressed (safe by construction). golangci-lint keeps its own analysis cache — staleness behaviour NOT measured here (`INCONCLUSIVE-needs-verification`, build stage B2 must verify); conservative prescription regardless: `GOLANGCI_LINT_CACHE=<throwaway>` so every carrier run starts cold — deterministic-safe without claiming the cache is broken                                                                                                                                                                                                                                                               | Trap 3: _possible_ analogue (lint cache), closed conservatively; trap 4: no analogue                                                                                                             |
| **cargo**                                              | `cargo clippy --all-targets -- -D clippy::disallowed_methods -D …_types -D …_macros` ([`getff-cargo.yml:47-48`](../../../packages/core/templates/cargo/github-actions-ci.yml); consumer's own toolchain, deliberately unpinned per the template header)                                                                                                                                                                                                                                                        | `target/` is per-worktree by default → cold build in the throwaway worktree (cost, not falseness). A consumer-set shared `CARGO_TARGET_DIR` or sccache WOULD reintroduce trap 3 → carrier unsets `CARGO_TARGET_DIR` and `RUSTC_WRAPPER` for its run (cheap, conservative)                                                                                                                                                                                                                                                                                                                                                                        | Trap 3: analogue only under consumer-set env, closed by unsetting; trap 4: no analogue                                                                                                           |
| **UI presets** (react-next / react-spa / react-native) | `npm run validate` is wired for these stacks too (`setup.d/70-deps.sh:95` runs for every STACK, react-next tweaks at `:102`); CI-required sets differ per preset (`ci-success.needs`, measured 2026-08-18): react-next = lint, typecheck, architecture, test-unit, **test-storybook, test-e2e, build**, security, audit-ai-docs (`github-actions-ci-ui.yml:284-293`); react-spa = same minus test-storybook (`:234-242`); react-native = lint, typecheck, test-unit, security, audit-ai-docs only (`:110-115`) | All npm; no DB, no Turbo, no pnpm (0-hit grep above). NEW interlocks the stack lanes lack: (a) **fixed TCP ports** — test-storybook serves `storybook-static` on port 6006 (`npx http-server … --port 6006`, react-next `:155-157`) and e2e starts a web server — two concurrent carrier runs contend → covered by the mkdir lock; (b) **playwright browsers** — `npx playwright install --with-deps` in CI (`:151`, `:175`) assumes root/CI; on a host, absent browsers → the browser-dependent legs are NOT COVERED (or installed once, consumer's call — §i F3); (c) `build` output (`.next/`/`dist/`) is per-worktree — safe by construction | Trap 3: no analogue (npm-run-all2 + per-worktree build outputs). Trap 4: no DB analogue, but the port-contention interlock is the same _shape_ — closed by the same lock. Traps 1/2/5/6: carried |

### b.2 The six traps, generalised

| #   | Timeliner trap (#1466)                                              | Shipped-carrier form                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Vacuity control (`--continue-on-error` hides never-started gates)   | Universal, per-lane derivation (§a.4): assert every derived gate reported in the log; exit 90 otherwise                                                                                                                                                                  |
| 2   | Keep logs on PASS                                                   | Universal: logs live outside the throwaway worktree, keyed by merge sha                                                                                                                                                                                                  |
| 3   | Force the task-runner cache (`TURBO_FORCE=1`)                       | **Not imported.** No shipped lane has Turbo (measured). Per-lane equivalents where a cache exists: ruff `--no-cache`, `GOLANGCI_LINT_CACHE` isolation, `CARGO_TARGET_DIR`/`RUSTC_WRAPPER` unset. The carrier must NOT export lane-foreign env (shipped-axis agnosticism) |
| 4   | Shared-Postgres interlock                                           | **Not imported as a DB lock** — zero shipped lanes have a DB (measured). The atomic `mkdir` lock IS kept, lane-independent, because two concurrent carrier runs still contend (log dirs, package caches' cold/warm skew) and the lock costs one syscall                  |
| 5   | No pipe around the gate command (`cmd \| tee` reports tee's status) | Universal bash discipline — the carrier captures `RC` explicitly (`set +e` around the gate run only), never pipes the gate command through `tee`/`tail`                                                                                                                  |
| 6   | Merge conflict = distinct outcome                                   | Universal: exit 2 (§a.3), with the «GitHub runs no pull_request workflow at all in this state» warning in the message (the waiter-bogus-green trap)                                                                                                                      |

## §c Delivery channel (deliverable 2c — measured)

**Measured precedents:**

- Gate scripts ship from `packages/core/audit-self/*.sh` → consumer `scripts/` via
  `copy_safe` in [`setup.d/40-configs.sh:14-52`](../../../setup.d/40-configs.sh)
  (audit-ai-docs.sh, check-rule-globs.sh, check-fences-fire.sh — all `copy_safe` + `chmod_safe +x`).
- Worktree helper scripts ship verbatim from framework `scripts/` → consumer `scripts/`
  via `copy_safe` in [`setup.d/85-worktree-scripts.sh:83`](../../../setup.d/85-worktree-scripts.sh),
  profile-gated env+.
- Evolving lane payloads use the `_copy_or_refresh` wrapper (copy_safe on fresh install,
  `refresh_safe` under `GETFF_TOOLCHAIN_REFRESH=1`, honouring a sibling `<dst>.override.md`
  Layer-3 escape — [`setup.d/45-python.sh:67-75`](../../../setup.d/45-python.sh),
  [`setup.d/47-go.sh:57-62`](../../../setup.d/47-go.sh)).

**Design:**

- **Framework home:** `packages/core/audit-self/pre-merge-local.sh` (precedent 1's home
  for shipped consumer gate scripts). Consumer destination: `scripts/pre-merge-local.sh`
  (same name as the reference implementation — cross-repo familiarity).
- **Section:** `setup.d/40-configs.sh` (sibling of the other shipped gate scripts; its
  `Depends on: scripts/ already created` precondition is already satisfied there).
- **Ownership mode:** the `_copy_or_refresh` pattern (precedent 3), NOT bare `copy_safe` —
  the carrier is an evolving gate script (interlock inventory will grow, §h β watches it),
  and bare copy_safe would strand brownfield consumers on v1 forever; the `.override.md`
  escape preserves consumer Layer-3 ownership. *(Superseded 2026-08-18 on the concrete
  form: the named helper is lane-scoped machinery that cannot execute in `40-configs.sh` —
  `--refresh` exits before the layer loop. The build kickoff's §3 «Delivery mechanism»
  constraint ratifies the working equivalent — install-time `copy_safe` + `do_refresh`
  pair-list entries via `refresh_safe`, which honours `.override.md` — preserving this
  bullet's intent: brownfield refresh delivery + Layer-3 escape.)*
- **Profile depth:** ship at **all profiles** (core included) — recommendation, §i F1. The
  script is a standalone leaf (no companion deps beyond git + the lane's own toolchain),
  and core consumers hit the #1465 wall identically.
- **Opt-in semantics:** delivery = the file lands in `scripts/`; nothing wires it into
  hooks, CI, or `validate`. Opt-in is «the consumer runs it». Default-on promotion (§f) is
  a later, trigger-gated change (kickoff §2 — the design prepares it, must not ship it).

## §d The #1465 riders (deliverable 2d)

**Measured absence:** no shipped surface reads GitHub checks at all —
`grep -rln "gh pr checks\|statusCheckRollup\|check-runs\|checkSuites"` over
`packages/core/templates/ setup.d/ scripts/ packages/runtime-bridge/src/` → **0 files**
(2026-08-18). The operator-machine `~/.claude/scripts/ci-wait.sh` is host-global and not a
repo artifact; `packages/runtime-bridge/src/cli/await.ts` waits on aif tasks, not CI. So
#1465 part 1 («teach the waiter») has **no existing shipped waiter to teach** — the third
state needs a landing site shipped with the carrier.

**Part 1 — waiter third state (`CI UNAVAILABLE`), lands in B1 (same change, ratified):**
ship a sibling classifier `packages/core/audit-self/ci-available-probe.sh` → consumer
`scripts/ci-available-probe.sh` (same §c channel). Contract: input = a sha (or PR number);
reads check-runs via `gh api`; classifies GREEN / RED / PENDING / **`CI UNAVAILABLE
(Actions quota/billing)`**. The UNAVAILABLE signature is the #1465 one verbatim: every
first-party check-run concluded `failure` with **zero executed steps** and **sub-5 s
duration** (~2 s observed), while third-party app checks stay green; on signature match it
fetches the check-run annotation (`…/check-runs/<id>/annotations`) and reports the true
cause. Environment ≠ verdict: UNAVAILABLE is a distinct exit code, never RED. Degrades
explicitly when `gh` is absent (CANNOT-RUN, named) — no hard dependency (shipped-axis).

Resolved design choice, stated rather than silently made (the kickoff conditioned the
waiter half on «where a shipped waiter surface exists», and none does): the third state
lands as the NEW probe script above, not as a docs-only recipe. Rationale: the ratified
record requires part 1 to land in the same change as the carrier (so it cannot be parked
as a DECISION-NEEDED fork), and a docs-only recipe would be `#warning-nobody-reads`-class
(attention as the detection layer) where a ~40-LOC deterministic classifier is available
at the same cost class as the carrier itself.

**Part 2 — the install-docs line, lands in B1 (same change, ratified):** one line each in
the consumer-facing surfaces measured to exist:
[`packages/core/templates/shared/AI-USAGE-GUIDE.md`](../../../packages/core/templates/shared/AI-USAGE-GUIDE.md)
(shipped) and [`INSTALL-FOR-AI.md`](../../../INSTALL-FOR-AI.md) (repo-root install doc):
on GitHub Free, **private** repos share 2 000 Actions minutes/month per **account** (not
per repo — moving to a new private repo does not help); public repos are unlimited; when
the pool is exhausted every first-party job dies in ~2 s reporting `failure`, and
`scripts/ci-available-probe.sh` names that state instead of debugging phantom gate reds.

## §e Honest-framing contract (deliverable 2e)

Ships as fixed strings in the carrier, asserted by the B1 self-tests (a contract, not a
style suggestion — #1466 «The framing that should ship with it»):

1. PASS output says **«LOCAL PRE-MERGE PASS»** and includes the sentence that it is a
   _local pre-merge run_, weaker evidence than CI (bypassable; dirty host), to be cited
   with the three shas — **never** the words «CI green».
2. Every verdict block includes the three shas (§a.2) and the **NOT COVERED list** — CI
   legs the carrier did not reproduce, named explicitly. For ts-server, measured today:
   `gitleaks` (binary not assumed on host; run opportunistically if `command -v gitleaks`),
   codecov upload (reporting service), `mutation` (PR-only job, NOT in `ci-success.needs`
   — [`github-actions-ci.yml:221`](../../../templates/ts-server/github-actions-ci.yml) —
   so its omission does not weaken the required set; still named). §i F3 governs policy.
3. The CONFLICT message states that GitHub runs no `pull_request` workflow at all in this
   state (a waiter sees bogus green) — the #1465 trap 6 wording.
4. The PR-body citation block the carrier prints on PASS is copy-paste-ready and labelled
   «local pre-merge run» — feeding §f's observability without any telemetry.

## §f Promotion-trigger instrumentation (deliverable 2f)

Ratified trigger: promotion to default on the **first live catch** (real merge conflict or
genuinely failing gate) on a consumer other than `timeliner`. Making it observable rather
than anecdotal, without telemetry (none exists in this stack, and phone-home would be new
capability + a consent surface — out of scope by design):

1. **Per-clone run ledger.** Every terminal verdict appends one NDJSON line to
   `$(git rev-parse --git-path getff/pre-merge-runs.ndjson)` — inside the git dir, so it is
   per-clone, never committed, and worktree-safe by the same `--git-path` discipline the
   lock uses. Fields: `ts`, `remote` (origin URL), `head`, `base`, `merge`, `verdict`,
   `failed_gates`, `duration_s`.
2. **A live catch is a ledger line**, `verdict ∈ {FAIL, CONFLICT}` on a remote ≠ timeliner
   — replayable evidence (the three shas let anyone re-run the exact merge), not an
   anecdote. The PASS/FAIL PR-body block (§e.4) is the surfacing channel: a consumer citing
   a FAIL→fix→PASS sequence in a PR body IS the observable event.
3. **Recording the fire:** the framework side records the first such catch in the SSOT
   (#263 trigger column) + the build-umbrella `done.md`, quoting the ledger line. The
   promotion itself is stage B3 (§g) — trigger-gated, never scheduled by calendar.
4. **Honest limit, stated:** with zero telemetry the trigger fires only when a consumer
   (or the operator running a consumer repo) surfaces the ledger evidence. The ledger makes
   the evidence _verifiable_; it cannot make it _automatic_. Falsifier α (§h) covers the
   «nobody runs it at all» branch.

## §g Build-stage decomposition (deliverable 2g)

The follow-on build umbrella, with a real `Depends on` column (frontier.sh contract):

| Stage | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Depends on                             | Volume |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------ |
| B1    | **Opt-in carrier ship, ts-server lane + both #1465 riders in ONE change** (ratified — not later stages, not behind a fork): `packages/core/audit-self/pre-merge-local.sh` (worktree merge, three-sha contract, exit-code table, ts-lane derivation + vacuity, mkdir lock, NDJSON ledger, honest-framing strings) + `ci-available-probe.sh` (#1465 part 1) + the two docs lines (#1465 part 2) + `setup.d/40-configs.sh` delivery via `_copy_or_refresh` + fixture self-tests (§a.6) + snapshot regen (`SNAPSHOT_MODE=capture`) | — (admitted by S0 merge + Phase -1 GO) | M      |
| B2    | python/go/cargo + UI preset lane runners: per-lane gate derivation + pin checks (CANNOT-RUN on mismatch), the §b.1 cache isolations, golangci-lint cache-staleness verification (the B2 `INCONCLUSIVE` from §b.1), the UI browser-dependent-leg policy per the §i F3 decision, lane self-tests                                                                                                                                                                                                                                 | B1                                     | M      |
| B3    | Promotion-to-default decision: fires on the recorded §f trigger (first live catch, non-timeliner) OR on falsifier α (usage ≈ zero) — a decision stage with an operator fork, not a scheduled build                                                                                                                                                                                                                                                                                                                             | B1 (trigger-gated)                     | S      |

Capability-commit note: B1/B2 add ≥80-LOC files under `packages/` → `Prior-art:` trailers
citing #259-#263 (this consult is what they cite — CLAUDE.md per-commit gate).

## §h Falsifiers + promotion/retirement (deliverable 3 — carried verbatim from kickoff §1 row 3)

- **(α)** opt-in usage ≈ zero (precedent: WorktreeCreate hook shipped unregistered for all,
  incident 2026-07-23 in [CLAUDE.md](../../../CLAUDE.md)) → force default or drop
- **(β)** second-stack interlock generalisation costs more than the channel is worth →
  stay opt-in permanently

How each is checked: α against the §f ledger + the absence of any PR-body citation blocks
across consumer repos N weeks after B1 ships (N is a B3 config, not statute — peer:
effort-worthiness.md L4 «numbers are config»); β against B2's actual cost — if the lane
generalisation stage exceeds its round budget on interlocks that protect no measured
resource, β has fired and B2 contracts to «ship the ts-server carrier only».

Promotion: B3 on the recorded trigger. Retirement: falsifier α confirmed after a genuine
default-or-drop decision → remove the delivery lines and the SSOT rows gain a
retirement note (append, not rewrite).

## §i Open forks — DECISION-NEEDED (never silently resolved)

- **F1 (delivery depth):** ship at all profiles (recommended — standalone leaf; core
  consumers hit the same wall) vs env+ only (precedent: 85-worktree-scripts is env+).
  Option A (all) → one more file in minimal installs. Option B (env+) → core consumers
  keep zero local carrier exactly where CI minutes are scarcest.
- **F2 (head-already-contains-base):** the reference dies («a run here would prove
  nothing», `pre-merge-local.sh:72-74` — correct for its fallback-carrier role). For an
  inner-loop carrier the merge result _equals the head tree by construction_ in this case.
  Option A (recommended): proceed, report `merge = head (base already contained)` — the
  three-sha contract stays intact and the inner loop still gates the real thing. Option B:
  die like the reference — forces a fresh base merge first, at the cost of inner-loop
  friction on every up-to-date branch.
- **F3 (NOT-COVERED policy):** report-only (recommended: named gaps per §e.2, run
  opportunistic legs when binaries exist) vs hard-require (CANNOT-RUN when e.g. gitleaks
  is absent — stricter, but adds host requirements the shipped axis forbids assuming).

## §j Self-application + trap disposition (T15)

This spec's own discipline: the consult ran before any design prose (T11/T12 — §1 is
deliverable 1 and was spent first); every lane claim in §b carries a command or file:line
(T3); the one unverifiable cache claim is marked `INCONCLUSIVE-needs-verification` and
routed to B2 rather than asserted (T3/T14); the interlock set was measured per lane, not
extrapolated (T-PMC-A — the measured result is that traps 3 and 4 do NOT transfer as-is
to any of the seven lanes); the verified sha is pinned to the merge result by a testable
output contract (T-PMC-B); the lane inventory is kept in-file at full resolution and the
file stays under the 600-line wall (T-PMC-C — checked with `wc -l`, no split needed); the
cold adversarial re-read of the diff ran before handoff (T19 — round 1 returned REVISE
with two MAJORs: the UI-preset lane population gap in §b, and a whole-file SSOT reformat
that violated append-only; both fixed, the fix recorded in the PR).

## See also

- [.claude/orchestrator-prompts/pre-merge-carrier/kickoff.md](../../../.claude/orchestrator-prompts/pre-merge-carrier/kickoff.md) — binding umbrella kickoff (§2 ratified constraints).
- [prior-art-evaluations.md #259-#263](../../meta-factory/prior-art-evaluations.md) — the consult this spec is built on.
- [#1466](https://github.com/artyhoo/getff/issues/1466) / [#1465](https://github.com/artyhoo/getff/issues/1465) — evidence base.
- `scripts/pre-merge-local.sh` @ [artyhoo/timeliner PR #229](https://github.com/artyhoo/timeliner/pull/229) — reference implementation (read, not vendored — SSOT #263).
