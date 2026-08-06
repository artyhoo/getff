<!-- scope: stage kickoff — beta-delivery-ux S5 (contour skills shipping + runtime-bridge vendoring, spec A7/A8). Dispatch input for ONE buildable task; the umbrella plan lives in ../beta-delivery-ux-meta-launch/kickoff.md and is NOT this file's scope. Tier 2 (no bridge-profile marker): top tier plans, executor implements + reviews. -->

# beta-delivery-ux S5 — contour skills shipping + runtime-bridge vendoring (A7/A8)

> **Type:** execution-build (wiring + vendor), single PR onto `staging`.
> **Binding design:** [`docs/superpowers/specs/2026-07-23-beta-program-design.md`](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md)
> §4 **A7, A8** are the design SSOT. On any divergence between this kickoff and the spec,
> **the spec wins** — surface the divergence, never improvise past a binding decision.
> **Umbrella context (read-only):** [`../beta-delivery-ux/kickoff.md`](kickoff.md) §2 row S5 +
> [`../beta-delivery-ux-meta-launch/kickoff.md`](../beta-delivery-ux-meta-launch/kickoff.md) §4 Stage 2 (S5 bullet).
> **Base branch:** `staging`.

## §0 Goal

Two wiring/vendor artefacts that make the contour work on a consumer (non-framework) repo:

1. **Contour skill shipping (A8)** — **wiring-only** additions of `/arch` and
   `claude-glm-executor-handoff` to the shipped skill sets in `setup.d/10-skills.sh` (`env`/`factory`
   profiles). **NO content edits to `/arch` or glm-handoff** — three parallel sessions touch them;
   rebase on whatever staging holds.
2. **Foreign-project dispatch / runtime-bridge vendoring (A7)** — the `factory` profile vendors the
   runtime-bridge subset (CLI entrypoints + dispatch hook, env-parameterized) into the consumer
   repo; dedup-log path becomes per-project. npm packaging of the bridge stays deferred (U9).

This stage makes the contour **dispatchable from a consumer repo**, not just from the framework.

## §1 Inputs (re-verify at entry)

- **`/arch` skill** — EXISTS at `.zcode/skills/arch/`. S5 adds it to the shipped set in
  `setup.d/10-skills.sh`; does NOT edit its content.
- **`claude-glm-executor-handoff` skill** — EXISTS at `.zcode/skills/claude-glm-executor-handoff/`.
  **CRISP STAGE BOUNDARY (resolves the S4/S5 collision):** **S5 is the SOLE editor of
  `setup.d/10-skills.sh` for this umbrella** — S5 wires BOTH `/arch` AND `glm-handoff` rows.
  S4 owns the one-button automation + companions.manifest + INSTALL-FOR-AI; S4 does NOT touch
  `setup.d/10-skills.sh`. No coordination needed — S5 owns the file atomically. (Do NOT wait for
  S4; the skill FILE exists today in this repo, so the row can be added regardless of S4's state.)
- **`setup.d/10-skills.sh` shipped set** — currently `template-audit ai-doc rule-research
  rule-tests` + (factory-gated) `pipeline dispatcher aif-doctor harvest night-mode story`
  (`setup.d/10-skills.sh:92-100`). S5 adds `/arch` + `glm-handoff` to the `env`/`factory`-gated arm.
- **Runtime-bridge CLI entrypoints** — `packages/runtime-bridge/src/cli/`: `dispatch.ts`,
  `harvest.ts`, `questions.ts`, `answer.ts`, `await.ts`, `park.ts`, `openQuestion.ts`,
  `ensure-parallel.ts`, `aifHttp.ts` (verified at authoring). A7 vendors the SUBSET needed for
  foreign dispatch (dispatch + harvest + the hook; not necessarily all 9).
- **Dispatch hook** — find at entry: `find packages/runtime-bridge -name '*.ts' -path '*hook*'`.
  The hook the layout already assumes. A7 vendors it env-parameterized.
- **`companions.manifest`** — S4 owns the aif-handoff row upgrade; S5 does NOT touch it. Re-verify
  boundary at entry.

### §1.1 Runtime-bridge subset — which files to vendor (genuine fork, park)

The runtime-bridge has 9 CLI entrypoints. A7 says «vendors the runtime-bridge subset (CLI
entrypoints + dispatch hook)». The EXACT subset (all 9? dispatch+harvest+questions+hook only?
+ aifHttp shared dep?) is a genuine fork — the dependency graph between them determines the
minimum vendorable set. **PARK the subset boundary (§7)** after reading the import graph; do NOT
guess «all of them» or «just dispatch».

### §1.2 Dedup-log path — per-project (spec A7)

The runtime-bridge dedup-log path (tracks which dispatches already ran) becomes **per-project**
when vendored. The path mechanism (env var? relative path? config file?) — verify how it's set
today in `packages/runtime-bridge` and how the vendored copy should resolve it per-consumer.

## §2 Contour skill shipping (A8) — wiring-only

**Wiring-only additions to `setup.d/10-skills.sh`** in the `env`/`factory`-gated arm:

- `/arch` → ships at `env`+ depth.
- `claude-glm-executor-handoff` → ships at `factory` depth (pairs with the S4 GLM one-button).

**Binding constraints from spec A8:**

1. **NO content edits to `/arch` or glm-handoff.** Three parallel sessions touch them. Rebase on
   whatever staging holds at entry. If a content drift is noticed, surface it — do NOT fix it here.
2. The agnosticism harness must stay GREEN over the widened shipped set. Run it; cite output (T3).
3. **Profile-gating split (resolve, do not park):** `/arch` ships at `env`+, `glm-handoff` at
   `factory` (per spec). The current `setup.d/10-skills.sh:92-100` has ONE factory-gated arm
   (`pipeline dispatcher aif-doctor harvest night-mode story`). Read the file at entry; if the
   two profiles need a structural split (env-arm + factory-arm), implement it and record the
   structure chosen. This is a technical fork (the target depth-per-skill is binding from spec;
   only the bash structure varies) — **yours to resolve**, not a park. Record which arm each row
   landed in.

## §3 Runtime-bridge vendoring (A7) — env-parameterized, per-project dedup

The `factory` profile vendors the runtime-bridge subset into the consumer repo:

- **CLI entrypoints + dispatch hook** (the subset from §1.1, boundary PARKED).
- **env-parameterized** — the vendored copy reads `RUNTIME_BRIDGE_AIF_URL`,
  `RUNTIME_BRIDGE_AIF_PROJECT_ID`, `RUNTIME_BRIDGE_MODE` from the consumer's env (same convention
  as the framework copy — `packages/runtime-bridge/src/cli/questions.ts:30` documents the env contract).
- **Per-project dedup-log path** (§1.2) — not a shared global log.
- **npm packaging of the bridge stays deferred** (U9, post-announce).
- **Spec A7 falsifier (escalation path, binding):** «first foreign tester blocked by vendoring →
  raise bridge packaging priority» — if the vendored-dispatch smoke (§4 item 2) reveals a blocker
  that vendoring cannot resolve (e.g. the copy drifts too fast, or the subset is unworkable), the
  spec's named escape is to UN-defer U9 (npm-package the bridge instead of vendoring). Record such
  a blocker with this escalation explicitly proposed — do NOT park it as a generic «blocked». The vendor is a COPY, not an
  npm dependency.

**Vendor-copy ↔ framework-copy relationship (3 sub-forks, ALL parked):**
1. **Import coupling** — does the vendored copy `import` from `packages/runtime-bridge` (shared
   types, drifts together) or is it a fully self-contained snapshot (frozen, drifts independently)?
   Park — both defensible, different drift behaviour.
2. **Path resolution** — the vendored copy must read env vars (NOT hardcoded framework paths) for
   the consumer context. If the framework copy has hardcoded paths today, the vendored copy must
   parameterize them. Park the exact parameterization mechanism if the framework copy's current
   path-handling is ambiguous.
3. **Update mechanism** — when the framework copy changes, how does the vendored copy track it?
   (manual re-vendor? a sync script? never, until U9 npm packaging?) Park — genuine fork with
   maintenance-cost tradeoffs.

## §4 «Works» — acceptance (explicit + testable, evidence quoted in the PR body)

1. **Agnosticism harness green over the widened shipped set** — run the harness with `/arch` +
   glm-handoff added; cite the output. Red = T3 fail.
2. **Vendored dispatch smoke on a non-framework repo** — copy the subset into a temp consumer,
  run `tsx <vendored>/dispatch.ts <kickoff>` against a running aif; capture output. Prove it
  dispatches from a foreign repo end-to-end.
3. **Per-project dedup-log** — two vendored consumers don't share a dedup log; cite the paths.
4. **No content drift in `/arch` / glm-handoff** — the diff touches ONLY `setup.d/10-skills.sh`
  (wiring) + the vendored runtime-bridge copy. A diff that edits `/arch` or glm-handoff content
  = out of scope; surface it.
5. **env-parameterization works** — the vendored copy reads the consumer's env vars, not the
  framework's hardcoded paths.

## §5 Out of scope (do NOT do these here)

- Pipeline presets / `/pipeline status` / workspace one-command → S2.
- Tier-home doc + degradation matrix + CLAUDE.md pointer → S3.
- GLM one-button flow + aif guided-install implementation + companions.manifest aif row → S4.
- npm release mechanics (including npm packaging of the bridge — U9 deferred) → R1.
- Killer-layer code (track 1 owns).
- Editing `/arch` or `claude-glm-executor-handoff` CONTENT (A8 is wiring-only).
- Touching `setup.d/47-go.sh` or any go-lane row.

## §6 AI-laziness traps ([.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this stage: T3, T7, T13, T16, T17, T19, T20, T21.**

- **T3** — every «works» claim carries command + output. Agnosticism harness, vendored dispatch
  smoke — all live-fired.
- **T7** — do not pattern-match §4 into checkbox theater.
- **T13** — ADOPTED ≠ zero-work. The runtime-bridge layout the hook «already assumes» — confirm the
  vendored copy matches that assumption, or escalate.
- **T16** — the runtime-bridge is OUR code (not upstream), but the vendoring PATTERN (copy-not-dep)
  is a design choice; verify it fits the per-project dedup requirement rather than assuming.
- **T17** — S4's glm-handoff shipping + S1's companions.manifest declaration are sibling residue;
  supersede/extend WITH EVIDENCE, never silently.
- **T19** — own adversarial cold-QA of the diff before handoff. CI ≠ design review.
- **T20** — verdicts (subset boundary, dedup-path mechanism, profile-gating) carry file:line or
  command output. Several are PARKED; park records cite the import-graph evidence.
- **T21** — Backward-check enumerates **sibling surfaces**, not the diff (§8).
- **T-BDU-C (domain)** — re-verify the S4/S5 boundary (§1) + the runtime-bridge entrypoint set at
  entry in both directions.

## §7 Park-don't-guess contract (BINDING — this task runs autonomously)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two
> defensible implementations, an undecided design choice, a missing spec detail that changes
> behaviour) — **do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
> `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence
> Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork to "keep
> moving" is the failure this whole loop exists to prevent.

**Known fork-prone spots in this stage — park these rather than guessing:**

- **Runtime-bridge subset boundary (§1.1)** — which of the 9 entrypoints + the hook to vendor.
  Read the import graph; if the minimum vendorable set is ambiguous, park it with the graph cited.
- **Vendor-copy ↔ framework-copy coupling** (3 sub-forks — see §3 for full detail, ALL parked
  there): (a) import-coupling (shared types vs self-contained snapshot); (b) path-resolution
  mechanism (env vars vs hardcoded framework paths); (c) update mechanism (manual re-vendor vs sync
  script vs never-until-U9). Read §3 before deciding any of these is «technical» — each carries
  drift tradeoffs.
- **Dedup-log path mechanism (§1.2)** — env var vs relative path vs config file. Park if ambiguous.
- **Profile-gating structural split** — RESOLVED (see §2 binding #3): the depth-per-skill is
  binding from spec; only the bash structure varies → yours to resolve + record, NOT a park.
- **Vendor copy vs symlink vs git submodule** — NOT a park (spec A7 BINDS copy; this is decided).
  Listed under §5 Out-of-scope: «Reimplementing as submodule/symlink — spec A7 binds COPY».

Technical forks strictly inside the kickoff bounds (where exactly in 10-skills.sh to add the rows,
how to structure the vendored copy's README) are yours to resolve — resolve them and record why.

## §8 PR-body requirements (both gates are REQUIRED checks on `staging`)

This stage touches `.zcode/skills/**` (via setup.d wiring) + `setup.d/**` + vendored
`packages/runtime-bridge/**` copy → **the §1.7 mandate is ON**.

**Required sections — H3 depth (`###`), the word «applied» is required, ≥40 non-whitespace
chars in EACH body, ≥1 `path.ext:N` citation per section:**

```markdown
### §1.7 Forward-check applied

<which existing disciplines were checked, with file:line evidence>

### §1.7 Backward-check applied

<sibling-surface sweep — see below>
```

**T21 — the Backward-check is where this stage will fail if you rush it.** Enumerate sibling
surfaces the diff did NOT touch and verdict each (`SWEPT-CLEAN(evidence)` / `GAP-FOUND(action)`).
The class-surfaces here: `.zcode/skills/**` (the shipped set — sweep ALL profile arms), `setup.d/**`,
`packages/runtime-bridge/**` (framework copy vs vendored copy — prove no accidental coupling),
the plugin channel, the zcode twins, `packages/core/templates/**`. A Backward-check whose surface
list equals your own diff's file list is non-conformant by format.

**Also required: a `## Fidelity verdict` section.** `fidelity-verdict-in-pr-body` is a REQUIRED
staging check. **`FIDELITY: skipped` is NOT available to this PR** — it is a stage PR. It needs
a real GO block from a cold [`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md)
run: `FIDELITY: GO` + `Basis:` + `Round:` + `Audited-SHA:` (must prefix the PR head SHA at merge
time) + ≥1 file:line evidence on a line other than `Basis:`. Exactly one such section, exactly
one `FIDELITY:` line — a rework round REPLACES the block, never appends.

**Pre-flight before `gh pr create`** (compose the body first, then check):

```bash
echo "$PR_BODY" | grep -cE '^### §1\.7 (Forward|Backward)-check applied'   # must be 2
echo "$PR_BODY" | grep -cE '[^[:space:]]+\.[a-z]+:[0-9]+'                  # must be >=2
```

## §9 Stop conditions

- A design decision would diverge from the binding spec → STOP and surface the divergence.
- The runtime-bridge subset boundary needs a guess → park it; do NOT guess.
- A content drift in `/arch` or glm-handoff is noticed → surface it; do NOT fix it here.
- The vendored dispatch cannot run end-to-end on a foreign repo → park the blocker.
- Local CI-equivalent sweep goes red from a branch-introduced cause → fix before handoff.
