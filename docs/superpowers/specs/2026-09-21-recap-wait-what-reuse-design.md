# Recap hook reuses `/wait-what` + `CONTEXT.md` — design

> **Status:** DRAFT — design only; no hook code ships with this spec. Cold `/arch` §2 review
> dispositions live in the [review log](2026-09-21-recap-wait-what-reuse-review-log.md).
> **Authoritative for:** the two mechanical additions to the plain-words recap gate (the
> long-sentence defect, the agent-side glossary-term defect), the contract lines that teach them,
> their thresholds with the measuring command, and the rollout precondition.
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> the recap block, the «от тебя» grammar, the glossary file format and its two counters — the
> parent spec [2026-09-13-plain-words-recap-v2-design.md](2026-09-13-plain-words-recap-v2-design.md)
> (D-A, D-B, D-F); `/wait-what` itself — a vendored plugin skill, ADOPT as is (parent D-F).

The parent spec sits at exactly 600 lines (the markdown gate), so this is a sibling spec and the
parent gains no pointer line. Every `path:NN` below was read at `origin/staging` =
`ef9b43c68ff` via `git show origin/staging:<path>`.

## Context

`/wait-what` is one sentence with three demands: give context first, write in ASD-STE100
Simplified Technical English, use the ubiquitous language of `CONTEXT.md`. It is operator-invoked
only. The operator asked for the Stop hook that owns the `## 🟢` block
(`.claude/hooks/end-of-turn-reminder.sh`) to reuse those demands instead of leaving them to a
skill the agent never loads by itself.

Mapped against the hook today:

| `/wait-what` demand      | Hook today                                                                                                                                                                                  | Gap                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| context first            | section 1 is always required (`_eot_recap_defects`, `end-of-turn-reminder.sh:1015`)                                                                                                         | none                                                                                      |
| simplified language      | contract (`lang/ru.sh:79`) and checker say nothing about sentence length                                                                                                                    | unenforced                                                                                |
| `CONTEXT.md` terms       | the Stop-side arm (`end-of-turn-reminder.sh:733` onward) runs only when the **operator's prompt** used an unlearned term (pending file written by `glossary-inject.sh`)                        | a term the **agent** puts into its own block fires nothing                                |
| `_Avoid_` phrases        | never checked                                                                                                                                                                               | see D4                                                                                    |

**The gate these defects ride is dormant on the operator's own machine.** `_eot_recap_defects`
runs only under `AIF_RECAP_GATE=1` (`end-of-turn-reminder.sh:1095`). Measured 2026-09-21:

```bash
for f in ~/.claude/settings.json .claude/settings.json .claude/settings.local.json; do
  jq -r '.env.AIF_RECAP_GATE // "unset"' "$f"; done; echo "${AIF_RECAP_GATE:-unset}"
# → unset ×3, unset
```

So any new defect is dead code here until the gate is armed — D7 makes arming a rollout step.

### Measurements

One command produced every number in this spec (script vendored in this PR, read-only, stdlib):

```bash
python3 scripts/measure/measure-recap-sentences.py \
  --require '**Где мы.**' --require 'От тебя:' --end-at 'От тебя:'
```

`--require` keeps only blocks written under the parent spec's five-section contract (the
population the gate will see); `--end-at` cuts text after the block's closing line. Run
2026-09-21 over `~/.claude/projects/-Users-art-code-rules-as-tests-aif*/*.jsonl`: 440 transcripts,
**227 blocks, 3566 sentences**. The same script with no flags covers all 2395 historical blocks
(old formats included) and is reported only as a cross-check.

| Measure                                     | New-format blocks (227)          | All blocks (2395)  |
| ------------------------------------------- | -------------------------------- | ------------------ |
| words per sentence p50 / p90 / p95 / p99    | 8 / 19 / 23 / 31 (max 58)        | 10 / 23 / 28 / 37  |
| blocks holding a sentence over 25 words     | 82 (36.1 %)                      | 56.2 %             |
| … over 30 words                             | 36 (15.9 %)                      | 32.2 %             |
| … over 35 words                             | 10 (4.4 %)                       | 17.0 %             |
| block non-empty lines p50 / p90; over 15    | 6 / 12; 4 blocks (1.8 %)         | —                  |
| blocks using a `CONTEXT.md` term            | 91 (Handoff 56, Harvest 27, Chips 10, Red 7) | 922    |
| … of those carrying `term (explanation)`    | 0                                | 0                  |
| blocks holding an `_Avoid_` phrase          | 0                                | 0                  |

Operator re-explain asks (existing script, `reexplain_asks / user_messages`):

```bash
python3 scripts/measure/measure-interaction-shape.py            # 35 days: 118 / 1498 = 7.9 %
python3 scripts/measure/measure-interaction-shape.py --days 7   # 2026-09-14..21: 6 / 174 = 3.4 %
```

Known limits of the measurement: the blocks predate any «short sentences» contract line, so the
over-N rates are an upper bound on the post-rollout retry rate; the fork-card region is included
in the measurement but exempt in the design (D2), which makes the bound looser still; the
glossary landed on 2026-09-21 (PR 1824), so «0 inline forms» describes pre-glossary habits, not
resistance to the demand.

## Decision

### D1 Contract text — three lines, both packs

`aif_msg_eot_recap_contract` (both `lang/*.sh`, key parity via `lang/check-parity.sh`) gains
three lines after the line-cap sentence. Semantics (the Russian wording is pack content):

1. Short sentences: at most `${AIF_EOT_RECAP_MAX_WORDS:-<D2 default>}` words each; split a
   longer one instead of chaining clauses with colons, dashes and parentheses.
2. One idea per sentence.
3. A `CONTEXT.md` term is written as the glossary writes it; while it is still being learned it
   carries the inline form `Term (one-line explanation)`.

Line 2 is **teaching text, not enforcement** — «one idea» has no deterministic test, and this
spec does not present it as a check ([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)).
Lines 1 and 3 are each backed by a defect below. STE's approved-word dictionary is an English
lexicon and has no Russian counterpart; it is not adopted in any form.

### D2 Defect «long sentence»

A new arm in `_eot_recap_defects`, riding the existing gate, retry message
(`aif_msg_eot_recap_gate`) and block-sha retry bound — no new gate, flag or exit path.

**Sentence definition** (the measured one; the script's docstring is the reference):

1. a newline ends a sentence — bullets and section lines are their own units; a leading list
   marker is dropped;
2. an inline code span and a URL each collapse to one word; a markdown link counts as its text;
3. a terminator is `.` `?` `!` `;` or `…`, optionally followed by closing `)` `»` `"` `*` `_`,
   **followed by whitespace or end of line** — so `path.ext`, `path:NN`, `1.5`, `v2.3` never
   split; `—` and `:` are not terminators (splitting on them would hide exactly the chained
   sentence the arm exists to catch);
4. a word is a whitespace-separated token that is non-empty after ASCII punctuation is removed
   and is not a bare `—`, `–` or `→`.

Rule 4 is deliberately **free of letter classes**: a Cyrillic range inside a bracket expression
is rejected by GNU grep/awk under glibc C.UTF-8 and silently disabled the glossary hook once (CI
PR 1824; `lang/ru.sh:214` comment). For the same reason the implementation must not place a
multibyte character (`…`, `»`) inside a bracket expression — use alternation.

**Scope:** the block as `_eot_recap_block` returns it, minus the fork-card region, using the same
region rule as `_eot_recap_line_count` (`end-of-turn-reminder.sh:955`) — a card is never
compressed (parent D-A), and one exemption rule must not exist in two shapes.

**Threshold:** env `AIF_EOT_RECAP_MAX_WORDS`, env-only with a literal default and the same
garbage guard as `AIF_EOT_RECAP_MAX_LINES` (`:1048-1051`) — not a pack key, so an operator
override survives pack sourcing. Default: **operator fork R-1** (recommended 30).

**Defect text:** a new pack scalar `AIF_EOT_LONG_SENTENCE_LABEL`; the defect names N and quotes
the first six words of the longest offending sentence, because the retry message says «fix
exactly what is named» and an unnamed sentence cannot be found.

### D3 Defect «unlearned glossary term in the block»

Fires when the block (fork-card region included — a card is where an unexplained term hurts
most) contains a `CONTEXT.md` term or one of its `_Operator says_` words, the term is still
unlearned, and the **answer** (`$text`, not only the block) lacks the fixed form `Term (`.

- **It is a new demand site, not a new counter event.** Parent D-F stays intact: `usages` are
  counted on the operator's prompt only; an agent-side mention never increments `usages`.
- **It is a second place where `explanations` are counted.** Today the form is counted only when
  a pending file exists (`:804`), so an explanation the agent gives unprompted is lost. The new
  arm counts it — once per message per term, same as D-F — under the existing `_gl_lock`.
- **No double handling with the pending arm.** The pending arm runs earlier and deletes its file
  (`:859`). It exports the terms it handled this turn; the defect arm skips them. Without that,
  one explanation would be counted twice, or one missing explanation demanded through two
  channels (the sibling-channel class of PRs 1644 → 1651).
- **No per-term one-shot flag.** The block-sha bound already caps retries at one per block. Every
  unlearned-term block is corrected until `explanations` reaches `AIF_GLOSSARY_EXPLAINS` (5) or
  the operator's own usage reaches `AIF_GLOSSARY_USES` (3) — the «stop explaining after N»
  throttle row #283 was built for. No new thresholds.
- **Shared code, one copy.** `glossary-inject.sh` and the Stop hook already duplicate `_gl_lock` /
  `_gl_unlock` (`glossary-inject.sh:177`, `end-of-turn-reminder.sh:778`), and the `CONTEXT.md`
  awk parser plus `_words_re` live only in the inject hook. The implementing slice moves parser,
  word-boundary regex, lock and a `learned?` predicate into `.claude/hooks/lib/glossary.sh`
  (sibling of `lib/residue-dir.sh`), sourced by both hooks. A third copy is not acceptable.
- **Inert** when `CONTEXT.md` is absent, `jq` is missing, or the lib is older than the hook
  (`command -v` probe before the call, precedent `:845`).

### D4 `_Avoid_` phrases — not built

`CONTEXT.md` has one `_Avoid_` line and zero of 2395 blocks contain its phrase. Building a matcher
for a population of one is YAGNI. **Trigger to revisit:** `grep -c '^_Avoid_:' CONTEXT.md` ≥ 3, or
the measuring script reports `avoid_phrase_blocks` > 0.

### D5 Auto-`/wait-what` on a re-ask — out of scope

It would be a UserPromptSubmit-side feature, a different hook. The re-ask rate is falling (7.9 %
over 35 days → 3.4 % over the last 7), so there is no evidence it is needed on top of D2/D3.
**Trigger to revisit as its own slice:** the 7-day rate is above 7.9 % two weeks after D7's arming.

### D6 The 15-line cap does not move

Splitting a sentence adds a sentence, not a line; only 4 of 227 blocks exceed 15 lines and p90 is
12. **Trigger:** `blocks_over_15_lines` above 5 % of blocks two weeks after arming.

### D7 Rollout

1. Implementation starts **only after recap-v2 slice S4 lands** (aif task
   `6ae9ecab-efa4-4829-9113-2a45059f2191`, in flight, not to be redispatched): S4 edits both
   lang packs and `end-of-turn-reminder.test.ts`, the same files this design edits. No ordering
   against S5 (autonomy edits, D-H) — disjoint files.
2. One PR to `staging`: lib extraction, two defect arms, three contract lines + one label scalar
   in both packs, tests, twins regenerated by pre-commit, SSOT row (see Prior art).
3. **Operator step (hands):** arm the gate once — `bash scripts/register-recap-gate.sh`. An agent
   cannot: `.claude/settings.json` is on its own deny list. Until then this design changes only
   the contract text the agent reads.
4. Two weeks after arming, re-run the Measurements command and apply the falsifiers below.

## Live decision register

| #   | Decision                                                        | Status        | Resolution                                   | Falsifier                                                                                                                         |
| --- | --------------------------------------------------------------- | ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | Default of `AIF_EOT_RECAP_MAX_WORDS`                            | operator-fork | recommended 30 (15.9 % of measured blocks)   | wrong if, two weeks after arming, blocks over 25 words are under 15 % → tighten to 25; or blocks over 30 stay above 15 % → the contract line is not teaching, revisit the message |
| R-2 | Agent-side term = new demand site; `usages` stay operator-only  | answered      | this session, D3                             | wrong if a term reaches «learned» with the operator never having used or re-asked it and then re-asks it                          |
| R-3 | `_Avoid_` matcher not built                                     | answered      | this session, D4 (0 / 2395)                  | the D4 trigger fires                                                                                                              |
| R-4 | STE word list not adopted; «one idea» is prose only             | answered      | this session, D1                             | a maintained Russian controlled-language lexicon is found                                                                         |
| R-5 | Auto-`/wait-what` out of scope                                  | answered      | this session, D5 (3.4 % and falling)         | the D5 trigger fires                                                                                                              |
| R-6 | Line cap unchanged                                              | answered      | this session, D6 (4 / 227)                   | the D6 trigger fires                                                                                                              |
| R-7 | Arming the gate is a rollout precondition, done by the operator | answered      | this session, D7 (measured unset everywhere) | the operator declines to arm → the design reduces to D1 and the two arms ship dormant for `--full` consumers only                 |
| R-8 | Own awk arm, no prose-linter dependency                         | answered      | Prior art below                              | a linter ships a Russian sentence tokenizer as a single static binary already required by the install                             |

## Testing seams

One existing seam: `packages/core/hooks/end-of-turn-reminder.test.ts` drives the hook with a
transcript fixture and env, and already covers `_eot_recap_defects` under `AIF_RECAP_GATE=1`.
New cases: a 31-word sentence (RED) / 30-word (GREEN); `path.ext`, `path:NN`, `1.5` do not split;
an inline code span counts as one word; a long sentence inside the fork card is exempt; garbage
`AIF_EOT_RECAP_MAX_WORDS` falls back to the default; **the same RED case under `LC_ALL=C` and
`LC_ALL=C.UTF-8`** (the PR 1824 class). For D3: `packages/core/hooks/glossary-counters.test.ts`
with `AIF_RESIDUE_DIR` — unlearned term without the form (RED), with the form (GREEN +
`explanations` +1), learned term (GREEN), term also in the pending file (counted once, demanded
once), `CONTEXT.md` absent (inert, unarmed goldens byte-identical).

## Consequences

- Armed sessions pay at most one extra retry per defective block; measured upper bound at N = 30
  is 15.9 % of blocks, plus the D3 teaching retries until each used term is learned (four terms
  account for every measured agent-side use).
- The glossary counters gain a second writer path inside the Stop hook; the lib extraction is what
  keeps the lock discipline in one place.
- Unarmed sessions and consumers without `--full` see only three more contract lines.

## Prior art

Consulted: [prior-art-evaluations.md](../../meta-factory/prior-art-evaluations.md) #122 (recap =
BUILD), #230, #253 (mattpocock skills; `wait-what` ADOPT, `domain-modeling` ADAPT), #283
(glossary learning counters = BUILD). context7, three phrasings: Vale (`/websites/vale_sh` —
`occurrence` check with `scope: sentence`), textlint (`/textlint/textlint` — `sentence-length`
rule), textlint terminology rules. WebSearch 2026-09-21: `stelint` (spaCy), `ste-writing-kit`
(EN/DE, Python), several `asd-ste100-skill` repos (prose skill + English linter).

Problem-class check (T16): upstream = lint **English** documentation files in CI or an editor;
ours = check a **Russian** chat block inside a synchronous bash Stop hook whose only runtime
dependency is `jq`. Every candidate needs a Go/Node/Python runtime plus an English-trained
tokenizer, and none knows the counters. Verdict: **BUILD** a ~20-line awk arm; **REFERENCE** STE
and plain-language guidance for the number's order of magnitude (20-25 English words; Russian has
no articles, so an equal-content Russian sentence is shorter in words). The implementing commit
adds the SSOT row; this spec-only PR ships no capability.

## Operator premise register

- «хочу чтобы хук переиспользовал /wait-what и CONTEXT.md — чтобы улучшить его, короче говоря
  переиспользовать и дополнить мой хук» (2026-09-21, via the handoff). Read as: extend the
  existing Stop hook's recap contract and checker with `/wait-what`'s demands; do not build a new
  hook, do not edit `/wait-what`, do not touch `/story`.
- Thresholds come only from measurements on real transcripts, each with its command (this
  session's kickoff). Read as: the Measurements section is the only source of numbers.
- «обьясни о чем ты спрашиваешь и зачем это?» (2026-09-21, reply to the R-1 fork card). Read as:
  the card leaned on terms the operator had not been given; R-1 stays open until answered in
  plain words. Recorded because it is itself evidence for D3.

## Changelog

- 2026-09-21 — draft written; cold review dispositions in the review log.
