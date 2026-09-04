<!-- scope:adapter-jig-j2-dn-j1-drift-probe -->
# Adapter-jig J2 — DN-J1 lane-glue drift probe (2B-standardize vs per-lane glue)

**Date:** 2026-07-22
**Umbrella:** `worktree-adapter-jig-j2` (base `staging`)
**Binding design:** [`docs/superpowers/specs/2026-07-22-adapter-jig-design.md`](../../superpowers/specs/2026-07-22-adapter-jig-design.md) §6 (fork DN-J1) + §9 J2 ("the retrofit-run DOUBLES as the lane-glue drift probe").
**Decisions SSOT:** [`j2.decisions.md`](../../../.claude/orchestrator-prompts/adapter-jig-meta-launch/j2.decisions.md) #1 (verdict recorded during the run; this patch is its measured backstop).

## Problem

The adapter-jig exists to catch **template-shaped twin drift** — glue that looks like the previous
lane with names swapped, where every W2–W5 MAJOR lived (spec §1). Cold-review recorded the natural
objection as fork **DN-J1** (spec §6): [`zcode-parity-doctrine.md`](../../../.claude/rules/zcode-parity-doctrine.md) §3
"2B-standardize" solved this exact defect class **structurally** — one source template + generator,
85% byte-identical twins — instead of conformance-testing N hand re-implementations. Applied here:
should J2 extract the F7/F8 delivery-cell grammar of `setup.d/45-python.sh` + `setup.d/46-cargo.sh`
into one shared shell library so each lane implements only its diffs, making the arms redundant?

The spec's recorded default (operator veto cheap) is **evidence-gated**: measure the real shared-grammar
drift between the two shipped lanes; non-trivial ⇒ extract the shared cell library (2B-standardize
precedent); trivial ⇒ per-lane glue + suite as designed. The measurement is paid exactly once — now.

## Root cause (why this is a fork, not a search-gap)

DN-J1 is not a phase-research-coverage §1 checklist miss; it is a proactively-recorded architecture
fork whose resolution the spec deferred to J2's data. The anti-pattern the measurement guards against
is [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) §4
`#integration-overhead-overestimate` — extracting a shared library on faith, without measuring, when
the extractable surface is thin.

## Solution — measured verdict: **per-lane glue (TRIVIAL)**

Method: extract each named F7/F8/F11 cell from both lanes, collapse lane-identity tokens
(`_py_`/`_cargo_`/`PY`/`CARGO`/`python`/`cargo` → `LANE`; `ruff`/`clippy`/`ast-grep`/`deny` → `TOOL`;
delivered filenames → `FILE`), then compare. Data captured at HEAD (662 LOC python / 352 LOC cargo;
12 vs 9 functions; 6 shared-named cell fns, 6 py-only + 3 cargo-only lane-specific fns):

| Shared-grammar cell | py / cargo LOC | post-norm overlap | byte-mirror? |
|---|---|---|---|
| `_log` (F7 log helper) | 6 / 6 | 1.00 | ✅ identical |
| `_copy_or_refresh` (F7 fresh/refresh) | 7 / 7 | 1.00 | ✅ identical |
| `_deliver_ci` (F7 namespaced CI cell) | 38 / 28 | 0.53 | ✗ |
| `_firing_self_check` (F8 proof-of-enforcement) | 99 / 53 | 0.19 | ✗ |
| `_write_rules_lock` (F11 lock writer) | 86 / 54 | 0.07 | ✗ |

- **Whole-file normalized line-set overlap: 0.10 (≈90% divergence).**
- Only **two ~7-line F7 primitives** (`_log`, `_copy_or_refresh`) are true byte-mirrors — the sole
  genuinely-extractable shared code (~13 LOC total).
- The substantive cells are majority-to-overwhelmingly lane-specific, and the divergence
  **concentrates precisely in the defect-bearing corners**: the F8 firing self-check (0.19 — where
  the W2/W4/W5 self-check MAJORs lived) and the F11 lock writer (0.07 — divergent lock schema/content
  per lane). A shared library would absorb ~13 trivial lines while leaving 100% of the MAJOR-bearing
  bodies hand-written per lane.

This does **not** clear the 2B-standardize 85%-byte-identical bar (there: `zcode-parity-doctrine.md`
§3, ~85% twins; here: two 7-line primitives). Extracting a cell library would be
`#integration-overhead-overestimate`. **Verdict: per-lane glue + the 22-arm conformance suite as
designed** — matching the spec §6 recorded default and j2.decisions.md #1. (This line-level measure is
more pessimistic than the decision-log's cell-level "~51% shared" estimate; both metrics reach the
identical verdict — neither clears 85% — so the resolution is robust to metric choice.)

## Prevention

Before proposing a shared-library extraction over N template-shaped lanes: **measure the
post-normalization overlap of the SHARED-grammar cells specifically** (not raw whole-file diff), and
extract **only if** (a) overlap clears the precedent bar that justified the pattern (2B-standardize =
85% byte-identical), **and** (b) the residual divergence is *not* concentrated in the defect-bearing
corners the suite exists to guard. If the extractable surface is a handful of trivial primitives while
the risk lives in per-lane bodies, per-lane glue + conformance arms beats a library. Record the
measurement (numbers, not vibes) so the fork is paid once.

## §1.7 self-review

- **Forward-check (research-only):** complies with
  [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) §4 — the
  patch's whole job is to *measure before extracting*, the counter to `#integration-overhead-
  overestimate`; the verdict is REFERENCE / no-build (no new capability, dependency, or module).
  Complies with [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) — the drift
  probe is a deterministic node measurement, zero LLM calls. Complies with
  [`doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md) §5 — a
  research-patch inherits the folder README's authority, so no per-file header is required.
- **Backward-check (sibling sweep — class = recorded architecture forks resolved by measurement):**
  the DN-J1 verdict (per-lane glue) is consistent with, not a contradiction of, the spec §6 recorded
  default and [`j2.decisions.md`](../../../.claude/orchestrator-prompts/adapter-jig-meta-launch/j2.decisions.md)
  #1; it supersedes nothing. The sibling fork DN-J2 (dry-stamp rehearsal) was already superseded by
  the J3 demand trigger (spec §9), not by this patch. No other fork surface is silently normalized.
- **Self-application (T15):** the jig exists to catch template-shaped twin drift by *measuring*, not
  assuming; this patch applies that same discipline to the jig's own build-vs-standardize decision —
  the framework auditing its own architecture choice with its own method.

## Tags

`#drift-probe-before-extraction` `#integration-overhead-overestimate` `#evidence-gated-fork` `#measure-shared-cells-not-whole-file`
