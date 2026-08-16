# Kickoff S4 — bench (triage-kernel-v2)

> **Dispatch input.** Stage S4 of the [triage-kernel-v2 router](kickoff.md) §1. Authored fresh
> by a session that did not execute S3 (kickoff-s1/s2/s3 §8/§5 chain). Protocol authority: design
> spec [§4 · §5 · §5b · §9 · D-K3/D-K5/D-K8](../../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md)
> — this kickoff instantiates it and never redefines it. Rigor label (L0): `research-grade`
> (design §1). Executor tier: **mid** (design §9). Routing: **factory (aif) or session** — §9
> below is live only for the factory route.

## §0 Predecessor result (W-2 pattern — S3 as merged)

S3 CLOSED — PR #1389, squash `7425346f0b`, 2026-08-16. Deliverables:
[s3-final.csv](../../../docs/meta-factory/triage-corpus/s3-final.csv) (151 adjudicated rows —
**this is the bench truth**), [s3-adjudication.csv](../../../docs/meta-factory/triage-corpus/s3-adjudication.csv)
(per-row advisor rationale), [scripts/triage-s3-agreement.mjs](../../../scripts/triage-s3-agreement.mjs)
(stats + fail-closed arms A-F), corpus README §S3. Cold fidelity GO round 1.

Truth distribution, 151 rows: `class_final` MATERIAL=111 / IMMATERIAL=40 · `layer_final`
implementation=80 / plan=39 / design=19 / architecture=13 (`idea` absent from the corpus) ·
`whose_final` reviewer=136 / advisor=12 / operator-floor=3 · `status` agreed=55 / adjudicated=96.
Class κ start-vs-cold 0.487 (raw 0.753, PABAK 0.507, binary n=73); D-K2 falsifier not fired.

**Binding rulings inherited (do not re-open):**

- **Whose axis is `judgment-only, not corpus-validated`.** S0 measured it degenerate (32/32
  reviewer); S2's ONE permitted re-cut moved it to 86.1%; adjudication moved it *back up* to
  90.1%. A second re-cut is a PARK for the operator, never a retry (T-TK2-F). §3.7 below states
  exactly what S4 may and may not do with this axis.
- **Whose semantics:** whose = the REQUIRED authority class, never the historical answerer;
  `operator-floor` = goal / ownership / spend only (operator slice ruling, journal Entry S3-1 in
  [kickoff-s3.decisions.md](kickoff-s3.decisions.md)). Four rows carry `SLICE-CORRECTED`; do not
  relabel them back.
- **`s3-adjudication.csv --slice` is pre-correction-seeded.** Re-running `--slice` today yields a
  different FLOOR set than the 22-row slice recorded in [kickoff-s3.md](kickoff-s3.md) §2. That
  mismatch is **recorded and intended** — do not "fix" it (S3 watch-item W-3).

## §1 Objective

Run the exam. Score the three candidate reference points — **C0** (deterministic bar), **C1**
(per-row rubric judge), **C2** (grouped self-review pass) — against `s3-final.csv` per design §4,
apply the §5 acceptance rule per axis, and publish a bench report as a research patch with its
validity limits attached. «No layer beats C0» is a legitimate, publishable outcome (D-K4
falsifier) — the stage succeeds by measuring honestly, not by finding a winner.

S4 ships **no protocol text**. Deploying the winner is S5's job; S4 hands S5 numbers and a verdict
line per axis.

## §2 Permitted files — what may be created and edited

**Create:**

- `promptfoo` bench config + shim under `scripts/triage-kernel-v2-bench/` — `scripts/` is where
  D-K3 already places the fallback scorer. Do not open a new top-level directory for it, and see
  the not-permitted list below for where it must not go.
- `scripts/triage-s4-score.mjs` — the S4 scorer + `--check` arms (§3.9).
- Candidate raw artifacts under `docs/meta-factory/triage-corpus/`: `s4-c1-<model>.json`,
  `s4-c2-<model>.json` (raw per-row / per-group judge output with provenance stamps, same shape as
  `s2-cold-sonnet.json`).
- `s4-bench.csv` — the per-row scored join (id · truth axes · C0 · C1 · C2 · scored-subset flags).
- The bench report: `docs/meta-factory/research-patches/2026-08-<dd>-triage-kernel-v2-s4-bench.md`.
- Corpus README **§S4 section** + its Files-table rows (the `rows=<n>` tokens are gated by
  `triage-s2-labels-check.mjs` arm D — a new CSV without its token reddens the contract).

**Edit:** `package.json` (the promptfoo devDependency + its lockfile) — this is the stage's
capability commit, §3.1. `README.md` of the corpus, as above.

**Not permitted — any temptation here is a PARK (§9):**

- Anything under `packages/` — zero consumer runtime code ships from this contour (design §1),
  and the bench is operator-side by construction.
- Any population CSV (`audit-1369`, `s4-round7`, `arch-reviews`, `kickoff-loops`, `td-m3`,
  `research-forks`), any S0 file, `s2-labels.csv`, `s2-rubric-whose.md`, `s3-adjudication.csv`,
  `s3-final.csv`, or anything under `sources/`. **The truth is frozen before the bench runs** —
  a bench that edits its own answer key measures nothing. Arm F (§3.9) enforces this by blob hash.
- `scripts/triage-corpus-probe.mjs`, `triage-s0-run.mjs`, `triage-s0-score.mjs`,
  `triage-s2-labels-check.mjs`, `triage-s3-agreement.mjs`. Reuse them by **import**, never by
  edit. If a needed helper is not exported, copy the ~10 lines into the S4 scorer with a comment
  naming the source — cheaper and safer than reopening a frozen script.
- The design spec, any rule, any sibling kickoff (including the `#autonomous-self-egress`
  prohibition in §9, which stays a per-stage instruction here — the global form is an open
  operator fork, CLAUDE.md §PR strategy).
- `reviewer-discipline.md`, `agents/fidelity-auditor.md` — those are S5's surfaces.

## §3 Method

### §3.1 Runner — promptfoo, and the capability commit (W-6, armed)

D-K3 is **ratified ADOPT** and was an explicit operator correction of the authoring session's
hand-rolled default (design §10 P5) — do not re-open it. S4 is the scale-up the S0 gate deferred
it to. Use promptfoo as the matrix/caching/assertion runner over an `exec:`-shaped provider that
shells `claude -p`, per design §4.

**The recorded fallback (D-K3) is a fallback, not a first choice.** Falling back to a plain
deterministic scorer is permitted only *after* promptfoo has actually been run and failed on long
or grouped prompts, with the failure and its reason recorded in the bench report. "It looked like
it wouldn't work" is not a fallback trigger; a pasted error is.

**The capability commit — all four in the SAME commit, or the pre-push hook rejects it:**

1. `promptfoo` added to `devDependencies` (dev-only; it never enters CI — [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)
   and design §6 both hold).
2. A `Prior-art:` trailer in that commit's message body.
3. A **new** SSOT row in [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)
   with `Verdict` + `Rationale` + `Trigger to revisit`. Highest existing id is **249**
   (`grep -oE '^\| [0-9]{1,3} \|' docs/meta-factory/prior-art-evaluations.md | sort -n | tail -1`),
   so this is **#250** — matching the router's `id ≥250`.
4. The rationale MUST carry an explicit **T16 problem-class check against SSOT #53**, which
   already evaluated promptfoo and returned **BUILD** — for a *different* problem class
   (deterministic scoring of pre-existing CC transcripts with no paid generation). S4's class is
   drive-generation-then-grade over a labelled corpus, which is promptfoo's core. State both
   classes and why the verdict differs; a new row that ignores #53 reads as an unnoticed
   contradiction in the register.

If promptfoo cannot be installed at the destination, that is a **PARK**, not a silent fallback —
probe first (§5), and report the probe output.

### §3.2 The shim + the blindness contract

The shim builds the bench input from the population CSVs and **strips every label-bearing
column** before anything reaches a judge: `class_start`, `orig_grade`, and every `*_cold` /
`*_final` field. Judges see `finding` + `context` only (`context` is mechanical provenance —
PR#, round, cited path).

Two independent leakage paths, both already closed upstream and both re-asserted here:

- **Column path** — the shim's projection (arm B, §3.9).
- **Text path** — `finding` was grade-stripped at extraction in S1 (design §2 grade-strip
  normalization). Arm B re-scans the *built bench input* for surviving grade tokens and
  finding-ID patterns rather than trusting that S1 held.

**`provenance: author-cell` rows never enter the bench** (5 rows: `td-m3` 2, `research-forks` 3 —
design §2, §5b.5). Labelable population = **151**. They are enumerated in the report for T14
honesty and described, never scored.

### §3.3 C0 — the deterministic bar, and a correction to the spec's pre-read

C0 = `orig_grade` mapping: `BLOCKER|MAJOR → MATERIAL`, `MINOR → IMMATERIAL`; `orig_grade: none`
rows excluded (D-K8). Scored subset re-derived, not inherited.

**Authored pre-read, computed on the merged tree at `7425346f0b` (2026-08-16):** scored subset
**131/151 = 86.8%** (well above D-K8's ~70% falsifier, so C0 stands and no majority-class fallback
is needed); C0 class accuracy vs `class_final` **0.733** (cells mm=64 mi=5 im=30 ii=32); C0's own
**MATERIAL-miss-among-raised-findings = 30/94 = 0.319**. Command that produced it:

```bash
node -e "import('./scripts/triage-corpus-probe.mjs').then(async m=>{const fs=await import('node:fs');const D='docs/meta-factory/triage-corpus/';const P=['audit-1369','s4-round7','arch-reviews','kickoff-loops','td-m3','research-forks'];const rows=P.flatMap(n=>m.parseCsv(fs.readFileSync(D+n+'.csv','utf8')));const fin=new Map(m.parseCsv(fs.readFileSync(D+'s3-final.csv','utf8')).map(r=>[r.id,r]));const s=rows.filter(r=>fin.has(r.id)&&r.orig_grade&&r.orig_grade!=='none');let mm=0,mi=0,im=0,ii=0;for(const r of s){const c0=r.orig_grade==='MINOR'?'IMMATERIAL':'MATERIAL',f=fin.get(r.id).class_final;c0==='MATERIAL'?(f==='MATERIAL'?mm++:mi++):(f==='MATERIAL'?im++:ii++);}console.log({n:s.length,acc:(mm+ii)/s.length,miss:im/(mm+im),mm,mi,im,ii});})"
```

**Re-derive it. Do not inherit it** (`#claim-from-memory-not-source`). If your re-derivation
disagrees with these numbers, **PARK** — a moved substrate is a bigger finding than the bench.

**This falsifies the spec's own honest pre-read, and the report must say so.** Design §4 (r2
NEW-M4) expected C0 at «roughly 0.8-0.9 class-agreement» and named its falsifier: *«Wrong if
adjudication moves `class_final` sharply away from the original grades.»* It did — measured 0.733
with a 31.9% MATERIAL-miss. Consequence: the ESCALATED-2 «no layer beats C0» concern is weaker
than the spec assumed, and C0's miss-rate reference in §5(b) is a *high* bar to not exceed rather
than a tight one. Record this as a finding in the report; it does not change the acceptance rule.

For the **layer** axis the bar is the majority-class predictor (`implementation`, 80/151 = 53.0%).
For **whose** the majority bar is `reviewer` at 136/151 = 90.1% — see §3.7.

### §3.4 C1 — per-row rubric judge

One fresh `claude -p` per row, no tools, no session state, mid tier — the S2 shape. Rubric = the
**shipping** rubric: the S0 binding yardstick + four-test card + premise-11 layer question, with
the whose question in its S2 re-cut form ([s2-rubric-whose.md](../../../docs/meta-factory/triage-corpus/s2-rubric-whose.md)).
Output contract: exactly one line, `class=<...> layer=<...> whose=<...>` (design §4). Unparsed
rows are **re-run**, never hand-filled (T-TK2-E, inherited); a row that will not parse after a
re-run is a PARK.

### §3.5 C2 — grouped self-review pass

A producer-shaped seat re-grades a whole finding LIST at once (rows grouped by source loop — the
shim groups; ~15-25 grouped calls). Measured **as delta over C1**, never as a standalone winner:
the question C2 answers is «does a second pass add accuracy worth its cost?» (design §4). Report
the delta with its cost in calls, and state plainly if the delta is inside the noise floor.

### §3.6 Scoring, the acceptance rule, and the confounding S4 must measure

Per axis, candidate vs truth on the scored subset: accuracy, per-class precision/recall, κ and
PABAK, and **MATERIAL-miss-among-raised-findings** (the honest name — §5b.3: this is measured only
among findings that were RAISED; defects never raised are outside any such corpus).

**Class axis — the shipping gate (D-K5).** A candidate ships only if (a) it beats C0 beyond the
noise floor — the CI on the paired difference excludes zero, equivalently McNemar p < α; report
the discordant-pair counts and the binomial CI; the rule FORM is statute, α is config — **and**
(b) it does not increase MATERIAL-miss relative to **C0's own miss-rate on the same scored
subset** (0.319 per §3.3). Both legs, or it does not ship. At n=131 the minimum detectable
difference is roughly ±9pp; say so.

`scripts/triage-s0-score.mjs:43` already implements exact McNemar and the κ/PABAK shapes. **Import
or copy them; do not re-derive the statistics from scratch, and do not edit that file** (§2).

**The confounding, and the unconfounded slice — this is S4's own validity work.** C1 runs the same
rubric family, on the same model family, as the S2 cold rater whose labels the adjudication mostly
kept: `class_final == class_cold` on **122/151** rows, differing on **29** (25 of them inside the
C0-scored subset). A headline C1 number is therefore partly a measure of C1 agreeing with itself.
Design §5b.1 names provenance-sharing generically; this is the sharper, computable form, and the
report MUST carry it:

1. The headline numbers on the full scored subset (the primary result).
2. A **secondary breakdown on the `class_final != class_cold` slice** — the rows where the
   adjudicator overrode the cold rater, i.e. where truth actively contradicts the shared prior.
3. An explicit power statement on that slice: **n≈25 decides nothing finely**; it is reported as
   a direction-and-honesty check, never as a second acceptance gate. A clean-looking result at
   n=25 is «coverage insufficient to conclude» (T14), not «C1 is unconfounded».

### §3.7 The layer and whose axes — what may be claimed

- **Layer** is measurable: bar 53.0%, four live classes, no degeneracy. It may ship as
  `corpus-measured` if it beats its bar beyond the noise floor; otherwise `judgment-only`.
- **Whose ships `judgment-only, not corpus-validated` regardless of the number it scores.** Its
  own labels are judgment-only (S2 verdict, reaffirmed by S3), so a candidate cannot be validated
  against them; and a 90.1% majority bar is practically unbeatable at this n. Report the number
  descriptively, state that no candidate «wins» this axis, and carry the verdict line forward to
  S5 verbatim. Nothing unmeasured may wear a measured provenance (D-K5 / r1 TD BLOCKER-1).
- **Do not fabricate a start-vs-cold κ for layer or whose.** Those axes have no `_start` labels
  (design §3.1), so design §9's «per-axis κ/PABAK» compresses two different statistics: for class
  it is start-vs-cold; for layer/whose the only available stat is cold-vs-advisor calibration
  (0.881 / 0.907, published by S3). Candidate-vs-`*_final` κ **is** computable for all three axes
  and is what the bench reports — say which κ each number is (S3 watch-item W-5).

### §3.8 The bench report

Lands as a research patch (audit mold). It must carry, at minimum: population + scored-subset
enumeration with denominators (T10 before any rate); the per-axis result table; the acceptance
verdict per axis with its two legs shown separately; §5b validity limits carried forward **plus**
the §3.6 confounding as a new one; the §3.3 falsification of the spec's C0 pre-read; C2's delta
and its cost; the D-K3 runner decision (promptfoo, or fallback with the recorded failure); and an
explicit §self-application paragraph (T15 — this corpus contains this contour's own review
findings, so the kernel is measured on the class of findings its own design review produces,
design §12b).

Every rate states its denominator. Every «no difference» states the power behind it.

### §3.9 Fail-closed arms — `scripts/triage-s4-score.mjs --check`

Seven arms, exit 1 on any RED. These exist because the S2 round-1 review found the load-bearing
defect class here: an artifact that is *written but never read* turns a mechanical claim into bare
attention ([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).

- **A — truth join.** Every scored row's truth comes from `s3-final.csv` by `id`; every scored row
  has a matching **parsed** judge result in the candidate artifact; counts reconcile three ways
  (population ∩ labelable = 151; scored subset = 131; candidate results = 151). A score with no
  backing judge result is RED.
- **B — blindness.** The built bench input carries no `class_start` / `orig_grade` / `*_cold` /
  `*_final` key, and no surviving grade token (`BLOCKER|MAJOR|MINOR`) or finding-ID pattern in any
  cell that reaches a judge. RED on any hit.
- **C — enum validity.** Every candidate `class` ∈ {MATERIAL, IMMATERIAL}, `layer` ∈ the 5-enum,
  `whose` ∈ the 3-enum. No nulls, no defaults, no hand-written labels.
- **D — subset honesty.** The C0 scored subset is recomputed from `orig_grade != none` and equals
  the number the report states; the D-K8 falsifier (subset ≥ ~70% of 151) is evaluated and its
  result printed, not assumed.
- **E — report reconciliation.** Every headline number in the bench report (n, accuracy, κ, PABAK,
  miss-rate, discordant counts, McNemar p) is recomputed from the artifacts and must match the
  report text. This closes, for S4's own report, the gap S1 recorded as **W-7**: no gate read the
  corpus README's numbers, so a stated count could drift from its own file invisibly.
- **F — substrate immutability.** Every population CSV, every S0 file, `s2-labels.csv`,
  `s2-rubric-whose.md`, `s3-adjudication.csv`, `s3-final.csv`, and every file under `sources/` is
  byte-identical to its blob at `7425346f0b` (`git rev-parse 7425346f0b:<path>` vs
  `git hash-object <path>`). RED if the answer key moved.
- **G — capability-commit completeness.** `promptfoo` present in `devDependencies` **iff** an SSOT
  row with id ≥250 exists whose text names promptfoo. This is the one permitted edit that no other
  declared command reaches (the K6 contract-coverage emitter flags exactly that class), and the
  `Prior-art:` trailer half is already carried at push time by
  `packages/core/hooks/checks/prior-art.ts`. Both halves RED-able: a dependency without a register
  row, or a register row written while the dependency was dropped for the fallback.

## §4 Deliverables

1. Bench config + shim; `scripts/triage-s4-score.mjs` with the §3.9 arms.
2. `s4-c1-<model>.json`, `s4-c2-<model>.json` (raw, provenance-stamped), `s4-bench.csv`.
3. The bench report research patch (§3.8).
4. Corpus README §S4 + Files-table rows with `rows=<n>` tokens.
5. The capability commit (§3.1) — promptfoo devDep + `Prior-art:` + SSOT #250, one commit.
6. A single-concern PR to `staging` with the FIDELITY block per the stage-PR contract.

## §5 Inputs (read scope) — and what to probe rather than assume

Design spec **§2 · §4 · §5 · §5b · §6 · §9 · §11 (D-K3/D-K4/D-K5/D-K8) · §12b** ·
[corpus README](../../../docs/meta-factory/triage-corpus/README.md) (§S2 + §S3) ·
[kickoff-s3.md](kickoff-s3.md) · [kickoff-s3.decisions.md](kickoff-s3.decisions.md) ·
[kickoff-s2.md](kickoff-s2.md) §3 · the six population CSVs · `s2-labels.csv` ·
`s2-rubric-whose.md` · `s3-final.csv` · `s3-adjudication.csv` ·
`scripts/triage-corpus-probe.mjs`, `triage-s0-run.mjs`, `triage-s0-score.mjs`,
`triage-s2-labels-check.mjs`, `triage-s3-agreement.mjs` (read + import; never edit).

All of the above is **tracked**, so it is reachable wherever this kickoff runs. Coordination files
under `~/.claude-coordination/` are **not** tracked and may be absent — treat any of them as
optional enrichment, re-probe before relying on one, and say «could not probe» rather than
inferring content ([destination-environment-verification.md §1b](../../rules/destination-environment-verification.md)).

**Destination probes run 2026-08-16 against `aif-handoff-agent-1` — re-run them before dispatch,
because every one is operator-machine state that changes with no commit:**

| Probe | Result 2026-08-16 |
|---|---|
| `docker exec aif-handoff-agent-1 sh -c 'node -v; npm -v'` | `v22.23.1` / `10.9.8` |
| `docker exec aif-handoff-agent-1 npm view promptfoo version` | `0.122.0` — registry reachable |
| `docker exec aif-handoff-agent-1 claude --version` | `2.1.218` |
| `docker exec aif-handoff-agent-1 gh auth status` | logged in as `artyhoo` via `GH_TOKEN` |
| `docker exec aif-handoff-agent-1 sh -c 'cd /home/www/rules-as-tests-aif && gh pr view 1341 --json body'` | returns the body, exit 0 |
| `docker exec aif-handoff-agent-1 sh -c 'echo "${AGENT_MAX_REVIEW_ITERATIONS:-UNSET}"'` | `1` |

The last two matter. S2 reported `cannot-reach-gh` and parked two contract lines because the
container had no GitHub credentials; **that condition does not hold today** — `gh pr view` works
in the container as of the probe above. Do not inherit S2's park as a standing fact; re-probe. If
`gh` is unauthenticated at your run time, the corpus probe reddens with no S4 defect present —
use `--bodies <dir>` against a cached copy and say in the PR body which route you ran.

**Base-clone freshness — probed 2026-08-16, currently STALE.** The aif base clone
(`/Users/art/code/aif-handoff/projects/rules-as-tests-aif` → `/home/www`) sits at `3a10c71b47`
and carries neither the S3 deliverables nor this kickoff. Dispatch's own preflight prints
`[aif-doctor heal] 1 task(s) in-flight — skip base-refresh`, so a stale base silently hides the
substrate. Fast-forward host-side (`git merge --ff-only origin/staging`) and verify
`ls .claude/orchestrator-prompts/triage-kernel-v2/` shows `kickoff-s4.md` before dispatching.

## §6 AI-traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active canonical traps: **T1, T3, T5, T6, T10, T11, T12, T14, T15, T19, T20**
(catalogue: [§2](../../rules/ai-laziness-traps.md); [digest](../../rules/ai-laziness-digest.md)).
T6 and T14 are load-bearing for a measurement stage: every rate carries its denominator, and a
clean result at low power is «coverage insufficient to conclude», never «the axis is fine». T3
governs the report: no prose-only finding — a number, a command, or `INCONCLUSIVE-needs-human`.
T5 keeps the stage inside §2's scope. T19 is the own cold review before handoff. Domain-specific:

- **T-TK4-A — the truth edited to fit the bench.** A row whose label «looks wrong» while scoring
  is the single most tempting edit in this stage, and it silently converts a measurement into a
  self-fulfilling one. Counter: §2 freeze + arm F's blob-hash check. A disputed row is a **finding
  in the report**, never an edit — and if it changes the verdict, it is a PARK.
- **T-TK4-B — confounded agreement reported as accuracy.** C1 shares its rubric and model family
  with the rater whose labels survive on 122/151 rows; a high headline number will read as
  validation and nobody downstream can see the circularity from the number alone. Counter: §3.6's
  mandatory unconfounded-slice breakdown **with** its n≈25 power statement — reporting the slice
  without the power caveat is the same trap wearing a table.
- **T-TK4-C — the bar rebuilt after seeing the candidate.** C0 is deterministic and its subset is
  fixed by `orig_grade != none`; re-cutting the subset, dropping «unfair» rows, or switching to
  the majority-class bar because C0 scored inconveniently is fitting the exam to the student.
  Counter: §3.3's subset is re-derived **before** any candidate runs and arm D asserts it; any
  change to the C0 definition is a PARK, not a judgment call.
- **T-TK4-D — promptfoo adopted by name, not by fit (T16 in this stage's clothing).** SSOT #53
  already evaluated promptfoo and returned BUILD for a neighbouring class; writing #250 by
  pattern-matching the name reproduces exactly the register contradiction the SSOT exists to
  prevent. Counter: §3.1(4) — state upstream's problem class and ours, and why the verdicts differ.

## §7 Acceptance (host-verify)

```bash host-verify
node scripts/triage-s4-score.mjs --check
node scripts/triage-s3-agreement.mjs --check
node scripts/triage-s2-labels-check.mjs docs/meta-factory/triage-corpus/s2-labels.csv docs/meta-factory/triage-corpus/README.md docs/meta-factory/triage-corpus/s2-rubric-whose.md docs/meta-factory/triage-corpus/audit-1369.csv docs/meta-factory/triage-corpus/s4-round7.csv docs/meta-factory/triage-corpus/arch-reviews.csv docs/meta-factory/triage-corpus/kickoff-loops.csv docs/meta-factory/triage-corpus/td-m3.csv docs/meta-factory/triage-corpus/research-forks.csv
```

Line 1 is the stage's own gate — arms A-G (§3.9) over S4's own deliverables, and it is the line
that can actually go RED on an S4 defect: a score with no judge result, a leaked column, an
out-of-enum output, a drifted subset, a report number that disagrees with its artifact, or an
edited answer key. Line 2 re-runs S3's arms — RED if S4 disturbed the adjudication substrate.
Line 3 re-runs the S2 gate over the union, which also reconciles the README `rows=` tokens for
the **new** S4 CSVs via its arm D — RED if a new file lands without its count token.

**Deliberately NOT copied from S2:** a contract line that cannot fail. Kickoff-s2 §7 lines 2 and 4
could not go RED on any S2-permitted change, and S2 closed with that as an open
`KICKOFF-AMBIGUOUS` (`#contract-that-cannot-fail`,
[destination-environment-verification.md §4](../../rules/destination-environment-verification.md)).
Each line above asserts something S4 can break. Note the corollary: the S0 frozen-record probe
line that S1-S3 carried is **absorbed into arm F**, which checks every frozen file by blob hash
rather than re-running a probe whose failure mode S4 cannot reach.

Runner: `bash scripts/host-verify.sh .claude/orchestrator-prompts/triage-kernel-v2/kickoff-s4.md`
(`--list` comes FIRST if listing). Plus `bash scripts/run-local-ci-sweep.sh` green — it reports
`WARN-SKIP md-ci-only`, so a green local sweep does **not** cover markdownlint; CI does.

Dry-run both PR-body gates before `gh pr edit` — each red costs a CI cycle. Fidelity: `npx tsx` a
short script importing `checkPrBodyFidelity` from `packages/core/hooks/checks/pr-body-fidelity.ts`
with `{ body, headSha }`, expect `{ ok: true, errors: [] }`. §1.7: the awk extractor at
`.github/workflows/discipline-self-check.yml:102` — each section needs ≥40 non-whitespace chars
and ≥1 `file.ext:line`. Grammar traps confirmed live at S1/S2: `Round:` must be bare digits;
`Audited-SHA` must **prefix** the PR head SHA; any heading closes the `## Fidelity verdict`
section, so its `Evidence:` citation must sit inside it; the `## Review findings` arm demands
`Failure-scenario:` only on lines starting with BLOCKER/MAJOR.

## §8 Budget + exit

L4 budget: **2 rounds → ASK** (design §9). Order of magnitude: ~200-350 short calls — C1 ~151
per-row, C2 ~15-25 grouped, C0 $0 deterministic — on the subscription pool, zero paid CI.

Exit: **S5's kickoff is authored fresh by a different session** (the S1/S2/S3 §8/§5 chain). S5
inherits from this stage: the per-axis verdict lines (`corpus-measured` vs `judgment-only, not
corpus-validated`), the winning layer(s) if any, and the validity limits that must travel with any
deployed rubric question (design §6). **`whose` travels as `judgment-only` no matter what S4
measures** (§3.7). The umbrella stays OPEN through S5 + S5b; `done.md` is written by the session
merging S5 (router §2) — a premature `done.md` drops the umbrella out of `/pipeline`.

## §9 Autonomous dispatch — park-don't-guess contract

> This section is the [`/pipeline`](../../skills/pipeline/SKILL.md) park-don't-guess contract
> instantiated for S4. It is **live only** when this kickoff is dispatched to the aif-handoff
> bridge (`tsx packages/runtime-bridge/src/cli/dispatch.ts`). For a maintainer-pasted session it
> is inert — skip it.

**Why it exists.** aif agents have no mid-implementation «pause and ask» primitive: they
implement — guessing on any ambiguity — then auto-review post-hoc. A silently-decided bench
parameter contaminates the number S5 deploys on.

**Fork discipline (non-negotiable).** On ANY genuine fork or ambiguity — **do NOT pick.** Park it:
set the task to `manualReviewRequired` / `blocked_external` with the fork stated as «Option A →
consequence X / Option B → consequence Y», and **stop that task**. Proceed only on the
unambiguous parts. Recording a fired PARK is not a file write — it lands in the park payload and
the PR body.

**Known S4 forks — park these, do not resolve them yourself:**

- promptfoo cannot be installed or its `exec:` provider fails at the destination (§3.1). Report
  the actual error; the plain-scorer fallback is permitted only with that error recorded.
- Your re-derivation of the C0 subset or accuracy disagrees with §3.3's numbers.
- A candidate output that will not parse after a re-run, or parses outside the §3.4 enums.
- A truth row that looks wrong (T-TK4-A) — report it, never edit it.
- Any temptation to re-cut the whose axis, redefine C0, or drop rows from the scored subset.
- The class-axis result lands ambiguously (e.g. beats C0 on accuracy but increases MATERIAL-miss).
  Report both legs and park the ship/no-ship call — D-K5 needs both, and the call is the
  operator's.

**Lever 1 — conservative aif config.** `AGENT_MAX_REVIEW_ITERATIONS=1` (probed 2026-08-16, §5),
so a task that has not converged in one review pass goes to a human instead of continuing to
guess. Re-probe before dispatch; an unreachable container makes Lever 1 UNVERIFIED, not passing.

**Commit on the branch and STOP — do not push, do not open a PR.** Per-stage containment for
`#autonomous-self-egress`: at S1 the container worker's `git push` died on the proxy TLS
handshake, so it committed via the **GitHub git-database API** and opened its own PR, bypassing
`.husky/pre-push` and the `/dispatcher` §2.4 pre-egress fidelity gate by construction — the
round-1 MAJOR was caught only because the host re-ran the gate afterwards. S2 and S3 held the
line. For S4: commit on the task branch, report `done`, **stop there**. Do not `git push`, do not
use the GitHub API to create commits, refs or PRs, and do not open a PR by any other route. Note
that `gh` **is** authenticated in the container today (§5) — that makes this prohibition
load-bearing rather than merely redundant. The host session harvests.

**Egress — mandatory once `status=done`, run BY THE HOST:**

```bash
npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```

Skipping it leaves the work in the container permanently (`#autonomous-done-no-harvest`).
`harvest.ts` takes the PR title from the **task title**, not the commit subject — retitle the PR
before auto-merge fires if a descriptive squash subject matters (S2 merged as the contentless
`triage-kernel-v2 (#1386)`).

**Pre-dispatch, in this order:** (1) `SLUG=triage-kernel-v2 bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
— it currently returns `VERDICT: IN-FLIGHT` on `origin-branch 9 / pr 9 open=0`, which is a
**squash artefact**, not live work; the discriminator is `gh pr list --head <branch> --state all`
per ahead-branch (all merged) plus `git diff --name-only origin/staging origin/<branch>` → 0
files. (2) Fast-forward the aif base clone (§5). (3) Confirm this kickoff is on `staging`
([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md) — author, merge,
*then* dispatch).
