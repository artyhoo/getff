# consumer-matrix-pnpm-flake — done
- Final PR: #1289

- **Umbrella:** `.claude/orchestrator-prompts/consumer-matrix-pnpm-flake/kickoff.md`
- **Opened:** 2026-08-08 (PRs #1274, #1276). **Closed:** 2026-08-08 (UTC).
- **Investigation session:** Handoff worker (Linux container, `feature/consumer-matrix-pnpm-flake-66c203`).
- **Plan:** `.ai-factory/plans/feature-consumer-matrix-pnpm-flake-66c203.md`.

## Verdict: **(c) INCONCLUSIVE**

20/20 in-container runs **passed**; **0 captured failing invocations** of the binding discriminator. The discriminator's first two branches (kickoff step 4 — `(a)` deterministic check/fixture bug ⟺ every captured failing invocation shows eslint `rc≠0`/stderr errors; `(b)` real intermittent installer defect ⟺ a captured failing invocation shows `rc=0` with a rule-free resolved config) **could not be applied** — no failing invocation exists to classify. Per the kickoff's binding rule for this outcome: «record coverage per T6/T14, define reopen trigger (next CI occurrence), add NOTHING that hides the signal».

**No retry/rerun-step wrapper proposed** (T-CMF-A counter-shape — would mask a high-severity intermittent installer defect if hypothesis 2 is real).

## Reproduction stats

| Metric | Value | Evidence |
|---|---|---|
| N (iterations) | **20** | T1 floor met; per-iter log at `/tmp/repro-loop.log` (preserved for this session) |
| Passes | **20/20** | `/tmp/repro-loop-summary.txt` |
| Failures | **0** | n/a |
| Per-iter elapsed (range) | 33–36s | install.sh full + (a)(b)(c) gates per iter |
| Per-iter elapsed (mean) | 34.2s | n/a |
| Total loop elapsed | 683s (~11.4 min) | n/a |
| Captured failing invocations | **0** | binding discriminator produced no input |
| In-situ evidence shape (per run) | `[rc=0 gd=. rel=./src/routes/health.ts cwd=…/apps/api]` (single entry per run) | `rc=0` = eslint fully resolved the config; R2 present in resolved output = `grep -q` succeeded. Anchored patch + capture pipeline live in `/tmp/cell-keep.sh` (line 174 patch block). |

**Binding method (anchored substitution, kickoff step 1):** the shipped cell deletes its fixture on EVERY exit incl. failure (`tests/consumer-matrix/pnpm-monorepo-cell.sh:52`, `trap 'rm -rf "$WORK"' EXIT`). A scratch copy at `/tmp/cell-keep.sh` strips the trap and inserts a Python-anchored patch that replaces `out=$( cd "$gd" && $ESLINT --print-config "$rel" 2>/dev/null )` at the consumer's `scripts/check-rule-enforced.sh:197` with a variant that writes stderr to `$PRINT_CONFIG_EVIDENCE` and logs `rc` + `gd` + `rel` + `cwd` per invocation. Verified on a green run before the loop.

## Verdict evidence (file:line — T3 + T20)

- **Prime-lead line, ship shape:** `packages/core/audit-self/check-rule-enforced.sh:197` runs `out=$( cd "$gd" && $ESLINT --print-config "$rel" 2>/dev/null )` — stderr discarded, rc never inspected. The kickoff identified this as the prime lead; Task 4 confirmed it. A crash-shaped eslint failure (rc≠0) emits the SAME `SILENTLY INERT` line as genuine rule inertness — the observed CI signature is **ambiguous by construction** at this line.
- **Label correction (kickoff Phase -1, verified):** the `✗ root config: R2 … NOT in the resolved ESLint config for src/routes/health.ts — SILENTLY INERT here` line is emitted at `check-rule-enforced.sh:201` from cwd=`apps/api` (reached via the §807 per-workspace recursion at `:62`). `label="root config"` is set by `:193` when `governing_dir "$file"` returns `.` from the CURRENT cwd (`apps/api`) — it means "the eslint.config.mjs at this script's current cwd", NOT "the monorepo root". There is no monorepo-root `eslint.config.mjs` in this fixture.
- **Companion log line:** `check-rule-enforced: no .ts/.tsx source yet — nothing to verify (skipped).` is emitted by a SEPARATE invocation at `check-rule-enforced.sh:146` after `find .` returned empty. In the cell, this is the `packages/lib` workspace invocation (ships only `index.js` per `pnpm-monorepo-cell.sh:117`), not the same call as the failing `apps/api` line.
- **20 in-situ captured invocations, all rc=0 with R2 present:** no (a)-shaped (rc≠0) and no (b)-shaped (rc=0 + R2-absent) evidence was produced by the discriminator.

## Environment gap (T14)

| Axis | CI (signal source) | Container (this investigation) | Host (Task 9) |
|---|---|---|---|
| OS | ubuntu-latest (`audit-self.yml:1491`) | Linux (matches CI) | **macOS** — DIFFERENT |
| node | 22 (`audit-self.yml:1500`) | v22.23.1 (matches) | operator-measured |
| pnpm | 9.12.3 via corepack (`audit-self.yml:1501-1502`) | 9.12.3 via corepack (matches) | operator-measured |
| pnpm store | cold per run (fresh runner) | **warm** across iterations + sanity runs | operator store state |
| Job concurrency | possibly parallel jobs sharing home | fully isolated, serial | n/a |
| `NODE_ENV` | unset (CI default) | forced to `development` (see below) | operator default |

**NODE_ENV override (container-only):** the container default is `NODE_ENV=production`, which makes pnpm skip devDependencies (per memory `project_handoff_container_devdeps_omitted.md`). The CI signal is at section (c); `NODE_ENV=production` fails at section (a) — a DIFFERENT mechanism. The override restores parity with CI for the (c) gate under investigation. **This is NOT an environment mismatch with CI** — CI doesn't set `NODE_ENV=production` — but it IS a record of container-side surgery required to make the cell runnable at all.

**Statistical observation (binding for the verdict):** the kickoff's observed CI rate was ≥2/7 first-attempt failures (~30%). If the true rate were 30%, the probability of observing 0 failures in 20 trials is `0.7^20 ≈ 0.0008` (~1 in 1250). Three plausible explanations, descending likelihood:

1. **The CI burst has resolved** — the 2/7 was a transient window (e.g., a specific registry-latest combination that has since rolled forward). The kickoff's §Evidence already noted same-minute green/red interleaving — consistent with a transient trigger that has now cleared.
2. **Container masks the trigger** — the warm pnpm store across iterations + sanity runs vs CI's cold runners. Cold-cache `pnpm install` may exercise code paths the warm-cache install skips.
3. **CI has hidden env concurrency** — GitHub runners may share home dirs or have sidecar processes; the container is fully isolated.

**Coverage as predicates (T6, no adjectives):**

- 20/20 in-container runs on Linux + pnpm 9.12.3 + node 22 + `NODE_ENV=development` failed to reproduce the CI signal.
- 0 reproductions in those 20 runs.
- CI runs ubuntu-latest on cold runners, possibly with concurrent jobs; container runs warm-store serial.
- Hypothesis 2 (real intermittent installer defect) is **neither ruled out nor confirmed** — the discriminator could not be applied because no failing invocation was captured.
- The 0.7^20 ≈ 0.0008 observation says either the rate dropped (likely) OR the container masks the trigger (less likely but unclosed).

## Reopen trigger (binding)

The next CI run on `.github/workflows/audit-self.yml:1490` that fails section (c) `check:enforced` with the **exact signature**:

```text
✗ root config: R2 (rules-as-tests/no-unsafe-zod-parse) is NOT in the resolved ESLint config for src/routes/health.ts — SILENTLY INERT here
```

When that fires, the captured `print-config.evidence` from the in-situ patch (Task 2 recipe, preserved in `/tmp/cell-keep.sh` — re-apply on the host) **must be preserved**. The shipped cell still `trap 'rm -rf "$WORK"` deletes the fixture on exit (`tests/consumer-matrix/pnpm-monorepo-cell.sh:52`); **landing the `:197` stderr/rc fix (observation 1 below) is a precondition** for the next investigation to discriminate (a)- from (b)-shaped failures automatically instead of requiring a fresh in-situ patch.

## Drive-by observations (Task 7)

**Verdict = (c) → no autonomous code change in this umbrella** (kickoff §Out of scope: «broad consumer-matrix refactors»; CLAUDE.md PR strategy). The following three are surfaced for the maintainer's triage — no autonomous PR.

1. **`packages/core/audit-self/check-rule-enforced.sh:197` swallows stderr and never inspects rc.** Confirmed by Task 4 §(3). It is a **deterministic improvement on ANY outcome**: a future operator reading "SILENTLY INERT" cannot tell crash-shaped from genuine-inertness today. The fix is ~10 LOC (capture rc + stderr to a temp file, log both, emit a different message for crash-shaped failures). Even with verdict (c), the next CI occurrence would be classified automatically instead of requiring a fresh investigation. **Recommended for a separate PR** (not in this umbrella). This is the **precondition** for the reopen trigger above.

2. **`setup.d/70-deps.sh:158-167` ships 16/24 unpinned `CORE_DEVDEPS`.** Confirmed by Task 5. `ci-tool-pinning.md` §2 scope is `.github/workflows/**` + tracked `*.sh` literal install commands — `CORE_DEVDEPS` is data fed to `pnpm add`, so the existing pre-push gate does NOT fire. The `typescript@^5.7.0` pin at `:161` was added precisely because an unpinned `typescript` resolved to `7.0.2` and crashed consumers (`:150-157` comment). The 16 unpinned keys (`@typescript-eslint/utils`, `globals`, `eslint-config-prettier`, `@vitest/eslint-plugin`, `@stryker-mutator/{core,vitest-runner,typescript-checker}`, `dependency-cruiser`, `fast-check`, `glob`, `ts-morph`, `tsx`, `husky`, `lint-staged`, `sort-package-json`, `npm-run-all2`) are the same risk class. **Recommended for a separate PR** that either pins all 16 or extends the `unpinned-tool-install` gate to cover array-data-driven installs.

3. **`setup.d/70-deps.sh:297`'s `pnpm add -D -w` + follow-up `pnpm install` may not materialise workspace deps under `NODE_ENV=production`.** Task 2 sanity-run #1 hit this: declared in `package.json` but absent from `node_modules`. CI does not run with `NODE_ENV=production`, but a consumer who does (per memory `project_handoff_container_devdeps_omitted.md`) hits a deterministic (a)-failure at install self-verify, NOT the (c) signal under investigation. **Not a flake cause** — recorded as a related-but-separate defect.

## Host-verify contract (Task 9)

**Status: NOT executed in this investigation — by design.** Per `scripts/host-verify.sh` header (citing destination-environment-verification.md §2 incident base 2026-07-24 §F3): "The container is not the destination environment, and the worker cannot observe the difference". The worker is Linux; the destination host is macOS — the environment gap the kickoff flags. The runner is HOST-side; the worker records the contract verbatim for the operator to execute on the host.

**Operator step (run on the HOST after merge, before accepting):**

```bash
HOST_VERIFY_TIMEOUT=3600 bash scripts/host-verify.sh consumer-matrix-pnpm-flake
```

Default per-command bound is 900s (`scripts/host-verify.sh:452`); three full install cycles will exceed it — the timeout override is mandatory. A timeout kill must NOT be read as a reproduction; rerun with a larger `HOST_VERIFY_TIMEOUT` instead.

**Contract (kickoff-declared, preserved verbatim):**

```host-verify
export FRAMEWORK_ROOT="$(git rev-parse --show-toplevel)"; fails=0; for i in 1 2 3; do bash tests/consumer-matrix/pnpm-monorepo-cell.sh || fails=$((fails+1)); done; echo "host smoke: $fails/3 failed"; [ "$fails" -lt 3 ]
```

This is a **bounded smoke** (3 rolls against the ~30% observed rate — a clean 3/3 can miss; the reproduction stats live in the worker's 20-run in-container loop above), NOT the reproduction itself. Environment gap: CI failure was on ubuntu; host is macOS — the host result and the container result are independent evidence and CANNOT substitute for CI.

**Container-side reproduction proxy already executed:** the 20-run loop above IS the worker-side equivalent — same Linux + node 22 + pnpm 9.12.3 as CI (audit-self.yml:1491,1500-1502). The host smoke adds a different OS to the evidence base.

## AI traps applied (per kickoff §AI traps + ai-laziness-traps.md §2)

- **T1** — sampling floor 20 met, not 3. 20× did not exceed the task budget.
- **T2** — the methodology (in-situ rc+stderr capture) was RUN against 20 actual iterations, not just designed. Per-iter evidence recorded.
- **T3** — every claim carries file:line (e.g. `pnpm-monorepo-cell.sh:52`, `check-rule-enforced.sh:197`, `setup.d/70-deps.sh:158-167`) or command output (the stats table above).
- **T6** — confidence as predicates: "20/20 in-container runs failed to reproduce; CI rate observed ≥2/7 ~30%; 0.7^20≈0.0008; hypothesis 2 neither ruled out nor confirmed". No "high".
- **T14** — zero local reproductions ≠ "no bug": environment gaps stated (CI=ubuntu cold, container=Linux warm-store, host=macOS).
- **T19** — own cold self-review of the verdict: re-read the discriminator's three branches; confirmed (c) is the only verdict that matches the evidence (0 failing invocations); confirmed the reopen trigger matches the exact CI signature; confirmed no retry/rerun step is proposed (would mask hypothesis 2 if real).
- **T20** — every verdict + observation above cites file:line + the line's actual content.
- **T-CMF-A** — NOT tempted to classify as "infra flake" + retry; verdict is (c) INCONCLUSIVE with explicit "add NOTHING that hides the signal" and three observations surfaced for separate PRs.

## Out of scope (per kickoff)

- Broad consumer-matrix refactors, other cells (npm/yarn), wiring changes from PR #1274.
- Any retry-wrapper "fix" not justified by the verdict (none proposed).
- Drive-by fixes (1)-(3) above — surfaced, NOT autonomously fixed ([CLAUDE.md PR strategy](../../../CLAUDE.md)).

## See also

- [Kickoff](kickoff.md) — investigation tracker, evidence-so-far, load-bearing fork.
- Plan: `.ai-factory/plans/feature-consumer-matrix-pnpm-flake-66c203.md` (container-side artifact, not tracked in the repo) — 9-task executable plan, all tasks ✅ DONE.
- [.claude/rules/attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md) — why a retry wrapper would be `#hope-as-gate`.
- [.claude/rules/ci-tool-pinning.md §1](../../rules/ci-tool-pinning.md) — the pin discipline that observation 2 invokes.
- [.claude/rules/destination-environment-verification.md §2](../../rules/destination-environment-verification.md) — why the host-verify contract runs on the HOST, not in the container.
