# KICKOFF — ledger-1597-fixes / F2 — pr-body-fidelity + unpinned-tool regexes

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** A4-3, A4-5, R-8, A4-7 (verbatim below). Line numbers are at `992377dbdb`; relocate on the current base.

## Task

Close four regex holes in two pre-push checks: the severity-contract arm must see numbered-list and table-row findings (A4-3), must not treat `- BLOCKER: none` as an opened finding (A4-5), must share ONE `FILE_LINE_RE` with `s17.ts` (R-8), and the npm-global pin check must reject dist-tags like `@latest`/`@next` (A4-7). One commit per finding (four commits), one PR to `staging`.

## Context (data — the findings, verbatim from the ledger)

### A4-3 — Severity-contract arm fails open on `1. BLOCKER` / table rows `[CONFIRMED]`
- **Where:** `packages/core/hooks/checks/pr-body-fidelity.ts:65` (pre-push+checks)
- **Defect:** FINDING_GRADE_RE only recognises a BLOCKER/MAJOR entry that opens with an optional -/* bullet, so the severity-contract arm silently passes numbered-list and table-shaped findings — leaving Failure-scenario: unenforced for them.
- **Failure-scenario:** Verified with the merged module: body '## Review findings\n1. BLOCKER: hook never fires\n2. MAJOR: x' → checkPrBodyFidelity returns { ok: true }; likewise '| BLOCKER | hook never fires |' → ok:true. A round-triggering BLOCKER with no Failure-scenario merges with the gate green — the #findings-as-KPI shape reviewer-discipline.md §6 says the L3(a) arm must catch.
- **Verifier:** Repro against the module (unchanged since HEAD): '1. BLOCKER: …' → ok:true; '| BLOCKER | … |' → ok:true; control '- BLOCKER: …' → ok:false with the missing-Failure-scenario error.

### A4-5 — `- BLOCKER: none` summary line falsely fails the fidelity gate `[CONFIRMED]`
- **Where:** `packages/core/hooks/checks/pr-body-fidelity.ts:73` (pre-push+checks)
- **Defect:** FINDING_COUNT_RE exempts only digit tallies (`- BLOCKER: 1`), so the natural zero-form `- BLOCKER: none` is parsed as an opened finding entry and the gate goes RED demanding a Failure-scenario for a finding that does not exist.
- **Failure-scenario:** Verified: '## Review findings\n- BLOCKER: none\n- MAJOR: none\n- MINOR: 2 (notes lane)' + valid skipped verdict → { ok: false, errors: ['entry graded BLOCKER lacks a Failure-scenario: line', '… MAJOR …'] }. A clean review blocks the merge with a misleading message until the tally is rewritten.
- **Verifier:** Repro: '- BLOCKER: none / - MAJOR: none' → ok:false with two lacks-Failure-scenario errors; control with '0' → ok:true.

### R-8 — FILE_LINE_RE duplicated with divergent grammar vs s17.ts `[CONFIRMED]`
- **Where:** `packages/core/hooks/checks/pr-body-fidelity.ts:62` (pre-push+checks)
- **Defect:** The new fidelity gate defines its own path.ext:NN citation regex although checks/s17.ts already has a FILE_LINE_RE for the same §1.7 citation contract, and the two regexes accept different citations.
- **Failure-scenario:** Two same-named FILE_LINE_RE constants judge §1.7 citations differently: an uppercase-extension citation (Foo.TS:12, README.MD:3) satisfies pr-body-fidelity but fails s17.
- **Verifier:** Both constants verified; node run: Foo.TS:12 / README.MD:3 → fidelity true, s17 false; pkg@1/x.ts:2 and 'a b/c.ts:1' → true/true (both unanchored, match the x.ts:2 tail) — divergence real in one direction only.

### A4-7 — `npm i -g pkg@latest` accepted as a pinned install `[CONFIRMED]`
- **Where:** `packages/core/hooks/checks/unpinned-tool-install.ts:135` (pre-push+checks)
- **Defect:** checkNpmGlobalLine treats ANY @ after the package name as a version pin, so dist-tag forms `npm install -g tool@latest` / `@next` pass Rule A although they re-resolve on every run — exactly what ci-tool-pinning.md §1 forbids.
- **Failure-scenario:** Verified: checkNpmGlobalLine('npm install -g zizmor@latest') → null (clean); ('run: npm i -g @ast-grep/cli@next') → null. A workflow line `npm install -g zizmor@latest` ships through pre-push (owner both) and CI, reproducing the 2026-06-22 unpinned-zizmor incident with no ci-tool-pin: allow rationale.
- **Verifier:** Repro: 'npm install -g zizmor@latest' → null; '@ast-grep/cli@next' → null; control 'zizmor' → fix message; 'zizmor@1.26.1' → null.

## Constraints

- Owned files: `packages/core/hooks/checks/pr-body-fidelity.ts`, `packages/core/hooks/checks/unpinned-tool-install.ts`, `packages/core/hooks/checks/s17.ts` (ONLY to export/import the shared `FILE_LINE_RE`), and their `*.test.ts` siblings. `pre-push.ts` and `prior-art.ts` belong to other sessions — PARK if you need them.
- R-8 decision: ONE exported `FILE_LINE_RE` lives in `s17.ts`; `pr-body-fidelity.ts` imports it. Keep s17's (case-sensitive) grammar; record in the commit body which previously-accepted citations now fail.
- A4-7 decision: a version pin is a semver-shaped token (`@1.26.1`, `@^1.2`, `@~1`) — `@latest`, `@next`, any bare dist-tag word is unpinned unless a `ci-tool-pin: allow` rationale is present (the rule's existing escape).
- Careful: your own PR body passes through the gate you are changing — write it to the new grammar.
- Iteration cap: 5 tool-loop rounds per commit; then report PARTIAL.

## Tools

Bash (`npx vitest run packages/core/hooks/checks/` from the repo root), Read, Edit, Grep, git. No external binaries needed.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, then `Deliverable:`, `Evidence:` (RED and GREEN vitest output per finding), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T3** (command output or `file:line` behind every claim), **T5** (the owned-file row is the whole scope), **T14** (a SKIPped lane proves nothing — say which lanes executed), **T19** (cold-review your own diff before the report), **T20** (quote the output behind each verdict).

## Verify

1. Four new test cases, each RED on the current base (quote the failing assertion) and GREEN after its commit: `1. BLOCKER: x` without Failure-scenario → not ok; `| BLOCKER | x |` → not ok; `- BLOCKER: none` → ok; `npm install -g zizmor@latest` → fix message; `zizmor@1.26.1` → null.
2. `grep -rn 'FILE_LINE_RE\s*=' packages/core/hooks/checks/` shows exactly one definition.
3. `npx vitest run packages/core/hooks/checks/` green (quote the summary line).
4. `git diff origin/staging --stat` lists only owned files.

```bash host-verify
npx vitest run packages/core/hooks/checks/
bash scripts/run-local-ci-sweep.sh
```
