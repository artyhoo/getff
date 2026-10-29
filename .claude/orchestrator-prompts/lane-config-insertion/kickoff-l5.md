# lane-config-insertion — L5: go lane inserts getff's forbidigo bans (golangci v1/v2)

<!-- bridge-profile: Z.AI GLM-5.3 SDK -->

> **Umbrella:** [kickoff.md](kickoff.md). Its §0 binding rules, §2 file-lock matrix, §4 stop
> conditions and §5 descope register bind this stage; every deviation is declared below.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `feat/lane-insert-go`. **PR title:** `L5: go lane inserts getff's forbidigo bans (golangci v1/v2)`.
> **Channel:** one aif task, own worktree, one PR to `staging` (harvested from the host).
> **Rigor label (L0):** `build-and-verify` — edits a consumer-owned golangci YAML in two schemas
> under a golangci-run proof, including the D4 decision on forbidigo's default pattern.
> **Design SSOT:** [spec](../../../docs/superpowers/specs/2026-09-28-lane-config-insertion-design.md)
> §4.6, §4.7, §6 (`kept-default`), §7, §8 (D4, D7, D12), §9, §12.
> **Authoritative for:** the L5 contract, including the probe-module placement the spec leaves as
> «a plan design item» (§4.6 last paragraph). **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../../README.md#why-this-exists); any design decision — the spec;
> the writer — L3 owns it, L5 only extends it.

**Measurement SHA:** `origin/staging` = `a9c457321e6` (2026-09-29; PR #1890 merged as
`eb8e2306261`). L2 rewrites `setup.d/47-go.sh` and the go CI template: **re-locate by content**.

**Tool-absent rule (hard, umbrella §0.2).** `command -v <tool>` fails in your environment → you
do not install toolchains into the container and never paste output you did not run; proofs
that need the tool are CI-job tests (spec §9 shard placement) and the PR body says which CI job
ran them; if a needed decision depends on a tool run you cannot perform, park
`blocked_external`. The aif container has no go and no golangci-lint: every golangci-running arm
runs in CI job `principles-meta-tests` (§2c).

**Deviations (declared):**

1. **Probe-module placement is decided here** (spec §4.6: «a plan design item (round-1 F3)»). It
   is decided rather than parked because the spec fixes the requirement («relative paths in the
   consumer's config still resolve») and only one placement meets it without touching a consumer
   file. The choice: a getff-named temporary package directory **inside the project root**, next
   to the target config.
   - Its name must not begin with `.` or `_` (the go tool skips such directories in `./...`
     patterns). Use `getffprobe<random>`, and check that nothing by that name exists before
     creating it.
   - It holds one `.go` file in its own package (`os.Getenv` and `fmt.Println`, stdlib only), so it
     compiles inside the consumer's module.
   - It is removed on every exit path (`trap … EXIT INT TERM`, registered before the `mkdir`).
   - No `go.mod` at the project root (multi-module, `go.work`), the package failing to load, or
     the consumer's config excluding the directory → `not-proven <why>`. Never a guess.
   - The run targets only that package (`./getffprobe<random>/`), never `./...`.
2. **D12 step 2 builds only on an older Go (P-L5-1, measured).** `go run …@v1.55.2` builds and
   runs on go1.22.0 (33 s, project left clean) and **fails to build** on go1.25.0
   (`golang.org/x/tools@v0.14.0/internal/tokeninternal/tokeninternal.go:78:9: invalid array
   length -delta * delta`). So step 2 must treat a build failure as `not-proven <go's message>`,
   never as a lint result. The pin bump is its own task (spec §11) — never bumped here (umbrella
   §4 L5 row).

**Dependencies:** #1890 (merged, `eb8e2306261`), L2 (lookup list, go CI branches) and L3 (writer)
merged. L4 is a merge-
serialisation dependency only (umbrella §1): if L4 is parked, L5 may go first, with operator word.

## §1 Prerequisite probes — resolved on the host

All four ran before dispatch (PC WSL, go1.22.0 + golangci-lint v1.55.2; v2 checks with
golangci-lint 2.14.0); commands and raw output are in [kickoff.probes.md](kickoff.probes.md).
Do not re-run them; cite that file in `## Probe results`.

| Probe | Measured | Selected branch |
|---|---|---|
| **P-L5-1** | go1.22.0: builds, runs, project `git status` clean; writes only module/build caches and `$HOME/.cache/golangci-lint`. go1.25.0: build fails (Deviation 2). | Step 2 ships, with a build failure mapped to `not-proven`. |
| **P-L5-2** | Both versions name the linter in `Issues[].FromLinter`. v1: `--out-format json`. v2: `--output.json.path stdout`, and more text follows the JSON line (a whole-stream parse fails with «Extra data»). | The runner picks the flag by the binary's major version and parses the **first line** only (or a file path). |
| **P-L5-3** | v1.55.2 on `version: "2"` → exit 3, «Can't read config: can't unmarshal config by viper … 'Version' expected a map, got 'string'». v2.14.0 on a v1 file → «can't load config: unsupported version of the configuration: ""». | NOT-wired with the binary's message, both directions. |
| **P-L5-4** | Default pattern applied on v1.55.2 and v2.14.0: `^(fmt\.Print(\|f\|ln)\|print\|println)$` — equal to the spec literal; an explicit `forbid` list replaces it; with forbidigo not enabled nothing fires. | D4 `kept-default` as specified. |

Extra finding (v2 schema): a v1 key `p:` inside a `version: "2"` file is **silently** read as an
empty pattern that matches every identifier (4 issues on a one-function file, «use of `p`
forbidden by pattern ``»). The `p:` → `pattern:` translation for v2 is load-bearing; §2d carries
a fixture row for it.

## §2 Deliverables

### 2a golangci insertion (spec §4.6)

- **Target:** the file golangci-lint loads in the project root, by L2's lookup list. YAML targets
  are handled; `.golangci.toml` / `.golangci.json` → NOT-wired with that reason.
- **Schema:** v2 when the top-level `version` parses to 2 (`2`, `"2"`, `'2'`), else v1. v1 path
  `linters-settings.forbidigo.forbid`, key `p`; v2 path `linters.settings.forbidigo.forbid`, key
  `pattern`. `linters.enable` in both. Payload from `packages/core/templates/go/.golangci.yml`
  (`forbid: - p: 'os\.Getenv'`), read at run time and translated `p:` → `pattern:` for v2 (I6;
  template comment `:16-22` says the key is load-bearing). `formatters` is never a target.
  `disable-all` / `exclude-use-default` are never inserted.
- **Shapes:** exactly spec §4.6's table. It extends L3's YAML primitives: a block list under a
  mapping, an `enable:` list under an existing `linters:` mapping, an appended block at EOF, and a
  list of mappings for `forbid`. Flow style on any target, anchors or aliases, and multi-document
  files are `not-recognised`. `forbidigo` under `linters.disable` → NOT-wired («the consumer
  switched it off»).
- **D4 `kept-default`:** when there is no `forbid` list, insert `forbid:` with getff's pattern,
  **plus** the default pattern exactly when the before-probe reported forbidigo on the probe's
  `fmt.Println`. Tag that element `# getff: kept-default` (spec §6), so a refresh never removes it
  (D10). When forbidigo was not active before, insert getff's pattern only — the consumer's
  `fmt.Println` stays unflagged.
- **Before-probe = the consumer's own run.** No `-E`, no `--disable-all`, no `--default`, and no
  other linter-selection flag; `--config <target>`, machine-readable output, filtered to issues
  whose `FromLinter` is `forbidigo` (P-L5-2).
- **Proof:** that same run, before and after, on the Deviation 1 probe package. The after-run adds
  forbidigo's `os.Getenv` issue, keeps every before-issue (forbidigo's `fmt.Println` included,
  iff it was there), and adds nothing else. A config the binary cannot read (P-L5-3) → NOT-wired
  with the binary's message.
- **Tool ladder** (D12, L3's helper): the consumer's `golangci-lint` on `PATH` →
  `go run github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.2` (P-L5-1; a build failure →
  `not-proven` with go's message) → `not-proven`.
  Never `go install`. The literal `golangci-lint@v1.55.2` in `setup.d/47-go.sh` is already a
  pin-parity surface (`packages/core/hooks/pin-parity.test.ts:80-83`) — keep it matching.
- The firing self-check (`_go_firing_self_check`, `47-go.sh:186`) stays pinned to getff's
  delivered config (adapter-jig E2, `packages/core/principles/33-adapter-jig-arm-registry.ts:82`).
- The REFUSE cell's NOT-wired line (`47-go.sh:118`) becomes, per result: `added` →
  `note_getff_added`, or the reason from the result contract. `getff-golangci.yml` keeps
  shipping in every consumer-owned cell (I5 — the CI gate reads it; L2 made that gate
  getff-owned-only).

### 2b §4.7 — consumer CI workflows (D7), unchanged

A non-getff file squatting `.github/workflows/getff-<lane>.yml` stays NOT-wired, exactly as #1890
(merged) wrote it, in all three lanes. L5 changes no code here. It adds one assertion per lane to the new
test: the squatted file is byte-identical and exactly one NOT-wired line names it.

### 2c CI placement of golangci-lint

The install-sh shards have no golangci-lint; `principles-meta-tests` has go `1.22.0`
(`.github/workflows/audit-self.yml:362`) and golangci-lint `v1.55.2` (`:380`). Register
`lane-config-insert-go.test.sh` there — the job L1 and L4 use. A golangci arm whose tool is
missing **fails**. How each arm reaches the tool (name it in the PR body):

- **Ladder step 1** (`golangci-lint` on `PATH`) — every v1 insertion row, the D4 pair, the
  NOT-wired rows, the probe-directory lifecycle rows.
- **Ladder step 2** (`go run …@v1.55.2` on the job's go1.22.0) — one arm, run with
  `golangci-lint` removed from `PATH`, asserting the same result as step 1. One arm with a stub
  `go` that fails the build asserts `not-proven` and a byte-identical file.
- **v2 rows.** The writer's v2 golden outputs are tool-free and run everywhere. A v2 *probe*
  proof needs a v2 binary, which no CI job installs today (`principles-meta-tests` pins v1.55.2
  only; golangci-lint 2.14.0 needs go ≥ 1.26.0 to build, measured). **Operator decision
  (2026-09-29, AskUserQuestion in the design session): option A.** Add to `principles-meta-tests`
  an exact-pinned golangci-lint **v2.14.0 prebuilt release binary** (official release tarball,
  sha256-verified in the step, per ci-tool-pinning.md Rule A; not `go install`, which needs
  go ≥ 1.26), on a path separate from v1.55.2, and run the v2 probe arms with it — so the v2
  output parser (P-L5-2) is proven in CI like v1's. If the prebuilt binary cannot load packages
  under the job's go1.22.0, add a second exact-pinned `actions/setup-go` (`go-version: '1.26.0'`)
  scoped to the v2 arm only, and say so in the PR body. Option B (writer-level proof only) was
  rejected by the operator. This is not a park.

### 2d Tests

- **`tests/install-sh/lane-config-insert-go.test.sh`** — table-driven from
  `tests/install-sh/fixtures/lane-config-insert/go/<row>/{input,golden}`: every §4.6 row in
  **both** schemas; `.toml` / `.json` → NOT-wired; `disable` → NOT-wired; the D4 pair (forbidigo
  active before → `kept-default` inserted; not active → getff's pattern only); a v2 file under a
  v1 binary → NOT-wired with the message; the probe directory gone after success, rollback and a
  `kill -TERM` mid-probe; no `go.mod` → `not-proven`; the §2b squat rows; refresh leaves
  `kept-default` in place; a v2 target receives `pattern:`, never `p:` (the silent-empty-pattern
  finding of §1).
- Register in `audit-self.yml` (principle 41). Update `tests/install-sh/go-entry-lane.test.sh` and
  arms Y / C / J of `tests/install-sh/install-no-manual-step.test.sh` where a go NOT-wired line
  becomes `added`. Each changed expectation cites the §4.6 row that changed it.

### 2e Delivery modes and allowlist

No new consumer-delivered file. The probe directory is created and removed inside one run, and is
never delivered — assert it is absent from the post-install tree and from `refresh-baseline.json`.
Keep Check 4 of `tests/install-sh/refresh-covers-full-delivery.test.sh` green. **Allowlist:**
umbrella §2 column L5, the new test and its fixtures, regenerated baselines and MANIFEST, and the
D26 pages. Anything else → STOP. Recording a fired PARK is not a file write (see /pipeline §5
park-record contract): it lands in the park payload + the PR's `## Parked questions`, and its
correction lands as a separate owner commit — so this allowlist deliberately names no
park-record artefact.

## §3 Prior-art consult

L5 extends L3's writer; it is no new capability class. Trailer:
`Prior-art: prior-art-evaluations.md#216 (BUILD — L3's lane writer extended to golangci YAML v1/v2; no new capability class).`
Re-read `#117` before writing the YAML inserters: it is the reason there is no yq.

## §4 Regeneration and the docs-refresh gate

Umbrella §0.5 / §0.6. Expected drift: `tests/install-sh/baselines/go/*` and
`packages/getff/MANIFEST.sha256`. Other baselines must not drift.

## §5 RED-first

Commit the fixture table and goldens first; run `lane-config-insert-go.test.sh` on the pre-change
lane and paste it: every insertion row fails, and every NOT-wired row already passes or fails for
a named reason. Rows that need golangci-lint run only in `principles-meta-tests`: paste the rows
you ran and name the CI job and run for the rest, or state that their RED-first evidence is owed
to that CI run.

## §6 Exit gates

```bash host-verify
# golangci arms: CI job principles-meta-tests (ladder step 1; one arm step 2) — see §2c
bash tests/install-sh/lane-config-insert-go.test.sh
bash tests/install-sh/go-entry-lane.test.sh
bash tests/install-sh/lane-config-writer.test.sh
bash tests/install-sh/lane-config-lookup-names.test.sh
bash tests/install-sh/install-no-manual-step.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
scripts/build-getff-dist.sh --check
```

The first command needs golangci-lint (or go for step 2): where `command -v` fails it is a CI-job
test in `principles-meta-tests`, reached through the D12 ladder as §2c lists; the PR body names
the job. Plus `npx vitest run packages/core/hooks/pin-parity.test.ts packages/core/principles/33-adapter-jig-arm-registry.test.ts`
and `bash scripts/run-local-ci-sweep.sh`. The merge lock and CI-green-on-the-new-head are the
harvest session's (umbrella §0.4). L5 is the last stage: after merge, the closure session runs
the umbrella §7 global gate and writes `done.md`.

## §7 Falsifiers to write into the PR body

D4 («forbidigo changes `DefaultPatterns()` in the version the consumer runs → the inserted literal
diverges» — P-L5-4 recorded today's string on v1.55.2 and v2.14.0) and D12 (the go half), verbatim from spec §8, each with
its catching arm.

## §8 Descopes owned here (umbrella §5)

`.golangci.toml` / `.json` are NOT-wired; `formatters` is never a target; `disable-all` /
`exclude-use-default` are never inserted; `forbidigo` under `disable` is NOT-wired; the squatted
`getff-<lane>.yml` stays NOT-wired (§4.7, D7); there is no `go install` (P7). Spec §12 limit one
(`-E forbidigo` only on a command line the install cannot see) is stated in the PR body as a
recorded blind spot, with the `kept-default` tag as its partial guard.

## §9 Park contract

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external`
with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that
task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure
this whole loop exists to prevent.

## §10 Report

Umbrella §9 format. `DECISIONS` cites P-L5-1..4 from [kickoff.probes.md](kickoff.probes.md),
the ladder step each fixture row used, and the CI job that ran them.

## §11 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps: T3, T7, T12, T14, T15, T16, T19, T21.**

- **T12 / T16** — v1 and v2 are two schemas that share a name. A fixture proven only in v1 says
  nothing about v2; every row runs in both.
- **T14** — a D4 row that «passes» because the before-run never reported forbidigo at all
  (probe package not loaded, directory skipped) is a false pass. Each D4 fixture asserts the
  before-run's forbidigo count explicitly.
- **T15 (mandatory)** — self-application: this repo's own golangci use in `principles-meta-tests`
  — does its config take the D4 branch? Record it.
- **T21** — Backward-check class: «a getff run of the consumer's tool that adds flags the
  consumer's own run does not use». Sweep the three lanes' probe runners and self-checks.
- **T-LCI-A (domain)** — only the golangci run authorises the insertion (umbrella §8).
- **T-LCI-H (domain) — the forcing flag.** `-E forbidigo` or `--disable-all` on the before-probe
  answers D4's question «was the default active?» by construction — always yes — and then
  inserts `fmt.Println` bans into every consumer. The before-probe's argument vector is asserted
  in the test, not only its output.
