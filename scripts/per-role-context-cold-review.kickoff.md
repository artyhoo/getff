<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: kickoff — per-role-context COLD REVIEW. One-shot external-review task: take the 3 prior GLM deliverables and audit them as a skeptical external reviewer with NO memory of how they were written. Find overreach, underclaims, errors, missing evidence, hidden recommendations disguised as neutral observations. Operator-commissioned 2026-07-26. -->

# per-role-context-cold-review — kickoff

> **Goal:** cold external review of the 3 prior GLM-5.2 research deliverables on per-role context. You did NOT write them. You have NO memory of the design decisions. Be skeptical.
>
> **Why this task exists:** the prior session was a GLM-5.2 orchestrator that produced 3 deliverables (raw research patch + candidate-shapes catalogue + inflight-context dossier). The operator wants a cold second opinion before these reach Opus filtering / fabla decision. GLM-reviewed-GLM is a known failure mode (drift on shared assumptions); this task is the antidote.
>
> **Output:** write `per-role-context-cold-review-report.md` to project root with the audit findings. No code changes. No fixes to the deliverables (those happen in a follow-up if the operator agrees with the findings).

## §0 What this task is NOT

- NOT a re-research. Do NOT redo the prior research's work.
- NOT a fix-it session. You audit; you do NOT modify the deliverables.
- NOT an opinion on whether per-role context is desirable. You audit the DELIVERABLES' quality, not the underlying question.
- NOT a license to modify `.claude/`, `packages/`, `scripts/`, or any rule.

## §1 Targets — the 3 prior deliverables (read each end-to-end FIRST)

1. `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` — claims to be "raw material for Opus cold-verify" with 10 falsifiable claims (C1-C10) + 8-item verify-list + 5 parked forks.
2. `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` — claims to be "candidate shapes catalogue (α-σ), no priority, no recommendation, no verdict."
3. `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` — claims to be "in-flight context, not analysis."

## §2 What to audit — the cold-review checklist

For EACH of the 3 deliverables, evaluate against this checklist. Find at least one issue per item if possible; if a deliverable is genuinely clean on an item, say "CLEAN" with one-line reasoning.

### A. Format honesty — does the deliverable do what it claims?

- **A1.** The raw research patch claims "no recommendation, no verdict." Does it actually avoid them? Look for hidden recommendations disguised as neutral observations (e.g. "this is the natural host" — recommendation masked as observation). Cite line numbers.
- **A2.** The candidate-shapes catalogue claims "no priority, no ordering." Are shapes really unordered? Or is there implicit priority via ordering, headings, language like "may be worth particular attention"?
- **A3.** The inflight-context dossier claims "not analysis." Does it actually avoid analysis? Or does it slip into evaluative statements?

### B. Claim quality — are the 10 claims (C1-C10) actually falsifiable?

For each of C1-C10 in the raw research patch:

- **B1.** Is the "Wrong if:" falsifier actually a falsifier? Or is it so weak that the claim is unfalsifiable in practice?
- **B2.** Is the evidence cited (file:line or URL) actually load-bearing for the claim? Or is it tangential?
- **B3.** Is the claim's scope clear? Or does it over-generalize from one instance?
- **B4.** Is the GLM-confidence label honest, or is it performative?

### C. Hidden pressure / recommendation language

- **C1.** Scan all 3 deliverables for: "natural host", "strongest candidate", "best option", "we should", "should pick", "recommend", "priority", "Estimated effort", "Pros/Cons", "Comparison matrix", superlatives.
- **C2.** For each hit: is it neutral observation, or hidden steering?
- **C3.** The candidate-shapes file is supposed to NOT recommend. Does the §6 "Note on shape overlap" or any shape's "Unverified assumptions" sneak in implicit preference?

### D. Completeness — does the deliverable miss what it should have covered?

- **D1.** Raw research patch: are there claims that SHOULD have been made but weren't? (e.g. about the consumer install surface, about `packages/core/`, about `~/.claude/CLAUDE.md` and `MEMORY.md`.)
- **D2.** Candidate-shapes: are there obvious shapes GLM didn't brainstorm? (e.g. "do nothing and codify that as the answer" is shape π — but is there a shape ω or others GLM missed?)
- **D3.** Inflight-context: are there in-flight items GLM missed? Check the live `git worktree list`, `gh pr list`, and `git log origin/staging..HEAD` yourself.

### E. Verifiability — can Opus actually run the 8-item verify-list?

For each item in the raw research patch's verify-list (§"Verify-list for Opus cold-verify"):

- **E1.** Is the instruction concrete (a runnable command or checkable file)? Or is it vague ("verify X")?
- **E2.** Is the expected output clear? Or could Opus run it and not know what to conclude?
- **E3.** Is the item free of operator-jargon that a cold reader wouldn't understand?

### F. Internal consistency

- **F1.** Do the 3 deliverables contradict each other? (e.g. one says "X is absent", another assumes X exists.)
- **F2.** Does the raw research patch's C1-C10 set actually support (or constrain) the 18 candidate shapes? Or are the shapes disconnected from the evidence?
- **F3.** Are file:line citations still accurate? Spot-check 5 random citations by reading the cited lines.

### G. Framing bias

- **G1.** Does the deliverable frame the question in a way that pre-loads the answer? (e.g. framing "per-role context is desirable, here's how to do it" vs "is per-role context desirable?")
- **G2.** Does the F2 anti-drift framing (uniform digest = deliberate anti-drift) get appropriate weight? Or is it over-emphasized to push toward shape ζ/π?
- **G3.** Does the candidate-shapes catalogue include shapes that ARGUE AGAINST the operator's framing (e.g. shape π codifies "no per-role context")? Or is the catalogue biased toward action?

### H. Token-economy for downstream

- **H1.** Could the deliverable be 50% shorter without losing load-bearing content? Identify the bloat.
- **H2.** Are the citations structured so Opus can verify without re-reading the whole deliverable? Or does Opus have to read everything to verify anything?
- **H3.** Is the 8-item verify-list actually shorter than re-doing the research from scratch? If not, the deliverable failed its purpose.

## §3 Anti-flattery — what to do if you find the deliverable is genuinely good

If a deliverable is genuinely clean on a checklist item, say "CLEAN" with a one-line reason. Do NOT invent problems to look thorough. Anti-flattery cuts both ways: don't praise to look kind, and don't manufacture criticism to look rigorous.

If the deliverable has a genuine strength worth noting (e.g. "the falsifier pattern in C10 is exemplary"), note it briefly — but the bulk of the report should be findings/issues, not praise.

## §4 Output format

Write `per-role-context-cold-review-report.md` to project root:

```markdown
# Per-role context — cold review report

**Reviewer:** aif-handoff container (cold external reviewer, no memory of how deliverables were written)
**Reviewed:** 3 prior GLM-5.2 deliverables (raw research patch, candidate-shapes catalogue, inflight-context dossier)
**Date:** <timestamp>

## Executive summary (≤5 lines)

<overall verdict: are the deliverables fit for Opus cold-verify? Are they honestly "raw material" or stealthily spec-flavored? Major issue if any.>

## Findings by checklist (A-H)

### A. Format honesty
- A1 (raw research): <finding + line cites>
- A2 (candidate shapes): <finding + line cites>
- A3 (inflight): <finding + line cites>

### B. Claim quality (C1-C10)
| Claim | Falsifier quality | Evidence load-bearing? | Scope clear? | Honesty of confidence label? |
|---|---|---|---|---|
| C1 | ... | ... | ... | ... |
| C2 | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |

### C. Hidden pressure / recommendation language
<table of hits + verdict neutral vs steering>

### D. Completeness
<missed claims, missed shapes, missed in-flight items>

### E. Verifiability of the 8-item verify-list
<table: item, concrete?, expected output clear?, jargon-free?>

### F. Internal consistency
<contradictions, shape-evidence disconnect, citation accuracy spot-check>

### G. Framing bias
<frame pre-loading, F2 weight, action-bias>

### H. Token-economy
<bloat, citation structure, verify-list efficiency>

## Highest-priority issues (top 3-5)

<the issues most likely to mislead Opus or the fabla>

## What the deliverables got right

<brief honest acknowledgment — not flattery>
```

## §5 Constraints

- **Read-only.** Do NOT modify the deliverables. Audit only.
- **Cold.** Do NOT assume the deliverables are correct. Do NOT assume they are wrong. Verify.
- **Skeptical but fair.** Don't manufacture problems; don't hide real ones.
- **Cite line numbers** for every finding in the deliverables.
- **Time-boxed.** If a checklist item is taking too long, summarize and move on.
- **No recommendation on the underlying question** (is per-role context desirable?). You audit the deliverables; the fabla decides.

## §6 See also (read but do NOT re-derive)

- The 3 deliverables (§1).
- The raw research patch's 8-item verify-list — your §E evaluates its quality; you do NOT run the verifications.
- The deep-project-research task (parallel) — extends the claims; you audit whether the claims AS WRITTEN are sound.
- The runtime-probe task (parallel) — verifies live behavior; you audit whether the live-verification plan is sound.
