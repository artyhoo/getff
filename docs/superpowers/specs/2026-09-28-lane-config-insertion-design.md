# Toolchain lanes: getff's bans inserted into the consumer's own lint config (Q4.7 follow-up)

> **Authoritative for:** which consumer-owned lint config formats on the python / cargo / go lanes
> get getff's bans by insertion, the shapes each insertion is allowed on, the proof bar, the
> idempotence / provenance marker, and the CI-path prerequisite (§4.0).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the NOT-wired summary mechanism — `setup.d/lib.sh` `note_not_wired`; the ESLint insertion —
> PR #1868 (`packages/core/install/wire-eslint-r2.ts`).

Status: DRAFT r3 (round-1 findings absorbed, D10 answered; §2 round 2 pending) · Date: 2026-09-28 · Base: staging
`47ff45bdaa1` + open PR #1890 (head `1a8f4e5949f`).

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
  the root one, forbidigo can be enabled by `presets`. Only the tool itself sees the effective
  configuration.

## 2. Operator-premise register

| # | Premise (faithful to meaning) | Source |
|---|---|---|
| P1 | The install never hands the user a manual step; what it cannot do is a NOT-wired fact line with its reason. | Q4.7, 2026-09-28 |
| P2 | Never edit the consumer's `tsconfig.json`. | Q4.7 floor |
| P3 | Never overwrite a consumer-owned file: add by insertions only and keep the original, as #1868 did for ESLint. | Q4.7 floor |
| P4 | Design first through `/arch`; no code before an approved spec. | this session's task |
| P5 | `pyproject.toml` `[tool.ruff.*]` may receive insertions; `Cargo.toml` may not. | this session, fork D3 answered |
| P6 | `--refresh` may remove what getff itself inserted when a getff tag names it and the template dropped it; consumer bytes are never removed. | this session, fork D10 answered |

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
  *differential probe* (§5) run with the lane's tool shows that the effective configuration after
  the edit equals the one before plus exactly the payload. Tool absent, tool unable to read the
  consumer's config before the edit, or any extra delta → restore the original and write a
  NOT-wired line naming the reason. Shape recognition authorises the attempt; only the tool
  authorises the result.
- **I5 — CI reads getff's own files** (decision D9, extended in round 1 by §4.0). Every getff CI
  gate reads a getff-owned config, so the CI verdict never depends on whether an insertion
  happened or survived. The insertion closes the *local* gap only.
- **I6 — payload derived from the template, normalised per schema.** Inserted values are read
  from getff's own template (a file getff authored, in a shape getff controls) and translated to
  the target schema where the schemas differ (golangci v1 `p:` → v2 `pattern:`, §4.6).

## 4. Per-format decisions

### 4.0 Prerequisite — isolate the two CI gates that read the consumer's config

- **cargo:** the getff clippy gate sets `CLIPPY_CONF_DIR` to a getff-owned directory
  (`.getff/clippy/`, holding getff's `clippy.toml`), so `-D clippy::disallowed_methods` fires on
  getff's bans in every cell. Today, in the collision cell, it fires on nothing getff shipped.
- **ast-grep:** the getff ast-grep gate runs `ast-grep scan -c <getff-owned sgconfig>` over the
  project. Whether `-c` with a config outside the project root still scans the root with rule dirs
  resolved relative to the config file is a plan prerequisite probe (T3 INCONCLUSIVE, pinned
  `@ast-grep/cli@0.44.1`). If it does not, the ast-grep gate stays on the consumer's
  `sgconfig.yml` and I5 carries a recorded exception for it: then §4.2's insertion is what CI
  depends on, and a refused or deleted entry is a NOT-wired line saying the getff ast-grep gate
  runs the consumer's rules only.

This fixes a present defect independently of any insertion; it ships first (§11).

### 4.1 ruff — `.ruff.toml` / `ruff.toml` / `pyproject.toml [tool.ruff]`

**Insertion: YES.** Payload from `packages/core/templates/python/ruff.toml`: the rule codes of
`[lint] select`, `banned-module-level-imports`, and the `banned-api` map. The insertion always uses
`extend-select`, which adds to the consumer's `select` (ruff docs; DeepWiki `astral-sh/ruff`,
2026-09-28).

Target file: the one ruff loads for the project root, in ruff's own precedence order (plan
prerequisite probe: the order among `.ruff.toml`, `ruff.toml`, `pyproject.toml` in one directory).
Prefix `P` = `` (ruff.toml family) or `tool.ruff.` (pyproject).

| Shape | Action |
|---|---|
| `[Plint]` header present once; no `extend-select` in it | insert `extend-select = [<codes>]  # getff` directly after the header |
| `[Plint]` has `extend-select` (single- or multi-line array) | insert missing codes first in the array (I1); tag per §6 |
| no `[Plint]` table, and no other spelling of it (I2) | append a `[Plint]` table at EOF |
| `[Plint.flake8-tidy-imports]` present | insert / extend `banned-module-level-imports` as above |
| `[Plint.flake8-tidy-imports.banned-api]` present | insert each missing key after the header; a key the consumer already defines is kept (I1) |
| either tidy-imports table absent, no other spelling of it | append the table at EOF — **unless** the config has `extend` and any file in its local `extend` chain defines that table or key: then NOT-wired, because the child table would replace the inherited one (DeepWiki `astral-sh/ruff`, round 1) |
| a getff code, or a prefix of it (`TID`, `DTZ`, `ALL` excluded — see below), listed in the consumer's `ignore` / `extend-ignore` | that code is **NOT-wired**: the consumer switched it off; it is not inserted |
| top-level `select` / `extend-select` (legacy form), dotted `lint.*` keys, inline tables for the targets | **NOT-wired** |

`per-file-ignores` entries are the consumer's per-path decision and are left alone; the ban still
applies to every other path. An `ignore = ["ALL"]`-style blanket switch-off is caught by the
differential probe (the code does not appear in the effective enabled set) and rolls back.

Proof (§5): `ruff check --show-settings <probe.py>` before and after. The ruff used is the
consumer's own (PATH) when present, else the lane's pinned `uvx` fetch; if that ruff cannot read
the consumer's config before the edit, the cell is NOT-wired with ruff's message.

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
be wired. A directory holding both `clippy.toml` and `.clippy.toml` is NOT-wired.

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

Proof: `cargo clippy` with `CLIPPY_CONF_DIR=<that config's dir>` on a getff probe crate outside
the project, before and after; the `disallowed_methods` hits (matched by lint code, the technique
the cargo self-check already uses) gain exactly getff's paths.

### 4.4 `Cargo.toml [lints.clippy]` — NOT inserted (decision D3)

`disallowed_methods` is `warn` by default (style group), so after §4.3 a local `cargo clippy`
reports the ban; `[lints.clippy] disallowed_methods = "deny"` would only lift it to a build error.
After §4.0 the getff CI gate makes it an error in every cell. `Cargo.toml` is the build manifest,
and a member crate with `lints.workspace = true` cannot take other `[lints]` keys. The NOT-wired
line reads: *the ban is a warning on a local build and an error in getff's CI; getff does not edit
`Cargo.toml`* — true only once §4.0 has shipped, which §11 orders first.

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
v2 `default: all`, v1 `presets`, or a `-E forbidigo` flag in the consumer's own scripts — so the
«was the default active?» question is answered by the before-probe, not by reading one key: the
probe module contains a `fmt.Println` call, and the default pattern is inserted exactly when the
before-run flags it. A `-E forbidigo` used only on a command line the install cannot see is the
one recorded blind spot; the tag on the preserved default (§6) keeps it from being refreshed away.

Proof: `golangci-lint run` with the consumer's config, `--disable-all -E forbidigo`, on a getff
probe module holding `os.Getenv` and `fmt.Println`, before and after. After must flag `os.Getenv`,
and flag `fmt.Println` iff before did. A config the local binary cannot read (e.g. a v2 file under
a v1 binary) is NOT-wired with the binary's message. How the probe module is placed so that
relative paths in the consumer's config still resolve is a plan design item (round-1 F3).

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
  (before, after) on a getff probe input and compares **getff-attributable** results only (rule
  ids / lint codes / patterns getff ships), so the consumer's own rules firing on the probe input
  is not a false delta.
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
- `not-proven` (tool absent, tool cannot read the config before the edit) and `rolled-back`
  (differential delta beyond the payload), with the tool's message;
- a getff code the consumer lists in `ignore` (§4.1), `forbidigo` under `disable` (§4.6);
- `Cargo.toml [lints.clippy]` (§4.4);
- a squatted `getff-<lane>.yml` (§4.7);
- an original that could not be kept (I3).

## 8. Live decision register

| # | Decision | Status | Resolution | Falsifier |
|---|---|---|---|---|
| D1 | Writer engine | answered | bash shape recogniser + inserter, no parser dependency (SSOT #216 BUILD; #117 rejects yq as silent default; lanes are Node-free) | >1/3 of a sample of ≥20 real public repos' configs fall outside the recognised shapes → re-weigh a format-preserving library via `uvx` |
| D2 | Proof bar | answered (revised r2) | I4: differential tool probe required; absent tool = `not-proven` NOT-wired | a proven insertion is later found to change a consumer's lint result on code outside getff's bans |
| D3 | Manifests | operator-fork → answered | `pyproject.toml [tool.ruff.*]` yes; `Cargo.toml` no | a warn-level local clippy result let a violation through that deny would have stopped before CI |
| D4 | forbidigo defaults | answered (revised r2) | insert the default pattern exactly when the before-probe flags `fmt.Println`; tag `kept-default` | forbidigo changes `DefaultPatterns()` in the version the consumer runs → the inserted literal diverges |
| D5 | Marker | answered | content idempotence + `# getff` / `# getff: +…` / `kept-default` tags + before-getff original; getff paths self-attesting | a refresh removes a consumer-owned item |
| D6 | deny.toml | answered | nothing to insert; the NOT-wired line becomes a fact; template guard test | cargo-deny changes the `multiple-versions` default, or the template gains a non-default key |
| D7 | Squatted CI name | answered | stays NOT-wired | — (no alternative name is ever written) |
| D8 | sgconfig widening | answered | add S2 single-line flow list; S3 only if the no-`ruleDirs` probe shows it is valid config | ast-grep rejects a file the S2 inserter produced |
| D9 | CI path | answered (extended r2) | every getff CI gate reads a getff-owned config (§4.0); insertion is local-only | any getff CI gate reads a consumer config after §4.0 ships (ast-grep only if the §4.0 probe forces the recorded exception) |
| D10 | Refresh removal of getff-tagged items | operator-fork → answered | remove only what a getff tag names; consumer bytes never (same property adapter-jig C4 gives the ast-grep scan dir) | a refresh removes an element no tag named, or leaves a tagged element the template dropped |
| D11 | Config lookup names | answered (r2) | target the file each tool loads, per its own lookup order (probe-derived); also fixes the go/cargo fresh-cell detection | a consumer file the tool loads is missed and getff's copy lands beside it |

## 9. Testing seams

One seam per lane, all existing: the lane delivery suites (`tests/install-sh/python-delivery.test.sh`,
`cargo-entry-lane.test.sh`, `go-entry-lane.test.sh`, `python-entry-lane.test.sh` — the E2 negative
that must stay green), plus arms Y / C / J of `tests/install-sh/install-no-manual-step.test.sh`
(#1890). Additions are table-driven fixtures: each §4 shape row → a consumer input file and its
golden output; each NOT-wired row → the file is byte-identical afterwards and exactly one NOT-wired
line carries the reason. Cross-cutting arms: re-run byte-identity (D5), `--refresh` behaviour per
D10, rollback on an injected probe delta (I4), `not-proven` with the tool removed from PATH,
unkeepable original (I3), symlinked config stays a symlink (I3), the deny.toml template guard (D6),
and the §4.0 CI isolation (a consumer config without getff's bans; the getff gate still fires).

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

Plan prerequisite probes (T3 INCONCLUSIVE until run): ruff config precedence in one directory;
ast-grep `scan -c` from outside the root (§4.0) and the no-`ruleDirs` case (§4.2); golangci-lint
config lookup order and v1.55.2 behaviour on a v2 file (§4.6); ruff's resolution of `ignore` vs
`extend-select` at equal specificity (§4.1 — the design NOT-wires the overlap either way).

## 12. Known limits

- A `-E forbidigo` used only on a command line the install cannot see (§4.6).
- A formatter that strips trailing comments turns getff's items into consumer-owned ones (§6).
- The probe's ruff may differ from the version the consumer pins elsewhere; the probe uses the
  consumer's PATH ruff first.

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
