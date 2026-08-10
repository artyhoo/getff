# Recommendation-laziness discipline — mechanism layer

<!-- channel: digest .claude/hooks/inject-session-bootstrap.sh#H1 -->

> **Class:** C — prose-only, no companion executable artifact. Promotion criterion in §6.
> **Fires:** before an inline verdict/recommendation or an ambiguous fork.
> **Authoritative for:** mechanism layer + named anti-pattern catalogue entry for inline-chat verdict-without-evidence pattern; promotion criterion in §6.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Recommendation discipline rule itself — see [phase-research-coverage.md §1.12](phase-research-coverage.md) (parent rule, source-of-truth for prose discipline). T-trap catalogue — see [ai-laziness-traps.md §2](ai-laziness-traps.md) (sibling enforcement surface).

> **Origin:** 2026-05-25. Codifies the mechanism layer that the parent rule [`phase-research-coverage.md §1.12`](phase-research-coverage.md) (introduced 2026-05-22) explicitly defers to a separate enforcement scaffold. R-phase: [`docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md`](../../docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md) (merged PR #206/#207). Benchmark: [`docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md) (merged PR #210; verdict: Option D = A+C only, B dropped).

## §1 Problem

R-phase §1.1 documented 3 inline-verdict events in a single session under a live H1 always-on reminder — evidence that the H1 reminder alone is empirically insufficient. The parent rule [`phase-research-coverage.md §1.12`](phase-research-coverage.md) introduces the prose discipline («Lead with a reasoned recommendation; act when the best path is clear») but leaves enforcement open with the note: «Mechanical enforcement of (1) is blocked until the recommendation-detector recall is fixed — prose-only meanwhile.» This file is the mechanism layer that fills that enforcement gap, scoped to what the benchmark verdict permits. Full evidence base at [`docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md §0/§1.1`](../../docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md).

## §2 Trigger (when this rule fires)

An AI session is about to issue an **inline-chat verdict, recommendation, or design call** — any of:

- Verdict words: `ADOPT`, `BUILD`, `REJECT`, `DEFER`
- Directive phrases: «we should X», «use Y», «pick A over B», «лучше Z», «выбираем W», «recommend X»

— **without having run at least one evidence-bearing tool call** (`Bash | Read | Grep | Glob | WebFetch | WebSearch`) in the same turn. The recommendation is fabricated from training-data or session-recall rather than grounded in present-moment verification.

## §3 The rule

Parent rule [`phase-research-coverage.md §1.12`](phase-research-coverage.md) states:

> «Lead with a reasoned recommendation; act when the best path is clear.»

**Operationalisation:** Before issuing any verdict or recommendation in dialogue, run **at minimum one evidence-bearing tool call** in the same turn and **quote its output** (file:line, command result, or fetched excerpt). The recommendation is then backed rather than vibes-only.

**This file does NOT redefine `phase-research-coverage.md §1.12` — it operationalises it.** The prose discipline source-of-truth remains §1.12. This file is the mechanism layer that §1.12 explicitly defers.

**Fork-surfacing companion (added 2026-06-01, maintainer dialogue).** The evidence rule above governs the *clear-answer* path (back a verdict, then act). The *ambiguous-fork* path is its mirror: when a fork has **no determinate best answer on the project's merits** (taste / strategy / operator preference), it MUST be **surfaced via `AskUserQuestion`** — never decided by a silent direct action (a command, edit, or dispatch that bakes in the choice). **Operating posture (maintainer decision 2026-06-01): autonomous by default — the human-gate fires ONLY on a genuine ambiguous fork; a clear call (one option better on the merits) is decided and *reported*, NOT routed through a question.** The [`ask-question-reminder.sh`](../hooks/ask-question-reminder.sh) hook (§4 channel) is the discriminator that enforces exactly this split: it bounces a *clear* fork back to «decide it yourself, say what you did» and lets a *genuine* fork through after a recommendation. Surfacing a genuine fork via the ask-channel preserves it in the chat transcript (open AND resolved — what was asked, what was answered, why, what alternatives) — the operator's control+audit surface. **Operator role = control + ability to intervene, NOT decide-everything** (memory `operator-control-not-decide-everything`): answer the unambiguous autonomously, surface only the genuine forks. Full autonomy (a poller closing the loop with no human keystroke) is mechanically possible; the chosen posture keeps the human on ambiguous forks only.

## §4 Enforcement channel

Two layers ship per Option D = A+C benchmark verdict:

**(A) H1 wording in `.claude/hooks/inject-session-bootstrap.sh:11`** (Sub-wave A of this I-phase) — always-on UserPromptSubmit injection; deterministic; fires every turn. Channel per [`rule-enforcement-channel-selection.md §4`](rule-enforcement-channel-selection.md): UserPromptSubmit digest, always-on.

**(C) T-trap in [`.claude/rules/ai-laziness-traps.md §2 T20`](ai-laziness-traps.md)** (Sub-wave C of this I-phase) — **T20** per maintainer override of R-phase §1.4 (b) pre-resolution (Sub-wave C shipped 2026-05-24 via [PR #212](https://github.com/Yhooi2/rules-as-tests-aif/pull/212), merge commit `eac9dce`). Auto-loaded session-start via `.claude/rules/*.md` CC convention; path-scoped reinforcement via `inject-matching-rule.sh` when touching `.claude/rules/**`.

**(B) Stop-hook scan — EXPLICITLY DROPPED** per [`narrow-b-benchmark.md §1.5`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md):

> `FP_rate = 84.2% (Wilson 95% CI: [62%, 95%], n=19) >> 20% threshold → Drop narrow-B from Option D. Option D = A+C only.`

Not shipped. Re-introduction requires a new R-phase + benchmark (per benchmark §Prevention §4 — «двухуровневый подход»: narrow dict + lemma-based matching = future R-phase fork).

**Recall caveat (load-bearing per kickoff §5 S3):** any post-hoc grep tooling proposed in the future MUST account for the benchmark's recall caveat. Benchmark §1.3 Метрики block computes `recall = TP/(TP+FN) = 3/3 = 1.0 (грубо; n=10 no-match sample only)`. Benchmark §T19 Cold-QA explicitly downgrades this: «recall=1.0 on n=10 no-match sample is speculative; не следует интерпретировать как `filter не пропускает настоящих verdicts`. Настоящий recall, скорее всего, низкий: большинство genuine verdict acts находятся в длинных turns (>750 chars) и turns с tool_use.» Automated grep cannot claim catch-rate without a manual classification sample on a representative production corpus.

## §5 Anti-patterns

- **`#inline-verdict-without-evidence`** — verdict or recommendation issued in dialogue without a preceding evidence-bearing tool call in the same turn. Specialisation of parent anti-pattern [`#recommendation-skips-own-discipline`](phase-research-coverage.md) (§4 of parent rule) onto the inline-chat surface. Cross-reference to [T20](ai-laziness-traps.md) (per §4 (C) above).
- **`#fork-decided-by-silent-action`** — a genuine taste/strategy fork (no determinate best on the project's merits) embedded directly in an action (command, edit, dispatch) that bakes in the choice, *without* first surfacing it via `AskUserQuestion`. The decision never reaches the chat → the operator can neither see it nor intervene — the exact failure the question-loop exists to prevent. This is the path the `ask-question-reminder.sh` hook cannot catch: it fires only when you *do* ask, not when you silently act. **Counter:** route genuine forks through `AskUserQuestion` (default-surface, §3 fork-surfacing companion); the hook then discriminates clear-vs-genuine. Detectability = **judgment, not mechanical** → injection-only enforcement (ask-hook + the [`end-of-turn-reminder.sh`](../hooks/end-of-turn-reminder.sh) Branch-A backstop), **never a gate** — gating a judgment rule is `#gate-where-judgment-needed` ([rule-enforcement-channel-selection.md §5](rule-enforcement-channel-selection.md)), the same reason §4 (B)'s narrow-B verdict-scan was dropped at FP 84%. Incident 2026-06-01 (PR #348 battle-test): an explicitly-50/50 README-structure fork was auto-decided by running `answer.ts --decision resume` directly, bypassing the ask-path entirely.

## §6 Promotion to Class A / retirement

**Promotion to Class A (principle test):** when 3+ documented in-session violations within 6 months are recorded — each with file:line evidence in `.claude/rules/` or `research-patches/` — consider a mechanical post-hoc grep gate. Per benchmark §1.3 + §T19 recall caveat (recall=1.0 on n=10 is speculative — true recall likely low; most genuine verdict acts live in long turns >750 chars or turns with tool_use), any such gate **MUST** include a manual classification sample on a representative production corpus before claiming any catch-rate. Automated metrics alone are insufficient.

**Retirement:** 12 consecutive months with zero recorded incidents → archive to `CLAUDE.md` prose. Matches peer-rule retirement criteria in [`reviewer-discipline.md §4`](reviewer-discipline.md) and [`parallel-subwave-isolation.md §4`](parallel-subwave-isolation.md).

## See also

- [`phase-research-coverage.md §1.12`](phase-research-coverage.md) — parent rule (prose discipline source-of-truth; this file operationalises it, does not supersede it)
- [`phase-research-coverage.md §1.11`](phase-research-coverage.md) — sibling rule (verify-against-source-of-truth before claim or ship-step)
- [`phase-research-coverage.md §4 #recommendation-skips-own-discipline`](phase-research-coverage.md) — named anti-pattern this rule operationalises (§5 above is its inline-chat-surface specialisation)
- [`ai-laziness-traps.md §2 T20`](ai-laziness-traps.md) — T-trap catalogue (T20 per maintainer override of R-phase §1.4 (b); shipped via PR #212 2026-05-24)
- [`docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md`](../../docs/meta-factory/research-patches/2026-05-24-recommendation-laziness-discipline.md) — R-phase design (merged PR #206/#207)
- [`docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md) — benchmark patch (merged PR #210; B-drop verdict)
- [`doc-authority-hierarchy.md §3`](doc-authority-hierarchy.md) — header format spec this file follows
- [`rule-enforcement-channel-selection.md §3-§4`](rule-enforcement-channel-selection.md) — channel-selection rationale (A = always-on UserPromptSubmit; C = path-scoped rule injection)
