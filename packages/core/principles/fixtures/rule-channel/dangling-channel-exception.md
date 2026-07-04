# N31-3 fixture — exception with dangling artifact

<!-- channel: skill-embed .claude/skills/__this-skill-does-not-exist__/SKILL.md#nowhere -->

> **Class:** C — fixture, not a real rule.
> **Fires:** never — this is a principle-31 test fixture.
> **Authoritative for:** nothing; test data only.

This rule carries a `<!-- channel: ... -->` marker, but the artifact-path it names does not
exist in the repo. Branch (d) of the PASS predicate must fail for this fixture — the exception
names an artifact, but the artifact is dangling (N31-3).
