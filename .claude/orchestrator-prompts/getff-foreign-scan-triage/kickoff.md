<!-- scope: kickoff — getff-foreign-scan-triage micro-umbrella. Design base (BINDING): docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md §8 item 7 + §1 wall 7(g). Cold-reviewed GO r2 (/arch §2, 2026-07-23). Tier 2 (no bridge-profile marker — unknown root cause, CLAUDE.md tie-breaker): top tier plans, executor implements. Single-stage. -->

# getff-foreign-scan-triage — kickoff

> **Goal:** resolve the ONE investigate-class probe finding: a pre-push run on a real
> pnpm/Turborepo monorepo copy scanned `.claude/worktrees/**` and `.stryker-tmp/**`
> (280 nested-scan output lines — runtime/noise smell, potential correctness smell on any
> repo with active worktrees). The responsible walker is NOT yet located: grep of
> `packages/core/hooks/pre-push.ts` finds no walker (only `:1489`, an unrelated
> canonicalization comment). Outcome is BINARY and must carry evidence either way:
> (a) walker located in shipped code → fix with exclusion + paired fixture; or
> (b) proven probe-environment artifact (e.g. dirs brought over by the probe's rsync copy
> interacting with the consumer's OWN tooling, not getff code) → close with the reproduction
> evidence in a research-patch note. May NOT be closed silently (spec §8.7).

## §0 Dispatch gate + in-flight probe (BINDING)

- **Staging placement** first ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)).
- Pre-dispatch in-flight probe (CLAUDE.md operational conventions): no shared files with the
  sibling umbrellas are EXPECTED — re-check at dispatch anyway (if the walker turns out to
  live in `pre-push.ts`, coordinate with `getff-honest-signals` S1/S2 which edit that file).

## §1 Stage (single PR onto staging)

- **S1 — locate or close-with-evidence.** (1) Reproduce: fixture repo containing
  `.claude/worktrees/<x>/` and `.stryker-tmp/sandbox-1/` with nested file trees + a getff
  install; run the consumer pre-push (and any shipped glob-walking checks:
  rule-glob liveness, R2-boundary walker, mutation runner discovery) and capture which step
  emits nested-scan lines. (2a) If a shipped walker is responsible: add the exclusion
  (`.claude/worktrees/**`, `.stryker-tmp/**`, plus obvious siblings like `node_modules`
  already excluded) + paired fixture (fixture repo → zero scanned entries from foreign dirs;
  normal dirs still scanned). (2b) If not reproducible from shipped code: write the
  research-patch note (`docs/meta-factory/research-patches/`) with the reproduction attempt
  transcript and the actual culprit, and close. Umbrella `done.md` in the same PR.

## §2 «Works» (explicit + testable)

Either branch produces quoted evidence: (a) fixture output before/after the exclusion, or
(b) the reproduction transcript proving shipped code is clean. The PR body states which
branch fired.

## §3 AI-laziness traps

See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md). **Active traps
for this umbrella: T2, T3, T7, T14.**

- **T2** — designing the exclusion without RUNNING the reproduction is not an investigation.
- **T3** — the culprit claim needs command+output, not "probably the glob in X".
- **T14** — "could not reproduce quickly" ≠ "probe-environment artifact"; branch (b) requires
  the full reproduction attempt on the fixture repo, quoted.
- **T-FST-A (domain)** — closing as environment-artifact because the walker is hard to find:
  the close-branch (b) is only legal AFTER the fixture-repo reproduction ran the full shipped
  check-set and stayed clean — absence of evidence must be evidenced.

## See also

- Spec (BINDING): [2026-07-23-getff-any-stack-closure-design.md](../../../docs/superpowers/specs/2026-07-23-getff-any-stack-closure-design.md) §8 item 7.
- Probe origin: timeliner refresh probe, 2026-07-23 (`prepush3.log`, 280 nested-scan lines).
