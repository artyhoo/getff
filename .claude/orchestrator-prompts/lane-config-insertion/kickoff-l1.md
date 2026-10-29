# lane-config-insertion — L1: getff CI gates read only getff-owned configs (§4.0)

<!-- bridge-profile: Z.AI GLM-5.3 SDK -->

> **Umbrella:** [kickoff.md](kickoff.md). Its §0 binding rules, §2 file-lock matrix, §4 stop
> conditions and §5 descope register bind this stage. This file restates what the executor needs;
> where it deviates from or widens the umbrella, the «Deviations» list below says so.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `fix/lane-ci-gate-isolation`. **PR title:** `L1: getff CI gates read only getff-owned configs`.
> **Channel:** one aif task, own worktree, one PR to `staging` (harvested from the host — never
> pushed from the container).
> **Rigor label (L0):** `build-and-verify` — changes what two shipped CI gates enforce, proven by
> live tool probes and a RED-first isolation test.
> **Design SSOT:** [spec §4.0](../../../docs/superpowers/specs/2026-09-28-lane-config-insertion-design.md)
> plus §3 I5, §8 D9, §9 (isolation arms), §12 (source-level `#![deny]`).
> **Authoritative for:** the L1 contract — anchors, deliverables, the branch the two host-run
> probes selected, exit gates, falsifiers. **NOT authoritative for:** project goal —
> see [README.md#why-this-exists](../../../README.md#why-this-exists); any design decision — the spec.

**Measurement SHA:** `origin/staging` = `a9c457321e6` (2026-09-29; PR #1890 merged as
`eb8e2306261`, lane files byte-identical). Re-locate every anchor by content (`grep -n`) before
editing all the same.

**Tool-absent rule (hard, umbrella §0.2).** `command -v <tool>` fails in your environment → you
do not install toolchains into the container and never paste output you did not run; proofs
that need the tool are CI-job tests (spec §9 shard placement) and the PR body says which CI job
ran them; if a needed decision depends on a tool run you cannot perform, park
`blocked_external`. The aif container has no cargo, clippy or ast-grep: every arm of §5 runs in
CI.

**Deviations from the spec text (declared, with the reason):**

1. **Delivery cell.** Spec §4.0 says `.getff/clippy/clippy.toml` and `.getff/sgconfig.yml` are
   «delivered in every consumer-owned cell», yet the gate command it prescribes is unconditional —
   a fresh-cell consumer without the file gets a clippy error on a missing `CLIPPY_CONF_DIR`, or
   an ast-grep error on a missing `-c` file. L1 delivers both files in **every** cell, the way the
   python lane already delivers `.getff/ruff-bans.toml` unconditionally (`setup.d/45-python.sh:394`).
   That is the spec's own named precedent. A missing `CLIPPY_CONF_DIR` directory is a hard
   clippy error; an empty one is a silent green (P-L1-1 edge cases,
   [kickoff.probes.md](kickoff.probes.md)).
2. **`ruleDirs` in `.getff/sgconfig.yml`.** The spec leaves the value unstated. `ruleDirs`
   resolve relative to the config file (P-L1-2, measured), so the getff-owned file lists
   `astgrep-rules`, **not** `.getff/astgrep-rules`. The wrong spelling resolves to
   `.getff/.getff/astgrep-rules` and ast-grep 0.44.1 aborts loudly — `Error: Cannot read rule
   directory .getff/.getff/astgrep-rules`, exit 6 — so every CI run would fail on a tooling
   error instead of enforcing anything.
3. **Widening — the local pre-push mirror.** `packages/core/templates/python/hooks/pre-push.sh:58-61`
   runs the same bare `ast-grep scan` and declares itself the mirror of the CI step. The spec
   names CI only; L1 changes the hook as well, or the local gate and CI would disagree.
4. **go is not in L1.** The go CI `else` branch belongs to L2 (umbrella §1). L1 does not open
   `packages/core/templates/go/**`.

**Dependencies:** PR #1890 merged (umbrella §3 gate 0 — satisfied, `eb8e2306261`). No other
stage open.

## §1 Prerequisite probes — resolved on the host; both select «works»

Both probes ran before dispatch; commands and raw output are in
[kickoff.probes.md](kickoff.probes.md). Do not re-run them; cite that file in `## Probe results`.

| Probe | Measured (tool) | Selected branch |
|---|---|---|
| **P-L1-1** cargo | clippy 0.1.96 (the `audit-self.yml:341` pin) and 0.1.98: the isolated gate exits 0 over (a) `Cargo.toml [lints.clippy]` + a consumer threshold and (b) `[workspace.lints.clippy]`; exits 101 on (c) source-level `#![deny]`; exits 101 on the positive control («use of a disallowed method `std::env::var`») although the consumer's `clippy.toml` has `disallowed-methods = []`. | **«works» — the isolated gate ships (§2a).** (c) is spec §12's recorded limit, not a fallback trigger. |
| **P-L1-2** ast-grep | ast-grep 0.44.1: bare `ast-grep scan` reports only `consumer-no-print`; `ast-grep scan -c .getff/sgconfig.yml` with `ruleDirs: [astgrep-rules]` reports `getff-no-os-system` in `pkg/app.py` and nothing of the consumer's. | **«works» — the isolated gate ships (§2b).** |

The recorded spec fallbacks (gate on the consumer's config) are **not** taken; L4 reads this
result from here, not from a probe of its own. If a CI-job run of §5 contradicts this record,
that is the umbrella §4 L1 stop.

## §2 Deliverables

### 2a cargo gate (P-L1-1 «works»)

1. `packages/core/templates/cargo/github-actions-ci.yml:47-48` — the clippy step becomes
   `CLIPPY_CONF_DIR="$GITHUB_WORKSPACE/.getff/clippy" cargo clippy --all-targets -- -A clippy::all -A clippy::pedantic -A clippy::nursery -A clippy::restriction -A clippy::cargo -D clippy::disallowed_methods -D clippy::disallowed_types -D clippy::disallowed_macros`
   (absolute path — a `CLIPPY_CONF_DIR` clippy cannot find is a hard error, P-L1-1). Keep
   `rustup component add clippy` at `:42-43`: that runs in the consumer's CI, not in the install
   (P7 limits the install only).
2. New framework-owned file `.getff/clippy/clippy.toml`, byte-for-byte the current
   `packages/core/templates/cargo/clippy.toml`, delivered by `_cargo_copy_or_refresh` in every
   cell (Deviation 1). **Delivery mode:** the lane copy-or-refresh wrapper — skip-if-exists on
   install, overwrite on `GETFF_TOOLCHAIN_REFRESH`. **`--refresh` parity:** add it to the cargo
   row's evidence in `tests/install-sh/refresh-covers-full-delivery.test.sh` Check 4 (the
   `TOOLCHAIN_LANES` table, `:56-60`).
3. **Retire `getff-clippy.toml` — install and refresh.** After L1 the cargo REFUSE cell (a
   consumer-authored `clippy.toml`, `46-cargo.sh:112-120`) writes **only**
   `.getff/clippy/clippy.toml`: the `_cargo_copy_or_refresh "$tpl/clippy.toml" "$getff_ref"`
   call (`:115`) and the `getff_ref="$PROJECT_ROOT/getff-clippy.toml"` target (`:102`) go, and
   no install writes `getff-clippy.toml` in any cell. The REFUSE log line (`:117`, «Shipped our
   rules as getff-clippy.toml») names `.getff/clippy/clippy.toml` instead. On refresh, a
   `getff-clippy.toml` left by a previous getff is removed only when it carries getff's header
   (`generated by getff`), with a `_cargo_log` line saying so; a header-less file of that name
   is the consumer's and stays. Extend `tests/install-sh/lane-orphan-residue.test.sh`
   (adapter-jig C4, `packages/core/principles/33-adapter-jig-arm-registry.ts:75`, `:602-609`)
   so a leftover getff-headed `getff-clippy.toml` after refresh is RED. L2's LN-C1 asserts
   exactly `.getff/clippy/clippy.toml` in the cells it touches.
4. **The same stale-fact check for cargo.** Every cargo NOT-wired line that names what the getff
   CI workflow reads — the REFUSE line (`46-cargo.sh:120`, «clippy, $_where, runs with your
   settings only», where `$_where` includes «in the getff CI workflow») and the `_ci` sentence
   (`:134-136`) — must be true once the gate reads `.getff/clippy/clippy.toml`. The REFUSE line
   becomes: the local run uses the consumer's settings only; the getff CI workflow enforces
   getff's bans from `.getff/clippy/clippy.toml`.
5. **Resolver.** `_cargo_delivered_clippy_path` (`setup.d/46-cargo.sh:93-94`) becomes
   `_lane_delivered_config_path clippy.toml .getff/clippy/clippy.toml` (the helper at
   `setup.d/lib.sh:1561` takes a relative sub-path): a getff-headed root `clippy.toml` still
   resolves to itself; the REFUSE cell resolves to `.getff/clippy/clippy.toml`. So
   `_cargo_write_rules_lock` (`46-cargo.sh:187`) fingerprints it and `_cargo_firing_self_check`
   (`:203`) runs against it. Arm E2 `self-check-resolves-delivered-config`
   (`33-adapter-jig-arm-registry.ts:82`, `:486-494`) must stay green — do not reverse it. If the
   arm's locator text names `getff-clippy.toml`, update the locator, not the invariant.

### 2b ast-grep gate (P-L1-2 «works»)

1. New template `packages/core/templates/python/.getff/sgconfig.yml` with `ruleDirs:` →
   `- astgrep-rules` (Deviation 2), getff header comment, delivered to `.getff/sgconfig.yml` by
   `_py_copy_or_refresh` in every cell. The same delivery mode and Check 4 parity as 2a.2.
2. `packages/core/templates/python/github-actions-ci.yml:48-49` → `ast-grep scan -c .getff/sgconfig.yml`.
3. `packages/core/templates/python/hooks/pre-push.sh:58-61` → the same command (Deviation 3).
4. The existing consumer-side `sgconfig.yml` merge (`_py_sgconfig_merge`, `setup.d/45-python.sh:208`)
   is **not touched** in L1. L3 replaces it. **One exception:** the REFUSE-cell NOT-wired line
   of `_py_deliver_astgrep` (`45-python.sh:363-365`, comment «The getff CI job runs a bare
   `ast-grep scan`, so it reads the same sgconfig.yml») says the getff CI workflow runs only the
   consumer's rules. After this stage that sentence is false, so L1 corrects it: the CI half now
   runs getff's rules and only the local run lacks them. A stale NOT-wired line is a false fact.

### 2c Refresh fact line (spec §4.0, last paragraph)

On `--refresh`, a consumer whose cargo or ast-grep gate moves onto the getff-owned config gets one
fact line: its getff CI gate now enforces getff's bans and can turn red on code it should always
have flagged. It is a **plain lane log line** — `_cargo_log` (`setup.d/46-cargo.sh:76`) for cargo,
`_py_log` (`setup.d/45-python.sh:80`) for ast-grep — **not** `note_not_wired` (nothing is left
undone, so it is no NOT-wired entry and does not count in `NOT_WIRED`). It is printed only for a
consumer in a collision cell whose gate changes: a consumer-authored `clippy.toml` (cargo) or
`sgconfig.yml` (ast-grep) whose getff CI workflow is getff's (`_lane_getff_ci_runs`,
`setup.d/lib.sh:1588`). A fresh-cell consumer, whose gate already read getff's config, gets no
line. Never phrase it as a step for the user (umbrella §0.1).

### 2d File allowlist

Only the paths in umbrella §2 column L1, plus the new test, its fixtures under
`tests/install-sh/fixtures/lane-ci-gate-isolation/`, regenerated baselines and MANIFEST, and the
D26 pages. Anything else → STOP. Recording a fired PARK is not a file write (see /pipeline §5
park-record contract): it lands in the park payload + the PR's `## Parked questions`, and its
correction lands as a separate owner commit — so this allowlist deliberately names no
park-record artefact.

## §3 Prior-art consult

L1 is a defect fix inside an existing capability (two CI gates getff already ships), not a
capability commit: the new files are a copied template, a small YAML file, and test material
(CLAUDE.md carve-outs). If the pre-push `prior-art` check trips anyway, use the escape hatch
`Prior-art: skipped — defect fix of existing getff CI gates, config isolation only` and cite
`prior-art-evaluations.md#216` in the PR body as the lane-delivery precedent.

## §4 Regeneration and the docs-refresh gate

Umbrella §0.5 and §0.6. Expected drift: `tests/install-sh/baselines/cargo/*` and
`tests/install-sh/baselines/python/*` (new delivered paths, refresh-baseline fingerprint),
`packages/getff/MANIFEST.sha256`. Drift anywhere else → STOP.

## §5 Proof — a deterministic test, RED first

New `tests/install-sh/lane-ci-gate-isolation.test.sh`. Register it in `.github/workflows/audit-self.yml`
(principle 41) in job **`principles-meta-tests`** (`audit-self.yml:264`): it already installs
both pinned tools — ast-grep `0.44.1` (`:302`) and rust `1.96.1` + clippy (`:341-342`) — so no
shard gains a toolchain. A probe arm whose tool is missing in CI **fails**; it does not skip
(spec §9). L4 and L5 place their tool-running arms in the same job.

Arms (each extracts the gate command **from the template file** — never retypes it; T-LCI-B):

- **ISO-C1** — the consumer's `clippy.toml` has no getff ban; the code calls `std::env::var`. The
  getff gate is RED on it.
- **ISO-C2** — `Cargo.toml [lints.clippy]` sets a non-getff lint to `deny`, a consumer
  `clippy.toml` sets a threshold, and the code trips that lint but has no getff ban. The gate is
  GREEN (spec §9).
- **ISO-C3** — the `#![deny]` case from P-L1-1(c): the gate is RED (exit 101, «unneeded `return`
  statement»), as measured; a comment states the §12 limit.
- **ISO-A1** — the consumer's `sgconfig.yml` lacks getff's rules, and a file violates one. The
  getff gate is RED.
- **ISO-A2** — the hook in `pre-push.sh` and the CI step run the same command
  (`grep -F` on both files).

**RED-first:** run the suite on the pre-change templates and paste the output. ISO-C1 and ISO-A1
must fail there (today's gate reads the consumer's config). That failing run is the proof the test
can see the defect. The container has neither clippy nor ast-grep, so the RED-first run is a CI
run: commit the test before the template change, and the PR body names the CI job and run of the
RED result, or states that the RED-first evidence is owed to that CI run. Never paste a run you
did not perform.

## §6 Exit gates

```bash host-verify
bash tests/install-sh/lane-ci-gate-isolation.test.sh
bash tests/install-sh/cargo-entry-lane.test.sh
bash tests/install-sh/python-delivery.test.sh
bash tests/install-sh/python-entry-lane.test.sh
bash tests/install-sh/lane-orphan-residue.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
bash tests/install-sh/install-no-manual-step.test.sh
scripts/build-getff-dist.sh --check
```

The first command runs clippy and ast-grep, and the lane suites run their E1/E2 arms with the
research tools required: in the container these are CI-job tests (tool-absent rule above). Plus:
`npx vitest run packages/core/principles/33-adapter-jig-arm-registry.test.ts` green (E2 and C4
not reversed) and `bash scripts/run-local-ci-sweep.sh` green. The merge lock and the
CI-green-on-the-new-head check are the harvest session's (umbrella §0.4), not yours.

## §7 Falsifiers to write into the PR body

- D9 (spec §8): «any getff CI gate reads a consumer config after §4.0 ships, unless a §4.0 probe
  forces the recorded fallback, or the isolated cargo gate goes red on a consumer lint that is not
  a getff ban». ISO-C1, ISO-C2 and ISO-A1 are the checks (neither fallback was forced,
  [kickoff.probes.md](kickoff.probes.md)).
- «The rules-lock fingerprint and the CI gate attest different ban sets» — E2 plus a lock
  assertion in the cargo arm.

## §8 Out of scope (owned elsewhere)

- the go CI `else` branch → L2;
- any insertion into a consumer file → L3-L5;
- the source-level `#![deny]` limit → recorded (spec §12), not fixed;
- `Cargo.toml` → never (P5 / D3, L4 restates it).

## §9 Park contract

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external`
with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that
task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure
this whole loop exists to prevent. The umbrella §4 stop conditions are parks too.

## §10 Report

Umbrella §9 format. `DECISIONS` names the P-L1-1 and P-L1-2 branches taken («works», from
[kickoff.probes.md](kickoff.probes.md)) and the CI job that ran §5.

## §11 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps: T2, T3, T7, T14, T15, T19, T20, T21.**

- **T2 / T3** — each tool result is a command plus its raw output (the probe record, or a named CI
  job), never «clippy docs say».
- **T14** — a green isolation test with the fixture crate missing its `std::env::var` call proves
  nothing. The RED-first run is the coverage evidence.
- **T15 (mandatory)** — self-application: does this repo's own `principles-meta-tests` clippy step
  read a consumer-shaped config? Record the answer in the Backward-check.
- **T21** — Backward-check: hand the class «a getff gate reads a config the consumer owns» to
  `agents/backward-sweep-auditor.md`. The surfaces include the pre-push hooks of all three lanes
  and the go gate (L2 owns the fix there; record it as a GAP handed on).
- **T-LCI-B (domain)** — «the gate reads getff's config» asserted from the YAML. Only a run of
  the template's own command against a fixture without getff's bans counts (umbrella §8).
- **T-LCI-D (domain) — the relative-path trap.** `ruleDirs` resolve relative to the config file,
  `CLIPPY_CONF_DIR` must be absolute. An empty conf dir is green on everything (P-L1-1 edge case),
  so every arm asserts that at least one getff rule **fired**, not merely that the command exited.
