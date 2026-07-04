---
paths:
  - ".claude/rules/**"
---
<!-- globs: packages/core/principles/** -->

# N31-4 fixture — paths != globs

> **Class:** C — fixture, not a real rule.
> **Fires:** never — this is a principle-31 test fixture.
> **Authoritative for:** nothing; test data only.

This rule's `paths:` frontmatter set (`.claude/rules/**`) does not match its
`<!-- globs: -->` marker set (`packages/core/principles/**`) — the two glob sets must be
identical per rule-enforcement-channel-selection.md §4's dual-pair invariant. The glob-parity
check must flag this mismatch (N31-4). Both individual patterns are otherwise live (they match
tracked files), so this fixture isolates the set-equality failure from the liveness failure.
