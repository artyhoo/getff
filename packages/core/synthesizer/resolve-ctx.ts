// Ecosystem-adapter selection for the production resolve path (ecosystem-wiring W2).
//
// A consumer repo is exactly ONE detected stack, and a ResolveCtx carries exactly
// ONE EcosystemAdapter (the resolver is single-ecosystem by design — a cross-
// ecosystem request against the wired adapter fails closed, S4). So the adapter
// that gates a consumer's research-plan provenance (allowlist-resolver.ts tier1For)
// is a pure function of the SAME detectStack() signal the rest of the pipeline runs
// on. Before W2 both production callers (synthesizer/cli.ts, synthesizer/file-clients.ts)
// hardcoded `adapter: npmAdapter`, so a python or cargo consumer's Tier-1 always
// missed with an ecosystem-mismatch (FF2016). This factory threads pipAdapter /
// cargoAdapter / npmAdapter by detected stack — wiring BOTH non-JS adapters
// TOGETHER (owner decision 2026-07-17; T-EW-A both-or-neither, never piecemeal).
//
// Why explicit per-stack `adapter: <symbol>` object literals (not a name-keyed
// registry): the unwired-debt tripwire (research/ecosystem-unwired-debt.test.ts)
// greps for exactly the `adapter: <symbol>` / `.adapter = <symbol>` textual form.
// A registry (`{ pip: pipAdapter, ... }` + `adapter: selected`) would thread a
// VARIABLE and evade the grep (the documented residual gap in that test), leaving
// BASELINE != the real wired count. Keeping the literals explicit is what makes the
// wiring both real AND mechanically visible — the tripwire flips 2 → 0 because
// these three literals exist.
//
// Prior-art: prior-art-evaluations.md#223 (python pipAdapter ADAPT — its "Trigger to
// revisit" names exactly this wiring); #197 (cargo cargoAdapter ADAPT); #188 (the
// local-metadata trust pattern). No new external capability — composition of the
// already-evaluated adapters into the existing ResolveCtx seam.

import { detectStack } from '../detector/index.ts';
import type { ResolveCtx } from '../research/allowlist-resolver.ts';
import { npmAdapter } from '../research/ecosystem-npm.ts';
import { cargoAdapter } from '../research/ecosystem-cargo.ts';
import { pipAdapter } from '../research/ecosystem-python.ts';
import { goAdapter } from '../research/ecosystem-go.ts';

/**
 * Builds the production ResolveCtx for a consumer `root`, selecting the
 * EcosystemAdapter by the detected stack:
 *   - python → pipAdapter
 *   - cargo  → cargoAdapter
 *   - go     → goAdapter
 *   - react-next / ts-server / unknown → npmAdapter (the pre-W2 default,
 *     preserved for every JS/unknown consumer — a strict superset of prior
 *     behaviour, no regression for the npm path).
 * The `root` is threaded verbatim; this never guesses a different root.
 *
 * `skipAif: true` is load-bearing, not an optimisation: adapter selection is a
 * pure function of the TOOLCHAIN manifest (pyproject.toml → python, Cargo.toml →
 * cargo, go.mod → go, else npm), never of the `.ai-factory` metadata (whose parser only ever
 * yields 'react-next'/'ts-server' → npmAdapter anyway). Reading `.ai-factory`
 * here would ADD a throw the pre-W2 resolve path never had: readAif raises
 * AifSchemaError when a consumer ships a freeform `.ai-factory/DESCRIPTION.md` |
 * `ARCHITECTURE.md` | skill-context `SKILL.md` that lacks a canonical heading.
 * Pre-W2 both callers hardcoded `adapter: npmAdapter` and never called
 * detectStack, so that throw was structurally impossible on `--from-research`.
 * Skipping the AIF read keeps the strict-superset invariant: a detection with no
 * toolchain manifest still degrades to the pre-W2 npmAdapter default, never throws.
 */
export function resolveCtxForRoot(root: string): ResolveCtx {
  const { stack } = detectStack(root, { skipAif: true });
  if (stack === 'python') return { root, adapter: pipAdapter };
  if (stack === 'cargo') return { root, adapter: cargoAdapter };
  if (stack === 'go') return { root, adapter: goAdapter };
  return { root, adapter: npmAdapter };
}
