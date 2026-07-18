<!-- scope:zcode-parity-s9-multiturn-anchor-r -->
# ZCode parity Stage 9 — multi-turn guard + ai-title anchor (research-patch, FORK PARKED)

**Date:** 2026-07-18
**Umbrella:** `zcode-full-parity-mega-umbrella` Stage 9 (brainstorm-first, park-don't-guess).
**Branch:** `feature/zcode-parity-s9-multiturn-anchor-r-8c8d6d`
**Mode:** R-phase — research only, NO code change.
**Status:** 3-fork decision **PARKED** via `park.ts` (operator decision pending).

> **Authoritative for:** S9 evidence chain (R1/R2/R3) + 3-fork analysis (9A/9B/9C) + provisional recommendation.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). CC hook source — see [`end-of-turn-reminder.sh`](../../../.claude/hooks/end-of-turn-reminder.sh).

---

## §1 State verification (Task 1 — container-reality probe)

Per `phase-research-coverage.md §1.11` — never trust session-recall on shared state. Probes run verbatim in this container on 2026-07-18:

| Probe | Command | Output | Exit |
|---|---|---|---|
| Branch | `git rev-parse --abbrev-ref HEAD` | `feature/zcode-parity-s9-multiturn-anchor-r-8c8d6d` | 0 ✓ (Handoff contract honoured) |
| Base-pollution | `git log --oneline origin/staging..HEAD` | *(empty)* | 0 ✓ (branch is at base, no unrelated commits) |
| Rollout dir | `ls ~/.zcode/cli/rollout/` | *(empty)* | **2** — directory absent |
| Bundle reach | `find . -maxdepth 5 -name "zcode.cjs" -o -name "zcode*.bundle.cjs"` | *(empty)* | 0 — no bundle in repo tree |

**Verdict — kickoff §7 stop condition "Rollout inaccessible for R1 verification → PARK" is LIVE-TRUE.** `~/.zcode/` is not mounted in this aif-handoff container; `zcode.cjs` is not reachable anywhere in the repo tree. R1 own re-verification is BLOCKED on container access — the analysis proceeds on **inherited evidence** from step-1 (§3 below).

### 1.1 Line-number drift (post-step-1)

Kickoff §1 cited `end-of-turn-reminder.sh` L40, L43, L159-188. Post-step-1 actuals (re-verified this session):

| Concept | Kickoff cite | Actual line (this session) |
|---|---|---|
| ai-title grep | L40 | **L32** (`grep '"type":"ai-title"' "$transcript" …`) |
| First user prompt grep | L43 | **L34** (`grep -m1 '"type":"user"' "$transcript" …`) |
| Fallback anchor | (implicit) | **L36** (`[ -z "$anchor" ] && anchor="$(aif_msg_eot_anchor_fallback)"`) |
| Idle-suppression guard block | L159-188 | **L154-176** (with `prev_line` at L160, `prev_text` at L162, `current_short`/`grep -qF` at L164-166) |

All further citations in this patch use the **current** (post-step-1) line numbers.

---

## §2 R2 — ai-title equivalent in ZCode (Task 2)

**R2 question:** is there a ZCode-equivalent of CC's `{"type":"ai-title","aiTitle":…}` concept?

### 2.1 Inherited evidence (step-1)

From [`2026-07-18-zcode-parity-step1.md` §"Anchor degradation"](2026-07-18-zcode-parity-step1.md):

> ZCode synthetic transcripts have no `ai-title` field … bundle has 0 occurrences of `ai-title`/`aiTitle`.

Step-1 verified this empirically against the `zcode.cjs` bundle in **its** container (this S9 container cannot reach the bundle — §1 above). The verification is **inherited**, not re-verified in S9 own-verification — per `phase-research-coverage.md §1.6` vocabulary, mark this **armed-but-not-fired** for S9.

### 2.2 Equivalent-concept search rubric (deferred to bundle-reachable container)

R2's real question is "is there an *equivalent concept* (session goal / summary / conversation name)?" — a category sweep requires bundle access this container lacks. The following rubric is what the implementation phase will run when a bundle-reachable container is available (per `phase-research-coverage.md §1` items 2 + 3 — category sweep + semantic-distance check):

```bash
# Rubric A — session/conversation/thread-shaped top-level fields
grep -oE '"(session|conversation|thread)[A-Za-z]*":\s*"[^"]+"' zcode.cjs | sort -u

# Rubric B — goal/intent/summary/title-shaped keys (catches vocabulary drift)
grep -oE '"(goal|intent|summary|title)[A-Za-z]*"' zcode.cjs | sort -u

# Rubric C — every discrete type value (surfaces what concepts ZCode actually emits)
grep -oE '"type":\s*"[a-z-]+"' zcode.cjs | sort -u
```

### 2.3 Six candidate equivalent concepts to probe (parallel to §1 item 2)

| # | Candidate | Why plausible | Where to look |
|---|---|---|---|
| 1 | Session-title / conversation-name field | Direct functional analog | Rubrics A + B |
| 2 | First-user-prompt extraction | The natural anchor itself (CC's L34 fallback) | Producer at `zcode.cjs:~1072550` (step-1) |
| 3 | Session metadata header (timestamp + session-id) | Common session-shape pattern | Rubric A |
| 4 | ZCode Stop-hook payload fields | Anything `sessionSummary`-shaped | Rubric B + Stop-hook emit sites |
| 5 | Goal/intent extraction (`sessionGoal`, `userIntent`) | Naming variants CC doesn't use | Rubric B |
| 6 | Recent-message rolling summary | Conceptually nearest to "title" | Rubric B |

### 2.4 Provisional R2 verdict

**LIKELY no ai-title equivalent** (step-1 empirical evidence: 0 occurrences of `ai-title`/`aiTitle` in bundle) but **NOT YET CONFIRMED** by S9 own-verification — bundle unreachable in this container. Armed-but-not-fired. The 6-concept sweep + 3 rubrics above are the deferred-verification package.

---

## §3 R1 — multi-turn in rollout (Task 3 — PARK)

**R1 question:** does ZCode's rollout (`~/.zcode/cli/rollout/model-io-*.jsonl`) contain multi-turn data?

### 3.1 Honest reassessment of step-1's "verified YES"

The kickoff §1 asserts *"Step-1 verified YES (multiple lines per session)"*. Re-reading [`2026-07-18-zcode-parity-step1.md`](2026-07-18-zcode-parity-step1.md) §"Anchor degradation" + Part C:

- Step-1 **did** empirically verify the `zcode.cjs` **bundle**'s `$_n` producer at `zcode.cjs:~1072550` writes **1 line per turn** (this is the **synthetic-transcript** shape, the opposite of multi-line-per-session).
- Step-1 **did NOT cite a rollout `model-io-*.jsonl` file path**; the multi-line-per-session claim for **rollout** appears to be an **inference** from rollout's existence as a concept, not a direct empirical verification.

**Honest downgrade:** step-1's "verified YES" applies to *synthetic transcript shape* (1 line/turn — the premise that makes the current guard structurally inert on synthetic). Step-1 did **not** directly verify that rollout files contain multi-line-per-session records. The kickoff's wording over-claimed; per `ai-laziness-traps.md §2 T3`, the inherited-YES is downgraded to **INHERITED-INFERRED**, not INHERITED-VERIFIED.

### 3.2 Two live branches for R1

| Branch | When | Verification action |
|---|---|---|
| **R1-live-A (rollout reachable)** | Container with `~/.zcode/cli/rollout/` mounted | `head -1` + `jq 'keys'` on `model-io-*.jsonl`; line-count per `session_id` (jq `group_by`); confirm ≥2 records per session-id empirically |
| **R1-live-B (rollout still unreachable — THIS container)** | As in this S9 container | R1 stays at **inherited-INFERRED YES** from step-1; own re-verification BLOCKED. Forkes 9A and 9C carry inherited-evidence risk; fork 9B does not. |

### 3.3 Provisional R1 verdict

**INHERITED-INFERRED YES (step-1, bundle-derived) — own re-verification BLOCKED on container access.**

---

## §4 R3 — fallback anchor (Task 4 — design-level analysis)

**R3 question:** if no ai-title equivalent, what is the best fallback anchor?

### 4.1 Four candidates

| # | Candidate | Cost | Catch-rate | FP risk |
|---|---|---|---|---|
| 1 | **First user prompt (`head -c 120`)** | cheap, deterministic | HIGH on substantive sessions | LOW — semantically meaningful by construction |
| 2 | **Hardcoded "session recap" string** (current `aif_msg_eot_anchor_fallback`) | zero | ZERO — anchor becomes decorative | ZERO (but useless) |
| 3 | **Most-recent user prompt (last user turn)** | cheap | captures drift | MEDIUM — anchored on transient question, not session goal |
| 4 | **First 120 chars of first user prompt + session_id suffix** | cheap | HIGH + disambiguates parallel sessions | LOW |

**Risk noted for Candidate 1:** long preambles ("please help me with…") push real content past 120 chars. Mitigation: skip leading politeness tokens (cheap grep prefilter) — but that's an I-phase concern, not R-phase.

### 4.2 CC's own fallback chain (cross-reference)

`end-of-turn-reminder.sh:32-36` already implements a 3-tier fallback:

1. **L32** ai-title grep → if non-empty, use it.
2. **L34** first user prompt extraction (jq on `"type":"user"` content) → if non-empty, use it (truncated `cut -c1-120`).
3. **L36** `aif_msg_eot_anchor_fallback` — hardcoded string.

**The ZCode-equivalent design removes only tier 1** (ai-title absent on synthetic per step-1 Part C). Tiers 2 and 3 already exist and already match Candidates 1 and 2 respectively. **ZCode anchor design is therefore not "invent a new anchor" — it is "promote tier 2 to primary on the ZCode path."**

### 4.3 Provisional R3 recommendation (per `phase-research-coverage.md §1.12` — lead with reasoned pick)

**Recommend Candidate 1 (first user prompt)** as the natural ZCode anchor — it is what CC's L34 already falls back to when ai-title is absent, so promoting it to primary on the ZCode path **preserves CC's own fallback semantics**, just makes them the default. **Candidate 4** is the stronger variant if operator UX shows session-disambiguation matters (parallel sessions in one terminal). Operator decision: Candidate 1 vs Candidate 4.

**Wrong if:** (a) rollout has a real `sessionTitle`-shaped field (R2 rubric A surfaces one) → use that instead of any fallback; (b) first-user-prompt turns out to be PII-sensitive in operator telemetry → Candidate 2 stays as a safe default.

---

## §5 3-fork analysis (Task 5)

Per kickoff §1 design forks + §3 acceptance "3 forks analyzed: implementation cost, catch-rate, false-positive risk."

### 5.1 Fork comparison table

| Fork | Implementation cost | Catch-rate (multi-turn guard) | FP risk | Depends on R1 own-verified? | Depends on R2 own-verified? |
|---|---|---|---|---|---|
| **9A rollout-based** | ~50-80 LOC rewrite of guard to read `~/.zcode/cli/rollout/model-io-*.jsonl` (kickoff §1 estimate); plus rollout-discovery + parse-error handling | HIGH **if** rollout schema stable | MEDIUM — rollout schema is upstream-controlled, may drift on ZCode update | **YES** — needs own R1 verification; step-1's inferred evidence insufficient for a load-bearing rewrite | NO (independent of anchor) |
| **9B declare impossible + degrade** | ZERO code; ~1 line of documentation in `render-harness-config.mjs:247-258` loud-declaration block | ZERO — idle-suppression guard stays structurally inert on ZCode synthetic | ZERO — no new code paths | NO (works whether or not rollout has multi-turn) | NO |
| **9C hybrid (synthetic anchor + rollout multi-turn)** | ~30-50 LOC for rollout-arm only; anchor stays on synthetic via R3 Candidate 1/4 | HIGH on multi-turn guard (if rollout schema stable); anchor stays weaker than CC's ai-title but functional | MEDIUM (rollout schema) + LOW (synthetic anchor) | **YES** for multi-turn arm; NO for anchor arm | NO |

### 5.2 Reasoned recommendation (per `phase-research-coverage.md §1.12`)

**Recommend 9B as the default** unless operator has evidence that idle-suppression false-fires on ZCode sessions.

**Reasoning:**

- The guard's purpose is suppressing repeat-pings after a recap (end-of-turn-reminder.sh:143-150). If ZCode sessions don't generate repeat-pings (the typical case for an operator-driven session with a human in the loop), the guard's absence is a **non-issue**, not a regression.
- **9A is over-investment** for a guard that may be unneeded on ZCode; bundles full rollout-parsing fragility with no graceful degradation. The "~50-80 LOC" estimate is also a floor — rollout schema discovery + parse-error handling typically double the LOC in practice.
- **9C is the upgrade path** if/when telemetry shows repeat-pings occurring — it preserves the anchor work done in step-1's Part C while opening the multi-turn arm conditionally. Ship 9B now, 9C later if telemetry justifies.
- **9A's load-bearing dependency on R1 own-verification** is a blocker in this container — neither this S9 session nor step-1 directly verified rollout multi-line-per-session empirically (§3.1 above). Shipping 9A on inherited-INFERRED evidence would violate `phase-research-coverage.md §1.7` backward-check (the rewrite would be load-bearing on an unverified claim).

**Provisional flag:** the recommendation is **provisional** pending R1 own-verification — forks 9A and 9C's cost/risk grow if rollout schema is unstable, which can only be checked with bundle/rollout access. **Operator decision required.**

### 5.3 What would falsify this recommendation

- **Telemetry evidence** of repeat-pings on ZCode sessions → 9B becomes the wrong default; upgrade to 9C.
- **R2 rubric surfaces a real `sessionTitle`-equivalent** → R3 Candidate 1 loses to "use the real field"; 9C anchor arm becomes strictly better than 9B.
- **Rollout schema is documented stable upstream** → 9A's MEDIUM FP risk downgrades to LOW; cost/benefit shifts.

---

## §6 Park invocation (Task 6)

Per kickoff §4 park-don't-guess contract — MANDATORY. Fork decision parked via `park.ts`:

```bash
park.ts --question "Multi-turn + ai-anchor — Fork 9A rollout-based / 9B degrade / 9C hybrid.
R1: INHERITED-INFERRED YES (step-1 bundle-derived; own re-verification BLOCKED — no rollout access in S9 container).
R2: LIKELY no ai-title equivalent (step-1 empirical); 6-concept deferred-verification rubric in §2.4.
R3: Recommend Candidate 1 (first user prompt, CC's L34 fallback promoted to primary on ZCode).
Recommendation: 9B as default (guard's absence is a non-issue if ZCode sessions don't repeat-ping); 9C as upgrade path on telemetry evidence; 9A over-investment.
Operator decision needed.
Research-patch: docs/meta-factory/research-patches/2026-07-18-zcode-parity-s9-multiturn-anchor.md"
```

**Parked-question ID:** `8c8d6da4-c739-45a8-a3d2-2ccc4c20add2` (handoff task ID; `parked: paused=true` confirmed by park.ts).

---

## §7 §1.7 self-reflexive note (T15)

- **Forward-check:** this patch complies with `no-paid-llm-in-ci.md` (R-phase, zero code/CI touched), `build-first-reuse-default.md` (REFERENCE verdict — cites step-1's evidence rather than re-running the bundle search; the only "new" machinery is the §2.2 search rubric, which is `grep`, not a capability commit), `doc-authority-hierarchy.md §2-§3` (this file carries an Authoritative-for header and lives under the folder-level authority of `docs/meta-factory/research-patches/`).
- **Backward-check:** this R-phase produces a research-patch only. No source files modified, no fixtures touched, no hooks edited (kickoff §8 anti-scope honoured). Existing `make self-audit` (311 tests) stays green by construction.
- **Self-application (T15):** this patch audits itself above — §1 verifies the container-reality stop condition live-true; §3.1 honestly downgrades step-1's "verified YES" to "inherited-INFERRED YES" rather than carrying the over-claim forward (the counter-pattern `#claim-from-memory-not-source` from `phase-research-coverage.md §4`, caught by reading the step-1 patch rather than trusting the kickoff's wording).
- **Trap enumeration (kickoff §6):** T3 (R-questions have evidence — step-1 patch + container probes cited verbatim), D2 (synthetic ≠ rollout — §3.1 explicitly distinguishes the two sources), D5 (verdict ≠ implementation — §5 ships a fork analysis with PARK, not code).

---

## 🟢 In plain words

- **R1 (multi-turn in rollout):** INHERITED-INFERRED YES from step-1's bundle evidence; **own re-verification BLOCKED** — `~/.zcode/` not mounted in this container. Honest downgrade from kickoff's "verified YES".
- **R2 (ai-title equivalent):** LIKELY absent (step-1's 0-occurrence evidence); 6-concept deferred-verification rubric ready for a bundle-reachable container. Not confirmed in S9.
- **R3 (fallback anchor):** Recommend Candidate 1 (first user prompt) — already exists as CC's L34 fallback; promoting it to primary on ZCode preserves CC's own semantics.
- **3 forks:** 9A (rollout rewrite, ~50-80 LOC, blocked on R1), 9B (declare impossible + degrade, ZERO code), 9C (hybrid, ~30-50 LOC for rollout arm).
- **Recommendation:** **9B as default** (guard's absence is a non-issue if no repeat-pings); 9C as upgrade path on telemetry; 9A over-investment.
- **Parked-question ID:** `8c8d6da4-c739-45a8-a3d2-2ccc4c20add2` (park.ts returned `paused=true`).
