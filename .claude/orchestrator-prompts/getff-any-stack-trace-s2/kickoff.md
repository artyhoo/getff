<!-- scope: stage S2 of the getff-any-stack-trace umbrella. Thin dispatch adapter — semantics are BINDING in the sources below, NOT restated here. Tier 2 (no bridge-profile marker) inherited from the umbrella's spec §10 row. NOTE: fork F-A is S3's to resolve, NOT this stage's — S2 has no open design fork. -->

# getff-any-stack-trace-s2 — agent surface on the python lane (D8)

> **Stage 2 of 4.** One stage = one PR onto `staging`. Do NOT do any other stage's work.
> **Binding sources (read all three, in order):**
> 1. `.claude/orchestrator-prompts/getff-any-stack-trace-meta-launch/kickoff.md` §4 «S2» + §4b + §5 AI-traps.
> 2. `.claude/orchestrator-prompts/getff-any-stack-trace/kickoff.md` §1 «S2».
> 3. `docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md` §5 + **D8** — **BINDING for semantics**.
>
> **Branch:** `feature/getff-any-stack-trace-s2`. **Base:** `staging`.
> **Predecessor merged:** S1 = PR #1166 (`ceddb4b03`) — Tier-1 threading + D7 are already on `staging`.

## §1 The gap (re-verify EVERY line live at entry — these anchors moved once already, T3)

The python lane installs a lint bundle and exits **before** the agent-surface layers, so a python
consumer gets rules but no agent, no skills, no hooks — the one-beat loop S3 depends on has
nothing to run against.

| Anchor (verified at `a6a5eb46cc`) | State | What S2 changes |
|---|---|---|
| `install.sh:203` | `do_python_lane()` — delivers the pre-rendered ast-grep + ruff bundle under `GETFF_TOOLCHAIN=python` and **EXITS** before the `setup.d` layer loop | grows a delivery phase |
| `setup.d/45-python.sh:40-46` | the **INERT-ON-NPM contract** — `install.sh` sources all `setup.d/[0-9]*.sh`, and each layer no-ops on the python lane | spec §5: this contract **inverts** — the lane consumes a *curated subset of the layer list* |
| `setup.d/45-python.sh:526` | prose: rules-lock written to `.getff/` — «NEVER `.ai-factory/` (that dir is the npm lane's; the python lane asserts it never appears)» | prose updated — D8 lifts the ban |
| `tests/install-sh/python-entry-lane.test.sh:51-52` | asserts `! -e "$P/.ai-factory"` alongside `eslint.config.mjs` / `.husky` | **narrowed in the SAME stage** — drop `.ai-factory`, keep the other two |
| `tests/install-sh/python-rules-lock.test.sh:63-65` | arm (2) asserts `! -e "$P/.ai-factory"`; runs in CI (`audit-self.yml:613`) | **narrowed in the SAME stage** — the third encoding, missed by this kickoff's first draft |

**D8 is a contract renegotiation, not a bug fix** (spec: it was reclassified from fork F-C to
decision D8 after round-1 review). The `.ai-factory` ban has **THREE live encodings**, and D8
lifts **all three, in this one stage**:

1. prose — `setup.d/45-python.sh:526`
2. entry-lane assertion — `tests/install-sh/python-entry-lane.test.sh:51-52`
3. **rules-lock assertion — `tests/install-sh/python-rules-lock.test.sh:63-65`** (header at
   `:16` names «`.ai-factory` NEVER created» as a deterministic CI-signal arm; the test drives the
   real `install.sh` python lane in a `mktemp -d` fixture and **runs in CI** at
   `.github/workflows/audit-self.yml:613`)

Encoding 3 is the one this kickoff's first draft missed, and it is the one that goes RED the
moment the `.ai-factory/` subtree is delivered. Lifting some and leaving others ships a
self-contradicting tree — precisely what this project exists to prevent.

**Corroborating the premise:** the cargo lane already writes
`.ai-factory/synthesizer-output/rules-lock.cargo.json` (`setup.d/46-cargo.sh:192-204`), so the
«`.ai-factory/` is the npm lane's alone» premise is already false in the tree — D8 ratifies
reality rather than loosening a live invariant.

## §2 What to build

1. **Delivery phase inside `do_python_lane`** (spec §5). The mechanism the spec names is
   **«python lane consumes a curated subset of the layer list»** — i.e. reuse the existing
   `setup.d` layer logic rather than authoring a parallel delivery path. The shapes to reuse:
   `setup.d/05-mcp.sh` (`.mcp.json` context7 merge, idempotency-guarded),
   `setup.d/10-skills.sh:23,44` (skill dirs), `:119-141` (`deps-hash-check` copy + the
   create-or-merge of `.claude/settings.json`), `:201-209` (`inject-matching-rule` delivery +
   `register_cc_hook` wiring), `setup.d/20-agents.sh:24,67` (agents + `.ai-factory/skill-context/`),
   `setup.d/30-templates.sh:12-49` (the `.ai-factory/` subtree), and the shipped SSOT helper
   `register_cc_hook` (`setup.d/lib.sh:1028`).
   **Do NOT model this on `deliver_getff_workflow`** (`setup.d/lib.sh:194`, called at
   `setup.d/45-python.sh:384`): despite being S4's delivery addition, it is a *single-file
   `sed`-substitution wrapper* (`<tpl-src> <dst>`) that neither iterates nor handles directories
   nor merges JSON. It cannot carry a multi-file agent surface. Payload:
   - skills: `getff`, `rule-research`, `rule-tests`, `tool-bootstrapping`
   - agents: `rule-researcher`, `rule-test-author`
   - hooks: `deps-hash-check` + its `.claude/settings.json` wiring; `inject-matching-rule`
     **delivered exactly as `setup.d/10-skills.sh:201-209` delivers it on the npm lane**
     (copy + `register_cc_hook`)
   - `.mcp.json` (**context7** — `setup.d/05-mcp.sh:17-36` is context7-specific with an
     idempotency guard; do not invent a server list), a starter `AGENTS.md`, and the
     `.ai-factory/` agent-surface subtree
2. **Lift ALL THREE `.ai-factory` ban encodings in this same PR** — narrow
   `tests/install-sh/python-entry-lane.test.sh:51-52` (drop `.ai-factory`; **keep**
   `eslint.config.mjs`, `.husky`, and the `package.json` arm at `:48-50` — those remain genuine
   npm-leak signals), narrow `tests/install-sh/python-rules-lock.test.sh:63-65` (its arm (2)
   must stop asserting absence while still asserting the lock lives under `.getff/`), and update
   the `45-python.sh:526` prose.
3. **Install stays Node-free.** File delivery only — no `npm`, no `node` invocation on this lane.
   This is the lane's defining property; breaking it silently is a STOP-class defect.

## §3 «Works» — explicit and testable

- A **fresh python install** shows the agent surface: the delivered skills / agents / hooks /
  `.mcp.json` / `AGENTS.md` / `.ai-factory/` subtree all present, quoted from an actual run.
- The **narrowed lane test is green** and still fails on a real npm leak — demonstrate that by
  running it, not by asserting it.
- **Fresh-install smoke green.**
- **Byte-identical baselines regenerated** in the same PR: template/delivery edits shift install
  fingerprints. `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, then verify with
  `SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh` → N pass / 0 fail. A PR that changes
  delivery without regenerating baselines is red on arrival.

No «works» claim without quoted tool output (T3/T20).

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) —
**do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B →
consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork
to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these):**

- **Delivery mechanism** — if the curated-layer-subset approach (§2 item 1) turns out not to fit
  (e.g. a layer cannot be run without its npm preconditions), park with the specific layer and
  precondition named, rather than inventing a parallel delivery path.
- **Node-free boundary** — if any part of the agent surface appears to require `node`/`npm` at
  install time, STOP and park. Silently introducing a Node dependency on this lane changes the
  lane's contract.
- **`.claude/settings.json` merge is NOT a park trigger** — it is solved ground: reuse
  `register_cc_hook` (`setup.d/lib.sh:1028`) and the create-or-merge already implemented at
  `setup.d/10-skills.sh:126-141`. Park only if the python lane needs a merge case those two do
  NOT cover, and say which.
- **Anything that seems to require touching S3's or S4's surface** (`INSTALL-FOR-AI.md`,
  `agents/rule-researcher.md`'s python arm, `audit-self.yml`) — park; that is scope, not detail.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps for
this stage: T1, T3, T7, T14, T15, T19, T20, T21.**

- **T3** — every anchor in §1 re-verified live at entry. They have ALREADY moved once: #1167
  shifted the `45-python.sh` ban prose from `:517` to `:526`. Transcribed line numbers in this
  file are a starting point, not a fact.
- **T7** — do not tick §2 as a checklist. The substance is that a python consumer can actually
  run the loop afterwards, not that N files were copied.
- **T14** — a green install smoke at low coverage is «coverage insufficient», not «the agent
  surface works». Say which of the delivered artefacts you actually exercised.
- **T15** — self-application: the framework ships this surface to consumers; install it into a
  scratch python project and use it, rather than only asserting file presence.
- **T19** — own adversarial cold-review before handoff; green CI ≠ design review.
- **T21** — backward-check sibling surfaces are **the other lanes**: the npm lane (which already
  has the agent surface — check you did not diverge from its delivery shape) and the cargo lane
  (`setup.d/46-cargo.sh` — does the same gap exist there? name it SWEPT-CLEAN or GAP-FOUND, it is
  in scope to *name*, not to fix). A surface list equal to your own diff is non-conformant.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-S2-A — lifting SOME ban encodings, not all.** The ban has three live encodings (§1).
  **This kickoff's own first draft claimed two and missed the CI-wired third** — which is the
  trap demonstrating itself: an enumeration written from memory under-counts, and the missing
  one is the one that goes RED. **Counter:** `grep -rn 'ai-factory' setup.d/ tests/install-sh/`
  at the END of the work and account for **every** remaining hit — either it is a legitimate
  non-ban use (`setup.d/20-agents.sh:65` skill-context, `setup.d/lib.sh:348`,
  `setup.d/99-finalize.sh:106`, the cargo lane's own writes) or it is a ban you have not lifted.
  Do not trust §1's list; regenerate it.
- **T-S2-B — narrowing the lane test into uselessness.** The easy way to make
  `python-entry-lane.test.sh` pass is to weaken it until it asserts nothing. It must still FAIL on
  a genuine npm leak. **Counter:** prove it — temporarily create `eslint.config.mjs` in the
  fixture, show the test goes RED, remove it, show GREEN. Quote both runs.
- **T-S2-C — delivering files and calling the surface live.** Copying `deps-hash-check` without
  wiring it into `.claude/settings.json` yields an inert hook that looks installed. **Counter:**
  for every hook delivered, show the wiring, and prefer evidence that it fires.

## §6 Anti-scope

- Do NOT do S1's work (already merged, #1166), S3's (`INSTALL-FOR-AI.md`, the rule-researcher
  python arm, fork F-A) or S4's (`audit-self.yml` cell, the one-beat protocol agent).
- Do NOT write `done.md` — umbrella closure belongs to S4.
- Do NOT introduce `node`/`npm` into the python install path.
- Do NOT touch `.ai-factory/rule-tests/` semantics — D8 **preserves** the rule-tests sidecar
  contract.
- Do NOT add npm deps.

## §7 Host-verify contract + PR body

Work runs in a container; acceptance happens on the **host**
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
Container-green is not evidence about the host — on S1 the container reported 2 failures and 2
skips that did not exist on the host at all.

```bash host-verify
bash tests/install-sh/python-entry-lane.test.sh
bash tests/install-sh/python-rules-lock.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

> **The contract must be able to FAIL on this stage's deliverable — make it so.** As declared,
> the three commands above are all *negative* or *bookkeeping* checks: the two lane tests assert
> absence-of-npm-leak, and `SNAPSHOT_MODE=compare` only confirms you remembered to re-capture.
> **All three stay green on an S2 that delivers an empty agent surface.** Therefore §2 owns one
> more deliverable: **add a positive assertion arm** to `python-entry-lane.test.sh` that fails
> when the delivered agent surface is missing (skills dirs, both agents, `deps-hash-check` +
> its `settings.json` registration, `.mcp.json`, `AGENTS.md`, `.ai-factory/`). Then it belongs in
> the fence above and the contract genuinely decides acceptance
> (`destination-environment-verification.md §1`). Quoted evidence in the PR body is the
> *evidence* discipline; it is not a substitute for an executable check.

Run via `bash scripts/host-verify.sh getff-any-stack-trace-s2`; quote the host output.

### §1.7 — self-evaluate against the union at entry (do NOT trust this paragraph)

Meta-launch §4b assigns S2 to **self-evaluate**, and its own warning applies here: re-read
[`.github/workflows/discipline-self-check.yml`](../../../.github/workflows/discipline-self-check.yml)
`on.pull_request.paths` **live**, and the operator-local hook's TRIGGERS list too; §1.7 is owed
on the **union**.

An earlier draft of this section asserted §1.7 was REQUIRED because the diff «lands in
`packages/core/templates/**`». That was wrong and is recorded here so it is not repeated: the CI
globs are `packages/core/templates/**/*.md` and `**/*.template.md`, not `packages/core/templates/**`
— and `AGENTS.md.template` matches **neither** (`.md.template` ≠ `.template.md`). The likely real
diff (`install.sh`, `setup.d/45-python.sh`, `tests/install-sh/**`) is in neither channel. It may
still land in one — that is exactly why you evaluate at entry instead of trusting a transcription.
The precedent sibling `getff-honest-signals-s1/kickoff.md §7` does this correctly.

### PR-body form traps — S1 hit four of these; pre-empt them

Each of the following silently passes a casual read and is rejected by a gate:

1. **Headings must be H3** — `### §1.7 Forward-check applied` / `### §1.7 Backward-check applied`.
   S1's worker wrote H2; the CI regex is `^### §1\.7 …`.
2. **Each §1.7 section needs ≥1 `file.ext:NN` citation** and ≥40 non-whitespace chars. S1's
   forward-check shipped with zero citations.
3. **The fidelity block is grammar, not prose.** Literal `FIDELITY: GO`, then `Basis:`,
   `Round:`, `Audited-SHA:` (must prefix the PR head), plus ≥1 file:line on a line other than
   `Basis:`. S1's worker wrote «Verdict: PASS» and the gate rejected it.
4. **`Prior-art:` lines must start the line** — no wrapping backticks. The gate is
   `line.startsWith('Prior-art:')` (`packages/core/hooks/checks/prior-art.ts:182`). S1's were
   backticked and the capability-PR gate reported «no Prior-art trailer» despite two being
   present. This PR is very likely a capability PR (new files under `packages/`), and on those the
   `skipped` escape hatch is **rejected** — cite a real SSOT entry.

### Generated-artefact regeneration (S1's paid lesson)

The host `.husky/pre-push` gate caught synth-bundle drift on S1 that the container structurally
could not see. This stage's analogue is the **install fingerprints**: delivery changes shift them.
Regenerate with `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` in the same PR, and if
you touch anything under `packages/core/install/`, also run
`bash scripts/build-synth-bundle.sh --check`.
