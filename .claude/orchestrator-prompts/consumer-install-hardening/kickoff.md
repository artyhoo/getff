# Consumer install hardening — umbrella kickoff

> **For:** `/pipeline consumer-install-hardening` (run in a fresh session). Multi-stage I-phase (fixes).
> **Mode:** Mode A inline (install.sh fixes are single-file sequential; docs parallel). Not Mode B unless throughput needed.
> **PR base:** `staging`. Each stage = own PR(s); stage-gate (Phase -1 cold-review) between stages.
> **Commissioned:** maintainer, 2026-06-13 — fix the framework defects found by the `timeliner` consumer audit (`CONSUMER-FINDINGS-timeliner.md`, 13 findings F1–F13). Real-consumer evidence: Hono + Expo + Drizzle, pnpm+Turbo monorepo, default branch `main`.

## §0 Pre-seeded findings (CONFIRMED — this umbrella starts from the timeliner backlog, not zero)

Source of truth: [`CONSUMER-FINDINGS-timeliner.md`](./CONSUMER-FINDINGS-timeliner.md) — copied next to this kickoff (it is UNTRACKED + lives only at the main-repo root `/Users/art/code/rules-as-tests-aif/CONSUMER-FINDINGS-timeliner.md`; the sibling copy travels with the umbrella so a fresh worktree/`/pipeline` session can read it). 13 findings, each with framework:/consumer: file:line evidence, repro, fix, acceptance. **Read it first.** Severity + type table is in its §Сводка.

**Status vs the in-flight `final-quality-audit` (FQA) work — LOAD-BEARING, read before scoping:**

> The FQA umbrella (this same surface) ran 2026-06-11 and its fixes are on branch **`claude/loving-swirles-5689ff`** (commits `84c2b44`→`da7fb46`), **NOT yet on staging** (git tunnel down at audit time). This umbrella **extends** that work. **PRECONDITION:** base off the FQA branch once it merges to staging, OR cherry-pick/reconcile — do NOT redo what it already did.

| F# | Sev | Status vs FQA C1 | This umbrella |
|---|---|---|---|
| F4 eslint barrel dangling | P1 | ✅ **DONE** (FQA W1 — `install.sh` generates `eslint-rules-local/index.ts`) | do NOT redo; verify present |
| F8 AGENTS scripts absent | P2 | 🟡 PARTIAL (FQA W4 injects scripts) | finish: AGENTS.md prose drift (storybook/playwright/dep-cruiser claims) |
| F2 husky/lint-staged dead | P1 | 🟡 PARTIAL (FQA W4 added `prepare:husky` script only) | finish: add husky+lint-staged+sort-package-json devDeps + `husky init`/hooksPath |
| F6 audit-r4 not shipped | P2 | 🔴 **FQA WAS WRONG** — dropped it as "orphan"; `audit-ai-docs.sh:83` DOES call `npx tsx scripts/audit-r4.ts` | ship `audit-r4.ts` → consumer `scripts/` (correction owed) |
| F12 R11 ci machinery | P2 | 🟡 ci.yml full on current install (FQA W6); `audit-self.yml`/`workflow-integrity.yml`/`ci-success` NOT shipped | ship them (or RULES.md stops claiming R11 checkable) |
| F1 pre-push.ts not shipped | P1 | 🆕 NEW (FQA missed) — install ships only `pre-push.fallback.sh`; dispatcher routes to absent `pre-push.ts` | ship `pre-push.ts` + deps, OR drop the dispatcher TS-arm |
| F3 eslint globs Next-specific | P1 | 🆕 NEW — globs `src/web/handlers`,`src/app/*`,`src/application` match nothing on flat servers → R2/R7/R8 silently inert | **DECISION-NEEDED §4-fork** |
| F5 stryker globs `src/**`+Next | P2 | 🆕 NEW — monorepo/non-Next has no root `src/` | **DECISION-NEEDED §4-fork** |
| F7 R7/R8 by-default no infra | P2 | 🆕 NEW — Clock/Random/OTel absent in fresh consumer | **DECISION-NEEDED §4-fork** |
| F9 /aif-* not shipped | P2 | 🆕 NEW — AGENTS promises `/aif-verify`, no `.claude/commands/` | ship commands OR AGENTS stops promising |
| F10 fallback base-ref staging | P3 | 🆕 NEW — defaults `origin/staging`, absent on `main` consumers | derive from `git symbolic-ref refs/remotes/origin/HEAD` |
| F11 .nvmrc vs CI node | P3 | 🆕 NEW — AGENTS says "CI depends on .nvmrc", CI hardcodes node 22 | CI `node-version-file:.nvmrc` OR drop the claim |
| F13 stryker PM + doc-URL | P3 | 🆕 NEW — `packageManager:"npm"` hardcoded; RuleCreator URL → absent `factory/RULES.md` | detect PM; fix doc-URLs |

## §1 Goal (one line)

Every shield the framework claims to ship is **actually live in a real consumer** (flat Hono server AND monorepo, default branch `main`, pnpm) — hooks fire, custom ESLint rules match real files, mutation has something to mutate, R4/R11 probes resolve, and AGENTS.md promises only what install delivers. Every finding is fixed with an **executable acceptance** (per-finding §Acceptance in the findings file), or explicitly routed (DECISION-NEEDED / not-fixing) — nothing closed by prose.

## §2 Stage map

| Stage | Sub-waves | Parallel? | Depends on | Branch prefix |
|---|---|---|---|---|
| **S1 install-side** ✅ **DONE** ([PR #474](https://github.com/Yhooi2/rules-as-tests-aif/pull/474), squash `b6d3be6`, 2026-06-13) | F6, F1, F12, F2, F11(lock), F13 | sequential | — | `cih-s1-install` |
| **S2 docs + workflow** → [`kickoff-s2.md`](./kickoff-s2.md) | F8 (AGENTS trim — **NARROW: S1 already shipped most; residual = test-storybook/playwright + prose**), F9 (/aif-* claims) | yes (disjoint docs) | S1 merged ✅ | `cih-s2-docs` |
| **S3 globs (design forks)** → [`kickoff-s3.md`](./kickoff-s3.md) | F3 (eslint), F5 (stryker), F7 (R7/R8 defer) — **coupled, one branch** (F3↔F7 arming dependency) | no | S2 merged + **maintainer GO on §4 DECISION-NEEDED** | `cih-s3-globs` |
| **S4 re-verify + close** | fresh install on a FLAT Hono consumer + a monorepo consumer; per-finding acceptance re-run; done.md | no | S3 merged | `cih-s4-verify` |

> **Stage kickoffs verified 2026-06-13** (read-only audit + Phase -1 cold-review). Two corrections vs the original framing: **F8 is ~80% already-shipped by S1** (don't redo); **F3 is now the live blocker** (F4 barrel auto-generates on staging) and **F7 must ship WITH F3** (fixing globs without deferring R7/R8 newly arms infra-demanding rules). Detail in the stage kickoffs.

### S1 install-side (sequential — all edit install.sh)

Per-finding fix + acceptance are in the findings file. Highlights + the FQA-correction:
- **F6 (correction):** `copy_safe packages/core/probes/audit-r4.ts → scripts/audit-r4.ts`. **Verify the caller** (`audit-ai-docs.sh:83`) resolves — this is the exact verify-failure FQA made (grepped package.json/ci, missed audit-ai-docs.sh). If audit-r4.ts has hardcoded globs, adapt (ties to F3/F5 glob discipline).
- **F1:** ship `packages/core/hooks/pre-push.ts` (+ its deps: `registry.ts`, base-ref resolver) so the dispatcher's TS-arm is reachable; OR drop the TS-arm and stop promising substance checks. Acceptance: install on Node≥20 → `git push` runs the TS-core hook, not fallback.
- **F2:** install adds devDeps `husky lint-staged sort-package-json` + runs `npx husky init` (or `git config core.hooksPath .husky`). Completes FQA's `prepare:husky`. Acceptance: `core.hooksPath`→`.husky`; smoke "commit with lint error → pre-commit fails".
- **F12:** ship consumer `audit-self.yml` + `workflow-integrity.yml` + a `ci.yml` with `ci-success` aggregate that actually calls `audit-ai-docs.sh`. OR RULES.md stops claiming R11 is checked by them.
- **F11:** CI template `node-version-file: .nvmrc` (drop hardcoded `node-version: 22`) + reconcile .nvmrc value.
- **F13:** stryker `packageManager` detect from consumer lockfile; fix RuleCreator doc-URLs to the real RULES.md path (`packages/preset-next-15-canonical/RULES.md`, not `factory/RULES.md`).

### S2 docs + workflow

- **F8:** AGENTS.md template lists ONLY scripts install ships (post-FQA-W4 set); drop/conditionalize storybook/playwright/dep-cruiser/mutation-kill-rate claims absent from the shipped package.json. Acceptance: docs-audit probe — every `npm run X` in AGENTS.md exists in a shipped package.json.
- **F9:** either ship `/aif-*` commands OR AGENTS/checks-map stop declaring `/aif-verify` as a required pre-commit gate (per AGENTS's own "skills declared after they exist").

**S2 scope addendum — folded in from S1 out-of-scope observations (maintainer-approved 2026-06-13):**
- **F8b (same defect class as F13, react-next stack):** 3 preset eslint RuleCreator URLs point at the absent `factory/RULES.react-next.md` — `packages/preset-next-15-canonical/eslint-rules/{require-use-server-directive,no-server-imports-in-client,require-form-safe-parse}.ts`. Repoint to the real path (verify `packages/preset-next-15-canonical/RULES.react-next.md` headings + derive correct GitHub slugs, per F13). Also fix `packages/core/manifest/rules-manifest.json` R11 `policy` + the framework's own `.github/workflows/workflow-integrity.yml` comment — both still ref `factory/RULES.md`.
- **F8c (install.sh "Next steps" prose, now-dangerous):** the post-install echo still advises `npx husky init`, which is (a) redundant after S1's F2 auto-activation and (b) **would clobber** the shipped `.husky/pre-commit`/`pre-push`. Drop/replace that line. (Source: `install.sh` "Next steps" block ~line 557-569.)

### S3 globs (BLOCKED on §4 DECISION-NEEDED)

F3 + F5 + F7 each need a maintainer decision (§4). Do not start S3 until answered.

## §3 Scope fence (hard)

**IN:** fixes to install.sh, shipped templates, shipped CI/hook artefacts, shipped AGENTS/RULES docs, re-verification on real consumer shapes.
**OUT (surface as observation / DECISION-NEEDED — do NOT do):**
- Redoing FQA-completed work (F4 barrel; FQA W1/W2/W4 already landed on the FQA branch).
- New capabilities/frameworks/deps beyond what a fix needs (BFR: SSOT consult per capability commit).
- Editing the `timeliner` consumer repo itself (it is the polygon/evidence, not a deliverable).
- `~/.claude/**` (agent-uncommittable); rewriting frozen/historical docs.

## §4 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — MANDATORY)

Active traps: **T3, T5, T13, T14, T16, T19** + domain.
- **T3** — every fix carries an executable acceptance (command + output), not prose "fixed".
- **T5** — this is the I-phase; the research (the findings file) is done. Do not re-audit; fix per the findings' §Fix/§Acceptance.
- **T13/T16** — the shipped templates/hooks ARE the subjects; a fix "shipped" must be evidenced in a LANDED consumer, not the source package (the entire F-class is verify≠delivered).
- **T14** — "fixed" requires the per-finding acceptance to pass; partial → say so.
- **T19** — S4 own cold-QA on a real consumer shape before close; CI green ≠ shield live.

**Domain-specific:**
- **T-CIH-A — «green in source ≠ live in consumer».** Every FQA miss (F1/F3/F6/F12) was invisible from the source repo and only showed on a real consumer. Counter: S4 MUST install into a FLAT Hono consumer AND a monorepo consumer (not just the source repo's /tmp ts-server) and run the per-finding acceptance there.
- **T-CIH-B — «dropped a finding without checking ALL callers».** The exact F6/W3 failure: FQA grepped package.json/templates/ci for `audit-r4`, missed `audit-ai-docs.sh:83`, declared it an orphan, dropped it. Counter: before declaring anything unwired/orphan, `grep -rn` the symbol across the WHOLE repo including `*.sh`/`audit-self/`, not a curated subset.
- **T-CIH-C — «fix the glob to match MY repo».** When parameterizing globs (F3/F5), do not hardcode the timeliner shape either — the fix must work for flat AND layered AND monorepo, or be explicitly parameterized/asked-at-install.

## §5 Per-stage acceptance

- **S1 (each finding):** the finding's own §Acceptance (from the findings file) passes, evidenced by command+output on a LANDED consumer; §1.7 Forward/Backward in every PR touching watched paths (`.claude/rules/**`, `packages/core/**`, `CLAUDE.md`, `agents/**`, `.claude/skills/**`, prior-art SSOT — note: `install.sh` is NOT a watched path); install-sh test added per fix where mechanizable (extend `tests/install-sh/`).
- **S2:** docs-audit probe green (AGENTS claims ↔ shipped reality); negative test (fake script in AGENTS → probe fails).
- **S3:** per-fork acceptance (F3: R2 fires on a flat Hono handler — negative test, not "0 matches"; F5: Stryker mutates a real package's src; F7: default install does not impose R7/R8, guide documents when to enable).
- **S4:** fresh install on BOTH a flat Hono consumer and a monorepo from staging tip → all 13 findings' acceptances pass (or explicitly routed); `make self-audit` + full principle suite green; `done.md` per CLAUDE.md schema.

## §6 DECISION-NEEDED (maintainer GO required before S3 — auditor leans stated, maintainer decides)

- **DN-A (F3) — eslint globs:** (A) parameterize globs (`AIF_SRC_GLOBS` / install-time question) · (B) ship a flat-server template variant alongside the layered one · (C) document a mandatory post-install glob edit with a verify. **Orchestrator lean: A** (parameterize — one template, consumer-shaped at install).
- **DN-B (F7) — R7/R8 (Clock/Random/OTel):** mark **opt-in / deferred-by-default** for fresh consumers + RULES/AGENTS note on required infra & when to enable? **Orchestrator lean: yes, deferred** (BFR — don't impose infra a fresh skeleton lacks).
- **DN-C (F5) — stryker globs:** monorepo-aware per-package `mutate` vs install-time placeholder. **Orchestrator lean:** same mechanism chosen for DN-A (keep F3/F5 glob-parameterization consistent).

## §7 Stage-gate mechanic (between every stage)

```bash
gh pr list --search "is:merged head:<stage-branch> base:staging" --json number,title,mergedAt --limit 10
```
All stage PRs merged → Phase -1 cold-review (read-only Agent, `reviewer-discipline.md §2`) → GO before next stage. Pre-dispatch in-flight probe per CLAUDE.md §Operational conventions before EVERY dispatch.

## §8 Notes for the orchestrator (/pipeline)

- **FQA-branch dependency (load-bearing):** confirm the FQA branch (`claude/loving-swirles-5689ff`, `84c2b44`→`da7fb46`) state before S1 — if merged to staging, base off staging; if not (tunnel was down), reconcile so F4/W1/W2/W4 are not redone and F6 (the FQA correction) lands here.
- **Tunnel caveat:** push may be blocked by the Clash fake-ip TUN (memory `project_github_push_flaky_proxy_tunnel`); use `harvest-via-api.sh` / gh Git Data API fallback; work commits-offline-resilient.
- **Reuse, don't rebuild (BFR):** `scripts/audit-ai-docs.sh`, principle tests, `tests/install-sh/*.test.sh` harness, `make self-audit`, the `/tmp` fresh-install pattern.
- Last-stage merge → `done.md` here per CLAUDE.md Umbrella closure convention.
- This kickoff is consumed by `/pipeline`; the generated meta-launch kickoff must pass principle 12 (its own §5 AI-traps with T-enumeration) — `/pipeline` authors that, this umbrella kickoff seeds the trap list above.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
