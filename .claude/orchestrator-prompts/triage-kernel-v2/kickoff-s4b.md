# Kickoff S4b — outcome audit (triage-kernel-v2)

> **Dispatch input.** Stage S4b of the [triage-kernel-v2 router](kickoff.md) §1, added by operator
> direction on 2026-08-16: pair the bench with a real sweep of what was actually done about all
> 151 corpus findings, so the contour calibrates AND checks the work in one pass. Runs **after**
> S4 merges. Protocol authority: design spec
> [§8.2 · §5b.1 · §5b.3 · §9](../../../docs/superpowers/specs/2026-08-10-triage-kernel-v2-design.md)
> and operator premise **P4** — this kickoff promotes §8.2 from «recorded, not built here» into a
> stage. Rigor label (L0): `research-grade`. Executor tier: **mid**. Routing: factory (aif) or
> session — §9 is live only for the factory route.

## §0 Why this exists (and what it is NOT)

The bench measures judgment against judgment. Design §5b.1 says so plainly: every labeler and
every candidate is a Claude-family seat reasoning from the same ratified yardstick, and «the only
fully independent anchor is the operator slice» — 22 of 151 rows. S4b adds a second anchor that
is not a judgment at all: **what the repository actually did about each finding.** Was the fix
made? Is it still there? If nobody acted, did the absence cost anything visible?

Two things this is NOT, both load-bearing:

- **Not a re-labeling pass.** The outcome axis never edits `s3-final.csv`. An exam that rewrites
  its own answer key measures nothing — the same rule S4's arm F enforces by blob hash. Where the
  outcome contradicts `class_final`, **the contradiction is the result**, published as a
  disagreement table, not resolved by moving a label.
- **Not a repair stage.** S4b produces a prioritised register of what rotted. Fixing is a separate
  umbrella whose input this register is. Rationale ([effort-worthiness.md §1](../../rules/effort-worthiness.md)):
  the reversible half goes first, and nobody — operator included — currently knows whether the
  rotted set is 3 rows or 40. Ordering repair before that number exists buys an unbounded stage.
  §3.7 states the one narrow exception and its ceiling.

## §1 Objective

For every one of the 151 labelable corpus rows, establish from the **live tree and its history**
what became of the finding, record it with a file:line witness, and publish two things:

1. **The register** — `s4b-outcomes.csv` plus a prioritised drift report: what is rotted, ranked
   by the materiality S3 adjudicated and S4 measured.
2. **The outcome axis** — appended into S4's bench research patch under its reserved
   `## Outcome axis (filled by S4b)` section: how the adjudicated `class_final` lines up against
   what actually happened, with the limits of that comparison stated (§3.6).

## §2 Permitted files — what may be created and edited

**Create:**

- `docs/meta-factory/triage-corpus/s4b-outcomes.csv` — one row per corpus row (§3.5 schema).
- `scripts/triage-s4b-outcomes.mjs` — the audit driver + `--check` arms (§3.8).
- The drift register: `docs/meta-factory/research-patches/2026-08-<dd>-triage-kernel-v2-s4b-outcome-audit.md`.
- Corpus README **§S4b section** + its Files-table row (`rows=<n>` token — gated by
  `triage-s2-labels-check.mjs` arm D).
- Raw auditor output: `docs/meta-factory/triage-corpus/s4b-audit-raw.json` (per-group, stamped).

**Edit:** S4's bench research patch — **only** its reserved `## Outcome axis (filled by S4b)`
section. Corpus `README.md`, as above.

**Not permitted — any temptation here is a PARK (§9):**

- Anything under `packages/`, and any production fix to any file the audit judges rotted. §3.7 is
  the only exception and it has a hard ceiling.
- `s3-final.csv`, `s3-adjudication.csv`, `s2-labels.csv`, `s2-rubric-whose.md`, any population
  CSV, any S0 file, anything under `sources/`, and every artifact S4 produced except the one
  reserved report section. Arm F re-asserts this by blob hash.
- `scripts/triage-corpus-probe.mjs`, `triage-s0-*.mjs`, `triage-s2-labels-check.mjs`,
  `triage-s3-agreement.mjs`, `triage-s4-score.mjs`. Import, never edit.
- The design spec, any rule, any sibling kickoff, `agents/*.md`.

## §3 Method

### §3.1 Population — stratified BEFORE sampling, because the corpus is not homogeneous

Enumerated on the merged tree at `928746421a`, 2026-08-16. Do not assume the 151 rows are one
kind of thing; they are four, and the cheap protocol only fits the first:

| Stratum | Rows | What the `context` path points at |
|---|---|---|
| **A — live artifact** | **92** | a file that exists in the tree today |
| **B — self-referential** | **44** | the review report itself (`sources/*.md`), not the object of the fix |
| **C — path absent** | **8** | no such path today — see the trap below, this is NOT «deleted» |
| **D — no path** | **7** | `context` carries no file reference at all |

Re-derive this table before starting; if your numbers differ, PARK — the substrate moved.

```bash
node -e "import('./scripts/triage-corpus-probe.mjs').then(async m=>{const fs=await import('node:fs');const D='docs/meta-factory/triage-corpus/';const P=['audit-1369','s4-round7','arch-reviews','kickoff-loops','td-m3','research-forks'];const rows=P.flatMap(n=>m.parseCsv(fs.readFileSync(D+n+'.csv','utf8')));const fin=new Map(m.parseCsv(fs.readFileSync(D+'s3-final.csv','utf8')).map(r=>[r.id,r]));const P2=r=>{const t=(r.context||'').split('·').pop().trim();return /[\w./-]+\.[a-z]{1,6}/i.test(t)?t.replace(/:.*$/,''):null;};let a=0,b=0,c=0,d=0;for(const r of rows.filter(r=>fin.has(r.id))){const p=P2(r);if(!p){d++;continue}if(/^sources\//.test(p)){b++;continue}fs.existsSync(p)?a++:c++;}console.log({A:a,B:b,C:c,D:d});})"
```

### §3.2 Grouping — by source artifact, not one seat per row

Audit is **fact-establishment**, not blind judgment, so the blindness discipline that governs S2
and S4 does not apply: an auditor may see every finding of a PR at once. Group by source artifact
(14 PR ids + the 4 review reports), so the seat reads each PR's history once and disposes of ~11
findings against it. One seat per row would re-read the same `git log` 151 times for no gain.

Each seat gets: the group's rows (`id`, `finding`, `context`, `orig_grade`), read-only tools
(`Read`, `Grep`, `Glob`, `Bash`), and the §3.4 output grammar. It gets **no** label column — not
for blindness, but because a label invites confirming it instead of looking.

### §3.3 Per-stratum protocol

- **Stratum A** — open the cited path; establish whether the finding's substance is present in the
  file as it stands now; walk `git log --follow -- <path>` from the finding's PR forward for a
  later change that undid it. Witness = `file:line` of the current state.
- **Stratum B** — the cited path is the *report*, so the question is where the disposition was
  supposed to land. Search for it: the spec section, rule, kickoff, or script the finding demanded.
  Worked example, already verified: `1376-td1-8` («hardest stratum resolved by a single adjudicator
  with no second rater, operator sample not stratified onto it») landed as design §3.5's stratified
  operator slice and S3's actual 22-row sample — `HOLDS`, witness in
  [kickoff-s3.md](kickoff-s3.md) §2. When the landing site cannot be found, that is `NEVER-DONE`
  **only if** the search is enumerated in the row's evidence; otherwise `UNVERIFIABLE`.
- **Stratum C** — resolve the move before judging. Two verified instances of the trap:
  `packages/core/hooks/end-of-turn-reminder.sh` is absent, yet the artifact lives at
  `.claude/hooks/end-of-turn-reminder.sh` with a twin at `plugin/hooks/end-of-turn-reminder` and a
  test at `packages/core/hooks/end-of-turn-reminder.test.ts`;
  `.claude/orchestrator-prompts/getff-freshness-widening/kickoff-s1.md` is absent because the
  umbrella is split per stage — the file is `getff-freshness-widening-s1/kickoff.md`. Both are
  ALIVE. Required probes before any `NEVER-DONE` on this stratum: `git ls-files | grep <basename>`,
  `git log --diff-filter=D -- <path>`, and a content grep for the finding's substance.
- **Stratum D** — text only. Expect a high `UNVERIFIABLE` rate here and report it as such rather
  than straining to produce verdicts (T14).

### §3.4 Verdict grammar (one strict line per row)

```text
id=<row id> outcome=<HOLDS|DRIFTED|NEVER-DONE|MOVED|DECLINED|UNVERIFIABLE> cost=<VISIBLE|NONE-FOUND|N/A> witness=<file:line | none>
```

- `HOLDS` — the finding's substance was addressed and is present today.
- `DRIFTED` — it was addressed and has since been undone, reverted, or routed around.
- `NEVER-DONE` — nothing was done, and the enumerated search establishes that.
- `MOVED` — the artifact is alive under a different path/shape; `HOLDS` in substance, recorded
  separately so the register does not read a relocation as decay.
- `DECLINED` — the record shows a deliberate decision not to act (a notes-lane MINOR, an accepted
  risk, an explicit PARK). Not a defect.
- `UNVERIFIABLE` — cannot be established; the rationale states what was tried.

`cost=VISIBLE` requires a **named** later artifact — an incident, a follow-up PR, a rule, a
research patch — that exists because this was not handled. `cost=NONE-FOUND` is the honest default
and is explicitly **not** «it cost nothing»: see §3.6.

### §3.5 The register

`s4b-outcomes.csv`, columns exactly `id,stratum,outcome,cost,witness,rationale`. Every row of the
151 present; `rationale` ≥20 chars and specific (a truncated restatement of `finding` is a fail —
S2's README carried exactly that defect and it evidenced nothing).

The drift report ranks `DRIFTED` + `NEVER-DONE` rows by `class_final` (MATERIAL first), then by
`orig_grade`, and states per row what a fix would cost. That ranked list is the deliverable a
repair umbrella consumes.

### §3.6 The outcome axis — and exactly what it can and cannot mean

Cross-tabulate `class_final` × `outcome` and publish it in S4's reserved report section, with:

- **The agreement it does support:** a MATERIAL row that is `DRIFTED` or `NEVER-DONE` **with**
  `cost=VISIBLE` is judgment corroborated by consequence; an IMMATERIAL row that is `NEVER-DONE`
  with `cost=NONE-FOUND` is judgment corroborated by absence of consequence. Report both counts.
- **The inference it does NOT support.** `cost=NONE-FOUND` on a MATERIAL row is **not** evidence
  the label was wrong. Three reasons, all stated in the report: the cost may not have surfaced
  yet; design §5b.3 already records that the inverse population (defects never raised) is out of
  reach of any such corpus; and a visible cost leaves a written trace only when someone happened
  to write one. A report that reads `NONE-FOUND` as falsification is the stage's own worst failure
  mode — see T-TK4b-B.
- **Survivorship, named:** the corpus is drawn from findings on PRs that were reviewed and merged,
  so `HOLDS` is the expected majority. A high `HOLDS` share is a property of the population, not a
  grade for the project.
- **No statistical test on this axis at v1.** State counts and rates with denominators. A κ
  between a judgment axis and an outcome axis would imply they measure the same construct; they
  do not.

### §3.7 The one repair exception, with its ceiling

If a row lands `DRIFTED` **and** `class_final: MATERIAL` **and** the repair is a single-file,
self-evident restoration (a stale link, a reverted one-line guard, a twin that lost sync), it may
be fixed — in a **separate commit** on this PR, listed in the register with its commit SHA.
**Ceiling: 5 such rows.** At the 6th, stop and ASK ([effort-worthiness.md §2 L4](../../rules/effort-worthiness.md)
— a breached budget triggers a conversation, never a silent continue). Anything needing judgment
about the fix's shape is register-only, no matter how small. The ceiling is config, not statute;
its purpose is to keep an audit from turning into an unscoped repair sprint.

### §3.8 Fail-closed arms — `scripts/triage-s4b-outcomes.mjs --check`

- **A — completeness.** All 151 ids present exactly once; `s4b-outcomes.csv` joins 1:1 to
  `s3-final.csv`. No extras, no gaps.
- **B — enum validity.** `outcome` and `cost` inside their enums; `stratum` ∈ A/B/C/D and matching
  the §3.1 re-derivation for that row.
- **C — witness discipline.** Every `HOLDS`, `DRIFTED` and `MOVED` row carries a `witness` matching
  `file.ext:line`, and that file exists. `NEVER-DONE` and `UNVERIFIABLE` carry `witness=none` and a
  rationale ≥20 chars that is not a prefix of the row's `finding`.
- **D — raw join.** Every register row traces to a parsed line in `s4b-audit-raw.json` — outcomes
  come from the auditor seats and nowhere else. This is S2's arm-E lesson: an artifact that is
  written but never read leaves the claim resting on attention
  ([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md)).
- **E — report reconciliation.** Every count in the drift report and in the outcome-axis section is
  recomputed from the CSV and must match the prose.
- **F — substrate immutability.** Every corpus master, S0 file, `sources/*` file and S4 artifact is
  byte-identical to its blob at S4's merge commit, **except** S4's report, whose diff must touch
  only the reserved section. RED if the answer key or the bench numbers moved.
- **G — repair ceiling.** Rows carrying a repair SHA ≤5, each also `DRIFTED` + MATERIAL, and each
  SHA present in this branch's history.

## §4 Deliverables

`s4b-outcomes.csv` · `s4b-audit-raw.json` · `scripts/triage-s4b-outcomes.mjs` with arms A-G · the
drift-register research patch · the outcome-axis section appended into S4's patch · corpus README
§S4b · a single-concern PR to `staging` with the FIDELITY block.

## §5 Inputs (read scope) — and what to probe rather than assume

Design spec **§2 · §5b (all five) · §8.2 · §9 · §10 P3/P4** · [kickoff-s4.md](kickoff-s4.md) and
S4's merged bench patch · [kickoff-s3.md](kickoff-s3.md) + [kickoff-s3.decisions.md](kickoff-s3.decisions.md) ·
[corpus README](../../../docs/meta-factory/triage-corpus/README.md) · the six population CSVs ·
`s3-final.csv` · the four reports under `sources/`. All tracked, therefore reachable wherever this
runs.

**P3 governs the whole stage: history is evidence, not truth.** A disposition recorded in a PR is
what someone decided, not what happened. Read the tree, not the changelog.

**Destination probes — re-run before dispatch; each is operator-machine state that changes with no
commit** (per [destination-environment-verification.md §1b](../../rules/destination-environment-verification.md)).
The set is S4's §5 table plus one that matters more here: the container clone must carry **full
history**, not a shallow one, or `git log --follow` silently returns nothing and every stratum-A
verdict degrades to `UNVERIFIABLE`.

```bash
docker exec aif-handoff-agent-1 sh -c 'cd /home/www/rules-as-tests-aif && git rev-parse --is-shallow-repository && git log --oneline | wc -l'
```

Probed 2026-08-16 on the host side: the aif base clone sat at `3a10c71b47` — **stale**, and it must
be fast-forwarded before dispatch (dispatch's own preflight skips base-refresh while a task is in
flight). Verify `ls .claude/orchestrator-prompts/triage-kernel-v2/` shows `kickoff-s4b.md` and that
S4's artifacts are present before starting.

## §6 AI-traps (per [ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md))

Active canonical traps: **T1, T2, T3, T6, T9, T10, T14, T15, T19, T20**. T10 is the stage's spine —
§3.1 stratifies the population before a single row is audited. T2 bites hardest here: «the protocol
would find drift» is not an audit; only a run with witnesses is. T3 governs every verdict: a
`file:line` or an explicit `UNVERIFIABLE`, never prose. Domain-specific:

- **T-TK4b-A — absent path read as dead work.** The default inference from «the file isn't there»
  is «the fix is gone», and it is wrong on this corpus: both stratum-C examples checked so far are
  live artifacts that moved. Same shape as `#destination-limit-by-inference`
  ([destination-environment-verification.md §4](../../rules/destination-environment-verification.md))
  — concluding non-existence from form instead of from a probe. Counter: §3.3's three mandatory
  probes before any stratum-C `NEVER-DONE`, and the separate `MOVED` verdict so a relocation can
  never be booked as decay.
- **T-TK4b-B — `NONE-FOUND` read as falsification.** «No visible cost» is the cheapest possible
  finding and it will be the modal one; treating it as evidence the MATERIAL label was wrong turns
  a weak absence into a strong claim and quietly overturns S3's adjudication through the back door.
  Counter: §3.6's explicit non-inference clause, and the register never writes a class verdict.
- **T-TK4b-C — the audit becomes a repair sprint.** Every rotted row is a live invitation to just
  fix it, and 151 rows can absorb unbounded effort while the register — the actual deliverable —
  stays unwritten. Counter: §3.7's ceiling of 5 plus arm G, which makes the sixth repair a RED
  rather than a judgment call.
- **T-TK4b-D — the loud stratum crowds out the quiet one.** Stratum A (92 rows, one file to open)
  is pleasant work; stratum B (44 rows, «find where this was supposed to land») is slow and easy to
  batch-verdict as `UNVERIFIABLE` to reach the finish. But B is the design/architecture layer — the
  highest-materiality half of the corpus and the exact population design §8.2 exists for. Counter:
  the report states outcome distribution **per stratum**, so a B column that is all `UNVERIFIABLE`
  is visible instead of averaged away; and §3.3 requires the enumerated search before that verdict.

## §7 Acceptance (host-verify)

```bash host-verify
node scripts/triage-s4b-outcomes.mjs --check
node scripts/triage-s4-score.mjs --check
node scripts/triage-s3-agreement.mjs --check
node scripts/triage-s2-labels-check.mjs docs/meta-factory/triage-corpus/s2-labels.csv docs/meta-factory/triage-corpus/README.md docs/meta-factory/triage-corpus/s2-rubric-whose.md docs/meta-factory/triage-corpus/audit-1369.csv docs/meta-factory/triage-corpus/s4-round7.csv docs/meta-factory/triage-corpus/arch-reviews.csv docs/meta-factory/triage-corpus/kickoff-loops.csv docs/meta-factory/triage-corpus/td-m3.csv docs/meta-factory/triage-corpus/research-forks.csv
```

Line 1 is this stage's own gate (arms A-G — an unwitnessed verdict, an out-of-enum outcome, a
verdict with no backing auditor line, a drifted report number, a moved answer key, a sixth repair).
Line 2 re-runs S4's arms — RED if S4b disturbed the bench beyond its one reserved report section.
Line 3 re-runs S3's arms — RED if the adjudication substrate moved. Line 4 is the S2 gate over the
union, whose arm D reconciles the README Files-table `rows=` tokens against real row counts — RED
if `s4b-outcomes.csv` lands without its token or the token drifts from the file. Every line can go
RED on a real S4b defect; none is inherited for form (`#contract-that-cannot-fail`,
[destination-environment-verification.md §4](../../rules/destination-environment-verification.md)).

Line 4 was **added after running** `bash scripts/host-verify-coverage.sh` against this kickoff: the
K6 emitter flagged `docs/meta-factory` as permitted-but-unnamed, and the README section really was
ungated. Re-run that emitter if §2 changes.

PR-body gate traps are unchanged from S4 §7: dry-run `checkPrBodyFidelity` and the
`discipline-self-check.yml:102` awk extractor before `gh pr edit`; `Round:` bare digits;
`Audited-SHA` must prefix the head SHA; `## Provenance` may contain only `n/a`-leading lines if the
fidelity verdict is `skipped`.

## §8 Budget + exit

L4 budget: **2 rounds → ASK**. Order of magnitude — and this stage is the contour's most expensive,
say so rather than discovering it mid-run: ~18 grouped auditor seats (14 PR ids + 4 reports), each
with tool use across its rows, plausibly **500-1200 tool calls** in total. That is materially more
than S4's ~200-350 short judge calls. If the run is trending past the budget, ASK — a partial audit
with an honest coverage statement beats a rushed full one (T14).

Exit: **S5's kickoff is authored fresh by a different session.** S5 inherits from S4 the per-axis
verdict lines and from S4b the outcome axis and its non-inference clause — a rubric question that
ships as `corpus-measured` may cite the bench number, never the outcome axis, as validation. The
drift register routes to a **separate repair umbrella**, not into S5. The umbrella stays OPEN
through S5 + S5b; `done.md` is written by the session merging S5 (router §2).

## §9 Autonomous dispatch — park-don't-guess contract

> The [`/pipeline`](../../skills/pipeline/SKILL.md) park-don't-guess contract instantiated for S4b.
> Live only for an aif-handoff dispatch; inert for a maintainer-pasted session.

**Why it exists.** aif agents have no mid-run «pause and ask» primitive: they implement, guessing
on ambiguity, then auto-review post-hoc. A silently-guessed outcome verdict is worse than a missing
one, because it enters a register that a repair umbrella will trust.

**Fork discipline (non-negotiable).** On ANY genuine fork — do NOT pick. Set the task to
`manualReviewRequired` / `blocked_external` with the fork stated as «Option A → consequence X /
Option B → consequence Y», and stop that task. Proceed only on the unambiguous parts.

**Known S4b forks — park these:**

- Your §3.1 re-derivation of the four strata disagrees with the table's 92/44/8/7.
- A row where the outcome contradicts `class_final` and the contradiction looks like a labeling
  error. Report it in the disagreement table; **never** edit `s3-final.csv` (T-TK4b-B).
- The repair ceiling of 5 is reached and more MATERIAL+DRIFTED rows remain.
- A stratum-B row whose landing site cannot be found after the enumerated search — record
  `UNVERIFIABLE` with the search, and park only if the pattern covers most of the stratum.
- A shallow container clone, or any environment condition that makes `git log --follow` unusable
  (§5) — that degrades the whole stage, so park rather than shipping a register of `UNVERIFIABLE`.

**Lever 1 — conservative aif config.** `AGENT_MAX_REVIEW_ITERATIONS=1` (probed 2026-08-16), so an
unconverged task goes to a human instead of continuing to guess. Re-probe before dispatch; an
unreachable container makes Lever 1 UNVERIFIED, not passing.

**Commit on the branch and STOP — do not push, do not open a PR.** Per-stage containment for
`#autonomous-self-egress`: at S1 the container worker's `git push` died on the proxy TLS handshake,
so it committed via the GitHub git-database API and opened its own PR, bypassing `.husky/pre-push`
and the `/dispatcher` §2.4 pre-egress fidelity gate by construction. S2 and S3 held the line. `gh`
**is** authenticated in the container (S4 §5), which makes this prohibition load-bearing rather
than redundant. Commit, report `done`, stop. The host session harvests:

```bash
npx tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> --base staging
```

**Pre-dispatch, in this order:** (1) `SLUG=triage-kernel-v2 bash .claude/skills/dispatcher/helpers/probe-inflight.sh`
— a bare `IN-FLIGHT` on this umbrella has been a squash artefact every time; discriminate with
`gh pr list --head <branch> --state all` per ahead-branch plus
`git diff --name-only origin/staging origin/<branch>`. (2) Confirm **S4 has merged** — S4b reads
its artifacts and appends to its report. (3) Fast-forward the aif base clone and verify history
depth (§5). (4) Confirm this kickoff is on `staging`
([kickoff-staging-placement.md §1](../../rules/kickoff-staging-placement.md)).
