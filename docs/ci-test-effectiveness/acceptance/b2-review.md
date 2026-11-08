# B2 independent spec and quality review

Reviewed range: `830732a7b8f50479dc69189b05456c94adb4919a..5e59ab7334839e040a6d6355716f8d39e0a7d958` (worker commits `7635fd1c`, `a9dad195`, coordinator closure `5e59ab73`).

SpecCompliance: **PASS**, within the B2 D05/RC7 scope and its stated host limits.

TaskQuality: **PASS**, with one nonblocking inventory note below. No Critical or Important findings. This verdict does not accept campaign E9, TAK delivery, D07 broad routing, or real non-Linux behavior.

## Authority and review method

Read the canonical `.claude/orchestrator-prompts/ci-test-effectiveness/kickoff-s2b.md` first, including its explicit controller ruling for the derived MANIFEST; used the agreed design, especially §§7–9, the S2 coordinator contract, accepted S1 record, repository goal/bootstrap and applicable review/trap rules. Specification bytes match the required SHA256 `77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a`.

Primary changed-file view was the complete 1,861-line review package (log, stat and diff with context), read in bounded sections, together with task-3-report.md. Reviewed source, commands and raw outcomes rather than accepting worker status or JSON shape. No Git commands, full-suite repeats, runtime probes, checkout/index/HEAD changes or subagents. The only write is this requested local report.

A focused unchanged-source carrier inspection addressed the named risk that the new regression might be discoverable only by its isolated command: `packages/core/package.json:58` supplies `test:hooks` as `vitest run hooks/`; `packages/core/vitest.config.ts:32` includes `hooks/**/*.test.ts`; `.github/workflows/audit-self.yml:562` executes that script and its existing required-result aggregation remains unchanged. This settles source delivery of the narrow recurring control without rerunning the large hook suite. Existing path handling was inspected for preservation; the patch changes no workflow, runner or selector.

A read-only digest check compared all three recorded output source hashes and all 17 raw-evidence hashes with actual files: zero mismatches. No duplicated changed-file content inspection was needed for that integrity check. The supplied Git log/diff establishes committed transport for the reviewed range; the distribution evidence additionally concerns an actual npm archive, not just a regenerated manifest.

Active traps: T3, T7, T10, T14, T15, T18, T19, T20, T22. Their concrete application is the enumerated controls, separate TCP/HTTP analysis, reached weakening/raw-error inspection, finite-boundary assessment and limits below.

## Strengths and spec trace

- **Unconditional lifecycle ownership.** `.agents/procedures/pipeline/helpers/autonomy-binding.test.mjs:122` tracks accepted sockets, removes closed sockets, and registers native `after` before listener startup. Lines 128–130 destroy outstanding sockets and await listener closure with error propagation. There is no success-manufacturing process exit. The final case no longer owns closure. A failed assertion unwinds into runner teardown; a filtered final case cannot omit the hook. Destruction and the close call execute without an intervening await, so the implementation introduces no event-loop opportunity to accept an untracked new socket between them. The native runtime and recorded controls support this assessment, not a universal assertion about every host.
- **Both effects oracles survive.** The final aftermath still contains the original strict zero-connections and zero-requests assertions, in their original order and at the end of the claimed run. The diff preserves outbound environment wiring and host gate/skip statements. Teardown does not reset the real counters. No product CLI, engine, record, authority, store, lock or schema change is present in the reviewed range.
- **Independent observation and fixed outcomes.** `packages/core/hooks/autonomy-binding-lifecycle.test.ts:37` rejects spawn/watchdog errors and signals before checking literal process status. No-case must terminate 0. Two different harmless named selections must terminate 0 and report one passing case. TCP traffic must terminate 1 with the literal TCP diagnostic and `ERR_ASSERTION`. The HTTP case sends a real request and resets only the disposable copy's TCP count, so the second assertion must independently produce its literal HTTP diagnostic. The accepted client sockets stay open during the failing aftermath, exercising the resource that listener-only cleanup misses. Import errors, unrelated failures and timeouts cannot satisfy these negative expectations.
- **Real module and bounded fault controls.** The regression executes the real Node module; injected variants copy real helper dependencies and add traffic before the existing assertion. The held conformance driver copies the delivered source and final regression into a disposable shadow, freezes the regression hash across both changes and restoration, and weakens actual listener closure and socket destruction separately. It is an audit-only driver, not a new permanent recursive checking system or TAK replacement.
- **Combined delivery closure.** The MANIFEST changes exactly the helper hash, the new regression entry, and the accepted B1 sweep hash. This is expressly authorized by the canonical controller ruling. `b2-dist-regeneration.txt` records existing normal generator output for 1,665 payload files; `b2-dist-check.txt` records independent source comparison of the actual 1,670-file npm archive and manifest parity. B1 source is not edited by B2. Coordinator kickoff/acceptance annotations in the full range record that scope and closure; they are distinguishable from the worker's exact implementation allowlist.

## Evidence assessment

| Obligation | Raw evidence and interpretation |
| --- | --- |
| Selection excludes final case | `b2-red.txt` shows no-match and both meaningful selections reach their intended paths but hang under the original cleanup; final `b2-green.txt` passes all five controls under the delivered assertions. |
| Reached assertion failures | `b2-open-socket-red.txt` shows both reached aftermath failures with open sockets remain hung before repair. The final test requires natural exit 1 and the separate intended diagnostics, so GREEN is not a timeout-based assertion claim. |
| Listener closure sensitivity | `b2-weakening.txt` includes both the actual TCP assertion and `B2 reached disabled cleanup`, followed by `ETIMEDOUT` rejected at the spawn-error assertion. Driver exit 1 is rejection of the lifecycle defect, not successful child termination. |
| Accepted-socket sensitivity | `b2-socket-weakening.txt` independently shows the same reached TCP failure/disabled-cleanup marker and watchdog rejection when destruction is removed but listener close remains. |
| Restoration | `b2-restoration.txt` passes the held TCP control; recorded source hash returns to `aa77c4d048d5d7738ffb1a1b1c9c892de3e99fe0e76037de96c083b925403d52`. Held test hash remains `f741bbc5a5273d63cfe678c0e28d16652e6cd6a52c99f6a3d370fd17304439ef` throughout. |
| Full native no-loss | `b2-native-suite.txt` reaches the last aftermath, reports 189 tests, 188 pass, one explicitly reasoned real-non-Linux skip and zero failures; `b2-native-host.json` records Node v24.19.0, Linux and exit 0. Host/source gates are unchanged in the diff; no claim is based solely on the no-loss JSON booleans. |
| Cost | The final narrow carrier reports 1.657 seconds test time / 1.98 seconds total. Earlier hangs are censored at eight seconds per child, not treated as measured successful baseline timings or a claimed speedup. Full native verification is separately about 61 seconds. |

The setup failures remain visible and are correctly excluded from defect-detection evidence: missing intent helper imports produced `ERR_MODULE_NOT_FOUND`; initial reporter assumptions failed against spec output; the initial held driver lacked the needed visible assertion diagnostic. The final regression explicitly pins TAP and retains the real imports. These records justify the corrections without pretending an unrelated error detected the intended fault.

## Findings

Critical: none.

Important: none.

Minor M1 — inaccurate delivery field for the audit-only driver — `docs/ci-test-effectiveness/inventory-s2.jsonl:6` (`B2-held-conformance`). `layer=implementation`; `whose=reviewer`.

The entry correctly declares `kind: one-shot-driver` and names `evidence/b2-conformance.py`, but copies the recurring `core test:hooks -> hooks/**/*.test.ts; audit-self.yml hook-tests -> ci-success` delivery text from the regression. That carrier executes the TypeScript regression; it does not execute the Python weakening/restoration driver. Give this row its actual one-shot command/evidence boundary, while retaining the recurring carrier on the regression row. The batch and report already describe the distinction correctly, so this is a nonblocking inventory correction, not a need for another test or review round. A consumer relying on the delivery field alone could otherwise infer automatic recurring weakening verification.

Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## Self-application, category challenge and Cannot Verify

All three new inventory entries explicitly address all seven criteria. The substantive protection is relevant to D05/RC7; natural status plus intended diagnostics avoid theatre; literal outcomes and real traffic avoid deriving expectations from the implementation; existing carrier reuse avoids a second runner; the measured small subprocess workload justifies repair overhead; and the independent held source faults/restoration bound sufficiency. The one-shot driver's own applicability is supported by its source, reached markers and fixed held hash, subject to M1's delivery correction. No driver-of-driver hierarchy is needed.

Category challenge: which selection, assertion path, supported environment or new mechanism is omitted, and which combined change can still false-green? The evidence enumerates no selection, two harmless selections, the full run, TCP failure, isolated HTTP failure, listener weakening and socket weakening. It does not separately enumerate every selection combination, arbitrary earlier failing cases or startup-listen errors. The native after hook structurally covers ordinary test assertion unwinding, but those additional runtime branches are not individually certified. Removing the regression together with cleanup, corrupting its fixed expected values, or adding an outbound seam outside the known recorder wiring can still evade this bounded evidence. The runtime/OS, actual runner delivery and independently reviewed expectations remain the finite trusted boundary.

Cannot Verify: real non-Linux execution; universal cross-host cleanup behavior; hosted-CI execution/timing or live branch-protection administration; all earlier-assertion/selection combinations; listener startup failure; campaign E9/TAK integration or D07 broad full-suite routing. The provided package also does not independently reproduce historical launch-time owner reconciliation or contain a full normal-hook commit transcript; those are coordinator/worker provenance assertions, not behavior certified here. No bypass or competing owner/product edit is visible in the reviewed diff. These limits do not contradict the bounded B2 Linux result and must travel with acceptance.

No concrete unanswered lifecycle doubt remained after the source/raw-evidence review, so repeating full suites or the recorded weakening runs would add cost without changing this verdict.
