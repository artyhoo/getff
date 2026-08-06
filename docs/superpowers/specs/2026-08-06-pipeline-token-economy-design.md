<!-- scope: pipeline-token-economy decision layer — output of the 2026-08-06 /arch external design contour over docs/superpowers/specs/2026-08-06-arch-prep-pipeline-token-economy.md (feat/prune-worktrees) -->

# Pipeline context & token economy — decision layer (2026-08-06)

> **Authoritative for:** the decision layer over the 2026-08-06 prep-doc — fork resolutions
> D1/D2/D3/N1/N2 (§1), the config-assertion gate position (§2), the proposal→stage routing
> table (§3), umbrella dispositions (§4), exit routing (§5).
> **NOT authoritative for:** the measurements — the prep-doc and the research patches own them;
> ADR-1..ADR-8 — [`2026-07-31-arch-v2-context-pipeline-design.md`](2026-07-31-arch-v2-context-pipeline-design.md);
> SSOT verdicts #233/#234 — [`prior-art-evaluations.md`](../../meta-factory/prior-art-evaluations.md);
> project goal — [README.md#why-this-exists](../../../README.md#why-this-exists).
> **Current as of 2026-08-06.**

> **Branch hazard (inherited from the prep-doc).** The prep-doc and the 2026-08-06 audit chain
> live on `feat/prune-worktrees`; the token-economy research (`2026-08-01-token-economy-*.md`)
> and `.claude/rules/cold-seat-economy.md` live on `origin/staging`; the RTK empirical test and
> this spec live on `claude/webresearch-reports-repo-032830`. Resolve staging-side links via
> `git show origin/staging:<path>`.

**Inputs consumed** (per the prep-doc's §6 reading rule — distillate + addressed sections only,
raw stage material not re-read): the prep-doc; the token-economy distillate (staging, 125 lines);
`cold-seat-economy.md §3` (staging); SSOT #233 (RTK) + #234 (L2 verdict); the RTK empirical test
([`2026-08-02-rtk-empirical-test.md`](../../meta-factory/research-patches/2026-08-02-rtk-empirical-test.md),
this branch); `2026-08-02-superpowers-vs-trio.md §B` + `2026-08-02-webresearch-anthropic-first-party-plugins.md §10`
(feat/prune-worktrees). **Operator resolutions taken in-session 2026-08-06:** D1 = trim
`CLAUDE.md`, keep `ai-laziness-traps.md` whole. **Precondition verified live:**
`fidelity-verdict-in-pr-body` is a registered required check on staging
(`gh api …/branches/staging/protection/required_status_checks` → `ci-success`,
`fidelity-verdict-in-pr-body`), so the /arch §3 plan-complete marker exception is ACTIVE.

## §0 Stance

No parallel structure. Every proposal below lands in an existing stage of the OPEN
`arch-v2-context-pipeline` umbrella, in one operator edit, or in an explicitly separate
already-owned track. Inventing a sibling structure next to ADR-1..ADR-8 would be
`#parallel-evolution-creep` applied to our own planning
([`build-first-reuse-default.md §4`](../../../.claude/rules/build-first-reuse-default.md)).

## §1 Fork resolutions

Format per fork: resolution → grounds → falsifier («wrong if»).

| # | Fork | Resolution | Grounds | Wrong if |
|---|---|---|---|---|
| D1 | Always-on head trim | **Trim `CLAUDE.md` (converge to pointer discipline, model = `AGENTS.md`, 8,861 B vs 23,740 B); keep `ai-laziness-traps.md` whole.** Operator-resolved 2026-08-06. | `CLAUDE.md`'s enforcement lives in mechanical gates (pre-push, principle tests) — its prose compresses to pointers without moving enforcement off-channel; precedent = PR #1188's banked −39%. `ai-laziness-traps.md`'s force is behavioural — residency IS its channel; a trim's failure mode (convention bypassed) is silent and no byte-gate detects it (distillate L5 falsifier). | A post-trim session bypasses a convention `CLAUDE.md`'s trimmed prose was carrying → the pointer form under-carries; restore that section. Revisit the traps trim only after S-E's gate ships + an incident-free month. |
| D2 | Measure-first vs ship-cheap-first | **Ship-cheap-first; the N2 measurement rides S-E as its input, not as a standalone prior stage.** | The §3 config fix and stage dispositions depend on nothing unmeasured (cause identified, cost measured). The only consumer of per-turn attribution numbers is S-E's gate (ADR-3 already requires measured output + the `InstructionsLoaded` verification task). | A decision surfaces that needs N2's numbers before S-E dispatches → split N2 out as its own Tier-1 stage. |
| D3 | Plugin thread | **(a) CC-plugin adapter → NOT this contour: separate /arch (capability commit, positioning call, own BFR pass — plugins patch §10 item 3 is its input). (b) Channel split resolved per the operator's §B3 delegation: `engineering` + `system-design` → preset-option for backend presets; `design` → preset-option for UI presets; `tech-debt` + `standup` → user-scope; `product-management` → not shipped (already REJECT). (c) `security-guidance` mining → STUDY item in the adapter contour.** Token angle closed: coexistence ≈ 1,402 est-tokens, NOT a binding constraint (trio §A4). | §B1 per-subplugin verdicts are round-2 operator-validated; §B3 explicitly defers the channel split to this contour. 1-button only where the preset's majority needs it; personal-preference items stay user-scope. | A preset consumer cohort measurably wants `tech-debt`/`standup` by default → promote those rows to the preset manifest. |
| N1 | Re-write triggers (WRITE 43.1%) | **Discipline + measurement, no new structure.** (a) Resume-as-expensive already codified (`cold-seat-economy.md §3`). (b) Add to the same skill-embeds: prefer artifact handoff to a fresh seat over `/compact`; do not stretch a seat across the 1-hour TTL idle gap. (c) Size each trigger class (TTL expiry / `/compact` / resume) inside S-E's N2 measurement. | WRITE splits into an unavoidable part (every new token written once at 2×) and an avoidable part — full prefix re-writes on the ~5% genuine full-rewrite turns, each costing an entire prefix. This attacks the **trigger**, not the payload (prep-doc §7 item 2 requirement). | N2 measures avoidable re-writes at <5% of the WRITE line → the discipline text is empty; retire it. |
| N2 | Dispatch inlining — discipline or gate? | **Default-in-template, not a gate.** Inlined-dispatch format becomes the documented default of the dispatcher/harvest dispatch templates (where the cold-seat-economy embed already sits). Promotion trigger: 3 incidents of a seat burning >100k tokens on file-reading turns → mechanical check in S-B's bottom-seat station. | A hard gate is `#gate-where-judgment-needed` (some seats legitimately need tools); bare prose is `#hope-as-gate`. Measured stake: 85,855 vs 177,105 tokens per seat (~52%). | The promotion trigger fires → build the mechanical check; OR inlined dispatches start missing regressions a file-reading seat catches (cold-seat-economy §3's own falsifier). |

**Dropped with evidence — L1 (Bash/Read output economy):** RTK empirical test measured 1.8% of
total weighted cost on our real mix (9.4% of Bash bytes; 71% of our Bash calls are compound
commands RTK refuses to rewrite), below the 5% falsifier threshold; the config-only variant
shares the same measured ceiling. Per the operator's own brief («не мелочи») this is below the
decision floor. Re-entry trigger already recorded in SSOT #233.

## §2 The generalisable position (prep-doc §7 item 6)

**Build the config-assertion gate — it is ADR-3/S-E subject matter, not a new idea.** The §3
defect survived a research stage, a cold review, and a root-cause session because a pattern that
matches nothing has no failure signal — [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md)
in config form. Config is a rule; rules get executable tests. Two deterministic asserts, each at
its earliest reachable channel:

1. **Committed-list liveness (CI-reachable):** a principle test asserting every
   `claudeMdExcludes` entry in `.claude/settings.json` (a) is in matchable form (starts with `/`
   or `**/` — the shipped normaliser skips everything else), and (b) matches ≥1 real file under
   the repo (picomatch-equivalent, `{dot:true}`).
2. **Local-shadow detection (host-only → pre-push + `worktree-doctor`):** if
   `.claude/settings.local.json` defines `claudeMdExcludes`, it must be a superset of the
   project list — otherwise error-with-escape-token (CI cannot see this file; pre-push is the
   earliest reachable channel for host-local config).

This is the contour's **cheaply-killable proposal** (prep-doc §7 item 3): if the harness changes
matching semantics, assert 1 fails loudly — which is exactly the desired behaviour.

## §3 Proposals → stage routing, each with its cost line

| # | Proposal | Lands in | Cost line attacked | Size (denominator stated) |
|---|---|---|---|---|
| P1 | §3 config fix, **both halves atomically**: project `claudeMdExcludes` → 7 glob-form entries AND remove (or extend to the same seven) the `settings.local.json` override key. Either half alone regresses (prep-doc §3 arithmetic). | **operator** — `settings.json` is agent-uncommittable; `settings.local.json` is untracked | READ + WRITE | measured 15.9% of D (8.8k tokens × residency) |
| P2 | Config-assertion gate (§2 above) | **S-E** | same line — recurrence insurance | gate cost ~0; protects the P1 saving |
| P3 | Budget gate per ADR-3 + N2 measurement as input (re-write trigger class sizes, arrival-position distribution, edit-time-injection firing rates) + `InstructionsLoaded` verification task | **S-E** | READ + WRITE (ceilings) | per-environment, per ADR-3's post-falsifier scope: repo-owned always-on share only |
| P4 | S-D: close via `done.md` pointing at SSOT #234's three re-open triggers | **S-D** | — | — |
| P5 | `CLAUDE.md` trim (D1): converge to pointer discipline; `ai-laziness-traps.md` untouched | **S-F** (or a small Tier-1 stage if the diff outgrows the queue) | READ + WRITE | `CLAUDE.md` = 16.7% of always-on cost; pointer-form target ≈ half → ~8% of always-on |
| P6 | Re-write-trigger discipline text (N1b) into the existing cold-seat-economy skill-embeds | **S-F** | WRITE 43.1% — the **trigger**, not the payload | unsized until N2 (falsifier recorded in §1) |
| P7 | Inlined-dispatch as template default (N2) | **S-F** | WRITE + output | ~52% per cold seat, measured |
| P8 | `00-rule-index.md` `Channel(s)` column re-aligned with what actually loads | **S-F** | honesty of the L1 inventory | Tier-1 sweep |
| P9 | Trio channel-split wiring (D3b) — `companions.manifest` / `preset.meta.json` rows | **companion/beta track, Tier-1** — NOT this umbrella | none (≈1.4k est-tokens, not binding) | — |
| P10 | CC-plugin adapter + `security-guidance` mining | **separate /arch contour, later** | none (positioning) | — |

## §4 Umbrella dispositions (prep-doc §0 requirement)

| Umbrella | Disposition |
|---|---|
| `arch-v2-context-pipeline` | **ADVANCES.** S-D → closed explicitly (ADR-2 selected the null option; none of SSOT #234's three re-open triggers has fired; `done.md`, never a silent skip). S-E → strengthened: P2 + P3 with the §3 finding as fresh kickoff evidence. S-F → +3 items (P6, P7, P8; P5 rides here too). |
| `per-role-context-cold-verify` | **CLOSES.** The design its header reserved for «a later /arch session» is this contour's verdict: per-role L2 is not built — SSOT #234's DEFER/null stands, no fresh evidence in the prep-doc moves any of its triggers. Umbrella closes with `done.md`; the living residue is the trigger set in #234. |
| research-patch trio / plugin thread | **ADVANCES + routed.** Token question closed (§A4, not binding); channel split resolved (D3b); adapter + security-guidance mining routed to their own contour (P10). Out-of-scope observation, not acted on: the 2026-08-02/-06 corpus lives only on `feat/prune-worktrees` and needs harvesting to staging. |

## §5 Exit routing (/arch §3)

- **Operator, manual (the highest-value item):** P1 — both halves. One edit per file; the gate
  (P2) then prevents recurrence. Routed to operator because both surfaces are agent-unwritable
  (prep-doc §3 status: two agent edit attempts were correctly refused by the permission layer).
- **Factory-bound:** the S-E kickoff (P2 + P3) is Tier-2; the design judgment is spent in this
  contour, so once the kickoff is plan-complete AND this spec's §2 cold review returns GO, it
  dispatches WITH the `bridge-profile` marker (precondition verified ACTIVE, header of this
  spec). S-F additions (P5-P8) are Tier-1 queue items on the existing stage.
- **Bookkeeping:** P4 (`done.md` for S-D), umbrella closure `done.md` for
  `per-role-context-cold-verify` per the umbrella-closure convention.
- **Deferred contours:** P9 (companion track, after operator-confirmed manifest rows), P10
  (separate /arch).

## §6 §1.7 self-reflexive note

**Forward-check.** Complies with [`build-first-reuse-default.md §1.1`](../../../.claude/rules/build-first-reuse-default.md):
no BUILD verdict is issued anywhere — P2 is a principle-test/pre-push assert (cheap under the
cost gate), L1/RTK stays DEFER per SSOT #233, the L2 build stays un-built per #234. Complies
with [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md):
the one new check proposed (P2) is a deterministic gate, not attention; N2's promotion path
names its mechanical successor. Complies with [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md):
every proposed gate is deterministic. T20: every resolution in §1 carries grounds + falsifier;
the one deliberately unsized quantity (P6) says so instead of carrying a plausible estimate.

**Backward-check.** Class of this change = *artefacts that rank, size, or adjudicate
context/token-economy levers*. Surfaces: the distillate (§3/§4/§6) — **superseded on its open
forks only** (D1-D3 resolved here, N-stages re-routed into S-E/S-F; its measurements and lever
table stand); the prep-doc — **consumed, not modified** (its §5 forks are the §1 rows); SSOT
#233/#234 — **cited, unchanged** (no verdict is re-opened); `cold-seat-economy.md` — **extended
prospectively** (P6 adds embed text; the rule itself unchanged until S-F executes);
`session-start-token-audit` (closed) — **untouched** (its banked trim is P1's regression
baseline). No other live artefact ranks these levers.

**Self-application (T15).** This spec is decision-layer material consumed once by stage
kickoffs — it must never become always-on residency; nothing here asks for that. The contour
consumed the distillate + addressed sections only (the prep-doc's own §6 reading rule),
i.e. the L2/P7 discipline applied to this contour's own production.

## See also

- prep-doc: `docs/superpowers/specs/2026-08-06-arch-prep-pipeline-token-economy.md` (feat/prune-worktrees).
- [`2026-07-31-arch-v2-context-pipeline-design.md`](2026-07-31-arch-v2-context-pipeline-design.md) — ADR-1..ADR-8 (staging).
- `2026-08-01-token-economy-distillate.md` — measurements + lever table (staging).
- [`2026-08-02-rtk-empirical-test.md`](../../meta-factory/research-patches/2026-08-02-rtk-empirical-test.md) — the L1 kill evidence (this branch).
- `2026-08-02-superpowers-vs-trio.md` §B, `2026-08-02-webresearch-anthropic-first-party-plugins.md` §10 (feat/prune-worktrees) — the D3 evidence base.
