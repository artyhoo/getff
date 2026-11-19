# Portable verified autonomy kickoff — Phase -1 review A, round 1

> Authoritative for: the bounded command/interface, stage-gate and acceptance review below.
> NOT authoritative for: implementation authorization, publication, dispatch, installed-host fitness or completed product acceptance.

VERDICT: GO

BLOCKER (0): none.
MAJOR (0): none.
MINOR / notes lane (0): none requiring a kickoff change.

## Immutable scope

- Inputs-ref: `10a567a402295758f53172a4eb1e37ff70793257`.
- Kickoff: `.claude/orchestrator-prompts/portable-verified-autonomy/kickoff.md`, SHA256 `fc69ebec945425313aaa0d0a619af18dec1ded3fb1a371a73a30cb625360b98b`.
- Used the supplied `kickoff-r1-inputs.json` map, then mapped snapshots or `git show`/`git grep` at Inputs-ref. All six mapped snapshots compare byte-for-byte with their Git objects. Design SHA256 is `d82086984feffc8bc038021ef4419e0d4388e32e82accbe7ebab0e016002904c`; PRD SHA256 is `ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721`, matching kickoff lines 16–17.
- The supplied MEMORY-SWEEP result is 0 matches for `portable-verified-autonomy|OpenMausBot|grokbot-field-notes|Hy-Memory` in the stated project memory directory. Treated that as a supplied boundary fact; did not retrieve author/team memory or inspect chat/history. Binding operator decisions came from the supplied artifacts.
- No external-service queries, runtime qualification, model launch, pipeline invocation, publication or source modification occurred. The only write is this report.

## Evidence and attempted falsification

| Question | Evidence at Inputs-ref | Review result |
| --- | --- | --- |
| Does the kickoff turn preparation into execution authority? | Kickoff lines 22–24; `spec-agreement.md:8–9` and `:17` | No. It forbids enrollment/launch from authoring, requires reviewed staging publication of the exact closure, and preserves later task/value choices. No auto-dispatch marker exists. |
| Are the proposed helper names falsely claimed as shipped APIs? | Kickoff lines 32–41 and 132–143; design lines 114–125 | No. Proposed helper/test/harness paths are explicitly future implementation. The plan must enumerate real APIs and lock/CLI primitives before editing. Their present absence is not a defect. |
| Are the declared authority and review commands real? | `current-decisions.mjs:865–878, 907–912, 964–966`; `check-result-review.mjs:695–794`; `publish-result-review.mjs:9–42, 55–71` | Yes. `--check-plan-prep`, `--feature`, `--spec`, `--orch-home` exist. Current result validation requires independently selected `currentBriefRef`, `observedRevision`, an enforcing contract and a review path; `requirePublished: true` checks the publication shape and attempt identity. Kickoff lines 41 and 71 retain that distinction and forbid replacing semantic review with schema validity. |
| Is bounded AIF observation supported? | `packages/runtime-bridge/src/cli/await.ts:4–7, 52–65, 127`; design line 122; kickoff lines 69–70 | Yes. `--until-actionable --timeout-ms 45000` is supported; a deadline is `observation_deadline_not_worker_failure`. Healthy pending work retains late-result intake beyond twelve checks rather than being treated as failure. |
| Is host verification parsable without running future tests? | Ran the Inputs-ref `scripts/host-verify.sh` bytes with `--list` against the mapped kickoff snapshot; exit 0 | Exactly the four lines at kickoff 135–138 were extracted: plan-prep, future binding tests, future receipt verification, `make self-audit`. `Makefile:3` defines self-audit. No acceptance commands were executed or credited as passing. |
| Can a green worker bypass a predecessor merge or current candidate? | Kickoff lines 54, 63, 121–130, 141, 145 and 167; design lines 65–75 and 133 | No. Sequential ownership, exact recorded predecessor PR/head and non-null staging merge are required; stale reports and unknown custody hold continuation. Worker DONE/open green PR is explicitly insufficient. |
| Does first-host success quietly replace full product acceptance? | Kickoff lines 74, 93–95 and 169–171; PRD lines 94–100; design lines 165–174 and 223–235 | No. Packaging smoke is separated from PA6; S3/S4 and PA9 remain essential later proofs. Measured raw effort and an unchosen payback horizon are retained. |
| Are concrete traps, scope and implementation review preserved? | Kickoff lines 41–43, 99–110 and 149–163 | Yes. Enumerated failures include premature success, lost return, stale candidate, late control, prolonged healthy execution, forbidden memory and paid-operation assumptions. Existing validators, structural obligations, SSOT/§1.7 and earliest-channel counterexamples remain required; unrelated changes are observations. |

Structural inspection: the kickoff has the legal `build-and-verify` L0 declaration (`40-kickoff-rigor-label.test.ts:73–96`), an explicit trap citation plus concrete T labels (`12-ai-laziness-traps.test.ts:63–75`), a recognized umbrella filename and an executable host contract. Proposed new files are under canonical pipeline helpers/references and scripts; no specific new watched template/rule/role file is prescribed. If the implementation plan adds such a path, kickoff line 41 retains the mandatory allowlist/structural probe. Principle 47's repository-wide symlink-safe CLI entry requirement also applies to future `.mjs` entrypoints (`47-symlink-safe-entry-point.test.ts:4–7, 80–97`).

## Compact implementation watch-list

These are existing explicit qualification obligations, not new findings or extra scope:

1. The plan must bind the exact CLI launch/resume argv, ten-minute quantum ceiling, process start identity and safe cessation proof from design lines 120–123; kickoff lines 68–69 must not be implemented as an indefinite subprocess wait.
2. Q1/Q2 require real permitted laptop/native-control and injected-source observations before representative task enrollment (kickoff lines 67–75). Captured help, synthetic fixtures and a fresh session ID do not satisfy them.
3. Receipt verification must follow the bound stage artifact root and exact candidate/authority/environment; the framework umbrella root in kickoff line 137 is not a consumer authority initialization recipe. Clean packaging smoke must exercise the actual transitive closure and prerequisites (lines 38, 74 and 141).
4. Before capability commits, consume the applicable SSOT/reuse evidence and current §1.7 requirements (line 43). This review did not rerun an upstream survey or certify an installed CLI/memory interface; installation-sensitive facts must be reverified at execution.

Wrong if the future plan omits a binding design constraint, uses cached/source-only observations as host receipts, or changes these kickoff bytes without renewed exact-content review. Those would invalidate this scoped GO; they are not current failures demonstrated by the reviewed artifact.

Next step: synthesize the two Phase -1 reviews for this exact kickoff; retain the preparation-only boundary.
