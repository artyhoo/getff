# S1 — Foreign-repo calibration report

> **Stage:** launch-preannounce-track S1 (foreign-repo calibration; gates S2).
> **Author:** night-mode executor, worktree `lpt-s1` (branch `worktree-lpt-s1`), fresh from `origin/staging e69a0cc2f`.
> **Date:** 2026-07-11.
> **Consumer surface exercised:** `install.sh <stack> --full` — the exact framework-install the `./setup` wrapper delegates to (`setup:41`). `./setup` itself was NOT driven end-to-end: its companion/runtime-bridge steps install Claude plugins into `~/.claude` (barred by night-mode discipline) and are orthogonal to install calibration. The self-verify banner + all dep/hook/config layers live in `install.sh` (`setup.d/*`), so the real banner and every acceptance probe are faithful to the consumer surface. **Technical-decided fork.**

## §0 Premise re-verification (S.0 rule)

Baseline facts from kickoff §0/§14, re-checked on the worktree tree (fresh `e69a0cc2f`):

| Premise | Command | Result |
|---|---|---|
| `packages/core` still `private:true` `@rules-as-tests/core` | `grep name/private packages/core/package.json` | CONFIRMED (`"name": "@rules-as-tests/core"`, `"private": true`) |
| Consumer invocation = `./setup --full <stack>` → `install.sh --full` | read `setup` + `install.sh` | CONFIRMED (`setup:41` shells `bash install.sh … --full`) |
| `--full` non-interactive dep-install via detected PM | `setup.d/70-deps.sh:245` | CONFIRMED (`elif [ -n "$FULL" ]; then _do_dep_install="yes"`) |
| Self-verify banner honest (SKIP accounted, form-scoped) — #947/#957 | `setup.d/99-finalize.sh:247-340` | CONFIRMED held under foreign topologies (see §2) |

No S1 premise was already-fixed-and-skippable; all install machinery is live as described.

## §1 Repos exercised (3 — floor 2, T1 sampling-artifact avoided)

| # | Repo | SHA | Shape | PM | Stack (detected) |
|---|---|---|---|---|---|
| R1 | `expressjs/express` | `ba006766fb964571723138708eacaba0f55759cd` | flat, pure JS/CJS, no committed lockfile, `type:opencollective`, `lib/` + `examples/*.js` | npm | `unknown` → forced `ts-server` |
| R2 | `vueuse/vueuse` | `8442658d08b17d7aeefb18abcd06dcefd0d4c1e6` | **pnpm workspace monorepo**, 12 pkgs under `packages/*`, `packageManager: pnpm@10.33.2`, pnpm catalogs + `trustPolicy: no-downgrade` + `patchedDependencies`, no root eslint config, `prepare: simple-git-hooks` | pnpm | auto `ts-server` |
| R3 | `sindresorhus/ky` | `3419113b48e034fdcf8fa6bd3be3da7b3d0d758f` | flat TS ESM lib, source in `source/`, own `tsconfig` (extends `@sindresorhus/tsconfig`), `prepare: npm run build`, workflows tag-pinned `@v6` | npm | auto `ts-server` |

Three distinct shapes: flat-JS (off-label), pnpm-workspace-TS (primary S2 target), flat-TS (natural ts-server consumer / happy path).

---

## §2 Per-repo results

### R1 — express (flat JS)

- **Install `--full` (auto-detect, no stack arg):** `rc=1`, **fail-loud** — `❌ --yes / --full: could not auto-detect a stack from package.json (no react-native / next / react / typescript dependency signal).` **CORRECT fail-closed behavior** on a signal-free repo (positive calibration, not a defect).
- **Install `--full ts-server` (explicit):** `rc=0`, deps installed (npm), self-verify **3/3 passed**, banner honest. 1 file skipped (express's own `.github/workflows/ci.yml`, kept).
- **Probe A — `npx eslint .` on CLEAN tree:** **`rc=2` (fatal crash)**, NOT a clean pass:
  ```text
  Error: Error while loading rule '@typescript-eslint/await-thenable': You have used a rule which
  requires type information, but don't have parserOptions set to generate type information for this file.
  Occurred while linting /private/tmp/lpt-s1-foreign/express/examples/auth/index.js
  ```
  Root cause: shipped `eslint.config.mjs` §3 spreads `...tseslint.configs.strictTypeChecked` + `stylisticTypeChecked` **unscoped** (applies to ALL files), but only `**/*.{ts,tsx}` gets `parserOptions.projectService` (§4). Express's `.js` files (`examples/`, `lib/`, `test/`) get type-aware rules with no type info → crash. **No `disableTypeChecked` block for non-TS files.** → **Defect class D2.**
- **Probe B — planted R2 violation** (`src/routes/user.ts`, `UserSchema.parse(input)`, in-tsconfig): **`rc=1`**, `rules-as-tests/no-unsafe-zod-parse` — the framework rule fires correctly **in isolation**. So `eslint .` is rc≠0 for the *wrong* reason (crash), never actually reaching R2.
- **`npm run validate`:** `rc=1` (RED, honest) — `ERROR: "lint" exited with 2.` (the D2 crash).

### R2 — vueuse (pnpm workspace monorepo) — the primary target

- **Install `--full` (auto-detect):** `rc=0` in ~2:12. Stack auto-detected `ts-server`; **no root eslint config → per-workspace path**: placed `eslint.config.mjs` into all 12 `packages/*` (each own-signal `unknown` → `root package.json fallback`), dropped 14 per-package `.lintstagedrc.json` stubs. Config-placement layer worked correctly on the monorepo.
- **Dep-install FAILED (D3):**
  ```text
  ▶ Installing 24 dev-dependencies with pnpm (this may take a minute) …
   ERR_PNPM_TRUST_DOWNGRADE  High-risk trust downgrade for "undici-types@6.21.0" (possible package takeover)
    ⚠  dep install incomplete — run the remainder manually (see Next steps).
  ```
  Root cause: vueuse's `pnpm-workspace.yaml` sets `trustPolicy: no-downgrade`; the framework's `@types/node@^22.10.0` pulls `undici-types@6.21.0`, which pnpm flags as a trust downgrade → `pnpm add -D -w` aborts → **framework eslint toolchain (`@eslint/js`, `typescript-eslint`, `globals`, `eslint-config-prettier`, `@vitest/eslint-plugin`) never lands.** `zod` runtime dep also never installed (guarded behind devdep success). tsx *did* resolve (separate `pnpm add -D -w tsx` in the §8b block does not pull undici-types). → **Defect class D3.**
- **Self-verify hook gap (D4):** `✗ pre-push hook missing at …/.husky/pre-push — push-time shield not installed` → banner **`⚠ self-verify: 2/3 passed, 1 FAILED`** (honest — no false success). On-disk `.husky/` has **only `pre-commit`** (225 b, starts with `SKIP_SIMPLE_GIT_HOOKS`), which is **simple-git-hooks'-generated, NOT the framework's** (210 b). vueuse had no `.husky/` in `HEAD`. Sequence: layer 50 writes both framework hooks + sets `core.hooksPath=.husky`; layer 70's `pnpm add` fires vueuse's `prepare: simple-git-hooks`, which regenerates `.husky/pre-commit` from its own config (`{ pre-commit: "npx lint-staged" }`, no pre-push entry) and **removes** the framework's `.husky/pre-push`. The framework's **commit shield is also silently replaced**; `check-shields-up.sh` passes pre-commit only because it greps for `lint-staged` (which the consumer's hook also contains — a form-check false-pass). → **Defect class D4.**
- **Real enforcement channel DEAD (D5):** planted R2 in `packages/core/src/routes/probe.ts`, `npx eslint` in that workspace → **`rc=2`**:
  ```text
  Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@eslint/js' imported from
  /private/tmp/lpt-s1-foreign/vueuse/packages/core/eslint.config.mjs
  ```
  The placed per-workspace configs cannot even load (framework plugin deps absent from D3). **Yet self-verify `check-fences-fire` reported GREEN (2/2 ACTIVE)** — because it lints an *isolated fixture* under `scripts/fences-fire-fixtures`, not the *placed* configs. And `install.sh` exits `rc=0` with `✅ Installation complete.` So: real channel dead, self-verify green on the rule-firing axis, install rc=0. → **Defect class D5 (self-verify theatre: fixture-green while placed configs non-loadable).**

### R3 — ky (flat TS ESM) — the ts-server happy path

- **Install `--full` (auto-detect `ts-server`):** `rc=0`, deps installed cleanly (npm, no trustPolicy), self-verify **3/3 passed**, **pre-push present** (`✓ push shield WIRED`). ky's `prepare` is `npm run build` (no git-hooks manager) → **D4 does not reproduce** — isolating D4 to consumers running a `prepare`-driven hook manager. 1 file skipped (ky's own `tsconfig.json`, kept).
- **Probe A — `npx eslint .` on CLEAN tree:** `rc=1`, **189 problems (171 errors, 18 warnings)** — but **ZERO from `rules-as-tests/*`**. Every finding is generic tseslint strictness (`consistent-type-definitions` ×24, `no-unsafe-member-access` ×20, `no-explicit-any` ×19, …) imposed on ky's legitimate idiomatic TS. **False-positive arm HOLDS for the framework's own rules** (positive calibration); the flood is the shipped strict tseslint baseline (adoption-friction, arguably by-design). No crash (rc=1 not rc=2) because ky is all-TS inside its tsconfig — confirming D2 is specifically the `.js`-outside-tsconfig case.
- **Probe B — planted R2** (`source/routes/probe.ts`): **`rc=1`**, `rules-as-tests/no-unsafe-zod-parse`. Real channel works when deps land.
- **`npm run validate`:** `rc=1` (RED, honest) — `ERROR: "format:check" exited with 1.` (ky's own files not prettier-clean under framework config; strict-baseline friction).
- **Real `git push` to a LOCAL bare remote (consumer push channel, S3):** **`rc=1` — BLOCKED.** The consumer pre-push (`pre-push.ts §2`) runs a **full zizmor audit** on the consumer's `.github/workflows/*.yml` and hard-fails on `unpinned-uses`:
  ```text
  error[unpinned-uses]: unpinned action reference
    --> .github/workflows/main.yml:18:15
  18 |       - uses: actions/setup-node@v6   ← action is not pinned to a hash (required by blanket policy)
  17 findings (13 suppressed, 1 fixable): 0 informational, 1 low, 1 medium, 2 high
  error: failed to push some refs to '/tmp/lpt-s1-foreign/ky-bare.git'
  ```
  The #923 guard only skips zizmor when there are **no** workflows; a consumer *with* tag-pinned (`@v6`) workflows — the overwhelming majority — is blocked on its first push. → **Finding F-push (S3 contract, owner-logged — see §4).**

---

## §3 Per-defect-class triage (NEW vs known)

Tracker searched (`gh issue list --state all -R artyhoo/getff --search …`) with ≥3 phrasings per class; known refs re-checked: **#931/#934 OPEN** (single-app stryker on monorepo; /story stop-hook), **#920/#921 CLOSED** (pre-push maintainer-only sections hard-blocked consumers — the P0 guards), **#947/#957 MERGED** (honest self-verify banner).

| ID | Class | Repo evidence | Tracker | Verdict |
|---|---|---|---|---|
| **D2** | ts-server `eslint.config.mjs` applies type-aware tseslint rules unscoped → `npx eslint .` **crashes rc=2** on any repo with `.js/.cjs/.mjs` outside tsconfig `include`; no `disableTypeChecked` block | R1 express (`examples/auth/index.js`) | no match (`await-thenable`, `parserOptions type information`, `strictTypeChecked`, `flat js linting` all empty; #737 = R2 false-pos, #832 = fixture files-key — both different) | **NEW → #973** |
| **D3** | pnpm `trustPolicy: no-downgrade` blocks `pnpm add -D -w <framework devdeps>` via `ERR_PNPM_TRUST_DOWNGRADE` (undici-types from `@types/node@^22`) → toolchain never lands | R2 vueuse | no match (`trustPolicy`, `trust downgrade undici`, `@types/node undici-types` all empty) | **NEW → #974** |
| **D4** | consumer's `prepare`-driven git-hooks manager (simple-git-hooks/husky) re-runs during the framework's `pnpm add`/`install` and **removes `.husky/pre-push`** + silently replaces `.husky/pre-commit` (framework enforcement gone; shields-up form-check false-passes) | R2 vueuse | no match (`simple-git-hooks`, `prepare clobber husky`, `hooks clobbered prepare` all empty) | **NEW → #975** |
| **D5** | self-verify `check-fences-fire` reports GREEN (isolated fixture) while the **placed** consumer `eslint.config.mjs` are non-loadable (`ERR_MODULE_NOT_FOUND`) after a partial dep-install; `install.sh` still exits rc=0 `✅` | R2 vueuse | no match (`ERR_MODULE_NOT_FOUND eslint config` → #735/#779, both different: missing hook file / depcruise) | **NEW → #976** |
| F-push | consumer pre-push runs a **full zizmor audit** on the consumer's own workflows → hard-blocks first `git push` on `unpinned-uses` (`@v6` tags) | R3 ky | partial-relative to #920/#921 (CLOSED, different sections); this is the zizmor-unpinned-uses surface on consumer workflows | **owner-logged (S3 contract) — NOT filed** (plausibly by-design ci-tool-pinning enforcement; S3 §3 explicitly owns the push-channel contract decision) |
| D1 | `--full` auto-detect fail-loud on signal-free repo | R1 express | correct behavior | **not a defect** |
| OBS-strict | shipped strict tseslint baseline floods 171 errors on brownfield legit TS (`rules-as-tests/*` = 0 of them) | R3 ky | — | **observation** (adoption-friction / positioning; not an install defect) |

---

## §4 Which S2 matrix cells this calibrates — recommendation for S2

The kickoff S2 **start cell** (pnpm workspace · Node 22 · ubuntu; fixture = private root + `pnpm-workspace.yaml` + `apps/api`(zod,src) + `packages/lib`(src), own `pnpm install`) is well-chosen but, as authored, is **green-by-construction (trap T-LPT-C)** against every defect S1 found. Concrete calibration:

1. **Assert (a) — "install rc=0 AND banner no false success":** rc=0 is NOT sufficient (R2 vueuse: rc=0 while dep-install incomplete + self-verify FAILED + real channel dead). **S2 must assert on the self-verify verdict line** (`self-verify: N/3` — RED if `FAILED` or if any check `skipped`) **and on `DEPS_INSTALLED`/dep-completeness**, not on `install.sh` exit code. This is exactly the fail-closed polarity §2 already mandates ("missing tool = RED, never SKIP") — encode it against the self-verify line.

2. **Assert (b) — "toolchain resolved in-fixture":** add a hard `command -v eslint tsx tsc` **plus a load probe of a placed workspace `eslint.config.mjs`** (`node --input-type=module -e "await import('<ws>/eslint.config.mjs')"`), because D5 shows `command -v eslint` can pass (consumer's own eslint) while the *placed* config is non-loadable. **The load probe is the D5 catch.**

3. **Assert (d)/(e) — planted violation + false-positive arm:** the fixture's boundary file must live **under the workspace tsconfig `include`** (D2/R1: outside-include TS → parser error; R3: R2 fires cleanly when in-project). **Add a stray `.js`/`.cjs` file at the fixture root** (e.g. `scripts/foo.cjs`) and assert `npx eslint .` does NOT crash rc=2 — this is the **D2 catch** the TS-only skeleton misses. Assert `rules-as-tests/*` = 0 on a legit file (R3 confirms this holds today — good regression anchor).

4. **Assert (d)/(i) — push channel + hooks:** **add a `prepare`-driven hook manager to (at least one) fixture** (`"prepare": "simple-git-hooks"` + a `simple-git-hooks` block without `pre-push`) and assert `.husky/pre-push` **survives the `pnpm install`** — the **D4 catch**. Then the real `git push` to a bare remote: decide via S3's contract whether tag-pinned consumer workflows are allowed. **The start-cell fixture's own workflow must be SHA-pinned** or assert (i) ("clean tree push → allowed") will fail on F-push. Record which contract the assert encodes.

5. **pnpm settings axis:** the start-cell fixture installs cleanly (no `trustPolicy`) → it will **never** exercise D3. Add **one cell** whose `pnpm-workspace.yaml` carries `trustPolicy: no-downgrade` (or an equivalent real-world pnpm setting) and assert the dep-install either succeeds or **fails RED-not-rc0-green** — the **D3 catch**. Alternatively cap/relax `@types/node` delivery; that is the fix side, out of S1 scope.

6. **stryker cell (assert h):** #931 (OPEN) already covers single-app stryker.config on monorepos — S2's stryker-on-pnpm cell should reference #931, not re-file.

**Ordering suggestion for S2:** the highest-value first cell is not the frictionless skeleton but one that carries (i) a stray `.cjs`, (ii) a `simple-git-hooks` prepare, (iii) a SHA-pinned workflow — so cells (b)-load-probe, (d)-D2, (d)/(i)-D4 all have a real RED arm to satisfy T-LPT-C/T15. The trustPolicy cell (D3) can be a second, explicitly-degraded cell.

## §5 Deviations / notes

- `./setup` end-to-end (companions + runtime-bridge) intentionally not driven (see header). If S2 wants to assert on the `./setup` wrapper banner too, it is a thin `echo` around `install.sh` (`setup:41,68-69`) — no additional install behavior.
- Foreign repos are under `/tmp/lpt-s1-foreign/` and were **never pushed** to their real origins; the only `git push` was to a local bare remote in `/tmp`. Logs: `/tmp/lpt-s1-foreign/logs/*.log`.
- Systemic observation (NOT acted on, per PR-strategy): OBS-strict (strict tseslint baseline floods brownfield TS) is a *positioning* matter — a consumer adopting the framework onto an existing TS codebase faces 100+ pre-existing-code errors before any framework rule fires. Worth a README/onboarding note (`--fix` + incremental adoption), owned outside this umbrella.
