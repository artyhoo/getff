# SKILL.md description quality — discipline rule

> **Class:** C — prose-only; no current executable artifact. Promotion criterion in §3. Deferred per the R4b decision in the research-application-fixes umbrella (2026-06-27): «no misrouting incidents yet; a structural length/non-empty proxy would be `#discipline-theatre`; defer is explicitly valid when the trigger is recorded».
> **Authoritative for:** SKILL.md `description` field quality discipline — §1 the problem and evidence, §2 the deferred discipline and its rationale, §3 promotion criterion (≥3 misrouting incidents / 6 months), §4 §1.7 self-reflexive note, §5 see-also.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Structural presence checks on SKILL.md files — see [packages/core/principles/15-skill-paired-negative.test.ts](../../packages/core/principles/15-skill-paired-negative.test.ts) (paired-negative) and [packages/core/principles/14-skill-drift-detection.test.ts](../../packages/core/principles/14-skill-drift-detection.test.ts) (frontmatter drift). SSOT entry for SkillRouter — see [docs/meta-factory/prior-art-evaluations.md #179](../../docs/meta-factory/prior-art-evaluations.md).

> **Origin:** research-application-audit 2026-06-27 (R4 PARTIAL finding). SkillRouter (arxiv 2603.22455, [SSOT #179](../../docs/meta-factory/prior-art-evaluations.md)) showed that «hiding skill body → 31–44pp drop in routing accuracy», establishing that description quality materially affects routing — even in small registries. This finding was recorded in `research-patches/2026-05-25-planner-completeness-prior-art.md` (L5 §1) but never codified as a project discipline or explicitly deferred. This rule closes that gap.

## §1 Problem

CC skill routing is driven primarily by the `description` field of `SKILL.md` files (per [build-first-reuse-default.md §1.1](build-first-reuse-default.md) and Superpowers CSO vocabulary, [SSOT #58](../../docs/meta-factory/prior-art-evaluations.md)). A vague, empty, or misleading `description` causes the model to skip the skill when it would have been appropriate, or to invoke it when it would not.

**Empirical evidence (SkillRouter, [SSOT #179](../../docs/meta-factory/prior-art-evaluations.md)):** hiding the skill body and routing only on the description produces a 31–44 percentage-point drop in task-routing accuracy. This is the large-registry (80K+) result; at our small scale (~15 skills) the absolute drop is lower, but the *mechanism* is the same — description quality is load-bearing for routing quality.

Principles 14 and 15 check **structural presence** (frontmatter fields exist and are non-drifted; paired-negative block present) but **not quality**: a `description: "Helper"` passes both tests and still misroutes every task. The quality gap is unaddressed.

## §2 Deferred discipline — rationale and current state

**Why defer now:**

1. **No recorded misrouting incidents.** The promotion criterion (§3) is incident-driven: build the gate when it proves necessary, not in anticipation. Building a structural proxy (length ≥ N chars, non-empty `when_to_use`) before any incident is `#discipline-theatre` — the check passes even for low-quality descriptions that are merely long.
2. **Semantic quality is judgment, not mechanical.** A useful quality test requires a semantic probe (does the description make the use-case distinguishable?), not a structural grep. At Class C, a prose rule + self-reflection is the right level; promoting to Class A requires either a semantic sub-agent (non-zero inference cost) or a curated allowlist of canonical `description` patterns — both are premature before incidents reveal the actual failure modes.
3. **Slot 30 is the lowest-free principle slot** at the time of this rule's creation (verified 2026-06-27: slots 01–29 occupied or assigned). Pre-reserving a slot for a quality test that may never be needed wastes a slot number.

**Current expectation for authors of new SKILL.md files:**

- The `description` field MUST be specific enough to distinguish the skill from its peers in the registry. Vague one-word summaries (`"Helper"`, `"Tool"`) are not compliant with this rule even in the absence of a mechanical gate.
- The `when_to_use` section (or equivalent trigger block) MUST enumerate at least one **concrete trigger phrase or condition** under which the skill applies.
- Authors SHOULD self-check: *if I had to route a task description to this skill using only its `description` field, would the routing be unambiguous?*

These expectations are enforced at review time, not by a gate.

## §3 Promotion criterion

Promote this rule to **Class A** (principle test) when **≥3 documented misrouting incidents** are recorded in `.claude/rules/` or `docs/meta-factory/research-patches/` within a 6-month window — each with evidence linking the routing failure to description quality (e.g. skill was invoked for the wrong task, or not invoked when it should have been, and the root cause traces to an ambiguous or uninformative `description` field).

**On promotion:** write a principle test at the lowest-free slot at that time (currently 30 as of 2026-06-27). The test design should be **semantic, not purely structural** — a structural proxy (non-empty, length ≥ N) would be `#discipline-theatre`. Recommended approach: a curated set of positive/negative description examples per skill, maintained as test fixtures, with a paired-negative block per skill (mirrors the pattern established by principle 15). If ≥3 incidents all share the same failure shape, that shape becomes the test corpus.

**Retirement criterion:** 12 consecutive months with zero misrouting incidents traced to description quality AND zero promotions to Class A triggered → archive to prose note in [CLAUDE.md](../../CLAUDE.md) and delete this file. Matches peer-rule retirement criteria ([reviewer-discipline.md §4](reviewer-discipline.md)).

## §4 §1.7 self-reflexive note

- **Forward-check:** complies with [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md) (this rule has no CI mechanism — it is prose-only Class C; the eventual Class A test, if semantic, must use the AI-agnostic sub-agent pattern per `no-paid-llm-in-ci.md §1`); complies with [build-first-reuse-default.md §1](build-first-reuse-default.md) (REFERENCE SkillRouter as evidence, no BUILD decision — the deferred mechanism, if built, will consult SSOT first); complies with [doc-authority-hierarchy.md §2-§3](doc-authority-hierarchy.md) (this file carries Class C + Authoritative-for header and is registered in principle 09 `REQUIRED_HEADER_DOCS`); complies with [dual-implementation-discipline.md §2(i)](dual-implementation-discipline.md) (this is a markdown-only artefact — §2 non-trigger (i), no portable fallback required); complies with [recommendation-laziness-discipline.md §3](recommendation-laziness-discipline.md) (cite SSOT #179 by ID; evidence = research-patch L5 §1 + SkillRouter arxiv; falsifier = «wrong if ≥3 misrouting incidents expose a structural pattern that a proxy *would* catch»).
- **Backward-check:** this rule introduces no new mechanism; it codifies a deferred discipline with an explicit promotion criterion. Existing SKILL.md files are not retroactively invalidated — the rule is forward-going (authors of new/updated SKILL.md files apply §2 expectations at authoring time). The principle-09 registration ensures this file itself has a valid authority header (recursive self-application per [ai-laziness-traps.md §2 T15](ai-laziness-traps.md)). No existing rule is superseded.

## §5 See also

- [docs/meta-factory/prior-art-evaluations.md #179](../../docs/meta-factory/prior-art-evaluations.md) — SkillRouter SSOT entry (REFERENCE verdict + Trigger to revisit).
- [docs/meta-factory/research-patches/2026-05-25-planner-completeness-prior-art.md](../../docs/meta-factory/research-patches/2026-05-25-planner-completeness-prior-art.md) — L5 §1 origin (where the SkillRouter finding was first recorded, 2026-05-25).
- [packages/core/principles/14-skill-drift-detection.test.ts](../../packages/core/principles/14-skill-drift-detection.test.ts) — structural frontmatter presence check (complement to this rule's quality concern).
- [packages/core/principles/15-skill-paired-negative.test.ts](../../packages/core/principles/15-skill-paired-negative.test.ts) — structural paired-negative presence check (complement to this rule's quality concern).
- [.claude/rules/ai-laziness-traps.md §2 T16](ai-laziness-traps.md) — `#pattern-matching-on-name` trap: naming a skill `description` field vaguely because «any description will do» is T16 applied to authors (matching on the field name, not on the routing function).
- [.claude/rules/doc-authority-hierarchy.md](doc-authority-hierarchy.md) — header format spec this file follows.
- [packages/core/principles/09-doc-authority-hierarchy.ts](../../packages/core/principles/09-doc-authority-hierarchy.ts) — `REQUIRED_HEADER_DOCS` (this rule is registered there per §2 registration requirement for `.claude/rules/*.md` files).
