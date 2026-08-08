# AI Usage Guide — from install to a first task

> **Authoritative for:** the AI-facing lifecycle of a getff-equipped project past install — the
> First-Steps sequences per install depth (rendered from the SSOT named in §1), the daily cycle,
> and the routing to what is not yet shipped.
> **NOT authoritative for:** installation itself — see `INSTALL-FOR-AI.md`. Tier-routing criteria
> and the capability-absence degradation matrix — see `.ai-factory/tier-home.md` (§4 points there
> and never restates it). This project's own rules — see `.ai-factory/RULES.md`. Project goal —
> see your own `README.md`.

**Class:** shipped consumer doc. Cold-read on demand, not always-on: `AGENTS.md` carries a
one-line pointer here, and nothing in this file is loaded into a session unless a step needs it.
Nothing in this guide writes to your AI's persistent memory.

---

## §1 How to read this file

Each section below **renders from a shipped artefact** and documents only what is on disk today.
Where a capability is not shipped yet, §6 names it with an owner and a trigger instead of
describing it — a section describing something that does not exist is a lying doc, and this
project treats that as the primary failure mode.

| Section            | Renders from                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| §2 First Steps     | `packages/core/templates/shared/first-steps.source.json` (framework repo) — the SSOT, parity-gated |
| §3 Daily cycle     | the gate scripts actually installed in `scripts/` + `.husky/`                                      |
| §4 Degradations    | `.ai-factory/tier-home.md` §3 (installed at `env` and `factory` depth)                             |
| §6 Not shipped yet | this program's stage owners                                                                        |

**On the First-Steps SSOT.** §2 is one of **two renders** of a single source; the other is the
human-voiced version on the project site. Neither render is the source. A drift check parses both
this file and the JSON source and compares the ordered step list per depth, so a step reordered or
retitled in one render alone fails the check rather than quietly forking.

---

## §2 First Steps

Three sequences, one per install depth. Run the one matching the depth you installed. If you do
not know: `core` is the default, `env` additionally puts `.ai-factory/tier-home.md` and
`.claude/skills/arch/` on disk, `factory` additionally puts `.claude/skills/pipeline/` there.

### §2.1 `core` — install → a rule provably fires on your code

<!-- step: install -->

1. **Install at core depth** — from your project root run `bash <getff>/setup -y <stack>` (stacks:
   `ts-server`, `react-next`, `react-spa`, `react-native`; `install.sh python` and
   `GETFF_TOOLCHAIN=cargo` take their own lanes). Omit the stack to auto-detect.

<!-- step: verify-payload -->

2. **Verify the payload landed** — `ls AGENTS.md .ai-factory/ scripts/`. You should see
   `AGENTS.md`, `.ai-factory/{DESCRIPTION.md,ARCHITECTURE.md,RULES.md}` and
   `scripts/audit-ai-docs.sh`. A missing file means the install did not finish.

<!-- step: fill-passport -->

3. **Fill the project passport** — replace every `<PLACEHOLDER>` in `.ai-factory/DESCRIPTION.md`
   (domain, stack, constraints, non-goals). `AGENTS.md` sends every future session here first, so
   an unfilled passport degrades every later session.

<!-- step: prove-rules-not-inert -->

4. **Prove the rules are not inert on your layout** — `bash scripts/check-rule-globs.sh`. It fails
   when a shipped custom rule matches **zero** files in your layout, i.e. it is installed but
   enforcing nothing. If it fires, widen `RULE_GLOBS` in `eslint.config.mjs`. On a brand-new
   skeleton with no source files yet it **fails by design** — every rule matches zero files. That
   is the expected first run; re-run it once your first `src/` files exist.

<!-- step: watch-a-rule-fire -->

5. **Watch a rule actually fire** — `bash scripts/check-fences-fire.sh`. It plants deliberately-bad
   input in a temp dir and asserts the installed ESLint rules go RED on it. This is the
   first-rule-fires moment: an installed rule never seen to fire is an unproven claim.

<!-- step: run-the-gate -->

6. **Run the gate you will run every day** — `bash scripts/audit-ai-docs.sh` (~10 sec). Expect
   findings on a fresh project; `INSTALL-FOR-AI.md` «Expected first-run failures» lists the normal
   ones.

<!-- step: research-your-stack -->

7. **Continue into rule research in the same session** — invoke `/rule-research`, or read
   `.claude/agents/rule-researcher.md` on a harness without skills. The installer delivered a
   curated starter set; researching stack-specific rules from live documentation is the next step
   of the same lifecycle, not a later project.

### §2.2 `env` — core + tier criteria on disk and one idea through `/arch`

<!-- step: install -->

1. **Install at env depth** — `bash <getff>/install.sh <stack> --profile env`. Already on core?
   Upgrade in place with `--refresh --profile env`: the deeper payload arrives and the core
   artefacts stay byte-identical.

<!-- step: verify-payload -->

2. **Verify the payload landed** — `ls AGENTS.md .ai-factory/ scripts/`, plus
   `.ai-factory/tier-home.md` and `.claude/skills/arch/` — the two artefacts `env` adds over
   `core`.

<!-- step: fill-passport -->

3. **Fill the project passport** — replace every `<PLACEHOLDER>` in `.ai-factory/DESCRIPTION.md`.

<!-- step: prove-rules-not-inert -->

4. **Prove the rules are not inert on your layout** — `bash scripts/check-rule-globs.sh`, then
   `bash scripts/check-fences-fire.sh` to see a rule go RED on planted input. On an empty skeleton
   `check-rule-globs.sh` fails by design (zero source files to match); re-run it once you have some.

<!-- step: read-tier-home -->

5. **Read the tier + degradation SSOT** — open `.ai-factory/tier-home.md`. It owns the Tier 0/1/2
   routing criteria and the capability-absence degradation matrix: what still works with no aif
   runtime, no executor-tier model, or a non-Claude-Code harness. `AGENTS.md` only points there;
   the criteria live in that one file.

<!-- step: arch-one-idea -->

6. **Take one idea through `/arch`** — the external design contour turns a raw idea into a reviewed
   design plus a routed handoff. On a harness without skills, read `.claude/skills/arch/SKILL.md`
   and follow it by hand.

### §2.3 `factory` — env + one task driven through the pipeline

<!-- step: install -->

1. **Install at factory depth** — `bash <getff>/install.sh <stack> --profile factory`. Pick this
   **only** if this machine runs the aif-handoff operator runtime; the factory payload dead-ends
   without it.

<!-- step: verify-payload -->

2. **Verify the payload landed** — `ls .claude/skills/`. On top of `env` you should see
   `pipeline`, `dispatcher`, `harvest`, `aif-doctor`, `night-mode`, `story` and
   `claude-glm-executor-handoff`.

<!-- step: fill-passport -->

3. **Fill the project passport** — replace every `<PLACEHOLDER>` in `.ai-factory/DESCRIPTION.md`.

<!-- step: prove-rules-not-inert -->

4. **Prove the rules are not inert on your layout** — `bash scripts/check-rule-globs.sh`, then
   `bash scripts/check-fences-fire.sh` to see a rule go RED on planted input. On an empty skeleton
   `check-rule-globs.sh` fails by design (zero source files to match); re-run it once you have some.

<!-- step: read-tier-home -->

5. **Read the tier + degradation SSOT** — open `.ai-factory/tier-home.md`: it decides which tier a
   task routes to, and what degrades when a capability is absent.

<!-- step: write-a-kickoff -->

6. **Write your first kickoff** — create `.ai-factory/orchestrator-prompts/<work-item>/kickoff.md`:
   a `Type:` line (`fix` / `research` / `feature`), the goal, and — if the work splits into
   parallel sub-steps — a `## §1 Sub-wave` section with one table row per sub-step.

<!-- step: run-pipeline -->

7. **Ask the pipeline what to start next** — invoke `/pipeline`. It reads your kickoffs plus
   `.ai-factory/orchestrator-prompts/plan.md` (created on first run), ranks them, and emits a
   launch table. An empty backlog reports «nothing queued» — normal, not an error.

<!-- step: dispatch-one -->

8. **Dispatch the top row and read the result** — dispatch the launch table's top row, then bring
   the finished branch back with `/harvest`. If a task stalls or the runtime misbehaves,
   `/aif-doctor` is the diagnostic entry point.

---

## §3 Daily cycle

The steady-state loop once First Steps is done. Every command below is shipped by the installer at
**every** depth — nothing here needs a companion tool.

1. **Before you edit** — read `AGENTS.md`, then the `.ai-factory/` doc it points at for your task
   (`RULES.md` for what is enforced, `ARCHITECTURE.md` for layer direction).
2. **While you edit** — the ESLint custom rules are the earliest channel; they fire in your editor
   and in `npm run lint`. A rule firing is the design working, not an obstacle to route around.
3. **Before you commit** — `bash scripts/audit-ai-docs.sh` (drift + code-vs-docs probes) and, when
   you touched layout or added a package, `bash scripts/check-rule-globs.sh` and
   `bash scripts/check-lintstaged-resolves.sh`. The pre-commit hook runs lint-staged on its own.
4. **On push** — `.husky/pre-push` fires automatically: typecheck, `vitest related`,
   dependency-cruiser. It is not optional and not to be bypassed with `--no-verify`.
5. **On the PR** — CI (`ci-success`) is the last-resort gate. It is the authority that does not
   depend on anyone's local tooling, which is exactly why it must never be the FIRST place a
   problem is caught.
6. **When you add a convention** — add its executable check in the same change. A convention with
   no check is not a rule; `/rule-research` and `/rule-tests` exist to make that cheap.

**Where a rule came from.** `.ai-factory/RULES.md` is the rule list; the enforcement channel per
rule is named there. If a rule seems wrong for this project, change it there with a rationale in
the PR — never silence it with an inline suppression you cannot explain.

### §3.1 Monorepo, brownfield-CI and per-package-config caveats

`AGENTS.md` points here for these. They are the cases where a gate is installed but does **not**
govern what you think it governs — a silently-inert check is worse than an absent one.

**`check-rule-globs.sh` — widening the globs.** If it reports a rule inert, widen `RULE_GLOBS` in
`eslint.config.mjs` to cover your layout. A flat / inline-router server whose routes live in
`app.ts` with no `routes/` folder needs a broader boundary glob, e.g. `apps/*/src/**`.

**`check-rule-globs.sh` — monorepos and shadowing packages.** If a workspace package ships its own
`eslint.config.*`, ESLint's nearest-config resolution means the root config **never governs that
package**. The gate accounts for this: a shadowing package is pruned from the root probe (so a file
there cannot fake a green) and checked separately.

- It has boundary files but its config does **not** wire R2 → **FAILS**. Fix: copy the custom-rule
  block into that package's config, or re-export the root config from it.
- It re-exports / extends another config → **WARNs**. Verify by hand that R2 is inherited.

**`check-rule-globs.sh` — brownfield CI.** Install never overwrites a pre-existing
`.github/workflows/ci.yml`, so on an existing repo the gate may run only in `npm run validate`.
Install prints a WARN when no workflow wires it — add `- run: bash scripts/check-rule-globs.sh` to
your lint job, or the gate is local-only and a PR can go green without it.

**`check-lintstaged-resolves.sh` — monorepos and `ENOENT`.** A single root `.lintstagedrc.json`
runs `eslint` from the repo root, where a per-package binary is not installed → `ENOENT` blocks the
commit. Fix: keep a per-package `.lintstagedrc.json` beside each package (install drops one for
every package present at install time). Re-run the check after any `npm`/`pnpm install`.

---

## §4 Degradations — what still works when a capability is absent

**This guide does not restate the matrix.** The authoritative criteria and the per-capability
degradation rows live in **`.ai-factory/tier-home.md` §3** — one file, one owner. Read it there.

Two things worth knowing before you open it:

- The doc installs at `env` and `factory` depth only. On a `core` install it is **absent by
  design**, because tier routing presupposes the multi-model contour that `core` does not ship.
- Its §3 rows are authored against current evidence and each names the probe class that will
  validate it later; the doc says so itself. Read the rows as evidenced claims, not as
  probe-verified facts.

---

## §5 Harness portability

The layers this framework ships do not all reach every AI harness equally, and the guide says so
rather than implying uniformity:

| Layer                                              | Claude Code                       | Other harnesses (Cursor, Codex CLI, Aider, Windsurf, Roo Code)                          |
| -------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------- |
| ESLint custom rules, pre-commit, pre-push, CI      | works                             | works — nothing harness-specific                                                        |
| `AGENTS.md` as session context                     | works                             | works — that is the point of the format                                                 |
| Skills (`/rule-research`, `/arch`, `/pipeline`, …) | auto-activate on relevant queries | do **not** auto-activate — read the matching `SKILL.md` by hand when the topic comes up |
| `.claude/settings.json` hooks                      | works                             | inert — layers 1-4 above are unaffected                                                 |

---

## §6 Not shipped yet — named, not described

Per this program's honesty rule, a capability that is not on disk gets an **owner and a trigger**
here instead of a section pretending it exists.

| Capability                                                 | State today                                                                    | Owner                                           | Trigger that lands it                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Launch presets (named run configurations for `/pipeline`)  | not shipped                                                                    | beta-delivery-ux S2                             | that stage merges; this guide gains a §Presets rendered from the shipped preset data |
| Park routing + status classes as a consumer-facing surface | not shipped                                                                    | umbrella C, later stage                         | a shipped park/status artefact exists to render from                                 |
| Published npm install path (`npx getff@latest init`)       | not live — the install path today is a `git clone` plus `setup` / `install.sh` | release-frame phase 2, after the R1 name freeze | the package is published under the frozen name                                       |
| Human-voiced First Steps on the project site               | not authored                                                                   | umbrella B / BS2                                | BS2 vendors the render from the §2 SSOT and adds the provenance header               |

---

## §7 Provenance

- **Framework-side source:** `packages/core/templates/shared/AI-USAGE-GUIDE.md`.
- **Consumer-side destination:** `.ai-factory/AI-USAGE-GUIDE.md`.
- **§2 SSOT:** `packages/core/templates/shared/first-steps.source.json`. Edit the JSON, then this
  render; the parity check fails on any step reordered or retitled in one of them alone.
- **Editing your installed copy — read this before you edit.** This doc is **framework-owned**
  (Layer 1 of the three-layer authority model in `INSTALL-FOR-AI.md`), not a file you are expected
  to maintain. A plain re-install leaves your copy alone: `install.sh` skips a destination that
  already exists. **`install.sh --refresh` DOES overwrite it**, on purpose — refreshing is how a
  framework doc receives fixes, and its §2 renders from a source that moves. So in-place edits
  survive a re-install but **not** a refresh. If you need yours to survive, put them in a sibling
  `AI-USAGE-GUIDE.override.md`: that file takes precedence wholesale, and `--refresh` never touches
  the base file while it exists.
