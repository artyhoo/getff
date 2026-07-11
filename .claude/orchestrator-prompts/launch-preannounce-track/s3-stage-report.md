# S3 — Pre-push structural owner-split — stage report

> **Stage:** launch-preannounce-track S3 (pre-push structural owner-split; replaces the #923/#943 per-section band-aid).
> **Author:** night-mode executor, worktree `lpt-s3` (branch `worktree-lpt-s3`), fresh from `origin/staging 375735a79`.
> **Date:** 2026-07-11. RETRY after a predecessor quota-death that left uncommitted WIP.
> **Surfaces:** `packages/core/hooks/pre-push.ts`, `packages/core/hooks/pre-push.consumer-layout.test.ts`, `packages/core/principles/32-prepush-section-owner.test.ts` (NEW), `packages/preset-{next-15-canonical,react-native,react-spa}/RULES.md`.

## §0 Premise re-verification (S.0 rule)

| Premise | Command | Result |
|---|---|---|
| #923/#943 shipped per-section `existsSync` consumer-skip guards as the interim band-aid | `git log` + read `pre-push.ts` on staging | CONFIRMED — every maintainer-only section carried its own `existsSync(...consumer-copy-list-absent-path)` guard; detection was per-section, leak-by-forgotten-guard possible. |
| Consumer pre-push runs a FULL zizmor audit → hard-blocks first push on pre-existing `@v6` (F-push) | S1 report §2 R3 (ky) + read `zizmorLiveSection` | CONFIRMED — `zizmorLiveSection` ran `zizmor .github/workflows/` full-scan; `requireTool` dies on findings (exitCode≠0) in BOTH tool-absence modes. |
| `.husky/pre-push` dispatches `exec node --import tsx/esm .../pre-push.ts` | `cat .husky/pre-push` | CONFIRMED — `argv[1]` = the TS hook path, so `isDirectCliInvocation()` matches. |

No S3 premise was already-fixed-and-skippable.

## §1 Predecessor WIP — kept vs redone (critical inspection)

A prior executor died mid-task leaving uncommitted changes. I own the result; verdict per artifact:

- **KEPT (correct, verified green):** the owner-tagged section registry (`SectionOwner`/`PrePushSection`/`SECTIONS`), `composeSections()` fail-closed throw on invalid owner, `activeSections()`, the `isDirectCliInvocation()` dual CLI/library idiom (lets principle 32 import the registry without executing the hook), `SectionCtx` threading, extraction of every inline `main()` block into a named `*Section` fn, principle test 32, and the consumer-layout S3 owner-split tests (SSOT-planted maintainer/consumer arms) + the deliverable-2 smoke test. Sound; retained verbatim.
- **REDONE (predecessor left it incomplete / internally contradictory):** deliverable 3, the F-push contract. The predecessor left `actionlint`, `zizmor-live`, `unpinned-tool-install` as `owner: 'both'` (still full-scan a consumer's own workflows) while writing a RULES.md that claims "clean-tree `git push` is allowed" — mutually exclusive facts (a consumer with pre-existing `@v6` workflows is still hard-blocked → F-push unresolved). I changed the three scanners to `owner: maintainer`, rewrote the obsolete P0.1c "consumer degrades on scanner absence" test into the direct F-push regression, and corrected the RULES.md wording in all three presets.
- **CORRECTED a false premise in the predecessor's report:** its line 14 claimed the bash fallback is "not shipped" to consumers. That is factually wrong — `install.sh:470-471` + `setup.d/50-hooks.sh:15` DO ship `pre-push.fallback.sh` into a consumer. See §6/§7.

## §2 Deliverable 1 — owner tag on every section + principle-test gate

Design call (**technical-decided fork**): **single registry + `activeSections(isFrameworkRepo)`**, not two entrypoints. One `SECTIONS` array, each entry `{ id, owner, run }`; `main()` composes `activeSections(isFrameworkRepo)` and runs them in registry order. Rationale: one SSOT for ordering + composition; two entrypoints duplicate the section list and drift; one array is also the single surface principle 32 reads. Detection stays the SINGLE `isFrameworkRepo` (SSOT-register presence) signal, consumed once in `main()`.

Two enforcement nets (attention-is-not-a-mechanism §1 — a gate, not "a maintainer remembers the guard"):
- **CI/pre-push:** `packages/core/principles/32-prepush-section-owner.test.ts` fails if any section is untagged/mistagged, if a maintainer section leaks into the consumer composition, or if `main()` stops delegating to `activeSections()` (inlines a section primitive).
- **Runtime:** `composeSections()` throws (fail-closed) on an absent/invalid owner — an untagged section aborts every push loudly rather than silently leaking.

Owner assignments (22 sections): `consumer` = rule-globs, lint-staged-resolves. `both` = lychee (changed-Markdown only). `maintainer` = everything else, incl. the three workflow-security scanners (see §4).

**RED→GREEN (paired, per T15):**
- RED — artificially untagged section: `composeSections([{owner: undefined}], …)` throws `/no valid owner tag/`; a `'todo'` mistag throws the same. Baked into principle 32 (`it('composeSections FAILS CLOSED on an untagged section')`).
- GREEN — `npx vitest run principles/32-… hooks/pre-push.consumer-layout.test.ts` → **2 files, 20 tests passed**. `npm run test:principles` → **34 files, 311 passed** (principle 32 runs inside the pre-push §5 gate — enforced at the earliest reachable channel, not CI-only).

## §3 Deliverable 2 — consumer-topology smoke test

`it('S3 smoke — consumer default-branch main, no maintainer packages/core, benign commit → shipped main() reaches exit 0')`: a fresh tmp repo, default branch `main`, only the `install.sh` consumer copy-list (`packages/core/{hooks,eslint-rules}`), a real bare `origin` with `origin/HEAD → origin/main`, a benign commit, and the shipped `main()` run with NEITHER `PREPUSH_UPSTREAM_REF` NOR piped stdin (`input: ''`) — so the REAL default-branch resolver (`resolveDefaultBase → origin/main`) runs end-to-end (the path a fresh consumer's first push takes). Asserts exit 0 and none of `No test files found` / `ERR_MODULE_NOT_FOUND` / `ENOENT` / `pre-push hook crashed` / `could not determine a base ref`. **GREEN.**

Stub audit (memory hint — a new pre-push section test needs a same-commit `make_test_repo()` stub audit): the smoke reuses the file's existing `makeConsumerSandbox` shape (hooks + eslint-rules copy, node_modules symlink, exit-0 stubs for zizmor/actionlint/lychee). Under the new contract only `lychee` can run on a consumer (and no `.md` is changed here → no-op); the zizmor/actionlint stubs are inert on the consumer path but retained because the framework-layout arms (SSOT-planted) still need them.

## §4 Deliverable 3 — Push-channel contract (binding for S2)

### Push-channel contract (binding for S2)

**Contract (technical-decided; the F-push adjudication):** the consumer push channel is **thin** and **never gates the consumer's own repo content**:

1. **Per-file lint is NOT re-run at push** — it is enforced earlier (edit-time ESLint + pre-commit `lint-staged`). A shipped-rule violation is blocked at edit-time + pre-commit + `npx eslint .`; CI is the backstop for a deliberate `--no-verify` bypass.
2. **Workflow-security scanners (`actionlint`, `zizmor`, the ci-tool-pinning unpinned-install gate) do NOT run on a consumer.** They are `owner: maintainer`. A consumer's own workflows/shell scripts are the consumer's **CI**'s concern (the shipped workflow-integrity CI template runs zizmor — the correct channel, since no earlier consumer-side YAML gate exists), never a hard block on the consumer's push.
3. **The consumer push channel runs only:** framework enforcement-integrity that per-file pre-commit cannot see — rule-glob liveness, lint-staged binary resolution — plus offline link integrity on Markdown **changed in this push** (lychee, `both`, degrades if absent).
4. **A clean-tree `git push` is ALLOWED.**

**What S2 (d)/(i) must encode:**
- **(i)** clean-tree consumer `git push` to a bare remote → **allowed** (no workflow scan; rule-globs/lint-staged/lychee do not block a clean tree).
- **(d)** a planted shipped-rule violation is blocked via `npx eslint .` (rc≠0) AND pre-commit; the real `git push` on the clean tree **passes** — the push channel does NOT re-block the shipped-rule violation (that is pre-commit's job; if committed `--no-verify`, CI backstops). S2 must NOT expect the push itself to block on a shipped-rule violation.

### F-push adjudication (against the S1 mandatory input)

**S1 F-push (report §2 R3 / §3):** the consumer pre-push ran a FULL zizmor audit over the consumer's OWN `.github/workflows/*.yml` and hard-blocked their FIRST `git push` on pre-existing `@v6` action refs (17 findings, `unpinned-uses`, rc=1).

**Verdict: first-push-blocking-on-preexisting-consumer-workflows is NOT the intended contract.** The consumer entrypoint must NOT scan the consumer's own workflows at all — chosen over "scope to the push diff" and "degrade to warn" because:
- It **extends an already-implemented doctrine** rather than inventing one. `ci-tool-pinning.md §2` ("the rule is scoped to THIS repository — a consumer's own scripts must not be gated by our discipline") is ALREADY enforced for the *shell-script* slice: `unpinnedToolInstallSection` uses `isFrameworkRepo ? shellScriptFiles() : []` (`pre-push.ts:568`). F-push is that same doctrine leaking on the *workflow* slice; the fix makes the workflow slice match the shell slice.
- It is **robust to the literal F-push repro.** "Scope to the push diff" still blocks a first push to an empty remote (whole history in range → pre-existing workflows counted as added). "Not composed on a consumer" is unconditional.
- **Attention-is-not-a-mechanism compliant.** This is NOT "degrade to warn" (a warning nobody reads is not a mechanism, §1). It is an explicit scope-OUT: the framework does not gate the consumer's own workflows; the hard gate for that class lives at the consumer's CI channel.

**RED→GREEN (paired, per T15) — `it('P0.1c (F-push) …')`:** a consumer layout, an installed zizmor/actionlint stub that REJECTS (exit 1, mimicking real `@v6` findings), a pre-existing `.github/workflows/ci.yml` using `actions/setup-node@v6`.
- RED — captured by temporarily reverting `zizmor-live`+`actionlint` to `owner: 'both'`: the consumer composes the scanner → the failing stub → `❌ actionlint reported problems` / `findings` surfaced → **exit 1** (`Tests 1 failed`, message `expected 'findings…' not to match /findings/`).
- GREEN — with `owner: maintainer`: the scanner is not composed on a consumer → never invoked → no findings, no block → **exit 0** (in-suite with the other 19 → all green).

### RULES.md declaration

Added a `## Push channel (pre-push) — thin by contract` section to all three preset RULES.md. Corrected the predecessor's false clause ("workflow-security scans when `.github/workflows/` is present") to state the channel does NOT scan the consumer's own workflows/scripts — that is the consumer's CI's job (`ci-tool-pinning.md §2`) — and that a clean-tree push is allowed.

## §5 Full-suite evidence

| Suite | Command | Result |
|---|---|---|
| Principle 32 + consumer-layout | `npx vitest run principles/32-… hooks/pre-push.consumer-layout.test.ts` | 2 files, **20 passed** |
| All hooks | `npm run test:hooks` | 48 files, **708 passed** |
| All principles | `npm run test:principles` | 34 files, **311 passed** |
| Typecheck | `npx tsc --noEmit` (packages/core) | no `pre-push` errors |

## §6 Backward-check sweep (T21 — non-restatement)

Class of change = "a check that gates the consumer's OWN pre-existing repo content." Enumerated every parallel surface:
- `unpinnedToolInstallSection` shell slice (`pre-push.ts:568`, `: []` on consumer) — the precedent; **SWEPT-CLEAN**, now the workflow slice + zizmor + actionlint match it.
- `lychee` (`both`, `pre-push.ts` §8) — gates only *changed* Markdown in this push, not pre-existing content — **SWEPT-CLEAN**.
- `rule-globs` / `lint-staged-resolves` (`consumer`) — gate the framework's OWN enforcement-integrity ("is the shield I installed live?"), not consumer code — **SWEPT-CLEAN**.
- **GAP-FOUND (non-section sibling, out of scope):** `pre-push.fallback.sh` runs Prior-art + §1.7 *presence* checks with NO `isFrameworkRepo` guard (`pre-push.fallback.sh:112`, unconditional). The predecessor's report (line 14) claimed the fallback is "not shipped" to consumers and dismissed this — that is **factually wrong**: `install.sh:470-471` + `setup.d/50-hooks.sh:15` DO copy `pre-push.fallback.sh` into a consumer ("Wave 10.5: also install the bash critical-only fallback"). So on the tsx-absent degraded path a consumer's capability commit lacking a `Prior-art:` trailer WOULD be gated by our authoring discipline (#920/#921 class), now inconsistent with the TS hook's maintainer-only trailer sections. It does NOT reproduce F-push (the fallback scans no workflows — zero `zizmor`/`actionlint`/workflow refs in it). Different change-class + separate artifact (not a "section") → out of S3 owner-split scope; observation, not fixed (no drive-by PR).

## §7 Deviations / observations

- **OBS-fallback (systemic, NOT acted on):** `pre-push.fallback.sh` (shipped to consumers — see §6) has no framework-vs-consumer guard on its Prior-art/§1.7 presence checks — a consumer on the tsx-absent path can be blocked by the framework's authoring discipline, now inconsistent with the TS hook. Candidate follow-up: gate the fallback's trailer checks on SSOT-register presence, mirroring the TS hook. Left for an explicit invitation.
- **Vestigial `onMissingTool` warn-skip branch:** `SectionCtx.onMissingTool` is computed `isFrameworkRepo ? 'die' : 'warn-skip'`; the `warn-skip` value is now unreachable in production (its only readers — actionlint/zizmor — are maintainer-only, so they always see `die`). Kept intact rather than ripped out: it is a general `requireTool` capability, removing it would be scope-creep on the landed #923 mechanism, and it stays ready if a future section is tagged `both`. Noted for transparency.
