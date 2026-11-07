---
name: ai-doc
description: "Use when creating or fixing an AI-facing doc/rule/skill/agent in this repo (SKILL.md, .claude/rules/*, agents/*, CLAUDE.md, AGENTS.md) — to apply the project's context-hygiene + rule-as-test + AI-agnostic authoring standard. Triggers: write a rule, author a skill, fix a doc, doc-authority header, progressive disclosure, channel selection, документация, правило, скилл."
---

<!-- @harness-posture: portable — prose-only authoring standard; no harness primitives; the AI-agnostic marker convention it mandates is itself portable (SKILL.md:27) -->

> **Authoritative for:** /ai-doc skill — AI-doc authoring standard for this repo; channel selection, doc-authority header, rule-as-test, and AI-agnostic authoring residue not covered by upstream (loaded from [anthropic-and-aif-residue.md](anthropic-and-aif-residue.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](https://github.com/artyhoo/getff/blob/main/README.md#why-this-exists). Upstream authoring mechanics — see `superpowers:writing-skills`. Doc-authority header spec — see [.claude/rules/doc-authority-hierarchy.md](https://github.com/artyhoo/getff/blob/main/.claude/rules/doc-authority-hierarchy.md).

# ai-doc — AI-doc authoring standard (thin wrapper)

## Overview

Composes existing skills; does NOT reinvent. For the authoring mechanics invoke
`superpowers:writing-skills` (TDD-for-docs + bundled Anthropic best-practices + progressive
disclosure). This wrapper adds only the residue upstream lacks → see
[anthropic-and-aif-residue.md](anthropic-and-aif-residue.md) (loaded on demand).
Ownership ([harmonization spec §3](https://github.com/artyhoo/getff/blob/main/docs/superpowers/specs/2026-08-18-skill-stack-harmonization-design.md)):
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

<!-- getff:common-invocation-binding -->
## Native plugin invocation binding

Preserve the complete supplied arguments and operator request. Execute this native
plugin binding before resolving resources. Native Skill supplies CLAUDE_SKILL_DIR;
use the actual plugin directory even when a universal installation also exists.
Keep supplied relative inputs invocation-cwd-relative and absolute paths unchanged.

<!-- plugin-native:bind -->
```bash
getff_invocation_cwd="${getff_invocation_cwd:-$PWD}"
[ "${getff_arguments+x}" = x ] || getff_arguments=("$@")
GETFF_SKILL_DIR="${CLAUDE_SKILL_DIR}"
[ -n "$GETFF_SKILL_DIR" ] && [ -f "$GETFF_SKILL_DIR/SKILL.md" ] || {
  printf '%s\n' 'STOP: missing native plugin skill/resource root (CLAUDE_SKILL_DIR)' >&2
  exit 2
}
_getff_require_resource() {
  [ -f "$GETFF_SKILL_DIR/\$1" ] || {
    printf 'STOP: missing plugin resource: %s\n' "$GETFF_SKILL_DIR/\$1" >&2
    return 2
  }
}
GETFF_PROJECT_ROOT="$getff_invocation_cwd"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/ai-doc/SKILL.md" ] && [ "$GETFF_PROJECT_ROOT" != / ]; do
  GETFF_PROJECT_ROOT="$(dirname "$GETFF_PROJECT_ROOT")"
done
if [ "$GETFF_PROJECT_ROOT" = / ]; then
  GETFF_PROJECT_ROOT="${CLAUDE_PROJECT_DIR}"
  GETFF_PROJECT_ROOT="$(cd "$GETFF_PROJECT_ROOT" 2>/dev/null && pwd -P)" || { printf '%s\n' 'STOP: missing native plugin project directory' >&2; exit 2; }
  [ -d "$GETFF_PROJECT_ROOT" ] || { printf '%s\n' 'STOP: missing native plugin project directory' >&2; exit 2; }
  getff_containment_cwd="$(cd "$getff_invocation_cwd" && pwd -P)" || exit 2
  case "$getff_containment_cwd/" in
    "$GETFF_PROJECT_ROOT/"*) ;;
    *) printf '%s\n' 'STOP: native plugin project directory does not contain invocation cwd' >&2; exit 2 ;;
  esac
fi
```

Do not change cwd before resolving supplied arguments against getff_invocation_cwd.
Use GETFF_PROJECT_ROOT for project checks and GETFF_SKILL_DIR for skill resources.
Before reading or executing each mandatory resource, run _getff_require_resource
with its skill-relative path; STOP on its diagnostic and nonzero status. Quote every
path and argument separately and preserve helper exits. Missing companions or
framework-only executables remain explicit prerequisites; plugin discovery grants
no permissions, hook trust, global configuration changes or external messaging.
When explaining an idea, design or workflow with meaningful relationships, use a
small Mermaid diagram plus equivalent readable text in an existing permitted output
section. Preserve strict report grammars and closing anchors. Show only supplied or
verified relationships, label uncertainty, and do not depict an unobserved execution
or authorization as completed. Skip diagrams when they add no explanatory value.
<!-- /getff:common-invocation-binding -->
