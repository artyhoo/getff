# AI laziness traps — resident hot digest

> **Class:** A — companion digest rule; full catalogue lives at [ai-laziness-traps.md §2](ai-laziness-traps.md). Anti-drift gate: principle slot 35 ([packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts](../../packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts)).
> **Fires:** any R-phase, audit, sample-based investigation, or open-ended AI task.
> **Authoritative for:** the resident hot digest — every §2 T-number + its one-line counter (exact-prefix quotes from the catalogue).
> **NOT authoritative for:** the full T-number entries, examples, anti-patterns, or §3 kickoff-author obligations — see [ai-laziness-traps.md §2](ai-laziness-traps.md). Project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).

**Rollback trigger:** ONE senior-seat incident of a digest-under-carried trap → full residency restored (the full catalogue re-enters the resident set), incident recorded.

## §2 T-number counters (exact-prefix quotes — anti-drift gate enforces)

- **T1** — sampling **floor = 5**; recommended depth ≥20. If first 3 look clean, that is a **sampling artifact**, not a finding. Continue to depth.
- **T2** — designing ≠ auditing. Auditing requires running the methodology against actual surfaces and reporting findings. If you find yourself writing «would detect» in §findings, replace with concrete invocation + concrete output.
- **T3** — every finding must have ONE of: (a) command + output, (b) file:line citation + the line's actual content, (c) explicit `INCONCLUSIVE-needs-LLM` or `INCONCLUSIVE-needs-human` if you cannot verify mechanically. **No prose-only findings.**
- **T4** — R-phase output must hit ALL declared sections. **Adversarial counter-prompt at the CATEGORY level** («what category did I miss?») is the discipline-applying-to-itself check; skipping it means having already failed.
- **T5** — R-phase output is a Markdown doc. If you open `Edit` on a source file during R-phase, stop. Add finding to research output, propose mechanism in §closure-proposals, leave the fix to I-phase.
- **T6** — Replace «high» with explicit predicates: «Confidence: 7/20 surfaces verified mechanically; 13/20 require LLM-judge follow-up. Coverage = 35%. Calibration: NONE — first run of this methodology, expect false-positive rate ≥20% until 2nd run.»
- **T7** — when reaching adversarial counter-prompt sections, **write the actual counter-prompt and run it**. If it surfaces nothing, that is itself suspicious — rephrase and run again.
- **T8** — if the question's answer is in the kickoff, don't ask. If the answer requires real judgment from the maintainer, ask **once at review-phase, batched** with other decisions.
- **T9** — explicit stratification — document sampling strategy. Sample across the historical window where the discipline was NOT yet active (that is where theatre concentrates). Random-uniform from full population beats convenience-recent.
- **T10** — §population-enumeration BEFORE §sampling. Order matters. Without enumeration, sampling claims are meaningless.
- **T11** — §5.1 §6 of any audit kickoff requires **build-vs-reuse SSOT consult + context7 ≥3 phrasings + WebSearch on the problem-domain term** before any «I propose…». If you find yourself proposing a mechanism without external search, stop and search first.
- **T12** — training-data knowledge has a cutoff date and is **systematically biased toward well-documented tools**. Active research areas (specification gaming, AI compliance drift) update fast and have non-obvious entries. WebSearch at the moment of proposing, not from memory.
- **T13** — the **upstream source itself may be context7-only validated**. For each ADOPTED item, audit must confirm: (a) upstream had external evidence for the pattern, OR (b) escalate item to OWN-BUILD-class audit depth.
- **T14** — clean audit AND high coverage → category is plausibly clean. Clean audit AND low coverage → finding is «coverage insufficient to conclude», not «category clean». Distinguish in the output.
- **T15** — project invariant #2 («recursive self-application green»). Every audit must include §self-application — «did this audit run on itself? what would auditing this audit look like?» — and produce a finding.
- **T16** — for every ADOPTED-MECHANISM or ADAPTED item, write explicitly: **«Upstream problem class: X. Our problem class: Y. Match? evidence: …»**. If X and Y differ, the upstream validation does NOT transfer — escalate to OWN-BUILD-class audit.
- **T17** — **BEFORE** writing the destructive prompt, the orchestrator saves deletable content with future value (extract to a preservation note / research-patch / skill-context). Preservation is the *orchestrator's* job — the junior is instructed to follow scope strictly and will not save it for you.
- **T18** — verify the redundancy **empirically** first; keep the file (deletion is the irreversible branch, keeping is reversible); preserve genuinely-unique residue via the upstream-native mechanism (e.g. a skill-context override) — never just delete.
- **T19** — run your **own** adversarial cold-review of the diff (a fresh reviewer over the actual change) BEFORE handoff. CI checks form/structure (lint, trailers, schema), not design substance. «Merge» is the maintainer's decision; «QA» is yours.
- **T20** — Before issuing any recommendation/verdict in dialogue, run **at least ONE** evidence-bearing tool call in the same turn and **quote its output** (file:line, command result, fetched excerpt). The recommendation is then **backed**, per parent rule [`phase-research-coverage.md §1.12`](phase-research-coverage.md).
- **T21** — **Delegate the sweep to a cold sub-agent** — [`agents/backward-sweep-auditor.md`](../../agents/backward-sweep-auditor.md). Hand it ONLY the change's *class* (never the diff or PR narrative); it enumerates every parallel surface and reports GAP/CLEAN per surface.

## See also

- [ai-laziness-traps.md §2](ai-laziness-traps.md) — full catalogue with trigger pattern + tempted output + countermeasure per T-number.
- [packages/core/principles/12-ai-laziness-traps.test.ts](../../packages/core/principles/12-ai-laziness-traps.test.ts) — kickoff §3 T-enumeration check (executor-side; unchanged).
- [packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts](../../packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts) — anti-drift gate (digest ↔ catalogue).
