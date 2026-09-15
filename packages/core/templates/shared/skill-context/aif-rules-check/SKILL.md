---
name: aif-rules-check-project-context
---

# aif-rules-check skill-context — naming + test-existence residue

> **Authoritative for:** project-specific rule checks injected into AI Factory's `aif-rules-check` skill (and its `rules-sidecar`) — the two checks from this project's `RULES.md` that are NOT enforced at an earlier deterministic channel (R10 naming, R4/R17 test-existence) and therefore need a verify-time pass.
> **NOT authoritative for:** project goal — see the consumer's README.md. The R1–R20 corpus itself — that lives in `.ai-factory/RULES.md`, which `rules-sidecar` already reads; this file only adds the residue not covered by the edit-time ESLint channel.

<!-- This file is the standalone SSOT for the R10/R4/R17 residue. Most rule checks
     (R1-R3, R5-R8, R12, R14-R16, R19-R20) are enforced earlier by the custom ESLint rules at
     edit-time (pre-push carries getff's own rule checks, not tsc/depcruise). Only the checks below have NO earlier
     deterministic channel, so they ship here as a skill-context augmentation rather than
     as a colliding sub-agent (C-1 KEEP-AIF resolution). There is no paired agent file —
     the former best-practices-sidecar.md was removed; this skill-context carries the
     residue spec in full. -->

`rules-sidecar` already reads `.ai-factory/RULES.md` for the full R1–R20 corpus. **Do not re-run** rule checks the project enforces at edit-time — the custom ESLint rules are the authoritative, earlier channel there. Do NOT assume pre-push covers your typecheck, tests or architecture: it runs getff's own rule checks only (rule-glob liveness, lint-staged resolution, generated-rule firing, changed-Markdown links), so anything else has no earlier deterministic channel and is in scope for this review. This file adds only the two checks that have **no** earlier deterministic enforcement and so genuinely need a verify-time review of the diff.

## R10 — Naming conventions (no earlier automated channel)

`RULES.md` marks R10 as "manual review only" with no `audit-ai-docs.sh` probe. On the changed files, check and report violations of the project's naming scheme:

- filename matches the primary exported symbol;
- `*Repository` interfaces live in the domain layer;
- `*Service` types are **not** in the domain layer;
- `*Controller` types appear only under the web/HTTP layer.

Report as `R10 naming: PASS|FAIL` with `file:line` and a one-line fix. Treat these as advisory unless the project's `RULES.md` marks R10 blocking — naming is project-specific and the check is heuristic.

## R4 / R17 — Test-existence for new code (structural, not an ESLint rule)

ESLint cannot assert that a test _file_ exists. On the diff:

- **R4:** every newly exported function under `src/` should have a matching test file containing at least one assertion. Flag new exports with no test.
- **R17 (React/Next):** every new `.tsx` component should have a matching `.unit.ts` (and, where the project requires it, `.stories.tsx`).

Report as `R4 tests-for-new-code: PASS|FAIL` / `R17 component-tests: PASS|FAIL` with the exported symbol + `file:line` and the expected test path. Report only — do not create the tests.

## Output augmentation

Append a `### Project Residue Checks (R10 / R4 / R17)` section to the standard rules-check output, listing each check's verdict and any `file:line` findings. Do not duplicate verdicts for rules already covered by edit-time ESLint or pre-push — name those as "enforced earlier (ESLint/pre-push)" and move on.
