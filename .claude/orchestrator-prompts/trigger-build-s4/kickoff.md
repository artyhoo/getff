# trigger build, slice 4, stage 1 — the mechanism foundation and the first mechanism (A13)

> **Class:** stage kickoff (dispatch input), single stage. **Base branch:** `staging`.
> **Branch:** `feat/trigger-build-s4-first-mechanism`. **PR title:**
> `trigger build S4.1: mechanism foundation (per-mechanism file, history fixture, refresh, markers) + A13`.
> **Channel:** one aif task, own worktree, one PR to `staging`, harvested from the host (never
> pushed from the container). The lead session of the trigger build verifies the proof on the host
> and runs the cold-agent classification of §4 there.
> **Rigor label (L0):** `build-and-verify` — ships a blocking pre-push section to every npm-stack
> consumer and writes a consumer-owned file at install; every later slice-4 mechanism stands on it.
> **Authoritative for:** this stage's contract — the per-mechanism file format and its helper, the
> history fixture, the refresh pass, the marker check, the A13 mechanism, exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the trigger-build design, spec and advisor verdicts — they live in the operator's coordination
> store, not in the repo; the rows this stage needs are quoted verbatim in §0 below.

**Measurement SHA for every `path:line` below:** `2855667cb34` (`origin/staging`, 2026-09-30).
Re-locate by content (`grep -n`) if yours differ.

**Dispatch gate:** §1.9 lists four `OPEN:` items. The lead closes each (edit this file, one line
per item) before dispatch. A worker that finds an `OPEN:` still open stops and reports; it never
picks a value.

## §0 Spec rows this stage carries (verbatim, by pointer)

Source: `_spec-2026-09-29-trigger-build.md` (coordination store, revision r2e; not readable from the
container, hence quoted). §3 «Slice 4 — the first batch through the installer», `:237-289`:

> Rows, in order (D20): A13, C9, then A18, C11, D1, G5. Their bindings and sizes are in the helper's
> harvest file (`_facts-2026-09-29-harvest-batch.md`; sizes are a judgment, V12).
>
> What is built, per mechanism:
>
> 1. The binding to getff becomes a parameter in the mechanism's own file, beside its starting list
>    (S-12 points 2-4); the constant record line on P2's `aif:project-checks` block waits for the join.
> 2. The starting list, written once when the mechanism first arrives (D23, D30).
> 3. Its escape line, if it records one (D27), with the escape-count check (S-11).
> 4. Its false-fire measurement on getff's history (S-10), before it ships as a blocker.
> 5. Its detector version, written in its own file's first line with the getff-owned header
>    `# getff-mechanism: <name> <version>` — the key S-13 reads on refresh, and the mark a later
>    uninstall finds (D30). [...] EVERY artefact slice 4 writes at a consumer is mechanically
>    findable (S-15).
>
> And once for the slice:
>
> 6. A fixture project with history: a script that builds a git repository with old violations committed
>    before the install and a new violation after it.
> 7. The refresh path of S-13 in the installer's `--refresh` pass.
> 8. getff first [...]: each generalised mechanism runs on getff itself, with its
>    own per-mechanism file holding the getff binding, before it ships to consumers.
> 9. P2 stays as built and is not a dependency of this slice. Operator log entry 32, verbatim: «A.
>    Оставить Ч2  пока как есть - будим пилить отдельно независимо и интегрировать потом!» [...] So
>    slice 4 ships each mechanism with its starting list through channels that exist on `staging` today
>    (a pre-push section with owner `both`, the installer's existing script delivery) and requires no edit
>    inside the unmerged P2 branch. [...] **CI**: fires only if the ci.yml getff ships runs those
>    pre-push sections — not verified by this spec; measured at slice 4 start, and if it does not, CI is
>    a declared limit until the join. **pre-commit** (lint-staged) and **edit-time**: not channels of
>    these mechanisms before the join — declared limits (§5).
>
> **Proof.** On the fixture project: the new violation blocks, the old ones are listed and do not block,
> for every mechanism of the batch. The escape-count check fires on a seeded run of escapes in getff.
> Refresh (S-13): the fixture is refreshed with a seeded widened detector version; the finding only the
> widened version catches lands in a new section and does not block; a new violation of that kind after
> the refresh blocks; the older section is byte-identical before and after; `[params]` edited by the
> project before the refresh is byte-identical after it (N2); a refresh with an unchanged version writes
> nothing. In getff (N3): each mechanism runs on getff with getff's own per-mechanism file and is green
> before it ships. Findability (S-15, E4 condition 2): the marker check passes on the fixture after
> install and fails on a seeded slice-4 artefact without its marker. The install report names no removal
> path (E4 condition 3).

The same spec's §2.2 rows, quoted in the parts this stage builds (`:86-90`):

> **S-12** (4) Built shape [...]: a plain-text file with two sections — `[params]` (`key = value` lines,
> each change carrying a `# reason:` line) and `[starting-list]` (one finding key per line, sorted).
> Shrink-only (D23) is checked on the `[starting-list]` section alone: its line set may only lose members
> against the commit that first wrote it (D30); a `[params]` edit never reads as a list change and a list
> growth never hides as a params edit. [Point (2):] The mechanism's ONE file, per mechanism, inside the
> project, holds its parameters AND its starting list [...]. Never a shared file, never read by a
> getff-owned registry runner (entry 26).
>
> **S-13** [...] The `[starting-list]` of S-12 is split into sections, one per detector version:
> `[starting-list <version>]`. Install writes the section of the installed version. On
> `install.sh --refresh` [...] a mechanism whose detector version changed runs over the tree once; its
> findings not listed in any older section are written as the new version's section; an unchanged version
> writes nothing. Each section is written once, by the commit that first adds it, and is shrink-only
> against that commit [...]. A refresh changes only the header line and adds the new section; `[params]`
> and every older section stay byte-identical, including a `[params]` the project edited [...]. [...]
> every escaped one carries its escape line (D27), which the detector reads as passing [...].
> Falsifier: a refresh finds an unlisted finding that the OLD version also reports on the same tree (then
> the old version was not blocking — a bug to fix, never a finding to list; the refresh stops with that
> message).
>
> **S-15** Files: every file slice 4 writes at a consumer (mechanism script, per-mechanism file of S-12)
> starts with `# getff-mechanism: <name> <version>`; a file whose format takes no `#` comment sits under a
> fixed getff-owned directory instead. Registrations inside shared files: a pre-push section id and a hook
> entry's command path both carry `getff-mechanism-<name>`. The check: the set of paths slice 4 adds to
> the install fingerprint (`tests/install-sh/baselines/<stack>/*.fingerprint`, which lists every file
> install writes as `<sha256>  <path>`) — each must carry the header or sit in the fixed directory; each
> registration slice 4 adds must carry the name. It runs in slice 4's install test and fails on a seeded
> artefact without its marker. Falsifier: a slice-4 artefact exists that the fingerprint does not list.
>
> **S-10** The false-fire measurement of D24 is a script run in a session, never in CI (invariant 4): it
> replays one detector over the last 500 first-parent commits of getff, lists every fire, and a named cold
> agent classifies the fires (all of them up to 20; a uniform sample of 20 above that) as true or false.
> Bar: at most 20 % false [...]. Above the bar the inexact shape is dropped from the detector and declared
> as its limit [...]; a detector never ships as a warning [...]. The fire count is recorded beside the
> rate as a number and gates nothing [...].
>
> **S-11** The escape-count check of D31 counts, per mechanism that records an escape, the escape lines
> added since that mechanism's starting list was written. Above the threshold it fails with one message:
> raise the mechanism as a question to the project's owner. The threshold comes from the slice-4
> measurement of escape lines per mechanism, not from a number chosen here [...]. In getff it is shown
> working on the `Prior-art: skipped` escape (V10: 526 of 686 lines in 500 commits) before it ships.

Design row D27 (`_design-2026-09-29-trigger-build-v2.md:182`), the part that binds an escape: «a
mechanism records whether it has an escape line; bypass guards, security denies and the roots have
none; where recorded, the agent uses it with a reason in words; [...] no character floor, an empty or
placeholder reason is rejected». Advisor E4 condition 3 (`_advisor-trigger-build.decisions.md#e4`):
«The install report must not claim a removal path that does not exist.»

## §1 Facts, measured at `2855667cb34`

1. **Owner registration.** `packages/core/hooks/pre-push.ts:846` `export type SectionOwner =
   'consumer' | 'maintainer' | 'both';`; the registry is `const SECTIONS` at `:2590`, closed by `];` at
   `:2740`. `composeSections` keeps `s.owner === 'both' || s.owner === wanted` (`:2761`) with
   `wanted = isFrameworkRepo ? 'maintainer' : 'consumer'` (`:2752`); `isFrameworkRepo` is the presence
   of `docs/meta-factory/prior-art-evaluations.md` (`:2784`, `SSOT_REL` at `:350`). So an owner-`both`
   section runs in getff AND at a consumer — the «getff first» channel of item 8 for free. Existing
   `both` entries: `lychee` (`:2714`), `unpinned-tool-install` (`:2720-2721`). The pattern of a
   consumer section calling a shipped script: `ruleGlobsSection` (`:1066-1072`) runs
   `bash scripts/check-rule-globs.sh`. `ctx.rb.head` is the pushed ref's `local_sha` (`:122-132`).
   `PREPUSH_ONLY=<id>` runs one section (`:2802`; used in CI at `.github/workflows/audit-self.yml:1280`).
2. **What a consumer runs.** Not `pre-push.ts`: install ships a prebuilt bundle,
   `setup.d/50-hooks.sh:42` copies `packages/core/hooks/pre-push.bundle.mjs`; the husky hook runs it,
   else a bash fallback (`packages/core/templates/shared/husky-pre-push.sh:27-28`). The bundle is built
   by `scripts/build-runtime-bundles.mjs` (`:67` outfile; `--check` is the drift gate, `:47`). The
   fallback runs only the prior-art and §1.7 presence checks (`packages/core/hooks/pre-push.fallback.sh:4-6`).
3. **Does the shipped ci.yml run pre-push sections? NO — measured.** The four ci.yml templates install
   delivers (`setup.d/40-configs.sh:485`, `:509`, `:530`, `:558`) contain no `pre-push`, `PREPUSH_ONLY`
   or `bundle.mjs` (grep over each at this SHA: 0 hits). `templates/ts-server/github-actions-ci.yml`
   runs individual scripts (`:41` `bash scripts/check-rule-globs.sh`, `:47`, `:52`, `:86`); the
   next-15 template the same (`packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml:38`,
   `:44`, `:49`, `:83`); the react-spa and react-native templates run only `npm run …` steps. And a
   refresh never edits a consumer workflow (`install.sh:1481`, «--refresh does not edit it»). So CI is a
   declared limit of this stage until the join (§0 item 9), stated in the PR body and the install report.
4. **Script delivery.** Install: `copy_safe` of `packages/core/audit-self/<x>.sh` to `scripts/<x>.sh`
   (`setup.d/40-configs.sh:20-21`). Refresh: `do_refresh` (`install.sh:770`, called `:1518`) walks a
   `src:dst` list (`install.sh:1130-1154`) through `refresh_safe` (`setup.d/lib.sh:1177`). `--refresh`
   is parsed at `install.sh:130`. `copy_safe` is `setup.d/lib.sh:875`; `note_not_wired` `:3043`.
5. **Fingerprints.** `tests/install-sh/baselines/<stack>/<variant>.fingerprint`, 15 files at this SHA,
   lines `<sha256>  <path>` (e.g. `scripts/check-rule-globs.sh` in `ts-server/greenfield.fingerprint`).
   `tests/install-sh/snapshot.sh` installs with `bash "$REPO_ROOT/install.sh" "$stack" --force < /dev/null`
   into a `git init`-ed `mktemp -d` (`:139-143`); npm stacks `ts-server react-next react-spa react-native`
   (`:301`); recapture with `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`.
6. **The getff mechanism this stage generalises (per OPEN-1 default).** Principle 41,
   `packages/core/principles/41-shell-test-ci-coverage.test.ts`: population = every tracked
   `*.test.sh` (`:94-104`); registry = `.github/workflows/*.yml|yaml` with whole-line `#` comments cut
   (`WORKFLOW_DIR` `:79`, `:121-130`); finding = a population path the registry text never names
   (`:133-135`); escape = `COVERAGE_ALLOWLIST` path → rationale (`:86`), which it floors at 20 chars
   (`:152`). **getff today:** 190 tracked `*.test.sh`, 0 unwired (this session, `git ls-tree` +
   non-comment workflow text at `2855667cb34`). Its escape history: 2 first-parent commits touched
   principle 41 in the last 500 (window back to 2026-08-10); the allowlist held one real entry, removed the
   same day (`:35-37`).
7. **CI wiring surface.** `tests/install-sh/meta-all-wired.test.sh:13`, `:22-25` demands every
   `tests/install-sh/*.test.sh` be named in `audit-self.yml`; principle 41 demands it of every tracked
   `*.test.sh`. Lines of `audit-self.yml` cited elsewhere in the tree include `:742`, `:745`, `:748`,
   `:750`, `:756`, `:1280` (`git grep -o 'audit-self\.yml:[0-9]*'`); `:752` and `:754` are cited nowhere.
   `&&`-chained `run:` lines exist (`:681`, `:766`).
8. **Citations into `pre-push.ts`.** The highest line cited anywhere in the tree is `:2516`
   (`git grep -o 'pre-push\.ts:[0-9]*'`). Code added after `:2516` shifts no citation.
9. **Card directory.** `.claude/hooks/getff-cards/` holds 0 tracked files at this SHA.

### §1.9 Open items (the lead closes them before dispatch)

- **OPEN-1 — which getff check A13 generalises.** The sources under-determine it:
  - harvest facts, row A13 (`_facts-2026-09-29-harvest-batch.md:17`): «hard-coded directory list:
    `22-internal-english.test.ts:61` `tracked('.claude/hooks', '.claude/skills', 'scripts')`; audit-self
    job names (map row A13) | S — the list moves to config | yes (vitest, CI)»;
  - mechanism map, row A13 (`_facts-2026-09-29-mechanism-map.md:64`): four getff surfaces — (1) that
    directory list, (2) principle 41, (3) principle 38, (4) `audit-self.yml` `bash -n` (`:60` here),
    the shellcheck gate (`:1178` here), actionlint, zizmor;
  - base-core review table (`_base-core-review-results-2026-09-29.md:203`): «the project's lint and test
    globs cover its own tooling (hooks, scripts, agent docs); extends `check-rule-globs.sh`».
  The directory list at `22:61` is also C9's binding (facts `:21`), so it cannot by itself be A13's
  detector. **Proposed default:** A13 = principle 41's shape (§1 fact 6) — «every tracked shell test of
  the project is run by some workflow step». It is one of map row A13's surfaces, it is exact (a path
  string absent from non-comment workflow text — D24), it needs no tool beyond git and bash, and it is
  the «test globs cover its own tooling» half of the base-core row. Wrong if the lead reads A13 as the
  lint-glob half (then A13 extends `check-rule-globs.sh` and §2 D2 is rewritten before dispatch).
- **OPEN-2 — does A13 record an escape line (D27), and in what form.** Principle 41 records one
  (`:86`). **Proposed default:** yes; the line sits in the exempted test file itself,
  `# getff-escape: a13 <reason>`, and the detector reads a file carrying it as passing (S-13). No
  character floor (D27 — unlike `41:152`); an empty reason or a placeholder (`todo`, `tbd`, `later`,
  `fixme`, `n/a`, `none`, `-`, `.`) is rejected. An escape inside the per-mechanism file is ruled out
  by S-12 («a list growth never hides as a params edit»). If the lead answers «no escape», drop §2 D6
  and the escape cases of D7.
- **OPEN-3 — the path of the per-mechanism file.** The spec fixes the format (S-12 (4)), not the path.
  **Proposed default:** `.getff/mechanisms/<name>.txt`, the same path in getff and at a consumer
  (`.getff/` is already getff's namespace at a consumer, `setup.d/45-python.sh:909`). One file per
  mechanism, never shared (S-12 (2)); not `.getff/project.json` / `checks.json` / `chain.json`
  (entry 26).
- **OPEN-4 — A13's S-11 threshold.** S-11 takes it from «the slice-4 measurement», and getff's A13
  escape history is one entry in 500 commits (§1 fact 6). The stage measures and prints the count; the
  lead writes the number (or the rule that derives it) here. The stage does not choose it.

## §2 Deliverables

All new shell is bash 3.2-safe (macOS consumers), `set -uo pipefail`, no new runtime dependency.
«Finding key» = one line, no tab, stable across runs (for A13: the repo-relative path).

- **D1 — per-mechanism file helper** `packages/core/audit-self/getff-mechanism-lib.sh` (sourced),
  delivered to `scripts/getff-mechanism-lib.sh`. Line 1 `# getff-mechanism: mechanism-lib <version>`.
  Functions (names are yours; the behaviour is the contract):
  - parse and validate the file: line 1 `# getff-mechanism: <name> <version>`; then `[params]` with
    `key = value`, `# reason: …` and blank lines; then one or more `[starting-list <version>]` sections,
    one finding key per line, sorted; any other line is an error naming its line number;
  - read one param; read the listed set (the union of every `[starting-list …]` section);
  - write the file once — refuses when it exists (D23, D30, D10);
  - shrink-only check at a revision: for each `[starting-list <v>]` section, find the commit that first
    added that section header (`git log --reverse` on the file), and fail naming every member present at
    the revision but absent at that commit. A section not yet in any commit is skipped with one printed
    line saying so. `[params]` is never compared;
  - refresh append (S-13): given the new version and the new version's findings, write nothing when the
    header version equals it; else append `[starting-list <new>]` with the findings not listed in any
    older section and replace the header line — every other byte stays (assert with `cmp` of the prefix);
  - escape count (S-11): count lines matching an escape pattern ADDED between a commit and a revision,
    from file diffs or from commit messages (the getff `Prior-art: skipped` case is a trailer).
- **D2 — the A13 mechanism** `packages/core/audit-self/getff-mechanism-a13.sh`, delivered to
  `scripts/getff-mechanism-a13.sh`. Line 1 `# getff-mechanism: a13 1`, line 2 `# shellcheck
  shell=bash`, no shebang (S-15 «starts with»; it is always run as `bash <path>`). Call shape
  `bash <script> <mode> <its-file> [--rev <sha> | --worktree]`, so the future constant record line of
  E3 (`<runner> <mechanism> <its-file>`) fits without change. Modes:
  - `findings` — prints every finding key, sorted, escaped files excluded (OPEN-2);
  - `check` — findings minus the listed set, plus the shrink-only check; exit 0 when both are empty,
    else exit 1 printing each new finding with a fix hint (wire the test in a workflow step, or delete it);
  - `install` — writes the file once (D1) from `findings --worktree`, with the default `[params]`.
  Detector per the OPEN-1 default, parameters from `[params]` (the getff binding made a parameter, item 1):
  `test_suffix = .test.sh` (getff binding `41:102`), `workflow_dir = .github/workflows` (`41:79`).
  Population = tracked files (`git ls-tree -r <rev>` / `git ls-files`) ending in `test_suffix`;
  registry = every `*.yml|*.yaml` under `workflow_dir` at the same revision, whole-line `#` comments cut
  (`41:121-130` — keep that cut, it is load-bearing there).
- **D3 — getff's own file** `.getff/mechanisms/a13.txt` (OPEN-3), produced by running D2's `install`
  mode on getff, never typed by hand. Expected `[starting-list 1]`: empty (§1 fact 6); if it is not,
  paste what it lists into the PR body.
- **D4 — the pre-push section**, owner `both`, id `getff-mechanism-a13` (S-15 registration name). Its
  function runs `packages/core/audit-self/getff-mechanism-a13.sh` when `ctx.isFrameworkRepo`, else
  `scripts/getff-mechanism-a13.sh`, as `check .getff/mechanisms/a13.txt --rev <ctx.rb.head>`; at a
  consumer with no per-mechanism file it fails naming the missing file (fail closed, D19 — install writes
  it, §2 D5). Place the function after `:2516` and the entry as the LAST element of `SECTIONS` (before
  `:2740` `];`) so no citation moves (§1 fact 8). Rebuild the bundle (`node scripts/build-runtime-bundles.mjs`).
  The bash fallback does not get the section — declared limit (Node < 20 consumers).
- **D5 — install and refresh delivery**, npm-stack lane only. Every slice-4 delivery goes through ONE
  install function and ONE refresh function (names yours), so D8 can switch them off as a unit.
  - Install: copy D1 and D2 to `scripts/` beside the existing copies (`setup.d/40-configs.sh:20`); then,
    in a git repository, run `install` mode unless the file exists. Not a git repo → `note_not_wired`
    naming the mechanism. The per-mechanism file is consumer-owned from that moment: never passed to
    `copy_safe` / `refresh_safe`, never in the R1 refresh baseline (prove it: two refreshes, file stays).
  - Install report: one line per mechanism — name, version, findings written, file path — and the CI
    limit of §1 fact 3. No removal path is named (E4 condition 3).
  - Refresh (item 7, S-13), in `do_refresh`, BEFORE the scripts loop replaces the consumer's script:
    run the consumer's current script (`findings`) and the package's new one; if the new version equals
    the file's header version, write nothing; else if any finding the OLD script reports is not listed,
    stop with S-13's message and leave the file untouched; else append the new section (D1).
    `tests/install-sh/refresh-covers-full-delivery.test.sh` must stay green (install/refresh parity).
- **D6 — escape and escape count** (only if OPEN-2 = yes). The detector honours
  `# getff-escape: a13 <reason>` (§1.9). The S-11 check runs inside `check`: escape lines added since
  the commit that first wrote the file; above `escape_threshold` (a `[params]` key, value from OPEN-4)
  it fails with one message: raise mechanism a13 as a question to the project's owner. Shown working in
  getff on `Prior-art: skipped` (spec S-11): a hermetic test with a seeded run of commits carrying that
  trailer fires; and one measured run over getff's last 500 first-parent commits, the count pasted into
  the PR body beside V10's 526.
- **D7 — the fixture project with history** (item 6): a sourced builder
  `tests/install-sh/lib/fixture-with-history.sh` that any later mechanism reuses: `git init` a
  `mktemp -d`, seed a minimal npm project (as `snapshot.sh:139-143`), commit the mechanism's OLD
  violations, run `install.sh ts-server --force < /dev/null`, commit the install, then commit the NEW
  violation. The seeds are callbacks per mechanism. The A13 test `tests/install-sh/mechanism-a13.test.sh`
  seeds: two old unwired `*.test.sh`, one wired one named in a project-owned
  `.github/workflows/own.yml`, then one new unwired test, and asserts:
  - after install, the old two sit in `[starting-list 1]`; `check` exits 0 on the install commit;
  - on the new-violation commit `check` exits 1 naming exactly the new path, and not the old two;
  - removing an old test and its list line passes; ADDING a line to `[starting-list 1]` in a later commit
    fails the shrink-only check; editing `[params]` with a `# reason:` line does not;
  - (OPEN-2 = yes) the escape line passes a new test; an empty and a placeholder reason fail;
  - refresh (S-13), using a throwaway copy of the package root whose A13 script is version `2` and also
    matches `*.test.bash` (a seeded widening, never an edit of the real script): a `*.test.bash` present
    before the refresh lands in `[starting-list 2]` and does not block; a new one after it blocks;
    `[starting-list 1]` and a project-edited `[params]` are byte-identical before/after; a second refresh
    with version `2` leaves the file byte-identical (`cmp`); a tree where the OLD version reports an
    unlisted finding stops the refresh with S-13's message.
- **D8 — the marker check** (S-15) `tests/install-sh/mechanism-markers.test.sh`: install the same
  fixture twice, once with the slice-4 deliveries switched off (one documented install switch guarding
  only the two D5 functions); the population = fingerprint paths of the first minus the second (the
  `compute_fingerprint` shape of `snapshot.sh`). Every member must start with
  `# getff-mechanism: <name> <version>` or sit under a fixed getff-owned directory (a list of one or more
  directories in the test; `.claude/hooks/getff-cards/` joins it in its own stage, §6). Every
  `SECTIONS` entry that runs a `getff-mechanism-*.sh` script has id `getff-mechanism-<name>`. Seeded
  negatives: the A13 script with line 1 stripped fails; a section id without the name fails. Plus: the
  install output names no uninstall or removal path for a mechanism.
- **D9 — the false-fire script** (S-10, item 4) `scripts/measure-false-fires.sh` (getff-internal, never
  shipped, never in CI — invariant 4): `bash scripts/measure-false-fires.sh <mechanism-script> <its-file>
  [N=500]`. A FIRE = a finding key reported at first-parent commit C and not at C's first parent (what the
  push of C would have blocked, D23). Output: one `FIRE <sha> <key>` line per fire, a
  `FIRES total=<n> commits=<N>` line, and the sample the cold agent reads — all fires when ≤ 20, else a
  uniform sample of 20 drawn with a printed seed so a rerun draws the same set (S-10 falsifier). Test
  `scripts/measure-false-fires.test.sh` over a `mktemp -d` repo with known fires. The classification run
  is the lead's (host). Run the script once on getff for A13 and paste the `FIRES` line into the PR body.
- **D10 — CI wiring without shifting lines** (principle 41 + `meta-all-wired.test.sh`): chain the new
  tests onto an existing `run:` line that nothing cites, e.g. `audit-self.yml:754`
  (`run: bash tests/install-sh/glm-onebutton.test.sh && bash tests/install-sh/mechanism-a13.test.sh && …`,
  precedent `:766`). Do not insert a step line. Then `npx tsx scripts/check-line-citations.mjs --check --corpus` (the pre-push form, `pre-push.ts:1901-1902`) must be
  green; never run it with `--write` on `.claude/rules/*`.
- **D11 — SSOT row** in `docs/meta-factory/prior-art-evaluations.md` per §3, same commit as D1/D2, with
  `Verdict`, `Rationale`, `Trigger to revisit`.
- **D12 — baselines**: `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, commit the recaptured
  fingerprints; the diff adds exactly the D5 paths per npm-stack baseline and nothing else.

## §3 Prior-art consult (run by the kickoff author 2026-09-30; re-check, do not re-derive)

This stage IS a capability commit: new files ≥ 80 LOC under `packages/` (D1, D2).

- SSOT: row **#248** (principle 38/41's population-vs-workflow-registry shape, verdict ADAPT) — the
  detector D2 generalises. No row covers a written list of pre-existing violations (grep of the SSOT
  for `baseline|ratchet|suppression|shrink|grandfather` at `2855667cb34`: no such row).
- context7, three phrasings (the first context7 server answered «Monthly quota exceeded»; the second
  answered):
  1. `/eslint/eslint` «bulk suppressions for existing violations, only new violations fail» — ESLint
     `--suppress-all` writes `eslint-suppressions.json`; «While the rule will be enforced for new code,
     the existing violations will not be reported»; resolved violations raise an «unused suppressions»
     error until `--prune-suppressions`.
  2. Betterer (`/websites/phenomnomnominal_github_io_betterer_introduction`) «ratchet that only allows
     improvement» — a `.betterer.results` file, «If it gets worse, your test will fail».
  3. `/semgrep/semgrep-docs` «baseline commit, only findings introduced since» — `--baseline-commit`;
     a diff-aware scan «only reports findings that are newly introduced in the commits after that baseline».
- Verdict: **ADAPT the pattern, BUILD in bash.** ESLint's file is lint-only (for lint rules the list
  stays in the linter's own config, S-12 (2)) and is REWRITTEN by `--suppress-all` (D30 says written
  once); Betterer adds a Node dependency and rewrites its results on improvement; Semgrep's baseline is
  stateless (no list is written or reported, which D23 requires) and brings a Python dependency. None
  has per-detector-version sections (S-13).
- Trailers:
  `Prior-art: prior-art-evaluations.md#248 (population-vs-workflow-registry shape, ADAPT — the A13 detector generalises it to a consumer parameter)`
  `Prior-art: prior-art-evaluations.md#<new ID> (starting list of pre-existing violations: ESLint bulk suppressions, Betterer, Semgrep baseline — ADAPT the pattern, write-once and per-version sections)`.
  The new ID is the next free one at landing time (297 is the highest at `2855667cb34`; re-read before
  committing — IDs race between PRs).

## §4 Proof — RED first

- Write D7 and D8 before D1/D2/D5 exist and paste their failing runs into the PR body; then GREEN.
- Every asserted finding set is derived in the test from the files it seeded, never typed from output.
- The seeded widened version (D7) lives in a throwaway package copy; the real A13 script stays at `1`.
- getff first (item 8): `bash packages/core/audit-self/getff-mechanism-a13.sh check
  .getff/mechanisms/a13.txt --rev HEAD` exits 0 on your branch, and `PREPUSH_ONLY=getff-mechanism-a13`
  runs the section green, before any consumer-facing claim.
- Host half (the lead's): the cold-agent classification of D9's sample, the 20 % bar, the S-11
  threshold (OPEN-4). Do not claim them.

## §5 Exit gates

```bash host-verify
bash tests/install-sh/mechanism-a13.test.sh
bash tests/install-sh/mechanism-markers.test.sh
bash scripts/measure-false-fires.test.sh
bash packages/core/audit-self/getff-mechanism-a13.sh check .getff/mechanisms/a13.txt --rev HEAD
PREPUSH_ONLY=getff-mechanism-a13 npx tsx packages/core/hooks/pre-push.ts
node scripts/build-runtime-bundles.mjs --check
shellcheck packages/core/audit-self/getff-mechanism-lib.sh packages/core/audit-self/getff-mechanism-a13.sh scripts/measure-false-fires.sh tests/install-sh/lib/fixture-with-history.sh
npx vitest run packages/core/principles/27-prepush-copylist-complete.test.ts packages/core/principles/32-prepush-section-owner.test.ts packages/core/principles/41-shell-test-ci-coverage.test.ts packages/core/principles/45-prepush-contract-claim-liveness.test.ts
bash tests/install-sh/meta-all-wired.test.sh
bash tests/install-sh/refresh-covers-full-delivery.test.sh
bash scripts/run-local-ci-sweep-coverage.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
npx tsx scripts/check-line-citations.mjs --check --corpus
node scripts/check-docs-refresh.mjs "$(git merge-base origin/staging HEAD)..HEAD"
bash scripts/run-local-ci-sweep.sh
```

The docs-refresh gate decides whether any `docs/site/` page cites a touched file in `sources:`; refresh
the named page or add `docs-refresh: deferred — <reason>` (a comma inside the reason, never `: `).

## §6 Out of scope

- **The other five mechanisms of the batch** — one follow-on stage kickoff each, authored after this
  stage lands, each reusing D1, D5, D7, D8, D9 (binding and size from `_facts-2026-09-29-harvest-batch.md`,
  lines re-measured at `2855667cb34`):

  | Row | Stage (proposed slug) | Binding at `2855667cb34` | Size (facts, a judgment) |
  |---|---|---|---|
  | C9 | `trigger-build-s4b` | `22-internal-english.test.ts:61` directory list, `:31` `SKILL_BODY_RU_ALLOWLIST` (facts `:21`) | S |
  | A18 | `trigger-build-s4c` | `packages/core/hooks/checks/s17.ts:21` `DISCIPLINE_FILE_RE`; `discipline-self-check.yml:95` PR-body grammar (facts `:18`) | M |
  | C11 | `trigger-build-s4d` | `scripts/check-docs-refresh.mjs:25-26` `sources:` pages; `scripts/check-line-citations.mjs:425` `LIVE_AUTHORITY_MD` (facts cite `:372` at `26ccdc6b160`) (facts `:22`) | M |
  | D1 | `trigger-build-s4e` | `packages/core/hooks/checks/prior-art.ts:25` `SSOT_CITATION_RE`; capability triggers (facts `:24`) | M |
  | G5 | `trigger-build-s4f` | `46-git-env-inheritance-safety.test.ts:108`, `:123`; `packages/core/audit-self/hooks-tree-guard.ts` (facts `:29`) | M |

  Order per D20 (§0). C9 shares A13's `22:61` binding — its stage re-reads OPEN-1's closure first.
- **HO-6 — delivering `.claude/hooks/getff-cards/`** — a follow-on stage, not this one. The spec places
  it in slice 4 (§4 hand-over row HO-6: «Slice 4 builds the installer step that copies
  `.claude/hooks/getff-cards/` [...]; HO-6's rule rides there as the first card-only rule. Met when a
  fresh install lists `.claude/hooks/getff-cards/<card>.md` in its fingerprint»), but (a) it is not one
  of slice 4's items 1-9, which are the mechanism path; (b) a card reminds and a mechanism blocks (D19),
  a different delivery with its own check; (c) its input does not exist yet — 0 files under
  `.claude/hooks/getff-cards/` (§1 fact 9) — and the same row says «Slice 2 may create card files in
  getff's own directory», so it waits for slice 2's card. What this stage leaves ready: D8's fixed-dir
  list, which that stage extends. Base-core cards go to `getff-cards/`, never to the project's
  `.claude/rules/` (operator log entry 49: «главное при реализации не перепутай!»).
- Any file under `.claude/rules/` or `.claude/settings.json` — no agent and no factory run commits there
  in this build (spec `[op V8]`); a change there is the lead's operator patch.
- P2's record line (E3 point 1) and any edit inside the P2 branch (§0 item 9); pre-commit and edit-time
  channels; CI (§1 fact 3); the bash fallback (D4); the python / cargo / go lanes — their pre-push is
  `.getff/hooks/pre-push`, which runs no `pre-push.ts` section (`setup.d/45-python.sh:909`). Each is a
  declared limit in the PR body.
- Retiring principle 41 in favour of D2 in getff — a separate decision (principle 41's own precedent,
  `41:60-61`).
- The getff-wide uninstall (D30 clause 3: NOT MET, deferred — spec §4, E4).

## §7 Falsifiers to write into the PR body

- The new violation passes on the fixture → the mechanism does not block (D19).
- An old violation blocks after install → the starting list was not written or not read (D23).
- A line added to `[starting-list 1]` in a later commit passes → shrink-only is not checked (D23).
- A `[params]` edit reads as a list change, or a list growth passes as a params edit → S-12 (4) broke.
- A refresh with an unchanged version changes any byte → S-13 «writes nothing» broke.
- A refresh changes `[params]` or an older section → D5 / D10 broke.
- A refresh lists a finding the OLD version also reports → the old version was not blocking (S-13).
- The per-mechanism file is overwritten or removed by install or refresh → D10 broke.
- The marker check stays green with the header stripped → `#hope-as-gate`.
- A slice-4 artefact appears in the with/without fingerprint diff unmarked, or exists outside it.
- The install report names a removal path → E4 condition 3.
- A rerun of D9 draws a different sample → S-10's falsifier.
- A path named only in a workflow comment counts as wired → the `41:121-130` cut was lost.

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs, D9's `FIRES` line, D6's count) /
`DECISIONS` (helper function names, the install switch name, the refresh order, the fire definition if
you changed it) / `ATTN` (every declared limit of §6) / `Confidence`. The PR body carries
`## Fidelity verdict` (the lead adds it after the cold fidelity round on the host) and the §1.7
Forward-check / Backward-check sections.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run each test, do not describe what it would print · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates · **T10** enumerate the
fingerprint population before asserting the marker check covers it · **T14** a green fixture that never
seeds the refresh-falsifier tree is not coverage of S-13 · **T19** own cold review of the diff before
handoff · **T21** cold `agents/backward-sweep-auditor.md` on the class «an installer step that writes a
consumer-owned file and a refresh that must never overwrite it» — every `copy_safe` / `refresh_safe`
caller and the R1 refresh baseline are the candidates.

**T-TB4-A (domain):** the starting list is written from the tree at install, so any bug that makes the
detector report MORE lands silently in the list and turns a blocker into a pass for everything it
over-reports. Assert the written list against the seeded old violations exactly (set equality), never
«non-empty», and never regenerate a list to make a test pass — a list is written once (D30).
