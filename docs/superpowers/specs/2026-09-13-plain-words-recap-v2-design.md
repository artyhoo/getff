# Plain-words recap v2 — one block, fork cards, glossary, fewer stops — design

> **Status:** DRAFT — round-1 revisions applied 2026-09-13 (two cold `/arch` §2 reviews, both
> REVISE; dispositions in Changelog); awaiting the round-2 cold pass and the operator gate.
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
| Transcripts scanned / sessions containing a block | 361 / 240 | `measure-recap-len.py` (re-run 2026-09-13 by the cold seats; the source handoff's «238» was sessions WITH a block, not sessions scanned) |
| Operator re-explain asks | 100 | source handoff |
| Turns ending in «жду го»-class waits vs real harness blocks | 636 vs 101 | source handoff |
| `## 🟢 Простыми словами` blocks emitted | 1607 | `measure-recap-len.py` (2026-09-13 re-run; 1571 at authoring) |
| Block non-empty lines p50 / p90 / max | 7 / 10 / 41 | same; blocks >15 lines: 36 (2.2 %), >25: 5 |
| Whole-message lines p50 / p90 / max | 11 / 25 / 80 | same |
| Blocks containing a question | 6 % | same |
| `## 🎬` story emissions | 166 | `grep -l` over transcripts |

The 100 / 636 / 101 rows are recorded in the source handoff only; their scripts (`analyze2.py`,
`perm2.py`) lived in a session scratchpad and are NOT re-derivable today — slice 0 vendors the
measurement scripts into the repo so every row above can be re-run (cold reviews F13/F14).

Reading: the block is already short; the pain is its content (action retelling: the RU pack's
branch-A text opens «в первую очередь для себя» and lists «чем я занят / что я только что
сделал», [ru.sh](../../../.claude/hooks/lang/ru.sh)) and forks living in the long text ABOVE
the block. Waits come from text, not from permissions: bypassing permissions (D4) was rejected.

**Verified facts (2026-09-13, re-anchored after round 1: this branch at `b75b697b11c` =
origin/staging `4fa5dc14d6d` merged forward; every line number below is at THAT commit and
carries its grep literal, so a reader on a later tree re-finds it by the literal — the draft's
«origin/staging `94a3a9efcd5`» was a stale local branch 66 commits behind, cold review F1):**

- Stop hook [end-of-turn-reminder.sh](../../../.claude/hooks/end-of-turn-reminder.sh):
  `stop_hook_active` guard `:71-72` (a second block is impossible → retry budget is one);
  SDK-entrypoint guard `sdk-*)` `:90` (`AIF_EOT_SDK_RECAP`, bought by the 503/503 aif
  review-sidecar incident); handoff-currency gate `AIF_HANDOFF_GATE:-0` `:424` (dormant D18,
  awk heading check + cap + sha256, D21 precedence «one reason per stop»); anchor extraction
  `"type":"ai-title"` `:528-533`, first user message `grep -m1 -F '"type":"user"' … cut -c1-120`
  `:536`, fallback `:542` (defect INFERRED from that code path — a bare filename or a
  `<system-reminder>` payload as first message becomes the goal; no transcript instance is cited,
  slice 1 reproduces it in a fixture); already-recapped guard `grep -qF -- "$AIF_RECAP_MARKER"`
  `:625-632` ending in `_autonomy_exit` — the ONLY path a marker-bearing turn reaches (the D-A
  gate site); story-told guard `grep -qF -- "$AIF_STORY_MARKER"` `:635-637` (exact-literal
  match on the WHOLE marker, not the `## 🎬` prefix); `long_text` / `recap_threshold=500`
  `:772-775`; `asked=false` detection (trailing `?` or `AIF_EOT_QUESTION_PATTERN`) `:784-794`;
  silent «Neither» branch `:886-890`; branches A/B/C/story selected `:892-904`.
- Delivery: [setup.d/10-skills.sh](../../../setup.d/10-skills.sh) `:237-260` copies the hook +
  `lang/{en,ru}.sh` + `check-parity.sh` and registers the Stop hook; `:274-282` the same for
  `ask-question-reminder.sh`; the hook header `:4-6` says «delivered by install.sh + do_refresh»
  (existing installs receive it on `--refresh`). [install.sh](../../../install.sh) `:9` `--full`
  = non-interactive consumer path (dev-deps, no prompts; `setup -y` wraps it), `:13` `--all` =
  `--full` + AIF suite; profiles `core|env|factory` `:15-17`. Default pack when `AIF_HOOK_LANG`
  is unset is `en` (`:28` `${AIF_HOOK_LANG:-en}`).
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
  hook `check-worker-dispatch-channel.sh`; 34 repo files reference the name (`grep -rl`,
  excluding `.git` and this spec; measured by the cold seats — the draft said 33).
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

**Gate matrix** (deterministic, in the Stop hook; one auto-retry naming what is missing, like
the handoff-currency gate): sections 1 and 5 always; 3 when the turn ended in a question
(`asked`); 2 when `long_text`.

**Gate site (cold review F2):** INSIDE the already-recapped branch (`:625-632`), before its
`_autonomy_exit` — that branch is the only code path a marker-bearing turn reaches, so a check
placed after it never fires on the population it exists for. The `stop_hook_active` guard
(`:71-72`) sits above it, so the retry budget is exactly one, by construction.

**Exemption set (cold review F2)** — «every turn ends with the block» holds everywhere EXCEPT:
the SDK entrypoint (`sdk-*` guard `:90`; aif review sidecars have no reader for a recap and
the block broke their `## Blocking Findings` parse 503/503 times); a `stop_hook_active` stop;
the silent «Neither» turn (`:886-890`). The gate demands a block only where a branch payload
already fires — it never widens the hook's population.

**Kill switch + precedence (cold review F7; operator decision Q1, P-9):** the gate is armed by
`AIF_RECAP_GATE=1` and ships DORMANT (D18 shape of the handoff-currency gate `:424`); unarmed,
the hook's output is byte-identical to today's (goldens prove it, same fixture class). Arming:
`scripts/register-recap-gate.sh` in the D-E shape (`--user` default / `--project`, like
`register-handoff-gate.sh`); `install.sh --full` (and `--all`, which implies it) arms it in the
consumer's project settings in the consumer's `AIF_HOOK_LANG`; interactive / default installs
deliver hook + packs unarmed. When two reason producers fire on one stop, the recap gate's
reason REPLACES the branch payload and YIELDS to the handoff-currency gate's reason — one reason
per stop, D21 «never both» ([handoff-currency-gate](2026-09-08-handoff-currency-gate-design.md)).

**Cap:** the retelling part (sections 1, 2, 4, 5) is capped at `AIF_EOT_RECAP_MAX_LINES`
(default 15, D3 of the source handoff; measured: binds on 36 of 1607 blocks = 2.2 %, so it is a
regression guard, not the fix — cold review F11); **fork cards are never capped** (operator
premise P-4).

**Block vs round (cold review F3):** on an /arch round turn (D-D) the BODY owns the cards;
section 3 of the block is then ONE pointer line «развилки: Q1-Qn выше», never the cards again.
Same rule for slice 2: when the card was emitted before `AskUserQuestion` buttons, the block
carries the pointer, not a second card.

Branch selection stays (`:892-904`); the branches now differ only in which sections the gate
demands. Self-checks («did I offload a decision?», «did I decide a fork silently?», «would a
seventh-grader follow this?» — D11) stay as hook INSTRUCTION lines, not as output sections. The
block stays at the END of the reply (D1).

### D-B The «от тебя» grammar

The last line takes exactly one of four values; the gate rejects anything else. Both languages
are pack literals (`aif_msg_eot_for_you_*` in `lang/{en,ru}.sh`, parity-checked); the gate reads
the ACTIVE pack's literals, never hard-coded Russian — the default pack is `en` (cold review F9):

| Value (RU / EN) | Meaning | Who verified |
|---|---|---|
| «ничего (<след>)» / «nothing (<trace>)» | done AND verified by the agent. The parenthesis is REQUIRED and holds a verification trace: a command name, a count like `12/12`, a CI / PR link, or a quoted probe line. The gate matches the FORM only (a parenthesis containing a token of one of those shapes); it cannot verify substance — but a false trace is an explicit lie a reviewer sees in one glance, where a bare «ничего» was invisible (operator decision 2026-09-13 Q3; cold review F5: without this the line was `#hope-as-gate`) | the agent — the claim is its own, now with a named referent |
| «ждём: X» / «waiting: X» | something runs; the agent reports back | n/a |
| «решить: A или B» / «decide: A or B» | a genuine fork = operator floor ([autonomous-night-v3 §6](2026-08-09-autonomous-night-v3-design.md): taste / goal; objects outside authorized scope — standing config, maintainer artifacts, new PRs and scope widening, spend, security, the goal; deletions of non-generated artifacts; externally visible actions). Everything recorded goes to the advisor seat, not the operator | the fork card carries the evidence |
| «сделать руками: X» / «by hand: X» | harness-forbidden for the agent (settings.json, force-push, remote branch delete, merge to main, secrets / logins; chip clicks); look-and-poke ONLY when no automated probe exists, stated as a concrete action | n/a |

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
exists (operator recollection 2026-09-13, not found — see Changelog; register row R-8), the line
names the skill instead of the script; the rule is skill-agnostic. **Implementation check owed:**
every shipped hand-action script is run from `/tmp` and from a second checkout — exit 0 and its
own «OK». This spec ships two such scripts: `scripts/register-recap-gate.sh` (D-A, slice 1) and
`scripts/register-glossary-hook.sh` (D-F, slice 3 — a `UserPromptSubmit` hook needs a
`.claude/settings.json` entry the agent may not write; without the script the glossary ships
permanently dormant with green tests, the `WorktreeCreate` shape from CLAUDE.md — cold review
F10). Both join `register-root-resolution.test.sh`.

### D-F The glossary — one file, two mechanical counters

- **File:** `CONTEXT.md` at the repo root, English, mattpocock `domain-modeling` format
  (`**Term**:` / 1-2 sentences / `_Avoid_:`) — **ADAPT, not ADOPT** (cold review F4): upstream's
  `_Avoid_` means «words to stop using» and its «challenge the user against the glossary» rule
  would correct the operator AWAY from «приземлить» — the inverse of D9. So (a) operator raw words
  live in an ADDED field `_Operator says_:` (never in `_Avoid_`, which keeps upstream meaning);
  (b) upstream's challenge rule is explicitly NOT adopted — the agent answers with the term plus
  its inline explanation, never corrects the operator's word; (c) upstream's «project-domain terms
  only» inclusion rule is relaxed for the seed (вендорить, «красное», глубина are process terms
  the operator re-asked about). «A glossary and nothing else» stays. **Already-owned surface
  (cold review F5):** a root `CONTEXT.md` is governed by [harmonization spec D-H11 §5.2](2026-08-18-skill-stack-harmonization-design.md)
  (a term with an owner doc gets a one-line gist + link, never a redefinition) and by the shipped
  [principle 42](../../../packages/core/principles/42-context-md-pointer-rule.test.ts), dormant
  while the file is absent and ACTIVE on the commit that creates it (every link must resolve to an
  existing anchor). Therefore the orchestrator role glossary
  (`.claude/skills/orchestrator/references/glossary.md`, an owner doc with its own authority
  header, 8 install baselines + the getff manifest fingerprint it) is NOT absorbed: `CONTEXT.md`
  points at it (the draft's absorb-with-pointer-behind inverted D-H11 — reversed here). Authority
  header: `CONTEXT.md` carries the standard `Authoritative for / NOT authoritative for` header as
  its first lines (doc-authority-hierarchy §2 lists root docs by name; the new root doc joins that
  list in the same commit — cold review F14); upstream's «nothing else» is read as «no prose
  sections», a header is not a section.
- **The association «что что обозначает», both directions (Q9):** the `_Operator says_` line
  holds the operator's raw words for the same thing in the operator's language — match data,
  the same category as the Russian question pattern inside `lang/ru.sh`
  ([language-discipline.md](../../../.claude/rules/language-discipline.md) category 3; principle
  22 does not scan the repo root, verified by the cold seat — no mechanical collision). Operator →
  agent: the `UserPromptSubmit` hook (registered by `scripts/register-glossary-hook.sh`, D-E)
  scans the prompt for terms and `_Operator says_` words and injects one line
  «"<raw word>" = <term>: <definition>». Agent → operator: while a term is below threshold the
  Stop hook demands the inline form «term (one-line explanation in the operator's language)».
  Fallback if a Russian `_Operator says_` line in an English file is judged a language-discipline
  breach: one file per `AIF_HOOK_LANG`, mechanics unchanged.
- **Counters (Q4/Q10):** `_glossary-counts.json` in the residue dir
  ([residue-dir.sh](../../../.claude/hooks/lib/residue-dir.sh): shared across worktrees and
  sessions, outside git). Two mechanical counters per term: **usages** — the `UserPromptSubmit`
  hook counts the term itself (plus its transliteration) in the operator's prompt; synonym use is
  NOT a usage; **explanations** — the Stop hook counts the fixed «term (explanation)» form, once
  per message. Learned = usages ≥ `AIF_GLOSSARY_USES` (3) OR explanations ≥
  `AIF_GLOSSARY_EXPLAINS` (5), whichever first; both are config **in the lang packs, and
  `check-parity.sh` gains an `^AIF_GLOSSARY_[A-Z_]+=` probe in the same commit** — today its
  `keys()` collects only `aif_msg_*`, the two markers and `AIF_EOT_*` (`:26-33`), so a key added
  to one pack would pass parity and abort the other pack's hook under `set -u` on every turn
  (cold review F8). Below threshold the Stop hook demands the inline explanation once; above it
  nothing fires. Agent-maintained marks were
  rejected as `#hope-as-gate` ([attention-is-not-a-mechanism.md](../../../.claude/rules/attention-is-not-a-mechanism.md)).
- **Seed** from the measured re-ask list: приземлить, энв-тир, вендорить, чипы, глубина,
  «красное», harvest, egress, handoff. Jargon the operator likes (harvest, egress, handoff)
  stays — it is taught, not replaced (D9).
- **`/wait-what`:** ADOPT as is (reads `CONTEXT.md`); live-check that it answers in Russian
  under `AIF_HOOK_LANG=ru` — its whole body is ONE sentence carrying both the ASD-STE100 clause
  and the `CONTEXT.md` clause, so the fallback `.override.md` must restate both (language per
  `AIF_HOOK_LANG`, still read `CONTEXT.md`), not drop one (cold seat drill-down). The skill is
  operator-invoked only (`disable-model-invocation: true`) — it serves the operator → agent
  direction; the agent → operator direction is the Stop-hook inline form above.

### D-G /story rework (Q14)

`/story` keeps its trigger (PR pushed / operator asks) and its `## 🎬` marker — the marker
LITERAL changes to the operator-ratified P-7 heading (RU `## 🎬 Что изменилось за сессию`, EN
`## 🎬 What changed this session`) in `AIF_STORY_MARKER` of both packs, because the story-told
guard (`:635-637`) is an exact-literal match and would miss the P-7 wording, re-injecting the
story on the next stop (cold review F4). [emit-story-prompt.test.ts](../../../packages/core/skills/emit-story-prompt.test.ts)
`:20-26` asserts the old literal and «по актам / by acts» — it is updated in the same commit,
intentionally (cold review F3). The body becomes the session-scale version of D-A instead of a
chronicle by acts: **why all this was**
(one sentence) → **what is different now** — per change: before, after, what it gives the
operator (no chronology) → **what was decided and by whom** (one line each) → **least sure**
→ **next** in the D-B grammar. The text comes from ONE lang-pack function shared with the
recap (a scope parameter: turn vs session), so the two forms cannot drift. Ratified example
(RU) in the operator premise register, P-7.

### D-H Autonomy edits — removing text-born stops

- **D5a** allow-list `gh pr merge --squash` to `staging` explicitly (after a live reproduction
  of the classifier block; the global allow already has `Bash(gh pr *)`).
- **D5b** Ownership Contract ([CLAUDE.md](../../../CLAUDE.md)) — **with exclusions (operator
  decision 2026-09-13 Q2; cold review F1 BLOCKER):** edits to OPERATIONAL maintainer-owned rows
  (EXECUTION-PLAN, `.husky/pre-push`, `.claude/rules/*`, session-bootstrap, shipped agents /
  skill-context, principles) THROUGH a PR to staging do not need a «го» — the gate is PR + CI.
  The goal-bearing row (`README.md §Why this exists`) and the frozen rows (PROPOSAL.md, retros,
  research-patches, closed kickoffs / done.md) KEEP the «го»: agents merge their own staging PRs
  and no CI check detects goal drift, so without the exclusion an agent could rewrite the goal and
  merge it alone — the 2026-05-09 incident the authority hierarchy exists for. The table gains a
  fourth column `«го» via PR? yes / no`.
- **D5c** [aif-doctor/SKILL.md](../../../.claude/skills/aif-doctor/SKILL.md) has NINE
  «operator GO» sites (`:41, :88, :90, :91, :94, :104, :105, :244, :256`), three decision classes
  (cold review F7). GO STAYS on: task DELETE (`:104`, destructive), paid API transport Fix C
  (`:94`, spend — night-v3 §6 floor + no-paid-llm-in-ci), cap bump (`:105`, standing config —
  D-B floor list). GO is REMOVED on the reversible in-container fixes only: image rebuild (`:88`),
  in-container install (`:90`), mirror install (`:91`); `:41` / `:256` restated to that split.
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
  `#umbrella-execution-launch-without-operator` in LIVE texts only, with one «formerly …» line.
  LIVE = what an agent reads to act today: `.claude/skills/*` (3 files), `.claude/rules/*`,
  `.claude/hooks/check-worker-dispatch-channel.sh` + its `plugin/hooks` twin (regenerates via
  pre-commit), principle 29's module + `.bin.ts` + `.test.ts` + fixtures (move together or the
  twin-identity check goes red), `docs/meta-factory/open-questions.md`. FROZEN = closed kickoffs
  / done.md (13 files), research-patches, specs, retros — untouched. 34 files in total (cold
  review F12). **Line budget:** [pipeline/SKILL.md](../../../.claude/skills/pipeline/SKILL.md) is
  at exactly 600 lines, the pre-commit ceiling, with no exemption — the rename lands there
  NET-ZERO (edit the `:389` bullet in place, «formerly» on the same line); the positive «does NOT
  forbid» list and the self-test phrase land in the rule file, never in pipeline/SKILL.md (cold
  review F6); (d) principle 29 + `check-worker-dispatch-channel.sh` narrowed to «a kickoff must
  not PRESCRIBE auto-launch of execution», with a negative test: a kickoff that hands a subagent
  reading/review PASSES. **Precondition (cold review F9):** the narrowed matcher is run over the
  existing kickoff corpus (`.claude/orchestrator-prompts/**`) BEFORE it lands, and every verdict
  that flips is listed in the PR — the original matcher dropped a clause only after an
  8-false-positive measurement (`29-worker-dispatch-channel.ts:38-49`); the narrowing gets the
  same treatment. `READONLY_CONTEXT_RE` already exempts read-only dispatch (`:60`), so the tenet's
  delta is the write-task case: a kickoff prescribing Agent-tool dispatch of a WRITE worker
  without the words «umbrella stage» must still fire, or the Stage-5 class reopens.
- **D7** chips stay; the agent cannot open a new Claude Code session itself (no `start_session`
  tool in-session — recheck). The /arch §3 and /pipeline launch card recommends a channel by two
  questions («хотите видеть и вмешиваться?», «длинная самостоятельная работа?»); the operator
  chooses. Memory `dispatch-channel-must-not-need-a-click` is corrected to this rule.

### D-I Anchor extraction fix

The Stop hook's session-goal anchor skips a first user message that is a bare filename /
path or a `<system-reminder>` payload and falls back to `ai-title`, then to «(назови сам из
контекста)» — never emits harness markup as the goal. The defect is inferred from the code path
(`:536`), not from a cited transcript; slice 1's fixture reproduces it synthetically and the PR
quotes one live instance or records that none was found.

## Live decision register

Status vocabulary per [arch/SKILL.md §1](../../../.claude/skills/arch/SKILL.md): `answered`
(settled, by whom in Resolution) / `operator-fork` (open, waits for the operator) — the draft's
`DECIDED` hid the second value, which is how five open items ended up outside the table (cold
review F8).

| # | Decision | Status | Resolution | Falsifier |
|---|---|---|---|---|
| Q1 | One spec, not three | answered | operator: autonomy is small and the same root problem | a cold seat shows the autonomy slice needs its own review cycle |
| Q2 | Reasons: most essential bold + first, ≤3 more, reversible line | answered | D-C §4 | operator asks «why?» after a card ≥3 times in a week |
| Q3/Q9 | One `CONTEXT.md`, `_Avoid_` = association | answered | D-F | a raw-word prompt is not mapped by the hook, or language-discipline rejects RU in the file → per-language file fallback |
| Q4/Q10 | Two mechanical counters, 3 uses / 5 explanations | answered | D-F | the inline «term (explanation)» form is not countable or reads artificial (UNVERIFIED) |
| Q5 | Rename antipattern in live texts only | answered | D-H (c) | a live misreading of the ban after the rename |
| Q6/Q7 | One block form, omit-empty, gate matrix | answered | D-A | gate rejects a legitimate bare-question turn |
| Q8 | «от тебя» four values, banned words, «го» = decision only | answered | D-B | operator has to verify something the line called «ничего» |
| Q11 | ADOPT `/wait-what` as is | answered | D-F | it answers in English under `AIF_HOOK_LANG=ru` → override line |
| Q12 | /arch round form | answered | D-D (compact variant rejected live) | operator answers fewer than the must-answer set twice → cap 3 |
| Q13 | Caps on retelling only, never on cards | answered | D-A / D-C | a block over cap that the operator still finds unclear |
| Q14 | /story = session-scale block | answered | D-G | operator keeps skipping `## 🎬` after the rework |
| D-E | Hands = script from any cwd or concrete UI action | answered | D-E | a shipped script fails from `/tmp` or a second checkout |
| D-I | Anchor fix | answered | D-I | a block still shows harness markup as the goal |
| D5a | Allow-list squash-merge to staging | answered (verification owed) | D-H | the block does not reproduce live → no allow entry needed |
| D6/D7 | Subagent tenets + launch card | answered | D-H | an agent still refuses read-only subagents citing the rule |
| R-1 | Consumer axis: gate dormant behind `AIF_RECAP_GATE`; `--full` install arms it per `AIF_HOOK_LANG` | answered | operator 2026-09-13 (P-9), round 1 | wrong if the operator meant profile=factory rather than `--full` — arming then moves to the profile gate (`setup.d/10-skills.sh:157`); or a `--full` consumer reports the gate blocking an EN turn |
| R-2 | D5b with exclusions (goal + frozen rows keep «го») | answered | operator 2026-09-13 (Q2), round 1 | an agent-authored PR edits `README §Why this exists` and merges without a «го» |
| R-3 | «ничего» requires a trace in parentheses | answered | operator 2026-09-13 (Q3), round 1 | the operator finds a «ничего (…)» whose trace names a check that was not run, twice |
| R-4 | `_Avoid_` keeps upstream meaning; operator words in `_Operator says_`; challenge rule NOT adopted (ADAPT) | answered | author, round 1, reversible | the agent corrects the operator's word instead of answering with the term |
| R-5 | Story marker literal = P-7 heading; `emit-story-prompt.test.ts` updated | answered | author, round 1 | the story branch re-injects after a `## 🎬` story was told |
| R-6 | D5c: GO stays on DELETE / paid transport / cap bump; removed on reversible in-container fixes | answered | author, round 1, per night-v3 §6 floors | a session switches aif to a paid transport without asking |
| R-7 | Principle 29 narrowing only after a corpus run listing flipped verdicts | answered | author, round 1 | a write-worker kickoff without «umbrella stage» passes the narrowed gate |
| R-8 | «A GLM skill that runs tested scripts from any place» (operator recollection) | operator-fork | searched 7 surfaces, NOT FOUND (Changelog i); D-E is skill-agnostic either way | the operator names it → D-E line cites the skill |
| R-9 | «term (explanation)» form is countable and not irritating | operator-fork (verification owed at slice 3) | UNVERIFIED | the counter misses the form in a live session, or the operator objects after the 10th repetition |
| R-10 | `/wait-what` answers in Russian under `AIF_HOOK_LANG=ru` | answered (verification owed at slice 3) | ADOPT + override restating both clauses if not | it answers in English → override line |
| R-11 | Classifier block on `gh pr merge --squash` reproduces | answered (verification owed at slice 5) | D5a lands only after a live reproduction; if it does not reproduce, D5a is DISSOLVED, no allow entry | — |
| R-12 | CC subagent + worktree write bug #39886 on current CC | operator-fork (external) | unknown; D6 (2) «writes in own worktree» is conditional on it | the bug reproduces → D6 (2) narrows to read-only until fixed |
| R-13 | Block on a round turn: body owns the cards, block carries a pointer | answered | author, round 1 (cold review F3) | the operator sees the same card twice in one message |

Every row carries a Status. Rows marked `operator-fork` (R-8, R-9, R-12) are OPEN and named —
the frontier is not empty; they are asked once, batched, at the slice that needs them (T8).

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
  negative (kickoff hands a subagent a review → passes); plus the corpus run over
  `.claude/orchestrator-prompts/**` recorded in the PR (D-H (d) precondition).
- [register-root-resolution.test.sh](../../../scripts/register-root-resolution.test.sh):
  `register-recap-gate.sh` and `register-glossary-hook.sh` join its matrix (D-E).
- [emit-story-prompt.test.ts](../../../packages/core/skills/emit-story-prompt.test.ts): marker
  literal and section assertions updated to D-G (the «по актам / by acts» assertion is inverted
  on purpose).
- [42-context-md-pointer-rule.test.ts](../../../packages/core/principles/42-context-md-pointer-rule.test.ts):
  goes ACTIVE on the commit that creates `CONTEXT.md` — every seeded link must resolve.
- Goldens in `end-of-turn-reminder.test.ts`: unarmed (`AIF_RECAP_GATE` unset) output is
  byte-identical to the pre-change hook; armed output differs only by the gate reason.
- Slice 0 measurement scripts: a smoke test that each script runs against a fixture transcript
  and prints the table's row names.

## Consequences

- Waits drop only where the text was the cause. The 636 (of 737 measured) is the population of
  wait-phrase turns NOT caused by a harness block — an UPPER bound, not the expected drop:
  genuine forks inside it stay as «решить: A или B» by design (cold seat drill-down 2). Harness
  blocks (101) stay and become «сделать руками» lines with a ready script.
- Two packs and two hooks share one card function — a change in the card is one edit.
- Longer replies when a real fork exists (a full card is ~10 lines); accepted by P-4.
- The counters file is machine-local and shared across sessions — a fresh machine starts with
  every term unlearned (by design: the operator is the one who learns, not the repo).
- Renaming the antipattern leaves the frozen references (kickoffs, done.md, research-patches,
  specs — most of the 34 files) on the old name; the «formerly» line and the frozen-artifact rule
  make that intentional.
- Unarmed, nothing changes for anyone: the gate, the glossary hook and the «от тебя» grammar all
  ship dormant and are armed by a one-line script or by `--full` install (R-1).

## Delivery slices (PRs to staging, in order)

0. Measurement scripts vendored under `scripts/measure/` (`measure-recap-len.py` + the wait /
   re-explain / harness-block greps re-derived from the source handoff) so every table row above
   is re-runnable; the table is re-run from the vendored copies in the same PR.
1. Lang packs + Stop hook: D-A gate matrix at the `:625-632` site, exemption set, `AIF_RECAP_GATE`
   + `scripts/register-recap-gate.sh` + `--full` install arming, D-B grammar in BOTH packs with
   the «ничего (trace)» form, D-C card function, D-I anchor fix + fixture, D-E line check, goldens
   for the unarmed path, tests. New SSOT row «decision-request format = BUILD» in this commit.
2. `ask-question-reminder.sh`: card before buttons (shares slice 1's function); block carries a
   pointer on that turn (R-13).
3. Glossary: `CONTEXT.md` seed with authority header + pointer to the orchestrator glossary,
   `_Operator says_` field, `UserPromptSubmit` hook + `scripts/register-glossary-hook.sh`,
   counters, `check-parity.sh` `AIF_GLOSSARY_` probe, `/wait-what` live check + two-clause
   override if needed, principle 42 goes active. New SSOT row «glossary learning counters =
   BUILD» in this commit. Asks R-8 / R-9 once, batched, before landing.
4. /arch §1 round form (D-D) + /story rework (D-G): marker literal, `emit-story-prompt.sh`,
   `emit-story-prompt.test.ts`.
5. Autonomy: D5a (after live reproduction, else DISSOLVED — R-11), D5b with exclusions + table
   column, D5c nine-site split, D6 rule text (positive list + self-test in the rule file) +
   net-zero rename in pipeline/SKILL.md + principle 29 corpus run THEN narrowing + negative
   fixture, D7 launch card, memory fix. Asks R-12 before D6 (2) lands.

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
  ADOPT), #255 (ADR; D-H11 keeps `CONTEXT.md` for terms). `domain-modeling` format: **ADAPT**
  (own field `_Operator says_`, challenge rule not taken — R-4); `wait-what`: ADOPT. The two new
  BUILD rows are written in the slice-1 and slice-3 commits respectively (CLAUDE.md: SSOT entry
  in the same commit as the capability artifact).

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

- **P-9** (round 1, 2026-09-13, Q1 of the cold-review forks) «поставляется по флагу и при
  фул установки консьюмеры на разных языках» — the gate ships behind a flag; a full install
  gives consumers the surface in their own language. Read as: dormant `AIF_RECAP_GATE`,
  `install.sh --full` arms it, packs per `AIF_HOOK_LANG` (R-1 carries the falsifier for this
  reading). Q2 «с исключениями» → R-2; Q3 «требовать след» → R-3.
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

- 2026-09-13 — **round 1** after two cold `/arch` §2 reviews (top-down TD, bottom-up BU; both
  REVISE; reports `top-down-plain-words-recap-v2.md` / `bottom-up-plain-words-recap-v2.md` in the
  review session's scratchpad). Dispositions (one per finding):
  TD-F1 BLOCKER D5b carve-out — **FIXED** (D5b, R-2, operator Q2);
  TD-F2 exemption set / SDK guard — **FIXED** (D-A);
  TD-F3 card twice on round turns — **FIXED** (D-A block-vs-round, R-13);
  TD-F4 `_Avoid_` inverted — **FIXED** (D-F ADAPT, R-4);
  TD-F5 «ничего» form-only — **FIXED** (D-B trace, R-3, operator Q3);
  TD-F6 shipped axis absent — **FIXED** (D-A kill switch + `--full` arming, R-1, P-9);
  TD-F7 no kill switch / precedence — **FIXED** (D-A);
  TD-F8 register not closed — **FIXED** (vocabulary + rows R-8…R-12);
  TD-F9 principle 29 narrowing unmeasured — **FIXED** (D-H (d) precondition, R-7);
  TD-F10 «sessions scanned» — **FIXED** (table);
  TD-F11 cap inert — **ACCEPTED**, recorded as a regression guard (D-A);
  TD-F12 rename scope — **FIXED** (D-H (c) LIVE / FROZEN);
  TD-F13 measurement provenance — **FIXED** (slice 0);
  TD-F14 `CONTEXT.md` authority header — **FIXED** (D-F);
  TD-F15 ESCALATED consumer premise — **ESCALATED → closed by the operator** (Q1, P-9, R-1).
  BU-F1 base SHA false — **FIXED** (staging merged forward, facts re-anchored at `b75b697b11c`);
  BU-F2 gate site unreachable — **FIXED** (D-A gate site);
  BU-F3 `emit-story-prompt.test.ts` — **FIXED** (D-G, seams);
  BU-F4 story marker literal — **FIXED** (D-G, R-5);
  BU-F5 principle 42 + D-H11 — **FIXED** (D-F pointer direction reversed);
  BU-F6 pipeline/SKILL.md at 600 — **FIXED** (net-zero rename, list in the rule file);
  BU-F7 D5c nine sites — **FIXED** (R-6);
  BU-F8 parity probe — **FIXED** (D-F);
  BU-F9 RU-only values — **FIXED** (D-B both packs);
  BU-F10 glossary hook unarmed — **FIXED** (`register-glossary-hook.sh`, D-E);
  BU-F11 baselines moved by the glossary migration — **DISSOLVED** (glossary no longer moves);
  BU-F12 / TD-F10 same population label — **FIXED**;
  BU-F13 33→34, 1571→1607 — **FIXED** (table + fact);
  BU-F14 636/101 not re-derivable — **FIXED** (slice 0) + Consequences reworded (upper bound).
  Cold-seat drill-downs recorded: measure script re-run (TD-1, BU), 636/101 source read (TD-2),
  `/wait-what` + `domain-modeling` upstream bodies opened (TD-3, BU-1/2).
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
