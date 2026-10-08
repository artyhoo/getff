# Base core: every principle and whether it fires in this project

> **Authoritative for:** the shipped status of each base-core principle — does it fire in a project that
> installed getff, and if not, why. The install report reads this table.
> **NOT authoritative for:** the principles' full wording and sources — the base-core inventory in the getff
> repository; project goal — see your project's own `README.md`. Per-layer patterns — see [overview.md](overview.md).

## Contents

- [How to read the table](#how-to-read-the-table)
- [The table](#the-table)
- [The lint plugin](#the-lint-plugin)

## How to read the table

A **principle** holds on any stack. A row's **status** is what this getff release delivers by default, decided by
the row's primary trigger (the first one the inventory lists):

<!-- prettier-ignore -->
| status | meaning | reason codes |
|---|---|---|
| `fires` | the primary trigger's carrier is installed and runs with nothing else to do | `—`; `conditional` = fires once the project has the surface it guards |
| `partial` | the carrier is installed and runs, with a known gap | `gap-named` |
| `not_wired` | nothing fires by default | `opt-in` (installed, off by default) · `generated-pending` (fires once the project's own rule for it, or a plugin rule below, is placed and proven) · `trigger-to-build` · `rule-file-not-shipped` · `always-on-set-not-built` |

`fires` for a row whose carrier is a skill or agent file means the skill ships and a command starts it, not that
the principle is enforced by a check.

Carrier paths are paths in your project. `—` means nothing is delivered for that row yet.

The status is measured on a react-spa install. **not on stack** names the stacks where the row's claim does not
hold: a carrier is not installed there, or the stack's lint config does not switch the plugin rule on. On those
stacks read the row as `not_wired`.

## The table

<!-- prettier-ignore -->
| id | principle | primary trigger | status | reason | carrier in the project | plugin rule | not on stack |
|---|---|---|---|---|---|---|---|
| A1 | Every rule has an executable check | check | `partial` | gap-named | `scripts/check-rule-enforced.sh` | — | cargo,go,python |
| A2 | Every check has a paired negative | check | `not_wired` | trigger-to-build | — | — | — |
| A3 | A check that cannot fail proves nothing | file | `not_wired` | rule-file-not-shipped | — | — | — |
| A4 | Check structure, not text | skill | `fires` | — | `.claude/skills/rule-research/SKILL.md` | — | — |
| A5 | MUST is never demoted to should | check | `not_wired` | trigger-to-build | — | — | — |
| A6 | Earliest reachable channel | file | `not_wired` | rule-file-not-shipped | — | — | — |
| A7 | Gate what a machine can detect | skill | `not_wired` | trigger-to-build | — | — | — |
| A8 | Nobody's attention is a check | file | `not_wired` | rule-file-not-shipped | — | — | — |
| A9 | Every check actually runs | check | `partial` | gap-named | `scripts/check-shields-up.sh`, `.github/workflows/workflow-integrity.yml` | — | cargo,go,python |
| A10 | No bypass | event | `not_wired` | trigger-to-build | — | — | — |
| A11 | A rule states its reason | check | `not_wired` | trigger-to-build | — | — | — |
| A12 | Every fixed bug gets a regression test that fails on the old … | check | `not_wired` | trigger-to-build | — | — | — |
| A13 | The rules apply to the project's own tooling too | check | `not_wired` | trigger-to-build | — | — | — |
| A15 | Fail closed | file | `not_wired` | rule-file-not-shipped | — | — | — |
| A16 | Every reference resolves | check | `fires` | — | `scripts/check-rule-globs.sh`, `scripts/check-lintstaged-resolves.sh`, `scripts/check-arch-boundaries.sh` | — | cargo,go,python |
| A17 | The rule list learns | check | `not_wired` | trigger-to-build | — | — | — |
| A18 | Forward-check | skill | `not_wired` | trigger-to-build | — | — | — |
| A20 | A failing check says what is wrong, where, and how to fix it | skill | `not_wired` | trigger-to-build | — | — | — |
| B1 | Architecture tests | check | `not_wired` | generated-pending | — | — | — |
| B2 | Meta-tests | check | `partial` | gap-named | `scripts/audit-r4.ts` | — | cargo,go,python |
| B3 | Specification by example | file | `not_wired` | rule-file-not-shipped | — | — | — |
| B4 | Mutation testing on the changed lines, with a stated kill … | check | `partial` | gap-named | `stryker.config.json` | — | cargo,go,python |
| B5 | Living documentation | check | `partial` | gap-named | `scripts/audit-ai-docs.sh` | — | python |
| B6 | Extensions where the project has the surface | skill | `fires` | conditional | `.claude/skills/tool-bootstrapping/SKILL.md` | — | — |
| B7 | Lint hygiene | check | `not_wired` | generated-pending | — | — | — |
| B8 | Every change is reviewed before merge by a seat that did not … | event | `not_wired` | trigger-to-build | — | — | — |
| C2 | One source of truth per fact | check | `partial` | gap-named | `scripts/audit-ai-docs.sh` | — | python |
| C3 | An authority-bearing doc states what it owns and what it … | check | `fires` | — | `.claude/hooks/check-doc-authority-header.sh` | — | cargo,go,python |
| C4 | Agent guides state known-true facts and point at enforced rules | file | `not_wired` | rule-file-not-shipped | — | — | — |
| C5 | Files an agent reads fit its budget | check | `not_wired` | trigger-to-build | — | — | — |
| C6 | Hot and cold | check | `not_wired` | trigger-to-build | — | — | — |
| C7 | Skill descriptions are precise, and two skills never claim … | file | `not_wired` | rule-file-not-shipped | — | — | — |
| C8 | Durable conventions go into the repo as a rule with a check … | event | `fires` | — | `.claude/hooks/inject-memory-codification.sh` | — | cargo,go,python |
| C9 | Internal machinery in English | event | `not_wired` | opt-in | `.claude/hooks/inject-output-language.sh` | — | cargo,go,python |
| C10 | The operator's own words are kept in a glossary, one … | event | `fires` | conditional | `.claude/hooks/end-of-turn-reminder.sh` | — | cargo,go,python |
| C11 | Docs, rules and research carry a date and are re-checked … | check | `not_wired` | trigger-to-build | — | — | — |
| C12 | A doc changes in the same change as the code it describes | check | `partial` | gap-named | `scripts/audit-ai-docs.sh` | — | python |
| C13 | Frozen and append-only records are not rewritten | check | `not_wired` | trigger-to-build | — | — | — |
| C14 | A capability that does not ship is named with an owner and a … | check | `not_wired` | trigger-to-build | — | — | — |
| C15 | Config holds no TODO; stale working files are archived | check | `not_wired` | trigger-to-build | — | — | — |
| C17 | The goal is stated once | always-on | `not_wired` | trigger-to-build | — | — | — |
| D1 | Do not reinvent the wheel | check | `not_wired` | trigger-to-build | — | — | — |
| D2 | Adapt before writing new | event | `not_wired` | trigger-to-build | — | — | — |
| D3 | Upstream evidence transfers only when the problem is the … | skill | `not_wired` | trigger-to-build | — | — | — |
| D4 | A «nothing exists» claim needs a full search | event | `not_wired` | trigger-to-build | — | — | — |
| D5 | Read the source before shaping | file | `not_wired` | rule-file-not-shipped | — | — | — |
| D6 | Rules, principles, patterns and anti-patterns come from the … | skill | `fires` | — | `.claude/skills/rule-research/SKILL.md` | — | — |
| D7 | Trusted sources only | skill | `fires` | — | `.claude/agents/rule-researcher.md` | — | — |
| D8 | Research runs as needed | event | `partial` | gap-named | `.claude/hooks/deps-hash-check.sh` | — | — |
| D9 | Facts, versions and state come from their source now — the … | always-on | `not_wired` | always-on-set-not-built | — | — | — |
| D10 | Every number and limit cites its source | check | `not_wired` | trigger-to-build | — | — | — |
| D11 | A tool is installed by its own official installer, … | event | `not_wired` | trigger-to-build | — | — | — |
| D12 | CI is deterministic | check | `partial` | gap-named | `packages/core/hooks/pre-push.bundle.mjs` | — | cargo,go,python |
| D13 | A decided call is not re-argued without new evidence | file | `not_wired` | rule-file-not-shipped | — | — | — |
| D14 | Before starting, look for the same work already in flight … | event | `not_wired` | trigger-to-build | — | — | — |
| E1 | The stopping point is an external check passing, not «I'm done» | event | `not_wired` | trigger-to-build | — | — | — |
| E2 | No verdict without evidence in the same turn | always-on | `not_wired` | always-on-set-not-built | — | — | — |
| E3 | Enumerate the whole population before sampling | skill | `partial` | gap-named | `.claude/agents/claims-conformance-auditor.md` | — | cargo,go,python |
| E5 | Cover every declared section, then ask «what category did I … | skill | `not_wired` | trigger-to-build | — | — | — |
| E8 | Preserve before destroying | event | `not_wired` | trigger-to-build | — | — | — |
| E10 | A reviewer surfaces a decision and never picks the strategy | skill | `fires` | — | `.claude/skills/reviewer/SKILL.md` | — | cargo,go,python |
| E11 | Prove it where it runs | check | `not_wired` | trigger-to-build | — | — | — |
| E12 | Effort follows reversibility | skill | `fires` | — | `.claude/skills/arch/SKILL.md` | — | cargo,go,python |
| E13 | A finding opens a new review round only with a concrete … | skill | `fires` | — | `.claude/skills/reviewer/SKILL.md` | — | cargo,go,python |
| F1 | Ask only a real fork | event | `fires` | — | `.claude/hooks/ask-question-reminder.sh` | — | cargo,go,python |
| F2 | Every question carries a recommendation and its main reason | event | `not_wired` | trigger-to-build | — | — | — |
| F4 | No silent forks | event | `fires` | — | `.claude/hooks/end-of-turn-reminder.sh` | — | cargo,go,python |
| F5 | A turn that ends with a long answer or with a question … | event | `fires` | — | `.claude/hooks/end-of-turn-reminder.sh` | — | cargo,go,python |
| F6 | A manual human step is a defect | event | `partial` | gap-named | `.claude/hooks/lang/en.sh` | — | cargo,go,python |
| F7 | An unattended agent does not stop while work remains just … | event | `not_wired` | opt-in | `.claude/hooks/end-of-turn-reminder.sh` | — | cargo,go,python |
| F8 | Answers are short | event | `partial` | gap-named | `.claude/hooks/end-of-turn-reminder.sh` | — | cargo,go,python |
| F9 | Forks — including forks a review raises (B8) — and loosening … | event | `not_wired` | trigger-to-build | — | — | — |
| G1 | Do exactly the task that was asked, nothing on the side | always-on | `not_wired` | always-on-set-not-built | — | — | — |
| G2 | Each artifact has one owner | file | `not_wired` | rule-file-not-shipped | — | — | — |
| G3 | Git for agents | event | `not_wired` | trigger-to-build | — | — | — |
| G4 | Parallel agents work in isolated worktrees, never in one … | event | `not_wired` | trigger-to-build | — | — | — |
| G5 | Tests are isolated | check | `not_wired` | trigger-to-build | — | — | — |
| G6 | Evidence is pasted from a fresh run of the exact commit, … | event | `not_wired` | trigger-to-build | — | — | — |
| G7 | Nothing load-bearing lives only in a session's memory | event | `not_wired` | opt-in | `.claude/hooks/end-of-turn-reminder.sh` | — | cargo,go,python |
| H1 | Do not bypass the type system | check | `not_wired` | generated-pending | — | — | — |
| H2 | No new convenience dependency where the project standardised … | check | `not_wired` | generated-pending | — | — | — |
| H3 | No layer violations and no cycles | check | `not_wired` | generated-pending | — | — | — |
| H4 | No unawaited async work | check | `not_wired` | generated-pending | — | — | — |
| H5 | No direct time, randomness or network in production code … | check | `not_wired` | opt-in | `eslint.config.mjs`, `eslint-rules-local/no-direct-time-randomness.mjs` | `no-direct-time-randomness` | cargo,go,python, react-native |
| H6 | No public API inflation | check | `not_wired` | trigger-to-build | — | — | — |
| H7 | No global mutable state | check | `not_wired` | generated-pending | — | `restricted-syntax-audit-exempt` | — |
| H8 | Errors are handled, not hidden | check | `partial` | gap-named | `eslint.config.mjs`, `eslint-rules-local/require-error-boundary.mjs` | `require-error-boundary` | cargo,go,python, react-native |
| H9 | Operations leave a trace | check | `not_wired` | opt-in | `eslint.config.mjs`, `eslint-rules-local/require-otel-span.mjs` | `require-otel-span` | cargo,go,python, react-native |
| H10 | Names follow the project's stated convention | check | `not_wired` | generated-pending | — | — | — |
| H11 | A UI is accessible | check | `not_wired` | generated-pending | — | — | — |
| H12 | No dead code | check | `not_wired` | trigger-to-build | — | — | — |
| I1 | Input from outside the process is validated at the boundary … | check | `fires` | conditional | `eslint.config.mjs`, `eslint-rules-local/no-unsafe-zod-parse.mjs` | `no-unsafe-zod-parse` | cargo,go,python, react-native |
| I2 | No dependency with a known high-severity vulnerability | check | `partial` | gap-named | `.github/workflows/ci.yml` | — | cargo,go,python |
| I3 | No secret in a commit | check | `partial` | gap-named | `.github/workflows/ci.yml` | — | cargo,go,python |
| I4 | A critical security rule is a check, not only text | check | `not_wired` | generated-pending | — | `restricted-syntax-audit-exempt` | — |
| I5 | A path from outside is resolved and confined | check | `not_wired` | generated-pending | — | — | — |
| I6 | A new dependency is verified before it is installed | event | `not_wired` | trigger-to-build | — | — | — |
| I7 | Text from files, web pages, tool output, issues and PRs is … | always-on | `not_wired` | always-on-set-not-built | — | — | — |
| J1 | The project's tooling — hooks, scripts, checks — works on … | check | `not_wired` | trigger-to-build | — | — | — |
| J2 | A capability is detected by its presence, never by a version … | file | `not_wired` | rule-file-not-shipped | — | — | — |

Totals: fires 15, partial 15, not_wired 70 (trigger-to-build 39, generated-pending 11, rule-file-not-shipped 11, always-on-set-not-built 4, opt-in 5).

## The lint plugin

`eslint-rules-local/index.mjs` is getff's own lint plugin in ESLint format. It loads in ESLint and, through
`jsPlugins`, in oxlint, with no package installed: every rule file it imports, the react-next preset rules
included, needs nothing at run time. It holds only code rules no linter ships ready-made; none of them needs the
type checker. Every stack gets every rule file; the stack's shipped lint config decides which are switched on
(`no-unsafe-zod-parse` by default on ts-server, react-spa and react-next; `require-error-boundary` on react-spa;
`no-direct-time-randomness` and `require-otel-span` only with `AIF_STRICT_RUNTIME=1`).

<!-- prettier-ignore -->
| Rule | Principle | What it catches |
|---|---|---|
| `no-direct-time-randomness` | H5 | `Date.now()`, `new Date()`, `Math.random()` and direct `fs` / `http` imports outside `infrastructure/` |
| `restricted-syntax-audit-exempt` | H7, I4, every generated selector rule | the selectors you give it; a line carrying `audit:exempt` is skipped |
| `require-error-boundary` | H8 (UI half) | an app-root file that renders without an `ErrorBoundary` |
| `require-otel-span` | H9 | an exported async handler that opens no trace span |
| `no-unsafe-zod-parse` | I1 | a Zod `.parse()` in an HTTP boundary file where `.safeParse()` is required |

The other halves use rules your linter already has: H5 `no-restricted-properties` (`Date.now`, `Math.random`) and
`no-restricted-imports`; H8 `no-throw-literal` and `no-empty`. Biome loads GritQL plugins only, so on a Biome
project these rows stay `generated-pending`.
