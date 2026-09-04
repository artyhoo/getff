# arch-v2-context-pipeline — CLOSED 2026-08-08
- Final PR: #1308

Final act: S-K scoping → ADR-8 A/B retired (deviation #3, operator-ruled). Every other stage
was already merged; this PR records the retirement, ships the replacement watch, and closes
the umbrella.

## Stage ledger (all delivered)

| Stage | Outcome |
|---|---|
| S-A / S-B / S-C | merged (S-B #1198; S-C verdict #1197 — L2 DEFER/null, SSOT #233) |
| S-D | CLOSED-NULL 2026-08-06 per SSOT #234 (no stage `done.md` by design — see kickoff §S-D) |
| S-D′ | #1290 (`be087d3585`) — subtraction maps, 8 agents slimmed −20.5% |
| S-M | #1302 (`6878c41f50`) — Tier-0 swap, resident set 43,135 → 30,481 B (registry measure) |
| S-E | #1237 — L1 budget gate + config asserts (fidelity GO round 4) |
| S-F | #1269 — three channel-truth small-fixes (item 4 consumed by S-E's P2) |
| S-G | #1228 — economy small-fixes 2 (P5-P8, P12) |
| S-H | #1239 + #1249 — host-side measurements + P14 addendum |
| S-I | #1229 — skill-description trims + trigger inventory |
| S-L | #1263 — recalculation (4 B/tok falsified → band; forks #5/#6/#7 decided #1266) |
| S-K | **RETIRED at scoping** — this closure (ADR-8 deviation #3, below) |

## ADR-8 deviation #3 — the A/B experiment retired at scoping (operator-ruled)

**Decision path.** The operator pre-registered the rule at the scoping fork (2026-08-08):
measure historical review-defect-count noise first; retire if variance is large. Measurement
(11 most recent dispatched-stage harvests, counts from `## Review findings` in the PR bodies):

| PR | defects found by review before merge |
|---|---|
| #1290 | ~13 (r1: C1-C4 + I1-I5 + M1-M3; r2: +3) |
| #1249 | ~10 (ten cold rounds, nine REVISE) |
| #1237 | 6 (two STOP rounds) |
| #1263 | ~5 (3 MAJOR + 4 sweep) |
| #1302 | 3 · #1239 ~2 · #1270 ~2 · #1272 1 · #1284 1 · #1285 0 · #1269 0 |

Mean ≈ 3.9, SD ≈ 4.3, CV ≈ 1.1. Power at the pre-registered window (10-vs-10 arms):
detectable Δ ≈ SD·√(16/10) ≈ **5.4 defects — larger than the entire mean**, so the A/B could
only detect a catastrophic (>2×) degradation; task-type variance dominates reviewer-quality
variance (#1249 = 10 rounds on a research stage; #1269/#1285 = 0 on small fixes). The window
would have filled cross-umbrella in ~5-6 weeks (rate ~3 station-runs/week at counter 3/20)
while taxing every dispatch (arm marking, dual agent-variant maintenance, per-harvest ledger
rows) to reach a likely-INCONCLUSIVE verdict.

**Feasibility was NOT the ground — recorded so the retirement is honest.** The rev-6 blocker
(task id postdates the dispatch prompt, `AifHandoffBackend.ts:231-249`) dissolved at scoping:
the server audit found a paused task's `description` fully editable — `updateTaskSchema`
carries both `description` and `paused` (aif-handoff `packages/api/src/schemas.ts:89-117`),
the `PUT /tasks/:id` handler has no status/paused gate (`routes/tasks.ts:448-529`), and the
data layer is an unguarded update (`packages/data/src/index.ts:991`). The arm marker would
have fit into the existing unpause PUT. The experiment was retired because it could not
answer its question, not because it could not be built.

**Token cost — ADR-8's other metric — needs no experiment:** it is measured at rest
(S-D′ −20.5% agent bytes; S-M registry 43,135 → 30,481 B), deterministic and already banked.

**Replacement mechanism:** [`calibration.md`](calibration.md) **Item 2-R** — incident-triggered
rollback watch (1 miss traceable to a dropped block → one-block restore; 3 → full un-slim +
reopen ADR-8 with data). Class precedent: S-M watch-list (#1302 W-1..W-6), digest rollback
trigger (`ai-laziness-digest.md`). Detection = the named cold seats (fidelity + cold review),
per `attention-is-not-a-mechanism.md §1(b)`. T14 bound stated in the ledger: zero incidents ≠
proof of safety.

**Retired with the experiment:** the four §6 entry criteria (S-D′ kickoff §6), the
`KICKOFF-AMBIGUOUS` INPUT-CONDITION residual (a baseline for a retired A/B has no consumer),
and W-7's spec-§0.2-staleness obligation for S-K consumers (no consumer remains).

## Living residue (owners named, nothing silently dropped)

- **Item 2-R watch** — owner: every future harvesting session; ledger note on incident.
- **ADR-5 shadow cohort (2/5) + ADR-6 demotion gate** — unaffected, stay live in the ledger.
- **S-D′/S-M watch-lists** — live in their PR bodies (#1290 W-1..W-7, #1302 W-1..W-6; W-5
  index headroom 8 B is the sharpest tripwire).
- **№5-C falsifier** (n=2, readings 6.8% apart) — a third first-turn-vs-`/context` reading
  settles the two-term naming; owner: next measurement session (recalc-stage handoff).
- **S-L §6 leftovers** — `scripts/measure-session-start-tokens.sh` unbanded;
  `tests/install-sh/meta-all-wired.test.sh:23` population gap — named follow-ups outside this
  umbrella (recalc-stage handoff).
- **S-F's consumed item 4** — verified at token-audit S2 acceptance (that umbrella's charter).
