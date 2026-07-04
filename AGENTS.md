# AGENTS.md — framework contributor context (off-CC harnesses)

> **Authoritative for:** off-CC session context for contributors to this framework; portable rule index (§Rules).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](README.md#why-this-exists). CC-specific session boot — see [CLAUDE.md](CLAUDE.md) (auto-loaded by Claude Code at session start).

Universal format read by Cursor, Codex CLI, Aider, Windsurf, and other non-CC harnesses.
**Claude Code users:** `CLAUDE.md` is your authoritative entry doc — CC auto-loads it AND `.claude/rules/*.md`. Read this file only if working across harnesses or onboarding off-CC.

## What this project is

**Goal:** AI agents can't silently bypass undocumented conventions. Every codified rule is an executable artifact (ESLint rule, pre-push check, principle test, mutation gate, drift probe) that fails at the earliest reachable channel — edit-time → pre-commit → pre-push → CI → production audit. CI is the last resort, not the primary gate. Full statement: [README.md#why-this-exists](README.md#why-this-exists).

**Methodology:** recursive self-application — the framework validates itself with its own logic.

## Session start (Step 0)

1. Read [README.md#why-this-exists](README.md#why-this-exists) — the project goal.
2. Read [.claude/session-bootstrap.md](.claude/session-bootstrap.md) — goal restatement + invariants (compaction-resilient).
3. Read the rules below that apply to your task.

## Rules

**On Claude Code:** `.claude/rules/*.md` auto-load at session start — no manual action needed.
**On other harnesses (Cursor, Codex, Aider, Windsurf):** these rules do NOT auto-load. Read the ones relevant to your task from the list below before starting.

| Rule file | Enforces |
|---|---|
| [`.claude/rules/ai-laziness-traps.md`](.claude/rules/ai-laziness-traps.md) | AI laziness trap catalogue with countermeasures; applied to all R-phases, audits, and open-ended AI tasks |
| [`.claude/rules/attention-is-not-a-mechanism.md`](.claude/rules/attention-is-not-a-mechanism.md) | A load-bearing check must be a deterministic gate or a named cold-agent protocol; bare human/AI attention is merge authority, never the detection layer |
| [`.claude/rules/build-first-reuse-default.md`](.claude/rules/build-first-reuse-default.md) | Project-wide default: ADOPT upstream before BUILD; macro-level scope discipline for capability proposals |
| [`.claude/rules/ci-tool-pinning.md`](.claude/rules/ci-tool-pinning.md) | CI audit tool installs in `.github/workflows/` must use version pins; local dep installs must use `npm ci` (not `npm install`) |
| [`.claude/rules/companion-install-principle.md`](.claude/rules/companion-install-principle.md) | Companions/external services install via their own official installer; no version pins; no reimplementing steps |
| [`.claude/rules/doc-authority-hierarchy.md`](.claude/rules/doc-authority-hierarchy.md) | Every canonical doc declares its authority scope (Authoritative-for header) to prevent goal-redefinition drift |
| [`.claude/rules/dual-implementation-discipline.md`](.claude/rules/dual-implementation-discipline.md) | CC-native and portable fallback delivery channels; when each applies; how to prevent drift between them |
| [`.claude/rules/egress-no-api-bypass.md`](.claude/rules/egress-no-api-bypass.md) | Aif-agent branch egress lands via host `git push` by default (runs the real pre-push gate); Git-Data-API land is break-glass only |
| [`.claude/rules/kickoff-staging-placement.md`](.claude/rules/kickoff-staging-placement.md) | Dispatch-input kickoffs must be merged to staging before `/pipeline`/aif dispatch; edit-time reminder via the rule injector |
| [`.claude/rules/language-discipline.md`](.claude/rules/language-discipline.md) | Internal machinery is English-only; human-facing output is Russian when AIF_HOOK_LANG=ru, else English; match-metadata stays bilingual |
| [`.claude/rules/memory-codification.md`](.claude/rules/memory-codification.md) | Durable behavioural conventions must be codified in the repo; memory is a pointer, not the source of truth |
| [`.claude/rules/no-paid-llm-in-ci.md`](.claude/rules/no-paid-llm-in-ci.md) | No API-billed LLM calls in CI/GH Actions; AI checks run via subscription sessions only |
| [`.claude/rules/parallel-subwave-isolation.md`](.claude/rules/parallel-subwave-isolation.md) | Parallel AI sessions require git worktrees to avoid branch race and shared-workdir contamination |
| [`.claude/rules/phase-research-coverage.md`](.claude/rules/phase-research-coverage.md) | R-phase research must cover all surfaces with file:line evidence; search-coverage 6-item checklist |
| [`.claude/rules/recommendation-laziness-discipline.md`](.claude/rules/recommendation-laziness-discipline.md) | Recommendations need at least one evidence-bearing tool call in the same turn; ambiguous forks route via AskUserQuestion |
| [`.claude/rules/research-source-trust.md`](.claude/rules/research-source-trust.md) | Rule-research provenance is gated by a tiered trust model (builtin / derived / consumer-acked); extend trust via data, not framework source |
| [`.claude/rules/reviewer-discipline.md`](.claude/rules/reviewer-discipline.md) | Reviewer sessions surface decision-needed forks; they do not choose project strategy |
| [`.claude/rules/rule-enforcement-channel-selection.md`](.claude/rules/rule-enforcement-channel-selection.md) | Every rule fails at the earliest reachable channel; CI is the last resort, not the primary gate |
| [`.claude/rules/skill-description-quality.md`](.claude/rules/skill-description-quality.md) | SKILL.md `description`-field quality discipline (deferred Class C); promotion at ≥3 misrouting incidents / 6 months |
| [`.claude/rules/source-before-shape.md`](.claude/rules/source-before-shape.md) | Before creating a capability (skill/agent/module) or scoping a dispatch, read the authoritative source (SSOT/existing skills, or the spec) first as an input to the shape — not a post-hoc trailer; edit-time reminder via the rule injector |

## Key files for contributors

| What | Where |
|---|---|
| Project goal (authoritative) | [README.md#why-this-exists](README.md#why-this-exists) |
| AI-tooling conventions, capability-commit gates | [CLAUDE.md](CLAUDE.md) |
| Session bootstrap + invariants | [.claude/session-bootstrap.md](.claude/session-bootstrap.md) |
| Build-vs-reuse SSOT | [docs/meta-factory/prior-art-evaluations.md](docs/meta-factory/prior-art-evaluations.md) |
| Execution plan | [docs/meta-factory/EXECUTION-PLAN.md](docs/meta-factory/EXECUTION-PLAN.md) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for full contributor details (hook setup, bypass policy, PR strategy).

## Configuration access

<!-- getff:begin section=configuration-access plan=packages/core/composition/fixtures/root-agents-demo.docplan.json -->
_Generated demo region (MT stage 4): fixture conventions rendered from Convention IR; enforcement lines are derived from live RenderOutcomes — see spec §5.1._

### Configuration access

Read configuration through the injected config accessor, never std::env::var directly
<!-- @nodes: no-direct-env-var -->
> Enforced: cargo-clippy-toml ✅, npm-eslint-declarative — FF7001 (typed rules are not expressible in the no-restricted-syntax declarative class; route to a type-aware backend (post-v0))
> Never (fires): fn main() { let _ = std::env::var("HOME"); }
> Always (clean): fn main() { let _ = app_config::env_var("HOME"); }

Read configuration through the injected config accessor, never process.env directly
<!-- @nodes: no-direct-process-env -->
> Enforced: cargo-clippy-toml — FF7001 (not expressible in clippy.toml; route to the ast-grep escape-hatch backend (post-v0)), npm-eslint-declarative ✅
> Never (fires): const url = process.env.DATABASE_URL;
> Always (clean): const url = config.get('databaseUrl');
<!-- getff:end section=configuration-access -->
