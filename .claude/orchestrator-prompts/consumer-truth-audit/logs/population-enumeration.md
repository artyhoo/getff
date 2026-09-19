# §2 Population enumeration — 2026-09-08T18:15:47Z (T10: full lists, not counts)

## C1. skills — .claude/skills/*/ + skills/*/
```
.claude/skills/ai-doc/
.claude/skills/aif-architecture/
.claude/skills/aif-best-practices/
.claude/skills/aif-build-automation/
.claude/skills/aif-ci/
.claude/skills/aif-commit/
.claude/skills/aif-dockerize/
.claude/skills/aif-docs/
.claude/skills/aif-doctor/
.claude/skills/aif-evolve/
.claude/skills/aif-explore/
.claude/skills/aif-fix/
.claude/skills/aif-grounded/
.claude/skills/aif-implement/
.claude/skills/aif-improve/
.claude/skills/aif-loop/
.claude/skills/aif-plan/
.claude/skills/aif-qa/
.claude/skills/aif-reference/
.claude/skills/aif-review/
.claude/skills/aif-roadmap/
.claude/skills/aif-rules-check/
.claude/skills/aif-rules/
.claude/skills/aif-security-checklist/
.claude/skills/aif-skill-generator/
.claude/skills/aif-verify/
.claude/skills/aif/
.claude/skills/arch/
.claude/skills/claude-glm-executor-handoff/
.claude/skills/dispatcher/
.claude/skills/harvest/
.claude/skills/night-mode/
.claude/skills/orchestrator/
.claude/skills/pipeline/
.claude/skills/reviewer/
.claude/skills/rule-research/
.claude/skills/rule-tests/
.claude/skills/self-reflection/
.claude/skills/story/
.claude/skills/template-audit/
.claude/skills/tool-bootstrapping/
-- top-level skills/*/
skills/getff/
skills/tool-bootstrapping/
-- counts: .claude/skills=41 skills-root=2
```

## C2. agents — agents/*.md
```
agents/adapter-jig-reviewer.md
agents/aif-init.md
agents/backward-sweep-auditor.md
agents/capability-reuse-auditor.md
agents/claims-conformance-auditor.md
agents/compliance-verifier.md
agents/dispatch-input-checker.md
agents/docplan-auditor.md
agents/dual-channel-drift-auditor.md
agents/fidelity-auditor.md
agents/getff-cold-run-prober.md
agents/living-docs-auditor.md
agents/manual-rule-liveness-prober.md
agents/memory-codification-auditor.md
agents/orchestrator-worker-discipline.md
agents/review-sidecar.md
agents/reviewer-discipline.md
agents/rule-researcher.md
agents/rule-test-author.md
agents/shipped-agent-liveness-prober.md
-- count: 20
```

## C3. discipline rules — .claude/rules/*.md
```
.claude/rules/00-rule-index.md
.claude/rules/ai-laziness-digest.md
.claude/rules/ai-laziness-traps.md
.claude/rules/attention-is-not-a-mechanism.md
.claude/rules/autonomous-loop-continuity.md
.claude/rules/build-first-reuse-default.md
.claude/rules/ci-tool-pinning.md
.claude/rules/cold-seat-economy.md
.claude/rules/companion-install-principle.md
.claude/rules/destination-environment-verification.md
.claude/rules/doc-authority-hierarchy.md
.claude/rules/dual-implementation-discipline.md
.claude/rules/effort-worthiness.md
.claude/rules/egress-no-api-bypass.md
.claude/rules/evidence-regeneration.md
.claude/rules/git-conflict-merge-forward.md
.claude/rules/kickoff-staging-placement.md
.claude/rules/language-discipline.md
.claude/rules/memory-codification.md
.claude/rules/no-paid-llm-in-ci.md
.claude/rules/parallel-subwave-isolation.md
.claude/rules/phase-research-coverage.md
.claude/rules/recommendation-laziness-discipline.md
.claude/rules/research-source-trust.md
.claude/rules/reviewer-discipline.md
.claude/rules/rule-enforcement-channel-selection.md
.claude/rules/seat-lifecycle.md
.claude/rules/skill-description-quality.md
.claude/rules/source-before-shape.md
.claude/rules/zcode-parity-doctrine.md
-- count: 30
```

## C4. hooks — .claude/hooks/*
```
drwxr-xr-x 25 node node   800 Sep  8 17:55 .
drwxr-xr-x 11 node node   352 Sep  8 17:55 ..
-rwxr-xr-x  1 node node  4192 Sep  8 17:55 adopt-orchestrator-prompts.sh
-rwxr-xr-x  1 node node  5854 Sep  8 17:55 ask-question-reminder.sh
-rwxr-xr-x  1 node node  7322 Sep  8 17:55 check-doc-authority-header.sh
-rwxr-xr-x  1 node node  8997 Sep  8 17:55 check-doc-authority.sh
-rwxr-xr-x  1 node node 12259 Sep  8 17:55 check-hook-marker.sh
-rwxr-xr-x  1 node node 14710 Sep  8 17:55 check-kickoff-traps.sh
-rwxr-xr-x  1 node node 10825 Sep  8 17:55 check-worker-dispatch-channel.sh
-rwxr-xr-x  1 node node 21884 Sep  8 17:55 deps-hash-check.sh
-rwxr-xr-x  1 node node 41947 Sep  8 17:55 end-of-turn-reminder.sh
-rwxr-xr-x  1 node node  6377 Sep  8 17:55 inject-matching-rule.sh
-rwxr-xr-x  1 node node  3122 Sep  8 17:55 inject-memory-codification.sh
-rwxr-xr-x  1 node node  2006 Sep  8 17:55 inject-output-language.sh
-rwxr-xr-x  1 node node  3634 Sep  8 17:55 inject-project-digest.sh
-rwxr-xr-x  1 node node 11043 Sep  8 17:55 inject-session-bootstrap.sh
-rwxr-xr-x  1 node node  5181 Sep  8 17:55 inject-subagent-context.sh
-rwxr-xr-x  1 node node  1561 Sep  8 17:55 inject-subagent-digest.sh
drwxr-xr-x  5 node node   160 Sep  8 17:55 lang
drwxr-xr-x  3 node node    96 Sep  8 17:55 lib
-rwxr-xr-x  1 node node 18147 Sep  8 17:55 precompact-residue.sh
-rwxr-xr-x  1 node node 14104 Sep  8 17:55 runtime-bridge-dispatch.sh
-rwxr-xr-x  1 node node  9633 Sep  8 17:55 validate-prompt.sh
-rwxr-xr-x  1 node node  6731 Sep  8 17:55 warn-subagent-report.sh
-rwxr-xr-x  1 node node  9436 Sep  8 17:55 worktree-setup.sh
-- count (non-dot entries): 23
```

## C5. hook checks — packages/core/hooks/checks/*.ts
```
packages/core/hooks/checks/cmd-script-liveness.test.ts
packages/core/hooks/checks/cmd-script-liveness.ts
packages/core/hooks/checks/guard-liveness-fullsweep.test.ts
packages/core/hooks/checks/guard-liveness-fullsweep.ts
packages/core/hooks/checks/guard-liveness.test.ts
packages/core/hooks/checks/guard-liveness.ts
packages/core/hooks/checks/pr-body-fidelity-bin.test.ts
packages/core/hooks/checks/pr-body-fidelity-bin.ts
packages/core/hooks/checks/pr-body-fidelity.test.ts
packages/core/hooks/checks/pr-body-fidelity.ts
packages/core/hooks/checks/pr-body-prior-art-bin.ts
packages/core/hooks/checks/pr-body-prior-art.test.ts
packages/core/hooks/checks/pr-stale-revert-bin.test.ts
packages/core/hooks/checks/pr-stale-revert-bin.ts
packages/core/hooks/checks/pr-stale-revert.test.ts
packages/core/hooks/checks/pr-stale-revert.ts
packages/core/hooks/checks/prior-art.test.ts
packages/core/hooks/checks/prior-art.ts
packages/core/hooks/checks/registry.test.ts
packages/core/hooks/checks/registry.ts
packages/core/hooks/checks/s17.test.ts
packages/core/hooks/checks/s17.ts
packages/core/hooks/checks/skill-core-edit-scope.test.ts
packages/core/hooks/checks/skill-core-edit-scope.ts
packages/core/hooks/checks/unpinned-tool-install.ts
-- count: 25
-- also packages/core/hooks/*.ts (top level):
packages/core/hooks/_zcode-emit.test.ts
packages/core/hooks/adopt-orchestrator-prompts.test.ts
packages/core/hooks/apply-doc-fixes.test.ts
packages/core/hooks/ask-question-reminder.test.ts
packages/core/hooks/check-doc-authority-header.test.ts
packages/core/hooks/check-doc-authority.test.ts
packages/core/hooks/check-hook-marker.test.ts
packages/core/hooks/check-kickoff-portability.test.ts
packages/core/hooks/check-kickoff-traps.test.ts
packages/core/hooks/check-skill-drift.test.ts
packages/core/hooks/check-worker-dispatch-channel.test.ts
packages/core/hooks/classify-work.test.ts
packages/core/hooks/create-worktree.test.ts
packages/core/hooks/delta-diff.test.ts
packages/core/hooks/delta-write-from-state.test.ts
packages/core/hooks/deps-hash-check.sh
packages/core/hooks/deps-hash-check.test.ts
packages/core/hooks/dispatch-from-state.test.ts
packages/core/hooks/done-md-completion-filter.test.ts
packages/core/hooks/dup-detect-empty-arg.test.ts
packages/core/hooks/end-of-turn-reminder.test.ts
packages/core/hooks/frontier.test.ts
packages/core/hooks/getff-work.test.ts
packages/core/hooks/harness-config-drift.test.ts
packages/core/hooks/hook-emit-prelude.test.ts
packages/core/hooks/host-verify.test.ts
packages/core/hooks/inject-matching-rule.test.ts
packages/core/hooks/inject-memory-codification.test.ts
packages/core/hooks/inject-project-digest.test.ts
packages/core/hooks/inject-session-bootstrap.test.ts
packages/core/hooks/inject-subagent-context.test.ts
packages/core/hooks/inject-subagent-digest.test.ts
packages/core/hooks/lang-parity.test.ts
packages/core/hooks/launch-table-generator.test.ts
packages/core/hooks/link-coordination.test.ts
packages/core/hooks/list-presets.test.ts
packages/core/hooks/parse-override-flags.test.ts
packages/core/hooks/parse-preset.test.ts
packages/core/hooks/pin-parity.test.ts
packages/core/hooks/pre-push.consumer-layout.test.ts
packages/core/hooks/pre-push.fallback.sh
packages/core/hooks/pre-push.fallback.test.ts
packages/core/hooks/pre-push.test.ts
packages/core/hooks/pre-push.ts
packages/core/hooks/precompact-residue.test.ts
packages/core/hooks/priority-score-branch-matcher.test.ts
packages/core/hooks/priority-score-reconstruct-stub.test.ts
packages/core/hooks/priority-score-skip-closed.test.ts
packages/core/hooks/priority-score-synthetic.test.ts
packages/core/hooks/render-status.test.ts
packages/core/hooks/rule-channel-degradation.test.ts
packages/core/hooks/runtime-bridge-dispatch.test.ts
packages/core/hooks/session-start.test.ts
packages/core/hooks/unpinned-tool-install.test.ts
packages/core/hooks/update-cache.test.ts
packages/core/hooks/update-delta.test.ts
packages/core/hooks/validate-prompt.test.ts
packages/core/hooks/warn-subagent-report.test.ts
packages/core/hooks/worktree-node-modules.test.ts
packages/core/hooks/worktree-setup-hydration.test.ts
packages/core/hooks/worktree-setup.test.ts
```

## C6. principles — packages/core/principles/*.test.ts
```
packages/core/principles/01-executable-check.test.ts
packages/core/principles/02-paired-negative-test.test.ts
packages/core/principles/03-ast-over-grep.test.ts
packages/core/principles/04-no-tautology.test.ts
packages/core/principles/05-manifest-ssot.test.ts
packages/core/principles/06-must-not-demoted.test.ts
packages/core/principles/07-documents-lie.test.ts
packages/core/principles/08-prior-art-cited.test.ts
packages/core/principles/09-doc-authority-hierarchy.test.ts
packages/core/principles/10-research-patch-annotation.test.ts
packages/core/principles/11-build-first-reuse-default.test.ts
packages/core/principles/12-ai-laziness-traps.test.ts
packages/core/principles/13-phase-research-coverage-s17.test.ts
packages/core/principles/14-skill-drift-detection.test.ts
packages/core/principles/15-skill-paired-negative.test.ts
packages/core/principles/16-hook-stub-completeness.test.ts
packages/core/principles/17-no-paid-llm-in-ci.test.ts
packages/core/principles/18-meta-orchestrator-output-format.test.ts
packages/core/principles/19-meta-orchestrator-alias-routing-consistency.test.ts
packages/core/principles/20-bundle-classification.paired-negative.test.ts
packages/core/principles/20-bundle-classification.test.ts
packages/core/principles/21-agnosticism-conformance.test.ts
packages/core/principles/21-shipped-agent-tools-valid.test.ts
packages/core/principles/22-internal-english.test.ts
packages/core/principles/23-aif-init-passport-gen.test.ts
packages/core/principles/24-plugin-manifest-integrity.test.ts
packages/core/principles/25-template-rule-ref-resolution.test.ts
packages/core/principles/26-template-selector-sync.test.ts
packages/core/principles/27-prepush-copylist-complete.test.ts
packages/core/principles/28-synth-wire-oracle.test.ts
packages/core/principles/29-worker-dispatch-channel.test.ts
packages/core/principles/30-research-source-trust.test.ts
packages/core/principles/31-rule-channel-declaration.test.ts
packages/core/principles/32-prepush-section-owner.test.ts
packages/core/principles/33-adapter-jig-arm-registry.test.ts
packages/core/principles/34-claudemd-excludes-liveness.test.ts
packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts
packages/core/principles/36-ci-needs-completeness.test.ts
packages/core/principles/37-make-target-claim-liveness.test.ts
packages/core/principles/37-required-context-completeness.test.ts
packages/core/principles/38-vitest-include-ci-coverage.test.ts
packages/core/principles/39-skill-fence-orch-home.test.ts
packages/core/principles/40-kickoff-rigor-label.test.ts
packages/core/principles/41-shell-test-ci-coverage.test.ts
packages/core/principles/42-context-md-pointer-rule.test.ts
packages/core/principles/43-kickoff-host-verify-presence.test.ts
packages/core/principles/44-kickoff-authoring-traps.test.ts
-- count: 47
-- non-test files in principles/:
09-doc-authority-hierarchy.bin.ts
09-doc-authority-hierarchy.ts
11-build-first-reuse-default.design.md
15-skill-paired-negative.design.md
20-bundle-classification.ts
29-worker-dispatch-channel.bin.ts
29-worker-dispatch-channel.ts
31-rule-channel-declaration.ts
33-adapter-jig-arm-registry.ts
__fixtures__
fixtures
kickoff-population.ts
rule-channel-glob.ts
```

## C7. templates — packages/core/templates/*/ (dirs)
```
packages/core/templates/cargo/
packages/core/templates/go/
packages/core/templates/python/
packages/core/templates/react-next/
packages/core/templates/shared/
-- count: 5
-- full file tree:
packages/core/templates/cargo/Cargo.lints.toml
packages/core/templates/cargo/clippy.toml
packages/core/templates/cargo/deny.toml
packages/core/templates/cargo/github-actions-ci.yml
packages/core/templates/go/.golangci.yml
packages/core/templates/go/github-actions-ci.yml
packages/core/templates/python/.getff/astgrep-rules/getff-no-datetime-datetime-now.yml
packages/core/templates/python/.getff/astgrep-rules/getff-no-datetime-now.yml
packages/core/templates/python/.getff/astgrep-rules/getff-no-eval.yml
packages/core/templates/python/.getff/astgrep-rules/getff-no-os-system.yml
packages/core/templates/python/ARCHITECTURE.md
packages/core/templates/python/RULES.md
packages/core/templates/python/github-actions-ci.yml
packages/core/templates/python/hooks/getff.pre-commit-config.yaml.fragment
packages/core/templates/python/hooks/pre-push.sh
packages/core/templates/python/ruff.toml
packages/core/templates/python/sgconfig.yml
packages/core/templates/react-next/.storybook/main.ts
packages/core/templates/react-next/.storybook/preview.ts
packages/core/templates/shared/.lintstagedrc.json
packages/core/templates/shared/.nvmrc
packages/core/templates/shared/.prettierignore
packages/core/templates/shared/AGENTS.md.template
packages/core/templates/shared/AI-USAGE-GUIDE.md
packages/core/templates/shared/ARCHITECTURE.ts-server.md
packages/core/templates/shared/CLAUDE.md.template
packages/core/templates/shared/DESCRIPTION.template.md
packages/core/templates/shared/first-steps.source.json
packages/core/templates/shared/gitignore
packages/core/templates/shared/hooks-package.json
packages/core/templates/shared/husky-pre-commit.sh
packages/core/templates/shared/husky-pre-push.sh
packages/core/templates/shared/integration-rules.md
packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md
packages/core/templates/shared/skill-context/aif-review/SKILL.md
packages/core/templates/shared/skill-context/aif-rules-check/SKILL.md
packages/core/templates/shared/tier-home.md
packages/core/templates/shared/tsconfig.json
```

## C8. lint rule bundles
```
-- packages/core/eslint-rules/:
index.ts
next-r13-no-fetch-in-useeffect.parity.test.ts
next-r18-usequery-require-parse.parity.test.ts
no-direct-time-randomness.d.ts
no-direct-time-randomness.mjs
no-direct-time-randomness.test.ts
no-direct-time-randomness.ts
no-unsafe-zod-parse.d.ts
no-unsafe-zod-parse.mjs
no-unsafe-zod-parse.test.ts
no-unsafe-zod-parse.ts
require-otel-span.d.ts
require-otel-span.mjs
require-otel-span.parity.test.ts
require-otel-span.test.ts
require-otel-span.ts
restricted-syntax-audit-exempt.d.ts
restricted-syntax-audit-exempt.mjs
restricted-syntax-audit-exempt.test.ts
restricted-syntax-audit-exempt.ts
-- .getff/astgrep-rules:
-- clippy.toml:
ABSENT
-- .golangci.yml:
ABSENT
-- ruff config (pyproject.toml/ruff.toml):
ABSENT (no python lint config at root)
```


> **Continued:** classes C9-C11 + tracked/local split + drift table + spec corrections → [population-enumeration-2.md](population-enumeration-2.md)
