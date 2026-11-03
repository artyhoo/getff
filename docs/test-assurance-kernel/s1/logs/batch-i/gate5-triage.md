# Gate 5 (clean-tree sweep) — every RED triaged

> **Runs:** run 1 (truncated) at `7b4292d8d` post-commit-10 — `gate5-sweep-prerepair-truncated.log`
> (the sweep was cut mid-install-sh at 19/161 by the session boundary; 33 of ~35 gate verdicts and
> all install-sh verdicts up to the cut are on record, per-gate raw output preserved under
> `/tmp/run-local-ci-sweep.hIrQyu/`). Run 2 (binding, complete) at `899d33df6` post format-fix —
> `gate5-sweep.log`. Attribution method: denominator-first enumeration of every `[sweep] FAIL`
> verdict (T10), then named-input identity per RED (T3/T22): the same gate re-run at the stage base
> `e03ab279f^` (`436b8d499`) in a scratch worktree `/tmp/base-wt-atak`, plus byte-level input
> identity of every file the gate reads.

## Verdict classes

- **STAGE-CAUSED (repaired in `899d33df6`)** — in-fence mechanical repair, atomic fix commit.
- **STAGE-CAUSED (out of fence → blocking queue)** — derived artifacts whose in-fence SOURCES this
  stage changed; the derived artifact lives outside the write scope, so per the C4/C5 +
  rules-manifest planning precedent it is queued (`dispositions.md`), not edited.
- **PRE-EXISTING** — fails identically at the stage base; not caused by the diff.
- **ENVIRONMENT** — fails only through this container's state (shared node_modules, untracked
  files, tool availability); inputs to the gate are byte-identical base→HEAD or untracked.

## Per-RED triage

| # | RED (run 1) | Class | Named evidence |
|---|---|---|---|
| 1 | `format-check` | STAGE→repaired | `packages/core/eslint-rules/{no-vacuous-assertion,require-effective-assertion}.ts` unformatted under pinned `prettier@3.8.3` (`scripts/format-shipped.sh:160`). Fixed by the canonical gate's own write path; twins regenerated (`32/32 --check`), RuleTester 42/42, vitest 29f/773p; `gh-531-shipped-prettier` 57/57 and `delivered-prettier-conformance` 6/6 re-run GREEN. |
| 2 | `gh-531-shipped-prettier` (install-sh) | STAGE→repaired | Same root cause as #1 — re-run GREEN post-fix. |
| 3 | `delivered-prettier-conformance` (install-sh) | STAGE→repaired | Same root cause as #1 — re-run GREEN post-fix. |
| 4 | `face-facts-check` | STAGE→queue | Committed `docs/site/face-facts.json` pins `principles.count=57`; derivation computes 60 — delta is exactly the stage's principles 51/52/53 (`git ls-tree` count 57 at base vs 60 at HEAD; added-file list = the 3 new principle files). Regen: `node scripts/render-face-facts.mjs --write`; artifact outside fence → `disp-gate5-face-facts-regen`. |
| 5 | `reference-check` | STAGE→queue | `render-reference.mjs --write` drift content = ONLY the new `test-quality-contracts` rule flowing into `docs/site/reference/C.json` (1 adjacency) + `F1.json` (1 entry) — from Batch H's in-fence policy rule. Diagnosed via backup→regen→diff→byte-exact restore (sha256-verified). Regen: `npx tsx scripts/render-reference.mjs --write` → `disp-gate5-reference-regen`. |
| 6 | `getff-dist-manifest` | STAGE→queue | `packages/getff/MANIFEST.sha256` delta = the stage's own files (principles 51–53, guard-liveness, both rules + twins, 6 fence fixtures, eslint configs, rule index). Regen: `bash scripts/build-getff-dist.sh` → `disp-gate5-getff-dist-manifest`. |
| 7 | `byte-identical` (install-sh snapshots) | STAGE→queue (+ENV) | Snapshot diffs are EXACTLY the 6 new `scripts/fences-fire-fixtures/{no-vacuous-assertion,require-effective-assertion}.*` files (fresh installs copy the stage's in-fence audit-self fixtures; frozen baselines predate them). Regen: `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` → `disp-gate5-snapshot-baselines`. The gate's shellcheck section fails on missing binary — ENVIRONMENT. |
| 8 | `citation-fullsweep` | STAGE→queue (3 cites) | (a) `scripts/render-face-facts.mjs:283`→`AGENTS.md:79` and `:284`→`AGENTS.md:99` are empty AT HEAD but carried content at base (`git show base:AGENTS.md` lines 79/99 = `getff:begin` markers) — Batch H's +1 generated rule-index row shifted AGENTS.md down one line. (b) `packages/core/install/wire-synth-rules.test.ts:338`→`eslint.config.mjs:50` was unresolvable at base (no root config — S0 finding), so skipped; the stage's new 49-line root config makes the bare name resolve below line 50. Fixes live in pre-existing out-of-fence files (re-pin / qualify / `cite:historical`) → `disp-gate5-stale-citations`. |
| 9 | `runtime-bundles-drift` | ENV (masks a STAGE item) | Fails FIRST on dependency parity: `fast-uri` 3.1.8 planned by every committed lockfile vs 3.1.7 resolvable in the shared `node_modules` — the stage diff touches ZERO lockfiles/bundles/package.json (empty `git diff --name-only base..HEAD | grep -E 'lock|bundle|package\.json'`), and the base lockfile already pinned 3.1.8: handoff partial-node_modules state. MASKED behind it: `pre-push.bundle.mjs` (last touched `9f22c9e6a`, pre-stage) contains 0 hits for the stage's `runTestQualityLiveness`/`TEST_QUALITY_RULES` although `pre-push.ts` imports `guard-liveness.ts` — the bundle is stale vs the stage's in-fence source. A rebuild HERE would inline fast-uri 3.1.7 (the gate's own phantom-drift warning) → rebuild must happen on a lockfile-clean install → `disp-gate5-runtime-bundle-rebuild`. |
| 10 | `synth-bundle-drift` | ENV | Same fast-uri dependency-parity failure; identical remediation text. |
| 11 | `script-selftests` | PRE-EXISTING 9/58 + delta 3 | Derived loop (`audit-self.yml` → `scripts/*.test.sh`) at base: 9 scripts fail (`apply-husky-patch`, `dot-review-gate/`×7, `host-verify-coverage`) — the pre-existing REDs recorded on staging. At HEAD: 12 — delta = `render-face-facts.test.sh` (≡ #4, STAGE) + `build-runtime-bundles.test.sh` / `build-synth-bundle.test.sh` selftests (≡ #9/#10 fast-uri, ENV). |
| 12 | `canonical-source` | PRE-EXISTING + ENV | Like-for-like `npm --prefix packages/core run test:canonical`: base 51/1 (fail: `native model window reaches source context tier…`), HEAD 50/2 (same fail + `native emitter…all skill populations`). The new failure's assertion message names the skill `aif` — `.claude/skills/aif/` is UNTRACKED (`git ls-files` empty), absent from the fresh base checkout, present only as handoff runtime-bridge pollution in this worktree; the emitter test reads the live `.claude/skills/` dir. Not reachable by any commit. |

## install-sh battery REDs inside run 1 (up to the cut)

- `check-fences-fire-paired-negative` arms (iv)/(vi): ENVIRONMENT. The gate's binary resolution
  (`packages/core/audit-self/check-fences-fire.sh:196,205`) contains hardcoded
  `/app/node_modules/.bin/{tsx,eslint}` fallbacks committed by `5beeb8496` (PR #823, 2026-06-29 —
  present on staging, long predating this stage). `/app` exists only in this container, so the
  dep-missing SKIP the arms exercise never fires and the run lands on the barrel structural skip
  (rc=0) instead of the expected dep-class rc=1. Masked-PATH retest unchanged (resolution is not
  PATH-based). Stage inputs are not consumed by these arms (fixture set = pre-existing
  `no-unsafe-zod-parse` only). SURFACED as a latent portability defect for the coordinator; not
  repaired (out of umbrella, PR-strategy discipline).
- `gh-531-shipped-prettier`, `delivered-prettier-conformance`: see #2/#3 — repaired.

## Run 2 (binding) expectations

GREEN delta vs run 1: #1/#2/#3. Still RED until the queued regens land outside the fence:
#4–#8 (each with a ready-to-run command in its queue entry). Still RED on environment:
#9/#10 (fast-uri) and the base-pre-existing/selftest deltas of #11/#12. WARN-SKIP rows
(actionlint, shellcheck-dependent, md/docs CI-only, claude-dir-ci-only, docs-quality-strict)
are degraded-tool skips, not runs — never counted as coverage.
