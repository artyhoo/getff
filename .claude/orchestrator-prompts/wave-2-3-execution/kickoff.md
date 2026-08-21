# Kickoff — Wave 2 + Wave 3 execution orchestrator (Opus burn, iterative)

> **Mode:** Opus burn — Mode A inline Opus subagents для execution, iterative reviewer↔orchestrator cycles до 20/20 CI green per wave.
> **Burn auth:** explicit — thorough analysis, длинные deliverables, multi-step follow-ups OK.
> **State file:** `.claude/orchestrator-prompts/wave-2-3-execution/state.md` (создать на старте, append-only event log).
> **Predecessor:** 2026-05-16 strategic D-items dialogue, decisions persisted в `.claude/orchestrator-prompts/d-items-strategic-dialogue/decisions.md`. Wave 1 уже shipped (PR #63).

---

## Phase -1 — Iteratively review THIS kickoff before executing (MANDATORY)

You don't get to start execution until you've critiqued this kickoff itself. Without this step, any latent bug in this prompt cascades into both PRs.

### Self-review protocol

1. **Read this entire kickoff cold** — pretend you didn't write it.
2. **Spawn Mode A Opus subagent** with reviewer-discipline lens:

```
Task description: Review wave-2-3-execution kickoff for execution-readiness
Subagent prompt:
  You are a cold-start reviewer. Read `.claude/orchestrator-prompts/wave-2-3-execution/kickoff.md`
  completely. Critique it for:
    (a) Ambiguous instructions or unstated assumptions that could let the executor drift.
    (b) Missing hard constraints (file-lock conflicts, scope creep risks, §1.7 considerations,
        worktree mandate, Prior-art trailer if capability-shaped).
    (c) Conflicts with current project state — check that referenced files/lines/slots still
        exist as described. Specifically verify principle-slot allocation under
        `packages/core/principles/` against the kickoff's slot-resolution rule.
    (d) Stale references — recent commits or PRs may have shifted what's already shipped.
        `git log origin/main -20 --oneline` + scan recent PRs via gh.
    (e) Missing T-trap enumeration per `.claude/rules/ai-laziness-traps.md §3` — kickoffs
        that delegate work MUST cite T-numbers actively trapping THIS work, not just
        blanket-reference the rule.
    (f) Risk that any deliverable could cascade into a separate PR (drive-by per CLAUDE.md
        `## PR strategy`) — flag if so.

  Return:
    - List of findings classified BLOCKER / MAJOR / MINOR
    - For each finding: concrete fix (rewrite text, add constraint, remove ambiguity)
    - One-line verdict: GO (kickoff is execution-ready) / REVISE (orchestrator must amend
      kickoff before starting Phase 0)

  No code edits, no Phase-0 work, no execution — pure prompt critique.
```

3. **Address findings:**
   - BLOCKER/MAJOR → orchestrator edits this kickoff file directly (yes — the kickoff itself, not a separate doc) to remove the gap. Log edit in state.md «Phase -1 amendments» section.
   - MINOR → note in state.md «Phase -1 minor known-residuals» — proceed without amending unless cluster of 3+.
4. **Re-review** if any BLOCKER was amended. Repeat until reviewer returns GO **or** maximum 3 iterations (escalate to maintainer if iter-3 still REVISE).
5. **Only then** proceed to Phase 0.

State.md Phase -1 section format:
```markdown
## Phase -1 — self-prompt review
- Iter 1: spawned reviewer, findings: <list>, verdict: <REVISE/GO>
- Iter 1 amendments: <what was changed in kickoff>
- Iter 2: ... (if needed)
- Final: GO @ <timestamp>
```

---

## Phase 0 — Mandatory reads + project bootstrap

Discovery cache from previous session may be stale (new commits since dialogue).

1. **Read in order:**
   - `README.md` §«Why this exists» — goal hierarchy
   - `.claude/session-bootstrap.md` — operational restatement
   - `CLAUDE.md` — Artifact Ownership Contract, build-vs-reuse invariant, no-drive-by PR rule
   - `.claude/orchestrator-prompts/d-items-strategic-dialogue/decisions.md` — verdicts you're executing (D-AuditC-1, D-AuditC-3, D-AuditC-5, D-AuditC-6, D6 — read these specific entries closely)
   - `.claude/rules/parallel-subwave-isolation.md` — worktree mandate
   - `.claude/rules/ai-laziness-traps.md` §2 — T1, T3, T11, T13, T15 minimum (enumerate domain traps in this kickoff if needed)
   - `.claude/rules/no-paid-llm-in-ci.md` — anything you ship must be deterministic OR session-bundled, not paid-API
   - `.claude/rules/phase-research-coverage.md` §1.7 + §1.10 — Wave 1 shipped §1.10; Wave 3's principle-test addition must comply
2. **Project state probe:**
   ```bash
   cd /Users/art/code/rules-as-tests-aif
   git status --short                                 # capture untracked files
   git branch --show-current                          # NOT main expected; we'll worktree
   git log origin/main..HEAD --oneline                # what's ahead of main
   gh pr list --repo Yhooi2/rules-as-tests-aif --state open
   ls packages/core/principles/                       # check slot allocation
   ```
3. **Wave 1 (PR #63) status — MERGED 2026-05-16T18:04:21Z** (verified at Phase -1 review, commit `89e8f42` on origin/main; §1.10 already on main via commit `0fd231b`). Re-verify with `gh pr view 63 --repo Yhooi2/rules-as-tests-aif --json state` if cold-restarting much later, but treat as merged for the rest of this session. §1.10 is directly citable from `.claude/rules/phase-research-coverage.md` (line range to be grep'd at execution time, not memorized).

---

## Scope — what executes

### Wave 2 — cleanup batch (one PR)

Source: D-AuditC-1 verdict B + D-AuditC-6 verdict A+ + D-AuditC-3 verdict B + D6 verdict A (from decisions.md).

**Project-file edits (go into Wave 2 PR):**

| # | File | Change |
|---|---|---|
| R-1 | `agents/docs-auditor.md:41` | **Amendment 2026-05-16 (Phase -1 review):** R-1 already partially shipped via `c8fc153` (origin/main) — that commit removed the broken ref at the former line-12 site. The symmetric instance survives inside the Step-2 graceful-degradation `echo` block at current **line 41**: `echo "      See references/self-testing-docs.md for the pattern."`. `agents/references/` is absent in source AND consumer per `c8fc153` rationale, so apply the same remediation: **delete only the offending echo line (line 41)**, leaving the surrounding `{ ... }` shell block syntactically valid. Verify with `grep -n "references/self-testing-docs"` — count must be 0 after edit. |
| R-3 | `.claude/skills/tool-bootstrapping/SKILL.md` | Change ONLY the word `lands` → `landed` in the phrase `lands in Wave 5.3`. Use `grep -n "lands in Wave 5.3" .claude/skills/tool-bootstrapping/SKILL.md` to confirm exact line + surrounding context BEFORE editing (line numbers drift as files evolve). Also verify whether `deps-hash-check.sh` is registered in `.claude/settings.json` UserPromptSubmit hook — if not, surface in ATTN (don't fix here, scope-creep). |
| R-4 | `~/.claude/skills/orchestrator/SKILL.md:10` | **Already done as of 2026-05-16** — `triggers:` field already contains `queue mode, kickoff, autonomous research, worker dispatch, воркер, ревьюер, очередь задач`. No action required. Listed here for traceability against `decisions.md §D-AuditC-1` (which lists R-1..R-4 + R-6, R-7). Executor: `grep "^triggers:" ~/.claude/skills/orchestrator/SKILL.md` — confirm presence, log in REPORT, move on. |
| R-6 | `agents/docs-auditor.md` frontmatter `description:` | Add «Consumer-facing context» paragraph using template from `decisions.md §D-AuditC-6`. **Placeholder substitution discipline:** template literal `<consumer-only-path>` → `scripts/audit-ai-docs.sh`. Template literal `(see lines X-Y)` → **grep the file's graceful-degradation block first** (`grep -n "INFO:\|not present" agents/docs-auditor.md`), substitute real line range. If no clear graceful-degradation block exists, replace `(see lines X-Y)` with `(graceful degradation via Step-2 script-existence check)` or omit the parenthetical entirely — do NOT ship literal `X-Y`. |
| R-7 | `agents/best-practices-sidecar.md` frontmatter `description:` | Same D-AuditC-6 template, adapted: `<consumer-only-path>` → `.ai-factory/RULES.md`. Same X-Y substitution discipline as R-6 (grep agent's graceful-degradation block, substitute real lines or rewrite). |
| D6 | `docs/meta-factory/research-patches/2026-05-16-§17-think-time-gate.md` `## See also` | Add as first line of See also: «⚠ Erratum 2026-05-16 — see [2026-05-16-think-time-s17-gate-correction.md](2026-05-16-think-time-s17-gate-correction.md). H2 vs H10 re-evaluation with corrected Stop semantics deferred to implementation moment (Phase 11+).» |
| D-AuditC-6 | `CLAUDE.md` Artifact Ownership Contract | Add ONE row. Owner column: «framework maintainers». Read-only column: «all sessions». Why column: «design-by-spec ref consumer-project paths absent in source repo». Artifact column: «agents/docs-auditor.md, agents/best-practices-sidecar.md (consumer-facing agents)». |

**User-home edits (NOT in PR, no git):**

| # | File | Change |
|---|---|---|
| R-2 | `~/.claude/skills/ai-docs/SKILL.md:370, :547` | Remove `token-economy` skill references. **Defensible choice already locked-in:** remove ref (skill doesn't exist; creating skill is out of scope; inline content is out of scope). If maintainer prefers different path — flag in ATTN, do not block on this. |
| D-AuditC-3 | `~/.claude/skills/git-user-info-ui-design.md` | `git mv` equivalent — actually `mv` since not git-tracked: `mkdir -p ~/.claude/skills/projects/github-user-analytics/ && mv ~/.claude/skills/git-user-info-ui-design.md ~/.claude/skills/projects/github-user-analytics/`. **Confirm with maintainer before executing** — D-AuditC-3 caveat says «explicit acknowledgement was not collected at dialogue moment». ASK ONCE in Phase 1 status update; **if no maintainer response in this session, treat as blocked — DO NOT execute the `mv` autonomously.** Add to ATTN list + DONE-report. The `work-without-stopping` override does NOT cover explicit-confirm gates (CLAUDE.md PR strategy «Exception: explicit invitation only»). |

**Wave 2 PR title:** `chore(skills+agents): cleanup batch from 2026-05-16 skills+agents audit`
**Wave 2 branch:** `chore/skills-agents-cleanup-wave-2-2026-05-16` from `origin/main`

### Wave 3 — skill drift detection (one PR)

Source: D-AuditC-5 verdict A+B multi-channel.

**New files / edits (all in Wave 3 PR):**

| # | File | Change |
|---|---|---|
| W3-1 | `scripts/check-skill-drift.sh` (new) | Bash script. **Scope (repo-local only):** (a) broken internal refs in `.claude/skills/**/*.md`, `agents/**/*.md`, `skills/**/*.md` — `find` + path existence. **DO NOT scan `~/.claude/skills/**`** — user-home is non-portable across contributors / CI. User-home drift detection is a separate session-bound concern, not this hook. (b) missing `name:` and `description:` YAML frontmatter on skill files (repo-local scope same as above); (c) trigger-overlap inventory (REPORT-only, doesn't fail on overlap). Exit code: 0 on clean, 1 on broken refs / missing frontmatter, 0 with stderr WARN on overlap inventory. **Capability-commit status:** `scripts/` is NOT under `packages/`. Per `.husky/pre-push:140-145` (capability-commit detector covers only `packages/core/<new-dir>/` ≥50 LOC or `packages/**` ≥80 LOC), W3-1 is **NOT** a capability commit regardless of LOC. No Prior-art trailer needed for W3-1. |
| W3-2 | `.husky/pre-push` | Wire `scripts/check-skill-drift.sh` invocation. **Placement:** add NEW section `── 3b. Skill drift check ──` after section 3a (hook-stub-completeness, ~line 57). Pattern (guarded, missing script ≠ hard-fail): `if [ -x scripts/check-skill-drift.sh ]; then bash scripts/check-skill-drift.sh \|\| { echo "❌ skill drift check failed"; exit 1; }; fi`. **Do NOT** mirror `packages/core/audit-self/audit-ai-docs.test.sh` invocation path — that's a `packages/core/audit-self/` pattern, this is a `scripts/` pattern. Apply §1.8 «hook surface smoke-test» before committing — invoke hook with out-of-scope path, verify exit=0 + no stderr. **§1.8 stub-completeness interaction:** after wiring, run `bash packages/core/audit-self/hook-stub-completeness.test.sh` to verify no regression. The stub-completeness audit only scans `packages/core/audit-self/*.test.sh` invocations; `scripts/check-skill-drift.sh` is bypass-by-design (the `[ -x ]` guard makes script-absent benign). Document this in commit body. |
| W3-3 | `packages/core/principles/<N>-skill-drift-detection.test.ts` (new) | Principle test as last-resort gate. **Slot resolution discipline:** `ls packages/core/principles/` at execution time. Slot 11 currently has only `.design.md` (1A workstream, no `.test.ts` shipped). **If `11-build-first-reuse-default.test.ts` has NOT shipped at execution moment → slot 11 is claimable for skill-drift test.** If it HAS shipped → pick lowest free integer (≥12). Resolve mechanically, do not hardcode. **Capability-commit status:** principle test under `packages/core/principles/` IS subject to «new file ≥80 LOC under `packages/`» rule. If W3-3 ≥80 LOC → Prior-art trailer required. SSOT consult: check `docs/meta-factory/prior-art-evaluations.md` for existing drift-detection patterns; if none → add new SSOT entry in same commit. Vitest test that calls the bash script logic OR re-implements checks in TS — choose minimum-LOC path to stay under capability threshold OR write Prior-art trailer. |
| W3-4 | `package.json` scripts | Add `"check:skill-drift": "bash scripts/check-skill-drift.sh"`. Single-line addition. |

**Wave 3 PR title:** `feat(skill-drift): multi-channel drift detection from D-AuditC-5`
**Wave 3 branch:** `feat/skill-drift-detection-wave-3-2026-05-16` from `origin/main`

**Capability-commit gate consideration (Phase -1 amended):** `scripts/` is NOT under `packages/`. Per `.husky/pre-push:140-145`, capability-commit detector covers (a) new explicit dep in `package.json`, (b) new file ≥50 LOC under new `packages/core/<dir>/`, (c) new file ≥80 LOC under `packages/**`. **W3-1 (`scripts/check-skill-drift.sh`) is NEVER a capability commit regardless of LOC.** W3-3 (principle test under `packages/core/principles/`) IS subject to rule (c) if ≥80 LOC → Prior-art trailer required; SSOT consult `docs/meta-factory/prior-art-evaluations.md` for existing drift-detection patterns; if none → add new SSOT entry in same commit. W3-2 (`.husky/pre-push` edit) is a modification of an existing file → never capability commit. W3-4 (one-line `package.json` script) does NOT add a new dep → not capability commit.

---

## Phase plan per wave

Per wave, follow this loop:

### Phase 0 (per wave) — worktree setup

```bash
cd /Users/art/code/rules-as-tests-aif
git fetch origin
git worktree add ../rules-as-tests-aif-wave-2 origin/main      # OR -wave-3
cd ../rules-as-tests-aif-wave-2
git checkout -b chore/skills-agents-cleanup-wave-2-2026-05-16  # OR feat/skill-drift-...
git status                                                       # must be clean
```

If `git worktree add` fails — STOP and report; do NOT proceed in shared workdir.

### Phase 1 (per wave) — execution via Mode A Opus subagent

Spawn one Opus subagent per wave with self-contained prompt (use Wave 1's `wave-1-prompt.md` as structural reference but adapt content). The subagent does:
- Read its own task list from this kickoff + decisions.md
- For each item: verify current state via `grep`/`sed` first, then edit, then verify.
- Run `npm run -w @rules-as-tests/core test:principles` after each substantive edit (Wave 3) or once at end (Wave 2 — no principle tests touched).
- Commit per logical unit (one commit per «R-N» item if files distinct; combine R-1+R-6 since both touch docs-auditor.md).
- Return REPORT with verification probes' outputs.

Quota: each subagent ~50-100k Opus tokens — burn-auth covers.

### Phase 2 (per wave) — orchestrator mechanical verification

Read subagent REPORT, then run independent verification:
- File existence / line locations
- Commit subjects format-correct
- All claimed edits actually present
- Principle tests pass (re-run if Wave 3)

If any verification fails → REVISE prompt for subagent, re-dispatch on same worktree.

### Phase 3 (per wave) — push + PR

```bash
cd /Users/art/code/rules-as-tests-aif-wave-N
git push -u origin <branch>
```

PR body MUST include:
- Summary (3-5 bullets)
- Test plan (checked items)
- If wave touches rule files (Wave 3 does via principle test addition) → **§1.7 sections with file.ext:N citations** (regex `[^[:space:]]+\.[a-z]+:[0-9]+` — see Wave 1 PR #63 body for working example)
- Wave 2 doesn't add rules → §1.7 may be Skipped marker with ≥60-char rationale («cleanup batch — no rule introduction; per `phase-research-coverage.md §1.7` skip allowed for non-discipline-bearing commits»). Verify regex match by checking `discipline-self-check.yml` matrix at execution time.

### Phase 4 (per wave) — iterative reviewer pass

After PR opens, monitor CI. Then spawn Mode A reviewer subagent:

```
Task: Cold-start review of PR #<N> (Wave 2 OR Wave 3) — verify CI passes substantively + spot-check claims
Subagent prompt:
  You are an independent reviewer. Read PR #<N> diff, body, CI checks. Verify:
    (a) All claimed file edits present in diff.
    (b) §1.7 substance gates pass (if applicable) — file.ext:N citations real, not fabricated.
    (c) No drive-by scope creep — diff stays within umbrella.
    (d) Hook smoke-test ran (Wave 3) per §1.8.
    (e) Principle slot used is actually free (Wave 3).
    (f) Build-vs-reuse: if W3-1/W3-3 is capability-shaped (≥50/80 LOC threshold), Prior-art trailer present.
    (g) Cross-link paths in any user-home edits actually resolve (regression from Wave 1 bug).
  Return: GO / REVISE per finding class; for REVISE, list concrete fixes.
```

If REVISE → orchestrator does fixes (Mode A inline or direct Edit per orchestrator-skill triage), re-push, re-trigger CI, repeat. Max 3 iterations per wave before escalation.

### Phase 5 (per wave) — DONE criteria

Wave is GREEN when:
- All CI checks pass on PR
- Reviewer subagent returns GO
- Orchestrator state.md logs the verdict
- No outstanding ATTN items in subagent REPORT

Both waves DONE → final summary to maintainer with both PR links + any deferred-to-future items.

---

## Hard constraints

- **No drive-by PRs.** Strictly within Wave 2 and Wave 3 scope. If you notice an adjacent issue (e.g., another stale ref outside the 5 named ones) — surface in ATTN, do NOT autonomously fix. Per CLAUDE.md «PR strategy» discipline.
- **No paid LLM in CI.** Wave 3's principle test must be deterministic (no API key usage). Per `.claude/rules/no-paid-llm-in-ci.md`.
- **Worktree mandatory per wave.** Each wave in own worktree.
- **No `git push --force` on shared branches.** Force-push to feature branches OK if you broke history (e.g., need to amend commit for §1.7: trailer); never to main.
- **No skipping hooks.** `--no-verify` forbidden unless maintainer explicitly authorizes.
- **No editing PR body to game CI.** §1.7 file.ext:N citations must be REAL — line numbers must contain substantive content related to the claim. CI substance gate accepts the format but you should respect substance per `agents/compliance-verifier.md`.
- **D-AuditC-3 git-mv requires explicit confirm** (per decision caveat «explicit acknowledgement was not collected»).
- **Slot allocation under principles/** — check at execution moment, not from this kickoff. 1A workstream may have shipped principle 12/13 by then.

---

## T-traps active (per `.claude/rules/ai-laziness-traps.md`)

Domain-specific to this kickoff:
- **T1 sampling floor** — Wave 2 has 7 items (5 project + 2 user-home, R-4 already done = traceability-only); do ALL, not first 3-5.
- **T3 plausible without verification** — every claimed edit needs file:line citation + actual content check. Wave 1 reviewer caught a cross-link path bug from a subagent's «awareness-only» note — same trap, do not repeat. **Phase -1 review surfaced 2 instances of T3 in the kickoff itself** (R-1 wrong line, R-3 multi-line edit risk) — both amended above; lesson: even orchestrator-authored kickoffs need verification before execution.
- **T11 build-vs-reuse** — Wave 3 capability-commit threshold. Only W3-3 (principle test under `packages/core/`) is subject. W3-1 (`scripts/`) is NEVER a capability commit (Phase -1 amendment).
- **T13 ADOPTED-MECHANISM** — Wave 3 mirrors `audit-ai-docs.sh` pattern (already in repo).
- **T15 self-application MANDATORY** — apply §1.10 (type-system > prose) when verifying anything CC-related; apply §1.7 (forward+backward) when shipping rule-bearing PR.
- **T16 pattern-matching-on-name** (added Phase -1) — Wave 3 nominally «adopts» the `audit-ai-docs.sh` pattern. Problem-class check: upstream `audit-ai-docs.sh` audits **code-vs-`AGENTS.md`-rules drift** in a consumer project. W3-1 audits **skill / agent file-internal drift** (broken refs, missing frontmatter) in this repo. Different problem-class. Write «Upstream problem class: code-vs-rules drift in consumer projects. Our problem class: skill/agent file-internal drift in source repo. Match? Partial — both are mechanical static drift detection on declarative files; ADAPT (re-implementation) is correct verdict, not ADOPT» in the script's top comment block.
- **T-Wave23-A (domain-specific):** «ATTN от субагента = bug not awareness» — Wave 1 incident #1 trap. Subagent says «cross-link path assumes layout — surfaced for awareness» = REVERIFY MECHANICALLY, do not accept narrative.
- **T-Wave23-B (domain-specific):** «slot collision blindness» — Wave 1 reviewer surfaced slot allocation cascade risk. `ls packages/core/principles/` at execution time, do not trust kickoff's slot suggestion. (Phase -1: at this moment slot 11 has only `.design.md`; slot 11 claimable until 1A workstream ships `.test.ts`.)
- **T-Wave23-C (domain-specific):** «§1.7 format-not-content theatre» — Wave 1 BLOCKER-1 trap. H3 heading correctness ≠ regex match. Cite ACTUAL file:line not section refs.
- **T-Wave23-D (Phase -1 added):** «kickoff self-review skipped at the kickoff layer» — if Phase -1 (this review pass) is itself skipped or done shallowly, all subsequent T-trap discipline collapses. The Phase -1 review IS the discipline applying to itself. Skipping it = `#self-application-omitted` (T15 instance).

Blanket-reference to `ai-laziness-traps.md` без enumeration = `#trap-catalogue-blanket-reference` anti-pattern. Above is the enumerated set for THIS kickoff.

---

## State.md format

```markdown
# Wave 2 + 3 execution state

> Session start: <ISO>
> Mode: Opus burn, iterative reviewer↔orchestrator
> Phase: -1 (self-review) | 0 (bootstrap) | 1 (W2 exec) | 2 (W2 verify) | 3 (W2 PR) | 4 (W2 review) | 5 (W3 exec) | ... | DONE

## Phase -1 — self-prompt review
- Iter 1: spawned reviewer, findings: <BLOCKERs / MAJORs / MINORs>, verdict: <REVISE/GO>
- Iter 1 amendments: <what changed in kickoff>
- Iter N: ... (if needed)
- Final verdict: GO @ <timestamp>

## Phase 0 — bootstrap
- ✓ Step 0 reads
- ✓ Project state probed
- ✓ PR #63 status: <merged/open>
- ✓ Principles slot allocation: <N free starting from M>

## Wave 2
- Phase 1 dispatch: <subagent ID, timestamp>
- Phase 1 REPORT: <gist + commits SHAs>
- Phase 2 verify: <pass/issues>
- Phase 3 PR: <URL>
- Phase 4 review iter: 1<...>, GO @ <ts>
- ATTN: <list>

## Wave 3
- (same structure)

## History
[append-only event log]
```

---

## Quota awareness

Both waves Opus-burn. Estimate:
- Self-review pass: 20-40k Opus
- Wave 2 subagent: 60-100k Opus
- Wave 2 verify + PR + review iter: 30-60k Opus
- Wave 3 subagent: 80-120k Opus (more files, principle test design)
- Wave 3 verify + PR + review iter: 30-60k Opus
- **Total estimate: 220-380k Opus cumulative.**

Max plan window ~200k/5h. Likely needs 2 reset windows OR aggressive efficiency. If approaching Red zone mid-wave → pause, ask maintainer (continue / `/clear` / defer second wave).

---

## What you DO NOT do

- Don't execute D2 design — that's a separate orchestrator session with its own kickoff.
- Don't touch project goal docs (README, CLAUDE.md goal sections) per Artifact Ownership Contract.
- Don't expand scope into Wave 2/3 adjacent areas (other broken refs, other stale text not in the 5 named items).
- Don't open more than 2 PRs (one per wave). If a third PR seems necessary — STOP and ask maintainer.
- Don't merge any PR yourself. Maintainer merges.

---

## Done — final report format

```markdown
## Wave 2 + 3 execution — DONE

### Wave 2 PR: <URL>
- 5 project-file edits + 2 user-home edits, all verified
- CI: 20+/20+ pass
- Reviewer iter <N>: GO
- ATTN deferred: <list or «none»>

### Wave 3 PR: <URL>
- 4 new/edited files (script + hook + test + npm script)
- Principle slot used: <N>
- Capability-commit status: <yes Prior-art trailer / no under threshold>
- CI: 20+/20+ pass
- Reviewer iter <N>: GO
- ATTN deferred: <list>

### Cumulative cost
- Opus tokens: <estimate>
- Wall-clock: <duration>
- Reset windows consumed: <N>

### What's next
- D2 design session (separate kickoff)
- Wave 1 PR #63 status: <still open / merged>
- Any new D-items surfaced for future sessions: <list or «none»>
```

---

## See also
- `.claude/orchestrator-prompts/d-items-strategic-dialogue/decisions.md` — verdicts being executed
- `.claude/orchestrator-prompts/d-items-strategic-dialogue/wave-1-prompt.md` — Wave 1 structural reference
- Wave 1 PR #63 — working example of substantive §1.7 sections
- `.claude/rules/parallel-subwave-isolation.md`, `.claude/rules/ai-laziness-traps.md`, `.claude/rules/reviewer-discipline.md` — discipline rules

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
