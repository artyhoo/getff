# S4 GLM one-button — entry verification research-patch

> **Authoritative for:** the S4 entry-verification evidence base (which §7a resolutions held live, which parked, at the moment of stage S4 implementation).
> **NOT authoritative for:** the §7a resolutions themselves (operator-issued, binding — see plan `.ai-factory/plans/feature-beta-delivery-ux-92bf00.md` §7a) or the binding spec (`docs/superpowers/specs/2026-07-23-beta-program-design.md` §4 A2/A1).

> **Scope:** beta-delivery-ux S4. One patch per gap; append-only.

## Problem

The §7a operator resolutions (issued 2026-08-08) carry explicit falsifiers — «re-read the live schema at entry», «if the live `createRuntimeProfileSchema` names a different expected var, PARK». This patch records whether each falsifier ran at stage entry and what it found. The stage runs autonomously (HANDOFF_MODE=1); the park-don't-guess contract is binding.

## Entry verification results (2026-08-08, executor container)

### Item 1 — bridge probe

Command: `curl -sS --max-time 5 "${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}/runtime-profiles"`

Result:

```text
RUNTIME_BRIDGE_AIF_URL: unset
curl: (7) Failed to connect to localhost port 3009 after 0 ms: Couldn't connect to server
```

**Verdict: PARKED — bridge unreachable.** The one-button flow presupposes a running aif (spec §3); the executor container has no aif-handoff runtime. This is a §7 park trigger verbatim («If the bridge is unreachable, park»). The 18-key shape from the kickoff §1 (operator's authoring-time probe) remains the only available schema evidence.

### Item 2 — live schema source

Path probed: `~/code/aif-handoff/packages/api/src/routes/runtimeProfiles.ts`

Result: `ls: cannot access '/home/node/code/aif-handoff': No such file or directory`

**Verdict: PARKED — schema file inaccessible.** §7 park trigger fires verbatim («If the file is unreachable from the executor container, park Task 1 with the bridge probe output cited as the only available shape evidence»). Field semantics are NOT guessed from the 18-key list alone.

### Item 3 — project-level per-mode-default mechanism

Cannot verify — requires either a live aif endpoint (item 1 down) or the schema source (item 2 inaccessible). §7a #2 (Option A — project-level aif runtime-profile config) is implemented on operator authority; the mechanism's existence in live aif is UNVERIFIED at build time. Task 2 step B (per-mode defaults) is structurally implemented per §7a #2 but carries an honest-degrade path: if the project-level endpoint rejects the PATCH at consumer-install time, the helper emits `GLM_PROVISION: FAILED per-mode-defaults <response>` and the consumer falls back to guided-manual (objective-3 MISS recorded per kickoff §4 item 5).

### Item 4 — env-var name falsifier

§7a #4(i) sets `ANTHROPIC_AUTH_TOKEN` with falsifier «if the live schema names a different expected var, PARK». The falsifier REQUIRES reading the live schema, which is inaccessible (item 2). The SKILL.md D3 row at `.claude/skills/claude-glm-executor-handoff/SKILL.md:36` cites this as the canonical name per docs.z.ai (`https://api.z.ai/api/anthropic` + `ANTHROPIC_AUTH_TOKEN=<z.ai key>`).

**Verdict: implemented on operator authority + SKILL.md evidence; falsifier UNRESOLVED.** The env-var name is `ANTHROPIC_AUTH_TOKEN`. If a consumer's live aif rejects this name, the helper's validation-ping step (§7a #3) fails with an auth error and honest-degrades.

### Item 5 — aif-handoff repo URL for guided install

Command: `git -C ~/code/aif-handoff remote -v` → `fatal: cannot change to '/home/node/code/aif-handoff': No such file or directory`

**Verdict: PARKED — repo URL unverified.** Task 3's docker-clone step uses a placeholder URL with an env-var override (`AIF_HANDOFF_REPO_URL`), defaulting to the operator's checkout-path-implied origin. The consumer must verify the URL at install time; the helper records the URL it cloned in the install audit log.

### §1.1 — companion engine `@profile:` enforcement

`setup.d/engine.sh:14-74` — `companion_step` gates on `kind` only (external-service → print + return 0 at :18-21; mcp → claude CLI check; cc-plugin/cli → detect+install loop). The engine does **NOT** parse `@profile:` markers. The `@profile: factory` comment block (`companions.manifest:22-30`) is a **comment-only convention** consumed by humans + the install.sh factory gate (which checks `[ "${PROFILE:-core}" = "factory" ]`), NOT by engine.sh. The new helper is invoked from install.sh after the setup.d layer loop (install.sh:1112-1115), NOT from engine.sh. **No engine edit needed** — this mirrors the existing `runtime-bridge` row precedent (companions.manifest:18, engine.sh:18-21).

## Resolution notes

Every §7a resolution is **implemented on operator authority** (binding per §7a) with falsifiers **UNRESOLVED at build time**. The parks are on LIVE VERIFICATION, not on the resolutions themselves. The code ships structurally complete against the §7a resolutions; the live-fired proof (kickoff §4 item 1) is gated on a running aif + a z.ai key in the executor env — neither available in this container. The PR body records:
- The one-button helper (Task 2) ships with `detect` + `explain` fully working; `provision` is structurally complete per §7a #1/#3, live-unverified.
- The per-mode-default step (§7a #2) carries an honest-degrade path for the case the project-level endpoint rejects the PATCH.
- The guided-install helper (Task 3) ships with detection + degrade paths working; docker-clone URL is env-overridable with a documented default.

This is the honest path. The alternative — stopping all downstream tasks because the live aif is unreachable — would ship nothing, contradicting the operator's re-dispatch intent (run-1 parked; run-2 dispatched WITH the resolutions made binding for implementation).

## Self-application (T15)

This research-patch dogfoods §7a: the §7a resolutions are the design intent; this patch is the falsifier-gate evidence. The falsifiers that COULD run (item 1 bridge probe, item 2 schema-file existence, §1.1 engine-source read) ran and parked honestly. The falsifiers that REQUIRE a live aif (items 3, 4) are structurally unreachable in this container and recorded as such — NOT silently skipped.
