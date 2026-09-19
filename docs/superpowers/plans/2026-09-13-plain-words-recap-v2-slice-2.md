# Plain-words recap v2 — slice 2 (the card before the buttons) implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the model is about to put buttons in front of the operator, the fork card comes
first — same card the recap block teaches — with the recommendation as the first option, and the
recap block on that turn points at the card instead of restating it.

**Architecture:** One PR to `staging`, entirely in the language packs plus assertions. The hook
`.claude/hooks/ask-question-reminder.sh` already denies once and emits
`aif_msg_question_challenge` as `permissionDecisionReason`; slice 2 rewrites that pack function
to demand slice 1's `aif_msg_fork_card` shape. No control-flow change, so the two-state
loop guard, the TTLs and the deny-once contract are untouched.

**Tech Stack:** the `lang/{en,ru}.sh` pack contract, vitest
(`packages/core/hooks/ask-question-reminder.test.ts`).

**Global Constraints:** see [slice 0](2026-09-13-plain-words-recap-v2-slice-0.md#global-constraints).
**Depends on:** slice 1 merged — `aif_msg_fork_card` and `AIF_EOT_SEC_FORK` must exist in both
packs before Task 2.1 can call them.

**Spec:** [`…-design.md`](../specs/2026-09-13-plain-words-recap-v2-design.md) D-C, register R-13.

## What must NOT change

`.claude/hooks/ask-question-reminder.sh` is a PreToolUse hook with **no `stop_hook_active`
equivalent** — a blanket deny loops (deny → regenerate → ask → deny …). Its whole loop-safety is
the two-state session flag: `challenged` → the next AUQ passes regardless of elapsed time up to
`challenge_ttl=600`; `passed` → AUQs within `window=45` pass as the same question moment. The
45-second window alone was measured too short live on 2026-08-11 — regenerating a three-question
Russian card takes longer than that, producing four consecutive denies.

Slice 2 makes the demanded card LONGER, i.e. slower to regenerate. That is exactly the pressure
that broke the time-only guard. Do not touch `window`, `challenge_ttl`, or the state machine:
the count-based path already covers a slow regeneration. Task 2.2 pins that with a test.

## File Structure

| File | Responsibility |
|---|---|
| `.claude/hooks/lang/ru.sh`, `lang/en.sh` | `aif_msg_question_challenge` rewritten to demand the D-C card before the buttons, with the recommendation as the first option; the R-13 pointer sentence. |
| `packages/core/hooks/ask-question-reminder.test.ts` | Asserts the new demand text and re-pins the loop guard under the longer card. |

---

### Task 2.1: The challenge demands the card, not a checklist

**Files:**
- Modify: `.claude/hooks/lang/ru.sh` (`aif_msg_question_challenge`), `.claude/hooks/lang/en.sh`
- Test: `packages/core/hooks/ask-question-reminder.test.ts`

**Interfaces:**
- Consumes: `aif_msg_fork_card()` and `AIF_EOT_SEC_FORK` from slice 1 (both packs).
- Produces: `aif_msg_question_challenge()` — unchanged name and arity (no arguments, prints to
  stdout); the hook's `reminder=$(aif_msg_question_challenge)` line needs no edit.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/hooks/ask-question-reminder.test.ts`, matching the file's existing helper
for invoking the hook (read how the current tests feed stdin and read
`hookSpecificOutput.permissionDecisionReason` — do not invent a helper):

```ts
it('demands the fork card before the buttons, recommendation first', async () => {
  const res = await runHook({ tool_name: 'AskUserQuestion', session_id: 's-card' },
                            { AIF_HOOK_LANG: 'en' });
  const reason = JSON.parse(res.stdout).hookSpecificOutput.permissionDecisionReason as string;
  // the card's own shape, shared with the recap block
  expect(reason).toContain('Where we are');
  expect(reason).toContain('If A');
  expect(reason).toContain('If B');
  expect(reason).toContain('Reversible');
  // the two things that are specific to the buttons surface
  expect(reason).toMatch(/first option/i);   // recommendation is option 1
  expect(reason).toContain('Fork.');         // the R-13 pointer into the recap block
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pc-run npx vitest run packages/core/hooks/ask-question-reminder.test.ts -t 'fork card'`
Expected: FAIL — today's challenge is a four-point checklist; none of those strings appear.

- [ ] **Step 3: Rewrite the function in `ru.sh`**

The first two points survive verbatim in substance — they are the «is this even a fork» filter
and they are what stops the model punting a decision it can make. What changes is everything
after: the card replaces the prose checklist, and two new obligations land.

```bash
aif_msg_question_challenge() {
  cat <<EOF
Стоп — ты собираешься задать вопрос. Сначала проверь сам вопрос, в первую очередь для себя.
1. Это настоящая развилка — или ты перекладываешь решение, которое можешь принять сам? Если один вариант явно лучше по существу (по целям сессии и дисциплине проекта) — НЕ спрашивай: сделай его и скажи, что сделал.
2. Если развилка о ДИЗАЙНЕ/СТРАТЕГИИ (а не быстрый A/B по фактам) — сначала структурированный брейншторм (например скилл \`superpowers:brainstorming\`, если доступен): исследуй → порекомендуй с аргументами, и только потом спрашивай.
3. Если это правда развилка — СНАЧАЛА карточка в тексте ответа, и только потом кнопки:
$(aif_msg_fork_card)
4. Первый вариант в кнопках — твоя рекомендация из строки 4 карточки, теми же словами. Человек должен узнать её в списке, а не сверять два текста.
5. В блоке $AIF_RECAP_MARKER на этом же ходе секция $AIF_EOT_SEC_FORK — это ССЫЛКА на карточку выше («развилка — карточка выше»), а не пересказ. Один текст развилки на ход.
Если всё это уже сделано в твоём ответе — просто задай вопрос снова: повтор не блокируется.
EOF
}
```

The heredoc is now UNQUOTED (`<<EOF`, not `<<'EOF'`) because it interpolates
`$(aif_msg_fork_card)` and the two scalars. Consequence: the backticks around
`superpowers:brainstorming` must be escaped (`\``) or they execute as a command substitution
when the pack is sourced. This is a real hazard, not a style note — an unescaped backtick here
runs `superpowers:brainstorming` as a shell command on every AskUserQuestion.

- [ ] **Step 4: Mirror it in `en.sh`**

Same five points, same order, same interpolations:

```bash
aif_msg_question_challenge() {
  cat <<EOF
Stop — you are about to ask a question. Check the question itself first, mostly for your own sake.
1. Is this a real fork, or are you handing over a decision you can make yourself? If one option is plainly better on the merits (session goals, project discipline) — do NOT ask: do it and say what you did.
2. If the fork is about DESIGN or STRATEGY (not a quick factual A/B) — brainstorm it first (e.g. the \`superpowers:brainstorming\` skill, if available): research, then recommend with reasons, and only then ask.
3. If it really is a fork — the card comes FIRST, in the text of your answer, and the buttons after it:
$(aif_msg_fork_card)
4. The first option in the buttons is your recommendation from line 4 of the card, in the same words. The reader should recognise it in the list, not have to diff two texts.
5. In the $AIF_RECAP_MARKER block on this same turn, the $AIF_EOT_SEC_FORK section is a POINTER to the card above ("fork — card above"), never a retelling. One fork text per turn.
If you have already done all of this in your answer, just ask again: a repeat is not blocked.
EOF
}
```

- [ ] **Step 5: Run the test, parity, and a render**

```bash
pc-run npx vitest run packages/core/hooks/ask-question-reminder.test.ts
bash .claude/hooks/lang/check-parity.sh
( . .claude/hooks/lang/ru.sh; aif_msg_question_challenge )
( . .claude/hooks/lang/en.sh; aif_msg_question_challenge )
```
Expected: the new test green, the existing tests green, parity green, and BOTH renders printing
the card inline with no `command not found` on stderr. That last check is the backtick falsifier
from Step 3 — a rendered pack that prints fine but writes `superpowers:brainstorming: command
not found` to stderr is broken, and the JSON path would hide it.

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/lang/ru.sh .claude/hooks/lang/en.sh packages/core/hooks/ask-question-reminder.test.ts
git commit -m "feat(lang): the fork card comes before the buttons, recommendation first (D-C, R-13)"
```

### Task 2.2: Re-pin the loop guard under the longer card

A longer demanded card means a slower regeneration, which is the exact condition that produced
four consecutive denies on 2026-08-11. The count-based state machine already handles it; this
task proves it rather than trusting it.

**Files:**
- Modify: `packages/core/hooks/ask-question-reminder.test.ts`

**Interfaces:**
- Consumes: the hook's two-state flag at `${TMPDIR:-/tmp}/aif-ask-reminded-<session>`.
- Produces: nothing new — assertions only.

- [ ] **Step 1: Write the test**

```ts
it('lets the post-challenge retry through however long the card took to write', async () => {
  const sid = 's-slow-card';
  const first = await runHook({ tool_name: 'AskUserQuestion', session_id: sid }, { AIF_HOOK_LANG: 'en' });
  expect(JSON.parse(first.stdout).hookSpecificOutput.permissionDecision).toBe('deny');

  // Simulate a regeneration that took far longer than the 45s recency window but is still
  // inside challenge_ttl=600: age the flag by 120s, leaving its "challenged" content intact.
  const flag = `${tmpdir}/aif-ask-reminded-${sid}`;
  const past = new Date(Date.now() - 120_000);
  fs.utimesSync(flag, past, past);
  expect(fs.readFileSync(flag, 'utf8')).toBe('challenged');

  const retry = await runHook({ tool_name: 'AskUserQuestion', session_id: sid }, { AIF_HOOK_LANG: 'en' });
  expect(retry.status).toBe(0);
  expect(retry.stdout.trim()).toBe('');          // allowed through, no JSON decision
  expect(fs.readFileSync(flag, 'utf8')).toBe('passed');
});
```

`tmpdir` must be the SAME `TMPDIR` the hook ran under — read how the file's existing helper pins
it and use that value, otherwise this test asserts against a flag the hook never wrote and
passes for the wrong reason.

- [ ] **Step 2: Run it**

Run: `pc-run npx vitest run packages/core/hooks/ask-question-reminder.test.ts -t 'however long'`
Expected: PASS immediately — the guard is already count-based, and this is a characterisation
test locking that in. If it FAILS, do not relax the test: the loop guard regressed and that is a
blocker, because the visible symptom is the operator being denied four times in a row.

- [ ] **Step 3: Commit**

```bash
git add packages/core/hooks/ask-question-reminder.test.ts
git commit -m "test(ask): pin the count-based retry pass under a slower card regeneration"
```

### Task 2.3: Twins, sweep, PR

- [ ] **Step 1: Let pre-commit regenerate the twins and verify**

```bash
git status --short plugin/hooks/
git diff --stat origin/staging.. -- plugin/hooks/
```
Expected: the `plugin/hooks/lang/` twins moved and match `.claude/hooks/lang/` byte-for-byte.
Never hand-edit a twin; if one did not move, re-commit so the pre-commit sync fires.

- [ ] **Step 2: Full local gate sweep**

```bash
bash .claude/hooks/lang/check-parity.sh
pc-run npx vitest run packages/core/hooks/
bash tests/install-sh/gh-934-ship-eot-hook.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
```
Expected: all green. The install-sh arms are in the sweep because §1d ships this hook to
consumers; a pack that fails to source breaks the consumer's every AskUserQuestion.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin claude/plain-words-recap-v2-slice-2
```

PR body:

- `## Fidelity verdict` — what an operator will actually see change: the card in the answer text
  before the buttons, the recommendation as option 1, one fork text per turn.
- **§1.7 Forward-check** — this edits discipline-bearing text that has siblings. Sweep and cite
  with `path.ext:NN`: the recap block's own fork section (slice 1's packs — must agree that the
  section is a pointer on an asking turn, not a second card), anything under `.claude/rules/` or
  the skills that tells the model how to ask a question, and the plugin twins. For each:
  updated, or exempt with the reason.
- **§1.7 Backward-check** — the claims this change rests on, each with its citation: the hook
  reads the pack function and needs no edit (`.claude/hooks/ask-question-reminder.sh`, the
  `reminder=$(aif_msg_question_challenge)` line); the loop guard is count-based, not time-based
  (the `state = "challenged"` branch); `check-parity.sh` collects `^aif_msg_[a-z_]+\(\)` so both
  packs are covered.
- State explicitly that no control flow changed — packs and tests only.

No `Prior-art:` trailer is owed: no new dependency, and the only `packages/` file touched is a
`*.test.ts`, which is carved out as test material. If the pre-push hook disagrees it is
authoritative — add the escape hatch with a ≥20-char reason.

- [ ] **Step 4: Wait for CI, verify the green is real, merge**

```bash
~/.claude/scripts/ci-wait.sh <PR> --repo artyhoo/getff
```

Before trusting it: `gh pr view <PR> --json mergeable,mergeStateStatus,statusCheckRollup` — the
repo's own CI job must be in the rollup (a CONFLICTING PR runs none and still shows green from
third-party checks), and `headRefOid` must match what you pushed. Then `gh pr merge --squash`.

- [ ] **Step 5: Hand slices 3-5 to the factory**

Slices 3, 4 and 5 are NOT this session's scope (operator P-10). After slice 2 merges, write the
factory kickoff for them — do not start implementing. Register rows R-9 / R-10 / R-11 / R-12 are
unanswered by design and belong to those slices; they are asked there, by whoever builds them.
