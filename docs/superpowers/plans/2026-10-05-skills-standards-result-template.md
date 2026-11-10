# Skill repairs — implementation result template

> **Authoritative for:** fields required to review the senior's implementation and review input.
> **NOT authoritative for:** an acceptance verdict or permission for publication.

Write the actual report to `docs/audits/2026-10-05-skills-repair-result.md`; replace instructions with observed facts.

## Identity

Workspace absolute path; branch; audit baseline; implementation base/head SHA; task-scoped commit IDs. For uncommitted changes, save a patch including new resources and provide its path/checksum plus a changed-file manifest. `git diff` alone omits untracked resources: include them in the frozen review snapshot. Record upstream changes separately from task edits.

## Finding dispositions

| ID | Result: implemented / partial / open | Changed source and evidence | Residual |
| --- | --- | --- | --- |
| F1–F9 | One row per ID | Actual file:line and relevant observed output | Explicit limitation |

Do not use RESOLVED for an item without its specified evidence. F9 stays OPEN when only static/deterministic checks ran.

## Card measurements and invariant inventory

For pipeline, dispatcher, doctor, orchestrator, arch and night-mode: baseline/candidate body lines, words and UTF-8 bytes; extracted files; each read condition; where required action constraints live. Report metadata separately. List other production names with unchanged/changed disposition and explain any target exception.

## Verification receipts

| Command | Actual workspace/candidate identity | Exit / result | What it proves | Limit |
| --- | --- | --- | --- | --- |
| Actual command | Host or disposable candidate snapshot | Observed, not expected | Relevant acceptance item | Skips/unavailable/live limits |

Include strict YAML, generated parity, local links/anchors, relevant principles, generation test, runtime-helper interface and consumer/plugin-only prerequisites. Distinguish full suite from targeted tests and structural validation from model behavior.

## Scope preservation and residuals

List retained invocation flags, pinned resources, authorization boundaries and untouched global settings. Record unavailable dependencies, unresolved semantics, blocked acceptance items and any deviations. Explain why no unrelated source was modified.

## Senior review input

Point to the immutable candidate snapshot/report, exact scope and review plan `docs/superpowers/plans/2026-10-05-skills-standards-review.md` from the result report's location, or use its absolute path. Provide a compact prompt: read the result report and run the prepared read-only review against the recorded candidate identity. The implementation report is not acceptance until the read-only review records its verdict.

## Junior Git-delivery receipt (after senior acceptance)

Record accepted snapshot/base/head, delivery commit, PR URL, merge SHA, required CI results and content equivalence. Any differing content is named for senior re-verification. Junior delivery does not substitute for source review.
