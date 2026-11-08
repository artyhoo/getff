---
name: aif-review-project-context
---

# aif-review skill-context — anti-tautology two-AI review conventions

> **Authoritative for:** project-specific review conventions injected into AI Factory's `aif-review` skill (and its background `review-sidecar`) — the anti-tautology / two-AI test-review checks this project requires in addition to AIF's generic review.
> **NOT authoritative for:** project goal — see the consumer's README.md. The generic correctness/security/performance review — that stays owned by AIF's `aif-review` SKILL.md; this file augments it.

<!-- @dual-pair: review-sidecar -->
<!-- spec-of: agents/review-sidecar.md -->
<!-- Portable SSOT for this content is agents/review-sidecar.md. This file is the AIF-native
     delivery channel (skill-context override) for the same anti-tautology spec, per
     .claude/rules/dual-implementation-discipline.md §7. Edit the SSOT first, then mirror here. -->

This project has learned, from repeated incidents, that the highest-value review signal is **test quality**, not just code correctness. AIF's generic review already covers correctness / security / performance; the conventions below are what this project additionally requires. Apply them as project-level overrides — when they add a check AIF's defaults don't have, perform that check and include it in the output.

## Review the diff as a cold external reviewer

Read the changed code as if you had never seen it and did **not** write it. The implementer wrote the code and its tests in one head — same blind spots. Your value is being a different head. Be skeptical of comments and commit messages; read the actual diff.

## MUST additionally check — test quality

1. **Tautological tests** — the expected outcome comes from the SUT computation or a fixture guarantee excluding the claimed defect. Require an independent observable contract. Static types do not guarantee external runtime values: presence/type/schema tests and negative companions may be meaningful at typed JSON/environment/storage/process boundaries. Structural or overlapping assertions are not automatically tautologies. Assess removal impact separately as redundancy/marginal contribution against retained witnesses.
2. **Mock-only tests** — the test verifies a mock was called but not the **outcome** that should follow (returned shape, emitted event, reserved inventory, sent email). Flag.

3. **Missing edge cases** — select empty/boundary/error/concurrent cases from the actual contract and material risk. Name a concrete permitted failure before grading; no generic every-public-function case quota or automatic MAJOR for happy-path-only.
4. **Test name ≠ behaviour** — names must describe asserted behaviour ("returns 401 when token is missing"), not mechanics ("test 1", "works", "checks user").

5. **Test independence** — module-level mutable state without `beforeEach` reset, FS/DB writes without cleanup, missing `vi.clearAllMocks()`. Tests must run in any order.

6. **React / Next anti-patterns** (`.tsx`/`.jsx`) — `<div onClick>` instead of `<button>`; icon buttons without `aria-label`; `key={i}` in dynamic lists; `useEffect` missing deps; `{count && <X/>}` rendering "0"; `<a href>` for internal links instead of `<Link>`; `<img>` instead of `next/image`; client-only work in Server Components and server-only imports in Client Components.

7. **React testing anti-patterns** — `fireEvent.click` instead of `userEvent.click`; `getByTestId` where `getByRole` works; stray `screen.debug()`; redundant `act()` around `userEvent`.

8. **A case that passes for the sibling's reason** — name the relevant causal change or combination and pin sibling-controlled inputs with their reasons. Review RED against relevant causal preimages together, including an unchanged sibling where it can supply the result. Existing cases on both sides remain in scope. Do not demand per-comment/per-generated-copy/every-touched-file RED experiments.

## Minimal sufficient protection (including checks of checks)

Apply all seven criteria to tests, CI, hooks, runners, principles, TAK and their
conformance controls; do not exempt a metacheck because it checks another check.

1. **Relevance:** identify the material risk, contract and observable consequence.
2. **Effectiveness:** an independently expected defect-sensitive witness plus valid
   companions; inspect actual invocation, discovery, status propagation and lifecycle.
3. **Non-theatre:** a claimed guard must reach its real subject and block at its stated
   boundary; a record or declaration is not proof of execution or semantic truth.
4. **Independent oracle:** expected outcomes cannot be copied from the SUT or guaranteed
   by the fixture; finite independently fixed expectations and host behavior are the
   trusted boundary, not an infinite driver-of-driver audit.
5. **Marginal protection/reuse:** compare with retained witnesses, including unique
   environment/OS and source-versus-installed subjects. Remove zero-marginal checks;
   tiny benefit is not zero, and similar commands may protect different contracts.
6. **Cost and channel:** inspect execution/queue/support/false-alarm cost, frequency,
   scope and blocking status. Redesign useful expensive checks when a cheaper sound
   equivalent is established; preserve quality and detection timing without tradeoffs.
7. **Sufficiency:** state missing risks and source/host/owner limits. Historical failure
   or full mutation is not required for every assertion, nor a second audit on every PR.

Use the actual base/full-head diff, including deletion and both sides of renames.
Check-changing work includes CI/scheduling, hook/runner configuration, package
check/test scripts and test/probe implementations. Unknown scope must not silently
become docs-only; ordinary unrelated documentation does not require a history search
or new seat. Use at most two available matched CI-history traces for the initial
judgment. If unavailable, state why and the bounded owner decision; do not invent
measurements, a global runtime SLO, profiler or second review platform.

Extend this same cold review's Test-Quality Review findings. Preserve the original
report. Give each material finding a stable ID, failure-scenario, class and evidence;
zero material findings with a useful scoped basis is legitimate. The controller
consumes it before fidelity using the record below. You report; the controller owns
disposition, source repairs and acceptance. OCR/TAK owner materials, when actually
accepted and available, belong on their existing native path, never a duplicate review.

## Output augmentation

In addition to AIF's standard review summary, include a section `### Test-Quality Review` listing each finding as: severity (`BLOCKER` correctness/data-integrity incl. tautological test on a critical path / `MAJOR` anti-pattern at scale / `MINOR` style), `file:line`, "what I saw", "why it's a problem", and a concrete one-line fix. One issue per finding; do not bundle. Report only — never modify code.

## Consumed protection review record

For a check-changing diff, the controller places exactly one top-level
`protection-review` JSON fence in the PR body (outside Git, avoiding a head/report
commit treadmill), alongside the existing fidelity verdict. Keys:

- `version: 1`, `base` (fresh merge-base full SHA), `head` (full current SHA),
  `scope` (exact changed paths; include both old/new rename paths).
- `reviewer`, `report` (original cold-report reference), `consumedBy` (controller),
  `basis` (useful scoped judgment with evidence, missing risks and seven criteria).
- `history`: `{ "status": "available", "traces": ["matched trace reference"] }`
  (one or two), or `{ "status": "unavailable", "reason": "...", "ownerDecision": "..." }`.
- `findings`: array of material findings (empty is valid). Each has stable `id`,
  `failureScenario`, `class`, `disposition`, and nonempty `evidence` reference array.
  Disposition is `fixed`, `retained-with-evidence`, `owner-accepted-deferral`, or
  `unresolved`. A deferral requires an `ownerAcceptance` reference. Unresolved or
  unaccepted material findings block acceptance, including with `FIDELITY: skipped`.

A fixed disposition cites actual source repairs and fresh verification at the bound
head; unchanged bad source is never labelled fixed to make the schema pass. Retained
findings cite the competing contract/evidence. A moved base/head/scope needs an actual
narrow reassessment and updated record, preserving the original report and stable IDs.
The CLI verifies structure/binding/disposition transport only. It cannot establish
arbitrary semantic truth, actual review occurrence, evidence accuracy or reviewer
identity: the truthful controller and competent cold seat are the explicit trusted
boundary. No cryptographic identity system, finding quota or paid model CI is implied.
