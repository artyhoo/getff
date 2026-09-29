<!-- scope:skill-listing-budget -->
# The skill listing: what the budget really is, what overflows it, and what a compaction loses

> Scope: the evidence behind principle 47 (skill description budget) and the post-compaction
> skill index in `.claude/hooks/lib/skill-index.sh`. Measured on the operator's host,
> 2026-09-29, at `9f69fa2097c` (origin/staging). Vendor pages fetched the same day.

## Problem

Operator report, 2026-09-29: skill descriptions take about 9.1k tokens against a limit of about
2k, and they are lost after a compaction. Both halves were recorded earlier and neither had an
owner: the overflow in the token-economy spec (2026-08-06, deferred, then trimmed once by stage
S-I), the compaction loss in the dynamic-context-window spec (2026-09-08, filed as a fact).

## Method

1. Listing size — read from live session transcripts, not estimated:
   `jq -r 'select(.attachment.type=="skill_listing") | .attachment.content' <session>.jsonl | wc -m`.
2. Description bytes — `description` + `when_to_use` only, per SKILL.md
   (`packages/core/principles/47-skill-description-budget.ts`).
3. Compaction — one session transcript with 30+ compactions, listing attachments and
   `compact_boundary` records printed in order.
4. Usage — `Skill` tool invocations by name over every transcript modified in the last 30 days
   (1,559 files). Slash-command invocations typed by the operator are not in this count.
5. Vendor behaviour — `code.claude.com/docs/en/skills`, `/context-window`, `/hooks`, read from
   the fetched page text, not from a summary. A delegated summary of the same pages got two
   facts wrong (it claimed the listing is re-embedded after compaction, and that a
   `disable-model-invocation` skill keeps its name in the listing); both were corrected against
   the source before anything was built on them.

## Findings

### F1 — the budget is 1% of the context window, so the «2k limit» is the 200k-window figure

Vendor: the listing budget «scales at 1% of the model's context window»; over it the harness
drops descriptions «starting with the skills you invoke least»; every name is always listed;
one entry is cut at 1,536 characters. Overrides: `skillListingBudgetFraction`,
`SLASH_COMMAND_TOOL_CHAR_BUDGET`, `skillListingMaxDescChars`.

Measured, three listings of one host at different skill counts:

| Skills installed | Listing, chars |
|---|---|
| 137 | 29,925 |
| 138 | 29,995 |
| 123 | 29,949 |

The size does not follow the skill count — the listing sits at its cap. On a 1M-token window 1%
is about 30k characters; on a 200k window it is about 8k characters, the «~2k tokens» of the
August spec. Both readings are the same rule. A 200k-window session (a smaller model, a
subagent) therefore keeps far fewer descriptions than the operator's main session does.

### F2 — 50 of 123 skills are already reduced to a bare name

| Source | Entries | Chars | Name only |
|---|---|---|---|
| project, user and built-in | 31 | 13,433 | 0 |
| `anthropic-skills` (app-bundled) | 17 | 9,497 | 0 |
| `superpowers` | 15 | 2,870 | 0 |
| `mattpocock-skills` | 9 | 1,761 | 2 |
| `mbp` | 42 | 1,388 | 41 |
| `getff` | 9 | 1,001 | 7 |

The dropped ones are the least invoked, as the vendor states: over 30 days `mbp` has 4
invocations, all of one skill (`mbp:handoff`, the one that kept its description); the top of
the usage list is `superpowers:test-driven-development` 93, `superpowers:brainstorming` 70,
`superpowers:systematic-debugging` 48.

### F3 — the project share «regressed» by growing, not by bloating

| | Files | Bytes |
|---|---|---|
| S-I merge (`ffa31d853b5`, 2026-08-06), this patch's extractor | 14 | 6,057 |
| 2026-09-29, before this change | 17 | 8,710 |
| 2026-09-29, after this change | 17 | 8,542 |
| of which visible to the model, before this change | 13 | 6,943 |
| of which visible to the model, after this change | 13 | 6,775 |

Three skills joined after S-I — `reviewer` (2026-08-10), `orchestrator` (vendored 2026-08-17),
`docs-author` (2026-09-18) — for 2,464 B; the 14 original files grew by 189 B in total. S-I's
extractor measured `description` only, so `orchestrator`'s `when_to_use` line (the only one in
the repo) was never inside any budget. Four skills carry `disable-model-invocation: true`
(`arch`, `dispatcher`, `harvest`, `pipeline`) and are absent from the listing.

### F4 — the listing does not come back after a compaction

Vendor context model: the «Skill descriptions» block is the only startup block flagged
`noSurviveCompact: true` — «this listing is not re-injected after `/compact`». Measured: in a
session with 30+ compactions the transcript holds three listing attachments, all
`isInitial: true`, none of them after a `compact_boundary` that was not also a process start.
Bodies of skills already invoked are re-attached (5,000 tokens each, 25,000 in total); the
knowledge that the other skills exist is not.

## Solution

**Project share — a standing gate.** Principle 47 fails the suite (pre-push and CI) when a
description exceeds 800 B, when the model-visible total of a population exceeds its budget
(`.claude/skills` 6,800 B; `plugin/skills` 4,000 B; `skills` 1,500 B), or when an entry would be
cut by the harness. Exceptions are declared in the test with a rationale and a ceiling; a stale
or unexplained one fails. Validated in both directions: RED on the pre-change tree (4 findings),
GREEN after. The inventory's own S-I figure is 6,253 B; its extractor and this one differ
by 196 B on the same tree, so the table above uses one extractor throughout.

**Trims, checked against the trigger inventory.**

| File | Before | After | What was removed | Trigger lost |
|---|---|---|---|---|
| `.claude/skills/orchestrator/SKILL.md` | 1,356 B | 1,188 B | 9 `when_to_use` phrases that repeat a phrase of `description` with the same scope | none — each still stands in `description`, unconditionally |
| `skills/getff/SKILL.md` (+ plugin twin) | 875 B | 795 B | «any version of», «any mention of», «— that is the core problem this skill addresses» | none — framing words, no trigger |

`orchestrator` stays above 800 B under a declared exception: the rest is a bilingual trigger
list, and removing a trigger is what the inventory forbids. Four more phrases also repeat in
`description` («автономно», «волнами», «работай без остановок», «прогони очередь кикофов») and
were KEPT in `when_to_use`: in `description` they stand only inside the «при ≥2 kickoff'ах →
Queue mode» condition, so dropping the bare entries would have narrowed their scope — string
presence is not the same as trigger survival (caught by the cold review of this change).

**Share outside the repo — no prune; one optional setting.** See «Decision on the outside
share» below.

**Compaction — a name-only index, once per compaction.** On `SessionStart(source=compact)` the
bootstrap hook appends the names of the session's own last listing, grouped by namespace.
Measured on the 123-skill host: 2,398 B per compaction, 0 B on every other source, 0 B per
prompt. The hook's whole output is held under the harness's 10,000-character cap on hook output.
It rides on the already-registered bootstrap hook, so nothing has to be registered by hand.

## Decision on the outside share

Options, measured against the prior decisions (SSOT #257 REJECT of a total prune; the D-H8
ladder of the harmonization spec):

| Option | Effect | Verdict |
|---|---|---|
| Prune or stamp every unused satellite skill | frees budget | **No.** #257 stands: its revisit triggers (≥3 live misroutes, or per-project plugin scoping in the harness) are not met, and the harness already drops exactly the unused descriptions (F2). |
| `skillOverrides` for plugin skills | — | **Not available.** Vendor: «Plugin skills are not affected by `skillOverrides`». This closes the deferred P-I5 probe of PR 1229. |
| Stamp `anthropic-skills` on disk | frees 9.5k chars | **No.** They live in an app-managed directory the desktop app rewrites; a stamp there is not ours to keep. |
| Disable the `mbp` plugin | frees 1.4k chars | **Operator's call, low value.** 41 of its 42 entries already cost a bare name. |
| `skillOverrides: name-only` for unused built-in skills | frees up to 3.6k chars for descriptions now dropped | **Operator's call.** Candidates with zero `Skill`-tool invocations in 30 days: `dataviz` 1,447, `schedule` 381, `run` 368, `loop` 344, `workflow-authoring` 252, `keybindings-help` 248, `artifact-diagramming` 205, `fewer-permission-prompts` 191, `simplify` 188. They stay invocable by name. |
| Lower `skillListingBudgetFraction` | fewer resident tokens | **Not recommended.** It trades routing for tokens: the harness would drop more descriptions, least used first. |

Wrong if: a routing miss is traced to a description the harness dropped — that is a #257
revisit trigger and belongs in the #253 counter.

## Open probe

`SessionStart` may return `reloadSkills: true`, documented as re-scanning the skill directories.
Whether that also re-sends the listing after a compaction is not documented and was not
measured — it needs a live compaction with the flag set. If it does, the vendor mechanism
replaces the index built here.

## Tags

`#skill-listing` `#context-budget` `#compaction` `#measured-not-guessed`

## §1.7 self-review

- **Forward-check:**
  - [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md): the gate is a byte count; the hook is bash, jq and awk. No LLM, no network.
  - [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md): SSOT #294 — `skill-lint` and `skill-tidy` were read and not adopted (no per-population totals, no notion of a hidden skill; one is a new global npm install, the other a clone-only Python tool with no users). context7 had no quota left on 2026-09-29; the consult ran on the vendor pages and WebSearch instead, and the row says so.
  - [attention-is-not-a-mechanism.md](../../../.claude/rules/attention-is-not-a-mechanism.md): S-I's one-time host run was a measurement; the principle test is the gate. The trigger-survival half stays a reading of the inventory — a byte count cannot decide it, and the test says so instead of pretending to.
  - [skill-description-quality.md](../../../.claude/rules/skill-description-quality.md): §2 rejects a length FLOOR as theatre. Principle 47 is a ceiling on a rationed resource and claims nothing about quality.
  - [dual-implementation-discipline.md](../../../.claude/rules/dual-implementation-discipline.md): the index lib carries `@cc-only-rationale` — compaction is a CC lifecycle event with no ZCode counterpart (zcode-parity-doctrine.md §2 rows 21-22).
  - [language-discipline.md](../../../.claude/rules/language-discipline.md): the Russian trigger phrases kept in `orchestrator` are category-3 match-data.
- **Backward-check:**
  - [docs/superpowers/specs/2026-08-06-skill-trigger-inventory.md](../../superpowers/specs/2026-08-06-skill-trigger-inventory.md): its budget table is description-only and dated; this patch is the current measurement and does not rewrite it.
  - [docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md](../../superpowers/specs/2026-08-06-pipeline-token-economy-design.md): its «~2k listing budget» is the 200k-window value of the same 1% rule (F1), not a contradiction.
  - `.claude/hooks/inject-session-bootstrap.sh` now reads stdin. Every earlier behaviour is pinned by its existing suite, which passes unchanged (29 cases).
  - Not swept here, owned by maintainers: `zcode-parity-doctrine.md` §2 row 14 and `rule-enforcement-channel-selection.md` §4 describe the bootstrap hook as a digest injector only; both stay true, neither mentions the index yet.
- **Self-application (T15):** the gate was run against the tree that motivated it and failed there; the index was run against a real 81 MB transcript, not only against fixtures.
- **Own cold review (T19):** a reviewer that never saw the authoring session returned REVISE — 2 MAJOR (the hook blocked forever on a closed or writer-less stdin; the frontmatter reader under-counted wrapped, quoted and indicator-carrying scalars, and an unreadable file measured 0 B and passed), 5 MINOR. All fixed before the PR, each with a test that fails on the pre-fix code.
