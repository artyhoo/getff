# Development efficiency S1 — stable precompact navigation

> **Rigor label (L0):** `build-and-verify` — comment-only source repair with existing delivery checks.
> **Status:** Prepared for later S1 admission; this file does not launch execution.
> **Type:** execution-build. **Stage:** S1. **Branch:** `codex/development-efficiency-s1`.
> **Scope:** S1 only. Read the parent `kickoff.md` first; one implementation PR against `staging`.

## 1. Binding inputs and outcome

Read `README.md#why-this-exists`, `.agents/session-bootstrap.md` and `CLAUDE.md` first.
Then read `docs/superpowers/specs/2026-10-22-development-efficiency-design.md`
§§3, 5, 6 and 15. The design owns the scope; this kickoff specifies its S1 execution.
Reviewed design SHA-256: `22efd36f9a3d08e8f087d4bf7678444f58dbfbf80fcc15212642148c6940487a`.
Authoring checkout HEAD: `5912fccbae9de3055353a3438993cf8469e6c763`.
These are input identities, not assertions about the future execution checkout.

Remove the avoidable edit caused solely by movement of the `ZCODE_EVENTS` declaration.
The canonical hook and its delivered compatibility path must retain a usable source-path
and symbol reference without a live numerical line range. Runtime behavior stays the same.
The destination is the verified normal package/install delivery in disposable consumer
fixtures and an implementation candidate ready for its existing delivery owner.
Global installation, native activation and publication are separate boundaries.

Historical evidence: `e5c511601d7` changes only the comment citation; `abde02fa6ab`
changes eight npm fingerprints, three rows each. Re-read those commits when using them;
do not count their checks as fresh S1 acceptance.

## 2. Admission, owner and checkout

Before execution, the existing execution owner records the actual isolated checkout,
base/candidate revision, applicable task authority and next review/delivery owner.
Reconcile existing work/in-flight ownership before creating another implementation.
You are not alone in this repository: preserve other owners' changes and workspaces.

This kickoff and its binding design must reach `staging` before a staging-based pipeline
or AIF dispatch reads them. Writing or staging this document is not that transition.
Do not dispatch S2–S5 or D1–D3 from this kickoff. If a GLM route is separately admitted,
read `/Users/art/.config/getff/glm-launch-policy.md`, use the supported launcher and
verify actual session/model/mode; this kickoff grants no additional sessions or spend.

## 3. Permitted changes and generated closure

1. In `.agents/hooks/precompact-residue.sh`, replace only the numerical citation beside
   `ZCODE_EVENTS` with the source path `scripts/render-harness-config.mjs` and that symbol.
   Verify that the symbol uniquely identifies the intended event-set declaration.
2. Preserve `.claude/hooks/precompact-residue.sh` as the existing canonical-source alias;
   do not replace its repository link or edit a second independent hook implementation.
3. Use `bash scripts/build-getff-dist.sh` for necessary package/manifest regeneration.
   `packages/getff/MANIFEST.sha256` remains tracked. Keep working-tree and staged-input
   identity distinct; stage the admitted payload and its generated manifest together.
4. Refresh only fingerprint rows causally affected by these final hook bytes, using the
   existing capture machinery. Expected changed fixtures are the four npm stacks
   (`ts-server`, `react-next`, `react-spa`, `react-native`) in greenfield/brownfield modes;
   expected rows are the canonical hook, compatibility hook and refresh-ledger hash.
   Capture to an external scratch `BASELINE_DIR` first and inspect the complete diff
   before copying the necessary generated baselines into the candidate.

The current snapshot entry runs the full population. Use its supported whole-run entry;
do not embed/extract source text, append a per-cell call or invent positional selectors.
Keep every currently required matrix cell and oracle. Preserve unchanged cells as such.
Unexpected changed paths/rows require an explanation and the existing scope route;
do not accept them by blindly replacing baselines.

Out of scope: hook logic; renderer behavior; runner repair; fingerprint schema or ledger
normalization; matrix reduction; manifest untracking; new dependencies, rules, services,
standing observers or permanent test infrastructure for this comment. Do not edit
`.claude/settings.json`, weaken deny rules or hook trust, or change consumer data.

## 4. Verification and acceptance

Use the existing pinned provisioning/lockfiles. Record the effective fixture inputs and
toolchain. Missing prerequisites or unrelated pre-existing failures remain explicit;
they do not permit security changes, bypasses or expanding S1 into environment repairs.

Before expensive checks, inspect the exact source diff and confirm it changes only
navigation prose. Perform this bounded navigation probe on disposable copies:

- Establish the original numerical target and current `ZCODE_EVENTS` declaration.
- Insert harmless blank lines before that declaration in a temporary renderer copy.
  Show the numerical reference is displaced while the file/symbol reference still
  resolves uniquely. Keep the tracked renderer unchanged.
- Record that the candidate hook needs no further edit and retains identical bytes
  during this simulated movement. Do not recapture fingerprints for the temporary probe.

Inspect both package delivery destinations: `.agents/hooks/precompact-residue.sh` and
`.claude/hooks/precompact-residue.sh`. Compare their bytes with the canonical candidate
and verify expected file/link identity through the existing delivery route. Preserve
an actual installer exit/result and diagnostics from a fresh npm consumer fixture:
snapshot equality alone is insufficient because the current runner suppresses installer
exit status. All installs run in disposable fixtures, never in the contributor checkout.

After final source/derived edits, run the following from the candidate repository root
on the destination host; use the declared host runner for the acceptance receipt:

```bash host-verify
bash scripts/build-getff-dist.sh --check
bash tests/install-sh/canonical-bindings.test.sh
SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh
make self-audit
```

Invoke `bash scripts/host-verify.sh .claude/orchestrator-prompts/development-efficiency/kickoff-s1.md` only during admitted
implementation acceptance. `--list` checks document structure and runs no acceptance.
Retain exact commands, exit codes and logs tied to final relevant inputs. No failed,
denied, skipped or timed-out check becomes a pass. Reuse demonstrably applicable evidence;
repeat only checks invalidated by later relevant edits or unresolved failures.

Acceptance requires the navigation probe, comment-only source diff, inspected generated
closure, successful installer outcome, delivered-byte/identity checks and all required
package/install/self-audit results. Container-only results do not establish host acceptance.
Existing independent review and pre-egress/publication gates remain in force. Ordinary
in-scope generated corrections stay with the executor; no new kickoff is needed for them.

## §4c Park-don't-guess

On a genuine unresolved architecture, scope or authority fork, do not guess. Park it as
a question through the existing runtime task's supported park/answer path, name the
existing accountable recipient, and state both options with their consequences and the
missing decision/evidence. Stop dependent effects until a valid answer returns through
that route; continue independent already-admitted work when possible. A clear ordinary
in-scope correction is not a new operator vote. Preserve task identity, current authority,
review/launch caps and any owned pending result. This contract grants no launch itself.

## 5. Active traps and reuse

See `.agents/rules/ai-laziness-traps.md` §2. Active traps: **T3**, **T7**, **T19**, **T20**.

- **T3 / T20:** cite observed candidate bytes, command outcomes and delivered artifacts;
  do not substitute the historical episode or a launch receipt for current evidence.
- **T7:** removing the number is insufficient if the remaining reference is ambiguous.
- **T19:** independent review checks the actual final diff and generated closure before
  handoff; a green matrix does not itself establish compliance with S1 scope.
- **T-DE-S1-A:** making a comment cheap by deleting its protective expectations. Counter:
  retain matrix membership, independent package checks and the runtime refresh ledger.
- **T-DE-S1-B:** temporary line-movement evidence leaks into delivered source or baselines.
  Counter: probe on copies and verify the renderer is unchanged in the final diff.

Reuse existing assembly/capture/comparison paths (prior-art SSOT #267/#270) and the
existing review workflow. This is not a new capability or a general citation migration.

## 6. Result, handoff and rollback

Return one result in the existing task/PR record: candidate revision and changed paths;
navigation probe; generated-row explanation; actual installer outcome; host acceptance
receipt; independent review; remaining blockers; and the next action with its accountable
owner. Distinguish candidate, reviewed, merged, packaged, installed and activated states.
The existing delivery owner consumes that result under current authority. A blocked
destination remains explicitly pending; do not report source readiness as installation.

Rollback is a normal source revert plus the corresponding current manifest/fingerprint
maintenance. Keep historical evidence and consumer ledger data. Do not reset another
owner's checkout or remove uncommitted work. S1 completes without starting a later slice.
