# Executable AI-docs + cargo trust-tier follow-ups — umbrella kickoff

> Deferred-work tracker created 2026-07-03 at maintainer request ("заведи амбрелу чтобы не забыть") after the overnight validator-chain run (MT #866, S4 #868, README #870, name-symmetry #871). This umbrella collects the work that was **deliberately deferred** during that run so it is not forgotten — each item carries an explicit trigger + scope. **Nothing here is started without an explicit maintainer go** (each is its own stage / possibly its own umbrella at pickup).

## Recorded decision (binding)

**AGENTS.md fenced-block ownership = Variant A — framework-owned fenced blocks (maintainer decision, 2026-07-03).**
getff writes explicitly-marked fenced regions inside the consumer's AGENTS.md that it owns + drift-detects (drift caught within one regenerate cycle); the rest of the file stays consumer-owned. Rationale: drift-detection of convention-vs-rule is the project's core thesis ("executable AI-docs that cannot silently lie") — the unoccupied getff niche; Variant B (fully consumer-owned) leaves exactly the "documents lie" hole the project exists to close. This resolves owner-decision #2 in [`docs/superpowers/plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md`](../../../docs/superpowers/plans/2026-07-03-multi-toolchain-convention-compiler.decisions.md) (was SURFACED → now RESOLVED: A).

## Work-items (deferred; each gated on its own trigger)

### WI-1 — AGENTS.md executable-docs: framework-owned fenced blocks + drift detection (decision A)
- **What:** implement Variant A — a fenced-region convention inside consumer-owned `AGENTS.md` (and peer AI-doc files) that getff owns, plus a drift detector that catches a fenced region diverging from the rule/anchor it describes within one regenerate cycle. This is the "6th surface" of the Convention Compiler (MT research §9 p.5, [`docs/meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md`](../../../docs/meta-factory/research-patches/2026-07-02-multi-toolchain-generalization.md)).
- **Owed reconciliation:** [`INSTALL-FOR-AI.md`](../../../INSTALL-FOR-AI.md) `### What --refresh never touches` currently lists `AGENTS.md` as wholly consumer-authored / never-framework-owned (Variant-B framing). Decision A refines this — the FILE stays consumer-owned, but explicitly-marked fenced REGIONS are framework-owned + drift-detected. Reconcile INSTALL-FOR-AI.md + the three-layer authority model (INSTALL-FOR-AI.md `Three-layer authority for shipped artefacts`) with A when this ships. Also fold the §9 p.5 "framework-owned fenced blocks" proposal into the shipped model.
- **Scope note:** this is a substantial feature (the flagship "executable AI-docs" niche, MT research §0 / §7 gaps 4-5-7). **At pickup it likely warrants its own umbrella** — this WI is the tracked entry + the recorded decision, not a one-stage task.
- **Trigger:** maintainer go for the executable-AI-docs surface (independent of MT rule-generation; can proceed on the npm stack alone).

### WI-2 — cargo registry-cache Tier-1 derivation
- **What:** extend the S4 cargo `EcosystemAdapter` ([`packages/core/research/ecosystem-cargo.ts`](../../../packages/core/research/ecosystem-cargo.ts)) to derive Tier-1 trust for **registry** dependencies by reading the local cargo registry cache (`$CARGO_HOME/registry/src/<registry>/<pkg>-<ver>/Cargo.toml`). Today only vendored / path / workspace-member deps get Tier-1; the common registry-dep case falls through to Tier-0/Tier-2 (documented cap in `ecosystem-cargo.ts` header + SSOT #197 "Trigger to revisit").
- **Why deferred (not a bug — a feature):** this is a **new trust surface** (a filesystem location outside the consumer project tree, `$CARGO_HOME`), needs its own threat-model review + the same fail-closed containment discipline S4 shipped (path-traversal, symlink, name-symmetry, realpath) applied to the cache path, and a Rust toolchain to be exercised end-to-end. Wrong scope for a "fix".
- **Trigger:** live-research-of-Rust is actually wanted (per SSOT #197 "Trigger to revisit" + `research-source-trust.md §4` registry-cache follow-up note).

### WI-3 — cargo TOCTOU fd-hardening
- **What:** close the realpath→read time-of-check/time-of-use window in `resolveDepManifestPath`/`resolvedWithinRoot` ([`packages/core/research/ecosystem-cargo.ts`](../../../packages/core/research/ecosystem-cargo.ts)) by opening the manifest via a file descriptor and canonicalizing the fd (or read-then-canonicalize the read path), per the harden-criterion recorded in [`.claude/rules/research-source-trust.md §5 item 2`](../../../.claude/rules/research-source-trust.md).
- **Why deferred:** **outside the current threat model** — defeating it requires an attacker who can race the local filesystem during a research run (concurrent local-FS writes = already holds local code execution, strictly stronger than the committed-file H1 actor the tier defends against). A clean node.js fix is fiddly (no easy `openat`/`O_NOFOLLOW`). Documented as an accepted residual with the harden-criterion.
- **Trigger:** research is ever run against an untrusted / shared working tree with a concurrent writer (per the §5 item-2 harden-criterion).

## Not in this umbrella (separate tracks — noted to avoid confusion)
- **MT rule-generation implementation** — its own umbrella: [`.claude/orchestrator-prompts/multi-toolchain-convention-compiler/kickoff.md`](../multi-toolchain-convention-compiler/kickoff.md). Blocked on a Rust toolchain for live cargo-firing (WI-1 here, executable-docs, is a *different* surface and can proceed without cargo).

## AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) §3 kickoff-author obligation)
Active traps for whoever picks up a WI here: **T5** (don't fold implementation into a tracker — this doc is a tracker, the WIs are future work), **T11/T12** (BFR-consult + literature sweep before building the drift-detector WI-1 or the registry-cache reader WI-2 — check SSOT + prior art, don't reinvent), **T13/T16** (WI-1 adopts the AGENTS.md/LF-AAIF format + §9 p.5 proposal — verify the upstream problem-class matches before assuming the pattern transfers), **T15** (WI-1's drift-detector must self-apply: it must catch a fenced block in *this repo's own* AGENTS.md drifting). Domain trap `T-FUP-A` — "treating WI-2 (registry-cache) as a quick 'fix' rather than a new-trust-surface feature that must re-earn the full S4 containment discipline (traversal/symlink/name/realpath) on the `$CARGO_HOME` path".

## Kickoff-staging-placement
This kickoff is a tracked file; per [`.claude/rules/kickoff-staging-placement.md §1`](../../../.claude/rules/kickoff-staging-placement.md) it must reach `staging` (this PR) before any `/pipeline executable-aidocs-and-cargo-followups` dispatch. It is a **tracker**, not an immediate dispatch — pick up individual WIs on maintainer go.
