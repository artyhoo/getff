<!-- scope: stage S2b of the getff-any-stack-trace umbrella — OPERATOR-INVITED INSERTION (2026-07-26) between S2 and S3: close the python lane's empty git-hook rung. The umbrella spec is SILENT on this stage — semantics are BINDING in THIS kickoff (not a spec restatement, because there is no spec section to restate). Tier 2 (no bridge-profile marker): the stage carries a real design fork (runner choice), resolved in-stage by a mandated prior-art verdict. -->

# getff-any-stack-trace-s2b — local git-hook rung on the python lane

> **Inserted stage (S2 → S2b → S3).** One stage = one PR onto `staging`. Do NOT do any other
> stage's work.
> **Provenance (why this stage exists):** the python lane's git-hook rung is EMPTY — the
> earliest-reachable-channel ladder (edit → pre-commit → pre-push → CI) has no local git rung
> for python consumers; a violation is first caught by CI, which the project goal names the
> LAST-resort gate (README.md#why-this-exists). This was not blind-missed:
> `python-delivery-v0/kickoff.md:97-98` made the local hook conditional on a prior-art verdict,
> and SSOT #216 returned REJECT — but that verdict judged pre-commit **as a delivery
> scaffolder**, while the conditional consumed it as a verdict on the **enforcement channel**
> (T16-shaped conflation: pre-commit in its actual role — a hook RUNNER — was never verdicted,
> and #216's trigger-to-revisit does not cover that role). This stage runs the missing verdict
> and closes the rung per its outcome.
> **Binding sources:** THIS kickoff (semantics) + `.claude/orchestrator-prompts/getff-any-stack-trace-meta-launch/kickoff.md`
> §4b/§5 (discipline + traps). Predecessors merged: S1 = #1166, S2 = #1169.
>
> **Branch:** `feature/getff-any-stack-trace-s2b`. **Base:** `staging`.

## §1 The gap (re-verify live at entry, T3)

| Anchor (at `61f4a7674e`) | State |
|---|---|
| `setup.d/45-python.sh` | zero hits for `pre-push\|pre-commit\|hooksPath` — no local git rung delivered |
| `setup.d/50-hooks.sh:10-12` | the npm lane's rung: `.husky/` pre-commit + pre-push via `copy_safe` — **Node-coupled, not reusable here** |
| `setup.d/45-python.sh:397` | `_py_firing_self_check` — install-time firing proof exists (plants a violation, proves rules fire) |
| `packages/core/templates/python/github-actions-ci.yml` | CI rung exists (pinned ast-grep + ruff, failing gates) |
| `packages/core/templates/python/` | contains `github-actions-ci.yml`, `ruff.toml`, `sgconfig.yml` — no hook template |

Present ladder for a python consumer: install-time proof → agent-session hooks (S2) → CI.
Missing: the local git rung that catches a violation **before** it leaves the machine.

## §2 What to build

1. **Task 0 — the missing prior-art verdict (BFR §3, BLOCKING all implementation tasks).**
   Evaluate **pre-commit (pre-commit.com) IN THE RUNNER ROLE** vs **bare `core.hooksPath` bash**
   for delivering the python lane's local rung. DeepWiki + WebSearch ≥3 phrasings each; record a
   NEW row in `docs/meta-factory/prior-art-evaluations.md` with an explicit T16 problem-class
   statement («upstream class: hook running/version-management; our class: deliver a local
   firing gate into a consumer repo with zero installed prerequisites») and a
   trigger-to-revisit. **Decision criteria (binding, in priority order):**
   - (a) **zero installed prerequisites** — the hook must fire on a machine that has ONLY git +
     the tools the lane already requires; a rung that silently no-ops when a framework is not
     installed is a deceptive signal (honest-signals class);
   - (b) **augment-first, never clobber** — a consumer with existing hooks (`core.hooksPath`
     already set, `.pre-commit-config.yaml` present, or files in `.git/hooks/`) keeps them
     working;
   - (c) **Node-free** stays absolute on this lane.
   Expected shape (NOT pre-decided — the verdict may overturn it with evidence): bare
   `core.hooksPath`-style delivery as default, WITH an integration arm — if the consumer
   already uses pre-commit, append a getff hook entry to their `.pre-commit-config.yaml`
   instead of competing for `core.hooksPath`.
2. **Deliver the rung** per the verdict, inside `do_python_lane`'s delivery phase (extend
   `_py_deliver_agent_surface`'s section of `setup.d/45-python.sh`, same `lib.sh` helper
   discipline as S2 — `copy_safe`, `mkdir_safe`, `chmod_safe`). The hook body runs the SAME
   checks the lane already ships — `ast-grep scan` against `.getff/` rules + `ruff check .
   --config .getff/ruff-bans.toml` — version-agnostic (use whatever the consumer has installed;
   print the pinned install hint from `45-python.sh:373-375` when a tool is absent, and in that
   case **fail OPEN with a loud one-line warning** — a missing linter must not brick every
   commit, but silence is forbidden).
3. **Opt-out story** mirroring the CI template's: a documented deletion path + an env escape
   (`GETFF_SKIP_HOOKS=1` honored at install AND at hook runtime), stated in the delivered hook's
   header comment.
4. **Idempotency + `--refresh`:** re-install and `--refresh` reconcile the hook without
   duplicating entries or clobbering consumer edits (follow the `deliver_getff_workflow`
   refresh semantics at `setup.d/45-python.sh:352-359` for the framework-owned file).

## §3 «Works» — explicit and testable

- **New positive arm** in `tests/install-sh/python-entry-lane.test.sh` (per-element, `ok`/`bad`
  style, aggregate fail-closed — the S2 arm (13) pattern): hook file delivered + executable +
  activation present (whichever mechanism the verdict picked) + opt-out honored
  (`GETFF_SKIP_HOOKS=1` install → no activation).
- **RED/GREEN firing proof through the actual git rung** (the whole point of the stage): in a
  `git init` fixture — install, plant a violation the shipped rules catch, `git commit`/`push`
  → the hook FIRES (non-zero, violation named); clean tree → passes. Both runs quoted. If the
  verdict lands on **pre-push**, the fixture needs a local bare remote (`git init --bare` +
  `git remote add`) for the push to have a destination — plan it in. A rung
  that is delivered but never proven to fire is the mutation-runner defect (honest-signals S1)
  reproduced at a new layer.
- **Consumer-with-existing-hooks fixture:** pre-set `core.hooksPath` (or a `.pre-commit-config.yaml`
  if the verdict lands there) → install → consumer's setup still works, getff rung integrated or
  cleanly declined WITH a printed notice — never silently broken.
- **Fingerprints regenerated** (`SNAPSHOT_MODE=capture` then `compare` → 0 fail) — delivery
  changes shift install fingerprints.
- **npm lane untouched:** `setup.d/50-hooks.sh` and `.husky` templates not in the diff.

No «works» claim without quoted tool output (T3/T20).

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) —
**do NOT pick.** Park it as a question (set the task to `manualReviewRequired` /
`blocked_external` with the fork stated as «Option A → consequence X / Option B →
consequence Y») and **stop that task.** Proceed only on the unambiguous parts. Guessing a fork
to "keep moving" is the failure this whole loop exists to prevent.

**Stage-specific park triggers (do NOT guess these):**

- **Verdict criteria conflict** — if Task 0's evidence makes criteria (a) and (b) pull in
  opposite directions (e.g. the only non-clobbering integration requires an installed
  framework), park with the evidence, do not rank the criteria yourself.
- **`core.hooksPath` already set by the consumer** — if no clean integration exists for that
  case, park with the observed consumer shapes rather than inventing a takeover.
- **Which git event** (pre-commit vs pre-push) if the evidence does not clearly favor one —
  park; the choice changes the consumer's feedback latency and is not pre-decided here.
- **Any need to touch S3/S4 surfaces** (`INSTALL-FOR-AI.md`, `agents/rule-researcher.md`,
  `audit-self.yml`, `done.md`) — park; that is scope, not detail.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this stage: T3, T7, T11, T14, T15, T16, T19, T20, T21.**

- **T11/T16 — the traps that CREATED this stage.** The prior verdict (SSOT #216) judged
  pre-commit in the wrong role and a conditional consumed it anyway. Task 0 exists to run the
  verdict in the RIGHT role; its SSOT row must state both problem classes explicitly. Skipping
  Task 0 because «#216 already covered pre-commit» is the exact recurrence.
- **T3/T20** — anchors re-verified live; quoted output on every claim.
- **T7** — §2 is not a checklist; the substance is a rung that demonstrably fires.
- **T14** — a green install with the hook delivered-but-never-fired is «coverage insufficient»,
  not «works» — the RED firing run is mandatory.
- **T15** — self-application: run the delivered rung against the framework's own python fixture
  corpus and report.
- **T19** — own adversarial cold-review before handoff.
- **T21** — backward-check sibling surfaces: the **npm lane's rung** (`setup.d/50-hooks.sh` —
  SWEPT-CLEAN expected, untouched) and the **cargo lane** (same empty rung — GAP, name it for
  the widening umbrella, do not fix). A surface list equal to your diff is non-conformant.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-S2B-A — silent no-op rung.** A hook that exits 0 when its linters are absent, without a
  word, is worse than no hook: the consumer believes they have local enforcement. Counter: §2
  item 2 — fail OPEN but LOUD (one warning line naming the absent tool + install hint); the
  positive arm asserts the warning text path exists.
- **T-S2B-B — clobbering the consumer's hooks.** Setting `core.hooksPath` over an existing
  value, or overwriting `.git/hooks/pre-commit`, breaks workflows invisibly. Counter: the
  existing-hooks fixture in §3 is mandatory, and §4 parks the ambiguous case.
- **T-S2B-C — proving the commands instead of the rung.** Running `ast-grep scan` manually and
  quoting it proves the scanner, not the hook. The RED run must go through **git** (a real
  `git commit`/`git push` in the fixture) so the activation mechanism itself is what fires.

## §6 Anti-scope

- Do NOT touch the npm lane (`setup.d/50-hooks.sh`, `.husky` templates) or the cargo lane.
- Do NOT do S3's work (one-beat clause, rule-researcher python arm, fork F-A) or S4's
  (audit-self cell, one-beat protocol, `done.md`).
- Do NOT introduce `node`/`npm` on the python install path.
- Do NOT add npm deps to the framework.
- Do NOT use `@arm:` locators in test comments — that grammar belongs to the adapter-jig
  registry (principle 33); plain comments only (S2 incident, commit `7f21e44f19`).

## §7 Host-verify contract + PR body

Work runs in a container; acceptance happens on the **host**
([destination-environment-verification.md §1](../../rules/destination-environment-verification.md)).
On S1 the container's test results were wrong in BOTH directions; on S2 the host pre-push
caught a registry violation the container could not run.

```bash host-verify
bash tests/install-sh/python-entry-lane.test.sh
bash tests/install-sh/python-rules-lock.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```

The new positive arm (§3) lives inside `python-entry-lane.test.sh`, so command 1 carries this
stage's acceptance teeth — including the RED/GREEN firing fixture, which must be part of the
test, not a manual demonstration. **Note to the accepting session:** command 1 passes trivially
if the arm was never added — diff the test file and confirm the firing fixture EXISTS before
treating the host-verify green as acceptance (T14).

### §1.7 is REQUIRED for this stage

Task 0 edits `docs/meta-factory/prior-art-evaluations.md` — a trigger path of BOTH channels
(the CI workflow AND the operator-local hook). Self-evaluate the rest of the diff against the
union at entry anyway (meta-launch §4b; re-read the workflow file live).

### PR-body form traps — S1/S2 hit five of these; pre-empt them

1. §1.7 headings are **H3** with the word «applied»: `### §1.7 Forward-check applied`.
2. ≥1 `file.ext:NN` citation and ≥40 non-whitespace chars in EACH §1.7 section.
3. The fidelity block is grammar **inside exactly ONE H2 section headed `## Fidelity verdict`**
   (`pr-body-fidelity.ts:35` heading regex; `:110` exactly-one rule): literal `FIDELITY: GO`,
   `Basis:`, `Round:`, `Audited-SHA:` (must prefix the PR head), ≥1 file:line NOT on the
   `Basis:` line.
4. `Prior-art:` lines start the line — no wrapping backticks
   (`packages/core/hooks/checks/prior-art.ts:182` is `startsWith`). This PR edits the SSOT and
   likely adds a template file — treat it as a capability PR: cite the NEW SSOT row by number;
   the `skipped` hatch is rejected.
5. No `@arm:` in comments (§6).

### Generated artefacts

Fingerprints: `SNAPSHOT_MODE=capture` in the same PR. If anything under `packages/core/install/`
is touched, also `bash scripts/build-synth-bundle.sh --check`.
