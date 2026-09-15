# P2-C report — core rest + presets (code-truth pass, promote #4 delta)

> **Lane:** `packages/core` minus `principles/hooks/backends`, `packages/preset-*`, `packages/lint-config`, `packages/meta-factory`.
> **Delta:** `origin/main..origin/staging` @ `c26593c90b`. **Population:** 47 files, +1815 −344 (matches dispatch exactly).
> **Method:** [kickoff-p2.md](kickoff-p2.md) §3 (population → claim-derivation → falsifier → report). Traps active: T1,T2,T3,T6,T9,T10,T14,T15,T20 + T-P2-A + T-P2-B.

## Verdict

**GO-WITH-NOTES.** Every claim checked in this lane is TRUE against code or live probes; the §5 gate suites are green under a host-arch-correct toolchain (deviations + fixes in §method). The notes that keep this from a bare GO: one portability RED that is real but pre-classified (principle 46 vs git 2.39.5, F3), two residual fail-closed gaps worth doc sentences (F4), one literal-regexp drift in a comment (F14), and one live-fire this container cannot perform (F8 → §inconclusive). None is a defect introduced by the delta that blocks promote; F3 deserves a follow-up ticket on the P2 findings ledger.

## §population-enumeration (T10)

Derived by:

```bash
git diff origin/main...origin/staging --name-only -- packages/core \
  ':!packages/core/principles' ':!packages/core/hooks' ':!packages/core/backends' \
  packages/preset-* packages/lint-config packages/meta-factory
```

→ 47 paths; `--stat` tail: `47 files changed, 1815 insertions(+), 344 deletions(-)`. Grouped (counts sum to 47): synthesizer 7, research 8 (incl. `detector/read-python-cargo.test.ts`), audit-self 6, install 2, python-starter 3 (`render-python-templates.ts` + new `templates/python/ARCHITECTURE.md` + `RULES.md`), templates/shared 6, templates/go 1, vitest substrate 3, presets 6 (RULES.md + package.json ×3 each), lint-config 1, meta-factory 1, root manifests 3 (`packages/core/LICENSE`, `packages/core/package.json`, `packages/core/package-lock.json`). Stratification (T9): all 47 read as diffs; the 13 largest also read as whole files; every *behavioral* claim (17 findings below) got an executable falsifier, not only a read.

## §method-actually-run

**Environment (host-verify fence §9 disclosures).** Handoff container: x86_64 host, `node_modules` symlinked to the primary checkout's arm64 tree; `gh` present but unauthenticated (`gh auth status` → "You are not logged into any GitHub hosts", probed 2026-09-15); npm registry reads work with `/tmp` cache prefix; no real pnpm/yarn-Berry on PATH initially.

**Toolchain deviations (all resolved, none changed product code):**

1. tsx/esbuild arm64-vs-x64 → `/tmp/x64tool` (tsx@4.23.13 + esbuild linux-x64), CLIs run as `node /tmp/x64tool/node_modules/tsx/dist/cli.mjs` from repo root.
2. vitest 4.1.8 installed to `/tmp/x64vitest` (`--legacy-peer-deps` pinned after an npm arborist `edgesOut` crash on the meta-install; tsx and vitest in separate prefixes), driven via a minimal config inside that prefix pointing `setupFiles` at the repo's `packages/core/vitest.setup.ts`. Repo-config load fails in this container (resolves the primary's arm64 rolldown while bundling) — container-only, not a delta defect.
3. vitest 4 removed `--reporter=basic` ("Failed to load url basic") → default reporter used; the kickoff's literal command line is a deviated-with-reason form.
4. `packages/core/node_modules/.bin/tsx` shadowed with a symlink to the x64 tsx (gitignored path) so `rule-bootstrap-practice.test.ts`'s `tsxBin()` spawn works. Its initial 5 failures were **environmental, proven by this fix** (14/14 after), not a delta defect.

**§5 gate runs (touched suites, real rc/counts):**

| suite | result |
|---|---|
| `research/*.test.ts` + `detector/read-python-cargo.test.ts` | 74/74 passed |
| `synthesizer/run-rule-tests-firing.test.sh` (fixed runner) | 42/42 asserts |
| same vs pre-fix runner (extracted to `/tmp/pre-fix-run-rule-tests-firing.sh`) | 20/42 FAIL — paired-negative discriminates |
| `audit-self/pre-merge-local.test.sh` | 133/133 |
| `install/rule-bootstrap-practice.test.ts` | 14/14 |
| `synthesizer/run-generated-rule-mutation.test.sh` | 14/14 |
| `audit-self/first-steps-parity.test.ts` | passed |
| render CLIs `--check` ×2 | rc=0, byte-identical stdout, stderr empty |
| **untouched** `research-to-node.test.ts` + `research-to-clippy-node.test.ts` (cold-review closure, F2) | 27/27 |

**Live probes fired (not suite-reliance):** `/tmp/probe-guards.ts` (path-guard modes), `/tmp/probe-pep621.ts` (7-case pep621 matrix), real pnpm 9.15.0 `CI=true --frozen-lockfile` (rc=0), `npm pack --dry-run` (clean), upstream forbidigo README fetch, `gh auth status`.

## §findings

Verdict grammar: `TRUE` / `CODE-LIES` / `BROKEN` / `INCONCLUSIVE-needs-human`. Each finding ends with **Doc-sentence:** — what a doc sentence written from this code should say.

### F1 — A7-2/3/5 firing-contract rework — TRUE

`packages/core/synthesizer/run-rule-tests-firing.sh` reworks the ast-grep/ruff/cargo firing gates to read rule ids from structured diagnostics (`_json_array_field`, `_ndjson_codes`, `_ndjson_has_codeless_error`, sentinels `<<not-array>>`/`<<null-code>>`), mirroring the TS twins (`backends/shared/json-array-parse.ts`, `backends/cargo/firing-runner.ts` — semantics compared, they match). Falsifier: new `.test.sh` 42/42 on fixed; **20/42 FAIL** against the pre-fix runner (RUNNER override) — the negative half of the pair exists and discriminates. No exit-code-based verdict remains: `_verdict_invalid` fires on sample/rule-invalid shapes.
**Doc-sentence:** "Firing verdicts come from JSON/NDJSON diagnostic rule ids (ast-grep `scan --json`, ruff `--output-format json`, cargo `--message-format=json`), never from tool exit codes; unparseable output is a `sample invalid`, not a pass."

### F2 — R-5 shared render driver + `firstProvenanceRejection` dedup — TRUE

`render-researched-astgrep.ts`/`render-researched-clippy.ts` share `runRenderCli`; `research-to-node.ts`/`research-to-clippy-node.ts` export one canonical `firstProvenanceRejection` (bodies diff code-identical modulo two comment lines — verified by main-side `git show` diff). Falsifiers: both `--check` rc=0, stdout byte-identical (40/39 bytes), stderr empty; drift-path stderr contract present in source (`render-researched-astgrep.ts:262` `process.stderr.write(\`❌ researched ${config.backend} artifact drift detected:\n\`)`). Cold-review addition: the **untouched** reject-branch suites (`research-to-node.test.ts:227` `it('expressible practice with a non-Tier-0 host → research-only, provenance-rejected, NO node'` … `:234` `expect(result.reason).toBe('provenance-rejected')`) ran 27/27 — dedup preserved the reject path, verified independently of the touched suites.
**Doc-sentence:** "Both researched-render CLIs are thin skins over one driver; provenance rejection has exactly one implementation (`firstProvenanceRejection`) and its own untouched test arms."

### F3 — Hermeticity split + principle 46 portability — TRUE **with a RED edge (pre-classified class, real consequence)**

Registration chain verified: root `vitest.config.ts:33` `setupFiles: ['./packages/core/vitest.setup.ts']`-shaped entry; `vitest.setup.ts` performs the `scrubHostEnv` side effect; `vitest.host-env.ts` holds pure tables (`SCRUBBED_PREFIXES`, `SCRUBBED_EXACT`, `GIT_REPO_LOCAL_ENV` frozen at git 2.53.0). Substrate probe (`tests/agnosticism/probes/substrate.sh` grepping `CLAUDE_|ANTHROPIC`) clean. **RED edge:** principle 46 arm (B) derives the git local-env list from the *running* git and diffs against the frozen table — on this container's git 2.39.5 it fails: output `gaps = ["GIT_INTERNAL_SUPER_PREFIX"]`, `1 failed | 14 passed`. The failure mode is exactly what the design intends (fail on gaps), so the *code* is TRUE; the *frozen table* makes the principle suite non-runnable on pre-2.53 gits — this container included. Not a promote blocker (CI runs a newer git), but it starves any pre-2.53 environment of the whole suite.
**Doc-sentence:** "The git-env scrub table is frozen at git 2.53.0; on older gits principle 46 fails closed (`GIT_INTERNAL_SUPER_PREFIX` gap on 2.39.5) — run the principles on git ≥2.53 or expect arm B RED."

### F4 — A7-1 `collectArrayLines` (pep621 deps) — TRUE, two residual fail-closed gaps

`research/ecosystem-python.ts` rework live-fired via `/tmp/probe-pep621.ts`: 7-case matrix correct for single-line arrays, comments, and inline `#` trailing content. Residual edges (fail-closed = dependency under-detected, Tier-1 depth degrades, never a false positive): (1) `dependencies =` with the opening `[` on the **next** line → empty; (2) multi-line `[project.optional-dependencies]` tables → empty. End-to-end arm `detector/read-python-cargo.test.ts` green in the 74/74.
**Doc-sentence:** "The pep621 reader recognises only same-line `key = [` array opens and flat tables; other shapes degrade to 'no python deps detected' (Tier-1 misses, never false claims)."

### F5 — R-1 path-guard extraction — TRUE

New `research/research-path-guards.ts` (+`.test.ts`) live-fired via `/tmp/probe-guards.ts`: modes, symlink escape, `..` traversal, sibling-prefix (`deps-x` vs `deps/`) all correct. Cross-module reuse (`ecosystem-cargo.ts`, `ecosystem-go.ts`) is a pure move; the precondition tripwire still sees its signal (`ecosystem-adapter-precondition.test.ts:83` regex matches `isUnsafeDepName` usage in the extracted module).
**Doc-sentence:** "Path-safety for ecosystem manifests lives in `research-path-guards.ts`; adapters consume it, the precondition tripwire still guards the guard."

### F6 — A7-4 practice-join validation before first write — TRUE

`install/rule-bootstrap-cli.ts` raises `PracticeJoinError` before any filesystem write when the join target is missing/invalid. Falsifier: `rule-bootstrap-practice.test.ts` 14/14 (after the environmental esbuild fix — see §method), including the join-negative arms.
**Doc-sentence:** "`getff init` practice bootstrap validates the join target up front and writes nothing on validation failure."

### F7 — L-4f consumer-extension fixtures — TRUE

`audit-self/check-fences-fire.sh:374` — `done < <(find "$FIXTURE_DIR" -maxdepth 1 -name '*.manifest.json' -print0 2>/dev/null | sort -z)` — enumerates extension fixtures by find-mask (no allowlist): `$FIXTURE_DIR` resolves to `scripts/fences-fire-fixtures/` first (`:83-84`), and the diff's comment says exactly that — consumers drop a `<name>.bad.<ext>` + `<name>.good.<ext>` + `<name>.manifest.json` triple there; the fence fires on it with zero central edits.
**Doc-sentence:** "Consumer extension fixtures are discovered by find-mask (`find <fixture-dir> -maxdepth 1 -name '*.manifest.json'` over `<name>.bad.<ext>` + `<name>.good.<ext>` + `<name>.manifest.json` triples dropped into `scripts/fences-fire-fixtures/`), never by an allowlist."

### F8 — #1638 `--paginate` probe — TRUE (stub-level); live-fire INCONCLUSIVE (§inconclusive)

`audit-self/ci-available-probe.sh` adds `--paginate` and reconciles per-page jq concatenation against the unpaginated `total_count`; P3a/b/c arms green in the container. The embedded empirical constant ("measured on this repo, 30 of total_count 47") is repo-state, not code truth — and `gh` here is unauthenticated, so the live fire could not run (probe: `gh auth status` → "not logged into any GitHub hosts", 2026-09-15).
**Doc-sentence:** "The availability probe paginates `gh api` and cross-checks the summed page count against `total_count`; the recorded 30/47 figure is a dated measurement, re-probe before relying on it."

### F9 — A4-2 lockfile-decides-package-manager — TRUE (shims + real pnpm)

`audit-self/pre-merge-local.sh` picks npm/pnpm/yarn from the lockfile present; `pre-merge-local.test.sh` 133/133 including shimmed-pnpm arms 2b/2c. The one shim-unprovable empirical claim — `CI=true` suppresses pnpm's `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` under `--frozen-lockfile` — was probed against **real pnpm 9.15.0** (installed to `/tmp/pnpmtool`): lockfile-only generation, then `CI=true pnpm install --frozen-lockfile` in a fresh no-TTY fixture → `Done in 1.3s`, `PROBE-RC=0`, no TTY abort.
**Doc-sentence:** "Frozen installs are selected and flagged per-lockfile, and pnpm's no-TTY abort is suppressed by exporting `CI=true` — verified against pnpm 9.15.0."

### F10 — #1795 unset guards — TRUE (class pre-decided §4)

`fixtures/foreign-scan-triage/repro.sh` and `run-generated-rule-mutation.test.sh` carry the `unset $(git rev-parse --local-env-vars)` guards; both suites green (14/14 mutation). Per kickoff §4 the GIT_DIR/core.bare incident *class* is closed in #1795 — presence + suite green is the required check here, no re-investigation.
**Doc-sentence:** "Scripts that shell into consumer repos scrub git's local env vars before invoking git, so a host repo's `GIT_DIR`/`core.bare` cannot leak into the consumer view."

### F11 — python-starter render guard + new templates — TRUE

`render-python-templates.ts` adds `ARCHITECTURE.md` + `RULES.md` to `NON_RENDERED_TEMPLATE_FILES` (no token substitution in hand-authored docs). Every concrete claim in the new `ARCHITECTURE.md` table exists on disk: ast-grep ids `getff-no-eval/getff-no-os-system/getff-no-datetime-now/getff-no-datetime-datetime-now` (files under `templates/python/.getff/astgrep-rules/`), ruff `select = ["DTZ005", "TID251", "TID253"]` (`templates/python/ruff.toml:3`), workflow jobs `getff-astgrep` (`github-actions-ci.yml:34`) and `getff-ruff` (`:54`) delivered as `.github/workflows/getff-python.yml`. Delivery guards exist: 22× RULES.md refs in `tests/install-sh/python-agent-surface-refresh.test.sh`, arm at `python-entry-lane.test.sh:690+`.
**Doc-sentence:** "The Python lane's ARCHITECTURE.md enforcement table lists only checks the lane actually delivers (4 ast-grep rules, 3 ruff codes, hook + CI backstop) and explicitly disclaims layering/typing/coverage."

### F12 — presets RULES.md truth-repair + #1794 legal — TRUE

The three preset `RULES.md` diffs replace false consumer-facing claims (typecheck/vitest/dependency-cruiser at pre-push) with the four sections the shipped `packages/core/hooks/pre-push.ts` actually runs — verified at source: `ruleGlobsSection`, lint-staged §3d (`pre-push.ts:1035`), `generatedRuleMaterialSection` (`:1117`), lychee link-check (`:788`); the audit-ai-docs vitest section is maintainer-only, correctly absent from consumer docs. #1794: `packages/core/LICENSE` + 6 package.jsons consistent (same license field family, author fields aligned); `js-yaml` pinned `4.3.2` (`packages/core/package.json:95` — `    "js-yaml": "4.3.2",`), lock carries exactly one `"version": "4.3.2"` entry at `node_modules/js-yaml` (`packages/core/package-lock.json:3704`; block head `:3703`) — lockfile↔manifest consistent.
**Doc-sentence:** "Consumer preset docs describe the four getff-owned pre-push checks only; consumer typecheck/tests are explicitly the consumer's to wire."

### F13 — A8-3 first-steps parity + profile default — TRUE

`templates/shared/first-steps.source.json` tier-list arms verified against `setup.d/lib.sh:61-63` (`GETFF_SKILLS_CORE="template-audit ai-doc rule-research rule-tests"`, `GETFF_SKILLS_ENV="arch night-mode orchestrator pipeline reviewer"`); parity enforced by `first-steps-parity.test.ts` (passed). The profileFlag claim lands: `install.sh:648` `PROFILE="env"` with `echo "[profile] env (non-interactive default; --profile core for rules-only, …)"` — `-y` alone is `env`, `core` needs `--profile core`.
**Doc-sentence:** "Non-interactive install defaults to `env` depth (five skills over core's four); `core` is opt-in via `--profile core`."

### F14 — go CI A8-1 REFUSE-cell order fix — TRUE (one literal-regexp nit)

`templates/go/github-actions-ci.yml` now tests `getff-golangci.yml` FIRST. Claim chain verified: `setup.d/47-go.sh:110-114` writes `getff-golangci.yml` in exactly the REFUSE cell (`# reads ONE .golangci.yml). REFUSE: ship getff-golangci.yml`); pre-fix unreachability documented at `tests/install-sh/go-entry-lane.test.sh:26` (`elif [ -f getff-golangci.yml ]; then … # ← unreachable`); paired-negative arms `@A8-1:pos` (`:247-256`) and the pre-fix variant re-run as discriminator (`:261-267`); fresh-cell arm (9) at `:285-293`. **Nit:** the comment's forbidigo default ``^(fmt\.Print(|f|ln)|print|println)$`` vs upstream README's `^(fmt\.Print.*|print|println)$` — substantively the same claim (fmt.Print family + print/println), literally a narrower spelling than upstream's `.*` (fetched 2026-09-15). Cosmetic; the mechanism claim (default pattern fires on consumer `fmt.Println` when forbidigo force-enabled without configured patterns) holds either way.
**Doc-sentence:** "In the REFUSE cell the delivered workflow must load `getff-golangci.yml` first — its presence IS the cell discriminator — or forbidigo runs the consumer's config with its default `fmt.Print*` pattern and reds on the wrong things."

### F15 — shared-template pre-push truth-repair — TRUE

`AGENTS.md.template:46`, `CLAUDE.md.template:22`, `DESCRIPTION.template.md:61`, `skill-context/aif-rules-check/SKILL.md` all replace the false "(typecheck, `vitest related`, dependency-cruiser)" description (that is the *operator* repo's hook) with the four getff-owned checks. Cross-checked against the same `pre-push.ts` sections as F12 — the new text names exactly what ships.
**Doc-sentence:** "Shipped docs describe the shipped pre-push (rule-glob liveness, lint-staged resolution, generated-rule firing, changed-Markdown links) and state plainly it does not run the consumer's typecheck or tests."

### F16 — AI-USAGE-GUIDE claims — TRUE

Five env-over-core skills = `lib.sh:62` verbatim. Preset render lines match their data source: `.claude/skills/pipeline/references/presets/economy.json:4` `"marker": "Z.AI GLM-5.3 SDK"`, `presets/aif.json:5` `"Autonomous overnight aif-handoff dispatch (project-default profiles, no marker)"`; render chain `scripts/render-presets.mjs:31` reads exactly that directory. Publish-readiness metadata: `npm pack --dry-run` in `packages/core` → clean (`name: @rules-as-tests/core`, 507 files, no errors). The de-scoped-table trigger now reads "`npm view getff version` resolves (the frozen name is unscoped `getff`)" — a future-dated trigger, not a present-tense claim, so nothing to falsify today.
**Doc-sentence:** "The guide's preset section is rendered from `presets/*.json` by `render-presets.mjs`; the npm-publish row stays an owner+trigger entry until `npm view getff version` resolves."

### F17 — manifest/lock/legal consistency — TRUE

Covered under F12 (js-yaml pin, LICENSE, six package.jsons, `npm pack` clean). No dependency additions in the delta → no capability-commit surface in this lane.

## §coverage (T6, explicit predicates)

- **Files:** 47/47 enumerated; 47/47 diff-read; 13/13 largest whole-file-read; 17/17 derived claim-groups falsifier-checked (mechanical evidence above).
- **Suites:** all 8 touched suites run to completion in-container (green); 2 untouched suites run as cold-review closure (27/27). One kickoff-literal command form deviated (`--reporter=basic`, removed in vitest 4).
- **Behavior-at-a-distance:** gh live API fire 0/1 possible (no auth) → F8 stub-level only; real golangci-lint run 0/1 (substituted upstream-doc verification for the default-pattern claim + in-repo paired-negatives for the ordering); Windows git-bash surface 0 (out of container reach; repo's own consumer-matrix lane owns it).
- **Calibration:** first run of this method on this lane; the paired-negative on F1 and the two probe scripts are the discrimination evidence; expect residual false-negatives concentrated in the behavior-at-a-distance bucket above.

## §self-application (T15)

This audit ran on itself: population was enumerated before any verdict (§population before §findings, order enforced); its own §5-gate greens were re-derived under a corrected toolchain rather than accepted from a broken run (the 5 practice-test failures were chased to an environmental cause and *proven* environmental by the shadow-fix, not hand-waved); the T4/T7 category counter-prompt was actually executed as a cold sub-agent (never saw my reasoning) and its 6 surfaced items were each either closed with new evidence (research-to-node 27/27; stderr streams; real pnpm; npm pack; forbidigo upstream; lockfile grep) or honestly parked (gh live fire). What auditing this audit would look like: re-run the pre-fix runner pair on a machine with the stock toolchain and re-fire `gh api --paginate` with auth — both are one-command checks named above.

## §inconclusive

1. **F8 live pagination** — `INCONCLUSIVE-needs-human`: requires authenticated `gh`. Host-verify candidate: `gh api repos/:owner/:repo/pulls --paginate --jq '.[] | .number' | wc -l` vs `total_count` on a repo with >100 items.
2. **golangci-lint v1.55.2 runtime behaviour** (default-pattern fallback under `--enable forbidigo` with a consumer config) — verified against upstream README + in-repo paired-negatives, not against the binary; `INCONCLUSIVE` for the literal runtime. Host-verify candidate: `golangci-lint run --enable forbidigo` on a fixture with a `fmt.Println` and no configured patterns.
3. **Windows git-bash execution of `run-rule-tests-firing.sh`** — not reachable from this container; the repo's consumer-matrix lane (cf. #1796/#1798) owns that surface.

## Observations outside lane scope (surfaced, not actioned)

- The frozen git-env table (F3) will bite every pre-2.53 git environment; a derived-at-runtime table with a floor assertion is the obvious follow-up — P2 findings ledger item, not this PR.
- `mode-overrides.md:174` still says `Z.AI GLM-5.2 SDK` while `presets/economy.json` says 5.3 — operator-repo reference doc, outside this lane's 47 files; flagging for the lane that owns it.
