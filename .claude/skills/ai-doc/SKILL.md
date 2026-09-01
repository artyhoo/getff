---
name: ai-doc
description: Use when creating or fixing an AI-facing doc/rule/skill/agent in this repo (SKILL.md, .claude/rules/*, agents/*, CLAUDE.md, AGENTS.md) — to apply the project's context-hygiene + rule-as-test + AI-agnostic authoring standard. Triggers: write a rule, author a skill, fix a doc, doc-authority header, progressive disclosure, channel selection, документация, правило, скилл.
---

<!-- @harness-posture: portable — prose-only authoring standard; no harness primitives; the AI-agnostic marker convention it mandates is itself portable (SKILL.md:25) -->

> **Authoritative for:** /ai-doc skill — AI-doc authoring standard for this repo; channel selection, doc-authority header, rule-as-test, and AI-agnostic authoring residue not covered by upstream (loaded from [anthropic-and-aif-residue.md](anthropic-and-aif-residue.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Upstream authoring mechanics — see `superpowers:writing-skills`. Doc-authority header spec — see [.claude/rules/doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md).

# ai-doc — AI-doc authoring standard (thin wrapper)

## Overview

Composes existing skills; does NOT reinvent. For the authoring mechanics invoke
`superpowers:writing-skills` (TDD-for-docs + bundled Anthropic best-practices + progressive
disclosure). This wrapper adds only the residue upstream lacks → see
[anthropic-and-aif-residue.md](anthropic-and-aif-residue.md) (loaded on demand).
Ownership ([harmonization spec §3](../../../docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md)):
this skill owns the repo STANDARD, `superpowers:writing-skills` owns the authoring PROCESS;
mattpocock `writing-for-agents` is REFERENCE — consulted, never routed-to.

## The standard (judgment calls; mechanics are upstream)

- **Channel by `rule-enforcement-channel-selection.md` §1–§4**: detectability → gate vs injection; relevance → narrowest reliable trigger. Reserve always-on for the 3–4 invariants.
- **Rule = test = code at the earliest channel** (zero standing context); prose lives on-demand/path-scoped. Both hold at once (spec §Reconciliation).
- **AI-agnostic**: portable `<!-- globs: -->` marker + AIF template-vars; degrade without the harness.
- **Doc-authority header** per `doc-authority-hierarchy.md` §3 on any canonical doc.

## Without this skill

An agent authoring a new rule or skill defaults to front-loading all prose as always-on context — the path of least resistance. It picks «put it in CLAUDE.md» or adds a standalone always-on rule file, bloating the baseline without checking whether a script gate or path-scoped injection would serve the rule better. It does not consult `rule-enforcement-channel-selection.md`, does not verify channel activation with a live probe, and does not add a doc-authority header. The rule may be mechanically enforceable but ends up as prose-only, silently bypassed.

## With this skill

The agent follows the channel-selection two-axis decision procedure first: detectability → gate vs injection; relevance → narrowest reliable trigger. If a script gate catches the bypass, the prose is kept on-demand or path-scoped (not always-on). If the rule is pure behavioural discipline needing to shape reasoning in the moment, the agent routes it to a compressed digest + path/event-scoped injection rather than a standalone always-on wall. Every verdict cites a probe command or a 6-item negative-existence check — no prose-only findings. The delivered artefact carries a doc-authority header and a paired-negative block where required.
