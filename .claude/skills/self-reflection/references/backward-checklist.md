# Backward-check — full enumeration

> **Authoritative for:** the complete backward-check enumeration for §1.7 «Recommendation self-discipline check» (new-rule scope determination, full sweep, closure) — inherits invocation scope from [SKILL.md](../SKILL.md).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). The §1.7 discipline itself — owned by [phase-research-coverage.md](../../../rules/phase-research-coverage.md).

The backward direction is what `#recursive-self-application-gap` was created to catch. Forward-check verifies the proposal complies with existing disciplines; backward-check verifies the new rule the proposal introduces is applied to _all_ existing artefacts under its scope.

## Step 0 — Defeat restatement first (cold-sweep + enumeration format)

The dominant failure of this checklist under a long, context-loaded session is **restatement** — writing a backward-check that recaps _what the PR did_ (naming only the diff's own files) instead of sweeping the _sibling surfaces_ where the same change-class must also hold. This is [`#backward-check-restates-not-sweeps`](../../../rules/ai-laziness-traps.md) (T21); its incident is PR #857, where a restated backward-check let a real parallel Tier-1 gap reach the PR. Two structural guards (a stronger reminder would rot under the same fatigue):

1. **Delegate to the cold sub-agent when the change has parallel surfaces.** Dispatch [`agents/backward-sweep-auditor.md`](../../../../agents/backward-sweep-auditor.md) with **only the change's class** (one-sentence content predicate — _never_ the diff or PR narrative). It enumerates every parallel surface and returns `GAP-FOUND` / `SWEPT-CLEAN` per surface. It cannot restate the PR because it never saw it. AI-agnostic, no paid LLM.
2. **Author the section in the enumeration format**, so an omission is visible without reading the code:
   ```text
   Class of this change = <content predicate>.
   Surfaces where the class occurs (population N, via <grep/find command>):
     - <surface file:line> — SWEPT-CLEAN (guard at <file:line>)   [touched-by-change: NO]
     - <surface file:line> — GAP-FOUND   (action / follow-up commit)
   Surfaces NOT in the diff but IN the class: <non-empty, unless genuinely first-of-class>.
   ```

Steps 1–6 below are how _you_ (or the cold agent) run the sweep whose result populates this format.

## Step 1 — Determine the new rule's scope

Express scope as a path glob or a content predicate:

- Path glob: `templates/**/*.md`, `.claude/rules/*.md`, `packages/core/principles/*.test.ts`.
- Content predicate: «every doc that contains a `> **Authoritative for:**` header», «every commit message body matching `Prior-art:` regex».

Avoid vague scopes («every doc that should have X») — they are unverifiable.

## Step 2 — Complete sweep, not the §1.5 floor

`#prompt-list-anchoring` anti-pattern says: floor (3-5 examples) is **not** the ceiling. For backward sweep specifically, the ceiling is **all artefacts under scope**, not «representative samples».

Run actual `find` / `grep`:

```bash
# Example: scope = "every shipped template *.md.template under packages/"
find packages -name "*.md.template" -type f

# Example: scope = "every authority-bearing doc"
grep -rln "^> \*\*Authoritative for:\*\*" --include="*.md"
```

Compare result with proposal's enumeration. Every match must be either:

- **In compliance** (already follows new rule), OR
- **Explicitly exempted** (see Step 3), OR
- **Brought into compliance in same commit** (the typical case for a backward sweep).

If proposal claims «add header to N files» but the sweep finds N+M unhandled files → proposal is incomplete.

## Step 3 — Exemption mechanism

Test fixtures and intentionally-invalid examples need a way to opt out. Pick **one** mechanism, document in rule body:

- **Path glob**: `packages/*/fixtures/**`, `packages/*/research/fixtures/**`. Pros: discoverable, stable. Cons: tied to filesystem layout.
- **Sentinel marker**: `<!-- fixture: with-drift -->` near top of file. Pros: works for files outside fixture dirs. Cons: invisible from `find`, requires reading file.
- **Frontmatter flag**: `exempt-from-X: true`. Pros: structured. Cons: adds frontmatter to docs that wouldn't otherwise have it.

Default: path glob if fixtures already live under predictable paths; sentinel marker for one-off exceptions.

## Step 4 — Exemption meta-test (positive + mutation)

The exemption mechanism itself must be tested:

- **Positive test**: file under exemption with intentionally-invalid content does not break enforcement.

  ```typescript
  it('files under packages/*/fixtures/** are exempt from principle 09', () => {
    const fixturePath =
      'packages/core/research/fixtures/drift/with-drift/skills/rules-as-tests/SKILL.md';
    // file intentionally lacks Authoritative-for header
    expect(isExempt(fixturePath)).toBe(true);
  });
  ```

- **Mutation (anti-tautology)**: removing exemption breaks intent.
  ```typescript
  it('mutation: without exemption, fixture file fails principle 09', () => {
    const fakeWithoutExemption = readFile('fixture-without-header.md');
    expect(hasAuthorityHeader(fakeWithoutExemption)).toBe(false);
    // Confirms: rule actually catches missing headers; exemption is the only reason fixture passes.
  });
  ```

Without the mutation pair, the exemption could silently degrade to «always exempt» (bug) without any test failing.

## Step 5 — Cross-check against existing canonical lists

If the new rule has a canonical enumerate list (like `principle 09 REQUIRED_HEADER_DOCS`):

- Diff proposal's planned additions vs current list — no duplicates.
- If list has explicit length sanity (`expect(REQUIRED_HEADER_DOCS.length).toBeLessThanOrEqual(60)` in principle 09 line 156) — does proposal stay within bounds?
- Removed entries (if any) explicitly justified.

## Step 6 — Reverse-cross-check: does the new rule break any existing artefact?

The dual of step 2: walk **existing** artefacts and ask «does the new rule make any of them fail unintentionally?»

- For each existing artefact under new scope: would it pass new rule today?
- If not — is breakage the intent (this is the discipline-extension catching previously-unfound gaps), or is it an over-broad scope?
- Document either way in proposal.

This step catches «rule extension was actually a rule replacement in disguise» — easy to miss when the assistant is focused on additions, not on collateral effects.
