# Kickoff — triage-kernel-v2 umbrella (stage router)

<!-- host-verify: none — router document only; it dispatches no work itself, and every stage kickoff it routes to (kickoff-s1.md §7 today) declares its own host-verify contract -->


Umbrella router for the corpus-measured materiality classifier ("the judge"), per
[2026-08-10-triage-kernel-v2-design.md](../../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md)
(spec merged #1376). This file exists so `/pipeline triage-kernel-v2` resolves the umbrella
(the skill's helpers scan `<umbrella>/kickoff.md`); per-stage work is defined by the stage
kickoffs it routes to. Rigor label (L0): `research-grade` (design §1).

## §0 Where the family stands (do not rebuild what is live)

The advisor/bus/judge family is mostly LANDED as live policy — this umbrella owns ONLY the
judge. Already on staging: advisor-pattern spec + reviewer-discipline §6 + effort-worthiness
rule (#1374); night Part-I policy (#1346); Stop-hook context-arm S2a (#1349); project
`/reviewer` skill (#1375). NOT owned here (recorded, spec-homed, partly operator-gated):
advisor spec §8 items 6 (ask-file pre-push arms) / 6b (L0 rigor-label kickoff check —
different channel), 7-numbers (budget calibration),
9 (consumer-delivery stage), 10 (P6 transport matrix — needs an app restart before first
live advisor use); S2b PreCompact writer (gated on operator F8); session-bus Part-II
ratification (operator fork: measure one live night vs build).

**S0 gate record (W-2):** probe DONE + MERGED (#1380, squash `7daf16a15533`, 2026-08-11) —
blind C1 sonnet rubric 93.5% vs C0 grade-map 64.5% against operator-adjudicated truth,
discordant 9:0, exact McNemar p=0.0039, recovery 81.8%, breakage 0.0% → **S0 = GO**, S1-S5
unlocked ([research patch](../../../docs/meta-factory/research-patches/2026-08-11-triage-kernel-v2-s0-probe.md)).

## §1 Stage plan (design §9; sequential — each stage gates the next)

| Stage | What | Kickoff | Status |
|---|---|---|---|
| S0 | Probe (C1 vs C0, operator labels) | — (in-session, gate-resolved) | DONE — #1380 |
| S1 | Full corpus assembly (6 population CSVs, extraction contract, leakage probe) | [kickoff-s1.md](kickoff-s1.md) | READY to dispatch |
| S2 | Cold blind re-label, three axes | authored after S1 merges | pending S1 |
| S3 | Adjudication (advisor batch + operator stratified slice ~15, per-axis κ/PABAK) | authored after S2 merges | pending S2 |
| S4 | Bench: promptfoo + shim + C1/C2 vs C0 + report. **Capability commit: promptfoo devDependency + `Prior-art:` + SSOT id ≥250 in the SAME commit** | authored after S3 merges | pending S3 |
| S5 | Landing PR: winning layer(s) as protocol text (reviewer-discipline §6 + fidelity-auditor + advisor) + spec status flip + `/self-reflection` | authored after S4 merges | pending S4 |
| S5b | §7 disposition-vocabulary line in arch/SKILL.md — separate micro-PR | any time post-gate | open |

Stage-kickoff convention: each is authored at its turn by the dispatching session (fresh
inputs from the just-merged stage; the S2 kickoff MUST carry the whose-axis rubric
reformulation question — the S0 probe found `whose=reviewer` degenerate 32/32). Every stage
kickoff quotes its predecessor's merged result (the W-2 pattern) and lands on `staging`
BEFORE dispatch (kickoff-staging-placement.md §1).

## §2 Dispatch rules

One stage = one executor session (single-owner-per-stage). Before dispatching any stage:
`SLUG=triage-kernel-v2 bash .claude/skills/dispatcher/helpers/probe-inflight.sh` → require
`VERDICT: FRESH`. Executor tier per design §9: mid (Opus) for S1, S2, S4; **S3 is NOT a
factory job** — advisor session + operator stratified slice (benching ground truth must not
come from the tier being benched); S5 is a session-scale landing. L4 budgets per stage live in the design §9 table (2 rounds → ASK). Umbrella close:
the session merging S5 writes `done.md` here (umbrella closure convention).

## §3 AI-traps (per [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

Active traps for this umbrella: **T5, T8, T15, T19** at the router level (stage kickoffs
carry their own full enumerations — kickoff-s1 §6 lists T1 T3 T5 T8 T9 T10 T14 T15 T19 +
T-TK2-A/B/C). Domain-specific:

- **T-TK2-D — router scope creep.** The router is the convenient place to «just add» work
  from the advisor/bus residue (§0 list) because it names it. Counter: this umbrella owns
  S1-S5b ONLY; residue items keep their own homes and gates — a stage kickoff referencing
  a §0 residue item as its own deliverable is a defect.

## §4 Invocation

```text
/pipeline triage-kernel-v2
```

→ resolves this router; the launch table should route to the current READY stage kickoff
(S1 today). Direct alternative: dispatch S1 per kickoff-s1.md §8 (factory or session).
