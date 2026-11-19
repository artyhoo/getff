# Q2 product review and repair custody — bounded source probe

> **Date / baseline:** 2026-10-26; local HEAD `c458396147b48e3b2c14d2a458870c1bc31d4a22`.
> **Authoritative for:** this probe's source findings, proposed role binding and explicit limits.
> **NOT authoritative for:** architecture approval, live host capability, context isolation acceptance, dispatch permission or product acceptance. This is not a cold review.

## Answer

Reuse the existing **fresh product-only advisor responsibility** from `/intent`, hosted by a separate local getff execution session outside OpenMaus's native team prompt assembly. That standalone dispatcher/orchestrator worker can request a fresh native review agent with only the bound product artifacts and observations, receive the attempt, and publish it through the existing result-review helper. Return the published artifact's exact path/identity to the OpenMaus owner for current-result validation. This composition needs no new reviewer service.

**No configured live route demonstrating that composition was established.** The inspected sources specify the role, cold-input discipline, native no-history binding and file publication seam. They do not prove an OpenMaus-to-local-worker launcher, actual context exclusion on that worker, automatic report return, or recovery after parent/worker termination. Source support for the composition is not a successful laptop-only acceptance trial.

The user's laptop-only first-host choice and retained-AIF route are inputs. No inference is made about where the existing AIF runtime currently runs or whether it is reachable from the laptop. No private configs, sessions, installations or live external systems were inspected.

## Q2: the exact existing review responsibility

| Source | Binding consequence |
| --- | --- |
| `.agents/procedures/intent/SKILL.md:21,25–31,49–51` | The contour explicitly owns product-only advisor instantiation and fresh artifact-only result review. File publication/helper checks remain possible without a bridge; fresh review is not defined as an AIF internal review stage. |
| `.agents/procedures/intent/references/product-brief.md:27–31` | Restore the reviewer from approved brief, recorded decisions and open questions; demonstrate understanding. Never supply architecture/implementation conversation as restoration. |
| `.agents/procedures/intent/references/result-review.md:8–23` | Reviewer is distinct from producer, judges observed result against essential promises, challenges incomplete observations, and returns `matches`, `mismatch`, `needs-evidence` or `needs-operator`. Producer narrative is supplementary, not the verdict. |
| `.agents/procedures/arch/references/design-review.md:8,17–27` | Existing cold-seat construction requires non-author plus no authoring context, immutable input snapshots and unique output names. This is a reusable execution discipline; its two-altitude design verdict grammar does not replace the product result-review grammar. |
| `docs/codex-contributor.md:39–42` | Existing Codex binding explicitly calls for no-history subagents and complete canonical role/procedure loading; native authorization still governs. It is a documented harness binding, not proof that a child launched by OpenMaus has this context. |
| `docs/superpowers/specs/2026-08-10-advisor-pattern-design.md:157–171` | Fresh artifact-restored advisor instantiation is already a legal mode; a standing advisor process is not required. CLI-born successors' wake behavior has explicit historical limits. |

The generic interactive `/reviewer` is not the product acceptance protocol. Its own boundary names interactive review, excludes cold PR protocols, and treats review seats as checkpoints rather than execution owners (`.agents/procedures/reviewer/SKILL.md:3,8–9`). It may support a separately scoped technical check, but a GO/code-review report must not be relabeled as `ResultReview.matches`. Similarly, AIF's implementation/internal-review completion only creates a candidate requiring the independent product comparison.

## Concrete local composition and exact artifact seam

**Proposed composition using existing mechanisms:** a separately scoped local getff dispatcher/orchestrator worker, outside the OpenMaus team runtime, invokes its host's existing fresh Agent mechanism for this product-only review. Claude Code's native Agent is the named mechanism in the canonical cold-seat procedure; the documented Codex equivalent is a no-history subagent (`design-review.md:8`; `docs/codex-contributor.md:42`). In this Codex harness, `spawn_agent` with `fork_turns: "none"` expresses no inherited conversation; its availability here does not prove that an OpenMaus-launched local worker exposes it. No child was launched during this probe.

The review request contains the canonical result-review procedure and immutable references for current approved brief/approval, applicable recorded decisions/open questions, producer contract, exact candidate/observed revision, environment and raw observation evidence. It does not copy OpenMaus team memory, native parent discussion or implementer design dialogue. Repository/system instructions remain a separate actual input population; no-history alone is insufficient if another injection channel reintroduces forbidden context. The existing instruction to pass artifact paths is a requirement, not proof that every host implements it.

The fresh reviewer returns a complete attempt and its limits; the standalone **stage owner**, not the reviewer acting as executor, publishes it with the already-defined command:

```bash
node .agents/procedures/intent/helpers/publish-result-review.mjs \
  --attempt <independently-authored-attempt.json> \
  --stage-artifact-root <bound-stage-artifact-root> \
  --roots <owner-root[,other-root...]>
```

This template was not run. `.agents/procedures/intent/helpers/publish-result-review.mjs:9–42` validates stage-root ownership, rejects an existing attempt ID, stages and structurally validates the record, then renames it into `result-reviews/<attemptId>/result-review.json`. The successful return is `{ok:true, attemptId, path}` (`:42`); CLI stdout/exit behavior is `:69–75`. The product protocol makes observations precede publication and completed attempts immutable (`result-review.md:25–29`).

The worker's return to OpenMaus should identify the actual task/stage, exact published path, attempt ID, content digest, observed candidate/revision and outcome, plus unresolved `ATTN`. The path/attempt are existing helper output; including a digest/task association in the native return is a **proposed transport binding**, not a claim that the publisher already emits those fields. Keep the complete artifact available through the shared laptop filesystem or an explicitly verified transfer; a prose summary alone is not the acceptance record.

Before using the record for expansion, the accountable owner invokes the existing `check-result-review.mjs --current-result` with independently selected current brief, enforcing contract, current observed revision and published path; set `requirePublished:true` where publication is mandatory. `check-result-review.mjs:707–794` checks these bindings and published path/attempt identity; `:315–348` binds feature/result/contract/input/environment fields; the validator does not attest the actual prompt's context isolation. Existing four outcomes and essential-promise evidence rules remain authoritative (`result-review.md:12–23,31`). A new candidate requires a new applicable review; an old green artifact stays historical.

## Proposed role and custody mapping

| Role | Owns | Must not silently acquire |
| --- | --- | --- |
| OpenMaus native parent, explicitly assigned **dispatcher** responsibility | Durable task identity/current authority, AIF task binding, routing of results and decisions, current-result reconciliation, outstanding obligation and final destination status. | Product semantic verdict by self-review; implicit merge authority over managed Dot PRs; acceptance from native completion. |
| Standalone local pipeline worker, external to OpenMaus team prompt assembly | Bounded AIF observation, complete evidence/report return, authorized harvest and the existing checkout/PR custody. Invoke external fresh review when needed and publish its independently authored attempt as stage owner. | Strategy/product forks, changing the brief, treating its own implementation narrative as acceptance. |
| Bounded observation helper | Existing `await.ts <id> --until-actionable --timeout-ms N`, returning task/candidate/generation/held metadata. It can be a command inside that standalone worker; no additional agent service is necessary. | Execution retry on timeout, product acceptance, merge, or authority from `RUNTIME_BRIDGE_RESULT_OWNER`. |
| Fresh external product-only review seat | Artifact-only understanding and semantic comparison; complete independent result attempt or precise missing evidence/operator question. Read-only over implementation and governing artifacts. | Repair ownership, harvest, PR merge, or authoring-context access disguised as shared memory. |
| Same standalone worker after harvest, explicitly retained as correction owner | Fully specified in-scope fixes on the existing harvested branch/PR, local rechecks and returning the new candidate for independent review. | Automatic redispatch to AIF for already-adjudicated fixes; expanding scope or resolving an open product/design decision. |
| Existing applicable technical/system reviewers and managed-PR coordinator | Their existing review scopes, finding closures and merge authority, if the selected task/PR is enrolled. | Product acceptance inferred from technical GO; native-parent takeover of a registered coordinator. |

This preserves the standalone-worker rule without demanding a new manual click. `.agents/rules/coordinator-seat-delegation.md:24–35` separates campaign coordinator from standalone pipeline worker and explicitly rejects in-session Agent-as-chip; dispatcher/night/worker roles are exempt (`:30`). `.agents/procedures/orchestrator/SKILL.md:30–44` binds standalone REPORT and acceptance of observed evidence. The native parent should be identified as dispatcher by its actual responsibility, not renamed to evade a campaign-coordinator rule. Even with the dispatcher exemption, retaining a standalone local worker provides a clear execution/correction owner and an external context boundary for Q2.

Post-harvest repair must have one explicit owner. `.agents/procedures/dispatcher/references/execution.md:299–305` and `packages/core/templates/shared/tier-home.md:57–64` route fixes whose root cause and every edit are specified at file:line, with no open design choice, to the current host session on the existing branch/PR—no round-two kickoff or automatic AIF redispatch. In this mapping that current execution session is the standalone pipeline worker; it retains the checkout/PR custody through correction. The product reviewer remains a checkpoint. An open decision returns to the corresponding advisor/owner; STOP escalates. After correction, current-candidate acceptance must be regenerated rather than carried across the changed result.

The worker REPORT remains compatible with the existing `Status: DONE|PARTIAL|BLOCKED`, per-stage PR/head/merge/task-closure and `ATTN` contract (`.agents/procedures/orchestrator/references/chip-worker-template.md:19–25,46–51`). The native return may add an exact product-review reference without treating pipeline DONE as product accepted. Parent and worker must persist who owns an unfinished correction before the worker exits or a successor is assigned.

## Straightforward choices versus actual unknowns

**Straightforward bounded design choices, supported by existing contracts:** reuse product-only advisor responsibility rather than invent a reviewer service; reuse immutable file publication and current-result validation; separate product review from code/system review; keep bounded observation inside the standalone worker; retain that worker as post-harvest correction owner; return exact artifact identity rather than summary-only approval. These are proposed bindings, not executed changes. Wrong if the existing mechanisms cannot meet their stated boundaries on the selected host; inspect that concrete failure before replacing them.

**Actual unproven facts requiring a narrowly scoped trial:**

- Which existing permitted local Claude/Codex entrypoint OpenMaus can start as a standalone session, with explicit cwd and scoped task, without handing it OpenMaus team context. This probe found the protocol/native-agent seam, not a configured launch command or host permission receipt.
- Which implicit project, memory, environment or resumed-session inputs that external host actually supplies. A fresh process, no-history flag or reviewer declaration alone does not demonstrate the forbidden-context exclusion.
- Whether the worker can read the bound artifacts, invoke the current installed helpers and reach the selected AIF task from the laptop. Local paths and endpoint availability must be observed, not borrowed from another host.
- Whether native parent receives the exact published record and current status without manual relay, including timeout, child failure, parent restart and duplicate report. The existing advisor transport spec explicitly treats absent doorbell/idle-wake evidence as unproven (`advisor-pattern-design.md:179–204`); its old transport is not proof of OpenMaus return.
- Whether the worker's repair custody and scoped branch remain reconstructible after failure, and whether a successor can be appointed without double ownership. A still-live but disconnected worker is not proven ceased.
- Which managed-PR registration/merge rights actually apply to the first task. No live PR state or external configuration was inspected.

The first Q2 acceptance case should therefore capture the **actual external review input inventory**, one independently authored exact result artifact, parent receipt/current-result validation, and a controlled interrupted return with no operator relay. A correct rejection of a stale or wrong-product candidate matters more than a nominal green review. These are evidence obligations for the chosen integration, not reasons to rebuild existing review machinery.

## Read limits and self-check

Focused reads only: intent skill, product-brief/result-review references, publisher and result validator; arch skill/design-review binding; orchestrator/reviewer cards; directly referenced advisor-pattern continuity/transport and tier-home rework passages; Codex binding; existing dispatcher/standalone-worker contracts already cited in the preceding probe. One guessed `review-protocol.md` path was absent; the arch card resolved the actual `design-review.md` path. No broader search or absence inference followed. Some combined output was truncated; findings cite the subsequently visible bounded sections rather than claiming whole-file audit.

No installation, private configuration/chat inspection, launching, external request, mutating helper invocation or modification to preceding reports occurred. Only this report was written. Countercheck: placing the reviewer outside OpenMaus removes one known prompt-construction path, but does not certify the external host's inputs. The report therefore distinguishes a concrete reusable **protocol + publication seam** from the still-unproven **live launch + isolation + return/recovery route**.
