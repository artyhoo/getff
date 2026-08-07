<!-- scope: R-phase R1 of the getff-any-stack-trace umbrella — OPERATOR-INVITED (2026-07-26) alongside S2b: a lane × channel-rung PARITY AUDIT. Research only — the deliverable is ONE research patch, zero code changes. Semantics are BINDING in THIS kickoff. Tier: research with judgment calls per cell; NO bridge-profile marker — project-default routing applies (whatever profile the runtime resolves; verdict-bearing cells carry evidence the reviewing session re-checks regardless of which tier audited). -->
<!-- host-verify: none — prose-only research kickoff; the deliverable is a markdown research patch under docs/meta-factory/research-patches/, no executable artifact to verify on the host -->

# getff-any-stack-trace-r1 — lane × channel-rung parity audit

> **Research stage, parallel with S2b** (disjoint files: this stage writes ONLY
> `docs/meta-factory/research-patches/2026-07-26-lane-channel-parity-audit.md`).
> **Origin:** the S2b discovery — the python lane's local git-hook rung was empty, and the
> emptiness had a broken decision chain behind it (a prior-art verdict about the WRONG role
> consumed as a channel decision — see the S2b kickoff's provenance block). The operator asked
> the obvious next question: **what else is missing the same way?** This audit answers it
> systematically instead of anecdotally.
> **Branch:** `research/getff-any-stack-trace-r1`. **Base:** `staging`.
> Predecessors merged: S1 = #1166, S2 = #1169.

## §1 Population enumeration FIRST (T10 — before any cell verdict)

**Lanes (rows):** `npm` (the default flow, `setup.d/[0-9]*.sh` layers), `python`
(`do_python_lane`, `setup.d/45-python.sh`), `cargo` (`do_cargo_lane`, `setup.d/46-cargo.sh`).
**Plus one row that is not a lane:** `go` — verify and record that NO go lane exists at all
(grep `install.sh` + `setup.d/` for a go/golang entry). If so, that is a **product-scope
absence, not a rung gap** — record it as such, do not invent a lane; flag it as a candidate for
the operator's roadmap, out of this umbrella.

**Channel rungs (columns) — the project's ladder, earliest first:**

1. **edit/agent-session** — CC hooks in the consumer session (`inject-matching-rule`,
   `deps-hash-check` wiring in delivered `.claude/settings.json`)
2. **local git — pre-commit/pre-push** (the rung S2b is closing for python)
3. **install-time firing proof** (`_py_firing_self_check` class — plants a violation, proves
   the delivered rules fire at install)
4. **CI** (delivered workflow with failing gates, default-branch substitution)
5. **freshness** (deps-hash staleness signal on the lane's lockfile/manifest class)
6. **refresh reconciliation** (`--refresh` reconciles renames/stale companions on this lane)
7. **opt-out story** (documented deletion path / env escape per delivered enforcement artifact)

**Deliberately EXCLUDED columns (state the exclusion, do not silently drop):** *production
audit* (the ladder's last rung — framework-internal `audit-self.yml` machinery, not a
per-consumer-lane deliverable; auditing it is out of this matrix's scope) and *mutation gates*
(framework-internal quality machinery, same reason). Column 1 covers BOTH delivered CC-session
hooks AND any lane-native edit-time channel (npm's ESLint-in-editor is the reference case —
a lane where the linter itself fires at edit-time counts as an edit-rung EXISTS with evidence).

## §2 Method (binding)

For **every cell** of the matrix, produce one of exactly three verdicts, each with evidence:

- **EXISTS** — cite the artifact `file:line` AND the evidence it actually FIRES (a test, a
  self-check, a CI wiring — not the file's existence alone; see T-R1-B).
- **GAP** — then run the **provenance protocol** (the S2b lesson, mandatory per gap):
  grep kickoffs (`.claude/orchestrator-prompts/**`), SSOT
  (`docs/meta-factory/prior-art-evaluations.md`), specs (`docs/superpowers/specs/**`), and
  research patches for the cell's terms. Classify: **DECIDED-AGAINST** (cite where + whether
  the cited verdict actually matches this problem class — a mismatched-role verdict like
  SSOT #216-vs-runner counts as MISDECIDED, state it), **DEFERRED** (cite the trigger), or
  **SILENTLY-MISSED** (state the negative searches run — ≥3 phrasings per surface, per
  [phase-research-coverage.md](../../rules/phase-research-coverage.md) 6-item checklist).
- **N/A** — the rung is structurally meaningless for this lane; justify in one sentence.

**Recommendations routing (do NOT implement anything):** each GAP row ends with a routing
verdict — `this-umbrella (new stage)` / `getff-freshness-widening` (cargo parity is
spec-§10-assigned there) / `separate-umbrella` / `operator-roadmap` (e.g. a go lane) — with a
one-line cost/benefit. The routing is a recommendation for the dispatching session, not a
decision.

**Deliverable:** ONE file — `docs/meta-factory/research-patches/2026-07-26-lane-channel-parity-audit.md`
— containing: the full matrix, per-GAP provenance findings, the recommendations table, and a
§self-application section (T15). Nothing else in the diff.

## §3 «Works» — for a research patch

- Matrix is **complete**: `3 lanes (+go row) × 7 rungs` — every cell has a verdict; no cell is
  left implicit. An incomplete matrix is T4 (premature closure).
- Every EXISTS carries firing evidence, not file existence.
- Every GAP carries a provenance classification with citations or negative-search phrasings.
- The adversarial counter-prompt was RUN (T7): «which rung or lane did I not even think to put
  in the matrix?» — its answer (or honest "nothing surfaced after N attempts") is IN the patch.

## §4 Park-don't-guess contract (aif agent — non-negotiable)

**aif agent — fork discipline:** On ANY genuine fork or ambiguity — **do NOT pick.** Park it as
a question (`manualReviewRequired` / `blocked_external`, fork stated as «Option A → consequence
X / Option B → consequence Y») and **stop that task.** Proceed on the unambiguous parts.

**Stage-specific park triggers:**

- **A cell whose EXISTS/GAP verdict depends on interpreting a spec's intent** (not its text) —
  park with both readings.
- **A GAP whose fix seems trivial** — the temptation is to just fix it (T5: bundling
  implementation into research). Do NOT. Record, route, move on. Any `Edit` outside the single
  research-patch file is a scope violation.
- **Evidence that an EXISTING rung is deceptive** (fires but lies, or silently no-ops) — that
  is honest-signals class; record it as its own finding with the evidence, park the question of
  whether it warrants a hotfix stage.

## §5 AI-traps active

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this R-phase: T1, T3, T4, T5, T7, T10, T14, T15, T20, T21.**

- **T10** — population enumeration (§1) BEFORE cell verdicts; the matrix bounds the claim.
- **T1/T14** — no sampling here: the matrix is small enough for FULL enumeration; a skipped
  cell is not «low priority», it is an incomplete audit.
- **T3/T20** — every verdict carries `file:line` or a quoted negative search.
- **T4** — all §2 deliverable sections present, including self-application.
- **T5** — research produces a Markdown file; ANY source edit is a violation (see §4 park).
- **T7** — the counter-prompt is run and its output recorded, not ticked.
- **T15** — self-application: this audit's own method gets one paragraph — «what would auditing
  this audit look like; which cell verdicts rest on the weakest evidence?»
- **T21** — not applicable as backward-check (no code change), but its spirit binds §2:
  enumerate surfaces OUTSIDE the diff — that is the entire audit.

**Domain-specific traps (NOT in the canonical catalogue):**

- **T-R1-A — «gap = missed» without a provenance search.** The S2b case shows the opposite can
  be true (considered, then mis-decided) — and the difference changes the fix (a mis-decided
  gap needs a corrected VERDICT, not just an implementation). Counter: §2 provenance protocol
  is mandatory per GAP; «SILENTLY-MISSED» requires the negative searches quoted.
- **T-R1-B — EXISTS from filename.** A delivered file is not a firing rung: `inject-matching-rule`
  shipped for months as a permanent silent no-op (honest-signals S6's origin), and the python CI
  template targeted a branch many consumers don't have (S4's origin). Counter: EXISTS requires
  firing evidence — a test that goes RED, a self-check output, a CI run — cited per cell.
- **T-R1-C — auditing only the surfaces this umbrella touched.** The matrix includes the npm
  lane precisely because it is the reference implementation — its cells need the same firing
  evidence, not a presumption of health. A «reference lane is fine by definition» row is T13
  (trusting the adopted thing without confirming upstream evidence).

## §6 Anti-scope

- ZERO code changes. ZERO edits outside the single research-patch file.
- Do NOT touch S2b's surface, S3/S4's surfaces, or any other umbrella's files.
- Do NOT re-litigate SSOT verdicts beyond classifying provenance (MISDECIDED is a
  classification with evidence, not a new verdict — the new verdict belongs to the stage that
  implements the fix, e.g. S2b Task 0).
- Do NOT write `done.md`.

## §7 PR body

The diff is one research patch under `docs/meta-factory/research-patches/**` — not a §4b
trigger path in either channel; self-evaluate at entry anyway (meta-launch §4b). The
`research-patches/` folder README carries folder-level authority (append-only, one patch per
gap) — this patch complies by construction (one file, new).

Quote in the PR body: the matrix dimensions (§1), the counter-prompt run + outcome (§3), and
the per-GAP provenance classification counts (N DECIDED-AGAINST / N MISDECIDED / N DEFERRED /
N SILENTLY-MISSED).

Prior-art discipline: no capability is added (docs only) — `Prior-art: skipped — research
patch only, no new capability, no dependency, no code module` is the correct line here.

**Fidelity verdict — REQUIRED on every staging PR (no paths filter on that check).** The PR
body MUST carry exactly ONE H2 section headed `## Fidelity verdict`. Two legal shapes:

1. **If the PR carries a `## Provenance` section declaring a substrate** (an aif harvest
   pipeline will add one): `skipped` is REJECTED by the gate — the section must carry a real
   verdict from a cold `agents/fidelity-auditor.md` run over THIS kickoff (as the Basis) + the
   diff: literal `FIDELITY: GO`, `Basis: .claude/orchestrator-prompts/getff-any-stack-trace-r1/kickoff.md`,
   `Round: <n>`, `Audited-SHA: <sha prefixing the PR head>`, and ≥1 `file.ext:NN` evidence line
   NOT on the `Basis:` line.
2. **Only if NO Provenance substrate is declared:** `FIDELITY: skipped — <rationale ≥20 chars>`
   is legal (e.g. «single research patch, no implementation surface, cold-reviewed in-session»).

The dispatching session lands this PR via the Channel-A egress and runs the auditor at that
seam — the worker's job is to leave the research patch itself audit-ready (every cell verdict
carrying its evidence).

---

## §8 ROUND 2 — rework scope (added 2026-08-07 after a `FIDELITY: STOP` at the egress seam)

Round 1 (aif task `6f18c179`, dispatched 2026-08-01) produced the patch and was **not merged**.
The branch `research/getff-any-stack-trace-r1` (`1479f54741`) carries it; no PR was opened,
because a branch with no PR releases nothing. Round 2 reworks that patch — it does **not** start
over. Read the round-1 patch first; keep every verdict that still holds.

**§8.1 BLOCKER — the go row is now false, and the reason is NOT worker error.**

Round 1's §3.4 verdicted all 7 go cells `N/A` as a «product-scope absence», backed by a quoted
`= 0 matches` negative search. That search was **honest and correct when it ran** — verified
mechanically, not assumed:

```text
git show 0e2d366a9f:install.sh | grep -cE 'do_go_lane|TOOLCHAIN=go'   → 0   (R1's base, 2026-08-01)
git show origin/staging:install.sh | grep -cE 'do_go_lane|TOOLCHAIN=go' → 6   (2026-08-07)
git ls-tree 0e2d366a9f setup.d/47-go.sh                                → absent
PR #1171 merged 2026-08-06T22:04Z — "stamp go ecosystem end-to-end THROUGH the conformance jig"
```

A **full go lane** now exists: `install.sh:316` `do_go_lane()`, `setup.d/47-go.sh` (361 lines,
with `_go_deliver_golangci`, `_go_deliver_ci`, `_go_write_rules_lock`, `_go_firing_self_check`),
and `packages/core/templates/go/`. So the go row is a **fourth lane needing 7 substantive
verdicts**, not an absence — and §6's `operator-roadmap` routing row rests on the dead premise.

**Round 2 must:** verdict all 7 go cells against the live tree with the same evidence bar as
every other row; correct the §2 matrix dimensions and the §7/§8 counts that follow; and rewrite
the §6 routing row for go. **Record the staleness itself as a finding** — a parity audit's
verdicts are only as live as the tree they were taken against, and this one aged out in five
days. That is a fact about the audit's shelf life and belongs in the patch, not only in a PR body.

**§8.2 MAJORs — these are NOT staleness; they are conformance gaps against §2/§3 as written.**

1. **npm rung 6 is the only EXISTS with no firing evidence at all** (round-1 patch `:81`) — pure
   implementation-reading, which §3 and T-R1-B forbid. Four of its line anchors also do not
   resolve: `do_refresh()` is at `install.sh:600` (not `:544`), the skill-rename orphan reclaim
   at `:691` (not `:663`), and the `--refresh` call site at `:1097` (not `:1041`). Re-derive the
   anchors live; do not patch the numbers from this list without re-checking them.
2. **Five EXISTS cells rest on analogy or assertion, not a cited firing artefact** — `:86`
   python rung 1 («the same shape as the npm lane»), `:99` cargo rung 4 («same default-branch
   substitution machinery as python»), `:89` python rung 4, `:79` npm rung 4 (definitional),
   `:80` npm rung 5 (asserted). §2's EXISTS bar is «cite the artifact `file:line` AND the
   evidence it actually FIRES». An EXISTS resting on a sibling lane's health reports coverage
   the consumer does not have.
3. **The hybrid `EXISTS*` token breaks §2's «exactly three verdicts»** (round-1 `:62`, `:66`,
   `:91` — python rung 6). It is counted EXISTS in the matrix at `:68` and listed as a GAP row in
   the §6 routing table at `:161`, so the per-GAP counts §7 requires quoted in the PR body cannot
   be reconciled against the matrix. Pick one token; if the cell is genuinely split, split the
   CELL (state the sub-scope), never the token.

**§8.3 MINORs — fix in passing, do not spend a round on them.**

- §4.1's «literal quote» of SSOT #216 is normalised, not literal (bold moved, a parenthetical
  elided without an ellipsis). The MISDECIDED classification itself holds; the label «literal»
  does not. Either quote literally or drop the word.
- §4 kickoff park trigger not honoured: two deceptive-rung observations (`:101` «nothing globs it
  today», `:102` the inert `getff-clippy.toml` REFUSE cell) appear only as inline clauses. §4
  binds them to be «recorded as its own finding with the evidence», with the hotfix question
  parked. Elevate both.
- The patch states the kickoff is «166 lines» (`:14`, `:210`); it was 165 at round 1 and is
  longer now. Prefer a claim that does not rot — cite the section, not the line count.

**§8.4 Unchanged and still binding:** §1 population enumeration (now 4 lanes, not 3 + an
absence), §2 method and the three verdict tokens, §3 «works», §4 park contract, §5 traps
(T-R1-A/B/C all fired in round 1 — B and C are the ones that scored), §6 anti-scope (ZERO code
changes; the diff stays exactly one research-patch file), §7 PR body.

**§8.5 Round-2 specific trap.**

- **T-R1-D — patching the auditor's findings instead of re-deriving them.** §8.1/§8.2 hand you
  line numbers and verdicts. They were correct at `1479f54741` and at `a66c0cb9aa`; they are a
  *map*, not evidence. Re-run every search on the tree you are actually on and quote YOUR output.
  A round-2 patch whose citations are copied from this kickoff has laundered a second-hand claim
  into a primary one — the same failure class, one level up, as the stale go row it exists to fix.
