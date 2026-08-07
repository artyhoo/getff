<!-- scope: stage S4 of the getff-any-stack-trace umbrella — spec §9.1 + §9.3 (W6) is BINDING for semantics; this kickoff is dispatch input, not a spec restatement. Tier 2 (no bridge-profile marker): the stage owns three live design decisions — the cell's determinism boundary, the protocol artefact's shape, and whether that artefact ships to consumers. -->

# getff-any-stack-trace-s4 — acceptance mechanisms + umbrella closure

> **The LAST stage of this umbrella.** One PR onto `staging`, and it carries `done.md`.
> **Binding sources:** spec [`2026-07-23-getff-any-stack-closure-design.md` §9 + §3](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md)
> (semantics) + the umbrella kickoff §1 S4 bullet + `.claude/orchestrator-prompts/getff-any-stack-trace-meta-launch/kickoff.md` §4b/§5 (discipline + traps).
> **Predecessors merged:** S1 = #1166, S2 = #1169, S2b = #1233, S3 = #1253 (`a832e01e89`), R1 = #1254.
>
> **Branch:** `feature/getff-any-stack-trace-s4`. **Base:** `staging`.

## §1 Anchors — verified live at `ea5f7468d5` (2026-08-07). T3: re-verify at entry, the tree moves

| Anchor | State — command + result |
|---|---|
| `.github/workflows/audit-self.yml:1461` | `consumer-matrix-start-cell:` — the precedent job. **The spec §9.1 and the umbrella kickoff both cite `:1319`; that line number is STALE** (the file is 1546 lines now). Cite what you find, not what the spec transcribed. |
| `.github/workflows/audit-self.yml:1485` | `run: bash tests/consumer-matrix/pnpm-monorepo-cell.sh`, with `FRAMEWORK_ROOT: ${{ github.workspace }}` at `:1487` — the job is a thin wrapper; the assertions live in the script. |
| `.github/workflows/audit-self.yml:1523` | `- consumer-matrix-start-cell` inside the `ci-success` `needs:` list. **A cell not listed there is a gate whose only consumer is someone reading the checks page** — the `:1524-1529` comment records exactly that incident for `alwayson-budget`. |
| `tests/consumer-matrix/pnpm-monorepo-cell.sh` | 267 lines; the **only** file in that directory. Its `:20-46` header enumerates every assert AND every deliberately-deferred sibling assert — copy that discipline, not just the bash. |
| `packages/core/principles/09-doc-authority-hierarchy.ts:252` | principle 09 auto-covers every `*.md` **directly under** `agents/` — a new agent needs a header whether or not it ships. |
| `packages/core/principles/09-doc-authority-hierarchy.ts:126-137` | the hand-maintained list, scoped to agents `install.sh` copies to consumers. |
| `install.sh:606-618` | the sub-agent copy loop: `for f in "$PKG_ROOT"/agents/*.md` with an explicit `continue` skip-list for authoring-only agents (`manual-rule-liveness-prober`, `shipped-agent-liveness-prober`, `backward-sweep-auditor`, `adapter-jig-reviewer`, `dispatch-input-checker`). |
| `install.sh:204-212` | the shipped-artefact header-verify list — shipped agents only. |
| `setup.d/45-python.sh:896` | `for _py_agent in rule-researcher rule-test-author` — the python lane's **curated** 2-agent delivery (S2). The cell's agent-surface assert must match this set, not the npm set. |
| `agents/rule-researcher.md:204-211` + `:212-221` | the S3 F-A **DECLARE** binding site: generation needs Node (`npx tsx` from the framework checkout); the python **install** stays Node-free. |

**Prior-art you MUST consult before writing the protocol artefact (§2 item 2) — these are in-repo, one grep away:** `agents/shipped-agent-liveness-prober.md` and `agents/manual-rule-liveness-prober.md` (SSOT #115 is the ADAPT source of the RED→GREEN methodology both use). Both are session-read, reporting-only, $0-in-CI, DORMANT/operator-initiated — structurally the same *class* as the one-beat protocol. State the T16 problem-class comparison explicitly («upstream problem class: per-agent / per-rule behavioural liveness. Ours: end-to-end consumer journey with no second human prompt. Match? evidence: …») and either subordinate to them or justify the new artefact. Writing it without that comparison is `#authoring-from-internal-state` ([source-before-shape.md §1](../../rules/source-before-shape.md)).

**R1 input (#1254, `docs/meta-factory/research-patches/2026-07-26-lane-channel-parity-audit.md` §5.1):** the audit **parked** the question of whether the lane CI templates should substitute the consumer's real default branch, noting python/cargo/go templates trigger on `branches: [main]` only. The cell's `master`-default-branch fixture (spec §9.1, a deliberate W5.4 regression guard) **mechanically settles that question for the python lane** — honest-signals S4 (#1167) fixed it at delivery time via `deliver_getff_workflow` (`setup.d/lib.sh:194`, called at `setup.d/45-python.sh:384`), leaving `[main]` in the template as the literal being substituted. Assert the delivered workflow's trigger, and report the result either way. Do **not** widen to cargo/go — that is R1's routing, and it belongs to widening.

## §2 What to build (spec §9.1 + §9.3 — semantics BINDING there, schedule here)

1. **W6 cell v1 — «unfamiliar-stack e2e» (spec §9.1).** A new script under `tests/consumer-matrix/`
   plus its job in `audit-self.yml`, wired into `ci-success` `needs:`. The chain, in order:
   scripted fresh python project (FastAPI/SQLAlchemy-class), **`master` as the default branch on
   purpose** → `install.sh python` → **assert the agent surface is present** (the S2 delivery:
   skills, the curated 2 agents, hooks + `.claude/settings.json` wiring, `.mcp.json`, starter
   `AGENTS.md`, `.ai-factory/` subtree) → a **committed Tier-1-provenance practice fixture** →
   generation → **assert the rule + its test land** → **RED on a planted violation / GREEN on clean
   code** → the spec §4.4 **reject fixture** still resolves `research-only`.
   - **Deterministic and API-free** ([no-paid-llm-in-ci.md §1](../../rules/no-paid-llm-in-ci.md)).
     **Fail-closed: a missing tool is RED, never SKIP** — S2b shipped a container-green suite whose
     load-bearing arm had silently SKIPped for want of `ast-grep`/`ruff`.
   - The Tier-1 fixture hosts stay **absent from** `packages/core/research/allowlist.ts`
     (`fastapi.tiangolo.com` / `docs.sqlalchemy.org` — 0 matches today; **keep it so**), otherwise a
     green cell proves Tier-0 listing, not threading (T-AST-A).
   - Node in the **CI runner** is fine and is what F-A DECLARE assumes; Node on the **install path**
     is the thing being guarded. Assert the install ran Node-free rather than assuming it.
2. **The one-beat cold-run protocol — a NAMED artefact (spec §9.3).** `agents/` class, session-read,
   $0-in-CI. Contract: a cold agent, a fresh consumer, **shipped docs ONLY**, **no second human
   prompt**, **no framework-source reading** → a firing stack-specific rule. The artefact must state
   its own cold-start conditions, what its operator hands it (the consumer path, nothing else), and
   the shape of the verdict it emits. See the prior-art obligation in §1.
   - **Ship-or-not is a decision with a mechanical consequence, and it has a default:** framework-only
     (add a `continue` at `install.sh:606-618`, stay out of the `:204-212` list, rely on principle
     09's `:252` auto-coverage for the header) — matching `shipped-agent-liveness-prober.md`, because
     the protocol is run BY the framework against a consumer, not by the consumer. If you ship it
     instead, say why in the PR body and regenerate baselines. Verify the copy-loop semantics live
     before choosing; do not infer them from this table.
3. **RUN the protocol at closure and quote its verdict in the PR body** (spec §9.3). Running it is
   the deliverable; authoring it is not (T2). If you cannot run it from where this stage executes,
   **park** — see §4.
4. **Umbrella closure.** `.claude/orchestrator-prompts/getff-any-stack-trace/done.md` per the
   [CLAUDE.md umbrella-closure convention](../../../docs/meta-factory/operational-conventions.md).
   It gates `getff-freshness-widening` (spec §10), so it must name what actually landed across
   S1-S4 + S2b + R1 — including anything descoped — not a success narrative.

## §3 «Works» — explicit and testable

- **Cell v1 is green in CI on this PR**, and its job name appears in the `ci-success` `needs:` list.
  Quote both: the run conclusion and the `needs:` diff line.
- **The cell discriminates.** A gate that cannot fail is not a gate: show it RED on the planted
  violation and GREEN on the clean tree, from the same script, with output quoted. A cell that only
  ever passes is `#discipline-theatre` with a workflow file attached.
- **The one-beat protocol run is quoted, RED→GREEN end state** — its transcript verdict, in the PR
  body, naming which shipped docs the cold agent opened. If it opened anything under `packages/` or
  `setup.d/`, the protocol FAILED and that is the honest result to report — not a reason to edit the
  protocol until it passes.
- **`done.md` exists and is accurate** — every stage claim in it traceable to a merged PR number.
- **Baselines/fingerprints regenerated** if any delivered artefact moved (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`).

No «works» claim without quoted tool output (T3/T20).

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible implementations,
an undecided design choice, a missing spec detail that changes behaviour) — **do NOT pick.** Park it
as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as
«Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on the
unambiguous parts. Guessing a fork to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these):**

- **The cell's determinism boundary.** If a deterministic, API-free cell turns out to require network
  access the CI job cannot honestly guarantee (PyPI for the install, a toolchain fetch), park with
  both options — vendor/pin vs accept-network-with-a-named-failure-mode — and their consequences.
  Do NOT reach for `|| true`, a SKIP, or a `continue-on-error` to make it pass.
- **Running the protocol from a container.** §2 item 3 requires a real cold run. If the execution
  environment cannot produce a genuinely cold agent + fresh consumer, park the RUN (not the
  authoring) and say precisely what is missing. A warm run reported as cold is T-AST-B, the one
  domain trap this umbrella named against itself.
- **Cell FULL scope.** The dep-bump → targeted-staleness assertion is **cell full**, and spec §9.2
  assigns it to `getff-freshness-widening`. If v1 seems to demand it, park.
- **A GAP the cell surfaces in S1-S3's delivered surface.** If the e2e chain does not close, that is
  a finding about a merged stage, not a licence to re-open it inside S4. Park with the evidence.
- **Anything R1 routed to widening** (cargo/go rungs, the `--refresh` framework-reconciliation gap,
  the cargo rung-5 delivery cascade). Out of scope here.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T2, T3, T7, T11, T14, T15, T19, T20, T21.**

- **T2 — designing ≠ auditing, and this stage is where that bites hardest.** Two of the three
  deliverables are *mechanisms*, and the tempting output is a well-written cell script plus a
  well-written protocol document, neither of which was ever fired. The acceptance bar is a RED and a
  GREEN you can paste, and a protocol transcript.
- **T3/T20** — anchors re-verified live at entry; quoted output on every claim. §1's table is dated;
  the `:1319` → `:1461` drift in the spec's own citation is the standing proof that it rots.
- **T11** — the protocol artefact is a capability-shaped surface: BFR consult + a `Prior-art:`
  trailer whose verdict matches what the diff does. The two in-repo probers (§1) are the first
  candidates; do not stop at them if the SSOT holds a closer row.
- **T14** — «the cell is green» on a chain that never exercised generation is coverage, not
  correctness. Distinguish «asserted» from «asserted and shown to fail when it should».
- **T15 — self-application, and it is the point of this stage.** The one-beat protocol makes the
  framework's own shipped docs the system under test. Report what the cold agent could NOT do.
- **T19** — own adversarial cold-review of the diff before handoff. CI green on a cell you wrote is
  not review of the cell.
- **T21** — backward-check by enumeration, not restatement. Sibling surfaces for «an acceptance cell
  wired into `ci-success`»: the existing `consumer-matrix-start-cell`, the multistack
  fresh-install-validate jobs, and the npm/cargo/go lanes' equivalent (absent) e2e coverage — name
  each SWEPT-CLEAN or GAP-FOUND with evidence. A surface list equal to your diff is non-conformant.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-S4-A — the cell that asserts the install instead of the loop.** Asserting that files landed is
  cheap and feels like coverage; the §3 done-criterion is a *firing rule generated in the consumer*.
  A cell that stops at «agent surface present» has re-implemented the entry-lane test and proves
  nothing about W1-W3. Counter: the RED/GREEN firing arm is the load-bearing assert; everything
  before it is a precondition.
- **T-S4-B — `done.md` as a success narrative.** The closure doc gates the widening umbrella, so a
  `done.md` that omits descopes and honest lane limits hands the next umbrella a false baseline.
  Counter: it names PR numbers and what did NOT land, including R1's routed-onward findings.
- **T-S4-C — editing the protocol until it passes.** The protocol's first run is evidence about the
  shipped docs, not about the protocol. If the cold agent fails, the honest outputs are «the docs
  have gap X» (a finding) or «this is S3's surface» (a park) — never a quiet loosening of the
  protocol's cold-start conditions to produce a GREEN.

## §6 Anti-scope

- Do NOT build **cell full** (dep-bump → staleness) — that is `getff-freshness-widening` (spec §9.2).
- Do NOT widen to the cargo, go or npm lanes; do NOT act on R1's cargo/go GAP routing.
- Do NOT re-open S1-S3's merged surfaces to make the cell pass — park the finding instead.
- Do NOT introduce `node`/`npm` on the python **install** path (F-A DECLARE constrains the install,
  not the CI runner).
- Do NOT add npm deps to the framework.
- Do NOT edit `docs/superpowers/specs/**` — the spec is binding input, not a stage deliverable.
- Do NOT use a paid-LLM call in CI for any part of the cell or the protocol
  ([no-paid-llm-in-ci.md §1](../../rules/no-paid-llm-in-ci.md)); the protocol is session-read.

## §7 Host-verify contract + PR body

Work runs in a container; acceptance happens on the **host**
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
On S1 the container's results were wrong in BOTH directions; on S2b it reported a green suite whose
load-bearing arm had silently SKIPped. This stage's central deliverable is itself a test, which makes
the container/host gap sharper, not softer.

```bash host-verify
bash tests/consumer-matrix/python-unfamiliar-stack-cell.sh
npx vitest run --root packages/core principles/09-doc-authority-hierarchy.test.ts
npx vitest run --root packages/core principles/21-shipped-agent-tools-valid.test.ts
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

The cell script path above is **binding as a contract**: if you name the script differently, update
this block in the same PR so the runner stays executable.

**Note to the accepting session:** a green host-verify proves the cell runs and breaks nothing. It
does **not** prove the stage's «works» criterion — that is the cell *discriminating* (§3) and the
one-beat protocol's transcript, both of which are judgments a script cannot make. Read them.

### §1.7 is REQUIRED for this stage

S4 trips **both** §4b channels: `packages/core/principles/**` (the CI-RED channel — but confirm
whether your diff actually touches it) and `agents/**` (the create-time `git-safety.sh` channel,
which the workflow does not carry). Re-read
[`.github/workflows/discipline-self-check.yml`](../../../.github/workflows/discipline-self-check.yml)
`on.pull_request.paths` live at entry; do not trust any transcribed list, including this one.

### PR-body form traps — S1/S2/S2b/S3 hit these between them; pre-empt them

1. §1.7 headings are **H3** with the word «applied»: `### §1.7 Forward-check applied`.
2. ≥1 `file.ext:NN` citation and ≥40 non-whitespace chars in EACH §1.7 section.
3. The fidelity block is grammar **inside exactly ONE H2 section headed `## Fidelity verdict`**
   (`pr-body-fidelity.ts:35` heading regex; `:110` exactly-one rule): literal `FIDELITY: GO`,
   `Basis:`, `Round:`, `Audited-SHA:` (must prefix the PR head), ≥1 file:line NOT on the
   `Basis:` line.
4. `Prior-art:` lines start the line — no wrapping backticks
   (`packages/core/hooks/checks/prior-art.ts:182` is `startsWith`). The protocol artefact is a
   capability-shaped commit: cite a real SSOT row; the `skipped` hatch does not apply to it.
5. **Check the SSOT's next free ID at the moment you write the row, not at plan time.** S2b authored
   `#235` against a stale base and collided with two rows that landed while the branch waited.

### Generated artefacts

If `packages/core/templates/**` or any delivered artefact changes:
`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` in the same PR. Adding a workflow job means
`actionlint` + `zizmor` run against it — pin every action by SHA (the precedent job pins
`actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` and
`actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`), and keep `${{ … }}` out of `run:`
bodies (pass via `env:`, per the `ci-success` comment at `audit-self.yml:1538-1540`).
