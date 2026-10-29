# Bottom-up kickoff review — R1

**VERDICT: GO**

Inputs-ref: `3961819303a1aad5303fa532b411f1e0ef270dba`.
Seat: `/root/kickoff_bottom_up`, fresh artifact-only context, reporting-only.
This record condenses the returned report without changing its verdict or findings.

## Material findings

None requiring a new review round. No BLOCKER, MAJOR or ESCALATED finding. GO concerns kickoff readiness, not launch authority or implementation acceptance.

## Verified source relationships

- Next and SPA chain base once at `packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh:51–63` and `packages/preset-react-spa/audit-self/audit-ai-docs.react-spa.sh:47–59`. Preset local counters are not base finding totals. Native does not chain base. D0 correctly separates runner/summary scopes.
- `extractDeclaredSkills`, `probeD1`, `probeD2` exist at `packages/core/audit-self/audit-ai-docs.ts:156,244,300`; the D2 silent catches at 308–324 require the explicitly scoped acquisition correction.
- `scripts/build-runtime-bundles.mjs:64–123,252–285,288–339` supplies entry/output registration, bundled ESM and generation/check modes. `scripts/build-getff-dist.sh:14–31,48,175–190` supplies tracked-file assembly and packed-archive checking.
- Base/preset delivery exists at `setup.d/40-configs.sh:14,136–153`. Role copying preserves ownership at `20-agents.sh:42–54`; portable role-resource closure exists at `portable-bindings.sh:246–285`. Native generation derives from canonical roles at `scripts/render-codex-contributor.mjs:154–190` and `render-harness-config.mjs:558–564`.
- `tests/living-docs-auditor/runtime.test.mjs:7–54` actually executes role snippets. Moving this seam to the extracted compact invocation is meaningful; text-presence checks would not be.
- Package test command, probe test, both builder check modes and host-verification path/fence syntax resolve. The new test files are explicitly future deliverables. Intent helper flags exist at `current-decisions.mjs:55–60,693–705,964–965`; transported authority resolution is not established by source inspection.

Source references mean `git show 3961819303a1aad5303fa532b411f1e0ef270dba:<path>`.

## Notes for bounded preparation

1. Shell D1 (`audit-ai-docs.sh:114–125`) flags fenced/removed skill mentions excluded by the structured extractor (`audit-ai-docs.ts:156–198`). Deduplication alone cannot reconcile competing predicates/exits. The permitted same-owner change can prevent competing normative checks. Make that path explicit before freezing expectations.
2. RN `BASELINES`/`DOCS_HEADERS` resolve source-preset layout (`audit-ai-docs.react-native.sh:124–166`), while ordinary installed rules/configs live elsewhere (`setup.d/30-templates.sh:32–33,72–74`; `40-configs.sh:677–686`). Keep that cell unsupported/defective unless narrowly corrected; do not manufacture a source-shaped consumer fixture. The draft already permits honest subset completion.
3. Existing R4 still needs `npx --no-install tsx scripts/audit-r4.ts` and ts-morph (`audit-ai-docs.sh:76–89`, `packages/core/probes/audit-r4.ts:11`). Bundling the new CLI does not remove backend prerequisites; incomplete outcomes suffice without a universal backend port.

## Reuse check

Problem class: bind a target, execute supported existing audit probes, preserve findings/completeness and return a compact result. Eight candidate families inspected: living-docs, docs-form, claims-conformance, template-audit, TAK, runtime bundler, installer/resource/distribution closure and native generators. SSOT searches covered audit/drift, execution/results and bundle/delivery/assurance; rows #58/#233/#234/#253/#270/#273 were read.

Existing living-docs is the domain owner; the distinct delta is execution/completeness and compact delivery. Other audits own different populations/judgments. TAK retains fixed-oracle/counterfactual ownership. Builders/installers/generators remain owners of packaging/discovery. #58 supports Markdown parser reuse; the other rows do not prove audit parser correctness. No capability commit/trailer is under review; stated reuse matches the body.

**REUSE VERDICT: THIN-ADAPT. OVERALL: GO.**

## Coverage and limits

Inspected selected APIs, four runner families, caller seam, declared commands, delivery/build owners and proposed assurance boundaries. No implementation command, installation, external research or repeated full audit. Later stage contracts, transitive closure, destination authority and runtime/platform behavior remain unverified.

Falsifier: a required D0 obligation cannot be expressed through the allowed owner changes/subset boundary, or the fixed independent oracle cannot detect its reached defect. Complete bound review synthesis before any separately authorized implementation launch.
