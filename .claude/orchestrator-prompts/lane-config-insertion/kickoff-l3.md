# lane-config-insertion — L3: shared lane-config writer + differential probe; python lane inserts ruff + sgconfig

<!-- bridge-profile: Z.AI GLM-5.3 SDK -->

> **Umbrella:** [kickoff.md](kickoff.md). Its §0 binding rules, §2 file-lock matrix, §4 stop
> conditions and §5 descope register bind this stage; every deviation is declared below.
> **Class:** stage kickoff (dispatch input) — the umbrella's **capability stage**. **Base branch:**
> `staging`. **Branch:** `feat/lane-insert-python`. **PR title:** `L3: shared lane-config writer + differential probe; python lane inserts ruff + sgconfig`.
> **Channel:** one aif task, own worktree, one PR to `staging` (harvested from the host).
> **Rigor label (L0):** `build-and-verify` — a new writer that edits consumer-owned files, gated by
> a tool-run proof, golden fixtures and byte-preservation invariants.
> **Design SSOT:** [spec](../../../docs/superpowers/specs/2026-09-28-lane-config-insertion-design.md)
> §3 (I1-I6), §4.1, §4.2, §5, §6, §7, §8 (D1, D2, D5, D8, D10, D12), §9, §10.
> **Authoritative for:** the L3 contract — writer and probe interfaces, the tool ladder, the python
> cells, the tests. **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../../README.md#why-this-exists); any design decision — the spec.

**Measurement SHA:** `origin/staging` = `a9c457321e6` (2026-09-29; PR #1890 merged as
`eb8e2306261`). L1 and L2 rewrite parts of `setup.d/45-python.sh`; **re-locate every anchor by
content**.

**Tool-absent rule (hard, umbrella §0.2).** `command -v <tool>` fails in your environment → you
do not install toolchains into the container and never paste output you did not run; proofs
that need the tool are CI-job tests (spec §9 shard placement) and the PR body says which CI job
ran them; if a needed decision depends on a tool run you cannot perform, park
`blocked_external`. The aif container has no ruff, ast-grep or uvx: the probe and insertion arms
of §3e run in CI job `install-sh-c`, which installs ruff `0.15.21` and ast-grep `0.44.1`
(`.github/workflows/audit-self.yml:997-1000`).

**Deviations (declared):**

1. **Where the writer lives.** New sourced helper `setup.d/lane-config-insert.sh` — shape
   recognisers, inserters, provenance tags, D10 refresh removal, I3 write-through, the probe
   scaffolding (before/after, set comparison, rollback), the D12 ladder and the result contract.
   The lane files keep the payload, the cell logic and the tool-specific probe runners (spec §5:
   «lane files keep the payload and the cell logic, as their `@cc-only-rationale` headers
   require», `setup.d/45-python.sh:47`). The helper carries its own `@cc-only-rationale` header.
   It is **not** delivered to consumers: it runs from `$PKG_ROOT` like the lane files and ships in
   the dist, so it gets a `packages/getff/MANIFEST.sha256` entry through `scripts/build-getff-dist.sh`.
2. **Capability trailer although the detector is silent.** The CLAUDE.md capability-commit detector
   counts new files only under `packages/`, so a new `setup.d/*.sh` does not trip it. This is a
   new capability all the same (a writer into consumer-owned files), so the commit carries the
   positive `Prior-art:` trailer of §3. Record the detector's blind spot in the PR body as an
   observation; do not fix the detector here (CLAUDE.md «PR strategy»).
3. **One pin, gated mirrors.** Spec §5: «The pin and the CI template's pin are one value …, held in
   one place the plan names.» The one place is the getff CI template of each lane
   (`packages/core/templates/python/github-actions-ci.yml:45-46` ast-grep `0.44.1`, `:66` ruff
   `0.15.21`). The lane's one-shot runner literals are mirrors, gated by
   `packages/core/hooks/pin-parity.test.ts` (`TRACKED_TOOLS`, `:57-67`). The ast-grep uvx
   route spells `ast-grep-cli==0.44.1` (`45-python.sh:510`), which the ast-grep
   `versionReSource` `@ast-grep/cli@(…)` (`:60`) does **not** match — widen the regex so that
   surface is gated. That pre-existing hole is closed here because L3 is the stage that makes the
   route load-bearing.
4. **Reuse the existing tool resolver.** The lane already resolves ast-grep as «binary on PATH,
   else `uvx --from ast-grep-cli==0.44.1 ast-grep`, else a `not proven` NOT-wired line»
   (`45-python.sh:484-551`), and ruff as `uvx ruff@0.15.21` (`:571`, run with `--no-cache` at
   `:583-584`). The D12 ladder
   **generalises that code** into the helper and moves the self-checks onto it. It is not a
   second resolver beside it (`#sync-by-copy-paste`).
5. **The `getff-ruff.toml` reference copy** that the REFUSE cell ships (`45-python.sh:382`,
   `:418`, `:429`) keeps shipping, exactly as it is — the stated default. Whether a successful
   insertion should retire it is an open question: record it in the PR body under `## Parked
   questions` as **informational**, then proceed with the default. This is NOT a park and does
   not stop the task.

**Dependencies:** #1890 (merged, `eb8e2306261`), L1, L2 merged (umbrella §3 gate L3). L1 shipped
on P-L1-2 «works» ([kickoff.probes.md](kickoff.probes.md)): the getff CI ast-grep gate reads
`.getff/sgconfig.yml`, so a refused or deleted §4.2 entry leaves only the **local** run without
getff's rules — the NOT-wired wording says exactly that (confirm against L1's merged template).

## §1 Prerequisite probes — resolved on the host

All four ran before dispatch; commands and raw output are in
[kickoff.probes.md](kickoff.probes.md). Do not re-run them; cite that file in `## Probe results`.

| Probe | Measured | Selected branch |
|---|---|---|
| **P-L3-1** | `ruff check --show-settings does_not_exist.py` → «ruff failed / Cause: No files found under the given path», exit 2. | **The path must exist:** the probe file is created inside the target's directory and removed on every exit path of the install run (spec §4.1). |
| **P-L3-2** | `ignore=["TID"]` + `extend-select=["TID251"]` → TID251 fires; `select=["TID251"]` + `ignore=["TID"]` → fires; `extend-ignore=["TID2"]` + `extend-select=["TID251"]` → fires; `ignore=["TID251"]` + `extend-select=["TID251"]` → «All checks passed!». | A prefix ignore does not disable a more specific selected code; an equal ignore does. The design NOT-wires every getff code **or prefix** in `ignore` regardless; the equal-specificity case is a fixture row the differential probe must catch. |
| **P-L3-3** | ast-grep 0.44.1: `sgconfig.yml` with only `utilDirs`, only a comment, or only `testConfigs` → `ast-grep scan` exit 0. | **Valid → shape S3 ships** (append a `ruleDirs:` block list at EOF). The reason text at `setup.d/45-python.sh:361` («it has no top-level ruleDirs key for getff to add a line to») is replaced by the S3 result. |
| **P-L3-4** | Clean `HOME`: `uvx ruff@0.15.21 check a.py` leaves `!! .ruff_cache/` in the project; with `--no-cache` the project stays clean. uv writes `$HOME/.local/share/uv/tools/{.lock,.gitignore}` besides its cache; nothing on `PATH`. | **Every getff ruff probe run passes `--no-cache`** (as the self-check already does, `45-python.sh:583-584`). The PR body records uv's state directory as uv's own, next to its cache. |

## §2 Prior-art consult — done on the host; cite it

The consult ran before dispatch because the container cannot reach context7 or WebSearch
reliably. It is recorded in [kickoff.probes.md](kickoff.probes.md) «L3 prior-art consult»: SSOT
`#216` (`:289`, BUILD the thin bash writer), `#117` (`:190`, HYBRID — yq, no silent default),
`#132` (`:205`, REFERENCE — the toml_edit technique), PR #1868 (merged `64a624b1355`, the
insertion-only precedent; `insertOnly` in `packages/core/install/wire-eslint-r2.ts:627-632`),
context7 ×3 (ruff, golangci-lint, clippy — none has an include/merge that layers a second
config), WebSearch ×1 (no tool inserts its rules into a consumer's config), and a T16 line per
candidate. No new SSOT row. Do **not** re-run it; read the three SSOT rows and PR #1868 before
the first line of the helper.

**Trailer:** `Prior-art: prior-art-evaluations.md#216 (BUILD — thin bash writer; #132 technique, #117 rejects a yq default; consult recorded in .claude/orchestrator-prompts/lane-config-insertion/kickoff.probes.md).`

**D1's falsifier (spec §8) is measured here, not deferred.** The sample was collected on the
host — [kickoff.probes.md](kickoff.probes.md) «D1 sample»: 22 `ruff.toml` / `.ruff.toml`, 15
`pyproject`-family files with `[tool.ruff`, 10 `sgconfig.yml`, each named by repo, path and blob
SHA. Fetch exactly those bytes with `gh api repos/<repo>/git/blobs/<sha> --jq .content | base64 -d`
into a temp dir (never into the repo), run the recognisers over them offline, and report the
fraction outside the recognised shapes. More than 1/3 → STOP and park (D1 says re-weigh a
format-preserving library via `uvx`). `gh` cannot reach GitHub from your environment → park
`blocked_external` for the D1 measurement only; never substitute a different sample.

## §3 Deliverables

### 3a Writer — `setup.d/lane-config-insert.sh` (Deviation 1)

Behaviour is spec §3, §5 and §6; this list is only the interface each later stage needs:

- **Recognisers** (I2). They resolve every equivalent spelling of a target key — bare, quoted,
  dotted, `[[array-of-tables]]`, inline table, header whitespace — and accept only the canonical
  shapes the lane passes in. A line whose `#` sits inside a string is not comment-stripped by
  position; a target line the recogniser cannot tokenise is `not-recognised`. **TOML** primitives
  in L3; **YAML** block-list, flow-list and mapping primitives in L3 for sgconfig. L5 extends the
  YAML set for golangci; L4 extends the TOML set for clippy's inline array.
- **Inserters** (I1). New elements go first, directly after `[` (flow) or as the first item
  (block), with a trailing comma where the syntax needs one. Whole lines end with `# getff`.
  Elements inserted into a single-line array get `# getff: +"A","B"` (or `; getff: +…` after an
  existing comment). A consumer value for the same key is kept and named in the log.
- **Idempotence** (D5). Every payload item is looked up by value, string-aware, before inserting;
  a re-run is byte-identical.
- **Refresh** (D10). Insert what the template added; remove only what a getff tag names; never
  touch a `kept-default` item; an untagged item is the consumer's.
- **Write-through** (I3). `keep_original_snapshot` / `keep_original_settle` (`setup.d/lib.sh:2789`
  / `:2803`) around every write; `cat tmp > dst`, never `mv`. If the original cannot be
  kept, the write is undone → `not-recognised`/NOT-wired with that reason. The original goes to
  `.ai-factory/before-getff/<path>.<sha8>` only when the write changed the file.
- **Probe scaffolding** (I4). `before → insert → after → compare`. The lane passes a runner that
  prints one result per line. The comparison requires before ⊆ after, unchanged, and after − before
  = the payload's getff-attributable set exactly. Anything else → restore and `rolled-back <diff>`.
- **Tool ladder** (D12, Deviation 4): consumer's tool on `PATH` → one-shot pinned run through the
  ecosystem runner → `not-proven <tool> unavailable (<why>)`. Never `pip install`,
  `rustup component add` or `go install` — grep your own diff for them (umbrella §0.2).
- **Result contract.** Exactly `added <n>` · `already-present` · `not-recognised <why>` ·
  `not-proven <why>` · `rolled-back <why>`. `added` → `note_getff_added <rel>`;
  `already-present` → a log line; the rest → `note_not_wired` with the reason, never a step.

### 3b One added-to printer for both paths

Move the added-to block out of `setup.d/99-finalize.sh` (`:652-660`, the loop over
`GETFF_ADDED_TO` plus its `✓ getff's block added to …` lines) into one `setup.d/lib.sh` function,
and call it from 99-finalize and from both lane paths in `install.sh` next to `print_not_wired`
(`install.sh:351` in `do_toolchain_lane`, `:400` in `do_python_lane`). Spec §5 «Summary on
the lane path». The npm-path output must stay byte-identical: the snapshot baselines prove it.

### 3c ruff (spec §4.1)

- **Targets:** every ruff config ruff loads for some Python file (nested included; L2's lookup
  list, `RUFF_CONFIG_NAMES` in `setup.d/lib.sh`). Resolve each directory's target by ruff itself —
  the settings path `--show-settings` reports — not by filename guess. Each target gets its own result line.
- **Consumer `--config`:** a ruff `--config` in the consumer's tooling (at least
  `.pre-commit-config.yaml` `args`; the lane already appends to that file, `45-python.sh:1031-1054`)
  → that path NOT-wired.
- **Shapes:** exactly spec §4.1's table, `P` = `` or `tool.ruff.`. The `extend` chain walk is
  local files only. `ignore` / `extend-ignore` prefix matching covers `TID`, `TID2`, `DTZ`, `ALL`
  and every other prefix of each getff code. `per-file-ignores` is left alone.
- **Payload** from `packages/core/templates/python/ruff.toml` (I6): the `[lint] select` codes
  (`DTZ005`, `TID251`, `TID253`), `banned-module-level-imports` (`tensorflow`), and the
  `banned-api` map. Read from the file at run time; never a second hard-coded copy.
- **Proof:** `ruff check --no-cache --show-settings <path in target dir>` before and after
  (P-L3-1, P-L3-4). The
  compared set is the effective enabled rule codes plus the tidy-imports ban entries. A ruff that
  cannot read the consumer's config before the edit → `not-proven` with ruff's message.
- `.getff/ruff-bans.toml` stays delivered in every cell (I5, `45-python.sh:394`).

### 3d sgconfig (spec §4.2)

- Replace `_py_sgconfig_merge` (`setup.d/45-python.sh:208`) with the writer. Shape S1 output must
  stay byte-identical to today's (spec §4.2: «existing merged files and the snapshot fingerprints
  do not change»). S2 is new. S3 ships (P-L3-3). The NOT-wired rows follow spec §4.2.
- Value `.getff/astgrep-rules`, no comment tag: the path attests itself (spec §6).
- **Proof:** `ast-grep scan -c <consumer sgconfig> --json` on a getff probe file, before and after;
  the after-set of rule ids equals the before-set plus getff's rule ids.
- Replace the reason text at `45-python.sh:361` (P-L3-3: a `ruleDirs`-less file is valid, so S3
  inserts instead of refusing).

### 3e Tests

- **`tests/install-sh/lane-config-writer.test.sh`** — the writer alone, lane-independent. Arms:
  byte preservation outside the inserted lines; first-position insertion with and without a
  trailing comma; `#` inside a string; every equivalent spelling of a key resolved, the
  non-canonical ones `not-recognised`; re-run byte-identity (D5); refresh add, refresh remove by
  tag, `kept-default` survives, an untagged item survives (D10); symlinked target stays a symlink
  with its mode (I3); unkeepable original → write undone (I3); an injected probe delta →
  `rolled-back` and a byte-identical file (I4); tool removed from `PATH` and runner absent →
  `not-proven` (D12); the result-contract strings, exactly.
- **`tests/install-sh/lane-config-insert-python.test.sh`** — table-driven from
  `tests/install-sh/fixtures/lane-config-insert/python/<row>/{input,golden}`: one fixture per §4.1
  and §4.2 table row, golden output for each insertion row; each NOT-wired row → byte-identical
  file and exactly one NOT-wired line carrying the reason; nested configs each on their own;
  the pre-commit `--config` case; the lane-path added-to printer output.
- Register both in `audit-self.yml` job `install-sh-c` (it already has pinned ruff and ast-grep,
  `:995-998`; principle 41). A probe arm whose tool is missing in CI **fails** (spec §9).
- Update `tests/install-sh/install-no-manual-step.test.sh` arms Y / C / J wherever a
  python NOT-wired line becomes an `added` line. Never weaken an arm to make it pass — each changed
  expectation cites the §4 row that changed it.

### 3f Delivery modes

No new consumer-delivered file (the helper is `$PKG_ROOT`-side, Deviation 1). Before-getff
originals are backup artefacts, not deliveries. State both in the PR body, and keep Check 4 of
`tests/install-sh/refresh-covers-full-delivery.test.sh` green.

### 3g File allowlist

Umbrella §2 column L3, the two new tests and their fixtures, regenerated baselines and MANIFEST,
at most one appended SSOT row, the D26 pages. Anything else → STOP. Recording a fired PARK is not
a file write (see /pipeline §5 park-record contract): it lands in the park payload + the PR's
`## Parked questions`, and its correction lands as a separate owner commit — so this allowlist
deliberately names no park-record artefact.

## §4 Regeneration and the docs-refresh gate

Umbrella §0.5 / §0.6. Expected drift: `tests/install-sh/baselines/python/*` (collision cells now
insert) and `packages/getff/MANIFEST.sha256` (new helper, changed lane file). The npm-path and
cargo/go baselines must **not** drift (3b) — if they do, STOP.

## §5 RED-first

Before implementation, commit the fixture tables with golden outputs and run
`lane-config-insert-python.test.sh` against the pre-change lane. Every insertion row must fail
(today's lane REFUSEs). Rows that need ruff or ast-grep fail only in CI when your environment
lacks them: paste the rows you ran, and name the CI job and run for the rest, or state that the
RED-first evidence for those rows is owed to that CI run. Then implement.

## §6 Exit gates

```bash host-verify
bash tests/install-sh/lane-config-writer.test.sh
bash tests/install-sh/lane-config-insert-python.test.sh
bash tests/install-sh/python-delivery.test.sh
bash tests/install-sh/python-entry-lane.test.sh
bash tests/install-sh/lane-ci-gate-isolation.test.sh
bash tests/install-sh/lane-config-lookup-names.test.sh
bash tests/install-sh/install-no-manual-step.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
scripts/build-getff-dist.sh --check
```

Arms that need ruff, ast-grep or uvx are CI-job tests where `command -v` fails (tool-absent rule
above; job `install-sh-c`). Plus `npx vitest run packages/core/hooks/pin-parity.test.ts packages/core/principles/33-adapter-jig-arm-registry.test.ts`,
`SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh` (npm path unchanged) and
`bash scripts/run-local-ci-sweep.sh`. The merge lock and CI-green-on-the-new-head are the harvest
session's (umbrella §0.4).

## §7 Falsifiers to write into the PR body

D1 (with the measured fraction), D2, D5, D8, D10 and D12 — verbatim from spec §8, each followed by
the arm that would catch it.

## §8 Descopes owned here (umbrella §5)

The ruff and sgconfig NOT-wired rows; getff code in `ignore`; `per-file-ignores` left alone;
consumer `--config` NOT-wired; nested configs each on their own; `not-proven` / `rolled-back`
with the tool's message; an unkeepable original (I3); spec §12 limits two and three (a formatter
strips the tags; the probe's ruff differs from the consumer's pinned one — the probe uses the
`PATH` ruff first). The consumer's `tsconfig.json` is never opened (P2).

## §9 Park contract

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external`
with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that
task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure
this whole loop exists to prevent. Deviation 5 is **not** a park: it is an informational entry
under `## Parked questions`, and the task proceeds with the stated default.

## §10 Report

Umbrella §9 format. `DECISIONS` cites P-L3-1..4 and the consult from
[kickoff.probes.md](kickoff.probes.md), and gives the measured D1 fraction.

## §11 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps: T1, T2, T3, T7, T11, T12, T15, T16, T19, T20, T21.**

- **T1** — the D1 sample is ≥20 ruff configs (≥5 sgconfig), named, not «a few I tried».
- **T7** — spec §4.1's table is a recogniser spec. A row that looks close to a fixture is still
  `not-recognised` if a key spelling is off.
- **T11 / T12 / T16** — the consult of §2 is read (the record, the three SSOT rows, PR #1868)
  before the first line of the helper; it is not re-run and not skipped.
- **T15 (mandatory)** — self-application: run the writer over this repo's own TOML / YAML
  configs (read-only dry run into a temp copy) and report what it recognises. A writer that
  cannot read its own house's files is a finding.
- **T19** — a cold review of the diff before handoff (`agents/review-sidecar.md`), in particular of
  byte preservation.
- **T21** — Backward-check class: «a getff write into a consumer-owned file». Surfaces include
  `packages/core/install/wire-eslint-r2.ts`, the #1868 synth-wire, and every `refresh_safe` /
  `copy_safe` call in the lanes.
- **T-LCI-A (domain)** — «the syntactically clean insertion is proof enough» (umbrella §8). A cell
  that writes when the ladder ends in `not-proven` ships the design round 1 rejected.
- **T-LCI-F (domain) — «the self-check proves the insertion».** The firing self-checks stay pinned
  to getff's delivered config (E2). The *differential probe* is a new, separate runner against the
  consumer's config. Reusing the self-check as the probe would reverse E2 and prove the wrong file.
