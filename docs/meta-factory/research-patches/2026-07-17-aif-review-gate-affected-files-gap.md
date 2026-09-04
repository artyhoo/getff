<!-- scope:aif-handoff-review-gate-gap -->
# aif-handoff review-gate `affected_files` self-report gap — false-done on out-of-scope edits

> **Scope:** documents a structural gap in the aif-handoff (`lee-to/aif-handoff` analog) review-loop that produced a false-`done` on DH-S1 dispatch (this repo, task `4f0c53ed-0ab8-4092-a637-4112b8b7d570`, 2026-07-17). NOT authoritative for project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). NOT a code change to aif-handoff (that lives in a separate repo, `~/code/aif-handoff/`); this is an incident post-mortem + a recommendation for the aif-handoff project, surfaced via the framework's own review-discipline.
> **Status:** finding recorded; no framework-side action (this repo is the aif-handoff *consumer*, not the upstream). Recommended upstream fix documented in §3.
> **Method:** every claim below is grounded in either (a) the task's own `agentActivityLog` + `reviewComments` JSON (read via `curl http://localhost:3009/tasks/4f0c53ed-…`) or (b) the actual file diff verified by `git diff` + a dual-reviewer forensic pass. No fact from memory.
> **Date:** 2026-07-17.

---

## §1 The incident (what happened)

DH-S1 of the `deps-hash-multistack` umbrella was dispatched to aif-handoff via `tsx packages/runtime-bridge/src/cli/dispatch.ts …` (kickoff at `.claude/orchestrator-prompts/deps-hash-multistack/kickoff.md`, carrying §4c park-don't-guess per pipeline SKILL.md §5). The task reached `status=done` with `manualReviewRequired=false`, `reviewIterationCount=0/3`, security-gate `status: pass, blocking: false, blockers: []`. The agent's own implementation-log summary claimed:

> **Files modified (6, all on branch `feature/deps-hash-multistack-4f0c53`):**
> 1. `packages/core/hooks/deps-hash-check.sh` (154 LOC) … 6. `docs/meta-factory/prior-art-evaluations.md` (new SSOT row #184)

The agent's stated intent for file #6 was **append-only** — "new SSOT row #184". The actual diff was **destructive**: tail-truncated 35 rows (185–219), replaced row 184's prior content (an unrelated ESLint-firing-gate entry), and edited 3 unrelated rows (3, 19, 91). Net: 36 prior-art entries destroyed, 1 added. Verified via `git diff --numstat` (4 insertions, 39 deletions) and `git diff -w` (identical stats — rules out whitespace noise).

The destructive edit **blocked** the framework's own `principle 11` (build-first-reuse-default) F1 test: 4 capability artifacts (`00-rule-index.md`, `backward-sweep-auditor.md`, `31-rule-channel-declaration.ts`, `rule-channel-glob.ts`) lost their only SSOT-matching rows and fired F1 violations. The pre-push gate blocked publication; the task was not egressed from this path. (The umbrella's DH-S1 ultimately landed via a separate clean TDD-path PR #1024; the aif-path output was discarded.)

## §2 The gap (why aif's review-loop did not catch it)

The `agentActivityLog` shows the agent ran `git diff … prior-art-evaluations.md` **twice** after the destructive Edit (timestamps 22:39:32 and 22:44:03), so the diff was visible to the agent. The review-loop still closed `done` because:

**The aif security-gate / code-review `affected_files` field is a self-reported list, not a mechanical `git diff --name-only` scan.** The task's `reviewComments` carries:

```json
{ "schema_version": 1, "gate": "security", "status": "pass", "blocking": false, "blockers": [],
  "affected_files": [
    "packages/core/hooks/deps-hash-check.sh",
    "packages/core/hooks/deps-hash-check.test.ts",
    ".claude/skills/tool-bootstrapping/references/decision-format.md"
  ] }
```

`docs/meta-factory/prior-art-evaluations.md` is **absent** from `affected_files` — the agent did not self-report it as touched. The gate's review (security findings + advisories) scoped itself to the 3 self-reported files; the destructive edit on the 4th file was therefore never examined.

This is a **self-report trust assumption**: the review-loop believes the agent's claim about which files it modified. When the agent's Edit semantics mis-fire (next section), the self-report diverges from reality, and the review-loop has no mechanical backstop.

## §3 The mis-fire (why the agent did not realise it modified file #6 destructively)

The `agentActivityLog` trace reconstructs the Edit:

```text
[22:33:22] Tool: Bash `tail -40 docs/meta-factory/prior-art-evaluations.md`
[22:33:30] Tool: Bash `grep -n "^| 183 |" docs/meta-factory/prior-art-evaluations.md | head -2`
[22:33:37] Tool: Read …/prior-art-evaluations.md
[22:33:57] Tool: Edit   …/prior-art-evaluations.md        ← the destructive call
[22:34:01] Tool: Bash `grep -nE "^\| 184 \|" docs/meta-factory/prior-art-evaluations.md | head -2`
```

The agent's perceptual model was: "rows ~180–219 are the last ~40 lines (saw them via `tail -40`), so the tail to replace starts around row 183/184". The Edit's `old_string` matched a region that **began at row 184 and ran to EOF** (35 rows past where the agent intended to stop). The `new_string` contained only the new row 184 + terminator. The 35 rows after old row 184 (the genuine SSOT rows 185–219) were silently dropped.

The agent then verified only that row 184 *existed* (`grep -nE "^\| 184 \|"` → 1 match) — it did not verify that rows 185–219 still existed. The verification was **existence of the intended addition**, not **preservation of the unintended tail**.

This is a known LLM failure mode with Edit-style tools on large files: when `old_string` is anchored to "the end of the file" without a verbatim EOF sentinel, the matcher can over-consume. A model that does not separately re-read the file's tail post-Edit cannot detect the over-consumption. The framework's own `Edit` tool guard ("old_string must be unique") does not help when the agent's chosen `old_string` *is* unique within the file but spans more than the agent mentally modeled.

## §4 Why §4c park-don't-guess did not prevent this

§4c (kickoff §4c, PR #1022) parks *forks* — genuine taste/design ambiguities with two defensible resolutions. The destructive edit was **not a fork**: it was not a decision point, it was a tool-misfire on a clear append-only instruction ("add row 184"). §4c is correctly scoped to decision discipline; it cannot mechanically prevent tool-misfires that the agent does not perceive as decisions.

This is **not a §4c failure** — it is a different failure class (perceptual/verification) that requires a different mitigation (mechanical review-loop coverage, §5).

## §5 Recommended upstream fix (for `lee-to/aif-handoff` or its analog)

**Single mechanical change with high leverage:** make the review-loop's `affected_files` a **derived** field computed by `git diff --name-only HEAD` (or `git status --porcelain`) at review-gate entry, NOT a self-reported list from the agent.

Concretely:
- At the moment the review-gate runs (the `review-gate started` log entry, just before `done` transition), the gate should `git -C <worktree> diff --name-only HEAD` (or `git status --porcelain` for the dirty-tree HANDOFF_MODE=1 case) and use that list as the authoritative `affected_files`.
- The agent's self-report, if present, becomes a *cross-check signal* (warn if self-report ∖ mechanical ≠ ∅ — i.e. the agent claims files it didn't touch; warn if mechanical ∖ self-report ≠ ∅ — i.e. touched files the agent didn't claim, which is exactly this incident's signature).
- Reviewer prompts (security-gate, code-review) scope themselves to the **mechanical** list, not the self-report.

This is a small change in the gate's prelude (one `git diff --name-only` call + a set-difference log line) and closes the entire class of "agent touches file X, doesn't tell the gate, gate doesn't review X" — of which this DH-S1 incident is one instance and which would otherwise recur on any large-file Edit-style tool use.

**Secondary (lower-leverage, harder):** consider adding a post-Edit verification hook that, for any Edit touching a file > N lines, re-reads the file tail and asserts it is non-empty / matches a hash snapshot from before the Edit. This catches the specific over-consume-tail pattern but is more invasive and file-size-dependent; the §5-primary change covers a strictly larger class.

## §6 Falsifier (what would invalidate this finding)

- If subsequent investigation of `lee-to/aif-handoff`'s `review-gate` source shows that `affected_files` IS already mechanically derived from `git diff` and the self-report-looking field in `reviewComments` is cosmetic, then the gap described in §2 is mis-diagnosed and the real gap is elsewhere (e.g. the gate ran but its findings were not blocking). Falsification path: locate `review-gate` implementation, grep for `affected_files` assignment.
- If a re-dispatch of an identical task on a fresh aif instance reproduces the row-185–219 truncation, the cause is not stochastic LLM variance but a deterministic prompt/tool shape — strengthening the §5 recommendation.

## §7 What this repo did about it (consumer-side)

- **No framework-side code change** — the gap is upstream in aif-handoff, not in this repo.
- **Process change for this repo's future aif dispatches:** until §5 lands upstream, the operator running `dispatch.ts` MUST run `git -C <container-worktree> diff --name-only HEAD` (or the host-side equivalent post-`docker cp`) and **compare it to aif's self-reported file list** before treating `status=done` as harvest-ready. The harvest.ts `false-done guard` (the dirty-tree + 0-commits-ahead HOLD with `--confirm-rework`) catches one shape of false-done but not this one (here the work was committed-shaped and self-consistent, just destructive on an unreported file). A new harvest.ts pre-egress check that diffs the mechanical file-list against aif's self-reported `affected_files` and HOLDs on any divergence would close the gap on the consumer side without waiting for upstream.
- **Logged here** so a future dispatch that hits the same pattern can be recognised quickly, and so the upstream recommendation has a written record to cite.

## §8 See also

- Task JSON: `curl http://localhost:3009/tasks/4f0c53ed-0ab8-4092-a637-4112b8b7d570` (aif-handoff local API; not committed).
- Framework kickoff that was dispatched: `.claude/orchestrator-prompts/deps-hash-multistack/kickoff.md` (with §4c via PR #1022).
- pipeline SKILL.md §5 `#autonomous-dispatch-without-park` and `#autonomous-done-no-harvest` — the two anti-patterns this incident sits adjacent to (but is distinct from: §4c was present; harvest WAS attempted; the gap is in aif's internal review-gate, not the dispatch/egress contract).
- Forensic verification of the destructive diff: this session's reviewer pass (dual-reviewer top-down + bottom-up) — raw evidence preserved in the task's `agentActivityLog` timestamps 22:33:57 (Edit) / 22:39:32 + 22:44:03 (git diff that showed the deletion, unexamined by the gate).

## §9 §1.7 self-review

- **Forward-check (research-only):** complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (this is a docs-only research-patch; zero LLM/API surface, zero CI cost); [doc-authority-hierarchy.md §2-3](../../../.claude/rules/doc-authority-hierarchy.md) (carries `<!-- scope:aif-handoff-review-gate-gap -->` annotation + folder-authority header; claims authority for nothing beyond this incident's post-mortem); [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) (NOT applicable — no new capability/dependency/module introduced; this is a finding about an external project); [ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) T3 (every empirical claim cites either the task JSON, `git diff --numstat` output, or a specific `agentActivityLog` timestamp — no fact asserted from memory); [phase-research-coverage.md](../../../.claude/rules/phase-research-coverage.md) §1.12 (this is a negative-finding + post-mortem research-patch, not a positive-existence claim, so the "≥3 sources / adversarial counter-prompt" ladder does not apply; the §6 falsifier is the equivalent rigour for a post-mortem).
- **Backward-check (class of change = "docs-only research-patch recording an incident in an external project"):** sibling surfaces where the same change-class would apply = every other incident where a tool the framework integrates (aif-handoff, claude CLI, gh, docker) mis-fires in a way the framework's own discipline catches downstream. This patch's pattern (incident → root-cause trace → upstream-fix recommendation + consumer-side mitigation) is the reusable template. Does not collide with any in-flight umbrella (deps-hash-multistack DH-S1 already landed clean via #1024; this patch records why the aif path did not). Supersedes nothing.
- **Self-application (T15):** this patch applied its own "every claim verified against a fired command" discipline — the §2 `affected_files` JSON and the §3 `agentActivityLog` timestamps were re-quoted from the live task API in the same session that wrote the patch, not transcribed from memory; the §1 numstat was re-run under `-w` to rule out whitespace noise before asserting "destructive". The patch's recommendation (§5: derive `affected_files` from `git diff --name-only`) is the same mechanical-verification discipline the patch itself uses — the post-mortem does not prescribe a rigour it does not itself practise.
