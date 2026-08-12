# Kickoff S2 — triage-kernel-v2 cold blind re-label (three axes)

Stage: S2 of [2026-08-10-triage-kernel-v2-design.md §9](../../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md).
Executor tier: mid (Opus) — design §9 S2. Rigor label (L0): `research-grade` (these labels are
what S3 adjudicates and S4 is scored against; design §1). Per
[kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md) this file lands on
`staging` BEFORE S2 is dispatched — a kickoff living only on a feature branch is invisible to
`/pipeline` and to the aif container base.

## §0 Gate record (W-2 obligation — S1 result, quoted)

S1 corpus assembly **MERGED 2026-08-11, PR #1384, squash `e5cfc5e8bf85`** — **156 rows across 6
population files**: `audit-1369.csv` 88 (`pr-body`) · `s4-round7.csv` 6 (`pr-body`) ·
`arch-reviews.csv` 44 (`review-report`) · `kickoff-loops.csv` 13 (`pr-body`) · `td-m3.csv` 2
(`author-cell`) · `research-forks.csv` 3 (`author-cell`). Schema is exactly the 7 columns
`id,source,provenance,finding,context,class_start,orig_grade`; no judgment axis is pre-filled
(design §3.1). Host verification at merge:
`bash scripts/host-verify.sh .claude/orchestrator-prompts/triage-kernel-v2/kickoff-s1.md` →
`2/2 passed`, `6 file(s) · 156 rows · 0 probe failures`, frozen S0 guard `1 file(s) · 32 rows ·
0 probe failures`. **Never quote the squash subject for the row count** — it reads «152 rows»,
written pre-rework (handoff-s1 §4). Every count above was recounted from the tree 2026-08-12;
every count S2 writes must be recounted again (§3.6).

Upstream gate standing: S0 = GO (PR #1380, squash `7daf16a15533`) — blind C1 93.5% vs C0 64.5%,
discordant 9:0, exact McNemar p = 0.0039
([patch](../../../docs/meta-factory/research-patches/2026-08-11-triage-kernel-v2-s0-probe.md)) —
and the finding that shapes this stage: the `whose` axis was **DEGENERATE**, `whose=reviewer` on
32/32 (re-verified today from `s0-c1-sonnet.json`: `{"reviewer":32}`).

## §1 Goal

Produce the **cold blind labels** for the full corpus per design §3.1 — `class_cold` (binary),
`layer_cold`, `whose_cold` on every `pr-body`/`review-report` row — plus the whose-axis rubric
re-cut that S0 said must precede labeling that axis. S2 labels; it does not adjudicate, does not
compute agreement against an adjudicated truth, does not bench.

**Labelable population = 151 rows** — 156 minus the 5 `provenance: author-cell` rows (design §2,
§3.1, §5b.5). Recounted today: 88 + 6 + 44 + 13 = 151, `id`s unique across the union. Re-derive
it yourself before writing it anywhere (§3.6); do not inherit it from this paragraph.

## §2 Permitted files (write scope)

- `docs/meta-factory/triage-corpus/s2-labels.csv` — NEW, the S2 label sidecar (§3.1).
- `docs/meta-factory/triage-corpus/s2-cold-<model>.json` — NEW, raw per-row judge output
  committed for reproducibility (precedent: `s0-c1-sonnet.json`). Named `cold`, **not** `c1`: the
  S2 seat is the corpus's cold RATER, while `C1` is an S4 bench CANDIDATE scored against the
  truth this rater helps build — conflating the two names would invite scoring C1 against itself.
- `docs/meta-factory/triage-corpus/s2-rubric-whose.md` — NEW, the re-cut whose-axis rubric as a
  file (§3.3). It exists because §3.3 requires the wording to be shipped and reproducible, and
  because the runner's `--rubric` flag (below) needs a tracked path to read: an untracked rubric
  makes every label irreproducible, and editing the `RUBRIC` constant in place breaks the
  byte-identical default this section demands. Contains the wording and nothing else — its reason,
  its falsifier and the measured distribution live in the README's S2 section.
- `scripts/triage-s2-labels-check.mjs` — NEW, the S2 check (§3.7). Under `scripts/`, outside
  `packages/` — same placement as the S0 scorer, so it is not a `packages/` capability commit.
- `scripts/triage-s0-run.mjs` — **narrow additive edits only**, exactly these three: (a) export the
  per-row payload builder (§3.2 arm B calls it); (b) add a `--rubric <file>` flag; (c) make the
  artifact's provenance true of the run that produced it — today
  [`triage-s0-run.mjs:62`](../../../scripts/triage-s0-run.mjs) hard-writes
  `{ candidate: 'C1', model, rubric: RUBRIC, … }`, so an S2 run with a re-cut rubric would ship a
  file claiming the S0 rubric and the S4 candidate name, which is the exact conflation this section
  forbids two bullets up. Minimum shape: a `--rater <name>` flag whose value replaces the
  `candidate` key with a truthful `rater` key, and — when `--rubric` is passed — a `rubric` field
  carrying **the file's actual bytes** plus a `rubricSource` field naming its path. **Default
  behaviour stays byte-identical**: with neither flag the output keys, order and values are exactly
  today's (`candidate: 'C1'`, the `RUBRIC` constant, no `rubricSource`), so the frozen S0 artifacts
  remain reproducible and the §7 frozen guard stays green. Arm F gates that the provenance is true;
  anything beyond (a)-(c) is a PARK (§9).
- `docs/meta-factory/triage-corpus/README.md` — S2 section (labels file, rubric re-cut record,
  axis distributions), `rows=<n>` count tokens, the two count repairs (§3.6).
- **NOTHING else.** No population-CSV or S0-file edits, no `packages/**`, no `.claude/rules/**`,
  no `package.json` (§4), no design-spec edits.

Recording a fired PARK is not a file write (see [`/pipeline` §5 park-record
contract](../../skills/pipeline/SKILL.md)): it lands in the park payload + the PR's
`## Parked questions`, and its correction lands as a separate owner commit — so this allowlist
deliberately names no park-record artefact.

## §3 Acceptance criteria (definition of done)

### §3.1 Labels land in a separate sidecar keyed by `id`

`docs/meta-factory/triage-corpus/s2-labels.csv`, columns exactly
`id,class_cold,layer_cold,whose_cold,rationale` — **not** new columns on the population files.
Grounds: design §3.1 forbids judgment axes in the population files, and the durable way to keep
that true is a byte-identical substrate (§7 line 3 asserts it); the S0 precedent is a sidecar
(`s0-raters.csv` holds one column per rater against the same `id` key while `s0-probe.csv` stays
the population); and S3 needs per-rater label sets side by side, which sidecar-per-rater
generalises (second rater = second file, same shape).

**One union file, not one per population**, because `id` is already globally unique — the S1
probe's uniqueness arm enforces it
([`triage-corpus-probe.mjs:108-115`](../../../scripts/triage-corpus-probe.mjs)), re-verified
today (zero duplicate `id`s across the four labelable files); a split would give the join four
chances to go wrong instead of one. Join integrity is a gate, not a promise (§3.7 arm A):
exactly the **151 labelable `id`s** — none missing, none extra, no duplicates, **none of the 5
author-cell `id`s**.

### §3.2 Blindness is constructed and mechanically proven, never asserted

The cold seat is the existing runner, reused not rebuilt: each row is judged by a **fresh
`claude -p`, no tools, no session state**, prompt built from **`context` + `finding` only**
([`triage-s0-run.mjs:40-48`](../../../scripts/triage-s0-run.mjs)). Never reaching the seat:
`id`, `source`, `provenance`, `class_start`, `orig_grade`, and every S0/S3 artifact.

The proof (§3.7 arm B) is **payload equality**, not a grep: for every population row, the payload
built from the full row must be byte-identical to the payload built from that row with
`id`/`source`/`provenance`/`class_start`/`orig_grade` blanked. A helpful
`Grade: ${row.orig_grade}` line in the template makes the two diverge → RED. Hence §2's narrow
export edit: the builder must be callable from the check.

The **executor session must never hand-write a label** — it has read this kickoff and the spec,
so any label it authors reproduces the S0 «session rater (contaminated)» column (§6 T-TK2-E).
Labels come from the runner's JSON output and nowhere else — and that sentence is **gated, not
promised**: §3.7 arm E joins every `s2-labels.csv` row back to a parsed judge result in
`s2-cold-*.json` and fails on any label with no matching run. A prose «labels came from the runner»
would be exactly the bare attention
[attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md) rejects as a
detection layer, and it would be undetectable by construction: a hand-written label file passes
join integrity, enum validity and the payload-equality proof unchanged.

### §3.3 The whose-axis rubric is re-cut ONCE, before any labeling run

**Decision: re-cut inside S2, label with the re-cut, and make the degeneracy measurement an
acceptance criterion — do not park the axis.** Grounds: parking leaves S3/S4 a hole they cannot
fill (S3 adjudicates what S2 produced; S4 benches what S3 ratified), and a rubric re-cut is cheap
and reversible while a parked axis costs a stage round-trip. Rejected: labeling with the S0
rubric (known degenerate — spends ~151 calls re-measuring a settled answer); parking.

**Why it degenerated + the leading candidate** (weigh it, do not rubber-stamp): S0 asks «who
should rule on it», which for an already-raised finding is trivially the reviewer — the question
is asked about the wrong object. The spec carries the discriminating distinction: the advisor
verdict set `MATERIAL | IMMATERIAL | OUT-OF-CONCEPT | FLOOR` maps `OUT-OF-CONCEPT → advisor`,
`FLOOR → operator-floor` (design §2 vocabulary mapping;
[reviewer-discipline.md §6](../../rules/reviewer-discipline.md)). Candidate re-cut asks about
**escalation**, with `reviewer` as the explicit default: *does settling this require a premise,
concept or value ABOVE the reviewer's authority — a concept the advisor owns (OUT-OF-CONCEPT) or
a value only the operator can set (FLOOR)? If neither, `reviewer`.*

**Where it lives:** the final wording ships as `docs/meta-factory/triage-corpus/s2-rubric-whose.md`
(§2) and is passed to the runner as `--rubric <that file>` — never pasted into the `RUBRIC`
constant, never kept outside git. *Falsifier:* if the re-cut still returns one class on ≥95% of
rows, the degeneracy is in the population, not the wording — report it and stop (§6 T-TK2-F). The
**80-94% band is not a pass either**: a ~0.9 majority-class bar is practically unbeatable at S4
even though the axis is formally non-degenerate, so that band takes the same
`judgment-only, not corpus-validated` verdict line below, with the measured share stated.

**The acceptance consequence, stated plainly.** Design §5 says an axis failing its bar ships (if
at all) labeled `judgment-only, not corpus-validated`, and the layer/whose bar is the
**majority-class predictor** — which for a degenerate axis is ~100%, so **no candidate can beat
it by construction**. «Measure whose against its bar» is therefore unachievable while the axis is
degenerate, and calling a ~100% majority-class agreement a pass would be a measurement that
cannot fail. S2 ships, for whose: the re-cut wording + its reason, the measured distribution, and
one explicit verdict line — either `whose: distribution non-degenerate, bar comparison meaningful
at S4` or `whose: still degenerate at <n>/151, routed to S3/S4 as judgment-only, not
corpus-validated`. No third option, no silent omission.

### §3.4 `author-cell` exclusion is mechanical, both directions

The 5 rows in `td-m3.csv` (2) + `research-forks.csv` (3) never enter S2 labeling and never enter
the bench (design §2, §3.1, §5b.5). The `provenance` value IS the exclusion marker: the run reads
only the four non-author-cell files, and the check (§3.7 arm A) is handed **all six** population
files so it fails on a leaked author-cell `id` by name rather than reporting a vague extra. Both
directions fail closed — author-cell `id` present → RED; labelable `id` absent → RED.

### §3.5 Thin-file honesty (design §2/§5)

`td-m3.csv` (2) and `research-forks.csv` (3) are both <5 rows. They stay in the README's
enumeration with recomputed counts, marked excluded-from-S2-labeling with the §5 consequence,
reported descriptively — **never padded, never quietly dropped**. The existing «S1 thin-file
honesty» table is preserved and its counts pass the §3.6 token gate.

### §3.6 W-7 — every count is recomputed, and the recompute becomes a gate

No gate reads the corpus README's numbers today, so a stated count can drift from its own file
invisibly (handoff-s1 §4, W-7). A prose promise to «recompute» is bare attention, which
[attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md) rejects as a
detection layer. S2 does both: (1) **recompute, quotably** — every count S2 writes into the
README comes from a command whose output is quoted in the PR body (§3.7's `COUNTS` block exists
for this); (2) **gate it** — each Files-table row linking a `.csv` carries a machine-readable
`rows=<n>` token, arm D recomputes each and fails on mismatch, and a linked `.csv` row with **no**
token also fails (no `UNCHECKED` escape, or the gate becomes optional the first time someone
forgets). S2 adds the token to all existing rows so the gate is total from S2 onward.

**Repair the two known imprecisions — decided, with a falsifier.** `README.md:47` says the narrow
`UNRECOVERABLE` sense covers «~10 pr-body rows» (the file has 8); `README.md:85` frames a
«~10-row delta» whose three named compressing cells sum to 7. Both were left as notes-lane MINORs
at S1. S2 fixes them because shipping a count-accuracy gate two screens below two known-false
counts is `#discipline-theatre`, and the fix is two lines of prose touching no data. **Falsifier
/ park rule:** re-derive 8 and 7 from the CSVs and the audit table, **not** from `handoff-s1.md`
(inheriting a number is `#claim-from-memory-not-source`); if your re-derivation disagrees, PARK
the repair and leave the prose as-is — a wrong «fix» is worse than a known imprecision. Prose
numbers stay outside the token gate; say so in the README rather than implying total coverage.

### §3.7 The S2 check — `scripts/triage-s2-labels-check.mjs`

Proposed here as an S2 deliverable (not pre-built), because §7's contract must go RED on a
plausible S2 defect rather than run, print PASS and assert nothing about the deliverable
(`#contract-that-cannot-fail`,
[destination-environment-verification.md §4](../../rules/destination-environment-verification.md)).
Reuse `parseCsv` + the runner's payload builder; do not re-implement CSV parsing. Arms, all
fail-closed, one non-zero exit for any:

- **A — join integrity / author-cell exclusion.** Labels `id` set == the union of non-author-cell
  population `id`s exactly; zero duplicates; zero author-cell `id`s (§3.1, §3.4).
- **B — blindness payload equality.** For every population row, `payload(full row)` ==
  `payload(row with id/source/provenance/class_start/orig_grade blanked)` (§3.2).
- **C — enum validity.** `class_cold` ∈ {`MATERIAL`,`IMMATERIAL`}; `layer_cold` ∈
  {`idea`,`design`,`architecture`,`plan`,`implementation`}; `whose_cold` ∈
  {`reviewer`,`advisor`,`operator-floor`}; `rationale` non-empty; no `class_start`/`orig_grade`
  column may exist in the labels file at all.
- **D — README count reconciliation.** Every Files-table row linking a `.csv` carries `rows=<n>`
  matching that file's real data-row count; a linked `.csv` row without the token fails (§3.6).
- **E — every label traces to a judge run.** The check discovers the judge artifacts itself —
  `readdir` the labels file's own directory for `s2-cold-*.json` (**zero matches = RED**; do not
  take the path from argv, so the contract line cannot go stale when the model name changes).
  For every `id` in `s2-labels.csv` there must be a result in that union whose
  `class`/`layer`/`whose` are **identical** to the label row's; a label with no matching result, a
  mismatched axis value, or a result whose `class` is `null` (unparsed) behind a filled-in label →
  RED. This is what makes §3.2's «labels come from the runner and nowhere else» a mechanism: arms
  A-D all pass on a hand-written label file, and a contaminated cold set is unpickable downstream
  (§6 T-TK2-E).
- **F — provenance is true of the run.** In every `s2-cold-*.json`: the `rubric` field is
  byte-identical to `s2-rubric-whose.md` when `rubricSource` names it; no artifact produced by an
  S2 run carries `candidate: 'C1'` (that name belongs to the S4 bench candidate — §2); and `model`
  is non-empty. Grounds: the artifact is the only reproducibility record S3/S4 have, and a false
  provenance line is invisible to arms A-E (§2's third permitted runner edit exists for this).
- **`COUNTS` / `DISTRIBUTION` report block** (printed, always): per-file row counts; labelable vs
  excluded totals; per-axis distribution + majority-class share; layer distribution cross-tabbed
  by population (§6 T-TK2-G).

Distribution numbers are **reported, never gated** — a degenerate axis is a finding, not a
defect, and gating on «the distribution looks healthy» invites rubric-tuning (§6 T-TK2-F).

### §3.8 Docs gates green

markdownlint (CI-only here — `run-local-ci-sweep.sh` reports `WARN-SKIP md-ci-only`), the
600-line markdown gate, and principle 09's authority header on the corpus README (landed at S0 —
do not regress it).

## §4 Out of scope (hard NOs)

- **NO promptfoo, no `package.json` edits of any kind** — W-6 is still armed: promptfoo enters at
  **S4 only**, as a capability commit carrying a `Prior-art:` trailer + a new SSOT entry (id ≥250)
  in the SAME commit. Any S2 commit touching `package.json` is a defect.
- **No S3 work:** no adjudication, no advisor pass, no operator slice, no κ/PABAK, no
  `class_final`, no `status` column. S2 emits `*_cold` labels + distributions only.
- **No S4 work:** no bench config, no C0/C2 comparison, no acceptance-rule arithmetic.
- **No corpus mutation:** the six population CSVs and the four S0 files are byte-frozen (§7 line
  3). A row that looks wrong is a PR-body finding, not an edit (T5).
- **No design-spec, rule, or other-kickoff edits** — including the `#autonomous-self-egress`
  tightening in §9, which is deliberately a per-stage instruction here, not a global template
  change (separate owner decision; CLAUDE.md §PR strategy).

## §5 Inputs (read scope)

Design spec §2 · §3.1-§3.2 · §4 · §5 + §5b · §9 ·
[the S0 patch](../../../docs/meta-factory/research-patches/2026-08-11-triage-kernel-v2-s0-probe.md)
§3-§4 · [corpus README](../../../docs/meta-factory/triage-corpus/README.md) · the six population
CSVs · `s0-c1-sonnet.json` + `s0-fable-rationales.md` (evidence for the whose re-cut — read for
the RUBRIC, never as labels to copy) · `scripts/triage-corpus-probe.mjs`, `triage-s0-run.mjs`,
`triage-s0-score.mjs`.

**Everything above is tracked in the repo, so it is reachable wherever this kickoff runs. The S1
handoff is not** — `handoff-s1.md` is a gitignored coordination file, absent from the container's
clone. Probed live 2026-08-12:
`docker exec aif-handoff-agent-1 ls -1 /home/www/rules-as-tests-aif/.claude/orchestrator-prompts/triage-kernel-v2/`
→ `kickoff-s1.md`, `kickoff.md` only; the content exists at
`/home/node/.claude-coordination/rules-as-tests-aif/triage-kernel-v2/handoff-s1.md` (host:
`~/.claude-coordination/rules-as-tests-aif/triage-kernel-v2/handoff-s1.md`), which today lists
`handoff-s1.md` + `handoff-s2-authoring.md`. Treat both as **optional enrichment that may be
absent** — re-probe before relying on either, per
[destination-environment-verification.md §1b](../../rules/destination-environment-verification.md).
Everything load-bearing from them is inlined here instead of linked: the W-7 imprecisions and their
re-derivation rule in §3.6, the PR-body gate recipes and grammar traps in §7, the egress incident
and its prohibition in §9. The full W-1..W-7 watch-list lives in PR #1384's `## Review findings`
(`gh pr view 1384`) — read it before any corpus-adjacent claim, and if it is unreachable say so
rather than inferring its content. In-text «handoff-s1 §N» mentions elsewhere in this kickoff
(§0, §3.6, §9) are **provenance attributions for facts already stated in full here**, never
instructions to go and open that file.

## §6 AI-traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active canonical traps: **T1, T3, T5, T6, T7, T8, T10, T14, T15, T19** (catalogue:
[§2](../../rules/ai-laziness-traps.md); [digest](../../rules/ai-laziness-digest.md)). T6 is
load-bearing — every distribution claim states its denominator, never «looks reasonable». So is
T14: a clean-looking axis at low coverage is «coverage insufficient to conclude», not «axis
fine». Domain-specific:

- **T-TK2-E — blindness destroyed by the seat that knows too much.** The executor has read the
  design, the README and this kickoff; hand-labeling even «a few obvious rows to save calls»
  reproduces the S0 contaminated-rater column, and nothing downstream can un-mix it. Counter:
  §3.2 — labels originate only in fresh per-row `claude -p` processes, arm B proves the payload
  carried no forbidden field, and an unparsed row is re-run, never filled in.
- **T-TK2-F — rubric tuned until the distribution looks right.** The whose re-cut is decided
  BEFORE any labeling run, from the rubric's own logic + the S0 rationale record. Re-cutting after
  seeing labels fits the wording to the very corpus S4 will score against — leakage the bench
  cannot detect. Counter: §3.3 — ONE re-cut; a still-degenerate result is a reported finding, and
  any second re-cut is a PARK for the operator, not a silent retry.
- **T-TK2-G — labeling from the `context` pointer instead of the finding.** `context` carries
  «PR #… · round N · <file path>», letting a judge shortcut to «test file → implementation»
  without reading the finding; the layer axis is where this hides. Counter: §3.7's cross-tab
  report + a T1-floor read — spot-check ≥5 rows per population against their `rationale` and
  state in the PR body whether `layer_cold` is predictable from the cited path alone. If it is,
  that is a reported finding about the rubric, not a silent pass.

T15: S2's check runs against S2's own output, and the PR body states what it does NOT cover
(prose synonyms of grades — design §5b.5; prose counts outside the `rows=` gate — §3.6). T19:
run your own cold review of the diff before handoff — CI checks form, not whether 151 labels are
defensible.

## §7 Verification (run before handoff — T19)

Contract lines are executed one-by-one by `host-verify.sh` — each is a single self-contained
command whose exit code IS the verdict (no `&&`, no pipes, no shell constructs; W-9 from S1):

```bash host-verify
node scripts/triage-s2-labels-check.mjs docs/meta-factory/triage-corpus/s2-labels.csv docs/meta-factory/triage-corpus/README.md docs/meta-factory/triage-corpus/s2-rubric-whose.md docs/meta-factory/triage-corpus/audit-1369.csv docs/meta-factory/triage-corpus/s4-round7.csv docs/meta-factory/triage-corpus/arch-reviews.csv docs/meta-factory/triage-corpus/kickoff-loops.csv docs/meta-factory/triage-corpus/td-m3.csv docs/meta-factory/triage-corpus/research-forks.csv
node scripts/triage-corpus-probe.mjs docs/meta-factory/triage-corpus/audit-1369.csv docs/meta-factory/triage-corpus/s4-round7.csv docs/meta-factory/triage-corpus/arch-reviews.csv docs/meta-factory/triage-corpus/kickoff-loops.csv docs/meta-factory/triage-corpus/td-m3.csv docs/meta-factory/triage-corpus/research-forks.csv
git diff --quiet e5cfc5e8bf85 -- docs/meta-factory/triage-corpus/audit-1369.csv docs/meta-factory/triage-corpus/s4-round7.csv docs/meta-factory/triage-corpus/arch-reviews.csv docs/meta-factory/triage-corpus/kickoff-loops.csv docs/meta-factory/triage-corpus/td-m3.csv docs/meta-factory/triage-corpus/research-forks.csv docs/meta-factory/triage-corpus/sources docs/meta-factory/triage-corpus/s0-probe.csv docs/meta-factory/triage-corpus/s0-raters.csv docs/meta-factory/triage-corpus/s0-fable-rationales.md docs/meta-factory/triage-corpus/s0-c1-sonnet.json
node scripts/triage-corpus-probe.mjs docs/meta-factory/triage-corpus/s0-probe.csv
```

Argv contract for command 1 (the check is yours to write, so this is binding on it): labels file,
README, rubric file, then the six population CSVs. It takes **no** judge-artifact argument — arm E
discovers `s2-cold-*.json` beside the labels file.

Each line must be able to fail on a real S2 defect, not merely run: (1) the S2 deliverable check
(§3.7) — RED on a missing/extra label row, a leaked author-cell row, a bad enum, a prompt
template that leaks `orig_grade`, a label with no matching judge result, a false provenance stamp,
or a drifted README count; (2) the S1 union probe re-run — RED
if S2 broke an anti-leakage arm, expected `6 file(s) · 156 rows · 0 probe failures`; (3)
substrate immutability pinned to the S1 merge commit — RED if ANY population file, S0 file, or
tracked review report under `sources/` changed by a byte; the `sources/` leg matters because the
probe's substring arm would NOT notice an *addition* to a report (verified 2026-08-12 to exit 0
on an unmodified tree); (4) the frozen S0 guard,
mandatory because §2 permits edits to `triage-s0-run.mjs`, and the runner *imports* `parseCsv`
from the probe ([`triage-s0-run.mjs:11`](../../../scripts/triage-s0-run.mjs)) — so a runner edit
cannot break the probe, but it can break the `stripGrades` path this line re-exercises against the
frozen S0 population — expected `1 file(s) · 32 rows · 0 probe failures`.

Runner argument order: `bash scripts/host-verify.sh --list <path>` — `--list` comes FIRST; a
trailing `--list` is parsed as the target and exits 2. Plus markdownlint via CI and
`bash scripts/run-local-ci-sweep.sh` selection green (it reports `WARN-SKIP md-ci-only` — a green
local sweep does **not** cover markdownlint).

**Offline / `gh auth` caveat, so a green tree does not read as RED.** Commands 2 and 4 shell
`gh pr view <n> --json body` per unique PR unless a cache directory is supplied
([`triage-corpus-probe.mjs:13`](../../../scripts/triage-corpus-probe.mjs)); with 107 `pr-body`
rows, an offline host or an expired `gh auth` reddens them with no S2 defect present. Use
`--bodies <dir>` against a cached copy in that case, and say in the PR body which route you ran.

**Dry-run both PR-body gates locally before `gh pr edit`** — each red costs a CI cycle (recipes
inlined here rather than referenced, because the handoff they came from is not reachable at the
destination — see §5):

- fidelity: `npx tsx` a 4-line script importing `checkPrBodyFidelity` from
  `packages/core/hooks/checks/pr-body-fidelity.ts`, pass `{ body, headSha }`, expect
  `{ ok: true, errors: [] }`.
- §1.7: the awk extractor from `.github/workflows/discipline-self-check.yml:102` — each section
  needs ≥40 non-whitespace chars and ≥1 `file.ext:line` citation.
- Grammar traps confirmed live at S1: `Round:` must be bare digits; `Audited-SHA` must **prefix**
  the PR head SHA; any heading closes the `## Fidelity verdict` section, so the `Evidence:`
  `file.ext:line` must sit inside it; the `## Review findings` arm demands `Failure-scenario:` only
  on lines starting with BLOCKER/MAJOR (table rows starting `|` never match).

## §8 Budget + exit

L4 budget: **2 dispatch rounds → ASK** (design §9). Order of magnitude: ~150 short judge calls,
one per labelable row, plus re-runs for unparsed rows. PR: single-concern (cold blind labels),
base `staging`, FIDELITY block per the stage-PR contract. On completion S3's kickoff is authored
**fresh by a different session** — the S2 executor does not write it (kickoff-s1 §8 precedent).

## §9 Autonomous dispatch — park-don't-guess contract

> This section is the [`/pipeline`](../../skills/pipeline/SKILL.md) park-don't-guess contract
> instantiated for S2 — the skill has no «§4c» of its own; that is the label its §5 dispatch table
> uses for this required kickoff block, and its §5 also owns the park-**record** contract (§2). It is **live only** when this kickoff is dispatched to the aif-handoff bridge
> (`tsx packages/runtime-bridge/src/cli/dispatch.ts`). For a maintainer-pasted session it is
> inert — skip it.

**Why it exists.** aif agents have no mid-implementation «pause and ask» primitive: they
implement — guessing on any ambiguity — then auto-review post-hoc. Without this contract S2's
rubric and exclusion forks get decided silently, and a silently-decided rubric contaminates every
label S3 and S4 build on.

**aif agent — fork discipline (non-negotiable).** On ANY genuine fork or ambiguity — **do NOT
pick.** Park it as a question: set the task to `manualReviewRequired` / `blocked_external` with
the fork stated as «Option A → consequence X / Option B → consequence Y», and **stop that task**.
Proceed only on the unambiguous parts.

**Known S2 forks — park these, do not resolve them yourself:**

- The whose axis still degenerates after the ONE permitted re-cut (§3.3). Report the number; a
  second re-cut is a PARK, never a retry.
- A judge output that does not parse after a re-run, or parses outside the §3.7 arm-C enums. Park
  it — never hand-write the label (T-TK2-E).
- A README count you re-derive that disagrees with §3.6's 8 or 7. Park the repair; leave the prose.
- Any change to `scripts/triage-corpus-probe.mjs`, or to `triage-s0-run.mjs` beyond §2's two
  narrow additive edits.
- Any temptation to widen a population CSV or touch a frozen S0 file, for any reason.

**Lever 1 — conservative aif config (operator-set; probed container-side 2026-08-11):**
`aif-handoff-agent-1` reported `AGENT_MAX_REVIEW_ITERATIONS=1`, so a task that has not converged
in one review pass is handed to a human instead of continuing to guess. Re-probe before dispatch
(`docker exec aif-handoff-agent-1 sh -c 'echo "${AGENT_MAX_REVIEW_ITERATIONS:-UNSET}"'`) — an
unreachable container makes Lever 1 UNVERIFIED, not passing.

**Commit on the branch and STOP — do not push, do not open a PR.** Per-stage tightening after the
S1 incident: the container worker's `git push` died on the proxy TLS handshake, so it committed
via the **GitHub git-database API** and opened PR #1384 itself, bypassing both `.husky/pre-push`
and the `/dispatcher` §2.4 pre-egress fidelity gate by construction (`#autonomous-self-egress`,
handoff-s1 §5 — the round-1 MAJOR was caught only because the host re-ran the gate afterwards).
For S2: commit on the task branch, report `done`, **stop there**. Do not `git push`, do not use
the GitHub API to create commits, refs or PRs, and do not open a PR by any other route. The host
session harvests.

**Egress — mandatory once `status=done` or `status=verified`, run BY THE HOST, not by the agent.**
aif does not push or open PRs by design; skipping this leaves the work in the container
permanently (`#autonomous-done-no-harvest`):

```bash
npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```
