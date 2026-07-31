<!-- scope: Fable's final idea correction (step 3 of the §4 handoff protocol), authored 2026-07-31 on the Opus distillate. Input for the Opus skeptic pass (step 4) and the system-design arc (step 5). Supersedes handoff §1 as the working statement of the idea; does NOT supersede handoff §2 decisions except where explicitly marked REVISED. -->

# /arch v2 + context pipeline — corrected idea (post-distillate)

**Current as of 2026-07-31.** Grounded in `scratchpad/distillate.md` (Opus, spot-checked); citations A1-A8/B1-B5/R1-R8 refer to it.

## 0. Core thesis — unchanged, restated critically

Context is a convention, and this project's thesis says every convention becomes an executable
artifact that fails at the earliest reachable channel. A session's context is the last
unenforced convention in the repo: budget asserted by nobody, every role loaded identically,
dispatch context authored ad-hoc. The idea survives the retell. What did NOT survive is the
layer boundary as drawn (L1 vs L2), the membrane as an absolute, and two review-scheme calls
(decisions 5-as-stated and 9). Corrections below.

## 1. The three layers — corrected boundaries

**L1 — always-on load: per-PROJECT subtraction + attribution + gate. Not per-role.**
REVISED from handoff decision 7: there is no native per-role subtraction of CLAUDE.md — no
frontmatter field or per-agent setting exists (A1, primary source, fetched 2026-07-31). The
«full text / pointer / pointer+prohibition by role» clause is therefore an L2 artifact, not an
L1 one; L1 keeps only what is per-project: `claudeMdExcludes`, `disable-model-invocation`,
MCP server disabling, the 1,536-char description cap as the attribution unit (A8), and the
`InstructionsLoaded` budget gate (error-with-escape-token). Two hard rules absorbed from the
research: **every budget assertion names its environment** (A7 — host-cc vs aif-container
numbers diverge; a single hard-coded total fires falsely), and **system prompt is attributed
separately for main-session vs custom subagents** (A3 — custom subagent prompts replace CC's
entirely, so the biggest L1 channel is already per-role-variable without us building anything).

**L2 — role-shaped ambient context: the one genuinely unshaped surface.**
The aif runtime already shapes dispatch-time role at three granularities (A5, sweep-asserted,
container re-check pending — R6); the surface it does NOT shape is the ambient digest, uniform
across stages. That is L2's exact scope — an evidence-backed line, not a greenfield ambition.
REVISED delivery-channel stance: the digest-resolver hook is no longer the presumed mechanism.
A native rival exists — `skills:` frontmatter preload injects full skill content per agent
definition (A2). BFR own-stack-first obliges an explicit verdict BEFORE the resolver is built.
Design criteria for that verdict: (a) ZCode parity (hook twin is parity-by-construction;
`skills:` preload parity on ZCode is unverified), (b) the `disable-model-invocation` collision
is avoidable by design — role-context lives in small dedicated skills, never in operational
skills like `/arch` — so the collision alone does not decide it, (c) maintenance surface.
Expected outcome is dual-channel per dual-implementation-discipline (native preload on CC +
hook twin for ZCode), but that is the verdict's to make, not this document's.

**L3 — dispatch-time authored context: the artifact chain IS the novelty; role-shaping is not.**
REVISED delta statement: the runtime already selects model/mode/prompt per stage (A5), so L3's
claim is narrower and sharper — each pipeline stage's *artifact* (research-spec → distillate →
corrected idea → critique → spec → plan → stage-scoped kickoff) is the next seat's context **by
construction**, with membrane rules governing what crosses. Any L3 spec that re-describes
role-mode selection is `#parallel-evolution-creep` against our own runtime and must state its
delta against the existing enforced wall.

## 2. The membrane — default, not wall

REVISED from handoff §1 («Fable never sees raw research»): the membrane is a **default
routing, with a drill-down right**. Evidence: the verifier seat itself shipped
non-reproducing quotes inside a cold review (R5 — findings held, quotes fabricated); a hard
membrane would launder exactly such defects into design with no recourse. Rule: Fable works
from the distillate by default; when a distillate claim is load-bearing for a fork, Fable MAY
open the cited raw source (and only the cited source — the membrane still blocks browsing),
and any drill-down is recorded in the resulting artifact. Same right, mirrored, for GLM: an
executor MAY read the spec's cited design rationale when a kickoff instruction is ambiguous,
recording the read. The membrane's purpose is context economy and role hygiene, not epistemic
isolation.

## 3. Review scheme — kept, with three patches

Decision 5's abolition of the dedicated top-down seat SURVIVES (SSOT #231 evidence stands),
with patches:

1. **Contract v2 = K1-K5 + K6.** K1 (anchors exist) and K2 (quoted outputs reproduce) are
   promoted to primary — 5/5 recent incidents are K1-class, and K2 caught defects even inside
   this track's own cold review (A6, R5). K3-K5 stay as background coverage. **K6 (new):
   self-consistency with declared non-goals** — a document that disclaims verdicts and then
   emits one («Recommendation:» under a «no recommendations» header) is a defect no
   existence/reproduction/format class catches, observed 3× in this track's substrate (B3).
   K6 is mechanical enough for the executor seat (grep for verdict-words against declared
   non-goals), which keeps the bottom seat executor-friendly by design.
2. **Framing-bias detection is Opus's, and «cold» is defined.** Option-space skew (B3's Dim G:
   10/18 spawn-side shapes) is judgment, not mechanics — it belongs to the Opus skeptic look,
   NOT the bottom seat. To close the T19 self-pass risk: **cold = did not author the artifact
   AND did not receive the authoring session's context.** When Opus authored, the skeptic pass
   runs in a fresh Opus instance with only the artifact + its cited sources.
3. **Calibration cohort with a pre-written falsifier.** All catch evidence in the contract's
   base was produced a tier up (B2 — every K-class catch was an Opus pass). Decision 5 stands,
   but the first 5 bottom-seat runs are a calibration cohort: did the executor seat reproduce
   catches of the classes Opus demonstrated? Falsifier: if the cohort shows the executor seat
   systematically missing K1/K2-primary catches, the seat re-tiers to Opus — the checks stay,
   the tier moves. (This falsifier is the B2 fork resolved in advance.)

## 4. Decision 9 — REVISED: drop, don't relocate

SOLID/patterns/LLD dimensions are **dropped from every reviewer prompt**, not relocated to
implementation review (B1: vacuous by construction — always-pass or always-find; relocating a
vacuous check gives the implementation stage a permanent noise floor). Naming/readability:
self-review only. In their place, three dimensions with actual owners (D): test quality
(does the test fail for the right reason) → Opus acceptance at harvest; error-path
reachability → aif per-task reviewer; differential/unintended behaviour change → Opus
acceptance, scoped against SSOT #228's acceptance-side arm. Correctness, convention
conformance, security (session-read only), and test presence keep their existing homes.

## 5. The bet, named, with its falsifier

Per-role context shaping has **no external cover in either direction** (A4 — Anthropic's
2026-07-24 post is subtractive in spirit and silent on roles). It is this project's own bet.
Honest framing, binding for the spec: **L1 shrinks (agrees with the dated primary source);
L2/L3 redistribute existing bytes per role; net always-on bytes must go down or stay flat**
— the budget gate asserts the ceiling per environment. Falsifier for the bet itself: if after
the calibration window role-shaped digests show no measurable improvement (defect catch-rate
at review, token cost per dispatched task) over the uniform digest, the resolver retires and
L1 attribution + gate remain as the umbrella's standing value.

## 6. What is NOT changed

Decisions 1-3, 6, 8, 10-13 of the handoff stand as taken. The research contour (decision 4)
stands with one addition absorbed from R1a: the research-spec template carries a mandatory
**pre-mortem paragraph** («what would have to be true for this to fail») and an
**acceptance-criteria-presence line** (what test would prove the idea wrong) — authoring
duties on the spec template, not new reviewer classes.
