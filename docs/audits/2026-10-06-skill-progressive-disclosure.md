# Four skill cards: progressive disclosure implementation

> **Authoritative for:** this bounded implementation candidate, section preservation and deterministic delivery receipts.
> **NOT authoritative for:** live model acceptance, production-runtime claims, PR publication, integration or merge approval.

Date: 2026-10-06. Input SHA: `63da1fb35059a892fb634ab02697636dbc1d1976` (PR #2066 audited head). Candidate: the local commit containing this report on `codex/skill-progressive-disclosure`; resolve with `git rev-parse HEAD`. The post-commit durable handoff at `.ai-factory/plans/skill-progressive-disclosure-handoff.md` records its literal SHA (kept untracked intentionally; final response also records it).

## Isolation and inputs

Managed worktree: `/Users/art/.codex/worktrees/skill-progressive-disclosure/rules-as-tests-aif`. At entry: actual HEAD matched input SHA, detached branch, `git status --short` empty. A new local `codex/skill-progressive-disclosure` branch was created before edits. Attached artifacts were empty. No primary checkout or zealous-murdock review lane was edited, and no concurrent #2066 repair was incorporated.

Read AGENTS.md, README goal/invariants, session bootstrap, CLAUDE.md, task-relevant rules, skill-creator, writing-for-agents/SKILL-MECHANICS, ai-doc/residue and writing-skills. The user's no-live-model/no-publication instruction overrides writing-skills' pressure runs/push steps. The supplied audit and inventory were read; all four owner SHA-256 hashes matched the inventory. Frozen four-field task context is `.claude/task-context.md`.

Current primary [Agent Skills specification](https://agentskills.io/specification) supports conditional resources and recommends a card under 500 lines/about 5,000 tokens. [Anthropic authoring guidance](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) supports concise cards, conditional detail and shallow references. Checked 2026-10-06. The 200-body-line threshold is local, not an official universal limit; all four already met it. Character counts below are not tokenizer counts.

## Result and preservation

Frontmatter was retained byte-for-byte: names, bilingual trigger metadata, arguments, allowed tools, model fields and explicit invocation policy remain unchanged. Canonical ownership and deliberate contributor/consumer variants remain unchanged.

- **harvest:** preflight, committed-work guards, push/API boundary, reconciliation, sweep semantics and fidelity/publication stops remain hot. Exact egress mechanics, fidelity seat runbook, publication/closure commands and incident history have separate references. Read each operational reference BEFORE its associated action; history is optional. Retained explicit requesting-code-review, no-verify ban and close-after-merge behavior.
- **GLM handoff:** scope, ZCode delivery boundary, six-block input, Status translation, bounded recovery and worker-only/designed-not-proven guards remain hot. Model facts/folklore and acceptance/provenance move to separate references. Current-model re-verification is required before using dated rows; no new model/pricing assertions were introduced.
- **getff:** five layers, existing conditional index, config recipe and all five verification requirements remain hot. Template catalog is read before selecting/copying config; vocabulary, failure examples and integration context are conditional. External AIF remains optional. The defective `skills/getff/SKILL.md` compatibility loader is untouched.
- **self-reflection:** activation/exclusions, exact evidence-bearing output contract and complete forward/backward summary remain hot. Dated enforcement/original self-compliance narrative and retro prompts/anti-pattern details move to focused references; retro routing explicitly requires all five prompts when relevant.

The complete [section map](2026-10-06-skill-progressive-disclosure/section-preservation-map.json) records every old top-level section, source line range, preserved owner and each rewritten paragraph. Four rewritten paragraph groups are manually mapped above/in JSON: harvest doctor wording, cross-stage sentence, repaired night authorization pointer, GLM six-block D4/D5 reference labels. All other non-heading paragraphs match preserved hot/cold content after whitespace/link-target normalization. Preamble/authority/posture is recorded separately. Old harvest before/after narratives are preserved as labeled historical provenance; a short current paired-negative stays in the card. No unique incident, warning, source attribution or unproven status was deleted.

## Body size (excluding YAML; including body blank lines)

| Owner | Lines before → after | Characters before → after | Reduction |
|---|---:|---:|---:|
| harvest | 134 → 72 | 19,858 → 9,324 | 53.0% |
| claude-glm-executor-handoff | 136 → 105 | 24,217 → 11,851 | 51.1% |
| getff | 148 → 96 | 15,320 → 9,121 | 40.5% |
| self-reflection | 128 → 81 | 15,288 → 7,332 | 52.0% |

These are unconditional card reductions. A complete harvest still reads necessary egress/fidelity/publication detail at the relevant stage; this does not pretend that the total procedural content disappeared. Historical material is not part of mandatory operational loading. GLM facts load only for actual model-specific decisions, not ordinary REPORT parsing.

## Delivery and generators

Ran `node scripts/render-harness-config.mjs --write`: complete generated diff adds only two Codex resource links and their inventory rows. No hook/config/model/permission content changed. Claude compatibility references use the existing file-link contract; two getff compatibility resource links were added without touching its loader. That finite migration has no reusable generator for newly authored Claude reference links; no generator logic or migration-map census was redesigned.

Ran `bash scripts/generate-plugin-skills.sh`: only getff card/new references changed in plugin payload. Other seven entries remained in sync. Generator acceptance checks transform parity and clobber controls. The generator has NO `--check` mode: consistency receipt is a no-op invocation (`generated 0`, `8 already in sync`) plus acceptance. The true Codex check is `node scripts/render-harness-config.mjs --check --only codex`; directly invoking the emit module is not a check.

The scoped preservation probe checks unchanged YAML, reachable relative Markdown file targets, canonical/native resource content or deliberate full-source loaders, every new detail's card routing, and plugin resource transform parity. Negative resource-membership control discriminates missing files. A real disposable consumer install (`install.sh ts-server --force --with-aif-suite`) additionally checks all getff/harvest resources and relative file links; removes/restores an actual routed resource in the fixture as the negative control. GLM/self-reflection are contributor-only on this delivery contour. Anchors/external URL reachability are not exhaustively validated.

## Verification receipts

Installed dependencies from the primary checkout were symlinked into this isolated checkout; no dependency installation/fetch or live model execution was launched. [Receipt directory](2026-10-06-skill-progressive-disclosure/) contains exact command arrays, cwd, exits and outputs (trailing blank lines normalized).

| Check | Baseline | Final candidate |
|---|---|---|
| `node --test scripts/{canonical-agents-source,canonical-native,codex-contributor}.test.mjs` | 47 pass / 1 fail | 47 pass / 1 fail; same defective legacy getff loader |
| `bash scripts/check-skill-drift.sh` | PASS | PASS |
| local Vitest principles 14/15/39/48 | 38 PASS | 38 PASS |
| `bash tests/plugin/skills-generation.test.sh` | 15 PASS | 15 PASS |
| `bash tests/install-sh/ship-orchestration-skills.test.sh` | 30 PASS | 30 PASS |
| real Codex renderer check | initial emit-module invocation was inconclusive | PASS via actual harness CLI |
| plugin generation consistency | 0 written / 8 in sync | 0 written / 8 in sync |
| preservation/delivery probe + actual consumer resource smoke | N/A | PASS; explicit missing-resource controls |
| `git diff --check` | clean input | PASS |
| authority/language principles 09/22 on staged sources | not repeated at baseline | 48 PASS |

Early sandbox-restricted baseline commands could not create drift scratch files; rerunning with authorized isolated-worktree access produced the actual baseline above. Intermediate candidate checks caught introduced missing Claude reference bindings and missing harvest paired-negative: fixed, then tests rerun. A later generator guard rejected a stale intermediate getff payload after source whitespace edits; only that known generated card was restored to its reproducible HEAD pre-image, then authoritative generator rebuilt it. Final checks are green except the unchanged baseline loader failure. Earlier failures are retained under `candidate/` and `final/`; `verified/` is the final receipt set. No gates were bypassed or weakened.

Behavioral/model acceptance is **UNTESTED**. Static preservation and resource delivery cannot prove that a native model follows routing under pressure. No cold model/subagent run was launched under the no-real-model-execution scope. The parent senior still owns independent review; this report does not issue a fidelity GO or authorize publication.

### §1.7 Forward-check applied

No new rule/backend/dependency or capability was introduced. The frontmatter byte check and `packages/core/principles/48-skill-description-budget.test.ts:1` preserve resident metadata; `packages/core/principles/15-skill-paired-negative.test.ts:1` caught and verified the harvest correction. Authority headers were added to each new reference; meaningful delivery controls are recorded with actual outputs. No TS source, hooks, configuration or enforcement channel changed.

### §1.7 Backward-check applied

Class = conditional detail/resource delivery for four canonical skills. Swept all four canonical owners, their existing Claude or compatibility entries, generated Codex views and applicable plugin/consumer views; map/probe records the complete scoped population rather than examples. `scripts/render-codex-contributor.mjs:139` derives children as links; new harvest/GLM resource links and inventory are included. `tests/install-sh/ship-orchestration-skills.test.sh:46` uses real canonical consumer bytes; the scoped consumer check extends coverage to all new getff/harvest resources. Missing-file controls discriminate. Deliberate contributor/consumer variants and the legacy defective getff loader are classified, not silently repaired. Cold independent semantic review remains pending.

## Integration addendum — staging transposition (2026-10-06, separate session)

The candidate was authored against the `#2066` canonical layout (`.agents/procedures/*`, `.codex/contributor-inventory.json`, `.claude/task-context.md`). That architecture is NOT merged; integration lands the same four-card refactor on the CURRENT staging surfaces, preserving #2066's independence. Everything above describes the candidate world; this section records the integration deltas.

- **Surface map:** `.agents/procedures/harvest|claude-glm-executor-handoff|self-reflection/SKILL.md` → `.claude/skills/<name>/SKILL.md`; `.agents/procedures/getff/SKILL.md` → `skills/getff/SKILL.md` (pre-candidate content byte-identical between the two worlds, verified by diff). Reference directories become REAL files under the same canonical dirs (the candidate's symlink twins and `.agents/skills/*` links belong to the unmerged architecture and are not carried). `plugin/skills/getff/*` regenerated via `scripts/generate-plugin-skills.sh`.
- **Link-target substitution (4 landed sites, mechanical):** `../../../.agents/roles/` → `../../../agents/` in the GLM card (orchestrator-worker-discipline, §-header line) and the self-reflection card (backward-sweep-auditor); `../../../../.agents/roles/` → `../../../../agents/` in `references/fidelity.md` (fidelity-auditor) and `references/acceptance-gaps.md` (orchestrator-worker-discipline). The candidate-world harvest-card `.agents` link targeted content the refactor itself relocated into `references/fidelity.md`, so the harvest card carries no substituted link; it names `agents/fidelity-auditor.md` inline in the §4 routing line instead (fix round, keeps the `referencedBy` corpus truthful). Frontmatter hashes are byte-identical to BOTH the candidate and the pre-refactor staging cards (sha256-verified per card).
- **Not carried:** `.codex/contributor-inventory.json`, `.claude/task-context.md`, `.agents/**` — #2066-lane surfaces absent from staging. The `render-harness-config.mjs --only codex` check and the three `scripts/{canonical-agents-source,canonical-native,codex-contributor}.test.mjs` suites have no staging counterpart; the candidate's Node baseline failure (legacy `skills/getff/SKILL.md` loader) does not exist on staging, where that file is the real card this refactor rewrites.
- **Receipts for the integrated staging tree:** [integration-staging/](2026-10-06-skill-progressive-disclosure/integration-staging/) (run on the integration commit by the integrating session).

## Senior handoff / remaining decisions

Inspect the source-section map and complete diff against input SHA. Reconcile this separate candidate with concurrent #2066/staging repair AFTER review; do not transplant unreviewed delivery links or assume loader repairs were integrated. Known automatic Node gate gap, staleness bypass, snapshot/Windows/runtime concerns remain outside scope. No push, PR, external comment, merge, factory task or worktree teardown occurred. Preserve this checkout for review.

## Complete changed-file manifest

The manifest includes authored owners/references, dependent bindings/payload/inventory, frozen task context, and scoped reports/receipts. It excludes ignored dependency links and disposable fixtures. The literal final commit SHA is recorded in the local handoff after commit.

- `.agents/procedures/claude-glm-executor-handoff/SKILL.md`
- `.agents/procedures/claude-glm-executor-handoff/references/acceptance-gaps.md`
- `.agents/procedures/claude-glm-executor-handoff/references/model-facts.md`
- `.agents/procedures/getff/SKILL.md`
- `.agents/procedures/getff/references/framework-context.md`
- `.agents/procedures/getff/references/template-catalog.md`
- `.agents/procedures/harvest/SKILL.md`
- `.agents/procedures/harvest/references/egress.md`
- `.agents/procedures/harvest/references/fidelity.md`
- `.agents/procedures/harvest/references/history.md`
- `.agents/procedures/harvest/references/publication-and-closure.md`
- `.agents/procedures/self-reflection/SKILL.md`
- `.agents/procedures/self-reflection/references/origin-and-enforcement.md`
- `.agents/procedures/self-reflection/references/retro-prompts.md`
- `.agents/skills/claude-glm-executor-handoff/references`
- `.agents/skills/harvest/references`
- `.claude/skills/claude-glm-executor-handoff/references/acceptance-gaps.md`
- `.claude/skills/claude-glm-executor-handoff/references/model-facts.md`
- `.claude/skills/harvest/references/egress.md`
- `.claude/skills/harvest/references/fidelity.md`
- `.claude/skills/harvest/references/history.md`
- `.claude/skills/harvest/references/publication-and-closure.md`
- `.claude/skills/self-reflection/references/origin-and-enforcement.md`
- `.claude/skills/self-reflection/references/retro-prompts.md`
- `.claude/task-context.md`
- `.codex/contributor-inventory.json`
- `docs/audits/2026-10-06-skill-progressive-disclosure-sizes.json`
- `docs/audits/2026-10-06-skill-progressive-disclosure.md`
- `docs/audits/2026-10-06-skill-progressive-disclosure/baseline-authorized/codex.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/baseline-authorized/delivery.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/baseline-authorized/drift.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/baseline-authorized/generated.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/baseline-authorized/node.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/baseline-authorized/plugin.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/baseline-authorized/principles.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/baseline-authorized/receipts.json`
- `docs/audits/2026-10-06-skill-progressive-disclosure/candidate/drift.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/candidate/generated.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/candidate/plugin.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/candidate/principles.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/candidate/receipts.json`
- `docs/audits/2026-10-06-skill-progressive-disclosure/consumer-delivery.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/consumer-install.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/extra-principles.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/final/drift.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/final/generated.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/final/plugin.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/final/principles.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/final/receipts.json`
- `docs/audits/2026-10-06-skill-progressive-disclosure/preservation-delivery.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/section-preservation-map.json`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verified/codex.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verified/delivery.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verified/drift.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verified/generated.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verified/node.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verified/plugin.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verified/principles.txt`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verified/receipts.json`
- `docs/audits/2026-10-06-skill-progressive-disclosure/verify-preservation.py`
- `plugin/skills/getff/SKILL.md`
- `plugin/skills/getff/references/framework-context.md`
- `plugin/skills/getff/references/template-catalog.md`
- `skills/getff/references/framework-context.md`
- `skills/getff/references/template-catalog.md`
