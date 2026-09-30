# one-button second wave — stack detection by files, generated rules for any npm project with a lint command

> **Type:** I-phase, execution-build, single stage — ONE PR against `staging`.
> **Base branch:** `staging`. **Branch:** `feat/one-button-w2-stack-detect-by-files`.
> **PR title:** `feat(install): detect the stack from the project's files and open rule generation to any npm project with a drivable lint command`.
> **Channel:** one aif task (own worktree, harvested from the host) or one host session; the result is
> verified on the host by an Opus session (operator log entry 36 proposes «aif dispatch → factory → Opus
> verifies»; it is a proposal, not an order — the dispatcher picks the channel).
> **Rigor label (L0):** `build-and-verify` — changes which install path every npm project takes; a wrong
> detection silently installs the wrong preset.
> **Authoritative for:** this stage's contract — the detection requirements, the layer-80 gate, the
> acceptance checks, the falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the one-button design and the operator's decisions — they live in the operator's coordination store
> (`_advisor-one-button-operator-log.md`, cited by entry number; not readable from the container, so the
> load-bearing lines are quoted here).

## §0 Dispatch gate — second wave, after the landing

This is second-wave work (handoff «Second wave»; operator log entry 41: the second wave comes after the
landing of the one-button union). At authoring time (2026-09-30, `origin/staging` `2855667cb34`) the
union is NOT on `staging`. Check at click time:

```bash
git fetch origin staging
git cat-file -e origin/staging:setup.d/ships.manifest \
  && git cat-file -e origin/staging:packages/core/audit-self/run-armed.sh \
  && git cat-file -e origin/staging:packages/core/install/mcp-source-check.ts \
  && echo "union landed — dispatchable"
```

Any path missing → do not dispatch. Before dispatch run
`SLUG=one-button-w2-stack-detect-by-files bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
(`.claude/skills/dispatcher/SKILL.md` §2.0; on the Mac the container arm needs
`DOCKER_CONTEXT=pc AIF_CONTAINER=aif-agent-1`, otherwise it is `PROBE-INCOMPLETE`, never FRESH).

**Measurement SHA for every `path:line` below:** `808e806c606` (head of `join/one-button-union`, round 6).
The landing merges `staging` forward into the union and moves code (the join's dry landing list: staging
PR 1937 moved three inline blocks into `do_refresh` functions), so re-locate every citation by content
(`grep -n`) on your base before editing.

## §1 The problem, as measured

- The stack detector is four `package.json` key predicates, most-specific-first
  (`setup.d/lib.sh:2148-2152`): `"react-native"` → react-native, `"next"` → react-next, `"react"` →
  react-spa, `"typescript"` → ts-server, else `unknown`. It reads no other file.
- Under `-y` / `--full`, `unknown` becomes `generic` (`install.sh:753-759`: «No stack signal in
  package.json (no react-native / next / react / typescript dependency) → generic»).
- Layer 80 skips `generic` entirely (`setup.d/80-rule-bootstrap.sh:62-67`, the handoff cited `:59-63`):
  `note_not_wired "generated rules — not run: the rule generator writes ESLint rules, and stack «generic»
  has no ESLint getff placed"`. The generic research file is still listed, every entry research-only (`:64-65`).
- The generator does NOT need the project's ESLint: getff brings its own toolchain outside the project's
  dependencies (`80-rule-bootstrap.sh:105-111`, `_rb_tool_pkgs=(eslint@^9 typescript-eslint typescript)`),
  and an oxlint project receives getff's rules through `jsPlugins` (`setup.d/99-finalize.sh:1064-1073`).
- The project's linter is ALREADY read from its files, stack-free: `project_linter`
  (`setup.d/lib.sh:3320-3342`) → `eslint | oxlint | biome | none`, from `scripts.lint`'s first word, then
  config file names.
- Biome: `99-finalize.sh:1074-1075` says «Biome … does not load ESLint-format rules» — a claim nobody
  re-verified for this chain (handoff: «Biome placement unverified»).
- Other layers that skip `generic`: `setup.d/30-templates.sh:22`, `setup.d/40-configs.sh:18`,
  `setup.d/70-deps.sh:169`. They stay as they are unless a deliverable below needs one of them.

Consequence: an Astro, Svelte or Vue project gets either `generic` (no generated rule at all) or, if its
`package.json` names `typescript`, the `ts-server` preset — a Node-server preset. Which of the two each
`create-*` scaffold gets today is **not measured** (§8); measuring it is step 1 of this stage.

## §2 Operator decisions this stage respects (cite, do not paraphrase as orders)

- **Entry 28, fork 1 = A** — the log's reading: «the project's setup wins — the project's versions and
  settings are not changed; what was green before the install stays green; getff adapts to the project's
  linter or reports "not wired"». This is the acceptance test of this stage (§4 A4).
- **Entry 28, fork 2 = B** — no version pins; installed versions are recorded.
- **Entry 26 point 4** (approved idea): «Any stack: the installer delivers the stack-free part to every
  project; the agent does the stack-bound part from the stack's docs; what was not done is reported "not
  done" … design for any stack, promise only what was run.»
- **Entry 26 point 5 / entry 30(b)** — the rule-home ladder «линтер проекта → инструмент стека → ast-grep →
  тест или скрипт → не подключено».
- **Handoff «Rejected alternatives»:** «"Всё generic" — rejected with evidence … the fix is to make generic
  full, not to make everything generic.»

## §3 Deliverables

1. **Measure first (RED evidence).** In scratch dirs on the host or the PC (never in this repo), scaffold
   `npm create astro@latest` (default template, TypeScript on) and `npx sv create` (SvelteKit, TypeScript,
   with and without the ESLint add-on). For each, record: the `package.json` keys, whether a `lint`
   script exists, `project_linter`'s answer, and the stack `bash <getff>/setup --dry-run` prints. Paste
   the table into the PR body. This is the RED of the stage.
2. **Detection from the manifest and files.** One detector (keep the SSOT: `_detect_stack_from_pkg`'s
   callers — `install.sh:752`, `setup.d/15-companions-stack.sh`, `_detect_stacks_per_workspace`
   `lib.sh:2182-2217` — all read the same function). Requirements, not a design:
   - it reads framework config files and manifest keys, not only four dependency keys;
   - a project must never get a preset whose shape it does not have (a SvelteKit app must not get the
     `ts-server` Node-server preset because it lists `typescript`);
   - it stays node-free, or the PR states why it may not be (`lib.sh:2124-2127`: detection runs before
     the project's dependencies are installed);
   - a stack getff has no preset for gets a NAME (for the report and for the research file key
     `.ai-factory/rules-research/<name>.research.json`, `80-rule-bootstrap.sh:68,93-94`) while the
     preset-bound layers treat it like `generic` and say so in NOT-wired lines;
   - `--refresh` detection (`install.sh:726-744`, reads getff's own placed files) stays consistent with
     the fresh-install answer for the same project.
3. **Layer 80 gated on the linter, not the stack.** Enter rule generation when `project_linter` answers
   `eslint` or `oxlint` AND the project has a lint command the proof can run; the stack name only keys
   the research file. `none` and `biome` keep a NOT-wired line with the reason. For Biome, re-verify the
   claim at `99-finalize.sh:1075` from Biome's own docs (context7, ≥3 phrasings: Biome plugins, GritQL
   plugins, ESLint rule compatibility) and quote the docs line in the PR; if Biome can hold a generated
   rule, PARK it (§4c) — building a Biome lane is not this stage.
4. **`generic` stays the honest fallback**: no `package.json`, or no drivable lint command → the same
   NOT-wired lines as today (`80-rule-bootstrap.sh:63`), plus the detected name when there is one.
5. **Tests (no network, fixtures committed):** an install-sh test with minimal Astro-shaped and
   SvelteKit-shaped fixture projects (a `package.json` and the framework config file only) asserting the
   detected name, that no npm preset is chosen for them, and that the `--dry-run` output of layer 80
   says it would run (lint present) or names the NOT-wired reason (lint absent). Wire it into CI —
   principle 41 (`packages/core/principles/41-shell-test-ci-coverage.test.ts`) fails a new `*.test.sh`
   no workflow runs. Regenerate install baselines if the detection line changes
   (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) and say which fingerprints moved.

### §4c Fork discipline (park, don't guess)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT
> pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork
> stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on
> the unambiguous parts. Known forks for this stage: (1) a scaffold with NO lint command (step 1 may find
> that `create-astro`'s default template has none) — Option A: getff adds a lint command of its own →
> the project gains a new command (entry 28 allows new commands, it forbids changing existing ones; the
> advisor's fallback in entry 15 was «getff adds ESLint alongside, announced in one line», never
> separately confirmed by the operator) / Option B: NOT wired with the reason → no generated rule on that
> scaffold. (2) Biome can hold generated rules → a new lane (not this stage).

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands in the park
payload + the PR's `## Parked questions`, and its correction lands as a separate owner commit — so this
allowlist deliberately names no park-record artefact.

## §4 Acceptance — executable, on the host

- **A1** the new install-sh test passes and runs in CI.
- **A2** live, Astro: a fresh `npm create astro@latest` project WITH a lint command (default template,
  or the ESLint/oxlint option if the default has none — say which) → `GETFF_SESSION_SETTINGS=1
  GETFF_STACK_TOOLS=1 bash <getff>/setup -y` → the rule research of `agents/rule-researcher.md` →
  `bash <getff>/setup --full <name>` → `node scripts/prove-rules.mjs --prove` EXIT=0 with at least one
  GENERATED rule proven (bad sample → exit ≠ 0, good sample → exit 0). Quote the proof line.
- **A3** the same for a SvelteKit `npx sv create` project with the ESLint add-on.
- **A4** entry 28 «green stays green», per scaffold: `npm run lint`, `npm run build` (and `npm run check`
  for SvelteKit) exit codes before == after; every original `package.json` key unchanged (key-by-key
  diff prints no CHANGED line — the method of the P6 cold-run report §4).
- **A5** `generic` still: a directory with no `package.json`, and one whose `package.json` has no lint
  command → the install prints the NOT-wired generated-rules line with its reason.

```bash host-verify
npx vitest run packages/core/principles/41-shell-test-ci-coverage.test.ts
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

Add the new test file's `bash tests/install-sh/<name>.test.sh` line to this list in the PR body (its name
is the implementer's). A2-A4 are live runs on a scratch project, heavy rows on the PC (`~/HANDOFF-MAC.md`);
paste their commands and exit codes into the PR body.

## §5 Out of scope

- Building a preset (ESLint config, tsconfig, vitest config) for Astro/Svelte/Vue.
- A Biome rule lane; the MCP list (kickoff `one-button-w2-mcp-list-policy`); oxlint preset translation
  (`one-button-w2-open-forks/parking.md`).
- Trigger-build slices S3/S4/S5 and research cards (owned by the trigger-build lead:
  `trigger-build-s3`, `trigger-build-s4`, `trigger-build-s5`, `trigger-build-research-cards`).
- `.claude/rules/**`, `.claude/settings.json`.

## §6 Falsifiers to write into the PR body

- A SvelteKit fixture listing `typescript` is still classified `ts-server` → the detector still keys on
  four dependency names.
- Any of the four npm presets changes its answer on the existing install fixtures (fingerprints move for
  react-spa / react-next / react-native / ts-server with no stated reason) → regression on the accelerators.
- A2/A3 prove only preset rules, zero generated → layer 80 did not really open.
- A4 shows any before-green command red after → entry 28 broken.
- A no-lint project reaches the generator → the gate reads the stack, not the linter.
- The fresh-install name and the `--refresh` name differ for one project → two detectors.

## §7 AI traps — [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)

Active traps for this stage: **T2** (run the scaffolds and the install, do not describe what they would
print) · **T3** (every claim: command + output or `file:line`) · **T9** (measure more than the two named
frameworks' happy path — include a scaffold without a lint command) · **T14** (a green fixture test with no
live A2/A3 is low coverage, say so) · **T19** (own cold review of the diff before handoff) · **T21**
(cold `agents/backward-sweep-auditor.md` on the class «a stack decision read from package.json keys where
the project's files say otherwise» — the other readers of `STACK` in `setup.d/*.sh` are the candidates).

**T-OBW2-A (domain):** `project_linter` answers from `scripts.lint`'s FIRST word (`lib.sh:3324-3329`). A
`lint` script like `astro check && eslint .` or `npm run lint:js` yields `astro` / `npm` → falls through to
config-file names. Test the gate against the real scripts the scaffolds write, not against `eslint .`.

## §8 Not verified (at authoring time)

- What `create-astro` and `sv create` scaffold today (keys, lint script, linter). Not run.
- Whether any Vue scaffold (`npm create vue@latest`) takes the same path; not in acceptance.
- Biome's current plugin model (the `99-finalize.sh:1075` claim).
- Whether the generator's own ESLint toolchain parses `.astro` / `.svelte` files; the generated rules may
  apply only to `.ts` / `.js` files there — measure in A2/A3 and state the file set in the PR.

## §9 Report

`Stat` / `Verify` (each §4 row with its command and exit code) / `DECISIONS` / `ATTN` / `Confidence` (as
predicates, not «high»). The PR body carries `## Fidelity verdict` and the §1.7 Forward-check /
Backward-check sections.
