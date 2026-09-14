# plain-words recap v2 — S4: the /arch round form and the /story rework (D-D, D-G)

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 census are binding.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Channel:** one Claude
> Code session, own worktree, one PR to `staging`. Review seat: **Opus**.
> **Rigor label (L0):** `research-grade` — this stage changes a marker LITERAL that four separate
> guard mechanisms match by exact string, and one of the matchers is an OR whose other half keeps
> the assertion green while the half under change stops testing anything.
> **Authoritative for:** the S4 contract — the fifteen literal-consumer files, the R-13 reuse, the
> exit gates, and the two false-green hazards this stage must close.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> D-D and D-G themselves, owned by
> [`plain-words-recap-v2-design.md:220`](../../../docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md)
> and `:306`.

**Measurement SHA for every `path:line` below:** `2fb69aa00d7d4d4b30f257c3d592f18f065570fc`.
**Five of the spec's own citations for this stage are stale** — umbrella §3.1 lists them. Use the
measured numbers here, not the spec's.

## §0 Two deliverables, one PR

**D-D — the `/arch` round form.** A round is: section 0 «Где мы» **ONCE** (goal + «принято в
прошлом раунде: …», including what a «го» or a silence accepted) + one FULL fork card per question
in the upstream `❓ Qn / ➡️` form + **ONE** closing line «от тебя: решить Qa, Qb; по Qc можно
молчать; „го" = принять все ➡️». That closing line **IS** the block's section 5 (the «решить: …»
value inside the D-B gate scope) — never a second one. Must-answer questions per round **≤ 4**
(the Claude Code `AskUserQuestion` cap of 1-4 × 2-4, cross-validated against Cursor — the only
cross-source numeric cap the prior-art pass found); a longer frontier splits by prerequisite depth,
roots first. Reversible forks may be left to the recommendation; taste, goal and irreversible forks
need an explicit answer. The carrier binding at [`arch/SKILL.md:50`](../../skills/arch/SKILL.md)
(c) is **unchanged** — verified at the measurement SHA, that line is the Frontier-pacing paragraph
and (c) is the round-carrier clause.

**Where D-D lands — name it here, because the first draft did not.** The spec's delivery list
(`docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md:505`) says «**/arch §1 round form**». `/arch` §1 is
[`arch/SKILL.md:42`](../../skills/arch/SKILL.md) (`## §1 Phase 1 — ideate + design (pure reuse)`),
and that section is the round form's destination: the round shape above is written INTO §1, next to
the Frontier-pacing paragraph at `:50` that already carries the round. Do not invent a new section
and do not put it in the hook packs — this deliverable is skill prose, and `arch/SKILL.md` is its
only file. If on reading §1 the fit is genuinely wrong, that is a fork for the operator, not a
choice to make silently.

**D-G — the `/story` rework.** Two halves: the marker LITERAL changes, and the body changes.

- **The literal** moves to the operator-ratified P-7 heading — RU `## 🎬 Что изменилось за сессию`,
  EN `## 🎬 What changed this session` — in `AIF_STORY_MARKER` of both packs. The reason it must
  move in the packs and not only in prose: the story-told guard is an **exact-literal** match
  (`grep -qF -- "$AIF_STORY_MARKER"`), so a P-7 wording that lives anywhere else would miss and the
  story would re-inject on the next stop.
- **The body** becomes the session-scale version of D-A instead of a chronicle by acts: **why all
  this was** (one sentence) → **what is different now** — per change: before, after, what it gives
  the operator, no chronology → **what was decided and by whom** (one line each) → **least sure** →
  **next**, in the D-B grammar. The text comes from **ONE lang-pack function shared with the
  recap**, taking a scope parameter (turn vs session), so the two forms cannot drift. The ratified
  RU example is in the spec's operator premise register, P-7.

**R-13 is already shipped** (slice 2): when the card was emitted before the `AskUserQuestion`
buttons, the recap block's fork section is ONE pointer line. The clause in
`aif_msg_eot_recap_contract` was written generally on purpose, to cover the `/arch` round case too —
read it before writing a second one. `.claude/hooks/lang/en.sh:83-85` is that clause and `:86` the
card call; the connector «Otherwise — the card in full:» / «Иначе — карточка целиком:» is what
separates the exception from the template. **Do not reopen that prose** — any edit there re-captures
the `f11-long-text-in-band` golden plus 8 install fingerprints plus the manifest.

## §1 The fifteen literal-consumer files — measured, not inherited

> **This table was wrong in the first draft** — it said «nine surfaces», listed twelve rows, and
> missed the two lines inside row 9 that matter most. A cold review re-ran the sweep. What follows
> is the re-run; run it yourself rather than trusting the table.

The spec names four. The predicate sweep returns **15 distinct files**:

```bash
git grep -l -E '🎬|AIF_STORY_MARKER|The story|Как это было|по актам|by acts' \
  2fb69aa00d7d4d4b30f257c3d592f18f065570fc -- . ':(exclude)docs/' \
  ':(exclude).superpowers/' ':(exclude).claude/orchestrator-prompts/' \
  ':(exclude)packages/getff/dist/'
```

| # | File | Lines at `2fb69aa00d7` | Named by spec | Literal edit? |
|---|---|---|---|---|
| 1 | `.claude/hooks/lang/en.sh` | `:197` (`AIF_STORY_MARKER='## 🎬 The story'`), `:206` | yes | **yes** |
| 2 | `.claude/hooks/lang/ru.sh` | `:196` (`'## 🎬 Как это было'`), `:205` | yes | **yes** |
| 3 | `plugin/hooks/lang/en.sh` | same lines — **hand-copied twin**, `cp` in the same commit | umbrella §2 item 1 | **yes** |
| 4 | `plugin/hooks/lang/ru.sh` | same lines — **hand-copied twin** | umbrella §2 item 1 | **yes** |
| 5 | `.claude/hooks/end-of-turn-reminder.sh` | **`:881`** (D-A gate's story exemption) and **`:927`** (the story-told guard) — NOT the spec's `:635-637` | wrong lines | **yes** |
| 6 | `plugin/hooks/end-of-turn-reminder` | `:882`, `:928` — **generated** by pre-commit, never hand-edit | implied | regenerated |
| 7 | `packages/core/hooks/end-of-turn-reminder.test.ts` | **`:1041`, `:1043`, `:1051`, `:1063`, `:1359`, `:1580`** — NOT `:691/:1009/:1230` | wrong lines | **yes** |
| 8 | `packages/core/skills/emit-story-prompt.test.ts` | `:20`, `:21`, `:25`, `:26`, `:30` (33 L total) | yes, correctly | **yes** |
| 9 | `tests/install-sh/gh-934-ship-eot-hook.test.sh` | **`:83`**, not `:82` | off by one | **yes** |
| 10 | **`.claude/skills/story/SKILL.md`** | `:3`, `:8`, `:28`, `:44`, `:52` — plus the «by acts» sentence straddling `:25-26` | **NO — the gap** | **yes, all** |
| 11 | `packages/core/hooks/lang-parity.test.ts` | `:79`, `:83` — matches the NAME `AIF_STORY_MARKER=`, not its value | **NO** | no — name-only |
| 12 | `.claude/hooks/lang/check-parity.sh` | `:31` — probes for `^AIF_STORY_MARKER=` by NAME | **NO** | no — name-only |
| 13 | `plugin/hooks/lang/check-parity.sh` | `:31` — hand-copied twin of row 12 | **NO** | no — name-only |
| 14 | `.claude/skills/story/helpers/emit-story-prompt.sh` | `:8` (the SSOT comment) | path never given | **yes** |
| 15 | `scripts/measure/README.md` | `:34`, `:62`, `:94` — three rows keyed on `## 🎬` | **NO** | **yes** |

**Inclusion criterion:** every file the predicate returns is listed, name-only matches included,
each with its disposition. Rows 11-13 need no edit because they match the variable name and not
its value — but they are in the table, because an unstated criterion is how the first draft kept
row 11 and dropped rows 12-13, which have exactly the same shape.

**Row 10 is the load-bearing omission, and `:3` and `:8` are its sharpest edges.**
[`story/SKILL.md`](../../skills/story/SKILL.md) *commands* the by-acts chronicle in five places:

- **`:3`** — the `description:` frontmatter («…story, recap, «по актам».»). This is the field a
  model matches on to route to `/story` at all, and the field
  [`skill-description-quality.md`](../../rules/skill-description-quality.md) governs. Leaving it
  makes the skill advertise the chronicle D-G removes.
- **`:8`** — the `> **Authoritative for:**` header («session recap narrated as a story by acts»).
  The skill's own claim about what it is. Leaving it contradicts the body one level up.
- **`:25-26`** — «open in one sentence, then by / acts (named files / PRs / decisions)». The
  sentence straddles two lines, which is why a single-line grep does not return `:25`; edit the
  sentence, not the line number.
- **`:44`** — inside `## With this skill` (`:39`, body `:41-45`): «narrates the whole session as a
  story — by acts». **This is NOT the `## Without this skill` paragraph** — that heading is `:32`
  and its body `:34-37` carries nothing to change. The first draft misattributed it.
- **`:52`** — the paired-negative («reads as a narrative by acts»). Update it so it still
  falsifies something rather than asserting the removed shape.

## §2 The two false-green hazards

1. **`gh-934-ship-eot-hook.test.sh:83` is a sibling-channel false green.** The assertion is
   `grep -qE 'Простыми словами|Как это было'` — an **OR** across the recap marker and the story
   marker. Arm (E) fires on the recap path, so `Простыми словами` matches; if the story literal
   changes and nobody updates this line, the assertion stays green while the story half tests
   nothing at all. Split it into two assertions, or pin the story literal separately. This is the
   `sibling-channel false green` class: once two components share a channel, a test of one passes
   on the other's side effect.
2. **`emit-story-prompt.test.ts:21`/`:26` assert «by acts» / «по актам» on purpose, and D-G inverts
   them.** Updating them in the same commit is intentional, not collateral — say so in the commit
   body, or the next reader reads it as a weakened test. State in the PR body what the assertion
   asserts AFTER the change, and show it going red on the pre-change text.

## §3 Regeneration order (umbrella §2 item 4, restated because this stage triggers all of it)

Both packs change → `cp` the two `plugin/hooks/lang/*.sh` twins → pre-commit regenerates
`plugin/hooks/end-of-turn-reminder` → `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` →
`bash scripts/build-getff-dist.sh` → sweep. **Measure the drift BEFORE each capture.** The expected
derived set for a two-pack literal change is the two packs, their two twins, the generated hook
twin, `.ai-factory/refresh-baseline.json`, the 8 install fingerprints and
`packages/getff/MANIFEST.sha256`. A path outside that set is a STOP.

## §4 Exit gates

Umbrella §7 host-verify contract, plus:

```bash host-verify
PC_LOCAL=1 npx vitest run packages/core/hooks/end-of-turn-reminder.test.ts --testTimeout=90000
PC_LOCAL=1 npx vitest run packages/core/skills/emit-story-prompt.test.ts
PC_LOCAL=1 npx vitest run packages/core/hooks/lang-parity.test.ts
bash tests/install-sh/gh-934-ship-eot-hook.test.sh
bash .claude/hooks/lang/check-parity.sh
```

Plus a **mutation check on the story-told guard**: set the pack literal to the new P-7 heading,
feed the hook a turn whose text carries the OLD literal, and show the guard does NOT suppress —
that is the exact regression D-G's literal move exists to prevent, and an assertion that only reads
the new literal cannot see it.

## §5 Falsifiers to write into the PR body

- The story branch re-injects after a `## 🎬` story was told → the guard's literal and the pack's
  disagree (R-5).
- The operator sees the same fork card twice in one `/arch` round → R-13's pointer clause is not
  being reached from the round path.
- The D-B gate rejects a well-formed `/arch` round turn → the closing «от тебя» line is not being
  read as the block's section 5 (R-17).
- A round asks five must-answer questions → the ≤4 cap is prose, not a mechanism.
- `gh-934` stays green with the story literal changed and its line untouched → hazard 1 not closed.

## §6 Out of scope

The glossary (S3). Anything under D-H (S5). The `## 🟢` recap block's own five sections — slices 1
and 2 own them; the only recap-side touch here is the SHARED function D-G's body reuses.

## §7 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3** command-or-`file:line` for every finding · **T2** run the sweep, do not describe it ·
**T19** own cold review before handoff · **T21** cold `agents/backward-sweep-auditor.md` on the
class «a literal matched by exact string across generated twins, shipped payloads and an OR-shaped
test assertion».

**The class-specific trap for S4: sweep by predicate, never by spelling.** §1 is a live instance —
the spec's four-item list missed eleven of the fifteen files the predicate returns, because it was
assembled by recalling files rather than by enumerating the predicate — and so was the first draft
of §1 itself. When you change the literal, re-run the sweep against your own
pinned SHA and diff the surface list against §1; a surface that appears in yours and not in mine is
a finding, not a discrepancy to smooth over.
