<!-- fork: F-A′ RESOLVED 2026-08-07 (operator-delegated) — home = Option A `.ai-factory/tier-home.md`,
     the path the consumer AGENTS.md pointer targets; Option B's skill-context slot had no live
     reader (no aif skill is named tier-home). §4 retains the tradeoff as design history.
     This doc is the shipped SSOT for the Tier 0/1/2 criteria + degradation matrix. -->

# Tier routing — criteria + degradation matrix

> **Authoritative for:** the Tier 0/1/2 routing criteria (lifted verbatim from CLAUDE.md
> «Task-tier routing», which now points here) and the explicit capability-absence degradation
> matrix.
> **NOT authoritative for:** project goal — see `README.md#why-this-exists`.
> Tier→model instantiation (which concrete model fills each tier on a given harness) — see
> `.claude/skills/night-mode/SKILL.md` «Overnight
> model posture» paragraph; this doc owns the _criteria_, night-mode + the aif runtime profile
> config own _which model fills which tier_.

---

## §1 Doc-authority note (path convention)

Paths in this doc are **repo-root-relative** (same convention as `AGENTS.md.template` and
`CLAUDE.md.template`). When this doc is installed at `.ai-factory/tier-home.md` (its home —
F-A′ resolution), AI agents reading it resolve
the paths against the consumer's repo root — not against the doc's own install location.

---

## §2 Tier 0/1/2 criteria (verbatim lift from CLAUDE.md «Task-tier routing»)

> **Source:** lifted verbatim from `CLAUDE.md:104-132` (the section heading through the «Marker
> value rule» paragraph) at beta-delivery-ux S3 stage time, 2026-08-01. The operator-repo
> `CLAUDE.md` now defers to this doc via a one-block pointer (see the S3 pointer-ization commit).
> **Lift-verification:** every line that decides a tier in the original section appears here
> unchanged. No criterion dropped, no criterion paraphrased. Link targets preserved as-is
> (repo-root-relative per §1).

**Who classifies:** the senior interactive session (the top-tier model working with the operator) decides the tier at the moment of dispatch — a judgment, never an automated classifier. Building a «simple vs complex» auto-detector would be `#parallel-evolution-creep` over a judgment call; per `attention-is-not-a-mechanism.md` §1, a judgment may be the decision AUTHORITY, never faked as a mechanical gate. This section exists so the classification is applied by **fixed criteria**, not re-invented per task.

**Tiers are RELATIVE capability tiers, not hard-coded models** (same posture as `night-mode/SKILL.md` «Overnight model posture» paragraph, the SSOT for the tier→model instantiation — the window slides to whatever the active harness offers, so this stays AI-agnostic). This section owns the _criteria_; night-mode + the aif runtime profile config own _which model fills which tier_. Roles below: **top tier** = the strongest reasoner (plans complex work, reviews from above); **executor tier** = the cheaper strong-agentic model (plans simple work, implements, reviews from below). _Current instantiation on this operator's stack (2026-07, NOT load-bearing — lives in the profile config, not here): top = Opus, executor = GLM._

**Two questions, three tiers:**

1. **Is the change ≤~5 lines in a single file at a known exact path?**
   → **TIER 0 — tiny.** The senior does the `Edit` itself. No kickoff, no aif dispatch, no pipeline (forcing one is pure overhead). Mirrors the `orchestrator` skill's own SKIP rule.
2. Otherwise — **does producing the PLAN require a design/architecture judgment** (choosing between approaches, a non-obvious «how», or an open «will this even work / what's the root cause»)?
   - **NO — the «how» is already determined; the work is just voluminous/mechanical** → **TIER 1 — bulky-simple.** Dispatch **with** an `<!-- bridge-profile: <unique-executor-tier-profile-name> -->` header marker → the whole aif pipeline (plan + implement + review) runs on the executor tier. The value must be the **unique** profile display name — see the mechanic paragraph below.
   - **YES — the plan itself needs judgment** → **TIER 2 — bulky-complex.** Dispatch **without** the marker → project defaults apply: the **top tier plans**, the executor tier implements and reviews from below. **Exception (acceptance-contour spec D1):** a Tier-2 kickoff produced by `/arch` AND plan-complete (decomposition decisions + all descopes encoded) dispatches **with** the marker — the whole pipeline runs on the executor tier; the fail-closed fidelity gate at the exit boundary covers the WHAT, and the first-5-tasks calibration spot-check covers the plan HOW. **Precondition:** this exception is active ONLY while `fidelity-verdict-in-pr-body` is a REQUIRED check in staging branch protection; if it is not (yet or anymore) registered, dispatch without the marker — a routing rule without its fail-closed gate violates the spec D1 precondition.

**Criteria table (for fast, repeatable classification):**

| Tier              | Trigger (fixed criteria)                                                                                                                                                                                                          | Who plans                                                                                               | Mechanic                                                                                                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — tiny          | ≤~5 lines, 1 file, exact path known, no ambiguity                                                                                                                                                                                 | — (no plan)                                                                                             | senior does `Edit` directly; no dispatch                                                                                                                                                                                             |
| 1 — bulky-simple  | many files/steps BUT the «how» is one determinable sentence: rename/move sweep, apply an established pattern across N sites, tests for already-specified behaviour, mechanical refactor (extract/inline), scaled doc/config edits | executor tier                                                                                           | kickoff with `<!-- bridge-profile: <unique-executor-tier-profile-name> -->` (unique — see mechanic paragraph)                                                                                                                        |
| 2 — bulky-complex | the plan requires a design decision: new module/architecture, data-model or API-shape choice, cross-cutting consequences, unknown root cause needing investigation, «is this the right approach» is open                          | top tier — unless the kickoff came through /arch plan-complete (judgment already spent) → executor tier | /arch-reviewed plan-complete kickoff → WITH marker (see `/arch` §3 (`.claude/skills/arch/SKILL.md`)); exception active only with the fidelity required-check registered (see prose); otherwise kickoff, no marker (project defaults) |

**Tie-breaker (binding):** when unsure between Tier 1 and Tier 2, default to **Tier 2 (top tier plans)**. A wrong-but-cheap plan from the weaker tier costs a full re-do downstream; over-investing one planning pass is the cheaper error. This matches the project thesis «decisions with a real cost of error route to the stronger tier».

**Discriminator in one line:** if you can state the «how» in a single sentence and the rest is expansion → Tier 1; if stating the «how» forces you to _choose_ → Tier 2.

The `bridge-profile` marker mechanic that Tier 1 relies on is shipped in `packages/runtime-bridge` (header-region-only parse in `kickoff.ts`, name→id resolution in `AifHandoffBackend.ts` — it resolves an arbitrary profile _name_, not a hard-coded model); the per-mode project defaults Tier 2 relies on live in the aif runtime profile config (Plan→top tier, Review/Task→executor tier).

**Marker value rule (binding — this is a dispatch-blocker, not a style preference):** the value MUST be the profile's **full display name, unique** under the resolver's match. `AifHandoffBackend._resolveProfileId` is a two-step resolver: an **exact (case-insensitive) name match short-circuit**, falling back to a **case-insensitive substring match** (`packages/runtime-bridge/src/AifHandoffBackend.ts:137-141`). The exact-name short-circuit was added to save the load-bearing prefix case (e.g. `Z.AI GLM-5.2` is a strict prefix of `Z.AI GLM-5.2 SDK`; under pure substring matching, naming the former matched BOTH and threw `dispatch_failed` — the resolver header at `:127-130` documents this). An **abbreviation** still matches ≥2 profiles under the substring fallback and aborts with `dispatch_failed`, so the authoring rule still binds. Verify at authoring time against the live list — `curl -s "$RUNTIME_BRIDGE_AIF_URL/runtime-profiles" | jq -r '.[].name'` — and pick a value matching exactly one row. Recurrence: 3 kickoffs shipped an ambiguous value (PR #1109; `umbrella-donemd-backfill`; `getff-honest-signals`). The resolver-side exact-match short-circuit landed at `AifHandoffBackend.ts:137-141`, so there are now **two channels** — the runtime short-circuit for exact-name-with-prefix-collisions, and this authoring rule as belt-and-braces for abbreviations the short-circuit does not save. Peer statement of the same rule: `/arch §3` (`.claude/skills/arch/SKILL.md`) «Marker value = the UNIQUE profile display name».

---

## §3 Degradation matrix (what degrades how when a capability is absent)

> **Sequencing honesty (spec §9: «C3/C5 gated on A3 — tier-home exists»).** C3 is a NEW probe
> class built in **umbrella C, AFTER A3 ships** (spec §6 C3). At S3 stage time C3 **does not
> exist yet** — the matrix rows cannot be C3-validated now. Each row is authored against **current
> evidence** (file:line citation below) and records the **specific C3 probe class** that will
> validate it post-A3. A row that reads «degrades to X» cites its CURRENT evidence source; the
> C3 forward-reference is the future validation gate, not a present claim. **Do not read these
> rows as C3-validated** — they are C3-TARGETS at S3 stage time.

Columns: `| Capability absent | Tier-system degradation | Current evidence source | C3-validation status |`

| Capability absent                                                                                               | Tier-system degradation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Current evidence source                                                                                                                                                                                                                                                                                                                                                                                                         | C3-validation status                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no aif runtime (no `runtime-bridge` / no aif-handoff dispatcher)                                                | Tier 1 (bridge-profile marker mechanic) and Tier 2 dispatch defaults both become unreachable — the `packages/runtime-bridge` header-region parse and the aif runtime profile config do not exist on the consumer's machine. Tier routing collapses: every non-Tier-0 task degrades to **in-session SDD** (`superpowers:subagent-driven-development` invoked directly, no kickoff dispatch, no pipeline). The senior interactive session does the Edit-then-review loop itself rather than dispatching through the aif pipeline.                                                                                                                               | `CLAUDE.md:130` (pre-pointer-ization — verbatim-lifted to §2 above) names `packages/runtime-bridge` as the marker mechanic home + the aif runtime profile config as the Tier 2 defaults home. Spec §4 A3 (`docs/superpowers/specs/2026-07-23-beta-program-design.md:261`) names «no aif → in-session SDD».                                                                                                                      | TO-BE-VALIDATED by C3 — **C3 probe class: aif-runtime-absence behavioral enumerator** over `setup.d/companions.manifest` + `PROFILE` dispatch (verifies the absence propagates correctly through the install surface so the consumer never sees a half-wired dispatch). Built in umbrella C, post-A3.                                                                                        |
| no GLM subscription (no executor-tier model available on the harness)                                           | The executor tier is absent from the available model set. Per night-mode «window slides», tiers slide to the next-cheaper available model: if only the top-tier model is available, Tier 1 work (executor) routes UP to the top tier (cost increase — the cheaper tier was the point of Tier 1); the SDD advisor collapses per the night-mode single-tier-harness rule. Tier routing CRITERIA are unchanged; only the INSTANTIATION slides (the criteria doc still classifies the same way; the harness fills the executor slot with whatever it has).                                                                                                        | `CLAUDE.md:108` (pre-pointer-ization — verbatim-lifted to §2 above): «Tiers are RELATIVE capability tiers, not hard-coded models … the window slides to whatever the active harness offers». `.claude/skills/night-mode/SKILL.md:17`: «The window **slides** to the available set». Spec §4 A3 (`docs/superpowers/specs/2026-07-23-beta-program-design.md:262`): «no GLM subscription → tiers slide (night-mode posture SSOT)». | TO-BE-VALIDATED by C3 — **C3 probe class: model-tier availability enumerator** over `runtime-bridge/runtime-profiles` resolution + `AifHandoffBackend.ts` two-step resolver behaviour when the named executor profile is absent. Built in umbrella C, post-A3.                                                                                                                               |
| no Fable (top-tier advisor seat absent — Claude-stack-specific instance of «the top-tier model is unavailable») | The advisor seat (night-mode «top tier → advisor + SDD's final whole-branch review», currently instantiated as Fable on this operator's Claude stack) slides down to the next-available tier. Per night-mode: «Claude with no Fable → [advisor Opus, executor Sonnet, cheap Haiku]» — Opus takes the advisor seat; the tier-routing criteria and the executor tier are unaffected. This is an instantiation-level degradation, not a criteria-level one.                                                                                                                                                                                                      | `.claude/skills/night-mode/SKILL.md:17`: «Claude with no Fable → [advisor Opus, executor Sonnet, cheap Haiku]». Spec §4 A3 (`docs/superpowers/specs/2026-07-23-beta-program-design.md:262`): «no Fable → Opus tops».                                                                                                                                                                                                            | TO-BE-VALIDATED by C3 — **C3 probe class: top-tier advisor seat enumerator** over `runtime-bridge/runtime-profiles` + `night-mode/SKILL.md` advisor-consult mechanism (delta item 7). Built in umbrella C, post-A3.                                                                                                                                                                          |
| non-CC harness (Claude Code primitives absent — zcode/GLM/other)                                                | Per `night-mode/SKILL.md:19` portability table: the loop runs on any harness with sequential subagent dispatch; CC-named primitives degrade gracefully — `Workflow` (context-economy) → manual summaries-only discipline; `ScheduleWakeup` (quota-backoff) → harness sleep/resume or manual; `isolation:"worktree"` (parallel executors) → sequential; subagent **hooks** (digest/report injection) absent on zcode event set → carried in the dispatch prompt instead. Per-artifact: 16 zcode plugin twins (S1 inventory §1.7) carry the dispatch surface on the plugin channel. Net: only parallel-executor speedup and hook-based context-hygiene degrade. | `.claude/skills/night-mode/SKILL.md:19`: full portability table (verified 2026-07-04: `~/.zcode/cli/agents/` holds real subagent sessions). S1 inventory §1.7 (`docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md:86-94`): 16 zcode twins catalogued. Spec §4 A3 (`docs/superpowers/specs/2026-07-23-beta-program-design.md:262-263`): «non-CC harness → per-artifact degradations (validated by C3)».       | TO-BE-VALIDATED by C3 — **C3 probe class: harness-portability degradation enumerator** over `plugin/hooks/` zcode twins + `.claude/rules/zcode-parity-doctrine.md §2` census. C3 verifies the per-artifact degradation claims by exercising the non-CC harness path end-to-end (night-mode §5 declares portability «designed-not-proven» as of S3 stage time). Built in umbrella C, post-A3. |

---

## §4 Payload home — F-A′ PARKED

> **Fork status:** **PARKED** (HANDOFF_MODE=1 worker, kickoff §7). Decision deferred to the
> maintainer. Both candidate install locations are wired in `setup.d/30-templates.sh` per the
> parking discipline; the maintainer's post-decision follow-up removes the unchosen path.

**The fork (spec §11 F-A′):** the spec explicitly leaves the payload home open: «pick the home
that the C1 AGENTS.md pointer + non-CC harnesses read most cheaply; decided in A3 planning with
a one-beat read test». Under the autonomous worker posture the one-beat test is not run; the
decision is parked.

**Option A — `.ai-factory/tier-home.md` (shipped default for the PARKED path):**

- **Pros:** readable by `AGENTS.md` pointer + non-CC harnesses cheaply (just a file on disk);
  no skill-context mechanism required; lighter-weight; matches the existing `.ai-factory/` doc
  convention (`DESCRIPTION.md`, `ARCHITECTURE.md`, `RULES.md`).
- **Cons:** no frontmatter / `references/` dir; loaded only when an AGENTS.md pointer or direct
  reference names it (not auto-loaded by any mechanism).

**Option B — `.ai-factory/skill-context/tier-home/SKILL.md`:**

- **Pros:** loaded by the skill-context mechanism (structured load); carries frontmatter +
  references dir convention; matches the shipped `skill-context/{aif-orchestrator-discipline,
aif-review,aif-rules-check}/SKILL.md` pattern.
- **Cons:** heavier — the consumer must have skill-context wired to benefit; a non-CC harness
  without skill-context support reads it only as a plain file (same as Option A but at a deeper
  path); the deeper path is a slightly more expensive read for an agent following an AGENTS.md
  pointer.

**Decision rule (kickoff §1.1 + §7):** DECIDED via one-beat read test under interactive mode
(author the doc, then for each candidate home check whether a fresh AGENTS.md-following agent +
a non-CC harness (zcode) read it cheaply; pick the cheaper). PARKED under autonomous worker
posture; both options shipped so the maintainer's decision is delete-one-not-rewrite.

**Resolution (2026-08-07, operator-delegated):** Option A — the install step copies the doc
source (`packages/core/templates/shared/tier-home.md`) to `.ai-factory/tier-home.md` only,
under the `env`+`factory` profiles. Option B was dropped: no live reader (aif skills
mandatory-read skill-context by their own skill name; none is named tier-home). Re-add iff
such a skill appears. The one-beat read test from the decision rule above remains a valid
falsifier if reader economics change.

---

## §5 Population appendix (T10 evidence — the matrix row set is exhaustive)

> Per `ai-laziness-traps.md §2 T10`: the matrix row set MUST be built against this enumeration,
> not from memory. Each capability-absence row surfaced by the population grep appears in §3 OR
> is parked-as-out-of-scope with rationale.

**§5.1 grep pass — capability-absence signals across the tier-system surface:**

```bash
grep -nE "no aif|no GLM|no Fable|non-CC|degradation" \
  CLAUDE.md \
  .claude/skills/night-mode/SKILL.md \
  docs/superpowers/specs/2026-07-23-beta-program-design.md
```

Surfaced hits:

- `CLAUDE.md:108` — «window slides to whatever the active harness offers» → row 2 (no GLM
  subscription) + row 4 (non-CC harness) evidence.
- `CLAUDE.md:130` — `packages/runtime-bridge` + aif runtime profile config homes → row 1
  (no aif runtime) evidence.
- `.claude/skills/night-mode/SKILL.md:17` — «Claude with no Fable → [advisor Opus, executor
  Sonnet, cheap Haiku]» → row 3 (no Fable) evidence + row 2 (window slides) evidence.
- `.claude/skills/night-mode/SKILL.md:19` — non-CC portability table → row 4 evidence.
- `docs/superpowers/specs/2026-07-23-beta-program-design.md:261-263` — spec §4 A3 row set
  (the 4 canonical rows) → confirmed exhaustive against spec.
- S1 inventory §1.7 (`docs/meta-factory/research-patches/2026-07-25-beta-a-s1-inventory.md:86-94`)
  — 16 zcode twins → row 4 (non-CC harness) evidence.

**§5.2 Row set verdict (each population hit → matrix row OR parked):**

| Population hit                                                            | Appears in §3?                   | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no aif runtime                                                            | ✓ row 1                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| no GLM subscription (no executor-tier model)                              | ✓ row 2                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| no Fable (no top-tier advisor)                                            | ✓ row 3                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| non-CC harness                                                            | ✓ row 4                          | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D1-precondition absence (no `fidelity-verdict-in-pr-body` required check) | **Parked — out of scope**        | This is a _routing exception precondition_, not a tier-system capability absence. The D1 exception (Tier-2 + /arch plan-complete → bridge-profile marker) deactivates when its precondition is absent, but the tier-routing CRITERIA themselves do not degrade — the exception merely stops applying. The matrix documents capability-absence degradations, not precondition-absence routing-rule toggles. Surfaced for completeness; belongs in a future spec-D1-precondition doc, not in this matrix. |
| no `/arch` skill                                                          | **Folded into row 1**            | Without `/arch`, the D1 acceptance-contour exception cannot fire (it requires a /arch-produced plan-complete kickoff). But /arch is one specific skill the consumer may or may not install; its absence collapses the D1 exception path (a routing-rule toggle), not the tier criteria. Folded into row 1's collapse narrative (Tier 1/Tier 2 dispatch paths degrade).                                                                                                                                  |
| no `runtime-bridge` companion                                             | **Folded into row 1**            | `runtime-bridge` IS the aif dispatch surface (the marker mechanic lives in `packages/runtime-bridge`); its absence IS the «no aif runtime» absence. Same row, not a separate one.                                                                                                                                                                                                                                                                                                                       |
| no `night-mode` skill                                                     | **Parked — instantiation-level** | Without night-mode, the tier→model instantiation SSOT paragraph is absent from the consumer's install. But night-mode is the _instantiation_ doc, not a _criteria_ doc — this doc owns criteria, night-mode owns which-model-fills-which-tier. The absence degrades instantiation guidance, not tier-routing criteria. Belongs in a future night-mode-reachability probe, not in this matrix.                                                                                                           |

**§5.3 Conclusion:** the matrix row set (§3) is exhaustive against the population enumeration.
4 rows match the spec §4 A3 minimum; the additional population hits are either folded into
existing rows (same underlying capability absence) or parked with rationale (not tier-system
capability absences). No row silently dropped, no row fabricated.
