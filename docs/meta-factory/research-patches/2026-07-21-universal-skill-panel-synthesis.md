<!-- scope:universal-skill-panel-synthesis -->
> **Scope:** `docs/meta-factory/research-patches/` (folder-authority inherited — see `research-patches/README.md`).
> **Status:** RESEARCH-PREP CONTINUATION — extends [2026-07-18-universal-skill-stack-driven-prep.md](2026-07-18-universal-skill-stack-driven-prep.md) (the "stronger model" session that prep anticipated ran 2026-07-21). Decides the delegated design default (§1 D3) and resolves the prep's §8 questions; commits to NO implementation. Session-start prompt for the design session: [docs/meta-factory/2026-07-21-universal-skill-design-session-prompt.md](../2026-07-21-universal-skill-design-session-prompt.md).
> **Method:** Interactive discussion (operator + Fable) + a 12-agent adversarial panel (6 subsystem map readers → 4 independent design perspectives → 2 adversarial skeptics, ~1.7M tokens). All load-bearing file:line refs re-verified against `origin/staging` at 2026-07-21 by the panel; the panel itself caught one worktree-vs-staging divergence (`deps-hash-check.sh` DH-S1 vs DH-S2), so **re-verify every ref live at design time** (T3).
> **Date:** 2026-07-21.
> **NOT authoritative for:** the project goal — see `README.md#why-this-exists`. Staleness detection/routing — owned by the deps-hash-multistack umbrella (§5 coordination note).

# Universal skill, stack-driven: panel synthesis + delegated decisions

## §0. Why this doc exists

The 2026-07-18 prep captured the operator's idea (one universal skill + regenerated stack data) and left §8 open questions "for the stronger model". This session ran that discussion: verified understanding with the operator, ran an adversarial panel over the repo, resolved the open questions, and recorded three new operator decisions — including one design default the operator explicitly delegated ("подумай, как лучше — учитывая текущий проект"). Output feeds a design session (brainstorming → design doc → possibly umbrella kickoff), via the companion prompt file.

## §1. Decisions recorded this session

**D1 — The pattern is general, and the skill SHIPS to consumers.** Operator, verbatim intent: *"я хочу чтобы этот скил поставлялся из этого проекта всем консьюмерам … полная автогенерация: от стека — правила, от правил — тесты + скил, который знает как с этим конкретным стеком работать"*. The consumer-facing deliverable chain becomes: detect → research → rules → tests → **skill** (the missing third deliverable: the consumer AI's interface to what the framework generated). Delivery rides the EXISTING two-plane channel (§5) — zero new delivery infrastructure.

**D2 — The shipped skill is static + universal; "knows your stack" = composition, never generation.** The skill is NEVER generated per-stack: a generated skill is a preset, and presets rot (the project's own thesis, `README.md#why-this-exists`); a per-stack generated skill multiplies every procedure bugfix across N rotting copies — reproducing the exact pain the idea exists to kill. Instead: static universal skill × regenerated per-stack dossier (rules, tests, capability map, lock — all data-plane). Consumer-visible behavior is identical ("the skill knows my stack"); maintenance behavior is opposite (skill bugfix = one `--refresh` for all; stack version move = data regen, skill untouched).

**D3 — Staleness response default (delegated to Fable by the operator; operator-overridable at the design session).** v0 = **detect → explain → offer → run-on-consent**: on a staleness signal the skill quotes the freshness facts ("rules synthesized from docs fetched N days ago"), names the regeneration procedure (rule-research → `./setup --full` → verify), and offers to run it in the same session; it runs only on consent. Full autonomous regeneration ships only behind an explicit consumer opt-in config — the recorded promotion trigger.
*Rationale:* (a) regeneration is an LLM frontend act with live-docs research — it cannot be a deterministic hook, so "auto" means hijacking the consumer's session mid-task for a long research pass; (b) regeneration rewrites committed consumer data (`force:true` overwrites `rules-lock`, rules can appear/disappear) — a policy-bearing change in a repo where the framework is a guest under the three-layer authority model (`INSTALL-FOR-AI.md`); (c) the consent step preserves the two-artifact split (consumer skill routes to the generator; does not silently become its orchestrator).
*Falsifier:* wrong if dogfood/consumer evidence shows the consent step is where regeneration dies (offers systematically ignored, staleness rots) — then the WARN is `#warning-nobody-reads` theatre (attention-is-not-a-mechanism §1) and the default flips to opt-out auto.

## §2. Prep §8 questions — resolution status

| Q | Status | Resolution |
|---|---|---|
| Q1 name | RECOMMENDED | Skill `rule-tests` (mirror pair to `rule-research`); umbrella `rule-tests-surface`. NEVER `universal-*` — a name asserting universality invites scope creep (T16 applied to naming); universality is an earned per-cell matrix claim. Ratify at design session. |
| Q2 scope | RESOLVED (unanimous) | Gap only. Do not duplicate `rule-research` (rules/patterns surface EXISTS). |
| Q3 one/two skills | RECOMMENDED | One new skill, one protocol document (`agents/rule-test-author.md`) for the write-half only; verify-half is a deterministic recipe (dispatch + quote tool verdicts, zero LLM adjudication). Cost unit = the protocol, not the skill (31-line trigger precedent). |
| Q4 in-skill vs in-data | RESOLVED (doctrine) | Three bins by invalidation source (§4), not two. |
| Q5 ConventionNode precondition | RESOLVED (unanimous + skeptic-confirmed) | NOT a precondition. The tests seam (firing-contract + mandatory `pairedExamples`, `ir/types.ts:40`) is invariant to both ir-unfreeze options. §6 prohibitions carve out the collision. |

## §3. Panel findings — three strikes that reshaped the concept

**Strike 1 — the verify-half has no unserved consumer invoker.** L4 `validate()` is embedded in the generate path (`synthesizer/generate-cli.ts:26-29`; a rejected rule never reaches disk), the mutation kill-floor auto-runs at `./setup --full`, firing tests run in framework CI. Two-root split: validator CLI and firing runners exist only in the framework checkout — `install.sh` ships consumers only the `hooks/` + `eslint-rules/` slices plus `scripts/run-generated-rule-mutation.sh`. A thin "verify router" skill would ship partially non-executable instructions.

**Strike 2 — the gap decomposes into TWO holes for TWO audiences.**
- *Consumer-side (real hole):* author/repair test data for an EXISTING rule — `negative-test` today is born only inside a full research pass.
- *Framework-side (real hole):* regenerate live-fired evidence — a toolchain pin bump turns the freshness gate RED with "regenerate the live-fired evidence", and no procedure exists. This loop is the ONLY confirmed recurring invoker of the verify surface (`composition/enforcement-line.ts:34-39`: a ✅ enforcement claim requires a live-fired matrix cell) — and it is the umbrella's natural recursive self-application: the framework as the skill's first consumer.

**Strike 3 — the honesty trilemma (the design session's central decision).** The "universal verify procedure" is structurally npm-shaped: validator eats only `SynthesisPlan` (mandatory `eslintConfigSnippet`, `synthesizer/types.ts:80`); on other lanes the sequence differs (grammar → render → spawn-firing, no validator, no mutation); for declarative ast-grep ALL five per-rule L4 gates are deliberate FAIL markers (FF3003/3010/3012/3015/3018, `diagnostics/registry.ts:180-260`); the firing contract has THREE shapes, not one (cargo/astgrep triple; ruff `expectedCodes[]`; npm in-process `{command, expectedRuleId}` without jsonPath); spawn-backend contracts pin ONE fixed rule, so verifying a NEW rule there collapses into writing a new fixture (a write-act). The skill must therefore carry a per-backend coverage honesty map, and it has exactly three forms: (a) prose in the protocol — stack facts that rot in the skill body; (b) data — a per-backend gate-capability table that does not exist yet as an artifact (new format → capability commit, BFR consult); (c) omit — shipped `#discipline-theatre`, excluded. Interim recommendation: (a) now with a recorded promotion trigger ("second edit of the map → promote to data + rendered surface"), and check first whether the EXISTING `capability-matrix.json` extends (build-first) before minting a new format.

**Deferred by doctrine:** mutation operators (11 esquery sed lines) stay bash until a SECOND rule-language exists — generalize-from-one is the union-IR death mode (MT spec "generalize-from-three"). Two panel perspectives proposed lifting them to data day-one; both were refuted by the spec's own discipline.

## §4. The seam doctrine (answers prep §8 Q4 and the operator's fusion doubt)

Classify any piece of knowledge K by what INVALIDATES it:
- world changed (framework release, docs edit, dep bump) → **data** (committed, provenance-stamped, regenerable);
- toolchain interface changed (CLI flags, output shape) → **adapter code** (pinned, ~40 LOC per tool — the third layer the naive two-layer model misses);
- our own spec changed → **skill/protocol** (the only knowledge allowed there).

Limits found by the skeptics: the grep test ("skill plane toolchain-name-free") catches vocabulary leaks (the shipped §MAJOR-1 ESQuery filter in `agents/rule-researcher.md`; eslint unions in `generate-port.ts:17,50`) but is BLIND to structural leaks — a procedure can contain zero toolchain names and still be single-stack-shaped. The two-artifact split relocates leaks (thin SKILL.md stays clean because the stack soaks the protocol layer below) rather than eliminating them; keeping the seam honest is an ongoing discipline (semantic review), not a one-time design act. Universality itself is negotiated per capability cell with dated live-fired evidence — the WASM/LSP survivor pattern vs union-IR death (MT spec §2).

## §5. Delivery + staleness (what already exists; coordination note)

The two-plane delivery channel D1 rides already operates: procedure-plane (`.claude/skills/`, `agents/` — framework-owned, updated only by manual `install.sh --refresh`, protected by three-layer authority) vs data-plane (`.ai-factory/*` — consumer-owned, regenerated, never touched by refresh). Known holes the design session must respect but NOT own: staleness routing is split (deps-hash WARN routes to `/tool-bootstrapping` only, `deps-hash-check.sh:209` — not to rule regeneration); two unlinked freshness ledgers (`tool-decisions.md` vs `rules-lock.<framework>.json` `sourceFingerprint`); timestamps (`fetchedAt`/`emittedAt`/`snapshotDate`) are read by nobody. Staleness detection/routing belongs to the **deps-hash-multistack** umbrella — the skill is the natural single destination for the signal ("one staleness signal → one regeneration procedure"), so design a coordination seam, do not fork a third ledger.

## §6. Sequencing vs ir-unfreeze

`ir-unfreeze` is double-blocked on owner decisions (OWNER-FORK-1 unfreeze-vs-stay-narrow AND Option-A-vs-B IR shape; kickoff STOP lines). rule-tests does NOT wait: the seam is invariant to both options. Three prohibitions carve out the entire collision zone: (i) no asserts on rendered bytes (only `RenderOutcome.kind` + diagnostic identity sets); (ii) `params` is opaque pass-through; (iii) relational conventions out of scope — the relational firing-RED is ir-unfreeze S2's deliverable. Run the pre-dispatch in-flight probe against ir-unfreeze at design/dispatch time regardless (CLAUDE.md operational conventions).

## §7. Open questions for the design session

- **O1 (first, ratify with operator):** scope fork — (A) consumer write/repair skill only; (B) A + framework-side evidence-regeneration procedure as second deliverable (RECOMMENDED: closes both §3 holes, gives verify a non-theatrical invoker, adds no new data format); (C) B + gate-capability map as data day-one (capability commit). Falsifier for B-over-A: a documented recurring consumer-side verify invoker would justify widening; falsifier for B-over-C: a second forced edit of the prose honesty map before the umbrella closes.
- **O2:** enrichment sidecar shape for non-npm test material (`negative-test`/fixture/engine — the frozen node cannot carry them; design without creeping toward union-IR).
- **O3:** evidence-regeneration procedure form — `agents/*.md` protocol vs documented runbook.
- **O4:** honesty-map home — prose-with-promotion-trigger vs extending `capability-matrix.json` (BFR consult; build-first).
- **O5:** final naming ratification (Q1 above).
- **O6:** the D3 consent UX concretely — where the offer lives (skill body? deps-hash WARN text? both) — coordinated with deps-hash-multistack per §5.

## §8. What was NOT done

- No kickoff written, no umbrella directory created, no code or engine edits, no SSOT row (the build-vs-reuse decision lands with the umbrella's first capability commit, not here).
- The 2026-07-18 prep patch was NOT modified (append-only folder; this file extends it).
- Panel raw outputs live in the session scratchpad only; everything load-bearing is restated here with refs.

## §9. §1.7 self-reflexive note

**Forward-check (this patch complies with active disciplines):** research-prep continuation, no rule introduced, no capability commit, no dependency — the CLAUDE.md capability-commit gate does not fire. Principle 10 satisfied (`<!-- scope:... -->` line 1); principle 13 satisfied (this section); folder authority per `research-patches/README.md` (no per-file Authoritative-for header needed). Recommendation discipline (§1.7/§1.12 of `phase-research-coverage.md`): every verdict above carries evidence refs and a falsifier (D3, O1); the delegated D3 default is recorded as operator-overridable, not silently load-bearing. `no-paid-llm-in-ci.md`: prose artifact, no CI gate.

**Backward-check.** Class of this change = "a prep/synthesis patch that scopes a future umbrella without committing to it, plus a companion session prompt". Surfaces where the class occurs: peer prep patches under `research-patches/` (`2026-07-18-universal-skill-stack-driven-prep.md`, `2026-07-18-claude-glm-executor-handoff-facts.md`, `2026-07-18-zcode-full-parity-census.md`) and the prompt-file precedent `docs/meta-factory/2026-07-18-deps-hash-multistack-S2S3-night-prompt.md`. Per surface: SWEPT-CLEAN — each peer likewise separates verified findings from uncommitted design intent and defers its SSOT row to the implementing umbrella; the prompt file follows the deps-hash prompt placement convention exactly (same directory, same date-slug-prompt naming). This patch supersedes nothing and introduces no competing convention. GAP-FOUND: none.

**Self-application (T15):** the patch's own subject is separating slow-aging procedure from fast-aging facts — it practices that separation: decisions and doctrine (slow) are stated once; every fast-aging fact is carried as a file:line ref explicitly marked "re-verify live at design time" rather than restated as standing truth.

**Tags:** `research-prep`, `skill-architecture`, `universal-skill`, `rule-tests-surface`, `capability-matrix`, `staleness-routing`, `delegated-decision`.
