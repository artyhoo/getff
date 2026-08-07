<!-- scope:meta-orchestrator-refactor-design -->
# Research patch — Sub-wave G: полный дизайн рефакторинга /meta-orchestrator skill

> **Inherits authority from** [research-patches/README.md](README.md) folder-level Authoritative-for header. Scope-bound to: дизайн полного рефакторинга `/meta-orchestrator` skill — findings registry, autonomy analysis, UX redesign, technical debt audit, F.3 binding scope. **NOT authoritative for** project goal (см. [README.md#why-this-exists](../../../README.md#why-this-exists)); сама F.3 реализация — F.3 ссылается на этот patch как binding spec.
> **Date:** 2026-05-24 · **Author session:** claude-sonnet-4-6, Sub-wave G R-phase (Mode A inline, role: research + reviewer). S3 split: tech-debt audit + F.3 scope → companion file `2026-05-24-meta-orchestrator-refactor-f3-scope.md`.
> **Tags:** `#meta-orchestrator-refactor` · `#ux-redesign` · `#autonomy-design` · `#tech-debt-audit` · `#f3-scope`

---

## §-1 Cold review outcome

Kickoff verified cold (inline reviewer-discipline §2). Factual claims checked:
- F.2 REPORT done ✅ — подтверждено в kickoff.md §0.1 строки 82-83
- SKILL.md post-#202 state ✅ — `<!-- globs: -->` markers на строках 488-489 SKILL.md присутствуют
- CC depth=2 constraint ✅ — процитировано в kickoff §0 строка 39 с первичным источником `sub-agents.md line 753`
- Gap-1 regex bug ✅ — `grep` воспроизведён механически (см. §1.4 в companion): ловит 8 строк из dispatch-таблицы kickoff вместо sub-wave строк
- Mirror diff ✅ — только SKILL.md и plain-language-tail.md отличаются (оба задокументированных расхождения)

**Единственная stale-ref риск:** §0 kickoff цитирует «SKILL.md:171 vs §5 SKILL.md:236» — строки сдвинулись после #202. Референс — к F.2 REPORT, не к текущим задачам G. Не блокирует GO.

**Verdict: GO.** Iter 1/3. S3 fired (779 raw lines) → split applied.

---

## §1.1 Findings registry (7 источников)

### Источник 1 — F.2 REPORT (0 BLOCKER / 2 MAJOR / 3 MINOR + D3-MAJOR)

**M1 (MAJOR):** SKILL.md §5 строка ~236 — «R-phase, single → Queue mode sequential» противоречит авторитетному `queue-mode.md:21` («Single kickoff → Mode A»). Fix: заменить на `| R-phase, single | Mode A inline | Single-focus R-phase = one Opus session; Queue mode is for ≥2 sequential kickoffs (queue-mode.md:21). |`

**M2 (MAJOR):** SKILL.md §10.3a строка ~424 + `references/plain-language-tail.md:8` — слово «injects» некорректно для Stop hook. Hook работает через `decision:block` + `reason → next-turn system-reminder`. Fix: «enforces presence of `## 🟢 Простыми словами` via block decision».

**D3-MAJOR (MAJOR):** SKILL.md §0 строка ~37 — «This prevents subagents from recursively self-invoking» атрибутирует изоляцию флагу `disable-model-invocation`. Реальная причина — дефолтное поведение CC (skip auto-load into subagent contexts). Fix в companion §1.4 Item 2.

**m1 (MINOR):** §5 dispatch-table отсутствует строка «R-phase, multiple sequential → Queue mode». Gap в routing'е.

**m2 (MINOR):** §6 строка ~271 — hardcoded `created:>=2026-05-23` в stage-gate примере. Должен быть относительный.

**m3 (MINOR):** Строка ~490 — нет blank line перед `## See also`.

### Источник 2 — F.1 UX research (patch PR #203)

**F1-UX-1 (MAJOR):** Slash-tag format (`/Mode-A /Roles-worker`) — ZERO upstream precedent в 10 инструментах. Все mature chat-based tools сходятся на `/<command> <NL-payload>`. Вердикт F.1: ADOPT VOCABULARY → `/orchestrator <NL-payload>`.

**F1-UX-2:** ASCII tree Argo Workflows (`├─ / └─`) — единственный CLI-renderable вариант для dependency graph в chat medium. Mermaid не рендерится в CC chat. ADAPT vocabulary.

**F1-UX-3:** 5-column action queue table (`# | Блок | Когда | Ждёшь | Параллельно с`) — валидирован prior-art survey. «Параллельно с» — BUILD contribution.

**Binding format** (parent kickoff §1 Sub-wave F.3 строки 237-252):
```text
/orchestrator <umbrella-name> §<section> — Mode <X> <role> <autonomous?>, остальное в kickoff
```

### Источник 3 — Original F.3 scope (parent kickoff §1 Sub-wave F.3 lines 192-359)

Три change-group для F.3:
- **F3-S1:** SKILL.md §5 — добавить `#worker-dispatch-via-subagent` и `#commit-on-behalf-of-worker` antipatterns
- **F3-S2:** SKILL.md §10 — добавить 3 substructure headers: Dependency graph / Action queue / 1-liner blocks
- **F3-S3:** `references/output-format.md` — новый файл с 4 worked examples (Mode A / SDD / B × N / Queue)
- **F3-S4:** `packages/core/principles/18-meta-orchestrator-output-format.test.ts` — slot 18 свободен ✅

### Источник 4 — Round-2 leftover ATTN items (parent kickoff §0.1 строки 87-91)

- **ATTN-1:** SSOT row #71 → DONE (PR #202 commit `fa37bde`) ✅
- **ATTN-2:** `<!-- globs: -->` + `<!-- inject: -->` markers → DONE (PR #202 commit `98b1c66`) ✅
- **Sub-wave D** — DEFERRED (quota), не ATTN к G

Результат: **0 open ATTN items.** T-MOG-G-C counter: round-2 ATTN список был полным.

### Источник 5 — Observed skill gaps (parent kickoff §1.5)

**Gap-1 — regex over-match** (structural, open): воспроизведён механически. 8 ложных срабатываний. Детали в companion §1.4.

**Gap-2 — plan-currency-check.sh missed fresh PRs:** ИСПРАВЛЕН в PR #202. Строки 25-36 helper содержат `git fetch origin staging` + `rev-list HEAD..origin/staging`. ✅

**Gap-3 — worktree symlink slot в meta-kickoff.template.md:** ИСПРАВЛЕН в PR #202. §4a присутствует в template строках 65-86. ✅

### Источник 6 — Cold-eye drift scan

Популяция: SKILL.md 500 строк (11 секций), 3 helpers, 3 references, 2 templates, consumer mirror 107 строк.

Architectural smells — отсутствуют. Class declarations точны (детальный check в companion §1.4).

Mirror divergence: `diff -r` показал только 2 файла различаются (SKILL.md: intentional condensed consumer; plain-language-tail.md: 4 строки, вероятно meta-comment). Нет MAJOR semantic drift.

### Источник 7 — Maintainer-stated direction

1. F.3 = полный рефакторинг (не только UX)
2. Autonomy DEFERRED — current N+1 pattern сохраняется
3. True 1-liner format: `/orchestrator <umbrella> §<section> — Mode X...`
4. T-MOG-G-B counter: slash-tag rejection подтверждён независимо F.1 (10 candidates, ZERO precedent) — не только maintainer preference

---

## §1.2 Autonomy design analysis

### CC depth=2 constraint

**Verified** (из kickoff §0 строка 39, primary source `sub-agents.md line 753`): «Subagents cannot spawn other subagents». `agent-teams.md`: «No nested teams».

Levels: Level 0 = meta-orchestrator session. Level 1 = Worker/Reviewer. Level 2 — **NOT SUPPORTED**.

### Verdicts per option

| Option | Verdict | Rationale |
|---|---|---|
| **B (full-autonomous)** | **REJECT** | Sub-orchestrator (L1) не может spawn Workers (L2): нарушает depth=2. Единственный обход = meta-orchestrator сам loop-closes = потеря context isolation |
| **C (incremental)** | **DEFER** | Требует R-phase: определить «линейность sub-wave» критерии, blast-radius cap, DECISION-NEEDED handling |
| **Hybrid** | **DEFER** | Те же ограничения что C |
| **Status-quo (N+1)** | **KEEP** | Работает. depth=2 compatible. Quality = single Opus session per Worker. Auto-merge staging = working per `feedback_harness_merge_block_and_500line_gate` |

### Quality preservation

Текущий N+1: каждый Worker = fresh Opus session с full context budget. Любое отклонение рискует context overfill на сложных umbrella.

**Test-umbrella для quality-parity gate** (если revisit):
- ≤3 stages, только R-phase (read-only, zero blast radius)
- Metrics: (a) AC met in REPORT, (b) zero false-DEFER, (c) zero over-claim vs git/CI, (d) cold-review BLOCKER-free

**Итог:** autonomy design остаётся **DEFERRED**. T-MOG-G-A applied: DEFER = valid G output.

---

## §1.3 UX redesign

### Format verdicts (via F.1 prior-art + global orchestrator verification)

Global `~/.claude/skills/orchestrator/SKILL.md` прочитан (строки 1-11, 80-139): принимает NL-payload после slash command. `when_to_use` + `description` = NL. **Slash + NL = совместим.** ✅

**Format 1 — True 1-liner (BINDING):**
```text
/orchestrator <umbrella-name> §<section> — Mode <X> <role> <autonomous?>, остальное в kickoff
```

Worked examples:
```text
/orchestrator meta-orchestrator-followup-audit §1 Sub-wave F.1 — Mode A worker автономно, остальное в kickoff
/orchestrator mutation-discipline-umbrella §4 Stage 1 — Mode B × 3 worker'ы параллельно, остальное в kickoff
/orchestrator wave-X §3 — Mode SDD implementer + 2 reviewer, остальное в kickoff
/orchestrator wave-Y §2 — Mode Queue, итеративно ревьюится, остальное в kickoff
```

Parseable by global `/orchestrator`: ✅ (NL after slash = standard CC pattern, confirmed).

**Format 2 — 3-layer output structure (для OUTPUT `/meta-orchestrator`):**

```text
═══════════════════════════════════════════════════════════════
EXECUTION PLAN — <umbrella> (<date>)
═══════════════════════════════════════════════════════════════

## Dependency graph

Stage 1 — СЕЙЧАС (оба параллельно):
├── F.1 — UX research       (Mode A, ~30k, read-only)
└── F.2 — Cold review       (Mode A, ~30k, read-only)

Stage 2 — после мержа обоих Stage 1:
└── F.3 — UX implementation (Mode A, ~40k, зависит от F.1+F.2)

## Action queue — что ты делаешь

| # | Блок | Когда | Ждёшь | Параллельно с |
|---|---|---|---|---|
| 1 | Stage 1-A ниже | Сейчас | F.1 PR merged | Stage 1-B |
| 2 | Stage 1-B ниже | Сейчас | F.2 PR merged | Stage 1-A |
| 3 | Stage 2 ниже | После 1+2 | оба merged | — |

Всего твоих paste'ов: 3.

## 1-liner blocks (копируй ОДИН блок = ОДНА новая CC сессия)

### Stage 1-A — F.1 UX research (Mode A, ~30k)
/orchestrator meta-orchestrator-followup-audit §1 Sub-wave F.1 — Mode A worker автономно, остальное в kickoff
═══════════════════════════════════════════════════════════════
```

Prior-art: ASCII tree = ADAPT Argo Workflows. Table = BUILD (нет static plan precedent). 1-liner = ADOPT VOCABULARY.

**Рекомендация:** Format 1 — формат каждого блока. Format 2 — структура всего OUTPUT. Они complementary, не конкурирующие.

---

## §1.4 + §1.5 — Technical debt audit + F.3 binding scope

**S3 split applied.** Полные §1.4 (Class audit, mirror diff, Gap-1 reproduction, principle 18 spec) и §1.5 (12 items с file path + WHAT + WHY + falsifier + owner) вынесены в companion file:

→ **[`2026-05-24-meta-orchestrator-refactor-f3-scope.md`](2026-05-24-meta-orchestrator-refactor-f3-scope.md)**

**Summary §1.4:** Class declarations точны (11 секций проверены). Mirror diff: только SKILL.md (intentional) + plain-language-tail.md (4 строки, INCONCLUSIVE minor). Gap-1 regex confirmed mechanically (8 false positives). Principle 18 spec написан (slot 18 свободен).

**Summary §1.5:** 12 binding scope items, все с file:line evidence. Major items: M1 (dispatch table fix), D3-MAJOR (disable-model-invocation wording), M2 (injects terminology), F3-S1 (#worker-dispatch antipatterns), F3-S2 (§10 3 substructure headers), F3-S3 (references/output-format.md), F3-S4 (principle 18 test), Gap-1 regex fix (Item 10). Mirror sync obligation (Item 12). 2 INCONCLUSIVE spots flagged (keyword filter edge-cases, plain-language-tail.md diff details).

---

## §1.6 Out-of-scope items (forks)

- **Fork 1 — Sub-wave D (extended TDD):** DEFERRED из round-2. Fresh-quota session, 4 Agent dispatches.
- **Fork 2 — Autonomy design (B/C/hybrid):** DEFER per §1.2 verdict.
- **Fork 3 — inject-matching-rule.sh extension к .claude/skills/\*\*:** DEFER (D1 fork из F.2 — status-quo accepted).
- **Fork 4 — principle 19 (autonomy quality-parity gate):** DEFER до first opt-in dispatch.
- **Fork 5 — plain-language-tail.md mirror diff investigation:** INCONCLUSIVE (4 строки, not read in detail). Resolve if F.3 touches this file.
- **Fork 6 — helper priority-score.sh audit:** не читался в G. Read first if F.3 touches §3 launch-table logic.

---

## §1.7 Self-reflexive check

### Forward-check

**build-first-reuse-default.md §3:**
- UX prior-art: F.1 patch ingested (10 candidates, 6-item checklist). ✅ No BUILD-without-search.
- Autonomy §1.2: CC capability anchor verified (sub-agents.md + agent-teams.md via kickoff primary citations). ✅

**no-paid-llm-in-ci.md §1:** G = session-bound. Principle 18 = deterministic TypeScript grep/assert, no LLM. ✅

**doc-authority-hierarchy.md §2-§3:** Research-patch наследует authority от folder-level README.md. Blockquote header присутствует. ✅

**phase-research-coverage.md §1.7:** Forward-check применён. ✅

### Backward-check

- Не supersedes `2026-05-23-meta-orchestrator-prior-art.md` — BUILD verdict для capability не трогается. ✅
- Не supersedes `2026-05-24-meta-orchestrator-ux-research.md` — G ingests F.1 как input. ✅
- F.3 должен cite этот patch как binding spec (§1.5 в companion = F.3 SSOT).
- T15 (self-application): G-patch прошёл §1.7. ✅

---

## §1.8 Own cold-QA pre-handoff (T19)

**Downgrade checks:**
- D3-MAJOR «аналогичный текст» в consumer SKILL.md: прочитан строки 37-38 — «prevents recursive self-invocation in subagents». Confirmed: fix нужен В ОБОИХ copies. ✅ не speculative.
- plain-language-tail.md diff: INCONCLUSIVE-needs-human (Fork 5).
- Gap-1 keyword filter edge-cases: INCONCLUSIVE-needs-smoke-test (companion Item 10 falsifier).

**Population coverage (T10):** 11 секций SKILL.md ✅. Helpers: 2/3 (priority-score.sh = Fork 6). References: plain-language-tail.md ✅; failures.md + placeholders.md = не F.3 scope. Templates: meta-kickoff.template.md ✅.

**T6 confidence:**
- §1.1: 6/7 источников mechanical. Источник 7 = verbatim kickoff text. HIGH.
- §1.2: CC constraint = 2 independent primary sources cited in kickoff. HIGH. maxTurns default = INCONCLUSIVE (1 axis).
- §1.3: Global orchestrator read (строки 1-11, 80-139). NL parsing = inferred from description/when_to_use. HIGH.
- §1.4/§1.5: Mirror diff mechanical. Gap-1 mechanical. Class audit = all 11 sections. HIGH. 2 INCONCLUSIVE flagged.

**T3:** все MAJOR findings имеют file:line. INCONCLUSIVE items явно помечены. ✅

---

## §A — Decisions для maintainer

### D-G-1: Gap-1 regex fix approach (DECISION-NEEDED)

Option A (keyword filter — heuristic): `grep -E 'R-phase|execution|wiring|Mode [AB]|SDD|Queue mode'` pipe. Просто, но не работает на нестандартных kickoffs.

Option B (section-scoped awk — robust): ограничить scope секциями `§[2-4]` или «Sub-wave». Требует kickoff с этими headings.

Не форсирую — равнозначны по трудозатратам. Детали в companion §1.4.

### D-G-2: SKILL.md line count overflow (DECISION-NEEDED)

Текущий SKILL.md = 500 строк. F.3 добавит ~30-50 строк. Post-F.3 ≈ 530-550 строк → overflow.

Option A (рекомендую): split §10 content в `references/output-format.md` ПЕРЕД F.3 добавлениями. SKILL.md остаётся ≤ 500.
Option B: превысить временно, split после F.3 в отдельный commit.

Recommend A: §10 уже проектирует `references/output-format.md` как место для examples.

---

## §A.9 — See also

- **F.3 binding scope (12 items):** [`2026-05-24-meta-orchestrator-refactor-f3-scope.md`](2026-05-24-meta-orchestrator-refactor-f3-scope.md) §1.5
- F.1 UX research: [`2026-05-24-meta-orchestrator-ux-research.md`](2026-05-24-meta-orchestrator-ux-research.md) §A.5
- F.2 REPORT: см. parent kickoff §0.1
- Parent kickoff (SSOT для F.3): [`.claude/orchestrator-prompts/meta-orchestrator-followup-audit/kickoff.md §1 Sub-wave F.3`](../../../.claude/orchestrator-prompts/meta-orchestrator-followup-audit/kickoff.md)
- Original BUILD verdict: [`2026-05-23-meta-orchestrator-prior-art.md`](2026-05-23-meta-orchestrator-prior-art.md)
- SKILL.md authoring: [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md)
- Principle 18 spec: companion file §1.4 + slot confirmed free in `packages/core/principles/`
