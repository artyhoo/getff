<!-- scope:arch-v2-context-pipeline-s-l-5c-measurement -->

# S-L input — the #5-C measurement: first-turn billing vs `/context`, same seat

> **Status:** raw measurement + three findings. **This patch does NOT adjudicate DECISION-NEEDED
> #5 or #6.** It supplies the input the S-L recalculation stage adjudicates under cold acceptance.
> **Append-only.** It does not edit the merged S-H patches
> ([`2026-08-07-s-h-p14-context-addendum.md`](2026-08-07-s-h-p14-context-addendum.md) and siblings)
> — those are read-only for later sessions per the [CLAUDE.md](../../../CLAUDE.md) Artifact
> Ownership Contract. Where a merged figure is superseded, it is superseded *here*, by name.

## §1 What was asked for, and what was run

The merged addendum designed the measurement and declined to run it
([`2026-08-07-s-h-p14-context-addendum.md:208-209`](2026-08-07-s-h-p14-context-addendum.md)):

> **Option C** — measure the gap directly: bill one seat's first turn *and* run `/context` in it
> before any other message, so the dispatch prompt is isolated. Cost: one interactive session.

Run 2026-08-07 in session `45489086-ac20-463d-92b9-e756d0f28b2f`, on the host, in the worktree
`.claude/worktrees/orchestrator-arch-v2-context-pipeline-f7a49f`. Both halves, same seat, in the
required order: `/context` was the first message; the first billed turn followed it.

**Channel.** Billing figures are read from the host transcript corpus, the same channel
`scripts/measure-turn-attribution.sh` reads (`~/.claude/projects/**/*.jsonl`, per-turn
`message.usage`). Turn-1 billed total = `input_tokens + cache_creation_input_tokens +
cache_read_input_tokens`, the same composition the addendum quotes at `:179-180`. `/context`
figures are the harness's own report, quoted verbatim.

**Corpus.** All four session-root transcripts present in
`~/.claude/projects/-Users-art-code-rules-as-tests-aif--claude-worktrees-orchestrator-arch-v2-context-pipeline-f7a49f/`.
One host, one worktree, one session class — see §5 for what that does and does not license.

## §2 The four seats

```bash
jq -rc 'select(.type=="assistant") | .message.usage
        | "in=\(.input_tokens) cw=\(.cache_creation_input_tokens // 0) cr=\(.cache_read_input_tokens // 0)"' \
   "$D/<seat>.jsonl" | head -1
```

| seat | first user prompt | `input` | `cache_creation` | `cache_read` | **turn-1 billed** |
|---|---|---:|---:|---:|---:|
| `e5a0e586` | `/orchestrator` | 2 | 66,650 | 22,367 | **89,019** |
| `4d786e5e` | bare filename (`project_s_h_p14_addendum_handoff.md`) | 2 | 53,127 | 22,367 | **75,496** |
| `384ada17` | bare filename (same) | 2 | 53,127 | 22,367 | **75,496** |
| `45489086` | `/context`, then bare filename | 2 | 60,662 | 22,367 | **83,031** |

Two properties make this table usable as a measurement rather than four anecdotes:

- **`cache_read` is 22,367 on all four.** The cached prefix is byte-stable across the seats, so
  the differences live entirely in `cache_creation`.
- **The two bare-prompt seats reproduce exactly** — `cache_creation` 53,127 in both, not merely
  close. **75,496 is a reproduced baseline seat cost** (n=2), not a single observation.

`e5a0e586` is the seat the merged addendum priced; its 89,019 is quoted there at `:179` and is
reproduced here from the transcript rather than carried over from the patch text.

## §3 The `/context` half

Taken in seat `45489086` as the first message, before any other. Verbatim: **`Tokens: 59.3k / 1m
(6%)`**, with `Messages 1.3k` among the categories.

**Resident/deferred identity — reproduced, now n=3.** Category sum including the two deferred rows
= 5.7 + 4.3 + 8.4 + 42.4 + 16.7 + 1 + 29.7 + 8.9 + 1.3 = **118.4k**; deferred = 42.4 + 16.7 =
**59.1k**; 118.4 − 59.1 = **59.3k** = the reported total. The merged addendum §8.2 could claim
n=1 and said so; a second seat corroborated it at n=2 (recorded only in session memory until now);
this is the third.

## §4 Findings

### F1 — the gap, measured apples-to-apples: **16,196 tokens (21.5% of the billed turn)**

The `/context` reading describes the seat *before its own stdout entered the message stream*, so
it must not be compared against this seat's 83,031. The comparable figure is the same seat
without the `/context` block — which is the reproduced baseline:

```text
83,031  (seat 45489086, /context stdout included)
−7,535  (the /context block, §F3)
=75,496 = the two bare-prompt seats, exactly
```

The subtraction lands on the baseline to the token, so the attribution is checked, not assumed.

**Gap = 75,496 − 59,300 = 16,196 tokens**, i.e. `/context`'s reported total accounts for **78.5%**
of what the same seat bills on its first turn.

### F2 — the addendum's named falsifier **FIRED**: the gap is not the dispatch prompt

§8.5 offered its account as an explicit hypothesis (`:182-187`, «*not measured*»):

> §0 defines the substitute channel as «the resident head **plus its dispatch prompt**» […] This
> session opened with a `/orchestrator` invocation, which injects the whole SKILL.md body into the
> first message, so a large first-turn message is expected here.

Measured, two ways, both against it:

1. **The `/orchestrator` injection is 13,523 tokens** (66,650 − 53,127, both `cache_creation`,
   identical `cache_read`) — **44%** of the ~30.8k it was invoked to explain, not the bulk of it.
2. **Seats with no slash command and no dispatch prompt at all still show the gap.** The
   bare-prompt baseline bills 75,496 against a `/context`-reported 59.3k — a 16,196-token gap with
   *zero* dispatch-prompt content present.

The dispatch prompt is **a** contributor, not **the** explanation. The residual is
approximately seat-constant: 16.2k here, and 30,800 − 13,523 = **17.3k** for `e5a0e586` — two
different days, with `staging` and the memory index moved between them.

**Consequence for #5, stated but not decided.** The handoff that scheduled this measurement named
the consequence in advance: if the gap is not dispatch-prompt content, the re-labelling «must be
designed from scratch rather than from this hypothesis». It is not, so it must. **S-L owns that
design.** In particular the naming rule sketched as «by-difference = seat cost at first turn,
*dispatch prompt included*» is too narrow to survive as written — the term it needs to name is the
**first-turn injected payload**, of which the dispatch prompt is one optional component and, in
three of the four seats above, none of it.

### F3 — content-type dependence of B/token is wider than the S-H spread: **1.83 B/token measured**

The pre-turn payload census (transcript `attachment` / `system` / `user` entries preceding the
first assistant message) is **byte-identical** between seat `45489086` and baseline `384ada17`
except for the `/context` block and a 4-char filename difference:

| entry | this seat (chars) | baseline (chars) |
|---|---:|---:|
| `hook_success` (SessionStart) | 3,888 | 3,887 |
| `hook_additional_context` | 3,502 | 3,502 |
| `/context` caveat + command block | 245 + 134 | — |
| `system/local_command` (the `/context` stdout) | 13,450 | — |
| user prompt | 31 | 35 |
| `deferred_tools_delta` | 8,937 | 8,937 |
| `agent_listing_delta` | 5,754 | 5,754 |
| `mcp_instructions_delta` | 3,903 | 3,903 |
| `skill_listing` | 28,678 | 28,678 |
| `hook_success` (UserPromptSubmit) | 3,742 | 3,741 |
| **total** | **72,264** | **58,437** |

Delta = **13,827 chars** for **7,535 tokens** = **1.83 B/token** — a dense markdown pipe-table,
where each `|`, rule segment and numeral is its own token.

This sits **below** the 2.37-3.32 seven-file spread the S-H work measured, whose low end was
ASCII source and whose 3.32 outlier was the Russian-language `~/.claude/CLAUDE.md`. The band is
therefore at least 1.83-3.32, and it is driven by *content type*, not only by language. **This
independently re-confirms fork #4 = Option A in its per-seat form**: a flat conversion constant is
falsified a second time, and adopting the measured aggregate **2.62** as a new flat constant would
have mis-priced this block by **43%**.

### F4 — §8.5's *direction* is now open, and S-L must re-adjudicate it

§8.5 is titled «the gap indicts the by-difference method» and argues (`:189-193`) that
by-difference **systematically overstates** the harness remainder, «because everything it cannot
attribute to rows 1-4 lands in row 5 by construction — including message content that is not
resident load at all».

The measurement does not refute that mechanism, but it removes the premise the indictment rested
on. The residual is not user- or dispatch-authored content: by size it is dominated by
**harness-injected session-start payload** — `skill_listing` (28,678 chars, the single largest
entry), `deferred_tools_delta`, `agent_listing_delta`, `mcp_instructions_delta`, and the two hook
injects — all of which arrive in *every* seat regardless of what the operator typed, and all of
which are genuine recurring per-seat cost. On that reading `/context` **under-reports** and
by-difference does not overstate, which inverts the section's conclusion.

**Not decided here.** Deciding it requires mapping each census row onto the `/context` category
that does or does not already count it (e.g. whether `/context`'s `Skills 8.9k` *is* the
`skill_listing` attachment, and how `Messages 1.3k` can be 1.3k when 7,769 chars of payload
preceded the reading). That mapping is exactly the numerator/denominator class that consumed nine
REVISE rounds on the addendum, and it is S-L's work under cold acceptance — not this patch's.

## §5 Honest limits

- **One host, one worktree, one session class.** All four seats share a machine, a repo checkout
  and a project directory. This licenses the *identity* (§3) and the *within-worktree deltas*
  (§4 F2, F3) — every comparison above is a difference between seats holding everything else
  byte-constant, which is why `cache_read` is identical across all four. It does **not** license
  a claim about composition across seat classes, other repos, or other operators.
- **Subagent seats are untouched.** `/context` cannot be run inside a subagent, which was Option
  B's original argument and is unaffected by anything measured here. The subagent-seat 68.4%
  figure is **not** re-adjudicated by this patch.
- **`cache_creation` is not decomposed.** The baseline's 53,127 tokens of cache-creation exceed
  what the 58,437-char message-stream census can account for at any conversion in the observed
  band, so cache_creation demonstrably spans the system-prompt region as well (memory files,
  `CLAUDE.md`, rules). Which token belongs to which region is **UNMEASURED — channel absent**
  from the transcript, and is stated as such rather than estimated.
- **`Messages 1.3k` is unreconciled.** At the moment `/context` was taken, 7,769 chars of payload
  preceded it. 7,769 / 1,300 = 5.98 B/token, outside any observed band, so `/context`'s `Messages`
  row is measuring something narrower than «all message-stream content». Named as an open input
  for S-L; not resolved.
- **`/context`'s own figures are the harness's estimates**, labelled «Estimated usage by category»
  in its output. The billing figures are not estimates. A residual of a few hundred tokens between
  the two channels is expected and is not what §F1 is about.

## §6 §1.7 self-reflexive note

**Forward-check.** Complies with [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md)
(reading a local JSONL corpus with `jq`; zero API-billed calls). Complies with
[`phase-research-coverage.md §1.11`](../../../.claude/rules/phase-research-coverage.md): every
figure is re-derived from the transcript at measurement time — including 89,019, which was
available as a quotation in the merged addendum and was re-run anyway, because
`#claim-from-memory-not-source` covers quoting a patch as much as quoting recall. Complies with
[`ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) **T3** (every number carries
its command or its file:line), **T6** (§5 states coverage as predicates, not «high»), **T14** (the
`cache_creation` decomposition and the `Messages 1.3k` reconciliation report as unmeasured rather
than clean), and **T20** (no verdict is issued: #5 and #6 are routed, not decided). Carries the
principle-10 scope annotation on line 1. Adds no capability — no dependency, no `packages/` file.

**Backward-check.** Class of this change = *a later patch superseding a figure or an account
published in an earlier, append-only research patch*. Surfaces where class-X occurs, enumerated
with `grep -rln "8\.5\|30\.8k\|69,300\|by-difference" docs/meta-factory/research-patches/` plus
the spec and kickoff trees:

- [`2026-08-07-s-h-p14-context-addendum.md`](2026-08-07-s-h-p14-context-addendum.md) §8.5 —
  **GAP-FOUND, routed not edited.** Its hypothesis is falsified (§F2) and its conclusion's
  direction is reopened (§F4). The file is append-only and read-only for this session; the
  supersession is recorded here by name and lands in S-L's charter as its adjudication target.
- [`2026-08-07-s-h-harness-remainder-p14.md`](2026-08-07-s-h-harness-remainder-p14.md) — the P14
  price list whose rows are quoted in by-difference terms. **GAP-FOUND, routed:** if §F4 resolves
  toward the reversal, its harness-share rows change denominator, not just label. Named in S-L §1.
- [`2026-08-07-s-h-turn-attribution-p3d-p11.md`](2026-08-07-s-h-turn-attribution-p3d-p11.md) —
  **GAP-FOUND, routed.** A first draft of this row read SWEPT-CLEAN («neither consumes the
  harness-remainder figure nor the 4 B/token constant»); the grep overturned it. Two sites
  consume the falsified constant: `:482` rests a tolerance claim on it («a ~2% spread […] well
  inside the 4 B/token estimation error» — the *conclusion* survives, since 2% is inside the
  1.83-3.32 band either way, but its stated justification cites a falsified constant), and `:536`
  multiplies by it directly to price the patch's own always-on cost («`wc -c` on this file × 4
  B/token × the 23.7× median main-seat residency multiplier» — that figure moves).
- [`scripts/measure-turn-attribution.sh:61`](../../../scripts/measure-turn-attribution.sh) —
  **GAP-FOUND, routed:** `BYTES_PER_TOKEN=4`, declared with the comment «inherited from the seed
  (§W1): 4 B ~= 1 token, est.» — the constant §F3 falsifies a second time. It is not inert: five
  consumption sites (`:440`, `:441`, `:446`, `:457`, `:478`) price the FORK-E injector line and
  three awk tables with it. Not edited here (S-H's permitted set, and the live per-turn SSOT);
  named as an S-L deliverable. The first draft of this row cited `:63` — off by two; the grep
  gave the real line.
- `2026-08-01-token-economy-distillate.md` and `2026-08-01-token-economy-s-a-profile.md` —
  **SWEPT-CLEAN, grep collision.** Both surface in the sweep only because `18.5%` / `86.3%` match
  the `8\.5` term; neither quotes the harness-remainder figures nor the conversion constant.
- [`docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md`](../../superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
  P13 / §1.5 — **GAP-FOUND, routed:** S-D′ ranks harness-side levers by the P14 price list, so a
  moved conversion moves the *ranking*, which is S-D′'s product. This is the ordering constraint
  S-L inherits.
- [`.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md`](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md)
  — **SWEPT-CLEAN for this change class:** it records stage ownership, not token figures. (It
  carries a separate, already-named staleness — the pre-descope ADR-8 owner — which belongs to
  S-K, not here.)

No merged patch is edited by this change.

**T21 self-report, stated rather than papered over.** The discipline this project carries is that
a backward-check enumeration is **run, not recalled** — and it was violated here in the drafting
order: the six rows above were first written from working knowledge of the repo, and the greps
were run afterwards. They overturned **two of six** — `-p3d-p11` was drafted SWEPT-CLEAN and is
GAP-FOUND, and the script's constant is at `:61`, not the `:63` drafted. That is the same failure
rate as the two prior instances in this umbrella (#1250: 3 of 6 rows changed; #1251: 5 of 9
surfaces missed), now at **three consecutive occurrences**, which is the evidence base the
[`ai-laziness-traps.md §5`](../../../.claude/rules/ai-laziness-traps.md) T21 promotion criterion
asks for — recorded here so the counter is not lost. The rows above are the post-grep state; the
draft is reported rather than silently replaced, because a sweep that only ever shows its
corrected output is indistinguishable from one that was right the first time.
