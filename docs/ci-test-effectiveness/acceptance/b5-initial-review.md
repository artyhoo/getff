# Task 6 independent review — B5 / D09

Reviewed input `960e980e9a60cc5196976339eb1d3754184c8b7b` to output `99faad8d31a51ee1ddc0e62c7eb602374ce6054a`. Authority: kickoff-s2e.md, D09, design §§7–9. Primary evidence: complete 2,143-line task-6-review-package.txt and task-6-report.md. Repository reviewer-discipline §6.1 rubric applied.

SpecCompliance: CHANGES REQUESTED — one canonical availability-premise change widens S5 skipping beyond D09's ambiguous-alias repair. The production alias repair and remaining scoped deliverables comply.

TaskQuality: CHANGES REQUESTED — minimal production repair, strong actual-entrypoint controls and useful fixed-corpus sensitivity evidence; correct the guard mismatch below before local acceptance. No campaign, hosted or TAK acceptance implied.

Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## Findings

Critical: none.

Important — preserve the canonical-name availability premise at `packages/core/hooks/pre-push.consumer-layout.test.ts:1562` (layer=implementation; whose=reviewer).

Failure-scenario: canonical `ast-grep` resolves and can be spawned, but its `--version` exits nonzero, with no usable sg alias. Before this patch S5 ran its paired real-tool controls because spawn succeeded; now `hasAstGrep` is false and both controls skip. The actual production runner still selects that canonical executable solely by `command -v` (`packages/core/synthesizer/run-rule-tests-firing.sh:215`), so actual scan results/errors remain reachable in ordinary work while the S5 witness is suppressed. This can conceal a canonical installation or scan failure and changes an unaffected branch of the availability contract. D09/kickoff require canonical-name behavior and real diagnostic protection preserved; design §§7–8 prohibit widened skips and known protection loss. Restore the preimage canonical spawn/existence premise while retaining status+identity+help checks for ambiguous sg, or establish an explicitly authorized, independently tested canonical policy change. The current canonical-success shell companion does not cover this failure state. This finding follows directly from the changed expression and unchanged runner selection; no broad test rerun is necessary to establish it.

Minor: none.

## Strengths and evidence assessment

- Production changes are confined to `_sg_is_astgrep`: successful identifying version output followed by the existing successful help probe. Canonical precedence and all downstream diagnostic interpretation are unchanged in the supplied diff. No dependency, framework, global setting, new CLI or scan-error-to-absence fallback was added.
- Controlled tests invoke the actual Bash runner with an isolated PATH. The impostor has help0, a fixed non-AST version and scan8, and assertions independently forbid rule rejection, firing and sample scanning. Its absence companion is a separate no-executable state. Legitimate alias cases retain warning-at0 firing, clean-good, blind-bad, overfire and invalid-artifact outcomes. Probe failures test status independently from identity stdout.
- The shim adjustment answers version/help outside the two diagnostic shots; it is a faithful transport change for the new probe. All 42 original assertion statements and their expected outcomes remain in the diff; the original receipt reports 42/0 and the final receipt 75/0.
- Raw RED shows five intended wrong-tool classification failures. Final fixed corpus on the preimage shows eight failures, adding version-status cases. Each of three held subject-only faults reaches seven alias probes; raw receipts show intended 5/3/3 assertion failures, not setup or import failures. Restoration reports 75/0. The audit driver preserves tracked runner/corpus bytes and uses the existing runner-path seam; it is explicitly nonrecurring.
- Host receipt shows all four required checks passed, including focused S5 11 passed / 51 skipped (49 filtered plus two real-ast-grep cases), and archive/manifest parity. The ordinary derived-manifest diff changes exactly the three source hashes and no entry names. No workflow edit appears in the complete change package; recorded exact CI pin is 0.44.1 before test:hooks.
- Three appended inventory items substantively address all seven criteria, actual carriers/invocation, bounded faults, trusted expectations and cost. Added nine actual-runner invocations/33 assertions and single native timing observations are disclosed as repair overhead, without speedup claims. RC2/general TAK work and hosted acceptance remain explicit dependencies.
- Native tool evidence records real /usr/bin/sg → newgrp util-linux2.41.5, version0/help0, canonical ast-grep absent, and the actual current firing entrypoint returning explicit unverified DEGRADED0. That supports the exact incident classification without pretending a real parser was exercised.

## Scope and CannotVerify

No Git commands, full hooks, installers, test reruns or source edits were performed. The review writes only this local review. Bounded reads beyond changed hunks inspected the actual runner's canonical selection and the two S5 consumers to resolve the concrete guard mismatch; governing repository/task documents were read for authority. Historical B3 source traces were not replayed because D09 and the supplied actual-tool receipts already identify the scoped incident.

Actual ast-grep parser behavior and hosted Node22 after-run are not verified locally: ast-grep is recorded absent and the two skips are explicit. Historical command timing, tool hashes, commit-hook execution and provisioning facts are receipts rather than independently repeated observations. The complete package supports the exact changed-file/manifest scope; this review did not rerun Git object/hash comparisons. Darwin, other tool versions, malicious spoofed version/help, coordinated changes to subject plus expected outcomes, general RC2/TAK integration, glossary load disposition and campaign E9 remain outside this acceptance claim.
