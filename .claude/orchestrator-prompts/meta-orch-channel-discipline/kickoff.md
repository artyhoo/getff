# Umbrella: meta-orchestrator channel-discipline — Class C → A promotion

> **Status:** DRAFT planned 2026-05-26. **NOT yet dispatched.** Awaits Stage 5 dogfood settle + Phase -1 cold-review of this kickoff itself.
> **Authoritative for:** umbrella scope + 3-stage breakdown + admission gates for promoting [`SKILL.md §5 #worker-dispatch-via-subagent`](../../../.claude/skills/pipeline/SKILL.md) from Class C prose enforcement to an executable artefact at the earliest reachable channel.
> **NOT authoritative for:** choice of enforcement mechanism (Stage A R-phase decides — do NOT pre-commit to «principle test» despite the umbrella's working title; that wording is a starting hypothesis, not a verdict) / project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

> **Origin:** Stage 5 dogfood Phase -1 cold-review (2026-05-26) caught Stage 5 kickoff drafted with explicit `#worker-dispatch-via-subagent` violation in §9 step 3: «Dispatch Worker via Agent tool with explicit model: opus + isolation: worktree». Substrate declares the rule in prose at SKILL.md:347 («Agent tool is ONLY for Phase -1 read-only reviewer + read-only research subagents (text return). Write-task Worker dispatch belongs in a fresh CC session opened by the maintainer pasting a §10 1-liner block»). Substrate did NOT auto-catch the violation; manual cold-review did. This is the **first documented incident** of the rule failing to fire at any earlier-reachable channel than «production-audit-by-human-review» — the worst possible channel per README invariant.

> **Maintainer invitation:** 2026-05-26 — «можем открыть отдельную umbrella если надо делай! запланируй!». Honors `CLAUDE.md:87` PR-strategy: not autonomous — explicit invitation given.

---

## §0 The gap (single-paragraph framing)

`SKILL.md:347` declares `#worker-dispatch-via-subagent` an anti-pattern. The substrate's routing tree at `SKILL.md §2.5` (L1→L5) outputs a **Mode** (DIRECT/SOLO/PAIR/BUNDLE/DECOMPOSE/RESEARCH) — but **NOT a channel** (Agent-tool inline vs. maintainer-paste 1-liner). Channel-choice is a judgement step layered on top of Mode, **not mechanically computed**. Result: an AI session can pass routing tree clean, generate a kickoff that internally contradicts §5, and only a manual cold-review catches it. README invariant («every rule = executable artifact at earliest reachable channel; CI is last resort») is violated for this specific rule.

---

## §1 Admission gates — DO NOT dispatch Stage A until ALL of these hold

1. **Stage 5 dogfood umbrella `meta-orchestrator-mode-triage-and-planner` merged to staging.** Premature mechanization on unvalidated substrate compounds risk.
2. **Phase -1 cold-review of THIS kickoff complete** (1× Opus reviewer default per orchestrator skill Phase -1 protocol). Cold-review must walk Stage A R-phase scope for hidden assumptions before R-phase dispatches.
3. **Maintainer decision on promotion criterion strength.** Class C → A historically requires «3 incidents in 6 months» (`reviewer-discipline.md §4`, `parallel-subwave-isolation.md §4` sibling). But load-bearing single-incident precedents exist (`ai-laziness-traps.md §2 T17` — destructive-delegation mechanism designed at 1/3 incidents counter). DECISION-NEEDED at admission time: promote on Stage 5 single-incident **OR** wait for ≥2 more incidents. Maintainer chooses; do NOT pre-empt.

If gate 3 resolves «wait» → this kickoff stays parked. Substrate's autonomous-discovery may re-surface it later; admission gate re-checked then.

---

## §2 Stage breakdown

### Stage A — R-phase: pick enforcement mechanism (single R-phase session)

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-meta-orch-channel-discipline-mechanism.md` (tracked, PR'd as one Mode A inline session).

**Must cover:**

1. **`build-first-reuse-default.md §3` 6-layer search** (mandatory before any BUILD verdict):
   - SSOT consult `docs/meta-factory/prior-art-evaluations.md` keyword: «channel-discipline», «dispatch routing», «agent vs subagent enforcement».
   - DeepWiki `ask_question` ≥3 phrasings on companion projects: Superpowers, `oh-my-openagent` (Tier 1 per `feedback_ai_doc_research_priority_pool`), AIF, aif-handoff. Do they have channel-routing enforcement? Cite each result.
   - WebSearch ≥3 phrasings on problem-domain: «AI orchestrator dispatch channel discipline», «subagent vs subprocess audit trail», «two-key dispatch protocol multi-agent».
   - Cite candidates; identify Verdict per `build-first-reuse-default.md §1` ladder (ADOPT / ADOPT-VOCABULARY / ADAPT / REFERENCE / KEEP-NARROW / BUILD / REJECT).

2. **Mechanism candidates to compare** (initial list — Stage A may add more from search):
   - **M1 — PostToolUse hook** on Edit/Write touching `.claude/orchestrator-prompts/**`. Regex/AST check for kickoff text patterns suggesting Agent-tool dispatch for write-task Workers in meta-orchestrator umbrella territory. **Edit-time enforcement — earliest reachable channel** per `rule-enforcement-channel-selection.md §4`. Falsifier: kickoff is gitignored → CI cannot see it → hook is the ONLY earlier channel available. <!-- channel-discipline: allow this umbrella's own kickoff plans the M6 gate -->
   - **M2 — principle test on tracked artefacts** that encode channel routing (templates, decision matrices inside SKILL.md). Limitation: cannot directly validate kickoff text since kickoff gitignored; can only validate proxy artefacts (template completeness, SKILL.md routing table internal consistency).
   - **M3 — substrate-internal helper** like `pick-channel.sh` that takes `(Mode, Type, SubwaveNature)` and returns endorsed channel. New routing-tree step §2.6 follows §2.5. AI session MUST invoke the helper — still vulnerable to T7 («skip the helper invocation») per `ai-laziness-traps.md §2`.
   - **M4 — hybrid:** M3 helper + M1 hook that injects the helper's verdict at Edit-time when kickoff is touched. Belt + suspenders.
   - **M5 — accept Class C, document explicitly:** no mechanism. Acceptable iff incident rate stays <1/year and §13.x reviewer-cycle gates catch recurrences. Default if M1-M4 all fail BFR-default search.

3. **Recursive self-application gate:** any chosen mechanism MUST be testable against the Stage 5 incident as ground-truth fixture (the original kickoff §9 step 3 text — extract verbatim, store in `__fixtures__/stage-5-dispatch-violation.txt`). If mechanism doesn't fire on the fixture → mechanism doesn't enforce; broken.

4. **`no-paid-llm-in-ci.md §1` compliance:** mechanism must be deterministic bash/regex/AST. No LLM calls in CI; no API-billed calls anywhere in the enforcement path.

5. **DECISION-NEEDED list** surfaced to maintainer at R-phase close — at minimum: which mechanism wins + scope of self-fixture corpus + whether to widen scope to other §5-style anti-patterns (`#commit-on-behalf-of-worker` at SKILL.md:348 is structurally similar).

### Stage B — I-phase: implement chosen mechanism

**Dependencies:** Stage A R-phase merged + maintainer GO on chosen mechanism.

**Output:** PR landing:
- Mechanism implementation (hook script / principle test / helper / hybrid per Stage A verdict).
- Self-test of the mechanism (paired-negative test: mechanism MUST fail on the Stage 5 violation fixture, MUST pass on a clean fixture).
- Rule file update (`SKILL.md §5` Class field amended from «prose only» to the new Class).
- `Prior-art:` trailer citing Stage A SSOT entry.
- §1.7 Forward + Backward checks per `phase-research-coverage.md §1.7`.

### Stage C — validation: dogfood the mechanism

**Dependencies:** Stage B merged.

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-meta-orch-channel-discipline-dogfood.md` verifying:
- Mechanism fires on the Stage 5 fixture (ground-truth retro-catch).
- Mechanism does NOT fire on any other recent kickoff (false-positive sweep across `.claude/orchestrator-prompts/**/*.md` last 10 umbrellas).
- Hook performance (if M1/M4): ≤200ms wall-clock per Edit (no perceptible latency).
- Recursive self-application: this dogfood patch itself passes the mechanism.

---

## §3 Out of scope (anti-drive-by)

- Re-litigating substrate §5 anti-pattern itself. The rule stays; only enforcement layer added.
- Touching `SKILL.md §2.5` routing-tree internal logic (Stage A R-phase MAY propose a new §2.6 channel-routing step, but that ships separately in Stage B and goes through its own R-phase deliberation).
- Adding new anti-patterns. `#worker-dispatch-via-subagent` is the single target; `#commit-on-behalf-of-worker` (SKILL.md:348) is structurally similar and surfaced as DECISION-NEEDED in Stage A §5 — but not in scope by default.
- Modifying the orchestrator skill (`~/.claude/skills/orchestrator/`) — that's maintainer-owned, agent-uncommittable per memory `feedback_settings_json_agent_uncommittable`-style discipline.

---

## §4 §1.7 Forward-check applied (planning-level — full §1.7 ships with Stage A/B/C PRs)

- [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) — Stage A R-phase carries explicit 6-layer search obligation before any BUILD verdict.
- [`no-paid-llm-in-ci.md §1`](../../../.claude/rules/no-paid-llm-in-ci.md) — Stage A explicitly excludes any API-billed mechanism; Stage B implementation deterministic bash/AST only.
- [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md) — every Stage PR carries its own §1.7; this kickoff §4-§5 is planning-level forward/backward, not the final per-PR §1.7.
- [`feedback_no_drive_by_prs` / CLAUDE.md:87](../../../CLAUDE.md) — umbrella opened with explicit maintainer invitation 2026-05-26; not drive-by.
- [`parallel-subwave-isolation.md §1`](../../../.claude/rules/parallel-subwave-isolation.md) — each Stage dispatched in dedicated worktree.
- [`rule-enforcement-channel-selection.md §3`](../../../.claude/rules/rule-enforcement-channel-selection.md) — Stage A R-phase applies the §3 channel-selection procedure (detectability → enforcement type; relevance-frequency → delivery breadth).
- [`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md) — every Stage A mechanism verdict cites SSOT row + substrate output in same turn.
- [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md) — Stage A/B/C kickoffs enumerate T-numbers + add domain-specific traps (suggested: T-MOCD-A «mechanism that requires AI to remember it ≠ mechanism that enforces», T-MOCD-B «promote on N=1 incident is premature mechanization»).

## §5 §1.7 Backward-check applied (planning-level)

- Predecessor incident: Stage 5 dogfood Phase -1 catch (2026-05-26). See §0 above.
- No other anti-pattern enforcement work in-flight at planning time (verified: `git log --oneline staging -20` 2026-05-26 — only Stage 4 #244 merge ea82de8 + Stage 3 #243 c4b63ac + Stage 2C #242 a57a664 in recent history, no channel-discipline work).
- Substrate §5 prose remains source-of-truth for the rule; this umbrella only adds an enforcement layer beneath it. No rule semantics changed.
- Class C/A ladder precedents:
  - `reviewer-discipline.md` (Class C, promotion at 3 incidents) — sibling.
  - `parallel-subwave-isolation.md` (Class C demoted from B, retention via Superpowers `using-git-worktrees` REFERENCE) — sibling demonstrating both promotion AND demotion paths.
  - `ai-laziness-traps.md T17` (mechanism shipped at 1/3 incidents counter) — precedent for early-promotion.
  - `dual-implementation-discipline.md §9` — explicit promotion-counter shape («3 violations within 6 months OR 5th dual-channel artefact»). Stage A R-phase should reuse this pattern.

---

## §6 See also

- [`SKILL.md:347-348`](../../../.claude/skills/pipeline/SKILL.md) — the anti-patterns this umbrella enforces (`#worker-dispatch-via-subagent` primary, `#commit-on-behalf-of-worker` adjacent).
- [`.claude/rules/rule-enforcement-channel-selection.md §3-§4`](../../../.claude/rules/rule-enforcement-channel-selection.md) — channel-selection procedure Stage A applies.
- [`.claude/rules/ai-laziness-traps.md §2 T7`](../../../.claude/rules/ai-laziness-traps.md) — the trap «AI remembers §5» relies on; mechanism's whole purpose is to remove this reliance.
- [`packages/core/principles/19-meta-orchestrator-alias-routing-consistency.test.ts`](../../../packages/core/principles/19-meta-orchestrator-alias-routing-consistency.test.ts) — precedent substrate-internal principle test (alias-routing consistency); Stage B can model on it if M2 wins.
- [`.claude/hooks/inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) + [`.claude/hooks/check-doc-authority.sh`](../../../.claude/hooks/check-doc-authority.sh) — existing PostToolUse hooks; Stage B can model on these if M1/M4 wins.
- [`docs/meta-factory/research-patches/2026-05-22-rule-enforcement-channel-selection.md`](../../../docs/meta-factory/research-patches/2026-05-22-rule-enforcement-channel-selection.md) — origin patch for the channel-selection principle Stage A applies; recursive-self-application precedent.
