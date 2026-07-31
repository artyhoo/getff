<!-- scope: Opus COLD skeptic pass (step 4 of the §4 handoff protocol) over scratchpad/corrected-idea.md. Author saw only the corrected idea, the distillate, the handoff spec, and files they cite. No session context inherited. -->

# Opus skeptic critique — corrected idea (/arch v2 + context pipeline)

**Verdict: GO-WITH-PATCHES — but §3 needs re-derivation, not wording.** B1–B3 must be absorbed
before the system-design arc; M1–M7 are spec-shaping and can be carried into it.

---

## BLOCKERS

### B1 — «SSOT #231 evidence stands» inverts what #231 says

**Claim attacked** (§3, l.67): «Decision 5's abolition of the dedicated top-down seat SURVIVES
(SSOT #231 evidence stands)».

**Evidence:** `docs/meta-factory/prior-art-evaluations.md:304` — verdict is **REFERENCE**, and
verbatim: «X = document-hygiene review … A/B-measured as no-gain …; Y = **two** seats at fixed
altitudes … top-down goal/feasibility **plus** a bottom-up check … **Match: partial** — same
mechanism and same retirement risk, **different object** … and **different downstream cost of a
wrong pass**.» Its falsifier is *prospective*: «`/arch` §2 accumulates **≥5 contours** in which
neither seat produces a finding the inline self-review would not have caught → … §2 collapses».

**Why it fails:** #231 says the retired-upstream object (X) is *not* the object decision 5
abolishes (Y's top-down half), and it sets a ≥5-contour observation trigger for the collapse.
Decision 5 fires that trigger *before* the observations exist and cites the row that declines to
support it. This is `#pattern-matching-on-name` (T16) applied to a partial-match verdict, and a
K5 (external-state precondition) defect committed by the document promoting K5. Compounding:
#231 was authored 2026-07-31 by this same track (#1183) — the track is over-reading its own
fresh row.

**Fix:** either (a) keep the top-down seat until the ≥5-contour cohort is recorded, then retire
on #231's own trigger; or (b) abolish it on *different, stated* grounds and mark #231 as
non-supporting. Do not present #231 as the evidence.

### B2 — «5/5 recent incidents are K1-class» is refuted by the distillate's own §C table

**Claim attacked** (§3.1, l.71-73): K1/K2 promoted to primary and K3-K5 demoted to «background
coverage», justified by «5/5 recent incidents are K1-class» (from A6).

**Evidence:** `distillate.md:37` lists the five incidents; `distillate.md:78-82` (§C table)
assigns them: PR #857 → **K1**; `arch/SKILL.md:79` → **K1**; night-mode stale SDD roster →
**K3**; `claudeMdExcludes` pattern-format → **K4**; fired DEFER trigger 16/26 → **K5**.

**Why it fails:** 2/5, not 5/5. The three incidents that are *not* K1 are exactly the three
classes being demoted. The budget re-allocation is derived from a count that inverts its own
evidence. (Independently confirmed live: `arch/SKILL.md:79` still carries the false
negative-existence claim; `agents/backward-sweep-auditor.md:24` carries the #857 incident.)

**Fix:** re-derive the primary/background split from the §C table, or drop the split and keep
five equal classes (R1a's A7 found no low-yield class to drop — distillate:74).

### B3 — the calibration cohort has no oracle, so its falsifier cannot fire

**Claim attacked** (§3.3): «first 5 bottom-seat runs are a calibration cohort … Falsifier: if
the cohort shows the executor seat systematically missing K1/K2-primary catches, the seat
re-tiers».

**Why it fails:** «missing a catch» is only observable against a ground truth. Under decision 5
no seat runs the same input in parallel — Opus's three standing looks (idea verdict,
plan-writing, acceptance) all occur at *different* artifacts and *different* times. So a missed
K1 defect is discovered only if it survives to implementation and someone notices, i.e.
`#hope-as-gate` under `.claude/rules/attention-is-not-a-mechanism.md:28`. «Systematically» is
also unquantified (2/5? 3/5?), and no owner/ledger is named.

**Fix:** make the cohort a **shadow A/B** — for the first 5 dispatches an Opus cold pass runs on
the *same* dispatch input; catches are diffed into a named ledger
(`.claude/orchestrator-prompts/<umbrella>/calibration.md`), threshold pre-declared («≥2 of 5 runs
in which Opus finds a K1/K2 defect the executor seat did not → re-tier»). Cost is bounded and
one-off; without the parallel arm the falsifier is decorative.

---

## MAJORS

### M1 — L2's channel population does not cover the seats L3 dispatches to
§1-L2 names exactly two candidate channels: the digest resolver and `skills:` frontmatter
preload (A2). Both are **CC-subagent-definition-scoped**. The pipeline's actual roles include a
GLM seat *inside the aif container* and (per criterion (a), which the section itself invokes) a
ZCode seat — and `SubagentStart` is inexpressible on ZCode
(`.claude/rules/zcode-parity-doctrine.md §2` row 16, `cc-only`). So the redraw that moves all
per-role goal delivery into L2 leaves the metered seats unreachable by either candidate.
**Fix:** the L2 spec must first enumerate the role *population* (CC main session · CC subagent ·
aif-container seat · ZCode seat) and state channel + degradation per row, before the
`skills:`-vs-resolver verdict.

### M2 — the membrane drill-down answers a *distiller* defect at the *consumer* channel
The stated evidence is R5 — the distiller shipped non-reproducing quotes. The corrected idea's
remedy is a consumer right (Fable may open raw sources). But the contract already owns the
matching check — **K2, quoted outputs reproduce** — and running K2 *over the distillate* kills
the defect one channel earlier, which is the project's own invariant («fails at the earliest
reachable channel», README + handoff:31). The drill-down is also unbounded (no cap on count or
bytes, trigger self-judged by the beneficiary), and «any drill-down is recorded» has no consumer
— `#warning-nobody-reads` (attention-is-not-a-mechanism.md:29).
**Fix:** add a K1/K2 pass over the distillate as a pipeline stage; keep drill-down as *bounded*
recourse (≤N per artifact, record names the claim + what changed); make «ask the distiller to
re-verify claim X» the first-choice recourse — it preserves the membrane and costs one round-trip.

### M3 — K6 is not «mechanical enough»; its own second instance defeats the grep
§3.1 claims K6 «is mechanical enough for the executor seat (grep for verdict-words against
declared non-goals)». Of the two B3 instances that actually spot-checked CONFIRMED
(`distillate.md:62`): `candidate-shapes.md:106` is «**Recommendation:**» — greppable; but
`inflight-context.md:65` is «**High — natural host**» — a priority label with no verdict word.
50% miss on the evidence base, and «is this hit a verdict or a quotation?» plus «what are the
declared non-goals?» are both prose judgments. Per
`.claude/rules/rule-enforcement-channel-selection.md §5` this is `#gate-where-judgment-needed`.
**Fix:** split K6 — executor emits *candidates* (closed verdict-lexicon grep + the extracted
non-goal lines, structured output); adjudication rides with the Opus framing-bias look, which
§3.2 already establishes. State the known FN class rather than implying full coverage.

### M4 — the L1 budget gate's blocking capability is unverified
§1-L1 keeps «the `InstructionsLoaded` budget gate (error-with-escape-token)». The distillate's
own lever table says of that event: «**observability, not removal** — asserts what actually
loaded» (`distillate.md:120`), and the repo's cold-verify calls it «a reachable channel for
*this assertion*» (`2026-07-31-per-role-context-opus-cold-verify.md:277`) — never that a hook on
it can *block*. The cited precedent (`ci-tool-pinning §3`) is a CI/script gate, not a hook event.
This is a K5 defect in the document promoting K5.
**Fix:** verify against primary docs whether an `InstructionsLoaded` hook can return a blocking
decision. If not, route the assertion to a channel that can block (pre-push/CI over the
token-audit S1 measure script's output) and keep `InstructionsLoaded` as the measurement source.

### M5 — §5's falsifier for the bet is not operationalized
«no measurable improvement (defect catch-rate at review, token cost per dispatched task) over
the uniform digest» names metrics but no baseline, no control arm, no owner, and «the
calibration window» silently reuses §3.3's phrase for a different cohort. Fail-open-to-uniform
(handoff decision 7) is an *accident* control, not a designed one.
**Fix:** record a pre-ship baseline (token cost/dispatch + review-defect count over N uniform
dispatches) before the resolver merges; define the window in dispatch count; consider a
deterministic role-vs-uniform split for the window — it is one hook branch and yields a real A/B.

### M6 — L1 is declared «not per-role» and then shown to be per-role
§1-L1's bold line says «per-PROJECT … **Not per-role**»; four lines later: the custom-subagent
system prompt «replaces CC's entirely, so **the biggest L1 channel is already per-role-variable**»
(A3). Both cannot be the layer definition. If the largest always-on channel is per-agent-definition,
a spec built on «L1 = per-project only» will route system-prompt shaping into L2, where the
resolver/preload machinery does not touch it.
**Fix:** define L1 as *always-on load*, with two sub-axes — per-project **subtraction** (no native
per-role lever, A1) and per-agent-definition **replacement** (A3) — and keep the L1/L2 line at
«what loads by default» vs «what we author and inject», not at «project vs role».

### M7 — framing skew in the two option spaces this seat owns
§1-L2 spans exactly two options (resolver hook vs `skills:` preload) and pre-announces «Expected
outcome is dual-channel» in the same paragraph that says «that is the verdict's to make, not this
document's» — a verdict under a disclaimer, i.e. the K6 defect the document just introduced.
Unlisted: (iii) **no L2 at all** (C10's refutation removed a *reason* for uniformity, it did not
establish a need for shaping); (iv) **the custom-subagent system prompt** (A3) — native, per-role,
zero new artifacts, present in the distillate but used only for attribution; (v) existing
`paths:`-scoped rules (SSOT #101). §3 is likewise one-sided: «executor now + calibrate» is offered,
the risk-symmetric ordering «Opus seat until the cohort proves the demotion» never is — even though
demotion-after-evidence is the cheap direction and a blind bottom seat is discovered only after
metered runs.
**Fix:** span both spaces explicitly, with (iv) costed; state the §3 ordering choice as a choice.

---

## MINORS

- **m1** — «observed 3× in this track's substrate (B3)»: `distillate.md:128` (R5) reports only 2
  of 3 spot-check-confirmed and two quotes non-reproducing. Say «3 reported, 2 verified».
- **m2** — the scope line says decisions are superseded only «where explicitly marked REVISED»;
  §3 raises contract v1 → v2 (a 6th class) with no REVISED marker. Self-application of its own K6.
- **m3** — §4's homes «aif per-task reviewer» sit in the external aif codebase; the in-repo seam is
  `packages/core/templates/shared/skill-context/aif-review/SKILL.md`, which `CLAUDE.md`'s Artifact
  Ownership Contract marks **framework-maintainer-owned, read-only for all sessions**. The spec
  needs an explicit handoff step, not an assumed edit.
- **m4** — §2's «Same right, mirrored, for GLM» inherits M2's unboundedness with a larger blast
  radius (executor seats are the metered ones); cap it in the same clause.

---

## Survived (already stress-tested — do not re-litigate)

- **§4 drop-don't-relocate vs shipped artifacts.** `git grep -niE '\bSOLID\b|single.responsibility|
  open.closed principle'` over the repo returns exactly one hit — a 2026-05-28 research-patch aside
  — and zero hits across `agents/`, `.claude/rules/`, `.claude/skills/`,
  `packages/core/templates/`. No shipped reviewer dimension is contradicted. **HOLDS.**
- **K1 anchor spot-checks (6 run).** `arch/SKILL.md:79` (false negative-existence, live today),
  `agents/backward-sweep-auditor.md:24` (#857 → `ec643bac7`/`bf1b8b5f3`),
  `agents/compliance-verifier.md:33-46` (layer table demanding `file.ext:line`),
  `2026-07-23-acceptance-contour-design.md §2` walls, SSOT `#228` (:301) and `#231` (:304) — all
  exist as claimed. **HOLDS** (the defect in B1 is a *reading* of #231, not its existence).
- **A1's subtractive half → L1 collapse.** No native per-role CLAUDE.md setting; the subtraction
  argument stands independently of M6.
- **K2 promotion.** Two in-repo catches plus a third *inside this track's own* cold review is a
  genuine, non-theatrical basis. **HOLDS.**
- **«Net always-on bytes must go down or stay flat».** Direction-committed and measurable; the
  strongest sentence in the document. **HOLDS.**
- **Membrane scope (not volume).** Drill-down is confined to *cited* sources and does not reopen
  browsing — the pollution risk is volume/frequency (M2), not scope. **HOLDS.**
- **Naming/readability → self-review only.** `agents/review-sidecar.md` is scoped to
  tautology/mock-only/edge-case/anti-pattern review with no naming or readability dimension.
  **HOLDS.**
- **L3's narrowed claim.** «Artifact chain is the context by construction; role-mode selection is
  not our delta» is the correct posture against A5's existing runtime walls. **HOLDS.**
