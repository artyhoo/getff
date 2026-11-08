# S2 B6 — retain real counter coverage under the existing shell budget

> **Authoritative for:** D10 scoped deadline alignment and actual-carrier acceptance.
> **Not authoritative for:** performance SLOs, global timeout policy or campaign acceptance.

<task>
Apply the existing per-case SLOW_SHELL_MS budget to the three concurrent-sessions tests.
</task>
<context>
D10 records full parallel timeout5027ms and focused baseline3503ms. This is not a proven
B3 regression. Existing file already uses30000ms for other real shell controls. B5 has fixed
wrong sg identity; the environment now has actual rsync for unchanged hydration controls.
</context>
<constraints>
Exactly preserve N=10, actual hook processes, counter/lock assertions, availability and
production sources. No mock, quarantine, global timeout, new mirrored test or repeated full
suite solely for confidence. Use normal hooks, no nested agents or push.
</constraints>
<tools>
Existing SLOW_SHELL_MS, actual Vitest carriers, normal build-getff-dist generator.
</tools>
<output>
Minimal source change plus B6 evidence, batch and current seven-criterion inventory entry.
</output>
<verify>
Run focused family then one complete actual hooks suite. Capture all output/status/skips.
Any new failure must be reported with evidence, not hidden or repaired outside this scope.
</verify>

## Authority and exact writes

Feature ci-test-effectiveness; agreed design
`docs/superpowers/specs/2026-11-08-ci-test-effectiveness-design.md`, SHA256
`77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a`.
Read AGENTS.md, session-bootstrap, README goal, CLAUDE.md and relevant rules. Native route
is authorized by “го без аиф”; no AIF runtime required. Consume decisions-s2.jsonl D10.

Exact writes:
- packages/core/hooks/glossary-counters.test.ts — only3 test argument additions and concise comment
- packages/getff/MANIFEST.sha256 — normal generator only
- docs/ci-test-effectiveness/batches/b6.json
- docs/ci-test-effectiveness/evidence/b6-*
- docs/ci-test-effectiveness/inventory-s2.jsonl — append only affected assessment

Complete implementation: in describe('concurrent sessions — ...'), each of the3 existing
it.skipIf(!JQ)(title, callback, ...) calls gains SLOW_SHELL_MS as its third argument. Add one
short comment explaining real subprocesses share the file's slow-shell correctness budget.
Do not change the callback bodies or const value. Do not introduce a test for this syntax.

Existing semantic RED is the reached timeout; do not force load to recreate timing luck.
Run same real-process/counter assertions with the existing budget. This ceiling does not
promise faster execution and can extend failure latency to30s for each of3 cases. Record
this tradeoff. The prior full suite RED and final actual full-suite status both remain visible.

Use PATH=/workspace/getff-tools/bin:/workspace/getff-tools/venv/bin:$PATH for verification;
this supplies real private rsync3.5.0, no shim of checker behavior. Actual ast-grep is absent,
so retain and accurately report existing explicit tool skips. No package install or global
configuration change. If normal source manifest needs regeneration, use existing script;
check exact changed hash only. No broad repeated tests after passing this contract.

B6 JSON binds D10, inputcommit, output source hash, commands/statuses/raw refs, retained
source/assertion comparison, measured durations and explicit limits. Append meaningful
seven-criterion assessment to existing inventory, not a new permanent validator. No new
principle number or duplicated timeout policy. Broader prevention/TAK remains campaign work.

Report `.superpowers/sdd/ci-test-effectiveness/task-7-report.md`: status, commits, exact source
scope, focused/full results, skips/failures, manifest and self-review. Normal hooks only.

## Traps and destination verification

L0 proportional evidence. Apply ai-laziness-traps.md §2–§3 **T3**, **T7**, **T10**, **T14**,
**T15**, **T18**, **T19**, **T20**, **T22**; challenge protection loss via changedN/assertions,
false tool coverage and timeout-vs-performance claims. Two failed approaches change method;
five failures BLOCKED. No unrelated fix within this batch.

```bash host-verify
npx --prefix packages/core vitest run --reporter=default packages/core/hooks/glossary-counters.test.ts -t 'concurrent sessions'
npm --prefix packages/core run test:hooks
bash scripts/build-getff-dist.sh --check
```
