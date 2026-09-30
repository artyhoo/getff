# one-button second wave — the python lane's pre-push hook under the project-checks record

> **Type:** I-phase, execution-build, single stage — ONE PR against `staging`.
> **Base branch:** `staging`. **Branch:** `fix/one-button-w2-python-prepush-under-record`.
> **PR title:** `fix(python): the pre-push hook runs only the checks the project-checks record arms — a brownfield push is no longer blocked`.
> **Channel:** one aif task (own worktree, harvested from the host) or one host session; verified on the
> host by an Opus session (operator log entry 36 — a proposal, not an order).
> **Rigor label (L0):** `build-and-verify` — the hook sits on every push of every python consumer.
> **Authoritative for:** this stage's contract — the record's python arm, the hook change, acceptance,
> falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the arm-only-if-green design (P2 of the one-button chain; operator log entry 32, coordination store).

## §0 Dispatch gate — second wave, after the landing

Operator log entry 41 (landing card «B»): the log's reading — «the python pre-push hook and the road's
auto-refresh on an older install go to the second wave (the python fork card of the same day is thereby
answered A — second wave)». The record and `run-armed.sh` this stage reuses arrive with the one-button
union; at authoring time (2026-09-30, `origin/staging` `2855667cb34`) they are absent. Check at click time:

```bash
git fetch origin staging
git cat-file -e origin/staging:packages/core/audit-self/run-armed.sh \
  && git cat-file -e origin/staging:tests/install-sh/run-armed.test.sh \
  && echo "union landed — dispatchable"
```

Then `SLUG=one-button-w2-python-prepush-under-record bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
(`.claude/skills/dispatcher/SKILL.md` §2.0).

**Measurement SHA:** `808e806c606` (head of `join/one-button-union`, round 6); re-locate by content
(`grep -n`) after the landing.

## §1 The defect, as measured

- The hook runs `ast-grep scan`, `ruff check .` and `ruff check . --config .getff/ruff-bans.toml
  --no-cache` over the WHOLE working tree and exits 1 on any finding
  (`packages/core/templates/python/hooks/pre-push.sh:60-81`): «✗ getff pre-push: ruff (discovered config)
  fired — push blocked.» A brownfield project with one existing ruff finding cannot push after the
  install, although it pushed before — against entry 28 «what was green before the install stays green».
- The npm lanes solved the same class with a record: the `aif:project-checks` block of
  `.ai-factory/tool-decisions.md`, written by `setup.d/99-finalize.sh:965-990` («green → `armed`, red →
  `not-armed` with the reason … Every channel reads that block through scripts/run-armed.sh»), run by
  `packages/core/audit-self/run-armed.sh` (installed at `setup.d/40-configs.sh:76`).
- The python lane never reaches either: `install.sh:689-692` runs `do_python_lane` and `exit 0` before
  the npm layers, so no record is written and no `scripts/run-armed.sh` is delivered on a python project.
- The hook is delivered and activated by `setup.d/45-python.sh:891-990` (`core.hooksPath .getff/hooks`,
  three pre-existing-hook cases).

## §2 Decisions this stage respects

- **Handoff decision 6 (P2 mechanism, from operator log entry 32):** «record block `aif:project-checks`,
  `run-armed.sh`, arm only if green; extended to every shipped pre-push section that could turn a working
  push red; cannot-run = not armed, said loudly.»
- **Entry 32** (verbatim): «A. Оставить Ч2  пока как есть - будим пилить отдельно независимо и
  интегрировать потом!» — the log's reading: a non-lint check red on the first run is recorded not-armed;
  the starting list of old violations is built separately (the trigger build) — so this stage builds NO
  baseline of old findings.
- **Entry 28 fork 1 = A** — green stays green (the acceptance test, §4 A2).

## §3 Deliverables

1. **Record + runner on the python lane.** The python lane writes the same `aif:project-checks` block
   (reuse `record_project_checks`, `setup.d/lib.sh:3357`, awk-only — confirm it needs no node) and
   delivers `scripts/run-armed.sh`. One writer, one runner: no python copy of either
   (`dual-implementation-discipline.md` §8 `#sync-by-copy-paste`).
2. **Probe at install, arm only if green.** Each of the three hook commands is run once on the untouched
   tree at install: exit 0 → `armed`; non-zero → `not-armed` with a reason (finding count); tool absent →
   `not-armed` with «not wired: <tool> is not on PATH» (the record's structural reason, never probed —
   `run-armed.sh:9`).
3. **The hook reads the record.** `pre-push.sh` runs the armed commands through `run-armed.sh` (and its
   `--probe`, so a check that turns green is armed with no human step — `run-armed.sh:8-11`) instead of
   running all three unconditionally. `GETFF_SKIP_HOOKS=1` and the missing-tool warnings stay.
4. **CI parity.** The shipped workflow `packages/core/templates/python/github-actions-ci.yml` mirrors the
   hook (`pre-push.sh:15-17`). Read how the npm lanes' delivered CI runs recorded checks — the gate
   `tests/install-sh/ci-runs-every-recorded-check.test.sh` («every check the install records has a
   run-armed step in the CI workflow it delivers, on every stack») — and make the python lane pass the
   same gate. If mirroring needs a decision (PARK below), do not guess.
5. **Report.** The python lane's final summary names each not-armed check with its reason, as the npm
   lanes do (`99-finalize.sh:1179`).
6. **Tests:** extend `tests/install-sh/python-entry-lane.test.sh` or add one test (wired in CI —
   principle 41) with a greenfield fixture (no findings → all armed → a NEW finding blocks the push) and a
   brownfield fixture (an existing ruff finding → `ruff check .` not armed → the push exits 0 and the
   record names it). Regenerate the three python fingerprints
   (`tests/install-sh/baselines/python/*.fingerprint`) and say what moved.

### §4c Fork discipline (park, don't guess)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT
> pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork
> stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on
> the unambiguous parts. Known candidate: the delivered python CI workflow runs on a clean runner where
> the record is committed — Option A: CI runs only armed checks (parity with the hook) → a brownfield CI
> stays green / Option B: CI stays strict → the first brownfield CI run is red and the report must say so.

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands in the park
payload + the PR's `## Parked questions`, and its correction lands as a separate owner commit — so this
allowlist deliberately names no park-record artefact.

## §4 Acceptance — executable, on the host

- **A1** greenfield fixture: install → record lists the three commands under `armed:` → a commit adding a
  banned import makes `git push` to a local bare remote exit ≠ 0.
- **A2** brownfield fixture (one pre-existing ruff finding): install → `ruff check .` under `not-armed:`
  with its reason → `git push` exits 0 (entry 28). Before the change the same push exits 1 — paste both.
- **A3** tool absent (PATH without ruff): not armed with the structural reason, push exits 0, the summary
  says it loudly.

```bash host-verify
bash tests/install-sh/python-entry-lane.test.sh
bash tests/install-sh/python-delivery.test.sh
bash tests/install-sh/run-armed.test.sh
bash tests/install-sh/ci-runs-every-recorded-check.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
npx vitest run packages/core/principles/41-shell-test-ci-coverage.test.ts packages/core/principles/45-prepush-contract-claim-liveness.test.ts
bash scripts/run-local-ci-sweep.sh
```

## §5 Out of scope

- A baseline of old findings (entry 32 — the trigger build owns it; kickoffs `trigger-build-s3`,
  `trigger-build-s4`, `trigger-build-s5` of the trigger-build lead).
- The cargo and go lanes (their passport/agent-surface gap is `one-button-w2-docs-handover-ho` HO-3).
- Changing the ruff / ast-grep pins (`ci-tool-pinning.md` Rule A).

## §6 Falsifiers to write into the PR body

- A2's push still exits 1 → the hook still runs every command.
- A1's new finding passes → arming lost the green case.
- A python install writes a SECOND record format or a copy of `run-armed.sh` under another name → two
  implementations.
- The python install now needs node where it did not before → a new hard dependency on a python-only
  machine (HO-9 of the docs hand-over names «python without local Node» as a real case).
- `ci-runs-every-recorded-check.test.sh` passes with a python CI workflow that runs a check the record
  does not list → the gate does not cover the python lane.

## §7 AI traps — [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)

Active traps for this stage: **T2** (run the pushes, do not describe them) · **T3** (command + exit code
for every acceptance row) · **T14** (a greenfield-only test is low coverage — the brownfield fixture is the
point) · **T19** (own cold review of the diff) · **T21** (cold `agents/backward-sweep-auditor.md` on the class
«a shipped hook section that runs a check over the whole tree and blocks on pre-existing findings» — every
shipped pre-push/pre-commit section on every lane is a candidate, decision 6 says «every shipped pre-push
section»).

**T-OBW2P-A (domain):** the hook's ruff arm runs twice with two configs (`pre-push.sh:70` discovered
config, `:75` getff bans). Arming them as ONE record line lets a green bans run arm a red discovered-config
run. They are two checks; probe and record them separately.

## §8 Not verified (at authoring time)

- Whether `record_project_checks` and `run-armed.sh` run with no node on PATH end to end (read, not run).
- How `ci-runs-every-recorded-check.test.sh` would take a python lane: the word «python» does not occur in
  it at `808e806c606` (`git cat-file -p 808e806c606:tests/install-sh/ci-runs-every-recorded-check.test.sh |
  grep -c -i python` → 0), so it does not cover the python lane today; extending it is part of deliverable 4.
- Behaviour when the consumer's existing `core.hooksPath` is theirs (`45-python.sh:960-990`): the hook is
  integrated rather than activated — whether the record still reaches that path is untested.
