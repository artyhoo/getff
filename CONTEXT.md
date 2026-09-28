# CONTEXT — project glossary

> **Authoritative for:** the project term list — what each term means, the operator's raw
> words for it (`_Operator says_:`), and which owner doc a term points at. How it grows:
> when the operator asks what a word means, the agent explains it and, in the same turn,
> adds or extends the entry here. A new spelling of a known term is appended to that
> entry's `_Operator says_:` line without asking and reported in one line; a word that
> seems to mean something else is asked about. One spelling belongs to one entry
> ([spelling-uniqueness test](packages/core/principles/42-context-md-spelling-uniqueness.test.ts)),
> and an entry has one `_Operator says_:` line. The agent never tells the operator to stop
> using their own word. Consumers: the `/wait-what` skill (operator-invoked) and `/arch`
> idea sessions, which run upstream `domain-modeling` with the operator ([reuse spec
> D9](docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md#d9-arch-adopts-mattpocock-domain-modeling-parent-r-4-is-reversed-in-part);
> parent recap-v2 R-4(b) is reversed there in part). The glossary hooks and their learning
> counters are dormant: `glossary-inject.sh` is registered nowhere, and arming it is the
> operator's call (`bash scripts/register-glossary-hook.sh`).
> **NOT authoritative for:** role and dispatch-channel definitions (Orchestrator / Worker /
> Reviewer, Mode A / Mode B) — the owner doc
> [glossary.md](.claude/skills/orchestrator/references/glossary.md) owns those, so this file
> carries only a gist + link for them; the Tier 0/1/2 routing criteria — those live in
> [tier-home.md](packages/core/templates/shared/tier-home.md) and are not the Env tier below;
> the design of these rules — [reuse spec D8](docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md#d8-the-glossary-grows-from-the-operators-questions-spellings-are-mapped-silently).

## Land

**Land**: merge a finished branch or PR into its base branch — for an agent session that is
`staging` (an agent merges its own green PR); promoting `staging` → `main` is a separate
maintainer-owned step with its own hard rules.

_Operator says_: «приземлить», «приземли».

_Avoid_: «merge to main» as an agent action — the promote step is not an agent's call.

## Env tier

**Env tier**: the middle install depth of getff — `--profile env`, the default: core plus
the operator working contour, without the aif runtime; `factory` is the depth above it. The
depths are listed in [Install depth profiles](INSTALL-FOR-AI.md#install-depth-profiles---profile-core--env--factory).
Not the Tier 0/1/2 task routing.

_Operator says_: «энв-тир», «энв тир».

## Vendor

**Vendor**: copy a subset of upstream code into this repo's tree instead of adding a
dependency. A vendor copy is still a capability decision and rides the same consult gate —
byte-identity with an already-tracked blob is the only form that rides free.

_Operator says_: «вендорить», «вендерить», «ведерить».

## Chips

**Chips**: a card-button in the Claude app that carries a task prompt; clicking it opens a
new, separate agent session with that prompt as its first message. Skills emit them through
`spawn_task` — `/pipeline` one per stage, `/arch` one per routed next action; the contract is
[output-format.md §9](.claude/skills/pipeline/references/output-format.md#9-dispatch-chips-adr-d1d2).

_Operator says_: «чипы», «чип».

## Depth

**Depth**: how many levels of delegation may be nested — the hard limit is depth 2
(Orchestrator → Worker, and a Worker never spawns Workers). The role definitions live in
the owner doc: [Three roles](.claude/skills/orchestrator/references/glossary.md#three-roles).

_Operator says_: «глубина».

## Red

**Red**: a gate or test failing (GREEN = passing). A RED is a finding to triage, not noise —
prove it against the pristine baseline before attributing it to a diff.

_Operator says_: «красное».

## Harvest

**Harvest**: take a finished aif-agent branch and egress it into a PR after acceptance; the
[harvest skill](.claude/skills/harvest/SKILL.md) owns the flow and is operator-invoked.

_Operator says_: harvest, «харвест», «хервест», «хеверст», «херверс».

## Egress

**Egress**: any outbound path from a session to the outside world — git push, `gh`, npm,
API calls. Container seats run on a measured egress map, and the
[egress rule](.claude/rules/egress-no-api-bypass.md) owns the no-API-bypass discipline.

_Operator says_: egress, «эгресс».

## Handoff

**Handoff**: the coordinator flow that hands a prepared worktree, branch and task to an
autonomous agent session (`HANDOFF_MODE=1`). A handoff session never switches branches and
never rebases or force-pushes.

_Operator says_: handoff, «хендофф», «хэндофф».

## One button

**One button**: one agent session gives a project a complete install — getff, the passport,
skills and MCP servers, rule research, generated rules with their firing tests — with no second
human prompt to continue. It is one session, not one shell command; the human may
still answer questions inside it. Owner: the [one-button chain spec](docs/superpowers/specs/2026-09-28-one-button-chain-design.md);
the «one beat» decision it builds on is D1 of the [any-stack closure spec](docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md).

_Operator says_: «одна кнопка», «одной кнопкой», «от и до», «под ключ».

## Passport

**Passport**: the human's intent as the one button leaves it — purpose, what must never happen,
and hard constraints — kept in one getff-owned source and shown in the project's description file
and agent guide as copies of that source. The stack is not repeated there: the description file
points at the project manifest. A line stays only if only the human knows it and no check can
express it; the agent proposes every line from repo evidence and the human only confirms or
corrects. Owner: the
[one-button chain spec](docs/superpowers/specs/2026-09-28-one-button-chain-design.md) §4.3.

_Operator says_: «паспорт», «проекта паспорт».

## Complete install

**Complete install**: the state the one button must reach. Every part it installs is in place and
proven by the final check: getff, the passport, the accepted skills and MCP servers, rule research,
and generated rules that each prove themselves with their test. A part the human declined, or an
optional one that does not apply to the stack, is named as such and never counted as done, yet does
not block completeness; a part the stack's lane has not built yet does. The installer's exit code
never counts. A green project is one condition of it. Owner: the
[one-button chain spec](docs/superpowers/specs/2026-09-28-one-button-chain-design.md) §4.4.

_Operator says_: «установка всего с одной кнопки».

## Green project

**Green project**: one condition of a complete install, not the goal by itself — a project can be
green while a tool it needs is missing. The project's own checks pass; every generated rule fires
on its bad example and stays silent on its good one, both in getff's own proof and through the
project's real checks; and the rules lock exists and matches. Zero new rules can still be green when the
report explains why. Owner: the [one-button chain spec](docs/superpowers/specs/2026-09-28-one-button-chain-design.md) §4.4.

_Operator says_: «стать зеленым после установки».

## Lane

**Lane**: the part of getff that knows one stack, plugged into the one button through one contract:
how the stack is recognised, installed and hooked, which dependencies it reads, how rules are
rendered and proven on it, and which checks make it green. The one button itself names no stack. The npm lanes are the first ones built to the contract;
the python, rust and go lanes are alpha. Owner: the
[one-button chain spec](docs/superpowers/specs/2026-09-28-one-button-chain-design.md) §4.5.

_Operator says_: «под любой стек».
