# getff experience recall: native acceptance

> **Status:** local pilot accepted with documented notes; final source checks passed (50 delivery + 55 principles); staging delivery human-authorized 2026-10-28, Git/CI under owner custody.
> **Authoritative for:** the observed local contributor pilot, its source revision, checks and limitations.
> **NOT authoritative for:** universal invocation, organic adoption, productivity gains, consumer rollout, or historical-processing completeness.

## Result

The local workflow was demonstrated in fresh native Codex and Claude Code/GLM sessions: an ordinary task prompt caused an unrequested MemHub lookup, a returned detail informed the proposed work, and an ordinary continuation made no further lookup. The test task concerned docs-engine CI and local-sweep integration. It requested diagnosis and a proposal only; no CI edits or branch synchronization were performed or approved.

The current canonical skill is [.agents/procedures/getff-experience/SKILL.md](../../.agents/procedures/getff-experience/SKILL.md), SHA256 `45a17d7f4d1a3807cac4b0c360cf9421aa418f2c31c9fd55acb8cc6329908a2c`. It has 516 body words and 4123 source characters. Generated Codex discovery permits implicit invocation; the Claude entry links to the same source. A short routing sentence in [CLAUDE.md](../../CLAUDE.md) supplies the activation cue that GLM's metadata-only trial missed.

Private receipts are under `native-stock/maintenance/experience-recall-pilot/20261028T122129Z/skill-implementation-20261028T173836Z/`. `acceptance.json` binds source and observations; each native subdirectory retains the actual stream, request, response and public outcome. These are controlled tests, excluded from natural-use monitoring.

## Observed behavior

| Host / revision | Selected without a user memory cue | Returned material | Observable use | Same-task continuation |
| --- | --- | --- | --- | --- |
| Codex CLI, actual model `gpt-6.1-terra` | Yes | Two partial hits; relevant coding experience `6d54a655…` | Inspected the pointed-to sweep coverage/confinement guard, then preserved broad triggers pending read-set proof | Zero additional memory calls |
| Claude Code, actual model `glm-5.3`, final source | Yes | Two partial hits: coding experience `5faa5bfd…` and schema `012faf5d…` | Explicitly attributed the `--run-row <name> --receipt <nonce>` lead to MemHub, confirmed the flags in current code, and included them in verification-plan point 5 | Zero additional memory calls |

The retrieved GLM command flags were absent from the starting request and the checked startup instruction/memory index files. The lookup preceded its repository investigation. This establishes use as a lead in a proposal, not measured time saved or proof that the entire proposal is correct.

Codex ran on the preceding canonical body `a1ed6656…`; the final delta is only the reviewed English-query paragraph. Its observed request was already English; its eight words also exceeded the preferred term count. Discovery metadata, permissions, call limits and provider did not change; do not describe this as a fresh Codex rerun on the final body.

The schema has exact publication provenance: native `012faf5d-358f-466c-b15d-58f5a66c7628` maps to SDK `820fdd77-d676-4021-9ae7-ebe2c626a1a8` in run `20261028T010026Z`, exported by the Astra low cycle and published with 75 citations. Its source is active `l6_schema`. This proves that a System 2 projection was retrieved through the normal reader. It was not needed for the technical plan and is not counted as applied. Coding origin is not inferred from its kind alone.

## Preserved failures and fixes

- Original context-only Stage 0 remains `NOT_PASSED`; the later explicit human go admitted implementation without relabelling that result.
- First GLM trial exposed the skill but never selected it. The small existing-entry routing cue corrected activation; no forced lookup hook was added.
- The next mixed-language lookup returned unrelated chat records. Short English technical query guidance was added; the final lookup returned useful experience. These trials do not isolate language as the sole cause of ranking differences.
- The final English query was 104 characters but 15 whitespace terms, longer than the preferred 3–6 terms. The hard 240-character bound held. The term-count preference is not mechanically enforced; this remains a minor adherence limit.

## Context and verification

Each accepted host used one `MemHub_recall` with `limit=2`, `character_budget=2000`, `timeout_ms=30000`, and no scope override. Returned content, not the whole store/graph, enters context. Complete recorded tool results measured 5520 characters on Codex and 2864 on GLM, below the 8000-character pilot ceiling. Both searches were truncated by the time budget; they do not establish full search coverage.

First-use loading costs are additional: the canonical source is 4123 characters and the managed provider source is 8923. Provider loading occurs once per usable context. Incremental tool-schema cost and attributable lookup token counts remain unknown. Research/test costs are not routine recall costs.

The new visible description adds 486 bytes to a 6775-byte Claude project catalog. The reviewed population budget is 7300 bytes for an actual total of 7261; per-entry and vendor limits remain unchanged. Existing dependency reuse initially failed the canonical compatibility check; temporary links were removed and `scripts/worktree-node-modules.sh --apply` provisioned this checkout. Its final check passed and the 55 affected tests passed using the actual candidate configuration and compatible dependencies. Fifty native-delivery tests also passed. Final source-check receipts are `final-verification.json` and its logs. Principles 15/21 may omit untracked population entries, so direct independent review of the new canonical source supplements those suites.

The existing ultra store, Luna/Astra configuration and daily maintenance remain in place. This increment adds no history replay, new synthesis or engine/SDK/database repair. The installation's two previously authorized trigger repairs remain historical facts. The monitoring prompt now excludes all controlled session IDs while preserving its schedule and maintenance instructions.

At observation time this was an uncommitted local pilot in the d961 checkout: no commit, push, PR, merge, global installation or OpenMausBot delivery had occurred. A later human admission (2026-10-28, after these observations) authorized this skill's commit, PR and squash merge into `staging` — the verified default workspace base, branch `codex/getff-experience-recall` off `fd031522d63d…` — superseding the earlier local-only publication exclusion for this adapter delivery only; consumer/OpenMausBot/global rollout remains out of scope. Git/CI execution stays under owner custody: this report records the authorization, not a completed merge, and no installed-everywhere claim is made. Native examples do not establish organic adoption; the existing monitor continues observing ordinary sessions with explicit coverage gaps retained.

### §1.7 Forward-check applied

The provider remains the authority for notices/permissions; the local residue is bounded task routing and one-call behavior (`.agents/procedures/getff-experience/SKILL.md:24`). Native implicit selection stays explicit in `.agents/skills/getff-experience/agents/openai.yaml:2`; no paid model call was added to CI. The measured population increase follows the existing calibration policy at `packages/core/principles/48-skill-description-budget.test.ts:74`; per-entry limits and exceptions are unchanged. Fresh final verification reports 50 delivery and 55 affected principle tests passing.

### §1.7 Backward-check applied

Class = local contributor governed-recall routing before choosing an approach. A cold class-only backward sweep reached 15 of 15 surfaces with no gap: canonical procedure; Claude selection/symlink and map; Codex entry, implicit policy, renderer/inventory; Claude and Codex startup routes; shared bootstrap/session/subagent digests; lifecycle registrations/adapters; host bindings; shared activation. Exact per-surface evidence and author-side changed/unchanged attribution are retained in `backward-sweep.json`. Representative bindings are `scripts/canonical-agents-map.json:470`, `CLAUDE.md:180`, `.agents/session-bootstrap.md:39` and `docs/codex-contributor.md:40`. Consumers, global installs and bots are outside this approved local class; no new exemption mechanism was introduced. Source routing coverage does not substitute for native trials, which are recorded separately above. A later delivery check outside that sweep's routing class: the stock ships-manifest gate (`setup.d/ships.manifest`) requires an explicit internal classification for this skill (`internal`, installer `no`, plugin `no` — consumer rollout deferred); the original 15-surface cold receipt stands as historical evidence and did not enumerate this delivery-classification surface.
