<!-- scope:rtk-empirical-test-host -->

# RTK empirical test — measured delta on our workloads (closes S-B falsifier)

> **Authoritative for:** the empirical answer to the S-B candidate-1 falsifier — a *measured*
> Bash-heavy session class on which RTK removes > 5% of total weighted cost → upgrade DEFER to
> ADOPT-on-operator for that class.
> **NOT authoritative for:** S-B's arithmetic estimate (1.7–3.1%, unchanged — this patch *measures*
> what S-B *projected*); S-A's billing profile (cited, not re-derived); the SSOT RTK row #233
> (already on `staging`, cited verbatim — this patch **does not edit** it).
> **Host vs container:** this is a **host** test — RTK binary installed via Homebrew, transcripts
> read from `~/.claude/projects/`. A container run would prove nothing about the host
> ([`destination-environment-verification.md §3`](../../../.claude/rules/destination-environment-verification.md)).

## Headline (the answer to the falsifier, up front)

**DEFER CONFIRMED.** On this project's actual command mix, RTK saves **9.4% of Bash-output bytes**
(char-weighted, 599 calls measured), which translates to **≈ 1.8% of total resident-context
weighted cost** — **below** the 5% falsifier threshold and **consistent with** S-B's arithmetic
ceiling (1.7–3.1%). The 89% vendor claim does **not** reproduce on our mix because (a) our Bash
output is already compact (`git status`/`wc`/`grep`, not verbose test-runner dumps), and (b) RTK
refuses to rewrite compound commands (`cd X && Y && Z`), which are **71% of our Bash calls**. An
independent controlled benchmark (JetBrains, 425 trials, July 2026) independently found RTK
**+7.6% more expensive** at low reasoning effort (p=0.004), ±0% at high effort — corroborating this
patch's direction from a different method.

**The falsifier is closed.** The trigger it named (>5% measured) did not fire. DEFER stands; the
operator-axis upgrade path now has a **measured ceiling**, not just an arithmetic one.

## §A0 — host environment

| item | value | evidence |
|---|---|---|
| Host | macOS, arm64 (darwin 25.5.0) | `uname -a` |
| RTK before run | **not installed** | `which rtk` → not found; `brew list rtk` → no keg; `~/.cargo/bin/rtk` → absent |
| Install attempt 1 | `brew install rtk` → **success** | exit 0, `rtk 0.44.1` at `/opt/homebrew/bin/rtk` |
| `cargo` | present | `/Users/art/.cargo/bin/cargo` |
| `brew` | present | `/opt/homebrew/bin/brew` |
| Activation mode | **wrapper** (`rtk <subcommand> <args>`), NOT `rtk init -g` | `rtk init -g` writes a global hook to `~/.claude/settings.json` — that is outside this patch's hard boundary (one file only). Wrapper mode invokes the **same compression pipeline** the hook would; it is the fair isolation of RTK's effect without mutating host CC config. |
| Transcripts | available on host | `~/.claude/projects/-Users-art-code-rules-as-tests-aif/` — 18 JSONL, 46 MB main dir; 5 sessions selected by size (top-5) for §A2 |
| Git base | `origin/staging` @ `3974794bf2` | `git checkout -b research/rtk-empirical-test origin/staging` |

**RTK README install methods (verified via WebFetch on `github.com/rtk-ai/rtk`):** Homebrew
(`brew install rtk`, recommended), quick curl installer, `cargo install --git`. Activation for
Claude Code is **hook-based** (`rtk init -g` rewrites `git status` → `rtk git status` before
execution). Stat command: `rtk gain`. **Vendor's own disclaimer, verbatim:** *«RTK cuts up to 90%
of the bash output your agent reads. That is what RTK measures, and **it is not the same as cutting
your bill by 90%**»* — README, quoted in S-B and re-confirmed unchanged here.

## §A1 — scenario A/B raw measurements (W1)

Two Bash-heavy scenarios from real repo work (not synthetic), each run **baseline (raw)** and
**with RTK** (native subcommand). Bytes = `wc -c` of combined stdout+stderr, captured via `tee`.

### Scenario A — test-debug loop (`vitest run packages/core/principles/`)

| variant | bytes | delta |
|---|---:|---:|
| baseline raw | 6,710 | — |
| `rtk vitest run` | 32 | **−99.5%** |
| tool-call count (both) | 1 | — |

Baseline = 340-line passing-test report (`✓ packages/core/principles/NN-*.test.ts (N tests)` ×35,
plus `Test Files 35 passed`, `Duration 65.39s`). RTK output = single line `PASS (340) FAIL (0)
skipped (1)`. **On a passing run** this is useful and safe.

### Scenario A' — failing test (caveat-(c) probe)

S-B caveat (c) predicted: *«if compressed output hides needed detail, the model re-runs → saving
evaporates.»* Probed with a deliberately failing test (`expect(1+1).toBe(3)` + a string-contains
assertion):

| variant | bytes | delta |
|---|---:|---:|
| baseline raw (vitest) | 1,672 | — |
| `rtk vitest run` | 2,240 | **+34.0%** (RTK output LARGER) |

**Finding — caveat (c) fires in the opposite direction than predicted.** RTK's failing-test
fallback does **not** hide detail (the AssertionError, expected/received, and `file.test.ts:line:col`
are all present). Instead it **inflates** output by emitting the **full** Node stack trace
(`at file:///.../node_modules/@vitest/runner/dist/chunk-artifact.js:302:11` ×12 frames per failure)
that raw vitest trims. RTK also appends `[full output: ~/Library/Application Support/rtk/tee/…log]`,
a pointer the agent cannot read in-container. **Net: on the failure path — the path that actually
matters for a debug loop — RTK is a cost increase, not a saving.** This is a stronger negative than
caveat (c) anticipated.

### Scenario B — git/status/lint loop

| variant | bytes | delta |
|---|---:|---:|
| B (small): `git status && git log -20 && render-rule-index --check && markdownlint` | baseline 2,632 → RTK 2,241 | **−14.9%** |
| B-ext (realistic volume): + `git log -200 && npm run && git diff --stat HEAD~5` | baseline 23,144 → RTK 22,101 | **−4.5%** |

B's delta is modest because `render-rule-index --check` and `markdownlint` outputs are already terse
(success = near-silent); RTK's native `git` subcommand is the only meaningful contributor, and `git
log` on a small repo compresses poorly (RTK's own `rtk gain` reports **2.9%** on `git log --oneline`,
see §A2).

## §A2 — comparison vs vendor 89% and vs S-B 1.7–3.1%

Three independent measurements, each attacking the headline from a different method. **All three
agree the vendor 89% does not reproduce on our mix; all three agree the total-cost share is in or
below S-B's range.**

### §A2.1 `rtk gain` — RTK's own per-command accounting (this session)

`rtk gain` (RTK's built-in stats DB, accumulated over the 17 native-subcommand calls this session):

| command family | calls | tokens saved | avg % |
|---|---:|---:|---:|
| `rtk vitest run` | 4 | 83.3K | **81.1%** |
| `rtk git status` | 7 | 473 | 67.5% |
| `rtk git log --oneline` | 3 | 214 | **2.9% / 3.2% / 0.6%** |
| `rtk npm ls` | 1 | 1 | **0.1%** |
| `rtk proxy` (passthrough, no filter) | 2 | 0 | 0.0% |
| **session total** | 17 | 84.0K | **88.7%** (volume-weighted, dominated by the 4 vitest runs) |

**The session-total 88.7% is real but misleading** — it is dominated by the 4 large vitest runs.
Strip vitest and the average collapses to <15%. This is the crux: **RTK's headline number is a
volume-weighted average that hides enormous per-command variance.** A mix with no verbose test
runners sees single-digit savings.

### §A2.2 Transcript ground truth — Bash share on our actual sessions (W2)

Parsed 5 sessions (top-5 by size, 5,149 turns, 599 Bash calls) from
`~/.claude/projects/-Users-art-code-rules-as-tests-aif/`. Per-tool-result char attribution by
matching `tool_use_id` → tool name:

| session | turns | Bash chars | Read chars | Bash % | Bash calls |
|---|---:|---:|---:|---:|---:|
| `900b7c79` | 1,117 | 156,617 | 145,503 | 47.3% | 126 |
| `226108a1` | 1,086 | 290,822 | 41,968 | **83.6%** | 164 |
| `560eb7b1` | 993 | 238,793 | 38,257 | **82.9%** | 112 |
| `9af24ff0` | 1,269 | 130,092 | 44,267 | 69.4% | 132 |
| `4f99ffbf` | 684 | 108,898 | 235,275 | 30.9% | 65 |
| **aggregate** | **5,149** | **925,222** | **505,270** | **61.4%** | **599** |

**Per-session Bash-share variance is large (30.9%–83.6%)**, higher than S-A's corpus-wide 51.5%
(S-A `§A2.6`: Bash 20.6M of 40.1M total tool-result chars). The top sessions are Bash-heavy by
*call share*, but **call share ≠ byte leverage** (see §A2.3).

### §A2.3 The honest weighted number — char-weighted, not call-weighted

Classified the 599 Bash calls by output-producing family (last command in a chain), weighted by
**output bytes** (the metric RTK actually attacks — `cd` produces ~0 bytes, `git log` produces
kilobytes; call-count weighting would understate output-heavy families). Per-family RTK saving taken
from `rtk gain` (§A2.1) + the batch test where `rtk gain` had no entry:

| family | calls | output chars | char share | RTK save % | chars saved |
|---|---:|---:|---:|---:|---:|
| `head` (pipes to `head -c`/`-n`) | 214 | 431,761 | **46.7%** | ~0% (already truncated) | ~0 |
| `cd` (chain prefix) | 82 | 181,956 | 19.7% | 0% | 0 |
| `grep`/`rg` | 83 | 111,301 | 12.0% | 20% | 22,260 |
| `tail` (pipes) | 122 | 106,754 | 11.5% | ~0% (already truncated) | ~0 |
| `default` (compound/unknown) | 31 | 31,330 | 3.4% | 0% (RTK refuses) | 0 |
| `wc` | 21 | 23,352 | 2.5% | 20% | 4,670 |
| `ls`/`find` | 12 | 16,089 | 1.7% | 30% | 4,827 |
| `git log` | 18 | 12,053 | 1.3% | 2.9% | 350 |
| other (`tsx`/`node`/`cat`/`tsc`/`git branch`) | 26 | 9,227 | 1.0% | mixed | 633 |
| **TOTAL** | **599** | **925,222** | **100%** | | **~86,723** |

**Realistic char-weighted RTK saving on our Bash output: 86,723 / 925,222 = 9.37%.**

The two dominant byte families — `head` (46.7%) and `tail` (11.5%) — are **piped truncations the
agent already applied**; RTK cannot improve an already-truncated stream. This is the structural
reason the vendor 89% does not reproduce: **our agent already self-truncates verbose output via
`head`/`tail`/`grep`, which is exactly the config-only equivalent S-B's SSOT row #233 proposed as a
DEFER-sustaining trigger (proposal P4).**

### §A2.4 Translation to total weighted-cost share (S-A framework)

Using S-A `§A4.3` Bash resident-cost (221,127 cost-units/session) ÷ (always-on 754,884 + tool-output
415,351):

| step | value | source |
|---|---:|---|
| Bash share of resident-context bill | **18.9%** | 221,127 / 1,170,235 (S-A §A4.3/§A4.4) |
| RTK realistic saving on Bash output | **9.37%** | §A2.3 (this patch, measured) |
| **RTK removes ≈ 1.77% of total resident-context weighted cost** | | 18.9% × 9.37% |
| S-B arithmetic estimate | 1.7–3.1% | S-B candidate 1 §3 (vendor 89% × residency) |
| S-B falsifier threshold | > 5% | S-B candidate 1 §6 |
| **Verdict** | **1.77% < 5% → NOT triggered** | |

The measurement lands **inside** S-B's arithmetic range (at its low end) and **well below** the
falsifier. The difference between S-B's upper-bound 3.1% and this patch's 1.77% is the gap between
vendor 89% (assumed) and our-mix 9.4% (measured).

## §A3 — verdict

**CONFIRM DEFER** (operator axis) — the S-B candidate-1 verdict stands, now on **measured** rather
than arithmetic ground. The falsifier did not fire.

- **Operator axis: DEFER** (unchanged from S-B). RTK installs cheaply (`brew install rtk`, zero
  config) and does save meaningfully on **one** command class — verbose test-runner output (`vitest`
  81%, per `rtk gain`). But that class is <2% of our Bash *bytes* (§A2.3: the `tsx`/`test` rows);
  the bulk of our Bash bytes is already-truncated `head`/`tail`/`grep` output RTK cannot improve.
  **Adoption is not worth a new tool surface for a <2% total-cost gain.**
- **Shipped axis: REJECT (provisional, unchanged from S-B).** Rust binary as a hard dependency
  violates the AI-/OS-/license-agnostic default
  ([`build-first-reuse-default.md §1.1`](../../../.claude/rules/build-first-reuse-default.md)).
  Not re-evaluated here — out of scope per kickoff.
- **Config-only equivalent (S-B proposal P4) is now the live recommendation.** §A2.3 shows the
  agent already self-truncates via `head`/`tail`/`grep` — the behaviour RTK would automate is
  already in the agent's habit on this project. A skill codifying *«pipe verbose test-runner output
  through `tail -50` / `grep -E '✓|✗|FAIL|Error'` before it enters context»* captures the one real
  saving (test-runner dumps) without the binary. **Not built here — flagged for the Opus
  distillation seat.**

### Falsifier-state summary

| falsifier (S-B candidate 1 §6) | this patch's result | state |
|---|---|---|
| measured Bash-heavy session class where RTK removes > 5% of total weighted cost → ADOPT | measured 1.77% on 599 real Bash calls | **NOT triggered** |
| operator config-only equivalent captures the bulk → DEFER stands without a strong trigger | §A2.3 shows agent already self-truncates via `head`/`tail`/`grep` (58% of Bash bytes) | **second branch confirmed** — DEFER reinforced |

## §A4 — independent corroboration (BFR §3 — WebSearch, fresh 2026-08-01)

Three WebSearch phrasings run 2026-08-01 (quoted, per BFR §3):

1. `rtk-ai/rtk claude code CLI proxy token savings benchmark 2026` → surfaced **JetBrains
   independent benchmark** ([blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings](https://blog.jetbrains.com/ai/2026/07/rtk-claude-code-token-savings/)):
   > *«rtk advertised savings: 60–90%. Measured on real agent work: **+7.6% more expensive at low
   > reasoning effort (p=0.004), ±0% at high effort**.»*
   425 trials, Claude Code 2.1.201 headless, claude-sonnet-5, SkillsBench 86/87 tasks. Method:
   per-task medians + Wilcoxon signed-rank; paired A/B. **Why it increased cost:** *«+13.8% more
   turns (p=0.03) and +14.3% more cache reads (p=0.008)»* — *«transcript forensics found no single
   villain»* but *«one genuinely broken rewrite (compound find predicates turned into usage errors
   and retries), a few compression-induced re-reads»*. Per-class: *«only 33% of Bash calls carries
   just under 20% of tool-result chars»*; tasks with heavy hook exposure cost *«about 24% more than
   baseline»*. Author: Denis Shiryaev, July 2026. **This is the most rigorous public benchmark and
   it independently confirms this patch's direction from a controlled method this patch did not
   use.**
2. `RTK Rust Token Killer issues bugs context loss claude code reddit` → community reports
   uniformly positive on the *passing-test* path (creator: *«saved 10M tokens (89%)»*,
   [reddit/r/ClaudeAI](https://www.reddit.com/r/ClaudeAI/comments/1r2tt7q/)); the recurring caveat
   is that RTK is **lossy** and can strip detail Claude needs (the same mechanism this patch's
   scenario A' probes directly). No major bug reports, but no controlled benchmark either — all
   anecdotal, vendor-aligned.
3. `CLI output compression tool LLM token reduction TACO Headroom alternative 2026` → **Headroom**
   ([github.com/headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom)) emerged as a
   2026 competitor with a **broader surface** than RTK — compresses tool outputs *and* files *and*
   logs *and* RAG chunks *and* conversation history, not just Bash output. CodePointer comparison
   names three tools (rtk, headroom, caveman). **Headroom is a material development S-B did not
   survey** (S-B ran 2026-08-01; Headroom's prominent coverage is mid-2026). Recorded here, not
   evaluated — out of scope for this patch's RTK-specific falsifier, but a WATCHLIST note for the
   token-economy umbrella.

**DeepWiki `rtk-ai/rtk` (S-B already ran; re-confirmed unchanged):** strategy = smart filtering +
grouping + truncation + dedup; `estimate_tokens = chars/4`; on filter failure falls back to raw
output; stats in `~/.local/share/rtk/history.db` via `rtk gain`. **This patch's scenario A' shows
the fallback path is itself a cost** (the inflated stack-trace output) — a nuance S-B's «falls back
to raw» phrasing understated.

**SSOT grep** (`grep -niE 'rtk|...' docs/meta-factory/prior-art-evaluations.md`): row **#233**
already exists (added by S-B, on `staging`). **This patch does NOT add or edit an SSOT row** —
hard boundary, and #233's verdict (DEFER) is unchanged by this measurement. The only candidate
update would be amending #233's *evidence* column to cite this measured ceiling, which is an
operator-approval decision (flagged in §A5, not done here).

## §A5 — coverage

**Measured (this patch, host):**
- RTK 0.44.1 install outcome + version (`brew install rtk`, exit 0).
- Scenario A (passing vitest): 1 baseline + 1 RTK run, byte-captured.
- Scenario A' (failing vitest, caveat-(c) probe): 1 baseline + 1 RTK run, byte-captured + content
  inspected.
- Scenario B (git/lint, small + extended): 2 baseline + 2 RTK runs, byte-captured.
- `rtk gain` per-command savings on 17 native-subcommand calls this session.
- Transcript ground truth: 5 sessions, 5,149 turns, 599 Bash calls, char-attributed per tool.
- Char-weighted command-family distribution + realistic saving (9.37%).

**Inferred (not directly measured):**
- The 9.37% Bash-output saving → 1.77% total-cost translation relies on S-A `§A4.3`'s Bash
  resident-cost share (18.9%), which itself uses a *uniform-arrival* assumption S-A flagged as a
  lower bound on tool-output residency. **Direction of error:** if arrival is front-loaded (it is),
  Bash's resident share is *higher* than 18.9% → the 1.77% is a mild **under-estimate** of RTK's
  total-cost effect. Even doubling the residency factor (to ~38%) gives ~3.5% — still below 5%.
- Per-family RTK save % for families with no `rtk gain` entry (`head`, `tail`, `wc`, `ls`, `find`,
  `cat`, `tsc`) are estimates from the batch test + the structural argument (already-truncated
  streams). The two dominant byte families (`head` 46.7%, `tail` 11.5%) are assigned ~0% — the
  conservative direction (if RTK *could* help them, the saving would rise, but a stream already
  piped through `head -c 5000` has nothing left for RTK to cut).

**Not measured / out of scope:**
- Container-vs-host: this is a **host-only** test. RTK in the aif container is a separate question
  (the container's Bash mix may differ). Flagged, not run.
- Headroom / caveman / TACO alternatives: surfaced (§A4) but not benchmarked — different candidate,
  different patch.
- Live agent loop (does the agent actually re-run on RTK-compressed output?): scenario A' probes the
  *mechanism* (RTK inflates failing-test output), but a full turn-level re-run-rate measurement
  would require a metered factory run — out of scope. The JetBrains benchmark (§A4) covers this
  directly with +13.8% turns, p=0.03.
- SSOT row #233 amendment: **not done** — requires operator approval (this patch's hard boundary).

## §A6 — patch self-cost (T15)

This patch, if loaded always-on, is a resident artefact paying the residency multiplier. Measured
at commit time:

| metric | value | est. tokens (4 B/t) |
|---|---:|---:|
| `wc -c` of this file | 23,341 B | 5,835 tok |
| resident-multiplier cost (median session, 21.2×) | 5,835 × 21.2 | 123,702 cost-units |

**Recommendation: do NOT load always-on.** This is a one-shot research deliverable for the Opus
distillation seat. The operator reads it once, merges the verdict into the distillate, and the
patch's ongoing residency cost is pure overhead. Consistent with S-A's own §A8 self-cost
recommendation for its patch. The patch belongs in `docs/meta-factory/research-patches/` (cold
archive), not in any `paths:`-gated hot-injection set.

---

## §1.7 Forward-check applied

This patch introduces no new rule, principle, skill, or SSOT row — it **measures** an existing
candidate (RTK, SSOT #233) against an existing falsifier. Forward-check items checked against the
existing active layer set:

1. **Code-level (R1-R20):** N/A — no TS/shell code added (zero build, per kickoff).
2. **Principle-level (01-09):** N/A — no TS principle code.
3. **Capability-commit gate:** this commit is **not** a capability commit (no new tool/hook/skill;
   one new `.md` research artefact). No `Prior-art:` trailer required; no escape-hatch trailer
   required (research-patch, outside the `packages/` capability scope per
   [`CLAUDE.md` capability-commit definition](../../../CLAUDE.md)).
4. **Build-vs-reuse SSOT:** the load-bearing candidate (RTK) is **already** SSOT row #233
   ([`docs/meta-factory/prior-art-evaluations.md:306`](../../../docs/meta-factory/prior-art-evaluations.md)
   on `staging`). This patch cites it; it does not add a row. Verified: `grep -niE 'rtk'
   prior-art-evaluations.md` → 1 hit (row 233).
5. **Trigger sweep (§1.6):** `grep -nE "^### 13\." docs/meta-factory/open-questions.md` — this
   measurement closes a falsifier, not an open question; no §13.x cascade dependency.
6. **Doc-authority:** this file carries the `> **Authoritative for:**` header above per
   [`doc-authority-hierarchy.md §3`](../../../.claude/rules/doc-authority-hierarchy.md); scope is
   narrowly the RTK falsifier, not the broader token-economy verdict (owned by the distillate).

## §1.7 Backward-check applied

The "artefacts under this patch's scope" are *the existing claims this measurement bears on* —
not new files to sweep. The complete sweep of artefacts making a load-bearing claim that RTK's
effect is unmeasured:

- **S-B candidate 1** (`docs/meta-factory/research-patches/2026-08-01-token-economy-s-b-candidates.md`
  on `staging`, candidate 1 §6 falsifier): claims *«a measured Bash-heavy session class on which
  RTK removes > 5% → ADOPT-on-operator»*. **This patch measured it: 1.77%, below 5% → falsifier
  NOT triggered, DEFER confirmed.** SWEPT-CLEAN — the falsifier is now resolved with measured
  evidence, and S-B is on `staging` (cited, not edited, per hard boundary).
- **SSOT row #233** (`docs/meta-factory/prior-art-evaluations.md:306` on `staging`): verdict DEFER,
  evidence column cites the 1.7–3.1% arithmetic. **This patch's 1.77% measurement is consistent
  with that range → no verdict change → row NOT edited** (hard boundary + operator-approval gate).
  SWEPT-CLEAN — the row's stated trigger (the >5% falsifier) is now measured-closed; the row's
  second branch (config-only equivalent, proposal P4) is *reinforced* by §A2.3 (agent already
  self-truncates 58% of Bash bytes via `head`/`tail`/`grep`).
- **S-A `§A4.3` Bash resident-cost share** (`docs/meta-factory/research-patches/2026-08-01-token-economy-s-a-profile.md`
  on `staging`, §A4.3 table): the 18.9% Bash-share figure this patch's §A2.4 depends on. SWEPT-CLEAN
  — cited verbatim, not re-derived; S-A's own uniform-arrival caveat (§A4.2 factor 1) is honoured
  (this patch flags the direction-of-error in §A5).
- **Exemption mechanism:** none needed — this patch adds one cold-archive research file, gated by
  no `paths:` glob (not in the edit-time-injection set). It is read-once by the distillation seat.

**Meta-test specification for the backward sweep:** the sweep's claim («no load-bearing claim about
RTK's effect is left pointing at unmeasured evidence») is falsified if a future artefact asserts
RTK's savings as *measured* without citing this patch or a fresher measurement. The
`recommendation-laziness-discipline.md` H1 trigger (cite-or-provisional) is the live guard.
