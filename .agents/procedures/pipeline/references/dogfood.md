# §9 Dogfood test (recursive-self-application gate)

> **Authoritative for:** the `/pipeline` dogfood test — the recursive-self-application gate (T15 from `ai-laziness-traps.md §2`) that the FIRST live invocation MUST run on the BUILD umbrella that produced the skill. Invocation steps, expected launch-table shape, HARD-GATE failure semantics. Body of `../SKILL.md §9` points here.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). Output-format grammar — see [output-format.md](output-format.md).

The FIRST live invocation of this skill MUST run on the BUILD umbrella that produced the skill itself. This is the recursive-self-application gate (T15 from [ai-laziness-traps.md §2](../../../rules/ai-laziness-traps.md) — cannot be skipped).

**How to invoke the dogfood test:**

1. Open a fresh worktree session via `claude -w meta-orchestrator-iphase` (CC native `--worktree`; portable `bash scripts/create-worktree.sh <name>` or manual `git worktree add` fallback when outside CC — if using raw `git worktree add`: run `git remote set-head origin --auto` first and base off `origin/HEAD`, not a hardcoded branch name, per Bug 1 rule in [parallel-subwave-isolation.md §1](../../../rules/parallel-subwave-isolation.md)). In the new session, run:

   ```bash
   bash .claude/skills/pipeline/helpers/plan-currency-check.sh meta-orchestrator-iphase
   bash .claude/skills/pipeline/helpers/priority-score.sh
   bash .claude/skills/pipeline/helpers/launch-table-generator.sh meta-orchestrator-iphase
   gh pr list --search "is:merged head:feat/meta-orchestrator-build base:staging" \
     --json number,title,mergedAt,headRefName --limit 10
   ```

2. Capture all output to `.claude/orchestrator-prompts/meta-orchestrator-iphase/dogfood-run-output.md` with sections:
   - `## Step 1 — plan-currency-check` (command + output)
   - `## Step 2 — priority-score` (command + output)
   - `## Step 3 — launch-table-generator` (command + output)
   - `## Step 4 — stage-gate gh pr list` (command + output)
   - `## Coherence call` — judgment paragraph: is the launch-table coherent for this umbrella?

**Expected output shape for meta-orchestrator-iphase:**

The launch-table-generator will detect sub-waves from the kickoff (A, B, C, D). The expected coherent launch-table:

```text
| Sub-wave | Type | Mode | SDD? | Stage | Parallel sibling | Volume |
|---|---|---|---|---|---|---|
| A | I-phase build | Mode A | No | 1 | — | M |
| B | I-phase build | Mode A | No | 1 | — | S |
| C | I-phase build | Mode A | No | 1 | — | S |
| D | I-phase build | Mode A | No | 1 | — | M |
```

**HARD GATE:** if the helpers produce no sub-waves (empty table), STOP and report «Dogfood gate: HARD FAIL — launch-table-generator found no sub-waves in kickoff.md». Do NOT commit. Surface failure trace to orchestrator.

**Note on dogfood coherence for this BUILD:** sub-waves A+B+C were dispatched as a single Mode A session (reasonable for a single worker covering skeleton + helpers + templates). Sub-wave D is this session. The launch-table helper detects sub-wave rows from kickoff §2/§3 tables — it may or may not find them depending on kickoff structure. If it finds rows: coherent. If it finds no rows but the kickoff is real: partial tool limitation (not a HARD FAIL — document as «tool limitation: kickoff table format not auto-parseable; manual launch-table produced above»).
