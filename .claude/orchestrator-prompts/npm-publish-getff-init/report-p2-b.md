# P2-B report — core enforcement (`packages/core/principles` + `hooks` + `backends`)

> **Lane:** P2-B of [kickoff-p2.md](kickoff-p2.md). Read-and-report pass; no product code changed
> (the only working-tree edit during the pass was a mutation-test of `packages/core/vitest.config.ts`
> that was reverted byte-identically — evidence in §method-actually-run; plus one filesystem repair on
> this report file itself: the #1800 coordination layer swapped it for a symlink mid-session, restored
> to a real file so git carries content, not a link — central mirror re-synced at egress).
> **Head enumerated:** `c26593c90b` (`origin/staging`, 2026-09-15) — two first-parent commits past the
> kickoff's pin `08a95a6dea4`; the lane's file set differs from the pin by exactly one file
> (`packages/core/hooks/link-coordination.test.ts`, from #1800). 192 first-parent commits in
> `origin/main..origin/staging` (kickoff said 190 at its pin; the +2 are #1800/#1801, both
> non-product for this lane).

## §population-enumeration

Derived with `git diff --name-status origin/main...origin/staging -- packages/core/principles packages/core/hooks packages/core/backends`
at head `c26593c90b`:

- **64 files** (12 `A`, 52 `M`), **+12102 / −976** — kickoff's pinned estimate was 63 / +11947 / −976;
  the drift is the one file #1800 added, stated above.
- By area: `principles/` 16 (5 A), `hooks/` 43 (6 A), `backends/` 5 (0 A).
- Production (non-test) files carrying behavioural claims: 17 of the 64 —
  `principles/20-bundle-classification.ts` (A), `45-prepush-contract-claim-liveness.ts` (A),
  `46-git-env-inheritance-safety.ts` (A), `31-rule-channel-declaration.ts`, `33-adapter-jig-arm-registry.ts`,
  `backends/golangci/firing-runner.ts`, `backends/shared/json-array-parse.ts`,
  `hooks/checks/{cmd-script-liveness,pr-body-fidelity,pr-body-prior-art-bin,prior-art,s17,unpinned-tool-install}.ts`,
  `hooks/deps-hash-check.sh`, `hooks/pre-push.ts`, `hooks/utils/{git,run-check}.ts`.
- The other 47 are tests (45 `.test.ts`) + 2 fixtures (`__fixtures__/gate-unarmed-goldens.json` (A),
  `principles/fixtures/rule-channel/settings-partition-covered.json` (A)).
- 61 of the 192 delta commits touch the lane (dated 2026-09-05 → 09-15); sampling below spans that
  window end to end (T9), not the recent end.
- No renames detected (`git diff --name-status -M` reports no `R` rows in the lane).

## §method-actually-run

**Host-verify fence (§9):**

```console
$ node --version && npx vitest --version && git --version
v22.23.2
vitest/5.0.0 linux-x64 node-v22.23.2        # npx cache copy — see env note below
git version 2.39.5
```

**Environment disclosures (they shape everything below):**

1. The worktree arrived with no `node_modules`; provisioned via the SSOT
   `bash scripts/worktree-node-modules.sh <dir>` → symlink to the primary checkout's install.
   That install is **arm64-only** (only `@rolldown/binding-linux-arm64-*`, `@esbuild/linux-arm64`)
   while this host is **x64** — the repo's own `npx vitest` startup-dies on the missing
   `@rolldown/binding-linux-x64-gnu`.
2. Workaround used for every run below: the repo's own vitest **4.1.8** (JS is arch-neutral) invoked
   as `NODE_PATH=/tmp/p2b-x64/node_modules node node_modules/vitest/vitest.mjs …`, where
   `/tmp/p2b-x64` holds exactly two x64 native-binding packages (`@rolldown/binding-linux-x64-gnu@1.0.3`,
   `@esbuild/linux-x64@0.28.1`, versions matched to the primary's). No repo file changed.
3. `--reporter=basic` (the kickoff's §5 spelling) does not exist in vitest 4.1.8 — vitest treats it
   as a custom reporter module path and dies (`Failed to load url basic`). The repo's own canonical
   spelling (`packages/core/package.json`: `vitest run --reporter=default`) was used instead.

**§5 suite gate** — all 45 lane-changed test files in one run:

```console
$ NODE_PATH=/tmp/p2b-x64/node_modules node node_modules/vitest/vitest.mjs run --reporter=default <45 files>
 Test Files  5 failed | 40 passed (45)
      Tests  56 failed | 1269 passed | 8 skipped (1333)
```

Every RED was then discriminated env-vs-delta (the T-P2-A counter-observation — not a re-read):

| RED file (fails) | Discriminator run | Verdict on the RED |
|---|---|---|
| `principles/24-plugin-manifest-integrity.test.ts` (0 tests — collection error `Cannot find module 'js-yaml'`) | Same file at `origin/main` in a scratch worktree with identical node_modules links → **fails identically** (`:40` there). Cause: the primary's `packages/core/node_modules/js-yaml/` is an **empty directory** with npm's staging dir `.js-yaml-IdVortdt` beside it (broken shared install, 2026-09-11). | **Pre-existing env**, not the delta |
| `hooks/pre-push.consumer-layout.test.ts` (33) | At `origin/main` same env → 27 fail (the other 6 are tests that did not exist at main). Error text: `You installed esbuild for another platform… "@esbuild/linux-arm64" is present but this platform needs "@esbuild/linux-x64"`. | **Pre-existing env** (arch-broken shared install) |
| `hooks/end-of-turn-reminder.test.ts` (21) | At `origin/main` same env → **passes** (file-level). Hand-repro of fixture `f1-armed-no-handoff` with `env -i` → correct block JSON; same fixture + `CLAUDE_CODE_ENTRYPOINT=sdk-ts` → **empty stdout, exit 0** (the hook's SDK guard at `.claude/hooks/end-of-turn-reminder.sh:89-90`, #1693). Rerun with `env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE -u CLAUDE_CODE_CHILD_SESSION -u CLAUDE_CODE_SESSION_ID` → **file fully passes** (140/140 non-skipped). | **Delta × env interaction — real finding** (see §findings F1) |
| `hooks/precompact-residue.test.ts` (3) | Same stripped-env rerun → **fully passes**. The 3 failures are END-TO-END arms that spawn the same Stop hook. | Same cause as F1 |
| `principles/46-git-env-inheritance-safety.test.ts` (arm B only) | `git rev-parse --local-env-vars` on this host (git **2.39.5**) prints `GIT_INTERNAL_SUPER_PREFIX`, which the git-2.53.0-derived `GIT_REPO_LOCAL_ENV` table lacks → arm (B) RED, message `add it to GIT_REPO_LOCAL_ENV`. | **New gate × git-version floor — real finding** (see §findings F2) |

Post-fix confirmation run (SDK vars stripped from the invoking env, nothing else changed):

```console
$ env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE -u CLAUDE_CODE_CHILD_SESSION -u CLAUDE_CODE_SESSION_ID \
    NODE_PATH=/tmp/p2b-x64/node_modules node node_modules/vitest/vitest.mjs run --reporter=default \
    packages/core/hooks/end-of-turn-reminder.test.ts packages/core/hooks/precompact-residue.test.ts packages/core/hooks/pre-push.consumer-layout.test.ts
 Test Files  1 failed | 2 passed (3)      # the 1 = consumer-layout, arch-broken esbuild (env)
      Tests  33 failed | 177 passed | 4 skipped (214)
```

**Mutation falsifier for #1795's gate (kickoff §4 pre-decided obligation).** Verified on all three
axes a falsifier can move:

- **(D) damage arm** — green in the suite run: the negative half builds a decoy repo + linked
  worktree, plants `GIT_DIR` on a child env, and observes `core.bare` flip to `true` and nothing
  created at the target path; the scrubbed twin stays `false`. Live-reproduced by hand too (§method
  above shows the hook path; the arm itself passed in-gate).
- **(B) table-gap arm** — nature ran the mutation: this host's older git prints one extra name
  (`GIT_INTERNAL_SUPER_PREFIX`) and the arm goes RED (output above). A real gap → RED, not vacuous.
- **(C) registration arm** — hand-run mutation: comment out `setupFiles` in
  `packages/core/vitest.config.ts` →

  ```console
  $ … vitest.mjs run packages/core/principles/46-git-env-inheritance-safety.test.ts packages/core/hooks/env-hermeticity.test.ts
       × BOTH vitest configs register the setup file   (env-hermeticity.test.ts)
       × (C) both vitest configs register the setup file that performs the scrub
    Test Files  2 failed (2) | Tests  3 failed | 17 passed (20)
  ```

  File restored byte-identically (`git diff --stat` empty; working tree clean after).

**Population recount for principle 46's header claims:** `git grep -c -I --fixed-strings 'git init'`
over the module's own pathspecs at head → **18 files, 60 sites** (header says 59/18 at authoring;
arm (A) is a floor `>10`, not a freeze, and arm (F) — every site covered — is **green** at head).

**Reads**: delta hunks + whole files across the lane — four completed read-only cluster reads
(principles / prior-art gates / hook channels / backends+new-tests), each spanning the 2026-09-05→09-15
commit window. Their runners deviated from mine by necessity (the kickoff's `npx vitest@4.1.8` form
crashes in this checkout — disclosures 1-2): one cluster installed vitest **4.1.8** standalone under
`/tmp`, two used the npx cache's **5.0.0**. Every file run by both them and me agreed across all three
builds, so the version drift moved nothing. Load-bearing rows they surfaced were re-verified by command
in this session before entering §findings — the F3/F4 quotes below are mine, not theirs.

## §findings

(verdict grammar: `TRUE` / `CODE-LIES` / `BROKEN` / `INCONCLUSIVE-needs-human`; every row carries the
falsifier output or `path:NN` with the line's content, and the one doc-sentence line the docs rewrite
should take from it.)

### F1 — `CODE-LIES` — the hermeticity gate's own table mis-states the D13 fixtures' env pinning

- **Asserting text** — `packages/core/hooks/env-hermeticity.test.ts:51-52` (ADDED in this delta, #1689):

  > `CLAUDE_CODE_ENTRYPOINT:` / `'process-structural; end-of-turn-reminder tests pin it per case',`

  and the same entry's long comment: "tested with the value pinned per case and a `cli` default in its
  runHook, so the host's value never reaches a decision".
- **Observed behaviour** — that is true for the recap-family tests (`end-of-turn-reminder.test.ts:149`,
  `runHook` pins `CLAUDE_CODE_ENTRYPOINT: 'cli'`) but **false for the D13 handoff-gate fixture family
  added by #1680/#1740/#1749/#1783**: `buildCase` (`end-of-turn-reminder.test.ts:2540`) spreads
  `...process.env` with no ENTRYPOINT pin, and `spawnCase` (`:2567`) hands it to the hook, whose SDK
  guard (`.claude/hooks/end-of-turn-reminder.sh:89-90`, #1693) `exit 0`s silently for `sdk-*`.
- **Falsifier (ran, quoted)** — from an SDK-launched session (`CLAUDE_CODE_ENTRYPOINT=sdk-ts` in the
  ambient env): 21 tests RED with `SyntaxError: Unexpected end of JSON input` (hook printed nothing);
  identical fixture run by hand with `env -i` produces the expected `decision:block` JSON; rerun with
  `env -u CLAUDE_CODE_ENTRYPOINT -u CLAUDECODE -u CLAUDE_CODE_CHILD_SESSION -u CLAUDE_CODE_SESSION_ID`
  → the whole file passes (all output in §method-actually-run). Sibling sweep by predicate
  (§3 step 6): 4 test files spread `...process.env` into spawns of these hooks —
  `end-of-turn-reminder` (affected), `precompact-residue` (affected, same run), `env-hermeticity`
  itself (green in-gate), `inject-handoff-on-compact` (green in-gate; its hook reads no SDK var).
- **Consumer reach** — the aif-handoff worker pattern IS an SDK session, so the exact lane this repo
  dispatches to gets ~21 false REDs per hooks-suite run. Fail-closed direction (loud, no corruption),
  so not STOP-grade.
- **Doc sentence:** the hooks suites are hermetic only for the names classified in
  `packages/core/vitest.host-env.ts`; `CLAUDE_CODE_ENTRYPOINT` is inherited by design and pinned by
  the recap tests, but the D13 handoff-gate fixtures do not pin it — run them from an SDK-launched
  session and the SDK guard silences the hook (21 false REDs); the fix is one pin in `buildCase`
  (or scrubbing the name and pinning `cli` where the recap tests need it).

### F2 — `TRUE` with a doc gap — principle 46's scrub-gap arm fails CLOSED on git < ~2.41, and no doc says so

- **Claim** — `packages/core/principles/46-git-env-inheritance-safety.ts:116-127` derives the
  repository-local family from the *running* git "rather than trusting a checked-in list"; arm (B)
  (`46-…test.ts:114-124`) asserts zero gaps between that derivation and `GIT_REPO_LOCAL_ENV`
  (`packages/core/vitest.host-env.ts:77`, a verbatim git-2.53.0 list of 15 names).
- **Falsifier (ran, quoted)** — on this host's git **2.39.5**: `git rev-parse --local-env-vars`
  prints 16 names; the 16th is `GIT_INTERNAL_SUPER_PREFIX`, absent from the 15-name table
  (reverse direction empty). Arm (B) goes RED: `expected [ 'GIT_INTERNAL_SUPER_PREFIX' ] to deeply
  equal []` — loud, with an actionable message naming the file to edit. The gate did exactly its job
  (caught a real divergence rather than passing vacuously) — hence `TRUE`, not CODE-LIES.
- **The gap** — nothing in the delta (module header, test, or docs) records a git-version floor, and
  the assertion message reads "a git release **added** a repository-local variable", which is inverted
  for the old-git direction (an older git prints a name the newer-derived table dropped). Debian-12-class
  dev environments ship 2.39.x and will hit this on `pre-push`'s principles section.
- **Doc sentence:** principle 46 (and the pre-push principles section) needs git whose
  `--local-env-vars` output matches the 2.53-era list — on older gits (2.39 measured) it fails closed
  naming the missing name; treat `GIT_INTERNAL_SUPER_PREFIX`-class failures as a version floor, not a
  defect. Exact floor version: `INCONCLUSIVE-needs-human` (would settle it: run
  `git rev-parse --local-env-vars` across 2.40-2.52).

### F3 — `CODE-LIES` (doc side) — `ci-tool-pinning.md` still defines an npm pin as «`@` present»; the #1659 gate requires a semver-shaped token

- **Asserting text** — `.claude/rules/ci-tool-pinning.md:62`: `Already-pinned installs: `==` present
  for pip; `@` present for npm global`.
- **Observed behaviour** — `packages/core/hooks/checks/unpinned-tool-install.ts:141` (quoted this session):
  `if (/@[\^~>=]*\d/.test(rawLine.replace(/@[\w.-]+\//g, ''))) return null;` — a pin is `@` + optional
  range operator + **a digit**. A bare dist-tag is flagged: paired tests at
  `packages/core/hooks/unpinned-tool-install.test.ts:361-392` (`zizmor@latest`, `@ast-grep/cli@next` →
  flagged; `# ci-tool-pin: allow` still exempts), suite 42/42 green. The delta edited this very rule file
  (re-pointing two `audit-self.yml` citations) without repairing :62 — drift is delta-adjacent, not ancient.
- **Doc sentence:** already-pinned npm globals need a semver-shaped `@<ver>` token; a dist-tag is unpinned
  unless it carries `# ci-tool-pin: allow`.

### F4 — `CODE-LIES` (minor, prose-wider-than-enforcement, two sites) — CLAUDE.md's carve-out and referent nouns outrun the regexes implementing them

- **Asserting text** — `CLAUDE.md:38`: «a `*.test.*` / `*.spec.*` file, or any file under a `test(s)/`,
  `__tests__/` or `*fixtures/` directory»; `CLAUDE.md:50-52`: «an **artefact path** —
  `setup.d/lib.sh:359`, `research-patches/2026-05-23-guard-liveness-gate.md §2`».
- **Observed behaviour** (both sites quoted this session) — `packages/core/hooks/checks/prior-art.ts:260-261`
  `TEST_FILE_RE = /(?:^|\/)(?:tests?|__tests__|__fixtures__|[\w.-]*fixtures)\/|\.(?:test|spec)\.(?:[cm]?[jt]sx?|sh|mjs)$/`
  whitelists only `ts/tsx/js/jsx/cjs/mjs/sh` — a 100-line `foo.test.py` under `packages/` still trips the
  ≥80-LOC arm. `prior-art.ts:155-156` `REFERENT_RE` requires a whitelisted extension
  (`tsx?|[cm]?js|sh|md|markdown|json|ya?ml|py|rs|toml`) — an extension-less artefact pointer is rejected
  as referent-free. Both prose examples pass (their extensions are listed); the general nouns promise more
  than the code enforces, and the prose-sync arm (`prior-art.test.ts:1556-1559`) checks word presence, not
  extension clauses, so it cannot catch this class.
- **Doc sentence:** narrow CLAUDE.md's two nouns — test/spec files *of the listed JS/TS/sh extensions*,
  artefact paths *carrying one of the whitelisted extensions*.

### Lane-brief corrections (T-P2-B: «in delta ≠ new»)

- `backends/shared/json-array-parse.ts` **predates the delta** — `git show origin/main:…` has the file
  with `getByJsonPath` (itself copied from cargo's private helper per its own header); the delta only adds
  the optional `containerPath` (+18/−0). Not a relocation by this delta, not a new capability; 13/13 green
  incl. the containerPath describe pinning both the new shape and unchanged bare-array behaviour.
- The brief's attribution of #1667 to `backends/golangci/firing-runner.ts` is wrong: #1667 touches
  `packages/core/synthesizer/run-rule-tests-firing.{sh,test.sh}` (outside lane paths); the firing-runner
  change was #1656 (R-4). Both verified anyway — #1656 in the table below; #1667 static-read (old vs new
  verdict logic quoted: structured-diagnostic «fired» decisions, ruff `code: null` → «sample invalid»,
  the `_ndjson_has_codeless_error` sentinel and its `ca-e` regression arm) — run-blocked per §inconclusive 7.

### Cluster-verified rows — verdict `TRUE`; «green» = the §5 invocation (or the cluster's equivalent run)

**Principles cluster (vitest 4.1.8):**

| File (#) | Load-bearing claim | Falsifier |
|---|---|---|
| `principles/45-prepush-contract-claim-liveness` (#1784/#1789/#1790) | doc claims resolve against the LIVE `composeSections(SECTIONS,…)` registry; population by predicate `':(glob)*.md'` + git-derived shipped surface (the #1784 original was 5 hand-picked root files — `git show 9f39013c1a`) | 16/16 green; live run: 188 files / 133 claims / 12 quarantined all held / 0 blocking / 0 stale; N45-1 feeds the exact #129-shape sentence → exactly 3 violations |
| `principles/20-bundle-classification.ts` (#1648) | memoised runner extraction, cache keyed `(helper, backlog)` so a mutated helper copy never sees pristine output; the tested shell helper is unchanged in the delta | 16/16 + 6/6 paired-negative green |
| `principles/31-rule-channel-declaration` (#1777) | residency partition (no `paths:` ∧ ¬ALWAYS_ON_CORE ⇒ `claudeMdExcludes` match required); ceiling throws >4 **at module load** plus an exact 3-name membership pin | 39/39 green; live split 19 + 2 + 8 = 29 enumerated, leftover 0; N31-7: same fixture delivery-green / residency-RED |
| `principles/33-adapter-jig-arm-registry` (#1635) | `<id>:<kind>` slot parity, both directions; markers comment-initial + canonically slugged + registry-referenced (≤2 dated exemptions, staleness-checked); git failure throws, never walks | 28/28 green; live: 400 suites / 91 markers / 44 = 44 slots / 0 violations / 0 stale |
| `principles/11-build-first-reuse-default.test.ts` (#1779/#1621) | population = `git ls-files` tracked set (`:181`); untracked build residue excluded, with the paired positive (same paths enter once committed) | 22/22 green |

**Prior-art / citation-gates cluster:**

| File (#) | Load-bearing claim | Falsifier |
|---|---|---|
| `checks/prior-art.ts` (#1652 carve-out) | test material + principles-direct exception wired into both LOC arms (`:302-305`, `:312`, `:330`) | 9-path parameterised exempt + paired negatives (test+production still trips; `test-utils.ts` not exempt) green; extension drift → F4 |
| `checks/prior-art.ts` (referent grammar) | referent-free positive → code 1 «names no resolvable referent» (`:451-459`) | the vacuity probe is literally `Prior-art: consulted — no entry applies` (`:1473`) → code 1, green |
| `checks/prior-art.ts` C2 (#1792) | renumbered SSOT id under a trailer fails the push (code 4), wired `pre-push.ts:392-394` → exit 1 | paired pos/neg green; **live instance re-verified this session**: squash `2c09e3a2ca` carries `Prior-art: prior-art-evaluations.md#276 (BUILD the reverse-index scoping — lychee…)` while today's row 276 is principle-45's (the lychee row shifted to 277). Push-ranged arm cannot see already-landed trailers — doc sentence: renumber hygiene needs append-only ids or a periodic staging-wide sweep |
| `checks/prior-art.ts` + `utils/git.ts` (#1616 B-1/A4-6) | byte-identical carve-out asks the **pre-image** tree (parent `git.ts:239` / merge-base `:302`, exact hash match); a one-line overrides block cannot swallow later deps (`braceDelta` counts brackets outside string literals) | twins-in-same-commit still detected (`:429`); dep-after-one-line-overrides detected (`:178`) — green |
| `checks/pr-body-prior-art-bin.ts` (#1655, A4-4) | PR body read as GitHub renders it: `stripComments` a REQUIRED positional (`:544-548`), the bin passes `stripHtmlComments` (`:23-28`); failure hint names all three referent forms, mirrored `CONTRIBUTING.md:199-229` | trailer inside an HTML comment FAILS (`:150`) — 18/18 green; sync tests pin hint + CONTRIBUTING mirror |
| `checks/pr-body-fidelity.ts` (A4-3/A4-5/R-8) | numbered-list + table-row `## Review findings` entries gated (`FINDING_GRADE_RE :75`); `- GRADE: none` = zero tally (`:88`); ONE exported `FILE_LINE_RE` | grep this session: exactly one definition (`checks/s17.ts:42`); 59/59 green incl. corpus boundary tests |
| `checks/s17.ts` + `scripts/check-line-citations.mjs` (#1747/#1772) | drift gate scoped by CITED-or-CITING file; blank-landing arm unconditional; omitted `--affected-by` fails OPEN into a full sweep | **static read** (shell harness writes scratch repos — §inconclusive 7): `mjs:482-488` + `expect_fail`/`expect_pass` pairs at `test.sh:259-285`; vitest side 75/75 green |

**Hook-channels cluster:**

| File (#) | Load-bearing claim | Falsifier |
|---|---|---|
| `hooks/pre-push.ts` (#1630/#1634/#1652/#1772/#1792) | shipped-rule drift gate scoped `ACMRD` incl. deletions (`:1349-1361`); consumer-layout lychee exclusions = delivery manifest + enumerated destinations + named skill slugs, never a `.claude/` subtree; classifier `.ai-factory` rows gated in BOTH directions; `envWarnOnly` affirmative-values-only (`:327-333`); zizmor population via `git ls-files`, `die` on null | `pre-push.test.ts` 24/24 green incl. F-1 paired negatives; **live this session**: `PREPUSH_ONLY=ask-file-scheme-bogus` → loud exit naming all 28 section ids |
| `hooks/utils/run-check.ts` (#1797) | win32-only npm/npx rewrite to `node <execDir>/node_modules/npm/bin/<tool>-cli.js`; `shell:true` deliberately refused; argv stays an array (`'a branch & echo pwned'` = one entry) | 20/20 green incl. platform-injected wiring test; real-Windows spawn → §inconclusive 4 |
| `.claude/hooks/end-of-turn-reminder.sh` (#1783 D38) | per-Stop turn key (sha256 of the transcript's last assistant record) makes the doubly-registered Stop hook idempotent while a genuinely new turn with a stale handoff still blocks | fixtures 19a/19b (twin silent + baseline advanced / new turn blocks BOTH copies) — 140/140 green post-env-strip; cluster **independently converged on F1** |
| `hooks/deps-hash-check.sh` (#1635 F-4) | 60 s memo keyed on manifest `cksum` (+ Cargo.lock for the workspace-root blindness), fail-open | 43/43 green incl. warm-memo-silent / in-TTL-edit-warns pair; header's «3-way byte-identical» vs the 2-way test guard is pre-existing wording (plugin twin legitimately differs by its AUTO-GENERATED header) |
| `checks/cmd-script-liveness.ts` (#1782) | artefacts resolved from **tracked** files only (`git ls-files`, empty-on-failure — never a walk); ambiguous basename fails naming every candidate | 39/39 green incl. untracked-shadow negatives + the same-path-resolves-once-tracked control |
| `checks/unpinned-tool-install.ts` (#1659 A4-7) | dist-tag npm globals are unpinned | 42/42 green — the doc drift is **F3** |
| `plugin/hooks/check-doc-authority-header` (#1727) | zcode row-3 twin exists + registered (`plugin/hooks/hooks.json`) | twin + registration verified by read; ZCode-runtime emission → §inconclusive 6 |

**Backends + new-tests cluster:**

| File (#) | Load-bearing claim | Falsifier |
|---|---|---|
| `backends/golangci/firing-runner.ts` (#1656 R-4) | delegates to the shared parser via `containerPath: '$.Issues'` (`:96-98`); bare-array pin documents why the hop exists; live-fire loud-skips without the binary | 35 passed \| 3 skipped (binary absent — §inconclusive 5) |
| `backends/shared/no-stray-hoist-markers.test.ts` (#1791) | population `git ls-files -z -- cargo npm` with a loud throw on git failure (pre-image: exclusion-free walk + a tautological `includes()` «negative») | tracked/untracked twin pair — tracked marked file → `['cargo/stray.ts']`, byte-identical untracked → `[]` — green |
| `hooks/env-hermeticity.test.ts` (#1689) | scrub tables match what shipped hook trees read; BOTH vitest configs register the setup file; every `${VAR:-…}` knob classified | 5/5 green — and its own `vitest.host-env.ts:51` entry is exactly what **F1** falsifies (cluster converged independently: 19 RED → 140/140 green on `env -u`) |
| `hooks/hook-emit-prelude.test.ts` (#1628) | one emit-prelude definition; byte-identical plugin twins; escaper JSON-valid on TAB/CR | includes a **RED control** rebuilding the pre-R-2 escaper, asserted to emit invalid JSON — green |
| `hooks/inject-handoff-on-compact.test.ts` (#1680 D13/D20) | compact injector re-delivers the handoff; silent exit 0 on every failure mode | paired negatives per failure mode — green |
| `hooks/lang-parity.test.ts` | parity checker actually invoked somewhere; en/ru key parity, drift always carries a diagnostic | seeded one-pack key drop → exit 1 `DRIFT: en.sh and ru.sh key sets differ` — green |
| `hooks/zcode-runtime-probe.test.ts` (#1709) | bundle-as-oracle; absent bundle → loud SKIP | N1 synthetic 7-event bundle without trust markers → exit 1 DRIFT — green |
| 18 modified test files | per-arm claims: twin-Stop fixture (`:834-852`), GAP-2 plugin registration, k1-k5 root carry-over families (#1800), P1/P1z failure envelopes, T-3 tmpdir `finally` cleanup, SLOW_SHELL_MS budget | all green post-env-strip; SLOW_SHELL_MS names date + sibling measurements but **not the machine identity** — machine-of-record partial |

## §coverage

Fractions per T6 (no bare "high"):

- **Suite execution:** 45/45 lane test files executed in the §5 gate; ~24 of them re-run by clusters
  under two other vitest builds (4.1.8 standalone, 5.0.0 npx-cache) — zero result disagreements across
  builds. Host-green **42/45** after the SDK-env strip; **1/45** RED-by-design (`principles/46` arm B —
  finding F2: the gate failing closed on git 2.39.5); **2/45** blocked by the arch-broken shared install
  (`24-plugin-manifest-integrity`, `pre-push.consumer-layout` — both CI-covered at
  `.github/workflows/audit-self.yml:276` `test:principles` and `:481` `test:hooks`).
- **Deep read:** 64/64 files delta-read. Production 17/17 (12 whole-file, 5 full-diff + targeted
  regions — `prior-art.ts` 601/601, `deps-hash-check.sh` 373/373, `pre-push.ts` full 1052-line diff +
  ~950 current lines, `pr-body-fidelity.ts` 237/237, `s17.ts` 152/152); tests 45/45 at delta-hunk level
  or better; fixtures 2/2 with consumers traced (`settings-partition-covered.json` →
  `31-rule-channel-declaration.test.ts:43`, `gate-unarmed-goldens.json` → D13 fixture 9).
- **Claims:** ~55 derived claims across the four clusters; ≈4 of 5 run-backed (green suite or live
  command in this session); the remainder are static-read and marked as such in the tables
  (`check-line-citations.mjs` shell harness, #1667 firing.sh, ZCode twin runtime, real-Windows spawn).
- **Calibration:** first run of this method on this lane; treat the un-run `TRUE` rows with a ≥20%
  false-positive expectation until a second pass.

## §self-application

This audit's own traps, audited (T15):

- **T10 on itself** — the 64-file population was enumerated and written into §population-enumeration
  BEFORE any finding was drafted (git log of this report file shows §population first); the
  pin-vs-head drift (63→64 files) was explained by command, not waved through.
- **T-P2-A on itself** — the audit's own first suite-gate run produced 56 REDs, and the tempting
  shortcut was "the delta broke 5 suites". The audit instead ran the discriminating observations
  (main-replay in an identical env; hand-repro with `env -i`; var-stripped rerun; mutation test) and
  reduced 56 REDs to 2 real findings + 3 env classes. The finding F1 was found *because* the audit
  noticed its own session was the variable — the audit ran on itself before it ran on the code.
- **Honest limit** — the four cluster reads were delegated to read-only sub-agents; their `TRUE` rows
  rest on their quoted evidence, which I re-verified only where a row was load-bearing (F1, F2, F3, F4 —
  each quote in §findings is my own command output, not a cluster's). Rows marked "static read" were not
  independently re-run. Auditing this audit would mean re-running those rows' falsifiers cold.
  Corroboration note: two of the four clusters converged on F1 **independently**, from their own RED
  runs, before this report's draft reached them as context — the finding survives the coldest read
  this pass has.

## §inconclusive

1. **`pre-push.consumer-layout.test.ts` behaviour truth** — 33/42 RED on this host (arch-broken
   esbuild in the shared install; 27 reproduce at `origin/main`). What would settle it: a run on a
   correctly-provisioned x64 checkout (`npm ci` fresh), or trusting CI green at
   `.github/workflows/audit-self.yml:481`. The delta's 6 new arms in it are CI-green but were never
   behaviour-verified in this session.
2. **`24-plugin-manifest-integrity.test.ts`** — collection error (empty `js-yaml` in the shared
   install). Same settling route. Its delta hunks were read (cluster 1) but the suite never ran here.
3. **Exact git floor for principle 46 arm (B)** (F2) — needs `git rev-parse --local-env-vars` probed
   across git 2.40→2.52 to name the release that dropped `GIT_INTERNAL_SUPER_PREFIX`.
4. **Windows-spawn claim (#1797)** and any `win32`-conditional branches — not exercisable on this
   linux host; static-read verdicts only (cluster 3). Would be settled by the Windows consumer-matrix
   cell #1796 added.
5. **Live `golangci-lint` firing** — suite self-reports SKIPPED (binary not on PATH; stderr quoted in
   the gate log); fixture-drift arm still gated green. Needs the pinned binary installed to
   live-verify.
6. **ZCode-runtime emission paths of `plugin/hooks/check-doc-authority-header` (#1727)** —
   bundle-inspection claims (`:100-105` schema-bound `additionalContext`); needs the ZCode bundle
   present. Registration + twin structure verified by read.
7. **Shell-harness sub-suites that write scratch git repos** — `tests/hooks/prior-art-trailer-hook.test.sh`,
   `scripts/check-line-citations.test.sh`, and #1667's `run-rule-tests-firing.test.sh`: not executed
   under this pass's read-only mandate; their unit-level equivalents ran green. The #1747/#1772 and
   #1616-B-1 verdicts therefore rest on script + test source reads (quoted) plus the green vitest arms.

## Verdict

**GO-WITH-NOTES.** No `BROKEN` anywhere in the lane. F1 is real and consumer-reaching — the repo's own
aif-handoff worker pattern (an SDK session) gets ~21+3 false REDs per hooks-suite run — but it fails
closed (loud, no corruption) and the fix is one env pin wide. F2-F4 are documentation drift: an
undocumented git floor with an inverted assertion message, a stale rule-file line after #1659, and two
CLAUDE.md nouns wider than their regexes. The #1795 falsifier obligation is discharged on all three
axes (arm D green live, arm B RED via the natural version-gap mutation, arm C mutation-proven and
restored). Everything else the lane claims, its tests demonstrate green — 42/45 on this host, the
remainder CI-covered. Fixes belong to an I-phase follow-up, not to this report.
