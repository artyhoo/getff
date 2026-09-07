# promote-gate-fixes — DONE

- Final PR: #1600
- Closed: 2026-09-04
- Summary: single stage, both defects that promote PR #1597 surfaced are fixed and **live-fire accepted**. PG-1 — the root `package-lock.json` never recorded the nested `gcp-metadata@7.0.1` that `mongodb@7.5.0` declares as an optional peer, so `guard-liveness-fullsweep` aborted at `npm ci` with `Missing: gcp-metadata@7.0.1 from lock file`; one key, 17 lines, no regeneration (D1). PG-2 — `context7-refresh` reddened `staging` on the service's documented HTTP 400 `{"error":"too-early",…}`; that exact response is now a no-op success and everything else still fails loudly, with no `|| true`, no `continue-on-error` and `--fail-with-body` retained (D3). D4 held: `packages/core/package-lock.json` was verified (`npm ci --prefix packages/core` passes, no `gcp-metadata` entry at all) and deliberately not edited — the night note claiming the desync hit "both layers" was wrong.

## Acceptance (kickoff §5 items 6-7 — the real ones, not local proxies)

Both fired on `staging` head `e999736076` after #1600 merged, because PR #1597's head **is** `staging`:

- `guard-liveness-fullsweep` run `33848360876` — **success**. First completion in the workflow's history; `Install workspace deps (root)` and the full manifest sweep both green. That is PG-1's acceptance, and it is why the defect survived 682 commits: `.github/workflows/guard-liveness-fullsweep.yml:39` fires only on `pull_request: branches: [main]`.
- `context7-refresh` on the same head — **success**, and **not vacuously**: the service really answered `curl: (22)` + `{"error":"too-early","message":"Too early to refresh the project. Last update was 1 days ago. Minimum 10 days required between updates."}`, and the job printed `Context7 index for /artyhoo/getff is already fresh … treated as success`. The carve-out branch itself executed, so PG-2 is exercised rather than merely unexercised.

## Harvest record

aif task `e1e7e2e1-4376-4054-8e95-8367906c901d` (profile `Z.AI GLM-5.3 Flash (implementer)`) → `done`; harvested host-side per `/harvest` §1 step 4 (container bundle → host push, real `.husky/pre-push` gate ran; the Git Data API break-glass was NOT used). Cold `/aif-review` and cold security audit: no blocking findings. Cold fidelity audit round 1: `FIDELITY: GO`, `Audited-SHA: 597ce96092`. Harvest-side independent verification included the paired negative that makes the fix load-bearing rather than incidental — `npm ci` EXIT=0 on this lock, EXIT=1 with `Missing: gcp-metadata@7.0.1 from lock file` on `staging`'s.

## Left open on purpose (recorded in #1600's Parked questions)

The root lock still has no routine-path `npm ci` consumer — its only two are a `main`-only workflow and a release-time regen, which is exactly how this survived. Whether that layer deserves a routine check is a separate decision. Also parked: the `set -u` swallow of the friendly unset-key message (`.github/workflows/context7-refresh.yml:66-68`), and `::`-token log injection through the echoed response body (`:77`), both graded advisory by the security audit.
