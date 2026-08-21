# KICKOFF — repo-hygiene-cleanup (снос легаси-популяции веток + worktrees)

> **Type:** execution-cleanup, 4 стадии (A→D) с независимыми гейтами и live-proof переписью после каждой.
> **Origin:** operator routing 2026-08-02 («полный аудит репозитория на мусор/легаси, отобрать однозначное»); переклассификация 2026-08-21 на свежем `origin/staging@10af733bc8` (клон отстал на 19 дней — см. report.md §7 Corrigendum). Полный аудит-артефакт с популяцией и методологией → [`report.md`](report.md) (этот же umbrella). Ничего до подтверждения стадий не удалялось.
> **Base branch:** staging (NOT main).
> **Rigor label (effort-worthiness L0):** `build-and-verify` — mass-deletion execution работа; каждая стадия завершается before/after census в PR body (verifying gate, не opinion).

## §1 Scope (population frozen 2026-08-21, verbatim from report.md)

Однозначно легаси — доказательная база в [`report.md`](report.md) §3:

1. **1098 definitely-legacy локальных веток** (report.md §3.1): 381 merged-into-staging (Class A) + 40 naming-artefacts (Class B: `backup/*`, `tmp-*`, `*-rebased`, `*contaminated`…) + 699 squash-merged без post-merge коммитов (Class D-safe; из 817 squash-merged 118 с post-merge коммитами исключены → Stage R).
2. **105 worktree на legacy-ветках — 6.7 GB** (report.md §4.1): подавляющая часть веса репозитория (11 GB всего).
3. **6 detached worktrees ≈ 2 GB** (report.md §4.2; на диске реально 4 из 6), из них 2 зомби-реестра с несуществующими путями (`/sessions/…/stg-gen`, `/tmp/rtt-probe`, оба locked — требуют `git worktree unlock`).
4. **.git hygiene** (report.md §5): 117 packs, 7268 prune-packable, 27 `tmp_obj_*` garbage, `.git/lost-found/` 740 файлов; 1 stale remote-tracking ref.

**ВНЕ популяции (не трогать этой амбрелой):**
- 69 protected имён (report.md §3.3): 5 открытых PR (#1149, #1216, #1217, #1230 dependabot; #1447 docs/host-verify-authoring-half-brief), `staging`, `main`, `master`, текущая checked-out ветка, 62 имени closed-unmerged PR. NB: PR #1215 (fix/zizmor) уже merged — ветка protected только как checked-out.
- 241 ambiguous ветка (report.md §3.2), включая 118 Class-D-not-safe (post-merge коммиты — возможна незалитая доработка либо tz-артефакт) — отдельный R-stage (§5 Stage R), НЕ этой амбрелой.

## §2 Permitted actions

- `git worktree unlock` (только 2 зомби) / `git worktree remove` / `git worktree prune`
- `git branch -d` (для merged Class A) и `git branch -D` (для Class B/D-safe — они unmerged-by-graph, `-d` откажет)
- `git fetch --prune` (ровно 1 stale ref: `origin/chore/adapter-jig-j3-redfix-kickoff`, слит в PR #1214)
- `git gc --prune=now` + удаление 27 `tmp_obj_*` garbage-файлов

**Категорически НЕ:**
- Любая ветка/имя из protected-списка (report.md §3.3).
- Любой worktree из ambiguous/protected маппинга (report.md §4).
- Удаление ветки, пока на неё указывает живой worktree (сначала worktree, потом ветка — §3).

## §3 Binding constraints (do not re-derive on stage)

1. **Порядок стадий обязателен:** worktrees → ветки → gc. `git branch -D` откажется удалять ветку, занятую worktree; частичные состояния путают census.
2. **Stage-гейт = census:** после каждой стадии в PR body пишется before/after: `git branch | wc -l`, `git worktree list | wc -l`, `du -sh .`, `git count-objects -vH`. Расхождение с прогнозом из report.md §2 — стоп и разбор, а не «двигаемся дальше».
3. **Class B/D-safe удаляются только по frozen-списку из report.md §3.1.** Регенерация списка НЕ замещает frozen: между аудитом и исполнением популяция могла вырасти — новые ветки классифицируются заново, а не удаляются по инерции.
4. **Никаких `git branch -D` «заодно»** для веток вне frozen-списка — даже если имя похоже на мусор.
5. locked-worktrees: `unlock` только для 2 зомби с несуществующими путями (report.md §4.2).
6. PR-subject: `chore(hygiene): …` — стадия в квадратных скобках.

## §4 AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Активные архетипы стадии: T3 (слепое доверие списку без перепроверки), T10 (не перемерить после шага), T14 (пропустить контрпример).

Domain-specific:

- **T-RHC-A — удалять ветки раньше worktree.** Git отклонит часть, census поедет; цикл «ветка → worktree → ветка» удваивает шаги. Контрмера: constraint §3.1.
- **T-RHC-B — верить дате как «работа слита».** Дата-эвристика (tip vs PR-merge) даёт tz-артефакты off-by-one день; именно поэтому 118 Class-D веток с post-merge коммитами исключены из популяции и вынесены в Stage R, а не «разобраны на лету». Контрмера: Stage R отдельная, verdict-per-branch.
- **T-RHC-C — массовый `-D` одной командой `xargs`.** Один отказ (ветка занята/защищена) в середине пайпа — состояние наполовину выполнено без census. Контрмера: пакеты ≤50 веток, census после каждого пакета (§3.2).

## §5 Stages

| Stage | Содержимое | Прогноз освобождения | Гейт |
|------|---|---|---|
| **A** (safe) | unlock 2 зомби → `worktree prune` → `fetch --prune` → remove 6 detached worktrees | ≈2 GB + чистый реестр | census: worktrees 126→~15 |
| **B** | remove 105 legacy worktrees (report.md §4.1) | ≈6.7 GB | census: worktrees → ~16 остаточных (13 AMB + 2 protected + main) |
| **C** | удалить 1098 веток из frozen-списка, пакетами ≤50, `-d` для A / `-D` для B+D-safe | 1372→~274 локальных веток | census: ветки; diff против списка = 0 остатка |
| **D** | `git gc --prune=now`, чистка 27 tmp_obj + lost-found | .git 533 MB → существенно меньше | `count-objects -vH`: packs→1-2, prune-packable→0 |
| **R** (отдельно, НЕ этой амбрелой) | 241 ambiguous: verdict-per-branch (`git cherry` для 118 not-safe, PR-сверка для остальных) | — | свой kickoff после C/D |

**Live-proof (итог PR):** финальный census в `done.md` + сравнение с report.md §2 (прогноз vs факт по каждой строке).

## §5.5 Host-verify contract ([destination-environment-verification.md §1](../../rules/destination-environment-verification.md))

Вся работа амбрелы — host-side (рабочий клон `/Users/art/code/rules-as-tests-aif`), НЕ в aif-контейнере: снос worktrees/веток/gc выполняется на host-клоне, контейнерного шага нет. Поэтому acceptance-контракт = census-команды ниже; dispatching session обязана прогнать их на HOST до закрытия каждой стадии (пороги — таблица §5) и вставить вывод в PR body. A green suite elsewhere is not evidence about the host.

```bash host-verify
cd /Users/art/code/rules-as-tests-aif
git worktree list | wc -l                          # гейт стадий A/B
git branch | wc -l                                 # гейт стадии C (~213 ± заведённые после аудита)
git branch --merged origin/staging | grep -vc '^\*\|staging$'   # остаток merged-хвостов → 0 после C
git count-objects -vH | /usr/bin/grep -E '^(packs|prune-packable|count|size-pack):'  # гейт D
/usr/bin/du -sh . .git                             # итоговое освобождение
```

If any host-verify step fails (census разошёлся с прогнозом §5), the dispatching session does NOT accept the stage: стоп, разбор расхождения, rework-round — см. §3.2.

## §6 §1.7 self-reflexive note

- **Forward-check:** comply с `build-first-reuse-default` — переиспользуется существующий tracked-exception механизм `report.md`/`kickoff.md` (`.gitignore` уже разрешает оба), ноль нового кода/хуков. Comply с `kickoff-staging-placement` §1 — до любого `/pipeline repo-hygiene-cleanup` или aif-dispatch этот kickoff должен быть смержен на `staging`; настоящий файл создаётся до dispatch, нарушение §1 отсутствует.
- **Backward-check:** аудит 2026-08-02 (снимок 2026-08-01) → переклассификация 2026-08-21 (см. report.md §7); ничего не supersede. Frozen-списки в report.md воспроизводимы командами report.md §6.
