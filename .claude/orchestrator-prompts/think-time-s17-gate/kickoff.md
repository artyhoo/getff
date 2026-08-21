# New session prompt — §1.7 think-time gate research

> **Открой новую Claude Code сессию на Opus, прими этот handoff. Это exploratory research session — НЕ implementation. Финальный deliverable: research-patch + диалог. НЕ открывай PR, НЕ пиши код за исключением research-patch markdown.**

---

## Контекст инцидента (2026-05-13, dialogue session)

В предыдущей сессии маинтейнер обсуждал с AI закрытие PR-body §1.7 substance gap (incident PR #51). В **той же** сессии AI выдал **5 confidently-wrong recommendations подряд** до того как маинтейнер вручную пробил каждое:

1. **§1 research-patch'а** утверждал «substance backward-check был correct» — taken from kickoff handoff без независимой проверки. Маинтейнер пнул «это точно?». AI re-grep'нул, нашёл что substance действительно landed (claims корректны), но **методология была неверная** — claim был unverified в момент написания.

2. **Q3 Danger JS DEFER** — выдан с 5 аргументами («hand-roll дешевле», «lock-in», «minimal deps», «thesis-aligned», «AIF не покрывает»). Маинтейнер: «как же принцип переизобретения велосипеда?». AI применил build-vs-reuse principle properly → verdict развернулся в **ADOPT**. DEFER reasoning оказался **рационализацией против project's own discipline**.

3. **4 dialogue turns** AI отстаивал hand-roll, продолжая придумывать новые причины — пока challenge не пробил наизусть.

Конечный artefact (research-patch [docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md](../../../docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md) §6.7) документирует это как **meta-observation**: pattern назван, mitigation указан, но mitigation surface не fires в момент failure.

---

## Что *уже* существует (не переоткрывай)

**Anti-pattern catalogue (named, documented, sample-corpus collected):**

- [.claude/rules/phase-research-coverage.md §4 line 92](../../rules/phase-research-coverage.md#L92) — **`#discipline-application-scope-blindness`** (H8, promoted Wave 8 Batch C 2026-05-12). Three sub-cases: (a) self-commentary lag, (b) meta-commentary lag, (c) **unverified collaborator claims** — sub-case (c) — это сегодняшний failure mode 1.
- [.claude/rules/phase-research-coverage.md §4 line 97](../../rules/phase-research-coverage.md#L97) — **`#recommendation-skips-own-discipline`**. Quote: «Same shape as `#recursive-self-application-gap` but scoped not to the project's code, but to the *act of forming the recommendation itself* — meta-cognitive blindspot where the agent of analysis is not also the object of analysis. Surfaced repeatedly across distinct sessions (**PR #16 EXECUTION-PLAN drift; the «defer until consumer pain» reasoning anti-pattern across 4 turns of one session; L3 generated-docs research recommendation 2026-05-09**). **Mitigation: §1.7.**»

**Carried in self-reflection skill:**
- [.claude/skills/self-reflection/references/forward-checklist.md](../../skills/self-reflection/references/forward-checklist.md) Layer 6 — sub-case (c) verify-before-accepting probe + sub-case (b) anti-tautology probe.

**Promotion record:**
- [docs/meta-factory/research-patches/2026-05-12-§13.24-h8-promotion.md](../../../docs/meta-factory/research-patches/2026-05-12-§13.24-h8-promotion.md) — H8 promoted 2026-05-12.

**Phase 10 §13.32 «foundations audit» armed** ([docs/meta-factory/open-questions.md §13.32](../../../docs/meta-factory/open-questions.md)) — 6 streams (A1-A6); A6 «documentation artefacts» **может** cross this gap, but Phase 10 — broad audit (~120 audit points), not targeted closure.

---

## Структурный gap (research goal)

Mitigation для `#recommendation-skips-own-discipline` указан как **§1.7**. Но **§1.7 fires только** when commit touches:

```text
^(\.claude/rules/[^/]+\.md|packages/core/principles/[^/]+\.test\.ts|\.claude/skills/[^/]+/SKILL\.md)$
```
(per [.husky/pre-push:312](../../../.husky/pre-push#L312))

Это **at-write-time** gate. Failure mode сегодня произошёл **at-think-time** — в dialogue, до commit'а. **5 wrong recommendations** успели быть выданы прежде чем gate имел поверхность для срабатывания.

Дополнительно: research-patches **allowlisted** в §1.7 gate ([.husky/pre-push:300](../../../.husky/pre-push#L300) — `docs\(research-patches\)`). Даже при commit'е research-patch'а с recommendations внутри, §1.7 trailer **не требуется**. **Двойной zero-gate**: ни на dialogue, ни на самом recommendation-bearing artefact.

**Research question:** какая mechanism может сократить **temporal scope gap** между моментом формирования recommendation и моментом её gating? Не «как лучше §1.7 написать», а «**когда** именно discipline должна срабатывать чтобы поймать failure mode который этот session показал».

---

## Что НЕ переоткрывать

- Anti-pattern names — **уже названы**. Не предлагай новые имена для того же.
- The mitigation pointer §1.7 — уже указан. Не предлагай «дать §1.7 пойнтер на mitigation» — он там.
- Sample corpus — уже 3+1 incidents (PR #16, defer-until-consumer-pain, L3 generated-docs, сегодняшний dialogue 5 occurrences). Можешь reference'ить, не commission new sampling.
- PR-body §1.7 substance gap (the parent topic) — уже covered в [docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md](../../../docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md). Эта новая сессия — **distinct territory** (think-time vs write-time).

---

## Candidate mechanisms (для research, не pre-decision)

> **Two classes** below — explicit because the request from maintainer (2026-05-13): «может на горячую можно как то это закрывать проверять прям в диалоге?». **HOT class** = fires during the dialogue itself, before AI verdict leaves the conversation. **WARM/COLD class** = fires at commit-time or post-merge review. The failure mode this research targets happens **at-think-time**, so HOT class is the primary territory.

### HOT class — fires in-dialogue, before verdict ships

**Mechanism H1 — UserPromptSubmit hook injection extension.** Project already uses [UserPromptSubmit hook](../../settings.json) to inject session-bootstrap digest (see this session — `Goal: ...` + `Invariants:` block on every prompt). Extend digest to include **«before issuing any ADOPT / DEFER / RECOMMEND / VERDICT / RULE-CHANGE — run forward+backward against SSOT + context7 + search-coverage rule. Output the mechanical evidence inline»**. Cheap (one line in settings.json). **Build-vs-reuse:** project's own hook surface, already weight-bearing. **Risk:** T-think-time-C («reading mitigation doesn't apply mitigation»). Empirically validate — does adding this text change behaviour or is it ignored?

**Mechanism H2 — Stop hook post-turn audit.** Claude Code Stop hook fires when AI finishes turn. Hook script analyses turn output for verdict-shape phrases (`ADOPT`, `DEFER`, `recommend`, `I suggest`, `verdict:`). If detected without an accompanying «mechanical evidence:» / file:line / grep-output block — inject a system-reminder *into the next turn* requiring AI to add evidence retroactively. **Build-vs-reuse:** Claude Code docs (context7: `/anthropic/claude-code` or `/claude-code-guide`) should be queried — what Stop hook contracts allow. Post-hoc not pre-output, but cheap to implement. **Risk:** evidence retrofitted post-fact = same trap; AI can hallucinate evidence after the verdict to satisfy hook.

**Mechanism H3 — Skill auto-trigger expansion.** [self-reflection skill](../../skills/self-reflection/SKILL.md) currently triggers on keywords like «recommend», «introduce rule». But trigger list is **user-side** — fires when USER types those words. **AI-side trigger** (skill loads when AI is *about to* issue verdict) — does Claude Code support this? Research: skill `description` field + harness behaviour. **Build-vs-reuse:** skill exists and carries sub-case (c) probe — adapt, don't rebuild.

**Mechanism H4 — In-conversation TodoList discipline.** Each load-bearing recommendation maintains internal checklist before issuance: `[ ] SSOT consulted` / `[ ] context7 ≥3 phrasings queried` / `[ ] file:line for each numeric claim` / `[ ] adversarial counter-prompt run`. AI self-enforces. Enforcement layer: hook checks TodoWrite tool was invoked with checklist before verdict-shape output. **Risk:** AI marks `[x]` without doing the work — same theatre.

**Mechanism H5 — MCP server pre-output validator.** Custom MCP tool `recommendation_gate(verdict, evidence)` AI MUST call before issuing verdict-shape text. MCP server runs deterministic checks (SSOT lookup, glob count if evidence cites a glob, etc.), returns OK/REVISE. **Build-vs-reuse:** check existing MCPs — is there a «recommendation validator» MCP in the ecosystem? **Risk:** AI declines to call MCP (no hard gate forcing it).

**Mechanism H6 — Multi-pass output / explicit re-read.** AI required to: (1) write recommendation draft; (2) explicitly re-read draft through inner checklist; (3) only then commit. Like Claude's «thinking» but **as visible second-pass output** with the checklist visible. **Risk:** latency; AI might short-circuit the second pass.

**Mechanism H7 — Confidence calibration discipline.** Verbal hedging without mechanical evidence is **banned**. «Probably», «likely», «I think», «I believe», «would seem» → trigger reminder. Each confidence claim («high», «medium», «low») must cite predicate («7/20 surfaces verified mechanically; calibration: NONE — first run»). **Build-vs-reuse:** mirrors T6 from [ai-laziness-traps §2](../../rules/ai-laziness-traps.md). Apply T6 to dialogue, not just R-phase output.

**Mechanism H8 — Pre-output sentinel scan.** Reviewer (human or sub-agent) automatically scans AI output BEFORE it ships to maintainer. Catches obvious failure-mode shapes (e.g. «verdict without evidence», «count without grep»). Real-time, parallel-to-generation if streaming, post-generation pre-display if batched. **Build-vs-reuse:** compliance-verifier scoped to PR-description today; could be re-scoped to live dialogue. Requires Claude Code orchestration of sub-agent on every assistant turn — research: does harness support this?

**Mechanism H9 — Adversarial counter-prompt requirement inline.** Every recommendation includes mandatory section «**What would make this wrong?** ⟨mechanical falsification check⟩». Like §1.7 Forward-check but **scoped to single utterance**. Hook detects verdict-shape, expects adversarial section in same turn, else flags. **Build-vs-reuse:** §1.7 itself is the precedent — same shape, finer granularity.

### WARM/COLD class — fires at commit-time or post-merge

**Mechanism W1 — Recommendation-anchored §1.7 gate.** PRs containing research-patches that propose ≥1 recommendation **must** carry §1.7 trailer (remove research-patches allowlist for recommendation-bearing patches). Specific change: subset by content — patches declaring «Verdict:» / «Recommendation:» / «Decision:» lose allowlist exemption per [.husky/pre-push:300](../../../.husky/pre-push#L300).

**Mechanism W2 — Compliance-verifier expansion to dialogue artefact.** [agents/compliance-verifier.md](../../../agents/compliance-verifier.md) currently scoped to PR-description §1.7 review. Extend to «review research-patch §6 decisions section» — verify each recommendation has mechanical evidence. **Risk:** recursive — same model class reviewing same model class.

**Mechanism W3 — Two-AI session discipline.** Different vendor / model / fresh-session prompt reviews load-bearing recommendations before maintainer accepts. **Build-vs-reuse:** AIF Handoff `paused:true` pattern (SSOT #28 DEFER) — explicit machine-readable pause-for-review primitive.

**Mechanism W4 — Reviewer protocol extension (maintainer-side).** Maintainer-facing checklist: «before accepting AI recommendation in dialogue — ask: did AI consult SSOT? did AI run context7? did AI verify counts mechanically?». Shifts gate to maintainer. **Trade-off:** friction; not mechanical.

### Floor not ceiling

T-think-time-A trap remains: H1-H9 + W1-W4 list is **floor**, not ceiling. Adversarial: what shape did I miss?
- **Learn-time interventions** — modify how AI is prompted at session start vs runtime gates.
- **Tool-use-as-gate** — make verdict issuance literally a tool call that requires evidence parameters (not Markdown text).
- **Output-shape contracts** — recommendations must follow strict format like §1.7 YAML (parallels Q2 mechanism C); hook validates format, not just keywords.
- **Behavioural eval suite** — pre-deploy test: «when given a problem with build-vs-reuse trap, does session catch it? Run this on every model-version bump as regression suite». Adapts Stryker thinking to dialogue patterns.

---

## Required deliverables (этой сессии)

1. **Research-patch** в `docs/meta-factory/research-patches/2026-MM-DD-§17-think-time-gate.md` со структурой:
   - §1 Incident reconstruction (today's dialogue — 5 occurrences, brief; do NOT re-narrate parent gap)
   - §2 Existing coverage (named anti-patterns, mitigation pointer, self-reflection skill state) — what's already done
   - §3 Structural gap (temporal scope — write-time vs think-time)
   - §4 Candidate mechanisms (H1-H9 + W1-W4 above + ≥1 adversarially-enumerated by THIS session). **Split explicit HOT vs WARM/COLD per maintainer ask 2026-05-13.** Primary research focus = HOT class (in-dialogue).
   - §5 Prior art — required (research tooling — двойной канал, added 2026-05-13):

     > **Двойной research-канал:** проект имеет ДВА MCP — `context7` (API signatures, current usage) и `deepwiki` (`ask_question(repo, question)` — architectural understanding, tradeoffs, cross-repo analysis). **Обязательно для каждого кандидата мехинизма ниже:** прогнать запрос ОБОИМ инструментам и сравнить findings в §5. Если deepwiki недоступен (MCP не загружен — проверь `ToolSearch` для `mcp__deepwiki__*`) — задокументировать + продолжить только с context7. DeepWiki установлен user scope 2026-05-13; должен быть доступен в этой сессии.

     - **Claude Code harness capabilities deep-dive:** what hook events exist (UserPromptSubmit, Stop, PreToolUse, PostToolUse, SubagentStop, PreCompact, SessionStart) and what each can do. Specifically: can a hook **intercept assistant output before display**? Can a hook **inject system-reminder mid-stream**? Can a skill **auto-load on AI output content** (not just user prompt content)? Use claude-code-guide subagent if available; else context7 `/anthropic/claude-code` + **deepwiki `ask_question("anthropics/claude-code", "...")`** + WebSearch.
     - **MCP server ecosystem:** does «recommendation pre-validator» / «output linter» / «verdict gate» MCP exist? context7 ≥3 phrasings + **deepwiki cross-repo** (e.g. `ask_question("modelcontextprotocol/servers", "are there output-validation MCP servers?")`).
     - **AI self-monitoring literature:** WebSearch «LLM reasoning self-verification mid-output», «agent recommendation review live», «two-AI inline review», «LLM self-critique pre-output». Look for production patterns, not academic papers.
     - **AIF / Cline / Codex patterns:** SSOT entries #6-#10 + #27-#32. Cline Memory Bank periodic re-read pattern — could fire on AI output, not just session start? Codex AGENTS.override.md escape hatch — semantic analog? **DeepWiki особо полезен здесь** — `ask_question` про архитектуру их repo может surface internals, которые context7 не покрывает.
     - **Build-vs-reuse:** before proposing any new mechanism — SSOT #28 (AIF Handoff paused:true), #38 (CodeRabbit semantic review), **#41 (Danger JS — relevant если think-time gate работает на PR-time, не in-session)**. Existing skill self-reflection. Compliance-verifier scope.
   - §6 Open questions for maintainer
   - §7 Recommended scope placement (Wave 9.x interim / Wave 10 inline / new §13.x umbrella) — recommendation с rationale, не decision
   - §8 §1.7 Self-application — does this research-patch itself comply? **CRITICAL: this patch is making recommendations about how to gate recommendations** — meta-recursive scope, easy to fail. Apply discipline visibly.

2. **Диалог** с maintainer Q1-Q3 explicit decisions.

3. **Decision record** post-dialogue.

---

## AI laziness traps for this session (active)

Per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md) obligations on kickoff authors:

**Active canonical traps:** T1 (sampling floor=5 if doing further corpus sampling), T3 (file:line citations for every claim), T7 (adversarial counter-prompts at category level — what mechanism shape did I miss?), T11 (build-vs-reuse before proposing any new gate), T15 (self-application — does this research itself fall into the trap it researches?), T16 (pattern-matching-on-name — don't claim «AIF Handoff covers this» without proving problem-class match).

**Domain-specific (this session):**

- **T-think-time-A** — listed mechanism set (H1-H9 + W1-W4) is **floor not ceiling**. If §4 enumerates exactly the given list without adversarial extension — that itself is T7 occurrence in this domain. Especially: «is there a HOT mechanism that's not on the list?» must be answered.
- **T-think-time-B** — recursive trap. Research patch is **about how to catch wrong recommendations**. The research patch **itself** makes recommendations. If §8 self-application is presence-only «applied», not substance — that's `#recommendation-skips-own-discipline` recursively. Mitigation: §8 must enumerate **specific forward+backward checks performed for the recommendations in §4/§7**, not just declare compliance.
- **T-think-time-C** — «mitigation is named so we're done». The named anti-pattern + the named mitigation §1.7 already exist. New session might be tempted to declare «coverage exists» and close. **Counter:** the named mitigation does not fire at the failure-mode's actual time-of-occurrence. That gap is the new research. Don't conflate naming a pattern with closing it.

---

## Hard constraints

- **NO opening PR**
- **NO writing code** beyond the research-patch markdown
- **NO Sonnet delegation** — это research, не implementation
- **NO assuming this session unblocks anything** — work is bounded by deliverable produced + dialogue with maintainer
- **NO duplicating PR-body §1.7 substance gap research** — that lives in [docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md](../../../docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md), reference don't re-derive
- **NO touching memory `feedback_pr_body_count_claims_unverified.md`** — it's load-bearing diagnostic trail until parent gap closes

---

## Commit hygiene

Research-patch commit:
- Subject: `docs(research-patches): §1.7 think-time gate research — recommendation discipline temporal scope gap`
- Prior-art: `Prior-art: skipped — research patch only; mechanism candidates α-ζ enumerated for maintainer decision, none adopted`
- §1.7: subject matches research-patches allowlist; **but this session must consider §6.7 of parent patch:** «research-patches allowlisted in §1.7 gate — double zero-gate». Adding §1.7 trailer voluntarily even though allowlisted = self-aware partial mitigation. Decide explicitly in §8 self-application.

---

## Project context для свежего Opus

- **Goal:** `AI agents can't silently bypass undocumented conventions — every codified rule fails CI on violation.` (README.md#why-this-exists (`README.md`))
- **Invariants:** (1) build-vs-reuse SSOT consult before capability commit; (2) recursive self-application green; (3) search-coverage 6-item checklist on negative-existence claims.
- **Step-0 reading order:** [README.md](../../../README.md) → [.claude/session-bootstrap.md](../../session-bootstrap.md) → [CLAUDE.md](../../../CLAUDE.md) → [.claude/rules/phase-research-coverage.md](../../rules/phase-research-coverage.md) (особенно §4 lines 92 + 97) → parent patch [docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md](../../../docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md) §6.7.
- **No paid LLM in CI** — load-bearing constraint (feedback_no_paid_llm_in_ci memory (`file:///Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_no_paid_llm_in_ci.md`))
- **Phase 10 armed but not started** ([open-questions.md §13.32](../../../docs/meta-factory/open-questions.md)); Wave 10 ARMED waiting on Wave 9 closure ([.claude/orchestrator-prompts/wave-10-hook-architecture/kickoff.md](../wave-10-hook-architecture/kickoff.md))

---

## Final note к AI которая будет это запускать

Этот research — о **самом moment'е в котором ты будешь работать**. Ты будешь давать recommendations. Они могут быть wrong. Нет gate'а который их поймает в момент произнесения.

Если в какой-то момент ты замечаешь что:
- ты defends recommendation через 2+ dialogue turns без новых данных — это активный moment T-think-time-B
- ты выдаёшь verdict (ADOPT/DEFER/PASS/FAIL/RECOMMEND) без проверки против CLAUDE.md / SSOT / search-coverage rule — это active occurrence того что research'ишь
- ты записываешь в research-patch claim как factual без grep/ls/file-read — это sub-case (c) активная

**Самый честный самонаблюдательный probe** для этой сессии: «в момент когда я пишу следующее предложение recommendation'а — у меня есть mechanical evidence для каждого утверждения в нём, или я reasoning'ую from-memory?». Если from-memory — stop, verify, тогда пиши.

Это и есть то что предыдущая сессия не сделала 5 раз подряд.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
