# AI traps

Anti-patterns that the 5-layer framework MUST prevent:

- Using grep where AST > grep is required → MUST switch to TSESTree.
- Skipping paired negative tests → MUST be added before merge.
- Disabling mutation testing → MUST stay green.
- Bypassing two-AI review (review-sidecar) → MUST run.
