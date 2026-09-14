# plain-words recap v2 — S4: the /arch round form and the /story rework (D-D, D-G)

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 census are binding.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Channel:** one Claude
> Code session, own worktree, one PR to `staging`. Review seat: **Opus**.
> **Rigor label:** `production-grade` — this stage changes a marker LITERAL that four separate
> guard mechanisms match by exact string, and one of the matchers is an OR whose other half keeps
> the assertion green while the half under change stops testing anything.
> **Authoritative for:** the S4 contract — the nine literal-consumer surfaces, the R-13 reuse, the
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

## §1 The nine literal-consumer surfaces — measured, not inherited

The spec names four. A predicate sweep (`🎬` / `AIF_STORY_MARKER` / `The story` / `Как это было` /
`по актам` / `by acts`) over the whole tree minus `docs/`, `.superpowers/`,
`.claude/orchestrator-prompts/` and `packages/getff/dist/` returns **nine surfaces**:

| # | Surface | Lines at `2fb69aa00d7` | Named by spec |
|---|---|---|---|
| 1 | `.claude/hooks/lang/en.sh` | `:197` (`AIF_STORY_MARKER='## 🎬 The story'`), `:206` | yes |
| 2 | `.claude/hooks/lang/ru.sh` | `:196` (`'## 🎬 Как это было'`), `:205` | yes |
| 3 | `plugin/hooks/lang/{en,ru}.sh` | same lines — **hand-copied twins**, `cp` in the same commit | umbrella §2 item 1 |
| 4 | `.claude/hooks/end-of-turn-reminder.sh` | **`:881`** and **`:927`** — NOT the spec's `:635-637` | wrong lines |
| 5 | `plugin/hooks/end-of-turn-reminder` | `:882`, `:928` — **generated** by pre-commit, never hand-edit | implied |
| 6 | `packages/core/hooks/end-of-turn-reminder.test.ts` | **`:1041`, `:1043`, `:1051`, `:1063`, `:1359`, `:1580`** — NOT `:691/:1009/:1230` | wrong lines |
| 7 | `packages/core/skills/emit-story-prompt.test.ts` | `:20`, `:21`, `:25`, `:26`, `:30` (33 L total) | yes, correctly |
| 8 | `tests/install-sh/gh-934-ship-eot-hook.test.sh` | **`:83`**, not `:82` | off by one |
| 9 | `.claude/skills/story/SKILL.md` | `:25`, `:28`, `:43-44`, `:52` | **NO — the gap** |
| 10 | `packages/core/hooks/lang-parity.test.ts` | `:79`, `:83` | **NO** |
| 11 | `.claude/skills/story/helpers/emit-story-prompt.sh` | `:8` (the SSOT comment) | path never given |
| 12 | `scripts/measure/README.md` | `:34`, `:62`, `:94` — three rows keyed on `## 🎬` | **NO** |

(Rows 3 and 5 are the twin halves of rows 1-2 and 4, so the spec's «four consumers» becomes nine
distinct files; the numbering above is the sweep's, not a count of files.)

**Row 9 is the load-bearing omission.** [`story/SKILL.md`](../../skills/story/SKILL.md) *commands*
«by acts» in three places — `:25` («then by acts (named files / PRs / decisions)»), the
`## Without this skill` paragraph at `:43-44` («narrates the whole session as a story — by acts»),
and the paired-negative `:52` («reads as a narrative by acts»). D-G replaces the by-acts chronicle
with the session-scale D-A sections. Shipping D-G without row 9 leaves the skill's own text
contradicting the instruction the hook emits, on the exact surface a model reads to decide what to
write. Update all three, and update the paired-negative so it still falsifies something.

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

```bash
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
the spec's four-item list missed four surfaces because it was assembled by recalling files rather
than by enumerating the predicate. When you change the literal, re-run the sweep against your own
pinned SHA and diff the surface list against §1; a surface that appears in yours and not in mine is
a finding, not a discrepancy to smooth over.
