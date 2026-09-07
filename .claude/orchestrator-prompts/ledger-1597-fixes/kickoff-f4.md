# KICKOFF — ledger-1597-fixes / F4 — ecosystem-python parsing, rule-bootstrap write order, research-adapter dedup

> **Umbrella:** [kickoff.md](kickoff.md) — read §2 scope lock and §3 constraints first.
> **Rigor label (effort-worthiness L0):** `build-and-verify`.
> **Findings:** A7-1, A7-4, R-1, R-4, R-5 (verbatim below). Line numbers are at `992377dbdb`; relocate on the current base.

## Task

Two correctness fixes first, then three deduplications, in that order, each an atomic commit; one PR to `staging`: (1) `pipAdapter.listDirectDeps` parses the multi-line PEP 621 `dependencies = [...]` form (A7-1); (2) `runPracticeRender` runs the PF-1 join check BEFORE writing any `.yml` and reports the real reason (A7-4); (3) one shared path-containment helper for the four research adapters (R-1); (4) `parseIdentitiesFromJsonArray` gains an optional container path so golangci stops re-implementing it (R-4); (5) the clippy render/bridge pair reuses the astgrep driver + provenance wrapper (R-5).

## Context (data — the findings, verbatim from the ledger)

### A7-1 — Multi-line pyproject deps dropped: detection + Tier-1 dead `[CONFIRMED]`
- **Where:** `packages/core/research/ecosystem-python.ts:104` (synth+research+validator)
- **Defect:** pipAdapter.listDirectDeps only recognises a single-line `dependencies = [...]` array, so the dominant multi-line PEP 621 form (uv/hatch/pdm default) yields an empty direct-dep set — and this PR newly wires that set into stack detection (read-python-cargo.ts detectPythonFramework) and the consumer --from-practice Tier-1 path.
- **Failure-scenario:** uv-init pyproject (multi-line dependencies) → listDirectDeps empty → detectPythonFramework null → tier1For rejects every framework-docs host as not-a-direct-dependency → --from-practice records citing fastapi/django docs land research-only.
- **Verifier:** Repro: multi-line deps → Set(0); single-line → Set(2). Cause :104 single-line regex fed per line by :263-266. read-python-cargo.ts:32 consumes it. Documented v1 limitation (spec 2026-07-17 lg-s4 :57, test :84) but now load-bearing for detection and the Tier-1 direct-dep gate (allowlist-resolver.ts:217).

### A7-4 — PF-1 throw after YAML write: partial output, wrong message `[CONFIRMED]`
- **Where:** `packages/core/install/rule-bootstrap-cli.ts:285` (synth+research+validator)
- **Defect:** runPracticeRender writes every rendered .yml to the consumer before the S1b PF-1 join check runs, and that check throws a plain Error on a rendered+research-only entryId pair (which planResearchedAstgrep's dup guard does not catch), so the run leaves the rule file on disk with no generation-context fragment and reports it as 'practice record invalid or unreadable' with rc=0.
- **Failure-scenario:** .getff/rules-research/ holds foo.practice.json (valid, entryId foo) and foo-old.practice.json (same entryId, no pattern → research-only). plan.rendered=[foo], researchOnly=[foo]; loop 241-245 writes foo.yml; loop 280 finds 2 records → throws; main's catch prints '[rule-bootstrap] practice record invalid or unreadable — … PF-1 park trigger fired' exit 0. foo.yml delivered, no generation-context/python/foo.json → _py_json_rules falls back to {provenance:[],tier:2} for a Tier-0 rule.
- **Verifier:** Repro with two records sharing entryId (one pattern-less): .yml written, then THROWN 'S1b PF-1 park trigger fired … found 2', no generation-context fragment; write loop :241-245 precedes join check :285-287; plan-time dup guard (render-researched-astgrep.ts:149-160) iterates only rendered; catch :338-356 prints 'invalid or unreadable' and exit 0.

### R-1 — python adapter clones cargo's symlink-containment gate `[CONFIRMED]`
- **Where:** `packages/core/research/ecosystem-python.ts:148` (synth+research+validator)
- **Defect:** The pip adapter copy-pastes cargo's whole path-containment kit (isUnsafeDepName, isWithinRoot, resolvedWithinRoot, stripComments) instead of a shared research helper; isUnsafeDepName now exists in FOUR adapters with three different semantics (npm scoped-aware, cargo/python sep-based, go only `..`/backslash).
- **Failure-scenario:** ~45 lines duplicated verbatim (ecosystem-cargo.ts:252-300 → ecosystem-python.ts:148-178); this is the fail-closed symlink-escape gate from research-source-trust.md §5 — a hardening fix in one adapter silently does not reach the others, and go's isUnsafeDepName (ecosystem-go.ts:39-41) already omits the `/` and `sep` rejections.
- **Verifier:** python :148-178 ≡ cargo :252-300 modulo comments; four isUnsafeDepName copies with three semantics (go:40 drops / and sep). No shared helper exists; extraction is in-scope (same package).

### R-4 — golangci parser clones shared parseIdentitiesFromJsonArray `[CONFIRMED]`
- **Where:** `packages/core/backends/golangci/firing-runner.ts:91` (synth+research+validator)
- **Defect:** golangci's parseCodesFromStdout re-implements backends/shared/json-array-parse.ts parseIdentitiesFromJsonArray line-for-line, differing only by a `$.Issues` container walk the shared helper could take as an optional parameter.
- **Failure-scenario:** 20 lines (golangci/firing-runner.ts:91-110) duplicating json-array-parse.ts:40-58; the tolerance contract ('non-JSON stdout → empty set, never a crash') is maintained by hand in a third place.
- **Verifier:** golangci :91-110 repeats shared :40-58 line for line except the $.Issues hop; getByJsonPath already imported from the shared module; author pinned the choice with firing.test.ts:110-116 — reuse = a containerPath parameter on the shared helper + re-scoping that test.

### R-5 — clippy render/bridge files clone astgrep driver + provenance wrapper `[CONFIRMED]`
- **Where:** `packages/core/synthesizer/render-researched-clippy.ts:236` (synth+research+validator)
- **Defect:** The clippy research pair (render-researched-clippy.ts + research-to-clippy-node.ts) is a mechanical mirror of the astgrep pair: the main() CLI driver and the private firstProvenanceRejection wrapper are copied rather than parameterised over the backend.
- **Failure-scenario:** ~50 driver lines (render-researched-clippy.ts:236-278 vs render-researched-astgrep.ts:216-255; 77 identical lines by comm) plus 13 lines of firstProvenanceRejection (research-to-clippy-node.ts:244-257 vs research-to-node.ts:238-253) — the provenance-rejection trust policy now has two owners.
- **Verifier:** 78 identical non-blank lines between the render pair; driver diff is backend-word renames + a 4-line report loop; isMain idiom appears in three files; firstProvenanceRejection differs by two comment lines.

## Constraints

- Owned files: the umbrella §1 F4 row — `packages/core/research/ecosystem-{python,cargo,go,npm}.ts` (cargo/go/npm ONLY for R-1's helper adoption), a NEW shared helper under `packages/core/research/` (keep it under 80 LOC — above that it is a capability commit and needs the full `Prior-art:` consult, see CLAUDE.md), `packages/core/install/rule-bootstrap-cli.ts`, `packages/core/backends/golangci/firing-runner.ts`, `packages/core/backends/shared/json-array-parse.ts`, `packages/core/synthesizer/render-researched-{clippy,astgrep}.ts`, `packages/core/synthesizer/research-to-{clippy-node,node}.ts`, and their tests.
- R-1 decision: the shared helper keeps the STRICTEST semantics (cargo/python: reject `..`, `/`, `\`, `sep`); the go adapter therefore tightens — record in the commit body which dep names go now rejects that it previously accepted, and add the paired negative test.
- A7-4 decision: validate the whole plan (including the PF-1 join) before the first write; on failure print the PF-1 park message, write nothing, exit non-zero. Keep the existing "invalid or unreadable" message for genuinely unreadable records only.
- Order is binding: correctness (A7-1, A7-4) lands before the dedup commits so a partial run still ships the consumer-visible fixes.
- Iteration cap: 6 tool-loop rounds per commit; then report PARTIAL.

## Tools

Bash (`npx vitest run packages/core/research/ packages/core/install/ packages/core/backends/ packages/core/synthesizer/` from the repo root), Read, Edit, Grep, git. No external binaries needed.

## Output

A REPORT with a literal `Status: DONE|BLOCKED|PARTIAL` line, then `Deliverable:`, `Evidence:` (RED and GREEN per finding), `BLOCKER:`/`MINOR:` per [agents/orchestrator-worker-discipline.md](../../../agents/orchestrator-worker-discipline.md). Name the active traps from the umbrella §4.

## AI-traps (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active traps for this stage: **T3** (command output or `file:line` behind every claim), **T5** (the owned-file row is the whole scope), **T14** (a SKIPped lane proves nothing — say which lanes executed), **T19** (cold-review your own diff before the report), **T20** (quote the output behind each verdict).

## Verify

1. A7-1: a uv-style multi-line `dependencies = [\n "fastapi>=0.100",\n "httpx",\n]` yields `Set(2)` (RED on base, GREEN after); the single-line form still yields the same set.
2. A7-4: two records sharing an entryId (one pattern-less) → no `.yml` written, non-zero exit, PF-1 message (RED on base: the `.yml` exists after the run).
3. R-1/R-4/R-5: `grep -rn 'function isUnsafeDepName' packages/core/research/` → one definition; `grep -n 'parseCodesFromStdout' packages/core/backends/golangci/firing-runner.ts` shows a call into the shared helper, not a reimplementation; `comm` line-identity between the two render drivers drops below 20 lines.
4. `npx vitest run packages/core/` green (quote the summary line).
5. `git diff origin/staging --stat` lists only owned files.

```bash host-verify
npx vitest run packages/core/research/ packages/core/install/ packages/core/backends/ packages/core/synthesizer/
bash scripts/run-local-ci-sweep.sh
```
