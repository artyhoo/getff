---
name: intent
description: 'Use when clarifying or preserving PRODUCT intent — turning a raw feature idea into an agreed product brief, keeping that intent across stages, and reviewing a first working result against it. Triggers: /intent, product intent, product brief, clarify the feature, what should the user get, intent session, result review, продуктовый смысл, замысел продукта, что получит пользователь. NOT for solution design (/arch), stage dispatch (/pipeline), code review (/reviewer), or factory runtime questions (aif-doctor).'
arguments: [topic-or-product-brief]
argument-hint: '<topic | path/to/product-brief.md>'
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - Write
  - Edit
  - Skill
  - Bash(git *)
  - Bash(ls *)
  - Bash(cat *)
---

<!-- @harness-posture: cc-native-with-fallback — degradations: no subagents → the product-only advisor seat degrades to a fresh artifact-only read of the brief and recorded decisions; no AskUserQuestion → serial questioning; no Skill invocation → direct file reads of the companion procedures; no aif bridge → result-review publication stays file-based and the continuation check stays helper-CLI -->

# /intent — product intent contour

> **Class:** C — choreography wrapping the existing interview/advisor path; it owns ONLY the product boundary.
> **Authoritative for:** the product-discussion routing boundary (§1), the product brief's shape and approval/snapshot contract, the product-only advisor instantiation, and the location of the named result-review protocol.
> **NOT authoritative for:** solution design ([/arch](../arch/SKILL.md)), stage execution ([/pipeline](../pipeline/SKILL.md)), the advisor transport mechanics ([advisor pattern design](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md)), or the result-review record schema and continuation-check effects — see [references/result-review.md](references/result-review.md). Project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Invocation-channel flag, not a permission.** `disable-model-invocation: true` keeps a skill out of auto-load and out of subagent preload, and stops the Skill tool from invoking it — an explicit `/<name>` from the operator is its only invocation channel, so an agent never self-initiates the procedure. It does **not** seal the file: an agent already asked to do this work may read the SKILL.md and execute its documented steps, and doing so is correct behaviour, not a workaround. On ZCode the flag is not runtime-enforced (absent from the runtime, survey #1699 §5): there the explicit-only channel discipline is prompt-level — this blockquote is the gate, so an agent on ZCode must still treat an explicit /<name> as the only self-initiation channel. <!-- canonical: invocation-channel-flag -->

Input: a topic or an existing product-brief path. Result: an approved product brief held as an immutable snapshot, a product-only advisor prepared from it, and — for feature work — result reviews of first working results. The interview/advisor machinery is reused AS IS; this contour owns only the product boundary.

## §1 Routing boundary (the adapter's one decision)

Routing reuses the accepted rules — the same three live in the [/arch ideation reference](../arch/references/ideation.md), which routes INTO this procedure:

- **Small precise changes stay in `/arch`** — work whose meaning is settled and precise needs no product session.
- **A substantial feature whose product meaning is still unclear enters `/intent`** — substantial means the work must hold one distinct promise across multiple component or stage decisions, not a document-length threshold.
- **An approved brief is reused without another interview** — later sessions restore from the approved snapshot ([references/product-brief.md](references/product-brief.md)); re-interviewing the operator over an agreed brief is a routing failure.

Direct `/intent` is always available; `/arch` may also route here explicitly by loading this procedure. Routing is a judgment recorded per contour — the three boundaries above are its contract, not a mechanical classifier.

## §2 Product discussion

1. Read [product brief](references/product-brief.md) before the first question. Adopt the installed companions AS IS — `superpowers:brainstorming`, then the pinned `grilling`/`domain-modeling` pair with their exact fallback rules, as bound by the [arch ideation reference](../arch/references/ideation.md). Never re-describe them here.
2. **Domain-modeling permission (mirrors the [CLAUDE.md binding](../../../CLAUDE.md)):** inside a product discussion — a direct `/intent` session, or the named `/arch` product route — the `mattpocock-skills:domain-modeling` moves apply to the brief's distinctions. **Preserved exclusion:** an ordinary word-definition question outside a product discussion keeps the `CONTEXT.md` growth rule — explain the word, record it with the operator's spelling — and no ADR is offered.
3. **Understanding check, not receipt of IDs.** Before the brief is agreed, the advisor explains the experience in plain language, distinguishes one permitted outcome from a plausible wrong interpretation, and names the unresolved preferences. Architecture and implementation conversation is never fed to the product seat; [references/product-brief.md](references/product-brief.md) owns the check-and-restore contract.

## §3 Result review

The named result-review protocol lives in [references/result-review.md](references/result-review.md): a FRESH artifact-only instantiation of the advisor responsibility compares the observed first working result with the approved brief, challenges incomplete evidence, and publishes one immutable record per attempt. This card never restates it.

## Without this skill

Product meaning is renegotiated implicitly inside design or execution sessions: the implementer's narrative substitutes for the operator's promise, an already-agreed brief gets re-interviewed or silently rewritten, and a first result that is technically correct but misses the product point passes every ordinary technical gate — detected by no one until the operator reads the diff.

## With this skill

Product intent is captured once as an approved immutable brief and restored from that snapshot everywhere; substantial-but-unclear work enters a dedicated product contour while small precise work stays in `/arch`; and the first working result is compared against the brief by a fresh product-only advisor, so a plausible-but-wrong result is held before dependent expansion spends on it.

## See also

- [/arch](../arch/SKILL.md) — the sibling solution-design contour; its ideation reference owns the route INTO this procedure, its exit reference the product-discussion exit.
- [Advisor pattern design](../../../docs/superpowers/specs/2026-08-10-advisor-pattern-design.md) — the consultation, journal-before-answer and restoration mechanisms this contour reuses.
- [intent-first spec](../../../docs/superpowers/specs/2026-10-07-idea-arch-incremental-design.md) — the product source of this contour (§1 experience, §3 brief and routing, §5-§6 review and continuation).
