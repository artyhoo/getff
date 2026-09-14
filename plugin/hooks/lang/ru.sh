#!/usr/bin/env bash
# @cc-only-rationale: language pack (payload prose) for the two internal reminder hooks — not shipped to consumer projects via install.sh
# @dual-pair: hook-lang-i18n
#
# Russian payload pack for end-of-turn-reminder.sh + ask-question-reminder.sh.
# Sourced by the hooks when AIF_HOOK_LANG=ru. Each aif_msg_* function emits one
# reminder body; ${anchor} is resolved at call time from the hook's scope.
# Companion: lang/en.sh (canonical default). Key parity enforced by
# lang/check-parity.sh. See docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md.
#
# shellcheck disable=SC2154  # ${anchor} is assigned by the sourcing hook (dynamic scope), not here.

# Recap heading the end-of-turn hook greps for (already-recapped guard) AND embeds
# in the recap instruction. Guard ↔ message stay consistent because both read this.
AIF_RECAP_MARKER='## 🟢 Простыми словами'

# Russian phrasings of the trailing-fork detector (sibling of en.sh; same key).
# Category-3 match-data: matches the operator-facing turn text, which is Russian
# when AIF_HOOK_LANG=ru. Used by end-of-turn-reminder.sh Branch B.
AIF_EOT_QUESTION_PATTERN='выбирай|реши сам|какой (вариант|подход)|выбери|хочешь чтобы'
AIF_EOT_SEC_WHERE='**Где мы.**'
AIF_EOT_SEC_CHANGED='**Что изменилось.**'
AIF_EOT_SEC_FORK='**Развилка.**'
AIF_EOT_SEC_UNSURE='**В чём не уверен.**'
AIF_EOT_SEC_NEXT='**Дальше.**'
AIF_EOT_ME_PREFIX='Я:'
AIF_EOT_FOR_YOU_PREFIX='От тебя:'
AIF_EOT_FOR_YOU_NOTHING='ничего (<чем проверишь, если захочешь>)'
AIF_EOT_FOR_YOU_WAITING='ждём: <что и от кого>'
AIF_EOT_FOR_YOU_DECIDE='решить: <A> или <B>'
AIF_EOT_FOR_YOU_HANDS='сделать руками: <одно действие>'
# Both languages' offloading verbs, in BOTH packs: an operator on AIF_HOOK_LANG=ru still
# reads English answers, so a ru-only list left "review the diff and make sure it is fine"
# undetected in the very pack this operator runs (final review M-4).
AIF_EOT_FOR_YOU_BANNED='проверь|ознакомься|убедись|посмотри|check that|review the|make sure|take a look'
# Ярлыки дефектов. Каждый — САМОописательная фраза, никогда не голый токен и не сырой
# regex: ворота склеивают их в один список через «; » под нейтральным глаголом, поэтому
# ярлык, который просто называет вещь, читается моделью как «допиши это».
AIF_EOT_MISSING_LABEL='нет секции:'
AIF_EOT_BANNED_LABEL='последняя строка просит человека проверить/посмотреть — это твоя работа, не его'
AIF_EOT_MALFORMED_LABEL='последняя строка не равна ни одному из четырёх значений (а у «ничего» нужен след проверки в скобках)'
AIF_EOT_CAP_LABEL='длиннее лимита строк:'

# Fallback value for the session-goal anchor when extraction fails.
aif_msg_eot_anchor_fallback() {
  printf '%s' '(цель сессии не извлеклась — назови её сам)'
}

# PreToolUse:AskUserQuestion — pre-question fork-challenge. Item 3 CALLS the shared
# aif_msg_fork_card instead of restating the fork contract in its own words: two
# hand-kept copies of one contract is #sync-by-copy-paste
# (.claude/rules/dual-implementation-discipline.md §8). The heredoc is built in
# three deliberate parts: part 1 is a quoted heredoc so the backticks around
# `superpowers:brainstorming` can never execute as a command; part 2 renders the
# shared card, indented three spaces so its own numbering cannot collide with the
# challenge's; part 3 is unquoted so it can interpolate the two scalars.
aif_msg_question_challenge() {
  cat <<'EOF'
Стоп — ты собираешься задать вопрос. Сначала проверь сам вопрос, в первую очередь для себя.
1. Это настоящая развилка — или ты перекладываешь решение, которое можешь принять сам? Если один вариант явно лучше по существу (по целям сессии и дисциплине проекта) — НЕ спрашивай: сделай его и скажи, что сделал.
2. Если развилка о ДИЗАЙНЕ/СТРАТЕГИИ (а не быстрый A/B по фактам) — сначала структурированный брейншторм (например скилл `superpowers:brainstorming`, если доступен): исследуй → порекомендуй с аргументами, и только потом спрашивай.
3. Если это правда развилка — СНАЧАЛА карточка в тексте ответа, и только потом кнопки:
EOF
  aif_msg_fork_card | sed 's/^/   /'
  cat <<EOF
4. Первый вариант в кнопках — твоя рекомендация из строки 4 карточки, теми же словами. Человек должен узнать её в списке, а не сверять два текста.
5. В блоке ${AIF_RECAP_MARKER} на этом же ходе секция ${AIF_EOT_SEC_FORK} — это ССЫЛКА на карточку выше («развилка — карточка выше»), а не пересказ. Один текст развилки на ход.
Если всё это уже сделано в твоём ответе — просто задай вопрос снова: повтор не блокируется.
EOF
}

# Shared five-section recap contract (D-A, D-B) — the body every Stop-hook branch below
# carries verbatim via command substitution, so the three branches teach one contract
# instead of three slightly different ones (a model learns none of them from drift).
# Interpolates the Task 1.2 scalars rather than restating their text, and calls the
# Task 1.3 fork-card template — a literal copy of either would drift from the pack a
# later gate reads. AIF_EOT_RECAP_MAX_LINES is deliberately NOT a pack scalar so an
# operator's env override survives.
aif_msg_eot_recap_contract() {
  cat <<EOF
${AIF_RECAP_MARKER} — блок из пяти секций, в этом порядке:
1. ${AIF_EOT_SEC_WHERE} — всегда.
2. ${AIF_EOT_SEC_CHANGED} — если ответ длинный или структурный.
3. ${AIF_EOT_SEC_FORK} — если ты задаёшь вопрос. Тогда — карточкой. Внутри этого блока
   карточка опускает свои 0 и 5: секции 1 и 5 блока их уже держат.
   Если карточка уже выше в этом же ответе — перед кнопками AskUserQuestion или по одной на
   вопрос в раунде /arch — секция 3 это ОДНА строка-указатель на неё, а не вторая карточка.
   Один текст развилки на ход. Иначе — карточка целиком:
$(aif_msg_fork_card | sed 's/^/   /')
4. ${AIF_EOT_SEC_UNSURE} — по желанию.
5. ${AIF_EOT_SEC_NEXT} — всегда, и ровно две строки; вторая заканчивает блок:
   ${AIF_EOT_ME_PREFIX} <что делаю я>
   ${AIF_EOT_FOR_YOU_PREFIX} <одно из четырёх>
   — ${AIF_EOT_FOR_YOU_NOTHING}
   — ${AIF_EOT_FOR_YOU_WAITING}
   — ${AIF_EOT_FOR_YOU_DECIDE}
   — ${AIF_EOT_FOR_YOU_HANDS}
Ничего другого после «${AIF_EOT_FOR_YOU_PREFIX}» не бывает. Слова
«${AIF_EOT_FOR_YOU_BANNED}» — это не работа для человека, а перекладывание своей.
Весь блок — не длиннее ${AIF_EOT_RECAP_MAX_LINES:-15} строк; карточка развилки в лимит не входит.
Дальше — не секции блока и не в его лимит, а инструкции тебе самому:
• Если в этом ходе ты что-то рекомендовал, или сказал «решай ты» / «жду твоего решения» / «PR готов, ждёт твой клик» — проверь себя: альтернативы реально перебраны или взял первое что пришло? Если по существу есть явно лучший вариант (по целям и дисциплине) — НЕ перекладывай, сделай и скажи что сделал. Передача решения = резерв для настоящих развилок.
• Обратное: решил ли ты в этом ходе развилку МОЛЧА — прямым действием/командой/диспатчем, не вынеся её вопросом? Если она неоднозначна (нет явно лучшего по мерилам проекта) — это молча решённая развилка: вынеси её СЕЙЧАС через AskUserQuestion, не оставляй решённой молча. Оператор должен видеть и открытые, и закрытые развилки.
EOF
}

# Stop hook — дремлющие ворота-чекер секций (Task 1.5, D-A). Срабатывают только когда блок
# пересказа УЖЕ ЕСТЬ и он дефектный — никогда не требуют блок
# от хода, где его вообще нет. $1 = список дефектов через «; » из _eot_recap_defects().
aif_msg_eot_recap_gate() {
  printf '%s\n' "Блок $AIF_RECAP_MARKER есть, но он неправильный: $1. Исправь ровно то, что названо, в этом же ответе — блок целиком не переписывай."
}

# Stop hook — Branch C: long answer AND trailing fork-question.
aif_msg_eot_branch_c() {
  cat <<EOF
Стоп. Это и длинный ответ, И вопрос-развилка в конце — нужен и пересказ работы, и проверка вопроса. В первую очередь для себя.

$(aif_msg_eot_recap_contract)
EOF
}

# Stop hook — Branch A: long substantive answer, no question (lighter per-turn recap).
aif_msg_eot_branch_a() {
  cat <<EOF
Стоп. Прежде чем закончить — пересказ простыми словами, в первую очередь для себя.

$(aif_msg_eot_recap_contract)
EOF
}

# Stop hook — Branch B: a question with no long answer body (fork-challenge).
aif_msg_eot_branch_b() {
  cat <<EOF
Ты остановился на вопросе. Прежде чем ждать — проверь сам вопрос, для себя в первую очередь.

$(aif_msg_eot_recap_contract)
EOF
}

# Stop hook — handoff-currency gate (D13/D22): причина блока. Тот же контракт, что у EN-близнеца
# выше: $1 = путь, $2 = токены, $3 = порог, $4 = состояние, $5 = деталь. Пять заголовков секций
# остаются дословно английскими — category-3 match-data: ворота ищут эти литералы, и перевод
# сделал бы каждый handoff-файл невидимым для проверки.
aif_msg_eot_handoff_gate() {
  _hg_path="$1"; _hg_tokens="$2"; _hg_floor="$3"; _hg_state="$4"; _hg_detail="${5:-}"
  case "$_hg_state" in
    no-file)   _hg_verdict="Файла ещё нет — создай его сейчас, как текущее состояние этой сессии." ;;
    unchanged) _hg_verdict="СОДЕРЖИМОЕ не изменилось с последнего принятого хода — пересохранение или touch не считаются изменением; перепиши файл." ;;
    heading)   _hg_verdict="Обязательная секция отсутствует или пуста: ${_hg_detail}" ;;
    cap)       _hg_verdict="Файл превысил лимит в ${_hg_detail} строк — сожми его до текущего состояния, не дописывай." ;;
    *)         _hg_verdict="Файл неактуален." ;;
  esac
  cat <<EOF
[handoff-gate] Стоп — handoff-файл этой сессии неактуален:
  ${_hg_path}
Этот ход внутри handoff-диапазона (≈ ${_hg_tokens} токенов, порог ${_hg_floor}). ${_hg_verdict}
Файл — ТЕКУЩЕЕ СОСТОЯНИЕ сессии (переписывай на месте; держи в пределах ${AIF_HANDOFF_MAX_LINES:-200} строк). Обязательные H2-секции, в каждой хотя бы одна непустая строка:
- ## Decisions and why
- ## Rejected alternatives
- ## Unverified assumptions and open forks
- ## Skills to invoke by name
- ## Next action
Требуется изменение СОДЕРЖИМОГО, а не пересохранение. Если осталось только механическое — заверши финальное сообщение хода строкой:
  mechanical-tail: <что осталось и почему это механика — минимум 20 символов>
Иначе, переписав файл, заверши финальное сообщение хода готовой командой сжатия для оператора — отдельной строкой внутри код-блока, заполнив шаблон (аргумент направляет сводку харнесса так, чтобы она дополняла handoff-файл, а не пересказывала сессию заново; сам аргумент — на английском, это машинный текст):
  /compact Keep: handoff file ${_hg_path}; next action: <one line>; open forks: <one line>; verified facts (PR ids, SHAs, numbers) from the recent turns. Drop: tool output, exploration dead ends, superseded drafts.
Эту команду просят ЗДЕСЬ и больше нигде: она принадлежит этому блоку, а блок появляется только от порога вверх. Никогда не заканчивай ход строкой /compact по своей инициативе и никогда не переноси такую строку в Keep-список сводки сжатия — ниже порога сжатие тратит остаток окна оператора впустую.
EOF
}

# Stop hook — handoff-currency gate, деградировавшая проверка (D19): каталог residue нечитаем
# или недоступен на запись — ворота не могут даже УВИДЕТЬ handoff-файл. Блокируют один раз и
# говорят об этом, называя AIF_RESIDUE_DIR. Fail closed, никогда не тихий проход.
aif_msg_eot_handoff_gate_degraded() {
  cat <<EOF
[handoff-gate] Ворота handoff включены, но проверка каталога ПРОВАЛИЛАСЬ: каталог residue недоступен для записи —
  $1
Задай AIF_RESIDUE_DIR на записываемый каталог (или поправь права на этом). Это деградировавшая проверка, а не «всё чисто»: handoff-файл прочитать не удалось, так что его актуальность оценить нельзя. Блок снимется, когда проверка снова заработает.
EOF
}

# Stop hook — предложение сжатия вне полосы (D37): в финальном тексте хода есть готовая команда
# /compact, а сессия НИЖЕ порога ворот. Эту команду просит только блок D36, и только от порога
# вверх; ниже него сжатие тратит остаток окна оператора впустую.
# $1 = оценка контекста этого хода, $2 = порог.
aif_msg_eot_compact_out_of_band() {
  cat <<EOF
[handoff-gate] Стоп — в финальном сообщении этого хода есть команда /compact, но сессия НЕ в handoff-диапазоне (≈ $1 токенов, порог $2). Сжатие здесь тратит остаток окна оператора впустую.
Эту команду выдают ворота handoff, и только от порога вверх. Если ты заканчиваешь ею ход потому, что так сказала сводка предыдущего сжатия, — это артефакт твоего же хвоста, попавшего в сводку, а не постоянная инструкция.
Перепиши финальное сообщение хода без строки /compact и не переноси такую строку в Keep-список будущей сводки. Если команду в этой сессии попросил ОПЕРАТОР — оставь её и одной строкой скажи, что это его просьба.
EOF
}

# Пороги изучения глоссария (plain-words-recap-v2 D-F) — первые CONFIG-ключи в паке (всё
# выше — match-data или проза сообщений). Термин считается выученным, когда оператор
# употребил его AIF_GLOSSARY_USES раз ИЛИ агент дал инлайн-форму «термин (объяснение)»
# AIF_GLOSSARY_EXPLAINS раз; ниже порога Stop-хук один раз (one-shot флаг на термин)
# требует инлайн-объяснение. Хуки запоминают env оператора ДО источника этого пака и
# возвращают после: значение пака — ДЕФОЛТ, env-оверрайд всегда сильнее. Проба в
# check-parity.sh (^AIF_GLOSSARY_[A-Z_]+=) — затем, чтобы этот класс ключей не смог
# попасть лишь в один пак и уронить хук другого пака под set -u.
AIF_GLOSSARY_USES=3
AIF_GLOSSARY_EXPLAINS=5

# Stop-хук — требование глоссария (D-F): промпт оператора употребил ещё невыученный термин,
# и это первый ход, когда это срабатывает (one-shot флаг на термин). $1 = термин, $2 = слово,
# которое реально употребил оператор. Просит фиксированную инлайн-форму, которую ищет
# счётчик объяснений.
aif_msg_glossary_demand() {
  cat <<EOF
[glossary] Оператор употребил «$2» (= $1) — термин ещё в изучении. Где-то в этом ответе объясни его инлайн один раз, в фиксированной форме: $1 (<объяснение одной строкой>). Скобки и есть суть: именно эта форма не даёт объяснению улететь из окна.
EOF
}

# Заголовок story-пересказа (story-ветка Stop-хука + скил /story).
AIF_STORY_MARKER='## 🎬 Как это было'

# Story-ветка Stop-хука / скил /story: живой пересказ сессии простыми словами, когда
# работа сдана (запушен PR). Hook-style: вся инструкция локализована, поэтому язык
# вывода следует активному паку. ${anchor:-} безопасен при unset (у /story нет
# transcript-anchor — цель называет сам из контекста).
aif_msg_eot_branch_story() {
  cat <<EOF
Работа сдана (только что запушен PR) — расскажи человеку историю всей сессии, в первую очередь для него.
ОБЯЗАТЕЛЬНО начни блок ровно со строки «${AIF_STORY_MARKER}» — чтобы человек опознал его с ходу.

Цель сессии (из названия / первого задания): «${anchor:-(назови сам из контекста)}».

Рассказывай как историю, простым и живым языком — НЕ сухим чеклистом:
• Открой одной фразой — что вообще затевали и зачем, по-человечески.
• По актам — сюжетная арка ключевых ходов, с именами (файл / PR / решение): что делали, что пошло не так, как починили.
• Жаргон объясняй на месте — встретил термин (egress, caffeinate, Docker) → тут же аналогия одной строкой.
• Будь честен — где проверено слабо (1 прогон, 1 случай), в чём меньше всего уверен, что осталось.
• Кончи на человеке — одна вещь, которую решить/сделать ему («один шаг — твоё „го"»).
Тон: интересно, как история; без воды и само-поздравления; правда важнее гладкости. Если пункт не выходит конкретным — скажи прямо.
EOF
}

# Fork card template (shared with the recap block + ask-question-reminder rewrite, D-C).
# Consumed by task 1.4 (branch payloads) and slice 2's ask-question-reminder.sh.
# Carries ALL SIX D-C sections — this is the full card, the form slice 2 emits before the
# AskUserQuestion buttons. A card that sits INSIDE the recap block omits 0 and 5 (the
# block's own sections 1 and 5 own them, spec TD-N7a); the block's caller says so, so the
# omission is one surface's instruction rather than a hole in the shared text.
aif_msg_fork_card() {
  cat <<'EOF'
Развилка — карточка, не голый вопрос. В этом порядке:
0. Где мы — одно предложение, без истории.
1. Заголовок — сама развилка обычными словами.
2. Что решаем — с конкретным примером ИЗ ЭТОГО проекта, не аналогией.
3. Если А — что станет правдой. Если Б — что станет правдой.
4. ➡️ Рекомендую — сначала САМАЯ СУЩЕСТВЕННАЯ причина и **жирным**, потом до трёх
   остальных, по строке на каждую; затем одна строка: обратимо или нет и чем откатывается.
5. От тебя: ок — или «не ок, потому что …».
Карточку не сокращать: лимит строк на неё не распространяется.
EOF
}
