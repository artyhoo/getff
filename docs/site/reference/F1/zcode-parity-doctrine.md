---
title: zcode-parity-doctrine rule
description: The doctrine that anything shipping on Claude Code ships equivalently on ZCode — a binding per-hook census with a classification for every hook, accepted-degradation rationale where an event is inexpressible, and a runtime probe that checks the binary rather than the docs.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/zcode-parity-doctrine.md
  - .agents/rules/00-rule-index.md
  - scripts/render-harness-config.mjs
  - packages/core/hooks/zcode-runtime-probe.test.ts
  - scripts/probe-zcode-runtime.sh
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: events-and-census-count, stack: repo, date: 2026-10-11, result: zcode-events-7-hooks-26 }
---

# zcode-parity-doctrine rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-zcode-parity-doctrine plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `zcode-parity-doctrine` |
| kind | rule |
| ships-to | framework |
| description | the canonical ZCode-parity SSOT — §2 per-hook census (binding, extends [census.md](../../docs/meta-factory/research-patches/2026-07-18-zcode-full-parity-census.md)), §3 per-stage decision rollup (binding, extends [decisions.md](../../docs/meta-factory/zcode-parity-mega.decisions.md)), §4 degradation rationale per CC-only hook, §5 agnosticism tier table. |
| source | `.agents/rules/zcode-parity-doctrine.md:20` |
| class | A |
| fires | editing hook twins, the harness-config renderer, or zcode-parity decision docs. |
| channels | paths:(11), edit-time inject |
<!-- getff:end section=F1-card-zcode-parity-doctrine -->

<!-- vale on -->

## Explanation

The framework is AI-agnostic by design: any harness with a Claude Code-compatible
hook system should work, and no harness is rejected on the road to that goal. The
working stance, quoted verbatim in the rule from the operator's decision, is
Claude Code-first today with analogues for the rest — even degraded support is
acceptable, silent divergence is not. This [rule](../../terms.md#rule) is the
doctrine that keeps the second harness honest: a binding census of every hook the
framework ships, classified per hook as full parity, framework-internal, degraded
gap, or Claude Code-only — with the rule that a hook absent from another harness
carries documented degradation rationale, never a shrug.

The expressibility boundary is a concrete list, not a vibe. The harness config
renderer defines exactly which lifecycle events the second harness can express:

```bash
grep -n "ZCODE_EVENTS" scripts/render-harness-config.mjs | head -2
ls .claude/hooks/*.sh | wc -l
```

```text
47:const ZCODE_EVENTS = new Set([
257:    (ev) => !ZCODE_EVENTS.has(ev),
26
```

Seven events are expressible; subagent lifecycle, worktree creation, and
compaction are not — which is why four census rows carry accepted-degradation
rationale rather than parity claims. One row's rationale is the doctrine's best
example of intellectual honesty under pressure: when compaction shipped on the
other harness as a feature, the row did not silently flip to parity — the runtime
bundle was probed, the feature was found to fire no lifecycle event of any kind,
and the record now says to probe the binary, not the vendor doc.

The `class` row is `A`, with an honest asterisk the rule states itself: the
doctrine is a pointer-aggregator, its own companion gate is the authority-header
test every canonical doc passes, and the *substance* is enforced by gates that
already existed — chiefly a runtime-probe test that asserts the binary's event
enum, trust-channel markers, and hook input/output literals against the installed
bundle, failing on drift before any documentation is trusted.

One drift is visible from this batch's own working tree, and the page records it
rather than smoothing it over: the census rollup equates its total (23 rows) with
the hook-directory count at its census baseline, and the directory today holds 26
scripts — three hooks have landed since. The table binds its 23 rows; the tree has
moved; the rollup line still points at the baseline, not the present.

What the rule does not do: it does not make hooks portable — four lifecycle events
remain inexpressible and four rows stay Claude Code-only by documented decision.
And its compatibility table grades one third harness as docs-verified, not
live-tested — the disclosure it calls load-bearing, refusing a runtime claim the
evidence does not carry.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The Class-A header and where enforcement actually lives: `.claude/rules/zcode-parity-doctrine.md:18`.
- `§1` the goal and the verbatim operator stance: `:26` to `:34` (quote at `:30`
  to `:32`).
- `§2` the binding census: `:36` to `:70` — the `ZCODE_EVENTS` definition cited at
  `:40`, the 23-row table at `:42` to `:66`, the classification rollup at `:68`,
  the accepted delivery asymmetry at `:70`.
- `§3` the per-stage decision table: `:72` to `:91`.
- `§4` the per-degradation rationale: `:93` to `:113` — the compaction row's
  probe-the-binary record at `:101`, the reader-half row at `:103`, the MultiEdit
  matcher note at `:109`.
- `§5` the agnosticism tier table and the docs-verified-not-live-tested Cursor
  caveat: `:115` to `:128`.
- `§6` cross-references, including the runtime-probe gate: `:130` to `:138`
  (`:137`).
- The renderer quoted above: `scripts/render-harness-config.mjs:47`, `:257`; the
  probe pair: `packages/core/hooks/zcode-runtime-probe.test.ts` +
  `scripts/probe-zcode-runtime.sh`.
- The scope markers: `:2` to `:14` (`paths:` frontmatter, eleven entries), `:23`
  (`<!-- globs: -->`), `:24` (`<!-- inject: -->`).
- The index row grading this rule class `A` with channels `paths:(11), edit-time
  inject`: `.claude/rules/00-rule-index.md:39`.
