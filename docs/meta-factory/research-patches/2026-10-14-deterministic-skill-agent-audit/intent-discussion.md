# Intent discussion — mechanical work and architectural simplicity

> **Authoritative for:** the operator's stated intent, discussion hypotheses and open decisions in this scoped continuation.
> **NOT authoritative for:** an approved product brief, a new core principle, implementation, installation, integration or runtime certification.

Checkpoint: 2026-10-14. Repository HEAD: `80196f2f9e3546ceffa00c0cb362903d1eebaebe`.

## Stated intent and settled boundaries

Source: the operator's explicit invocation of `$intent` for this research directory.

- Rules-as-tests exemplifies a broader division of labor: repeatable formal work should use scripts, hooks, templates and other mechanisms where these outperform model execution.
- Preserve model context for judgment, meaning, unfamiliar diagnosis and decisions.
- Evaluate architectural simplicity for callers, maintainers and agents: avoid unnecessary layers, repeated decisions, speculative abstractions and procedural clutter.
- Reuse the completed research; investigate again only for a specific gap or changed source.
- Preserve original pstack versus independent port and operator versus consumer distinctions.
- Discussion and preparation only. Implementation, installation and integration remain future work.
- Discuss in Russian, record durable intent in English and maintain this scoped handoff.

These are explicit operator premises. Recommendations remain provisional except where explicitly accepted below. Delegated brief approval does not settle unresolved product preferences or authorize integration. The product brief is now approved through the adjacent `product-brief-approval.json` and `product-brief-receipt.json`, binding snapshot SHA256 `4869eaee6c97d6ea055a94e11f462d4c4c3870a79a5fe5bf6eecd17574d3d326`; current PRD selector revision is 1. This discussion record remains historical context, not the approved snapshot.

## Accepted decisions — second discussion checkpoint

Source: the operator's follow-up accepting the recommendation and distinguishing shipped core from generated project artifacts (2026-10-14).

| ID | Accepted intent | Rationale / boundary | Revisit condition |
| --- | --- | --- | --- |
| D1 | Give simplicity a named core criterion, applied through existing design/review owners. | Operator accepted the preceding recommendation. Exact name and wording remain open; no separate workflow was accepted. | The criterion adds no meaningful decision beyond existing owners, or important cases have no accountable owner. |
| D2 | Begin in this framework project itself. | Exercise the division of labor on our own skills and agents before relying on consumer delivery claims. | A local success cannot transfer to the intended consumer environment; require separate delivery proof rather than claiming transfer. |
| D3 | For reusable shipped core, systematically move deterministic skill/agent work into mechanisms and generalize genuine recurring patterns. Keep procedural implementation out of normal model context and invoke through appropriate triggers. | The core can amortize substantial engineering and verification investment across repeated use. This is the intended default, not an approval to implement now. | The extracted contract is not stable, loses necessary judgment/evidence, or increases total caller/maintenance burden. |
| D4 | Invest especially strongly in core test quality, including protection against tautological tests. | A shared mechanism can propagate one defect across many skills, agents and consumers. | Tests merely mirror implementation or allow an incorrect/no-op mechanism to pass; revise the evidence, not the promised behavior. |
| D5 | Historical interpretation, superseded by D6: generated-project work was initially described as a separate lighter automation regime. | The operator corrected this during brief preparation: the point is automation priority and efficiency, not a new proportionality boundary. | Restore D6 and P12 in the product premise register; do not carry D5 forward as an active product requirement. |
| D6 | Automate deterministic work, beginning with operations that yield a large useful result for relatively little effort in the ready-made core; use bounded increments so the initiative does not become endless construction. | The operator explicitly corrected the separate small-task/no-full-installation interpretation. A subsequent clarification states that 20/80 was only an analogy, not even a heuristic: no numeric ratio, target or quota is implied. | Measurements change which operations have the highest payoff; update the priority without disguising unfinished deterministic work as complete or as judgment. |

Expected token savings and reduced clerical errors are goals, not measured results. Mechanization does not eliminate software defects. The earlier advisor interpretation about a separate lighter generated-project rigor regime is superseded by D6. No new installer mode, task-size exemption or relaxed quality policy is established by this discussion.

## Feasibility assessment — provisional

The audit already covers 22 canonical skills and 21 roles and identifies common invocation content in 19 cards. Existing renderers, helper runners, report validators and trigger injection provide starting seams (main research report, Population and Verified findings 1–4). Full conversion is a substantial staged refactor and delivery-validation effort, not a greenfield framework and not a single text extraction.

- Low-to-moderate difficulty: stable inventory, parsing, serialization, exact identity checks and reuse of current helpers.
- Moderate-to-high difficulty: complete evidence acquisition, failure/unknown handling, trigger coverage and safe context reduction across callers.
- High difficulty: distinguishing a correct semantic oracle from a self-confirming test, rule-level isolation, cross-harness delivery/activation and state-changing operations under retries/concurrency.

Concrete risk: `.agents/roles/rule-test-author.md:50-52` requires per-rule isolation because diagnostic codes alias across rules; `packages/core/synthesizer/run-rule-tests-firing.sh:266-272` documents the narrower current ruff code-level guarantee. A generic success wrapper would hide this distinction. Existing `.agents/hooks/inject-matching-rule.sh:22-30` is nonblocking context injection, not automatic execution or enforcement of every procedure.

Proposed quality evidence, not an adopted new test protocol: independently specified expected outcomes, bad/good cases, no-op or disabled-mechanism adverse controls, relevant mutation checks, real entry-point firing, partial/stale/wrong-identity cases, and comparable task-level context/time/error measurements. No calendar estimate or percentage saving is justified before selecting the first bounded family.

## Experience under discussion

An agent doing recurring framework work should obtain the necessary evidence and execute known formal steps without reconstructing the procedure on every run. It should receive a focused question when meaning or a new decision remains unresolved. Maintainers should be able to reproduce the mechanical result and understand its limitations without tracing unnecessary layers.

A permitted outcome could use more internal code while removing repeated decisions from many callers. A plausible wrong interpretation is to maximize script count, suppress diagnostic evidence to save tokens, or treat successful serialization as proof of a correct semantic verdict.

## Live reconciliation

`git rev-parse HEAD` matches the handoff. Initial `git status --short` lists only the existing untracked research report and directory. No source implementation change was found in that reconciliation; this is not a deployed-runtime audit.

- A7 remains `not_wired / trigger-to-build` in `.agents/procedures/getff/references/base-core.md:46`; the principle is stated in `docs/superpowers/specs/2026-09-28-one-button-chain-base-core.md:95`. The consumer table describes the primary trigger on its declared react-spa install, not all possible related tooling (`base-core.md:16,24,26,31`).
- B7/H2/H6/H12 remain not_wired at consumer table lines 64/120/124/130. They are narrower slices, not proof of either total absence or complete enforcement of simplicity.
- `run-helper.sh:16-19,32-48` separates completion/exit status from semantic completeness; its caller is `pipeline/references/planning.md:66-69`. Timeout remains best-effort when no timeout binary exists.
- `docs-form-auditor.md:128-138` delegates report validation/serialization to `roles/resources/docs-form-auditor/check-report.mjs:65-87`; the helper explicitly disclaims evidence truth at line 2. This separation already has a concrete local example.
- Compatibility metadata still differs: `agents/orchestrator-worker-discipline.md:4` says `Read`, canonical `.agents/roles/orchestrator-worker-discipline.md:4` says `Read, Bash`. Source drift is verified; a deployed failure is not.
- Existing Osmani documentation reuse is already recorded as F7 in `docs/superpowers/specs/2026-09-30-docs-single-source-design.md:88`; this discussion does not claim first adoption or certify its current deployment.
- Pinned local original pstack Lever/Reader Load and independent-port verify-commands sources were selectively reread. Their detailed provenance remains in `pstack-complete.md` and the saved ledgers. No full catalog or successful test suite was rerun.

## Recommendations for discussion

| ID | Provisional recommendation and evidence | Falsifier |
| --- | --- | --- |
| R1 | Extend the practical use of A7 through existing owners before inventing a general execution engine. Existing invocation bindings and report helpers demonstrate usable seams; research report findings 1–4; SSOT #233/#234 and #270/#273 cover related economy and derived-copy ownership. | Several real procedures require a shared capability that existing seams cannot express without greater duplication or ambiguity. |
| R2 | Treat simplicity as an explicit evaluative criterion with existing design/review owners; consider a name without creating a new workflow or universal complexity gate. Existing owners: SSOT #253, Superpowers YAGNI, Matt Pocock deletion test, B7/H2/H6/H12; external residue: pstack Reader Load and Osmani O04/O05. | Representative cases expose a consequential simplicity failure with no owner, or the proposed criterion changes no decision beyond existing contracts. The former supports stronger ownership; the latter supports no addition. |
| R3 | Reuse narrow residue: rerunnable verification artifacts, checks against green no-ops, project-specific live recipes, behavior-preserving simplification and records of rejected experiments. Original pstack Lever/verification recipes, port verify-commands, Osmani O04/O05/O18; details in the existing reports. | Equivalent delivered behavior already exists, the problem class differs, or comparable use costs more without improving acceptance or reproducibility. |
| R4 | Judge future adoption by total work and preserved outcomes: repeated decisions/calls, relevant model input, tool-output volume, elapsed time, errors/rework, maintenance and false alarms. No fixed savings target is inferred from corpus bytes. | Measured gains are only local to one file or prompt while caller burden, diagnosis time or missed semantic failures increase. |

## Mechanical boundary examples

| Operation | Mechanism can establish | Judgment retained |
| --- | --- | --- |
| Source/evidence inventory | Paths, IDs, hashes, known exclusions, resolvable references | Whether the population and evidence answer the question |
| Run verification | Invocation, exit status, selected-test count where supported, adverse-control result | Whether the asserted observable captures the intended behavior |
| Review reporting | Required fields, full criterion inventory, exact serialization and content binding | Meaning, sufficiency, severity and final semantic verdict |
| Simplify a workflow | Duplicate recipes, extra exports, dependency edges and observed caller paths | Whether removing a layer actually reduces total conceptual burden |
| Repeat diagnosis | Known passive probes and preserved raw output | New causes and choice of a discriminating experiment |

Failure cases to preserve: zero selected tests with exit 0; partial remote results treated as empty/complete; valid JSON containing unsupported conclusions; shared diagnostic codes mistaken for isolated rule firing; fewer wrappers but duplicated caller logic; cached prompt-shaped source readings reused solely by URL; compact reports that hide evidence needed for diagnosis.

## Open decision frontier

| ID | Status | Question / current recommendation |
| --- | --- | --- |
| Q1 | answered | Named simplicity criterion with existing owners accepted; see D1. Exact wording/name remains open. |
| Q2 | answered | Start in this framework project, then separately establish consumer delivery; see D2. |
| Q3 | unresolved, downstream | Which specific operation and baseline should be used after the priority is settled? No experiment or implementation is launched here. |
| Q4 | unresolved, downstream | What maintenance cost, latency and acceptance regression would reject the chosen candidate? Set against its actual workload, not arbitrary universal percentages. |

## Continuation discipline

Do not infer agreement from silence. Record explicit choices as they arrive; keep author recommendations distinct. Preserve original pstack's live-proof floor versus the port's tests-only PASS+NOTES allowance (`pstack-complete.md:139`). Upstream authority, force-push recipes and confirmation rituals do not replace local contracts.

Self-check: this checkpoint reuses the completed population research and verifies selected load-bearing claims against live local sources. It does not upgrade source inspection into native activation, semantic efficacy, cost savings or integration approval. No new enforcement guarantee is introduced.
