# Worker kickoff — GH #642: R2 Layer-2 wirer resolves ts-morph from the wrong tree

> Mode A inline Agent (Opus), worktree-isolated. Orchestrator pushes + opens the PR; you do NOT.
> v3 — CI strategy switched to **option A** (declare ts-morph as a `packages/core` devDep, in-pattern with f16/f17) after Phase -1 round-2 BLOCKER B-NEW: option B's runtime registry install is an anti-pattern (first network-dependent test in the job; contradicts the f16/f17 "declared dep + locate-or-skip" convention; brittle to egress-hardening).

## TASK

Fix GH #642: `packages/core/install/wire-eslint-r2.ts` falsely degrades to "ts-morph not present" on every consumer because its dynamic `await import('ts-morph')` resolves from the wirer FILE location (the framework checkout), not the consumer's `cwd`. Fix the resolution; add a **genuinely fail-first, non-skipping, in-pattern** test that proves the cross-checkout wire path; declare ts-morph as a `packages/core` devDep (the test engine + a latent undeclared import need it); correct the misleading code comments.

- ISSUE: #642 (OPEN). One PR to `staging`.
- BRANCH: create `fix/642-r2-wirer-cwd-resolve` based on `origin/staging`. Verify your worktree HEAD == `origin/staging` (currently `48d8409`) before starting.
- You do NOT push, do NOT open a PR, do NOT run the full `npm run check:all` (slow — orchestrator does the final sweep).

## WHY ts-morph is declared in this PR (root-cause, not scope-creep)

ts-morph is imported by the framework in **two** places but declared in **no** package.json:
- `packages/core/install/wire-eslint-r2.ts:86` (the wirer, dynamic import — the #642 bug)
- `packages/core/probes/audit-r4.ts:11` (`import { Project } from 'ts-morph';` — a **static** import; R4 currently relies on ts-morph being present by luck of consumer `--full` installs).

Both stem from one root: ts-morph is used but never declared. Declaring it as a `packages/core` devDep (a) gives the new test a setup-installed engine to locate (in-pattern with f16/f17), and (b) fixes the latent undeclared `audit-r4.ts:11` import. This is one coherent fix, not a drive-by.

## ENVIRONMENT BOOTSTRAP (do this FIRST — your isolated worktree has no node_modules)

1. Declare ts-morph (see DEP DECLARATION below) **before** installing.
2. `npm install --prefix packages/core` — installs `tsx` (declared `packages/core/package.json:49`) **and now ts-morph** into `packages/core/node_modules/`. This is the same step CI runs at `audit-self.yml:206`.
3. CI runs **Node 20** (`audit-self.yml` `node-version: '20'`) — no `node --experimental-strip-types`. The committed test MUST invoke the wirer via **tsx** (`RUN_WIRER_TSX`), never the wirer's shebang.

## THE BUG (orchestrator-verified; re-confirm file:line, don't re-litigate)

- `wire-eslint-r2.ts:86` — `await import('ts-morph')` is a **bare specifier** → resolves from the **importing file's directory** (framework), not `process.cwd()` (consumer).
- `install.sh` invokes it (~line 1517) as `( cd "$PROJECT_ROOT" && npx --no-install tsx "$_wirer" ... )`, `_wirer="$PKG_ROOT/packages/core/install/wire-eslint-r2.ts"` (line 1496), `PKG_ROOT`=dirname of install.sh (line 35). cwd=consumer, file=framework → different trees.
- Guards check the **consumer** and pass: `install.sh:1493` + `wire-eslint-r2.ts:169` (cwd-relative `existsSync('node_modules/ts-morph/package.json')`). But `:86` resolves from the framework tree → `ERR_MODULE_NOT_FOUND` → false `degrade` (`:89-95`). Net: after clean `--full`, per-package configs unwired → `check:enforced` exits 1 → `validate` RED.

### CRITICAL — `:169` guard runs BEFORE the `:86` bug (do not get this wrong)

CLI path: `main()` → cwd-relative guard `:169` → `wireConfigSource()` → import `:86`.
- A consumer **without** ts-morph degrades at **`:169`** and never reaches `:86` (this is what existing Fixture F does → it does NOT exercise the bug).
- To exercise the `:86` bug, the run's **`cwd` MUST have ts-morph** (clears `:169`) while the **wirer file lives in a tree WITHOUT ts-morph up-tree** (so unfixed `:86` fails). Only then is the test RED for the RIGHT reason (the `:86` import, not the `:169` guard).

## THE FIX (wire-eslint-r2.ts)

In `wireConfigSource` (`try` block `:85-96`), resolve ts-morph from `process.cwd()`:

```ts
// existing imports already present: resolve (node:path, line 25), process (node:process, line 26)
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
// ... replacing `const mod = await import('ts-morph');`:
const requireFromCwd = createRequire(resolve(process.cwd(), 'package.json')); // base = a FILE path in cwd
const tsMorphPath = requireFromCwd.resolve('ts-morph');                       // resolves from <cwd>/node_modules
const mod = await import(pathToFileURL(tsMorphPath).href);                    // pathToFileURL required (raw abs path → ERR_UNSUPPORTED_ESM_URL_SCHEME)
```

- Keep `try/catch → degrade` (genuine consumer-absence still degrades correctly).
- **Comment edits only — do NOT change the degrade *string* at `:46`.** It couples with `wire-eslint-r2.test.ts:137` regex `/ts-morph not present/`, and post-fix the string is accurate. Reword only the misleading code comments `:82` (the "CWD's node_modules" mental model) and the `:8-10` docstring. Minimal, honest.

## DEP DECLARATION (packages/core/package.json)

Add `"ts-morph": "^24.0.0"` to `devDependencies`. **Pin `^24.0.0` to match the project's canonical pin** at `setup.sh:336` (`ts-morph@^24.0.0`) and SSOT #131 — do **NOT** use `npm install ts-morph`'s latest (currently `28.x`): a framework `^28` vs consumer `^24` is exactly the `#two-prompts-drift` the project forbids ([dual-implementation-discipline.md §8](../../rules/dual-implementation-discipline.md)). (`install.sh:1355` CORE_DEVDEPS lists ts-morph **unpinned**, so it is NOT the version source — `setup.sh:336` is.) Caret style matches sibling devDeps (`tsx: "^4.22.4"`). This makes the commit a **capability commit** → real Prior-art trailer (NOT the skip-trailer):

```text
Prior-art: prior-art-evaluations.md#131 (ts-morph REUSE — declaring the engine already imported by packages/core/probes/audit-r4.ts:11 + the R2 wirer; in-pattern with f16/f17 stryker/eslint devDeps; SSOT #131 pre-cleared, no new capability introduced)
```

(Build-vs-reuse gate is satisfied: SSOT #131 already records the ts-morph REUSE verdict — no new SSOT entry needed.) **Do NOT edit the SSOT #131 row** — it is an append-only register (Artifact Ownership Contract) and its "confirmed NOT in `packages/core/package.json`" clause was true at eval time. Note the premise change (ts-morph now also a framework devDep) in the **PR body**, not by rewriting the SSOT row.

## TDD — MANDATORY fail-first, non-skipping, in-pattern (the crux; T2/T14/T-642-B)

Add a fixture to `tests/install-sh/wire-eslint-r2.test.sh` (CI-wired at `audit-self.yml:313`, runs in `principles-meta-tests` where `npm install --prefix packages/core` (line 206) now installs ts-morph). RED on UNFIXED code, GREEN after fix; capture BOTH transcripts.

1. **FIRST**, before the fix, add the fixture + run vs CURRENT wirer → MUST FAIL (degrade, config unchanged). Paste output. If it passes on unfixed code it's masking the bug — it must fail at the `:86` import, NOT the `:169` guard (see CRITICAL).
2. **THEN** apply the fix → re-run → passes. Paste output.

### Fixture shape — in-pattern (locate-or-skip like f16/f17), NO network, NO symlink

Use the **declared + setup-installed** ts-morph in `packages/core/node_modules` as the consumer's engine by setting `cwd=packages/core` (which has ts-morph) while running a **COPY** of the wirer from a temp dir that has no ts-morph up-tree:

```bash
# locate the engine (in-pattern with f16-stryker / f17 — declared dep, locate-or-skip-loudly)
TSM=""
for d in "$REPO_ROOT/packages/core/node_modules/ts-morph" "$REPO_ROOT/node_modules/ts-morph"; do
  [ -f "$d/package.json" ] && { TSM="${d%/ts-morph}"; break; }   # TSM = the node_modules dir that holds ts-morph
done
if [ -z "$TSM" ] || [ -z "$RUN_WIRER_TSX" ]; then
  echo "  [skip] ts-morph/tsx not installed (run: npm install --prefix packages/core) — fixture skipped"
  ok "X: skipped (engine absent on host) — runs in CI where setup installs it"
else
  FW=$(mktemp -d)
  cp "$REPO_ROOT/packages/core/install/wire-eslint-r2.ts" "$FW/"   # wirer has only node-builtin + dynamic-ts-morph imports → single-file copy self-contained. VERIFY: grep -nE "from ['\"]\\.|require\\(['\"]\\." finds nothing.
  CFG=$(mktemp -d)/eslint.config.mjs
  printf "import base from './base.mjs';\nexport default base;\n" > "$CFG"
  # cwd = the dir that HAS ts-morph (packages/core or repo root, whichever TSM points at);
  # the COPIED wirer lives in $FW which has NO ts-morph up-tree → unfixed :86 import fails.
  CWD_DIR="${TSM%/node_modules}"
  out=$( cd "$CWD_DIR" && "$RUN_WIRER_TSX" "$FW/wire-eslint-r2.ts" --path "$CFG" --yes 2>&1 )
  # ASSERT WIRED: unfixed → degrade, $CFG unchanged → FAILS (RED, correct). fixed → R2 appended → PASS.
  grep -q 'rules-as-tests/no-unsafe-zod-parse' "$CFG" \
    && ok "cross-checkout wire succeeds (cwd has ts-morph, wirer file does not)" \
    || bad "cross-checkout NOT wired (degraded): $out"
fi
```

- `--path "$CFG"` is an **absolute** path (the wirer `resolve()`s it; cwd only affects ts-morph resolution, not the config path).
- `--yes` REQUIRED (non-interactive without it degrades — `:215-218`).
- **Why this is faithful:** install.sh runs cwd=consumer-with-ts-morph + wirer-file-in-framework-without-ts-morph. Here: cwd=`$CWD_DIR`-with-ts-morph + wirer-copy-in-`$FW`-without. Structurally identical. The `:169` guard passes (cwd has ts-morph); unfixed `:86` fails (copy's dir has none) → RED for the right reason.
- **Non-skipping in CI (T-642-B):** in CI the engine is present (declared devDep installed at `audit-self.yml:206`) → fixture runs, not skips. The loud skip only triggers on a host where deps aren't installed (your job: run `npm install --prefix packages/core` first so it runs for you too). State in the report: "runs non-skipped in `principles-meta-tests` because ts-morph is now a declared devDep installed at audit-self.yml:206."
- Cleanup: existing test uses `rm -rf` (lines 68/100/114) — fine in CI. Your local git-safety hook may block `rm -rf`; if so, leave the mktemp dirs (harmless).

### Existing fixtures + suites

- **Fixture D / F / L2-arm** (bash) must still pass. Fixture F (no-ts-morph consumer) degrades at the `:169` guard, NOT the `:86` import — your fix doesn't touch `:169`, so it still passes. You MAY correct Fixture F's misleading comment (lines 80-82, which attribute the degrade to the import) to "degrades at the cwd guard line 169 before reaching the import" — minimal edit, keep intent.
- **vitest** `packages/core/install/wire-eslint-r2.test.ts`: it has 6 `it.skipIf(!TS_MORPH_AVAILABLE)` fixtures. Declaring ts-morph makes them **un-skip and run**. These vitest fixtures are **NOT run in CI** (CI runs only `test:principles` + `test:hooks` + `audit-ai-docs.test.ts`; the full `vitest run` incl `install/**` is never invoked in any workflow — verified). So un-skipping is **local-only**. Run them locally after the fix (`npx --prefix packages/core vitest run packages/core/install/wire-eslint-r2.test.ts`) and confirm they PASS (they test stable AST logic — expected green). If any FAILS, do NOT fix it here — surface under ATTN (pre-existing). Also confirm `npm --prefix packages/core run test:principles` and `test:hooks` stay green (the CI suites — adding a devDep shouldn't affect them; verify).

## CONSTRAINTS

- Scope = #642 + its root cause (ts-morph undeclared). Do NOT: edit `audit-self.yml`; rebuild the consumer-pipeline; fix any newly-surfaced vitest failure (surface as ATTN). The "Fixture A … consumer-pipeline" in the bash header (lines 9-10) is the in-process **vitest** fixture, not a bash one — don't hunt it.
- Capability commit (ts-morph devDep) → use the Prior-art trailer above. The fix+test+comments+dep can be ONE commit, or split (dep+fix as one, test as another) — your call; each commit that is a capability commit carries the trailer.
- Run (not the full suite): the bash test (fail-first → green), the wirer vitest (now un-skipped — confirm green), `test:principles` + `test:hooks` (CI suites — confirm green), cheap typecheck on the changed `.ts` if available.
- Commit format: Conventional Commits, English. e.g. `fix(install): resolve ts-morph from consumer cwd in R2 Layer-2 wirer (#642)`.
- Project rules auto-load (`.claude/rules/`, `CLAUDE.md`) — follow, don't restate.

## T-TRAPS ACTIVE (`.claude/rules/ai-laziness-traps.md §2`)

T2, T3, T7, T14, T15. Plus:
- **T-642-A "test-the-in-place-wirer"** — the real wirer has ts-morph up-tree → in-place run masks the bug. Copy to a temp dir without ts-morph up-tree; set cwd to a dir WITH ts-morph. (counter: fixture shape)
- **T-642-B "skip-is-protection"** — a fixture that skips when the engine is absent protects nothing. ts-morph is now a declared devDep → present in CI → runs non-skipped (in-pattern with f16/f17). (counter: DEP DECLARATION + locate-or-skip)
- **T-642-C "RED-for-the-wrong-reason"** — a no-ts-morph cwd goes RED at `:169`, proving nothing about `:86`. cwd MUST have ts-morph. (counter: CRITICAL section + cwd=`$CWD_DIR`)

## REPORT (strict, no prose padding)

- **BUG CONFIRMED:** file:line still match? (yes/no + drift)
- **DEP:** ts-morph `^24.0.0` added to packages/core/package.json — must match `setup.sh:336` (`ts-morph@^24.0.0`) + SSOT #131, NOT npm-latest 28.x (quote `setup.sh:336`).
- **FAIL-FIRST PROOF:** new-fixture output vs UNFIXED code (must show NOT-wired/degrade FAIL). Confirm it failed at the `:86` import (cwd had ts-morph, cleared `:169`).
- **FIX:** diff of `wire-eslint-r2.ts` (import change + comment-only edits; degrade string untouched), 5-20 lines.
- **GREEN PROOF:** new-fixture output after fix (WIRED). + Fixtures D/F/L2-arm pass. + wirer vitest now un-skipped & green. + `test:principles`/`test:hooks` green.
- **CI-NON-SKIP:** one line confirming the new fixture runs non-skipped in `principles-meta-tests` (declared devDep installed at audit-self.yml:206).
- **audit-r4:** confirm the declared dep also resolves the `packages/core/probes/audit-r4.ts:11` undeclared import (one line).
- **COMMITS:** SHA(s) + subject(s) + trailer present. **BRANCH** `fix/642-r2-wirer-cwd-resolve`.
- **DECISIONS / Confidence (high/med/low) / ATTN** (any newly-surfaced vitest failure or other separate issue — surfaced, not fixed).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
