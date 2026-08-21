# worktree-env-skills-test-flakiness — investigation tracker

- **Type:** investigation (env), small. NOT a code bug, NOT a Stage-6 regression.
- **Opened:** 2026-06-03 (surfaced during meta-orchestrator-refactor Stage 6 / PR #399).
- **Base:** staging.

## What

5 tests under `packages/core/skills/` fail when run via a full local `npx vitest run packages/core/skills/` **on this Superset worktree** (`/Users/art/.superset/worktrees/.../neighborly-terrier`). They do NOT indicate a code regression.

Failing tests:
- `run-helper.test.ts` (2) — `=== child.sh: END rc=127 …` (command-not-found) on BOTH the positive "clean child → hello/world" case and the paired-negative. Fails even the happy path → systematic **exec/PATH env issue** (spawned `child.sh`'s command not found in this worktree's shell env), not test logic.
- `plan-currency-check.test.ts` (2) — `UNTRACKED-200` / 60-char title truncation; depends on **live `gh` + real repo PR state** (PR #200).
- `planner-discovery.test.ts` (1) — T15 dogfood expecting the real `planner-completeness` umbrella discoverable via `priority-score.sh` on the live repo.

## Already verified (do NOT re-litigate)

- **Independent of Stage 6:** stashing the Stage-6 additions (`evals/`) and running against pristine `origin/staging` reproduces the same `5 failed | 41 passed` — none of the 3 failing files reference `evals/`.
- **Invisible to merge gates (not a silent bypass):** gating CI (`audit-self.yml` → `npm --prefix packages/core run test:principles` = `vitest run principles/`) and `.husky/pre-push` (`test:principles`) run ONLY `principles/`, never `packages/core/skills/`. So these 5 never gated anything; PR #399 merged correctly with them red locally.
- **Matches known pattern:** worktree-env class — memory `host pre-push flaky on full-suite (npx ETIMEDOUT) → container-push reliable`.

## To investigate (small)

1. **`rc=127` root** — why is the spawned `child.sh` command not found in this Superset worktree? Likely the `node_modules` symlink layout / shell PATH in `.superset/worktrees/*` (these worktrees get manual `node_modules` symlinks per memory). Confirm by running the same test in the main checkout vs a container.
2. **`skills/` gate exposure** — decide whether `packages/core/skills/` SHOULD be in a gating job. If yes, the live-`gh`/real-repo-state tests (`plan-currency-check`, `planner-discovery`) need env-guards (skip-when-no-`gh` / fixture the repo state) before they can gate without flaking. If no, document that `skills/` is local/full-suite-only by design.
3. **Canonical full-suite runner** — confirm container-run is the reliable way to run the full `vitest run` (per the known container-push pattern), and note it.

## Out of scope

- No code fix unless (1) reveals genuine fragility in `run-helper.sh` itself (vs. the test's exec env). The helper passed its byte-identity drift check and the principle suite is green.

<!-- host-verify: none — investigation tracker (own header): records verified facts and open questions about test flakiness; any fix lands under the owning umbrella with its own contract -->
