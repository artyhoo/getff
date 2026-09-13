# Plain-words recap v2 — one block, fork cards, glossary, fewer stops — design

> **Status:** DRAFT — awaiting two cold reviews (`/arch` §2) and the operator gate.
> **Authoritative for:** the operator-facing surface of every agent turn in this repo — the
> end-of-turn block, the fork card, the /arch round form, the «от тебя» grammar, the glossary
> with its two counters, the /story rework, and the autonomy edits that remove text-born stops.
> **NOT authoritative for:** project goal — [README.md#why-this-exists](../../../README.md#why-this-exists);
> the handoff-currency gate — [2026-09-08-handoff-currency-gate-design.md](2026-09-08-handoff-currency-gate-design.md);
> the operator floor object cut — [autonomous-night-v3 §6](2026-08-09-autonomous-night-v3-design.md);
> the advisor seat — [advisor-pattern-design](2026-08-10-advisor-pattern-design.md).

## Context

**One problem, measured.** The operator too often does not understand what the agent is saying
and has to ask for a plainer re-explanation; the second half of the same problem is the agent
stopping to «wait for go» when nothing needs the operator, and offloading verification onto the
operator («ознакомься и проверь») so that a blind «го» is read as «verified». Source handoff:
memory `project_handoff_2026_09_13_session_explanations_ux.md` (decisions D1-D12 ratified
2026-09-13); this spec closes the design session that followed (Q1-Q14).

Measurements (project transcripts, `~/.claude/projects/-Users-art-code-rules-as-tests-aif*`):

| Measure | Value | Source |
|---|---|---|
| Sessions scanned | 238-239 | source handoff; `measure-recap-len.py` |
| Operator re-explain asks | 100 | source handoff |
| Turns ending in «жду го»-class waits vs real harness blocks | 636 vs 101 | source handoff |
| `## 🟢 Простыми словами` blocks emitted | 1571 | `measure-recap-len.py` (2026-09-13) |
| Block non-empty lines p50 / p90 / max | 7 / 10 / 35 | same |
| Whole-message lines p50 / p90 / max | 11 / 24 / 80 | same |
| Blocks containing a question | 6 % | same |
| `## 🎬` story emissions | 165 | `grep -l` over transcripts |

Reading: the block is already short; the pain is its content (action retelling: the RU pack's
branch-A text opens «в первую очередь для себя» and lists «чем я занят / что я только что
сделал», [ru.sh](../../../.claude/hooks/lang/ru.sh)) and forks living in the long text ABOVE
the block. Waits come from text, not from permissions: bypassing permissions (D4) was rejected.

**Verified facts (2026-09-13, this checkout = origin/staging `94a3a9efcd5`):**

- Stop hook [end-of-turn-reminder.sh](../../../.claude/hooks/end-of-turn-reminder.sh): branches
  A/B/C/story selected at `:876-893`; long-text threshold 500 chars `:762-770`; `asked`
  detection (trailing `?` or `AIF_EOT_QUESTION_PATTERN`) `:775-784`; already-recapped guard on
  `AIF_RECAP_MARKER` `:615`; anchor extraction from `ai-title` / first user message `:518-532`
  (defect: a bare filename as first message yields «<system-reminder>» as the session goal);
  handoff-currency gate precedent for a form gate (awk heading check + cap + sha256) `:424-500`.
- [ask-question-reminder.sh](../../../.claude/hooks/ask-question-reminder.sh): PreToolUse
  deny-once on `AskUserQuestion`, two-state flag `${TMPDIR}/aif-ask-reminded-<session>`.
- Lang packs [en.sh](../../../.claude/hooks/lang/en.sh) / [ru.sh](../../../.claude/hooks/lang/ru.sh)
  selected by `AIF_HOOK_LANG`; parity gate [check-parity.sh](../../../.claude/hooks/lang/check-parity.sh)
  collects every `aif_msg_*` function, the markers and every `AIF_EOT_*` variable.
- /arch round carrier binding: [arch/SKILL.md:50](../../../.claude/skills/arch/SKILL.md) (c) —
  a frontier that fits (≤4 questions, choice-shaped) rides `AskUserQuestion`, longer or
  prose-shaped questions use upstream grilling's `❓ Qn / ➡️` format.
- Hand-action script family: [register-precompact-hook.sh](../../../scripts/register-precompact-hook.sh),
  [register-handoff-gate.sh](../../../scripts/register-handoff-gate.sh) — root resolved from the
  script's own path (any cwd), idempotent, self-verifying, `--print-root`; covered by
  [register-root-resolution.test.sh](../../../scripts/register-root-resolution.test.sh)
  (PR #1443, #1680, #1683; `--user` targeting `~/.claude/settings.json` PR #1737).
- /story: [story/SKILL.md](../../../.claude/skills/story/SKILL.md) (58 lines, PR #592); text
  SSOT = `aif_msg_eot_branch_story` in the lang packs («по актам — что делали, что пошло не
  так, как починили»).
- Antipattern `#worker-dispatch-via-subagent`: [pipeline/SKILL.md](../../../.claude/skills/pipeline/SKILL.md)
  ~:389, principle [29-worker-dispatch-channel.ts](../../../packages/core/principles/29-worker-dispatch-channel.ts)
  (`CHANNEL_RE`, `WRITE_WORKER_RE`, `READONLY_CONTEXT_RE`, escape `channel-discipline: allow`),
  hook `check-worker-dispatch-channel.sh`; 33 repo files reference the name.
- Glossary reuse: mattpocock `domain-modeling` (`CONTEXT.md`: `**Term**:` / 1-2 sentences /
  `_Avoid_:`; «a glossary and nothing else») and `wait-what` (user-invoked re-explanation in
  the ubiquitous language, must not degrade on repeat) — SSOT #230 (REFERENCE), #253 (grilling
  ADOPT), #122 (recap = BUILD).

## Decision

### D-A The block — one form for every Stop branch

Every turn ends with the marker block (`AIF_RECAP_MARKER`, RU «## 🟢 Простыми словами») in
this order; an empty section is **omitted**, never filled with «nothing»:

1. **Goal and where we are** — one sentence of the session goal + how far along.
2. **What changed for the project** — objects (PR / file / setting / decision), before → after,
   never verbs of what the agent did.
3. **Forks** — one fork card (D-C) per genuine fork.
4. **Least sure** — the one thing least verified.
5. **Next** — exactly two lines: «я: …» and «от тебя: …» (D-B).

Gate matrix (deterministic, in the Stop hook; one auto-retry naming what is missing, like the
handoff-currency gate): sections 1 and 5 always; 3 when the turn ended in a question (`asked`);
2 when `long_text`. The retelling part (sections 1, 2, 4, 5) is capped at
`AIF_EOT_RECAP_MAX_LINES` (default 15, D3 of the source handoff); **fork cards are never
capped** (operator premise P-4). Branch selection stays; the branches now differ only in which
sections the gate demands. Self-checks («did I offload a decision?», «did I decide a fork
silently?», «would a seventh-grader follow this?» — D11) stay as hook INSTRUCTION lines, not as
output sections. The block stays at the END of the reply (D1).

### D-B The «от тебя» grammar

The last line takes exactly one of four values; the gate rejects anything else:

| Value | Meaning | Who verified |
|---|---|---|
| «ничего» | done AND verified by the agent (test run, CI green, probe quoted) | the agent — the claim is its own |
| «ждём: X» | something runs; the agent reports back | n/a |
| «решить: A или B» | a genuine fork = operator floor ([autonomous-night-v3 §6](2026-08-09-autonomous-night-v3-design.md): taste / goal; objects outside authorized scope — standing config, maintainer artifacts, new PRs and scope widening, spend, security, the goal; deletions of non-generated artifacts; externally visible actions). Everything recorded goes to the advisor seat, not the operator | the fork card carries the evidence |
| «сделать руками: X» | harness-forbidden for the agent (settings.json, force-push, remote branch delete, merge to main, secrets / logins; chip clicks); look-and-poke ONLY when no automated probe exists, stated as a concrete action | n/a |

The words «проверь / ознакомься / убедись / посмотри» (EN: check / review / make sure / have a
look) in that line → gate rejects. «го» is read as a decision on the NAMED fork only, never as
«I verified»; verification stays the agent's. **«го» echo:** the next turn opens by stating
what the «го» (or silence) accepted, so the operator sees what they signed (Horvitz P11).

### D-C The fork card — one text, three surfaces

Sections (D8, ratified with the 2026-09-13 examples): 0 «Где мы» (context refresh; shared
once per /arch round, D-D); 1 title in everyday words; 2 what we decide — an example from THIS
project, never an analogy (analogies only for a wholly new concept, D11); 3 «if A / if B» — the
noticeable consequence of each; 4 «➡️ Рекомендую …, потому что **the most essential reason**»
first and bold, then up to three more reasons one line each, then one line
«обратимо / необратимо»; 5 «от тебя: ок, или „не ок, потому что …"». The card text lives in
the lang packs by `AIF_HOOK_LANG` (one function, read by both the Stop hook and
`ask-question-reminder.sh`); before `AskUserQuestion` the card is emitted first and the buttons
are only the short summary with the recommendation as the FIRST option. A card is **never
shortened to fit a cap** (P-4: the compact variant with `[решить]`/`[молчание]` tags and
reasons-only was rejected live — «теперь ничего не понятно»).

### D-D The /arch round form (batched questions)

A round = section 0 «Где мы» ONCE (goal + «принято в прошлом раунде: …», including what a
«го» or silence accepted) + one FULL fork card per question in upstream grilling's `❓ Qn / ➡️`
form + ONE closing line «от тебя: решить Qa, Qb; по Qc можно молчать; „го" = принять все ➡️».
Must-answer questions per round ≤ 4 (Claude Code `AskUserQuestion` cap 1-4 × 2-4, cross-
validated by Cursor — the only cross-source numeric cap found); a longer frontier is split by
prerequisite depth, roots first. Reversible forks may be left to the recommendation; taste /
goal and irreversible forks need an explicit answer. Carrier binding [arch/SKILL.md:50](../../../.claude/skills/arch/SKILL.md)
(c) is unchanged.

### D-E «Сделать руками» convention

A hand action is either (a) ONE invocation line of a tested script in the
`scripts/register-*.sh` shape — resolves the repo from its own path so it runs from any cwd,
idempotent, self-verifying at the end — or (b) one concrete UI action («открой X, нажми Y,
скажи, что увидел»). The gate rejects the line without either. If a skill wrapping such scripts
exists (operator recollection 2026-09-13, not found — see Changelog), the line names the skill
instead of the script; the rule is skill-agnostic. **Implementation check owed:** every shipped
hand-action script is run from `/tmp` and from a second checkout — exit 0 and its own «OK».

### D-F The glossary — one file, two mechanical counters

- **File:** `CONTEXT.md` at the repo root, English, mattpocock `domain-modeling` format as is
  (`**Term**:` / 1-2 sentences / `_Avoid_:`); «a glossary and nothing else». The orchestrator
  role glossary (`.claude/skills/orchestrator/references/glossary.md`) becomes a section of it
  with a pointer left behind (reversible).
- **The association «что что обозначает», both directions (Q9):** the `_Avoid_` line holds the
  operator's raw words for the same thing in the operator's language — match data, the same
  category as the Russian question pattern inside `lang/ru.sh`. Operator → agent: the
  `UserPromptSubmit` hook scans the prompt for terms and `_Avoid_` words and injects one line
  «"<raw word>" = <term>: <definition>»; domain-modeling's own «challenge against the
  glossary» rule makes the agent answer with the term. Agent → operator: while a term is below
  threshold the Stop hook demands the inline form «term (one-line explanation in the operator's
  language)». Fallback if a Russian `_Avoid_` line in an English file is judged a
  language-discipline breach: one file per `AIF_HOOK_LANG`, mechanics unchanged.
- **Counters (Q4/Q10):** `_glossary-counts.json` in the residue dir
  ([residue-dir.sh](../../../.claude/hooks/lib/residue-dir.sh): shared across worktrees and
  sessions, outside git). Two mechanical counters per term: **usages** — the `UserPromptSubmit`
  hook counts the term itself (plus its transliteration) in the operator's prompt; synonym use is
  NOT a usage; **explanations** — the Stop hook counts the fixed «term (explanation)» form, once
  per message. Learned = usages ≥ `AIF_GLOSSARY_USES` (3) OR explanations ≥
  `AIF_GLOSSARY_EXPLAINS` (5), whichever first; both are config. Below threshold the Stop hook
  demands the inline explanation once; above it nothing fires. Agent-maintained marks were
  rejected as `#hope-as-gate` ([attention-is-not-a-mechanism.md](../../../.claude/rules/attention-is-not-a-mechanism.md)).
- **Seed** from the measured re-ask list: приземлить, энв-тир, вендорить, чипы, глубина,
  «красное», harvest, egress, handoff. Jargon the operator likes (harvest, egress, handoff)
  stays — it is taught, not replaced (D9).
- **`/wait-what`:** ADOPT as is (reads `CONTEXT.md`); live-check that it answers in Russian
  under `AIF_HOOK_LANG=ru` (its prompt says Simplified Technical English); fallback = the
  existing `.override.md` layer, one line.

### D-G /story rework (Q14)

`/story` keeps its trigger (PR pushed / operator asks) and its `## 🎬` marker, but its body
becomes the session-scale version of D-A instead of a chronicle by acts: **why all this was**
(one sentence) → **what is different now** — per change: before, after, what it gives the
operator (no chronology) → **what was decided and by whom** (one line each) → **least sure**
→ **next** in the D-B grammar. The text comes from ONE lang-pack function shared with the
recap (a scope parameter: turn vs session), so the two forms cannot drift. Ratified example
(RU) in the operator premise register, P-7.

### D-H Autonomy edits — removing text-born stops

- **D5a** allow-list `gh pr merge --squash` to `staging` explicitly (after a live reproduction
  of the classifier block; the global allow already has `Bash(gh pr *)`).
- **D5b** Ownership Contract ([CLAUDE.md](../../../CLAUDE.md)): edits to maintainer-owned
  files THROUGH a PR to staging do not need a «го» — the gate is PR + CI.
- **D5c** [aif-doctor/SKILL.md](../../../.claude/skills/aif-doctor/SKILL.md): «operator GO»
  only on task deletion.
- **D6** subagent tenets, written into the rule text with anti-expansive-reading protections:
  (1) the Agent tool is allowed in ANY session, /pipeline and /dispatcher included, for
  reading, search, checks, cold reviews; (2) allowed for writes in a normal session in its own
  worktree; (3) FORBIDDEN without the operator's explicit choice is EXACTLY ONE class of
  actions — launching the EXECUTION of an umbrella stage from a kickoff — and the ban is about
  the ACTION, identical for a subagent, an aif dispatch and `claude -p`; (4) exceptions =
  permission given in advance: /night-mode, the `bridge: auto` marker; (5) the pipeline exit
  MUST emit a launch card (D7): recommended channel + arguments + plain-words explanation +
  ready artifacts per channel (chip, kickoff, subagent prompt); (6) the operator picks the
  channel. Protections: (a) a positive «this rule does NOT forbid» list next to the ban; (b) the
  self-test phrase «am I about to launch the EXECUTION of an UMBRELLA STAGE?» — if not, the
  rule does not apply; (c) rename `#worker-dispatch-via-subagent` →
  `#umbrella-execution-launch-without-operator` in LIVE texts only (pipeline/SKILL.md, principle
  29 + its hook, rules) with one «formerly …» line — closed kickoffs and done.md untouched;
  (d) principle 29 + `check-worker-dispatch-channel.sh` narrowed to «a kickoff must not
  PRESCRIBE auto-launch of execution», with a negative test: a kickoff that hands a subagent
  reading/review PASSES.
- **D7** chips stay; the agent cannot open a new Claude Code session itself (no `start_session`
  tool in-session — recheck). The /arch §3 and /pipeline launch card recommends a channel by two
  questions («хотите видеть и вмешиваться?», «длинная самостоятельная работа?»); the operator
  chooses. Memory `dispatch-channel-must-not-need-a-click` is corrected to this rule.

### D-I Anchor extraction fix

The Stop hook's session-goal anchor skips a first user message that is a bare filename /
path or a `<system-reminder>` payload and falls back to `ai-title`, then to «(назови сам из
контекста)» — never emits harness markup as the goal.

## Live decision register

| # | Decision | Status | Resolution | Falsifier |
|---|---|---|---|---|
| Q1 | One spec, not three | DECIDED | operator: autonomy is small and the same root problem | a cold seat shows the autonomy slice needs its own review cycle |
| Q2 | Reasons: most essential bold + first, ≤3 more, reversible line | DECIDED | D-C §4 | operator asks «why?» after a card ≥3 times in a week |
| Q3/Q9 | One `CONTEXT.md`, `_Avoid_` = association | DECIDED | D-F | a raw-word prompt is not mapped by the hook, or language-discipline rejects RU in the file → per-language file fallback |
| Q4/Q10 | Two mechanical counters, 3 uses / 5 explanations | DECIDED | D-F | the inline «term (explanation)» form is not countable or reads artificial (UNVERIFIED) |
| Q5 | Rename antipattern in live texts only | DECIDED | D-H (c) | a live misreading of the ban after the rename |
| Q6/Q7 | One block form, omit-empty, gate matrix | DECIDED | D-A | gate rejects a legitimate bare-question turn |
| Q8 | «от тебя» four values, banned words, «го» = decision only | DECIDED | D-B | operator has to verify something the line called «ничего» |
| Q11 | ADOPT `/wait-what` as is | DECIDED | D-F | it answers in English under `AIF_HOOK_LANG=ru` → override line |
| Q12 | /arch round form | DECIDED | D-D (compact variant rejected live) | operator answers fewer than the must-answer set twice → cap 3 |
| Q13 | Caps on retelling only, never on cards | DECIDED | D-A / D-C | a block over cap that the operator still finds unclear |
| Q14 | /story = session-scale block | DECIDED | D-G | operator keeps skipping `## 🎬` after the rework |
| D-E | Hands = script from any cwd or concrete UI action | DECIDED | D-E | a shipped script fails from `/tmp` or a second checkout |
| D-I | Anchor fix | DECIDED | D-I | a block still shows harness markup as the goal |
| D5a | Allow-list squash-merge to staging | DECIDED, verification owed | D-H | the block does not reproduce live → no allow entry needed |
| D6/D7 | Subagent tenets + launch card | DECIDED | D-H | an agent still refuses read-only subagents citing the rule |

Every row carries a Status — the dialogue closed with an empty frontier on 2026-09-13.

## Testing seams

- [end-of-turn-reminder.test.ts](../../../packages/core/hooks/end-of-turn-reminder.test.ts):
  gate matrix per branch (sections present / missing → block with the missing name); cap on
  the retelling part only; «от тебя» value grammar + banned words; anchor fallback on a bare
  filename and on `<system-reminder>`; story scope emits the session-scale sections.
- [ask-question-reminder.test.ts](../../../packages/core/hooks/ask-question-reminder.test.ts):
  card emitted before the buttons; recommendation is the first option.
- [lang-parity.test.ts](../../../packages/core/hooks/lang-parity.test.ts) +
  [check-parity.sh](../../../.claude/hooks/lang/check-parity.sh): new `aif_msg_*` functions
  (card, round header, story scope, «от тебя» values) and `AIF_EOT_*` / `AIF_GLOSSARY_*` keys
  in both packs.
- New: `glossary-counters.test.ts` — usage counting (term + transliteration, synonym excluded),
  explanation counting once per message, thresholds from env, counts file in the residue dir.
- Principle 29 fixtures: positive (kickoff prescribes auto-launch → fails) and the new
  negative (kickoff hands a subagent a review → passes).
- [register-root-resolution.test.sh](../../../scripts/register-root-resolution.test.sh):
  every new hand-action script joins its matrix (D-E).

## Consequences

- Waits drop only where the text was the cause (636 of 737 measured); harness blocks (101)
  stay and become «сделать руками» lines with a ready script.
- Two packs and two hooks share one card function — a change in the card is one edit.
- Longer replies when a real fork exists (a full card is ~10 lines); accepted by P-4.
- The counters file is machine-local and shared across sessions — a fresh machine starts with
  every term unlearned (by design: the operator is the one who learns, not the repo).
- Renaming the antipattern leaves 30+ historical references to the old name; the «formerly»
  line and the frozen-artifact rule make that intentional.

## Delivery slices (PRs to staging, in order)

1. Lang packs + Stop hook: D-A gate matrix, D-B grammar, D-C card function, D-I anchor fix,
   D-E line check, tests.
2. `ask-question-reminder.sh`: card before buttons (shares slice 1's function).
3. Glossary: `CONTEXT.md` seed, `UserPromptSubmit` hook, counters, `/wait-what` live check +
   override if needed, orchestrator glossary pointer.
4. /arch §1 round form (D-D) + /story rework (D-G) + `emit-story-prompt.sh`.
5. Autonomy: D5a (after live reproduction), D5b, D5c, D6 rule text + rename + principle 29
   narrowing + negative fixture, D7 launch card, memory fix.

## Prior art (research pass 2026-09-13; reports in the session scratchpad)

- **Decision-request formats** — SBAR, BLUF (AR 25-50), Minto (answer first, 2-3 reasons),
  Amazon Type-1/Type-2 doors, DHS decision memo (Options → Recommendation → Approve /
  Disapprove / Modify), ADR one-decision-per-doc vs Rust RFC / PEP «unresolved questions»
  batching, Conventional Comments (blocking / non-blocking labels), SMEAC. Convergence: ask
  first, reasons separate, all asks in one labelled section, one recommended option with the
  alternatives visible, cap the WHOLE document not the item count. «Rule of three» and «three
  options» are folklore — UNVERIFIED numbers. → new SSOT row: decision-request format = BUILD
  (composition of these, no shipping analog).
- **Agent question UX** — Claude Code `AskUserQuestion` (1-4 × 2-4, mandatory option
  description, no recommended flag; primary doc), Cursor (same shape), Codex (auto-default,
  «approval prompts are UX, not security»), Devin (confidence-gated asking, `/recap` = work
  done / key decisions / where things stand, ≥1 question floor under megaplan), Kiro (three
  durable docs), Amp / Aider (no question tool), OpenHands (risk tiers, batch approval),
  Copilot agent (PR checklist as the progress surface), Jules (`:approvePlan`), mattpocock
  (`grill-with-docs` multi-round batching, `CONTEXT.md` `_Avoid_`, `wait-what`), Horvitz 1999
  (P3 interruption cost → batching; P11 working memory → the «го» echo; principle list
  reconstructed, UNVERIFIED verbatim). Honest absences across the whole sample: no
  «recommended» flag in any question schema, no «why this matters» field, no rubber-stamp «go»
  handling, no «stop explaining a term after N times» throttle. → new SSOT row: glossary
  learning counters = BUILD.
- SSOT rows consulted: #122 (recap = BUILD), #230 (mattpocock = REFERENCE), #253 (grilling =
  ADOPT), #255 (ADR).

## Operator premise register (verbatim-faithful, 2026-09-13)

- **P-1** «главное что оператор слишком часто не понимает о чем речь и ему приходится
  переспрашивать и просить обьяснить доступнее … проблема одна - ее мы и решаем + еще стопы
  эти сраные когда ждет го, и скидывание ответсвенности на оператора, типа ознакомься и
  проверь … я просто пишу слепо го а ии думает что я проверил» — the problem statement; one
  spec.
- **P-2** «по важности главные причины из них самая существенная жирным и первой» — D-C §4.
- **P-3** «2 механических счетчика обьеснений и употреблений и какой раньше досчитает … го три
  употребления и 5 обьяснений» — D-F counters.
- **P-4** «прошлая форма была лучше эта вызывает только вопросы … теперь ничего не понятно» —
  on the compact card; then «ок так гараздо лучше может везде так делать? тут очень понятно
  все» on the full card. Understanding beats brevity; cards are never shortened.
- **P-5** «Главное это удобство и понимаемость чтобы изи кайф было без напряга все понимать» —
  the acceptance criterion for every surface in this spec.
- **P-6** «тут нужно чтобы скрипт работал с любого места … запустил команду уже провереную и
  протестированную с любого места - во время реализации это нужно будет проверить» — D-E and
  its implementation check.
- **P-7** «скил /story доработать чтобы он рассказывал действительно полезное о том что
  сделано информативно доступно и понятно а то в основном я его уже игнорю» → «Q14 - супер
  мне очень нравится!» on this rendered example (ratified surface for D-G):

  > ## 🎬 Что изменилось за сессию
  > **Зачем всё это было.** Ты слишком часто не понимал, о чём я говорю, и подтверждал вслепую.
  > **Что теперь по-другому.** Блок в конце хода: раньше пересказывал мои действия, теперь
  > говорит, где мы, что изменилось для проекта и что нужно от тебя. Тебе: перестаёшь
  > переспрашивать «а что это значит». Развилка: раньше был вопрос в тексте и «жду го», теперь
  > карточка с примером и «если А / если Б». Тебе: понятно, на что именно отвечаешь. Словарь:
  > появился файл терминов с твоими словами рядом. Тебе: можно говорить «приземли», я пойму и
  > отвечу термином с пояснением.
  > **Что решили и кто.** Один файл словаря, не два (ты). Счётчики 3 и 5 (ты). Старый словарь
  > ролей оставить ссылкой (я, обратимо).
  > **Меньше всего уверен.** Что «термин (пояснение)» в скобках не будет раздражать после
  > десятого раза.
  > **Дальше.** Я: пишу спеку. От тебя: ничего.

- **P-8** The eleven ratified cases («остальное ок», 2026-09-13): done / waiting / hands /
  single fork in the block / fork before buttons / /arch round / «го» echo / new term inline /
  operator raw word / long report / session start. The RU renderings from the dialogue are the
  reference for the lang-pack text; the fork example ratified in full:

  > ❓ **Q2** — **Старый словарь ролей: удалять или оставить?**
  > Что решаем. У нас уже есть маленький словарь ролей внутри скилла оркестратора. Мы заводим
  > общий словарь проекта в корне репо. Вопрос: что делать со старым.
  > Если оставить как ссылку на новый — все шесть файлов, которые на него ссылаются, продолжат
  > работать. Если удалить — придётся править эти шесть файлов, зато не будет двух словарей.
  > ➡️ Рекомендую оставить ссылкой, потому что **удаление ломает шесть живых ссылок, а выигрыш
  > только в чистоте**. Ещё: удалить можно позже одной правкой. Удаление необратимо, ссылка
  > обратима.
  > От тебя: ок, или «не ок, потому что …».

## Changelog

- 2026-09-13 — draft after the design session (Q1-Q14 closed, two research reports, two
  transcript measurements). Recorded, not resolved: (i) operator recollection of «a skill
  recently implemented in GLM» for running tested scripts from any place — searched repo
  skills, global skills and commands, all plugin caches, aif-handoff skills, all git branches
  since 2026-09-05, repo text, merged/open PRs: NOT FOUND; aif queue unreachable from the Mac;
  ask the operator at implementation (D-E is skill-agnostic); (ii) Stop hook fires twice
  (project hook + plugin twin `run-hook.cmd`) — out of scope, surfaced; (iii) worktree
  pre-commit blocks merge-forward on inherited lint debt — surfaced; (iv) UNVERIFIED: the
  «term (explanation)» form is countable; `/wait-what` answers in Russian; classifier block on
  `gh pr merge --squash` reproduces; subagent + worktree write bug #39886 on current CC.
