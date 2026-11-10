# S2 B5 — distinguish ast-grep from the unrelated sg command

> **Authoritative for:** D09 scoped alias-identity repair and acceptance.
> **Not authoritative for:** broad tool policy, other baseline repairs, TAK or campaign acceptance.

<task>
Repair the actual firing runner and its test availability premise so util-linux sg cannot
masquerade as ast-grep merely by returning success for scan --help.
</task>
<context>
Consume decisions-s2.jsonl D09, the reached B3 evidence and independent review trace. The
principles CI job already installs exact-pinned ast-grep0.44.1 before test:hooks; preserve it.
This is an additional evidence-backed S2 decision, not a change to frozen S1 conclusions.
</context>
<constraints>
Use exact files below. Preserve structured firing diagnostics, bad/good material outcomes,
canonical tool selection, absence honesty and current supported interfaces. No generic tool
platform, dependency, new CLI mode without need, global config, widened skip or bypass.
</constraints>
<tools>
Existing actual firing shell entrypoint, recorded diagnostic fixtures and existing shell/S5
harness. Controlled executables are tool-transport fixtures, not replacements for actual runner.
</tools>
<output>
Commit minimal identity repair, actual-entrypoint controls, B5 evidence/record, inventory and
normal derived manifest. Report to the local path below; no nested agents or push.
</output>
<verify>
Meaningful RED with wrong alias despite help0, then GREEN. Valid alias and absent-tool
companions preserve real diagnostics and explicit unverified state. Held identity weakening
must be caught with fixed expectations and restoration. Do not count unrelated failures.
</verify>

## Authority, exact scope and behavior

Feature ci-test-effectiveness; agreed specification
`docs/superpowers/specs/2026-11-08-ci-test-effectiveness-design.md`, SHA256
`77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a`.
Read AGENTS.md, README goal, session-bootstrap, CLAUDE.md, relevant canonical rules and
kickoff-s2.md. Native isolated execution is authorized by “го без аиф”. Controller records
fresh base and overlap before dispatch. No pending TAK runtime is assumed installed.

Exact writes:
- packages/core/synthesizer/run-rule-tests-firing.sh
- packages/core/synthesizer/run-rule-tests-firing.test.sh
- packages/core/hooks/pre-push.consumer-layout.test.ts — capability premise and relevant S5 controls only
- packages/getff/MANIFEST.sha256 — existing normal generator only
- docs/ci-test-effectiveness/batches/b5.json
- docs/ci-test-effectiveness/evidence/b5-*
- docs/ci-test-effectiveness/inventory-s2.jsonl — append changed/new bounded assessments

Inspect _sg_is_astgrep and the corresponding hasAstGrep guard. A successful help invocation
alone is insufficient: the real util-linux/newgrp command answers it with0 here. Establish
intended compatible tool identity through its supported interface (version/behavior), without
turning rule rejection into absence. Keep existing canonical-name behavior and diagnostic-based
rule verdicts. If faithful fixture changes are needed for a real added probe, explain them;
do not change expected semantic results to manufacture green. No universal binary-authenticity claim.

Use the actual shell runner and independently fixed impostor/legitimate-alias/absence inputs.
The impostor must reproduce help0 plus non-AST identity/incompatible scan, not ENOENT. Check
wrong-tool scan is not credited as firing or valid rejection. Preserve existing bad/good and
invalid-artifact distinctions. Existing S5 real-tool cases must use a truthful premise; absence
may retain the existing explicit skip policy, but hosted pin/protection must remain intact.

Keep new fault/driver work bounded and audit-only unless existing harness is the actual recurring
carrier. No new verifier hierarchy. Record source/tool identities, all commands/statuses/raw refs,
actual execution boundary, recurring probe/test overhead and uncertainty. Do not call this speedup.
B5 JSON binds D09, exact input/output/files, retained protection, cost and rollback; controller
supplies final commit. Preserve S1 and earlier raw evidence. All new mechanisms get seven criteria
and actual invocation. Generalization belongs with existing RC2/TAK/review integration later.

Write .superpowers/sdd/ci-test-effectiveness/task-6-report.md: status, commits, RED/GREEN,
weakening/restoration, tests, self-review and limits. Normal hooks only. No full hooks run yet:
glossary's separate unmatched-load budget issue remains open; do not alter it in this batch.

## Traps and destination verification

Rigor label (L0): `research-grade` with proportional probes. Apply ai-laziness-traps.md §2–§3:
**T3**, **T7**, **T10**, **T14**, **T15**, **T18**, **T19**, **T20**, **T22**. Challenge omitted
identity/status/capability states and which combined change could false-green; record bounds.
Change method after two unsuccessful attempts; five failed iterations trigger scoped BLOCKED.

Run on native Linux, retain output/status. Real ast-grep is currently absent locally; record
S5 skips truthfully, while controlled alias tests always exercise the actual runner.

```bash host-verify
bash -n packages/core/synthesizer/run-rule-tests-firing.sh packages/core/synthesizer/run-rule-tests-firing.test.sh
bash packages/core/synthesizer/run-rule-tests-firing.test.sh
npx --prefix packages/core vitest run --reporter=default packages/core/hooks/pre-push.consumer-layout.test.ts -t S5
bash scripts/build-getff-dist.sh --check
```
