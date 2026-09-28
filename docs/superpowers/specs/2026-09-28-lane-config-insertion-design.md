# Toolchain lanes: getff's bans inserted into the consumer's own lint config (Q4.7 follow-up)

> **Authoritative for:** which consumer-owned lint config formats on the python / cargo / go lanes
> get getff's bans by insertion, the shapes each insertion is allowed on, the proof bar, the
> idempotence / provenance marker, and the CI-path prerequisite (§4.0).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the NOT-wired summary mechanism — `setup.d/lib.sh` `note_not_wired`; the ESLint insertion —
> PR #1868 (`packages/core/install/wire-eslint-r2.ts`).

Status: DRAFT r4 (round-1 and round-2 findings absorbed; D12 decided — see §8) · Date: 2026-09-28 · Base: staging
`b3a1981` + open PR #1890 (head `8c82c1a1e7b`). Line citations into `setup.d/99-finalize.sh` are to
the #1890 branch.

## 1. Context

Operator directive Q4.7 (2026-09-28): the install never hands the person running it a manual step;
what it cannot do is a NOT-wired fact line. PR #1868 applied the positive half to ESLint — getff's
block is inserted into the consumer's own `eslint.config.mjs`, the original kept at
`.ai-factory/before-getff/<path>.<sha8>` (`setup.d/lib.sh` `keep_original_snapshot` /
`keep_original_settle`), a failed probe rolls the write back, and anything that cannot be added is
a NOT-wired line.

On the toolchain lanes only the negative half exists. PR #1890 turns every REFUSE cell into a
NOT-wired line. The one existing insertion is `_py_sgconfig_merge` (`setup.d/45-python.sh:208`),
which adds `.getff/astgrep-rules` to a block-list `ruleDirs:`.

Two facts the round-1 review established shape the whole design:

- **CI is not uniformly isolated today.** The python ruff gate reads getff's
  `.getff/ruff-bans.toml` and the go gate reads `getff-golangci.yml` in the collision cell, but
  the cargo gate runs a bare `cargo clippy -- -D clippy::disallowed_methods`
  (`packages/core/templates/cargo/github-actions-ci.yml:48`) and so reads the **consumer's**
  `clippy.toml`, and the ast-grep gate runs a bare `ast-grep scan`
  (`packages/core/templates/python/github-actions-ci.yml:48-49`) and so reads the **consumer's**
  `sgconfig.yml`. In a collision cell those two getff gates enforce nothing.
- **Shape recognition alone cannot prove safety.** A syntactically clean insertion can still
  change the consumer's lint behaviour: a ruff child table shadows the parent's in an `extend`
  chain, an `ignore` entry can defeat `extend-select`, a member crate's own `clippy.toml` shadows
  the root one (and a nested ruff config shadows the root one for its subtree the same way),
  forbidigo can be enabled by `presets`. Only the tool itself sees the effective configuration.

## 2. Operator-premise register

| # | Premise (faithful to meaning) | Source |
|---|---|---|
| P1 | The install never hands the user a manual step; what it cannot do is a NOT-wired fact line with its reason. | Q4.7, 2026-09-28 |
| P2 | Never edit the consumer's `tsconfig.json`. | Q4.7 floor |
| P3 | Never overwrite a consumer-owned file: add by insertions only and keep the original, as #1868 did for ESLint. | Q4.7 floor |
| P4 | Design first through `/arch`; no code before an approved spec. | this session's task |
| P5 | `pyproject.toml` `[tool.ruff.*]` may receive insertions; `Cargo.toml` may not. | this session, fork D3 answered |
| P6 | `--refresh` may remove what getff itself inserted when a getff tag names it and the template dropped it; consumer bytes are never removed. | this session, fork D10 answered |
| P7 | The install may *run* a pinned lint tool one-shot to prove an insertion; it never *installs* one (nothing added to PATH, to the toolchain, or to the consumer's dependencies). | D12, decided by the design session on existing precedent (`45-python.sh:557` `uvx ruff@<pin>`) + companion-install-principle.md §1; open to operator override at spec review |

## 3. Invariants every insertion obeys

- **I1 — insertions only.** The writer adds whole lines or inserts bytes into an existing array /
  sequence. It never deletes, reorders or rewrites a consumer byte. New array elements go
  **first**, directly after the opening `[` (TOML and YAML flow) or as the first item (YAML
  block), each with a trailing comma where the syntax needs one — so a consumer's last element
  without a trailing comma is never touched. A consumer value for the same key is kept and named
  in the log (the `insertOnly` rule of #1868, `wireNRules`, `wire-eslint-r2.ts:627-632`).
- **I2 — recognised shapes only.** A shape recogniser runs first; any shape it does not accept is
  a NOT-wired line and the file stays byte-identical. The recogniser resolves every equivalent
  spelling of a target key (bare, quoted, dotted, `[[array-of-tables]]`, inline table, header
  whitespace) and accepts only the canonical ones listed in §4; a non-canonical spelling of a
  target is NOT-wired, never a second definition. A line where `#` occurs inside a string is not
  comment-stripped by position; the recogniser NOT-wires a target line it cannot tokenise.
- **I3 — original kept, file identity kept.** Every write is wrapped in `keep_original_snapshot` /
  `keep_original_settle`. The new content is written **through** the existing path
  (`cat tmp > dst`), never `mv tmp dst`, so a symlinked config stays a symlink and keeps its mode.
  If the original cannot be kept, the write is undone and the file is NOT-wired.
- **I4 — tool proof required** (decision D2, revised in round 1). An insertion stands only if a
  *differential probe* (§5) run with the lane's tool shows that the results after the edit equal
  the results before plus exactly the payload's results: every before-result is still present and
  unchanged (the consumer's own rules included), and every new result is getff-attributable and in
  the payload. Tool unavailable (per D12), tool unable to read the consumer's config before the
  edit, or any other delta → restore the original and write a NOT-wired line naming the reason.
  Shape recognition authorises the attempt; only the tool authorises the result.
- **I5 — CI verdict independent of the insertion** (decision D9, extended by §4.0). Every getff CI
  gate enforces getff's bans from a getff-owned config, so the CI verdict never depends on whether
  an insertion happened or survived. The insertion closes the *local* gap only. The getff-owned CI
  configs (`.getff/ruff-bans.toml`, `getff-golangci.yml`, §4.0's cargo and ast-grep configs) are
  delivered in **every** cell where the consumer owns the tool's config, whether or not the
  insertion succeeded.
- **I6 — payload derived from the template, normalised per schema.** Inserted values are read
  from getff's own template (a file getff authored, in a shape getff controls) and translated to
  the target schema where the schemas differ (golangci v1 `p:` → v2 `pattern:`, §4.6).

## 4. Per-format decisions

### 4.0 Prerequisite — isolate the two CI gates that read the consumer's config

- **cargo:** the getff clippy gate reads getff's bans from a getff-owned directory
  (`.getff/clippy/clippy.toml`) through an **absolute** `CLIPPY_CONF_DIR`
  (`$GITHUB_WORKSPACE/.getff/clippy`) — the directory always holds the file, because a missing
  directory is a clippy error and a directory without the file makes clippy walk upward and load
  the consumer's `clippy.toml` again. Setting `CLIPPY_CONF_DIR` replaces the consumer's whole
  clippy config for that run (DeepWiki `rust-clippy` `lookup_conf_file`, round 2), so the gate
  must also not fire on the consumer's own lints: it runs with every clippy lint group allowed and
  only `disallowed_methods` / `_types` / `_macros` denied (`-A clippy::all -A clippy::pedantic -A
  clippy::nursery -A clippy::restriction -A clippy::cargo -D clippy::disallowed_…`). Whether
  those trailing command-line levels override `Cargo.toml [lints]` and `[workspace.lints]` is a
  plan prerequisite probe; if they do not, the fallback is to keep the gate on the consumer's
  config and let §4.3's insertion be what it enforces, with the NOT-wired wording of §4.4 saying
  so. Delivery contract: `.getff/clippy/clippy.toml` is framework-owned (`refresh_safe`, getff
  header), delivered in every consumer-owned cell, covered by `refresh-covers-full-delivery`; the
  rules-lock `sourceFingerprint` and adapter-jig E2 resolve **this** file — `_lane_delivered_config_path`
  learns it — so lock, self-check and CI attest the same ban set. `getff-clippy.toml` is retired
  into it (C4 no-orphan-residue check). Precedent: the python lane's `.getff/ruff-bans.toml`
  (`setup.d/45-python.sh:386-395`).
- **ast-grep:** the getff ast-grep gate runs `ast-grep scan -c .getff/sgconfig.yml` over the
  project, with a getff-owned `.getff/sgconfig.yml` (framework-owned, same delivery contract as
  above). DeepWiki (`ast-grep/ast-grep`, round 2) says `ruleDirs` resolve relative to the config
  file and the scan defaults to the working directory; confirming that on the pinned
  `@ast-grep/cli@0.44.1` is a plan prerequisite probe. If it does not, the ast-grep gate stays on the consumer's
  `sgconfig.yml` and I5 carries a recorded exception for it: then §4.2's insertion is what CI
  depends on, and a refused or deleted entry is a NOT-wired line saying the getff ast-grep gate
  runs the consumer's rules only.

- **go:** unchanged — the gate already keys on `getff-golangci.yml`. Its `else` branch, which
  exits 0 when that file is absent, learns D11's lookup names so a `.golangci.yaml` consumer does
  not pass green while enforcing nothing.

This fixes a present defect independently of any insertion; it ships first (§11). Behaviour change
to announce: after `--refresh`, a collision-cell consumer's getff cargo / ast-grep gate starts
enforcing getff's bans and can turn red on code it always should have flagged; the refresh prints
that as a fact line.

### 4.1 ruff — `.ruff.toml` / `ruff.toml` / `pyproject.toml [tool.ruff]`

**Insertion: YES.** Payload from `packages/core/templates/python/ruff.toml`: the rule codes of
`[lint] select`, `banned-module-level-imports`, and the `banned-api` map. The insertion always uses
`extend-select`, which adds to the consumer's `select` (ruff docs; DeepWiki `astral-sh/ruff`,
2026-09-28).

Targets: **every** ruff config in the project that ruff would load for some Python file — ruff
uses the closest config (DeepWiki `astral-sh/ruff`, round 2), so a sub-package's own `ruff.toml`
or `[tool.ruff]` shadows the root one for its subtree, exactly like clippy (§4.3). Per directory,
the file ruff loads in its own precedence order (plan prerequisite probe: the order among
`.ruff.toml`, `ruff.toml`, `pyproject.toml`); each target is processed on its own and gets its own
NOT-wired line when it cannot be wired. A ruff `--config` passed by the consumer's own tooling
(e.g. `.pre-commit-config.yaml` args) is detected and makes that path NOT-wired (the config
loaded there is not the file getff edits). Prefix `P` = `` (ruff.toml family) or `tool.ruff.`
(pyproject).

| Shape | Action |
|---|---|
| `[Plint]` header present once; no `extend-select` in it | insert `extend-select = [<codes>]  # getff` directly after the header |
| `[Plint]` has `extend-select` (single- or multi-line array) | insert missing codes first in the array (I1); tag per §6 |
| no `[Plint]` table, and no other spelling of it (I2) | append a `[Plint]` table at EOF |
| `[Plint.flake8-tidy-imports]` present | insert / extend `banned-module-level-imports` as above |
| `[Plint.flake8-tidy-imports.banned-api]` present | insert each missing key after the header; a key the consumer already defines is kept (I1) |
| either tidy-imports table absent, no other spelling of it | append the table at EOF — **unless** the config has `extend` and any file in its local `extend` chain defines that table or key: then NOT-wired, because the child table would replace the inherited one (DeepWiki `astral-sh/ruff`, round 1) |
| a getff code, or any prefix of it (`TID`, `TID2`, `DTZ`, `ALL` …), listed in `ignore` / `extend-ignore` of the target or of any file in its local `extend` chain | that code is **NOT-wired**: the consumer switched it off; it is not inserted |
| top-level `select` / `extend-select` (legacy form), dotted `lint.*` keys, inline tables for the targets | **NOT-wired** |

`per-file-ignores` entries are the consumer's per-path decision and are left alone; the ban still
applies to every other path. The differential probe is the backstop for any switch-off the row
above misses (the code does not appear in the effective enabled set → rollback).

Proof (§5): `ruff check --show-settings <path>` before and after, for a path inside the target's
directory so ruff resolves that target (whether the path must exist is a plan probe; if it must,
the probe file is created and removed within the install run). The ruff used is chosen per D12;
if that ruff cannot read the consumer's config before the edit, the cell is NOT-wired with ruff's
message.

### 4.2 ast-grep — `sgconfig.yml`

**Insertion: YES, widened.** Items whose value is a getff-namespaced path (`.getff/astgrep-rules`)
carry their provenance in the value itself — no comment tag, so existing merged files and the
snapshot fingerprints do not change.

| Shape | Action |
|---|---|
| S1 block-list `ruleDirs:` (existing) | insert `- .getff/astgrep-rules` as first item |
| S2 single-line flow list `ruleDirs: [a, b]` | insert `.getff/astgrep-rules, ` as first element |
| multi-document (`---`), anchors / aliases on `ruleDirs`, flow list over several lines, more than one `ruleDirs:` | **NOT-wired** |

Whether a file with no `ruleDirs:` key is valid ast-grep config is a plan prerequisite probe. If
valid, it becomes shape S3 (append a block list at EOF); if not, NOT-wired with that reason.

Proof: `ast-grep scan -c <consumer sgconfig> --json` on the probe file, before and after; the
after-set of rule ids equals the before-set plus getff's rule ids.

### 4.3 clippy — every `clippy.toml` / `.clippy.toml` clippy would load

**Insertion: YES.** Clippy looks for its config upward from each crate, so a member crate with its
own `clippy.toml` shadows the root one for that crate (DeepWiki `rust-lang/rust-clippy`
`lookup_conf_file`, round 1). The targets are therefore **every** clippy config in the workspace
(excluding `target/`); each is processed on its own and gets its own NOT-wired line when it cannot
be wired. A directory holding both `clippy.toml` and `.clippy.toml` is NOT-wired, and so is a
workspace whose `.cargo/config.toml` sets `CLIPPY_CONF_DIR` in `[env]` (clippy loads that
directory, not the file walk getff edits).

Payload: every `disallowed-*` key the template carries (today `disallowed-methods`; the same rows
apply to `disallowed-types` / `disallowed-macros` when the template grows them).

| Shape | Action |
|---|---|
| no target key in any spelling | insert the array block before the first table header (or at EOF when there is none), lines tagged `# getff` |
| target key as an inline array (single- or multi-line) | insert missing entries first (I1); tag per §6 |
| an entry with the same `path` already present (any `reason`) | keep the consumer's (I1) |
| `[[disallowed-methods]]` array-of-tables, quoted key, key under a table | **NOT-wired** (I2) |

`disallowed-methods` defaults to empty and clippy errors on an unknown or invalid key (DeepWiki
`rust-lang/rust-clippy`, 2026-09-28).

Proof: `cargo clippy` with an absolute `CLIPPY_CONF_DIR=<that config's dir>` on a getff probe
crate outside the project, before and after, each run with its own fresh `--target-dir` so the
second run cannot reuse cached results; the `disallowed_*` hits (matched by lint code, the
technique the cargo self-check already uses) gain exactly getff's paths and nothing else changes.

### 4.4 `Cargo.toml [lints.clippy]` — NOT inserted (decision D3)

`disallowed_methods` is `warn` by default (style group), so after §4.3 a local `cargo clippy`
reports the ban; `[lints.clippy] disallowed_methods = "deny"` would only lift it to a build error.
`Cargo.toml` is the build manifest, and a member crate with `lints.workspace = true` cannot take
other `[lints]` keys. The NOT-wired line states what holds, from two facts the lane already has:
whether §4.0's isolated gate is in place (else whether §4.3 wired the consumer's config) and
whether the getff CI workflow is getff's own (the existing `_ci` branch,
`setup.d/46-cargo.sh:133-136` on #1890, kept): *the ban is a warning on a local build and an error
in getff's CI; getff does not edit `Cargo.toml`* — or, when either fact fails, the narrower true
sentence.

### 4.5 cargo-deny — `deny.toml` — nothing to insert (decision D6)

getff's `deny.toml` starter is `[bans] multiple-versions = "warn"` with empty `[advisories]` and
`[licenses]`. `multiple-versions` defaults to `warn` when absent (DeepWiki
`EmbarkStudios/cargo-deny`, 2026-09-28). The consumer's file already behaves as the starter, so the
NOT-wired line #1890 writes reports a gap that does not exist. It becomes a log fact:
*deny.toml — getff's starter matches cargo-deny's defaults, nothing to add*.

Guard (mechanism, not attention): a test asserts the template holds no key beyond cargo-deny's
defaults. When the template grows a real ban, the test turns red and forces an insertion design
for `deny.toml` in the same PR.

### 4.6 golangci-lint — the config golangci-lint loads

Target: the file golangci-lint loads in the project root, in its own lookup order among
`.golangci.yml`, `.golangci.yaml`, `.golangci.toml`, `.golangci.json` (plan prerequisite probe).
YAML targets are handled here; `.toml` / `.json` are NOT-wired. (Round-1 E1: the go lane today
detects only `.golangci.yml` and would copy its file beside a consumer's `.golangci.yaml`; the same
lookup list fixes the fresh-cell detection.)

**Schema.** v2 when the top-level `version` key parses to 2 (`2`, `"2"`, `'2'`), else v1. v2 paths
are `linters.enable` / `linters.settings.forbidigo.forbid` and the pattern key is `pattern`; v1
paths are `linters.enable` / `linters-settings.forbidigo.forbid` and the key is `p` (template
comment, `packages/core/templates/go/.golangci.yml:16-22`). The payload is translated (I6). A
v2-only top-level key (`formatters`) is never a target. getff's `disable-all` /
`exclude-use-default` flags are never inserted.

| Shape | Action |
|---|---|
| `linters.enable` block list without `forbidigo` | insert `- forbidigo  # getff` as first item |
| forbidigo already enabled (any route) | nothing to enable |
| `forbidigo` listed under `linters.disable` | **NOT-wired** — the consumer switched it off |
| `linters:` block mapping without `enable:` | insert an `enable:` block list under it |
| no `linters:` key | append the block at EOF |
| explicit `forbid` block list | insert missing patterns first, tagged `# getff` |
| no `forbid` list | insert `forbid:` with ours, **plus** forbidigo's default pattern `^(fmt\.Print(\|f\|ln)\|print\|println)$` when the before-probe shows the default was active (decision D4) |
| flow style on any target, anchors / aliases, multi-document | **NOT-wired** |

Why D4: an explicit `forbid` list replaces forbidigo's defaults entirely (DeepWiki
`ashanbrown/forbidigo`, 2026-09-28). forbidigo can be enabled by `linters.enable`, `enable-all`,
v2 `default: all`, v1 `presets` — so «was the default active?» is answered by the before-probe,
not by reading one key. The probe runs the consumer's config **exactly as the consumer's own run
would**: no linter-selection flags at all (no `-E`, no `--disable-all` / `--default`, which would
force forbidigo on and answer the question by construction — round 2; the flags also differ
between v1 and v2), with machine-readable output filtered to issues whose linter is `forbidigo`.
The probe module contains `fmt.Println`; the default pattern is inserted exactly when the
before-run reports forbidigo on it. When forbidigo was not active before, the insertion enables it
with getff's pattern only, so the consumer's `fmt.Println` stays unflagged. A `-E forbidigo` used
only on a command line the install cannot see is the recorded blind spot (§12); the
`kept-default` tag (§6) keeps a preserved default from being refreshed away.

Proof: that same unflagged run, before and after, on a getff probe module holding `os.Getenv`
and `fmt.Println`. After must add forbidigo's `os.Getenv` issue, keep every before-issue
(forbidigo's `fmt.Println` included, iff it was there), and add nothing else. A config the local
binary cannot read (e.g. a v2 file under a v1 binary) is NOT-wired with the binary's message. How
the probe module is placed so that relative paths in the consumer's config still resolve is a
plan design item (round-1 F3).

### 4.7 Consumer CI workflows — NOT-wired stays (decision D7)

The lanes ship `.github/workflows/getff-<lane>.yml`, a getff-named sibling that never edits the
consumer's `ci.yml`. The only NOT-wired cell is a non-getff file already at that name. Unchanged
from #1890.

## 5. The shared writer and the differential probe

- **Writer.** One sourced helper file for the TOML and YAML shape recognisers and inserters, used
  by the three lanes (lane files keep the payload and the cell logic, as their
  `@cc-only-rationale` headers require). Pure bash-3.2 read-loops, the `_py_sgconfig_merge`
  technique; no parser dependency. Technique per `prior-art-evaluations.md#132` (toml_edit):
  touch the target node only, keep every other byte, and make byte-preservation a tested
  invariant.
- **Probe.** New, per lane, and **separate from the lane firing self-checks**. The self-checks
  stay pinned to getff's delivered config — adapter-jig arm E2 `self-check-resolves-delivered-config`
  (`packages/core/principles/33-adapter-jig-arm-registry.ts:82`, `:486-494`) is a registered
  invariant and is not reversed. The probe runs the tool twice against the consumer's config
  (before, after) on a getff probe input and applies I4's rule: before-results (the consumer's own
  rules firing on the probe input included) must reappear unchanged, and the new results must be
  exactly the payload's getff-attributable ones (rule ids / lint codes / patterns getff ships). A
  consumer rule firing on the probe input is therefore neither a false delta nor ignored.
- **Tool availability** (D12, P7) — one rule on all three lanes, in this order:
  1. the consumer's own tool on PATH (`ruff`, `ast-grep`/`sg`, `golangci-lint`, `cargo clippy`);
  2. else a one-shot run of the version pinned in the getff CI template, through the ecosystem's
     own runner, which writes only to that runner's cache: `uvx ruff@<pin>`,
     `uvx --from ast-grep-cli@<pin> ast-grep` (runner form is a plan probe),
     `go run github.com/golangci/golangci-lint/cmd/golangci-lint@<pin>` (the CI pin, v1.55.2);
  3. else `not-proven <tool> unavailable (<why>)` — offline, runner absent, or the pinned tool
     fails to build against the consumer's toolchain.
  clippy has no step 2: `rustup component add clippy` changes the consumer's toolchain, which is
  an install. The pin and the CI template's pin are one value (ci-tool-pinning.md Rule A), held
  in one place the plan names.
- **Result contract.** Each call returns `added <n>` · `already-present` ·
  `not-recognised <why>` · `not-proven <why>` · `rolled-back <why>`. `added` →
  `note_getff_added <rel>`; `already-present` → a log line; the rest → `note_not_wired` with the
  reason, never a step.
- **Summary on the lane path.** The lanes end before `99-finalize.sh`, whose added-to block
  (`:652-660`) is the only printer of `GETFF_ADDED_TO` (round-1 F4). The lane path prints the same
  block — which consumer files got getff's lines and where each original is kept — through one
  shared printer, next to its `print_not_wired` call.

## 6. Idempotence and provenance marker (decision D5)

- **Idempotence = content.** Before inserting, the writer looks for each payload item by value
  (a rule code, a banned module, a `path`, a pattern, `.getff/astgrep-rules`), string-aware per
  I2. Present → skipped, whoever put it there. A re-run over an inserted file is byte-identical.
- **Provenance = a trailing comment**, except where the value is itself a getff path (§4.2).
  - A line getff wrote whole ends with `# getff`.
  - Elements getff inserted into a consumer's single-line array are named on that line:
    `# getff: +"TID251","TID253"` (after an existing comment as `; getff: +…`).
  - The forbidigo default preserved under D4 is tagged `# getff: kept-default`.
- **`--refresh`** inserts items the current template adds and removes items the template dropped
  **only where a tag names them as getff's** (decision D10): a whole `# getff` line is removed; in a
  single-line array only the elements the `# getff: +…` tag lists are removed, together with the
  tag — no consumer byte is touched. A `kept-default` item is never removed by refresh. An item
  whose tag the consumer deleted, or a formatter stripped, is the consumer's (the safe direction).
- **Original.** `.ai-factory/before-getff/<path>.<sha8>`, kept only when a write changed the file.

## 7. What stays a NOT-wired line

- every shape §4 marks NOT-wired, with the recogniser's reason;
- `not-proven` (tool unavailable under D12, tool cannot read the config before the edit) and `rolled-back`
  (differential delta beyond the payload), with the tool's message;
- a getff code the consumer lists in `ignore` (§4.1), `forbidigo` under `disable` (§4.6);
- `Cargo.toml [lints.clippy]` (§4.4);
- a squatted `getff-<lane>.yml` (§4.7);
- an original that could not be kept (I3).

## 8. Live decision register

| # | Decision | Status | Resolution | Falsifier |
|---|---|---|---|---|
| D1 | Writer engine | answered | bash shape recogniser + inserter, no parser dependency (SSOT #216 BUILD; #117 rejects yq as silent default; lanes are Node-free) | >1/3 of a sample of ≥20 real public repos' configs fall outside the recognised shapes → re-weigh a format-preserving library via `uvx` |
| D2 | Proof bar | answered (revised r2, r4) | I4: differential tool probe required; before-results must reappear unchanged and new results equal the payload's; unavailable tool = `not-proven` NOT-wired | a proven insertion is later found to change a consumer's lint result on code outside getff's bans |
| D3 | Manifests | operator-fork → answered | `pyproject.toml [tool.ruff.*]` yes; `Cargo.toml` no | a warn-level local clippy result let a violation through that deny would have stopped before CI |
| D4 | forbidigo defaults | answered (revised r2, r4) | insert the default pattern exactly when the before-probe — the consumer's own run, no linter-selection flags — reports forbidigo on `fmt.Println`; tag `kept-default` | forbidigo changes `DefaultPatterns()` in the version the consumer runs → the inserted literal diverges |
| D5 | Marker | answered | content idempotence + `# getff` / `# getff: +…` / `kept-default` tags + before-getff original; getff paths self-attesting | a refresh removes a consumer-owned item |
| D6 | deny.toml | answered | nothing to insert; the NOT-wired line becomes a fact; template guard test | cargo-deny changes the `multiple-versions` default, or the template gains a non-default key |
| D7 | Squatted CI name | answered | stays NOT-wired | — (no alternative name is ever written) |
| D8 | sgconfig widening | answered | add S2 single-line flow list; S3 only if the no-`ruleDirs` probe shows it is valid config | ast-grep rejects a file the S2 inserter produced |
| D9 | CI path | answered (extended r2, r4) | every getff CI gate enforces getff's bans from a getff-owned config delivered in every consumer-owned cell (§4.0); insertion is local-only; cargo gate isolated with all clippy groups allowed | any getff CI gate reads a consumer config after §4.0 ships (unless a §4.0 probe forces the recorded fallback), or the isolated cargo gate goes red on a consumer lint that is not a getff ban |
| D10 | Refresh removal of getff-tagged items | operator-fork → answered | remove only what a getff tag names; consumer bytes never (same property adapter-jig C4 gives the ast-grep scan dir) | a refresh removes an element no tag named, or leaves a tagged element the template dropped |
| D11 | Config lookup names | answered (r2, r4) | target every config the tool loads (nested ruff / clippy configs included), per its own lookup order (probe-derived); also fixes the go/cargo fresh-cell detection and the go CI `else` branch | a consumer file the tool loads is missed and getff's copy lands beside it |
| D12 | May the install obtain a lint tool to run the proof? | decided (design session; operator may override at spec review) | run, never install: consumer's tool first, else a one-shot pinned run through the ecosystem runner (`uvx`, `go run`), else `not-proven`; never `rustup component add` / `go install` / `pip install` (P7, §5) | a one-shot run leaves anything outside the runner's cache (PATH entry, toolchain component, lockfile change), or a proof result differs between the pinned run and the CI gate's pinned tool |

## 9. Testing seams

One seam per lane, all existing: the lane delivery suites (`tests/install-sh/python-delivery.test.sh`,
`cargo-entry-lane.test.sh`, `go-entry-lane.test.sh`, `python-entry-lane.test.sh` — the E2 negative
that must stay green), plus arms Y / C / J of `tests/install-sh/install-no-manual-step.test.sh`
(#1890). Additions are table-driven fixtures: each §4 shape row → a consumer input file and its
golden output; each NOT-wired row → the file is byte-identical afterwards and exactly one NOT-wired
line carries the reason. Cross-cutting arms: re-run byte-identity (D5), `--refresh` behaviour per
D10, rollback on an injected probe delta (I4), `not-proven` with the tool removed from PATH,
unkeepable original (I3), symlinked config stays a symlink (I3), the deny.toml template guard (D6),
the §4.0 CI isolation (a consumer config without getff's bans: the getff gate still fires; a
consumer lint set to deny in `Cargo.toml` with a clippy.toml threshold: the isolated cargo gate
stays green on code with no getff ban), and nested ruff / clippy configs each wired or NOT-wired on
their own. §4.0 moves the cargo and python delivered-file sets, so the plan regenerates the lane
snapshot baselines and `refresh-baseline.json`, and extends `refresh-covers-full-delivery` to the
new getff-owned configs.

Tool availability (round-1 F6): the lane suites run in install-sh shards that have no clippy or
golangci-lint today (`.github/workflows/audit-self.yml`, the tools exist only in the
`principles-meta-tests` job). The plan either installs the pinned tools in the shard running the
probe arms or moves those arms to the job that has them; a probe arm whose tool is missing in CI
**fails**, it does not skip.

## 10. Prior art

- PR #1868 — insertion-only write into a consumer config, original at `.ai-factory/before-getff/`,
  rollback on a failed probe, NOT-wired on anything unrecognised. This spec is that design applied
  to TOML / YAML, with a differential probe in place of the ESLint load probe.
- PR #1890 — the NOT-wired cells this spec narrows.
- `prior-art-evaluations.md#216` — BUILD the thin bash writer for augment-first lane delivery.
- `prior-art-evaluations.md#117` — yq comment preservation is best-effort; not a silent default.
- `prior-art-evaluations.md#132` — toml_edit technique (target node only, byte preservation tested).

## 11. Sequencing

1. #1890 merges (it rewrites every cell this spec touches).
2. §4.0 CI isolation — fixes a present defect, independent of insertion; lands first.
3. D11 lookup names + fresh-cell detection.
4. Writer + probe + per-format insertion (§4.1–§4.3, §4.6), one PR per lane.

Plan prerequisite probes (T3 INCONCLUSIVE until run; DeepWiki answers noted where round 2 found
them): ruff config precedence in one directory, and whether `--show-settings` needs an existing
path (§4.1); ast-grep `scan -c .getff/sgconfig.yml` resolving `ruleDirs` relative to the config
(DeepWiki: yes) and the no-`ruleDirs` case (DeepWiki: valid — which would also correct the reason
text at `setup.d/45-python.sh:358-359`) on the pinned 0.44.1 (§4.0, §4.2); whether trailing
`-A clippy::<group>` flags override `Cargo.toml [lints]` / `[workspace.lints]` and source-level
`#![deny]` for the isolated cargo gate (§4.0); golangci-lint config lookup order, JSON output's
linter field, and v1.55.2 behaviour on a v2 file (§4.6); ruff's resolution of `ignore` vs
`extend-select` at equal specificity (§4.1 — the design NOT-wires the overlap either way); the D12 ladder's one-shot runs — `go run …/golangci-lint@v1.55.2` building against a current Go (if it cannot, the go lane's step 2 is `not-proven` by construction and the pin bump becomes its own task), the `uvx` form for ast-grep 0.44.1, and that neither leaves anything outside the runner's cache (§5).

## 12. Known limits

- A `-E forbidigo` used only on a command line the install cannot see (§4.6).
- A formatter that strips trailing comments turns getff's items into consumer-owned ones (§6).
- The probe's ruff may differ from the version the consumer pins elsewhere; the probe uses the
  consumer's PATH ruff first.
- Source-level `#![deny(clippy::…)]` in the consumer's crates is not overridden by command-line
  levels; if the §4.0 probe shows it survives `-A`, the isolated cargo gate can still report such a
  consumer lint, and that is recorded here rather than papered over.

## 13. Changelog

### r2 — §2 cold review round 1 (top-down + bottom-up, both REVISE)

| Finding | Grade | Disposition |
|---|---|---|
| BU-F1 cargo CI reads the consumer's clippy.toml; I5 / §4.4 false | BLOCKER | ACCEPTED — §4.0 isolates the cargo gate; §4.4 wording made conditional on it; §11 orders it first |
| BU-F2 ast-grep CI reads the consumer's sgconfig.yml | MAJOR | ACCEPTED — §4.0, probe-gated, with a recorded I5 exception as fallback |
| BU-F3 self-checks are pinned to getff's config (adapter-jig E2) and exit-code based | MAJOR | ACCEPTED — §5 separate differential probe comparing getff-attributable results; E2 kept |
| BU-F4 `note_getff_added` never printed on the lane path | MAJOR | ACCEPTED — §5 shared added-to printer on the lane path |
| BU-F5 / TD-1 golangci v2 gets the v1 key `p:` | MAJOR | ACCEPTED — I6 schema normalisation; §4.6 version parse widened |
| BU-F6 tool proofs cannot run in the named CI shards | MAJOR | ACCEPTED — §9 tool placement; a missing tool fails the arm |
| TD-2 forbidigo enabled via presets / enable-all / CLI | MAJOR | ACCEPTED — D4 decided by the before-probe; CLI-only `-E` recorded in §12 |
| TD-3 first `--refresh` deletes the D4 default | MAJOR | ACCEPTED — `kept-default` tag, never removed |
| TD-4 ruff `extend` chain: child table replaces inherited one | MAJOR | ACCEPTED — §4.1 NOT-wired row; differential probe catches the rest |
| TD-5 ruff `ignore` on getff codes | MAJOR | ACCEPTED — §4.1 NOT-wired row for the overlap; blanket switch-off caught by the probe |
| TD-6 clippy upward lookup: member configs shadow the root | MAJOR | ACCEPTED — §4.3 targets every clippy config in the workspace |
| TD-7 equivalent TOML spellings; last element without trailing comma | MAJOR | ACCEPTED — I2 spelling resolution; I1 first-position insertion |
| D2 shape-only writes when the tool is absent (TD summary) | MAJOR | ACCEPTED — I4 now requires the tool |
| TD-MINOR symlink replaced by `mv` | MINOR | FIXED — I3 write-through |
| TD-MINOR `%%#*` strip truncates strings | MINOR | FIXED — I2 string-aware |
| TD-MINOR other golangci file names; `formatters.enable` | MINOR | FIXED — §4.6 lookup + D11 |
| TD-MINOR tags do not survive formatters | MINOR | ACCEPTED — recorded in §12 (safe direction) |
| TD-MINOR uvx ruff ≠ consumer's ruff | MINOR | FIXED — §4.1 prefers the consumer's ruff |
| BU-F7 `--profile` rationale without referent | MINOR | FIXED — dropped from I6 |
| BU-F8 `disallowed-types` / `-macros` omitted | MINOR | FIXED — §4.3 payload generalised |
| BU-F9 `.clippy.toml` named but never detected | MINOR | FIXED — §4.3 targets + D11 |
| BU-F10 sgconfig tag changes fingerprints; untagged legacy entries | MINOR | FIXED — getff paths self-attesting, no tag |
| BU-F11 `--show-settings` proof under-specified; version skew | MINOR | FIXED — §5 getff-attributable comparison; §4.1 unreadable-before = NOT-wired |
| BU-E1 lane detects only one config name per tool | ESCALATED | ACCEPTED — in scope as D11 (same lookup list the targets need) |
| TD-ESC refresh removal rewrites lines holding consumer bytes vs P3 | ESCALATED | ESCALATED → answered by the operator as D10 (remove tag-named getff items only); P6 added |

### r4 — §2 cold review round 2 (top-down + bottom-up, both REVISE; cap of 2 REVISE rounds reached)

| Finding | Grade | Disposition |
|---|---|---|
| TD2-1 / BU2-F1 D4 before-probe forces forbidigo on with `-E`; `--disable-all` gone in v2 | MAJOR | FIXED — §4.6 probe runs the consumer's own configuration with no linter-selection flags, filtered by linter |
| TD2-2 ruff closest-config shadowing; probe path location | MAJOR | FIXED — §4.1 targets every nested ruff config; probe path inside the target's directory |
| TD2-3 uneven «tool absent» handling across lanes | MAJOR | FIXED — D12 / P7: one availability ladder on all three lanes (§5) |
| TD2-4 / BU2-F3 third clippy config without a delivery contract; go gate `else` branch | MAJOR | FIXED — §4.0 delivery contract (absolute path, always-present file, lock/E2/refresh parity, `getff-clippy.toml` retired); go `else` branch learns D11 |
| BU2-F2 `CLIPPY_CONF_DIR` swaps the whole consumer config → false red in the getff gate | MAJOR | ACCEPTED — §4.0 isolated gate allows every clippy group and denies only `disallowed_*`; probe-gated with a recorded fallback; §12 limit for source-level `#![deny]` |
| TD2-MINOR-1 I4 «any extra delta» vs §5 «getff-attributable only» | MINOR | FIXED — one rule in I4, §5 points at it |
| TD2-MINOR-2 `ignore` prefix row ambiguous; `ignore` in the extend chain | MINOR | FIXED — §4.1 row |
| TD2-MINOR-3 clippy cache between probe runs | MINOR | FIXED — fresh `--target-dir` per run |
| TD2-MINOR-4 §4.0 turns existing consumers' CI red after refresh | MINOR | FIXED — announced as a fact line on refresh |
| TD2-MINOR-5 `CLIPPY_CONF_DIR` in `.cargo/config.toml`; ruff `--config` in pre-commit args | MINOR | FIXED — both NOT-wired paths |
| TD2-MINOR-6 / BU2-F5 stale base and head pins | MINOR | FIXED — header |
| BU2-F4 ast-grep no-`ruleDirs` likely valid | MINOR | ACCEPTED — §11 probe notes the DeepWiki answer and the reason text it would correct |
| BU2-F6 §4.4 wording needs the `_ci` condition | MINOR | FIXED — §4.4 |
| TD2-ESC may the install fetch / install a lint tool to prove an insertion | ESCALATED | DECIDED — D12: run pinned one-shot, never install; decided on the `uvx ruff@<pin>` precedent + companion-install-principle §1 after the question hook blocked an operator ask twice; flagged for operator override at spec review |
