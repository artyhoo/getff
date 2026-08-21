# KICKOFF — Cold-Reviewer #2 для R-phase patch `/meta-orchestrator`

> **Type:** независимое холодное ревью R-phase deliverable (НЕ I-phase admission, не build).
> **Origin:** R-phase wave 2026-05-23 закрыта с 1× final reviewer (GO + 2 MAJOR + 5 MINOR применены). Maintainer одобрил запуск **второго** независимого reviewer'а перед I-phase admission — для покрытия T-AO-A (collusion risk с одним каналом review).
> **Deliverable:** одно сообщение в этой сессии с verdict GO / REVISE + numbered findings.
> **No code edits.** Только чтение и анализ.

---

## §0 Контекст (cold start — ты НЕ видел исходную сессию)

R-phase задача была: обследовать prior-art для `/meta-orchestrator` skill capability (slash-команда которая делает plan-preflight + cross-umbrella priority + launch-table + meta-kickoff authoring + stage-gate-aware dispatch).

Результат R-phase: **BUILD на CC primitives, REFERENCE 9 upstream sources, ADOPT-VOCABULARY 3**. Surveyed 6 surfaces (Superpowers, AI Factory, aif-handoff, OhMyOpencode, CC native, общий SOTA sweep). Ни один не покрыл §7 >30%.

Финальный reviewer #1 поставил **GO** (0 BLOCKER, 2 MAJOR, 5 MINOR). 2 MAJOR + 4 MINOR применены к патчу.

**Что нужно от тебя:** второе независимое cold-context ревью **с одним дополнительным фокусом** ниже (§3).

## §1 Файлы для чтения

| Файл | Чего читать |
|---|---|
| [`docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md`](../../../docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md) | **Основной deliverable** — целиком (~284 строки) |
| [`.claude/orchestrator-prompts/meta-orchestrator-prior-art/kickoff.md`](../meta-orchestrator-prior-art/kickoff.md) | **Контракт** который patch должен удовлетворить — особенно §7 (load-bearing спека) и §9 closing checklist |
| [`.claude/orchestrator-prompts/meta-orchestrator-prior-art/state.md`](../meta-orchestrator-prior-art/state.md) | Phase -1 cold-review #1 + amendment log + dispatch plan |
| `/tmp/meta-orch-survey-1-superpowers.md` (457 lines) | Primary evidence для Surface 1 |
| `/tmp/meta-orch-survey-2-aif.md` (156 lines) | Surface 2 evidence |
| `/tmp/meta-orch-survey-3-aif-handoff.md` (171 lines) | Surface 3 evidence |
| `/tmp/meta-orch-survey-4-ohmyopencode.md` (162 lines) | Surface 4 evidence |
| `/tmp/meta-orch-survey-5-cc-native.md` (150 lines) | Surface 5 evidence |
| `/tmp/meta-orch-survey-6-state-of-art.md` (220 lines) | Surface 6 evidence |

⚠ Скретчпады в `/tmp/` эфемерные — если они пропали, пометь это как INCONCLUSIVE и продолжай по самому patch'у.

## §2 Стандартное cold-review задание (как Reviewer #1)

Проверь:
1. **§4 deliverable list completeness** — все 8 пунктов кикофа закрыты substantively
2. **§9 closing checklist substance** — 8 tick'нутых пунктов truthful (spot-check ≥3)
3. **Evidence chain integrity** — claims в патче подкреплены scratchpad evidence (если /tmp пропал — против самих cited URLs/file:lines)
4. **§7 spec preservation** — checksum (14 sub-sections, header «LOAD-BEARING», 4 named gaps) hits accurate marks against [kickoff §7](../meta-orchestrator-prior-art/kickoff.md)
5. **Falsifier substance** — composite + per-surface falsifiers конкретны
6. **T16 problem-class check** — explicit «Upstream X vs Our Y» на каждом verdict
7. **Cross-reference accuracy** — random-spot-check 5 file: links
8. **Anti-T3 audit** — нет prose-only claims

## §3 ОСОБЫЙ ФОКУС — chain-композиция SP-скилов (новый запрос)

**Это слабое место Surface 1 которое Reviewer #1 не оценил явно.**

Surface 1 Worker анализировал 14 Superpowers скилов **по одному** против §7. Лучший single-skill match = `writing-plans` ~18%. Вердикт BUILD основан на этом анализе.

**Но что если COMPOSITION даёт ≥40%?** Гипотетический пример:
- `writing-plans` ~18% (формат плана)
- `+ dispatching-parallel-agents` (parallel dispatch)
- `+ using-git-worktrees` (worktree isolation)
- `+ requesting-code-review` (reviewer dispatch)
- `+ finishing-a-development-branch` (PR-creation)
- `+ verification-before-completion` (re-check discipline)

При правильной склейке композиция может покрыть, например, 50%+ §7. Тогда правильный вердикт — **ADAPT-chain**, не BUILD.

**Твоё задание:**

1. Прочитай §7 кикофа целиком (~14 sub-sections)
2. Для каждой §7 sub-section проверь:
   - Какой SP-скил/композиция её покрывает? (если есть)
   - Какой % покрытия в композиции (с учётом склейки нескольких скилов)?
3. Просуммируй: **даёт ли composition ≥40% §7?**
4. Особо проверь:
   - §7.3 cross-umbrella priority — есть ли в SP даже частичный механизм? (Reviewer #1 сказал «нет, MISSING entirely» — подтверждаешь?)
   - §7.5 meta-kickoff authoring с §5 AI-traps — есть ли в SP? (Reviewer #1 сказал «нет» — подтверждаешь?)

**Если composition ≥40%:** вердикт BUILD неверен → REVISE → переклассификация в ADAPT-chain с указанием какие SP-скилы образуют chain.
**Если composition <40%:** вердикт BUILD стоит → GO с этим pierced specifically.

Цитируй SKILL.md file:line для каждого скила в композиции.

## §4 Дополнительная falsifier-проверка

Проверь чтобы дать GO/REVISE:

1. `code.claude.com/docs/en/skills.md` — изменился ли контракт `arguments:` / `argument-hint:` / `disable-model-invocation:` / `${CLAUDE_SKILL_DIR}` / `!shell` injection между 2026-05-23 и сегодня? WebFetch live page и сравни с тем что цитировал Surface 5.
2. `claude-code marketplace` plugins — появился ли bundled meta-orchestrator skill после 2026-05-23? WebSearch + `/plugin marketplace update claude-plugins-official` (если ты можешь это сделать в session).

Если что-то изменилось — это **новые BLOCKER** к admission.

## §5 SSOT-rows proposed-block (patch §9)

Patch добавил draft'ы 5 SSOT-rows (#66–#70) как paste-ready block для I-phase capability commit. Проверь:

1. **Formulations** — T16 problem-class формулировки точные? Falsifier-trigger fields конкретные?
2. **ID assignment** — #66–#70 не конфликтуют с N8 A-phase rows (см. wave-sequencing-plan §0 collision note)?
3. **REJECTы без SSOT-rows** — политика «REJECT не получает row» в patch §9 обоснована? Или addyosmani/agent-skills `/ship` стоит landing'ить как REFERENCE сразу (deferred per patch decision)?

## §5b ОСОБО (добавлено по follow-up maintainer 2026-05-23) — Class assessment для I-phase skill

Maintainer задал ключевой вопрос: «документы врут, тесты нет — но дропнутый AST-test для `parallel-subwave-isolation.md` оставляет правило в Class C (prose-only). А mы повторяем тот же шаблон в `/meta-orchestrator`?»

Прецедент: [`research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md`](../../../docs/meta-factory/research-patches/2026-05-16-readme-absolutism-vs-class-c-practice.md) — открытое признание tension между README «every rule = executable artifact» и Class C practice.

**Твоё задание (§5b):** проверь R-phase patch на recursive-self-application gap.

`/meta-orchestrator` §7.7 говорит «real `gh pr list --search 'is:merged head:<branch>'` checks между этапами». Это **bash инструкция в markdown SKILL.md** — AI **может** её проигнорировать (T7 trap).

Для **каждой** §7 sub-section проверь:
1. На каком канале enforcement происходит? (edit-time skill prose / hook / pre-push / CI principle test / production audit)
2. Если **только** edit-time skill prose → есть ли catch-net на более позднем канале для случая «AI проигнорировал skill»?
3. Если catch-net'а нет → это **acceptable Class C compromise** (как `parallel-subwave-isolation.md`) ИЛИ дисциплинарный gap который I-phase должен закрыть mechanical principle test'ом?

**Особо проверь §7.7 (stage-gate semantics):**
- Должен ли быть principle test «коммит на branch B существует только если PR на branch A merged»?
- Если да — добавь его в §5 skeleton I-phase kickoff'а (как ADDITIONAL finding).
- Если нет (acceptable Class C) — объясни почему этот специфический case не требует executable artifact (если cost > value или incident frequency низкая).

**Falsifier:** если ≥2 §7 sub-sections наследуют trust-the-document pattern БЕЗ post-hoc catch-net И maintainer не имеет explicit «known Class C compromise» вердикта — это **discipline-theatre risk** который должен быть назван в твоём verdict'е.

---

## §6 AI-laziness traps active

T3 (file:line / URL per claim), T7 (adversarial counter-prompt), T13 (REFERENCE ≠ zero-work — verify each cited upstream did NOT match more than reviewer #1 said), T15 (self-application — your verdict itself follows the discipline), T16 (problem-class check on every borderline candidate).

**Особо:** **T-AO-A (collusion)** — твоя задача не дублировать reviewer #1, а **независимо** прийти к verdict. Если согласен с reviewer #1 — скажи почему пришёл к тому же независимо. Если не согласен — назови расхождение.

## §7 Output format

```
## Cold-Reviewer #2 verdict

### Verifications I ran
- ...

### §2 Standard checks (a)-(h) summary
- ...

### §3 Chain-composition analysis (SPECIAL)
- §7 sub-section coverage table with composition annotations:
  | §7 | Best single SP-skill | Coverage | Best composition | Composition coverage |
  | ... |
- Sum: composition gives X% of §7
- BUILD verdict (still valid / overturned to ADAPT-chain): rationale

### §4 Live-changes falsifier check
- skills.md contract: unchanged / changed [delta]
- New CC bundled skill: yes [details] / no

### §5 SSOT-rows review
- Formulations: ...
- ID assignment: ...
- REJECT policy: ...

### BLOCKER findings
1. ...

### MAJOR findings
1. ...

### MINOR findings
1. ...

### Independent T-AO-A note
- Convergence with Reviewer #1: ... / Divergence: ...

### VERDICT: GO | REVISE
<one-sentence rationale>
```

## §8 Стоп-условия

- Если §3 chain-composition даёт ≥40% → REVISE (мощный сигнал)
- Если §4 surface новый CC bundled equivalent → REVISE (falsifier triggered)
- Если §5 находит drift в SSOT IDs → MAJOR (но не BLOCKER)
- Иначе → GO

## §9 После GO от reviewer #2

Maintainer:
1. Landing'ит SSOT-block #66–#70 в `docs/meta-factory/prior-art-evaluations.md` (paste from patch §9)
2. Admit'ит I-phase по skeleton'у в patch §5
3. I-phase сама делает первый capability commit с `Prior-art:` trailer referencing #66–#70

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
