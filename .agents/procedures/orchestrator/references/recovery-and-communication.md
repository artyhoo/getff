# orchestrator — recovery and communication

> **Authoritative for:** the selected orchestrator procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## Recovery patterns (what to do when something goes wrong)

Findings-driven rework — resume-vs-fresh implementer, the round cap, adjudication at the cap — is
owned by `Skill('superpowers:subagent-driven-development')` §The fix loop. The rows below are the
ones with no upstream owner, because they are about the senior/junior boundary in this workflow:

| Situation                                        | Senior's action                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `Confidence: low`                                | Ask the user for clarification; relay their answer to the junior               |
| `ATTN` non-empty                                 | Read the ATTN, decide: fix is fine and we move on / rework needed / ask        |
| Junior committed extras (refactor / extra files) | `git reset --soft HEAD~1` + prompt the junior to redo it narrowly              |
| Junior pushed on its own (a violation)           | Immediately `git push --delete <REMOTE> <branch>` after agreeing with the user |
| Two parallel Agents touched the same file        | Conflict. Resolve by hand; go sequential next time                             |
| Junior looped, cannot find the file              | Prompt with an explicit `find` command and a hint                              |
| User changes a fix mid-flight                    | Re-plan, note what is already done, continue                                   |
| Fix #N is technically impossible                 | **Pushback is allowed** — technical impossibility ≠ a UX opinion               |

---

## Queue mode — autonomous research multi-kickoff

Modes A/B serve **one task**; Queue mode serves **a series of research kickoffs**, run autonomously in cycles of Worker → file-system verify → Reviewer (GO/REVISE, max 5 iter) → anti-collusion spot-check → next.

**When:** ≥2 research kickoffs queued + the maintainer granted autonomy + each kickoff has self-contained acceptance criteria. **NOT for:** single kickoffs (Mode A/B), parallel code execution (Mode B × worktrees), kickoffs with open D-questions for the maintainer.

**Everything else — pre-flight checklist, state.md format, the dispatch cycle, the anti-collusion formula, iteration limits, escalation codes, dual-channel verification of CC claims, headless fallback: [references/queue-mode.md](queue-mode.md).** Traps: [references/ai-laziness-traps-orchestrator.md](ai-laziness-traps-orchestrator.md) (T-AO-A…T-AO-L). Dispatch templates: [references/worker-template.md](worker-template.md), [references/reviewer-template.md](reviewer-template.md).

---

## Communication with the user

Upstream's continuous-execution norm applies (`superpowers:subagent-driven-development` — do not
pause for check-ins between tasks). What this workflow adds:

- **The Phase 2 plan agreement is the only pause** between intake and the PR. Do not interrupt the flow of fixes.
- **Batched questions.** All ambiguities from Phase 1 — one list at the start of Phase 2 (upstream's own «present everything as one batched question, before execution begins» norm, applied to the intake stream).
- **ATTN escalation.** Judge it: solvable alone / needs the user's word.
- **Status update.** After each batch — 1 line: «batch A: 2 commits, ok». Not a repeat of the report.

---

## Auto-triggering project skills through prompt wording

The junior auto-triggers skills on keywords in its prompt. **Do not restate a skill's content** — mention its name or a context word (`- IF you touch <topic> → activate skill <skill-name>`), the junior will read it. The list of available skills comes from discovery (`ls .claude/skills/`). Use `Skill('superpowers:using-superpowers')` for CSO discipline (auto-invocation by description match).

---

## Anti-patterns (seen it — redo it)

Generic delegation rationalizations are owned by `superpowers:subagent-driven-development`
§Common Rationalizations. These are this workflow's own:

- ❌ Every fix as its own PR. → One PR per umbrella.
- ❌ Full check:all after every fix. → Only at the end.
- ❌ A junior pushes / merges / creates a PR. → Senior only.
- ❌ Long prose in a REPORT. → Strict template, bullets.
- ❌ The senior silently accepts an `ATTN: ...`. → ATTN is a mandatory stop.
- ❌ Parallel spawn without a file-lock check. → Conflicts in one branch.
- ❌ Routing everything through Mode B file-prompts «to save Opus» while the Opus pool is fine. → Mode A is the default; Mode B only on the §«Default — Mode A» conditions.
- ❌ Pulling Sonnet onto a task that needs top-tier reasoning (prod-blast-radius review, hard architectural analysis). → Opus is the default there.
- ❌ Pre-flight skipped, someone else's WIP mixed into the umbrella. → Stashing is MANDATORY.
- ❌ A junior did a refactor «along the way». → Reset, redo narrowly.
- ❌ Discovery skipped in a new repo. → The junior's prompt will carry wrong commands.

---

## Token budget (red flags)

| Metric                             | Normal   | Red flag                                  |
| ---------------------------------- | -------- | ----------------------------------------- |
| Senior per fix (prompt + report)   | 500–1500 | >3000 → diving into code instead of Agent |
| Pre-flight + plan for 10 fixes     | 3–5k     | >10k → too much senior-side research      |
| Final sanity check + PR            | 2–3k     | >5k → superfluous Reads/checks            |
| Junior per fix (its own session)   | 5–30k    | (not my problem)                          |
| Senior total for an umbrella of 10 | ~25–35k  | >50k → revisit the workflow               |

If the senior spends >5k tokens on a single fix, it is almost always diving into the code itself instead of delegating. Roll back, spawn an Agent.
