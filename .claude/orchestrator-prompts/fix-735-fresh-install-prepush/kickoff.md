# Fresh-install pre-push copy-list completeness (GH #735 re-fix) — kickoff

> **Class:** operational kickoff (dispatch input). Single buildable task — not an orchestration meta-plan.
> **Authoritative for:** scope of the GH #735 **re-fix** — the **fresh-install** code path (`setup.d/50-hooks.sh`) ships the COMPLETE import graph of `pre-push.ts`, so the TS-core pre-push hook never crashes `ERR_MODULE_NOT_FOUND` on a first `./setup -y` (not just on `--refresh`); plus the drift guard (principle 27) is extended to assert the fresh-install path too, so the two copy-lists cannot diverge again.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Base branch:** `staging` (NOT `main` — promote manually).
> **Tracking issue:** [#735](https://github.com/artyhoo/rules-as-tests-aif/issues/735) — REOPENED 2026-06-27; full evidence + the "wrong code path" diagnosis in the issue's latest comment.

## §1 Goal (one phrase)

On a **fresh** consumer, after `./setup -y ts-server` (a first install, **not** `--refresh`), the real git pre-push hook loads **without** `ERR_MODULE_NOT_FOUND` and runs its FULL substance checks — because the fresh-install hook-copy layer ships every module `pre-push.ts` imports (static AND dynamic), exactly like the `--refresh` path already does.

## §2 Why #747 did not fix the fresh install (grounded, `origin/staging`)

PR #747 (merged) added the complete copy-list, but **only inside `install.sh`'s `do_refresh()`** (`install.sh:325-333` `_ts` loop + `:341-349` `_esl` loop), which runs **only on `--refresh`** (`install.sh:386-389`: `if [ -n "$REFRESH" ]; then do_refresh; exit 0; fi`). A first install never calls `do_refresh` — it sources the layer **`setup.d/50-hooks.sh`**, whose copy-list is untouched and still stops at `s17.ts`. So the bug is **live on a fresh install**; the fix landed in the wrong code path.

The guard added by #747 — `packages/core/principles/27-prepush-copylist-complete.test.ts` — reads **only** `install.sh` (`:39` `const INSTALL_SH = resolve(REPO_ROOT, 'install.sh')`). It never inspects `setup.d/50-hooks.sh`, so it stayed GREEN while the fresh-install path was incomplete. That blind spot is part of this fix.

**Current fresh-install path — `setup.d/50-hooks.sh` (verified `origin/staging`):**

| location | current state | needed |
|---|---|---|
| `50-hooks.sh:23-28` — `for ts_hook in …` loop (uses `copy_safe`) | ships only `pre-push.ts`, `utils/run-check.ts`, `utils/git.ts`, `checks/prior-art.ts`, `checks/s17.ts` | + `checks/unpinned-tool-install.ts` (**static** import `pre-push.ts:32` — hard `ERR_MODULE_NOT_FOUND` at load), `checks/guard-liveness.ts` (dynamic `:405`), `checks/cmd-script-liveness.ts` (dynamic `:469`) |
| `50-hooks.sh` — eslint-rules loop | **absent entirely** | new loop shipping `packages/core/eslint-rules/{index.ts,no-unsafe-zod-parse.ts,no-direct-time-randomness.ts,require-otel-span.ts,restricted-syntax-audit-exempt.ts}` → consumer `packages/core/eslint-rules/` (transitive dep of `guard-liveness.ts`'s `../../eslint-rules/index.ts`) |
| `50-hooks.sh:20-22` — closure comment | **doubly wrong**: (1) claims the static closure is `{run-check,git,prior-art,s17}` but omits the **static** `checks/unpinned-tool-install.ts` (`pre-push.ts:32`); (2) says `guard-liveness.ts` "degrades gracefully when absent" — false: the dynamic-import catch calls `die()` (`pre-push.ts:406-407`) = `process.exit(1)` (`pre-push.ts:191-195`) | rewrite to state the complete graph + that the dynamic checks **die() (push-block)** when absent, not degrade |

The complete, correct list already exists at `install.sh:325-333` (`_ts`) + `:341-349` (`_esl`) — mirror it.

## §3 The task

1. **Complete the `setup.d/50-hooks.sh` fresh-install copy-list.** Extend the `for ts_hook in … done` loop (`:23-30`) to add `checks/unpinned-tool-install.ts`, `checks/guard-liveness.ts`, `checks/cmd-script-liveness.ts`. Add a new loop shipping the eslint-rules barrel (`index.ts` + the 4 rule files it re-exports) to `$PROJECT_ROOT/packages/core/eslint-rules/`. **Use the mechanism already in this layer (`copy_safe`)** — do NOT introduce `refresh_safe` here (that's the refresh path's primitive); match the surrounding code.
2. **Fix the `50-hooks.sh:20-22` closure comment** so it states the complete static+dynamic graph and corrects the false "degrades gracefully" claim (the dynamic checks `die()`/push-block when absent).
3. **Prefer de-duplication if low-risk:** if the copy-list can be factored into a single shared source consumed by BOTH `do_refresh` and `50-hooks.sh` (e.g. a shared array/helper in `setup.d/lib.sh`) without disturbing other layers, do that — it kills the drift class at the root. If that refactor is non-trivial or risks the other layers, **just synchronise the two lists** and rely on the guard (task 4) to catch future drift. State which you chose and why in the REPORT.
4. **Extend principle 27 (`packages/core/principles/27-prepush-copylist-complete.test.ts`) to cover the fresh-install path.** It must parse `setup.d/50-hooks.sh`'s loop(s) and assert every module reachable from `pre-push.ts` (static `import` AND dynamic `await import()`) + the eslint-rules barrel is present there — not only in `install.sh`. Keep the existing `install.sh` arms. Note the fresh-install loop variable is `ts_hook` (the install.sh one is `_ts`) — make the loop-parser handle both. Add a **paired-negative** arm proving the new check goes RED when an entry is deleted from the `50-hooks.sh` loop (non-vacuity), mirroring the existing `(c)` arm.

## §4 Scope

**In:** `setup.d/50-hooks.sh` (copy-list + closure comment), the optional shared-helper de-dup, and `packages/core/principles/27-prepush-copylist-complete.test.ts` (fresh-install arms). **Out (do NOT touch — scope violation):**
- `install.sh` `do_refresh` copy-list — already correct (#747); touch only if doing the task-3 shared-helper refactor, and then minimally.
- `pre-push.fallback.sh` / REDUCED-WARN messaging — different concern.
- The R2 selector breadth / `no-unsafe-zod-parse.ts` rule body — separate issue.
- Snapshot baselines / RULES.md / AGENTS.md content — do not hand-edit; if a generated artifact drifts, regenerate via its documented generator, don't edit by hand.

## §5 Acceptance (deterministic — prove done on a FRESH install, the exact gap #747 missed)

The worker MUST verify on a **fresh** install path, not `--refresh`:

1. Fresh consumer (clean-baseline, zero AIF artifacts) → `./setup -y ts-server` → `ls packages/core/hooks/checks/` shows `unpinned-tool-install.ts`, `guard-liveness.ts`, `cmd-script-liveness.ts` all present, AND `ls packages/core/eslint-rules/` shows `index.ts` + the 4 rule files.
2. `node --import tsx/esm packages/core/hooks/pre-push.ts </dev/null` exits **without** `ERR_MODULE_NOT_FOUND`; AND the git-realistic invocation `printf 'refs/heads/x 0000000000000000000000000000000000000000 refs/heads/x 0000000000000000000000000000000000000000\n' | bash .husky/pre-push origin https://example.invalid/r.git` exits 0 (no module-not-found), on Node v22.x **and** v24.x.
3. A planted-violation push is **FLAGGED by the full hook** (not crashed).
4. `npx vitest run packages/core/principles/27-prepush-copylist-complete.test.ts` is GREEN, and goes **RED** when any one entry is deleted from the `setup.d/50-hooks.sh` loop (paste the red output as proof of non-vacuity on the new arm).
5. Full local CI-equivalent sweep green before declaring done (the worker runs the project's check aggregate; a fresh-surface change touches shipped files → expect the snapshot/render gates to matter).

## §6 Build-vs-reuse (per [build-first-reuse-default.md](../../rules/build-first-reuse-default.md))

REUSE: the complete list already exists at `install.sh:325-349` — mirror it; no new install machinery. The guard extension REUSES the established parse-and-assert pattern already in principle 27 (itself the `21-shipped-agent-tools-valid.test.ts` allow-list-gate class). No new dependency, no new framework. Capability commits (if any file ≥80 LOC under `packages/` is added — unlikely here) carry a `Prior-art:` trailer; this is a copy-list + test-arm edit, so `Prior-art: skipped — completes an existing copy-list + extends an existing principle test, no new capability` is the expected trailer.

## §7 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this fix: **T3** (every claim carries command-output / file:line — no prose-only findings), **T10** (enumerate the FULL import graph — static AND dynamic AND the transitive eslint barrel — before claiming the fresh-install copy-list complete), **T15** (self-application: the extended guard must itself go RED when the `50-hooks.sh` loop is mutated), **T19** (own cold-QA: actually run a FRESH `./setup -y` and invoke the hook — CI form-checks are not consumer behaviour; #747 passed CI yet crashed the fresh install).

Domain trap **T-PREPUSH-FRESHPATH-A** (the 3rd-recurrence trap): tempted to "fix" by editing `install.sh` again (the file the issue title and #747 both name) and re-run `--refresh` to "confirm" — that re-confirms the already-correct path and misses the real fresh-install layer `setup.d/50-hooks.sh`. The bug lives in the path a **first** `./setup -y` takes. Verify on a fresh install, not `--refresh`. A fix + a guard that both still only touch `install.sh` is the 3rd recurrence, not a fix.
