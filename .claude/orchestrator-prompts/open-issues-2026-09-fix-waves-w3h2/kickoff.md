# Kickoff — W3-H2: make the windows-hooks cell green (windows suite, second wave)

> **Status: operator-approved («A», coordinator session 2026-10-04).** Dispatch only AFTER this file is merged to `staging` ([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
> **Type:** execution-build, single task. aif dispatch via runtime-bridge, default project profile.
> **Base branch:** `staging`. **Branch:** `fix/windows-hooks-win-spawn`.
> **Parent program:** [open-issues-2026-09-fix-waves/kickoff.md §0](../open-issues-2026-09-fix-waves/kickoff.md) — rules 1-11 BIND here verbatim (cite as §0.<n>). Predecessor wave: §3 W3-H (PR #2025, open, red on its own new cell — see §1). Issue: #1799.
> **Rigor label (L0): `build-and-verify`** — every fix is gated by the windows-latest cell, the only Windows proof channel (§0.10).

## 1. Goal and acceptance

One deliverable: `npx --no-install vitest run hooks` (spelled from `packages/core`, `.github/workflows/audit-self.yml` `windows-hooks` cell) **exits 0 on windows-latest** with the anti-hollow floor (≥100 passed) and the step summary intact. Acceptance = a GREEN `windows-hooks` CI run on this wave's PR.

Secondary invariants, each RED-blocking:

- POSIX behavior byte-identical (§0.11): on darwin/linux no spawn arm, expectation, or skip changes — every `skipIf(WIN_…)` arm is dead code off-Windows.
- darwin full hooks suite green (`npx vitest run packages/core/hooks`); a timeout-class failure on a file OUTSIDE the diff discharges via one isolated re-run (known Mac-flaky spawn class, #1987; precedent #2022 verify note).
- Local CI sweep green before every push (`bash scripts/run-local-ci-sweep.sh`), including the MANIFEST regen chain (§0.3: `scripts/build-getff-dist.sh`, test files ARE dist entries) and the citation gate.
- Skip budget (§4) respected — a green cell bought with mass skips is `#discipline-theatre`, not acceptance.

Host acceptance commands (detail in §5; the WINDOWS verdict itself has no local channel — §0.10 — so its command reads the CI record):

```bash host-verify
npx vitest run packages/core/hooks
bash scripts/run-local-ci-sweep.sh
bash scripts/build-getff-dist.sh --check
gh run list --workflow audit-self.yml --branch fix/windows-hooks-win-spawn --json conclusion -q '.[].conclusion'
```

## 2. Measured state (the worklist)

First live firing of the cell — Actions run `37204947592`, job `111444135497`, 2026-10-04, at #2025 head `4d3d72b75a4`: vitest exit 1 — **37 files / 209 FAIL, 1371 PASS, 611 named-skip**. Issue #1799's pre-W3-H measurement (2026-09-15): 37 files / 237 FAIL, 913 PASS, 8 skip. The `fs.symlinkSync` fixture class is gone (the W3-H sweep: junction helper + 611 named skips); the residue is OTHER Windows-hostility classes.

Population greps at `4d3d72b75a4` (worklist inputs — RE-GREP at your HEAD, T1):

- **125** `spawnSync('bash' | '/bin/bash' | 'sh', …)` sites across **49** test files — on win32 `spawnSync('bash')` does not resolve and `/bin/bash` does not exist → `status: -1` (the check-kickoff-traps cluster: 31 FAILs, every one `expect(status).toBe(0)` got `-1`, e.g. `check-kickoff-traps.test.ts:84,254`).
- **49** sites spawn absolute POSIX binaries (`/bin/…`, `/usr/…`) — e.g. `check-worker-dispatch-channel.test.ts:248` `/usr/bin/which`.
- **276** `execSync(` / `execFileSync(` sites (git resolves via git.exe; bash-script invocations do not).
- **10** test files assert `isSymbolicLink()` on links created by bash SUTs — Git-for-Windows `ln -s` copies by default, so the assertion reads `false` (`link-coordination.test.ts` 5 FAILs «must be linked: expected false to be true»; `worktree-setup-hydration.test.ts` «state.md present AS A SYMLINK»).
- **7** SUT scripts carry `ln -s` (`scripts/*.sh`, `.claude/hooks/*.sh`, `packages/core/hooks/*.sh`).
- Path-shape class: ENOENT on DOS short-path forms (`RUNNER~1` in the job log) and separator/encoding-sensitive expectations (`checks/pr-stale-revert-bin.test.ts:182` — expected a stderr message, got `''`).

Per-file FAIL tally from the job (worklist; top first): `pre-push.consumer-layout` ~40, `check-kickoff-traps` 31, `worktree-node-modules` 16, `checks/*` bins ~20, `validate-prompt` 7, `check-worker-dispatch-channel` 7, `runtime-bridge-dispatch` 6, `hook-emit-prelude` 6, `worktree-doctor` 6, `getff-work` 6, `create-worktree` 6, `link-coordination` 5, `lang-parity` 4, `deps-hash-check` 4, `check-doc-authority` 4, plus singles/triples — the job log is the full list.

## 3. Strategy (diagnosis-first, ordered)

0. **Merge-forward the predecessor tip FIRST (binding, before any edit).** Your worktree forks from `staging`, which does NOT contain the cell — you could never see your own results. The container has NO github egress, so the coordinator pre-seeds the predecessor tip into your base clone as the TAG `w3h2-predecessor` (= PR #2025 head `4d3d72b75a4`, W3-H sweep + windows-hooks cell + citation fixes). Run: `git merge --no-ff w3h2-predecessor` — nothing to fetch, the objects are in your clone. From this merge your tree carries the W3-H sweep + the cell, and every push of yours runs it. NEVER rebase or force-push that history (it is a published PR head; force-push is machine-blocked anyway).
1. **Diagnose on CI per class before fixing.** Windows does not exist locally (§0.10). One targeted CI probe per hypothesis (a temp print in a TEST file on your PR branch is the sanctioned capture channel — never a workflow edit outside the existing cell). Do not derive fixes from the log alone.
2. **Shared bash-resolver helper** (the W3-H helper pattern, `packages/core/hooks/symlink-or-junction-or-skip.ts` precedent): e.g. `spawn-bash-or-skip.ts` — POSIX = byte-identical pass-through to today's spawn (same argv shape, same status semantics, zero behavior change); win32 = resolve Git Bash (`bash.exe`) — PATH first, then common install roots — and a NAMED SKIP (reason string, never silent) for cases no Git Bash can satisfy (spawning absolute `/bin/…`/`/usr/…` binaries, MSYS-only tooling). Convert the spawn sites of FAILING files first (the §2 tally is the worklist; a file that goes green after its spawn sites are converted is done — do not sweep green files).
   - BFR consult REQUIRED before the helper lands: SSOT consult + context7 ≥3 phrasings («node resolve git bash path windows spawn», «isomorphic shell spawn windows ci», «cross platform bash detection node») + WebSearch; the helper commit carries a `Prior-art:` trailer (≥80 LOC ⇒ capability commit per CLAUDE.md).
3. **bash-SUT `ln -s` class = named skip, not a production fix.** The SUTs are production scripts; teaching them Windows link strategies is out of scope and §0.11-hostile. Each affected case: `it.skipIf(WIN_SYMLINK, '<reason naming the SUT behavior>')` (precedent: link-coordination's 20 arms from W3-H). Where a junction-based fixture CAN hold on Windows, convert instead of skip — judgment per case, named in the diff.
4. **Path-shape class:** portable path construction where the test can hold; named skip where the OS shape IS the subject.
5. **Iterate:** push → the cell runs on your PR → next class. Expect 2-4 CI round trips. Every intermediate push stays green on darwin/linux.

**Anti-goals (each is a RED review finding):** weakening the cell (the exit-0 requirement, the floor, the step summary — all stay); whole-FILE skips without per-case reasons (every skip in the diff must be `skipIf(WIN_…)` with a reason); editing production `.sh` SUTs to make tests pass; touching `.claude/hooks` SSOT twins (§0.4); any CC-visible behavior change (§0.11).

**Park triggers (STOP + surface, do not improvise):** a failure class that requires a production script change to fix; a class you cannot diagnose in ≤2 CI probes; the skip budget (§4) would be exceeded; the cell floor (>100 passed) becomes unreachable because too much of the suite is legitimately Windows-untestable.

## 4. Skip budget (anti-theatre)

Baseline: 611 named skips (from W3-H). This wave may ADD skips only for: bash-SUT-symlink cases (est. ≤40 across the 10 `isSymbolicLink` files), absolute-POSIX-binary spawn cases Git Bash cannot cover (est. ≤49 sites' worth of cases), diagnosed-unholdable path-shape cases. **Hard ceiling: +150 named skips.** A green cell beyond the ceiling = hollow = RED at review even if the floor passes. The report carries a per-class skip-delta table (before/after).

## 5. Verify (enumerate every one in the report)

1. windows-latest `windows-hooks` cell GREEN — run link + the step-summary line (passed ≥100, skips counted).
2. Zero residue: every file in §2's tally re-derived at the final head — green, or its remaining cases carry named skips with reasons (grep evidence per file: `npx vitest run hooks` JSON + `git grep -n "skipIf(WIN"`).
3. darwin: `npx vitest run packages/core/hooks` green (timeout-class on out-of-diff files discharged by isolation re-run — name them).
4. linux (aif container): same suite green.
5. `bash scripts/run-local-ci-sweep.sh` green at the final head.
6. W3-H invariants intact: `grep -rn "symlinkSync" packages/core/hooks/*.test.ts` still 0 fixture call sites; `git diff` over `symlink-or-junction-or-skip.ts` empty.
7. `bash scripts/build-getff-dist.sh --check` + the citation gate green (regen chain rides the commits, §0.3).

## 6. AI traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md).

**Active traps for this wave: T1, T3, T7, T12, T15, T20, T22.**

- T1 — the §2 tally is a floor, not the ceiling: re-grep every class predicate at your HEAD after each fix round; the first green file must not end the class.
- T3 — every class claim in the report carries `file:line` or the CI log line; no prose-only findings.
- T7 — after each class goes green, run the adversarial counter-prompt «which Windows-hostility class did I fail to enumerate?» against the fresh failure list; a silent result is suspicious (rephrase, run again).
- T12 — Git Bash resolution and MSYS `ln -s` policy are active-doc territory: WebSearch at proposal time, not from memory.
- T15 — §self-application: does this wave's own test machinery obey the CC-invariant it enforces? Produce the finding.
- T20 — skip-vs-fix is a verdict per case: cite the diagnostic output that justifies it.
- T22 — the shared spawn helper is a NEW channel between test and SUT: pin every input it can move, and prove RED against `git show HEAD:<path>` pre-images of every file the fix touches (a one-file pre-image hides the sibling effect).

**Domain trap T-W3H2-A — green-by-mass-skip:** the cheapest path to exit 0 is skipping everything that fails. The floor catches <100 passed; it does NOT catch 1300-passed-plus-600-new-skips. Counter: the §4 budget, the per-class skip-delta table, and review-time grep of every `skipIf(` added in the diff.

## 7. Landing (binding)

- PR base=staging, head=`fix/windows-hooks-win-spawn` (carrying the merge-forward of #2025's branch). Body: `## Summary` names both waves; `Closes #1799` lives HERE (§0.8 — this PR completes the fix); carry BOTH aif-task marker lines verbatim — yours AND `aif-task: 891c7686-626d-4cd8-bbb7-0cc4a06f76f3` (the W3-H task's return channel resolves against a merged PR body carrying its marker).
- On merge: #2025 is SUPERSEDED — the merging session closes it (not merge) with a comment linking this PR; its content is contained in the squash. done.md for the umbrella is written by THIS PR's merging session (umbrella-closure convention), reporting 9/9 waves + this follow-up.
- `Closes #N` hygiene: no other issue carries `Closes` from this wave.
