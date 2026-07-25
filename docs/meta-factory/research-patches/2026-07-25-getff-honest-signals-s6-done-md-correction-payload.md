# `done.md` closure-record correction payload — getff-honest-signals S6

> **Class:** research patch — incident record feeding the umbrella-closure-honesty discipline (a sibling of [ai-laziness-traps.md §2 T21](../../rules/ai-laziness-traps.md) applied to the durable closure artefact itself).
> **Origin:** 2026-07-25, auto-review gate iteration 2 on the S6 `inject-matching-rule` PR. Blocking finding `[b62ff0b183a6]`: the `done.md` closure record at `.claude/orchestrator-prompts/getff-honest-signals/done.md:4` overclaims «umbrella-wide — every shipped hook» when 2 sibling consumer-shipped hooks (`inject-project-digest.sh`, `deps-hash-check.sh`) still carry the same silent-exit defect class.
> **Scope:** this patch is the **load-bearing channel** for the verbatim corrected `done.md` payload the host-side harvesting session MUST apply before `gh pr create`. The in-container path `.claude/orchestrator-prompts/getff-honest-signals/done.md` is matched by the harness sensitive-file classifier — `Edit`, `Write`, and `Bash` heredoc are all denied (verified live by an Edit probe returning «sensitive file», not just asserted). Round 1's correction lived only in chat output and the gitignored plan file `.ai-factory/plans/getff-honest-signals-s6.md` — neither reaches a fresh harvester without chat context. Round 2 promotes the correction into a tracked research patch so the harvesting session WILL consume it from `git log` / `git diff origin/staging..HEAD` without any chat-side context.

## §1 The overclaim

Current line at `.claude/orchestrator-prompts/getff-honest-signals/done.md:4`:

```text
- Summary: Honest signal for silent no-op shipped umbrella-wide — every shipped hook that can no-op forever on missing input now reports the gap once loudly per session instead. S6 closes the umbrella by teaching inject-matching-rule the same pattern when the consumer's .claude/rules/ corpus is absent.
```

The phrase **«every shipped hook that can no-op forever on missing input now reports the gap once loudly per session instead»** is factually false. This PR taught exactly ONE hook (`inject-matching-rule`) the honest-no-op pattern. Two consumer-shipped siblings still carry the same defect class:

| Surface | Consumer-shipped? | Same defect class? | Verdict |
|---|---|---|---|
| `.claude/hooks/inject-project-digest.sh:30,38` | YES — `install.sh:652-660` + `setup.d/10-skills.sh:260-271` + `plugin/hooks/inject-project-digest` twin | YES — silent `exit 0` when `.claude/session-bootstrap.md` absent or digest block empty | **GAP-FOUND.** Not addressed by this umbrella. |
| `.claude/hooks/deps-hash-check.sh:82` | YES — `install.sh:573` + `setup.d/10-skills.sh:119-141` | YES — silent `exit 0` when `$DECISIONS` file missing | **GAP-FOUND.** Owned by the deps-hash umbrella; cross-umbrella. |

Plus two framework-internal surfaces correctly outside the consumer-shipped scope: `inject-subagent-digest.sh` (no install/setup line, no plugin twin) and `inject-session-bootstrap.sh` (no install.sh delivery).

All four verdicts independently re-verified live (T3) by direct grep against `install.sh`, `setup.d/*.sh`, and `ls plugin/hooks/`.

## §2 The escalation (advisory → blocker)

Round-1 review classified the `done.md` defect as **ADVISORY** with the host-side harvesting session as the named correction channel. Round-2 review escalated to **BLOCKER** because:

1. A `done.md` is a **durable umbrella-closure record** (CLAUDE.md «Umbrella closure convention»), read by `priority-score.sh` Layer C3 + any future harvester.
2. Round 1's correction lived in **chat output only** (not a tracked artefact at HEAD). A fresh harvester without chat context would miss it.
3. If the correction is skipped at harvest time, the false «umbrella-wide» claim lands in the repo permanently — exactly the umbrella's own defect class (`#claim-from-memory-not-source` per [phase-research-coverage.md §4](../rules/phase-research-coverage.md)) applied to its own closure.

## §3 Verbatim corrected payload — host-side harvesting session MUST apply

**Before `gh pr create`, replace the Summary line at `.claude/orchestrator-prompts/getff-honest-signals/done.md:4` with this verbatim text** (the rest of the file is unchanged; the line is a single bullet):

```text
- Summary: Honest signal for silent no-op shipped for inject-matching-rule — when the consumer's .claude/rules/ corpus is absent, the hook now reports the gap once loudly per session instead of silently no-op'ing forever. Two sibling consumer-shipped hooks carry the same defect class and are NOT addressed by this umbrella: inject-project-digest.sh (silent exit when .claude/session-bootstrap.md is absent — install.sh:652-660, setup.d/10-skills.sh:260-271, plugin twin; GAP-FOUND, candidate follow-up) and deps-hash-check.sh (silent exit when $DECISIONS file is missing — install.sh:573, setup.d/10-skills.sh:119; GAP-FOUND, owned by the deps-hash umbrella). inject-subagent-digest.sh and inject-session-bootstrap.sh are framework-internal (no install.sh delivery) and correctly outside this consumer-shipped scope.
```

**Why the verbatim payload and not a paraphrase:** the corrected Summary carries the T21 sweep verdicts inline (per-surface GAP/SWEPT). A harvester paraphrasing under fatigue could re-introduce the overclaim — the verbatim text is the load-bearing artefact, not a suggestion.

## §4 HALT gate (binding on the host-side harvesting session)

`gh pr create` for S6 MUST NOT fire until BOTH hold:

1. `.claude/orchestrator-prompts/getff-honest-signals/done.md:4` carries the verbatim text from the block above (re-read the file from HEAD; do not trust chat or memory).
2. The PR body quotes the corrected Summary line verbatim and states «this PR closes the umbrella» per kickoff §9.

A reviewer re-running T3 on the merged PR will catch a missing correction; failing it post-merge means the false claim is permanent in history.

## §5 Root cause (T21 + chat-only-deferral)

- **T21 (`#backward-check-restates-not-sweeps`)** — the round-1 backward-check in commit `dd7764bd` dismissed `inject-project-digest.sh` as framework-internal (it is NOT). The dismissal was caught in round-1 review; the corrected sweep landed in commit `2b70a126`. BUT the same overclaim-shape lived in `done.md` at HEAD and round 1 did not flag it.
- **Chat-only deferral (`#advisory-without-tracked-channel`)** — round 1 documented the `done.md` defect in chat + the gitignored plan file but did NOT promote the corrected payload into a tracked artefact at HEAD. The host-side harvesting session consumes `git diff origin/staging..HEAD`; chat and gitignored files are invisible to it. The «named channel» in round 1's advisory was therefore a name without a mechanism — the channel existed but had no tracked input to consume. Round 2's act is to PUT the payload in the channel.

This composes two earlier traps: **T2** (designing/claiming ≠ running — round 1 named the channel without populating it) and **T3** (prose-only finding without file:line payload).

## §6 Prevention

For any umbrella-closure PR where the `done.md` summary is subject to a rework:

1. The corrected `done.md` payload MUST be embedded in a **tracked** file at HEAD (research patch / commit message / rule file — NOT a gitignored plan file or chat output). The classifier-block on `.claude/**` is NOT a license to defer to chat — chat is invisible to the host-side harvester.
2. The HALT gate MUST be in the same tracked file: `gh pr create` MUST NOT fire until the verbatim corrected line is at HEAD and quoted in the PR body.
3. T21 backward-check on umbrella closure extends to the `done.md` summary itself — it is a load-bearing prose artefact, not boilerplate. The umbrella's own defect class applied to its closure record is the highest-cost failure of all (permanent in history).

## Tags

`#claim-from-memory-not-source` · `#backward-check-restates-not-sweeps` (T21) · `#advisory-without-tracked-channel` (new sub-case of `#discipline-application-scope-blindness` — deferral names a channel without populating it; sibling of `#hope-as-gate` from `attention-is-not-a-mechanism.md §2`) · `#recursive-self-application-gap` (the umbrella's own discipline applied to its own closure).

## See also

- [`2026-07-25-t21-backward-check-inject-project-digest-misclassification.md`](./2026-07-25-t21-backward-check-inject-project-digest-misclassification.md) — round-1 sibling; documents the corrected T21 sweep that the `done.md` payload above operationalises.
- [CLAUDE.md «Umbrella closure convention»](../../CLAUDE.md) — defines the `done.md` schema and its role as `priority-score.sh` Layer C3 input.
- [`.claude/rules/ai-laziness-traps.md §2 T21`](../../rules/ai-laziness-traps.md) — the trap this incident evidences (counter advances to 3/3 → promotion criterion for a Class A principle test now MET; per the rule's §5 promotion triggers, future maintainer work).
- [.ai-factory/plans/getff-honest-signals-s6.md «Rework round 2»](../../../.ai-factory/plans/getff-honest-signals-s6.md) — the implementation-log view of this rework round (gitignored; supplementary, not load-bearing).
