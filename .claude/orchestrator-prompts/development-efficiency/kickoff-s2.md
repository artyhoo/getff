# Development efficiency S2 — trustworthy execution boundaries

> **Type:** execution-build. **Rigor label (L0):** `build-and-verify`.
> **Stage:** S2. **Branch:** `codex/development-efficiency-s2`. **Base:** `staging`.
> **Status:** Prepared; no launch. Read the umbrella `kickoff.md` §§0–6 first.

## 1. Binding scope and entry

Implement design §7, with the umbrella's control floor, owner/authority and evidence rules.
This stage covers the affected runner, fixture/check and host-launch families; it does
not reopen historical business tasks or make a new launcher/supervisor platform.
It is independently deliverable: S1 is priority, not a code prerequisite for these repairs.

Before edits, the existing owner binds each applicable family in its existing task plan:
actual source/installed target and callers; scenario; permitted/generated paths; real
entry commands and test registration; destination/owner; replaced wrapper/control;
rollback and required authorizations. A partial family result is not all of S2 completed.
Factory code and host-local launcher changes need their respective capable owners.

Repository seams to inspect: `tests/install-sh/snapshot.sh`, its fixture constructors,
`scripts/run-install-sh-suite.sh`, `tests/install-sh/meta-all-wired.test.sh`, affected
hook fixtures and their aggregate registrations, plus integrated helper call sites.
These exist; they are not an asserted complete installed-owner census.
For local identity/launch controls, use design I1 §§4/13/15 and the retained owner
artifacts to locate the actual launcher/run record before naming writable paths.
Unavailable host evidence parks that family with its current owner; do not invent a repo file.

## 2. Changes

1. Add validated cell selection to the existing snapshot runner's per-cell functions.
   No selector keeps the full existing population. Explicit empty/unknown selectors
   fail; a selected cell runs exactly once. Resolve paths from the declared root and
   importing definitions must not trigger global loops. Retire source-text extraction
   and full-script embedding only in the migrated wrappers. No fingerprint schema change.
2. Preserve real installer exit/semantic outcome separately from tree equality. Remove
   false success in the affected path; overall success requires every required outcome.
   Retain diagnostics and distinguish capture from compare inputs and output ownership.
3. Bind explicit scenario values in existing fixture constructors for `AIF_CTX_WINDOW`,
   `RUNTIME_BRIDGE_MODE`, `CLAUDE_CODE_ENTRYPOINT` and other demonstrated control inputs.
   Preserve intentional OS inputs. Pin provisioning/lockfiles and fail before expensive
   work when prerequisites are missing; do not weaken the tested scenario to get green.
4. Repair affected tests at the promised real boundary. Stub routing tests retain their
   narrow purpose but cannot stand in for Yarn/Astro behavior, consumer preservation or
   Windows acceptance. Every required suite participates in the actual aggregate result.
5. Enumerate migrated helper/API callers in the integrated candidate, adapt all affected
   signatures and run type/contract checks. Separate green branches do not prove integration.
6. Separate stable session/mode identity from mutable cwd and repeated initialization.
   Valid postcompaction init continues; true foreign identity/mode fails. Enforce
   preparation-only effects at an existing capable admission/runner boundary across
   available mutation/execution channels, not by observing one successful Write call.
7. Before child creation, persist admitted launch intent and attempt identity in the
   existing run/task record. Bind actual child/session identity when available, retain
   early stderr and semantic terminal outcomes. Exit zero with a semantic error fails.
   Spawn-without-receipt remains unknown, preserves counters and does not authorize retry.
   Reconcile known child/results before continuation; unresolved ambiguity stays owned.

Known generated outputs and specified review repairs stay with the admitted executor.
Unknown outputs, a changed goal or a real live authority restriction use the existing route.
No paid/live launch is needed for deterministic crash/identity/error controls. A real
workflow acceptance uses only the next already-authorized run under current caps/policy.

## 3. Acceptance and host checks

The bounded plan supplies exact changed-family test commands before implementation.
Exercise and restore: selected scope/count and invalid selector; import without dispatch;
dirty/clean parent agreement; missing prerequisite; real defect and omitted-suite failure
through the aggregate; merged signature mismatch; repeated init and invalid identity;
forbidden next-stage effects through other channels; exit-zero semantic failure; crash
after child creation before receipt. In that crash, retained intent/counters/uncertainty
prevent duplicate work and an available known child/result can be reconciled.
Apply these cases to the changed families, not every task in the repository.

After targeted RED/GREEN controls and final integrated edits, the repository floor is:

```bash host-verify
bash scripts/run-install-sh-suite.test.sh
bash tests/install-sh/meta-all-wired.test.sh
bash scripts/run-install-sh-suite.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
npm run typecheck
```

The full suite may include quarantined source-mutating tests: respect its existing
isolation/quarantine and do not overlap other owners' work in that checkout.
These commands do not validate an absent host launcher. Its bound control command,
real result consumer and next-authorized-workflow receipt are additional obligations.
Missing actual Windows/toolchain evidence remains unverified; no stub can certify it.
Do not report S2 GO while an admitted required family is merely documented or pending.

## §4c Park-don't-guess

On a genuine unresolved architecture, scope or authority fork, do not guess. Park it as
a question through the existing runtime task's supported park/answer path, name the
existing accountable recipient, and state both options with their consequences and the
missing decision/evidence. Stop dependent effects until a valid answer returns through
that route; continue independent already-admitted work when possible. A clear ordinary
in-scope correction is not a new operator vote. Preserve task identity, current authority,
review/launch caps and any owned pending result. This contract grants no launch itself.

## 4. Traps, result and rollback

See `.agents/rules/ai-laziness-traps.md` §2. Active traps: **T3**, **T7**, **T22**.
T3 binds raw exits and semantic outcomes. T7 rejects green comparisons with failed
installations. T22 pins sibling inputs so the intended production fault flips each case.
**T-DE-S2-A:** testing a selector wrapper instead of actual dispatch count/aggregate
propagation. Counter: observe the real entry and omitted-suite RED with restored GREEN.

Return the umbrella's one stage result, per-family coverage, retired paths, exact checks,
host acceptance and any owned pending work. Reuse the existing record, not a new format.
Rollback restores the affected interface/wrapper and its callers together while retaining
historical run evidence, launch attempts/counters and uncertainty. No blind queue replay.
