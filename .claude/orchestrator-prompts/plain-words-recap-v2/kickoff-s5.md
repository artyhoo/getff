# plain-words recap v2 — S5: autonomy, removing text-born stops (D-H)

> **Umbrella:** [kickoff.md](kickoff.md) — §2 non-negotiables and §3 census are binding.
> **Class:** stage kickoff (dispatch input). **Base branch:** `staging`. **Channel:** one Claude
> Code session, own worktree, one PR to `staging`. Review seat: **Opus**.
> **Rigor label (L0):** `research-grade` — this stage edits the Artifact Ownership Contract and narrows
> a shipped gate. A narrowing that goes one clause too far re-opens the class the gate exists for,
> and nothing downstream would catch it.
> **Authoritative for:** the S5 contract — the five deliverables, the reproduction R-11 demands,
> the 22-site predicate sweep D5c actually needs, the corpus-snapshot precondition, and the exit
> gates.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists);
> D-H itself, owned by [`plain-words-recap-v2-design.md:326`](../../../docs/superpowers/specs/2026-09-13-plain-words-recap-v2-design.md).

**Measurement SHA for every `path:line` below:** `083d5fe1635eb8fad53d1de186cbfbff83ef42e8`.

## §0 What this stage is for

The spec's premise is that most operator stops are **text-born** — a document tells the agent to
ask, so it asks, and the operator answers a question no risk required. D-H removes the text-born
ones and keeps the risk-born ones. The failure mode to fear is the opposite: removing a stop that
was load-bearing, which nothing detects until something irreversible happens once.

## §1 D5a — the `gh pr merge --squash` allow entry, **gated on a live reproduction (R-11)**

D5a allow-lists `gh pr merge --squash` to `staging` explicitly; the global allow already carries
`Bash(gh pr *)`.

**R-11 says D5a lands ONLY after the classifier block is reproduced live. It did NOT reproduce in
the slice-2 session:** `gh pr merge 1771 --repo artyhoo/getff --squash` ran on 2026-09-14 with no
permission prompt and no classifier block, and [PR 1771](https://github.com/artyhoo/getff/pull/1771) merged as `17c364e279d`. That is one
negative observation under one permission mode — **not** the measurement R-11 asks for, and not a
licence to ship the entry anyway.

S5 does exactly one of two things and says which:

- reproduces the block under a **named** permission mode → the allow entry ships **scoped to that
  mode** (R-11's own falsifier says a block under one mode only means a scoped entry), or
- fails to reproduce it across the modes it tried, listing them → records **D5a DISSOLVED**, ships
  **no allow entry**, and says so in the PR body.

Either way, remember umbrella §2 item 3: an agent cannot land a `.claude/settings.json` change on
any channel. The deliverable is the prepared line plus the operator invocation, never the edit.

## §2 D5b — the Ownership Contract, with exclusions

[`CLAUDE.md`](../../../CLAUDE.md) §Artifact Ownership Contract gains a **fourth column**, `«го» via
PR? yes / no`:

- **no «го» needed** for edits to OPERATIONAL maintainer-owned rows — EXECUTION-PLAN,
  `.husky/pre-push`, `.claude/rules/*`, session-bootstrap, shipped agents and skill-context —
  **when they go through a PR to `staging`**. The gate is PR + CI.
  `packages/core/principles/` is already owned by meta-tests CI at
  [`CLAUDE.md:91`](../../../CLAUDE.md) — do not give it a second owner.
- **«го» KEPT** for the goal-bearing row (`README.md §Why this exists`) and the frozen rows
  (PROPOSAL.md, retros, research-patches, closed kickoffs and `done.md`). The reason is mechanical,
  not ceremonial: agents merge their own `staging` PRs ([`CLAUDE.md:140`](../../../CLAUDE.md)) and
  **no CI check detects goal drift**, so without this exclusion an agent could rewrite the goal and
  merge it alone — the 2026-05-09 incident the whole authority hierarchy exists for.

Falsifier: an agent-authored PR edits `README §Why this exists` and merges without a «го» (R-2).

## §3 D5c — the `aif-doctor` GO split, swept by predicate

The spec enumerates **eleven** GO sites in [`aif-doctor/SKILL.md`](../../skills/aif-doctor/SKILL.md)
(`:41, :88, :90, :91, :94, :100, :104, :105, :244, :256, :307`). **All eleven still land on their
intended content at the measurement SHA — no drift.** But they are a spelling-scoped subset.

**The sweep, and the first draft's own error.** The first draft of this section said «22
GO-bearing lines» and listed eleven extras. Both numbers were assembled by recall. Run the
predicate instead:

```bash
git grep -n '\bGO\b' 083d5fe1635eb8fad53d1de186cbfbff83ef42e8 -- .claude/skills/aif-doctor/SKILL.md
```

It returns **24** lines: `:23 :41 :67 :69 :70 :88 :90 :91 :94 :100 :104 :105 :150 :198 :199 :210
:227 :229 :241 :244 :247 :256 :307 :320`. Three of them — **`:23`, `:150`, `:320`** — were in
neither of the first draft's lists, and its `:114` is a **false positive**: that line reads «**Go**
straight to», an ordinary verb that only a case-insensitive match picks up. Word-boundary `GO` is
the declared predicate; `:114` is not a GO site.

**S5 classifies all 24 and puts the table in the PR body.** The spec's intended split is unchanged
and binding:

- **GO STAYS** on task DELETE (`:104`, destructive), paid API transport Fix C (`:94`, spend — the
  night-v3 §6 floor plus [`no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md)), and the cap
  bump (`:105`, standing config — the D-B floor list).
- **GO IS REMOVED** on the reversible in-container fixes only: image rebuild (`:88`), in-container
  install (`:90`), mirror install (`:91`).
- **RESTATED to the split** — the file's own summaries of «mutation needs GO»: `:41`, `:256`,
  `:307`, plus the two the first draft missed: the `Authoritative for:` header at **`:23`** («the
  read-only health-sweep → classify → emit-mapped-fix → mutation-needs-GO flow») and the See-also
  line at **`:320`** («Tier 2 mutations surface for GO; Tier 1 reversible fixes auto-apply»). A
  restated body with an unrestated header is the doc contradicting itself at its most-read line.
- **UNTOUCHED, and why each** — the first draft left these without a disposition, which is how
  `:244` ended up cited by the spec and disposed of by nobody:
  - `:241` and **`:244`** are the two GO-bearing lines of the **Tier-2 emission template** (the
    fenced `MUTATION (needs GO): …` / `Awaiting operator GO.` block at `:240-245`). They are the
    mechanism by which a GO is requested, not a decision about which fixes need one. They survive
    the split verbatim — D5c removes three call sites, not the channel.
  - `:210` / `:229` are the Tier-1 and Tier-2 **headings** — the file's own definition of the
    split. `:227` («Then continues without pausing for GO») and `:247` (the 2026-06-04 rationale)
    are that definition's prose. If the reworded summaries and these disagree, the file
    contradicts itself — reconcile in the same commit.
  - `:198`, `:199` are the Tier-2 register rows (release a review park; bijection-deadlocked state
    reset). Out of D5c's scope — neither is an in-container reversible fix.
  - `:150` already states «No GO needed» for a Tier-1 heal: it is on the split's side already.
  - `:67`, `:69`, `:70` are the §0 workflow's own steps — «Read-only sweep (autonomous, no GO)»,
    the emit step, «On GO (and only then)». They describe the two-tier procedure generically and
    stay true under the split; check them against the reworded summaries and leave them alone
    unless they disagree. Do **not** classify them as narrative — the first draft did, and they
    are procedure.
  - `:100` is the one genuinely historical line («added 2026-06-27 under operator GO», a dated
    override note); untouched.

Falsifier: a session switches aif to a paid transport without asking (R-6).

## §4 D6 — the subagent tenets, with anti-expansive-reading protections

Write into the rule text, as a positive-and-negative pair:

1. the Agent tool is allowed in **any** session — `/pipeline` and `/dispatcher` included — for
   reading, search, checks and cold reviews;
2. allowed for **writes** in a normal session in its own worktree — **conditional on R-12**, see §5;
3. **FORBIDDEN** without the operator's explicit choice is **EXACTLY ONE** class of action:
   launching the EXECUTION of an umbrella stage from a kickoff. The ban is about the **ACTION** and
   is identical for a subagent, an aif dispatch and `claude -p`;
4. exceptions = permission given in advance — `/night-mode`, the `bridge: auto` marker;
5. the pipeline exit MUST emit a launch card (D7): recommended channel + arguments + plain-words
   explanation + ready artefacts per channel (chip, kickoff, subagent prompt);
6. the operator picks the channel.

**Protections, all three required:**

- (a) a positive **«this rule does NOT forbid»** list next to the ban;
- (b) the self-test phrase «am I about to launch the EXECUTION of an UMBRELLA STAGE?» — if not, the
  rule does not apply;
- (c) rename `#worker-dispatch-via-subagent` → `#umbrella-execution-launch-without-operator` **in
  LIVE texts only**, with one «formerly …» line.

**The rename set, re-measured — the first draft of this section was wrong in four ways and a
cold review caught all four.** Ground truth at the measurement SHA, **37 files**:

```bash
git grep -l 'worker-dispatch-via-subagent' 083d5fe1635eb8fad53d1de186cbfbff83ef42e8
```

**LIVE = what an agent reads to act today (9 files) — rename all of them:**

| File | Note |
|---|---|
| [`.claude/hooks/check-worker-dispatch-channel.sh`](../../hooks/check-worker-dispatch-channel.sh) | the gate itself |
| `plugin/hooks/check-worker-dispatch-channel` | **generated** twin — regenerates via pre-commit, never hand-edit |
| `packages/core/hooks/check-worker-dispatch-channel.test.ts` | the gate's paired-negative suite — live machinery, and the first draft listed it in NEITHER set |
| `packages/core/principles/29-worker-dispatch-channel.ts` | principle 29's module |
| `packages/core/principles/29-worker-dispatch-channel.bin.ts` | its binary arm |
| `packages/core/principles/29-worker-dispatch-channel.test.ts` | its suite |
| [`.claude/skills/pipeline/SKILL.md`](../../skills/pipeline/SKILL.md) | `:389`, under the hard line budget below |
| `.claude/skills/pipeline/references/output-format.md` | |
| `.claude/skills/night-mode/SKILL.md` | |

**There are exactly THREE principle-29 files, and there are NO principle-29 fixtures.** The first
draft said «module + `.bin.ts` + `.test.ts` + fixtures — all five files exist», which is false at
this SHA: `packages/core/principles/fixtures/` holds only `adapter-jig/` and `rule-channel/`
material belonging to other principles. It also contradicted §5 of this same kickoff, which
correctly says the only principle-29 fixture (`fixtures/29-corpus-verdicts.json`) is NEW and this
stage creates it. Trust §5.

**Two surfaces the first draft named as LIVE carry ZERO occurrences** — do not go looking for
edits there: `.claude/rules/*` (`git grep -c … -- .claude/rules/` → no hits) and
`docs/meta-factory/open-questions.md` (same). The rule text the protections (a) and (b) above land
in is [`.claude/rules/parallel-subwave-isolation.md`](../../rules/parallel-subwave-isolation.md)'s
neighbourhood — but it holds no occurrence of the old name, so that is an ADDITION, not a rename.

**FROZEN = untouched (27 files):** 15 under `.claude/orchestrator-prompts/**` (14 `kickoff*.md`
plus `meta-orch-channel-discipline/done.md`) and 12 research-patches and specs. The old name
surviving there is intentional; the «formerly …» line is what keeps it readable.

**Two of those fifteen are this umbrella's own kickoffs** — `plain-words-recap-v2/kickoff.md` and
`plain-words-recap-v2/kickoff-s5.md` — which entered the corpus when
[PR 1778](https://github.com/artyhoo/getff/pull/1778) merged, between the first sweep (35 files)
and this one (37). §5's «this kickoff set is itself corpus input» is therefore not a prediction any
more; it is measured. Treat them as FROZEN like any other kickoff: the old name in them is the
**subject** of the rename, not an instance of it, and rewriting the very text that specifies the
rename would erase the record of what was renamed.

**SSOT — `docs/meta-factory/prior-art-evaluations.md`: leave it, and say why.** It is an
append-only register per [CLAUDE.md](../../../CLAUDE.md)'s Artifact Ownership Contract; a landed
row records what was evaluated under the name it had. It is neither LIVE prose nor a frozen
kickoff, and the first draft simply omitted it. Add the «formerly» pointer to the NEW row this
stage writes, never rewrite the old one.

**Line budget — hard.** [`pipeline/SKILL.md`](../../skills/pipeline/SKILL.md) is at **exactly 600
lines** (measured), the pre-commit markdown ceiling, with no exemption. The rename lands there
**NET-ZERO**: edit the `:389` bullet in place with «formerly» on the same line. The positive «does
NOT forbid» list and the self-test phrase land **in the rule file, never in `pipeline/SKILL.md`**.

## §5 D6's narrowing of principle 29 — and its mechanical precondition

(d) Narrow principle 29 and `check-worker-dispatch-channel.sh` to «a kickoff must not PRESCRIBE
auto-launch of execution», with a **negative test**: a kickoff that hands a subagent a
reading/review task PASSES. [`29-worker-dispatch-channel.ts:60`](../../../packages/core/principles/29-worker-dispatch-channel.ts)
already exempts read-only dispatch via `READONLY_CONTEXT_RE`, so the tenet's real delta is the
**write-task** case: a kickoff prescribing Agent-tool dispatch of a WRITE worker without the words
«umbrella stage» must **still fire**, or the whole class this gate exists for re-opens.

**Precondition, and it is a TEST, not a PR listing.** Principle 29's test gains an arm that runs the
matcher over `.claude/orchestrator-prompts/**/kickoff*.md` and compares the verdict vector against a
committed snapshot — NEW file `packages/core/principles/fixtures/29-corpus-verdicts.json` (absent at
the measurement SHA). Every flip is then a red test whose fix is a reviewed snapshot diff.

Why a test and not a listing in the PR body: under D5b that PR needs no «го» and agents self-merge
on green, so a PR-body listing would have had **no reader** — the `#warning-nobody-reads` shape
([attention-is-not-a-mechanism.md §2](../../rules/attention-is-not-a-mechanism.md)). The original
matcher dropped a clause only after an 8-false-positive measurement
([`29-worker-dispatch-channel.ts:38-49`](../../../packages/core/principles/29-worker-dispatch-channel.ts));
the narrowing gets the same treatment.

**This kickoff set is itself corpus input — and that is now measured, not predicted.** The four
files landed on `staging` with [PR 1778](https://github.com/artyhoo/getff/pull/1778), and the
dispatch-name sweep in §4 grew from 35 files to 37 in exactly that step, the two additions being
this umbrella's own `kickoff.md` and `kickoff-s5.md`. They are inside
`.claude/orchestrator-prompts/**/kickoff*.md` when the snapshot arm is first captured. They prescribe no auto-launch and hand no subagent a write task — if the matcher flags
any of them, that is a finding about the matcher or about this text, and either way it is examined,
never snapshot-blessed.

## §6 R-12 — the ask S5 owes, before D6 (2) lands

«Does the CC subagent + worktree write bug 39886 (claude-code) reproduce on the current Claude Code?» Status
**operator-fork (external)**, resolution unknown. D6 (2) — «writes allowed in a normal session in
its own worktree» — is **conditional on it**. If it reproduces, D6 (2) narrows to read-only until
fixed. Ask once, with a recommendation, before that clause lands.

## §7 D7 — the launch card

Chips stay. The agent cannot open a new Claude Code session itself (no `start_session` tool
in-session — **recheck at implementation time**, this is the kind of claim that expires). The
`/arch` §3 and `/pipeline` launch card recommends a channel by two questions — «хотите видеть и
вмешиваться?», «длинная самостоятельная работа?» — and the **operator chooses**. The memory note
`dispatch-channel-must-not-need-a-click` is corrected to this rule.

## §8 Exit gates

Umbrella §7 host-verify contract, plus:

```bash host-verify
PC_LOCAL=1 npx vitest run packages/core/principles/29-worker-dispatch-channel.test.ts
PC_LOCAL=1 npx vitest run packages/core/hooks/check-worker-dispatch-channel.test.ts
PC_LOCAL=1 npx vitest run packages/core/principles/ --testTimeout=90000
wc -l .claude/skills/pipeline/SKILL.md        # must still be exactly 600
```

Plus, for the narrowing, a **paired positive**: a synthetic kickoff that prescribes Agent-tool
dispatch of a WRITE worker WITHOUT the words «umbrella stage» must go RED against the narrowed
matcher. A narrowing validated only by «the negative case now passes» has measured nothing.

## §9 Falsifiers to write into the PR body

- A write-worker kickoff without «umbrella stage» passes the narrowed gate → R-7 broken, the class
  is re-opened.
- An agent-authored PR edits `README §Why this exists` and merges without a «го» → D5b's exclusion
  is not doing its job.
- A session switches aif to a paid transport without asking → the D5c split removed a GO it should
  have kept.
- `pipeline/SKILL.md` lands at 601 lines → the net-zero rename constraint was not honoured, and
  pre-commit will say so before CI does.
- **The corpus snapshot and the matcher narrowing land in the same commit.** Then no run ever
  produced the pre-narrowing verdict vector, the flip set is empty by construction, and the
  precondition has become the `#warning-nobody-reads` shape it was built to replace. Checkable,
  and check it: `git log --oneline --follow -- packages/core/principles/fixtures/29-corpus-verdicts.json`
  must show the snapshot committed **strictly before** the commit that edits
  `29-worker-dispatch-channel.ts`, and running the narrowed matcher against that snapshot must
  yield a non-empty flip list every entry of which is named in the PR body with a per-entry
  verdict. A green first run of the new arm is the failure, not the pass.

## §10 Out of scope

The glossary (S3) and the round form / story rework (S4). Do not touch `.claude/settings.json` by
any channel — prepare the line, hand it to the operator.

## §11 AI traps ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**T3** command-or-`file:line` for every finding · **T2** the corpus run is an invocation with
output, not a description · **T7** when you reach the adversarial counter-prompt on the narrowing,
write it and run it; if it surfaces nothing, rephrase and run again · **T19** own cold review before
handoff · **T21** cold `agents/backward-sweep-auditor.md` on the class «a gate narrowed so a
legitimate case passes».

**The class-specific trap for S5: the sweep list you inherit is shorter than the predicate.** §3 is
the live instance — the spec's eleven GO sites are correct and incomplete at the same time, and a
stage that edits eleven and reports «all GO sites classified» has reported something false while
every gate stayed green.
