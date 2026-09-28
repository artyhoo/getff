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
> **Authoritative for:** the L1 contract — anchors, deliverables, the two prerequisite probes
> and their recorded fallbacks, exit gates, falsifiers. **NOT authoritative for:** project goal —
> see [README.md#why-this-exists](../../../README.md#why-this-exists); any design decision — the spec.

**Measurement SHA:** `origin/staging` = `b3a19811be6` (2026-09-29); «#1890» = PR #1890 head
`8c82c1a1e7b`. #1890 merges before this stage starts, so **re-locate every lane-file anchor by
content** (`grep -n`) before editing. The CI templates below are not touched by #1890 (their go
gate at `:67-78` is byte-identical on both SHAs).

**Deviations from the spec text (declared, with the reason):**

1. **Delivery cell.** Spec §4.0 says `.getff/clippy/clippy.toml` and `.getff/sgconfig.yml` are
   «delivered in every consumer-owned cell», yet the gate command it prescribes is unconditional —
   a fresh-cell consumer without the file gets a clippy error on a missing `CLIPPY_CONF_DIR`, or
   an ast-grep error on a missing `-c` file. L1 delivers both files in **every** cell, the way the
   python lane already delivers `.getff/ruff-bans.toml` unconditionally (`setup.d/45-python.sh:378`
   staging, `:394` #1890). That is the spec's own named precedent.
2. **`ruleDirs` in `.getff/sgconfig.yml`.** The spec leaves the value unstated. Since `ruleDirs`
   resolve relative to the config file (the probe below confirms it), the getff-owned file lists
   `astgrep-rules`, **not** `.getff/astgrep-rules`. Get this wrong and the rules resolve to
   `.getff/.getff/astgrep-rules`: zero rules load, and the gate is green on everything.
3. **Widening — the local pre-push mirror.** `packages/core/templates/python/hooks/pre-push.sh:58-61`
   runs the same bare `ast-grep scan` and declares itself the mirror of the CI step. The spec
   names CI only; L1 changes the hook as well, or the local gate and CI would disagree.
4. **go is not in L1.** The go CI `else` branch belongs to L2 (umbrella §1). L1 does not open
   `packages/core/templates/go/**`.

**Dependencies:** PR #1890 merged (umbrella §3 gate 0). No other stage open.

## §1 Prerequisite probes — run FIRST, record in the PR body `## Probe results`

Neither probe's result is known today (spec §11: «T3 INCONCLUSIVE until run»). Run each on the
pinned tool, paste the command and its raw output, and state which spec branch it selects. L4
reads P-L1-1 from this PR body.

| Probe | Question | «Works» branch | Recorded fallback (spec §4.0) |
|---|---|---|---|
| **P-L1-1** cargo | With `CLIPPY_CONF_DIR=<abs dir holding getff's clippy.toml>`, do trailing `-A clippy::all -A clippy::pedantic -A clippy::nursery -A clippy::restriction -A clippy::cargo -D clippy::disallowed_methods -D clippy::disallowed_types -D clippy::disallowed_macros` override (a) `Cargo.toml [lints.clippy]`, (b) `[workspace.lints.clippy]`, (c) source-level `#![deny(clippy::…)]`? One fixture crate per case, each setting a non-getff clippy lint to `deny` on code that trips it and has no getff ban. | (a) and (b) overridden → the isolated gate ships | (a) or (b) survives → keep the gate on the consumer's config; §4.3's insertion (L4) is what it enforces, and §4.4 wording says so. (c) surviving is spec §12's recorded limit, **not** a fallback trigger. |
| **P-L1-2** ast-grep | On `@ast-grep/cli@0.44.1`: does `ast-grep scan -c .getff/sgconfig.yml` resolve `ruleDirs: [astgrep-rules]` relative to `.getff/`, and scan the working directory by default? A fixture with a consumer `sgconfig.yml` that lacks getff's rules, plus a file that violates a getff rule. | the getff rule fires | The gate stays on the consumer's `sgconfig.yml`; I5 carries a recorded exception for ast-grep; a refused or deleted §4.2 entry becomes a NOT-wired line saying «the getff ast-grep gate runs the consumer's rules only» (L3 writes that line — hand it over in `## Probe results`). |

Use the pinned toolchain the repo's CI already uses: rust `1.96.1` + clippy
(`.github/workflows/audit-self.yml:338-344`) and ast-grep `0.44.1` (`:995-998`). Never widen a
pin in this stage.

A probe result that is **neither** column → STOP (umbrella §4). Park it as a question.

## §2 Deliverables

### 2a cargo gate (if P-L1-1 selects «works»)

1. `packages/core/templates/cargo/github-actions-ci.yml:47-48` — the clippy step becomes
   `CLIPPY_CONF_DIR="$GITHUB_WORKSPACE/.getff/clippy" cargo clippy --all-targets -- -A clippy::all -A clippy::pedantic -A clippy::nursery -A clippy::restriction -A clippy::cargo -D clippy::disallowed_methods -D clippy::disallowed_types -D clippy::disallowed_macros`
   (absolute path — clippy errors on a relative one it cannot find from the crate dir). Keep
   `rustup component add clippy` at `:42-43`: that runs in the consumer's CI, not in the install
   (P7 limits the install only).
2. New framework-owned file `.getff/clippy/clippy.toml`, byte-for-byte the current
   `packages/core/templates/cargo/clippy.toml`, delivered by `_cargo_copy_or_refresh` in every
   cell (Deviation 1). **Delivery mode:** the lane copy-or-refresh wrapper — skip-if-exists on
   install, overwrite on `GETFF_TOOLCHAIN_REFRESH`. **`--refresh` parity:** add it to the cargo
   row's evidence in `tests/install-sh/refresh-covers-full-delivery.test.sh` Check 4 (the
   `TOOLCHAIN_LANES` table, `:56-60`).
3. **Retire `getff-clippy.toml`.** A consumer upgrading from a previous getff has one; the
   refresh removes it only when it carries getff's header, and says so. Extend
   `tests/install-sh/lane-orphan-residue.test.sh` (adapter-jig C4, `packages/core/principles/33-adapter-jig-arm-registry.ts:75`, `:602-609`)
   so a leftover getff-headed `getff-clippy.toml` after refresh is RED.
4. **The same stale-fact check for cargo.** Every cargo NOT-wired line that names what the getff
   CI workflow reads (the `_ci` sentence, `46-cargo.sh:133-136` on #1890) must still be true
   once the gate reads `.getff/clippy/clippy.toml`.
5. **Resolver.** `_cargo_delivered_clippy_path` (`setup.d/46-cargo.sh:93`, calling
   `_lane_delivered_config_path` at `setup.d/lib.sh:1561`) returns `.getff/clippy/clippy.toml`,
   so `_cargo_write_rules_lock` (`46-cargo.sh:185`) fingerprints it and `_cargo_firing_self_check`
   (`:201`) runs against it. Arm E2 `self-check-resolves-delivered-config`
   (`33-adapter-jig-arm-registry.ts:82`, `:486-494`) must stay green — do not reverse it. If the
   arm's locator text names `getff-clippy.toml`, update the locator, not the invariant.
6. If P-L1-1 selects the fallback: none of 1-5 ships. Record the result; the cargo template stays
   as it is. L4 owns the consequence.

### 2b ast-grep gate (if P-L1-2 selects «works»)

1. New template `packages/core/templates/python/.getff/sgconfig.yml` with `ruleDirs:` →
   `- astgrep-rules` (Deviation 2), getff header comment, delivered to `.getff/sgconfig.yml` by
   `_py_copy_or_refresh` in every cell. The same delivery mode and Check 4 parity as 2a.2.
2. `packages/core/templates/python/github-actions-ci.yml:48-49` → `ast-grep scan -c .getff/sgconfig.yml`.
3. `packages/core/templates/python/hooks/pre-push.sh:58-61` → the same command (Deviation 3).
4. The existing consumer-side `sgconfig.yml` merge (`_py_sgconfig_merge`, `setup.d/45-python.sh:208`)
   is **not touched** in L1. L3 replaces it. **One exception:** the REFUSE-cell NOT-wired line
   of `_py_deliver_astgrep` (#1890 `45-python.sh:362-365`, comment «The getff CI job runs a bare
   `ast-grep scan`, so it reads the same sgconfig.yml») says the getff CI workflow runs only the
   consumer's rules. After this stage that sentence is false, so L1 corrects it: the CI half now
   runs getff's rules and only the local run lacks them. A stale NOT-wired line is a false fact.
5. If P-L1-2 selects the fallback, none of 1-4 ships; hand the NOT-wired wording to L3.

### 2c Refresh fact line (spec §4.0, last paragraph)

On `--refresh`, a consumer whose cargo or ast-grep gate moves onto the getff-owned config gets one
printed fact line: its getff CI gate now enforces getff's bans and can turn red on code it should
always have flagged. Use the lane's existing summary mechanism. Never phrase it as a step for the
user (umbrella §0.1).

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
(principle 41) **in a job that has both tools**: either install the pinned clippy in
`install-sh-c` (the shard that already has pinned ast-grep, `:995-998`), or run the cargo arm
in `principles-meta-tests` (which has clippy, `:338-344`). A probe arm whose tool is missing in
CI **fails**; it does not skip (spec §9).

Arms (each extracts the gate command **from the template file** — never retypes it; T-LCI-B):

- **ISO-C1** — the consumer's `clippy.toml` has no getff ban; the code calls `std::env::var`. The
  getff gate is RED on it.
- **ISO-C2** — `Cargo.toml [lints.clippy]` sets a non-getff lint to `deny`, a consumer
  `clippy.toml` sets a threshold, and the code trips that lint but has no getff ban. The gate is
  GREEN (spec §9).
- **ISO-C3** — the `#![deny]` case from P-L1-1(c): assert whatever the probe measured, and state
  the §12 limit in a comment.
- **ISO-A1** — the consumer's `sgconfig.yml` lacks getff's rules, and a file violates one. The
  getff gate is RED.
- **ISO-A2** — the hook in `pre-push.sh` and the CI step run the same command
  (`grep -F` on both files).

**RED-first:** run the suite on the pre-change templates and paste the output. ISO-C1 and ISO-A1
must fail there (today's gate reads the consumer's config). That failing run is the proof the test
can see the defect. If P-L1-1 or P-L1-2 selected the fallback, drop that arm and say why.

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

Plus: `npx vitest run packages/core/principles/33-adapter-jig-arm-registry.test.ts` green (E2 and
C4 not reversed), `bash scripts/run-local-ci-sweep.sh` green, merge through the lock (umbrella
§0.4), CI green on the new head SHA.

## §7 Falsifiers to write into the PR body

- D9 (spec §8): «any getff CI gate reads a consumer config after §4.0 ships, unless a §4.0 probe
  forces the recorded fallback, or the isolated cargo gate goes red on a consumer lint that is not
  a getff ban». ISO-C1, ISO-C2 and ISO-A1 are the checks.
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

Umbrella §9 format. `DECISIONS` must name the P-L1-1 and P-L1-2 branches taken.

## §11 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps: T2, T3, T7, T14, T15, T19, T20, T21.**

- **T2 / T3** — each probe result is a command plus its raw output, never «clippy docs say».
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
  `CLIPPY_CONF_DIR` must be absolute. A gate that loads zero rules is green on everything, so
  every arm asserts that at least one getff rule **fired**, not merely that the command exited.
