# Plain-words recap v2 — slice 1 (hook + lang packs + installer) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the five-section recap block, the «от тебя» grammar, the fork card and the
dormant section-checker gate, so a turn that ends with a recap tells the reader where we are and
what exactly is wanted from them.

**Architecture:** One PR to `staging`. All new instruction TEXT ships unconditionally; the only
REJECTION ships behind `AIF_RECAP_GATE` and is dormant until armed (spec R-15, two-axis). The
gate is a SECTION CHECKER, never a block demander. `_eot_turn_shape()` is extracted so the
already-recapped exit site and the bottom branch selector compute `asked`/`long_text` from ONE
function without reordering any guard.

**Tech Stack:** bash (`set -euo pipefail`), the `lang/{en,ru}.sh` pack contract, vitest
(`packages/core/hooks/*.test.ts`), bash `.test.sh` harnesses, `setup.d/*.sh` installer steps.

**Global Constraints:** see [slice 0](2026-09-13-plain-words-recap-v2-slice-0.md#global-constraints)
— they apply verbatim here. Two of them bite in every task below: never hand-edit
`plugin/hooks/*` (twins), and never touch `.claude/settings.json`.

**Spec:** [`…-design.md`](../specs/2026-09-13-plain-words-recap-v2-design.md) D-A / D-B / D-C /
D-E / D-I, register R-13…R-17 · **Review log:** [`…-review-log.md`](../specs/2026-09-13-plain-words-recap-v2-review-log.md) round 2 first.

## Bash hazards that have already cost incidents here

The hook is `set -euo pipefail` (`.claude/hooks/end-of-turn-reminder.sh:9`). Every new line obeys:

- Reading an unset variable ABORTS the hook for that turn — the user sees nothing and no error.
  Any new var must be initialised before its first read, or read as `${var:-}`.
- `grep -q … && var=…` as the LAST statement of a function returns 1 when grep misses, and
  `set -e` kills the hook. Always `if grep -q …; then var=…; fi`.
- `grep -q` on a PIPE can exit 141 (SIGPIPE) — that is why every match in this hook is a
  here-string (`<<<"$text"`). Keep that form; do not "simplify" to `echo … | grep`.

## File Structure

| File | Responsibility |
|---|---|
| `.claude/hooks/end-of-turn-reminder.sh` | `_eot_turn_shape()`; `_eot_recap_defects()`; the gate at the already-recapped site; D-I anchor fix; branch payloads now emit the five-section contract. |
| `.claude/hooks/lang/en.sh`, `lang/ru.sh` | Section labels, the four «от тебя» values, the banned-word list, the gate reason, the fork card. |
| `scripts/register-recap-gate.sh` | Hand-action arming of `AIF_RECAP_GATE`, runnable from any cwd (D-E). |
| `scripts/register-root-resolution.test.sh` | Adds the new script to the any-cwd sweep. |
| `setup.d/10-skills.sh` | `FULL`-gated arming step mirroring `register-handoff-gate.sh:161-174`. |
| `tests/install-sh/gh-934-ship-eot-hook.test.sh` | Arm G — the `--full` arm proving the env write. |
| `packages/core/hooks/end-of-turn-reminder.test.ts` | Dormancy test; `AIF_RECAP_GATE` pinned out of the env; `f11` golden re-captured. |
| `docs/meta-factory/prior-art-evaluations.md` | New SSOT row «decision-request format = BUILD». |

---

### Task 1.1: Extract `_eot_turn_shape()` — one answer at both sites

The already-recapped guard at `:625-632` exits through `_autonomy_exit` BEFORE `asked` and
`long_text` are computed at `:772-794`. The gate needs them at `:625`. The spec's answer (R-16)
is one shared function called at both sites, with **no reordering** of the guard block — the
comment at `:605-620` says POSITION IS LOAD-BEARING and cites two live regressions.

`orch_mode` (`:743-755`) is an input to the turn shape and is ALSO computed below `:625`, so it
moves INTO the function. Verify first that nothing else reads it:

```bash
grep -n 'orch_mode' .claude/hooks/end-of-turn-reminder.sh
```
Expected: assignments inside the block, then reads only at the `recap_threshold` line and the
`asked` elif. If any other reader appears, STOP and send a fork card to the advisor.

**Files:**
- Modify: `.claude/hooks/end-of-turn-reminder.sh` (move `:743-755` + `:770-794` into a function
  defined ABOVE `:625`; call it at both sites)
- Test: `packages/core/hooks/end-of-turn-reminder.test.ts`

**Interfaces:**
- Produces: `_eot_turn_shape()` — a function taking no arguments, reading `$text`,
  `$text_length`, `$has_askuserquestion`, `$AIF_EOT_QUESTION_PATTERN` and the
  `ORCHESTRATION_MODE_*` env, and setting exactly three globals: `orch_mode` (`true`/`false`),
  `long_text` (`true`/`false`), `asked` (`true`/`false`). Idempotent: calling it twice yields the
  same values. Consumed by Task 1.5 and, through it, by Task 1.6b.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/hooks/end-of-turn-reminder.test.ts`, in the existing `describe` that owns
branch selection:

```ts
it('computes the same turn shape at the recap-guard site and at the branch selector', async () => {
  // A turn that is BOTH already-recapped and question-shaped. Before the extraction the
  // hook exits at the recap guard with the shape uncomputed; after it, the shape exists at
  // both sites and the hook still exits silently (gate unarmed) with status 0.
  const res = await buildCase({
    text: `## 🟢 In plain words\nWhere we are. Done.\n\nShall I proceed?`,
    env: { AIF_HOOK_LANG: 'en' },
  });
  expect(res.status).toBe(0);
  expect(res.stderr).not.toMatch(/unbound variable/);
});
```

- [ ] **Step 2: Run it and watch it behave**

Run: `pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts -t 'turn shape'`
Expected: PASS even before the change (the guard exits early today). This test is the REGRESSION
guard for Step 3 — it is the one that turns red if the extraction reads an unset variable under
`set -u`. Record that it passes now; a red here after Step 3 means the extraction broke.

- [ ] **Step 3: Extract**

Insert the function ABOVE the marker-guard comment block (`:605`), after `_autonomy_exit`'s
definition so it can be called from anywhere below:

```bash
# Turn shape — one answer, two call sites. The already-recapped guard below needs `asked`
# and `long_text` to decide whether the gate's section set applies, but the guard's POSITION
# is load-bearing (see the comment block below it) and must not move. So the computation
# moves into a function called at BOTH sites instead of the guard moving down to it.
# orch_mode lives in here too: it is an input to both `long_text` and `asked`, it was computed
# below the guard, and reading it there under `set -u` would abort the hook every turn.
_eot_turn_shape() {
  orch_mode=false
  local marker ttl marker_now marker_mtime
  marker="${ORCHESTRATION_MODE_MARKER:-${CLAUDE_PROJECT_DIR:-.}/.claude/orchestration-mode}"
  ttl="${ORCHESTRATION_MODE_TTL_SECONDS:-21600}"
  if [ -f "$marker" ]; then
    marker_now=$(date +%s)
    # GNU-first, BSD-fallback — see the original comment: `stat -f %m` on GNU exits 0 with
    # a garbage value, so the reverse order silently disables orchestration mode on Linux.
    marker_mtime=$(stat -c %Y "$marker" 2>/dev/null || stat -f %m "$marker" 2>/dev/null || echo 0)
    if [ "$(( marker_now - marker_mtime ))" -lt "$ttl" ]; then
      orch_mode=true
    fi
  fi

  long_text=false
  local recap_threshold=500
  if [ "$orch_mode" = "true" ]; then
    recap_threshold="${ORCHESTRATION_MODE_RECAP_MIN_CHARS:-200}"
  fi
  if [ "$text_length" -gt "$recap_threshold" ]; then
    if grep -qE -- '^#|^- |^\* |\*\*|```|\[[^]]+\]\([^)]+\)' <<<"$text"; then
      long_text=true
    fi
  fi

  asked=false
  if [ "$has_askuserquestion" = "true" ]; then
    asked=true
  elif [ -n "$text" ]; then
    local tail_chunk
    tail_chunk=$(echo "$text" | tail -c 500)
    if grep -qE -- '\?[[:space:]]*$' <<<"$tail_chunk"; then
      asked=true
    elif [ "$orch_mode" = "false" ] && grep -qiE -- "$AIF_EOT_QUESTION_PATTERN" <<<"$tail_chunk"; then
      asked=true
    fi
  fi
}
```

Then DELETE the original `:743-755` orch_mode block and the original `:770-794` block, and put a
single `_eot_turn_shape()` call where the deleted `:743` block began. The bottom branch selector
is unchanged — it reads the same three globals it always did.

Preserve the surrounding comments verbatim where they explain WHY (the GNU/BSD `stat` note, the
«markdown-structure gate is KEPT» note above `long_text`). A comment that explains a live
regression is load-bearing text.

- [ ] **Step 4: Prove nothing moved behaviourally**

```bash
pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts
bash .claude/hooks/lang/check-parity.sh
```
Expected: the full existing suite green, including fixture 9 (the paired negative over all 17
golden cases). Fixture 9 going red here means the extraction changed output — the extraction
alone must be byte-neutral.

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/end-of-turn-reminder.sh packages/core/hooks/end-of-turn-reminder.test.ts
git commit -m "refactor(eot): one turn-shape function for the recap-guard and branch sites"
```

Add the escape-hatch trailer — the hook detector catches mixed PRs and this commit adds no
capability: `Prior-art: skipped — refactor only, extracts an existing computation into a function`.

### Task 1.2: Lang-pack scalars for the five sections and the «от тебя» grammar

`check-parity.sh:26-33` already collects `^AIF_EOT_[A-Z_]+=`, so new scalars are parity-checked
with no probe change — verify, do not assume:

```bash
sed -n '20,40p' .claude/hooks/lang/check-parity.sh
```

**Files:**
- Modify: `.claude/hooks/lang/en.sh`, `.claude/hooks/lang/ru.sh`
- Test: `bash .claude/hooks/lang/check-parity.sh`

**Interfaces:**
- Produces, in BOTH packs, same names, same order:
  `AIF_EOT_SEC_WHERE`, `AIF_EOT_SEC_CHANGED`, `AIF_EOT_SEC_FORK`, `AIF_EOT_SEC_UNSURE`,
  `AIF_EOT_SEC_NEXT` (the five section labels of D-A);
  `AIF_EOT_ME_PREFIX`, `AIF_EOT_FOR_YOU_PREFIX`;
  `AIF_EOT_FOR_YOU_NOTHING`, `AIF_EOT_FOR_YOU_WAITING`, `AIF_EOT_FOR_YOU_DECIDE`,
  `AIF_EOT_FOR_YOU_HANDS` (the four D-B values, each carrying its own placeholder);
  `AIF_EOT_FOR_YOU_BANNED` (a `|`-joined ERE alternation of проверь/ознакомься/убедись/
  посмотри and their English counterparts — the D-B banned list).
- Consumed by Tasks 1.3, 1.4, 1.5 and by slice 2's fork card.

- [ ] **Step 1: Add the scalars to `ru.sh`**

Insert next to the existing `AIF_EOT_*` scalars (keep them contiguous — parity reads by name,
humans read by neighbourhood):

```bash
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
AIF_EOT_FOR_YOU_BANNED='проверь|ознакомься|убедись|посмотри'
```

- [ ] **Step 2: Add the mirror scalars to `en.sh`**

```bash
AIF_EOT_SEC_WHERE='**Where we are.**'
AIF_EOT_SEC_CHANGED='**What changed.**'
AIF_EOT_SEC_FORK='**Fork.**'
AIF_EOT_SEC_UNSURE='**What I am unsure about.**'
AIF_EOT_SEC_NEXT='**Next.**'
AIF_EOT_ME_PREFIX='Me:'
AIF_EOT_FOR_YOU_PREFIX='From you:'
AIF_EOT_FOR_YOU_NOTHING='nothing (<what you would check, if you want to>)'
AIF_EOT_FOR_YOU_WAITING='waiting on: <what, from whom>'
AIF_EOT_FOR_YOU_DECIDE='decide: <A> or <B>'
AIF_EOT_FOR_YOU_HANDS='do by hand: <one action>'
AIF_EOT_FOR_YOU_BANNED='проверь|ознакомься|убедись|посмотри|check that|review the|make sure|take a look'
```

The banned list keeps the Russian stems in BOTH packs on purpose: a Russian-speaking operator
running `AIF_HOOK_LANG=en` still gets Russian prose out of the model, and a gate that only
knows English would pass it. The D-B ban is about the SHAPE of the ask, not the language.

**Do NOT add `AIF_EOT_RECAP_MAX_LINES` to either pack.** The packs are sourced AFTER the
environment, so a pack assignment would clobber an operator's env override and the cap would
silently be un-tunable. The hook reads it as `${AIF_EOT_RECAP_MAX_LINES:-15}` (Task 1.4).

- [ ] **Step 3: Run parity**

Run: `bash .claude/hooks/lang/check-parity.sh`
Expected: green. A red here names the exact missing key in the other pack — fix and re-run.

- [ ] **Step 4: Commit**

```bash
git add .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh
git commit -m "feat(lang): five recap section labels and the four from-you values (D-A, D-B)"
```

### Task 1.3: The fork card function (D-C), shared with slice 2

**Files:**
- Modify: `.claude/hooks/lang/en.sh`, `.claude/hooks/lang/ru.sh`
- Test: `bash .claude/hooks/lang/check-parity.sh`

**Interfaces:**
- Produces: `aif_msg_fork_card()` in both packs — takes no arguments, prints the D-C card
  template (sections 0-5) to stdout. Consumed by Task 1.4 (branch payloads) and by slice 2's
  `ask-question-reminder.sh` rewrite. `check-parity.sh` `keys()` collects
  `^aif_msg_[a-z_]+\(\)`, so the name is parity-checked automatically.

- [ ] **Step 1: Add it to `ru.sh`**

```bash
aif_msg_fork_card() {
  cat <<'EOF'
Развилка — карточка, не голый вопрос. Шесть строк, в этом порядке:
0. Где мы — одно предложение, без истории.
1. Что решаем — с конкретным примером, не абстракцией.
2. Если А — что станет правдой.
3. Если Б — что станет правдой.
4. Рекомендация — сначала САМАЯ СУЩЕСТВЕННАЯ причина, потом остальные.
5. Обратимо или нет — и чем откатывается.
Карточку не сокращать: лимит строк на неё не распространяется.
EOF
}
```

- [ ] **Step 2: Add the mirror to `en.sh`**

```bash
aif_msg_fork_card() {
  cat <<'EOF'
A fork is a card, not a bare question. Six lines, in this order:
0. Where we are — one sentence, no history.
1. What we decide — with a concrete example, never an abstraction.
2. If A — what becomes true.
3. If B — what becomes true.
4. Recommendation — the MOST ESSENTIAL reason first, the rest after.
5. Reversible or not — and what rolls it back.
Never compress the card: the line cap does not apply to it.
EOF
}
```

The `<<'EOF'` quoting is required — an unquoted heredoc would expand `$`-bearing text in a
future edit and a pack is sourced, not executed.

- [ ] **Step 3: Run parity and a smoke render**

```bash
bash .claude/hooks/lang/check-parity.sh
( . .claude/hooks/lang/ru.sh; aif_msg_fork_card ) | head -3
( . .claude/hooks/lang/en.sh; aif_msg_fork_card ) | head -3
```
Expected: parity green; each render prints its first three lines.

- [ ] **Step 4: Commit**

```bash
git add .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh
git commit -m "feat(lang): fork-card template shared by the recap block and the question reminder (D-C)"
```

### Task 1.4: Branch payloads teach the five-section block and the «от тебя» grammar

The instruction TEXT changes unconditionally — this half is NOT flag-gated (spec R-15,
two-axis). Only the rejection in Task 1.5 is dormant.

**Files:**
- Modify: `.claude/hooks/lang/en.sh`, `.claude/hooks/lang/ru.sh` (`aif_msg_eot_branch_a`,
  `_branch_b`, `_branch_c`)
- Test: `packages/core/hooks/end-of-turn-reminder.test.ts`

**Interfaces:**
- Consumes: the Task 1.2 scalars and the Task 1.3 `aif_msg_fork_card`.
- Produces: branch payloads whose text names the five sections, the gate matrix, the cap and
  the four «от тебя» values. Signatures unchanged — same function names, same arity.

- [ ] **Step 1: Write the failing test**

```ts
it('branch payloads teach the five-section contract and the from-you grammar', async () => {
  const res = await buildCase({
    text: 'x'.repeat(700) + '\n\n## Heading\n- a bullet\n',
    env: { AIF_HOOK_LANG: 'en' },
  });
  const reason = JSON.parse(res.stdout).reason as string;
  for (const s of ['Where we are.', 'What changed.', 'Next.', 'From you:',
                   'nothing (', 'waiting on:', 'decide:', 'do by hand:']) {
    expect(reason).toContain(s);
  }
  // The cap is stated, and the fork card is exempted from it.
  expect(reason).toMatch(/15/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts -t 'five-section'`
Expected: FAIL — `reason` carries today's wording, none of those strings.

- [ ] **Step 3: Rewrite the three payloads in `ru.sh`, then mirror in `en.sh`**

Each payload keeps its existing framing sentence (why it fired) and replaces the recap
instruction with this body, interpolating the scalars rather than restating them — a literal
copy would drift from the pack the gate reads:

```bash
aif_msg_eot_branch_a() {
  cat <<EOF
$AIF_RECAP_MARKER — блок из пяти секций, в этом порядке:
1. $AIF_EOT_SEC_WHERE — всегда.
2. $AIF_EOT_SEC_CHANGED — если ответ длинный или структурный.
3. $AIF_EOT_SEC_FORK — если ты задаёшь вопрос. Тогда — карточкой:
$(aif_msg_fork_card)
4. $AIF_EOT_SEC_UNSURE — по желанию.
5. $AIF_EOT_SEC_NEXT — всегда, и последняя строка блока именно такая:
   $AIF_EOT_ME_PREFIX <что делаю я>. $AIF_EOT_FOR_YOU_PREFIX <одно из четырёх>
   — $AIF_EOT_FOR_YOU_NOTHING
   — $AIF_EOT_FOR_YOU_WAITING
   — $AIF_EOT_FOR_YOU_DECIDE
   — $AIF_EOT_FOR_YOU_HANDS
Ничего другого после «$AIF_EOT_FOR_YOU_PREFIX» не бывает. Слова
«$AIF_EOT_FOR_YOU_BANNED» — это не работа для человека, а перекладывание своей.
Весь блок — не длиннее ${AIF_EOT_RECAP_MAX_LINES:-15} строк; карточка развилки в лимит не входит.
EOF
}
```

This heredoc is UNQUOTED (`<<EOF`, not `<<'EOF'`) because it interpolates. That makes every
literal `$` and every backtick in the prose active — keep the prose free of both.

Branches B and C keep their own first sentence and then carry the SAME body. Do not paraphrase
it per branch: three slightly different contracts is how a model learns none of them. Extract
the shared body into one pack-local helper `_aif_eot_recap_contract()` called by all three, and
add it to both packs so `check-parity.sh` sees the same key set on each side.

- [ ] **Step 4: Run the test and the suite**

```bash
pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts
bash .claude/hooks/lang/check-parity.sh
```
Expected: the new test passes. Fixture 9 (paired negative) will now be RED for
`f11-long-text-in-band` — that case carries a branch payload and the payload legitimately
changed. It is the ONLY case allowed to move; if any other of the 17 turns red, the change
leaked outside the payloads. Task 1.9 re-captures f11 and only f11.

- [ ] **Step 5: Commit**

```bash
git add .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh packages/core/hooks/end-of-turn-reminder.test.ts
git commit -m "feat(lang): recap payloads teach the five-section block and the from-you grammar (D-A, D-B)"
```

### Task 1.5: The dormant section-checker gate

The gate is a SECTION CHECKER: it looks at a block that EXISTS and names the missing section.
It never demands a block from a turn that has none — that is the D-A boundary, and crossing it
turns every short answer into a nag.

**Files:**
- Modify: `.claude/hooks/end-of-turn-reminder.sh` (at the already-recapped site, `:625-632`)
- Modify: `.claude/hooks/lang/en.sh`, `.claude/hooks/lang/ru.sh` (`aif_msg_eot_recap_gate`)
- Test: `packages/core/hooks/end-of-turn-reminder.test.ts`

**Interfaces:**
- Consumes: `_eot_turn_shape()` (Task 1.1), the Task 1.2 scalars.
- Produces: `_eot_recap_block()` — echoes the recap slice: the `$AIF_RECAP_MARKER` heading
  through the block's last non-empty line, with trailing blank lines dropped.
  `_eot_recap_defects()` — reads `$text`, `$asked`, `$long_text`; echoes a
  `; `-joined list of missing/❌ sections, or nothing when the block is well-formed.
  `aif_msg_eot_recap_gate <defects>` — pack function taking ONE argument, the defect list.

- [ ] **Step 1: Write the failing tests — armed AND dormant**

```ts
it('armed gate names the missing section of an existing recap block', async () => {
  const res = await buildCase({
    text: `## 🟢 In plain words\n**Where we are.** Done.\n\nShall I proceed?`,
    env: { AIF_HOOK_LANG: 'en', AIF_RECAP_GATE: '1' },
  });
  const reason = JSON.parse(res.stdout).reason as string;
  expect(reason).toContain('Fork.');       // asked ⇒ section 3 required
  expect(reason).toContain('From you:');   // section 5's last line missing
});

it('is dormant when AIF_RECAP_GATE is unset', async () => {
  const res = await buildCase({
    text: `## 🟢 In plain words\n**Where we are.** Done.\n\nShall I proceed?`,
    env: { AIF_HOOK_LANG: 'en' },
  });
  expect(res.stdout).not.toContain('Fork.');
});

it('never fires on a turn that has no recap block at all', async () => {
  const res = await buildCase({ text: 'Short answer.', env: { AIF_HOOK_LANG: 'en', AIF_RECAP_GATE: '1' } });
  expect(res.stdout).not.toContain('From you:');
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts -t 'gate'`
Expected: test 1 fails (nothing emitted), tests 2 and 3 pass vacuously. All three must be green
at Step 5 — a vacuous pass today is what proves dormancy tomorrow.

- [ ] **Step 3: Add `_eot_recap_defects()` to the hook**

Define it next to `_eot_turn_shape()`. Note the `if … then … fi` form throughout — `grep -q …
&& d=…` as a final statement returns 1 and `set -e` would kill the hook:

```bash
# The recap slice: the marker heading through the block's last non-empty line. It is the
# gate's unit of work — the section checker reads it, and Task 1.6b hashes it — so it is
# extracted once here rather than re-derived at each site. Trailing blank lines are dropped
# so a stray newline cannot change the sha of an otherwise identical block.
_eot_recap_block() {
  awk 'NF { last = NR } { l[NR] = $0 } END { for (i = 1; i <= last; i++) print l[i] }' \
    <<<"$AIF_RECAP_MARKER${text#*"$AIF_RECAP_MARKER"}"
}

# Section checker for an EXISTING recap block. Never a block demander: the caller only
# reaches this when the turn already carries $AIF_RECAP_MARKER.
_eot_recap_defects() {
  local d="" block last
  block="$(_eot_recap_block)"
  if ! grep -qF -- "$AIF_EOT_SEC_WHERE" <<<"$block"; then d="$d; $AIF_EOT_SEC_WHERE"; fi
  if ! grep -qF -- "$AIF_EOT_SEC_NEXT"  <<<"$block"; then d="$d; $AIF_EOT_SEC_NEXT"; fi
  if [ "$asked" = "true" ] && ! grep -qF -- "$AIF_EOT_SEC_FORK" <<<"$block"; then
    d="$d; $AIF_EOT_SEC_FORK"
  fi
  if [ "$long_text" = "true" ] && ! grep -qF -- "$AIF_EOT_SEC_CHANGED" <<<"$block"; then
    d="$d; $AIF_EOT_SEC_CHANGED"
  fi
  # D-B scope: the gate reads the LAST non-empty line of the block, nothing above it.
  last="$(grep -v '^[[:space:]]*$' <<<"$block" | tail -n 1)"
  if ! grep -qF -- "$AIF_EOT_FOR_YOU_PREFIX" <<<"$last"; then
    d="$d; $AIF_EOT_FOR_YOU_PREFIX"
  elif grep -qiE -- "$AIF_EOT_FOR_YOU_BANNED" <<<"$last"; then
    d="$d; $AIF_EOT_FOR_YOU_BANNED"
  fi
  printf '%s' "${d#; }"
}
```

Verified live 2026-09-13 on bash 3.2 under `set -euo pipefail`: the slice keeps the marker
heading, drops trailing blank lines, and its sha256 is UNCHANGED when the prose above the block
is replaced — which is the whole point of hashing the slice rather than `$text` (Task 1.6b).

- [ ] **Step 4: Wire it at the already-recapped site**

Inside the `if … grep -qF "$AIF_RECAP_MARKER"` body at `:625`, ABOVE the existing
`_autonomy_exit` call and without moving one line of the guard:

```bash
  _eot_turn_shape
  if [ "${AIF_RECAP_GATE:-0}" = "1" ] && [ -z "${gate_line:-}" ] && [ -z "${ctx_line:-}" ] \
     && ! grep -qF -- "$AIF_STORY_MARKER" <<<"$text"; then
    _recap_defects="$(_eot_recap_defects)"
    if [ -n "$_recap_defects" ]; then
      gate_line="$(aif_msg_eot_recap_gate "$_recap_defects")"
    fi
  fi
  _autonomy_exit
```

The `-z "$gate_line"` / `-z "$ctx_line"` conditions are D21 precedence, «one reason per stop»:
`_autonomy_exit` has ONE extra slot and the handoff gate and the context line already compete
for it. `${AIF_RECAP_GATE:-0}` and `${gate_line:-}` are read with defaults — a bare `$gate_line`
here aborts the hook under `set -u` on every turn where the handoff gate did not run.

- [ ] **Step 5: Add `aif_msg_eot_recap_gate` to both packs and run**

```bash
aif_msg_eot_recap_gate() {
  printf '%s\n' "Блок $AIF_RECAP_MARKER есть, но в нём не хватает: $1. Допиши недостающее в этом же ответе — блок целиком не переписывай."
}
```
(en.sh: `The $AIF_RECAP_MARKER block is there but missing: $1. Add what is missing in this same answer — do not rewrite the whole block.`)

```bash
bash .claude/hooks/lang/check-parity.sh
pc-run npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts -t 'gate'
```
Expected: parity green, all three gate tests green.

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/end-of-turn-reminder.sh .claude/hooks/lang/en.sh .claude/hooks/lang/ru.sh packages/core/hooks/end-of-turn-reminder.test.ts
git commit -m "feat(eot): dormant section-checker gate for the recap block (D-A, R-15)"
```

---

**Continue in [slice 1 — delivery](2026-09-13-plain-words-recap-v2-slice-1-delivery.md):** the
D-I anchor fix, the hand-action script, the installer arming step, goldens and the PR.
