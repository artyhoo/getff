# B3 fix round 1 scoped re-review

Reviewed `6e429b0966837541693eb743e54a3402d8695d8c..dff12e2fe602563266de8dbc2b422ccdd6a98d42` using the supplied full-context fix package as the changed-file source, original task-4-review findings, appended implementer report and kickoff-s2c. This is a re-review of I1/M1 and new fix-diff breakage, not a repeat whole-task or campaign acceptance review.

**I1: ADDRESSED. M1: ADDRESSED. Overall: scoped fix accepted with one nonblocking Minor metadata correction below.** No new Critical or Important findings.

## I1 — ADDRESSED

`tests/hooks/test-enforce-husky-presence.sh:21` declares `local fixture_hook`, and lines 23–25 consistently use that independent variable. `valid()` therefore no longer overwrites the outer `hook` selecting the adverse subject. The existing outer loop still constructs missing, non-executable and stub cases for each hook. The only other fixture behavior change is printing the already-checked captured checker output at line 18.

`packages/core/hooks/ci-checker-oracles.test.ts:79` independently requires exactly six error lines, in order, with literal shape/hook path suffixes. This guards the fixture identities independently of its subject loop. It adds no subprocesses or job. The manual receipt `docs/ci-test-effectiveness/evidence/b3-fix-1-manual.txt:1` shows all six distinct adverse diagnostics, followed by all three valid companions and final success. In particular nonexec/stub pre-commit now occur, resolving the specific omitted branches rather than merely relabeling old pre-push cases.

The causal and held evidence is sufficient:

- `b3-fix-1-red.json:2` and `b3-fix-1-red.txt:1` record the narrowed first-hook shape bypass reaching its trace while the reviewed manual and unchanged core hash `94c6721e…` falsely pass 17/17; the independent collector rejects that false green.
- `b3-fix-1-intermediate-held.json:61` records the same bounded weakening failing after the manual repair while core hash `94c6721e…` remains fixed. Thus detection did not depend on changing the original core expectation.
- The added fault in `b3-conformance.py:47` inserts `continue` before the executable check for pre-commit only, retaining the preceding existence check. Its absolute disposable trace path explains differing fault hashes across runs; the bypass construction remains the same. It does not mutate the checkout checker.
- `b3-held-husky-first-hook-shape.txt:32` shows the intended failure: missing pre-commit still passes its adverse control, then non-executable pre-commit unexpectedly returns 0. The collector explicitly requires that failure text, reached trace, AssertionError and absence of ENOENT.
- `b3-fix-1-held-run.txt:1`/`b3-held.json:1` record six reached fault exits 1 and restoration exit 0 under fixed final core hash `9ca34d4b…`. Manual hash `3b9ee1fa…` is stable except during the intentional manual-carrier fault, then restored. The collector restores original bytes before each phase and checks exact final equality.
- `b3-fix-1-core.txt:4` records final 17/17 GREEN. The separate path-control RED fails specifically on the absent six diagnostic lines against the reviewed manual.

Commands and output receipts are present for manual/core verification, narrowed RED, held faults/restoration, shell syntax, normal distribution regeneration and archive/source parity check. No unanswered runtime doubt warranted repeating those probes. The one manifest replacement at `packages/getff/MANIFEST.sha256:904` matches the final core test hash; no other payload/generator change appears in the fix. The package contains no production workflow/checker or real `.husky` edits. Refreshed manual evidence records the same four checkout hook hashes/modes; historical duplicate-prepush coverage is explicitly superseded rather than rewritten. Other inventory records and frozen source hashes remain unchanged in the diff.

## M1 — ADDRESSED

`docs/ci-test-effectiveness/inventory-s2.jsonl:9` now identifies the current B3-ci-oracles delivery as 17 cases, agreeing with its members and final receipt. Historical 16-case timings/verification receipts are retained and identified as historical; the fix does not invent a measured hosted saving.

## New Minor M2 — stale held-driver delivery count

Location: `docs/ci-test-effectiveness/inventory-s2.jsonl:12`, `B3-held-conformance.delivery`.

The newly expanded held collector validates six fault exits plus restoration, and this row's refreshed effectiveness/cost fields correctly say six/seven subprocesses. Its delivery string still says `exit0 validates five fault exit1s + restoration0`. Change that current delivery description from five to six. This is a nonblocking descriptive inconsistency: actual source and receipts substantiate six faults, so it does not reopen I1 or M1.

## Retained limits and review method

The original full hook-suite RED, unresolved broader failures, pending hosted/net-cost and other-host evidence, campaign E9 and generalized TAK acceptance remain open and unwaived. The attributed later hydration/environment observation is not treated as fix validation. Structural hook marker checks still do not certify hook execution, and joint subject/oracle edits remain a finite independent-review boundary.

No Git commands, suites, mutation probes, timing or baseline replay were rerun. Checkout/index/HEAD were not changed. Only this review artifact was written. No additional out-of-scope blocker was introduced.
