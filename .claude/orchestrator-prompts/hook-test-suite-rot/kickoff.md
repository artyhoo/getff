# hook-test-suite-rot — why ~15 tests under packages/core/hooks/ fail, and why CI never catches it

- **Type:** investigation / audit (read-only first; fixes only after root-cause, scoped per finding). Run via `/pipeline`.
- **Opened:** 2026-06-17.
- **Base:** staging.
- **Why this exists:** during the 2026-06-17 session a full `npx vitest run packages/core/hooks/` showed **~15 failing tests** across 5 files on clean `staging`. They were confirmed pre-existing (not caused by that session) and the session moved on — but the maintainer flags the volume as suspicious ("слишком подозрительно") and wants the real cause understood, not hand-waved as "env flake".

## The observed failures (clean staging `f9537af`, macOS, this worktree)

`npx vitest run packages/core/hooks/` → ~15 failed / ~595 passed across **5 files**:

| File | failed | first-look hypothesis (UNVERIFIED — confirm or refute) |
|---|---|---|
| `pre-push.test.ts` | 1 | `invokes the remaining audit-self self-tests by literal path` expects `…/audit-ai-docs.test.sh`, but Wave 10.4 migrated it to `.test.ts` ([pre-push.ts:519](../../../packages/core/hooks/pre-push.ts) comment "replaces audit-ai-docs.test.sh"). Stale assertion. |
| `check-doc-authority.test.ts` | 3 | `Authoritative for:` detection (PAIRED-NEGATIVE + 2 boundary) — assertion or detection drift. |
| `worktree-setup-hydration.test.ts` | 3 | symlink/`jq` env-dependence (kickoff symlinks). |
| `link-coordination.test.ts` | 7 | symlink / `$CANON` coordination-dir env-dependence. |
| `end-of-turn-reminder.test.ts` | 1 | `NORMAL-MODE "я выбрал Option A." STILL fires` byte-for-byte guard — possibly locale/env. |

## The structural question (the real point)

CI's gating test job runs **`npm --prefix packages/core run test:principles` = `vitest run principles/`** — it scans ONLY `packages/core/principles/`, never `packages/core/hooks/`. `.husky/pre-push` runs the same `test:principles`. So **the entire `packages/core/hooks/` vitest suite is never gated** — which is exactly how 15 failures accumulated unnoticed. (Confirmed this session; verify independently.)

## What to determine (acceptance — per-file root cause, file:line evidence; T1 = check ALL 5, not a sample)

1. **Per-file root cause** for every one of the 5 files: genuine env-dependence (jq/symlink/$CANON/locale not present in CI/this box) vs **stale assertion** (test rotted against migrated code) vs **a real regression hiding among the noise**. Classify each of the ~15 with evidence.
2. **The CI-gap decision (DECISION-NEEDED, surface — do not self-decide):** should `packages/core/hooks/` be gated? Options: (a) add it to a CI job after env-guarding the env-dependent tests (skip-when-no-jq / fixture $CANON); (b) keep it local/full-suite-only by design and document that explicitly; (c) split — gate the deterministic hook tests, mark the env-dependent ones `it.skipIf(...)`. Describe each option's consequence; the maintainer or an `/orchestrator` session picks.
3. **The stale ones** (e.g. `pre-push.test.ts` `.test.sh` literal) — propose the one-line fix per file, but DO NOT bundle the fixes into this investigation; list them as follow-up scope.

## Out of scope

- Fixing tests in this kickoff (investigation produces a classified report + scoped follow-ups; fixes are separate, per finding).
- The 3 already-merged bug fixes' own tests (those are green; covered by `session-work-verification`).

## §6 AI-traps (ai-laziness-traps §3 obligations)

See [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). Active traps: **T1, T3, T10, T14, T15**.

- **T1 / T10** — enumerate the full failing population FIRST, then root-cause ALL of it. Do not sample 3 of 5 files and call the category understood.
- **T3** — each "env-dependent" / "stale" / "real regression" verdict needs the actual error line + the code it asserts against.
- **T14** — "most are env flakes" with low per-test rigor is "coverage insufficient", not "no real bug". The maintainer's suspicion is precisely that a real failure hides in the pile.
- **T15** — self-application: this investigation audits the project's own test suite; note that the framework's "documents lie; tests don't" thesis is undercut when a whole suite is ungated.
- **T-Rot-A** (domain-specific) — the investigator is tempted to dismiss all 15 as "env-dependent, not my concern" because that is the lowest-effort exit (the asymmetric-skepticism-toward-lazy-path trap). Counter: a per-test root cause is mandatory; "env flake" is a verdict that itself requires evidence (which env dependency, which line, reproduced how).

## Dispatch note

Per [kickoff-staging-placement.md](../../../.claude/rules/kickoff-staging-placement.md): on `staging` before `/pipeline hook-test-suite-rot`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
