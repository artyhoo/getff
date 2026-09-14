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

**Measurement SHA for every `path:line` below:** `2fb69aa00d7d4d4b30f257c3d592f18f065570fc`.

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
intended content at the measurement SHA — no drift.** But a predicate sweep
(`operator GO` / `«GO»` / word-boundary `GO`) over that file returns **22** GO-bearing lines. The
eleven are a spelling-scoped subset. The extra eleven are `:67`, `:69`, `:70`, `:114`, `:198`,
`:199`, `:210`, `:227`, `:229`, `:241`, `:247`, and four of them are decision-class-bearing rather
than incidental:

- `:198` — «Release a review park (Tier 2 — GO)»
- `:199` — «Bijection-deadlocked state reset (Tier 2 — GO + backup)»
- `:210` — the `### Tier 1 — Reversible config (auto-apply, no GO needed)` heading
- `:229` — the `### Tier 2 — Destructive or system-disruptive (GO required)` heading

**S5 classifies all 22, not eleven**, and the PR body carries the table. The spec's intended split
is unchanged and binding:

- **GO STAYS** on task DELETE (`:104`, destructive), paid API transport Fix C (`:94`, spend — the
  night-v3 §6 floor plus [`no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md)), and the cap
  bump (`:105`, standing config — the D-B floor list).
- **GO IS REMOVED** on the reversible in-container fixes only: image rebuild (`:88`), in-container
  install (`:90`), mirror install (`:91`).
- `:41`, `:256`, `:307` — the file's own «gates every state-changing fix» summaries — are
  **restated** to that split. `:100` is a historical note; untouched.
- The Tier headings at `:210`/`:229` are the file's own definition of the split. If the reworded
  summaries and these headings disagree, the file contradicts itself — reconcile them in the same
  commit.

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

**LIVE = what an agent reads to act today** (34 files per the spec's cold review F12):
`.claude/skills/*` (3 files), `.claude/rules/*`,
[`.claude/hooks/check-worker-dispatch-channel.sh`](../../hooks/check-worker-dispatch-channel.sh)
plus its `plugin/hooks/check-worker-dispatch-channel` twin (regenerates via pre-commit), principle
29's module + `.bin.ts` + `.test.ts` + fixtures — all five files exist and **move together or the
twin-identity check goes red** — and `docs/meta-factory/open-questions.md`.
**FROZEN = untouched:** closed kickoffs and `done.md` (13 files), research-patches, specs, retros.
The old name surviving in the frozen set is intentional; the «formerly» line is what makes it
readable.

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

**This kickoff set is itself corpus input.** These four files land on `staging` before S5 runs, so
they are inside `.claude/orchestrator-prompts/**/kickoff*.md` when the snapshot arm is first
captured. They prescribe no auto-launch and hand no subagent a write task — if the matcher flags
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
- The corpus snapshot is captured with a flip nobody examined → the precondition became the thing
  it was built to replace.

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
