# Recap hook reuses `/wait-what` + `CONTEXT.md` — design

> **Status:** DRAFT, **revision 2 (2026-09-22)** — design only; no hook code ships with this spec.
> Revision 2 narrows the design after the operator reopened it in dialogue: see «Revision 2»
> below for what is superseded. Cold `/arch` §2 review dispositions live in the
> [review log](2026-09-21-recap-wait-what-reuse-review-log.md).
> **Authoritative for:** the recap-contract lines that import `/wait-what`'s demands (D1), how
> the glossary grows and how the agent treats the operator's spellings (D8), the `/arch` binding
> of mattpocock `domain-modeling` and the partial reversal of parent R-4 (D9), the `/story`
> lines (D10), and the two PARKED mechanical arms with their measured thresholds (D2, D3).
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> the recap block, the «от тебя» grammar, the glossary file format and its two counters — the
> parent spec [2026-09-13-plain-words-recap-v2-design.md](2026-09-13-plain-words-recap-v2-design.md)
> (D-A, D-B, D-F); `/wait-what` itself — a vendored plugin skill, ADOPT as is (parent D-F).

The parent spec sits at exactly 600 lines (the markdown gate), so this is a sibling spec and the
parent gains no pointer line. Every `path:NN` below was read at `origin/staging` =
`ef9b43c68ff` via `git show origin/staging:<path>`.

## Revision 2 (2026-09-22) — what changed and why

Revision 1 (merged as PR 1831) added two mechanical arms to the recap gate. The operator then
reopened the premise: «взять готовое, а не делать своё» — reuse Matt Pocock's skills instead of
growing own machinery. Five findings from that dialogue reshape the design. Each was measured in
the session; the commands are reproducible.

1. **There is no upstream hook to duplicate.** `mattpocock-skills` 1.2.3 ships two helper
   scripts and no hooks directory (`find <plugin>/1.2.3 -maxdepth 3 -name 'hooks*'` → nothing).
   `/wait-what` is one sentence of prompt. What can be reused is its **text** — that is D1.
2. **The glossary learning counters (SSOT #283, parent D-F) have never run.**
   `glossary-inject.sh` is registered in no settings file —
   `grep -c glossary-inject ~/.claude/settings.json .claude/settings.json .claude/settings.local.json plugin/hooks/hooks.json`
   → 0 everywhere — and a UserPromptSubmit hook fires only when registered
   (`scripts/register-glossary-hook.sh:5-11` says so itself). One counters file exists on the
   machine (`find … -name _glossary-counts.json` → one hit, two terms, one usage each). The code
   is sound: a live run counted «харвест» and «harvest» and ignored «хеверст», because only the
   spellings listed under `_Operator says_` match.
3. **An explanation that was written is not an explanation that was read.** The operator:
   «оператор не всегда это читает, чаще всего только что от него надо и что дальше». The
   `explanations ≥ 5 → learned` half of D-F therefore measures the agent's output, not the
   operator's knowledge. Revision 1's D3 stood on that half.
4. **The term beats its paraphrase.** Asked to choose between «Harvest» and a plain-words
   rewrite in the «От тебя» line, the operator chose the term: the rewrite was vaguer («у какого
   агента, откуда?»). So the contract must not push the agent away from glossary terms.
5. **Upstream solves «unknown words» at the source, not by teaching.** mattpocock
   `domain-modeling` lets a term into `CONTEXT.md` only when it is resolved **in dialogue with
   the human**, so every glossary term is already known to them; agents then use the terms bare,
   and `/wait-what` is the escape hatch. Our seed glossary was written by an agent, which is why
   a teaching layer seemed necessary. The operator's replacement signal: «я сам могу спросить
   что это значит — и тогда это можно добавлять в мой словарь».

Net effect: D1 is rewritten (examples added, line 3 changed); D2 and D3 are **PARKED** with a
revisit trigger; D8-D11 are new; the R-1 fork and the arm-the-gate precondition (R-7) are moot
while the arms are parked.

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

So any new defect is dead code here until the gate is armed. Revision 1 made arming a rollout
step; revision 2 parks the defects instead (D2, D3), which removes the step.

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

### D1 Contract text — four lines with examples, both packs (revision 2)

`aif_msg_eot_recap_contract` (both `lang/*.sh`, key parity via `lang/check-parity.sh`) gains
four lines after the line-cap sentence. Each rule carries a bad/good example, because the
operator asked for them («примеры очень важны для понимания»). Semantics (the wording is pack
content; the Russian drafts below are what the operator reviewed):

1. Short sentences, at most 25 words; split a longer one instead of chaining clauses with
   colons, dashes and parentheses. 25 is ASD-STE100's own bar for a descriptive sentence — the
   standard `/wait-what` names. With D2 parked the number is teaching text and costs no retry,
   so the R-1 fork (25 / 30 / 35) no longer needs an answer.
2. One idea per sentence. Draft example — bad: «Поправил X, но CI красный, потому что Y»; good:
   «Поправил X. CI красный: Y.»
3. A `CONTEXT.md` term is written as the glossary writes it, **bare, and never replaced by a
   paraphrase**. Project jargon that is NOT in `CONTEXT.md` is said in plain words. Draft example
   — bad: «сделал merge-forward»; good: «влил свежий staging в ветку». The rule has no special
   case for the «От тебя» line (finding 4).
4. The growth rule of D8, in one sentence: when the operator asked this turn what a word means,
   the answer explains it and the word is recorded in `CONTEXT.md`.

All four lines are **teaching text, not enforcement**, and this spec does not present them as
checks ([attention-is-not-a-mechanism.md §1](../../../.claude/rules/attention-is-not-a-mechanism.md)):
they are not load-bearing — a block that ignores them is still a valid block, and the operator's
recourse is a re-ask or `/wait-what`. STE's approved-word dictionary is an English lexicon and has
no Russian counterpart; it is not adopted in any form. Revision 1's inline form
`Term (explanation)` is dropped from the contract together with the counters that consumed it
(D11).

### D2 Defect «long sentence» — PARKED (revision 2)

**Status: not built now.** Reasons: the re-ask rate is 3.4 % over the last 7 days and falling
(Measurements); `AIF_RECAP_GATE` is unset on the operator's machine, so the arm would be dead
code here; and it drags the R-1 fork plus the arm-the-gate consent. **Trigger to build:** the
7-day re-ask rate is back above 7.9 % two weeks after D1 lands, or the operator reports long
sentences. The design below is kept verbatim as the ready-to-build shape, thresholds included.

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

### D3 Defect «unlearned glossary term in the block» — PARKED (revision 2)

**Status: not built, and not buildable as written** — it stands on the `explanations` counter,
which finding 3 shows does not measure what the operator knows, and on counters that never ran
(finding 2). Kept as a record of the bounded-demand analysis (the `stop_hook_active` undercount,
the one-shot flag, the stdout-contract seam); a future arm would need a different «learned»
signal first. D8 replaces its purpose.

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
over 35 days → 3.4 % over the last 7), so there is no evidence it is needed.
**Trigger to revisit as its own slice:** the 7-day rate is above 7.9 % two weeks after D1 lands.

### D6 The 15-line cap does not move

Splitting a sentence adds a sentence, not a line; only 4 of 227 blocks exceed 15 lines and p90 is
12. **Trigger:** `blocks_over_15_lines` above 5 % of blocks two weeks after D1 lands.

### D8 The glossary grows from the operator's questions; spellings are mapped silently

- **Growth rule.** When the operator asks what a word means («что значит X», «объясни X»), the
  agent explains it in the answer and, in the same turn, adds or extends the word's `CONTEXT.md`
  entry: the definition plus the operator's spelling under `_Operator says_`. From then on the
  term is written bare. This is upstream's «update `CONTEXT.md` inline when a term is resolved»
  with the operator's question as the resolving event. No counter, no threshold, no hook
  registration.
- **Silent spelling mapping.** When the operator writes a glossary term his own way («хеверст»,
  «вендерить», «ведерить»), the agent maps it to the term **without asking**, appends the
  spelling to `_Operator says_`, and reports the edit in one line of the answer. The operator
  rejected a confirmation question here; the one-line report is what keeps a wrong mapping
  visible. The need is measured: the re-ask script's own stems missed «ведерить» on
  2026-09-22.
- **Is one explanation enough?** Measured with the vendored script:

  ```bash
  python3 scripts/measure/measure-term-reasks.py
  ```

  Run 2026-09-22 over 444 transcripts: «приземлить» asked 2026-08-16; «чипы», «глубина»,
  «вендерить», «энв-тир» asked 2026-08-17; none asked again for five weeks; then one message on
  2026-09-21 (UTC) asked about four of them at once. The operator's own reading of that message:
  «я все это знаю уже, я просто уточнил, в контексте я бы понял» — a probe of this design, not
  a lapse. So the data does not show forgetting, and it cannot show remembering either (the
  script is a phrase match; «did not ask» also covers «did not read»). The design does not
  depend on the answer: a second ask costs one message.
- **Channel.** D1 line 4 (emitted every turn by the Stop hook) plus the `CONTEXT.md` header,
  which today still describes the counters and «challenge rule NOT adopted» (`CONTEXT.md:3-15`)
  and is rewritten by the implementing slice.
- **One entry to verify, not to decide.** `CONTEXT.md` defines **Env tier** as the Tier 0/1/2
  task routing, while the install docs use `env` for the middle install profile
  (`INSTALL-FOR-AI.md:363`, `:459`). The implementing slice reads the 2026-08-17 transcript where
  the operator asked about it and fixes the entry if it names the wrong thing.

### D9 `/arch` adopts mattpocock `domain-modeling`; parent R-4 is reversed in part

Parent R-4 (`2026-09-13-plain-words-recap-v2-design.md:248-259`, register row at `:420`) made
three adaptations to upstream's glossary discipline. It was decided by the spec author in cold
review round 1 and marked reversible — and it overrode an operator answer: the harmonization
spec's D-H11 row (`2026-08-18-skill-stack-harmonization-design.md:138`) records «answered
2026-08-18 … ADOPT skill + CONTEXT.md as-is … the skill's value is live inline
challenge-and-write», then «superseded 2026-09-13 → ADAPT (R-4)». Revision 2 moves back toward
what the operator had ratified. Revision 2 keeps two and
revises one:

| Parent R-4 part                                                        | Revision 2                                                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| (a) operator words live in the added `_Operator says_` field           | kept                                                                                                                         |
| (b) upstream's «challenge the user against the glossary» NOT adopted   | **revised:** adopt «sharpen fuzzy language» and «update `CONTEXT.md` inline»; still never correct the operator's own word    |
| (c) process terms allowed in the seed                                  | kept                                                                                                                         |

The fear behind (b) was real — upstream's `_Avoid_` would have steered the operator away from
«приземлить» — and (a) already removes it: his word is recorded as his word. What (b) also threw
out is the half the operator now asks for: «важно определиться в терминах, что мы одно и то же
понимаем» — agreeing on words is how an idea session verifies shared understanding.

Binding, following the `grilling` precedent in `/arch` §1 (SSOT #253): in idea sessions `/arch`
invokes `mattpocock-skills:domain-modeling` AS IS next to `grilling` — upstream's own pairing
(`grill-with-docs`, `wayfinder`, `triage` each «call the Skill tool twice, for grilling and
domain-modeling»). The mechanic is read from the upstream text, never from a paraphrase here.
`/arch` owns only the bindings: (i) `_Operator says_` replaces upstream's use of `_Avoid_` for the
operator's raw words; (ii) the agent asks «X or Y?» about a fuzzy word but never tells the
operator to stop using his word; (iii) outside idea sessions the agent does not open vocabulary
questions — there D8 applies. Because `/arch` ships at the env tier and the plugin is not in the
companions manifest, the consumer-delivery arm is the one #253 already took for `grilling`: a
byte-identical vendored copy under `.claude/skills/arch/references/`, SHA-pinned, hash-tested,
with upstream's MIT notice. Today `/arch` mentions neither `CONTEXT.md` nor `domain-modeling`
(`git grep -n -iE 'domain-modeling|CONTEXT\.md|glossary' origin/staging -- .claude/skills/arch`
→ no output).

The parent spec sits at 600 lines, so it gains no «superseded» pointer; the `CONTEXT.md` header
and the harmonization spec's D-H11 row carry it instead (one line each, implementing slice).

### D10 `/story` carries the same three demands

`/story` today says nothing about `CONTEXT.md` or plain language (same grep over
`.claude/skills/story` → no output). The implementing slice adds D1 lines 1-3 to the one story spec
`/story` and the Stop-hook branch share — `aif_msg_eot_branch_story` in both packs
(`lang/ru.sh:233`), printed by `helpers/emit-story-prompt.sh`. `story/SKILL.md` step 2 says
«explain jargon on the spot»; it is reworded to D1 line 3 (glossary terms bare, other jargon in
plain words), so the skill and the pack text cannot disagree. It does not invoke `/wait-what`: the skill is
`disable-model-invocation: true`, and a path into the versioned plugin cache is absent on
consumers without the plugin — one attributed sentence is the smaller dependency. Revision 1
read the operator's ask as «do not touch `/story`»; he widened it on 2026-09-22 («доработать
/story и хук»). `/story` is being reworked by S4 right now, so this waits for S4 like the rest.

### D11 The learning counters stay dormant and untouched

Nothing in revision 2 consumes `_glossary-counts.json`. The counter code, its tests and
`scripts/register-glossary-hook.sh` are left as they are: removing a shipped, tested capability
is its own decision with its own consult, not a side effect of this slice. `glossary-inject.sh`'s
other job — injecting `"<raw word>" = <term>: <definition>` when the operator's prompt uses a
term — is also dormant for the same unregistered reason; whether to arm it is left to the
operator and changes nothing here.

### D7 Rollout (revision 2)

1. Implementation starts **only after recap-v2 slice S4 lands** (aif task
   `6ae9ecab-efa4-4829-9113-2a45059f2191`, in flight, not to be redispatched; not on `staging`
   as of `8fd9c297acd`, 2026-09-22): S4 edits both lang packs, their `plugin/hooks/lang/` twins,
   `end-of-turn-reminder.test.ts` and the `/story` rework (`kickoff-s4.md:82-95`, `:137`) — the
   files D1 and D10 edit. S5 names neither the Stop hook nor the packs (grep count 0), so there
   is no ordering against S5.
2. One PR to `staging`. File list:
   - both `lang/*.sh` packs **and a hand `cp` to `plugin/hooks/lang/`** — no generator rebuilds
     the pack twins (`end-of-turn-reminder.test.ts:3014-3019`), and `check-parity.sh` compares
     en↔ru inside one directory, never source↔twin;
   - `aif_msg_eot_branch_story` in both packs (same files, same hand `cp`) and one sentence of
     `.claude/skills/story/SKILL.md` (D10);
   - `.claude/skills/arch/SKILL.md` §1 binding plus the vendored
     `references/domain-modeling.md` (and upstream's `CONTEXT-FORMAT.md`, which the skill body
     links) with the hash test, on the `grilling-vendored-body.test.ts` pattern (D9);
   - `CONTEXT.md` header rewrite, the Env tier check (D8), one «superseded in part» line on the
     harmonization spec's D-H11 row;
   - goldens of the contract text; the SSOT note (see Prior art).
   The Stop hook's **code** is not edited: D1 is pack text. No lib extraction, no `install.sh`
   line, no settings change, no operator hand step.
3. Two weeks after the PR lands, re-run the three measuring commands (Measurements, D8) and
   apply the falsifiers below.

## Live decision register

| #   | Decision                                                        | Status        | Resolution                                   | Falsifier                                                                                                                         |
| --- | --------------------------------------------------------------- | ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| R-1 | Default of `AIF_EOT_RECAP_MAX_WORDS` | answered — moot | revision 2: D2 parked, so no default ships; D1 line 1 teaches 25 (STE's own bar) at zero retry cost | the D2 build trigger fires → the fork reopens with the priced table below |
| R-2 | Agent-side term = new demand site; `usages` stay operator-only  | answered — superseded | revision 2: D3 parked, D8 replaces its purpose | — |
| R-3 | `_Avoid_` matcher not built                                     | answered      | D4 (0 / 2395)                                | the D4 trigger fires                                                                                                              |
| R-4 | STE word list not adopted; «one idea» is prose only             | answered      | D1                                           | a maintained Russian controlled-language lexicon is found                                                                         |
| R-5 | Auto-`/wait-what` out of scope                                  | answered      | D5 (3.4 % and falling)                       | the D5 trigger fires                                                                                                              |
| R-6 | Line cap unchanged                                              | answered      | D6 (4 / 227)                                 | the D6 trigger fires                                                                                                              |
| R-7 | Arming the gate is a merge precondition of the implementing PR  | answered — moot | revision 2: no arm ships, so nothing needs an armed machine | the D2 build trigger fires → R-7 returns with D2 |
| R-8 | Own awk arm, no prose-linter dependency                         | answered      | Prior art below (applies to the parked D2)   | a linter ships a Russian sentence tokenizer as a single static binary already required by the install                             |
| R-9 | D3 is bounded by a per-term per-session one-shot flag           | answered — superseded | revision 2: D3 parked | — |
| R-10 | No mechanical arms now; four teaching lines with examples      | answered      | operator, dialogue 2026-09-22 («взять готовое»); D1, D2/D3 status | two weeks after landing: 7-day re-ask rate above 7.9 %, or over-25 blocks not below the measured 35.4 % → the lines do not teach; build D2 |
| R-11 | Always the glossary term, never a paraphrase; jargon outside the glossary in plain words | answered | operator, 2026-09-22 (finding 4); D1 line 3 | the operator re-asks a bare glossary term more than once in two weeks (`measure-term-reasks.py`) → that entry's definition is the defect, rewrite it |
| R-12 | Learning counters dropped from the scheme; the operator's question is the signal | answered | operator's own proposal, 2026-09-22 (findings 2, 3, 5); D8, D11 | `CONTEXT.md` gains no entry or spelling from a question in four weeks although `measure-term-reasks.py` shows asks → the growth rule is not followed; move it to a hook-side reminder |
| R-13 | Spellings mapped silently, reported in one line                | answered      | operator, 2026-09-22; D8                     | one wrong mapping lands in `CONTEXT.md` unnoticed (found by the operator later) → switch to a confirmation question |
| R-14 | `/arch` adopts `domain-modeling`; parent R-4(b) reversed in part | answered    | operator, 2026-09-22; D9                     | the agent corrects the operator away from his own word once → the binding (ii) failed; tighten or withdraw |
| R-15 | `/story` carries D1 lines 1-3                                   | answered      | operator, 2026-09-22; D10                    | — (text-only; covered by R-10's re-measure)                                                                                        |

### The R-1 fork, priced (parked with D2)

Kept for the day the D2 trigger fires. `/wait-what` imports ASD-STE100, whose bar is 20 words (procedural) / 25 (descriptive) **in
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

Revision 2 ships text, so the seams are the existing ones and they are few:

- `packages/core/hooks/end-of-turn-reminder.test.ts` — the contract goldens change (both packs,
  source and twin); the armed-twin suite (`:3023`) already fails when a twin lacks what its
  source has.
- `lang/check-parity.sh` — en↔ru key parity; unchanged keys, changed text.
- The vendored `domain-modeling` body: a hash test on the `grilling-vendored-body.test.ts`
  pattern, so the whole-tree prettier sweep cannot rewrite it silently.
- D8 and D9 are agent behaviour; their seam is the two-week re-measure (R-11…R-14), not a unit
  test. That is stated, not hidden: they are teaching text, and none is load-bearing.

The seams of the parked D2/D3 (sentence fixtures under `LC_ALL=C` and `C.UTF-8`, the
`AIF_RESIDUE_DIR` counter cases) are recorded in revision 1 of this file (`git show
54d1851055d:docs/superpowers/specs/2026-09-21-recap-wait-what-reuse-design.md`).

## Consequences

- Every session, armed or not, sees four more contract lines; nothing retries, nothing blocks.
- The glossary stops being agent-authored: it grows from the operator's questions (D8) and from
  idea sessions (D9). Entries nobody asks about stay as they are.
- A shipped, tested capability (#283 counters) is now unused by design as well as unregistered
  in fact. D11 leaves the removal decision open on purpose.
- `/arch` takes a second vendored upstream body; the #253 misroute counter covers it.

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

**Revision 2.** The BUILD verdict above applies to the parked D2 only. What ships now is reuse:
`/wait-what`'s sentence as contract text (#253 sweep: ADOPT) and `domain-modeling` lifted from
ADAPT toward ADOPT-with-bindings in `/arch` (harmonization spec D-H11; the same lift `grilling`
took, #253). Upstream texts were read from the installed plugin cache at 1.2.3 on 2026-09-22
(`wait-what/SKILL.md`, `domain-modeling/SKILL.md`, `CONTEXT-FORMAT.md`, `productivity/README.md`,
and every `SKILL.md` naming `domain-modeling`). Problem-class check (T16): upstream = a glossary
the human co-authors in design interviews, consumed bare by agents; ours after revision 2 = the
same, plus a recorded-spellings field. Match. The implementing commit appends a dated note to
row #283 («unused since revision 2 of the reuse spec») and to #253 (second vendored body).

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

- «я думал просто в своем скрипте использовать скил мета … как и везде взять готовое а не делать
  свое» (2026-09-22). Read as: prefer upstream's mechanism over own machinery — findings 1, 5.
- «оператор не всегда это читает, чаще всего только что от него надо и что дальше» (2026-09-22).
  Read as: written explanations are not evidence of learning — finding 3.
- «выученые можно использовать … хервест для меня теперь абсолютно понятно, понятнее чем второе —
  потому что второе не четкое. у какого агента откуда?» (2026-09-22). Read as: R-11.
- «можно без вопроса чтобы он сам соотносил» (2026-09-22). Read as: R-13.
- «взять его domain-modeling оно же реально хорошо еще и для уточнения идеи … важно определиться
  в терминах что мы одно и тоже понимаем» (2026-09-22). Read as: R-14.
- «может все это уже лишнее и переусложнение … я сам могу спросить что это значит — и тогда это
  можно добавлять в мой словарь» (2026-09-22). Read as: R-12; the 100-usages threshold he floated
  in the same message is withdrawn by it.
- «доработать /story и хук» (2026-09-22). Read as: R-15; widens the 2026-09-21 reading above.
- «я все это знаю уже, я просто уточнил, в контексте я бы понял» (2026-09-22). Read as: the
  2026-09-21 four-word ask is not evidence of forgetting (D8).

## Changelog

- 2026-09-21 — draft written.
- 2026-09-21 — round 1 of the cold review applied (TD REVISE, BU REVISE): D3 bounded and moved
  out of the defect function, prose-only term match, card-region seam named, D7 delivery list
  completed, R-1 re-priced and its STE argument corrected, R-7 inverted. Dispositions in the
  review log.
- 2026-09-22 — **revision 2**, after the operator reopened the design in dialogue: D1 rewritten
  (four lines with examples, bare terms), D2/D3 parked with build triggers, D8-D11 added, D7
  reduced to a text-only slice, R-1/R-7 moot, R-10…R-15 added, `measure-term-reasks.py` vendored.
  Cold review round 2 dispositions in the review log.
