# getff.ai docs site — umbrella kickoff (stage index)

> **Class:** umbrella kickoff (stage index + the S0b chip prompt). **Base branch:** `staging`.
> **Rigor label (effort-worthiness L0):** `research-grade` — the output is a **consumer-shipped**
> public documentation site pinned to `main`, and the S2 cutover deletes the live site's content
> source in one PR (irreversible for every old URL not in the enumerated redirect list).
> **Authoritative for:** the stage index, the dispatch order and its two separate operator gos,
> the non-negotiables every stage prompt carries, the D44 name census at the SHA below, and the
> **S0b gold-pages chip prompt** (D40 requires the kickoff to carry it so the trigger survives
> the authoring session).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> the design itself — the five specs under `docs/superpowers/specs/` own it, by pointer, never
> restated here; where a kickoff must live before dispatch —
> [`kickoff-staging-placement.md`](../../rules/kickoff-staging-placement.md).

**Measurement SHA for every `path:line` in this umbrella's five kickoff files:**
`origin/staging` = `6472bf6f2c7767621e04804894279030bee2cda4`. Every citation below was read at
that ref with `git show <sha>:<path>`, not from a worktree. Staging moves under this umbrella
constantly — before citing any of these lines again, re-fetch and re-read them.

## §0 The five specs this umbrella executes

| Spec | Owns |
|---|---|
| [`2026-09-13-getff-ai-site-design.md`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md) | the umbrella decision register (D1–D55), the stage skeleton `:45`–`:53` |
| [`2026-09-14-getff-ai-rollout-and-cutover-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md) | R1–R23, the stage table `:101`–`:108`, «who runs what where» `:130` |
| [`2026-09-14-getff-ai-face-pages-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md) | the face pages, the content brief, the S0a source-hole item list (§10 item 2) |
| [`2026-09-14-getff-ai-reference-generator-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md) | `render-reference.mjs`, its `--census` mode `:112`, the S0a exit arm C `:198` |
| [`2026-09-14-getff-ai-docs-quality-contract-design.md`](../../../docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md) | the quality layer; the S0q build-item list `:272`–`:275` |

## §1 Stages

Five rows, matching the umbrella's own stage skeleton at
[`site-design.md:49`–`:53`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md).
Four of them are aif stages with a stage kickoff; **S0b is not** — it is a chip to a new clean
Fable session, and its prompt is §5 of this file.

| Stage | Dispatch channel | Kickoff |
|---|---|---|
| **S0a — source-holes batch** (+ the D29 generator BUILD + `render-face-facts.mjs` BUILD) | aif on GLM | [`kickoff-s0a.md`](kickoff-s0a.md) |
| **S0q — quality-layer build** (D50) | aif on GLM | [`kickoff-s0q.md`](kickoff-s0q.md) |
| **S0b — gold pages + rules** (D40, D41) | **a NEW clean Fable session, never an aif profile** | §5 of this file |
| **S1 — conveyor, BUILD then RUN** | aif on GLM, two tasks (R23) | [`kickoff-s1.md`](kickoff-s1.md) |
| **S2 — landing cutover** | aif on GLM + operator hands | [`kickoff-s2.md`](kickoff-s2.md) |

Order is **S0a → S0q → S0b → S1 → S2** and it is load-bearing in both directions: S0q's
`terms.md` region (b) needs the S0a generator
([`roll.md:106`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md)),
and S0b's gold cards are hand-written against the generator S0a builds, which is why the
generator cannot be built later
([`roll.md:68`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md), R16).

## §2 The eleven non-negotiables

Decided before this kickoff was authored; **none is re-openable by a stage Worker, by a review
seat, or by the advisor.** They are reproduced verbatim in every stage prompt — a Worker reads
its own file, not this one.

1. Regenerate the content brief's pass-F points from D28 §5.8 / §5.9 / §10 / §11.
2. The R2 `no-unsafe-zod-parse` RED step goes in the S0b chip's `host-verify` block.
3. Carry the D55 `--census`-first clause into the S0a stage prompt verbatim.
4. D44's skill list verbatim in EVERY stage prompt, each name re-measured at the SHA the kickoff
   cites — never copied from an earlier kickoff.
5. Enumerate D49's third population and record its provenance BEFORE the dispatchability grep can
   mean anything.
6. **S0b gold pages go as a chip to a NEW clean Fable session — never an aif profile.**
   S0a / S0q / S1 go to aif on GLM.
7. The kickoff must be MERGED to `staging` before any dispatch, then the in-flight probe.
8. **OPERATOR DIRECTIVE — in-container self-check BEFORE execution.** Every stage prompt opens
   with a mandatory verify-and-repair phase running INSIDE the aif container before any
   production work: re-read the prompt against the cited spec lines, RUN the declared
   `host-verify` commands and the repo's gates, FIX what it finds there, and emit findings +
   dispositions in the task report so a clean phase differs visibly from a skipped one.
9. The operator's «го» on the S0a dispatch comes through their chat. Neither this seat nor the
   advisor can supply it.
10. Each stage prompt also carries an explicit «last acts before commit» list, SEPARATE from the
    opening self-check — the in-container self-check is blind to post-build omissions by
    construction, which is exactly how A3 survived.
11. The in-container phase must separately re-walk the prompt's OWN citations against real lines.
    `check-line-citations.mjs` has no freshness arm, so a citation wrong when written passes.

## §3 D44 name census — measured at `6472bf6f2c7`, not inherited

[D44](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md) (`site-design.md:171`)
requires every stage prompt to name what it invokes **by exact invocation name, verified to exist
at the SHA the kickoff cites** — «use the docs skill» is `#hope-as-gate`
([`attention-is-not-a-mechanism.md §2`](../../rules/attention-is-not-a-mechanism.md)). D44's own
census was taken at `fc865b5448d`; this is the re-measurement required by non-negotiable 4.

| Name | Kind | At `6472bf6f2c7` |
|---|---|---|
| `orchestrator`, `dispatcher`, `pipeline`, `harvest`, `claude-glm-executor-handoff`, `arch`, `reviewer` | repo skill | **PRESENT** (`.claude/skills/<name>/SKILL.md`) |
| `agents/claims-conformance-auditor.md`, `agents/fidelity-auditor.md` | repo agent | **PRESENT** |
| `superpowers:writing-plans`, `superpowers:executing-plans`, `superpowers:test-driven-development`, `superpowers:verification-before-completion` | plugin skill | **PRESENT** on this host (`~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/skills/<name>/SKILL.md`) |
| `docs-author` | repo skill | **ABSENT — S0q builds it** (D50) |
| `agents/docs-form-auditor.md` | repo agent | **ABSENT — S0q builds it** (D50) |
| `pfeff/claude-skills` `diataxis` @ `657c61c5ca8c` | plugin | **ABSENT on this host** — S0q installs it; `qual.md:274` |

`elements-of-style:writing-clearly-and-concisely` is **not installed and not required** (D44);
install only on an explicit operator ask.

**Channel, not a reminder:** each stage kickoff's `host-verify` contract opens with one presence
line per name that stage invokes, so a missing or renamed name exits 1 **on the host, before
dispatch** — the seam already exists ([`destination-environment-verification.md §1`](../../rules/destination-environment-verification.md),
runner `scripts/host-verify.sh`, presence gated by principle 43). The ABSENT names above are S0q
outputs, so the contracts that name them are evaluated **at their own stage's dispatch**, never at
authoring time (D44, last clause).

## §4 Dispatch order and the two separate gos

1. **This kickoff merges to `staging` first** (non-negotiable 7;
   [`kickoff-staging-placement.md §1`](../../rules/kickoff-staging-placement.md)). A kickoff on a
   feature branch is invisible to `/pipeline` and to the aif container base.
2. **Then the in-flight probe:** `SLUG=getff-ai-site bash .claude/skills/dispatcher/helpers/probe-inflight.sh`.
   A probe that could not be *asked* returns `PROBE-INCOMPLETE`, which is not a clean answer.
3. **Then the operator's separate «го» on the S0a dispatch** (non-negotiable 9). The «го» that
   authorised *writing* these files is **not** that go. Ask again, in their chat.
4. S0q is planned by Opus (P-R) **while S0a runs** and dispatched after S0a merges.
5. The S0b chip fires only when D40's three prerequisites hold (§5 below).

## §5 The S0b gold-pages chip prompt (D40 — embedded so the trigger survives this session)

**Venue: a NEW clean Fable session. Never an aif profile, never the D28 design session, never
this session.** (Non-negotiable 6; P-U verbatim «a CLEAN Fable session»; D39's amendment and D40.)
The reason is measured, not stylistic: the gold session is the first *stranger* to execute the
D28 §5–§7 and D30 specs, and if a fresh Fable cannot write five gold pages from them, the GLM
conveyor never will — learning that on five pages is the cheapest channel.

**Fire the chip only when all three D40 prerequisites hold, each an artifact event:**

1. this umbrella's cold pass returned GO (recorded in §6);
2. D30's fixed writing interface exists — the card, the six templates, the `terms.md` skeleton and
   the form gate — i.e. **S0q has merged**;
3. S0a is merged, or its holes are stubbed with G18 tokens (D36, `site-design.md:163`).

**The chip's own `host-verify` block, run on the host before the chip starts** (D50 gives D40
prerequisite (2) this channel; the chip exits 1 until S0q merges):

```bash
test -f scripts/docs-check.mjs
test -f scripts/render-terms-style.mjs
test -f docs/site/terms.md
test -d docs/site-quality
test -f .claude/skills/docs-author/SKILL.md
test -f agents/docs-form-auditor.md
test -n "$(find "$HOME/.claude/plugins/cache" -type d -name diataxis -print -quit)"
npx vitest run packages/core/eslint-rules/no-unsafe-zod-parse.test.ts
bash packages/core/audit-self/check-fences-fire.sh
```

The last two lines are **non-negotiable 2**: the R2 `no-unsafe-zod-parse` RED step belongs in the
S0b chip's `host-verify` block and nowhere else. It is there because the npm quick-start page the
chip writes instructs a reader to make that rule go RED
([`face.md:160`](../../../docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md)) — a
gold page must not promise a RED that does not fire. **Mind the two homes of that script:** in
this source repo it is `packages/core/audit-self/check-fences-fire.sh`; the
`scripts/check-fences-fire.sh` the page shows the reader is the **consumer** path AIF installs.
Citing the source path to a reader would be wrong, and citing the consumer path in this contract
would exit 1 forever.

**Scope of the chip — the GOLD SET ONLY** ([`site-design.md:51`](../../../docs/superpowers/specs/2026-09-13-getff-ai-site-design.md),
[`roll.md:105`](../../../docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md),
D41 at `site-design.md:168`): the 5 trial pages; the **11 face pages** — the pinned seven plus the
four `/docs/quickstart-<stack>/` stack pages (D48, `site-design.md:175`); family 1 (~20 pages)
with its gold cards hand-written against the generator S0a built (D24b seam); the glossary
CONTENT (the skeleton is S0q); the top-level artifacts D25(2) names; and the hero copy as
`docs/site/hero-copy.json` (D51 (3), `site-design.md:178`). **Every remaining page is S1 RUN, not
this chip.**

**Skills the chip invokes, by exact name** (D44): `docs-author` (S0q's output, wrapping the pinned
`diataxis` plugin by pointer) and `superpowers:verification-before-completion` (D13 — every
example executed before a page is done). The Opus gold review runs `docs-form-auditor` and
[`agents/claims-conformance-auditor.md`](../../../agents/claims-conformance-auditor.md).

**Exit:** Opus gold review = GO on the 5 trial pages **before** family 1, then the D22 checkpoint
after family 1 (`site-design.md:140`). Verdict grammar `GO | REVISE | STOP`, `Failure-scenario:`
on every round-triggering finding.

**Falsifier (D39 (c)):** the Fable gold session's five trial pages fail the Opus gold review
twice → the writing skill / quality contract (D30) needs work, **not** the seat. S0b does **not**
move to aif on that evidence.

## §6 Review record

The five specs were reviewed to **GO** by the cold review seat on 2026-09-14 (D46,
`site-design.md:173`). The last round read all five files top-down at
`d74c5c6f3c9` — lines received 397 / 466 / 405 / 342 / 281, each equal to `wc -l` — and returned
3 MAJOR · 2 MINOR · 0 BLOCKER with zero false positives; every finding is dispositioned in the
merged text (PR #1766). These four stage kickoffs get their **own** Phase -1 cold review (P-AM,
`site-design.md:97`) before any dispatch — the advisor does not cold-read them.

## §7 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps: **T3**, **T8**, **T10**, **T17**, **T19**, **T21**.

- **T3** — every stage kickoff's claim about a file carries `path:line` **and** the line's actual
  content; a claim with neither is prose.
- **T8** — if the answer is in the specs, do not ask the operator; the two things that genuinely
  need them are the dispatch «го» (non-negotiable 9) and the R14 hands.
- **T10** — D49's page inventory is a **population enumeration**, and it precedes any coverage
  claim about the site.
- **T17** — S2 deletes `content/docs/**` and 195 route twins. Preservation is the orchestrator's
  job before the destructive prompt is written, not the Worker's.
- **T19** — this umbrella's own cold QA of these kickoffs happens before handoff, not after.
- **T21** — a backward-check that lists only the files this PR touched is a restatement, not a
  sweep.

**Domain-specific trap — `T-GA-A` «citation correct when written, false when read».** The
dominant defect class of this umbrella, measured on both sides in one round: an edit that inserts
or deletes lines in a cited file invalidates every citation INTO that file past the insertion
point, **including correct citations written by other people in other specs**. Its sibling form is
**mixed sources inside one answer** — reading one file through `git show <sha>:` and another from
a stale worktree, and naming neither ref. Neither gate can see the class:
`scripts/check-line-citations.mjs` has exactly two arms (blame-based drift; blank cited line), so
a citation wrong **when written** returns exit 0 with no output. Counter, mechanical and bounded:
pin **every** file of one answer to the same ref and say which ref; and after any edit, read the
diff's hunk headers for the per-file shift map, then re-check citations INTO each shifted file
above its shift point.

## §8 Host-verify contract

```bash host-verify
test -f .claude/skills/orchestrator/SKILL.md
test -f .claude/skills/dispatcher/SKILL.md
test -f .claude/skills/pipeline/SKILL.md
test -f .claude/skills/harvest/SKILL.md
test -f .claude/skills/claude-glm-executor-handoff/SKILL.md
test -f .claude/skills/reviewer/SKILL.md
test -f agents/fidelity-auditor.md
test -f agents/claims-conformance-auditor.md
test -f docs/superpowers/specs/2026-09-13-getff-ai-site-design.md
test -f docs/superpowers/specs/2026-09-14-getff-ai-rollout-and-cutover-design.md
test -f docs/superpowers/specs/2026-09-14-getff-ai-face-pages-design.md
test -f docs/superpowers/specs/2026-09-14-getff-ai-reference-generator-design.md
test -f docs/superpowers/specs/2026-09-14-getff-ai-docs-quality-contract-design.md
```
