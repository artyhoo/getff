<!-- scope:arch-v2-context-pipeline-s-l-recalculation -->

# S-L — the recalculation: forks #4, #5, #6

> **Status:** recalculation + decomposition + two routed forks. **Append-only.** This patch edits
> no merged S-H patch. Where a merged figure is superseded or its justification corrected, it is
> superseded *here, by name*, per the [CLAUDE.md](../../../CLAUDE.md) Artifact Ownership Contract.
> **Input:** [`2026-08-07-s-l-5c-first-turn-vs-context.md`](2026-08-07-s-l-5c-first-turn-vs-context.md)
> (the #5-C measurement), read in full and re-verified where this patch builds on it.

## §0 Headline

Four results, in the order they constrain each other:

1. **The conversion has an undefined UNIT, and the unit accounts for the whole upper end of the
   published spread.** S-H measured bytes; the 5-C census measured codepoints; both called the
   result «B/token». Re-measured at the commit the seat actually loaded, S-H's byte table
   reproduces exactly — and in codepoints its 3.32 outlier collapses to 2.587, *inside* the
   cluster (§1).
2. **`/context`'s `Skills 8.9k` IS the `skill_listing` attachment** — the load-bearing unknown
   §1.3 named is closed, mechanically, n=69 both channels. So is `Custom agents 1k`: it is the
   orchestrator-planner entry and nothing else (§2).
3. **`/context` UNDER-reports.** At least **15,258 codepoints** of every-seat harness-injected
   payload are billed and appear in no `/context` category. The merged addendum §8.5's title —
   «the gap indicts the by-difference method» — **inverts** on this evidence (§3).
4. **ADR-3's 29-39% band is stale by construction**: S-G cut the numerator ~30% after the band was
   written. Reproduced: 69,453 B → **48,671 B** (§5).

## §1 Fork #4 — Option A applied per-seat, and the unit defect underneath it

### §1.1 The unit defect (new — not visible to either prior stage)

Both prior measurements label their result «B/token». They are not the same measurement:

| stage | channel | what was counted | unit |
|---|---|---|---|
| S-H §8.1 | `wc -c` on files | **bytes** | B/token |
| 5-C §F3 | `jq …\|tostring\|length` on transcript entries | **codepoints** (of a JSON serialisation) | mislabelled B/token |

For ASCII the two coincide, which is why the defect survived. For anything else they diverge by
the UTF-8 multi-byte ratio — measured on the skill listing at **1.135 bytes/codepoint**.

**Re-measurement, at the commit the measured seat actually loaded.** Seat `45489086` started
`2026-08-07T09:20:22Z`; its worktree still carried the **pre-S-G** rule set, so the correct
comparison commit is `f31fd8c094` (S-G's parent), not `origin/staging`. Measuring against
today's files instead would have been the T-SL-B defect this stage exists to prevent — a
numerator from one population over a denominator from another.

```bash
PRE=$(git rev-parse 97b10bed50^)   # f31fd8c0944a86436e87a481cfb974de3f44c68d
git show "$PRE:CLAUDE.md" | LC_ALL=en_US.UTF-8 wc -c -m
```

| file | bytes | codepoints | tokens (`/context`) | **B/tok** | **cp/tok** |
|---|---:|---:|---:|---:|---:|
| `~/.claude/CLAUDE.md` | 3,198 | 2,494 | 964 | **3.317** | **2.587** |
| `<repo>/CLAUDE.md` | 23,740 | 23,488 | 9,300 | 2.553 | 2.526 |
| `.claude/rules/00-rule-index.md` | 4,030 | 4,015 | 1,700 | 2.371 | 2.362 |
| `.claude/rules/attention-is-not-a-mechanism.md` | 2,629 | 2,574 | 1,100 | 2.390 | 2.340 |
| `.claude/rules/build-first-reuse-default.md` | 12,667 | 12,344 | 4,800 | 2.639 | 2.572 |
| `.claude/rules/ai-laziness-traps.md` | 26,387 | 25,957 | 9,800 | 2.693 | 2.649 |

**The byte column reproduces S-H §8.1 to the published precision** (2.55 / 2.37 / 2.39 / 2.64 /
2.69 / 3.32) — an independent re-derivation, not a quotation.

**The codepoint column is the new result.** S-H read the 3.32 outlier as corroborating («multi-byte
UTF-8 inflates bytes per token, which is the expected direction»). The mechanism was identified
correctly; the conclusion drawn from it was the wrong one. Multi-byte inflation is not a property
of how the text tokenises — it is a property of how it is *stored*. Removing it removes the
outlier rather than explaining it:

| unit | seven-file spread | ratio |
|---|---|---|
| bytes | 2.371 – 3.317 | **1.40×** |
| codepoints | 2.340 – 2.649 | **1.13×** |

**Superseded by name:** [`…-s-h-p14-context-addendum.md:60-63`](2026-08-07-s-h-p14-context-addendum.md)
— the sentence «the outlier (3.32) is the operator-global `CLAUDE.md` … corroborates rather than
undermines the reading». The *figure* stands (3.317 B/tok, reproduced). Its *reading* does not:
in the unit that removes storage encoding, that file is not an outlier at all.

### §1.2 The band, restated per unit, with two new content classes

Two content classes neither prior stage measured, both from the same seat:

```bash
# skill listing: attachment content vs /context's per-entry token sum
jq -j 'select(.attachment.type=="skill_listing")|.attachment.content' <seat>.jsonl | wc -c -m
```

| content class | bytes | codepoints | tokens | B/tok | cp/tok |
|---|---:|---:|---:|---:|---:|
| dense ASCII pipe-table (`/context` stdout) | 13,450 | 13,450 | 7,535 | **1.835** | **1.835** |
| skill listing (Cyrillic-rich prose entries) | 30,299 | 26,696 | 8,870 | **3.416** | **3.010** |
| custom-agent entry (ASCII prose + examples) | 3,134 | 3,128 | ~1,000 | 3.134 | **3.128** |

**Operative bands — wider than S-H's published 2.37-3.32 in both units:**

- **bytes: 1.835 – 3.416** (1.86×)
- **codepoints: 1.835 – 3.128** (1.70×)

The 5-C patch's 1.835 survives the unit audit unchanged: that block is pure ASCII (13,450 bytes =
13,450 codepoints, verified), so its figure is unit-neutral and is a genuine bytes/token result.

### §1.3 Decision taken (not routed): the unit binds to the CHANNEL

Adopting codepoints project-wide would require editing merged patches and re-deriving
`measure-turn-attribution.sh`'s input path — outside this stage's permitted set. Adopting nothing
leaves two incompatible units sharing one label. **Operative rule, binding for this umbrella:**

> Every conversion figure states its unit. A channel whose input is bytes (`wc -c`) reports
> **B/tok**; a channel whose input is transcript/JSON text reports **cp/tok**. A figure without a
> unit suffix is not comparable to one with it, and no ratio may be taken across units.

Recommendation recorded for a later stage, **not applied here:** move the project to codepoints.
The byte unit's extra 0.7 of spread carries no information about token cost — only about whether
the text is Cyrillic — and it is that spread which makes a flat constant look unreachable.

### §1.4 The consuming sites

Re-enumerated at execution time (T21 — run, not recalled):

```console
$ grep -rn "BYTES_PER_TOKEN\|4 B/tok\|4 bytes per token" --include='*.sh' --include='*.md' .
scripts/measure-turn-attribution.sh:61   BYTES_PER_TOKEN=4
scripts/measure-turn-attribution.sh:440,441,446,457,478   (five consumers)
docs/meta-factory/research-patches/2026-08-07-s-h-turn-attribution-p3d-p11.md:482
docs/meta-factory/research-patches/2026-08-07-s-h-turn-attribution-p3d-p11.md:536
```

The enumeration matches the kickoff's authoring-time table exactly — constant at `:61`, five
consumers at `:440`, `:441`, `:446`, `:457`, `:478`. No site was added or moved.

| site | treatment | why |
|---|---|---|
| `scripts/measure-turn-attribution.sh:61` + 5 consumers | **explicit band + direction of error** (§1.5) — NOT a constant swap | its inputs are `wc -c` byte counts of hook stdout; no per-content channel exists inside the script, so §1.1's escape hatch applies in its band form |
| `…-p3d-p11.md:482` (tolerance claim) | **conclusion survives, justification corrected here** | a ~2% spread is inside 1.835-3.416 either way; the sentence cites a falsified constant as its warrant |
| `…-p3d-p11.md:536` (prices its own always-on cost) | **figure moves; superseded here by band** | `wc -c ÷ 4 B/tok × 23.7` → dividing by 4 when the true divisor is 1.835-3.416 makes the result **UNDERSTATED by 1.17-2.18×**. (The site is hypothetical either way: it prices what the file *would* cost if resident, and states it carries no `paths:` frontmatter and is in no resident set.) |

Both `-p3d-p11` sites are in a merged, append-only patch: corrected **by annotation here**, not by
edit. `…-s-h-harness-remainder-p14.md:486` surfaced in the grep and is **SWEPT-CLEAN** — it
*mentions* the falsification, it does not consume the constant.

### §1.5 Corpus drift on this run — T-SH-B fires

The acceptance run re-executes `measure-turn-attribution.sh` on the live corpus, which has moved
since S-H measured it. [T-SH-B](../../../.claude/orchestrator-prompts/arch-v2-context-pipeline-s-h/kickoff.md)
suspends «change nothing» above 1% drift and requires this be surfaced, not absorbed:

```text
S-H  (…-s-h-turn-attribution-p3d-p11.md:26-29)   SESSION-TRANSCRIPTS: 189   SUBAGENT: 722
S-L  (this run, MEASURED-AT 2026-08-07T11:29:44Z) SESSION-TRANSCRIPTS: 210   SUBAGENT: 747
```

Both produced by the same find, unchanged by this stage:

```bash
find "$CORPUS_ROOT" -path "$PROJECT_MATCH" -name '*.jsonl' -not -path '*/subagents/*'   # sessions
find "$CORPUS_ROOT" -path "$PROJECT_MATCH" -name '*.jsonl' -path '*/subagents/*'        # subagents
```

**Drift: +11.1% sessions, +3.5% subagents, in under one day.** Direction is *upward* and the
magnitude is consistent with ordinary accretion (this umbrella alone opened several seats today,
including the one measuring this), which is the opposite class from the −27% retention event
T-SH-B was written against. **Nothing is reconciled and no figure in this patch is adjusted for
it:** every §1.1/§2 measurement is a *within-seat* comparison on named transcripts, so it is
unaffected by how many other transcripts exist. The corpus count matters only for the script's
aggregate tables, which are re-derived on each run by construction.

> **DECISION-NEEDED #7 (T-SH-B, mechanical).** Accept +11.1% as accretion and leave S-H's
> published aggregates as-is (**recommended** — they are labelled with their own MEASURED-AT, and
> re-running them is a re-measurement, not a correction); or re-run S-H's aggregate tables on the
> current corpus and publish a superseding set. Not picked here.

### §1.6 What the script now says

`BYTES_PER_TOKEN=4` is replaced by `BYTES_PER_TOKEN_LO=1.835` / `BYTES_PER_TOKEN_HI=3.416`, and
all five consumers emit a **band** instead of a point. No single number substitutes for the
constant — that is T-SL-A, and a diff whose only change was `4` → `2.62` would fail this stage's
own acceptance. Verified: `grep -n 'BYTES_PER_TOKEN\b'` returns nothing (no unsuffixed survivor),
`bash -n` and `shellcheck -S warning` are clean, and the script runs to exit 0 on the live corpus.

Live output, this run:

```text
inject-session-bootstrap.sh (UserPromptSubmit): 1760 B  (~515-959 est-tokens @ 1.835-3.416 B/t)
inject-subagent-digest.sh   (SubagentStart):    1866 B  (~546-1016 est-tokens @ 1.835-3.416 B/t)
NOTE: … Both hook payloads are ASCII-dominant, so the TRUE value sits near the LOW end of the
      band … Direction of error: a point estimate at 4 B/t UNDERSTATES.
```

Three properties the band form buys, none of which a swapped constant would have:

- **The direction of error is stated at the point of use**, not in a patch a reader may not have.
- **Ratios stay honest.** The residency `amplif.` column is a ratio of two figures sharing the
  conversion, so it is band-invariant — that is annotated in the code rather than left for a
  reader to re-derive.
- **The unit is named** (`B/t`, bytes) with a pointer to the codepoint band for transcript
  channels, so §1.3's rule is enforced where the figure is produced.

### §1.7 The unit defect was in this stage's own first edit — and fixing it closes a merged patch's open discrepancy

**Self-found, via the cold sweep this stage dispatched** ([`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md)):
the band conversion above was first applied to a field that is **not** in bytes. The stream
builder produced it with jq `length`, which counts **codepoints**:

```diff
- len:(((.attachment.stdout // "") | length))
+ len:(((.attachment.stdout // "") | utf8bytelength))
```

That field is printed as `stdout-bytes` / `injected-bytes` / `mean-B` and converted through the
**byte** band — i.e. the first version of this stage's own fix violated the unit rule this stage
wrote, twelve lines below where it wrote it. Reported rather than silently corrected: the sweep
found it because it was cold, and a self-review would have re-read past it.

**What the fix revealed — a merged patch's stated cause is falsified.**
[`…-p3d-p11.md:480-482`](2026-08-07-s-h-turn-attribution-p3d-p11.md) records a discrepancy
between two channels and explains it:

> «live hook probe 1,760/1,866 B vs corpus-recorded 1,721/1,828 B — a ~2% spread from the
> trailing newline and the language-line variant, well inside the 4 B/token estimation error».

Both halves of that explanation are wrong. The spread was **neither a newline nor a variant**: it
was `length` (codepoints) being compared against `wc -c` (bytes) across a payload containing
Cyrillic. Correcting the unit closes it:

| channel | before (codepoints) | after (`utf8bytelength`) | live `wc -c` probe |
|---|---:|---:|---:|
| `inject-session-bootstrap.sh` | 1,721 | **1,759** | **1,760** |
| `inject-subagent-digest.sh` | 1,828 | **1,866** | **1,866** |

The subagent channel now agrees **exactly**; the session channel to **1 byte** (the trailing
newline — which turns out to be the *residual*, not the cause). The «well inside the 4 B/token
estimation error» clause is doubly void: it appeals to a falsified constant to excuse a
discrepancy that was not an estimation error at all.

**Superseded by name:** `…-p3d-p11.md:480-482`'s causal explanation. Merged and append-only —
corrected here, not edited. Its *conclusion* (both FORK-E arms measured) survives; only the
account of the 2% spread is replaced, and replaced with a closed discrepancy rather than a
better excuse for an open one.

## §2 The decomposition (§1.3 of the kickoff) — run, not designed

### §2.1 Census, re-derived in a consistent unit

The 5-C census measured `.attachment | tostring | length` — the JSON *serialisation*, which
includes the object wrapper and counts each `\n` escape as two characters. Re-derived on
`.content` / `.addedLines` / `.stdout`, i.e. the payload itself, on baseline seat `384ada17`:

| census row | content codepoints |
|---|---:|
| `hook_success` (SessionStart, `.stdout`) | 3,472 |
| `hook_additional_context` | 3,381 |
| `deferred_tools_delta` (`.addedLines`) | 4,075 |
| `agent_listing_delta` (`.addedLines`) | 5,433 |
| `mcp_instructions_delta` (`.addedBlocks`) | 3,741 |
| `skill_listing` (`.content`) | 26,696 |
| `hook_success` (UserPromptSubmit, `.content`) | 1,721 |
| user prompt | 35 |
| **total** | **48,554** |

The 5-C table's 58,437 is the same corpus in serialisation units; both are correct, and neither is
comparable to the other. This is §1.3's rule applied to this patch's own numbers.

### §2.2 The load-bearing unknown, CLOSED

> *«is `/context`'s `Skills 8.9k` the `skill_listing` attachment, or a different accounting of the
> same content?»* — 5-C §F4, carried into the kickoff §1.3.

**It is the same content.** Two independent identities:

```console
$ # /context's own Skills table, summed
entries=69  sum=8870 tokens          # reported category: 8.9k
$ # the attachment
grep -c '^- ' skill_listing.content  # 69
```

- **69 entries in both channels**, exactly.
- Per-entry sum **8,870** against a reported **8.9k** — agreement to the display precision.
- 26,696 cp / 8,870 tok = **3.010 cp/tok**, in band.

**`Custom agents 1k` resolves the same way, and more sharply.** `/context`'s Custom Agents table
lists exactly one row (orchestrator-planner). The `agent_listing_delta` attachment carries seven
(`claude`, `claude-code-guide`, `Explore`, `general-purpose`, `orchestrator-planner`, `Plan`,
`statusline-setup`). The orchestrator-planner entry alone is **3,128 cp** → 3.128 cp/tok against
1k, in band; the whole 5,433-cp attachment would be 5.43 cp/tok, far outside it. So `Custom agents
1k` counts **the user-defined agent only**, and the six built-in descriptions — **2,305 cp** — are
billed and counted nowhere.

### §2.3 `Messages 1.3k` — bounded, not resolved (T14)

At the moment `/context` ran, the stream carried 7,232 content-codepoints. The reconciliation the
5-C patch left open narrows but does not close:

| candidate | cp | cp/tok at 1.3k displayed (1,250-1,349 true) | verdict |
|---|---:|---|---|
| everything preceding | 7,232 | 5.36 – 5.79 | **EXCLUDED** |
| both hook injects | 6,853 | 5.08 – 5.48 | **EXCLUDED** |
| SessionStart + cmd block | 3,851 | 2.85 – 3.08 | in band |
| `hook_additional_context` + cmd block | 3,760 | 2.79 – 3.01 | in band |
| SessionStart alone | 3,472 | 2.57 – 2.78 | in band |
| `hook_additional_context` alone | 3,381 | 2.51 – 2.70 | in band |

**Verdict: `Messages` counts exactly ONE hook inject (± the 379-cp command block), never both.**
Which one is **UNMEASURED — channel absent**: the byte channel cannot discriminate four in-band
candidates, and no second channel reaches inside `/context`'s own categorisation.

This is enough to settle the direction question, and that is the point: **whichever candidate is
correct, at least one full hook inject (~3,400 cp) is billed and uncounted.**

### §2.4 `cache_creation` — UNMEASURED, channel absent

The baseline's 53,127 cache-creation tokens exceed what a 48,554-cp message-stream census can
account for at any in-band conversion (48,554 / 1.835 = 26,459 tok maximum). It therefore
demonstrably spans the system-prompt region — memory files, `CLAUDE.md`, rules, tool schemas.
Which token belongs to which region is **UNMEASURED — channel absent** from the transcript. No
estimate is offered. Coverage: 2 of 3 named rows closed (§2.2), 1 bounded (§2.3), this one open.

## §3 Fork #5 — the re-labelling, designed from scratch

### §3.1 The direction call: `/context` under-reports, and §8.5 inverts

Accounting the census against `/context`'s categories:

| status | rows | codepoints |
|---|---|---:|
| **counted** | `skill_listing` → `Skills`; orchestrator-planner → `Custom agents`; one hook → `Messages` | ~33,205 – 33,296 |
| **billed, counted nowhere** | the other hook inject; `deferred_tools_delta` 4,075; built-in agent descriptions 2,305; `mcp_instructions_delta` 3,741; UserPromptSubmit hook 1,721; prompt 35 | **15,258 – 15,349** |

Every uncounted row is **harness-injected and arrives in every seat regardless of what the
operator typed**. None of it is user- or dispatch-authored content.

At the codepoint band that is **4,878 – 8,365 tokens**, i.e. **30 – 52% of the measured
16,196-token gap**. The remainder sits in the system-prompt region (§2.4) and stays unmeasured.

**Consequence for the merged addendum §8.5.** Its title — «the gap indicts the by-difference
method» — and its conclusion that by-difference «systematically overstates the harness remainder»
rest on the premise that the residual is «message content that is not resident load at all». For
the majority of what can be attributed, **that premise is false**: it is recurring per-seat
harness load that `/context` omits. The mechanism §8.5 describes (everything unattributable lands
in row 5 by construction) remains structurally true — what changes is the *character* of what
lands there. On this evidence the indictment **inverts**: by-difference is not overstating harness
cost; `/context` is understating it.

**Falsifier for this reading:** produce a channel showing that `/context`'s reported total already
includes the uncounted rows under some category not named in its own output — e.g. that `System
prompt 5.7k` silently absorbs the hook injects. That would return the gap to §8.5's account.
Everything measurable here says otherwise: the categories sum to the reported total exactly
(§8.2's identity, now n=4), leaving no unlabelled slack to hide 15k codepoints in.

**The subagent-seat 68.4% is NOT re-adjudicated,** and this stage produces no new channel for it.
`/context` cannot be run inside a subagent — Option B's original argument, untouched by anything
measured here. Stated explicitly, as the kickoff requires either way.

### §3.2 DECISION-NEEDED #5 — which channel keeps the term

> **DECISION-NEEDED #5 — the naming rule.** The two channels measure different populations
> separated by a measured, **non-constant** residual (16,196 tok on one day, ~17.3k on another).
> A single unqualified term across both is what let §8.5 draw its conclusion backwards.
>
> **Option A (recommended) — retire the bare term.** No unqualified «harness remainder» anywhere.
> Two explicit names: **«billed first-turn seat cost»** (by-difference) and **«`/context`-declared
> resident head»**. Every figure names its channel and its unit (§1.3). *Consequence:* every site
> in the P14 price list is re-labelled by annotation; no published number changes value.
> **Option B — pin to by-difference.** The term stays the by-difference figure; the `/context`
> split becomes «declared resident head». *Consequence:* cheapest; published values and names both
> stand; §8.5's indictment is withdrawn on §3.1's evidence. *Cost:* keeps a term whose name
> implies a completeness the channel does not have.
> **Option C — pin to `/context`.** The term becomes the `/context` resident categories (28.8k);
> by-difference becomes «first-turn injected payload». *Consequence:* every published
> harness-remainder figure is renamed **and** re-based onto the channel §3.1 just measured to be
> incomplete.
>
> **Not picked here** — §3a. The direction call in §3.1 is evidence-backed and stands under all
> three options; only the *naming* is open.

## §4 Fork #6 — ADR-3's band

### §4.1 The numerator moved

ADR-3's 29-39% was stated against the pre-S-G repo-owned always-on set. S-G replaced
`ai-laziness-traps.md` with `ai-laziness-digest.md`. Reproduced independently:

```console
$ # post-S-G resident set = rules WITHOUT paths: frontmatter, + CLAUDE.md
48,671 B   47,899 cp
```

**48,671 B matches the addendum's recorded 69,453 → 48,671 cut exactly** — an independent
confirmation, not a quotation.

Converted through the repo-markdown in-class codepoint band (2.340-2.649, §1.1) — a band, never a
point, per T-SL-A:

**Post-S-G repo-owned always-on = 47,899 cp = 18,081 – 20,469 tokens.**

**26,700 is the pre-S-G set** and no ranking of the current set is built on it here.

### §4.2 The four denominators, recomputed

| denominator | source | share of 18,081-20,469 | vs 29-39% |
|---|---|---|---|
| seat first-turn total, **75,496** (n=2, reproduced) | 5-C §F1 | **23.9 – 27.1%** | **below** |
| 60-session median main seat, 100,529 | S-H parent §1 | 18.0 – 20.4% | below |
| `/context` resident head, 59,300 | 5-C §3 | 30.5 – 34.5% | inside (low edge) |
| full-tool subagent seat, 62,340 | S-H parent §2 | 29.0 – 32.8% | inside (low edge) |

**Numerator/denominator provenance, stated before dividing** (§3 acceptance, first bullet): the
numerator is the five repo-owned files with no `paths:` frontmatter on `origin/staging`, in
codepoints. Denominators 1 and 4 are transcript-billed token totals for seats **that load that
same repo set**; the numerator is a subset of each. Denominator 3 is `/context`-declared and, per
§3.1, **omits ≥15,258 cp of load the numerator's own seat pays** — the numerator is a subset of
the *seat*, but not cleanly of this *denominator's* population. Denominator 2 is a 60-session
median spanning seats with different repo sets, so the subset relation is not provable at all.

**75,496 is used, not 89,019.** The addendum's 89,019 seat opened with `/orchestrator`, which
injects 13,523 tokens (5-C §F2). Denominating on it would price the repo share against a total
inflated by one optional dispatch prompt.

### §4.3 DECISION-NEEDED #6 — what ADR-3 says now

> **DECISION-NEEDED #6 — the denominator.** The band is stale **by construction**: S-G cut the
> numerator ~30% after it was written, so every surviving percentage measures a superseded
> population. The two pairings still landing «inside» do so only at the low edge, and only by the
> coincidence of the cut's size.
>
> **Option A (recommended) — restate against a named channel.** ADR-3 stops asserting a bare
> percentage: it states the **absolute** repo-owned size with its channel and unit (47,899 cp =
> 18,081-20,469 tok, `/context` memory-files channel), plus a share against **one** explicitly
> named denominator. *Consequence:* the gate S-E wires asserts a quantity that survives the next
> trim; no percentage silently re-ages.
> **Option B — denominate on the seat first-turn total (75,496).** Share 23.9-27.1%, below the
> band; ADR-3 is measured high and its band is rewritten downward. *Consequence:* keeps one
> percentage, pinned to a denominator that includes first-turn message content.
> **Option C — denominate on the `/context` resident head (59,300).** Share 30.5-34.5% — the only
> pairing preserving the band. *Consequence:* chooses the denominator §3.1 measured to be
> incomplete, i.e. picks the answer that needs no correction.
>
> **Not picked here** — §3a. #6 is reported as coupled to #5 exactly as the addendum states:
> Option A's denominator differs from Option C's by the gap #5 records.

## §5 Spec reach — what this does to the S-D′ ranking

The P14 price list orders harness-side levers. Two of this patch's results move that order:

1. **The uncounted rows are real, recurring, per-seat harness load** (§3.1) — `deferred_tools_delta`
   (4,075 cp), `mcp_instructions_delta` (3,741 cp), the built-in agent descriptions (2,305 cp) and
   both hook injects are levers that a `/context`-ordered list would rank at **zero**, because
   `/context` does not price them at all.
2. **The skill listing is the single largest priced block** — 26,696 cp / 8,870 tok, larger than
   any other message-stream row by 4.9×, and confirmed identical to `/context`'s `Skills`
   category. It is the top harness-side lever under either channel.

Any ordering derived through a flat 4 B/tok is re-scaled **non-uniformly**. Dividing bytes by 4
when the true divisor is content-dependent understates every figure, but by different factors:
dense-table content by **2.18×**, Cyrillic-rich listings by **1.17×**. The direction is the same
everywhere — all published est-token figures are **low** — but the magnitude differs by 1.86×
between content classes, which is what re-orders a ranking. **A re-ranking is not a rescale**, and
S-D′ must re-derive rather than multiply through: a uniform correction factor preserves order by
construction and would hide exactly the effect this stage measured.

## §6 §1.7 self-reflexive note

**Forward-check.** Complies with [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md)
(local `jq`/`wc`/`git` only; zero API-billed calls). Complies with
[`phase-research-coverage.md §1.11`](../../../.claude/rules/phase-research-coverage.md): every
figure carried from a merged patch was re-derived — including S-H §8.1's whole table, which was
available as a quotation and was re-run against the correct commit anyway, and the addendum's
48,671 B cut, which reproduces exactly. Complies with
[`ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md): **T2** (§2 is a run
decomposition, not a described one), **T3** (every number carries its command or its file:line),
**T6** (coverage stated as predicates in §2.4 — 2 rows closed, 1 bounded, 1 open), **T14** (§2.3
and §2.4 report bounded/absent rather than clean), **T20** (the §3.1 direction call quotes its
evidence and states its falsifier), **T21** (§1.4's enumeration was re-run before the section was
written; a cold sweep is recorded in the backward-check). Carries the principle-10 scope
annotation on line 1. Adds no dependency and no `packages/` file — no capability commit.

**T-SL-A compliance, self-checked.** No site receives a substituted constant. The script takes a
band with a stated direction of error (§1.5); the two merged-patch sites are annotated, not
edited; the ADR-3 numerator is a range, not a point. A diff whose only change was `4` → `2.62`
would fail this patch's own §1.4 table.

**T-SL-B compliance, self-checked.** Every share in §4.2 states both provenances before dividing,
and the one denominator whose subset relation is **not** provable (the 60-session median) is
labelled as such rather than quietly used. The near-miss this stage caught in its own work: the
first measurement pass in §1.1 used `origin/staging` files against a seat that had loaded the
**pre-S-G** set — a numerator and denominator from different populations, i.e. exactly T-SL-B,
caught by checking the seat's start timestamp against S-G's merge time before publishing. Reported
rather than silently corrected, per the 5-C patch's own precedent.

**Backward-check — delegated COLD, per T21.** The enumeration was **not** self-produced. This
umbrella has recorded three consecutive self-sweeps overturned by grep, so the sweep was dispatched
to a fresh PR-blind agent per [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md),
handed only the change **class** (three content predicates: fixed-divisor byte→token conversion;
bytes-vs-codepoints unit conflation; stale/non-subset always-on share) and never the diff.

**It earned its dispatch on the first predicate: it found a defect in this stage's own edit**
(§1.7) that a self-review had already read past. Population reached: P1 11/11 surfaces (7
GAP-FOUND), P2 8/8 (4 GAP-FOUND), P3 8/8 (8 GAP-FOUND).

In-scope surfaces, handled in this patch:

- [`…-s-h-p14-context-addendum.md`](2026-08-07-s-h-p14-context-addendum.md) — **GAP-FOUND, routed
  not edited.** §8.1's outlier *reading* superseded (§1.1); §8.5's direction inverted (§3.1);
  §8.6's denominators recomputed on a moved numerator (§4.2).
- [`…-s-h-turn-attribution-p3d-p11.md:482,536`](2026-08-07-s-h-turn-attribution-p3d-p11.md) —
  **GAP-FOUND, annotated here** (§1.4). `:482`'s conclusion survives, its warrant does not;
  `:536`'s figure is overstated by 1.17-2.18×.
- [`…-s-h-harness-remainder-p14.md:486`](2026-08-07-s-h-harness-remainder-p14.md) —
  **SWEPT-CLEAN.** Mentions the falsification; does not consume the constant. (Drafted GAP-FOUND
  from the grep hit alone; reading the line overturned it.)
- [`…-s-l-5c-first-turn-vs-context.md`](2026-08-07-s-l-5c-first-turn-vs-context.md) —
  **GAP-FOUND, superseded here by name:** its §F3 labels a codepoint measurement «B/token»
  (§1.1). Its 1.835 figure survives unchanged — that block is pure ASCII, verified.
- [`scripts/measure-turn-attribution.sh:61`](../../../scripts/measure-turn-attribution.sh) —
  **GAP-FOUND, fixed** (§1.5). Constant → band; five consumers state direction of error.
- [`docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md`](../../superpowers/specs/2026-08-06-pipeline-token-economy-design.md)
  §1.5 + P13 — **GAP-FOUND, annotated** (§5).
- `.claude/orchestrator-prompts/arch-v2-context-pipeline/calibration.md` — **SWEPT-CLEAN for this
  class:** records stage ownership, not token figures. Its ADR-8-owner staleness is S-K's.
- ADR-3 in [`2026-07-31-arch-v2-context-pipeline-design.md:136-159`](../../superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md)
  — **GAP-FOUND, routed** to DECISION-NEEDED #6 (§4.3); not edited, since the band's restatement
  is the operator's call between three options.

**Out-of-scope surfaces the cold sweep found — routed, NOT fixed here.** Every one is outside §2's
permitted set. Per [CLAUDE.md `PR strategy`](../../../CLAUDE.md) these are PR-body observations,
not drive-by edits; they are recorded here so the enumeration is not lost between sessions:

| surface | class | why it matters |
|---|---|---|
| `packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts:125` | P2 | **shipped CI gate, wrong unit.** `readFileSync(…,'utf8').length` compared against `DIGEST_MAX_BYTES = 8192` under a title saying «B». Measured live: `.length` 6,562 vs `Buffer.byteLength` 6,703 — the gate **under-counts by 141 B today** and is looser than it declares. One-line fix; the correct idiom is already in-tree at `scripts/render-rule-index.mjs:200`. |
| `scripts/measure-always-on.test.sh:10` | P3 | **RED right now and wired to nothing.** `(( total > 100000 ))` floors on the pre-trim set; actual is 48,671 → the test exits 1. No invocation exists in `Makefile`/`package.json`/`.github`/`.husky`. |
| `scripts/measure-session-start-tokens.sh:33-34,68,349,391` | P1 | a **second live meter** with two fixed divisors (`4` / `2.2`), a third hard-wired `/4` at `:349`, and the `<40%` threshold emitter at `:391`. |
| `scripts/check-alwayson-budget.sh:13-16` + `packages/core/hooks/pre-push.ts:1251-1252` + `.github/workflows/audit-self.yml:826-830` | P3 | **three synchronised copies** of the stale 29-39% declared-coverage sentence, on blocking channels. Their SSOT is ADR-3, which §4.3 routes. |
| `.claude/skills/pipeline/references/plan-cache.md:21` | P1 | live skill reference; at the band its 6-12 kB is 1,756-6,540 tok, so its own «stays below the 2k threshold» **verdict inverts**. |
| `.claude/orchestrator-prompts/arch-v2-context-pipeline-s-i/kickoff.md:20-21` | P1 | **open, dispatchable stage** whose §0 problem statement is a flat-divisor ratio (`~2k` vs `≈9.1k`, «exceeded ~4.5×») on the skill listing — the exact Cyrillic-rich class the 3.416 bound was measured on. |
| spec `…-token-economy-design.md:189` and `:541-545` | P1+P3 | outside the «§1.5 + P13 only» permit. `:189` sized a shipped gate at «≤ 8,192 B ≈ 2k tokens»; `:541` rests a **two-channel convergence argument** on 3.99 B/tok — at the band the channels do not converge within ~5%. |
| `docs/meta-factory/operational-conventions.md:21` | P1 | live conventions doc, unbanded 4 B/tok. |

**Sweep coverage, stated as a predicate (T14, T6):** dated files under
`docs/meta-factory/research-patches/` (~14 files, ~80 conversion sites) were **excluded by
convention** as archival-corrected-by-annotation, and are *not* verdicted clean. If that
convention does not in fact protect them, the P1 population roughly triples.

No merged patch is edited by this change.
