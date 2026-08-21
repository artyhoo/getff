# Agent-collision resolution — AUTONOMOUS DEEP-RESEARCH KICKOFF (C-1)

> **Status:** ARMED 2026-05-20.
> **Type:** standalone autonomous R-phase. Single long self-paced sitting. **Full autopilot — do NOT stop for clarifying questions** (collect every open decision in the report's DECISION-NEEDED list instead).
> **Deliverable:** ONE final report file + a copy-paste-ready recommendation paragraph the maintainer will paste back as the decision. **Research only — NO edits to live agent files, CLAUDE.md, principle 09, install.sh, README, or any shipped artefact. The implementation is a SEPARATE step after the maintainer accepts the recommendation.**
> **NO PR. NO commits to live code.** (You MAY commit the report itself if it lands under a tracked path; see §7.)
> **You are a FRESH session and inherit NO memory.** This kickoff is self-contained. Read every file in §2 Step 0 before reasoning.

---

## §1 The question to answer

AI Factory (`ai-factory init`, v2.11.0) ships three sub-agents into `.claude/agents/` whose filenames **collide** with three of ours:

- `best-practices-sidecar.md`
- `docs-auditor.md`
- `review-sidecar.md`

(Our fourth, `compliance-verifier.md`, has no collision — out of scope.)

Default `install.sh`/`setup.sh` (no `--force`) **skips** ours → AIF's thin stubs silently win. `--force` overwrites AIF's → strips frontmatter (`background:true`, `skills:[aif-*]`, `maxTurns`) that AIF's `implement-coordinator` **and** the separate `lee-to/aif-handoff` autonomous-Kanban runtime depend on (both load `.claude/agents/*.md` via `settingSources:["project"]`).

**For EACH of the 3 agents, decide the resolution:**

- **MERGE** — our prompt body + AIF's runtime frontmatter, one file under the shared name.
- **RENAME-SPLIT** — rename ours to a distinct name; both coexist (AIF keeps its slot).
- **KEEP-AIF** — AIF's version is good enough; drop/retire ours (if ours adds only maintenance cost).
- **TAKE-BEST / hybrid** — cherry-pick the better parts.

Produce a per-agent verdict + a holistic recommendation, **grounded in independently re-verified evidence**, and a single paste-back decision paragraph.

---

## §2 Step 0 — read before reasoning (you inherit no memory)

Read in this order. These establish the project goal, the verdict typology, and the discipline you must apply to your own output.

1. `README.md` §why-this-exists — project goal (do NOT let any other doc redefine it).
2. `.claude/session-bootstrap.md` — invariants + reading order.
3. `CLAUDE.md` — Artifact Ownership Contract (note line ~82 names `docs-auditor.md` + `best-practices-sidecar.md`), capability-commit definition, build-vs-reuse invariant.
4. `.claude/rules/build-first-reuse-default.md` §1 — the 7-verdict typology (ADOPT / ADOPT-VOCABULARY / ADAPT / REFERENCE / KEEP-NARROW / BUILD / REJECT). **Map each agent verdict onto this typology.**
5. `.claude/rules/ai-laziness-traps.md` — §2 trap catalogue. **§7 of THIS kickoff enumerates the active traps; you must instantiate their countermeasures, not just cite them.**
6. `.claude/rules/dual-implementation-discipline.md` — CC-native vs portable; the merge question is exactly a delivery-channel question (our portable markdown vs AIF's CC/runtime-wired frontmatter).
7. `.claude/rules/phase-research-coverage.md` §1 + §1.7 — search-coverage 6-item checklist + forward/backward self-reflection (apply to your own report).
8. `.claude/rules/no-paid-llm-in-ci.md` — any check you propose must be deterministic/subscription-bound, no paid API.

**Prior-work INPUTS — read, but treat every prior verdict as a HYPOTHESIS TO FALSIFY, not a given (T7):**

9. `docs/meta-factory/research-patches/2026-05-20-companion-integration-analysis.md` §6 (C-1) + §7 + §12 — origin of this question.
10. `.claude/orchestrator-prompts/companion-integration-analysis/drafts/agent-collision-detailed-comparison.md` — the prior session's per-agent verdict (2 MERGE + 1 RENAME). **Your job is to independently re-derive, confirm, or overturn this. Do NOT anchor on it.**
11. `.claude/orchestrator-prompts/companion-integration-analysis/drafts/agent-variants/*.{AIF,OURS}.md` — verbatim copies of both variants as of 2026-05-20. **Re-verify they still match reality (§4 step 1).**

---

## §3 Hard constraints

- **Full autopilot.** Do not ask the maintainer anything mid-run. Every fork → log it in the report's §DECISION-NEEDED with options + your recommendation, and continue with your best-judgment assumption (state the assumption).
- **Research only.** Do NOT edit `agents/*.md`, `CLAUDE.md`, `packages/core/principles/`, `install.sh`, `setup.sh`, `extension.json`, `README.md`, `INSTALL*.md`, or shipped `RULES*.md`. The deliverable is a recommendation; implementation is a separate maintainer-authorised step.
- **Worktree isolation.** First step: `git fetch origin` then `git worktree add ../rules-as-tests-aif-agent-collision -b research/agent-collision-resolution origin/main`. Work there. (The gitignored `.claude/orchestrator-prompts/agent-collision-resolution/` may be absent in the fresh worktree — symlink it from the main checkout, mirroring the `companion-integration-analysis` precedent, OR write your working files under a tracked path per §7.)
- **No paid LLM. No Superpowers install** (`/plugin install superpowers@...` FORBIDDEN — user-scope, no uninstall).
- **Re-verify, don't trust.** Re-run the AIF init probe on the *current* AIF version (do not reuse any stale `/tmp/cit-*` dir). Re-read both variants. Re-probe DeepWiki/WebSearch for the wiring claims.
- **T16 problem-class match** mandatory for every "same job / different job" claim: write «AIF problem class: X. Our problem class: Y. Match? evidence: …» per agent.
- **§1.7 forward+backward self-review** on your own report (mandatory final section).

---

## §3.5 MANDATORY FIRST STEP — self-review THIS kickoff (recursive)

Before §4, read this kickoff fully and §1.7-check it (forward: does §4 cover all decision criteria? are all cited paths real — `ls` them? are the §7 traps mapped to §4 steps?; backward: is every methodology claim justified?). Write findings to `hypotheses-log.md` (§5) as «Iteration 0 — kickoff self-review». If you find a BLOCKER defect in the kickoff, fix your approach and note it; do not silently proceed. Counter-prompt: «what would falsify the assumption that this kickoff produces a sound per-agent decision?»

---

## §4 Methodology (self-paced, long, iterative)

Think hard. Write as you go (§5). Rewrite hypotheses as evidence accumulates. There is no rush — depth over speed.

### §4.1 Re-establish ground truth (T2/T3/T-ACR-D — run, don't assume)

1. Fresh AIF probe: `mkdir /tmp/acr-$(date +%s) && cd … && git init && ai-factory init --agents claude`. Confirm it STILL ships the 3 colliding agents at the current version; record the version + their exact frontmatter + line counts. If AIF changed, the prior `agent-variants/*.AIF.md` snapshot is stale — use fresh.
2. Re-read all 3 OURS variants in full (`agents/*.md` on `origin/main`). Record their exact capabilities.
3. Verify the coupling claim: does our shipped `packages/preset-next-15-canonical/RULES.md` actually say `/aif-verify` "checks via best-practices-sidecar"? Quote line numbers. This is what makes pure-rename "orphan" our agents — confirm or refute.

### §4.2 Re-probe the wiring facts (T3 — cite every claim)

Via DeepWiki (`lee-to/ai-factory`, `lee-to/aif-handoff`) + WebSearch + Claude Code docs:
- How does AIF `implement-coordinator` discover/dispatch the sidecars? Is the `skills:[aif-*]` frontmatter REQUIRED for dispatch, or cosmetic? What happens if a sidecar file is replaced by one without it?
- How does `aif-handoff` consume `.claude/agents/*.md`? Would replacing a file's body (keeping frontmatter) break it? Would renaming (so the name disappears) break it?
- Does Claude Code load agents from `.claude/agents/<subdir>/*.md` (relevant if RENAME uses a subdir namespace rather than a filename prefix)? Cite the docs.
- Is there an upstream/community pattern for "extend or override a vendored sub-agent" (skill-context override, settings layering)? (T11 — check prior art before inventing a merge mechanism.) Consult `docs/meta-factory/prior-art-evaluations.md` SSOT + ≥3 search phrasings.

### §4.3 Per-agent evaluation (the core)

For EACH of the 3 agents, evaluate ALL FOUR options (MERGE / RENAME-SPLIT / KEEP-AIF / TAKE-BEST) against these criteria, with evidence:
- **Problem-class match (T16):** same job or different job? evidence.
- **Content quality delta:** what does ours add that AIF's lacks (and vice-versa)? Concrete, not "ours is richer".
- **Wiring necessity:** does this agent NEED AIF's auto-dispatch to be useful, or is it fine read manually?
- **Breakage risk:** does each option break AIF's coordinator or aif-handoff? (from §4.2 facts)
- **Maintenance cost (BFR-default §2):** single maintainer — does keeping ours earn its perpetual cost, or is KEEP-AIF cheaper?
- **BFR-default verdict** mapped onto the 7-type typology.
- **Reversibility / AIF-version-bump fragility:** if MERGE (install via --force), what happens when AIF updates its sidecar?

Produce a per-agent verdict with explicit rationale. **Do not assume the 3 agents get the same verdict** (T-ACR-A/B).

### §4.4 Holistic synthesis

- Combined install/coexistence story across all 3 + `compliance-verifier`.
- Blast radius of the recommended option (live artefacts to edit vs frozen/historical to leave — see prior draft §"Blast radius").
- A coexistence/version-bump safety check (deterministic, no LLM).

### §4.5 §1.7 self-review of the report (mandatory)

Forward: did you re-verify (not inherit) every prior verdict? did you run the probe? Backward: does each verdict follow from cited evidence? T15: did this research apply its own skepticism to its own conclusions? Counter-prompt each verdict: «what evidence would flip this from MERGE to RENAME (or to KEEP-AIF)?»

---

## §5 Working file — hypotheses log (write continuously, rewrite freely)

Maintain `hypotheses-log.md` in your working dir. Append/rewrite as you learn. Structure:
```text
## Iteration N — <what I just checked>
Hypothesis: …
Evidence gathered (command/cite): …
Updated belief: … (CONFIRMS / OVERTURNS / REFINES prior verdict on agent X)
Open question: …
```
This is the autopilot "think out loud, long, rewrite" surface. The maintainer expects to see iteration history here. No iteration cap — stop when verdicts stabilise (two consecutive iterations don't change any per-agent verdict) AND §4.5 passes.

---

## §6 Final deliverable

### §6.1 Report file: `docs/meta-factory/research-patches/2026-MM-DD-agent-collision-resolution.md`
(tracked path → survives across worktrees; carry `<!-- scope:agent-collision-resolution -->` first line per principle 10 + a doc-authority header per principle 09.)

Sections:
- §1 Question (recap)
- §2 Ground truth re-verified (fresh AIF probe output + version; both variants confirmed)
- §3 Wiring facts (DeepWiki/WebSearch/CC-docs cites)
- §4 Per-agent evaluation (4 options × 7 criteria each) → per-agent verdict
- §5 Holistic recommendation + blast radius + version-bump safety check
- §6 §1.7 forward+backward self-review (+ T15)
- §7 DECISION-NEEDED (anything you couldn't resolve autonomously)
- §8 **PASTE-BACK DECISION** — a single self-contained paragraph the maintainer can copy verbatim into the main session as the accepted decision (per-agent verdict + chosen names + 1-line rationale each). This is the headline output.
- §9 See also (links)

### §6.2 Keep `hypotheses-log.md` (working history) in the worktree/drafts.

### §6.3 Final chat message: a SHORT summary + the link to the report + the §8 paste-back paragraph inline, so the maintainer can copy it immediately.

---

## §7 AI-laziness traps active for this session

Per `ai-laziness-traps.md §3` — enumerated + instantiated, not blanket-cited.

- **T2** «methodology ≠ running it» — §4.1 MUST run a fresh `ai-factory init`, not describe it.
- **T3** «plausible without verification» — every wiring claim (§4.2) needs a DeepWiki query / repo cite / CC-doc link; every content claim needs a file:line.
- **T7** «pattern-match the prompt» — the prior 2-MERGE+1-RENAME verdict is the thing most likely to be lazily echoed. Re-derive from evidence; if you reach the same answer, show the independent derivation.
- **T11/T12** «design without prior-art» — before endorsing MERGE as the mechanism, check (§4.2) whether an upstream override/layering pattern already solves "extend a vendored sub-agent". SSOT consult + ≥3 search phrasings.
- **T13** «ADOPTED ≠ zero work» — AIF's agents are an adopted upstream; re-verify they still ship + still have the frontmatter the merge plan assumes.
- **T14** «clean ≠ no theatre» — if a verdict "feels obvious", that's a flag to dig, not to stop.
- **T15** «self-application» — §4.5 mandatory; the report must audit its own skepticism.
- **T16** «pattern-matching-on-name» — the entire collision IS a name-match; for each agent write the explicit «AIF problem class vs our problem class, match? evidence».
- **T-ACR-A** «trust the prior session» — the comparison draft was written by a session that also held the goal-context and may have rationalised; treat its split as unproven.
- **T-ACR-B** «merge-bias» — "best of both" sounds appealing; some agents may be better KEEP-AIF (ours = maintenance cost with little marginal value) or pure-RENAME. Force yourself to argue the KEEP-AIF case for each before rejecting it.
- **T-ACR-C** «frontmatter cargo-culting» — do not propose copying `skills:[aif-*]` without verifying those skills exist and that the link is load-bearing.
- **T-ACR-D** «stale-probe» — do not reuse the 2026-05-20 `/tmp/cit-*` dir or the `agent-variants/` snapshot as ground truth; re-run init.

---

## §8 What this session does NOT do

- Does NOT edit any live agent file, CLAUDE.md, principle 09, install.sh/setup.sh, extension.json, README/INSTALL, or shipped RULES*.md (research only).
- Does NOT open a PR or commit to live code (may commit the report under `docs/meta-factory/research-patches/`).
- Does NOT install Superpowers; does NOT install AIF or our framework into any real project (only `/tmp` probe).
- Does NOT touch frozen/historical docs (PROPOSAL.md, retros/*, other research-patches, audits, phase-*-research, closed-questions).
- Does NOT decide on the maintainer's behalf where genuine strategy is involved — surfaces those in §6.1 §7.

---

## §9 See also
- `docs/meta-factory/research-patches/2026-05-20-companion-integration-analysis.md` — parent R-phase (C-1 origin)
- `.claude/orchestrator-prompts/companion-integration-analysis/drafts/agent-collision-detailed-comparison.md` — prior verdict (hypothesis to test)
- `.claude/orchestrator-prompts/companion-integration-analysis/drafts/agent-variants/` — both variants, verbatim (re-verify freshness)
- `.claude/rules/build-first-reuse-default.md` — verdict typology
- `.claude/rules/dual-implementation-discipline.md` — portable-vs-CC-native framing of the merge question
- `.claude/rules/ai-laziness-traps.md` — trap catalogue

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
