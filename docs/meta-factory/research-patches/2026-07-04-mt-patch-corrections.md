<!-- scope:mt-patch-corrections -->

# MT patch corrections (2026-07-04)

Scope: corrections to [2026-07-02-multi-toolchain-generalization.md](2026-07-02-multi-toolchain-generalization.md) — folder-authority (research-patches README owns the header; per-file Authoritative-for not required). The 2026-07-02 patch is read-only under the Artifact Ownership Contract (`docs/meta-factory/research-patches/*` = one patch per gap, append-only); corrections that would rewrite it are recorded here instead. Each item: **patch says X → read Y, basis**.

1. **P4 «the path `message.code.code` is real»** → real **only for `compiler-message` lines with a non-null `code`**; the runner MUST filter framing lines (`reason === "compiler-message"`) and null-guard `message?.code?.code`. Basis: S2 `firing-runner.ts` (PR #886) implements exactly this filter + guard — a bare `$.message.code.code` over the NDJSON stream hits null framing lines.

2. **§6 Q3 (capability tiers)** → RESOLVED by §9 p.10: this axis is **`capability-class`** (the `syntax | type-aware | dep-graph` selector-expressibility class), not a numeric tier. And **§8 node-sketch `capabilityTier`** → **superseded** by §9 p.2: the v0 `ConventionNode` (spec §3) carries no such field. Basis: spec §3 node shape + §6 four-vocab table (`capability-class` = `ConventionNode.selectorClass`).

3. **§5 SSOT-markup** → finalized under other IDs: ast-grep-agent [#185](../prior-art-evaluations.md), cargo-trust [#197](../prior-art-evaluations.md), Semgrep gate-precedent [#155](../prior-art-evaluations.md), OpenRewrite [#156](../prior-art-evaluations.md); closed by shipped stages: narrow-core IR [#198](../prior-art-evaluations.md) (S1), clippy renderer [#199](../prior-art-evaluations.md) (S2). **Still draft** until their stages: golangci / ruff / PMD renderers, AGENTS.md-render-target (closed by Stage 4). Basis: SSOT register entries above.

4. **§9 p.6 / §4.5 rule 2 «anchor»** → in the surface-3 transitive chain read «anchor» as the **node.id key of the composition plane** (per MT-ANCHORS-DECISION, 3a-i); `node.anchors` (FF) is a **self-hosting back-pointer** on a separate resolver (FF6003), not the doc-binding key. Basis: spec §3 Clarification (3a-i) + §5 node.id[] wording (amended in the same 3a-ii PR).

5. **§7 competitive delta (2026-07-03):** agents-lint appeared (giacomo, v0.5.0, «Your AGENTS.md is probably lying») — deterministic **reference-freshness** (paths / scripts / deps exist), NOT convention semantics, NOT firing-evidence; the core niche (§0 gap 4-5) stays empty. AGENTS.md v1.1 proposal (issue #135, open): «Guidance, Not Governance» — enforcement is explicitly left to implementers. llms.txt: 97% of files carry no AI requests (Ahrefs 2026-06). Basis: re-verify sweep at 3a-ii dispatch (volatile competitive facts per MT patch §5 Prevention).

## §1.7 self-review

- **Forward-check:** doc-only corrections file — complies with [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) (no CI mechanism), [doc-authority-hierarchy.md §2](../../../.claude/rules/doc-authority-hierarchy.md) (folder-authority — research-patches README owns the header; per-file Authoritative-for not required; scope-slug present per principle 10), and [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) (records verdicts already in the SSOT register — no new capability). No `packages/` code touched (T5).
- **Backward-check:** corrections to the read-only 2026-07-02 patch (Ownership Contract — append-only, not rewritten in place); each item points patch→spec/SSOT/S1-S2 code as the current source of truth. Supersedes nothing; the 2026-07-02 patch stays intact. Self-application (T15): this file itself carries the scope-slug + §1.7 marker it names as the correction discipline.
