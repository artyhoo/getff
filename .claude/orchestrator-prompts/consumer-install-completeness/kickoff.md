# Consumer install completeness — umbrella kickoff

> **For:** `/pipeline consumer-install-completeness` (run in a fresh session). Multi-stage I-phase (fixes) + one design fork.
> **Mode:** Mode A inline. S1 = docs (parallel-safe); S2/S3 = install.sh + skill edits (sequential on `install.sh`).
> **PR base:** `staging`. Each stage = own PR(s); stage-gate (Phase -1 cold-review) between stages.
> **Commissioned:** maintainer, 2026-06-13 — close the **3 GitHub issues left OPEN** after the `consumer-install-hardening` umbrella merged (#493). All three were filed from the same real-consumer polygon (`timeliner`, pnpm monorepo, GitHub Free private). They are the *consumer-honesty + completeness* residue that the hardening umbrella deliberately scoped out.

## §0 Pre-seeded findings (CONFIRMED 2026-06-13 by source-of-truth read at `staging` tip `b6096914`)

These three issues were verified against the live `staging` install surface (git transport was down — read via `gh api .../contents?ref=staging`). **Each claim below carries file:line evidence and was re-confirmed present, not assumed.** A fourth sibling issue, **#478 (lint-staged ENOENT), is already RESOLVED** by the hardening umbrella (F14 #490 + F15 #486 + S1 devDeps #474) and **CLOSED** — out of scope; do **not** reopen or redo it.

| Issue | One-line | Sev | Type | Confirmed evidence (`staging`) |
|---|---|---|---|---|
| **[#487](https://github.com/Yhooi2/rules-as-tests-aif/issues/487)** | R11 branch-protection-assertion is a **permanent** no-op on GitHub Free private repos, but docs frame it as "not yet adopted" (pending consumer choice) | P3 | docs-honesty | `packages/preset-next-15-canonical/RULES.md:274` ("no protection configured **yet**"); shipped template `templates/ts-server/github-actions-workflow-integrity.yml:41,66-67` ("R11 not yet adopted" + remediation `Settings → Branches → Require status checks` — a paywalled feature on Free-private). Both `branches/*/protection` and `rulesets` APIs return `403 Upgrade to GitHub Pro or make this repository public`. |
| **[#482](https://github.com/Yhooi2/rules-as-tests-aif/issues/482)** | Consumer install ships framework-internal tooling that silently no-ops (`/pipeline`, runtime-bridge, `packages/core/principles` refs) | P2 | consumer-mode honesty | `install.sh:274-290` copies `.claude/skills/pipeline/` (skip-if-exists guard `[ -e … ] && [ "$FORCE" != "--force" ]` — always fires on a fresh consumer) + only rewrites links via `transform_internal_refs()` (`install.sh:39`). `/pipeline` `SKILL.md` requires `docs/meta-factory/wave-sequencing-plan.md` (`SKILL.md:77,100`), `packages/runtime-bridge/src/cli/dispatch.ts` (`SKILL.md:313`), `packages/core/principles/*` (`SKILL.md:213,447`) — **none exist in a consumer** → run-but-no-op, indistinguishable from broken. |
| **[#483](https://github.com/Yhooi2/rules-as-tests-aif/issues/483)** | Install is **not "one-button"**: copies files then hands back an 8-step manual checklist; no dep-install / branch-model / MCP / plugin setup | P2 | completeness | `install.sh:649-677` "Next steps" = 8 manual steps incl. step 4 `npm install --save-dev …` (~15 deps) and step 5 "add scripts" (now **stale** — install auto-merges scripts at `install.sh:562-612` and declares hook devDeps at `install.sh:597-604`, but never **runs** the install). Only git op is `git config core.hooksPath .husky`. No branch model, no `.mcp.json`, no plugin install. |

**Why a new umbrella, not a reopen of hardening:** `consumer-install-hardening` (closed #493) was scoped to *shields-live + layout-agnostic + binary-resolution honesty*. It deliberately did **not** do one-button automation (#483) or consumer-mode skill-gating (#482), and #487 was filed (14:33Z) after its main work and never folded in. These three are a coherent follow-on: **the installer should be honest about what it ships to a non-framework consumer, and complete the setup it implies.**

## §1 Goal (one line)

A consumer who runs the installer gets (a) **honest docs** — no claim that's permanently false on their plan/layout (#487); (b) **no tool that runs-but-no-ops** — framework-internal skills either aren't shipped or self-skip with an explicit consumer-mode message (#482); and (c) **a setup that matches the "one-button" promise** or an honest, accurate checklist of what's genuinely manual (#483) — every gap closed with an **executable acceptance**, or explicitly routed via §6 DECISION-NEEDED. Nothing closed by prose.

## §2 Stage map

| Stage | Issue | Parallel? | Depends on | Branch prefix |
|---|---|---|---|---|
| **S1 docs-honesty** | #487 | yes (docs only — disjoint from install.sh) | — | `cic-s1-r11-paywall` |
| **S2 consumer-mode honesty** | #482 | after S1 merge (DN-A answered) | maintainer GO on **DN-A** | `cic-s2-consumer-skip` |
| **S3 one-button completeness** | #483 | no (edits `install.sh` next-steps + dep-install — file-locks with S2) | S2 merged + maintainer GO on **DN-B/DN-C** | `cic-s3-one-button` |
| **S4 re-verify + close** | all 3 | no | S3 merged | `cic-s4-verify` |

> **File-lock note:** S2 and S3 both edit `install.sh` (S2 ≈ skill-copy block `274-290`; S3 ≈ next-steps `649-677` + a new dep-install section). Disjoint line ranges, but to avoid a same-file merge race run them **sequential** (S2 → S3), not parallel. S1 (RULES.md + workflow template) is disjoint from both → safe to run alongside.

### S1 — #487 R11 paywall docs-honesty (cheap, no design fork)

Docs-only, **no behaviour change** (graceful degradation already correct). Add a one-line caveat in two shipped surfaces:
- `packages/preset-next-15-canonical/RULES.md` §R11 (`:266-274`): replace the "configured **yet**" framing with: *classic branch protection AND rulesets require GitHub Pro for private repos (or a public repo); on GitHub Free private repos this assertion is permanently warn-only — no consumer-side remediation; treat R11 branch-protection as **unavailable**, not "not yet adopted."*
- shipped template `templates/ts-server/github-actions-workflow-integrity.yml` warning text (`:41,66-67`): same caveat in the `::warning::` lines so the emitted CI message doesn't point a Free-private consumer at a paywalled Settings page.
- **Verify** whether the framework's own `.github/workflows/workflow-integrity.yml` should mirror the caveat (carries the same text at `:37,62-63`). Note this is the framework's **own** CI on its own repo (maintainer's plan), a *different* honesty surface than the two shipped-to-consumer ones above — out of the §3 scope fence unless the maintainer pulls it in; default = note as observation.

**Acceptance:** docs-audit / grep shows the caveat present in both shipped surfaces; the `::warning::` text no longer asserts "not yet adopted" unconditionally. No code/logic change (tri-state branch untouched).

### S2 — #482 consumer-mode honesty (BLOCKED on §6 DN-A)

Stop framework-internal tooling from silently no-opping in a consumer. The fix shape depends on **DN-A** (don't-ship vs self-skip-guard vs parameterize). Candidate surfaces:
- `install.sh:274-290` — the `.claude/skills/pipeline/` copy (and any runtime-bridge instruction shipping).
- `/pipeline` `SKILL.md` §0 — already anticipates the data gap (`SKILL.md:100` "if `wave-sequencing-plan.md` is MISSING — write a stub and ask"); promote that known edge to an explicit **consumer-mode skip** ("requires framework layout `docs/meta-factory/…` — skipped in consumer mode") instead of degrading to no-op.

**Acceptance (depends on DN-A verdict):** either (1) a consumer install does **not** ship `/pipeline`/runtime-bridge (grep the installed `.claude/skills/` — absent), or (2) running `/pipeline` in a consumer (no `docs/meta-factory/`) prints an explicit consumer-mode skip and exits without a misleading "Plan status: CURRENT" no-op. Negative test: framework layout present → the skill still operates (don't break the framework's own use).

### S3 — #483 one-button completeness (BLOCKED on §6 DN-B / DN-C)

Close the "copy-then-manual-checklist" gap to the scope the maintainer authorises (**DN-B**). Minimum-credible (DN-B option A): the installer **runs** the dep install it currently only *declares* — detect PM (`pnpm-lock.yaml`/`yarn.lock`/`package-lock.json`; `install.sh:223-226` already has the detector), run the dev-dep install (+ `husky`/`hooksPath` ordering) so wired hooks never precede their tools. This also closes the *ordering root cause* that #478 patched downstream. Plus: prune the now-**stale** "Next steps" step 5 ("add scripts" — already auto-merged at `install.sh:562-612`).

**Acceptance (depends on DN-B):** for the agreed scope — e.g. `./install.sh --with-deps` on a fresh consumer leaves `node_modules` populated with the hook deps and a commit succeeds with no ENOENT (executable smoke), and the "Next steps" block lists only genuinely-manual steps (no stale step 5). Branch-model / MCP / plugin items are routed per DN-C, not silently added.

## §3 Scope fence (hard)

**IN:** edits to `install.sh`, shipped templates (`templates/ts-server/*`, `packages/preset-next-15-canonical/RULES.md`), the shipped `/pipeline` `SKILL.md` consumer-mode behaviour, and re-verification on a real consumer shape.
**OUT (surface as observation / DECISION-NEEDED — do NOT do):**
- Reopening/redoing #478 (CLOSED — resolved by hardening umbrella) or any FQA/hardening-completed finding (F1–F15).
- New capabilities/frameworks/deps beyond what a fix needs (BFR: SSOT consult per capability commit; `install.sh` automating an existing dep-install is not a new capability — it shells out to the consumer's own package manager, adds no dependency to the framework's `package.json`).
- Editing the `timeliner` consumer repo itself (it is the polygon/evidence, not a deliverable).
- Full one-button scaffolding (branch model + `.mcp.json` + plugin install) **unless DN-C explicitly authorises it** — default is defer; #483 lists those as "any one" suggestions, not a mandate.
- `~/.claude/**` (agent-uncommittable); rewriting frozen/historical docs.

## §4 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) — MANDATORY)

Active traps: **T3, T5, T13, T14, T16, T19** + domain.
- **T3** — every fix carries an executable acceptance (command + output), not prose "fixed". #487 is docs-only but still grep-verifiable.
- **T5** — this is the I-phase; the research (the 3 issues + the §0 confirmation) is done. Do not re-audit the whole install surface; fix per the §2 stage descriptions.
- **T13/T16** — the shipped templates/skills ARE the subjects; "fixed" must be evidenced in a LANDED consumer install, not the source package (the entire class is verify≠delivered). `#pattern-matching-on-name`: `/pipeline` *sounds* consumer-useful but its problem-class is framework-internal wave orchestration — confirm match before deciding ship-vs-skip (DN-A).
- **T14** — "fixed" requires the per-stage acceptance to pass; partial → say so (e.g. S3 minimum-credible done but branch-model deferred = report that explicitly).
- **T19** — S4 own cold-QA on a real consumer shape before close; CI green ≠ shield/honesty live.

**Domain-specific:**
- **T-CIC-A — «honesty fix that quietly changes behaviour».** #487 is explicitly *docs-only, graceful-degradation-is-fine*. Counter: the S1 diff must touch only prose/`::warning::` text — the tri-state logic (`workflow-integrity.yml:48-68`) stays byte-identical. If you find yourself editing the `jq`/branch logic, stop — that's out of scope.
- **T-CIC-B — «consumer-mode guard that breaks the framework's own use».** S2 must self-skip in a *consumer* but keep operating in *this* repo (which has `docs/meta-factory/`). Counter: the skip condition keys on a layout marker absent in consumers (`docs/meta-factory/wave-sequencing-plan.md` / no `packages/core/principles/`), and a paired-negative test confirms the framework-layout arm still runs.
- **T-CIC-C — «declare-vs-install confusion».** #483's root: install **declares** devDeps (`install.sh:597-604`) but never **installs** them; a fix that only edits the declaration repeats the bug. Counter: the S3 acceptance is an executable post-install `node_modules` + commit-succeeds smoke, not "the manifest lists it".

## §5 Per-stage acceptance

- **S1:** grep/docs-audit shows the GitHub-Free-private caveat in `RULES.md` §R11 AND the shipped workflow template `::warning::` text; tri-state logic unchanged (diff is prose-only). §1.7 Forward/Backward in the PR (RULES.md is a watched-path under the preset).
- **S2:** per DN-A verdict — installed `.claude/skills/` reflects the chosen behaviour (absent, or self-skips with explicit consumer-mode message); negative test: framework layout present → `/pipeline` still operates. Install-sh test added if the don't-ship path is chosen (extend `tests/install-sh/`).
- **S3:** per DN-B scope — executable smoke on a fresh consumer (deps installed, commit succeeds, no ENOENT) + "Next steps" lists only genuinely-manual steps; deferred items (DN-C) named, not silently added.
- **S4:** fresh install on a real consumer shape (flat + monorepo) from `staging` tip → all 3 issues' acceptances pass (or explicitly routed); `make self-audit` + full principle suite green; `done.md` per CLAUDE.md Umbrella-closure schema; the 3 issues closed with citation comments.

## §6 DECISION-NEEDED (maintainer GO required — auditor leans stated, maintainer decides)

- **DN-A (#482) — consumer-mode for framework-internal skills:** (A) **don't ship** `/pipeline`+runtime-bridge to consumers (detect consumer context, skip the copy); (B) **ship + self-skip** with an explicit "requires framework layout — skipped in consumer mode" message; (C) **parameterize** the skill so its runtime refs are conditional. **Orchestrator lean: B** — consistent with the hardening umbrella's `/aif-*` honesty precedent (PR #480/#485: reframe-as-conditional rather than remove), least-destructive, keeps the skill readable as an example. *Lean is wrong if `/pipeline` is purely framework-internal with zero consumer value → then A (don't ship).* Maintainer decides whether `/pipeline` is meant to reach consumers at all.
- **DN-B (#483) — scope of "one-button":** (A) **auto-install deps only** — detect PM + run dev-dep install + fix hook/dep ordering (closes the #478 root; smallest blast radius); (B) **+ scaffolding** — branch model (`staging`), starter `.mcp.json`, plugin wiring; (C) **honest-checklist only** — keep manual but make the 8-step block accurate (prune stale step 5, mark what's truly manual). **Orchestrator lean: A now, B deferred** — A is the high-value, low-controversy piece and was the install ordering root cause; B is opinionated (a consumer may not want a `staging` branch / specific MCP) and the maintainer previously scoped one-button OUT, so it needs its own design pass. *Lean is wrong if the maintainer wants the full one-button promise delivered now → then this stage needs an R-phase/brainstorm first.*
- **DN-C (#483 follow-on, only if DN-B≠C) — opt-in shape:** default-on dep-install vs `--with-deps` flag? **Orchestrator lean: `--with-deps` flag** (non-destructive default; explicit opt-in to a mutating `npm install`), with the "Next steps" block pointing at it.

## §7 Stage-gate mechanic (between every stage)

```bash
gh pr list --search "is:merged head:<stage-branch> base:staging" --json number,title,mergedAt --limit 10
```
All stage PRs merged → Phase -1 cold-review (read-only Agent, [reviewer-discipline.md §2](../../rules/reviewer-discipline.md)) → GO before next stage. **Pre-dispatch in-flight probe per CLAUDE.md §Operational conventions before EVERY dispatch** (the 3 historical collisions all materialised inside the Phase -1 window).

## §8 Notes for the orchestrator (/pipeline)

- **Source-of-truth is `staging`, not a local worktree:** the §0 evidence was read at tip `b6096914` via `gh api`; a local clone may lag. Re-confirm line numbers against `staging` before editing (the hardening umbrella shifted install.sh by ~40 lines — `install.sh` is now 677 lines).
- **Tunnel caveat:** push may be blocked by the Clash fake-ip TUN (memory `project_github_push_flaky_proxy_tunnel`); use `harvest-via-api.sh` / gh Git Data API fallback; keep commits offline-resilient.
- **Reuse, don't rebuild (BFR):** `scripts/audit-ai-docs.sh`, `tests/install-sh/*.test.sh` harness, the existing PM-detector (`install.sh:223-226`), `make self-audit`, the `/tmp` fresh-install pattern, the `check-lintstaged-resolves.sh`/`f14`/`f15` precedent for install-sh tests.
- **DN gating is real:** S2 and S3 are BLOCKED until DN-A / DN-B(/C) are answered. S1 (#487) is fork-free — ship it first regardless.
- Last-stage merge → `done.md` here per CLAUDE.md Umbrella-closure convention; close #482/#483/#487 with citation comments (as #478 was closed).
- This kickoff is consumed by `/pipeline`; the generated meta-launch kickoff must pass principle 12 (its own §5 AI-traps with T-enumeration) — `/pipeline` authors that; this umbrella kickoff seeds the trap list in §4 above.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
