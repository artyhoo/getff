# Canonical agents — independent review specification

> **Authoritative for:** independent acceptance of a frozen canonical completion result.
> **NOT authoritative for:** implementation choices outside findings, publication or trust decisions.

## Context

The operator wants a cheaper model to review and verify factory work independently.
Implementation contract: [completion specification](2026-10-05-agents-canonical-completion-design.md).
Prepared code and passing counts are claims to assess, not authority for a verdict.

## Decisions

| Decision | Resolution | Falsifier |
|---|---|---|
| Fresh context | Read specs, recorded operator premises and frozen result; no implementer conversation inheritance required. | Findings merely restate the implementer's self-review. |
| Exact identity | Verify review-target.json and result hashes before checks and again at close. | Different source tested from the one being accepted. |
| Read-only source | Use a private copy for tests that write/commit; return findings separately. | Reviewer silently repairs source or modifies implementer state. |
| Economy | One whole-change review; meaningful controls at changed joins; repeat only after material fixes. | Unchanged broad test/review loops consume tokens without new evidence. |
| Native honesty | Host-access limits are reported; discovery and container tests never prove actual feedback. | Desktop hook behavior gets PASS without a host receipt. |

## Review population

Enumerate all intended paths, map owners/entries from canonical-agents-map.json, compare original/current diff and generator/package manifests.
Structural checks cover the complete mapped population. Native behavioral checks are case-specific and cannot be extrapolated to all rows.
Keep original 20 workflow groups and M01–M32; reconcile claims with actual current code. Historical ledger text can be stale after a source repair.
Do not require unrelated remote harvest/board jobs to accept source storage, but do not call their remaining gaps full parity.

## Required evidence

R1 Source: one authored owner; full-source loading, helpers, arguments, native invocation metadata and meaningful descriptions.
R2 Reuse: changing a common body/check reaches all intended bindings; plugin expanded copies match whole canonical bodies under documented transforms.
R3 Events: clean and violating controls through affected adapters; canonical/legacy paths and add/update/delete/move semantics.
R4 Git: fresh intended tracked checkout has required files and links; no recovery generation.
R5 Destination: sealed bytes/index/WIP preserved during local integration; managed native outputs changed ownership-aware.
R6 Installer: fresh/upgrade/repeat/force/refresh/dry-run/customization; all 15 snapshots accounted for and no external links.
R7 Package: tracked payload closure, MANIFEST, standalone local pack install with original source absent.
R8 Gates: required final gates passed for exact result, or specific unresolved failures retained. No deleted test, fabricated evidence or blanket exemption.
R9 Native: source loading and mandatory helper execution; startup/rules/deny/feedback/cache/child/compact receipts for affected supported contracts.
R10 Gaps: unknown executors/MCP policy, failed-write/cancellation, lifecycle and factory/memory boundaries accurately represented.

## Native protocol and permissions

Use existing historical trace drivers where valid and native doctor read-only configuration/discovery probes.
Run changed host controls only in owned ephemeral destinations. Require assistant/tool receipt for feedback, actual pre-effect denial for guards and real lifecycle events for compact/child claims.
Models, tool frontmatter and files cannot grant host permissions. No paid API, trust bypass, global refresh or unrelated remote mutation.
If the cheap reviewer runs only in AIF, R9 is HOST-PENDING; the same kickoff must continue in a cheaper host-capable seat before behavior acceptance.

## Verdict and outputs

Produce review-report.md with: frozen identity, scope, controls run, requirement-to-evidence matrix, blocking findings, nonblocking findings, native limitations and unresolved operator decisions.
Each finding states requirement, concrete path/line, trigger, observed/expected result and reproduction; no vague confidence assertion.
Use separate architecture, native behavior, installer and package verdicts: PASS / NEEDS-WORK / UNVERIFIED.
Overall ACCEPT requires every in-scope requirement passed or an explicit operator-approved scope decision. Unsupported or inaccessible native behavior alone is not approval.
Keep complete=false in the historical overall ledger unless its actual full contract is met.
Return minimal, exact rework instructions to the existing dispatcher. Reviewer never merges or publishes.

## §1.7 Self-review

The review tests both directions: claimed success has evidence; each material operator requirement has a disposition.
A clean report with inadequate coverage is UNVERIFIED. Immutable identity and isolated tests apply to this review itself.
