<!-- scope:arch-v2-context-pipeline-s-h-p14 -->

# S-H — harness-remainder price list + settings recommendations (P14)

> **Authoritative for:** the per-block price list of the NON-repo resident session-start load,
> each row with its measurement channel, and the operator-applied settings recommendations
> derived from it (2026-08-07 host measurement).
> **NOT authoritative for:** per-turn attribution, hook firing rates and the FORK-E injector line
> — sibling patch [`2026-08-07-s-h-turn-attribution-p3d-p11.md`](2026-08-07-s-h-turn-attribution-p3d-p11.md);
> repo-owned always-on ceilings/gates (S-E); resident-file trims (S-G); the skills-listing
> overflow surface (S-I owns it, spec §8 item 4); subtraction maps (S-D′);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

**Recommendations only.** `.claude/settings.json` and `.claude/settings.local.json` are
operator-applied and agent-uncommittable; nothing in this patch edits them.

---

## §0 Channel statement (binding — read before any number below)

S-E has **not merged** and no P3c `InstructionsLoaded` verdict exists (see §5), so the kickoff's
fallback applies: price via `/context` alone, with a note. **The note is this section.**

`/context` is an interactive CC slash command. This stage executed as a **non-interactive
background session**, where slash commands are not invocable, so `/context` produced no output
and none is quoted — fabricating one would be the exact failure T3 and §3a forbid.

**Substitute channel, named and reproducible:** a subagent's or session's **first billed turn**
in `~/.claude/projects/**/*.jsonl` carries `input_tokens + cache_creation_input_tokens +
cache_read_input_tokens` for a context containing nothing but the resident head plus its
dispatch prompt. That is a direct, machine-readable measurement of total resident load per seat
class. Combined with `wc -c` on each repo/host-side block, it prices the harness remainder **by
difference**.

**What this channel cannot do, stated up front (T-SH-A):** it yields the remainder as an
aggregate, not `/context`'s per-block split of that remainder. Rows below that would need the
split read **`UNMEASURED — channel absent`** and are never estimated. **One `/context` paste
from an interactive operator session closes those rows** — that is the cheapest single action
that would complete this table.

> **Superseded in part — see §8.**
> The operator supplied that `/context` paste on 2026-08-07, after this patch merged. It closed
> **two** of the four `UNMEASURED` rows (5c, 5e) and left two open (5d, 9). Read §8 before acting
> on any figure below.

Conversion: **4 B ≈ 1 token, est.**, per the seed's binding convention, applied uniformly.
**⚠ Falsified after merge — measured 2.62 B/token on seven files with both counts; see
§8.1. Figures
below are left as published and are known-low by ≈1.53×; the remainder (row 5, computed by
difference) is correspondingly known-HIGH.**

---

## §0a DECISION-NEEDED #3 (as at stage close) — the prescribed pricing channel could not observe, and five blocks stayed unpriced

> **ANSWERED 2026-08-07 (post-merge): Option A taken.** The operator ran `/context` and supplied
> the output; §8
> records the result. The fork below is kept **verbatim** as the record of the state at stage
> close — it is not rewritten to look as though the answer had been available. Note that Option
> A's stated consequence turned out to be optimistic: it closed **two** of the four rows, not
> four, and row 8's injected form remains S-I's to publish. **Unpriced blocks are now three**
> (5d, 9, and row 8's injected form), down from the five this heading records.

§3a of the stage kickoff names «an unpriceable block class» and «a probe that cannot observe» as
DECISION-NEEDED triggers. Both fired here, so this is recorded in §3a grammar rather than only
as a ranked recommendation (R1 below keeps the substance; this section supplies the contract
form the sibling patch already uses for its own two forks).

**What happened:** the kickoff prescribes `/context` as P14's fallback pricing channel, while
the dispatch header permits non-interactive execution — where slash commands are not invocable.
No descope covers that combination. The substitute channel (first-turn transcript billing, §0)
prices the remainder **in aggregate** but cannot split it, so rows 5c, 5d, 5e and 9 return
`UNMEASURED — channel absent` and row 8 is source-side only.

> **DECISION-NEEDED:** P14's per-block decomposition of the harness remainder (~42,621 tok,
> 68.4% of the measured seat) is **UNPRICED**, and S-D′'s stated instrument rule is to park the
> ordering of any block neither instrument prices.
> **Option A** — the operator runs `/context` once in an interactive session and pastes the
> output into this patch. Consequence: the four `UNMEASURED — channel absent` rows (5c, 5d, 5e,
> 9) resolve into a per-block split and row 8 gains its injected-form figure — the same five
> unpriced blocks this heading names — S-D′ can order its harness-side drops, and the cost is
> one command.
> **Option B** — accept the aggregate as final for this umbrella. Consequence: S-D′ marks the
> harness remainder `UNPRICED` and **parks its harness-side ordering** per its own rule, so the
> subtraction maps ship covering the repo-owned ~21% only — the smaller half, against §0.5's
> expensive-seat-first principle.
> Consequence of doing nothing: S-D′ inherits an unpriced block and must park regardless, but
> without this fork recorded the park will read as an S-D′ defect rather than an S-H input gap.
> **Not resolved here** — the choice is the operator's; the stage did not build a workaround.

---

## §1 Total resident head per seat class — MEASURED

| seat class | resident head | transcript / command (reproducible pointer) |
|---|---:|---|
| main CC session, this stage (2026-08-07) | **89,019 tok** | `…/e5a0e586-8a12-4765-905b-13b307556f67.jsonl`, first billed turn |
| main CC session, 60 most-recent project sessions | median **100,529** (min 63,751 / max 161,189) tok | command below |
| subagent, full toolset (`general-purpose`) | **62,340 tok** | `…/subagents/agent-a8ef1a67abc18f52b.jsonl` |
| subagent, reduced toolset (`Explore`) | **26,659 tok** | `…/subagents/agent-a44e1f59627a682f2.jsonl` |
| subagent, reduced toolset (`Plan`) | **26,783 tok** | `…/subagents/agent-a063ec38421c06d63.jsonl` |

The three subagent transcripts live under
`~/.claude/projects/-Users-art-code-rules-as-tests-aif--claude-worktrees-orchestrator-arch-v2-context-pipeline-f7a49f/e5a0e586-8a12-4765-905b-13b307556f67/subagents/`;
the sibling patch §6 gives the one-liner that reproduces all three heads (and their
`tool_use-count=0`). **62,340 tok is the denominator the whole §2 price list is sized against**,
so it is pinned to a file, not just a channel name.

The main-seat distribution reproduces with:

```bash
for d in ~/.claude/projects/-Users-art-code-rules-as-tests-aif*; do
  f=$(ls -t "$d"/*.jsonl 2>/dev/null | head -1); [ -n "${f:-}" ] || continue
  jq -s 'map(select(.type=="assistant" and .message.usage))[0] | select(.!=null)
         | (.message.usage.input_tokens + .message.usage.cache_creation_input_tokens
            + .message.usage.cache_read_input_tokens)' "$f" 2>/dev/null
done | awk '$1>0' | sort -n \
  | awk '{v[NR]=$1} END{printf "n=%d min=%d median=%d max=%d\n", NR, v[1], v[int((NR+1)/2)], v[NR]}'
```

```console
n=60 min=63751 median=100529 max=161189
```

(`awk '$1>0'` drops one degenerate session whose transcript holds no billed turn — excluded
rather than allowed to drag the minimum to 0.)

The 60-session median of **100,529 tok independently confirms ADR-3's «~100k observed
session-start total»** through a completely different channel (transcript billing vs the S1
script's file-side count). ADR-3's figure is corroborated, not contradicted.

---

## §2 The price list — every row names its channel

Sized against the **`general-purpose` subagent seat (62,340 tok)**, the one seat class where
every subtractable block is present and the total is exactly measured.

| # | block | est-tokens | share | measurement channel |
|---|---|---:|---:|---|
| 1 | repo-owned always-on files (pre-S-G set as loaded) | 17,363 | 27.8% | `wc -c` × 4 B/t; set confirmed live by agent context inventory |
| 2 | operator-global `~/.claude/CLAUDE.md` | 800 | 1.3% | `wc -c` (3,198 B) |
| 3 | memory index `MEMORY.md` | 1,126 | 1.8% | `wc -c` (4,505 B) |
| 4 | session-bootstrap digest (per prompt) | 430 | 0.7% | live hook probe + corpus hook records (1,721 B) |
| 5 | **harness remainder** (base system prompt + tool schemas + MCP + listings) | **42,621** | **68.4%** | **by difference: row-total minus rows 1-4** |
| 5a | — composite floor: base prompt + reduced toolset (`Explore` seat, no repo files) | 26,229 | 42.1% | `Explore` first-turn billing minus its digest |
| 5b | — incremental tool schemas of a full-tool seat over a reduced one | 16,392 | 26.3% | difference between the two measured seats |
| 5c | — MCP tool schemas (resident subset) | **8.4k** (§8.3, 2026-08-07) | — | `/context` «MCP tools» — operator paste, post-merge |
| 5d | — MCP server instructions | `UNMEASURED — channel absent` | — | visible in-prompt, no byte channel; `/context` does not itemise it apart from tool schemas (§8.3) |
| 5e | — skills/agents listing, as injected | **8.9k** skills + **1k** custom-agent listing (§8.3, 2026-08-07) | — | `/context` «Skills» + «Custom agents» — operator paste, post-merge |

**Blocks priced outside the subagent total** (they belong to the main session, not a subagent):

| # | block | est-tokens | channel |
|---|---|---:|---|
| 6 | plugin `SessionStart` inject (`"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" session-start`) | **1,145 / session** (4,581 B, 190 firings, 1.01/transcript — so one inject per session) | corpus hook-execution records |
| 7 | subagent digest (per spawn, `SubagentStart`) | 457 (1,828 B, 728 firings, 1.01/subagent) | corpus hook-execution records |
| 8 | skills listing, **source-side** sum of 129 `SKILL.md` name+description | **10,264 (41,057 B)** post-S-I; 11,332 (45,329 B) pre-S-I | `awk` over frontmatter; **source-side, not the injected form** — S-I owns the injected/truncated figure |
| 9 | agents inventory: 17 files, 188,117 B on disk | listing form `UNMEASURED — channel absent` | `wc -c`; agents are listed, not loaded whole. **Still open after the §8 paste**: `/context`'s «Custom agents» (1k) counts the harness's *registered* agent types, a different population from the repo's `agents/` directory (§8.3) |

**The headline.** The harness remainder is **68.4%** of a full-tool subagent seat and **77.8%**
of this stage's main seat (69,300 of 89,019 tok). The spec's «60-71% harness share» is
**confirmed at the subagent seat and exceeded at the main seat**. Row 5a alone — the base
prompt plus a *reduced* toolset, carrying no repo content whatsoever — is **26,229 tok, larger
than the entire pre-S-G repo-owned always-on set (17,363)**. Everything S-E and S-G can reach
is the smaller half of the problem.

---

## §3 What already works — preserve it (the kickoff's explicit instruction)

1. **ToolSearch deferral keeps deferred schemas non-resident.** In this session ~90 tools are
   listed by *name only* and require a `ToolSearch` call before use. Confirmed live: `WebFetch`
   and `WebSearch` were unavailable until fetched by name mid-session, then became callable.
   Do not undo this; it is the single largest working mitigation on row 5.
2. **The `paths:` edit-time channel.** Rules scoped by `paths:` fire at **0.93 firings per
   transcript**, in 55.6% of transcripts (sibling patch §4) — delivered when relevant, free in
   the ~44% of sessions where they never fire. S-G's digest swap rides this.
3. **`claudeMdExcludes` is now working.** Three rules the S-A profile recorded as «loaded
   despite `claudeMdExcludes`» (35,197 B) are absent from a live agent's context inventory, and
   `.claude/settings.local.json` no longer carries a shadowing key (`jq` → `ABSENT`). Both P1
   residue items are discharged.
4. **S-G's trim landed and is measurable:** repo-owned resident set fell from 69,453 B
   (~17,363 tok) to **48,671 B (~12,167 tok)** — `CLAUDE.md` 22,605 + `00-rule-index.md` 4,067 +
   `ai-laziness-digest.md` 6,703 + `attention-is-not-a-mechanism.md` 2,629 +
   `build-first-reuse-default.md` 12,667. That is **−20,782 B (−29.9%)** resident per expensive
   seat, and it moves row 1 from 27.8% to ~21% of the same seat.

---

## §4 Recommendations — operator-applied, ranked by measured effect

Each carries its evidence and what would make it wrong. None is applied by this stage.

**R1 — Close the UNMEASURED rows with one `/context` paste (cost: one command).** This is the
ranked-recommendation form of **DECISION-NEEDED #3 (§0a) Option A**; the fork itself is the
operator's to settle, this is only the ordering advice.
Rows 5c/5d/5e are the channel-less blocks inside the measured seat total, and row 9 is the
fourth, priced outside it. An interactive
`/context` run pasted into this patch converts ~42,621 tok of aggregate into a per-block split,
which is exactly what S-D′ needs to *order* its harness-side drops. Until then S-D′ must treat
the harness remainder as one `UNPRICED` block and park its ordering, per its own instrument rule.
*Wrong if:* `/context` in the current CC build does not break out MCP/skills separately.

**R2 — Audit MCP servers registered but unauthenticated.** This session reported 8 servers
(`plugin:engineering:asana|atlassian|datadog|github|linear|notion|pagerduty|slack`) that
**cannot be used without an OAuth flow** and were unusable for the entire stage. Configured
servers total only 4 across `~/.claude.json` (context7, deepwiki) and the project `.mcp.json`;
the 8 come from a plugin bundle. Per the primary caching doc, «Modifying tool definitions
(names, descriptions, parameters) invalidates the entire cache» — so an unused server is not
merely resident weight, it is also a cache-invalidation surface whenever the bundle changes.
Recommend disabling the unauthenticated subset at the plugin level.
*Wrong if:* those servers' schemas are ToolSearch-deferred and therefore already non-resident —
which R1 would settle. **Priced `UNMEASURED — channel absent` until then; this is a
disable-candidate on grounds of unusability, not a quantified saving.**

**R3 — Adjudicate a once-per-session cache for `inject-session-bootstrap.sh` (S-D′ decides).**
Measured: **10.07 firings/transcript** × 1,721 B, no cache guard; residency-weighted **0.48% of
total weighted spend [H]**, of which ~90% is recoverable by caching. (Per *transcript* — the
sibling patch's basis, 1,904 firings / 189 transcripts — kept here for comparability. On the
narrower per-*session-with-billed-turns* basis, 1,904 / 185 ≈ 10.3; the two differ only by the
four transcripts that carry no billed turn, and no conclusion turns on which is used.) The sibling
`inject-matching-rule.sh` already implements exactly that pattern. Real and cheap — but **not a
top-three lever**, and the counter-argument (per-prompt re-injection *is* the digest's
compaction-resilience purpose) is a design call, not a cost call. Mechanism is a
maintainer-handoff proposed diff; hooks are outside S-D′'s permitted set.

**R4 — Route the skills-listing block to S-I, do not re-derive it here.** Source-side sum
measured twice, straddling S-I's description trims (#1229, merged mid-stage): **45,329 B
(~11,332 tok) before, 41,057 B (~10,264 tok) after** across 129 `SKILL.md` files — S-I's trims
are worth a measured **−4,272 B (−1,068 est-tokens)** at source, of which the project-scope
share is 14 files / 6,508 B. The *injected* figure differs again because the harness truncates
to a listing budget — precisely the overflow S-I owns (spec §8 item 4, ~9.1k est-tokens vs a
~2k budget). Two stages publishing two different numbers for one block would be the drift this
project exists to prevent, so the injected figure stays S-I's to publish.

**R5 — Do not spend further effort on repo-side residency without a harness-side plan.** Row 1
is now ~21% of a full-tool subagent seat post-S-G, and 12,167 est-tokens against a ~26,229-tok
harness floor that carries no repo content at all. Additional repo trims have a hard ceiling
below the remainder they are competing with. This is the §0.5 expensive-seat-first principle
applied to its own evidence: the next real lever is harness-side, and R1 is its precondition.

---

## §5 Item 4 — conditional P3c live confirmation: **branch (c), skipped**

The kickoff's three branches; the third holds.

Locating probe, run verbatim from the kickoff:

```console
$ grep -rln "P3c\|InstructionsLoaded" docs/meta-factory/research-patches/
docs/meta-factory/research-patches/2026-06-04-ai-doc-audit-c1-r.md
docs/meta-factory/research-patches/2026-08-01-token-economy-s-b-candidates.md
docs/meta-factory/research-patches/2026-06-01-capability-census.md
docs/meta-factory/research-patches/2026-07-31-per-role-context-opus-cold-verify.md
docs/meta-factory/research-patches/2026-06-04-ai-doc-audit-c2-r.md
```

(Re-run after `#1231` — the S-E *kickoff* Phase -1 repair — merged mid-stage: same five files,
plus **this patch itself**, which now matches the pattern because it documents the probe. A
reader re-running it today gets six hits for that reason; the five above are the pre-existing
population.)

**The kickoff predicted «→ no match». The probe returns five files — and none is an S-E
verdict.** Reported as observed rather than as predicted (T3). Inspecting each: the hits are
pre-existing *mentions* of the `InstructionsLoaded` hook event — the capability census
enumerating CC hook events, two 2026-06-04 audit patches recording it as an
`INCONCLUSIVE`/observation-needed item, the S-B candidate survey naming it in a stage
description, and the per-role cold-verify noting CC 2.1.207 shipped the event. No file contains
a P3c verdict in either direction.

Corroborating probes:

- `grep -rn "P3c" docs/ .claude/` → hits only in the decision-layer **spec** and the **S-E
  kickoff** (which *defines* the task), never a verdict.
- `gh pr list --state all --search "arch-v2-context-pipeline"` → #1231, #1229, #1228, #1227,
  #1226, #1225, all merged. **No S-E implementation PR exists.** #1231 («absorb Phase -1 REVISE
  on S-E») merged mid-stage and is a repair to the S-E *kickoff*, not the stage: it moves no
  P3c verdict into the tree, and the probe above was re-run after it to confirm exactly that.

**Conclusion: S-E is unmerged, therefore no P3c verdict exists → branch (c). The live
confirmation is skipped, and no workaround was built.** Branch (c) is a legal outcome, not a
shortfall. P14 accordingly priced via the §0 substitute channel, as recorded there.

---

## §6 Coverage and confidence (T6)

- **Seat classes measured:** 5 (main-this-session, main-60-session distribution, full-tool
  subagent, two reduced-tool subagents). Every total is a first-turn billing figure, not an
  estimate, and each carries a transcript path or the exact command that reproduces it (§1) —
  including the 62,340-tok figure the whole §2 price list is sized against.
- **Forks:** the channel gap is recorded in §3a grammar as **DECISION-NEEDED #3 (§0a)**, not
  only as recommendation R1; the sibling patch carries #1 (corpus drift) and #2 (denominator).
  None of the three is resolved by this stage.
- **Price-list rows (as at stage close):** **14** enumerated (1, 2, 3, 4, 5, 5a, 5b, 5c, 5d, 5e,
  6, 7, 8, 9); **9 MEASURED with a named channel**, **4 marked `UNMEASURED — channel absent`**
  (5c, 5d, 5e, 9 — the same set §0a names), 1 (row 8) measured source-side with the injected form
  explicitly deferred to S-I. Partition **14 / 9 / 4 / 1**, verified by counting the table rather
  than restated from memory. **No row carries an estimate dressed as a measurement**, and no
  `UNMEASURED` row was back-filled to make the predicate tidier (T-SH-A).
  **Revised 2026-08-07 after the §8 addendum: 14 / 11 / 2 / 1** — 5c and 5e gained a named
  channel; 5d and 9 did not (§8.3).
- **Share of the harness remainder actually decomposed (as at stage close):** rows 5a+5b = 42,621
  of 42,621 tok as a two-way split by seat capability; **0% decomposed into the MCP / skills /
  system-prompt split that `/context` would give.** Per T14 the correct verdict for that split was
  **«coverage insufficient to rank harness sub-blocks»**, not «the harness is mostly X». R1 was
  the action that closes it. **Revised 2026-08-07:** R1 was performed and §8.2 supplies that
  split for the seat it was taken on — memory files 50.5%, skills 15.3%, MCP tool schemas 14.4%,
  system tools 9.1%, base prompt 8.9%, custom-agent listing 1.7% — at n=1 and on an orchestrator
  seat, so the honest verdict is now «ranked for one measured seat», not «ranked in general».
- **Repo-owned rows** are exact byte counts; the *set membership* was independently confirmed
  live (sibling patch §6 item 2) rather than assumed from the rule index.
- **Est-token conversion** is 4 B ≈ 1 token throughout; no tokenizer was available, and every
  converted figure is labelled est. **Falsified 2026-08-07 (§8.1):** measured **2.62 B/token**
  across seven files carrying both a byte count and a harness token count. Every 4 B/t figure in
  this patch is low by ≈1.53×, and row 5 — computed by difference — is correspondingly high.
  Raised as **DECISION-NEEDED #4**; figures are left as published rather than silently reconverted.

---

## §7 §1.7 self-reflexive note

**Forward-check.** [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md):
this patch adds no check, so it introduces no bare-attention gate; the one obligation it creates
(R1) is an operator action with a named artefact, not «someone should look at the harness».
T-SH-A is the governing trap and is satisfied structurally — the price table has a channel
column, and four rows (5c, 5d, 5e, 9) exercise the `UNMEASURED — channel absent` value rather
than being back-filled from byte estimates — with row 8 priced source-side only, making five
unpriced blocks in all. **Revised 2026-08-07 (§8.3):** two of those four (5d, 9) still exercise
the value; 5c and 5e gained a named channel from the operator's `/context` paste, so unpriced
blocks are now **three** (5d, 9, row 8's injected form), not five. The trap held
under the update — the paste answered two rows and the other two were left `UNMEASURED` rather
than filled from the nearest plausible neighbour, which is the whole point of the value existing. §3a of the kickoff is satisfied in its own grammar: the
unpriceable-block / probe-cannot-observe fork is stated as `DECISION-NEEDED` with both options
and their consequences (§0a), matching the shape the sibling patch uses, so one stage does not
ship two different reporting forms for the same contract. T20: every recommendation cites a measured number or explicitly
states that it is a disable-candidate on non-cost grounds (R2). T14: the undecomposed harness
split is reported as insufficient coverage, not as a finding.
[`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md): all measurement is shell
+ transcript reading; no LLM is in any loop.

**Backward-check.** Class of this change = *artefacts that price a session-start context block*.
Enumerated surfaces where that class occurs, verdicted per surface:

- `docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md` ADR-3 (~100k
  session-start total, 29-39% repo-owned) — **SWEPT-CLEAN**: independently corroborated by the
  60-session median 100,529 tok, and the repo-owned share measured at 27.8% pre-S-G / ~21%
  post-S-G, inside ADR-3's stated band. No correction owed.
- `docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md` P14 row («remainder ≈
  100k − (29-39k repo-owned)») — **SWEPT-CLEAN**: measured 68.4% at the subagent seat, 77.8% at
  the main seat; the row's arithmetic holds.
- `docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md` §5.1
  settings-recommendations — **GAP-FOUND, not edited** (closed historical artefact, its
  authoring session owns it): its rows 6-8 «loaded despite `claudeMdExcludes`» and its
  16,504 B `MEMORY.md` are both superseded (4,505 B today, and the three rules are evicted).
  Correction recorded here.
- `.claude/settings.json` / `.claude/settings.local.json` — **NOT SWEPT, deliberately**:
  operator-only, agent-uncommittable; §4 issues recommendations and applies nothing. The
  local-shadow key was *verified absent*, which is an observation, not an edit.
- `.claude/orchestrator-prompts/arch-v2-context-pipeline-s-i/kickoff.md` (skills-listing budget)
  — **GAP-DEFERRED BY OWNERSHIP**: row 8 is measured source-side only and explicitly routed to
  S-I rather than double-priced here.
- `scripts/measure-always-on.sh` — **NOT SWEPT, out of permitted set (S-E owns)**; it measures
  the repo-owned half only, which is exactly the 21-28% this patch bounds from the other side.

**Self-application (T15).** This patch prices resident context. Its own residency: it carries no
`paths:` frontmatter and lives under `docs/meta-factory/research-patches/`, which is in **no**
resident set — it costs zero unless deliberately read by S-D′ or S-E. Applying its own R5 to
itself: adding it to any always-on channel would be the error it warns against, since it is
reference material consulted once per stage, not per turn.

---

## §8 Addendum (2026-08-07, post-merge) — DECISION-NEEDED #3 answered by Option A

The operator ran `/context` in an interactive session and pasted the output. §0a's Option A is
therefore **taken**, and the block below records what it resolved and what it did not. This
section is an addendum rather than an in-place rewrite on purpose: the measurement history must
read «unknown at stage close → known on 2026-08-07», not as though the split had been available
all along.

**Provenance and its limits (T6, stated before the numbers).** One `/context` snapshot, n=1, from
an **orchestrator seat in a worktree** whose edit-time rule matcher had injected four rule files
(`00-rule-index`, `attention-is-not-a-mechanism`, `build-first-reuse-default`,
`ai-laziness-traps` — the other three of the seven memory files are the two `CLAUDE.md` and
`MEMORY.md`).
A fresh main-checkout seat, or a subagent seat, has a different resident set. All figures are the
harness's own reported estimates at its own rounding (`5.2k`, `~380`); no tokenizer was run.
`Messages 276.4k` is that session's accumulated dialogue and is **not** resident load.

### §8.1 The finding that outranks the split: the 4 B/token convention is falsified

The seed's binding conversion — **4 B ≈ 1 token**, applied uniformly across both S-H patches — is
directly checkable for the first time, because `/context` itemises per-file token counts for
files whose byte counts are known. Seven files carry both:

| file | bytes (`wc -c`) | tokens (harness) | B/token |
|---|---:|---:|---:|
| `~/.claude/CLAUDE.md` | 3,198 | 964 | 3.32 |
| `<repo>/CLAUDE.md` | 23,740 | 9.3k | 2.55 |
| `.claude/rules/00-rule-index.md` | 4,030 | 1.7k | 2.37 |
| `.claude/rules/attention-is-not-a-mechanism.md` | 2,629 | 1.1k | 2.39 |
| `.claude/rules/build-first-reuse-default.md` | 12,667 | 4.8k | 2.64 |
| `.claude/rules/ai-laziness-traps.md` | 26,387 | 9.8k | 2.69 |
| `…/memory/MEMORY.md` | 4,505 | 1.8k | 2.50 |
| **aggregate** | **77,156** | **29,464** | **2.62** |

**Measured 2.62 B/token, not 4.** The six ASCII-dominant repo files cluster at 2.37-2.69; the
outlier (3.32) is the operator-global `CLAUDE.md`, which is largely Russian — multi-byte UTF-8
inflates bytes per token, which is the expected direction and corroborates rather than
undermines the reading.

**Consequence, flagged and NOT silently applied.** Every `est-tokens` figure derived through
4 B/t in this patch and its sibling is low by ≈**1.53×** (4 / 2.62). Because row 5 (the harness
remainder) is computed **by difference** — seat total minus rows 1-4 — an understated rows 1-4
makes the remainder correspondingly **overstated**. A first-order restatement on the same seat
total gives rows 1-4 = 19,719 × (4 / 2.6187) ≈ **30,120** tok and a remainder of
62,340 − 30,120 = **32,220** tok, i.e. **51.7%, not 68.4%**.

That restatement is **not** written into §2, and the table's figures are left as they were. Two
reasons, both binding: the row-1 file set is the *pre-S-G* resident set while the ratio was
measured on the *current* one, so the two are not the same population; and re-deriving §2 on a
new conversion is a re-measurement, which is beyond an addendum. **Recorded as a correction owed,
not as a correction made.**

> **DECISION-NEEDED #4 — the conversion constant.** The 4 B/t convention is inherited from the
> S-A seed and is load-bearing for every est figure in this umbrella.
> **Option A** — adopt **2.62 B/token** (or a per-seat re-measurement) as the operative
> conversion and re-derive §2 and the sibling's 4 B/t sites — its **§5, §7 and §8** (the sibling
> runs §0-§8; there is no §9) — in a follow-up stage. Consequence: the
> harness share drops to roughly half, and the repo-owned half becomes correspondingly *more*
> expensive — which changes which levers S-D′ ranks first.
> **Option B** — keep 4 B/t for comparability with S1/S2 figures already published under it, and
> carry this section as the standing caveat. Consequence: every published est figure stays
> internally comparable but is known-low by ~1.5×.
> **Not resolved here.**

### §8.2 What the snapshot resolves — the resident/deferred identity

The reported percentages sum to **105.6%**, which is not an error: the two `(deferred)` rows are
counted in the table but are **not resident** — they are tool schemas held behind `ToolSearch`
and fetched on demand. The identity confirms it exactly:

```text
resident non-message load = 334.6k − 276.4k                       = 58.2k
sum of non-deferred rows  = 5.2 + 5.3 + 8.4 + 1 + 29.4 + 8.9      = 58.2k   ← exact match
deferred, i.e. NOT resident = 42.4 + 15.7                          = 58.1k
```

| resident block | tokens | share of resident |
|---|---:|---:|
| memory files | 29.4k | 50.5% |
| skills listing | 8.9k | 15.3% |
| MCP tool schemas (resident subset) | 8.4k | 14.4% |
| system tools | 5.3k | 9.1% |
| base system prompt | 5.2k | 8.9% |
| custom-agent listing | 1k | 1.7% |

Two readings follow, and only the first is new:

1. **Half the resident load is memory files** — 29.4k of 58.2k. Within it, two documents carry a
   third of the *entire* resident head: `<repo>/CLAUDE.md` (9.3k) and
   `.claude/rules/ai-laziness-traps.md` (9.8k) = 19.1k. This is the «expensive end» §0.5 says to
   price first, and it is repo-owned — i.e. **actionable by this project**, unlike the harness
   blocks.
2. **`ToolSearch` deferral withholds 58.1k — almost exactly what the entire resident head costs.**
   §3's «preserve what already works» now has its number. **Stated precisely, because the loose
   form is wrong:** making those schemas resident would **double the resident head** (58.2k →
   116.3k); it would *not* halve the budget — on this 1m-window snapshot free space moves
   665.4k → ~607.3k, i.e. **−8.7%**. The head is what the deferral halves, and the head is what
   every seat pays before its first word. On that measure it is still the single most expensive
   regression available in this table.

### §8.3 Which `UNMEASURED` rows this closes — two of four, not four

| row | before | after | basis |
|---|---|---|---|
| 5c — MCP tool schemas (resident subset) | `UNMEASURED — channel absent` | **8.4k** | `/context` «MCP tools» |
| 5e — skills/agents listing, as injected | `UNMEASURED — channel absent` | **8.9k** skills + **1k** custom-agent listing | `/context` «Skills» + «Custom agents» |
| 5d — MCP server instructions | `UNMEASURED — channel absent` | **unchanged** | `/context` does not itemise server instructions apart from tool schemas. Where they are counted is *not* established by the snapshot — asserting a region would be the estimate T-SH-A forbids |
| 9 — agents inventory (17 repo `agents/*.md`) | `UNMEASURED — channel absent` | **unchanged** | different population: `/context`'s «Custom agents» (1k) counts the harness's *registered* agent types — one row, `orchestrator-planner` — not the repo's `agents/` directory |

Rows 5d and 9 stay `UNMEASURED — channel absent` rather than being filled from the nearest
plausible neighbour. Reporting «two of four» where «four of four» was expected is the T-SH-A
obligation working as intended.

**Revised partition:** the price list still holds **14** rows; **11** now carry a named channel,
**2** read `UNMEASURED — channel absent` (5d, 9), and 1 (row 8) is measured source-side with the
injected form still S-I's to publish. Partition **14 / 11 / 2 / 1**, counted from the table.

### §8.4 What S-D′ can now do, and what it still cannot

**Can:** rank the resident head by block, with the repo-owned memory files (29.4k, 50.5%) as the
top-ranked and *own-able* target — the ordering §0.5 asks for is available for the half that
matters. **Cannot:** treat the absolute figures as final while DECISION-NEEDED #4 is open, or
split the MCP server-instruction block. **Should:** read the ratio finding (§8.1) before ordering
anything, since it moves the repo-vs-harness balance by roughly the width of the decision.
