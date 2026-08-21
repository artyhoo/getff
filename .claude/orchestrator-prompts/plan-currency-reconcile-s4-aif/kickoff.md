# DISPATCH — plan-currency-reconcile S4: skepticism-pass on three "DONE" surfaces (read-only audit)

> **aif task. Single buildable unit.** Umbrella: `plan-currency-reconcile` (getff-to-prod U1), sub-wave **S4**. This is NOT an orchestration plan — it is ONE audit task producing ONE deliverable file. Base branch: `staging` (NOT main).
> **Type:** read-only skepticism audit (R/doc, no product code). **No operator-notes needed** (everything is in-repo / git).

---

## What you build (the single deliverable)

Write exactly one file:

`docs/meta-factory/research-patches/2026-06-28-plan-currency-reconcile-s4-skepticism.md`

It contains a **per-target verdict** for each of the three surfaces below — each verdict is `verified-done` OR `finding-filed`, backed by a **command + its output** or a **`file:line` citation** (never "looks ok", never prose-only). That is the whole job.

---

## The three targets (audit each against the code on `staging`, not against any tracker text)

1. **`migration-ast`** — a closed umbrella (`.claude/orchestrator-prompts/migration-ast/done.md` exists; branches `chore/migration-ast-done`, `feature/migration-ast-aee33f`). Read its `done.md` claim, then verify the claimed artefact actually exists and does what the claim says — `git ls-tree`, `git log`, open the file. Verdict: does the code match the "done" claim?
2. **plugin (#673)** — the plugin payload (`.claude-plugin/` + `plugin/` on `staging`). Claim: "плагин наполнен (агенты/команда/hooks.json/скиллы/мост)" (getff §0). Verify each named component is actually present + non-empty (agents, command, `hooks.json`, skills, bridge). Verdict: is the plugin genuinely populated, or are some pieces stubs?
3. **generator** (forbid-MVP) — `packages/core/scenario-generator/`. Claim: "генератор forbid-MVP (декларативный ярус + анти-пустышка + forbid-компиляция + provenance + live-LLM путь)" (getff §0). Verify each claimed capability is present in the code (grep for the declarative tier, the anti-empty guard, forbid-compilation, provenance, the live-LLM path). Verdict: are all five capabilities real, or is one overclaimed?

---

## Method (mandatory — this is the point of the task)

- **Source of truth = `git` / the code on `staging`, NEVER a tracker's prose.** Reading "done" in a doc and believing the text is the exact bug class this umbrella exists to kill (`T-PCR-A`). Every status line MUST be backed by a real command + its output.
- **T3:** every claim → command + output, or `file:line`. Zero prose-only verdicts.
- **T14:** a clean pass at low coverage is "coverage insufficient", NOT "verified-done". State your coverage per target.
- **T5 (hard):** you are auditing, NOT fixing. If you find a real bug or overclaim, record it as a **finding** in the deliverable — do **NOT** fix it, do **NOT** touch the audited code. Bug-fixes are a separate umbrella by design.
- Output language of the deliverable file: **English** (repo artefact).

---

## Fork discipline — park-don't-guess (non-negotiable)

**aif agent:** On ANY genuine fork or ambiguity (two defensible readings of a "done" claim, a missing spec detail that changes the verdict, an undecided scope question) — **do NOT pick and proceed.** Park it as a question (set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X / Option B → consequence Y») and **stop on that point.** Proceed only on the unambiguous targets. Guessing a fork to "keep moving" is the failure this whole loop exists to prevent.

If a target requires a file that is not present on `staging` (e.g. an operator-note outside the repo), that is a **park**, not a guess — record "cannot verify in-container: <path> absent" and move on.

---

## Done = this file exists with three backed verdicts

- Deliverable written at the path above, each of the 3 targets carrying `verified-done | finding-filed` + command/`file:line` evidence + a one-line coverage statement.
- No product code touched (T5).
- `make self-audit` still green (cheap confirm; this is a doc-only change).

## Egress (the host harvests — you do not push)

You do NOT push or open a PR (by design — no network). When the task reaches `done`, the host runs:
`npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging`

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
