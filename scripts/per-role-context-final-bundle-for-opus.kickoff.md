<!-- bridge-profile: Z.AI GLM-5.2 SDK -->
<!-- scope: kickoff — per-role-context FINAL BUNDLE FOR OPUS. Assemble ALL research material into one bundle file and LAND IT ON STAGING via PR, so Opus (running through aif in a future session) receives everything in one place with no host-only paths. The 3 task outputs from prior aif runs must be fetched via the aif-handoff API (URL in env) since they live in /Users/art/code/aif-handoff/projects/ — host-only paths, invisible to Opus's aif container. -->

# per-role-context-final-bundle-for-opus — kickoff

> **Goal:** produce ONE bundle file at `docs/superpowers/specs/2026-07-27-per-role-context-bundle-for-opus.md` on `staging` (via PR) that contains every piece of research material from this track, so Opus in a future aif session can read it without needing host-only paths.
>
> **Why this task:** the operator clarified that Opus will run through aif (not directly on the host). aif containers cannot read `/Users/art/code/aif-handoff/projects/...` (host-only paths) — confirmed by the v1 bundle task's Branch B blocker (`73519b9c`). Everything must land on staging.

## §0 What this task is NOT

- NOT a filter — preserve all findings including contradictions.
- NOT a recommendation — no shape picks, no verdicts.
- NOT a fix for prior deliverables — copy/summarize, don't edit.
- NOT a license to modify any prior file (on staging or in task outputs).

## §1 Inputs to assemble

### Source 1-4: on `origin/staging` (visible to this container after staging sync)

1. `docs/meta-factory/research-patches/2026-07-26-per-role-context-shaping-raw-research.md` — 10 falsifiable claims (C1-C10), 8-item verify-list, 5 parked forks. The original research patch.
2. `docs/superpowers/specs/2026-07-26-per-role-context-candidate-shapes.md` — 18 candidate shapes (α-σ), neutrally described.
3. `docs/superpowers/specs/2026-07-26-per-role-context-inflight-context.md` — in-flight context (token-audit umbrella, PR #1175, scratchpad Seat A/B).
4. `docs/meta-factory/research-patches/2026-07-27-per-role-context-addendum-fresh-2026.md` — ADDENDUM: actual payload measurement (~236 KB always-on), superpowers v6.2.0 diff (NEW scoped re-reviewer role), 6 fresh summer-2026 sources, 3 NEW claims (C11-C13), 2 NEW forks. **Read this LAST — it supersedes parts of source 1.**

### Source 5-7: in aif-handoff task outputs (fetch via API)

The 3 verification tasks are done. Their output files live in host project dirs at `/Users/art/code/aif-handoff/projects/<project>/`. From inside THIS container, those paths likely don't exist — fetch via the aif-handoff REST API instead.

**AIF_HANDOFF_BASE_URL** should be in env (typically `http://localhost:5180`). If unset, the operator will need to set it; in that case, follow the Branch B fallback (§4).

For each task, query its `reason` field (the aif runtime stores the autonomous-run summary there):

5. **Runtime-probe** (`f164e807-191a-4336-9fe1-52145255c00e`) — verified 6 claims (P1-P6) in live CC runtime. Key: P5 REFUTED (digest location), P4 PARTIAL (claudeMdExcludes ignored for rules/).
6. **Deep-project-research** (`f4dc0bff-37c6-4662-abab-5c67c9a646b6`) — exhaustive sweep of 13 surfaces. Key: S13 documents `subagent_type:"implement-worker"` runtime dispatch + superpowers v6.2.0 has 5 per-role templates.
7. **Cold-review** (`4e73e54e-da1f-44a8-979e-209013a9e6cd`) — was a blocker-report (couldn't reach deliverables); document this honestly in the bundle.

```bash
for tid in f164e807-191a-4336-9fe1-52145255c00e f4dc0bff-37c6-4662-abab-5c67c9a646b6 4e73e54e-da1f-44a8-979e-209013a9e6cd; do
  echo "=== $tid ==="
  curl -s "${AIF_HANDOFF_BASE_URL:-http://localhost:5180}/api/tasks/$tid" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print('status:',d.get('status'));print('reason:');print(d.get('reason','')[:3000])"
  echo ""
done
```

### Source 8: DeepWiki MCP cross-check (already done by GLM host session)

The GLM host session already ran two DeepWiki MCP queries. Their answers go in the bundle as §6:

- **`obra/superpowers`** query — confirmed: no hook branches on `subagent_type`; SDD does template-based role partitioning (controller obligation, not enforced); no per-role token budget; `task-reviewer-prompt.md` carries "Do not crawl the broader codebase" + "Do not re-run tests" as explicit context-omission rules.
- **`anthropics/anthropic-cookbook`** query — confirmed: Agent Skills has NO role-specific context budgets, NO role-tagged skills, NO per-role skill preload. Progressive disclosure is strictly load-on-demand by skill-relevance. Multi-agent orchestration in the cookbook still uses general progressive disclosure, not role-based filtering.

**Discrepancy noted (for §5 contradictions):** DeepWiki says `re-review-prompt.md` is NOT present in v6.2.0 (it claims v6.0.0 replaced it with `task-reviewer-prompt.md`). Local file inspection by the deep-research task proved it DOES exist at `~/.claude/plugins/cache/superpowers-dev/superpowers/6.2.0/skills/subagent-driven-development/re-review-prompt.md` (107 lines). Opus should treat DeepWiki's claim as FALSIFIED by the local file evidence.

## §2 Bundle structure

Write to **`docs/superpowers/specs/2026-07-27-per-role-context-bundle-for-opus.md`** with this structure:

```markdown
# Per-role context — FINAL BUNDLE for Opus in CC

**Assembled:** <timestamp>
**Assembler:** aif-handoff container (final-bundle task)
**For:** Opus review + fabla-prep in CC
**Session boundary:** GLM (worktree, raw material) → aif (3 verify tasks + this bundle on staging) → Opus (CC, filter + fabla-prep). Opus is the filter; fabla is the decider.

## 0. Reading order (suggested)

1. §1 — Operator question (verbatim)
2. §2 — The 4 substrate documents (paths on staging)
3. §3 — 3 verification task results (runtime-probe, deep-research, cold-review)
4. §4 — DeepWiki MCP cross-check (superpowers + anthropic-cookbook)
5. §5 — Contradictions to resolve (LOAD-BEARING)
6. §6 — Parked forks + candidate shapes (decision space)
7. §7 — What this bundle does NOT do

## 1. Operator question (verbatim)

<copy from raw research patch §Problem>

## 2. Substrate documents (on staging — read in this order)

For each: one-line "what it is" + path + key claims/sections.

- Source 1: <path> — <summary>
- Source 2: <path> — <summary>
- Source 3: <path> — <summary>
- Source 4 (ADDENDUM, read LAST): <path> — <summary>

## 3. Verification task results

### 3.1 Runtime-probe (task f164e807)
<status + reason from API query + the P1-P6 verdict table copied verbatim from the task's report if reachable; otherwise copy the reason field summary>

### 3.2 Deep-project-research (task f4dc0bff)
<status + reason + the S1-S13 surface findings + Q1-Q7 answers — copied/summarized from the task's report if reachable; otherwise copy the reason field summary>

### 3.3 Cold-review (task 4e73e54e)
<status + reason — note honestly that this was a blocker-report in v1; the v2 re-run may or may not have happened depending on operator timing>

## 4. DeepWiki MCP cross-check

### 4.1 superpowers v6.2.0 (obra/superpowers)
<copy GLM host's DeepWiki answer; note the re-review-prompt.md discrepancy>

### 4.2 Anthropic Agent Skills (anthropics/anthropic-cookbook)
<copy GLM host's DeepWiki answer>

## 5. Contradictions to resolve (LOAD-BEARING)

Preserve BOTH sides. Opus decides.

| # | Source A claim | Source B counter-claim | What Opus needs to verify |
|---|---|---|---|
| 1 | raw research C5: "no per-role branching in any hook" | deep-research S13.a: `subagent_type:"implement-worker"` runtime dispatch documented | read `docs/superpowers/specs/2026-06-02-aif-parallel-dispatch-design.md:71,103,141` and verify it's runtime dispatch, not just design-prose |
| 2 | raw research C5/C10 P5 file:line: "digest in session-bootstrap.md between markers" | runtime-probe P5 REFUTED: digest is inline-heredoc in `inject-session-bootstrap.sh:25-33` | confirm via `wc -c` + `sed -n` on the heredoc |
| 3 | raw research C10: uniform digest = deliberate anti-drift (2026-05-09 incident) | operator's framing: worker should not receive goal/architecture | read the 2026-05-09 incident record directly (verify-list #2) |
| 4 | DeepWiki: re-review-prompt.md NOT in v6.2.0 | local file: re-review-prompt.md exists at 107 lines | DeepWiki FALSIFIED by local evidence |
| 5 | addendum C12: v6.2.0 adds scoped re-reviewer (narrower context) | addendum C11: actual worker payload is ~236 KB unfiltered | re-reviewer scope-narrowing is INSIDE SDD only; doesn't affect the always-on load |

## 6. Parked forks + candidate shapes (decision space)

- 7 forks (5 from raw research patch + 2 from addendum) — copy verbatim from the patches.
- 18 candidate shapes (α-σ) — reference path, don't copy.

## 7. What this bundle does NOT do

- Does NOT pick a candidate shape.
- Does NOT resolve forks.
- Does NOT filter "wrong" findings — contradictions preserved.
- Does NOT recommend next steps for Opus.
- Does NOT pre-load the fabla's framing.
```

## §3 Constraints

- **Read-only on prior deliverables.** Copy/summarize; do not edit.
- **No filtering.** If a finding looks wrong, copy it with "(unverified)" note. Opus filters.
- **No recommendation.** Opus + fabla decide.
- **Cite source paths** for every copied finding so Opus can verify.
- **Preserve contradictions explicitly.** §5 is load-bearing.
- **Self-application.** This bundle's own file is part of the surface — note it but don't audit yourself.

## §4 Branch B fallback (if aif-handoff API unreachable)

If `AIF_HANDOFF_BASE_URL` is unset or `curl` to it fails:

1. For each task ID in source 5-7, write `(aif-handoff API unreachable — task ID <tid>, host output at /Users/art/code/aif-handoff/projects/<...>, operator copies to staging in a follow-up)`.
2. Assemble the bundle from sources 1-4 (which ARE on staging) + source 8 (DeepWiki, already done).
3. The bundle is still useful because §2 (substrate) and §4 (DeepWiki) carry the load; §3 will note the gap.

## §5 After writing the bundle

Open a PR (base `staging`) with the new file. Use the fidelity-auditor (`agents/fidelity-auditor.md`) as a cold subagent for the verdict; paste into the PR body's `## Fidelity verdict` section. The `pr-body-fidelity` CI gate requires it.

PR title: `docs(per-role-context): final bundle for Opus — assembled from 4 staging docs + 3 task outputs + DeepWiki cross-check`.

This task ends when the PR is open with fidelity verdict; the operator merges.
