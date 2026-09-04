# consumer-matrix-pnpm-flake — investigation tracker

- **Type:** investigation (CI flake vs real intermittent defect), small but **rising-frequency — disrupts PR CI repo-wide; dispatch promptly after this kickoff merges**. Tier 2 per CLAUDE.md task-tier routing (root cause unknown → dispatch WITHOUT a `bridge-profile` marker).
- **Opened:** 2026-08-08 (surfaced during PR #1274 — the cross-checkout test-wiring fix; the failure is unrelated to that PR's diff). Second occurrence ~20 min later on PR #1276 — this kickoff's own docs-only PR.
- **Base:** staging.

## What

The `audit-self.yml` job **«Consumer-matrix start cell — pnpm workspace monorepo (launch-preannounce-track S2)»** (job def: `.github/workflows/audit-self.yml:1490`, script: `tests/consumer-matrix/pnpm-monorepo-cell.sh`) failed once on a first attempt and passed on rerun with zero diff:

- Run: `31222026820` attempt 1, job `93008451113`, branch `claude/fervent-elion-fcbcf4` (PR #1274), 2026-08-07T21:58 UTC.
- Failing section: **(c) green-on-clean** — `check:enforced` gate (`scripts/check-rule-enforced.sh` inside the generated consumer fixture).
- Exact failure output (quoted from the job log — logs expire, this excerpt is the preserved evidence):

  ```text
  ▶ check-rule-enforced: verifying R2 (rules-as-tests/no-unsafe-zod-parse) is actually APPLIED to boundary files (via eslint --print-config)
    ✗ root config: R2 (rules-as-tests/no-unsafe-zod-parse) is NOT in the resolved ESLint config for src/routes/health.ts — SILENTLY INERT here (verified from the package's own cwd, as `turbo run lint` resolves it).
  check-rule-enforced: FAILED — R2 is not applied to ≥1 boundary file (silent inertness).
  check-rule-enforced: no .ts/.tsx source yet — nothing to verify (skipped).
  ✗ FAIL: (c) clean-tree gate 'check:enforced' not green
  ```

- Context from the same log: fixture at `/tmp/consumer-matrix-pnpm.g72nVN/consumer`; installer self-verify passed 3/3 moments earlier; sections (a) banner honesty and (b) toolchain load probe were green; typecheck / format:check / arch:check / check:globs green; corepack pinned pnpm 9.12.3.

## Evidence so far (do NOT re-litigate)

- **Not caused by the PR:** PR #1274's diff is 2 lines in the `principles-meta-tests` job of `audit-self.yml`; the pnpm cell consumes none of it.
- **Not pre-existing red:** two control `audit-self` runs on staging started the same minute (runs `31222069426`, `31222061084`, no #1274 content) — pnpm cell green in both. The last completed staging run before that (`31219870077`) was also green.
- **Frequency (updated after the 2nd occurrence):** the 25-run `run_attempt` probe (2026-08-08) initially showed this as the ONLY rerun-carrying run — but within the evening window 21:57–22:17 UTC the picture is: fail 21:58 (run `31222026820` att.1, PR #1274), pass ×2 21:57 (staging controls `31222069426`/`31222061084`), pass 21:58 (`claude/pipeline-getff-freshness-widening-fe4271`), pass ~22:00 (rerun of the first fail), **fail 22:17 (run `31223276292`, job `93012211714`, PR #1276 — a docs-only diff: one markdown kickoff file, the strongest possible control)**. ≥2 first-attempt failures in ~7 attempts (~30%) — treat as high-frequency stochastic, NOT deterministic: greens and reds interleave within the same minutes, so registry-version drift ALONE does not explain it (same registry state produced both outcomes).
- **Identical signature both times:** same «R2 … NOT in the resolved ESLint config for src/routes/health.ts — SILENTLY INERT» on «root config», same «no .ts/.tsx source yet» skip on the second workspace. **Read the labels correctly** (Phase -1 review correction): the «root config» label is cwd-relative, not the monorepo root — `check-rule-enforced.sh` sets `label="root config"` when the file path has no workspace prefix from the *current* cwd (`packages/core/audit-self/check-rule-enforced.sh:193`); the quoted path `src/routes/health.ts` carries no `apps/api/` prefix, so that invocation ran INSIDE the `apps/api` workspace and «root config» = `apps/api/eslint.config.mjs`. The second log line («no .ts/.tsx source yet — nothing to verify») is a SEPARATE invocation (`check-rule-enforced.sh:146`), not the same one.
- **Prime lead (Phase -1 review finding — start here):** `packages/core/audit-self/check-rule-enforced.sh:197` runs `out=$( cd "$gd" && $ESLINT --print-config "$rel" 2>/dev/null )` — **stderr is discarded and the exit code is never checked**, so a transient eslint crash / module-resolution error emits the exact same «SILENTLY INERT» line as genuine rule inertness. The observed signature is ambiguous BY CONSTRUCTION. No hypothesis can be chosen until a failing invocation is captured with rc + stderr.
- **Rerun green:** `gh run rerun --failed` on the same commit → 41/41 green (occurrence 1).
- **Pinning status (read from the scripts, 2026-08-08):** the fixture's OWN deps are pinned (`zod 3.23.8` at `tests/consumer-matrix/pnpm-monorepo-cell.sh:87`, `packageManager pnpm@9.12.3` at `:75`), lockfile is generated fresh each run (`pnpm install --silent` at `:143`); the framework toolchain lands via `install.sh ts-server --full` (`:149`) and is **largely UNPINNED**: `setup.d/70-deps.sh:158-167` (CORE_DEVDEPS) installs `@typescript-eslint/utils`, `globals`, `eslint-config-prettier`, `@vitest/eslint-plugin`, `dependency-cruiser`, `ts-morph`, `tsx`, `husky`, `lint-staged` with NO version and `eslint@^9` / `typescript-eslint@^8.59` as carets, via `pnpm add -D -w` at `setup.d/70-deps.sh:297`. That range is step 3's concrete enumeration target. Note the same-minute green/red interleaving above still says version drift is not the SOLE cause.

## The load-bearing fork (why this is worth a session)

`check-rule-enforced.sh` exists to catch **silent rule inertness** — a generated ESLint rule that is installed but not applied. That is the exact defect class this project exists to prevent («rules as tests, not prose»). So the two hypotheses have very different weight:

1. **Racy check or racy fixture** (eslint `--print-config` resolution timing, temp-dir reuse, turbo cache, install ordering) → fix the determinism, keep the gate strict.
2. **Real intermittent installer defect** — `install.sh ts-server --full` sometimes produces a consumer where R2 is genuinely not wired into the resolved config. Then the check did its job, the «flake» is a low-frequency product bug, and a retry/quieting «fix» would permanently mask it.

Do NOT start from hypothesis 1. The cell's own header (audit-self.yml:1488) says «Fail-closed: a missing tool is RED, never SKIP» — the same posture applies here: a blind retry step is the `#hope-as-gate` shape (attention-is-not-a-mechanism.md §1) and is NOT an acceptable outcome of this investigation unless hypothesis 2 is ruled out with evidence.

## To investigate (ordered, small)

0. **Container preflight (do this first — a red here is an ENV failure, NOT a reproduction).** The cell fail-closes when tools are missing (`pnpm-monorepo-cell.sh:63` «RED never SKIP»), and CI provides what the container might not: `node -v` must be 22 (audit-self.yml:1500), `corepack enable && pnpm --version` must work (CI does it at `:1501-1502`; corepack downloads `pnpm@9.12.3` from the npm registry on first use — network required), and `FRAMEWORK_ROOT` must point at the repo checkout (CI sets it at `:1505-1506`). Export `FRAMEWORK_ROOT` explicitly before every run.
1. **Hypothesis-neutral evidence capture in a loop.** The shipped script deletes its fixture on EVERY exit including failure (`trap 'rm -rf "$WORK"' EXIT` at `pnpm-monorepo-cell.sh:52`, no keep-env exists) — so run an UNCOMMITTED scratch copy with the trap stripped: `sed '/^trap /d' tests/consumer-matrix/pnpm-monorepo-cell.sh > /tmp/cell-keep.sh`, echo the `$WORK` dir per iteration. **`FRAMEWORK_ROOT` export is mandatory for the copy** — the default is derived from `${BASH_SOURCE[0]}/../..` (`pnpm-monorepo-cell.sh:50`), which from `/tmp/cell-keep.sh` resolves to `/` and `install.sh` is not found. **Capture must be IN SITU, not post-hoc:** a later re-run of `eslint --print-config` on the preserved fixture is a NEW invocation — the transient condition need not still hold, and a post-hoc rc=0 with the rule PRESENT matches neither step-4 branch. So after `install.sh` completes and BEFORE the (c) gate loop, patch the consumer's copy of the check so the `:197` invocation's stderr and rc are recorded per call — **anchored to the print-config line only** (`2>/dev/null` occurs 6× in that file; an unanchored substitution funnels `find` stderr into the evidence file): `sed -i '/--print-config/s|2>/dev/null|2>>'"$WORK"'/print-config.err|' "$WORK/consumer/scripts/check-rule-enforced.sh"` (absolute `$WORK` expanded at patch time; extend similarly to log `$?`). Portability note: `sed -i "<expr>"` is GNU-only — the container is Linux (fine); for host replication on macOS use `sed -i '' "<expr>"` or write to a temp file and move. **Disk policy:** with the trap stripped every fixture survives, each carrying a full toolchain `node_modules` — `rm -rf "$WORK"` on PASSING iterations, keep only failures, or ~20 preserved fixtures will exhaust disk and manufacture fake failures mid-loop. Time run #1 and report it (each iteration = fresh `pnpm install` + `install.sh --full` registry-installing ~25 devDeps — minutes, not seconds). Target ≥20 runs (T1 floor); if 20× exceeds the task budget, run the max feasible N≥10 and state coverage per T6/T14 — never silently under-run.
2. **Read the two scripts for order-dependency.** `tests/consumer-matrix/pnpm-monorepo-cell.sh` + the check source `packages/core/audit-self/check-rule-enforced.sh` (copied into the consumer as `scripts/check-rule-enforced.sh` by `install.sh:873`): establish the cwd of each of the two quoted log lines first (`:193` label logic, `:146` separate skip invocation), then whether a window exists where the config file is present but the plugin isn't resolvable — and whether the `:197` swallowed-stderr defect should be fixed regardless of verdict (an error-vs-inertness discrimination in the check itself is a deterministic improvement on ANY outcome).
3. **Enumerate nondeterminism inputs.** Concrete target: the unpinned `CORE_DEVDEPS` install at `setup.d/70-deps.sh:158-167` + `:297` (see §Evidence), plus corepack, network, `/tmp` reuse, turbo parallelism. Anything registry-latest is a suspect (ci-tool-pinning.md posture) — but remember the same-minute green/red interleaving: drift alone is not the whole story.
4. **Verdict + fix.** One of: (a) deterministic bug in check/fixture → fix it; (b) real intermittent installer inertness → severity high, file it with reproduction; (c) INCONCLUSIVE after N runs + code read → record honestly with coverage stated (T6/T14), define the trigger to reopen (next occurrence), and add nothing that hides the signal. **Mechanical discriminator (binding, on the IN-SITU capture from step 1):** hypothesis 2 is «ruled out» ⟺ every captured failing invocation shows eslint rc≠0 / stderr errors (crash-shaped), and none shows rc=0 with a rule-free resolved config. Third outcome: if a post-hoc re-check on a preserved failing fixture shows the rule PRESENT, that proves the condition was transient — it classifies nothing by itself; only the in-situ record decides. If `gh` is unavailable in the container for (b), record the defect + reproduction in this umbrella's `done.md` and name the issue-filing as the follow-up — do not stop to ask.

## Out of scope

- Broad consumer-matrix refactors, other cells (npm/yarn), and any retry-wrapper «fix» not justified by the verdict.
- Wiring changes from PR #1274 (merged, done).

## Acceptance

- A research note with: reproduction stats (N runs, failures, per-run timing), verdict (a)/(b)/(c) with file:line evidence, and — if (a) or (b) — a fix PR or a filed defect with reproduction steps.
- **Output artifact: default = this umbrella's `done.md`** (tracked; outside principle 09's header scope — it is in neither `REQUIRED_HEADER_DOCS` nor the dynamic sweeps). Only use a `docs/meta-factory/research-patches/` file if the finding is a genuine coverage-gap record — that folder's declared purpose — and then it MUST pass its CI gates: filename `YYYY-MM-DD-<slug>.md`, first line matching `<!-- scope:... -->` (principle 10, `10-research-patch-annotation.test.ts:23`), a §1.7 self-review section (principle 13), and the Problem/Root Cause/Solution/Prevention/Tags sections per `research-patches/README.md`, ≤100 LOC.

Host-verify contract (run on the HOST before accepting — a green container run is not host evidence; note the environment gap: CI failure was on ubuntu, host is macOS, record it in the note per T14). This is a bounded smoke (3 rolls against a ~30% observed rate — a clean 3/3 can miss; the reproduction stats live in the worker's N-run loop), not the reproduction itself. Run it as `HOST_VERIFY_TIMEOUT=3600 bash scripts/host-verify.sh consumer-matrix-pnpm-flake` — the default per-command bound is 900s (`scripts/host-verify.sh:452`) and three full install cycles will exceed it; a timeout kill must not be read as a reproduction:

```host-verify
export FRAMEWORK_ROOT="$(git rev-parse --show-toplevel)"; fails=0; for i in 1 2 3; do bash tests/consumer-matrix/pnpm-monorepo-cell.sh || fails=$((fails+1)); done; echo "host smoke: $fails/3 failed"; [ "$fails" -lt 3 ]
```

## AI traps (per .claude/rules/ai-laziness-traps.md §2-§3)

Active traps for this investigation: T1, T2, T3, T6, T14, T19, T20.

- T1 — reproduction floor ≥20 runs; «3 clean runs → flake unconfirmed → close» is the trap.
- T2 — reading the scripts and *reasoning* the race exists ≠ demonstrating it; findings need a concrete failing invocation or an explicit INCONCLUSIVE.
- T3 — every claim carries command+output or file:line.
- T6 — confidence as predicates: «N/20 local runs failed; hypothesis 2 ruled out by X» — not «high».
- T14 — zero local reproductions ≠ «no bug»: state coverage («did not reproduce in 20 runs on macOS; CI runs ubuntu — environment gap unclosed»).
- T19 — cold self-review of any fix diff before handoff.
- T20 — the final verdict quotes the evidence that backs it.
- **T-CMF-A (domain-specific):** tempted to classify as «infra flake», add a retry/rerun step, and close — without ruling out that the installer intermittently ships a consumer with R2 silently inert. The check's whole purpose is catching that; a retry masks it permanently. Counter: hypothesis 2 must be explicitly ruled out (or confirmed) with evidence before any resilience mechanism is proposed.
