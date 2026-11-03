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

1. **Tautological tests** — assertions true by construction (test nothing real). For each `expect(...)` in the diff, ask: _"if I removed this assertion, what bug could now ship?"_ If the answer is "none", flag it. Common shapes: `expect(result).toBeDefined()` when the return type is already non-optional; `expect(typeof x).toBe('string')` when the type guarantees it; asserting against the same computation the SUT uses (`items.reduce(...)` mirrored in both); `expect(mock).toHaveBeenCalled()` with no assertion on arguments or resulting side effect; React `toBeInTheDocument()` / `toBeEnabled()` with no follow-up behavioral assertion.

2. **Mock-only tests** — the test verifies a mock was called but not the **outcome** that should follow (returned shape, emitted event, reserved inventory, sent email). Flag.

3. **Missing edge cases** — for each public function in the diff, confirm tests cover empty input (`[]`/`''`/`{}`/`null`/`undefined`), boundary values (0, max, just-above/below threshold), error paths, and racy/concurrent paths where applicable. Happy-path-only on a new function → flag MAJOR.

4. **Test name ≠ behaviour** — names must describe asserted behaviour ("returns 401 when token is missing"), not mechanics ("test 1", "works", "checks user").

5. **Test independence** — module-level mutable state without `beforeEach` reset, FS/DB writes without cleanup, missing `vi.clearAllMocks()`. Tests must run in any order.

6. **React / Next anti-patterns** (`.tsx`/`.jsx`) — `<div onClick>` instead of `<button>`; icon buttons without `aria-label`; `key={i}` in dynamic lists; `useEffect` missing deps; `{count && <X/>}` rendering "0"; `<a href>` for internal links instead of `<Link>`; `<img>` instead of `next/image`; client-only work in Server Components and server-only imports in Client Components.

7. **React testing anti-patterns** — `fireEvent.click` instead of `userEvent.click`; `getByTestId` where `getByRole` works; stray `screen.debug()`; redundant `act()` around `userEvent`.

8. **A case that passes for the sibling's reason** — when the diff adds a channel between two components (tmp file, env var, shared state, config key), name the single production change that flips each new or touched case. If you cannot, or an input the sibling writes is left unpinned in the fixture, flag MAJOR. The RED proof must run against `git show HEAD:<path>` pre-images of every file the fix touches (no visible proof covering every touched file is itself a finding); each pin carries its reason inline; existing tests of both sides are in scope.

## Output augmentation

In addition to AIF's standard review summary, include a section `### Test-Quality Review` listing each finding as: severity (`BLOCKER` correctness/data-integrity incl. tautological test on a critical path / `MAJOR` anti-pattern at scale / `MINOR` style), `file:line`, "what I saw", "why it's a problem", and a concrete one-line fix. One issue per finding; do not bundle. Report only — never modify code.
