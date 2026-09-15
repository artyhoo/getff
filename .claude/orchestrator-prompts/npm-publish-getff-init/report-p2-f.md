# P2-F report — scripts + CI code-truth lane

> **Lane:** P2-F of the P2 code-truth pass (promote-#4 truth gate).
> **Delta audited:** `origin/main...origin/staging` = `9b768ca2b8..c26593c90b`, paths `scripts` `.github`.
> **Measured head (this session):** `c26593c90b70b71761fa4bf25858139a62ef2b50` (= branch HEAD = `origin/staging`). The kickoff pinned `08a95a6dea4`; staging moved after kickoff authoring, as kickoff §2 warned — every verdict below is against the measured head.
> **Measured slice:** 52 files, +5736 −263 (kickoff pinned 51 files +5677 −261; delta = staging motion, same warning).
> **Host-verify fence (§9):** `node v22.23.2` · `vitest/5.0.1 linux-x64 node-v22.23.2` · `git version 2.39.5`.

## §population-enumeration

Command (T10 — population before any verdict):

```console
$ git diff --name-status origin/main...origin/staging -- scripts .github
```

Output: **52 files — 25 `A` + 27 `M`, 0 `D`**; `git diff --shortstat` → `52 files changed, 5736 insertions(+), 263 deletions(-)`.

Strata (sampling strategy per T9 — stratified across path class AND change class, not convenience-recent):

| Stratum | n | Members |
|---|---|---|
| `.github` templates (A) | 3 | `ISSUE_TEMPLATE/{beta-feedback,bug-report,config}.yml` |
| `.github` workflows (M) | 7 | `audit-self.yml` (+438/−107), `demo-regen`, `framework-self-template-render`, `guard-liveness-fullsweep`, `pr-body-fidelity`, `pr-body-prior-art`, `pr-stale-revert` (6 × 4-line cache diffs) |
| `scripts` new (A, non-test) | 11 | `build-getff-dist.sh` (131), `check-line-citations.mjs` (677), `generate-plugin-skills.sh` (345), `lib/claude-md-excludes.sh` (214), `measure/measure-{interaction-shape,permission-denials,recap-len}.py`, `probe-zcode-runtime.sh` (86), `register-handoff-gate.sh` (256), `register-recap-gate.sh` (191), `run-install-sh-suite.sh` (296) |
| `scripts` new (A, test/fixture) | 11 | 7 `*.test.sh` + `measure/README.md` + 3 `measure/fixtures/*.jsonl` |
| `scripts` modified (M, non-test) | 15 | 13 named: `run-local-ci-sweep.sh` (+263/−20), `format-shipped.sh` (+140), `check-skill-drift.sh` (+84), `link-coordination.sh` (+59), `register-precompact-hook.sh` (+52), `render-harness-config.mjs` (+47/−13), `measure-session-start-tokens.sh` (+45/−18), `measure-always-on.sh` (+20/−68), `check-ask-files.sh` (+30/−7), `generate-plugin-twins.sh` (+14/−7), `render-install-roster.mjs` (+9/−2), `getff-work.sh` (+8/−2), `getff-glm-onebutton.sh` (+5/−1); + 2 tiny: `build-synth-bundle.sh` (+1/−1), `install-coordination-wiring.sh` (+3, shellcheck directives only) |
| `scripts` modified (M, test) | 5 | `run-local-ci-sweep{,-coverage}.test.sh`, `build-synth-bundle.test.sh`, `check-ask-files.test.sh`, `check-bundle-dep-parity.test.sh` — the delta's other 7 `*.test.sh` are all `A` (incl. `measure-session-start-tokens.test.sh`: `git diff --name-status` → `A`), counted in the A-test row above |

(Arithmetic: 25 A = 3 templates + 11 scripts-new + 11 scripts-tests/fixtures; 27 M = 7 workflows + 20 scripts rows, where 20 = 15 scripts-non-test (13 named + 2 tiny) + 5 scripts-test. The n-column sums directly: 3 + 7 + 11 + 11 + 15 + 5 = 52.)

No relocations or twins inside this slice (T-P2-B checked): the only twin-shaped artefact, `plugin/` generation, is *referenced* by `generate-plugin-skills.sh`/`generate-plugin-twins.sh` but lives outside the audited paths (P2 lanes for `packages/core`/`plugin` own it).

## §method-actually-run

Per kickoff §3 — read the diff, then the file; derive one behavioural claim; falsify it by running:

1. **Every changed test file was run** (kickoff §5 gate). Battery over `git diff --name-only … -- scripts | grep '\.test\.sh$'` = **12 files, 12 × rc=0**:

   ```console
   ===== scripts/build-synth-bundle.test.sh =====        rc=0  ok: committed bundle carries only repo-relative first-party file comments
   ===== scripts/check-ask-files.test.sh =====           rc=0  DEGRADED: node/tsx unavailable — the pre-push wiring arms did NOT run
   ===== scripts/check-bundle-dep-parity.test.sh =====   rc=0  ok: relative <repo-root> argument resolves against the caller's cwd
   ===== scripts/check-line-citations.test.sh =====      rc=0  check-line-citations paired-negative: all arms passed
   ===== scripts/lib/claude-md-excludes.test.sh =====    rc=0  ALL PASS (scripts/lib/claude-md-excludes.sh)
   ===== scripts/measure-session-start-tokens.test.sh == rc=0  ALL PASS (scripts/measure-session-start-tokens.sh)
   ===== scripts/measure/measure.test.sh =====           rc=0  PASS=28 FAIL=0
   ===== scripts/register-handoff-gate-target.test.sh == rc=0  PASS — …targets the user settings by default…
   ===== scripts/register-root-resolution.test.sh =====  rc=0  PASS — all 3 registration scripts resolve their own checkout from any cwd.
   ===== scripts/run-install-sh-suite.test.sh =====      rc=0  run-install-sh-suite: ALL PASS
   ===== scripts/run-local-ci-sweep-coverage.test.sh === rc=0  PASS=21 FAIL=0
   ===== scripts/run-local-ci-sweep.test.sh =====       rc=0  run-local-ci-sweep: ALL PASS
   ```

   The one DEGRADED line is the declared degradation path, not a skip of mine — see §inconclusive.

2. **Live gates run, not just re-read** (T-P2-A): `bash scripts/build-getff-dist.sh --check` → `✓ packages/getff/MANIFEST.sha256 in sync with the repo root (1083 files); 'files' covers every payload root`, rc=0. `bash scripts/generate-plugin-skills.sh` → `generated 0 (written), 6 already in sync, 0 manual-skipped`, rc=0, `git status --porcelain` byte-identical before/after (no-op-on-clean-tree claim). `bash scripts/probe-zcode-runtime.sh` → `SKIP: … not present — runtime probe is maintainer-machine only.`, rc=0. `bash scripts/run-local-ci-sweep.sh --capture` → `[sweep] unknown arg: --capture`, rc=2 (flag removed as documented). `node scripts/check-line-citations.mjs --check --corpus` → `resolved 118 / skipped 33 citation(s)`, rc=0 (same command the `citation-fullsweep` CI job runs).

3. **Environment provisioning, disclosed:** the container ships without devDeps. I fetched lockfile-pinned tarballs (esbuild, ajv, fast-uri, semver, picomatch 2.3.2/4.0.4, …) from the registry directly into gitignored `node_modules` paths; `git ls-files -m` clean afterwards (tracked tree untouched). Known PostToolUse hook esbuild arm64/x64 error fired on repo Writes — edits land; surface-once per memory.

## §findings

Verdict grammar: `TRUE` / `CODE-LIES` / `BROKEN` / `INCONCLUSIVE-needs-human`. Every finding carries evidence + the doc sentence a doc written from this code should say.

### F1 — `audit-self.yml:464` suite count comment: says 19, mechanism has 18 — `CODE-LIES` (numeric comment drift, non-blocking)

- Evidence (T3b): `.github/workflows/audit-self.yml:464` — `# … across 19 suites (17 describe.skipIf(!JQ) + …` (context lines of the skipIf-guard step). Measured on the audited head: exact-form `describe.skipIf(!JQ)` = **34 occurrences across 17 suites** + 1 it-form suite = **18 suites**; the loose pattern (any `skipIf(!JQ)`) spans 20 files. The comment's own breakdown (17 describe + …) only reaches its total by counting a non-suite file.
- Mechanism is otherwise honest: the guard exists, fires per-suite, and the coverage-test parser consumes the literal `if:`-guarded run steps (verified: `run-local-ci-sweep-coverage.test.sh` PASS=21 incl. both negative arms).
- **Doc sentence:** «The jq-guarded suites step documents its own count; treat such inline counts as snapshots — verify with `grep -rc 'describe.skipIf(!JQ)'` before citing.»

### F2 — `scripts/lib/claude-md-excludes.sh:22` claims picomatch `packages/core 4.0.5`; the tree pins 4.0.4 — `CODE-LIES`

- Evidence: `scripts/lib/claude-md-excludes.sh:22` — `# … picomatch — root 2.3.2, packages/core 4.0.5 …`. Measured: `packages/core/package.json` + `packages/core/package-lock.json` pin **4.0.4** (the exact version I provisioned and ran the cross-grammar parity leg against — PASS).
- **Doc sentence:** «The bash SSOT's picomatch version references are parity anchors, not pins; regenerate them from the lockfiles when citing.»

### F3 — `scripts/check-line-citations.mjs:100-101` says «32 citations … remain unresolvable»; the live corpus measures 33 — `CODE-LIES`

- Evidence: `scripts/check-line-citations.mjs:100-101` — «`--strict` is deliberately NOT wired into pre-push §9: 32 citations on that corpus / remain unresolvable and most are out-of-repo by construction» (the header's other «32», at :31-:33, is the 2026-09-13 drifted-citation census — a different measure). Live: `node scripts/check-line-citations.mjs --check --corpus` on the audited head → `resolved 118 / skipped 33 citation(s)`, rc=0 (33 = 14 `bare-basename` + 3 `ambiguous-basename` + 16 `path-missing`). Same bucket, confirmed not assumed: pre-push §9 invokes this same script with the same `--corpus` flag (`packages/core/hooks/pre-push.ts:1512-1517`); the corpus is the single SSOT `LIVE_AUTHORITY_MD` (`scripts/check-line-citations.mjs:230-237`); §9's extra `--affected-by` scopes ARM 1 only, not resolution/skipping (`scripts/check-line-citations.mjs:59-61`); and «skipped» is by definition the unresolved bucket (`scripts/check-line-citations.mjs:83-86`). So 33 ≠ 32 is genuine snapshot drift, not a bucket mismatch: the file population is unchanged (103 files at the header's own measurement, `scripts/check-line-citations.mjs:61-62`; 103 re-measured here), but 17 corpus-surface files changed after the checker landed (`git diff --stat 68a533425e..HEAD -- .claude/rules .claude/skills agents CLAUDE.md AGENTS.md CONTRIBUTING.md` → 17 files, +53, −38) — corpus content moved past the comment's number.
- **Doc sentence:** «Citation-corpus size in prose is a snapshot; the live number is one command away (`--check --corpus`).»

### F4 — `check-skill-drift.sh` §4 contract check: no automated live-tree channel runs it; host run is red via *untracked* local skills — `INCONCLUSIVE-needs-human`

- Evidence (three legs):
  1. `bash scripts/check-skill-drift.sh; echo rc=$?` → `FAIL: 7 file(s) with a wrong or missing invocation-channel contract.` + `FAIL: 27 broken ref(s)` → **rc=1** on a clean staging checkout.
  2. Every flagged file is **untracked** (T3b): `git ls-files '.claude/skills/aif-{explore,evolve,grounded,loop,rules}/SKILL.md'` → 0 matches each — they are handoff-container provisioning, invisible to CI's clean checkout. The red is environmental, not a staging defect; the §4 logic itself is pinned by the tracked paired-negative `packages/core/hooks/check-skill-drift.test.ts` (vitest, not runnable here — §inconclusive).
  3. Channel sweep: `grep -n skill-drift .github/workflows/audit-self.yml` → no hits; no row in `scripts/run-local-ci-sweep.sh` `gate_table()`; absent from `.husky/`; both checks also absent at `origin/main` (nothing this delta removed). The only wirings are `package.json:9` (`check:skill-drift`) and the vitest fixture test — the live-tree invocation is manual.
- Why it lands here and not as BROKEN: the script does exactly what its header says when run, and its logic is negatively tested; what has no channel is the *live-tree run*. `docs/meta-factory/operational-conventions.md:109` says «section 4 **enforces** §4's canonical line byte-for-byte» — with no automated consumer, that enforcement is the `#hope-as-gate` shape of `attention-is-not-a-mechanism.md §2` unless the manual channel is the accepted design. Needs a human call: wire it (sweep row or CI step — note the sweep's `script-selftests` derivation reaches `scripts/**` test files, so a `check-skill-drift.test.sh` would auto-wire) or reword the claim.
- **Doc sentence:** «`check-skill-drift.sh` §4 detects invocation-channel-contract drift; as of this head no CI/hook channel invokes it on the live tree — run `npm run check:skill-drift` explicitly or wire a row.»

### F5 — §4-assigned publication-flip coupling inventory — `TRUE` (complete; one surface beyond the declared pair)

- The declared pair flips together (already coupled in-tree):
  - `.github/workflows/context7-refresh.yml:10-15` — `on: push: branches: [staging]` (the trigger),
  - `.c7.json`/`context7.json:5` — `"branch": "staging"` (the refresh target).
- **Third surface coupled to the same flip:** `.github/workflows/release-drafter.yml:25-26` — `push:`/`branches: [staging]` — the release-drafter **workflow trigger** also keys on the staging ref; at publication (staging→main default-branch motion) it must be flipped or consciously re-decided **in the same commit** or the drafter stops matching.
- Everything else staging-triggered in the delta already triggers on both branches (the 6 cache-sweep workflows + audit-self fire on push to either ref), so no further coupling exists in this slice.
- **Doc sentence:** «The publication flip is a three-file commit: context7-refresh.yml trigger, context7.json `branch`, release-drafter.yml's ref — enumerate all three in the promote checklist.»

### Verified-`TRUE` ledger (claims falsified-by-running and surviving; one line each)

| Claim | Evidence |
|---|---|
| setup-node cache sweep complete | 7/7 workflow diffs carry `cache: npm` + both lockfile `cache-dependency-path`s |
| zizmor discovery + empty-set guard | `git ls-files '*github-actions*.yml' \| grep -v '^\.github/'` → 8 shipped templates incl. drifted `go`; pre-push.ts twin converted identically |
| 336 tracked `*.sh`; LF policy | `git ls-files '*.sh' \| wc -l` → 336; `.gitattributes:11` `* text=auto eol=lf` |
| run-install-sh-suite counts | battery = 114 `tests/install-sh/*.sh` exact; CI steps = 113 exact |
| jq-guard block count 34 | `grep -c 'describe.skipIf(!JQ)'` exact-form = 34 |
| citation-fullsweep CI command green on host | `resolved 118 / skipped 33`, rc=0 (§method leg 2) |
| claude-md-excludes parity leg | cross-grammar identical vs pinned picomatch 4.0.4 (provisioned) |
| synth bundle no drift | `build-synth-bundle.test.sh` rc=0 — `--check` byte-identical from repo root and non-repo cwd |
| register-handoff-gate semantics | 5/5 `--project`/`--print-target` arms ok (suite rc=0) |
| register-*-gate root resolution | 5/5 arms across 3 scripts, incl. foreign-toplevel refusal (suite rc=0) |
| issue templates parse | `npx js-yaml` → VALID × 3; contact link `https://getff.ai/docs/faq/` |
| Rule A tool pins | `ruff==0.15.21`, `pyyaml==6.0.2`, `@ast-grep/cli@0.44.1` — all `run:` installs pinned |
| sweep `--capture` removed | rc=2 + help text matches header |
| `script-selftests` derivation reaches subdir tests | regex on audit-self.yml → 17 `scripts/**` test files incl. `lib/` + `measure/` |
| measure/ README ↔ spec table | `2026-09-13-plain-words-recap-v2-design.md:25-34` rows match README mapping (361/240, 100, 636 vs 101, 1607, 7/10/41) |
| probe-zcode runtime skip path | rc=0, loud SKIP notice (§method leg 2) |
| getff-dist manifest in sync | 1083 files, rc=0 (§method leg 2) |
| plugin-skills regen no-op | 6 in sync / 0 written; tree byte-identical (§method leg 2) |

## §coverage

Explicit predicates (T6, no «high confidence»):

- Files: **52/52 enumerated; 52/52 read** (10 `.github` in full; 22 `scripts` A-files header+key-logic; 20 M-rows via whole-hunk diffs + targeted file reads).
- Changed test files: **12/12 run, 12/12 rc=0** (§5 gate satisfied).
- Behavioural claims derived-and-falsified: **31 confirmed TRUE** (ledger + F5), **3 CODE-LIES** (numeric comment drift), **1 INCONCLUSIVE-needs-human** (F4), **7 legs environment-blocked** (§inconclusive). Coverage ≈ 34/42 ≈ 81% of derived claims verified mechanically.
- Calibration: first run of this lane's method — the three F1–F3 findings are all one class (sweep-by-predicate numeric snapshots), so expect the same class was under-sampled elsewhere (P2 sibling lanes should re-check their own inline counts).
- Clean-vs-coverage (T14): the `.github` half is clean at high coverage (every workflow diff read; pins/templates mechanically checked) — plausibly actually clean. The `scripts` half is clean at the same coverage EXCEPT the four findings above; «clean» there means «no further defects surfaced at this depth», not «none exist» — the 5 biggest M-files' *unchanged* code paths were read only around their hunks.

## §self-application

- Did this audit run on itself? Yes, at three points: (a) T10 held — the population table precedes every verdict in this file; (b) the §5 gate output above is the battery log, not prose about it (T2); (c) the population table itself was re-counted by predicate on cold review (2026-09-15, iteration 2) and the first draft FAILED that recount: its M-test stratum said n=7 with `measure-session-start-tokens.test.sh` — an `A` file (`git diff --name-status origin/main...origin/staging -- scripts/measure-session-start-tokens.test.sh` → `A`) — as a phantom member, while leaving the two tiny non-test M rows uncounted, so the n-column (7+13+7) reached the correct headline 27 only via two compensating errors. The actual reconciliation, now stated in the table: non-test M = 13 named + 2 tiny = 15; test M = 5; 15 + 5 = 20 scripts M; + 7 workflows = 27; n-column sums directly, 3+7+11+11+15+5 = 52.
- What auditing this audit would look like: re-run the 12-suite battery and the five live-gate commands (all one-liners, quoted above) and diff against this file's quotes; re-derive the three numeric-drift counts with the exact predicates named; probe F4's channel sweep greps against both refs. The weakest link a cold auditor should press: my §coverage percentages count *claims*, not LOC — the 677-line `check-line-citations.mjs` and the 345-line `generate-plugin-skills.sh` each got one falsified claim, not 600 falsified lines.
- **That audit was run (2026-09-15, same day, a cold resume session re-verifying before egress):** population re-enumerated identical (52 files, +5736 −263, 25 A / 27 M); the 12-suite battery re-run blind from the report's own file list → **12/12 rc=0** with matching summary lines (`PASS=28`, `PASS=21`, `run-install-sh-suite: ALL PASS`, both sweep suites `ALL PASS`); the five live gates re-run green (`build-getff-dist.sh --check` → 1083 files; `generate-plugin-skills.sh` → 6 in sync / 0 written with a `git status --porcelain` checksum identical before/after; `probe-zcode-runtime.sh` → SKIP rc=0; `run-local-ci-sweep.sh --capture` → rc=2; `check-line-citations.mjs --check --corpus` → resolved 118 / skipped 33); F1's recount reproduced (17 files / 34 occurrences of the exact form) and F4 reproduced (rc=1, 2 error categories). One correction landed from it: F5's third-surface citation originally named the drafter *config* (whose line 26 is label config) — the coupling line is the *workflow trigger*, re-cited above as `.github/workflows/release-drafter.yml:25-26`.

## §inconclusive

- `INCONCLUSIVE-environment` — tsx tree absent: `check-ask-files.test.sh` pre-push wiring arms (DEGRADED line in battery) and `packages/core/hooks/check-skill-drift.test.ts` (vitest) not executed; provisioning node_modules wholesale was blocked (npm Arborist failure; sandbox denied /tmp scratch init).
- `INCONCLUSIVE-environment` — binaries absent: shellcheck arms (sweep row `WARN-skip` path), zizmor actual run (discovery + empty-set guard verified statically), prettier for `format-shipped.sh` Phase-3 vendor parity.
- `INCONCLUSIVE-environment` — host-scoped: `probe-zcode-runtime.sh` assertions (macOS `/Applications/ZCode.app` bundle); consumer-matrix cells (CI-only by design); `render-harness-config.mjs` zcode-runtime claims rest on survey #1699 + the probe (skipped here).
- `INCONCLUSIVE-needs-human` — F4's design question (wire the live-tree channel or reword the «enforces» claim).
- Not attempted (out of lane budget, declared): re-deriving the recap-v2 spec table against the live transcript corpus (`measure/*.py` run on fixtures only); `getff.ai/docs/faq/` reachability (URL is syntactically valid; no network probe in-container).

## Lane verdict

**GO-WITH-NOTES** — the scripts+CI half of `origin/main...origin/staging` is code-true at the audited head: every runnable gate is green (12/12 suites + 5 live gates), tool pinning is Rule-A compliant, the publication-flip coupling is a complete three-file inventory (F5), and the only code-level defects found are three non-blocking numeric-comment drifts (F1–F3) plus one enforcement-channel design question (F4) that needs a human call, not a revert. Nothing here blocks the promote-#4 truth gate.
