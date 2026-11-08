# Phase-two verification of actual private-fixture repairs

Reviewer: native_b9_semantics. This is a narrow static verification against original findings C1-TQ-01, C0-TQ-01 and C2-TQ-01 under their fixed synthetic contracts. Original reports and unresolved dispositions are preserved. Both each original-head-to-fixed-head repair diff and base-to-fixed-head full diff were inspected. Fix-diff SHA256 values match actual-fixes.json. No fixture test, host workflow or fixed-head acceptance CLI was executed by this reviewer.

## Per-finding result

### C1-TQ-01: VERIFIED (static fixture repair)

- Base: `f053bc8db6c4ec640d9f01bef3997c04adc91cf4`
- Original head: `788a5d512b543ad561998a6ec2ad6c6c3f31eda3`
- Final head: `f82d2209b1b8344908102403610bd20233349b3d`
- Exact scope: `.github/workflows/checks.yml`
- Original report: `phase1/c1-review.md`; original ID retained.
- Repair evidence: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/consumed/c1-actual-fix.diff`, SHA256 `7131acf61333d031d69befa0f5bd4cb660030b72a78b3041555a1ab55373e02b`.
- Final full diff: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/consumed/c1-fixed-full.diff`, SHA256 `d55f1d47e9dba2a6f3db23c72a91357011aed535bda6e34a4e6d162b88088fed`.

The duplicate package-script invocation is removed. The retained release-index job still runs the original Node test once, and site-metadata still runs its renderer. Only a descriptive step name remains in the final full diff. The actual invocation multiset loses exactly the redundant package-script call and no other command. This resolves the zero-marginal recurring cost while retaining the supplied same-boundary schema protection.

### C0-TQ-01: VERIFIED (static fixture repair)

- Base: `189acb04ed37c339a4e2970a8bf033fd69b65f5a`
- Original head: `e3a397d668a2df8f8385d21bf0cc940ea31b46ed`
- Final head: `ebab6d29765a7ed564f29461366f6a327dc00401`
- Exact scope: `.github/workflows/checks.yml`
- Original report: `phase1/c0-review.md`; original ID retained.
- Repair evidence: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/consumed/c0-actual-fix.diff`, SHA256 `b854fc989f198557fc81cad08db11650d3a62a1aed97272d132f157debf1ef84`.
- Final full diff: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/consumed/c0-fixed-full.diff`, SHA256 `81866562f72bf73b81533cb17a1f66e4b8b047b6f42110b7386c9855a4f822fb`.

The duplicate root-auditor invocation in self-install is removed. The root-audit job still runs the auditor once and the installed-consumer violation probe remains. Only a descriptive probe step name remains in the final full diff. The invocation multiset loses exactly one redundant root-auditor call. The separate root and installed-subject witnesses are preserved under the supplied contract.

### C2-TQ-01: VERIFIED (static fixture repair)

- Base: `c09dbae702a5f653f2839511aa7a40c199060d4c`
- Original head: `24b59f7599d2ab7f291de08320449fdd8ed641af`
- Final head: `7dcfd7a204312282b9c9a1adb3652dffeb73c3e4`
- Exact scope: `.github/workflows/checks.yml`
- Original report: `phase1/c2-review.md`; original ID retained.
- Repair evidence: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/consumed/c2-actual-fix.diff`, SHA256 `bedf562e4bcf14301bc037a1f3789eda06f7ff4cfc59f0161dd005fabccc1093`.
- Final full diff: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/consumed/c2-fixed-full.diff`, SHA256 `df1691b6da176d8d594ba3cffead7ca1183f75fe3552ba2042b69f3884f3401d`.

The full seven-command multiset is unchanged by the repair: three base commands and each of suite-1 through suite-4 exactly once. suite-1 moves to A; suite-2 and suite-3 move to C; suite-4 remains in B. No job, runner, event, prerequisite, failure suppression or required command is removed or added by this repair. Under the fixed isolation/equivalence/capacity facts, it implements the original recommended redistribution. run17 projects A/B/C=3000/4500/4500 seconds, and run18 projects 3080/4560/4600 seconds. These are static arithmetic forecasts, not measured-after results; quality and before-merge delivery remain unchanged on the stipulated premises.

## Acceptance and limits

No material repair remains unresolved within these supplied source/schedule contracts. This provides fresh static verification of real repair diffs for the controller's fixed-disposition decision at the listed final heads. It is not a fabricated runtime result and does not relabel the unchanged original heads fixed.

`consumed/original-results.json` records actualExit=1 for the three original unresolved-finding heads; the controller supplied those receipts and this reviewer did not rerun them. Fixed-head CLI consumption remains pending controller execution after this report. The controller must bind its updated record to each exact new head and original finding/report plus repair evidence. Real host delivery, measured post-rebalance wall time, hidden expectation comparison, and actual project/owner acceptance are outside this verification.
