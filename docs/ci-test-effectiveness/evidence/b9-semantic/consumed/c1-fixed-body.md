## Fidelity verdict
FIDELITY: GO
Basis: controlled-corpus
Round: 1
Audited-SHA: f82d2209b1b8344908102403610bd20233349b3d
Evidence: .github/workflows/checks.yml:1

## Test-Quality Review
```protection-review
{
  "version": 1,
  "base": "f053bc8db6c4ec640d9f01bef3997c04adc91cf4",
  "head": "f82d2209b1b8344908102403610bd20233349b3d",
  "scope": [
    ".github/workflows/checks.yml"
  ],
  "reviewer": "native_b9_semantics",
  "report": "/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/phase1/c1-review.md#sha256=eb0053441e583f29a185d3c1e84c6f7c6a810e40f9c4f1681324c1ad65f379b4; /workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/phase2-fix-review.md#sha256=51f1edba6b5893e103898c4f5e41b36206c75cfab2a00d126ad131ce3f823bb7",
  "consumedBy": "root controller; actual original report read",
  "basis": "Fixed independently frozen synthetic contract and original cold report. Controlled finite transport experiment; GO text below is a negative-control template, not project approval.",
  "history": {
    "status": "unavailable",
    "reason": "Synthetic premise summaries only; no actual project CI traces in fixture.",
    "ownerDecision": "Controller accepts this finite offline transport exercise only; no host or arbitrary semantic certification."
  },
  "findings": [
    {
      "id": "C1-TQ-01",
      "failureScenario": "Npm wrapper repeats the same release-index witness in an equivalent job.",
      "class": "duplication",
      "disposition": "fixed",
      "evidence": [
        "/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/phase1/c1-review.md#sha256=eb0053441e583f29a185d3c1e84c6f7c6a810e40f9c4f1681324c1ad65f379b4",
        "/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/inputs/c1.diff",
        "/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/consumed/c1-actual-fix.diff#sha256=7131acf61333d031d69befa0f5bd4cb660030b72a78b3041555a1ab55373e02b",
        "/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/phase2-fix-review.md#sha256=51f1edba6b5893e103898c4f5e41b36206c75cfab2a00d126ad131ce3f823bb7",
        "actual-private-fixture-head:f82d2209b1b8344908102403610bd20233349b3d"
      ]
    }
  ]
}
```
