<!-- scope:arch-v2-context-pipeline-s-l-recalculation -->

# S-L — the recalculation: forks #4, #5, #6

> **Status:** recalculation + decomposition + two routed forks. **Append-only.** This patch edits
> no merged S-H patch. Where a merged figure is superseded or its justification corrected, it is
> superseded *here, by name*, per the [CLAUDE.md](../../../CLAUDE.md) Artifact Ownership Contract.
> **Input:** [`2026-08-07-s-l-5c-first-turn-vs-context.md`](2026-08-07-s-l-5c-first-turn-vs-context.md)
> (the #5-C measurement), read in full and re-verified where this patch builds on it.

## §0 Headline

Four results, in the order they constrain each other:

1. **The conversion had an undefined UNIT, which accounts for the whole upper end of the published
   spread.** S-H measured bytes, the 5-C census codepoints, both labelled «B/token». Re-measured
   at the commit the seat actually loaded, S-H's byte table reproduces exactly — and in codepoints
   its 3.32 outlier collapses to 2.587, *inside* the cluster (§1).
2. **`/context`'s `Skills 8.9k` IS the `skill_listing` attachment** (n=69 both channels) — §1.3's
   load-bearing unknown, closed mechanically. So is `Custom agents 1k`: the orchestrator-planner
   entry and nothing else (§2).
3. **`/context` UNDER-reports** — ≥**15,258 codepoints** of every-seat harness-injected payload
   are billed and appear in no category, so addendum §8.5's «the gap indicts the by-difference
   method» **inverts** (§3).
4. **ADR-3's band cannot be restated as a percentage at all right now.** S-G cut the numerator
   ~30% (69,453 → **48,671 B**, reproduced) and **every** denominator in hand was measured on a
   pre-S-G seat — a current-set share is `UNMEASURED — channel absent`, not merely stale (§4).

## §1 Fork #4 — Option A applied per-seat, and the unit defect underneath it

### §1.1 The unit defect (new — not visible to either prior stage)

Both prior measurements label their result «B/token». They are not the same measurement:

| stage | channel | what was counted | unit |
|---|---|---|---|
| S-H §8.1 | `wc -c` on files | **bytes** | B/token |
| 5-C §F3 | `jq …\|tostring\|length` on transcript entries | **codepoints** (of a JSON serialisation) | mislabelled B/token |

For ASCII the two coincide, which is why the defect survived. For anything else they diverge by
the UTF-8 multi-byte ratio — measured on the skill listing at **1.135 bytes/codepoint**.

**Re-measured at the commit the seat actually loaded.** Seat `45489086` started
`2026-08-07T09:20:22Z` on a worktree still carrying the **pre-S-G** rule set, so the comparison
commit is `f31fd8c094` (S-G's parent, via `git rev-parse 97b10bed50^`), not `origin/staging`;
each file read with `git show "$PRE:<path>" | LC_ALL=en_US.UTF-8 wc -c -m`. Measuring today's
files against the seat's token counts would be T-SL-B — the defect this stage exists to prevent.

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

**Coverage (T6): 6 of S-H's 7 rows re-derived.** `…/memory/MEMORY.md` is dropped — host-side and
untracked, so its state at the seat's start time is unrecoverable; pairing today's bytes with the
seat's tokens would be the population mismatch this section is about. Bands unaffected (that row
was interior to the cluster in both units).

**The codepoint column is the new result.** S-H read the 3.32 outlier as corroborating («multi-byte
UTF-8 inflates bytes per token, which is the expected direction»). The mechanism was identified
correctly; the conclusion drawn from it was the wrong one. Multi-byte inflation is not a property
of how the text tokenises — it is a property of how it is *stored*. Removing it removes the
outlier rather than explaining it:

| unit | six-file spread | ratio |
|---|---|---|
| bytes | 2.371 – 3.317 | **1.40×** |
| codepoints | 2.340 – 2.649 | **1.13×** |

**Superseded by name:** [`…-s-h-p14-context-addendum.md:55-57`](2026-08-07-s-h-p14-context-addendum.md)
— the sentence «the outlier (3.32) is the operator-global `CLAUDE.md` … corroborates rather than
undermines the reading». The *figure* stands (3.317 B/tok, reproduced). Its *reading* does not:
in the unit that removes storage encoding, that file is not an outlier at all.

### §1.2 The band, restated per unit, with two new content classes

Two content classes neither prior stage measured, both from the same seat (skill listing via
`jq -j 'select(.attachment.type=="skill_listing")|.attachment.content' <seat>.jsonl | wc -c -m`,
compared against `/context`'s per-entry token sum):

| content class | bytes | codepoints | tokens | B/tok | cp/tok |
|---|---:|---:|---:|---:|---:|
| dense ASCII pipe-table (`/context` stdout **+ its 379-cp command block**) | 13,829 | 13,829 | 7,535 | **1.835** | **1.835** |
| skill listing (Cyrillic-rich prose entries) | 30,299 | 26,696 | 8,870 | **3.416** | **3.010** |
| custom-agent entry (ASCII prose + examples) | 3,134 | 3,128 | ~1,000 | 3.134 | **3.128** |

> **Row 1 numerator/denominator (T-SL-B, cold-audit finding — full record in §6).** The 7,535
> tokens are the *billed delta*, covering the stdout (13,450) **and** the 379-cp command block
> that produced it. An earlier draft paired that count with the stdout alone: 13,829 / 7,535 =
> **1.835** is the same-population figure. (5-C prints **13,827** for the same delta — it also
> nets the seats' 4-char prompt difference and 2-char hook differences; both round to 1.835.)

**Operative bands — wider than S-H's published 2.37-3.32 in both units: bytes 1.835 – 3.416**
(1.86×), **codepoints 1.835 – 3.128** (1.70×).

The 5-C patch's 1.835 survives the unit audit unchanged — the block is pure ASCII (`wc -c` and
`wc -m` both return 13,450 on the stdout; the command block is ASCII too), so the two units
coincide. It is the one 5-C conversion figure the unit correction leaves untouched.

### §1.3 Decision taken (not routed): the unit binds to the CHANNEL

Adopting codepoints project-wide would mean editing merged patches and re-deriving the script's
input path — outside this stage's permitted set; adopting nothing leaves two incompatible units
sharing one label. **Operative rule, binding for this umbrella:**

> Every conversion figure states its unit. A channel whose input is bytes (`wc -c`) reports
> **B/tok**; a channel whose input is transcript/JSON text reports **cp/tok**. A figure without a
> unit suffix is not comparable to one with it, and no ratio may be taken across units.

Recommendation for a later stage, **not applied here:** move the project to codepoints — the byte
unit's extra spread says nothing about token cost, only whether the text is Cyrillic.

### §1.4 The consuming sites

Re-enumerated at execution time (T21 — run, not recalled):

Command run (its raw output is ~20 lines including this patch and the kickoff quoting the
constant; the code-bearing hits are listed below as a **digest**, not as literal stdout):

```bash
grep -rn "BYTES_PER_TOKEN\|4 B/tok\|4 bytes per token" --include='*.sh' --include='*.md' .
```

```text
scripts/measure-turn-attribution.sh:61                    BYTES_PER_TOKEN=4
scripts/measure-turn-attribution.sh:440 441 446 457 478   (five consumers)
docs/…/2026-08-07-s-h-turn-attribution-p3d-p11.md:482     (tolerance claim)
docs/…/2026-08-07-s-h-turn-attribution-p3d-p11.md:536     (self-application cost)
```

The enumeration matches the kickoff's authoring-time table exactly — constant at `:61`, five
consumers at `:440`, `:441`, `:446`, `:457`, `:478`. No site was added or moved.

| site | treatment | why |
|---|---|---|
| `scripts/measure-turn-attribution.sh:61` + 5 consumers | **explicit band + direction of error** (§1.6) — NOT a constant swap | its inputs are `wc -c` byte counts of hook stdout; no per-content channel exists inside the script, so §1.1's escape hatch applies in its band form |
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

Both from the same find, unchanged by this stage (`scripts/measure-turn-attribution.sh:85,87`):
`find "$CORPUS_ROOT" -path "$PROJECT_MATCH" -name '*.jsonl'` with `-not -path '*/subagents/*'`
for sessions and `-path '*/subagents/*'` for subagents.

**Drift: +11.1% sessions, +3.5% subagents, in under one day** — *upward*, consistent with ordinary
accretion (this umbrella opened several seats today, including the one being measured), the
opposite class from the −27% retention event T-SH-B was written against. **Nothing is reconciled
and no figure here is adjusted for it:** every §1.1/§2 measurement is a *within-seat* comparison
on named transcripts, so the corpus size does not enter it.

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

Live output, this run — e.g. `inject-session-bootstrap.sh (UserPromptSubmit): 1760 B
(~515-959 est-tokens @ 1.835-3.416 B/t)`, followed by a printed NOTE that both hook payloads are
ASCII-dominant (so the true value sits near the band's LOW end) and that a point estimate at
4 B/t UNDERSTATES. The band form buys three things a swapped constant would not: direction of
error stated at the point of use; the residency `amplif.` column annotated band-invariant (a ratio
of two figures sharing the conversion); and the unit named at the site.

### §1.7 The unit defect was in this stage's own first edit — and fixing it closes a merged patch's open discrepancy

**Found by the cold sweep this stage dispatched** ([`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md)):
the band was first applied to a field that is **not** in bytes — the stream builder produced it
with jq `length`, which counts **codepoints**:

```diff
- len:(((.attachment.stdout // "") | length))
+ len:(((.attachment.stdout // "") | utf8bytelength))
```

That field prints as `stdout-bytes` / `injected-bytes` / `mean-B` and feeds the **byte** band —
the first version of this stage's own fix violated the unit rule this stage wrote, twelve lines
below where it wrote it. The sweep found it because it was cold; a self-review had already read
past it.

**What the fix revealed — a merged patch's stated cause is falsified.**
[`…-p3d-p11.md:480-482`](2026-08-07-s-h-turn-attribution-p3d-p11.md) attributes a two-channel
discrepancy to «a ~2% spread from the trailing newline and the language-line variant, well inside
the 4 B/token estimation error». It was **neither a newline nor a variant**: it was `length`
(codepoints) compared against `wc -c` (bytes) across a payload containing Cyrillic. The unit fix
closes it:

| channel | before (codepoints) | after (`utf8bytelength`) | live `wc -c` probe |
|---|---:|---:|---:|
| `inject-session-bootstrap.sh` | 1,721 | **1,759** | **1,760** |
| `inject-subagent-digest.sh` | 1,828 | **1,866** | **1,866** |

The subagent channel now agrees **exactly**; the session channel to **1 byte** — the trailing
newline turns out to be the *residual*, not the cause. The «well inside the 4 B/token estimation
error» clause is doubly void: it appeals to a falsified constant to excuse a discrepancy that was
not an estimation error at all.

**Superseded by name:** `…-p3d-p11.md:480-482`'s causal explanation — merged and append-only, so
corrected here, not edited. Its *conclusion* (both FORK-E arms measured) survives; only the
account of the spread is replaced, and with a closed discrepancy rather than a better excuse.

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

Two commands, output quoted as a **digest** (the raw forms are an awk sum over the `/context`
Skills table and a `grep -c` over the extracted attachment):

```text
/context Skills table, summed :  entries=69   sum=8870 tokens    (reported category: 8.9k)
skill_listing attachment      :  entries=69
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

At the moment `/context` ran, the stream carried 7,232 content-codepoints. (The seat's own 31-cp user prompt is **not** among them: the transcript order puts it *after* the `/context` stdout, so it could not have been counted by the reading.) The reconciliation the
5-C patch left open narrows but does not close:

| candidate | cp | cp/tok at 1.3k displayed (1,250-1,349 true) | verdict |
|---|---:|---|---|
| everything preceding the reading | 7,232 | 5.36 – 5.79 | **EXCLUDED** |
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

**Falsifier for this reading:** a channel showing `/context`'s total already absorbs the uncounted
rows under some category not named in its output (e.g. `System prompt 5.7k` silently including the
hook injects). Everything measurable says otherwise — the categories sum to the reported total
exactly (§8.2's identity, now n=4), leaving no unlabelled slack to hide 15k codepoints in.

**The subagent-seat 68.4% is NOT re-adjudicated,** and this stage produces no new channel for it.
`/context` cannot be run inside a subagent — Option B's original argument, untouched by anything
measured here. Stated explicitly, as the kickoff requires either way.

### §3.2 The naming RULE — delivered; only the term assignment is routed

The kickoff asks for «a naming rule, not a winner». The rule is delivered and binds regardless of
how the term question below resolves:

> **Naming rule (operative).** No figure describing session-start cost may be stated without
> **(a)** its channel — `by-difference` (transcript-billed) or `/context` (harness-declared) —
> **(b)** its unit (`tok`, `B`, `cp`), and **(c)** for any share, the **rule-set commit** the
> denominator's seat loaded. The term «harness remainder», used bare, satisfies none of these and
> is therefore not a usable label in either channel: the two channels differ by a measured,
> **non-constant** residual (16,196 tok on one day, ~17.3k on another), so the term does not
> denote a single quantity.

**What would falsify this rule** (§3 acceptance bullet, attached to the rule itself): a
demonstration that the residual is **seat-constant** — that the two channels differ by a fixed
offset across seat classes and dates. A constant offset would make one term plus a documented
conversion sufficient, and the qualification mere overhead. At n=2 (16,196 and ~17.3k, different
days, `staging` and the memory index moved between) the data are consistent with «approximately
constant», so this falsifier is live and cheap — worth running before the rule is called settled.

### §3.3 DECISION-NEEDED #5 — which channel keeps the term

> **DECISION-NEEDED #5 — the term assignment.** The rule above is delivered; what is open is which
> channel, if either, inherits the word «harness remainder».
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

### §4.1 The numerator moved — and its provenance is a CHANNEL, not a predicate

ADR-3's 29-39% was stated against the pre-S-G repo-owned always-on set. S-G replaced
`ai-laziness-traps.md` with `ai-laziness-digest.md`.

**The numerator is defined by the `/context` memory-files channel, not by a frontmatter
predicate.** This distinction is load-bearing and an earlier draft of this section got it wrong
(cold audit, round 1 — recorded rather than silently corrected, per the 5-C precedent). The two
selections are not the same set:

| selection | files | bytes |
|---|---:|---:|
| **`/context` Memory Files, project-scoped** (what the seat actually loaded) | **5** | **48,671** |
| «`.claude/rules/*.md` without `paths:` frontmatter» + `CLAUDE.md` | 12 | 124,529 |

The predicate over-selects by **2.56×**: seven Class-B/C rules carry no `paths:` key yet reach the
model by hook, skill-embed or agent channel rather than as always-on memory files
(`autonomous-loop-continuity`, `cold-seat-economy`, `egress-no-api-bypass`,
`git-conflict-merge-forward`, `memory-codification`, `recommendation-laziness-discipline`,
`reviewer-discipline`). **«No `paths:`» ≠ «always-on»** — a later stage rebuilding this share from
the predicate gets a silently different ADR-3 verdict.

Operative numerator, on the channel: **48,671 B / 47,899 cp**, which reproduces the addendum's
recorded 69,453 → 48,671 cut exactly — an independent confirmation, not a quotation.

### §4.2 The share cannot be computed on the current set — no denominator exists for it

This is the finding, and it is stronger than the four-way table it replaces.

**Every denominator in hand was measured on a seat carrying the PRE-S-G rule set.** Seat
`45489086` started `2026-08-07T09:20:22Z` on a worktree that had not yet taken S-G (§1.1); its
`/context` lists `ai-laziness-traps.md`, not the digest. The post-S-G numerator contains
`ai-laziness-digest.md`, which **did not exist** at the pre-S-G commit (`git cat-file -e
f31fd8c094:.claude/rules/ai-laziness-digest.md` → absent). The post-S-G numerator is therefore
**not a subset of any measured denominator's population**: dividing them is exactly T-SL-B —
arithmetically computable, semantically void.

**The only internally consistent pairing is the pre-S-G one** — pre-S-G numerator (26,700 tok,
`/context`-measured on the seat) over denominators measured on that same seat class:

| denominator | source | share of **26,700** (pre-S-G) | vs 29-39% |
|---|---|---:|---|
| seat first-turn total, **75,496** (n=2, reproduced) | 5-C §F1 | **35.4%** | **inside** |
| 60-session median main seat, 100,529 | S-H parent §1 | 26.6% | below |
| `/context` **reported total**, 59,300 | 5-C §3 | 45.0% | above |
| full-tool subagent seat, 62,340 | S-H parent §2 | 42.8% | above |

**Post-S-G shares are `UNMEASURED — channel absent`** (T14): producing one needs a `/context`
reading on a seat that actually loaded the post-S-G set, no such reading exists, and this stage
does not manufacture one by converting bytes through a band and calling it a share. For **sizing
only**, the post-S-G set converts through the repo-markdown in-class codepoint band (2.340-2.649,
§1.1) to **18,081 – 20,469 tokens** — a bound on the *numerator alone*; no percentage here uses
it.

**Two labels corrected while here** (both cold-audit findings, both direction-neutral):
**59,300 is `/context`'s reported total**, not the «resident head» — the addendum §8.6 uses
**58,200** for the head, and the earlier draft of this table conflated them. And **75,496 is used,
not 89,019** — the addendum's 89,019 seat opened with `/orchestrator`, which injects 13,523
tokens (5-C §F2), so denominating on it prices the repo share against a total inflated by one
optional dispatch prompt.

### §4.3 The operative form — delivered; only the denominator choice is routed

**Delivered — the kickoff §1.4 second branch, exercised, not a routed option.** ADR-3's band
cannot be restated as a bare percentage on the current set, and that is a measurement result, not
a preference: any post-S-G share needs a denominator measured on a post-S-G seat, and **none
exists** (§4.2). The operative statement ADR-3 must carry:

> The repo-owned always-on set is **48,671 B / 47,899 cp** on the `/context` **memory-files
> channel** (5 project-scoped files), post-S-G. Any share **must** name the denominator's channel,
> unit, **and the rule-set commit the denominator's seat loaded**; a share pairing this numerator
> with a pre-S-G seat total is void.

**Falsifier for this restatement:** a `/context` reading taken on a seat that has loaded the
post-S-G rule set. That single measurement would make a current-set share computable and would
retire this «channel absent» verdict — it is cheap (one interactive seat), and it is the natural
first task of whichever stage next needs the number.

**Three denominators rejected, with the direction each would have moved the band** (§3 acceptance,
last bullet), on the pre-S-G pairing where the arithmetic is at least valid: 60-session median
(100,529 → **26.6%**, *below*; compounds the question with a population change); `/context`'s
reported total (59,300 → **45.0%**, *above*; §3.1 measured that channel incomplete); full-tool
subagent seat (62,340 → **42.8%**, *above*; different seat class). Retained: the reproduced
first-turn baseline (75,496 → **35.4%**, *inside*), the only n=2 total on the numerator's own
seat class.

> **DECISION-NEEDED #6 — which denominator ADR-3 names, once one is measurable.** The restatement
> above is delivered and stands under every option; what is open is the *choice* the restatement
> tells ADR-3 to name.
> **Option A (recommended) — the seat first-turn total.** Reproduced n=2, same seat class as the
> numerator, and the only pairing whose subset relation is provable. *Consequence:* ADR-3's band
> is re-derived once a post-S-G seat is measured; on the pre-S-G pairing it read 35.4%, inside.
> **Option B — the 60-session median.** Matches ADR-3's «observed» wording most literally.
> *Consequence:* below the band, so ADR-3 is measured high — but it spans seats with different
> repo sets, so the subset relation is never provable.
> **Option C — `/context`'s own total.** The only channel that excludes dispatch-prompt content.
> *Consequence:* above the band; and §3.1 measured it incomplete, so it under-states the
> denominator and over-states the share.
>
> **Not picked here** — §3a, and per the dispatch instruction routing #6 to the operator. #6 stays
> coupled to #5 exactly as the addendum states: Option A's denominator differs from Option C's by
> the gap #5 records.

## §5 Spec reach — what this does to the S-D′ ranking

The P14 price list orders harness-side levers. Two of this patch's results move that order:

1. **The uncounted rows are real, recurring, per-seat harness load** (§3.1) — `deferred_tools_delta`
   (4,075 cp), `mcp_instructions_delta` (3,741 cp), the built-in agent descriptions (2,305 cp) and
   both hook injects are levers that a `/context`-ordered list would rank at **zero**, because
   `/context` does not price them at all.
2. **The skill listing is the single largest priced block** — 26,696 cp / 8,870 tok, larger than
   any other message-stream row by 4.9×, and confirmed identical to `/context`'s `Skills`
   category. It is the top harness-side lever under either channel.

Any ordering derived through a flat 4 B/tok is re-scaled **non-uniformly**: dividing by 4 when the
true divisor is content-dependent understates every figure, but by **2.18×** for dense-table
content and **1.17×** for Cyrillic-rich listings. The direction is uniform (all published
est-token figures are **low**); the magnitude differs 1.86× between classes, and that is what
re-orders a ranking. **A re-ranking is not a rescale** — S-D′ must re-derive rather than multiply
through, since a uniform factor preserves order by construction and would hide this effect.

## §6 §1.7 self-reflexive note

**Forward-check.** Complies with [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md)
(local `jq`/`wc`/`git`; zero API-billed calls) and
[`phase-research-coverage.md §1.11`](../../../.claude/rules/phase-research-coverage.md) — every
figure carried from a merged patch was re-derived, including S-H §8.1's whole table (available as
a quotation, re-run against the correct commit anyway) and the addendum's 48,671 B cut, which
reproduces exactly. [`ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md):
**T2** (§2 is a run decomposition), **T3** (every number carries its command or file:line),
**T6** (§2.4 + §1.1 state coverage as k-of-n predicates), **T14** (§2.3, §2.4 and §4.2 report
bounded/absent, not clean), **T20** (§3.1 quotes evidence and states its falsifier), **T21**
(sweep delegated cold — below). Principle-10 scope annotation on line 1. No dependency, no
`packages/` file — not a capability commit.

**T-SL-A compliance, self-checked.** No site receives a substituted constant. The script takes a
band with a stated direction of error (§1.6); the two merged-patch sites are annotated, not
edited; the ADR-3 numerator is a range, not a point. A diff whose only change was `4` → `2.62`
would fail this patch's own §1.4 table.

**T-SL-B — this stage tripped it three times and is not self-certifying compliance.** An earlier
draft of this section did claim compliance; a cold fidelity audit on the head SHA
([`agents/fidelity-auditor.md`](../../../agents/fidelity-auditor.md), round 1, verdict REVISE)
disproved it. Recorded in full, because a trap the author declares clean while violating it is
worth more as an incident than as a checkbox:

| # | where | the defect | caught by |
|---|---|---|---|
| 1 | §1.1 first measurement pass | `origin/staging` files against a seat that had loaded the **pre-S-G** set | self, before publishing (seat start-time vs S-G merge-time) |
| 2 | §1.2 row 1 | 7,535 tokens (stdout **+** command block) paired with 13,450 (stdout **alone**), printed as 1.835 when it computes to 1.785 | **cold audit** |
| 3 | §4.2 whole table | post-S-G numerator (contains `ai-laziness-digest.md`, absent pre-S-G) divided by denominators measured on pre-S-G seats — and the numerator's stated provenance («no `paths:` frontmatter») selects 124,529 B, not the 48,671 B measured | **cold audit** |

**Two of three needed the cold seat.** The one the author caught was caught by a *mechanical*
check (two timestamps compared), not by re-reading — this project's own thesis restated on its own
artefact: attention is not a mechanism. Defect 3 is why §4.2 publishes no current-set share.

**T-SL-A compliance** stands as claimed, confirmed by the same audit: the band is not a constant,
all 6 sites treated, no unsuffixed `BYTES_PER_TOKEN` survives.

**Backward-check — delegated COLD, per T21.** The enumeration was **not** self-produced. This
umbrella has recorded three consecutive self-sweeps overturned by grep, so the sweep was dispatched
to a fresh PR-blind agent per [`agents/backward-sweep-auditor.md`](../../../agents/backward-sweep-auditor.md),
handed only the change **class** (three content predicates: fixed-divisor byte→token conversion;
bytes-vs-codepoints unit conflation; stale/non-subset always-on share) and never the diff.

**It earned its dispatch**: it found a defect in this stage's own edit (§1.7) that a self-review
had read past. Population reached: P1 11/11 (7 GAP-FOUND), P2 8/8 (4 GAP-FOUND), P3 8/8 (8
GAP-FOUND). In-scope surfaces, handled here:

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
  **GAP-FOUND, fixed** (§1.6). Constant → band; five consumers state direction of error.
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
| `packages/core/principles/35-ai-laziness-digest-anti-drift.test.ts:125` | P2 | **shipped CI gate, wrong unit.** `readFileSync(…,'utf8').length` vs `DIGEST_MAX_BYTES = 8192` under a title saying «B». Live: 6,562 vs 6,703 → **under-counts by 141 B today**, i.e. looser than it declares. Correct idiom already in-tree at `scripts/render-rule-index.mjs:200`. |
| `scripts/measure-always-on.test.sh:10` | P3 | **RED now and wired to nothing.** `(( total > 100000 ))` floors on the pre-trim set; actual 48,671 → exits 1. No invocation in `Makefile`/`package.json`/`.github`/`.husky`. |
| `scripts/measure-session-start-tokens.sh:33-34,68,349,391` | P1 | a **second live meter**: two fixed divisors (`4`/`2.2`), a third hard-wired `/4` at `:349`, and the `<40%` threshold emitter at `:391`. |
| `scripts/check-alwayson-budget.sh:13-16` + `packages/core/hooks/pre-push.ts:1251-1252` + `.github/workflows/audit-self.yml:826-830` | P3 | **three synchronised copies** of the stale 29-39% sentence, on blocking channels. SSOT is ADR-3, routed in §4.3. |
| `.claude/skills/pipeline/references/plan-cache.md:21` | P1 | live skill reference; at the band its 6-12 kB is 1,756-6,540 tok, so its own «below the 2k threshold» **verdict inverts**. |
| `.claude/orchestrator-prompts/arch-v2-context-pipeline-s-i/kickoff.md:20-21` | P1 | **open, dispatchable stage** whose §0 is a flat-divisor ratio (`~2k` vs `≈9.1k`) on the skill listing — the exact Cyrillic-rich class the 3.416 bound came from. |
| spec `…-token-economy-design.md:189`, `:541-545` | P1+P3 | outside the «§1.5 + P13 only» permit. `:189` sized a shipped gate at «≈ 2k tokens»; `:541` rests a **two-channel convergence argument** on 3.99 B/tok — at the band the channels do not converge within ~5%. |
| `docs/meta-factory/operational-conventions.md:21` | P1 | live conventions doc, unbanded 4 B/tok. |

**Sweep coverage as a predicate (T14, T6):** dated files under `research-patches/` (~14 files,
~80 conversion sites) were **excluded by convention** as archival-corrected-by-annotation, and are
*not* verdicted clean — if that convention does not protect them, the P1 population roughly
triples.

No merged patch is edited by this change.
