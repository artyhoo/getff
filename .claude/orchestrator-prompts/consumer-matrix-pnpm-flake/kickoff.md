# consumer-matrix-pnpm-flake — investigation tracker

- **Type:** investigation (CI flake vs real intermittent defect), small. Tier 2 per CLAUDE.md task-tier routing (root cause unknown → dispatch WITHOUT a `bridge-profile` marker).
- **Opened:** 2026-08-08 (surfaced during PR #1274 — the cross-checkout test-wiring fix; the failure is unrelated to that PR's diff).
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
- **Frequency:** across the last 25 `audit-self` runs (all branches, checked 2026-08-08 via `run_attempt`), exactly ONE run has attempt >1 — this incident. So: first documented occurrence, observed first-attempt failure rate ≈ 1/25. One data point — treat frequency itself as unverified (see traps).
- **Rerun green:** `gh run rerun --failed` on the same commit → 41/41 green.

## The load-bearing fork (why this is worth a session)

`check-rule-enforced.sh` exists to catch **silent rule inertness** — a generated ESLint rule that is installed but not applied. That is the exact defect class this project exists to prevent («rules as tests, not prose»). So the two hypotheses have very different weight:

1. **Racy check or racy fixture** (eslint `--print-config` resolution timing, temp-dir reuse, turbo cache, install ordering) → fix the determinism, keep the gate strict.
2. **Real intermittent installer defect** — `install.sh ts-server --full` sometimes produces a consumer where R2 is genuinely not wired into the resolved config. Then the check did its job, the «flake» is a low-frequency product bug, and a retry/quieting «fix» would permanently mask it.

Do NOT start from hypothesis 1. The cell's own header (audit-self.yml:1488) says «Fail-closed: a missing tool is RED, never SKIP» — the same posture applies here: a blind retry step is the `#hope-as-gate` shape (attention-is-not-a-mechanism.md §1) and is NOT an acceptable outcome of this investigation unless hypothesis 2 is ruled out with evidence.

## To investigate (ordered, small)

1. **Reproduce locally in a loop.** Run `bash tests/consumer-matrix/pnpm-monorepo-cell.sh` ≥20 times (sampling floor per T1; a clean 3-run streak is a sampling artifact, not a finding). Capture per-iteration: pass/fail, and on fail — the fixture dir preserved + `npx eslint --print-config src/routes/health.ts` output from the failing workspace cwd.
2. **Read the two scripts for order-dependency.** `tests/consumer-matrix/pnpm-monorepo-cell.sh` + the generated consumer's `scripts/check-rule-enforced.sh` (source template in `packages/`): what exactly resolves the config («root config» arm), what does «no .ts/.tsx source yet — nothing to verify (skipped)» mean for the second workspace, and is there a window where the config file exists but the plugin isn't yet resolvable.
3. **Enumerate nondeterminism inputs.** Registry-fetched versions inside the fixture (own lockfile? `pnpm install` resolution), corepack, network, `/tmp` reuse, parallelism inside turbo. Anything registry-latest is a suspect (ci-tool-pinning.md posture).
4. **Verdict + fix.** One of: (a) deterministic bug in check/fixture → fix it; (b) real intermittent installer inertness → file it as a defect with reproduction, severity high; (c) INCONCLUSIVE after ≥20 local runs + code read → record honestly with coverage stated (T6/T14), define the trigger to reopen (next occurrence), and add nothing that hides the signal.

## Out of scope

- Broad consumer-matrix refactors, other cells (npm/yarn), and any retry-wrapper «fix» not justified by the verdict.
- Wiring changes from PR #1274 (merged, done).

## Acceptance

- A research note (research-patch or this umbrella's `done.md`) with: reproduction stats (N runs, failures), verdict (a)/(b)/(c) with file:line evidence, and — if (a) or (b) — a fix PR or a filed defect with reproduction steps.

Host-verify contract (run on the HOST before accepting — a green container run is not host evidence; note the environment gap: CI failure was on ubuntu, host is macOS, record it in the note per T14):

```host-verify
bash tests/consumer-matrix/pnpm-monorepo-cell.sh
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
