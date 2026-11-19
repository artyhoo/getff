# Prior art — hybrid PR feedback and correction

> **Date:** 2026-10-06 (Europe/Moscow).
> **Authoritative for:** the scope, sources and provisional recommendations of this research.
> **NOT authoritative for:** project goals, adoption approval, deployed capability, account entitlement or merge admission; see [README](../../README.md#why-this-exists) and the [dot-review handoff](dot-review-handoff.md).

## Intent and evidence boundary

The operator selected a hybrid: each executor monitors and corrects its own PR; a coordinator detects stalled work, resumes an executor or assigns a replacement. A separate AI reviewer checks implementation and test quality; Dot/Astra reviews the system and the adequacy of prior review. AIF is not mandatory or selected.

This is primary-source research, not a runtime trial or exhaustive product audit. Public web documentation and read-only gh requests were used. No candidate was installed, no repository code was executed, and no PR comment, schedule, provider configuration or billing setting was changed. Two research subagents gathered companion/external evidence; selected material claims were independently checked before consolidation.

Free software, included subscription inference, free hosting and unlimited capacity are different claims. Account entitlement and month-long sustainability remain unverified.

## Candidate comparison

| Candidate | Verified/documented useful surface | Scope boundary | Preliminary disposition |
| --- | --- | --- | --- |
| Native ChatGPT/Codex | GitHub event tasks, PR-context cloud fixes, same-chat scheduled follow-ups, Dot task coordination | Surface/plan restrictions; arbitrary existing cloud-session continuation not established | Evaluate first against the actual account |
| Agent Orchestrator | PR-owner feedback delivery, deduplication, separate reviewer runs, worker/orchestrator sessions, restore and claims | Existing desktop-thread adoption and safe automatic replacement untested | Strong external runtime candidate |
| AIF Handoff | Persistent tasks, software coordinator, ownership, watchdog, implementation/review/rework stages | External Dot intake and existing-session mapping untested | Strong companion runtime candidate; optional |
| AI Factory | Resumable skill workflow and structured gate results | Skill protocol is distinct from a running coordinator | Reuse result-contract ideas |
| Superpowers | Independent task review, ledger, bounded repair and scoped re-review | In-session instructions, not proof of an always-on service | Reuse review/closure protocol |
| OmO | Durable mailbox wake, deduplication, recipient validation and recovery leases | Harness/edition differences; Sustainable Use license | Design reference |
| OpenHands Agent Canvas | Local/self-hosted multi-agent execution, automations, subscription-backed ACP harnesses | More infrastructure; our ownership/closure contract untested | Alternate runtime candidate |
| Devin | Owner-directed autofix, allowed review bots, review-spend limits | Paid/limited entitlements; not a free monthly operating guarantee | Design inspiration |

## Native OpenAI capabilities

Official documentation supports GitHub PR-event tasks on eligible plans through web/mobile, including reviews, comments and commit updates. These event triggers are not available in the desktop app, CLI or IDE extension. Same-chat scheduled follow-ups preserve conversation context. Local project schedules require the machine and app to remain running; web schedules do not preserve local worktrees. [Scheduled tasks](https://learn.chatgpt.com/docs/automations).

The GitHub integration documents `@codex` fix requests starting a cloud task with PR context, with branch push subject to permissions. This is a launch primitive, not proof that arbitrary bot-generated mentions form a working unattended loop. GitHub Code Review is focused on P0/P1 findings; it is not by itself evidence of the full specialist test-quality scope we need. [GitHub integration](https://learn.chatgpt.com/docs/third-party/github).

Dots can coordinate their tasks and create coding tasks in an already-configured cloud environment without a local computer. Existing local Codex tasks require a connected computer; task/conversation visibility is not universal. This supports a native coordinator candidate, but does not establish access to every current executor session. [Tasks and memory](https://learn.chatgpt.com/docs/dots/tasks-and-memory).

Codex app-server documents stored-thread resume, starting turns and account-limit telemetry. This is an official low-level integration option if built-in task routing is insufficient; it does not by itself deliver PR ownership or finding closure. [App-server](https://learn.chatgpt.com/docs/app-server). Participating open-source integrations can request eligible ChatGPT plan usage without an API key through the documented sign-in flow. [Official integration example](https://developers.openai.com/cookbook/articles/sign-in-with-chatgpt).

Work and Codex share usage; subscription inference and API-key billing are separate. GitHub reviews use the Code Review allowance, while other review routes use general usage. Dot conversations do not count toward ChatGPT usage limits, but deeper work has an allowance and tasks in Work/Codex use their ordinary limits. This is not unlimited coordination/review/fixing. [Pricing](https://learn.chatgpt.com/docs/pricing), [Dot availability and allowances](https://learn.chatgpt.com/docs/dots).

Historical source: OpenAI's repository-local `babysit-pr` skill watched published PR feedback and CI, fixed appropriate branch defects and bounded flaky retries. Read at [5e96aabd](https://github.com/openai/codex/blob/5e96aabd68dc6194f5ad928cb7f5d0bc71b72df9/.codex/skills/babysit-pr/SKILL.md). It prescribed a continuously active monitoring turn and permitted some executor-side thread resolution; both need adaptation to our resource and independent-closure requirements. It is NOT a current bundled offering: [18131270](https://github.com/openai/codex/commit/18131270fe82ef947830840eb5d6923d4b82609f), dated 2026-09-30, removed repository-local guidance/skills/config. At main `7c2ce90716335c889a5076ded9a630459f9c9899`, the skill/watcher paths were absent from the recursive tree. Search snippets were stale.

## Companions

AIF Handoff, pinned at `3d982ef344aaa2fb72f99d5603a1fea0051206ea`, is distinct from AI Factory. Its [coordinator](https://github.com/lee-to/aif-handoff/blob/3d982ef344aaa2fb72f99d5603a1fea0051206ea/packages/agent/src/coordinator.ts) has claims and actual rework transitions; its [watchdog](https://github.com/lee-to/aif-handoff/blob/3d982ef344aaa2fb72f99d5603a1fea0051206ea/packages/agent/src/taskWatchdog.ts) checks stalled activity. The code is [MIT](https://github.com/lee-to/aif-handoff/blob/3d982ef344aaa2fb72f99d5603a1fea0051206ea/LICENSE). Its [provider documentation](https://github.com/lee-to/aif-handoff/blob/3d982ef344aaa2fb72f99d5603a1fea0051206ea/docs/providers.md) distinguishes transports, resume/discovery and quota observability. A subscription-backed Codex route is a candidate; selected source is not a cost or reliability certification.

AI Factory's live default branch is **2.x**, pinned `ac92bebd9bfef0f326c8581b77b29f74997e797c`; main exposes older material. [Quality gates](https://github.com/lee-to/ai-factory/blob/ac92bebd9bfef0f326c8581b77b29f74997e797c/docs/quality-gates.md) separate human-readable reporting from final structured JSON. [Loop documentation](https://github.com/lee-to/ai-factory/blob/ac92bebd9bfef0f326c8581b77b29f74997e797c/docs/loop.md) describes resumable artifacts and bounds, not an external wake service.

Superpowers, pinned `8ca22dba9a94f28898bbce59f2537ff4d87c747d`, supplies [task review, a ledger and scoped repair/re-review](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/subagent-driven-development/SKILL.md). Reusing these practices can preserve reviewer independence without inventing another methodology. Its handling of deferred findings must be reconciled with our admission policy; deferred blockers do not become fixed.

OmO, pinned `becbd1dc6c4569fb1cf33113ca384a81be1a82b5`, has [mailbox fallback wake](https://github.com/code-yeongyu/oh-my-openagent/blob/becbd1dc6c4569fb1cf33113ca384a81be1a82b5/packages/omo-opencode/src/features/team-mode/tools/messaging-fallback-wake.ts) with message deduplication, durable retry and current-recipient checks. Current Senpi/OpenCode editions are not interchangeable. Its [Sustainable Use license](https://github.com/code-yeongyu/oh-my-openagent/blob/becbd1dc6c4569fb1cf33113ca384a81be1a82b5/LICENSE.md) is not MIT. Treat wake/lease behavior as design precedent; code adoption and provider routing require separate assessment.

Already available local protocol references: the mbp plugin's `ci-feedback-loop` and `fix-then-re-review-ladder` skills (installed locally under the operator's plugin cache, `pfeff/mbp`; not linked — local-only paths). They describe bounded remediation, revision-bound review and a single fixer; they are not proof of a deployed coordinator. Their interactive triage, rebase and final acceptance defaults require reconciliation with the operator's autonomy and repository merge-forward rules. Neither was invoked to execute repairs.

## External foundations and paid inspiration

Agent Orchestrator now lives at OrchestratorInc; old Composio-era YAML/plugin instructions should not be assumed current. [Review-loop docs](https://docs.orchestrator.inc/guides/review-loop/) describe delivery of changed unresolved feedback to the PR-owning worker, signature deduplication and separate review agents. [CLI docs](https://docs.orchestrator.inc/cli/) expose worker/orchestrator creation, session restore and PR claims with no-takeover. [Codex adapter](https://docs.orchestrator.inc/plugins/agents/codex/) uses installed Codex and Codex-owned authentication, persisting provider identity for Chat. [Apache-2.0 license](https://github.com/OrchestratorInc/agent-orchestrator/blob/main/LICENSE). Local operation avoids a new software license fee; inference limits and host availability still apply. Adoption of arbitrary current desktop chats and independent Dot closure remain untested.

OpenHands [Agent Canvas](https://www.openhands.dev/product/canvas) offers local/self-managed execution, automations and existing Codex/Claude subscriptions through ACP. Its repository is [MIT](https://github.com/OpenHands/OpenHands/blob/main/LICENSE); managed cloud is a distinct option. This is a broader alternative, with safe replacement/closure under our contract still unverified.

Devin's [review documentation](https://docs.devin.ai/work-with-devin/devin-review) describes feedback to an owning running session, bot allowlisting and per-PR auto-review spend limits. [Current pricing](https://devin.ai/pricing) describes a light Free quota and paid cloud-agent access. Reuse the owner-first routing, actionable-only triggers and aggregate limits as inspiration; do not treat a promotion or free tier as proof of sustained free autonomous fixing.

## Proposed next step, not adoption approval

First test the native route's actual event availability and task ownership/resume behavior in the user's account. If insufficient, compare AO and AIF Handoff against the same narrow acceptance cycle: trusted finding -> current owner -> acknowledgement -> fix revision -> mechanical checks -> independent specialist review -> Dot closure. Include duplicate delivery and an unavailable executor. Explicitly decide which host is responsible for the always-on observer; Dot need not access the local machine.

Keep the finding/admission contract portable across execution backends. Existing #2055/#2056 work should be adapted after runtime selection; this research does not authorize deployment or certify either PR.

Scope coverage: own-stack companions and installed skills, native agent harness capabilities, open-source orchestration/control planes and a commercial PR feedback loop were considered. There is no exhaustive negative-existence claim. Research adds evidence only; no new enforcement convention, dependency or consumer requirement was introduced. Future implementation needs a source-pinned trial and its own build-vs-reuse/consumer assessment.
