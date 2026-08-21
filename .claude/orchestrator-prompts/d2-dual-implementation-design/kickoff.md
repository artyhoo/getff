# Kickoff — D2 dual-implementation discipline design (Opus burn, iterative)

> **Mode:** Opus burn — Mode A inline Opus subagents для research + draft, iterative reviewer↔orchestrator до substantive GO.
> **Burn auth:** explicit — thorough analysis, design thinking allowed to take 30-60 min, multi-step follow-ups OK.
> **State file:** `.claude/orchestrator-prompts/d2-dual-implementation-design/state.md` (создать на старте).
> **Predecessor:** 2026-05-16 strategic D-items dialogue — D2 verdict B+ «soft case-by-case + dual-implementation discipline». 5 ризк-mitigation seed готов в `.claude/orchestrator-prompts/d-items-strategic-dialogue/decisions.md` §D2. Design session deferred at dialogue time для focused thinking.
> **Output:** new rule file under `.claude/rules/` + self-review patch under `docs/meta-factory/research-patches/`. Optionally: design-stub for companion principle test (deferred to future implementation moment).

---

## Phase -1 — Iteratively review THIS kickoff before designing (MANDATORY)

Design work has more degrees of freedom than execution → even more critical to catch kickoff gaps before they propagate into the rule itself.

### Self-review protocol

1. **Read this entire kickoff cold** — pretend you didn't write it.
2. **Spawn Mode A Opus subagent** with design-critique lens:

```
Task description: Review d2-dual-implementation-design kickoff for design-readiness
Subagent prompt:
  You are a cold-start reviewer for a design-session kickoff. Read
  `.claude/orchestrator-prompts/d2-dual-implementation-design/kickoff.md`
  completely. Critique it for:
    (a) Ambiguous scope — does the kickoff make it clear what the new rule
        DOES and DOESN'T govern? Soft scope = drift waiting to happen.
    (b) Missing prior-art consultation mandate — the rule is potentially
        capability-shaped (introduces new discipline). Verify the kickoff
        forces SSOT consult (build-vs-reuse invariant) before drafting,
        not after.
    (c) Conflicts with existing discipline rules — does the new rule
        overlap with `phase-research-coverage.md`, `doc-authority-hierarchy.md`,
        `no-paid-llm-in-ci.md`, `ai-laziness-traps.md`, or
        `parallel-subwave-isolation.md`? Especially: does it duplicate
        what's already in `.claude/rules/build-first-reuse-default.md`
        (if that file exists at execution time)?
    (d) §1.7 self-reflexive trigger — the design must walk its own rule
        through §1.7 forward + backward checks. Kickoff should mandate
        this, not leave it optional.
    (e) Missing T-trap enumeration per `.claude/rules/ai-laziness-traps.md §3`.
    (f) Stale references — verify principle 11 (BFR-default) state, verify
        ai-docs skill state per D-AuditC-3 (now in projects/ subdir?), etc.
    (g) Scope-creep risk into «full framework re-architecture» — design
        session for ONE rule, not project-wide redesign.

  Return:
    - List of findings classified BLOCKER / MAJOR / MINOR
    - For each: concrete fix
    - Verdict: GO / REVISE
```

3. **Address findings:** BLOCKER/MAJOR → amend kickoff directly. MINOR → state.md known-residuals.
4. **Re-review** if BLOCKER amended. Max 3 iterations.
5. **Only then** Phase 0.

---

## Phase 0 — Mandatory reads + project state

1. **Read in order:**
   - `README.md` §«Why this exists» — goal hierarchy (note: README does NOT list «AI-agnostic» as invariant; this is part of why D2 is design-not-codification)
   - `.claude/session-bootstrap.md` — invariants snapshot
   - `CLAUDE.md` — Artifact Ownership Contract, build-vs-reuse invariant, capability-commit definition
   - `.claude/orchestrator-prompts/d-items-strategic-dialogue/decisions.md` §D2 — verbatim verdict + 5-point seed
   - `.claude/rules/` — ALL existing rules, scan for overlap risk:
     - `phase-research-coverage.md` — search-discipline (different domain, but pattern reference)
     - `doc-authority-hierarchy.md` — doc-authority (pattern reference for header format)
     - `no-paid-llm-in-ci.md` — policy interaction (dual-implementation must not introduce paid-LLM-in-CI for either channel)
     - `ai-laziness-traps.md` — T16 «pattern-matching-on-name» critical for «is feature SAME-CLASS to CC primitive?» judgment
     - `parallel-subwave-isolation.md` — pattern reference
     - `reviewer-discipline.md` — pattern reference
     - `build-first-reuse-default.md` (if exists — check) — potential overlap or companion
   - `docs/meta-factory/prior-art-evaluations.md` — SSOT, scan for «dual-implementation» / «framework-agnostic» / «native-fallback» entries
   - `.claude/rules/ai-laziness-traps.md` §2 T11, T16 — active for D2 work
2. **Project state probe:**
   ```bash
   git status --short
   git log origin/main..HEAD --oneline
   gh pr list --repo Yhooi2/rules-as-tests-aif --state open
   ls .claude/rules/                                  # see what rules exist + check naming convention
   ls packages/core/principles/                       # check slot for future companion test
   ls docs/meta-factory/research-patches/ | grep -i dual\|native\|agnostic   # any prior work
   ```
3. **Verify Wave 1 + Wave 2 + Wave 3 status** if those PRs are open/merged — design may want to cite §1.10 (Wave 1 shipped) or skill-drift-detection (Wave 3 shipped) as examples.

---

## Scope — what's being designed

### Output 1 — New rule file under `.claude/rules/`

**Working name:** `.claude/rules/dual-implementation-discipline.md` (orchestrator may pick a better name based on naming conventions discovered in Phase 0).

**The rule governs:** when introducing a new framework capability (skill, agent, hook, gate, audit probe, etc.) that has BOTH a Claude-Code-native delivery (CC hook event, MCP server, CC settings) AND a portable AI-agnostic delivery (markdown prompt read by active session, deterministic bash/TS script), how to decide which to ship, when to ship both, and how to keep dual versions in sync.

**Mandatory rule sections (based on existing rule conventions discovered in Phase 0):**

1. **Authoritative-for header** — per doc-authority-hierarchy.md §3.
2. **§1 — Problem this solves** — pain that motivates the rule. From decisions.md D2 verdict text + dialogue context.
3. **§2 — The discipline / when to invoke** — clear triggers + non-triggers (when this rule does NOT apply). **Explicit non-triggers must include at minimum:** (a) features where no CC-native primitive exists at all (markdown-only artefacts, prose discipline rules) — nothing to «be portable about»; (b) internal-only tooling that will provably never reach consumer projects (orchestrator-side scripts under `.claude/orchestrator-prompts/`, retros, this kickoff); (c) one-off fixes that don't introduce a reusable capability. List ≥2 worked examples per category.
4. **§3 — Triage by audience** (from 5-point seed item 2):
   - Internal tooling (orchestrator skill, audit-self) → default CC-native
   - Consumer-facing (rules-as-tests skill, sub-agents, audit-ai-docs) → default dual
   - Performance-critical (think-time gate, real-time enforcement) → CC-native first, agnostic fallback optional
5. **§4 — Detection mechanism** (seed item 3): capability check via env var / settings.json presence, not brand-name string match.
6. **§5 — Drift check between channels** (seed item 4): mechanical meta-test that both versions cite same SSOT entry / principle. No LLM. Likely a grep-based principle test (companion to skill-drift detection from Wave 3).
7. **§6 — «CC лучший» bias mitigation** (seed item 5): each «ship CC-only» decision documented with rationale «Why CC-only here: …». Audit trail.
8. **§7 — Single source of truth** (seed item 1): one semantic prompt or one logic spec, two delivery channels. NEVER two prompts that drift.
9. **§8 — Anti-patterns** (named for fast pattern-match):
   - `#two-prompts-drift` — separate prompts for CC-native and agnostic versions
   - `#brand-name-detection` — capability check by «is this Claude Code?» instead of «does this env have hook capability?»
   - `#cc-only-without-rationale` — shipping CC-only with no documented Why
   - `#dual-when-internal-only` — burning dev cost on dual for tools only maintainer uses
   - (orchestrator may add 1-2 more during draft based on edge cases surfaced)
10. **§9 — Promotion / retirement triggers** — when this rule itself should be promoted (companion principle test) or retired (after N quarters of zero violations).
11. **§10 — See also** — cross-refs.

### Output 2 — Self-review patch

Per `phase-research-coverage.md §1.7` self-reflexive trigger: **every new discipline-bearing artefact ships with a self-review patch**.

**Path:** `docs/meta-factory/research-patches/2026-MM-DD-dual-implementation-discipline-self-review.md` (date at execution time).

**Content must include:**
- Forward-check: rule complies with R1-R20 (N/A doc), principle 09 doc-authority, capability-commit gate (Prior-art trailer needed if rule is capability-shaped), build-vs-reuse SSOT (entry added in same commit if new pattern), trigger sweep, doc-authority header.
- Backward-check: complete sweep of existing artefacts under the new rule's scope. What existing skill/agent/hook combos in this project would be classified «internal» / «consumer» / «perf-critical» under §3? List each + classification. Exemption mechanism for legacy items.
- Self-application test: would this rule have caught the original D2 problem (Stop hook native-CC primitive vs agnostic alternative)? Walk through.
- Tags: `#new-discipline-rule`, `#dual-implementation`, `#framework-portability`.

### Output 3 (optional) — Design stub for future companion principle test

**Trigger:** ship Output 3 ONLY when **both** of the following hold:

1. The §5 drift check designed in Output 1 is **non-trivial** — requires a `packages/core/principles/<N>.test.ts` with distinct test logic not already covered by principle 10 (`research-patch-annotation`) or 14 (`skill-drift-detection`). E.g. the drift check needs custom AST inspection, frontmatter parity diff, or cross-file semantic-anchor comparison.
2. The principle test would be **incrementally enforced** in CI — i.e. it covers cases the existing principles miss, not a re-implementation.

**Skip Output 3** if §5 resolves to a ≤20 LOC bash one-liner or is fully subsumed by principle 14 — in that case §5 ITSELF is the enforcement and no additional design.md is warranted.

If both triggers hold, write `packages/core/principles/<N>-<rule-name>.design.md` (NOT `.test.ts` yet — same pattern as `11-build-first-reuse-default.design.md`).

Slot N = next free integer. **Verified at kickoff-fix time:** taken slots are 1-11 (BFR-default `.design.md` at slot 11) and 14 (`14-skill-drift-detection.test.ts`, Wave 3 shipped 2026-05-16). **Next available: 12, 13, or 15+.** Pick the lowest free slot at draft time and re-verify via `ls packages/core/principles/` before naming the file. Defer test implementation to a future wave.

---

## Phase plan

### Phase 0a — worktree setup

```bash
cd /Users/art/code/rules-as-tests-aif
git fetch origin
git worktree add ../rules-as-tests-aif-d2-design origin/main
cd ../rules-as-tests-aif-d2-design
git checkout -b docs/dual-implementation-discipline-2026-05-16
git status                                                         # clean
```

### Phase 0b — build-vs-reuse SSOT consult (MANDATORY)

Spawn Mode A research subagent:

```
Task: Build-vs-reuse SSOT consult for «dual-implementation discipline» rule
Subagent prompt:
  Search for prior art on the discipline pattern about to be codified.
  Specifically:
    (a) Read docs/meta-factory/prior-art-evaluations.md — search entries
        for «dual», «native», «agnostic», «portable», «fallback»,
        «framework-specific vs framework-agnostic», «adopter-mode».
    (b) WebSearch ≥3 query phrasings for «framework dual-implementation
        discipline», «AI-agnostic vs platform-native rules», «portable
        plugin spec with native fast-path», «codified single-source
        multi-channel delivery».
    (c) DeepWiki query on adjacent repos: anthropics/claude-code,
        lee-to/aif-handoff, cline/cline, microsoft/agent-framework,
        prefecthq/marvin, OpenInterpreter/open-interpreter — any of
        them codify «pick CC-native vs portable» discipline?
    (d) context7 query on «Claude Code dual-mode», «portable agent
        framework discipline».

  Return:
    - For each search lane: top 3 results + relevance verdict
    - Verdict on whether a production-grade analog EXISTS
    - If yes: SSOT entry candidate (verbatim row format per
      prior-art-evaluations.md schema) — ADOPT/ADAPT/REFERENCE/REJECT
      verdict + rationale
    - If no: «no production analog» claim must pass `.claude/rules/phase-research-coverage.md` §1
      **10-item checklist** (§1.1-§1.10, post-PR #63) before orchestrator accepts it.
      Specifically apply:
        * §1.1 own-stack sweep (own dependencies — claude-code itself, AIF, OhMyOpencode)
        * §1.2 category sweep (agent-harness, plugin-spec, CLI-portability frameworks)
        * §1.3 semantic-distance check (re-search one paradigm step removed)
        * §1.4 adversarial counter-prompt: «if a production framework codified
          CC-native vs portable channel discipline, what would its docs page look like?
          which OSS repo would host it?» — generate ≥1 counter-prompt and report
          whether it surfaces a candidate.
        * §1.6 trigger sweep (grep open-questions.md for adjacent §13.x entries)

  Confidence: low/medium/high with calibration note. Skipping any §1.x item → REVISE.
```

This is **§1 search-coverage rule** applied to D2's design moment. If reviewer subagent later finds the consult was perfunctory → REVISE.

### Phase 1 — draft (Mode A inline Opus subagent)

After SSOT consult returns, spawn one design-draft subagent:

```
Task: Draft .claude/rules/dual-implementation-discipline.md (working name)
Subagent prompt:
  Write the new rule file per the structure in the kickoff §«Output 1»
  (10 sections + Authoritative-for header). Inputs:
    - 5-point seed from decisions.md §D2 (verbatim text below: <paste>)
    - SSOT consult result from Phase 0b (verbatim: <paste>)
    - Existing rule conventions from `.claude/rules/*.md` (read all,
      match the prevailing style — header format, anti-pattern naming,
      promotion/retirement section structure)

  Constraints:
    - Plain language for triage-by-audience section (this is the part
      maintainer will actually use day-to-day; clarity > comprehensiveness)
    - **Delivery-channel discipline, NOT build-vs-reuse.** §3 triage answers
      «CC-native vs portable channel for an own-built feature», NEVER
      «adopt upstream vs build ourselves». Build-vs-reuse is governed by
      `.claude/rules/build-first-reuse-default.md` — do not duplicate its
      vocabulary or verdict table.
    - Each §3 triage category includes a «may deviate when X» clause to
      preserve D2 B+ soft posture (e.g. «Internal tooling → default
      CC-native; may deviate when the tooling is intended for replication
      by consumer-maintained companion projects»).
    - **Calibrate imperative language:** avoid «MUST» / «SHALL» / «ALWAYS»
      in normative prose. Use «default» / «recommend» / «may deviate when X»
      per D2 B+ verdict + T-D2-A trap. «MUST» is acceptable only for
      hard-CI constraints (e.g. «drift check MUST be deterministic, no LLM»
      because §«No paid LLM in CI» is hard).
    - Mechanical anti-patterns (named) — at least 4, preferably 5-6.
      Each anti-pattern must be falsifiable (e.g.
      «two-prompts-drift = two .md files diverge by ≥3 substantive lines»
      IS falsifiable; «poorly-designed dual» is NOT).
    - Drift check section must specify a deterministic check (no LLM).
      Include either a bash one-liner sketch (≤20 LOC) OR a TypeScript
      test sketch (≤50 LOC) inline — sketch precedes claim per T-D2-C.
    - Promotion criteria must reference concrete incident threshold
      (e.g., «3 violations in 6 months → companion principle test»)
    - Word count target: 800-1500 words for SKILL-density without bloat
    - Apply T15: walk the rule through §1.7 forward+backward as you draft
      — flag any conflict with existing rules

  Return: complete markdown file content + DECISIONS log + ATTN.
```

### Phase 2 — orchestrator review of draft

Read draft. Check:
- All 10 sections + header present
- Anti-patterns ≥4, named with `#tag-format`
- Drift check is mechanical
- No paid-LLM-in-CI proposals
- No overlap with existing rules (re-verify post-draft)
- §1.7 self-reflexive trigger triggered (self-review patch is Output 2)

If gaps → REVISE prompt to subagent, re-dispatch.

### Phase 3 — self-review patch (Mode A subagent)

Spawn subagent to write Output 2 (research-patch):

```
Task: Write self-review research-patch for dual-implementation discipline
Subagent prompt:
  Read the draft rule (from Phase 1 output). Write a self-review patch
  at `docs/meta-factory/research-patches/2026-MM-DD-dual-implementation-discipline-self-review.md`
  following the T7 template:
    Problem → Root Cause → Solution → Prevention → Tags

  PLUS §1.7 sections:
    Forward-check: walk the new rule through R1-R20 (N/A doc), principle 09
      doc-authority (rule has header), capability-commit gate (rule is doc
      edit; if any companion design.md ≥80 LOC → Prior-art trailer needed),
      build-vs-reuse SSOT (entry from Phase 0b consult), trigger sweep,
      doc-authority.
    Backward-check: complete sweep of existing skills/agents/hooks in this
      project. List each + §3 triage classification. Exemption mechanism.
      **Substance-arm requirement (per Wave 1 PR #59 / PR #63 lesson):** EVERY
      entry in the sweep cites a concrete `file.ext:N` location (the SKILL.md
      line, the agent prompt header, the hook section). Prose-only entries
      («the orchestrator skill is internal») without file:line evidence are
      `#discipline-theatre` and fail the substance arm. Apply identical
      file:line discipline in Forward-check items: each layer walked through
      must cite the line of the existing artefact (CLAUDE.md line for
      capability-commit gate, etc.).

  Also include:
    - Recursive test: «would this rule have caught the original D2 question?»
      Walk through Stop hook native-CC vs agnostic alternative judgment.
    - Tags: ≥3 named tags.

  Return: complete markdown file content.
```

### Phase 4 — reviewer iter (Mode A subagent)

After both Outputs 1 + 2 drafted, spawn cold-start reviewer:

```
Task: Cold-start review of dual-implementation discipline rule + self-review patch
Subagent prompt:
  You haven't seen this design. Read:
    - .claude/rules/dual-implementation-discipline.md (or whatever name was chosen)
    - docs/meta-factory/research-patches/2026-MM-DD-dual-implementation-discipline-self-review.md
    - decisions.md §D2 (the verdict that motivated this)

  Critique:
    (a) Does the rule SOLVE the D2 problem or just describe it?
    (b) Is §3 triage actionable — given a new feature, can you apply
        the triage in <5 minutes?
    (c) Anti-patterns named are FALSIFIABLE? («Bad code» is not falsifiable;
        «two-prompts-drift = two .md files diverge by ≥3 substantive lines»
        IS falsifiable.)
    (d) Drift check is mechanically implementable (bash one-liner ≤20 LOC
        OR TS test ≤50 LOC)?
    (e) Self-review patch §1.7 forward+backward have file:line citations
        (regex match for CI gate)?
    (f) Promotion criteria — concrete or hand-wavy?
    (g) Does the rule self-apply (T15) — could it be invoked on its own
        design moment?

  Return: BLOCKER / MAJOR / MINOR + concrete fixes + GO/REVISE.
```

REVISE → orchestrator edits draft directly OR re-dispatches draft subagent with feedback. Max 3 iterations.

### Phase 5 — commit + PR

After reviewer GO, ship:
- Rule file + self-review patch + (optional) design.md stub
- One commit OR three commits per logical unit
- §1.7: trailer in commit body (since this IS rule-introducing — pre-push hook will warn otherwise; calibration window or not, comply)
- PR with substantive §1.7 sections containing file.ext:N citations (per Wave 1 lesson)

```bash
git push -u origin docs/dual-implementation-discipline-2026-05-16
gh pr create --repo Yhooi2/rules-as-tests-aif --base main \
  --head docs/dual-implementation-discipline-2026-05-16 \
  --title "docs(rules): add dual-implementation discipline (D2)" \
  --body "$(cat <<'EOF'
[PR body with summary + test plan + §1.7 Forward-check applied (≥1 file.ext:N)
+ §1.7 Backward-check applied (≥1 file.ext:N) + source dialogue reference]
EOF
)"
```

### Phase 6 — reviewer iter on PR

Same pattern as Wave 1/2/3: monitor CI, spawn cold-start reviewer if any check fails, fix, repeat. Max 3 iter before escalation.

---

## Hard constraints

- **Build-vs-reuse SSOT consult MANDATORY** (Phase 0b). No skipping with «we know what dual-implementation is». T11 active.
- **§1.7 self-reflexive trigger MANDATORY** — self-review patch is Output 2, not optional.
- **No paid LLM in CI.** Drift check must be deterministic. If you propose «LLM-judge for prompt parity» — STOP, redesign.
- **No drive-by edits.** This session ships dual-implementation rule + self-review patch + (optional) design stub. Nothing else. If you discover other rules need updating to reference new rule — surface in ATTN, do NOT autonomously edit.
- **Worktree mandatory.**
- **Doc-authority header MANDATORY** on the new rule file per `doc-authority-hierarchy.md §2`.
- **Capability-commit consideration.** New rule file alone is doc edit, not capability commit. But if Output 3 (design.md stub) is shipped AND it's ≥80 LOC, that triggers capability-commit gate → Prior-art trailer + SSOT entry in same commit. Resolve at draft time.
- **No project goal redefinition.** README §«Why this exists» is read-only per Artifact Ownership Contract. New rule subordinates to README, never the inverse.

---

## T-traps active

- **T11 build-vs-reuse before claiming «no production analog»** — Phase 0b SSOT consult is the mitigation. Skipping or perfunctory consult = `#own-stack-blind-spot` + `#semantic-anchor` antipatterns.
- **T15 self-application MANDATORY** — rule walks its own §1.7 forward+backward.
- **T16 problem-class match** — when classifying any existing skill/agent/hook under §3 triage, write «its problem class» vs «what §3 expects» explicitly. Pattern-matching by name (e.g., «orchestrator skill = internal tooling» without justification) fails T16.
- **T-D2-A (domain-specific):** «codifying soft convention as hard invariant» — D2 verdict B+ kept the posture SOFT (case-by-case), not as new README invariant. Drafting the rule with imperative «MUST» / «SHALL» language when verdict says «judgment call» = drift from intent. Calibrate language to «default» / «recommend» / «may deviate when X».
- **T-D2-B (domain-specific):** «inventing capability categories that don't fit existing artefacts» — §3 triage MUST be backward-checked against actual project state. If existing skill X doesn't fit any of the 3 categories cleanly, the triage is wrong, not the skill.
- **T-D2-C (domain-specific):** «drift check theatre» — proposing a meta-test in §5 without verifying it's mechanically implementable in <50 LOC. Sketch the implementation before claiming the check.

---

## State.md format

```markdown
# D2 dual-implementation discipline design state

> Session start: <ISO>
> Mode: Opus burn, iterative reviewer↔orchestrator
> Phase: -1 | 0a | 0b | 1 (draft) | 2 (review) | 3 (self-review patch) | 4 (reviewer iter) | 5 (PR) | 6 (PR review) | DONE

## Phase -1 — self-prompt review
- Iter <N>: findings, amendments, verdict
- Final: GO @ <ts>

## Phase 0 — bootstrap + SSOT consult
- ✓ Step 0 reads (existing rules scanned for overlap)
- ✓ Project state probed
- ✓ Build-vs-reuse SSOT consult: <ADOPT/ADAPT/BUILD/REJECT verdict>
  - Top candidates: <list>
  - SSOT entry decided: <verbatim row>

## Phase 1-4 — draft + review iter
- Draft iter <N>: <gist>
- Reviewer iter <N>: <BLOCKER/MAJOR/MINOR counts>, GO @ <ts>

## Phase 5-6 — PR + monitoring
- PR <URL>
- CI: <pass/fail counts>
- Reviewer iter on PR: <N>, GO @ <ts>

## History
[append-only log]
```

---

## Quota awareness

Design work, single PR, expected smaller than Wave 2+3:
- Self-review pass: 20-40k Opus
- Phase 0b SSOT consult subagent: 30-60k (heavy on WebSearch + DeepWiki)
- Phase 1 draft subagent: 40-80k
- Phase 2 orchestrator review: 10-20k
- Phase 3 self-review patch subagent: 30-50k
- Phase 4 reviewer subagent: 20-40k
- Phase 5-6 PR + CI iter: 20-50k
- **Total estimate: 170-340k Opus cumulative.**

If approaching Red zone mid-flow → pause, ask maintainer.

---

## What you DO NOT do

- Don't execute Wave 2 or Wave 3 — separate orchestrator session.
- Don't touch README / CLAUDE.md goal sections (Artifact Ownership Contract).
- Don't introduce a new README invariant («AI-agnostic by default» = README change, NOT D2 scope — D2 explicitly chose B+ soft, NOT A codify).
- Don't redesign existing rules. New rule references existing; doesn't replace.
- Don't ship the companion principle test (Output 3 = design.md stub only; test.ts is a future wave).
- Don't merge any PR yourself.

---

## Done — final report format

```markdown
## D2 design — DONE

### PR: <URL>
- New rule: `.claude/rules/<name>.md` (~<word count> words)
- Self-review patch: `docs/meta-factory/research-patches/2026-MM-DD-<name>-self-review.md`
- (Optional) Design stub: `packages/core/principles/<N>-<name>.design.md`

### Build-vs-reuse outcome
- SSOT consult: <verdict>
- New entry added: <SSOT row or «N/A — ADOPT/REFERENCE only»>

### Substantive review
- Reviewer iter <N>: GO
- Anti-patterns named: <count>
- Self-application test: passes (rule would have caught original D2 problem)

### CI on PR
- <pass>/<total> checks pass
- §1.7 substance gate: pass with N file:line citations

### Cumulative cost
- Opus tokens: <estimate>
- Wall-clock: <duration>

### Deferred to future
- Companion principle test (when threshold criteria fire)
- Any «adjacent rule updates» surfaced for separate session
```

---

## See also

- `.claude/orchestrator-prompts/d-items-strategic-dialogue/decisions.md` §D2 — verdict + 5-point seed
- `.claude/orchestrator-prompts/wave-2-3-execution/kickoff.md` — sibling Opus-burn iterative kickoff pattern
- Wave 1 PR #63 — working example of substantive §1.7 sections
- `.claude/rules/build-first-reuse-default.md` (if exists) — closest companion / overlap candidate
- `docs/meta-factory/prior-art-evaluations.md` — SSOT (consult target)
- `.claude/rules/phase-research-coverage.md §1.7 + §1.10` — rule-introduction discipline + type-system > prose
- `.claude/rules/no-paid-llm-in-ci.md` — constrains drift check design

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
