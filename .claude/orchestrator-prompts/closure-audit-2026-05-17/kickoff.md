# Opus orchestrator prompt — Closure audit 2026-05-17

> Открой новую Claude Code сессию на **Opus** (`/model opus` или флаг при запуске), скопируй ВСЁ ниже как первое сообщение, дождись финального REPORT.
>
> **Mode B parallel batch dispatch.** Opus делает enumeration + aggregation, Sonnet-воркеры через `Agent` tool делают per-claim mechanical verification по единому шаблону. Cost target: ~30k Opus + ~80-120k Sonnet (10-15 параллельных воркеров по 5-8k каждый).

---

## TASK

Найти всё что было **закрыто как «done / merged / verified / closed / ready»** в последние 7 дней этого проекта, **без** соответствующего process-evidence. Аналог инцидента #4 в `[[autonomous-self-audit-triggering-evidence]]` (PR #70 закрыт без kickoff dispatch + без 10-item VERIFY — был revert'нут как `4307ac7`). Гипотеза: похожие process-bypass closures могут быть и в других местах, которые ещё не обнаружены.

WORKDIR: `/Users/art/code/rules-as-tests-aif`
OUTPUT: `docs/meta-factory/research-patches/2026-05-17-closure-audit.md` (новый research-patch)
BRANCH: работай в worktree чтобы не мешать другим сессиям — `git worktree add ../rules-as-tests-aif-closure-audit main && cd ../rules-as-tests-aif-closure-audit` (per [[feedback_worktrees_for_parallel_subwaves]]).

---

## CONTEXT

**Origin:** в orchestrator-сессии 2026-05-17 maintainer обнаружил что Item 0 (end-of-turn-reminder-hook) был закрыт как «done» хотя kickoff dispatch (отдельная Opus burn-mode сессия + 10-item VERIFY + REPORT) не выполнялся — выполнен 1 шаг из 5. Revert применён. Это 4-й инцидент в [[autonomous-self-audit-triggering-evidence]] за 25 часов структурно идентичной формы «AI закрывает как done без верификации».

**Загруженный контекст для тебя:**
- `.claude/rules/ai-laziness-traps.md` §2 (T1, T3, T10, T11, T15 особенно)
- `.claude/rules/phase-research-coverage.md` §1.7 (forward+backward на закрытие audit'а)
- `.claude/rules/reviewer-discipline.md` §2 (surface-as-decision-needed — НЕ принимай strategic decisions, surface them)
- `~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/project_autonomous_self_audit_triggering_evidence.md` (incidents 1-4)
- `.claude/orchestrator-prompts/post-1a-coordination/kickoff.md` §3.0 deltas + §3.6 sequence (table of recent closures)

---

## AI-LAZINESS TRAPS ACTIVE

Per `.claude/rules/ai-laziness-traps.md` §3, mandatory enumeration:

- **T1 — Sampling floor.** «Прогнал 3 claims, все clean — категория чистая» это sampling artifact, не finding. Floor = 5, recommended ≥10. Если первые 3-5 чистые, продолжай до 10+.
- **T3 — Plausible-looking finding without verification.** Каждый verdict CONFIRMED/SUSPICIOUS/FALSE должен иметь либо (a) command + output, либо (b) file:line citation с фактическим содержимым строки. **Никаких prose-only verdicts.** Это требование передавай в Sonnet subagent prompt буквально.
- **T10 — Reporting completeness vs what exists.** §population enumeration ПЕРВЫМ шагом, ДО sampling/dispatch. Без полной enumeration «N closures audited» не имеет смысла.
- **T11 — Don't propose mechanism without checking prior art.** Если найдёшь FALSE closure, НЕ предлагай custom remediation без проверки что kickoff/process документ уже определяет нужный процесс. Build-first-reuse-default — используй существующие процессы из репо.
- **T15 — Self-application.** **Mandatory.** Твой closure-audit REPORT сам является закрытием. Применяй ту же дисциплину к собственному выводу: §1.7 forward+backward на закрытии audit'а, §self-application секция в REPORT'е с явным «did this audit run on itself?» finding.
- **T-CA-A (domain-specific) — «верифицировал верхний слой, не проверил вложенные claims».** Если PR #X закрыт «correctly», это закрытие может само ссылаться на research-patch Y, который ссылается на R-phase Z. Не останавливайся на верхнем слое — для каждой closure-claim расширяй до 2-уровневой глубины (что claim ссылается на + что то ссылается на).

---

## METHODOLOGY

### Step 0 — enumerate population (T10)

ДО любых subagent dispatches составь полный список «closure claims» в скоупе:

1. `gh pr list --state merged --limit 30 --json number,title,mergedAt,mergeCommit,headRefName --search "merged:>2026-05-10"` — PRs за последние 7 дней
2. `ls -lt docs/meta-factory/research-patches/2026-05-1*.md` — recent research patches (each claims «R-phase DONE»)
3. `grep -rEn "DONE|MERGED|CLOSED|GO|PASS" .claude/orchestrator-prompts/post-1a-coordination/kickoff.md` §3.x таблицы
4. `grep -lE "kickoff.*GO|verdict.*GO|status.*done|status.*closed" .claude/orchestrator-prompts/*/state.md` (если есть)
5. Memory entries: `grep -lE "DONE|ready|closed" ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/*.md`

Запиши в §population секцию REPORT'а: N closure-claims total, по типам (PR / research-patch / kickoff-state / memory-status).

Выбери для аудита **минимум 10**, желательно **15-20** случаев, преимущественно те где:
- closure произошла в последние 3 дня (свежие — чаще скрытый theatre)
- closure-text использует слова без явного evidence-anchor («done / fixed / handled» без commit-hash / file:line)
- closure-text создан не самим автором артефакта (orchestrator закрыл чужую работу)

### Step 1 — parallel dispatch Sonnet workers

**Single message, multiple Agent tool calls.** Each Sonnet worker gets ONE claim with `subagent_type: general-purpose`, model unspecified (inherits Sonnet from session default). Per orchestrator skill: subagent prompts must be **self-contained** (no shared context from your orchestrator session). Use the **VERIFIER TEMPLATE** below verbatim, заполняя `{CLAIM}` / `{SOURCE}` / `{EXPECTED_EVIDENCE_TYPE}` / `{NESTED_CLAIM_DEPTH}` для каждого.

Dispatch batches of 5-7 workers in parallel (don't dispatch all 15 at once — review intermediate batch results before next batch in case patterns emerge).

### Step 2 — aggregate

Wait for all subagent REPORTs. Build §verdicts table: claim × source × verdict × evidence (one row per claim).

Categorize:
- **CONFIRMED** — claim has matching evidence, process-trail visible
- **SUSPICIOUS** — claim plausible but evidence ambiguous; needs deeper look
- **FALSE** — claim contradicted by evidence (e.g. «done» but file missing, «merged» but PR open, «verified» but test absent)
- **INCONCLUSIVE** — subagent couldn't determine within budget

If 2+ FALSE OR 4+ SUSPICIOUS — same structural pattern as incident #4 — escalate to §escalations with proposed remediation (revert / re-dispatch / verify) per FALSE item, **but do not execute remediation yourself**. Maintainer decides per `reviewer-discipline.md` §2.

### Step 3 — §1.7 self-reflexive check on YOUR audit

Per `phase-research-coverage.md` §1.7: at closure of this audit, forward+backward check on **your own REPORT**:
- **Forward:** which existing disciplines did this audit apply? (ai-laziness-traps T1/T3/T10/T11/T15, reviewer-discipline §2, phase-research-coverage §1.7, build-first-reuse-default §3)
- **Backward:** sweep prior closure-audit attempts in this repo (`grep -r "closure audit\|closure-audit" docs/ .claude/`) — does this audit duplicate / supersede / complement?

Both must have file:line citations.

### Step 4 — REPORT

Output as `docs/meta-factory/research-patches/2026-05-17-closure-audit.md`. Structure:

```markdown
# 2026-05-17 — Closure audit (post-incident-4)

> Authoritative for: closure-audit findings 2026-05-17. NOT authoritative for: process design — see [.claude/rules/ai-laziness-traps.md], [phase-research-coverage.md].

## §1 Origin + scope
## §2 Population enumeration (T10)
## §3 Sampling strategy + count (T1, T10)
## §4 Verdicts table (claim × source × verdict × evidence)
## §5 Escalations (FALSE / SUSPICIOUS with proposed remediation)
## §6 §1.7 forward-check applied
## §7 §1.7 backward-check applied
## §8 Self-application (T15): did this audit close itself with evidence?
## §9 Recommendation: §13.34 trigger promotion status post-this-audit
```

---

## VERIFIER TEMPLATE (paste into each Sonnet Agent dispatch)

```text
You are a closure-audit verifier. ONE claim, ONE verdict. Self-contained: do NOT assume context from parent session.

CLAIM: {CLAIM}
SOURCE: {SOURCE_FILE_LINE}
EXPECTED_EVIDENCE_TYPE: {EXPECTED_EVIDENCE_TYPE}
NESTED_DEPTH: {NESTED_CLAIM_DEPTH}   (1 = top-level; 2 = also verify what the claim references)
WORKDIR: /Users/art/code/rules-as-tests-aif

VERIFICATION STEPS (run all, do not skip):

1. Read SOURCE at the exact file:line — confirm the literal text of CLAIM appears there. If not, return INCONCLUSIVE-source-mismatch.
2. Identify what artifact CLAIM asserts exists. Examples:
   - «PR #N merged» → expect: gh pr view N returns state:MERGED + mergeCommit on origin/main
   - «research-patch DONE» → expect: file exists in docs/meta-factory/research-patches/, ≥50 LOC, has §closure section
   - «R-phase DONE» → expect: research-patch + drafts directory referenced + §1.7 forward+backward present
   - «Phase -1 GO» → expect: state.md audit trail with iter-N findings + GO verdict + fixes visible in kickoff text
   - «principle test passing» → expect: file exists at packages/core/principles/<N>-*.test.ts AND `npm run --prefix packages/core test:principles` exits 0
3. Run the matching mechanical check (literal command, capture output).
4. Compare artifact contents against CLAIM wording. Specifically check:
   - Does artifact actually contain what CLAIM says it contains? (not just exists)
   - Was process-trail produced? (commits / VERIFY items run / REPORT structure)
   - Is there ambiguous «basically done» / «mostly verified» language signalling shortcut?
5. If NESTED_DEPTH=2: identify ≤2 references the artifact makes («supersedes X», «closes Y», «implements Z»). Verify each reference using steps 2-4 (one level deeper). Do not recurse further.

ANTI-LAZINESS:
- Do NOT propose fixes. Do NOT redo claimed work. Only verify.
- Every line of your REPORT must be either (a) command + literal output excerpt, OR (b) file:line + actual line content.
- If you don't have time/budget to verify: return INCONCLUSIVE with the SPECIFIC missing step, not «I'm not sure».

OUTPUT FORMAT (exact, parseable):

```
VERDICT: <CONFIRMED|SUSPICIOUS|FALSE|INCONCLUSIVE>
EVIDENCE:
- <command or file:line>: <output excerpt or line content>
- <command or file:line>: <output excerpt or line content>
REASONING: <one sentence why VERDICT, citing evidence above>
GAP (only if SUSPICIOUS or FALSE): <specific process step / evidence type missing>
NESTED_REFERENCES_VERIFIED: <N of N or N/A>
```text
```

---

## OPUS-ONLY (do not delegate)

1. Step 0 enumeration — only you have full context across surfaces
2. Choosing which 10-20 claims to audit (T10 — strategic sampling, not random)
3. Step 2 aggregation, §3 sampling-strategy write-up, §4 verdicts table
4. §5 escalations with proposed (NOT executed) remediation
5. §6+§7 §1.7 forward+backward — these are about YOUR audit, can't delegate
6. §8 §self-application — same
7. §9 recommendation on §13.34 promotion — surface as DECISION-NEEDED, do not pick

## SONNET-DELEGATED (use Agent tool, batches of 5-7)

- Per-claim verification using VERIFIER TEMPLATE (each subagent = one claim)
- Don't share context between subagents — each gets its own copy of template

## ECONOMY

- Single message dispatching 5-7 Agent tool calls = one batch
- Each Sonnet REPORT ≤500 words
- Aggregate after each batch (don't dispatch all 15-20 in one shot — pattern may emerge after first 5-7 to redirect strategy)
- Estimated total: ~30k Opus + ~80-120k Sonnet × $rate_sonnet ≈ much cheaper than 100% Opus

## VERIFY (before submitting final REPORT)

- [ ] §population enumeration ran first (not after sampling)
- [ ] N audited ≥10, ideally 15-20
- [ ] Every §4 row has file:line OR command+output evidence (T3)
- [ ] §6 forward-check has ≥1 file:line per discipline applied
- [ ] §7 backward-check has ≥1 file:line per prior-art sweep
- [ ] §8 self-application: explicit finding (not «N/A»)
- [ ] §9 surfaces §13.34 trigger status as DECISION-NEEDED, doesn't pick (`reviewer-discipline.md` §2)

## REPORT format back to maintainer

Когда закончил — приноси orchestrator (мне):

```text
## Closure audit REPORT 2026-05-17

**Status:** COMPLETE | PARTIAL (reason: …)
**Population:** N closure-claims enumerated
**Audited:** M of N (sampling: …)
**Verdicts:** X CONFIRMED / Y SUSPICIOUS / Z FALSE / W INCONCLUSIVE
**Escalations:** <count> with proposed remediation (in §5 of research-patch)
**§13.34 recommendation:** <status as DECISION-NEEDED, not picked>
**Research-patch path:** docs/meta-factory/research-patches/2026-05-17-closure-audit.md
**Worktree to clean up:** ../rules-as-tests-aif-closure-audit (delete after merge or keep as audit trail)
**Token cost actual:** ~Xk Opus + ~Yk Sonnet (sum of subagent costs from Agent tool returns)
```

---

## SELF-NOTE (read before starting)

This audit kickoff was authored by the same orchestrator session that committed incident #4. Apply discipline doubly:
- The very kickoff text you're reading may itself contain `#discipline-theatre` patterns. Surface them in §5/§9 if found.
- Don't take this kickoff's framings on trust — verify them against authoritative project rules (ai-laziness-traps, phase-research-coverage, reviewer-discipline) when in doubt.
- If you find this kickoff itself is closing on something not-done (e.g. asserting «4 incidents = threshold» without re-counting): surface that too.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
