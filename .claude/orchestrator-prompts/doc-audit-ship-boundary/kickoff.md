# KICKOFF — doc-audit-ship-boundary (FULL BRAINSTORM umbrella)

> **Type:** brainstorm-first umbrella (Stage 1 = `superpowers:brainstorming`, no build) → audit (legwork) → synthesis → downstream decision. NOT an execution-build umbrella.
> **Origin:** session 2026-05-31 (mutation-discipline-umbrella Stage 2 B.1). While deciding *where the bash-mutator should live*, two real gaps surfaced that block that decision honestly:
>   1. **README lies in its numbers** — proven this session: claims «R1–R20» lint rules but only **3** eslint-rules exist; claims «a small number of rules are Class C» but it's **5 of 11 (~45%)**. (`packages/core/eslint-rules/*.ts` count + `.claude/rules/*.md` Class grep, 2026-05-31.)
>   2. **The ship-vs-keep-home boundary is undefined** — 8 of 9 `.claude/hooks/*.sh` don't ship to consumers; the *injection half* of the conscience (session-bootstrap digest, path-scoped rule-injector, end-of-turn discipline) stays home, while README names «conventions forgotten within 3 sessions» as the enemy. Is that correct scoping or under-delivery? No doctrine answers it today.
> **Insight that drives the umbrella:** «where do mutation tests belong?» is **downstream** of «what is the true current state of this project + what do we ship vs keep home». A lot of work happened across many waves; the actual state of much of it is lost or stale; some docs already lie. Until docs are reconciled to reality and the ship-boundary has an explicit doctrine, any decision about mutation-test placement (or anything product-shaped) rests on possibly-false premises.
> **Deliverable:** (G1) an explicit **ship-vs-keep-home doctrine**; (G2) a **reconciled documentation set** (docs match repo reality, lies fixed or flagged); (G3) a **goal/path map** — path traveled, goal re-validated, where we are now, what remains; (G4) **mutation-test placement decision**, made *only after* G1–G3.
> **Base branch:** `staging` (NOT `main`).
> **Process anchor:** `superpowers:brainstorming` for Stage 1; deterministic doc-vs-reality audit for Stage 2; no paid LLM in CI (this is session-bound work).

---

## §0 Cold-start context — what is already known (verified this session)

- **Mutation B.1 verdict = ADAPT `universalmutator`** (regexp engine + `analyze_mutants` harness, deterministic, no LLM) — landed PR #305 (`research-patches/2026-05-31-bash-mutator-prior-art-b1.md` + SSOT #91). The *engine* question is settled; the *placement* question is what this umbrella feeds.
- **Repo is PUBLIC** → its own GitHub Actions minutes are free. Consumer repos are PRIVATE → metered. The mutator's job would live in `audit-self.yml` (NOT shipped) and the hook tests are not shipped (`install.sh:493/502` skip `*.test.ts`) → mutator does not run consumer-side.
- **Two confirmed doc-lies / gaps** (the seed evidence — §Origin above).
- **Authoritative state snapshot today:** `docs/meta-factory/wave-sequencing-plan.md §0` (reconciled 2026-05-29) — but it is itself a doc that may have drifted; treat as input, re-verify.

---

## §1 Why this umbrella exists (the problem)

Across N0–N8 + Tracks M/P + many umbrellas, a large amount of work shipped. Three failure modes have accumulated:

1. **Docs drift from reality** — README's numbers already lie (proven). Other load-bearing docs (CLAUDE.md, EXECUTION-PLAN, wave-sequencing-plan, `.claude/rules/*`, skills, SSOT) may carry stale counts, dead references, or claims that no longer hold. The project's own thesis — «documents lie; tests don't» — was never fully turned on its *own* documentation set. This is the recursive-self-application gap, on docs.
2. **No ship-boundary doctrine** — what the product delivers/installs to consumers vs what stays factory-internal is decided ad-hoc per artifact. The injection-channel gap is the symptom: goal-relevant «conscience reminders» stay home with no rule saying whether that's correct.
3. **The path/goal map is not consolidated** — «where have we been, where are we, what's left» lives scattered across wave-plan §0 + retros + memory. There is no single re-validated «state of the project».

Until (1)–(3) are resolved, downstream decisions (mutation-test placement, N6b one-button packaging, give-back) rest on unverified premises.

---

## §2 Goals (what the brainstorm + audit must produce)

- **G1 — Ship-vs-keep-home doctrine.** An explicit, per-artifact-class rule answering «what does the product deliver/install to consumers, and what stays factory-internal, and why». Must resolve the injection-channel gap (ship the conscience-reminders to consumers, or justify keeping them home). Candidate home: a new `.claude/rules/ship-boundary.md` (Class to be decided) + reflected in `install.sh` + dual-implementation-discipline §3.
- **G2 — Reconciled documentation set.** Every load-bearing doc audited against actual repo state; each lie either fixed or explicitly flagged with a tracked follow-up. Numbers that can be computed (rule counts, principle counts, Class distribution) become forward-pointers («see `ls …`») or are made correct, so they cannot re-rot.
- **G3 — Goal/path map.** One authoritative artifact: path traveled (waves/tracks/umbrellas, condensed), the goal re-validated against README, where we are now, and the remaining tail to the goal. (README §Why-this-exists goal statement is **maintainer-owned** — this map *surfaces* goal-questions, it does not redefine the goal.)
- **G4 — Mutation-test placement decision.** ONLY after G1–G3: decide where mutation tests belong (channel: CI vs session-bound vs pre-push; surface: internal hooks vs shipped consumer tests), now that the true ship-boundary and project state are known. This is the gate back to mutation-discipline-umbrella Stage B.2/B.3.

---

## §3 Stages (sequenced; brainstorm-first)

### Stage 1 — Brainstorm the frame (`superpowers:brainstorming`)
Frame the open questions before any legwork: what *should* the ship-boundary principle be (options); what method makes the doc-audit trustworthy (not theatre); what shape the goal/path map takes. Output = a written brainstorm doc with options + the maintainer's chosen direction per open fork. **Decisions here are the maintainer's** (reviewer-discipline §2): surface forks, don't pick strategy.

### Stage 2 — Documentation audit (legwork, deterministic)

**Stage 2.0 (MANDATORY first action of Stage 2) — one-time local mutation run = audit fuel.** Run the mutation tests once, locally, NO CI (§4 has the exact commands). This is the *first* thing Stage 2 does, because its output (which tests genuinely kill mutants vs survive everything) is the hard evidence the rest of the audit cites when checking the docs' test-quality claims. The audit may not assert «tests are real» without this run (T3/T14).

**Stage 2.1 — doc reconciliation.** Full population enumeration of load-bearing docs FIRST (T10), then per-doc reconciliation against repo reality. Every «doc says X» claim carries a command/file:line proving X-vs-reality (T3). Test-quality claims in docs are checked **against the Stage 2.0 mutation results**, not against the docs' own assertions.

### Stage 3 — Synthesis
Produce G1 (ship doctrine), G2 (reconciled docs + fix/flag list), G3 (goal/path map). Cross-check that the doctrine, the docs, and the map agree (no new contradicting-authority claims).

### Stage 4 — Mutation-test placement decision (downstream gate)
With G1–G3 settled, answer where mutation tests live. Hand the verdict back to mutation-discipline-umbrella Stage B.2/B.3.

### Ordering rule — test-fixes are a DOWNSTREAM output, never a precondition (maintainer-approved 2026-05-31)

The sequence is **MEASURE → AUDIT-as-is → FIX**, not «fix-then-audit» and not «all bundled in one atomic change»:

- **Measure (Stage 2.0):** the mutation run only *measures* — it produces the theatre-suspect list. It does **not** fix anything.
- **Audit-as-is (Stage 2.1):** the audit photographs the true current state, *including* «these tests are theatre». **Fixing tests before this snapshot is forbidden** — it erases the very evidence the audit exists to record («documents lie; tests don't» — snapshot the lie before correcting it). It also risks fixing the wrong thing, because some «theatre» is theatre due to a stale rule/doc under the test, which only G1/G2 reveal.
- **Fix (downstream):** test-fixes are an *output* of the audit, executed **after** the doctrine (G1) + doc reconciliation (G2) clarify which tests are right to fix and how. Fixes are code changes → separate reviewed work, **not bundled** into the audit's atomic scope.
- **Inline exception:** an *unambiguously* tautological test whose underlying rule is *certainly* correct (e.g. `expect(x).toBeDefined()` on a typed value) may be fixed inline during the audit — **but only if the snapshot records «was theatre → fixed»** so the evidence of the pre-fix state is preserved.

---

## §4 The one-time mutation run (audit fuel, NO CI) — Stage 2.0

Per maintainer 2026-05-31: run all mutation tests **once, locally, without CI** — this is **fuel for the Stage 2 audit**, NOT the B.2 build and NOT a wired CI job. It reveals which existing tests genuinely kill mutants (real) vs survive everything (theatre) — the hard evidence the doc-audit cites for every test-quality claim.

### (a) Stryker — TS surface (already configured; just run it once)

```bash
cd packages/core
npx stryker run stryker.config.mjs          2>&1 | tee /tmp/doc-audit-stryker-core.log
npx stryker run stryker.audit-ai-docs.mjs   2>&1 | tee /tmp/doc-audit-stryker-audit.log
# per-file kill scores: packages/core/reports/mutation/report.json
```

Capture per-file kill % (this re-runs what `2026-05-25-mutation-discipline-audit.md §A.1` did — compare for drift).

### (b) Bash hooks — first pass via `universalmutator` (B.1 verdict = ADAPT, SSOT #91)

```bash
pip install universalmutator        # deterministic regexp engine, no LLM
# minimal bash.rules (B.1 §B.1.3 operators):
#   exit 0 ==> exit 1   |   exit 1 ==> exit 0   |   &&  ==>  ||   |   set -e ==> set +e
# run on the dominant target first (end-of-turn-reminder.sh = 29 branches × 159 LOC):
mutate .claude/hooks/end-of-turn-reminder.sh --noCheck --cmd "bash -n MUTANT" --mutantDir /tmp/um-eot --rules bash.rules
analyze_mutants .claude/hooks/end-of-turn-reminder.sh "<test-cmd that exercises this hook>" --mutantDir /tmp/um-eot
```

**Run-time unknown to resolve (don't guess — verify):** the `<test-cmd>` must be the vitest test that actually invokes this hook by path (likely `cd packages/core && npx vitest run hooks/end-of-turn-reminder.test.ts`) — confirm the test exercises the swapped `.sh` file before trusting the kill rate. Then widen to the other 8 hooks in branch-count order.

### (c) Fallback (do NOT block the audit on tooling)

If `universalmutator` can't be stood up within the session (pip/env friction), fall back to the **manual mutation-sanity spot-check** the M.4 tests already document (break the hook → test must fail → restore) on the top 2–3 hooks, and **record it as a coverage caveat** in the findings (T6/T14 — «N/9 hooks probed manually, not automated; kill-rate unmeasured»).

### Output

A findings note (e.g. `/tmp/doc-audit-mutation-run.md` → promoted into the umbrella's audit doc) with: TS per-file kill %, bash kill % (or manual-probe result + caveat), and the list of **theatre-suspect tests** (high survival). Stage 2.1 cites this for every doc test-quality claim.

---

## §5 AI-laziness traps active (per `.claude/rules/ai-laziness-traps.md §3`)

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md) for the full catalogue. **Active for this umbrella: T1, T2, T3, T4, T7, T10, T14, T15, T16, T19, T20.**

- **T1 / T10 (sampling shallow / enumerate-before-claim):** the doc audit enumerates the FULL load-bearing-doc population before any «docs are mostly fine» claim. «Checked README + 2 others» is a sampling artefact, not a finding.
- **T3 (no prose-only findings):** every «this doc lies» claim = command/file:line showing claim-vs-reality. The README finding format («claims R1-R20; `ls eslint-rules` = 3») is the required shape.
- **T7 (reason adversarially):** when a doc «looks current», run the counter-probe (compute the number it asserts) rather than trust it.
- **T14 (clean ≠ no drift):** a doc that *looks* consistent with low audit coverage = «coverage insufficient», not «doc clean».
- **T15 (self-application):** audit THIS kickoff + the umbrella's own outputs against the same rules; the goal/path map must itself be reconciled, not a fresh set of unverified prose.
- **T16 (pattern-matching-on-name):** `audit-self.yml` *sounds* like it audits everything; verify what it actually covers. Same for «full doc audit» — name ≠ completeness.
- **T19 / T20 (own QA / evidence-backed verdict):** the ship-doctrine and placement verdicts each carry evidence; cold-review before handoff.

**Domain-specific traps (NEW — `T-DOC-*` / `T-SHIP-*`):**

- **T-DOC-A — «the doc is the source of truth».** Tempted: read a doc and treat its claim as fact (the exact failure that let README's numbers rot). Counter: in THIS umbrella, code/git/`install.sh` are truth; every doc claim is a hypothesis to verify against them. Docs are the *defendant*, not the witness.
- **T-DOC-B — «ship boundary feels obvious».** Tempted: decide ship-vs-home by gut per artifact. Counter: G1 must be a *per-artifact-class rule tied to the goal* (does the consumer's codebase have the surface this artifact governs?), applied uniformly, not case-by-case vibes.
- **T-SHIP-C — re-opening the goal under cover of «reconciliation».** Tempted: the goal/path map (G3) silently redefines README's goal. Counter: README §Why-this-exists is maintainer-owned (Artifact Ownership Contract); the map surfaces goal-*questions* as decision-needed, never rewrites the goal statement.

> Blanket «see ai-laziness-traps.md» without the enumeration above = T7 violation. The enumeration + 3 domain traps are present (principle 12 compliance).

---

## §6 Recursive self-application

This umbrella *is* the project's thesis turned on the project's own documentation: «documents lie; tests don't» applied to README/CLAUDE.md/EXECUTION-PLAN/rules/SSOT. The audit must run on itself — the goal/path map (G3) and the ship-doctrine (G1) are themselves docs and must be reconciled against reality, not shipped as fresh unverified prose. The one-time mutation run (§4) is the «tests don't lie» evidence feeding the «documents lie» audit — the two halves of the thesis meeting on the project's own corpus.

---

## §7 Anti-scope (what this umbrella must NOT do)

- **Does NOT redefine the project goal.** README §Why-this-exists is maintainer-owned. Surface goal-questions as decision-needed; the maintainer applies any goal edit.
- **Does NOT autopilot edits to maintainer-owned artifacts** (README goal, `.husky/`, `.claude/rules/` enforcement, `settings.json`). It proposes diffs; the maintainer lands goal/enforcement-bearing changes.
- **Does NOT build the B.2 mutator or wire CI.** §4 is a *one-time local probe* for audit input only. The placement decision (G4) is the gate back to that build.
- **Does NOT fix tests before the Stage 2.0 snapshot is recorded.** Test-fixes are a downstream output (post-G1/G2), separately reviewed, never bundled into the audit's atomic scope — per the §3 Ordering rule. Only the unambiguous-tautology inline exception applies, and only if recorded as «was theatre → fixed».
- **Does NOT open additional PRs for systemic issues found mid-audit** (PR strategy). Surface as observations; one reconciliation umbrella, not drive-by spin-offs.
- **No paid LLM in CI.** All work is session-bound.

---

## §8 Stop conditions

- Stage 1 brainstorm surfaces a genuine goal-fork the maintainer must resolve → STOP, surface, await decision (don't proceed under an assumed goal).
- Doc audit finds a contradiction between two maintainer-owned authority docs → surface as DECISION-NEEDED, don't pick.
- The one-time mutation run (§4) cannot stand up universalmutator within the session → fall back to manual spot-check + record the caveat; do NOT block the audit on tooling.
- Any temptation to fix README's goal statement directly → STOP (maintainer-owned).

---

## §9 Done =

1. ✅ G1 — ship-vs-keep-home doctrine written (per-artifact-class rule, injection-channel gap resolved or justified).
2. ✅ G2 — load-bearing docs reconciled; every lie fixed or flagged with a tracked follow-up; computable numbers made self-updating or correct.
3. ✅ G3 — goal/path map: path traveled + goal (re-validated) + where-we-are + remaining tail, itself reconciled (not fresh unverified prose).
4. ✅ Stage 2.0 one-time mutation run (Stryker TS + universalmutator bash first-pass, §4) captured as audit-fuel findings — incl. theatre-suspect test list + any tooling caveat.
5. ✅ G4 — mutation-test placement decision, handed back to mutation-discipline-umbrella Stage B.2/B.3.
6. ✅ All maintainer-owned proposed edits surfaced as diffs (not auto-landed); maintainer decisions captured.

---

## §10 See also / inputs

- `docs/meta-factory/research-patches/2026-05-31-bash-mutator-prior-art-b1.md` — B.1 verdict (the decision this umbrella unblocks).
- `docs/meta-factory/research-patches/2026-05-25-mutation-discipline-audit.md` — Stage 1 mutation audit.
- `docs/meta-factory/wave-sequencing-plan.md §0` — current state snapshot (INPUT — re-verify, may have drifted).
- `.claude/rules/dual-implementation-discipline.md §3` — audience triage (internal vs consumer-facing) — the seed of G1.
- `.claude/rules/rule-enforcement-channel-selection.md` — gate vs injection channels (the injection-channel gap lives here).
- `.claude/rules/doc-authority-hierarchy.md` — header/authority spec the audited docs must satisfy.
- `README.md#why-this-exists` — the goal (maintainer-owned; re-validated, not redefined).
- `install.sh` — the actual ship manifest (truth for G1).
- `CLAUDE.md` «Artifact Ownership Contract» — who may edit what.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
