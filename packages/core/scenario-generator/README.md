# scenario-generator

> **Authoritative for:** the `packages/core/scenario-generator/` module — its purpose, usage, cost model, isolation mechanism, and files. Consumer: the `manual-rule-liveness-prober`.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The isolation mechanism detail + contamination proof — see [isolation.md](./isolation.md).

## What this is

The `scenario-generator` module is the **deterministic, CI-testable half** of the pressure-scenario auto-generator. It provides:

1. **Types** (`types.ts`) — `PressureType`, `GeneratedScenario`, `GeneratedScenariosFile` matching the manifest schema exactly.
2. **Static reject-gate** (`static-gate.ts`) — pure functions checking W1/W3/W4/W5 weak-trap anti-patterns with zero LLM calls.
3. **Scenario store** (`store.ts`) — read/merge/write `.ai-factory/generated-scenarios.json` with a §6.3 NON-NEGOTIABLE storage-boundary guard (refuses to persist unvalidated scenarios).
4. **CLI** (`cli.ts`) — `gate`, `gate-text`, `write`, `extract-keywords` subcommands for use by the skill.
5. **Isolation mechanism** (`dispatch-baseline.ts`, `isolation.md`) — spawns `claude -p` from a temp dir outside the repo to prevent ambient rule contamination (W2 anti-pattern).

The LLM-bound parts (G1-G5 scenario design, Pass-1 RED dispatch, Pass-2 GREEN dispatch) live in a **session-bound orchestration step**, NOT here — this module intentionally stops at the deterministic/CI-testable boundary. This keeps all paid LLM calls off CI per [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md).

## Cost model

> **Generating scenarios for N rules ≈ ≥2N session-bound LLM dispatches.**

Each scenario requires at minimum:

- 1× Pass-1 RED dispatch (baseline without rule, from `/tmp`)
- 1× Pass-2 GREEN dispatch (same baseline + rule policy, from `/tmp`)

Additional dispatches may be needed if Pass-1 BASELINE-DIDN'T-FAIL (up to 3 attempts per scenario). No batching in the pilot — batching risks W2 cross-contamination per R-phase §5.6.

All dispatches are session-bound (operator's own CC subscription). **Zero CI cost.**

## Isolation requirement (make-or-break)

The RED (baseline) dispatch MUST run from a directory OUTSIDE the repo tree so `claude`'s upward CLAUDE.md / `.claude/rules/` discovery finds nothing. Within-session agents (Agent tool) inherit ambient project rules, contaminating the baseline.

**Mechanism:** `claude -p "<baseline-prompt>"` spawned from `mktemp -d /tmp/psg-XXXXXX`.

**Contamination proof (T-PSG-A):** Running the baseline for `no-paid-llm-in-ci` from `/tmp` produced a full GitHub Actions workflow with `ANTHROPIC_API_KEY` in CI — proving the rule was NOT loaded. See [isolation.md §3](./isolation.md) for the verbatim output.

## Files

| File                   | Purpose                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `types.ts`             | Type definitions (PressureType, GeneratedScenario, GeneratedScenariosFile) |
| `static-gate.ts`       | W1/W3/W4/W5 deterministic checks — zero LLM, CI-safe                       |
| `store.ts`             | Read/merge/write `.ai-factory/generated-scenarios.json`                    |
| `cli.ts`               | CLI shim for skill shell-outs                                              |
| `dispatch-baseline.ts` | Isolated subprocess dispatch from /tmp                                     |
| `isolation.md`         | Mechanism documentation + contamination proof                              |
| `proof.md`             | End-to-end RED→GREEN proof transcript (I-phase pilot, 2026-06-16)          |
| `static-gate.test.ts`  | Paired-negative tests for W1/W3/W4/W5                                      |
| `store.test.ts`        | Paired-negative tests for storage-boundary guard                           |

## Using the CLI

```bash
# Static gate check
npx tsx packages/core/scenario-generator/cli.ts gate candidate.json \
  --policy-keywords "keyword1,keyword2"

# Gate with inline policy text (auto-extracts keywords)
npx tsx packages/core/scenario-generator/cli.ts gate-text candidate.json \
  --policy-text "Policy text here..."

# Persist a validated scenario
npx tsx packages/core/scenario-generator/cli.ts write R10 validated-scenario.json

# Extract policy keywords
npx tsx packages/core/scenario-generator/cli.ts extract-keywords "policy text..."
```

## Output: `.ai-factory/generated-scenarios.json`

Generated scenarios are written to the consumer's `.ai-factory/generated-scenarios.json`:

```json
{
  "version": 1,
  "scenarios": {
    "R10": {
      "baseline-prompt": "...",
      "observable-failure": "...",
      "observable-compliance": "...",
      "pressure": ["sunk-cost", "authority"],
      "validated": true,
      "verdict": "LIVE",
      "meta": { "generatedAt": "...", "sourceRuleId": "R10", ... }
    }
  }
}
```

The `manual-rule-liveness-prober` reads this file first (before the manifest) when looking up a rule's pressure-scenario.

## Prior-art

This module is covered by SSOT #115 in `docs/meta-factory/prior-art-evaluations.md` — verdict `ADAPT+generative` (updated 2026-06-16 when this generator shipped). The capability commit carries `Prior-art: prior-art-evaluations.md#115 (verdict ADAPT+generative — generator now ships, flipping from ADAPT)`.

See also: [isolation.md](./isolation.md) and [proof.md](./proof.md) for the full orchestration procedure and end-to-end proof.
