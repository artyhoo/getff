# Kickoff — recommendation-moment gate (итеративное исследование с проверками)

> Открой новую Claude Code сессию на **Opus**. Это **exploratory research, НЕ implementation**. Финальный deliverable — research-patch markdown + decision-needed surface для maintainer. НЕ открывай PR, НЕ codify rule, НЕ trigger Sonnet. Код — только paper-prototype набросок внутри патча.

> **Status:** ARMED. Drafted 2026-05-21.
> **Authoritative for:** scope + итеративная структура раундов + acceptance-gate'ы этой R-сессии.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists); session ordering — see [post-1a-coordination/kickoff.md §3.6](../post-1a-coordination/kickoff.md).
> **Отношение к существующему:** single-pass-версия этой темы **уже исполнена** — `think-time-s17-gate/kickoff.md` (2026-05-13) произвёл два доставленных + закоммиченных патча: [2026-05-16-§17-think-time-gate.md](../../../docs/meta-factory/research-patches/2026-05-16-§17-think-time-gate.md) (каталог H1–H10, prior-art dual-channel §5, рекомендация-бандл **H1+H10+W1, MEDIUM confidence** §7) + [errata-коррекцию](../../../docs/meta-factory/research-patches/2026-05-16-think-time-s17-gate-correction.md) (исправляет неверный Stop-hook claim в §5.1). Эта сессия — **НЕ замена и НЕ повторное порождение**: она **пере-валидирует** доставленные выводы под структурными gate'ами (обоснование — §1) и при необходимости их **supersedes**. Каталог механизмов **уже там — НЕ переоткрывай: бери оттуда и проверяй**. Companion-сессии: [autonomous-self-audit-research](../autonomous-self-audit-research/research-prompt.md) (no-self-trigger gap, **НЕ исполнен**), [post-9-pr-body-substance-research](../wave-9-discipline-theatre-audit/post-9-pr-body-substance-research.md) (PR-body substance). См. §6 про consolidation.

---

## §0 Step 0 — обязательное чтение до любого действия

1. [README.md#why-this-exists](../../../README.md#why-this-exists) — якорь цели.
2. [.claude/session-bootstrap.md](../../../.claude/session-bootstrap.md) — инварианты.
3. [CLAUDE.md](../../../CLAUDE.md) — capability-gate, Artifact Ownership Contract.
4. [.claude/rules/ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) §2 + §3 — обязательная T-энумерация.
5. [.claude/rules/phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md) §1 + §1.7 — search-coverage + forward/backward.
6. [.claude/rules/no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — runtime-ограничение механизма.
7. [.claude/rules/reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) — surface decision, не выбирай стратегию.
8. [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — adopt-vs-build.
9. [think-time-s17-gate/kickoff.md](../think-time-s17-gate/kickoff.md) + [autonomous-self-audit-research/research-prompt.md](../autonomous-self-audit-research/research-prompt.md) — каталог механизмов + companion gap.
10. research-patches `2026-05-13-pr-body-s17-substance-gap.md` + `2026-05-16-§17-think-time-gate.md` — что уже зафиксировано.
11. [self-reflection skill](../../skills/self-reflection/references/forward-checklist.md) Layer 6 — verify-before-accepting + anti-tautology пробы.

---

## §1 Gap (одним абзацем)

Самопроверка (§1.7) срабатывает **at-write-time** — на коммите, который трогает rule / principle / skill. Но load-bearing wrong recommendation выдаётся **at-think-time** — в диалоге, до коммита. Вдобавок research-patches **allowlisted** — даже коммит патча с рекомендацией внутри не требует §1.7. Двойной zero-gate: ни диалог, ни recommendation-bearing artefact не встречают механического рубежа. Доказательная база: **5 wrong recommendations** в одной сессии (инцидент PR #51) + **3 инцидента за 24 ч** (evidence в autonomous-self-audit). Цель сессии — спроектировать (не построить) детерминированный механизм, ловящий неверную рекомендацию **в момент её формирования**, без платного LLM.

**Почему пере-валидация, а не accept-as-is доставленных выводов:** single-pass think-time-патч сам совершил failure mode, который изучал. Его §5.1 claim про Stop-hook («fires только в конце сессии») оказался **неверным** и был пойман только пост-фактум 3-канальной верификацией ([errata §2](../../../docs/meta-factory/research-patches/2026-05-16-think-time-s17-gate-correction.md) — Stop fires per-turn). Плюс центральный **Q1** (меняет ли H1-инъекция поведение эмпирически?) остался без ответа, а §7-бандл задекларирован самим патчем как MEDIUM confidence «reasonable bet, not a verified finding» (§7.4). То есть выводы есть, но verification floor под ними **не пройден**. Эта сессия пере-валидирует §7-бандл против корпуса под gate'ами — не порождает каталог заново.

---

## §2 Почему ИТЕРАТИВНО, а не single-pass

Тема рекурсивна: исследование о том, **как ловить непроверенные рекомендации, само выдаёт рекомендации**. Single-pass-сессия рискует вынести verdict без проверки — то есть совершить ровно то, что изучает. Итеративная структура с обязательным gate между раундами делает «проверь прежде чем продолжить» **структурным, а не добровольным**. Каждый раунд закрывается gate'ом; gate не пройден → следующий раунд не начинается.

---

## §3 Раунды и gate'ы

### Round 0 — Anchor & non-duplication
Прочти существующие артефакты (§0 п.9–10). Выпиши одностраничную консолидацию: что уже решено, какой каталог механизмов существует, какие verdicts уже вынесены.
**Gate 0:** ноль re-derivation. Поймал себя на переписывании каталога механизмов — стоп, ссылайся на доставленный патч `2026-05-16-§17-think-time-gate.md` §4 (refined H1–H10) + §7 (рекомендация-бандл), а не на kickoff.

### Round 1 — Corpus (популяция ДО выборки, T10)
Собери корпус реальных + фабрикованных кейсов «wrong recommendation at think-time». Источники: 5 из инцидента PR #51, 3 из autonomous-self-audit evidence, + фабрикуй edge-cases (verdict без prior-art, число без пересчёта, negative-existence без 6-item checklist). Каждый кейс — с ground-truth: что было неверно и какой канал должен был поймать.
**Gate 1:** ≥8 кейсов, каждый с `file:line` или ссылкой на инцидент; популяция перечислена ДО любого «механизм X ловит N из них».

### Round 2 — Shortlist + prior-art **delta** (build-vs-reuse, НЕ повтор §5)
Из каталога H1–H10 отбери 2–3 кандидата. **Prior-art НЕ запускается заново целиком** — доставленный [§5](../../../docs/meta-factory/research-patches/2026-05-16-§17-think-time-gate.md) уже сделал dual-channel (context7 + DeepWiki) по H1–H10. Свежие DeepWiki + WebSearch ≥3 формулировки («LLM self-verification mid-output», «recommendation validator agent», «inline self-critique pre-output») запускай **только** для: (a) claim'ов, помеченных errata как ненадёжные (Stop-hook семантика H2 — теперь fires per-turn, см. [correction §2](../../../docs/meta-factory/research-patches/2026-05-16-think-time-s17-gate-correction.md)); (b) кандидата, которого нет в доставленном §5; (c) случая, когда твой dry-run (Round 3) противоречит выводу §5. Для каждого shortlisted явно: «Upstream problem class: X. Наш: Y. Match? evidence: …» (T16) — **но если §5 это уже зафиксировал, цитируй §5, не пере-выводи** (Gate 0).
**Gate 2:** каждый shortlisted несёт prior-art verdict + problem-class match — либо свежий (delta-случаи a/b/c), либо процитированный из доставленного §5. Без одного из двух — не shortlisted.

### Round 3 — Paper prototype + dry-run
Для top-кандидата выпиши **точную** trigger-логику / prompt-поверхность. Прогони её **руками** против всего Round-1 корпуса.
**Gate 3:** посчитаны catch-rate и false-positive-rate по конкретным кейсам; coverage заявлен честно (T14: clean + low coverage = «coverage insufficient to conclude», а не «works»). Никаких «would catch» — только прогон (T2).

### Round 4 — Self-application (рекурсивный, T15 + T-recgate-B)
Прогони выбранный механизм на verdict'ах **самого этого research-patch'а**. Каждая рекомендация в §findings проходит свой же gate.
**Gate 4:** §self-application перечисляет **конкретные** forward+backward проверки, выполненные над собственными рекомендациями патча, — не декларацию «applied».

### Round 5 — Decision-needed surface (reviewer-discipline)
Сформулируй для maintainer: механизм, catch-rate, остаточный gap, cost (latency / build / maintenance), класс (HOT — в диалоге / WARM — на коммите). НЕ выбирай стратегию.
**Gate 5:** ни одной strategy-imperative фразы («стоит принять», «решение — X»). Только «Option A → следствие X / Option B → следствие Y», выбор за maintainer.

---

## §4 Hard constraints

- **No paid LLM** в механизме и в CI (no-paid-llm-in-ci). Если HOT-механизм LLM-based — деградирует на session-subscription, без API-billing.
- Deliverable = research-patch markdown. Кода нет, кроме paper-prototype наброска внутри патча.
- Не codify rule unilaterally, не trigger implementation/Sonnet.
- Worktree обязателен, если параллелишь с другими сессиями.

---

## §5 AI laziness traps (active — per ai-laziness-traps §3)

Canonical: **T2** (designing≠auditing — прогоняй, не «would»), **T3** (file:line на каждый кейс/число), **T7** (реально гоняй adversarial counter-prompt), **T10** (population before sampling — Gate 1), **T11/T12** (prior-art до «предлагаю» — Gate 2), **T14** (clean≠works — Gate 3), **T15** (self-application — Gate 4 mandatory), **T16** (pattern-matching-on-name — Gate 2 problem-class statement).

Domain-specific:
- **T-recgate-A** — соблазн объявить «механизм H_ ловит все кейсы» по 2–3 примерам без прогона полного корпуса. Counter: Gate 3 требует прогон по **всем** Round-1 кейсам.
- **T-recgate-B** (наследует T-think-time-B) — патч сам выдаёт рекомендацию по выбору механизма, не пройдя собственный gate. Counter: Round 4 обязателен.

---

## §6 Scheduling + объединение scope

Родственно **Item 5a** (autonomous-self-audit) и **Item 5b Step 4** (think-time §1.7) в [post-1a-coordination §3.6](../post-1a-coordination/kickoff.md). Три артефакта (этот, think-time-s17-gate, autonomous-self-audit) бьют в один нерв — recommendation-moment.

**Решение по запуску (принято maintainer'ом 2026-05-21):** эта итеративная сессия запускается как **пере-валидация** доставленных think-time-выводов (Option B), **НЕ** как их замена — think-time уже доставил патч + errata + промотированное правило `§1.10`, заменить исполненную работу нельзя. Этот выбор уже сделан — Round 0 его НЕ переоткрывает.

**Остаётся открытым (surface в Round 5 как decision-needed, не решай сам — reviewer-discipline):** слить ли overlapping scope с **неисполненным** autonomous-self-audit в один R-phase, чтобы не плодить фрагментацию. Вынеси maintainer'у с опциями (Option «слить» → следствие X / Option «оставить раздельно» → следствие Y), выбор за ним.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
