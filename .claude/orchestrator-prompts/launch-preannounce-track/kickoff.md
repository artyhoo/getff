# launch-preannounce-track — consumer-matrix gate, pre-push owner-split, cargo demo, zcode probe, npm pivot-lite — KICKOFF

> **Status:** ARMED (owner GO 2026-07-10). This file is the binding scope statement for the sessions that execute the remaining pre-announce track.
> **Open by:** new Claude Code session. Run `/orchestrator` (or `/pipeline launch-preannounce-track`). One stage = one executor session (single-owner-per-stage; run the CLAUDE.md pre-dispatch in-flight probe before dispatching any stage).

---

## §0 Context and the one rule that overrides everything

A two-night ultra-review (2026-07-09/10; operator-private plan doc, off-repo) diagnosed the consumer-install failure classes behind the 66-issue corpus and produced a phased plan. The **P0 hotfix track already landed on staging in parallel** — do NOT redo it: #923 + #943 (pre-push consumer guards incl. zizmor workflow-count), #939 (CORE_DEVDEPS typescript@^5 + @types/node + zod), #942 (monorepo stack detection: explicit arg + root fallback + loud all-unknown), #947 (honest self-verify banner, SKIP accounting), #949 (.ai-factory SoT files materialized at landing), #951 (operator-suite skills gated behind `--with-aif-suite`), #946 (legacy setup.sh retired), #932 (fences-fire strict mode).

**The S.0 rule (binding for every stage):** staging moves fast — the review itself went stale by 31 commits mid-flight. Before implementing ANY item below, re-verify its premise against fresh `origin/staging` (`git fetch` + targeted grep/test). If the premise is already fixed, record the finding in the stage report and skip forward. Declaring an item still-broken from a stale snapshot is trap T-LPT-B (§6).

Baseline facts verified on staging `c1ddebbfd`, re-checked at `f02a3db01` / #957 (2026-07-11): no consumer-matrix CI job exists (zero real `pnpm install` anywhere in workflows; Node hard-pinned '20' everywhere except the scoped f17 matrix); `packages/core/package.json` still `"name": "@rules-as-tests/core", "private": true`; no `demo:cargo` target; `rule-channel-capabilities.json` zcode cell still hand-declared.

## §1 Goal + umbrella acceptance

Make the framework's launch claims demonstrable on a stranger's repo, mechanically:

> On a foreign machine, on a repo shape the framework never saw (including a pnpm workspace monorepo), `./setup --full` completes in ≤20 minutes to a state where (a) a planted violation of any shipped rule is blocked through the REAL channel (`npx eslint .` CLI + husky pre-commit + a real `git push` to a local bare remote), (b) `npm run validate` is green on the clean tree, (c) no success banner can print over a dead or skipped shield, and (d) a subsequent framework release reaches that consumer without losing enforcement.

This umbrella closes when that acceptance is CI-mechanized (S2), the push channel is structurally consumer-safe (S3), the cargo demo fires (S4), the harness matrix carries no unfalsified cells (S5), and the npm dependency-delivery path is proven against a packed tarball with publish-readiness handed to U10 (S6). Write `done.md` at the last-stage merge per the CLAUDE.md umbrella-closure convention.

**Host-verify contract** (per [destination-environment-verification.md §1](../../rules/destination-environment-verification.md); added 2026-08-10, when the arm-1 gate first fired on this file — the kickoff predates the rule). Run with `bash scripts/host-verify.sh launch-preannounce-track`:

```bash host-verify
# S2 acceptance — the start cell: a real `install.sh ts-server --full` into a fresh pnpm
# workspace monorepo fixture that installs its OWN deps (T-LPT-A), asserting (a)-(i).
bash tests/consumer-matrix/pnpm-monorepo-cell.sh
# S3 acceptance — every pre-push section carries an owner tag and composition fails CLOSED,
# so a maintainer-only section cannot leak onto a consumer layout by forgetting a guard.
npx vitest run packages/core/principles/32-prepush-section-owner.test.ts
# S6 acceptance — the packed-tarball consumer path: `files` allowlist + bin runnability.
bash tests/consumer-matrix/npm-tarball-cell.sh
```

**What this contract deliberately does NOT cover** (stated, not silently omitted — `#contract-that-cannot-fail`): **S4** needs a `cargo`+`clippy` toolchain and **S5** needs the operator's zcode install, so neither is host-portable; each carries its evidence in its own stage report. A green run of the three commands above is therefore evidence about S2/S3/S6 only.

## §2 Stages

### S1 — Foreign-repo calibration (½–1 day)

Run the real installer (`./setup --full`, consumer profile) against 2–3 genuinely foreign OSS repos — at least one pnpm workspace monorepo, one flat npm app — cloned fresh, never seen by the framework. Record every failure verbatim (rc, output, root cause hypothesis). Authored fixtures inherit author blind spots; foreign repos are the calibration source for which S2 matrix cells matter. Output: a calibration report committed under this umbrella dir + a GitHub issue per NEW defect class (check the issue tracker first — many classes are known/closed).

### S2 — Consumer-matrix acceptance gate (the core stage, ~1 week)

One fail-closed CI job family that mechanizes §1 acceptance. Start with a SINGLE mandatory PR cell and grow incrementally.

- **Start cell:** pnpm workspace monorepo · Node 22 · ubuntu. Fixture shape (committed skeleton, calibrated against S1 findings): root `package.json` (private, `packageManager: pnpm`), `pnpm-workspace.yaml`, `apps/api` (depends on `zod`, has `src/`), `packages/lib` (has `src/`). The fixture installs its OWN dependencies — a real `pnpm install`. Borrowing/symlinking the framework's `node_modules` into the fixture is trap T-LPT-A (§6) and voids the cell.
- **Fail-closed polarity for this tier:** a missing tool (eslint/tsx/tsc) in the fixture = RED, never SKIP; `skipped` must not count as pass for this job in `scripts/ci-success-gate.sh`.
- **Asserts per cell, all paired (RED observed before GREEN, per the project's own T15 discipline):**
  (a) install rc=0 and the final banner contains no false success (SKIP accounted, form-scoped wording — #947 + #957 behavior held under this topology);
  (b) toolchain substrate resolved in-fixture;
  (c) `npm run validate` green on the clean tree;
  (d) one planted violation per shipped rule blocked via the REAL channels — `npx eslint .` rc≠0 AND pre-commit blocks the commit AND a real `git push` to a local bare remote is blocked/passes per the S3 push-channel contract. Never the ESLint Linter-API shortcut;
  (e) false-positive arm: a known-legitimate source file (e.g. a literal `ConfigSchema.parse` on internal config) produces ZERO rule errors — a rule that cries wolf is as dead as a silent one;
  (f) `--refresh` from an N-1 install delivers a fix and the planted violation starts being blocked;
  (g) `format:check` green under a divergent consumer `.prettierrc` (printWidth 100 + organize-imports — the historical #531 config);
  (h) stryker: config PLACED on this topology (today it ships only on the flat path — 0 mutants on pnpm monorepos) + `stryker run` with a score threshold in one cell; add the mutation job to `ci-success` `needs:`;
  (i) push channel exercised with a real `git push` (bare remote) on clean tree → allowed.
- **Wiring:** merge-blocking via `ci-success` `needs:` (SHIPPED — `.github/workflows/audit-self.yml:1658`); local on-demand `make consumer-matrix` (SHIPPED — `Makefile:34`). **Pre-push: RETIRED 2026-08-10 — do not build.** Measured on the operator's Mac before deciding: **108s cold / 38s warm** per invocation of `tests/consumer-matrix/pnpm-monorepo-cell.sh` (two consecutive runs, both `EXIT=0`), against 35–47s for the same cell on a CI runner. Runtime alone would be arguable; the disqualifier is **hermeticity**. The cell runs a real `pnpm install` (`tests/consumer-matrix/pnpm-monorepo-cell.sh:143`) and a real `install.sh ts-server --full` (`:149`), and its declared polarity is fail-closed — «a missing tool in-fixture is RED, never SKIP» (`:42`). At pre-push those compose into *every offline push hard-blocked*, with no honest SKIP arm available — a worse failure mode than the one the gate prevents. The repo already reached this verdict for the sibling local channel: `scripts/run-local-ci-sweep.sh:35-38` lists `consumer-matrix-start-cell` under UNREACHABLE — «network, minutes, non-hermetic» — so a pre-push section would contradict a standing, reasoned classification of this exact job. Per [rule-enforcement-channel-selection.md §3](../../rules/rule-enforcement-channel-selection.md) the gate belongs at the earliest *reachable* channel; here that is CI, where it already blocks merge, with `make consumer-matrix` as the operator's opt-in local run. Re-open only if the cell becomes hermetic (an offline-capable fixture install) — the network dependency is the blocker, not the seconds. Immediately (one line, before anything else): add the existing `framework-fresh-install-validate-multistack` (audit-self.yml:795) and `shipped-prettier` (:99) jobs to `ci-success.needs` — they can currently go RED without blocking merge. Precondition: verify each is GREEN on current staging first (wiring a red job into `needs:` deadlocks all merges); if red, fix-first or wire with a dated escape note.
- **Corpus/manifest note:** the planted-violation corpus and owner-tags needed by (d)/S3 are seeded HAND-AUTHORED in this umbrella (a minimal data file listing shipped rules → violation fixture). Generating them from the full delivery manifest is the later P2 upgrade — do not build the full manifest here.
- **OS axis (explicit degrade):** ubuntu on PR; macOS cells run nightly/locally only (`make consumer-matrix` on the operator's Mac). Record in the job header that BSD-awk/husky-v9/symlink-tmp classes are NOT PR-covered.

### S3 — Pre-push structural owner-split (~1–2 days)

The #923/#943 per-section guards are the interim band-aid; this stage replaces the convention with structure. (1) Introduce an owner tag (`consumer | maintainer | both`) on every pre-push section (registry or two entrypoints — executor's design call); the consumer entrypoint composes ONLY consumer/both sections; an untagged section fails a principle test at CI, so a future maintainer-only section cannot leak by forgetting a guard. (2) Consumer-topology smoke: tmp repo, default branch `main`, no `packages/core`, install, benign commit, execute the shipped pre-push `main()` → assert exit 0. (3) Decide and implement the consumer push-channel CONTRACT: today the shipped hook checks nothing consumer-authored at push — either add fast consumer checks (lint on the diff) or declare the push channel thin explicitly in RULES.md; the S2 (d)/(i) asserts encode whichever contract is chosen.

### S4 — Cargo honest demo, F2a (owner GO; ~1–3 days)

The render→fire chain is proven (a fresh ConventionNode → `renderCargoClippy` → clippy.toml → real `cargo clippy` fires; verified twice in the review). Missing is packaging: (1) a clippy.toml writer + committed example crate + `demo:cargo` target (Makefile or npm script) that plants a banned call and shows `cargo clippy` fail; (2) severity projection — emit `[lints.clippy] <lint> = "deny"` (or `[workspace.lints]`) so error-severity bans fail the build (today everything degrades to warn → `cargo clippy` exits 0 over a live violation — FF7003 path in `render-clippy.ts`); (3) wording sweep: everywhere the repo/promo pairs "clippy/cargo-deny", keep clippy present-tense-demo and cargo-deny explicitly roadmap (cargo-deny backend is 0 LOC — FF7001 refusal). Done: `demo:cargo` red-on-planted / clean-on-negative-control, gated at least on the developer-machine live-fire path (per existing `firing.test.ts` pattern), no present-tense cargo-deny claim anywhere.

### S5 — zcode probe, F3 (timebox: half a day, hard)

Live-probe the zcode cells of `.ai-factory/rule-channel-capabilities.json` on the operator's machine (zcode is installed there). For each claimed capability (sessionStartHook, postToolUseInject, …): a minimal executable probe with recorded output. Outcomes: (a) probe passes → keep `supported`, commit the probe artifact + add an `axis: operator|shipped` field so operator-env capability is never again conflated with shipped-consumer delivery; (b) probe fails or timebox expires → downgrade the cell to `reference` in the same PR. Done: zero cells in the matrix whose value is not backed by either a probe artifact or an honest `reference`/`not-delivered` marker.

### S6 — npm pivot-lite PREP, F1×F5 hybrid (owner GO; reversible prep only — the publish itself is owned elsewhere)

**Ownership boundary (binding):** the irreversible `npm publish` + `private:true` drop is node **U10** of [`getff-to-prod-meta-launch`](../getff-to-prod-meta-launch/kickoff.md), gated there on U9 (repo-split + `@getff/*` rename) and U11 (name-freeze). This stage does every REVERSIBLE step up to that line and hands off: (1) narrow `packages/core` `exports` to the honestly-supportable surface (the 7-subsystem import cycle means the current 5-module exports map over-promises — do NOT untangle the cycle here; that is post-announce work); (2) publish-readiness: files-field/bin audit, dry-run `npm pack` byte-inspection, README/license fields — everything so U10 becomes a one-command act after name-freeze; (3) dependency-delivery wiring behind a flag: consumer hooks+checks delivered from the packed module (thin `.husky/*` shims calling the package bin), exercised in a matrix cell against a locally-packed tarball (`npm i <tarball>` — no registry needed), flipped to default only after the S2 start cell is green AND U10 has published; (4) rollback stays live: file-copy path remains functional; consumers pin last-good; `npm unpublish` is not a rollback (72h rule) — roll forward with patch releases. Done: `npm pack` output audited + dependency-path matrix cell green against the tarball + file-copy fallback passes the same cell + a handoff note to U10 recorded in this umbrella dir.

## §3 Sequencing

S1 → S2 (S2 fixtures calibrated by S1). S3, S4, S5 may run parallel to S2 in separate sessions/worktrees (disjoint surfaces). S6 steps (1)–(2) may start immediately; step (3) default-flip is gated on the S2 start cell being green AND U10 published. Kickoff must be ON STAGING before any dispatch (kickoff-staging-placement §1).

## §4 Out of scope (do not drift into)

Full delivery manifest (P2) beyond the minimal hand-authored corpus/owner seed files; the 7-subsystem SCC untangle; stacks.manifest / new stacks; live-research delivery; per-harness emission (#898 — parked, BFR DEFER); plugin-marketplace delivery; hexagonal refactors. Go-to-market itself (Show HN / README narrative / channels / metrics) is owned by the sibling umbrella [`public-launch`](../public-launch/kickoff.md) (U12) — this umbrella is its engineering prerequisite, not its executor (note: U12's gate already names `@getff` as the expected install scope — S6 naming coordination input). Surfacing a systemic find mid-stage = observation in the stage report, not a drive-by PR (CLAUDE.md PR strategy).

## §5 Evidence pointers

Issues #931 #934 (OPEN — S2 mechanizes their classes) and #920 #921 (CLOSED by the landed P0 guards — S3 replaces those guards structurally); staging commits listed in §0 (the already-landed P0); `tests/install-sh/` + `audit-self.yml` fresh-install jobs (the fragments S2 consolidates — reuse, don't parallel-build, per build-first-reuse-default). The review's full evidence bundles live off-repo with the operator; every load-bearing claim above is re-verifiable from the repo + issue corpus alone.

## §6 AI traps

Per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) §3 obligations. **Active traps for this umbrella: T1, T2, T3, T5, T15, T19, T20, T21.** Domain-specific:

- **T-LPT-A — validating the matrix through the framework's own substrate.** Symlinking framework `node_modules` into a fixture, hoisting tsx at the framework root, or asserting rule-firing via the in-process ESLint Linter API instead of `npx eslint .` + real git hooks. This is the exact form-over-behaviour shortcut the umbrella exists to kill; any cell that takes it is void (counter: assert the fixture's own lockfile + `command -v` inside the fixture, and fire through the real channels only).
- **T-LPT-B — declaring an item still-broken from a stale snapshot.** The review's own baseline went 31 commits stale mid-flight and P0 landed in parallel sessions. Counter: the §0 S*.0 rule — re-verify every premise on fresh `origin/staging` before coding; if fixed, record and skip.
- **T-LPT-C — green-cell-by-construction.** Authoring the fixture around what the installer already handles (the skeleton mirrors the framework's happy path) instead of around S1's foreign-repo findings. Counter: every S2 assert must have an observed RED arm first (T15), and the fixture shapes must trace to the S1 calibration report.

## §7 Reporting

Per stage: a stage report in this umbrella dir (premise re-verification result, what landed, PR #, RED→GREEN evidence for each paired assert, deviations). On last-stage merge: `done.md` per the CLAUDE.md schema.
