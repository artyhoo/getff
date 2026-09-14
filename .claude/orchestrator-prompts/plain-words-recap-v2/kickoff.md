# plain-words recap v2 — umbrella kickoff (stage index for slices 3–5)

> **Class:** umbrella kickoff (stage index). **Base branch:** `staging`. One PR to `staging` per stage.
> **Type:** I-phase (execution — three stages, each shipping code plus its gates).
> **Rigor label (L0):** `research-grade` — every stage in this umbrella edits consumer-shipped
> payload (lang packs, installed hooks, installed docs), so the cheap label would be dishonest.
> **Authoritative for:** the stage split for slices 3–5, the cross-stage non-negotiables (§2), the
> measured citation census the stages must use instead of the spec's own line numbers (§3), the
> dispatch order (§4), and the host-verify contract (§7).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the design decisions D-A…D-I and the R-row register, owned by
> [`2026-09-13-plain-words-recap-v2-design.md`](../../../docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md).

**Measurement SHA for every `path:line` in this umbrella and in every stage kickoff:**
`2fb69aa00d7d4d4b30f257c3d592f18f065570fc` (`origin/staging`, 2026-09-14, the commit after
slice 2 merged). Every file cited was read at that one ref. **Sibling worktrees share this
repo's refs and move `origin/staging` under a running session** — that is how the census below
was first taken at `17c364e279d` and re-read at `2fb69aa00d7` mid-command. Re-measure against
your own pinned SHA before trusting any number here; do not inherit.

## §0 What already landed — slices 0, 1, 2

| Slice | What it shipped | Merged |
|---|---|---|
| 0 | `scripts/measure/` — the vendored measurement scripts behind every table row in the spec | [PR 1742](https://github.com/artyhoo/getff/pull/1742) (`cf598f85364`) |
| 1 | Lang packs + Stop hook: the D-A section gate at `.claude/hooks/end-of-turn-reminder.sh:880`, `_eot_turn_shape()`, `AIF_RECAP_GATE` + [`scripts/register-recap-gate.sh`](../../../scripts/register-recap-gate.sh), the D-B «от тебя» grammar, the D-C card function `aif_msg_fork_card`, the D-I anchor fix, goldens regenerated once | [PR 1763](https://github.com/artyhoo/getff/pull/1763) (`b07f05533d3`) |
| 2 | `ask-question-reminder.sh` calls the shared card instead of restating the fork contract; card before the `AskUserQuestion` buttons with the recommendation as the FIRST option; the R-13 pointer clause in `aif_msg_eot_recap_contract` in both packs | [PR 1771](https://github.com/artyhoo/getff/pull/1771) (`17c364e279d`) |

**Operator directive P-10** (spec `:581`): «0-2 в сессии, 3-5 фабрика» — slices 0–2 ran in an
attended session; slices 3–5 are dispatched from these kickoffs. This file and its three stage
kickoffs are the dispatch inputs; nobody implemented any part of slices 3–5.

## §1 Stages

One stage = one PR to `staging` = one executor session. Never two stages in one session: they
share `.claude/hooks/lang/{en,ru}.sh` and every edit there re-opens the same three blocking
regenerations (§2 item 4), so parallel stages conflict on generated artefacts by construction.

| Stage | Owns | Kickoff |
|---|---|---|
| **S3 — glossary** (D-F) | `CONTEXT.md`, the `UserPromptSubmit` hook + its registration script, the two counters, the `check-parity.sh` `AIF_GLOSSARY_` probe, principle 42 going active, the D-H11 amendment | [`kickoff-s3.md`](kickoff-s3.md) |
| **S4 — round form + story** (D-D, D-G) | the `/arch` round form, the story marker literal in both packs, the `/story` body rework, and the **fifteen** literal-consumer files §3.2 measured (the spec names four, two of them staled) | [`kickoff-s4.md`](kickoff-s4.md) |
| **S5 — autonomy** (D-H) | D5a/D5b/D5c, the D6 subagent tenets + principle 29 narrowing + corpus snapshot, the D7 launch card | [`kickoff-s5.md`](kickoff-s5.md) |

**Channel:** a Claude Code session per stage, own worktree, `superpowers:subagent-driven-development`
if the executor wants the per-task review loop. Every review seat is **Opus** — standing operator
directive from the slice-2 session, carried forward because the defects slices 1 and 2 shipped and
then caught (a prose gap that would have made a model emit two cards; two stale `path:NN` citations)
were both reviewer-catch, not gate-catch.

## §2 Non-negotiables — binding on all three stages

1. **`plugin/hooks/lang/*.sh` are HAND-maintained byte-identical copies.**
   `scripts/generate-plugin-twins.sh` iterates `.claude/hooks/*.sh` only and never descends into
   `lang/`; [`packages/core/hooks/lang-parity.test.ts:150`](../../../packages/core/hooks/lang-parity.test.ts)
   asserts byte identity of the content. Editing a lang pack means `cp` to the twin in the same
   commit. The hooks WITHOUT `.sh` (`plugin/hooks/end-of-turn-reminder`,
   `plugin/hooks/ask-question-reminder`) ARE generated — never hand-edit those.
2. **Never hand-edit `plugin/hooks/*.sh`; DO hand-edit `plugin/hooks/lang/*`.** The two rules above
   are one rule seen from both sides; they contradict only if you read `lang/` as a subdirectory of
   the generated set, which the generator script proves it is not.
3. **Never edit `.claude/settings.json`.** Four separate channels refuse it (the file's own
   `permissions.deny`, and the auto-mode `[Self-Modification]` guard on `cp`, `git checkout -b` in a
   worktree, and `git commit` of it) — measured 2026-09-14, [CLAUDE.md `See also`](../../../CLAUDE.md).
   A stage that needs a settings delta ships a `scripts/register-*.sh` script and hands the operator
   the invocation line. That is the whole reason D-E exists.
4. **Three blocking regenerations, in this order, after any lang-pack edit:**
   plugin twins (`cp`) → `SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh` →
   `bash scripts/build-getff-dist.sh` → then re-run the sweep. **Measure the drift BEFORE each
   capture.** A derived path that no edit in the diff explains is a STOP, not a reason to capture
   and close the red.
5. **Every vitest run is `PC_LOCAL=1 npx vitest run …`.** `pc-run npx vitest` once reported 79
   phantom failures against an identical tree.
6. **Merge-forward, never rebase or force-push.** Force-push is permission-classifier-blocked for
   agents in every form; [`git-conflict-merge-forward.md`](../../rules/git-conflict-merge-forward.md)
   is the recipe. Generated artefacts that conflict are **regenerated from the merged source tree
   and then proven equal to a fresh assembly** — never hand-merged, because a hand-merged hash file
   is a file no generator would ever emit.
7. **PR body:** `## Fidelity verdict` + the §1.7 Forward-check / Backward-check sections with
   `path.ext:NN` citations, and `## Provenance` as the bare marker `n/a` **and nothing else** — the
   fidelity gate filters that section line-by-line
   ([`pr-body-fidelity.ts:121`](../../../packages/core/hooks/checks/pr-body-fidelity.ts) opens `declaresProvenance()`; the line-by-line filtering is in its body, `:127-133`) and any
   surviving line classifies the PR as a factory stage PR, which forbids `FIDELITY: skipped`.
   Authoring narrative goes in `## Summary`. Validate before pushing:
   `PC_LOCAL=1 BASE_REF=staging HEAD_SHA=<sha> PR_BODY="$(cat body.md)" npx tsx packages/core/hooks/checks/pr-body-fidelity-bin.ts`.
   Never batch a body edit with `gh pr create`; a PR-body gate is never `rerun` — edit the body to
   raise a NEW event.
8. **CI:** one Bash call with `timeout: 600000` running `~/.claude/scripts/ci-wait.sh <PR> --repo artyhoo/getff`.
   Never sleep-loop. Verify against the **EXPLICIT head SHA**
   (`gh api repos/artyhoo/getff/commits/<sha>/check-runs`), never the PR-level rollup;
   `ci-success` ABSENT is not green. `ci-success` is the single required aggregate
   ([`audit-self.yml:2041`](../../../.github/workflows/audit-self.yml)); `autolabel PR from
   conventional-commit title` is **not** in its `needs:` and gates nothing — it 404'd twice on
   [PR 1771](https://github.com/artyhoo/getff/pull/1771) and passed on an unchanged rerun.
9. **You merge your own `staging` PR** (`gh pr merge --squash`) once `ci-success` is success and
   `mergeStateStatus` is `CLEAN`. No `--delete-branch` while a worktree holds the branch.
10. **Forks resolve by LAYER** — spec beats plan, plan beats this kickoff. Write the ruling AND its
    falsifier into your ledger. Go to the operator only when no layer settles it. There is no
    ADVISOR seat (operator directive P-AK).
11. **Address the operator in Russian; keep every repo artifact in English** — code, comments,
    commit and PR bodies, kickoffs, specs. No attribution lines in commit messages or PR bodies.
12. **Never `scripts/register-recap-gate.sh` in a writing mode** (`--user` default or `--project`)
    from an agent session — only `--print-root`, `--print-target`, `--help`. The same standing
    constraint will apply to `register-glossary-hook.sh` the moment S3 ships it.

## §3 Measured census — the spec's own citations, re-read at `2fb69aa00d7`

The spec was written 2026-09-13. `staging` has moved through slices 0–2 plus unrelated PRs since.
**Five of its citations are now stale and TWO of its enumerations are incomplete (§3.2).** Each stage kickoff repeats the rows
it owns; this table is the whole set in one place.

### §3.1 Stale — do not use the spec's number

| Spec says | Spec's claim | Measured at `2fb69aa00d7` | Use instead |
|---|---|---|---|
| `end-of-turn-reminder.sh:635-637` | the story-told guard | `:635` is `gate_line="$(aif_msg_eot_compact_out_of_band …)"` | the literal is consumed at **`:881`** — the D-A recap gate's story exemption, inside the `if` opened at `:880` — and at **`:927`**, which IS the story-told guard (`# Story already told this turn → do not re-inject.` at `:926`). Both must move; only `:927` deserves the name |
| `end-of-turn-reminder.test.ts:691` | a story-literal consumer | `const RECAP_EN = '## 🟢 In plain words…'` | see §3.2 — the real consumers are `:1041`, `:1043`, `:1051`, `:1063`, `:1359`, `:1580` |
| `end-of-turn-reminder.test.ts:1009` | a story-literal consumer | a comment about a previous turn containing `## 🟢` | as above |
| `end-of-turn-reminder.test.ts:1230` | a story-literal consumer | `// ---- Part B: thin-recap branch …` | as above |
| `gh-934-ship-eot-hook.test.sh:82` | the `\|Как это было` alternation | `:82` is the `jq -r '.decision'` check | the alternation is **`:83`** |

### §3.2 Incomplete — the spec's file list is shorter than the predicate sweep

> **Both enumerations below were WRONG in the first draft of this kickoff, in the same way the
> spec is wrong: assembled by recalling files instead of by running the declared predicate.** A
> cold review re-ran both and found them under- and over-counted. They are restated here from the
> re-run. Run the commands yourself before using either — that is the point of the section.

**Story marker literal (D-G).** The spec names four consumers. The predicate returns **15 distinct
files**:

```bash
git grep -l -E '🎬|AIF_STORY_MARKER|The story|Как это было|по актам|by acts' \
  2fb69aa00d7d4d4b30f257c3d592f18f065570fc -- . ':(exclude)docs/' \
  ':(exclude).superpowers/' ':(exclude).claude/orchestrator-prompts/' \
  ':(exclude)packages/getff/dist/'
```

**Inclusion criterion — stated because the first draft had none.** Every file the predicate
returns is listed, including files that match the variable NAME rather than its value. A name-only
match does not break when the literal changes, so it needs no edit — but it belongs in the table
with that disposition written down. Keeping `lang-parity.test.ts` (name-only) while dropping
`check-parity.sh` (name-only) is not a criterion, it is an oversight.

| Surface | Lines | Named by the spec? | Needs a literal edit? |
|---|---|---|---|
| `.claude/hooks/lang/{en,ru}.sh` | `:197`/`:206` (en), `:196`/`:205` (ru) | yes | **yes** |
| `plugin/hooks/lang/{en,ru}.sh` | same lines — hand-copied twins | implied by §2 item 1 | **yes** |
| `.claude/hooks/end-of-turn-reminder.sh` | `:881`, `:927` | yes, at the wrong lines | **yes** |
| `plugin/hooks/end-of-turn-reminder` | `:882`, `:928` — generated twin | implied | regenerated |
| `packages/core/hooks/end-of-turn-reminder.test.ts` | `:1041`, `:1043`, `:1051`, `:1063`, `:1359`, `:1580` | yes, at the wrong lines | **yes** |
| `packages/core/skills/emit-story-prompt.test.ts` | `:20`, `:21`, `:25`, `:26`, `:30` | yes, correctly | **yes** |
| `tests/install-sh/gh-934-ship-eot-hook.test.sh` | `:83` | yes, off by one | **yes** |
| **`.claude/skills/story/SKILL.md`** | `:3`, `:8`, `:28`, `:44`, `:52` — and the «by acts» sentence straddling `:25-26`, which no single-line grep returns | **NO — this is the gap** | **yes, all of them** |
| **`packages/core/hooks/lang-parity.test.ts`** | `:79`, `:83` — drops `AIF_STORY_MARKER=` by NAME and expects the failure | **NO** | no — name-only |
| **`.claude/hooks/lang/check-parity.sh`** | `:31` — probes for `^AIF_STORY_MARKER=` by NAME | **NO** | no — name-only |
| **`plugin/hooks/lang/check-parity.sh`** | `:31` — hand-copied twin of the above | **NO** | no — name-only |
| **`.claude/skills/story/helpers/emit-story-prompt.sh`** | `:8` (the SSOT comment) | the spec writes a bare `emit-story-prompt.sh` — this is its real path | **yes** |
| **`scripts/measure/README.md`** | `:34`, `:62`, `:94` — three rows keyed on `## 🎬` | **NO** | **yes** |

`.claude/skills/story/SKILL.md` is the load-bearing omission, and **`:3` and `:8` are the two
lines inside it that matter most** — the first draft of this table missed both. `:3` is the skill's
`description:` frontmatter, the field a model matches on to route to `/story` at all and the field
[`skill-description-quality.md`](../../rules/skill-description-quality.md) governs. `:8` is the
skill's own `> **Authoritative for:**` header. D-G replaces the by-acts chronicle with the
session-scale D-A sections; an executor who edits only the body ships a skill whose routing
description and authority header still command the chronicle D-G just removed.

**`aif-doctor` GO sites (D5c).** All eleven lines the spec names (`:41, :88, :90, :91, :94, :100,
:104, :105, :244, :256, :307`) still land on their intended content — no drift, verified line by
line. The predicate sweep returns **24**, not the 22 an earlier draft claimed:

```bash
git show 2fb69aa00d7d4d4b30f257c3d592f18f065570fc:.claude/skills/aif-doctor/SKILL.md \
  | grep -nE '\bGO\b' | cut -d: -f1
# 23 41 67 69 70 88 90 91 94 100 104 105 150 198 199 210 227 229 241 244 247 256 307 320
```

Thirteen are outside the spec's eleven: `:23`, `:67`, `:69`, `:70`, `:150`, `:198`, `:199`, `:210`,
`:227`, `:229`, `:241`, `:247`, `:320`. Four of those carry decision class and D5c must move them
with the split:

- `:23` — the file's own `> **Authoritative for:**` header, which states the
  «mutation-needs-GO» flow;
- `:150` — a positive «No GO needed — both are the existing Tier-1 heals» ruling;
- `:198`/`:199` — Tier-2 review-park release and bijection reset;
- `:210`/`:229` — the Tier-1 / Tier-2 definitions themselves;
- `:320` — the `recommendation-laziness-discipline.md` cross-reference restating the split.

**`:114` is NOT a GO site and the first draft wrongly listed it.** Its text is «**Go** straight to
§3.1 Fix D» — an ordinary imperative verb, reachable only by a case-insensitive sweep. Its presence
in the earlier list is the proof the list was produced by a looser predicate than the one declared:
the exact failure this section exists to name.

S5 sweeps by the predicate above and classifies all 24. A stage that classifies 22 and reports
«all GO sites classified» reports something false.

### §3.3 Verified correct — use as written

`packages/core/skills/emit-story-prompt.test.ts:20-26` · `.claude/skills/arch/SKILL.md:50`
(binding (c), the round carrier) ·
harmonization spec `:138` (the D-H11 `ADOPT … as-is` row) · `.claude/skills/pipeline/SKILL.md:389` (the
`#worker-dispatch-via-subagent` bullet) · `29-worker-dispatch-channel.ts:60` (`READONLY_CONTEXT_RE`) ·
`CLAUDE.md:91` and `:140` · `end-of-turn-reminder.sh:536` (the anchor `grep`) ·
`.claude/hooks/lang/check-parity.sh:26-34` (`keys()` collects `aif_msg_*`, the two markers,
`AIF_EOT_*` — and nothing
else, so the spec's F8 concern is live: a `AIF_GLOSSARY_*` key added to one pack only would pass
parity and abort the other pack's hook under `set -u`).

### §3.4 Absent at `2fb69aa00d7` — S3/S5 create these

`CONTEXT.md` · `scripts/register-glossary-hook.sh` · `packages/core/hooks/glossary-counters.test.ts` ·
`packages/core/principles/fixtures/29-corpus-verdicts.json`. Present and reusable:
`scripts/register-recap-gate.sh` (191 L — the shape to copy), `scripts/register-root-resolution.test.sh`
(its `SCRIPTS=(…)` array at `:23` is where the new script joins),
`.claude/hooks/lib/residue-dir.sh` (`_residue_dir` — and note its LOADING CONTRACT at `:17`: never
source it unconditionally), `packages/core/principles/42-context-md-pointer-rule.test.ts` (457 L,
dormant while `CONTEXT.md` is absent — `:40` says so explicitly).

## §4 Dispatch order and the gos

**S3 → S4 → S5, serial.** S3 and S4 both edit both lang packs; S5's D6 moves principle 29's module
plus its `.bin.ts`, `.test.ts` and fixtures together (splitting them reds the twin-identity check).

**Operator asks, batched, at the stage that needs them (T8) — not before dispatch:**

- **S3 asks R-8, R-9 and R-10 together, once, before landing.** R-9 is load-bearing: whether the
  `term (explanation)` form is countable in practice and not irritating after the tenth
  repetition — **UNVERIFIED**, and the counter's whole design rests on it. R-8 is a citation
  improvement, not a blocker: the operator recalled «a GLM skill that runs tested scripts from any
  place»; seven surfaces were searched and it was NOT FOUND (spec Changelog i), and D-E is
  skill-agnostic either way. R-10 joins the batch because `/wait-what` carries
  `disable-model-invocation: true` — an agent seat cannot invoke it, so «run it and see what
  language comes back» is an operator action, not an executor task (`kickoff-s3.md` §3).
- **S5 asks R-12 before the D6 (2) clause lands** — CC subagent + worktree write bug 39886 (claude-code). If it
  reproduces on the current CC, D6 (2) narrows to read-only until fixed.

**One live reproduction gates a deliverable:** R-11 — D5a (allow-listing `gh pr merge --squash`)
lands **only after** the classifier block is reproduced live. It did **not** reproduce in the
slice-2 session: `gh pr merge 1771 --repo artyhoo/getff --squash` ran with no permission prompt on
2026-09-14. One negative observation under one permission mode is not the measurement R-11 asks
for; S5 either reproduces it under a named mode or records D5a **DISSOLVED** with that evidence and
ships no allow entry.

## §5 Out of scope for all three stages

The four Minor findings parked by the slice-2 review, the slice-1 open fork about where task 1.4's
restored self-checks belong, and `register-recap-gate.sh`'s missing writing-mode smoke test (spec
D-E `:241` — forbidden to an agent session by §2 item 12, so it is operator-owned debt, not stage
work). Do not reopen them; do not fold them into a stage PR.

## §6 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

- **T3** — every finding carries a command + output or a `file:line` with the line's actual content.
  §3 above is the format; match it. No prose-only findings in a stage report.
- **T2** — designing the sweep is not running it. If a stage report says a gate «would detect» a
  class, replace that with the invocation and its output.
- **T19** — run your own adversarial cold review of the diff before handoff. Slices 1 and 2 both
  shipped defects that CI was green on: a prose gap that would have made a live model emit two fork
  cards, and two self-inflicted stale `path:NN` citations the citation gate structurally cannot see
  (it is scoped to Markdown **changed in this push** and to `LIVE_AUTHORITY_MD` only —
  [`pre-push.ts:1409-1416`](../../../packages/core/hooks/pre-push.ts) — the `LIVE_AUTHORITY_MD` set itself; the scoping comment is at `:1419`).
- **T21** — before handoff, delegate the backward sweep to a cold
  [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md), handing it the
  change's **class** and never the diff or the PR narrative.
- **Sweep by predicate, never by spelling.** §3.2 is two live instances of the same failure in one
  spec: the story-literal list named four files where the predicate returns fifteen, and the
  `aif-doctor` GO list named eleven lines where it returns twenty-four. Both of **my own** first
  drafts repeated the failure at a smaller scale — see §3.2's opening admission. Enumerate field + comparator + window; one spelling is not a sweep.
- **Your own edits stale other people's citations.** Slice 2 broke two `path:NN` pointers into
  `.claude/hooks/lang/en.sh` by moving a function, and no gate fired. After any edit that shifts
  line numbers in a cited file, sweep the citers by predicate and fix or record each one.

## §7 Host-verify contract

Before opening the PR, every stage runs and pastes the output of:

```bash host-verify
bash .claude/hooks/lang/check-parity.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
bash scripts/build-getff-dist.sh --check
PC_LOCAL=1 npx vitest run packages/core/hooks/ --testTimeout=90000
PC_LOCAL=1 npx vitest run packages/core/principles/ --testTimeout=90000
bash tests/install-sh/gh-934-ship-eot-hook.test.sh
bash scripts/register-root-resolution.test.sh
PC_LOCAL=1 make self-audit
```

`make self-audit` without `PC_LOCAL=1` is routed to the PC, where the mirror is not a proper git
repo and it exits 2 on `fatal: not a git repository` — that is the harness, not your change.
**Principle 11 F1 will go red under load, and `--testTimeout` cannot fix it — do not chase this.**
Its budget is inline, not the vitest default:
[`11-build-first-reuse-default.test.ts:643`](../../../packages/core/principles/11-build-first-reuse-default.test.ts)
reads `it('F1: …', { timeout: 30000 }, () => {`, and an inline per-test timeout **wins over the CLI
flag** — measured 2026-09-14: a run with `--testTimeout=600000` still failed with «Test timed out
in 30000ms». The cause is host contention, not the suite: run **alone** F1 passes 19/19 in 12.7 s
and 25.6 s across two measurements on this host — the second taken at load average 29, so «alone»
matters more than «quiet». In the red runs 419 and then 16 neighbouring vitest processes were live
and F1 took 100.9 s. The honest handling: re-run F1 **alone** and report that number. If
it is still over 30 s with nothing else running, that is a real regression in the capability index
and belongs in the PR body — the parallel-load red does not.

`--testTimeout=90000` above is still worth passing: it raises the genuinely-default-bounded tests
in the hooks and principles suites. It simply has no effect on F1.

Run the **principle suite**, not only the hook suites, before `git push`.
