<!-- scope: session-start prompt — universal-skill (rule-tests) DESIGN session. Self-contained: paste into a fresh Fable session in this repo. Predecessors: research prep 2026-07-18 (#1048) + panel synthesis 2026-07-21 (this PR). Status at authoring: discussion closed, decisions D1-D3 recorded, design NOT started. -->

# Universal skill (rule-tests) — design-session prompt

Paste everything below into a fresh Fable session started in the `rules-as-tests-aif` repo (fresh worktree via `claude -w rule-tests-design` recommended).

---

You are continuing the "universal skill, stack-driven" thread — the operator's idea that one static, stack-agnostic skill plus regenerated per-stack data replaces the per-project per-version skills that rot. Two prior sessions closed the discussion phase; your job is the DESIGN phase.

## Step 0 — read in this order (before any output)

1. `README.md#why-this-exists` + `.claude/session-bootstrap.md` (goal + invariants).
2. `docs/meta-factory/research-patches/2026-07-18-universal-skill-stack-driven-prep.md` — the idea, verified understanding, repo inventory.
3. `docs/meta-factory/research-patches/2026-07-21-universal-skill-panel-synthesis.md` — the adversarial-panel synthesis: decisions D1-D3, resolved questions, the three strikes, the seam doctrine, open questions O1-O6. **This is your working brief.**
4. `.claude/orchestrator-prompts/ir-unfreeze/kickoff.md` — sequencing context only (double-blocked on owner; rule-tests does not wait — see synthesis §6 prohibitions).
5. `docs/superpowers/specs/2026-07-03-multi-toolchain-convention-compiler-design.md` §2-§5 — the doctrine any design must respect (narrow-core + capability matrix; "we build no runner").

Re-verify every load-bearing file:line against `origin/staging` at read time (T3 — staging moves; the panel itself caught one worktree divergence).

## Already DECIDED — do not re-litigate (operator may overturn, you may not)

- **D1:** the skill ships from this repo to all consumers; deliverable chain = detect → research → rules → tests → skill. Delivery rides the existing two-plane channel (procedure-plane `--refresh` vs data-plane regenerated).
- **D2:** the shipped skill is static + universal; "knows your stack" = static skill × regenerated dossier. The skill is NEVER generated per-stack.
- **D3 (delegated default, operator-overridable):** staleness response v0 = detect → explain → offer → run-on-consent; full auto-regeneration only behind explicit consumer opt-in config.
- **Q2:** scope = the gap only; do not duplicate `rule-research`.
- **Q5:** ConventionNode/IR migration is NOT a precondition; three prohibitions (no rendered-byte asserts, `params` opaque, relational out of scope) decouple from ir-unfreeze.
- Mutation operators stay bash until a second rule-language exists (generalize-from-one = union-IR death).

## Your task

1. **Open by ratifying O1 with the operator** (scope fork A/B/C — synthesis §7; present recommendation B first with its rationale and falsifiers, then ask). One question at a time; Russian in chat.
2. Then run the brainstorming → design flow (`superpowers:brainstorming`) over the remaining open questions O2-O6, in whatever order the O1 answer makes natural. Concept and architecture only — the operator has consistently asked for design before implementation.
3. Deliverable: a design doc at `docs/superpowers/specs/2026-07-XX-rule-tests-surface-design.md` (operator-approved section by section), and — only if the operator says go — an umbrella kickoff under `.claude/orchestrator-prompts/rule-tests-surface/` per `kickoff-staging-placement.md`.

## Design constraints (from the panel — violating these re-opens closed findings)

- The skill body holds ONLY: procedure invariant to stacks, format POINTERS (never copies), run-moment reading obligations (schemas, capability matrix), and the honesty discipline. Classify every piece of knowledge by the invalidation test (synthesis §4): world-invalidated → data; toolchain-interface-invalidated → adapter code; spec-invalidated → skill.
- The honesty trilemma (synthesis §3 strike 3) is the central design decision — resolve it explicitly in the design doc (prose-with-promotion-trigger vs extend `capability-matrix.json`; BFR consult before minting any new format).
- Respect the two-root split: consumers do not have validator CLI or firing runners; never ship instructions a consumer cannot execute.
- Verify-half = deterministic recipe quoting tool verdicts (zero LLM adjudication); write-half = the one protocol document (`agents/rule-test-author.md`), LLM behind provenance gates.
- Framework-side evidence-regeneration loop (yellow→green: rendered → live-fired) is the recursive self-application anchor if O1 = B.
- Staleness detection/routing belongs to deps-hash-multistack — design a coordination seam, never a third freshness ledger.

## Discipline

- Active traps: T3, T11, T12, T14, T15, T20, T21 (`.claude/rules/ai-laziness-traps.md` §2). Domain trap T-UTS-A: "the design quietly reintroduces a per-stack generated skill because it is convenient for feature X" — that is D2 inverted; STOP and surface instead.
- Pre-dispatch in-flight probe (CLAUDE.md operational conventions) before any dispatch — including against ir-unfreeze and deps-hash-multistack activity.
- BFR/SSOT consult + `Prior-art:` trailer on the first capability commit of any resulting umbrella (not on the design doc).
- No implementation, no engine edits, no new formats in the design session itself.

Start with Step 0, then greet the operator with a 5-line recap of where the thread stands and the O1 question.
