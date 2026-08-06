<!-- scope:arch-v2-context-pipeline-s-h-p3d-p11 -->

# S-H — per-turn attribution (P3d) + Explore/Plan rules-loading probe (P11)

> **Authoritative for:** the per-turn re-write trigger classes, the measured tool-output
> arrival-position distribution, hook-injection firing rates, the FORK-E bootstrap-injector
> cost line, and the P11 Explore/Plan residency verdict — all as measured on the host on
> 2026-08-07.
> **NOT authoritative for:** the harness-remainder price list (P14) — see the sibling patch
> [`2026-08-07-s-h-harness-remainder-p14.md`](2026-08-07-s-h-harness-remainder-p14.md);
> ceilings/gates (S-E); resident-set trims (S-G); subtraction maps (S-D′);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).

**Producer:** `scripts/measure-turn-attribution.sh` (new in this stage — the SSOT for per-turn
cost numbers, promoted read-only from the aggregator snippet at
`.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md` §2.7, which stays a
historical record and is untouched). Reproduce with `bash scripts/measure-turn-attribution.sh`.

**Run quoted here:** `MEASURED-AT: 2026-08-06T21:55:31Z`, base commit `97b10bed50`.

---

## §0 Corpus and denominators

```text
SESSION-TRANSCRIPTS: 183
SUBAGENT-TRANSCRIPTS: 720
TOTAL-TRANSCRIPTS: 903
STREAM-RECORDS: 160844
```

Two populations, reported separately, because the seed's find (`-maxdepth 2`) selected only the
183 session-root files and silently excluded the entire `<session>/subagents/**` population —
under which the per-subagent arm of the FORK-E line (§5) is unmeasurable. The corpus is live
and grows during a run; counts drift by single digits between invocations.

**Denominator tag (binding, per the spec's convention).** Every share below tagged **[H]** =
this 903-transcript host corpus, price-weighted. **[H] is NOT [W]** and the two are not
interconvertible: [W] is the re-priced 169-session corpus (READ 44.7 / WRITE 43.1 / output
11.7). [H] covers 903 transcripts including subagents. Where the kickoff says «sized against
WRITE [W]», the sizing below is against the **[H] WRITE line**, stated as such rather than
silently substituted.

```text
category           weighted-units cost-share
cache READ             1784525659      52.5%
cache WRITE            1197878982      35.2%
output                  391712660      11.5%
uncached input           24957148       0.7%
TOTAL                  3399074449     100.0%
```

Turn distribution and the residency multiplier that prices every resident token:

```text
session   sessions=180 median=228 p90=520 max=833 total-turns=45930
session   residency multiplier: median 23.7x  p90 52.9x  max 84.2x
subagent  sessions=682 median=39  p90=106 max=383 total-turns=35063
subagent  residency multiplier: median 4.8x   p90 11.5x  max 39.2x
```

The subagent seat is a **fundamentally cheaper place to put a resident token** — 4.8× vs 23.7×
median amplification. Any block moved from the main seat into a subagent seat is worth ~5× less
per byte. S-D′ should read this as the price ratio behind its subtraction maps.

---

## §1 DECISION-NEEDED — corpus drift is −25.9%, far above the 1% threshold (T-SH-B)

The kickoff pre-armed this and suspended the «change nothing» instruction above |drift| > 1%.

| | seed (2026-08-01) | this run (2026-08-07) | delta |
|---|---:|---:|---:|
| transcripts under the seed find (`-maxdepth 2`) | 247 | **183** | **−25.9%** |
| project directories | 99 | 64 | −35.4% |
| assistant turns (session-root) | 58,345 | 45,930 | −21.3% |

Command that produced today's figure:
`find ~/.claude/projects -maxdepth 2 -path "*rules-as-tests-aif*" -name "*.jsonl" | wc -l` → `183`.

The seed's stated expectation was «~0.1-0.2% **upward**». The observed move is 130× larger and
in the opposite direction, so this is **not drift** — it is a corpus-population change
(worktree pruning removes a project directory and its transcripts with it; 35 project dirs
disappeared). Recorded, not reconciled; the script was NOT tweaked to chase the seed's numbers.

> **DECISION-NEEDED:** the transcript corpus is being silently pruned, so every longitudinal
> token-economy claim rests on a shrinking, non-reproducible base.
> **Option A** — accept the corpus as best-effort-live: all figures are point-in-time, no
> longitudinal comparison is valid, and the S-A §2 numbers are retired rather than re-derived.
> **Option B** — snapshot the corpus (or its per-turn billing projection) before pruning, so
> S-D′'s before/after measurement and ADR-8's 20-dispatch window have a stable baseline.
> Consequence of doing nothing: ADR-8's experiment protocol measures against a base that
> shifts under it, and a −26% population move is indistinguishable from a real effect.

---

## §2 P3d — per-turn re-write trigger classes, sized against the [H] WRITE line

```text
trigger class                                            turns   turn-%  cache-WRITE-tok  %-of-[W]
COLD-PREFIX / idle 5m-1h (5m-TTL expiry; 1h TTL would have held)        38     0.0%          9372551      1.0%
COLD-PREFIX / idle<5m   (compact / config-change / eviction)      1356     1.7%        145157505     15.2%
COLD-PREFIX / idle>=1h  (1h-TTL expiry or resume)           12     0.0%          3713985      0.4%
INCREMENTAL-WRITE (turn delta only)                      78348    96.9%        745370690     77.8%
PURE-READ (no write)                                       220     0.3%                0      0.0%
SESSION-OPEN (unavoidable first write)                     861     1.1%         54082390      5.6%
TOTAL                                                    80835   100.0%        957697121    100.0%
```

**Classifier (threshold-free).** A turn billing `cache_read_input_tokens == 0` while writing
cache had no cache hit at all — the whole prefix was re-written. That is binary; no arbitrary
«large write» cut-off is involved. Non-first cold turns are then sub-classified by the idle gap
preceding them, against the two documented TTLs (§3).

**The headline for N1.** Avoidable prefix re-writes = the three COLD-PREFIX rows that are not
the unavoidable session open: **1,406 turns (1.7% of turns) carrying 16.6% of the WRITE line
[H]**. N1's retirement falsifier is «N2 measures avoidable re-writes <5% of the WRITE line →
retire the discipline text». **16.6% > 5% → the falsifier does NOT fire; the N1 re-write
discipline text stands.**

**Honesty bound, stated rather than papered over.** «Resume» and «long idle» are the *same
billing event* at this layer — a cold prefix after a gap. The transcript cannot separate an
operator `--resume` from a session that simply idled past its TTL, so the gap rows are reported
as one class and NOT split into a fabricated resume row.

### §2.1 Which TTL the corpus actually buys

```text
5m-TTL writes: 34932 turns, 315922697 tokens (33.0%)
1h-TTL writes: 45678 turns, 641778643 tokens (67.0%)
```

Two thirds of write tokens buy the 1-hour cache. Note the interaction with the table above: only
**38 turns (1.0% of [H] WRITE)** fall in the 5m–1h idle band where a 1h TTL would have saved a
re-write. **Extending TTL is a near-dead lever on this corpus** — the addressable band is 1%.

### §2.2 `/compact` is not the re-write driver here

```text
compact-boundary-total: 1
```

**One** `subtype=compact_boundary` across 183 session transcripts. The «prefer artifact handoff
over `/compact`» discipline (N1b) is therefore *already* being followed — it cannot be the
explanation for the 15.2% sub-5-minute cold-prefix band, and pushing it harder buys nothing
measurable. `SessionStart:compact` fires once, corroborating from an independent record type.

### §2.3 The config-change trigger class — VERIFIED against primary docs

Primary source: `platform.claude.com/docs/en/docs/build-with-claude/prompt-caching`, fetched
2026-08-07. The cache follows the hierarchy `tools` → `system` → `messages`; a change at a level
invalidates that level and all later ones. Verbatim, per setting:

- **effort** — «Changing the `output_config.effort` value always invalidates message blocks»
- **speed** — «Switching between `speed: "fast"` and standard speed invalidates system and
  message caches»
- **tools** — «Modifying tool definitions (names, descriptions, parameters) invalidates the
  entire cache» ← this is the mechanism by which an MCP-server toggle invalidates
- TTLs — «By default, the cache has a 5-minute lifetime», with a «1-hour cache duration» option.

Measured against that list:

```text
CITED    effort switches:     242  (of which the switch turn was cold-prefix: 47)
CITED    speed switches:        0  (of which cold-prefix: 0)
OBSERVED model switches:      206  (of which cold-prefix: 44)  [cause not named in the doc list]
OBSERVED version switches:     12  (of which cold-prefix: 6)  [cause not named in the doc list]
UNMEASURED mcp-toggle: channel absent (changes tool definitions per the doc, but is not recorded per turn)
```

So the config-change class is **priced, not assumed**: at most 97 of the 1,356 sub-5-minute cold
prefixes (~7%) coincide with an observable config switch. **The remaining ~93% of that 15.2%
band is unexplained by any channel this corpus exposes** — most plausibly ordinary cache
eviction under parallel-session pressure. That residual is named, not attributed.

> **Defect caught in this stage's own instrument, recorded per T3.** A first cut counted 19,824
> «speed switches». `message.usage.speed` only ever holds `"standard"` or `null` in this corpus,
> so those were `null`↔`standard` transitions — the harness omitting a field, not the operator
> changing a setting. The classifier now counts a transition only between two *recorded*
> values; the true speed-switch count is **0** (fast mode was never used). Model-switch counts
> fell 406 → 206 for the same reason once `<synthetic>` turns were excluded.

---

## §3 Arrival-position distribution — the seed's W3 assumption is wrong by 1.30×

The seed's W3 could not observe arrival positions and assumed uniform arrival → mean residency
≈ N/2, flagging the direction of error as unknown. Measured:

```text
decile      results            chars    char-%
0              3590         18856736     21.2%
1              4060         16131242     18.1%
2              4007         12251730     13.8%
3              3827         10139163     11.4%
4              3816          6835380      7.7%
5              3907          6317233      7.1%
6              3799          5474449      6.1%
7              3621          5313778      6.0%
8              3703          4741293      5.3%
9              3551          2999745      3.4%
mean residual turns after arrival (unweighted):        130.0
char-weighted mean residual turns, MEASURED:           113.3
char-weighted mean residual turns, UNIFORM assumption: 87.2   (the seed W3 model: N/2)
MEASURED/UNIFORM = 1.30x -> the seed uniform-arrival model UNDERSTATES tool-output residency.
```

Tool-output volume is strongly front-loaded: the first decile of a session carries **21.2%** of
all returned characters, the last decile **3.4%** — a 6.2× gradient, while the *count* of
results is near-flat across deciles (3,551–4,060). Big payloads land early; small ones land
late. Because early arrival means longer residency, **the seed understated tool-output cost by
30%**, and the direction of that error was previously unknown.

**Consequence for S-D′ and N2:** the inlined-dispatch lever (N2) attacks exactly this
front-loaded head. Its stake was sized at ~52%/cold seat on the seed's uniform model; the same
lever is worth ~1.3× more than that sizing implied.

---

## §4 Hook-injection firing rates

**Channel (better than the marker grep the kickoff anticipated).** CC writes one `attachment`
record per hook **invocation**, carrying the hook's command, its event, and the text it emitted.
Firing counts and injected volume are read straight off that record. A text-marker grep would
have **quadruple-counted**: the same single injection is recorded in both `attachment.content`
and `attachment.stdout`, each carrying an open *and* a close marker. Verified on one file — 10
hook records, 40 marker hits, 20 open + 20 close, and the two fields hold 1,721 / 1,722 chars of
the same digest.

```text
population hook script                         firings   stdout-bytes     mean-B per-transcript
session    inject-session-bootstrap.sh            1888        3250362       1721        10.32
subagent   inject-subagent-digest.sh               724        1323472       1828         1.01
session    run-hook.cmd                            184         849741       4618         1.01
session    inject-matching-rule.sh                 173         164946        953         0.95
session    unknown                                 191          17572         92         1.04
session    inject-memory-codification.sh            28          14196        507         0.15
session    check-doc-authority.sh                  595           5741          9         3.25
session    validate-prompt.sh                      134           5410         40         0.73
session    check-hook-marker.sh                      1              0          0         0.01
```

(`unknown` = a hook whose `command` field is the label `auto-sync local ← remote`, not a script
path — the host-side `post-api-push-autosync` hook; named here rather than silently dropped.
`run-hook.cmd` is a **plugin** SessionStart hook, `"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd"
session-start`, and is priced in the P14 sibling patch.)

**Edit-time rule injection (`inject-matching-rule.sh`):**

```text
session   firings=173 transcripts-with-a-firing=104 of 183 (56.8% of transcripts; 0.95 firings/transcript; 164946 B injected)
```

One firing emits one line **per matched rule**, so rule-line occurrences (902) exceed firings
(173) ~5×. Which rules actually reach a seat this way:

```text
 167 source-before-shape          62 language-discipline           30 rule-enforcement-channel-selection
 150 parallel-subwave-isolation   62 ci-tool-pinning               30 companion-install-principle
 150 kickoff-staging-placement    58 dual-implementation-discipline 22 zcode-parity-doctrine
 138 doc-authority-hierarchy      34 skill-description-quality
 107 destination-environment-verification
```

**This is the empirical case for the `paths:` channel.** The edit-time channel delivers ~165 KB
across 104 transcripts at **0.95 firings/transcript** — i.e. a rule moved from always-on to
`paths:` is delivered when it is relevant and costs nothing in the ~43% of sessions where it
never fires. It is the measured counterpart of the S-G digest swap.

---

## §5 FORK E — the bootstrap-injector cost line (MANDATORY deliverable)

Two distinct hooks, two seat classes. Per-invocation size measured **live this run**, not
carried from a prior doc; firing counts measured from the corpus:

```text
per-invocation size, MEASURED LIVE this run:
  inject-session-bootstrap.sh (UserPromptSubmit): 1760 B  (~440 est-tokens @ 4 B/t)
  inject-subagent-digest.sh   (SubagentStart):    1866 B  (~466 est-tokens @ 4 B/t)
  session-cache guard present in either hook: no (no cache => every firing is a fresh injection)

observed firings + injected volume, MEASURED from hook-execution records:
population hook                              firings   stdout-bytes    mean-B     est-tokens per-transcript
  session    inject-session-bootstrap.sh          1888        3250362      1721         812590        10.32
  subagent   inject-subagent-digest.sh             724        1323472      1828         330868         1.01

residency-weighted cost (an injection at prompt p is re-billed on every LATER turn at the cache-read rate):
population   one-shot-tok residency-weighted  mean-residual    amplif.
  session            812590           14465334          168.0      17.8x
  subagent           330868            2043384           51.8       6.2x

per-seat-class (dominant model of the transcript the injection fired in):
model (seat class)            firings   injected-bytes     est-tokens
  claude-opus-4-8                  1165          2042668         510667
  claude-fable-5                    821          1426906         356726
  claude-opus-5                     447           781712         195428
  claude-sonnet-5                   157           282756          70689
  claude-haiku-4-5-20251001          14            25592           6398
```

**The per-prompt arm (`UserPromptSubmit`).** 1,888 firings / 180 sessions = **10.3 per session**,
mean 1,721 B → **~18 KB per session**, and the hook carries no session cache, so every firing is
a fresh injection.

**Correction to the spec's FORK-E sizing, with its cause.** §1.6 FORK E estimated «on a 30-turn
expensive seat it injects ~53 KB», i.e. one injection *per turn*. The hook is registered on
`UserPromptSubmit` and fires per **prompt**, not per assistant turn: 1,888 firings against 45,930
session turns = **one injection per ~24 turns**. The FORK-E falsifier («wrong if the injector is
cached per session») does *not* fire — there is no cache — but the magnitude was overstated
~3× per session against the real 10.3 prompts/session. Recorded loudly rather than quietly,
because S-D′ orders its maps by these numbers.

**Is it still the larger lever?** Yes, and now with a number. Residency-weighted, the injector
costs **80,363 weighted units per session** (14,465,334 / 180). P5a's `CLAUDE.md`
pointer-collapse removes ~1,100 B resident from turn 1 ≈ 275 est-tokens × 23.7 ≈ **6,518 units
per session**. The injector is **~12× the P5a lever**, confirming the spec's qualitative
ranking while replacing its arithmetic.

**Whole-bill share, so the lever is not oversold.** 14,465,334 + 2,043,384 = 16,508,718 weighted
units against a [H] total of 3,399,074,449 = **0.49% of total weighted spend**. Real, cheap to
fix, and *not* a top-three lever by share. The candidate remedy §1.6 FORK E records — a
once-per-session cache, as the sibling `inject-matching-rule.sh` already implements — would
convert ~10.3 firings/session into 1, recovering ~90% of that 0.49%. S-D′ adjudicates it against
the counter-argument (per-prompt re-injection is the digest's compaction-resilience purpose);
this patch prices it and stops there.

**The subagent arm reaches every subagent regardless of S-D′'s replacement prompts** — 724
firings at 1.01 per subagent transcript, i.e. exactly once per spawn, confirming the T-SDP-A
concern in FORK E: a subtraction map that replaces an agent's system prompt but ignores
`SubagentStart` leaves 1,828 B of the seat's head untouched.

---

## §6 P11 — do `Explore` / `Plan` subagents load `.claude/rules/`?

**Verdict: NO — and neither `CLAUDE.md`, the rule index, nor the memory index. Only the
`SubagentStart` bootstrap digest reaches them.** Two independent channels agree, and a control
arm proves the probe discriminates.

**Method.** One measured host session per agent type, dispatched from a live host CC session on
base `d7a0fe6f7f`. Each was given an identical context-inventory probe forbidding all tool use
and requiring **verbatim quotes** for every YES, with «if unsure, answer NO». A
`general-purpose` subagent ran the identical probe as a **control arm** — without it, an all-NO
result would be indistinguishable from a blind probe (T14).

| arm | tool uses | resident head (first-turn billing) | rules | CLAUDE.md | rule index | bootstrap digest |
|---|---:|---:|---|---|---|---|
| `Explore` | 0 | **26,659 tok** | NO | NO | NO | YES |
| `Plan` | 0 | **26,783 tok** | NO | NO | NO | YES |
| `general-purpose` (control) | 0 | **62,340 tok** | **YES** | **YES** | **YES** | YES |

**The control's YES answers are verified, not taken on trust.** It quoted
`#hope-as-gate` / `#warning-nobody-reads` — matching
`.claude/rules/attention-is-not-a-mechanism.md:28-29` verbatim — and «T16 —
Pattern-matching-on-name (adopted-tool-wrong-problem)», matching
`.claude/rules/ai-laziness-traps.md:122` verbatim, plus the three capability-commit bullets from
`CLAUDE.md`. A probe that can produce correct verbatim quotes when content *is* resident and
returns NONE otherwise is discriminating; the Explore/Plan NOs are therefore real absences, not
probe blindness.

**Second channel, independent of self-report:** first-turn billing. 62,340 vs 26,659 tokens =
**35,681 tokens of context that Explore does not carry**. The self-report and the billing agree
on both direction and rough magnitude.

**Consequences for S-D′ (which consumes this).**

1. **The Explore/Plan subtraction is already done by the harness** — there is nothing left for a
   subtraction map to remove from these two seats. Any map claiming savings there would be
   claiming savings that already exist.
2. **The control's file list is an independent confirmation of the FORK-D resident-set
   predicate.** It reported exactly `CLAUDE.md`, `00-rule-index.md`,
   `attention-is-not-a-mechanism.md`, `build-first-reuse-default.md`, `ai-laziness-traps.md`
   (plus operator-global `CLAUDE.md` and the memory index). The predicate «rules lacking
   `^paths:` frontmatter, minus the effective `claudeMdExcludes`» predicts *precisely* that set:
   11 no-`paths:` rules minus the 7 committed excludes = 4. **Live-observed = predicate-derived,
   exactly.** S-E's P3b can cite this as an outcome-channel confirmation.
3. **The P1 fix is confirmed working in the field.** The S-A W1 table recorded
   `cold-seat-economy`, `autonomous-loop-continuity` and `git-conflict-merge-forward` (35,197 B)
   as «loaded despite claudeMdExcludes». None of the three appears in the control's inventory,
   and `.claude/settings.local.json` no longer carries a shadowing `claudeMdExcludes` key
   (`jq` → `ABSENT`). Both halves of the P1 residue are discharged.

**Coverage caveat (T14, stated rather than glossed).** n=1 session per agent type, all three
spawned from the same parent session, so the probe measures *these* agent definitions under
*this* harness build (`97b10bed50` tree, agents dispatched at `d7a0fe6f7f`). It does not
establish that no CC version ever loads rules into `Explore`. It is sufficient for S-D′'s
question — «is there anything left to subtract from these seats today» — and no wider claim is
made.

---

## §7 Coverage and confidence (T6 — predicates, not adjectives)

- **P3d corpus coverage:** 903/903 enumerated transcripts parsed (183 session-root + 720
  subagent); 160,844 stream records; 80,993 billed assistant turns. Population enumerated
  **before** sampling; no sampling was used — every transcript in the population is parsed, so
  T1/T9/T10 do not bind here.
- **Trigger classes:** 100% of billed turns classified into 6 exhaustive classes summing to the
  measured totals (80,835 turns in §2 vs 80,993 in §1 — the 158-turn gap is turns whose file
  produced no timestamp, which the classifier excludes rather than guesses).
- **Config-change causes:** 2 of 5 named sub-classes CITED to primary docs and measured; 2
  OBSERVED but not doc-confirmed as causes; 1 (`mcp-toggle`) `UNMEASURED — channel absent`.
  ~7% of the sub-5-minute cold-prefix band attributed; **~93% explicitly unattributed.**
- **Arrival position:** 37,881 tool results positioned against their own session length.
- **FORK E:** both arms measured; per-invocation size cross-checked two ways (live hook probe
  1,760/1,866 B vs corpus-recorded 1,721/1,828 B — a ~2% spread from the trailing newline and
  the language-line variant, well inside the 4 B/token estimation error).
- **P11:** n=1 per agent type + 1 control; two independent channels concurring; control quotes
  verified verbatim against source line numbers.
- **Est-token conversion:** 4 B ≈ 1 token throughout, per the seed's binding convention. No
  tokenizer was available; a derived-sounding factor would be fabrication.

**What would falsify the central claims.** (a) §2 — if `cache_read == 0` turns out to be
recorded for reasons other than a cold prefix (e.g. a harness-side accounting quirk), the 16.6%
avoidable-write figure collapses and N1's falsifier must be re-tested. (b) §5 — if CC ever
starts recording only *some* hook invocations as `attachment` records, the firing counts are a
lower bound, not a count. (c) §6 — a CC build that injects rules into `Explore` would reverse
the P11 verdict; re-run the three-arm probe after any harness upgrade.

---

## §8 §1.7 self-reflexive note

**Forward-check.** [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md):
the acceptance contract for this stage's script is a deterministic gate, not a reader — the
script starts `set -euo pipefail`, emits two machine-checkable population markers, and **exits 3
on an empty or single-population corpus**; all three guard paths were exercised, and the seed's
own failure shape (`printf '' | while read; done | sort` → exit 0) was reproduced to confirm the
gate is non-vacuous. [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md):
no capability commit — the script adds no dependency, no `packages/` file, and is a promotion of
an existing inlined snippet (verdict: reuse, not build). T20: every number above carries its
command or its record channel; the one verdict-shaped claim (P11) carries a control arm.
T-SH-A: no price is stated without its channel; `mcp-toggle` reads
`UNMEASURED — channel absent` rather than an estimate.

**Backward-check.** Class of this change = *artefacts that assert per-turn or per-session token
costs*. Enumerated surfaces where that class occurs, each verdicted:

- `.claude/orchestrator-prompts/token-economy-research-s-a/kickoff.md` §2.7 (the seed) —
  **SWEPT: superseded as SSOT, file untouched** (`git diff --stat` shows no hunk); §2.8's
  1,760 B injector figure re-measured and confirmed; §2.3's 247-session base **now stale by
  −25.9%** (§1).
- `docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md` — **GAP-FOUND,
  not edited (owner: its authoring session):** its W3 uniform-arrival assumption is now measured
  wrong by 1.30× (§3), and its W1 rows 6-8 «loaded despite claudeMdExcludes» no longer hold
  (§6). Surfaced here as the correction record; the patch is a closed historical artefact.
- `docs/superpowers/specs/2026-08-06-pipeline-token-economy-design.md` §1.6 FORK E —
  **GAP-FOUND:** its ~53 KB/30-turn figure assumes per-turn firing; measured per-prompt (§5).
  Spec is round-capped and operator-owned; correction recorded here, not applied there.
- `docs/superpowers/specs/2026-07-31-arch-v2-context-pipeline-design.md` ADR-3 — **SWEPT-CLEAN:**
  its 29-39% repo-owned share and ~100k session-start total are corroborated by an independent
  channel in the P14 sibling patch, not contradicted.
- `.claude/rules/cold-seat-economy.md` — **SWEPT-CLEAN:** its seat-economy table was not
  re-derived (kickoff descope); §0's 4.8× vs 23.7× subagent/main residency ratio is new
  material for P6's maintainer-handoff, not an edit to the rule.
- `scripts/measure-always-on.sh` / `scripts/check-alwayson-budget.sh` — **NOT SWEPT, out of
  permitted set (S-E owns).** §6 item 2 supplies an outcome-channel confirmation of the FORK-D
  predicate those scripts must implement.

**Self-application (T15).** This patch measures what resident documents cost. Its own cost if it
were ever loaded always-on: `wc -c` on this file × 4 B/token × the 23.7× median main-seat
residency multiplier. It carries **no `paths:` frontmatter and lives under
`docs/meta-factory/research-patches/`, which is not in any resident set** — it is read on
demand by S-D′ and S-E and costs zero when unread. That is the correct channel for it, and the
same test this stage applied to `ai-laziness-traps.md` applied to itself.
