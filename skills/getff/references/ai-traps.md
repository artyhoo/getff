# AI traps — what AI agents violate most and how each is caught

Read this file when the user mentions AI-generated code drift, Claude Code, Cursor, Copilot, or "code that looks fine but is wrong". This is the playbook for hardening a codebase against AI-driven development.

> **Authoritative for:** AI-agent failure-mode catalog with the rule that catches each; «Lessons learned» section with real-project incidents; trap-to-rule mapping for Vitest/Playwright/ESLint/audit probes.
> **NOT authoritative for:** framework's project goal — see [../../../README.md#why-this-exists](../../../README.md#why-this-exists). Layer taxonomy — see [overview.md](overview.md). Audit-script pattern — see [self-testing-docs.md](self-testing-docs.md).

---

## The fundamental issue

AI agents (Claude, Cursor, Copilot, Aider, Devin) write code that **looks plausible but reliably violates undocumented conventions**. They cannot be socialized into team norms by code review alone — they don't remember between sessions, they confidently produce tautological tests, and when they break a rule they break it consistently across hundreds of files at once.

Without enforced rules:

- `CLAUDE.md` instructions are forgotten within 3 commits.
- Code review by humans does not scale to AI's commit velocity.
- Tests pass, types pass, lints pass — and the code is still wrong (because the tests were also written by the same AI with the same blind spots).

The defense is **executable rules at every layer**, plus a **second AI reviewing tests** (without context of how they were written) to catch tautology.

---

## What AI violates most often, by frequency

### 1. Bypassing the type system

**Pattern:** `as any`, `as unknown as T`, `value!` (non-null assertion), `// @ts-ignore`, `// @ts-expect-error`.

**Why:** AI sees a type error and the path of least resistance is to suppress it.

**Caught by:**

- `@typescript-eslint/no-explicit-any: 'error'`
- `@typescript-eslint/no-non-null-assertion: 'error'`
- `@typescript-eslint/ban-ts-comment` (require explanatory comment)

### 2. Importing convenience libraries

**Pattern:** `import _ from 'lodash'`, `import moment`, `import axios` when the project has standardized on native fetch / date-fns / Zod.

**Why:** AI reaches for the first library it knows, not the one your project uses.

**Caught by:**

- `no-restricted-imports` with banlist
- dependency-cruiser rule blocking new top-level dependencies

### 3. Tautological tests

**Pattern:**

```ts
expect(result).toBeDefined();              // for typed function returning T (not T|undefined)
expect(typeof result).toBe('string');      // when return type IS string
expect(component).toBeInTheDocument();      // after render() with no other check
expect(mock).toHaveBeenCalled();           // without verifying behavioral outcome
expect(total).toBe(items.reduce(...));     // expected computed by same logic as SUT
```

**Why:** AI generates tests that "look like tests" but assert what's already true by construction.

**Caught by:**

- **Mutation testing (Layer 4)** — the canonical defense. Tautological test never kills a mutant.
- AI Factory `review-sidecar` — second AI without code context reads the test and flags suspicious patterns.
- AST meta-test: assertion's compared values must transitively depend on a call to the SUT, not just literals/types.

### 4. Always-passing tests

**Pattern:**

```ts
try {
  someAsync();
} catch {
  /* ignore */
} // swallow errors
expect(value !== undefined).toBe(true); // always true for required field
```

**Caught by:**

- `eslint-plugin-vitest/expect-expect`
- AST scan: `try` blocks in tests must have `expect.toThrow` or matching `.rejects`
- Mutation testing again

### 5. Layer / dependency violations

**Pattern:**

- Domain code importing from infrastructure
- Controllers reaching into domain repositories directly
- Cross-feature imports without going through `index.ts`
- `'use client'` files importing server-only modules in Next.js

**Why:** AI doesn't internalize layer boundaries — it sees that the symbol resolves and assumes that's enough.

**Caught by:**

- dependency-cruiser layered rules
- `import 'server-only'` / `import 'client-only'` packages (Next.js)
- ESLint `no-restricted-imports` with patterns

### 6. Floating promises

**Pattern:** `someAsync()` without await/return, `.then()` chains without final `.catch`.

**Why:** AI mixes async paradigms freely.

**Caught by:**

- `@typescript-eslint/no-floating-promises: 'error'`
- `@typescript-eslint/no-misused-promises: 'error'`

### 7. Forbidden runtime patterns

**Pattern:**

- `Date.now()`, `new Date()`, `performance.now()` directly in production code
- `Math.random()` directly in production code
- `Thread.sleep()` / `setTimeout` for synchronization in tests
- `console.log` in production code

**Why:** AI reaches for the simplest API it knows.

**Caught by:**

- `no-restricted-syntax` with custom selectors
- ESLint `no-console`
- AST meta-test for tests

### 8. Public API inflation

**Pattern:** marking helper functions `export`, default exports, exposing internal types.

**Why:** AI defaults to "make it accessible" without thinking about API surface.

**Caught by:**

- ESLint `import/no-default-export` (use named only)
- API surface snapshot test (track public types/methods, fail on growth without explicit allow-list edit)

### 9. Re-introducing fixed bugs

**Pattern:** AI touches old code, doesn't read regression tests carefully, reverts a previous fix.

**Why:** AI optimizes for the change at hand, doesn't survey existing tests.

**Caught by:**

- Regression test density: each closed bug → permanent spec test with bug ID in name
- Tests named `regression: <description> (#INC-1234)` are unmistakable

### 10. Tautological tests (positive without paired negative)

**Pattern:** AI writes a test that asserts a condition the SUT cannot violate — `expect(x).toBeDefined()` on a non-null typed value, mocks asserted on without behavioral implications, identity comparisons that hold trivially.

**Why:** AI optimizes for green output, not for fault detection. A test that cannot fail is decoration.

**Caught by:**

- Paired negative tests: every positive case has an explicit paired negative that proves the assertion fails on the bad input. If both pass, the assertion is mute about regressions.
- Mutation testing on the SUT (Stryker / PIT) — surviving mutants reveal which positive tests don't actually constrain the code.
- AST meta-test: assertion's compared value must transitively depend on a SUT call, not just literals/types.

### 10. React/Next-specific violations

- `<div onClick>` instead of `<button>` → `jsx-a11y/no-static-element-interactions: 'error'`
- `<a href="/internal">` instead of `<Link>` → `@next/next/no-html-link-for-pages: 'error'`
- `<img>` instead of `<Image>` → `@next/next/no-img-element: 'error'`
- `useEffect(() => fetch(...))` for data-fetching → use Server Components or React Query
- `'use client'` in file with no interactivity → review-sidecar manual check
- `useEffect(() => fetch(props.id), [])` (missing deps) → `react-hooks/exhaustive-deps: 'error'`
- `{count && <X/>}` (renders "0" if count=0) → `react/jsx-no-leaked-render: 'error'`

### 11. Tautological tests in React

- `expect(component).toBeInTheDocument()` after render with no other check
- `expect(button).toBeEnabled()` for a static button
- `fireEvent.click(...)` instead of `userEvent.click(...)` (different semantics)
- `screen.getByTestId(...)` when `getByRole(...)` works (testIds become AI shortcuts)

**Caught by:**

- `eslint-plugin-testing-library` strict rules
- `review-sidecar` two-AI review

---

## Defense matrix: layer × AI violation

| Violation              | Layer 1 (Arch)           | Layer 2 (Meta) | Layer 3 (Spec)          | Layer 4 (Mutation) | Layer 5 (Docs)       | AIF Sub-agent      |
| ---------------------- | ------------------------ | -------------- | ----------------------- | ------------------ | -------------------- | ------------------ |
| `as any`               | ESLint                   | —              | —                       | —                  | —                    | best-practices     |
| Lodash import          | ESLint                   | —              | —                       | —                  | —                    | best-practices     |
| Tautological test      | —                        | AST scan       | —                       | **Stryker**        | —                    | **review-sidecar** |
| Layer violation        | dep-cruiser              | —              | —                       | —                  | —                    | best-practices     |
| Floating promise       | ESLint                   | —              | —                       | —                  | —                    | best-practices     |
| Forbidden runtime      | ESLint                   | —              | —                       | —                  | —                    | best-practices     |
| Public API inflation   | dep-cruiser              | —              | —                       | —                  | API snapshot         | best-practices     |
| Bug reintroduced       | —                        | —              | regression test density | Stryker            | test name discipline | review-sidecar     |
| React hooks deps       | ESLint                   | —              | —                       | —                  | —                    | best-practices     |
| `'use client'` mistake | ESLint + server-only pkg | —              | —                       | —                  | —                    | review-sidecar     |

---

## The two strongest AI-specific defenses

If only two things can be added to a project to harden it against AI-driven code:

### 1. Mutation testing (Layer 4) on PR diff

This catches tautological tests, always-green assertions, and shallow coverage that the AI's implementation and tests share. Setup:

- Stryker incremental mode
- Threshold: 70% kill rate on changed lines
- PR-blocking when below
- Surfaced in PR comment

### 2. Two-AI review (AIF `review-sidecar`)

A different AI in a different context reviews the tests _without_ seeing how they were written. Catches the tautologies that look natural to the writer.

Configure in `.claude/agents/review-sidecar.md`:

```markdown
You are reviewing as if you have NEVER seen this code.
You did NOT write it. Be skeptical.

Check for:

- Tautological tests (assertions always true given types or testing implementation)
- Mock-only tests (verifying mocks called without behavioral assertion)
- Missing edge cases (boundary, null, error paths)
- Test names that don't describe behavior

Severity: BLOCKER | MAJOR | MINOR.
You report. You don't fix.
```

These two together raise the bar from "AI can fool the test suite" to "AI must satisfy both a structural validator and an independent reviewer".

---

## Higher coverage thresholds for AI-modified code

ContextQA (2026 guidance) recommends:

- Human-written code: 70-80% line coverage typical
- AI-written code: 85-90% line coverage minimum

The reason isn't that AI tests are _worse_ per line — it's that AI tests are _shallower_ per line, so more lines are needed for equivalent confidence. Stryker mutation kill rate is the better metric, but if you must use coverage, raise the threshold for AI-touched files.

---

## What `CLAUDE.md` should contain (and not contain)

`CLAUDE.md` (or `AGENTS.md`) is read by Claude Code on every session. It should:

✅ **Reference enforced rules**, not duplicate them. Point to `.ai-factory/RULES.md` and the test/lint commands that enforce each rule.

✅ **State the executable contracts**: "Inputs validated by Zod at boundaries. Run `npm run validate` before committing."

✅ **Mention the enforced gate, then optional tooling**: "Run `npm run validate` (or `./scripts/audit-ai-docs.sh`) before committing — the pre-push hook + CI enforce it. If you use AI Factory: `/aif-plan` for features; `/aif-verify` wraps that gate."

❌ **Do not** rely on it for soft conventions ("prefer composition over inheritance"). Soft conventions become "we used to follow this" within a quarter of AI-driven development.

❌ **Do not** put extensive style guides — push to ESLint/Prettier, not text.

❌ **Do not** create new rules in `CLAUDE.md` that aren't enforced elsewhere. Either make it enforceable or delete it.

The mantra: **`CLAUDE.md` saves AI tokens by stating known-true facts; tests save AI from being wrong.** Different jobs.

---

## A sample `CLAUDE.md` that does this right

```markdown
# Project context for Claude Code

This project uses AI Factory for spec-driven development.

Before any non-trivial change:

1. Read `.ai-factory/DESCRIPTION.md` — what we're building.
2. Read `.ai-factory/ARCHITECTURE.md` — layer rules and dependency direction.
3. Read `.ai-factory/RULES.md` — code rules R1–R20 (enforced).

Before committing: run `npm run validate` — the pre-push hook + CI enforce the gate.

If you use AI Factory (optional, not bundled):

- `/aif-plan <task>` for new features.
- `/aif-fix <error>` for bugs.
- `/aif-verify` wraps the gate above (sub-agents over RULES.md).

Stack constraints (enforced by lint/test/CI):

- TypeScript strict + noUncheckedIndexedAccess.
- All external inputs through Zod (HTTP body, env, queues, DB).
- Domain layer imports stdlib + Zod only.
- No `as any`, no `!`, no `enum`, no `Date.now()` in src/.
- Mutation kill rate ≥70% on PR diff.

If you need to bypass a rule — discuss via `/aif-rules` first, don't `--no-verify`.
```

That's the entire shape of a good `CLAUDE.md`. Everything else is in `.ai-factory/` files and enforced.

---

## Lessons learned — applied wisdom from real projects

Things that broke in real projects and the rules that came from them. Add to this list as your team accumulates its own.

### 1. Dual-remote projects — `.claude/` in `.gitignore` of work-repo

**Symptom:** AGENTS.md references skill X. `.claude/skills/X/` is empty. Looks like classic doc drift.

**Root cause:** project pushes to two remotes (personal + work). Work-repo's `.gitignore` excludes `.claude/`. After `git checkout` to a branch from work-repo, the files vanish from working tree.

**Lesson:** when investigating drift in dual-remote projects, **first thing** — `git log --all`. Don't trust working tree alone.

```bash
# Confirm the file existed in any branch:
git log --all --oneline -- '.claude/skills/' | head -5
git ls-tree -r develop --name-only | grep '^\.claude/'

# Restore from another branch:
git show develop:.claude/skills/<name>/SKILL.md > .claude/skills/<name>/SKILL.md
```

**Rule that came from it:** `.claude/` directory must be tracked in primary remote. If using work-repo with `.gitignore` excluding it, mirror to a separate AI-config repo.

### 2. Skills declared early, never created

**Symptom:** AGENTS.md says "use skill X for Y task". Two months later skill X doesn't exist.

**Root cause:** AI agent (or human) added a reference to a skill they planned to create. Then the priority shifted.

**Lesson:** **don't reference a skill until its file is committed**. AGENTS.md is not a roadmap — it's a contract.

**Rule that came from it:** drift-detection script `audit-ai-docs.sh` checks every `skill X` reference in AGENTS.md against actual `.claude/skills/X/` existence. PR fails if skill is named but doesn't exist.

### 3. `_comment_TODO` in JSON outlives everything

**Symptom:** `.mcp.json` contains `"_comment_TODO_remove_when_X"` keys. They survived 30+ commits because JSON-comments are invisible in `git diff` UI when they're nested in arrays.

**Lesson:** **TODO never goes into JSON.** Use issue tracker, ADR, or markdown. JSON is for executable config, not memos.

**Rule that came from it:** drift-detection grep step:

```bash
grep -E '_comment|TODO|FIXME' .mcp.json .claude/settings.json && exit 1 || echo "OK"
```

### 4. Stale orchestrator-prompts pile up indefinitely

**Symptom:** `.claude/orchestrator-prompts/` has 40+ markdown files from multiple sprints, no archive structure.

**Lesson:** orchestrator-prompts are **not source of truth** — they're working artifacts. Move to `archive/` subdirectory after task is done. Files older than 14 days outside `archive/` should fail audit.

```bash
find .claude/orchestrator-prompts -maxdepth 2 -mtime +14 -not -path "*/archive/*" -name "*.md"
```

### 5. AGENTS.md tables drift faster than the body

**Symptom:** body of AGENTS.md is updated when conventions change. The "skills available" table at the top — never. Half the rows reference deleted skills.

**Lesson:** **don't have a skills table in AGENTS.md unless you're committed to maintaining it**. If you have one, generate it from filesystem in a pre-commit hook. Hand-maintained tables in AGENTS.md are technical debt.

Better pattern: skills are activated by their `description:` triggers in `.claude/skills/*/SKILL.md`. AGENTS.md lists only the few skills that need explicit awareness ("you have a `skill X` for ...").

### 6. AI agent silently demotes "MUST" to "should"

**Symptom:** AGENTS.md says "MUST validate via Zod". After 3 sessions, AI starts writing handlers without Zod, doesn't apologize, doesn't flag.

**Lesson:** AI's compliance with hard rules degrades over context length. Don't trust prose-only enforcement. Every "MUST" needs a corresponding ESLint rule or audit probe — see Layer 1 + `audit-ai-docs.sh`.

### 7. Trigger overlap between two skills

**Symptom:** two skills both have trigger keyword "tests". When user says "write tests", AI loads both, contexts collide, nothing works well.

**Lesson:** **trigger keywords are a name space** — manage them like usernames. Periodic audit:

```bash
for f in .claude/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  grep "^triggers:" "$f" | sed "s/triggers: //; s/, /\n/g" | sed "s/^/$name: /"
done | sort -k2 -t: | awk -F': ' '{print $2 "\t" $1}' | sort | uniq -c -f0 | awk '$1>1'
```

Conflicting trigger → designate one skill as owner, remove from others, replace with more specific keyword.

### 8. Rules without measurable check decay

**Symptom:** rule "code must be readable" in AGENTS.md. Six months later, no one knows what "readable" means in this project, and nobody can prove the rule is being followed or violated.

**Lesson:** **every rule has a measurable check, or it doesn't exist**. If you can't write a probe (ESLint, awk, dependency-cruiser, mutation, contract test) — it's a wish, not a rule. Either implement the check or delete the rule.

This is the foundational principle of the entire Rules-as-Tests framework. AI documentation is no exception.

---

## How to grow this list in your own project

When something breaks in a way that wasn't predicted:

1. **Describe the symptom** in 1 sentence (what you observed).
2. **Find root cause** — not "AI did X" but the structural reason it could happen.
3. **Lesson** — what you'll do differently.
4. **Rule** — the executable check that would have caught this. Add to `audit-ai-docs.sh` or AGENTS.md or ESLint config.

If step 4 produces nothing — the lesson is still worth recording, but you have only an informal warning. If you can't formalize it, it'll fade.
