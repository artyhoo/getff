# N31-1 fixture — a rule with nothing

> **Class:** C — fixture, not a real rule.
> **Fires:** never — this is a principle-31 test fixture.
> **Authoritative for:** nothing; test data only.

This rule carries no `paths:` frontmatter, no `<!-- globs: -->` marker, no
`<!-- channel: ... -->` marker, and is not a member of ALWAYS_ON_CORE. Every branch of the
4-branch PASS predicate must fail for this fixture — that is the point (N31-1).
