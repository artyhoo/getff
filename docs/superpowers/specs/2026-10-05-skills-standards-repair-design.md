# Project skills standards repair — design

> **Status:** IMPLEMENTED — deterministic senior acceptance recorded in the result report; junior delivery pending — packet review recorded in [review receipt](../plans/2026-10-05-skills-standards-packet-review.md).
> **Authoritative for:** the authorized repair scope, thin-card structure and acceptance contract for the project skills audit of 2026-10-05.
> **NOT authoritative for:** project goal — see [README.md](../../../README.md#why-this-exists); a new skill framework, harness migration, global permissions, deployment or release.

## Problem and intended behavior

The [audit](../../audits/2026-10-05.md) found 34 SKILL.md files: 27 production copies representing 20 names, three AIF context overlays and four fixtures. Concrete instructions disagree with their helpers or installed destinations (F1–F5); seven descriptions fail strict YAML (F6); large entrypoints load unrelated detail (F7); bootstrap priority/access is ambiguous (F8). Passing structural checks cannot certify model routing (F9).

After repair, an agent can select the skill from its metadata, perform the common workflow from a concise card and read only the procedure for the current mode. Commands match actual helpers and consumer delivery; unavailable prerequisites are named before the affected action. Required constraints and stopping conditions are available before the action they govern.

## Decision and source basis

The operator requested short cards with detail loaded as needed, confirmed the three-layer structure, authorized fixes, and subsequently revised the role split: after compaction the senior implements, verifies and reviews all substantive repairs here; the junior receives only the accepted result for task-scoped Git delivery. No source repair is included in this checkpoint.

The [Agent Skills specification](https://agentskills.io/specification#progressive-disclosure) recommends below 500 lines and about 5,000 tokens, not a universal 200-line schema limit. [Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices#progressive-disclosure-patterns) describes conditional references. [Superpowers](https://github.com/openai/plugins/blob/main/plugins/superpowers/skills/writing-skills/SKILL.md) uses 200 **words** for frequently loaded skills; a separate marketplace uses 200 **lines** as its optimal target. Source distinctions are recorded in the audit addendum.

Use a concise card, normally **at most 200 body lines**, as the local repair target. This is not a new universal hard gate. Line count cannot substitute for context cost or behavioral evidence; do not compress dense paragraphs merely to satisfy it.

| Layer | Contract |
| --- | --- |
| `name` + `description` | Capability and discriminating selection conditions; preserve actual invocation policy |
| `SKILL.md` | Inputs, result, common actions, required constraints, stopping conditions and conditional resource pointers |
| Resources | Mode procedures, history, examples, helpers and templates read/executed when their condition applies |

The full entrypoint is loaded on activation: moving text lower in the same file does not provide progressive disclosure. Each extracted reference has a direct card link and an explicit condition. Never require all appendices every invocation. A simple standalone skill needs no invented supporting directory.

## Scope and source ownership

Audit baseline: `c4532e16aa369ef3c66e227dd59d8ceef9e60263`. Current local destination is `/Users/art/.codex/worktrees/9d39/rules-as-tests-aif`, detached HEAD at preparation time. Reconcile live state before implementation; preserve unrelated work.

- Repair source entrypoints under `.claude/skills/` and `skills/`.
- Generated plugin membership is `scripts/generate-plugin-skills.sh` ENTRY_TABLE: getff/tool-bootstrapping from `skills/`; ai-doc/rule-research/rule-tests/template-audit from `.claude/skills/`. Repair owners, then regenerate. Do not edit these payloads directly.
- `plugin/skills/using-getff` and `installing-enforcement` are plugin-native. F8 belongs to using-getff.
- `.claude/skills/tool-bootstrapping` and `skills/tool-bootstrapping` are deliberately different scopes, not automatic twins. Do not collapse them.
- Context overlays and fixtures stay outside independent production-skill conformance. Do not normalize intentional invalid fixtures.
- Relevant existing principle tests may change only if relocation changes a real check target. Preserve defect detection and RED/GREEN controls; do not weaken a check to make shortened cards pass.
- No new helper, schema, scheduler, semantic gate, dependency, global permission, invocation flag, profile or model change is required. Pinned upstream vendored reference bodies remain byte-identical.

## Concrete repairs

| ID | Required result and evidence |
| --- | --- |
| F1 | Pipeline describes allowed-tools as pre-approval, not command exclusion. Host permissions govern other tools. Remove the dated global-settings workaround as an unconditional setup requirement; no global edits. |
| F2 | Doctor's default sweep runs passive probes only. verify-bridge creates/deletes a task and can start a coordinator; ensure-parallel persists a setting. Name these active operations, apply the existing authorization/tier contract and exclude them from a read-only sweep. Preserve authorized reversible fixes without new blanket approval rounds. |
| F3 | Dispatcher API egress example uses actual --repo/--base/--branch/--message/--srcdir flags plus paths. Explain host-side inputs, multiple files, replacement of listed paths and preservation of unlisted paths. No false taskId/container-read/single-file/line-merge claims. Retain host-transport discrimination, local sweep and minted-head fidelity ordering. |
| F4 | rule-research/rule-tests resolve the protocol in framework agents/ or consumer .claude/agents/. Plugin-only installation lacks these agents: report the missing installer prerequisite before work. Framework allowlist implementation and template-audit runner are framework-only. Consumer verification uses delivered facilities, with unavailable checks recorded; never fake a portable runner. |
| F5 | getff's React example points to the real preset template in a framework checkout and the delivered config in a consumer, not a nonexistent templates/ path. |
| F6 | Make the seven .claude descriptions strict YAML scalars while retaining their values and invocation metadata. Native CC accepts the old text; this fixes portability, not an observed native load outage. |
| F7 | Split pipeline, dispatcher, aif-doctor and orchestrator; also reduce dense arch and night-mode activation context. Keep direct condition-bearing links and action constraints. Preserve existing helpers, protocols, source delegation, lifecycle owner, paired-negative narratives and downstream output/chip contracts. |
| F8 | using-getff respects binding host/system/tool rules and user/project scope. Skill tool where available, direct file reading where that is the harness mechanism. Unrelated conversation does not require getff activation. File access does not authorize self-initiation of an explicit-only procedure. |
| F9 | Preserve the distinction between structural checks and behavioral evidence. Do not mark model selection or outcome quality proven from line counts, narrative presence or metadata budgets. It may remain OPEN with a bounded follow-up; no paid inference/CI gate added. |

## Thin-card preservation contract

- Preserve frontmatter names, existing invocation flags, supported extensions and model choices unless a verified defect requires a separately justified change. Syntax normalization alone must not rewrite descriptions.
- A common action's mandatory constraint stays in the card. A mode-specific constraint may stay in its procedure only if the card mandates reading it **before** that action. Do not hide the authorization envelope behind an optional history link.
- Cards expose user-scope limits, mutation tiers, missing-dependency outcomes and stop conditions. Keep claim-before-review, real merge gates, cold fidelity, wrong-branch stops, no blind zombie DELETE and unattended authorization floors.
- Read only the selected branch. Incident history and large catalogues are conditional. Keep content owners and section provenance clear; update moved Markdown links, same-file anchors and reference labels. Runtime bare paths remain relative to the actual execution root, not the reference's directory.
- Preserve the pipeline output contract and each distinct chip family. Principle 18 currently pins card-side tokens; principle 39 seeds a real cache-read command in pipeline. Retain these load-bearing clauses or update the test to the new authoritative action surface with the same negative behavior; never satisfy it with a decorative string.
- Preserve observed-versus-inferred model/harness claims. Review confidence is calibrated to recorded checks, not a mandatory high label. Paused-task capacity inconsistency is unresolved: inspect the actual implementation before changing semantics.
- After any new substantive touch to a grandfathered skill, follow principle 15's existing de-grandfathering rule; do not add exemptions. Pinned arch companion references must not be reformatted.

## Acceptance

A1. All 27 production files have valid strict YAML metadata; names/descriptions and invocation settings remain within their host contracts. Overlays/fixtures excluded explicitly.
A2. F1–F6/F8 instructions match actual helper interfaces, passive/mutating semantics and framework/consumer/plugin destinations. No live production mutation is necessary to prove these document repairs.
A3. Each of the six F7 source cards normally fits 200 body lines and has materially fewer body words/bytes than the baseline. A justified exception is an ATTN for senior review, not a silently imposed new gate. Every extracted procedure is reachable through a direct condition; no required behavior or invariant is lost.
A4. Source generation, strict parsing, local-link checks and relevant existing principles pass. Consumer probes demonstrate executable or honest missing-prerequisite paths, not merely file existence. Model behavior is reported separately from deterministic passes.
A5. Final report identifies exact reviewed bytes, file inventory, measurements, commands/results, limitations and F1–F9 dispositions. F9 remains OPEN absent suitable behavioral evidence.

## Verification and report-back

Follow the [implementation kickoff](../plans/2026-10-05-skills-standards-repair-kickoff.md). Its commands name current infrastructure; rerun appropriate checks on the actual host/destination. No installs or global mutation solely to get a green.

The senior writes the [result template](../plans/2026-10-05-skills-standards-result-template.md) as a durable implementation report with exact patch/commit identity, then runs the [read-only result review](../plans/2026-10-05-skills-standards-review.md). Only after acceptance does the [junior delivery prompt](../plans/2026-10-05-skills-standards-junior-prompt.md) apply. The junior returns PR/merge/CI identities for senior delivery verification; a green merge alone is not substantive acceptance.

## Addendum — 2026-10-05: senior implementation, junior delivery

Latest operator approval supersedes the earlier junior-implementation role assignment. The technical scope and A1–A5 remain unchanged. Senior owns source repairs, decomposition, verification, review and any substantive recovery. Junior owns only task-scoped push/PR/normal staging merge of the explicitly accepted snapshot through existing gates, followed by a delivery receipt. Planned card edits: 14 sources and four generated copies; resources/tests are additional. No worker is launched by this checkpoint.
