# Meta-kickoff + state template placeholders

> **Authoritative for:** the 40 substitution tokens used by `meta-kickoff.template.md` and `state.md.template` when §4 Meta-kickoff write instantiates them. Grouped by source so each substitution traces to either §1 plan-currency output, §3 launch-table, the selected kickoff's content, or per-stage Phase -1 review state.
> **NOT authoritative for:** §4 procedure itself — that lives in `../SKILL.md §4 Step 2`. This file is the data table that procedure consults.

Substitute every `{{<PLACEHOLDER_NAME>}}` token in the template using the tokens listed below.

## From §1 plan-currency output

- `{{UMBRELLA}}` → the selected umbrella name (also the directory name under `.claude/orchestrator-prompts/`).
- `{{DATE}}` → today's date (`YYYY-MM-DD`) from `date +%Y-%m-%d`.
- `{{GIT_HEAD_SHORT}}` → `git rev-parse --short HEAD` at invocation time.
- `{{PLAN_CURRENCY_VERDICT}}` → one of «Plan is current» / «DRIFT detected (N items)» / «STALE refs only» — from §1 verdict.
- `{{STALE_ITEMS_OR_NONE}}` → bulleted list of stale refs from §1, or the literal «none».

## From §3 launch-table

- `{{LAUNCH_TABLE}}` → the table emitted by §3 (Sub-wave / Type / Mode / SDD? / Stage / Parallel-sibling / Volume).
- `{{KICKOFF_TYPE}}` → meta-launch type derived from the umbrella's kickoff `Type:` header (`R-phase` / `I-phase build` / `wiring` / `manual-liveness`).
- `{{DELIVERABLE_SUMMARY}}` → one-sentence summary of what the umbrella ships (from kickoff §0 / §2).
- `{{GIT_GATE_STAGE_1}}` → literal `gh pr list --search "is:merged head:<branch> base:staging created:>=<date>"` command for Stage 1 dependencies (one command per Stage 1 head branch, joined with `&&` or emitted as a multi-line script).
- `{{GIT_GATE_STAGE_2}}` → same shape, for Stage 2 dependencies. Omit (or replace with the literal «N/A — only Stage 1 in this umbrella») if no Stage 2 exists.
- `{{ADDITIONAL_STAGE_GATES}}` → optional Stage 3+ blocks following the Stage 2 template, OR the literal empty string if no further stages.
- `{{DISPATCH_INSTRUCTIONS}}` → per-sub-wave dispatch block: for each row in §3, emit `claude -w <umbrella>-<sub-wave-id>` (Mode B preferred per CC native `--worktree` — PR #279 hook auto-sets up worktree + symlinks) or inline Agent dispatch (Mode A) per §5 Dispatch tree. Portable `bash scripts/create-worktree.sh <name>` (or manual `git worktree add`) retained as fallback when outside CC or settings.json hook unwired.

## From §2a slicing + fog-of-war

- `{{FOG_OF_WAR}}` → §2a fog-of-war line: what this umbrella does NOT know yet, in concrete items — the parked decisions with their owners, the measurements the next stage boundary is expected to produce, the assumptions a stage would falsify. Name items or write the literal «none — the spec settles every fork»; «unknown unknowns» filler is not an answer.

## From §5 AI-traps obligation

- `{{T_TRAP_ENUMERATION}}` → explicit T-numbers active for this umbrella (composed by reading the umbrella's kickoff §5 OR inferred from the umbrella's type — NEVER blanket-reference `see ai-laziness-traps.md`; that itself is the T7 anti-pattern this skill exists to prevent).
- `{{DOMAIN_TRAPS}}` → ≥1 umbrella-specific trap NOT in the canonical catalogue, labelled `T-<UMBRELLA-SHORT>-A` (and `-B`, `-C` for more). Required by principle 12 test.

## State-companion template (`state.md.template`) — additional tokens

Fill in addition to the kickoff template above:

- `{{STATUS}}` → initial value `«preflight done — awaiting Stage 1 dispatch»` or maintainer-provided status.
- `{{BRANCH}}` → `git branch --show-current` at invocation.
- `{{AHEAD_BEHIND}}` → `git rev-list --count --left-right origin/staging...HEAD` output (or `(no upstream)`).
- `{{PLAN_CURRENCY_DETAILS}}` → fuller §1 transcript (DRIFT line items, stale-ref list).
- `{{DECISION_1}}` / `{{DECISION_2}}` → first meta-orchestrator decisions taken this invocation (e.g. «proceeded with umbrella X» / «recommend Stage 1 parallel»). Add `{{RATIONALE_1}}` / `{{RATIONALE_2}}` lines.
- `{{STAGE_1_VERDICT}}` / `{{STAGE_1_BLOCKER}}` / `{{STAGE_1_MAJOR}}` / `{{STAGE_1_MINOR}}` / `{{STAGE_1_APPLIED}}` → fill at Phase -1 review time, NOT at preflight (leave as the literal placeholder until §7 reviewer returns).
- `{{STAGE_2_VERDICT}}` → same, set later.
- `{{OPUS_TOKENS}}` / `{{SONNET_TOKENS}}` → initial `0` (updated per stage).
- `{{SW_A_STATUS}}` / `{{SW_A_BRANCH}}` / `{{SW_A_PR}}` / `{{SW_A_NOTES}}` → first sub-wave row.
- `{{SW_B_STATUS}}` / `{{SW_B_BRANCH}}` / `{{SW_B_PR}}` / `{{SW_B_NOTES}}` → second sub-wave row. Add `_C_` / `_D_` rows by hand if the launch-table has more sub-waves (edit `state.md.template` once when this becomes a recurring need).
- `{{REPO_ROOT_REL}}` → relative-path prefix to repo root from this file (typically `../../..`).
