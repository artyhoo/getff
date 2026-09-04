# Kickoff — `/pipeline` i18n fix (output language follows `AIF_HOOK_LANG`)

> **Type:** I-phase (implementation). Single atomic PR. **Dispatch target:** aif-handoff autonomous worker.
> **Self-contained:** this kickoff embeds every exact change. It is executable on the current `staging` base alone — all files it touches already exist there. The plan/spec links below are operator references; do NOT make execution depend on reading them (they may not be present in the container base).

## Goal (one line)

Make the `/pipeline` skill render its **whole report** in the operator's language (not just the column labels) by emitting an output-language directive — the same hook-style mechanism the recap hook already uses.

## Why (the bug, with evidence)

- `/pipeline` localizes only short UI tokens — `.claude/skills/pipeline/lang/ru.sh` defines column headers / status words (`AIF_PIPELINE_COL_WHEN='Когда'`, …) but **no output-language directive**. `SKILL.md` is English. Result: the model writes its analysis prose in English and only swaps the labels → the operator's report drifts to English.
- The Stop-hook recap (`## 🟢 …`) does NOT drift: it injects a wholly-localized instruction, so output follows `AIF_HOOK_LANG`. This fix applies that hook-style approach to `/pipeline`: add a directive token that tells the model to write the entire report in the active language.

## Scope (STRICT — read before touching anything)

- **IN scope:** `.claude/skills/pipeline/` lang packs + emit helper + SKILL.md, its vitest, and a one-line note in the existing pipeline-i18n spec.
- **OUT of scope (do NOT touch):** the `/story` skill, the `.claude/hooks/` recap hooks, `aif_msg_eot_branch_story`, any non-pipeline file. There is a sibling `/story` effort; it is a **separate PR**. Touching it here is scope creep (trap T-PipeI18n-A below).

## Tasks (TDD; exact edits)

### Task 1 — output-language directive token (TDD)

1. **Failing test first.** In `packages/core/skills/emit-output-strings.test.ts`, add inside `describe('emit-output-strings.sh', ...)`:
   ```typescript
   it('default emits the English output-language directive', () => {
     const out = run(undefined);
     expect(out).toMatch(/AIF_PIPELINE_OUTPUT_DIRECTIVE=Write the entire report in English\./);
   });

   it('AIF_HOOK_LANG=ru emits the Russian output-language directive', () => {
     const out = run('ru');
     expect(out).toMatch(/AIF_PIPELINE_OUTPUT_DIRECTIVE=Сформируй весь отчёт на русском языке\./);
   });
   ```
2. Run `npx vitest run packages/core/skills/emit-output-strings.test.ts -t directive` → expect **FAIL** (key not emitted).
3. **Implement.** Append to `.claude/skills/pipeline/lang/en.sh`:
   ```bash
   AIF_PIPELINE_OUTPUT_DIRECTIVE='Write the entire report in English.'
   ```
   Append to `.claude/skills/pipeline/lang/ru.sh`:
   ```bash
   AIF_PIPELINE_OUTPUT_DIRECTIVE='Сформируй весь отчёт на русском языке.'
   ```
   In `.claude/skills/pipeline/helpers/emit-output-strings.sh`, add `AIF_PIPELINE_OUTPUT_DIRECTIVE` as the FIRST key of the `for k in …` loop:
   ```bash
   for k in AIF_PIPELINE_OUTPUT_DIRECTIVE AIF_PIPELINE_COL_PASTE AIF_PIPELINE_COL_WHEN AIF_PIPELINE_COL_WAITING \
   ```
4. Run `npx vitest run packages/core/skills/emit-output-strings.test.ts` → expect **PASS**.
5. Run `bash .claude/skills/pipeline/lang/check-parity.sh` → expect `OK` (the new `AIF_PIPELINE_*` key is auto-checked by the existing grep; do NOT edit the parity script).
6. Commit:
   ```text
   fix(pipeline): emit AIF_PIPELINE_OUTPUT_DIRECTIVE so report output follows AIF_HOOK_LANG

   Prior-art: skipped — i18n fix to existing shipped skill, no new capability/dependency.
   ```

### Task 2 — surface the directive in SKILL.md

1. In `.claude/skills/pipeline/SKILL.md`, find the paragraph beginning `**Output language (i18n):**` (grep for that literal). After the sentence that lists the emitted `AIF_PIPELINE_*` values, add:
   ```markdown
   **Crucially, obey `AIF_PIPELINE_OUTPUT_DIRECTIVE` (also emitted): write the ENTIRE report — all prose, not only the column headers/labels — in the language it names.** Localizing only the labels (the prior behaviour) let the generated prose drift to English; the directive is what keeps the whole output in the operator's language (hook-style). Default is English; `AIF_HOOK_LANG=ru` yields a fully Russian report.
   ```
2. Sanity: `sed -n '455,475p' .claude/skills/pipeline/SKILL.md` reads cleanly.
3. Commit:
   ```text
   fix(pipeline): SKILL.md surfaces AIF_PIPELINE_OUTPUT_DIRECTIVE (write whole report in active lang)

   Prior-art: skipped — doc/instruction edit to existing skill, no new capability.
   ```

### Task 3 — note in the existing pipeline-i18n spec

1. In `docs/superpowers/specs/2026-06-03-pipeline-skill-i18n-design.md`, after the `> **Origin:** …` blockquote, insert:
   ```markdown
   > **Update (2026-06-16):** the token-only approach localized labels but NOT the
   > model's generated prose, so RU-operator output drifted to English. Superseded for
   > output language by an explicit `AIF_PIPELINE_OUTPUT_DIRECTIVE` (hook-style full
   > directive that names the report's output language).
   ```
   (Self-contained — no cross-link to a file that may be absent from the container base.)
2. Commit:
   ```text
   docs(spec): note pipeline output-language superseded by hook-style directive

   Prior-art: skipped — doc pointer note, no capability.
   ```

## Acceptance criteria (verify before opening the PR)

- `npx vitest run packages/core/skills/emit-output-strings.test.ts` → all green (incl. the 2 new directive cases).
- `bash .claude/skills/pipeline/lang/check-parity.sh` → `OK`.
- Live smoke: `AIF_HOOK_LANG=ru bash .claude/skills/pipeline/helpers/emit-output-strings.sh | grep OUTPUT_DIRECTIVE` → `AIF_PIPELINE_OUTPUT_DIRECTIVE=Сформируй весь отчёт на русском языке.`
- Default smoke: same without `AIF_HOOK_LANG` → English directive.
- `git diff` touches ONLY the 5 in-scope files. No `/story`, no `.claude/hooks/` change.

## AI-laziness traps — REQUIRED (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Active traps for this I-phase: T3, T5, T15, T16, T19** + two domain-specific (below).

- **T3** (plausible finding without verification): every claim of "passes" must be backed by the actual `vitest`/`check-parity`/smoke command output pasted into the report — no prose-only "looks fine".
- **T5** (bundling out-of-scope fixes): do the pipeline change ONLY. If you notice something in `/story` or the hooks, note it in the report — do NOT edit it.
- **T15** (self-application): the fix itself must be test-covered — the 2 directive cases ARE that coverage; do not skip them "because it's a one-liner".
- **T16** (pattern-matching-on-name): the build-vs-reuse survey is already done (REJECT `session-report`, REFERENCE `claude-recap`); do NOT re-adopt a companion — this is a known fix, just implement it.
- **T19** (own cold-QA before handoff): before opening the PR, re-read your own diff as a fresh reviewer and run the FULL acceptance block — CI-green is not a substitute for reading the diff.
- **T-PipeI18n-A** (theme-creep): "both `/story` and `/pipeline` are i18n, let me fix both" → NO. This PR is pipeline-ONLY. The `/story` work is a separate PR with its own kickoff.
- **T-PipeI18n-B** (directive-emitted ≠ output-flipped): emitting `AIF_PIPELINE_OUTPUT_DIRECTIVE` is NOT proof the model writes the whole report in Russian — that is model behaviour, not mechanically asserted by the emit test. State this explicitly as the **least-certain item**: the test proves the token is emitted + surfaced; whether the model fully obeys is verified only by a live `/pipeline` run, which the operator does post-merge. Do NOT claim "output is now Russian" as mechanically proven.

## Genuine-fork → PARK, do not guess

This work is fully specified; you should not hit a real fork. **If you do** (e.g. the SKILL.md i18n paragraph has moved/changed shape and the insert point is ambiguous, or a test fails for a reason not covered here) — do NOT guess and do NOT silently pick. **Park the task and ask the operator** (aif park primitive). A genuine fork = no clearly-better option on the merits; surface it. A clear call (one option obviously correct) → make it and say what you did.

## PR strategy / egress

- One atomic PR, base **`staging`**, title: `fix(pipeline): output language follows AIF_HOOK_LANG (hook-style directive)`.
- PR body MUST include the §1.7 self-check the CI gate (`discipline-self-check.yml`) requires: a `### §1.7 Forward-check applied` and a `### §1.7 Backward-check applied` heading, EACH with a concrete `file:line` citation.
- **Stop after opening the PR — do NOT merge.** The operator reviews and merges.

## Operator references (may be absent from the container base — do not depend on them)

- Plan: `docs/superpowers/plans/2026-06-16-pipeline-i18n-fix.md`
- Spec: `docs/superpowers/specs/2026-06-16-session-story-recap-design.md` §Component 4
- Sibling effort (separate PR): `/story` recap — `docs/superpowers/plans/2026-06-16-session-story-recap.md`

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
