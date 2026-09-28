# lane-config-insertion — L4: cargo lane inserts getff's clippy bans

<!-- bridge-profile: Z.AI GLM-5.3 SDK -->

> **Umbrella:** [kickoff.md](kickoff.md). Its §0 binding rules, §2 file-lock matrix, §4 stop
> conditions and §5 descope register bind this stage; every deviation is declared below.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Branch:**
> `feat/lane-insert-cargo`. **PR title:** `L4: cargo lane inserts getff's clippy bans`.
> **Channel:** one aif task, own worktree, one PR to `staging` (harvested from the host).
> **Rigor label (L0):** `build-and-verify` — edits consumer-owned `clippy.toml` files under a
> clippy-run proof; rewrites two cargo NOT-wired lines into true facts; adds a template guard.
> **Design SSOT:** [spec](../../../docs/superpowers/specs/2026-09-28-lane-config-insertion-design.md)
> §4.3, §4.4, §4.5, §7, §8 (D3, D6, D12), §9, §12.
> **Authoritative for:** the L4 contract. **NOT authoritative for:** project goal — see
> [README.md#why-this-exists](../../../README.md#why-this-exists); any design decision — the spec;
> the writer and the probe scaffolding — L3 owns them, and L4 only extends them.

**Measurement SHA:** `origin/staging` = `b3a19811be6` (2026-09-29); «#1890» = head `8c82c1a1e7b`.
#1890, L1 and L2 all rewrite `setup.d/46-cargo.sh`: **re-locate every anchor by content**.

**Deviations (declared):**

1. **`getff-deny.toml` stays.** D6 turns the deny.toml NOT-wired line (#1890 `46-cargo.sh:157`)
   into a log fact. The spec does not say whether the `getff-deny.toml` reference copy
   (`:154`) keeps shipping. L4 leaves it as it is and lists it under `## Parked questions`.
2. **No D12 step 2 for clippy** (spec §5): a missing `cargo clippy` is `not-proven`, never a
   `rustup component add`. The probe runs the consumer's `cargo clippy` only.

**Dependencies:** #1890, L1, L2, L3 merged (umbrella §3 gate L4). **Read L1's P-L1-1 result**
(`gh pr view <L1 PR> --repo artyhoo/getff --json body`, section `## Probe results`). It decides
which wording §2c uses and what the CI gate enforces:

| P-L1-1 branch | The getff CI gate enforces | §4.3 insertion is |
|---|---|---|
| «works» (isolated gate shipped) | getff's bans from `.getff/clippy/clippy.toml`, whatever the consumer's config says | the **local** gap only (I5) |
| fallback (gate on the consumer's config) | whatever the consumer's config holds | what CI enforces — a `not-proven` or NOT-wired cell means CI enforces **nothing** of getff's for that config. Umbrella §4 L4 stop: surface it in `ATTN`; do not paper over it. |

## §1 Deliverables

### 1a clippy insertion (spec §4.3)

- **Targets:** every clippy config in the workspace, `target/` excluded, per L2's lookup list
  (`clippy.toml`, `.clippy.toml`). Each is processed on its own and gets its own result line.
- **NOT-wired, before any write:** a directory holding both `clippy.toml` and `.clippy.toml`; a
  workspace whose `.cargo/config.toml` sets `CLIPPY_CONF_DIR` in `[env]` (clippy loads that
  directory, not the file walk getff edits). Every clippy config becomes NOT-wired with that
  reason.
- **Shapes:** exactly spec §4.3's table. It extends L3's TOML recogniser with the inline
  `disallowed-*` array (single- and multi-line), keeps the consumer's entry for the same `path`
  whatever its `reason` (I1), and marks `[[disallowed-methods]]`, a quoted key or a key under a
  table as `not-recognised`.
- **Payload** (I6): every `disallowed-*` key in `packages/core/templates/cargo/clippy.toml`
  (today `disallowed-methods` → `std::env::var`), read from the file at run time. The same rows
  apply to `disallowed-types` / `disallowed-macros` the day the template grows them. Add one
  writer-level fixture per key name so that day needs no code.
- **Proof:** `cargo clippy` with an absolute `CLIPPY_CONF_DIR=<that config's dir>` on a getff
  probe crate **outside the project** (a `mktemp -d` crate removed on every exit path), before and
  after, each with its own fresh `--target-dir`. Match hits by lint code — the technique of the
  cargo self-check, `grep -q '"clippy::disallowed_methods"'` (`46-cargo.sh:222` staging). The
  after-run gains exactly getff's paths, and nothing else changes. No `cargo clippy` →
  `not-proven clippy unavailable (<why>)`.
- The firing self-check (`_cargo_firing_self_check`, `:201`) stays pinned to getff's delivered
  config — adapter-jig E2 (`packages/core/principles/33-adapter-jig-arm-registry.ts:82`) is not
  reversed.
- The REFUSE cell's NOT-wired line (#1890 `46-cargo.sh:120`) becomes, per result: `added` →
  `note_getff_added`, or the reason from the result contract.

### 1b `Cargo.toml [lints.clippy]` — never inserted (spec §4.4, D3, P5)

`Cargo.toml` is never opened for writing. The NOT-wired line at #1890 `46-cargo.sh:133-136` is
reworded from two facts the lane already has:

1. the isolated gate is in place (P-L1-1 «works»), or else §1a wired the consumer's config;
2. the getff CI workflow is getff's own (`_lane_getff_ci_runs`, #1890 `setup.d/lib.sh:1588`, the
   `_ci` branch kept).

Both hold → «the ban is a warning on a local build and an error in getff's CI; getff does not
edit `Cargo.toml`». Either fails → the narrower true sentence, one per combination. Each
combination is a fixture row. The `.getff/Cargo.lints.toml` reference (`:131`) keeps shipping,
unchanged.

### 1c cargo-deny — nothing to insert (spec §4.5, D6)

- The NOT-wired line at #1890 `46-cargo.sh:157` becomes a log fact: «deny.toml — getff's starter
  matches cargo-deny's defaults, nothing to add». It is no longer counted in `NOT_WIRED`.
- **Guard:** new `tests/install-sh/deny-template-defaults-guard.test.sh`. It asserts that
  `packages/core/templates/cargo/deny.toml` holds no key beyond cargo-deny's defaults: today
  `[bans] multiple-versions = "warn"`, empty `[advisories]`, empty `[licenses]`. Paired negative:
  a temp copy with one added key (e.g. `deny = [{ name = "openssl" }]` under `[bans]`) must make
  the guard exit non-zero. When the template grows a real ban, the guard forces a `deny.toml`
  insertion design in that PR (D6 falsifier).

### 1d CI placement of clippy

The lane suites run in install-sh shards with no clippy (spec §9 round-1 F6). Follow the choice L1
made for its cargo arm (install the pinned rust `1.96.1` + clippy in that shard, or run the arm in
`principles-meta-tests`, `.github/workflows/audit-self.yml:338-344`). Do not invent a third place.
A clippy arm whose tool is missing **fails**.

### 1e Tests

- **`tests/install-sh/lane-config-insert-cargo.test.sh`** — table-driven from
  `tests/install-sh/fixtures/lane-config-insert/cargo/<row>/{input,golden}`: one fixture per §4.3
  table row; both-files-in-one-dir and `.cargo/config.toml [env] CLIPPY_CONF_DIR` → every config
  byte-identical and one NOT-wired line each; a member crate's own `clippy.toml` wired on its own;
  `cargo` without clippy on `PATH` → `not-proven` and a byte-identical file; the §1b sentence
  matrix; the §1c fact line. `Cargo.toml` is byte-identical in **every** row — assert it.
- Register it and the guard in `audit-self.yml` (principle 41).
- Update `tests/install-sh/cargo-entry-lane.test.sh` and arms Y / C / J of
  `tests/install-sh/install-no-manual-step.test.sh` wherever a cargo NOT-wired line becomes
  `added` or a fact. Each changed expectation cites the §4 row that changed it.

### 1f Delivery modes and allowlist

No new consumer-delivered file. Before-getff originals are backups. Keep Check 4 of
`tests/install-sh/refresh-covers-full-delivery.test.sh` green. **Allowlist:** umbrella §2 column
L4, the two new tests and their fixtures, regenerated baselines and MANIFEST, and the D26 pages.
Anything else → STOP. Recording a fired PARK is not a file write (see /pipeline §5 park-record
contract): it lands in the park payload + the PR's `## Parked questions`, and its correction lands
as a separate owner commit — so this allowlist deliberately names no park-record artefact.

## §2 Prior-art consult

L4 extends L3's capability to one more format. It adds no new mechanism. The commit trailer cites
the same row: `Prior-art: prior-art-evaluations.md#216 (BUILD — L3's lane writer extended to clippy.toml; no new capability class).`
Check `#132` for any clippy-specific TOML note before writing the inline-array inserter.

## §3 Regeneration and the docs-refresh gate

Umbrella §0.5 / §0.6. Expected drift: `tests/install-sh/baselines/cargo/*` and
`packages/getff/MANIFEST.sha256`. python / go / npm baselines must not drift.

## §4 RED-first

Commit the fixture table and golden outputs first. Run `lane-config-insert-cargo.test.sh` and the
guard against the pre-change lane and paste the output: every insertion row fails, the deny fact
row fails, the guard's paired negative passes (it is a guard, not a feature).

## §5 Exit gates

```bash host-verify
bash tests/install-sh/lane-config-insert-cargo.test.sh
bash tests/install-sh/deny-template-defaults-guard.test.sh
bash tests/install-sh/cargo-entry-lane.test.sh
bash tests/install-sh/lane-config-writer.test.sh
bash tests/install-sh/lane-ci-gate-isolation.test.sh
bash tests/install-sh/lane-config-lookup-names.test.sh
bash tests/install-sh/install-no-manual-step.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
scripts/build-getff-dist.sh --check
```

Plus `npx vitest run packages/core/principles/33-adapter-jig-arm-registry.test.ts`,
`bash scripts/run-local-ci-sweep.sh`, the merge lock, and CI green on the new head SHA.

## §6 Falsifiers to write into the PR body

D3 («a warn-level local clippy result let a violation through that deny would have stopped
before CI») and D6 («cargo-deny changes the `multiple-versions` default, or the template gains a
non-default key»), verbatim from spec §8, each with its catching arm. Plus: «a `Cargo.toml` byte
changed» → the every-row assertion of §1e.

## §7 Descopes owned here (umbrella §5)

`Cargo.toml` is never edited, and `[lints.clippy]` stays a NOT-wired line (§4.4, P5, D3).
`deny.toml` has nothing to insert (§4.5, D6). A directory with both clippy configs, and
`CLIPPY_CONF_DIR` in `.cargo/config.toml`, are NOT-wired. There is no `rustup component add`
(P7). Spec §12 limit four (source-level `#![deny]`) is L1's record — restate it in the PR body if
the §1b sentence depends on it.

## §8 Park contract

**aif agent — fork discipline (non-negotiable):** On ANY genuine fork or ambiguity (two defensible
implementations, an undecided design choice, a missing spec detail that changes behaviour) — **do
NOT pick.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external`
with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop that
task.** Proceed only on the unambiguous parts. Guessing a fork to "keep moving" is the failure
this whole loop exists to prevent. Deviation 1 is a pre-declared park.

## §9 Report

Umbrella §9 format. `DECISIONS` names the P-L1-1 branch read, and the §1b sentence per
combination.

## §10 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps: T3, T7, T14, T15, T19, T20, T21.**

- **T3** — «clippy loads `.clippy.toml`» and «`CLIPPY_CONF_DIR` replaces the walk» are cited from
  L2's and L1's probe output, not restated from memory.
- **T14** — a green `not-proven` row on a CI runner that simply lacks clippy is not coverage of the
  insertion rows. Check that the insertion rows actually ran (§1d).
- **T15 (mandatory)** — self-application: does this repo carry any `clippy.toml`? If it does, run
  the writer over a temp copy and report the result.
- **T21** — Backward-check class: «a cargo lane sentence that states what CI enforces». Sweep every
  `note_not_wired` and `_cargo_log` string in `46-cargo.sh` against the P-L1-1 branch actually
  shipped.
- **T-LCI-A (domain)** — shape recognition authorises the attempt; only the clippy run authorises
  the result (umbrella §8).
- **T-LCI-G (domain) — the cached second run.** Two `cargo clippy` runs sharing a target dir
  return the first run's diagnostics, so the after-run «equals» the before-run and every
  insertion rolls back — or, worse, a stale hit is read as proof. A fresh `--target-dir` per run
  is the whole point.
