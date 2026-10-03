# trigger build, slice 4, stage 1 — the mechanism foundation and the first mechanism (A13)

> **Class:** stage kickoff (dispatch input), single stage. **Base branch:** `staging`.
> **Branch:** `feat/trigger-build-s4-first-mechanism`. **PR title:**
> `trigger build S4.1: mechanism foundation (per-mechanism file, history fixture, refresh, markers) + A13`.
> **Channel:** one aif task, own worktree, one PR to `staging`, harvested from the host (never
> pushed from the container). The lead session of the trigger build verifies the proof on the host
> and runs the cold-agent classification of §4 there.
> **Rigor label (L0):** `build-and-verify` — ships a blocking pre-push section to every npm-stack
> consumer and writes a consumer-owned file at install; every later slice-4 mechanism stands on it.
> **Authoritative for:** this stage's contract — the mechanism contract (§2.0), the per-mechanism file
> format and its helper, the history fixture, the refresh pass, the marker check, the A13 mechanism,
> exit gates, falsifiers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the trigger-build design, spec and advisor verdicts — they live in the operator's coordination
> store, not in the repo; the rows this stage needs are quoted verbatim in §0 below.

**Measurement SHA for every `path:line` below:** `2855667cb34` (`origin/staging`, 2026-09-30).
Re-locate by content (`grep -n`) if yours differ.

**Dispatch gate:** all OPEN items are closed (§1.9: OPEN-1…4 by the lead, OPEN-5 by advisor verdict
E20). A worker that meets an undecided fork stops and reports; it never picks a value.

## §0 Spec rows and decisions this stage carries (verbatim, by pointer)

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
> rate as a number and gates nothing: a detector with few or zero fires on getff's history still ships as
> a blocker once its exact-detection fixtures pass (D19). [...]
>
> **S-11** The escape-count check of D31 counts, per mechanism that records an escape, the escape lines
> added since that mechanism's starting list was written. Above the threshold it fails with one message:
> raise the mechanism as a question to the project's owner. The threshold comes from the slice-4
> measurement of escape lines per mechanism, not from a number chosen here [...]. In getff it is shown
> working on the `Prior-art: skipped` escape (V10: 526 of 686 lines in 500 commits) before it ships.

**Decision row E20** (advisor, `_advisor-trigger-build.decisions.md#e20`, 2026-09-30) — which detector
A13 is:

> **Verdict: A — A13 ships as principle 41's shape, generalised; the lint half is a declared limit
> with its next arm named. B and C are rejected.** [...] The base-core row `:203`'s tail «extends
> `check-rule-globs.sh`» was a drafting guess about the vehicle, not the detector: that script reads
> `RULE_GLOBS` ts globs and nothing else (`:219-226`, `:394`), so it cannot carry a tooling-coverage check
> without becoming a different program. The binding part of `:203` is its head — «the rules apply to the
> project's own tooling». [...] Conditions for the kickoff:
> 1. The population and the CI dir are `[params]` (E3): tooling dirs default to the harvested
>    list, the test-file pattern (`*.test.sh`) and the workflow dir (`.github/workflows/`) are
>    params too; a consumer with no workflow dir gets the population printed as a number and the
>    check declared «no CI dir — not checked» (E18 F1's shape: a number, never a green check).
> 2. Starting list at getff is 0 (190 tracked, 0 unwired — the lead's measurement, consistent with
>    p41 being green on staging); D28 allows an empty list. The bad/good proof therefore runs on the
>    fixture project: one unwired `*.test.sh` (bad → blocks), then wired (good → passes).
> 3. The lint half of `:203` is a declared limit in slice 4, and the mechanism file names its next
>    arm: at getff the lint over tooling IS `audit-self.yml` `:60` `bash -n` + `:1167` shellcheck over
>    `setup.d/*.sh + install.sh + scripts/*.sh` (map row A13 surface 4) — that is the arm to
>    harvest when A13 is widened, not a TS-lint glob. Trigger to revisit: a second S row lands or
>    the operator asks for the lint half.
> 4. p41's `COVERAGE_ALLOWLIST` is getff's escape: per D27 the mechanism RECORDS that it has an
>    escape line, and a placeholder reason is rejected.

E18 F1's shape, which condition 1 points at (`_advisor-trigger-build.decisions.md#e18`): «at a consumer
the report prints the population as a number («command/script checks: 0 — nothing to check yet»), never
as a green check». A13's row in the base-core review table (`_base-core-review-results-2026-09-29.md:203`),
for the record: «| A13 | check | the project's lint and test globs cover its own tooling (hooks, scripts,
agent docs); extends `check-rule-globs.sh` | build |».

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
   section runs in getff AND at a consumer — the «getff first» channel of item 8. Existing `both`
   entries: `lychee` (`:2714`), `unpinned-tool-install` (`:2720-2721`). A consumer section calling a
   shipped script: `ruleGlobsSection` (`:1066-1072`) runs `bash scripts/check-rule-globs.sh`, registered
   `{ id: 'rule-globs', owner: 'consumer', … }` (`:2613`). `ctx.rb.head` is the pushed ref's
   `local_sha` (`:122-132`). `PREPUSH_ONLY=<id>` runs one section (`:2802`; CI use
   `.github/workflows/audit-self.yml:1280`).
2. **What a consumer runs.** Not `pre-push.ts`: `setup.d/50-hooks.sh:42` copies the prebuilt
   `packages/core/hooks/pre-push.bundle.mjs`; the husky hook runs it, else a bash fallback
   (`packages/core/templates/shared/husky-pre-push.sh:27-28`). The bundle is built by
   `scripts/build-runtime-bundles.mjs` (`:67` outfile; `--check` drift gate, `:47`). The fallback runs
   only the prior-art and §1.7 presence checks (`packages/core/hooks/pre-push.fallback.sh:4-6`).
3. **Does the shipped ci.yml run pre-push sections? NO — measured.** The four ci.yml templates install
   delivers (`setup.d/40-configs.sh:485`, `:509`, `:530`, `:558`) contain no `pre-push`, `PREPUSH_ONLY`
   or `bundle.mjs` (grep over each at this SHA: 0 hits). `templates/ts-server/github-actions-ci.yml`
   runs individual scripts (`:41` `bash scripts/check-rule-globs.sh`, `:47`, `:52`, `:86`); the
   next-15 template the same (`packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml:38`,
   `:44`, `:49`, `:83`); the react-spa and react-native templates run only `npm run …` steps. A refresh
   never edits a consumer workflow (`install.sh:1481`, «--refresh does not edit it»). So CI is a declared
   limit of this stage until the join (§0 item 9), stated in the PR body and the install report.
4. **Script delivery.** Install: `copy_safe` of `packages/core/audit-self/<x>.sh` to `scripts/<x>.sh`
   (`setup.d/40-configs.sh:20-21`). Refresh: `do_refresh` (`install.sh:770`, called `:1518`) walks the
   `src:dst` pair list `for _pair in` … `; do` (`install.sh:1132-1148`) through `refresh_safe`
   (`setup.d/lib.sh:1177`); `refresh-covers-full-delivery.test.sh` holds install and refresh to parity.
   `--refresh` is parsed at `install.sh:130`. `copy_safe` is `setup.d/lib.sh:875`; `note_not_wired` `:3043`.
5. **Fingerprints.** `tests/install-sh/baselines/<stack>/<variant>.fingerprint`, 15 files at this SHA,
   lines `<sha256>  <path>`; the npm stacks carry 8 of them (`ts-server`, `react-next`, `react-spa`,
   `react-native` × `greenfield`, `brownfield`), each listing `packages/core/hooks/pre-push.bundle.mjs`.
   `tests/install-sh/snapshot.sh` installs with `bash "$REPO_ROOT/install.sh" "$stack" --force < /dev/null`
   into a `git init`-ed `mktemp -d` (`:139-143`); recapture: `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`.
6. **The getff mechanism A13 generalises (E20): principle 41**,
   `packages/core/principles/41-shell-test-ci-coverage.test.ts`. Claim `:4-6` («every git-tracked
   `*.test.sh` in the repo is invoked by some step in `.github/workflows/`, except files carrying an
   explicit justified entry in `COVERAGE_ALLOWLIST`»). Population = every tracked `*.test.sh`
   (`:94-104`, filter `:102`); registry = the `*.yml|*.yaml` files read with `readdirSync` of
   `WORKFLOW_DIR` (`:79`) — directly in that directory, not recursive (`:121-126`) — joined with every
   whole-line `#` comment cut (`:127-129`); finding = a population path the registry text never contains
   (`:133-135`). Escape = `COVERAGE_ALLOWLIST`, a `Map<string, string>` of path → rationale (`:86`),
   empty today (`:86-91`), each rationale floored at 20 chars (`:152`).
7. **getff under A13's default params — measured.** Tracked `*.test.sh` under the harvested tooling
   directories (`22-internal-english.test.ts:61` `tracked('.claude/hooks', '.claude/skills', 'scripts')`):
   **26, of which 0 unwired** (non-comment text of `.github/workflows/*.yml|yaml` at this SHA). The whole
   repo: 190 tracked, 0 unwired (E20's figure; principle 41 covers those). So getff's starting list is
   **0 lines** on a real population of 26 (D17 holds).
8. **S-10 replay for A13, measured by this kickoff's author with the same predicate** (FIRE = a finding
   at first-parent commit C absent at C's first parent), over the last 500 first-parent commits of
   `2855667cb34`: **FIRES total=0**. At the window base `8d2e7173cfd` one test was already unwired
   (`scripts/probe-channels.test.sh`, the one principle 41's header names at `:20`) — a starting-list
   member, not a fire; 26 `*.test.sh` were added under the three directories in the window, each wired by
   the commit that added it. D9 re-measures at the dispatch base.
9. **The next arm of A13 (E20 condition 3), re-measured at this SHA.** `audit-self.yml:56` step «Bash
   syntax of all *.sh», `:60` `if ! bash -n "$f" 2>err.log; then`, over `find . -name "*.sh"` (`:65`);
   the shellcheck gate is the step at `:1178` («shellcheck gate: setup.d/*.sh + install.sh + scripts/*.sh
   + scripts/lib/*.sh + the two B1 carrier scripts (pinned 0.9.0)»), command `:1187-1190` (E20's `:1167`: older SHA).
10. **Why not `check-rule-globs.sh` (E20):** it reads only `RULE_GLOBS.<key>` for
    `boundary|appCode|application` (`packages/core/audit-self/check-rule-globs.sh:219-226`) and probes only
    `*.ts|*.tsx` (`:394`, `:408-410`); the 250 tracked files under the three tooling directories hold 0
    `.ts|.tsx`.
11. **S-11 on getff (`Prior-art: skipped`), measured.** Over the last 500 first-parent commits of
    `2855667cb34` (window start `5414c857e30`, 2026-08-10): **504** `^Prior-art: skipped` lines of **663**
    `^Prior-art:` lines. V10's 526 of 686 was measured at `26ccdc6b160`, 14 first-parent commits earlier
    (window start `bde41e1cd80`); the same command re-run there returns 526 / 686, so the gap is the
    window moving.
12. **A13's escape history in getff:** principle 41's allowlist held one real entry in 500 commits,
    removed the same day (`41-shell-test-ci-coverage.test.ts:35-37`) — about 1 per 500.
13. **CI wiring surface.** `tests/install-sh/meta-all-wired.test.sh:13`, `:22-25` demands every
    `tests/install-sh/*.test.sh` be named in `audit-self.yml`; principle 41 demands it of every tracked
    `*.test.sh`. Lines of `audit-self.yml` cited elsewhere include `:742`, `:745`, `:748`, `:750`, `:756`,
    `:1280` (`git grep -o 'audit-self\.yml:[0-9]*'`); `:752`, `:753` and `:754` are cited nowhere. `&&`-chained
    `run:` lines exist (`:681`, `:766`).
14. **Citations into `pre-push.ts`.** The highest line cited anywhere in the tree is `:2516`, inside
    `invariantsRenderSection` (`:2514-2532`). Code added after `:2532` shifts no citation.
15. **Card directory.** `.claude/hooks/getff-cards/` holds 0 tracked files at this SHA.

### §1.9 Decisions (all closed)

- **OPEN-1 — CLOSED by E20:** A13 is principle 41's shape, generalised — every tracked tooling test file
  is run by a CI step. Size S, as the harvest row says (facts `:17`, «the list moves to config»).
- **OPEN-2 — CLOSED, reconciled with E20 condition 4.** One escape grammar for the shipped mechanism:
  the line `# getff-escape: a13 <reason>` inside the unwired `*.test.sh` itself; the detector reads a file
  carrying it as passing (S-13). No character floor (D27); an empty reason or a placeholder (`todo`,
  `tbd`, `later`, `fixme`, `n/a`, `none`, `-`, `.`) is rejected. The mechanism RECORDS that it has an
  escape: a constant in the script (`A13_ESCAPE='# getff-escape: a13'`) and a header comment line
  `# escape: recorded (D27)`. **Mapping of getff's `COVERAGE_ALLOWLIST`:** an entry `['<path>',
  '<rationale>']` (`41:86`) is the same decision as the line `# getff-escape: a13 <rationale>` in
  `<path>`. The allowlist is empty today (`41:86-91`), so getff carries no escape line and nothing
  migrates. If getff ever adds an allowlist entry, the same file carries the escape line too, or getff's
  own `getff-mechanism-a13` section blocks the push; principle 41 keeps its 20-char floor (`41:152`) as
  getff's own stricter internal rule. An escape inside the per-mechanism file is ruled out by S-12.
- **OPEN-3 — CLOSED:** `.getff/mechanisms/<name>.txt`, the same path in getff and at a consumer.
- **OPEN-4 — CLOSED:** the threshold is a constant in the getff-owned A13 script, never a `[params]`
  key: **3 escapes per 100 commits**. Reading used by this stage: with N = first-parent commits after the
  commit that first wrote the file, allowed = ceil(3 × N / 100); the check fails when escapes added > allowed.
  Boundaries: at N = 10, allowed = 1 (escape 1 passes, escape 2 fails); at N = 34, allowed = 2 (escapes
  1-2 pass, escape 3 fails). A rejected escape line (empty or placeholder reason) is not an escape: it is
  not counted, and the test it sits in stays a finding.
  `check` prints the count, N, allowed, the constant, and getff's measured ~1 per 500 (§1 fact 12).
- **OPEN-5 — CLOSED by E20** (option A; options B, `check-rule-globs.sh` on `*.ts|*.tsx`, and C, all
  250 tooling files, rejected). The lint half of base-core `:203` is a declared limit, its next arm named
  in the script (§1 fact 9).

## §2 Deliverables

All new shell is bash 3.2-safe (macOS consumers), `set -uo pipefail`, no new runtime dependency.

### §2.0 Mechanism contract (every slice-4 mechanism; later stages cite this subsection)

- **Script:** `packages/core/audit-self/getff-mechanism-<name>.sh`, delivered to
  `scripts/getff-mechanism-<name>.sh`. Line 1 `# getff-mechanism: <name> <version>`, line 2
  `# shellcheck shell=bash`, no shebang (S-15 «starts with»; always run as `bash <path>`). The header
  comment block says whether the mechanism records an escape (D27) and names its next arm, if any.
- **Call shape:** `bash <script> <mode> <its-file> [--rev <sha> | --worktree]` — the future constant
  record line of E3 (`<runner> <mechanism> <its-file>`) fits without change. Default input `--worktree`.
- **Modes:** `findings` prints every finding key, sorted, escaped ones excluded; `check` prints and exits
  1 on findings not in the listed set, on a shrink-only violation, on an unexplained `[params]` change, or
  (where the mechanism records an escape) on an escape count above its constant — else exit 0; `install`
  writes `<its-file>` once from `findings --worktree`.
- **Absent input surface** (E18 F1): when the surface a mechanism checks against does not exist at the
  project, `check` prints the population as a number and «<surface> — not checked», exits 0, and never
  prints a pass/OK line; the install report lists it as not checked (`note_not_wired`).
- **`--rev <sha>`:** every input is read from the revision — tracked files by `git ls-tree -r <sha>`, file
  contents and `<its-file>` itself by `git show <sha>:<path>`. `<its-file>` absent from the revision →
  `check` fails closed naming it (D19). A delete push (`git push origin --delete <b>`) has an all-zero
  `local_sha`: `mechanismSection` skips it with one named line before calling the script, as the
  docs-refresh section does (`pre-push.ts:1756-1759`, `c.rb.head === Z40`); the script given an all-zero
  `--rev` exits 2 naming it, never 0.
- **Finding key:** one line, no tab, stable across runs.
- **`<its-file>`:** `.getff/mechanisms/<name>.txt`, format of D1, consumer-owned once written.
- **Registration:** pre-push section `{ id: 'getff-mechanism-<name>', owner: 'both', run: (c) =>
  mechanismSection('<name>', c) },` on ONE line; `mechanismSection` derives the script path from the name
  alone (`packages/core/audit-self/…` when `ctx.isFrameworkRepo`, else `scripts/…`) and passes
  `check .getff/mechanisms/<name>.txt --rev <ctx.rb.head>`.
- **Helper:** D1, sourced from the script's own directory.

### Deliverables

- **D1 — per-mechanism file helper** `packages/core/audit-self/getff-mechanism-lib.sh` (sourced),
  delivered to `scripts/getff-mechanism-lib.sh`. Line 1 `# getff-mechanism: mechanism-lib <version>`,
  line 2 `# shellcheck shell=bash`. Functions (names yours; behaviour is the contract):
  - parse and validate: line 1 header; then `[params]` (`key = value`, `# reason: …`, blank lines); then
    one or more `[starting-list <version>]` sections, one finding key per line, sorted; any other line is
    an error naming its line number;
  - read one param; read the listed set (the union of every `[starting-list …]` section);
  - write once — refuses when the file exists (D23, D30, D10);
  - shrink-only check at a revision: for each `[starting-list <v>]` section, find the commit that first
    added that header (`git log --reverse` on the file); fail naming every member present at the revision
    and absent at that commit. A section in no commit yet is skipped with one printed line;
  - params-reason check (S-12 «each change carrying a `# reason:` line»): every `key = value` line of
    `[params]` at the revision that is not byte-present in the file's first commit must be directly
    preceded by `# reason: <text>`, the text neither empty nor a placeholder (§1.9 OPEN-2 list);
  - refresh append (S-13): no write when the header version equals the new one; else append
    `[starting-list <new>]` with the new version's findings listed in no older section and replace the
    header line — every other byte stays (assert with `cmp` of the prefix);
  - escape count (S-11): lines matching a pattern ADDED between a commit and a revision, from file diffs or
    from commit messages.
- **D2 — the A13 mechanism** per §2.0, `name = a13`, version `1`: principle 41's shape (§1 fact 6),
  generalised (E20).
  - `[params]` (E20 condition 1), each default with a `# reason:` line naming its source:
    `tooling_dirs = .claude/hooks .claude/skills scripts` (`22-internal-english.test.ts:61`),
    `test_pattern = *.test.sh` (`41:102`), `workflow_dir = .github/workflows` (`41:79`).
  - Population: tracked files under `tooling_dirs` whose basename matches `test_pattern`.
  - Registry: the `*.yml|*.yaml` files directly in `workflow_dir` (not recursive, `41:121-126`), at the
    same revision, every whole-line `#` comment cut (`41:127-129` — keep the cut, it is load-bearing).
  - Finding: a population path the registry text never contains (`41:133-135`); key = the repo-relative
    path. Fix hint in `check`: invoke the test from a workflow step, delete it, or add the escape line.
  - No `workflow_dir` at the project: the §2.0 absent-surface line, e.g.
    `a13: 3 tooling test files; no CI dir (.github/workflows) — not checked`.
  - Escape (§1.9 OPEN-2) and S-11 constant `3` per `100` (OPEN-4).
  - Header comment, E20 condition 3: `# next arm (not built): the lint half of base-core A13 — at getff
    .github/workflows/audit-self.yml:60 bash -n over every *.sh, and the shellcheck gate at :1178 over
    setup.d/*.sh + install.sh + scripts/*.sh; revisit when a second S row lands or the operator asks for
    the lint half.` (Line numbers as measured at `2855667cb34`, §1 fact 9.)
- **D3 — getff's own file** `.getff/mechanisms/a13.txt`, produced by running `install` on getff, never
  typed by hand. Expected `[starting-list 1]`: **0 lines** (§1 fact 7; D28 allows an empty list); if it is
  not empty, paste what it lists into the PR body and stop.
- **D4 — the pre-push section** per §2.0. Place `mechanismSection` after the function containing `:2516`
  (`invariantsRenderSection`, ends `:2532`), e.g. just before the registry comment, and the entry as the
  LAST element of `SECTIONS` (before `:2740` `];`) — no citation moves (§1 fact 14). Rebuild the bundle
  (`node scripts/build-runtime-bundles.mjs`). The bash fallback does not get the section — declared limit.
- **D5 — install and refresh delivery**, npm-stack lane only.
  - Install: copy D1 and D2 to `scripts/` beside `setup.d/40-configs.sh:20`; then, in a git repository, run
    `install` unless the file exists. Not a git repo → `note_not_wired` naming the mechanism. The
    per-mechanism file is consumer-owned from then on: never passed to `copy_safe` / `refresh_safe`, never
    in the R1 refresh baseline (proved in D7: two refreshes, file stays).
  - Refresh: add both pairs to the `do_refresh` pair list (`install.sh:1132-1148`) —
    `packages/core/audit-self/getff-mechanism-lib.sh:scripts/getff-mechanism-lib.sh` and the A13 pair — so
    `refresh-covers-full-delivery.test.sh` sees them. BEFORE that loop, the S-13 pass per mechanism:
    - file absent (first arrival through `--refresh`): run the package's script in `install` mode in a git
      repository; not a git repo → `note_not_wired`;
    - file present, new version equals its header: write nothing;
    - else run the consumer's current script (`findings`) and the package's new one; any finding the OLD
      script reports that no section lists → the S-13 stop: this mechanism only is skipped — its file is
      untouched and its script is NOT replaced (the loop skips its pair) — `note_not_wired` names the stop,
      and `--refresh` still delivers everything else and then exits non-zero;
    - else append the new section (D1).
  - Install report: one line per mechanism — name, version, population as a number, findings written, file
    path — plus the CI limit of §1 fact 3. No removal path is named (E4 condition 3).
  - The D8 switch: a test-only environment variable (e.g. `GETFF_TEST_SKIP_MECHANISMS=1`) that skips the
    install step, the S-13 pass and the two pairs. It is named only in the install code and the tests,
    never in a consumer-facing doc, README or install output.
- **D6 — escape and escape count.** The detector honours the escape line; `check` runs the S-11 count
  (D1) from the commit that first wrote the file to the revision and fails above ceil(3 × N / 100) with one
  message: raise mechanism a13 as a question to the project's owner. Shown working on `Prior-art: skipped`
  (spec S-11) by `tests/install-sh/mechanism-escape-count.test.sh`: a hermetic `mktemp -d` repo with a
  seeded run of commits carrying that trailer fires; one below the threshold does not. The measured run
  over getff's window is D9's `escapes` subcommand, expected `504` of `663` at `2855667cb34` (§1 fact 11;
  it moves with `staging`, record the numbers at your base).
- **D7 — the fixture project with history** (item 6): a sourced builder
  `tests/install-sh/lib/fixture-with-history.sh` that later mechanisms reuse: `git init` a `mktemp -d`,
  seed a minimal npm project (as `snapshot.sh:139-143`), commit the mechanism's OLD violations, run
  `install.sh ts-server --force < /dev/null`, commit the install, then commit the NEW violation. Seeds are
  callbacks per mechanism. The A13 test `tests/install-sh/mechanism-a13.test.sh` seeds, before install:
  two unwired `scripts/old-*.test.sh`, one `scripts/wired.test.sh` named in a project-owned
  `.github/workflows/own.yml`, one `tests/outside.test.sh` outside `tooling_dirs` (unwired), and one test
  named only in a workflow comment line. It asserts, each set derived from what the test seeded:
  - after install, exactly the two old ones and the comment-only one sit in `[starting-list 1]`
    (`tests/outside.test.sh` is not in the population); `check --rev HEAD` exits 0;
  - bad/good (E20 condition 2): commit a new unwired `scripts/new.test.sh` → `check` exits 1 naming exactly
    that path; commit a workflow step that runs it → `check` exits 0;
  - removing an old test and its list line passes; ADDING a line to `[starting-list 1]` in a later commit
    fails; a `[params]` change WITH a `# reason:` line passes, the same change WITHOUT one fails, and so
    does one whose reason is `todo`;
  - `check --rev` at a commit where `.getff/mechanisms/a13.txt` is absent fails closed;
  - the escape line passes a new unwired test; an empty and a placeholder reason fail and are not counted;
    both S-11 boundaries of §1.9 OPEN-4 (N = 10 and N = 34, the escape-adding commits counted in N) hold,
    the failing escape naming the S-11 message;
  - no CI dir: after install, `git rm -r .github/workflows/` and commit (install delivers `ci.yml` and
    `workflow-integrity.yml` there — `tests/install-sh/baselines/ts-server/greenfield.fingerprint`); then
    `check` prints the population number and «not checked», exits 0, and prints no pass line (E18 F1);
  - first arrival through `--refresh`: install, delete `.getff/mechanisms/a13.txt` and both
    `scripts/getff-mechanism-*.sh`, commit, `install.sh --refresh`; the file is written with the old
    violations and `check` exits 0;
  - refresh (S-13), with a throwaway copy of the package root whose A13 script is version `2` and also
    cuts an inline trailing comment (whitespace, `#`, to end of line) from every registry line, so a test
    named only after `#` on a `run:` line stops counting as wired (a seeded widening; never an edit of the
    real script). **A seeded widening must sit in a dimension no `[params]` key carries:** refresh keeps
    `[params]` byte-identical, so a widened `[params]` default is never read. Seed, before the refresh, a
    `scripts/inline.test.sh` named only as `run: echo ok  # scripts/inline.test.sh`: it lands in
    `[starting-list 2]` and does not block; a new test wired the same way after the refresh blocks; v1 run
    on the same tree reports neither (else the S-13 stop fires); `[starting-list 1]` and a project-edited
    `[params]` are byte-identical before/after; a second refresh at version `2` leaves the file
    byte-identical (`cmp`); a tree where the OLD version reports an unlisted finding takes the S-13 stop
    (file and old script unchanged, `--refresh` exit non-zero, other deliveries done); two refreshes in a
    row leave the file.
- **D8 — the marker check** (S-15) `tests/install-sh/mechanism-markers.test.sh`: install the same fixture
  twice, once with the D5 switch set; the population = fingerprint paths of the first install minus the
  second (the `compute_fingerprint` shape of `snapshot.sh`). Each member starts with
  `# getff-mechanism: <name> <version>` or sits under a fixed getff-owned directory (a list in the test;
  `.claude/hooks/getff-cards/` joins it in its own stage, §6). Registrations: the test reads `pre-push.ts`
  between `const SECTIONS` and its closing `];`, and for every entry line containing `mechanismSection('`
  asserts the same line carries `id: 'getff-mechanism-<name>'` with the same `<name>` (the one-line entry
  form of §2.0). Seeded negatives: the A13 script with line 1 stripped fails; a copy of `pre-push.ts` with
  the id changed fails. Plus: the install output names no uninstall or removal path for a mechanism.
- **D9 — the false-fire script** (S-10, item 4) `scripts/measure-false-fires.sh` (getff-internal, never
  shipped, never in CI — invariant 4):
  - `fires <mechanism-script> <its-file> [N=500]`: a FIRE = a finding key reported at first-parent commit C
    and not at C's first parent (what the push of C would have blocked, D23), both read with `--rev`. Output:
    `FIRE <sha> <key>` lines, `FIRES total=<n> commits=<N> window=<first>..<head>`, and the sample the cold
    agent reads — all fires when ≤ 20, else a uniform 20 drawn with a printed seed so a rerun draws the same
    set (S-10 falsifier);
  - `escapes '<escape ERE>' '<family ERE>' messages|files [N=500]`: `ESCAPES matched=<n> of=<m> commits=<N>
    window=<first>..<head>` (D6).
  Test `scripts/measure-false-fires.test.sh` over a `mktemp -d` repo with known fires and escapes. Run
  `fires` once on getff for A13 and paste the `FIRES` line into the PR body; expected `total=0` at
  `2855667cb34` (§1 fact 8) — at your base it is whatever the run says, and a zero count still ships the
  blocker (S-10: «gates nothing»). The classification run is the lead's (host).
- **D10 — CI wiring without shifting lines** (principle 41 + `meta-all-wired.test.sh`): chain the new
  tests onto an existing `run:` line nothing cites, e.g. `audit-self.yml:754` (`run: bash
  tests/install-sh/glm-onebutton.test.sh && bash tests/install-sh/mechanism-a13.test.sh && …`, precedent
  `:766`), and rename that step's `name:` line in place (`:753`) to name what the step now runs, e.g. «Run
  install-sh GLM one-button test + trigger-build S4.1 mechanism tests» — nothing cites `:753` (`git grep
  'audit-self\.yml:753'` at `2855667cb34`: 0 hits) and a rename moves no line. Insert no step line. Then
  `npx tsx scripts/check-line-citations.mjs --check --corpus` (the pre-push form, `pre-push.ts:1901-1902`)
  must be green; never run it with `--write` on `.claude/rules/*`.
- **D11 — SSOT row** in `docs/meta-factory/prior-art-evaluations.md` per §3, same commit as D1/D2, with
  `Verdict`, `Rationale`, `Trigger to revisit`.
- **D12 — baselines**: `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh`, commit the recaptured
  fingerprints. The diff of each of the 8 npm-stack baselines (§1 fact 5) adds the D5 paths
  (`scripts/getff-mechanism-lib.sh`, `scripts/getff-mechanism-a13.sh`, `.getff/mechanisms/a13.txt`) AND
  changes the `packages/core/hooks/pre-push.bundle.mjs` hash line (D4 rebuilt it); nothing else changes.

## §3 Prior-art consult (run by the kickoff author 2026-09-30; re-check, do not re-derive)

This stage IS a capability commit: new files ≥ 80 LOC under `packages/` (D1, D2).

- SSOT: **#248** («which files does the CI invocation list never select?» against a declared
  population, verdict ADAPT; principle 41 is its ADAPT, `41:54`) — the detector D2 generalises (E20). Nearest row for the starting list: **#276** (a recorded exception that stops being
  recorded once it stops being true; its survey names the «self-cleaning / unused-suppression baseline
  ratchet» shape — ruff `RUF100`, Android Lint baseline, ESLint `reportUnusedDisableDirectives` — verdict
  HYBRID).
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
- Verdict: **ADAPT the pattern, BUILD in bash.** ESLint's file is lint-only (for lint rules the list stays
  in the linter's own config, S-12 (2)) and is REWRITTEN by `--suppress-all` (D30: written once); Betterer
  adds a Node dependency and rewrites its results on improvement; Semgrep's baseline is stateless (no list
  is written or reported, which D23 requires) and brings a Python dependency. None has per-detector-version
  sections (S-13).
- Trailers:
  `Prior-art: prior-art-evaluations.md#248 (CI-invocation-list vs declared-population shape, ADAPT — A13 generalises principle 41 to consumer params, E20)`
  `Prior-art: prior-art-evaluations.md#276 (nearest row: recorded-exception ratchet family; this stage writes a once-only starting list with per-version sections)`
  `Prior-art: prior-art-evaluations.md#<new ID> (starting list of pre-existing violations: ESLint bulk suppressions, Betterer, Semgrep baseline — ADAPT the pattern, write-once and per-version sections)`.
  The new ID is the next free one at landing time (297 is the highest at `2855667cb34`; re-read before
  committing — IDs race between PRs).

## §4 Proof — RED first

- Write D7, D8, `mechanism-escape-count.test.sh` and `measure-false-fires.test.sh` before D1/D2/D5/D9
  exist; paste each failing run into the PR body; then GREEN.
- Every asserted finding set is derived in the test from the files it seeded, never typed from output.
- The bad/good proof (E20 condition 2) is D7's new-unwired-then-wired pair; getff's own list is empty, so
  the fixture carries the proof, not getff.
- The seeded widened version (D7) lives in a throwaway package copy; the real A13 script stays at `1`.
- getff first (item 8): D3's `check --rev HEAD` exits 0 on your branch and
  `PREPUSH_ONLY=getff-mechanism-a13 … < /dev/null` runs the section green, before any consumer claim.
- Host half (the lead's): the cold-agent classification of D9's sample (none if `total=0`) and the 20 %
  bar. Do not claim it.

## §5 Exit gates

```bash host-verify
bash tests/install-sh/mechanism-a13.test.sh
bash tests/install-sh/mechanism-markers.test.sh
bash tests/install-sh/mechanism-escape-count.test.sh
bash scripts/measure-false-fires.test.sh
bash scripts/measure-false-fires.sh fires packages/core/audit-self/getff-mechanism-a13.sh .getff/mechanisms/a13.txt 500
bash scripts/measure-false-fires.sh escapes '^Prior-art: skipped' '^Prior-art:' messages 500
bash packages/core/audit-self/getff-mechanism-a13.sh check .getff/mechanisms/a13.txt --rev HEAD
PREPUSH_ONLY=getff-mechanism-a13 npx tsx packages/core/hooks/pre-push.ts < /dev/null
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

- **Follow-on stages** — one kickoff each, authored after this stage lands, each reusing §2.0 and D1, D5,
  D7, D8, D9 (bindings from `_facts-2026-09-29-harvest-batch.md`, lines re-measured at `2855667cb34`):

  | Row | Stage (proposed slug) | Binding at `2855667cb34` | Size (facts, a judgment) |
  |---|---|---|---|
  | C9 | `trigger-build-s4b` | `22-internal-english.test.ts:61` directory list, `:31` `SKILL_BODY_RU_ALLOWLIST` (facts `:21`) | S |
  | A18 | `trigger-build-s4c` | `packages/core/hooks/checks/s17.ts:21` `DISCIPLINE_FILE_RE`; `discipline-self-check.yml:95` PR-body grammar (facts `:18`) | M |
  | C11 | `trigger-build-s4d` | `scripts/check-docs-refresh.mjs:25-26` `sources:` pages; `scripts/check-line-citations.mjs:425` `LIVE_AUTHORITY_MD` (facts cite `:372` at `26ccdc6b160`) (facts `:22`) | M |
  | D1 | `trigger-build-s4e` | `packages/core/hooks/checks/prior-art.ts:25` `SSOT_CITATION_RE`; capability triggers (facts `:24`) | M |
  | G5 | `trigger-build-s4f` | `46-git-env-inheritance-safety.test.ts:108`, `:123`; `packages/core/audit-self/hooks-tree-guard.ts` (facts `:29`) | M |
  | HO-6 | `trigger-build-s4g-cards-delivery` | installer step copying `.claude/hooks/getff-cards/` (and the plugin's `cards/`); 0 card files today (§1 fact 15) | — (a card delivery, not a harvested row) |

  Order per D20 (§0). **C9 shares A13's `22:61` binding:** A13 takes that directory list as the default
  of its own `tooling_dirs`, and C9 will take it as the default of the directories it scans — each in its
  own per-mechanism file (`.getff/mechanisms/a13.txt`, `.getff/mechanisms/c9.txt`), never one shared
  param (S-12 (2)); a project that edits one list does not move the other.
- **HO-6 is that follow-on stage, not this one.** The spec places it in slice 4 (hand-over row HO-6:
  «Slice 4 builds the installer step that copies `.claude/hooks/getff-cards/` [...]», met when a fresh
  install lists `.claude/hooks/getff-cards/<card>.md` in its fingerprint), but it is not one of slice 4's
  items 1-9 (the mechanism path); a card reminds and a mechanism blocks (D19), a different delivery with
  its own check; and its input does not exist yet (§1 fact 15; the same row: «Slice 2 may create card
  files in getff's own directory»). Registered in the table above so it is not forgotten (operator log
  entry 49). Base-core cards go to `getff-cards/`,
  never to the project's `.claude/rules/` (entry 49: «главное при реализации не перепутай!»).
- Any file under `.claude/rules/` or `.claude/settings.json` — no agent and no factory run commits there
  in this build (spec `[op V8]`); a change there is the lead's operator patch.
- `check-rule-globs.sh` — untouched by this stage (E20 rejected it as A13's vehicle, §1 fact 10).
- **Declared limits, each one line in the PR body:** the lint half of base-core A13, with its next arm
  named in the script (E20 condition 3, §1 fact 9); test kinds other than `test_pattern` (e.g. vitest
  files — principle 38's shape, not harvested here); CI (§1 fact 3); pre-commit and edit-time channels (§0
  item 9); the bash fallback (D4); the python / cargo / go lanes — their pre-push is
  `.getff/hooks/pre-push`, which runs no `pre-push.ts` section (`setup.d/45-python.sh:909`); a project
  with no workflow dir (the E18 F1 line, never green); **stale allowances** — a `[starting-list]` member
  whose test is now wired or deleted, or an escape line on a test that is now wired, stays until removed
  by hand: nothing reports it; **loosening through `[params]`** — pointing `workflow_dir` at a missing
  directory turns the check into «not checked» with exit 0, and narrowing `tooling_dirs` or `test_pattern`
  shrinks the population; the params-reason check only demands a `# reason:` line and S-11 counts neither.
  Per D27 the PR body asks the advisor whether S-11 should also count `[params]` edits.
- Retiring principle 41 in favour of the mechanism in getff — a separate decision (principle 41's own
  precedent for another owner's gate, `41:60-61`).
- P2's record line (E3 point 1) and any edit inside the P2 branch (§0 item 9).
- The getff-wide uninstall (D30 clause 3: NOT MET, deferred — spec §4, E4).

## §7 Falsifiers to write into the PR body

- The new unwired test passes on the fixture → the mechanism does not block (D19).
- The same test, once wired, still blocks → the registry read is wrong (E20 condition 2).
- An old violation blocks after install → the starting list was not written or not read (D23).
- A test outside `tooling_dirs` is reported → the population ignores `[params]` (E20 condition 1).
- A test named only in a workflow comment counts as wired → the `41:127-129` cut was lost.
- A project with no workflow dir gets a pass line → E18 F1's «never a green check» broke.
- A line added to `[starting-list 1]` in a later commit passes → shrink-only is not checked (D23).
- A `[params]` change without `# reason:` passes, or reads as a list change → S-12 (4) broke.
- `check --rev` at a revision without the file passes → it read the worktree, not the revision.
- A refresh with an unchanged version changes any byte → S-13 «writes nothing» broke.
- A refresh changes `[params]` or an older section → D5 / D10 broke.
- A refresh lists a finding the OLD version also reports → the old version was not blocking (S-13).
- The seeded widening is a `[params]` default → refresh keeps the old value and the proof goes vacuous.
- A rejected (placeholder) escape line is counted by S-11, or passes its test → OPEN-4 / D27 broke.
- A delete push is blocked, or the script exits 0 on an all-zero `--rev` → §2.0 `--rev` broke.
- A `--refresh` onto a project with no file writes nothing → first arrival through refresh is lost.
- The per-mechanism file is overwritten or removed by install or refresh → D10 broke.
- getff's own `[starting-list 1]` is not empty → the getff measurement (§1 fact 7) or the detector is wrong.
- The marker check stays green with the header stripped → `#hope-as-gate`.
- A slice-4 artefact appears in the with/without fingerprint diff unmarked, or exists outside it.
- The install report or any consumer doc names a removal path or the test-only switch.
- A rerun of D9 draws a different sample → S-10's falsifier.

## §8 Report

`Stat` / `Verify` (each §5 gate, the RED-then-GREEN runs, D9's `FIRES` and `ESCAPES` lines) /
`DECISIONS` (helper function names, the switch name, the refresh order, the fire definition if you changed
it) / `ATTN` (every declared limit of §6) / `Confidence`. The PR body carries `## Fidelity verdict` (the
lead adds it after the cold fidelity round on the host) and the §1.7 Forward-check / Backward-check sections.

## §9 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T2** run each test, do not describe what it would print · **T3**
command-or-`file:line` for every claim · **T6** confidence as predicates · **T10** enumerate the
fingerprint population before asserting the marker check covers it · **T14** a green fixture that never
seeds the refresh-falsifier tree is not coverage of S-13; a `total=0` replay is a count, not proof of
exactness — the fixture carries that · **T19** own cold review of the diff before handoff · **T21** cold
`agents/backward-sweep-auditor.md` on the class «an installer step that writes a consumer-owned file and a
refresh that must never overwrite it» — every `copy_safe` / `refresh_safe` caller and the R1 refresh
baseline are the candidates.

**T-TB4-A (domain):** the starting list is written from the tree at install, so a bug that makes the
detector report MORE lands silently in the list and turns a blocker into a pass for everything it
over-reports. Assert the written list against the seeded old violations exactly (set equality), never
«non-empty», and never regenerate a list to make a test pass — a list is written once (D30).
