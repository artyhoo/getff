# Specification review — preserve the approved product intent

> **Authoritative for:** the specification-review record, complete essential-promise coverage and explicit disposition of conflicting attempts.
> **NOT authoritative for:** product approval ([product-brief.md](product-brief.md)), operator specification agreement or `/arch` transitions ([ideation reference](../../arch/references/ideation.md)), product-result observation ([result-review.md](result-review.md)), or permission to launch work.

## Review input and record

Use a fresh artifact-only intent responsibility. Supply the exact approved PRD, its approval and recorded decisions, and the candidate specification. The advisor explains whether the design preserves each essential promise, using specific clauses and rejected interpretations; byte/schema checks do not judge meaning.

A semantic attempt has `kind: 'spec-review'`, `version: 1`, `featureId`, `prdRef`, `specRef`, `approvalRef`, `reviewer`, `promises` and `outcome`. Each content reference is `{path, sha256}`. `reviewer` contains an independence declaration, context description and document references including the PRD. Each promise contains `id`, `comparison`, `reason` and citations `{source: 'prd'|'spec', quote, location}`. Outcomes/comparisons retain the [existing vocabulary](result-review.md#2-outcomes).

A semantic `matches` covers every essential ID from the digest-verified PRD inventory described in [product-brief.md](product-brief.md). Negative or uncertain attempts may report one discovered problem; they grant no passage. `missing_essential_promise` names omissions. `essential_promises_missing` or `essential_promises_invalid` identifies an absent or unsupported inventory. Do not edit an approved snapshot to make it pass: restore the actual inventory, or obtain the required renewed approval for changed brief content.

Publish through the existing narrow writer from the bound project root:

```bash
node .agents/procedures/intent/helpers/publish-spec-review.mjs --attempt <attempt.json> --orch-home "$(bash .agents/procedures/pipeline/helpers/print-orch-home.sh)"
```

Use `--roots <project-root[,approved-coordination-root...]>` when references require an additional owner-authorized root. The writer returns the immutable content-addressed `attemptId` and its directory. Old attempts remain inspectable at `<orch-home>/intent-continuity/spec-reviews/<attemptId>/spec-review.json`.

## Resolve a disagreement

For the same feature and exact PRD/spec bytes, any live valid `mismatch`, `needs-evidence` or `needs-operator` is an objection. A later positive opinion does not automatically settle it. `spec_review_conflict` names the unresolved attempt IDs; read those attempts before reviewing again.

To settle objections, a fresh full semantic `matches` adds this optional field:

```json
{
  "resolutions": [
    {
      "attemptId": "<64-character digest of the objection>",
      "reason": "<explain its disposition using the relevant clauses, evidence or recorded decision>"
    }
  ]
}
```

Name every current objection to these bytes, exactly once. Unknown or different-feature/document attempts cannot settle this disagreement. A newly published objection holds the transition again until addressed. The checker verifies identities and completeness; the advisor judges the explanations. A resolution cannot invent operator consent or waive an essential promise.

If the specification is corrected to different bytes, review that new candidate against the current PRD. Objections to the old bytes remain historical; do not list them as resolutions of the new candidate. A `formatting-equivalence` attempt only rebinds a bounded nonsemantic change through `priorAttemptId`, `priorSpecRef` and `boundedDiff.summary`; it cannot carry resolutions or hide an unresolved parent dispute.

After publication, run `/arch`'s `--check-presentation` or `--check-plan-prep` at the corresponding transition. A positive product review is distinct from the operator's exact written-spec agreement. Existing cold architecture reviews remain applicable.

## Existing runtime owner configuration

The agent performing a scoped runtime action supplies the existing owner configuration in that invocation's environment. From the actual project root on POSIX:

```bash
export AIF_INTENT_REPO_ROOT="$(git rev-parse --show-toplevel)"
export AIF_INTENT_ORCH_HOME="$(bash .agents/procedures/pipeline/helpers/print-orch-home.sh)"
export RUNTIME_BRIDGE_INTENT_HELPER="$AIF_INTENT_REPO_ROOT/.agents/procedures/intent/helpers/check-result-review.mjs"
export RUNTIME_BRIDGE_INTENT_DECISIONS_HELPER="$AIF_INTENT_REPO_ROOT/.agents/procedures/intent/helpers/current-decisions.mjs"
export RUNTIME_BRIDGE_INTENT_ROOTS="$AIF_INTENT_REPO_ROOT:$AIF_INTENT_ORCH_HOME"
```

Select the owner-authorized roots where the references actually live; this does not authorize arbitrary additional roots. Windows uses `;` as the runtime roots delimiter. Expansion additionally supplies `RUNTIME_BRIDGE_INTENT_OBSERVED_REVISION` from the current observed result, never a placeholder or the old review's revision merely to pass. Preserve existing AIF project/backend configuration and normal `/pipeline` launch gates. Missing owner configuration holds the effect; no infrastructure is launched by these assignments.

Use the existing dispatch/start/answer commands after their normal readiness checks. This reference adds no scheduler, launch vote or training task. The next genuine result follows [result-review.md](result-review.md); technical success here does not close live AC7.
