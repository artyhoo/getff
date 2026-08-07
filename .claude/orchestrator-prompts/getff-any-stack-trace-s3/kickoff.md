<!-- scope: stage S3 of the getff-any-stack-trace umbrella — spec §6 (W3) is BINDING for semantics; this kickoff is dispatch input, not a spec restatement. Tier 2 (no bridge-profile marker): the stage owns fork F-A, an explicit design decision the spec §12 assigns to "the trace umbrella's planner". -->

# getff-any-stack-trace-s3 — one beat + per-stack research paths

> **One stage = one PR onto `staging`.** Do NOT do S4's work.
> **Binding sources:** spec [`2026-07-23-getff-any-stack-closure-design.md` §6 + §12](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md)
> (semantics) + the umbrella kickoff §1 S3 bullet + `.claude/orchestrator-prompts/getff-any-stack-trace-meta-launch/kickoff.md` §4b/§5 (discipline + traps).
> **Predecessors merged:** S1 = #1166, S2 = #1169, S2b = #1233 (`a66c0cb9aa`).
>
> **Branch:** `feature/getff-any-stack-trace-s3`. **Base:** `staging`.

## §1 The gap (re-verified live at `a66c0cb9aa`, 2026-08-07 — T3; re-verify at entry, the tree moves)

| Anchor | State — command + result |
|---|---|
| `agents/rule-researcher.md` (158 lines) | `grep -niE 'python\|pyproject\|ruff'` → **0 hits**. Wall #4 of the spec: the researcher agent documents no python path at all. |
| `INSTALL-FOR-AI.md` | `grep -niE '/rule-research\|same session\|opt-out'` → **0 hits**. The continuation clause does not exist. |
| `packages/core/templates/shared/AGENTS.md.template` | the starter AGENTS.md the python lane delivers (`setup.d/45-python.sh:808`, `copy_safe` from this template) — this is the file that must carry the beat, not a python-only variant |
| `packages/core/install/rule-bootstrap-cli.ts` | the `--from-practice` arm; exercised at `packages/core/install/rule-bootstrap-practice.test.ts:244` |
| `setup.d/45-python.sh:161` | `_py_join_researched_rules()` — joins consumer-side researched rules into the scan dir; called at `:203` |
| `packages/core/install/synth-and-wire.bundle.mjs` | the bundling precedent F-A weighs — **395 149 bytes** as committed |

**Note on the go lane (new since the spec was written):** `setup.d/47-go.sh` + `do_go_lane()`
landed 2026-08-06 (#1171). S3 is scoped to python + the rust *pointer* per spec §6.2 — do NOT
widen to go. If the researcher-agent edit would read as lane-complete while omitting go, say so
in one sentence in the PR body rather than silently implying coverage.

## §2 What to build (spec §6 — semantics BINDING there, schedule here)

1. **The continuation clause (spec §6.1 / D1).** `INSTALL-FOR-AI.md` **and** the delivered
   starter `AGENTS.md.template` instruct the agent to proceed from install directly into
   `/rule-research` **in the same session**, with an explicit stopping rule: research is skipped
   **only** on explicit operator opt-out. «One button» must be a property of the shipped
   instructions, not of luck. Both surfaces — a clause in only one of them leaves the other
   population uncovered.
2. **Per-stack paths documented where the agent actually is (spec §6.2).**
   `agents/rule-researcher.md` gains:
   - the **python arm** — author `AstgrepResearchedPractice` JSON at
     `.getff/rules-research/<id>.practice.json` → `rule-bootstrap-cli.ts --from-practice` →
     `_py_join_researched_rules` → verify with `ast-grep scan`;
   - the **rust arm pointer** — the clippy bridge, with its verify step (`cargo clippy`);
   - **honest lane limits per lane**, following the rule-tests spec lane map. A lane whose
     support is partial says so; an unqualified instruction that silently fails on a lane is the
     honest-signals defect class this program exists to close.
3. **Fork F-A — RESOLVE IT, record the rationale (spec §12).** Node for the generation CLI:
   **bundle** (per the `synth-and-wire.bundle.mjs` precedent) vs **declare honestly**
   («generation needs Node»). Spec criteria, verbatim: *bundle wins if the bundling precedent
   covers ajv/grammar-gate imports without exploding size; declare wins if bundle maintenance
   cost exceeds the honesty cost*. **Either way the python-lane INSTALL stays Node-free** — that
   is not negotiable and not part of the fork. Measure before deciding: actual import graph,
   actual resulting size, and the maintenance evidence already on record (the 2026-08-07 S2b
   egress hit a synth-bundle drift caused by a version-resolution mismatch between the root and
   `packages/core` locks — that is a real datapoint about bundle maintenance cost, cite it or
   refute it).
4. **Routing after install (spec §6.4).** The full author→render→join→lock loop must be reachable
   **from the shipped instructions alone**, on a fresh install AND on `--refresh`. Reading
   framework sources to complete the loop is the defect being fixed.

## §3 «Works» — explicit and testable

- **The load-bearing one:** a cold read of ONLY the shipped docs (INSTALL-FOR-AI.md + the
  delivered AGENTS.md + `agents/rule-researcher.md`) yields the **full author→render→join→lock
  command sequence** — quote the sequence you derived, and name every file you had to open. If
  completing it required opening anything under `packages/` or `setup.d/`, the stage is NOT done.
- **F-A decision recorded** with its measurement, in the PR body and in the artefact that
  carries the consequence (a comment where the decision binds, not only prose in a PR).
- **Both continuation surfaces carry the clause** — `grep` both, quote both hits.
- **Delivered-copy parity:** if `AGENTS.md.template` changes, the delivered copy changes; the
  install fingerprints move. Regenerate (`SNAPSHOT_MODE=capture`) in the same PR.
- **`agents/rule-researcher.md` stays AI-agnostic** — no Claude-Code-only primitive as the only
  path (`.claude/rules/dual-implementation-discipline.md §3`).

No «works» claim without quoted tool output (T3/T20).

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) —
**do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B →
consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork
to "keep moving" is the failure this whole loop exists to prevent.

**F-A is the ONE fork this stage is explicitly told to RESOLVE, not park** — spec §12 assigns it
here and gives the criteria. Resolve it on the measurement; park only if the measurement itself
comes out ambiguous (e.g. the bundle builds but you cannot establish a size/maintenance figure),
and then park with both numbers.

**Stage-specific park triggers (do NOT guess these):**

- **The opt-out mechanism's shape** — an env var, a prompt, or a documented sentence are three
  different consumer contracts. Spec §6.1 fixes that an opt-out exists, not what it is. Park with
  the options if the shipped surfaces do not already imply one.
- **Rust-arm depth** — spec §6.2 says «pointer»; if closing the rust arm honestly would require
  changing the clippy bridge itself, that is S4/widening scope. Park, do not extend.
- **Any need to touch S4's surfaces** (`audit-self.yml` cell v1, the one-beat protocol artefact
  under `agents/`, `done.md`) — park; that is scope, not detail.
- **A go-lane arm** — out of scope (§1 note). Park if the spec's silence seems to demand it.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T2, T3, T7, T11, T14, T15, T19, T20, T21.**

- **T2 — designing ≠ auditing.** The §3 cold-read criterion is a thing you RUN, not a property you
  assert. Derive the command sequence from the shipped docs and paste it.
- **T3/T20** — anchors re-verified live at entry; quoted output on every claim. §1's table is
  dated and will rot: the go lane appeared between this kickoff's authoring and the tree you will
  work on being a real possibility.
- **T11** — F-A's «bundle» branch is a capability-shaped decision: BFR consult + `Prior-art:`
  trailer if it lands as one, and the trailer's verdict must match what the diff does.
- **T14** — «the docs now mention python» is coverage, not correctness. The bar is the derived
  command sequence actually running.
- **T15 — self-application, and it is sharp here.** The artefact under change is the framework's
  own instructions to an agent. Read them AS the agent, from a cold start, and report what you
  could not do.
- **T19** — own adversarial cold-review of the diff before handoff.
- **T21** — backward-check by enumeration, not restatement. Sibling surfaces: the **npm** lane's
  equivalent instructions, the **cargo** lane, and now the **go** lane (`setup.d/47-go.sh`, new
  2026-08-06) — name each SWEPT-CLEAN or GAP-FOUND with evidence. A surface list equal to your
  diff is non-conformant.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-S3-A — the beat documented in one surface only.** `INSTALL-FOR-AI.md` is read by an agent
  installing the framework; the delivered `AGENTS.md` is read by an agent working in the consumer
  repo afterwards. They serve different moments and different populations. A clause in one is
  half a mechanism. Counter: §3 greps BOTH and quotes BOTH.
- **T-S3-B — instructions that are true only for the lane you tested.** `rule-researcher.md` is
  one file serving every lane. Adding a python arm that reads as universal turns a documented
  capability into a false promise for cargo/go consumers. Counter: §2 item 2's per-lane honest
  limits, asserted by reading the agent file as a cargo consumer would.
- **T-S3-C — resolving F-A from the precedent's existence rather than its measurement.**
  «`synth-and-wire.bundle.mjs` exists, so bundle» is `#pattern-matching-on-name` wearing a
  decision's clothes. The spec's criterion is a *size and maintenance-cost* comparison. Counter:
  §2 item 3 — produce the numbers, including the drift datapoint cited there.

## §6 Anti-scope

- Do NOT do S4's work: no `audit-self.yml` cell, no one-beat cold-run protocol artefact, no
  `done.md`.
- Do NOT introduce `node`/`npm` on the python **install** path — whatever F-A resolves to.
- Do NOT add npm deps to the framework.
- Do NOT widen to the go lane (§1 note).
- Do NOT edit `docs/superpowers/specs/**` — the spec is binding input, not a stage deliverable.

## §7 Host-verify contract + PR body

Work runs in a container; acceptance happens on the **host**
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
On S1 the container's results were wrong in BOTH directions; on S2b the container reported a
green suite whose load-bearing arm had silently SKIPped for want of ast-grep/ruff.

```bash host-verify
npx vitest run --root packages/core install/rule-bootstrap-practice.test.ts
bash tests/install-sh/python-entry-lane.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

**Note to the accepting session:** these three commands are *regression* teeth — they prove this
stage broke nothing. They do **not** prove the stage's own «works» criterion, which is the §3
cold-read and is a judgment a script cannot make. Do not treat a green host-verify as acceptance;
read the derived command sequence in the PR body and check it against the shipped docs yourself.

### §1.7 is REQUIRED for this stage

`agents/**` is a §4b trigger path in both channels, and this stage edits
`agents/rule-researcher.md`. Self-evaluate the rest of the diff against the union at entry anyway
(meta-launch §4b; re-read the workflow file live rather than trusting this line).

### PR-body form traps — S1/S2/S2b hit six of these between them; pre-empt them

1. §1.7 headings are **H3** with the word «applied»: `### §1.7 Forward-check applied`.
2. ≥1 `file.ext:NN` citation and ≥40 non-whitespace chars in EACH §1.7 section.
3. The fidelity block is grammar **inside exactly ONE H2 section headed `## Fidelity verdict`**
   (`pr-body-fidelity.ts:35` heading regex; `:110` exactly-one rule): literal `FIDELITY: GO`,
   `Basis:`, `Round:`, `Audited-SHA:` (must prefix the PR head), ≥1 file:line NOT on the
   `Basis:` line.
4. `Prior-art:` lines start the line — no wrapping backticks
   (`packages/core/hooks/checks/prior-art.ts:182` is `startsWith`). If F-A resolves to bundling,
   treat it as a capability PR and cite a real row; the `skipped` hatch then does not apply.
5. **Check the SSOT's next free ID at the moment you write the row, not at plan time.** S2b
   authored `#235` against a 2026-08-01 base and collided with two rows that landed while the
   branch waited — the renumber cost a rebase and six in-code citations.

### Generated artefacts

If `packages/core/templates/**` changes: `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`
in the same PR. If anything under `packages/core/install/` or `packages/core/research/` is
touched, also `bash scripts/build-synth-bundle.sh --check` — and note that a RED there can be an
under-provisioned `packages/core/node_modules` rather than real drift (S2b egress, 2026-08-07).
