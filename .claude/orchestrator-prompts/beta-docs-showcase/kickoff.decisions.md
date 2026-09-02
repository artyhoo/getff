# beta-docs-showcase — decisions log (night run 2026-09-01/02, advisor seat)

Per `.claude/skills/night-mode/SKILL.md` delta items 1 + 8: a parked question whose decision
OBJECT sits inside a kickoff-authorized stage scope may be decided by a live top-tier night seat
on an advisor consult, with the entry recorded **before** application. Genuine owner forks and
floor-category objects stay parked. Entry shape: session-bus v2 §4.

## Decision 1 — PARK-BSPRE-4 (container Claude login + Opus profile flip before BS0) is RETRACTED as stale

**Decision package.** The night advisor seat recorded PARK-BSPRE-4 at 2026-09-02 01:40Z: «BS0 is
held until the operator runs `claude /login` inside `aif-handoff-agent-1` and flips the
`getff-landing` plan+review profile to `Claude Opus (plan+review)` `41315ef6`». The BS0 dispatch
chip carried that as a hard precondition, and the morning report (#1559) §5 + §6 item 15 restated
it as two operator floors. The BS0 dispatch session (dazzling-booth, 2026-09-02 ~03:14Z) measured
both legs red and challenged the premise.

**Decision.** The park is **stale and retracted**. BS0 is dispatchable now, inside aif, on the
executor tier (project default `53eca24c` «Z.AI GLM-5.3 SDK»), with **no** operator action.
The dispatch MUST NOT use `--preset aif` and MUST NOT carry a `<!-- bridge-profile: -->` marker
naming a Claude profile.

**Rationale (evidence).**

1. Merged, binding artefacts contradict the park: [`kickoff.md:18-25`](kickoff.md) («no Claude
   runtime in aif, GLM only … retired for this umbrella … a top-tier seat … is a host-side CC
   session, never an aif dispatch») and
   [`beta-docs-showcase-meta-launch/kickoff.md:205-208`](../beta-docs-showcase-meta-launch/kickoff.md)
   («retired, not deferred»), both via PR #1446 (merged 2026-08-17T18:56:15Z).
2. The operator's own directive in the night session, 2026-09-01T20:01:49Z, explicitly cancels
   the Opus-in-aif fork: «там была развилка с тем чтобы в аиф клод опус залогинить — так вот это
   нужно отменить, там всё настроено как надо». No later operator decision reinstates Opus.
3. Live instance matches the ratified state (measured 2026-09-02 03:14Z and 03:5xZ):
   `41315ef6` Opus `enabled=false`, `lastUsageAt=null`; `53eca24c` GLM-5.3 SDK enabled, last used
   2026-09-02T02:26Z; `getff-landing` plan/review = `53eca24c`. The dead container credentials
   (`expiresAt=0`, file mtime 2026-08-09) are the expected consequence of a deliberately disabled
   profile, not breakage — #1446 records that the BS-pre smoke task `cf894220` died on exactly
   this auth error, which triggered the disable.
4. The park's origin is a compaction-summary regression: the plan artifact's stale item 6
   («Разлогин контейнера → BS0») survived into the 01:40Z next-block check after the operator had
   already cancelled it at 20:01Z. Advisor slip, recorded here.

**Falsifier.** Wrong if an operator decision dated after 2026-08-17T18:56Z re-enables Opus for BS0
specifically (then `kickoff.md`, the meta-launch kickoff and the aif profile config are three places
out of date and need a correction PR before dispatch). Searched: the night transcript (user turns),
night memory, both kickoffs, PR #1446 body — none found.

**Reversibility.** Fully reversible: `PUT /runtime-profiles/41315ef6-… {"enabled": true}` restores
the profile (#1446 checklist), and the BS0 STOP-gate is mechanical (HTTPS 200, both llms routes
non-empty, noindex, Orama query, `/docs/<page>.md` curl) — a top-tier seat buys nothing at this
stage.

**Related live defect (owner fork, NOT fixed here — CLAUDE.md PR-strategy).**
`.claude/skills/pipeline/references/presets/aif.json` marker `Claude Opus (plan+review)` names a
disabled profile, and `presets/economy.json` marker `Z.AI GLM-5.2 SDK` matches no live profile
(instance runs 5.3). `AifHandoffBackend.ts:_resolveProfileId` reads an unfiltered
`GET /runtime-profiles`, so a disabled profile still matches by exact name and the task blocks later
on runtime auth (`blocked_external`, shape of `cf894220`); the 5.2 marker throws at dispatch. Both
presets are stale against the instance — repoint vs retire is the pipeline skill owner's call
(already surfaced in #1446 body).

**Decided-by.** Night advisor seat (Fable, session `beta-release-plan-c20d1e`) on the BS0 dispatch
session's challenge, 2026-09-02 ~04:00Z, under the operator's 20:01Z directive.
**Status.** applied — the BS0 dispatch session is cleared to dispatch on GLM; the chip precondition
is withdrawn; morning report corrected in the same PR as this entry.
