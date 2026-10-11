---
name: rule-tests
description: 'Use when a consumer has an EXISTING generated rule whose firing test material is missing, broken, or needs a bypass variant. Triggers: rule tests, repair test material, fix negative-test, rule test material, verify the rule fires, rule-tests, починить тест правила, исправить негативный тест, проверить что правило срабатывает, тестовый материал для правила. NOT for creating new rules (/rule-research).'
---

<!-- @harness-posture: portable — prose repair methodology for existing rule test material; no harness primitives -->

<!-- @dual-pair: rule-tests-protocol -->
<!-- spec: agents/rule-test-author.md -->

# rule-tests

> **Authoritative for:** the Claude Code trigger for the rule-tests write/repair protocol — a thin wrapper; the canonical, AI-agnostic protocol (write/repair flow, single-rule isolation, per-lane honesty map, staleness-consent script) lives in the resolved rule-test-author protocol.
> **NOT authoritative for:** project goal — see README.md#why-this-exists; the protocol itself and every per-lane / stack-specific fact — see `agents/rule-test-author.md`; rule CREATION — see `agents/rule-researcher.md` / `/rule-research`.

This skill is a thin entry point. The full protocol — read the delivered rule artifact → write or repair its firing test material → run your lane's deterministic verification in single-rule isolation → quote the tool verdict verbatim — is `agents/rule-test-author.md`. Resolve it below before work; this wrapper exists only so the protocol is reachable by a Claude Code trigger without duplicating its logic (single source of truth, per `dual-implementation-discipline.md §7`). It repairs test material for an EXISTING rule; it never creates a rule (that is `/rule-research`) and never edits the rule artifact itself.

## Resolve the protocol before work

From the project root, read `agents/rule-test-author.md` in a framework checkout, or `.claude/agents/rule-test-author.md` in an installed consumer. Follow the resolved protocol as the single source of truth; runtime paths remain relative to the project root. If neither exists, stop and report the missing getff installer-delivered agent prerequisite. A plugin-only installation does not supply this protocol; do not invent it or substitute an empty successful run.

## Run-moment reading obligations {#rule-tests-run}

Before repairing, read the authoritative surface for the root you are in:

- **Consumer root:** the delivered dossier for the rule under repair, plus the shipped honesty surface (per-lane verify coverage, the single-rule-isolation rule, the staleness-consent script) in the resolved rule-test-author protocol.
- **Framework root:** additionally the per-backend `packages/core/backends/*/capability-matrix.json` files — they are NOT delivered to consumers, so this obligation is framework-root only (a consumer-facing read obligation on them would ship a non-executable instruction).

Then follow the resolved protocol's numbered steps against the current project, verify in single-rule isolation, and quote the tool verdict — never claim a repair verified without the isolation run.

REFERENCE ([harmonization spec D-H2 transfer (b)](../../../docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md)): when judging whether repaired material genuinely exercises the rule, consult mattpocock `tdd`'s tautological-test anti-pattern — a test that cannot fail proves nothing. Consult-only; the TDD loop itself is owned by `superpowers:test-driven-development`.

## Without this skill

An agent hand-repairs a generated rule's test material ad-hoc, or «fixes» a red test by editing the rule artifact itself — inverting the drift/hash gate the rule is protected by — and claims the repair «verified» from a shared config where aliased diagnostic codes make a non-isolated green meaningless. Broken material then fails at no channel.

## With this skill

The agent follows the resolved rule-test-author protocol: it edits test material only (never the rule), fires the rule-under-repair in single-rule isolation so the verdict is unambiguous, and quotes the tool's own output. The staleness-consent script offers regeneration only on an explicit yes, reading the existing freshness ledgers with their honest limits stated at offer time.

<!-- getff:common-invocation-binding -->
## Common invocation binding

Preserve the complete supplied arguments and operator request. Before resolving a
relative command, input or resource, bind the nearest ancestor of the current cwd
that contains `.agents/procedures/rule-tests/SKILL.md`; do not substitute an enclosing
Git root or the framework source checkout. Keep absolute supplied input paths unchanged.
Resolve project-relative inputs against that bound project and procedure-relative
resources against its canonical procedure directory. If no such ancestor exists,
STOP with the missing installed-project prerequisite before executing a helper.
For a shell helper, change to that bound project first and quote every path and
argument separately; keep its exit status and diagnostics. Discovery does not grant
permissions, hook trust, global configuration changes or external messaging.
When explaining an idea, design or workflow with meaningful relationships, use a
small Mermaid diagram plus equivalent readable text in an existing permitted output
section. Preserve strict report grammars and closing anchors. Show only supplied or
verified relationships, label uncertainty, and do not depict an unobserved execution
or authorization as completed. Skip diagrams when they add no explanatory value.
<!-- /getff:common-invocation-binding -->
