# one-button second wave — the docs single-source hand-over (HO-1..HO-5, HO-8, HO-9)

> **Type:** I-phase, execution-build, staged — stage A is ONE PR against `staging`; stages B and C are
> dispatched only when their own gate below is green (each then ONE PR).
> **Base branch:** `staging`. **Branch:** `feat/one-button-w2-docs-handover-a` (stage A;
> `-b`, `-c` for the later stages). **PR title (stage A):**
> `feat(install): docs hand-over HO-3 HO-4 HO-5 — passport and agent surface on cargo and go, one passport region, the shell docs twin re-sourced`.
> **Channel:** one aif task per stage (own worktree, harvested from the host) or one host session;
> verified on the host by an Opus session (operator log entry 36: «Предлагаю реализацию спеки после ревью
> опусом отправить в аиф диспетч исполнятся в фабрику а проверять опусом» — a proposal, weighed, not an order).
> **Rigor label (L0):** `build-and-verify` — every lane's delivered passport and docs gate change.
> **Authoritative for:** this kickoff's contract — the stage split, each requirement's predicate as the
> hand-over states it, the gates, acceptance, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the requirements themselves — `_design-docs-ssot-handover-2026-09-29.md` (coordination store), whose
> rows are quoted verbatim below because the container cannot read it; the design —
> `_design-docs-ssot-top-level-r8-approved-2026-09-29.md` (approved top level, OP-51).

## §0 Dispatch gates

Operator log entry 36 (the log's reading): «an explicit choice of option A on the docs hand-over card —
requirements HO-1..HO-9 go as a SECOND WAVE, after the join, P6 and the landing». HO-6 is answered by the
trigger-build design (its slice 4) and HO-7 was routed back to the docs design (hand-over table) — neither
is here.

**Stage A (HO-3, HO-4 shell-twin part, HO-5)** — after the one-button union lands:

```bash
git fetch origin staging
git cat-file -e origin/staging:setup.d/ships.manifest \
  && git cat-file -e origin/staging:packages/core/audit-self/run-armed.sh \
  && echo "stage A dispatchable"
```

**Stage B (HO-1, HO-2, HO-9, HO-4 skill + audit-agent part)** — only after the docs engine exists on
`staging`. The hand-over's requirements presuppose «the engine (renderer, fences, gates)» with «generated
bindings» and a lock file (approved design, «Consumer» and «Checks» sections). At authoring time no such
engine and no build kickoff for it exist (`git grep -l -i 'bindings' origin/staging -- scripts packages/core`
→ one unrelated test file). Gate: the session that lands the docs design names the engine's `--check`
command in its PR; stage B is dispatchable when that command exits 0 on `origin/staging`. Until then stage B
is NOT dispatchable — say so in `/pipeline`, do not build an engine here.

**Stage C (HO-8)** — PARK-first: its mechanism is undecided (§3 C); dispatch only after the operator
answers the fork card stage C produces.

Before any stage: `SLUG=one-button-w2-docs-handover-ho bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
(`.claude/skills/dispatcher/SKILL.md` §2.0).

**Measurement SHAs:** `808e806c606` (head of `join/one-button-union`) for lane code; `origin/staging`
`2855667cb34` for what is merged. The hand-over's own base was `26ccdc6b160`; its line numbers are
re-measured below where they moved.

## §1 The requirements, verbatim from the hand-over (id · receiver · requirement · «met when»)

- **HO-1** · P1 (step list) · «The fact-family and binding generation is an agent step of the one ordered
  step list, on install AND on refresh» · met when «A fresh install and a `--refresh` through the agent
  channel each end with generated bindings and a green docs gate».
- **HO-2** · P1, CI cell owner · «Engine without bindings is never scored green. Without an agent it is
  PENDING ("not generated yet"), shown as not done by the install report and the CI arm; the next agent
  session's start hook hands it to the agent. Inside an agent session it is red. The own-configs CI cell
  runs off committed fixture bindings (precedent: its generator arm)» · met when «A bash-only install
  reports "not done"; the next agent session generates without a human asking; `own-config-cell.sh` stays
  green on fixtures».
- **HO-3** · P2 · «cargo and go lanes deliver the passport with its decided region, the rule, hooks, skills
  and agent surface. Today they `exit 0` before the npm layers (`install.sh:675-683`) and install no
  passport (0 hits for DESCRIPTION in the four cargo / go fingerprints). Until delivered, these lanes are
  named "not yet delivering the design", never scored green» · met when «cargo and go install fingerprints
  list `.ai-factory/DESCRIPTION.md` and the agent surface».
- **HO-4** · P3 · «Ships: gate scripts; getff's docs as files in the VENDORED AT VERSION class (excluded
  from the consumer's gates and zeros); the human-docs skill (F7, OP-46); the relink / bare-path /
  typed-value audit agent (M4, B-Q2 with OP-47 and OP-50). The shell twin
  `packages/core/audit-self/audit-ai-docs.sh` (shipped by `setup.d/40-configs.sh:14`, a second gate
  implementation against N-Q3) is re-sourced to the passport region or retired» · met when «the shipped set
  lists each item; the shell twin checks the consumer's region, not getff's phrase».
- **HO-5** · P4 · «The passport template (`packages/core/templates/shared/DESCRIPTION.template.md`) carries
  ONE getff-owned marked region with marked sub-blocks (goal scope / goal core / invariants / "never" /
  non-goals); flips `:7` ("NOT authoritative for: project goal"); drops `:52` (`docs/adr/`); moves its
  Node/TS lines (`:15-27`, `:33-38`) to the generated stack part. The python lane ships them unchanged
  today (`setup.d/45-python.sh:1620`). Python CI pins Node 20
  (`packages/core/templates/python/github-actions-ci.yml:43`) against `packages/core/package.json:19`
  `>=22`» · met when «a python install's passport has no Node/TS line; the region markers exist on every lane».
- **HO-8** · one-button design · «Reds outside an agent session reach an agent without a human relaying
  them: a consumer's CI docs red (cargo and go especially); getff's scheduled reds (F7 upkeep; today all 8
  `pin-freshness.yml` runs are red by design, `:11-13`); the host line's manual end
  (`packages/runtime-bridge/src/cli/harvest.ts:58-60` prints manual commands)» · met when «each such red
  produces an agent task with no human step».
- **HO-9** · P1, with P2 for the lane · «N-Q3 + statement 4: on cargo and go (and python without local
  Node), the agent obtains the Node runtime the docs engine needs itself, inside the step list, before
  generation and before any docs fix; the human is never asked to install it» · met when «on a cargo or go
  project with no Node, the agent run ends with Node present and bindings generated, and no step asked
  the human».

The hand-over's rule for every receiver: «Every requirement below is a requirement, not a design: the
receiving part designs the how. A receiving part that cannot meet one raises it back to this design's
lead; it does not drop it.»

## §2 Re-measured citations (for the implementer)

- HO-3: at `808e806c606` the lanes exit at `install.sh:689-702` (`do_python_lane` / `do_cargo_lane` /
  `do_go_lane`, each `exit 0`); `grep -c DESCRIPTION` over
  `tests/install-sh/baselines/{cargo,go}/*.fingerprint` → 0, 0, 0, 0 (measured).
- HO-4: `setup.d/40-configs.sh:14` still ships `audit-ai-docs.sh` (same line on staging and the join).
- HO-5: `DESCRIPTION.template.md:7`, `:15-27`, `:33-38`, `:52` hold the quoted text on `origin/staging`
  (measured). `setup.d/45-python.sh:1620` is blank on staging; the python lane copies the template at
  `45-python.sh:1368` and `:1396` on the join. Node 20 at `github-actions-ci.yml:43` and `>=22` at
  `packages/core/package.json:19` hold on staging.
- HO-8: `pin-freshness.yml:11-13` and `harvest.ts:58-60` hold on staging.

## §3 Deliverables per stage

**Stage A (build now, after the landing)**
1. **HO-5** — the passport template gets ONE getff-owned marked region with the five marked sub-blocks;
   `:7` flipped, `:52` dropped, the Node/TS lines moved to a generated stack part that the npm lanes fill
   and the python / cargo / go lanes do not carry; python CI's Node pin reconciled with `>=22` (or the PR
   says why the python CI needs no Node — then the pin goes).
2. **HO-3** — cargo and go lanes deliver the passport (with the HO-5 region), the rule, hooks, skills and
   agent surface; until a part is delivered, the lane's summary says «not yet delivering the design» for
   it. Fingerprints regenerated (`SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`) and the four
   cargo/go fingerprints list `.ai-factory/DESCRIPTION.md`.
3. **HO-4, shell-twin part** — `audit-ai-docs.sh` checks the consumer's passport region, not getff's phrase,
   or is retired from the shipped set with its callers; list the shipped docs-gate items in
   `setup.d/ships.manifest` (P3's «what ships» list).

**Stage B (after the engine gate)** — HO-1 (agent step of generation, install AND refresh), HO-2 (PENDING
never green; start-hook hand-off; own-config cell on fixture bindings), HO-9 (the agent obtains Node on
cargo/go/python-without-Node before generation), HO-4's skill (F7) and audit agent (M4). Each with its
hand-over predicate as the acceptance.

**Stage C (HO-8, PARK-first)** — a fork card, not code: for each red source (consumer CI docs red;
`pin-freshness.yml`; `harvest.ts` manual end) the options by which it becomes an agent task with no human
step, what each option needs (aif reachable, a scheduled host job, a GitHub-side trigger), and a
recommendation with a falsifier. Build only after the operator's answer.

### §4c Fork discipline (park, don't guess)

> **aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
> implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do NOT
> pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork
> stated as «Option A → consequence X / Option B → consequence Y») and **stop that task.** Proceed only on
> the unambiguous parts. Known candidates: HO-4 «re-sourced or retired» (the hand-over leaves both open);
> HO-5 where the generated stack part lives when no agent has run yet (bash-only install); every stage-C
> option. A requirement a stage cannot meet is raised back to the docs design's lead, never dropped.

Recording a fired PARK is not a file write (see /pipeline §5 park-record contract): it lands in the park
payload + the PR's `## Parked questions`, and its correction lands as a separate owner commit — so this
allowlist deliberately names no park-record artefact.

## §4 Acceptance (stage A) — executable, on the host

- **A1 HO-3** `grep -c 'DESCRIPTION.md' tests/install-sh/baselines/{cargo,go}/*.fingerprint` → ≥1 each.
- **A2 HO-5** a python install's `.ai-factory/DESCRIPTION.md` has no `Node.js` / `TypeScript` line; the
  region begin/end markers are present in the passport of an npm, a python, a cargo and a go install.
- **A3 HO-4** `audit-ai-docs.sh` on a consumer fixture whose passport region is filled and whose README
  lacks getff's phrase exits 0; with the region emptied it exits ≠ 0 (or the file is gone from every
  lane's fingerprint and from `ships.manifest`).

```bash host-verify
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash tests/install-sh/python-delivery.test.sh
npx vitest run packages/core/audit-self/audit-ai-docs.test.ts
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

## §5 Out of scope

- Building the docs engine, the lock file, the relink command (the docs design's landing; HO-10..HO-13 are
  «kept by this design's landing», hand-over table).
- HO-6 (trigger-build slice 4 — kickoff `trigger-build-s4` of the trigger-build lead) and HO-7 (routed back
  to the docs design).
- Site-seat items (`.claude/skills/docs-author/SKILL.md`, the site spec) — «the site seat owns them».

## §6 Falsifiers to write into the PR body

- A cargo or go fingerprint still has no `DESCRIPTION.md` → HO-3 unmet.
- A python passport still carries a Node/TS line → HO-5 unmet.
- Two region formats (npm vs other lanes) → one passport region broken.
- `audit-ai-docs.sh` still greps getff's phrase → HO-4 unmet.
- Stage B work (bindings, lock, PENDING state) appears in the stage-A PR → an engine built outside its design.

## §7 AI traps — [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)

Active traps for this kickoff: **T3** (every predicate checked by a command) · **T4** (all seven HO rows are
accounted for in the PR body: met / stage B / stage C / raised back) · **T13** (the hand-over's line
numbers were measured on `26ccdc6b160` — re-measure, §2 shows three already moved) · **T19** (own cold
review) · **T21** (cold `agents/backward-sweep-auditor.md` on the class «a lane that exits before the layers
that deliver a shared artefact» — every `exit 0` lane in `install.sh` is a candidate).

**T-OBW2D-A (domain):** «passport present» ≠ «passport with its decided region». A cargo fingerprint that
lists `DESCRIPTION.md` passes A1 while carrying the old template with Node lines; A2's region-marker check
must run on every lane, not only python.

## §8 Not verified (at authoring time)

- Whether any session is building the docs engine (no kickoff found on `origin/staging`; the design says
  its landing is «on the operator's word only»).
- Which agent surface cargo and go need (skills/agents list per lane) — not enumerated here.
- Whether `audit-ai-docs.test.ts` covers the consumer region case (not read).
