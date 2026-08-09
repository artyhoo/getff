<!-- scope:s4-glm-onebutton-entry-verification -->

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

**Verdict: RESOLVED — default upstream is `lee-to/aif-handoff` (gh api confirmed 2026-08-09 per §7d.2; `sst-aif/aif-handoff` returns 404).** Task 3's docker-clone step now defaults to `https://github.com/lee-to/aif-handoff.git` with the `AIF_HANDOFF_REPO_URL` override preserved for consumers who mirror to a different remote.

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

## Run-4 update (2026-08-09, in-container)

Run 4 re-probed against the live aif (now reachable at `http://api:3009` from the executor container; the run-3 bridge-unreachable verdict was the §7e.1 base-URL trap — `localhost:3009` is unreachable in-container, `api:3009` returns 200). Items 1, 3, 4 falsifiers now run; §7e.4 verifier + §7e.6 fail-closed stub + refreshed §7e.3 park land.

### Item 1 — bridge probe: RESOLVED

```text
$ curl -sf http://api:3009/health
{"status":"ok","uptime":42770}
$ curl -sf http://api:3009/runtime-profiles | jq -r '.[].name'
Claude Opus (plan+review)
Z.AI GLM-5.2 SDK
Qwen3.8-Max-Preview
```

The run-3 park is **superseded with evidence**: bridge is reachable, 18-key shape from operator authoring-time probe is now grounded against live responses. The default URL `http://localhost:3009` in the helper stays (consumers' default); container-internal use must set `RUNTIME_BRIDGE_AIF_URL=http://api:3009` (the docker-compose service name).

### Item 3 — per-mode default mechanism: PARTIALLY RESOLVED (live MISS recorded honestly)

The aif API exposes `defaultTaskRuntimeProfileId` + `defaultReviewRuntimeProfileId` on the project record (live `GET /projects` confirms both fields; projects carry them today). The helper writes them via `PUT /projects/:id` per §7c #1. Live probe (run-4 container, 2026-08-09):

```text
[glm-onebutton] WARN per-mode-default PUT /projects/441c1c0c-b633-4612-a34c-2cc0c4d0eaf2 failed (rc=22). Response:
[glm-onebutton] WARN objective-3 MISS: per-mode defaults not set automatically — set them manually in the aif UI
```

The PUT fails with rc=22 (HTTP 4xx) because `createProjectSchema` is a full-body PUT validator; the GET-then-mutated body the helper sends does not satisfy it. This is existing aif behaviour, not a regression introduced by run-4. Honest-degrade path fires: the helper records the MISS and continues (the profile IS created; the consumer can set defaults in the aif UI). T16 verdict: Upstream problem class: "update project-level defaults via a generic project PUT". Our problem class: "set per-mode defaults on a profile we just created, without breaking other project fields". Match? PARTIAL — the mechanism exists but the schema-validation shape is incompatible with the GET-then-mutate pattern. Park trigger: if a future aif release exposes `PATCH /projects/:id` or a `/runtime-profiles/:id/set-default` route, replace the PUT with it.

### Item 4 — env-var name: RESOLVED

Live `POST /runtime-profiles/validate` response (transport=api, profile with `apiKeyEnvVar=ANTHROPIC_AUTH_TOKEN`):

```text
$ curl -s -X POST http://api:3009/runtime-profiles/validate \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg id '<real-id>' '{profileId: $id}')')"
{"ok":true,"message":"Claude SDK profile configured (using session auth)","details":null,
 "profile":{"source":"profile_id","profileId":"...","hasApiKey":false,"transport":"sdk",
            "apiKeyEnvVar":"ANTHROPIC_AUTH_TOKEN", ...}}
```

The env-var name `ANTHROPIC_AUTH_TOKEN` is confirmed in the live response. §7a #4(i) is honoured.

### §7e.4 — hasApiKey binding verifier: shape CORRECTED

Run-3 assumed `hasApiKey` was top-level in the validate response. Run-4 live probe shows it nests under `.profile.hasApiKey`:

```json
{"ok":true,"profile":{"hasApiKey":false,"apiKeyEnvVar":"ANTHROPIC_AUTH_TOKEN",...}}
```

Helper now tries `.profile.hasApiKey` first (live-accurate) and falls back to top-level `.hasApiKey` for older aif versions. The §7e.4 gate fires on `hasApiKey:false` even when `.ok:true` — closing the run-3 warning-nobody-reads shape. Paired-negative N4 in the test suite stubs the field as `false` and asserts the helper emits `FAILED step-C key-unreachable` + rc!=0.

### §7e.4 — wiring mechanism (W1+W2): DELIVERED

W1 (best-effort auto-wire): helper writes a marker-bearing `docker-compose.override.yml` at `$AIF_HANDOFF_CHECKOUT` when (a) `docker-compose.yml` exists, (b) no unmarked override collides, and (c) the listed services can be parsed. W2 (honest fallback): if W1 cannot apply, the helper prints the env_file snippet for the consumer's AI agent to apply + tightens the §7e.4 gate to a hard MISS.

Live W1 verification (run-4):

```text
$ # fake checkout with services api + agent
$ AIF_HANDOFF_CHECKOUT=/tmp/run4-fake-checkout bash scripts/getff-glm-onebutton.sh provision
[glm-onebutton] wire: wrote /tmp/run4-fake-checkout/docker-compose.override.yml covering services: agent api
[glm-onebutton] WARN wire: docker not in PATH — override persisted; consumer must run 'docker compose up -d'

$ cat /tmp/run4-fake-checkout/docker-compose.override.yml
# getff-glm-override-marker — managed by getff-glm-onebutton.sh provision
# Remove this file to undo the getff GLM key wiring.
# The value lives only in /tmp/glm-run4-probe.env; this file references the path.
services:
  agent:
    env_file:
      - .env
      - /tmp/glm-run4-probe.env
  api:
    env_file:
      - .env
      - /tmp/glm-run4-probe.env
```

Idempotency (re-run writes byte-identical override) and collision-back-off (unmarked override → rc=2 + W2 fallback) covered by 4 paired test blocks in the suite (46/0 green).

### §7e.3 — model proof: PARKED with refreshed evidence

Re-probed every plausible aif completion route (run-4):

```text
/runtime-profiles/<id>/v1/messages         -> 404
/runtime-profiles/<id>/chat/completions    -> 404
/runtime-profiles/<id>/completion          -> 404
/runtime-profiles/<id>/v1/chat/completions -> 404
/chat /prompt /infer /send /v1/messages /v1 /agent /agents  -> 404 (all)
/openapi.json                              -> 200 with empty body
```

Third options for the helper-direct route (Option A) were tested mechanically:
- `curl --header @-` with stdin-piped value: argv-exposure-free AND temp-file-free.
- BUT requires `printf '<header>: %s\n' "${!GLM_ENV_VAR}"` — the helper must expand the env-var, i.e. read the value. §2 constraint 1 explicitly forbids this ("automation reads the ENV VAR NAME (never the value) when calling the model").

The fork is genuine: two binding constraints in conflict (§7a #3 "one minimal model call" vs §2 constraint 1 "helper never reads value"). Refreshed park note in `scripts/getff-glm-onebutton.sh` lines 468-540 records the new probing evidence and the T16 verdict (curl --header @- pattern does NOT transfer — solves argv but presupposes the script reads the value). Park stays a §7 park pending operator resolution.

### §7e.6 — fail-closed stub: SHIPPED + paired-negatives green

Allowlist + body-aware create (rejects profiles whose name isn't on the allowlist; rejects create bodies missing the schema-required fields); paired-negatives N1 (rejects unknown profile name), N1b (rejects create body without runtimeId+providerId), N2 (run-4 arm-order hazard — `*"/validate"*` arm provably swallows `/runtime-profiles/validate` before the generic create arm), N2b (asserts the stub actually routes /validate to the validate arm — paired-positive for the N2 arm-ordering hazard), N3 (validate transport failure), N4 (validate returns `.profile.hasApiKey:false` → FAILED step-C key-unreachable), N5 (defensive-fallthrough — older aif without `.profile.hasApiKey` or top-level `.hasApiKey` field → helper falls back to `.ok` check and returns rc=0). All 47/0 green.

Run-4 update (post cold-QA revision): the happy-path stub and N4 now emit the LIVE-accurate nested shape `{"ok":true,"profile":{"hasApiKey":...}}` (probed 2026-08-09). Before the cold-QA revision they emitted top-level `hasApiKey`, exercising only the helper's `elif` fallback branch — the primary `.profile.hasApiKey` lookup that fires against live aif was untested. The cold-QA review (T19) caught this as M1; the fix landed before commit.

The run-3 stub defect (mock agreeing with the helper over an invented endpoint — the precise §7e.6 anti-pattern) is closed: the stub now uses the live-accurate shape, and any field the helper parses has at least one paired-negative that fails the helper when the field is absent/wrong.

### Live end-to-end (§4 item 1) — partial evidence

Live detect/explain/provision ran in-container with a throwaway key (`sk-run4-probe-not-a-real-key`). Detect returned `GLM_PROFILE: present` (api:3009 reachable); explain printed the env-file path correctly; provision went through step A (profile created), step B (PUT failed rc=22, MISS recorded honestly), step B.5 W1 (override written when fake checkout present), step C (validate returned `ok:false` "Missing API key" because the throwaway key was not in aif's process env — the §7e.4 verifier fired correctly and FAILED the run).

The §4.1 host-verify contract (`bash scripts/host-verify.sh beta-delivery-ux` + `bash tests/install-sh/glm-onebutton.test.sh` on the host) cannot be exercised in-container — the destination-environment-verification rule's whole point is that container≠host. PR body records this as host-verify-pending.

### Item 3 — ROOT CAUSE FOUND (run-5, 2026-08-09): the PUT rejects `null` budgets, not the shape

Item 3 above recorded the per-mode-default `PUT /projects/:id` as a live MISS (`rc=22`) and
attributed it to a schema-shape incompatibility, leaving objective 3 unmet. That attribution was
one layer short. Measured on the host 2026-08-09:

```text
A) PUT /projects/<id> with the GET body verbatim          -> 400
   {"name":"ZodError","message":"[{ \"expected\": \"number\", \"code\": \"invalid_type\",
     \"path\": [\"plannerMaxBudgetUsd\"],
     \"message\": \"Invalid input: expected number, received null\" }, …]"}
B) same body, null-valued *MaxBudgetUsd keys omitted      -> 200
```

`createProjectSchema` (aif `packages/api/src/schemas.ts`) declares all four budget fields as
`z.number().positive().optional()` — **optional but NOT nullable** — while `GET /projects` returns
them as `null`. The helper built its PUT body by mutating the GET body, so it fed four `null`s
straight back into a schema that rejects `null`. Every run therefore missed objective 3, on every
consumer, for a reason that had nothing to do with the fields the helper was trying to set.

**Objective 3 is met, not degraded.** The fix is one jq filter dropping null-valued `*MaxBudgetUsd`
keys; run B above returned 200 with `autoQueueMode`, both runtime-profile defaults and every other
value unchanged (read back via `GET /projects`). Guarded by the `regression §7c #1` assertion.

**Separately, the MISS is now terminal.** The failure branch previously warned and fell through to
`GLM_PROVISION: DONE`, and `INSTALL-FOR-AI.md:184` instructs the consumer's agent to report that
line verbatim — so a missed binding objective reached the consumer as success. §2 constraint 4 is
explicit that a degrade to manual steps is an objective-3 MISS and **not** a neutral fallback, so
the branch now emits `GLM_PROVISION: FAILED step-B per-mode-defaults` and returns non-zero. Paired
negative N6 proves it discriminates: reverting the fix turns N6 red (3 assertions), restoring it
returns 53/53 green.

### §1.7 self-reflexive note (run-5)

- **Forward-check:** complies with `.claude/rules/attention-is-not-a-mechanism.md` §1 — the
  fail-closed-stub invariant moved from a comment to a scanner over the file's own source, with a
  paired negative proving it discriminates (reverting the N6 fix turns 3 assertions red).
  Complies with `.claude/rules/destination-environment-verification.md` §1 — the A→400 / B→200
  pair and the suite's 53/53 were run on the **host**, not in the container. Complies with
  `no-paid-llm-in-ci.md` (deterministic bash + curl; the one billed call was an operator-authorised
  host probe, never a CI step) and `language-discipline.md` §1.
- **Backward-check:** class = *the same false-green shape appearing more than once in one file*.
  Enumerated within `scripts/getff-glm-onebutton.sh`: step-A preflight, step-A create, step-B
  projects-read, step-B project-id, step-C validate, step-C hasApiKey — all already terminal;
  step-B per-mode-defaults — **GAP-FOUND, fixed here**; the terminal `DONE` printf —
  **GAP-FOUND, NOT fixed** (see below). Sibling suites `tests/install-sh/bridge-guided.test.sh`
  were not swept for the stub-drift class; that is a stated gap, not a clean verdict.
- **Self-application, and where it failed.** The run-5 change establishes «a known-unmet binding
  objective must not surface as a green terminal token», fixes it for step B — and leaves the
  identical shape standing twelve lines later, where `GLM_PROVISION: DONE` prints while the log
  says the §7a #3 model call was never made. The round-5 cold audit graded that MAJOR and it is
  recorded here rather than quietly carried: closing it changes the consumer-facing terminal-token
  contract (`INSTALL-FOR-AI.md:184`), which is an owner decision. Applying a principle to one
  branch and not its neighbour in the same commit is the honest description of what happened.

### §1.7 self-reflexive note (run-4)

- **Forward-check:** complies with §7 park-don't-guess (model proof parked, not guessed); §7e.4 (verifier wired, not warning); §7e.6 (fail-closed + paired-negatives); §2 constraint 1 (helper never expands the value); no-paid-llm-in-ci.md (no LLM in CI); doc-authority-hierarchy.md §2-§3 (this patch is a research-patch under folder-level authority, no per-file header needed).
- **Backward-check:** no existing artefact is changed in load-bearing ways. INSTALL-FOR-AI.md:180 updated to reflect W1 (the only consumer-visible change). Helper script is the only code change. Test suite gains N4 + 4 W1 wire-test blocks (additive, no deletions).
- **Self-application:** this update patches the run-3 patch honestly — every claim that the run-3 patch made about "unreachable in this container" is now superseded with live evidence, recorded as such per the append-only convention.

---

## SUPERSEDING ADDENDUM (run-5, commit `34ccc8cece`) — three statements above are now false

Append-only, per the folder convention: the sections below are **not** edited in place, but a
reader following this file's ordering would otherwise land on withdrawn claims and act on them.
The round-6 cold audit graded exactly that risk, so the corrections are stated here at the end.

1. **`### §7e.3 — model proof: PARKED with refreshed evidence` (above) is SUPERSEDED.** The model
   proof is **DELIVERED** as step D in `scripts/getff-glm-onebutton.sh`: `POST /chat/sessions` pins
   the profile this run created, `POST /chat` sends one minimal completion to that session, and the
   response's `runtime.profileId` + `usage.totalTokens` are asserted. The park's line-number pointer
   («lines 468-540») no longer resolves to a park.
2. **«The fork is genuine: two binding constraints in conflict» is FALSIFIED.** There is no
   conflict. aif resolves the key from its OWN `process.env`, so the helper sends a profile id and
   never the value — §7a #3 and §2 constraint 1 hold together. The park rested on a
   negative-existence claim («every aif-side completion route is closed») generalised from a
   handful of 404s; `POST /chat/sessions` answered 400, not 404.
3. **The run-5 §1.7 note's «GAP-FOUND, NOT fixed» for the terminal `DONE` is SUPERSEDED.** `DONE` is
   now unreachable unless step D returns a completion bound to this run's profile with non-zero
   usage. The accompanying claim that «the log says the §7a #3 model call was never made» describes
   a line that no longer exists.

**Correction to the delivery itself, worth more than the delivery.** Step D was first written as a
single `POST /chat` carrying `runtimeProfileId`. It appeared to pass because the echoed profile
matched — by coincidence, the pinned profile was already the project default. Against a freshly
created profile the completion ran on the project default and echoed *that* back. `chat.ts:1336`
is why: `POST /chat` reads the profile off the chat SESSION and ignores the chat body's field when
opening a conversation. Hence the two-call form.

**Two follow-on corrections from the round-6 audit, both in this same branch.** The §2 constraint 1
assertion on the step-D surface was **vacuous**: it accumulated request argv into a shell variable,
and since the helper calls curl inside `$( )`, every stub call ran in a subshell and the variable
was empty at assertion time — a deliberately injected key value passed it. It now captures to a
file, guards that the capture is non-empty, and carries a paired negative; injecting a leak turns
it red. Separately, `INSTALL-FOR-AI.md`'s «a few cents at most» was falsified by this patch's own
`costUsd:0.117219` and is corrected to the measured figure, plus the two consumer-visible side
effects the sentence omitted (a `docker compose up -d` restart, and a chat session left behind).

**Still UNEXERCISED:** the chain against a profile the helper itself created. The verifying host's
aif carries `ZAI_API_KEY` and no `ANTHROPIC_AUTH_TOKEN` (names checked, values never read), so a
helper-created `transport=api` profile returns `CHAT_AUTH_ERROR` there whatever the code does. §4
item 1 is therefore **not** fulfilled, and the first consumer run is the first end-to-end execution.
