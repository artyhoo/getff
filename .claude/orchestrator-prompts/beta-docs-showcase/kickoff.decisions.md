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

## Decision 2 — BS0 runs as two legs; the scratch repo is created by the operator, not the worker

**Decision package.** Design B-D4 ([`2026-07-23-beta-docs-showcase-design.md:158-164`](../../../docs/superpowers/specs/2026-07-23-beta-docs-showcase-design.md)),
[`kickoff.md:56-58`](kickoff.md) and the meta-launch kickoff `:211-216` place the BS0 prototype in
a scratch repo `artyhoo/getff-docs-smoke`, with `github.io` as the fallback for the DNS step only.
Measured 2026-09-02 ~03:3xZ by the BS0 dispatch session: that repo **does not exist**
(`gh repo view` → not resolvable); the aif container has no route to github.com; the landing Pages
site is cname-bound to `main:/` of `artyhoo/getff-landing`; aif project `361685f1` has its container
base on `/home/www/getff-landing` (re-basing = compose/mount = operator step, meta-launch §1.1).
No autonomous worker can create a public repo under the operator's account, enable Pages on it, or
set DNS — all three are outward-facing operator actions.

**Decision.** BS0 runs as two legs with the design's gate **unchanged**:

- **Leg A (aif, GLM, autonomous, landing container):** branch `bs0-fumadocs-smoke` in
  `getff-landing`; prototype in a top-level `smoke/` laid out as the FUTURE scratch-repo root (own
  `package.json`, `.github/workflows/deploy.yml`, `.gitignore`); Fumadocs + Tailwind v4,
  `output: 'export'`, `basePath` from env, site-wide noindex (meta + `robots.txt`), ONE real ported
  page at the same slug `/docs/executable-agents-md`, Orama static index, `/llms.txt`,
  `/llms-full.txt`, physical `out/docs/<slug>.md` from the same source. In-container gate quoted
  (T3): `next build` green, `out/` served locally, every route curled (200 / non-empty / noindex /
  robots / `.md` body / search index contains the ported page). Fumadocs specifics from
  fumadocs.dev at build time (T12), versions pinned and quoted. Any route the framework cannot
  produce statically is a **FINDING** (R-B1), never a silent substitute.
- **Leg B (host, after harvest):** harvest pushes the branch to `origin` of `getff-landing`
  (**no PR to landing `main`, ever**; the branch dies at BS3 teardown or once the scratch repo holds
  it). Then the operator creates `artyhoo/getff-docs-smoke` (public), the `smoke/` subtree is pushed
  as its root, Pages deploys via workflow, the LIVE gate runs on `artyhoo.github.io/getff-docs-smoke`;
  `beta.getff.ai` DNS stays «flag, don't block» as designed.

**Reading rule.** Leg A green = «prototype builds, in-container gate quoted, deploy pending
operator» — **never «BS0 green»**. BS0→BS1 (B-D6) reads green only after the live gate (deployed
URL, Orama query, HTTPS, noindex) is quoted.

**Rationale.** (1) Worker-creates-repo is impossible (no github.com route) and outward-facing.
(2) Pages from a landing branch would displace `getff.ai` (cname bound to `main`). (3) Waiting for
the repo before dispatch burns the night on a 30-second host step that gates only the deploy half;
leg A is a reversible branch and is exactly the R-B1 measurement BS0 exists to take. The shape
extends the design's own «flag, don't block» doctrine (DNS) by one step (repo creation) on the same
reasoning.

**Falsifier.** Wrong if the operator wants BS0's workspace to be the scratch repo from commit 1 —
then the repo must exist first and the aif project re-based (both operator steps); leg A transplants
losslessly because `smoke/` is already the repo root.

**Reversibility.** Leg A is one branch in `getff-landing`, deletable; nothing touches `main`, Pages,
DNS, or any public surface.

**Floors (unchanged, operator-only).** Create `artyhoo/getff-docs-smoke` (public), enable Pages on
it, set `beta.getff.ai` DNS. None may be taken on a peer session's say-so.

**Decided-by.** Night advisor seat (Fable) on the BS0 dispatch session's proposal, 2026-09-02
~04:15Z. **Status.** applied — stage kickoff authored on this shape by the BS0 dispatch session;
dispatched 2026-09-02T03:51:33Z as aif task `371242f1-d385-47a3-acc0-9802eefd0626` on project `361685f1` (getff-landing), `runtimeProfileId=null` → project defaults (plan/review `53eca24c` GLM-5.3 SDK, task `088182b8` GLM-5.3 Flash); stage kickoff `kickoff-b0.md` (#1561 `d813773aa3`, corrected by #1562 `b68443e094`).
