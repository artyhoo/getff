# Night-mode execution prompt — deps-hash-multistack S2 → S3 (sequenced)

> **Copy-paste целиком в свежую Claude Code сессию**, затем скажи `/night-mode` (или сразу стартуй с `/pipeline deps-hash-multistack`). Этот файл — рабочий промт, не дизайн-док. Все факты перепроверены против `origin/staging` на момент написания (2026-07-18).
> **Why written (not inline chat):** umbrella состоит из 2 sequenced стадий с одним открытым fork'ом + 3 maintainer-decision точками + рекурсивными STOP-lines; держать это в голове fresh CC-сессии = потеря фактов → exactly тот drift, от которого проект защищает. Файл = single source правды для сессии.

---

## Готовый промт для CC night-mode сессии

```text
/night-mode

Задача: завершить umbrella `deps-hash-multistack` (kickoff #1016, R-phase LANDED).
DH-S1 уже на staging (PR #1024 + #1029 merged). Осталось: DH-S2 (rust) → DH-S3 (closure).

КОНТЕКСТ СОСТОЯНИЯ (read-only, ПЕРЕПРОВЕРЬ САМ через `gh pr list --search "deps-hash" --state all` и `git log origin/staging -- packages/core/hooks/deps-hash-check.sh`):
- kickoff: .claude/orchestrator-prompts/deps-hash-multistack/kickoff.md (binding §1 design, §2 stages, §4c park-don't-guess, STOP-lines)
- R-phase: docs/meta-factory/research-patches/2026-07-16-deps-hash-multistack.md (binding §1 deps-surface map, §2 two-tier ladder, §3 architecture fork)
- DH-S1 LANDED: JS-widen (7 полей) + python Tier-1 awk (6 таблиц, [project] excluded) + Tier-2 tomllib (sentinel для no-tomllib) + per-stack storage + 3-key seed template. Хук на staging = 212 строк.
- Round-3.5 fixes LANDED (#1029): CRLF gsub, python-upgrade sentinel, fresh-install-python seed — с regression-тестами (PYTHON-CRLF/UPGRADE-STABLE/FRESH-INSTALL).

РЕЖИМ: /night-mode. Сначала /pipeline deps-hash-multistack (plan-currency + launch-table + stage-gate), потом И-фаза S2, потом S3. НЕ создавай «мега-umbrella» — kickoff уже один, stages sequenced (kickoff-staging-placement.md §1).

ЖЁСТКАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ (не меняй порядок без recorded reason):

### STEP 1 — /pipeline deps-hash-multistack
Запусти skill, дай ему:
- §1 plan-currency: подтвердить DH-S1 LANDED (#1024+#1029 merged, done.md ОТСУТСТВУЕТ = umbrella открыта).
- §3 launch-table для DH-S2 и DH-S3 отдельно (NE collapse — kickoff §2 STOP-line «do NOT collapse»).
- §6 stage-gate: DH-S1 → DH-S2 (DH-S1 merged, pass).

### STEP 2 — DH-S2 (rust detection)
Ветка: feat/deps-hash-multistack-dh-s2 (от свежего origin/staging после `git fetch`).
TDD (RED-before-GREEN per kickoff §3):
1. RED-тесты в packages/core/hooks/deps-hash-check.test.ts: Cargo.toml с [dependencies] version drift → deps-hash-cargo WARN; matching → silent; workspace inheritance (foo={workspace=true}); tier-2 cargo-metadata degrade (no cargo → silent Tier-1); @dual-pair byte-identity preserved.
2. Hook impl: Tier-1 awk table-boundary для rust-таблиц [dependencies]+[dev-dependencies]+[build-dependencies]+dotted sub-tables+[target.*.dependencies…]+[workspace.dependencies] (НЕ [features] — R-phase §1 line 56; features = cosmetic config, не dep change). Tier-2: `cargo metadata --no-deps --format-version 1 --offline` (НИКОГДА --frozen/--locked; non-zero exit → silent Tier-1 degrade). deps-hash-cargo: читается через _read_stored (no legacy fallback — cargo new in DH-S2). CRLF gsub уже в awk — reuse pattern.
3. SIZE-GATE FORK (КРИТИЧНО — это ОТКРЫТЫЙ fork, НЕ решай молча):
   - Измерь hook line count ПОСЛЕ impl.
   - ~180 = kickoff §2 soft threshold. Хук уже 212 на staging (ДО S2). После rust Tier-1 (~+30-40 строк) будет ~240-250.
   - FORK: (A) ≤220 → "Option A holds, one hook" (запиши verdict в PR body); (B) >220 → "size-gate fired, split" → выполнить split per kickoff §2 DH-S2 route B (three hooks + lib-delivery decision — ВНИМАНИЕ: lib delivery violates no-lib STOP-line install.sh:421-422, поэтому split = три self-contained hooks, НЕ shared lib).
   - ЕСЛИ fork реален (B) → СТОП, park как вопрос мейнтейнеру через AskUserQuestion (A hold / B split). НЕ выбирай сам — это architecture decision, night-mode delta item 1 говорит «technical fork → resolve with rationale» если есть determinate answer, иначе park.
   - ПРОВЕРЬ ЭМПИРИЧЕСКИ: реально ли добавление rust Tier-1 держится в одном hook maintainably, или matcher становится нечитаемым. Запиши measured verdict.

### STEP 3 — DH-S3 (closure)
Ветка: feat/deps-hash-multistack-dh-s3 (от staging ПОСЛЕ DH-S2 merged — stage-gate обязателен).
Deliverables (kickoff §2 DH-S3):
1. tomli shim для python 3.7-3.10 (try: import tomllib except: try: import tomli as tomllib except: degrade). Сейчас DH-S1 использует sentinel — shim должен preserves sentinel-equivalence (tomli payload должен == tomllib payload для того же pyproject — verify byte-match).
2. Polyglot integration test: package.json + pyproject.toml + Cargo.toml все present → три independent hashes + три WARNs в одном combined _emit_warn (НЕ три объекта — ZCode JSON.parse ломается, round-2 §3a M2).
3. install-sh python-seed variant: tests/install-sh/tool-decisions-seed-integration.test.sh gains python-seed assertion (backward-sweep: JS-only assertion stays green, add sibling). ATTENTION: c1-wiring.test.sh C1-548-neg уже зафиксирован под 3-key seed (#1029) — не сломай.
4. Hook header comment: documented blind spots explicit (lockfiles, pnpm v11 pnpm-workspace.yaml, git-deps-without-rev, path-deps, CRLF-fixed, sentinel-for-no-tomllib).
5. done.md: .claude/orchestrator-prompts/deps-hash-multistack/done.md — ТОЛЬКО на DH-S3 final-PR merge (STOP-line). Содержит: что выполнено, какие fork'и разрешены, blind spots accepted, ссылки на все PR'ы (#1016/#1024/#1029 + S2/S3).

ИТЕРАТИВНОЕ ДВОЙНОЕ РЕВЬЮ (обязательно для каждого meaningful increment — это устоявшийся метод этого umbrella):
- Commit A (RED-тесты) → top-down + bottom-up cold-context review (fresh Agent calls, 2 параллельно).
- Commit B (hook impl + mirror + SSOT docs if any) → то же.
- Commit C (S3 increments) → то же.
- ИТЕРАЦИЙ ДО GO обоих. Round-3.5 опыт показал: cold-context ловит BLOCKER'ы (CRLF, python-upgrade, fresh-install-python), которые self-review + 23-test suite пропускают — все три были invisible автору.
- Каждый finding перепроверяй командой перед фиксом (night-mode §5: empirical over inferred).

HARD-CHECK КРИТЕРИИ (kickoff §3 + §2 STOP-lines):
- npm --prefix packages/core run test:principles → green
- npm --prefix packages/core run test:hooks → green
- npx vitest run packages/core/hooks/deps-hash-check.test.ts → all green (расширяется per stack)
- bash tests/install-sh/byte-identical.test.sh → green (regenerate baselines если hook/template fingerprint меняется)
- bash tests/install-sh/c1-wiring.test.sh → 12/12 (не сломай C1-548-neg)
- bash tests/install-sh/tool-decisions-seed-integration.test.sh → green
- @dual-pair byte-identity (packages/ ↔ .claude/) preserved
- shellcheck clean, format:check clean
- PR body: §1.7 forward+backward (enumeration format, ≥1 non-diff surface) + Prior-art trailer
- lychee offline link check на changed *.md (pre-push hook) → 0 errors

ОСОБЫЕ ПРЕДОСТЕРЕЖЕНИЯ (выученные инциденты из этой сессии):
- НЕ используй `git diff origin/staging..HEAD` для «что в моём PR» на устаревшем local ref — используй `gh pr diff <N> --name-only` (truth source). Local ref может отставать на # чужих PR'ов.
- НЕ merge если хоть один extraneous CI check красный из-за flake — сначала rerun именно эту job (`gh api -X POST repos/.../actions/jobs/<id>/rerun`), дождись green, потом merge. Branch protection требует ci-success context.
- Если кто-то (параллельная сессия) сделал `git checkout` на твоей ветке → твой worktree сбросится. `git worktree list` + `git stash -u` перед switch.
- Untracked-файлы параллельных сессий (например 2026-07-18-*-*.md research-patches БЕЗ §1.7) ломают pre-push principles/13 check. Паркуй их `mv` во /tmp перед push, возвращай после.
- Round-3.5教训: все test-фикстуры пишутся через writeFileSync('utf8') = LF-only; для cross-platform (CRLF) и multi-python coverage нужен EXPLICIT test — не полагайся что «default env покрывает».

ВЕРХНИЙ ПРИНЦИП: umbrella mission = «generated executable rules don't go stale» — staleness detector должен покрывать all three live-generation stacks (js/rust/python). После S2+S3 это достигнуто. Если в ходе S2 fork (B=split) срабатывает — это нормально, миссия не меняется, меняется только архитектура (3 hooks вместо 1). done.md закрывает umbrella независимо от A-vs-B исхода.

БАЗА: staging. НЕ запускать пока /pipeline не подтвердит plan-currency + stage-gate.
```

---

## Что этот промт гарантирует (и чего НЕ гарантирует)

**Гарантирует:**
- Правильный порядок (S1 уже done → /pipeline → S2 → stage-gate → S3 → done.md).
- maintainer-fork (S2 size-gate A-vs-B) припаркован как AskUserQuestion, не решается молча.
- STOP-lines (no-lib, _emit_warn preserved, always-exit-0, @dual-pair same-commit, no TOML-parser dep, no setup.d/NN-rust.sh, done.md только на S3) — явно перечислены.
- Итеративное двойное ревью на каждый increment (устоявшийся метод).
- Выученные инциденты (CRLF/python-upgrade/fresh-install/local-ref-staleness/flaky-CI/parallel-checkout/untracked-§1.7-breaks-pre-push) — чтобы fresh сессия их не повторяла.

**НЕ гарантирует (и не должно):**
- Что fork разрешится A (one-hook) — это решит измерение на реальном rust-Tier-1 matcher'е + твой ответ на AskUserQuestion.
- Что не появится новый edge-case (night-mode для того и нужен — автономно park'нуть и продолжить unambiguous parts).
- Что параллельные сессии не внесут хаос в worktree — промт даёт mitigation (worktree list + stash), но не иммунитет.

## Что нужно сделать тебе перед запуском

1. **Создай файл** `docs/meta-factory/2026-07-18-deps-hash-multistack-S2S3-night-prompt.md` (этот контент) — он уже written (см. ниже commit). fresh CC-сессия сможет его прочитать как reference.
2. **Открой свежую Claude Code сессию** в том же repo.
3. **Скопируй блок внутри ```` ``` ```` (вся `Задача: ...` до `БАЗА: staging.`)** как первый user-prompt.
4. **Дай сессии автономию** — night-mode delta item 1: technical fork → resolve с rationale, genuine owner fork → park + продолжить unambiguous parts. Единственная точка где промт говорит «СТОП и спроси» = S2 size-gate fork (если measured verdict не determinate).
5. **Мониторь утром** — morning report в конце сессии покажет что смержено, какие fork'и запаркованы, какие BLOCKED.

## Альтернатива: если хочешь меньше автономии

Удали из промта строку `РЕЖИМ: /night-mode` и добавь `СТОП перед каждым merge — жди моего подтверждения`. Тогда сессия подготовит PR'ы + прогонит ревью, но не смержит без тебя. Это безопаснее, но теряет night-mode value (завершение без тебя).
