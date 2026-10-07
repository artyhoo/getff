# Codex skills and hooks acceptance — 2026-10-07

> **Authoritative for:** evidence and limitations of this local Codex contributor adaptation audit.
> **NOT authoritative for:** canonical skill procedures, native host support, hook trust, or complete Claude/Codex workflow parity.

## Result and scope

All 41 native entries (20 skills and 21 role cards) were inventoried and discovered as enabled by Codex Desktop 0.160.0. The source census read 218 files, including conditional references; a separate literal runtime census classified 676 existing references, 175 dynamic/glob/directory references and 78 missing-path occurrences, separating consumer prerequisites, guarded fallbacks, examples, outputs and stale paths. This is complete binding coverage, not evidence that every procedure completed end to end.

Current local status: the contributor plugin was refreshed through the supported CLI. All 21 definitions are trusted, with no definition mismatch, runtime drift or warning. The operator explicitly requested disabling the Codex plain-words recap hook; its native Stop registration is now disabled in user configuration. The other 20 hooks remain enabled. Doctor reports `ready=false` because it requires every registration to be enabled; this intentional opt-out supersedes the earlier all-enabled acceptance below. Trust hashes were not changed.

## Repairs

- Restored the existing Codex renderer/adapter/doctor integration from checkout `0d9e` into this checkout, then fixed the binding gaps. The other checkout was not modified. Canonical procedures remain the owners; cards load the full source and bind resources to that directory.
- Retained plugin-only skills, explicit-only invocation policy and companion references. Added missing native resource links for harvest and the Claude/GLM handoff.
- Expanded every applicable PreToolUse/PostToolUse selector for native `apply_patch`, `exec_command` and native question tools. The initial visible-failure guard exposed a cross-worktree bootstrap deadlock; the final plugin bundles its adapter and both dependencies, so old checkouts no longer need a local adapter.
- Preserved existing operator `.codex/config.toml` byte for byte. Doctor rejects a present but disabled skill; generation/doctor regression failures were reproduced before repair.
- Repaired `/arch` full-round and full-card behavior, actual carrier schema binding and unanswered-fork preservation. Silence is not approval.
- Corrected installer command/helper invocation, active-harness tool bootstrap, two rule-researcher paths, and the story helper's unsupported claim that a PR had been pushed.
- Updated the existing harness-local sandbox to copy the renderer's new module dependency; its 12 regression cases pass.

## Complete native entry census

| Entry                            | Canonical owner                                       | Behavioral coverage / limit                                                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adapter-jig-reviewer`           | `agents/adapter-jig-reviewer.md`                      | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `ai-doc`                         | `.claude/skills/ai-doc/SKILL.md`                      | Used for this repair; canonical full read and writing-skills companion. No separate cold end-to-end test.                                                                                                        |
| `aif-doctor`                     | `.claude/skills/aif-doctor/SKILL.md`                  | Actual read-only bridge/container health. Host localhost API inaccessible, log window stale; no heal.                                                                                                            |
| `aif-init`                       | `agents/aif-init.md`                                  | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `arch`                           | `.claude/skills/arch/SKILL.md`                        | Native Plan: two full cards; actual context compaction; continuation preserves one accepted and one open fork. Default fallback cold-tested. Async payload adapted in subprocess, native delivery pending trust. |
| `backward-sweep-auditor`         | `agents/backward-sweep-auditor.md`                    | Independent class-only backward sweep performed; result recorded below.                                                                                                                                          |
| `capability-reuse-auditor`       | `agents/capability-reuse-auditor.md`                  | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `claims-conformance-auditor`     | `agents/claims-conformance-auditor.md`                | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `claude-glm-executor-handoff`    | `.claude/skills/claude-glm-executor-handoff/SKILL.md` | Applicability rejected in native Codex; mixed-model execution remains unproven.                                                                                                                                  |
| `compliance-verifier`            | `agents/compliance-verifier.md`                       | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `dispatch-input-checker`         | `agents/dispatch-input-checker.md`                    | Independent cold synthetic kickoff: STOP for missing design, failed probe without host verification, and write-scope mismatch.                                                                                   |
| `dispatcher`                     | `.claude/skills/dispatcher/SKILL.md`                  | Missing kickoff preflight stops; no task dispatch.                                                                                                                                                               |
| `docplan-auditor`                | `agents/docplan-auditor.md`                           | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `docs-author`                    | `.claude/skills/docs-author/SKILL.md`                 | Actual page-kind registry and Diataxis companion classification; installed companion pin equality not verified.                                                                                                  |
| `docs-form-auditor`              | `agents/docs-form-auditor.md`                         | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `dual-channel-drift-auditor`     | `agents/dual-channel-drift-auditor.md`                | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `fidelity-auditor`               | `agents/fidelity-auditor.md`                          | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `getff`                          | `skills/getff/SKILL.md`                               | Bounded unenforced-rule classification; no install.                                                                                                                                                              |
| `getff-cold-run-prober`          | `agents/getff-cold-run-prober.md`                     | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `harvest`                        | `.claude/skills/harvest/SKILL.md`                     | Actual host-health preflight fails honestly; no fetch/push/PR.                                                                                                                                                   |
| `installing-enforcement`         | `plugin/skills/installing-enforcement/SKILL.md`       | Actual command procedure and installer preview in scratch; 19 file hashes unchanged; no installation.                                                                                                            |
| `living-docs-auditor`            | `agents/living-docs-auditor.md`                       | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `manual-rule-liveness-prober`    | `agents/manual-rule-liveness-prober.md`               | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `memory-codification-auditor`    | `agents/memory-codification-auditor.md`               | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `night-mode`                     | `.claude/skills/night-mode/SKILL.md`                  | Missing plan blocks; no autonomous loop or wakeup.                                                                                                                                                               |
| `orchestrator`                   | `.claude/skills/orchestrator/SKILL.md`                | Missing plan blocks; no workers or fabricated model ids.                                                                                                                                                         |
| `orchestrator-worker-discipline` | `agents/orchestrator-worker-discipline.md`            | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `pipeline`                       | `.claude/skills/pipeline/SKILL.md`                    | Actual integer-name guard, preset parser/list: four presets; full helper suite run separately. --auto is read-only.                                                                                              |
| `review-sidecar`                 | `agents/review-sidecar.md`                            | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `reviewer`                       | `.claude/skills/reviewer/SKILL.md`                    | Actual question-mode routing; independent cold adaptation review and dispatch-input reviewer performed.                                                                                                          |
| `reviewer-discipline`            | `agents/reviewer-discipline.md`                       | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `rule-research`                  | `.claude/skills/rule-research/SKILL.md`               | Actual missing-stack/base-core preflight stops; framework paths corrected; no live research/synthesis.                                                                                                           |
| `rule-researcher`                | `agents/rule-researcher.md`                           | Full procedure and bounded prerequisite scenario; fixed two stale framework script/resource paths.                                                                                                               |
| `rule-test-author`               | `agents/rule-test-author.md`                          | Full procedure in bounded missing-id scenario; no rule generation.                                                                                                                                               |
| `rule-tests`                     | `.claude/skills/rule-tests/SKILL.md`                  | Missing rule id held open; no fabricated firing evidence.                                                                                                                                                        |
| `self-reflection`                | `.claude/skills/self-reflection/SKILL.md`             | Applied forward/backward checks to this change; independent class sweep.                                                                                                                                         |
| `shipped-agent-liveness-prober`  | `agents/shipped-agent-liveness-prober.md`             | Full static procedure/resource binding and enabled native discovery only; no separate end-to-end role execution.                                                                                                 |
| `story`                          | `.claude/skills/story/SKILL.md`                       | Actual language helper; false pushed-PR statement removed and regression checked.                                                                                                                                |
| `template-audit`                 | `.claude/skills/template-audit/SKILL.md`              | Actual template runner: 9 tests passed; no template publication.                                                                                                                                                 |
| `tool-bootstrapping`             | `.claude/skills/tool-bootstrapping/SKILL.md`          | Actual detection only; active harness and callable MCP binding fixed; no installation.                                                                                                                           |
| `using-getff`                    | `plugin/skills/using-getff/SKILL.md`                  | Actual route choice to appropriate skill; no invented invocation.                                                                                                                                                |

## Hook census

All entries below have generated-selector coverage and native registration evidence. They are currently pending native trust; this table does not certify event delivery. `inject-subagent-context` is a ZCode rewrite replaced by native SubagentStart digest delivery. The adapter tests exercise actual canonical shell hooks with synthetic host payloads.

| Native event       | Canonical scripts                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UserPromptSubmit   | `deps-hash-check`                                                                                                                                                                                                                 |
| PreToolUse         | `ask-question-reminder`, `inject-subagent-context`, `inject-matching-rule`, `seal-primary-checkout`                                                                                                                               |
| PostToolUse        | `validate-prompt`, `check-doc-authority`, `inject-matching-rule`, `check-kickoff-traps`, `check-hook-marker`, `runtime-bridge-dispatch`, `check-worker-dispatch-channel`, `inject-memory-codification`, `close-aif-task-on-merge` |
| PostToolUseFailure | `runtime-bridge-dispatch`                                                                                                                                                                                                         |
| Stop               | `end-of-turn-reminder`                                                                                                                                                                                                            |
| SubagentStart      | `inject-subagent-digest`                                                                                                                                                                                                          |
| SubagentStop       | `warn-subagent-report`                                                                                                                                                                                                            |
| SessionStart       | `link-coordination`, `inject-handoff-on-compact`, `inject-matching-rule`, `inject-session-bootstrap`                                                                                                                              |
| PreCompact         | `precompact-residue`                                                                                                                                                                                                              |

`PostToolUseFailure` has no native equivalent in the inspected Codex version and is explicitly listed as a degradation. It is not silently treated as delivered. Input enforcement is bounded: literal shell reads and deterministic deny rules are covered; arbitrary interpreters, compound shell, write_stdin and unknown MCP executors are not certified.

## Verification

- Adapter/generator/doctor regressions: 48/48 passed, including missing runtime, native selector completeness, config preservation, disabled skill readiness, multi-file patches, protected paths and transcript/context adaptation.
- Shell syntax: all 81 `.sh` files under `.claude/hooks`, `plugin/hooks`, `.claude/skills`, `skills`, `plugin/skills` passed `bash -n`. This includes language packs and shared libraries, not just executable helpers. Another 28 referenced shell scripts outside these directories passed `bash -n` (109 unique shell files total). All 81 existing referenced JS/TS/Python source files passed their syntax parsers; TypeScript used its own parser, not Node's CommonJS parser. Syntax parsing does not prove runtime dependencies or type correctness.
- Template audit: 9/9. Focused story, companion body and harness drift tests: 44/44. Focused stop/doc-authority/drift/language/plugin-integrity tests: 391/391.
- Full helper suite initial run: 350 passed, 6 failed (3 files). Serial recheck: 81/82; the remaining first-execution timing failure was reproduced with the actual resolver: two fresh stubs exceeded the 1s deadline before entering their body, then the same inodes completed in 0.19–0.21s. The fixture now primes executable loading without executing a discovery branch; the 1s resolver budget and hanging-context checks remain intact. Dispatcher final: 67/67. No production helper logic changed.
- Full hook suite initial run: 2234 passed, 20 failed (7 files). Eight failures came from the missing renderer dependency in the sandbox and are repaired (12/12 recheck). The remaining six files passed serial recheck: 147/147. These are separate runs, not a claim that the initial full parallel run passed.
- Final focused story/harness tests: 33/33. Renderer drift check passes. Independent review closed both configuration-clobber and disabled-skill readiness findings; this review does not assert native hook delivery.

## Live /arch evidence

Before repair, a fresh agent read the canonical source and companions but asked one of two independent forks, following the stale serial fallback. After repair, a fresh agent produced both complete cards. Real app-server Plan execution then emitted two native questions with full option descriptions; the run was interrupted without answering or writing product files. A second run actually completed `contextCompaction` and, after a synthetic partial answer, asked only the unresolved second fork. The accepted first choice remained recorded. No product design/spec/ADR was produced.

Portable receipt: [source hashes, all shell paths, native question cards and runtime limits](codex-skills-acceptance.json). Local detailed receipts: `/tmp/codex-arch-live/question.json`; `/tmp/codex-arch-compact/events.jsonl` (contextCompaction start/completion, lines 213/216); `/tmp/codex-arch-compact/after-compact-question.json`. These are local run evidence, not portable automated tests or native async-hook proof.

## Reproduction and remaining acceptance

See [binding and refresh commands](codex-local-skills.md#regeneration-and-compatibility). The plugin now carries its own adapter runtime and passes the active checkout root explicitly. Older worktrees can execute installed hooks without receiving a local adapter. Canonical skill/source changes remain local to this revision until integrated; older worktrees still need source updates for those changes. A plugin marketplace registered to a retired worktree must be re-registered from an available source checkout.

Normal Codex hook trust review, then fresh-session native PreToolUse/PostToolUse/lifecycle firing are still required. Production dispatch, harvest, autonomous worker loops, notification helpers and healing scripts were not run for an audit: their safe prerequisite branches and fixture tests are the available evidence. No full CC-versus-Codex end-to-end parity claim is made.

### §1.7 Forward-check applied

Canonical ownership is preserved by full-source cards (`scripts/render-codex-contributor.mjs:9`) and scoped binding documentation. Tests preserve operator config and reject false readiness (`scripts/codex-skills.test.mjs:70`, `scripts/codex-skills.test.mjs:202`). Native host trust was inspected, not bypassed. Source language twins were updated together; their existing drift, authority and language checks passed.

### §1.7 Backward-check applied

Class = native project procedure/resource/tool bindings. Surfaces = all four source populations, all 41 native entries, all canonical hook registrations and all 81 shell files. The selector sweep checks every relevant model entry (`scripts/codex-skills.test.mjs:101`), not only the original question hook. Plugin-only skill omission, native mutation/shell aliases, two stale source paths, config overwrite and disabled-skill readiness were GAP-FOUND and repaired. Static-only roles and unavailable native events remain explicit limitations, not exemptions from a success claim. Independent class-only sweep: GO; all 41 owners, 21 resource links and 128 generated objects inspected. All 127 non-seed fingerprints match. No additional gap found; untouched sibling surfaces were included.

## Timing diagnosis scope

The named mechanism is first execution of newly created executable fixture files,
which consumes a bounded helper's call budget before the fixture body starts.
The test suite owns fixture preparation; it now primes that one shared executable
before assertions. This does not change production timeouts or stub behavior and
preserves the hanging-context negative arm. Other timeouts in the initial parallel
run are not automatically assigned this cause; serial recheck results are reported
separately. OS-level first-execution policy was not changed or bypassed.

## Follow-up: trusted hooks exposed a cross-worktree bootstrap deadlock

The operator confirmed the initial definitions: all 21 became trusted and the
doctor returned ready=true. A real read-only /arch session delivered 31 hook
results: 13 completed PreToolUse, 12 completed PostToolUse, two SessionStart,
one UserPromptSubmit, one blocked question preflight, one blocked Stop and one
completed corrective Stop. The question preflight caused the model to render two
full text cards; it did not retry the native question carrier in that run. This
is evidence of native delivery and correction, not complete question-tool parity.

The main checkout and worktree f24c did not contain the uncommitted adapter. The
initial global hook command required that local file, blocking all tools and
repeating Stop feedback. Manual copying unblocked the main checkout; f24c then
exposed that the delivery design was insufficient across worktrees.

The final generator bundles the unchanged source layout for the adapter,
entry-point library and language resolver in the installed plugin. Commands use
PLUGIN_ROOT (CLAUDE_PLUGIN_ROOT fallback) and explicitly pass the active Git
root. The adapter still invokes canonical hooks in that root. Regression tests
execute the real question hook in two checkouts with no local adapter. A missing
package remains visible; its Stop handler exits without blocking, preventing the
retry loop. Doctor verifies installed runtime content hashes as well as definitions.

This changes the hook command definitions and requires normal trust review once
more. No trust hashes were edited or bypass flags used. Final post-refresh status
and test counts are recorded after installation below.

Final bundled-runtime verification: 51/51 Node regressions passed, 29/29 focused
harness tests passed, renderer drift and formatting checks passed. Independent
narrow review: GO after fixing the partial-package missing-helper Stop loop.
The actual main checkout and f24c both ran the real question hook from the package;
f24c had no local adapter and needed no source edits. Its synthetic question was
correctly denied with the fork-card reminder; this is subprocess integration
evidence, not a claim about a fresh native session after final trust review.

The installed package was refreshed through `codex plugin add`. Doctor found all
21 definitions and all three installed runtime content hashes matched, with no
warning. The changed commands are again `modified` (21), so `ready=false` pending
normal trust confirmation. After approval, start a fresh session in f24c to avoid
an already-running session retaining the old hook command definitions.

## Final operator trust confirmation and native f24c acceptance

The operator confirmed the final bundled definitions. Fresh doctor result:
all 21 trusted, discovered=true, skillsActivated=true, hooksActivated=true,
ready=true, no runtime hash mismatch, missing definition or warning.

A fresh ephemeral native Codex session in f24c completed a harmless `pwd`, added
and deleted the single authorized `.codex-native-hook-probe-20261007.txt` through
native apply_patch, and completed its turn. No probe file remains. The checkout
still has no local adapter. Native SessionStart, UserPromptSubmit, PreToolUse,
PostToolUse and Stop delivery is recorded in the JSON receipt. This closes the
cross-worktree bootstrap acceptance; the event and production-workflow limits
listed above still apply. Source changes remain local and uncommitted.

## Follow-up: SessionStart conflict and operator recap opt-out

A direct run of the installed runtime in the primary checkout reproduced SessionStart exit 2. The canonical coordination script found two real-file conflicts against the shared coordination store: `plain-words-recap-v2/dispatch-s5.md` and `_handoff-5da94447-1bf5-494f-a80c-77b2934c1b6a.md`. Both pairs differ. The canonical harness registration explicitly uses `|| true`, but the adapter had discarded that nonblocking policy.

The adapter now consults that canonical SessionStart registration before downgrading a completed coordination failure to additional context. Missing or malformed policy, missing scripts and other executable gates retain their failure behavior. The warning remains visible to the model; no conflict resolution or preferred file version is selected.

The new regression runs the real coordination script in an isolated Git repository with two conflicting handoff versions. It failed with `2 !== 0` before the repair and passed afterward. It also verifies both contents survive and that removing the canonical nonblocking registration restores failure. The three Codex suites pass 52/52 (`/tmp/codex-sessionstart-regression-tests.log`); generated-config drift checks pass. After the supported plugin refresh, the installed adapter returns exit 0 for the actual primary-checkout conflicts and reports them as context. All four conflicting file contents are unchanged. This follow-up is a real installed-command check, not a separate native-session startup acceptance.

At the operator's explicit request, `config/batchWrite` set only the native `end-of-turn-reminder` Stop registration's `enabled` field to false. Native `hooks/list` verifies 20 other registrations remain enabled and all 21 remain trusted. No trust hash changed. The setting is user-local and is not committed or generated into the contributor plugin. The Stop registration contains the recap and other checks implemented by that same script; those checks do not run while the registration is disabled. Earlier all-enabled smoke results remain historical evidence.
