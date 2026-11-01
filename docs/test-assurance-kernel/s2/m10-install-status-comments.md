# M10 / P50 — full-line comment decoys in `comparedAfter` (scoped report)

Scope: the minimal repair preparing the P50 `comparedAfter` predicate for full-line shell
comments, its four Root-frozen cases, and the exactly-one live-suite row it resolves. This is
preparation evidence for Root review — no framework source was applied outside the owned
preparation clone (parent `24671be0333…`).

## Defect (both directions, one predicate)

`comparedAfter` (`packages/core/principles/50-install-rc-asserted.ts`) scanned every line after
the capture, including full-line comments. A shell comment executes nothing, so:

- a comment mentioning the captured name with `=` (`# … this was rc=1 …`) matched the
  reassignment pattern and ended the scan early — a REAL later comparison went unseen
  (false positive);
- a comparison existing only inside a comment (`# [ "$rc" -eq 0 ] || exit 1`) matched the
  comparison pattern and credited the invocation (false negative, the status never asserted).

## Repair (one guard, minimal)

```ts
for (let k = from + 1; k < lines.length; k++) {
  if (/^\s*#/.test(lines[k])) continue;   // full-line comments neither compare nor reassign
  if (cmp.test(lines[k])) return true;
  if (reassign.test(lines[k])) return false;
}
```

Declared line-scanner limits otherwise unchanged: inline comments and quoted strings on
code-bearing lines are still scanned without shell parsing; heredoc bodies are not skipped
as invocations; `>=20`-char
`# install-rc:` escapes untouched, `case`/bracket comparisons, member captures and the
invocation grammar untouched. No quoted-string, heredoc, dataflow or control-flow parsing was
added.

## Frozen cases (RED on the old producer, GREEN on the repair)

`docs/test-assurance-kernel/s2/m10-comment-status-cases.json` — byte-exact copy of the
Root-frozen fixture (sha256 `0d116a13a666be52ef9a5ced381536c2cc5ac487e5a13a29473b0153c4e85c52`,
pinned again inside the test). Appended to `50-install-rc-asserted.test.ts` as a describe block
running each case through the actual `findUnasserted` and asserting exact hit lines:

| case                                   | expected hits | old producer | repaired |
| -------------------------------------- | ------------- | ------------ | -------- |
| real-compare-comment-assignment-decoy  | `[]`          | `[3]` FAIL   | `[]` PASS |
| comment-only-comparison                | `[3]`         | `[]` FAIL    | `[3]` PASS |
| real-status-reassigned-before-compare  | `[3]`         | `[3]` PASS   | `[3]` PASS |
| real-compare-no-decoy                  | `[]`          | `[]` PASS    | `[]` PASS |

RED run: `2 failed | 37 passed` — exactly the two wrong comment cases failed at the hit
assertions (logs-red-old-producer.log). Healthy run after the repair and baseline lowering:
`39 passed (39)` (logs-final-green-2.log).

## Live-suite delta (per-file, not scalar)

Measured with old (`git show HEAD:…`, sha `481bccb8…`) vs repaired detector over every
`tests/install-sh/*.test.sh` (logs-measure-old-new.json):

- totals: 326 → 325 unasserted invocations;
- resolved: exactly `react-spa-wiring.test.sh:26` — the independently witnessed false
  positive (`# … this is rc=1 …` on line 30 aborting the scan before the real `[ "$rc" -eq 0 ]`
  on line 31). Executable-contract evidence: capture `rc=$?` line 27, executable comparison
  lines 31–32, the only `rc=` between them sits inside a full-line comment;
- exposed: none — no suite file had its status comparison only inside a comment;
- files with count change: exactly one (`react-spa-wiring.test.sh` 1 → 0).

Baseline: the `react-spa-wiring.test.sh` entry (1) is deleted — the canonical lowering at 0
per the baseline's own `_comment`. No other baseline row touched; no floor raised.

## K3 / K4 (fresh processes, raw logs retained)

- K3 — old predicate restored (comment-skip guard removed, faulted sha `368def9a…`): the two
  decoy cases fail again at their hit assertions AND the live ratchet fails
  (`react-spa-wiring.test.sh: 1 > baseline 0`) — the regression is reachable through the real
  delivery channel, no synthetic failure (logs-k3-old-predicate.log).
- K4 — over-rejecting fault (`from + 2` scan start: a legitimate comparison on the line right
  after the capture is rejected; faulted sha `eba4d94d…`): the good control
  `real-compare-no-decoy` fails. The same scan-start fault also skips the real reassignment
  in the bad `real-status-reassigned-before-compare` case, whose fixed rejection catches
  that permissive effect. Three
  original `accepts:` arms fail (`-eq` next line, `=` next line, `case` next line), and the
  live ratchet fails across many files — paired good controls catch it (logs-k4-over-rejecting.log).
- Restoration: exact repaired bytes verified (sha `85bb7843…`) and final green 39/39
  (logs-final-green.log, logs-final-green-2.log).

## Pre-proposal checks

- `prettier --check`: all three principle files clean after one deterministic `--write` on the
  test file; the frozen JSON keeps its exact Root-frozen bytes (byte contract over formatting;
  the repo's canonical formatter gate `scripts/format-shipped.sh --check` is exit 0 and does
  not cover docs paths — verified against existing S1 docs).
- Targeted P50 suite: 39/39. Core `tsc --noEmit`: exit 0. P51
  `51-test-quality-corpus-conformance.test.ts`: 10/10.
- Stock runtime/dist freshness HELD after source change — nothing regenerated here.

## Declared limits / pending

- This repair covers full-line comment decoys in `comparedAfter` only. It is not a shell
  parser, makes no dataflow/control-flow claim, and does not blanket-resolve the historical
  candidate population.
- The remaining ~325 historical candidates (P50-CURRENT-CANDIDATE-MATERIAL.json, 73 rows /
  326 hits at its measurement head `360a39a9…`) stay queued for the full original M10
  disposition — every row still requires its own enclosing-contract inspection.
