---
paths:
  - "this/path/does/not/exist/anywhere/**"
---
<!-- globs: this/path/does/not/exist/anywhere/** -->

# N31-5 fixture — dead glob

> **Class:** C — fixture, not a real rule.
> **Fires:** never — this is a principle-31 test fixture.
> **Authoritative for:** nothing; test data only.

Both `paths:` and `<!-- globs: -->` agree on the same pattern (set-equality holds), but the
pattern matches NO tracked file in the repo — it is a dead glob. The liveness check must flag
this (N31-5), and there is no `<!-- glob-liveness: allow ... -->` escape hatch present.
