# Deterministic core — continuation checkpoint

Date: 2026-10-15

Authoritative for: new discussion decisions recorded after the prior handoff.
Not authoritative for: reconstruction of the missing PRD/spec artifacts, implementation approval, or verified platform support.

## Operator instruction

The operator delegates technical sequencing to Codex. Prioritize useful, easy-to-implement mechanical operations whose results can immediately help subsequent work. Seek portability across environments. Continue design discussion; implementation remains future work.

## Author decision under delegated sequencing authority

Keep the whole-core scope from the prior design. Begin with a bounded living-docs-auditor execution/result slice, reusing existing checks and the Test Assurance Kernel for its selected obligations. Then convert rule-tests verification as a different real caller. Extract common code only where actual compatible repetition appears. Continue with formal inventories/report/evidence preparation, cross-family delivery/context gaps, remaining checks/templates and research bookkeeping, then separately scoped operator workflow mechanics. Delivery, compact invocation and assurance belong in each increment; this is not a global waterfall prerequisite chain.

The first slice does not automate semantic documentation assessment or build a universal runner. No standalone FSM engine is needed for straightforward branches. Unknown inputs and unsupported results remain explicit incomplete outcomes; new heuristics are not automatically added to hide them.

## Proposed implementation platform

Prefer the existing Node.js ecosystem for new core mechanisms: TypeScript for substantive typed modules, delivered JavaScript for execution, and small native JavaScript helpers where a build adds no value. Reuse the existing build/distribution owners. Do not require TypeScript tooling in consumer projects merely to execute a delivered helper.

Use ordinary command-line entrypoints, explicit target arguments, structured results and diagnostic output, callable independently of the model/harness/project language. Prefer standard library facilities and direct subprocess arguments over new shell recipes. Preserve existing domain tools and runners; do not rewrite them only to homogenize language.

Evidence in available checkout 6612: packages/core/package.json declares Node >=22, TypeScript, existing tests and tsx; workspace package.json already has esbuild build scripts. README.md:155 describes bash/git/python3/curl preflight; install.sh:100,802 describe node-free paths. Thus Node is already a core runtime but is NOT established as universal across all consumer profiles. Any newly Node-dependent delivered profile must explicitly detect/report the requirement. Native Windows, macOS and Linux acceptance requires actual installed-command tests, including subprocess/path behavior and absent dependencies. Existing Bash backends retain their prerequisites until separately addressed.

Reconsider this runtime decision if selected mandatory consumer profiles cannot accept Node and a smaller existing-runtime implementation meets the same contract. Do not introduce dual implementations or packaged executables preemptively.

## Continuity limitation (resolved later on this date)

Update: all 28 original files were subsequently recovered from Git snapshot `cd9c57bbb0a2a0523a71d3fc86704f5381b8c228`. See `recovery-receipt.json` and the current `HANDOFF.md`. The following paragraph records the earlier search state.

The prior e220 checkout is absent on this turn; its parent directory is empty and it is absent from git worktree list. No attached archived worktree was returned by list_artifacts. The prior approved PRD, design, coverage map and scoped HANDOFF were read earlier in the conversation but were not found at their original location or in the current checkout/main docs paths checked. This checkpoint preserves new decisions only. Do not claim to have updated those missing artifacts, recreate approval bytes from memory, or advance currentSpec. Reconcile/recover the original artifacts before formal specification publication.

No implementation, installation, integration, runtime test campaign, commit or push was performed.
