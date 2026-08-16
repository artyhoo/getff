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
| S1 | Full corpus assembly (6 population CSVs, extraction contract, leakage probe) | [kickoff-s1.md](kickoff-s1.md) | DONE — #1384 |
| S2 | Cold blind re-label, three axes | [kickoff-s2.md](kickoff-s2.md) | DONE — #1386 |
| S3 | Adjudication (advisor batch + operator stratified slice, per-axis κ/PABAK) | [kickoff-s3.md](kickoff-s3.md) (in-session record) | DONE — in-session 2026-08-16, advisor + operator slice |
| S4 | Bench: promptfoo + shim + C1/C2 vs C0 + report. **Capability commit: promptfoo devDependency + `Prior-art:` + SSOT id ≥250 in the SAME commit** | [kickoff-s4.md](kickoff-s4.md) | READY — kickoff authored 2026-08-16 |
| S4b | **Outcome audit** (operator direction 2026-08-16): walk all 151 rows against the live tree — what was actually done, does it hold, did the absence cost anything. Second, non-judgment truth axis + prioritised drift register. Repair is a separate umbrella | [kickoff-s4b.md](kickoff-s4b.md) | READY — runs after S4 merges |
| S5 | Landing PR: winning layer(s) as protocol text (reviewer-discipline §6 + fidelity-auditor + advisor) + spec status flip + `/self-reflection` | authored after S4b merges | pending S4b |
| S5b | §7 disposition-vocabulary line in arch/SKILL.md — separate micro-PR | any time post-gate | open |

Stage-kickoff convention: each is authored at its turn by the dispatching session (fresh
inputs from the just-merged stage; the S2 kickoff MUST carry the whose-axis rubric
reformulation question — the S0 probe found `whose=reviewer` degenerate 32/32). Every stage
kickoff quotes its predecessor's merged result (the W-2 pattern) and lands on `staging`
BEFORE dispatch (kickoff-staging-placement.md §1).

## §2 Dispatch rules

**S4 and S4b are a pair, run in that order** (operator direction 2026-08-16). S4 measures judgment
against judgment; S4b adds the anchor design §5b.1 says the bench lacks — what the repository
actually did about each finding. The order is load-bearing, not cosmetic: an auditor with tools
sees the tree and could infer materiality from it, so the bench must be measured before that view
exists. Repair of what S4b finds is a **separate umbrella**, never folded into either stage.

### Remaining-stage route (operator-ratified 2026-08-16 — follow it, do not re-derive)

| Session | What runs | Seat |
|---|---|---|
| **A** | Cold review of [kickoff-s4.md](kickoff-s4.md) → one batched correction PR if it returns REVISE → dispatch S4 to aif → **host** harvests | reviewer = mid tier (verifier); executor = factory |
| **B** | *After S4 merges:* cold review of [kickoff-s4b.md](kickoff-s4b.md) → dispatch S4b to aif → **host** harvests | same |
| **C** | Synthesis of both axes → S5 landing PR | top tier (synthesis is its role) |

Three rules this route encodes, each with its reason:

1. **A cold seat reads each stage kickoff before its dispatch.** Not ceremony: S4's kickoff shipped
   with the judge model given as a tier word, which resolved to the wrong model and which **no
   declared arm could catch** — found by an incidental read an hour after merge and fixed in
   #1394. Feed the seat the kickoff and the spec only, never this router's narrative or the
   authoring dialogue; a seat that has read the story cannot audit it (T19 /
   [reviewer-discipline.md](../../rules/reviewer-discipline.md)).
2. **Do NOT review both kickoffs in session A.** S4's result can change S4b — the expensive seat
   runs on the final artifact ([cold-seat-economy.md §2](../../rules/cold-seat-economy.md)).
3. **The top tier never executes a stage here.** S4b is ~500-1200 tool calls of volume
   verification, and the top tier is an external review seat only, never the in-container dispatch
   runtime — ratified in #1335, `runtimeProfileId` / `modelOverride` stay unset. Its role in this
   umbrella is session C: synthesising what the factory measured. Re-opening this per stage is
   explicitly out of scope.

**Judge model ≠ executor tier.** Inside the bench, C1 and C2 run on `--model sonnet`, pinned by
name because the corpus's cold rater was sonnet ([kickoff-s4.md](kickoff-s4.md) §3.4). That is a
comparability constraint, not a routing choice, and the tier vocabulary must not be used to
resolve it.

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
(**S4** today). Direct alternative: dispatch S4 per [kickoff-s4.md](kickoff-s4.md) §9 — that §9
carries the mechanical pre-dispatch order (in-flight probe · aif base-clone fast-forward ·
kickoff-on-staging check). **Run §2's session-A cold review first** — the route above is
operator-ratified and the dispatch is its second step, not its first.
