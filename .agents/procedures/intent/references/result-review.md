# Result review — fresh comparison of the first working result against the brief

> **Authoritative for:** the result-review protocol — who judges (a fresh advisor instantiation), the four outcomes, how incomplete observations are challenged, and how an attempt record is published.
> **NOT authoritative for:** the routing boundary ([SKILL.md §1](../SKILL.md)), the brief's shape and approval contract ([product-brief.md](product-brief.md)), the runtime-bridge validator schema/mechanics (the `intent-contract` record shapes in the consuming kickoff), or the stage owner's publication tooling. Project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists).

## §1 The judge

The comparison is made by a **fresh instantiation** of the product-only advisor responsibility — instantiated from the approved brief snapshot, the recorded decisions and the open questions only. The producer's narrative about its own result is supplementary input, never the verdict: an implementer explaining what it built cannot be the same seat that judges whether the product promise holds. Architecture and implementation conversation is never fed to the reviewing seat.

## §2 Outcomes

Exactly four: `matches`, `mismatch`, `needs-evidence`, `needs-operator`.

- **matches** — every essential promise is supported by observation, nothing contradicted, no outstanding operator checkpoint.
- **mismatch** — an essential promise is contradicted by the observed result, or a plausible wrong interpretation is what the result actually delivered.
- **needs-evidence** — a promise cannot be judged from what was observed; the reviewer requests a bounded observation instead of inferring a match.
- **needs-operator** — the result turns on a preference or approval the recorded materials do not resolve.

An essential promise is never deferred merely to produce a `matches`.

## §3 Observation challenges

Weak evidence is challenged, not rounded up: a claim without an observable behind it becomes `needs-evidence` with the concrete observation named; a demonstration that proves detection but hides an unusable experience is challenged for the missing observation. Per-promise comparisons use exactly `supported`, `contradicted`, `unobserved`, `needs-operator`, each with its evidence and an explanation in the record.

## §4 Publication

Observations are captured first; only then is the complete attempt written under `<stage-artifact-root>/result-reviews/<attemptId>/result-review.json`, appearing via an atomic rename on the same filesystem. **Never overwrite a completed attempt** — a new attempt gets a new ID. Journal selection happens after publication; incomplete or orphan data grants nothing.

The record validator is read-only — it checks structure, identities and coverage, never the product verdict; the fresh advisor owns every comparison and explanation. The runtime seam that gates continuation on this record is owned by the runtime bridge (see the consuming kickoff's `intent-contract` shapes); this reference owns only the protocol above.
