# Next session kickoff — post-Wave-9 prioritisation

> **Status:** ARMED. Ready to paste as first message of a new Claude Code session (Opus). Local-only, gitignored, scope-bound to this session.
> **Date created:** 2026-05-13
> **Owner of decisions:** maintainer (Art). Session is dialogue-driven; do NOT auto-decide on its own.
> **Estimated length:** 30-60 min — D8 first (5-10 min), then priority survey (15-30 min), then chosen-wave kickoff hand-off.

---

## §0 What just happened (2026-05-13)

- **PR #51 (wave-9-batch) merged** — Wave 9 closure. Includes Wave 9.1-9.4 substance arms, research patch on PR-body §1.7 substance gap, SSOT #41 Danger JS ADOPT, backward-check parity arm with positive sanity job.
- **PR #52 (memory-codification-batch) merged** — 6 conventions moved from agent-memory to repo rules: no-paid-LLM-in-CI, reviewer-discipline, parallel-subwave-isolation, hook-stub-completeness, etc.
- **Wave 9 umbrella §13.31** — closed. All sub-waves shipped: 9.1 (principle 10 mutation arm), 9.2 (Stryker), 9.3 (shell test substance), 9.4 (body-prose §1.7 detection).
- **Wave 9.5** — D8 ESCALATE pending maintainer decision (this session's first task).
- **Phase 10 (§13.32)** — armed trigger fired: «Wave 9 closes AND maintainer commits to Phase 10 scope». Not yet launched.
- **Wave 10 hook architecture** — kickoff ready at [.claude/orchestrator-prompts/wave-10-hook-architecture/kickoff.md](../wave-10-hook-architecture/kickoff.md). Blocked on D1-D5 maintainer answers.
- **Think-time §1.7 research (§13.34)** — kickoff ready at [.claude/orchestrator-prompts/think-time-s17-gate/kickoff.md](../think-time-s17-gate/kickoff.md). Independent of Wave 10 timing.
- **SSOT #41 Danger JS** — verdict ADOPT but no adoption sub-wave yet scheduled. Natural fit as Wave 10.X.

---

## §1 Read-first (Step 0)

In order, read these files end-to-end before any decision:

1. [README.md#why-this-exists](../../../README.md) — project goal (authoritative).
2. [.claude/session-bootstrap.md](../../session-bootstrap.md) — invariants restated for this session.
3. [CLAUDE.md](../../../CLAUDE.md) — capability-commit gates, Artifact Ownership Contract.
4. [docs/meta-factory/open-questions.md §13.x entries 13.1, 13.2, 13.4, 13.5, 13.9](../../../docs/meta-factory/open-questions.md) — the 5 wishful triggers (D8 input).
5. [.claude/orchestrator-prompts/wave-9-discipline-theatre-audit/reviewer-d-phase-decisions.md D8 section (lines 149-170)](../wave-9-discipline-theatre-audit/reviewer-d-phase-decisions.md) — original D8 framing.
6. [docs/meta-factory/open-questions.md §13.32 (Phase 10 armed)](../../../docs/meta-factory/open-questions.md) + §13.34 (autonomous self-audit) — currently-armed entries.

Do NOT read all of open-questions.md cover-to-cover — only the 5 wishful entries + §13.32 + §13.34.

---

## §2 Task A — D8 resolution (5-10 minutes)

**Goal:** decide for each of the 5 wishful triggers — **archive** (move to `closed-questions.md`) or **formalize** (add explicit trigger condition, stays in `open-questions.md`).

### §2.1 The 5 entries

| § | Title | One-line scope |
|---|---|---|
| 13.1 | Granularity research | How to segment research patterns (one file = one rule?) — design hypothesis |
| 13.2 | Маркетинг и наименование | Project naming + positioning marketing question |
| 13.4 | Обработка legacy кодовой базы | UX for installing meta-factory into existing legacy projects |
| 13.5 | Multi-stack monorepos | Architecture hypothesis for repos with multiple stacks (Next + Fastify + TS-only) |
| 13.9 | Bypass `--no-verify` структурное решение | Hypothesis: CI gate on `.husky/` directory presence + audit-self consumer-side |

**Why «wishful»:** these entries have NO formal trigger-condition. They sit armed indefinitely with no signal for when they'd fire. Wave 9 R-phase category C7 («Process-and-prose artifacts») flagged this pattern as cognitive-overhead for AI sessions + risk of premature firing.

### §2.2 Decision per entry

For EACH of the 5, ask the maintainer one short question:

```text
§13.X — <title>:
  (a) Archive — move to closed-questions.md with rationale «wishful, no formal trigger, no consumer evidence»
  (b) Formalize — keep in open-questions.md, add explicit trigger: <propose 1 candidate trigger>
  (c) Other — maintainer specifies
```

For (b), propose a candidate trigger before asking. Example for §13.4:
> Trigger candidate: «first consumer installs meta-factory on a repo with ≥100 pre-existing violations and reports adoption friction».

### §2.3 Output of Task A

One commit `chore(open-questions): D8 resolution — archive/formalize 5 wishful triggers (§13.1/§13.2/§13.4/§13.5/§13.9)`.

Atomic move (for archive case): copy entry from `open-questions.md` to `closed-questions.md` with closure note, delete from `open-questions.md`.

For formalize case: edit `open-questions.md` to add `**Trigger:**` line.

**§1.7 trailer required** (touches `docs/meta-factory/` which is in pre-push gate). Backward-check sweep: enumerate which 5 entries moved/edited, cite line numbers per entry.

---

## §3 Task B — Priority survey (15-30 minutes)

After D8 closes, **survey the currently-armed work** and pick what to launch next. Do NOT silently start a wave — present the menu and let maintainer choose.

### §3.1 Currently-armed candidates

| Candidate | Kickoff path | Estimated scope | Status / blockers |
|---|---|---|---|
| **Wave 10 hook architecture** | [.claude/orchestrator-prompts/wave-10-hook-architecture/kickoff.md](../wave-10-hook-architecture/kickoff.md) | Bash hooks → TS-core migration. Multi-sub-wave (10.1-10.X). 1-2 weeks. | Blocked on D1-D5 maintainer answers in kickoff §6. |
| **Phase 10 umbrella (§13.32)** | None yet — entry in open-questions.md only | Project foundations audit + re-evaluation. 4-6 weeks meta-work. May surface foundational-thesis refinement. | Trigger fired (Wave 9 closed). Maintainer commit pending. Moratorium consideration warned in entry. |
| **Think-time §1.7 research (§13.34)** | [.claude/orchestrator-prompts/think-time-s17-gate/kickoff.md](../think-time-s17-gate/kickoff.md) | Research-only patch + adversarial extension. 1-2 sessions, ~3-5 days end-to-end. | Independent of Wave 10. No formal blocker. |
| **Danger JS adoption (SSOT #41)** | None yet | Adoption sub-wave: `dangerfile.ts` + §1.7 schema check + paired-negative tests + Stryker coverage. Natural Wave 10.X slot. | Verdict ADOPT (SSOT #41 fresh 2026-05-13). Could ship as standalone or fold into Wave 10. |
| **Memory-to-docs follow-ups** | [research-patches/2026-05-13-memory-to-docs-codification-audit.md §10](../../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md) | Long-tail memory entries (8 remaining of 14 swept; 6 codified in PR #52). Per-entry small commits. | PR #52 closed top-3 + opened umbrella for long-tail. Owner: pacing-flexible. |

### §3.2 Survey questions

Ask maintainer in this order:

**Q1.** Phase 10 umbrella (§13.32) — green light to start, defer, or close-without-action? (4-6 weeks meta-work is a real cost.)

**Q2.** Wave 10 hook architecture — answer D1-D5 from its kickoff §6 now to unblock? Or defer until Phase 10 decides on TS-core direction?

**Q3.** Think-time §1.7 research — launch as standalone session now (independent of Wave 10)? Or roll into a broader §13.34 umbrella?

**Q4.** Danger JS adoption — standalone sub-wave now, fold into Wave 10, or defer until consumer pain?

**Q5.** Memory-to-docs long-tail (8 remaining entries) — pace as you-go drive-by, or batch as Wave-equivalent?

### §3.3 Output of Task B

A single decision matrix posted to maintainer:

```text
| Q | Decision | Next-action |
|---|----------|-------------|
| Q1 | Phase 10 = <start | defer | close> | <single-line next action> |
| Q2 | Wave 10 = <unblock | defer> | <single-line next action> |
| Q3 | Think-time §1.7 = <launch | defer | umbrella> | <single-line next action> |
| Q4 | Danger JS = <standalone | fold | defer> | <single-line next action> |
| Q5 | Memory long-tail = <as-you-go | batch> | <single-line next action> |
```

Plus a **single recommended next launch** (one wave/research session to kick off after this priority session closes).

---

## §4 Task C — Launch the chosen next session (variable time)

Based on Q1-Q5, ONE of these paths:

- **(a) Phase 10 launch** — open new session with kickoff to be drafted in this session (§13.32 is currently kickoff-less).
- **(b) Wave 10 unblock** — answer D1-D5 in [wave-10-hook-architecture/kickoff.md §6](../wave-10-hook-architecture/kickoff.md), commit answers, hand off to Wave 10 R-phase session.
- **(c) Think-time research** — paste [think-time-s17-gate/kickoff.md](../think-time-s17-gate/kickoff.md) into a new session, no edits needed.
- **(d) Danger adoption** — draft Wave 10.X kickoff in this session, hand off to implementation session.
- **(e) Multiple combinations** — sequence the above with clear dependencies.

Do NOT execute the chosen launch in THIS session. This session's job is to prepare the hand-off artifact (kickoff file or answered D1-D5 commit).

---

## §5 Constraints

- **No drive-by PRs** outside the explicit Q1-Q5 decisions. If you spot a separate gap (e.g. doc inconsistency, broken link), log it as observation and ask before commit (per [memory `feedback_no_drive_by_prs`](../../../docs/meta-factory/closed-questions.md)).
- **No paid LLM in CI** policy holds (project invariant per memory + new `.claude/rules/no-paid-llm-in-ci.md` rule from PR #52).
- **§1.7 substance discipline** applies to this session's commits: any commit touching discipline-bearing files needs forward+backward checks with file:line citations. Backward gate now ENFORCED via [.github/workflows/discipline-self-check.yml:115-137](../../../.github/workflows/discipline-self-check.yml#L115-L137) — pure prose without `file.ext:N` will fail CI.
- **Wave 9.5 numbering avoided** for any new work in this session — Wave 9.5 was the original placeholder for D8 ESCALATE; that work IS this session. Do not invent further sub-waves of Wave 9 unless maintainer explicitly opens one.
- **Artifact Ownership Contract** (per [CLAUDE.md](../../../CLAUDE.md)): this session is allowed to edit `docs/meta-factory/open-questions.md`, `docs/meta-factory/closed-questions.md` (for archive moves), and add new kickoff files. It is NOT allowed to edit `README.md`, `.husky/pre-push`, `agents/*.md`, or any frozen artefact.

---

## §6 AI-laziness traps active for this session

Per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md):

**Active canonical traps for this session:**
- **T2** — «my methodology would catch theatre, so I don't need to run it». For D8, do NOT propose archive criteria without checking each of 5 entries individually. Concrete invocation required.
- **T3** — «plausible-looking finding without verification». Before recommending archive for §13.X, open the entry and confirm there's no trigger condition (some entries got formalized in later edits — check current state).
- **T8** — «asking maintainer to avoid doing the work». Do NOT delegate Q1-Q5 framing-decisions back to maintainer; propose a candidate decision with rationale for each, let maintainer accept/redirect.
- **T11** — «designing custom solution without checking external prior art». If Q4 leads to drafting Danger adoption kickoff, consult SSOT #41 (already done) + context7 for Danger JS docs before scoping.
- **T13** — «treating ADOPTED items as zero-work». SSOT #41 is fresh ADOPT — confirm by reading SSOT entry that adoption is verdict, not bookmark.
- **T15** — «self-application skipped». Mandatory. This session must include a §self-application step in its deliverable: «did this session's own work pass the §1.7 substance gate that just shipped in main?»

**Domain-specific trap for this session:**
- **T-NS-A** — «archive-by-default bias». When facing 5 wishful triggers, AI is tempted to recommend «archive all 5» because it's the path of least resistance (5 archive operations are trivial; 5 formalize operations require thought). Counter: explicitly consider WHICH of the 5 has a real, articulable trigger before falling back to archive.
- **T-NS-B** — «launch-Phase-10-now eagerness». §13.32 trigger fired and the entry is highly visible. AI is tempted to recommend «launch Phase 10 immediately». Counter: §13.32 explicitly warns «moratorium consideration» + «4-6 weeks meta-work» + «may itself become theatre». Maintainer cost-benefit comes BEFORE any recommendation.

---

## §7 Deliverable shape

By session end, expect:

1. **One commit** for D8 resolution (archive/formalize 5 wishful triggers + §1.7 trailer).
2. **One markdown summary** posted in-session for Q1-Q5 decision matrix.
3. **Zero or one kickoff/answers commit** for the chosen next launch (depending on which path).
4. **A short hand-off paragraph** for maintainer: «next session paste this prompt: <path>». Or: «no new session — work paced in this session».

Plus the standard self-application check (T15).

---

## §8 Anti-deliverables (do NOT produce)

- Long retrospective documents on Wave 9. PR #51/#52 are merged; retro lives in `docs/meta-factory/retros/` and is owned by phase orchestrator at retro time, not this session.
- New §13.x umbrella entries unless maintainer explicitly opens one in Q1-Q5.
- Touch-anything refactors. This is a prioritisation session, not implementation.
- Custom tooling. Use existing `gh`, `git`, `grep`, file reads only.

---

## See also

- [.claude/orchestrator-prompts/wave-9-discipline-theatre-audit/reviewer-d-phase-decisions.md](../wave-9-discipline-theatre-audit/reviewer-d-phase-decisions.md) — D8 original framing (lines 149-170).
- [.claude/orchestrator-prompts/wave-10-hook-architecture/kickoff.md](../wave-10-hook-architecture/kickoff.md) — Wave 10 ARMED.
- [.claude/orchestrator-prompts/think-time-s17-gate/kickoff.md](../think-time-s17-gate/kickoff.md) — §13.34 think-time research ARMED.
- [docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md](../../../docs/meta-factory/research-patches/2026-05-13-pr-body-s17-substance-gap.md) — PR-body §1.7 substance research (recently shipped).
- [docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md](../../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md) — memory-to-docs audit (parallel session, PR #52).
- [docs/meta-factory/prior-art-evaluations.md#41](../../../docs/meta-factory/prior-art-evaluations.md) — Danger JS ADOPT (fresh 2026-05-13).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
