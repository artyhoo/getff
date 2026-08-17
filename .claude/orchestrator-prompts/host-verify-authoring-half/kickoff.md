# Kickoff — does the `host-verify` contract need an authoring half?

> **Type:** decision brief, one session. **Not** a build order — the recommendation below is
> DON'T BUILD, and the session's job is to falsify or ratify it, then act on the answer.
> **Base branch:** `staging`. **Rigor label (L0):** `build-and-verify` — every surface here is
> a reversible prose/script edit with a live check available in-session.
> **Origin:** handoff from the session that landed the ask-file authoring half (PR #1444),
> where this was recorded as Review-findings observation 2 and the operator said «go, examine
> it in a new session».

## §0 Why this brief exists, and why it opens with a retraction

PR #1444 gave the **ask file** its authoring half: `scripts/check-ask-files.sh` now emits the
template it judges. Its backward sweep (T21) asked «where else does this class occur?» and
named one sibling: the kickoff **`host-verify` contract**. Same shape on paper — a
hand-authored format with a gate (`.claude/hooks/check-kickoff-traps.sh:132`) and a *reader*
(`scripts/host-verify.sh --list`, usage at `:60`), but **no emitter**.

That observation was recorded on **shape**, not on measurement. The measurement has since been
taken, and it does not support building. §1 is the evidence; §2 is the honest verdict; §3 is
what would overturn it. The retraction is stated up front rather than buried because a brief
that opens with «here is the thing to build» will get it built.

## §1 What was measured (2026-08-17, on the host, this repo)

Method note first, because the first run of it was **wrong** and the error is instructive: the
Bash tool here is **zsh**, where `for f in $VAR` does *not* word-split, so a 310-line file list
was consumed as one word and the first counts came back as `neither=1`. Any re-measurement must
iterate with `while IFS= read -r`. The numbers below are from the corrected run.

| Question | Measurement | Command |
|---|---|---|
| How many tracked kickoffs exist? | **310** | `git ls-files '.claude/orchestrator-prompts/*/kickoff.md'` |
| …carry a `host-verify` contract? | **42** | ```grep -lE '^```[a-z]* *host-verify'``` |
| …carry the `host-verify: none` opt-out? | **13** | `grep -l 'host-verify: none'` |
| …carry neither? | **258** | corrected loop |
| Of the 42 contracts, how many **fail to parse**? | **0** | `bash scripts/host-verify.sh --list <f>` over all 42 |

**The load-bearing row is the last one.** The hypothesis behind observation 2 was «with no
emitter, authors write the contract wrong». It is **falsified**: 42 of 42 parse cleanly through
the real runner. Whatever the missing emitter costs, it is not malformed contracts.

The 258 «neither» are **not** a backlog: arm 1 is forward-going by design and fires on the next
edit of any kickoff — [`destination-environment-verification.md §6`](../../rules/destination-environment-verification.md)
states this plainly («the origin kickoff predates this rule and carries no contract»). Reading
258 as a debt to burn down would be a misread of the rule's own scope.

The opt-out was checked for `#optout-as-reflex` ([same rule §4](../../rules/destination-environment-verification.md))
and came back healthy: the rationales are substantive (meta-launch docs, router documents,
prose-only research kickoffs), and one kickoff even **retracts** its own earlier opt-out as
wrong. The single suspicious string — `host-verify: none - no` — is a **negative test-case row
in a table** at `.claude/orchestrator-prompts/autonomy-mechanisms-hardening/kickoff.md:90`, not
a live opt-out; that file's real contract parses (exit 0).

## §2 Recommendation — DON'T BUILD (and why it differs from the ask file)

The two cases look identical and are not. The difference is the **worked-example population**:

- **Ask file, before #1444:** zero instances existed anywhere. The mailbox was empty, no ask had
  ever been filed, and the schema was stated only inside the checker. The first author had
  literally nothing to copy — which is what made the emitter load-bearing.
- **`host-verify` contract, today:** **42 working, parsing instances live in the repo**, next to
  every kickoff an author is already reading. The corpus *is* the template.

Run against [`effort-worthiness.md §1`](../../rules/effort-worthiness.md)'s four-test card:
(1) goal progress — negligible; (2) theatre — an emitter whose output duplicates 42 existing
examples is form without substance; (3) **immaterial — nothing a consumer or a decision would
notice**, and this is the test it fails hardest, at 0 measured defects; (4) cheaper to verify in
practice — already verified, the practice is clean. Default is practice-first, and the burden of
proof sits on *more* rigor; nothing here discharges it.

There is also a **second, harder gap an emitter would not touch**, and it should not be
confused with this one: `#contract-that-cannot-fail` — a contract that parses, runs, returns
PASS, and asserts nothing about the stage's deliverable (incident `getff-freshness-widening-s1`,
PR #1333, recorded at [`destination-environment-verification.md §4`](../../rules/destination-environment-verification.md)).
That is a *judgment* defect. A skeleton printer cannot see it; the rule already routes it to
`scripts/host-verify-coverage.sh` + an adjudicating seat, and explicitly records that three
deterministic variants were built and **all failed** on recall or noise. Do not reopen that as
«while we're here».

## §3 Falsifiers — what would make this verdict wrong

Ratify or overturn on evidence, not on re-reading the prose. This verdict is **wrong if** any of:

1. **A malformed contract reaches a merged kickoff.** Re-run the 42-file parse sweep; a nonzero
   FAILS column overturns §2's core row immediately.
2. **The corpus stops being reachable.** The «42 worked examples» argument dies the moment
   kickoffs stop being co-located and greppable (e.g. if consumer-shipped kickoffs land in
   `.ai-factory/` with no examples beside them). Then a consumer author *is* in the ask-file
   position, and the emitter becomes load-bearing on the shipped axis.
3. **The grammar changes.** If the fence marker, the opt-out token, or the rationale floor moves,
   42 existing examples become 42 *stale* examples — worse than none, and an emitter bound to the
   runner by a round-trip test becomes the cheap fix (the #1444 pattern applies verbatim).
4. **≥3 kickoffs in 6 months reach review with an opt-out where an executable deliverable
   existed** (`#optout-as-reflex`). That is a different defect than this brief measured, and an
   emitter that prints the contract *first* and the opt-out *second* might shift the default.

If none of these has fired, the correct action is to **record the verdict and close** — a
«not worth it» outcome is explicitly legitimate ([`effort-worthiness.md §1`](../../rules/effort-worthiness.md):
«Zero-finding reviews and „not worth it" verdicts are legitimate outcomes»).

## §4 What IS worth doing (small, real, maintainer-owned)

These are the genuine leftovers from the #1444 session. All three are one-line-ish doc edits on
**maintainer-owned** artefacts (CLAUDE.md Artifact Ownership Contract), so they need the owner's
say-so, not an agent's initiative:

1. **[`.claude/rules/reviewer-discipline.md:65`](../../rules/reviewer-discipline.md)** — the third
   surface that instructs filing an ask («transcribe that block into an ask file»), still with no
   pointer to the format. It wants the same one-liner the two skills got in #1444:
   `bash scripts/check-ask-files.sh --print-template materiality-dispute <role>`.
2. **[`.claude/rules/effort-worthiness.md:62-64`](../../rules/effort-worthiness.md)** — still labels
   L3 arms (b)(c)(d) «(landing item)» though they shipped in PR #1433. Stale-by-success.
3. **Nothing on the schema itself.** T-ASK-A asked whether the flat frontmatter is awkward to
   hand-write; measured answer from actually writing one: **no**. The awkward part was never a
   field, it was the two things a file format cannot carry — the machine-resolved mailbox path
   and the atomicity requirement — and both now live in `--help`. Do not propose a schema change.

## §5 Traps (per [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md))

Active: **T2**, **T3**, **T14**, **T18**, **T20**, **T21**.

- **T2** — designing ≠ auditing. If this session ends up building the emitter, it must first
  *run* the §3 falsifier sweeps, not reason about them.
- **T3** — every finding carries a command and its output. §1's table is the standard to match.
- **T14** — the sweep came back clean at **high** coverage (42/42, the whole contract-carrying
  population), so «category clean» is a legitimate read here. Had it been a sample of 5, the
  honest finding would be «coverage insufficient», not «clean».
- **T18** — the reversible branch is *keeping* things as they are. Do not «tidy» the 42 contracts
  into a generated shape, and do not delete the prose grammar in `scripts/host-verify.sh:23-46`.
- **T20** — no verdict in this session's dialogue without an evidence-bearing tool call in the
  same turn.
- **T21** — if any build does happen, delegate the backward sweep to
  [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md) with the *class*
  only. Note that this brief is itself the product of a T21 sweep whose finding **did not
  survive measurement** — which is the outcome T21 exists to make possible.

**Domain trap — T-HV-A: «the sibling looked identical, so the fix transfers».** This is
[T16](../../rules/ai-laziness-traps.md) (`#pattern-matching-on-name`) at the level of a *remedy*
rather than a tool: the ask file and the `host-verify` contract share a shape — hand-authored
format, gate present, emitter absent — and the #1433→#1444 fix is fresh and satisfying to
re-apply. The upstream problem class was «zero worked examples, first author writes against
nothing»; this problem class is «42 worked examples, all parsing». **They do not match, so the
validation does not transfer.** Counter: state the problem class of both sides explicitly and
cite the measurement, exactly as §2 does, before proposing any mechanism.

**Domain trap — T-HV-B: «258 kickoffs lack a contract, therefore 258 defects».** The rule is
forward-going and says so. Counting historical artefacts as a backlog manufactures a large,
impressive, entirely fake number — and a session under mild pressure to produce findings will
reach for it. Counter: any population claim about the 258 must first quote
[`destination-environment-verification.md §6`](../../rules/destination-environment-verification.md)'s
forward-going scope and say what it changes.

## §6 Done criterion

1. Each §3 falsifier is checked and its result recorded with the command and output — including
   the ones that come back negative.
2. A verdict is written: **RATIFY** (record and close, no build) or **OVERTURN** (which falsifier
   fired, with evidence). Both are acceptable outcomes; a session that builds without a fired
   falsifier has failed this criterion, not met it.
3. If RATIFY: this brief's verdict is recorded where the next reader will hit it — a `done.md`
   in this umbrella dir — so the sibling-shape observation is not re-derived a third time.
4. §4's three items are surfaced to the maintainer as a batch, not silently actioned.

## §6.1 host-verify — acceptance runs on the HOST

Note the recursion: this brief is *about* the host-verify contract and also *carries* one. The
commands below re-run §1's measurements, so an acceptance run reproduces the evidence the
verdict stands on rather than trusting this file's table.

```bash host-verify
git ls-files '.claude/orchestrator-prompts/*/kickoff.md' | wc -l
bash scripts/host-verify.sh --list host-verify-authoring-half
bash scripts/check-ask-files.test.sh
```

The second command is the self-application check: a brief arguing the contract format is
learnable from its corpus must itself produce a contract that the real runner parses.

## §7 Not in scope

- Reopening `#contract-that-cannot-fail` (§2, last paragraph) — measured un-gateable, own owner.
- Editing the three maintainer-owned files in §4 without an explicit invitation.
- Any change to the ask-file schema (§4 item 3).
