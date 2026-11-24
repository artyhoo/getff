# §10.3a — Plain-language checkpoint tail (orchestrator-checkpoint substance standard)

<!-- @dual-pair: plain-language-tail -->
<!-- spec: .claude/skills/pipeline/SKILL.md §10.3a stub + .claude/hooks/end-of-turn-reminder.sh -->

> **Authoritative for:** the orchestrator-checkpoint substance shape for the `## 🟢 In plain words` tail — the three checkpoint moments and their required content items. Companion to [SKILL.md](../SKILL.md) §10.3a (which carries the one-line stub binding).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). The per-turn generic tail enforcement — owned by [end-of-turn-reminder.sh](../../../hooks/end-of-turn-reminder.sh).

Generic per-turn end-of-turn substance is enforced by [`.claude/hooks/end-of-turn-reminder.sh`](../../../hooks/end-of-turn-reminder.sh) (Stop hook, fires on long-text / question / claim-bearing turns). It enforces presence of the `## 🟢 In plain words` block via the Stop hook `decision:block` mechanism with anti-rationalization wording (Branch A/B/C/D + factual-claim scan): the hook fires `decision:block` with a `reason` payload, and the model adds the section in the next turn to unblock. The hook does NOT inject the section text directly — only the requirement.

## What this section adds — orchestrator-CHECKPOINT-specific substance

The meta-orchestrator runs in _long sessions with sub-wave boundaries_. At each of these three moments, the inline session report MUST end with a `## 🟢 In plain words` block whose **content** follows the orchestrator-checkpoint shape below — distinct from the hook's per-turn generic substance:

| Checkpoint moment                                                                                    | Block content required (in this order)                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Sub-wave boundary** (after any Worker REPORT or Reviewer GO/REVISE)                                | (a) what the just-finished sub-wave produced (1 line, name file/PR/finding); (b) which AC item it satisfied; (c) what the next sub-wave needs from this output; (d) any DECISION-NEEDED surfaced |
| **Mid-session quota checkpoint** (cumulative Opus ≥ soft 200k OR Phase -1 cold-review pass complete) | (a) cumulative Opus + zone (green/yellow/red); (b) sub-waves done vs remaining; (c) defer/continue recommendation with rationale; (d) any escalation surface                                     |
| **Final umbrella report** (before `gh pr create`)                                                    | (a) AC items 1-7 with `[x]`/`[ ]`; (b) Worker/Reviewer REPORT-trace per item (CI/grep/REPORT-quote); (c) known residuals carried forward; (d) follow-up PRs queued                               |

## What NOT to put here (hook owns it)

- Generic «what did I just do this turn» — the hook's Branch A already covers it.
- Question-validation («is this a real fork?») — the hook's Branch B/C + `ask-question-reminder.sh` already cover it.
- Factual-claim re-verify enumeration — the hook's claim-scan already enumerates per-item.

## Falsification

If this section's content is verbatim-copyable from `end-of-turn-reminder.sh` reminder text, it has drifted into `#two-prompts-drift` (per `.claude/rules/dual-implementation-discipline.md §4`). Counter: orchestrator-checkpoint substance names sub-waves, AC items, REPORT-traces, dispatch-state — not per-turn personal-reasoning prose.

## Anti-pattern checks

- `#two-prompts-drift` — content drifts to duplicate the hook's per-turn reminder text. Counter: re-anchor on sub-wave / AC / REPORT-trace nouns.
- `#tail-without-orchestration-content` — block fires but content has no orchestration nouns (no sub-wave name, no AC item, no file:line). Counter: at least one of the four required content items must reference a concrete orchestration artefact.
- `#skip-on-substantive-checkpoint` — block omitted on substantive checkpoint claiming «short response, hook didn't fire». Counter: the three checkpoint moments are MANDATORY regardless of turn-length; only one-line tool acknowledgements and pure CLI outputs are skip-allowed.
