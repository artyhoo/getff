<!-- scope:core-and-self-application -->
# «Only the core ships» and «getff uses what it ships»: the design as written vs the code

> Scope: the evidence behind operator premises P15 and P16 of the one-button chain design
> ([spec §2](../../superpowers/specs/2026-09-28-one-button-chain-design.md)). The operator asked to
> «заресерч в проекте как это было задумано и должно было быть реализованно» before the spec
> changes. The decisions this evidence feeds are the spec's rows R6-1…R6-6; this patch decides
> nothing. All citations are against `8617beedccf` (`origin/staging` plus docs-only commits).

## Problem

After spec r5 the operator set two premises:
- **P15:** rules are generated from the stack (docs, MCP servers, skills with patterns and
  anti-patterns); only the core ships, the universal principles no research may generate, from
  which every other rule and test derives.
- **P16:** recursive self-application means getff uses on itself everything it installs for
  consumers: doc rules, AI rules, architecture, the passport.

Two questions: was this the project's own design, and how far is the code from it?

## Method

Two cold read-only seats, one per premise, each handed the questions and repository paths only.
The authoring session re-ran the anchors this patch cites (listed in §1.7 below). Every finding
carries `file:line` with the line's content, or a command with its output (T3).

## §1 P15 — the core was designed, never shipped

**The design is written, as a target.**
- `docs/meta-factory/architecture.md:16` «Layer 0 — Invariant Core (никогда не генерится)». Its
  table (`:32-38`): principles («если генерировать — теряется опора»); meta-rules («every rule has
  executable check», «no tautology», «documents lie», «Критерии валидности любого LLM-output»); the
  workflow contract; the manifest schema; generic stack-independent R-rules; the validator;
  audit-self. `:7` says the document describes the target layers, not what is built.
- `docs/meta-factory/PROPOSAL.md:37-47`: invariant core + detected stack + research (context7,
  WebSearch) → generated rules → self-validation by the core → install only validated rules.
  `:235` «Invariant core — ядро мета-фабрики, которое не генерится и определяет принципы.»
- `README.md:63` «Generate enforcement rules from principles, not from copy-pasted presets.»
- So P15 restates the project's original L0 design; it is not a new idea.

**What ships as «core» today.**
- The only definition in force is a 2-stack test: `docs/meta-factory/closed-questions.md:129`, a
  rule is invariant IFF its `stack` field holds both `ts-server` and `react-next`.
- Four custom ESLint rules are copied to every npm stack (`setup.d/40-configs.sh:203` «Generic
  rules (core)»). Two are library-bound (Zod, OpenTelemetry); react-native enables none
  (`grep -c 'rules-as-tests/' packages/preset-react-native/templates/eslint.config.rn-common.mjs`
  → `0`).
- The principles do not ship: `setup.d/10-skills.sh:331` says the `.claude/rules/` corpus «does NOT
  ship». `research-patches/2026-06-28-rule-bootstrapping.md:158` counts «the 29 principle tests»
  as shipped to all stacks; no copy step exists.
- One layered dependency-cruiser preset (hexagonal, FSD, library bans) ships to every npm stack
  (`setup.d/40-configs.sh:449`).
- «Core» has four senses in the repo: the L0 core, the `packages/core/` directory, the #219
  generation engine, and the `--profile core` install depth.

**What generation can and cannot do.**
- Cross-file import boundaries are «a research-only finding» (`agents/rule-researcher.md:117`), so
  architecture rules cannot be generated today.
- Skills and MCP servers are discovery, not provenance: a tool's own result URL «is NOT valid
  provenance» (`agents/rule-researcher.md:111`); the recursion into newly found tools is one line
  (`:109`).
- «Search the docs for best practices» exists as a protocol step, not as a standing rule: the
  shipped dependency hook names only `/tool-bootstrapping` and `/rule-tests`
  (`.claude/hooks/deps-hash-check.sh:533`, `:540`).
- Presets were declared a bridge and an oracle: `docs/superpowers/specs/2026-06-22-stage-2-generate-path-design.md:14`;
  the 2026-06-29 ruling demoted them to fallback without deleting them
  (`.claude/orchestrator-prompts/live-research-default-delivery/done.md:4`).

## §2 P16 — getff does not use most of what it ships

**What «recursive self-application» means in the repo.**
- `README.md:70` «`make self-audit` green = the framework's own conventions don't drift»;
  `Makefile:3` `self-audit: pre-commit-check pre-push-check principles-meta-tests`.
- The broad reading appears only as the failure to avoid (`docs/meta-factory/self-application.md:14`),
  and the chosen fix built author-own hooks independent of the shipped templates (`:96`).

**The split is enforced by design.** `packages/core/hooks/pre-push.ts:2522`
`isFrameworkRepo ? 'maintainer' : 'consumer'` and `:2531` `s.owner === 'both' || s.owner === wanted`:
consumer pre-push sections never run on getff. Principle 32 locks it
(`packages/core/principles/32-prepush-section-owner.test.ts:13-15`).

**Tally over 16 shipped groups** (seat probe: a presence loop over consumer paths at the repo
root, plus the enforcing mechanism per group). 4 run on getff by the same mechanism (skills, 6 of
9 Claude Code hooks, MCP, worktree scripts); 4 by a getff-own mechanism (doc-authority, typecheck
and scoped Prettier, pre-commit/pre-push, CI); 7 are absent or test-only (the live doc audit,
ESLint and custom rules, dependency-cruiser, guard scripts, coverage and mutation floors, the
passport, generated rules); 1 is inconclusive (skill-context overrides in the PC container).

**Probes.**
- Passport: `ls .ai-factory` → four json files; `ls .getff` → `No such file or directory`.
- The shipped doc auditor has an authoring-repo mode (`packages/core/audit-self/audit-ai-docs.ts:69`
  `isAuthoringRepo`), and no gate calls it. Run live, it ends `2 PASS, 2 FAIL, 2 WARN`, `EXIT=1`:
  D3 (CLAUDE.md lacks the canonical goal phrase) and D5 (10 files; 6 are gitignored build output,
  4 are tracked and real).
- Rule research on getff's own stack: `packages/core/detector/expected-self-detect.json:17`
  `"applicable": []`; no `rules-lock.json`, no `.getff/rules-research/`.
- No parity gate: `grep -il parity packages/core/principles/*.ts` hits cover the hook-twin,
  plugin-manifest, rule-channel, adapter-arm and generator-arm axes; none compares the shipped set
  with getff's own. The inverse axis fails too: the 600-line gate, markdownlint and principle tests
  are framework-only, so parity needs an exemption list in both directions.
- The shipped files are already enumerated per stack: `tests/install-sh/baselines/<stack>/*.fingerprint`
  (`<sha256>  <path>` per delivered file).

## §3 Conclusions (inputs to the spec, not decisions)

1. P15 is the original design; the code drifted: the core was never a shipped artefact, and
   presets ship as if universal. → spec R6-1 (what the core is), R6-3 (presets).
2. Architecture under P15 must come from research, and generation cannot express it yet; the
   honest state is «not generated yet». → R6-2 (supersedes R5-9).
3. Skills and MCP servers stay discovery; a rule cites a canonical doc. → R6-4.
4. «Search the docs» becomes machine form through the chain and the dependency hook. → R6-5.
5. P16 is new scope beyond P12; the install fingerprints make a two-way shipped-list gate cheap. →
   R6-6.

## §4 Coverage and confidence (T6, T14)

- P15: 6 of 6 questions answered from repo files; one claim rests on operator memory and is not
  cited here. What the operator means by «core» was INCONCLUSIVE-needs-human; the spec answers it
  from the operator's own words (R6-1) and the operator confirms it at the r6 approval.
- P16: 15 of 16 groups verified mechanically; the skill-context overrides in the PC aif container
  are INCONCLUSIVE-needs-host-probe. The docs site is not installed into consumers and is out of
  scope.
- Calibration: first run of this sweep; the seat's anchors were off by one line once
  (`self-application.md:97` is `:96`), so expect small line drift in unverified seat anchors.

## Solution

The spec folds this as round 6 (R6-1…R6-6) with three operator forks (R6-2, R6-3, R6-6) and a new
slice «Core and self-application».

## Prevention

- The shipped list (R6-6) turns «does getff use what it ships» from attention into a principle test
  that fails when a fingerprinted path has no row.
- The `core` / `preset` tag (R6-1) keeps a preset from being read as universal again.

## Tags

`core` · `invariant-core` · `presets` · `self-application` · `dogfood` · `one-button-chain`

## §1.7 self-review

### §1.7 Forward-check applied

- Every anchor in §1 and §2 was re-run by the authoring session on `8617beedccf` before this patch
  was written: `architecture.md:16`, `PROPOSAL.md:37-47`, `:235`, `README.md:63`, `:70`,
  `Makefile:3`, `closed-questions.md:129`, `40-configs.sh:203`, `:449`, `10-skills.sh:331`,
  `rule-researcher.md:109`, `:111`, `:117`, `pre-push.ts:2522`, `:2531`, principle 32 `:13-15`,
  `audit-ai-docs.ts:69`, `expected-self-detect.json:17`, `deps-hash-check.sh:533`, `:540`,
  `self-application.md:14`, `:96`, and the fingerprint format.
- The live doc-audit result is the seat's command output; the authoring session re-ran it
  before this patch (log kept in the session scratchpad).

### §1.7 Backward-check applied

- Earlier documents this evidence contradicts: `2026-06-28-rule-bootstrapping.md:158` («29
  principle tests» shipped to all stacks) and `closed-questions.md:129` (the 2-stack core test).
  Both are historical or closed records and are not edited; the spec records the replacement
  (R6-1) instead.
- Recursive: this patch is itself a doc getff would audit. It carries its scope line and this
  self-review, as principles 10 and 13 require of every research patch.
