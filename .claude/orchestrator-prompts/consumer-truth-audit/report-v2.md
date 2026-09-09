# consumer-truth-audit V2 — stack lane maturity matrix (report)

> **Date:** 2026-09-08 · **Rigor label:** `research-grade` · **Runner:** aif handoff container `feature/consumer-truth-audit-19ba4a` (linux-arm64, node v22.23.1)
> **Authoritative for:** the executed-evidence answer to «what does "we support N stacks" mean» for the four shipped toolchain lanes (npm, python, cargo, go), as of the commit this branch is cut from (`abc0876183`).
> **NOT authoritative for:** the operator's N decision (§operator-options states options, picks none). The host-layer acceptance verdict was **open at authoring time** and was executed at harvest — see **§host-verify** (added 2026-09-09 by the harvesting session, not by the authoring run): 4 of 5 lanes re-fired live on the host, the go lane's 3 live-fire arms skipped for an absent tool.

## §environment — probes and provisioning (executed 2026-09-08, this container)

Fresh-state probes (before provisioning):

| Tool | Probe | Result |
|---|---|---|
| node | `node --version` | `v22.23.1` PRESENT |
| npm | `npm --version` | `10.9.8` PRESENT |
| python3 | `python3 --version` / `python3 -m pip --version` | `Python 3.11.2` PRESENT / `No module named pip` — **pip ABSENT** |
| cargo / rustc | `command -v cargo rustc` | NOT-ON-PATH |
| go | `command -v go` | NOT-ON-PATH |
| golangci-lint | `command -v golangci-lint` | NOT-ON-PATH |
| ruff | `command -v ruff` | NOT-ON-PATH |
| ast-grep | `command -v ast-grep` | NOT-ON-PATH |

Trap recorded: `command -v sg` hits `/usr/bin/sg` — the OS **group-exec** utility (`sg --version` → `Usage: sg group [[-c] command]`), NOT ast-grep. The shipped runner guards exactly this: `_sg_is_astgrep()` at `packages/core/synthesizer/run-rule-tests-firing.sh:203`.

Network reachability (HEAD/GET probes, 2026-09-08): `registry.npmjs.org` 200 · `static.rust-lang.org` 200 · `pypi.org` + `files.pythonhosted.org` 200 · `go.dev` reachable (405 on HEAD, GET OK) · **`github.com` BLOCKED** (empty response — release-asset downloads fail).

Provisioning outcome — all four ABSENT tools became PRESENT at the exact CI-pinned versions (per `evidence-regeneration.md` §2a: CI is the authoritative resolver; pins re-derived live from `.github/workflows/audit-self.yml`, T3):

| Tool | Route attempted → outcome | Version (quoted) |
|---|---|---|
| ast-grep | `npm install -g --prefix /tmp/provision/npm-prefix @ast-grep/cli@0.44.1` → OK | `ast-grep 0.44.1` |
| ruff | npm wrapper `@astral-sh/ruff` → **E404 Not Found**; GitHub release tarball → **blocked**; **PyPI wheel** `ruff-0.15.21-py3-none-manylinux_2_17_aarch64.whl` + stdlib `zipfile` extract (no pip needed) → OK | `ruff 0.15.21` |
| rustc+clippy | `rustup-init` (aarch64) `--profile minimal --default-toolchain 1.96.1 --component clippy` into `/tmp` → OK (warn: no `cc` linker — irrelevant, `cargo clippy` does not link) | `rustc 1.96.1 (31fca3adb 2026-06-26)` · `clippy 0.1.96 (31fca3adb2 2026-06-26)` |
| go + golangci-lint | tarball `go1.22.0.linux-arm64.tar.gz` (first try `aarch64.tar.gz` = 1449-byte error page — go uses `linux-arm64` naming) → `go version go1.22.0 linux/arm64`; then `go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.55.2` (compiles from proxy.golang.org) → OK | `golangci-lint has version v1.55.2 built with go1.22.0 from (unknown, mod sum: "h1:yllEIsSJ7MtlDBwDJ9IMBkyEUz2fYE0b5B8IUgO1oP8=") on (unknown)` |

The golangci version string is **byte-identical** to the committed evidence at `packages/core/backends/golangci/capability-matrix.json:16` — a from-source build at the same pin reproduces the exact toolchain attestation.

**Host-authority caveat:** every firing claim below is container-side. The dispatch's acceptance authority is the host re-fire (`npx vitest run packages/core/backends/{golangci,cargo,ruff,astgrep,npm}/firing.test.ts`), which had **not** run at authoring time. Container-green is evidence, not acceptance — per the 2026-07-24 incident class this lane exists to prevent. It has since been executed at harvest — result and its one gap in **§host-verify** below.

## §host-verify — the dispatch's acceptance contract, executed (added at harvest, 2026-09-09)

Run by the harvesting session on the **host**, not by the authoring run. Host = macOS 26.6.2 arm64,
node v24.3.0 (container was linux-arm64 / node v22.23.1), vitest 4.1.8.

Command (the kickoff's `host-verify` block verbatim, with the cargo pin forced because the host's
default toolchain has drifted past the committed evidence):

```bash
RUSTUP_TOOLCHAIN=1.96.1 npx vitest run \
  packages/core/backends/golangci/firing.test.ts packages/core/backends/cargo/firing.test.ts \
  packages/core/backends/ruff/firing.test.ts packages/core/backends/astgrep/firing.test.ts \
  packages/core/backends/npm/firing.test.ts
```

```text
Test Files  5 passed (5)
     Tests  37 passed | 3 skipped (40)
```

**The assertion is on the skip count, not the exit code** (§self-falsification #2 — exit 0 with
silent skips is the `#container-green-as-acceptance` shape this contract exists to catch).
Skip count is **3, not 0**, and all three are named:

| lane | host tool | live arms | verdict |
|---|---|---|---|
| npm | eslint in-process | 5/5 fired | host-confirmed |
| astgrep | `ast-grep 0.44.1` (= CI pin `audit-self.yml:294`) | 6/6 fired | host-confirmed |
| ruff | `ruff 0.15.21` (= CI pin `audit-self.yml:304`) | 7/7 fired | host-confirmed |
| cargo | `rustc 1.96.1 (31fca3adb 2026-06-26)` / `clippy 0.1.96 (31fca3adb2 2026-06-26)` — byte-identical to the container's and to `cargo/capability-matrix.json` | 9/9 fired | host-confirmed |
| golangci | **ABSENT** (`command -v golangci-lint` → nothing; `go` also absent) | 10/13 — the 3 `firing harness — live golangci-lint check` arms (RED / GREEN / GREEN-clean) reported `↓ skipped` with the suite's loud warning | **NOT host-confirmed** |

The host's default rust toolchain is `rustc 1.98.1 (48a229cea 2026-09-01)`; without
`RUSTUP_TOOLCHAIN=1.96.1` the cargo lane would have fired a different compiler than the one the
committed evidence attests. The pin is the honest run, not a workaround.

**Disposition for go.** Neither this host nor the operator's second machine carries
`golangci-lint`, so the go lane's firing cell stands on two environments, not three: the
container (13/13, §firing) and **CI**, which installs the same pin
(`go install …golangci-lint@v1.55.2`, `audit-self.yml:372`) and carries the J3 live-fire arm
(`audit-self.yml:383-419`). Installing a Go toolchain on the host to close this locally was
declined as disproportionate ([effort-worthiness.md §1](../../rules/effort-worthiness.md) test 4:
material, but cheaper to verify in the channel that already runs it). Anyone reading a go-lane
firing claim should read it as **container + CI confirmed, host-unconfirmed**.


## §matrix — 4 lanes × 6 questions

Legend: **EXEC** = executed this run in-container (command + output quoted in the lane's detail block); **ENUM** = file:line enumeration (T3(b) evidence — a read, not a fire); **RE-VER** = committed matrix evidence re-verified this run by executed gates. No cell is filled by cross-lane analogy (T16).

| Lane | delivery | collision | firing proof | generation | CI gate | capability status |
|---|---|---|---|---|---|---|
| **npm** | EXEC — default install path (not in LANE_TABLE, `install.sh:281` covers python/cargo/go only); `tests/install-sh/consumer-pipeline.test.sh` → `PASS=8 FAIL=0` | EXEC — additive patch idempotency executed (`60-ci.sh:57` arm); config subset + R2 boundary gate arms green in pipeline suite | EXEC — `npx vitest run backends/npm/firing` → **5/5 passed** (in-process eslint, always-on) | YES — only lane with a full research→validate→emit loop (`validator/validate.ts:22-42` 8 gates → `emit.ts:26-46` `rules-manifest-additions.json`) + mutation-kill floor ≥60% | **CONDITIONAL** — preset consumers: `lint:` job `npm run lint` build-failing (`preset-next-15-canonical/templates/github-actions-ci-ui.yml:20-32`); brownfield: `40-configs` patches `eslint.config.mjs` but ships **no workflow** (`setup.d/60-ci.sh:14-18` warns on `.nvmrc` drift only) | `syntax=yes` (`npm/capability-matrix.json:6`); type-aware/dep-graph `no` (FF7001); evidence `live-fired` 2026-07-04; **stale by commits** (4 after, latest `df8011cfe7` 2026-07-22) → RE-VER this run (firing 5/5 + freshness gate green) |
| **python** | EXEC — `setup.d/45-python.sh` (guard `GETFF_TOOLCHAIN=python`); `tests/install-sh/python-entry-lane.test.sh` → `PASS=85 FAIL=0` | EXEC — 85 arms incl. delivered-artefact assertions (`.getff/ruff-bans.toml`, hooks, `getff-python.yml`) + A2-10 fail-closed | EXEC — `npx vitest run backends/ruff/firing` → **7/7 passed** (ruff 0.15.21; TID253 raw diagnostic quoted below); lane self-check `setup.d/45-python.sh:487`; bash runner `_fire_ruff` (`run-rule-tests-firing.sh:273`) — in-repo **no-op** (no sidecar dir, quoted below) | PARTIAL — `render-researched-astgrep.ts:12` self-identifies as «the thin driver half of the **python adapter**» (LG-S1); `backends/ruff/render-ruff.ts` renders TID configs; **closed vocabulary** TID251/TID253 + narrow DTZ005; `kind 'call'` refused FF7001 | YES — `templates/python/github-actions-ci.yml` ships two build-failing jobs as `getff-python.yml`: `ast-grep scan` (`:48-49`, pin `:46`) + `ruff check .` discovered-config (`:71-72`) + isolated `--config` arm (`:81`) | `syntax=partial` (TID slice only) `ruff/capability-matrix.json:6`; live-fired 2026-07-11; **stale by commits** (3 after, `f0bae55250` 2026-08-08 changed this backend's rules) → RE-VER (7/7 + gates) |
| **cargo** | EXEC — `setup.d/46-cargo.sh` (W4 #1080); `tests/install-sh/cargo-entry-lane.test.sh` → `PASS=50 FAIL=0` | EXEC — 50 arms incl. clippy.toml fresh/REFUSE cells + fingerprint arms 17c-f | EXEC — `npx vitest run backends/cargo/firing` → **9/9 passed** (clippy 0.1.96 on pinned rustc 1.96.1; raw `clippy::disallowed_methods` diagnostic matches the committed `capturedDiagnostic` shape, main.rs:2); lane self-check `setup.d/46-cargo.sh:201`; bash runner `_fire_cargo` (`:384`) | PARTIAL — `render-researched-clippy.ts` (LG-S3) renders committed researched rust practice → `clippy.toml`; `write-clippy.ts`/`render-clippy.ts` carry the deny projection (FF7003); one ban verb (`disallowed_methods`) | YES — `templates/cargo/github-actions-ci.yml`: `rustup component add clippy` (`:42-43`) + bans made **build-failing via `-D clippy::disallowed_*`** (`:8-9`, `:44-45`); delivered as `getff-cargo.yml` | `syntax=no` FF7001, `type-aware=partial` live-fired (`cargo/capability-matrix.json:6,10`), 2026-07-03, `rustc 1.96.1 (31fca3adb 2026-06-26)` — **byte-identical** to this container's rustc; stale by commits (6 after) → RE-VER (9/9 + gates) |
| **go** | EXEC — `setup.d/47-go.sh` (adapter-jig J3); `tests/install-sh/go-entry-lane.test.sh` → `PASS=34 FAIL=0` | EXEC — A8-1 two-cell matrix enacted in-suite: fresh→copy `.golangci.yml`, consumer-owned→REFUSE to `getff-golangci.yml` (inert); inert-on-npm byte-identical arm | EXEC — `npx vitest run backends/golangci/firing` → **13/13 passed** (v1.55.2; raw forbidigo diagnostic below; **exit 1 natively** = build-failing without flags); lane self-check `setup.d/47-go.sh:187` (tool-gated LOUD degrade); CI J3 live-fire arm `audit-self.yml:383-419` | **NO — by design.** `backends/golangci/firing.test.ts:195-198`: «the kickoff's `render-golangci.ts` STOP-line (§5) means there is no render function to call (contrast ruff's `renderRuff`)». Zero `golangci` mentions in `packages/core/synthesizer/` (grep executed); no `emit.ts` target; bundle is hand-authored, byte-pinned by the self-application block (`firing.test.ts:199-222`) | YES — `templates/go/github-actions-ci.yml`: pinned `go-version: '1.22.0'` + `golangci-lint@v1.55.2` (`:57-66`), `run --enable forbidigo` non-zero = failing, REFUSE-cell-aware (`--config getff-golangci.yml` first, `:96-106`); delivered as `getff-go.yml` | `syntax=partial` with the honest identity-granularity cap (`golangci/capability-matrix.json:6-12`); live-fired 2026-08-06; stale by commits (3 after, `e40f6d88ef` 2026-09-06 touched the parser) → RE-VER (13/13 + gates) |

Cell-evidence census (T6 predicates, no adjectives): of 24 cells — **12 EXEC** (delivery+collision+firing ×4 lanes, all executed this run), **8 ENUM** (generation+CI-gate ×4, file:line reads), **4 RE-VER** (capability ×4, matrix reads re-verified by 282 executed gate tests). 0 cells INCONCLUSIVE; 0 cells filled by analogy. Acceptance-layer status: host re-fire **executed at harvest** — 4 of 5 lanes host-confirmed, the go lane's 3 live-fire arms skipped for an absent tool (§host-verify).

## §firing — per-lane executed command, raw diagnostic, tool version (gate 2)

**npm** — command `npx vitest run backends/npm/firing --reporter=verbose` (contract `npm/firing-contract.json`: `expectedRuleId: "no-restricted-syntax"`); tool: eslint 10.4.0 (resolved from `packages/core/package.json` `^10.4.0`) in-process, vitest 4.1.8. Quoted arms:

```text
✓ no-restricted-syntax > invalid > const url = process.env.DATABASE_URL; 9ms
✓ no-restricted-syntax > valid   > const url = config.databaseUrl; 41ms
✓ N6 — vacuous-pass protection (RuleTester throws when an invalid-case produces zero violations)
Tests  5 passed (5)  ·  Duration 1.25s
```
No external tool diagnostic exists on this lane by construction (RuleTester asserts in-process) — the diagnostic surface is the RuleTester violation object, asserted RED+GREEN above.

**astgrep** — command `npx vitest run backends/astgrep/firing` → **6/6 passed** (286ms); tool `ast-grep 0.44.1`. Raw fire in `backends/astgrep/fixtures/firing/invalid`: `ast-grep scan --json` →
```json
{"text": "datetime.datetime.now()", "file": "src.py", "lines": "    x = datetime.datetime.now()",
 "ruleId": "no-datetime-now", "severity": "error", "message": "Use an injected clock, not dat…"}
```

**ruff** — command `npx vitest run backends/ruff/firing` → **7/7 passed** (332ms); tool `ruff 0.15.21`. Raw fire in `backends/ruff/fixtures/firing/invalid`: `ruff check --output-format=json` →
```json
{"code": "TID253", "message": "`torch` is banned at the module level",
 "name": "banned-module-level-imports", "severity": "error"}
```
(contract family `{TID251, TID253}`; the committed `capturedDiagnostic` is the TID251 `requests` exemplar — same fixture, sibling violation.)

**cargo** — command `npx vitest run backends/cargo/firing` → **9/9 passed** (720ms); tools `rustc 1.96.1 (31fca3adb 2026-06-26)` / `clippy 0.1.96`. Raw fire in `backends/cargo/fixtures/firing/invalid`: `cargo clippy --message-format=json` →
```text
code: clippy::disallowed_methods
message: use of a disallowed method `std::env::var`
spans: [('src/main.rs', 2)]
```
**Severity nuance (load-bearing):** this raw invocation **exits 0** — the ban is a WARNING until projected. The template's own comment names the mechanism (`render-clippy.ts` FF7003; `templates/cargo/Cargo.lints.toml:3-7`), and the CI gate supplies it via `-D clippy::disallowed_*`. A cargo consumer who deletes both the `[lints.clippy]` merge and the CI `-D` flag has a ban that fires but fails nothing. Contrast **go**, which exits 1 natively: `golangci-lint run --out-format=json --enable forbidigo` in the invalid fixture returned the issue **and exit=1**.

**golangci** — command `npx vitest run backends/golangci/firing` → **13/13 passed** (851ms); tools `golangci-lint v1.55.2` + `go 1.22.0`. Raw fire in `backends/golangci/fixtures/firing/invalid`:
```text
{"FromLinter": "forbidigo", "Text": "use of `os.Getenv` forbidden because \"Read configuration
 through the injected config accessor, never os.Getenv directly\"", "Severity": ""}
Pos: main.go line 7      · golangci exit: 1
```

All 40 firing tests across the five suites passed with **zero skips** (tools present; the loud-skip arms in each `firing.test.ts` never fired).

## §channel-map — which channel proves which lane (§1 open question, gate 3)

The dispatch's fourth question suspected a contract proven by nothing. Answer, with file:line:

| Backend | vitest firing suite | bash runner arm (`run-rule-tests-firing.sh`) | lane self-check | CI install arm (`audit-self.yml`) |
|---|---|---|---|---|
| npm | `firing.test.ts:12-14` — in-process RuleTester, **always-on** (comment: «eslint runs in-process… so this whole suite is always-on in CI») | **excluded by design** — the runner's header (`:1-8`) names itself «the consumer-side companion to run-generated-rule-mutation.sh (npm lane)… THIS runner verifies the NON-npm test material» | n/a (npm lane verifies via mutation runner ≥60% kill floor) | none needed (no external tool) |
| astgrep | `firing.test.ts:23-31` — spawns PATH binary, loud-skip, **no `!isCI`** | `_fire_astgrep` `:206` | via python lane (the astgrep adapter IS the python lane's structural surface) | `:294` `npm install -g @ast-grep/cli@0.44.1` |
| ruff | `firing.test.ts:23-31` — same posture | `_fire_ruff` `:273` | `_py_firing_self_check` `setup.d/45-python.sh:487` | `:304` `pip install ruff==0.15.21` |
| cargo | `firing.test.ts:11-22` — live-fire «wherever cargo is on PATH — including CI (W4)», loud warn when absent | `_fire_cargo` `:384` | `_cargo_firing_self_check` `setup.d/46-cargo.sh:201` | `:333-334` `rustup toolchain install 1.96.1 … --component clippy` |
| golangci | `firing.test.ts:59-72` — loud-skip `console.warn`, **no `!isCI`**; contract non-vacuous guard `:145-150` | **absent by design** — the runner reads `.ai-factory/rule-tests/{astgrep,ruff,cargo}.json` (`:10`); go has no sidecar material | `_go_firing_self_check` `setup.d/47-go.sh:187` — dual-tool gate (go AND golangci-lint), planted violation + clean control, rc=0 loud degrade | `:368-372` `go install …golangci-lint@v1.55.2` + J3 live-fire arm `:383-419` |

**Finding (named, gate 4): NO contract is proven by nothing.** All five have an executed vitest firing suite + a CI install arm; the two bash-runner exclusions are named design boundaries (npm → mutation runner; go → lane self-check + CI J3 arm), not gaps. The honest caveat is conditioned on the machine: on a tool-less host, **4 of 5** suites loud-skip their live blocks (only npm is always-on) — a green `test:backends` run on a bare machine proves parse/fixture/freshness logic, **not** firing. Executed confirmation of the runner's no-op contract in this repo: `bash packages/core/synthesizer/run-rule-tests-firing.sh` → `rule-tests firing: no .ai-factory/rule-tests/ sidecar dir — nothing to fire (no-op).` (exit 0). The dispatch's citation `agents/rule-test-author.md:52` checks out: that line carries the mkdtemp+plant-src isolation mechanic and names npm's contract `expectedRuleId` (in-process).

## §calibration — the three §1 findings, reproduced independently (gate 6)

1. **go ships exactly one ban — CONFIRMED.** `templates/go/.golangci.yml` = `disable-all: true` + `enable: [forbidigo]` (`:12-15`) + exactly one forbid entry `p: 'os\.Getenv'` (`:31`); the template dir holds exactly two files (`.golangci.yml`, `github-actions-ci.yml`). The cargo analogue is real: `templates/cargo/clippy.toml` carries exactly one `disallowed-methods` entry, `std::env::var`, with the paired discipline reason text (`:3-5`). Both fire red/green as shown in §firing.
2. **The template calls itself generated and nothing generates it — CONFIRMED, with a design nuance.** Line 1: `# generated by getff go lane v0 — do not edit by hand`. Negative proven by enumeration: `grep -rn golangci packages/core/synthesizer/` → **zero hits**; render drivers are `render-researched-astgrep.ts` + `render-researched-clippy.ts` only; `emit.ts` writes npm-lane manifest additions only (`emit.ts:26-46`); delivery is a static copy (`setup.d/47-go.sh`, `_go_deliver_golangci` → `copy_safe`). The nuance: the absence is **deliberate** — `firing.test.ts:195-198` cites the adapter-jig kickoff's `render-golangci.ts` STOP-line. So `DOC-LIES` lands narrowly on the word «generated» (no generation path exists), **not** on the header's function: the `grep -q 'generated by getff'` marker at `setup.d/47-go.sh` is load-bearing — it keys idempotency and the consumer-vs-framework ownership split. Any fix must preserve the marker string.
3. **golangci self-reports the identity-granularity cap — CONFIRMED; sweep found no violating doc.** `golangci/capability-matrix.json:6-12` records `syntax=partial` with the forbidigo-linter-name cap verbatim. Executed sweep of shipped + spec docs (`README.md`, `INSTALL-FOR-AI.md`, `INSTALL.md`, `docs/`) for per-rule-attribution claims on the go lane: **no violator found** — the only `forbidigo` mentions outside templates are the historical research patch `2026-07-02-multi-toolchain-generalization.md:68` (describing the ecosystem tool's config surface, not our lane's attribution) and a command example in `2026-08-18-pre-merge-carrier-design.md:113`. The `partial` stands honest and un-contradicted.

## §staleness — re-fire disposition (gate 5)

All five matrices are commit-stale (executed `git log --since=<evidence.date> -- packages/core/backends/<b>/`): npm 4 commits after 2026-07-04 · astgrep 7 after 2026-07-11 · ruff 3 after 2026-07-11 (incl. `f0bae55250` 2026-08-08, which changed ruff rules) · cargo 6 after 2026-07-03 · golangci 3 after 2026-08-06 (incl. `e40f6d88ef` 2026-09-06, parser change).

Disposition — **re-fired, not re-asserted; no matrix hand-edited**:
- All five firing suites re-run this session (40/40, §firing).
- The repo's own freshness gates re-run with every tool live on PATH: `npm run test:backends` in `packages/core` → **26 files / 282 tests, all passed** — i.e. every `checkToolchainFreshness` (including golangci's, `golangci/capability-matrix.test.ts:43`) resolved the live pinned tools and found the committed `toolchain` strings still exact (golangci's byte-identical rebuild is the strongest case).
- Observation, not a defect: the freshness gates operationalize **version** drift only. Commit-count staleness (a backend's code changing after its evidence date) is invisible to them; this lane's gate-5 arm is the current detector for it.

## §findings

- **F1 — `evidence-regeneration.md` is missing its fifth row.** The rule's own promotion trigger («when a fifth backend ships a live-fired matrix, add its row to §2b/§2c/§2e») has fired: golangci has a live-fired matrix and a freshness gate (`deriveGolangciVersion`/`checkToolchainFreshness`, `golangci/capability-matrix.test.ts:43`), but the runbook's firing-command table, toolchain-string table, and pin-site table carry no golangci row. Its §2e line citations have also drifted from the live file (rule says `audit-self.yml:232/:242/:271-272`; live pins sit at `:294/:304/:333-334`, golangci at `:368-372`). Wrong if: the runbook is intentionally scoped to the four S2-era backends — but its own §6 text says otherwise.
- **F2 — cargo's build-failing guarantee is opt-in twice over.** Raw clippy exits 0 on the banned call (§firing). Build-failing requires the CI `-D clippy::disallowed_*` flag or the manual `Cargo.lints.toml` merge. Documented in-template, but any «supported» claim for cargo that omits this is overstated: the out-of-the-box bare `cargo clippy` experience is warn-only. golangci needs no such projection (exit 1 natively); npm needs none (eslint errors are non-zero); ruff/py and astgrep/py fire error-severity in their delivered gates.
- **F3 — the npm lane's CI gate is conditional on consumer shape.** Preset consumers get the `lint:` job; brownfield consumers get an additively-patched `eslint.config.mjs` and **no CI workflow delivery** (`60-ci.sh:14-18`). «The ban is build-failing» is true for the preset path only.
- **F4 — the honesty map in `agents/rule-test-author.md` predates the go lane.** Its «Honesty map v0» covers npm/astgrep/ruff/cargo; golangci (13 tests, freshness gate, CI arm) is absent. The doc's own promotion trigger is a *second* forced edit of the map → this audit's need to annotate go is candidate evidence.
- **F5 — ruff provisioning in CI is pip-only; the wheel route is untested upstream.** This container fired ruff from the PyPI wheel (pip absent). Same version, same `--version` string; the CI resolver (`pip install ruff==0.15.21`) resolves the same wheel on linux. Residual risk is platform-shape drift on non-linux runners. Partly closed: the macOS host re-fire used a Homebrew-route `ruff 0.15.21` and the 7 ruff arms fired identically (§host-verify).
- **F6 — minor, observed:** `_sg_is_astgrep` (`run-rule-tests-firing.sh:203`) exists precisely because `sg` collides with the OS group-exec binary — reproduced live in this container (§environment). Shipped countermeasure works; no action.

## §operator-options — what «N stacks» would honestly mean (decision left open, per umbrella §2)

- **N=1 (npm only).** The only always-on firing lane, the only full research→render→validate→emit generation loop, the only lane whose firing needs no external tool. Honest sentence: «npm consumers get an always-provable ban surface and a real generation pipeline; CI coverage depends on preset vs brownfield shape (F3).» Cost of claiming 1: the smallest claim, but it concedes the multi-stack thesis.
- **N=2 (npm + python).** Adds the lane with the deepest executed suite in this run (85 delivery/collision arms, 7 firing tests, two build-failing CI jobs, a working researched-rule render driver). Honest sentence: «two lanes, both with committed fixtures, both CI-gated, python's bans closed-vocabulary (TID251/TID253/DTZ005).» Cost of claiming 2: none observed this run — this is the strongest per-cell evidence pair.
- **N=3 (+cargo).** Adds a lane whose firing is CI-verified at a dual-pinned toolchain and whose collision/delivery matrix is the most fingerprinted (50 arms) — but whose bans fail builds only after the `-D`/`[lints.clippy]` projection (F2), whose generation vocabulary is one lint verb, and whose compile cost keeps the standing arm opt-in by design. Honest sentence: «cargo is delivered, collision-tested, and CI-fires — build-failing status is a projection you must not delete.» Cost of claiming 3: you inherit the F2 asterisk in every consumer-facing sentence.
- **N=4 (+go).** Adds the newest lane: hand-authored single-ban bundle (deliberately un-renderable), natively build-failing tool, honest `partial` attribution cap, delivery/collision proven by 34 arms, firing proven by 13 tests + a dual-tool lane self-check. Honest sentence: «go ships one ban, provably firing, with per-rule attribution explicitly not promised.» Cost of claiming 4: the lane's generational story is «hand-authored by design» (§calibration #2) — any marketing copy that says «generated rules» is F1-class false for go; and the evidence is the youngest (2026-08-06, 3 commits stale).
- Cross-cutting: whatever N is chosen, the sentence must carry three qualifiers or it re-liquefies — (a) container vs host authority — host-confirmed for npm/astgrep/ruff/cargo, **container+CI only for go** (§host-verify), (b) preset vs brownfield CI shape (F3), (c) warn-vs-failing severity projection (F2, cargo only).

## §self-falsification

Non-trivial ways this report could be wrong, each with its detector:

1. **Fixture-firing ≠ consumer-firing.** My raw diagnostics were fired in the *committed fixtures* (`backends/<b>/fixtures/firing/invalid`), and the vitest suites fire those fixtures — not a fresh consumer dir produced by `install.sh <lane>`. The delivery/collision cells are covered by the entry-lane suites (which do build temp consumers and assert delivered artefacts), and the lane self-checks fire in `mktemp -d` dirs — but I did not run `install.sh go` end-to-end and fire the *delivered* file myself this run. Falsifier: run `install.sh <lane>` into a temp dir, fire the delivered config, compare.
2. **Green-with-skips is possible on the host.** The dispatch's host-verify one-liner does not install the tools. On a host without golangci-lint/ruff/cargo/ast-grep on PATH, 4 suites' live blocks loud-skip and the command exits green having fired only npm. Falsifier: the acceptance run must assert **skip counts = 0**, not exit code — quoting `Tests  N passed` alone is exactly the `#container-green-as-acceptance` shape.
3. **Freshness-green ≠ evidence-current.** The 282-test green proves the committed version strings still resolve; it says nothing about whether the *diagnostics* would change shape under a newer tool. Falsifier: fire unpinned latest tools and diff diagnostic shapes.
4. **Version-pinned containers flatter the evidence.** I provisioned exactly the CI pins, so freshness gates could not go RED by construction. A host with drifted local tools would excise that flattery — which is the point of the host contract.
5. **Wheel-vs-pip ruff (F5).** If the wheel binary and the pip-installed binary diverge on the host, my ruff cell inherits a subtle misattribution. Detector: quote `ruff --version` in the host run (must read `ruff 0.15.21`) — done at harvest, it does (§host-verify).
6. **Coverage honesty (T14):** this audit covers the four shipped lanes' *default single-ban surfaces* on linux-arm64. It does not cover: monorepo/workspace consumers (one test file exercised), non-linux platforms, the `--refresh` pass live, or any ban beyond each lane's flagship. «Lane mature» claims beyond that scope are not backed by this run.

## §self-application (T15)

Did this audit run on itself? Partially, and the gap is named: the audit's claims are gate-backed (executed commands quoted; matrices untouched — verifiable via `git status` showing only this report added), but the audit produced no *new* executable artifact — it is a Class-C prose report on top of executed evidence, which is exactly the shape `attention-is-not-a-mechanism.md` §1 tolerates for *reports* but would forbid for a *check*. Auditing this audit = re-running the six quoted command families and confirming the 24 cell verdicts reproduce; a second auditor should be able to do that from this file alone in under 15 minutes. If they cannot, this report is the thing that lied.

## §counter-prompt (T7 — «what category did I miss?», run against the draft)

Categories re-scanned after draft: (a) **skill-context drift** — do shipped skills claim per-stack support? not checked exhaustively; flagged, not verified, so no cell rests on it. (b) **rules-lock reproducibility** — each lane writes a lock file; I verified delivery arms reference them but did not re-verify lock *contents* this run; covered by entry-lane arms 17c-f (cargo, executed). (c) **the `--refresh` mutation of every cell** — unexecuted this run; declared in §self-falsification #6. (d) **PNPM/yarn consumers** — out of scope (single test file exists: `consumer-matrix-pnpm-flake` umbrella); declared. (e) **consumer upgrade path** — `consumer-upgrade-path.test.sh` exists; not part of the 6 questions; out of scope. No missed category changed a cell verdict.

## §gate-table (dispatch §3 — filled for task #7 self-check)

| # | Gate | Verdict | Evidence |
|---|---|---|---|
| 1 | 24 cells filled or explicit INCONCLUSIVE | **PASS** | §matrix census: 12 EXEC + 8 ENUM + 4 RE-VER, 0 unfilled |
| 2 | firing cells carry command + diagnostic + version | **PASS** (container) · **host: 4/5 lanes** | §firing per-lane blocks; §host-verify (37 passed / 3 skipped, the 3 named) |
| 3 | channel question answered with file:line | **PASS** | §channel-map table |
| 4 | contracts proven by nothing named | **PASS** — named: none; two named by-design exclusions + the 4-of-5 tool-less caveat | §channel-map finding |
| 5 | stale cells re-fired, not re-asserted | **PASS** | §staleness: 40/40 firing + 282/282 freshness gates |
| 6 | three calibration findings reproduced independently | **PASS** | §calibration #1-#3 |
| 7 | no matrix hand-edited | **PASS** — verified at commit time (task #7) | `git status` in commit block |
| 8 | self-falsification non-trivial | **PASS** | §self-falsification #1-#6 |

*Reproducibility: every quoted command is re-runnable per `evidence-regeneration.md` §2b with the pins in §environment. Report is container-side evidence; acceptance is the host re-fire with skip-count assertion (§self-falsification #2), executed at harvest in §host-verify — skip count 3, all three the go lane's live arms.*
