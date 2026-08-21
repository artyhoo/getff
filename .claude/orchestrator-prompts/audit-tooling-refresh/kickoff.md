# AUDIT-CHECKLIST / AUDIT-PROMPT refresh post-C-1 — AUTONOMOUS KICKOFF

> **Status:** ARMED 2026-05-21.
> **Type:** standalone refresh task (analysis → rework → PR). One focused sitting. **Autopilot — do NOT stop for clarifying questions** (log forks in the PR body / a DECISION-NEEDED list; proceed with best judgment, state assumptions).
> **Deliverable:** updated `AUDIT-CHECKLIST.md` + `AUDIT-PROMPT.md` (internal self-audit tooling) reconciled to the merged C-1 resolution, on a branch + PR. Plus a short report of what was reworked vs removed vs kept.
> **You are a FRESH session and inherit NO memory.** This kickoff is self-contained. Read §2 before reasoning.
> **Verify, don't trust** — these files are *executable* probes; run the reworked ones and cite actual output. Do NOT blindly name-swap (that is the trap — see §6).

---

## §1 The problem

`AUDIT-CHECKLIST.md` (~459 lines) and `AUDIT-PROMPT.md` (~276 lines) are this package's **recursive self-audit tooling** ("the package about executable rules gets audited by its own executable rules"). They contain bash/grep **probes + expected-states**. They are live (referenced by `docs/audits/2026-05-06.md`, `docs/audits/README.md`, and a Wave-8 research-patch).

Several probes encode assumptions **falsified by the merged C-1 agent-collision resolution** (PRs #79/#82/#83/#84, all on `main`; provenance in `docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md`):

- They treat `best-practices-sidecar` as **ours**, as the agent that **validates `.ai-factory/RULES.md`**, and as **"overridden by us"**. → **False now (KEEP-AIF):** we ship no `best-practices-sidecar`; it is AIF's. Our R-rule enforcement is **edit-time ESLint + pre-push `audit-ai-docs.sh` + AIF's `rules-sidecar` (reads `RULES.md`) + the `aif-rules-check` skill-context residue** we ship.
- They reference `docs-auditor` as ours. → **Renamed to `living-docs-auditor`.**
- They reference `best-practices-sidecar.react.md` "inlined" checks and `/aif-verify should invoke best-practices-sidecar`. → likely **obsolete** post-C-1.

Some references are **prose**, some are **audit logic** (grep targets / expected-state assertions). A blind name-swap is wrong: where a probe's *target* is gone, the probe must be **removed or re-pointed at the real current enforcer**, with its *expected-state* updated to match reality.

This was scoped out of PR #84 (which fixed the *shipped* prose) precisely because it needs this logic rework.

---

## §2 Step 0 — read before reasoning (no memory inherited)

1. `README.md` §why-this-exists — goal (esp. "fail at the EARLIEST reachable channel").
2. `AUDIT-CHECKLIST.md` + `AUDIT-PROMPT.md` — **in full**. These are what you're reworking.
3. The C-1 reality (source of truth for what changed):
   - `docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md` §4–§5 (KEEP-AIF / skill-context / rename verdicts + "occupy zero AIF slots").
   - On `main`: `agents/` (note `best-practices-sidecar.md` is **absent**; `living-docs-auditor.md` present; `review-sidecar.md` + `compliance-verifier.md` present), `install.sh` (SHIPPED_DOCS + skill-context copy), `packages/core/templates/shared/skill-context/aif-review/SKILL.md` + `aif-rules-check/SKILL.md`, `packages/preset-next-15-canonical/RULES*.md` (re-credited prose).
4. `.claude/rules/ai-laziness-traps.md §2` — instantiate §6 traps.
5. `docs/audits/README.md` + `docs/audits/2026-05-06.md` — to understand how these audit docs are actually used (is the run cadence such that some probes are dead?).

**C-1 reality mapping (apply per reference, after confirming intent):**
| Old assumption in audit | Current reality |
|---|---|
| our `best-practices-sidecar` validates `RULES.md` | AIF's `rules-sidecar` reads `RULES.md`; our edit-time ESLint + pre-push enforce R-rules; residue rides `aif-rules-check` skill-context |
| `.claude/agents/best-practices-sidecar.md` "overridden by us" | not ours — KEEP-AIF; we ship no override of that slot |
| `docs-auditor` (ours) | renamed `living-docs-auditor` |
| review via `review-sidecar` (our file in slot) | our content rides `aif-review` skill-context; AIF keeps the `review-sidecar` slot |
| `best-practices-sidecar.react.md` inlined checks | likely obsolete — verify, probably remove |

---

## §3 Hard constraints
- **Autopilot**; no mid-run questions.
- **Run the reworked probes** (T2): each probe you keep/rework must actually execute against the current repo and its expected-state must match observed reality — paste the command + output for the ones you change.
- **No paid LLM. No Superpowers install.**
- **Worktree off `origin/main`**; `npm install` in `packages/core` before the pre-push render-drift check (it needs `ajv`/deps — a fresh worktree lacks them; this bit PR #84).
- **Files must stay ≤500 lines** (pre-commit checks `*.md` length) and pass markdownlint (`.markdownlint.json`: MD040 etc. enforced — fence languages required) + bash-syntax on any embedded `*.sh` blocks the hook lints.
- **Internal-only** — these files are NOT shipped via `install.sh`; no consumer impact. `discipline-self-check` does not fire (root `.md` outside its path filter).

---

## §4 Methodology

### §4.1 Inventory every stale reference + classify
Enumerate every `best-practices-sidecar` / `docs-auditor` / `best-practices-sidecar.react.md` reference in both files (grep). For EACH, classify:
- **REWORK** — the audit *intent* is still valid; re-point the probe at the real current enforcer + fix its expected-state (e.g. "R-rule X is enforced" → check the ESLint rule / `aif-rules-check` skill-context, not our removed agent).
- **REMOVE** — the probe's target no longer exists and the intent is now covered elsewhere or moot (e.g. "best-practices-sidecar.react.md was inlined" — dead).
- **RENAME** — pure `docs-auditor` → `living-docs-auditor` where the intent + file genuinely map 1:1.
- **KEEP** — incidental/historical mention that is still accurate (rare; justify).

### §4.2 Rework + run
Apply the changes. For every REWORK/RENAME probe, **execute it** against current `main` and confirm the expected-state matches (T2/T3). Where a probe asserted "best-practices-sidecar.md says manual review", decide what the post-C-1 equivalent assertion is (e.g. "R10/R4/R17 residue is present in `aif-rules-check` skill-context") and verify it.

### §4.3 Self-consistency
These audit docs claim to be "rules-as-tests applied to the package itself." Ensure the refreshed audit, run end-to-end, **passes against current `main`** (or its FAILs are real findings, not stale-probe artifacts). Note any genuine finding separately — do NOT fix package code in this task (audit-tooling refresh only; surface findings).

### §4.4 Sanity
Confirm both files still ≤500 lines, markdownlint clean, embedded bash blocks valid (`bash -n`).

---

## §5 Deliverable
- Branch `docs/audit-tooling-refresh` (off `origin/main`) + PR.
- Updated `AUDIT-CHECKLIST.md` + `AUDIT-PROMPT.md`.
- PR body: a per-reference table (REWORK / REMOVE / RENAME / KEEP + one-line rationale) + the run-output evidence for reworked probes + any genuine audit findings surfaced (as observations, not fixes).
- `### §1.7 Skipped: <reason ≥60 chars>` marker is the likely-correct PR §1.7 handling (internal tooling refresh consequent to an already-merged decision, no new discipline) — but `discipline-self-check` won't fire anyway (path filter); include the marker only if a touched path lands in the filter.

## §6 AI-laziness traps active
- **T2** «methodology ≠ running» — run the reworked probes; paste output.
- **T3** «plausible without verification» — cite command-output / file:line for each changed expected-state.
- **T16** «name-match» — the core trap here: do NOT `sed best-practices-sidecar → rules-sidecar`. Verify each probe's *intent* and map it to the *correct* current enforcer (RULES.md validation → `rules-sidecar`; R-residue → `aif-rules-check` skill-context; edit-time → ESLint). Different references map to different targets.
- **T-AUD-A** «name-swap-without-intent-check» — a probe that checked best-practices-sidecar's *content* (e.g. "says manual review") has no 1:1 successor; rework its assertion to the real post-C-1 state or REMOVE — don't redirect it to a plausible-looking file that doesn't actually carry that content.
- **T-AUD-B** «obsolete-probe-kept-alive» — if a probe's target is genuinely gone (best-practices-sidecar.react.md inlining), REMOVE it; don't fabricate a new target to keep the line.
- **T14** «clean ≠ correct» — the refreshed audit passing is only meaningful if you actually ran it; a green you didn't execute is theatre.
- **T15** «self-application» — these docs ARE the project's recursive self-audit; note whether the refreshed audit, run on itself, is internally consistent.

## §7 What this session does NOT do
- Does NOT edit shipped artefacts, agents, principles, RULES, install.sh (audit-*tooling* only).
- Does NOT fix package code for any genuine finding the refreshed audit surfaces — surface as an observation for a separate task.
- Does NOT install Superpowers / install into a real project.
- Does NOT touch frozen/historical `docs/audits/*` run-outputs (they are dated records).

## §8 See also
- `docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md` — C-1 decision (the reality these audits must match).
- PRs #79 / #82 / #83 / #84 (all merged) — the C-1 chain.
- `.claude/rules/ai-laziness-traps.md §2` — trap catalogue.
- `docs/audits/README.md` — how these audit docs are run.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
