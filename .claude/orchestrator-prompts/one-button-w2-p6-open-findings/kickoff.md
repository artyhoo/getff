# one-button second wave — the open findings of the P6 cold run (F7, F9, F10; F11 parked)

> **Type:** I-phase, execution-build, single stage — ONE PR against `staging`.
> **Base branch:** `staging`. **Branch:** `fix/one-button-w2-p6-open-findings`.
> **PR title:** `fix(install): P6 cold-run findings F7 F9 F10 — no unused runtime dependency, no reorder of the project's package.json, no silent --legacy-peer-deps`.
> **Channel:** one aif task (own worktree, harvested from the host) or one host session; verified on the
> host by an Opus session (operator log entry 36 — a proposal, not an order).
> **Rigor label (L0):** `build-and-verify` — each finding changes what the install writes into a
> person's `package.json` / lockfile.
> **Authoritative for:** this stage's contract — the three findings in scope, their evidence, acceptance,
> falsifiers; the reason F11 is not in scope.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the P6 cold-run report itself (coordination store `_p6-cold-run-report-2026-09-30.md`, quoted below
> because the container cannot read it).

## §0 Dispatch gate — second wave, after the landing

The handoff: «Still second wave: F7, F9, F10, F11» (P6 row: run 4 ACCEPTED WITH FINDINGS, no blocker). The
findings were measured on the one-button union, not yet on `staging` at authoring time (2026-09-30,
`origin/staging` `2855667cb34`). Check at click time:

```bash
git fetch origin staging
git cat-file -e origin/staging:setup.d/ships.manifest \
  && git cat-file -e origin/staging:packages/core/audit-self/run-armed.sh \
  && echo "union landed — dispatchable"
```

Then `SLUG=one-button-w2-p6-open-findings bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
(`.claude/skills/dispatcher/SKILL.md` §2.0).

**Measurement SHA:** `808e806c606` (head of `join/one-button-union`, round 6); re-locate by content after
the landing. The P6 runs used a fresh `create-vite` react-ts project with oxlint (entry 26 point 11).

## §1 The findings, with the report's evidence lines (verbatim)

From the findings table of `_p6-cold-run-report-2026-09-30.md` (run 1, §11) and the run-3 re-check table («13. Status of earlier findings»). Run 4
(`808e806c606`) re-observed only F10; it lists «Items from run 3 not re-checked … F7, F9, F11», so F7
and F9 were last measured in run 3:

- **F7** — «getff adds an unused runtime dependency (`zod` in `dependencies`) and 2 moderate
  vulnerabilities (`@stryker-mutator/core → typed-rest-client → qs`); the scaffold had 0» — evidence «key
  diff; `grep -rln zod src` rc 1; `npm audit --json` (`logs/npm-audit.json`)». Run 3: «**STILL THERE** |
  `grep -rln zod src` rc 1; `npm audit` moderate 2».
  Code: `setup.d/70-deps.sh:475` `CORE_RUNTIME_DEPS=( zod@^3.24.0 )`, unconditional; its reason is
  `:465-474` (R2 `no-unsafe-zod-parse` assumes boundary code imports zod; dependency-cruiser's
  `no-non-package-json` fired on an undeclared zod). Stryker: `70-deps.sh:373`
  `@stryker-mutator/core@^9.6.1`.
- **F9** — «Shipped lint-staged runs `sort-package-json`, re-ordering the project's own package.json keys
  on the first commit (values unchanged)» — evidence «`.lintstagedrc.json`; `diff` of package.json around
  the install commit; deep-equal `true`». Run 3: «**STILL THERE** (by config) | `.lintstagedrc.json:14`».
  Code: `packages/core/templates/shared/.lintstagedrc.json:13` `"package.json": ["sort-package-json"]`;
  the devDependency is added at `setup.d/70-deps.sh:321` / `:375`.
- **F10** — «npm resolver crash `edgesOut` (npm/cli#9787) on the devDep batch, 2/2 runs, recovered only by
  `--legacy-peer-deps` (which silences peer checks)» — evidence «`install.log:170-172`;
  `rerun-install.log:170-172`». Run 3: «**STILL THERE** | 1 hit in `install.log`; recovered by
  `--legacy-peer-deps`»; run 4 again: «F10 is still there: 1 `edgesOut` crash in `install.log`».
  Code: `setup.d/70-deps.sh:151-155` — on `TypeError` / «Cannot read properties of
  null» the whole batch is re-run with `--legacy-peer-deps` and treated as success.
- **F11** — «`npm test` still prints the Vitest 4 `poolOptions` removal notice (K2)» — evidence
  «`logs/my-test.log`»; the report's own owner column: «outside the parts (K2, design session)». Code:
  `test.poolOptions` in `packages/preset-react-spa/templates/vitest.config.ts:95`,
  `packages/preset-next-15-canonical/templates/vitest.config.ts:98`, `templates/ts-server/vitest.config.ts:62`.
  **NOT in scope** — see §2.

## §2 Decisions this stage respects

- **Entry 28, fork 1 = A** — the log's reading: «the project's setup wins — the project's versions and
  settings are not changed; what was green before the install stays green … violations in existing code
  go to the report». F9 (a reorder of the project's own keys) and F10 (peer checks silenced for the whole
  batch, the project's packages included) are read against this.
- **Entry 28, fork 2 = B** — no version pins; versions recorded. No fix here may add a pin or an
  `overrides` entry the project did not have without saying so in the report.
- **F11 / K2 — Q4.4 of `_decisions-2026-09-28-one-button-q3-q4.md`:** «Not hand-patched as a design
  answer. The Q4.3 gate shows which template files rot. Whether presets should ship config templates at
  all goes to the design session (§2).» No operator decision on that question is recorded since; it is
  parked in `one-button-w2-open-forks/parking.md`. Do not patch `poolOptions` in this stage.

## §3 Deliverables

1. **F7 — zod.** Install `zod` only where the reason at `70-deps.sh:465-474` holds (the project has an
   HTTP boundary or already imports/declares zod — R2's boundary detector `packages/core/audit-self/detect-r2-boundary.sh`, called at
   `setup.d/60-ci.sh:73-74` (`_r2_verdict`), already decides «no boundary folder, no zod parse call, and
   no `zod` in any package.json» (the verdict text `60-ci.sh:233` records); reuse it, do not write a
   second detector). Otherwise do not add it, and the report says why. Keep the single-source
   array; its comment (`:472-474`) says it also feeds a Next-steps echo in `99-finalize.sh`, but
   `git grep -n RUNTIME_DEPS 808e806c606 -- setup.d/99-finalize.sh` finds no reader — check, and fix the
   comment if it is stale.
2. **F7 — audit delta.** Measure the `npm audit` delta the install adds (before/after on a fresh
   scaffold) and state it in the install's final report as a finding with the package chain, never as an
   instruction to the person (the P6 report class «npm audit fix (npm's text)» is a manual step, §9 of
   the report). Whether a newer `@stryker-mutator/core` in range removes the chain — check, quote
   `npm ls qs`, and say.
3. **F9 — the reorder.** A project's `package.json` key order is not changed by getff's shipped
   lint-staged unless the project already sorted it (the project already listing `sort-package-json` in its
   own config or scripts). Decide the detection with evidence and a test; do not remove the rule from
   projects that asked for it.
4. **F10 — the silent fallback.** Find what trips arborist on the devDep batch (reproduce on the P6
   scaffold shape: `npm create vite@latest -- --template react-ts` + oxlint) and install without the crash
   if a split or order avoids it. If the fallback must stay, it covers only getff's own specs, and after it
   the install runs `npm ls` (or `npm explain`) for peer problems and reports each one — the fallback must
   not make a peer conflict disappear from the report.
5. **Tests.** One install-sh test per finding where a fixture can hold it (no network: npm fixtures or a
   stubbed `npm` on PATH as the existing `70-deps` tests do); wire each new `*.test.sh` in CI (principle 41).
   Regenerate the affected fingerprints and name them.

### §4c Fork discipline (park, don't guess)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT
> pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork
> stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on
> the unambiguous parts. Known candidates: (1) F7 — no boundary today but the project adds one later →
> Option A: `--refresh` adds zod when the boundary appears / Option B: R2's N/A record turns red and names
> the missing dependency. (2) F10 — the crash cannot be avoided → Option A: keep the scoped fallback + peer
> report / Option B: install getff's devDeps one by one (slower, no fallback).

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands in the park
payload + the PR's `## Parked questions`, and its correction lands as a separate owner commit — so this
allowlist deliberately names no park-record artefact.

## §4 Acceptance — executable, on the host

- **A1 F7** fresh react-ts scaffold, no boundary: after install `node -e 'console.log(!!require("./package.json").dependencies?.zod)'`
  prints `false`; a scaffold with `src/routes/` or an existing zod import still gets zod.
- **A2 F7** the final report carries the `npm audit` delta line with the package chain (or «no delta»).
- **A3 F9** fresh scaffold: install, `git commit` → `git diff HEAD~1 -- package.json` shows no key moved
  among the project's ORIGINAL keys (getff's added keys may be placed anywhere).
- **A4 F10** on the P6 shape: `install.log` has no `edgesOut` line, OR the fallback line is followed by
  a peer-check line with its result; before the change the same run shows the bare fallback — paste both.
- **A5** entry 28 on the same scaffold: `npm run lint` and `npm run build` exit codes before == after.

```bash host-verify
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
npx vitest run packages/core/principles/41-shell-test-ci-coverage.test.ts
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

Add each new test's `bash tests/install-sh/<name>.test.sh` line in the PR body; A1-A5 are live scaffold
runs (heavy rows on the PC, `~/HANDOFF-MAC.md`) — paste commands and exit codes.

## §5 Out of scope

- F11 / K2 (parked, §2). The other P6 findings (F1-F6, F8, F12, N1-N11) — fixed or owned elsewhere.
- Changing the mutation tool (Stryker) or its range beyond what F7's check shows.

## §6 Falsifiers to write into the PR body

- A project WITH an HTTP boundary loses zod → R2's premise broken, dependency-cruiser red again.
- A second «has a boundary» detector appears next to `detect-r2-boundary.sh` → two answers to one question.
- The project's own keys are still reordered on the first commit (A3) → F9 stands.
- A project that had `sort-package-json` in its own lint-staged loses it → getff removed a project setting.
- A peer conflict present under strict install vanishes from the report after the fallback → F10 stands.
- Any before-green command red after (A5) → entry 28 broken.

## §7 AI traps — [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)

Active traps for this stage: **T2** (reproduce each finding before fixing it) · **T3** (every claim:
command + output) · **T14** (a fixture with a stubbed npm cannot show F10's real crash — say which rows are
live) · **T19** (own cold review) · **T21** (cold `agents/backward-sweep-auditor.md` on the class «an install
step that adds to or rewrites the project's `package.json` beyond what the project needs» — every writer
of `dependencies`, `devDependencies`, `overrides`, `scripts` in `setup.d/70-deps.sh` is a candidate).

**T-OBW2F-A (domain):** `grep -rln zod src` rc 1 proves «unused in `src/`», not «unused» — a boundary may
live in `server/`, `api/` or a workspace package. Use the R2 boundary detector's own population, not a
hand-picked directory.

## §8 Not verified (at authoring time)

- Whether a newer `@stryker-mutator/core` within `^9.6.1` drops `typed-rest-client → qs` (not looked up).
- F10's trigger package (the report records the crash, not its cause).
- Whether `detect-r2-boundary.sh` is callable before `70-deps` runs (layer order: 60 before
  70 per `setup.d/LAYERS.md` — read the table, not measured).
