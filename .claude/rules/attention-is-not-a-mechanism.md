# Attention is not a mechanism — discipline rule

> **Class:** C — prose-only; promotion criterion in §3.
> **Authoritative for:** the attention-is-not-a-mechanism discipline — §1 the rule (human/AI
> attention may be merge AUTHORITY, never the DETECTION layer), §2 anti-patterns, §3 promotion.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Reviewer role
> separation — see [reviewer-discipline.md](reviewer-discipline.md). CI LLM ban — see [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md).

> **Origin:** 2026-07-03 owner directive during MT stage-4 design (DocPlan trust model).
> Evidence base: P3 (a flipped «Enforces» claim in AGENTS.md caught by NOTHING — zero readers);
> T21 incident PR #857 (loaded-context restatement passed a syntactic gate); this session's own
> cold-review catching an author-blind BLOCKER the author re-read past.

## §1 The rule

A load-bearing check MUST be one of: (a) a deterministic gate at the earliest reachable
channel, or (b) a NAMED cold-agent protocol with structured output (compliance-verifier /
backward-sweep-auditor / docplan-auditor class). Bare human attention — «a reviewer will read
the diff» — and unstructured AI attention — «the model will notice» — are NOT mechanisms; they
may serve only as decision/merge authority on top of (a)/(b). Corollary: a WARNING whose only
consumer is «someone reads the log» is attention-dependent detection — either promote to
error-with-escape-token (rationale ≥20 chars; precedent [ci-tool-pinning.md §3](ci-tool-pinning.md)) or route to a
named agent audit.

## §2 Anti-patterns

- `#hope-as-gate` — a check whose failure mode is «nobody looked». Counter: (a)/(b) above.
- `#warning-nobody-reads` — load-bearing warnings. Counter: error+escape or agent-audited.

## §3 Promotion / retirement

Promote to audit-checklist dimension (Phase -1 / reviewer protocols) after 3 documented
incidents in 6 months where a bare-attention check missed a real defect. Retire to CLAUDE.md
prose after 12 incident-free months (peer criteria: [reviewer-discipline.md §4](reviewer-discipline.md)).

## §4 §1.7 self-reflexive note

First consumers ship with MT S4: composition gate FF8002 as error+excluded-escape (not
warning), and `agents/docplan-auditor.md` replacing «human reads the plan diff». This rule
complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (agents are session-read) and [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md).
