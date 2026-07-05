# Positive fixture — exception with a live artifact + anchor

<!-- channel: skill-embed .claude/skills/harvest/SKILL.md#egress -->

> **Class:** C — fixture, not a real rule.
> **Fires:** never — this is a principle-31 test fixture.
> **Authoritative for:** nothing; test data only.

This rule carries a `<!-- channel: ... -->` marker whose artifact-path
(`.claude/skills/harvest/SKILL.md`) exists in the repo and whose anchor (`egress`) is actually
found inside that file (the real rule `egress-no-api-bypass.md` uses the identical marker).
Branch (d) of the PASS predicate must hold for this fixture — the positive control proving the
check discriminates live from dangling exceptions (paired with N31-3).
