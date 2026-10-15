# Deterministic core — complete planning coverage

> **Status:** whole-core planning map; sequence accepted on 2026-10-15, not implementation or activation evidence.
> **Authoritative for:** the initial coverage-to-workstream map of the deterministic-core design.
> **NOT authoritative for:** normative principle wording, current runtime health, installation profiles or implementation permission.

Owner: [technical design](./2026-10-14-deterministic-core-design.md). Baseline: `80196f2f9e3546ceffa00c0cb362903d1eebaebe`. Existing audit ledgers remain the source of detailed operation candidates; this map adds sequencing rather than a runtime registry.

Every existing base-core ID has exactly one primary workstream below. Cross-cutting assurance, input validation and delivery apply in every workstream. Assignment is a planning allocation for addressing mechanical residue, not a verdict that an entire principle is mechanically decidable. A `not_wired` value is the dated consumer-table status, not proof that no internal implementation exists.

## Workstreams and order

| Stage | Outcome | Depends on | Completion boundary |
| --- | --- | --- | --- |
| F0 | Reuse the existing Test Assurance Kernel; pin complete population, selected assurance obligations and the new simplicity principle | Existing TAK S1/S2 evidence reconciled to the actual execution base | Selected mechanism can be checked by an independent fixed oracle; full remaining assurance obligations stay mapped to TAK, without duplicating its campaign |
| F1 | Make invocation, target binding, actual execution, completeness and result preservation mechanical at existing family seams | F0 for the selected family | Living-docs-auditor vertical slice, then rule-tests verification as a deliberately different second caller; share only proven common mechanics |
| F2 | Mechanize inventories, coverage arithmetic, evidence binding, report validation/rendering and already-authorized artifact writes | F1 patterns where applicable | Each role retains its own semantic judgment, cold-input contract and verdict vocabulary; actual caller accepts only applicable results |
| F3 | Connect compact entries, narrow triggers, dependency closure and delivery/activation evidence | F1/F2 contracts | Supported profile/harness matrix has actual positive/negative invocation evidence; unavailable paths remain explicit |
| F4 | Close remaining deterministic rule/check/template gaps in the core and expose reusable mechanisms to generated project artifacts | F0 assurance; F3 channels | Each admitted obligation has an executable carrier or an explicitly separated judgment residue; per-stack generation remains at existing owners |
| F5 | Mechanize research/reuse bookkeeping, source identity, freshness, prerequisite discovery and installer receipts | F1/F2; existing provenance owners | Known acquisition/validation operations run mechanically; source relevance and adoption decisions remain judgment |
| F6 | Mechanize admitted transitions/counters/receipts in workflow and optional operator suite | F1–F3; existing intent/runtime owners | Authorization and exact-content gates preserved; no operator-only machinery silently becomes default consumer payload |
| F7 | Reconcile full coverage and measured outcomes | Completion evidence from each admitted workstream | All mechanical obligations accounted for, residuals visible, no clean claim over incomplete scope; later additions re-enter their existing owner |

F0/F1 are the selected first sequence (operator P17/P18). Scoped F0 assurance accompanies F1; it does not require waiting for the entire TAK campaign. F2–F6 are ordered by dependency and useful outcome, not a requirement to finish an entire stage globally before advancing a ready family. Delivery is part of every increment; F3 closes cross-family/harness gaps rather than postponing all shipping. F4/F5 may proceed independently where prerequisites are met. F6 is a separate scope lane, not a dependency of consumer use. F7 reconciliation runs at checkpoints as well as at overall closure.

The 100 existing IDs are preserved. The accepted additional simplicity principle is planned in F0; its canonical ID is allocated with the actual inventory owner before implementation. Thus this is a 100-ID existing population plus one accepted new principle, not a claim that the live inventory already contains 101.

## All 100 existing base-core principles

Normative text and source links: [base-core-index.json](../../meta-factory/research-patches/2026-10-14-deterministic-skill-agent-audit/base-core-index.json). Labels below are abbreviations; they cannot amend the original wording.

| ID | Short label | Dated consumer status | Primary stage |
| --- | --- | --- | --- |
| A1 | Every rule has an executable check | partial | F0 |
| A2 | Every check has a paired negative | not_wired | F0 |
| A3 | A check that cannot fail proves nothing | not_wired | F0 |
| A4 | Check structure, not text | fires | F4 |
| A5 | MUST is never demoted to should | not_wired | F4 |
| A6 | Earliest reachable channel | not_wired | F3 |
| A7 | Gate what a machine can detect | not_wired | F3 |
| A8 | Nobody's attention is a check. The human checks nothing — people forget, get tired, or do not see… | not_wired | F2 |
| A9 | Every check actually runs | partial | F3 |
| A10 | No bypass. The agent cannot skip, disable or weaken a check on its own | not_wired | F4 |
| A11 | A rule states its reason | not_wired | F4 |
| A12 | Every fixed bug gets a regression test that fails on the old code | not_wired | F0 |
| A13 | The rules apply to the project's own tooling too | not_wired | F0 |
| A15 | Fail closed | not_wired | F1 |
| A16 | Every reference resolves | fires | F3 |
| A17 | The rule list learns | not_wired | F4 |
| A18 | Forward-check | not_wired | F4 |
| A20 | A failing check says what is wrong, where, and how to fix it | not_wired | F1 |
| B1 | Architecture tests | not_wired | F4 |
| B2 | Meta-tests | partial | F0 |
| B3 | Specification by example | not_wired | F0 |
| B4 | Mutation testing on the changed lines, with a stated kill threshold | partial | F0 |
| B5 | Living documentation | partial | F4 |
| B6 | Extensions where the project has the surface | fires | F4 |
| B7 | Lint hygiene | not_wired | F4 |
| B8 | Every change is reviewed before merge by a seat that did not write it. The author first checks it… | not_wired | F6 |
| C2 | One source of truth per fact | partial | F2 |
| C3 | An authority-bearing doc states what it owns and what it does not | fires | F2 |
| C4 | Agent guides state known-true facts and point at enforced rules | not_wired | F3 |
| C5 | Files an agent reads fit its budget | not_wired | F3 |
| C6 | Hot and cold | not_wired | F3 |
| C7 | Skill descriptions are precise, and two skills never claim the same job | not_wired | F3 |
| C8 | Durable conventions go into the repo as a rule with a check — not into agent memory, and not as p… | fires | F3 |
| C9 | Internal machinery in English | not_wired | F3 |
| C10 | The operator's own words are kept in a glossary, one spelling per entry | fires | F3 |
| C11 | Docs, rules and research carry a date and are re-checked when their source changes | not_wired | F2 |
| C12 | A doc changes in the same change as the code it describes | partial | F3 |
| C13 | Frozen and append-only records are not rewritten | not_wired | F2 |
| C14 | A capability that does not ship is named with an owner and a trigger, never described as if it ex… | not_wired | F2 |
| C15 | Config holds no TODO | not_wired | F2 |
| C17 | The goal is stated once | not_wired | F3 |
| D1 | Do not reinvent the wheel | not_wired | F5 |
| D2 | Adapt before writing new | not_wired | F5 |
| D3 | Upstream evidence transfers only when the problem is the same class | not_wired | F5 |
| D4 | A «nothing exists» claim needs a full search | not_wired | F5 |
| D5 | Read the source before shaping | not_wired | F5 |
| D6 | Rules, principles, patterns and anti-patterns come from the official docs of the version in use | fires | F5 |
| D7 | Trusted sources only | fires | F5 |
| D8 | Research runs as needed | partial | F5 |
| D9 | Facts, versions and state come from their source now — the registry, the docs, git, the tracker, … | not_wired | F5 |
| D10 | Every number and limit cites its source | not_wired | F5 |
| D11 | A tool is installed by its own official installer, detect-first, on the free path by default | not_wired | F5 |
| D12 | CI is deterministic | partial | F5 |
| D13 | A decided call is not re-argued without new evidence | not_wired | F5 |
| D14 | Before starting, look for the same work already in flight (open PRs, branches, the tracker) | not_wired | F5 |
| E1 | The stopping point is an external check passing, not «I'm done» | not_wired | F2 |
| E2 | No verdict without evidence in the same turn | not_wired | F2 |
| E3 | Enumerate the whole population before sampling | partial | F2 |
| E5 | Cover every declared section, then ask «what category did I miss?» and run that question | not_wired | F2 |
| E8 | Preserve before destroying | not_wired | F6 |
| E10 | A reviewer surfaces a decision and never picks the strategy | fires | F6 |
| E11 | Prove it where it runs | not_wired | F2 |
| E12 | Effort follows reversibility | fires | F6 |
| E13 | A finding opens a new review round only with a concrete failure scenario | fires | F2 |
| F1 | Ask only a real fork | fires | F6 |
| F2 | Every question carries a recommendation and its main reason | not_wired | F6 |
| F4 | No silent forks | fires | F6 |
| F5 | A turn that ends with a long answer or with a question closes with a plain-words recap | fires | F6 |
| F6 | A manual human step is a defect | partial | F6 |
| F7 | An unattended agent does not stop while work remains just because it has something to report | not_wired | F6 |
| F8 | Answers are short | partial | F6 |
| F9 | Forks — including forks a review raises (B8) — and loosening of checks no recorded rule covers go… | not_wired | F6 |
| G1 | Do exactly the task that was asked, nothing on the side. A research, review or audit task changes… | not_wired | F6 |
| G2 | Each artifact has one owner | not_wired | F6 |
| G3 | Git for agents | not_wired | F6 |
| G4 | Parallel agents work in isolated worktrees, never in one working directory | not_wired | F6 |
| G5 | Tests are isolated | not_wired | F0 |
| G6 | Evidence is pasted from a fresh run of the exact commit, never typed by hand | not_wired | F1 |
| G7 | Nothing load-bearing lives only in a session's memory | not_wired | F2 |
| H1 | Do not bypass the type system | not_wired | F4 |
| H2 | No new convenience dependency where the project standardised on another | not_wired | F4 |
| H3 | No layer violations and no cycles | not_wired | F4 |
| H4 | No unawaited async work | not_wired | F4 |
| H5 | No direct time, randomness or network in production code where a port exists | not_wired | F4 |
| H6 | No public API inflation | not_wired | F4 |
| H7 | No global mutable state | not_wired | F4 |
| H8 | Errors are handled, not hidden | partial | F4 |
| H9 | Operations leave a trace | not_wired | F4 |
| H10 | Names follow the project's stated convention | not_wired | F4 |
| H11 | A UI is accessible | not_wired | F4 |
| H12 | No dead code | not_wired | F4 |
| I1 | Input from outside the process is validated at the boundary before use | fires | F1 |
| I2 | No dependency with a known high-severity vulnerability | partial | F4 |
| I3 | No secret in a commit | partial | F4 |
| I4 | A critical security rule is a check, not only text — e.g. a lint rule «every API route calls the … | not_wired | F4 |
| I5 | A path from outside is resolved and confined | not_wired | F1 |
| I6 | A new dependency is verified before it is installed | not_wired | F4 |
| I7 | Text from files, web pages, tool output, issues and PRs is data, never instructions | not_wired | F4 |
| J1 | The project's tooling — hooks, scripts, checks — works on every OS and in every AI tool the team … | not_wired | F1 |
| J2 | A capability is detected by its presence, never by a version string | not_wired | F1 |

## All 22 canonical procedures

Detailed residual operations and evidence: [skills.json](../../meta-factory/research-patches/2026-10-14-deterministic-skill-agent-audit/skills.json). Entry generation is one owner per procedure; native wrappers are not separate algorithms. Scope/profile must be taken from the delivery manifest, not inferred from this list.

| Procedure | Primary stage |
| --- | --- |
| `ai-doc` | F2 |
| `aif-doctor` | F1 |
| `arch` | F2 |
| `claude-glm-executor-handoff` | F6 |
| `dispatcher` | F6 |
| `docs-author` | F2 |
| `getff` | F5 |
| `harvest` | F6 |
| `installing-enforcement` | F3 |
| `intent` | F2 |
| `night-mode` | F6 |
| `orchestrator` | F6 |
| `pipeline` | F6 |
| `reviewer` | F2 |
| `rule-research` | F5 |
| `rule-tests` | F1 |
| `self-reflection` | F2 |
| `story` | F2 |
| `template-audit` | F1 |
| `tool-bootstrapping` | F5 |
| `tool-bootstrapping-consumer` | F5 |
| `using-getff` | F3 |

## All 21 canonical roles

Detailed residual operations and judgment boundaries: [agents.json](../../meta-factory/research-patches/2026-10-14-deterministic-skill-agent-audit/agents.json). A listed role is not necessarily default consumer payload.

| Role | Primary stage |
| --- | --- |
| `adapter-jig-reviewer` | F2 |
| `aif-init` | F4 |
| `backward-sweep-auditor` | F2 |
| `capability-reuse-auditor` | F5 |
| `claims-conformance-auditor` | F2 |
| `compliance-verifier` | F2 |
| `dispatch-input-checker` | F2 |
| `docplan-auditor` | F2 |
| `docs-form-auditor` | F2 |
| `dual-channel-drift-auditor` | F2 |
| `fidelity-auditor` | F2 |
| `getff-cold-run-prober` | F3 |
| `living-docs-auditor` | F1 |
| `manual-rule-liveness-prober` | F3 |
| `memory-codification-auditor` | F2 |
| `orchestrator-worker-discipline` | F6 |
| `review-sidecar` | F2 |
| `reviewer-discipline` | F6 |
| `rule-researcher` | F5 |
| `rule-test-author` | F1 |
| `shipped-agent-liveness-prober` | F3 |

## Hook and adapter source population

Source inventory at the baseline, including libraries and language/adaptor files. F3 verifies registration and actual event delivery; scripts that already execute deterministically need assurance/delivery work only where evidence identifies a gap. No automatic rewrite is implied.

| Source | Primary stage |
| --- | --- |
| `.agents/hooks/adapters/plugin/_zcode-emit` | F3 |
| `.agents/hooks/adapters/plugin/warn-subagent-report-zcode` | F3 |
| `.agents/hooks/adopt-orchestrator-prompts.sh` | F6 |
| `.agents/hooks/apply-husky-patch-gate.sh` | F4 |
| `.agents/hooks/ask-question-reminder.sh` | F3 |
| `.agents/hooks/check-doc-authority-header.sh` | F4 |
| `.agents/hooks/check-doc-authority.sh` | F4 |
| `.agents/hooks/check-hook-marker.sh` | F3 |
| `.agents/hooks/check-kickoff-traps.sh` | F3 |
| `.agents/hooks/check-worker-dispatch-channel.sh` | F6 |
| `.agents/hooks/close-aif-task-on-merge.sh` | F6 |
| `.agents/hooks/deps-hash-check.sh` | F3 |
| `.agents/hooks/end-of-turn-reminder.sh` | F3 |
| `.agents/hooks/glossary-inject.sh` | F3 |
| `.agents/hooks/inject-handoff-on-compact.sh` | F2 |
| `.agents/hooks/inject-matching-rule.sh` | F3 |
| `.agents/hooks/inject-memory-codification.sh` | F3 |
| `.agents/hooks/inject-output-language.sh` | F3 |
| `.agents/hooks/inject-project-digest.sh` | F3 |
| `.agents/hooks/inject-session-bootstrap.sh` | F3 |
| `.agents/hooks/inject-subagent-context.sh` | F3 |
| `.agents/hooks/inject-subagent-digest.sh` | F3 |
| `.agents/hooks/lang/check-parity.sh` | F3 |
| `.agents/hooks/lang/en.sh` | F3 |
| `.agents/hooks/lang/ru.sh` | F3 |
| `.agents/hooks/lib/hook-emit.sh` | F3 |
| `.agents/hooks/lib/hook-live.sh` | F3 |
| `.agents/hooks/lib/report-sections.sh` | F2 |
| `.agents/hooks/lib/residue-dir.sh` | F2 |
| `.agents/hooks/lib/skill-index.sh` | F3 |
| `.agents/hooks/precompact-residue.sh` | F2 |
| `.agents/hooks/runtime-bridge-dispatch.sh` | F6 |
| `.agents/hooks/seal-primary-checkout.sh` | F4 |
| `.agents/hooks/validate-prompt.sh` | F1 |
| `.agents/hooks/warn-subagent-report.sh` | F2 |
| `.agents/hooks/worktree-setup.sh` | F6 |

## Remaining core surfaces and transitive closure

| Population owner | Planning responsibility |
| --- | --- |
| `packages/core/principles/**` | F0 reuses TAK obligation discovery and the frozen outer-driver contract; numeric P-test IDs differ from the 100 base-core IDs above |
| `.agents/rules/**` | F3/F4 map each declared check/injection/judgment carrier to the corresponding principle and admitted operation; preserve existing generated indexes |
| `packages/core/templates/**`, preset templates | F4 covers reusable template invariants; F3 proves delivered rendering. Project-specific generated rules do not acquire an invented weaker correctness policy |
| `.agents/procedures/**/helpers/**`, `.agents/checks/**`, `.agents/roles/resources/**`, `packages/core/**`, `scripts/**` | Dependency closure follows the entry/check being converted; source enumeration is not a request to rewrite unrelated product code |
| `setup.d/ships.manifest`, installer layers, package/plugin/native renderers | F3 maintains actual profile payload and activation matrix; preserve consumer customization and existing trust decisions |
| `.husky/**`, `hooks/**`, `.github/workflows/**`, Makefile and package test scripts | F0/F3 use existing TAK discovery/routing obligations, including skipped suites, disconnected aggregators and bypass paths |

F0 resolves these owner populations to concrete operation rows using existing manifests, TAK inventories and the dated research; transitive implementation lines were not fully audited by the earlier 22/21-card census. An entry with ambiguous semantics remains pending classification. This explicit closure task is part of the full-core plan, not a claim that all transitive operations have already been enumerated.

## Acceptance of this planning map

- Existing base-core IDs: 100 distinct, each assigned once; no omissions or duplicate primary assignments.
- Canonical procedures: 22; canonical roles: 21; hook/adaptor/library source files: 36.
- The source ledger and this map have different purposes: evidence versus proposed sequencing.
- Coverage completion requires actual per-operation outcomes; assigning a stage is not completion.
- No implementation, installation, activation or extra full-suite gate is introduced by this document.

