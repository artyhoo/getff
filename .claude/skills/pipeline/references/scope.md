# pipeline — scope

> **Authoritative for:** the selected pipeline procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §8 Anti-scope

> What this skill MUST NOT do.

- **Does NOT write sub-wave code.** Writing implementation code is the Worker's job. If invoked on an execution-build sub-wave, meta-orchestrator generates the kickoff and dispatch instructions — it does NOT implement.
- **Does NOT finalize project strategy.** Meta-orchestrator can recommend a priority winner (§2) and say «proceeding»; it asks the maintainer on genuine strategy forks (§7.3 item 5).
- **Does NOT modify `.claude/skills/orchestrator/`.** That is a separate skill with its own owner. Meta-orchestrator wraps and calls it; it never forks or modifies it. All paths in this skill begin with `.claude/skills/pipeline/` or consumer-repo relative refs.
- **Does NOT violate no-paid-llm-in-ci.md §1.** All dispatch is session-bound CC subscription. Zero API-billed calls in CI. `!shell` injections are deterministic bash.
- **Does NOT add npm deps.** Substrate stays bash + markdown + CC primitives + existing `gh` CLI.
- **Does NOT re-litigate R-phase verdicts.** If a missed candidate is noticed, write `docs/meta-factory/research-patches/2026-<date>-meta-orchestrator-followup-<gap>.md` and surface to maintainer.
- **Night delta — no new-scope planning at night.** Authoring NEW scope (kickoffs, umbrellas) is intent-class work, floored at night by the same envelope that floors intent parks; /pipeline is a day seat by policy ([autonomous-night v3 §5](../../../../docs/superpowers/specs/2026-08-09-autonomous-night-v3-design.md)).

**One-button-install coupling (load-bearing):** this skill lives at `.claude/skills/pipeline/` (project-scope, committed). It is templatable for N6b `npx` scaffold via `install.sh` payload. All cross-references use `${CLAUDE_SKILL_DIR}` or repo-relative paths — no absolute paths inside skill body. Ships directly from `.claude/skills/pipeline/` (single source of truth; no repo-root mirror — Item 12 closure 2026-05-25). Delivery moved out of `install.sh` into the tier rosters: this skill is in the `env+` tier at `setup.d/lib.sh:64`, walked by `setup.d/10-skills.sh:166`.

---

## Red flags / Common mistakes

Rationalizations that mean STOP and re-read the relevant section (e.g. «plan looked current last session, skip §1» → §1 T4; «Stage 1 was about to land so dispatch Stage 2» → §6 stage-gate is real `gh pr list`; «maintainer said выбирай сам so I'll pick» → §2 Step 4.1; «Phase -1 optional when stage was small» → §6/§7 mandatory) + the full red-flag phrase list: [`references/red-flags.md`](red-flags.md).
