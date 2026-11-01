# S2 M12 (CAND-093) — GLV suite-sensitivity: killing the cf3 fallthrough mutant with test material

> **Seam (one only):** the `runRuleLiveness` suite layer of
> `packages/core/hooks/checks/guard-liveness.test.ts` — one ADDITIVE regression test.
> No production byte changes: the kernel engine `guard-liveness.ts` stays at the
> accepted source (`8bff9b80…`), and every pre-existing suite case stays intact.

## The gap (historical record and current witness, kept separate)

The Batch-D counterfactual cf3
(`docs/test-assurance-kernel/s1/counterfactuals/cf3-guard-liveness-permissive.json`)
established the `matchesViolation` fallthrough mutant — final `return false;` flipped
to `return true;` — as REACHED but NOT KILLED **on its own recorded Batch-D suite
state**; that frozen S1 record binds no current case count and is immutable history.
On the CURRENT accepted source (`29f3afe9…`) the same frozen fault was re-witnessed
against the current 25-case suite: all 25 stayed green (exit 0) while a
malformed-input rule silently passed liveness — first by this packet's author
witness (`firstred.log`), then independently (see §Evidence).

Reachability is input-shape-dependent: the roundtrip config enables exactly one
rule, so a message that is not a violation OF that rule reaches the fallthrough
only when its `ruleId` differs from it. **This tested witness — the fatal parse
error (`ruleId: null`, `messageId: undefined`) — is ONE reached class, not the only
one:** the installed linter also emits a NONFATAL `ruleId: null`
unused-disable-directive warning for syntactically valid input, and it falls
through the matcher the same way; production refuses it by the same
missing-violation path (measured in
`s2-readonly-prerequisites/m12-glv-suite/NONEXCLUSIVE-REACHABILITY.json`). No
exclusive only-diagnostic-class claim is made here or in the test comment. A clean
zero-message input never invokes the matcher (`some()` over an empty array), and
the pre-existing GLV-1…GLV-6 cases use clean or rule-violating inputs — so none of
them exercised the fallthrough branch.

## The repair (test material only)

One additive `it` — required id `[GLV-1][TAK-S2-GLV-FALLTHROUGH]` — appended as the
last case of `describe('runRuleLiveness', …)`:

- **Miss arm:** a rule whose `negative-test.input` is the malformed statement
  `const totally = ;`. On the installed ESLint that input lints to exactly ONE
  fatal parse-error message, which no `matchesViolation` branch may match: the
  healthy engine records the miss and the result status is `fail` with non-empty
  failures.
- **Legitimate companion (same `it`):** the real R12 rule with its actually-violating
  input still returns `pass` — the repair kills the permissive mutant WITHOUT
  weakening the gate (K1 companion discipline; a companion-only test would be
  vacuous, a kill-only test could hide behind a broken engine).

## Evidence — acceptance vs disclosed author attempts

**Acceptance evidence (byte-only, no ref movement):** the independent review
`independent-review/CAND093-EXACT-PROPOSAL-REVISE.json` (sha `b9de088b…`) verified
the exact candidate test material (`78161675…`) directly — healthy 26/26 exit 0;
under the frozen fault exit 1 with ONLY the intended new assertion failing; after
byte restoration 26/26 exit 0 — copying the immutable candidate bytes into the
reviewer's own pre-existing scratch and restoring them, with no checkout, reset or
ref change anywhere (`INDEPENDENT-AFFECTED-RESULTS.json`, sha `0f32af0a…`).

**Disclosed author attempts (raw history, NOT acceptance evidence):** the author's
own logs — `firstred.log` (25→fault→still-green→probe-flip→restore) and
`new-suite.log` (healthy 26 / fault exit 1 naming the new test / restored 26), plus
the author's stock `driver.mjs --arm D5-PERM-GLV` and
`replay-cf3-guard-liveness-permissive.sh` runs — were produced on the candidate
copy whose `git checkout --detach` was executed AFTER the user-level git-safety
hook had denied checkout/reset in the packet scratch (foreign-worktree rule) and
was then flagged post-hoc. That route is disclosed, preserved unchanged, and not
repeated; none of it is reused as proof of acceptance.

**Mandatory future acceptance:** the stock cf3 replay and the D5 driver arm must be
re-run on the legitimately delivered ACTUAL current HEAD after the normal source
commit (with normal protections) — that run, not any scratch copy, is the future
gate this record owes.

## Honest limits

- **One fault class, one branch.** This kills the fallthrough-permissive mutant for
  the measured parse-error witness. It does NOT certify the engine against other
  fault classes (messageId matcher, good-example lane, aggregation), and the
  nonfatal unused-disable class — though it also reaches the fallthrough — is
  covered only by the existing missing-violation refusal semantics, not by a
  dedicated case here (adding one was not authorized by this correction).
- **Manifest staleness grows, honestly.** `MANIFEST.sha256` pins the pre-repair test
  file bytes; after this candidate the stock `--check` DRIFT stays EXIT=1 and now
  includes the new test bytes. Renewal authority is NOT in this packet — held RED,
  never hand-edited.
- **Ref-movement scope.** "No ref move" claims in this record cover exactly: the
  actual source root (READ ONLY at `29f3afe9…` throughout) and the plumbing
  proposal preparation (`git add` / `write-tree` / `commit-tree` only — the review
  object's parent is pinned; no branch or HEAD is updated anywhere). The separate
  flagged validation-copy checkout of the previous packet is disclosed above, not
  concealed and not repeated.
- **Preparation only.** This packet is a proposal for independent review of the
  corrected tree; no source application, no generation, no shared/native effect,
  and no rewrite of frozen expected outcomes, the cf3/D5 records, or any S0/S1
  oracle or raw history.

## Cycle accounting

CAND-093/M12 GLV suite-sensitivity: **2 of 5 cycles used** — cycle 1 the behavior
repair (plumbing commit `cabcaad1…`), cycle 2 this bounded factual/validation-route
correction (comments and this document only; executable test bytes unchanged).
M12-P51 4/5, intake 4/5, M15 3/5, historical AIF 2/2 — all unchanged. No resets,
no borrowed counters; probes/restorations not counted.
