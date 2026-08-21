<!-- scope:aif-skills-delivery-rphase -->
# KICKOFF — aif-skills-delivery-rphase

> **Type:** R-phase (RESEARCH ONLY — produce research-patch, NO production code).
> **Runs:** operator-side CC tab (needs DeepWiki + WebSearch MCPs — not in container).
> **Base:** staging.
> **Deliverable:** TWO artifacts, committed and PR-opened before handoff:
> 1. `docs/meta-factory/research-patches/2026-06-03-aif-skills-delivery.md` — best practices survey + verdict
> 2. PR `research/aif-skills-delivery-rphase` opened against staging with auto-merge DISABLED (maintainer reviews first)
> 
> **Final step (mandatory):** `git checkout -b research/aif-skills-delivery-rphase origin/staging && git add ... && git commit && git push && gh pr create --base staging --no-auto-merge`

---

## §0 Problem (one line)

When work is dispatched to aif-handoff, the agent runs in a container that only sees the repo clone — no `~/.claude/skills/orchestrator/`, no Superpowers, no reviewer skill. The operator wants aif to be able to call the orchestrator and use reviewer discipline autonomously, the same way the operator does on their machine.

---

## §1 Research questions

**Q1 — How does the industry solve "skills/context in autonomous agent containers"?**
- Search ≥3 phrasings: «autonomous agent skills context injection», «LLM agent system prompt container», «Claude Code agent skill delivery», «AI agent global context portable»
- Look at: Devin, SWE-agent, OpenHands (formerly OpenDevin), Cursor Rules, Aider conventions — how do they get persistent instructions into the agent?

**Q2 — What does aif-handoff itself do for skill delivery today?**
- DeepWiki: `ask_question` on `yuvalav/aif-handoff` (or whatever the repo is) — «how does aif-handoff deliver skills or system prompts to the agent?»
- Look at `.ai-factory/skill-context/` pattern — what is it, how is it populated, does it scale?

**Q3 — What patterns exist for the specific problem: "operator has global skills, container doesn't"?**
- Options to evaluate: (a) volume mount, (b) env-var injection at dispatch time, (c) skill-context committed to repo, (d) MCP server with skills, (e) pre-dispatch hydration, (f) skill bundling in kickoff payload
- For each: who does it, evidence (link/quote), cost, portability trade-off

**Q4 — T16 problem-class check: does any existing pattern map exactly to our problem?**
- Our problem class: «operator has 887-LOC orchestrator skill + Superpowers plugins; aif container must receive enough of it to plan+execute multi-stage tasks correctly»
- For each candidate: «Upstream solves X. Our problem is Y. Match? Evidence: …»

---

## §2 Evaluation criteria

| Criterion | Weight | Signal |
|---|---|---|
| Portability (works without operator's `~/.claude/`) | 3× | Consumer-safe if true |
| Completeness (full orchestrator discipline available) | 2× | Solves the actual gap |
| Effort to implement | 1× | Days not weeks |
| Resilience (survives container restart) | 2× | No re-setup per run |

---

## §3 Existing mechanisms in this repo (do NOT reinvent — T11)

- `packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md` (just shipped PR #390) — minimal worker discipline; does it cover enough?
- `agents/orchestrator-worker-discipline.md` (PR #390) — same, portable fallback
- `docs/runtime-bridge-setup.md §Operator convenience` — volume mount recipe (Candidate A, operator-axis)
- `.ai-factory/skill-context/aif-review/` + `aif-rules-check/` — precedent for the skill-context delivery channel

---

## §4 Expected output format

```markdown
## Verdict table

| Option | Source | Problem-class match | Portability | Effort | Recommended? |
|---|---|---|---|---|---|
| Volume mount (`~/.claude/skills` → container) | ... | ... | operator-only | 2 lines | YES for operator |
| skill-context committed to repo | ... | ... | portable | medium | YES for shipped |
| MCP skills server | ... | ... | portable | high | DEFER |
| ... | ... | ... | ... | ... | ... |

## Recommended composition

<one paragraph — what combination ships operator-convenience + portable fallback>

## Open questions for I-phase

<what still needs a decision before implementation>
```

---

## §5 AI-traps active

- **T3** — re-confirm every claim with a URL or file:line, not training-data memory
- **T11/T12** — BFR search (DeepWiki + WebSearch ≥3 phrasings) before any BUILD verdict
- **T13/T16** — verify upstream problem-class match explicitly, don't assume name similarity = same problem
- **T15** — self-application: does this research itself apply to future aif R-phases?
- **T19** — own cold-QA on research-patch before PR
- **T20** — every verdict needs ≥1 evidence-bearing tool call in same turn

**Domain trap T-ASD-A:** «just use volume mount» without checking portability cost for consumers. The operator-axis fix is clear; the shipped-axis answer requires more thought.

---

## §6 Deliverable checklist (mandatory before handoff)

- [ ] `docs/meta-factory/research-patches/2026-06-03-aif-skills-delivery.md` written with `<!-- scope:aif-skills-delivery-rphase -->` on line 1 and `Authoritative-for` header
- [ ] PR opened against staging with `--no-auto-merge` (maintainer reviews before merge)
- [ ] Principle 10 scope annotation present
- [ ] `Prior-art: ...` trailer in commit message (reference SSOT rows for aif-handoff #67/#97 + skill-context #50)
- [ ] End with `## REPORT` block per `agents/orchestrator-worker-discipline.md`

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
