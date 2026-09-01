# KICKOFF — first-commit-passable (F1)

> **Type:** remediation umbrella, single stage (I-phase). Authored 2026-09-02 by the
> beta-release night seat (advisor role) from the GLM z.code cold probe of staging
> `ff6a02245c` (probe report: `~/code/zcode-probe/2026-09-01/REPORT.md`, operator machine) and
> its Claude Code verification pass (three BLOCKERs VERIFIED on fresh throwaway consumers,
> evidence in each issue's `## Verification` section). Closes the three open BLOCKERs that stand
> between the beta-program phase-1 exit («0 open BLOCKER issues») and the first tester.
> **Origin — three issues, one surface (the shipped first-commit path):**
>
> - <https://github.com/artyhoo/getff/issues/1528> — a gitignore-less consumer (`npm init -y`
>   ships none; the installer ships none) stages `node_modules/` on `git add -A`; lint-staged
>   v16 per-directory config discovery then EXECUTES vendored configs under `node_modules/`
>   (tslint/trunk ENOENT, SIGKILL ×174, 281 `node_modules` paths left in the index after the
>   failed revert).
> - <https://github.com/artyhoo/getff/issues/1529> — on EVERY consumer, clean or not: the
>   install commit stages installer-delivered files that the shipped
>   [templates/ts-server/eslint.config.mjs:51-69](../../../templates/ts-server/eslint.config.mjs)
>   globally ignores (`eslint-rules-local/**`, `packages/core/**`, `scripts/audit-r4.ts`), and
>   [packages/core/templates/shared/.lintstagedrc.json:2-3](../../../packages/core/templates/shared/.lintstagedrc.json)
>   passes them to `eslint --fix --max-warnings=0` without `--no-warn-ignored` → 30 «File
>   ignored because of a matching ignore pattern» warnings → the commit is un-passable through
>   the shipped pre-commit, and [INSTALL-FOR-AI.md:42](../../../INSTALL-FOR-AI.md) forbids
>   `--no-verify`. Deterministic; independent of issue 1528.
> - <https://github.com/artyhoo/getff/issues/1530> — [templates/ts-server/vitest.config.ts:26](../../../templates/ts-server/vitest.config.ts)
>   (and the react-spa / next-15 preset twins at their line 46) declare
>   `setupFiles: ['./tests/setup.ts']`; nothing ships that file (`git ls-tree -r origin/staging
| grep 'tests/setup.ts'` → empty), so with ≥1 test `npx vitest run` dies on «Cannot find
>   module». Hand-creating it then fails the commit: typescript-eslint `projectService` rejects
>   a file no tsconfig covers, and the shared
>   [packages/core/templates/shared/tsconfig.json:25](../../../packages/core/templates/shared/tsconfig.json)
>   includes `src/**` only. Bonus doc defect: [INSTALL-FOR-AI.md:553](../../../INSTALL-FOR-AI.md)
>   recommends `npx vitest run --listFiles`, not a vitest 4 option (`vitest list` is).
>   **Base branch:** staging. Per [kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md),
>   do NOT dispatch until this kickoff is merged to staging.
>   **Rigor label (effort-worthiness L0):** `research-grade` — every file touched is
>   consumer-shipped payload (the live severity axis, [effort-worthiness.md §5.2 pointer](../../rules/effort-worthiness.md)).
>   **Prior-art (EXECUTION-PLAN §5.5 Step 1.5):** in-repo REUSE — `copy_safe` (skip-if-exists,
>   [setup.d/lib.sh:15](../../../setup.d/lib.sh)) is the delivery idiom for every new seed file;
>   the lint-staged migration offer on refresh
>   ([tests/install-sh/refresh-offers-lintstaged-migration.test.sh](../../../tests/install-sh/refresh-offers-lintstaged-migration.test.sh))
>   is the already-shipped path by which EXISTING consumers learn the template changed; the
>   `framework-fresh-install-validate` matrix job
>   ([.github/workflows/audit-self.yml:1136](../../../.github/workflows/audit-self.yml)) is the
>   already-wired real-deps fresh consumer that the e2e arm extends. `--no-warn-ignored` is an
>   ESLint ≥8.56 / 9 flat-config flag (the installer pins `eslint@^9`,
>   [setup.d/70-deps.sh:165](../../../setup.d/70-deps.sh)). No new module or dependency; a stage
>   that proposes one owes a fresh 6-item consult.
>
> **Citation form is load-bearing** — issue/PR references are full URLs or bare
> `issue NNN` / `PR NNN`, never hash-tokens (dup-detect signal 1, issue 1517).

## §0 Read first, in order

1. [README.md#why-this-exists](../../../README.md#why-this-exists) → [.claude/session-bootstrap.md](../../session-bootstrap.md) → [CLAUDE.md](../../../CLAUDE.md).
2. The three issues (URLs above) — the `## Verification` section of each carries the exact
   command + verbatim output the arms below must replay.
3. [setup.d/40-configs.sh](../../../setup.d/40-configs.sh) — `.lintstagedrc.json` delivery at
   :99, `tsconfig.json` at :128, the per-stack `vitest.config.ts` at :379 / :398 / :412 (all
   `copy_safe`; line numbers as of staging `b2af6a1fac`).
4. [INSTALL-FOR-AI.md](../../../INSTALL-FOR-AI.md) `Three-layer authority for shipped
artefacts` — a consumer's existing `.gitignore` / `tsconfig.json` / `.lintstagedrc.json` is
   Layer-2-owned; this stage never edits one in place.

## §1 Decisions (authored with rationale; operator-overridable at PR review)

- **FC-1 (issue 1529) — `.lintstagedrc.json` template: both eslint tasks gain
  `--no-warn-ignored`.** Chosen shape: `"eslint --fix --max-warnings=0 --no-warn-ignored"` on
  the `*.{ts,tsx}` and `*.{js,mjs,cjs,jsx}` lines. Rationale: the ignore list in
  `eslint.config.mjs` is correct (its own comment at :58-62 explains why type-aware rules must
  not walk the vendored `.mjs`), and `--max-warnings=0` is the enforcement bar — the ONLY
  defect is lint-staged passing ignored paths explicitly, which is exactly the case the flag
  exists for. **Rejected:** dropping `--max-warnings=0` (weakens enforcement for every
  consumer); un-ignoring the vendored files (fatal type-info errors, per the config's own
  comment); a `.lintstagedrc.json` glob that excludes the vendored dirs (duplicates the
  ignore list in a second file — two lists nobody reconciles). Existing consumers: the file
  is `copy_safe`, so they keep their copy and get the already-shipped migration OFFER on the
  next `--refresh` — assert that offer still fires (the sibling test), do not extend it.
- **FC-2 (issue 1528) — ship a `.gitignore` seed, `copy_safe`, never appended.** New template
  file `packages/core/templates/shared/gitignore` — **no leading dot in the source name**,
  delivered as `$PROJECT_ROOT/.gitignore` (the `npm init` / `create-*` idiom: `npm pack`
  silently drops a dotted `.gitignore` from the tarball — measured 2026-09-02 in the cold read,
  `npm pack --dry-run --json` listed `templates/shared/gitignore` and not the dotted twin — so
  the npm delivery channel, a beta floor item, would lose the seed and `copy_safe` would fail
  on a missing source). Content: exactly the artefact dirs the shipped configs already ignore:
  `node_modules/`, `dist/`, `coverage/`, `.stryker-tmp/`, `reports/` (mirror
  [templates/ts-server/eslint.config.mjs:52-57](../../../templates/ts-server/eslint.config.mjs)).
  Delivered from `40-configs.sh` §5 beside `.nvmrc`. When a consumer `.gitignore` EXISTS but
  has no line matching `node_modules`, print ONE `⚠` install note naming the file — warn only,
  never edit (Layer-2 ownership). **Rejected:** appending to the consumer's file (silent
  mutation of a consumer-owned artefact — the class the R1 divergence guard exists to
  prevent); a lint-staged-side guard against `node_modules` (treats the symptom; the index
  would still carry 15k files).
- **FC-3 (issue 1530) — the setup file is shipped; greenfield tsconfig covers it; brownfield
  gets a warning, never a parser trick.**
  (a) Ship `tests/setup.ts` for EVERY stack template whose `vitest.config.ts` references it,
  `copy_safe` so a consumer's own file wins. Content is per stack and follows the contract the
  config's OWN header states: ts-server → a documented no-op (`// Vitest setup hook — add
global test setup here.` + `export {};`); react-spa and next-15 → what
  [packages/preset-react-spa/templates/vitest.config.ts:15](../../../packages/preset-react-spa/templates/vitest.config.ts)
  and the next-15 twin at its line 15 already demand («Required setup file: tests/setup.ts
  with @testing-library/jest-dom/vitest + cleanup»; `globals: false` at :27 means RTL does not
  auto-clean without it), and `@testing-library/jest-dom` is installed by
  [setup.d/70-deps.sh:201,212](../../../setup.d/70-deps.sh). **Falsifier for the react halves
  — measure FIRST:** the shared [tsconfig.json](../../../packages/core/templates/shared/tsconfig.json)
  has no DOM lib, so `npm run typecheck` on a fresh react consumer may reject the jest-dom
  import after (b); if it does, park with the measured `tsc` line — do NOT ship a no-op there
  (that passes the vitest arm and breaks the tester's first RTL assertion, the same BLOCKER
  class one step later) and do NOT add a second tsconfig on your own.
  (b) Greenfield (installer wrote `tsconfig.json`): add `"tests/**/*"` to the shared template's
  `include`. A bare `export {}` file is strict-clean under `tsc --noEmit` (measured), and
  `arch:check` crawls `src` only ([setup.d/70-deps.sh:86](../../../setup.d/70-deps.sh)).
  (c) Brownfield (consumer `tsconfig.json` pre-exists, `copy_safe` skipped it): **deliver
  `tests/setup.ts` ONLY when the consumer tsconfig covers it; otherwise skip the file and
  print ONE `⚠` install note** («add `tests/**/*` to tsconfig include, then re-run install —
  or create tests/setup.ts yourself»). Coverage predicate, defined ONCE and used for both the
  delivery gate and the note: covered ⇔ the installer wrote `tsconfig.json` itself (not in
  the SKIPPED set — the existing primitive is `_prettierignore_in_skipped`,
  [setup.d/lib.sh:857](../../../setup.d/lib.sh)), OR the consumer tsconfig has NO `include`
  key (tsc default = whole tree; measured: lints clean), OR some `include` entry starts with
  `tests`. Unreadable tsconfig (JSONC comments, `tsc --init` emits them) = fail-OPEN: treat as
  covered, no note, never abort the layer. Why the gate is mandatory and a note alone is not
  (measured, round-2 cold read): a shipped `tests/setup.ts` outside the consumer's tsconfig
  is staged by the install commit, lint-staged runs the `**/*.{ts,tsx}` block with
  `projectService: true` on it, and that is a hard **parse error** («was not found by the
  project service») that neither `--no-warn-ignored` nor `--max-warnings` touches — the
  brownfield install commit would still fail, a regression against the post-FC-1 status quo.
  Honest consequence to record in the PR: on such a brownfield the vitest half of issue 1530
  stays status quo until the consumer follows the note; an un-passable commit is the greater
  evil. **Rejected:** an eslint ignore for `tests/setup.ts` on brownfield
  (`eslint.config.mjs` is `copy_safe` too, so the consumer may own it; and on greenfield the
  ignore would silence linting of a shipped file for nothing). **Also rejected (measured in
  the 2026-09-02 cold read, do not re-try):**
  `parserOptions.projectService.allowDefaultProject: ['tests/setup.ts']` in the eslint
  test-files block. Two independent kills: (1) a file BOTH in a tsconfig include and in
  `allowDefaultProject` is a hard parse error —
  `@typescript-eslint/typescript-estree/dist/useProgramFromProjectService.js:71-73` throws
  «was included by allowDefaultProject but also was found in the project service», so it
  cannot coexist with (b) on greenfield; (2) the project service is a process-global
  singleton whose options come from the FIRST file parsed
  (`typescript-estree/dist/parseSettings/createParseSettings.js:57,247`), so a per-block
  option is order-dependent — `eslint src/a.ts tests/setup.ts` fails, `eslint tests/setup.ts
src/a.ts` passes, and lint-staged's sorted index always puts `src/` first: the install
  commit fails on brownfield exactly as in issue 1530. Also: the react preset configs have NO
  `tests/**` block to hang it on (`eslint.config.react.mjs:313` matches
  `**/*.{test,spec}` only).
  (d) Doc: replace `npx vitest run --listFiles` at INSTALL-FOR-AI.md:553 with `npx vitest
list` (verified: vitest 4.1.8 `list [...filters]`), and add the brownfield tsconfig note
  to the printed wiring steps' documented list. **Rejected:** deleting the `setupFiles` line
  (the react presets need the hook, and a config that names a file the payload ships is the
  honest contract).
- **FC-4 — delivered bytes CHANGE; the install snapshot is regenerated in the same PR.**
  `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` after the fix; the diff must show
  ONLY the files FC-1..FC-3 name. Any other file in the snapshot diff = scope leak → park.

## §1b Autonomous aif dispatch — park-don't-guess contract

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to
> `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
> consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the
> unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists
> to prevent. Known non-forks (already decided above): FC-1, FC-2, FC-3(a) ts-server half,
> FC-3(b)(c)(d) incl. the coverage predicate, FC-4. FC-3(a) react halves are decided WITH a falsifier — measure the
> `typecheck` first; park only on the measured error.

## §2 Stage

| Stage | Content                                                                                                                                                                                                                                                                                                                                                            | Depends on | Size |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---- |
| F1    | FC-1 template flag; FC-2 `.gitignore` seed + `⚠` note; FC-3 `tests/setup.ts` ×3 (per-stack content) + tsconfig include + brownfield `⚠` note + doc line; FC-4 snapshot regen; regression arms per §3; RED-before-GREEN observations pasted verbatim in the PR body; the three issues' `## Verification` commands replayed GREEN on the patched tree (paste output) | —          | M    |

Order: single stage. One PR onto staging; the PR body carries `Closes <URL>` for each of the
three issues so they close on merge; closure writes `done.md`.

## §3 Regression home (build-vs-reuse — decided, do not re-derive)

- **e2e arm — EXTEND the existing `framework-fresh-install-validate` matrix job**
  ([.github/workflows/audit-self.yml:1136](../../../.github/workflows/audit-self.yml)): it
  already builds a real-deps fresh consumer per stack (`install.sh <stack> --full`, seeds
  `src/`). Add, after the seed step: (1) a planted test file whose name matches THAT stack's
  `vitest.config.ts` `include` glob (ts-server `src/seed.unit.ts`; react-native has no
  `setupFiles` and includes `src/**/*.{test,spec}.{ts,tsx}` only —
  [packages/preset-react-native/templates/vitest.config.ts:18-20](../../../packages/preset-react-native/templates/vitest.config.ts)
  — so `src/seed.test.ts` there; read the react-spa / next-15 globs, do not guess); a wrong
  name makes vitest exit 1 with «No test files found», a failure unrelated to the three
  issues; (2) `git add -A && git commit -m "install"` through the REAL shipped pre-commit —
  exit 0 is the assert (issue 1529's replay; `core.hooksPath=.husky` is set directly by
  [setup.d/50-hooks.sh:80-83](../../../setup.d/50-hooks.sh), and the job configures git
  identity before install at :1155-1157); (3) `npx vitest run` exit 0 (issue 1530's replay).
  All four matrix stacks run (1)-(3): issue 1529 is every stack; react-native simply has no
  setup file to ship.
  Do NOT add a `.gitignore` in the job by hand — the seed FC-2 ships is what makes (2) pass on
  the matrix's gitignore-less consumer (issue 1528's replay). Env-var the stack as the job
  already does (zizmor template-injection rule).
- **Shell arms — ONE new file `tests/install-sh/first-commit-passable.test.sh`** (no existing
  file owns «first commit» — `f14-lintstaged-resolves.test.sh` simulates binaries and never
  commits; verified 2026-09-02): (a) `.gitignore` seed lands on a bare consumer and is
  byte-identical to the template; (b) paired negative — a consumer with its OWN `.gitignore`
  keeps it byte-identical and the `⚠` note fires iff `node_modules` is absent from it;
  (c) `tests/setup.ts` lands for each of the three stacks and a pre-existing consumer
  `tests/setup.ts` survives `--force`-less install byte-identical; (d) the delivered
  `.lintstagedrc.json` carries `--no-warn-ignored` on both eslint lines, and the refresh
  migration offer still fires for a consumer whose copy is the OLD template (re-run the
  sibling test, do not re-write it); (e) the two new `copy_safe` destinations (`.gitignore`,
  `tests/setup.ts`) are added to the EXCLUDED list of
  [tests/install-sh/refresh-covers-full-delivery.test.sh:75-114](../../../tests/install-sh/refresh-covers-full-delivery.test.sh)
  with a one-line «consumer-owned after first install» rationale each — that test asserts
  FULL ⊆ REFRESH ∪ EXCLUDED over every `copy_safe` line, so without the edit it goes red for a
  non-defect; do NOT «fix» it by adding the files to `do_refresh` (Layer-2 violation);
  (f) **brownfield commit arm (mandatory — the e2e consumer at `audit-self.yml:1160` is
  greenfield, so nothing else covers this):** a fixture with its OWN `tsconfig.json`
  (`"include": ["src/**/*"]`) → `tests/setup.ts` is NOT delivered and the `⚠` note is
  printed exactly once; paired positive — a consumer tsconfig with NO `include` key →
  delivered, no note; and a JSONC tsconfig (a `//` comment line) → delivered, no note, exit 0
  (fail-open). Deps-free, bash 3.2.
  Registration = one `- name:` / `run:` step pair in an
  existing `install-sh` shard of `audit-self.yml` (pattern :745-746); principle 41 then
  passes by glob — `meta-all-wired.test.sh:22` and `run-local-ci-sweep.sh:170` need no edit.
- **RED-before-GREEN, mandatory:** run the extended CI steps' commands locally against the
  UNPATCHED tree first and paste the two failing lines verbatim (issue 1529's «File ignored»
  × `--max-warnings=0` exit 1; issue 1530's «Cannot find module … tests/setup.ts»). A single
  RED does not cover both defects.

## §4 Binding constraints (do not re-derive)

- **Layer-2 ownership is absolute:** `copy_safe` for every new file; no `sed -i` on a
  consumer's `.gitignore`, `tsconfig.json`, or `.lintstagedrc.json`. Existing consumers reach
  the new template through the refresh migration OFFER, not through overwrite.
- **Enforcement bar unchanged:** `--max-warnings=0` stays; the type-aware test-files block
  stays type-aware (FC-3(c) falsifier → park, never downgrade).
- **Scope = the three issues.** The verifier's residuals (`render-status.sh` rendering the
  operator's umbrellas inside a consumer; stale AI-USAGE-GUIDE §6 rows) and the nine
  NON-BLOCKER probe issues are NOT this stage — file nothing, fix nothing there.
- **PMCB B2 surfaces off-limits** (W-2 honour): no edits to `packages/core/audit-self/**`
  carrier lines beyond the CI-step registration named in §3.
- **Portability:** bash 3.2-compatible, shellcheck-clean, no GNU-only flags; English-only
  machinery ([language-discipline.md](../../rules/language-discipline.md)); no paid LLM in
  CI ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)); a new file under
  `packages/core/templates/shared/` is a shipped artefact → `SNAPSHOT_MODE=capture` (FC-4).
- **PR body gates:** `### §1.7 Forward-check applied` / `### §1.7 Backward-check applied`
  each with a real `path.ext:NN` citation; `## Fidelity verdict` with `FIDELITY: GO` +
  `Basis: <this kickoff path>` + `Round: <n>` + `Audited-SHA: <PR head>` from a cold
  [agents/fidelity-auditor.md](../../../agents/fidelity-auditor.md) run (stage PR — `skipped`
  is not available); not a capability commit (a `*.test.sh` under `tests/` is not under
  `packages/`; the `.gitignore` seed and `tests/setup.ts` are <50 LOC) — add a `Prior-art:`
  trailer anyway citing the in-repo REUSE above.

## §5 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

- **T3** — every claim in the PR body carries command output or `file:line`; the RED
  observations and the three `## Verification` replays are pasted verbatim, not described.
- **T15** — paired negatives: the `.gitignore` arm must show the consumer-owned file
  UNTOUCHED (a fix that appends passes the seed arm and fails this); FC-1 must show the
  migration offer still firing (a fix that silently overwrites the consumer copy passes the
  flag arm and fails this). Self-application: this kickoff went through a cold design read
  BEFORE its PR, and that read returned REVISE — its first draft's FC-3(c) would have failed
  the brownfield install commit exactly as issue 1530 does (the previous night kickoff, issue
  1519, shipped an analogous defect that was caught only at Phase -1). Round 2 of the same
  read found that a warn-only brownfield note would STILL leave the install commit
  un-passable (a parse error, not a warning) — hence the delivery gate in FC-3(c).
- **T19** — run your own adversarial cold review of the diff before handoff: «which stack
  or layout did the arms NOT cover?» (react-native has no `setupFiles` line — it is in the
  commit arm's population but out of FC-3's, state both; a pnpm-workspace consumer's per-package
  `.lintstagedrc.json` stubs are COPIED from the root file at
  [setup.d/40-configs.sh:111-112](../../../setup.d/40-configs.sh), so FC-1 propagates by
  construction — assert it once).
- **T20** — no recommendation in the PR without a tool-backed quote.

## §6 Host acceptance

```bash host-verify
bash tests/install-sh/first-commit-passable.test.sh
bash tests/install-sh/refresh-offers-lintstaged-migration.test.sh
bash tests/install-sh/f14-lintstaged-resolves.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
bash tests/install-sh/meta-all-wired.test.sh
npx vitest run --root packages/core principles/41-shell-test-ci-coverage.test.ts
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
shellcheck setup.d/40-configs.sh tests/install-sh/first-commit-passable.test.sh
```

(Run against a COMMITTED tree — principle 41's population is `git ls-files`. The CI e2e arm
is the acceptance authority for the commit + vitest replay; a green container run is not
evidence ([destination-environment-verification.md §3](../../rules/destination-environment-verification.md)).)

## §7 Stage gates

- Before dispatch: `SLUG=first-commit-passable bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
  — re-probe immediately before the actual dispatch.
- Phase -1 cold review of the dispatch prompt is mandatory.
- When F1 merges, the merging session writes `done.md`
  ([operational-conventions.md §1](../../../docs/meta-factory/operational-conventions.md)).

## §8 See also

- Sibling night kickoff [refresh-prune-consumer-rule](../refresh-prune-consumer-rule/kickoff.md)
  (issue 1519 — the fourth open BLOCKER; aif task `d80087a9`, dispatched 2026-09-02).
  Files do not overlap except ONE shared anchor: both stages register a CI step at
  `audit-self.yml:745-746`; whichever merges second resolves a textual conflict by
  merge-forward, keeping both steps.
- [.claude/rules/git-conflict-merge-forward.md](../../rules/git-conflict-merge-forward.md).
