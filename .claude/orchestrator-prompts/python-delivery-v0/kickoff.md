<!-- scope: kickoff — python-delivery-v0 umbrella. Base = python-backend-v0 (closed, done.md #963): the Python render backends exist and live-fire in framework CI; NOTHING installs into a consumer yet. dispatch = I-phase stages S1-S3. -->

# python-delivery-v0 — kickoff

> **Goal of this umbrella:** a consumer PYTHON project runs `./setup python` (or `install.sh python`)
> and ends up with WORKING, FIRING enforcement: ast-grep YAML rules + `sgconfig.yml` (primary lane)
> and the ruff TID fast-path config, wired into the consumer's CI at the earliest reachable channel,
> with a post-install proof that the tools actually fire. Serves
> [README.md#why-this-exists](../../../README.md#why-this-exists) — this is the «per-toolchain
> rule-pack + installer» milestone the python-backend-v0 README draft names as next.
> **What exists (verified 2026-07-11, Explore sweep):** renderers are pure functions
> (`render-astgrep.ts:98-146`, `render-ruff.ts:97-182`) with ZERO fs writes
> (`grep -rn 'writeFileSync|mkdirSync' packages/core/backends/` → empty); their only non-test caller
> is the demo (`composition/demo/root-agents-demo.ts:141-142`). The installer is npm-only by
> construction: `install.sh:173-181` hard-requires `package.json`; stack detect reads only
> `package.json` (`install.sh:205-232`); `synthesizer/emit.ts:17-65` emits 4 ESLint/JSON files;
> `wire-eslint-r2.ts:64-89` hardcodes `eslint-rules-local/index.mjs` (and `eslint.config.mjs` at
> `:158`). There is NO toolchain seam, NO pyproject
> detection, NO `getff` binary (`README.md:10` — «getff init» = `./setup`, conceptual name only).
> **Scope decision (orchestrator, 2026-07-11):** Python lane ONLY. Cargo delivery stays render-only —
> its live-fire is unreachable even in our own CI (`cargo/firing.test.ts:38` `&& !isCI`, kickoff §8
> exception), so «installs and works» cannot be honestly claimed for it. The delivery seam MUST be
> designed toolchain-shaped (a second toolchain can plug in), but only Python ships here.
> Falsifier: if the owner wants cargo delivery despite no consumer-side firing proof, that is an
> owner override — surface, do not assume.

---

## §0 Research base + re-verify obligation

Before any stage dispatch, the executing session MUST re-verify volatile facts live (T12):

- **Pins:** `@ast-grep/cli` latest (0.44.1 at 2026-07-11) and `ruff` latest (0.15.21 at 2026-07-11)
  — re-check both at ship time; the consumer CI template pins what the framework CI pins
  (`audit-self.yml:232,242`) unless re-verification moves them (then update BOTH sides in the same
  stage, keeping the freshness gates green).
- **Consumer config collision surfaces:** how ruff resolves config when BOTH `ruff.toml` and
  `pyproject.toml [tool.ruff]` exist (docs.astral.sh, live probe — this drives the S1 collision
  policy); whether ast-grep tolerates a consumer's pre-existing `sgconfig.yml` with a second
  `ruleDirs` entry (live probe).
- **Prior-art (build-vs-reuse gate, CLAUDE.md + BFR §3):** the delivery mechanism is a NEW
  capability area — no SSOT row covers «install Python lint scaffolding into a consumer project»
  (verified: `grep -niE 'preset-python|ecosystem-python|consumer demands install'`
  `prior-art-evaluations.md` → empty). S1 MUST run the full BFR §3 mechanism (DeepWiki + WebSearch
  ≥3 phrasings each) on the problem class «bootstrap/scaffold Python linter config into an existing
  project» — obvious candidates to evaluate honestly: **pre-commit** (framework that installs+runs
  linters per-repo), **ruff's own init/config conventions**, **cookiecutter-style scaffolds**.
  Expected shape: ADAPT-or-REJECT per candidate + a BUILD-the-thin-writer verdict for our fenced
  augment-first writer — but the verdict must come from the run, not from this sentence (T20).
  NEW SSOT rows land in the same commits as the artifacts they justify.
- **SSOT rows that gate scope:** #213 (mypy DEFER) / #214 (import-linter DEFER) triggers do NOT
  fire here (no type-aware/dep-graph Python node ships in the starter set); #212/#215 are the
  ADOPTed render targets this umbrella delivers; #185 governs the ast-grep COMPANION install seam
  (`setup.d/companions.manifest:20` — unpinned by companion-install-principle.md §1; delivery-lane
  CI pinning is a DIFFERENT surface under ci-tool-pinning.md Rule A — do not conflate, T16).

## §1 Target architecture (fixed — do not re-derive)

- **Entry:** `./setup python` / `install.sh python` — a new TOOLCHAIN lane, not a fifth npm stack.
  The `package.json` precondition (`install.sh:173-181`) MUST NOT apply on this lane; detection =
  `pyproject.toml` (or explicit positional arg). Auto-detect order: explicit arg wins; else
  `pyproject.toml` present + no `package.json` → offer python lane. Keep the existing npm flow
  byte-identical when the python lane is not taken (install fingerprint baselines are the gate).
- **Node source v0 — shipped starter set, not live research.** A small curated Python
  `ConventionNode[]` data module in `packages/core` (starter pack: the `no-datetime-now` ban —
  the P5 flagship case — plus TID251/TID253-shaped import bans; ≥1 node routing to astgrep AND
  ≥1 to ruff). IR frozen (`ir/types.ts:3`) — the starter nodes use existing fields only.
  Rule-research live adapter integration is OUT of scope (recorded trigger below).
- **Render execution model — Model A, commit-time pre-render (FIXED by Phase -1; do not re-open).**
  A Python consumer has no Node by assumption, so the TS renderers CANNOT run at install time
  (the `synth-and-wire.bundle.mjs` precedent is `command -v node`-gated and silently skips —
  `setup.d/99-finalize.sh:24` — which would make the core deliverable a silent no-op here).
  Instead: the starter nodes are rendered at BUILD/COMMIT time in the framework repo; the resulting
  `sgconfig.yml` + `<rules-dir>/*.yml` + ruff fast-path config ship as static template files
  (placement parity with `templates/ts-server/github-actions-ci.yml`), copied by a pure-bash
  `setup.d/` layer (`copy_safe` pattern, `setup.d/40-configs.sh:293` precedent). MANDATORY
  companion gate (S1 deliverable + STOP line): a drift test asserting «committed rendered
  templates == render(starter nodes) byte-for-byte» (mirror of `build-synth-bundle.sh --check` /
  the T15 firing drift pattern) — a starter-node edit without template regen turns RED at pre-push.
- **Delivery writer (the new seam):** a pure-bash toolchain install step (no Node dependency on
  the consumer machine) that copies the pre-rendered templates: `sgconfig.yml` +
  `<rules-dir>/*.yml` (astgrep lane) and the ruff fast-path config (ruff lane) into the consumer
  root. Target homes: starter-node module + pre-rendered templates under
  `packages/core/templates/python/` (new dir — Phase -1 allowlist probe ran clean for
  `packages/core/templates/**`); the render-and-check script alongside the existing build scripts;
  the install layer as a new numbered `setup.d/NN-python.sh` (wired analogously to
  `setup.d/40-configs.sh` / `60-ci.sh`). Augment-first discipline (parity with `wireNRules`):
  - no pre-existing config → write whole files (framework-owned, header-marked as generated);
  - pre-existing `sgconfig.yml` → append our `ruleDirs` entry idempotently IF the §0 probe proves
    ast-grep supports it; else refuse loudly with manual instructions;
  - pre-existing ruff config (`ruff.toml` OR `pyproject.toml [tool.ruff]`) → DO NOT clobber;
    apply the §0-verified merge/precedence policy or degrade loudly (printed + logged), never
    silent. Silent clobber of a consumer file is a STOP line.
  - idempotent re-run: second `./setup python` produces zero diff (fingerprint-style check).
- **Consumer CI wiring:** a shipped workflow template (mirror `templates/ts-server/github-actions-ci.yml`
  placement pattern) running pinned installs (Rule A) + `ast-grep scan` + `ruff check` as failing
  gates. Local channel: a pre-commit/pre-push hook entry IF the S1 prior-art run lands on
  ADAPT-pre-commit; else document the local invocation — earliest-reachable-channel goal, but the
  channel choice follows the evidence, not this sentence.
- **Post-install firing proof (the «works» in the goal):** a self-check step (opt-in flag or
  printed one-liner) that plants a violation in a temp file and asserts the tool FIRES (RED), then
  cleans up — the firing-contract pattern (`firing-contract.json` shape) applied consumer-side.
  A green install that never proved firing is `#hope-as-gate`
  ([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).
- **AGENTS.md surface:** the consumer AGENTS.md template gains the Python enforcement segment ONLY
  if the composition machinery already supports it consumer-side; otherwise record the gap —
  do NOT fork the demo builder into the installer (T-PD-C).

## §2 Stages (each = one PR onto staging, branch from staging; do NOT collapse)

**S1 — starter nodes + pre-rendered templates + delivery layer (core).**
Starter `ConventionNode[]` module + commit-time render script + pre-rendered template files under
`packages/core/templates/python/` + the byte-drift gate (Model A, §1) + the pure-bash delivery
layer (astgrep + ruff lanes, collision policy per §1, idempotency) + unit/integration tests
(tmp-dir consumer simulation: fresh install / each collision cell / re-run) + BFR §3 prior-art run
+ NEW SSOT rows (delivery mechanism; starter node set) + `Prior-art:` trailers. The render script
and/or node module is a capability commit (new ≥80 LOC under `packages/`).

**S2 — entry lane + CI template + firing proof.**
`./setup python` / `install.sh python` lane (detection, no-package.json path, npm flow untouched)
+ consumer CI workflow template (pinned installs, Rule A) + post-install firing self-check +
install-sh tests for the new lane (`tests/install-sh/` pattern, `INSTALL_SH_LIB_ONLY=1` seam
`install.sh:59-61`). Fingerprint determinism: S2 ADDS `python` to the snapshot matrix
(`tests/install-sh/snapshot.sh:153` `STACKS=(...)`) + new
`tests/install-sh/baselines/python/*.fingerprint` baselines — the python lane gets the SAME
determinism gate as npm stacks (this makes §4 T15 true, not aspirational); existing npm baselines
must stay byte-identical (non-regression proof). NOTE for the S2 worker: the snapshot harness
seeds brownfield fixtures npm-shaped (`snapshot.sh:67-71` writes `package.json`) — the python row
needs its own seeding (`pyproject.toml`; brownfield variants with a pre-existing `ruff.toml` /
`sgconfig.yml` to exercise the §1 collision cells), not a naive append to the STACKS array.

**S3 — docs + closure (final).**
INSTALL-FOR-AI.md + README updates: README is maintainer-owned → PREPARED DRAFT DIFF in the PR
body (Artifact Ownership Contract), INSTALL-FOR-AI edits follow its own authority header. End-to-end
proof on a scratch consumer repo (fresh dir + `pyproject.toml` → install → plant violation → tool
fires → CI template valid) with commands + output in the PR body. The merging session writes this
umbrella's done.md — no earlier stage does.

**Scope boundaries (each behind its recorded trigger):** cargo delivery (trigger: consumer-side
cargo firing proof becomes reachable); mypy / import-linter backends (#213/#214 triggers verbatim);
`ecosystem-python.ts` pyproject trust adapter (research-plane, #197 analog); rule-research live
adapter for Python (trigger: first consumer asks for researched-not-starter Python rules); any
`getff` binary/CLI rename (separate concern, W0-T9 lineage).

**STOP lines (binding):**

- Kickoff merged to `staging` BEFORE any dispatch ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
- NO new `ConventionNode` fields (`ir/types.ts:3`).
- NO silent overwrite of ANY pre-existing consumer file — collision → §1 policy or loud refusal.
- NO regression of the npm install flow: fingerprint baselines green or the diff explicitly
  explained in the PR body.
- NO paid LLM anywhere in the delivery path ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).
- Renderers stay pure — fs writes live in the commit-time render script + the delivery layer,
  NEVER in `backends/**` render modules (surface a need to owner instead).
- Model A drift gate is NON-OPTIONAL: pre-rendered templates without the byte-drift test are
  rejected (a template that can silently diverge from its nodes is `#hope-as-gate`).
- The firing self-check plants its violation in an OS temp dir ONLY — never under the consumer's
  tracked tree — asserts RED, and removes it; a probe that can leave a violation in the consumer
  repo is rejected.
- done.md ONLY at the S3 final-PR merge.

## §3 Discipline

- Branch per stage, base `staging`; suites green: `npm --prefix packages/core run test:principles`,
  `test:backends`, `test:composition`, plus `tests/install-sh` where touched; §1.7 Forward/Backward
  in each PR body (gated for `backends/**`/`synthesizer/**` paths; write them for every stage
  regardless).
- `Prior-art:` trailer on every capability commit; new SSOT rows in the same commit as the artifact.
- Backward-check per [ai-laziness-traps.md T21](../../rules/ai-laziness-traps.md): enumeration
  format; cold sub-agent (`agents/backward-sweep-auditor.md`) for S1 and S3 — sibling surfaces are
  the npm delivery pipeline (does the change-class hold for `synth-and-wire`/`setup.d` layers?) and
  the shipped-template population (`install.sh:121-170` SHIPPED_DOCS gate, fingerprints).
- Phase -1 principle-test allowlist probe (CLAUDE.md §Operational conventions) — S1/S2 ship NEW
  files under watched paths (`packages/core/templates/**` if templates are added).

## §4 AI-laziness traps (principle-12 compliant)

Per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) and §3:

**Active traps: T1, T3, T5, T11, T12, T15, T16, T20** (one-line why each):

- **T1** — collision-policy matrix (no-config / sgconfig-exists / ruff.toml-exists / pyproject-tool-ruff-exists / re-run) — verdict every cell, not the happy path.
- **T3** — every «ruff/ast-grep resolves config like X» claim carries a fired command + output; the §0 probes are mandatory, not decorative.
- **T5** — delivery stages do not «fix» renderers or the npm pipeline mid-flight; findings → PR body.
- **T11** — the delivery writer needs the BFR §3 run (pre-commit et al.) BEFORE «I propose a writer»; SSOT consult first.
- **T12** — both tools ship weekly; pins re-verified at ship, never from this doc.
- **T15** — self-application: the installer that delivers enforcement is itself gated (install-sh tests + fingerprint baselines + idempotency check are the installer's own paired-negative).
- **T16** — «companion manifest already installs ast-grep» is a name-match: #185 is the unpinned SEARCH-surface companion; the delivery lane needs the pinned Rule-A surface. Two different surfaces, two different pinning policies — do not merge them.
- **T20** — no ADOPT/BUILD verdict on the delivery mechanism without the §0 evidence run quoted.

**Domain-specific traps:**

- **T-PD-A** — «install succeeded = enforcement works». Counter: the post-install firing proof
  (plant violation → tool fires RED) is a mandatory S2 surface; an install that never fired is
  not done (T-PY-A lineage, consumer-side).
- **T-PD-B** — «clobber the consumer's ruff/sgconfig because ours is generated». Counter: §1
  collision policy; silent overwrite is a STOP line; every degrade is printed + logged.
- **T-PD-C** — «fork the demo/composition builder into the installer because the name matches»
  (T16 shape). Counter: composition machinery stays framework-side; consumer AGENTS.md segment
  only via existing supported seams, else recorded gap.
- **T-PD-D** — «test the writer only on a fresh empty dir». Counter: T1 matrix — collision and
  re-run cells are first-class test fixtures, tmp-dir consumer simulations in S1.
- **T-PD-E** — «regenerate install fingerprints to green without reading the diff» (canonical
  lesson: byte-identical-baseline-regen memory). Counter: any fingerprint change is explained
  line-by-line in the PR body; unexplained regen = review rejection.

## §5 See also

- [../python-backend-v0/kickoff.md](../python-backend-v0/kickoff.md) + [done.md](../python-backend-v0/done.md) — the closed parent umbrella (render backends this one delivers).
- [research-patches/2026-07-02-multi-toolchain-generalization.md](../../../docs/meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md) — §Lifecycle :254-255 (install/lock/drift named as the open task), :263-275 (npm-only pipeline admission).
- [specs/2026-07-03-multi-toolchain-convention-compiler-design.md](../../../docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md) — §5 surface 6 (lockfile/detector, post-MVP :150,161,194).
- [.claude/rules/ci-tool-pinning.md](../../rules/ci-tool-pinning.md) (Rule A) vs [companion-install-principle.md](../../rules/companion-install-principle.md) (no-pin companion surface) — the T16 pair.
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — #212/#215 (render targets), #213/#214 (DEFER triggers), #185 (companion seam), #197 (ecosystem adapter precedent).
- `setup.d/` layer engine + [tests/install-sh/](../../../tests/install-sh/) — the install surfaces S1/S2 extend.
