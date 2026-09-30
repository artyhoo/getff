# one-button second wave — MCP-list policy (design only)

> **Type:** R-phase, design-only, single session. No code, no installer edit. Output = a design
> spec + fork cards for the operator; a build kickoff follows only after the operator decides the forks.
> **Base branch:** `staging`. **Branch:** `docs/one-button-w2-mcp-list-policy-design`.
> **PR title:** `docs(spec): MCP-list policy for the one-button install — what is added, how to decline, what is worth its context`.
> **Channel:** one interactive host session, top model tier (Fable), run as an `/arch` design round
> — the operator is in the loop for the forks. Not an aif task: the deliverable needs the operator's answers.
> **Rigor label (L0):** `research-grade` — a design whose facts (context cost, disable keys) decide what
> every future install writes into a person's sessions.
> **Authoritative for:** this design round's contract — the questions it must answer, the facts it must
> re-verify first, the operator decisions it must respect, its acceptance.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the operator's decisions (coordination store `_advisor-one-button-operator-log.md`, cited by entry number).

## §0 Dispatch gate

Second-wave work: operator log entry 44 = «да го А» on the card «MCP-list policy timing» (A = after the
landing). Dispatch only when the one-button union is on `staging`:

```bash
git fetch origin staging
git cat-file -e origin/staging:packages/core/install/mcp-source-check.ts \
  && git cat-file -e origin/staging:setup.d/35-stack-tools.sh \
  && echo "union landed — dispatchable"
```

Then `SLUG=one-button-w2-mcp-list-policy bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
(`.claude/skills/dispatcher/SKILL.md` §2.0).

**Measurement SHA:** `808e806c606` (head of `join/one-button-union`, round 6). Re-locate by content after
the landing.

## §1 The operator's doubts — verbatim (entry 44)

> «да го А тут еще есть сомнения ажно про мсп наверно нужно предупреждать как минимум что будет
> поставлено? или чтобы при установке можно было отказаться от них как думаешь ? Возможно не все любят
> мсп себе много тянуть на проект это же и контекст лишний и тд - но это тоже про свои которые мы ставим
> нужно будет хорошо подумать как сделать оптимально все что бы было максимально полезно а не просто
> засирало контекст все что возможно когда то пригодится но прям сейчас очень много контекста засирает и
> вредит»

These are doubts and a question, not decisions. The design answers them; the operator decides.

## §2 Decisions already made — respect them (cite by entry)

- **Entry 17 / 26 point 7** — two circles of trust: getff's fixed list installs at once; a tool found for
  the stack installs only after a deterministic source check; the rest is «proposed, not installed».
- **Entry 18** — «deepwiki в проект если нет глобально»: deepwiki goes into the project's `.mcp.json`
  only when it is not configured machine-wide.
- **Entry 28 fork 2 = B** — no version pins; installed versions recorded. The advisor's note under
  entry 42: that fork was decided for lockfile-governed dependencies; an `npx -y <pkg>` line has no
  lockfile — raised as a concern, NOT decided. This design owns that question (Q4).
- **Entry 39** — pre-launch part (c) «tools for my dependencies» defaults to YES.
- **Entry 42 (RELAYED by P3, not typed to the advisor)** — «установка MCP это не пароль и не деньги —
  автоматизировать проверенные источники можно, но спрашивать или предупреждать хорошо».
- **Entry 43 (P2's PARAPHRASE, no verbatim)** — getff's own dependencies are a fixed set; the vendor-MCP
  lookup skips every name in it (`getff_dep_names`). The same entry records, as paraphrase, the doubts
  that entry 44 then stated verbatim.

## §3 What exists today (join head, measured)

- getff's own servers: `setup.d/05-mcp.sh:18-19` — «context7 as an http remote, deepwiki as an http remote
  only when it is not configured machine-wide»; writer `add_getff_mcp_servers` (`setup.d/lib.sh:3737-3744`).
  No way to decline one of them.
- The road names them before the one question: `INSTALL-FOR-AI.md:62` — «name getff's own MCP servers the
  chosen command adds … and say that each one costs context in every session».
- Vendor servers (circle 2): `setup.d/35-stack-tools.sh:16` — all or nothing on `GETFF_STACK_TOOLS=1`;
  logic in `packages/core/install/mcp-source-check.ts`. A two-signal npm server is written as
  `{type:'stdio', command:'npx', args:['-y', pkg]}` (`:443`), with the report line
  «⚠ .mcp.json: <key> runs on your machine — npx -y <pkg>, not pinned: npm served <version>; to remove it:
  …» (`:449`) and a `tool-decisions.md` row (`:447`).
- P6 run 4 never exercised the vendor write path (the ⚠ line + the remove command): «only reachable once
  N9 is fixed and the registry answers» (handoff, P6 row).

## §4 Facts to RE-VERIFY before any design (P3's are second-hand)

The handoff lists these as unverified assumptions: «P3's docs facts for the MCP design are SECOND-HAND
(steady cost ≤2 KB; `/doctor` lists unused servers; a settings key disables a project server — key name
unresolved)». Before writing a single design line, verify each from Claude Code's OWN documentation and
quote the line with its URL or context7 source:

1. **Steady context cost** of a configured MCP server per session — are tool definitions loaded up front
   or searched on demand (deferred loading), from which version, and what a server costs when its tools
   are never used.
2. **Whether `/doctor`** (or another built-in) reports unused or costly MCP servers.
3. **The settings key(s)** that enable/disable servers from a project `.mcp.json` per person, where the
   key lives (`settings.json` vs `settings.local.json`), and its exact name.
4. **Project-scope server approval**: what the person is asked at session start for a project
   `.mcp.json` server, and whether that prompt is itself the decline channel.

Method: context7 (`/anthropics/claude-code` or the docs library it resolves), ≥3 phrasings per fact; the
`claude-code-guide` agent as a second source; when two sources disagree, say so and measure (a headless
`claude -p` session with and without one server, character count of the loaded tool list). A fact with no
quoted source is written `INCONCLUSIVE — not in the docs`, never filled from memory (T12).

## §5 Questions the design must answer

- **Q1 Tell.** What the person is told, where, and when — before the install (the one question, step 3
  of the road) and after (the report) — for getff's own servers AND vendor servers.
- **Q2 Decline per server**, including getff's own (context7, deepwiki). Through what channel (a part of
  the one question, an env variable per server, the Claude Code disable key from §4.3), and how a decline
  survives `--refresh` (today `add_getff_mcp_servers` is an additive merge — does a refresh re-add a
  server the person removed?).
- **Q3 Useful now.** A criterion for «maximally useful now» versus «might help one day»: which servers
  earn their steady cost on which projects; whether getff's own two pass it on every project.
- **Q4 Unpinned `npx -y`.** Whether a stdio server fetched at its latest publish on every session start
  is acceptable under entry 28 fork 2, and what the alternatives cost (a pinned version recorded; an http
  remote only; no stdio servers without an explicit yes).
- **Q5 Undo.** One command that removes every server getff added, reported in the final report.

## §6 Deliverables

1. A spec `docs/superpowers/specs/<date>-mcp-list-policy-design.md` with: the §4 facts and their quoted
   sources; one section per Q1-Q5 with a recommendation, the evidence (`file:line` or quote) and a
   falsifier («wrong if …»); a decision register.
2. Fork cards for the operator — one per genuine fork, each with options, consequences, the
   recommendation and what would change it. A fork is decided only by the operator's explicit choice
   (the «skipped card = recommendation» rule was removed on 2026-09-29).
3. After the operator's answers: the list of build items with their owning files (no build kickoff in
   this PR unless the operator asks for one).

<!-- host-verify: none — design-only kickoff: the deliverable is a spec and operator fork cards, there is no executable artefact to re-run on the host -->

## §7 Acceptance

- Every §4 fact has a quoted source line or is marked INCONCLUSIVE; none is carried from P3's report alone.
- Each of Q1-Q5 has a recommendation with `file:line` evidence and a falsifier.
- The spec cites entries 17, 18, 28, 39, 42, 43, 44 by number and marks 42 as RELAYED and 43 as PARAPHRASE.
- No file outside `docs/superpowers/specs/` changes in the PR.

## §8 Out of scope

- Any edit to `setup.d/05-mcp.sh`, `setup.d/35-stack-tools.sh`, `mcp-source-check.ts`, `INSTALL-FOR-AI.md`.
- The pre-launch question's other parts (a)/(b)/(d) and the `AIF_GUIDED_INSTALL` part (parked:
  `one-button-w2-open-forks/parking.md`).
- Skills (never installed by circle 2, `35-stack-tools.sh:10`).

## §9 AI traps — [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)

Active traps for this R-phase: **T3** (every fact: quote + source) · **T8** (batch the forks into cards,
ask once) · **T11** (SSOT consult + context7 ≥3 phrasings + WebSearch before proposing) · **T12** (MCP
loading changed across Claude Code versions; training memory is stale — verify at the moment of
proposing) · **T13** (P3's facts are context7-only and second-hand — re-verify, do not inherit) · **T20**
(each recommendation backed by an evidence tool call in the same turn) · **T5** (no source edit in this phase).

**T-OBW2M-A (domain):** «the server costs little» measured on a session that never lists tools is not a
measurement of a session that does. Measure the cost where the tool list is actually loaded, and state
the Claude Code version the number belongs to.

## §10 Not verified (at authoring time)

- All four §4 facts (by construction — that is the first task).
- How `--refresh` treats a server the person deleted from `.mcp.json` (read `add_getff_mcp_servers` and
  its tests; not read for this kickoff).
- The vendor write path end to end (P6 never reached it).
