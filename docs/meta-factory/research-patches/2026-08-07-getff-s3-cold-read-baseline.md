<!-- scope:getff-any-stack-trace-s3-cold-read -->

# S3 cold-read baseline (BEFORE) — recorded under kickoff §3 + plan Task 0

> Scope: getff-any-stack-trace S3, BEFORE state at HEAD `2923ba6f4` (2026-08-07).
> One patch per gap, append-only per the folder convention. Quoted verbatim into PR body §1.7 + Fidelity per plan Task 9.

## Anchor re-verification (kickoff §1 — re-verified live)

| Anchor | Command + result |
|---|---|
| `agents/rule-researcher.md` (158 lines) | `grep -niE 'python\|pyproject\|ruff'` → **0 hits**. Wall #4 of the spec confirmed. |
| `INSTALL-FOR-AI.md` | `grep -niE '/rule-research\|same session\|opt-out'` → **0 hits**. Continuation clause absent. |
| `packages/core/templates/shared/AGENTS.md.template` (11800 bytes) | exists; `grep -niE 'rule-research\|opt-out\|same session'` → **0 hits** (no continuation clause on the delivered starter AGENTS.md). |
| `packages/core/install/rule-bootstrap-cli.ts` (17950 bytes) | exists; the `--from-practice` arm. |
| `setup.d/45-python.sh` | `_py_join_researched_rules` at line 161; called at line 203. |
| `packages/core/install/synth-and-wire.bundle.mjs` | **395 155 bytes** (matches kickoff). |

## Predecessor-merge state (kickoff §1 — T3 trap)

- S1 #1166 (`ceddb4b03`) → **on staging** (`git log origin/staging --grep='#1166'` confirms).
- S2 #1169 (`61f4a7674`) → **on staging**.
- S2b #1233 → **NOT on staging** (`git log origin/staging --grep='#1233'` empty). The S2b feature branch `feature/getff-any-stack-trace-s2b-b2afc5` exists with 2 commits (`df287df47` feat + `0906ccd8d` SSOT) ahead of origin/staging; the PR is unmerged.
- Implications for S3 noted in the plan: S3 does not edit S2b's surfaces; the python host-verify arm may SKIP on ast-grep/ruff in containers; the SSOT next-free ID is load-bearing (the S2b row #235 was never re-numbered into staging — re-grep at commit time).

## BEFORE cold-read — derived command sequence (the §3 test)

Reading ONLY `INSTALL-FOR-AI.md` + `packages/core/templates/shared/AGENTS.md.template` + `agents/rule-researcher.md`, as a cold consumer agent would:

**Author→render→join→lock sequence (ESLint / npm lane — what the shipped docs DO yield):**

1. **Author** (rule-researcher.md §"Output contract"): write `.ai-factory/rules-research/<stack>.research.json` (a `ResearchPlan`) + `.ai-factory/rules-research/<stack>.selection.json` (a `GenerateSelection`), per the schema in the file. Filter to L4-expressible single-token-diff candidates.
2. **Render** (rule-researcher.md §6): "tell the operator to run `./setup --full` (or re-run it) to synthesize."
3. **Join** (implicit in `./setup --full`).
4. **Lock** (implicit in `./setup --full`).

**Sequence for the python / ast-grep lane — what the shipped docs YIELD:** none. A cold consumer agent reading only the three shipped docs cannot derive any of the four steps for python:

- **Author:** no `AstgrepResearchedPractice` JSON path or schema is documented in any of the three files. The python lane's `.getff/rules-research/<entryId>.practice.json` shape is absent.
- **Render:** no `rule-bootstrap-cli.ts --from-practice` invocation is documented. INSTALL-FOR-AI.md's python segment covers framework install only; AGENTS.md.template has no python lane marker; rule-researcher.md has no python arm.
- **Join:** no `_py_join_researched_rules` consumer-side step is documented.
- **Verify:** INSTALL-FOR-AI.md mentions `ast-grep scan` as a CI gate but does NOT document the researched-rule loop's verify step.

**Files a cold agent would have to open BEYOND the three to complete the loop (the defect being fixed):**

1. `packages/core/install/rule-bootstrap-cli.ts` — to discover the `--from-practice` CLI.
2. `packages/core/synthesizer/research-to-node.ts` — to find the `AstgrepResearchedPractice` schema.
3. `setup.d/45-python.sh` — to find `_py_join_researched_rules`.
4. `packages/core/synthesizer/fixtures/live-generation/getff-researched-no-yaml-load.practice.json` — to find a committed example.

**Continuation clause (spec §6.1 / D1):** absent on both surfaces. INSTALL-FOR-AI.md step 9 instructs the agent to "Stop here. Do NOT start implementing features." No clause directs the installing agent to continue into `/rule-research` in the same session; no opt-out mechanism is named.

## Verdict

Wall #4 of the spec (the researcher agent documents no python path at all) is confirmed. Wall #5 (no continuation clause from install into research) is confirmed. The routing loop for python is open in the shipped docs — closing it on the shipped surfaces (not by asking the consumer to read framework sources) is what S3 does.

---

## F-A verdict — recorded under plan Task 1 + spec §12 (resolve, don't park)

**Fork:** for the python lane's research-render step, **bundle** (`synth-and-wire.bundle.mjs` precedent — zero-runtime-dep `.mjs` the consumer `node`s directly) vs **declare honestly** ("generation needs Node — run `npx tsx …` from the framework checkout; the python install itself stays Node-free"). Either way, the python-lane INSTALL stays Node-free — non-negotiable, not part of the fork.

### The measurement (T-S3-C — produced, not resolved-from-existence)

1. **Bundle precedent size.** `wc -c packages/core/install/synth-and-wire.bundle.mjs` = **395 155 bytes** (matches kickoff §1). Real, firm number.

2. **Bundle precedent maintenance cost.** `wc -l scripts/build-synth-bundle.sh` = **74 LOC**, of which lines **42-50** carry a documented env-specific drift workaround:

   > *"Normalize env-specific node_modules resolve paths that esbuild embeds as module-map keys + comments (e.g. `packages/core/node_modules/semver` under a workspace install vs `node_modules/semver` under root-hoist). Without this the committed bundle is NOT byte-reproducible across npm layouts and the --check drift-gate fails environment-dependently (CI hoists differently than a local workspace install)."*

   Real maintenance cost: a `sed -i.bak -E` normalization step + a `--check` drift gate + a banner-line `require` shim for ajv (CJS) bundled into ESM (script line 27). Cited as the primary evidence; the script is its own documentation.

3. **The 2026-08-07 S2b-egress synth-bundle drift incident** (kickoff §2 item 3 cites it). No dedicated research-patch located under `docs/meta-factory/` for this exact incident (grepped `synth-bundle drift`, `synth-and-wire.*drift`, `bundle.*drift`, `2026-08-07`, `s2b.*egress`). The kickoff's claim is consistent with — and operationally the same shape as — the maintenance cost the script's own comment at lines 42-50 documents (npm-layout drift biting the `--check` gate). Per kickoff §2: *«that is a real datapoint about bundle maintenance cost, cite it or refute it»*. Cited via the script's own documentation of the failure class; refuted-as-no-dedicated-patch. Both outcomes are valid T-S3-C outputs; silence was not the option.

4. **rule-bootstrap-cli.ts `--from-practice` arm import graph** (re-verified live, T3):
   - `rule-bootstrap-cli.ts:51-62` statically imports: `synthesizer/file-clients.ts`, `research/validate-plan.ts`, `synthesizer/render-researched-astgrep.ts`, `synthesizer/resolve-ctx.ts`, type-only `AstgrepResearchedPractice` from `synthesizer/research-to-node.ts`.
   - `synthesizer/research-to-node.ts:43` statically imports `runGrammarGate` from `ir/gates/grammar.ts`.
   - `ir/gates/grammar.ts:13` statically imports `makeSchemaValidator` from `diagnostics/ajv.ts`.
   - `diagnostics/ajv.ts:12` statically imports `{ Ajv }` from `'ajv'`. **The `--from-practice` arm DOES transitively reach ajv** — same CJS-in-ESM shape the existing precedent handles via the banner-line `require` shim.
   - `synthesizer/resolve-ctx.ts:28-33` statically imports the 4 ecosystem adapters (npm/cargo/python/go). `research/ecosystem-python.ts` = 334 LOC, only `node:fs`/`node:path`/type-only imports — lightweight.
   - **The ESLint preset is NOT transitively reached.** `rule-bootstrap-cli.ts:42-50` documents it and `:309` confirms the live arm (`runRuleBootstrap`) is the only dynamic-import site. `grep -rn "from '@rules-as-tests/preset" packages/core/synthesizer/render-researched-astgrep.ts packages/core/synthesizer/research-to-node.ts packages/core/synthesizer/resolve-ctx.ts packages/core/research/{ecosystem-python,validate-plan}.ts packages/core/ir/gates/grammar.ts packages/core/synthesizer/file-clients.ts` → 0 hits. The kickoff's question (a) ("pull in the ESLint preset transitively") answers NO.
   - **Estimated size of a `--from-practice`-only bundle:** a strict subset of the precedent's import graph (the precedent bundles the FULL `synth-and-wire.ts` which adds the live arm + L4 + the validator preset chain via the dynamic import at `:309`). The from-practice arm pulls in strictly less. Estimate: **< 395 KB**, no size explosion. Not bundle-built (no `esbuild` binary in container at `packages/core/node_modules/.bin/esbuild` — the size figure here is the upper bound from the precedent, not a fresh measurement). Per spec §12 escape hatch this is not the ambiguous-bundle case (size figure IS established, as a strict-subset upper bound).

### Decision (spec §12 criteria applied to the measurement)

Spec §12 verbatim: *bundle wins if the bundling precedent covers ajv/grammar-gate imports without exploding size; declare wins if bundle maintenance cost exceeds the honesty cost.*

- **ajv/grammar-gate coverage:** YES — the precedent already covers ajv-in-ESM via the banner `require` shim. No size explosion (strict subset of the precedent's graph).
- **Maintenance cost (REAL):** 74-LOC script with a documented env-drift normalization step; one historical incident of bundle drift (S2b egress, 2026-08-07); adding a from-practice bundle requires wiring a SECOND drift gate (`scripts/build-synth-bundle.sh` extension or sibling `--check`), otherwise the bundle rots silently (per plan Task 1: *"the build script must be wired into `scripts/build-synth-bundle.sh` or a sibling `--check` drift gate; otherwise the bundle rots silently"*).
- **Honesty cost (REAL):** ONE documented sentence in `INSTALL-FOR-AI.md` python segment + `agents/rule-researcher.md` python arm: *"generation needs Node — run `npx tsx …` from the framework checkout; the python install itself stays Node-free."* Zero maintenance. Zero drift surface.

**Verdict: DECLARE.** The maintenance cost axis (criterion B) is decisive: a SECOND drift gate + the documented drift incident + the env-normalization sed step exceeds the cost of one documented sentence. The bundle's marginal benefit (consumer does not need `npx tsx` for the render step) is bounded — the consumer already has the framework checkout (cloned for `install.sh`) and `npx tsx` is the framework's standard CLI invocation pattern. The python-lane INSTALL stays Node-free in both branches; the fork concerns only the generation step.

**Consequence for the PR:**
- NOT a capability commit. No new file ≥50/80 LOC, no new build-script dep. The python install path is unchanged.
- The `Prior-art: skipped — <reason ≥20 chars>` hatch applies (per plan Task 9 format check 5; e.g. `Prior-art: skipped — docs-only edit, no new capability (F-A resolved to DECLARE: generation needs Node, documented honestly)`).
- Binding-site comment lands at BOTH:
  1. `agents/rule-researcher.md` python arm (Task 4) — the Node-at-generation-time instruction.
  2. `INSTALL-FOR-AI.md` python segment (Task 2) — where the consumer's installing agent reads it.

The full measurement is quoted verbatim into the PR body under a `## F-A verdict` H2 per plan Task 1 + kickoff §2 item 3.

---

## AFTER cold-read — derived command sequence (the §3 test, post-Task 2/3/4/5)

Re-performed at HEAD post-edit (plan Task 6). Reading ONLY `INSTALL-FOR-AI.md` +
`packages/core/templates/shared/AGENTS.md.template` + `agents/rule-researcher.md`, as a cold
consumer agent would.

### Python lane — author→render→join→lock sequence (now derivable from shipped docs alone)

1. **Author** an `AstgrepResearchedPractice` JSON at
   `<consumer>/.getff/rules-research/<entryId>.practice.json` — schema + minimal shape documented
   in `agents/rule-researcher.md:170-202` (the file reproduces the full minimal JSON inline plus
   cites `packages/core/synthesizer/research-to-node.ts:66` for the schema and
   `packages/core/synthesizer/fixtures/live-generation/getff-researched-no-yaml-load.practice.json`
   for a committed example — the cold agent does NOT need to open either; the inline shape is
   sufficient). MAJOR-1 L4-expressibility filter documented at `agents/rule-researcher.md:174-177`.

2. **Render** it (F-A DECLARE — **generation needs Node**):
   ```bash
   npx tsx packages/core/install/rule-bootstrap-cli.ts \
     --from-practice <path-or-dir> \
     --consumer-root <consumer>
   ```
   Documented in `agents/rule-researcher.md:204-211`. The F-A verdict binding-site HTML comment
   at `agents/rule-researcher.md:212-221` explains why the install stays Node-free while this
   step requires Node (the consumer has the framework checkout already; `npx tsx` is the
   standard pattern). Output: `<consumer>/.getff/rules-research/<entryId>.yml` (durable home).

3. **Join** to the scan dir — automatic on the next `bash install.sh python --refresh`.
   `_py_join_researched_rules` (`setup.d/45-python.sh:161`, called at `:203`) copies each
   `rules-research/*.yml` into `.getff/astgrep-rules/` via the consumer's existing `ruleDirs:`
   entry in `sgconfig.yml`. Documented in `agents/rule-researcher.md:228-236`. No new delivery
   channel — rides the `.getff/` namespace the seam already owns.

4. **Verify** — two reachable paths documented in `agents/rule-researcher.md:238-245`:
   - Re-run the install's firing self-check (`bash install.sh python --refresh`) — plants a
     violating `.py` in OS temp dir + asserts RED; after step 3's join, the researched rule is
     in the scanned set.
   - Local live-fire — plant a violating `.py` in OS temp dir + run `ast-grep scan` locally;
     the researched rule fires RED. CI (`getff-python.yml`'s `ast-grep scan` job) gates every push.

### `--refresh` reachability check (brownfield consumer)

The same loop works on a brownfield consumer that re-runs `bash /tmp/getff/install.sh python
--refresh`. Evidence quoted from `agents/rule-researcher.md:223-226`:

> *"The CLI writes `<consumer>/.getff/rules-research/<entryId>.yml` — a **durable** home that
> SURVIVES `install.sh --refresh` (refresh_safe rm-rf-replaces `.getff/astgrep-rules/` from the
> template on every refresh, so a researched rule can never live there as its only copy —
> `setup.d/45-python.sh` `_py_join_researched_rules` header comment, lines 147-160)."*

The durable home `.getff/rules-research/` is not clobbered by `--refresh`; the join
re-assembles `.getff/astgrep-rules/` from `rules-research/*.yml` on every refresh pass. Loop
preserved.

### Continuation clause (spec §6.1 / D1) on BOTH surfaces

- **`INSTALL-FOR-AI.md:531-560`** — `## After install — continue into /rule-research in the
  same session` H2 section. Tells the install-time agent: proceed directly into `/rule-research`
  after install is verified, before reporting back to the operator. Stopping rule: skipped ONLY
  on explicit operator opt-out. The opt-out SHAPE is parked with 3 candidates named (env var /
  prompt / documented sentence) + safe-default prompt behaviour specified.
- **`packages/core/templates/shared/AGENTS.md.template:104-113`** — `## Rule research —
  continue post-install and on demand` H2 section. Tells the consumer-time agent: research is
  part of the framework lifecycle; the post-install session is its first natural invocation
  point; `/rule-research` re-invocable on demand; per-stack honest limits live in
  `agents/rule-researcher.md`.

### Rust arm — pointer state (no false promise)

`agents/rule-researcher.md:262-291` documents the rust arm as a POINTER:
- The clippy bridge files are cited (`packages/core/synthesizer/research-to-clippy-node.ts` +
  `render-researched-clippy.ts`); the verify step is `cargo clippy` with
  `clippy::disallowed_methods`.
- The consumer delivery lane `setup.d/46-cargo.sh` is plainly named as NOT-YET-PRESENT (R1
  audit `getff-any-stack-trace-r1`); no `_cargo_join_researched_rules` helper today.
- Closing the rust arm honestly = S4 / widening scope (park trigger respected, not extended).

A cold consumer reading this file sees "rust is at the same Model A′ shape as python" AND
"delivery lane does not yet exist" — no silent promise.

### Go lane — out of scope (one sentence)

`agents/rule-researcher.md:293-299`: `setup.d/47-go.sh` + `do_go_lane` landed 2026-08-06
(#1171, AFTER this protocol was authored); go is out of scope for the stages that shipped this
file (kickoff §1 + §6 anti-scope). When a go arm is added in a future stage, this section will
be extended. A go consumer reading this file sees the absence as an honest "not yet", NOT a
silent promise.

### Files a cold agent would have to open BEYOND the three to complete the python loop

**NONE.** The shipped docs yield the full author→render→join→lock sequence for python
directly. The schema reference and committed example are CITED but the minimal shape is
reproduced inline (the cold agent does not need to open them to complete the loop). The
`setup.d/45-python.sh` reference for the join is CITED with line numbers but the join
behaviour is described inline in the shipped docs.

The §3 acceptance criterion is MET for python. Rust + go are honestly named as not-yet / out-of-scope.

### Verdict (the §3 «Works» judgment)

The stage is **DONE** on the load-bearing criterion: a cold read of ONLY
`INSTALL-FOR-AI.md` + the delivered `AGENTS.md` (template) + `agents/rule-researcher.md`
yields the full author→render→join→lock command sequence for the python lane, with the F-A
decision recorded at the binding site, the continuation clause on BOTH surfaces, and honest
lane limits per stack.

---

## §1.7 self-reflexive note

**Forward-check applied.** Complies with
[`doc-authority-hierarchy.md §5`](../../../.claude/rules/doc-authority-hierarchy.md) — this file
sits under `docs/meta-factory/research-patches/`, a folder-level-authority directory whose
`README.md` owns the scope statement; individual patches are scope-bound by gap and carry no
per-file `Authoritative for:` header (`.claude/rules/doc-authority-hierarchy.md:104`). Complies
with [`no-paid-llm-in-ci.md §1`](../../../.claude/rules/no-paid-llm-in-ci.md) — every measurement
in this patch is a `wc`/`grep`/`sed` result quoted verbatim; nothing here adds a CI-side LLM call
(`agents/rule-researcher.md:212` is an HTML comment, not an execution path). Complies with
[`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md) — the F-A
verdict is **DECLARE**, i.e. the *narrower* branch: no bundle is built, no new build step is
added, the existing `npx tsx` invocation pattern is reused. Complies with
[`destination-environment-verification.md §1`](../../../.claude/rules/destination-environment-verification.md)
— the stage's `host-verify` contract was run on the host (Darwin), 3/3, not inferred from the
container's result.

**Backward-check applied.** Class of this change = *shipped instruction surfaces that tell a
consumer agent how to research and deliver a rule for its lane*. Enumerated surfaces, each
verdicted:

- **npm/ESLint lane** — `agents/rule-researcher.md` §"Output contract". SWEPT-CLEAN: the pre-existing
  protocol is untouched and is now explicitly labelled as the npm arm rather than as "the" protocol
  (`agents/rule-researcher.md:170` opens the per-stack section *below* it).
- **python lane** — `setup.d/45-python.sh:161` (`_py_join_researched_rules`), called at `:203`.
  GAP-FOUND → closed by this stage; the helper is now reachable from the shipped docs.
- **cargo lane** — `setup.d/46-cargo.sh`. GAP-FOUND, deliberately NOT closed: no
  `--from-rust-practice` CLI arm and no `_cargo_join_researched_rules` exist, so the arm ships as a
  documented POINTER with the residual gap named (`agents/rule-researcher.md:262`), never as an
  implied-closed loop.
- **go lane** — `setup.d/47-go.sh` (landed 2026-08-06, #1171, after the stage spec was written).
  GAP-FOUND, out of scope by the stage's §6 anti-scope, and stated as an honest "not yet" on the
  shipped surface rather than left silent (`agents/rule-researcher.md:293`).
- **delivered starter AGENTS.md** — `packages/core/templates/shared/AGENTS.md.template`.
  GAP-FOUND → closed; the continuation clause now exists on BOTH surfaces, which is the
  T-S3-A countermeasure.

The surface list above is deliberately **larger than this change's diff**: cargo and go are swept
and verdicted without being edited, per [`ai-laziness-traps.md §2 T21`](../../../.claude/rules/ai-laziness-traps.md).

**Self-application (T15).** The artefact under change is the framework's own instruction to an
agent, so the stage's acceptance test is itself a self-application: the §3 criterion was executed
by reading the shipped docs AS the cold consumer agent and transcribing the derived command
sequence (see "AFTER cold-read" above), not by asserting that the docs "now mention python" — the
T14 distinction between coverage and correctness.
