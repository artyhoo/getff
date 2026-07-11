# AI traps (with-drift fixture)

Five-layer framework anti-patterns:

- Using grep where AST is required (MUST switch).
- Skipping paired negative tests is forbidden — MUST add.

The other principles are intentionally elided in this fixture so the drift
detector surfaces term-presence mismatches; do not add them here.
