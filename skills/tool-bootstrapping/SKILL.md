---
name: tool-bootstrapping
description: Use when analysing project stack for MCP or skill recommendations. Triggers: tool bootstrapping, MCP installation, skill discovery, project onboarding tools, package.json deps changed, .ai-factory/tool-decisions.md, AIF /aif, tool detection, инструменты, бутстраппинг, MCP серверы, скиллы, зависимости, онбординг, подбор инструментов, предложение инструментов, подтверждение установки, tool proposal confirmation, incremental tool re-evaluation, rejected tools memory, memory persistence for tools.
---

# Tool Bootstrapping — project-aware MCP/skill proposal discipline

> **Authoritative for:** §13.25 tool-bootstrapping discipline (6 rules) for consumer projects that install this skill via `install.sh`. Consumer-facing shipped version; project-internal cross-links omitted.
> **NOT authoritative for:** authoring-repo goal — see authoring repo `README.md#why-this-exists`. Project-internal version with repo-specific cross-links — see `.claude/skills/tool-bootstrapping/SKILL.md` after install.

## When this skill is relevant

In your project, after running `install.sh`, this skill auto-triggers when:

- Starting work on a new project for the first time (onboarding moment)
- User asks which MCPs or skills to install
- `package.json` dependencies change since last tool-bootstrap
- `.ai-factory/tool-decisions.md` is missing or stale
- User invokes AIF `/aif` and wants structured decisions persisted

## The 6 rules

### Rule 1 — Analyse stack

Read `package.json`, `.mcp.json`, and framework config files to enumerate explicit deps, external services, and existing MCP config. Delegate to AIF `/aif` for stack detection — AIF detects language/framework/database and maps to matching skills and MCP servers via the `skills.sh` registry.

### Rule 2 — Propose tool set

Based on detected stack, surface relevant MCPs and skills using AIF `skills.sh` vocabulary: `npx skills search` → `install --agent claude` → security-scan → generate-if-missing → learn-from-docs. Cap proposals at ≤5 per block; each must carry a load-bearing rationale (which specific dep or service requires this tool?). Prefer `context7` for documentation lookup over library-specific MCPs — one meta-MCP subsumes many.

### Rule 3 — Confirm bulk

Show the full proposed list in one block with per-item rationale, single Y/n confirmation (matching AIF `/aif` baseline). **Hard rule: never install any MCP or skill without explicit user confirmation. No env/config bypass.**

### Rule 4 — Token-economy gate

Two-question filter: (a) is the capability codifiable as a skill? if yes → propose skill, not MCP; (b) does loading this MCP at all sessions cost more tokens than usage frequency saves? if negative → drop from proposal. Reuse AIF `/aif` heuristic for classification.

### Rule 5 — Incrementality

At each session start, a UserPromptSubmit hook (configured in `.claude/settings.json` after Wave 5.3 install) compares `sha256(package.json deps section)` with the `deps-hash:` field in `.ai-factory/tool-decisions.md`. Mismatch → inject one-line WARN: `⚠ package.json deps changed since last tool-bootstrap — run /tool-bootstrapping to re-evaluate`.

### Rule 6 — Persistence

Accepted and rejected decisions are recorded in `.ai-factory/tool-decisions.md` (committed, team-shared). Schema → see [references/decision-format.md](references/decision-format.md). Never re-propose a rejected tool unless the rejection entry carries an explicit re-evaluation trigger that has since fired. A starter template is provided in [templates/tool-decisions.md.template](templates/tool-decisions.md.template).

## §2 Build-vs-reuse note

Rules 1-4 reuse AIF `/aif` (already an integrated dependency if you installed this framework via `install.sh`). Rules 5-6 are thin additions: the `deps-hash` hook and the `.ai-factory/tool-decisions.md` persistence file. You do not need to rebuild AIF's stack-detection or proposal logic.

## §3 context7 — strongly recommended, not auto-installed

`context7` MCP is the preferred documentation-lookup tool for rule 2 (researching available MCPs). The installer does **not** install or guarantee it — there is no hard dependency (consumers may be on any OS / harness / license; see build-first-reuse-default discipline). Instead the bootstrap **insists on it**: rule 2 surfaces `context7` as its first recommended MCP with a load-bearing rationale, and the loop **degrades gracefully** when it is absent — fall back to `WebSearch` / DeepWiki for the doc-research step while continuing to recommend installing `context7`. There is no bootstrap paradox: the recommendation is data the loop emits, not a runtime precondition it requires.

## §4 §13.18 cascade note

If AIF deep-alignment closes negative in a future phase of the authoring framework, rules 1-4 reuse-via-thin-wrapper may need re-implementation. The thin-wrapper design limits coupling; full rewrite cost is bounded by the [references/decision-format.md](references/decision-format.md) schema stability. Consumer projects are unaffected unless the authoring framework ships a breaking update.

## See also

- [references/decision-format.md](references/decision-format.md) — `.ai-factory/tool-decisions.md` schema
- [templates/tool-decisions.md.template](templates/tool-decisions.md.template) — starter template to copy to your project
