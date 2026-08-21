# R-phase kickoff: Cross-worktree gitignored coordination-doc sync

Ты — research-сессия. Задача: спроектировать решение для проблемы дрейфа gitignored координационных документов между параллельными git worktree, с verdict per build-first-reuse-default discipline (ADOPT / ADAPT / REFERENCE / KEEP NARROW / BUILD / REJECT / ADOPT VOCABULARY). На выходе — research-patch + рекомендация. **НЕ имплементируй.** Только research + verdict + sketch.

## §0 — обязательное чтение (Step 0, до любого действия)

В таком порядке:

1. `README.md#why-this-exists` — project goal (не методология)
2. `.claude/session-bootstrap.md` — invariants
3. `CLAUDE.md` — Build-vs-reuse invariant + Artifact Ownership Contract + PR strategy
4. `.claude/rules/build-first-reuse-default.md` — **§3 mechanism (6 layers), §2 семь verdicts**
5. `.claude/rules/phase-research-coverage.md` — §1 6-item search-coverage checklist + §1.7 Forward/Backward self-reflexive trigger
6. `.claude/rules/ai-laziness-traps.md` — §2 trap catalogue + §3 kickoff obligations (cite + enumerate + ≥1 domain-specific)
7. `.claude/rules/no-paid-llm-in-ci.md` — constraint
8. `.claude/rules/parallel-subwave-isolation.md` — почему worktrees обязательны (motivates the problem)
9. `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_gitignored_coordination_doc_drift.md` — **полное описание проблемы; начни отсюда после общего онбординга**
10. `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_companion_integration_analysis_ready.md` — параллельная R-phase; убедись что твоя работа не дублирует её scope (твоя проблема **уже** в скоупе их Item 3? проверь — если да, координируй; если нет, твоя работа standalone)
11. `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_worktrees_for_parallel_subwaves.md`
12. `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/feedback_orchestrator_branch_state_drift.md`
13. `docs/meta-factory/prior-art-evaluations.md` — SSOT, грепни по «worktree», «sync», «coordination», «orchestrat»

## §1 — Worktree setup (ОБЯЗАТЕЛЬНО до правок)

Ты работаешь в **новой worktree**, не в основной рабочей директории. Первый bash:

```bash
git worktree add ../rules-as-tests-aif-coord-sync main
cd ../rules-as-tests-aif-coord-sync
git checkout -b research/cross-worktree-coord-sync-2026-05-17
```

Если worktree add падает — **STOP, репортируй orchestrator**, не работай в shared dir (`#worktree-add-failure-ignored` из parallel-subwave-isolation §3).

## §2 — Проблема (восстанавливай детали из memory #9, не из этого § — он paraphrase для контекста)

`.claude/orchestrator-prompts/**` gitignored по дизайну. Multi-worktree workflow (живых worktree сегодня = 4) → каждая worktree держит свою копию `post-1a-coordination/kickoff.md` и других координационных docs. SSOT-правка в одной worktree не видна другим. Инцидент 2026-05-17 после PR #71 cleanup — 3 worktree остались со stale Item 0. Это recurring структурный изъян, не one-off.

## §3 — Цель сессии (deliverable)

Один файл: `docs/meta-factory/research-patches/2026-05-17-cross-worktree-coord-doc-sync.md`

Структура:

- **§1 Problem restatement** (свой пересказ, не copy-paste из memory)
- **§2 Search-coverage execution** — все 6 пунктов из phase-research-coverage.md §1, каждый с конкретным выводом:
  - SSOT consult (grep prior-art-evaluations.md, цитируй ID или «no match» + что искал)
  - DeepWiki `ask_question` ≥3 phrasings на разные ракурсы: «cross-worktree sync», «multi-checkout coordination», «shared state across git worktrees»
  - WebSearch ≥3 phrasings: «git worktree shared config», «multi-worktree orchestration tool», «cross-worktree gitignored state sync»
  - context7 ОПУЩЕН (per BFR-default §3 footnote: context7 = library API docs, не tool discovery — substituting даёт low-signal)
  - Внутренний поиск: grep по project на «worktree» — что уже у нас есть
- **§3 Candidate solutions** — минимум 5, включая прямые альтернативы из memory entry §«Why companions»:
  - (a) sync companion (file-watcher или git hook)
  - (b) canonical-copy-outside-worktrees + symlink из каждой
  - (c) aggregated live-view companion (читает все worktree → синтезирует state)
  - (d) un-gitignore `.claude/orchestrator-prompts/**` (анализ tradeoff с branch-noise)
  - (e) переехать в global memory (`~/.claude/projects/.../memory/`) — там и так глобально
  - …+ всё что surface DeepWiki/WebSearch
- **§4 Per-candidate verdict** per build-first-reuse-default §2 (7 verdicts). Каждый verdict — отдельная подсекция с: «Upstream problem class», «Our problem class», «Match? evidence», «Integration cost estimate», «Decision»
- **§5 Recommendation** — один или сочетание; если BUILD выбран — sketch ≤30 LOC, явный анализ почему не ADOPT
- **§6 §1.7 Forward-check applied** — какие существующие disciplines проверены (минимум: build-first-reuse-default, parallel-subwave-isolation, no-paid-llm-in-ci, dual-implementation-discipline; file:line ≥1 на каждую)
- **§7 §1.7 Backward-check applied** — sweep существующих coord docs / hooks / orchestrator scratch под новой scope; file:line ≥1
- **§8 Self-application (T15)** — этот research-patch сам gitignored? Нет (`docs/meta-factory/research-patches/` tracked). Применима ли проблема к research-patches workflow? Опиши.
- **§9 ATTN / open questions** — что осталось для maintainer-decision

## §4 — AI-laziness traps (per ai-laziness-traps.md §3, mandatory cite + enumerate + ≥1 domain-specific)

См. `.claude/rules/ai-laziness-traps.md §2`. Active для этой R-phase: **T1, T3, T7, T11, T12, T13, T15, T16**. Каждый — короткое justification что именно risk-y здесь. Плюс минимум один domain-specific:

- **T-coord-A — «Adopt-by-name»:** ты найдёшь tool с «worktree» в названии (Atomist worktrees / GitHub worktree-action / etc) и предположишь что он решает нашу проблему. Counter: для каждого ADOPT/ADAPT кандидата — секция «Upstream problem class vs Our problem class» с evidence. **Наша проблема ≠ «много worktree», а «gitignored SSOT scratch drift между ними» — узкий case.**

Add others if surfaces during execution.

## §5 — Constraints

- **No paid LLM in CI** — любой proposed mechanism: deterministic OR AI-agnostic sub-agent (markdown prompt read by active session). НЕ API-call.
- **No drive-by edits вне scope deliverable** — только research-patch + (опционально) добавление SSOT entry в `prior-art-evaluations.md` если capability area новая. **НЕ** правь kickoff'ы, **НЕ** open-questions.md §13.x — это maintainer-territory.
- **Worktree only** — все правки в твоей worktree; не трогай основную рабочую директорию.
- **Не запускай /aif, /loop, /schedule** — не нужны.

## §6 — REPORT обратно orchestrator (по завершении)

Структура REPORT:

- Файлы: путь + LOC delta
- VERIFY: явные deterministic checks (research-patch links не битые → manual grep; §1.7 H3 секции присутствуют; ≥1 file:line citation в каждой §6/§7)
- DECISIONS: ключевые judgment-calls в процессе research
- ATTN: что осталось для maintainer
- Confidence: с calibration evidence (X/Y candidates with mechanical evidence, Z/Y require maintainer judgment)
- Commit hash + branch name

## §7 — Stop rules

Если ты обнаружишь:
- что проблема уже в scope companion-integration-analysis R-phase (Item 3) и не standalone → STOP, репортируй orchestrator с предложением merge scope
- что 5 кандидатных solutions нельзя различить без эмпирического теста → STOP, репортируй, предложи micro-empirical session
- что DeepWiki/WebSearch surface даёт <3 production-grade кандидата на ADOPT → STOP, репортируй, проверь с maintainer стоит ли default'ить на BUILD или расширить search

## §8 — Estimated effort

- §0 reading: ~30 min
- §2 search-coverage execution: ~60-90 min
- §3–§5 drafting: ~60-90 min
- §6–§8 self-discipline sections: ~30 min
- REPORT: ~10 min

**Total: ~3-4h focused. Один заход.**

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
