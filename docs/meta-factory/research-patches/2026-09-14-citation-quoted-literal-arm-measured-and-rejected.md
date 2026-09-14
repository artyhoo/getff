<!-- scope:citation-quoted-literal-arm -->
# ARM 3 «quoted literal must land» — built, replayed, and REJECTED as a gate

> Scope: the candidate third arm for [`scripts/check-line-citations.mjs`](../../../scripts/check-line-citations.mjs), proposed to close ARM 1's declared birth-wrong blind spot. Verdict: **NO-SHIP**, on an incident replay. Individual-file authority inherited from [research-patches/README.md](README.md).

## Problem

[`check-line-citations.mjs:22-26`](../../../scripts/check-line-citations.mjs) declares its own hole rather than papering over it: a citation **wrong when written** is green on ARM 1 (its blame commit IS the birth commit, so «then» and «now» agree), and ARM 2 catches only a cited line that is BLANK. A birth-wrong citation landing on a non-blank wrong line is invisible to both.

That hole fired for real. In the getff.ai site specs the lychee sha256 pin was cited as `.github/workflows/audit-self.yml:748-749` in **seven** places; `:748-749` are `--strip-components` comments and the `sha256sum -c` line is `:756`. An eighth instance in the same corpus cited an arm-G fixture at `.claude/hooks/check-hook-marker.sh:155-158` (comment prose) when the advisory opens at `:174`. All eight were wrong from birth. Worse, `2026-09-13-getff-ai-site-design.md:329` records a review round that **re-pointed** the citation from `720-721` to `748-749` and ACCEPTED it — the process ratified the wrong coordinate.

**Candidate ARM 3:** when a citation `path:NN` appears in a sentence that also carries a backticked literal, assert that the cited line CONTAINS that literal. Deterministic, no LLM, reads only today's target — so like ARM 2 its earliest reachable channel is pre-commit.

## Root Cause of the rejection — the arm was measured, and it lost

Built as a patch on the real gate (so resolution, backref-anchoring and range handling are identical to production), with the adjacency window, minimum literal length and sentence/cell guards as **env tunables**, then replayed.

**Replay corpus.** The eight sites were fixed by PR #1765 (`82a9e628d71`), so today's text cannot replay the incident. Pre-fix text taken from `82a9e628d71^` (`7b600f2e7d3`) as a detached worktree; the two ground-truth targets are untouched by that commit, so «then» and «now» agree for them.

**The incident does replay.** The shipped two-arm gate on the pre-fix five specs:

```text
$ node scripts/check-line-citations.mjs --check docs/superpowers/specs/2026-09-1*-getff-ai-*.md
EXIT=0        # both arms green on all eight birth-wrong citations
```

### 1. Recall on the motivating incident: **1 / 8**

| site | bound literal? | outcome |
|---|---|---|
| `…docs-quality-contract:403` | `sha256sum -c` | **TRUE CATCH** |
| `…docs-quality-contract:51` | `render-rule-index.mjs --check` | LANDED → green on a wrong citation |
| `…site-design:194` | `9b70014b77e` (a commit SHA) | fired **coincidentally** — would fire identically if the citation were right |
| `…docs-quality-contract:98`, `:286`, `:348`, `…site-design:329`, `…reference-generator:183` | none | **zero coverage** — no literal in the clause |

Five of eight carry no backticked literal at all, including the whole second confirmed instance. The one true catch is the site the operator had already found by hand.

### 2. The discrimination test FAILED

```text
pre-fix  (82a9e628d71^):  42 fires, exit 1
post-fix (82a9e628d71):   41 fires, exit 1
```

The single true catch flips; **the gate's verdict does not.** RED before, RED after — 41 fires of standing noise drown the one-bit signal. Per the acceptance bar, an arm that fires on both proves nothing.

### 3. Tuning cannot rescue it — 16-cell sweep

| | MINLEN 4 | 8 | 12 | 20 |
|---|---|---|---|---|
| **GAP 5** | 10 fires ✓catch | 10 ✓ | **9 ✓** | 4 ✗catch |
| **GAP 10** | 16 ✓ | 13 ✓ | 10 ✓ | 5 ✗ |
| **GAP 20** | 25 ✓ | 20 ✓ | 15 ✓ | 10 ✗ |
| **GAP 40** | 42 ✓ | 36 ✓ | 27 ✓ | 15 ✗ |

No clean cell. Every configuration that keeps the catch carries **≥9** other fires; the only setting that clears the noise (`MINLEN 20`) discards the catch, because `sha256sum -c` is 12 characters. Best precision ≈ **1/9 ≈ 11%**. Gap is not a separating variable: fires and landings distribute near-identically across every gap bucket, and the true catch sits at gap 4, inside the noise.

### 4. On the corpus the gate actually runs on: **precision 0 / 30**

Live-authority set (103 files: `.claude/rules/`, `.claude/skills/`, `agents/`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`):

- 119 resolved citations; **44 carry any bound literal — a 37% coverage ceiling**;
- 57 bound pairs → **30 fires (52.6% of pairs)**, 26 distinct citations (21.8% of all resolved).

All 30 were hand-adjudicated against their targets, not sampled. **Every one is a false positive.** The five strongest candidates each dissolved on inspection — the pattern is invariant:

| fire | verdict |
|---|---|
| `cold-seat-economy.md:27` → `pr-body-fidelity.ts:228` / `Audited-SHA` | `:228` IS the «prefix the PR head» check. Citation exact; the literal is the sentence's *subject*, defined at `:227`. |
| `rule-enforcement-channel-selection.md:10` → `.claude/settings.json:123` / `Edit|Write` | `:123` names *this* rule's hook command — the only non-ambiguous line; six identical `Edit|Write` matchers exist. Citation well-chosen. |
| `zcode-parity-doctrine.md:93` → `render-harness-config.mjs:265-266` / `inject-subagent-context` | `:265-266` is the code that performs the replacement; the string is data at `:261`. Citation correct. |
| `agents/rule-researcher.md:291` → `rule-test-author.md:70` / `!isCI` | `:70` does say «delivery lane landed (W4)», which is what the clause cites. `!isCI` belongs to the preceding clause. |
| `.claude/skills/pipeline/SKILL.md:494` → `setup.d/lib.sh:62` / `env+` | `:62` is `GETFF_SKILLS_ENV="… pipeline …"`. Citation correct; `env+` is the tier name, defined at `:52`. |

### 5. The noise is a CATEGORY MIX, not a tuning artefact

Nine distinct structural categories; **six were not predicted** in the design brief. Each needs a different structural fix, none is a threshold:

| # | category | example | predicted? |
|---|---|---|---|
| A | command/argv rendered as a human command line | `render-rule-index.mjs --check`; source stores `['tsx', '…', '--check']` | new |
| B | the «literal» is itself a citation | `` `.husky/pre-push:25` ``, `` `AGENTS.md.template:20` `` | new |
| C | comma-list citation `path:92,121` — literal belongs to the sibling line | `injectRegion`/`regionsMatch` | new |
| D | elided quotation — the repo's house style for pins | `` `pip install ruff==…` `` (citation verified correct) | new |
| E | type/shape/set notation collapsed to one line | `{ input: string[]; 'expect-violation': string }` over a 5-line interface | new |
| F | symbol defined elsewhere in the cited file | `Audited-SHA`, `REQUIRED_HEADER_DOCS`, `env+` | predicted |
| G | multi-line construct, literal one line off | — | predicted |
| H | path/glob fragment | `docs/meta-factory/phase-*-research.md` | new |
| I | source line-wrapping splits the literal | `model=sonnet, transport=cli` spans `:64-65` | new |

Category D alone is decisive: eliding a version behind `…` is how this repo *deliberately* cites a pin, so the arm fires hardest on its own best-written citations.

**The obvious refinement is strictly worse.** Firing only when the literal is absent from the target file entirely (which would kill category F):

```text
corpus B: 30 → 18 fires, all still false positives
corpus A: the ONE true catch is DISCARDED — `sha256sum -c` IS elsewhere in audit-self.yml (:756)
→ recall 0/8, precision 0/18
```

### 6. Prior art — the production analogs made the opposite choice

[doc-freshness-checker](https://github.com/cosmocoder/doc-freshness-checker), [check-snippets](https://pkg.go.dev/github.com/panyam/mcpkit/tools/check-snippets) and [doc-drift](https://github.com/sunnydachs/doc-drift) all solve snippet drift, and all three (a) operate on **fenced blocks** — an unambiguous scope, not an adjacency heuristic — and (b) compare **parsed/normalized structures** (AST, gofmt, signature match), never raw substrings. ARM 3 would have to take the rejected branch on both axes. That is corroboration of the measurement, not a reuse candidate: none of them checks a `path:NN` coordinate.

## Solution — NO-SHIP, and two structural findings that outrank the arm

**ARM 3 is not built.** Flagging 52.6% of a surface to catch one defect the operator had already found by hand is `#gate-where-judgment-needed` ([rule-enforcement-channel-selection.md §5](../../../.claude/rules/rule-enforcement-channel-selection.md)) and `#hope-as-gate`'s mirror image — a gate nobody can make green. Precedent and register: [destination-environment-verification.md §5](../../../.claude/rules/destination-environment-verification.md), where three deterministic variants were built, replayed, and rejected for the same two reasons (recall ceiling structural, noise a category mix).

Two findings from the replay matter **more** than the arm, and both are separate concerns (surfaced, not fixed — CLAUDE.md PR strategy):

- **S1 — ARM 2's pre-commit channel does not exist.** [`pre-push.ts:1401-1405`](../../../packages/core/hooks/pre-push.ts) states plainly that `--blank-only`'s earliest reachable channel is pre-commit and that wiring it «is a one-line addition to `.husky/pre-commit`, maintainer-owned». `grep -c check-line-citations .husky/pre-commit` → **0**. Both arms still run only at pre-push, one rung late for exactly the birth-wrong class this work targeted. Any future ARM 3 inherits a channel that was never opened.
- **S2 — the incident corpus is not gated at all.** [`LIVE_AUTHORITY_MD` at `pre-push.ts:1379-1386`](../../../packages/core/hooks/pre-push.ts) does not include `docs/superpowers/specs/`. **A perfect ARM 3 would not have fired on this incident**, because the five specs are outside the gated set. The eight birth-wrong citations reached a review round and a merge without the gate ever being asked. Closing that is a corpus decision with its own cost (the specs carry 226 citations, 67 unresolvable) — not this PR's concern.

### Coverage floor, re-measured

The header's «141 citations, 43 resolved, 98 dropped … 98 → 39» is **honest and reproducible at its own commit**: at `e7a4ed73059` the five specs give `resolved 112 / skipped 39`. It is now **stale** — today the same five give:

```text
check-line-citations: resolved 159 / skipped 67 citation(s).   # 226 total
```

PR #1765 added ~75 citations and the skip count rose 39 → 67. The gate reaches 70% of citations on that corpus, not the implied coverage; ARM 3 would have reached 37% of *those*.

## Prevention

**PRIORITY CHECK — before proposing a new deterministic arm for a citation/claim gate:** build it as a patch on the real checker, replay it against the pre-fix text of a *confirmed* incident, and require **discrimination** (RED before, GREEN after) — not a fire count. If the arm is RED on both, it is not a gate regardless of how many true positives it also produced. Then adjudicate **every** wild fire by hand against its target; if the false positives fall into more than two structural categories, the residue is judgment, not tuning, and the honest channel is prose plus the existing edit-time injection.

**Re-gate trigger.** Re-open ARM 3 when the citing form becomes machine-addressable: three or more birth-wrong incidents in which the evidence sits in a **structured slot** — a fenced block adjacent to the citation, or a declared field (`cited-text:`) — rather than an inline backticked literal in free prose. At that point the arm's addressable unit changes and the 37% coverage ceiling / 9-category noise floor measured here no longer apply. The acceptance leg stays the **incident replay**, never the flag count. Incident counter: **8** birth-wrong citations, **0** of them in a structured slot.

## §1.7 self-review (recursive self-application of this very patch)

### §1.7 Forward-check applied

- **The claim this patch makes is falsifiable and the falsifier is named.** «ARM 3 cannot be a gate» is wrong if a variant reaches discrimination (RED pre-fix, GREEN post-fix) on the `82a9e628d71^` corpus with ≤2 wild fires on the 103-file live-authority set. The probe, the corpora and the sweep are reproducible from the commands quoted above; the sweep grid is stated in full so a reader can attack the cell I did not try.
- **The measurement obeys T3** ([ai-laziness-digest](../../../.claude/rules/ai-laziness-digest.md)): every finding carries a command + output or a `file:line` plus that line's actual content. No prose-only findings. **T1** — the wild-fire population was 30 and all 30 were adjudicated; nothing was sampled. **T2** — the arm was built and run, not designed and described.
- **T14 honoured explicitly:** the 0/30 precision result is stated as «zero confirmed defects among 30 fires», and the 37% coverage ceiling is stated alongside it, so «clean» is not read as «corpus clean».

### AI-laziness traps — active set + domain extension

See [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). **Active traps for this measurement:** T1 (sampling floor — all 30 fires adjudicated, none sampled), T2 (build and run, do not describe), T3 (command + output or `file:line` per finding), T6 (explicit predicates, not «high confidence»), T7 (adversarial counter-prompt — §5's «is the noise tunable?» was run as a 16-cell sweep, not asserted), T11/T12 (external search at proposal time — §6), T14 (clean-on-low-coverage stated as such), T15 (self-application), T19 (own cold read of the residue before handoff), T20 (evidence-bearing tool call before each verdict).

Two domain-specific traps this work earned, neither in the catalogue:

- **T-ARM3-A — «the seeded example confirms the mechanism».** When a design brief names the one site that motivated a proposed detector, that detector catching *that* site is not recall evidence — it is the brief's own example played back. Here the arm caught `…docs-quality-contract:403`, the exact site the brief called «the key to the proposed mechanism», and missed 7 of the other 8. Counter: compute recall against the **full** confirmed-defect set before reading any fire, and treat the seeded site as excluded from the numerator.
- **T-ARM3-B — «adjudicate the fire, not the target».** A wild fire reads as a defect when you look only at the flagged sentence; it dissolves when you open the cited line and the citing clause together. Five fires here survived first-pass classification as «real» and all five dissolved on the second read (the literal was the sentence's subject, a sibling clause's referent, or a symbol defined elsewhere). Counter: no fire may be graded TRUE without quoting the cited line's actual content next to the claim it is said to support.

### §1.7 Backward-check applied

- **Class:** *a proposed deterministic detector whose acceptance evidence is a flag count rather than an incident replay.* Sibling surfaces where the class must also hold:
  - [`destination-environment-verification.md §5`](../../../.claude/rules/destination-environment-verification.md) — **SWEPT-CLEAN**: already carries the replay bar and an explicit «the gate lost» record; this patch reuses its register rather than restating it.
  - [`scripts/check-line-citations.test.sh`](../../../scripts/check-line-citations.test.sh) (241 lines) — **SWEPT-CLEAN, no edit**: no paired negative is added because no arm ships. Adding a fixture for an unbuilt arm would be the `#hope-as-gate` shape.
  - [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md) — **GAP-FOUND, surfaced as S1/S2**: §1 requires a load-bearing check to be a gate at the *earliest reachable* channel. ARM 2's declared pre-commit channel is unwired and the incident corpus is ungated — two live instances of the rule's own subject matter, both outside this PR's scope.
- **Self-application, honestly:** this patch is itself dense with `path:line` citations and lives under `docs/meta-factory/research-patches/`, which **S2 shows is not in `LIVE_AUTHORITY_MD`** — so the gate will not check a single citation in this document. Every line number quoted here was therefore read and verified by hand at `82a9e628d71`. That is the same manual discipline whose failure produced the incident, which is precisely the argument for S2 and against relying on ARM 3.

### Prior-art consult

- No capability commit: this PR adds one `.md` file. `*.md` never counts (CLAUDE.md «What is a capability commit?», documentation carve-out).
- Capability area *was* consulted anyway, because the work began as a build proposal — three production analogs surfaced (§6 above) and are recorded there with their design choices. No SSOT row is added: nothing was built, and the existing gate's row (#274) is unchanged by a no-ship.
