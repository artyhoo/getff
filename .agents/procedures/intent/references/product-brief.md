# Product brief — shape, approval snapshot and restoration contract

> **Authoritative for:** what a product brief must contain, how approval binds immutable content, and how a later session restores understanding from the approved snapshot.
> **NOT authoritative for:** the routing boundary ([SKILL.md §1](../SKILL.md)), the result-review protocol ([result-review.md](result-review.md)), or upstream interview-skill internals. Project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists).

## §1 Shape (from the intent-first spec §3)

A brief is narrative first — who the user is, what problem they have, what the experience should feel like, and what makes it valuable — with the distinctions below it:

- **Stable feature and promise IDs** with, per promise, at least one scenario and one failure case.
- **Essential promises** marked explicitly, each with **permitted deferrals**. An essential promise is never deferred merely to obtain a passing review.
- **Rejected interpretations** — the plausible readings that were considered and excluded, so a fresh reviewer can distinguish a permitted outcome from a plausible wrong one.
- **Accepted decisions**, **unresolved questions**, and the **exact approval reference** (who approved, when, pointing at the immutable statement — never inferred from silence or from a review GO).

Metadata identifies the feature it belongs to, its promise IDs, its essential IDs, its immutable approved snapshot, and the actual approval reference.

## §2 Approval binds a snapshot, not a path

**Approval applies to a preserved snapshot** — a Git blob digest of the exact approved bytes — never to a mutable path. A later edit produces unapproved content, even at the same path. The consuming contract binds those bytes via a content ref (path + sha256).

**The brief never encodes its own digest** inside itself — the digest is computed over the file, so it cannot appear in the file without breaking its own binding.

## §3 Understanding check and restoration

The product-only advisor is prepared from the brief, the recorded decisions, and the open questions — never from architecture or implementation conversation. Before the brief is agreed the advisor demonstrates understanding: a plain-language retell of the experience, one permitted outcome distinguished from a plausible wrong interpretation, and the unresolved preferences named.

Later sessions restore the same way: read the approved snapshot and the recorded decisions, then re-demonstrate understanding before acting on the product boundary. Restoration is replay of this check, not a summary from memory.

## §4 S1 pilot brief — configuration-convention developer interaction

> **Feature:** `intent-first-result-pilot`. **Status: UNAPPROVED** — no operator approval statement exists for this brief (kickoff §0 records none); it becomes approved only by an actual approval reference binding a snapshot of these exact bytes. A review GO is not brief approval.

**Narrative.** A developer on the team keeps reading configuration straight from the process environment, so settings ignored in every real deployment surface keep «working» on their machine. The operator wants the local tooling to stop that read at the developer's own desk: when the forbidden read happens, the tool says so at the exact line, in words that tell the developer what to write instead — so the fix is a mechanical edit, not an investigation. The developer should be able to apply the correction and see the tool go quiet without reading any rule documentation. Supporting every language and editor is explicitly deferred; an understandable correction is essential even in the first result.

### Promises (per spec:15–21 — the worked example)

| ID      | Promise                                                                        | Scenario (observed how)                                                                                                                                                             | Failure case                                                                                                                             | Essential |
| ------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `S1-P1` | The forbidden read fails the installed local check                             | A file performing a direct process-environment read is checked by the real installed local ESLint command in the disposable consumer; the check fails naming the read               | The read passes silently, or the check fails for an unrelated reason (config error)                                                      | **Yes**   |
| `S1-P2` | The failure identifies the relevant code and explains the approved replacement | The diagnostic names the offending source and location and states the replacement — read configuration through the injected config accessor, never the process environment directly | An opaque error code, a bare rule ID with no replacement guidance, or a message whose rule name alone requires documentation archaeology | **Yes**   |
| `S1-P3` | The corrected code passes the same installed check                             | The same file, rewritten to the accessor form, passes the identical local command                                                                                                   | The correction still fails, or passes only after disabling the rule                                                                      | **Yes**   |

**Permitted deferrals:** multi-language and multi-editor breadth (spec:17); any env-wide/native delivery route (S3 scope). **Not deferrable to obtain a match:** `S1-P2`'s understandable-correction content — detection without it is the exact technically-correct-but-misses-the-point result this pilot exists to catch (spec:19).

### Rejected interpretations

- «Detection is the promise» — a degraded diagnostic that still fires but emits only an opaque code does NOT satisfy `S1-P2`, however green the pass/fail signal (spec:19).
- «Build a new rule family for this» — rejected: the pilot reuses the existing configuration-access fixture and npm backend in a disposable consumer; the production rule family is never modified (spec:161).
- «The executor may prewrite the semantic verdict» — rejected: the advisor judges from raw output + reproduction only, with expected-semantic labels withheld (spec:161; kickoff §3).

### Accepted decisions (from the approved spec — no new operator decisions taken here)

Disposable npm consumer discarded after the stage; real installed local ESLint command execution (no fixture-level simulation of the check); degraded correction guidance exists only in the disposable variant fixture.

### Unresolved questions

- Exact final message wording is owned by the installed rule's configuration, not by this brief — the brief pins the property (identifies code + explains replacement), not the sentence.

### Approval reference

`<none — to be completed only with an actual operator statement + the sha256 of the approved snapshot bytes>`
