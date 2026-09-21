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
| `CONTEXT.md` terms       | the Stop-side arm (`end-of-turn-reminder.sh:731` onward) runs only when the **operator's prompt** used an unlearned term (pending file written by `glossary-inject.sh`)                        | a term the **agent** puts into its own block fires nothing                                |
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

One script produced every number in this spec. It is vendored **by this PR** (it does not exist
on `staging` before it), read-only, stdlib only:

```bash
python3 scripts/measure/measure-recap-sentences.py \
  --require '**Где мы.**' --require 'От тебя:' --end-at 'От тебя:' \
  --dedup --skip-card --section '**Где мы.**' --section '**Что изменилось.**' \
  --section '**В чём не уверен.**' --section '**Дальше.**'
```

`--require` keeps only blocks written under the parent spec's five-section contract (the
population the gate will see); `--end-at` cuts text after the block's closing line; `--dedup`
counts a byte-identical block once (a resumed session copies earlier messages into a new
`.jsonl` — 15 % of the raw population); `--skip-card` drops the fork-card region exactly as D2
exempts it. Run 2026-09-21 over `~/.claude/projects/-Users-art-code-rules-as-tests-aif*/*.jsonl`:
440 transcripts, **192 unique blocks, 2892 sentences, 37 transcripts holding a block**. Without
`--dedup --skip-card` the same run reads 227 blocks / 3566 sentences and no percentage moves by
more than one point (over-30: 15.9 % vs 16.1 %). With no flags at all the script covers the 2395
historical blocks of every format — a cross-check only.

| Measure                                                            | Unique new-format blocks (192)              | All blocks (2395) |
| ------------------------------------------------------------------ | ------------------------------------------- | ----------------- |
| words per sentence p50 / p90 / p95 / p99                           | 7 / 19 / 23 / 31 (max 58)                   | 10 / 23 / 28 / 37 |
| blocks holding a sentence over 25 words                            | 68 (35.4 %)                                 | 56.2 %            |
| … over 30 words                                                    | 31 (16.1 %)                                 | 32.2 %            |
| … over 35 words                                                    | 8 (4.2 %)                                   | 17.0 %            |
| block non-empty lines p50 / p90; over 15                           | 6 / 11; 4 blocks (2.1 %)                    | —                 |
| blocks using a `CONTEXT.md` term, raw text                         | 78                                          | —                 |
| … in prose only (code spans, URLs, link targets removed)           | 64 (Handoff 42, Harvest 11, Chips 10, Red 5) | —                |
| … of those carrying `Term (explanation)`                           | 0                                           | 0                 |
| distinct (transcript, term) pairs — D3's bounded demand count      | 29                                          | —                 |
| blocks tripping D2 at N = 30 **or** an unbounded D3                | 82 (42.7 %)                                 | —                 |
| blocks holding an `_Avoid_` phrase                                 | 0                                           | 0                 |

**False positives at the margin (handoff §5 Q1).** N is decided by the band just above it, so
that band was read, not only counted: the same command plus `--band 31-35` lists the 28 unique
sentences of 31-35 words. All 28 are running prose chained by `—`, `:` and parentheses; none is
a table row, an enumerated line, or a path list the agent could not split. One of the 28 is a
fork-card recommendation line written in a block without the fork heading (so the card
exemption did not cover it). Structural false positives: 0 of 28.

Operator re-explain asks (existing script, `reexplain_asks / user_messages`). The 7-day window
slides, so the fraction is pinned to its run date; a cold re-run hours later read 6 / 156:

```bash
python3 scripts/measure/measure-interaction-shape.py            # 35 days to 2026-09-21: 118 / 1498 = 7.9 %
python3 scripts/measure/measure-interaction-shape.py --days 7   # 2026-09-14..21: 6 / 174 = 3.4 % (re-run: 6 / 156 = 3.8 %)
```

Known limits: the blocks predate any «short sentences» contract line, so every over-N rate is an
upper bound on the post-rollout retry rate; the glossary landed on 2026-09-21 (PR 1824), so «0
inline forms» describes pre-glossary habits, not resistance to the demand.

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

**Scope and its seam:** the block as `_eot_recap_block` returns it, minus the fork-card region
— a card is never compressed (parent D-A). Today that region rule exists only inside
`_eot_recap_line_count` (`end-of-turn-reminder.sh:955`), whose awk returns a *count*. The
implementing slice extracts the skip clause into one text-emitting helper
(`_eot_recap_without_cards`); `_eot_recap_line_count` then counts that helper's output and the
sentence arm reads the same output. Copying the clause is the rejected shape: the last
card-region fix (final review I-3, recorded at `:956-961`) would have landed in one copy only.

**Threshold:** env `AIF_EOT_RECAP_MAX_WORDS`, env-only with a literal default — not a pack key,
so an operator override survives pack sourcing. The hook sanitizes it **once** (non-numeric or
zero → default) before the packs' message functions run, so the contract line (D1) and the
checker can never print and enforce two different numbers. `AIF_EOT_RECAP_MAX_LINES` has that
inherited defect today (`lang/ru.sh:100` interpolates the raw env, the guard lives only at
`:1051`); the same one-line sanitize fixes it in the same slice. Default: **operator fork R-1**.

**Defect text:** a new pack scalar `AIF_EOT_LONG_SENTENCE_LABEL`; the defect names N and quotes
the first six words of the longest offending sentence, because the retry message says «fix
exactly what is named» and an unnamed sentence cannot be found.

### D3 Defect «unlearned glossary term in the block»

Fires when the **prose** of the block (fork-card region included — a card is where an
unexplained term hurts most) contains a `CONTEXT.md` term or one of its `_Operator says_` words,
the term is still unlearned, the **answer** (`$text`, not only the block) lacks the fixed form
`Term (`, and this session has not yet been asked about this term.

- **Prose only.** Inline code spans, URLs and markdown link targets are removed before matching.
  Measured: 14 of 78 term-bearing blocks have every hit inside a code span —
  `harvest/SKILL.md:54`, `claude-glm-executor-handoff`, `HANDOFF-….md`. A path is not a use of the
  term, and a demand to gloss a path cannot be satisfied.
- **It is a new demand site, not a new counter event.** Parent D-F stays intact: `usages` are
  counted on the operator's prompt only; an agent-side mention never increments `usages`.
- **It is a second place where `explanations` are counted.** Today the form is counted only when
  a pending file exists (`:804`), so an explanation the agent gives unprompted is lost. The new
  arm counts it — once per message per term, same as D-F — under the existing `_gl_lock`.
- **Bounded by a per-term, per-session one-shot flag**, own prefix `aif-glossary-blk-` (never
  the pending arm's `aif-glossary-dem-`: one flag shared between two bounds lets each suppress
  the other's first firing, PRs 1644 → 1651). The flag is required, not optional: the retry Stop
  carries `stop_hook_active=true` and exits at `:89` before any counter runs, so the explanation
  written to satisfy the demand is **never counted** (the accepted undercount the pending arm
  records at `:751`). Without the flag the arm would re-fire on every later block until the
  operator happened to use the word — measured 64 of 192 blocks (33 %). With it the cost is one
  retry per (session, term): 29 across the 37 measured transcripts. `explanations` then advance
  only on forms the agent writes unprompted — which D1 line 3 asks for — and «learned» keeps the
  parent's meaning. No new thresholds.
- **No double handling with the pending arm.** The pending arm runs earlier and deletes its file
  (`:859`). It exports the terms it handled this turn; this arm skips them.
- **Runs outside the defect function.** `_eot_recap_defects` is a stdout contract consumed as
  `$(…)` (`:1097`); a locked read-modify-write inside it would leak any stray byte into the
  defect list shown to the model, and its variable writes would die with the subshell. The
  glossary step runs before that call, with every descriptor redirected, and hands over one
  variable (`_eot_glossary_defect`) that the defect function appends.
- **Shared code, one copy.** `glossary-inject.sh` and the Stop hook already duplicate `_gl_lock` /
  `_gl_unlock` (`glossary-inject.sh:177`, `end-of-turn-reminder.sh:778`), and the `CONTEXT.md`
  awk parser plus `_words_re` live only in the inject hook. The implementing slice moves parser,
  word-boundary regex, lock and a `learned?` predicate into `.claude/hooks/lib/glossary.sh`,
  sourced by both hooks. Delivery is D7 step 2's problem and is spelled out there.
- **Inert** when `CONTEXT.md` is absent, `jq` is missing, or the lib is absent or older than the
  hook (`[ -f ]` before `.`, `command -v` before the call — precedent `:845`). Inert means the
  defect never fires; it never means the hook aborts.

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
   lang packs, their `plugin/hooks/lang/` twins and `end-of-turn-reminder.test.ts`
   (`kickoff-s4.md:82-95`, `:137`), and the Stop hook itself (row 5 there) — the files this design edits. S5 (`kickoff-s5.md`) edits
   `aif-doctor/SKILL.md`, rule text, `pipeline/SKILL.md` and principle 29 and names neither the
   Stop hook nor the packs (`git show origin/staging:…/kickoff-s5.md | grep -c
   'end-of-turn-reminder\|lang/'` → 0), so there is no ordering against S5.
2. One PR to `staging`, and its file list is longer than «hook + packs»:
   - `.claude/hooks/end-of-turn-reminder.sh`, `.claude/hooks/glossary-inject.sh`, the new
     `.claude/hooks/lib/glossary.sh`; the two top-level twins regenerate via pre-commit
     (`scripts/generate-plugin-twins.sh:133` globs `.claude/hooks/*.sh`, non-recursive);
   - both `lang/*.sh` packs **and a hand `cp` to `plugin/hooks/lang/`** — no generator rebuilds
     the pack twins (`end-of-turn-reminder.test.ts:3014-3019`), and `check-parity.sh` compares
     en↔ru inside one directory, never source↔twin. A scalar missing from the twin is RC 127
     under `set -u` the first time the new defect fires;
   - **lib delivery by name:** `install.sh:959-961` (`refresh_safe … lib/residue-dir.sh`) and
     `setup.d/10-skills.sh:258-260` (`copy_safe`) copy lib files one by one, so `lib/glossary.sh`
     needs its own line in both, plus the install snapshot regeneration. The plugin channel
     ships no sourced lib beyond `hook-emit.sh` by rule (`end-of-turn-reminder.test.ts:3011-3013`,
     D23/D29: the twin runs on an inline fallback) — there D3 is **inert by design**, D2 is live;
   - tests (see Testing seams), including one over-length fixture in the armed-twin suite
     (`end-of-turn-reminder.test.ts:3023`) so a missing twin scalar fails a test, not a consumer;
   - the SSOT row (see Prior art).
3. **Operator step (hands):** arm the gate once — `bash scripts/register-recap-gate.sh`. An agent
   cannot: `.claude/settings.json` is on its own deny list. **The implementing PR does not merge
   before the operator has agreed to arm** (R-7): `--full` installs arm the gate automatically
   (`setup.d/10-skills.sh:282-303`), so merging unarmed-here would ship two arms to consumers
   that were never exercised live anywhere.
4. Two weeks after arming, re-run the Measurements command and apply the falsifiers below.

## Live decision register

| #   | Decision                                                        | Status        | Resolution                                   | Falsifier                                                                                                                         |
| --- | --------------------------------------------------------------- | ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | Default of `AIF_EOT_RECAP_MAX_WORDS` | operator-fork | open — see «The R-1 fork» below | two weeks after arming: blocks over the chosen N still above 15 % → the contract line is not teaching, revisit the message; at N = 30, blocks over 25 under 15 % → tighten to 25 |
| R-2 | Agent-side term = new demand site; `usages` stay operator-only  | answered      | this session, D3                             | wrong if a term reaches «learned» with the operator never having used or re-asked it and then re-asks it                          |
| R-3 | `_Avoid_` matcher not built                                     | answered      | this session, D4 (0 / 2395)                  | the D4 trigger fires                                                                                                              |
| R-4 | STE word list not adopted; «one idea» is prose only             | answered      | this session, D1                             | a maintained Russian controlled-language lexicon is found                                                                         |
| R-5 | Auto-`/wait-what` out of scope                                  | answered      | this session, D5 (3.4 % and falling)         | the D5 trigger fires                                                                                                              |
| R-6 | Line cap unchanged                                              | answered      | this session, D6 (4 / 227)                   | the D6 trigger fires                                                                                                              |
| R-7 | Arming the gate here is a merge precondition of the implementing PR | answered | this session, D7 step 3 (measured unset everywhere; `--full` consumers are armed automatically) | the operator declines to arm → the implementing PR ships D1 only and both arms are dropped, not shipped dormant — every falsifier here needs an armed machine to be evaluated |
| R-9 | D3 is bounded by a per-term per-session one-shot flag | answered | cold review TD-F1, D3 | wrong if `explanations` never advance for a term the agent keeps using — then unprompted forms are not happening and the contract line 3 needs rework |
| R-8 | Own awk arm, no prose-linter dependency                         | answered      | Prior art below                              | a linter ships a Russian sentence tokenizer as a single static binary already required by the install                             |

### The R-1 fork, priced

`/wait-what` imports ASD-STE100, whose bar is 20 words (procedural) / 25 (descriptive) **in
English**. Russian has no articles and fewer auxiliaries, so an equal-content Russian sentence is
*shorter* in words — a faithful import would sit at or below 25. Nothing in the measurements
argues that 30 is as readable as 25; the only argument for a looser N is the retry tax. That is
a value trade — how much of `/wait-what` is enforced versus how many second round-trips are
tolerable — and it belongs to the operator (cold review TD-F6, ESCALATED).

| N  | blocks tripping D2 | plus D3's bounded demands (29 / 192 = 15.1 %), no overlap assumed |
| -- | ------------------ | ------------------------------------------------------------------ |
| 25 | 35.4 %             | ≤ 50 %                                                             |
| 30 | 16.1 %             | ≤ 31 %                                                             |
| 35 | 4.2 %              | ≤ 19 %                                                             |

All three columns are pre-teaching upper bounds, and D3's share decays as terms become learned.

## Testing seams

One existing seam: `packages/core/hooks/end-of-turn-reminder.test.ts` drives the hook with a
transcript fixture and env, and already covers `_eot_recap_defects` under `AIF_RECAP_GATE=1`.
New cases: a sentence of N+1 words (RED) / N words (GREEN); `path.ext`, `path:NN`, `1.5` do not
split; an inline code span counts as one word; a long sentence inside the fork card is exempt and
the line count is unchanged by the helper extraction (goldens byte-identical); garbage
`AIF_EOT_RECAP_MAX_WORDS` falls back to the default in **both** the contract text and the
checker; **the same RED case under `LC_ALL=C` and `LC_ALL=C.UTF-8`** (the PR 1824 class); the
armed-twin suite gets the over-length fixture (D7). For D3:
`packages/core/hooks/glossary-counters.test.ts` with `AIF_RESIDUE_DIR` — unlearned term without
the form (RED once, silent on the next block of the same session), with the form (GREEN +
`explanations` +1), a term only inside a code span (GREEN), learned term (GREEN), term also in
the pending file (counted once, demanded once), `lib/glossary.sh` absent (inert, RC 0),
`CONTEXT.md` absent (inert, unarmed goldens byte-identical).

## Consequences

- Armed sessions pay at most one extra retry per defective block; the priced table above is the
  upper bound, and both arms share the one block-sha bound, so a block with both defects still
  costs one retry.
- The glossary counters gain a second writer path inside the Stop hook; the lib extraction is what
  keeps the lock discipline in one place.
- Plugin-channel consumers get D2 but not D3 (no sourced lib there, by rule).
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

- 2026-09-21 — draft written.
- 2026-09-21 — round 1 of the cold review applied (TD REVISE, BU REVISE): D3 bounded and moved
  out of the defect function, prose-only term match, card-region seam named, D7 delivery list
  completed, R-1 re-priced and its STE argument corrected, R-7 inverted. Dispositions in the
  review log.
