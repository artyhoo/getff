<!-- scope:docs-single-source-operator-log -->
# Docs single source — operator statement log (OP-1 … OP-53)

> Scope: the operator's own words behind every decision of
> [2026-09-30-docs-single-source-design.md](../../superpowers/specs/2026-09-30-docs-single-source-design.md),
> copied verbatim from the coordination draft `_design-2026-09-28-truth-pipeline.md` (§1 and §9.1),
> which lives outside the repo and is not durable. Quotes stay in the operator's language
> (Russian); framing is English. File names starting with `_` are those coordination drafts; they
> are named for provenance, not as links.

## Problem

A fork of this design is decided only by an explicit operator choice, and each choice is
recorded verbatim. The record lived in a coordination draft outside git. Landing the design
without it would leave the spec's OP-n references unresolvable.

## Root Cause

The design ran across several sessions (d8951494, fork 20101d28, 378bf98b, 0e56bb78) in a
discussion-only mode with no repo edits, so the log could only live in coordination files.

## Solution

Copy the log into the repo as this append-only record. OP-1 … OP-17 are the r1-r3 premise
register (draft §1, faithful to meaning); OP-18 … OP-53 are the r4 statement log (draft §9.1,
verbatim, newest last).

### Premise register, r1-r3 (draft §1)

- OP-1 (2026-09-28): the project is confusing; «документация у нас врет и вводит в заблуждения а
  разобраться самому очень сложно».
- OP-2: everything installs with ONE button.
- OP-3: the docs lie because AI writes them and nothing checks them against code («Потому что человек
  точно не пишет»).
- OP-4: the docs site already runs on one source of truth; integrate with it so nothing diverges.
- OP-5: docs, the project passport and architecture are ONE process, and all of it shows on the
  docs site; the getff-ai-site session is already working on the site.
- OP-6 (`/arch` ask): «давай продумаем дизайн и архитектуру решения как сделать лучше» — improve on
  the integration note, not just restate it.
- Inherited site premises (site spec §3): P-B a human writes nothing; P-D one criterion of truth;
  P-AB one source of truth, preferably the documentation itself; D12 a fact found in two places is
  deleted, not synced.
- OP-7 (round 2, 2026-09-28, on E1): «цель проекта может плавать в таких случаях кажется нужно
  обсуждать ее с оператором - может быть такое только по инициативе человека должно быть? Или
  например ии сам пишет это противоречит цели или это отходит от цели и тогда надо либо расширить
  цель проекта либо обсудить либо отказаться от фичи». Meaning: the goal can drift. Changing it is a
  conversation with the operator, possibly only on the human's initiative. The AI's part is to say
  «this contradicts / departs from the goal», which then leads to one of three outcomes: widen the
  goal, discuss, or drop the feature.
- OP-8 (same message): «Кажется проект перерос свою цель верно?». The operator suspects the project
  has outgrown its stated goal. This is being checked by the goal-vs-reality inventory (§6.8, in
  flight).
- OP-9 (round 3, 2026-09-28): «есть моменты которые расширяют цель и это ок и есть моменты когда
  это меняет цель ей противоречит и тогда тут вот нужно точно согласование - но и первое тоже как
  будто бы расширение уточняет цель проекта и ты лучше сам будешь ее понимать». Meaning: two
  cases, two paths.
  - Extending the goal is fine and needs no strict approval. It should still be recorded, because
    each extension refines the goal and helps the AI understand it.
  - Changing or contradicting the goal needs strict approval.
- OP-10 (round 3, 2026-09-28, on the teach-back guard): «копия твоей фразы кажется норм - я же
  получается что прочитал раз копирую верно? короче нужно подумать как будет удобнее». Meaning: the
  operator doubts that copying the AI's sentence should be rejected, since copying implies reading.
  The consent form should be convenient. Open as T12.6.
- OP-11 (same message), the next-session agenda: after compaction, summarise and re-discuss the
  whole design of this session. The questions: how it integrates with living documentation and the
  docs site, and the idea as a whole.
- OP-12 (post-compaction, 2026-09-28): «это то и цель сессии … мы решаем судьбу Паспорт и
  архитектура проекта пользователя при установке проекта пользователем … Я за то чтобы все
  интегрировать и сделать хорошо … но не забывай про основную цель этой сессии». Meaning:
  - the consumer passport and architecture at install time are THIS session's core question, the
    answer this session owes the main one-button design session;
  - the truth pipeline and goal governance must also be done, but they are secondary;
  - the author's proposal to split T6 off into its own contour is withdrawn.
  The consolidated passport proposal lives in `_decisions-2026-09-28-one-button-round2.md` §4.
- OP-13 (same day, before the 4th compaction): «Почему до 5 строк?», and «А для этого проекта это
  все будет интегрировано будет иметь один источник без дублирования? для всего?». Meaning: the
  operator wants one source with no duplication for EVERYTHING in the getff repo itself, not only
  in the consumer project. This opens T13, self-application. The «≤5» question is answered in
  `_decisions-2026-09-28-one-button-round2.md` §4 (P4: a content rule instead of a number).
- OP-14 (after the 4th compaction, 2026-09-28): «мне кажется мы уже идем по кругу и зациклились
  вернулись к исходу … многое из исследований и выводов тупо проскипав … ведь было уже задизайнено
  как интегрировать все с сайтом документации верно?»; «ии из за дублирования и усторевания все
  время запутывается у нас в проекте и это тоже очень важно решить». Meaning:
  - post-compaction recaps re-derived settled work and felt like a restart. The site integration
    was already designed (rounds 1-3) and is not reopened;
  - duplication and staleness inside the getff repo itself confuse AI agents. Fixing it is very
    important, so T13 is not a side item;
  - the operator asked for a final summary of the whole session.
- OP-15 (after the 5th compaction, 2026-09-28), three answers to lines of the final summary:
  - On «a goal change lands only after your own restatement»: «да копии норм разве нет? И на
    расширение тоже нужно согласие же это же важно». Meaning: a copy of the AI's sentence counts as
    consent (T12.6 closed, second time after OP-10), and an EXTENDS needs the operator's consent too,
    so the light path loses its «no approval card» property (T12.5 amended).
  - On «invariant: the project checks itself with its own rules»: «Да конечно должно рекурсивно на
    самом себе … это принцип нашего проекта!». Meaning: T13 is answered YES. Everything getff ships
    to consumers as «one source per fact» applies to the getff repo itself; there is no «public
    story first» carve-out.
  - On the `@AGENTS.md` import for consumers with their own CLAUDE.md: «Конечно!». Recorded in the
    decisions file §4.
- OP-16 (same day, next message): «Кажется на расширение цели можно и без согласия сделать да?
  Давай ставить удобство все таки на первую очередь очень неприятно когда постоянно палки в колеса
  фреймворк ставит - все должно быть максимально автоматически - и только в самых узких местах где
  это действительно критично и важно нужно тревожить оператора». Meaning:
  - an EXTENDS needs no consent; the OP-15 amendment to T12.5 is reverted to OP-9's light path;
  - a design principle for the whole design, not only the goal: convenience first. Every human
    touchpoint must justify itself as critical and narrow; everything else is automatic, with an
    FYI and a one-step revert instead of a question. The design is re-read against this lens
    (changelog OP-16).
- OP-17 (same day, next message): «Почему ты соглашаешься со всем? мне не нужно пассивное согласие
  я хочу чтобы было как можно лучше». Meaning: the author flipped T12.5 twice in two messages to
  follow the operator's latest remark (OP-15 added consent for extensions, OP-16 removed it) without
  stating an own view. The operator wants the author's best judgment, argued, including
  disagreement. The author's own re-assessment after OP-17 is in the changelog: convenience-first
  stands, but the fully automatic version had a ratchet hole (fixed in T12.2), and two OP-16
  passport simplifications needed a guard (decisions file §4, OP-17 block).
- Resolved in round 2: E2 (README's reader) and E3 (external-binary checks at pre-push); see §4.
  E1 stays open and grows into T12 (goal governance).

### Statement log, r4 (draft §9.1)

- **OP-18 (2026-09-29, advisor log entry 30c).** «А документация вот этот паспорт и архитектура
  будет интегрирован или взят тот же дизайн что и с документации сайта документации? Один источник
  истины для всей документации будет всегда? Это есть в постовляемых правилах и принципах
  документации  проектов?»
- **OP-19 (2026-09-29, advisor log entry 31 part 1; THE ASK of r4).** «Смотри го 2 отдельные дизайн
  сессии - задача 1 во первых документация для ии должна посмотреть как сделано будет на сайте
  документации - там крутая задумка - и нужно будет как то интегрироваться или хотя бы вдохновится
  и вообще связать их + документацию нужно будет обновить - потому что там уже легаси получается и
  сделать так чтобы вообще всегда была актуальной с одним источником истыны - и один источник
  истины для документации всей (для ии и человека) это принцип который должен быть в проекте и
  поставлятся консьюмерам»
- Decisions made elsewhere that bind r4 (advisor log, not re-asked here):
  - entry 21 / entry 26 point 9: the agent drafts the passport into the existing
    `.ai-factory/DESCRIPTION.md`; the button does not stop; «No .getff/intent.md, no writer script,
    no hash. Protecting «must never» lines belongs to the truth-pipeline design.»
  - entry 28: fork 1 = A, the project's own setup wins; fork 2 = B, no version pins.
  - entry 2: «только у нас свое у потребителя под свое!» (same mechanisms, different content).
  - OP-15 (r3): the `@AGENTS.md` import is approved («Конечно!»). Never withdrawn.
  - OP-16 (r3): convenience first; a human touchpoint must justify itself.
- (Statements made to THIS session are appended below as they arrive.)
- **OP-20 (2026-09-29, this session; answer to fork F1).** «А»
- **OP-21 (2026-09-29, this session; same message, opens fork F6).** «у нас кажется есть скил автор
  докс которые уже работает для getff  для ведения документации его + заодно на сайте пишет, а если
  его немного сделать более общим для любой документации либо наоборот сепарировать на две части -
  ту которую поставляем и у себя используем и ту которую только у себя для ведения сайта? Типа
  разделить на скил который ведет документацию внутрению и который пишет на сайте? А еще может
  готовое уже что то есть у клода или плагинов спутников наших? чтобы конкретно по стандарту писал
  с одним источником истины чтобы дублирования небыло чтобы не нужно было несколько версий вести -
  короче источник код, а доки автоматически обновляются - например цифры просто из кода берутся как
  на сайтах типа по апи или еще как то»
- **OP-22 (2026-09-29, this session; answer to fork F6).** «Её ведёт другой скилл, ai-doc. Он уже
  поставляется (ships.manifest:34). Но и он не говорит автору «этот факт рендерится, руками не
  пиши». - ну так может это недопущение и нужно исправить и использовать его и там тоже? Он не
  подходит для переиспользования или адаптирования? ai-doc про документы для ИИ - это очень
  хорошо, предлагаю гибрид А + В  добавить скил для человека. - хотя кажется docs-author как раз и
  есть скил для человека верно? суть в том что очень дружелюбна документация для ии должна быть и
  иметь общий источник как у нас это реализовано будет на сайте? Как будет генерироваться и
  обновляться документация? Может обобщить подход ? и бест практисы короче у спутников 100% есть
  готовое  и хорошее либо у клод кода
  ai-doc чем не кандидат?»
- **OP-23 (2026-09-29, this session; two decisions on satellites + answer to fork F2).** «mattpocock
  `writing-for-agents`, раздел Pruning: «Keep each meaning in a single source of truth». Беру
  словарь оттуда. Но это только текст, проверки в нём нет. - ну так скил то есть почему бы не
  использовать ?  ну адаптировать под проект
  pfeff `diataxis`: готовый скилл для человеческих документов. Потребителям мы его сейчас не
  предлагаем, в списке спутников его нет - так можем поставлять ради документации - почему нет?
  Есть готовое круто когда можем поставлять для своих целей - возможно немного адаптировав
  А - только перепровь сессию сайта»
- **OP-24 (2026-09-29, this session; two questions + answer to fork F3).** «в том же плагине лежат
  скиллы, которые у нас запрещено вызывать. - почему?
  `diataxis`. Добавляем строкой в список спутников, по желанию. Нет плагина, установка идёт дальше.
  Риск: у репозитория 2 звезды и один автор. а получше нет источника и скила?
  ну на пару строк можно и тест защитный да А»
- **OP-25 (2026-09-29, this session; answer to fork F7 + a question).** «domain-modeling
  предлагает писать ADR там, где мы их не ведём почему? может стоило бы?
  addyosmani может тогда сразу им заменить полностью diataxis везде? Я за!  а там где нужно типы
  страниц: учебник, инструкция, справка, объяснение - пишим свой на основе diataxis - так надежнее
  будет и оптимальнее можно одну отдельную сессию под создания скила завести под это дело - а
  может у наших скилов и спутников есть альтернатива?»
- **OP-26 (2026-09-29, this session).** «А мы вообще по /arch проектируем дизайн?
   Папка ADR стала бы третьим домом для тех же решений. Это ровно «факт в двух местах», который мы
  сейчас убираем.-  а может это могло бы быть как раз отличным источником истины для всех? Просто
  предпологаю? расматривался такой вариант и почему нет?
  разве спутник з AI Factory мы не ставим? отказались да?
  Ну короче мы расматрели варианты го думать как сделать лучше будет»
- **OP-27 (2026-09-29, this session; a process correction).** «не просто соглашайся со мной я хочу
  с тобой все обсудить я не знаю как лучше ты пока возможно тоже нам вместе нужно это выяснить
  подумав и обсудив хорошенько
  Мы же кажется не просто так ADR решили не ставить везде - не решай что-то как уже принятое»
- **OP-28 (2026-09-29, this session).** «А как сделан будет сайт документации от туда идею нельзя
  взять? И вообще полностью перескажи чем мы тут занимаемся /story»
- **OP-29 (2026-09-29, this session).** «ну получается карточка фактов первоисточник истины? и
  дублировать его нельзя или я что то не понимаю? Или скорее источник то на чем основывается
  карточка фактов? ну так тогда можно на карточке фактов основываться раз она основывается на
  источнике истине так же тоже норм уже дублирования не будет меняется одно меняется все!
  И для документации уже можно основываться на том же что генерирует ии - для людей доки, зачем
  переизобрать? есть же уже готовый механизм опять же и дублирования нет один первоисточник
  остается !»
- **OP-30 (2026-09-29, this session).** «а как в документации это сделано будет? нужно чтобы
  работало! иначе разайдется документация везде опять!»
- **OP-31 (2026-09-29, this session).** «в документации должно было быть реализовано как при
  генерации документации типа в свагере например - идея оттуда  для ии  который это уже
  перерабатывает один раз и сохраняет + для человека
  Возможно как в дип вики делается нужно посмотреть?»
- **OP-32 (2026-09-29, this session; a process correction).** Quoting the author's «По твоему
  правилу пропущенная карточка берёт рекомендацию. Записал В.», the operator wrote: «убери это
  правило». Effect: a fork is decided only by an explicit operator choice; a question or
  silence leaves it OPEN. F9 is re-opened.
- **OP-33 (2026-09-29, this session; answer to fork F10).** «А для нас а для сайта Б который
  берез из А как сделано сейчас у них»
- **OP-34 (2026-09-29, this session; corrects the author's reading of OP-33).** «нет все таки
  для сайта у нас есть же два типа документации для ии и для людей, почему для ии нельзя
  переиспользовать для ии а для людей для людей в документации проектов я не понимаю !»
- **OP-35 (2026-09-29, this session; answers F9 and F10, sets the process).** «9  В, следить за
  якорями. Страница привязана к именованным местам источника. Тревога только когда изменилось
  именно это место. Агент переписывает только эти страницы. - ну да кажется можно определить
  для каждой доки за чем следить конкретно согласен
  10 А
  и го /arch  раундами»
- **OP-36 (2026-09-29, this session).** «ты хорошо подумал перед раундами?»
- **OP-37 (2026-09-29, this session; answers the re-asked round 1).** «1 Б но и на винде и маке
  чтобы тоже работало, может есть более популярная и надежная альтернатива?
  2А
  3 А
  А на предыдущие вопросы уже не надо отвечать?»
- **OP-38 (2026-09-29, this session; answers round 2 and hands the dialogue over).** «1 Б
  2 А
  3 А если достижимо и не геморно
  ТАк давай продолжим в новой сессии создай чип там обсудим все по правилам /arch только в
  общем виде -   ты же  после сжатия контекста будешь сессий помошником предоставляющим ей
  факты что ты уже все накопал и капать дальше будешь если надо - так что сейчас стоп»

- **OP-39 (2026-09-29, new design seat; answers the top-level round 1).** «❓ Q1
  1 Как на сайте документации сделано? кажется тут должно быть что то типа свагера да?типа
  машинописный апи фактов - спроси у сессии помошника она знает о чем я
  2 да как на сайте докуентации - это должен быть один механизм и источник истины либо схожий
  3  Да
  4 да карточками  про АДР хз а как же /arch будет работать у постовщиков без него? Или тут я
  путаю доку с скилами - скорее всего
  5 источеские записи главное чтобы не путали ии
  Короче по всей инфе к помошнику своему обращайся
  ❓ Q2 Да б
  ❓ Q3 — ну хз почему? получается она остается пустой? Кажется мы решили что что то касаемо
  проекта например генерируемые правила можно и в .claude/rules/ - только кажется это не ии
  агностично, а если у него не клод? Ну короче в папку rules, а то что мы базовое кладем в Б
  или просто то в зависимости от классификации какой то, что просто как правило туда, либо
  общие базовые которые всегда в контекте -  то что как тест хук скрипт в другое место -
  короче хз как лучше - это не мое утверждение тебе нужно решить куда лучше  или не тебе?
  Кажется у нас же есть уже стандарт какой то типа AIF например агностичный я хз короче как
  лучше сделать? ты мне помоги и ответь
  ❓ Q4 А»

- **OP-40 (2026-09-29, new design seat; answers round 2).** «0 да слой фактов!
  1 или паспорт? ну А только перепроверь что не путаем
  2 А
  3 А
  4 А главное чтобы ии не путало!»

- **OP-41 (2026-09-29, new design seat; answers round 3 and corrects two statements of the
  seat).** «У getff паспорта нет. - так будет потому что будет тоже что и у консьюмеров - это
  уже проектируется
  . Хук inject-session-bootstrap.sh печатает цель getff - да это нужно будет пофиксить
  адаптировать для потребителей под их проекты + для своего
  1 Установщик сразу все делает это уже проектируется, под каждый стек ии сам генерирует -
  ставится только общее для всех  со всей обвязкой сразу общие принципы правила их тесты хуки
  скрипты скилы плагины и тд ставит готовую БАЗУ а остальное генерирует из нее  - это прям
  сейчас проектирует сессия установки в один клик
  2 Б Кажется мы решили переиспользовать же? Спроси у помошника для ведения документации
  есть скилы или должны быть!
  3 А
  4 А»

- **OP-42 (2026-09-29, new design seat; answers round 4 Q1 and points at an earlier
  decision).** «docs-author у помошника спроси мы там решили поменять его немного другой скил
  использовать вроде спроси инфу!
  1 А»

- **OP-43 (2026-09-29, new design seat).** «блин не помню но мы это точно обсуждали в
  сессиях помошников можешь найти?»

- **OP-44 (2026-09-29, new design seat; on round 5 and a change of roles).** «вот addyosmani
  короче тут надо подумать как сделать лучше финальный же вопрос? Го подумаем как сделать
  лушче
   дальше ревью и работу ведет твой помошник, твоя роль теперь консультант и советник ты
  окаешь следишь чтобы не отошол помошник от идеи и следишь за ним и решаешь сложные развилки
  пиши хендов и письмо промошнику пусть работает патерн советника найди в проекте и используй
  на себе роль адвенсера»

- **OP-45 (2026-09-29, lead seat = session «Design: one source of truth for all docs (AI +
  human)»; confirms OP-44 in the lead's own session).** Answer to the button question «Беру
  ведение дизайна, а соседняя сессия становится советником?»: «Да, веди (А)». From here on the
  lead records operator statements.

- **OP-46 (2026-09-29, lead seat; answers the F7-skill card).** Answer to the button question
  «Что добавляем к нашему ядру скилла для человеческих документов из addyosmani?»: «А: ядро +
  узкая часть».

- **OP-47 (2026-09-29, lead seat; answers the r6-review MAJOR-10 card, register row B-Q2).**
  Answer to the button question «Что делать с голым путём к файлу (ссылка без названного
  места)?»: «А+: твоё А + проверка новых (Recommended)».

- **OP-48 (2026-09-29, lead seat; answers the r6-review ESCALATED-1 card, new row SCOPE-U).**
  Answer to the button question «Входят ли память агента и черновики координации в «всю
  документацию»?»: «А: память узко, черновики нет (Recommended)».

- **OP-49 (2026-09-29, lead seat; typed, mid-turn after OP-48).** «го чип отдельный на очистку
  памяти от мусора». Done: chip `task_d7593d93` «Clean the agent memory of stale and restated
  facts», applying SCOPE-U (OP-48) to the memory dir, backup first.

- **OP-50 (2026-09-29, lead seat; answers the r7-review MAJOR-C card, widens row B-Q2).** Answer
  to the button question «Проверять ли значения, вписанные в документ без ссылки на источник?»:
  «А: та же проверка на PR (Recommended)».

- **OP-51 (2026-09-29, lead seat; approves the top level).** Answer to the button question
  «Одобряешь ли верхний уровень дизайна «один источник правды для всей документации» (версия
  r8)?»: «А: одобряю (Recommended)». Approved text frozen as
  `_design-docs-ssot-top-level-r8-approved-2026-09-29.md` (sha256 prefix `6b4b25d17f00a4d7`).

- **OP-52 (2026-09-30, lead seat; answers the landing / execution card).** Answer to the button
  question «Что делаем с одобренным дизайном дальше?»: «А: сажать сейчас, срезы в фабрику
  (Recommended)». Option A text: a docs-only staging PR (spec + evidence research-patch) now;
  implementation in slices through the aif factory with Opus verification, when the factory is
  reachable; HO-1..HO-9 wait for the one-button second wave.

- **OP-53 (2026-09-30, said in the advisor's session, relayed as advisor entry E9).**
  «переноси в репозиторий спекой сейчас» — answer to the advisor's question «переносить дизайн
  в репозиторий спекой сейчас или позже».

## Prevention

- The next OP id is **OP-54**. A later decision about this design is appended to a new
  research-patch (patches are append-only), not to this file.
- A spec line that cites OP-n must resolve here; a reviewer checks each cited id against this
  log.

## Tags

`docs-single-source`, `operator-log`, `decision-record`, `arch`

## §1.7 self-review

- **Forward check.** Every OP id the spec cites (OP-9, OP-10, OP-15, OP-16, OP-42, OP-47,
  OP-48, OP-50, OP-51, OP-52, OP-53) is present above (checked by grep per id).
- **Backward check.** Copied by line range from the draft, not retyped; only heading levels
  were demoted to fit this file.
- **Limits.** OP-1 … OP-17 were written «faithful to meaning», not verbatim (the draft's own
  §1 heading says so); OP-18 onward are verbatim.
