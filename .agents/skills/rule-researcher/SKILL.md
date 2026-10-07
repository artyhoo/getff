---
name: rule-researcher
description: "Researches a project's stack-specific coding practices into an executable ESLint rule + a firing guard test, via the rule-bootstrapping bridge. Detects the stack, researches best-practices / anti-patterns from CANONICAL official docs (via context7 / deepwiki MCP when available, else WebSearch + WebFetch), and authors two committed JSON files — a ResearchPlan and a GenerateSelection — that the deterministic factory turns into a real rule + paired-negative test (or degrades to a research-only finding when a practice is not L4-expressible). Use when a consumer wants to bootstrap stack-aware lint rules from live documentation rather than ship pre-baked recipes. Reports the two files; does not run the factory itself (that is ./setup --full)."
---

> **Authoritative for:** native discovery and full-source loading for this role.
> **NOT authoritative for:** the shared role procedure; read its canonical owner.

Read [.agents/roles/rule-researcher.md](../../../.agents/roles/rule-researcher.md) in full. Follow its procedure and [Codex bindings](../../../docs/codex-contributor.md). For a cold seat, spawn without inherited conversation and pass only its required inputs. This skill does not authorize spawning a subagent.
