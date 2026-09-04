<!-- scope:unattended-agent-dispatch-default -->

# Unattended loop vs. the server-delivered Agent-tool default

> Scope: why an unattended `/pipeline` + `/dispatcher` run stops at the cold fidelity audit, why `/night-mode` appeared immune, and where the standing authorization belongs. Discovered 2026-07-24.

## Problem

The full aif loop — dispatch → verify deliverable → cold fidelity audit → `REVISE` rework → `GO` push/PR/CI/merge → `done.md` → next stage — cannot run unattended today. It stops in two distinct places, and the two have **different causes** that were initially conflated.

**Blocker A — the cold fidelity audit (steps 3).** The session system prompt carries a server-delivered append:

```text
Do not call the AgentTool unless the user requested it
Do not use workflows or deep-research unless the user requested it
```

Step 3 is not waivable: [`packages/core/hooks/checks/pr-body-fidelity.ts:151`](../../../packages/core/hooks/checks/pr-body-fidelity.ts) rejects `FIDELITY: skipped` on any PR whose `## Provenance` section declares a substrate. The project mandates the dispatch at [`.claude/skills/pipeline/SKILL.md:390`](../../../.claude/skills/pipeline/SKILL.md) and [`.claude/skills/dispatcher/SKILL.md:119`](../../../.claude/skills/dispatcher/SKILL.md).

**Blocker B — the rest of the loop (steps 4–5).** This is *not* an Agent-tool problem and must not be diagnosed as one. The rework channel is the runtime-bridge REST CLI ([`.claude/skills/dispatcher/SKILL.md:134`](../../../.claude/skills/dispatcher/SKILL.md) — `answer.ts --decision request_changes`), which uses no subagent at all. What actually blocks here is the session's own confirm-before-outward-action default on push / `gh pr create` / `gh pr merge --squash` — a posture question, not a missing permission (`~/.claude/hooks/git-safety.sh` already allows `--squash` on `base=staging` / `base=epic/*`).

## Root cause

### Blocker A is an experiment-arm exposure, not a session-content effect

Two hypotheses were on the table for why `/night-mode` runs this loop overnight and never hits Blocker A: **(A)** its trigger phrases («работай всю ночь автономно») *are* the user's request, satisfying «unless the user requested it»; **(B)** it delegates its core to `superpowers:subagent-driven-development` (SSOT #64), so the request is implicit in choosing the skill.

**Both are falsified.** The append is an experiment-arm payload attached to a **client-data cache slot**, keyed by `(entrypoint, model, org)` and resolved *before the session starts* — nothing in it varies with the skill invoked, the trigger phrase, or any session content.

Evidence (`~/.claude/backups/.claude.json.backup.1784846564494`, `.clientDataCacheSlots`):

| slot | model | cached at | `experimentKey` | `tengu_heron_brook` |
|---|---|---|---|---|
| `bi1-90f2d9923b29089f` | `claude-opus-4-8` | 2026-07-23T20:38:56Z | `claude_code_canal_plateau_experiment` | **present** |
| `bi1-1ece075855c7fffa` | `claude-opus-4-8` | 2026-07-21T22:47:01Z | none | absent |
| `bi1-450a6f4feee9fb61` | `claude-fable-5` | 2026-07-22T18:23:51Z | none | absent |
| `bi1-aaa6ffa946792d3b` | `claude-haiku-4-5` | 2026-07-22T18:23:04Z | none | absent |
| `bi1-3160f8d233468d9b` | `claude-sonnet-5` | 2026-07-22T18:22:52Z | none | absent |
| (3 further slots) | fable-5 / sonnet-5 / sonnet-4-6 | 2026-07-20 – 07-22 | none | absent |

All eight slots share `entrypoint=claude-desktop`. The enrolled slot carries eleven data keys; every non-enrolled slot carries exactly two (`cedar_basin`, `cedar_lagoon`) and **no `experimentKey`**. The same `(desktop, opus-4-8)` pair is un-enrolled at 2026-07-21T22:47Z and enrolled at 2026-07-23T20:38Z — so enrollment opened inside that window.

**Third hypothesis, confirmed — (C) exposure gap.** A sweep of all recorded transcripts under `~/.claude/projects/` (87 sessions matched a night-mode trigger or Skill call) puts the last real `/night-mode` Skill invocation at **2026-07-22T10:59:05Z** — before the enrolled slot's cache time. `/night-mode` never met the append.

**Consequence, and it is the load-bearing one:** `/night-mode` is **not immune — it was never exposed.** Its SDD loop dispatches subagents constantly ([`.claude/skills/night-mode/SKILL.md:15`](../../../.claude/skills/night-mode/SKILL.md)), so an overnight run on an enrolled slot hits Blocker A on its first executor dispatch. Routing the aif loop «through the immune skill» buys nothing, because the immunity does not exist.

*Method note (T3):* the first two sweeps returned empty and looked like a finding. They were a tooling artifact — transcript paths begin with `-Users-art-…`, and `jq "$f"` read the leading `-` as an option flag. Re-run with a `./` prefix, the same sweep returned 87 rows. An empty result from a probe is not evidence until the probe is shown to produce non-empty results on a known-positive input.

### The authorization has no home

A grep of [`.claude/skills/night-mode/SKILL.md`](../../../.claude/skills/night-mode/SKILL.md) for `authoriz|standing|read-only` returns one incidental hit (line 33, «if the harness pre-authorizes it»), and a repo-wide grep for `standing authoriz` across all markdown returns nothing. So even setting the exposure gap aside, no artefact states that invoking an unattended skill authorizes the loop's actions — the behaviour was riding on trigger phrasing, which any rewording breaks.

## Solution

**One home, two pointers**, with the home chosen by [`doc-authority-hierarchy.md §4`](../../../.claude/rules/doc-authority-hierarchy.md) rather than by convenience.

- **Home = [`.claude/skills/night-mode/SKILL.md`](../../../.claude/skills/night-mode/SKILL.md), delta item 8.** That skill's header already claims «the unattended autonomy/fork policy … and the terminal condition for an unsupervised run» ([line 6](../../../.claude/skills/night-mode/SKILL.md)). Stating the authorization in `/pipeline` or `/dispatcher` — neither of which claims unattended-autonomy scope — would be `#contradicting-authority-claims`; stating it in both would be `#two-prompts-drift` ([`dual-implementation-discipline.md §8`](../../../.claude/rules/dual-implementation-discipline.md)).
- **Substrate seam, not a rewrite.** Delta item 8 also names the aif substrate and points at `/dispatcher` for its mechanics — exactly symmetric to the skill's existing «the loop is SDD (do not reinvent)». night-mode chooses the substrate and owns the autonomy policy; `/dispatcher` owns dispatch/harvest/rework; SDD owns the in-session loop. No mechanics are re-described, so no `#parallel-evolution-creep`.
- **Pointers only** in [`pipeline/SKILL.md §7`](../../../.claude/skills/pipeline/SKILL.md) and [`dispatcher/SKILL.md §2.4`](../../../.claude/skills/dispatcher/SKILL.md).
- **Nothing new is built.** dispatch / harvest / park / answer all already exist in `packages/runtime-bridge/src/cli/` ([`dispatcher/SKILL.md:50-57`](../../../.claude/skills/dispatcher/SKILL.md)) — BFR verdict **REUSE**, no capability commit.

**`#worker-dispatch-via-subagent` is not weakened, in either half.** [`pipeline/SKILL.md §5`](../../../.claude/skills/pipeline/SKILL.md) already scopes the Agent tool to «Phase -1 read-only reviewer + read-only research subagents»; the cold auditors are read-only and were always inside that envelope. The rework path uses REST (`answer.ts`), never a subagent. Write-task Workers still go to a fresh session or to aif.

**Honest classification ([`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md)).** The authorization line is **prose, Class C — not a mechanism.** It mitigates a default the repo does not control and cannot gate: the append is server-delivered, absent from `~/.claude/settings.json` and from the repo, and unreachable by any hook or CI check. It is the same posture the acceptance-contour spec already records for this surface — «night-mode edits are prose (Class C) … the skill edit is convenience, not the mechanism» ([`2026-07-23-acceptance-contour-design.md:175`](../../superpowers/specs/2026-07-23-acceptance-contour-design.md)).

**Falsifiers, stated up front:**

- If the experiment arm changes, is withdrawn, or the slot is re-enrolled differently, the line becomes a **no-op** — harmless, but it stops buying anything.
- If the default ever hardens from a prompt append into a tool-level block, prose cannot help at all; the reachable channel then becomes the harness, not this repo.
- The line is wrong if an unattended run carrying it still stalls at step 3 — in which case the append is not a prompt-level instruction and the whole mitigation class is void.

**Not attempted, deliberately:** `.claude/settings.json` is agent-uncommittable, and `bypassPermissions` is the wrong layer — the Agent call, once authorized in chat, ran with zero permission prompts under `permissions.defaultMode: auto`, so this was never a permission failure. Changing the mode would remove protection without touching the cause.

## Prevention

- **Do not infer immunity from absence of failure.** «Skill X never hit this» is an exposure claim, and exposure must be checked before mechanism is theorised. Both original hypotheses attributed to session content something decided before the session started. Discriminator: *could the proposed mechanism have varied the observation?* Here nothing in the payload varies with skill or phrasing, which falsifies A and B without needing any night-mode transcript at all.
- **A negative probe result is not a finding until the probe is shown to work.** Two empty sweeps here were an argument-parsing artifact (T3, and the `#asymmetric-skepticism-toward-lazy-path` shape — the empty result happened to support the convenient story).
- **State the falsifier when the mitigation is prose.** Under [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md) a prose mitigation may be decision authority, never the detection layer; recording what would make it a no-op keeps a future reader from treating it as a gate.

## §1.7 self-review

**Forward-check applied.** [`attention-is-not-a-mechanism.md §1`](../../../.claude/rules/attention-is-not-a-mechanism.md): the authorization is classified as decision authority, never a detection layer — the fail-closed [`pr-body-fidelity.ts:151`](../../../packages/core/hooks/checks/pr-body-fidelity.ts) gate stays the mechanism, and the falsifier is recorded above rather than implied. [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md): verdict **REUSE**, no capability commit — `dispatch.ts`/`harvest.ts`/`questions.ts`/`answer.ts` are the four pre-built primitives listed at [`dispatcher/SKILL.md:52-55`](../../../.claude/skills/dispatcher/SKILL.md) and the auditor already exists at [`agents/fidelity-auditor.md:18`](../../../agents/fidelity-auditor.md). [`doc-authority-hierarchy.md §4`](../../../.claude/rules/doc-authority-hierarchy.md): the home is chosen by whose header claims the scope — [`night-mode/SKILL.md:6`](../../../.claude/skills/night-mode/SKILL.md) claims «the unattended autonomy/fork policy», so stating it elsewhere would be `#contradicting-authority-claims`. [`dual-implementation-discipline.md §8`](../../../.claude/rules/dual-implementation-discipline.md): pointers, not copies, so `#two-prompts-drift` cannot open. [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md): all dispatch stays session-bound; nothing added to CI. [`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md): T3 (the cache-slot table and the 87-session sweep are command output, not recall) and T20 (no verdict issued before the slot comparison ran).

**Backward-check applied.** Class of this change = *an unattended-run autonomy posture stated in an operational skill, plus cross-skill pointers to a single authority home.* Surfaces where that class occurs, enumerated by `grep -rln 'unattended\|Night (unattended)\|overnight' .claude/skills/ .claude/rules/ agents/ docs/superpowers/specs/` and verdicted individually:

- [`dispatcher/SKILL.md:240-244`](../../../.claude/skills/dispatcher/SKILL.md) (D5 routing seats, `Night (unattended)` column) — **SWEPT-CLEAN**: its night column already says intent forks «stay parked — never guess», which the escalation set preserves verbatim rather than overriding.
- [`dispatcher/SKILL.md:190`](../../../.claude/skills/dispatcher/SKILL.md) (§2.4c notification discipline for unattended runs) — **SWEPT-CLEAN**: about notification volume, orthogonal to authorization; untouched.
- [`harvest/SKILL.md:64-75`](../../../.claude/skills/harvest/SKILL.md) — **GAP-FOUND**: a third substrate dispatching the same cold auditor and doing the same push/PR/merge, outside the two surfaces originally scoped. Closed in this PR with the same one-line pointer.
- [`agents/orchestrator-worker-discipline.md:91`](../../../agents/orchestrator-worker-discipline.md) — **SWEPT-CLEAN**: cites night-mode «delta item 7» by number; item 8 is appended, so no reference breaks (verified by `grep -rn 'delta item [0-9]'` across all markdown — the only external cites are items 1, 2 and 7).
- [`aif-doctor/SKILL.md:39`](../../../.claude/skills/aif-doctor/SKILL.md) — **SWEPT-CLEAN, deliberately**: environment *mutations* wait for operator GO. The authorization enumerates only read-only auditors, `answer.ts` rework, and push/PR/merge — it does not reach aif-doctor's gate, which stays intact.
- [`docs/superpowers/specs/2026-07-23-acceptance-contour-design.md:95-108`](../../superpowers/specs/2026-07-23-acceptance-contour-design.md) (D6 two-substrate table) — **SWEPT-CLEAN**: the substrate seam matches the spec's own «Factory (dispatcher) / In-session (night-mode/SDD)» split; the cap-2 rule is cited, not restated.
- [`egress-no-api-bypass.md`](../../../.claude/rules/egress-no-api-bypass.md) — **SWEPT-CLEAN**: governs *how* a branch egresses (host-side push, no API bypass); this change governs *whether a confirmation round is needed*, and adds no new egress channel.
- Global `~/.claude/skills/orchestrator/` Queue mode — **OUT OF SCOPE**: agent-uncommittable, maintainer-owned per [`dispatcher/SKILL.md:298`](../../../.claude/skills/dispatcher/SKILL.md); flagged, not edited.

**Self-application (T15).** The patch's own claim — «night-mode was never exposed» — is the exact shape it warns against in Prevention: an absence-of-failure inference. It is therefore backed by the slot table (a positive comparison of enrolled vs un-enrolled slots), not by the transcript sweep alone; the sweep only dates the exposure window. Had the slot evidence been unavailable, the honest verdict would have been «coverage insufficient to conclude» (T14), not «immune».

## Tags

`#unattended-autonomy` `#harness-default-outside-repo-control` `#exposure-gap-not-immunity` `#doc-authority-home-selection` `#class-c-prose-mitigation`
