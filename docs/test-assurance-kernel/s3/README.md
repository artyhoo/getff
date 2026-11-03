# S3 acceptance layer — scope extension, policy units, native companion, final acceptance

Private stage-S3 package of the test-assurance kernel (spec §8–§10, kickoff-s3/s4). This
directory is **evidence, not self-certification**: every file here is sha-pinned in
`scope-extension.json`, and the checks that consume them live in code
(`scripts/test-assurance/s3.mjs` + `scripts/test-assurance/verify.mjs`), not in prose.

## Files

| File | Role |
|---|---|
| `scope-extension.json` | The additive post-S2 inventory ledger. Anchored to the accepted predecessor `932ef452`/tree `4ca080ad`; every landed path is classified (`s3-source` = exactly `scripts/test-assurance/s3.mjs` + `s3.test.mjs`, `s3-evidence` = this directory, json/md/log only) and sha-pinned. `declaredPendingEvidence` names bounded future evidence (performance record, raw index, the 24 per-cell raw logs) — never executable source. |
| `frozen-policy.json` | Byte copy of the owner's frozen metric policy (sha256 `ac0889cd…`, verified by the `s3-policy-units` step on every run — expected verdicts cannot be edited to satisfy the check). |
| `metric-policy.json` | Consumer-facing summary of the frozen policy + the test-only nature of the pure cases. |
| `coverage.json` | Honest open-items registry consumed by `s3-final-acceptance` (historical raws NOT_RETRIEVED, cf37 observed-RED, rule 538→430.4 open, CI NOT_STARTED). |
| `performance.json` *(pending)* | Final 24-cell paired matrix record — lands only when the matrix is actually measured. |
| `raw-index.json` *(pending)* | Index of raw per-cell logs. |
| `logs/*.log` *(pending)* | One raw log per cell (4 workloads × 2 roles × 3 trials). |

## Self-cycle honesty

The ledger pins the sha256 of every registered file **except itself**: a file cannot contain
its own hash. This single documented cycle (`selfIndexed: true` on exactly
`docs/test-assurance-kernel/s3/scope-extension.json`) is covered outside the file — by the
Root/owner review of the committing change and by the git commit that carries it — never by
self-certification. Any other path claiming `selfIndexed`, and any landed path without a
matching HEX64 pin, is refused.

## Checks (verify.mjs `--stage S3`)

- `s3-scope-extension` — anchored-base + live-tree reconciliation: live scope = historical
  committed scope + exactly the ledger-declared paths; symlink-parent escape, alias
  duplicates, hygiene faults, unregistered live paths all refuse.
- `s3-policy-units` — byte-pinned owner oracle replayed through the ACTUAL consumer on all
  boundary cases (test-only liveness; never performance evidence).
- `s3-native-companion` — `node --test --test-reporter=tap scripts/test-assurance/s3.test.mjs`
  parsed as real TAP (counts + normal exit); marker-only or truncated output never greens.
- `s3-final-acceptance` — computed from genuine records: structural 24-cell validation with
  raw-log sha verification, NATIVE tool identity (node = the validator's own `process.version`,
  vitest = the installed version), the RETAINED collector-journal binding (24 cells, argv
  literals, 3 clean reversed fixture blocks, no early stop), the ORIGINAL four-fixture campaign
  contract (a dated/partial fixture set is a qualified comparison and stays nonPASS), exact
  Git-object bindings for BOTH role graphs (commit exists, tree matches `rev-parse`, live
  ancestry) and policy evaluation on the recorded numbers; obligation-specific semantic
  closure for the open-items registry (a SHA proves bytes, never discharge), and the live
  s4/CI declaration. A genuine complete evidence set has a reachable accept path; today's
  honest state is RED with named open items.

`--stage S4` registers `s4-fail-closed-gate`: before any receipt is considered, the ORDERED
ACCEPTED S2 then S3 predecessor chain must be pinned in the ledger (`predecessors`) with real
Git ancestry — the delivered S3 is RED, so S4 certificates stay nonPASS. All six proof kinds
must carry full schemas — independent fresh identities (reviewer ≠ author + session proof),
`codeSHA` bound to the computed live source signature, `headSHA` a Git-40 commit id with
evidence-only scope equivalence to live HEAD (64-hex sha256 forms refused), and each kind's
real artifact anchor: reviews through the NATIVE `getff.root.affected-review/v1` schema with
`reviewedPatchSha256` recomputed as sha256(diff anchoredBase..head) by the validator itself;
ci-record bound to a retained `gh.check-runs/v1` capture (every check-run id in the captured
population for the SAME head, which must be a real ancestor commit of HEAD); install-record
binding the ACTUAL target installation OUTSIDE this repository (installed bytes on disk,
installer argv, native terminal record) in addition to the source manifest row. Missing
evidence never implies PASS; the gate fabricates nothing.
