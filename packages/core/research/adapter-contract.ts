// The frozen adapter contract surface (adapter-factory conformance jig, F1/F2).
//
// This module is a THIN TYPE RE-EXPORT — it declares no runtime value and no new
// type. It names the jig's frozen narrow-waist (F1 `EcosystemAdapter` + `InstalledMeta`,
// F2 `ResolveCtx`, plus the resolver's `Tier1Result` / `ResolvedSources` shapes) as a
// single blessed import point: adapter authors and conformance arms import "the frozen
// contract" from here rather than reaching into resolver internals.
//
// The canonical definitions live ONCE in ./allowlist-resolver.ts — duplicating them here
// would be `#parallel-evolution-creep` (.claude/rules/build-first-reuse-default.md §4).
// This re-export freezes nothing on its own; the freeze is carried by discipline + the
// F1-F11 checklist + (J2) the conformance arms.
//
// Freeze discipline + per-row homes + J2 gates:
//   docs/superpowers/specs/2026-07-22-adapter-jig-contract.md  (the checklist)
//   docs/superpowers/specs/2026-07-22-adapter-jig-design.md §2 (the design SSOT)
//
// A pure `export type` declares no `EcosystemAdapter` VALUE, so this file does NOT enter
// the F5/F6 tripwire populations (ecosystem-adapter-precondition / ecosystem-unwired-debt).

export type {
  EcosystemAdapter,
  InstalledMeta,
  ResolveCtx,
  Tier1Result,
  ResolvedSources,
} from './allowlist-resolver.ts';
